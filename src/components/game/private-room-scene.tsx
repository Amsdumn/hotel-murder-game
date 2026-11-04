import type { Role } from "@/types/game";
import { roleNames } from "@/components/role-portrait";
import styles from "./private-room-scene.module.css";

const costumes: Record<Role, { coat: string; trim: string; hair: string; accessory: string }> = {
  LOCKSMITH: { coat: "#916340", trim: "#e9b96d", hair: "#342824", accessory: "key" },
  HOUSEKEEPER: { coat: "#557e83", trim: "#e7d4aa", hair: "#30242a", accessory: "apron" },
  WINDOW_CLEANER: { coat: "#527b9a", trim: "#d6e8ed", hair: "#43322c", accessory: "cap" },
  WITNESS: { coat: "#876d99", trim: "#e6c8df", hair: "#483033", accessory: "scarf" },
  DETECTIVE: { coat: "#756a62", trim: "#d4a871", hair: "#28262e", accessory: "hat" },
  ACCOMPLICE: { coat: "#764c64", trim: "#da9c98", hair: "#34232d", accessory: "scarf" },
  KILLER: { coat: "#723f50", trim: "#d97882", hair: "#251f29", accessory: "hood" },
};

function Character({ role }: { role: Role }) {
  const costume = costumes[role];
  return <g className={styles.walkPath} data-character-role={role}>
    <ellipse cx="0" cy="3" rx="29" ry="8" fill="#141018" opacity=".38" />
    <g className={styles.bob}>
      <g className={styles.backLeg}>
        <path d="M-13-39 L-2-39 L-4-7 L-17-7Z" fill="#28303b" stroke="#171923" strokeWidth="2" />
        <path d="M-17-8 L-4-8 L-1-1 L-21-1Z" fill="#27222b" />
      </g>
      <g className={styles.frontLeg}>
        <path d="M2-39 L14-39 L17-7 L4-7Z" fill="#343845" stroke="#171923" strokeWidth="2" />
        <path d="M4-8 L17-8 L21-1 L1-1Z" fill="#27222b" />
      </g>
      <path d="M-24-72 Q-29-60-24-39 L22-39 Q28-60 22-72 L12-82 L-13-82Z" fill={costume.coat} stroke="#27212b" strokeWidth="3" />
      <path d="M-11-81 L0-66 L10-81Z" fill={costume.trim} />
      <path d="M0-66 L0-42" stroke="#271e29" strokeWidth="2" />
      <path d="M-23-69 L-31-48 L-24-45 L-15-60M22-69 L30-49 L24-45 L14-61" fill="none" stroke={costume.coat} strokeWidth="10" strokeLinecap="round" />
      <path d="M-31-48 L-27-43 M30-49 L27-44" stroke="#d4a58e" strokeWidth="6" strokeLinecap="round" />
      <path d="M-6-86 L-6-78 Q0-73 6-78 L6-86" fill="#d4a58e" />
      <ellipse cx="0" cy="-102" rx="21" ry="24" fill="#d9ad91" stroke="#5c3f3d" strokeWidth="2" />
      <path d="M-21-103 Q-23-129 0-128 Q21-128 22-105 L18-111 Q11-122-2-118 Q-11-112-20-111Z" fill={costume.hair} />
      <path d="M-12-103 L-7-104 M7-104 L12-103" stroke="#30252a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="-9" cy="-100" r="2" fill="#211e28" /><circle cx="9" cy="-100" r="2" fill="#211e28" />
      <path d="M-3-90 Q0-88 3-90" fill="none" stroke="#965d59" strokeWidth="1.5" strokeLinecap="round" />
      {costume.accessory === "hat" && <g><path d="M-29-121 Q0-131 29-121 L23-116 L-23-116Z" fill="#4c4443" /><path d="M-19-122 L-14-140 Q0-146 15-140 L20-122Z" fill="#5d514a" /><path d="M-17-125 L18-125" stroke="#c4a279" strokeWidth="3" /></g>}
      {costume.accessory === "hood" && <path d="M-24-105 Q-29-137 0-139 Q28-137 24-105 L19-110 Q15-130 0-129 Q-16-130-19-110Z" fill="#542e3c" />}
      {costume.accessory === "cap" && <g><path d="M-22-121 Q0-142 22-121 L21-115 L-21-115Z" fill="#42657b" /><path d="M-6-116 Q13-119 30-113 L24-108Z" fill="#345469" /></g>}
      {costume.accessory === "apron" && <path d="M-13-67 L13-67 L17-42 L-17-42Z" fill="#e7d4aa" opacity=".9" />}
      {costume.accessory === "scarf" && <path d="M-18-79 Q0-67 18-79 L13-70 L-15-69Z" fill={costume.trim} />}
      {costume.accessory === "key" && <g stroke="#f4cf80" strokeWidth="2" fill="none"><circle cx="-25" cy="-43" r="4" /><path d="M-25-39 L-25-32 L-21-32" /></g>}
    </g>
  </g>;
}

