CREATE TYPE "public"."account_snapshot_source" AS ENUM('monarch_import', 'manual');--> statement-breakpoint
CREATE TYPE "public"."cadence" AS ENUM('monthly', 'biweekly', 'quarterly', 'annual', 'one_off');--> statement-breakpoint
CREATE TYPE "public"."cashflow_direction" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('created', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_source_type" AS ENUM('budget_v1_xlsx', 'budget_v2_csv', 'monarch_csv');--> statement-breakpoint
CREATE TYPE "public"."month_actual_status" AS ENUM('planned', 'paid', 'partial', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."month_entry_source" AS ENUM('template', 'manual', 'import');--> statement-breakpoint
CREATE TABLE "account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"account_name" varchar(240) NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"source" "account_snapshot_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"counterparty_name" varchar(200),
	"direction" "cashflow_direction" NOT NULL,
	"category" varchar(120) DEFAULT 'uncategorized' NOT NULL,
	"default_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"due_day_of_month" integer,
	"cadence" "cadence" DEFAULT 'monthly' NOT NULL,
	"effective_start_month" varchar(7),
	"effective_end_month" varchar(7),
	"is_archived" boolean DEFAULT false NOT NULL,
	"ui_visible" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "import_source_type" NOT NULL,
	"source_file_name" varchar(260) NOT NULL,
	"status" "import_job_status" DEFAULT 'created' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_payload" text NOT NULL,
	"normalized_payload" text,
	"parse_status" varchar(32) DEFAULT 'ok' NOT NULL,
	"parse_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "month_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" varchar(7) NOT NULL,
	"total_income_planned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_expense_planned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_income_actual" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_expense_actual" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_planned" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_actual" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_actual_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" varchar(7) NOT NULL,
	"bill_template_id" uuid,
	"actual_amount" numeric(12, 2) NOT NULL,
	"paid_date" date,
	"status" "month_actual_status" DEFAULT 'planned' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" varchar(7) NOT NULL,
	"bill_template_id" uuid NOT NULL,
	"planned_amount" numeric(12, 2) NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"source" "month_entry_source" DEFAULT 'template' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_actual_entries" ADD CONSTRAINT "monthly_actual_entries_bill_template_id_bill_templates_id_fk" FOREIGN KEY ("bill_template_id") REFERENCES "public"."bill_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_plan_entries" ADD CONSTRAINT "monthly_plan_entries_bill_template_id_bill_templates_id_fk" FOREIGN KEY ("bill_template_id") REFERENCES "public"."bill_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_snapshots_date_name_uidx" ON "account_snapshots" USING btree ("snapshot_date","account_name");--> statement-breakpoint
CREATE UNIQUE INDEX "month_summaries_month_uidx" ON "month_summaries" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_plan_entries_month_template_uidx" ON "monthly_plan_entries" USING btree ("month","bill_template_id");