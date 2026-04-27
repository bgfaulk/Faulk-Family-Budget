import { AppShell } from "@/components/app-shell";
import { SortableSearchTable } from "@/components/sortable-search-table";
import { getDbSizeReport } from "@/lib/services/db-size-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtPercent(part: number, total: number): string {
  if (total <= 0) return "0.00%";
  return `${((part / total) * 100).toFixed(2)}%`;
}

/** Show MB until ≥ 1 GB, then GB (no kB / PostgreSQL pretty string). */
function formatCurrentDatabaseSize(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  if (bytes >= gb) {
    return `${(bytes / gb).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

export default async function DbSizePage() {
  let report:
    | Awaited<ReturnType<typeof getDbSizeReport>>
    | null = null;
  let errorMessage: string | null = null;

  try {
    report = await getDbSizeReport(25);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to fetch DB size metrics.";
  }

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Database Size Monitor</h2>
        <p className="mt-1 text-xs text-slate-400">
          Tracks PostgreSQL storage utilization for hobby tier planning.
        </p>
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-700/40 bg-rose-900/10 p-5">
          <p className="text-sm text-rose-200">{errorMessage}</p>
          <p className="mt-2 text-xs text-rose-300">
            Ensure `DATABASE_URL` is set and migrations are applied before using this page.
          </p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase text-slate-400">Database</p>
              <p className="mt-2 text-sm font-medium">{report.summary.databaseName}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase text-slate-400">Current Size</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatCurrentDatabaseSize(report.summary.databaseSizeBytes)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase text-slate-400">Hobby Cap</p>
              <p className="mt-2 text-2xl font-semibold">512 MB</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs uppercase text-slate-400">Utilization</p>
              <p className="mt-2 text-2xl font-semibold">
                {fmtPercent(report.summary.databaseSizeBytes, 512 * 1024 * 1024)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Top Tables by Size</h3>
              <p className="text-xs text-slate-400">
                Checked at {new Date(report.checkedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <SortableSearchTable
                columns={[
                  { key: "table", label: "Table" },
                  { key: "size", label: "Size", sortType: "number", sortKey: "sizeBytes" },
                  { key: "percent", label: "% of DB", sortType: "number", sortKey: "percentSort" },
                  { key: "rows", label: "Estimated Rows", sortType: "number", sortKey: "rowsSort" },
                ]}
                rows={report.tables.map((table) => ({
                  id: table.tableName,
                  table: table.tableName,
                  size: table.prettySize,
                  percent: fmtPercent(table.totalSizeBytes, report.summary.databaseSizeBytes),
                  rows: table.estimatedRows.toLocaleString(),
                  sizeBytes: table.totalSizeBytes,
                  percentSort:
                    report.summary.databaseSizeBytes > 0
                      ? (table.totalSizeBytes / report.summary.databaseSizeBytes) * 100
                      : 0,
                  rowsSort: table.estimatedRows,
                }))}
                defaultSortKey="size"
                defaultSortDir="desc"
                searchPlaceholder="Search tables by name..."
              />
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
