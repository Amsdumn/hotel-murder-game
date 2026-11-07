import { avatarById, type AvatarId } from "./avatars";

type Gender = "man" | "woman";
type HairColor = "black" | "brown" | "blond" | "red" | "gray";
type SkinTone = "light" | "medium" | "deep";

export const avatarClueTraits: Record<AvatarId, { gender: Gender; hairColor: HairColor; skinTone: SkinTone }> = {
  "adrian-blackwood": { gender: "man", hairColor: "black", skinTone: "light" },
  "irina-volkova": { gender: "woman", hairColor: "red", skinTone: "light" },
  "somchai-prasert": { gender: "man", hairColor: "gray", skinTone: "medium" },
  "marcus-johnson": { gender: "man", hairColor: "black", skinTone: "deep" },
  "elena-morales": { gender: "woman", hairColor: "brown", skinTone: "medium" },
  "oliver-hayes": { gender: "man", hairColor: "blond", skinTone: "light" },
  "amara-okafor": { gender: "woman", hairColor: "gray", skinTone: "deep" },
  "claire-dubois": { gender: "woman", hairColor: "red", skinTone: "light" },
  "seo-yeon-kim": { gender: "woman", hairColor: "black", skinTone: "light" },
  "rafael-costa": { gender: "man", hairColor: "brown", skinTone: "medium" },
  "anaya-mehta": { gender: "woman", hairColor: "black", skinTone: "medium" },
  "yusuf-demir": { gender: "man", hairColor: "gray", skinTone: "medium" },
};

const hairLabels: Record<HairColor, string> = { black: "ดำ", brown: "น้ำตาล", blond: "ทอง", red: "แดง", gray: "เทา" };
const skinLabels: Record<SkinTone, string> = { light: "อ่อน", medium: "กลาง", deep: "เข้ม" };

export function formerPoliceClue(avatarId: AvatarId | null | undefined, turn: number): string {
  const prefix = `เบาะแสอดีตตำรวจเทิร์นที่ ${turn}: `;
  const avatar = avatarById(avatarId);
  if (!avatar) return `${prefix}ไม่พบข้อมูลตัวละคร`;
  const traits = avatarClueTraits[avatar.id];
  if (turn === 1) return `${prefix}เพศ${traits.gender === "woman" ? "หญิง" : "ชาย"}`;
  if (turn === 2) {
    const decade = Math.floor(avatar.age / 10) * 10;
    return `${prefix}อายุ ${decade}–${decade + 9} ปี`;
  }
  if (turn === 3) return `${prefix}ผมสี${hairLabels[traits.hairColor]} ผิวสี${skinLabels[traits.skinTone]}`;
  if (turn === 4) return `${prefix}เกิดที่${avatar.origin}`;
  throw new Error("Invalid game turn for Former Police Officer clue");
}
