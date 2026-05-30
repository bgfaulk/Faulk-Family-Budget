import { formatMonthLabel, currency } from "@/lib/budget/utils";
import type { DividendCoverageHistoryPoint } from "@/lib/dividend/types";

export function DividendHistoryPanel({ points }: { points: DividendCoverageHistoryPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No dividend history yet. Enter amounts for a month to see trends.</p>;
  }

  const maxFill = Math.max(...points.map((p) => p.fillPercent), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 overflow-x-auto pb-2">
        {points.map((point) => {
          const barHeight = Math.max(4, (point.fillPercent / maxFill) * 120);
          return (
            <div key={point.month} className="flex min-w-[52px] flex-col items-center gap-1">
              <div className="flex h-32 w-10 items-end justify-center rounded-t-lg border border-slate-700 bg-slate-950">
                <div
                  className="w-full rounded-t-md bg-emerald-500/80"
                  style={{ height: `${barHeight}px` }}
                  title={`${point.fillPercent.toFixed(1)}%`}
                />
              </div>
              <p className="text-[10px] text-slate-400">{formatMonthLabel(point.month).split(" ")[0]}</p>
              <p className="text-[10px] font-medium text-emerald-300">{point.fillPercent.toFixed(0)}%</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2 pr-3">Month</th>
              <th className="py-2 pr-3">Dividends</th>
              <th className="py-2 pr-3">Bills cup</th>
              <th className="py-2 pr-3">Fill</th>
              <th className="py-2">Bills covered</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((point) => (
              <tr key={point.month} className="border-b border-slate-800/60 text-slate-200">
                <td className="py-2 pr-3">{formatMonthLabel(point.month)}</td>
                <td className="py-2 pr-3 text-emerald-300">{currency(point.dividendTotal)}</td>
                <td className="py-2 pr-3 text-rose-300">{currency(point.billCupTotal)}</td>
                <td className="py-2 pr-3">{point.fillPercent.toFixed(1)}%</td>
                <td className="py-2">{point.fullyCoveredCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
