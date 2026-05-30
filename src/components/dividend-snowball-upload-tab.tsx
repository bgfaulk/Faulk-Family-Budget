"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { currency, formatMonthLabel } from "@/lib/budget/utils";

type Preview = {
  tickers: Array<{ ticker: string; amount: number }>;
  monthTotal: number;
  dividendEventCount: number;
};

export function DividendSnowballUploadTab({
  month,
  dbEnabled,
  onImported,
}: {
  month: string;
  dbEnabled: boolean;
  onImported?: () => void;
}) {
  const router = useRouter();
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runImport(previewOnly: boolean): Promise<void> {
    if (!dbEnabled) {
      setMessage("DATABASE_URL is required to import.");
      return;
    }
    const trimmed = csvText.trim();
    if (!trimmed) {
      setMessage("Paste Snowball CSV content or choose a file first.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/months/${month}/dividends/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText: trimmed, previewOnly }),
      });
      const body = (await response.json()) as {
        error?: string;
        preview?: Preview;
        imported?: number;
        monthTotal?: number;
        createdHoldings?: string[];
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Import failed.");
      }
      if (previewOnly && body.preview) {
        setPreview(body.preview);
        setMessage(
          body.preview.dividendEventCount === 0
            ? `No DIVIDEND rows found for ${formatMonthLabel(month)} in this file.`
            : `Found ${body.preview.tickers.length} tickers for ${formatMonthLabel(month)}.`,
        );
      } else {
        setPreview(body.preview ?? preview);
        setMessage(
          `Imported ${body.imported ?? 0} tickers (${currency(body.monthTotal ?? 0)})` +
            (body.createdHoldings?.length ? ` · new holdings: ${body.createdHoldings.join(", ")}` : ""),
        );
        router.refresh();
        onImported?.();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setPending(false);
    }
  }

  function onFileSelected(file: File | null): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsvText(text);
      setPreview(null);
      setMessage(`Loaded ${file.name}. Preview or import for ${formatMonthLabel(month)}.`);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-400">
        Snowball export CSV (Event, Date, Symbol, …). Only <strong className="text-slate-300">DIVIDEND</strong> rows for{" "}
        <strong className="text-slate-300">{formatMonthLabel(month)}</strong> are applied; amounts are summed per ticker.
      </p>
      <label className="block">
        <span className="text-xs text-slate-500">Upload file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={!dbEnabled || pending}
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-xs text-slate-300 file:mr-2 file:rounded-full file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:text-slate-100"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Or paste CSV</span>
        <textarea
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setPreview(null);
          }}
          rows={8}
          disabled={!dbEnabled || pending}
          placeholder="Event,Date,Symbol,Price,Quantity,..."
          className="mt-1 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[11px] text-slate-100 outline-none focus:border-emerald-400/50 disabled:opacity-50"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !dbEnabled}
          onClick={() => void runImport(true)}
          className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-50"
        >
          Preview month
        </button>
        <button
          type="button"
          disabled={pending || !dbEnabled}
          onClick={() => void runImport(false)}
          className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {pending ? "Working…" : "Import into database"}
        </button>
      </div>
      {preview && preview.tickers.length > 0 ? (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80 p-2">
          <p className="mb-2 text-[11px] text-slate-400">
            Preview total: <span className="text-emerald-300">{currency(preview.monthTotal)}</span> (
            {preview.dividendEventCount} dividend events)
          </p>
          <ul className="space-y-1 text-xs text-slate-300">
            {preview.tickers.map((t) => (
              <li key={t.ticker} className="flex justify-between gap-2">
                <span className="font-medium">{t.ticker}</span>
                <span className="tabular-nums text-emerald-300">{currency(t.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
