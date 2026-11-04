import { randomInt } from "node:crypto";
import { ROLE_ORDER, type Role } from "../../types/game";
import { advanceSkillTurn, applyInitialCrime, resolveAssassination } from "./hidden-death";
import { beginDiscussion } from "./phases";
import { HOTEL_ROOMS, isHotelRoom, type EnginePlayer, type EngineResult, type GameEngineState, type PrivateGameEvent } from "./state";

type RandomIndex = (maximum: number) => number;

function shuffle<T>(items: readonly T[], choose: RandomIndex): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = choose(index + 1);
    if (!Number.isInteger(selected) || selected < 0 || selected > index) throw new Error("Invalid random selection");
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

export function createInitialGame(code: string, seats: Array<Pick<EnginePlayer, "id" | "displayName" | "seatIndex">>, version: number, choose: RandomIndex = randomInt, now = Date.now()): EngineResult {
  if (seats.length < 5 || seats.length > 10 || new Set(seats.map((seat) => seat.id)).size !== seats.length) throw new Error("Invalid player seats");
  const innocentRoles = ROLE_ORDER.filter((role) => role !== "KILLER" && role !== "ACCOMPLICE");
  const needed = seats.length - 2;
  const roles: Role[] = shuffle(["KILLER", "ACCOMPLICE", ...shuffle(innocentRoles, choose).slice(0, needed), ...Array.from({ length: Math.max(0, needed - innocentRoles.length) }, (_, index) => innocentRoles[index % innocentRoles.length])], choose);
  const rooms = shuffle(HOTEL_ROOMS, choose);
  const players: EnginePlayer[] = seats.map((seat, index) => ({ ...seat, role: roles[index], team: roles[index] === "KILLER" || roles[index] === "ACCOMPLICE" ? "MURDERER" : "INNOCENT", roomNumber: rooms[index], isAlive: true }));
  const initial: GameEngineState = { code, version, phase: "INITIAL_CRIME", turn: 1, players, crimeRooms: [], openedRooms: [], lockedRooms: [], activePlayerId: null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, privateResultMessages: {}, publicHistory: [] };
  const crime = applyInitialCrime(initial, () => shuffle(HOTEL_ROOMS, choose).slice(0, 3));
  const afterCrime: GameEngineState = { ...crime.state, phase: "SKILL_PHASE", publicHistory: crime.publicEvents };
  const first = advanceSkillTurn(afterCrime, null);
  return { state: { ...first.state, phaseDeadlineAt: now + 60_000 }, publicEvents: crime.publicEvents, privateEvents: [...crime.privateEvents, ...first.privateEvents] };
}

function requireRoom(value: unknown): number {
  if (typeof value !== "number" || !isHotelRoom(value)) throw new Error("Invalid skill target");
  return value;
}

function requireFloor(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 7) throw new Error("Invalid skill target");
  return value;
}

function addPrivateResult(state: GameEngineState, recipientId: string, message: string): GameEngineState {
  return { ...state, privateResultMessages: { ...state.privateResultMessages, [recipientId]: [...(state.privateResultMessages?.[recipientId] ?? []), message] } };
}

