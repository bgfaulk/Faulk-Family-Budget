import { and, eq } from "drizzle-orm";

import type { BillCadence, BillTemplateRecord, CashflowDirection, MonthlyActualRecord } from "@/lib/budget/types";
import { addMonths } from "@/lib/budget/utils";
import { getDb } from "@/lib/db/client";
import { billTemplates, monthlyActualEntries, monthlyPlanEntries, paymentSources } from "@/lib/db/schema";
import { filterTemplatesForMonth } from "@/lib/services/budget-service";
import { listBillTemplates, listMonthlyActualEntries, listMonthlyPlanEntries } from "@/lib/services/data-source";

function requireDbConfigured(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for write operations.");
  }
}

export async function createPaymentSource(name: string): Promise<{ id: string; name: string }> {
  requireDbConfigured();
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Paid-from name is required.");
  }
  const [duplicate] = await db.select({ id: paymentSources.id }).from(paymentSources).where(eq(paymentSources.name, trimmed)).limit(1);
  if (duplicate) {
    throw new Error("DUPLICATE_PAID_FROM");
  }
  const [created] = await db
    .insert(paymentSources)
    .values({ name: trimmed })
    .returning({ id: paymentSources.id, name: paymentSources.name });
  if (!created) {
    throw new Error("Failed to create paid-from entry.");
  }
  return created;
}

