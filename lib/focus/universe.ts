export interface FocusEventDef {
  id: string;
  name: string;
  category: "Macro" | "Geopolitics" | "Risk" | "Thematic";
  importance: 1 | 2 | 3;
  description: string;
  direction: "abs" | "risk-off";
  proxies: string[];
  countries: string[];
  indices: string[];
  sectors: string[];
}

export const FOCUS_EVENTS: FocusEventDef[] = [
  { id: "fed-pivot", name: "Fed Easing Path", category: "Macro", importance: 3, description: "US policy rate trajectory: short-end yields, gold and rate-sensitive equities.", direction: "abs", proxies: ["TLT", "GLD", "BIL"], countries: ["United States"], indices: ["SPY", "QQQ"], sectors: ["XLRE", "XLU", "XLF"] },
  { id: "usd-strength", name: "USD Strength Regime", category: "Macro", importance: 3, description: "Dollar Index squeezing EM, commodities, exporters.", direction: "abs", proxies: ["UUP", "FXE", "FXY"], countries: ["US", "EZ", "JP"], indices: ["SPY", "FEZ", "EWJ"], sectors: ["XLB", "XLE"] },
  { id: "inflation-stickiness", name: "Inflation Stickiness", category: "Macro", importance: 2, description: "Persistent core CPI vs. headline disinflation.", direction: "abs", proxies: ["TIP", "DBC", "USO"], countries: ["US", "EZ", "UK"], indices: ["SPY", "EWU"], sectors: ["XLE", "XLP"] },
  { id: "recession-us", name: "US Recession Watch", category: "Risk", importance: 3, description: "Yield curve, cyclical vs defensive, HY spreads.", direction: "risk-off", proxies: ["HYG", "XLY", "XLP"], countries: ["US"], indices: ["SPY", "IWM"], sectors: ["XLY", "XLI"] },
  { id: "eu-slowdown", name: "Eurozone Slowdown", category: "Macro", importance: 2, description: "Bund yields, German auto/industrial exposure, EUR indices.", direction: "risk-off", proxies: ["FEZ", "EWG", "FXE"], countries: ["DE", "FR", "IT"], indices: ["FEZ", "EWG", "EWQ"], sectors: ["XLI"] },
  { id: "china-reopen", name: "China Reopening Stalls", category: "Geopolitics", importance: 2, description: "MSCI China, copper and Hang Seng as China demand proxies.", direction: "risk-off", proxies: ["FXI", "CPER", "EWH"], countries: ["CN", "HK"], indices: ["MCHI", "FXI"], sectors: ["XLB", "XLI"] },
  { id: "middle-east", name: "Middle East Tensions", category: "Geopolitics", importance: 3, description: "Oil shock and safe-haven bid.", direction: "abs", proxies: ["USO", "BNO", "GLD"], countries: ["IL", "IR", "SA"], indices: ["SPY", "KSA"], sectors: ["XLE", "ITA"] },
  { id: "sovereign-debt", name: "Sovereign Debt Risk", category: "Risk", importance: 2, description: "Long-end yields, US fiscal stress, EU peripheral spreads.", direction: "risk-off", proxies: ["TLT", "IEF", "BNDX"], countries: ["US", "IT", "JP"], indices: ["SPY", "FEZ"], sectors: ["XLF"] },
  { id: "ai-capex", name: "AI Capex Cycle", category: "Thematic", importance: 3, description: "Semis, hyperscaler capex, power infrastructure.", direction: "abs", proxies: ["SMH", "QQQ", "XLU"], countries: ["US", "TW", "KR"], indices: ["QQQ", "SMH"], sectors: ["XLK", "XLU"] },
  { id: "energy-squeeze", name: "Energy Squeeze", category: "Risk", importance: 2, description: "European nat gas, US WTI, energy equity leadership.", direction: "abs", proxies: ["XLE", "USO", "UNG"], countries: ["US", "EZ", "RU"], indices: ["SPY", "FEZ"], sectors: ["XLE", "XLU"] },
  { id: "em-stress", name: "EM Financial Stress", category: "Risk", importance: 2, description: "EM equity, FX, USD-denominated EM debt.", direction: "risk-off", proxies: ["EEM", "EMB", "FXI"], countries: ["CN", "BR", "TR", "ZA"], indices: ["EEM", "EWZ"], sectors: ["XLF", "XLB"] },
  { id: "crypto-cycle", name: "Crypto Risk Appetite", category: "Thematic", importance: 1, description: "BTC and crypto-adjacent equities as liquidity barometer.", direction: "abs", proxies: ["BITO", "COIN", "MARA"], countries: ["US"], indices: ["QQQ"], sectors: ["XLK"] },
];

export function focusUniverseTickers(): string[] {
  return Array.from(new Set(FOCUS_EVENTS.flatMap((e) => e.proxies)));
}
