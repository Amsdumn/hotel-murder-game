export const ROLE_ORDER = [
  "LOCKSMITH",
  "HOUSEKEEPER",
  "WINDOW_CLEANER",
  "WITNESS",
  "DETECTIVE",
  "ACCOMPLICE",
  "KILLER",
] as const;

export type Role = (typeof ROLE_ORDER)[number];
export type Team = "INNOCENT" | "MURDERER";
export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "INITIAL_CRIME"
  | "SKILL_PHASE"
  | "DISCUSSION"
  | "VOTING"
  | "RESOLUTION"
  | "FINISHED";

export type RoomNumber = `${1 | 2 | 3 | 4 | 5 | 6 | 7}0${1 | 2 | 3}`;

export interface GameConfig {
  minPlayers: 5;
  maxPlayers: 10;
  discussionSeconds: number;
  crimeSceneStrategy: "THREE_EMPTY_ROOMS";
}

export interface PublicGameState {
  code: string;
  version: number;
  phase: GamePhase;
  turn: number;
  players: Array<{ id: string; displayName: string; seatIndex: number }>;
  phaseMessage: "กำลังดำเนินการสืบสวน..." | null;
  publicRooms: Array<{ roomNumber: number; state: "UNKNOWN" | "CRIME_SCENE" | "MURDERED" | "OPENED_EMPTY" | "OPENED_OCCUPIED" | "OPENED_MURDERED" }>;
  phaseDeadlineAt?: number;
  publicHistory?: Array<{ type: string; message: string }>;
  runoffRooms?: number[];
}

export interface PrivatePlayerState {
  playerId: string;
  role: Role;
  team: Team;
  roomNumber: number;
  isAlive: boolean;
  mode: "PLAYER" | "SPECTATOR";
  canUseSkill: boolean;
  canVote: boolean;
  deathNotice?: { cause: "INITIAL_CRIME" | "ASSASSINATION" | "VOTE"; turn: number };
  privateResults: string[];
}

export interface PrivateTeamState {
  teammates: Array<{ playerId: string; role: "KILLER" | "ACCOMPLICE"; roomNumber: number }>;
  privateResults: string[];
}

export interface GameResultState {
  winner: Team;
  turnsPlayed: number;
  players: Array<{ playerId: string; displayName: string; role: Role; team: Team; roomNumber: number; isAlive: boolean }>;
  events: Array<{ type: string; message: string }>;
}
