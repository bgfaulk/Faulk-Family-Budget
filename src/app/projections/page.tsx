import { AppShell } from "@/components/app-shell";
import { SortableSearchTable } from "@/components/sortable-search-table";
import { currency, formatMonthLabel } from "@/lib/budget/utils";
import { getProjectionData } from "@/lib/services/projection-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ProjectionsPage() {
  const projection = await getProjectionData(12);

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Trend & Projection Engine</h2>
        <p className="mt-1 text-xs text-slate-400">
          Rolling averages use only month data from <strong className="text-slate-300">April 2026</strong> onward
          (when this ledger view starts). Forecast rows extend from your latest month in that range.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs uppercase text-slate-400">3-Mo Income Avg</p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              {currency(projection.baseWindow.rolling3Income)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs uppercase text-slate-400">3-Mo Expense Avg</p>
            <p className="mt-2 text-lg font-semibold text-rose-300">
              {currency(projection.baseWindow.rolling3Expense)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs uppercase text-slate-400">6-Mo Income Avg</p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              {currency(projection.baseWindow.rolling6Income)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs uppercase text-slate-400">6-Mo Expense Avg</p>
            <p className="mt-2 text-lg font-semibold text-rose-300">
              {currency(projection.baseWindow.rolling6Expense)}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-base font-semibold">12-Month Forecast</h3>
        <div className="mt-4">
          <SortableSearchTable
            columns={[
              { key: "month", label: "Month", sortType: "month", sortKey: "monthSort" },
              { key: "income", label: "Income", sortType: "number", sortKey: "incomeSort" },
              { key: "expenses", label: "Expenses", sortType: "number", sortKey: "expenseSort" },
              { key: "net", label: "Net", sortType: "number", sortKey: "netSort" },
              { key: "best", label: "Best", sortType: "number", sortKey: "bestSort" },
              {
                key: "conservative",
                label: "Conservative",
                sortType: "number",
                sortKey: "conservativeSort",
              },
            ]}
            rows={projection.points.map((point) => ({
              id: point.month,
              month: formatMonthLabel(point.month),
              monthSort: point.month,
              income: currency(point.projectedIncome),
              expenses: currency(point.projectedExpenses),
              net: currency(point.projectedNet),
              best: currency(point.bestCaseNet),
              conservative: currency(point.conservativeNet),
              incomeSort: point.projectedIncome,
              expenseSort: point.projectedExpenses,
              netSort: point.projectedNet,
              bestSort: point.bestCaseNet,
              conservativeSort: point.conservativeNet,
            }))}
            defaultSortKey="month"
            defaultSortDir="desc"
            searchPlaceholder="Search forecast by month or amount..."
          />
        </div>
      </section>
    </AppShell>
  );
}
