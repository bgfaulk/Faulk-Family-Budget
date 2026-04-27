import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MonthArchiveCta } from "@/components/month-archive-cta";
import { MonthChecklistTable } from "@/components/month-checklist-table";
import { MonthIncomePanel } from "@/components/month-income-panel";
import { currency, formatMonthLabel } from "@/lib/budget/utils";
import { getMonthView } from "@/lib/services/budget-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ month: string }>;
};

export default async function MonthLedgerPage({ params }: PageProps) {
  const { month } = await params;
  const data = await getMonthView(month);
  const monthLabel = formatMonthLabel(data.month);
  const dbEnabled = Boolean(process.env.DATABASE_URL);

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Monthly Ledger: {monthLabel}</h2>
            <p className="mt-1 text-xs text-slate-400">
              Planned vs actual inflow and outflow entries for this month.
            </p>
          </div>
          <Link
            href="/bills"
            title="Recurring billing expenses: name, due day, default amount, payment account, and more. The ledger builds planned lines from these definitions each month."
            className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400/50"
          >
            Recurring expenses
          </Link>
        </div>

        <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-300">How the other pages support this ledger</summary>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-[11px] leading-relaxed">
            <li>
              <strong className="text-slate-300">Recurring expenses</strong> — Your master list of recurring charges
              (and any income rows you keep there). Each active item gets a <em>planned</em> line on the ledger for every
              month it is in range. Editing here changes defaults for future months; the ledger can still override
              planned amounts for one month only.
            </li>
            <li>
              <strong className="text-slate-300">Projections</strong> — Read-only trend view built from past month
              totals. It does not drive the ledger; use it to sanity-check income vs bills over time.
            </li>
            <li>
              <strong className="text-slate-300">DB size</strong> — Optional Postgres storage readout for hosting limits.
            </li>
          </ul>
        </details>

        {data.rollover.allExpensesPaid && data.rollover.expenseRowCount > 0 ? (
          <div className="mt-4">
            <MonthArchiveCta
              month={data.month}
              monthLabel={monthLabel}
              nextMonth={data.rollover.nextMonth}
              nextMonthLabel={data.rollover.nextMonthLabel}
              dbEnabled={dbEnabled}
            />
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MonthIncomePanel
          month={data.month}
          incomePlanned={data.totals.incomePlanned}
          incomeItems={data.incomeActualItems}
        />
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-400">Expenses (planned)</p>
          <p className="mt-2 text-xl font-semibold text-rose-300">{currency(data.totals.expensePlanned)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase text-slate-400">Left Over</p>
          <p className="mt-2 text-xl font-semibold">
            {currency(data.totals.incomePlanned - data.totals.expensePlanned)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Income minus bills for {monthLabel}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-base font-semibold">Entries</h3>
        <div className="mt-4">
          <MonthChecklistTable month={data.month} entries={data.entries} />
        </div>
      </section>
    </AppShell>
  );
}
