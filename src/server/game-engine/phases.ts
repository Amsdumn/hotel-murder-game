import { randomInt } from "node:crypto";
import type { GameResultState } from "../../types/game";
import { advanceSkillTurn } from "./hidden-death";
import { type EngineResult, type GameEngineState, type PublicGameEvent } from "./state";
import { resolveVoteRoom, submitVote } from "./voting";

export function beginDiscussion(state: GameEngineState, now: number, seconds: number): EngineResult {
  if (state.phase !== "SKILL_PHASE" || state.activePlayerId || state.players.some((player) => player.isAlive && !state.usedSkillPlayerIds.includes(player.id)) || !Number.isInteger(seconds) || seconds < 30 || seconds > 600) throw new Error("Discussion cannot begin");
  return { state: { ...state, phase: "DISCUSSION", phaseDeadlineAt: now + seconds * 1000 }, publicEvents: [], privateEvents: [] };
}

export function finishSkillPhase(state: GameEngineState, now: number, seconds: number): EngineResult {
  const next = advanceSkillTurn(state, state.activePlayerId);
  if (next.state.activePlayerId) throw new Error("Skill queue is not complete");
  return beginDiscussion(next.state, now, seconds);
}

export function advanceTimedPhase(state: GameEngineState, now: number): EngineResult {
  if (state.phase !== "DISCUSSION" || state.phaseDeadlineAt === undefined || now < state.phaseDeadlineAt) return { state, publicEvents: [], privateEvents: [] };
  return { state: { ...state, phase: "VOTING", phaseDeadlineAt: undefined, votes: {}, runoffRooms: [] }, publicEvents: [], privateEvents: [] };
}

function leaders(votes: Record<string, number>): number[] {
  const counts = new Map<number, number>();
  for (const room of Object.values(votes)) counts.set(room, (counts.get(room) ?? 0) + 1);
  const highest = Math.max(...counts.values());
  return [...counts].filter(([, count]) => count === highest).map(([room]) => room).sort((a, b) => a - b);
}

export function castRoomVote(state: GameEngineState, playerId: string, roomNumber: number, chooseTie: (length: number) => number = randomInt, now = Date.now()): EngineResult {
  if (state.runoffRooms?.length && !state.runoffRooms.includes(roomNumber)) throw new Error("Room is not in the runoff");
  const submitted = submitVote(state, playerId, roomNumber);
  if (!submitted.complete) return { state: submitted.state, publicEvents: [], privateEvents: [] };
  const tied = leaders(submitted.state.votes);
  if (tied.length > 1 && !state.runoffRooms?.length) {
    return { state: { ...submitted.state, votes: {}, runoffRooms: tied }, publicEvents: [], privateEvents: [] };
  }
  const index = tied.length > 1 ? chooseTie(tied.length) : 0;
  if (!Number.isInteger(index) || index < 0 || index >= tied.length) throw new Error("Invalid tie selection");
  const opened = resolveVoteRoom(submitted.state, tied[index]);
  const publicHistory = [...(state.publicHistory ?? []), ...opened.publicEvents];
  let next: GameEngineState = { ...opened.state, votes: {}, runoffRooms: [], publicHistory };
  const publicEvents: PublicGameEvent[] = [...opened.publicEvents];
  if (next.phase !== "FINISHED") {
    if (next.turn >= 4) {
      next = { ...next, phase: "FINISHED", winner: "MURDERER" };
      publicEvents.push({ type: "GAME_FINISHED", winner: "MURDERER" });
      next.publicHistory = [...publicHistory, publicEvents[publicEvents.length - 1]];
    } else {
      next = { ...next, turn: next.turn + 1, phase: "SKILL_PHASE", activePlayerId: null, usedSkillPlayerIds: [], lockedRooms: [] };
      const first = advanceSkillTurn(next, null);
      next = { ...first.state, phaseDeadlineAt: now + 60_000 };
      opened.privateEvents.push(...first.privateEvents);
    }
  }
  return { state: next, publicEvents, privateEvents: opened.privateEvents };
}

export function projectGameResult(state: GameEngineState): GameResultState {
  if (state.phase !== "FINISHED" || !state.winner) throw new Error("Game result is unavailable");
  return {
    winner: state.winner,
    turnsPlayed: state.turn,
    players: state.players.map(({ id, displayName, role, team, roomNumber, isAlive }) => ({ playerId: id, displayName, role, team, roomNumber, isAlive })),
    events: (state.publicHistory ?? []).map((event) => ({ type: event.type, message: event.type === "MURDER_OCCURRED" ? event.message : event.type === "ROOM_OPENED" ? `เปิดห้อง ${event.roomNumber}` : event.type === "CRIME_SCENES_REVEALED" ? `พบที่เกิดเหตุ ${event.roomNumbers.join(", ")}` : `ฝ่าย${event.winner}ชนะ` })),
  };
}
