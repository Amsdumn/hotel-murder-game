import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_ORDER, type PrivatePlayerState, type PublicGameState } from "@/types/game";
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
  it("shows story before the crime rooms and hides the hotel board during the prologue", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "ROLE_REVEAL", phaseDeadlineAt: 16000, publicHistory: [], publicRooms: publicState.publicRooms.map((room) => ({ ...room, state: "UNKNOWN" as const })) },
      privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain("ก่อนเรื่องราวจะเริ่ม");
    expect(html).toContain("พายุ");
    expect(html).not.toContain("แผนผัง");
    expect(html).not.toContain("ข้อมูลลับ");
    expect(html).not.toContain("ที่เกิดเหตุ");
  });
  it("offers voting on the hotel board only to an eligible player", () => {
    const render = (viewer: PrivatePlayerState | null) => renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "VOTING" }, privateState: viewer, teamState: null,
      result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));

    expect(render({ ...privateState, canVote: true })).toContain('aria-label="โหวตห้อง 101');
    expect(render({ ...privateState, canVote: true })).toContain('aria-label="โหวตห้อง 102');
    expect(render({ ...privateState, canVote: true })).not.toContain("ลงคะแนนเปิดห้อง");
    expect(render(privateState)).not.toContain('aria-label="โหวตห้อง');
    expect(render({ ...privateState, isAlive: false, mode: "SPECTATOR" })).not.toContain('aria-label="โหวตห้อง');
    expect(render(null)).not.toContain('aria-label="โหวตห้อง');
  });

  it("only makes eligible runoff rooms clickable on the board", () => {
    const state: PublicGameState = { ...publicState, phase: "VOTING", runoffRooms: [101, 103], publicRooms: [
      { roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "UNKNOWN" },
      { roomNumber: 103, state: "MURDERED" }, { roomNumber: 201, state: "CRIME_SCENE" },
      { roomNumber: 202, state: "OPENED_EMPTY" },
    ] };
    const html = renderToStaticMarkup(createElement(HotelBoard, { state, onVote: () => {} }));
    expect(html).toContain('aria-label="โหวตห้อง 101');
    expect(html).toContain('aria-label="โหวตห้อง 103');
    expect(html).not.toContain('aria-label="โหวตห้อง 102');
    expect(html).not.toContain('aria-label="โหวตห้อง 201');
    expect(html).not.toContain('aria-label="โหวตห้อง 202');
  });

  it("starts with private role, room, and action history hidden", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, { state: publicState, privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }) }));
    expect(html).toContain("แสดงข้อมูลลับ");
    expect(html).not.toContain("ลอบสังหารห้อง 102: สำเร็จ");
    expect(html).not.toContain("ห้องพัก 202");
    expect(html).not.toContain("ฉากห้องพักของคุณ");
    expect(html).not.toContain("ความสามารถ · ฆาตกร");
  });

  it("shows the owner's ability under the room for every role", () => {
    const abilityPhrases = {
      LOCKSMITH: "ล็อกห้องหนึ่งห้อง",
      HOUSEKEEPER: "จำนวนผู้เล่นที่ยังมีชีวิตบนชั้น",
      WINDOW_CLEANER: "แนวห้อง 01, 02 หรือ 03",
      WITNESS: "ชั้นสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน",
      DETECTIVE: "ตรวจหนึ่งห้อง",
      ACCOMPLICE: "เลือกผู้เล่นหนึ่งคน",
      KILLER: "ลอบสังหารผู้พักที่ยังมีชีวิต",
    };
    for (const role of ROLE_ORDER) {
      const html = renderToStaticMarkup(createElement(PrivateRoomScene, {
        role, roomNumber: 301, team: role === "KILLER" || role === "ACCOMPLICE" ? "MURDERER" : "INNOCENT", isAlive: true,
      }));
      expect(html).toContain("ความสามารถ ·");
      expect(html).toContain(abilityPhrases[role]);
    }
    const locksmith = renderToStaticMarkup(createElement(PrivateRoomScene, { role: "LOCKSMITH", roomNumber: 301, team: "INNOCENT", isAlive: true }));
    expect(locksmith).toContain("ล็อกห้องหนึ่งห้องในรอบนั้น");
    expect(locksmith).not.toContain("ลอบสังหารผู้พักที่ยังมีชีวิต");
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

  it("shows morning outside the private room window only during the owner's skill turn", () => {
    const render = (viewer: PrivatePlayerState) => renderToStaticMarkup(createElement(PrivateInfoPanel, {
      privateState: viewer, teamState: null, players: publicState.players, open: true, onToggle: () => {},
    }));
    expect(render(privateState)).not.toContain("hotel-room-morning.webp");
    expect(render({ ...privateState, canUseSkill: true })).toContain("hotel-room-morning.webp");
    expect(render({ ...privateState, isAlive: false, canUseSkill: false, mode: "SPECTATOR" })).not.toContain("hotel-room-morning.webp");
  });

  it("shows a circular role portrait and team status on the room frame", () => {
    const html = renderToStaticMarkup(createElement(PrivateRoomScene, {
      role: "WITNESS", roomNumber: 301, team: "INNOCENT", isAlive: false,
    }));
    expect(html).toContain("sizes=\"50px\"");
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
