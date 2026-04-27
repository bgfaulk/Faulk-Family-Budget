import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/lib/db/schema";

let database: NodePgDatabase<typeof schema> | null = null;

function normalizeSslMode(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get("sslmode");
    const hasLibpqCompat = parsed.searchParams.has("uselibpqcompat");

    if (
      sslMode &&
      !hasLibpqCompat &&
      (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca")
    ) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }

    return databaseUrl;
  } catch {
    return databaseUrl;
  }
}

export function getDb(): NodePgDatabase<typeof schema> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  if (!database) {
    const pool = new Pool({ connectionString: normalizeSslMode(databaseUrl) });
    database = drizzle(pool, { schema });
  }

  return database;
}
