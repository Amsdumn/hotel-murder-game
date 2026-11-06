import { describe, expect, it, vi } from "vitest";
import { LobbyService } from "./lobby-service";
import { MemoryLobbyStore } from "./test-memory-store";

describe("LobbyService", () => {
  it("accepts player names up to 256 characters and rejects longer names", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const name = "ก".repeat(256);
    const host = await service.create({ displayName: name, actionId: crypto.randomUUID() });
    expect(host.view.players[0].displayName).toBe(name);
    await expect(service.rename(host.playerId, { displayName: `${name}ก`, actionId: crypto.randomUUID(), expectedVersion: host.view.version })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("accepts discussion durations in 30-second steps through seven minutes", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const configured = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: host.view.version, playerLimit: 10, discussionSeconds: 420 });
    expect(configured.discussionSeconds).toBe(420);
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: configured.version, playerLimit: 10, discussionSeconds: 45 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: configured.version, playerLimit: 10, discussionSeconds: 450 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("lets a guest rename only themself before game start", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const guest = await service.join({ code: host.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: host.view.version });
    const renamed = await service.rename(guest.playerId, { displayName: "New Guest", actionId: crypto.randomUUID(), expectedVersion: guest.view.version });
    expect(renamed.players.find((player) => player.id === guest.playerId)?.displayName).toBe("New Guest");
    expect(renamed.players.find((player) => player.id === host.playerId)?.displayName).toBe("Host");
    await expect(service.rename(guest.playerId, { displayName: " ", actionId: crypto.randomUUID(), expectedVersion: renamed.version })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("allows only the host to kick another guest and invalidates their session", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const guest = await service.join({ code: host.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: host.view.version });
    await expect(service.kick(guest.playerId, { playerId: host.playerId, actionId: crypto.randomUUID(), expectedVersion: guest.view.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.kick(host.playerId, { playerId: host.playerId, actionId: crypto.randomUUID(), expectedVersion: guest.view.version })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const kicked = await service.kick(host.playerId, { playerId: guest.playerId, actionId: crypto.randomUUID(), expectedVersion: guest.view.version });
    expect(kicked.players.map((player) => player.id)).toEqual([host.playerId]);
    expect(await store.findSessionByPlayerId(guest.playerId)).toBeNull();
    await expect(service.resume(host.code, guest.token)).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });
  it("keeps character identities out of lobby views before game start", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const guest = await service.join({ code: host.code, displayName: "Guest", actionId: crypto.randomUUID(), expectedVersion: host.view.version });
    expect(JSON.stringify(host.view)).not.toMatch(/avatarId|adrian-blackwood|irina-volkova/);
    expect(JSON.stringify(guest.view)).not.toMatch(/avatarId|adrian-blackwood|irina-volkova/);
    const resumed = await service.resume(host.code, host.token);
    expect(JSON.stringify(resumed.view)).not.toContain("avatarId");
  });

  it("hides even legacy stored avatars in every lobby projection", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const record = (await store.findLobby(host.code))!;
    await store.replaceLobby(host.code, record.version, { ...record, version: record.version + 1, players: record.players.map((player) => ({ ...player, avatarId: "adrian-blackwood" as const })) });
    const resumed = await service.resume(host.code, host.token);
    expect(JSON.stringify(resumed.view)).not.toContain("adrian-blackwood");
    expect(JSON.stringify(await service.preview(host.code))).not.toContain("avatarId");
  });

  it("can fill ten seats without assigning visible characters", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    for (let index = 1; index < 10; index += 1) {
      const view = await service.preview(host.code);
      await service.join({ code: host.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
    }
    const view = await service.preview(host.code);
    expect(view.players).toHaveLength(10);
    expect(JSON.stringify(view)).not.toContain("avatarId");
  });
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

  it("removes finished rooms ten minutes after their last update when nobody is connected", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const store = new MemoryLobbyStore();
      const service = new LobbyService(store);
      const created = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
      const record = (await store.findLobby(created.code))!;
      await store.replaceLobby(created.code, record.version, { ...record, version: record.version + 1, phase: "FINISHED" });
      expect(await service.cleanupUnusedRooms(999_999, () => false)).toEqual([]);
      expect(await service.cleanupUnusedRooms(1_000_000, () => true)).toEqual([]);
      expect(await service.cleanupUnusedRooms(1_000_000, () => false)).toEqual([created.code]);
      expect(await store.findLobby(created.code)).toBeNull();
      expect(await store.findSessionByPlayerId(created.playerId)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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

  it("rejects a third active room and allows another after one game finishes", async () => {
    const store = new MemoryLobbyStore();
    const service = new LobbyService(store);
    const first = await service.create({ displayName: "First Host", actionId: crypto.randomUUID() });
    await service.create({ displayName: "Second Host", actionId: crypto.randomUUID() });
    await expect(service.create({ displayName: "Third Host", actionId: crypto.randomUUID() }))
      .rejects.toMatchObject({ code: "ROOM_LIMIT_REACHED" });

    const record = (await store.findLobby(first.code))!;
    await store.replaceLobby(first.code, record.version, { ...record, phase: "FINISHED", version: record.version + 1 });
    const replacement = await service.create({ displayName: "Replacement Host", actionId: crypto.randomUUID() });
    expect((await service.listRooms()).map((room) => room.code)).toContain(replacement.code);
    expect(await service.listRooms()).toHaveLength(2);
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

  it("keeps the active-room count at two under concurrent creation", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const results = await Promise.allSettled(["A", "B", "C"].map((host) =>
      service.create({ displayName: `Host ${host}`, actionId: crypto.randomUUID() })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((result) => result.status === "rejected")[0]?.reason).toMatchObject({ code: "ROOM_LIMIT_REACHED" });
    expect(await service.listRooms()).toHaveLength(2);
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

  it("resumes the same player repeatedly without creating another seat", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const first = await service.resume(host.view.code, host.token);
    const second = await service.resume(host.view.code, host.token);
    expect(first.playerId).toBe(host.playerId);
    expect(second.playerId).toBe(host.playerId);
    expect(second.token).toBe(host.token);
    expect(second.view.players).toHaveLength(1);
    await expect(service.resume(host.view.code, "0".repeat(64))).rejects.toMatchObject({ code: "INVALID_SESSION" });
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
    const beforeRoles = await service.preview(host.view.code);
    await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: beforeRoles.version, playerLimit: 5, discussionSeconds: 180, selectedInnocentRoles: ["LOCKSMITH", "HOUSEKEEPER", "WITNESS", "DETECTIVE"] });
    expect((await service.preview(host.view.code)).canStart).toBe(true);
    await service.setConnected(host.playerId, false);
    expect((await service.preview(host.view.code)).canStart).toBe(false);
    await service.setConnected(host.playerId, true);
    expect((await service.preview(host.view.code)).canStart).toBe(true);
  });

  it("requires Innocent roles for maximum capacity, even when fewer players have joined", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    for (let index = 1; index < 5; index += 1) {
      const view = await service.preview(host.code);
      await service.join({ code: host.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
    }
    for (const player of (await service.preview(host.code)).players) {
      const view = await service.preview(host.code);
      await service.setReady(player.id, { actionId: crypto.randomUUID(), expectedVersion: view.version, ready: true });
    }
    let view = await service.preview(host.code);
    expect(view.canStart).toBe(false);
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 10, discussionSeconds: 180, selectedInnocentRoles: ["DETECTIVE", "DETECTIVE"] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 10, discussionSeconds: 180, selectedInnocentRoles: ["KILLER", "DETECTIVE", "WITNESS"] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, selectedInnocentRoles: ["DETECTIVE", "WITNESS", "HOUSEKEEPER", "LOCKSMITH", "ELECTRICIAN"] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 6, discussionSeconds: 180, selectedInnocentRoles: ["DETECTIVE", "WITNESS", "HOUSEKEEPER", "LOCKSMITH"] });
    expect(view.selectedInnocentRoles).toEqual(["DETECTIVE", "WITNESS", "HOUSEKEEPER", "LOCKSMITH"]);
    expect(view.canStart).toBe(true);
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180 });
    expect(view.canStart).toBe(true);
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 6, discussionSeconds: 180 });
    const sixth = await service.join({ code: host.code, displayName: "Sixth", actionId: crypto.randomUUID(), expectedVersion: view.version });
    expect(sixth.view.canStart).toBe(false);
    const ready = await service.setReady(sixth.playerId, { actionId: crypto.randomUUID(), expectedVersion: sixth.view.version, ready: true });
    expect(ready.canStart).toBe(true);
  });

  it("persists random mode and restores the custom pool when switching back", async () => {
    const service = new LobbyService(new MemoryLobbyStore());
    const host = await service.create({ displayName: "Host", actionId: crypto.randomUUID() });
    expect(host.view.innocentRoleMode).toBe("CUSTOM");
    let view = await service.preview(host.code);
    const roles = ["DETECTIVE", "WITNESS", "HOUSEKEEPER", "LOCKSMITH"];
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "CUSTOM", selectedInnocentRoles: roles });
    expect(view.selectedInnocentRoles).toEqual(roles);
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "RANDOM" });
    expect(view.innocentRoleMode).toBe("RANDOM");
    expect((await service.preview(host.code)).selectedInnocentRoles).toEqual(roles);
    view = await service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "CUSTOM" });
    expect(view.innocentRoleMode).toBe("CUSTOM");
    expect(view.selectedInnocentRoles).toEqual(roles);
    await expect(service.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "OTHER" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
