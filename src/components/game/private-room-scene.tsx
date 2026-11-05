import Image from "next/image";
import type { Role, Team } from "@/types/game";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import { roleSkillDescriptions } from "@/lib/role-skills";
import { fullBodyArt } from "@/lib/character-art";
import { avatarById, type AvatarId } from "@/lib/avatars";
import styles from "./private-room-scene.module.css";

export function PrivateRoomScene({ role, roomNumber, team, isAlive, isActive = false, avatarId }: { role: Role; roomNumber: number; team: Team; isAlive: boolean; isActive?: boolean; avatarId?: AvatarId | null }) {
  const avatar = avatarById(avatarId);
  return <section className={styles.frame} data-skill-active={isActive ? "true" : undefined} aria-label={`ฉากห้องพักของคุณ ห้อง ${roomNumber} ตัวละคร${roleNames[role]}`}>
    <div className={styles.stage}>
      <Image src="/art/hotel-room-3d.webp" alt="ห้องพักในโรงแรม" fill sizes="(max-width: 1024px) 100vw, 460px" className={styles.room} />
      {isAlive && isActive && <div className={styles.skillGlow} aria-hidden="true" />}
      <div className={styles.caption}><span className={styles.liveDot} /> ห้อง {roomNumber} <span className={styles.captionDivider}>/</span> {roleNames[role]}</div>
      {isAlive && <div className={styles.walkPath} data-character-role={role}>
        <span className={styles.shadow} aria-hidden="true" />
        <div className={styles.bob}>
          <Image src={avatar?.image ?? fullBodyArt[role]} alt={`${avatar?.name ?? roleNames[role]}กำลังเดินอยู่ในห้อง ${roomNumber}`} fill sizes="(max-width: 640px) 130px, 180px" className={styles.character} />
        </div>
      </div>}
      <div className={styles.facePortrait}>{avatar ? <div className="relative h-full w-full overflow-hidden rounded-full"><Image src={avatar.portrait} alt={avatar.name} fill sizes="50px" className="object-cover object-top" /></div> : <RolePortrait role={role} className="h-full w-full rounded-full" sizes="50px" />}</div>
      <p className={styles.hint}>พื้นที่ส่วนตัว · ตัวละครของคุณ</p>
    </div>
    <div className={styles.meta}><span>{team === "MURDERER" ? "ฝ่ายฆาตกร" : "ฝ่ายผู้บริสุทธิ์"}</span><span className={isAlive ? styles.alive : styles.dead}>{isAlive ? "ยังมีชีวิต" : "เสียชีวิต"}</span></div>
    <div className={styles.ability}><h3>ความสามารถ · {roleNames[role]}</h3><p>{roleSkillDescriptions[role]}</p></div>
  </section>;
}
