import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPaymentSource } from "@/lib/services/budget-mutations";
import { listPaymentSources } from "@/lib/services/data-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function GET() {
  try {
    const sources = await listPaymentSources();
    return NextResponse.json({ sources });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list paid-from options.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = createSchema.parse(await request.json());
    const source = await createPaymentSource(payload.name);
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create paid-from entry.";
    if (message === "DUPLICATE_PAID_FROM") {
      return NextResponse.json({ error: "That paid-from name already exists." }, { status: 409 });
    }
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
