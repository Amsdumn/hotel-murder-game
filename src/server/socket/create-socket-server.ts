import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import type { Socket } from "socket.io";
import { MongoLobbyStore } from "../database/mongo-lobby-store";
import { LobbyError, LobbyService } from "../lobby/lobby-service";
import { GameService } from "../game-engine/game-service";
import { projectGameResult } from "../game-engine/phases";
import { projectMurdererTeamState, projectPrivatePlayerState, projectPublicState } from "../game-engine/projections";
import type { EngineResult } from "../game-engine/state";
import type { LobbyIdentity, LobbyView, LobbyAck } from "../../types/lobby";
import { LobbyJoinRateLimiter } from "./lobby-rate-limit";

function room(code: string): string { return `lobby:${code}`; }

function errorCode(error: unknown): LobbyAck<never> {
  if (error instanceof LobbyError) return { ok: false, error: error.code };
  console.error("Lobby socket action failed", error);
  return { ok: false, error: "SERVER_UNAVAILABLE" };
}

async function respond<T>(ack: unknown, work: () => Promise<T>): Promise<void> {
  if (typeof ack !== "function") return;
  try { ack({ ok: true, data: await work() } satisfies LobbyAck<T>); }
  catch (error) { ack(errorCode(error)); }
}

export function createSocketServer(httpServer: HttpServer, service = new LobbyService(new MongoLobbyStore()), games = new GameService(new MongoLobbyStore())): SocketServer {
  const io = new SocketServer(httpServer, { path: "/socket.io" });
  const bindings = new Map<string, { code: string; playerId: string }>();
  const activeSockets = new Map<string, string>();
  const pendingDisconnects = new Map<string, ReturnType<typeof setTimeout>>();
  const lastPublicState = new Map<string, string>();
  const lastPrivateState = new Map<string, string>();
  const lastTeamState = new Map<string, string>();
  const lobbyEntryLimits = new LobbyJoinRateLimiter();

  function bind(socket: Socket, identity: LobbyIdentity): void {
    const pending = pendingDisconnects.get(identity.playerId);
    if (pending) clearTimeout(pending);
    pendingDisconnects.delete(identity.playerId);
    const previousSocketId = activeSockets.get(identity.playerId);
    activeSockets.set(identity.playerId, socket.id);
    bindings.set(socket.id, { code: identity.code, playerId: identity.playerId });
    socket.join(room(identity.code));
    if (previousSocketId && previousSocketId !== socket.id) io.sockets.sockets.get(previousSocketId)?.disconnect(true);
  }

  function publish(view: LobbyView): void { io.to(room(view.code)).emit("lobby:state", view); }

  function publishGame(result: EngineResult): void {
    const publicState = projectPublicState(result.state);
    const publicSignature = JSON.stringify({ ...publicState, version: 0 });
    if (lastPublicState.get(result.state.code) !== publicSignature) {
      lastPublicState.set(result.state.code, publicSignature);
      io.to(room(result.state.code)).emit("game:state", publicState);
    }
    for (const event of result.publicEvents) io.to(room(result.state.code)).emit("game:event", event);
    for (const player of result.state.players) {
      const socketId = activeSockets.get(player.id);
      if (socketId) {
        const privateState = projectPrivatePlayerState(result.state, player.id);
        const privateSignature = JSON.stringify({ ...privateState, version: 0 });
        if (lastPrivateState.get(player.id) !== privateSignature) {
          lastPrivateState.set(player.id, privateSignature);
          io.to(socketId).emit("game:private", privateState);
        }
        const teamState = player.isAlive && player.team === "MURDERER" ? projectMurdererTeamState(result.state, player.id) : null;
        const teamSignature = JSON.stringify(teamState);
        if (lastTeamState.get(player.id) !== teamSignature) {
          lastTeamState.set(player.id, teamSignature);
          io.to(socketId).emit("game:team", { version: result.state.version, teamState });
        }
      }
    }
    for (const event of result.privateEvents) {
      const socketId = activeSockets.get(event.recipientPlayerId);
      if (socketId) io.to(socketId).emit("game:private-event", event);
    }
    if (result.state.phase === "FINISHED") io.to(room(result.state.code)).emit("game:result", projectGameResult(result.state));
  }

  let timerErrorLogged = false;
  const timer = setInterval(() => { void games.advanceDue().then((results) => { timerErrorLogged = false; results.forEach(publishGame); }).catch((error: unknown) => { if (!timerErrorLogged) console.error("Game timer failed", error); timerErrorLogged = true; }); }, 1000);
  timer.unref();
  const isOccupied = (code: string) => (io.sockets.adapter.rooms.get(room(code))?.size ?? 0) > 0;
  const cleanupUnusedRooms = () => service.cleanupUnusedRooms(Date.now() - 10 * 60_000, isOccupied);
  const sweepUnusedRooms = async () => {
    const now = Date.now();
    for (const { code } of await service.listRooms()) await service.setRoomEmptySince(code, isOccupied(code) ? null : now);
    await cleanupUnusedRooms();
  };
  const cleanupTimer = setInterval(() => { void sweepUnusedRooms().catch((error: unknown) => console.error("Unused room cleanup failed", error)); }, 60_000);
  cleanupTimer.unref();
  httpServer.on("close", () => {
    clearInterval(timer);
    clearInterval(cleanupTimer);
    for (const pending of pendingDisconnects.values()) clearTimeout(pending);
    pendingDisconnects.clear();
  });

  io.on("connection", (socket) => {
    socket.emit("server:ready", { status: "ready" });
    socket.on("lobby:list", (ack: unknown) => {
      void respond(ack, () => {
        if (!lobbyEntryLimits.allow(socket.handshake.address, "list")) throw new LobbyError("RATE_LIMITED");
        return service.listRooms();
      });
    });
    socket.on("lobby:preview", (code: unknown, ack: unknown) => {
      void respond(ack, () => {
        if (!lobbyEntryLimits.allow(socket.handshake.address, "preview")) throw new LobbyError("RATE_LIMITED");
        return service.preview(code);
      });
    });
    socket.on("lobby:create", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        if (bindings.has(socket.id)) throw new LobbyError("FORBIDDEN");
        if (!lobbyEntryLimits.allow(socket.handshake.address, "create")) throw new LobbyError("RATE_LIMITED");
        await sweepUnusedRooms();
        const identity = await service.create(input);
        bind(socket, identity);
        publish(identity.view);
        return identity;
      });
    });
    socket.on("lobby:join", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        if (bindings.has(socket.id)) throw new LobbyError("FORBIDDEN");
        if (!lobbyEntryLimits.allow(socket.handshake.address, "join")) throw new LobbyError("RATE_LIMITED");
        const identity = await service.join(input);
        bind(socket, identity);
        publish(identity.view);
        return identity;
      });
    });
    socket.on("lobby:resume", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        if (bindings.has(socket.id)) throw new LobbyError("FORBIDDEN");
        if (!lobbyEntryLimits.allow(socket.handshake.address, "resume")) throw new LobbyError("RATE_LIMITED");
        const request = input as { code?: unknown; token?: unknown } | null;
        const identity = await service.resume(request?.code, request?.token);
        bind(socket, identity);
        const snapshot = await games.snapshot(identity.code, identity.playerId);
        if (snapshot) {
          socket.emit("game:state", snapshot.publicState);
          socket.emit("game:private", snapshot.privateState);
          socket.emit("game:team", snapshot.teamState);
          if (snapshot.result) socket.emit("game:result", snapshot.result);
        } else publish(identity.view);
        return identity;
      });
    });
    socket.on("lobby:ready", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const view = await service.setReady(binding.playerId, input);
        publish(view);
        return view;
      });
    });
    socket.on("lobby:configure", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const view = await service.configure(binding.playerId, input);
        publish(view);
        return view;
      });
    });
    socket.on("lobby:rename", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const view = await service.rename(binding.playerId, input);
        publish(view);
        return view;
      });
    });
    socket.on("lobby:kick", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const targetId = (input as { playerId?: unknown } | null)?.playerId;
        const view = await service.kick(binding.playerId, input);
        if (typeof targetId === "string") {
          const targetSocketId = activeSockets.get(targetId);
          if (targetSocketId) {
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            targetSocket?.emit("lobby:kicked");
            bindings.delete(targetSocketId);
            activeSockets.delete(targetId);
            targetSocket?.leave(room(binding.code));
            targetSocket?.disconnect(true);
          }
        }
        publish(view);
        return view;
      });
    });
    socket.on("game:start", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const result = await games.start(binding.code, binding.playerId, input);
        publishGame(result);
        return { version: result.state.version };
      });
    });
    socket.on("game:skill", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const result = await games.skill(binding.code, binding.playerId, input);
        publishGame(result);
        return { version: result.state.version };
      });
    });
    socket.on("game:vote", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const result = await games.vote(binding.code, binding.playerId, input);
        publishGame(result);
        return { version: result.state.version };
      });
    });
    socket.on("game:chat", (input: unknown, ack: unknown) => {
      void respond(ack, async () => {
        const binding = bindings.get(socket.id);
        if (!binding) throw new LobbyError("INVALID_SESSION");
        const result = await games.chat(binding.code, binding.playerId, input);
        publishGame(result);
        return { version: result.state.version };
      });
    });
    socket.on("disconnect", () => {
      const binding = bindings.get(socket.id);
      bindings.delete(socket.id);
      if (!binding || activeSockets.get(binding.playerId) !== socket.id) return;
      activeSockets.delete(binding.playerId);
      const pending = setTimeout(() => {
        pendingDisconnects.delete(binding.playerId);
        if (activeSockets.has(binding.playerId)) return;
        void service.setConnected(binding.playerId, false).then(async (view) => {
          publish(view);
          if (!isOccupied(binding.code)) await service.setRoomEmptySince(binding.code, Date.now());
        }).catch((error: unknown) => console.error("Unable to mark player disconnected", error));
      }, 2000);
      pending.unref();
      pendingDisconnects.set(binding.playerId, pending);
    });
  });
  return io;
}
