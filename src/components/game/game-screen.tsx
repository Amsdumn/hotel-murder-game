"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper } from "@mui/material";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";
import { SoundToggleButton } from "@/components/sound-toggle-button";
import { avatarEnglish } from "@/lib/avatar-translations";
import { gameMessage } from "@/lib/game-copy";
import { getGameSoundEvent, playGameSound, type GameSoundSnapshot } from "@/lib/game-sound";
import type { Language } from "@/lib/language";
import { lobbyErrorMessage } from "@/lib/lobby-client";
import { roleSkillDescriptions, roleSkillDescriptionsEn } from "@/lib/role-skills";
import { RolePortrait, roleNames, roleNamesEn } from "@/components/role-portrait";
import type { GameResultState, PrivatePlayerState, PrivateTeamState, PublicGameState, Role } from "@/types/game";
import type { LobbyAck } from "@/types/lobby";
import { MurderEventOverlay } from "./murder-event-overlay";
import { PrivateRoomScene } from "./private-room-scene";
import { ReceptionistRegister } from "./receptionist-register";
import { PhotographerResult } from "./photographer-result";
import { FloatingGameChat } from "./game-chat";
import { avatarById, type AvatarId } from "@/lib/avatars";

export function PublicGuests({ players, selfId, selectedPlayerId, selectedPlayerIds = [], selectionCount = 1, onSelectPlayer, onlinePlayerIds = [] }: { players: PublicGameState["players"]; selfId?: string; selectedPlayerId?: string | null; selectedPlayerIds?: string[]; selectionCount?: 1 | 2; onSelectPlayer?: (playerId: string) => void; onlinePlayerIds?: string[] }) {
  const en = useLanguage() === "en";
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <h2 className="font-serif text-xl">{en ? "Guests" : "ผู้เข้าพัก"}</h2>
    <p className="mt-1 text-xs text-[#a9a5af]">{onSelectPlayer ? selectionCount === 2 ? en ? "Select two living guests as skill targets" : "แตะผู้เข้าพักที่ยังมีชีวิตสองคนเพื่อเลือกเป้าหมายสกิล" : en ? "Select a guest as your skill target" : "แตะผู้เข้าพักหนึ่งคนเพื่อเลือกเป้าหมายสกิล" : en ? "A character does not reveal a role or team" : "อวาตาร์ไม่บอกบทบาทหรือฝ่าย"}</p>
    <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">{players.map((player) => {
      const avatar = avatarById(player.avatarId);
      const dead = player.isAlive === false;
      const online = onlinePlayerIds.includes(player.id);
      const selectable = !!onSelectPlayer && player.id !== selfId && !dead;
      const selected = selectable && (selectedPlayerId === player.id || selectedPlayerIds.includes(player.id));
      const content = <><div className={`flex min-w-0 items-center gap-2 ${dead ? "opacity-50 grayscale" : ""}`}>{avatar && <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md"><Image src={avatar.portrait} alt="" fill sizes="48px" className="object-cover object-top" /></div>}<div className="min-w-0"><p className="max-w-[150px] truncate text-sm" title={player.displayName}>{player.displayName}</p><p className="truncate text-xs text-[#c8a46b]">{dead ? en ? "Dead" : "เสียชีวิต" : avatar ? en ? avatarEnglish[avatar.id].name : avatar.name : en ? "Guest" : "ผู้เข้าพัก"}</p></div></div><span aria-label={online ? en ? "Online" : "ออนไลน์" : en ? "Offline" : "ออฟไลน์"} title={online ? en ? "Online" : "ออนไลน์" : en ? "Offline" : "ออฟไลน์"} className={`absolute right-2 top-2 z-10 h-2.5 w-2.5 rounded-full ring-2 ring-[#1d1d26] ${online ? "bg-emerald-400" : "bg-[#777683]"}`} /></>;
      const className = `relative flex items-center gap-2 rounded-lg border p-2 pr-7 text-left ${dead ? "border-[#c8a46b]/10 bg-[#25252b]" : selected ? "border-[#f2d79c] bg-[#4a3942] ring-2 ring-[#f2d79c]" : selectable ? "cursor-pointer border-[#c8a46b]/50 bg-[#29202b] ring-1 ring-[#c8a46b]/50 transition-colors" : "border-[#c8a46b]/15 bg-[#29202b]"}`;
      return onSelectPlayer && player.id !== selfId ? <button key={player.id} type="button" aria-label={dead ? en ? `${player.displayName} is dead` : `${player.displayName} เสียชีวิต` : en ? `Select guest ${player.displayName} as skill target` : `เลือกผู้เข้าพัก ${player.displayName} เป็นเป้าหมายสกิล`} aria-pressed={selected} disabled={dead} className={`${className} ${dead ? "cursor-not-allowed" : "hover:border-[#e3c88e] focus-visible:outline-2 focus-visible:outline-[#e3c88e]"}`} onClick={() => onSelectPlayer(player.id)}>{content}</button> : <div key={player.id} aria-disabled={dead || undefined} className={className}>{content}</div>;
    })}</div>
  </Paper>;
}

export function SoundSettings({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) {
  return <SoundToggleButton muted={muted} onChange={onChange} />;
}

function GameTimerBanner({ deadline, label, mobileInline = false }: { deadline: number; label: string; mobileInline?: boolean }) {
  return <div className={mobileInline ? "sticky top-2 z-30 mb-4 flex justify-center px-4 lg:fixed lg:inset-x-0 lg:top-3 lg:mb-0" : "fixed inset-x-0 top-3 z-30 flex justify-center px-4"} role="timer">
    <div className="rounded-2xl border border-[#e3c88e]/60 bg-[#211923]/95 px-5 py-3 text-center shadow-[0_12px_40px_rgba(0,0,0,.6)] backdrop-blur-md">
      <PhaseTimer deadline={deadline} label={label} />
    </div>
  </div>;
}

function PhaseTimer({ deadline, label }: { deadline: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(interval); }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <p className="text-2xl font-semibold text-[#c8a46b]" aria-live="off">{label} {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>;
}

export function DeathNotification({ onContinue }: { onContinue: () => void }) {
  const en = useLanguage() === "en";
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#100b10]/95 px-5 text-center text-[#f4efe8]" role="dialog" aria-modal="true" aria-labelledby="death-title">
    <div className="max-w-lg rounded-2xl border border-[#6d1728] bg-[#1d1d26] p-8 shadow-2xl">
      <p className="mb-3 text-sm tracking-[.25em] text-[#c8a46b]">{en ? "SPECTATOR MODE" : "โหมดผู้ชม"}</p>
      <h2 id="death-title" className="font-serif text-4xl text-[#f4efe8]">{en ? "You have died" : "คุณเสียชีวิตแล้ว"}</h2>
      <p className="mt-5 leading-8">{en ? "You can keep watching, but can no longer use skills or vote." : "คุณสามารถติดตามเกมต่อได้ แต่ไม่สามารถใช้สกิลหรือโหวตได้อีก"}</p>
      <p className="mt-5 rounded-lg border border-[#c8a46b]/30 p-3 text-sm leading-7 text-[#c8a46b]">{en ? "Stop sharing game information immediately, even if you continue watching." : "ผู้เล่นที่เสียชีวิตแล้วต้องหยุดให้ข้อมูลเกี่ยวกับเกมทันที แม้จะยังสามารถรับชมเกมต่อได้"}</p>
      <Button className="mt-7!" variant="contained" onClick={onContinue}>{en ? "Keep watching" : "รับชมเกมต่อ"}</Button>
    </div>
  </div>;
}

export function SpectatorPanel() {
  const en = useLanguage() === "en";
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">{en ? "Spectator mode" : "โหมดผู้ชม"}</h2><p className="mt-2 text-sm leading-7 text-[#c6bdb1]">{en ? "You may watch public events and voting results. Stop sharing game information immediately." : "คุณสามารถดูเหตุการณ์สาธารณะและผลโหวตได้ โปรดหยุดให้ข้อมูลเกี่ยวกับเกมทันที"}</p></Paper>;
}

export function getTurnNotice(state: PublicGameState, privateState: PrivatePlayerState | null, language: Language = "th"): string {
  if (language === "en") {
    if (state.phase === "FINISHED") return "The game is over. Review the result and event history.";
    if (privateState?.mode === "SPECTATOR") return "You are a spectator. You may watch, but cannot use skills or vote.";
    if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "BLACKOUT") return "Your floor is dark. You cannot use your skill this turn.";
    if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "COOLDOWN") return "Your Electrician skill is cooling down this turn.";
    if (state.phase === "SKILL_PHASE" && privateState?.role === "FORMER_POLICE") return "Your clue arrives automatically on your skill slot. Check your private information.";
    if (state.phase === "SKILL_PHASE") return privateState?.canUseSkill ? "Your skill is ready. Choose a target and confirm before time runs out." : "Skill phase: waiting for the active player.";
    if (state.phase === "DISCUSSION") return "The hotel lobby is open. Trade clues before the ballot begins.";
    if (state.phase === "VOTING" && !privateState) return "Voting: checking your eligibility.";
    if (state.phase === "VOTING") return privateState?.canVote ? state.runoffRooms?.length ? "The ballot is tied. Choose another guest's room; you may change your vote until the clock runs out. The lobby chat stays open." : "Cast your suspicion on another guest's room. You may change your vote until the clock runs out; the lobby chat stays open." : "The ballot is open. Follow the guests' votes and clues.";
    if (state.phase === "RESOLUTION") return "The chosen door is opening. See what the hotel has been hiding.";
    return "Preparing the next phase.";
  }
  if (state.phase === "FINISHED") return "เกมจบแล้ว ดูผลการแข่งขันและประวัติเหตุการณ์ได้";
  if (privateState?.mode === "SPECTATOR") return "คุณเป็นผู้ชม ติดตามเหตุการณ์ได้ แต่ไม่สามารถใช้สกิลหรือลงคะแนน";
  if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "BLACKOUT") return "ไฟดับบนชั้นของคุณ รอบนี้จึงใช้สกิลไม่ได้";
  if (state.phase === "SKILL_PHASE" && privateState?.skillBlockReason === "COOLDOWN") return "สกิลช่างไฟกำลังพักหนึ่งรอบ รอบนี้ใช้สกิลไม่ได้";
  if (state.phase === "SKILL_PHASE" && privateState?.role === "FORMER_POLICE") return "คำใบ้ของคุณจะมาถึงอัตโนมัติเมื่อถึงคิว ตรวจในข้อมูลลับ";
  if (state.phase === "SKILL_PHASE") return privateState?.canUseSkill
    ? "ถึงตาคุณใช้สกิล เลือกเป้าหมายและยืนยันก่อนหมดเวลา"
    : "ช่วงใช้สกิล กำลังรอผู้เล่นที่ถึงคิวดำเนินการ";
  if (state.phase === "DISCUSSION") return "ล็อบบี้เปิดวงสนทนาแล้ว แลกเบาะแสก่อนเปิดหีบลงคะแนน";
  if (state.phase === "VOTING" && !privateState) return "ช่วงลงคะแนน กำลังตรวจสิทธิ์ของคุณ";
  if (state.phase === "VOTING") return privateState?.canVote
    ? state.runoffRooms?.length ? "คะแนนยังเสมอ เลือกห้องผู้เข้าพักคนอื่นในรอบตัดสิน เปลี่ยนใจได้จนหมดเวลา และยังคุยในล็อบบี้ได้" : "ลงคะแนนเลือกห้องผู้เข้าพักคนอื่น เปลี่ยนใจได้จนหมดเวลา และยังคุยในล็อบบี้ได้"
    : "หีบลงคะแนนเปิดอยู่ ติดตามคะแนนและเบาะแสจากผู้เข้าพัก";
  if (state.phase === "RESOLUTION") return "ประตูห้องที่ถูกเลือกกำลังเปิด เผยความลับที่โรงแรมซ่อนไว้";
  return "กำลังเตรียมขั้นตอนถัดไป";
}

