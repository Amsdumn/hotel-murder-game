import { randomInt } from "node:crypto";
import type { GameResultState } from "../../types/game";
import { advanceSkillTurn } from "./hidden-death";
import { gameRooms, isSelectableRoom, publicEventMessage, type EngineResult, type GameEngineState, type PublicGameEvent } from "./state";
import { resolveVoteRoom, submitVote } from "./voting";

export const VOTING_DURATION_MS = 60_000;
export const RESOLUTION_DURATION_MS = 6_000;

export function beginDiscussion(state: GameEngineState, now: number, seconds: number): EngineResult {
  if (state.phase !== "SKILL_PHASE" || state.activePlayerId || state.players.some((player) => player.isAlive && !state.usedSkillPlayerIds.includes(player.id)) || !Number.isInteger(seconds) || seconds < 30 || seconds > 600) throw new Error("Discussion cannot begin");
  const event: PublicGameEvent = { type: "PHASE_CHANGED", phase: "DISCUSSION", turn: state.turn };
  return { state: { ...state, phase: "DISCUSSION", phaseDeadlineAt: now + seconds * 1000, publicHistory: [...(state.publicHistory ?? []), event] }, publicEvents: [event], privateEvents: [] };
}

export function finishSkillPhase(state: GameEngineState, now: number, seconds: number): EngineResult {
  const next = advanceSkillTurn(state, state.activePlayerId);
  if (next.state.activePlayerId) throw new Error("Skill queue is not complete");
  return beginDiscussion(next.state, now, seconds);
}

export function advanceTimedPhase(state: GameEngineState, now: number, chooseTie: (length: number) => number = randomInt, skillSeconds = 60): EngineResult {
  if (state.phase === "VOTING" && state.phaseDeadlineAt === undefined) return { state: { ...state, phaseDeadlineAt: now + VOTING_DURATION_MS }, publicEvents: [], privateEvents: [] };
  if (state.phaseDeadlineAt === undefined || now < state.phaseDeadlineAt) return { state, publicEvents: [], privateEvents: [] };
  if (state.phase === "DISCUSSION") {
    const event: PublicGameEvent = { type: "PHASE_CHANGED", phase: "VOTING", turn: state.turn };
    return { state: { ...state, phase: "VOTING", phaseDeadlineAt: now + VOTING_DURATION_MS, votes: {}, runoffRooms: [], publicHistory: [...(state.publicHistory ?? []), event] }, publicEvents: [event], privateEvents: [] };
  }
  if (state.phase === "VOTING") return resolveBallot(state, now, chooseTie);
  if (state.phase === "RESOLUTION") {
    if (state.turn >= 4) {
      const event: PublicGameEvent = { type: "GAME_FINISHED", winner: "MURDERER" };
      return { state: { ...state, phase: "FINISHED", winner: "MURDERER", phaseDeadlineAt: undefined, publicHistory: [...(state.publicHistory ?? []), event] }, publicEvents: [event], privateEvents: [] };
    }
    const event: PublicGameEvent = { type: "PHASE_CHANGED", phase: "SKILL_PHASE", turn: state.turn + 1 };
    const next: GameEngineState = { ...state, turn: state.turn + 1, phase: "SKILL_PHASE", activePlayerId: null, usedSkillPlayerIds: [], lockedRooms: [], darkFloors: [], assassinationTargetRoom: undefined, votes: {}, runoffRooms: [], publicHistory: [...(state.publicHistory ?? []), event] };
    const first = advanceSkillTurn(next, null);
    return { state: { ...first.state, phaseDeadlineAt: now + skillSeconds * 1000 }, publicEvents: [event], privateEvents: first.privateEvents };
  }
  return { state, publicEvents: [], privateEvents: [] };
}

function leaders(votes: Record<string, number>): number[] {
  const counts = new Map<number, number>();
  for (const room of Object.values(votes)) counts.set(room, (counts.get(room) ?? 0) + 1);
  const highest = Math.max(...counts.values());
  return [...counts].filter(([, count]) => count === highest).map(([room]) => room).sort((a, b) => a - b);
}

function resolveBallot(state: GameEngineState, now: number, chooseTie: (length: number) => number): EngineResult {
  const tied = leaders(state.votes).filter((room) => isSelectableRoom(state, room));
  const candidates = tied.length ? tied : state.runoffRooms?.length ? state.runoffRooms.filter((room) => isSelectableRoom(state, room)) : gameRooms(state).filter((room) => isSelectableRoom(state, room));
  if (!candidates.length) throw new Error("No eligible rooms remain");
  if (tied.length > 1 && !state.runoffRooms?.length) {
    const event: PublicGameEvent = { type: "RUNOFF_STARTED", turn: state.turn };
    return { state: { ...state, votes: {}, runoffRooms: tied, phaseDeadlineAt: now + VOTING_DURATION_MS, publicHistory: [...(state.publicHistory ?? []), event] }, publicEvents: [event], privateEvents: [] };
  }
  const index = candidates.length > 1 ? chooseTie(candidates.length) : 0;
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) throw new Error("Invalid tie selection");
  const opened = resolveVoteRoom(state, candidates[index]);
  const publicHistory = [...(state.publicHistory ?? []), ...opened.publicEvents];
  let next: GameEngineState = { ...opened.state, votes: {}, runoffRooms: [], publicHistory };
  const publicEvents: PublicGameEvent[] = [...opened.publicEvents];
  if (next.phase !== "FINISHED") {
    const event: PublicGameEvent = { type: "PHASE_CHANGED", phase: "RESOLUTION", turn: state.turn };
    next = { ...next, phase: "RESOLUTION", phaseDeadlineAt: now + RESOLUTION_DURATION_MS, publicHistory: [...publicHistory, event] };
    publicEvents.push(event);
  }
  return { state: next, publicEvents, privateEvents: opened.privateEvents };
}

export function castRoomVote(state: GameEngineState, playerId: string, roomNumber: number, now = Date.now()): EngineResult {
  if (state.phaseDeadlineAt !== undefined && now >= state.phaseDeadlineAt) throw new Error("Voting deadline has passed");
  if (state.runoffRooms?.length && !state.runoffRooms.includes(roomNumber)) throw new Error("Room is not in the runoff");
  const submitted = submitVote(state, playerId, roomNumber);
  const voteEvent: PublicGameEvent = { type: "VOTE_CAST", turn: state.turn, playerName: state.players.find((player) => player.id === playerId)!.displayName, roomNumber };
  const voted = { ...submitted.state, publicHistory: [...(submitted.state.publicHistory ?? []), voteEvent] };
  return { state: voted, publicEvents: [voteEvent], privateEvents: [] };
}

export function projectGameResult(state: GameEngineState): GameResultState {
  if (state.phase !== "FINISHED" || !state.winner) throw new Error("Game result is unavailable");
  return {
    winner: state.winner,
    turnsPlayed: state.turn,
    players: state.players.map(({ id, displayName, avatarId, role, team, roomNumber, isAlive }) => ({ playerId: id, displayName, avatarId: avatarId ?? null, role, team, roomNumber, isAlive })),
    events: (state.publicHistory ?? []).map((event) => ({ type: event.type, message: publicEventMessage(event) })),
  };
}
