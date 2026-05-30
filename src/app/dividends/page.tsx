import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";
import { DividendsPageClient } from "@/components/dividends-page-client";
import type { DividendCoverageSort } from "@/lib/dividend/types";
import { addMonths, toMonthKey } from "@/lib/budget/utils";
import {
  getDividendCoverageForMonth,
  getDividendCoverageHistory,
} from "@/lib/services/dividend-coverage-service";
import { listDividendHoldings } from "@/lib/services/dividend-data-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<{ month?: string; sort?: string; tab?: string }>;
};

function parseSort(raw: string | undefined): DividendCoverageSort {
  return raw === "dueDay" ? "dueDay" : "smallest";
}

function buildMonthOptions(current: string, historyMonths: string[]): string[] {
  const set = new Set(historyMonths);
  set.add(current);
  set.add(toMonthKey(new Date()));
  for (let i = -2; i <= 2; i += 1) {
    set.add(addMonths(current, i));
  }
  return [...set].sort().reverse();
}

export default async function DividendsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const month = params.month ?? toMonthKey(new Date());
  const sort = parseSort(params.sort);
  const dbEnabled = Boolean(process.env.DATABASE_URL);

  const [coverage, history, holdings] = await Promise.all([
    getDividendCoverageForMonth(month, sort),
    getDividendCoverageHistory(),
    listDividendHoldings(),
  ]);

  const monthOptions = buildMonthOptions(
    month,
    history.map((p) => p.month),
  );

  return (
    <AppShell>
      <Suspense fallback={<div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-sm text-slate-400">Loading…</div>}>
        <DividendsPageClient
          month={month}
          sort={sort}
          monthOptions={monthOptions}
          coverage={coverage}
          history={history}
          holdings={holdings}
          dbEnabled={dbEnabled}
        />
      </Suspense>
    </AppShell>
  );
}
