"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Chip } from "@mui/material";
import { connectLobbySocket, readLobbyToken, requestLobby } from "@/lib/lobby-client";
import type { PublicLobbySummary } from "@/types/lobby";
import { useLanguage } from "@/components/language-switcher";

export function ActiveRooms({ onJoin }: { onJoin: (code: string) => void }) {
  const en = useLanguage() === "en";
  const [rooms, setRooms] = useState<PublicLobbySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savedRooms, setSavedRooms] = useState<Set<string>>(new Set());
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    const socket = connectLobbySocket(false);
    let disposed = false;
    let refreshing = false;
    const refresh = async () => {
      if (disposed || refreshing || !socket.connected) return;
      refreshing = true;
      const result = await requestLobby<PublicLobbySummary[]>(socket, "lobby:list", undefined);
      refreshing = false;
      if (disposed) return;
      if (result.ok) {
        setRooms(result.data);
        setSavedRooms(new Set(result.data.filter((room) => readLobbyToken(room.code)).map((room) => room.code)));
        setError(false);
      } else setError(true);
      setLoading(false);
    };
    refreshRef.current = () => {
      if (!socket.connected) socket.connect();
      else void refresh();
    };
    const onDisconnect = () => { if (!disposed) setError(true); };
    const onConnectError = () => { if (!disposed) { setError(true); setLoading(false); } };
    socket.on("connect", refresh);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.connect();
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      socket.off("connect", refresh);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, []);

  return <section aria-labelledby="active-rooms-title" className="mt-4 rounded-xl border border-[#d9b66f]/25 bg-[#171321]/85 p-4 shadow-[0_16px_45px_rgba(0,0,0,.28)] sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs tracking-[.2em] text-[#d9b66f]">OPEN ROOMS</p><h2 id="active-rooms-title" className="mt-1 font-serif text-xl">{en ? "Available game rooms" : "ห้องเกมที่เปิดอยู่"}</h2></div>
      <Button size="small" variant="text" onClick={() => refreshRef.current()} aria-label={en ? "Refresh rooms" : "รีเฟรชรายการห้อง"}>{en ? "Refresh" : "รีเฟรช"}</Button>
    </div>
    {loading ? <p className="mt-4 text-sm text-[#c6bdb1]">{en ? "Loading rooms…" : "กำลังโหลดรายการห้อง…"}</p> : error ? <p className="mt-4 text-sm text-[#ffc7c7]">{en ? "Could not load rooms. Please refresh." : "โหลดรายการห้องไม่ได้ กรุณาลองรีเฟรช"}</p> : rooms.length === 0 ? <p className="mt-4 text-sm text-[#c6bdb1]">{en ? "No game rooms are open yet." : "ยังไม่มีห้องเกมที่เปิดอยู่"}</p> : <div className="mt-4 space-y-2">{rooms.map((room) => {
      const canResume = savedRooms.has(room.code);
      const canJoin = room.status === "WAITING" && room.playerCount < room.playerLimit;
      return <div key={room.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d9b66f]/20 bg-[#28202c] px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-mono text-lg font-semibold tracking-[.16em] text-[#f4dfbc]">
              {room.code}
            </p>
            <p className="mt-1 text-xs text-[#c6bdb1]">
              {en ? `${room.playerCount} players` : `ผู้เล่น ${room.playerCount} คน`}
            </p>
          </div>
          <Chip size="small" variant="outlined" color={canJoin ? "success" : "default"} label={room.status === "IN_PROGRESS" ? en ? "In progress" : "กำลังเล่น" : canJoin ? en ? "Waiting" : "รอผู้เล่น" : en ? "Full" : "ห้องเต็ม"} />
        </div>
        {canResume ? <Button component={Link} href={`/lobby/${room.code}`} size="small" variant="contained">{en ? "Resume" : "กลับเข้าห้อง"}</Button> : <Button size="small" variant="contained" disabled={!canJoin} onClick={() => onJoin(room.code)}>{en ? "Join" : "เข้าร่วม"}</Button>}
      </div>;
    })}</div>}
  </section>;
}
