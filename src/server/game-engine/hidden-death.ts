import { randomInt } from "node:crypto";
import { ROLE_ORDER } from "../../types/game";
import { formerPoliceClue } from "../../lib/assassin-clues";
import { appendPrivateAction, gameFloorCount, gameRooms, isHotelRoom, isSelectableRoom, killPlayer, type EngineResult, type GameEngineState, type PrivateGameEvent } from "./state";

function chooseThreeRooms(emptyRooms: number[]): number[] {
  const available = [...emptyRooms];
  return Array.from({ length: 3 }, () => available.splice(randomInt(available.length), 1)[0]);
}

export function applyInitialCrime(state: GameEngineState, choose?: () => number[]): EngineResult {
  if (state.phase !== "INITIAL_CRIME") throw new Error("Not in initial crime phase");
  if (state.crimeRooms.length) throw new Error("Initial crime scenes already exist");
  const emptyRooms = gameRooms(state).filter((room) => !state.players.some((player) => player.roomNumber === room));
  if (emptyRooms.length < 3) throw new Error("Not enough empty rooms for crime scenes");
  const select = choose ?? (() => chooseThreeRooms(emptyRooms));
  let rooms: number[] | null = null;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const selected = select();
    if (selected.length !== 3 || new Set(selected).size !== 3 || !selected.every((room) => isHotelRoom(room, gameFloorCount(state)))) throw new Error("Invalid crime scene selection");
    if (selected.every((room) => emptyRooms.includes(room))) { rooms = selected; break; }
  }
  if (!rooms) throw new Error("Unable to select crime scenes");
  return { state: { ...state, crimeRooms: rooms }, publicEvents: [{ type: "CRIME_SCENES_REVEALED", roomNumbers: rooms }], privateEvents: [] };
}

export function resolveAssassination(state: GameEngineState, targetRooms: number | number[]): EngineResult {
  const rooms = Array.isArray(targetRooms) ? targetRooms : [targetRooms];
  const killer = state.players.find((player) => player.id === state.activePlayerId);
  if (state.phase !== "SKILL_PHASE" || !killer || killer.role !== "KILLER" || !killer.isAlive || state.usedSkillPlayerIds.includes(killer.id)) {
    throw new Error("Skill action is not permitted");
  }
  if (rooms.length < 1 || rooms.length > 2 || new Set(rooms).size !== rooms.length || rooms.some((room) => !isHotelRoom(room, gameFloorCount(state)))) throw new Error("Invalid target rooms");
  if (rooms.some((room) => !isSelectableRoom(state, room))) throw new Error("Room is not eligible");

  let next: GameEngineState = { ...state, usedSkillPlayerIds: [...state.usedSkillPlayerIds, killer.id] };
  const privateEvents: PrivateGameEvent[] = [];
  const publicEvents: EngineResult["publicEvents"] = [];
  for (const targetRoom of rooms) {
    let reason: "SUCCESS" | "EMPTY" | "LOCKED" | "ALREADY_DEAD" = "EMPTY";
    if (state.lockedRooms.includes(targetRoom)) reason = "LOCKED";
    else {
      const occupant = next.players.find((player) => player.roomNumber === targetRoom);
      if (!occupant) reason = "EMPTY";
      else if (!occupant.isAlive) reason = "ALREADY_DEAD";
      else {
        reason = "SUCCESS";
        const death = killPlayer(next, occupant.id, "ASSASSINATION");
        next = death.state;
        if (death.privateEvent) privateEvents.push(death.privateEvent);
      }
    }
    privateEvents.push({ type: "ASSASSINATION_RESULT", recipientPlayerId: killer.id, roomNumber: targetRoom, success: reason === "SUCCESS", reason });
    if (reason === "SUCCESS") publicEvents.push({ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม", turn: state.turn });
  }
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
  let next = state;
  const privateEvents: PrivateGameEvent[] = [];
  const nextActor = ordered.slice(previousIndex + 1).find((player) => {
    if (!player.isAlive || next.usedSkillPlayerIds.includes(player.id)) return false;
    const dark = next.darkFloors?.includes(Math.floor(player.roomNumber / 100));
    const coolingDown = player.role === "ELECTRICIAN" && next.electricianLastUsedTurn?.[player.id] === next.turn - 1;
    if (dark || coolingDown) {
      next = appendPrivateAction({ ...next, usedSkillPlayerIds: [...next.usedSkillPlayerIds, player.id] }, player.id, { turn: next.turn, type: "SKILL", message: dark ? "ใช้สกิลไม่ได้เนื่องจากไฟดับบนชั้นของคุณ" : "สกิลช่างไฟกำลังพักหนึ่งเทิร์น" });
      return false;
    }
    if (player.role === "FORMER_POLICE") {
      const killer = next.players.find((guest) => guest.role === "KILLER");
      const message = formerPoliceClue(killer?.avatarId, next.turn);
      next = appendPrivateAction({
        ...next,
        usedSkillPlayerIds: [...next.usedSkillPlayerIds, player.id],
        privateResultMessages: {
          ...next.privateResultMessages,
          [player.id]: [...(next.privateResultMessages?.[player.id] ?? []), message].slice(-100),
        },
      }, player.id, { turn: next.turn, type: "SKILL", message });
      privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: player.id, message });
      return false;
    }
    if (player.role === "RECEPTIONIST") {
      next = { ...next, usedSkillPlayerIds: [...next.usedSkillPlayerIds, player.id] };
      if (next.turn === 3) {
        const register = [...next.players].sort((left, right) => left.seatIndex - right.seatIndex)
          .map((guest) => `ผู้เล่น ${guest.seatIndex + 1} ${guest.displayName} · ห้อง ${guest.roomNumber}`).join(", ");
        const message = `ทะเบียนห้องพักเทิร์นที่ 3: ${register}`;
        next = appendPrivateAction({
          ...next,
          privateResultMessages: {
            ...next.privateResultMessages,
            [player.id]: [...(next.privateResultMessages?.[player.id] ?? []), message].slice(-100),
          },
        }, player.id, { turn: next.turn, type: "SKILL", message: "เปิดทะเบียนห้องพักแล้ว" });
        privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: player.id, message });
      }
      return false;
    }
    if (player.role === "PHOTOGRAPHER") {
      next = { ...next, usedSkillPlayerIds: [...next.usedSkillPlayerIds, player.id] };
      if (next.turn === 3) {
        const killer = next.players.find((guest) => guest.role === "KILLER");
        if (!killer) throw new Error("Killer is missing");
        const message = `ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น ${killer.seatIndex + 1} ${killer.displayName}`;
        next = appendPrivateAction({
          ...next,
          privateResultMessages: {
            ...next.privateResultMessages,
            [player.id]: [...(next.privateResultMessages?.[player.id] ?? []), message].slice(-100),
          },
        }, player.id, { turn: next.turn, type: "SKILL", message: "ตรวจภาพถ่ายแล้ว" });
        privateEvents.push({ type: "SKILL_RESULT", recipientPlayerId: player.id, message });
      }
      return false;
    }
    return true;
  });
  return {
    state: { ...next, activePlayerId: nextActor?.id ?? null },
    publicEvents: [],
    privateEvents: [...privateEvents, ...(nextActor ? [{ type: "ACTION_REQUEST" as const, recipientPlayerId: nextActor.id }] : [])],
  };
}
