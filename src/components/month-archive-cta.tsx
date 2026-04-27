"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  month: string;
  monthLabel: string;
  nextMonth: string;
  nextMonthLabel: string;
  dbEnabled: boolean;
};

export function MonthArchiveCta({
  month,
  monthLabel,
  nextMonth,
  nextMonthLabel,
  dbEnabled,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dbEnabled) {
    return (
      <p className="text-[11px] text-slate-500">
        Connect a database (<code className="text-slate-400">DATABASE_URL</code>) to archive months and roll
        income forward.
      </p>
    );
  }

  async function onArchive(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/months/${month}/rollover`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; nextMonth?: string; error?: string };
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Archive failed.");
        return;
      }
      const target = data.nextMonth ?? nextMonth;
      router.push(`/months/${target}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
      <p className="text-sm font-medium text-emerald-100">This month is complete</p>
      <p className="mt-1 text-xs text-slate-400">
        Every bill for {monthLabel} is marked paid. Archive moves you to <strong>{nextMonthLabel}</strong> with the
        same recurring bills (fresh checkboxes). If {nextMonthLabel} has no income lines yet, your current income
        entries are copied over so you can adjust for raises there.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onArchive()}
        className="mt-3 rounded-full border border-emerald-500/50 bg-emerald-500/25 px-4 py-2 text-xs font-medium text-emerald-50 hover:bg-emerald-500/35 disabled:opacity-50"
      >
        {busy ? "Working…" : `Archive ${monthLabel} & open ${nextMonthLabel}`}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
