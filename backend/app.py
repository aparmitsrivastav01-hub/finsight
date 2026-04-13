from __future__ import annotations

import io
import math
import re
from typing import Any

import openpyxl
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

import os 

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─────────────────────────────────────────────────────────────────────────────
# Shared utilities
# ─────────────────────────────────────────────────────────────────────────────

def _clean(val: Any) -> str:
    if val is None:
        return ""
    return re.sub(r"\s+", " ", str(val).strip().lower())


def _to_float(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if not (isinstance(val, float) and math.isnan(val)) else None
    s = re.sub(r"[,\s]", "", str(val))
    try:
        return float(s)
    except ValueError:
        return None


def _round_ratio(x: float | None) -> float | None:
    if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))):
        return None
    return round(float(x), 4)


# ─────────────────────────────────────────────────────────────────────────────
# Regex patterns (labels are lowercased via _clean before matching)
# ─────────────────────────────────────────────────────────────────────────────

_TOTAL_ASSET_PAT    = re.compile(r"total\s+assets?\b")
_TOTAL_EQUITY_PAT   = re.compile(r"total\s+equity\b")
# "non - current", "non-current", "noncurrent" (flexible separators)
_TOTAL_NC_LIAB_PAT  = re.compile(r"total\s+non[\s\-–]*current\s+liabilit")
_TOTAL_CUR_LIAB_PAT = re.compile(r"total\s+current\s+liabilit")


def _xlsx_row_label(row: tuple[Any, ...]) -> str:
    """Build a single match string from col A and, if useful, col B (B is never used for amounts)."""
    parts: list[str] = []
    if len(row) > 0 and row[0] is not None:
        parts.append(str(row[0]).strip())
    if len(row) > 1 and row[1] is not None:
        b = str(row[1]).strip()
        if b and not re.fullmatch(r"[\d\s.,\-–]+", b):
            parts.append(b)
    return _clean(" ".join(parts))


def _merge_period_amounts(dst: list[float | None], src: list[float | None]) -> None:
    """First non-null per period wins (stable for messy sheets with duplicate labels)."""
    for i in range(min(len(dst), len(src))):
        if dst[i] is None and src[i] is not None:
            dst[i] = src[i]


# ─────────────────────────────────────────────────────────────────────────────
# XLSX parser
# ─────────────────────────────────────────────────────────────────────────────

def _detect_periods(row: tuple) -> list[str]:
    periods = []
    for i, cell in enumerate(row):
        if i < 2:
            continue
        label = _clean(cell)
        if label and "note" not in label:
            periods.append(str(cell).strip() if cell else f"Period {i - 1}")
    return periods


