import type { ImportedBillTemplate, ImportedPlanEntry } from "@/lib/import/types";
import { readCsvRows } from "@/lib/import/file-utils";
import {
  inferCadence,
  inferCategory,
  inferDirection,
  inferDueDay,
  makeTemplateKey,
  parseAmount,
} from "@/lib/import/normalize";

type ParsedBudgetV2 = {
  billTemplates: ImportedBillTemplate[];
  monthlyPlanEntries: ImportedPlanEntry[];
  diagnostics: string[];
};

function inferMonthFromTitle(title: string): string | null {
  const date = new Date(title);
  if (!Number.isFinite(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function parseBudgetV2Csv(fileName = "Faulk Budget Report v2.csv"): Promise<ParsedBudgetV2> {
  const rows = await readCsvRows(fileName);
  const title = rows[0]?.[0] ?? "Budget Report";
  const month = inferMonthFromTitle(title);
  const templates = new Map<string, ImportedBillTemplate>();
  const planEntries: ImportedPlanEntry[] = [];
  const diagnostics: string[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const name = (row[0] ?? "").trim();
    const dueText = (row[1] ?? "").trim();
    const amount = parseAmount(row[2] ?? "");
    if (!name || amount === null) continue;

    const key = makeTemplateKey(name);
    if (!templates.has(key)) {
      templates.set(key, {
        key,
        name,
        counterpartyName: name,
        direction: inferDirection(name),
        category: inferCategory(name),
        defaultAmount: amount,
        dueDayOfMonth: inferDueDay(dueText),
        cadence: inferCadence(`${dueText} ${name}`),
        effectiveStartMonth: month,
        effectiveEndMonth: null,
        notes: dueText || null,
      });
    }

    if (month) {
      planEntries.push({
        month,
        templateKey: key,
        plannedAmount: amount,
        source: "import",
      });
    } else {
      diagnostics.push("Budget v2 title did not parse to a month key (YYYY-MM).");
    }
  }

  return {
    billTemplates: Array.from(templates.values()),
    monthlyPlanEntries: planEntries,
    diagnostics,
  };
}
