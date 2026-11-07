"use client";

import { LanguageSwitcher, useLanguage } from "@/components/language-switcher";

export function AccessScreen({ invalid, unlock }: { invalid: boolean; unlock: (formData: FormData) => Promise<void> }) {
  const en = useLanguage() === "en";

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_62%_30%,#473048,#10101b_70%)] px-5 py-12 text-[#f8f1e4]">
    <div className="absolute right-5 top-5 sm:right-10 sm:top-8"><LanguageSwitcher /></div>
    <div className="relative w-full max-w-md rounded-2xl border border-[#d9b66f]/35 bg-[#171321]/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,.65)] backdrop-blur-sm sm:p-10">
      <p className="text-center text-sm font-bold tracking-[0.16em] text-[#e7ce98]">✧ {en ? "WHO KILLED TONIGHT?" : "คืนนี้ใครฆ่า..."}</p>
      <h1 className="mt-7 text-center text-2xl font-semibold sm:text-3xl">{en ? "Enter the hotel" : "เข้าสู่โรงแรม"}</h1>
      <p className="mt-3 text-center text-sm leading-6 text-[#c6bdb1]">{en ? "Enter the password to open the game." : "กรอกรหัสผ่านเพื่อเข้าสู่หน้าแรกของเกม"}</p>
      <form action={unlock} className="mt-8 space-y-5">
        <div>
          <label htmlFor="access-password" className="mb-2 block text-sm font-medium text-[#e7ce98]">{en ? "Password" : "รหัสผ่าน"}</label>
          <input id="access-password" name="password" type="password" autoComplete="current-password" required autoFocus aria-invalid={invalid} aria-describedby={invalid ? "access-error" : undefined} className="w-full rounded-lg border border-[#d9b66f]/40 bg-[#100d1a] px-4 py-3 text-[#f8f1e4] outline-none focus:border-[#e7ce98] focus:ring-2 focus:ring-[#e7ce98]/30" />
          {invalid && <p id="access-error" role="alert" className="mt-2 text-sm text-[#ffb4a9]">{en ? "Incorrect password. Please try again." : "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่"}</p>}
        </div>
        <button type="submit" className="w-full rounded-lg bg-[#d9b66f] px-4 py-3 font-semibold text-[#171321] transition-colors hover:bg-[#f0d291] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7ce98]">{en ? "Enter game" : "เข้าสู่เกม"}</button>
      </form>
    </div>
  </main>;
}
