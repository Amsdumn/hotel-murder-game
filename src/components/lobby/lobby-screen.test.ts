import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INNOCENT_ROLES } from "@/types/game";
import { InnocentRoleSettings } from "./lobby-screen";

describe("host role settings", () => {
  it("caps selectable Innocent roles at the maximum player count minus two", () => {
    const html = renderToStaticMarkup(createElement(InnocentRoleSettings, {
      mode: "CUSTOM", language: "th", selected: ["DETECTIVE", "WITNESS", "HOUSEKEEPER"], requiredCount: 3, onToggle: () => {}, onModeChange: () => {},
    }));
    expect(INNOCENT_ROLES).toHaveLength(9);
    expect(html).toContain("เลือก 3 บทบาทตามจำนวนผู้เล่นสูงสุด");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(6);
    expect(html.match(/disabled=""/g)).toHaveLength(6);
    expect(html).toContain("ผู้สมรู้ร่วมคิดจะเข้าร่วมเมื่อมีผู้เล่นตั้งแต่ 6 คนขึ้นไป");
  });

  it("offers custom and system-random role modes in both languages", () => {
    const custom = renderToStaticMarkup(createElement(InnocentRoleSettings, {
      mode: "CUSTOM", language: "th", selected: ["DETECTIVE"], requiredCount: 4, onModeChange: () => {}, onToggle: () => {},
    }));
    expect(custom).toContain("กำหนดเอง");
    expect(custom).toContain("สุ่มตามระบบ");
    expect(custom).toMatch(/<input[^>]*checked=""[^>]*value="CUSTOM"/);
    expect(custom).toContain("นักสืบ");
    const random = renderToStaticMarkup(createElement(InnocentRoleSettings, {
      mode: "RANDOM", language: "en", selected: ["DETECTIVE"], requiredCount: 4, onModeChange: () => {}, onToggle: () => {},
    }));
    expect(random).toContain("Choose roles yourself");
    expect(random).toContain("Let the system choose");
    expect(random).toMatch(/<input[^>]*checked=""[^>]*value="RANDOM"/);
    expect(random).toContain("draws distinct Innocent roles when the game starts");
    expect(random).not.toContain("Detective</button>");
  });
});
