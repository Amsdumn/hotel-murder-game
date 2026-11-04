import { describe, expect, it } from "vitest";
import { MemoryLobbyStore } from "../lobby/test-memory-store";
import type { LobbyRecord } from "../lobby/lobby-store";
import { GameService } from "./game-service";
import type { GameEngineState } from "./state";

const players: GameEngineState["players"] = [
  { id: "a", displayName: "A", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
  { id: "b", displayName: "B", seatIndex: 1, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
  { id: "c", displayName: "C", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 103, isAlive: true },
  { id: "d", displayName: "D", seatIndex: 3, role: "ACCOMPLICE", team: "MURDERER", roomNumber: 201, isAlive: true },
  { id: "e", displayName: "E", seatIndex: 4, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
];

function record(phase: "DISCUSSION" | "SKILL_PHASE" | "VOTING"): LobbyRecord {
  const gameState: GameEngineState = { code: "ABC234", version: 5, phase, turn: 1, players, crimeRooms: [301, 302, 303], openedRooms: [], lockedRooms: [], activePlayerId: phase === "SKILL_PHASE" ? "a" : null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, phaseDeadlineAt: 1000, phaseStartVersion: 5 };
  return { code: "ABC234", phase, version: 5, creationActionId: "create", hostPlayerId: "a", playerLimit: 5, discussionSeconds: 180, players: players.map(({ id, displayName, seatIndex }) => ({ id, displayName, seatIndex, ready: true, connected: true })), appliedActionIds: [], gameState };
}

describe("persisted server deadlines", () => {
  it("restores an expired discussion phase after a new service instance starts", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("DISCUSSION"));
    const service = new GameService(store);
    expect(await service.advanceDue(999)).toEqual([]);
    const result = await service.advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state).toMatchObject({ phase: "VOTING", version: 6 });
    expect((await store.findLobby("ABC234"))?.gameState?.phase).toBe("VOTING");
    await expect(service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 101 })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect((await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 6, roomNumber: 101 })).state.votes.a).toBe(101);
  });

  it("skips an expired skill without a public actor event", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const result = await new GameService(store).advanceDue(1000);
    expect(result[0].publicEvents).toEqual([]);
    expect(result[0].state.activePlayerId).toBe("b");
    expect(result[0].state.phaseDeadlineAt).toBe(61000);
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
    expect(final.phase).toBe("SKILL_PHASE");
    expect(final.players.find((player) => player.id === "a")?.isAlive).toBe(false);
  });
});
