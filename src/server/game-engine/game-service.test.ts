import { describe, expect, it } from "vitest";
import { MemoryLobbyStore } from "../lobby/test-memory-store";
import type { LobbyRecord } from "../lobby/lobby-store";
import { GameService } from "./game-service";
import { LobbyService } from "../lobby/lobby-service";
import { AVATAR_ORDER } from "../../lib/avatars";
import type { GameEngineState } from "./state";
import { projectPrivatePlayerState, projectPublicState } from "./projections";

const players: GameEngineState["players"] = [
  { id: "a", displayName: "A", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
  { id: "b", displayName: "B", seatIndex: 1, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
  { id: "c", displayName: "C", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 103, isAlive: true },
  { id: "d", displayName: "D", seatIndex: 3, role: "ACCOMPLICE", team: "MURDERER", roomNumber: 201, isAlive: true },
  { id: "e", displayName: "E", seatIndex: 4, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
];

function record(phase: "ROLE_REVEAL" | "DISCUSSION" | "SKILL_PHASE" | "VOTING"): LobbyRecord {
  const gameState: GameEngineState = { code: "ABC234", version: 5, phase, turn: 1, players, crimeRooms: [301, 302, 303], openedRooms: [], lockedRooms: [], activePlayerId: phase === "SKILL_PHASE" ? "a" : null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, phaseDeadlineAt: phase === "VOTING" ? Date.now() + 60_000 : 1000, phaseStartVersion: 5 };
  return { code: "ABC234", phase, version: 5, creationActionId: "create", hostPlayerId: "a", playerLimit: 5, discussionSeconds: 180, players: players.map(({ id, displayName, seatIndex }) => ({ id, displayName, seatIndex, ready: true, connected: true })), appliedActionIds: [], gameState };
}

describe("persisted server deadlines", () => {
  it("assigns characters only when the game starts and restores them on reconnect", async () => {
    const store = new MemoryLobbyStore();
    const lobbies = new LobbyService(store);
    const games = new GameService(store);
    const host = await lobbies.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const ids = [host.playerId];
    for (let index = 1; index < 5; index += 1) {
      const view = await lobbies.preview(host.code);
      const guest = await lobbies.join({ code: host.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
      ids.push(guest.playerId);
    }
    expect(JSON.stringify(await lobbies.preview(host.code))).not.toContain("avatarId");
    for (const id of ids) {
      const view = await lobbies.preview(host.code);
      await lobbies.setReady(id, { actionId: crypto.randomUUID(), expectedVersion: view.version, ready: true });
    }
    const ready = await lobbies.preview(host.code);
    expect(ready.canStart).toBe(true);
    const started = await games.start(host.code, host.playerId, { actionId: crypto.randomUUID(), expectedVersion: ready.version });
    const avatars = started.state.players.map((player) => player.avatarId);
    expect(new Set(avatars).size).toBe(5);
    expect(avatars.every((avatar) => AVATAR_ORDER.includes(avatar!))).toBe(true);
    expect((await games.snapshot(host.code, ids[1]))?.publicState.players.map((player) => player.avatarId)).toEqual(avatars);
    expect(JSON.stringify(await lobbies.preview(host.code))).not.toContain("avatarId");
  });
  it("reveals crime rooms after a saved prologue expires", async () => {
    const store = new MemoryLobbyStore();
    const intro = record("ROLE_REVEAL");
    intro.gameState!.crimeRooms = [];
    await store.createLobby(intro);
    const service = new GameService(store);
    expect((await service.snapshot("ABC234", "a"))?.publicState.publicRooms.every((room) => room.state === "UNKNOWN")).toBe(true);
    expect(await service.advanceDue(999)).toEqual([]);
    const result = await service.advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state.phase).toBe("SKILL_PHASE");
    expect(result[0].state.crimeRooms).toHaveLength(3);
    expect(result[0].state.phaseDeadlineAt).toBe(61000);
    expect((await service.snapshot("ABC234", "a"))?.publicState.publicRooms.filter((room) => room.state === "CRIME_SCENE")).toHaveLength(3);
  });
  it("restores and continues a saved game missing legacy death notices and votes", async () => {
    const store = new MemoryLobbyStore();
    const legacy = record("VOTING");
    delete (legacy.gameState as Partial<GameEngineState>).deathNotices;
    delete (legacy.gameState as Partial<GameEngineState>).votes;
    await store.createLobby(legacy);

    const service = new GameService(store);
    const snapshot = await service.snapshot("ABC234", "a");
    expect(snapshot?.publicState.publicRooms.find((room) => room.roomNumber === 101)?.state).toBe("UNKNOWN");
    expect(snapshot?.privateState).toMatchObject({ version: 5, playerId: "a", isAlive: true, canVote: true });
    expect(snapshot?.privateState.deathNotice).toBeUndefined();
    const vote = await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 101 });
    expect(vote.state.votes.a).toBe(101);
  });

  it("reports a missed first Locksmith turn as expired rather than forbidden", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const service = new GameService(store);
    await service.advanceDue(1000);

    await expect(service.skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 1001)).rejects.toMatchObject({ code: "SKILL_EXPIRED" });
    expect((await store.findLobby("ABC234"))?.gameState?.lockedRooms).toEqual([]);
  });

  it("expires a skill at its deadline even before the timer sweep", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    await expect(new GameService(store).skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 1000)).rejects.toMatchObject({ code: "SKILL_EXPIRED" });
  });

  it("restores an expired discussion phase after a new service instance starts", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("DISCUSSION"));
    const service = new GameService(store);
    expect(await service.advanceDue(999)).toEqual([]);
    const result = await service.advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state).toMatchObject({ phase: "VOTING", version: 6 });
    expect(result[0].state.phaseDeadlineAt).toBe(61000);
    expect((await store.findLobby("ABC234"))?.gameState?.phase).toBe("VOTING");
    await expect(service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 101 })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect((await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 6, roomNumber: 101 }, 1001)).state.votes.a).toBe(101);
  });

  it("skips an expired skill without a public actor event", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const result = await new GameService(store).advanceDue(1000);
    expect(result[0].publicEvents).toEqual([]);
    expect(result[0].state.activePlayerId).toBe("b");
    expect(result[0].state.phaseDeadlineAt).toBe(61000);
  });

  it("persists the turn-three register for the receptionist after a timer advance", async () => {
    const store = new MemoryLobbyStore();
    const thirdTurn = record("SKILL_PHASE");
    thirdTurn.gameState!.turn = 3;
    thirdTurn.gameState!.players = thirdTurn.gameState!.players.map((player) => player.id === "a" ? { ...player, role: "DETECTIVE" } : player.id === "b" ? { ...player, role: "RECEPTIONIST" } : player);
    await store.createLobby(thirdTurn);
    const service = new GameService(store);
    const advanced = await service.advanceDue(1000);
    expect(advanced[0].privateEvents).toContainEqual(expect.objectContaining({ type: "SKILL_RESULT", recipientPlayerId: "b" }));
    const resumed = new GameService(store);
    expect((await resumed.snapshot("ABC234", "b"))?.privateState.privateResults.join(" ")).toContain("A · ห้อง 101");
    expect((await resumed.snapshot("ABC234", "a"))?.privateState.privateResults).toEqual([]);
    expect(JSON.stringify((await resumed.snapshot("ABC234", "a"))?.publicState)).not.toContain("A · ห้อง 101");
  });

  it("persists the photographer's private killer reveal after a timer advance", async () => {
    const store = new MemoryLobbyStore();
    const thirdTurn = record("SKILL_PHASE");
    thirdTurn.gameState!.turn = 3;
    thirdTurn.gameState!.players = thirdTurn.gameState!.players.map((player) => player.id === "a" ? { ...player, role: "DETECTIVE" } : player.id === "b" ? { ...player, role: "PHOTOGRAPHER" } : player);
    await store.createLobby(thirdTurn);
    const service = new GameService(store);
    const advanced = await service.advanceDue(1000);
    expect(advanced[0].privateEvents).toContainEqual({ type: "SKILL_RESULT", recipientPlayerId: "b", message: "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 E" });
    const resumed = new GameService(store);
    expect((await resumed.snapshot("ABC234", "b"))?.privateState.privateResults).toContain("ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 E");
    expect((await resumed.snapshot("ABC234", "a"))?.privateState.privateResults).toEqual([]);
    expect(JSON.stringify((await resumed.snapshot("ABC234", "a"))?.publicState)).not.toContain("ภาพถ่ายเทิร์นที่ 3");
  });

  it("advances a saved voting deadline after a disconnected voter does not respond", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    voting.gameState!.phaseDeadlineAt = 1000;
    voting.gameState!.votes = { a: 101 };
    await store.createLobby(voting);
    const result = await new GameService(store).advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state).toMatchObject({ phase: "RESOLUTION", openedRooms: [101], phaseDeadlineAt: 7000 });
  });

  it("rejects a vote submitted at the deadline before the timer sweep", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    voting.gameState!.phaseDeadlineAt = 1000;
    await store.createLobby(voting);
    await expect(new GameService(store).vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 101 }, 1000)).rejects.toMatchObject({ code: "VOTE_EXPIRED" });
    expect((await store.findLobby("ABC234"))?.gameState?.votes).toEqual({});
  });

  it("adds a voting deadline to a saved game created before voting timers existed", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    delete voting.gameState!.phaseDeadlineAt;
    await store.createLobby(voting);
    const result = await new GameService(store).advanceDue(1000);
    expect(result[0].state).toMatchObject({ phase: "VOTING", phaseDeadlineAt: 61000 });
    expect(result[0].state.openedRooms).toEqual([]);
  });

});

