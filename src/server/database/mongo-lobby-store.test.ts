import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModel } from "./models";
import { MongoLobbyStore } from "./mongo-lobby-store";

vi.mock("./connect", () => ({ connectDatabase: async () => undefined }));

afterEach(() => vi.restoreAllMocks());

describe("Mongo lobby reads", () => {
  it("restores system-random role mode when loading a saved room", async () => {
    const saved = {
      code: "ABC234", phase: "LOBBY", version: 12, creationActionId: "create", hostPlayerId: "host",
      playerLimit: 5, discussionSeconds: 180, innocentRoleMode: "RANDOM", selectedInnocentRoles: [],
      players: [{ id: "host", displayName: "Host", seatIndex: 0, ready: true, connected: true }], appliedActionIds: [],
    };
    vi.spyOn(GameModel, "findOne").mockReturnValue({ lean: () => ({ exec: async () => saved }) } as ReturnType<typeof GameModel.findOne>);
    expect((await new MongoLobbyStore().findLobby("ABC234"))?.innocentRoleMode).toBe("RANDOM");
  });
});
