"use client";

import type { Socket } from "socket.io-client";
import type { PrivatePlayerState, PublicGameState } from "@/types/game";
import type { LobbyIdentity, LobbyView } from "@/types/lobby";
import { createActionId } from "./action-id";
import { connectLobbySocket, requestLobby } from "./lobby-client";

export function canUseLocalBots(hostname: string, environment: string): boolean {
  return environment === "development" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

export function chooseLocalBotCommand(state: PublicGameState, player: PrivatePlayerState): { event: "game:skill" | "game:vote"; payload: Record<string, unknown> } | null {
  if (!player.isAlive) return null;
  const rooms = state.publicRooms.filter((room) => room.state === "UNKNOWN").map((room) => room.roomNumber);
  if (state.phase === "SKILL_PHASE" && player.canUseSkill) {
    let target: number | number[] | string | undefined;
    if (player.role === "ACCOMPLICE") target = state.players.find((guest) => guest.id !== player.playerId && guest.isAlive !== false)?.id;
    else if (["ELECTRICIAN", "HOUSEKEEPER", "WITNESS"].includes(player.role)) target = rooms.length ? Math.floor(rooms[0] / 100) : undefined;
    else if (player.role === "WINDOW_CLEANER") target = rooms.length ? rooms[0] % 100 : undefined;
    else if (player.role === "KILLER" && state.players.length === 5 && state.turn === 2) target = rooms.length >= 2 ? rooms.slice(0, 2) : undefined;
    else if (player.role !== "RECEPTIONIST" && player.role !== "PHOTOGRAPHER") target = rooms.find((room) => player.role !== "LOCKSMITH" || !player.locksmithUsedRooms?.includes(room));
    return target === undefined ? null : { event: "game:skill", payload: { target } };
  }
  if (state.phase === "VOTING" && player.canVote && !state.votes?.some((vote) => vote.playerId === player.playerId)) {
    const roomNumber = rooms.find((room) => room !== player.roomNumber && (!state.runoffRooms?.length || state.runoffRooms.includes(room)));
    return roomNumber === undefined ? null : { event: "game:vote", payload: { roomNumber } };
  }
  return null;
}

const activeBots = new Map<string, Socket[]>();

export function localBotCount(code: string): number {
  return activeBots.get(code)?.filter((socket) => socket.connected).length ?? 0;
}

function waitForConnect(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Connection timed out")); }, 8000);
    const connected = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Connection failed")); };
    const cleanup = () => { clearTimeout(timer); socket.off("connect", connected); socket.off("connect_error", failed); };
    socket.once("connect", connected);
    socket.once("connect_error", failed);
  });
}

export function disconnectLocalTestBots(code: string): void {
  for (const socket of activeBots.get(code) ?? []) socket.disconnect();
  activeBots.delete(code);
}

export async function addLocalTestBots(code: string, count: number, onProgress: (count: number) => void, options: { hostname?: string; environment?: string; connect?: () => Socket } = {}): Promise<void> {
  if (!canUseLocalBots(options.hostname ?? window.location.hostname, options.environment ?? process.env.NODE_ENV)) throw new Error("Local test bots are unavailable here");
  const sockets = activeBots.get(code) ?? [];
  activeBots.set(code, sockets);
  for (let index = 0; index < count; index++) {
    const socket = (options.connect ?? connectLobbySocket)();
    try {
      await waitForConnect(socket);
      const preview = await requestLobby<LobbyView>(socket, "lobby:preview", code);
      if (!preview.ok) throw new Error(preview.error);
      const joined = await requestLobby<LobbyIdentity>(socket, "lobby:join", { code, displayName: `Test Player ${preview.data.players.length + 1}`, actionId: createActionId(), expectedVersion: preview.data.version });
      if (!joined.ok) throw new Error(joined.error);
      const ready = await requestLobby<LobbyView>(socket, "lobby:ready", { ready: true, actionId: createActionId(), expectedVersion: joined.data.view.version });
      if (!ready.ok) throw new Error(ready.error);
      let publicState: PublicGameState | null = null;
      let privateState: PrivatePlayerState | null = null;
      let busy = false;
      let attemptedKey = "";
      const act = async () => {
        if (busy || !publicState || !privateState) return;
        const command = chooseLocalBotCommand(publicState, privateState);
        if (!command) return;
        const key = `${command.event}:${publicState.turn}:${publicState.phaseDeadlineAt}:${JSON.stringify(command.payload)}`;
        if (key === attemptedKey) return;
        attemptedKey = key;
        busy = true;
        const answer = await requestLobby<{ version: number }>(socket, command.event, { ...command.payload, actionId: createActionId(), expectedVersion: publicState.version });
        busy = false;
        if (!answer.ok) attemptedKey = "";
      };
      socket.on("game:state", (next: PublicGameState) => { publicState = next; void act(); });
      socket.on("game:private", (next: PrivatePlayerState) => { privateState = next; void act(); });
      sockets.push(socket);
      onProgress(localBotCount(code));
    } catch (error) {
      socket.disconnect();
      throw error;
    }
  }
}
