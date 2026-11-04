import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PrivatePlayerState, PublicGameState } from "@/types/game";
import { GameScreen, HotelBoard, PrivateInfoPanel, getTurnNotice } from "./game-screen";

const privateState: PrivatePlayerState = {
  playerId: "a", role: "KILLER", team: "MURDERER", roomNumber: 202,
  isAlive: true, mode: "PLAYER", canUseSkill: false, canVote: false,
  privateResults: ["ลอบสังหารสำเร็จ"],
  actionHistory: [{ turn: 1, type: "SKILL", message: "ลอบสังหารห้อง 102: สำเร็จ" }],
};

const publicState: PublicGameState = {
  code: "ABC234", version: 3, phase: "SKILL_PHASE", turn: 1,
  players: [{ id: "a", displayName: "Guest", seatIndex: 0 }], phaseMessage: "กำลังดำเนินการสืบสวน...",
  publicRooms: [{ roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "MURDERED" }],
  publicHistory: [{ type: "MURDER_OCCURRED", message: "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม" }],
};

describe("game privacy and turn UI", () => {
  it("starts with private role, room, and action history hidden", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, { state: publicState, privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }) }));
    expect(html).toContain("แสดงข้อมูลลับ");
    expect(html).not.toContain("ลอบสังหารห้อง 102: สำเร็จ");
    expect(html).not.toContain("ห้องพัก 202");
  });

  it("reveals only the owner's information when opened", () => {
    const html = renderToStaticMarkup(createElement(PrivateInfoPanel, { privateState, teamState: null, players: publicState.players, open: true, onToggle: () => {} }));
    expect(html).toContain("ห้องพัก 202");
    expect(html).toContain("ลอบสังหารห้อง 102: สำเร็จ");
  });

  it("shows a quiet hotel board with public room states", () => {
    const html = renderToStaticMarkup(createElement(HotelBoard, { state: publicState }));
    expect(html).toContain("ห้อง 102 ถูกฆาตกรรม");
    expect(html).not.toContain("KILLER");
    expect(html).not.toContain("Guest");
  });

  it("alerts only the active skill actor to act", () => {
    expect(getTurnNotice(publicState, { ...privateState, canUseSkill: true })).toContain("ถึงตาคุณใช้สกิล");
    expect(getTurnNotice(publicState, privateState)).not.toContain("ถึงตาคุณใช้สกิล");
    expect(getTurnNotice({ ...publicState, phase: "DISCUSSION" }, privateState)).toContain("ช่วงพูดคุย");
    expect(getTurnNotice({ ...publicState, phase: "VOTING" }, { ...privateState, canVote: true })).toContain("ถึงตาคุณลงคะแนน");
    expect(getTurnNotice({ ...publicState, phase: "VOTING" }, null)).toContain("ช่วงลงคะแนน");
  });
});
