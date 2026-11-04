import { describe, expect, it } from "vitest";
import { LobbyService } from "./lobby-service";
import { MemoryLobbyStore } from "./test-memory-store";

describe("LobbyService", () => {
  it("removes rooms idle for ten minutes and their sessions, while preserving occupied rooms", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const created = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    await service.setRoomEmptySince(created.code, 0);
    expect(await service.cleanupUnusedRooms(-60_000, () => false)).toEqual([]);
    expect(await service.cleanupUnusedRooms(60_000, () => true)).toEqual([]);
    expect(await service.cleanupUnusedRooms(60_000, () => false)).toEqual([created.code]);
    expect(await store.findLobby(created.code)).toBeNull();
    expect(await store.findSessionByPlayerId(created.playerId)).toBeNull();
    expect(await service.listRooms()).toEqual([]);
  });

  it("starts the idle period when the last player leaves a game in progress", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const created = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const record = await store.findLobby(created.code);
    await store.replaceLobby(created.code, record!.version, { ...record!, phase: "VOTING", version: record!.version + 1 });
    await service.setConnected(created.playerId, false);
    await service.setRoomEmptySince(created.code, 20 * 60_000);
    expect(await service.cleanupUnusedRooms(19 * 60_000, () => false)).toEqual([]);
    expect(await service.cleanupUnusedRooms(21 * 60_000, () => false)).toEqual([created.code]);
  });

  it("lists only active rooms with public join information", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const created = await service.create({ displayName: "Secret Host", actionId: crypto.randomUUID() });
    expect(await service.listRooms()).toEqual([{ code: created.code, playerCount: 1, playerLimit: 10, status: "WAITING" }]);
    const record = await store.findLobby(created.code);
    await store.replaceLobby(created.code, record!.version, { ...record!, phase: "SKILL_PHASE", version: record!.version + 1 });
    expect(await service.listRooms()).toEqual([{ code: created.code, playerCount: 1, playerLimit: 10, status: "IN_PROGRESS" }]);
    const running = await store.findLobby(created.code);
    await store.replaceLobby(created.code, running!.version, { ...running!, phase: "FINISHED", version: running!.version + 1 });
    expect(await service.listRooms()).toEqual([]);
  });

  it("allows multiple active rooms and keeps their membership separate", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const first = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const second = await service.create({ displayName: "Other Host", actionId: crypto.randomUUID() });
    expect(second.code).not.toBe(first.code);
    expect(await service.listRooms()).toEqual(expect.arrayContaining([
      { code: first.code, playerCount: 1, playerLimit: 10, status: "WAITING" },
      { code: second.code, playerCount: 1, playerLimit: 10, status: "WAITING" },
    ]));
    expect((await service.preview(first.code)).players[0]?.displayName).toBe("Host");
    expect((await service.preview(second.code)).players[0]?.displayName).toBe("Other Host");
  });

  it("allows concurrent creation of distinct rooms", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const results = await Promise.allSettled([
      service.create({ displayName: "Host A", actionId: crypto.randomUUID() }),
      service.create({ displayName: "Host B", actionId: crypto.randomUUID() }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const codes = results.filter((result) => result.status === "fulfilled").map((result) => result.value.code);
    expect(new Set(codes).size).toBe(2);
  });

  it("creates a lobby with a private reconnect token", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const created = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    expect(created.view.players).toHaveLength(1);
    expect(created.view.players[0]?.displayName).toBe("Host");
    expect(created.view.playerLimit).toBe(10);
    expect(created.token).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(created.view)).not.toContain(created.token);
  });

  it("rejects a stale join and preserves the player list", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    await service.join({ code: host.view.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: host.view.version });
    await expect(service.join({ code: host.view.code, displayName: "Late", actionId: crypto.randomUUID(), expectedVersion: host.view.version }))
      .rejects.toMatchObject({ code: "STALE_STATE" });
    expect((await service.preview(host.view.code)).players).toHaveLength(2);
  });

  it("enforces capacity, duplicate actions, and host-only configuration", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const guest = await service.join({ code: host.view.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: host.view.version });
    await expect(service.configure(guest.playerId, { actionId: crypto.randomUUID(), expectedVersion: guest.view.version, playerLimit: 5, discussionSeconds: 120 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    const configured = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: guest.view.version, playerLimit: 5, discussionSeconds: 120 });
    expect(configured.playerLimit).toBe(5);
    expect(configured.discussionSeconds).toBe(120);
    const actionId = crypto.randomUUID();
    const ready = await service.setReady(guest.playerId, { actionId, expectedVersion: configured.version, ready: true });
    await expect(service.setReady(guest.playerId, { actionId, expectedVersion: ready.version, ready: false }))
      .rejects.toMatchObject({ code: "DUPLICATE_ACTION" });
    for (let index = 3; index <= 5; index += 1) {
      const view = await service.preview(host.view.code);
      await service.join({ code: view.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
    }
    const full = await service.preview(host.view.code);
    await expect(service.join({ code: full.code, displayName: "Extra", actionId: crypto.randomUUID(), expectedVersion: full.version }))
      .rejects.toMatchObject({ code: "LOBBY_FULL" });
  });

  it("rotates reconnect tokens and rejects the previous token", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const resumed = await service.resume(host.view.code, host.token);
    expect(resumed.token).not.toBe(host.token);
    await expect(service.resume(host.view.code, host.token)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });

  it("marks the lobby startable only with five ready players", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const players = [host.playerId];
    for (let index = 2; index <= 5; index += 1) {
      const view = await service.preview(host.view.code);
      const joined = await service.join({ code: view.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
      players.push(joined.playerId);
    }
    expect((await service.preview(host.view.code)).canStart).toBe(false);
    for (const playerId of players) {
      const view = await service.preview(host.view.code);
      await service.setReady(playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, ready: true });
    }
    expect((await service.preview(host.view.code)).canStart).toBe(true);
    await service.setConnected(host.playerId, false);
    expect((await service.preview(host.view.code)).canStart).toBe(false);
    await service.setConnected(host.playerId, true);
    expect((await service.preview(host.view.code)).canStart).toBe(true);
  });
});
