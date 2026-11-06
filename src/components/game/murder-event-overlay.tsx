"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-switcher";
import { playGameSound } from "@/lib/game-sound";

export function MurderEventOverlay({ sequence, muted }: { sequence: number; muted: boolean }) {
  const en = useLanguage() === "en";
  const [endedSequence, setEndedSequence] = useState(0);
  const playedSequence = useRef(0);
  useEffect(() => {
    if (!sequence) return;
    const timeout = window.setTimeout(() => setEndedSequence(sequence), 4600);
    return () => window.clearTimeout(timeout);
  }, [sequence]);
  useEffect(() => {
    if (sequence && sequence > endedSequence && !muted && playedSequence.current !== sequence) {
      playedSequence.current = sequence;
      playGameSound("murder");
    }
  }, [sequence, endedSequence, muted]);
  if (!sequence || sequence <= endedSequence) return null;
  return <div className="murder-event-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#09070b] px-6 text-center text-[#f4efe8]" role="alert" aria-live="assertive">
    <div className="murder-event-message max-w-2xl">
      <p className="mb-5 text-sm tracking-[.3em] text-[#c8a46b]">{en ? "WHO KILLED TONIGHT?" : "คืนนี้ใครฆ่า..."}</p>
      <p className="font-serif text-3xl leading-relaxed sm:text-5xl">{en ? "A murder has occurred in the hotel..." : "มีเหตุฆาตกรรมเกิดขึ้นภายในโรงแรม..."}</p>
      <p className="mt-6 text-lg text-[#c8a46b] sm:text-2xl">{en ? "But nobody knows who the victim is" : "แต่ไม่มีใครรู้ว่าเหยื่อคือใคร"}</p>
    </div>
  </div>;
}
