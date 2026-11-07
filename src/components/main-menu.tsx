"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { HOME_AMBIENCE_SRC, startHomeAmbience } from "@/lib/home-ambience";
import { SoundToggleButton } from "@/components/sound-toggle-button";

const LobbyEntryDialog = dynamic(() => import("@/components/lobby/lobby-entry-dialog").then((module) => module.LobbyEntryDialog));
const RoleBook = dynamic(() => import("@/components/role-book").then((module) => module.RoleBook));

function subscribeToProfile(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function profileNameSnapshot() { return readGuestProfile()?.displayName ?? ""; }
function avatarAnimation(id: AvatarId) { return `/art/avatars/${id}.gif`; }

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
      <div className="relative aspect-4/5 w-full overflow-hidden" style={{ backgroundImage: `radial-gradient(circle at 50% 35%, ${avatar.color}99, #211727 75%)` }}>
        <Image src={avatar.portrait} alt={en ? avatarEnglish[avatar.id].name : avatar.name} fill sizes="(max-width: 640px) 45vw, 125px" quality={65} className="object-cover object-top transition-transform duration-500 group-hover:scale-105" />
      </div>
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#100d1a] via-[#100d1a]/75 to-transparent px-1 pb-1.5 pt-6 text-center text-[10px] font-semibold leading-tight text-[#f5e4cf] sm:px-2 sm:pb-2 sm:text-xs">{en ? avatarEnglish[avatar.id].name : avatar.name}</span>
    </button>)}
  </div>;
}

