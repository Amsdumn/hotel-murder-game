import { describe, expect, it } from "vitest";
import type { GameEngineState } from "./state";
import { beginDiscussion, advanceTimedPhase, castRoomVote, finishSkillPhase, projectGameResult } from "./phases";

const players: GameEngineState["players"] = [
  { id: "a", displayName: "A", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
  { id: "b", displayName: "B", seatIndex: 1, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
  { id: "c", displayName: "C", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 103, isAlive: true },
  { id: "d", displayName: "D", seatIndex: 3, role: "ACCOMPLICE", team: "MURDERER", roomNumber: 201, isAlive: true },
  { id: "e", displayName: "E", seatIndex: 4, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
];

function game(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return { code: "ABC234", version: 1, phase: "SKILL_PHASE", turn: 1, players, crimeRooms: [301, 302, 303], openedRooms: [], lockedRooms: [], activePlayerId: null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, ...overrides };
}

describe("server-owned phases", () => {
  it("starts discussion only after the skill queue ends and transitions at its deadline", () => {
    expect(() => beginDiscussion(game({ activePlayerId: "a" }), 1000, 180)).toThrow();
    const discussion = finishSkillPhase(game({ usedSkillPlayerIds: players.map((player) => player.id) }), 1000, 180).state;
    expect(discussion).toMatchObject({ phase: "DISCUSSION", phaseDeadlineAt: 181000 });
    expect(discussion.publicHistory).toContainEqual({ type: "PHASE_CHANGED", phase: "DISCUSSION", turn: 1 });
    expect(advanceTimedPhase(discussion, 180999).state.phase).toBe("DISCUSSION");
    const voting = advanceTimedPhase(discussion, 181000).state;
    expect(voting.phase).toBe("VOTING");
    expect(voting.publicHistory).toContainEqual({ type: "PHASE_CHANGED", phase: "VOTING", turn: 1 });
  });

  it("keeps voting progress anonymous and resolves a runoff tie", () => {
    let state = game({ phase: "VOTING" });
    for (const [id, room] of [["a", 101], ["b", 102], ["c", 101], ["d", 102], ["e", 103]] as const) {
      const result = castRoomVote(state, id, room);
      state = result.state;
      expect(JSON.stringify(result.publicEvents)).not.toMatch(/playerId|actorId|roomNumber|voter|eligible|living/i);
    }
    expect(state.phase).toBe("VOTING");
    expect(state.runoffRooms).toEqual([101, 102]);
    expect(state.publicHistory).toContainEqual({ type: "RUNOFF_STARTED", turn: 1 });
    expect(state.votes).toEqual({});
    expect(() => castRoomVote(state, "a", 103)).toThrow();
    for (const [id, room] of [["a", 101], ["b", 102], ["c", 101], ["d", 102], ["e", 101]] as const) state = castRoomVote(state, id, room).state;
    expect(state.openedRooms).toEqual([101]);
    expect(state.players.find((player) => player.id === "a")?.isAlive).toBe(false);
  });

  it("forbids dead votes and exposes roles only in the finished result", () => {
    const state = game({ phase: "VOTING", players: players.map((player) => player.id === "a" ? { ...player, isAlive: false } : player) });
    expect(() => castRoomVote(state, "a", 101)).toThrow();
    expect(() => projectGameResult(state)).toThrow();
    expect(projectGameResult(game({ phase: "FINISHED", winner: "INNOCENT", turn: 2 }))).toMatchObject({ winner: "INNOCENT", turnsPlayed: 2, players: expect.arrayContaining([expect.objectContaining({ playerId: "e", role: "KILLER", roomNumber: 202, isAlive: true })]) });
  });

  it("uses the server's random choice after a runoff remains tied", () => {
    let state = game({ phase: "VOTING", runoffRooms: [101, 102], players: players.map((player) => player.id === "c" ? { ...player, isAlive: false } : player) });
    for (const [id, room] of [["a", 101], ["b", 102], ["d", 101]] as const) state = castRoomVote(state, id, room, () => 1).state;
    const result = castRoomVote(state, "e", 102, () => 1);
    expect(result.state.openedRooms).toEqual([102]);
    expect(result.publicEvents).toContainEqual(expect.objectContaining({ type: "ROOM_OPENED", roomNumber: 102 }));
  });
});
