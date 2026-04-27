import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

type CsvRow = string[];

export type MonarchRow = {
  date: string;
  balance: number;
  account: string;
};

export type BudgetLineItem = {
  label: string;
  amount: number;
};

export type SpreadsheetPreviewRow = {
  rowNumber: number;
  values: string[];
};

export type BudgetDashboardData = {
  latestDate: string | null;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  accountCount: number;
  topAssets: MonarchRow[];
  topDebts: MonarchRow[];
  netWorthTrend: Array<{ date: string; value: number }>;
  budgetReportV2Title: string;
  budgetReportV2Items: BudgetLineItem[];
  budgetV1SheetCount: number;
  budgetV1LatestSheetName: string | null;
  budgetV1PreviewRows: SpreadsheetPreviewRow[];
};

function parseNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  const cleaned = raw.replace(/\$/g, "").replace(/,/g, "").trim();
  if (!cleaned) return NaN;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
}

function parseCsvLine(line: string): CsvRow {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

async function readCsv(fileName: string): Promise<CsvRow[]> {
  const filePath = path.join(process.cwd(), "data", fileName);
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map(parseCsvLine);
}

function parseMonarchRows(rows: CsvRow[]): MonarchRow[] {
  return rows
    .slice(1)
    .map((row) => ({
      date: row[0] ?? "",
      balance: parseNumber(row[1]),
      account: row[2] ?? "",
    }))
    .filter((row) => row.date && row.account && Number.isFinite(row.balance));
}

function getLatestAccountSnapshot(rows: MonarchRow[]): MonarchRow[] {
  const byAccount = new Map<string, MonarchRow>();

  for (const row of rows) {
    const existing = byAccount.get(row.account);
    if (!existing || row.date > existing.date) {
      byAccount.set(row.account, row);
    }
  }

  return Array.from(byAccount.values());
}

function getNetWorthTrend(rows: MonarchRow[]): Array<{ date: string; value: number }> {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    const current = byDate.get(row.date) ?? 0;
    byDate.set(row.date, current + row.balance);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function parseBudgetV2Items(rows: CsvRow[]): { title: string; items: BudgetLineItem[] } {
  const title = rows[0]?.[0] ?? "Budget Report V2";
  const items: BudgetLineItem[] = [];

  for (const row of rows.slice(1)) {
    const label = (row[0] ?? "").trim();
    const maybeAmount = row[2] ?? "";
    if (!label) continue;
    const amount = parseNumber(maybeAmount);
    if (Number.isFinite(amount)) {
      items.push({ label, amount });
    }
  }

  return { title, items };
}

function parseMonthYearSheetName(name: string): number | null {
  const parts = name.split(" ");
  if (parts.length !== 2) return null;
  const [monthText, yearText] = parts;
  const parsed = new Date(`${monthText} 1, ${yearText}`);
  const epoch = parsed.getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function loadBudgetV1Workbook(): {
  sheetCount: number;
  latestSheetName: string | null;
  previewRows: SpreadsheetPreviewRow[];
} {
  const workbookPath = path.join(process.cwd(), "data", "Faulk Budget Report v1.xlsx");
  const workbook = XLSX.readFile(workbookPath, { cellDates: false });
  const sheetNames = workbook.SheetNames;

  const datedSheets = sheetNames
    .map((name) => ({ name, epoch: parseMonthYearSheetName(name) }))
    .filter((item): item is { name: string; epoch: number } => item.epoch !== null)
    .sort((a, b) => b.epoch - a.epoch);

  const latestSheetName = datedSheets[0]?.name ?? sheetNames[0] ?? null;
  if (!latestSheetName) {
    return { sheetCount: sheetNames.length, latestSheetName: null, previewRows: [] };
  }

  const sheet = workbook.Sheets[latestSheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    blankrows: false,
    raw: true,
  });

  const previewRows = matrix
    .slice(0, 40)
    .map((row, index) => ({
      rowNumber: index + 1,
      values: row
        .slice(0, 5)
        .map((value) => (value === null || value === undefined ? "" : String(value).trim())),
    }))
    .filter((row) => row.values.some((value) => value.length > 0));

  return {
    sheetCount: sheetNames.length,
    latestSheetName,
    previewRows,
  };
}

export async function loadBudgetDashboardData(): Promise<BudgetDashboardData> {
  const monarchCsvRows = await readCsv("Faulk Monarch Data.csv");
  const budgetV2Rows = await readCsv("Faulk Budget Report v2.csv");

  const monarchRows = parseMonarchRows(monarchCsvRows);
  const latestSnapshot = getLatestAccountSnapshot(monarchRows);

  const totalAssets = latestSnapshot
    .filter((row) => row.balance > 0)
    .reduce((sum, row) => sum + row.balance, 0);
  const totalLiabilities = latestSnapshot
    .filter((row) => row.balance < 0)
    .reduce((sum, row) => sum + row.balance, 0);
  const netWorth = totalAssets + totalLiabilities;
  const latestDate =
    latestSnapshot.length > 0
      ? latestSnapshot.reduce((max, row) => (row.date > max ? row.date : max), latestSnapshot[0].date)
      : null;

  const topAssets = latestSnapshot
    .filter((row) => row.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8);

  const topDebts = latestSnapshot
    .filter((row) => row.balance < 0)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, 8);

  const trend = getNetWorthTrend(monarchRows).slice(-30);
  const budgetV2 = parseBudgetV2Items(budgetV2Rows);
  const budgetV1 = loadBudgetV1Workbook();

  return {
    latestDate,
    netWorth,
    totalAssets,
    totalLiabilities,
    accountCount: latestSnapshot.length,
    topAssets,
    topDebts,
    netWorthTrend: trend,
    budgetReportV2Title: budgetV2.title,
    budgetReportV2Items: budgetV2.items.slice(0, 20),
    budgetV1SheetCount: budgetV1.sheetCount,
    budgetV1LatestSheetName: budgetV1.latestSheetName,
    budgetV1PreviewRows: budgetV1.previewRows,
  };
}
