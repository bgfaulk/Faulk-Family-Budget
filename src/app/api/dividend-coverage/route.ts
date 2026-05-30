import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { DividendCoverageSort } from "@/lib/dividend/types";
import { toMonthKey } from "@/lib/budget/utils";
import {
  getDividendCoverageForMonth,
  getDividendCoverageHistory,
} from "@/lib/services/dividend-coverage-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sortSchema = z.enum(["smallest", "dueDay"]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? toMonthKey(new Date());
    const sort = (searchParams.get("sort") ?? "smallest") as DividendCoverageSort;
    const history = searchParams.get("history") === "1";
    const fromMonth = searchParams.get("from") ?? undefined;
    const toMonth = searchParams.get("to") ?? undefined;

    sortSchema.parse(sort);
    z.string().regex(/^\d{4}-\d{2}$/).parse(month);

    const coverage = await getDividendCoverageForMonth(month, sort);
    const historyPoints = history ? await getDividendCoverageHistory(fromMonth, toMonth, sort) : undefined;

    return NextResponse.json({ coverage, history: historyPoints });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query parameters." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to compute dividend coverage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
