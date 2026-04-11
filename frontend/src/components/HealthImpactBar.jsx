import { useEffect, useState } from "react";

/**
 * Stacked bar: penalty segments (red tones) + remainder (green) = 100%.
 * Segment widths match each |impact| relative to total points lost from 100.
 */
export default function HealthImpactBar({ breakdown, healthScore }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [breakdown, healthScore]);

  if (!Array.isArray(breakdown) || breakdown.length === 0) return null;

  const penalties = breakdown.filter((b) => b.impact < 0);
  const totalPenaltyMag = penalties.reduce((s, b) => s + Math.abs(b.impact), 0);
  const remainder = typeof healthScore === "number" ? Math.max(0, Math.min(100, healthScore)) : 0;
  /** Width of “lost” zone = 100 - health (matches rounded score when no clamp quirks) */
  const lostZone = Math.max(0, 100 - remainder);

  const segmentWidths =
    totalPenaltyMag > 0 && lostZone > 0
      ? penalties.map((b) => ({
          ...b,
          widthPct: (Math.abs(b.impact) / totalPenaltyMag) * lostZone,
        }))
      : penalties.map((b) => ({ ...b, widthPct: 0 }));

  const lastRed = segmentWidths.length - 1;

  return (
    <div className="mt-8 text-left px-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Health impact
      </p>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800/80 ring-1 ring-white/10"
        role="img"
        aria-label="Breakdown of factors affecting health score"
      >
        {segmentWidths.map((b, i) => (
          <div
            key={b.factor}
            className={[
              "h-full bg-gradient-to-b from-red-400/90 to-red-600/95 border-r border-black/20",
              i === 0 ? "rounded-l-full" : "",
              i === lastRed && remainder <= 0 ? "rounded-r-full" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              width: mounted ? `${b.widthPct}%` : "0%",
              transition: "width 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: `${i * 45}ms`,
            }}
            title={`${b.factor}: ${b.impact}`}
          />
        ))}
        {remainder > 0 ? (
          <div
            className={[
              "h-full bg-gradient-to-b from-emerald-400/85 to-emerald-600/90 rounded-r-full",
              segmentWidths.length === 0 ? "rounded-l-full" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              width: mounted ? `${remainder}%` : "0%",
              transition: "width 0.85s cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: `${segmentWidths.length * 45}ms`,
            }}
          />
        ) : null}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center sm:justify-start text-[11px] sm:text-xs">
        {breakdown.map((b) => (
          <li
            key={b.factor}
            className={[
              "tabular-nums",
              b.impact < 0 ? "text-red-300/95" : "text-emerald-400/90",
            ].join(" ")}
          >
            <span className="text-slate-500">{b.factor}</span>{" "}
            <span className="font-semibold">
              ({b.impact > 0 ? `+${b.impact}` : b.impact})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
