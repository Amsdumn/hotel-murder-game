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
    expect(voting.phaseDeadlineAt).toBe(241000);
    expect(voting.publicHistory).toContainEqual({ type: "PHASE_CHANGED", phase: "VOTING", turn: 1 });
  });

  it("resolves a partial ballot at its deadline and gives players time to see the opened room", () => {
    const voting = game({ phase: "VOTING", phaseDeadlineAt: 1000, votes: { a: 101 }, assassinationTargetRoom: 401 });
    expect(advanceTimedPhase(voting, 999).state).toBe(voting);
    const opened = advanceTimedPhase(voting, 1000, () => 0);
    expect(opened.state.phase).toBe("RESOLUTION");
    expect(opened.state.openedRooms).toEqual([101]);
    expect(opened.state.phaseDeadlineAt).toBe(7000);
    expect(advanceTimedPhase(opened.state, 6999).state).toBe(opened.state);
    const next = advanceTimedPhase(opened.state, 7000);
    expect(next.state).toMatchObject({ phase: "SKILL_PHASE", turn: 2, phaseDeadlineAt: 67000 });
    expect(next.state.assassinationTargetRoom).toBeUndefined();
  });

  it("opens a server-chosen eligible room when nobody votes and advances an empty runoff", () => {
    const empty = advanceTimedPhase(game({ phase: "VOTING", phaseDeadlineAt: 1000 }), 1000, () => 0);
    expect(empty.state.openedRooms).toEqual([101]);
    const tie = advanceTimedPhase(game({ phase: "VOTING", phaseDeadlineAt: 1000, votes: { a: 101, b: 102 } }), 1000, () => 0);
    expect(tie.state).toMatchObject({ phase: "VOTING", runoffRooms: [101, 102], phaseDeadlineAt: 61000 });
    const runoff = advanceTimedPhase(tie.state, 61000, () => 1);
    expect(runoff.state).toMatchObject({ phase: "RESOLUTION", openedRooms: [102] });
  });

  it("skips murdered rooms when a ballot has no votes", () => {
    const state = game({ phase: "VOTING", phaseDeadlineAt: 1000, deathNotices: { a: { cause: "ASSASSINATION", turn: 1 } }, players: players.map((player) => player.id === "a" ? { ...player, isAlive: false } : player) });
    const result = advanceTimedPhase(state, 1000, () => 0);
    expect(result.state.openedRooms).toEqual([102]);
  });

  it("shows the fourth room result before announcing the murderer victory", () => {
    const voting = game({ phase: "VOTING", turn: 4, phaseDeadlineAt: 1000, votes: { a: 101 } });
    const opened = advanceTimedPhase(voting, 1000, () => 0);
    expect(opened.state.phase).toBe("RESOLUTION");
    expect(opened.state.winner).toBeNull();
    const finished = advanceTimedPhase(opened.state, 7000);
    expect(finished.state).toMatchObject({ phase: "FINISHED", winner: "MURDERER" });
  });

  it("records each vote publicly and resolves a runoff tie", () => {
    let state = game({ phase: "VOTING" });
    for (const [id, room] of [["a", 101], ["b", 102], ["c", 101], ["d", 102], ["e", 103]] as const) {
      const result = castRoomVote(state, id, room);
      state = result.state;
      expect(result.publicEvents[0]).toMatchObject({ type: "VOTE_CAST", playerName: state.players.find((player) => player.id === id)?.displayName, roomNumber: room });
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
