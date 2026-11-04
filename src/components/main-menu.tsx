"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useUiStore } from "@/stores/use-ui-store";
import { LobbyEntryDialog } from "@/components/lobby/lobby-entry-dialog";
import { ActiveRooms } from "@/components/lobby/active-rooms";
import { RolePortrait } from "@/components/role-portrait";
import type { Role } from "@/types/game";

const skillRules = [
  { id: "LOCKSMITH", role: "ช่างกุญแจ", team: "ผู้บริสุทธิ์", description: "ล็อกห้องหนึ่งห้องในรอบนั้น ฆาตกรลอบสังหารห้องที่ล็อกไม่ได้ แต่ยังโหวตเปิดห้องนั้นได้" },
  { id: "HOUSEKEEPER", role: "แม่บ้าน", team: "ผู้บริสุทธิ์", description: "เลือกหนึ่งชั้น แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตบนชั้นนั้นเป็นข้อมูลส่วนตัว" },
  { id: "WINDOW_CLEANER", role: "คนเช็ดกระจก", team: "ผู้บริสุทธิ์", description: "เลือกแนวห้อง 01, 02 หรือ 03 แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตในแนวนั้นตลอดเจ็ดชั้น" },
  { id: "WITNESS", role: "พยาน", team: "ผู้บริสุทธิ์", description: "เลือกหนึ่งชั้น หากมีห้องที่เกิดเหตุเริ่มต้นบนชั้นนั้น จะทราบว่าฆาตกรอยู่ชั้นสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน" },
  { id: "DETECTIVE", role: "นักสืบ", team: "ผู้บริสุทธิ์", description: "ตรวจหนึ่งห้อง ทราบว่าผู้พักที่ยังมีชีวิตอยู่ฝ่ายผู้บริสุทธิ์หรือฝ่ายฆาตกร หรือเป็นห้องว่าง โดยไม่ทราบชื่อและบทบาท" },
  { id: "ACCOMPLICE", role: "ผู้สมรู้ร่วมคิด", team: "ฝ่ายฆาตกร", description: "เลือกผู้เล่นที่ยังมีชีวิต แล้วทราบชั้นที่เขาพัก ผลนี้เป็นข้อมูลเฉพาะฝ่ายฆาตกร" },
  { id: "KILLER", role: "ฆาตกร", team: "ฝ่ายฆาตกร", description: "เลือกหนึ่งห้องเพื่อลอบสังหารผู้พักที่ยังมีชีวิต หากห้องไม่ถูกล็อก ทำได้ครั้งเดียวต่อรอบ และไม่ประกาศชื่อเหยื่อหรือห้องที่ถูกเลือก" },
] satisfies Array<{ id: Role; role: string; team: string; description: string }>;

