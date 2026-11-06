import type { GamePhase, Role, Team } from "../../types/game";

export interface EnginePlayer {
  id: string;
  displayName: string;
  seatIndex: number;
  avatarId?: import("../../lib/avatars").AvatarId | null;
  role: Role;
  team: Team;
  roomNumber: number;
  isAlive: boolean;
}

export interface DeathNotice {
  cause: "INITIAL_CRIME" | "ASSASSINATION" | "VOTE";
  turn: number;
}

export interface PrivateActionEntry {
  turn: number;
  type: "SKILL" | "VOTE" | "EVENT";
  message: string;
}

export interface GameEngineState {
  code: string;
  version: number;
  phase: GamePhase;
  turn: number;
  players: EnginePlayer[];
  crimeRooms: number[];
  openedRooms: number[];
  lockedRooms: number[];
  locksmithUsedRooms?: number[];
  darkFloors?: number[];
  electricianLastUsedTurn?: Record<string, number>;
  activePlayerId: string | null;
  usedSkillPlayerIds: string[];
  pendingAssassinationRoom?: number;
  assassinationTargetRoom?: number;
  votes: Record<string, number>;
  winner: Team | null;
  deathNotices: Record<string, DeathNotice>;
  phaseDeadlineAt?: number;
  runoffRooms?: number[];
  publicHistory?: PublicGameEvent[];
  privateResultMessages?: Record<string, string[]>;
  privateActionHistory?: Record<string, PrivateActionEntry[]>;
  phaseStartVersion?: number;
}

export type PublicGameEvent =
  | { type: "CRIME_SCENES_REVEALED"; roomNumbers: number[] }
  | { type: "MURDER_OCCURRED"; message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม"; turn: number }
  | { type: "PHASE_CHANGED"; phase: "SKILL_PHASE" | "DISCUSSION" | "VOTING" | "RESOLUTION"; turn: number }
  | { type: "RUNOFF_STARTED"; turn: number }
  | { type: "VOTE_CAST"; turn: number; playerName: string; roomNumber: number }
  | { type: "ROOM_OPENED"; roomNumber: number; occupancy: "EMPTY" | "OCCUPIED"; gameEnded: boolean }
  | { type: "GAME_FINISHED"; winner: Team };

export type PrivateGameEvent =
  | { type: "DEATH_NOTICE"; recipientPlayerId: string; cause: DeathNotice["cause"]; turn: number }
  | { type: "ASSASSINATION_RESULT"; recipientPlayerId: string; success: boolean; reason: "SUCCESS" | "EMPTY" | "LOCKED" | "ALREADY_DEAD" }
  | { type: "ACTION_REQUEST"; recipientPlayerId: string }
  | { type: "SKILL_RESULT"; recipientPlayerId: string; message: string };

export interface EngineResult {
  state: GameEngineState;
  publicEvents: PublicGameEvent[];
  privateEvents: PrivateGameEvent[];
}

export function appendPrivateAction(state: GameEngineState, playerId: string, entry: PrivateActionEntry): GameEngineState {
  return {
    ...state,
    privateActionHistory: {
      ...state.privateActionHistory,
      [playerId]: [...(state.privateActionHistory?.[playerId] ?? []), entry],
    },
  };
}

export function publicEventMessage(event: PublicGameEvent): string {
  if (event.type === "CRIME_SCENES_REVEALED") return `พบร่องรอยปริศนาในห้อง ${event.roomNumbers.join(", ")}`;
  if (event.type === "MURDER_OCCURRED") return event.message;
  if (event.type === "ROOM_OPENED") return `เปิดห้อง ${event.roomNumber} · ${event.occupancy === "EMPTY" ? "ห้องว่าง" : "มีผู้พัก"}`;
  if (event.type === "GAME_FINISHED") return `ฝ่าย${event.winner === "INNOCENT" ? "ผู้บริสุทธิ์" : "ฆาตกร"}ชนะ`;
  if (event.type === "RUNOFF_STARTED") return `รอบ ${event.turn}: เริ่มโหวตตัดสิน`;
  if (event.type === "VOTE_CAST") return `${event.playerName} โหวตห้อง ${event.roomNumber}`;
  const phase = event.phase === "SKILL_PHASE" ? "ใช้สกิล" : event.phase === "DISCUSSION" ? "พูดคุย" : event.phase === "VOTING" ? "ลงคะแนน" : "เฉลยผลการเปิดห้อง";
  return `รอบ ${event.turn}: เริ่มช่วง${phase}`;
}

export const HOTEL_ROOMS = Array.from({ length: 7 }, (_, floor) =>
  Array.from({ length: 3 }, (_, room) => (floor + 1) * 100 + room + 1),
).flat();

export function isHotelRoom(roomNumber: number): boolean {
  const floor = Math.floor(roomNumber / 100);
  const room = roomNumber % 100;
  return Number.isInteger(roomNumber) && floor >= 1 && floor <= 7 && room >= 1 && room <= 3;
}

export function isSelectableRoom(state: GameEngineState, roomNumber: number): boolean {
  return isHotelRoom(roomNumber)
    && !state.crimeRooms.includes(roomNumber)
    && !state.openedRooms.includes(roomNumber)
    && !state.players.some((player) => player.roomNumber === roomNumber && state.deathNotices?.[player.id]?.cause === "ASSASSINATION");
}

export function killPlayer(state: GameEngineState, playerId: string, cause: DeathNotice["cause"]): { state: GameEngineState; privateEvent: PrivateGameEvent | null } {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || !player.isAlive) return { state, privateEvent: null };
  const survivors = state.players.filter((item) => item.isAlive && item.id !== playerId);
  const murderers = survivors.filter((item) => item.team === "MURDERER").length;
  const innocents = survivors.length - murderers;
  const winner = player.role === "KILLER" ? "INNOCENT" : state.winner ?? (murderers > innocents ? "MURDERER" : null);
  return {
    state: appendPrivateAction({
      ...state,
      players: state.players.map((item) => item.id === playerId ? { ...item, isAlive: false } : item),
      deathNotices: { ...state.deathNotices, [playerId]: { cause, turn: state.turn } },
      winner,
      phase: winner ? "FINISHED" : state.phase,
    }, playerId, { turn: state.turn, type: "EVENT", message: cause === "ASSASSINATION" ? "คุณถูกลอบสังหาร" : cause === "VOTE" ? "คุณเสียชีวิตจากการเปิดห้อง" : "คุณเสียชีวิตจากที่เกิดเหตุเริ่มต้น" }),
    privateEvent: { type: "DEATH_NOTICE", recipientPlayerId: playerId, cause, turn: state.turn },
  };
}
