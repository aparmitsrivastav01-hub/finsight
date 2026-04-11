/**
 * Accounting identity: Assets = Liabilities + Equity (within tolerance).
 */
export default function BalanceStatus({ balanced }) {
  const ok = balanced === true;

  return (
    <div
      className={[
        "flex items-center justify-center gap-3 rounded-2xl border px-5 py-4",
        "transition-all duration-300",
        ok
          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200"
          : "border-red-500/25 bg-red-500/[0.07] text-red-200",
      ].join(" ")}
      role="status"
    >
      <span
        className={[
          "h-2.5 w-2.5 rounded-full shrink-0",
          ok ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" : "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]",
        ].join(" ")}
        aria-hidden
      />
      <p className="text-sm sm:text-base font-medium tracking-tight">
        <span className="mr-1.5" aria-hidden>
          {ok ? "🟢" : "🔴"}
        </span>
        {ok ? "Balanced Sheet" : "Mismatch Detected"}
      </p>
      <span className="hidden sm:inline text-xs text-slate-500 max-w-md text-left">
        {ok
          ? "Assets equal liabilities plus equity."
          : "Totals do not satisfy A = L + E — review amounts or classification."}
      </span>
    </div>
  );
}
