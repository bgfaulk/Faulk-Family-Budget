import { addMonths, monthKeyCompare, toMonthKey } from "@/lib/budget/utils";
import type { MonthRollup } from "@/lib/budget/types";
import { aggregateMonthRollups } from "@/lib/services/data-source";

/** Month rollups before this are ignored for projections (tracking starts here). */
export const PROJECTIONS_DATA_START_MONTH = "2026-04";

type ProjectionPoint = {
  month: string;
  projectedIncome: number;
  projectedExpenses: number;
  projectedNet: number;
  bestCaseNet: number;
  conservativeNet: number;
};

export type ProjectionResponse = {
  baseWindow: {
    rolling3Income: number;
    rolling3Expense: number;
    rolling6Income: number;
    rolling6Expense: number;
  };
  points: ProjectionPoint[];
};

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeRollingAverages(timeline: MonthRollup[]): ProjectionResponse["baseWindow"] {
  const recent3 = timeline.slice(-3);
  const recent6 = timeline.slice(-6);

  return {
    rolling3Income: avg(recent3.map((item) => item.incomeActual || item.incomePlanned)),
    rolling3Expense: avg(recent3.map((item) => item.expenseActual || item.expensePlanned)),
    rolling6Income: avg(recent6.map((item) => item.incomeActual || item.incomePlanned)),
    rolling6Expense: avg(recent6.map((item) => item.expenseActual || item.expensePlanned)),
  };
}

export function buildProjectionPoints(
  lastMonth: string,
  rolling3Income: number,
  rolling3Expense: number,
  horizonMonths: number,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  for (let index = 1; index <= horizonMonths; index += 1) {
    const month = addMonths(lastMonth, index);
    const projectedIncome = rolling3Income;
    const projectedExpenses = rolling3Expense;
    const projectedNet = projectedIncome - projectedExpenses;
    points.push({
      month,
      projectedIncome,
      projectedExpenses,
      projectedNet,
      bestCaseNet: projectedNet * 1.1,
      conservativeNet: projectedNet * 0.85,
    });
  }
  return points;
}

export async function getProjectionData(horizonMonths = 12): Promise<ProjectionResponse> {
  const all = await aggregateMonthRollups();
  const timeline = all
    .filter((m) => m.month >= PROJECTIONS_DATA_START_MONTH)
    .sort((a, b) => monthKeyCompare(a.month, b.month));

  if (timeline.length === 0) {
    const nowMonth = toMonthKey(new Date());
    const anchor =
      nowMonth >= PROJECTIONS_DATA_START_MONTH ? nowMonth : PROJECTIONS_DATA_START_MONTH;
    return {
      baseWindow: {
        rolling3Income: 0,
        rolling3Expense: 0,
        rolling6Income: 0,
        rolling6Expense: 0,
      },
      points: buildProjectionPoints(anchor, 0, 0, horizonMonths),
    };
  }

  const baseWindow = computeRollingAverages(timeline);
  const lastMonth = timeline[timeline.length - 1].month;

  return {
    baseWindow,
    points: buildProjectionPoints(
      lastMonth,
      baseWindow.rolling3Income,
      baseWindow.rolling3Expense,
      horizonMonths,
    ),
  };
}
