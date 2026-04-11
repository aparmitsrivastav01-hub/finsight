/** Short copy for non-finance users — formulas match backend assumptions */

export const RATIO_INSIGHTS = {
  current_ratio: {
    title: "Current Ratio",
    meaning: "Measures ability to pay short-term obligations.",
    formula: "Current Assets ÷ Current Liabilities",
    note: "Here, all uploaded assets and liabilities are treated as current until you split them.",
  },
  debt_to_equity: {
    title: "Debt-to-Equity",
    meaning: "Shows how much debt is used compared to equity.",
    formula: "Total Liabilities ÷ Total Equity",
  },
  equity_ratio: {
    title: "Equity Ratio",
    meaning: "Proportion of assets financed by owner equity.",
    formula: "Total Equity ÷ Total Assets",
  },
};