export function PrivateRoomScene({ role, roomNumber }: { role: Role; roomNumber: number }) {
  return <section className={styles.frame} aria-label={`ฉากห้องพักของคุณ ห้อง ${roomNumber} ตัวละคร${roleNames[role]}`}>
    <div className={styles.caption}><span className={styles.liveDot} /> ห้อง {roomNumber} <span className={styles.captionDivider}>/</span> {roleNames[role]}</div>
    <svg className={styles.scene} viewBox="0 0 640 330" role="img" aria-label={`ตัวละคร${roleNames[role]}เดินอยู่ในห้อง ${roomNumber}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="room-back" x2="0" y2="1"><stop stopColor="#353747" /><stop offset="1" stopColor="#272932" /></linearGradient>
        <linearGradient id="room-floor" x2="0" y2="1"><stop stopColor="#68616a" /><stop offset="1" stopColor="#3b3541" /></linearGradient>
        <linearGradient id="room-window" x2="0" y2="1"><stop stopColor="#584960" /><stop offset="1" stopColor="#bd8278" /></linearGradient>
      </defs>
      <rect width="640" height="330" fill="#1b1c27" />
      <path d="M42 40 L320 14 L320 185 L42 239Z" fill="#282a37" stroke="#777080" strokeWidth="2" />
      <path d="M320 14 L598 40 L598 239 L320 185Z" fill="url(#room-back)" stroke="#777080" strokeWidth="2" />
      <path d="M42 239 L320 185 L598 239 L320 320Z" fill="url(#room-floor)" stroke="#ab8990" strokeWidth="2" />
      <path d="M51 241 L320 190 L589 241 M108 258 L347 197 M181 279 L415 211 M273 308 L484 226 M203 207 L396 294 M290 190 L491 270" fill="none" stroke="#c3a6a5" strokeOpacity=".16" strokeWidth="2" />
      <path d="M400 53 L536 68 L536 160 L400 145Z" fill="#161e32" stroke="#c5ac9f" strokeWidth="6" />
      <path d="M408 61 L527 74 L527 151 L408 138Z" fill="url(#room-window)" />
      <path d="M466 67 L466 145 M408 101 L527 114" stroke="#d6c3b7" strokeWidth="4" />
      <circle cx="497" cy="89" r="12" fill="#f6c9a2" opacity=".8" />
      <path d="M409 120 Q442 103 466 128 Q495 107 527 135 L527 151 L408 138Z" fill="#3e3549" opacity=".72" />
      <path d="M76 91 L165 79 L165 201 L76 219Z" fill="#3c3945" stroke="#bb9c85" strokeWidth="5" />
      <path d="M140 144 L149 142" stroke="#e8c88b" strokeWidth="4" strokeLinecap="round" />
      <path d="M358 173 L429 183 L482 216 L409 224Z" fill="#211e29" opacity=".35" />
      <path d="M360 166 L426 172 L470 198 L404 207Z" fill="#806f70" stroke="#c1a7a0" strokeWidth="2" />
      <path d="M360 166 L404 207 L404 224 L360 184Z M404 207 L470 198 L470 214 L404 224Z" fill="#4e454f" />
      <path d="M365 164 L399 169 L415 180 L380 176Z" fill="#b7a6a0" />
      <path d="M110 237 L180 219 L214 237 L145 257Z" fill="#261f2b" opacity=".38" />
      <path d="M124 210 L181 198 L204 217 L148 232Z" fill="#8b6b64" stroke="#c79f86" strokeWidth="2" />
      <path d="M124 210 L148 232 L148 247 L124 225Z M148 232 L204 217 L204 231 L148 247Z" fill="#604b4d" />
      <path d="M132 202 L165 194 L183 202 L148 211Z" fill="#d6bb9e" />
      <path d="M186 183 L186 202" stroke="#bd9c81" strokeWidth="4" /><path d="M177 183 L195 183 L190 173 L182 173Z" fill="#e6be87" />
      <path d="M259 218 L382 195 L480 232 L346 274Z" fill="#c4a385" opacity=".08" />
      <Character role={role} />
      <path d="M42 239 L320 185 L598 239" fill="none" stroke="#c6a990" strokeOpacity=".6" strokeWidth="3" />
    </svg>
    <p className={styles.hint}>พื้นที่ส่วนตัว · ตัวละครของคุณ</p>
  </section>;
}
