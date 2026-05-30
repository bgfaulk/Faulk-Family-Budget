import { currency } from "@/lib/budget/utils";
import type { BillCoverageSlice, DividendCoverageResult } from "@/lib/dividend/types";

type BillLine = {
  billTemplateId: string;
  name: string;
  amount: number;
  cumulative: number;
  cumulativePercent: number;
  status: BillCoverageSlice["status"];
};

function buildBillLines(slices: BillCoverageSlice[], billCupTotal: number): BillLine[] {
  let cumulative = 0;
  return slices.map((slice) => {
    cumulative += slice.amount;
    return {
      billTemplateId: slice.billTemplateId,
      name: slice.name,
      amount: slice.amount,
      cumulative,
      cumulativePercent: billCupTotal > 0 ? (cumulative / billCupTotal) * 100 : 0,
      status: slice.status,
    };
  });
}

function lineColor(status: BillCoverageSlice["status"]): string {
  if (status === "covered") return "border-emerald-400/90";
  if (status === "partial") return "border-amber-400/90";
  return "border-slate-500/70";
}

export function DividendCup({ coverage }: { coverage: DividendCoverageResult }) {
  const fillHeight = Math.min(100, Math.max(0, coverage.fillPercent));
  const billLines = buildBillLines(coverage.slices, coverage.billCupTotal);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-center">
      <div className="flex flex-1 flex-col items-center gap-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Bill cup — lines mark each recurring bill</p>
        <div className="relative flex h-80 w-36 flex-col justify-end overflow-hidden rounded-3xl border-2 border-slate-600 bg-slate-950 shadow-inner">
          {billLines.map((line) => (
            <div
              key={line.billTemplateId}
              className={`pointer-events-none absolute left-0 right-0 z-10 border-t-2 ${lineColor(line.status)}`}
              style={{ bottom: `${line.cumulativePercent}%` }}
              title={`${line.name} — ${currency(line.amount)}`}
            />
          ))}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-emerald-600 to-emerald-400/95 transition-all duration-500"
            style={{ height: `${fillHeight}%` }}
          />
          <p className="absolute inset-x-0 bottom-2 z-30 text-center text-[10px] font-semibold text-white drop-shadow">
            {coverage.fillPercent.toFixed(1)}%
          </p>
        </div>
        <p className="text-center text-[10px] text-slate-500">
          Green fill = dividends · Lines = bill thresholds (bottom = smallest first)
        </p>
      </div>

      <div className="flex max-h-80 min-w-0 flex-1 flex-col lg:max-w-md">
        <p className="shrink-0 text-xs uppercase tracking-wide text-slate-400">Bills on the cup</p>
        <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-y-contain pr-1">
          {billLines.length === 0 ? (
            <li className="text-sm text-slate-500">No active recurring expenses for this month.</li>
          ) : (
            [...billLines].reverse().map((line) => (
              <li
                key={line.billTemplateId}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                  line.status === "covered"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    : line.status === "partial"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      : "border-slate-700 bg-slate-950/80 text-slate-400"
                }`}
              >
                <span className="truncate font-medium">{line.name}</span>
                <span className="shrink-0 tabular-nums">{currency(line.amount)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex max-w-sm flex-col justify-center text-center lg:text-left">
        <p className="text-xs uppercase tracking-wide text-slate-400">Dividends vs monthly bills</p>
        <p className="mt-2 text-2xl font-semibold text-emerald-300">
          {currency(coverage.dividendTotal)}{" "}
          <span className="text-base font-normal text-slate-400">of {currency(coverage.billCupTotal)}</span>
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {coverage.fullyCoveredCount} of {coverage.slices.length} bills fully covered
        </p>
        {coverage.nextBill ? (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Next: <strong>{coverage.nextBill.name}</strong> — need{" "}
            <strong>{currency(coverage.nextBill.remainingNeeded)}</strong> more
          </p>
        ) : coverage.slices.length > 0 && coverage.dividendTotal >= coverage.billCupTotal ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            Dividends cover all tracked monthly bills.
          </p>
        ) : null}
      </div>
    </div>
  );
}
