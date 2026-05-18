// Curated, multi-class catalog of liquid US-listed ETFs/indices used as the
// reference picker across the charts page (ported from medge2copia).

export interface CatalogItem {
  t: string;
  n: string;
}
export interface CatalogGroup {
  key: string;
  label: string;
  items: CatalogItem[];
}

export const BENCHMARK_CATALOG: CatalogGroup[] = [
  {
    key: "indices",
    label: "Indici",
    items: [
      { t: "SPY", n: "S&P 500" },
      { t: "QQQ", n: "Nasdaq 100" },
      { t: "IWM", n: "Russell 2000" },
      { t: "DIA", n: "Dow 30" },
      { t: "VTI", n: "US Total Market" },
      { t: "IWV", n: "Russell 3000" },
      { t: "MDY", n: "S&P MidCap 400" },
      { t: "IJR", n: "S&P SmallCap 600" },
      { t: "RSP", n: "S&P 500 Equal-Weight" },
      { t: "ACWI", n: "MSCI All Country World" },
      { t: "VT", n: "Vanguard Total World" },
      { t: "EFA", n: "MSCI EAFE" },
      { t: "EEM", n: "MSCI Emerging Markets" },
      { t: "IOO", n: "S&P Global 100" },
    ],
  },
  {
    key: "sectors",
    label: "Settori US",
    items: [
      { t: "XLK", n: "Technology" },
      { t: "XLC", n: "Communication Services" },
      { t: "XLY", n: "Consumer Discretionary" },
      { t: "XLP", n: "Consumer Staples" },
      { t: "XLF", n: "Financials" },
      { t: "XLV", n: "Health Care" },
      { t: "XLI", n: "Industrials" },
      { t: "XLB", n: "Materials" },
      { t: "XLE", n: "Energy" },
      { t: "XLU", n: "Utilities" },
      { t: "XLRE", n: "Real Estate" },
    ],
  },
  {
    key: "industries",
    label: "Industrie",
    items: [
      { t: "SMH", n: "Semiconduttori" },
      { t: "SOXX", n: "Semis (PHLX)" },
      { t: "IGV", n: "Software" },
      { t: "CIBR", n: "Cybersecurity" },
      { t: "FINX", n: "FinTech" },
      { t: "KWEB", n: "China Internet" },
      { t: "IBB", n: "Biotech" },
      { t: "IHE", n: "Pharma" },
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
      { t: "IYR", n: "Real Estate" },
      { t: "IYT", n: "Transportation" },
      { t: "XRT", n: "Retail" },
      { t: "PEJ", n: "Leisure & Entertainment" },
    ],
  },
  {
    key: "regions",
    label: "Regioni",
    items: [
      { t: "EZU", n: "Eurozone" },
      { t: "VGK", n: "Europe" },
      { t: "EWG", n: "Germany" },
      { t: "EWQ", n: "France" },
      { t: "EWI", n: "Italy" },
      { t: "EWP", n: "Spain" },
      { t: "EWU", n: "UK" },
      { t: "EWN", n: "Netherlands" },
      { t: "EWD", n: "Sweden" },
      { t: "EWL", n: "Switzerland" },
      { t: "EWJ", n: "Japan" },
      { t: "EWY", n: "South Korea" },
      { t: "EWT", n: "Taiwan" },
      { t: "EWH", n: "Hong Kong" },
      { t: "EWS", n: "Singapore" },
      { t: "EWA", n: "Australia" },
      { t: "EWC", n: "Canada" },
      { t: "MCHI", n: "China" },
      { t: "FXI", n: "China Large-Cap" },
      { t: "INDA", n: "India" },
      { t: "EWZ", n: "Brazil" },
      { t: "EWW", n: "Mexico" },
      { t: "TUR", n: "Turkey" },
      { t: "EZA", n: "South Africa" },
    ],
  },
  {
    key: "factors",
    label: "Fattori & Stili",
    items: [
      { t: "VUG", n: "Growth" },
      { t: "VTV", n: "Value" },
      { t: "MTUM", n: "Momentum" },
      { t: "QUAL", n: "Quality" },
      { t: "USMV", n: "Min-Vol" },
      { t: "VIG", n: "Dividend Growth" },
      { t: "SCHD", n: "High-Dividend" },
      { t: "SPHB", n: "High-Beta" },
      { t: "SPLV", n: "Low-Volatility" },
      { t: "EQAL", n: "Equal-Weight S&P" },
    ],
  },
  {
    key: "bonds",
    label: "Obbligazioni",
    items: [
      { t: "AGG", n: "US Aggregate" },
      { t: "BND", n: "Total Bond Market" },
      { t: "TLT", n: "UST 20+Y" },
      { t: "IEF", n: "UST 7-10Y" },
      { t: "IEI", n: "UST 3-7Y" },
      { t: "SHY", n: "UST 1-3Y" },
      { t: "BIL", n: "T-Bill 1-3M" },
      { t: "TIP", n: "TIPS Inflation-Linked" },
      { t: "LQD", n: "IG Corporate" },
      { t: "HYG", n: "High-Yield Corp" },
      { t: "EMB", n: "EM Sovereign USD" },
      { t: "BNDX", n: "Total Intl Bond" },
      { t: "MBB", n: "Mortgage-Backed" },
    ],
  },
  {
    key: "commodities",
    label: "Commodity",
    items: [
      { t: "DBC", n: "Broad Commodity" },
      { t: "GSG", n: "Goldman Commodity" },
      { t: "GLD", n: "Gold" },
      { t: "IAU", n: "Gold (low cost)" },
      { t: "SLV", n: "Silver" },
      { t: "USO", n: "WTI Oil" },
      { t: "BNO", n: "Brent Oil" },
      { t: "UNG", n: "Natural Gas" },
      { t: "CPER", n: "Copper" },
      { t: "WEAT", n: "Wheat" },
      { t: "CORN", n: "Corn" },
      { t: "DBA", n: "Agriculture" },
    ],
  },
  {
    key: "thematic",
    label: "Tematici",
    items: [
      { t: "ARKK", n: "ARK Innovation" },
      { t: "ICLN", n: "Clean Energy" },
      { t: "TAN", n: "Solar" },
      { t: "FAN", n: "Wind" },
      { t: "BOTZ", n: "Robotics & AI" },
      { t: "AIQ", n: "AI & Big Data" },
      { t: "BLOK", n: "Blockchain" },
      { t: "METV", n: "Metaverse" },
      { t: "YOLO", n: "Cannabis" },
    ],
  },
  {
    key: "currencies",
    label: "Valute",
    items: [
      { t: "UUP", n: "US Dollar (DXY)" },
      { t: "UDN", n: "US Dollar Bearish" },
      { t: "FXE", n: "Euro" },
      { t: "FXY", n: "Yen" },
      { t: "FXB", n: "British Pound" },
      { t: "FXF", n: "Swiss Franc" },
      { t: "FXC", n: "Canadian Dollar" },
      { t: "FXA", n: "Australian Dollar" },
    ],
  },
  {
    key: "crypto",
    label: "Crypto",
    items: [
      { t: "IBIT", n: "iShares Bitcoin" },
      { t: "FBTC", n: "Fidelity Bitcoin" },
      { t: "BITO", n: "Bitcoin Futures" },
      { t: "ETHA", n: "iShares Ethereum" },
    ],
  },
];

export const CATALOG_NAME_BY_TICKER: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of BENCHMARK_CATALOG) {
    for (const it of g.items) {
      if (!map[it.t]) map[it.t] = it.n;
    }
  }
  return map;
})();
