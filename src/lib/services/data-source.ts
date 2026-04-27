import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import type {
  BillTemplateRecord,
  MonthlyActualRecord,
  MonthlyPlanRecord,
  MonthRollup,
} from "@/lib/budget/types";
import { parseNumeric } from "@/lib/budget/utils";
import { getDb } from "@/lib/db/client";
import { billTemplates, monthlyActualEntries, monthlyPlanEntries, paymentSources } from "@/lib/db/schema";
import { loadImportedDataset } from "@/lib/import/load-imported-dataset";

function parseDbAmount(value: string): number {
  return parseNumeric(value);
}

function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function createLocalId(prefix: string, key: string): string {
  return `${prefix}_${Buffer.from(key).toString("hex").slice(0, 16)}`;
}

export type PaymentSourceRecord = {
  id: string;
  name: string;
};

export async function listPaymentSources(): Promise<PaymentSourceRecord[]> {
  if (!hasDatabaseConfig()) {
    return [];
  }
  const db = getDb();
  const rows = await db.select().from(paymentSources).orderBy(asc(paymentSources.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

export async function listBillTemplates(): Promise<BillTemplateRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const rows = await db.select().from(billTemplates).orderBy(asc(billTemplates.name));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      counterpartyName: row.counterpartyName,
      direction: row.direction,
      category: row.category,
      defaultAmount: parseDbAmount(row.defaultAmount),
      dueDayOfMonth: row.dueDayOfMonth,
      cadence: row.cadence,
      effectiveStartMonth: row.effectiveStartMonth,
      effectiveEndMonth: row.effectiveEndMonth,
      payoffMonth: row.payoffMonth,
      websiteUrl: row.websiteUrl,
      paymentAccount: row.paymentAccount,
      isArchived: row.isArchived,
      uiVisible: row.uiVisible,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      archivedReason: row.archivedReason,
      notes: row.notes,
    }));
  }

  const imported = await loadImportedDataset();
  return imported.billTemplates.map((template) => ({
    id: createLocalId("tpl", template.key),
    name: template.name,
    counterpartyName: template.counterpartyName,
    direction: template.direction,
    category: template.category,
    defaultAmount: template.defaultAmount,
    dueDayOfMonth: template.dueDayOfMonth,
    cadence: template.cadence,
    effectiveStartMonth: template.effectiveStartMonth,
    effectiveEndMonth: template.effectiveEndMonth,
    payoffMonth: null,
    websiteUrl: null,
    paymentAccount: null,
    isArchived: false,
    uiVisible: true,
    archivedAt: null,
    archivedReason: null,
    notes: template.notes,
  }));
}

export async function listMonthlyPlanEntries(month?: string): Promise<MonthlyPlanRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const whereClause = month ? eq(monthlyPlanEntries.month, month) : undefined;
    const rows = await db
      .select()
      .from(monthlyPlanEntries)
      .where(whereClause)
      .orderBy(asc(monthlyPlanEntries.month), asc(monthlyPlanEntries.billTemplateId));

    return rows.map((row) => ({
      id: row.id,
      month: row.month,
      billTemplateId: row.billTemplateId,
      plannedAmount: parseDbAmount(row.plannedAmount),
      locked: row.locked,
      source: row.source,
    }));
  }

  const imported = await loadImportedDataset();
  const templatesByKey = new Map(imported.billTemplates.map((template) => [template.key, template]));
  return imported.monthlyPlanEntries
    .filter((entry) => (month ? entry.month === month : true))
    .map((entry) => ({
      id: createLocalId("plan", `${entry.month}:${entry.templateKey}`),
      month: entry.month,
      billTemplateId: createLocalId("tpl", entry.templateKey),
      plannedAmount: entry.plannedAmount,
      locked: false,
      source: entry.source,
      templateName: templatesByKey.get(entry.templateKey)?.name,
    }))
    .map((entry) => ({
      id: entry.id,
      month: entry.month,
      billTemplateId: entry.billTemplateId,
      plannedAmount: entry.plannedAmount,
      locked: entry.locked,
      source: entry.source,
    }));
}

export async function listMonthlyActualEntries(month?: string): Promise<MonthlyActualRecord[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const whereClause = month ? eq(monthlyActualEntries.month, month) : undefined;
    const rows = await db
      .select()
      .from(monthlyActualEntries)
      .where(whereClause)
      .orderBy(asc(monthlyActualEntries.month), asc(monthlyActualEntries.createdAt));

    return rows.map((row) => ({
      id: row.id,
      month: row.month,
      billTemplateId: row.billTemplateId,
      direction: row.direction,
      actualAmount: parseDbAmount(row.actualAmount),
      paidDate: row.paidDate,
      status: row.status,
      memo: row.memo,
    }));
  }

  const imported = await loadImportedDataset();
  return imported.monthlyActualEntries
    .filter((entry) => (month ? entry.month === month : true))
    .map((entry, index) => ({
      id: createLocalId("actual", `${index}:${entry.month}:${entry.templateKey ?? "adhoc"}`),
      month: entry.month,
      billTemplateId: entry.templateKey ? createLocalId("tpl", entry.templateKey) : null,
      direction: entry.templateKey ? "expense" : null,
      actualAmount: entry.actualAmount,
      paidDate: entry.paidDate,
      status: entry.status,
      memo: entry.memo,
    }));
}

