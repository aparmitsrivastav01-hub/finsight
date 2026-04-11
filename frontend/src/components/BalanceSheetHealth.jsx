import { useCallback, useEffect, useState } from "react";
import HealthImpactBar from "./HealthImpactBar.jsx";
import RatioTooltipRow from "./RatioTooltipRow.jsx";

function healthBand(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "neutral";
  if (score >= 80) return "healthy";
  if (score >= 50) return "moderate";
  return "risky";
}

function statusLabel(score) {
  const b = healthBand(score);
  if (b === "healthy") return "Healthy";
  if (b === "moderate") return "Moderate";
  return "Risky";
}

export default function BalanceSheetHealth({ healthScore, healthBreakdown, onOpenDetails }) {
  const band = healthBand(healthScore);
  const status = statusLabel(healthScore);

  const ring =
    band === "healthy"
      ? "from-emerald-400/30 via-emerald-500/10 to-transparent shadow-[0_0_60px_-12px_rgba(52,211,153,0.35)]"
      : band === "moderate"
        ? "from-amber-400/25 via-amber-500/10 to-transparent shadow-[0_0_50px_-14px_rgba(251,191,36,0.25)]"
        : "from-red-400/25 via-red-500/10 to-transparent shadow-[0_0_55px_-12px_rgba(248,113,113,0.35)]";

  const scoreColor =
    band === "healthy" ? "text-emerald-300" : band === "moderate" ? "text-amber-200" : "text-red-300";

  return (
    <div
      className={[
        "relative max-w-lg mx-auto rounded-2xl overflow-hidden",
        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "ring-1 ring-white/5 transition-all duration-300 hover:ring-white/10",
      ].join(" ")}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${ring} pointer-events-none`} />
      <div className="relative px-6 sm:px-8 py-10 sm:py-12 text-center">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">
          Balance Sheet Health
        </h2>
        <p className={`font-display text-5xl sm:text-6xl font-bold tabular-nums ${scoreColor}`}>
          {typeof healthScore === "number" ? `${healthScore}%` : "—"}
        </p>
        <p className="mt-2 text-slate-400 text-sm font-medium">{status}</p>

        {Array.isArray(healthBreakdown) && healthBreakdown.length > 0 ? (
          <HealthImpactBar breakdown={healthBreakdown} healthScore={healthScore} />
        ) : null}

        <button
          type="button"
          onClick={onOpenDetails}
          className={[
            "mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold",
            "bg-white/10 text-white border border-white/15",
            "hover:bg-white/15 hover:border-white/25 transition-all duration-300",
            "active:scale-[0.98]",
          ].join(" ")}
        >
          View Analysis
          <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function HealthAnalysisModal({ open, onClose, ratios, ratioDetails, deviations }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stop = useCallback((e) => e.stopPropagation(), []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="health-analysis-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        aria-label="Close analysis"
        onClick={onClose}
      />
      <div
        onClick={stop}
        className={[
          "relative w-full max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl",
          "border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl shadow-black/50",
          "ring-1 ring-white/10 animate-fade-in",
        ].join(" ")}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-white/5 bg-zinc-900/90 px-5 py-4 backdrop-blur-md z-10">
          <h3 id="health-analysis-title" className="font-display font-semibold text-white">
            Detailed analysis
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-8">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Ratios
            </h4>
            <p className="text-xs text-slate-500 mb-4">
              Hover a row for a plain-language meaning and the exact numbers behind the ratio.
            </p>
            <dl className="space-y-1 rounded-xl border border-white/5 bg-black/20 p-3 sm:p-4">
              <RatioTooltipRow
                ratioKey="current_ratio"
                ratioValue={ratios?.current_ratio}
                ratioDetails={ratioDetails}
              />
              <RatioTooltipRow
                ratioKey="debt_to_equity"
                ratioValue={ratios?.debt_to_equity}
                ratioDetails={ratioDetails}
              />
              <RatioTooltipRow
                ratioKey="equity_ratio"
                ratioValue={ratios?.equity_ratio}
                ratioDetails={ratioDetails}
              />
            </dl>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Deviations
            </h4>
            {deviations?.length ? (
              <ul className="space-y-2">
                {deviations.map((d, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/95"
                  >
                    <span className="shrink-0 text-amber-400/90" aria-hidden>
                      ⚠
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/90">
                No rule-based issues flagged for this snapshot.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
