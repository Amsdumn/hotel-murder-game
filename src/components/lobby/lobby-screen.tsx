"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField } from "@mui/material";
import type { Socket } from "socket.io-client";
import { connectLobbySocket, lobbyErrorMessage, readLobbyToken, requestLobby, saveLobbyIdentity } from "@/lib/lobby-client";
import type { LobbyIdentity, LobbyView } from "@/types/lobby";
import type { GameResultState, PrivatePlayerState, PrivateTeamState, PublicGameState } from "@/types/game";
import { GameScreen } from "@/components/game/game-screen";
import { createActionId } from "@/lib/action-id";

export function LobbyScreen({ code }: { code: string }) {
  const socketRef = useRef<Socket | null>(null);
  const [view, setView] = useState<LobbyView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playerLimit, setPlayerLimit] = useState(10);
  const [discussionSeconds, setDiscussionSeconds] = useState(180);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [teamState, setTeamState] = useState<PrivateTeamState | null>(null);
  const [result, setResult] = useState<GameResultState | null>(null);
  const [murderSequence, setMurderSequence] = useState(0);

  useEffect(() => {
    const socket = connectLobbySocket(false);
    socketRef.current = socket;
    let disposed = false;
    let resuming = false;
    let retryTimer: number | null = null;
    const onState = (next: LobbyView) => setView(next);
    const onConnect = async () => {
      if (disposed || resuming) return;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      resuming = true;
      try {
        const currentToken = readLobbyToken(code);
        if (!currentToken) {
          setError("ไม่พบสิทธิ์เข้าห้อง กรุณาเข้าร่วมจากหน้าแรก");
          return;
        }
        const result = await requestLobby<LobbyIdentity>(socket, "lobby:resume", { code, token: currentToken });
        if (result.ok) saveLobbyIdentity(result.data);
        if (disposed || !socket.connected) return;
        if (!result.ok) {
          setError(lobbyErrorMessage(result.error));
          if (result.error === "SERVER_UNAVAILABLE" && retryTimer === null) {
            retryTimer = window.setTimeout(() => { retryTimer = null; void onConnect(); }, 3000);
          }
          return;
        }
        setConnected(true);
        setPlayerId(result.data.playerId);
        setView(result.data.view);
        setPlayerLimit(result.data.view.playerLimit);
        setDiscussionSeconds(result.data.view.discussionSeconds);
        setError("");
      } finally {
        resuming = false;
      }
    };
    const onDisconnect = (reason: string) => {
      setConnected(false);
      setError(reason === "io server disconnect" ? "ห้องนี้ถูกเปิดจากแท็บหรืออุปกรณ์อื่น กรุณาเข้าร่วมใหม่จากหน้าแรก" : "การเชื่อมต่อขาด กำลังเชื่อมต่อใหม่…");
    };
    const onConnectError = () => setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองอีกครั้ง…");
    const onGameState = (next: PublicGameState) => setGameState(next);
    const onPrivateState = (next: PrivatePlayerState) => setPrivateState(next);
    const onTeamState = (next: PrivateTeamState | null) => setTeamState(next);
    const onResult = (next: GameResultState) => setResult(next);
    const onGameEvent = (event: { type: string }) => { if (event.type === "MURDER_OCCURRED") setMurderSequence((value) => value + 1); };
    socket.on("lobby:state", onState);
    socket.on("game:state", onGameState);
    socket.on("game:private", onPrivateState);
    socket.on("game:team", onTeamState);
    socket.on("game:result", onResult);
    socket.on("game:event", onGameEvent);
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.connect();
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket.off("lobby:state", onState);
      socket.off("game:state", onGameState);
      socket.off("game:private", onPrivateState);
      socket.off("game:team", onTeamState);
      socket.off("game:result", onResult);
      socket.off("game:event", onGameEvent);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  async function act(event: "lobby:ready" | "lobby:configure", payload: Record<string, unknown>) {
    const socket = socketRef.current;
    if (!socket || !view) return;
    setBusy(true);
    setError("");
    const result = await requestLobby<LobbyView>(socket, event, { ...payload, actionId: createActionId(), expectedVersion: view.version });
    if (result.ok) setView(result.data);
    else setError(lobbyErrorMessage(result.error));
    setBusy(false);
  }

  const self = view?.players.find((player) => player.id === playerId);
  const isHost = view?.hostPlayerId === playerId;

  if (gameState) return <GameScreen state={gameState} privateState={privateState} teamState={teamState} result={result} murderSequence={murderSequence} connected={connected} connectionMessage={error} onCommand={(event, payload, version) => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve({ ok: false, error: "SERVER_UNAVAILABLE" as const });
    return requestLobby<{ version: number }>(socket, event, { ...payload, actionId: createActionId(), expectedVersion: version });
  }} />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#12111c] px-5 py-8 text-[#f8f1e4] sm:px-10">
      <div className="pointer-events-none absolute inset-0"><Image src="/art/hotel-night.webp" alt="" fill sizes="100vw" className="object-cover object-center opacity-35" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,17,28,.8),rgba(18,17,28,.94)_70%)]" /></div>
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#d9b66f]/25 pb-5">
          <div>
            <p className="text-sm tracking-[.22em] text-[#d9b66f]">โรงแรมปริศนา</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">ห้องพักก่อนเริ่มเกม</h1>
            <p className="mt-2 text-sm text-[#c6bdb1]">แขกทุกคนกำลังมารวมตัวกัน ก่อนความลับในโรงแรมจะเริ่มเปิดเผย</p>
          </div>
          <Button component={Link} href="/" variant="text">กลับหน้าแรก</Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <Paper className="border! border-[#d9b66f]/20! bg-[#211c1c]/95! p-5! sm:p-7!">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-[#c6bdb1]">รหัสห้อง</p>
                  <p className="mt-1 font-mono text-3xl tracking-[.18em] text-[#d9b66f]">{code}</p>
                </div>
                <Chip label={connected ? "เชื่อมต่อแล้ว" : "กำลังเชื่อมต่อ"} color={connected ? "success" : "default"} variant="outlined" />
              </div>

              {!view && !error && <div className="flex items-center gap-3 text-[#c6bdb1]"><CircularProgress size={22} /> กำลังโหลดห้องเกม…</div>}
              {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}

              {view && <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-xl">ผู้เข้าพัก</h2>
                  <span className="text-sm text-[#c6bdb1]">{view.players.length}/{view.playerLimit} คน</span>
                </div>
                <div className="space-y-2">
                  {view.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#d9b66f]/15 bg-[#2c2422] px-4 py-3">
                      <div className="min-w-0">
                        <span className="mr-3 text-[#a9977d]">{player.seatIndex + 1}.</span>
                        <span className="wrap-break-word">{player.displayName}</span>
                        {player.id === view.hostPlayerId && <span className="ml-2 text-xs text-[#d9b66f]">เจ้าของห้อง</span>}
                        {player.id === playerId && <span className="ml-2 text-xs text-[#c6bdb1]">คุณ</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!player.connected && <span className="text-xs text-[#9f9486]">ออฟไลน์</span>}
                        <Chip size="small" label={player.ready ? "พร้อม" : "รอ"} color={player.ready ? "success" : "default"} />
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="mt-6!" variant={self?.ready ? "outlined" : "contained"} disabled={!self || !connected || busy} onClick={() => void act("lobby:ready", { ready: !self?.ready })}>
                  {self?.ready ? "ยกเลิกความพร้อม" : "พร้อมแล้ว"}
                </Button>
              </>}
            </Paper>
          </section>

          <aside className="space-y-6">
            <Paper className="border! border-[#d9b66f]/20! bg-[#211c1c]/95! p-5! sm:p-7!">
              <h2 className="font-serif text-xl">ตั้งค่าห้อง</h2>
              <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">เจ้าของห้องตั้งค่าจำนวนผู้เล่นและเวลาพูดคุยก่อนเริ่มเกม</p>
              {view && <div className="mt-5 space-y-4">
                <Stack spacing={2}>
                  <TextField size="small" select fullWidth label="จำนวนผู้เล่นสูงสุด" value={isHost ? playerLimit : view.playerLimit} onChange={(event) => setPlayerLimit(Number(event.target.value))} disabled={!isHost || busy}>
                    {[5, 6, 7, 8, 9, 10].map((count) => <MenuItem key={count} value={count}>{count} คน</MenuItem>)}
                  </TextField>
                  <TextField size="small" type="number" fullWidth label="เวลาพูดคุย (วินาที)" value={isHost ? discussionSeconds : view.discussionSeconds} onChange={(event) => setDiscussionSeconds(Number(event.target.value))} disabled={!isHost || busy} slotProps={{ htmlInput: { min: 30, max: 600 } }} />
                  {isHost && <Button fullWidth variant="outlined" disabled={busy || !connected || playerLimit < view.players.length} onClick={() => void act("lobby:configure", { playerLimit, discussionSeconds })}>บันทึกการตั้งค่า</Button>}
                </Stack>
              </div>}
            </Paper>
            <Paper className="border! border-[#d9b66f]/20! bg-[#211c1c]/95! p-5! sm:p-7!">
              <h2 className="font-serif text-xl">สถานะเกม</h2>
              <p className="mt-3 text-sm leading-7 text-[#c6bdb1]">ต้องมีผู้เล่นอย่างน้อย 5 คน และทุกคนกดพร้อม</p>
              <p className="mt-4 text-sm text-[#d9b66f]">{view?.canStart ? "ทุกคนพร้อมแล้ว" : "รอผู้เล่นและความพร้อม"}</p>
              {isHost && view?.canStart && <Button className="mt-4!" fullWidth variant="contained" disabled={busy || !connected} onClick={() => void (async () => { setBusy(true); const response = await requestLobby<{ version: number }>(socketRef.current!, "game:start", { actionId: createActionId(), expectedVersion: view.version }); if (!response.ok) setError(lobbyErrorMessage(response.error)); setBusy(false); })()}>เริ่มเกม</Button>}
            </Paper>
          </aside>
        </div>
      </div>
    </main>
  );
}