export async function aggregateMonthRollups(fromMonth?: string, toMonth?: string): Promise<MonthRollup[]> {
  if (hasDatabaseConfig()) {
    const db = getDb();
    const conditions = [];
    if (fromMonth) conditions.push(gte(monthlyPlanEntries.month, fromMonth));
    if (toMonth) conditions.push(lte(monthlyPlanEntries.month, toMonth));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const planned = await db
      .select({
        month: monthlyPlanEntries.month,
        direction: billTemplates.direction,
        total: sql<string>`sum(${monthlyPlanEntries.plannedAmount})`,
      })
      .from(monthlyPlanEntries)
      .innerJoin(billTemplates, eq(monthlyPlanEntries.billTemplateId, billTemplates.id))
      .where(whereClause)
      .groupBy(monthlyPlanEntries.month, billTemplates.direction)
      .orderBy(asc(monthlyPlanEntries.month));

    const actual = await db
      .select({
        month: monthlyActualEntries.month,
        direction:
          sql<string>`coalesce(${billTemplates.direction}::text, ${monthlyActualEntries.direction}::text, 'expense')`.as(
            "direction",
          ),
        total: sql<string>`sum(${monthlyActualEntries.actualAmount})`,
      })
      .from(monthlyActualEntries)
      .leftJoin(billTemplates, eq(monthlyActualEntries.billTemplateId, billTemplates.id))
      .groupBy(
        monthlyActualEntries.month,
        sql`coalesce(${billTemplates.direction}::text, ${monthlyActualEntries.direction}::text, 'expense')`,
      )
      .orderBy(asc(monthlyActualEntries.month));

    const rollups = new Map<string, MonthRollup>();
    for (const row of planned) {
      const item =
        rollups.get(row.month) ??
        ({
          month: row.month,
          incomePlanned: 0,
          expensePlanned: 0,
          incomeActual: 0,
          expenseActual: 0,
          netPlanned: 0,
          netActual: 0,
        } satisfies MonthRollup);
      if (row.direction === "income") item.incomePlanned += parseDbAmount(row.total);
      else item.expensePlanned += parseDbAmount(row.total);
      item.netPlanned = item.incomePlanned - item.expensePlanned;
      rollups.set(row.month, item);
    }

    for (const row of actual) {
      const item =
        rollups.get(row.month) ??
        ({
          month: row.month,
          incomePlanned: 0,
          expensePlanned: 0,
          incomeActual: 0,
          expenseActual: 0,
          netPlanned: 0,
          netActual: 0,
        } satisfies MonthRollup);
      if (row.direction === "income") item.incomeActual += parseDbAmount(row.total);
      else item.expenseActual += parseDbAmount(row.total);
      item.netActual = item.incomeActual - item.expenseActual;
      rollups.set(row.month, item);
    }

    return Array.from(rollups.values()).sort((a, b) => a.month.localeCompare(b.month));
  }

  const [templates, plans, actuals] = await Promise.all([
    listBillTemplates(),
    listMonthlyPlanEntries(),
    listMonthlyActualEntries(),
  ]);
  const templateMap = new Map(templates.map((template) => [template.id, template]));

  const rollups = new Map<string, MonthRollup>();
  for (const row of plans) {
    const template = templateMap.get(row.billTemplateId);
    const direction = template?.direction ?? "expense";
    const item =
      rollups.get(row.month) ??
      ({
        month: row.month,
        incomePlanned: 0,
        expensePlanned: 0,
        incomeActual: 0,
        expenseActual: 0,
        netPlanned: 0,
        netActual: 0,
      } satisfies MonthRollup);
    if (direction === "income") item.incomePlanned += row.plannedAmount;
    else item.expensePlanned += row.plannedAmount;
    item.netPlanned = item.incomePlanned - item.expensePlanned;
    rollups.set(row.month, item);
  }

  for (const row of actuals) {
    const template = row.billTemplateId ? templateMap.get(row.billTemplateId) : null;
    const direction = template?.direction ?? "expense";
    const item =
      rollups.get(row.month) ??
      ({
        month: row.month,
        incomePlanned: 0,
        expensePlanned: 0,
        incomeActual: 0,
        expenseActual: 0,
        netPlanned: 0,
        netActual: 0,
      } satisfies MonthRollup);
    if (direction === "income") item.incomeActual += row.actualAmount;
    else item.expenseActual += row.actualAmount;
    item.netActual = item.incomeActual - item.expenseActual;
    rollups.set(row.month, item);
  }

  return Array.from(rollups.values())
    .filter((row) => (!fromMonth || row.month >= fromMonth) && (!toMonth || row.month <= toMonth))
    .sort((a, b) => a.month.localeCompare(b.month));
}
