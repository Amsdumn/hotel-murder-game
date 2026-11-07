"use client";

import Image from "next/image";
import { mediaUrl } from "@/lib/media-url";
import type { Role } from "@/types/game";
import { useLanguage } from "@/components/language-switcher";

export const roleNames: Record<Role, string> = {
  ELECTRICIAN: "ช่างไฟ",
  LOCKSMITH: "ช่างกุญแจ",
  HOUSEKEEPER: "แม่บ้าน",
  WINDOW_CLEANER: "คนเช็ดกระจก",
  WITNESS: "พยาน",
  DETECTIVE: "นักสืบ",
  LAWYER: "ทนายความ",
  FORMER_POLICE: "อดีตตำรวจ",
  RECEPTIONIST: "พนักงานต้อนรับ",
  PHOTOGRAPHER: "ช่างภาพ",
  ACCOMPLICE: "ผู้สมรู้ร่วมคิด",
  KILLER: "นักฆ่า",
};

export const roleNamesEn: Record<Role, string> = {
  ELECTRICIAN: "Electrician", LOCKSMITH: "Locksmith", HOUSEKEEPER: "Housekeeper",
  WINDOW_CLEANER: "Window Cleaner", WITNESS: "Witness", DETECTIVE: "Detective", LAWYER: "Lawyer", FORMER_POLICE: "Former Police Officer",
  RECEPTIONIST: "Receptionist", PHOTOGRAPHER: "Photographer", ACCOMPLICE: "Accomplice", KILLER: "Assassin",
};

const portraits: Record<Role, string> = {
  ELECTRICIAN: mediaUrl("/art/avatars/marcus-johnson-portrait.webp"),
  LOCKSMITH: mediaUrl("/art/locksmith.webp"),
  HOUSEKEEPER: mediaUrl("/art/housekeeper.webp"),
  WINDOW_CLEANER: mediaUrl("/art/window-cleaner.webp"),
  WITNESS: mediaUrl("/art/witness.webp"),
  DETECTIVE: mediaUrl("/art/detective.webp"),
  LAWYER: mediaUrl("/art/lawyer.webp"),
  FORMER_POLICE: mediaUrl("/art/former-police.webp"),
  RECEPTIONIST: mediaUrl("/art/avatars/irina-volkova-portrait.webp"),
  PHOTOGRAPHER: mediaUrl("/art/photographer-portrait.webp"),
  ACCOMPLICE: mediaUrl("/art/accomplice.webp"),
  KILLER: mediaUrl("/art/killer.webp"),
};

export function RolePortrait({ role, className = "", sizes = "96px" }: { role: Role; className?: string; sizes?: string }) {
  const en = useLanguage() === "en";
  return <div className={`relative shrink-0 overflow-hidden bg-[#271c2b] ${className}`}>
    <Image src={portraits[role]} alt={en ? `Portrait of ${roleNamesEn[role]}` : `ภาพตัวละคร${roleNames[role]}`} fill sizes={sizes} className="object-cover object-top" />
  </div>;
}
