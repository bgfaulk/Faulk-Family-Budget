import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rolloverToNextMonth } from "@/lib/services/budget-mutations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ month: string }> },
) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const result = await rolloverToNextMonth(month);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Rollover failed.";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
