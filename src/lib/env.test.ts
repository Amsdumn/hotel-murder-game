import { describe, expect, it } from "vitest";
import { getDatabaseEnv, getServerEnv } from "./env";

describe("server environment", () => {
  it("uses safe local defaults", () => {
    expect(getServerEnv({})).toEqual({ PORT: 3000, HOSTNAME: "localhost" });
  });

  it("rejects an invalid port", () => {
    expect(() => getServerEnv({ PORT: "0" })).toThrow();
    expect(() => getServerEnv({ PORT: "65536" })).toThrow();
  });

  it("requires a MongoDB URI for database operations", () => {
    expect(() => getDatabaseEnv({})).toThrow();
    expect(getDatabaseEnv({ MONGODB_URI: "mongodb://127.0.0.1:27017/hotel-murder-online" }).MONGODB_URI)
      .toBe("mongodb://127.0.0.1:27017/hotel-murder-online");
  });

  it("rejects a non-MongoDB protocol", () => {
    expect(() => getDatabaseEnv({ MONGODB_URI: "https://example.com" })).toThrow();
  });
});
