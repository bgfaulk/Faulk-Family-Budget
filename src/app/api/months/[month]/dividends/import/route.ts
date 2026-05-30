import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { applySnowballImport, previewSnowballImport } from "@/lib/services/dividend-import-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const bodySchema = z.object({
  csvText: z.string().min(1),
  previewOnly: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ month: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { month } = await context.params;
    monthSchema.parse(month);
    const payload = bodySchema.parse(await request.json());

    if (payload.previewOnly) {
      const preview = await previewSnowballImport(payload.csvText, month);
      return NextResponse.json({ preview });
    }

    const result = await applySnowballImport(payload.csvText, month);
    return NextResponse.json({ month, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed.", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
