import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  listDividendHoldings,
  listMonthlyDividendEntries,
} from "@/lib/services/dividend-data-source";
import {
  copyDividendsFromPreviousMonth,
  upsertMonthlyDividendEntries,
} from "@/lib/services/dividend-mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const putSchema = z.object({
  entries: z.array(
    z.object({
      holdingId: z.string().uuid(),
      amount: z.number().min(0),
    }),
  ),
});

type RouteContext = { params: Promise<{ month: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const [holdings, entries] = await Promise.all([
      listDividendHoldings(),
      listMonthlyDividendEntries(month),
    ]);
    return NextResponse.json({ month, holdings, entries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid month." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to load dividend entries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const payload = putSchema.parse(await request.json());
    await upsertMonthlyDividendEntries(month, payload.entries);
    const entries = await listMonthlyDividendEntries(month);
    return NextResponse.json({ month, entries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to save dividend entries.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const body = z.object({ action: z.literal("copyPrevious") }).parse(await request.json());
    if (body.action !== "copyPrevious") {
      return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
    const copiedFrom = await copyDividendsFromPreviousMonth(month);
    const entries = await listMonthlyDividendEntries(month);
    return NextResponse.json({ month, copiedFrom, entries });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to copy dividends.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
