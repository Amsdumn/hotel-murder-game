import type { Language } from "./language";

const exact: Record<string, string> = {
  "กำลังดำเนินการสืบสวน...": "Investigation in progress...",
  "เกิดเหตุฆาตกรรมขึ้นภายในโรงแรม": "A murder has occurred in the hotel",
  "ลอบสังหารสำเร็จ": "Assassination succeeded",
  "ลอบสังหารไม่สำเร็จ": "Assassination failed",
  "เลือกเป้าหมายแล้ว กำลังประมวลผล": "Target chosen. Resolving the action",
  "ไม่พบเบาะแสทิศทาง": "No directional clue found",
  "ไม่พบข้อมูลชั้นของผู้เล่นที่เลือก": "No floor information for the selected player",
  "หมดเวลาใช้สกิล": "Skill time expired",
  "ใช้สกิลไม่ได้เนื่องจากไฟดับบนชั้นของคุณ": "You cannot use your skill because your floor is dark",
  "สกิลช่างไฟกำลังพักหนึ่งเทิร์น": "The Electrician skill is cooling down this turn",
  "เปิดทะเบียนห้องพักแล้ว": "Room register opened",
  "ตรวจภาพถ่ายแล้ว": "Photographs reviewed",
  "คุณถูกลอบสังหาร": "You were assassinated",
  "คุณเสียชีวิตจากการเปิดห้อง": "You died when your room was opened",
  "คุณเสียชีวิตจากที่เกิดเหตุเริ่มต้น": "You died at the initial crime scene",
  "ฝ่ายผู้บริสุทธิ์ชนะ": "The Innocent team wins",
  "ฝ่ายฆาตกรชนะ": "The Murderer team wins",
  "ใช้สกิล": "Use skill",
};

function dynamic(message: string): string | null {
  let match: RegExpMatchArray | null;
  if ((match = message.match(/^พบร่องรอยปริศนาในห้อง (.+)$/))) return `Mysterious clues found in rooms ${match[1]}`;
  if ((match = message.match(/^เปิดห้อง (\d+) · (ห้องว่าง|มีผู้พัก)$/))) return `Room ${match[1]} opened · ${match[2] === "ห้องว่าง" ? "empty" : "occupied"}`;
  if ((match = message.match(/^รอบ (\d+): เริ่มโหวตตัดสิน$/))) return `Turn ${match[1]}: runoff voting begins`;
  if ((match = message.match(/^รอบ (\d+): เริ่มช่วง(ใช้สกิล|พูดคุย|ลงคะแนน|เฉลยผลการเปิดห้อง)$/))) return `Turn ${match[1]}: ${({ "ใช้สกิล": "skill phase", "พูดคุย": "discussion", "ลงคะแนน": "voting", "เฉลยผลการเปิดห้อง": "room resolution" } as Record<string, string>)[match[2]]} begins`;
  if ((match = message.match(/^ดับไฟชั้น (\d+) แล้วในเทิร์นนี้$/))) return `Floor ${match[1]} is blacked out this turn`;
  if ((match = message.match(/^ล็อกห้อง (\d+) แล้ว$/))) return `Room ${match[1]} is locked`;
  if ((match = message.match(/^ชั้น (\d+) มีผู้เล่นที่ยังมีชีวิต (\d+) คน$/))) return `Floor ${match[1]} has ${match[2]} living players`;
  if ((match = message.match(/^แนวห้อง 0(\d) มีผู้เล่นที่ยังมีชีวิต (\d+) คน$/))) return `Column 0${match[1]} has ${match[2]} living players`;
  if ((match = message.match(/^ทิศทางชั้นนักฆ่า: (ABOVE|BELOW|SAME_FLOOR)$/))) return `Assassin's floor: ${match[1] === "SAME_FLOOR" ? "same floor" : match[1].toLowerCase()}`;
  if ((match = message.match(/^ผลตรวจห้อง (\d+): (INNOCENT|MURDERER|EMPTY)$/))) return `Room ${match[1]}: ${({ INNOCENT: "Innocent", MURDERER: "Murderer", EMPTY: "empty" } as Record<string, string>)[match[2]]}`;
  if ((match = message.match(/^ผู้เล่นที่เลือกอยู่ชั้น (\d+)$/))) return `The selected player is on floor ${match[1]}`;
  if ((match = message.match(/^ภาพถ่ายเทิร์นที่ 3: นักฆ่าคือผู้เล่น (\d+) (.+)$/))) return `Turn 3 photograph: the Assassin is player ${match[1]} ${match[2]}`;
  if ((match = message.match(/^(.+) โหวตห้อง (\d+)$/))) return `${match[1]} voted for room ${match[2]}`;
  if ((match = message.match(/^โหวต(ตัดสิน)?ห้อง (\d+)$/))) return `${match[1] ? "Runoff vote" : "Vote"} for room ${match[2]}`;
  if ((match = message.match(/^ลอบสังหารห้อง (\d+): (สำเร็จ|ไม่สำเร็จ)$/))) return `Assassinate room ${match[1]}: ${match[2] === "สำเร็จ" ? "succeeded" : "failed"}`;
  return null;
}

export function gameMessage(message: string, language: Language): string {
  if (language === "th") return message;
  if (message.startsWith("ใช้สกิล: ")) return `Skill: ${gameMessage(message.slice("ใช้สกิล: ".length), language)}`;
  return exact[message] ?? dynamic(message) ?? message;
}
