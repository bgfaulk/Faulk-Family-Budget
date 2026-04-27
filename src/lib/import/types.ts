import type { BillCadence, CashflowDirection } from "@/lib/budget/types";

export type ImportedBillTemplate = {
  key: string;
  name: string;
  counterpartyName: string | null;
  direction: CashflowDirection;
  category: string;
  defaultAmount: number;
  dueDayOfMonth: number | null;
  cadence: BillCadence;
  effectiveStartMonth: string | null;
  effectiveEndMonth: string | null;
  notes: string | null;
};

export type ImportedPlanEntry = {
  month: string;
  templateKey: string;
  plannedAmount: number;
  source: "template" | "manual" | "import";
};

export type ImportedActualEntry = {
  month: string;
  templateKey: string | null;
  actualAmount: number;
  paidDate: string | null;
  status: "planned" | "paid" | "partial" | "skipped";
  memo: string | null;
};

export type ImportedAccountSnapshot = {
  snapshotDate: string;
  accountName: string;
  balance: number;
  source: "monarch_import" | "manual";
};

export type ImportedDataset = {
  billTemplates: ImportedBillTemplate[];
  monthlyPlanEntries: ImportedPlanEntry[];
  monthlyActualEntries: ImportedActualEntry[];
  accountSnapshots: ImportedAccountSnapshot[];
  diagnostics: string[];
};
