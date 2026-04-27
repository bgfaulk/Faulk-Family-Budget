import * as XLSX from "xlsx";

import type {
  ImportedActualEntry,
  ImportedBillTemplate,
  ImportedPlanEntry,
} from "@/lib/import/types";
import { dataPath } from "@/lib/import/file-utils";
import {
  inferCadence,
  inferCategory,
  inferDirection,
  inferDueDay,
  makeTemplateKey,
  parseAmount,
} from "@/lib/import/normalize";

type ParsedBudgetV1 = {
  billTemplates: ImportedBillTemplate[];
  monthlyPlanEntries: ImportedPlanEntry[];
  monthlyActualEntries: ImportedActualEntry[];
  diagnostics: string[];
};

function monthKeyFromSheetName(sheetName: string): string | null {
  const parsed = new Date(`${sheetName} 1`);
  if (!Number.isFinite(parsed.getTime())) return null;
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseBudgetV1Workbook(fileName = "Faulk Budget Report v1.xlsx"): ParsedBudgetV1 {
  const workbook = XLSX.readFile(dataPath(fileName), { cellDates: false });
  const templates = new Map<string, ImportedBillTemplate>();
  const monthlyPlanEntries: ImportedPlanEntry[] = [];
  const monthlyActualEntries: ImportedActualEntry[] = [];
  const diagnostics: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const month = monthKeyFromSheetName(sheetName);
    if (!month) continue;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      blankrows: false,
      raw: true,
    });

    for (const row of rows) {
      const name = String(row[0] ?? "").trim();
      const dueText = String(row[1] ?? "").trim();
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
          cadence: inferCadence(`${name} ${dueText}`),
          effectiveStartMonth: month,
          effectiveEndMonth: null,
          notes: `Imported from Budget v1 sheet ${sheetName}`,
        });
      }

      monthlyPlanEntries.push({
        month,
        templateKey: key,
        plannedAmount: amount,
        source: "import",
      });
      monthlyActualEntries.push({
        month,
        templateKey: key,
        actualAmount: amount,
        paidDate: null,
        status: "paid",
        memo: `Imported from ${sheetName}`,
      });
    }
  }

  if (monthlyPlanEntries.length === 0) {
    diagnostics.push("No monthly entries parsed from budget v1 workbook.");
  }

  return {
    billTemplates: Array.from(templates.values()),
    monthlyPlanEntries,
    monthlyActualEntries,
    diagnostics,
  };
}
