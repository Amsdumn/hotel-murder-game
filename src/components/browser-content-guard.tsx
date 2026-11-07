"use client";

import { useEffect } from "react";

export function BrowserContentGuard() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const preventImageDrag = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) event.preventDefault();
    };
    const preventShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (key === "f12" || modifier && (key === "u" || key === "s" || event.shiftKey && ["i", "j", "c", "k"].includes(key))) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("dragstart", preventImageDrag);
    document.addEventListener("keydown", preventShortcuts, true);
    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("dragstart", preventImageDrag);
      document.removeEventListener("keydown", preventShortcuts, true);
    };
  }, []);

  return null;
}
