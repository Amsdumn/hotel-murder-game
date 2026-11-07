import type { PrivatePlayerState, PrivateTeamState, PublicGameState } from "../../types/game";
import { gameRooms, publicEventMessage, type GameEngineState } from "./state";

export function projectPublicState(state: GameEngineState): PublicGameState {
  return {
    code: state.code,
    version: state.version,
    phase: state.phase,
    turn: state.turn,
    players: state.players.map(({ id, displayName, seatIndex, avatarId, isAlive }) => ({ id, displayName, seatIndex, avatarId: avatarId ?? null, isAlive })),
    phaseMessage: state.phase === "SKILL_PHASE" ? "กำลังดำเนินการสืบสวน..." : null,
    ...(["ROLE_REVEAL", "DISCUSSION", "VOTING", "RESOLUTION"].includes(state.phase) && state.phaseDeadlineAt !== undefined ? { phaseDeadlineAt: state.phaseDeadlineAt } : {}),
    publicHistory: (state.publicHistory ?? []).map((event) => ({ type: event.type, message: publicEventMessage(event) })),
    chatMessages: [...(state.publicChatMessages ?? [])],
    ...(state.runoffRooms?.length ? { runoffRooms: [...state.runoffRooms] } : {}),
    ...(state.phase === "VOTING" ? { votes: Object.entries(state.votes ?? {}).map(([playerId, roomNumber]) => ({ playerId, roomNumber })) } : {}),
    publicRooms: gameRooms(state).map((roomNumber) => {
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
  const blockedAction = state.privateActionHistory?.[player.id]?.find((entry) => entry.turn === state.turn && entry.type === "SKILL" && (entry.message === "ใช้สกิลไม่ได้เนื่องจากไฟดับบนชั้นของคุณ" || entry.message === "สกิลช่างไฟกำลังพักหนึ่งเทิร์น"));
  const canUseSkill = player.isAlive && player.role !== "FORMER_POLICE" && player.role !== "RECEPTIONIST" && player.role !== "PHOTOGRAPHER" && state.phase === "SKILL_PHASE" && state.activePlayerId === player.id && !state.usedSkillPlayerIds.includes(player.id)
    && !state.darkFloors?.includes(Math.floor(player.roomNumber / 100))
    && !(player.role === "ELECTRICIAN" && state.electricianLastUsedTurn?.[player.id] === state.turn - 1);
  return {
    version: state.version,
    playerId: player.id,
    role: player.role,
    team: player.team,
    roomNumber: player.roomNumber,
    isAlive: player.isAlive,
    mode: player.isAlive ? "PLAYER" : "SPECTATOR",
    canUseSkill,
    ...(player.role === "LOCKSMITH" ? { locksmithUsedRooms: [...(state.locksmithUsedRooms ?? [])] } : {}),
    ...(blockedAction ? { skillBlockReason: blockedAction.message.startsWith("ใช้สกิลไม่ได้") ? "BLACKOUT" as const : "COOLDOWN" as const } : {}),
    ...(canUseSkill && state.phaseDeadlineAt !== undefined ? { skillDeadlineAt: state.phaseDeadlineAt } : {}),
    canVote: player.isAlive && state.phase === "VOTING",
    ...(deathNotice ? { deathNotice } : {}),
    privateResults: [...(state.privateResultMessages?.[player.id] ?? [])],
    actionHistory: [...(state.privateActionHistory?.[player.id] ?? [])],
  };
}

export function projectMurdererTeamState(state: GameEngineState, requesterId: string): PrivateTeamState {
  const player = state.players.find((item) => item.id === requesterId);
  if (!player || !player.isAlive || player.team !== "MURDERER") throw new Error("Team state access denied");
  const canChat = state.players.filter((item) => item.team === "MURDERER").length > 1 && state.phaseDeadlineAt !== undefined && (state.phase === "DISCUSSION" || state.phase === "VOTING" || state.phase === "SKILL_PHASE" && state.players.some((item) => item.id === state.activePlayerId && item.team === "MURDERER"));
  return {
    teammates: state.players.filter((item) => item.role === "KILLER" || item.role === "ACCOMPLICE")
      .map((item) => ({ playerId: item.id, role: item.role as "KILLER" | "ACCOMPLICE", roomNumber: item.roomNumber })),
    privateResults: [],
    chatMessages: [...(state.murdererChatMessages ?? [])],
    canChat,
    ...(canChat ? { chatDeadlineAt: state.phaseDeadlineAt } : {}),
  };
}
