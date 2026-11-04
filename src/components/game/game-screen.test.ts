import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PrivatePlayerState, PublicGameState } from "@/types/game";
import { GameScreen, HotelBoard, PrivateInfoPanel, getTurnNotice } from "./game-screen";
import { PrivateRoomScene } from "./private-room-scene";

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
  it("shows the voting panel only to a player who can vote", () => {
    const render = (viewer: PrivatePlayerState | null) => renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "VOTING" }, privateState: viewer, teamState: null,
      result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));

    expect(render({ ...privateState, canVote: true })).toContain("ลงคะแนนเปิดห้อง");
    expect(render(privateState)).not.toContain("ลงคะแนนเปิดห้อง");
    expect(render({ ...privateState, isAlive: false, mode: "SPECTATOR" })).not.toContain("ลงคะแนนเปิดห้อง");
    expect(render(null)).not.toContain("ลงคะแนนเปิดห้อง");
  });

  it("starts with private role, room, and action history hidden", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, { state: publicState, privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }) }));
    expect(html).toContain("แสดงข้อมูลลับ");
    expect(html).not.toContain("ลอบสังหารห้อง 102: สำเร็จ");
    expect(html).not.toContain("ห้องพัก 202");
    expect(html).not.toContain("ฉากห้องพักของคุณ");
  });

  it("reveals only the owner's information when opened", () => {
    const html = renderToStaticMarkup(createElement(PrivateInfoPanel, { privateState, teamState: null, players: publicState.players, open: true, onToggle: () => {} }));
    expect(html).toContain("ห้อง 202");
    expect(html).toContain("ลอบสังหารห้อง 102: สำเร็จ");
    expect(html).toContain("ฉากห้องพักของคุณ");
    expect(html).toContain("data-character-role=\"KILLER\"");
    expect(html).toContain("killer-3d.webp");
    expect(html).toContain("hotel-room-3d.webp");
    expect(html.match(/ฝ่ายฆาตกร/g)).toHaveLength(1);
    expect(html).toContain("ยังมีชีวิต");
  });

  it("shows a 30px circular role portrait and team status on the room frame", () => {
    const html = renderToStaticMarkup(createElement(PrivateRoomScene, {
      role: "WITNESS", roomNumber: 301, team: "INNOCENT", isAlive: false,
    }));
    expect(html).toContain("sizes=\"30px\"");
    expect(html).toContain("ภาพตัวละครพยาน");
    expect(html).toContain("ฝ่ายผู้บริสุทธิ์");
    expect(html).toContain("เสียชีวิต");
    expect(html).toContain("hotel-room-3d.webp");
    expect(html).not.toContain("data-character-role=\"WITNESS\"");
    expect(html).not.toContain("witness-3d.webp");
  });

  it("uses the player's own room and character in the animated scene", () => {
    const html = renderToStaticMarkup(createElement(PrivateInfoPanel, {
      privateState: { ...privateState, role: "DETECTIVE", roomNumber: 703 },
      teamState: null, players: publicState.players, open: true, onToggle: () => {},
    }));
    expect(html).toContain("data-character-role=\"DETECTIVE\"");
    expect(html).toContain("detective-3d.webp");
    expect(html).toContain("ห้อง 703");
    expect(html).not.toContain("data-character-role=\"KILLER\"");
    expect(html).not.toContain("killer-3d.webp");
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
