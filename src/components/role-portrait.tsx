import Image from "next/image";
import type { Role } from "@/types/game";

export const roleNames: Record<Role, string> = {
  LOCKSMITH: "ช่างกุญแจ",
  HOUSEKEEPER: "แม่บ้าน",
  WINDOW_CLEANER: "คนเช็ดกระจก",
  WITNESS: "พยาน",
  DETECTIVE: "นักสืบ",
  ACCOMPLICE: "ผู้สมรู้ร่วมคิด",
  KILLER: "ฆาตกร",
};

const portraits: Record<Role, string> = {
  LOCKSMITH: "/art/locksmith.webp",
  HOUSEKEEPER: "/art/housekeeper.webp",
  WINDOW_CLEANER: "/art/window-cleaner.webp",
  WITNESS: "/art/witness.webp",
  DETECTIVE: "/art/detective.webp",
  ACCOMPLICE: "/art/accomplice.webp",
  KILLER: "/art/killer.webp",
};

export function RolePortrait({ role, className = "", sizes = "96px" }: { role: Role; className?: string; sizes?: string }) {
  return <div className={`relative shrink-0 overflow-hidden bg-[#271c2b] ${className}`}>
    <Image src={portraits[role]} alt={`ภาพตัวละคร${roleNames[role]}`} fill sizes={sizes} className="object-cover object-top" />
  </div>;
}
