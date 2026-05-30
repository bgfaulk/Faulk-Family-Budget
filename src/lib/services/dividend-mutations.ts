import { and, eq } from "drizzle-orm";

import type { DividendCadence, DividendHoldingRecord } from "@/lib/dividend/types";
import { cadenceForTicker } from "@/lib/import/dividend-cadence";
import { getDb } from "@/lib/db/client";
import { dividendHoldings, monthlyDividendEntries } from "@/lib/db/schema";

function requireDbConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for write operations.");
  }
}

function mapHolding(row: {
  id: string;
  ticker: string;
  name: string | null;
  displayOrder: number;
  dividendCadence: string;
  isArchived: boolean;
  notes: string | null;
}): DividendHoldingRecord {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    displayOrder: row.displayOrder,
    dividendCadence: row.dividendCadence as DividendCadence,
    isArchived: row.isArchived,
    notes: row.notes,
  };
}

export async function createDividendHolding(input: {
  ticker: string;
  name?: string | null;
  displayOrder?: number;
  dividendCadence?: DividendCadence;
  notes?: string | null;
}): Promise<DividendHoldingRecord> {
  requireDbConfigured();
  const db = getDb();
  const ticker = input.ticker.trim().toUpperCase();
  if (!ticker) throw new Error("Ticker is required.");

  const [created] = await db
    .insert(dividendHoldings)
    .values({
      ticker,
      name: input.name?.trim() || null,
      displayOrder: input.displayOrder ?? 0,
      dividendCadence: input.dividendCadence ?? cadenceForTicker(ticker),
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) throw new Error("Failed to create dividend holding.");

  return mapHolding(created);
}

export async function updateDividendHolding(input: {
  id: string;
  name?: string | null;
  displayOrder?: number;
  dividendCadence?: DividendCadence;
  isArchived?: boolean;
  notes?: string | null;
}): Promise<DividendHoldingRecord> {
  requireDbConfigured();
  const db = getDb();
  const updates: Partial<typeof dividendHoldings.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name?.trim() || null;
  if (input.displayOrder !== undefined) updates.displayOrder = input.displayOrder;
  if (input.dividendCadence !== undefined) updates.dividendCadence = input.dividendCadence;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
  if (input.notes !== undefined) updates.notes = input.notes;

  const [updated] = await db
    .update(dividendHoldings)
    .set(updates)
    .where(eq(dividendHoldings.id, input.id))
    .returning();

  if (!updated) throw new Error("Dividend holding not found.");

  return mapHolding(updated);
}

export async function upsertMonthlyDividendEntries(
  month: string,
  entries: Array<{ holdingId: string; amount: number }>,
): Promise<void> {
  requireDbConfigured();
  const db = getDb();

  for (const entry of entries) {
    const amount = Math.max(0, entry.amount);
    const [existing] = await db
      .select({ id: monthlyDividendEntries.id })
      .from(monthlyDividendEntries)
      .where(
        and(
          eq(monthlyDividendEntries.month, month),
          eq(monthlyDividendEntries.holdingId, entry.holdingId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(monthlyDividendEntries)
        .set({ amount: amount.toFixed(2), updatedAt: new Date() })
        .where(eq(monthlyDividendEntries.id, existing.id));
    } else if (amount > 0) {
      await db.insert(monthlyDividendEntries).values({
        month,
        holdingId: entry.holdingId,
        amount: amount.toFixed(2),
      });
    }
  }
}

export async function copyDividendsFromPreviousMonth(month: string): Promise<string | null> {
  requireDbConfigured();
  const db = getDb();

  const priorRows = await db
    .select({ month: monthlyDividendEntries.month })
    .from(monthlyDividendEntries)
    .where(eq(monthlyDividendEntries.month, month))
    .limit(1);

  if (priorRows.length > 0) {
    throw new Error("Target month already has dividend entries.");
  }

  const allMonths = await db
    .selectDistinct({ month: monthlyDividendEntries.month })
    .from(monthlyDividendEntries);

  const priorMonth = allMonths
    .map((r) => r.month)
    .filter((m) => m < month)
    .sort()
    .pop();

  if (!priorMonth) return null;

  const source = await db
    .select()
    .from(monthlyDividendEntries)
    .where(eq(monthlyDividendEntries.month, priorMonth));

  for (const row of source) {
    await db.insert(monthlyDividendEntries).values({
      month,
      holdingId: row.holdingId,
      amount: row.amount,
    });
  }

  return priorMonth;
}