def parse_xlsx_balance_sheet(
    file_bytes: bytes,
    sheet_index: int = 0,
) -> dict[str, Any]:
    """
    V1 simplified parser — totals-only, no section/line-item tracking.

    Strategy: scan every row and match exactly four label patterns:
        - "total assets"
        - "total equity"              (excludes "total equity and liabilities")
        - "total non-current liabilities"
        - "total current liabilities"

    Liabilities = non-current liabilities + current liabilities.

    Returns:
        {
          "periods":     ["March 31, 2025", "March 31, 2024"],
          "totals":      {"assets": [...], "liabilities": [...], "equity": [...]},
          "is_balanced": [bool, ...],
        }
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    ws = wb.worksheets[sheet_index]
    rows = list(ws.iter_rows(values_only=True))

    # ── Step 1: detect header row and period labels ────────────────────────
    header_row_idx: int | None = None
    periods: list[str] = []
    for i, row in enumerate(rows):
        labels = [_clean(c) for c in row if c is not None]
        if any("note" in l for l in labels) or any(re.search(r"\d{4}", l) for l in labels):
            candidate = _detect_periods(row)
            if candidate:
                periods = candidate
                header_row_idx = i
                break

    n = len(periods)
    if n == 0:
        raise ValueError(
            "Could not detect period columns. "
            "Expected a header row with date labels (e.g. 'March 31, 2025')."
        )

    # ── Step 2: scan rows — capture only the four total rows we care about ─
    total_assets: list[float | None] = [None] * n
    total_equity: list[float | None] = [None] * n
    total_ncl:    list[float | None] = [None] * n   # non-current liabilities
    total_cl:     list[float | None] = [None] * n   # current liabilities

    start = (header_row_idx + 1) if header_row_idx is not None else 0

    for row in rows[start:]:
        if not any(c is not None for c in row):
            continue
        label = _xlsx_row_label(row)
        if not label:
            continue

        # Amounts from column C onward only (index 2+); column B ignored for numbers
        amounts: list[float | None] = [
            _to_float(row[i + 2]) if len(row) > i + 2 else None
            for i in range(n)
        ]

        if _TOTAL_ASSET_PAT.search(label) and "liabilit" not in label:
            _merge_period_amounts(total_assets, amounts)
            continue

        # Skip "total equity and liabilities" (contains "liabilit")
        if _TOTAL_EQUITY_PAT.search(label) and "liabilit" not in label:
            _merge_period_amounts(total_equity, amounts)
            continue

        if _TOTAL_NC_LIAB_PAT.search(label):
            _merge_period_amounts(total_ncl, amounts)
            continue

        if _TOTAL_CUR_LIAB_PAT.search(label):
            _merge_period_amounts(total_cl, amounts)
            continue

    # ── Step 3: compute total liabilities = NCL + CL ──────────────────────
    total_liabilities: list[float | None] = []
    for p in range(n):
        ncl = total_ncl[p]
        cl  = total_cl[p]
        if ncl is not None and cl is not None:
            total_liabilities.append(ncl + cl)
        elif ncl is not None:
            total_liabilities.append(ncl)
        elif cl is not None:
            total_liabilities.append(cl)
        else:
            # Last-resort fallback: liabilities = assets - equity
            ta = total_assets[p]
            te = total_equity[p]
            total_liabilities.append((ta - te) if (ta is not None and te is not None) else None)

    # ── Step 4: balance check ──────────────────────────────────────────────
    is_balanced: list[bool] = []
    for p in range(n):
        ta = total_assets[p]      or 0.0
        tl = total_liabilities[p] or 0.0
        te = total_equity[p]      or 0.0
        is_balanced.append(math.isclose(ta, tl + te, rel_tol=0.01, abs_tol=1.0))

    if not any(v is not None for v in total_assets + total_equity + total_ncl + total_cl):
        raise ValueError(
            "Could not find total rows (Total assets, Total equity, "
            "Total non-current liabilities, Total current liabilities). "
            "Check that labels appear in columns A/B and figures start in column C."
        )

    return {
        "periods": periods,
        "totals": {
            "assets":      total_assets,
            "liabilities": total_liabilities,
            "equity":      total_equity,
        },
        "is_balanced": is_balanced,
    }


def _xlsx_line_items_for_period(
    sheet_totals: dict[str, list[float | None]],
    period_idx: int,
) -> dict[str, list[dict[str, Any]]]:
    """Single synthetic row per bucket for one column (period), CSV-shaped {item, amount}."""

    def amt(bucket: str) -> float:
        xs = sheet_totals[bucket]
        if period_idx >= len(xs):
            return 0.0
        v = xs[period_idx]
        return float(v) if v is not None else 0.0

    return {
        "assets": [{"item": "Total Assets", "amount": amt("assets")}],
        "liabilities": [{"item": "Total Liabilities", "amount": amt("liabilities")}],
        "equity": [{"item": "Total Equity", "amount": amt("equity")}],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Health engine (multi-period aware)
# ─────────────────────────────────────────────────────────────────────────────

def _compute_health(ta: float, tl: float, te: float, is_balanced: bool) -> dict[str, Any]:
    current_ratio  = (ta / tl) if tl > 0 else None
    debt_to_equity = (tl / te) if te > 0 else None
    equity_ratio   = (te / ta) if ta > 0 else None

    score = 100.0
    deviations: list[str] = []

    balance_impact = 0.0
    if not is_balanced:
        balance_impact = -30.0
        score += balance_impact
        deviations.append("Balance mismatch detected")

    liquidity_impact = 0.0
    if current_ratio is not None:
        if current_ratio < 1.0:
            liquidity_impact = -25.0
            deviations.append("Low liquidity (Current Ratio < 1)")
        elif current_ratio <= 1.5:
            liquidity_impact = -10.0
            deviations.append("Below-target liquidity (Current Ratio 1-1.5)")
        score += liquidity_impact

    debt_impact = 0.0
    if debt_to_equity is not None:
        if debt_to_equity > 2.0:
            debt_impact = -20.0
            deviations.append("High debt compared to equity")
        elif debt_to_equity >= 1.0:
            debt_impact = -10.0
            deviations.append("Elevated debt relative to equity (D/E 1-2)")
    elif te <= 0.0 and tl > 0.0:
        debt_impact = -20.0
        deviations.append("High debt exposure (liabilities with non-positive equity)")
    score += debt_impact

    equity_impact = 0.0
    if equity_ratio is not None and equity_ratio < 0.3:
        equity_impact = -15.0
        deviations.append("Thin equity cushion (Equity Ratio < 30%)")
    score += equity_impact

    return {
        "health_score": int(max(0, min(100, round(score)))),
        "ratios": {
            "current_ratio":  _round_ratio(current_ratio),
            "debt_to_equity": _round_ratio(debt_to_equity),
            "equity_ratio":   _round_ratio(equity_ratio),
        },
        "health_breakdown": [
            {"factor": "Balance Mismatch", "impact": int(balance_impact)},
            {"factor": "Liquidity",        "impact": int(liquidity_impact)},
            {"factor": "Debt Level",       "impact": int(debt_impact)},
            {"factor": "Equity Cushion",   "impact": int(equity_impact)},
        ],
        "deviations": deviations,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Original CSV helpers (preserved unchanged)
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_ALIASES = ("category", "type", "section", "class")
ITEM_ALIASES     = ("item", "name", "description", "account")
AMOUNT_ALIASES   = ("amount", "value", "balance", "sum")
METRIC_ALIASES   = ("metric", "field", "label", "item", "account", "name")
GROWTH_ALIASES   = ("growth", "change", "pct_change", "percent_change", "delta")


def _normalize_header(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


def _find_column(df: pd.DataFrame, aliases: tuple) -> str | None:
    normalized = {_normalize_header(c): c for c in df.columns}
    for a in aliases:
        if a in normalized:
            return normalized[a]
    return None


def _coerce_amount(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.replace(",", "", regex=False).str.strip()
    return pd.to_numeric(s, errors="coerce")


def _coerce_single_amount(val: Any) -> float | None:
    return _to_float(val)


def _coerce_single_pct(val: Any) -> float | None:
    if val is None:
        return None
    txt = str(val).strip().replace("%", "")
    n = _to_float(txt)
    return float(n) if n is not None else None


def _pick_best_amount_columns(df: pd.DataFrame) -> tuple[str | None, str | None]:
    year_cols: list[tuple[int, str]] = []
    for col in df.columns:
        norm = _normalize_header(col)
        m = re.search(r"(19|20)\d{2}", norm)
        if m:
            year_cols.append((int(m.group(0)), col))
    if len(year_cols) >= 2:
        year_cols.sort(reverse=True)
        return year_cols[0][1], year_cols[1][1]
    if len(year_cols) == 1:
        return year_cols[0][1], None
    current_col = _find_column(df, AMOUNT_ALIASES)
    previous_col = None
    for col in df.columns:
        norm = _normalize_header(col)
        if "previous" in norm or "prior" in norm or "last year" in norm:
            previous_col = col
            break
    return current_col, previous_col


def _build_beginner_summary(
    metrics: dict[str, Any],
    ratios: dict[str, Any],
    insights: dict[str, list[str]],
    final_health: dict[str, Any],
) -> str:
    cr = ratios.get("current_ratio")
    de = ratios.get("debt_to_equity")
    pr = ratios.get("proprietary_ratio")
    risk = final_health.get("risk_level", "Medium")
    pieces = [
        (
            f"The business has a current ratio of {cr}, so it can cover short-term bills comfortably."
            if cr is not None and cr >= 1.5
            else f"The business has a current ratio of {cr}, so short-term cash flow should be watched closely."
            if cr is not None
            else "Current ratio is not available from the uploaded file."
        ),
        (
            f"Debt-to-equity is {de}, which means debt is low compared to owner funds."
            if de is not None and de <= 1
            else f"Debt-to-equity is {de}, so debt pressure may be moderate to high."
            if de is not None
            else "Debt-to-equity could not be calculated due to missing equity."
        ),
        (
            f"Proprietary ratio is {round(pr * 100, 1)}%, showing strong ownership support."
            if pr is not None and pr >= 0.5
            else f"Proprietary ratio is {round(pr * 100, 1)}%, so ownership support is moderate."
            if pr is not None
            else "Proprietary ratio is not available from the data."
        ),
    ]
    top_strength = final_health.get("strengths", [])[:2]
    if top_strength:
        pieces.append("Key strengths: " + "; ".join(top_strength) + ".")
    pieces.append(f"Overall risk level is {risk.lower()}.")
    extra = insights.get("deep", [])
    if extra:
        pieces.append(extra[0])
    return " ".join(pieces)


def _analyze_balance_sheet_csv(file_bytes: bytes) -> dict[str, Any]:
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Could not read CSV: {e!s}") from e

    if df.empty:
        raise ValueError("CSV has no rows.")

    metric_col = _find_column(df, METRIC_ALIASES)
    if not metric_col:
        raise ValueError("CSV must include a metric/field column.")

    current_col, previous_col = _pick_best_amount_columns(df)
    growth_col = _find_column(df, GROWTH_ALIASES)
    if not current_col:
        raise ValueError("CSV must include value data (e.g. Amount or year column).")

    required_patterns = {
        "total_assets": re.compile(r"total\s+assets?", re.I),
        "total_equity": re.compile(r"(total\s+equity|net\s*worth)", re.I),
        "total_liabilities": re.compile(r"total\s+liabilit", re.I),
        "cash": re.compile(r"cash(\s*&\s*cash\s*equivalents?)?|cash\s+equivalents?", re.I),
        "current_assets": re.compile(r"current\s+assets?", re.I),
        "current_liabilities": re.compile(r"current\s+liabilit", re.I),
    }

    extracted: dict[str, dict[str, float | None]] = {
        k: {"current": None, "previous": None, "growth_pct": None} for k in required_patterns
    }

    for _, row in df.iterrows():
        metric_raw = str(row.get(metric_col, "")).strip()
        if not metric_raw:
            continue
        for key, pattern in required_patterns.items():
            if not pattern.search(metric_raw):
                continue
            curr_val = _coerce_single_amount(row.get(current_col)) if current_col else None
            prev_val = _coerce_single_amount(row.get(previous_col)) if previous_col else None
            growth_val = _coerce_single_pct(row.get(growth_col)) if growth_col else None
            if growth_val is None and curr_val is not None and prev_val not in (None, 0):
                growth_val = ((curr_val - prev_val) / prev_val) * 100
            extracted[key] = {"current": curr_val, "previous": prev_val, "growth_pct": growth_val}

    missing = [k for k, v in extracted.items() if v["current"] is None]
    if missing:
        raise ValueError(
            "Missing required metrics: " + ", ".join(missing).replace("_", " ")
        )

    ta = float(extracted["total_assets"]["current"] or 0.0)
    te = float(extracted["total_equity"]["current"] or 0.0)
    tl = float(extracted["total_liabilities"]["current"] or 0.0)
    cash = float(extracted["cash"]["current"] or 0.0)
    ca = float(extracted["current_assets"]["current"] or 0.0)
    cl = float(extracted["current_liabilities"]["current"] or 0.0)

    equation_gap = ta - (tl + te)
    equation_balanced = math.isclose(ta, tl + te, rel_tol=0.01, abs_tol=1.0)
    current_ratio = (ca / cl) if cl > 0 else None
    debt_to_equity = (tl / te) if te > 0 else None
    proprietary_ratio = (te / ta) if ta > 0 else None

    growth_insights = []
    for key, label in (
        ("total_assets", "Total assets"),
        ("total_equity", "Total equity"),
        ("total_liabilities", "Total liabilities"),
        ("cash", "Cash"),
    ):
        gp = extracted[key]["growth_pct"]
        if gp is None:
            continue
        direction = "increased" if gp >= 0 else "decreased"
        growth_insights.append(
            f"{label} {direction} by {abs(round(gp, 1))}% compared with last year."
        )

    liquidity_text = (
        "The company has enough short-term resources to pay upcoming bills comfortably."
        if current_ratio is not None and current_ratio >= 1.5
        else "Short-term payments may become tight, so cash and receivables should be watched."
        if current_ratio is not None
        else "Current ratio cannot be calculated because current liabilities are missing or zero."
    )
    solvency_text = (
        "The company uses very little debt, which keeps long-term financial pressure low."
        if debt_to_equity is not None and debt_to_equity <= 0.5
        else "Debt level is moderate compared to equity, so loan burden should be monitored."
        if debt_to_equity is not None and debt_to_equity <= 1.5
        else "Debt is high compared to equity, which can increase long-term risk."
        if debt_to_equity is not None
        else "Debt-to-equity cannot be calculated because equity is missing or zero."
    )
    ownership_text = (
        "A large part of assets is funded by owners, which gives better stability."
        if proprietary_ratio is not None and proprietary_ratio >= 0.6
        else "Ownership funding is moderate, so the business still depends on liabilities."
        if proprietary_ratio is not None and proprietary_ratio >= 0.4
        else "Ownership funding is low, so stability depends more on outside debt."
        if proprietary_ratio is not None
        else "Proprietary ratio cannot be calculated from the uploaded data."
    )

    deep_insights = [
        "Huge increase in cash means strong earnings or future planning."
        if (extracted["cash"]["growth_pct"] or 0) >= 25
        else "Cash movement is steady, showing controlled day-to-day money management.",
        "Company is investing extra money to earn more income.",
        "Customers are paying on time, which is a healthy sign for working capital.",
        "Higher taxes usually mean higher profits.",
    ]

    strengths = []
    concerns = []
    if equation_balanced:
        strengths.append("Balance sheet equation is consistent.")
    else:
        concerns.append("Assets do not exactly match liabilities plus equity.")
    if current_ratio is not None and current_ratio >= 1.5:
        strengths.append("Short-term liquidity is strong.")
    elif current_ratio is not None:
        concerns.append("Short-term liquidity needs attention.")
    if debt_to_equity is not None and debt_to_equity <= 1:
        strengths.append("Debt level is low relative to equity.")
    elif debt_to_equity is not None:
        concerns.append("Debt level is relatively high against equity.")
    if proprietary_ratio is not None and proprietary_ratio >= 0.5:
        strengths.append("Ownership support is strong.")

    risk_score = 0
    if not equation_balanced:
        risk_score += 2
    if current_ratio is None or current_ratio < 1.2:
        risk_score += 2
    elif current_ratio < 1.5:
        risk_score += 1
    if debt_to_equity is None or debt_to_equity > 1.5:
        risk_score += 2
    elif debt_to_equity > 1.0:
        risk_score += 1
    if proprietary_ratio is None or proprietary_ratio < 0.4:
        risk_score += 2
    elif proprietary_ratio < 0.5:
        risk_score += 1

    risk_level = "Low" if risk_score <= 2 else "Medium" if risk_score <= 4 else "High"
    one_line = (
        "This company is financially very strong with low debt and healthy liquidity."
        if risk_level == "Low"
        else "This company is financially stable but should watch a few risk areas."
        if risk_level == "Medium"
        else "This company has clear financial pressure and needs corrective action."
    )

    ratios = {
        "current_ratio": _round_ratio(current_ratio),
        "debt_to_equity": _round_ratio(debt_to_equity),
        "proprietary_ratio": _round_ratio(proprietary_ratio),
    }
    insights = {
        "financial_growth": growth_insights,
        "liquidity": [f"Current ratio is {_round_ratio(current_ratio)}.", liquidity_text],
        "solvency": [f"Debt-to-equity is {_round_ratio(debt_to_equity)}.", solvency_text],
        "ownership_strength": [
            f"Proprietary ratio is {round((proprietary_ratio or 0) * 100, 1)}%.",
            ownership_text,
        ],
        "deep": deep_insights,
    }
    final_health = {
        "title": "Overall Financial Health",
        "summary": one_line,
        "risk_level": risk_level,
        "strengths": strengths,
        "concerns": concerns,
    }

    metric_payload = {
        "total_assets": extracted["total_assets"],
        "total_equity": extracted["total_equity"],
        "total_liabilities": extracted["total_liabilities"],
        "cash_and_equivalents": extracted["cash"],
        "current_assets": extracted["current_assets"],
        "current_liabilities": extracted["current_liabilities"],
    }

    return {
        "overview": metric_payload,
        "equation": {
            "assets": ta,
            "liabilities_plus_equity": tl + te,
            "gap": round(equation_gap, 2),
            "is_balanced": equation_balanced,
        },
        "ratios": ratios,
        "insights": insights,
        "final_health": final_health,
        "ai_explanation": _build_beginner_summary(metric_payload, ratios, {"deep": deep_insights}, final_health),
    }


def _bucket_category(raw: str) -> str | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    t = str(raw).strip().lower()
    if t in ("asset", "assets"):
        return "assets"
    if t in ("liability", "liabilities"):
        return "liabilities"
    if t in ("equity", "owner equity", "shareholders equity"):
        return "equity"
    return None


def _csv_payload(assets, liabilities, equity, message=None):
    totals = {
        "assets":      float(sum(x["amount"] for x in assets)),
        "liabilities": float(sum(x["amount"] for x in liabilities)),
        "equity":      float(sum(x["amount"] for x in equity)),
    }
    ta, tl, te = totals["assets"], totals["liabilities"], totals["equity"]
    is_balanced = math.isclose(ta, tl + te, rel_tol=0.0, abs_tol=1e-6)
    health = _compute_health(ta, tl, te, is_balanced)
    body: dict[str, Any] = {
        "assets": assets, "liabilities": liabilities, "equity": equity,
        "totals": totals, "isBalanced": is_balanced,
        "percentages": {
            "liabilities_percent": (tl / ta * 100) if ta else None,
            "equity_percent":      (te / ta * 100) if ta else None,
        },
        **health,
    }
    if message:
        body["message"] = message
    return body


# ─────────────────────────────────────────────────────────────────────────────
# Flask routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"ok": True})


@app.route("/upload", methods=["POST"])
def upload_csv():
    """Original CSV endpoint — unchanged."""
    if "file" not in request.files:
        return jsonify({"error": "No file part named 'file' in the request."}), 400
    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"error": "No file selected."}), 400
    if not f.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported."}), 400
    try:
        df = pd.read_csv(io.BytesIO(f.read()))
    except Exception as e:
        return jsonify({"error": f"Could not read CSV: {e!s}"}), 400
    if df.empty:
        return jsonify(_csv_payload([], [], [], message="CSV has no data rows."))
    cat_col  = _find_column(df, CATEGORY_ALIASES)
    item_col = _find_column(df, ITEM_ALIASES)
    amt_col  = _find_column(df, AMOUNT_ALIASES)
    if not cat_col or not item_col or not amt_col:
        return jsonify({"error": f"CSV must include category, item, and amount columns (found: {list(df.columns)})."}), 400
    work = df[[cat_col, item_col, amt_col]].copy()
    work.columns = ["_cat", "_item", "_amt"]
    work["_amt"] = _coerce_amount(work["_amt"])
    if work["_amt"].isna().any():
        bad = work.loc[work["_amt"].isna(), "_item"].astype(str).head(5).tolist()
        return jsonify({"error": "Some amount values could not be parsed.", "examples": bad}), 400
    work["_bucket"] = work["_cat"].map(_bucket_category)
    work = work.dropna(subset=["_bucket"])
    def rows_for(bucket):
        return [{"item": str(r["_item"]).strip(), "amount": float(r["_amt"])}
                for _, r in work[work["_bucket"] == bucket].iterrows()]
    return jsonify(_csv_payload(rows_for("assets"), rows_for("liabilities"), rows_for("equity")))


@app.route("/analyze", methods=["POST"])
def analyze_balance_sheet():
    if "file" not in request.files:
        return jsonify({"error": "No file part named 'file' in the request."}), 400
    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"error": "No file selected."}), 400
    if not f.filename.lower().endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported right now."}), 400
    try:
        result = _analyze_balance_sheet_csv(f.read())
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {e!s}"}), 500


@app.route("/upload/xlsx", methods=["POST"])
def upload_xlsx():
    """
    New endpoint: accepts a real-world multi-period XLSX balance sheet.

    Form fields
    -----------
    file  : required — the .xlsx file
    sheet : optional — 0-based sheet index (default 0)

    Response shape
    --------------
    V1 parser is totals-only. ``line_items`` holds one synthetic row per bucket
    for the primary period (first column, index 0). Top-level ``assets`` /
    ``liabilities`` / ``equity`` mirror that so the CSV dashboard renders.

    {
      "periods": ["March 31, 2025", "March 31, 2024"],
      "line_items": {
        "assets": [{"item": "Total Assets", "amount": 124936}],
        "liabilities": [{"item": "Total Liabilities", "amount": 37604}],
        "equity": [{"item": "Total Equity", "amount": 87332}]
      },
      "analysis": [
        {
          "period": "March 31, 2025",
          "totals": {"assets": 124936, "liabilities": 37604, "equity": 87332},
          "is_balanced": true,
          "percentages": {"liabilities_percent": 30.1, "equity_percent": 69.9},
          "health_score": 80,
          "ratios": {"current_ratio": 3.32, "debt_to_equity": 0.43, "equity_ratio": 0.70},
          "health_breakdown": [...],
          "deviations": []
        },
        ...
      ]
    }

    curl example
    ------------
    curl -X POST http://localhost:5000/upload/xlsx -F "file=@infosysbs.xlsx"
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part named 'file' in the request."}), 400
    f = request.files["file"]
    if not f or f.filename == "":
        return jsonify({"error": "No file selected."}), 400
    if not f.filename.lower().endswith((".xlsx", ".xlsm")):
        return jsonify({"error": "Only .xlsx / .xlsm files are supported by this endpoint."}), 400

    sheet_index = int(request.form.get("sheet", 0))

    try:
        parsed = parse_xlsx_balance_sheet(f.read(), sheet_index=sheet_index)
    except Exception as e:
        return jsonify({"error": f"Could not parse XLSX: {e!s}"}), 400

    periods = parsed["periods"]
    totals  = parsed["totals"]
    n       = len(periods)

    analysis = []
    for p in range(n):
        ta = totals["assets"][p] or 0.0
        tl = totals["liabilities"][p] or 0.0
        te = totals["equity"][p] or 0.0
        health = _compute_health(ta, tl, te, parsed["is_balanced"][p])
        analysis.append({
            "period":      periods[p],
            "totals":      {"assets": ta, "liabilities": tl, "equity": te},
            "is_balanced": parsed["is_balanced"][p],
            "percentages": {
                "liabilities_percent": round(tl / ta * 100, 2) if ta else None,
                "equity_percent":      round(te / ta * 100, 2) if ta else None,
            },
            **health,
        })

    primary_idx = 0
    line_items = _xlsx_line_items_for_period(totals, primary_idx)
    a0 = analysis[primary_idx]

    return jsonify({
        "periods": periods,
        "line_items": line_items,
        "analysis": analysis,
        "assets": line_items["assets"],
        "liabilities": line_items["liabilities"],
        "equity": line_items["equity"],
        "totals": a0["totals"],
        "isBalanced": a0["is_balanced"],
        "percentages": a0["percentages"],
        **{k: v for k, v in a0.items() if k not in ("period", "totals", "is_balanced", "percentages")},
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)