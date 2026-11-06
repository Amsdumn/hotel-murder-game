import { describe, expect, it } from "vitest";
import type { GameEngineState } from "./state";
import { applyInitialCrime, resolveAssassination, advanceSkillTurn } from "./hidden-death";
import { canVoteForRoom, submitVote, resolveVoteRoom } from "./voting";
import { projectPublicState, projectPrivatePlayerState, projectMurdererTeamState } from "./projections";

function game(overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    code: "ABC234", version: 1, phase: "SKILL_PHASE", turn: 1,
    players: [
      { id: "innocent", displayName: "Innocent", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "victim", displayName: "Victim", seatIndex: 1, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 103, isAlive: true },
      { id: "extra", displayName: "Extra", seatIndex: 5, role: "DETECTIVE", team: "INNOCENT", roomNumber: 203, isAlive: true },
      { id: "accomplice", displayName: "Accomplice", seatIndex: 3, role: "ACCOMPLICE", team: "MURDERER", roomNumber: 201, isAlive: true },
      { id: "killer", displayName: "Killer", seatIndex: 4, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
    ],
    crimeRooms: [], openedRooms: [], lockedRooms: [], activePlayerId: "killer", usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {},
    ...overrides,
  };
}

describe("hidden deaths", () => {
  it("ends with a Murderer win when living teams become equal", () => {
    const result = resolveAssassination(game({ players: game().players.filter((player) => player.id !== "extra") }), 102);
    expect(result.state.phase).toBe("FINISHED");
    expect(result.state.winner).toBe("MURDERER");
    expect(result.publicEvents).toContainEqual({ type: "GAME_FINISHED", winner: "MURDERER" });
  });

  it("validates vote room geometry against the game's floor count", () => {
    expect(canVoteForRoom(901, [], [], [], 9)).toBe(true);
    expect(canVoteForRoom(601, [], [], [], 5)).toBe(false);
  });

  it("rerolls occupied rooms and marks only three empty crime scenes", () => {
    const selections = [[202, 101, 301], [102, 301, 401], [301, 401, 501]];
    const result = applyInitialCrime(game({ phase: "INITIAL_CRIME" }), () => selections.shift() ?? []);
    expect(result.state.players.every((player) => player.isAlive)).toBe(true);
    expect(result.publicEvents).toEqual([{ type: "CRIME_SCENES_REVEALED", roomNumbers: [301, 401, 501] }]);
    expect(JSON.stringify(result.publicEvents)).not.toMatch(/Victim|victim|HOUSEKEEPER|INNOCENT/);
    expect(projectPublicState(result.state).publicRooms.find((room) => room.roomNumber === 301)?.state).toBe("CRIME_SCENE");
    expect(result.privateEvents).toEqual([]);
    expect(result.state.deathNotices).toEqual({});
  });

  it("rejects initial crime generation outside its server phase", () => {
    expect(() => applyInitialCrime(game(), () => [102, 301, 401])).toThrow();
  });

  it("broadcasts only a generic notice after successful assassination", () => {
    const result = resolveAssassination(game(), 102);
    expect(result.state.players.find((player) => player.id === "victim")?.isAlive).toBe(false);
    expect(result.publicEvents).toEqual([{ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: 1 }]);
    expect(JSON.stringify(result.publicEvents)).not.toMatch(/102|Victim|victim|Killer|killer|HOUSEKEEPER/);
    expect(result.privateEvents).toContainEqual(expect.objectContaining({ recipientPlayerId: "victim", type: "DEATH_NOTICE" }));
    const publicState = projectPublicState(result.state);
    expect(publicState.publicRooms.find((room) => room.roomNumber === 102)?.state).toBe("MURDERED");
    expect(publicState.players.find((player) => player.id === "victim")).toEqual({ id: "victim", displayName: "Victim", seatIndex: 1, avatarId: null });
    expect(JSON.stringify(publicState.publicHistory)).not.toContain("victim");
  });

  it("announces immediate Innocent victory if the Killer kills themself", () => {
    const result = resolveAssassination(game(), 202);
    expect(result.state.phase).toBe("FINISHED");
    expect(result.state.winner).toBe("INNOCENT");
    expect(result.publicEvents).toContainEqual({ type: "GAME_FINISHED", winner: "INNOCENT" });
  });

  it("keeps playing while Innocents outnumber Murderers and ends when counts become equal", () => {
    const ahead = resolveAssassination(game(), 102);
    expect(ahead.state.phase).toBe("SKILL_PHASE");
    expect(ahead.state.winner).toBeNull();
    expect(ahead.publicEvents).not.toContainEqual(expect.objectContaining({ type: "GAME_FINISHED" }));

    const majority = resolveAssassination(game({
      players: game().players.map((player) => player.id === "innocent" ? { ...player, isAlive: false } : player),
      deathNotices: { innocent: { cause: "VOTE", turn: 1 } },
    }), 102);
    expect(majority.state.phase).toBe("FINISHED");
    expect(majority.state.winner).toBe("MURDERER");
    expect(majority.publicEvents).toEqual([
      { type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: 1 },
      { type: "GAME_FINISHED", winner: "MURDERER" },
    ]);
  });

  it("keeps failed assassination private for empty, locked, and dead rooms", () => {
    for (const state of [game(), game({ lockedRooms: [102] }), game({ players: game().players.map((player) => player.id === "victim" ? { ...player, isAlive: false } : player) })]) {
      const room = state.lockedRooms.length ? 102 : state.players[1]?.isAlive ? 301 : 102;
      const result = resolveAssassination(state, room);
      expect(result.publicEvents).toEqual([]);
      expect(result.privateEvents).toEqual([expect.objectContaining({ recipientPlayerId: "killer", type: "ASSASSINATION_RESULT", success: false })]);
    }
  });

  it("rejects a second action on a clue or murdered room in the assassination engine", () => {
    expect(() => resolveAssassination(game({ crimeRooms: [301] }), 301)).toThrow("Room is not eligible");
    const murdered = resolveAssassination(game(), 102).state;
    expect(() => resolveAssassination({ ...murdered, usedSkillPlayerIds: [], activePlayerId: "killer" }, 102)).toThrow("Room is not eligible");
  });

  it("keeps dead players in public roster without status or private data", () => {
    const result = resolveAssassination(game(), 102);
    const publicState = projectPublicState(result.state);
    expect(publicState.players).toHaveLength(6);
    expect(publicState.players.map((player) => player.id)).toContain("victim");
    expect(publicState.players.every((player) => Object.keys(player).sort().join(",") === "avatarId,displayName,id,seatIndex")).toBe(true);
    expect(JSON.stringify(publicState.players)).not.toMatch(/isAlive|isDead|deathReason|deathTurn|roomNumber|HOUSEKEEPER/);
    expect(publicState.publicRooms.find((room) => room.roomNumber === 102)?.state).toBe("MURDERED");
    expect(publicState.phaseMessage).toBe("กำลังดำเนินการสืบสวน...");
  });

  it("makes a dead player a spectator without skill or vote access", () => {
    const killed = resolveAssassination(game(), 102).state;
    const privateState = projectPrivatePlayerState(killed, "victim");
    expect(privateState).toMatchObject({ isAlive: false, mode: "SPECTATOR", canUseSkill: false, canVote: false });
    expect(privateState.deathNotice?.cause).toBe("ASSASSINATION");
    expect(() => projectPrivatePlayerState(killed, "victim", "killer")).toThrow();
    expect(() => projectMurdererTeamState(killed, "victim")).toThrow();
    expect(() => resolveAssassination({ ...killed, activePlayerId: "victim" }, 301)).toThrow();
    expect(() => submitVote({ ...killed, phase: "VOTING" }, "victim", 301)).toThrow();
  });

  it("skips dead skill actors without a public identity event", () => {
    const state = game({ activePlayerId: null, players: game().players.filter((player) => player.id !== "extra").map((player) => player.id === "victim" ? { ...player, isAlive: false } : player) });
    const result = advanceSkillTurn(state, "innocent");
    expect(result.state.activePlayerId).toBe("accomplice");
    expect(result.publicEvents).toEqual([]);
    expect(result.privateEvents).toEqual([{ type: "ACTION_REQUEST", recipientPlayerId: "accomplice" }]);
  });

  it("privately reveals every guest-room assignment to the living receptionist only on turn three", () => {
    const receptionist = { id: "receptionist", displayName: "Receptionist", seatIndex: 5, role: "RECEPTIONIST" as const, team: "INNOCENT" as const, roomNumber: 303, isAlive: true };
    const base = game({ players: [...game().players.filter((player) => player.id !== "extra"), receptionist], activePlayerId: null, usedSkillPlayerIds: ["innocent", "victim"] });
    const third = advanceSkillTurn({ ...base, turn: 3 }, "victim");
    expect(third.state.activePlayerId).toBe("accomplice");
    expect(third.state.usedSkillPlayerIds).toContain("receptionist");
    expect(projectPrivatePlayerState({ ...base, turn: 3, activePlayerId: "receptionist" }, "receptionist").canUseSkill).toBe(false);
    expect(third.privateEvents).toContainEqual(expect.objectContaining({ type: "SKILL_RESULT", recipientPlayerId: "receptionist", message: expect.stringContaining("Killer · ห้อง 202") }));
    expect(projectPrivatePlayerState(third.state, "receptionist").privateResults.join(" ")).toContain("Victim · ห้อง 102");
    expect(projectPrivatePlayerState(third.state, "innocent").privateResults.join(" ")).not.toContain("Victim · ห้อง 102");
    expect(projectPrivatePlayerState(third.state, "accomplice").privateResults.join(" ")).not.toContain("Victim · ห้อง 102");
    expect(JSON.stringify(projectPublicState(third.state))).not.toContain("Receptionist · ห้อง 303");
    expect(third.publicEvents).toEqual([]);
    for (const turn of [1, 2, 4]) {
      const skipped = advanceSkillTurn({ ...base, turn }, "victim");
      expect(skipped.state.activePlayerId).toBe("accomplice");
      expect(projectPrivatePlayerState(skipped.state, "receptionist").privateResults).toEqual([]);
    }
  });

  it("withholds the receptionist's register if they died or their floor lost power", () => {
    const receptionist = { id: "receptionist", displayName: "Receptionist", seatIndex: 5, role: "RECEPTIONIST" as const, team: "INNOCENT" as const, roomNumber: 303, isAlive: true };
    const players = [...game().players, receptionist];
    for (const state of [game({ turn: 3, players: players.map((player) => player.id === "receptionist" ? { ...player, isAlive: false } : player) }), game({ turn: 3, players, darkFloors: [3] })]) {
      const result = advanceSkillTurn({ ...state, activePlayerId: null }, "victim");
      expect(result.privateEvents.some((event) => event.type === "SKILL_RESULT" && event.recipientPlayerId === "receptionist")).toBe(false);
      expect(projectPrivatePlayerState(result.state, "receptionist").privateResults).toEqual([]);
    }
  });

  it("reveals the killer's identity only to the living photographer on turn three", () => {
    const photographer = { id: "photographer", displayName: "Photographer", seatIndex: 5, role: "PHOTOGRAPHER" as const, team: "INNOCENT" as const, roomNumber: 303, isAlive: true };
    const base = game({ players: [...game().players.filter((player) => player.id !== "extra"), photographer], activePlayerId: null, usedSkillPlayerIds: ["innocent", "victim"] });
    const third = advanceSkillTurn({ ...base, turn: 3 }, "victim");
    expect(third.state.activePlayerId).toBe("accomplice");
    expect(third.state.usedSkillPlayerIds).toContain("photographer");
    expect(projectPrivatePlayerState({ ...base, turn: 3, activePlayerId: "photographer" }, "photographer").canUseSkill).toBe(false);
    expect(third.privateEvents).toContainEqual({ type: "SKILL_RESULT", recipientPlayerId: "photographer", message: "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 Killer" });
    expect(projectPrivatePlayerState(third.state, "photographer").privateResults).toContain("ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 Killer");
    expect(projectPrivatePlayerState(third.state, "photographer").actionHistory).toContainEqual({ turn: 3, type: "SKILL", message: "ตรวจภาพถ่ายแล้ว" });
    expect(projectPrivatePlayerState(third.state, "innocent").privateResults).toEqual([]);
    expect(projectPrivatePlayerState(third.state, "accomplice").privateResults).toEqual([]);
    expect(third.publicEvents).toEqual([]);
    expect(JSON.stringify(projectPublicState(third.state))).not.toContain("ภาพถ่ายเทิร์นที่ 3");
    for (const turn of [1, 2, 4]) {
      const skipped = advanceSkillTurn({ ...base, turn }, "victim");
      expect(projectPrivatePlayerState(skipped.state, "photographer").privateResults).toEqual([]);
    }
  });

  it("withholds the photo result if the photographer died or their floor lost power", () => {
    const photographer = { id: "photographer", displayName: "Photographer", seatIndex: 5, role: "PHOTOGRAPHER" as const, team: "INNOCENT" as const, roomNumber: 303, isAlive: true };
    const players = [...game().players, photographer];
    for (const state of [game({ turn: 3, players: players.map((player) => player.id === "photographer" ? { ...player, isAlive: false } : player) }), game({ turn: 3, players, darkFloors: [3] })]) {
      const result = advanceSkillTurn({ ...state, activePlayerId: null }, "victim");
      expect(result.privateEvents.some((event) => event.type === "SKILL_RESULT" && event.recipientPlayerId === "photographer")).toBe(false);
      expect(projectPrivatePlayerState(result.state, "photographer").privateResults).toEqual([]);
    }
  });

  it("gives the Witness a turn only after the Killer's room choice", () => {
    const afterKiller = advanceSkillTurn(game({ activePlayerId: null, usedSkillPlayerIds: ["innocent", "victim", "accomplice", "killer"] }), "killer");
    expect(afterKiller.state.activePlayerId).toBe("witness");
    expect(afterKiller.privateEvents).toEqual([{ type: "ACTION_REQUEST", recipientPlayerId: "witness" }]);
    const killedWitness = resolveAssassination(game(), 103).state;
    expect(advanceSkillTurn(killedWitness, "killer").state.activePlayerId).toBeNull();
  });
});

