import { connectDatabase } from "./connect";
import { GameEventModel, GameModel, PlayerSessionModel } from "./models";
import { LobbyError } from "../lobby/lobby-service";
import type { ActiveLobbySummaryRecord, LobbyEventRecord, LobbyRecord, LobbyStore, SessionRecord } from "../lobby/lobby-store";

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function isIndexNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 27;
}

let removeLegacyRoomLimit: Promise<void> | null = null;

function ensureRoomLimitRemoved(): Promise<void> {
  if (!removeLegacyRoomLimit) {
    removeLegacyRoomLimit = (async () => {
      await GameModel.init();
      try { await GameModel.collection.dropIndex("activeSlot_1"); }
      catch (error) { if (!isIndexNotFound(error)) throw error; }
      await GameModel.collection.updateMany({ activeSlot: { $exists: true } }, { $unset: { activeSlot: "" } });
    })().catch((error: unknown) => { removeLegacyRoomLimit = null; throw error; });
  }
  return removeLegacyRoomLimit;
}

export class MongoLobbyStore implements LobbyStore {
  async listStaleLobbies(cutoff: number): Promise<string[]> {
    await connectDatabase();
    const records = await GameModel.find({ $or: [
      { emptySince: { $lte: cutoff } },
      { phase: "FINISHED", updatedAt: { $lte: new Date(cutoff) } },
    ] }).select("code").lean().exec();
    return records.map((record) => record.code);
  }

  async deleteStaleLobby(code: string, cutoff: number): Promise<boolean> {
    await connectDatabase();
    const removed = await GameModel.deleteOne({ code, $or: [
      { emptySince: { $lte: cutoff } },
      { phase: "FINISHED", updatedAt: { $lte: new Date(cutoff) } },
    ] }).exec();
    if (removed.deletedCount !== 1) return false;
    await Promise.all([PlayerSessionModel.deleteMany({ gameCode: code }).exec(), GameEventModel.deleteMany({ gameCode: code }).exec()]);
    return true;
  }

  async setRoomEmptySince(code: string, since: number | null): Promise<void> {
    await connectDatabase();
    if (since === null) await GameModel.updateOne({ code, emptySince: { $exists: true } }, { $unset: { emptySince: 1 } }).exec();
    else await GameModel.updateOne({ code, emptySince: { $exists: false } }, { $set: { emptySince: since } }).exec();
  }

  async listActiveLobbies(): Promise<ActiveLobbySummaryRecord[]> {
    await connectDatabase();
    return GameModel.aggregate<ActiveLobbySummaryRecord>([
      { $match: { phase: { $ne: "FINISHED" } } },
      { $project: { _id: 0, code: 1, phase: 1, playerCount: { $size: "$players" }, playerLimit: 1 } },
    ]).exec();
  }

  async createLobby(record: LobbyRecord): Promise<void> {
    await connectDatabase();
    await ensureRoomLimitRemoved();
    try { await GameModel.create(record); }
    catch (error) {
      if (isDuplicateKey(error)) {
        const previous = await GameModel.findOne({ creationActionId: record.creationActionId }).lean().exec();
        if (previous) throw new LobbyError("DUPLICATE_ACTION");
        throw new LobbyError("CODE_COLLISION");
      }
      throw error;
    }
  }

  async deleteLobby(code: string): Promise<void> {
    await connectDatabase();
    await GameModel.deleteOne({ code }).exec();
  }

  async findLobby(code: string): Promise<LobbyRecord | null> {
    await connectDatabase();
    const record = await GameModel.findOne({ code }).lean().exec();
    return record ? {
      code: record.code, ...(record.emptySince !== undefined ? { emptySince: record.emptySince } : {}), phase: record.phase, version: record.version,
      creationActionId: record.creationActionId, hostPlayerId: record.hostPlayerId,
      playerLimit: record.playerLimit, discussionSeconds: record.discussionSeconds,
      players: record.players.map(({ id, displayName, seatIndex, ready, connected, avatarId }) => ({ id, displayName, seatIndex, ready, connected, avatarId })),
      appliedActionIds: [...record.appliedActionIds],
      ...(record.gameState ? { gameState: record.gameState } : {}),
    } : null;
  }

  async replaceLobby(code: string, expectedVersion: number, next: LobbyRecord): Promise<boolean> {
    await connectDatabase();
    const result = await GameModel.replaceOne({ code, version: expectedVersion }, next).exec();
    return result.modifiedCount === 1;
  }

  async createSession(record: SessionRecord): Promise<void> {
    await connectDatabase();
    await PlayerSessionModel.init();
    await PlayerSessionModel.create(record);
  }

  async deleteSession(id: string): Promise<void> {
    await connectDatabase();
    await PlayerSessionModel.deleteOne({ id }).exec();
  }

  async findSessionByPlayerId(playerId: string): Promise<SessionRecord | null> {
    await connectDatabase();
    const record = await PlayerSessionModel.findOne({ playerId }).lean().exec();
    return record ? { id: record.id, gameCode: record.gameCode, playerId: record.playerId, tokenHash: record.tokenHash } : null;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    await connectDatabase();
    const record = await PlayerSessionModel.findOne({ tokenHash }).lean().exec();
    return record ? { id: record.id, gameCode: record.gameCode, playerId: record.playerId, tokenHash: record.tokenHash } : null;
  }


  async appendEvent(record: LobbyEventRecord): Promise<void> {
    await connectDatabase();
    await GameEventModel.init();
    await GameEventModel.create(record);
  }

  async listDueGames(now: number): Promise<LobbyRecord[]> {
    await connectDatabase();
    const records = await GameModel.find({ $or: [
      { phase: { $in: ["ROLE_REVEAL", "SKILL_PHASE", "DISCUSSION", "VOTING", "RESOLUTION"] }, "gameState.phaseDeadlineAt": { $lte: now } },
      { phase: "VOTING", "gameState.phaseDeadlineAt": { $exists: false } },
    ] }).select("code").lean().exec();
    const games = await Promise.all(records.map((record) => this.findLobby(record.code)));
    return games.filter((game): game is LobbyRecord => game !== null);
  }
}
