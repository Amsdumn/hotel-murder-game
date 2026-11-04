import { z } from "zod";
import { LobbyError } from "../lobby/lobby-service";
import type { LobbyRecord, LobbyStore } from "../lobby/lobby-store";
import { advanceTimedSkill, createInitialGame, performSkill } from "./gameplay";
import { advanceTimedPhase, castRoomVote, projectGameResult } from "./phases";
import { projectMurdererTeamState, projectPrivatePlayerState, projectPublicState } from "./projections";
import { appendPrivateAction, type EngineResult, type GameEngineState } from "./state";

const commandSchema = z.object({ actionId: z.uuid(), expectedVersion: z.number().int().nonnegative() });
const skillSchema = commandSchema.extend({ target: z.union([z.number(), z.string()]) });
const voteSchema = commandSchema.extend({ roomNumber: z.number().int() });

export class GameService {
  constructor(private readonly store: LobbyStore) {}

  async snapshot(code: string, playerId: string) {
    const record = await this.store.findLobby(code);
    if (!record?.gameState || !record.players.some((player) => player.id === playerId)) return null;
    const state = record.gameState;
    const player = state.players.find((item) => item.id === playerId)!;
    return { publicState: projectPublicState(state), privateState: projectPrivatePlayerState(state, playerId), teamState: player.isAlive && player.team === "MURDERER" ? projectMurdererTeamState(state, playerId) : null, result: state.phase === "FINISHED" ? projectGameResult(state) : null };
  }

  private async commit(record: LobbyRecord, actionId: string, outcome: EngineResult): Promise<EngineResult> {
    const newPhase = !record.gameState || record.gameState.phase !== outcome.state.phase || record.gameState.turn !== outcome.state.turn || JSON.stringify(record.gameState.runoffRooms ?? []) !== JSON.stringify(outcome.state.runoffRooms ?? []);
    const state: GameEngineState = { ...outcome.state, version: record.version + 1, phaseStartVersion: newPhase ? record.version + 1 : record.gameState?.phaseStartVersion ?? record.version + 1 };
    const next: LobbyRecord = { ...record, version: record.version + 1, phase: state.phase, gameState: state, appliedActionIds: [...record.appliedActionIds, actionId] };
    if (!await this.store.replaceLobby(record.code, record.version, next)) throw new LobbyError("STALE_STATE");
    return { ...outcome, state };
  }

  private async record(code: string, playerId: string, input: unknown, allowStale = false): Promise<{ record: LobbyRecord; actionId: string }> {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    const record = await this.store.findLobby(code);
    if (!record || !record.players.some((player) => player.id === playerId)) throw new LobbyError("INVALID_SESSION");
    if (record.appliedActionIds.includes(parsed.data.actionId)) throw new LobbyError("DUPLICATE_ACTION");
    if (allowStale ? parsed.data.expectedVersion > record.version || parsed.data.expectedVersion < (record.gameState?.phaseStartVersion ?? record.version) : record.version !== parsed.data.expectedVersion) throw new LobbyError("STALE_STATE");
    return { record, actionId: parsed.data.actionId };
  }

  async start(code: string, playerId: string, input: unknown): Promise<EngineResult> {
    const { record, actionId } = await this.record(code, playerId, input);
    if (record.phase !== "LOBBY" || record.hostPlayerId !== playerId || record.players.length < 5 || !record.players.every((player) => player.ready && player.connected)) throw new LobbyError("FORBIDDEN");
    const result = createInitialGame(code, record.players, record.version + 1);
    return this.commit(record, actionId, result);
  }

  async skill(code: string, playerId: string, input: unknown, now = Date.now()): Promise<EngineResult> {
    const parsed = skillSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    const { record, actionId } = await this.record(code, playerId, input, true);
    if (!record.gameState) throw new LobbyError("FORBIDDEN");
    const state = record.gameState;
    const missedTurn = state.privateActionHistory?.[playerId]?.some((entry) => entry.turn === state.turn && entry.type === "SKILL" && entry.message === "หมดเวลาใช้สกิล");
    if (missedTurn || (state.phase === "SKILL_PHASE" && state.activePlayerId === playerId && state.phaseDeadlineAt !== undefined && now >= state.phaseDeadlineAt)) throw new LobbyError("SKILL_EXPIRED");
    let result: EngineResult;
    try { result = performSkill(record.gameState, playerId, parsed.data.target, now, record.discussionSeconds); }
    catch { throw new LobbyError("FORBIDDEN"); }
    const privateResult = result.privateEvents.find((event) => event.recipientPlayerId === playerId && (event.type === "SKILL_RESULT" || event.type === "ASSASSINATION_RESULT"));
    const message = privateResult?.type === "SKILL_RESULT"
      ? `ใช้สกิล: ${privateResult.message}`
      : privateResult?.type === "ASSASSINATION_RESULT"
        ? `ลอบสังหารห้อง ${parsed.data.target}: ${privateResult.success ? "สำเร็จ" : "ไม่สำเร็จ"}`
        : "ใช้สกิล";
    result = { ...result, state: appendPrivateAction(result.state, playerId, { turn: record.gameState.turn, type: "SKILL", message }) };
    return this.commit(record, actionId, result);
  }

  async vote(code: string, playerId: string, input: unknown): Promise<EngineResult> {
    const parsed = voteSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { record, actionId } = await this.record(code, playerId, input, true);
      if (!record.gameState) throw new LobbyError("FORBIDDEN");
      let result: EngineResult;
      try { result = castRoomVote(record.gameState, playerId, parsed.data.roomNumber); }
      catch { throw new LobbyError("FORBIDDEN"); }
      result = { ...result, state: appendPrivateAction(result.state, playerId, {
        turn: record.gameState.turn, type: "VOTE",
        message: `${record.gameState.runoffRooms?.length ? "โหวตตัดสิน" : "โหวต"}ห้อง ${parsed.data.roomNumber}`,
      }) };
      try { return await this.commit(record, actionId, result); }
      catch (error) {
        if (!(error instanceof LobbyError) || error.code !== "STALE_STATE") throw error;
      }
    }
    throw new LobbyError("STALE_STATE");
  }

  async advanceDue(now = Date.now()): Promise<EngineResult[]> {
    const due = await this.store.listDueGames(now);
    const outcomes: EngineResult[] = [];
    for (const record of due) {
      if (!record.gameState) continue;
      const result = record.gameState.phase === "SKILL_PHASE" ? advanceTimedSkill(record.gameState, now, record.discussionSeconds) : advanceTimedPhase(record.gameState, now);
      if (result.state === record.gameState) continue;
      try { outcomes.push(await this.commit(record, `timer:${record.version}`, result)); }
      catch (error) { if (!(error instanceof LobbyError) || error.code !== "STALE_STATE") throw error; }
    }
    return outcomes;
  }
}
