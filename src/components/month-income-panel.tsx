"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { currency } from "@/lib/budget/utils";

type IncomeItem = {
  id: string;
  label: string;
  amount: number;
};

export function MonthIncomePanel({
  month,
  incomePlanned,
  incomeItems,
}: {
  month: string;
  incomePlanned: number;
  incomeItems: IncomeItem[];
}) {
  const router = useRouter();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function removeIncomeItem(item: IncomeItem): Promise<void> {
    const approved = window.confirm(
      `Remove income item "${item.label}" (${currency(item.amount)}) from ${month}?`,
    );
    if (!approved) return;

    setPendingDeleteId(item.id);
    try {
      const response = await fetch(`/api/months/${month}/entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualId: item.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to delete income item.");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase text-slate-400">Income Planned</p>
      <p className="mt-2 text-xl font-semibold text-emerald-300">{currency(incomePlanned)}</p>
      {incomeItems.length > 0 ? (
        <div className="mt-2 space-y-1">
          {incomeItems.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded bg-slate-800/60 px-2 py-1">
              <p className="truncate text-[11px] text-slate-300">
                {item.label}: <span className="text-emerald-300">{currency(item.amount)}</span>
              </p>
              <button
                type="button"
                disabled={pendingDeleteId === item.id}
                onClick={() => void removeIncomeItem(item)}
                className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-slate-500">No income entries yet for this month.</p>
      )}
    </div>
  );
}
