import { describe, expect, it } from "vitest";
import { accessCookieName, assertAccessGateConfigured, getAccessCookieValue, isAccessGranted, isAccessGrantedFromCookieHeader, isAllowedSocketOrigin, isValidAccessPassword, prepareAccessGateEnvironment } from "./access-gate";

const settings = {
  HOTEL_ACCESS_PASSWORD: "a-private-test-password",
  HOTEL_ACCESS_COOKIE_SECRET: "a-private-test-cookie-secret-long-enough",
};

describe("homepage access gate", () => {
  it("requires server-owned credentials", () => {
    expect(() => assertAccessGateConfigured({ HOTEL_ACCESS_PASSWORD: undefined, HOTEL_ACCESS_COOKIE_SECRET: undefined })).toThrow();
    expect(() => assertAccessGateConfigured({ ...settings, HOTEL_ACCESS_PASSWORD: "short" })).toThrow();
    expect(() => assertAccessGateConfigured(settings)).not.toThrow();
    expect(isValidAccessPassword(settings.HOTEL_ACCESS_PASSWORD, settings)).toBe(true);
    expect(isValidAccessPassword("wrong-password", settings)).toBe(false);
    expect(isValidAccessPassword("a".repeat(1000), settings)).toBe(false);
  });

  it("generates missing credentials only for development", () => {
    const development: Record<string, string | undefined> = {};
    const password = prepareAccessGateEnvironment(development, false);
    expect(password).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(isValidAccessPassword(password, development)).toBe(true);
    expect(development.HOTEL_ACCESS_COOKIE_SECRET).toHaveLength(64);
    expect(prepareAccessGateEnvironment(development, false)).toBeNull();

    const production: Record<string, string | undefined> = {};
    expect(() => prepareAccessGateEnvironment(production, true)).toThrow();
    expect(production).toEqual({});
    expect(prepareAccessGateEnvironment({ ...settings }, true)).toBeNull();
  });

  it("rejects cross-origin browser socket handshakes", () => {
    expect(isAllowedSocketOrigin("https://game.example.com", "game.example.com")).toBe(true);
    expect(isAllowedSocketOrigin("https://evil.example.com", "game.example.com")).toBe(false);
    expect(isAllowedSocketOrigin("null", "game.example.com")).toBe(false);
    expect(isAllowedSocketOrigin(undefined, "game.example.com")).toBe(true);
  });

  it("accepts only its signed cookie, including in Socket.IO requests", () => {
    const cookieValue = getAccessCookieValue(settings);
    expect(accessCookieName).toBe("hotel-home-access");
    expect(isAccessGranted(cookieValue, settings)).toBe(true);
    expect(isAccessGranted(undefined, settings)).toBe(false);
    expect(isAccessGranted(cookieValue, { ...settings, HOTEL_ACCESS_COOKIE_SECRET: "another-private-test-cookie-secret-long-enough" })).toBe(false);
    expect(isAccessGrantedFromCookieHeader(`other=1; ${accessCookieName}=${cookieValue}`, settings)).toBe(true);
    expect(isAccessGrantedFromCookieHeader(undefined, settings)).toBe(false);
    expect(isAccessGrantedFromCookieHeader(`${accessCookieName}=${cookieValue.slice(1)}`, settings)).toBe(false);
  });
});
