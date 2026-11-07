"use client";

import type { Socket } from "socket.io-client";
import type { PrivatePlayerState, PrivateTeamState, PublicGameState } from "@/types/game";
import type { LobbyIdentity, LobbyView } from "@/types/lobby";
import { createActionId } from "./action-id";
import { gameMessage } from "./game-copy";
import { connectLobbySocket, requestLobby } from "./lobby-client";

export function canUseLocalBots(hostname: string, environment: string): boolean {
  return environment === "development" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

function availableRooms(state: PublicGameState, player: PrivatePlayerState, team?: PrivateTeamState | null): number[] {
  const protectedRooms = player.team === "MURDERER" ? new Set([player.roomNumber, ...(team?.teammates.map((mate) => mate.roomNumber) ?? [])]) : new Set([player.roomNumber]);
  return state.publicRooms.filter((room) => room.state === "UNKNOWN" && !protectedRooms.has(room.roomNumber)).map((room) => room.roomNumber);
}

function roomClueScores(state: PublicGameState, player: PrivatePlayerState): Map<number, number> {
  const scores = new Map<number, number>();
  const recent = (state.chatMessages ?? []).filter((message) => message.turn <= state.turn);
  const registeredRooms = new Map<string, number>();
  for (const message of recent) {
    for (const match of message.text.matchAll(/ผู้เล่น \d+ ([^·,]+?) · ห้อง (\d+)/g)) registeredRooms.set(match[1].trim(), Number(match[2]));
  }
  for (const message of recent) {
    const match = message.text.match(/ผลตรวจห้อง (\d+): (MURDERER|INNOCENT|EMPTY)/);
    if (match) {
      const room = Number(match[1]);
      scores.set(room, (scores.get(room) ?? 0) + (match[2] === "MURDERER" ? 3 : -2));
    }
    const photograph = message.text.match(/ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น \d+ ([^/]+)/);
    const photographedRoom = photograph ? registeredRooms.get(photograph[1].trim()) : undefined;
    if (photographedRoom !== undefined) scores.set(photographedRoom, (scores.get(photographedRoom) ?? 0) + 6);
    const direction = message.text.match(/ฉันตรวจชั้น (\d+): ทิศทางชั้นนักฆ่า: (ABOVE|BELOW|SAME_FLOOR)/);
    if (direction) {
      const floor = Number(direction[1]);
      for (const room of state.publicRooms) {
        const candidateFloor = Math.floor(room.roomNumber / 100);
        const consistent = direction[2] === "ABOVE" ? candidateFloor > floor : direction[2] === "BELOW" ? candidateFloor < floor : candidateFloor === floor;
        scores.set(room.roomNumber, (scores.get(room.roomNumber) ?? 0) + (consistent ? 1 : -1));
      }
    }
  }
  if (player.team === "INNOCENT") {
    for (const result of player.privateResults) {
      const match = result.match(/^ผลตรวจห้อง (\d+): (MURDERER|INNOCENT|EMPTY)$/);
      if (!match) continue;
      const room = Number(match[1]);
      scores.set(room, (scores.get(room) ?? 0) + (match[2] === "MURDERER" ? 5 : -4));
    }
  }
  return scores;
}

export function chooseLocalBotChat(state: PublicGameState, player: PrivatePlayerState, team?: PrivateTeamState | null, skillTarget?: unknown): string | null {
  if (state.phase !== "DISCUSSION" || !player.isAlive || state.chatMessages?.some((message) => message.turn === state.turn && message.playerId === player.playerId)) return null;
  if (player.team === "MURDERER") {
    const room = availableRooms(state, player, team)[0];
    return room === undefined ? "ฉันยังไม่เห็นเบาะแสชัดเจน / I have no clear clue yet" : `ฉันสงสัยจากร่องรอยว่าห้อง ${room} เป็นฝ่ายฆาตกร ผลตรวจห้อง ${room}: MURDERER / I suspect room ${room} is on the Murderer team`;
  }
  const skill = [...player.actionHistory].reverse().find((entry) => entry.turn === state.turn && entry.type === "SKILL" && !entry.message.includes("หมดเวลา") && !entry.message.includes("ใช้สกิลไม่ได้"));
  const result = skill?.message.replace(/^ใช้สกิล: /, "") ?? [...player.privateResults].reverse().find((message) => message.startsWith(`ทะเบียนห้องพักเทิร์นที่ ${state.turn}:`) || message.startsWith(`ภาพถ่ายเทิร์นที่ ${state.turn}:`) || message.startsWith(`เบาะแสอดีตตำรวจเทิร์นที่ ${state.turn}:`));
  if (!result) return "ยังไม่มีผลสกิลที่ยืนยันได้ ใครมีเบาะแสช่วยบอกด้วย / I have no confirmed clue yet. Please share yours.";
  if (player.role === "LAWYER" && Array.isArray(skillTarget)) {
    const names = skillTarget.map((id) => state.players.find((guest) => guest.id === id)?.displayName).filter(Boolean).join(" กับ ");
    return `ฉันเทียบ ${names}: ${result} / I compared ${names}: ${gameMessage(result, "en")}`.slice(0, 300);
  }
  if (player.role === "WITNESS" && typeof skillTarget === "number") return `ฉันตรวจชั้น ${skillTarget}: ${result} / I checked floor ${skillTarget}: ${gameMessage(result, "en")}`.slice(0, 300);
  const text = `ข้อมูลสกิล: ${result} / Skill clue: ${gameMessage(result, "en")}`;
  return text.slice(0, 300);
}

export function chooseLocalBotCommand(state: PublicGameState, player: PrivatePlayerState, team?: PrivateTeamState | null): { event: "game:skill" | "game:vote"; payload: Record<string, unknown> } | null {
  if (!player.isAlive) return null;
  const rooms = state.publicRooms.filter((room) => room.state === "UNKNOWN").map((room) => room.roomNumber);
  if (state.phase === "SKILL_PHASE" && player.canUseSkill) {
    let target: number | number[] | string | string[] | undefined;
    if (player.role === "ACCOMPLICE") target = state.players.find((guest) => guest.id !== player.playerId && guest.isAlive !== false)?.id;
    else if (player.role === "LAWYER") {
      const guests = state.players.filter((guest) => guest.id !== player.playerId && guest.isAlive !== false).slice(0, 2).map((guest) => guest.id);
      target = guests.length === 2 ? guests : undefined;
    }
    else if (["ELECTRICIAN", "HOUSEKEEPER", "WITNESS"].includes(player.role)) target = rooms.length ? Math.floor(rooms[0] / 100) : undefined;
    else if (player.role === "WINDOW_CLEANER") target = rooms.length ? rooms[0] % 100 : undefined;
    else if (player.role === "KILLER" && state.players.length === 5 && state.turn === 2) target = availableRooms(state, player, team).length >= 2 ? availableRooms(state, player, team).slice(0, 2) : undefined;
    else if (player.role === "KILLER") target = availableRooms(state, player, team)[0];
    else if (player.role !== "RECEPTIONIST" && player.role !== "PHOTOGRAPHER") target = rooms.find((room) => player.role !== "LOCKSMITH" || !player.locksmithUsedRooms?.includes(room));
    return target === undefined ? null : { event: "game:skill", payload: { target } };
  }
  if (state.phase === "VOTING" && player.canVote && !state.votes?.some((vote) => vote.playerId === player.playerId)) {
    const scores = roomClueScores(state, player);
    const candidates = availableRooms(state, player, team).filter((room) => !state.runoffRooms?.length || state.runoffRooms.includes(room));
    const roomNumber = candidates.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || a - b)[0];
    return roomNumber === undefined ? null : { event: "game:vote", payload: { roomNumber } };
  }
  return null;
}

