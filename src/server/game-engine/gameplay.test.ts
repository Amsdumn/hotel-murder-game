import { describe, expect, it } from "vitest";
import { advancePrologue, advanceTimedSkill, createInitialGame, performSkill } from "./gameplay";
import { HOTEL_ROOMS, isSelectableRoom, type GameEngineState } from "./state";
import { projectPrivatePlayerState, projectPublicState } from "./projections";
import { advanceSkillTurn } from "./hidden-death";
import { castRoomVote } from "./phases";
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
  it("uses five floors for five players, seven normally, and nine for ten", () => {
    for (const playerCount of [5, 6, 7, 8, 9, 10]) {
      const floorCount = playerCount === 5 ? 5 : playerCount === 10 ? 9 : 7;
      const seats = Array.from({ length: playerCount }, (_, seatIndex) => ({ id: `seat-${seatIndex}`, displayName: `Guest ${seatIndex}`, seatIndex }));
      const initial = createInitialGame("ABC234", seats, 1, choose(), 1000).state;
      expect(initial.floorCount).toBe(floorCount);
      expect(initial.players.every((player) => Math.floor(player.roomNumber / 100) <= floorCount)).toBe(true);
      expect(projectPublicState(initial).publicRooms).toHaveLength(floorCount * 3);
      expect(projectPublicState(initial).publicRooms.at(-1)?.roomNumber).toBe(floorCount * 100 + 3);
      const started = advancePrologue(initial, 31000, choose()).state;
      expect(started.crimeRooms).toHaveLength(3);
      expect(started.crimeRooms.every((room) => Math.floor(room / 100) <= floorCount)).toBe(true);
      expect(isSelectableRoom(initial, floorCount * 100 + 1)).toBe(true);
      expect(isSelectableRoom(initial, (floorCount + 1) * 100 + 1)).toBe(false);
    }
  });

  it("randomly assigns only the innocent roles selected by the host", () => {
    const selected = ["WITNESS", "DETECTIVE", "HOUSEKEEPER", "LOCKSMITH"] as const;
    const game = createInitialGame("ABC234", lobbyPlayers, 1, choose(), 1000, [...selected]).state;
    expect(game.players.filter((player) => player.team === "INNOCENT").map((player) => player.role).sort()).toEqual([...selected].sort());
    expect(game.players.filter((player) => player.team === "MURDERER").map((player) => player.role).sort()).toEqual(["KILLER"]);
    expect(() => createInitialGame("ABC234", lobbyPlayers, 1, choose(), 1000, ["WITNESS"])).toThrow();
  });

  it("can assign the Former Police Officer without changing public avatar assignment", () => {
    const selected = ["FORMER_POLICE", "WITNESS", "HOUSEKEEPER", "LOCKSMITH"] as const;
    const game = createInitialGame("ABC234", lobbyPlayers, 1, choose(), 1000, [...selected]).state;
    expect(game.players.filter((player) => player.team === "INNOCENT").map((player) => player.role).sort()).toEqual([...selected].sort());
    expect(new Set(game.players.map((player) => player.avatarId)).size).toBe(5);
    const officer = game.players.find((player) => player.role === "FORMER_POLICE")!;
    expect(projectPrivatePlayerState({ ...game, phase: "SKILL_PHASE", activePlayerId: officer.id }, officer.id).canUseSkill).toBe(false);
    expect(() => performSkill({ ...game, phase: "SKILL_PHASE", activePlayerId: officer.id }, officer.id, null, 1000, 180)).toThrow("Automatic skill cannot be submitted");
  });

  it("draws the needed Innocent roles from a larger host-selected pool", () => {
    const pool = ["WITNESS", "DETECTIVE", "HOUSEKEEPER", "LOCKSMITH", "ELECTRICIAN"] as const;
    const game = createInitialGame("ABC234", lobbyPlayers, 1, choose(), 1000, [...pool]).state;
    const assigned = game.players.filter((player) => player.team === "INNOCENT").map((player) => player.role);
    expect(assigned).toHaveLength(4);
    expect(assigned.every((role) => pool.includes(role as typeof pool[number]))).toBe(true);
    expect(new Set(assigned).size).toBe(4);
  });

  it("kills occupants in both selected rooms on turn two of a five-player game", () => {
    const initial = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "killer", displayName: "Killer", seatIndex: 0, role: "KILLER", team: "MURDERER", roomNumber: 201, isAlive: true },
      { id: "first", displayName: "First", seatIndex: 1, role: "DETECTIVE", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "second", displayName: "Second", seatIndex: 2, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
      { id: "third", displayName: "Third", seatIndex: 3, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 301, isAlive: true },
      { id: "fourth", displayName: "Fourth", seatIndex: 4, role: "ELECTRICIAN", team: "INNOCENT", roomNumber: 401, isAlive: true },
    ];
    const state: GameEngineState = { ...initial, players, phase: "SKILL_PHASE", turn: 2, activePlayerId: "killer", usedSkillPlayerIds: players.slice(1).map((player) => player.id), crimeRooms: [103] };
    expect(() => performSkill(state, "killer", 101, 1000, 180)).toThrow("Two distinct rooms required");
    expect(() => performSkill(state, "killer", [101, 101], 1000, 180)).toThrow("Two distinct rooms required");
    const result = performSkill(state, "killer", [101, 102], 1000, 180);
    expect(result.state.players.filter((player) => !player.isAlive).map((player) => player.id)).toEqual(["first", "second"]);
    expect(result.publicEvents.filter((event) => event.type === "MURDER_OCCURRED")).toHaveLength(2);
    expect(projectPrivatePlayerState(result.state, "killer").privateResults).toContain("ห้อง 101: ลอบสังหารสำเร็จ");
    expect(projectPrivatePlayerState(result.state, "killer").privateResults).toContain("ห้อง 102: ลอบสังหารสำเร็จ");
  });

  it("defers both turn-two murders until the Witness has checked a targeted floor", () => {
    const initial = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "killer", displayName: "Killer", seatIndex: 0, role: "KILLER", team: "MURDERER", roomNumber: 201, isAlive: true },
      { id: "first", displayName: "First", seatIndex: 1, role: "DETECTIVE", team: "INNOCENT", roomNumber: 101, isAlive: true },
      { id: "second", displayName: "Second", seatIndex: 2, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 3, role: "WITNESS", team: "INNOCENT", roomNumber: 301, isAlive: true },
      { id: "fourth", displayName: "Fourth", seatIndex: 4, role: "ELECTRICIAN", team: "INNOCENT", roomNumber: 401, isAlive: true },
    ];
    const state: GameEngineState = { ...initial, players, phase: "SKILL_PHASE", turn: 2, activePlayerId: "killer", usedSkillPlayerIds: ["first", "second", "fourth"], crimeRooms: [103] };
    const chosen = performSkill(state, "killer", [101, 102], 1000, 180);
    expect(chosen.state.players.every((player) => player.isAlive)).toBe(true);
    expect(chosen.state.pendingAssassinationRooms).toEqual([101, 102]);
    const result = performSkill(chosen.state, "witness", 1, 2000, 180);
    expect(projectPrivatePlayerState(result.state, "witness").privateResults).toContain("ทิศทางชั้นนักฆ่า: ABOVE");
    expect(result.state.players.filter((player) => !player.isAlive).map((player) => player.id)).toEqual(["first", "second"]);
    expect(result.publicEvents.filter((event) => event.type === "MURDER_OCCURRED")).toHaveLength(2);
  });

  it("keeps seven floors for an existing game without a stored floor count", () => {
    const legacy = { ...createInitialGame("ABC234", lobbyPlayers, 1, choose()).state };
    delete legacy.floorCount;
    expect(projectPublicState(legacy).publicRooms).toHaveLength(21);
    expect(isSelectableRoom(legacy, 703)).toBe(true);
    expect(isSelectableRoom(legacy, 801)).toBe(false);
  });

  it("accepts ninth-floor targets in a ten-player game", () => {
    const seats = Array.from({ length: 10 }, (_, seatIndex) => ({ id: `seat-${seatIndex}`, displayName: `Guest ${seatIndex}`, seatIndex }));
    const initial = createInitialGame("ABC234", seats, 1, choose(), 1000, ["ELECTRICIAN", "LOCKSMITH", "HOUSEKEEPER", "WINDOW_CLEANER", "DETECTIVE", "RECEPTIONIST", "PHOTOGRAPHER", "WITNESS"]).state;
    const detective = initial.players.find((player) => player.role === "DETECTIVE")!;
    const state: GameEngineState = { ...initial, phase: "SKILL_PHASE", activePlayerId: detective.id };
    expect(() => performSkill(state, detective.id, 901, 1000, 180)).not.toThrow();
    const housekeeper = initial.players.find((player) => player.role === "HOUSEKEEPER")!;
    expect(() => performSkill({ ...state, activePlayerId: housekeeper.id }, housekeeper.id, 9, 1000, 180)).not.toThrow();
    const voter = initial.players.find((player) => player.roomNumber !== 901)!;
    expect(castRoomVote({ ...initial, phase: "VOTING", phaseDeadlineAt: 2000 }, voter.id, 901, 1000).state.votes[voter.id]).toBe(901);
  });

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
    expect(chosen.state.phaseDeadlineAt).toBe(181000);
    expect(chosen.state.players.find((player) => player.id === "witness")?.isAlive).toBe(true);
    expect(chosen.publicEvents).toEqual([]);
    const witnessed = performSkill(chosen.state, "witness", 3, 2000, 180);
    expect(projectPrivatePlayerState(witnessed.state, "witness").privateResults).toContain("ทิศทางชั้นนักฆ่า: BELOW");
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

  it("gives the witness a clue for the killer's chosen floor even when the attempt fails", () => {
    const base = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "killer", displayName: "Killer", seatIndex: 0, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 1, role: "WITNESS", team: "INNOCENT", roomNumber: 301, isAlive: true },
      { id: "guest", displayName: "Guest", seatIndex: 2, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 401, isAlive: true },
    ];
    for (const [room, lockedRooms, floor, expected] of [
      [102, [], 1, "ทิศทางชั้นนักฆ่า: ABOVE"],
      [401, [401], 4, "ทิศทางชั้นนักฆ่า: BELOW"],
    ] as const) {
      const state: GameEngineState = { ...base, phase: "SKILL_PHASE", players, crimeRooms: [103], lockedRooms: [...lockedRooms], activePlayerId: "killer", usedSkillPlayerIds: ["guest"] };
      const attempted = performSkill(state, "killer", room, 1000, 180);
      expect(projectPrivatePlayerState(attempted.state, "killer").privateResults).toContain("ลอบสังหารไม่สำเร็จ");
      const witnessed = performSkill(attempted.state, "witness", floor, 2000, 180);
      expect(projectPrivatePlayerState(witnessed.state, "witness").privateResults).toContain(expected);
    }
  });

  it("does not give a clue for an old crime scene or a different target floor", () => {
    const base = createInitialGame("ABC234", lobbyPlayers, 1, choose()).state;
    const players: GameEngineState["players"] = [
      { id: "killer", displayName: "Killer", seatIndex: 0, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
      { id: "witness", displayName: "Witness", seatIndex: 1, role: "WITNESS", team: "INNOCENT", roomNumber: 301, isAlive: true },
    ];
    const state: GameEngineState = { ...base, phase: "SKILL_PHASE", players, crimeRooms: [103], activePlayerId: "killer", usedSkillPlayerIds: [] };
    const attempted = performSkill(state, "killer", 401, 1000, 180);
    const witnessed = performSkill(attempted.state, "witness", 1, 2000, 180);
    expect(projectPrivatePlayerState(witnessed.state, "witness").privateResults).toContain("ไม่พบเบาะแสทิศทาง");
    const noAttempt = performSkill({ ...state, activePlayerId: "witness", usedSkillPlayerIds: ["killer"] }, "witness", 1, 2000, 180);
    expect(projectPrivatePlayerState(noAttempt.state, "witness").privateResults).toContain("ไม่พบเบาะแสทิศทาง");
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
    expect(advancePrologue(result.state, 31000, choose(), 180).state.phaseDeadlineAt).toBe(211000);
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
      const openedRoom = projectPublicState(state).publicRooms.find((room) => room.state === "UNKNOWN")!.roomNumber;
      expect(() => performSkill({ ...state, openedRooms: [openedRoom] }, actor.id, openedRoom, 1000, 180)).toThrow("Room is not eligible");
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

  it("rejects a dead guest as the Accomplice's target", () => {
    const initial = advancePrologue(createInitialGame("ABC234", [...lobbyPlayers, { id: "p5", displayName: "Player 5", seatIndex: 5 }], 3, choose(), 1000).state, 31000, choose()).state;
    const accomplice = initial.players.find((player) => player.role === "ACCOMPLICE")!;
    const target = initial.players.find((player) => player.team === "INNOCENT")!;
    const state = {
      ...initial,
      activePlayerId: accomplice.id,
      players: initial.players.map((player) => player.id === target.id ? { ...player, isAlive: false } : player),
    };
    expect(() => performSkill(state, accomplice.id, target.id, 1000, 180)).toThrow("Invalid skill target");
    expect(() => performSkill(state, accomplice.id, "unknown-player", 1000, 180)).toThrow("Invalid skill target");
    expect(() => performSkill(state, accomplice.id, accomplice.id, 1000, 180)).toThrow("Invalid skill target");
  });

  it("sends a living target's floor to the Assassin as an Accomplice report", () => {
    const initial = advancePrologue(createInitialGame("ABC234", [...lobbyPlayers, { id: "p5", displayName: "Player 5", seatIndex: 5 }], 3, choose(), 1000).state, 31000, choose()).state;
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
