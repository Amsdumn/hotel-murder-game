"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Alert, Button, Paper } from "@mui/material";
import { lobbyErrorMessage } from "@/lib/lobby-client";
import { roleSkillDescriptions } from "@/lib/role-skills";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import type { GameResultState, PrivatePlayerState, PrivateTeamState, PublicGameState, Role } from "@/types/game";
import type { LobbyAck } from "@/types/lobby";
import { MurderEventOverlay } from "./murder-event-overlay";
import { PrivateRoomScene } from "./private-room-scene";
import { ReceptionistRegister } from "./receptionist-register";
import { avatarById, type AvatarId } from "@/lib/avatars";

export function PublicGuests({ players, selfId, selectedPlayerId, onSelectPlayer }: { players: PublicGameState["players"]; selfId?: string; selectedPlayerId?: string | null; onSelectPlayer?: (playerId: string) => void }) {
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <h2 className="font-serif text-xl">ผู้เข้าพัก</h2>
    <p className="mt-1 text-xs text-[#a9a5af]">{onSelectPlayer ? "แตะผู้เข้าพักหนึ่งคนเพื่อเลือกเป้าหมายสกิล" : "อวาตาร์ไม่บอกบทบาทหรือฝ่าย"}</p>
    <div className="mt-4 grid grid-cols-2 gap-3">{players.map((player) => {
      const avatar = avatarById(player.avatarId);
      const selectable = !!onSelectPlayer && player.id !== selfId;
      const selected = selectable && selectedPlayerId === player.id;
      const content = <>{avatar && <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md"><Image src={avatar.portrait} alt="" fill sizes="48px" className="object-cover object-top" /></div>}<div className="min-w-0"><p className="truncate text-sm">{player.displayName}</p><p className="truncate text-xs text-[#c8a46b]">{avatar?.name ?? "ผู้เข้าพัก"}</p></div></>;
      const className = `flex items-center gap-2 rounded-lg border p-2 text-left ${selected ? "border-[#f2d79c] bg-[#4a3942] ring-2 ring-[#f2d79c]" : "border-[#c8a46b]/15 bg-[#29202b]"}`;
      return selectable ? <button key={player.id} type="button" aria-label={`เลือกผู้เข้าพัก ${player.displayName} เป็นเป้าหมายสกิล`} aria-pressed={selected} className={`${className} hover:border-[#e3c88e] focus-visible:outline-2 focus-visible:outline-[#e3c88e]`} onClick={() => onSelectPlayer(player.id)}>{content}</button> : <div key={player.id} className={className}>{content}</div>;
    })}</div>
  </Paper>;
}

export function SoundSettings({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) {
  return <Button size="small" variant="outlined" onClick={() => onChange(!muted)} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}>{muted ? "เปิดเสียง" : "ปิดเสียง"}</Button>;
}

export function DiscussionTimer({ deadline }: { deadline: number }) {
  return <PhaseTimer deadline={deadline} label="เวลาพูดคุย" />;
}

function PhaseTimer({ deadline, label }: { deadline: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(interval); }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <p className="text-2xl font-semibold text-[#c8a46b]" aria-live="off">{label} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>;
}

export function DeathNotification({ onContinue }: { onContinue: () => void }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#100b10]/95 px-5 text-center text-[#f4efe8]" role="dialog" aria-modal="true" aria-labelledby="death-title">
    <div className="max-w-lg rounded-2xl border border-[#6d1728] bg-[#1d1d26] p-8 shadow-2xl">
      <p className="mb-3 text-sm tracking-[.25em] text-[#c8a46b]">โหมดผู้ชม</p>
      <h2 id="death-title" className="font-serif text-4xl text-[#f4efe8]">คุณเสียชีวิตแล้ว</h2>
      <p className="mt-5 leading-8">คุณสามารถติดตามเกมต่อได้ แต่ไม่สามารถใช้สกิลหรือโหวตได้อีก</p>
      <p className="mt-5 rounded-lg border border-[#c8a46b]/30 p-3 text-sm leading-7 text-[#c8a46b]">ผู้เล่นที่เสียชีวิตแล้วต้องหยุดให้ข้อมูลเกี่ยวกับเกมทันที แม้จะยังสามารถรับชมเกมต่อได้</p>
      <Button className="mt-7!" variant="contained" onClick={onContinue}>รับชมเกมต่อ</Button>
    </div>
  </div>;
}

export function SpectatorPanel() {
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">โหมดผู้ชม</h2><p className="mt-2 text-sm leading-7 text-[#c6bdb1]">คุณสามารถดูเหตุการณ์สาธารณะและผลโหวตได้ โปรดหยุดให้ข้อมูลเกี่ยวกับเกมทันที</p></Paper>;
}

export function getTurnNotice(state: PublicGameState, privateState: PrivatePlayerState | null): string {
  if (state.phase === "FINISHED") return "เกมจบแล้ว ดูผลการแข่งขันและประวัติเหตุการณ์ได้";
  if (privateState?.mode === "SPECTATOR") return "คุณเป็นผู้ชม ติดตามเหตุการณ์ได้ แต่ไม่สามารถใช้สกิลหรือลงคะแนน";
  if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "BLACKOUT") return "ไฟดับบนชั้นของคุณ รอบนี้จึงใช้สกิลไม่ได้";
  if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "COOLDOWN") return "สกิลช่างไฟกำลังพักหนึ่งรอบ รอบนี้ใช้สกิลไม่ได้";
  if (state.phase === "SKILL_PHASE") return privateState?.canUseSkill
    ? "ถึงตาคุณใช้สกิล เลือกเป้าหมายและยืนยันก่อนหมดเวลา"
    : "ช่วงใช้สกิล กำลังรอผู้เล่นที่ถึงคิวดำเนินการ";
  if (state.phase === "DISCUSSION") return "เริ่มช่วงพูดคุย แลกเปลี่ยนเบาะแสก่อนลงคะแนน";
  if (state.phase === "VOTING" && !privateState) return "ช่วงลงคะแนน กำลังตรวจสิทธิ์ของคุณ";
  if (state.phase === "VOTING") return privateState?.canVote
    ? state.runoffRooms?.length ? "ถึงตาคุณลงคะแนนรอบตัดสิน แตะห้องที่เลือกได้บนแผนผังหนึ่งครั้ง ยืนยันแล้วเปลี่ยนไม่ได้" : "ถึงตาคุณลงคะแนน แตะห้องที่เลือกได้บนแผนผังหนึ่งครั้ง ยืนยันแล้วเปลี่ยนไม่ได้"
    : "ส่งคะแนนแล้ว รอผู้เล่นคนอื่นลงคะแนน";
  if (state.phase === "RESOLUTION") return "กำลังเฉลยผลการเปิดห้อง ก่อนเริ่มรอบถัดไป";
  return "กำลังเตรียมขั้นตอนถัดไป";
}

export function PrivateInfoPanel({ privateState, teamState, players, open, onToggle }: { privateState: PrivatePlayerState; teamState: PrivateTeamState | null; players: PublicGameState["players"]; open: boolean; onToggle: () => void }) {
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-serif text-xl">ข้อมูลลับ · เฉพาะคุณ</h2><p className="mt-1 text-xs text-[#a9a5af]">เปิดดูเมื่ออยู่ในที่ส่วนตัว</p></div>
      <Button variant="outlined" size="small" aria-expanded={open} onClick={onToggle}>{open ? "ปิดข้อมูลลับ" : "แสดงข้อมูลลับ"}</Button>
    </div>
    {open && <div className="mt-5 space-y-5 border-t border-[#c8a46b]/15 pt-5">
      <PrivateRoomScene role={privateState.role} roomNumber={privateState.roomNumber} team={privateState.team} isAlive={privateState.isAlive} isActive={privateState.canUseSkill} avatarId={players.find((player) => player.id === privateState.playerId)?.avatarId} />
      {teamState && <section><h3 className="font-semibold text-[#d8bc86]">ฝ่ายฆาตกร</h3>{teamState.teammates.map((mate) => <p className="mt-2 text-sm" key={mate.playerId}>{players.find((player) => player.id === mate.playerId)?.displayName} · {roleNames[mate.role]} · ห้อง {mate.roomNumber}</p>)}</section>}
      {privateState.actionHistory.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">ประวัติการกระทำของคุณ</h3><ol className="mt-2 space-y-2 text-sm text-[#d6d2dc]">{privateState.actionHistory.map((entry, index) => <li key={`${entry.turn}-${index}`}>รอบ {entry.turn} · {entry.message}</li>)}</ol></section>}
      {privateState.privateResults.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">ผลสืบสวนส่วนตัว</h3><div className="mt-2 space-y-3">{privateState.privateResults.map((message, index) => privateState.role === "RECEPTIONIST" && message.startsWith("ทะเบียนห้องพักเทิร์นที่ 3:") ? <ReceptionistRegister key={index} message={message} players={players} /> : <p key={index} className="text-sm leading-7">{message}</p>)}</div></section>}
    </div>}
  </Paper>;
}

export function GameResultScreen({ result }: { result: GameResultState }) {
  return <section className="rounded-2xl border border-[#c8a46b]/40 bg-[radial-gradient(circle_at_top,#4a1928,#111116_70%)] p-6 shadow-2xl sm:p-10">
    <p className="text-center text-sm tracking-[.3em] text-[#c8a46b]">ผลเกม · {result.turnsPlayed} รอบ</p>
    <h2 className="mt-4 text-center font-serif text-3xl leading-relaxed sm:text-5xl">{result.winner === "INNOCENT" ? "ผู้บริสุทธิ์ชนะ! นักฆ่าถูกเปิดโปงแล้ว" : "ฆาตกรชนะ! ความลับถูกฝังไว้ในโรงแรมแห่งนี้"}</h2>
    <div className="mt-9 grid gap-3 sm:grid-cols-2">{result.players.map((player) => { const avatar = avatarById(player.avatarId); return <div key={player.playerId} className="flex overflow-hidden rounded-lg border border-[#c8a46b]/20 bg-[#1d1d26]/90">{avatar ? <div className="relative w-20 shrink-0"><Image src={avatar.portrait} alt={avatar.name} fill sizes="80px" className="object-cover object-top" /></div> : <RolePortrait role={player.role} className="w-20" sizes="80px" />}<div className="p-4"><p className="font-semibold">{player.displayName} · {player.roomNumber}</p><p className="mt-1 text-sm text-[#c8a46b]">{roleNames[player.role]} · {player.team === "INNOCENT" ? "ผู้บริสุทธิ์" : "ฆาตกร"} · {player.isAlive ? "รอดชีวิต" : "เสียชีวิต"}</p></div></div>; })}</div>
    <h3 className="mt-8 font-serif text-xl">เหตุการณ์สำคัญ</h3><ul className="mt-3 space-y-2 text-sm text-[#c6bdb1]">{result.events.map((event, index) => <li key={`${event.type}-${index}`}>{event.message}</li>)}</ul>
    <div className="mt-8 flex justify-center"><Button component={Link} href="/" variant="contained">กลับหน้าแรก</Button></div>
  </section>;
}

function usesRoomTarget(role: Role): boolean {
  return role === "LOCKSMITH" || role === "DETECTIVE" || role === "KILLER";
}

function usesFloorTarget(role: Role): boolean {
  return role === "ELECTRICIAN" || role === "HOUSEKEEPER" || role === "WITNESS";
}

function usesColumnTarget(role: Role): boolean {
  return role === "WINDOW_CLEANER";
}

export const skillActionInstructions: Record<Role, string> = {
  ELECTRICIAN: "แตะชั้นหรือห้องบนชั้นที่ต้องการดับไฟ แล้วกดยืนยันสกิลด้านล่าง",
  LOCKSMITH: "แตะห้องบนแผนผังเพื่อเลือกห้องที่จะล็อก แล้วกดยืนยันสกิลด้านล่าง",
  HOUSEKEEPER: "แตะชั้นหรือห้องบนชั้นที่ต้องการตรวจจำนวนผู้พัก แล้วกดยืนยันสกิลด้านล่าง",
  WINDOW_CLEANER: "แตะแนวห้อง 01, 02 หรือ 03 บนแผนผัง แล้วกดยืนยันสกิลด้านล่าง",
  WITNESS: "แตะชั้นหรือห้องบนชั้นที่ต้องการตามรอย แล้วกดยืนยันสกิลด้านล่าง",
  DETECTIVE: "แตะห้องบนแผนผังที่ต้องการตรวจ แล้วกดยืนยันสกิลด้านล่าง",
  RECEPTIONIST: "เทิร์นที่ 3 ระบบจะเปิดทะเบียนห้องพักให้คุณอัตโนมัติ ตรวจผลในข้อมูลลับ",
  PHOTOGRAPHER: "เทิร์นที่ 3 ระบบจะให้คุณตรวจภาพถ่ายและบอกว่าใครคือนักฆ่าแบบส่วนตัว ตรวจผลในข้อมูลลับ",
  ACCOMPLICE: "แตะการ์ดผู้เข้าพักหนึ่งคนในรายชื่อด้านข้าง แล้วกดยืนยันสกิลด้านล่าง",
  KILLER: "แตะห้องบนแผนผังที่ต้องการลอบสังหาร แล้วกดยืนยันสกิลด้านล่าง",
};

export function HotelBoard({ state, onVote, onSkillRoomSelect, onSkillFloorSelect, onSkillColumnSelect, selectedSkillRoom = null, selectedSkillFloor = null, selectedSkillColumn = null, voteBusy = false }: { state: PublicGameState; onVote?: (roomNumber: number) => void; onSkillRoomSelect?: (roomNumber: number) => void; onSkillFloorSelect?: (floor: number) => void; onSkillColumnSelect?: (column: number) => void; selectedSkillRoom?: number | null; selectedSkillFloor?: number | null; selectedSkillColumn?: number | null; voteBusy?: boolean }) {
  const rooms = new Map(state.publicRooms.map((room) => [room.roomNumber, room]));
  return <Paper component="section" className="border! border-[#353440]! bg-[#191a22]! p-5! sm:p-6!">
    <div className="flex items-end justify-between gap-3 border-b border-[#353440] pb-4">
      <div><p className="text-xs uppercase tracking-[.18em] text-[#b6a783]">แผนผัง</p><h2 className="mt-1 font-serif text-2xl">โรงแรม</h2></div>
      <p className="text-xs text-[#a7a8b4]">{onSkillRoomSelect ? "แตะห้องเพื่อเลือกเป้าหมายสกิล" : onSkillFloorSelect ? "แตะชั้นหรือห้องในชั้นนั้น" : onSkillColumnSelect ? "แตะแนวหรือห้องในแนวนั้น" : onVote ? "แตะห้องเพื่อลงคะแนน" : "7 ชั้น · 21 ห้อง"}</p>
    </div>
    <div className="mt-4 space-y-2"><div className="grid grid-cols-[2rem_repeat(3,minmax(0,1fr))] gap-2 text-center text-xs text-[#a7a8b4]"><span className="self-center">ชั้น</span>{[1, 2, 3].map((column) => onSkillColumnSelect && state.publicRooms.some((room) => room.state === "UNKNOWN" && room.roomNumber % 100 === column) ? <button key={column} type="button" aria-label={`เลือกแนวห้อง 0${column} เป็นเป้าหมายสกิล`} aria-pressed={selectedSkillColumn === column} disabled={voteBusy} onClick={() => onSkillColumnSelect(column)} className={`rounded-md border px-1 py-2 focus-visible:outline-2 focus-visible:outline-[#e3c88e] ${selectedSkillColumn === column ? "border-[#f2d79c] bg-[#4a3942] text-[#f2d79c]" : "border-[#3d3d49] hover:border-[#e3c88e]"}`}>แนว 0{column}</button> : <span key={column} className="self-center">แนว 0{column}</span>)}</div>{Array.from({ length: 7 }, (_, index) => 7 - index).map((floor) =>
      <div key={floor} className="grid grid-cols-[2rem_repeat(3,minmax(0,1fr))] items-stretch gap-2">
        {onSkillFloorSelect && state.publicRooms.some((room) => room.state === "UNKNOWN" && Math.floor(room.roomNumber / 100) === floor) ? <button type="button" aria-label={`เลือกชั้น ${floor} เป็นเป้าหมายสกิล`} aria-pressed={selectedSkillFloor === floor} disabled={voteBusy} onClick={() => onSkillFloorSelect(floor)} className={`rounded-md border text-center text-sm focus-visible:outline-2 focus-visible:outline-[#e3c88e] ${selectedSkillFloor === floor ? "border-[#f2d79c] bg-[#4a3942] text-[#f2d79c]" : "border-[#3d3d49] text-[#a7a8b4] hover:border-[#e3c88e]"}`}>{floor}</button> : <span className="self-center text-center text-sm text-[#a7a8b4]">{floor}</span>}
        {[1, 2, 3].map((column) => {
          const room = rooms.get(floor * 100 + column);
          if (!room) return null;
          const label = room.state === "CRIME_SCENE" ? "ร่องรอยปริศนา" : room.state === "MURDERED" ? "ถูกฆาตกรรม" : room.state === "OPENED_MURDERED" ? "ถูกฆาตกรรม · เปิดแล้ว" : room.state === "OPENED_EMPTY" ? "เปิดแล้ว · ว่าง" : room.state === "OPENED_OCCUPIED" ? "เปิดแล้ว · มีผู้พัก" : "ยังไม่เปิด";
          const marked = room.state === "CRIME_SCENE" || room.state === "MURDERED" || room.state === "OPENED_MURDERED";
          const opened = room.state.startsWith("OPENED_");
          const eligible = room.state === "UNKNOWN";
          const canVote = eligible && !!onVote && (!state.runoffRooms?.length || state.runoffRooms.includes(room.roomNumber));
          const canSelectSkill = eligible && !!onSkillRoomSelect;
          const canSelect = eligible && (canVote || canSelectSkill || !!onSkillFloorSelect || !!onSkillColumnSelect);
          const selected = canSelect && (canSelectSkill && selectedSkillRoom === room.roomNumber || !!onSkillFloorSelect && selectedSkillFloor === floor || !!onSkillColumnSelect && selectedSkillColumn === column);
          const className = `flex min-h-16 flex-col justify-center rounded-md border px-2 py-2 text-center sm:min-h-18 ${marked ? "border-[#9b555d] bg-[#302127]" : opened ? "border-[#5f594f] bg-[#25252b]" : "border-[#3d3d49] bg-[#22232c]"} ${canSelect ? "cursor-pointer ring-1 ring-[#c8a46b]/50 transition-colors hover:border-[#e3c88e] hover:bg-[#38313b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c88e] disabled:cursor-wait" : ""} ${selected ? "border-[#f2d79c] ring-2 ring-[#f2d79c] bg-[#4a3942]" : ""} ${opened ? "opacity-[0.35]" : ""}`;
          const content = <>
            <span className="font-mono text-sm font-semibold text-[#f4efe8] sm:text-base">{room.roomNumber}</span>
            <span className={`mt-1 text-[10px] leading-tight sm:text-xs ${marked ? "text-[#efb3b7]" : "text-[#b0b0bc]"}`}>{label}</span>
          </>;
          return canSelect ? <button key={room.roomNumber} type="button" aria-label={canSelectSkill ? `เลือกห้อง ${room.roomNumber} เป็นเป้าหมายสกิล ${label}` : onSkillFloorSelect ? `เลือกชั้น ${floor} ผ่านห้อง ${room.roomNumber}` : onSkillColumnSelect ? `เลือกแนวห้อง 0${column} ผ่านห้อง ${room.roomNumber}` : `โหวตห้อง ${room.roomNumber} ${label}`} aria-pressed={canSelectSkill || onSkillFloorSelect || onSkillColumnSelect ? selected : undefined} className={className} disabled={voteBusy} onClick={() => canSelectSkill ? onSkillRoomSelect(room.roomNumber) : onSkillFloorSelect ? onSkillFloorSelect(floor) : onSkillColumnSelect ? onSkillColumnSelect(column) : onVote?.(room.roomNumber)}>{content}</button>
            : <div key={room.roomNumber} aria-label={`ห้อง ${room.roomNumber} ${label}`} className={className}>{content}</div>;
        })}
      </div>)}</div>
  </Paper>;
}

export function RoleRevealCard({ privateState }: { privateState: PrivatePlayerState }) {
  return <div className="mt-4 rounded-xl border border-[#c8a46b]/40 bg-[#29202b] p-4 text-left"><p className="text-xs tracking-[.2em] text-[#c8a46b]">บทบาทของคุณ · เฉพาะคุณ</p><p className="mt-2 font-serif text-2xl">{roleNames[privateState.role]} · ห้อง {privateState.roomNumber}</p><p className="mt-2 text-sm text-[#d8d2d8]">{privateState.team === "INNOCENT" ? "ฝ่ายผู้บริสุทธิ์" : "ฝ่ายฆาตกร"}</p><p className="mt-3 border-t border-[#c8a46b]/20 pt-3 text-sm leading-6 text-[#d8d2d8]">{roleSkillDescriptions[privateState.role]}</p></div>;
}

export function StoryPrologue({ deadline, connected, connectionMessage, privateState, avatarId }: { deadline?: number; connected: boolean; connectionMessage: string; privateState: PrivatePlayerState | null; avatarId?: AvatarId | null }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showRole, setShowRole] = useState(false);
  const avatar = avatarById(avatarId);
  useEffect(() => {
    if (deadline === undefined) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);
  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_20%,#452433,#100f17_68%)] px-5 py-10 text-[#f4efe8]">
    <section className="w-full max-w-2xl rounded-3xl border border-[#c8a46b]/35 bg-[#17141d]/90 px-7 py-10 text-center shadow-2xl sm:px-14 sm:py-14" aria-labelledby="prologue-title">
      <p className="text-xs tracking-[.35em] text-[#c8a46b]">HOTEL MURDER ONLINE</p>
      <p className="mt-8 text-sm tracking-[.22em] text-[#d8bc86]">ก่อนเรื่องราวจะเริ่ม</p>
      <h1 id="prologue-title" className="mt-3 font-serif text-3xl leading-relaxed sm:text-5xl">คืนที่โรงแรมไม่หลับใหล</h1>
      <div className="mx-auto mt-7 h-px w-24 bg-[#c8a46b]/60" />
      <div className="mt-7 space-y-5 text-base leading-8 text-[#d8d2d8] sm:text-lg sm:leading-9">
        <p>พายุโหมกระหน่ำจนถนนทุกสายถูกตัดขาด แขกทุกคนต้องค้างคืนในโรงแรมเก่าแห่งนี้</p>
        <p>เมื่อเข็มนาฬิกาชี้เที่ยงคืน ไฟทั้งอาคารดับวูบ เสียงฝีเท้าปริศนาดังผ่านทางเดินที่ไร้ผู้คน</p>
        <p>พอแสงไฟกลับมา พบร่องรอยปริศนาในห้องว่างสามห้อง ไม่มีใครเสียชีวิตที่นั่น บางคนมาเพื่อหาความจริง… บางคนมาเพื่อซ่อนมัน</p>
      </div>
      {avatar && <div className="mx-auto mt-7 flex max-w-xs items-center gap-3 rounded-xl border border-[#c8a46b]/30 bg-[#29202b] p-2 text-left"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"><Image src={avatar.portrait} alt={avatar.name} fill sizes="56px" className="object-cover object-top" /></div><div><p className="text-xs text-[#c8a46b]">อวาตาร์ของคุณ</p><p>{avatar.name}</p></div></div>}
      {privateState && <div className="mt-7"><Button variant="outlined" aria-expanded={showRole} onClick={() => setShowRole((open) => !open)}>{showRole ? "ปิดบทบาทของฉัน" : "เปิดดูบทบาทของฉัน"}</Button>{showRole && <RoleRevealCard privateState={privateState} />}</div>}
      <p className="mt-9 text-sm text-[#c8a46b]" role="status">{!connected ? connectionMessage || "กำลังเชื่อมต่อใหม่…" : secondsLeft === null ? "กำลังเตรียมเปิดเผยเบาะแส…" : secondsLeft > 0 ? `เบาะแสแรกจะปรากฏใน ${secondsLeft} วินาที` : "กำลังเปิดเผยเบาะแส…"}</p>
    </section>
  </main>;
}

export function SkillPanel({ privateState, state, selectedRoom = null, selectedFloor = null, selectedColumn = null, selectedPlayerId = null }: { privateState: PrivatePlayerState; state: PublicGameState; selectedRoom?: number | null; selectedFloor?: number | null; selectedColumn?: number | null; selectedPlayerId?: string | null }) {
  const role = privateState.role;
  const room = usesRoomTarget(role);
  const floor = usesFloorTarget(role);
  const column = usesColumnTarget(role);
  const selectedPlayer = state.players.find((player) => player.id === selectedPlayerId && player.id !== privateState.playerId);
  const prompt = room ? selectedRoom === null ? "แตะห้องบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: ห้อง ${selectedRoom}` : floor ? selectedFloor === null ? "แตะเลขชั้นบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: ชั้น ${selectedFloor}` : column ? selectedColumn === null ? "แตะหัวแนวห้องบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: แนวห้อง 0${selectedColumn}` : selectedPlayer ? `เป้าหมาย: ${selectedPlayer.displayName}` : "แตะผู้เข้าพักในรายชื่อเพื่อเลือกเป้าหมาย";
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">ใช้สกิล · {roleNames[role]}</h2><p className="mt-3 text-sm leading-6 text-[#d8d2d8]">{roleSkillDescriptions[role]}</p><p className="mt-4 rounded-lg border border-[#c8a46b]/35 bg-[#362939] p-3 text-sm font-semibold text-[#f2d79c]">{prompt}</p></Paper>;
}

export function SkillConfirmBar({ targetLabel, canSubmit, onConfirm }: { targetLabel: string; canSubmit: boolean; onConfirm: () => void }) {
  return <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4" role="group" aria-label="ยืนยันการใช้สกิล">
    <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#e3c88e]/60 bg-[#211923]/95 p-3 shadow-[0_12px_50px_rgba(0,0,0,.7)] backdrop-blur-md">
      <p className="min-w-0 flex-1 truncate text-sm text-[#f2d79c]">{targetLabel}</p>
      <Button variant="contained" disabled={!canSubmit} onClick={onConfirm}>ยืนยันสกิล</Button>
    </div>
  </div>;
}

export function GameScreen({ state, privateState, teamState, result, murderSequence, connected, connectionMessage, onCommand }: { state: PublicGameState; privateState: PrivatePlayerState | null; teamState: PrivateTeamState | null; result: GameResultState | null; murderSequence: number; connected: boolean; connectionMessage: string; onCommand: (event: "game:skill" | "game:vote", payload: Record<string, unknown>, version: number) => Promise<LobbyAck<{ version: number }>> }) {
  const [muted, setMuted] = useState(false);
  const [deathDismissed, setDeathDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [skillBoardSelection, setSkillBoardSelection] = useState<{ turn: number; playerId: string; kind: "room" | "floor" | "column"; target: number } | null>(null);
  const [skillPlayerSelection, setSkillPlayerSelection] = useState<{ turn: number; playerId: string; targetId: string } | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const skillDeadlineAt = privateState?.canUseSkill ? privateState.skillDeadlineAt : undefined;
  const actionDeadlineAt = skillDeadlineAt ?? (state.phase === "VOTING" ? state.phaseDeadlineAt : undefined);
  useEffect(() => {
    if (actionDeadlineAt === undefined) return;
    const tick = () => setClockNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [actionDeadlineAt]);
  const skillSecondsLeft = skillDeadlineAt === undefined || clockNow === null ? null : Math.max(0, Math.ceil((skillDeadlineAt - clockNow) / 1000));
  const voteExpired = state.phase === "VOTING" && state.phaseDeadlineAt !== undefined && clockNow !== null && clockNow >= state.phaseDeadlineAt;
  const roomSkillActive = !!privateState?.canUseSkill && usesRoomTarget(privateState.role);
  const floorSkillActive = !!privateState?.canUseSkill && usesFloorTarget(privateState.role);
  const columnSkillActive = !!privateState?.canUseSkill && usesColumnTarget(privateState.role);
  const selectedBoardTarget = skillBoardSelection?.turn === state.turn && skillBoardSelection.playerId === privateState?.playerId
    && state.publicRooms.some((room) => room.state === "UNKNOWN" && (skillBoardSelection.kind === "room" ? room.roomNumber === skillBoardSelection.target : skillBoardSelection.kind === "floor" ? Math.floor(room.roomNumber / 100) === skillBoardSelection.target : room.roomNumber % 100 === skillBoardSelection.target))
    ? skillBoardSelection : null;
  const selectedSkillRoom = selectedBoardTarget?.kind === "room" ? selectedBoardTarget.target : null;
  const selectedSkillFloor = selectedBoardTarget?.kind === "floor" ? selectedBoardTarget.target : null;
  const selectedSkillColumn = selectedBoardTarget?.kind === "column" ? selectedBoardTarget.target : null;
  const selectedSkillPlayer = skillPlayerSelection?.turn === state.turn && skillPlayerSelection.playerId === privateState?.playerId ? skillPlayerSelection.targetId : null;
  const skillTarget = privateState ? usesRoomTarget(privateState.role) ? selectedSkillRoom : usesFloorTarget(privateState.role) ? selectedSkillFloor : usesColumnTarget(privateState.role) ? selectedSkillColumn : privateState.role === "ACCOMPLICE" ? selectedSkillPlayer : null : null;
  const selectedPlayerName = state.players.find((player) => player.id === selectedSkillPlayer)?.displayName;
  const skillTargetLabel = skillTarget === null ? "ยังไม่ได้เลือกเป้าหมาย" : typeof skillTarget === "string" ? `ผู้เข้าพัก: ${selectedPlayerName ?? "ไม่พบผู้เล่น"}` : usesRoomTarget(privateState!.role) ? `ห้อง ${skillTarget}` : usesFloorTarget(privateState!.role) ? `ชั้น ${skillTarget}` : `แนวห้อง 0${skillTarget}`;
  const skillExpired = skillDeadlineAt !== undefined && (skillSecondsLeft === null || skillSecondsLeft === 0);
  const canConfirmSkill = !!privateState?.canUseSkill && skillTarget !== null && !busy && connected && !skillExpired;
  const selectBoardTarget = (kind: "room" | "floor" | "column", target: number) => {
    if (privateState) setSkillBoardSelection({ turn: state.turn, playerId: privateState.playerId, kind, target });
  };
  const turnNotice = getTurnNotice(state, privateState);
  const changeMuted = (value: boolean) => setMuted(value);
  const act = async (event: "game:skill" | "game:vote", payload: Record<string, unknown>) => {
    setBusy(true); setError("");
    const response = await onCommand(event, payload, state.version);
    if (!response.ok) setError(lobbyErrorMessage(response.error));
    setBusy(false);
  };
  if (state.phase === "ROLE_REVEAL") return <StoryPrologue deadline={state.phaseDeadlineAt} connected={connected} connectionMessage={connectionMessage} privateState={privateState} avatarId={state.players.find((player) => player.id === privateState?.playerId)?.avatarId} />;
  return <main className={`min-h-screen bg-[radial-gradient(circle_at_85%_0%,#3a2135,#111116_54%)] px-4 py-6 text-[#f4efe8] sm:px-8 ${privateState?.canUseSkill ? "pb-32" : ""} ${state.phase === "DISCUSSION" ? "pt-24" : ""}`}><div className="mx-auto max-w-6xl">
    {state.phase === "DISCUSSION" && state.phaseDeadlineAt && <div className="fixed inset-x-0 top-3 z-30 flex justify-center px-4" role="timer"><div className="rounded-2xl border border-[#e3c88e]/60 bg-[#211923]/95 px-5 py-3 text-center shadow-[0_12px_40px_rgba(0,0,0,.6)] backdrop-blur-md"><DiscussionTimer deadline={state.phaseDeadlineAt} /></div></div>}
    {!connected && <p role="status" className="mb-5 rounded-lg border border-[#c8a46b]/40 bg-[#32272a] p-3 text-sm text-[#f4efe8]">{connectionMessage || "กำลังเชื่อมต่อใหม่…"}</p>}
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#c8a46b]/25 pb-5"><div><p className="text-xs tracking-[.24em] text-[#c8a46b]">คืนนี้ใครฆ่า... · {state.code}</p><h1 className="mt-2 font-serif text-3xl">รอบ {state.turn} · {state.phase === "SKILL_PHASE" ? "ช่วงใช้สกิล" : state.phase === "DISCUSSION" ? "ช่วงพูดคุย" : state.phase === "VOTING" ? "ช่วงลงคะแนน" : state.phase === "RESOLUTION" ? "ผลการเปิดห้อง" : "จบเกม"}</h1></div><SoundSettings muted={muted} onChange={changeMuted} /></header>
    <Alert severity={privateState?.canUseSkill || privateState?.canVote ? "warning" : "info"} role="status" className="mb-5!">{turnNotice}</Alert>
    {privateState?.canUseSkill && <div role="alert" aria-live="polite" className="mb-5 rounded-xl border-2 border-[#e3c88e] bg-[linear-gradient(125deg,#493447,#30202d)] p-5 shadow-[0_0_35px_rgba(227,200,142,.18)]"><p className="text-xs font-semibold tracking-[.2em] text-[#f2d79c]">ถึงตาคุณใช้สกิล</p><h2 className="mt-2 font-serif text-2xl">{roleNames[privateState.role]}</h2><p className="mt-2 text-sm leading-7 text-[#f4e5cc]">{skillActionInstructions[privateState.role]}</p></div>}
    {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
    {showSecret && privateState && (privateState.role === "RECEPTIONIST" || privateState.role === "PHOTOGRAPHER") && state.turn === 3 && <div role="status" className="mb-5 rounded-xl border border-[#e3c88e]/60 bg-[#30202d] p-4 font-semibold text-[#f2d79c]">{skillActionInstructions[privateState.role]}</div>}
    {privateState?.privateResults.some((message) => message.startsWith("ทะเบียนห้องพักเทิร์นที่ 3:") || message.startsWith("ภาพถ่ายเทิร์นที่ 3:")) && !showSecret && <Alert severity="info" className="mb-5!">มีผลสืบสวนส่วนตัวใหม่ เปิดข้อมูลลับเพื่อดู</Alert>}
    {state.phase !== "SKILL_PHASE" && privateState?.skillBlockReason && <Alert severity="warning" className="mb-5!">{privateState.skillBlockReason === "BLACKOUT" ? "ไฟดับบนชั้นของคุณ รอบนี้จึงใช้สกิลไม่ได้" : "สกิลช่างไฟกำลังพักหนึ่งรอบ รอบนี้ใช้สกิลไม่ได้"}</Alert>}
    {privateState?.canUseSkill && skillDeadlineAt !== undefined && <p className="mb-5 text-sm text-[#e7ce98]" role="timer" aria-live="off">{skillSecondsLeft === null ? "กำลังตรวจเวลาใช้สกิล…" : skillSecondsLeft > 0 ? `เวลาใช้สกิลเหลือ ${skillSecondsLeft} วินาที` : "หมดเวลาใช้สกิลแล้ว กำลังรอขั้นตอนถัดไป"}</p>}
    {result ? <div className="space-y-5"><GameResultScreen result={result} />{privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}</div> : <div className="grid gap-5 lg:grid-cols-[1.3fr_.8fr]"><HotelBoard state={state} onVote={state.phase === "VOTING" && privateState?.canVote ? (roomNumber) => void act("game:vote", { roomNumber }) : undefined} onSkillRoomSelect={roomSkillActive ? (roomNumber) => selectBoardTarget("room", roomNumber) : undefined} onSkillFloorSelect={floorSkillActive ? (floor) => selectBoardTarget("floor", floor) : undefined} onSkillColumnSelect={columnSkillActive ? (column) => selectBoardTarget("column", column) : undefined} selectedSkillRoom={selectedSkillRoom} selectedSkillFloor={selectedSkillFloor} selectedSkillColumn={selectedSkillColumn} voteBusy={busy || !connected || voteExpired || ((roomSkillActive || floorSkillActive || columnSkillActive) && skillSecondsLeft === 0)} /><div className="space-y-5">
      {privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}
      <PublicGuests players={state.players} selfId={privateState?.playerId} selectedPlayerId={selectedSkillPlayer} onSelectPlayer={privateState?.canUseSkill && privateState.role === "ACCOMPLICE" ? (targetId) => setSkillPlayerSelection({ turn: state.turn, playerId: privateState.playerId, targetId }) : undefined} />
      {privateState?.mode === "SPECTATOR" && <SpectatorPanel />}
      {state.phase === "SKILL_PHASE" && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><p>{state.phaseMessage}</p></Paper>}
      {privateState?.canUseSkill && <SkillPanel state={state} privateState={privateState} selectedRoom={selectedSkillRoom} selectedFloor={selectedSkillFloor} selectedColumn={selectedSkillColumn} selectedPlayerId={selectedSkillPlayer} />}
      {state.phase === "DISCUSSION" && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><p className="text-sm text-[#c6bdb1]">พูดคุยนอกเว็บไซต์ได้ตามต้องการ นาฬิกาอยู่ด้านบนของหน้าจอ</p></Paper>}
      {state.phase === "VOTING" && state.phaseDeadlineAt && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><PhaseTimer deadline={state.phaseDeadlineAt} label="เวลาลงคะแนน" /><p className="mt-2 text-sm text-[#c6bdb1]">เมื่อหมดเวลา ระบบจะนับคะแนนที่มีและเปิดห้องหนึ่งห้อง</p></Paper>}
      {state.phase === "RESOLUTION" && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">ผลการเปิดห้อง</h2><p className="mt-3 text-lg text-[#e7ce98]">{[...(state.publicHistory ?? [])].reverse().find((event) => event.type === "ROOM_OPENED")?.message}</p>{state.phaseDeadlineAt && <div className="mt-4"><PhaseTimer deadline={state.phaseDeadlineAt} label={state.turn >= 4 ? "สรุปผลเกมใน" : "เริ่มรอบถัดไปใน"} /></div>}</Paper>}
      <Paper className="border! border-[#353440]! bg-[#191a22]! p-5!"><h2 className="font-serif text-xl">ประวัติเหตุการณ์สาธารณะ</h2><ol className="mt-3 space-y-2 text-sm text-[#c6bdb1]">{state.publicHistory?.map((event, index) => <li key={`${event.type}-${index}`}>{event.message}</li>)}</ol></Paper>
    </div></div>}
  </div>{privateState?.canUseSkill && <SkillConfirmBar targetLabel={skillTargetLabel} canSubmit={canConfirmSkill} onConfirm={() => { if (skillTarget !== null) void act("game:skill", { target: skillTarget }); }} />}<MurderEventOverlay sequence={murderSequence} muted={muted} />{privateState?.mode === "SPECTATOR" && !deathDismissed && state.phase !== "FINISHED" && <DeathNotification onContinue={() => setDeathDismissed(true)} />}</main>;
}
