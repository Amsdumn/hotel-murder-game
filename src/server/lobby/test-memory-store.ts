import { LobbyError } from "./lobby-service";
import type { ActiveLobbySummaryRecord, LobbyEventRecord, LobbyRecord, LobbyStore, SessionRecord } from "./lobby-store";

export class MemoryLobbyStore implements LobbyStore {
  private lobbies = new Map<string, LobbyRecord>();
  private updatedAt = new Map<string, number>();
  private sessions = new Map<string, SessionRecord>();
  readonly events: LobbyEventRecord[] = [];

  private isStale(record: LobbyRecord, cutoff: number): boolean {
    return (record.emptySince ?? Infinity) <= cutoff || (record.phase === "FINISHED" && (this.updatedAt.get(record.code) ?? Infinity) <= cutoff);
  }

  async listStaleLobbies(cutoff: number): Promise<string[]> {
    return [...this.lobbies.values()].filter((item) => this.isStale(item, cutoff)).map((item) => item.code);
  }
  async deleteStaleLobby(code: string, cutoff: number): Promise<boolean> {
    const room = this.lobbies.get(code);
    if (!room || !this.isStale(room, cutoff)) return false;
    this.lobbies.delete(code);
    this.updatedAt.delete(code);
    for (const [id, session] of this.sessions) if (session.gameCode === code) this.sessions.delete(id);
    this.events.splice(0, this.events.length, ...this.events.filter((event) => event.gameCode !== code));
    return true;
  }
  async setRoomEmptySince(code: string, since: number | null): Promise<void> {
    const room = this.lobbies.get(code);
    if (room) this.lobbies.set(code, since === null ? { ...room, emptySince: undefined } : { ...room, emptySince: room.emptySince ?? since });
  }
  async listActiveLobbies(): Promise<ActiveLobbySummaryRecord[]> {
    return [...this.lobbies.values()].filter((item) => item.phase !== "FINISHED").map((item) => ({ code: item.code, phase: item.phase, playerCount: item.players.length, playerLimit: item.playerLimit }));
  }
  async createLobby(record: LobbyRecord): Promise<void> {
    if ([...this.lobbies.values()].some((item) => item.creationActionId === record.creationActionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (this.lobbies.has(record.code)) throw new LobbyError("CODE_COLLISION");
    this.lobbies.set(record.code, structuredClone(record));
    this.updatedAt.set(record.code, Date.now());
  }
  async deleteLobby(code: string): Promise<void> { this.lobbies.delete(code); this.updatedAt.delete(code); }
  async findLobby(code: string): Promise<LobbyRecord | null> { return structuredClone(this.lobbies.get(code) ?? null); }
  async replaceLobby(code: string, expectedVersion: number, next: LobbyRecord): Promise<boolean> {
    if (this.lobbies.get(code)?.version !== expectedVersion) return false;
    this.lobbies.set(code, structuredClone(next));
    this.updatedAt.set(code, Date.now());
    return true;
  }
  async createSession(record: SessionRecord): Promise<void> { this.sessions.set(record.id, structuredClone(record)); }
  async deleteSession(id: string): Promise<void> { this.sessions.delete(id); }
  async findSessionByPlayerId(playerId: string): Promise<SessionRecord | null> {
    return structuredClone([...this.sessions.values()].find((item) => item.playerId === playerId) ?? null);
  }
  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return structuredClone([...this.sessions.values()].find((item) => item.tokenHash === tokenHash) ?? null);
  }
  async appendEvent(record: LobbyEventRecord): Promise<void> { this.events.push(structuredClone(record)); }
  async listDueGames(now: number): Promise<LobbyRecord[]> {
    return [...this.lobbies.values()].filter((record) => (record.gameState?.phase === "ROLE_REVEAL" || record.gameState?.phase === "DISCUSSION" || record.gameState?.phase === "SKILL_PHASE" || record.gameState?.phase === "VOTING" || record.gameState?.phase === "RESOLUTION") && ((record.gameState.phase === "VOTING" && record.gameState.phaseDeadlineAt === undefined) || (record.gameState.phaseDeadlineAt ?? Infinity) <= now)).map((record) => structuredClone(record));
  }
}
