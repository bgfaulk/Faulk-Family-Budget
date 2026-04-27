import { config as loadEnv } from "dotenv";
import { and, eq, notInArray } from "drizzle-orm";

import { addMonths } from "../src/lib/budget/utils";
import { getDb } from "../src/lib/db/client";
import { billTemplates, monthlyActualEntries, monthlyPlanEntries } from "../src/lib/db/schema";
import {
  determineBillCategory,
  getDueDayFromText,
  loadMasterBills,
  normalizeBillName,
} from "../src/lib/import/master-bills";

loadEnv({ path: ".env.local" });
loadEnv();

function currentMonthKey(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function main() {
  const db = getDb();
  const masterBills = await loadMasterBills();
  if (masterBills.length === 0) {
    throw new Error("No master bills found in data/Faulk Master Bills.csv");
  }

  // Remove legacy combined row if it still exists (split into Youtube TV + Youtube Premium).
  const legacyRows = await db
    .select({ id: billTemplates.id })
    .from(billTemplates)
    .where(eq(billTemplates.name, "Youtube TV and Youtube App"));
  for (const row of legacyRows) {
    await db.delete(monthlyPlanEntries).where(eq(monthlyPlanEntries.billTemplateId, row.id));
    await db.delete(monthlyActualEntries).where(eq(monthlyActualEntries.billTemplateId, row.id));
    await db.delete(billTemplates).where(eq(billTemplates.id, row.id));
  }

  const existing = await db
    .select({
      id: billTemplates.id,
      name: billTemplates.name,
    })
    .from(billTemplates);

  const existingByNormalizedName = new Map(existing.map((item) => [normalizeBillName(item.name), item]));
  const touchedTemplateIds: string[] = [];

  for (const row of masterBills) {
    const normalized = normalizeBillName(row.payorName);
    const current = existingByNormalizedName.get(normalized);
    const updates = {
      name: row.payorName,
      counterpartyName: row.payorName,
      direction: "expense" as const,
      category: determineBillCategory(row.payorName),
      defaultAmount: row.amount.toFixed(2),
      dueDayOfMonth: getDueDayFromText(row.dueText),
      cadence: "monthly" as const,
      effectiveStartMonth: "2025-08",
      effectiveEndMonth: null,
      payoffMonth: row.payoffMonth,
      websiteUrl: row.companyWebsite,
      paymentAccount: row.paymentAccount,
      isArchived: false,
      uiVisible: true,
      archivedAt: null,
      archivedReason: null,
      notes: `Master bill seed; due text: ${row.dueText}`,
      updatedAt: new Date(),
    };

    if (current) {
      await db.update(billTemplates).set(updates).where(eq(billTemplates.id, current.id));
      touchedTemplateIds.push(current.id);
    } else {
      const [created] = await db
        .insert(billTemplates)
        .values({
          ...updates,
          createdAt: new Date(),
        })
        .returning({ id: billTemplates.id });
      touchedTemplateIds.push(created.id);
    }
  }

  // Archive non-master templates so the canonical list drives the app.
  if (touchedTemplateIds.length > 0) {
    await db
      .update(billTemplates)
      .set({
        isArchived: true,
        uiVisible: false,
        archivedAt: new Date(),
        archivedReason: "Not part of canonical master bill list",
        updatedAt: new Date(),
      })
      .where(notInArray(billTemplates.id, touchedTemplateIds));
  }

  // Regenerate planned entries for master expense bills from 2025-08 through 12 months ahead.
  await db.delete(monthlyPlanEntries);
  const startMonth = "2025-08";
  const endMonth = addMonths(currentMonthKey(), 12);

  const activeMasterBills = await db
    .select({
      id: billTemplates.id,
      defaultAmount: billTemplates.defaultAmount,
    })
    .from(billTemplates)
    .where(and(eq(billTemplates.isArchived, false), eq(billTemplates.uiVisible, true), eq(billTemplates.direction, "expense")));

  let monthCursor = startMonth;
  const planRows: Array<{
    month: string;
    billTemplateId: string;
    plannedAmount: string;
    source: "template";
  }> = [];

  while (monthCursor <= endMonth) {
    for (const bill of activeMasterBills) {
      planRows.push({
        month: monthCursor,
        billTemplateId: bill.id,
        plannedAmount: bill.defaultAmount,
        source: "template",
      });
    }
    monthCursor = addMonths(monthCursor, 1);
  }

  const chunkSize = 500;
  for (let i = 0; i < planRows.length; i += chunkSize) {
    await db.insert(monthlyPlanEntries).values(planRows.slice(i, i + chunkSize));
  }

  // Start checkbox tracking clean from canonical master list.
  await db.delete(monthlyActualEntries);

  console.log(
    JSON.stringify(
      {
        seededBills: touchedTemplateIds.length,
        regeneratedPlanRows: planRows.length,
        planRange: [startMonth, endMonth],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Master bill seed failed:", error);
  process.exit(1);
});
