import { readFileSync } from "node:fs";
import { join } from "node:path";

import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";

import { getDb } from "../src/lib/db/client";
import { dividendHoldings } from "../src/lib/db/schema";

loadEnv({ path: ".env.local" });
loadEnv();

type CadenceFile = {
  weekly: string[];
  monthly: string[];
};

async function main() {
  const filePath = join(process.cwd(), "data", "dividend-cadence.json");
  const payload = JSON.parse(readFileSync(filePath, "utf8")) as CadenceFile;
  const db = getDb();

  const rows = await db.select().from(dividendHoldings);
  let updated = 0;

  for (const row of rows) {
    const ticker = row.ticker.toUpperCase();
    let cadence: "weekly" | "monthly" | "other" = "other";
    if (payload.weekly.map((t) => t.toUpperCase()).includes(ticker)) {
      cadence = "weekly";
    } else if (payload.monthly.map((t) => t.toUpperCase()).includes(ticker)) {
      cadence = "monthly";
    }

    if (row.dividendCadence === cadence) continue;

    await db
      .update(dividendHoldings)
      .set({ dividendCadence: cadence, updatedAt: new Date() })
      .where(eq(dividendHoldings.id, row.id));
    updated += 1;
  }

  const weeklyCount = payload.weekly.length;
  const monthlyCount = payload.monthly.length;
  console.log(`Applied dividend cadence: ${weeklyCount} weekly, ${monthlyCount} monthly (${updated} rows updated).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
