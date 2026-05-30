"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DividendCup } from "@/components/dividend-cup";
import { DividendEntryModal } from "@/components/dividend-entry-modal";
import { DividendHistoryPanel } from "@/components/dividend-history-panel";
import { DividendMonthControls } from "@/components/dividend-month-controls";
import { formatMonthLabel } from "@/lib/budget/utils";
import type {
  DividendCoverageHistoryPoint,
  DividendCoverageResult,
  DividendCoverageSort,
  DividendHoldingRecord,
} from "@/lib/dividend/types";

type TabId = "coverage" | "history";

const TABS: Array<{ id: TabId; label: string; description: string }> = [
  {
    id: "coverage",
    label: "Dividend coverage",
    description: "Cup vs monthly bills for the selected month.",
  },
  {
    id: "history",
    label: "History",
    description: "How dividend fill has changed over time.",
  },
];

export function DividendsPageClient({
  month,
  sort,
  monthOptions,
  coverage,
  history,
  holdings,
  dbEnabled,
}: {
  month: string;
  sort: DividendCoverageSort;
  monthOptions: string[];
  coverage: DividendCoverageResult;
  history: DividendCoverageHistoryPoint[];
  holdings: DividendHoldingRecord[];
  dbEnabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);

  const tabParam = searchParams.get("tab");
  const activeTab: TabId = tabParam === "history" ? "history" : "coverage";

  function setTab(next: TabId): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/dividends?${params.toString()}`);
  }

  const activeMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Dividends</h2>
            <p className="mt-1 text-xs text-slate-400">
              Track dividend cash against <strong className="text-slate-300">planned recurring expenses</strong> for{" "}
              {formatMonthLabel(month)}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
            >
              Add / update dividends
            </button>
            <DividendMonthControls month={month} sort={sort} monthOptions={monthOptions} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 border-b border-slate-800">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === item.id
                  ? "border border-b-0 border-slate-700 bg-slate-950 text-emerald-300"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">{activeMeta.description}</p>

        <div className="mt-4">
          {activeTab === "coverage" ? (
            <DividendCup coverage={coverage} />
          ) : (
            <DividendHistoryPanel points={history} />
          )}
        </div>
      </section>

      <DividendEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        month={month}
        holdings={holdings}
        initialEntries={coverage.entries}
        dbEnabled={dbEnabled}
      />
    </>
  );
}
