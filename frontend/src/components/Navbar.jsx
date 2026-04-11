import { TAGLINE } from "../constants.js";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/85 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[3.5rem] py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/finsight-mark.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg shadow-lg shadow-black/30 ring-1 ring-white/10 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-display font-semibold text-base sm:text-lg text-white tracking-tight leading-tight">
              FINSIGHT
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 leading-snug truncate" title={TAGLINE}>
              {TAGLINE}
            </div>
          </div>
        </div>
        <span className="hidden sm:inline text-xs text-slate-500 font-medium tabular-nums shrink-0">
          Health · Ratios · Structure
        </span>
      </div>
    </nav>
  );
}
