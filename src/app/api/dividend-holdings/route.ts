import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listDividendHoldings } from "@/lib/services/dividend-data-source";
import { createDividendHolding, updateDividendHolding } from "@/lib/services/dividend-mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  ticker: z.string().trim().min(1).max(16),
  name: z.string().trim().max(200).nullable().optional(),
  displayOrder: z.number().int().optional(),
  dividendCadence: z.enum(["weekly", "monthly", "other"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(200).nullable().optional(),
  displayOrder: z.number().int().optional(),
  dividendCadence: z.enum(["weekly", "monthly", "other"]).optional(),
  isArchived: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function GET() {
  try {
    const holdings = await listDividendHoldings();
    return NextResponse.json({ holdings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list dividend holdings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = createSchema.parse(await request.json());
    const created = await createDividendHolding(payload);
    return NextResponse.json({ holding: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create holding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = updateSchema.parse(await request.json());
    const updated = await updateDividendHolding(payload);
    return NextResponse.json({ holding: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to update holding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
