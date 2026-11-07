import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { io } from "socket.io-client";
import { LobbyService } from "@/server/lobby/lobby-service";
import { MemoryLobbyStore } from "@/server/lobby/test-memory-store";
import { GameService } from "@/server/game-engine/game-service";
import { createSocketServer } from "@/server/socket/create-socket-server";
import { addLocalTestBots, disconnectLocalTestBots } from "./local-test-bots";
import { accessCookieName, getAccessCookieValue } from "@/server/access-gate";

process.env.HOTEL_ACCESS_PASSWORD = "a-private-test-password";
process.env.HOTEL_ACCESS_COOKIE_SECRET = "a-private-test-cookie-secret-long-enough";

describe("local test bot connections", () => {
  const httpServer = createServer();
  const store = new MemoryLobbyStore();
  const socketServer = createSocketServer(httpServer, new LobbyService(store), new GameService(store));
  let code = "";

  afterEach(async () => {
    if (code) disconnectLocalTestBots(code);
    await new Promise<void>((resolve) => socketServer.close(() => resolve()));
    if (httpServer.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("joins and readies four real Socket.IO seats on localhost", async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const port = (httpServer.address() as AddressInfo).port;
    const host = await new LobbyService(store).create({ displayName: "Host", actionId: crypto.randomUUID() });
    code = host.code;
    const progress: number[] = [];
    await addLocalTestBots(code, 4, (count) => progress.push(count), {
      hostname: "localhost", environment: "development",
      connect: () => io(`http://127.0.0.1:${port}`, { transports: ["websocket"], reconnection: false, extraHeaders: { Cookie: `${accessCookieName}=${getAccessCookieValue()}`, Origin: `http://127.0.0.1:${port}` } }),
    });
    const lobby = await store.findLobby(code);
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(lobby?.players).toHaveLength(5);
    expect(lobby?.players.slice(1).every((player) => player.ready)).toBe(true);
  }, 15000);
});
