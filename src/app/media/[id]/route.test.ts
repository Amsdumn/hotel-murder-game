import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import mediaMap from "@/lib/media-map.json";
import { accessCookieName, getAccessCookieValue } from "@/server/access-gate";
import { GET } from "./route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("protected media route", () => {
  const [assetPath, id] = Object.entries(mediaMap)[0];
  const request = new Request(`http://localhost/media/${id}`);
  const params = { params: Promise.resolve({ id }) };

  function setAccessCookie(value?: string) {
    vi.mocked(cookies).mockResolvedValue({ get: () => value ? { name: accessCookieName, value } : undefined } as Awaited<ReturnType<typeof cookies>>);
  }

  it("does not serve assets without a valid access cookie", async () => {
    vi.stubEnv("HOTEL_ACCESS_PASSWORD", "a-private-test-password");
    vi.stubEnv("HOTEL_ACCESS_COOKIE_SECRET", "a-private-test-cookie-secret-long-enough");
    setAccessCookie();
    expect((await GET(request, params)).status).toBe(404);
    setAccessCookie("wrong-cookie");
    expect((await GET(request, params)).status).toBe(404);
  });

  it("serves an allowed file without exposing its source path or caching it publicly", async () => {
    vi.stubEnv("HOTEL_ACCESS_PASSWORD", "a-private-test-password");
    vi.stubEnv("HOTEL_ACCESS_COOKIE_SECRET", "a-private-test-cookie-secret-long-enough");
    setAccessCookie(getAccessCookieValue());
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(assetPath.endsWith(".webp") ? "image/webp" : assetPath.endsWith(".gif") ? "image/gif" : "audio/mpeg");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await GET(request, { params: Promise.resolve({ id: "0".repeat(32) }) })).status).toBe(404);
  });
});
