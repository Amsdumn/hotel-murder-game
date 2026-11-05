import Image from "next/image";

export function RoomLoadingScreen({ phase, code }: { phase: "creating" | "entering"; code?: string }) {
  const creating = phase === "creating";

  return <main role="status" aria-live="polite" aria-busy="true" className="fixed inset-0 z-[1500] flex items-center justify-center overflow-hidden bg-[#11101b] px-5 text-[#f8f1e4]">
    <Image src="/art/hotel-night.webp" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-35" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,16,27,.75),rgba(17,16,27,.96))]" />
    <div className="relative w-full max-w-md rounded-2xl border border-[#d9b66f]/35 bg-[#211a29]/90 px-7 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,.55)] sm:px-10">
      <div aria-hidden="true" className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#d9b66f]/40 bg-[#d9b66f]/10 text-3xl text-[#d9b66f]">✧</div>
      <p className="text-xs tracking-[.28em] text-[#d9b66f]">คืนนี้ใครฆ่า...</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold">{creating ? "กำลังสร้างห้องเกม" : "กำลังเข้าสู่ห้องเกม"}</h1>
      <p className="mt-4 text-sm leading-7 text-[#c6bdb1]">{creating ? "กำลังเตรียมห้องพักและรหัสสำหรับเพื่อนของคุณ…" : "กำลังเชื่อมต่อและตรวจสอบสิทธิ์เข้าห้อง…"}</p>
      {code && <p className="mt-4 font-mono text-lg tracking-[.2em] text-[#f1d7a9]">{code}</p>}
      <div aria-hidden="true" className="mx-auto mt-8 h-8 w-8 animate-spin rounded-full border-2 border-[#d9b66f]/25 border-t-[#d9b66f] motion-reduce:animate-none" />
    </div>
  </main>;
}
