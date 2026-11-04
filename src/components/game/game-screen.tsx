"use client";

import { useEffect, useState } from "react";
import { Alert, Button, MenuItem, Paper, TextField } from "@mui/material";
import { lobbyErrorMessage } from "@/lib/lobby-client";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import type { GameResultState, PrivatePlayerState, PrivateTeamState, PublicGameState } from "@/types/game";
import type { LobbyAck } from "@/types/lobby";
import { MurderEventOverlay } from "./murder-event-overlay";
import { PrivateRoomScene } from "./private-room-scene";

export function SoundSettings({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) {
  return <Button size="small" variant="outlined" onClick={() => onChange(!muted)} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}>{muted ? "เปิดเสียง" : "ปิดเสียง"}</Button>;
}

export function DiscussionTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(interval); }, []);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <p className="text-2xl font-semibold text-[#c8a46b]" aria-live="off">เวลาพูดคุย {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>;
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
  if (state.phase === "SKILL_PHASE") return privateState?.canUseSkill
    ? "ถึงตาคุณใช้สกิล เปิดข้อมูลลับเพื่อเลือกเป้าหมายและยืนยันก่อนหมดเวลา"
    : "ช่วงใช้สกิล กำลังรอผู้เล่นที่ถึงคิวดำเนินการ";
  if (state.phase === "DISCUSSION") return "เริ่มช่วงพูดคุย แลกเปลี่ยนเบาะแสก่อนลงคะแนน";
  if (state.phase === "VOTING" && !privateState) return "ช่วงลงคะแนน กำลังตรวจสิทธิ์ของคุณ";
  if (state.phase === "VOTING") return privateState?.canVote
    ? state.runoffRooms?.length ? "ถึงตาคุณลงคะแนนรอบตัดสิน แตะห้องที่เลือกได้บนแผนผังหนึ่งครั้ง ยืนยันแล้วเปลี่ยนไม่ได้" : "ถึงตาคุณลงคะแนน แตะห้องที่เลือกได้บนแผนผังหนึ่งครั้ง ยืนยันแล้วเปลี่ยนไม่ได้"
    : "ส่งคะแนนแล้ว รอผู้เล่นคนอื่นลงคะแนน";
  return "กำลังเตรียมขั้นตอนถัดไป";
}

