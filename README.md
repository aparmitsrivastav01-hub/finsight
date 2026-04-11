# FINSIGHT — Har Balance Sheet Kuch Kehti Hai

React (Vite) + Tailwind frontend and Flask + Pandas backend. Upload a CSV with **Category**, **Item**, and **Amount** columns; the API returns grouped sections, balance validation, share-of-assets percentages, **ratio diagnostics**, and a **0–100 health score** with rule-based **deviations**.

## Project layout

- `frontend/` — React app (**FINSIGHT** + tagline)
- `backend/` — Flask API (`POST /upload`)
- `sample_balance_sheet.csv` — example file for testing

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+

## Run the backend

```powershell
cd "C:\Users\C RR COMPUTERS\Desktop\AI ML\CLASSES\backend"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

API: `http://127.0.0.1:5000` — health check: `GET http://127.0.0.1:5000/health`

## Run the frontend

In a **second** terminal:

```powershell
cd "C:\Users\C RR COMPUTERS\Desktop\AI ML\CLASSES\frontend"
npm install
npm run dev
```

Open **http://127.0.0.1:5173** (Vite dev server). Requests to `/upload` and `/health` are proxied to the Flask app on port 5000.

## Production build (optional)

```powershell
cd frontend
npm run build
npm run preview
```

If the API is not on the same origin, set:

```env
VITE_API_URL=http://127.0.0.1:5000
```

in `frontend/.env` so `fetch` calls the full backend URL.

## CSV format

| Category     | Item              | Amount |
|-------------|-------------------|--------|
| Assets      | Cash              | 50000  |
| Liabilities | Loan              | 20000  |
| Equity      | Capital           | 30000  |

Category values are matched case-insensitively (`Assets`, `Liabilities`, `Equity`). Column names can include common aliases (e.g. `Name` instead of `Item`, `Value` instead of `Amount`).

## Balance sheet health engine (backend)

Until the CSV distinguishes current vs non-current lines, **all assets** are treated as **current assets** and **all liabilities** as **current liabilities** when computing the **current ratio**.

Rules (summary): start at **100**; subtract for imbalance, weak current ratio, high debt-to-equity, and low equity ratio; clamp to **0–100**. Human-readable strings are returned in **`deviations`**.

## API

**`POST /upload`** — multipart form field **`file`** (CSV).

Success JSON (abridged):

```json
{
  "assets": [{ "item": "Cash", "amount": 50000 }],
  "liabilities": [{ "item": "Loan", "amount": 20000 }],
  "equity": [{ "item": "Capital", "amount": 30000 }],
  "totals": { "assets": 50000, "liabilities": 20000, "equity": 30000 },
  "isBalanced": true,
  "percentages": {
    "liabilities_percent": 40.0,
    "equity_percent": 60.0
  },
  "health_score": 87,
  "ratios": {
    "current_ratio": 2.5,
    "debt_to_equity": 0.6667,
    "equity_ratio": 0.6
  },
  "ratio_details": {
    "current_ratio": { "numerator": 50000, "denominator": 20000 },
    "debt_to_equity": { "numerator": 20000, "denominator": 30000 },
    "equity_ratio": { "numerator": 30000, "denominator": 50000 }
  },
  "health_breakdown": [
    { "factor": "Balance Mismatch", "impact": 0 },
    { "factor": "Liquidity", "impact": 0 },
    { "factor": "Debt Level", "impact": 0 },
    { "factor": "Equity cushion", "impact": 0 }
  ],
  "deviations": []
}
```

`ratios` / `ratio_details` entries may be `null` when a denominator is zero. **`health_breakdown`** lists each scoring pillar and its point impact (0 or negative). `isBalanced` uses a small numeric tolerance on **assets = liabilities + equity**.

Errors return `400` with `{ "error": "..." }`.
