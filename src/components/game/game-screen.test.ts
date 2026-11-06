import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_ORDER, type PrivatePlayerState, type PublicGameState } from "@/types/game";
import { GameResultScreen, GameScreen, HotelBoard, PrivateInfoPanel, PublicGuests, RoleRevealCard, SkillConfirmBar, SkillPanel, SkillResultOverlay, getFreshSkillResults, getTurnNotice, skillActionInstructions } from "./game-screen";
import { PrivateRoomScene } from "./private-room-scene";
import { roleSkillDescriptions } from "@/lib/role-skills";
import { roleNames } from "../role-portrait";

const privateState: PrivatePlayerState = {
  playerId: "a", role: "KILLER", team: "MURDERER", roomNumber: 202,
  version: 4, isAlive: true, mode: "PLAYER", canUseSkill: false, canVote: false,
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
  it("shows only a newly received private skill result", () => {
    const previous = { ...privateState, actionHistory: [], privateResults: [] };
    expect(getFreshSkillResults(null, privateState)).toEqual([]);
    expect(getFreshSkillResults(previous, { ...previous, actionHistory: [{ turn: 1, type: "VOTE", message: "โหวตห้อง 101" }] })).toEqual([]);
    expect(getFreshSkillResults(previous, { ...previous, actionHistory: [{ turn: 1, type: "SKILL", message: "ใช้สกิล: พบผู้เล่น 2 คน" }] })).toEqual(["ใช้สกิล: พบผู้เล่น 2 คน"]);
    expect(getFreshSkillResults(previous, { ...previous, privateResults: ["ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือ Guest B"] })).toEqual(["ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือ Guest B"]);
    expect(getFreshSkillResults(previous, { ...previous, privateResults: ["ข้อมูลจากผู้สมรู้ร่วมคิด: ผู้เล่นที่เลือกอยู่ชั้น 4"] })).toEqual(["ข้อมูลจากผู้สมรู้ร่วมคิด: ผู้เล่นที่เลือกอยู่ชั้น 4"]);
    expect(getFreshSkillResults(previous, { ...previous, privateResults: ["ผลแรก", "ผลถัดมา"] })).toEqual(["ผลแรก", "ผลถัดมา"]);
  });

  it("renders the private result as a focused screen", () => {
    const html = renderToStaticMarkup(createElement(SkillResultOverlay, { message: "ใช้สกิล: พบผู้เล่น 2 คน", language: "th" }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain("MuiDialog");
    expect(html).toContain("ผลลัพธ์สกิล");
    expect(html).toContain("พบผู้เล่น 2 คน");
  });
  it("identifies an Accomplice report in the Assassin's centered dialog", () => {
    const html = renderToStaticMarkup(createElement(SkillResultOverlay, { message: "ข้อมูลจากผู้สมรู้ร่วมคิด: ผู้เล่นที่เลือกอยู่ชั้น 4", language: "th" }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain("ข้อมูลจากผู้สมรู้ร่วมคิด");
    expect(html).toContain("ผู้เล่นที่เลือกอยู่ชั้น 4");
    expect(html).not.toContain("ผลลัพธ์สกิล");
  });
  it("provides English phase guidance without exposing a hidden role", () => {
    expect(getTurnNotice(publicState, { ...privateState, canUseSkill: true }, "en")).toContain("Choose a target");
    expect(getTurnNotice(publicState, null, "en")).toBe("Skill phase: waiting for the active player.");
  });
  it("provides a home button after the result", () => {
    const html = renderToStaticMarkup(createElement(GameResultScreen, { result: { winner: "INNOCENT", turnsPlayed: 2, players: [], events: [] } }));
    expect(html).toContain("กลับหน้าแรก");
    expect(html).toContain('href="/"');
  });
  it("calls the murderer-team assassin นักฆ่า while retaining the team name", () => {
    expect(roleNames.KILLER).toBe("นักฆ่า");
    const html = renderToStaticMarkup(createElement(RoleRevealCard, { privateState }));
    expect(html).toContain("นักฆ่า · ห้อง 202");
    expect(html).toContain("ฝ่ายฆาตกร");
  });
  it("offers a private role reveal during the prologue without exposing it before the player opens it", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "ROLE_REVEAL", phaseDeadlineAt: 16000, publicHistory: [], publicRooms: publicState.publicRooms.map((room) => ({ ...room, state: "UNKNOWN" as const })) },
      privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain("ก่อนเรื่องราวจะเริ่ม");
    expect(html).toContain("พายุ");
    expect(html).toContain("เปิดดูบทบาทของฉัน");
    expect(html).not.toContain("ห้อง 202");
    const revealed = renderToStaticMarkup(createElement(RoleRevealCard, { privateState }));
    expect(revealed).toContain("ฆาตกร");
    expect(revealed).toContain("ห้อง 202");
    expect(revealed).toContain(roleSkillDescriptions.KILLER);
    expect(html).not.toContain("แผนผัง");
    expect(html).not.toContain("ยืนยันสกิล");
    expect(html).not.toContain("ที่เกิดเหตุ");
  });

  it("shows a private blackout explanation and the voting and resolution clocks", () => {
    expect(getTurnNotice(publicState, { ...privateState, skillBlockReason: "BLACKOUT" })).toContain("ไฟดับ");
    const render = (phase: PublicGameState["phase"]) => renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase, phaseDeadlineAt: Date.now() + 60_000, publicHistory: [{ type: "ROOM_OPENED", message: "เปิดห้อง 101 · ห้องว่าง" }] },
      privateState: { ...privateState, canVote: phase === "VOTING" }, teamState: null, result: null,
      murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(render("VOTING")).toContain("เวลาลงคะแนน");
    expect(render("RESOLUTION")).toContain("เปิดห้อง 101 · ห้องว่าง");
    expect(render("RESOLUTION")).toContain("เริ่มรอบถัดไปใน");
  });

  it("floats the discussion clock at the top center of the viewport", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "DISCUSSION", phaseDeadlineAt: Date.now() + 60_000 },
      privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain('class="fixed inset-x-0 top-3');
    expect(html).toContain("เวลาพูดคุย");
  });

  it("keeps the personal blackout notice visible after the skill phase ends", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "DISCUSSION" },
      privateState: { ...privateState, skillBlockReason: "BLACKOUT" }, teamState: null, result: null,
      murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain("ไฟดับบนชั้นของคุณ รอบนี้จึงใช้สกิลไม่ได้");
    expect(html).toContain("ช่วงพูดคุย");
  });

  it("prompts the receptionist to open the private panel when the third-turn register arrives", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, turn: 3 },
      privateState: { ...privateState, role: "RECEPTIONIST", team: "INNOCENT", privateResults: ["ทะเบียนห้องพักเทิร์นที่ 3: Guest · ห้อง 202"] },
      teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain("มีผลสืบสวนส่วนตัวใหม่ เปิดข้อมูลลับเพื่อดู");
    expect(html).not.toContain("ทะเบียนห้องพักเทิร์นที่ 3:");
  });
  it("prompts the photographer to open the private photo result without exposing it publicly", () => {
    for (const turn of [3, 4]) {
      const html = renderToStaticMarkup(createElement(GameScreen, {
        state: { ...publicState, turn },
        privateState: { ...privateState, role: "PHOTOGRAPHER", team: "INNOCENT", privateResults: ["ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 2 Guest B"] },
        teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
        onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
      }));
      expect(html).toContain("มีผลสืบสวนส่วนตัวใหม่ เปิดข้อมูลลับเพื่อดู");
      expect(html).not.toContain("นักฆ่าคือผู้เล่น 2 Guest B");
    }
    expect(roleNames.PHOTOGRAPHER).toBe("ช่างภาพ");
  });
  it("offers voting on the hotel board only to an eligible player", () => {
    const render = (viewer: PrivatePlayerState | null) => renderToStaticMarkup(createElement(GameScreen, {
      state: { ...publicState, phase: "VOTING" }, privateState: viewer, teamState: null,
      result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));

    expect(render({ ...privateState, canVote: true })).toContain('aria-label="โหวตห้อง 101');
    expect(render({ ...privateState, canVote: true })).not.toContain('aria-label="โหวตห้อง 102');
    expect(render({ ...privateState, canVote: true })).not.toContain("ลงคะแนนเปิดห้อง");
    expect(render(privateState)).not.toContain('aria-label="โหวตห้อง');
    expect(render({ ...privateState, isAlive: false, mode: "SPECTATOR" })).not.toContain('aria-label="โหวตห้อง');
    expect(render(null)).not.toContain('aria-label="โหวตห้อง');
  });

  it("shows vote counts on rooms and voter names in public history", () => {
    const state: PublicGameState = {
      ...publicState, phase: "VOTING", players: [
        { id: "a", displayName: "Guest A", seatIndex: 0 },
        { id: "b", displayName: "Guest B", seatIndex: 1 },
        { id: "c", displayName: "Guest C", seatIndex: 2 },
      ],
      votes: [{ playerId: "a", roomNumber: 101 }, { playerId: "b", roomNumber: 101 }, { playerId: "c", roomNumber: 103 }],
      publicHistory: [{ type: "VOTE_CAST", message: "Guest A โหวตห้อง 101" }],
      publicRooms: [{ roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "UNKNOWN" }, { roomNumber: 103, state: "UNKNOWN" }],
    };
    const board = renderToStaticMarkup(createElement(HotelBoard, { state, selfId: "a" }));
    expect(board).toContain("2 โหวต");
    expect(board).not.toContain("Guest A");
    expect(board).not.toContain("Guest B");
    expect(board).not.toContain("Guest C");
    expect(board).not.toContain("คุณโหวตห้อง 101");
    const screen = renderToStaticMarkup(createElement(GameScreen, { state, privateState, teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "", onCommand: async () => ({ ok: true as const, data: { version: 4 } }) }));
    expect(screen).toContain("คุณโหวตห้อง 101 แล้ว");
    expect(screen).toContain("Guest A โหวตห้อง 101");
  });

  it("only makes eligible runoff rooms clickable on the board", () => {
    const state: PublicGameState = { ...publicState, phase: "VOTING", runoffRooms: [101, 103], publicRooms: [
      { roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "UNKNOWN" },
      { roomNumber: 103, state: "MURDERED" }, { roomNumber: 201, state: "CRIME_SCENE" },
      { roomNumber: 202, state: "OPENED_EMPTY" },
    ] };
    const html = renderToStaticMarkup(createElement(HotelBoard, { state, onVote: () => {} }));
    expect(html).toContain('aria-label="โหวตห้อง 101');
    expect(html).not.toContain('aria-label="โหวตห้อง 103');
    expect(html).not.toContain('aria-label="โหวตห้อง 102');
    expect(html).not.toContain('aria-label="โหวตห้อง 201');
    expect(html).not.toContain('aria-label="โหวตห้อง 202');
  });

  it("fades every opened room to 0.35 opacity", () => {
    const state: PublicGameState = { ...publicState, publicRooms: [
      { roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "OPENED_EMPTY" },
      { roomNumber: 103, state: "OPENED_OCCUPIED" }, { roomNumber: 201, state: "OPENED_MURDERED" },
    ] };
    const html = renderToStaticMarkup(createElement(HotelBoard, { state }));
    expect((html.match(/opacity-\[0\.35\]/g) ?? [])).toHaveLength(3);
  });

  it("excludes clue, opened, and murdered rooms from every room skill", () => {
    const state: PublicGameState = { ...publicState, publicRooms: [
      { roomNumber: 101, state: "UNKNOWN" }, { roomNumber: 102, state: "CRIME_SCENE" },
      { roomNumber: 103, state: "OPENED_EMPTY" }, { roomNumber: 201, state: "MURDERED" },
    ] };
    const html = renderToStaticMarkup(createElement(HotelBoard, { state, onSkillRoomSelect: () => {}, selectedSkillRoom: 101 }));
    expect(html).toContain('aria-label="เลือกห้อง 101 เป็นเป้าหมายสกิล');
    for (const room of [102, 103, 201]) expect(html).not.toContain(`aria-label="เลือกห้อง ${room} เป็นเป้าหมายสกิล`);
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('aria-label="โหวตห้อง');
  });

  it("does not offer rooms already protected by the Locksmith as skill targets", () => {
    const state = { ...publicState, publicRooms: [{ roomNumber: 101, state: "UNKNOWN" as const }, { roomNumber: 102, state: "UNKNOWN" as const }] };
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state,
      privateState: { ...privateState, role: "LOCKSMITH", team: "INNOCENT", canUseSkill: true, locksmithUsedRooms: [101], skillDeadlineAt: Date.now() + 60_000 },
      teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).not.toContain('aria-label="เลือกห้อง 101 เป็นเป้าหมายสกิล');
    expect(html).toContain('aria-label="เลือกห้อง 102 เป็นเป้าหมายสกิล');
    expect(html).toContain("เคยล็อกแล้ว");
  });

  it("explains room skill targets without an inline confirm button", () => {
    const render = (role: PrivatePlayerState["role"], selectedRoom: number | null) => renderToStaticMarkup(createElement(SkillPanel, {
      privateState: { ...privateState, role }, state: publicState, selectedRoom,
    }));
    for (const role of ["LOCKSMITH", "DETECTIVE", "KILLER"] as const) {
      expect(render(role, null)).toContain("แตะห้องบนแผนผังโรงแรม");
      expect(render(role, null)).not.toContain("ยืนยันสกิล");
      expect(render(role, null)).not.toContain('role="combobox"');
      expect(render(role, 102)).toContain("เป้าหมาย: ห้อง 102");
    }
    expect(render("HOUSEKEEPER", null)).toContain("แตะเลขชั้นบนแผนผัง");
  });

  it("offers floor and column controls on the hotel board only for those skill targets", () => {
    const state = { ...publicState, publicRooms: [...publicState.publicRooms, { roomNumber: 103, state: "UNKNOWN" as const }, { roomNumber: 201, state: "CRIME_SCENE" as const }, { roomNumber: 202, state: "UNKNOWN" as const }, { roomNumber: 203, state: "OPENED_EMPTY" as const }] };
    const floorHtml = renderToStaticMarkup(createElement(HotelBoard, { state, onSkillFloorSelect: () => {}, selectedSkillFloor: 2 }));
    expect(floorHtml).toContain('aria-label="เลือกชั้น 2 เป็นเป้าหมายสกิล"');
    expect(floorHtml).not.toContain('aria-label="เลือกชั้น 7 เป็นเป้าหมายสกิล"');
    expect(floorHtml).not.toContain('aria-label="เลือกชั้น 2 ผ่านห้อง 201"');
    expect(floorHtml).toContain('aria-label="เลือกชั้น 2 ผ่านห้อง 202" aria-pressed="true"');
    expect(floorHtml).toContain('aria-pressed="true"');
    expect(floorHtml).not.toContain('aria-label="เลือกแนวห้อง');
    expect(floorHtml).not.toContain('aria-label="โหวตห้อง');

    const columnHtml = renderToStaticMarkup(createElement(HotelBoard, { state, onSkillColumnSelect: () => {}, selectedSkillColumn: 3 }));
    expect(columnHtml).toContain('aria-label="เลือกแนวห้อง 01 เป็นเป้าหมายสกิล"');
    expect(columnHtml).toContain('aria-label="เลือกแนวห้อง 03 เป็นเป้าหมายสกิล"');
    expect(columnHtml).not.toContain('aria-label="เลือกแนวห้อง 03 ผ่านห้อง 203"');
    expect(columnHtml).toContain('aria-label="เลือกแนวห้อง 03 ผ่านห้อง 103" aria-pressed="true"');
    expect(columnHtml).toContain('aria-pressed="true"');
    expect(columnHtml).not.toContain('aria-label="เลือกชั้น');
    expect(columnHtml).not.toContain('aria-label="โหวตห้อง');
  });

  it("requires a board selection for floor and column skills", () => {
    for (const role of ["ELECTRICIAN", "HOUSEKEEPER", "WITNESS"] as const) {
      const empty = renderToStaticMarkup(createElement(SkillPanel, { privateState: { ...privateState, role }, state: publicState, selectedFloor: null }));
      expect(empty).toContain("แตะเลขชั้นบนแผนผัง");
      const selected = renderToStaticMarkup(createElement(SkillPanel, { privateState: { ...privateState, role }, state: publicState, selectedFloor: 4 }));
      expect(selected).toContain("เป้าหมาย: ชั้น 4");
    }
    const windowCleaner = { ...privateState, role: "WINDOW_CLEANER" as const };
    const empty = renderToStaticMarkup(createElement(SkillPanel, { privateState: windowCleaner, state: publicState, selectedColumn: null }));
    expect(empty).toContain("แตะหัวแนวห้องบนแผนผัง");
    const selected = renderToStaticMarkup(createElement(SkillPanel, { privateState: windowCleaner, state: publicState, selectedColumn: 2 }));
    expect(selected).toContain("เป้าหมาย: แนวห้อง 02");
  });

  it("keeps confirmation fixed at the bottom and disabled until a target is selected", () => {
    const empty = renderToStaticMarkup(createElement(SkillConfirmBar, { targetLabel: "ยังไม่ได้เลือกเป้าหมาย", canSubmit: false, onConfirm: () => {} }));
    const selected = renderToStaticMarkup(createElement(SkillConfirmBar, { targetLabel: "ห้อง 102", canSubmit: true, onConfirm: () => {} }));
    expect(empty).toContain('class="fixed inset-x-0 bottom-4');
    expect(empty).toContain('disabled=""');
    expect(selected).toContain("ยืนยันสกิล");
    expect(selected).not.toContain('disabled=""');
  });

  it("allows selecting an accomplice target from guest cards without a default target", () => {
    const players = [{ id: "a", displayName: "Self", seatIndex: 0 }, { id: "b", displayName: "Guest B", seatIndex: 1 }];
    const html = renderToStaticMarkup(createElement(PublicGuests, { players, selfId: "a", selectedPlayerId: null, onSelectPlayer: () => {} }));
    expect(html).toContain('aria-label="เลือกผู้เข้าพัก Guest B เป็นเป้าหมายสกิล"');
    expect(html).not.toContain('aria-label="เลือกผู้เข้าพัก Self');
    expect(html).toContain('aria-pressed="false"');
    expect(renderToStaticMarkup(createElement(SkillPanel, { privateState: { ...privateState, role: "ACCOMPLICE" }, state: { ...publicState, players }, selectedPlayerId: null }))).toContain("แตะผู้เข้าพักในรายชื่อ");
  });

  it("provides a clear action instruction for every skill", () => {
    for (const role of ROLE_ORDER) expect(skillActionInstructions[role]).toBeTruthy();
    expect(skillActionInstructions.ACCOMPLICE).toContain("ผู้เข้าพัก");
  });

  it("shows the active player a prominent action prompt and bottom confirmation", () => {
    const html = renderToStaticMarkup(createElement(GameScreen, {
      state: publicState,
      privateState: { ...privateState, canUseSkill: true, skillDeadlineAt: Date.now() + 60_000 },
      teamState: null, result: null, murderSequence: 0, connected: true, connectionMessage: "",
      onCommand: async () => ({ ok: true as const, data: { version: 4 } }),
    }));
    expect(html).toContain(skillActionInstructions.KILLER);
    expect(html).toContain('aria-label="เลือกห้อง 101 เป็นเป้าหมายสกิล');
    expect(html).toContain('aria-label="ยืนยันการใช้สกิล"');
    expect(html).toContain("ยังไม่ได้เลือกเป้าหมาย");
    expect(html).not.toContain("แสดงข้อมูลลับและวิธีใช้สกิล");
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
      ELECTRICIAN: "ดับไฟหนึ่งชั้น",
      LOCKSMITH: "ล็อกห้องหนึ่งห้อง",
      HOUSEKEEPER: "จำนวนผู้เล่นที่ยังมีชีวิตบนชั้น",
      WINDOW_CLEANER: "แนวห้อง 01, 02 หรือ 03",
      WITNESS: "นักฆ่าเลือกห้อง",
      RECEPTIONIST: "เทิร์นที่ 3",
      PHOTOGRAPHER: "ภาพถ่าย",
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

  it("keeps the private room at night during the owner's skill turn", () => {
    const render = (viewer: PrivatePlayerState) => renderToStaticMarkup(createElement(PrivateInfoPanel, {
      privateState: viewer, teamState: null, players: publicState.players, open: true, onToggle: () => {},
    }));
    expect(render({ ...privateState, canUseSkill: true })).not.toContain("hotel-room-morning.webp");
    expect(render({ ...privateState, canUseSkill: true })).toContain('data-skill-active="true"');
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

  it("uses the 3D anime cutouts for the electrician and receptionist", () => {
    for (const [role, asset] of [["ELECTRICIAN", "marcus-johnson.webp"], ["RECEPTIONIST", "irina-volkova.webp"]] as const) {
      const html = renderToStaticMarkup(createElement(PrivateRoomScene, { role, roomNumber: 301, team: "INNOCENT", isAlive: true }));
      expect(html).toContain(asset);
    }
  });

  it("shows the assigned public avatar in the private room regardless of secret role", () => {
    const html = renderToStaticMarkup(createElement(PrivateRoomScene, { role: "KILLER", roomNumber: 301, team: "MURDERER", isAlive: true, avatarId: "irina-volkova" }));
    expect(html).toContain("irina-volkova.webp");
    expect(html).toContain("irina-volkova-portrait.webp");
    expect(html).toContain("ความสามารถ · นักฆ่า");
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
