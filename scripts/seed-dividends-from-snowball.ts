import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";

import { cadenceForTicker } from "../src/lib/import/dividend-cadence";
import { getDb } from "../src/lib/db/client";
import { dividendHoldings, monthlyDividendEntries } from "../src/lib/db/schema";
import { loadSnowballExport } from "../src/lib/import/snowball-export";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const snowball = await loadSnowballExport();
  const db = getDb();

  const existing = await db.select().from(dividendHoldings);
  const byTicker = new Map(existing.map((row) => [row.ticker.toUpperCase(), row]));

  let order = existing.length;
  const tickerToId = new Map<string, string>();

  for (const ticker of snowball.tickers) {
    const key = ticker.toUpperCase();
    const current = byTicker.get(key);
    if (current) {
      tickerToId.set(key, current.id);
      continue;
    }
    const [created] = await db
      .insert(dividendHoldings)
      .values({
        ticker: key,
        name: null,
        displayOrder: order,
        dividendCadence: cadenceForTicker(key),
        notes: "Seeded from Snowball export",
      })
      .returning();
    if (!created) throw new Error(`Failed to create holding ${ticker}`);
    tickerToId.set(key, created.id);
    order += 1;
  }

  let entryCount = 0;
  for (const [month, monthMap] of snowball.dividendsByMonth) {
    for (const [ticker, amount] of monthMap) {
      const holdingId = tickerToId.get(ticker.toUpperCase());
      if (!holdingId || amount <= 0) continue;

      const [existing] = await db
        .select({ id: monthlyDividendEntries.id })
        .from(monthlyDividendEntries)
        .where(
          and(
            eq(monthlyDividendEntries.month, month),
            eq(monthlyDividendEntries.holdingId, holdingId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(monthlyDividendEntries)
          .set({ amount: amount.toFixed(2), updatedAt: new Date() })
          .where(eq(monthlyDividendEntries.id, existing.id));
      } else {
        await db.insert(monthlyDividendEntries).values({
          month,
          holdingId,
          amount: amount.toFixed(2),
        });
      }
      entryCount += 1;
    }
  }

  console.log(
    `Seeded ${tickerToId.size} holdings and ${entryCount} monthly dividend entries across ${snowball.dividendsByMonth.size} month(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
