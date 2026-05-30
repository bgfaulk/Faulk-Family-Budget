import { readCsvRows } from "@/lib/import/file-utils";

export type SnowballDividendRow = {
  date: string;
  month: string;
  ticker: string;
  amount: number;
};

export type SnowballParseResult = {
  tickers: string[];
  dividendsByMonth: Map<string, Map<string, number>>;
  dividendRows: SnowballDividendRow[];
};

function parseSnowballDate(raw: string): { date: string; month: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const date = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, month: date.slice(0, 7) };
}

export function parseSnowballExportRows(rows: string[][]): SnowballParseResult {
  const tickers = new Set<string>();
  const dividendsByMonth = new Map<string, Map<string, number>>();
  const dividendRows: SnowballDividendRow[] = [];

  for (const row of rows.slice(1)) {
    const event = (row[0] ?? "").trim();
    const dateRaw = (row[1] ?? "").trim();
    const symbol = (row[2] ?? "").trim();
    if (!symbol || symbol === "USD") continue;
    tickers.add(symbol);

    if (event !== "DIVIDEND") continue;

    const parsedDate = parseSnowballDate(dateRaw);
    if (!parsedDate) continue;

    const amount = Number.parseFloat((row[4] ?? "").trim());
    if (!Number.isFinite(amount) || amount <= 0) continue;

    dividendRows.push({
      date: parsedDate.date,
      month: parsedDate.month,
      ticker: symbol,
      amount,
    });

    if (!dividendsByMonth.has(parsedDate.month)) {
      dividendsByMonth.set(parsedDate.month, new Map());
    }
    const monthMap = dividendsByMonth.get(parsedDate.month)!;
    monthMap.set(symbol, (monthMap.get(symbol) ?? 0) + amount);
  }

  return {
    tickers: [...tickers].sort(),
    dividendsByMonth,
    dividendRows,
  };
}

export async function loadSnowballExport(
  fileName = "Faulk Snowball High Yield Export.csv",
): Promise<SnowballParseResult> {
  const rows = await readCsvRows(fileName);
  return parseSnowballExportRows(rows);
}
