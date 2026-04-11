import { useId, useState } from "react";
import { RATIO_INSIGHTS } from "../ratioInsights.js";

function fmtPlain(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function calcLine(ratioKey, details, ratioValue) {
  const d = details?.[ratioKey];
  if (!d || d.numerator == null || d.denominator == null) {
    return "Not applicable for this dataset (division not defined).";
  }
  const num = fmtPlain(d.numerator);
  const den = fmtPlain(d.denominator);
  const val =
    ratioValue != null && !Number.isNaN(ratioValue)
      ? Number(ratioValue).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : "—";
  return `${num} / ${den} = ${val}`;
}

export default function RatioTooltipRow({ ratioKey, ratioValue, ratioDetails }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const meta = RATIO_INSIGHTS[ratioKey];
  if (!meta) return null;

  const line = calcLine(ratioKey, ratioDetails, ratioValue);

  return (
    <div
      className={open ? "relative z-30 mb-2 pb-1" : "relative z-0 mb-2 pb-1"}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <div className="flex justify-between gap-4 text-sm rounded-lg px-2 py-2 -mx-2 cursor-default border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-sky-500/50">
        <dt className="text-slate-400">
          <span className="border-b border-dotted border-slate-500/60">{meta.title}</span>
        </dt>
        <dd className="text-white font-medium tabular-nums">{fmtPlain(ratioValue)}</dd>
      </div>

      <div
        id={id}
        role="tooltip"
        className={[
          "absolute left-0 right-0 top-full z-20 mt-1 w-full min-w-0",
          "rounded-xl border border-white/10 bg-zinc-950/98 px-4 py-3 text-left shadow-xl shadow-black/40",
          "backdrop-blur-md pointer-events-none",
          "transition-opacity duration-200 ease-out",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{ visibility: open ? "visible" : "hidden" }}
      >
        <p className="font-display text-sm font-semibold text-white">{meta.title}</p>
        <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{meta.meaning}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Formula</p>
        <p className="text-xs text-slate-300 font-medium">{meta.formula}</p>
        {meta.note ? (
          <p className="mt-1 text-[11px] text-slate-500 leading-snug">{meta.note}</p>
        ) : null}
        <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">Your data</p>
        <p className="text-sm text-emerald-200/95 font-medium tabular-nums">{line}</p>
      </div>
    </div>
  );
}
