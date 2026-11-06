"use client";

import Image from "next/image";
import { avatarById } from "@/lib/avatars";
import type { PublicGameState } from "@/types/game";
import { useLanguage } from "@/components/language-switcher";

const registerPrefix = "ทะเบียนห้องพักเทิร์นที่ 3:";

export function ReceptionistRegister({ message, players }: { message: string; players: PublicGameState["players"] }) {
  const en = useLanguage() === "en";
  const entries = [...players].sort((left, right) => left.seatIndex - right.seatIndex).flatMap((player) => {
    const marker = `ผู้เล่น ${player.seatIndex + 1} ${player.displayName} · ห้อง `;
    const start = message.indexOf(marker);
    if (start < 0) return [];
    const room = message.slice(start + marker.length, start + marker.length + 3);
    return /^([1-9]0[1-3])$/.test(room) ? [{ player, room }] : [];
  });

  return <section aria-label={en ? "Private room register" : "ทะเบียนห้องพักส่วนตัว"} className="rounded-xl border border-[#d8bc86]/40 bg-[#29232c] p-4">
    <p className="text-xs font-semibold tracking-[.18em] text-[#d8bc86]">{en ? "RECEPTIONIST RESULT · YOURS ONLY" : "ผลสกิลพนักงานต้อนรับ · เฉพาะคุณ"}</p>
    <h3 className="mt-2 font-serif text-xl text-[#f4efe8]">{en ? "Room register · turn 3" : "ทะเบียนห้องพัก · เทิร์นที่ 3"}</h3>
    <p className="mt-1 text-xs text-[#bdb5bd]">{en ? "Every guest's name and room number" : "รายชื่อและหมายเลขห้องของผู้เข้าพักทุกคน"}</p>
    {entries.length === players.length && entries.length > 0 ? <ol className="mt-4 grid gap-2 sm:grid-cols-2">{entries.map(({ player, room }) => {
      const avatar = avatarById(player.avatarId);
      return <li key={player.id} data-register-entry="" className="flex min-w-0 items-center gap-3 rounded-lg border border-[#d8bc86]/20 bg-[#1d1d26] p-2">
        {avatar && <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md"><Image src={avatar.portrait} alt="" fill sizes="44px" className="object-cover object-top" /></div>}
        <div className="min-w-0 flex-1"><p className="text-xs text-[#bdb5bd]">{en ? "Player" : "ผู้เล่น"} {player.seatIndex + 1}</p><p className="max-w-[150px] truncate text-sm font-semibold text-[#f4efe8]" title={player.displayName}>{player.displayName}</p></div>
        <span className="shrink-0 rounded-md border border-[#d8bc86]/35 bg-[#3d3038] px-2 py-1 font-mono text-sm text-[#f2d79c]">{en ? "Room" : "ห้อง"} {room}</span>
      </li>;
    })}</ol> : <p className="mt-4 text-sm leading-7 text-[#f4efe8]">{en ? (message.startsWith(registerPrefix) ? message.slice(registerPrefix.length).trim() : message).replace(/ผู้เล่น (\d+) /g, "Player $1 ").replace(/ · ห้อง (\d+)/g, " · room $1") : message.startsWith(registerPrefix) ? message.slice(registerPrefix.length).trim() : message}</p>}
  </section>;
}
