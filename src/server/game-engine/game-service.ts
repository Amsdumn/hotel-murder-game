import { z } from "zod";
import { requiredInnocentRoleCount } from "../../lib/game-balance";
import { LobbyError } from "../lobby/lobby-service";
import type { LobbyRecord, LobbyStore } from "../lobby/lobby-store";
import { advancePrologue, advanceTimedSkill, createInitialGame, performSkill } from "./gameplay";
import { advanceTimedPhase, castRoomVote, projectGameResult } from "./phases";
import { projectMurdererTeamState, projectPrivatePlayerState, projectPublicState } from "./projections";
import { appendPrivateAction, type EngineResult, type GameEngineState, type PrivateGameEvent } from "./state";

const commandSchema = z.object({ actionId: z.uuid(), expectedVersion: z.number().int().nonnegative() });
const skillSchema = commandSchema.extend({ target: z.union([z.number(), z.string(), z.tuple([z.number().int(), z.number().int()]), z.tuple([z.string(), z.string()])]) });
const voteSchema = commandSchema.extend({ roomNumber: z.number().int() });
const chatSchema = commandSchema.extend({ channel: z.enum(["PUBLIC", "MURDERER"]), text: z.string().trim().min(1).max(300) });

export class GameService {
  constructor(private readonly store: LobbyStore) {}

  async snapshot(code: string, playerId: string) {
    const record = await this.store.findLobby(code);
    if (!record?.gameState || !record.players.some((player) => player.id === playerId)) return null;
    const state = record.gameState;
    const player = state.players.find((item) => item.id === playerId)!;
    return { publicState: projectPublicState(state), privateState: projectPrivatePlayerState(state, playerId), teamState: { version: state.version, teamState: player.isAlive && player.team === "MURDERER" ? projectMurdererTeamState(state, playerId) : null }, result: state.phase === "FINISHED" ? projectGameResult(state) : null };
  }

  private async commit(record: LobbyRecord, actionId: string, outcome: EngineResult): Promise<EngineResult> {
    const newPhase = !record.gameState || record.gameState.phase !== outcome.state.phase || record.gameState.turn !== outcome.state.turn || JSON.stringify(record.gameState.runoffRooms ?? []) !== JSON.stringify(outcome.state.runoffRooms ?? []);
    const state: GameEngineState = { ...outcome.state, version: record.version + 1, phaseStartVersion: newPhase ? record.version + 1 : record.gameState?.phaseStartVersion ?? record.version + 1 };
    const next: LobbyRecord = { ...record, version: record.version + 1, phase: state.phase, gameState: state, appliedActionIds: [...record.appliedActionIds, actionId].slice(-10000) };
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
    if (record.phase !== "LOBBY" || record.hostPlayerId !== playerId || record.players.length < 5 || !record.players.every((player) => player.ready && player.connected) || (record.innocentRoleMode !== "RANDOM" && record.selectedInnocentRoles !== undefined && record.selectedInnocentRoles.length !== requiredInnocentRoleCount(record.playerLimit))) throw new LobbyError("FORBIDDEN");
    const result = createInitialGame(code, record.players, record.version + 1, undefined, undefined, record.innocentRoleMode === "RANDOM" ? undefined : record.selectedInnocentRoles);
    return this.commit(record, actionId, result);
  }

