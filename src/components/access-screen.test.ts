import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessScreen } from "./access-screen";

describe("access screen", () => {
  it("offers a password form without exposing the fixed password", () => {
    const html = renderToStaticMarkup(createElement(AccessScreen, { invalid: false, unlock: async () => {} }));
    expect(html).toContain('type="password"');
    expect(html).toContain("รหัสผ่าน");
    expect(html).toContain("เข้าสู่เกม");
    expect(html).not.toContain("a-private-test-password");
  });

  it("shows an error after a wrong password", () => {
    const html = renderToStaticMarkup(createElement(AccessScreen, { invalid: true, unlock: async () => {} }));
    expect(html).toContain("รหัสผ่านไม่ถูกต้อง");
  });
});