export function PrivateInfoPanel({ privateState, teamState, players, open, onToggle }: { privateState: PrivatePlayerState; teamState: PrivateTeamState | null; players: PublicGameState["players"]; open: boolean; onToggle: () => void }) {
  const language = useLanguage();
  const en = language === "en";
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-serif text-xl">{en ? "Private information · yours only" : "ข้อมูลลับ · เฉพาะคุณ"}</h2><p className="mt-1 text-xs text-[#a9a5af]">{en ? "Open only when you are in private" : "เปิดดูเมื่ออยู่ในที่ส่วนตัว"}</p></div>
      <Button variant="outlined" size="small" aria-expanded={open} onClick={onToggle}>{open ? en ? "Hide" : "ปิดข้อมูลลับ" : en ? "Show" : "แสดงข้อมูลลับ"}</Button>
    </div>
    {open && <div className="mt-5 space-y-5 border-t border-[#c8a46b]/15 pt-5">
      <PrivateRoomScene role={privateState.role} roomNumber={privateState.roomNumber} team={privateState.team} isAlive={privateState.isAlive} isActive={privateState.canUseSkill} avatarId={players.find((player) => player.id === privateState.playerId)?.avatarId} />
      {teamState && <section><h3 className="font-semibold text-[#d8bc86]">{en ? "Murderer team" : "ฝ่ายฆาตกร"}</h3>{teamState.teammates.map((mate) => <p className="mt-2 text-sm" key={mate.playerId}><span className="inline-block max-w-37.5 truncate align-bottom" title={players.find((player) => player.id === mate.playerId)?.displayName}>{players.find((player) => player.id === mate.playerId)?.displayName}</span> · {en ? roleNamesEn[mate.role] : roleNames[mate.role]} · {en ? "Room" : "ห้อง"} {mate.roomNumber}</p>)}</section>}
      {privateState.actionHistory.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">{en ? "Your action history" : "ประวัติการกระทำของคุณ"}</h3><ol className="mt-2 space-y-2 text-sm text-[#d6d2dc]">{privateState.actionHistory.map((entry, index) => <li key={`${entry.turn}-${index}`}>{en ? "Turn" : "รอบ"} {entry.turn} · {gameMessage(entry.message, language)}</li>)}</ol></section>}
      {privateState.privateResults.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">{en ? "Private investigation results" : "ผลสืบสวนส่วนตัว"}</h3><div className="mt-2 space-y-3">{privateState.privateResults.map((message, index) => privateState.role === "RECEPTIONIST" && message.startsWith("ทะเบียนห้องพักเทิร์นที่ 3:") ? <ReceptionistRegister key={index} message={message} players={players} /> : privateState.role === "PHOTOGRAPHER" && message.startsWith("ภาพถ่ายเทิร์นที่ 3:") ? <PhotographerResult key={index} message={message} players={players} language={language} /> : <p key={index} className="text-sm leading-7">{gameMessage(message, language)}</p>)}</div></section>}
    </div>}
  </Paper>;
}

export function getFreshSkillResults(previous: PrivatePlayerState | null, current: PrivatePlayerState | null): string[] {
  if (!previous || !current || previous.playerId !== current.playerId) return [];
  if (current.privateResults.length > previous.privateResults.length) return current.privateResults.slice(previous.privateResults.length);
  return current.actionHistory.slice(previous.actionHistory.length)
    .filter((action) => action.type === "SKILL" && action.message !== "หมดเวลาใช้สกิล")
    .map((action) => action.message);
}

export function SkillResultOverlay({ message, language, players = [] }: { message: string; language: Language; players?: PublicGameState["players"] }) {
  const fromAccomplice = message.startsWith("ข้อมูลจากผู้สมรู้ร่วมคิด: ");
  const title = fromAccomplice ? language === "en" ? "Accomplice report" : "ข้อมูลจากผู้สมรู้ร่วมคิด" : language === "en" ? "Skill result" : "ผลลัพธ์สกิล";
  const result = fromAccomplice ? message.slice("ข้อมูลจากผู้สมรู้ร่วมคิด: ".length) : message;
  return <Dialog open keepMounted disablePortal fullWidth maxWidth="sm" aria-labelledby="skill-result-title" slotProps={{ paper: { className: "border! border-[#e3c88e]/70! bg-[radial-gradient(circle_at_top,#4a3046,#1d1824_75%)]! text-[#f4efe8]!" } }}>
    <DialogTitle id="skill-result-title" className="pt-7! text-center! text-sm! font-semibold! tracking-[.2em]! text-[#e3c88e]!">{title}</DialogTitle>
    <DialogContent className="px-7! pb-10! text-center! font-serif! text-2xl! leading-relaxed! sm:text-3xl!">{result.startsWith("ภาพถ่ายเทิร์นที่ 3:") ? <PhotographerResult message={result} players={players} language={language} /> : gameMessage(result, language)}</DialogContent>
  </Dialog>;
}

function VoteResultDialog({ message, language }: { message: string; language: Language }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { const timeout = window.setTimeout(() => setOpen(false), 2000); return () => window.clearTimeout(timeout); }, []);
  return <Dialog open={open} disablePortal fullWidth maxWidth="sm" aria-labelledby="vote-result-title" slotProps={{ paper: { className: "border! border-[#e3c88e]/70! bg-[radial-gradient(circle_at_top,#4a3046,#1d1824_75%)]! text-[#f4efe8]!" } }}>
    <DialogTitle id="vote-result-title" className="pt-7! text-center! font-serif! text-3xl! text-[#f2d79c]!">{language === "en" ? "Ballot result · The chosen door" : "ผลโหวต · ประตูห้องที่ถูกเลือก"}</DialogTitle>
    <DialogContent className="px-7! pb-10! text-center! font-serif! text-2xl! leading-relaxed!">{gameMessage(message, language)}</DialogContent>
  </Dialog>;
}

function SkillTurnDialog({ open, language, onContinue, onExited }: { open: boolean; language: Language; onContinue: () => void; onExited: () => void }) {
  const en = language === "en";
  const continueRef = useRef(onContinue);
  useEffect(() => { continueRef.current = onContinue; }, [onContinue]);
  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => continueRef.current(), 2000);
    return () => window.clearTimeout(timeout);
  }, [open]);
  return <Dialog open={open} onClose={onContinue} disablePortal fullWidth maxWidth="xs" aria-labelledby="skill-turn-title" slotProps={{ paper: { className: "border! border-[#e3c88e]/70! bg-[radial-gradient(circle_at_top,#4a3046,#1d1824_75%)]! text-[#f4efe8]!" }, transition: { onExited } }}>
    <DialogTitle id="skill-turn-title" className="pt-8! text-center! font-serif! text-3xl! text-[#f2d79c]!">{en ? "It's your turn to use a skill" : "ถึงตาคุณใช้สกิล"}</DialogTitle>
    <DialogContent className="text-center! leading-7!">{en ? "Choose your target and confirm before your time runs out." : "เลือกเป้าหมายและยืนยันการใช้สกิลก่อนหมดเวลา"}</DialogContent>
    <DialogActions className="justify-center! px-6! pb-8!"><Button variant="contained" onClick={onContinue}>{en ? "Use skill" : "เริ่มใช้สกิล"}</Button></DialogActions>
  </Dialog>;
}

