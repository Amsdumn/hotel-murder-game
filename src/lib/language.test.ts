import { describe, expect, it } from "vitest";
import { languageLabel, localize, normalizeLanguage } from "./language";
import { AVATAR_ORDER } from "./avatars";
import { avatarEnglish } from "./avatar-translations";
import { ROLE_ORDER } from "@/types/game";
import { roleSkillDescriptionsEn } from "./role-skills";
import { roleNamesEn } from "@/components/role-portrait";

describe("language selection", () => {
  it("supports Thai and English with Thai as the safe default", () => {
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("th")).toBe("th");
    expect(normalizeLanguage("fr")).toBe("th");
    expect(localize("ห้องพัก", "Lobby", "th")).toBe("ห้องพัก");
    expect(localize("ห้องพัก", "Lobby", "en")).toBe("Lobby");
    expect(languageLabel("en")).toBe("English");
  });
  it("has English content for every public character and secret role", () => {
    for (const id of AVATAR_ORDER) {
      expect(avatarEnglish[id].name).toBeTruthy();
      expect(avatarEnglish[id].introduction).toBeTruthy();
    }
    for (const role of ROLE_ORDER) {
      expect(roleNamesEn[role]).toBeTruthy();
      expect(roleSkillDescriptionsEn[role]).toBeTruthy();
    }
  });
});
