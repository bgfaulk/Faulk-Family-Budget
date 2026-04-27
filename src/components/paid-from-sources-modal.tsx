"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PaidFromSourcesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setError(null);
    }
  }, [open]);

  async function save(): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name (e.g. checking account or card).");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payment-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Save failed.");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <h4 className="text-base font-semibold">Add paid-from</h4>
        <p className="mt-1 text-xs text-slate-400">
          This label appears in the Paid from dropdown on recurring expenses (e.g. &quot;Robinhood Gold Card&quot;).
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Account or card name"
          disabled={pending}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:opacity-50"
        />
        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs hover:border-slate-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
