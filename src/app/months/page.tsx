import { redirect } from "next/navigation";

import { getBudgetTimeline } from "@/lib/services/budget-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function MonthsPage() {
  const timeline = await getBudgetTimeline(1);
  const fallbackMonth = timeline[0]?.month ?? "2026-04";
  redirect(`/months/${fallbackMonth}`);
}
