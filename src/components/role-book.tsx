import type { Language } from "@/lib/language";
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
  RECEPTIONIST: {
    th: { action: "ไม่ต้องกดใช้สกิล ระบบทำงานอัตโนมัติเมื่อถึงคิวในเทิร์นที่ 3", note: "ได้ทะเบียนชื่อและห้องของทุกคน รวมผู้ที่เสียชีวิต แต่ไม่รู้บทบาทหรือฝ่าย; หากตายหรือชั้นที่พักไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล" },
    en: { action: "No action is needed. The skill resolves automatically on your slot in turn 3.", note: "Receive every player's name and room, including dead players, but no roles or teams. You receive nothing if dead or blacked out before your slot." },
  },
  PHOTOGRAPHER: {
    th: { action: "ไม่ต้องกดใช้สกิล ระบบทำงานอัตโนมัติเมื่อถึงคิวในเทิร์นที่ 3", note: "ได้ชื่อและหมายเลขผู้เล่นของนักฆ่าเป็นข้อมูลส่วนตัว ไม่ได้หมายเลขห้อง; หากตายหรือชั้นที่พักไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล" },
    en: { action: "No action is needed. The skill resolves automatically on your slot in turn 3.", note: "Privately learn the Assassin's name and player number, but not their room. You receive nothing if dead or blacked out before your slot." },
  },
  ACCOMPLICE: {
    th: { action: "แตะการ์ดคนอื่นในส่วนผู้เข้าพัก แล้วกดยืนยัน", note: "รู้ชั้นที่ผู้เล่นคนนั้นพักและส่งผลให้ฝ่ายฆาตกร หากเลือกคนที่ตายแล้วจะไม่ได้ข้อมูล แต่ยังเสียสิทธิ์ใช้สกิลเทิร์นนี้" },
    en: { action: "Select another card in the guest list, then confirm.", note: "Learn that player's floor and share the result with the Murderer team. Choosing a dead player yields no floor, but still consumes this turn's skill." },
  },
  KILLER: {
    th: { action: "แตะห้องบนแผนผัง แล้วกดยืนยัน", note: "สังหารได้เมื่อมีผู้พักที่ยังมีชีวิตและห้องไม่ถูกล็อก; ห้องว่างหรือถูกล็อกจะล้มเหลว การสังหารสำเร็จเผยห้องที่เกิดเหตุ แต่ไม่บอกชื่อเหยื่อ" },
    en: { action: "Select a room on the map, then confirm.", note: "Kill a living occupant only if the room is unlocked. Empty or locked rooms fail. A successful murder reveals the room, not the victim's name." },
  },
  WITNESS: {
    th: { action: "หลังนักฆ่าเลือกเป้าหมาย ให้แตะชั้นหรือห้องบนชั้นนั้น แล้วกดยืนยัน", note: "หากชั้นที่นักฆ่าเลือกตรงกับชั้นที่ตรวจ จะรู้ว่าชั้นที่นักฆ่าพักสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน; หากไม่ตรงจะไม่ได้เบาะแส" },
    en: { action: "After the Assassin chooses a target, select a floor or room on that floor, then confirm.", note: "If the floor targeted by the Assassin matches your chosen floor, learn whether the Assassin lives above, below, or on that floor. Otherwise, receive no direction." },
  },
};

export function RoleBook({ language }: { language: Language }) {
  const en = language === "en";
  return <section aria-labelledby="role-book-title">
    <h2 id="role-book-title" className="font-serif text-2xl text-[#d9b66f]">{en ? "Role Book" : "คู่มือบทบาท · Role Book"}</h2>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "Each role is unique. Every game has one Assassin and one Accomplice; the remaining players receive different Innocent roles. The order below is the skill order." : "แต่ละบทบาทมีได้เพียงคนเดียว ทุกเกมมีนักฆ่า 1 คนและผู้สมรู้ร่วมคิด 1 คน ที่เหลือสุ่มบทบาทฝ่ายผู้บริสุทธิ์ไม่ซ้ำกัน ลำดับด้านล่างคือลำดับใช้สกิล"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "The Assassin and Accomplice privately know each other's identity and room. Other players know only their own secret information until their skills reveal more. Public characters give no clue about secret roles." : "นักฆ่าและผู้สมรู้ร่วมคิดรู้ชื่อและห้องของกันและกันเป็นข้อมูลลับ ผู้เล่นคนอื่นรู้ข้อมูลลับของตัวเองเท่านั้นจนกว่าสกิลจะเผยเพิ่ม ตัวละครสาธารณะไม่บอกบทบาทลับ"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "Each interactive skill turn uses the host's discussion time setting. Choose a target and confirm. Clue, murdered, and opened rooms cannot be targeted; a floor or column needs at least one eligible room. Dead or blacked-out players skip their skill." : "สกิลที่ต้องกดใช้มีเวลาเท่ากับเวลาพูดคุยที่เจ้าของห้องตั้งไว้ เลือกเป้าหมายแล้วกดยืนยัน ห้องร่องรอย ห้องฆาตกรรม และห้องที่เปิดแล้วเลือกไม่ได้; ชั้นหรือแนวต้องมีห้องที่เลือกได้อย่างน้อยหนึ่งห้อง ผู้ที่ตายหรืออยู่บนชั้นไฟดับจะข้ามคิว"}</p>
    <p className="mt-2 text-sm leading-6 text-[#c6bdb1]">{en ? "Living players can use the public chat during discussion. Living Murderers can use their private team chat while a Murderer skill turn is active; open private information to see it. Chat closes when that phase or turn ends." : "ผู้เล่นที่ยังมีชีวิตแชทสาธารณะได้ในช่วงพูดคุย ฝ่ายฆาตกรที่ยังมีชีวิตแชทลับกันได้ระหว่างเทิร์นใช้สกิลของฝ่ายฆาตกร โดยเปิดข้อมูลลับเพื่อดูแชท เมื่อหมดช่วงหรือหมดเทิร์นจะส่งข้อความไม่ได้"}</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {ROLE_ORDER.map((role, index) => {
        const team = role === "KILLER" || role === "ACCOMPLICE" ? "MURDERER" : "INNOCENT";
        const notes = roleNotes[role][language];
        return <article key={role} className="rounded-xl border border-[#d9b66f]/25 bg-[#2c2422] p-4 sm:p-5">
          <p className="text-xs font-semibold tracking-wide text-[#d9b66f]">{en ? `Order ${index + 1} · ${team === "MURDERER" ? "Murderer" : "Innocent"}` : `ลำดับ ${index + 1} · ${team === "MURDERER" ? "ฝ่ายฆาตกร" : "ฝ่ายผู้บริสุทธิ์"}`}</p>
          <h3 className="mt-2 font-serif text-xl text-[#f8f1e4]">{en ? roleNamesEn[role] : roleNames[role]}</h3>
          <p className="mt-3 text-sm leading-6 text-[#e4dbd1]">{en ? roleSkillDescriptionsEn[role] : roleSkillDescriptions[role]}</p>
          <p className="mt-4 border-t border-[#d9b66f]/20 pt-3 text-xs font-semibold text-[#e7ce98]">{en ? "How to play" : "วิธีใช้"}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6cfc4]">{notes.action}</p>
          <p className="mt-3 text-xs font-semibold text-[#e7ce98]">{en ? "Remember" : "เงื่อนไขสำคัญ"}</p>
          <p className="mt-1 text-sm leading-6 text-[#d6cfc4]">{notes.note}</p>
        </article>;
      })}
    </div>
  </section>;
}
