import { randomInt } from "node:crypto";
import { ROLE_ORDER, type Role } from "../../types/game";
import { advanceSkillTurn, applyInitialCrime, resolveAssassination } from "./hidden-death";
import { beginDiscussion } from "./phases";
import { appendPrivateAction, gameFloorCount, gameRooms, hotelRooms, isHotelRoom, isSelectableRoom, type EnginePlayer, type EngineResult, type GameEngineState, type PrivateGameEvent, type PublicGameEvent } from "./state";
import { AVATAR_ORDER } from "../../lib/avatars";

type RandomIndex = (maximum: number) => number;
export const PROLOGUE_DURATION_MS = 30_000;

function shuffle<T>(items: readonly T[], choose: RandomIndex): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = choose(index + 1);
    if (!Number.isInteger(selected) || selected < 0 || selected > index) throw new Error("Invalid random selection");
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

export function createInitialGame(code: string, seats: Array<Pick<EnginePlayer, "id" | "displayName" | "seatIndex">>, version: number, choose: RandomIndex = randomInt, now = Date.now(), selectedInnocentRoles?: Role[]): EngineResult {
  if (seats.length < 5 || seats.length > 10 || new Set(seats.map((seat) => seat.id)).size !== seats.length) throw new Error("Invalid player seats");
  if (seats.length > AVATAR_ORDER.length) throw new Error("Not enough public characters");
  const innocentRoles = selectedInnocentRoles ?? ROLE_ORDER.filter((role) => role !== "KILLER" && role !== "ACCOMPLICE");
  if (selectedInnocentRoles && (innocentRoles.length !== seats.length - 2 || new Set(innocentRoles).size !== innocentRoles.length || innocentRoles.some((role) => role === "KILLER" || role === "ACCOMPLICE" || !ROLE_ORDER.includes(role)))) throw new Error("Invalid innocent role selection");
  const needed = seats.length - 2;
  if (needed > innocentRoles.length) throw new Error("Not enough innocent roles");
  const roles: Role[] = shuffle(["KILLER", "ACCOMPLICE", ...shuffle(innocentRoles, choose).slice(0, needed)], choose);
  const floorCount = seats.length === 5 ? 5 : seats.length === 10 ? 9 : 7;
  const rooms = shuffle(hotelRooms(floorCount), choose);
  const avatars = shuffle(AVATAR_ORDER, choose);
  const players: EnginePlayer[] = seats.map((seat, index) => ({ id: seat.id, displayName: seat.displayName, seatIndex: seat.seatIndex, avatarId: avatars[index], role: roles[index], team: roles[index] === "KILLER" || roles[index] === "ACCOMPLICE" ? "MURDERER" : "INNOCENT", roomNumber: rooms[index], isAlive: true }));
  const initial: GameEngineState = { code, version, floorCount, phase: "ROLE_REVEAL", turn: 1, players, crimeRooms: [], openedRooms: [], lockedRooms: [], locksmithUsedRooms: [], darkFloors: [], electricianLastUsedTurn: {}, activePlayerId: null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, privateResultMessages: {}, privateActionHistory: {}, publicHistory: [], phaseDeadlineAt: now + PROLOGUE_DURATION_MS };
  return { state: initial, publicEvents: [], privateEvents: [] };
}

export function advancePrologue(state: GameEngineState, now: number, choose: RandomIndex = randomInt): EngineResult {
  if (state.phase !== "ROLE_REVEAL" || state.phaseDeadlineAt === undefined || now < state.phaseDeadlineAt) return { state, publicEvents: [], privateEvents: [] };
  const emptyRooms = gameRooms(state).filter((room) => !state.players.some((player) => player.roomNumber === room));
  const crime = applyInitialCrime({ ...state, phase: "INITIAL_CRIME" }, () => shuffle(emptyRooms, choose).slice(0, 3));
  const phaseEvent: PublicGameEvent = { type: "PHASE_CHANGED", phase: "SKILL_PHASE", turn: 1 };
  const afterCrime: GameEngineState = { ...crime.state, phase: "SKILL_PHASE", publicHistory: [...crime.publicEvents, phaseEvent] };
  const first = advanceSkillTurn(afterCrime, null);
  return { state: { ...first.state, phaseDeadlineAt: now + 60_000 }, publicEvents: [...crime.publicEvents, phaseEvent], privateEvents: [...crime.privateEvents, ...first.privateEvents] };
}

function requireRoom(state: GameEngineState, value: unknown): number {
  if (typeof value !== "number" || !isHotelRoom(value, gameFloorCount(state))) throw new Error("Invalid skill target");
  return value;
}

function requireSelectableRoom(state: GameEngineState, value: unknown): number {
  const room = requireRoom(state, value);
  if (!isSelectableRoom(state, room)) throw new Error("Room is not eligible");
  return room;
}

