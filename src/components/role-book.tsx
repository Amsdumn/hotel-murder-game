import Image from "next/image";
import type { Language } from "@/lib/language";
import { AVATARS } from "@/lib/avatars";
import { avatarEnglish } from "@/lib/avatar-translations";
import { roleSkillDescriptions, roleSkillDescriptionsEn } from "@/lib/role-skills";
import { ROLE_ORDER, type Role } from "@/types/game";
import { roleNames, roleNamesEn } from "./role-portrait";

type RoleNote = { action: string; note: string };

const roleNotes: Record<Role, Record<Language, RoleNote>> = {
  ELECTRICIAN: {
    th: { action: "แตะชั้นหรือห้องบนชั้นนั้นในแผนผัง แล้วกดยืนยัน", note: "ชั้นที่ไฟดับจะใช้สกิลไม่ได้ในเทิร์นนี้ เมื่อใช้แล้วต้องพักหนึ่งเทิร์นเต็มก่อนใช้ซ้ำ" },
    en: { action: "Select a floor or a room on that floor on the map, then confirm.", note: "Players on the dark floor lose their skill this turn. After using this skill, you must skip one full turn before using it again." },
  },
  LOCKSMITH: {
    th: { action: "แตะห้องบนแผนผัง แล้วกดยืนยัน", note: "ล็อกห้องเดิมซ้ำไม่ได้ตลอดเกม ล็อกกันการลอบสังหารเฉพาะเทิร์นนี้ แต่ยังโหวตเปิดห้องได้" },
    en: { action: "Select a room on the map, then confirm.", note: "You cannot lock the same room again during this game. The lock stops assassination only for this turn; voting may still open the room." },
  },
  HOUSEKEEPER: {
    th: { action: "แตะชั้นหรือห้องบนชั้นนั้น แล้วกดยืนยัน", note: "ทราบจำนวนผู้เล่นที่ยังมีชีวิตบนชั้นที่เลือกเป็นข้อมูลส่วนตัว ไม่ทราบชื่อหรือห้อง" },
    en: { action: "Select a floor or a room on that floor, then confirm.", note: "Privately learn the number of living players on that floor, without names or rooms." },
  },
  WINDOW_CLEANER: {
    th: { action: "แตะแนวห้อง 01, 02 หรือ 03 หรือห้องในแนวนั้น แล้วกดยืนยัน", note: "นับผู้เล่นที่ยังมีชีวิตในแนวเดียวกันครบทุกชั้นของเกม โดยไม่ทราบชื่อ" },
    en: { action: "Select column 01, 02, or 03, or a room in that column, then confirm.", note: "Count living players in that column across every floor in this game, without learning names." },
  },
  DETECTIVE: {
    th: { action: "แตะห้องบนแผนผัง แล้วกดยืนยัน", note: "ถ้ามีผู้พักที่ยังมีชีวิต จะรู้เพียงฝ่ายผู้บริสุทธิ์หรือฆาตกร ไม่รู้ชื่อหรือบทบาท; หากไม่มีจะได้ผลว่าห้องว่าง" },
    en: { action: "Select a room on the map, then confirm.", note: "If a living player occupies it, learn only their team, not their name or role. Otherwise, the result says empty." },
  },
  LAWYER: {
    th: { action: "แตะการ์ดผู้เข้าพักคนอื่นที่ยังมีชีวิตสองคน แล้วกดยืนยัน", note: "ผลส่วนตัวบอกเพียงว่าทั้งสองอยู่ฝ่ายเดียวกันหรือคนละฝ่าย ไม่บอกชื่อฝ่ายหรือบทบาท ผู้ตายและตัวเองเลือกไม่ได้" },
    en: { action: "Select two other living guest cards, then confirm.", note: "The private result says only same team or different teams. It does not name a team or role. You cannot select yourself or a dead guest." },
  },
  FORMER_POLICE: {
    th: { action: "ไม่ต้องกดใช้สกิล ระบบให้คำใบ้ส่วนตัวอัตโนมัติเมื่อถึงคิวในแต่ละเทิร์น", note: "คำใบ้เกี่ยวกับตัวละครสาธารณะของนักฆ่า: เพศ → ช่วงอายุ → สีผมและโทนสีผิว → ประเทศเกิด หากตายหรือไฟดับก่อนถึงคิวจะพลาดคำใบ้เทิร์นนั้น" },
    en: { action: "No action is needed. Receive a private clue automatically on your slot each turn.", note: "Clues describe the Assassin's public character: gender → age range → hair color and broad skin tone → country of birth. Death or blackout before your slot makes you miss that turn's clue." },
  },
  RECEPTIONIST: {
    th: { action: "ไม่ต้องกดใช้สกิล ระบบทำงานอัตโนมัติเมื่อถึงคิวในเทิร์นที่ 3", note: "ได้ทะเบียนชื่อและห้องของทุกคน รวมผู้ที่เสียชีวิต แต่ไม่รู้บทบาทหรือฝ่าย; หากตายหรือชั้นที่พักไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล" },
    en: { action: "No action is needed. The skill resolves automatically on your slot in turn 3.", note: "Receive every player's name and room, including dead players, but no roles or teams. You receive nothing if dead or blacked out before your slot." },
  },
  PHOTOGRAPHER: {
    th: { action: "ไม่ต้องกดใช้สกิล ระบบทำงานอัตโนมัติเมื่อถึงคิวในเทิร์นที่ 3", note: "ได้ชื่อและหมายเลขผู้เล่นของนักฆ่าเป็นข้อมูลส่วนตัว ไม่ได้หมายเลขห้อง; หากตายหรือชั้นที่พักไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล" },
    en: { action: "No action is needed. The skill resolves automatically on your slot in turn 3.", note: "Privately learn the Assassin's name and player number, but not their room. You receive nothing if dead or blacked out before your slot." },
  },
  ACCOMPLICE: {
    th: { action: "แตะการ์ดคนอื่นที่ยังมีชีวิตในส่วนผู้เข้าพัก แล้วกดยืนยัน", note: "รู้ชั้นที่ผู้เล่นคนนั้นพักและส่งผลให้ฝ่ายฆาตกร การ์ดผู้ตายกดเลือกไม่ได้" },
    en: { action: "Select another living guest card, then confirm.", note: "Learn that player's floor and share the result with the Murderer team. Dead guest cards cannot be selected." },
  },
  KILLER: {
    th: { action: "แตะห้องบนแผนผัง แล้วกดยืนยัน; เกม 5 คนในเทิร์นที่ 2 ต้องเลือกสองห้องต่างกัน", note: "สังหารได้ทั้งสองห้องเมื่อมีผู้พักที่ยังมีชีวิตและห้องไม่ถูกล็อก; ห้องว่างหรือถูกล็อกจะล้มเหลว การสังหารสำเร็จเผยห้องที่เกิดเหตุ แต่ไม่บอกชื่อเหยื่อ" },
    en: { action: "Select a room on the map, then confirm. In a five-player game, select two distinct rooms on turn two.", note: "Both rooms can kill living occupants if unlocked. Empty or locked rooms fail. A successful murder reveals the room, not the victim's name." },
  },
  WITNESS: {
    th: { action: "หลังนักฆ่าเลือกเป้าหมาย ให้แตะชั้นหรือห้องบนชั้นนั้น แล้วกดยืนยัน", note: "หากชั้นที่นักฆ่าเลือกตรงกับชั้นที่ตรวจอย่างน้อยหนึ่งห้อง จะรู้ว่าชั้นที่นักฆ่าพักสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน; หากไม่ตรงจะไม่ได้เบาะแส" },
    en: { action: "After the Assassin chooses a target, select a floor or room on that floor, then confirm.", note: "If at least one targeted room is on your chosen floor, learn whether the Assassin lives above, below, or on that floor. Otherwise, receive no direction." },
  },
};

