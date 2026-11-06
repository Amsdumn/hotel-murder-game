import packageJson from "../../package.json";

export function AppVersion() {
  return (
    <span className="pointer-events-none fixed bottom-3 right-3 z-20 rounded-md border border-white/15 bg-[#100d17]/75 px-2 py-1 text-[11px] font-medium text-[#e8dbca]/80 shadow-sm backdrop-blur-sm">
      v{packageJson.version}
    </span>
  );
}
