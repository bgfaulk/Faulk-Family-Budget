CREATE TABLE "dividend_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticker" varchar(16) NOT NULL,
	"name" varchar(200),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_dividend_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" varchar(7) NOT NULL,
	"holding_id" uuid NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monthly_dividend_entries" ADD CONSTRAINT "monthly_dividend_entries_holding_id_dividend_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."dividend_holdings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dividend_holdings_ticker_uidx" ON "dividend_holdings" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_dividend_entries_month_holding_uidx" ON "monthly_dividend_entries" USING btree ("month","holding_id");