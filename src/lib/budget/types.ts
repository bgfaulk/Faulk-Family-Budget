export type CashflowDirection = "income" | "expense";
export type BillCadence = "monthly" | "biweekly" | "quarterly" | "annual" | "one_off";
export type EntryStatus = "planned" | "paid" | "partial" | "skipped";

export type BillTemplateRecord = {
  id: string;
  name: string;
  counterpartyName: string | null;
  direction: CashflowDirection;
  category: string;
  defaultAmount: number;
  dueDayOfMonth: number | null;
  cadence: BillCadence;
  effectiveStartMonth: string | null;
  effectiveEndMonth: string | null;
  payoffMonth: string | null;
  websiteUrl: string | null;
  paymentAccount: string | null;
  isArchived: boolean;
  uiVisible: boolean;
  archivedAt: string | null;
  archivedReason: string | null;
  notes: string | null;
};

export type MonthlyPlanRecord = {
  id: string;
  month: string;
  billTemplateId: string;
  plannedAmount: number;
  locked: boolean;
  source: "template" | "manual" | "import";
};

export type MonthlyActualRecord = {
  id: string;
  month: string;
  billTemplateId: string | null;
  direction: CashflowDirection | null;
  actualAmount: number;
  paidDate: string | null;
  status: EntryStatus;
  memo: string | null;
};

export type MonthRollup = {
  month: string;
  incomePlanned: number;
  expensePlanned: number;
  incomeActual: number;
  expenseActual: number;
  netPlanned: number;
  netActual: number;
};
