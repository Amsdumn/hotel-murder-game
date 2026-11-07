"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Alert, AlertTitle, Button, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, TextField } from "@mui/material";
import type { Socket } from "socket.io-client";
import { acceptNewerLobbyState, connectLobbySocket, forgetLobbyIdentity, lobbyErrorMessage, readLobbyToken, requestLobby, saveGuestProfile, saveLobbyIdentity } from "@/lib/lobby-client";
import type { InnocentRoleMode, LobbyIdentity, LobbyView } from "@/types/lobby";
import type { GameResultState, PrivatePlayerState, PublicGameState, VersionedTeamState } from "@/types/game";
import { createActionId } from "@/lib/action-id";
import { requiredInnocentRoleCount } from "@/lib/game-balance";
import { acceptNewerGameState } from "@/lib/game-state-version";
import { primeGameAudio } from "@/lib/game-sound";
import { mediaUrl } from "@/lib/media-url";
import { addLocalTestBots, canUseLocalBots, localBotCount } from "@/lib/local-test-bots";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";
import { roleNames, roleNamesEn } from "@/components/role-portrait";
import { INNOCENT_ROLES, type Role } from "@/types/game";
import type { Language } from "@/lib/language";

export function InnocentRoleSettings({ mode, language, selected, requiredCount, onModeChange, onToggle }: { mode: InnocentRoleMode; language: Language; selected: Role[]; requiredCount: number; onModeChange?: (mode: InnocentRoleMode) => void; onToggle?: (role: Role) => void }) {
  const en = language === "en";
  return <section aria-label={en ? "Innocent roles" : "บทบาทฝ่ายผู้บริสุทธิ์"}>
    <h3 className="text-sm font-semibold text-[#f2d79c]">{en ? "Choose Innocent roles" : "เลือกบทบาทฝ่ายผู้บริสุทธิ์"}</h3>
    <div role="radiogroup" aria-label={en ? "Innocent role selection mode" : "วิธีเลือกบทบาทผู้บริสุทธิ์"} className="mt-3 grid gap-2 sm:grid-cols-2">
      {(["CUSTOM", "RANDOM"] as const).map((option) => <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm ${mode === option ? "border-[#f2d79c] bg-[#493947] text-[#f2d79c]" : "border-[#d9b66f]/25 bg-[#29202b] text-[#e8dfd5]"} ${!onModeChange ? "cursor-default opacity-75" : ""}`}>
        <input type="radio" name="innocent-role-mode" value={option} checked={mode === option} disabled={!onModeChange} onChange={() => onModeChange?.(option)} className="accent-[#f2d79c]" />
        {option === "CUSTOM" ? en ? "Choose roles yourself" : "กำหนดเอง" : en ? "Let the system choose" : "สุ่มตามระบบ"}
      </label>)}
    </div>
    {mode === "CUSTOM" ? <>
      <p className="mt-3 text-xs leading-5 text-[#c6bdb1]">{en ? `Select ${requiredCount} roles for the maximum player count (${selected.length} selected). The Assassin is always included; the Accomplice joins games with six or more players. The remaining roles are drawn randomly from your selection.` : `เลือก ${requiredCount} บทบาทตามจำนวนผู้เล่นสูงสุด (เลือกแล้ว ${selected.length}) นักฆ่าอยู่ในเกมเสมอ ส่วนผู้สมรู้ร่วมคิดจะเข้าร่วมเมื่อมีผู้เล่นตั้งแต่ 6 คนขึ้นไป ระบบสุ่มบทบาทที่เหลือจากชุดที่เลือก`}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">{INNOCENT_ROLES.map((role) => {
      const active = selected.includes(role);
      const className = `rounded-lg border px-3 py-2 text-left text-sm ${active ? "border-[#f2d79c] bg-[#493947] text-[#f2d79c]" : "border-[#d9b66f]/25 bg-[#29202b] text-[#e8dfd5]"}`;
      return onToggle ? <button key={role} type="button" aria-pressed={active} disabled={!active && selected.length >= requiredCount} className={`${className} enabled:hover:border-[#f2d79c] focus-visible:outline-2 focus-visible:outline-[#f2d79c] disabled:cursor-not-allowed disabled:opacity-45`} onClick={() => onToggle(role)}>{en ? roleNamesEn[role] : roleNames[role]}</button>
        : <span key={role} className={className}>{en ? roleNamesEn[role] : roleNames[role]}</span>;
      })}</div>
    </> : <p className="mt-3 text-xs leading-5 text-[#c6bdb1]">{en ? "The system draws distinct Innocent roles when the game starts. The Assassin is always included; the Accomplice joins games with six or more players." : "ระบบจะสุ่มบทบาทผู้บริสุทธิ์ที่ไม่ซ้ำกันตอนเริ่มเกม นักฆ่าอยู่ในเกมเสมอ และผู้สมรู้ร่วมคิดจะเข้าร่วมเมื่อมีผู้เล่นตั้งแต่ 6 คนขึ้นไป"}</p>}
  </section>;
}

