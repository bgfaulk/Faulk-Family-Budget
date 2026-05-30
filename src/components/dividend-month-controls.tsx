"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { DividendCoverageSort } from "@/lib/dividend/types";

export function DividendMonthControls({
  month,
  sort,
  monthOptions,
}: {
  month: string;
  sort: DividendCoverageSort;
  monthOptions: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (!params.get("tab")) {
      params.set("tab", "coverage");
    }
    router.push(`/dividends?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Month
        <select
          value={month}
          onChange={(e) => updateParam("month", e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-400">
        Bill order
        <select
          value={sort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="smallest">Smallest first (quick wins)</option>
          <option value="dueDay">Due day</option>
        </select>
      </label>
      <Link
        href={`/months/${month}`}
        className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-400/50"
      >
        Open monthly ledger
      </Link>
    </div>
  );
}