export function AvatarDetail({ avatarId }: { avatarId: AvatarId }) {
  const avatar = avatarById(avatarId)!;
  const en = useLanguage() === "en";
  const english = avatarEnglish[avatarId];
  return <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
    <div className="relative h-80 shrink-0 overflow-hidden rounded-xl border border-[#d9b66f]/25 bg-[radial-gradient(circle_at_50%_30%,#493447,#17131e_70%)] sm:h-116 sm:w-[45%]">
      <Image src={avatarAnimation(avatar.id)} alt={en ? `Animated full-body portrait of ${english.name}` : `ภาพเคลื่อนไหวเต็มตัว${avatar.name}`} fill sizes="(max-width: 640px) 100vw, 360px" unoptimized className="object-cover object-top" />
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
  const homeAudioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    window.addEventListener("pointerdown", primeGameAudio, { once: true });
    window.addEventListener("keydown", primeGameAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", primeGameAudio);
      window.removeEventListener("keydown", primeGameAudio);
    };
  }, []);
  useEffect(() => {
    const audio = homeAudioRef.current;
    if (!audio) return;
    if (muted) {
      audio.pause();
      return;
    }
    return startHomeAmbience(audio);
  }, [muted]);
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
      <audio ref={homeAudioRef} src={HOME_AMBIENCE_SRC} loop preload="auto" className="hidden" />
      {/* // Sound Effect by <a href="https://pixabay.com/users/simplesound-53070346/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=443327">SimpleSound</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=443327">Pixabay</a> */}
      <div className="pointer-events-none absolute inset-0">
        <Image src="/art/hotel-night.webp" alt="" fill priority sizes="100vw" className="object-cover object-[62%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,11,23,.97)_0%,rgba(13,11,23,.86)_35%,rgba(13,11,23,.26)_75%),linear-gradient(0deg,rgba(13,11,23,.9),transparent_48%)]" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-3 sm:px-10 lg:px-14">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9b66f]/20 pb-2">
          <div className="flex items-center gap-3 text-[#e7ce98]">
            <span aria-hidden="true" className="text-2xl">✧</span>
            <span className="text-sm font-bold tracking-[0.12em]">
              {en ? "Who Killed Tonight?" : "คืนนี้ใครฆ่า..."}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {profileName && <span className="flex max-w-full items-center gap-1 rounded-full border border-[#d9b66f]/30 px-3 py-1 text-xs text-[#e7ce98]">{en ? "Player" : "ผู้เล่น"}: <span className="min-w-0 max-w-37.5 truncate" title={profileName}>{profileName}</span></span>}
            <LanguageSwitcher />
            <SoundToggleButton muted={muted} onChange={(next) => { setMuted(next); if (!next) primeGameAudio(); }} />
            <Button color="primary" variant="text" size="small" onClick={() => setAboutOpen(true)}>
              {en ? "How to play" : "วิธีเล่น"}
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-2 lg:grid-cols-[1.05fr_.95fr] lg:py-4">
          <section className="relative z-10 max-w-xl">
            <Chip label={en ? "WHO IS MURDERED · ONLINE MYSTERY" : "WHO IS MURDERED · เกมสืบสวนออนไลน์"} color="primary" variant="outlined" size="small" className="mb-6! bg-[#171324]/70!" />
            <p className="mb-6 text-sm text-[#e5bd82]">
              {en ? "WELCOME TO THE HOTEL" : "ยินดีต้อนรับสู่โรงแรม"}
            </p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {en ? "Who Killed" : "คืนนี้"}<br />
              <span className="text-[#d9b66f]">
                {en ? "Tonight?" : "ใครฆ่า..."}
              </span>
            </h1>
            <p className="mt-3 max-w-lg text-base leading-6 text-[#c6bdb1] sm:text-lg">
              {en ? "Every guest has a secret. One is the Assassin. Uncover the truth before the final night." : "แขกทุกคนมีความลับ หนึ่งคนคือนักฆ่า ร่วมสืบหาความจริงก่อนจะถึงคืนสุดท้าย"}
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button variant="contained" size="large" onClick={() => openEntry("create")} className="px-8! py-3!">
                {en ? "Create room" : "สร้างห้องเกม"}
              </Button>
              {/* <Button variant="outlined" size="large" onClick={() => openEntry("join")} className="px-8! py-3!">เข้าร่วมห้อง</Button> */}
            </div>
            {/* <p className="mt-5 text-sm text-[#c9b8ae]">รองรับผู้เล่น 5–10 คน · ใช้เวลาสูงสุด 4 รอบ</p> */}
            <ActiveRooms onJoin={(code) => openEntry("join", code)} />
          </section>

          <section aria-label={en ? "Hotel characters" : "ตัวละครในโรงแรม"} className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 rounded-full bg-[#8c3b47]/20 blur-3xl" />
            <AvatarGallery onSelect={setSelectedAvatar} />
            <p className="relative mt-4 text-center text-[#e5bd82]">
              {en ? "12 CHARACTERS · UP TO 27 ROOMS · UNTOLD SECRETS" : "12 ตัวละคร · สูงสุด 27 ห้อง · ความลับที่ไม่มีใครบอก"}
            </p>
            <p className="relative mt-2 text-center text-xs text-[#c6bdb1]">
              {en ? "Select a portrait to read their story. Characters are assigned when the game begins." : "แตะภาพเพื่ออ่านเรื่องราว ระบบจะสุ่มตัวละครเมื่อเริ่มเกม"}
            </p>
          </section>
        </div>
        <footer className="border-t border-[#d9b66f]/20 pt-3 text-center text-xs text-[#8f8579] sm:text-left">
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
            <p className="mt-2">{en ? "Gather 5–10 players in the lobby. Once everyone is connected and ready, the host can start. The host sets the player limit and discussion time, then picks the Innocent roles for a full room or leaves the choice to the game. There is always an Assassin. With six or more players, an Accomplice joins them. Up to two rooms can run at once." : "ชวนเพื่อน 5–10 คนเข้าห้องรอ เมื่อทุกคนเชื่อมต่อและกดพร้อม เจ้าของห้องก็เริ่มได้ ก่อนนั้นเจ้าของห้องเลือกจำนวนผู้เล่น เวลาคุย และบทบาทฝ่ายผู้บริสุทธิ์สำหรับห้องเต็ม หรือจะให้เกมสุ่มบทบาทก็ได้ นักฆ่าอยู่ในเกมเสมอ ถ้ามีผู้เล่นตั้งแต่ 6 คนขึ้นไป จะมีผู้สมรู้ร่วมคิดด้วย เปิดเกมพร้อมกันได้สูงสุด 2 ห้อง"}</p>
            <p className="mt-2">{en ? "When the doors close, each guest gets a character, a secret role, and a room. The three are drawn separately. Characters and rooms never repeat, and you cannot choose your character. Looks and jobs are no clue to anyone's team. The hotel has three rooms per floor: five floors for five players, seven for six to nine, and nine for ten." : "พอประตูโรงแรมปิดลง ทุกคนจะได้ตัวละคร บทบาทลับ และห้องพัก โดยสุ่มแยกกัน ตัวละครกับห้องไม่ซ้ำกัน และเลือกตัวละครเองไม่ได้ อย่าเดาฝ่ายจากหน้าตาหรืออาชีพของใคร โรงแรมมีชั้นละ 3 ห้อง: เล่น 5 คนใช้ 5 ชั้น, 6–9 คนใช้ 7 ชั้น, และ 10 คนใช้ 9 ชั้น"}</p>
            <p className="mt-2">{en ? "You have 30 seconds to watch the opening scene and peek at your own role, team, room, and skill. Then three empty rooms show strange traces. These first clues do not kill anyone." : "ฉากเปิดกินเวลา 30 วินาที ช่วงนี้เปิดดูบทบาท ฝ่าย ห้อง และสกิลของตัวเองได้ พอเรื่องเริ่ม จะมีร่องรอยปริศนาปรากฏในห้องว่าง 3 ห้อง เบาะแสแรกนี้ไม่ทำให้ใครตาย"}</p>
          </section>
          <section aria-labelledby="how-to-play-turns">
            <h2 id="how-to-play-turns" className="font-serif text-xl text-[#d9b66f]">{en ? "Each turn" : "หนึ่งรอบเล่นอย่างไร"}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>{en ? <><strong>Use your skill.</strong> Living players take turns in the order shown in the Role Book. When your turn comes, pick a target on the map or guest list and confirm before the timer ends. Each active skill gets as much time as the host set for discussion. Some clues arrive on their own: the Former Police Officer gets one each turn, while the Receptionist and Photographer get theirs on turn three. Dead guests and anyone on a dark floor miss their turn.</> : <><strong>ใช้สกิล</strong> คนที่ยังมีชีวิตได้คิวตามลำดับใน Role Book ถึงคิวคุณแล้วก็เลือกเป้าหมายบนแผนผังหรือรายชื่อแขก จากนั้นกดยืนยันก่อนหมดเวลา เวลาต่อคิวเท่ากับเวลาคุยที่เจ้าของห้องตั้งไว้ บางสกิลทำงานเอง: อดีตตำรวจได้เบาะแสทุกเทิร์น ส่วนพนักงานต้อนรับกับช่างภาพได้ข้อมูลในเทิร์นที่ 3 คนที่ตายแล้วหรืออยู่บนชั้นไฟดับจะพลาดคิว</>}</li>
              <li>{en ? <><strong>Talk it through.</strong> Share what you found in public chat. If there is an Accomplice, living Murderers also have a private tab. Both channels sit behind the same chat button. Discussion lasts 180 seconds by default; the host can set 30–420 seconds in 30-second steps.</> : <><strong>คุยกัน</strong> เอาเบาะแสมาเล่าในแชทสาธารณะ ถ้ามีผู้สมรู้ร่วมคิด ฆาตกรที่ยังมีชีวิตจะมีแท็บลับไว้คุยกันด้วย ทั้งสองช่องอยู่ในปุ่มแชทเดียว ปกติคุยได้ 180 วินาที เจ้าของห้องปรับเป็น 30–420 วินาที ครั้งละ 30 วินาทีได้</>}</li>
              <li>{en ? <><strong>Vote for a room.</strong> Everyone alive has 60 seconds to vote for an eligible room other than their own. You can change your mind until time runs out; only your last vote counts. Everyone can see the current votes and who cast them. Clue rooms, murder scenes, and rooms already opened are off limits, but a locked room can still be voted open. If there is a tie, you get one more 60-second vote. A second tie or no votes means the game picks from the eligible rooms. Public and private chats stay open until the vote is settled.</> : <><strong>โหวตห้อง</strong> คนที่ยังมีชีวิตมีเวลา 60 วินาทีเลือกห้องที่โหวตได้ ห้ามเลือกห้องตัวเอง เปลี่ยนใจได้จนหมดเวลา และนับแค่คะแนนล่าสุด ทุกคนเห็นว่าตอนนี้ใครเลือกห้องไหน ห้องร่องรอย ห้องเกิดเหตุฆาตกรรม และห้องที่เปิดแล้วโหวตไม่ได้ แต่ห้องที่ถูกล็อกยังโหวตได้ ถ้าคะแนนเสมอ จะมีรอบตัดสินอีก 60 วินาที ถ้ายังเสมอหรือไม่มีใครโหวต เกมจะสุ่มจากห้องที่มีสิทธิ์ แชททั้งสองช่องยังคุยได้จนจบการโหวต</>}</li>
              <li>{en ? <><strong>Open the door.</strong> The room with the winning vote opens. If someone alive is inside, they die; an empty room means nobody is hurt. The result appears in the middle of the screen for three seconds. If the game goes on, the next turn starts six seconds after the door opens.</> : <><strong>เปิดประตู</strong> ห้องที่ได้คะแนนจะถูกเปิด ถ้ามีคนที่ยังมีชีวิตอยู่ข้างใน คนนั้นจะตาย ถ้าเป็นห้องว่างก็ไม่มีใครเป็นอะไร ผลโหวตขึ้นกลางจอ 3 วินาที ถ้าเกมยังไม่จบ อีก 6 วินาทีหลังเปิดห้องจะเริ่มรอบใหม่</>}</li>
            </ol>
            <p className="mt-3">{en ? "The hotel has at most four turns to uncover the truth. Kill the Assassin and the Innocents win at once. If living Murderers ever match or outnumber living Innocents, they win instead. They also win if the Assassin is still standing after turn four. At the end, everyone sees who played each role, which team they were on, where they stayed, and who survived." : "โรงแรมมีเวลาไขความจริงไม่เกิน 4 เทิร์น ถ้านักฆ่าตาย ผู้บริสุทธิ์ชนะทันที แต่ถ้าฆาตกรที่ยังมีชีวิตมีจำนวนเท่ากับหรือมากกว่าผู้บริสุทธิ์ ฝ่ายฆาตกรจะชนะ และถ้านักฆ่ายังอยู่จนจบเทิร์นที่ 4 ก็ชนะเช่นกัน ตอนจบทุกคนจะเห็นว่าใครได้บทบาทอะไร อยู่ฝ่ายไหน พักห้องใด และใครรอดชีวิต"}</p>
          </section>
          {aboutOpen && <RoleBook language={en ? "en" : "th"} />}
          <section aria-labelledby="how-to-play-death">
            <h2 id="how-to-play-death" className="font-serif text-xl text-[#d9b66f]">{en ? "After death" : "เมื่อเสียชีวิต"}</h2>
            <p className="mt-2">{en ? "You can stay and watch the board, public chat, events, and votes. You cannot use a skill, cast a vote, or open anyone else's secrets." : "คุณยังอยู่ดูแผนผัง แชทสาธารณะ เหตุการณ์ และผลโหวตต่อได้ แต่ใช้สกิล โหวต หรือเปิดข้อมูลลับของคนอื่นไม่ได้"}</p>
            <p className="mt-2 font-semibold">{en ? "Once you die, please stop giving the living players clues, even if you keep watching." : "เมื่อเสียชีวิตแล้ว ขอให้หยุดบอกใบ้คนที่ยังเล่นอยู่ แม้คุณจะนั่งดูเกมต่อก็ตาม"}</p>
          </section>
        </DialogContent>
        <DialogActions><Button onClick={() => setAboutOpen(false)}>{en ? "Close" : "ปิด"}</Button></DialogActions>
      </Dialog>
      {entryMode && <LobbyEntryDialog key={`${entryMode}-${selectedCode}`} mode={entryMode} initialCode={selectedCode} initialDisplayName={initialDisplayName} initialSavedSeat={initialSavedSeat} onClose={() => setEntryMode(null)} />}
    </main>
  );
}
