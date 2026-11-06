"use client";

import Image from "next/image";
import { RolePortrait } from "@/components/role-portrait";
import { avatarById } from "@/lib/avatars";
import { gameMessage } from "@/lib/game-copy";
import type { Language } from "@/lib/language";
import type { PublicGameState } from "@/types/game";

const prefix = "ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น ";

export function PhotographerResult({ message, players, language }: { message: string; players: PublicGameState["players"]; language: Language }) {
  const killer = players.find((player) => message === `${prefix}${player.seatIndex + 1} ${player.displayName}`);
  if (!killer) return <p className="text-sm leading-7">{gameMessage(message, language)}</p>;
  const avatar = avatarById(killer.avatarId);
  const en = language === "en";

  return <section aria-label={en ? "Private photograph result" : "ผลภาพถ่ายส่วนตัว"} className="rounded-xl border border-[#d8bc86]/40 bg-[#29232c] p-4 text-left">
    <p className="text-xs font-semibold tracking-[.18em] text-[#d8bc86]">{en ? "PHOTOGRAPHER RESULT · YOURS ONLY" : "ผลสกิลช่างภาพ · เฉพาะคุณ"}</p>
    <h3 className="mt-2 font-serif text-xl text-[#f4efe8]">{en ? "Photograph · turn 3" : "ภาพถ่าย · เทิร์นที่ 3"}</h3>
    <div className="mt-4 flex items-center gap-4 rounded-lg border border-[#d8bc86]/20 bg-[#1d1d26] p-3">
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-md">
        {avatar ? <Image src={avatar.portrait} alt={en ? `Portrait of ${killer.displayName}` : `ภาพของ ${killer.displayName}`} fill sizes="80px" className="object-cover object-top" /> : <RolePortrait role="KILLER" className="h-full w-full" sizes="80px" />}
      </div>
      <div className="min-w-0"><p className="text-sm text-[#d8bc86]">{en ? "The Assassin is" : "นักฆ่าคือ"}</p><p className="mt-1 max-w-[150px] truncate font-serif text-xl font-semibold text-[#f4efe8]" title={killer.displayName}>{killer.displayName}</p><p className="mt-1 text-xs text-[#bdb5bd]">{en ? "Player" : "ผู้เล่น"} {killer.seatIndex + 1}</p></div>
    </div>
  </section>;
}
