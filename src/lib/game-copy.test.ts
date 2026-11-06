import { describe, expect, it } from "vitest";
import { gameMessage } from "./game-copy";

describe("game message translation", () => {
  it("translates room and skill results without changing their numbers", () => {
    expect(gameMessage("พบร่องรอยปริศนาในห้อง 101, 203, 704", "en")).toBe("Mysterious clues found in rooms 101, 203, 704");
    expect(gameMessage("ชั้น 3 มีผู้เล่นที่ยังมีชีวิต 2 คน", "en")).toBe("Floor 3 has 2 living players");
    expect(gameMessage("ทิศทางชั้นนักฆ่า: ABOVE", "en")).toBe("Assassin's floor: above");
    expect(gameMessage("ล็อกห้อง 103 แล้ว", "th")).toBe("ล็อกห้อง 103 แล้ว");
    expect(gameMessage("ห้อง 101: ลอบสังหารสำเร็จ", "en")).toBe("Room 101: assassination succeeded");
    expect(gameMessage("ลอบสังหาร: 101 สำเร็จ, 102 ไม่สำเร็จ", "en")).toBe("Assassinations: 101 succeeded, 102 failed");
  });
  it("translates public events and preserves private player names", () => {
    expect(gameMessage("เปิดห้อง 202 · มีผู้พัก", "en")).toBe("Room 202 opened · occupied");
    expect(gameMessage("รอบ 3: เริ่มช่วงพูดคุย", "en")).toBe("Turn 3: discussion begins");
    expect(gameMessage("ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 5 Alex", "en")).toBe("Turn 3 photograph: the Assassin is player 5 Alex");
    expect(gameMessage("ใช้สกิล: ล็อกห้อง 103 แล้ว", "en")).toBe("Skill: Room 103 is locked");
    expect(gameMessage("Alex โหวตห้อง 102", "en")).toBe("Alex voted for room 102");
    expect(gameMessage("ข้อมูลจากผู้สมรู้ร่วมคิด: ผู้เล่นที่เลือกอยู่ชั้น 4", "en")).toBe("Accomplice report: The selected player is on floor 4");
  });
  it("localizes every Detective inspection outcome in results and action history", () => {
    for (const [code, thai, english] of [
      ["EMPTY", "ว่าง", "Empty"],
      ["INNOCENT", "ผู้บริสุทธิ์", "Innocent"],
      ["MURDERER", "ฆาตรกร", "Murderer"],
    ]) {
      expect(gameMessage(`ผลตรวจห้อง 203: ${code}`, "th")).toBe(`ผลตรวจห้อง 203: ${thai}`);
      expect(gameMessage(`ผลตรวจห้อง 203: ${code}`, "en")).toBe(`Room 203: ${english}`);
      expect(gameMessage(`ใช้สกิล: ผลตรวจห้อง 203: ${code}`, "th")).toBe(`ใช้สกิล: ผลตรวจห้อง 203: ${thai}`);
      expect(gameMessage(`ใช้สกิล: ผลตรวจห้อง 203: ${code}`, "en")).toBe(`Skill: Room 203: ${english}`);
    }
  });
  it("localizes every progressive Former Police Officer clue", () => {
    for (const [thai, english] of [
      ["เบาะแสอดีตตำรวจเทิร์นที่ 1: เพศหญิง", "Former Police clue, turn 1: woman"],
      ["เบาะแสอดีตตำรวจเทิร์นที่ 2: อายุ 30–39 ปี", "Former Police clue, turn 2: age 30–39"],
      ["เบาะแสอดีตตำรวจเทิร์นที่ 3: ผมสีแดง ผิวสีอ่อน", "Former Police clue, turn 3: red hair, light skin tone"],
      ["เบาะแสอดีตตำรวจเทิร์นที่ 4: เกิดที่รัสเซีย", "Former Police clue, turn 4: born in Russia"],
      ["เบาะแสอดีตตำรวจเทิร์นที่ 2: ไม่พบข้อมูลตัวละคร", "Former Police clue, turn 2: character details unavailable"],
    ]) {
      expect(gameMessage(thai, "th")).toBe(thai);
      expect(gameMessage(thai, "en")).toBe(english);
    }
  });
});
