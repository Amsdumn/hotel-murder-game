import mongoose, { Schema } from "mongoose";
import type { LobbyRecord, SessionRecord, LobbyEventRecord } from "../lobby/lobby-store";

const lobbyPlayerSchema = new Schema({
  id: { type: String, required: true },
  displayName: { type: String, required: true },
  seatIndex: { type: Number, required: true },
  ready: { type: Boolean, required: true },
  connected: { type: Boolean, required: true },
}, { _id: false });

const gameSchema = new Schema<LobbyRecord>({
  code: { type: String, required: true },
  emptySince: { type: Number, required: false },
  phase: { type: String, required: true, enum: ["LOBBY", "ROLE_REVEAL", "INITIAL_CRIME", "SKILL_PHASE", "DISCUSSION", "VOTING", "RESOLUTION", "FINISHED"] },
  version: { type: Number, required: true },
  creationActionId: { type: String, required: true },
  hostPlayerId: { type: String, required: true },
  playerLimit: { type: Number, required: true },
  discussionSeconds: { type: Number, required: true },
  players: { type: [lobbyPlayerSchema], required: true },
  appliedActionIds: { type: [String], required: true },
  gameState: { type: Schema.Types.Mixed, required: false },
}, { timestamps: true });
gameSchema.index({ code: 1 }, { unique: true });
gameSchema.index({ creationActionId: 1 }, { unique: true });

const playerSessionSchema = new Schema<SessionRecord>({
  id: { type: String, required: true },
  gameCode: { type: String, required: true },
  playerId: { type: String, required: true },
  tokenHash: { type: String, required: true },
}, { timestamps: true });
playerSessionSchema.index({ id: 1 }, { unique: true });
playerSessionSchema.index({ playerId: 1 }, { unique: true });
playerSessionSchema.index({ tokenHash: 1 }, { unique: true });
playerSessionSchema.index({ gameCode: 1 });

const gameEventSchema = new Schema<LobbyEventRecord>({
  gameCode: { type: String, required: true },
  actorId: { type: String, required: true },
  actionId: { type: String, required: true },
  kind: { type: String, required: true, enum: ["LOBBY_CREATED", "PLAYER_JOINED", "READY_CHANGED", "CONFIG_CHANGED"] },
  payload: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });
gameEventSchema.index({ gameCode: 1, actorId: 1, actionId: 1 }, { unique: true });
gameEventSchema.index({ gameCode: 1, createdAt: 1 });

export const GameModel = (mongoose.models.Game as mongoose.Model<LobbyRecord> | undefined) ?? mongoose.model<LobbyRecord>("Game", gameSchema);
export const PlayerSessionModel = (mongoose.models.PlayerSession as mongoose.Model<SessionRecord> | undefined) ?? mongoose.model<SessionRecord>("PlayerSession", playerSessionSchema);
export const GameEventModel = (mongoose.models.GameEvent as mongoose.Model<LobbyEventRecord> | undefined) ?? mongoose.model<LobbyEventRecord>("GameEvent", gameEventSchema);
