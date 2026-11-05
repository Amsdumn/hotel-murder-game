"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useUiStore } from "@/stores/use-ui-store";
import { LobbyEntryDialog } from "@/components/lobby/lobby-entry-dialog";
import { ActiveRooms } from "@/components/lobby/active-rooms";
import { roleNames } from "@/components/role-portrait";
import { ROLE_ORDER } from "@/types/game";
import { readGuestProfile, readLobbyToken } from "@/lib/lobby-client";
import { roleSkillDescriptions } from "@/lib/role-skills";
import { AVATARS, avatarById, type AvatarId } from "@/lib/avatars";

function subscribeToProfile(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function profileNameSnapshot() { return readGuestProfile()?.displayName ?? ""; }

const skillRules = ROLE_ORDER.map((id) => ({
  id,
  role: roleNames[id],
  team: id === "KILLER" || id === "ACCOMPLICE" ? "ฝ่ายฆาตกร" : "ผู้บริสุทธิ์",
  description: roleSkillDescriptions[id],
}));

export function AvatarGallery({ onSelect }: { onSelect: (avatarId: AvatarId) => void }) {
  return <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
    {AVATARS.map((avatar) => <button
      key={avatar.id}
      type="button"
      aria-label={`ดูตัวละคร${avatar.name}`}
      onClick={() => onSelect(avatar.id)}
      className="group relative overflow-hidden rounded-lg border border-[#e5bd82]/30 bg-[#211727]/85 text-left shadow-[0_12px_35px_rgba(0,0,0,.5)] transition-colors hover:border-[#e5bd82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5bd82]"
    >
      <div className="relative aspect-4/5 w-full overflow-hidden"><Image src={avatar.portrait} alt={avatar.name} fill sizes="(max-width: 640px) 45vw, 125px" className="object-cover object-top transition-transform duration-500 group-hover:scale-105" /></div>
      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#100d1a] via-[#100d1a]/75 to-transparent px-1 pb-1.5 pt-6 text-center text-[10px] font-semibold leading-tight text-[#f5e4cf] sm:px-2 sm:pb-2 sm:text-xs">{avatar.name}</span>
    </button>)}
  </div>;
}

export function AvatarDetail({ avatarId }: { avatarId: AvatarId }) {
  const avatar = avatarById(avatarId)!;
  return <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
    <div className="relative h-80 shrink-0 overflow-hidden rounded-xl border border-[#d9b66f]/25 bg-[radial-gradient(circle_at_50%_30%,#493447,#17131e_70%)] sm:h-[29rem] sm:w-[45%]">
      <Image src={avatar.image} alt={`ภาพเต็มตัว${avatar.name}`} fill sizes="(max-width: 640px) 100vw, 360px" className="object-contain object-bottom p-3" />
    </div>
    <div className="min-w-0 self-center pb-2 sm:py-5">
      <p className="text-xs tracking-[.22em] text-[#d9b66f]">{avatar.occupation} · อายุ {avatar.age} ปี · {avatar.origin}</p>
      <h3 className="mt-3 font-serif text-3xl text-[#f8f1e4]">{avatar.name}</h3>
      <h4 className="mt-7 text-sm font-semibold text-[#e7ce98]">เรื่องราว</h4>
      <p className="mt-2 leading-7 text-[#ddd4ca]">{avatar.introduction}</p>
      <p className="mt-7 text-sm leading-7 text-[#c6bdb1]">ตัวละคร บทบาท และสกิลลับจะสุ่มเมื่อเริ่มเกม ก่อนหน้านั้นไม่มีใครรู้ว่าใครจะได้ตัวละครใด</p>
    </div>
  </div>;
}

export function MainMenu() {
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
        <header className="flex items-center justify-between border-b border-[#d9b66f]/20 pb-5">
          <div className="flex items-center gap-3 text-[#e7ce98]">
            <span aria-hidden="true" className="text-2xl">✧</span>
            <span className="text-sm font-bold tracking-[0.12em]">คืนนี้ใครฆ่า...</span>
          </div>
          <div className="flex items-center gap-2">
            {profileName && <span className="max-w-28 truncate rounded-full border border-[#d9b66f]/30 px-3 py-1 text-xs text-[#e7ce98] sm:max-w-48">ผู้เล่น: {profileName}</span>}
            <Button color="primary" variant="text" size="small" onClick={() => setAboutOpen(true)}>วิธีเล่น</Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <section className="relative z-10 max-w-xl">
            <Chip label="WHO IS MURDERED · เกมสืบสวนออนไลน์" color="primary" variant="outlined" size="small" className="mb-6! bg-[#171324]/70!" />
            <p className="mb-6 text-sm tracking-[0.34em] text-[#e5bd82]">ยินดีต้อนรับสู่โรงแรม</p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              คืนนี้<br /><span className="text-[#d9b66f]">ใครฆ่า...</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-[#c6bdb1] sm:text-lg">
              แขกทุกคนมีความลับ หนึ่งคนคือนักฆ่า ร่วมสืบหาความจริงก่อนจะถึงคืนสุดท้าย
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="contained" size="large" onClick={() => openEntry("create")} className="px-8! py-3!">สร้างห้องเกม</Button>
              {/* <Button variant="outlined" size="large" onClick={() => openEntry("join")} className="px-8! py-3!">เข้าร่วมห้อง</Button> */}
            </div>
            {/* <p className="mt-5 text-sm text-[#c9b8ae]">รองรับผู้เล่น 5–10 คน · ใช้เวลาสูงสุด 4 รอบ</p> */}
            <ActiveRooms onJoin={(code) => openEntry("join", code)} />
          </section>

          <section aria-label="ตัวละครในโรงแรม" className="relative mx-auto w-full max-w-xl lg:mt-20">
            <div className="absolute -inset-8 rounded-full bg-[#8c3b47]/20 blur-3xl" />
            <AvatarGallery onSelect={setSelectedAvatar} />
            <p className="relative mt-4 text-center text-xs tracking-[.25em] text-[#e5bd82]">12 ตัวละคร · 21 ห้อง · ความลับที่ไม่มีใครบอก</p>
            <p className="relative mt-2 text-center text-xs text-[#c6bdb1]">แตะภาพเพื่ออ่านเรื่องราว ระบบจะสุ่มตัวละครเมื่อเริ่มเกม</p>
          </section>
        </div>
        <footer className="border-t border-[#d9b66f]/20 pt-5 text-center text-xs text-[#8f8579] sm:text-left">
          ความลับอยู่หลังประตูทุกบาน
        </footer>
      </div>
      <Dialog open={selectedAvatar !== null} onClose={() => setSelectedAvatar(null)} fullWidth maxWidth="md" aria-labelledby="character-detail-title" slotProps={{ paper: { className: "bg-[#1b1720]! text-[#f8f1e4]!" } }}>
        {selectedAvatar && <><DialogTitle id="character-detail-title" className="font-serif! text-2xl!">{avatarById(selectedAvatar)?.name}</DialogTitle><DialogContent dividers className="border-[#d9b66f]/20! p-5! sm:p-7!"><AvatarDetail avatarId={selectedAvatar} /></DialogContent><DialogActions><Button onClick={() => setSelectedAvatar(null)}>ปิด</Button></DialogActions></>}
      </Dialog>
      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>วิธีเล่น</DialogTitle>
        <DialogContent dividers className="space-y-7! leading-7!">
          <section aria-labelledby="how-to-play-overview">
            <h2 id="how-to-play-overview" className="font-serif text-xl text-[#d9b66f]">เริ่มเกม</h2>
            <p className="mt-2">ผู้เล่น 5–10 คนได้รับตัวละคร บทบาท และห้องพักแบบสุ่มเมื่อเริ่มเกม ตัวละครไม่บอกบทบาทหรือฝ่าย โรงแรมมี 7 ชั้น รวม 21 ห้อง มีนักฆ่า 1 คน ผู้สมรู้ร่วมคิด 1 คน และที่เหลือเป็นฝ่ายผู้บริสุทธิ์</p>
            <p className="mt-2">หลังคำเกริ่นเรื่อง ผู้เล่นกดดูบทบาท ห้องพัก และสกิลของตนเองได้ จากนั้นจะพบร่องรอยปริศนาในห้องว่าง 3 ห้อง ไม่มีใครเสียชีวิตจากการพบร่องรอยนี้</p>
          </section>
          <section aria-labelledby="how-to-play-turns">
            <h2 id="how-to-play-turns" className="font-serif text-xl text-[#d9b66f]">หนึ่งรอบเล่นอย่างไร</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li><strong>ใช้สกิล:</strong> ผู้เล่นที่ยังมีชีวิตใช้สกิลตามลำดับบทบาทด้านล่าง แต่ละคนมีเวลา 60 วินาที หากสกิลเลือกห้อง ชั้น หรือแนวห้อง ให้แตะเป้าหมายบนแผนผังแล้วกดยืนยัน</li>
              <li><strong>พูดคุย:</strong> แลกเปลี่ยนเบาะแสนอกเว็บไซต์ เวลาปกติ 180 วินาที เจ้าของห้องปรับได้ก่อนเริ่มเกม</li>
              <li><strong>ลงคะแนน:</strong> ผู้เล่นที่ยังมีชีวิตโหวตเลือกห้องได้คนละหนึ่งครั้งใน 60 วินาที เลือกห้องตัวเองได้ แต่เลือกห้องที่เปิดแล้ว ถูกฆาตกรรม หรือมีร่องรอยปริศนาไม่ได้ หากเสมอจะโหวตรอบตัดสินอีก 60 วินาที เมื่อหมดเวลาเกมนับคะแนนที่มีอยู่ หากไม่มีใครโหวตเกมจะสุ่มห้องที่เลือกได้</li>
            </ol>
            <p className="mt-3">เกมเปิดห้องที่ได้รับเลือกและแสดงผลก่อนเริ่มรอบถัดไป</p>
            <p className="mt-3">หากนักฆ่าเสียชีวิต ฝ่ายผู้บริสุทธิ์ชนะทันที หากนักฆ่ารอดจนจบรอบที่ 4 ฝ่ายฆาตกรชนะ</p>
          </section>
          <section aria-labelledby="how-to-play-skills">
            <h2 id="how-to-play-skills" className="font-serif text-xl text-[#d9b66f]">บทบาทและสกิล</h2>
            <p className="mt-2 text-sm text-[#c6bdb1]">ลำดับด้านล่างคือลำดับการใช้สกิลในแต่ละรอบ ผลสืบสวนจะส่งให้เฉพาะผู้มีสิทธิ์</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {skillRules.map(({ id, role, team, description }, index) => <div key={id} className="rounded-lg border border-[#d9b66f]/20 bg-[#2c2422] p-4">
                <div className="min-w-0"><p className="text-xs text-[#d9b66f]">ลำดับ {index + 1} · {team}</p>
                <h3 className="mt-1 font-serif text-lg">{role}</h3>
                <p className="mt-2 text-sm leading-6 text-[#d6cfc4]">{description}</p></div>
              </div>)}
            </div>
          </section>
          <section aria-labelledby="how-to-play-death">
            <h2 id="how-to-play-death" className="font-serif text-xl text-[#d9b66f]">เมื่อเสียชีวิต</h2>
            <p className="mt-2">ยังรับชมกระดาน เหตุการณ์สาธารณะ การพูดคุย และผลโหวตได้ แต่ใช้สกิลหรือลงคะแนนไม่ได้ และจะไม่เห็นข้อมูลลับของผู้อื่น</p>
            <p className="mt-2 font-semibold">ผู้เล่นที่เสียชีวิตแล้วต้องหยุดให้ข้อมูลเกี่ยวกับเกมทันที แม้จะยังสามารถรับชมเกมต่อได้</p>
          </section>
        </DialogContent>
        <DialogActions><Button onClick={() => setAboutOpen(false)}>ปิด</Button></DialogActions>
      </Dialog>
      <LobbyEntryDialog key={`${entryMode}-${selectedCode}`} mode={entryMode} initialCode={selectedCode} initialDisplayName={initialDisplayName} initialSavedSeat={initialSavedSeat} onClose={() => setEntryMode(null)} />
    </main>
  );
}