describe("voting from independent players", () => {
  it("accepts votes in any order, retries concurrent writes, and keeps each first vote", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("VOTING"));
    const service = new GameService(store);
    const originalVersion = 5;
    const first = await service.vote("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 101 });
    expect(first.state.votes.e).toBe(101);
    await expect(service.vote("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 102 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    const others = await Promise.all(["d", "b", "a", "c"].map((playerId) => service.vote("ABC234", playerId, {
      actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 101,
    })));
    expect(others).toHaveLength(4);
    const final = (await store.findLobby("ABC234"))!.gameState!;
    expect(final.openedRooms).toEqual([101]);
    expect(final.phase).toBe("RESOLUTION");
    expect(final.players.find((player) => player.id === "a")?.isAlive).toBe(false);
  });
});

describe("viewer-specific action history", () => {
  it("stores accepted skills for the actor without publishing the target", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const result = await new GameService(store).skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 999);
    expect(projectPrivatePlayerState(result.state, "a").actionHistory).toEqual([
      { turn: 1, type: "SKILL", message: "ใช้สกิล: ล็อกห้อง 103 แล้ว" },
    ]);
    expect(projectPrivatePlayerState(result.state, "b").actionHistory).toEqual([]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("ล็อกห้อง 103");
    const restored = await new GameService(store).snapshot("ABC234", "a");
    expect(restored?.privateState.actionHistory).toEqual(projectPrivatePlayerState(result.state, "a").actionHistory);
  });

  it("stores each accepted vote only in that voter's history", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("VOTING"));
    const result = await new GameService(store).vote("ABC234", "b", {
      actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 102,
    });
    expect(projectPrivatePlayerState(result.state, "b").actionHistory).toEqual([
      { turn: 1, type: "VOTE", message: "โหวตห้อง 102" },
    ]);
    expect(projectPrivatePlayerState(result.state, "a").actionHistory).toEqual([]);
    expect(projectPublicState(result.state).votes).toEqual([{ playerId: "b", roomNumber: 102 }]);
  });
});
