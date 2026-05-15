import { getManySeries, type Series } from "@/lib/markets/series";
import { DashboardClient, type DashboardPayload } from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 600;

const GROUPS: Array<{ key: string; label: string; tickers: Array<{ t: string; n: string }>; benchmark: string }> = [
  {
    key: "indices",
    label: "Indices",
    benchmark: "SPY",
    tickers: [
      { t: "SPY", n: "S&P 500" },
      { t: "QQQ", n: "Nasdaq 100" },
      { t: "IWM", n: "Russell 2000" },
      { t: "DIA", n: "Dow 30" },
      { t: "FEZ", n: "Euro Stoxx 50" },
      { t: "EWJ", n: "Japan" },
      { t: "EEM", n: "EM Equities" },
      { t: "ACWI", n: "All Country World" },
    ],
  },
  {
    key: "sectors",
    label: "US Sectors",
    benchmark: "SPY",
    tickers: [
      { t: "XLK", n: "Technology" },
      { t: "XLF", n: "Financials" },
      { t: "XLE", n: "Energy" },
      { t: "XLV", n: "Health Care" },
      { t: "XLY", n: "Consumer Disc." },
      { t: "XLP", n: "Consumer Staples" },
      { t: "XLI", n: "Industrials" },
      { t: "XLU", n: "Utilities" },
      { t: "XLB", n: "Materials" },
      { t: "XLRE", n: "Real Estate" },
      { t: "XLC", n: "Communication" },
    ],
  },
  {
    key: "industries",
    label: "Industries",
    benchmark: "SPY",
    tickers: [
      { t: "SMH", n: "Semiconductors" },
      { t: "SOXX", n: "Semis (PHLX)" },
      { t: "IGV", n: "Software" },
      { t: "CIBR", n: "Cybersecurity" },
      { t: "FINX", n: "FinTech" },
      { t: "KWEB", n: "China Internet" },
      { t: "IBB", n: "Biotech" },
      { t: "IHI", n: "Medical Devices" },
      { t: "KBE", n: "Banks" },
      { t: "KRE", n: "Regional Banks" },
      { t: "KIE", n: "Insurance" },
      { t: "OIH", n: "Oil Services" },
      { t: "XOP", n: "Oil & Gas E&P" },
      { t: "GDX", n: "Gold Miners" },
      { t: "GDXJ", n: "Junior Gold Miners" },
      { t: "COPX", n: "Copper Miners" },
      { t: "LIT", n: "Lithium & Battery" },
      { t: "URA", n: "Uranium" },
      { t: "JETS", n: "Airlines" },
      { t: "ITA", n: "Aerospace & Defense" },
      { t: "ITB", n: "Homebuilders" },
      { t: "IYR", n: "Real Estate (broad)" },
      { t: "IYT", n: "Transportation" },
      { t: "XRT", n: "Retail" },
    ],
  },
  {
    key: "factors",
    label: "Factors & Styles",
    benchmark: "SPY",
    tickers: [
      { t: "VUG", n: "Growth" },
      { t: "VTV", n: "Value" },
      { t: "MTUM", n: "Momentum" },
      { t: "QUAL", n: "Quality" },
      { t: "USMV", n: "Min-Vol" },
      { t: "VIG", n: "Dividend Growth" },
      { t: "SCHD", n: "High-Dividend" },
      { t: "SPHB", n: "High-Beta" },
      { t: "SPLV", n: "Low-Volatility" },
      { t: "RSP", n: "Equal-Weight S&P" },
    ],
  },
  {
    key: "regions",
    label: "Regions",
    benchmark: "ACWI",
    tickers: [
      { t: "SPY", n: "US" },
      { t: "VGK", n: "Europe" },
      { t: "EWG", n: "Germany" },
      { t: "EWQ", n: "France" },
      { t: "EWI", n: "Italy" },
      { t: "EWU", n: "UK" },
      { t: "EWJ", n: "Japan" },
      { t: "MCHI", n: "China" },
      { t: "INDA", n: "India" },
      { t: "EWZ", n: "Brazil" },
      { t: "EWW", n: "Mexico" },
      { t: "EWA", n: "Australia" },
      { t: "EWC", n: "Canada" },
    ],
  },
  {
    key: "fx",
    label: "FX",
    benchmark: "UUP",
    tickers: [
      { t: "UUP", n: "Dollar Index" },
      { t: "FXE", n: "EUR/USD" },
      { t: "FXY", n: "JPY/USD" },
      { t: "FXB", n: "GBP/USD" },
      { t: "FXC", n: "CAD/USD" },
      { t: "FXA", n: "AUD/USD" },
      { t: "FXF", n: "CHF/USD" },
      { t: "CYB", n: "CNY/USD" },
    ],
  },
  {
    key: "rates",
    label: "Rates",
    benchmark: "AGG",
    tickers: [
      { t: "SHY", n: "UST 1-3Y" },
      { t: "IEI", n: "UST 3-7Y" },
      { t: "IEF", n: "UST 7-10Y" },
      { t: "TLT", n: "UST 20+Y" },
      { t: "TIP", n: "TIPS" },
      { t: "AGG", n: "US Agg" },
      { t: "BNDX", n: "Intl Bonds" },
    ],
  },
  {
    key: "credit",
    label: "Credit",
    benchmark: "LQD",
    tickers: [
      { t: "LQD", n: "IG Corporate" },
      { t: "HYG", n: "High Yield" },
      { t: "JNK", n: "HY (SPDR)" },
      { t: "EMB", n: "EM Sovereign USD" },
      { t: "MBB", n: "MBS" },
    ],
  },
  {
    key: "commodities",
    label: "Commodities",
    benchmark: "DBC",
    tickers: [
      { t: "GLD", n: "Gold" },
      { t: "SLV", n: "Silver" },
      { t: "USO", n: "WTI" },
      { t: "BNO", n: "Brent" },
      { t: "UNG", n: "Nat Gas" },
      { t: "CPER", n: "Copper" },
      { t: "DBA", n: "Agriculture" },
      { t: "DBC", n: "Broad Commodity" },
    ],
  },
  {
    key: "thematic",
    label: "Thematic",
    benchmark: "QQQ",
    tickers: [
      { t: "ARKK", n: "ARK Innovation" },
      { t: "ICLN", n: "Clean Energy" },
      { t: "TAN", n: "Solar" },
      { t: "FAN", n: "Wind" },
      { t: "BOTZ", n: "Robotics & AI" },
      { t: "AIQ", n: "AI & Big Data" },
      { t: "BLOK", n: "Blockchain" },
      { t: "METV", n: "Metaverse" },
    ],
  },
  {
    key: "crypto",
    label: "Crypto",
    benchmark: "BITO",
    tickers: [
      { t: "BITO", n: "Bitcoin Futures" },
      { t: "IBIT", n: "iShares Bitcoin" },
      { t: "ETHA", n: "iShares Ethereum" },
      { t: "COIN", n: "Coinbase" },
      { t: "MARA", n: "Marathon" },
    ],
  },
];

const PULSE = [
  "SPY",
  "QQQ",
  "FEZ",
  "EWJ",
  "EEM",
  "UUP",
  "FXE",
  "TLT",
  "IEF",
  "GLD",
  "USO",
  "HYG",
  "BITO",
];

function compact(s: Series) {
  return { dates: s.timestamps, closes: s.closes };
}

export default async function DashboardPage() {
  const allTickers = Array.from(
    new Set([...PULSE, ...GROUPS.flatMap((g) => [g.benchmark, ...g.tickers.map((t) => t.t)])]),
  );

  const series = await getManySeries(allTickers, 800);

  const errors: string[] = [];
  const seriesMap: Record<string, { dates: number[]; closes: number[] }> = {};
  for (const s of series) seriesMap[s.symbol] = compact(s);
  for (const t of allTickers) {
    if (!seriesMap[t]) errors.push(t);
  }

  const payload: DashboardPayload = {
    groups: GROUPS.map((g) => ({
      key: g.key,
      label: g.label,
      benchmark: g.benchmark,
      tickers: g.tickers,
    })),
    pulse: PULSE,
    series: seriesMap,
    errors,
  };

  return <DashboardClient payload={payload} />;
}
