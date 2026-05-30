"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { currency } from "@/lib/budget/utils";
import type { DividendCadence, DividendHoldingRecord } from "@/lib/dividend/types";

type EntryRow = {
  holdingId: string;
  ticker: string;
  dividendCadence: DividendCadence;
  amount: string;
};

const CADENCE_SECTIONS: Array<{
  cadence: DividendCadence;
  title: string;
  hint: string;
  defaultOpen: boolean;
}> = [
  {
    cadence: "weekly",
    title: "Weekly payers",
    hint: "Enter the total cash received this month (sum of weekly payments).",
    defaultOpen: false,
  },
  {
    cadence: "monthly",
    title: "Monthly payers",
    hint: "Usually one payment per month per ticker.",
    defaultOpen: false,
  },
  {
    cadence: "other",
    title: "Other / unset cadence",
    hint: "Assign weekly or monthly in data/dividend-cadence.json and run db:apply-dividend-cadences.",
    defaultOpen: false,
  },
];

function sectionSubtotal(rows: EntryRow[]): number {
  return rows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0);
}

function DividendEntrySection({
  title,
  hint,
  rows,
  defaultOpen,
  dbEnabled,
  saving,
  onAmountChange,
}: {
  title: string;
  hint: string;
  rows: EntryRow[];
  defaultOpen: boolean;
  dbEnabled: boolean;
  saving: boolean;
  onAmountChange: (holdingId: string, amount: string) => void;
}) {
  if (rows.length === 0) return null;

  const subtotal = sectionSubtotal(rows);

  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-800 bg-slate-950/80"
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-200">{title}</p>
            <p className="text-[11px] text-slate-500">{hint}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-300">{currency(subtotal)}</span>
            <span className="text-slate-500 transition group-open:rotate-180">▾</span>
          </div>
        </div>
      </summary>
      <div className="space-y-2 border-t border-slate-800 px-3 py-2">
        {rows.map((row) => (
          <label
            key={row.holdingId}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2"
          >
            <span className="text-sm font-medium text-slate-200">{row.ticker}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={row.amount}
              disabled={!dbEnabled || saving}
              onChange={(event) => onAmountChange(row.holdingId, event.target.value)}
              className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-sm text-slate-100"
              placeholder="0.00"
            />
          </label>
        ))}
      </div>
    </details>
  );
}

export function DividendMonthEntryForm({
  month,
  holdings,
  initialEntries,
  dbEnabled,
  scrollClassName = "max-h-72",
  onSaved,
}: {
  month: string;
  holdings: DividendHoldingRecord[];
  initialEntries: Array<{ holdingId: string; ticker: string; amount: number }>;
  dbEnabled: boolean;
  scrollClassName?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const entryMap = useMemo(
    () => new Map(initialEntries.map((e) => [e.holdingId, e.amount])),
    [initialEntries],
  );

  const [rows, setRows] = useState<EntryRow[]>(() =>
    holdings.map((h) => ({
      holdingId: h.id,
      ticker: h.ticker,
      dividendCadence: h.dividendCadence,
      amount: entryMap.has(h.id) ? String(entryMap.get(h.id)) : "",
    })),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rowsByCadence = useMemo(() => {
    const grouped: Record<DividendCadence, EntryRow[]> = {
      weekly: [],
      monthly: [],
      other: [],
    };
    for (const row of rows) {
      grouped[row.dividendCadence].push(row);
    }
    for (const cadence of Object.keys(grouped) as DividendCadence[]) {
      grouped[cadence].sort((a, b) => a.ticker.localeCompare(b.ticker));
    }
    return grouped;
  }, [rows]);

  const total = sectionSubtotal(rows);

  function updateAmount(holdingId: string, amount: string): void {
    setRows((prev) => prev.map((row) => (row.holdingId === holdingId ? { ...row, amount } : row)));
  }

  async function saveEntries(): Promise<void> {
    if (!dbEnabled) {
      setMessage("DATABASE_URL is required to save dividend entries.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/months/${month}/dividends`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: rows.map((row) => ({
            holdingId: row.holdingId,
            amount: Number.parseFloat(row.amount) || 0,
          })),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed.");
      }
      setMessage("Saved.");
      router.refresh();
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevious(): Promise<void> {
    if (!dbEnabled) {
      setMessage("DATABASE_URL is required to copy entries.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/months/${month}/dividends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copyPrevious" }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Copy failed.");
      }
      const body = (await response.json()) as { copiedFrom?: string | null };
      setMessage(body.copiedFrom ? `Copied from ${body.copiedFrom}.` : "No prior month to copy.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Copy failed.");
    } finally {
      setSaving(false);
    }
  }

  if (holdings.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No holdings yet. Run <code className="text-emerald-300">npm run db:seed-dividends-from-snowball</code> or add
        tickers via the API.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative min-h-0">
        <div
          className={`${scrollClassName} space-y-2 overflow-y-auto overscroll-y-contain rounded-lg border border-slate-800/80 bg-slate-950/60 p-2 pr-1`}
        >
          {CADENCE_SECTIONS.map((section) => (
            <DividendEntrySection
              key={section.cadence}
              title={section.title}
              hint={section.hint}
              rows={rowsByCadence[section.cadence]}
              defaultOpen={section.defaultOpen}
              dbEnabled={dbEnabled}
              saving={saving}
              onAmountChange={updateAmount}
            />
          ))}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-500">Scroll for more tickers</p>
      </div>
      <p className="shrink-0 text-xs text-slate-400">
        Month total: <span className="font-semibold text-emerald-300">{currency(total)}</span>
        <span className="text-slate-500">
          {" "}
          (weekly {currency(sectionSubtotal(rowsByCadence.weekly))} · monthly{" "}
          {currency(sectionSubtotal(rowsByCadence.monthly))})
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || !dbEnabled}
          onClick={() => void saveEntries()}
          className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save month"}
        </button>
        <button
          type="button"
          disabled={saving || !dbEnabled}
          onClick={() => void copyPrevious()}
          className="rounded-full border border-slate-600 bg-slate-800 px-4 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
        >
          Copy from previous month
        </button>
      </div>
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      {!dbEnabled ? (
        <p className="text-[11px] text-amber-200/90">
          Read-only mode: showing dividends from imported data in <code>data/</code>. Set DATABASE_URL to edit and
          persist.
        </p>
      ) : null}
    </div>
  );
}
