import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import type { Server as SocketServer } from "socket.io";
import { LobbyService } from "../lobby/lobby-service";
import { MemoryLobbyStore } from "../lobby/test-memory-store";
import { createSocketServer } from "./create-socket-server";
import { GameService } from "../game-engine/game-service";
import { performSkill } from "../game-engine/gameplay";
import { projectPublicState } from "../game-engine/projections";

const sockets: ClientSocket[] = [];
let httpServer: ReturnType<typeof createServer> | null = null;
let socketServer: SocketServer | null = null;

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect();
  if (socketServer) await new Promise<void>((resolve) => socketServer?.close(() => resolve()));
  if (httpServer?.listening) await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
  socketServer = null;
  httpServer = null;
});

async function setup() {
  httpServer = createServer();
  const store = new MemoryLobbyStore();
  socketServer = createSocketServer(httpServer, new LobbyService(store), new GameService(store));
  await new Promise<void>((resolve) => httpServer?.listen(0, "127.0.0.1", resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const client = () => {
    const socket = connect(`http://127.0.0.1:${port}`, { reconnection: false, transports: ["websocket"] });
    sockets.push(socket);
    return socket;
  };
  return { client, store };
}

describe("Socket.IO lobby", () => {
  it("limits unauthenticated room reads before querying the store", async () => {
    const { client } = await setup();
    const visitor = client();
    for (let attempt = 0; attempt < 60; attempt += 1) expect((await visitor.emitWithAck("lobby:list")).ok).toBe(true);
    expect(await visitor.emitWithAck("lobby:list")).toEqual({ ok: false, error: "RATE_LIMITED" });
    for (let attempt = 0; attempt < 30; attempt += 1) expect((await visitor.emitWithAck("lobby:preview", "ABC234")).error).toBe("LOBBY_NOT_FOUND");
    expect(await visitor.emitWithAck("lobby:preview", "ABC234")).toEqual({ ok: false, error: "RATE_LIMITED" });
    for (let attempt = 0; attempt < 30; attempt += 1) expect((await visitor.emitWithAck("lobby:resume", { code: "ABC234", token: "0".repeat(64) })).error).toBe("INVALID_SESSION");
    expect(await visitor.emitWithAck("lobby:resume", { code: "ABC234", token: "0".repeat(64) })).toEqual({ ok: false, error: "RATE_LIMITED" });
  }, 15000);

  it("limits room creation and join attempts per address without blocking resume", async () => {
    const { client } = await setup();
    const created = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reply = await client().emitWithAck("lobby:create", { displayName: `Host ${attempt}`, actionId: crypto.randomUUID() });
      if (attempt < 2) expect(reply.ok).toBe(true);
      else expect(reply).toEqual({ ok: false, error: "ROOM_LIMIT_REACHED" });
      created.push(reply);
    }
    expect(await client().emitWithAck("lobby:create", { displayName: "Extra Host", actionId: crypto.randomUUID() })).toEqual({ ok: false, error: "RATE_LIMITED" });

    const visitor = client();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(await visitor.emitWithAck("lobby:join", { code: "ABC234", displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: 0 })).toEqual({ ok: false, error: "LOBBY_NOT_FOUND" });
    }
    expect(await visitor.emitWithAck("lobby:join", { code: "ABC234", displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: 0 })).toEqual({ ok: false, error: "RATE_LIMITED" });
    expect(created[0].ok).toBe(true);
    if (created[0].ok) expect((await client().emitWithAck("lobby:resume", { code: created[0].data.code, token: created[0].data.token })).ok).toBe(true);
  });

  it("allows visitors to list active rooms without private player data", async () => {
    const { client } = await setup();
    const visitor = client();
    const host = client();
    const created = await host.emitWithAck("lobby:create", { displayName: "Secret Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const listed = await visitor.emitWithAck("lobby:list");
    expect(listed).toEqual({ ok: true, data: [{ code: created.data.code, playerCount: 1, playerLimit: 10, status: "WAITING" }] });
    expect(JSON.stringify(listed)).not.toContain("Secret Host");
    expect(JSON.stringify(listed)).not.toContain(created.data.token);
  });

  it("creates and lists two rooms through separate host sockets", async () => {
    const { client } = await setup();
    const first = await client().emitWithAck("lobby:create", { displayName: "Host A", actionId: crypto.randomUUID() });
    const second = await client().emitWithAck("lobby:create", { displayName: "Host B", actionId: crypto.randomUUID() });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data.code).not.toBe(first.data.code);
    const listed = await client().emitWithAck("lobby:list");
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.map((room: { code: string }) => room.code).sort()).toEqual([first.data.code, second.data.code].sort());
  });

  it("keeps a brief network drop from toggling lobby presence and version", async () => {
    const { client, store } = await setup();
    const original = client();
    const created = await original.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    original.disconnect();
    await delay(100);
    expect((await store.findLobby(created.data.code))?.version).toBe(created.data.view.version);
    const replacement = client();
    const resumed = await replacement.emitWithAck("lobby:resume", { code: created.data.code, token: created.data.token });
    expect(resumed.ok).toBe(true);
    await delay(2200);
    expect((await store.findLobby(created.data.code))?.version).toBe(created.data.view.version);
    expect((await store.findLobby(created.data.code))?.players[0]?.connected).toBe(true);
  }, 15000);

  it("marks a player offline after the reconnect grace period expires", async () => {
    const { client, store } = await setup();
    const original = client();
    const created = await original.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    original.disconnect();
    await delay(2200);
    const lobby = await store.findLobby(created.data.code);
    expect(lobby?.players[0]?.connected).toBe(false);
    expect(lobby?.version).toBe(created.data.view.version + 1);
    expect(lobby?.emptySince).toEqual(expect.any(Number));
    const replacement = client();
    const resumed = await replacement.emitWithAck("lobby:resume", { code: created.data.code, token: created.data.token });
    expect(resumed.ok).toBe(true);
    expect((await store.findLobby(created.data.code))?.emptySince).toBeUndefined();
  }, 15000);

  it("reports an intentional server disconnect when a second socket takes over a player", async () => {
    const { client } = await setup();
    const first = client();
    const created = await first.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const reason = new Promise<string>((resolve) => first.once("disconnect", resolve));
    const replacement = client();
    expect((await replacement.emitWithAck("lobby:resume", { code: created.data.code, token: created.data.token })).ok).toBe(true);
    expect(await reason).toBe("io server disconnect");
  }, 15000);

  it("starts a game with public and private state separated", async () => {
    const { client } = await setup();
    const host = client();
    const created = await host.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const members = [host];
    let version = created.data.view.version;
    for (let index = 1; index < 5; index += 1) {
      const member = client();
      const joined = await member.emitWithAck("lobby:join", { code: created.data.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: version });
      expect(joined.ok).toBe(true);
      if (!joined.ok) return;
      version = joined.data.view.version;
      members.push(member);
    }
    for (const member of members) {
      const ready = await member.emitWithAck("lobby:ready", { actionId: crypto.randomUUID(), expectedVersion: version, ready: true });
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      version = ready.data.version;
    }
    const configured = await host.emitWithAck("lobby:configure", { actionId: crypto.randomUUID(), expectedVersion: version, playerLimit: 10, discussionSeconds: 180, selectedInnocentRoles: ["LOCKSMITH", "HOUSEKEEPER", "WITNESS"] });
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;
    version = configured.data.version;
    const publicState = new Promise<unknown>((resolve) => members[1].once("game:state", resolve));
    const privateState = new Promise<unknown>((resolve) => members[1].once("game:private", resolve));
    const start = await host.emitWithAck("game:start", { actionId: crypto.randomUUID(), expectedVersion: version });
    expect(start.ok).toBe(true);
    const publicData = await publicState;
    const privateData = await privateState;
    expect(JSON.stringify(publicData)).not.toMatch(/roomNumber.{0,30}role|"role"|"team"|"isAlive"/);
    expect(privateData).toEqual(expect.objectContaining({ playerId: expect.any(String), role: expect.any(String), roomNumber: expect.any(Number) }));
  }, 15000);

  it("broadcasts only a generic murder event and restores spectator state on reconnect", async () => {
    const { client, store } = await setup();
    const members = [client()];
    const identities = [await members[0].emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() })];
    expect(identities[0].ok).toBe(true);
    if (!identities[0].ok) return;
    const code = identities[0].data.code;
    let version = identities[0].data.view.version;
    for (let index = 1; index < 5; index += 1) {
      const member = client();
      const identity = await member.emitWithAck("lobby:join", { code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: version });
      expect(identity.ok).toBe(true);
      if (!identity.ok) return;
      members.push(member); identities.push(identity); version = identity.data.view.version;
    }
    for (const member of members) {
      const ready = await member.emitWithAck("lobby:ready", { actionId: crypto.randomUUID(), expectedVersion: version, ready: true });
      expect(ready.ok).toBe(true);
      if (!ready.ok) return;
      version = ready.data.version;
    }
    const configured = await members[0].emitWithAck("lobby:configure", { actionId: crypto.randomUUID(), expectedVersion: version, playerLimit: 10, discussionSeconds: 180, selectedInnocentRoles: ["LOCKSMITH", "HOUSEKEEPER", "WITNESS"] });
    expect(configured.ok).toBe(true);
    if (!configured.ok) return;
    version = configured.data.version;
    expect((await members[0].emitWithAck("game:start", { actionId: crypto.randomUUID(), expectedVersion: version })).ok).toBe(true);
    const record = await store.findLobby(code);
    expect(record?.gameState).toBeDefined();
    if (!record?.gameState) return;
    const killer = record.gameState.players.find((player) => player.role === "KILLER")!;
    const victim = record.gameState.players.find((player) => player.role !== "KILLER")!;
    const controlled = { ...record, gameState: { ...record.gameState, phase: "SKILL_PHASE" as const, activePlayerId: killer.id, usedSkillPlayerIds: record.gameState.players.filter((player) => player.id !== killer.id).map((player) => player.id), lockedRooms: [], players: record.gameState.players.map((player) => ({ ...player, isAlive: true })), deathNotices: {} } };
    expect(() => performSkill(controlled.gameState, killer.id, victim.roomNumber, 1000, 180)).not.toThrow();
    expect(await store.replaceLobby(code, record.version, controlled)).toBe(true);
    const killerIndex = record.players.findIndex((player) => player.id === killer.id);
    const victimIndex = record.players.findIndex((player) => player.id === victim.id);
    const publicEvent = new Promise<unknown>((resolve) => members[1].on("game:event", (event) => { if (event.type === "MURDER_OCCURRED") resolve(event); }));
    const publicState = new Promise<ReturnType<typeof projectPublicState>>((resolve) => members[1].on("game:state", (state) => { if (state.publicHistory?.some((event: { type: string }) => event.type === "MURDER_OCCURRED")) resolve(state); }));
    const deathEvent = new Promise<unknown>((resolve) => members[victimIndex].on("game:private-event", (event) => { if (event.type === "DEATH_NOTICE" && event.cause === "ASSASSINATION") resolve(event); }));
    const action = await members[killerIndex].emitWithAck("game:skill", { actionId: crypto.randomUUID(), expectedVersion: record.version, target: victim.roomNumber });
    expect(action).toEqual({ ok: true, data: { version: record.version + 1 } });
    const event = await publicEvent;
    expect(event).toEqual({ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: 1 });
    expect(JSON.stringify(event)).not.toContain(String(victim.roomNumber));
    expect(JSON.stringify(event)).not.toContain(victim.id);
    const updatedPublic = await publicState;
    expect(updatedPublic.publicRooms.find((room) => room.roomNumber === victim.roomNumber)?.state).toBe("MURDERED");
    expect(updatedPublic.players[victimIndex]?.avatarId).toBe(victim.avatarId);
    expect(projectPublicState(controlled.gameState).phaseDeadlineAt).toBeUndefined();
    expect(JSON.stringify(updatedPublic.publicHistory?.filter((entry) => entry.type === "MURDER_OCCURRED"))).not.toContain(String(victim.roomNumber));
    expect(updatedPublic.players.every((player) => !Object.hasOwn(player, "roomNumber") && !Object.hasOwn(player, "role") && !Object.hasOwn(player, "team") && !Object.hasOwn(player, "isAlive"))).toBe(true);
    expect(await deathEvent).toMatchObject({ type: "DEATH_NOTICE", recipientPlayerId: victim.id });
    members[victimIndex].disconnect();
    const replacement = client();
    const restored = new Promise<unknown>((resolve) => replacement.once("game:private", resolve));
    const resumed = await replacement.emitWithAck("lobby:resume", { code, token: identities[victimIndex].data.token });
    expect(resumed.ok).toBe(true);
    expect(await restored).toMatchObject({ playerId: victim.id, isAlive: false, mode: "SPECTATOR", canUseSkill: false, canVote: false });
  }, 15000);

  it("synchronizes two clients without broadcasting reconnect tokens", async () => {
    const { client } = await setup();
    const host = client();
    const guest = client();
    const created = await host.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const update = new Promise<unknown>((resolve) => host.once("lobby:state", resolve));
    const joined = await guest.emitWithAck("lobby:join", {
      code: created.data.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: created.data.view.version,
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;
    const publicUpdate = await update;
    expect(JSON.stringify(publicUpdate)).not.toContain(created.data.token);
    expect(JSON.stringify(publicUpdate)).not.toContain(joined.data.token);
    expect(joined.data.view.players).toHaveLength(2);
    const ready = await guest.emitWithAck("lobby:ready", { actionId: crypto.randomUUID(), expectedVersion: joined.data.view.version, ready: true });
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    expect(ready.data.players[1]?.ready).toBe(true);
    const denied = await guest.emitWithAck("lobby:configure", { actionId: crypto.randomUUID(), expectedVersion: ready.data.version, playerLimit: 5, discussionSeconds: 120 });
    expect(denied).toEqual({ ok: false, error: "FORBIDDEN" });
  }, 15000);

  it("reuses a valid token to restore the same seat on repeated visits", async () => {
    const { client, store } = await setup();
    const original = client();
    const created = await original.emitWithAck("lobby:create", { displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    original.disconnect();
    const replacement = client();
    const resumed = await replacement.emitWithAck("lobby:resume", { code: created.data.code, token: created.data.token });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.playerId).toBe(created.data.playerId);
    expect(resumed.data.token).toBe(created.data.token);
    replacement.disconnect();
    const replay = await client().emitWithAck("lobby:resume", { code: created.data.code, token: created.data.token });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.data.playerId).toBe(created.data.playerId);
    expect((await store.findLobby(created.data.code))?.players).toHaveLength(1);
  }, 15000);
});
