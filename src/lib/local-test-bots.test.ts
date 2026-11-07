import { describe, expect, it } from "vitest";
import type { PrivatePlayerState, PublicGameState } from "@/types/game";
import { canUseLocalBots, chooseLocalBotChat, chooseLocalBotCommand } from "./local-test-bots";

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
  it("shares its real investigation result during discussion and only once per turn", () => {
    const detective = { ...privateState, canUseSkill: false, privateResults: ["ผลตรวจห้อง 102: MURDERER"], actionHistory: [{ turn: 1, type: "SKILL" as const, message: "ใช้สกิล: ผลตรวจห้อง 102: MURDERER" }] };
    const discussion = { ...state, phase: "DISCUSSION" as const };
    const chat = chooseLocalBotChat(discussion, detective);
    expect(chat).toContain("ผลตรวจห้อง 102: MURDERER");
    expect(chooseLocalBotChat({ ...discussion, chatMessages: [{ id: "1", playerId: "bot", playerName: "Bot", turn: 1, text: chat!, sentAt: 0 }] }, detective)).toBeNull();
  });
  it("hides a murderer and invents a misleading room claim", () => {
    const killer = { ...privateState, role: "KILLER" as const, team: "MURDERER" as const, roomNumber: 101, canUseSkill: false };
    const chat = chooseLocalBotChat({ ...state, phase: "DISCUSSION" }, killer);
    expect(chat).toContain("ผลตรวจห้อง 102: MURDERER");
    expect(chat).not.toMatch(/ฉันเป็นนักฆ่า|I am the Assassin/);
  });
  it("uses chat clues to choose a vote and avoids teammate rooms", () => {
    const voter = { ...privateState, canUseSkill: false, canVote: true, roomNumber: 201 };
    const voting = { ...state, phase: "VOTING" as const, chatMessages: [{ id: "1", playerId: "other", playerName: "Other", turn: 1, text: "ผลตรวจห้อง 102: MURDERER / Room 102: Murderer", sentAt: 0 }] };
    expect(chooseLocalBotCommand(voting, voter)).toEqual({ event: "game:vote", payload: { roomNumber: 102 } });
    expect(chooseLocalBotCommand(voting, { ...voter, role: "KILLER", team: "MURDERER", roomNumber: 101 }, { teammates: [{ playerId: "ally", role: "ACCOMPLICE", roomNumber: 102 }], privateResults: [] })).toBeNull();
  });
  it("combines the public photograph with the room register before voting", () => {
    const voter = { ...privateState, canUseSkill: false, canVote: true, roomNumber: 201 };
    const voting = { ...state, phase: "VOTING" as const, chatMessages: [
      { id: "1", playerId: "desk", playerName: "Desk", turn: 1, text: "ทะเบียนห้องพักเทิร์นที่ 3: ผู้เล่น 1 Guest A · ห้อง 101, ผู้เล่น 2 Guest B · ห้อง 102", sentAt: 0 },
      { id: "2", playerId: "photo", playerName: "Photo", turn: 1, text: "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 2 Guest B / Photograph: Guest B", sentAt: 1 },
    ] };
    expect(chooseLocalBotCommand(voting, voter)).toEqual({ event: "game:vote", payload: { roomNumber: 102 } });
  });
  it("uses the Witness floor direction shared in chat", () => {
    const voter = { ...privateState, canUseSkill: false, canVote: true, roomNumber: 201 };
    const voting = { ...state, phase: "VOTING" as const, publicRooms: [...state.publicRooms, { roomNumber: 301, state: "UNKNOWN" as const }], chatMessages: [{ id: "1", playerId: "witness", playerName: "Witness", turn: 1, text: "ฉันตรวจชั้น 2: ทิศทางชั้นนักฆ่า: ABOVE / I checked floor 2", sentAt: 0 }] };
    expect(chooseLocalBotCommand(voting, voter)).toEqual({ event: "game:vote", payload: { roomNumber: 301 } });
  });
});
