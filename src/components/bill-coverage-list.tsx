import { currency } from "@/lib/budget/utils";
import type { BillCoverageSlice } from "@/lib/dividend/types";

function statusStyles(status: BillCoverageSlice["status"]): string {
  if (status === "covered") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (status === "partial") return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  return "border-slate-700 bg-slate-950 text-slate-400";
}

function statusLabel(status: BillCoverageSlice["status"]): string {
  if (status === "covered") return "Covered";
  if (status === "partial") return "Partial";
  return "Not yet";
}

export function BillCoverageList({ slices }: { slices: BillCoverageSlice[] }) {
  if (slices.length === 0) {
    return <p className="text-sm text-slate-500">No active recurring expenses for this month.</p>;
  }

  return (
    <ul className="space-y-2">
      {slices.map((slice) => (
        <li
          key={slice.billTemplateId}
          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${statusStyles(slice.status)}`}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{slice.name}</p>
            <p className="text-[11px] opacity-80">
              {slice.dueDayOfMonth ? `Due day ${slice.dueDayOfMonth}` : "No due day"} · {statusLabel(slice.status)}
              {slice.status === "partial"
                ? ` · ${currency(slice.appliedAmount)} applied`
                : null}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold">{currency(slice.amount)}</p>
        </li>
      ))}
    </ul>
  );
}