export function GameResultScreen({ result }: { result: GameResultState }) {
  const language = useLanguage();
  const en = language === "en";
  const livingMurderers = result.players.filter((player) => player.isAlive && player.team === "MURDERER").length;
  const livingInnocents = result.players.filter((player) => player.isAlive && player.team === "INNOCENT").length;
  const reasonKey = result.reason ?? (result.winner === "INNOCENT" ? "ASSASSIN_ELIMINATED" : livingMurderers >= livingInnocents ? "MURDERER_PARITY" : "ASSASSIN_SURVIVED");
  const reason = reasonKey === "MURDERER_PARITY" ? en ? "The living Murderer team reached at least the number of living Innocents." : "จำนวนฝ่ายฆาตกรที่ยังมีชีวิตเท่ากับหรือมากกว่าฝ่ายผู้บริสุทธิ์" : reasonKey === "ASSASSIN_SURVIVED" ? en ? "The Assassin survived all four turns." : "นักฆ่ารอดชีวิตครบ 4 รอบ" : en ? "The Assassin was eliminated." : "นักฆ่าถูกกำจัด";
  return <section className="rounded-2xl border border-[#c8a46b]/40 bg-[radial-gradient(circle_at_top,#4a1928,#111116_70%)] p-6 shadow-2xl sm:p-10">
    <p className="text-center text-sm tracking-[.3em] text-[#c8a46b]">{en ? "Result" : "ผลเกม"} · {result.turnsPlayed} {en ? "turns" : "รอบ"}</p>
    <h2 className="mt-4 text-center font-serif text-3xl leading-relaxed sm:text-5xl">{result.winner === "INNOCENT" ? en ? "The Innocent team wins! The Assassin was exposed." : "ผู้บริสุทธิ์ชนะ! นักฆ่าถูกเปิดโปงแล้ว" : en ? "The Murderer team wins! The hotel's secrets remain buried." : "ฆาตกรชนะ! ความลับถูกฝังไว้ในโรงแรมแห่งนี้"}</h2>
    <p className="mt-4 text-center text-lg text-[#e3c88e]">{en ? "Why: " : "เหตุผล: "}{reason}</p>
    <div className="mt-9 grid gap-3 sm:grid-cols-2">{result.players.map((player) => { const avatar = avatarById(player.avatarId); return <div key={player.playerId} className="relative flex overflow-hidden rounded-lg border border-[#c8a46b]/20 bg-[#1d1d26]/90">{avatar ? <div className="relative w-20 shrink-0"><Image src={avatar.portrait} alt={en ? avatarEnglish[avatar.id].name : avatar.name} fill sizes="80px" className="object-cover object-top" /></div> : <RolePortrait role={player.role} className="w-20" sizes="80px" />}<div className="min-w-0 p-4 pr-6"><p className="font-semibold"><span className="inline-block max-w-[150px] truncate align-bottom" title={player.displayName}>{player.displayName}</span> · {player.roomNumber}</p><p className="mt-1 text-sm text-[#c8a46b]">{en ? roleNamesEn[player.role] : roleNames[player.role]} · {player.team === "INNOCENT" ? en ? "Innocent" : "ผู้บริสุทธิ์" : en ? "Murderer" : "ฆาตกร"} · {player.isAlive ? en ? "Alive" : "รอดชีวิต" : en ? "Dead" : "เสียชีวิต"}</p></div><span aria-hidden="true" className={`absolute inset-y-0 right-0 w-1.5 ${player.team === "INNOCENT" ? "bg-blue-500" : "bg-red-500"}`} /></div>; })}</div>
    <div className="mt-8 flex h-[300px] flex-col rounded-lg border border-[#c8a46b]/20 bg-[#1d1d26]/90 p-5">
      <h3 id="final-event-history-title" className="shrink-0 font-serif text-xl">{en ? "Key events" : "เหตุการณ์สำคัญ"}</h3>
      <ul aria-labelledby="final-event-history-title" tabIndex={0} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto wrap-break-word pr-2 text-sm text-[#c6bdb1]">{result.events.map((event, index) => <li key={`${event.type}-${index}`}>{gameMessage(event.message, language)}</li>)}</ul>
    </div>
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

export function selectLawyerTargets(current: string[], targetId: string): string[] {
  return current.includes(targetId) ? current.filter((id) => id !== targetId) : [...current.slice(-1), targetId];
}

export function scrollToSkillTarget(role: Role, guests: HTMLElement | null, board: HTMLElement | null, isMobile: boolean): void {
  if (!isMobile) return;
  const target = role === "ACCOMPLICE" || role === "LAWYER" ? guests : usesRoomTarget(role) || usesFloorTarget(role) || usesColumnTarget(role) ? board : null;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const skillActionInstructions: Record<Role, string> = {
  ELECTRICIAN: "แตะชั้นหรือห้องบนชั้นที่ต้องการดับไฟ แล้วกดยืนยันสกิลด้านล่าง",
  LOCKSMITH: "แตะห้องที่ยังไม่เคยล็อกบนแผนผัง แล้วกดยืนยันสกิลด้านล่าง",
  HOUSEKEEPER: "แตะชั้นหรือห้องบนชั้นที่ต้องการตรวจจำนวนผู้พัก แล้วกดยืนยันสกิลด้านล่าง",
  WINDOW_CLEANER: "แตะแนวห้อง 01, 02 หรือ 03 บนแผนผัง แล้วกดยืนยันสกิลด้านล่าง",
  WITNESS: "แตะชั้นหรือห้องบนชั้นที่ต้องการตรวจเป้าหมายของนักฆ่าในรอบนี้ แล้วกดยืนยันสกิลด้านล่าง",
  DETECTIVE: "แตะห้องบนแผนผังที่ต้องการตรวจ แล้วกดยืนยันสกิลด้านล่าง",
  LAWYER: "แตะการ์ดผู้เข้าพักคนอื่นที่ยังมีชีวิตสองคน แล้วกดยืนยันสกิลด้านล่าง",
  FORMER_POLICE: "เมื่อถึงคิวในแต่ละเทิร์น ระบบจะให้คำใบ้เกี่ยวกับตัวละครของนักฆ่าอัตโนมัติ ตรวจผลในข้อมูลลับ",
  RECEPTIONIST: "เทิร์นที่ 3 ระบบจะเปิดทะเบียนห้องพักให้คุณอัตโนมัติ ตรวจผลในข้อมูลลับ",
  PHOTOGRAPHER: "เทิร์นที่ 3 ระบบจะให้คุณตรวจภาพถ่ายและบอกว่าใครคือนักฆ่าแบบส่วนตัว ตรวจผลในข้อมูลลับ",
  ACCOMPLICE: "แตะการ์ดผู้เข้าพักที่ยังมีชีวิตหนึ่งคน แล้วกดยืนยันสกิลด้านล่าง",
  KILLER: "แตะห้องบนแผนผังที่ต้องการลอบสังหาร แล้วกดยืนยันสกิลด้านล่าง",
};

const skillActionInstructionsEn: Record<Role, string> = {
  ELECTRICIAN: "Select a floor or room on that floor to black out, then confirm below.",
  LOCKSMITH: "Select a room you have not protected before on the hotel map, then confirm below.",
  HOUSEKEEPER: "Select a floor or a room on that floor to count its guests, then confirm below.",
  WINDOW_CLEANER: "Select column 01, 02, or 03 on the hotel map, then confirm below.",
  WITNESS: "Select a floor or a room on it to check the Assassin's target this turn, then confirm below.",
  DETECTIVE: "Select a room on the hotel map to inspect, then confirm below.",
  LAWYER: "Select two other living guest cards, then confirm below.",
  FORMER_POLICE: "On your slot each turn, receive an automatic clue about the Assassin's public character. Read it in your private information.",
  RECEPTIONIST: "In turn 3, your private room register opens automatically. Read it in your private information.",
  PHOTOGRAPHER: "In turn 3, your photograph privately reveals the Assassin. Read it in your private information.",
  ACCOMPLICE: "Select a living guest card, then confirm below.",
  KILLER: "Select a room on the hotel map to assassinate its occupant, then confirm below.",
};

export function HotelBoard({ state, selfId, ownRoomNumber, onVote, onSkillRoomSelect, onSkillFloorSelect, onSkillColumnSelect, unavailableSkillRooms = [], selectedSkillRoom = null, selectedSkillRooms = [], selectedSkillFloor = null, selectedSkillColumn = null, voteBusy = false }: { state: PublicGameState; selfId?: string; ownRoomNumber?: number; onVote?: (roomNumber: number) => void; onSkillRoomSelect?: (roomNumber: number) => void; onSkillFloorSelect?: (floor: number) => void; onSkillColumnSelect?: (column: number) => void; unavailableSkillRooms?: number[]; selectedSkillRoom?: number | null; selectedSkillRooms?: number[]; selectedSkillFloor?: number | null; selectedSkillColumn?: number | null; voteBusy?: boolean }) {
  const en = useLanguage() === "en";
  const rooms = new Map(state.publicRooms.map((room) => [room.roomNumber, room]));
  const floorCount = Math.max(0, ...state.publicRooms.map((room) => Math.floor(room.roomNumber / 100)));
  return <Paper component="section" className="border! border-[#353440]! bg-[#191a22]! p-3! sm:p-6!">
    <div className="flex items-end justify-between gap-3 border-b border-[#353440] pb-4">
      <div><p className="text-xs uppercase tracking-[.18em] text-[#b6a783]">{en ? "HOTEL MAP" : "แผนผัง"}</p><h2 className="mt-1 font-serif text-2xl">{en ? "Hotel" : "โรงแรม"}</h2></div>
      <p className="text-xs text-[#a7a8b4]">{onSkillRoomSelect ? en ? "Select a room for your skill" : "แตะห้องเพื่อเลือกเป้าหมายสกิล" : onSkillFloorSelect ? en ? "Select a floor or a room on it" : "แตะชั้นหรือห้องในชั้นนั้น" : onSkillColumnSelect ? en ? "Select a column or a room in it" : "แตะแนวหรือห้องในแนวนั้น" : onVote ? en ? "Select a room to vote" : "แตะห้องเพื่อลงคะแนน" : en ? `${floorCount} floors · ${state.publicRooms.length} rooms` : `${floorCount} ชั้น · ${state.publicRooms.length} ห้อง`}</p>
    </div>
    <div className="mt-4 space-y-1.5 sm:space-y-2"><div className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] gap-1 text-center text-[10px] sm:grid-cols-[2rem_repeat(3,minmax(0,1fr))] sm:gap-2 sm:text-xs text-[#a7a8b4]"><span className="self-center">{en ? "Floor" : "ชั้น"}</span>{[1, 2, 3].map((column) => onSkillColumnSelect && state.publicRooms.some((room) => room.state === "UNKNOWN" && room.roomNumber % 100 === column) ? <button key={column} type="button" aria-label={en ? `Select column 0${column} as skill target` : `เลือกแนวห้อง 0${column} เป็นเป้าหมายสกิล`} aria-pressed={selectedSkillColumn === column} disabled={voteBusy} onClick={() => onSkillColumnSelect(column)} className={`rounded-md border px-1 py-2 focus-visible:outline-2 focus-visible:outline-[#e3c88e] ${selectedSkillColumn === column ? "border-[#f2d79c] bg-[#4a3942] text-[#f2d79c]" : "border-[#3d3d49] hover:border-[#e3c88e]"}`}>{en ? "Col" : "แนว"} 0{column}</button> : <span key={column} className="self-center">{en ? "Col" : "แนว"} 0{column}</span>)}</div>{Array.from({ length: floorCount }, (_, index) => floorCount - index).map((floor) =>
      <div key={floor} className="grid grid-cols-[1.5rem_repeat(3,minmax(0,1fr))] items-stretch gap-1 sm:grid-cols-[2rem_repeat(3,minmax(0,1fr))] sm:gap-2">
        {onSkillFloorSelect && state.publicRooms.some((room) => room.state === "UNKNOWN" && Math.floor(room.roomNumber / 100) === floor) ? <button type="button" aria-label={en ? `Select floor ${floor} as skill target` : `เลือกชั้น ${floor} เป็นเป้าหมายสกิล`} aria-pressed={selectedSkillFloor === floor} disabled={voteBusy} onClick={() => onSkillFloorSelect(floor)} className={`rounded-md border text-center text-sm focus-visible:outline-2 focus-visible:outline-[#e3c88e] ${selectedSkillFloor === floor ? "border-[#f2d79c] bg-[#4a3942] text-[#f2d79c]" : "border-[#3d3d49] text-[#a7a8b4] hover:border-[#e3c88e]"}`}>{floor}</button> : <span className="self-center text-center text-sm text-[#a7a8b4]">{floor}</span>}
        {[1, 2, 3].map((column) => {
          const room = rooms.get(floor * 100 + column);
          if (!room) return null;
          const label = en ? room.state === "CRIME_SCENE" ? "Mysterious clue" : room.state === "MURDERED" ? "Murdered" : room.state === "OPENED_MURDERED" ? "Murdered · opened" : room.state === "OPENED_EMPTY" ? "Opened · empty" : room.state === "OPENED_OCCUPIED" ? "Opened · occupied" : "Unopened" : room.state === "CRIME_SCENE" ? "ร่องรอยปริศนา" : room.state === "MURDERED" ? "ถูกฆาตกรรม" : room.state === "OPENED_MURDERED" ? "ถูกฆาตกรรม · เปิดแล้ว" : room.state === "OPENED_EMPTY" ? "เปิดแล้ว · ว่าง" : room.state === "OPENED_OCCUPIED" ? "เปิดแล้ว · มีผู้พัก" : "ยังไม่เปิด";
          const marked = room.state === "CRIME_SCENE" || room.state === "MURDERED" || room.state === "OPENED_MURDERED";
          const opened = room.state.startsWith("OPENED_");
          const eligible = room.state === "UNKNOWN";
          const usedByLocksmith = unavailableSkillRooms.includes(room.roomNumber);
          const canVote = eligible && !!onVote && room.roomNumber !== ownRoomNumber && (!state.runoffRooms?.length || state.runoffRooms.includes(room.roomNumber));
          const canSelectSkill = eligible && !!onSkillRoomSelect && !usedByLocksmith;
          const canSelect = eligible && (canVote || canSelectSkill || !!onSkillFloorSelect || !!onSkillColumnSelect);
          const selected = canSelect && (canSelectSkill && (selectedSkillRoom === room.roomNumber || selectedSkillRooms.includes(room.roomNumber)) || !!onSkillFloorSelect && selectedSkillFloor === floor || !!onSkillColumnSelect && selectedSkillColumn === column);
          const roomVotes = state.phase === "VOTING" ? (state.votes ?? []).filter((vote) => vote.roomNumber === room.roomNumber) : [];
          const ownVote = roomVotes.some((vote) => vote.playerId === selfId);
          const className = `flex min-h-16 flex-col justify-center rounded-md border px-2 py-2 text-center sm:min-h-18 ${marked ? "border-[#9b555d] bg-[#302127]" : opened ? "border-[#5f594f] bg-[#25252b]" : "border-[#3d3d49] bg-[#22232c]"} ${canSelect ? "cursor-pointer ring-1 ring-[#c8a46b]/50 transition-colors hover:border-[#e3c88e] hover:bg-[#38313b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c88e] disabled:cursor-wait" : ""} ${selected || ownVote ? "border-[#f2d79c] ring-2 ring-[#f2d79c] bg-[#4a3942]" : ""} ${opened ? "opacity-[0.35]" : ""}`;
          const content = <>
            <span className="font-mono text-sm font-semibold text-[#f4efe8] sm:text-base">{room.roomNumber}</span>
            <span className={`mt-1 text-[10px] leading-tight sm:text-xs ${marked ? "text-[#efb3b7]" : "text-[#b0b0bc]"}`}>{label}</span>
            {usedByLocksmith && <span className="mt-1 text-[10px] font-semibold text-[#e3c88e] sm:text-xs">{en ? "Previously protected" : "เคยล็อกแล้ว"}</span>}
            {roomVotes.length > 0 && <span className="mt-2 rounded-md bg-[#e3c88e] px-2 py-1 text-xs font-bold text-[#211923]">{en ? `${roomVotes.length} votes` : `${roomVotes.length} โหวต`}</span>}
          </>;
          return canSelect ? <button key={room.roomNumber} type="button" aria-label={en ? canSelectSkill ? `Select room ${room.roomNumber} as skill target: ${label}` : onSkillFloorSelect ? `Select floor ${floor} through room ${room.roomNumber}` : onSkillColumnSelect ? `Select column 0${column} through room ${room.roomNumber}` : `Vote for room ${room.roomNumber}: ${label}` : canSelectSkill ? `เลือกห้อง ${room.roomNumber} เป็นเป้าหมายสกิล ${label}` : onSkillFloorSelect ? `เลือกชั้น ${floor} ผ่านห้อง ${room.roomNumber}` : onSkillColumnSelect ? `เลือกแนวห้อง 0${column} ผ่านห้อง ${room.roomNumber}` : `โหวตห้อง ${room.roomNumber} ${label}`} aria-pressed={canVote ? ownVote : canSelectSkill || onSkillFloorSelect || onSkillColumnSelect ? selected : undefined} className={className} disabled={voteBusy} onClick={() => canSelectSkill ? onSkillRoomSelect(room.roomNumber) : onSkillFloorSelect ? onSkillFloorSelect(floor) : onSkillColumnSelect ? onSkillColumnSelect(column) : onVote?.(room.roomNumber)}>{content}</button>
            : <div key={room.roomNumber} aria-label={en ? `Room ${room.roomNumber}: ${label}` : `ห้อง ${room.roomNumber} ${label}`} className={className}>{content}</div>;
        })}
      </div>)}</div>
  </Paper>;
}

export function RoleRevealCard({ privateState }: { privateState: PrivatePlayerState }) {
  const en = useLanguage() === "en";
  return <div className="mt-4 rounded-xl border border-[#c8a46b]/40 bg-[#29202b] p-4 text-left"><p className="text-xs tracking-[.2em] text-[#c8a46b]">{en ? "Your role · private" : "บทบาทของคุณ · เฉพาะคุณ"}</p><p className="mt-2 font-serif text-2xl">{en ? roleNamesEn[privateState.role] : roleNames[privateState.role]} · {en ? "Room" : "ห้อง"} {privateState.roomNumber}</p><p className="mt-2 text-sm text-[#d8d2d8]">{privateState.team === "INNOCENT" ? en ? "Innocent team" : "ฝ่ายผู้บริสุทธิ์" : en ? "Murderer team" : "ฝ่ายฆาตกร"}</p><p className="mt-3 border-t border-[#c8a46b]/20 pt-3 text-sm leading-6 text-[#d8d2d8]">{en ? roleSkillDescriptionsEn[privateState.role] : roleSkillDescriptions[privateState.role]}</p></div>;
}

export function StoryPrologue({ deadline, connected, connectionMessage, privateState, avatarId, muted, onMuteChange }: { deadline?: number; connected: boolean; connectionMessage: string; privateState: PrivatePlayerState | null; avatarId?: AvatarId | null; muted?: boolean; onMuteChange?: (muted: boolean) => void }) {
  const en = useLanguage() === "en";
  const [showRole, setShowRole] = useState(false);
  const avatar = avatarById(avatarId);
  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_20%,#452433,#100f17_68%)] px-5 py-10 text-[#f4efe8]">
    {deadline !== undefined && <GameTimerBanner deadline={deadline} label={en ? "First clue in" : "เบาะแสแรกใน"} />}
    <div className="fixed right-4 top-20 z-30 flex gap-2 sm:top-4"><LanguageSwitcher />{onMuteChange && <SoundSettings muted={!!muted} onChange={onMuteChange} />}</div>
    <section className="w-full max-w-2xl rounded-3xl border border-[#c8a46b]/35 bg-[#17141d]/90 px-7 py-10 text-center shadow-2xl sm:px-14 sm:py-14" aria-labelledby="prologue-title">
      <p className="text-xs tracking-[.35em] text-[#c8a46b]">HOTEL MURDER ONLINE</p>
      <p className="mt-8 text-sm tracking-[.22em] text-[#d8bc86]">{en ? "BEFORE THE STORY BEGINS" : "ก่อนเรื่องราวจะเริ่ม"}</p>
      <h1 id="prologue-title" className="mt-3 font-serif text-3xl leading-relaxed sm:text-5xl">{en ? "The Night the Hotel Never Slept" : "คืนที่โรงแรมไม่หลับใหล"}</h1>
      <div className="mx-auto mt-7 h-px w-24 bg-[#c8a46b]/60" />
      <div className="mt-7 space-y-5 text-base leading-8 text-[#d8d2d8] sm:text-lg sm:leading-9">
        <p>{en ? "A violent storm has cut off every road. All the guests must spend the night in this old hotel." : "พายุโหมกระหน่ำจนถนนทุกสายถูกตัดขาด แขกทุกคนต้องค้างคืนในโรงแรมเก่าแห่งนี้"}</p>
        <p>{en ? "At midnight, every light goes out. Mysterious footsteps echo through an empty corridor." : "เมื่อเข็มนาฬิกาชี้เที่ยงคืน ไฟทั้งอาคารดับวูบ เสียงฝีเท้าปริศนาดังผ่านทางเดินที่ไร้ผู้คน"}</p>
        <p>{en ? "When the lights return, strange traces appear in three empty rooms. No one died there. Some came seeking truth; others came to hide it." : "พอแสงไฟกลับมา พบร่องรอยปริศนาในห้องว่างสามห้อง ไม่มีใครเสียชีวิตที่นั่น บางคนมาเพื่อหาความจริง… บางคนมาเพื่อซ่อนมัน"}</p>
      </div>
      {avatar && <div className="mx-auto mt-7 flex max-w-xs items-center gap-3 rounded-xl border border-[#c8a46b]/30 bg-[#29202b] p-2 text-left"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"><Image src={avatar.portrait} alt={en ? avatarEnglish[avatar.id].name : avatar.name} fill sizes="56px" className="object-cover object-top" /></div><div><p className="text-xs text-[#c8a46b]">{en ? "Your character" : "อวาตาร์ของคุณ"}</p><p>{en ? avatarEnglish[avatar.id].name : avatar.name}</p></div></div>}
      {privateState && <div className="mt-7"><Button variant="outlined" aria-expanded={showRole} onClick={() => setShowRole((open) => !open)}>{showRole ? en ? "Hide my role" : "ปิดบทบาทของฉัน" : en ? "Reveal my role" : "เปิดดูบทบาทของฉัน"}</Button>{showRole && <RoleRevealCard privateState={privateState} />}</div>}
      {(!connected || deadline === undefined) && <p className="mt-9 text-sm text-[#c8a46b]" role="status">{!connected ? connectionMessage || (en ? "Reconnecting…" : "กำลังเชื่อมต่อใหม่…") : en ? "Preparing the first clue…" : "กำลังเตรียมเปิดเผยเบาะแส…"}</p>}
    </section>
  </main>;
}

export function SkillPanel({ privateState, state, selectedRoom = null, selectedRooms = [], doubleKillActive = false, selectedFloor = null, selectedColumn = null, selectedPlayerId = null, selectedPlayerIds = [] }: { privateState: PrivatePlayerState; state: PublicGameState; selectedRoom?: number | null; selectedRooms?: number[]; doubleKillActive?: boolean; selectedFloor?: number | null; selectedColumn?: number | null; selectedPlayerId?: string | null; selectedPlayerIds?: string[] }) {
  const en = useLanguage() === "en";
  const role = privateState.role;
  const room = usesRoomTarget(role);
  const floor = usesFloorTarget(role);
  const column = usesColumnTarget(role);
  const selectedPlayer = state.players.find((player) => player.id === selectedPlayerId && player.id !== privateState.playerId);
  const lawyerPrompt = en ? `Selected guests (${selectedPlayerIds.length}/2): ${selectedPlayerIds.map((id) => state.players.find((player) => player.id === id)?.displayName).filter(Boolean).join(", ") || "none"}` : `เลือกผู้เข้าพักแล้ว (${selectedPlayerIds.length}/2): ${selectedPlayerIds.map((id) => state.players.find((player) => player.id === id)?.displayName).filter(Boolean).join(", ") || "ยังไม่ได้เลือก"}`;
  const prompt = en ? room ? selectedRoom === null ? "Select a room on the hotel map" : `Target: room ${selectedRoom}` : floor ? selectedFloor === null ? "Select a floor on the hotel map" : `Target: floor ${selectedFloor}` : column ? selectedColumn === null ? "Select a column on the hotel map" : `Target: column 0${selectedColumn}` : selectedPlayer ? `Target: ${selectedPlayer.displayName}` : "Select a guest from the list" : room ? selectedRoom === null ? "แตะห้องบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: ห้อง ${selectedRoom}` : floor ? selectedFloor === null ? "แตะเลขชั้นบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: ชั้น ${selectedFloor}` : column ? selectedColumn === null ? "แตะหัวแนวห้องบนแผนผังโรงแรมเพื่อเลือกเป้าหมาย" : `เป้าหมาย: แนวห้อง 0${selectedColumn}` : selectedPlayer ? `เป้าหมาย: ${selectedPlayer.displayName}` : "แตะผู้เข้าพักในรายชื่อเพื่อเลือกเป้าหมาย";
  const doublePrompt = doubleKillActive ? en ? `Select two distinct rooms on the map (${selectedRooms.length}/2): ${selectedRooms.join(", ")}` : `แตะเลือกห้องต่างกันสองห้องบนแผนผัง (${selectedRooms.length}/2): ${selectedRooms.join(", ")}` : null;
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">{en ? "Use skill" : "ใช้สกิล"} · {en ? roleNamesEn[role] : roleNames[role]}</h2><p className="mt-3 text-sm leading-6 text-[#d8d2d8]">{en ? roleSkillDescriptionsEn[role] : roleSkillDescriptions[role]}</p><p className="mt-4 rounded-lg border border-[#c8a46b]/35 bg-[#362939] p-3 text-sm font-semibold text-[#f2d79c]">{role === "LAWYER" ? lawyerPrompt : doublePrompt ?? prompt}</p></Paper>;
}

export function SkillConfirmBar({ targetLabel, canSubmit, onConfirm }: { targetLabel: string; canSubmit: boolean; onConfirm: () => void }) {
  const en = useLanguage() === "en";
  return <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4" role="group" aria-label={en ? "Confirm skill" : "ยืนยันการใช้สกิล"}>
    <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[#e3c88e]/60 bg-[#211923]/95 p-3 shadow-[0_12px_50px_rgba(0,0,0,.7)] backdrop-blur-md">
      <p className="min-w-0 flex-1 truncate text-sm text-[#f2d79c]">{targetLabel}</p>
      <Button variant="contained" disabled={!canSubmit} onClick={onConfirm}>{en ? "Confirm skill" : "ยืนยันสกิล"}</Button>
    </div>
  </div>;
}

export function GameScreen({ state, privateState, teamState, result, murderSequence, connected, connectionMessage, onlinePlayerIds = [], onCommand }: { state: PublicGameState; privateState: PrivatePlayerState | null; teamState: PrivateTeamState | null; result: GameResultState | null; murderSequence: number; connected: boolean; connectionMessage: string; onlinePlayerIds?: string[]; onCommand: (event: "game:skill" | "game:vote" | "game:chat", payload: Record<string, unknown>, version: number) => Promise<LobbyAck<{ version: number }>> }) {
  const language = useLanguage();
  const en = language === "en";
  const [muted, setMuted] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const previousSoundSnapshot = useRef<GameSoundSnapshot | null>(null);
  const previousPrivateState = useRef<PrivatePlayerState | null>(privateState);
  const nextSkillResultId = useRef(0);
  const [skillResultQueue, setSkillResultQueue] = useState<Array<{ id: number; message: string }>>([]);
  const skillResult = skillResultQueue[0] ?? null;
  const [readyResult, setReadyResult] = useState<GameResultState | null>(result);
  const visibleResult = !skillResult && readyResult === result ? readyResult : null;
  useEffect(() => {
    if (!result || skillResult) return;
    const timeout = window.setTimeout(() => setReadyResult(result), 100);
    return () => window.clearTimeout(timeout);
  }, [result, skillResult]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSoundReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);
  const openedRoomCount = state.publicHistory?.filter((event) => event.type === "ROOM_OPENED").length ?? 0;
  const latestOpenedRoom = [...(state.publicHistory ?? [])].reverse().find((event) => event.type === "ROOM_OPENED")?.message;
  const endedWithOpenedRoom = state.phase === "FINISHED" && state.publicHistory?.at(-2)?.type === "ROOM_OPENED" && state.publicHistory.at(-1)?.type === "GAME_FINISHED";
  useEffect(() => {
    if (!soundReady) return;
    const soundSnapshot: GameSoundSnapshot = {
      code: state.code, phase: state.phase, turn: state.turn,
      canUseSkill: !!privateState?.canUseSkill, playerId: privateState?.playerId,
      phaseDeadlineAt: state.phaseDeadlineAt, resultReady: !!visibleResult, openedRoomCount,
    };
    const event = getGameSoundEvent(previousSoundSnapshot.current, soundSnapshot);
    previousSoundSnapshot.current = soundSnapshot;
    if (!event) return;
    const storageKey = `hotel-game-sound:${event.key}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch { /* Sound still works when storage is unavailable. */ }
    if (!muted) playGameSound(event.cue);
  }, [soundReady, state.code, state.phase, state.turn, state.phaseDeadlineAt, privateState?.canUseSkill, privateState?.playerId, visibleResult, openedRoomCount, muted]);
  const [deathDismissed, setDeathDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [dismissedSkillTurnKey, setDismissedSkillTurnKey] = useState<string | null>(null);
  const guestsRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pendingSkillScrollRole = useRef<Role | null>(null);
  const skillTurnKey = state.phase === "SKILL_PHASE" && privateState?.canUseSkill && connected ? `${state.code}:${state.turn}:${privateState.playerId}` : null;
  const activeSkillResultId = skillResult?.id;
  useEffect(() => {
    const freshResults = getFreshSkillResults(previousPrivateState.current, privateState);
    previousPrivateState.current = privateState;
    if (freshResults.length) setSkillResultQueue((queue) => [...queue, ...freshResults.map((message) => ({ id: ++nextSkillResultId.current, message }))]);
  }, [privateState]);
  useEffect(() => {
    if (activeSkillResultId === undefined) return;
    const timeout = window.setTimeout(() => setSkillResultQueue((queue) => queue.slice(1)), 2000);
    return () => window.clearTimeout(timeout);
  }, [activeSkillResultId]);
  const [skillBoardSelection, setSkillBoardSelection] = useState<{ turn: number; playerId: string; kind: "room" | "floor" | "column"; target: number } | null>(null);
  const [doubleKillSelection, setDoubleKillSelection] = useState<{ turn: number; playerId: string; rooms: number[] } | null>(null);
  const [skillPlayerSelection, setSkillPlayerSelection] = useState<{ turn: number; playerId: string; targetId: string } | null>(null);
  const [lawyerSelection, setLawyerSelection] = useState<{ turn: number; playerId: string; targetIds: string[] } | null>(null);
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
  const doubleKillActive = roomSkillActive && privateState?.role === "KILLER" && state.players.length === 5 && teamState?.teammates.length === 1 && state.turn === 2;
  const doubleKillRooms = doubleKillSelection?.turn === state.turn && doubleKillSelection.playerId === privateState?.playerId ? doubleKillSelection.rooms.filter((roomNumber) => state.publicRooms.some((room) => room.roomNumber === roomNumber && room.state === "UNKNOWN")) : [];
  const floorSkillActive = !!privateState?.canUseSkill && usesFloorTarget(privateState.role);
  const columnSkillActive = !!privateState?.canUseSkill && usesColumnTarget(privateState.role);
  const selectedBoardTarget = skillBoardSelection?.turn === state.turn && skillBoardSelection.playerId === privateState?.playerId
    && !(privateState?.role === "LOCKSMITH" && skillBoardSelection.kind === "room" && privateState.locksmithUsedRooms?.includes(skillBoardSelection.target))
    && state.publicRooms.some((room) => room.state === "UNKNOWN" && (skillBoardSelection.kind === "room" ? room.roomNumber === skillBoardSelection.target : skillBoardSelection.kind === "floor" ? Math.floor(room.roomNumber / 100) === skillBoardSelection.target : room.roomNumber % 100 === skillBoardSelection.target))
    ? skillBoardSelection : null;
  const selectedSkillRoom = selectedBoardTarget?.kind === "room" ? selectedBoardTarget.target : null;
  const selectedSkillFloor = selectedBoardTarget?.kind === "floor" ? selectedBoardTarget.target : null;
  const selectedSkillColumn = selectedBoardTarget?.kind === "column" ? selectedBoardTarget.target : null;
  const selectedSkillPlayer = skillPlayerSelection?.turn === state.turn && skillPlayerSelection.playerId === privateState?.playerId && state.players.some((player) => player.id === skillPlayerSelection.targetId && player.isAlive !== false) ? skillPlayerSelection.targetId : null;
  const selectedLawyerTargets = lawyerSelection?.turn === state.turn && lawyerSelection.playerId === privateState?.playerId ? lawyerSelection.targetIds.filter((id) => id !== privateState?.playerId && state.players.some((player) => player.id === id && player.isAlive !== false)) : [];
  const skillTarget = privateState ? doubleKillActive ? doubleKillRooms.length === 2 ? doubleKillRooms : null : usesRoomTarget(privateState.role) ? selectedSkillRoom : usesFloorTarget(privateState.role) ? selectedSkillFloor : usesColumnTarget(privateState.role) ? selectedSkillColumn : privateState.role === "ACCOMPLICE" ? selectedSkillPlayer : privateState.role === "LAWYER" && selectedLawyerTargets.length === 2 ? selectedLawyerTargets : null : null;
  const selectedPlayerName = state.players.find((player) => player.id === selectedSkillPlayer)?.displayName;
  const skillTargetLabel = privateState?.role === "LAWYER" ? en ? `Guests (${selectedLawyerTargets.length}/2): ${selectedLawyerTargets.map((id) => state.players.find((player) => player.id === id)?.displayName).join(", ")}` : `ผู้เข้าพัก (${selectedLawyerTargets.length}/2): ${selectedLawyerTargets.map((id) => state.players.find((player) => player.id === id)?.displayName).join(", ")}` : doubleKillActive ? en ? `Select two rooms: ${doubleKillRooms.join(", ") || "none"} (${doubleKillRooms.length}/2)` : `เลือกสองห้อง: ${doubleKillRooms.join(", ") || "ยังไม่ได้เลือก"} (${doubleKillRooms.length}/2)` : en ? skillTarget === null ? "No target selected" : typeof skillTarget === "string" ? `Guest: ${selectedPlayerName ?? "not found"}` : usesRoomTarget(privateState!.role) ? `Room ${skillTarget}` : usesFloorTarget(privateState!.role) ? `Floor ${skillTarget}` : `Column 0${skillTarget}` : skillTarget === null ? "ยังไม่ได้เลือกเป้าหมาย" : typeof skillTarget === "string" ? `ผู้เข้าพัก: ${selectedPlayerName ?? "ไม่พบผู้เล่น"}` : usesRoomTarget(privateState!.role) ? `ห้อง ${skillTarget}` : usesFloorTarget(privateState!.role) ? `ชั้น ${skillTarget}` : `แนวห้อง 0${skillTarget}`;
  const skillExpired = skillDeadlineAt !== undefined && (skillSecondsLeft === null || skillSecondsLeft === 0);
  const canConfirmSkill = !!privateState?.canUseSkill && skillTarget !== null && !busy && connected && !skillExpired;
  const selectBoardTarget = (kind: "room" | "floor" | "column", target: number) => {
    if (!privateState) return;
    if (doubleKillActive && kind === "room") {
      setDoubleKillSelection((current) => {
        const rooms = current?.turn === state.turn && current.playerId === privateState.playerId ? current.rooms : [];
        return { turn: state.turn, playerId: privateState.playerId, rooms: rooms.includes(target) ? rooms.filter((room) => room !== target) : rooms.length < 2 ? [...rooms, target] : [...rooms.slice(0, 1), target] };
      });
    } else setSkillBoardSelection({ turn: state.turn, playerId: privateState.playerId, kind, target });
  };
  const turnNotice = getTurnNotice(state, privateState, language);
  const ownVotedRoom = state.phase === "VOTING" ? state.votes?.find((vote) => vote.playerId === privateState?.playerId)?.roomNumber : undefined;
  const changeMuted = (value: boolean) => setMuted(value);
  const act = async (event: "game:skill" | "game:vote", payload: Record<string, unknown>) => {
    setBusy(true); setError("");
    const response = await onCommand(event, payload, state.version);
    if (!response.ok) setError(lobbyErrorMessage(response.error, language));
    setBusy(false);
  };
  const sendChat = async (channel: "PUBLIC" | "MURDERER", text: string): Promise<boolean> => {
    if (!connected) return false;
    const response = await onCommand("game:chat", { channel, text }, state.version);
    return response.ok;
  };
  const publicChat = (state.phase === "DISCUSSION" || state.phase === "VOTING") && state.phaseDeadlineAt !== undefined
    ? { messages: state.chatMessages ?? [], canSend: !!privateState?.isAlive && connected, deadline: state.phaseDeadlineAt } : undefined;
  const teamChat = teamState?.canChat && teamState.chatDeadlineAt !== undefined
    ? { messages: teamState.chatMessages ?? [], canSend: connected, deadline: teamState.chatDeadlineAt } : undefined;
  if (state.phase === "ROLE_REVEAL") return <StoryPrologue deadline={state.phaseDeadlineAt} connected={connected} connectionMessage={connectionMessage} privateState={privateState} avatarId={state.players.find((player) => player.id === privateState?.playerId)?.avatarId} muted={muted} onMuteChange={changeMuted} />;
  const timerDeadline = state.phase === "SKILL_PHASE" ? skillDeadlineAt ?? teamState?.chatDeadlineAt : state.phaseDeadlineAt;
  let timerLabel = "";
  if (state.phase === "SKILL_PHASE") timerLabel = skillDeadlineAt !== undefined ? en ? "Skill time" : "เวลาใช้สกิล" : en ? "Murderer chat" : "เวลาแชทฝ่ายฆาตกร";
  else if (state.phase === "DISCUSSION") timerLabel = en ? "Discussion" : "เวลาพูดคุย";
  else if (state.phase === "VOTING") timerLabel = en ? "Voting" : "เวลาลงคะแนน";
  else if (state.phase === "RESOLUTION") timerLabel = state.turn >= 4 ? en ? "Final result in" : "สรุปผลเกมใน" : en ? "Next turn in" : "เริ่มรอบถัดไปใน";
  return <main className={`min-h-screen bg-[radial-gradient(circle_at_85%_0%,#3a2135,#111116_54%)] px-4 py-6 text-[#f4efe8] sm:px-8 ${privateState?.canUseSkill ? "pb-32" : ""}`}><div className="mx-auto max-w-6xl">
    {skillResult && <SkillResultOverlay message={skillResult.message} language={language} players={state.players} />}
    {(state.phase === "RESOLUTION" || endedWithOpenedRoom) && latestOpenedRoom && <VoteResultDialog key={`${state.turn}:${openedRoomCount}`} message={latestOpenedRoom} language={language} />}
    <SkillTurnDialog open={!!skillTurnKey && skillTurnKey !== dismissedSkillTurnKey && !skillResult} language={language} onContinue={() => {
      pendingSkillScrollRole.current = privateState && window.matchMedia("(max-width: 767px)").matches ? privateState.role : null;
      setDismissedSkillTurnKey(skillTurnKey);
    }} onExited={() => {
      const role = pendingSkillScrollRole.current;
      pendingSkillScrollRole.current = null;
      if (role) window.requestAnimationFrame(() => scrollToSkillTarget(role, guestsRef.current, boardRef.current, true));
    }} />
    {timerDeadline !== undefined && timerLabel && <GameTimerBanner deadline={timerDeadline} label={timerLabel} mobileInline />}
    {!connected && <p role="status" className="mb-5 rounded-lg border border-[#c8a46b]/40 bg-[#32272a] p-3 text-sm text-[#f4efe8]">{connectionMessage || (en ? "Reconnecting…" : "กำลังเชื่อมต่อใหม่…")}</p>}
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#c8a46b]/25 pb-5"><div><p className="text-xs tracking-[.24em] text-[#c8a46b]">{en ? "Who Killed Tonight?" : "คืนนี้ใครฆ่า..."} · {state.code}</p><h1 className="mt-2 font-serif text-3xl">{en ? "Turn" : "รอบ"} {state.turn} · {en ? state.phase === "SKILL_PHASE" ? "Skill phase" : state.phase === "DISCUSSION" ? "Discussion" : state.phase === "VOTING" ? "Voting" : state.phase === "RESOLUTION" ? "Room result" : "Game over" : state.phase === "SKILL_PHASE" ? "ช่วงใช้สกิล" : state.phase === "DISCUSSION" ? "ช่วงพูดคุย" : state.phase === "VOTING" ? "ช่วงลงคะแนน" : state.phase === "RESOLUTION" ? "ผลการเปิดห้อง" : "จบเกม"}</h1></div><div className="flex flex-wrap items-center gap-2"><LanguageSwitcher /><SoundSettings muted={muted} onChange={changeMuted} />{visibleResult && <Button component={Link} href="/" size="small" variant="contained" className="whitespace-nowrap!">{en ? "Back to home" : "กลับหน้าแรก"}</Button>}</div></header>
    <Alert severity={privateState?.canUseSkill || privateState?.canVote ? "warning" : "info"} role="status" className="mb-5!">{turnNotice}</Alert>
    {ownVotedRoom !== undefined && <div role="status" className="mb-5 rounded-xl border-2 border-[#e3c88e] bg-[#3b2c38] p-4 text-center text-lg font-bold text-[#f2d79c]">{en ? `Your suspicion falls on room ${ownVotedRoom}. Change your vote before the ballot closes.` : `คุณสงสัยห้อง ${ownVotedRoom} เปลี่ยนคะแนนได้ก่อนปิดหีบลงคะแนน`}</div>}
    {privateState?.canUseSkill && <div role="alert" aria-live="polite" className="mb-5 rounded-xl border-2 border-[#e3c88e] bg-[linear-gradient(125deg,#493447,#30202d)] p-5 shadow-[0_0_35px_rgba(227,200,142,.18)]"><p className="text-xs font-semibold tracking-[.2em] text-[#f2d79c]">{en ? "YOUR SKILL IS READY" : "ถึงตาคุณใช้สกิล"}</p><h2 className="mt-2 font-serif text-2xl">{en ? roleNamesEn[privateState.role] : roleNames[privateState.role]}</h2><p className="mt-2 text-sm leading-7 text-[#f4e5cc]">{doubleKillActive ? en ? "Select two distinct rooms on the hotel map. Both rooms can kill an occupant. Confirm after selecting both." : "เลือกสองห้องที่ต่างกันบนแผนผัง ทั้งสองห้องสังหารผู้พักได้ เลือกครบแล้วกดยืนยัน" : en ? skillActionInstructionsEn[privateState.role] : skillActionInstructions[privateState.role]}</p></div>}
    {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/40 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
    {showSecret && privateState && (privateState.role === "RECEPTIONIST" || privateState.role === "PHOTOGRAPHER") && state.turn === 3 && <div role="status" className="mb-5 rounded-xl border border-[#e3c88e]/60 bg-[#30202d] p-4 font-semibold text-[#f2d79c]">{en ? skillActionInstructionsEn[privateState.role] : skillActionInstructions[privateState.role]}</div>}
    {privateState?.privateResults.some((message) => message.startsWith("ทะเบียนห้องพักเทิร์นที่ 3:") || message.startsWith("ภาพถ่ายเทิร์นที่ 3:") || message.startsWith("เบาะแสอดีตตำรวจเทิร์นที่ ")) && !showSecret && <Alert severity="info" className="mb-5!">{en ? "A new private investigation result is available. Open your private information to view it." : "มีผลสืบสวนส่วนตัวใหม่ เปิดข้อมูลลับเพื่อดู"}</Alert>}
    {state.phase !== "SKILL_PHASE" && privateState?.skillBlockReason && <Alert severity="warning" className="mb-5!">{privateState.skillBlockReason === "BLACKOUT" ? en ? "Your floor is dark. You cannot use your skill this turn." : "ไฟดับบนชั้นของคุณ รอบนี้จึงใช้สกิลไม่ได้" : en ? "Your Electrician skill is cooling down this turn." : "สกิลช่างไฟกำลังพักหนึ่งรอบ รอบนี้ใช้สกิลไม่ได้"}</Alert>}
    {visibleResult ? <div className="space-y-5"><GameResultScreen result={visibleResult} />{privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}</div> : <div className="grid gap-5 lg:grid-cols-2">
      <div className="min-w-0 space-y-5">
        <div ref={boardRef} className="scroll-mt-4"><HotelBoard state={state} selfId={privateState?.playerId} ownRoomNumber={privateState?.roomNumber} unavailableSkillRooms={privateState?.role === "LOCKSMITH" ? privateState.locksmithUsedRooms : undefined} onVote={state.phase === "VOTING" && privateState?.canVote ? (roomNumber) => void act("game:vote", { roomNumber }) : undefined} onSkillRoomSelect={roomSkillActive ? (roomNumber) => selectBoardTarget("room", roomNumber) : undefined} onSkillFloorSelect={floorSkillActive ? (floor) => selectBoardTarget("floor", floor) : undefined} onSkillColumnSelect={columnSkillActive ? (column) => selectBoardTarget("column", column) : undefined} selectedSkillRoom={selectedSkillRoom} selectedSkillRooms={doubleKillRooms} selectedSkillFloor={selectedSkillFloor} selectedSkillColumn={selectedSkillColumn} voteBusy={busy || !connected || voteExpired || ((roomSkillActive || floorSkillActive || columnSkillActive) && skillSecondsLeft === 0)} /></div>
      </div>
      <div className="min-w-0 space-y-5">
      {state.phase === "SKILL_PHASE" && state.phaseMessage && <Alert severity="info" role="status">{gameMessage(state.phaseMessage, language)}</Alert>}
      <div ref={guestsRef} className="scroll-mt-4"><PublicGuests players={state.players} selfId={privateState?.playerId} selectedPlayerId={selectedSkillPlayer} selectedPlayerIds={selectedLawyerTargets} selectionCount={privateState?.role === "LAWYER" ? 2 : 1} onlinePlayerIds={onlinePlayerIds} onSelectPlayer={privateState?.canUseSkill && privateState.role === "ACCOMPLICE" ? (targetId) => setSkillPlayerSelection({ turn: state.turn, playerId: privateState.playerId, targetId }) : privateState?.canUseSkill && privateState.role === "LAWYER" ? (targetId) => setLawyerSelection((current) => ({ turn: state.turn, playerId: privateState.playerId, targetIds: selectLawyerTargets(current?.turn === state.turn && current.playerId === privateState.playerId ? current.targetIds : [], targetId) })) : undefined} /></div>
      {privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}
      {/* {privateState?.mode === "SPECTATOR" && <SpectatorPanel />} */}
      {privateState?.canUseSkill && <SkillPanel state={state} privateState={privateState} selectedRoom={selectedSkillRoom} selectedRooms={doubleKillRooms} doubleKillActive={doubleKillActive} selectedFloor={selectedSkillFloor} selectedColumn={selectedSkillColumn} selectedPlayerId={selectedSkillPlayer} selectedPlayerIds={selectedLawyerTargets} />}
      {/* {state.phase === "VOTING" && state.phaseDeadlineAt && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
      <p className="text-sm text-[#c6bdb1]">{en ? "When time runs out, votes are counted and one room opens." : "เมื่อหมดเวลา ระบบจะนับคะแนนที่มีและเปิดห้องหนึ่งห้อง"}</p>
      </Paper>} */}
      <Paper className="flex! h-75! flex-col! border! border-[#353440]! bg-[#191a22]! p-5!">
        <h2 id="public-event-history-title" className="shrink-0 font-serif text-xl">{en ? "Public event history" : "ประวัติเหตุการณ์สาธารณะ"}</h2>
        <ol aria-labelledby="public-event-history-title" tabIndex={0} className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto wrap-break-word pr-2 text-sm text-[#c6bdb1]">
          {state.publicHistory?.map((event, index) => <li key={`${event.type}-${index}`}>{gameMessage(event.message, language)}</li>)}
        </ol>
      </Paper>
    </div></div>}
  </div>{(publicChat || teamChat) && <FloatingGameChat key={`chat:${state.turn}`} publicChat={publicChat} teamChat={teamChat} language={language} selfId={privateState?.playerId} onSend={sendChat} />}{privateState?.canUseSkill && <SkillConfirmBar targetLabel={skillTargetLabel} canSubmit={canConfirmSkill} onConfirm={() => { if (skillTarget !== null) void act("game:skill", { target: skillTarget }); }} />}<MurderEventOverlay sequence={murderSequence} muted={!soundReady || muted} />{privateState?.mode === "SPECTATOR" && !deathDismissed && state.phase !== "FINISHED" && <DeathNotification onContinue={() => setDeathDismissed(true)} />}</main>;
}