function requireSelectableArea(state: GameEngineState, value: unknown, kind: "floor" | "column"): number {
  const area = kind === "floor" ? requireFloor(state, value) : value;
  if (typeof area !== "number" || !Number.isInteger(area) || (kind === "column" && (area < 1 || area > 3))) throw new Error("Invalid skill target");
  if (!gameRooms(state).some((room) => (kind === "floor" ? Math.floor(room / 100) : room % 100) === area && isSelectableRoom(state, room))) throw new Error("No eligible rooms in target area");
  return area;
}

function requireFloor(state: GameEngineState, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > gameFloorCount(state)) throw new Error("Invalid skill target");
  return value;
}

function addPrivateResult(state: GameEngineState, recipientId: string, message: string): GameEngineState {
  return { ...state, privateResultMessages: { ...state.privateResultMessages, [recipientId]: [...(state.privateResultMessages?.[recipientId] ?? []), message] } };
}

function resolvePendingAssassination(state: GameEngineState): EngineResult {
  const target = state.pendingAssassinationRoom;
  const killer = state.players.find((player) => player.role === "KILLER");
  if (target === undefined || !killer) return { state, publicEvents: [], privateEvents: [] };
  const resolved = resolveAssassination({ ...state, activePlayerId: killer.id, usedSkillPlayerIds: state.usedSkillPlayerIds.filter((id) => id !== killer.id), pendingAssassinationRoom: undefined }, target);
  const result = resolved.privateEvents.find((event) => event.type === "ASSASSINATION_RESULT");
  let next: GameEngineState = { ...resolved.state, activePlayerId: state.activePlayerId, usedSkillPlayerIds: state.usedSkillPlayerIds, pendingAssassinationRoom: undefined };
  if (result?.type === "ASSASSINATION_RESULT") next = addPrivateResult(next, killer.id, result.success ? "ลอบสังหารสำเร็จ" : "ลอบสังหารไม่สำเร็จ");
  if (resolved.publicEvents.length) next = { ...next, publicHistory: [...(state.publicHistory ?? []), ...resolved.publicEvents] };
  return { state: next, publicEvents: resolved.publicEvents, privateEvents: resolved.privateEvents };
}

