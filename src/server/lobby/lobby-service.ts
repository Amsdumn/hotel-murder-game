import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { LobbyIdentity, LobbyView, LobbyErrorCode, PublicLobbySummary } from "../../types/lobby";
import { INNOCENT_ROLES, ROLE_ORDER } from "../../types/game";
import { requiredInnocentRoleCount } from "../../lib/game-balance";
import type { LobbyEventRecord, LobbyRecord, LobbyStore, SessionRecord } from "./lobby-store";

const nameSchema = z.string().trim().min(2).max(256).refine((name) => !/[\x00-\x1f\x7f]/.test(name));
const actionIdSchema = z.uuid();
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/);
const createSchema = z.object({ displayName: nameSchema, actionId: actionIdSchema });
const joinSchema = createSchema.extend({ code: codeSchema, expectedVersion: z.number().int().nonnegative() });
const readySchema = z.object({ actionId: actionIdSchema, expectedVersion: z.number().int().nonnegative(), ready: z.boolean() });
const configSchema = z.object({ actionId: actionIdSchema, expectedVersion: z.number().int().nonnegative(), playerLimit: z.number().int().min(5).max(10), discussionSeconds: z.number().int().min(30).max(420).refine((seconds) => seconds % 30 === 0), selectedInnocentRoles: z.array(z.enum(ROLE_ORDER)).max(INNOCENT_ROLES.length).refine((roles) => roles.every((role) => INNOCENT_ROLES.includes(role)) && new Set(roles).size === roles.length).optional() });
const renameSchema = z.object({ actionId: actionIdSchema, expectedVersion: z.number().int().nonnegative(), displayName: nameSchema });
const kickSchema = z.object({ actionId: actionIdSchema, expectedVersion: z.number().int().nonnegative(), playerId: z.uuid() });

export class LobbyError extends Error {
  constructor(public readonly code: LobbyErrorCode) { super(code); }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new LobbyError("INVALID_INPUT");
  return result.data;
}

function makeToken(): string { return randomBytes(32).toString("hex"); }
function hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
}

function project(record: LobbyRecord): LobbyView {
  return {
    code: record.code,
    version: record.version,
    hostPlayerId: record.hostPlayerId,
    playerLimit: record.playerLimit,
    discussionSeconds: record.discussionSeconds,
    selectedInnocentRoles: [...(record.selectedInnocentRoles ?? [])],
    canStart: record.phase === "LOBBY" && record.players.length >= 5 && record.players.every((player) => player.ready && player.connected) && (record.selectedInnocentRoles === undefined || record.selectedInnocentRoles.length === requiredInnocentRoleCount(record.playerLimit)),
    players: record.players.map(({ id, displayName, seatIndex, ready, connected }) => ({ id, displayName, seatIndex, ready: record.phase === "LOBBY" && ready, connected: record.phase === "LOBBY" ? connected : true })),
  };
}

export class LobbyService {
  constructor(private readonly store: LobbyStore) {}

  async cleanupUnusedRooms(cutoff: number, isOccupied: (code: string) => boolean): Promise<string[]> {
    const removed: string[] = [];
    for (const code of await this.store.listStaleLobbies(cutoff)) {
      if (!isOccupied(code) && await this.store.deleteStaleLobby(code, cutoff)) removed.push(code);
    }
    return removed;
  }

  async setRoomEmptySince(code: string, since: number | null): Promise<void> {
    await this.store.setRoomEmptySince(code, since);
  }

  async listRooms(): Promise<PublicLobbySummary[]> {
    const rooms = await this.store.listActiveLobbies();
    return rooms.map(({ code, phase, playerCount, playerLimit }) => ({
      code,
      playerCount,
      playerLimit,
      status: phase === "LOBBY" ? "WAITING" : "IN_PROGRESS",
    }));
  }

  private async event(record: LobbyEventRecord): Promise<void> {
    try { await this.store.appendEvent(record); }
    catch (error) { console.error("Lobby event audit write failed", error); }
  }

