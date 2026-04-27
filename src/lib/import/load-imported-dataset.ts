import type {
  ImportedActualEntry,
  ImportedBillTemplate,
  ImportedDataset,
  ImportedPlanEntry,
} from "@/lib/import/types";
import { parseBudgetV1Workbook } from "@/lib/import/budget-v1";
import { parseBudgetV2Csv } from "@/lib/import/budget-v2";
import { parseMonarchCsv } from "@/lib/import/monarch";

function mergeTemplates(...groups: ImportedBillTemplate[][]): ImportedBillTemplate[] {
  const merged = new Map<string, ImportedBillTemplate>();

  for (const group of groups) {
    for (const template of group) {
      const existing = merged.get(template.key);
      if (!existing) {
        merged.set(template.key, template);
        continue;
      }

      merged.set(template.key, {
        ...existing,
        defaultAmount: template.defaultAmount || existing.defaultAmount,
        dueDayOfMonth: template.dueDayOfMonth ?? existing.dueDayOfMonth,
        effectiveStartMonth: existing.effectiveStartMonth ?? template.effectiveStartMonth,
        effectiveEndMonth: template.effectiveEndMonth ?? existing.effectiveEndMonth,
        notes: [existing.notes, template.notes].filter(Boolean).join(" | ") || null,
      });
    }
  }

  return Array.from(merged.values());
}

function dedupePlanEntries(entries: ImportedPlanEntry[]): ImportedPlanEntry[] {
  const unique = new Map<string, ImportedPlanEntry>();
  for (const entry of entries) {
    unique.set(`${entry.month}:${entry.templateKey}`, entry);
  }
  return Array.from(unique.values()).sort((a, b) =>
    a.month === b.month ? a.templateKey.localeCompare(b.templateKey) : a.month.localeCompare(b.month),
  );
}

function dedupeActualEntries(entries: ImportedActualEntry[]): ImportedActualEntry[] {
  const unique = new Map<string, ImportedActualEntry>();
  for (const entry of entries) {
    const key = `${entry.month}:${entry.templateKey ?? "adhoc"}:${entry.actualAmount}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return Array.from(unique.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export async function loadImportedDataset(): Promise<ImportedDataset> {
  const [v2, monarch] = await Promise.all([parseBudgetV2Csv(), parseMonarchCsv()]);
  const v1 = parseBudgetV1Workbook();

  const billTemplates = mergeTemplates(v1.billTemplates, v2.billTemplates);
  const monthlyPlanEntries = dedupePlanEntries([...v1.monthlyPlanEntries, ...v2.monthlyPlanEntries]);
  const monthlyActualEntries = dedupeActualEntries([...v1.monthlyActualEntries]);

  return {
    billTemplates,
    monthlyPlanEntries,
    monthlyActualEntries,
    accountSnapshots: monarch,
    diagnostics: [...v1.diagnostics, ...v2.diagnostics],
  };
}
