import { describe, expect, it } from "vitest";
import { getDatabaseEnv, getServerEnv } from "./env";

describe("server environment", () => {
  it("uses safe local defaults", () => {
    expect(getServerEnv({})).toEqual({ PORT: 3000, BIND_HOST: "0.0.0.0" });
  });

  it("does not let the machine HOSTNAME override the configured bind address", () => {
    expect(getServerEnv({ HOSTNAME: "172.20.0.1", BIND_HOST: "0.0.0.0", PORT: "3333" }))
      .toEqual({ PORT: 3333, BIND_HOST: "0.0.0.0" });
  });

  it("rejects an invalid port", () => {
    expect(() => getServerEnv({ PORT: "0" })).toThrow();
    expect(() => getServerEnv({ PORT: "65536" })).toThrow();
  });

  it("uses the locally installed MongoDB by default in development", () => {
    expect(getDatabaseEnv({ NODE_ENV: "development" }).MONGODB_URI)
      .toBe("mongodb://127.0.0.1:27017/hotel-murder-online");
  });

  it("selects the Docker localhost port in development", () => {
    expect(getDatabaseEnv({ NODE_ENV: "development", MONGODB_MODE: "docker" }).MONGODB_URI)
      .toBe("mongodb://127.0.0.1:27018/hotel-murder-online");
  });

  it("allows a custom development URI when explicitly selected or already configured", () => {
    const uri = "mongodb://127.0.0.1:27019/custom";
    expect(getDatabaseEnv({ NODE_ENV: "development", MONGODB_MODE: "custom", MONGODB_URI: uri }).MONGODB_URI).toBe(uri);
    expect(getDatabaseEnv({ NODE_ENV: "development", MONGODB_URI: uri }).MONGODB_URI).toBe(uri);
  });

  it("requires MONGODB_URI in production regardless of the development mode", () => {
    expect(() => getDatabaseEnv({ NODE_ENV: "production", MONGODB_MODE: "docker" })).toThrow();
    expect(getDatabaseEnv({ NODE_ENV: "production", MONGODB_MODE: "docker", MONGODB_URI: "mongodb+srv://example.mongodb.net/hotel-murder-online" }).MONGODB_URI)
      .toBe("mongodb+srv://example.mongodb.net/hotel-murder-online");
  });

  it("rejects a non-MongoDB protocol", () => {
    expect(() => getDatabaseEnv({ MONGODB_URI: "https://example.com" })).toThrow();
  });
});
