import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";

export type DbSizeSummary = {
  databaseName: string;
  databaseSizeBytes: number;
  prettySize: string;
};

export type DbTableSize = {
  tableName: string;
  totalSizeBytes: number;
  prettySize: string;
  estimatedRows: number;
};

export type DbSizeReport = {
  summary: DbSizeSummary;
  tables: DbTableSize[];
  checkedAt: string;
};

function requireDbConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to read database size metrics.");
  }
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getDbSizeReport(limit = 20): Promise<DbSizeReport> {
  requireDbConfigured();
  const db = getDb();

  const summaryRows = await db.execute(sql`
    SELECT
      current_database() AS database_name,
      pg_database_size(current_database())::bigint AS database_size_bytes,
      pg_size_pretty(pg_database_size(current_database())) AS pretty_size
  `);

  const tableRows = await db.execute(sql`
    SELECT
      st.schemaname || '.' || st.relname AS table_name,
      pg_total_relation_size((quote_ident(st.schemaname) || '.' || quote_ident(st.relname))::regclass)::bigint AS total_size_bytes,
      pg_size_pretty(pg_total_relation_size((quote_ident(st.schemaname) || '.' || quote_ident(st.relname))::regclass)) AS pretty_size,
      st.n_live_tup::bigint AS estimated_rows
    FROM pg_stat_user_tables st
    ORDER BY pg_total_relation_size((quote_ident(st.schemaname) || '.' || quote_ident(st.relname))::regclass) DESC
    LIMIT ${limit}
  `);

  const summaryRow = summaryRows.rows[0] as
    | { database_name: string; database_size_bytes: unknown; pretty_size: string }
    | undefined;

  if (!summaryRow) {
    throw new Error("Unable to retrieve database size summary.");
  }

  return {
    summary: {
      databaseName: summaryRow.database_name,
      databaseSizeBytes: toNumber(summaryRow.database_size_bytes),
      prettySize: summaryRow.pretty_size,
    },
    tables: tableRows.rows.map((row) => {
      const typed = row as {
        table_name: string;
        total_size_bytes: unknown;
        pretty_size: string;
        estimated_rows: unknown;
      };
      return {
        tableName: typed.table_name,
        totalSizeBytes: toNumber(typed.total_size_bytes),
        prettySize: typed.pretty_size,
        estimatedRows: toNumber(typed.estimated_rows),
      };
    }),
    checkedAt: new Date().toISOString(),
  };
}