export async function createBillTemplate(input: {
  name: string;
  counterpartyName?: string | null;
  direction: "income" | "expense";
  category: string;
  defaultAmount: number;
  dueDayOfMonth?: number | null;
  cadence: "monthly" | "biweekly" | "quarterly" | "annual" | "one_off";
  effectiveStartMonth?: string | null;
  effectiveEndMonth?: string | null;
  payoffMonth?: string | null;
  websiteUrl?: string | null;
  paymentAccount?: string | null;
  notes?: string | null;
}): Promise<BillTemplateRecord> {
  requireDbConfigured();
  const db = getDb();

  const [created] = await db
    .insert(billTemplates)
    .values({
      name: input.name,
      counterpartyName: input.counterpartyName ?? input.name,
      direction: input.direction,
      category: input.category,
      defaultAmount: input.defaultAmount.toFixed(2),
      dueDayOfMonth: input.dueDayOfMonth ?? null,
      cadence: input.cadence,
      effectiveStartMonth: input.effectiveStartMonth ?? null,
      effectiveEndMonth: input.effectiveEndMonth ?? null,
      payoffMonth: input.payoffMonth ?? null,
      websiteUrl: input.websiteUrl ?? null,
      paymentAccount: input.paymentAccount ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  return {
    id: created.id,
    name: created.name,
    counterpartyName: created.counterpartyName,
    direction: created.direction,
    category: created.category,
    defaultAmount: Number(created.defaultAmount),
    dueDayOfMonth: created.dueDayOfMonth,
    cadence: created.cadence,
    effectiveStartMonth: created.effectiveStartMonth,
    effectiveEndMonth: created.effectiveEndMonth,
    payoffMonth: created.payoffMonth,
    websiteUrl: created.websiteUrl,
    paymentAccount: created.paymentAccount,
    isArchived: created.isArchived,
    uiVisible: created.uiVisible,
    archivedAt: created.archivedAt ? created.archivedAt.toISOString() : null,
    archivedReason: created.archivedReason,
    notes: created.notes,
  };
}

export async function updateBillLifecycle(
  billTemplateId: string,
  input: {
    isArchived?: boolean;
    uiVisible?: boolean;
    archivedReason?: string | null;
    effectiveEndMonth?: string | null;
  },
): Promise<BillTemplateRecord | null> {
  requireDbConfigured();
  const db = getDb();

  await db
    .update(billTemplates)
    .set({
      isArchived: input.isArchived,
      uiVisible: input.uiVisible,
      archivedReason: input.archivedReason,
      archivedAt: input.isArchived ? new Date() : null,
      effectiveEndMonth: input.effectiveEndMonth,
      updatedAt: new Date(),
    })
    .where(eq(billTemplates.id, billTemplateId));

  const allTemplates = await listBillTemplates();
  return allTemplates.find((row) => row.id === billTemplateId) ?? null;
}

export async function updateBillTemplateDetails(
  billTemplateId: string,
  input: {
    name?: string;
    counterpartyName?: string | null;
    category?: string;
    dueDayOfMonth?: number | null;
    defaultAmount?: number;
    cadence?: BillCadence;
    paymentAccount?: string | null;
    websiteUrl?: string | null;
    payoffMonth?: string | null;
    effectiveStartMonth?: string | null;
    direction?: CashflowDirection;
  },
): Promise<BillTemplateRecord | null> {
  requireDbConfigured();
  const db = getDb();

  const setPayload: {
    name?: string;
    counterpartyName?: string | null;
    category?: string;
    dueDayOfMonth?: number | null;
    defaultAmount?: string;
    cadence?: BillCadence;
    paymentAccount?: string | null;
    websiteUrl?: string | null;
    payoffMonth?: string | null;
    effectiveStartMonth?: string | null;
    direction?: CashflowDirection;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) {
    setPayload.name = input.name;
    setPayload.counterpartyName = input.counterpartyName !== undefined ? input.counterpartyName : input.name;
  } else if (input.counterpartyName !== undefined) {
    setPayload.counterpartyName = input.counterpartyName;
  }
  if (input.category !== undefined) setPayload.category = input.category;
  if (input.dueDayOfMonth !== undefined) setPayload.dueDayOfMonth = input.dueDayOfMonth;
  if (input.defaultAmount !== undefined) setPayload.defaultAmount = input.defaultAmount.toFixed(2);
  if (input.cadence !== undefined) setPayload.cadence = input.cadence;
  if (input.paymentAccount !== undefined) setPayload.paymentAccount = input.paymentAccount;
  if (input.websiteUrl !== undefined) setPayload.websiteUrl = input.websiteUrl;
  if (input.payoffMonth !== undefined) setPayload.payoffMonth = input.payoffMonth;
  if (input.effectiveStartMonth !== undefined) setPayload.effectiveStartMonth = input.effectiveStartMonth;
  if (input.direction !== undefined) setPayload.direction = input.direction;

  const hasDetailField =
    setPayload.name !== undefined ||
    setPayload.counterpartyName !== undefined ||
    setPayload.category !== undefined ||
    setPayload.dueDayOfMonth !== undefined ||
    setPayload.defaultAmount !== undefined ||
    setPayload.cadence !== undefined ||
    setPayload.paymentAccount !== undefined ||
    setPayload.websiteUrl !== undefined ||
    setPayload.payoffMonth !== undefined ||
    setPayload.effectiveStartMonth !== undefined ||
    setPayload.direction !== undefined;
  if (!hasDetailField) {
    const allTemplates = await listBillTemplates();
    return allTemplates.find((row) => row.id === billTemplateId) ?? null;
  }

  await db.update(billTemplates).set(setPayload).where(eq(billTemplates.id, billTemplateId));
  const allTemplates = await listBillTemplates();
  return allTemplates.find((row) => row.id === billTemplateId) ?? null;
}

export async function upsertMonthlyActual(input: {
  actualId?: string;
  month: string;
  billTemplateId: string | null;
  direction?: "income" | "expense" | null;
  actualAmount: number;
  paidDate?: string | null;
  status: "planned" | "paid" | "partial" | "skipped";
  memo?: string | null;
}): Promise<MonthlyActualRecord> {
  requireDbConfigured();
  const db = getDb();

  if (input.actualId) {
    const [updated] = await db
      .update(monthlyActualEntries)
      .set({
        actualAmount: input.actualAmount.toFixed(2),
        paidDate: input.paidDate ?? null,
        direction: input.direction ?? null,
        status: input.status,
        ...(input.memo !== undefined ? { memo: input.memo } : {}),
        updatedAt: new Date(),
      })
      .where(eq(monthlyActualEntries.id, input.actualId))
      .returning();

    if (updated) {
      return {
        id: updated.id,
        month: updated.month,
        billTemplateId: updated.billTemplateId,
        direction: updated.direction,
        actualAmount: Number(updated.actualAmount),
        paidDate: updated.paidDate,
        status: updated.status,
        memo: updated.memo,
      };
    }
  }

  if (input.billTemplateId) {
    const [existing] = await db
      .select()
      .from(monthlyActualEntries)
      .where(and(eq(monthlyActualEntries.month, input.month), eq(monthlyActualEntries.billTemplateId, input.billTemplateId)))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(monthlyActualEntries)
        .set({
          actualAmount: input.actualAmount.toFixed(2),
          paidDate: input.paidDate ?? null,
          direction: input.direction ?? null,
          status: input.status,
          ...(input.memo !== undefined ? { memo: input.memo } : {}),
          updatedAt: new Date(),
        })
        .where(eq(monthlyActualEntries.id, existing.id))
        .returning();

      return {
        id: updated.id,
        month: updated.month,
        billTemplateId: updated.billTemplateId,
        direction: updated.direction,
        actualAmount: Number(updated.actualAmount),
        paidDate: updated.paidDate,
        status: updated.status,
        memo: updated.memo,
      };
    }
  }

  const [created] = await db
    .insert(monthlyActualEntries)
    .values({
      month: input.month,
      billTemplateId: input.billTemplateId,
      direction: input.direction ?? null,
      actualAmount: input.actualAmount.toFixed(2),
      paidDate: input.paidDate ?? null,
      status: input.status,
      memo: input.memo ?? null,
    })
    .returning();

  return {
    id: created.id,
    month: created.month,
    billTemplateId: created.billTemplateId,
    direction: created.direction,
    actualAmount: Number(created.actualAmount),
    paidDate: created.paidDate,
    status: created.status,
    memo: created.memo,
  };
}

export async function upsertMonthlyPlan(input: {
  month: string;
  billTemplateId: string;
  plannedAmount: number;
  source: "template" | "manual" | "import";
}): Promise<void> {
  requireDbConfigured();
  const db = getDb();

  const [existing] = await db
    .select()
    .from(monthlyPlanEntries)
    .where(and(eq(monthlyPlanEntries.month, input.month), eq(monthlyPlanEntries.billTemplateId, input.billTemplateId)))
    .limit(1);

  if (existing) {
    await db
      .update(monthlyPlanEntries)
      .set({
        plannedAmount: input.plannedAmount.toFixed(2),
        source: input.source,
        updatedAt: new Date(),
      })
      .where(eq(monthlyPlanEntries.id, existing.id));
    return;
  }

  await db.insert(monthlyPlanEntries).values({
    month: input.month,
    billTemplateId: input.billTemplateId,
    plannedAmount: input.plannedAmount.toFixed(2),
    source: input.source,
  });
}

export async function getMonthEntries(month: string): Promise<{
  plans: Awaited<ReturnType<typeof listMonthlyPlanEntries>>;
  actuals: Awaited<ReturnType<typeof listMonthlyActualEntries>>;
}> {
  const [plans, actuals] = await Promise.all([listMonthlyPlanEntries(month), listMonthlyActualEntries(month)]);
  return { plans, actuals };
}

export async function deleteMonthEntry(input: {
  month: string;
  billTemplateId?: string | null;
  actualId?: string | null;
}): Promise<{ deletedActualRows: number; deletedPlanRows: number }> {
  requireDbConfigured();
  const db = getDb();

  let deletedActualRows = 0;
  let deletedPlanRows = 0;

  if (input.actualId) {
    const deleted = await db
      .delete(monthlyActualEntries)
      .where(eq(monthlyActualEntries.id, input.actualId))
      .returning({ id: monthlyActualEntries.id });
    deletedActualRows += deleted.length;
  }

  if (input.billTemplateId) {
    const deletedActual = await db
      .delete(monthlyActualEntries)
      .where(and(eq(monthlyActualEntries.month, input.month), eq(monthlyActualEntries.billTemplateId, input.billTemplateId)))
      .returning({ id: monthlyActualEntries.id });
    deletedActualRows += deletedActual.length;

    const deletedPlan = await db
      .delete(monthlyPlanEntries)
      .where(and(eq(monthlyPlanEntries.month, input.month), eq(monthlyPlanEntries.billTemplateId, input.billTemplateId)))
      .returning({ id: monthlyPlanEntries.id });
    deletedPlanRows += deletedPlan.length;
  }

  return { deletedActualRows, deletedPlanRows };
}

/**
 * Prepare the next calendar month for day-to-day use: ensure planned expense rows exist
 * from active bill templates, and copy standalone income rows from `fromMonth` when the
 * target month has no income yet (so edits in the current month carry forward once).
 */
export async function rolloverToNextMonth(fromMonth: string): Promise<{
  nextMonth: string;
  ensuredPlanCount: number;
  copiedIncomeCount: number;
}> {
  requireDbConfigured();
  const nextMonth = addMonths(fromMonth, 1);
  const templates = filterTemplatesForMonth(await listBillTemplates(), nextMonth).filter(
    (t) => t.direction === "expense",
  );
  const existingPlans = await listMonthlyPlanEntries(nextMonth);
  const havePlan = new Set(existingPlans.map((p) => p.billTemplateId));

  let ensuredPlanCount = 0;
  for (const t of templates) {
    if (!havePlan.has(t.id)) {
      await upsertMonthlyPlan({
        month: nextMonth,
        billTemplateId: t.id,
        plannedAmount: t.defaultAmount,
        source: "template",
      });
      ensuredPlanCount += 1;
    }
  }

  const fromActuals = await listMonthlyActualEntries(fromMonth);
  const incomeRows = fromActuals.filter((a) => a.billTemplateId === null && a.direction === "income");

  const toActuals = await listMonthlyActualEntries(nextMonth);
  const toHasIncome = toActuals.some((a) => a.billTemplateId === null && a.direction === "income");

  let copiedIncomeCount = 0;
  if (!toHasIncome) {
    for (const row of incomeRows) {
      await upsertMonthlyActual({
        month: nextMonth,
        billTemplateId: null,
        direction: "income",
        actualAmount: row.actualAmount,
        paidDate: row.paidDate,
        status: row.status,
        memo: row.memo?.trim() || `Income carried from ${fromMonth}`,
      });
      copiedIncomeCount += 1;
    }
  }

  return { nextMonth, ensuredPlanCount, copiedIncomeCount };
}
