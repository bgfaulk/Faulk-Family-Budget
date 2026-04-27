CREATE TABLE "payment_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_sources_name_uidx" ON "payment_sources" USING btree ("name");
--> statement-breakpoint
INSERT INTO "payment_sources" ("name")
SELECT DISTINCT TRIM("payment_account") AS n
FROM "bill_templates"
WHERE "payment_account" IS NOT NULL AND TRIM("payment_account") <> ''
ON CONFLICT ("name") DO NOTHING;