import { describe, expect, it } from "vitest";
import { createActionId } from "./action-id";

describe("browser action IDs", () => {
  it("creates a UUID v4 when randomUUID is unavailable on an HTTP LAN origin", () => {
    const insecureCrypto = {
      getRandomValues<T extends ArrayBufferView | null>(array: T): T {
        if (!(array instanceof Uint8Array)) throw new Error("Expected UUID bytes");
        array.set(Array.from({ length: 16 }, (_, index) => index));
        return array;
      },
    };
    expect(createActionId(insecureCrypto)).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("generates distinct UUIDs with the browser random source", () => {
    const first = createActionId();
    const second = createActionId();
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });
});