  async create(input: unknown): Promise<LobbyIdentity> {
    const { displayName, actionId } = parse(createSchema, input);
    const playerId = randomUUID();
    const token = makeToken();
    let record: LobbyRecord | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate: LobbyRecord = {
        code: makeCode(), phase: "LOBBY", version: 0, creationActionId: actionId,
        hostPlayerId: playerId, playerLimit: 10, discussionSeconds: 180, selectedInnocentRoles: [],
        players: [{ id: playerId, displayName, seatIndex: 0, ready: false, connected: true }],
        appliedActionIds: [actionId],
      };
      try { await this.store.createLobby(candidate); record = candidate; break; }
      catch (error) {
        if (!(error instanceof LobbyError) || error.code !== "CODE_COLLISION") throw error;
        if (attempt === 4) throw new LobbyError("SERVER_UNAVAILABLE");
      }
    }
    if (!record) throw new LobbyError("SERVER_UNAVAILABLE");
    const session: SessionRecord = { id: randomUUID(), gameCode: record.code, playerId, tokenHash: hashToken(token) };
    try { await this.store.createSession(session); }
    catch (error) { await this.store.deleteLobby(record.code); throw error; }
    await this.event({ gameCode: record.code, actorId: playerId, actionId, kind: "LOBBY_CREATED", payload: { displayName } });
    return { code: record.code, playerId, token, view: project(record) };
  }

  async preview(rawCode: unknown): Promise<LobbyView> {
    const code = parse(codeSchema, rawCode);
    const record = await this.store.findLobby(code);
    if (!record) throw new LobbyError("LOBBY_NOT_FOUND");
    return project(record);
  }

  async join(input: unknown): Promise<LobbyIdentity> {
    const { code, displayName, actionId, expectedVersion } = parse(joinSchema, input);
    const current = await this.store.findLobby(code);
    if (!current) throw new LobbyError("LOBBY_NOT_FOUND");
    if (current.phase !== "LOBBY") throw new LobbyError("FORBIDDEN");
    if (current.appliedActionIds.includes(actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (current.version !== expectedVersion) throw new LobbyError("STALE_STATE");
    if (current.players.length >= current.playerLimit) throw new LobbyError("LOBBY_FULL");
    const playerId = randomUUID();
    const token = makeToken();
    const session: SessionRecord = { id: randomUUID(), gameCode: code, playerId, tokenHash: hashToken(token) };
    await this.store.createSession(session);
    const next: LobbyRecord = {
      ...current, version: current.version + 1,
      emptySince: undefined,
      players: [...current.players, { id: playerId, displayName, seatIndex: current.players.length, ready: false, connected: true }],
      appliedActionIds: [...current.appliedActionIds, actionId].slice(-10000),
    };
    let saved = false;
    try { saved = await this.store.replaceLobby(code, expectedVersion, next); }
    catch (error) { await this.store.deleteSession(session.id); throw error; }
    if (!saved) { await this.store.deleteSession(session.id); throw new LobbyError("STALE_STATE"); }
    await this.event({ gameCode: code, actorId: playerId, actionId, kind: "PLAYER_JOINED", payload: { displayName } });
    return { code, playerId, token, view: project(next) };
  }

  private async actor(playerId: string): Promise<{ session: SessionRecord; lobby: LobbyRecord }> {
    const session = await this.store.findSessionByPlayerId(playerId);
    if (!session) throw new LobbyError("INVALID_SESSION");
    const lobby = await this.store.findLobby(session.gameCode);
    if (!lobby || !lobby.players.some((player) => player.id === playerId)) throw new LobbyError("INVALID_SESSION");
    return { session, lobby };
  }

  async setReady(playerId: string, input: unknown): Promise<LobbyView> {
    const { actionId, expectedVersion, ready } = parse(readySchema, input);
    const { session, lobby } = await this.actor(playerId);
    if (lobby.phase !== "LOBBY") throw new LobbyError("FORBIDDEN");
    if (lobby.appliedActionIds.includes(actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (lobby.version !== expectedVersion) throw new LobbyError("STALE_STATE");
    const next: LobbyRecord = {
      ...lobby, version: lobby.version + 1,
      players: lobby.players.map((player) => player.id === playerId ? { ...player, ready } : player),
      appliedActionIds: [...lobby.appliedActionIds, actionId].slice(-10000),
    };
    if (!await this.store.replaceLobby(session.gameCode, expectedVersion, next)) throw new LobbyError("STALE_STATE");
    await this.event({ gameCode: session.gameCode, actorId: playerId, actionId, kind: "READY_CHANGED", payload: { ready } });
    return project(next);
  }

  async configure(playerId: string, input: unknown): Promise<LobbyView> {
    const { actionId, expectedVersion, playerLimit, discussionSeconds, selectedInnocentRoles } = parse(configSchema, input);
    const { session, lobby } = await this.actor(playerId);
    if (lobby.phase !== "LOBBY") throw new LobbyError("FORBIDDEN");
    if (lobby.hostPlayerId !== playerId) throw new LobbyError("FORBIDDEN");
    if (lobby.appliedActionIds.includes(actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (lobby.version !== expectedVersion) throw new LobbyError("STALE_STATE");
    const roles = selectedInnocentRoles ?? lobby.selectedInnocentRoles;
    if (playerLimit < lobby.players.length || (roles !== undefined && roles.length > requiredInnocentRoleCount(playerLimit))) throw new LobbyError("INVALID_INPUT");
    const next: LobbyRecord = { ...lobby, version: lobby.version + 1, playerLimit, discussionSeconds, selectedInnocentRoles: roles, appliedActionIds: [...lobby.appliedActionIds, actionId].slice(-10000) };
    if (!await this.store.replaceLobby(session.gameCode, expectedVersion, next)) throw new LobbyError("STALE_STATE");
    await this.event({ gameCode: session.gameCode, actorId: playerId, actionId, kind: "CONFIG_CHANGED", payload: { playerLimit, discussionSeconds, innocentRoleCount: next.selectedInnocentRoles?.length ?? 0 } });
    return project(next);
  }

  async rename(playerId: string, input: unknown): Promise<LobbyView> {
    const { actionId, expectedVersion, displayName } = parse(renameSchema, input);
    const { session, lobby } = await this.actor(playerId);
    if (lobby.phase !== "LOBBY") throw new LobbyError("FORBIDDEN");
    if (lobby.appliedActionIds.includes(actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (lobby.version !== expectedVersion) throw new LobbyError("STALE_STATE");
    const next: LobbyRecord = { ...lobby, version: lobby.version + 1, players: lobby.players.map((player) => player.id === playerId ? { ...player, displayName } : player), appliedActionIds: [...lobby.appliedActionIds, actionId].slice(-10000) };
    if (!await this.store.replaceLobby(session.gameCode, expectedVersion, next)) throw new LobbyError("STALE_STATE");
    await this.event({ gameCode: session.gameCode, actorId: playerId, actionId, kind: "PLAYER_RENAMED", payload: { displayName } });
    return project(next);
  }

  async kick(playerId: string, input: unknown): Promise<LobbyView> {
    const { actionId, expectedVersion, playerId: targetId } = parse(kickSchema, input);
    const { session, lobby } = await this.actor(playerId);
    if (lobby.phase !== "LOBBY" || lobby.hostPlayerId !== playerId) throw new LobbyError("FORBIDDEN");
    if (targetId === playerId || !lobby.players.some((player) => player.id === targetId)) throw new LobbyError("INVALID_INPUT");
    if (lobby.appliedActionIds.includes(actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (lobby.version !== expectedVersion) throw new LobbyError("STALE_STATE");
    const targetSession = await this.store.findSessionByPlayerId(targetId);
    const next: LobbyRecord = { ...lobby, version: lobby.version + 1, players: lobby.players.filter((player) => player.id !== targetId).map((player, seatIndex) => ({ ...player, seatIndex })), appliedActionIds: [...lobby.appliedActionIds, actionId].slice(-10000) };
    if (!await this.store.replaceLobby(session.gameCode, expectedVersion, next)) throw new LobbyError("STALE_STATE");
    if (targetSession) await this.store.deleteSession(targetSession.id);
    await this.event({ gameCode: session.gameCode, actorId: playerId, actionId, kind: "PLAYER_KICKED", payload: { playerId: targetId } });
    return project(next);
  }

  async resume(rawCode: unknown, rawToken: unknown): Promise<LobbyIdentity> {
    const code = parse(codeSchema, rawCode);
    if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) throw new LobbyError("INVALID_SESSION");
    const session = await this.store.findSessionByTokenHash(hashToken(rawToken));
    if (!session || session.gameCode !== code) throw new LobbyError("INVALID_SESSION");
    const view = await this.setConnected(session.playerId, true);
    await this.store.setRoomEmptySince(code, null);
    return { code, playerId: session.playerId, token: rawToken, view };
  }

  async setConnected(playerId: string, connected: boolean): Promise<LobbyView> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { session, lobby } = await this.actor(playerId);
      if (lobby.phase !== "LOBBY") return project(lobby);
      const current = lobby.players.find((player) => player.id === playerId)!;
      if (current.connected === connected) return project(lobby);
      const next: LobbyRecord = { ...lobby, version: lobby.version + 1, players: lobby.players.map((player) => player.id === playerId ? { ...player, connected } : player) };
      if (await this.store.replaceLobby(session.gameCode, lobby.version, next)) return project(next);
    }
    throw new LobbyError("STALE_STATE");
  }
}
