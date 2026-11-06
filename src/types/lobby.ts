export interface LobbyPlayerView {
  id: string;
  displayName: string;
  seatIndex: number;
  ready: boolean;
  connected: boolean;
}

export interface LobbyView {
  code: string;
  version: number;
  hostPlayerId: string;
  playerLimit: number;
  discussionSeconds: number;
  selectedInnocentRoles: import("./game").Role[];
  canStart: boolean;
  players: LobbyPlayerView[];
}

export interface LobbyIdentity {
  code: string;
  playerId: string;
  token: string;
  view: LobbyView;
}

export interface PublicLobbySummary {
  code: string;
  playerCount: number;
  playerLimit: number;
  status: "WAITING" | "IN_PROGRESS";
}

export type LobbyErrorCode =
  | "INVALID_INPUT"
  | "LOBBY_NOT_FOUND"
  | "LOBBY_FULL"
  | "ROOM_LIMIT_REACHED"
  | "STALE_STATE"
  | "DUPLICATE_ACTION"
  | "CODE_COLLISION"
  | "INVALID_SESSION"
  | "FORBIDDEN"
  | "SKILL_EXPIRED"
  | "VOTE_EXPIRED"
  | "RATE_LIMITED"
  | "SERVER_UNAVAILABLE";

export type LobbyAck<T> = { ok: true; data: T } | { ok: false; error: LobbyErrorCode };
