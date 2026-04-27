import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  deleteMonthEntry,
  getMonthEntries,
  upsertMonthlyActual,
  upsertMonthlyPlan,
} from "@/lib/services/budget-mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const updateSchema = z.object({
  plan: z
    .object({
      billTemplateId: z.string().uuid(),
      plannedAmount: z.number().min(0),
      source: z.enum(["template", "manual", "import"]).default("manual"),
    })
    .optional(),
  actual: z
    .object({
      actualId: z.string().uuid().optional(),
      billTemplateId: z.string().uuid().nullable(),
      direction: z.enum(["income", "expense"]).nullable().optional(),
      actualAmount: z.number().min(0),
      paidDate: z.string().nullable().optional(),
      status: z.enum(["planned", "paid", "partial", "skipped"]),
      memo: z.string().max(4000).nullable().optional(),
    })
    .optional(),
});

const deleteSchema = z.object({
  actualId: z.string().uuid().nullable().optional(),
  billTemplateId: z.string().uuid().nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ month: string }>;
  },
) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const data = await getMonthEntries(month);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to load month entries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ month: string }>;
  },
) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const payload = updateSchema.parse(await request.json());

    if (payload.plan) {
      await upsertMonthlyPlan({
        month,
        billTemplateId: payload.plan.billTemplateId,
        plannedAmount: payload.plan.plannedAmount,
        source: payload.plan.source,
      });
    }

    let actual = null;
    if (payload.actual) {
      actual = await upsertMonthlyActual({
        actualId: payload.actual.actualId,
        month,
        billTemplateId: payload.actual.billTemplateId,
        direction: payload.actual.direction ?? null,
        actualAmount: payload.actual.actualAmount,
        paidDate: payload.actual.paidDate ?? null,
        status: payload.actual.status,
        memo: payload.actual.memo,
      });
    }

    return NextResponse.json({ ok: true, actual });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update month entries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ month: string }>;
  },
) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const payload = deleteSchema.parse(await request.json());

    if (!payload.actualId && !payload.billTemplateId) {
      return NextResponse.json(
        { error: "Provide actualId or billTemplateId to delete an entry." },
        { status: 400 },
      );
    }

    const result = await deleteMonthEntry({
      month,
      actualId: payload.actualId ?? null,
      billTemplateId: payload.billTemplateId ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete month entry.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
