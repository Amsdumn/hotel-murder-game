import type { Role } from "@/types/game";

export const roleSkillDescriptions: Record<Role, string> = {
  ELECTRICIAN: "ดับไฟหนึ่งชั้นในเทิร์นที่ใช้สกิล ผู้เล่นบนชั้นนั้นใช้สกิลไม่ได้ ใช้ได้หนึ่งครั้งโดยต้องเว้นหนึ่งเทิร์นก่อนใช้ซ้ำ",
  LOCKSMITH: "ล็อกห้องหนึ่งห้องในรอบนั้น และห้ามเลือกห้องที่เคยล็อกในรอบก่อนอีก นักฆ่าลอบสังหารห้องที่ล็อกไม่ได้ แต่ยังโหวตเปิดห้องนั้นได้",
  HOUSEKEEPER: "เลือกหนึ่งชั้น แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตบนชั้นนั้นเป็นข้อมูลส่วนตัว",
  WINDOW_CLEANER: "เลือกแนวห้อง 01, 02 หรือ 03 แล้วทราบจำนวนผู้เล่นที่ยังมีชีวิตในแนวนั้นครบทุกชั้นของเกม",
  WITNESS: "เลือกหนึ่งชั้น หากนักฆ่าเลือกห้องใดห้องหนึ่งบนชั้นนั้นเพื่อลอบสังหารในรอบนี้ ไม่ว่าจะสำเร็จหรือไม่ จะทราบว่านักฆ่าอยู่ชั้นสูงกว่า ต่ำกว่า หรือชั้นเดียวกัน",
  DETECTIVE: "ตรวจหนึ่งห้อง ทราบว่าผู้พักที่ยังมีชีวิตอยู่ฝ่ายผู้บริสุทธิ์หรือฝ่ายฆาตกร หรือเป็นห้องว่าง โดยไม่ทราบชื่อและบทบาท",
  FORMER_POLICE: "เมื่อถึงคิวในแต่ละเทิร์น รับคำใบ้ส่วนตัวเกี่ยวกับตัวละครสาธารณะของนักฆ่าโดยอัตโนมัติ: เทิร์น 1 เพศ, เทิร์น 2 ช่วงอายุ, เทิร์น 3 สีผมและโทนสีผิว, เทิร์น 4 ประเทศเกิด หากเสียชีวิตหรือไฟดับก่อนถึงคิวจะไม่ได้คำใบ้",
  RECEPTIONIST: "เมื่อถึงคิวในเทิร์นที่ 3 จะได้รับรายชื่อผู้เล่นทุกคนพร้อมหมายเลขห้องพักแบบส่วนตัวโดยอัตโนมัติ หากเสียชีวิตหรือไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล",
  PHOTOGRAPHER: "เผลอถ่ายภาพติดนักฆ่าไว้ เมื่อถึงคิวในเทิร์นที่ 3 จึงตรวจภาพถ่ายและรู้ชื่อกับหมายเลขผู้เล่นของนักฆ่าแบบส่วนตัวโดยอัตโนมัติ หากเสียชีวิตหรือไฟดับก่อนถึงคิวจะไม่ได้ข้อมูล",
  ACCOMPLICE: "เลือกผู้เล่นที่ยังมีชีวิตหนึ่งคนเพื่อทราบชั้นที่เขาพัก ผู้เข้าพักที่เสียชีวิตเลือกไม่ได้ ผลเป็นข้อมูลเฉพาะฝ่ายฆาตกร",
  KILLER: "เลือกหนึ่งห้องเพื่อลอบสังหารผู้พักที่ยังมีชีวิต หากห้องไม่ถูกล็อก ทำได้ครั้งเดียวต่อรอบ เกม 5 คนไม่มีผู้สมรู้ร่วมคิด และในเทิร์นที่ 2 นักฆ่าต้องเลือกสองห้องที่ต่างกัน ซึ่งสังหารได้ทั้งสองห้อง เมื่อฆ่าสำเร็จห้องนั้นจะแสดงว่าถูกฆาตกรรม แต่ไม่ประกาศชื่อเหยื่อ",
};

export const roleSkillDescriptionsEn: Record<Role, string> = {
  ELECTRICIAN: "Black out one floor for this turn. Players on that floor cannot use their skills. After using it, wait one full turn before using it again.",
  LOCKSMITH: "Protect one room per turn. A room protected in an earlier turn cannot be chosen again. The Assassin cannot kill in the locked room, but players may still vote to open it.",
  HOUSEKEEPER: "Choose a floor and privately learn how many living players are there.",
  WINDOW_CLEANER: "Choose room column 01, 02, or 03 and learn how many living players are in that column across every floor in this game.",
  WITNESS: "Choose a floor. If the Assassin targeted any room on that floor this turn, learn whether the Assassin is above, below, or on the same floor, even if the assassination failed.",
  DETECTIVE: "Inspect a room and learn whether its living occupant is Innocent or Murderer, or whether it is empty. You do not learn their name or role.",
  FORMER_POLICE: "On your slot each turn, automatically receive a private clue about the Assassin's public character: turn 1 gender, turn 2 age range, turn 3 hair color and broad skin tone, turn 4 country of birth. You receive no clue if dead or blacked out before your slot.",
  RECEPTIONIST: "On your slot in turn 3, automatically receive a private register of every player and room. You receive nothing if you have died or your floor is dark.",
  PHOTOGRAPHER: "You accidentally photographed the Assassin. On your slot in turn 3, privately learn their name and player number. You receive nothing if you have died or your floor is dark.",
  ACCOMPLICE: "Choose a living player and learn their floor. Dead guests cannot be selected. The result is shared only with the Murderer team.",
  KILLER: "Choose a room to kill a living occupant if it is unlocked. You may act once per turn. In a five-player game there is no Accomplice, and on turn two you must choose two distinct rooms; both can kill their occupants. A successful murder marks the room but does not reveal the victim's name.",
};