export function performSkill(state: GameEngineState, playerId: string, target: unknown, now: number, discussionSeconds: number): EngineResult {
  const actor = state.players.find((player) => player.id === playerId);
  if (state.phase !== "SKILL_PHASE" || state.activePlayerId !== playerId || !actor?.isAlive || state.usedSkillPlayerIds.includes(playerId)) throw new Error("Skill is not permitted");
  let next = state;
  const privateEvents: PrivateGameEvent[] = [];
  let publicEvents: EngineResult["publicEvents"] = [];
  if (actor.role === "KILLER") {
    const assassination = resolveAssassination(state, requireRoom(target));
    next = assassination.state;
    privateEvents.push(...assassination.privateEvents);
    publicEvents = assassination.publicEvents;
    const result = assassination.privateEvents.find((event) => event.type === "ASSASSINATION_RESULT");
    if (result?.type === "ASSASSINATION_RESULT") next = addPrivateResult(next, playerId, result.success ? "ลอบสังหารสำเร็จ" : "ลอบสังหารไม่สำเร็จ");
    if (publicEvents.length) next = { ...next, publicHistory: [...(state.publicHistory ?? []), ...publicEvents] };
  } else {
    let message: string;
    if (actor.role === "LOCKSMITH") {
      const room = requireRoom(target);
      next = { ...next, lockedRooms: [...new Set([...next.lockedRooms, room])] };
      message = `ล็อกห้อง ${room} แล้ว`;
    } else if (actor.role === "HOUSEKEEPER") {
      const floor = requireFloor(target);
      message = `ชั้น ${floor} มีผู้เล่นที่ยังมีชีวิต ${state.players.filter((player) => player.isAlive && Math.floor(player.roomNumber / 100) === floor).length} คน`;
    } else if (actor.role === "WINDOW_CLEANER") {
      if (typeof target !== "number" || !Number.isInteger(target) || target < 1 || target > 3) throw new Error("Invalid skill target");
      message = `แนวห้อง 0${target} มีผู้เล่นที่ยังมีชีวิต ${state.players.filter((player) => player.isAlive && player.roomNumber % 100 === target).length} คน`;
    } else if (actor.role === "WITNESS") {
      const floor = requireFloor(target);
      const killer = state.players.find((player) => player.role === "KILLER");
      if (!killer) throw new Error("Killer is missing");
      const direction = Math.floor(killer.roomNumber / 100) > floor ? "ABOVE" : Math.floor(killer.roomNumber / 100) < floor ? "BELOW" : "SAME_FLOOR";
      message = state.crimeRooms.some((room) => Math.floor(room / 100) === floor) ? `ทิศทางชั้นฆาตกร: ${direction}` : "ไม่พบเบาะแสทิศทาง";
    } else if (actor.role === "DETECTIVE") {
      const room = requireRoom(target);
      const occupant = state.players.find((player) => player.roomNumber === room && player.isAlive);
      message = `ผลตรวจห้อง ${room}: ${occupant ? occupant.team : "EMPTY"}`;
    } else {
      const selected = state.players.find((player) => player.id === target && player.isAlive);
      if (!selected) throw new Error("Invalid skill target");
      message = `ผู้เล่นที่เลือกอยู่ชั้น ${Math.floor(selected.roomNumber / 100)}`;
      for (const teammate of state.players.filter((player) => player.team === "MURDERER" && player.isAlive && player.id !== actor.id)) {
        next = addPrivateResult(next, teammate.id, message);
        privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: teammate.id, message });
      }
    }
    next = addPrivateResult({ ...next, usedSkillPlayerIds: [...next.usedSkillPlayerIds, playerId] }, playerId, message);
    privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: playerId, message });
  }
  if (next.phase === "FINISHED") return { state: next, publicEvents, privateEvents };
  const following = advanceSkillTurn(next, playerId);
  next = following.state;
  privateEvents.push(...following.privateEvents);
  if (!next.activePlayerId) next = beginDiscussion(next, now, discussionSeconds).state;
  else next = { ...next, phaseDeadlineAt: now + 60_000 };
  return { state: next, publicEvents, privateEvents };
}

export function advanceTimedSkill(state: GameEngineState, now: number, discussionSeconds: number): EngineResult {
  if (state.phase !== "SKILL_PHASE" || !state.activePlayerId || state.phaseDeadlineAt === undefined || now < state.phaseDeadlineAt) return { state, publicEvents: [], privateEvents: [] };
  const skipped = state.activePlayerId;
  const usedSkillPlayerIds = [...state.usedSkillPlayerIds, skipped];
  const advanced = advanceSkillTurn({ ...state, usedSkillPlayerIds }, skipped);
  if (!advanced.state.activePlayerId) return beginDiscussion(advanced.state, now, discussionSeconds);
  return { state: { ...advanced.state, phaseDeadlineAt: now + 60_000 }, publicEvents: [], privateEvents: advanced.privateEvents };
}
