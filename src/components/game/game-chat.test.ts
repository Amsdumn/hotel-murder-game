import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FloatingGameChat, GameChat, GameChatPanel, getUnreadChatCount } from "./game-chat";

const messages = [{ id: "1", playerId: "a", playerName: "Guest A", turn: 2, text: "ห้อง 101", sentAt: 1000 }];

describe("game chat", () => {
  it("counts only incoming messages received while the chat is closed", () => {
    expect(getUnreadChatCount([...messages, { ...messages[0], id: "2", playerId: "self" }, { ...messages[0], id: "3", playerId: "other" }], 1, "self")).toBe(1);
    expect(getUnreadChatCount(messages, 1, "self")).toBe(0);
  });
  it("shows the public discussion form to living players", () => {
    const html = renderToStaticMarkup(createElement(GameChat, { channel: "PUBLIC", messages, canSend: true, language: "th", onSend: async () => true }));
    expect(html).toContain("วงสนทนาในล็อบบี้");
    expect(html).toContain("Guest A");
    expect(html).toContain("ห้อง 101");
    expect(html).toContain('aria-label="ข้อความแชท"');
  });

  it("keeps murderer history readable but hides the send form outside its turn", () => {
    const html = renderToStaticMarkup(createElement(GameChat, { channel: "MURDERER", messages, canSend: false, language: "en", onSend: async () => true }));
    expect(html).toContain("Murderers&#x27; secret channel");
    expect(html).toContain("Guest A");
    expect(html).not.toContain('aria-label="Chat message"');
  });

  it("shows one chat button with public and private tabs for Murderers", () => {
    const props = { publicChat: { messages, canSend: true, deadline: Date.now() + 60_000 }, teamChat: { messages, canSend: true, deadline: Date.now() + 60_000 }, language: "en" as const, onSend: async () => true };
    const active = renderToStaticMarkup(createElement(FloatingGameChat, props));
    expect(active).toContain('aria-label="Open chat"');
    expect(active.match(/aria-label="Open chat"/g)).toHaveLength(1);
    expect(active).toContain('aria-expanded="false"');
    expect(active).toContain("bottom-4 left-2");
    expect(active).toContain("sm:left-4");
    expect(active).not.toContain('aria-label="Chat message"');
    const expired = renderToStaticMarkup(createElement(FloatingGameChat, { ...props, publicChat: { ...props.publicChat, deadline: Date.now() - 1000 }, teamChat: { ...props.teamChat, deadline: Date.now() - 1000 } }));
    expect(expired).toBe("");
  });
  it("shows a private tab only when team chat is available", () => {
    const base = { publicChat: { messages, canSend: true, deadline: Date.now() + 60_000 }, activeChannel: "PUBLIC" as const, language: "th" as const, now: Date.now(), readCounts: { PUBLIC: 0, MURDERER: 0 }, onSelect: () => {}, onSend: async () => true };
    const innocent = renderToStaticMarkup(createElement(GameChatPanel, base));
    expect(innocent).toContain('role="tablist"');
    expect(innocent).toContain("สาธารณะ");
    expect(innocent).not.toContain("เฉพาะฝ่ายฆาตกร");
    const murderer = renderToStaticMarkup(createElement(GameChatPanel, { ...base, teamChat: { messages, canSend: true, deadline: Date.now() + 60_000 } }));
    expect(murderer).toContain("เฉพาะฝ่ายฆาตกร");
    expect(murderer).toContain('aria-selected="true"');
    const privateTab = renderToStaticMarkup(createElement(GameChatPanel, { ...base, activeChannel: "MURDERER", teamChat: { messages, canSend: true, deadline: Date.now() + 60_000 } }));
    expect(privateTab).toMatch(/id="chat-panel-public"[^>]*hidden=""/);
    expect(privateTab).toMatch(/id="chat-panel-murderer"[^>]*><style/);
  });
});
