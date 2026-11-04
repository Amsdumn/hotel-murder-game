"use client";

import { useEffect, useState } from "react";
import { Button, MenuItem, Paper, TextField } from "@mui/material";
import { lobbyErrorMessage } from "@/lib/lobby-client";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import type { GameResultState, PrivatePlayerState, PrivateTeamState, PublicGameState } from "@/types/game";
import type { LobbyAck } from "@/types/lobby";
import { MurderEventOverlay } from "./murder-event-overlay";

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
      <Button className="!mt-7" variant="contained" onClick={onContinue}>รับชมเกมต่อ</Button>
    </div>
  </div>;
}

export function SpectatorPanel() {
  return <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><h2 className="font-serif text-xl">โหมดผู้ชม</h2><p className="mt-2 text-sm leading-7 text-[#c6bdb1]">คุณสามารถดูเหตุการณ์สาธารณะและผลโหวตได้ โปรดหยุดให้ข้อมูลเกี่ยวกับเกมทันที</p></Paper>;
}

export function VotingPanel({ state, canVote, onVote, busy }: { state: PublicGameState; canVote: boolean; onVote: (roomNumber: number) => void; busy: boolean }) {
  return <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5">
    <h2 className="font-serif text-xl">ลงคะแนนเปิดห้อง</h2>
    <p className="mt-2 text-sm text-[#c6bdb1]">เลือกห้องที่ยังไม่ถูกเปิดหรือเป็นที่เกิดเหตุ คุณเลือกห้องตัวเองได้</p>
    <p className="mt-2 text-xs text-[#c8a46b]">กำลังรวบรวมคะแนนโดยไม่แสดงตัวตนผู้ลงคะแนน</p>
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {state.publicRooms.filter((room) => (room.state === "UNKNOWN" || room.state === "MURDERED") && (!state.runoffRooms?.length || state.runoffRooms.includes(room.roomNumber))).map((room) => <Button key={room.roomNumber} variant="outlined" disabled={!canVote || busy} onClick={() => onVote(room.roomNumber)}>{room.roomNumber}</Button>)}
    </div>
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

function HotelBoard({ state }: { state: PublicGameState }) {
  return <Paper className="!overflow-hidden !border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5 sm:!p-7"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs tracking-[.22em] text-[#c8a46b]">HOTEL MAP</p><h2 className="mt-1 font-serif text-2xl">แผนผังโรงแรม</h2></div><span className="text-xs text-[#c6bdb1]">7 ชั้น · 21 ห้อง</span></div><p className="mt-3 text-sm text-[#c6bdb1]">สถานะห้องเป็นข้อมูลสาธารณะ ไม่แสดงตัวตนผู้พัก</p><div className="mt-6 space-y-3">{Array.from({ length: 7 }, (_, index) => 7 - index).map((floor) => <div key={floor} className="grid grid-cols-[2.5rem_repeat(3,minmax(0,1fr))] items-center gap-2"><span className="text-center font-serif text-lg text-[#c8a46b]">{floor}</span>{[1, 2, 3].map((column) => { const room = state.publicRooms.find((item) => item.roomNumber === floor * 100 + column); if (!room) return null; const crime = room.state === "CRIME_SCENE"; const murdered = room.state === "MURDERED" || room.state === "OPENED_MURDERED"; const opened = room.state === "OPENED_EMPTY" || room.state === "OPENED_OCCUPIED"; return <div key={room.roomNumber} className={`relative min-h-20 rounded-t-xl border px-2 py-3 text-center shadow-[inset_0_-8px_15px_rgba(0,0,0,.28)] sm:min-h-24 ${crime ? "border-[#b85967]/60 bg-[#4d2334]" : murdered ? "border-[#e07077]/70 bg-[#612130]" : opened ? "border-[#b99a62]/45 bg-[#423b39]" : "border-[#c8a46b]/30 bg-[linear-gradient(160deg,#35303b,#211c2a)]"}`}><span className="font-serif text-lg font-semibold text-[#f4e5d0]">{room.roomNumber}</span><span className={`mt-1 block text-[11px] leading-tight sm:text-xs ${crime || murdered ? "text-[#ffc1c5]" : "text-[#d2b988]"}`}>{crime ? "ที่เกิดเหตุ" : murdered ? room.state === "OPENED_MURDERED" ? "ถูกฆาตกรรม · เปิดแล้ว" : "ถูกฆาตกรรม" : room.state === "OPENED_EMPTY" ? "เปิดแล้ว · ว่าง" : room.state === "OPENED_OCCUPIED" ? "เปิดแล้ว · มีผู้พัก" : "ยังไม่เปิด"}</span></div>; })}</div>)}</div></Paper>;
}

function SkillPanel({ privateState, state, busy, onSkill }: { privateState: PrivatePlayerState; state: PublicGameState; busy: boolean; onSkill: (target: number | string) => void }) {
  const [target, setTarget] = useState<number | string>(101);
  const role = privateState.role;
  const floor = role === "HOUSEKEEPER" || role === "WITNESS";
  const column = role === "WINDOW_CLEANER";
  const teammate = role === "ACCOMPLICE";
  const options: Array<{ value: number | string; label: string }> = teammate ? state.players.filter((player) => player.id !== privateState.playerId).map((player) => ({ value: player.id, label: player.displayName })) : floor ? Array.from({ length: 7 }, (_, index) => ({ value: index + 1, label: `ชั้น ${index + 1}` })) : column ? [1, 2, 3].map((value) => ({ value, label: `แนวห้อง 0${value}` })) : state.publicRooms.map((room) => ({ value: room.roomNumber, label: `ห้อง ${room.roomNumber}` }));
  const selected = options.some((option) => option.value === target) ? target : options[0]?.value;
  return <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><h2 className="font-serif text-xl">ใช้สกิล · {roleNames[role]}</h2><div className="mt-4 flex flex-wrap items-center gap-3"><TextField select label="เป้าหมาย" size="small" value={selected ?? ""} onChange={(event) => setTarget(teammate ? event.target.value : Number(event.target.value))} className="min-w-40">{options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField><Button variant="contained" disabled={busy || selected === undefined} onClick={() => onSkill(selected!)}>ยืนยันสกิล</Button></div></Paper>;
}

export function GameScreen({ state, privateState, teamState, result, murderSequence, connected, connectionMessage, onCommand }: { state: PublicGameState; privateState: PrivatePlayerState | null; teamState: PrivateTeamState | null; result: GameResultState | null; murderSequence: number; connected: boolean; connectionMessage: string; onCommand: (event: "game:skill" | "game:vote", payload: Record<string, unknown>, version: number) => Promise<LobbyAck<{ version: number }>> }) {
  const [muted, setMuted] = useState(false);
  const [deathDismissed, setDeathDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changeMuted = (value: boolean) => setMuted(value);
  const act = async (event: "game:skill" | "game:vote", payload: Record<string, unknown>) => {
    setBusy(true); setError("");
    const response = await onCommand(event, payload, state.version);
    if (!response.ok) setError(lobbyErrorMessage(response.error));
    setBusy(false);
  };
  return <main className="min-h-screen bg-[radial-gradient(circle_at_85%_0%,#3a2135,#111116_54%)] px-4 py-6 text-[#f4efe8] sm:px-8"><div className="mx-auto max-w-6xl">
    {!connected && <p role="status" className="mb-5 rounded-lg border border-[#c8a46b]/40 bg-[#32272a] p-3 text-sm text-[#f4efe8]">{connectionMessage || "กำลังเชื่อมต่อใหม่…"}</p>}
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#c8a46b]/25 pb-5"><div><p className="text-xs tracking-[.24em] text-[#c8a46b]">โรงแรมปริศนา · {state.code}</p><h1 className="mt-2 font-serif text-3xl">รอบ {state.turn} · {state.phase === "SKILL_PHASE" ? "ช่วงใช้สกิล" : state.phase === "DISCUSSION" ? "ช่วงพูดคุย" : state.phase === "VOTING" ? "ช่วงลงคะแนน" : "จบเกม"}</h1></div><SoundSettings muted={muted} onChange={changeMuted} /></header>
    {result ? <GameResultScreen result={result} /> : <div className="grid gap-5 lg:grid-cols-[1.3fr_.8fr]"><HotelBoard state={state} /><div className="space-y-5">
      {privateState && <Paper className="!flex !overflow-hidden !border !border-[#c8a46b]/35 !bg-[#231c2b] !p-0"><RolePortrait role={privateState.role} className="w-28 sm:w-36" sizes="144px" /><div className="min-w-0 p-5"><p className="text-xs tracking-[.18em] text-[#c8a46b]">ข้อมูลลับ · เฉพาะคุณ</p><h2 className="mt-2 font-serif text-2xl text-[#f4e5d0]">{roleNames[privateState.role]}</h2><p className="mt-2 text-sm text-[#c6bdb1]">ห้องพัก {privateState.roomNumber}</p><p className="mt-3 text-xs text-[#d2b988]">{privateState.team === "MURDERER" ? "ฝ่ายฆาตกร" : "ฝ่ายผู้บริสุทธิ์"} · {privateState.isAlive ? "ยังมีชีวิต" : "เสียชีวิต"}</p></div></Paper>}
      {teamState && <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><h2 className="font-serif text-xl">ฝ่ายฆาตกร</h2>{teamState.teammates.map((mate) => <p className="mt-2 text-sm" key={mate.playerId}>{state.players.find((player) => player.id === mate.playerId)?.displayName} · {roleNames[mate.role]} · ห้อง {mate.roomNumber}</p>)}</Paper>}
      {privateState?.mode === "SPECTATOR" && <SpectatorPanel />}
      {state.phase === "SKILL_PHASE" && <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><p>{state.phaseMessage}</p></Paper>}
      {privateState?.canUseSkill && <SkillPanel state={state} privateState={privateState} busy={busy || !connected} onSkill={(target) => void act("game:skill", { target })} />}
      {state.phase === "DISCUSSION" && state.phaseDeadlineAt && <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><DiscussionTimer deadline={state.phaseDeadlineAt} /><p className="mt-2 text-sm text-[#c6bdb1]">พูดคุยนอกเว็บไซต์ได้ตามต้องการ</p></Paper>}
      {state.phase === "VOTING" && <VotingPanel state={state} canVote={privateState?.canVote ?? false} busy={busy || !connected} onVote={(roomNumber) => void act("game:vote", { roomNumber })} />}
      {error && <p role="alert" className="text-red-200">{error}</p>}
      <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><h2 className="font-serif text-xl">เหตุการณ์สาธารณะ</h2><ul className="mt-3 space-y-2 text-sm text-[#c6bdb1]">{state.publicHistory?.map((event, index) => <li key={`${event.type}-${index}`}>{event.message}</li>)}</ul></Paper>
      {privateState?.privateResults.length ? <Paper className="!border !border-[#c8a46b]/25 !bg-[#1d1d26] !p-5"><h2 className="font-serif text-xl">ผลสืบสวนส่วนตัว</h2><ul className="mt-3 space-y-2 text-sm">{privateState.privateResults.map((message, index) => <li key={index}>{message}</li>)}</ul></Paper> : null}
    </div></div>}
  </div><MurderEventOverlay sequence={murderSequence} muted={muted} />{privateState?.mode === "SPECTATOR" && !deathDismissed && state.phase !== "FINISHED" && <DeathNotification onContinue={() => setDeathDismissed(true)} />}</main>;
}
