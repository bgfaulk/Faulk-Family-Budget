import type {
  BillCoverageSlice,
  DividendCoverageHistoryPoint,
  DividendCoverageResult,
  DividendCoverageSort,
  MonthlyDividendEntryRecord,
} from "@/lib/dividend/types";
import { monthKeyCompare } from "@/lib/budget/utils";
import { getMonthView } from "@/lib/services/budget-service";
import {
  listDividendHoldings,
  listMonthlyDividendEntries,
  listMonthlyDividendEntriesForMonths,
} from "@/lib/services/dividend-data-source";

export type BillForCoverage = {
  billTemplateId: string;
  name: string;
  amount: number;
  dueDayOfMonth: number | null;
};

export function sortBillsForCoverage(
  bills: BillForCoverage[],
  sort: DividendCoverageSort,
): BillForCoverage[] {
  const copy = [...bills];
  if (sort === "dueDay") {
    return copy.sort((a, b) => {
      const dayA = a.dueDayOfMonth ?? 99;
      const dayB = b.dueDayOfMonth ?? 99;
      return dayA === dayB ? a.name.localeCompare(b.name) : dayA - dayB;
    });
  }
  return copy.sort((a, b) => {
    if (a.amount !== b.amount) return a.amount - b.amount;
    return a.name.localeCompare(b.name);
  });
}

export function computeCoverage(
  bills: BillForCoverage[],
  dividendTotal: number,
  sort: DividendCoverageSort = "smallest",
): {
  billCupTotal: number;
  fillPercent: number;
  fullyCoveredCount: number;
  fullyCoveredNames: string[];
  nextBill: DividendCoverageResult["nextBill"];
  slices: BillCoverageSlice[];
} {
  const sorted = sortBillsForCoverage(bills, sort);
  const billCupTotal = sorted.reduce((sum, bill) => sum + bill.amount, 0);
  let remaining = Math.max(0, dividendTotal);
  const slices: BillCoverageSlice[] = [];
  const fullyCoveredNames: string[] = [];
  let nextBill: DividendCoverageResult["nextBill"] = null;

  for (const bill of sorted) {
    if (remaining >= bill.amount) {
      remaining -= bill.amount;
      fullyCoveredNames.push(bill.name);
      slices.push({
        billTemplateId: bill.billTemplateId,
        name: bill.name,
        amount: bill.amount,
        dueDayOfMonth: bill.dueDayOfMonth,
        status: "covered",
        appliedAmount: bill.amount,
      });
    } else if (remaining > 0) {
      slices.push({
        billTemplateId: bill.billTemplateId,
        name: bill.name,
        amount: bill.amount,
        dueDayOfMonth: bill.dueDayOfMonth,
        status: "partial",
        appliedAmount: remaining,
      });
      if (!nextBill) {
        nextBill = {
          name: bill.name,
          amount: bill.amount,
          remainingNeeded: bill.amount - remaining,
        };
      }
      remaining = 0;
    } else {
      slices.push({
        billTemplateId: bill.billTemplateId,
        name: bill.name,
        amount: bill.amount,
        dueDayOfMonth: bill.dueDayOfMonth,
        status: "uncovered",
        appliedAmount: 0,
      });
      if (!nextBill) {
        nextBill = {
          name: bill.name,
          amount: bill.amount,
          remainingNeeded: bill.amount,
        };
      }
    }
  }

  const fillPercent = billCupTotal > 0 ? Math.min(100, (dividendTotal / billCupTotal) * 100) : 0;

  return {
    billCupTotal,
    fillPercent,
    fullyCoveredCount: fullyCoveredNames.length,
    fullyCoveredNames,
    nextBill,
    slices,
  };
}

export async function getBillsForCoverageMonth(month: string): Promise<BillForCoverage[]> {
  const view = await getMonthView(month);
  return view.entries
    .filter((entry) => entry.direction === "expense")
    .map((entry) => ({
      billTemplateId: entry.billTemplateId,
      name: entry.name,
      amount: entry.plannedAmount > 0 ? entry.plannedAmount : entry.actualAmount,
      dueDayOfMonth: entry.dueDayOfMonth,
    }))
    .filter((entry) => entry.amount > 0);
}

export async function getDividendCoverageForMonth(
  month: string,
  sort: DividendCoverageSort = "smallest",
): Promise<DividendCoverageResult> {
  const [bills, entries] = await Promise.all([
    getBillsForCoverageMonth(month),
    listMonthlyDividendEntries(month),
  ]);
  const dividendTotal = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const coverage = computeCoverage(bills, dividendTotal, sort);

  return {
    month,
    dividendTotal,
    entries,
    ...coverage,
  };
}

export async function getDividendCoverageHistory(
  fromMonth?: string,
  toMonth?: string,
  sort: DividendCoverageSort = "smallest",
): Promise<DividendCoverageHistoryPoint[]> {
  const allEntries = await listMonthlyDividendEntriesForMonths();
  const monthsWithDividends = [...new Set(allEntries.map((e) => e.month))].sort(monthKeyCompare);

  if (monthsWithDividends.length === 0) {
    return [];
  }

  const start = fromMonth ?? monthsWithDividends[0];
  const end = toMonth ?? monthsWithDividends[monthsWithDividends.length - 1];
  const monthsInRange = monthsWithDividends.filter((m) => m >= start && m <= end);

  const points: DividendCoverageHistoryPoint[] = [];
  for (const month of monthsInRange) {
    const coverage = await getDividendCoverageForMonth(month, sort);
    points.push({
      month: coverage.month,
      dividendTotal: coverage.dividendTotal,
      billCupTotal: coverage.billCupTotal,
      fillPercent: coverage.fillPercent,
      fullyCoveredCount: coverage.fullyCoveredCount,
    });
  }
  return points;
}

export function sumDividendEntries(entries: MonthlyDividendEntryRecord[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}
