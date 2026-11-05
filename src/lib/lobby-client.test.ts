import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Socket } from "socket.io-client";
import { acceptNewerLobbyState, forgetLobbyIdentity, joinOrResumeLobby, readGuestProfile, readLobbyToken, saveGuestProfile, saveLobbyIdentity } from "./lobby-client";
import type { LobbyIdentity } from "@/types/lobby";

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, value); },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("browser guest identity", () => {
  it("keeps the latest lobby version when broadcasts or acknowledgements arrive out of order", () => {
    const latest = { code: "ABC234", version: 3, players: ["Host", "Guest"] };
    expect(acceptNewerLobbyState(latest, { code: "ABC234", version: 2, players: ["Host"] })).toBe(latest);
    expect(acceptNewerLobbyState(latest, { code: "ABC234", version: 4, players: ["Host", "Guest", "Third"] }).version).toBe(4);
    expect(acceptNewerLobbyState(latest, { code: "XYZ234", version: 0, players: ["Other"] }).code).toBe("XYZ234");
  });

  it("keeps a room token after tab storage is cleared and removes it only when forgotten", () => {
    const identity = { code: "ABC234", playerId: "player-1", token: "a".repeat(64), view: {} } as LobbyIdentity;
    saveLobbyIdentity(identity);
    sessionStorage.clear();
    expect(readLobbyToken("abc234")).toBe(identity.token);
    forgetLobbyIdentity(identity.code);
    expect(readLobbyToken(identity.code)).toBeNull();
  });

  it("migrates a token saved by the previous tab-only implementation", () => {
    sessionStorage.setItem("hotel-lobby:ABC234", JSON.stringify({ playerId: "player-1", token: "b".repeat(64) }));
    expect(readLobbyToken("ABC234")).toBe("b".repeat(64));
    sessionStorage.clear();
    expect(readLobbyToken("ABC234")).toBe("b".repeat(64));
  });

  it("keeps one guest profile while updating its display name", () => {
    const first = saveGuestProfile("First Name");
    const renamed = saveGuestProfile("Second Name");
    expect(renamed).toEqual({ id: first.id, displayName: "Second Name" });
    expect(readGuestProfile()).toEqual(renamed);
  });

  it("resumes a saved seat without sending a join command, even when recovery fails", async () => {
    const token = "c".repeat(64);
    localStorage.setItem("hotel-lobby:ABC234", JSON.stringify({ playerId: "player-1", token }));
    const emitWithAck = vi.fn().mockResolvedValue({ ok: false, error: "INVALID_SESSION" });
    const socket = { timeout: () => ({ emitWithAck }) } as unknown as Socket;
    expect(await joinOrResumeLobby(socket, "abc234", "Another Name")).toEqual({ ok: false, error: "INVALID_SESSION" });
    expect(emitWithAck).toHaveBeenCalledTimes(1);
    expect(emitWithAck).toHaveBeenCalledWith("lobby:resume", { code: "ABC234", token });
  });

  it("previews and joins when this browser has no seat in the room", async () => {
    const emitWithAck = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { code: "ABC234", version: 3 } })
      .mockResolvedValueOnce({ ok: true, data: { code: "ABC234", playerId: "new-player", token: "d".repeat(64), view: {} } });
    const socket = { timeout: () => ({ emitWithAck }) } as unknown as Socket;
    const result = await joinOrResumeLobby(socket, "abc234", "Guest");
    expect(result.ok).toBe(true);
    expect(emitWithAck.mock.calls.map(([event]) => event)).toEqual(["lobby:preview", "lobby:join"]);
    expect(emitWithAck.mock.calls[1]?.[1]).toMatchObject({ code: "ABC234", displayName: "Guest", expectedVersion: 3 });
  });
});
