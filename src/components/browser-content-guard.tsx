"use client";

import { useEffect } from "react";

export function BrowserContentGuard() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const preventDrag = (event: DragEvent) => event.preventDefault();
    const preventTextSelection = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
    };
    const preventShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (key === "f12" || modifier && (key === "u" || key === "s" || event.shiftKey && ["i", "j", "c", "k"].includes(key))) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("selectstart", preventTextSelection);
    document.addEventListener("keydown", preventShortcuts, true);
    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("selectstart", preventTextSelection);
      document.removeEventListener("keydown", preventShortcuts, true);
    };
  }, []);

  return null;
}