function GameLoadingScreen() {
  const en = useLanguage() === "en";
  return <main role="status" className="flex min-h-screen items-center justify-center bg-[#11101b] px-5 text-[#f8f1e4]">{en ? "Loading game…" : "กำลังโหลดเกม…"}</main>;
}

const GameScreen = dynamic(() => import("@/components/game/game-screen").then((module) => module.GameScreen), {
  loading: () => <GameLoadingScreen />,
});

export function LobbyScreen({ code }: { code: string }) {
  const localBotsEnabled = useSyncExternalStore(() => () => {}, () => canUseLocalBots(window.location.hostname, process.env.NODE_ENV), () => false);
  const [addingBots, setAddingBots] = useState(false);
  const [botCount, setBotCount] = useState(() => localBotCount(code));
  useEffect(() => {
    window.addEventListener("pointerdown", primeGameAudio, { once: true });
    window.addEventListener("keydown", primeGameAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", primeGameAudio);
      window.removeEventListener("keydown", primeGameAudio);
    };
  }, []);
  const language = useLanguage();
  const en = language === "en";
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const socketRef = useRef<Socket | null>(null);
  const [view, setView] = useState<LobbyView | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [playerLimit, setPlayerLimit] = useState(10);
  const [discussionSeconds, setDiscussionSeconds] = useState(180);
  const [selectedInnocentRoles, setSelectedInnocentRoles] = useState<Role[]>([]);
  const [innocentRoleMode, setInnocentRoleMode] = useState<InnocentRoleMode>("CUSTOM");
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[] | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [versionedTeamState, setVersionedTeamState] = useState<VersionedTeamState | null>(null);
  const [result, setResult] = useState<GameResultState | null>(null);
  const [murderSequence, setMurderSequence] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    const socket = connectLobbySocket(false);
    socketRef.current = socket;
    let disposed = false;
    let resuming = false;
    let retryTimer: number | null = null;
    const onState = (next: LobbyView) => setView((current) => acceptNewerLobbyState(current, next));
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
          setError(languageRef.current === "en" ? "No room access found. Join from the home page." : "ไม่พบสิทธิ์เข้าห้อง กรุณาเข้าร่วมจากหน้าแรก");
          return;
        }
        const result = await requestLobby<LobbyIdentity>(socket, "lobby:resume", { code, token: currentToken });
        if (result.ok) saveLobbyIdentity(result.data);
        if (disposed || !socket.connected) return;
        if (!result.ok) {
          setError(lobbyErrorMessage(result.error, languageRef.current));
          if (result.error === "SERVER_UNAVAILABLE" && retryTimer === null) {
            retryTimer = window.setTimeout(() => { retryTimer = null; void onConnect(); }, 3000);
          }
          return;
        }
        setConnected(true);
        setPlayerId(result.data.playerId);
        setView((current) => acceptNewerLobbyState(current, result.data.view));
        setOnlinePlayerIds((current) => current ?? result.data.view.players.filter((player) => player.connected).map((player) => player.id));
        setPlayerLimit(result.data.view.playerLimit);
        setDiscussionSeconds(result.data.view.discussionSeconds);
        setSelectedInnocentRoles(result.data.view.selectedInnocentRoles);
        setInnocentRoleMode(result.data.view.innocentRoleMode);
        setError("");
      } finally {
        resuming = false;
      }
    };
    const onDisconnect = (reason: string) => {
      setConnected(false);
      setError(reason === "io server disconnect" ? languageRef.current === "en" ? "This room was opened in another tab or device. Join again from home." : "ห้องนี้ถูกเปิดจากแท็บหรืออุปกรณ์อื่น กรุณาเข้าร่วมใหม่จากหน้าแรก" : languageRef.current === "en" ? "Connection lost. Reconnecting…" : "การเชื่อมต่อขาด กำลังเชื่อมต่อใหม่…");
    };
    const onConnectError = () => setError(languageRef.current === "en" ? "Cannot connect to the server. Retrying…" : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองอีกครั้ง…");
    const onGameState = (next: PublicGameState) => setGameState((current) => acceptNewerGameState(current, next));
    const onGamePresence = (next: { onlinePlayerIds: string[] }) => setOnlinePlayerIds(next.onlinePlayerIds);
    const onPrivateState = (next: PrivatePlayerState) => setPrivateState((current) => acceptNewerGameState(current, next));
    const onTeamState = (next: VersionedTeamState) => setVersionedTeamState((current) => acceptNewerGameState(current, next));
    const onResult = (next: GameResultState) => setResult(next);
    const onGameEvent = (event: { type: string }) => { if (event.type === "MURDER_OCCURRED") setMurderSequence((value) => value + 1); };
    const onKicked = () => { forgetLobbyIdentity(code); setKicked(true); socket.disconnect(); };
    socket.on("lobby:state", onState);
    socket.on("game:state", onGameState);
    socket.on("game:presence", onGamePresence);
    socket.on("game:private", onPrivateState);
    socket.on("game:team", onTeamState);
    socket.on("game:result", onResult);
    socket.on("game:event", onGameEvent);
    socket.on("lobby:kicked", onKicked);
    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.connect();
    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket.off("lobby:state", onState);
      socket.off("game:state", onGameState);
      socket.off("game:presence", onGamePresence);
      socket.off("game:private", onPrivateState);
      socket.off("game:team", onTeamState);
      socket.off("game:result", onResult);
      socket.off("game:event", onGameEvent);
      socket.off("lobby:kicked", onKicked);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  async function act(event: "lobby:ready" | "lobby:configure" | "lobby:rename" | "lobby:kick", payload: Record<string, unknown>) {
    const socket = socketRef.current;
    if (!socket || !view) return;
    setBusy(true);
    setError("");
    const result = await requestLobby<LobbyView>(socket, event, { ...payload, actionId: createActionId(), expectedVersion: view.version });
    if (result.ok) {
      setView((current) => acceptNewerLobbyState(current, result.data));
      if (event === "lobby:configure") {
        setSelectedInnocentRoles(result.data.selectedInnocentRoles);
        setInnocentRoleMode(result.data.innocentRoleMode);
      }
      if (event === "lobby:rename") { saveGuestProfile(String(payload.displayName).trim()); setEditingName(false); }
    }
    else setError(lobbyErrorMessage(result.error, language));
    setBusy(false);
  }

  const self = view?.players.find((player) => player.id === playerId);
  const isHost = view?.hostPlayerId === playerId;
  const settingsDirty = !!isHost && !!view && (playerLimit !== view.playerLimit || discussionSeconds !== view.discussionSeconds || innocentRoleMode !== view.innocentRoleMode || selectedInnocentRoles.join(",") !== view.selectedInnocentRoles.join(","));
  const visibleOnlinePlayerIds = (onlinePlayerIds ?? view?.players.filter((player) => player.connected).map((player) => player.id) ?? []).filter((id) => connected || id !== playerId);

  async function startGame() {
    if (!view || !socketRef.current) return;
    setBusy(true);
    const response = await requestLobby<{ version: number }>(socketRef.current, "game:start", { actionId: createActionId(), expectedVersion: view.version });
    if (!response.ok) setError(lobbyErrorMessage(response.error, language));
    setBusy(false);
  }

  if (kicked) return <main className="flex min-h-screen items-center justify-center bg-[#12111c] px-5 text-[#f8f1e4]"><Paper className="max-w-md border! border-[#d9b66f]/30! bg-[#211c1c]! p-8! text-center"><h1 className="font-serif text-2xl">{en ? "You were removed from this room" : "คุณถูกนำออกจากห้องนี้"}</h1><p className="mt-3 text-sm text-[#c6bdb1]">{en ? "The host removed you before the game started." : "เจ้าของห้องนำคุณออกจากห้องพักก่อนเริ่มเกม"}</p><Button className="mt-6!" component={Link} href="/" variant="contained">{en ? "Back to home" : "กลับหน้าแรก"}</Button></Paper></main>;

  if (gameState) return <GameScreen state={gameState} privateState={privateState} teamState={privateState?.isAlive ? versionedTeamState?.teamState ?? null : null} result={result} murderSequence={murderSequence} connected={connected} connectionMessage={error} onlinePlayerIds={visibleOnlinePlayerIds} onCommand={(event, payload, version) => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve({ ok: false, error: "SERVER_UNAVAILABLE" as const });
    return requestLobby<{ version: number }>(socket, event, { ...payload, actionId: createActionId(), expectedVersion: version });
  }} />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#12111c] px-5 py-8 text-[#f8f1e4] sm:px-10">
      <div className="pointer-events-none absolute inset-0"><Image src={mediaUrl("/art/hotel-night.webp")} alt="" fill sizes="100vw" className="object-cover object-center opacity-35" /><div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,17,28,.8),rgba(18,17,28,.94)_70%)]" /></div>
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#d9b66f]/25 pb-2">
          <div>
            <p className="text-sm tracking-[.22em] text-[#d9b66f]">{en ? "Who Killed Tonight?" : "คืนนี้ใครฆ่า..."}</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">{en ? "Waiting room" : "ห้องพักก่อนเริ่มเกม"}</h1>
            <p className="mt-2 text-sm text-[#c6bdb1]">{en ? "The guests are gathering before the hotel's secrets come to light." : "แขกทุกคนกำลังมารวมตัวกัน ก่อนความลับในโรงแรมจะเริ่มเปิดเผย"}</p>
          </div>
          <div className="flex items-center gap-2"><LanguageSwitcher /><Button component={Link} href="/" variant="text">{en ? "Back to home" : "กลับหน้าแรก"}</Button></div>
        </div>

        <Alert severity="warning" variant="outlined" className="mb-6! border-[#d9b66f]/50! bg-[#32291d]/95! text-[#f8f1e4]! [&_.MuiAlert-message]:w-full!">
          <div className="md:flex w-full flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 mb-4 md:mb-0">
              <AlertTitle className="font-serif! text-xl! text-[#f2d79c]!">{en ? "Game status" : "สถานะเกม"}</AlertTitle>
              <p className="text-sm leading-6 text-[#e8ddcb]">{en ? "At least five players must join, and everyone must be ready." : "ต้องมีผู้เล่นอย่างน้อย 5 คน และทุกคนกดพร้อม"}</p>
              <p className="text-sm font-medium text-[#f2d79c]">{settingsDirty ? en ? "Save your room settings before starting" : "บันทึกการตั้งค่าห้องก่อนเริ่มเกม" : view?.canStart ? en ? "Everyone is ready and the roles are set" : "ทุกคนพร้อมและกำหนดบทบาทแล้ว" : view && view.players.length >= 5 && view.innocentRoleMode === "CUSTOM" && view.selectedInnocentRoles.length !== requiredInnocentRoleCount(view.playerLimit) ? en ? `Save ${requiredInnocentRoleCount(view.playerLimit)} Innocent roles to start` : `เลือกและบันทึกบทบาทผู้บริสุทธิ์ ${requiredInnocentRoleCount(view.playerLimit)} บทบาทก่อนเริ่มเกม` : en ? "Waiting for players and readiness" : "รอผู้เล่นและความพร้อม"}</p>
              <p className="mt-2 text-xs text-[#c6bdb1]">{en ? "Everyone's character is assigned when the game begins." : "ตัวละครของทุกคนจะสุ่มพร้อมกันเมื่อเริ่มเกม"}</p>
            </div>
            <Button variant={self?.ready ? "outlined" : "contained"} disabled={!self || !connected || busy} onClick={() => void act("lobby:ready", { ready: !self?.ready })}>
              {self?.ready ? en ? "Not ready" : "ยกเลิกความพร้อม" : en ? "Ready" : "พร้อมแล้ว"}
            </Button>
            {isHost && view?.canStart && <Button className="ml-auto! hidden! shrink-0! lg:inline-flex!" variant="contained" disabled={busy || !connected || settingsDirty} onClick={() => void startGame()}>{en ? "Start game" : "เริ่มเกม"}</Button>}
          </div>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section>
            <Paper className="border! border-[#d9b66f]/20! bg-[#211c1c]/95! p-5! sm:p-7!">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-[#c6bdb1]">{en ? "Room code" : "รหัสห้อง"}</p>
                  <p className="mt-1 font-mono text-3xl tracking-[.18em] text-[#d9b66f]">{code}</p>
                </div>
                <Chip label={connected ? en ? "Connected" : "เชื่อมต่อแล้ว" : en ? "Connecting" : "กำลังเชื่อมต่อ"} color={connected ? "success" : "default"} variant="outlined" />
              </div>

              {!view && !error && <div className="flex items-center gap-3 text-[#c6bdb1]"><CircularProgress size={22} /> {en ? "Loading game room…" : "กำลังโหลดห้องเกม…"}</div>}
              {error && <p role="alert" className="mb-5 rounded-lg border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}

              {view && <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-xl">{en ? "Guests" : "ผู้เข้าพัก"}</h2>
                  <span className="text-sm text-[#c6bdb1]">{view.players.length}/{view.playerLimit} {en ? "players" : "คน"}</span>
                </div>
                <div className="space-y-2">
                  {view.players.map((player) => (
                    <div key={player.id} className="flex flex-col items-start justify-between gap-2 rounded-lg border border-[#d9b66f]/15 bg-[#2c2422] px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="min-w-0 flex items-center">
                          <span className="mr-3 text-[#a9977d]">
                            {player.seatIndex + 1}.
                          </span>
                          {player.id === playerId && editingName ? (
                            <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (draftName.trim().length >= 2) void act("lobby:rename", { displayName: draftName.trim() }); }}>
                              <TextField size="small" label={en ? "New player name" : "ชื่อผู้เล่นใหม่"} value={draftName} onChange={(event) => setDraftName(event.target.value)} slotProps={{ htmlInput: { maxLength: 256 } }} />
                              <IconButton type="submit" color="primary" size="small" disabled={busy || !connected || draftName.trim().length < 2} aria-label={en ? "Save name" : "บันทึกชื่อ"} title={en ? "Save name" : "บันทึกชื่อ"}>
                                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                              </IconButton>
                              <IconButton type="button" color="error" size="small" onClick={() => setEditingName(false)} aria-label={en ? "Cancel" : "ยกเลิก"} title={en ? "Cancel" : "ยกเลิก"}>
                                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5 19 19M19 5 5 19" /></svg>
                              </IconButton>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-block max-w-37.5 truncate align-bottom" title={player.displayName}>
                                {player.displayName}
                              </span>
                              {player.id === playerId && !editingName && <IconButton size="small" color="primary" disabled={busy} aria-label={en ? "Rename" : "แก้ชื่อ"} title={en ? "Rename" : "แก้ชื่อ"} onClick={() => { setDraftName(player.displayName); setEditingName(true); }}>
                                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" /></svg>
                              </IconButton>}
                            </div>
                          )}
                          
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {!player.connected && <span className="text-xs text-[#9f9486]">{en ? "Offline" : "ออฟไลน์"}</span>}
                        <Chip size="small" label={player.ready ? en ? "Ready" : "พร้อม" : en ? "Waiting" : "รอ"} color={player.ready ? "success" : "default"} />
                        
                        {isHost && player.id !== playerId && <IconButton size="small" color="error" disabled={busy || !connected} aria-label={en ? `Remove ${player.displayName}` : `ไล่ ${player.displayName} ออก`} title={en ? "Remove player" : "ไล่ผู้เล่นออก"} onClick={() => void act("lobby:kick", { playerId: player.id })}>
                          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M17 8l5 5m0-5-5 5" /></svg>
                        </IconButton>}
                        <Stack sx={{ textAlign: "right" }}>
                          {player.id === playerId && <span className="ml-2 text-xs text-[#c6bdb1]">{en ? "You" : "คุณ"}</span>}
                          {player.id === view.hostPlayerId && <span className="ml-2 text-xs text-[#d9b66f]">{en ? "Host" : "เจ้าของห้อง"}</span>}
                        </Stack>
                      </div>
                    </div>
                  ))}
                </div>
                {localBotsEnabled && isHost && view.players.length < view.playerLimit && <Button className="mt-6! ml-2!" variant="outlined" disabled={addingBots || busy || !connected} onClick={() => void (async () => {
                  setAddingBots(true);
                  try { await addLocalTestBots(code, view.playerLimit - view.players.length, setBotCount); }
                  catch { setError(en ? "Could not add test players. Try again." : "เพิ่มผู้เล่นทดสอบไม่สำเร็จ กรุณาลองใหม่"); }
                  finally { setAddingBots(false); }
                })()}>{addingBots ? en ? "Adding test players…" : "กำลังเพิ่มผู้เล่นทดสอบ…" : en ? `Fill with test players (${botCount} connected)` : `เพิ่มผู้เล่นทดสอบให้ครบ (${botCount} คนเชื่อมต่อ)`}</Button>}
              </>}
            </Paper>
          </section>

          <aside className="space-y-6">
            <Paper className="border! border-[#d9b66f]/20! bg-[#211c1c]/95! p-5! sm:p-7!">
              <h2 className="font-serif text-xl">{en ? "Room settings" : "ตั้งค่าห้อง"}</h2>
              <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "The host sets the player limit, discussion time, and how Innocent roles are chosen before the game starts." : "เจ้าของห้องตั้งค่าจำนวนผู้เล่น เวลาพูดคุย และวิธีเลือกบทบาทฝ่ายผู้บริสุทธิ์ก่อนเริ่มเกม"}</p>
              {view && <div className="mt-5 space-y-4">
                <Stack spacing={2}>
                  <TextField size="small" select fullWidth label={en ? "Maximum players" : "จำนวนผู้เล่นสูงสุด"} value={isHost ? playerLimit : view.playerLimit} onChange={(event) => setPlayerLimit(Number(event.target.value))} disabled={!isHost || busy}>
                    {[5, 6, 7, 8, 9, 10].map((count) => <MenuItem key={count} value={count}>{count} {en ? "players" : "คน"}</MenuItem>)}
                  </TextField>
                  <TextField size="small" select fullWidth label={en ? "Discussion time" : "เวลาพูดคุย"} value={isHost ? discussionSeconds : view.discussionSeconds} onChange={(event) => setDiscussionSeconds(Number(event.target.value))} disabled={!isHost || busy}>
                    {Array.from({ length: 14 }, (_, index) => (index + 1) * 30).map((seconds) => <MenuItem key={seconds} value={seconds}>{seconds < 60 ? en ? `${seconds} seconds` : `${seconds} วินาที` : seconds % 60 === 0 ? en ? `${seconds / 60} minutes` : `${seconds / 60} นาที` : en ? `${Math.floor(seconds / 60)} min 30 sec` : `${Math.floor(seconds / 60)} นาที 30 วินาที`}</MenuItem>)}
                  </TextField>
                  <InnocentRoleSettings mode={isHost ? innocentRoleMode : view.innocentRoleMode} language={language} selected={isHost ? selectedInnocentRoles : view.selectedInnocentRoles} requiredCount={requiredInnocentRoleCount(isHost ? playerLimit : view.playerLimit)} onModeChange={isHost && !busy ? setInnocentRoleMode : undefined} onToggle={isHost && !busy ? (role) => setSelectedInnocentRoles((roles) => roles.includes(role) ? roles.filter((item) => item !== role) : roles.length >= requiredInnocentRoleCount(playerLimit) ? roles : [...roles, role]) : undefined} />
                  {isHost && <Button fullWidth variant="outlined" disabled={busy || !connected || playerLimit < view.players.length || (innocentRoleMode === "CUSTOM" && selectedInnocentRoles.length > requiredInnocentRoleCount(playerLimit))} onClick={() => void act("lobby:configure", { playerLimit, discussionSeconds, innocentRoleMode, selectedInnocentRoles })}>{en ? "Save settings" : "บันทึกการตั้งค่า"}</Button>}
                  {isHost && view.canStart && <Button fullWidth className="lg:hidden!" variant="contained" disabled={busy || !connected || settingsDirty} onClick={() => void startGame()}>{en ? "Start game" : "เริ่มเกม"}</Button>}
                </Stack>
              </div>}
            </Paper>
          </aside>
        </div>
      </div>
    </main>
  );
}
