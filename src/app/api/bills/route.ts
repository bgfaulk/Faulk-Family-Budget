import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listBillTemplates } from "@/lib/services/data-source";
import {
  createBillTemplate,
  updateBillLifecycle,
  updateBillTemplateDetails,
} from "@/lib/services/budget-mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  counterpartyName: z.string().trim().max(200).nullable().optional(),
  direction: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(120),
  defaultAmount: z.number().min(0),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  cadence: z.enum(["monthly", "biweekly", "quarterly", "annual", "one_off"]),
  effectiveStartMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  effectiveEndMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  payoffMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  websiteUrl: z.string().trim().max(500).nullable().optional(),
  paymentAccount: z.string().trim().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const updateSchema = z
  .object({
    id: z.string().uuid(),
    isArchived: z.boolean().optional(),
    uiVisible: z.boolean().optional(),
    archivedReason: z.string().max(4000).nullable().optional(),
    effectiveEndMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    counterpartyName: z.string().trim().max(200).nullable().optional(),
    category: z.string().trim().min(1).max(120).optional(),
    dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    defaultAmount: z.number().min(0).optional(),
    cadence: z.enum(["monthly", "biweekly", "quarterly", "annual", "one_off"]).optional(),
    paymentAccount: z.string().trim().max(200).nullable().optional(),
    websiteUrl: z.string().trim().max(500).nullable().optional(),
    payoffMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    effectiveStartMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    direction: z.enum(["income", "expense"]).optional(),
  })
  .refine(
    (data) => {
      const { id: _id, ...rest } = data;
      return Object.values(rest).some((v) => v !== undefined);
    },
    { message: "Provide at least one field to update." },
  );

export async function GET() {
  try {
    const templates = await listBillTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list recurring expenses.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = createSchema.parse(await request.json());
    const created = await createBillTemplate(payload);
    return NextResponse.json({ bill: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create recurring expense.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = updateSchema.parse(await request.json());

    const hasLifecycle =
      payload.isArchived !== undefined ||
      payload.uiVisible !== undefined ||
      payload.archivedReason !== undefined ||
      payload.effectiveEndMonth !== undefined;
    const hasDetails =
      payload.name !== undefined ||
      payload.counterpartyName !== undefined ||
      payload.category !== undefined ||
      payload.dueDayOfMonth !== undefined ||
      payload.defaultAmount !== undefined ||
      payload.cadence !== undefined ||
      payload.paymentAccount !== undefined ||
      payload.websiteUrl !== undefined ||
      payload.payoffMonth !== undefined ||
      payload.effectiveStartMonth !== undefined ||
      payload.direction !== undefined;

    if (hasDetails) {
      const updatedDetails = await updateBillTemplateDetails(payload.id, {
        name: payload.name,
        counterpartyName: payload.counterpartyName,
        category: payload.category,
        dueDayOfMonth: payload.dueDayOfMonth,
        defaultAmount: payload.defaultAmount,
        cadence: payload.cadence,
        paymentAccount: payload.paymentAccount,
        websiteUrl: payload.websiteUrl,
        payoffMonth: payload.payoffMonth,
        effectiveStartMonth: payload.effectiveStartMonth,
        direction: payload.direction,
      });
      if (!updatedDetails) {
        return NextResponse.json({ error: "Recurring expense not found." }, { status: 404 });
      }
    }

    if (hasLifecycle) {
      const updated = await updateBillLifecycle(payload.id, {
        isArchived: payload.isArchived,
        uiVisible: payload.uiVisible,
        archivedReason: payload.archivedReason,
        effectiveEndMonth: payload.effectiveEndMonth,
      });
      if (!updated) {
        return NextResponse.json({ error: "Recurring expense not found." }, { status: 404 });
      }
    }

    const templates = await listBillTemplates();
    const bill = templates.find((row) => row.id === payload.id);
    if (!bill) {
      return NextResponse.json({ error: "Recurring expense not found." }, { status: 404 });
    }

    return NextResponse.json({ bill });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update recurring expense.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
