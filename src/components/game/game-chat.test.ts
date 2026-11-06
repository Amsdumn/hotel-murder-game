import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameChat } from "./game-chat";

const messages = [{ id: "1", playerId: "a", playerName: "Guest A", turn: 2, text: "ห้อง 101", sentAt: 1000 }];

describe("game chat", () => {
  it("shows the public discussion form to living players", () => {
    const html = renderToStaticMarkup(createElement(GameChat, { channel: "PUBLIC", messages, canSend: true, language: "th", onSend: async () => true }));
    expect(html).toContain("แชทช่วงพูดคุย");
    expect(html).toContain("Guest A");
    expect(html).toContain("ห้อง 101");
    expect(html).toContain('aria-label="ข้อความแชท"');
  });

  it("keeps murderer history readable but hides the send form outside its turn", () => {
    const html = renderToStaticMarkup(createElement(GameChat, { channel: "MURDERER", messages, canSend: false, language: "en", onSend: async () => true }));
    expect(html).toContain("Murderer team chat");
    expect(html).toContain("Guest A");
    expect(html).not.toContain('aria-label="Chat message"');
  });
});