describe("voting eligibility and results", () => {
  it("rejects a player's own room while allowing another eligible room", () => {
    const state = game({ phase: "VOTING" });
    expect(canVoteForRoom(101, [], [])).toBe(true);
    expect(() => submitVote(state, "innocent", 101)).toThrow("Cannot vote for your own room");
    expect(submitVote(state, "innocent", 102).state.votes).toEqual({ innocent: 102 });
  });

  it("rejects crime scenes, opened rooms, and invalid numbers", () => {
    expect(canVoteForRoom(102, [102], [])).toBe(false);
    expect(canVoteForRoom(103, [], [103])).toBe(false);
    expect(canVoteForRoom(104, [], [])).toBe(false);
    expect(canVoteForRoom(102.5, [], [])).toBe(false);
    expect(() => submitVote(game({ phase: "VOTING", crimeRooms: [102] }), "innocent", 102)).toThrow();
    expect(() => submitVote(game({ phase: "VOTING", openedRooms: [103] }), "innocent", 103)).toThrow();
  });

  it("reveals room and occupancy but not occupant identity during voting", () => {
    const result = resolveVoteRoom(game({ phase: "VOTING" }), 102);
    expect(result.publicEvents).toEqual([{ type: "ROOM_OPENED", roomNumber: 102, occupancy: "OCCUPIED", gameEnded: false }]);
    expect(JSON.stringify(result.publicEvents)).not.toMatch(/Victim|victim|HOUSEKEEPER|INNOCENT/);
    expect(result.state.players.find((player) => player.id === "victim")?.isAlive).toBe(false);
  });

  it("makes a murdered room ineligible for voting and opening", () => {
    const murdered = resolveAssassination(game(), 102).state;
    expect(canVoteForRoom(102, murdered.crimeRooms, murdered.openedRooms, [102])).toBe(false);
    expect(() => submitVote({ ...murdered, phase: "VOTING" }, "innocent", 102)).toThrow("Room is not eligible");
    expect(() => resolveVoteRoom({ ...murdered, phase: "VOTING" }, 102)).toThrow("Room is not eligible");
    expect(projectPublicState(murdered).publicRooms.find((room) => room.roomNumber === 102)?.state).toBe("MURDERED");
  });

  it("ends the game immediately when voting kills the Killer", () => {
    const result = resolveVoteRoom(game({ phase: "VOTING" }), 202);
    expect(result.state.phase).toBe("FINISHED");
    expect(result.state.winner).toBe("INNOCENT");
    expect(result.publicEvents).toContainEqual({ type: "GAME_FINISHED", winner: "INNOCENT" });
    expect(result.state.players.find((player) => player.id === "accomplice")?.isAlive).toBe(true);
  });
});
