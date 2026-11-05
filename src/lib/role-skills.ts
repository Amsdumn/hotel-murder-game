import type { Role } from "@/types/game";

export const roleSkillDescriptions: Record<Role, string> = {
  ELECTRICIAN: "ดับไฟหนึ่งชั้นในเทิร์นที่ใช้สกิล ผู้เล่นบนชั้นนั้นใช้สกิลไม่ได้ ใช้ได้หนึ่งครั้งโดยต้องเว้นหนึ่งเทิร์นก่อนใช้ซ้ำ",
  LOCKSMITH: "ล็อกห้องหนึ่งห้องในรอบนั้น นักฆ่าลอบสังหารห้องที่ล็อกไม่ได้ แต่ยังโหวตเปิดห้องนั้นได้",
  HOUSEKEEPER: "เลือกหนึ่งชั้น แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตบนชั้นนั้นเป็นข้อมูลส่วนตัว",
  WINDOW_CLEANER: "เลือกแนวห้อง 01, 02 หรือ 03 แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตในแนวนั้นตลอดเจ็ดชั้น",
  WITNESS: "เลือกหนึ่งชั้น หากมีห้องที่พบร่องรอยปริศนาบนชั้นนั้น จะทราบว่านักฆ่าอยู่ชั้นสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน",
  DETECTIVE: "ตรวจหนึ่งห้อง ทราบว่าผู้พักที่ยังมีชีวิตอยู่ฝ่ายผู้บริสุทธิ์หรือฝ่ายฆาตกร หรือเป็นห้องว่าง โดยไม่ทราบชื่อและบทบาท",
  RECEPTIONIST: "เมื่อถึงคิวในเทิร์นที่ 3 จะได้รับรายชื่อผู้เล่นทุกคนพร้อมหมายเลขห้องพักแบบส่วนตัวโดยอัตโนมัติ หากเสียชีวิตหรือไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล",
  PHOTOGRAPHER: "เผลอถ่ายภาพติดนักฆ่าไว้ เมื่อถึงคิวในเทิร์นที่ 3 จึงตรวจภาพถ่ายและรู้ชื่อกับหมายเลขผู้เล่นของนักฆ่าแบบส่วนตัวโดยอัตโนมัติ หากเสียชีวิตหรือไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล",
  ACCOMPLICE: "เลือกผู้เล่นหนึ่งคนเพื่อทราบชั้นที่เขาพัก หากเลือกผู้เล่นที่ตายแล้วจะไม่ได้ข้อมูลและถือว่าใช้สกิล ผลเป็นข้อมูลเฉพาะฝ่ายฆาตกร",
  KILLER: "เลือกหนึ่งห้องเพื่อลอบสังหารผู้พักที่ยังมีชีวิต หากห้องไม่ถูกล็อก ทำได้ครั้งเดียวต่อรอบ เมื่อฆ่าสำเร็จห้องนั้นจะแสดงว่าถูกฆาตกรรม แต่ไม่ประกาศชื่อเหยื่อ",
};

export const roleSkillDescriptionsEn: Record<Role, string> = {
  ELECTRICIAN: "Black out one floor for this turn. Players on that floor cannot use their skills. After using it, wait one full turn before using it again.",
  LOCKSMITH: "Lock one room for the turn. The Assassin cannot kill in that room, but players may still vote to open it.",
  HOUSEKEEPER: "Choose a floor and privately learn how many living players are there.",
  WINDOW_CLEANER: "Choose room column 01, 02, or 03 and learn how many living players are in that column across all seven floors.",
  WITNESS: "Choose a floor. If it contains a mysterious clue, learn whether the Assassin is above, below, or on the same floor.",
  DETECTIVE: "Inspect a room and learn whether its living occupant is Innocent or Murderer, or whether it is empty. You do not learn their name or role.",
  RECEPTIONIST: "On your slot in turn 3, automatically receive a private register of every player and room. You receive nothing if you have died or your floor is dark.",
  PHOTOGRAPHER: "You accidentally photographed the Assassin. On your slot in turn 3, privately learn their name and player number. You receive nothing if you have died or your floor is dark.",
  ACCOMPLICE: "Choose a player and learn their floor. A dead player yields no information but still uses your skill. The result is shared only with the Murderer team.",
  KILLER: "Choose a room to kill a living occupant if it is unlocked. You may act once per turn. A successful murder marks the room but does not reveal the victim's name.",
};
