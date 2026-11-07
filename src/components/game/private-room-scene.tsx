"use client";

import Image from "next/image";
import type { Role, Team } from "@/types/game";
import { RolePortrait, roleNames } from "@/components/role-portrait";
import { roleNamesEn } from "@/components/role-portrait";
import { roleSkillDescriptions, roleSkillDescriptionsEn } from "@/lib/role-skills";
import { fullBodyArt } from "@/lib/character-art";
import { avatarById, type AvatarId } from "@/lib/avatars";
import styles from "./private-room-scene.module.css";
import { useLanguage } from "@/components/language-switcher";
import { avatarEnglish } from "@/lib/avatar-translations";
import { mediaUrl } from "@/lib/media-url";

export function PrivateRoomScene({ role, roomNumber, team, isAlive, isActive = false, avatarId }: { role: Role; roomNumber: number; team: Team; isAlive: boolean; isActive?: boolean; avatarId?: AvatarId | null }) {
  const en = useLanguage() === "en";
  const avatar = avatarById(avatarId);
  return <section className={styles.frame} data-skill-active={isActive ? "true" : undefined} aria-label={en ? `Your room scene, room ${roomNumber}, ${roleNamesEn[role]}` : `ฉากห้องพักของคุณ ห้อง ${roomNumber} ตัวละคร${roleNames[role]}`}>
    <div className={styles.stage}>
      <Image src={mediaUrl("/art/hotel-room-3d.webp")} alt={en ? "Hotel room" : "ห้องพักในโรงแรม"} fill sizes="(max-width: 1024px) 100vw, 460px" className={styles.room} />
      {isAlive && isActive && <div className={styles.skillGlow} aria-hidden="true" />}
      <div className={styles.caption}><span className={styles.liveDot} /> {en ? "Room" : "ห้อง"} {roomNumber} <span className={styles.captionDivider}>/</span> {en ? roleNamesEn[role] : roleNames[role]}</div>
      {isAlive && <div className={styles.walkPath} data-character-role={role}>
        <span className={styles.shadow} aria-hidden="true" />
        <div className={styles.bob}>
          <Image src={avatar?.image ?? fullBodyArt[role]} alt={en ? `${avatar ? avatarEnglish[avatar.id].name : roleNamesEn[role]} walking in room ${roomNumber}` : `${avatar?.name ?? roleNames[role]}กำลังเดินอยู่ในห้อง ${roomNumber}`} fill sizes="(max-width: 640px) 130px, 180px" className={styles.character} />
        </div>
      </div>}
      <div className={styles.facePortrait}>{avatar ? <div className="relative h-full w-full overflow-hidden rounded-full"><Image src={avatar.portrait} alt={avatar.name} fill sizes="50px" className="object-cover object-top" /></div> : <RolePortrait role={role} className="h-full w-full rounded-full" sizes="50px" />}</div>
      <p className={styles.hint}>{en ? "Private space · your character" : "พื้นที่ส่วนตัว · ตัวละครของคุณ"}</p>
    </div>
    <div className={styles.meta}><span>{team === "MURDERER" ? en ? "Murderer team" : "ฝ่ายฆาตกร" : en ? "Innocent team" : "ฝ่ายผู้บริสุทธิ์"}</span><span className={isAlive ? styles.alive : styles.dead}>{isAlive ? en ? "Alive" : "ยังมีชีวิต" : en ? "Dead" : "เสียชีวิต"}</span></div>
    <div className={styles.ability}><h3>{en ? "Ability" : "ความสามารถ"} · {en ? roleNamesEn[role] : roleNames[role]}</h3><p>{en ? roleSkillDescriptionsEn[role] : roleSkillDescriptions[role]}</p></div>
  </section>;
}
