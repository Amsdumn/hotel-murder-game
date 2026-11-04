import type { GamePhase, Role, Team } from "../../types/game";

export interface EnginePlayer {
  id: string;
  displayName: string;
  seatIndex: number;
  role: Role;
  team: Team;
  roomNumber: number;
  isAlive: boolean;
}

export interface DeathNotice {
  cause: "INITIAL_CRIME" | "ASSASSINATION" | "VOTE";
  turn: number;
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
  activePlayerId: string | null;
  usedSkillPlayerIds: string[];
  votes: Record<string, number>;
  winner: Team | null;
  deathNotices: Record<string, DeathNotice>;
  phaseDeadlineAt?: number;
  runoffRooms?: number[];
  publicHistory?: PublicGameEvent[];
  privateResultMessages?: Record<string, string[]>;
  phaseStartVersion?: number;
}

export type PublicGameEvent =
  | { type: "CRIME_SCENES_REVEALED"; roomNumbers: number[] }
  | { type: "MURDER_OCCURRED"; message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม"; turn: number }
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

export const HOTEL_ROOMS = Array.from({ length: 7 }, (_, floor) =>
  Array.from({ length: 3 }, (_, room) => (floor + 1) * 100 + room + 1),
).flat();

export function isHotelRoom(roomNumber: number): boolean {
  const floor = Math.floor(roomNumber / 100);
  const room = roomNumber % 100;
  return Number.isInteger(roomNumber) && floor >= 1 && floor <= 7 && room >= 1 && room <= 3;
}

export function killPlayer(state: GameEngineState, playerId: string, cause: DeathNotice["cause"]): { state: GameEngineState; privateEvent: PrivateGameEvent | null } {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || !player.isAlive) return { state, privateEvent: null };
  const winner = player.role === "KILLER" ? "INNOCENT" : state.winner;
  return {
    state: {
      ...state,
      players: state.players.map((item) => item.id === playerId ? { ...item, isAlive: false } : item),
      deathNotices: { ...state.deathNotices, [playerId]: { cause, turn: state.turn } },
      winner,
      phase: winner ? "FINISHED" : state.phase,
    },
    privateEvent: { type: "DEATH_NOTICE", recipientPlayerId: playerId, cause, turn: state.turn },
  };
}
