import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotographerResult } from "./photographer-result";

const players = [
  { id: "photo", displayName: "Photographer", seatIndex: 0, avatarId: "irina-volkova" as const },
  { id: "killer", displayName: "Guest B", seatIndex: 1, avatarId: "adrian-blackwood" as const },
];
const message = "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น 2 Guest B";

describe("Photographer result", () => {
  it("shows the Killer's public portrait and player name in Thai and English", () => {
    for (const [language, label] of [["th", "นักฆ่าคือ"], ["en", "The Assassin is"]] as const) {
      const html = renderToStaticMarkup(createElement(PhotographerResult, { message, players, language }));
      expect(html).toContain("Guest B");
      expect(html).toContain(label);
      expect(html).toContain("adrian-blackwood-portrait.webp");
      expect(html).not.toContain("irina-volkova-portrait.webp");
    }
  });
});
