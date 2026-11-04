import { describe, expect, it } from "vitest";
import { getServerUrls } from "./server-urls";

describe("server URLs", () => {
  const interfaces = {
    "vEthernet (Docker)": [{ address: "172.20.0.1", family: "IPv4", internal: false }],
    "Wi-Fi": [{ address: "192.168.1.14", family: "IPv4", internal: false }],
    Loopback: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  };

  it("shows the Wi-Fi URL when listening on every interface", () => {
    expect(getServerUrls("0.0.0.0", 3333, interfaces)).toEqual([
      "http://localhost:3333",
      "http://192.168.1.14:3333",
    ]);
  });

  it("does not advertise a Wi-Fi URL when bound to another interface", () => {
    expect(getServerUrls("172.20.0.1", 3333, interfaces)).toEqual(["http://172.20.0.1:3333"]);
  });
});
