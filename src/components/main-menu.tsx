"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useUiStore } from "@/stores/use-ui-store";
import { ActiveRooms } from "@/components/lobby/active-rooms";
import { readGuestProfile, readLobbyToken } from "@/lib/lobby-client";
import { AVATARS, avatarById, type AvatarId } from "@/lib/avatars";
import { avatarEnglish } from "@/lib/avatar-translations";
import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";
import { primeGameAudio } from "@/lib/game-sound";
import { startHomeAmbience } from "@/lib/home-ambience";

const LobbyEntryDialog = dynamic(() => import("@/components/lobby/lobby-entry-dialog").then((module) => module.LobbyEntryDialog));
const RoleBook = dynamic(() => import("@/components/role-book").then((module) => module.RoleBook));

function subscribeToProfile(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function profileNameSnapshot() { return readGuestProfile()?.displayName ?? ""; }

export function AvatarGallery({ onSelect }: { onSelect: (avatarId: AvatarId) => void }) {
  const en = useLanguage() === "en";
  return <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
    {AVATARS.map((avatar) => <button
      key={avatar.id}
      type="button"
      aria-label={en ? `View ${avatarEnglish[avatar.id].name}` : `ดูตัวละคร${avatar.name}`}
      onClick={() => onSelect(avatar.id)}
      className="group relative overflow-hidden rounded-lg border border-[#e5bd82]/30 bg-[#211727]/85 text-left shadow-[0_12px_35px_rgba(0,0,0,.5)] transition-colors hover:border-[#e5bd82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5bd82]"
    >
      <div className="relative aspect-4/5 w-full overflow-hidden" style={{ backgroundImage: `radial-gradient(circle at 50% 35%, ${avatar.color}99, #211727 75%)` }}><Image src={avatar.portrait} alt={en ? avatarEnglish[avatar.id].name : avatar.name} fill sizes="(max-width: 640px) 45vw, 125px" quality={65} className="object-cover object-top transition-transform duration-500 group-hover:scale-105" /></div>
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#100d1a] via-[#100d1a]/75 to-transparent px-1 pb-1.5 pt-6 text-center text-[10px] font-semibold leading-tight text-[#f5e4cf] sm:px-2 sm:pb-2 sm:text-xs">{en ? avatarEnglish[avatar.id].name : avatar.name}</span>
    </button>)}
  </div>;
}

export function AvatarDetail({ avatarId }: { avatarId: AvatarId }) {
  const avatar = avatarById(avatarId)!;
  const en = useLanguage() === "en";
  const english = avatarEnglish[avatarId];
  return <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
    <div className="relative h-80 shrink-0 overflow-hidden rounded-xl border border-[#d9b66f]/25 bg-[radial-gradient(circle_at_50%_30%,#493447,#17131e_70%)] sm:h-[29rem] sm:w-[45%]">
      <Image src={avatar.image} alt={en ? `Full-body portrait of ${english.name}` : `ภาพเต็มตัว${avatar.name}`} fill sizes="(max-width: 640px) 100vw, 360px" className="object-contain object-bottom p-3" />
    </div>
    <div className="min-w-0 self-center pb-2 sm:py-5">
      <p className="text-xs tracking-[.22em] text-[#d9b66f]">{en ? `${english.occupation} · Age ${avatar.age} · ${english.origin}` : `${avatar.occupation} · อายุ ${avatar.age} ปี · ${avatar.origin}`}</p>
      <h3 className="mt-3 font-serif text-3xl text-[#f8f1e4]">{en ? english.name : avatar.name}</h3>
      <h4 className="mt-7 text-sm font-semibold text-[#e7ce98]">{en ? "Story" : "เรื่องราว"}</h4>
      <p className="mt-2 leading-7 text-[#ddd4ca]">{en ? english.introduction : avatar.introduction}</p>
      <p className="mt-7 text-sm leading-7 text-[#c6bdb1]">{en ? "Characters, secret roles, and skills are assigned randomly when the game starts. Nobody knows who will play which character beforehand." : "ตัวละคร บทบาท และสกิลลับจะสุ่มเมื่อเริ่มเกม ก่อนหน้านั้นไม่มีใครรู้ว่าใครจะได้ตัวละครใด"}</p>
    </div>
  </div>;
}

export function MainMenu() {
  const en = useLanguage() === "en";
  const [muted, setMuted] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try { setMuted(localStorage.getItem("hotel-game-muted") === "true"); } catch { setMuted(false); }
      setSoundReady(true);
    }, 0);
    window.addEventListener("pointerdown", primeGameAudio, { once: true });
    window.addEventListener("keydown", primeGameAudio, { once: true });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pointerdown", primeGameAudio);
      window.removeEventListener("keydown", primeGameAudio);
    };
  }, []);
  useEffect(() => {
    if (!soundReady || muted) return;
    let stop: (() => void) | null = null;
    const sync = () => {
      stop?.();
      stop = document.hidden ? null : startHomeAmbience();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => { document.removeEventListener("visibilitychange", sync); stop?.(); };
  }, [soundReady, muted]);
  const profileName = useSyncExternalStore(subscribeToProfile, profileNameSnapshot, () => "");
  const [entryMode, setEntryMode] = useState<"create" | "join" | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const [initialSavedSeat, setInitialSavedSeat] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId | null>(null);
  const aboutOpen = useUiStore((state) => state.aboutOpen);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);

  const openEntry = (mode: "create" | "join", code = "") => {
    setInitialDisplayName(readGuestProfile()?.displayName ?? "");
    setInitialSavedSeat(mode === "join" && Boolean(readLobbyToken(code)));
    setSelectedCode(code);
    setEntryMode(mode);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#10101b] text-[#f8f1e4]">
      <div className="pointer-events-none absolute inset-0"><Image src="/art/hotel-night.webp" alt="" fill priority sizes="100vw" className="object-cover object-[62%_center]" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,11,23,.97)_0%,rgba(13,11,23,.86)_35%,rgba(13,11,23,.26)_75%),linear-gradient(0deg,rgba(13,11,23,.9),transparent_48%)]" /></div>
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9b66f]/20 pb-5">
          <div className="flex items-center gap-3 text-[#e7ce98]">
            <span aria-hidden="true" className="text-2xl">✧</span>
            <span className="text-sm font-bold tracking-[0.12em]">{en ? "Who Killed Tonight?" : "คืนนี้ใครฆ่า..."}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {profileName && <span className="flex max-w-full items-center gap-1 rounded-full border border-[#d9b66f]/30 px-3 py-1 text-xs text-[#e7ce98]">{en ? "Player" : "ผู้เล่น"}: <span className="min-w-0 max-w-[150px] truncate" title={profileName}>{profileName}</span></span>}
            <LanguageSwitcher />
            <Button color="primary" variant="text" size="small" aria-label={muted ? en ? "Turn on ambience" : "เปิดเสียงบรรยากาศ" : en ? "Mute ambience" : "ปิดเสียงบรรยากาศ"} onClick={() => { const next = !muted; setMuted(next); try { localStorage.setItem("hotel-game-muted", String(next)); } catch {} if (!next) primeGameAudio(); }}>{muted ? en ? "Sound on" : "เปิดเสียง" : en ? "Sound off" : "ปิดเสียง"}</Button>
            <Button color="primary" variant="text" size="small" onClick={() => setAboutOpen(true)}>{en ? "How to play" : "วิธีเล่น"}</Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <section className="relative z-10 max-w-xl">
            <Chip label={en ? "WHO IS MURDERED · ONLINE MYSTERY" : "WHO IS MURDERED · เกมสืบสวนออนไลน์"} color="primary" variant="outlined" size="small" className="mb-6! bg-[#171324]/70!" />
            <p className="mb-6 text-sm tracking-[0.34em] text-[#e5bd82]">{en ? "WELCOME TO THE HOTEL" : "ยินดีต้อนรับสู่โรงแรม"}</p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {en ? "Who Killed" : "คืนนี้"}<br /><span className="text-[#d9b66f]">{en ? "Tonight?" : "ใครฆ่า..."}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#c6bdb1] sm:text-lg">
              {en ? "Every guest has a secret. One is the Assassin. Uncover the truth before the final night." : "แขกทุกคนมีความลับ หนึ่งคนคือนักฆ่า ร่วมสืบหาความจริงก่อนจะถึงคืนสุดท้าย"}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="contained" size="large" onClick={() => openEntry("create")} className="px-8! py-3!">{en ? "Create room" : "สร้างห้องเกม"}</Button>
              {/* <Button variant="outlined" size="large" onClick={() => openEntry("join")} className="px-8! py-3!">เข้าร่วมห้อง</Button> */}
            </div>
            {/* <p className="mt-5 text-sm text-[#c9b8ae]">รองรับผู้เล่น 5–10 คน · ใช้เวลาสูงสุด 4 รอบ</p> */}
            <ActiveRooms onJoin={(code) => openEntry("join", code)} />
          </section>

          <section aria-label={en ? "Hotel characters" : "ตัวละครในโรงแรม"} className="relative mx-auto w-full max-w-xl lg:mt-20">
            <div className="absolute -inset-8 rounded-full bg-[#8c3b47]/20 blur-3xl" />
            <AvatarGallery onSelect={setSelectedAvatar} />
            <p className="relative mt-4 text-center text-xs tracking-[.25em] text-[#e5bd82]">{en ? "12 CHARACTERS · UP TO 27 ROOMS · UNTOLD SECRETS" : "12 ตัวละคร · สูงสุด 27 ห้อง · ความลับที่ไม่มีใครบอก"}</p>
            <p className="relative mt-2 text-center text-xs text-[#c6bdb1]">{en ? "Select a portrait to read their story. Characters are assigned when the game begins." : "แตะภาพเพื่ออ่านเรื่องราว ระบบจะสุ่มตัวละครเมื่อเริ่มเกม"}</p>
          </section>
        </div>
        <footer className="border-t border-[#d9b66f]/20 pt-5 text-center text-xs text-[#8f8579] sm:text-left">
          {en ? "A secret lies behind every door." : "ความลับอยู่หลังประตูทุกบาน"}
        </footer>
      </div>
      <Dialog open={selectedAvatar !== null} onClose={() => setSelectedAvatar(null)} fullWidth maxWidth="md" aria-labelledby="character-detail-title" slotProps={{ paper: { className: "bg-[#1b1720]! text-[#f8f1e4]!" } }}>
        {selectedAvatar && <><DialogTitle id="character-detail-title" className="font-serif! text-2xl!">{en ? avatarEnglish[selectedAvatar].name : avatarById(selectedAvatar)?.name}</DialogTitle><DialogContent dividers className="border-[#d9b66f]/20! p-5! sm:p-7!"><AvatarDetail avatarId={selectedAvatar} /></DialogContent><DialogActions><Button onClick={() => setSelectedAvatar(null)}>{en ? "Close" : "ปิด"}</Button></DialogActions></>}
      </Dialog>
      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>{en ? "How to play" : "วิธีเล่น"}</DialogTitle>
        <DialogContent dividers className="space-y-7! leading-7!">
          <section aria-labelledby="how-to-play-overview">
            <h2 id="how-to-play-overview" className="font-serif text-xl text-[#d9b66f]">{en ? "Getting started" : "เริ่มเกม"}</h2>
            <p className="mt-2">{en ? "Five to ten connected players join a lobby. Everyone must be ready before the host can start. The host sets the player limit, discussion time, and selects Innocent roles equal to the maximum player count minus two. The game draws the roles needed for the players present. At most two game rooms can be active at once." : "ผู้เล่น 5–10 คนเข้าห้องรอ ทุกคนต้องเชื่อมต่อและกดพร้อมก่อนเจ้าของห้องเริ่มเกมได้ เจ้าของห้องตั้งจำนวนผู้เล่น เวลาพูดคุย และเลือกบทบาทผู้บริสุทธิ์ตามจำนวนผู้เล่นสูงสุดลบสอง โดยระบบสุ่มบทบาทเท่าจำนวนคนที่เริ่มเกม เปิดห้องเกมพร้อมกันได้สูงสุด 2 ห้อง"}</p>
            <p className="mt-2">{en ? "When the game starts, the server randomly assigns each player a public character, one of the selected secret roles, and one unique room. There are five floors for five players, seven floors for six to nine players, and nine floors for ten players, with three rooms per floor. A character's appearance never reveals their role or team." : "เมื่อเริ่มเกม ระบบสุ่มตัวละครสาธารณะ บทบาทลับจากชุดที่เลือก และห้องพักที่ไม่ซ้ำกันให้แต่ละคน โรงแรมมี 5 ชั้นเมื่อเล่น 5 คน, 7 ชั้นเมื่อเล่น 6–9 คน และ 9 ชั้นเมื่อเล่น 10 คน แต่ละชั้นมี 3 ห้อง รูปลักษณ์ตัวละครไม่บอกบทบาทหรือฝ่าย"}</p>
            <p className="mt-2">{en ? "The story prologue lasts 30 seconds. During it, you may choose to reveal only your own role, room, and skill. Afterward, three empty rooms reveal mysterious traces; no one dies from these starting clues." : "คำเกริ่นเรื่องใช้เวลา 30 วินาที ระหว่างนั้นคุณเลือกเปิดดูบทบาท ห้องพัก และสกิลของตนเองได้ จากนั้นระบบเผยร่องรอยปริศนาในห้องว่าง 3 ห้อง โดยไม่มีใครเสียชีวิตจากเบาะแสเริ่มต้น"}</p>
          </section>
          <section aria-labelledby="how-to-play-turns">
            <h2 id="how-to-play-turns" className="font-serif text-xl text-[#d9b66f]">{en ? "Each turn" : "หนึ่งรอบเล่นอย่างไร"}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>{en ? <><strong>Skills:</strong> Living players act in the Role Book order. Each interactive slot uses the host&apos;s discussion time setting and shows a personal prompt. Choose a target on the map or guest list, then confirm. The Receptionist and Photographer resolve automatically on turn 3; dead or blacked-out players are skipped.</> : <><strong>ใช้สกิล:</strong> ผู้เล่นที่ยังมีชีวิตใช้สกิลตามลำดับใน Role Book คิวที่ต้องกดใช้มีเวลาเท่ากับเวลาพูดคุยที่เจ้าของห้องตั้งไว้ และแสดงข้อความแจ้งเฉพาะตัว เลือกเป้าหมายบนแผนผังหรือรายชื่อผู้เข้าพักแล้วกดยืนยัน พนักงานต้อนรับและช่างภาพทำงานอัตโนมัติในเทิร์นที่ 3 ส่วนผู้ตายหรืออยู่บนชั้นไฟดับจะข้ามคิว</>}</li>
              <li>{en ? <><strong>Discussion:</strong> Share clues in the public chat. The default is 180 seconds; the host can choose 30–420 seconds in 30-second steps before the game.</> : <><strong>พูดคุย:</strong> แลกเปลี่ยนเบาะแสในแชทสาธารณะ เวลาปกติ 180 วินาที เจ้าของห้องเลือกได้ 30–420 วินาที เพิ่มครั้งละ 30 วินาทีก่อนเริ่มเกม</>}</li>
              <li>{en ? <><strong>Voting:</strong> Each living player votes for an eligible room other than their own and may change that vote until the 60-second deadline. The latest vote counts when time runs out, even if everyone voted earlier. Everyone sees each voter&apos;s current choice and the live vote count. Clue, murdered, and previously opened rooms are excluded; a locked room is still eligible. A tie triggers one 60-second runoff. If the runoff ties, or nobody votes, the game chooses randomly among eligible candidates.</> : <><strong>ลงคะแนน:</strong> ผู้เล่นที่ยังมีชีวิตโหวตห้องที่เลือกได้ ยกเว้นห้องตัวเอง และเปลี่ยนคะแนนได้จนหมดเวลา 60 วินาที ระบบใช้คะแนนล่าสุดเมื่อนาฬิกาหมด แม้ทุกคนโหวตแล้ว ทุกคนเห็นคะแนนปัจจุบันของแต่ละคนและจำนวนโหวตบนห้อง ห้องร่องรอย ห้องฆาตกรรม และห้องที่เปิดแล้วเลือกไม่ได้ แต่ห้องที่ล็อกยังโหวตได้ หากเสมอมีรอบตัดสินอีก 60 วินาที; ถ้ายังเสมอหรือไม่มีใครโหวต ระบบสุ่มจากห้องที่มีสิทธิ์</>}</li>
              <li>{en ? <><strong>Room result:</strong> The chosen room opens. A living occupant dies; an empty room has no victim. If the game continues, the result stays on screen for six seconds before the next turn.</> : <><strong>ผลการเปิดห้อง:</strong> ระบบเปิดห้องที่ได้รับเลือก หากมีผู้พักที่ยังมีชีวิตคนนั้นจะเสียชีวิต หากห้องว่างจะไม่มีเหยื่อ ถ้าเกมยังไม่จบจะแสดงผล 6 วินาทีก่อนเริ่มเทิร์นถัดไป</>}</li>
            </ol>
            <p className="mt-3">{en ? "There are at most four turns. If the Killer dies, Innocents win immediately. Murderers win immediately when their living count equals or exceeds the Innocents, or if the Killer survives through turn four. The final reveal shows every role, team, room, and survivor." : "เกมมีสูงสุด 4 เทิร์น หากนักฆ่าเสียชีวิต ฝ่ายผู้บริสุทธิ์ชนะทันที ฝ่ายฆาตกรชนะทันทีเมื่อจำนวนคนที่ยังมีชีวิตเท่ากับหรือมากกว่าฝ่ายผู้บริสุทธิ์ หรือเมื่อนักฆ่ารอดจนจบเทิร์นที่ 4 ตอนจบเกมจะเฉลยบทบาท ฝ่าย ห้องพัก และสถานะของทุกคน"}</p>
          </section>
          {aboutOpen && <RoleBook language={en ? "en" : "th"} />}
          <section aria-labelledby="how-to-play-death">
            <h2 id="how-to-play-death" className="font-serif text-xl text-[#d9b66f]">{en ? "After death" : "เมื่อเสียชีวิต"}</h2>
            <p className="mt-2">{en ? "You may keep watching the board, public events, discussion, and voting results, but cannot use skills, vote, or see anyone else's private information." : "ยังรับชมกระดาน เหตุการณ์สาธารณะ การพูดคุย และผลโหวตได้ แต่ใช้สกิลหรือลงคะแนนไม่ได้ และจะไม่เห็นข้อมูลลับของผู้อื่น"}</p>
            <p className="mt-2 font-semibold">{en ? "After death, stop sharing game information immediately, even if you continue watching." : "ผู้เล่นที่เสียชีวิตแล้วต้องหยุดให้ข้อมูลเกี่ยวกับเกมทันที แม้จะยังสามารถรับชมเกมต่อได้"}</p>
          </section>
        </DialogContent>
        <DialogActions><Button onClick={() => setAboutOpen(false)}>{en ? "Close" : "ปิด"}</Button></DialogActions>
      </Dialog>
      {entryMode && <LobbyEntryDialog key={`${entryMode}-${selectedCode}`} mode={entryMode} initialCode={selectedCode} initialDisplayName={initialDisplayName} initialSavedSeat={initialSavedSeat} onClose={() => setEntryMode(null)} />}
    </main>
  );
}
