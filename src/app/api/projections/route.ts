import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectionData } from "@/lib/services/projection-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  horizon: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.parse({
      horizon: request.nextUrl.searchParams.get("horizon") ?? 12,
    });
    const data = await getProjectionData(parsed.horizon);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid horizon." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch projections.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
