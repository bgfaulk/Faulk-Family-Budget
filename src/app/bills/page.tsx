import { AppShell } from "@/components/app-shell";
import { RecurringExpensesTableSection, type RecurringExpenseRow } from "@/components/recurring-expenses-table-section";
import { currency } from "@/lib/budget/utils";
import { listBillTemplates, listPaymentSources } from "@/lib/services/data-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BillsPage() {
  const [templates, paymentSources] = await Promise.all([listBillTemplates(), listPaymentSources()]);
  const paymentSourceNames = paymentSources.map((s) => s.name);
  const active = templates.filter((template) => !template.isArchived && template.uiVisible);
  const archived = templates.filter((template) => template.isArchived || !template.uiVisible);

  const tableRows: RecurringExpenseRow[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    direction: t.direction,
    category: t.category,
    defaultAmount: t.defaultAmount,
    dueDayOfMonth: t.dueDayOfMonth,
    cadence: t.cadence,
    paymentAccount: t.paymentAccount,
    websiteUrl: t.websiteUrl,
    payoffMonth: t.payoffMonth,
    effectiveEndMonth: t.effectiveEndMonth,
    isArchived: t.isArchived,
    uiVisible: t.uiVisible,
  }));

  return (
    <AppShell>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold">Recurring billing expenses</h2>
        <p className="mt-1 text-xs text-slate-400">
          This is your catalog of recurring expenses (from the master CSV plus anything you add). Each active row feeds
          the <strong className="text-slate-300">Monthly Ledger</strong>: you get a planned line per expense per month
          while it is in its start–end range. Edit values here anytime; the ledger can still override planned amounts for
          a single month. Archived or end-dated items stop new months from including them, without deleting history. Use{" "}
          <strong className="text-slate-300">Add paid-from…</strong> for the account/card list; each row’s{" "}
          <em>Paid from</em> dropdown saves that label on the expense.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
            <p className="text-slate-400">Active</p>
            <p className="mt-1 text-xl font-semibold">{active.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
            <p className="text-slate-400">Archived / hidden</p>
            <p className="mt-1 text-xl font-semibold">{archived.length}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
            <p className="text-slate-400">Estimated monthly total (active defaults)</p>
            <p className="mt-1 text-xl font-semibold">
              {currency(active.reduce((sum, template) => sum + template.defaultAmount, 0))}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <RecurringExpensesTableSection
          initialRows={tableRows}
          initialPaymentSourceNames={paymentSourceNames}
        />
      </section>
    </AppShell>
  );
}
