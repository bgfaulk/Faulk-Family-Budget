import { and, asc, eq, inArray } from "drizzle-orm";

import type { DividendHoldingRecord, MonthlyDividendEntryRecord } from "@/lib/dividend/types";
import { parseNumeric } from "@/lib/budget/utils";
import { getDb } from "@/lib/db/client";
import { dividendHoldings, monthlyDividendEntries } from "@/lib/db/schema";
import { cadenceForTicker } from "@/lib/import/dividend-cadence";
import { loadSnowballExport } from "@/lib/import/snowball-export";
import type { DividendCadence } from "@/lib/dividend/types";

function parseDbAmount(value: string): number {
  return parseNumeric(value);
}

function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function createLocalHoldingId(ticker: string): string {
  return `dh_${Buffer.from(ticker).toString("hex").slice(0, 16)}`;
}

let snowballFallback: Awaited<ReturnType<typeof loadSnowballExport>> | null = null;

async function getSnowballFallback() {
  if (!snowballFallback) {
    snowballFallback = await loadSnowballExport();
  }
  return snowballFallback;
}

export async function listDividendHoldings(includeArchived = false): Promise<DividendHoldingRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(dividendHoldings)
      .orderBy(asc(dividendHoldings.displayOrder), asc(dividendHoldings.ticker));
    return rows
      .filter((row) => includeArchived || !row.isArchived)
      .map((row) => ({
        id: row.id,
        ticker: row.ticker,
        name: row.name,
        displayOrder: row.displayOrder,
        dividendCadence: row.dividendCadence as DividendCadence,
        isArchived: row.isArchived,
        notes: row.notes,
      }));
  }

  const snowball = await getSnowballFallback();
  return snowball.tickers.map((ticker, index) => ({
    id: createLocalHoldingId(ticker),
    ticker,
    name: null,
    displayOrder: index,
    dividendCadence: cadenceForTicker(ticker),
    isArchived: false,
    notes: null,
  }));
}

export async function listMonthlyDividendEntries(month: string): Promise<MonthlyDividendEntryRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const rows = await db
      .select({
        id: monthlyDividendEntries.id,
        month: monthlyDividendEntries.month,
        holdingId: monthlyDividendEntries.holdingId,
        amount: monthlyDividendEntries.amount,
        ticker: dividendHoldings.ticker,
      })
      .from(monthlyDividendEntries)
      .innerJoin(dividendHoldings, eq(monthlyDividendEntries.holdingId, dividendHoldings.id))
      .where(eq(monthlyDividendEntries.month, month))
      .orderBy(asc(dividendHoldings.displayOrder), asc(dividendHoldings.ticker));

    return rows.map((row) => ({
      id: row.id,
      month: row.month,
      holdingId: row.holdingId,
      ticker: row.ticker,
      amount: parseDbAmount(row.amount),
    }));
  }

  const [holdings, snowball] = await Promise.all([listDividendHoldings(), getSnowballFallback()]);
  const holdingByTicker = new Map(holdings.map((h) => [h.ticker, h]));
  const monthMap = snowball.dividendsByMonth.get(month);
  if (!monthMap) return [];

  const entries: MonthlyDividendEntryRecord[] = [];
  for (const [ticker, amount] of monthMap) {
    const holding = holdingByTicker.get(ticker);
    if (!holding || amount <= 0) continue;
    entries.push({
      id: `mde_${month}_${ticker}`,
      month,
      holdingId: holding.id,
      ticker,
      amount,
    });
  }
  return entries.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export async function listMonthlyDividendEntriesForMonths(): Promise<MonthlyDividendEntryRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const rows = await db
      .select({
        id: monthlyDividendEntries.id,
        month: monthlyDividendEntries.month,
        holdingId: monthlyDividendEntries.holdingId,
        amount: monthlyDividendEntries.amount,
        ticker: dividendHoldings.ticker,
      })
      .from(monthlyDividendEntries)
      .innerJoin(dividendHoldings, eq(monthlyDividendEntries.holdingId, dividendHoldings.id))
      .orderBy(asc(monthlyDividendEntries.month), asc(dividendHoldings.ticker));

    return rows.map((row) => ({
      id: row.id,
      month: row.month,
      holdingId: row.holdingId,
      ticker: row.ticker,
      amount: parseDbAmount(row.amount),
    }));
  }

  const [holdings, snowball] = await Promise.all([listDividendHoldings(), getSnowballFallback()]);
  const holdingByTicker = new Map(holdings.map((h) => [h.ticker, h]));
  const entries: MonthlyDividendEntryRecord[] = [];

  for (const [month, monthMap] of snowball.dividendsByMonth) {
    for (const [ticker, amount] of monthMap) {
      const holding = holdingByTicker.get(ticker);
      if (!holding || amount <= 0) continue;
      entries.push({
        id: `mde_${month}_${ticker}`,
        month,
        holdingId: holding.id,
        ticker,
        amount,
      });
    }
  }
  return entries.sort((a, b) => (a.month === b.month ? a.ticker.localeCompare(b.ticker) : a.month.localeCompare(b.month)));
}

export async function getPreviousMonthDividendEntries(month: string): Promise<MonthlyDividendEntryRecord[]> {
  const all = await listMonthlyDividendEntriesForMonths();
  const priorMonths = [...new Set(all.map((e) => e.month))].filter((m) => m < month).sort();
  if (priorMonths.length === 0) return [];
  const previousMonth = priorMonths[priorMonths.length - 1];
  return all.filter((e) => e.month === previousMonth);
}

export async function findHoldingByTicker(ticker: string): Promise<DividendHoldingRecord | null> {
  const holdings = await listDividendHoldings(true);
  return holdings.find((h) => h.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;
}

export async function listDividendEntriesForHoldingIds(
  month: string,
  holdingIds: string[],
): Promise<MonthlyDividendEntryRecord[]> {
  if (holdingIds.length === 0) return [];
  if (!hasDatabaseConfig()) {
    return listMonthlyDividendEntries(month);
  }
  const db = getDb();
  const rows = await db
    .select({
      id: monthlyDividendEntries.id,
      month: monthlyDividendEntries.month,
      holdingId: monthlyDividendEntries.holdingId,
      amount: monthlyDividendEntries.amount,
      ticker: dividendHoldings.ticker,
    })
    .from(monthlyDividendEntries)
    .innerJoin(dividendHoldings, eq(monthlyDividendEntries.holdingId, dividendHoldings.id))
    .where(and(eq(monthlyDividendEntries.month, month), inArray(monthlyDividendEntries.holdingId, holdingIds)));

  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    holdingId: row.holdingId,
    ticker: row.ticker,
    amount: parseDbAmount(row.amount),
  }));
}
