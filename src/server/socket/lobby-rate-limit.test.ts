import { describe, expect, it } from "vitest";
import { LobbyJoinRateLimiter } from "./lobby-rate-limit";

describe("lobby entry rate limits", () => {
  it("rejects excess room creation across sockets from one address and restores capacity after the window", () => {
    const limiter = new LobbyJoinRateLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) expect(limiter.allow("192.0.2.1", "create", 1000)).toBe(true);
    expect(limiter.allow("192.0.2.1", "create", 1001)).toBe(false);
    expect(limiter.allow("192.0.2.2", "create", 1001)).toBe(true);
    expect(limiter.allow("192.0.2.1", "create", 601000)).toBe(true);
  });

  it("limits join attempts separately from creation and does not count resume", () => {
    const limiter = new LobbyJoinRateLimiter();
    for (let attempt = 0; attempt < 20; attempt += 1) expect(limiter.allow("192.0.2.1", "join", 1000)).toBe(true);
    expect(limiter.allow("192.0.2.1", "join", 1000)).toBe(false);
    expect(limiter.allow("192.0.2.1", "create", 1000)).toBe(true);
    expect(limiter.allow("192.0.2.1", "join", 61000)).toBe(true);
  });
});