  async skill(code: string, playerId: string, input: unknown, now = Date.now()): Promise<EngineResult> {
    const parsed = skillSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { record, actionId } = await this.record(code, playerId, input, true);
      if (!record.gameState) throw new LobbyError("FORBIDDEN");
      const state = record.gameState;
      const missedTurn = state.privateActionHistory?.[playerId]?.some((entry) => entry.turn === state.turn && entry.type === "SKILL" && entry.message === "หมดเวลาใช้สกิล");
      if (missedTurn || (state.phase === "SKILL_PHASE" && state.activePlayerId === playerId && state.phaseDeadlineAt !== undefined && now >= state.phaseDeadlineAt)) throw new LobbyError("SKILL_EXPIRED");
      let result: EngineResult;
      try { result = performSkill(state, playerId, parsed.data.target, now, record.discussionSeconds); }
      catch { throw new LobbyError("FORBIDDEN"); }
      const privateResult = result.privateEvents.find((event) => event.recipientPlayerId === playerId && (event.type === "SKILL_RESULT" || event.type === "ASSASSINATION_RESULT"));
      const assassinationResults = result.privateEvents.filter((event): event is Extract<PrivateGameEvent, { type: "ASSASSINATION_RESULT" }> => event.type === "ASSASSINATION_RESULT" && event.recipientPlayerId === playerId);
      const message = assassinationResults.length > 1
        ? `ลอบสังหาร: ${assassinationResults.map((event) => `${event.roomNumber} ${event.success ? "สำเร็จ" : "ไม่สำเร็จ"}`).join(", ")}`
        : privateResult?.type === "SKILL_RESULT"
        ? `ใช้สกิล: ${privateResult.message}`
        : privateResult?.type === "ASSASSINATION_RESULT"
          ? `ลอบสังหารห้อง ${privateResult.roomNumber ?? parsed.data.target}: ${privateResult.success ? "สำเร็จ" : "ไม่สำเร็จ"}`
          : "ใช้สกิล";
      result = { ...result, state: appendPrivateAction(result.state, playerId, { turn: state.turn, type: "SKILL", message }) };
      try { return await this.commit(record, actionId, result); }
      catch (error) {
        if (!(error instanceof LobbyError) || error.code !== "STALE_STATE") throw error;
      }
    }
    throw new LobbyError("STALE_STATE");
  }

  async vote(code: string, playerId: string, input: unknown, now = Date.now()): Promise<EngineResult> {
    const parsed = voteSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { record, actionId } = await this.record(code, playerId, input, true);
      if (!record.gameState) throw new LobbyError("FORBIDDEN");
      if (record.gameState.phase === "VOTING" && record.gameState.phaseDeadlineAt !== undefined && now >= record.gameState.phaseDeadlineAt) throw new LobbyError("VOTE_EXPIRED");
      if (record.gameState.lastVoteAt?.[playerId] !== undefined && now - record.gameState.lastVoteAt[playerId] < 1000) throw new LobbyError("RATE_LIMITED");
      let result: EngineResult;
      try { result = castRoomVote(record.gameState, playerId, parsed.data.roomNumber, now); }
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

  async chat(code: string, playerId: string, input: unknown, now = Date.now()): Promise<EngineResult> {
    const parsed = chatSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const { record, actionId } = await this.record(code, playerId, input, true);
      const state = record.gameState;
      const sender = state?.players.find((player) => player.id === playerId);
      if (!state || !sender?.isAlive) throw new LobbyError("FORBIDDEN");
      const publicChat = parsed.data.channel === "PUBLIC";
      const activeActor = state.players.find((player) => player.id === state.activePlayerId);
      const allowed = publicChat
        ? state.phase === "DISCUSSION"
        : state.phase === "SKILL_PHASE" && sender.team === "MURDERER" && state.players.filter((player) => player.team === "MURDERER").length > 1 && activeActor?.team === "MURDERER";
      if (!allowed) throw new LobbyError("FORBIDDEN");
      if (state.phaseDeadlineAt === undefined || now >= state.phaseDeadlineAt) throw new LobbyError("FORBIDDEN");
      const chatKey = `${parsed.data.channel}:${playerId}`;
      if (state.lastChatAt?.[chatKey] !== undefined && now - state.lastChatAt[chatKey] < 1000) throw new LobbyError("RATE_LIMITED");
      const message = { id: actionId, playerId, playerName: sender.displayName, turn: state.turn, text: parsed.data.text, sentAt: now };
      const next = publicChat
        ? { ...state, lastChatAt: { ...state.lastChatAt, [chatKey]: now }, publicChatMessages: [...(state.publicChatMessages ?? []), message].slice(-100) }
        : { ...state, lastChatAt: { ...state.lastChatAt, [chatKey]: now }, murdererChatMessages: [...(state.murdererChatMessages ?? []), message].slice(-100) };
      try { return await this.commit(record, actionId, { state: next, publicEvents: [], privateEvents: [] }); }
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
      const result = record.gameState.phase === "ROLE_REVEAL" ? advancePrologue(record.gameState, now, undefined, record.discussionSeconds) : record.gameState.phase === "SKILL_PHASE" ? advanceTimedSkill(record.gameState, now, record.discussionSeconds) : advanceTimedPhase(record.gameState, now, undefined, record.discussionSeconds);
      if (result.state === record.gameState) continue;
      try { outcomes.push(await this.commit(record, `timer:${record.version}`, result)); }
      catch (error) { if (!(error instanceof LobbyError) || error.code !== "STALE_STATE") throw error; }
    }
    return outcomes;
  }
}
