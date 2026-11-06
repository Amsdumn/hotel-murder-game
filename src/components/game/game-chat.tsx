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
  const title = team ? en ? "Murderer team chat" : "แชทฝ่ายฆาตกร" : en ? "Discussion chat" : "แชทช่วงพูดคุย";
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
    <p className="mt-1 text-xs text-[#a9a5af]">{team ? en ? "Only living Murderers can read and send messages here." : "เฉพาะฝ่ายฆาตกรที่ยังมีชีวิตเท่านั้นที่อ่านและส่งข้อความได้" : en ? "Living guests can send messages during discussion." : "ผู้เข้าพักที่ยังมีชีวิตส่งข้อความได้ในช่วงพูดคุย"}</p>
    <ol ref={listRef} className="mt-4 max-h-64 space-y-2 overflow-y-auto" aria-live="polite">{messages.length ? messages.map((message) => <li key={message.id} className="rounded-lg border border-[#c8a46b]/15 bg-[#29202b] px-3 py-2 text-sm"><span className="font-semibold text-[#f2d79c]">{message.playerName}</span><span className="ml-2 text-xs text-[#a9a5af]">{en ? "Turn" : "รอบ"} {message.turn}</span><p className="mt-1 whitespace-pre-wrap wrap-break-word">{message.text}</p></li>) : <li className="text-sm text-[#a9a5af]">{en ? "No messages yet" : "ยังไม่มีข้อความ"}</li>}</ol>
    {canSend && <form className="mt-4 flex gap-2" onSubmit={(event) => void submit(event)}><input aria-label={en ? "Chat message" : "ข้อความแชท"} value={draft} maxLength={300} onChange={(event) => setDraft(event.target.value)} placeholder={en ? "Type a message" : "พิมพ์ข้อความ"} className="min-w-0 flex-1 rounded-lg border border-[#c8a46b]/40 bg-[#12111c] px-3 py-2 text-sm text-[#f4efe8]" /><Button type="submit" variant="contained" disabled={sending || !draft.trim()}>{en ? "Send" : "ส่ง"}</Button></form>}
    {failed && <p role="alert" className="mt-2 text-sm text-red-200">{en ? "Message could not be sent. Try again." : "ส่งข้อความไม่สำเร็จ ลองอีกครั้ง"}</p>}
  </Paper>;
}
