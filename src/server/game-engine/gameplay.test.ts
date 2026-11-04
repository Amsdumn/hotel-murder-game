import { describe, expect, it } from "vitest";
import { advanceTimedSkill, createInitialGame, performSkill } from "./gameplay";
import type { GameEngineState } from "./state";
import { projectPrivatePlayerState } from "./projections";

const lobbyPlayers = Array.from({ length: 5 }, (_, seatIndex) => ({ id: `p${seatIndex}`, displayName: `Player ${seatIndex}`, seatIndex }));
function choose() {
  let seed = 7;
  return (max: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
}

describe("gameplay setup and skills", () => {
  it("assigns unique rooms, creates three public crime scenes, and starts a private actor", () => {
    const result = createInitialGame("ABC234", lobbyPlayers, 3, choose());
    expect(new Set(result.state.players.map((player) => player.roomNumber)).size).toBe(5);
    expect(result.state.players.filter((player) => player.role === "KILLER")).toHaveLength(1);
    expect(result.state.crimeRooms).toHaveLength(3);
    expect(JSON.stringify(result.publicEvents)).not.toMatch(/Player|"p[0-4]"|LOCKSMITH|KILLER/);
    expect(result.privateEvents.find((event) => event.type === "ACTION_REQUEST")?.recipientPlayerId).toBe(result.state.activePlayerId);
  });

  it("keeps investigation private and moves to discussion after the last skill", () => {
    const start = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    let state: GameEngineState = start;
    let last;
    for (let step = 0; state.phase === "SKILL_PHASE" && step < 5; step += 1) {
      const actor = state.players.find((player) => player.id === state.activePlayerId);
      expect(actor).toBeDefined();
      const target = actor?.role === "WINDOW_CLEANER" || actor?.role === "HOUSEKEEPER" || actor?.role === "WITNESS" ? 1 : actor?.role === "ACCOMPLICE" ? state.players.find((player) => player.id !== actor.id && player.isAlive)?.id : 703;
      last = performSkill(state, actor!.id, target, 1000, 180);
      expect(last.publicEvents).toEqual([]);
      state = last.state;
    }
    expect(state.phase).toBe("DISCUSSION");
    expect(state.phaseDeadlineAt).toBe(181000);
    expect(last?.privateEvents.some((event) => event.type === "SKILL_RESULT" || event.type === "ASSASSINATION_RESULT")).toBe(true);
  });

  it("rejects a dead player's skill without changing state", () => {
    const state = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    const actor = state.activePlayerId!;
    const dead = { ...state, players: state.players.map((player) => player.id === actor ? { ...player, isAlive: false } : player) };
    expect(() => performSkill(dead, actor, 101, 1000, 180)).toThrow();
  });

  it("skips an expired skill slot without publishing the actor", () => {
    const state = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    const active = state.activePlayerId!;
    expect(state.phaseDeadlineAt).toBeDefined();
    expect(advanceTimedSkill(state, state.phaseDeadlineAt! - 1, 180).state.activePlayerId).toBe(active);
    const advanced = advanceTimedSkill(state, state.phaseDeadlineAt!, 180);
    expect(advanced.publicEvents).toEqual([]);
    expect(advanced.state.usedSkillPlayerIds).toContain(active);
    expect(advanced.state.activePlayerId).not.toBe(active);
  });

  it("keeps the Killer's private assassination result for reconnect", () => {
    const initial = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    const killer = initial.players.find((player) => player.role === "KILLER")!;
    const state = { ...initial, activePlayerId: killer.id, usedSkillPlayerIds: initial.players.filter((player) => player.id !== killer.id && player.isAlive).map((player) => player.id) };
    const result = performSkill(state, killer.id, 703, 1000, 180);
    expect(projectPrivatePlayerState(result.state, killer.id).privateResults).toContain("ลอบสังหารไม่สำเร็จ");
  });

  it("consumes the Accomplice's turn when selecting a dead player", () => {
    const initial = createInitialGame("ABC234", lobbyPlayers, 3, choose()).state;
    const accomplice = initial.players.find((player) => player.role === "ACCOMPLICE")!;
    const killer = initial.players.find((player) => player.role === "KILLER")!;
    const target = initial.players.find((player) => player.team === "INNOCENT")!;
    const state = {
      ...initial,
      activePlayerId: accomplice.id,
      players: initial.players.map((player) => player.id === target.id ? { ...player, isAlive: false } : player),
    };
    const result = performSkill(state, accomplice.id, target.id, 1000, 180);
    expect(result.state.usedSkillPlayerIds).toContain(accomplice.id);
    expect(result.state.activePlayerId).toBe(killer.id);
    expect(projectPrivatePlayerState(result.state, accomplice.id).privateResults).toContain("ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก");
    expect(projectPrivatePlayerState(result.state, killer.id).privateResults).toContain("ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก");
    expect(result.publicEvents).toEqual([]);
    expect(() => performSkill(state, accomplice.id, "unknown-player", 1000, 180)).toThrow("Invalid skill target");
  });
});
