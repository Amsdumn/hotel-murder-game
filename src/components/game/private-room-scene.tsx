import Image from "next/image";
import type { Role } from "@/types/game";
import { roleNames } from "@/components/role-portrait";
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

export function PrivateRoomScene({ role, roomNumber }: { role: Role; roomNumber: number }) {
  return <section className={styles.frame} aria-label={`ฉากห้องพักของคุณ ห้อง ${roomNumber} ตัวละคร${roleNames[role]}`}>
    <Image src="/art/hotel-room-3d.webp" alt="ห้องพักในโรงแรมยามค่ำคืน" fill sizes="(max-width: 1024px) 100vw, 460px" className={styles.room} />
    <div className={styles.caption}><span className={styles.liveDot} /> ห้อง {roomNumber} <span className={styles.captionDivider}>/</span> {roleNames[role]}</div>
    <div className={styles.walkPath} data-character-role={role}>
      <span className={styles.shadow} aria-hidden="true" />
      <div className={styles.bob}>
        <Image src={characters[role]} alt={`ตัวละคร${roleNames[role]}กำลังเดินอยู่ในห้อง ${roomNumber}`} fill sizes="(max-width: 640px) 130px, 180px" className={styles.character} />
      </div>
    </div>
    <p className={styles.hint}>พื้นที่ส่วนตัว · ตัวละครของคุณ</p>
  </section>;
}