export function RoleBook({ language }: { language: Language }) {
  const en = language === "en";
  return <section aria-labelledby="role-book-title">
    <h2 id="role-book-title" className="font-serif text-2xl text-[#d9b66f]">{en ? "Role Book" : "คู่มือบทบาท · Role Book"}</h2>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "No two guests share a role. In a five-player game, one is the Assassin and the other four have different Innocent roles. From six players onward, an Accomplice joins the Assassin. The cards below follow the order in which skills are used." : "ไม่มีใครได้บทบาทซ้ำกัน ถ้าเล่น 5 คน จะมีนักฆ่า 1 คนและผู้บริสุทธิ์อีก 4 คน โดยไม่มีผู้สมรู้ร่วมคิด พอมีผู้เล่นตั้งแต่ 6 คนขึ้นไป ผู้สมรู้ร่วมคิดจะเข้าฝ่ายฆาตกรด้วย การ์ดด้านล่างเรียงตามคิวใช้สกิล"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "When an Accomplice is in the game, they and the Assassin know each other's name and room, but keep that to themselves. Everyone else starts with only their own secrets. A character's face or job will not tell you what role they drew." : "ถ้ามีผู้สมรู้ร่วมคิด เขากับนักฆ่าจะรู้ชื่อและห้องของกันและกัน แต่คนอื่นเริ่มจากรู้แค่ความลับของตัวเอง อย่าใช้หน้าตาหรืออาชีพของตัวละครเดาบทบาท เพราะสองอย่างนี้ไม่เกี่ยวกัน"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "When your skill needs a target, pick one and press confirm before time runs out. You get the same 30–420 seconds the host set for discussion, in 30-second steps. Clue rooms, murder scenes, and opened rooms are off limits. To pick a floor or column, it must contain at least one room you could still target. Dead guests and anyone on a dark floor miss their skill." : "ถ้าสกิลต้องเลือกเป้าหมาย ให้เลือกแล้วกดยืนยันก่อนหมดเวลา แต่ละคิวมีเวลาเท่ากับช่วงคุยที่เจ้าของห้องตั้งไว้ ตั้งได้ 30–420 วินาที ครั้งละ 30 วินาที ห้องร่องรอย ห้องเกิดเหตุฆาตกรรม และห้องที่เปิดแล้วเลือกไม่ได้ ส่วนชั้นหรือแนวห้องต้องมีห้องที่ยังเลือกได้อย่างน้อยหนึ่งห้อง คนที่ตายหรืออยู่บนชั้นไฟดับจะพลาดสกิล"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "The public chat stays open for living guests through discussion and the vote, even if there is a runoff. If the game has an Accomplice, living Murderers also get a private chat during their skill turns, then again during discussion and voting. One button at the lower left opens the chat; Murderers can switch to their own tab there. New messages show as a number on the button. The chats disappear once voting ends." : "คนที่ยังเล่นอยู่คุยในแชทสาธารณะได้ตั้งแต่ช่วงพูดคุยจนจบการโหวต แม้จะมีรอบตัดสินก็ตาม ถ้ามีผู้สมรู้ร่วมคิด ฆาตกรที่ยังมีชีวิตจะได้แชทลับในคิวสกิลของฝ่ายตน แล้วกลับมาคุยได้อีกในช่วงพูดคุยและลงคะแนน กดปุ่มแชทมุมซ้ายล่างครั้งเดียว แล้วสลับไปแท็บเฉพาะฝ่ายฆาตกรได้ ข้อความใหม่จะขึ้นเป็นตัวเลขบนปุ่ม พอโหวตจบ แชทก็หายไป"}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {ROLE_ORDER.map((role, index) => {
        const team = role === "KILLER" || role === "ACCOMPLICE" ? "MURDERER" : "INNOCENT";
        const notes = roleNotes[role][language];
        return <article key={role} className="rounded-xl border border-[#d9b66f]/25 bg-[#2c2422] p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-wide text-[#d9b66f]">{en ? `Order ${index + 1} · ${team === "MURDERER" ? "Murderer" : "Innocent"}` : `ลำดับ ${index + 1} · ${team === "MURDERER" ? "ฝ่ายฆาตกร" : "ฝ่ายผู้บริสุทธิ์"}`}</p>
          <h3 className="mt-2 font-serif text-xl text-[#f8f1e4]">{en ? roleNamesEn[role] : roleNames[role]}</h3>
          <p className="mt-3 text-sm leading-6 text-[#e4dbd1]">{en ? roleSkillDescriptionsEn[role] : roleSkillDescriptions[role]}</p>
          <p className="mt-4 border-t border-[#d9b66f]/20 pt-3 text-xs font-semibold text-[#e7ce98]">{en ? "On your turn" : "พอถึงคิว"}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6cfc4]">{notes.action}</p>
          <p className="mt-3 text-xs font-semibold text-[#e7ce98]">{en ? "Keep in mind" : "จำไว้ว่า"}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6cfc4]">{notes.note}</p>
        </article>;
      })}
    </div>
    <section aria-labelledby="public-characters-title" className="mt-9 border-t border-[#d9b66f]/25 pt-7">
      <h3 id="public-characters-title" className="font-serif text-2xl text-[#d9b66f]">{en ? "Faces you may meet" : "คนที่อาจเจอในโรงแรม"}</h3>
      <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "The hotel has 12 characters, but only up to ten appear in one game. The game assigns them without repeats; you do not pick your own. Their names and stories are for everyone to see, but their secret roles are a separate draw. Irina may work at the front desk in her story and still draw a completely different role in your game." : "โรงแรมมีตัวละคร 12 คน แต่หนึ่งเกมจะเจอไม่เกิน 10 คน เกมสุ่มให้โดยไม่ซ้ำและเราเลือกเองไม่ได้ ชื่อกับเรื่องราวของพวกเขาเปิดเผยให้ทุกคนเห็น ส่วนบทบาทลับสุ่มแยกอีกที อิรินาอาจเป็นพนักงานต้อนรับในเรื่อง แต่ในเกมของคุณเธออาจได้บทบาทอื่นก็ได้"}</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {AVATARS.map((avatar) => {
          const profile = avatarEnglish[avatar.id];
          return <li key={avatar.id} className="flex gap-3 rounded-xl border border-[#d9b66f]/20 bg-[#2c2422] p-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-[#1b1720]"><Image src={avatar.portrait} alt="" fill sizes="64px" className="object-cover object-top" /></div>
            <div className="min-w-0">
              <h4 className="font-serif text-lg leading-6 text-[#f8f1e4]">{en ? profile.name : avatar.name}</h4>
              <p className="mt-1 text-xs text-[#e7ce98]">{en ? `${profile.occupation} · Age ${avatar.age} · ${profile.origin}` : `${avatar.occupation} · อายุ ${avatar.age} ปี · ${avatar.origin}`}</p>
              <p className="mt-2 text-xs leading-5 text-[#d6cfc4]">{en ? profile.introduction : avatar.introduction}</p>
            </div>
          </li>;
        })}
      </ul>
    </section>
  </section>;
}
