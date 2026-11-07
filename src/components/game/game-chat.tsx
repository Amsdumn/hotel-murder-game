"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Paper } from "@mui/material";
import type { GameChatMessage } from "@/types/game";
import type { Language } from "@/lib/language";

export function GameChat({ channel, messages, canSend, language, onSend }: { channel: "PUBLIC" | "MURDERER"; messages: GameChatMessage[]; canSend: boolean; language: Language; onSend: (text: string) => Promise<boolean> }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const en = language === "en";
  const team = channel === "MURDERER";
  const title = team ? en ? "Murderers' secret channel" : "ช่องลับฝ่ายฆาตกร" : en ? "Hotel lobby conversation" : "วงสนทนาในล็อบบี้";
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!canSend || sending || !text) return;
    setSending(true);
    const sent = await onSend(text);
    if (sent) setDraft("");
    setFailed(!sent);
    setSending(false);
  };

  return <Paper component="section" aria-label={title} className="border! border-[#c8a46b]/25! bg-[#1d1d26]! p-5!">
    <h2 className="font-serif text-xl">{title}</h2>
    <p className="mt-1 text-xs text-[#a9a5af]">{team ? en ? "Only living Murderers can whisper here until the ballot closes." : "เฉพาะฆาตกรที่ยังมีชีวิตกระซิบกันได้จนปิดหีบลงคะแนน" : en ? "Living guests can trade clues until the ballot closes." : "ผู้เข้าพักที่ยังมีชีวิตแลกเบาะแสได้จนปิดหีบลงคะแนน"}</p>
    <ol ref={listRef} className="mt-4 max-h-64 space-y-2 overflow-y-auto" aria-live="polite">{messages.length ? messages.map((message) => <li key={message.id} className="rounded-lg border border-[#c8a46b]/15 bg-[#29202b] px-3 py-2 text-sm"><span className="inline-block max-w-[150px] truncate align-bottom font-semibold text-[#f2d79c]" title={message.playerName}>{message.playerName}</span><span className="ml-2 text-xs text-[#a9a5af]">{en ? "Turn" : "รอบ"} {message.turn}</span><p className="mt-1 whitespace-pre-wrap wrap-break-word">{message.text}</p></li>) : <li className="text-sm text-[#a9a5af]">{en ? "No messages yet" : "ยังไม่มีข้อความ"}</li>}</ol>
    {canSend && <form className="mt-4 flex gap-2" onSubmit={(event) => void submit(event)}><input aria-label={en ? "Chat message" : "ข้อความแชท"} value={draft} maxLength={300} onChange={(event) => setDraft(event.target.value)} placeholder={en ? "Type a message" : "พิมพ์ข้อความ"} className="min-w-0 flex-1 rounded-lg border border-[#c8a46b]/40 bg-[#12111c] px-3 py-2 text-sm text-[#f4efe8]" /><Button type="submit" variant="contained" disabled={sending || !draft.trim()}>{en ? "Send" : "ส่ง"}</Button></form>}
    {failed && <p role="alert" className="mt-2 text-sm text-red-200">{en ? "Message could not be sent. Try again." : "ส่งข้อความไม่สำเร็จ ลองอีกครั้ง"}</p>}
  </Paper>;
}

export function getUnreadChatCount(messages: GameChatMessage[], readCount: number, selfId?: string): number {
  return messages.slice(readCount).filter((message) => message.playerId !== selfId).length;
}

export function FloatingGameChat({ channel, messages, canSend, language, deadline, selfId, onSend }: { channel: "PUBLIC" | "MURDERER"; messages: GameChatMessage[]; canSend: boolean; language: Language; deadline: number; selfId?: string; onSend: (text: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [readCount, setReadCount] = useState(messages.length);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (now >= deadline) return null;
  const en = language === "en";
  const team = channel === "MURDERER";
  const label = team ? en ? "Murderer chat" : "แชทฝ่ายฆาตกร" : en ? "Discussion chat" : "แชทพูดคุย";
  const bottom = team ? "bottom-24" : "bottom-4";
  const panelBottom = team ? "bottom-40" : "bottom-20";
  const unread = open ? 0 : getUnreadChatCount(messages, readCount, selfId);
  const toggle = () => {
    setReadCount(messages.length);
    setOpen((value) => !value);
  };
  return <>
    {open && <div id="floating-game-chat" className={`fixed left-4 z-40 w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl ${panelBottom}`}><GameChat channel={channel} messages={messages} canSend={canSend && now < deadline} language={language} onSend={onSend} /></div>}
    <button type="button" aria-label={open ? en ? "Close chat" : "ปิดแชท" : `${en ? `Open ${label}` : `เปิด${label}`}${unread ? en ? `, ${unread} unread messages` : ` มีข้อความใหม่ ${unread} ข้อความ` : ""}`} aria-expanded={open} aria-controls="floating-game-chat" onClick={toggle} className={`fixed left-2 z-40 max-w-[calc(100vw-1rem)] rounded-full border border-[#e3c88e] bg-[#3b2c38] px-4 py-3 text-sm font-semibold text-[#f2d79c] shadow-[0_8px_30px_rgba(0,0,0,.55)] hover:bg-[#4a3942] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3c88e] sm:left-4 sm:px-5 ${bottom}`}>{open ? en ? "Close chat" : "ปิดแชท" : label}{unread > 0 && <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white" aria-live="polite">{unread}</span>}</button>
  </>;
}
