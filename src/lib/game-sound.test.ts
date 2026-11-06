import { describe, expect, it } from "vitest";
import { getGameSoundEvent, type GameSoundSnapshot } from "./game-sound";

const prologue: GameSoundSnapshot = { code: "ABC", phase: "ROLE_REVEAL", turn: 1, canUseSkill: false, resultReady: false, openedRoomCount: 0 };
const skill: GameSoundSnapshot = { ...prologue, phase: "SKILL_PHASE" };

describe("game sound events", () => {
  it("plays start only when entering a new game's prologue", () => {
    expect(getGameSoundEvent(null, prologue)).toEqual({ cue: "start", key: "ABC:start" });
    expect(getGameSoundEvent(prologue, prologue)).toBeNull();
    expect(getGameSoundEvent(null, skill)).toBeNull();
  });

  it("alerts only the player whose skill became active", () => {
    const mine = { ...skill, canUseSkill: true, playerId: "p1" };
    expect(getGameSoundEvent(skill, mine)).toEqual({ cue: "skill", key: "ABC:skill:1:p1" });
    expect(getGameSoundEvent(mine, mine)).toBeNull();
    expect(getGameSoundEvent(skill, skill)).toBeNull();
  });

  it("sounds once for each voting round and room opening", () => {
    const vote = { ...skill, phase: "VOTING" as const, phaseDeadlineAt: 1000 };
    expect(getGameSoundEvent(skill, vote)).toEqual({ cue: "vote", key: "ABC:vote:1:1000" });
    expect(getGameSoundEvent(vote, { ...vote, phaseDeadlineAt: 2000 })).toEqual({ cue: "vote", key: "ABC:vote:1:2000" });
    const open = { ...vote, phase: "RESOLUTION" as const, openedRoomCount: 1 };
    expect(getGameSoundEvent(vote, open)).toEqual({ cue: "room", key: "ABC:room:1:1" });
    expect(getGameSoundEvent(open, open)).toBeNull();
  });

  it("plays final result only when it is available", () => {
    const ending = { ...skill, phase: "FINISHED" as const };
    expect(getGameSoundEvent(skill, ending)).toBeNull();
    expect(getGameSoundEvent(ending, { ...ending, resultReady: true })).toEqual({ cue: "result", key: "ABC:result" });
    expect(getGameSoundEvent({ ...skill, resultReady: true }, { ...ending, resultReady: true })).toEqual({ cue: "result", key: "ABC:result" });
  });
});
