"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@mui/material";
import { normalizeLanguage, type Language } from "@/lib/language";

const key = "hotel-language";
const eventName = "hotel-language-changed";
let fallbackLanguage: Language = "th";
const subscribe = (onChange: () => void) => {
  window.addEventListener(eventName, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(eventName, onChange); window.removeEventListener("storage", onChange); };
};
const snapshot = (): Language => {
  try { return normalizeLanguage(localStorage.getItem(key)); } catch { return fallbackLanguage; }
};

export function useLanguage(): Language {
  const language = useSyncExternalStore(subscribe, snapshot, (): Language => "th");
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return language;
}

export function LanguageSwitcher() {
  const language = useLanguage();
  const choose = (next: Language) => {
    fallbackLanguage = next;
    try { localStorage.setItem(key, next); } catch { /* Continue for this tab. */ }
    document.documentElement.lang = next;
    window.dispatchEvent(new Event(eventName));
  };
  return <div role="group" aria-label={language === "en" ? "Language" : "ภาษา"} className="flex items-center rounded-lg border border-[#d9b66f]/35 bg-[#171321]/80 p-0.5">
    <Button size="small" variant={language === "th" ? "contained" : "text"} aria-pressed={language === "th"} onClick={() => choose("th")}>ไทย</Button>
    <Button size="small" variant={language === "en" ? "contained" : "text"} aria-pressed={language === "en"} onClick={() => choose("en")}>EN</Button>
  </div>;
}
