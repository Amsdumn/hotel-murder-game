import { describe, expect, it } from "vitest";
import { accessCookieName, accessCookieValue, isAccessGranted, isValidAccessPassword } from "./access-gate";

describe("homepage access gate", () => {
  it("accepts only the fixed password", () => {
    expect(isValidAccessPassword("PostUlone")).toBe(true);
    expect(isValidAccessPassword("postulone")).toBe(false);
    expect(isValidAccessPassword("")).toBe(false);
  });

  it("grants access only for its server-issued cookie", () => {
    expect(accessCookieName).toBe("hotel-home-access");
    expect(isAccessGranted(accessCookieValue)).toBe(true);
    expect(isAccessGranted("PostUlone")).toBe(false);
    expect(isAccessGranted(undefined)).toBe(false);
  });
});
