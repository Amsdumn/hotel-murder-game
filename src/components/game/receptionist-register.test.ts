import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReceptionistRegister } from "./receptionist-register";
import { PrivateInfoPanel } from "./game-screen";
import type { PrivatePlayerState } from "@/types/game";

const players = [
  { id: "a", displayName: "Anna", seatIndex: 0, avatarId: "irina-volkova" as const },
  { id: "b", displayName: "Ben, Jr.", seatIndex: 1, avatarId: "adrian-blackwood" as const },
];

describe("receptionist register", () => {
  it("shows each guest and room as a separate private register entry", () => {
    const html = renderToStaticMarkup(createElement(ReceptionistRegister, {
      message: "ทะเบียนห้องพักเทิร์นที่ 3: ผู้เล่น 1 Anna · ห้อง 101, ผู้เล่น 2 Ben, Jr. · ห้อง 703",
      players,
    }));
    expect(html).toContain("ทะเบียนห้องพัก · เทิร์นที่ 3");
    expect(html).toContain("Anna");
    expect(html).toContain("Ben, Jr.");
    expect(html).toContain("ห้อง 101");
    expect(html).toContain("ห้อง 703");
    expect((html.match(/data-register-entry=/g) ?? [])).toHaveLength(2);
  });

  it("keeps a legacy message readable if the guest list cannot be matched", () => {
    const html = renderToStaticMarkup(createElement(ReceptionistRegister, { message: "ทะเบียนห้องพักเทิร์นที่ 3: Guest · ห้อง 202", players }));
    expect(html).toContain("Guest · ห้อง 202");
  });

  it("shows the register only when its owner's private panel is open", () => {
    const privateState: PrivatePlayerState = {
      version: 1, playerId: "a", role: "RECEPTIONIST", team: "INNOCENT", roomNumber: 101,
      isAlive: true, mode: "PLAYER", canUseSkill: false, canVote: false,
      privateResults: ["ทะเบียนห้องพักเทิร์นที่ 3: ผู้เล่น 1 Anna · ห้อง 101, ผู้เล่น 2 Ben, Jr. · ห้อง 703"],
      actionHistory: [],
    };
    const render = (open: boolean) => renderToStaticMarkup(createElement(PrivateInfoPanel, { privateState, teamState: null, players, open, onToggle: () => {} }));
    expect(render(false)).not.toContain("ห้อง 703");
    expect(render(true)).toContain("ทะเบียนห้องพัก · เทิร์นที่ 3");
    expect(render(true)).toContain("ห้อง 703");
  });
});