const activeBots = new Map<string, Socket[]>();

export function localBotCount(code: string): number {
  return activeBots.get(code)?.filter((socket) => socket.connected).length ?? 0;
}

function waitForConnect(socket: Socket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("Connection timed out")); }, 8000);
    const connected = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Connection failed")); };
    const cleanup = () => { clearTimeout(timer); socket.off("connect", connected); socket.off("connect_error", failed); };
    socket.once("connect", connected);
    socket.once("connect_error", failed);
  });
}

export function disconnectLocalTestBots(code: string): void {
  for (const socket of activeBots.get(code) ?? []) socket.disconnect();
  activeBots.delete(code);
}

export async function addLocalTestBots(code: string, count: number, onProgress: (count: number) => void, options: { hostname?: string; environment?: string; connect?: () => Socket } = {}): Promise<void> {
  if (!canUseLocalBots(options.hostname ?? window.location.hostname, options.environment ?? process.env.NODE_ENV)) throw new Error("Local test bots are unavailable here");
  const sockets = activeBots.get(code) ?? [];
  activeBots.set(code, sockets);
  for (let index = 0; index < count; index++) {
    const socket = (options.connect ?? connectLobbySocket)();
    try {
      await waitForConnect(socket);
      const preview = await requestLobby<LobbyView>(socket, "lobby:preview", code);
      if (!preview.ok) throw new Error(preview.error);
      const joined = await requestLobby<LobbyIdentity>(socket, "lobby:join", { code, displayName: `Test Player ${preview.data.players.length + 1}`, actionId: createActionId(), expectedVersion: preview.data.version });
      if (!joined.ok) throw new Error(joined.error);
      const ready = await requestLobby<LobbyView>(socket, "lobby:ready", { ready: true, actionId: createActionId(), expectedVersion: joined.data.view.version });
      if (!ready.ok) throw new Error(ready.error);
      let publicState: PublicGameState | null = null;
      let privateState: PrivatePlayerState | null = null;
      let teamState: PrivateTeamState | null = null;
      let skillTarget: unknown;
      let busy = false;
      let attemptedKey = "";
      const act = async () => {
        if (busy || !publicState || !privateState) return;
        const chat = chooseLocalBotChat(publicState, privateState, teamState, skillTarget);
        const command = chat ? { event: "game:chat" as const, payload: { channel: "PUBLIC", text: chat } } : chooseLocalBotCommand(publicState, privateState, teamState);
        if (!command) return;
        const key = `${command.event}:${publicState.turn}:${publicState.phaseDeadlineAt}:${JSON.stringify(command.payload)}`;
        if (key === attemptedKey) return;
        attemptedKey = key;
        busy = true;
        if (command.event === "game:skill") skillTarget = command.payload.target;
        const answer = await requestLobby<{ version: number }>(socket, command.event, { ...command.payload, actionId: createActionId(), expectedVersion: publicState.version });
        busy = false;
        if (!answer.ok) attemptedKey = "";
        else queueMicrotask(() => { void act(); });
      };
      socket.on("game:state", (next: PublicGameState) => { publicState = next; void act(); });
      socket.on("game:private", (next: PrivatePlayerState) => { privateState = next; void act(); });
      socket.on("game:team", (next: { teamState: PrivateTeamState | null }) => { teamState = next.teamState; void act(); });
      sockets.push(socket);
      onProgress(localBotCount(code));
    } catch (error) {
      socket.disconnect();
      throw error;
    }
  }
}
