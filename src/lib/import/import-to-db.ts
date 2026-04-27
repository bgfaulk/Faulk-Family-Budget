import { eq, inArray, like } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  accountSnapshots,
  billTemplates,
  importJobs,
  importRows,
  monthlyActualEntries,
  monthlyPlanEntries,
} from "@/lib/db/schema";
import { loadImportedDataset } from "@/lib/import/load-imported-dataset";

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function importDatasetToDatabase(): Promise<{
  templates: number;
  plans: number;
  actuals: number;
  snapshots: number;
  diagnostics: string[];
}> {
  const db = getDb();
  const data = await loadImportedDataset();

  const [job] = await db
    .insert(importJobs)
    .values({
      sourceType: "budget_v1_xlsx",
      sourceFileName: "combined-import",
      status: "processing",
    })
    .returning();

  if (data.diagnostics.length > 0) {
    await db.insert(importRows).values(
      data.diagnostics.map((message, index) => ({
        importJobId: job.id,
        rowNumber: index + 1,
        rawPayload: message,
        parseStatus: "warn",
        parseMessage: message,
      })),
    );
  }

  const templateNames = data.billTemplates.map((template) => template.name);
  const existingTemplates =
    templateNames.length > 0
      ? await db
          .select({ name: billTemplates.name })
          .from(billTemplates)
          .where(inArray(billTemplates.name, templateNames))
      : [];
  const existingNameSet = new Set(existingTemplates.map((template) => template.name));
  const templatesToInsert = data.billTemplates.filter((template) => !existingNameSet.has(template.name));

  for (const group of chunk(templatesToInsert, 200)) {
    if (group.length > 0) {
      await db.insert(billTemplates).values(
        group.map((template) => ({
          name: template.name,
          counterpartyName: template.counterpartyName,
          direction: template.direction,
          category: template.category,
          defaultAmount: template.defaultAmount.toFixed(2),
          dueDayOfMonth: template.dueDayOfMonth,
          cadence: template.cadence,
          effectiveStartMonth: template.effectiveStartMonth,
          effectiveEndMonth: template.effectiveEndMonth,
          notes: template.notes,
        })),
      );
    }
  }

  const dbTemplates = await db
    .select({
      id: billTemplates.id,
      name: billTemplates.name,
    })
    .from(billTemplates);
  const nameToId = new Map(dbTemplates.map((entry) => [entry.name, entry.id]));
  const keyToTemplateName = new Map(data.billTemplates.map((template) => [template.key, template.name]));

  const planRows = data.monthlyPlanEntries
    .map((plan) => {
      const templateName = keyToTemplateName.get(plan.templateKey);
      if (!templateName) return null;
      const templateId = nameToId.get(templateName);
      if (!templateId) return null;
      return {
        month: plan.month,
        billTemplateId: templateId,
        plannedAmount: plan.plannedAmount.toFixed(2),
        source: plan.source,
      } as const;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (const group of chunk(planRows, 500)) {
    if (group.length === 0) continue;
    await db.insert(monthlyPlanEntries).values(group).onConflictDoNothing();
  }

  // Keep import idempotent for actual rows generated from historical workbook.
  await db.delete(monthlyActualEntries).where(like(monthlyActualEntries.memo, "Imported from%"));

  const actualRows = data.monthlyActualEntries
    .map((actual) => {
      const templateName = actual.templateKey ? keyToTemplateName.get(actual.templateKey) : null;
      const templateId = templateName ? nameToId.get(templateName) ?? null : null;
      return {
        month: actual.month,
        billTemplateId: templateId,
        actualAmount: actual.actualAmount.toFixed(2),
        paidDate: actual.paidDate,
        status: actual.status,
        memo: actual.memo,
      } as const;
    })
    .filter((row) => row.month);

  for (const group of chunk(actualRows, 500)) {
    if (group.length === 0) continue;
    await db.insert(monthlyActualEntries).values(group);
  }

  const snapshotRows = data.accountSnapshots.map((snapshot) => ({
    snapshotDate: snapshot.snapshotDate,
    accountName: snapshot.accountName,
    balance: snapshot.balance.toFixed(2),
    source: snapshot.source,
  }));

  for (const group of chunk(snapshotRows, 500)) {
    if (group.length === 0) continue;
    await db.insert(accountSnapshots).values(group).onConflictDoNothing();
  }

  await db
    .update(importJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));

  return {
    templates: data.billTemplates.length,
    plans: data.monthlyPlanEntries.length,
    actuals: data.monthlyActualEntries.length,
    snapshots: data.accountSnapshots.length,
    diagnostics: data.diagnostics,
  };
}
