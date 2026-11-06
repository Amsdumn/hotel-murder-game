import { describe, expect, it } from "vitest";
import { MemoryLobbyStore } from "../lobby/test-memory-store";
import type { LobbyRecord } from "../lobby/lobby-store";
import { GameService } from "./game-service";
import { LobbyService } from "../lobby/lobby-service";
import { AVATAR_ORDER } from "../../lib/avatars";
import { INNOCENT_ROLES } from "../../types/game";
import type { GameEngineState } from "./state";
import { projectMurdererTeamState, projectPrivatePlayerState, projectPublicState } from "./projections";

const players: GameEngineState["players"] = [
  { id: "a", displayName: "A", seatIndex: 0, role: "LOCKSMITH", team: "INNOCENT", roomNumber: 101, isAlive: true },
  { id: "b", displayName: "B", seatIndex: 1, role: "HOUSEKEEPER", team: "INNOCENT", roomNumber: 102, isAlive: true },
  { id: "c", displayName: "C", seatIndex: 2, role: "WITNESS", team: "INNOCENT", roomNumber: 103, isAlive: true },
  { id: "d", displayName: "D", seatIndex: 3, role: "ACCOMPLICE", team: "MURDERER", roomNumber: 201, isAlive: true },
  { id: "e", displayName: "E", seatIndex: 4, role: "KILLER", team: "MURDERER", roomNumber: 202, isAlive: true },
];

function record(phase: "ROLE_REVEAL" | "DISCUSSION" | "SKILL_PHASE" | "VOTING"): LobbyRecord {
  const gameState: GameEngineState = { code: "ABC234", version: 5, phase, turn: 1, players, crimeRooms: [301, 302, 303], openedRooms: [], lockedRooms: [], activePlayerId: phase === "SKILL_PHASE" ? "a" : null, usedSkillPlayerIds: [], votes: {}, winner: null, deathNotices: {}, phaseDeadlineAt: phase === "VOTING" ? Date.now() + 60_000 : 1000, phaseStartVersion: 5 };
  return { code: "ABC234", phase, version: 5, creationActionId: "create", hostPlayerId: "a", playerLimit: 5, discussionSeconds: 180, players: players.map(({ id, displayName, seatIndex }) => ({ id, displayName, seatIndex, ready: true, connected: true })), appliedActionIds: [], gameState };
}

