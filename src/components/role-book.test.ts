import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLE_ORDER } from "@/types/game";
import { roleNames, roleNamesEn } from "./role-portrait";
import { RoleBook } from "./role-book";

describe("role book", () => {
  it("explains all ten roles and the important skill exceptions in Thai", () => {
    const html = renderToStaticMarkup(createElement(RoleBook, { language: "th" }));
    expect((html.match(/<article\b/g) ?? [])).toHaveLength(10);
    for (const role of ROLE_ORDER) expect(html).toContain(roleNames[role]);
    expect(html).toContain("ล็อกห้องเดิมซ้ำไม่ได้");
    expect(html).toContain("เทิร์นที่ 3");
    expect(html).toContain("ชั้นที่นักฆ่าเลือก");
  });

  it("explains the same roles and exceptions in English", () => {
    const html = renderToStaticMarkup(createElement(RoleBook, { language: "en" }));
    expect((html.match(/<article\b/g) ?? [])).toHaveLength(10);
    for (const role of ROLE_ORDER) expect(html).toContain(roleNamesEn[role]);
    expect(html).toContain("cannot lock the same room again");
    expect(html).toContain("turn 3");
    expect(html).toContain("at least one targeted room is on your chosen floor");
    expect(html).toContain("Five-player games have one Assassin and four different Innocent roles");
    expect(html).toContain("both can kill their occupants");
  });
});
