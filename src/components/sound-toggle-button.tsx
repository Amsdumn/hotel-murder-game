"use client";

import { IconButton } from "@mui/material";
import { useLanguage } from "@/components/language-switcher";

export function SoundToggleButton({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) {
  const en = useLanguage() === "en";
  const label = muted ? en ? "Turn on sound" : "เปิดเสียง" : en ? "Mute sound" : "ปิดเสียง";

  return <IconButton color="primary" size="small" aria-label={label} title={label} aria-pressed={!muted} onClick={() => onChange(!muted)}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {muted ? <><path d="m17 9 5 6" /><path d="m22 9-5 6" /></> : <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M19 6a8 8 0 0 1 0 12" /></>}
    </svg>
  </IconButton>;
}
