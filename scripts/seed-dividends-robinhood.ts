import { readFileSync } from "node:fs";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";

import { cadenceForTicker } from "../src/lib/import/dividend-cadence";
import { getDb } from "../src/lib/db/client";
import { dividendHoldings, monthlyDividendEntries } from "../src/lib/db/schema";

loadEnv({ path: ".env.local" });
loadEnv();

type RobinhoodSeedFile = {
  month: string;
  totalsByTicker: Record<string, number>;
  source?: string;
  note?: string;
};

async function main() {
  const filePath =
    process.argv[2] ?? join(process.cwd(), "data", "robinhood-dividends-may-2026.json");
  const raw = readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw) as RobinhoodSeedFile;
  const month = payload.month;
  const totalsByTicker = payload.totalsByTicker;

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month in seed file: ${month}`);
  }

  const tickers = Object.keys(totalsByTicker).map((t) => t.toUpperCase());
  const db = getDb();

  const existing = await db.select().from(dividendHoldings);
  const byTicker = new Map(existing.map((row) => [row.ticker.toUpperCase(), row]));
  let order = existing.length;

  for (const ticker of tickers) {
    if (byTicker.has(ticker)) continue;
    const [created] = await db
      .insert(dividendHoldings)
      .values({
        ticker,
        name: null,
        displayOrder: order,
        dividendCadence: cadenceForTicker(ticker),
        notes: "Seeded from Robinhood reconcile",
      })
      .returning();
    if (!created) throw new Error(`Failed to create holding ${ticker}`);
    byTicker.set(ticker, created);
    order += 1;
  }

  let upserted = 0;
  let monthTotal = 0;

  for (const [ticker, amount] of Object.entries(totalsByTicker)) {
    const key = ticker.toUpperCase();
    const holding = byTicker.get(key);
    if (!holding) throw new Error(`Missing holding for ${key}`);
    const normalized = Math.max(0, amount);
    monthTotal += normalized;

    const [existing] = await db
      .select({ id: monthlyDividendEntries.id })
      .from(monthlyDividendEntries)
      .where(
        and(
          eq(monthlyDividendEntries.month, month),
          eq(monthlyDividendEntries.holdingId, holding.id),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(monthlyDividendEntries)
        .set({ amount: normalized.toFixed(2), updatedAt: new Date() })
        .where(eq(monthlyDividendEntries.id, existing.id));
    } else {
      await db.insert(monthlyDividendEntries).values({
        month,
        holdingId: holding.id,
        amount: normalized.toFixed(2),
      });
    }
    upserted += 1;
  }

  console.log(`Robinhood reconcile for ${month}`);
  console.log(`  Upserted ${upserted} ticker rows, month total $${monthTotal.toFixed(2)}`);
  if (payload.source) console.log(`  Source: ${payload.source}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
