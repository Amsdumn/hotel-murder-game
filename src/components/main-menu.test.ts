import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import nextConfig from "../../next.config";
import { AVATARS } from "@/lib/avatars";
import { AvatarDetail, AvatarGallery } from "./main-menu";

describe("homepage avatars", () => {
  it("shows a clickable 3D anime portrait for all twelve story characters", () => {
    const html = renderToStaticMarkup(createElement(AvatarGallery, { onSelect: () => {} }));
    expect(AVATARS).toHaveLength(12);
    expect((html.match(/<button\b/g) ?? [])).toHaveLength(12);
    for (const avatar of AVATARS) {
      expect(html).toContain(`ดูตัวละคร${avatar.name}`);
      expect(html).toContain(avatar.portrait.split("/").at(-1));
    }
    expect(html).toContain("adrian-blackwood-portrait.webp");
    expect(html).toContain("seo-yeon-kim-portrait.webp");
    expect(html).toContain("rafael-costa-portrait.webp");
    expect(html).toContain("anaya-mehta-portrait.webp");
    expect(html).toContain("yusuf-demir-portrait.webp");
    expect(html).not.toContain("locksmith.webp");
  });

  it("requests compact gallery portraits from the image optimizer", () => {
    const html = renderToStaticMarkup(createElement(ImageConfigContext.Provider, {
      value: { ...imageConfigDefault, ...nextConfig.images },
    }, createElement(AvatarGallery, { onSelect: () => {} })));
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    expect(images).toHaveLength(12);
    for (const image of images) expect(image).toContain("q=65");
  });

  it("opens each character's full-body art and story without assigning a skill", () => {
    for (const avatar of AVATARS) {
      const html = renderToStaticMarkup(createElement(AvatarDetail, { avatarId: avatar.id }));
      expect(html).toContain(encodeURIComponent(avatar.image));
      expect(html).toContain(avatar.introduction);
      expect(html).toContain("สุ่มเมื่อเริ่มเกม");
    }
  });
});
