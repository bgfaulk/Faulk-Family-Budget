export type DividendCadence = "weekly" | "monthly" | "other";

export type DividendHoldingRecord = {
  id: string;
  ticker: string;
  name: string | null;
  displayOrder: number;
  dividendCadence: DividendCadence;
  isArchived: boolean;
  notes: string | null;
};

export type MonthlyDividendEntryRecord = {
  id: string;
  month: string;
  holdingId: string;
  ticker: string;
  amount: number;
};

export type BillCoverageSlice = {
  billTemplateId: string;
  name: string;
  amount: number;
  dueDayOfMonth: number | null;
  status: "covered" | "partial" | "uncovered";
  appliedAmount: number;
};

export type DividendCoverageSort = "smallest" | "dueDay";

export type DividendCoverageResult = {
  month: string;
  dividendTotal: number;
  billCupTotal: number;
  fillPercent: number;
  fullyCoveredCount: number;
  fullyCoveredNames: string[];
  nextBill: { name: string; amount: number; remainingNeeded: number } | null;
  slices: BillCoverageSlice[];
  entries: MonthlyDividendEntryRecord[];
};

export type DividendCoverageHistoryPoint = {
  month: string;
  dividendTotal: number;
  billCupTotal: number;
  fillPercent: number;
  fullyCoveredCount: number;
};
