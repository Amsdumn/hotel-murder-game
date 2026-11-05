"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-switcher";

function playSuspense(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(110, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, context.currentTime + 0.8);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.9);
    oscillator.onended = () => { void context.close(); };
  } catch { /* Browsers may disallow audio before user interaction. */ }
}

export function MurderEventOverlay({ sequence, muted }: { sequence: number; muted: boolean }) {
  const en = useLanguage() === "en";
  const [endedSequence, setEndedSequence] = useState(0);
  useEffect(() => {
    if (!sequence) return;
    if (!muted) playSuspense();
    const timeout = window.setTimeout(() => setEndedSequence(sequence), 4600);
    return () => window.clearTimeout(timeout);
    // Only a new event may replay the sound or animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence]);
  if (!sequence || sequence <= endedSequence) return null;
  return <div className="murder-event-overlay fixed inset-0 z-50 flex items-center justify-center bg-[#09070b] px-6 text-center text-[#f4efe8]" role="alert" aria-live="assertive">
    <div className="murder-event-message max-w-2xl">
      <p className="mb-5 text-sm tracking-[.3em] text-[#c8a46b]">{en ? "WHO KILLED TONIGHT?" : "คืนนี้ใครฆ่า..."}</p>
      <p className="font-serif text-3xl leading-relaxed sm:text-5xl">{en ? "A murder has occurred in the hotel..." : "มีเหตุฆาตกรรมเกิดขึ้นภายในโรงแรม..."}</p>
      <p className="mt-6 text-lg text-[#c8a46b] sm:text-2xl">{en ? "But nobody knows who the victim is" : "แต่ไม่มีใครรู้ว่าเหยื่อคือใคร"}</p>
    </div>
  </div>;
}
