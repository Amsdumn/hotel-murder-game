import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AVATARS } from "@/lib/avatars";
import { AvatarDetail, AvatarGallery, MainMenu } from "./main-menu";

describe("homepage avatars", () => {
  it("shows a bilingual control for homepage ambience", () => {
    const html = renderToStaticMarkup(createElement(MainMenu));
    expect(html).toContain('aria-label="เปิดเสียง"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('autoplay=""');
  });
  it("shows a clickable animated GIF for all twelve story characters", () => {
    const html = renderToStaticMarkup(createElement(AvatarGallery, { onSelect: () => {} }));
    expect(AVATARS).toHaveLength(12);
    expect((html.match(/<button\b/g) ?? [])).toHaveLength(12);
    for (const avatar of AVATARS) {
      expect(html).toContain(`ดูตัวละคร${avatar.name}`);
      expect(html).toContain(`/art/avatars/${avatar.id}.gif`);
    }
    expect(html).not.toContain("-portrait.webp");
    expect(html).not.toContain("locksmith.webp");
  });

  it("loads the original animated GIF files in the gallery", () => {
    const html = renderToStaticMarkup(createElement(AvatarGallery, { onSelect: () => {} }));
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    expect(images).toHaveLength(12);
    for (const image of images) {
      expect(image).toMatch(/src="\/art\/avatars\/[a-z-]+\.gif"/);
      expect(image).not.toContain("/_next/image");
    }
  });

  it("opens each character's animated art and story without assigning a skill", () => {
    for (const avatar of AVATARS) {
      const html = renderToStaticMarkup(createElement(AvatarDetail, { avatarId: avatar.id }));
      expect(html).toContain(`/art/avatars/${avatar.id}.gif`);
      expect(html).toContain(avatar.introduction);
      expect(html).toContain("สุ่มเมื่อเริ่มเกม");
    }
  });
});
