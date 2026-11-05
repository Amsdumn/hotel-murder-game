"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { connectLobbySocket, forgetLobbyIdentity, joinOrResumeLobby, lobbyErrorMessage, readLobbyToken, requestLobby, saveGuestProfile, saveLobbyIdentity } from "@/lib/lobby-client";
import type { LobbyAck, LobbyIdentity } from "@/types/lobby";
import { createActionId } from "@/lib/action-id";
import { RoomLoadingScreen } from "@/components/lobby/room-loading-screen";
import { useLanguage } from "@/components/language-switcher";

export function LobbyEntryDialog({ mode, initialCode = "", initialDisplayName = "", initialSavedSeat = false, onClose }: { mode: "create" | "join" | null; initialCode?: string; initialDisplayName?: string; initialSavedSeat?: boolean; onClose: () => void }) {
  const en = useLanguage() === "en";
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [savedSeat, setSavedSeat] = useState(initialSavedSeat);
  const [recoveryFailed, setRecoveryFailed] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    const socket = connectLobbySocket();
    let navigatingToCreatedRoom = false;
    try {
      let result: LobbyAck<LobbyIdentity>;
      if (mode === "create") {
        result = await requestLobby<LobbyIdentity>(socket, "lobby:create", { displayName, actionId: createActionId() });
      } else {
        result = await joinOrResumeLobby(socket, code, displayName);
        if (!result.ok && result.error === "INVALID_SESSION" && savedSeat) {
          setRecoveryFailed(true);
          setError(en ? "Unable to resume your previous seat. Try again or join as a new player." : "ไม่สามารถกลับเข้าตัวละครเดิมได้ กรุณาลองอีกครั้ง หรือเลือกเข้าร่วมเป็นผู้เล่นใหม่");
          return;
        }
      }
      if (!result.ok) { setError(lobbyErrorMessage(result.error, en ? "en" : "th")); return; }
      saveLobbyIdentity(result.data);
      const ownName = result.data.view.players.find((player) => player.id === result.data.playerId)?.displayName;
      if (ownName) saveGuestProfile(ownName);
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
        <DialogTitle>{mode === "create" ? en ? "Create game room" : "สร้างห้องเกม" : savedSeat ? en ? "Resume your room" : "กลับเข้าห้องเดิม" : en ? "Join game room" : "เข้าร่วมห้องเกม"}</DialogTitle>
        <DialogContent className="space-y-5! pt-3!">
          {savedSeat ? <p className="text-sm text-[#c6bdb1]">{en ? "Your previous seat was found in this browser. You can resume without creating another player." : "พบตัวละครเดิมของคุณในเบราว์เซอร์นี้ ระบบจะพากลับเข้าห้องโดยไม่สร้างผู้เล่นใหม่"}</p> : <TextField label={en ? "Player name" : "ชื่อผู้เล่น"} helperText={en ? "Your name is saved as a profile in this browser" : "ชื่อจะถูกบันทึกเป็นโปรไฟล์บนเบราว์เซอร์นี้"} value={displayName} onChange={(event) => setDisplayName(event.target.value)} fullWidth required slotProps={{ htmlInput: { minLength: 2, maxLength: 24 } }} />}
          {mode === "join" && <TextField label={en ? "6-character room code" : "รหัสห้อง 6 ตัว"} value={code} onChange={(event) => { const nextCode = event.target.value.toUpperCase(); setCode(nextCode); setSavedSeat(Boolean(readLobbyToken(nextCode.trim()))); setRecoveryFailed(false); setError(""); }} fullWidth required slotProps={{ htmlInput: { maxLength: 6 } }} />}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {recoveryFailed && <Button variant="text" onClick={() => { forgetLobbyIdentity(code.trim().toUpperCase()); setSavedSeat(false); setRecoveryFailed(false); setError(""); }}>{en ? "Join as a new player" : "เข้าร่วมเป็นผู้เล่นใหม่"}</Button>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>{en ? "Cancel" : "ยกเลิก"}</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? en ? "Connecting…" : "กำลังเชื่อมต่อ…" : mode === "create" ? en ? "Create room" : "สร้างห้อง" : savedSeat ? en ? "Resume" : "กลับเข้าห้อง" : en ? "Join" : "เข้าร่วม"}</Button>
        </DialogActions>
      </form>
    </Dialog>
    </>
  );
}