export function performSkill(state: GameEngineState, playerId: string, target: unknown, now: number, discussionSeconds: number): EngineResult {
  const actor = state.players.find((player) => player.id === playerId);
  if (state.phase !== "SKILL_PHASE" || state.activePlayerId !== playerId || !actor?.isAlive || state.usedSkillPlayerIds.includes(playerId)) throw new Error("Skill is not permitted");
  if (actor.role === "RECEPTIONIST" || actor.role === "PHOTOGRAPHER") throw new Error("Automatic skill cannot be submitted");
  if (state.darkFloors?.includes(Math.floor(actor.roomNumber / 100)) || (actor.role === "ELECTRICIAN" && state.electricianLastUsedTurn?.[playerId] === state.turn - 1)) throw new Error("Skill is not permitted");
  let next = state;
  const privateEvents: PrivateGameEvent[] = [];
  let publicEvents: EngineResult["publicEvents"] = [];
  if (actor.role === "KILLER") {
    const room = requireSelectableRoom(state, target);
    const selectedState = { ...state, assassinationTargetRoom: room };
    const occupant = state.players.find((player) => player.roomNumber === room && player.isAlive);
    const witness = state.players.find((player) => player.role === "WITNESS" && player.isAlive && !state.usedSkillPlayerIds.includes(player.id) && !state.darkFloors?.includes(Math.floor(player.roomNumber / 100)));
    if (occupant && witness && !state.lockedRooms.includes(room)) {
      next = addPrivateResult({ ...selectedState, usedSkillPlayerIds: [...state.usedSkillPlayerIds, playerId], pendingAssassinationRoom: room }, playerId, "เลือกเป้าหมายแล้ว กำลังประมวลผล");
    } else {
      const assassination = resolveAssassination(selectedState, room);
      next = assassination.state;
      privateEvents.push(...assassination.privateEvents);
      publicEvents = assassination.publicEvents;
      const result = assassination.privateEvents.find((event) => event.type === "ASSASSINATION_RESULT");
      if (result?.type === "ASSASSINATION_RESULT") next = addPrivateResult(next, playerId, result.success ? "ลอบสังหารสำเร็จ" : "ลอบสังหารไม่สำเร็จ");
      if (publicEvents.length) next = { ...next, publicHistory: [...(state.publicHistory ?? []), ...publicEvents] };
    }
  } else {
    let message: string;
    if (actor.role === "ELECTRICIAN") {
      const floor = requireSelectableArea(state, target, "floor");
      next = { ...next, darkFloors: [...(next.darkFloors ?? []), floor], electricianLastUsedTurn: { ...next.electricianLastUsedTurn, [playerId]: state.turn } };
      message = `ดับไฟชั้น ${floor} แล้วในเทิร์นนี้`;
    } else if (actor.role === "LOCKSMITH") {
      const room = requireSelectableRoom(state, target);
      if (state.locksmithUsedRooms?.includes(room)) throw new Error("Room was already protected");
      next = { ...next, lockedRooms: [...new Set([...next.lockedRooms, room])], locksmithUsedRooms: [...(next.locksmithUsedRooms ?? []), room] };
      message = `ล็อกห้อง ${room} แล้ว`;
    } else if (actor.role === "HOUSEKEEPER") {
      const floor = requireSelectableArea(state, target, "floor");
      message = `ชั้น ${floor} มีผู้เล่นที่ยังมีชีวิต ${state.players.filter((player) => player.isAlive && Math.floor(player.roomNumber / 100) === floor).length} คน`;
    } else if (actor.role === "WINDOW_CLEANER") {
      const column = requireSelectableArea(state, target, "column");
      message = `แนวห้อง 0${column} มีผู้เล่นที่ยังมีชีวิต ${state.players.filter((player) => player.isAlive && player.roomNumber % 100 === column).length} คน`;
    } else if (actor.role === "WITNESS") {
      const floor = requireSelectableArea(state, target, "floor");
      const killer = state.players.find((player) => player.role === "KILLER");
      if (!killer) throw new Error("Killer is missing");
      const direction = Math.floor(killer.roomNumber / 100) > floor ? "ABOVE" : Math.floor(killer.roomNumber / 100) < floor ? "BELOW" : "SAME_FLOOR";
      message = state.assassinationTargetRoom !== undefined && Math.floor(state.assassinationTargetRoom / 100) === floor ? `ทิศทางชั้นนักฆ่า: ${direction}` : "ไม่พบเบาะแสทิศทาง";
    } else if (actor.role === "DETECTIVE") {
      const room = requireSelectableRoom(state, target);
      const occupant = state.players.find((player) => player.roomNumber === room && player.isAlive);
      message = `ผลตรวจห้อง ${room}: ${occupant ? occupant.team : "EMPTY"}`;
    } else {
      if (target === actor.id) throw new Error("Invalid skill target");
      const selected = state.players.find((player) => player.id === target);
      if (!selected) throw new Error("Invalid skill target");
      message = selected.isAlive ? `ผู้เล่นที่เลือกอยู่ชั้น ${Math.floor(selected.roomNumber / 100)}` : "ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก";
      for (const teammate of state.players.filter((player) => player.role === "KILLER" && player.isAlive)) {
        const report = `ข้อมูลจากผู้สมรู้ร่วมคิด: ${message}`;
        next = addPrivateResult(next, teammate.id, report);
        privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: teammate.id, message: report });
      }
    }
    next = addPrivateResult({ ...next, usedSkillPlayerIds: [...next.usedSkillPlayerIds, playerId] }, playerId, message);
    privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: playerId, message });
  }
  if (actor.role === "WITNESS" && next.pendingAssassinationRoom !== undefined) {
    const resolved = resolvePendingAssassination(next);
    next = resolved.state;
    publicEvents.push(...resolved.publicEvents);
    privateEvents.push(...resolved.privateEvents);
  }
  if (next.phase === "FINISHED") return { state: next, publicEvents, privateEvents };
  const following = advanceSkillTurn(next, playerId);
  next = following.state;
  privateEvents.push(...following.privateEvents);
  if (!next.activePlayerId) {
    const discussion = beginDiscussion(next, now, discussionSeconds);
    next = discussion.state;
    publicEvents.push(...discussion.publicEvents);
  }
  else next = { ...next, phaseDeadlineAt: now + 60_000 };
  return { state: next, publicEvents, privateEvents };
}

export function advanceTimedSkill(state: GameEngineState, now: number, discussionSeconds: number): EngineResult {
  if (state.phase !== "SKILL_PHASE" || !state.activePlayerId || state.phaseDeadlineAt === undefined || now < state.phaseDeadlineAt) return { state, publicEvents: [], privateEvents: [] };
  const skipped = state.activePlayerId;
  const usedSkillPlayerIds = [...state.usedSkillPlayerIds, skipped];
  const timedOut = appendPrivateAction({ ...state, usedSkillPlayerIds }, skipped, { turn: state.turn, type: "SKILL", message: "หมดเวลาใช้สกิล" });
  const resolved = state.players.find((player) => player.id === skipped)?.role === "WITNESS" ? resolvePendingAssassination(timedOut) : { state: timedOut, publicEvents: [], privateEvents: [] };
  if (resolved.state.phase === "FINISHED") return resolved;
  const advanced = advanceSkillTurn(resolved.state, skipped);
  if (!advanced.state.activePlayerId) {
    const discussion = beginDiscussion(advanced.state, now, discussionSeconds);
    return { state: discussion.state, publicEvents: [...resolved.publicEvents, ...discussion.publicEvents], privateEvents: [...resolved.privateEvents, ...advanced.privateEvents, ...discussion.privateEvents] };
  }
  return { state: { ...advanced.state, phaseDeadlineAt: now + 60_000 }, publicEvents: resolved.publicEvents, privateEvents: [...resolved.privateEvents, ...advanced.privateEvents] };
}
