import { describe, expect, it } from "vitest";
import type { PrivatePlayerState, PublicGameState } from "@/types/game";
import { canUseLocalBots, chooseLocalBotCommand } from "./local-test-bots";

const state: PublicGameState = {
  code: "ABC234", version: 4, phase: "SKILL_PHASE", turn: 1, phaseMessage: null,
  players: [{ id: "bot", displayName: "Bot", seatIndex: 0 }, { id: "other", displayName: "Other", seatIndex: 1 }],
  publicRooms: [{ roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "UNKNOWN" }, { roomNumber: 201, state: "CRIME_SCENE" }],
};
const privateState: PrivatePlayerState = {
  version: 4, playerId: "bot", role: "DETECTIVE", team: "INNOCENT", roomNumber: 201, isAlive: true,
  mode: "PLAYER", canUseSkill: true, canVote: false, privateResults: [], actionHistory: [],
};

describe("local test bots", () => {
  it("is available only in development on loopback hosts", () => {
    expect(canUseLocalBots("localhost", "development")).toBe(true);
    expect(canUseLocalBots("127.0.0.1", "development")).toBe(true);
    expect(canUseLocalBots("192.168.1.10", "development")).toBe(false);
    expect(canUseLocalBots("localhost", "production")).toBe(false);
  });
  it("chooses a legal target for a normal skill and the five-player double strike", () => {
    expect(chooseLocalBotCommand(state, privateState)).toEqual({ event: "game:skill", payload: { target: 101 } });
    const killer = { ...privateState, role: "KILLER" as const };
    const fivePlayerState = { ...state, turn: 2, players: [...state.players, ...Array.from({ length: 3 }, (_, i) => ({ id: `extra-${i}`, displayName: "Extra", seatIndex: i + 2 }))] };
    expect(chooseLocalBotCommand(fivePlayerState, killer)).toEqual({ event: "game:skill", payload: { target: [101, 102] } });
  });
  it("selects two other living guests for a Lawyer bot", () => {
    const lawyer = { ...privateState, role: "LAWYER" as const };
    const guests = { ...state, players: [...state.players, { id: "dead", displayName: "Dead", seatIndex: 2, isAlive: false }, { id: "third", displayName: "Third", seatIndex: 3, isAlive: true }] };
    expect(chooseLocalBotCommand(guests, lawyer)).toEqual({ event: "game:skill", payload: { target: ["other", "third"] } });
  });
  it("votes only for an eligible unowned room and does not vote twice", () => {
    const voter = { ...privateState, canUseSkill: false, canVote: true, roomNumber: 101 };
    const voting = { ...state, phase: "VOTING" as const };
    expect(chooseLocalBotCommand(voting, voter)).toEqual({ event: "game:vote", payload: { roomNumber: 102 } });
    expect(chooseLocalBotCommand({ ...voting, votes: [{ playerId: "bot", roomNumber: 102 }] }, voter)).toBeNull();
  });
});
