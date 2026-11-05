import { describe, expect, it } from "vitest";
import { acceptNewerGameState } from "./game-state-version";

describe("game state delivery", () => {
  it("keeps the latest state when an older update arrives afterward", () => {
    const latest = { version: 12, phase: "VOTING" };
    expect(acceptNewerGameState(latest, { version: 11, phase: "DISCUSSION" })).toBe(latest);
  });

  it("accepts a current snapshot or a newer update", () => {
    const current = { version: 12, phase: "VOTING" };
    const snapshot = { version: 12, phase: "VOTING", restored: true };
    expect(acceptNewerGameState(current, snapshot)).toBe(snapshot);
    expect(acceptNewerGameState(current, { version: 13, phase: "RESOLUTION" })).toEqual({ version: 13, phase: "RESOLUTION" });
    expect(acceptNewerGameState(null, current)).toBe(current);
  });

  it("keeps a newer loss of team access over an older team update", () => {
    const latest = { version: 9, teamState: null };
    expect(acceptNewerGameState<{ version: number; teamState: null | { teammates: string[] } }>(latest, { version: 8, teamState: { teammates: ["killer"] } })).toBe(latest);
  });
});
