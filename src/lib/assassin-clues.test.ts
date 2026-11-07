import { describe, expect, it } from "vitest";
import { AVATAR_ORDER } from "./avatars";
import { avatarEnglish } from "./avatar-translations";
import { gameMessage } from "./game-copy";
import { avatarClueTraits, formerPoliceClue } from "./assassin-clues";

describe("Former Police Officer clues", () => {
  it("covers every public avatar with explicit visual traits", () => {
    expect(Object.keys(avatarClueTraits).sort()).toEqual([...AVATAR_ORDER].sort());
  });

  it("reveals progressively specific truths about the Assassin's assigned avatar", () => {
    expect(formerPoliceClue("irina-volkova", 1)).toBe("เบาะแสอดีตตำรวจเทิร์นที่ 1: เพศหญิง");
    expect(formerPoliceClue("irina-volkova", 2)).toBe("เบาะแสอดีตตำรวจเทิร์นที่ 2: อายุ 30–39 ปี");
    expect(formerPoliceClue("irina-volkova", 3)).toBe("เบาะแสอดีตตำรวจเทิร์นที่ 3: ผมสีแดง ผิวสีอ่อน");
    expect(formerPoliceClue("irina-volkova", 4)).toBe("เบาะแสอดีตตำรวจเทิร์นที่ 4: เกิดที่รัสเซีย");
  });

  it("handles legacy games without an assigned avatar privately", () => {
    expect(formerPoliceClue(null, 2)).toBe("เบาะแสอดีตตำรวจเทิร์นที่ 2: ไม่พบข้อมูลตัวละคร");
  });

  it("localizes the birthplace of every possible Assassin avatar", () => {
    for (const avatarId of AVATAR_ORDER) {
      expect(gameMessage(formerPoliceClue(avatarId, 4), "en")).toContain(avatarEnglish[avatarId].origin);
    }
  });
});
