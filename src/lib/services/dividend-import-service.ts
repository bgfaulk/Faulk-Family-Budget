import { cadenceForTicker } from "@/lib/import/dividend-cadence";
import { parseSnowballExportRows } from "@/lib/import/snowball-export";
import { findHoldingByTicker } from "@/lib/services/dividend-data-source";
import { createDividendHolding, upsertMonthlyDividendEntries } from "@/lib/services/dividend-mutations";

function parseCsvText(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    values.push(current);
    return values;
  });
}

export type SnowballImportPreview = {
  month: string;
  tickers: Array<{ ticker: string; amount: number }>;
  monthTotal: number;
  dividendEventCount: number;
};

export async function previewSnowballImport(csvText: string, month: string): Promise<SnowballImportPreview> {
  const rows = parseCsvText(csvText);
  const parsed = parseSnowballExportRows(rows);
  const monthMap = parsed.dividendsByMonth.get(month) ?? new Map();
  const tickers = [...monthMap.entries()]
    .map(([ticker, amount]) => ({ ticker, amount }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const monthTotal = tickers.reduce((sum, t) => sum + t.amount, 0);
  const dividendEventCount = parsed.dividendRows.filter((r) => r.month === month).length;

  return { month, tickers, monthTotal, dividendEventCount };
}

export async function applySnowballImport(
  csvText: string,
  month: string,
): Promise<{ imported: number; monthTotal: number; createdHoldings: string[] }> {
  const preview = await previewSnowballImport(csvText, month);
  const createdHoldings: string[] = [];
  const entries: Array<{ holdingId: string; amount: number }> = [];

  for (const { ticker, amount } of preview.tickers) {
    let holding = await findHoldingByTicker(ticker);
    if (!holding) {
      holding = await createDividendHolding({
        ticker,
        dividendCadence: cadenceForTicker(ticker),
      });
      createdHoldings.push(ticker);
    }
    entries.push({ holdingId: holding.id, amount });
  }

  await upsertMonthlyDividendEntries(month, entries);

  return {
    imported: entries.length,
    monthTotal: preview.monthTotal,
    createdHoldings,
  };
}
