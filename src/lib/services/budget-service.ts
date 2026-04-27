import type { BillTemplateRecord, MonthRollup } from "@/lib/budget/types";
import { addMonths, formatMonthLabel, monthInRange, monthKeyCompare } from "@/lib/budget/utils";
import {
  aggregateMonthRollups,
  listBillTemplates,
  listMonthlyActualEntries,
  listMonthlyPlanEntries,
} from "@/lib/services/data-source";

export type MonthEntryView = {
  month: string;
  billTemplateId: string;
  actualEntryId?: string | null;
  linkedTemplateId?: string | null;
  name: string;
  direction: "income" | "expense";
  category: string;
  dueDayOfMonth: number | null;
  plannedAmount: number;
  actualAmount: number;
  status: "planned" | "paid" | "partial" | "skipped";
  /** Present for manual month-only expense rows; editable as the row label. */
  memo?: string | null;
};

function isTemplateActiveForMonth(template: BillTemplateRecord, month: string): boolean {
  if (template.isArchived || !template.uiVisible) return false;
  return monthInRange(month, template.effectiveStartMonth, template.effectiveEndMonth);
}

export function filterTemplatesForMonth(templates: BillTemplateRecord[], month: string): BillTemplateRecord[] {
  return templates.filter((template) => isTemplateActiveForMonth(template, month));
}

export function generateMonthPlanFromTemplates(
  templates: BillTemplateRecord[],
  month: string,
): Array<{
  month: string;
  billTemplateId: string;
  plannedAmount: number;
  source: "template";
}> {
  return filterTemplatesForMonth(templates, month).map((template) => ({
    month,
    billTemplateId: template.id,
    plannedAmount: template.defaultAmount,
    source: "template",
  }));
}

export async function getMonthView(month: string): Promise<{
  month: string;
  entries: MonthEntryView[];
  incomeActualItems: Array<{ id: string; label: string; amount: number }>;
  totals: MonthRollup;
  rollover: {
    allExpensesPaid: boolean;
    expenseRowCount: number;
    nextMonth: string;
    nextMonthLabel: string;
  };
}> {
  const [templates, planRows, actualRows] = await Promise.all([
    listBillTemplates(),
    listMonthlyPlanEntries(month),
    listMonthlyActualEntries(month),
  ]);
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const entryMap = new Map<string, MonthEntryView>();

  for (const plan of planRows) {
    const template = templateMap.get(plan.billTemplateId);
    if (!template) continue;
    entryMap.set(plan.billTemplateId, {
      month,
      billTemplateId: template.id,
      actualEntryId: null,
      linkedTemplateId: template.id,
      name: template.name,
      direction: template.direction,
      category: template.category,
      dueDayOfMonth: template.dueDayOfMonth,
      plannedAmount: plan.plannedAmount,
      actualAmount: 0,
      status: "planned",
      memo: null,
    });
  }

  for (const actual of actualRows) {
    if (!actual.billTemplateId) {
      entryMap.set(actual.id, {
        month,
        billTemplateId: actual.id,
        actualEntryId: actual.id,
        linkedTemplateId: null,
        name: actual.memo?.trim() || (actual.direction === "income" ? "Manual income entry" : "Manual expense entry"),
        direction: actual.direction ?? "expense",
        category: "manual",
        dueDayOfMonth: null,
        plannedAmount: 0,
        actualAmount: actual.actualAmount,
        status: actual.status,
        memo: actual.memo,
      });
    } else {
      const template = templateMap.get(actual.billTemplateId);
      if (!template) continue;
      const existing = entryMap.get(actual.billTemplateId);
      if (existing) {
        existing.actualEntryId = actual.id;
        existing.actualAmount += actual.actualAmount;
        existing.status = actual.status;
      } else {
        entryMap.set(actual.billTemplateId, {
          month,
          billTemplateId: template.id,
          actualEntryId: actual.id,
          linkedTemplateId: template.id,
          name: template.name,
          direction: template.direction,
          category: template.category,
          dueDayOfMonth: template.dueDayOfMonth,
          plannedAmount: 0,
          actualAmount: actual.actualAmount,
          status: actual.status,
          memo: null,
        });
      }
    }
  }

  const entries = Array.from(entryMap.values())
    .filter((entry) => entry.direction === "expense")
    .sort((a, b) =>
    a.dueDayOfMonth === b.dueDayOfMonth
      ? a.name.localeCompare(b.name)
      : (a.dueDayOfMonth ?? 99) - (b.dueDayOfMonth ?? 99),
    );
  const rollups = await aggregateMonthRollups(month, month);
  const totals =
    rollups[0] ??
    ({
      month,
      incomePlanned: 0,
      expensePlanned: 0,
      incomeActual: 0,
      expenseActual: 0,
      netPlanned: 0,
      netActual: 0,
    } satisfies MonthRollup);
  if (totals.incomePlanned === 0 && totals.incomeActual > 0) {
    totals.incomePlanned = totals.incomeActual;
    totals.netPlanned = totals.incomePlanned - totals.expensePlanned;
  }

  const incomeActualItems = actualRows
    .filter((actual) => {
      const templateDirection = actual.billTemplateId
        ? templateMap.get(actual.billTemplateId)?.direction ?? null
        : null;
      return (actual.direction ?? templateDirection) === "income";
    })
    .map((actual) => ({
      id: actual.id,
      label: actual.memo?.trim() || "Income entry",
      amount: actual.actualAmount,
    }));

  const expenseRowCount = entries.length;
  const allExpensesPaid = expenseRowCount > 0 && entries.every((e) => e.status === "paid");
  const nextMonth = addMonths(month, 1);

  return {
    month,
    entries,
    incomeActualItems,
    totals,
    rollover: {
      allExpensesPaid,
      expenseRowCount,
      nextMonth,
      nextMonthLabel: formatMonthLabel(nextMonth),
    },
  };
}

export async function getBudgetTimeline(monthsBack = 24): Promise<MonthRollup[]> {
  const all = await aggregateMonthRollups();
  return all.sort((a, b) => monthKeyCompare(a.month, b.month)).slice(-monthsBack);
}

export async function getUpcomingMonths(startMonth: string, count: number): Promise<string[]> {
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    months.push(addMonths(startMonth, i));
  }
  return months;
}
