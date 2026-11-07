"use client";

import Image from "next/image";
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
  ELECTRICIAN: "/art/avatars/marcus-johnson-portrait.webp",
  LOCKSMITH: "/art/locksmith.webp",
  HOUSEKEEPER: "/art/housekeeper.webp",
  WINDOW_CLEANER: "/art/window-cleaner.webp",
  WITNESS: "/art/witness.webp",
  DETECTIVE: "/art/detective.webp",
  LAWYER: "/art/lawyer.webp",
  FORMER_POLICE: "/art/former-police.webp",
  RECEPTIONIST: "/art/avatars/irina-volkova-portrait.webp",
  PHOTOGRAPHER: "/art/photographer-portrait.webp",
  ACCOMPLICE: "/art/accomplice.webp",
  KILLER: "/art/killer.webp",
};

export function RolePortrait({ role, className = "", sizes = "96px" }: { role: Role; className?: string; sizes?: string }) {
  const en = useLanguage() === "en";
  return <div className={`relative shrink-0 overflow-hidden bg-[#271c2b] ${className}`}>
    <Image src={portraits[role]} alt={en ? `Portrait of ${roleNamesEn[role]}` : `ภาพตัวละคร${roleNames[role]}`} fill sizes={sizes} className="object-cover object-top" />
  </div>;
}
