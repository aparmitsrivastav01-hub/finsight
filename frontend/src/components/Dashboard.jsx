import { useEffect, useState } from "react";
import BalanceStatus from "./BalanceStatus.jsx";
import BalanceSheetHealth, { HealthAnalysisModal } from "./BalanceSheetHealth.jsx";
import SummaryCard from "./SummaryCard.jsx";

function formatMoney(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}%`;
}

export default function Dashboard({ data, loading, error }) {
  const [analysisOpen, setAnalysisOpen] = useState(false);

  useEffect(() => {
    if (!data) setAnalysisOpen(false);
  }, [data]);

  if (loading) {
    return null;
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-10 text-center text-slate-500 text-sm">
        Fix the issue above and upload again to see your dashboard.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center animate-fade-in">
        <p className="font-display text-lg text-slate-300 mb-2">No data yet</p>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Upload a CSV to see your balance sheet, health score, and rule-based liquidity and solvency
          signals.
        </p>
      </div>
    );
  }

  const {
    assets = [],
    liabilities = [],
    equity = [],
    totals = {},
    message,
    isBalanced,
    percentages = {},
    health_score: healthScore,
    ratios,
    ratio_details: ratioDetails,
    health_breakdown: healthBreakdown,
    deviations,
  } = data;

  const empty =
    assets.length === 0 && liabilities.length === 0 && equity.length === 0;

  const liabPct = formatPct(percentages.liabilities_percent);
  const eqPct = formatPct(percentages.equity_percent);
  const ta = totals.assets;

  const liabilitiesInsight =
    ta > 0 && liabPct != null ? `${liabPct} of Assets` : ta === 0 ? "— of Assets (no assets)" : null;
  const equityInsight =
    ta > 0 && eqPct != null ? `${eqPct} of Assets` : ta === 0 ? "— of Assets (no assets)" : null;

  const showBalanceRow =
    typeof isBalanced === "boolean" && (!empty || message);

  const showHealth = typeof healthScore === "number";

  return (
    <div className="space-y-8 animate-fade-in">
      {message && (
        <p className="text-center text-amber-400/90 text-sm border border-amber-500/20 rounded-xl py-2 px-4 bg-amber-500/5">
          {message}
        </p>
      )}

      {showHealth && (
        <>
          <BalanceSheetHealth
            healthScore={healthScore}
            healthBreakdown={Array.isArray(healthBreakdown) ? healthBreakdown : []}
            onOpenDetails={() => setAnalysisOpen(true)}
          />
          <HealthAnalysisModal
            open={analysisOpen}
            onClose={() => setAnalysisOpen(false)}
            ratios={ratios}
            ratioDetails={ratioDetails && typeof ratioDetails === "object" ? ratioDetails : {}}
            deviations={deviations}
          />
        </>
      )}

      {showBalanceRow && <BalanceStatus balanced={isBalanced} />}

      {empty && !message && (
        <p className="text-center text-slate-500 text-sm">Parsed file has no categorized rows.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
        <SummaryCard
          title="Assets"
          accent="green"
          items={assets}
          total={totals.assets}
          formatMoney={formatMoney}
        />
        <SummaryCard
          title="Liabilities"
          accent="red"
          items={liabilities}
          total={totals.liabilities}
          formatMoney={formatMoney}
          shareOfAssetsLabel={liabilitiesInsight}
        />
        <SummaryCard
          title="Equity"
          accent="blue"
          items={equity}
          total={totals.equity}
          formatMoney={formatMoney}
          shareOfAssetsLabel={equityInsight}
        />
      </div>
    </div>
  );
}
