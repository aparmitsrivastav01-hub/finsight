const accents = {
  green: {
    ring: "ring-emerald-500/25",
    border: "border-emerald-500/30",
    glow: "from-emerald-500/12 to-transparent",
    title: "text-emerald-400",
    bar: "bg-emerald-500",
    rowHover: "hover:bg-emerald-500/5",
    hoverShadow: "hover:shadow-[0_0_48px_-12px_rgba(52,211,153,0.45)]",
  },
  red: {
    ring: "ring-red-500/25",
    border: "border-red-500/30",
    glow: "from-red-500/12 to-transparent",
    title: "text-red-400",
    bar: "bg-red-500",
    rowHover: "hover:bg-red-500/5",
    hoverShadow: "hover:shadow-[0_0_48px_-12px_rgba(248,113,113,0.4)]",
  },
  blue: {
    ring: "ring-sky-500/25",
    border: "border-sky-500/30",
    glow: "from-sky-500/12 to-transparent",
    title: "text-sky-400",
    bar: "bg-sky-500",
    rowHover: "hover:bg-sky-500/5",
    hoverShadow: "hover:shadow-[0_0_48px_-12px_rgba(56,189,248,0.45)]",
  },
};

export default function SummaryCard({
  title,
  accent,
  items,
  total,
  formatMoney,
  /** e.g. "44% of assets" — shown under section total */
  shareOfAssetsLabel,
}) {
  const a = accents[accent] || accents.blue;

  return (
    <article
      className={[
        "relative rounded-2xl overflow-hidden",
        "bg-zinc-900/70 backdrop-blur-sm border",
        a.border,
        "ring-1",
        a.ring,
        "transition-all duration-300 ease-out",
        "hover:scale-105 hover:z-10",
        a.hoverShadow,
        "hover:shadow-black/50",
      ].join(" ")}
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${a.glow} pointer-events-none`} />
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${a.bar} opacity-90`} />

      <div className="relative p-5 sm:p-6">
        <h2 className={`font-display text-lg font-semibold ${a.title}`}>{title}</h2>
        <p className="mt-1 text-2xl font-semibold text-white tracking-tight tabular-nums">
          {formatMoney(total)}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">Section total</p>
        {shareOfAssetsLabel ? (
          <p className="mt-2 text-sm text-slate-400 font-medium tabular-nums">{shareOfAssetsLabel}</p>
        ) : null}

        <ul className="mt-5 space-y-1 max-h-56 overflow-y-auto pr-1 custom-scroll">
          {items?.length ? (
            items.map((row, i) => (
              <li
                key={`${row.item}-${i}`}
                className={[
                  "flex justify-between gap-3 rounded-lg px-2 py-2 text-sm",
                  "transition-colors duration-200",
                  a.rowHover,
                ].join(" ")}
              >
                <span className="text-slate-300 truncate">{row.item}</span>
                <span className="text-slate-400 tabular-nums shrink-0">{formatMoney(row.amount)}</span>
              </li>
            ))
          ) : (
            <li className="text-slate-500 text-sm py-4 text-center">No items</li>
          )}
        </ul>
      </div>
    </article>
  );
}
