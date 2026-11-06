import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INNOCENT_ROLES } from "@/types/game";
import { InnocentRoleSettings } from "./lobby-screen";

describe("host role settings", () => {
  it("caps selectable Innocent roles at the maximum player count minus two", () => {
    const html = renderToStaticMarkup(createElement(InnocentRoleSettings, {
      selected: ["DETECTIVE", "WITNESS", "HOUSEKEEPER"], requiredCount: 3, onToggle: () => {},
    }));
    expect(INNOCENT_ROLES).toHaveLength(8);
    expect(html).toContain("เลือก 3 บทบาทตามจำนวนผู้เล่นสูงสุด");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(5);
    expect(html.match(/disabled=""/g)).toHaveLength(5);
    expect(html).toContain("ฆาตกรและผู้สมรู้ร่วมคิดจะอยู่ในเกมเสมอ");
  });
});
