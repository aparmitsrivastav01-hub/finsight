import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:5000";
console.log("API_BASE:", API_BASE);

const TEST_DATA_CSV = `Metric,2025,2024,Growth
Total Assets,124936,114936,8.7%
Total Equity,87332,81163,7.6%
Total Liabilities,37604,33773,11.3%
Cash & Cash Equivalents,14265,8194,74.1%
Current Assets,77168,0,
Current Liabilities,31762,0,
`;

function toMoney(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ratioValue(v, pct = false) {
  if (typeof v !== "number" || Number.isNaN(v)) return "—";
  if (pct) return `${(v * 100).toFixed(1)}%`;
  return Number(v).toFixed(2);
}

export default function AnalyzePage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showAi, setShowAi] = useState(false);

  const canAnalyze = Boolean(file) && !loading;

  const runAnalyze = async (overrideFile) => {
    const target = overrideFile || file;
    if (!target) {
      setError("Please select a CSV file first.");
      return;
    }
    const rawApiBase = import.meta.env.VITE_API_BASE;
    if (!rawApiBase && !API_BASE) {
      setError("Backend URL not configured");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAi(false);
    try {
      const form = new FormData();
      form.append("file", target);
      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Request failed");
      setResult(json);
    } catch (e) {
      setError(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const useSample = async () => {
    const sample = new File([TEST_DATA_CSV], "finsight-sample.csv", { type: "text/csv" });
    setFile(sample);
    await runAnalyze(sample);
  };

  const overviewRows = useMemo(() => {
    const o = result?.overview || {};
    return [
      ["Total Assets", o.total_assets],
      ["Total Equity (Net Worth)", o.total_equity],
      ["Total Liabilities", o.total_liabilities],
      ["Cash & Cash Equivalents", o.cash_and_equivalents],
      ["Current Assets", o.current_assets],
      ["Current Liabilities", o.current_liabilities],
    ];
  }, [result]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      <header className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white">Balance Sheet Analyzer</h1>
        <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
          Upload your balance sheet CSV and get a simple, beginner-friendly financial health explanation.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-sky-500/20 file:px-4 file:py-2 file:text-sky-300 hover:file:bg-sky-500/30"
          />
          <button
            type="button"
            onClick={() => runAnalyze()}
            disabled={!canAnalyze}
            className="rounded-lg bg-sky-500/80 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-medium"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
          <button
            type="button"
            onClick={useSample}
            disabled={loading}
            className="rounded-lg border border-white/15 hover:border-white/30 text-slate-200 px-4 py-2 text-sm"
          >
            Load Sample Data
          </button>
        </div>
        {file && <p className="mt-3 text-xs text-emerald-300">Selected: {file.name}</p>}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card title="Overview" icon="📊">
            {overviewRows.map(([label, data]) => (
              <Row
                key={label}
                label={label}
                value={toMoney(data?.current)}
                subtitle={
                  typeof data?.growth_pct === "number"
                    ? `${data.growth_pct >= 0 ? "↑" : "↓"} ${Math.abs(data.growth_pct).toFixed(1)}%`
                    : null
                }
              />
            ))}
          </Card>

          <Card title="Ratios" icon="🧮">
            <Row label="Current Ratio" value={ratioValue(result.ratios?.current_ratio)} />
            <Row label="Debt-to-Equity" value={ratioValue(result.ratios?.debt_to_equity)} />
            <Row label="Proprietary Ratio" value={ratioValue(result.ratios?.proprietary_ratio, true)} />
            <Row
              label="Equation Check"
              value={result.equation?.is_balanced ? "Balanced" : "Needs review"}
              subtitle={
                typeof result.equation?.gap === "number"
                  ? `Gap: ${toMoney(Math.abs(result.equation.gap))}`
                  : null
              }
            />
          </Card>

          <Card title="Insights" icon="💡">
            {[
              ...(result.insights?.financial_growth || []),
              ...(result.insights?.liquidity || []),
              ...(result.insights?.solvency || []),
              ...(result.insights?.ownership_strength || []),
              ...(result.insights?.deep || []),
            ].map((line, idx) => (
              <p key={idx} className="text-sm text-slate-200 leading-relaxed mb-2">
                {line}
              </p>
            ))}
          </Card>

          <Card title={result.final_health?.title || "Overall Financial Health"} icon="🩺">
            <p className="text-slate-100 font-medium">{result.final_health?.summary}</p>
            <p className="mt-2 text-sm text-slate-400">
              Risk level:{" "}
              <span className="text-white font-semibold">{result.final_health?.risk_level || "Medium"}</span>
            </p>
            <p className="mt-3 text-xs uppercase tracking-wider text-emerald-300">Strengths</p>
            {(result.final_health?.strengths || []).map((s, idx) => (
              <p key={idx} className="text-sm text-slate-200">• {s}</p>
            ))}
            <p className="mt-3 text-xs uppercase tracking-wider text-amber-300">Concerns</p>
            {(result.final_health?.concerns || ["No major concerns detected."]).map((c, idx) => (
              <p key={idx} className="text-sm text-slate-200">• {c}</p>
            ))}
            <button
              type="button"
              onClick={() => setShowAi((v) => !v)}
              className="mt-4 rounded-lg border border-sky-500/30 text-sky-300 px-3 py-1.5 text-xs hover:bg-sky-500/10"
            >
              {showAi ? "Hide AI Explanation" : "AI Explanation"}
            </button>
            {showAi && <p className="mt-3 text-sm text-slate-300">{result.ai_explanation}</p>}
          </Card>
        </div>
      )}
    </main>
  );
}

function Card({ title, icon, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5">
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, subtitle }) {
  return (
    <div className="py-2 border-b border-white/5 last:border-b-0">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-slate-100 font-medium">{value}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  );
}
