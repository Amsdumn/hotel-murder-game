export interface LobbyPlayerRecord {
  id: string;
  displayName: string;
  seatIndex: number;
  ready: boolean;
  connected: boolean;
  avatarId?: import("../../lib/avatars").AvatarId | null;
}

export interface LobbyRecord {
  code: string;
  activeSlot?: number;
  emptySince?: number;
  phase: import("../../types/game").GamePhase;
  version: number;
  creationActionId: string;
  hostPlayerId: string;
  playerLimit: number;
  discussionSeconds: number;
  players: LobbyPlayerRecord[];
  appliedActionIds: string[];
  gameState?: import("../game-engine/state").GameEngineState;
}

export interface ActiveLobbySummaryRecord {
  code: string;
  phase: import("../../types/game").GamePhase;
  playerCount: number;
  playerLimit: number;
}

export interface SessionRecord {
  id: string;
  gameCode: string;
  playerId: string;
  tokenHash: string;
}

export interface LobbyEventRecord {
  gameCode: string;
  actorId: string;
  actionId: string;
  kind: "LOBBY_CREATED" | "PLAYER_JOINED" | "READY_CHANGED" | "CONFIG_CHANGED" | "PLAYER_RENAMED" | "PLAYER_KICKED";
  payload: Record<string, string | number | boolean>;
}

export interface LobbyStore {
  listStaleLobbies(cutoff: number): Promise<string[]>;
  deleteStaleLobby(code: string, cutoff: number): Promise<boolean>;
  setRoomEmptySince(code: string, since: number | null): Promise<void>;
  listActiveLobbies(): Promise<ActiveLobbySummaryRecord[]>;
  createLobby(record: LobbyRecord): Promise<void>;
  deleteLobby(code: string): Promise<void>;
  findLobby(code: string): Promise<LobbyRecord | null>;
  replaceLobby(code: string, expectedVersion: number, next: LobbyRecord): Promise<boolean>;
  createSession(record: SessionRecord): Promise<void>;
  deleteSession(id: string): Promise<void>;
  findSessionByPlayerId(playerId: string): Promise<SessionRecord | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  appendEvent(record: LobbyEventRecord): Promise<void>;
  listDueGames(now: number): Promise<LobbyRecord[]>;
}