describe("persisted server deadlines", () => {
  it("accepts public chat only from living players during discussion and restores it", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("DISCUSSION"));
    const service = new GameService(store);
    const sent = await service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "PUBLIC", text: "  สวัสดี  " }, 500);
    expect(projectPublicState(sent.state).chatMessages).toMatchObject([{ playerId: "a", playerName: "A", text: "สวัสดี", turn: 1 }]);
    expect((await new GameService(store).snapshot("ABC234", "b"))?.publicState.chatMessages?.[0].text).toBe("สวัสดี");
    await expect(service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "PUBLIC", text: "late" }, 1000)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "MURDERER", text: "secret" }, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "PUBLIC", text: " " }, 500)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("keeps murderer chat private and limits it to murderer skill turns", async () => {
    const store = new MemoryLobbyStore();
    const lobby = record("SKILL_PHASE");
    lobby.gameState!.activePlayerId = "d";
    await store.createLobby(lobby);
    const service = new GameService(store);
    const sent = await service.chat("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "MURDERER", text: "Room 101" }, 500);
    expect(projectMurdererTeamState(sent.state, "d").chatMessages).toMatchObject([{ playerId: "e", text: "Room 101" }]);
    expect(JSON.stringify(projectPublicState(sent.state))).not.toContain("Room 101");
    expect((await service.snapshot("ABC234", "d"))?.teamState.teamState?.chatMessages?.[0].text).toBe("Room 101");
    expect((await service.snapshot("ABC234", "a"))?.teamState.teamState).toBeNull();
    await expect(service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "MURDERER", text: "spy" }, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.chat("ABC234", "d", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "PUBLIC", text: "hello" }, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.chat("ABC234", "d", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "MURDERER", text: "late" }, 1000)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const current = (await store.findLobby("ABC234"))!;
    const innocentTurn = { ...current.gameState!, activePlayerId: "a", version: current.version + 1 };
    expect(await store.replaceLobby("ABC234", current.version, { ...current, version: innocentTurn.version, gameState: innocentTurn })).toBe(true);
    expect(projectMurdererTeamState(innocentTurn, "d").chatDeadlineAt).toBeUndefined();
    await expect(service.chat("ABC234", "d", { actionId: crypto.randomUUID(), expectedVersion: innocentTurn.version, channel: "MURDERER", text: "wrong turn" }, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps a skill and a teammate message when they arrive together", async () => {
    const store = new MemoryLobbyStore();
    const lobby = record("SKILL_PHASE");
    lobby.gameState!.activePlayerId = "d";
    await store.createLobby(lobby);
    const service = new GameService(store);
    const [skill, chat] = await Promise.all([
      service.skill("ABC234", "d", { actionId: crypto.randomUUID(), expectedVersion: 5, target: "a" }, 500),
      service.chat("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "MURDERER", text: "Check room 101" }, 500),
    ]);
    expect(skill.state.version).not.toBe(chat.state.version);
    const state = (await store.findLobby("ABC234"))!.gameState!;
    expect(state.murdererChatMessages?.map((message) => message.text)).toContain("Check room 101");
    expect(state.privateActionHistory?.d?.some((entry) => entry.type === "SKILL")).toBe(true);
  });

  it("limits repeat votes and chat messages without blocking a later change", async () => {
    const store = new MemoryLobbyStore();
    const lobby = record("VOTING");
    lobby.gameState!.phaseDeadlineAt = 5000;
    await store.createLobby(lobby);
    const service = new GameService(store);
    const first = await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 102 }, 1000);
    await expect(service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 103 }, 1500)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    const changed = await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 103 }, 2000);
    expect(first.state.votes.a).toBe(102);
    expect(changed.state.votes.a).toBe(103);
    expect(changed.state.publicHistory?.filter((event) => event.type === "VOTE_CAST")).toHaveLength(1);
    const current = (await store.findLobby("ABC234"))!;
    const discussion = { ...current.gameState!, phase: "DISCUSSION" as const, phaseDeadlineAt: 5000, phaseStartVersion: current.version + 1, version: current.version + 1 };
    expect(await store.replaceLobby("ABC234", current.version, { ...current, phase: "DISCUSSION", version: discussion.version, gameState: discussion })).toBe(true);
    await service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: discussion.version, channel: "PUBLIC", text: "one" }, 2500);
    await expect(service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: discussion.version, channel: "PUBLIC", text: "two" }, 2800)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect((await service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: discussion.version, channel: "PUBLIC", text: "three" }, 3500)).state.publicChatMessages?.map((message) => message.text)).toEqual(["one", "three"]);
  });

  it("retains only the latest one hundred chat messages", async () => {
    const store = new MemoryLobbyStore();
    const lobby = record("DISCUSSION");
    lobby.gameState!.phaseDeadlineAt = 200000;
    await store.createLobby(lobby);
    const service = new GameService(store);
    for (let index = 0; index < 101; index += 1) {
      await service.chat("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, channel: "PUBLIC", text: `message-${index}` }, 1000 + index * 1000);
    }
    const saved = (await store.findLobby("ABC234"))!;
    expect(saved.gameState!.publicChatMessages).toHaveLength(100);
    expect(saved.gameState!.publicChatMessages?.[0].text).toBe("message-1");
    expect(saved.gameState!.publicChatMessages?.at(-1)?.text).toBe("message-100");
  });
  it("assigns characters only when the game starts and restores them on reconnect", async () => {
    const store = new MemoryLobbyStore();
    const lobbies = new LobbyService(store);
    const games = new GameService(store);
    const host = await lobbies.create({ displayName: "Host", actionId: crypto.randomUUID() });
    const ids = [host.playerId];
    for (let index = 1; index < 5; index += 1) {
      const view = await lobbies.preview(host.code);
      const guest = await lobbies.join({ code: host.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
      ids.push(guest.playerId);
    }
    expect(JSON.stringify(await lobbies.preview(host.code))).not.toContain("avatarId");
    for (const id of ids) {
      const view = await lobbies.preview(host.code);
      await lobbies.setReady(id, { actionId: crypto.randomUUID(), expectedVersion: view.version, ready: true });
    }
    const beforeRoles = await lobbies.preview(host.code);
    await expect(games.start(host.code, host.playerId, { actionId: crypto.randomUUID(), expectedVersion: beforeRoles.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const selectedRoles = ["LOCKSMITH", "HOUSEKEEPER", "WITNESS", "DETECTIVE", "PHOTOGRAPHER"] as const;
    await lobbies.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: beforeRoles.version, playerLimit: 7, discussionSeconds: 180, selectedInnocentRoles: [...selectedRoles] });
    const ready = await lobbies.preview(host.code);
    expect(ready.canStart).toBe(true);
    const started = await games.start(host.code, host.playerId, { actionId: crypto.randomUUID(), expectedVersion: ready.version });
    const assignedRoles = started.state.players.filter((player) => player.team === "INNOCENT").map((player) => player.role);
    expect(assignedRoles).toHaveLength(4);
    expect(new Set(assignedRoles).size).toBe(4);
    expect(assignedRoles.every((role) => selectedRoles.includes(role as typeof selectedRoles[number]))).toBe(true);
    const avatars = started.state.players.map((player) => player.avatarId);
    expect(new Set(avatars).size).toBe(5);
    expect(avatars.every((avatar) => AVATAR_ORDER.includes(avatar!))).toBe(true);
    expect((await games.snapshot(host.code, ids[1]))?.publicState.players.map((player) => player.avatarId)).toEqual(avatars);
    expect(JSON.stringify(await lobbies.preview(host.code))).not.toContain("avatarId");
  });
  it("starts a ready room in system-random mode without manual Innocent roles", async () => {
    const store = new MemoryLobbyStore();
    const lobbies = new LobbyService(store);
    const games = new GameService(store);
    const host = await lobbies.create({ displayName: "Host", actionId: crypto.randomUUID() });
    for (let index = 1; index < 5; index += 1) {
      const view = await lobbies.preview(host.code);
      await lobbies.join({ code: host.code, displayName: `Guest ${index}`, actionId: crypto.randomUUID(), expectedVersion: view.version });
    }
    for (const player of (await lobbies.preview(host.code)).players) {
      const view = await lobbies.preview(host.code);
      await lobbies.setReady(player.id, { actionId: crypto.randomUUID(), expectedVersion: view.version, ready: true });
    }
    let view = await lobbies.preview(host.code);
    expect(view.canStart).toBe(false);
    view = await lobbies.configure(host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version, playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "RANDOM", selectedInnocentRoles: [] });
    expect(view.canStart).toBe(true);
    const started = await games.start(host.code, host.playerId, { actionId: crypto.randomUUID(), expectedVersion: view.version });
    const innocents = started.state.players.filter((player) => player.team === "INNOCENT").map((player) => player.role);
    expect(innocents).toHaveLength(4);
    expect(new Set(innocents).size).toBe(4);
    expect(innocents.every((role) => INNOCENT_ROLES.includes(role))).toBe(true);
    expect(started.state.players.filter((player) => player.role === "KILLER")).toHaveLength(1);
  });
  it("reveals crime rooms after a saved prologue expires", async () => {
    const store = new MemoryLobbyStore();
    const intro = record("ROLE_REVEAL");
    intro.gameState!.crimeRooms = [];
    await store.createLobby(intro);
    const service = new GameService(store);
    expect((await service.snapshot("ABC234", "a"))?.publicState.publicRooms.every((room) => room.state === "UNKNOWN")).toBe(true);
    expect(await service.advanceDue(999)).toEqual([]);
    const result = await service.advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state.phase).toBe("SKILL_PHASE");
    expect(result[0].state.crimeRooms).toHaveLength(3);
    expect(result[0].state.phaseDeadlineAt).toBe(181000);
    expect((await service.snapshot("ABC234", "a"))?.publicState.publicRooms.filter((room) => room.state === "CRIME_SCENE")).toHaveLength(3);
  });
  it("restores and continues a saved game missing legacy death notices and votes", async () => {
    const store = new MemoryLobbyStore();
    const legacy = record("VOTING");
    delete (legacy.gameState as Partial<GameEngineState>).deathNotices;
    delete (legacy.gameState as Partial<GameEngineState>).votes;
    await store.createLobby(legacy);

    const service = new GameService(store);
    const snapshot = await service.snapshot("ABC234", "a");
    expect(snapshot?.publicState.publicRooms.find((room) => room.roomNumber === 101)?.state).toBe("UNKNOWN");
    expect(snapshot?.privateState).toMatchObject({ version: 5, playerId: "a", isAlive: true, canVote: true });
    expect(snapshot?.privateState.deathNotice).toBeUndefined();
    const vote = await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 102 });
    expect(vote.state.votes.a).toBe(102);
  });

  it("reports a missed first Locksmith turn as expired rather than forbidden", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const service = new GameService(store);
    await service.advanceDue(1000);

    await expect(service.skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 1001)).rejects.toMatchObject({ code: "SKILL_EXPIRED" });
    expect((await store.findLobby("ABC234"))?.gameState?.lockedRooms).toEqual([]);
  });

  it("expires a skill at its deadline even before the timer sweep", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    await expect(new GameService(store).skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 1000)).rejects.toMatchObject({ code: "SKILL_EXPIRED" });
  });

  it("restores an expired discussion phase after a new service instance starts", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("DISCUSSION"));
    const service = new GameService(store);
    expect(await service.advanceDue(999)).toEqual([]);
    const result = await service.advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state).toMatchObject({ phase: "VOTING", version: 6 });
    expect(result[0].state.phaseDeadlineAt).toBe(61000);
    expect((await store.findLobby("ABC234"))?.gameState?.phase).toBe("VOTING");
    await expect(service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 102 })).rejects.toMatchObject({ code: "STALE_STATE" });
    expect((await service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 6, roomNumber: 102 }, 1001)).state.votes.a).toBe(102);
  });

  it("skips an expired skill without a public actor event", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const result = await new GameService(store).advanceDue(1000);
    expect(result[0].publicEvents).toEqual([]);
    expect(result[0].state.activePlayerId).toBe("b");
    expect(result[0].state.phaseDeadlineAt).toBe(181000);
  });

  it("persists the turn-three register for the receptionist after a timer advance", async () => {
    const store = new MemoryLobbyStore();
    const thirdTurn = record("SKILL_PHASE");
    thirdTurn.gameState!.turn = 3;
    thirdTurn.gameState!.players = thirdTurn.gameState!.players.map((player) => player.id === "a" ? { ...player, role: "DETECTIVE" } : player.id === "b" ? { ...player, role: "RECEPTIONIST" } : player);
    await store.createLobby(thirdTurn);
    const service = new GameService(store);
    const advanced = await service.advanceDue(1000);
    expect(advanced[0].privateEvents).toContainEqual(expect.objectContaining({ type: "SKILL_RESULT", recipientPlayerId: "b" }));
    const resumed = new GameService(store);
    expect((await resumed.snapshot("ABC234", "b"))?.privateState.privateResults.join(" ")).toContain("A · ห้อง 101");
    expect((await resumed.snapshot("ABC234", "a"))?.privateState.privateResults).toEqual([]);
    expect(JSON.stringify((await resumed.snapshot("ABC234", "a"))?.publicState)).not.toContain("A · ห้อง 101");
  });

  it("persists the photographer's private killer reveal after a timer advance", async () => {
    const store = new MemoryLobbyStore();
    const thirdTurn = record("SKILL_PHASE");
    thirdTurn.gameState!.turn = 3;
    thirdTurn.gameState!.players = thirdTurn.gameState!.players.map((player) => player.id === "a" ? { ...player, role: "DETECTIVE" } : player.id === "b" ? { ...player, role: "PHOTOGRAPHER" } : player);
    await store.createLobby(thirdTurn);
    const service = new GameService(store);
    const advanced = await service.advanceDue(1000);
    expect(advanced[0].privateEvents).toContainEqual({ type: "SKILL_RESULT", recipientPlayerId: "b", message: "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 E" });
    const resumed = new GameService(store);
    expect((await resumed.snapshot("ABC234", "b"))?.privateState.privateResults).toContain("ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 E");
    expect((await resumed.snapshot("ABC234", "a"))?.privateState.privateResults).toEqual([]);
    expect(JSON.stringify((await resumed.snapshot("ABC234", "a"))?.publicState)).not.toContain("ภาพถ่ายเทิร์นที่ 3");
  });

  it("advances a saved voting deadline after a disconnected voter does not respond", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    voting.gameState!.phaseDeadlineAt = 1000;
    voting.gameState!.votes = { a: 203 };
    await store.createLobby(voting);
    const result = await new GameService(store).advanceDue(1000);
    expect(result).toHaveLength(1);
    expect(result[0].state).toMatchObject({ phase: "RESOLUTION", openedRooms: [203], phaseDeadlineAt: 7000 });
  });

  it("rejects a vote submitted at the deadline before the timer sweep", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    voting.gameState!.phaseDeadlineAt = 1000;
    await store.createLobby(voting);
    await expect(new GameService(store).vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 101 }, 1000)).rejects.toMatchObject({ code: "VOTE_EXPIRED" });
    expect((await store.findLobby("ABC234"))?.gameState?.votes).toEqual({});
  });

  it("adds a voting deadline to a saved game created before voting timers existed", async () => {
    const store = new MemoryLobbyStore();
    const voting = record("VOTING");
    delete voting.gameState!.phaseDeadlineAt;
    await store.createLobby(voting);
    const result = await new GameService(store).advanceDue(1000);
    expect(result[0].state).toMatchObject({ phase: "VOTING", phaseDeadlineAt: 61000 });
    expect(result[0].state.openedRooms).toEqual([]);
  });

});

