"use client";

import { io, type Socket } from "socket.io-client";
import type { LobbyAck, LobbyErrorCode, LobbyIdentity } from "@/types/lobby";

export function connectLobbySocket(autoConnect = true): Socket {
  return io({ path: "/socket.io", autoConnect, reconnection: true, timeout: 8000 });
}

export async function requestLobby<T>(socket: Socket, event: string, payload: unknown): Promise<LobbyAck<T>> {
  try { return await (payload === undefined ? socket.timeout(10000).emitWithAck(event) : socket.timeout(10000).emitWithAck(event, payload)) as LobbyAck<T>; }
  catch { return { ok: false, error: "SERVER_UNAVAILABLE" }; }
}

export function saveLobbyIdentity(identity: LobbyIdentity): void {
  sessionStorage.setItem(`hotel-lobby:${identity.code}`, JSON.stringify({ playerId: identity.playerId, token: identity.token }));
}

export function readLobbyToken(code: string): string | null {
  try {
    const raw = sessionStorage.getItem(`hotel-lobby:${code}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return typeof value === "object" && value !== null && "token" in value && typeof value.token === "string" ? value.token : null;
  } catch { return null; }
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
  SERVER_UNAVAILABLE: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง",
};

export function lobbyErrorMessage(code: LobbyErrorCode): string { return messages[code]; }
