import { NextResponse } from "next/server";

import { getDbSizeReport } from "@/lib/services/db-size-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const report = await getDbSizeReport(25);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve database size metrics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
