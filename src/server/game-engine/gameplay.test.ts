import { describe, expect, it } from "vitest";
import { advancePrologue, advanceTimedSkill, createInitialGame, performSkill } from "./gameplay";
import { HOTEL_ROOMS, type GameEngineState } from "./state";
import { projectPrivatePlayerState, projectPublicState } from "./projections";
import { advanceSkillTurn } from "./hidden-death";
import { AVATAR_ORDER } from "../../lib/avatars";

const lobbyPlayers = Array.from({ length: 5 }, (_, seatIndex) => ({ id: `p${seatIndex}`, displayName: `Player ${seatIndex}`, seatIndex }));
function choose() {
  let seed = 7;
  return (max: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
}

describe("gameplay setup and skills", () => {
  it("lets a living witness act before a successful assassination resolves", () => {
    const base = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "victim", displayName: "Victim", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "killer", displayName: "Killer", seatIndex: 1, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 301, isAlive: true },
    ];
    const state: GameEngineState = { ...base, phase: "SKILL_PHASE", players, crimeRooms: [103], activePlayerId: "killer", usedSkillPlayerIds: ["victim"] };
    const chosen = performSkill(state, "killer", 301, 1000, 180);
    expect(chosen.state.activePlayerId).toBe("witness");
    expect(chosen.state.players.find((player) => player.id === "witness")?.isAlive).toBe(true);
    expect(chosen.publicEvents).toEqual([]);
    const witnessed = performSkill(chosen.state, "witness", 1, 2000, 180);
    expect(projectPrivatePlayerState(witnessed.state, "witness").privateResults).toContain("ทิศทางชั้นนักฆ่า: ABOVE");
    expect(witnessed.state.players.find((player) => player.id === "witness")?.isAlive).toBe(false);
    expect(witnessed.publicEvents).toContainEqual({ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: 1 });
  });

  it("resolves a queued assassination when the witness times out", () => {
    const base = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "victim", displayName: "Victim", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "killer", displayName: "Killer", seatIndex: 1, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 301, isAlive: true },
    ];
    const state: GameEngineState = { ...base, phase: "SKILL_PHASE", players, crimeRooms: [103], activePlayerId: "killer", usedSkillPlayerIds: ["victim"] };
    const chosen = performSkill(state, "killer", 101, 1000, 180);
    const timedOut = advanceTimedSkill({ ...chosen.state, phaseDeadlineAt: 2000 }, 2000, 180);
    expect(timedOut.state.players.find((player) => player.id === "victim")?.isAlive).toBe(false);
    expect(timedOut.publicEvents).toContainEqual({ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: 1 });
  });
  it("keeps assigned avatars public without changing secret role assignment", () => {
    const withAvatars = lobbyPlayers.map((player) => ({ ...player, avatarId: "irina-volkova" as const }));
    const first = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const second = createInitialGame("ABC234", withAvatars, 1, choose()).state;
    expect(second.players.map((player) => player.role)).toEqual(first.players.map((player) => player.role));
    expect(second.players.map((player) => player.avatarId)).toEqual(first.players.map((player) => player.avatarId));
    expect(new Set(second.players.map((player) => player.avatarId)).size).toBe(5);
    const publicState = projectPublicState(second);
    expect(AVATAR_ORDER).toContain(publicState.players[0]?.avatarId);
    expect(JSON.stringify(publicState.players)).not.toMatch(/"role"|"team"|"roomNumber"/);
  });
  it("assigns ten distinct characters when a ten-player game starts", () => {
    const seats = Array.from({ length: 10 }, (_, seatIndex) => ({ id: `p${seatIndex}`, displayName: `Player ${seatIndex}`, seatIndex }));
    const avatars = createInitialGame("ABC234", seats, 1, choose()).state.players.map((player) => player.avatarId);
    expect(new Set(avatars).size).toBe(10);
    expect(AVATAR_ORDER).toHaveLength(12);
    expect(avatars.every((avatar) => AVATAR_ORDER.includes(avatar!))).toBe(true);
    for (const selection of [10, 11]) {
      const draw = createInitialGame("DEF567", seats, 1, (maximum) => maximum === selection + 1 ? 0 : maximum - 1).state.players.map((player) => player.avatarId!);
      expect(new Set(draw).size).toBe(10);
      expect(draw).toContain(AVATAR_ORDER[selection]);
    }
  });
  it("lets an innocent electrician darken one floor and skips its occupants' skill slots privately", () => {
    const players: GameEngineState["players"] = [
      { id: "electrician", displayName: "E", seatIndex: 0, role: "ELECTRICIAN", team: "INNOCENT", roomNumber: 201, isAlive: true },
      { id: "locksmith", displayName: "L", seatIndex: 1, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "housekeeper", displayName: "H", seatIndex: 2, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
      { id: "killer", displayName: "K", seatIndex: 3, role: "KILLER", team: "MURDERER", roomNumber: 103, isAlive: true },
    ];
    const state: GameEngineState = { code: "ABC234", version: 1, phase: "SKILL_PHASE", turn: 1, players, crimeRooms: [], openedRooms: [], lockedRooms: [], darkFloors: [], electricianLastUsedTurn: {}, activePlayerId: "electrician", usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {} };
    expect(() => performSkill(state, "electrician", 8, 1000, 180)).toThrow("Invalid skill target");
    const result = performSkill(state, "electrician", 1, 1000, 180);
    expect(result.state.darkFloors).toEqual([1]);
    expect(result.state.usedSkillPlayerIds).toEqual(expect.arrayContaining(["electrician", "locksmith", "housekeeper", "killer"]));
    expect(result.state.phase).toBe("DISCUSSION");
    expect(result.publicEvents).toEqual([{ type: "PHASE_CHANGED", phase: "DISCUSSION", turn: 1 }]);
    expect(projectPrivatePlayerState(result.state, "locksmith").canUseSkill).toBe(false);
    expect(projectPrivatePlayerState(result.state, "locksmith").skillBlockReason).toBe("BLACKOUT");
    expect(projectPrivatePlayerState(result.state, "killer").actionHistory).toContainEqual({ turn: 1, type: "SKILL", message: "ใช้สกิลไม่ได้เนื่องจากไฟดับบนชั้นของคุณ" });
    const blockedSlot = { ...result.state, phase: "SKILL_PHASE" as const, activePlayerId: "killer", usedSkillPlayerIds: ["electrician"] };
    expect(projectPrivatePlayerState(blockedSlot, "killer").canUseSkill).toBe(false);
    expect(projectPrivatePlayerState(blockedSlot, "killer").skillBlockReason).toBe("BLACKOUT");
    expect(() => performSkill(blockedSlot, "killer", 201, 1000, 180)).toThrow("Skill is not permitted");
  });

  it("allows the electrician to act again after one full cooldown turn", () => {
    const original = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const electrician = { ...original.players[0], role: "ELECTRICIAN" as const, team: "INNOCENT" as const };
    const players = [electrician, ...original.players.slice(1).filter((player) => player.role !== "ELECTRICIAN")];
    const base = { ...original, phase: "SKILL_PHASE" as const, players, darkFloors: [], electricianLastUsedTurn: { [electrician.id]: 1 }, activePlayerId: null, usedSkillPlayerIds: [] };
    const second = advanceSkillTurn({ ...base, turn: 2 }, null).state;
    expect(second.activePlayerId).not.toBe(electrician.id);
    expect(second.usedSkillPlayerIds).toContain(electrician.id);
    const third = advanceSkillTurn({ ...base, turn: 3 }, null).state;
    expect(third.activePlayerId).toBe(electrician.id);
  });
  it("shows the prologue before selecting three empty crime rooms or starting the first actor", () => {
    const result = createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000);
    expect(new Set(result.state.players.map((player) => player.roomNumber)).size).toBe(5);
    expect(result.state.players.filter((player) => player.role === "KILLER")).toHaveLength(1);
    expect(result.state.phase).toBe("ROLE_REVEAL");
    expect(result.state.crimeRooms).toEqual([]);
    expect(result.state.activePlayerId).toBeNull();
    expect(result.publicEvents).toEqual([]);
    expect(result.state.phaseDeadlineAt).toBe(31000);
    expect(advancePrologue(result.state, 30999).state).toBe(result.state);
    const revealed = advancePrologue(result.state, 31000, choose());
    expect(revealed.state.phase).toBe("SKILL_PHASE");
    expect(revealed.state.crimeRooms).toHaveLength(3);
    expect(revealed.state.crimeRooms.every((room) => revealed.state.players.every((player) => player.roomNumber !== room))).toBe(true);
    expect(result.state.players.every((player) => player.isAlive)).toBe(true);
    expect(JSON.stringify(revealed.publicEvents)).not.toMatch(/Player|"p[0-4]"|LOCKSMITH|KILLER/);
    expect(revealed.privateEvents.find((event) => event.type === "ACTION_REQUEST")?.recipientPlayerId).toBe(revealed.state.activePlayerId);
    expect(revealed.state.phaseDeadlineAt).toBe(91000);
    expect(projectPrivatePlayerState(revealed.state, revealed.state.activePlayerId!).skillDeadlineAt).toBe(revealed.state.phaseDeadlineAt);
    expect(projectPrivatePlayerState(revealed.state, revealed.state.players.find((player) => player.id !== revealed.state.activePlayerId)!.id).skillDeadlineAt).toBeUndefined();
  });

  it("finds three unoccupied rooms even with ten players", () => {
    const seats = Array.from({ length: 10 }, (_, seatIndex) => ({ id: `seat-${seatIndex}`, displayName: `Guest ${seatIndex}`, seatIndex }));
    const result = advancePrologue(createInitialGame("ABC234", seats, 3, choose(), 1000).state, 31000, choose());
    expect(result.state.crimeRooms).toHaveLength(3);
    expect(result.state.crimeRooms.every((room) => result.state.players.every((player) => player.roomNumber !== room))).toBe(true);
    expect(result.state.players.every((player) => player.isAlive)).toBe(true);
  });

  it("keeps the blackout role unique when assigning ten players", () => {
    const seats = Array.from({ length: 10 }, (_, seatIndex) => ({ id: `seat-${seatIndex}`, displayName: `Guest ${seatIndex}`, seatIndex }));
    const game = createInitialGame("ABC234", seats, 3, choose()).state;
    expect(game.players.filter((player) => player.role === "ELECTRICIAN")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "RECEPTIONIST")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "PHOTOGRAPHER")).toHaveLength(1);
    expect(game.players.find((player) => player.role === "PHOTOGRAPHER")?.team).toBe("INNOCENT");
    expect(new Set(game.players.map((player) => player.role)).size).toBe(10);
    expect(game.players.filter((player) => player.role === "KILLER")).toHaveLength(1);
    expect(game.players.filter((player) => player.role === "ACCOMPLICE")).toHaveLength(1);
  });

  it("assigns every unique role when nine players join", () => {
    const seats = Array.from({ length: 9 }, (_, seatIndex) => ({ id: `seat-${seatIndex}`, displayName: `Guest ${seatIndex}`, seatIndex }));
    const game = createInitialGame("ABC234", seats, 3, choose()).state;
    expect(new Set(game.players.map((player) => player.role)).size).toBe(9);
    expect(game.players.find((player) => player.role === "RECEPTIONIST")?.team).toBe("INNOCENT");
  });

  it("delivers the receptionist's private register when the previous actor times out", () => {
    const state: GameEngineState = {
      code: "ABC234", version: 1, phase: "SKILL_PHASE", turn: 3,
      players: [
        { id: "detective", displayName: "Detective", seatIndex: 0, role: "DETECTIVE", team: "INNOCENT", roomNumber: 101, isAlive: true },
        { id: "receptionist", displayName: "Receptionist", seatIndex: 1, role: "RECEPTIONIST", team: "INNOCENT", roomNumber: 202, isAlive: true },
      ],
      crimeRooms: [], openedRooms: [], lockedRooms: [], activePlayerId: "detective", usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, phaseDeadlineAt: 1000,
    };
    const result = advanceTimedSkill(state, 1000, 180);
    expect(result.state.phase).toBe("DISCUSSION");
    expect(result.privateEvents).toContainEqual(expect.objectContaining({ type: "SKILL_RESULT", recipientPlayerId: "receptionist" }));
    expect(projectPrivatePlayerState(result.state, "receptionist").privateResults.join(" ")).toContain("Detective · ห้อง 101");
    expect(projectPrivatePlayerState(result.state, "detective").privateResults).toEqual([]);
  });

  it("does not allow submitting the photographer's automatic skill", () => {
    const initial = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    const actor = initial.players[0];
    const state: GameEngineState = { ...initial, phase: "SKILL_PHASE", turn: 3, activePlayerId: actor.id, players: initial.players.map((player) => player.id === actor.id ? { ...player, role: "PHOTOGRAPHER", team: "INNOCENT" } : player) };
    expect(() => performSkill(state, actor.id, null, 1000, 180)).toThrow("Automatic skill cannot be submitted");
  });

  it("keeps investigation private and moves to discussion after the last skill", () => {
    const start = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    let state: GameEngineState = start;
    let last;
    for (let step = 0; state.phase === "SKILL_PHASE" && step < 5; step += 1) {
      const actor = state.players.find((player) => player.id === state.activePlayerId);
      expect(actor).toBeDefined();
      const emptyRoom = HOTEL_ROOMS.find((room) => !state.crimeRooms.includes(room) && !state.players.some((player) => player.roomNumber === room));
      const target = actor?.role === "ELECTRICIAN" || actor?.role === "WINDOW_CLEANER" || actor?.role === "HOUSEKEEPER" || actor?.role === "WITNESS" ? 1 : actor?.role === "ACCOMPLICE" ? state.players.find((player) => player.id !== actor.id && player.isAlive)?.id : emptyRoom;
      last = performSkill(state, actor!.id, target, 1000, 180);
      expect(last.publicEvents.every((event) => event.type === "PHASE_CHANGED")).toBe(true);
      state = last.state;
    }
    expect(state.phase).toBe("DISCUSSION");
    expect(state.phaseDeadlineAt).toBe(181000);
    expect(last?.privateEvents.some((event) => event.type === "SKILL_RESULT" || event.type === "ASSASSINATION_RESULT")).toBe(true);
  });

  it("rejects a dead player's skill without changing state", () => {
    const state = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const actor = state.activePlayerId!;
    const dead = { ...state, players: state.players.map((player) => player.id === actor ? { ...player, isAlive: false } : player) };
    expect(() => performSkill(dead, actor, 101, 1000, 180)).toThrow();
  });

  it("skips an expired skill slot without publishing the actor", () => {
    const state = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const active = state.activePlayerId!;
    expect(state.phaseDeadlineAt).toBeDefined();
    expect(advanceTimedSkill(state, state.phaseDeadlineAt! - 1, 180).state.activePlayerId).toBe(active);
    const advanced = advanceTimedSkill(state, state.phaseDeadlineAt!, 180);
    expect(advanced.publicEvents).toEqual([]);
    expect(advanced.state.usedSkillPlayerIds).toContain(active);
    expect(advanced.state.activePlayerId).not.toBe(active);
    expect(projectPrivatePlayerState(advanced.state, active).actionHistory).toContainEqual({ turn: 1, type: "SKILL", message: "หมดเวลาใช้สกิล" });
  });

  it("keeps the Killer's private assassination result for reconnect", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const killer = initial.players.find((player) => player.role === "KILLER")!;
    const state = { ...initial, activePlayerId: killer.id, usedSkillPlayerIds: initial.players.filter((player) => player.id !== killer.id && player.isAlive).map((player) => player.id) };
    const emptyRoom = HOTEL_ROOMS.find((room) => !state.crimeRooms.includes(room) && !state.players.some((player) => player.roomNumber === room))!;
    const result = performSkill(state, killer.id, emptyRoom, 1000, 180);
    expect(projectPrivatePlayerState(result.state, killer.id).privateResults).toContain("ลอบสังหารไม่สำเร็จ");
  });

  it("rejects marked room targets for every room skill", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const actor = initial.players[0];
    for (const role of ["KILLER", "LOCKSMITH", "DETECTIVE"] as const) {
      const state: GameEngineState = { ...initial, activePlayerId: actor.id, players: initial.players.map((player) => player.id === actor.id ? { ...player, role } : player) };
      expect(() => performSkill(state, actor.id, state.crimeRooms[0], 1000, 180)).toThrow("Room is not eligible");
      expect(() => performSkill({ ...state, openedRooms: [701] }, actor.id, 701, 1000, 180)).toThrow("Room is not eligible");
      const victim = state.players.find((player) => player.id !== actor.id)!;
      const murdered = { ...state, deathNotices: { ...state.deathNotices, [victim.id]: { cause: "ASSASSINATION" as const, turn: 1 } } };
      expect(() => performSkill(murdered, actor.id, victim.roomNumber, 1000, 180)).toThrow("Room is not eligible");
    }
  });

  it("lets the Locksmith protect one new room per turn without repeating a prior room", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const locksmith = initial.players[0];
    const rooms = HOTEL_ROOMS.filter((room) => !initial.crimeRooms.includes(room) && !initial.players.some((player) => player.roomNumber === room));
    const firstTurn = { ...initial, activePlayerId: locksmith.id, usedSkillPlayerIds: [], players: initial.players.map((player) => player.id === locksmith.id ? { ...player, role: "LOCKSMITH" as const, team: "INNOCENT" as const } : player) };
    const first = performSkill(firstTurn, locksmith.id, rooms[0], 1000, 180);
    expect(first.state.locksmithUsedRooms).toEqual([rooms[0]]);
    const secondTurn = { ...first.state, phase: "SKILL_PHASE" as const, turn: 2, activePlayerId: locksmith.id, usedSkillPlayerIds: [], lockedRooms: [] };
    expect(() => performSkill(secondTurn, locksmith.id, rooms[0], 2000, 180)).toThrow("Room was already protected");
    const second = performSkill(secondTurn, locksmith.id, rooms[1], 2000, 180);
    expect(second.state.locksmithUsedRooms).toEqual([rooms[0], rooms[1]]);
    expect(projectPrivatePlayerState(second.state, locksmith.id).locksmithUsedRooms).toEqual([rooms[0], rooms[1]]);
  });

  it("rejects a floor or column when every room in it is already marked", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const actor = initial.players[0];
    const blocked: GameEngineState = { ...initial, activePlayerId: actor.id, crimeRooms: [101, 102, 103], openedRooms: [201, 301, 401, 501, 601, 701] };
    for (const role of ["ELECTRICIAN", "HOUSEKEEPER", "WITNESS", "WINDOW_CLEANER"] as const) {
      const state = { ...blocked, players: blocked.players.map((player) => player.id === actor.id ? { ...player, role } : player) };
      expect(() => performSkill(state, actor.id, 1, 1000, 180)).toThrow("No eligible rooms in target area");
    }
  });

  it("consumes the Accomplice's turn when selecting a dead player", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const accomplice = initial.players.find((player) => player.role === "ACCOMPLICE")!;
    const killer = initial.players.find((player) => player.role === "KILLER")!;
    const target = initial.players.find((player) => player.team === "INNOCENT")!;
    const state = {
      ...initial,
      activePlayerId: accomplice.id,
      players: initial.players.map((player) => player.id === target.id ? { ...player, isAlive: false } : player),
    };
    const result = performSkill(state, accomplice.id, target.id, 1000, 180);
    expect(result.state.usedSkillPlayerIds).toContain(accomplice.id);
    expect(result.state.activePlayerId).toBe(killer.id);
    expect(projectPrivatePlayerState(result.state, accomplice.id).privateResults).toContain("ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก");
    expect(projectPrivatePlayerState(result.state, killer.id).privateResults).toContain("ข้อมูลจากผู้สมรู้ร่วมคิด: ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก");
    expect(result.publicEvents).toEqual([]);
    expect(() => performSkill(state, accomplice.id, "unknown-player", 1000, 180)).toThrow("Invalid skill target");
    expect(() => performSkill(state, accomplice.id, accomplice.id, 1000, 180)).toThrow("Invalid skill target");
  });

  it("sends a living target's floor to the Assassin as an Accomplice report", () => {
    const initial = advancePrologue(createInitialGame("ABC234", lobbyPlayers, 3, choose(), 1000).state, 31000, choose()).state;
    const accomplice = initial.players.find((player) => player.role === "ACCOMPLICE")!;
    const killer = initial.players.find((player) => player.role === "KILLER")!;
    const target = initial.players.find((player) => player.team === "INNOCENT")!;
    const state = { ...initial, activePlayerId: accomplice.id };
    const result = performSkill(state, accomplice.id, target.id, 1000, 180);
    const report = `ข้อมูลจากผู้สมรู้ร่วมคิด: ผู้เล่นที่เลือกอยู่ชั้น ${Math.floor(target.roomNumber / 100)}`;
    expect(projectPrivatePlayerState(result.state, killer.id).privateResults).toContain(report);
    expect(result.privateEvents).toContainEqual({ type: "SKILL_RESULT", recipientPlayerId: killer.id, message: report });
    expect(projectPrivatePlayerState(result.state, accomplice.id).privateResults).toContain(`ผู้เล่นที่เลือกอยู่ชั้น ${Math.floor(target.roomNumber / 100)}`);
    expect(JSON.stringify(result.publicEvents)).not.toContain(report);
  });
});
