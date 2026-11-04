"use client";

import { io, type Socket } from "socket.io-client";
import type { LobbyAck, LobbyErrorCode, LobbyIdentity, LobbyView } from "@/types/lobby";
import { createActionId } from "@/lib/action-id";

export interface GuestProfile { id: string; displayName: string }

const profileKey = "hotel-guest-profile";
const lobbyKey = (code: string) => `hotel-lobby:${code.toUpperCase()}`;

function storedToken(storage: Storage, code: string): string | null {
  try {
    const raw = storage.getItem(lobbyKey(code));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return typeof value === "object" && value !== null && "token" in value && typeof value.token === "string" && /^[a-f0-9]{64}$/.test(value.token) ? value.token : null;
  } catch { return null; }
}

export function readGuestProfile(): GuestProfile | null {
  try {
    const raw = localStorage.getItem(profileKey);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return typeof value === "object" && value !== null && "id" in value && "displayName" in value && typeof value.id === "string" && typeof value.displayName === "string" ? { id: value.id, displayName: value.displayName } : null;
  } catch { return null; }
}

export function saveGuestProfile(displayName: string): GuestProfile {
  const profile = { id: readGuestProfile()?.id ?? createActionId(), displayName };
  try { localStorage.setItem(profileKey, JSON.stringify(profile)); } catch { /* Browser storage may be unavailable. */ }
  return profile;
}

export function connectLobbySocket(autoConnect = true): Socket {
  return io({ path: "/socket.io", autoConnect, reconnection: true, timeout: 8000 });
}

export async function requestLobby<T>(socket: Socket, event: string, payload: unknown): Promise<LobbyAck<T>> {
  try { return await (payload === undefined ? socket.timeout(10000).emitWithAck(event) : socket.timeout(10000).emitWithAck(event, payload)) as LobbyAck<T>; }
  catch { return { ok: false, error: "SERVER_UNAVAILABLE" }; }
}

export function saveLobbyIdentity(identity: LobbyIdentity): void {
  const value = JSON.stringify({ playerId: identity.playerId, token: identity.token });
  try { localStorage.setItem(lobbyKey(identity.code), value); } catch { /* Keep the tab-scoped fallback. */ }
  try { sessionStorage.setItem(lobbyKey(identity.code), value); } catch { /* Persistent storage may still work. */ }
}

export function readLobbyToken(code: string): string | null {
  let persistent: string | null = null;
  try { persistent = storedToken(localStorage, code); } catch { /* Storage is unavailable. */ }
  if (persistent) return persistent;
  let legacy: string | null = null;
  try { legacy = storedToken(sessionStorage, code); } catch { /* Storage is unavailable. */ }
  if (legacy) {
    try { localStorage.setItem(lobbyKey(code), sessionStorage.getItem(lobbyKey(code))!); } catch { /* The current tab can still resume. */ }
  }
  return legacy;
}

export function forgetLobbyIdentity(code: string): void {
  try { localStorage.removeItem(lobbyKey(code)); } catch { /* Ignore unavailable storage. */ }
  try { sessionStorage.removeItem(lobbyKey(code)); } catch { /* Ignore unavailable storage. */ }
}

export async function joinOrResumeLobby(socket: Socket, code: string, displayName: string): Promise<LobbyAck<LobbyIdentity>> {
  const roomCode = code.trim().toUpperCase();
  const token = readLobbyToken(roomCode);
  if (token) return requestLobby<LobbyIdentity>(socket, "lobby:resume", { code: roomCode, token });
  const preview = await requestLobby<LobbyView>(socket, "lobby:preview", roomCode);
  if (!preview.ok) return preview;
  return requestLobby<LobbyIdentity>(socket, "lobby:join", {
    code: preview.data.code, displayName, actionId: createActionId(), expectedVersion: preview.data.version,
  });
}

const messages: Record<LobbyErrorCode, string> = {
  INVALID_INPUT: "กรุณาตรวจสอบข้อมูลที่กรอก",
  LOBBY_NOT_FOUND: "ไม่พบห้องเกมนี้",
  LOBBY_FULL: "ห้องเกมเต็มแล้ว",
  STALE_STATE: "ข้อมูลห้องเปลี่ยนไปแล้ว กรุณาลองอีกครั้ง",
  DUPLICATE_ACTION: "คำสั่งนี้ถูกดำเนินการแล้ว",
  CODE_COLLISION: "สร้างรหัสห้องไม่สำเร็จ กรุณาลองอีกครั้ง",
  INVALID_SESSION: "สิทธิ์เข้าห้องหมดอายุ กรุณาเข้าร่วมใหม่",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  SKILL_EXPIRED: "หมดเวลาใช้สกิลของคุณแล้ว รอขั้นตอนถัดไป",
  SERVER_UNAVAILABLE: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง",
};

export function lobbyErrorMessage(code: LobbyErrorCode): string { return messages[code]; }