export function PrivateInfoPanel({ privateState, teamState, players, open, onToggle }: { privateState: PrivatePlayerState; teamState: PrivateTeamState | null; players: PublicGameState["players"]; open: boolean; onToggle: () => void }) {
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="font-serif text-xl">ข้อมูลลับ · เฉพาะคุณ</h2><p className="mt-1 text-xs text-[#a9a5af]">เปิดดูเมื่ออยู่ในที่ส่วนตัว</p></div>
      <Button variant="outlined" size="small" aria-expanded={open} onClick={onToggle}>{open ? "ปิดข้อมูลลับ" : "แสดงข้อมูลลับ"}</Button>
    </div>
    {open && <div className="mt-5 space-y-5 border-t border-[#c8a46b]/15 pt-5">
      <PrivateRoomScene role={privateState.role} roomNumber={privateState.roomNumber} team={privateState.team} isAlive={privateState.isAlive} />
      {teamState && <section><h3 className="font-semibold text-[#d8bc86]">ฝ่ายฆาตกร</h3>{teamState.teammates.map((mate) => <p className="mt-2 text-sm" key={mate.playerId}>{players.find((player) => player.id === mate.playerId)?.displayName} · {roleNames[mate.role]} · ห้อง {mate.roomNumber}</p>)}</section>}
      {privateState.actionHistory.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">ประวัติการกระทำของคุณ</h3><ol className="mt-2 space-y-2 text-sm text-[#d6d2dc]">{privateState.actionHistory.map((entry, index) => <li key={`${entry.turn}-${index}`}>รอบ {entry.turn} · {entry.message}</li>)}</ol></section>}
      {privateState.privateResults.length > 0 && <section><h3 className="font-semibold text-[#d8bc86]">ผลสืบสวนส่วนตัว</h3><ul className="mt-2 space-y-2 text-sm">{privateState.privateResults.map((message, index) => <li key={index}>{message}</li>)}</ul></section>}
    </div>}
  </Paper>;
}

export function GameResultScreen({ result }: { result: GameResultState }) {
  return <section className="rounded-2xl border border-[#c8a46b]/40 bg-[radial-gradient(circle_at_top,#4a1928,#111116_70%)] p-6 shadow-2xl sm:p-10">
    <p className="text-center text-sm tracking-[.3em] text-[#c8a46b]">ผลเกม · {result.turnsPlayed} รอบ</p>
    <h2 className="mt-4 text-center font-serif text-3xl leading-relaxed sm:text-5xl">{result.winner === "INNOCENT" ? "ผู้บริสุทธิ์ชนะ! ฆาตกรถูกเปิดโปงแล้ว" : "ฆาตกรชนะ! ความลับถูกฝังไว้ในโรงแรมแห่งนี้"}</h2>
    <div className="mt-9 grid gap-3 sm:grid-cols-2">{result.players.map((player) => <div key={player.playerId} className="flex overflow-hidden rounded-lg border border-[#c8a46b]/20 bg-[#1d1d26]/90"><RolePortrait role={player.role} className="w-20" sizes="80px" /><div className="p-4"><p className="font-semibold">{player.displayName} · {player.roomNumber}</p><p className="mt-1 text-sm text-[#c8a46b]">{roleNames[player.role]} · {player.team === "INNOCENT" ? "ผู้บริสุทธิ์" : "ฆาตกร"} · {player.isAlive ? "รอดชีวิต" : "เสียชีวิต"}</p></div></div>)}</div>
    <h3 className="mt-8 font-serif text-xl">เหตุการณ์สำคัญ</h3><ul className="mt-3 space-y-2 text-sm text-[#c6bdb1]">{result.events.map((event, index) => <li key={`${event.type}-${index}`}>{event.message}</li>)}</ul>
  </section>;
}

export function HotelBoard({ state, onVote, voteBusy = false }: { state: PublicGameState; onVote?: (roomNumber: number) => void; voteBusy?: boolean }) {
  const rooms = new Map(state.publicRooms.map((room) => [room.roomNumber, room]));
  return <Paper component="section" className="border! border-[#353440]! bg-[#191a22]! p-5! sm:p-6!">
    <div className="flex items-end justify-between gap-3 border-b border-[#353440] pb-4">
      <div><p className="text-xs uppercase tracking-[.18em] text-[#b6a783]">แผนผัง</p><h2 className="mt-1 font-serif text-2xl">โรงแรม</h2></div>
      <p className="text-xs text-[#a7a8b4]">{onVote ? "แตะห้องเพื่อลงคะแนน" : "7 ชั้น · 21 ห้อง"}</p>
    </div>
    <div className="mt-4 space-y-2">{Array.from({ length: 7 }, (_, index) => 7 - index).map((floor) =>
      <div key={floor} className="grid grid-cols-[2rem_repeat(3,minmax(0,1fr))] items-stretch gap-2">
        <span className="self-center text-center text-sm text-[#a7a8b4]">{floor}</span>
        {[1, 2, 3].map((column) => {
          const room = rooms.get(floor * 100 + column);
          if (!room) return null;
          const label = room.state === "CRIME_SCENE" ? "ที่เกิดเหตุ" : room.state === "MURDERED" ? "ถูกฆาตกรรม" : room.state === "OPENED_MURDERED" ? "ถูกฆาตกรรม · เปิดแล้ว" : room.state === "OPENED_EMPTY" ? "เปิดแล้ว · ว่าง" : room.state === "OPENED_OCCUPIED" ? "เปิดแล้ว · มีผู้พัก" : "ยังไม่เปิด";
          const marked = room.state === "CRIME_SCENE" || room.state === "MURDERED" || room.state === "OPENED_MURDERED";
          const opened = room.state.startsWith("OPENED_");
          const canSelect = !!onVote && (room.state === "UNKNOWN" || room.state === "MURDERED") && (!state.runoffRooms?.length || state.runoffRooms.includes(room.roomNumber));
          const className = `flex min-h-16 flex-col justify-center rounded-md border px-2 py-2 text-center sm:min-h-18 ${marked ? "border-[#9b555d] bg-[#302127]" : opened ? "border-[#5f594f] bg-[#25252b]" : "border-[#3d3d49] bg-[#22232c]"} ${canSelect ? "cursor-pointer ring-1 ring-[#c8a46b]/50 transition-colors hover:border-[#e3c88e] hover:bg-[#38313b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c88e] disabled:cursor-wait disabled:opacity-60" : ""}`;
          const content = <>
            <span className="font-mono text-sm font-semibold text-[#f4efe8] sm:text-base">{room.roomNumber}</span>
            <span className={`mt-1 text-[10px] leading-tight sm:text-xs ${marked ? "text-[#efb3b7]" : "text-[#b0b0bc]"}`}>{label}</span>
          </>;
          return canSelect ? <button key={room.roomNumber} type="button" aria-label={`โหวตห้อง ${room.roomNumber} ${label}`} className={className} disabled={voteBusy} onClick={() => onVote(room.roomNumber)}>{content}</button>
            : <div key={room.roomNumber} aria-label={`ห้อง ${room.roomNumber} ${label}`} className={className}>{content}</div>;
        })}
      </div>)}</div>
  </Paper>;
}

export function StoryPrologue({ deadline, connected, connectionMessage }: { deadline?: number; connected: boolean; connectionMessage: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
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
        <p>พอแสงไฟกลับมา ร่องรอยลึกลับก็รอให้ทุกคนออกค้นหา บางคนมาเพื่อหาความจริง… บางคนมาเพื่อซ่อนมัน</p>
      </div>
      <p className="mt-9 text-sm text-[#c8a46b]" role="status">{!connected ? connectionMessage || "กำลังเชื่อมต่อใหม่…" : secondsLeft === null ? "กำลังเตรียมเปิดเผยเบาะแส…" : secondsLeft > 0 ? `เบาะแสแรกจะปรากฏใน ${secondsLeft} วินาที` : "กำลังเปิดเผยเบาะแส…"}</p>
    </section>
  </main>;
}

function SkillPanel({ privateState, state, busy, onSkill }: { privateState: PrivatePlayerState; state: PublicGameState; busy: boolean; onSkill: (target: number | string) => void }) {
  const [target, setTarget] = useState<number | string>(101);
  const role = privateState.role;
  const floor = role === "HOUSEKEEPER" || role === "WITNESS";
  const column = role === "WINDOW_CLEANER";
  const teammate = role === "ACCOMPLICE";
  const options: Array<{ value: number | string; label: string }> = teammate ? state.players.filter((player) => player.id !== privateState.playerId).map((player) => ({ value: player.id, label: player.displayName })) : floor ? Array.from({ length: 7 }, (_, index) => ({ value: index + 1, label: `ชั้น ${index + 1}` })) : column ? [1, 2, 3].map((value) => ({ value, label: `แนวห้อง 0${value}` })) : state.publicRooms.map((room) => ({ value: room.roomNumber, label: `ห้อง ${room.roomNumber}` }));
  const selected = options.some((option) => option.value === target) ? target : options[0]?.value;
  return <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><h2 className="font-serif text-xl">ใช้สกิล · {roleNames[role]}</h2><div className="mt-4 flex flex-wrap items-center gap-3"><TextField select label="เป้าหมาย" size="small" value={selected ?? ""} onChange={(event) => setTarget(teammate ? event.target.value : Number(event.target.value))} className="min-w-40">{options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField><Button variant="contained" disabled={busy || selected === undefined} onClick={() => onSkill(selected!)}>ยืนยันสกิล</Button></div></Paper>;
}

export function GameScreen({ state, privateState, teamState, result, murderSequence, connected, connectionMessage, onCommand }: { state: PublicGameState; privateState: PrivatePlayerState | null; teamState: PrivateTeamState | null; result: GameResultState | null; murderSequence: number; connected: boolean; connectionMessage: string; onCommand: (event: "game:skill" | "game:vote", payload: Record<string, unknown>, version: number) => Promise<LobbyAck<{ version: number }>> }) {
  const [muted, setMuted] = useState(false);
  const [deathDismissed, setDeathDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const skillDeadlineAt = privateState?.canUseSkill ? privateState.skillDeadlineAt : undefined;
  useEffect(() => {
    if (skillDeadlineAt === undefined) return;
    const tick = () => setClockNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [skillDeadlineAt]);
  const skillSecondsLeft = skillDeadlineAt === undefined || clockNow === null ? null : Math.max(0, Math.ceil((skillDeadlineAt - clockNow) / 1000));
  const turnNotice = getTurnNotice(state, privateState);
  const changeMuted = (value: boolean) => setMuted(value);
  const act = async (event: "game:skill" | "game:vote", payload: Record<string, unknown>) => {
    setBusy(true); setError("");
    const response = await onCommand(event, payload, state.version);
    if (!response.ok) setError(lobbyErrorMessage(response.error));
    setBusy(false);
  };
  if (state.phase === "ROLE_REVEAL") return <StoryPrologue deadline={state.phaseDeadlineAt} connected={connected} connectionMessage={connectionMessage} />;
  return <main className="min-h-screen bg-[radial-gradient(circle_at_85%_0%,#3a2135,#111116_54%)] px-4 py-6 text-[#f4efe8] sm:px-8"><div className="mx-auto max-w-6xl">
    {!connected && <p role="status" className="mb-5 rounded-lg border border-[#c8a46b]/40 bg-[#32272a] p-3 text-sm text-[#f4efe8]">{connectionMessage || "กำลังเชื่อมต่อใหม่…"}</p>}
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#c8a46b]/25 pb-5"><div><p className="text-xs tracking-[.24em] text-[#c8a46b]">โรงแรมปริศนา · {state.code}</p><h1 className="mt-2 font-serif text-3xl">รอบ {state.turn} · {state.phase === "SKILL_PHASE" ? "ช่วงใช้สกิล" : state.phase === "DISCUSSION" ? "ช่วงพูดคุย" : state.phase === "VOTING" ? "ช่วงลงคะแนน" : "จบเกม"}</h1></div><SoundSettings muted={muted} onChange={changeMuted} /></header>
    <Alert severity={privateState?.canUseSkill || privateState?.canVote ? "warning" : "info"} role="status" className="mb-5!">{turnNotice}</Alert>
    {privateState?.canUseSkill && skillDeadlineAt !== undefined && <p className="mb-5 text-sm text-[#e7ce98]" role="timer" aria-live="off">{skillSecondsLeft === null ? "กำลังตรวจเวลาใช้สกิล…" : skillSecondsLeft > 0 ? `เวลาใช้สกิลเหลือ ${skillSecondsLeft} วินาที` : "หมดเวลาใช้สกิลแล้ว กำลังรอขั้นตอนถัดไป"}</p>}
    {result ? <div className="space-y-5"><GameResultScreen result={result} />{privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}</div> : <div className="grid gap-5 lg:grid-cols-[1.3fr_.8fr]"><HotelBoard state={state} onVote={state.phase === "VOTING" && privateState?.canVote ? (roomNumber) => void act("game:vote", { roomNumber }) : undefined} voteBusy={busy || !connected} /><div className="space-y-5">
      {privateState && <PrivateInfoPanel privateState={privateState} teamState={teamState} players={state.players} open={showSecret} onToggle={() => setShowSecret((value) => !value)} />}
      {privateState?.mode === "SPECTATOR" && <SpectatorPanel />}
      {state.phase === "SKILL_PHASE" && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><p>{state.phaseMessage}</p></Paper>}
      {privateState?.canUseSkill && showSecret && <SkillPanel state={state} privateState={privateState} busy={busy || !connected || (skillDeadlineAt !== undefined && (skillSecondsLeft === null || skillSecondsLeft === 0))} onSkill={(target) => void act("game:skill", { target })} />}
      {state.phase === "DISCUSSION" && state.phaseDeadlineAt && <Paper className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!"><DiscussionTimer deadline={state.phaseDeadlineAt} /><p className="mt-2 text-sm text-[#c6bdb1]">พูดคุยนอกเว็บไซต์ได้ตามต้องการ</p></Paper>}
      {error && <p role="alert" className="text-red-200">{error}</p>}
      <Paper className="border! border-[#353440]! bg-[#191a22]! p-5!"><h2 className="font-serif text-xl">ประวัติเหตุการณ์สาธารณะ</h2><ol className="mt-3 space-y-2 text-sm text-[#c6bdb1]">{state.publicHistory?.map((event, index) => <li key={`${event.type}-${index}`}>{event.message}</li>)}</ol></Paper>
    </div></div>}
  </div><MurderEventOverlay sequence={murderSequence} muted={muted} />{privateState?.mode === "SPECTATOR" && !deathDismissed && state.phase !== "FINISHED" && <DeathNotification onContinue={() => setDeathDismissed(true)} />}</main>;
}
