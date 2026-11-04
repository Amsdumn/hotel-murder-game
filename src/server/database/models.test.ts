import { describe, expect, it } from "vitest";
import { GameModel, GameEventModel, PlayerSessionModel } from "./models";

describe("lobby persistence indexes", () => {
  it("keeps room codes and creation actions unique", () => {
    const indexes = GameModel.schema.indexes();
    expect(indexes).toContainEqual([{ code: 1 }, expect.objectContaining({ unique: true })]);
    expect(indexes).toContainEqual([{ creationActionId: 1 }, expect.objectContaining({ unique: true })]);
  });

  it("indexes token hashes and event action IDs", () => {
    expect(PlayerSessionModel.schema.indexes()).toContainEqual([{ tokenHash: 1 }, expect.objectContaining({ unique: true })]);
    expect(GameEventModel.schema.indexes()).toContainEqual([{ gameCode: 1, actorId: 1, actionId: 1 }, expect.objectContaining({ unique: true })]);
  });
});
