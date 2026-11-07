import { mediaUrl } from "./media-url";
export const AVATAR_ORDER = [
  "adrian-blackwood", "irina-volkova", "somchai-prasert", "marcus-johnson",
  "elena-morales", "oliver-hayes", "amara-okafor", "claire-dubois",
  "seo-yeon-kim", "rafael-costa",
  "anaya-mehta", "yusuf-demir",
] as const;

export type AvatarId = (typeof AVATAR_ORDER)[number];

export interface AvatarProfile {
  id: AvatarId;
  name: string;
  age: number;
  origin: string;
  occupation: string;
  introduction: string;
  color: string;
  image: string;
  portrait: string;
}

export const AVATARS: AvatarProfile[] = [
  { id: "adrian-blackwood", name: "เอเดรียน แบล็กวูด", age: 42, origin: "อังกฤษ", occupation: "แขกผู้มีอดีตลึกลับ", introduction: "นาฬิกาพกของเขาหยุดเดินในคืนที่โรงแรมปิดตาย แต่เอเดรียนยังจำทุกนาทีได้แม่นยำ", color: "#691C32", image: mediaUrl("/art/avatars/adrian-blackwood.webp"), portrait: mediaUrl("/art/avatars/adrian-blackwood-portrait.webp") },
  { id: "irina-volkova", name: "อิรินา โวลโควา", age: 39, origin: "รัสเซีย", occupation: "พนักงานต้อนรับ", introduction: "อิรินาจดชื่อแขกทุกคนด้วยลายมือประณีต เธอสังเกตเห็นคนที่เดินผ่านล็อบบี้โดยไม่มีชื่อในสมุดทะเบียน", color: "#24344D", image: mediaUrl("/art/avatars/irina-volkova.webp"), portrait: mediaUrl("/art/avatars/irina-volkova-portrait.webp") },
  { id: "somchai-prasert", name: "สมชาย ประเสริฐ", age: 58, origin: "ไทย", occupation: "ช่างประจำโรงแรม", introduction: "สมชายถือกุญแจเก่าทุกดอกของโรงแรม เขารู้ว่าประตูบานใดส่งเสียงดังแม้ไม่มีใครอยู่", color: "#A87943", image: mediaUrl("/art/avatars/somchai-prasert.webp"), portrait: mediaUrl("/art/avatars/somchai-prasert-portrait.webp") },
  { id: "marcus-johnson", name: "มาร์คัส จอห์นสัน", age: 34, origin: "สหรัฐอเมริกา", occupation: "ช่างไฟ", introduction: "มาร์คัสขึ้นไปตรวจสายไฟหลังไฟกะพริบทั้งอาคาร แล้วพบว่าบางชั้นมืดก่อนเบรกเกอร์จะตัด", color: "#E6B83F", image: mediaUrl("/art/avatars/marcus-johnson.webp"), portrait: mediaUrl("/art/avatars/marcus-johnson-portrait.webp") },
  { id: "elena-morales", name: "เอเลนา โมราเลส", age: 46, origin: "เม็กซิโก", occupation: "แม่บ้าน", introduction: "เอเลนาจำได้ว่าห้องไหนทิ้งของไว้ผิดที่ และคืนนี้มีรอยเท้าใหม่บนพรมที่เพิ่งทำความสะอาด", color: "#64744B", image: mediaUrl("/art/avatars/elena-morales.webp"), portrait: mediaUrl("/art/avatars/elena-morales-portrait.webp") },
  { id: "oliver-hayes", name: "โอลิเวอร์ เฮย์ส", age: 23, origin: "ออสเตรเลีย", occupation: "คนเช็ดกระจก", introduction: "โอลิเวอร์เห็นเงาสะท้อนที่ไม่ควรอยู่ในหน้าต่างชั้นบน ขณะพายุกำลังปิดทางออกของโรงแรม", color: "#6095B8", image: mediaUrl("/art/avatars/oliver-hayes.webp"), portrait: mediaUrl("/art/avatars/oliver-hayes-portrait.webp") },
  { id: "amara-okafor", name: "อามารา โอโคฟอร์", age: 67, origin: "ไนจีเรีย", occupation: "แขกผู้ทรงเกียรติ", introduction: "อามารากลับมาพักที่นี่เป็นครั้งแรกในรอบหลายสิบปี เธอรู้จักชื่อของคนที่ไม่มีใครกล่าวถึง", color: "#704B87", image: mediaUrl("/art/avatars/amara-okafor.webp"), portrait: mediaUrl("/art/avatars/amara-okafor-portrait.webp") },
  { id: "claire-dubois", name: "แคลร์ ดูบัวส์", age: 36, origin: "ฝรั่งเศส", occupation: "นักสืบเอกชน", introduction: "แคลร์เดินทางมาพร้อมสมุดบันทึกเปล่า คืนแรกในโรงแรมทำให้เธอต้องเติมหน้ากระดาษเร็วกว่าที่คิด", color: "#C7A779", image: mediaUrl("/art/avatars/claire-dubois.webp"), portrait: mediaUrl("/art/avatars/claire-dubois-portrait.webp") },
  { id: "seo-yeon-kim", name: "ซอยอน คิม", age: 31, origin: "เกาหลีใต้", occupation: "นักเปียโน", introduction: "ซอยอนมาพักก่อนการแสดงครั้งสำคัญ คืนที่ไฟดับ เธอได้ยินทำนองสั้น ๆ จากห้องบอลรูม ทั้งที่เปียโนถูกปิดคลุมไว้", color: "#376B69", image: mediaUrl("/art/avatars/seo-yeon-kim.webp"), portrait: mediaUrl("/art/avatars/seo-yeon-kim-portrait.webp") },
  { id: "rafael-costa", name: "ราฟาเอล คอสตา", age: 44, origin: "บราซิล", occupation: "ช่างภาพข่าว", introduction: "ราฟาเอลถ่ายภาพโถงโรงแรมก่อนพายุมาเยือน ในภาพสุดท้ายมีเงาคนอยู่หลังประตู ทั้งที่เขาจำได้ว่าทางเดินว่างเปล่า", color: "#A46A43", image: mediaUrl("/art/avatars/rafael-costa.webp"), portrait: mediaUrl("/art/avatars/rafael-costa-portrait.webp") },
  { id: "anaya-mehta", name: "อานยา เมห์ตา", age: 48, origin: "อินเดีย", occupation: "นักพฤกษศาสตร์", introduction: "อานยามาศึกษาพืชในเรือนกระจกของโรงแรม หลังพายุผ่านเข้ามา เธอพบดินเปียกเป็นรอยรองเท้าทั้งที่ประตูยังล็อกอยู่", color: "#4E6141", image: mediaUrl("/art/avatars/anaya-mehta.webp"), portrait: mediaUrl("/art/avatars/anaya-mehta-portrait.webp") },
  { id: "yusuf-demir", name: "ยูซุฟ เดมีร์", age: 52, origin: "ตุรกี", occupation: "พ่อครัวใหญ่", introduction: "ยูซุฟเตรียมอาหารค่ำให้แขกทุกคน แต่หลังไฟดับ เขากลับพบจานที่ไม่ได้อยู่ในรายการวางบนรถเข็นหน้าห้องครัว", color: "#8C654B", image: mediaUrl("/art/avatars/yusuf-demir.webp"), portrait: mediaUrl("/art/avatars/yusuf-demir-portrait.webp") },
];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATAR_ORDER.some((id) => id === value);
}

export function avatarById(id: AvatarId | null | undefined): AvatarProfile | undefined {
  return AVATARS.find((avatar) => avatar.id === id);
}
