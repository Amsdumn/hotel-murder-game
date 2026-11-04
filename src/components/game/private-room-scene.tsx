import Image from "next/image";
import type { Role, Team } from "@/types/game";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import { roleSkillDescriptions } from "@/lib/role-skills";
import styles from "./private-room-scene.module.css";

const characters: Record<Role, string> = {
  LOCKSMITH: "/art/characters/locksmith-3d.webp",
  HOUSEKEEPER: "/art/characters/housekeeper-3d.webp",
  WINDOW_CLEANER: "/art/characters/window-cleaner-3d.webp",
  WITNESS: "/art/characters/witness-3d.webp",
  DETECTIVE: "/art/characters/detective-3d.webp",
  ACCOMPLICE: "/art/characters/accomplice-3d.webp",
  KILLER: "/art/characters/killer-3d.webp",
};

export function PrivateRoomScene({ role, roomNumber, team, isAlive }: { role: Role; roomNumber: number; team: Team; isAlive: boolean }) {
  return <section className={styles.frame} aria-label={`ฉากห้องพักของคุณ ห้อง ${roomNumber} ตัวละคร${roleNames[role]}`}>
    <div className={styles.stage}>
      <Image src="/art/hotel-room-3d.webp" alt="ห้องพักในโรงแรมยามค่ำคืน" fill sizes="(max-width: 1024px) 100vw, 460px" className={styles.room} />
      <div className={styles.caption}><span className={styles.liveDot} /> ห้อง {roomNumber} <span className={styles.captionDivider}>/</span> {roleNames[role]}</div>
      {isAlive && <div className={styles.walkPath} data-character-role={role}>
        <span className={styles.shadow} aria-hidden="true" />
        <div className={styles.bob}>
          <Image src={characters[role]} alt={`ตัวละคร${roleNames[role]}กำลังเดินอยู่ในห้อง ${roomNumber}`} fill sizes="(max-width: 640px) 130px, 180px" className={styles.character} />
        </div>
      </div>}
      <div className={styles.facePortrait}><RolePortrait role={role} className="h-full w-full rounded-full" sizes="50px" /></div>
      <p className={styles.hint}>พื้นที่ส่วนตัว · ตัวละครของคุณ</p>
    </div>
    <div className={styles.meta}><span>{team === "MURDERER" ? "ฝ่ายฆาตกร" : "ฝ่ายผู้บริสุทธิ์"}</span><span className={isAlive ? styles.alive : styles.dead}>{isAlive ? "ยังมีชีวิต" : "เสียชีวิต"}</span></div>
    <div className={styles.ability}><h3>ความสามารถ · {roleNames[role]}</h3><p>{roleSkillDescriptions[role]}</p></div>
  </section>;
}
