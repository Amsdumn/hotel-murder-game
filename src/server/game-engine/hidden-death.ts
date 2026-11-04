import { randomInt } from "node:crypto";
import { ROLE_ORDER } from "../../types/game";
import { HOTEL_ROOMS, isHotelRoom, killPlayer, type EngineResult, type GameEngineState, type PrivateGameEvent } from "./state";

function chooseThreeRooms(): number[] {
  const available = [...HOTEL_ROOMS];
  return Array.from({ length: 3 }, () => available.splice(randomInt(available.length), 1)[0]);
}

export function applyInitialCrime(state: GameEngineState, choose: () => number[] = chooseThreeRooms): EngineResult {
  if (state.phase !== "INITIAL_CRIME") throw new Error("Not in initial crime phase");
  if (state.crimeRooms.length) throw new Error("Initial crime scenes already exist");
  const killer = state.players.find((player) => player.role === "KILLER");
  if (!killer) throw new Error("Killer is missing");
  let rooms: number[] | null = null;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const selected = choose();
    if (selected.length !== 3 || new Set(selected).size !== 3 || !selected.every(isHotelRoom)) throw new Error("Invalid crime scene selection");
    if (!selected.includes(killer.roomNumber)) { rooms = selected; break; }
  }
  if (!rooms) throw new Error("Unable to select crime scenes");

  let next: GameEngineState = { ...state, crimeRooms: rooms };
  const privateEvents: PrivateGameEvent[] = [];
  for (const roomNumber of rooms) {
    const occupant = next.players.find((player) => player.roomNumber === roomNumber && player.isAlive);
    if (!occupant) continue;
    const death = killPlayer(next, occupant.id, "INITIAL_CRIME");
    next = death.state;
    if (death.privateEvent) privateEvents.push(death.privateEvent);
  }
  return { state: next, publicEvents: [{ type: "CRIME_SCENES_REVEALED", roomNumbers: rooms }], privateEvents };
}

export function resolveAssassination(state: GameEngineState, targetRoom: number): EngineResult {
  const killer = state.players.find((player) => player.id === state.activePlayerId);
  if (state.phase !== "SKILL_PHASE" || !killer || killer.role !== "KILLER" || !killer.isAlive || state.usedSkillPlayerIds.includes(killer.id)) {
    throw new Error("Skill action is not permitted");
  }
  if (!isHotelRoom(targetRoom)) throw new Error("Invalid target room");

  let next: GameEngineState = { ...state, usedSkillPlayerIds: [...state.usedSkillPlayerIds, killer.id] };
  let reason: "SUCCESS" | "EMPTY" | "LOCKED" | "ALREADY_DEAD" = "EMPTY";
  const privateEvents: PrivateGameEvent[] = [];
  if (state.lockedRooms.includes(targetRoom)) reason = "LOCKED";
  else {
    const occupant = state.players.find((player) => player.roomNumber === targetRoom);
    if (!occupant) reason = "EMPTY";
    else if (!occupant.isAlive) reason = "ALREADY_DEAD";
    else {
      reason = "SUCCESS";
      const death = killPlayer(next, occupant.id, "ASSASSINATION");
      next = death.state;
      if (death.privateEvent) privateEvents.push(death.privateEvent);
    }
  }
  privateEvents.unshift({ type: "ASSASSINATION_RESULT", recipientPlayerId: killer.id, success: reason === "SUCCESS", reason });
  const publicEvents: EngineResult["publicEvents"] = reason === "SUCCESS"
    ? [{ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: state.turn }]
    : [];
  if (next.phase === "FINISHED" && next.winner) publicEvents.push({ type: "GAME_FINISHED", winner: next.winner });
  return {
    state: next,
    publicEvents,
    privateEvents,
  };
}

export function advanceSkillTurn(state: GameEngineState, afterPlayerId: string | null): EngineResult {
  if (state.phase !== "SKILL_PHASE") throw new Error("Not in skill phase");
  const ordered = [...state.players].sort((left, right) => {
    const roleDifference = ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role);
    return roleDifference || left.seatIndex - right.seatIndex;
  });
  const previousIndex = afterPlayerId ? ordered.findIndex((player) => player.id === afterPlayerId) : -1;
  if (afterPlayerId && previousIndex < 0) throw new Error("Unknown previous actor");
  const nextActor = ordered.slice(previousIndex + 1).find((player) => player.isAlive && !state.usedSkillPlayerIds.includes(player.id));
  return {
    state: { ...state, activePlayerId: nextActor?.id ?? null },
    publicEvents: [],
    privateEvents: nextActor ? [{ type: "ACTION_REQUEST", recipientPlayerId: nextActor.id }] : [],
  };
}