describe("voting from independent players", () => {
  it("accepts vote changes and concurrent votes, then resolves at the deadline", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("VOTING"));
    const service = new GameService(store);
    const originalVersion = 5;
    const first = await service.vote("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 101 }, 1000);
    expect(first.state.votes.e).toBe(101);
    const changed = await service.vote("ABC234", "e", { actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 102 }, 2000);
    expect(changed.state.votes.e).toBe(102);
    expect(projectPrivatePlayerState(changed.state, "e").canVote).toBe(true);
    await expect(service.vote("ABC234", "a", { actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 101 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const others = await Promise.all(["d", "b", "a", "c"].map((playerId) => service.vote("ABC234", playerId, {
      actionId: crypto.randomUUID(), expectedVersion: originalVersion, roomNumber: 203,
    })));
    expect(others).toHaveLength(4);
    const final = (await store.findLobby("ABC234"))!.gameState!;
    expect(final.openedRooms).toEqual([]);
    expect(final.phase).toBe("VOTING");
    const resolved = await service.advanceDue(final.phaseDeadlineAt);
    expect(resolved[0].state).toMatchObject({ phase: "RESOLUTION", openedRooms: [203] });
  });
});

describe("viewer-specific action history", () => {
  it("stores accepted skills for the actor without publishing the target", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("SKILL_PHASE"));
    const result = await new GameService(store).skill("ABC234", "a", {
      actionId: crypto.randomUUID(), expectedVersion: 5, target: 103,
    }, 999);
    expect(projectPrivatePlayerState(result.state, "a").actionHistory).toEqual([
      { turn: 1, type: "SKILL", message: "ใช้สกิล: ล็อกห้อง 103 แล้ว" },
    ]);
    expect(projectPrivatePlayerState(result.state, "b").actionHistory).toEqual([]);
    expect(JSON.stringify(projectPublicState(result.state))).not.toContain("ล็อกห้อง 103");
    const restored = await new GameService(store).snapshot("ABC234", "a");
    expect(restored?.privateState.actionHistory).toEqual(projectPrivatePlayerState(result.state, "a").actionHistory);
  });

  it("stores each accepted vote in the voter's history and public activity", async () => {
    const store = new MemoryLobbyStore();
    await store.createLobby(record("VOTING"));
    const result = await new GameService(store).vote("ABC234", "b", {
      actionId: crypto.randomUUID(), expectedVersion: 5, roomNumber: 103,
    });
    expect(projectPrivatePlayerState(result.state, "b").actionHistory).toEqual([
      { turn: 1, type: "VOTE", message: "โหวตห้อง 103" },
    ]);
    expect(projectPrivatePlayerState(result.state, "a").actionHistory).toEqual([]);
    expect(projectPublicState(result.state).votes).toEqual([{ playerId: "b", roomNumber: 103 }]);
    expect(projectPublicState(result.state).publicHistory).toContainEqual({ type: "VOTE_CAST", message: "B โหวตห้อง 103" });
  });
});
