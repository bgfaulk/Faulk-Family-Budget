import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const cashflowDirectionEnum = pgEnum("cashflow_direction", ["income", "expense"]);
export const cadenceEnum = pgEnum("cadence", ["monthly", "biweekly", "quarterly", "annual", "one_off"]);
export const monthEntrySourceEnum = pgEnum("month_entry_source", ["template", "manual", "import"]);
export const monthActualStatusEnum = pgEnum("month_actual_status", ["planned", "paid", "partial", "skipped"]);
export const importSourceTypeEnum = pgEnum("import_source_type", ["budget_v1_xlsx", "budget_v2_csv", "monarch_csv"]);
export const importJobStatusEnum = pgEnum("import_job_status", ["created", "processing", "completed", "failed"]);
export const accountSnapshotSourceEnum = pgEnum("account_snapshot_source", ["monarch_import", "manual"]);

/** User-defined "Paid from" labels for recurring expenses (e.g. checking account, card). */
export const paymentSources = pgTable(
  "payment_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameUnique: uniqueIndex("payment_sources_name_uidx").on(table.name),
  }),
);

export const billTemplates = pgTable("bill_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  counterpartyName: varchar("counterparty_name", { length: 200 }),
  direction: cashflowDirectionEnum("direction").notNull(),
  category: varchar("category", { length: 120 }).notNull().default("uncategorized"),
  defaultAmount: numeric("default_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  dueDayOfMonth: integer("due_day_of_month"),
  cadence: cadenceEnum("cadence").notNull().default("monthly"),
  effectiveStartMonth: varchar("effective_start_month", { length: 7 }),
  effectiveEndMonth: varchar("effective_end_month", { length: 7 }),
  payoffMonth: varchar("payoff_month", { length: 7 }),
  websiteUrl: varchar("website_url", { length: 500 }),
  paymentAccount: varchar("payment_account", { length: 200 }),
  isArchived: boolean("is_archived").notNull().default(false),
  uiVisible: boolean("ui_visible").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedReason: text("archived_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthlyPlanEntries = pgTable(
  "monthly_plan_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
    billTemplateId: uuid("bill_template_id")
      .notNull()
      .references(() => billTemplates.id, { onDelete: "restrict" }),
    plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull(),
    locked: boolean("locked").notNull().default(false),
    source: monthEntrySourceEnum("source").notNull().default("template"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    monthTemplateUnique: uniqueIndex("monthly_plan_entries_month_template_uidx").on(
      table.month,
      table.billTemplateId,
    ),
  }),
);

export const monthlyActualEntries = pgTable("monthly_actual_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  month: varchar("month", { length: 7 }).notNull(), // YYYY-MM
  billTemplateId: uuid("bill_template_id").references(() => billTemplates.id, { onDelete: "set null" }),
  direction: cashflowDirectionEnum("direction"),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }).notNull(),
  paidDate: date("paid_date"),
  status: monthActualStatusEnum("status").notNull().default("planned"),
  memo: text("memo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthSummaries = pgTable(
  "month_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    month: varchar("month", { length: 7 }).notNull(),
    totalIncomePlanned: numeric("total_income_planned", { precision: 14, scale: 2 }).notNull().default("0"),
    totalExpensePlanned: numeric("total_expense_planned", { precision: 14, scale: 2 }).notNull().default("0"),
    totalIncomeActual: numeric("total_income_actual", { precision: 14, scale: 2 }).notNull().default("0"),
    totalExpenseActual: numeric("total_expense_actual", { precision: 14, scale: 2 }).notNull().default("0"),
    netPlanned: numeric("net_planned", { precision: 14, scale: 2 }).notNull().default("0"),
    netActual: numeric("net_actual", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    monthUnique: uniqueIndex("month_summaries_month_uidx").on(table.month),
  }),
);

export const accountSnapshots = pgTable(
  "account_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    accountName: varchar("account_name", { length: 240 }).notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
    source: accountSnapshotSourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    snapshotAccountUnique: uniqueIndex("account_snapshots_date_name_uidx").on(
      table.snapshotDate,
      table.accountName,
    ),
  }),
);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceType: importSourceTypeEnum("source_type").notNull(),
  sourceFileName: varchar("source_file_name", { length: 260 }).notNull(),
  status: importJobStatusEnum("status").notNull().default("created"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
});

export const importRows = pgTable("import_rows", {
  id: uuid("id").defaultRandom().primaryKey(),
  importJobId: uuid("import_job_id")
    .notNull()
    .references(() => importJobs.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  rawPayload: text("raw_payload").notNull(),
  normalizedPayload: text("normalized_payload"),
  parseStatus: varchar("parse_status", { length: 32 }).notNull().default("ok"),
  parseMessage: text("parse_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentSource = typeof paymentSources.$inferSelect;
export type NewPaymentSource = typeof paymentSources.$inferInsert;
export type BillTemplate = typeof billTemplates.$inferSelect;
export type NewBillTemplate = typeof billTemplates.$inferInsert;
export type MonthlyPlanEntry = typeof monthlyPlanEntries.$inferSelect;
export type NewMonthlyPlanEntry = typeof monthlyPlanEntries.$inferInsert;
export type MonthlyActualEntry = typeof monthlyActualEntries.$inferSelect;
export type NewMonthlyActualEntry = typeof monthlyActualEntries.$inferInsert;
export type MonthSummary = typeof monthSummaries.$inferSelect;
export type NewMonthSummary = typeof monthSummaries.$inferInsert;
export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type NewAccountSnapshot = typeof accountSnapshots.$inferInsert;
