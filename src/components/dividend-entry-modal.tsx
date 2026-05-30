"use client";

import { useEffect, useState } from "react";

import { DividendMonthEntryForm } from "@/components/dividend-month-entry-form";
import { DividendSnowballUploadTab } from "@/components/dividend-snowball-upload-tab";
import { formatMonthLabel } from "@/lib/budget/utils";
import type { DividendHoldingRecord } from "@/lib/dividend/types";

type TabId = "upload" | "manual";

export function DividendEntryModal({
  open,
  onClose,
  month,
  holdings,
  initialEntries,
  dbEnabled,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  holdings: DividendHoldingRecord[];
  initialEntries: Array<{ holdingId: string; ticker: string; amount: number }>;
  dbEnabled: boolean;
}) {
  const [tab, setTab] = useState<TabId>("upload");

  useEffect(() => {
    if (open) setTab("upload");
  }, [open, month]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dividend-entry-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-800 px-4 py-3">
          <h4 id="dividend-entry-modal-title" className="text-base font-semibold">
            Dividends — {formatMonthLabel(month)}
          </h4>
          <p className="mt-1 text-xs text-slate-400">Import Snowball CSV or enter amounts manually.</p>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-slate-800 px-4 pt-2">
          {(
            [
              { id: "upload" as const, label: "Snowball upload" },
              { id: "manual" as const, label: "Manual entry" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-t-lg px-3 py-2 text-xs font-medium transition ${
                tab === item.id
                  ? "border border-b-0 border-slate-700 bg-slate-950 text-emerald-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "upload" ? (
            <DividendSnowballUploadTab month={month} dbEnabled={dbEnabled} onImported={onClose} />
          ) : (
            <DividendMonthEntryForm
              key={month}
              month={month}
              holdings={holdings}
              initialEntries={initialEntries}
              dbEnabled={dbEnabled}
              scrollClassName="max-h-[50vh]"
              onSaved={onClose}
            />
          )}
        </div>

        <div className="shrink-0 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
