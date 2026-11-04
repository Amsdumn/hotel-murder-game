import type { PrivatePlayerState, PrivateTeamState, PublicGameState } from "../../types/game";
import { HOTEL_ROOMS, publicEventMessage, type GameEngineState } from "./state";

export function projectPublicState(state: GameEngineState): PublicGameState {
  return {
    code: state.code,
    version: state.version,
    phase: state.phase,
    turn: state.turn,
    players: state.players.map(({ id, displayName, seatIndex }) => ({ id, displayName, seatIndex })),
    phaseMessage: state.phase === "SKILL_PHASE" ? "กำลังดำเนินการสืบสวน..." : null,
    ...(state.phase === "DISCUSSION" && state.phaseDeadlineAt !== undefined ? { phaseDeadlineAt: state.phaseDeadlineAt } : {}),
    publicHistory: (state.publicHistory ?? []).map((event) => ({ type: event.type, message: publicEventMessage(event) })),
    ...(state.runoffRooms?.length ? { runoffRooms: [...state.runoffRooms] } : {}),
    publicRooms: HOTEL_ROOMS.map((roomNumber) => {
      if (state.crimeRooms.includes(roomNumber)) return { roomNumber, state: "CRIME_SCENE" as const };
      const murdered = state.players.some((player) => player.roomNumber === roomNumber && state.deathNotices?.[player.id]?.cause === "ASSASSINATION");
      if (murdered) return { roomNumber, state: state.openedRooms.includes(roomNumber) ? "OPENED_MURDERED" as const : "MURDERED" as const };
      if (state.openedRooms.includes(roomNumber)) return { roomNumber, state: state.players.some((player) => player.roomNumber === roomNumber) ? "OPENED_OCCUPIED" as const : "OPENED_EMPTY" as const };
      return { roomNumber, state: "UNKNOWN" as const };
    }),
  };
}

export function projectPrivatePlayerState(state: GameEngineState, requesterId: string, targetId = requesterId): PrivatePlayerState {
  if (requesterId !== targetId) throw new Error("Private state access denied");
  const player = state.players.find((item) => item.id === requesterId);
  if (!player) throw new Error("Player not found");
  const deathNotice = state.deathNotices?.[player.id];
  const canUseSkill = player.isAlive && state.phase === "SKILL_PHASE" && state.activePlayerId === player.id && !state.usedSkillPlayerIds.includes(player.id);
  return {
    playerId: player.id,
    role: player.role,
    team: player.team,
    roomNumber: player.roomNumber,
    isAlive: player.isAlive,
    mode: player.isAlive ? "PLAYER" : "SPECTATOR",
    canUseSkill,
    ...(canUseSkill && state.phaseDeadlineAt !== undefined ? { skillDeadlineAt: state.phaseDeadlineAt } : {}),
    canVote: player.isAlive && state.phase === "VOTING" && !Object.hasOwn(state.votes ?? {}, player.id),
    ...(deathNotice ? { deathNotice } : {}),
    privateResults: [...(state.privateResultMessages?.[player.id] ?? [])],
    actionHistory: [...(state.privateActionHistory?.[player.id] ?? [])],
  };
}

export function projectMurdererTeamState(state: GameEngineState, requesterId: string): PrivateTeamState {
  const player = state.players.find((item) => item.id === requesterId);
  if (!player || !player.isAlive || player.team !== "MURDERER") throw new Error("Team state access denied");
  return {
    teammates: state.players.filter((item) => item.role === "KILLER" || item.role === "ACCOMPLICE")
      .map((item) => ({ playerId: item.id, role: item.role as "KILLER" | "ACCOMPLICE", roomNumber: item.roomNumber })),
    privateResults: [],
  };
}
