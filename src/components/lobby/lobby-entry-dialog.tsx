"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { connectLobbySocket, lobbyErrorMessage, requestLobby, saveLobbyIdentity } from "@/lib/lobby-client";
import type { LobbyIdentity, LobbyView } from "@/types/lobby";
import { createActionId } from "@/lib/action-id";
import { RoomLoadingScreen } from "@/components/lobby/room-loading-screen";

export function LobbyEntryDialog({ mode, initialCode = "", onClose }: { mode: "create" | "join" | null; initialCode?: string; onClose: () => void }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    const socket = connectLobbySocket();
    let navigatingToCreatedRoom = false;
    try {
      let result;
      if (mode === "create") {
        result = await requestLobby<LobbyIdentity>(socket, "lobby:create", { displayName, actionId: createActionId() });
      } else {
        const preview = await requestLobby<LobbyView>(socket, "lobby:preview", code);
        if (!preview.ok) { setError(lobbyErrorMessage(preview.error)); return; }
        result = await requestLobby<LobbyIdentity>(socket, "lobby:join", {
          code: preview.data.code, displayName, actionId: createActionId(), expectedVersion: preview.data.version,
        });
      }
      if (!result.ok) { setError(lobbyErrorMessage(result.error)); return; }
      saveLobbyIdentity(result.data);
      if (mode === "create") {
        setCreatedCode(result.data.code);
        navigatingToCreatedRoom = true;
      }
      router.push(`/lobby/${result.data.code}`);
      if (mode !== "create") onClose();
    } finally {
      socket.disconnect();
      if (!navigatingToCreatedRoom) setBusy(false);
    }
  }

  return (
    <>
    {mode === "create" && busy && <RoomLoadingScreen phase={createdCode ? "entering" : "creating"} code={createdCode ?? undefined} />}
    <Dialog open={mode !== null && !(mode === "create" && busy)} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <DialogTitle>{mode === "create" ? "สร้างห้องเกม" : "เข้าร่วมห้องเกม"}</DialogTitle>
        <DialogContent className="space-y-5! pt-3!">
          <TextField label="ชื่อผู้เล่น" value={displayName} onChange={(event) => setDisplayName(event.target.value)} fullWidth required slotProps={{ htmlInput: { minLength: 2, maxLength: 24 } }} />
          {mode === "join" && <TextField label="รหัสห้อง 6 ตัว" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} fullWidth required slotProps={{ htmlInput: { maxLength: 6 } }} />}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? "กำลังเชื่อมต่อ…" : mode === "create" ? "สร้างห้อง" : "เข้าร่วม"}</Button>
        </DialogActions>
      </form>
    </Dialog>
    </>
  );
}
