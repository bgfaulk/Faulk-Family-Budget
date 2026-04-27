import { readCsvRows } from "@/lib/import/file-utils";
import { inferCategory, inferDueDay, normalizeLabel, parseAmount } from "@/lib/import/normalize";

export type MasterBillRow = {
  payorName: string;
  dueText: string;
  amount: number;
  payoffMonth: string | null;
  companyWebsite: string | null;
  paymentAccount: string | null;
};

export function normalizeBillName(name: string): string {
  return normalizeLabel(name);
}

export function determineBillCategory(name: string): string {
  const normalized = normalizeLabel(name);
  if (/\b(mtg|mortgage|loan|credit card|cc|auto)\b/.test(normalized)) return "debt";
  if (/\b(internet|att|entergy|city of greenbrier)\b/.test(normalized)) return "utilities";
  if (/\b(insurance)\b/.test(normalized)) return "insurance";
  if (/\b(spotify|youtube|xbox|netflix|ink)\b/.test(normalized)) return "subscriptions";
  return inferCategory(name);
}

export async function loadMasterBills(fileName = "Faulk Master Bills.csv"): Promise<MasterBillRow[]> {
  const rows = await readCsvRows(fileName);
  const result: MasterBillRow[] = [];

  for (const row of rows.slice(1)) {
    const payorName = (row[0] ?? "").trim();
    const dueText = (row[1] ?? "").trim();
    const amount = parseAmount(row[2] ?? "");
    const payoffMonthRaw = (row[3] ?? "").trim();
    const companyWebsiteRaw = (row[4] ?? "").trim();
    const paymentAccountRaw = (row[5] ?? "").trim();
    if (!payorName || amount === null) continue;

    result.push({
      payorName,
      dueText,
      amount,
      payoffMonth: payoffMonthRaw || null,
      companyWebsite: companyWebsiteRaw || null,
      paymentAccount: paymentAccountRaw || null,
    });
  }

  return result;
}

export function getDueDayFromText(dueText: string): number | null {
  return inferDueDay(dueText);
}