export function MainMenu() {
  const [entryMode, setEntryMode] = useState<"create" | "join" | null>(null);
  const [selectedCode, setSelectedCode] = useState("");
  const aboutOpen = useUiStore((state) => state.aboutOpen);
  const setAboutOpen = useUiStore((state) => state.setAboutOpen);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#10101b] text-[#f8f1e4]">
      <div className="pointer-events-none absolute inset-0"><Image src="/art/hotel-night.webp" alt="" fill priority sizes="100vw" className="object-cover object-[62%_center]" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,11,23,.97)_0%,rgba(13,11,23,.86)_35%,rgba(13,11,23,.26)_75%),linear-gradient(0deg,rgba(13,11,23,.9),transparent_48%)]" /></div>
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between border-b border-[#d9b66f]/20 pb-5">
          <div className="flex items-center gap-3 text-[#e7ce98]">
            <span aria-hidden="true" className="text-2xl">✧</span>
            <span className="text-sm font-bold tracking-[0.12em]">โรงแรมปริศนา</span>
          </div>
          <Button color="primary" variant="text" size="small" onClick={() => setAboutOpen(true)}>
            วิธีเล่น
          </Button>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_.95fr] lg:py-16">
          <section className="relative z-10 max-w-xl">
            <Chip label="ANIME MYSTERY · เกมสืบสวนออนไลน์" color="primary" variant="outlined" size="small" className="!mb-8 !bg-[#171324]/70" />
            <p className="mb-3 text-sm tracking-[0.34em] text-[#e5bd82]">ยินดีต้อนรับสู่โรงแรม</p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
              คืนนี้<br /><span className="text-[#d9b66f]">ใครคือฆาตกร</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-[#c6bdb1] sm:text-lg">
              แขกทุกคนมีความลับ หนึ่งคนคือฆาตกร ร่วมสืบหาความจริงก่อนจะถึงคืนสุดท้าย
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button variant="contained" size="large" onClick={() => { setSelectedCode(""); setEntryMode("create"); }} className="!px-8 !py-3">สร้างห้องเกม</Button>
              <Button variant="outlined" size="large" onClick={() => { setSelectedCode(""); setEntryMode("join"); }} className="!px-8 !py-3">เข้าร่วมห้อง</Button>
            </div>
            {/* <p className="mt-5 text-sm text-[#c9b8ae]">รองรับผู้เล่น 5–10 คน · ใช้เวลาสูงสุด 4 รอบ</p> */}
            <ActiveRooms onJoin={(code) => { setSelectedCode(code); setEntryMode("join"); }} />
          </section>

          <section aria-label="ตัวละครในโรงแรม" className="relative mx-auto w-full max-w-lg lg:mt-20">
            <div className="absolute -inset-8 rounded-full bg-[#8c3b47]/20 blur-3xl" />
            <div className="relative grid grid-cols-3 gap-2 sm:gap-3">
              {skillRules.slice(0, 6).map(({ id, role }) => <div key={id} className="group relative overflow-hidden rounded-lg border border-[#e5bd82]/30 bg-[#211727]/85 shadow-[0_12px_35px_rgba(0,0,0,.5)]">
                <RolePortrait role={id} sizes="(max-width: 640px) 30vw, 150px" className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#100d1a] via-[#100d1a]/75 to-transparent px-2 pb-2 pt-8 text-center text-xs font-semibold text-[#f5e4cf] sm:text-sm">{role}</div>
              </div>)}
            </div>
            <p className="relative mt-4 text-center text-xs tracking-[.25em] text-[#e5bd82]">7 บทบาท · 21 ห้อง · ความลับที่ไม่มีใครบอก</p>
          </section>
        </div>
        <footer className="border-t border-[#d9b66f]/20 pt-5 text-center text-xs text-[#8f8579] sm:text-left">
          ความลับอยู่หลังประตูทุกบาน
        </footer>
      </div>
      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>วิธีเล่น</DialogTitle>
        <DialogContent dividers className="!space-y-7 !leading-7">
          <section aria-labelledby="how-to-play-overview">
            <h2 id="how-to-play-overview" className="font-serif text-xl text-[#d9b66f]">เริ่มเกม</h2>
            <p className="mt-2">ผู้เล่น 5–10 คนได้รับบทบาทและห้องพักลับคนละห้องในโรงแรม 7 ชั้น รวม 21 ห้อง มีฆาตกร 1 คน ผู้สมรู้ร่วมคิด 1 คน และที่เหลือเป็นฝ่ายผู้บริสุทธิ์</p>
            <p className="mt-2">เริ่มต้นจะเปิดเผยหมายเลขห้องที่เกิดเหตุ 3 ห้อง หากมีผู้พักในห้องเหล่านั้น ผู้พักจะเสียชีวิตทันที แต่จะไม่เปิดเผยว่าเป็นใคร</p>
          </section>
          <section aria-labelledby="how-to-play-turns">
            <h2 id="how-to-play-turns" className="font-serif text-xl text-[#d9b66f]">หนึ่งรอบเล่นอย่างไร</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li><strong>ใช้สกิล:</strong> ผู้เล่นที่ยังมีชีวิตใช้สกิลตามลำดับบทบาทด้านล่าง แต่ละคนมีเวลา 60 วินาที</li>
              <li><strong>พูดคุย:</strong> แลกเปลี่ยนเบาะแสนอกเว็บไซต์ เวลาปกติ 180 วินาที เจ้าของห้องปรับได้ก่อนเริ่มเกม</li>
              <li><strong>ลงคะแนน:</strong> เลือกเปิดห้องที่ยังไม่เคยเปิดและไม่ใช่ห้องที่เกิดเหตุ เลือกห้องตัวเองได้ ห้องที่ได้คะแนนมากสุดจะเปิด หากเสมอจะโหวตรอบตัดสินอีกครั้ง</li>
            </ol>
            <p className="mt-3">หากฆาตกรเสียชีวิต ฝ่ายผู้บริสุทธิ์ชนะทันที หากฆาตกรรอดจนจบรอบที่ 4 ฝ่ายฆาตกรชนะ</p>
          </section>
          <section aria-labelledby="how-to-play-skills">
            <h2 id="how-to-play-skills" className="font-serif text-xl text-[#d9b66f]">บทบาทและสกิล</h2>
            <p className="mt-2 text-sm text-[#c6bdb1]">ลำดับด้านล่างคือลำดับการใช้สกิลในแต่ละรอบ ผลสืบสวนจะส่งให้เฉพาะผู้มีสิทธิ์</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {skillRules.map(({ id, role, team, description }, index) => <div key={id} className="flex overflow-hidden rounded-lg border border-[#d9b66f]/20 bg-[#2c2422]">
                <RolePortrait role={id} className="w-24 sm:w-28" sizes="112px" />
                <div className="min-w-0 p-4"><p className="text-xs text-[#d9b66f]">ลำดับ {index + 1} · {team}</p>
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
      <LobbyEntryDialog key={`${entryMode}-${selectedCode}`} mode={entryMode} initialCode={selectedCode} onClose={() => setEntryMode(null)} />
    </main>
  );
}
