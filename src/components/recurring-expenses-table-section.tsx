"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { BillCadence, BillTemplateRecord, CashflowDirection } from "@/lib/budget/types";
import { formatMonthLabel } from "@/lib/budget/utils";

import { PaidFromSourcesModal } from "@/components/paid-from-sources-modal";

export type RecurringExpenseRow = {
  id: string;
  name: string;
  direction: CashflowDirection;
  category: string;
  defaultAmount: number;
  dueDayOfMonth: number | null;
  cadence: BillCadence;
  paymentAccount: string | null;
  websiteUrl: string | null;
  payoffMonth: string | null;
  effectiveEndMonth: string | null;
  isArchived: boolean;
  uiVisible: boolean;
};

type ViewMode = "active" | "archived" | "all";

const CADENCES: BillCadence[] = ["monthly", "biweekly", "quarterly", "annual", "one_off"];

function rowDisplayState(row: RecurringExpenseRow): "Active" | "Archived" {
  return row.isArchived || !row.uiVisible ? "Archived" : "Active";
}

function billToRow(b: BillTemplateRecord): RecurringExpenseRow {
  return {
    id: b.id,
    name: b.name,
    direction: b.direction,
    category: b.category,
    defaultAmount: b.defaultAmount,
    dueDayOfMonth: b.dueDayOfMonth,
    cadence: b.cadence,
    paymentAccount: b.paymentAccount,
    websiteUrl: b.websiteUrl,
    payoffMonth: b.payoffMonth,
    effectiveEndMonth: b.effectiveEndMonth,
    isArchived: b.isArchived,
    uiVisible: b.uiVisible,
  };
}

function parseMonthKey(raw: string): { ok: true; value: string | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  if (!/^\d{4}-\d{2}$/.test(t)) return { ok: false };
  const [, m] = t.split("-").map(Number);
  if (!Number.isInteger(m) || m < 1 || m > 12) return { ok: false };
  return { ok: true, value: t };
}

function parseDueDay(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 31) return { ok: false };
  return { ok: true, value: n };
}

const inputClass =
  "w-full min-w-[4rem] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-400/60 disabled:opacity-50";

export function RecurringExpensesTableSection({
  initialRows,
  initialPaymentSourceNames,
}: {
  initialRows: RecurringExpenseRow[];
  initialPaymentSourceNames: string[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [showPaidFromModal, setShowPaidFromModal] = useState(false);
  const [view, setView] = useState<ViewMode>("active");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("endMonth");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const paidFromOptions = useMemo(() => {
    const set = new Set(initialPaymentSourceNames);
    for (const r of rows) {
      const p = r.paymentAccount?.trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [initialPaymentSourceNames, rows]);

  async function patchBill(id: string, body: Record<string, unknown>): Promise<BillTemplateRecord | null> {
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch("/api/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await response.json()) as { bill?: BillTemplateRecord; error?: string };
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Update failed.");
        return null;
      }
      return data.bill ?? null;
    } catch {
      setError("Network error.");
      return null;
    } finally {
      setPendingId(null);
    }
  }

  function mergeBillIntoRows(bill: BillTemplateRecord): void {
    const next = billToRow(bill);
    setRows((current) => current.map((r) => (r.id === next.id ? next : r)));
  }

  async function persistTextField(
    row: RecurringExpenseRow,
    field: "name" | "category" | "websiteUrl",
    raw: string,
  ): Promise<void> {
    const trimmed = raw.trim();
    const prev =
      field === "name"
        ? row.name
        : field === "category"
          ? row.category
          : (row.websiteUrl ?? "").trim();
    if (trimmed === prev) return;
    if (field === "name" && !trimmed) {
      setError("Name cannot be empty.");
      return;
    }
    if (field === "category" && !trimmed) {
      setError("Category cannot be empty.");
      return;
    }
    const payload = field === "websiteUrl" ? { websiteUrl: trimmed || null } : { [field]: trimmed };
    const bill = await patchBill(row.id, payload);
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistPaymentAccount(row: RecurringExpenseRow, value: string): Promise<void> {
    const next = value.trim() || null;
    const prev = row.paymentAccount?.trim() || null;
    if (next === prev) return;
    const bill = await patchBill(row.id, { paymentAccount: next });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistDefaultAmount(row: RecurringExpenseRow, raw: string): Promise<void> {
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n) || n < 0) {
      setError("Default amount must be a number ≥ 0.");
      return;
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded === row.defaultAmount) return;
    const bill = await patchBill(row.id, { defaultAmount: rounded });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistDueDay(row: RecurringExpenseRow, raw: string): Promise<void> {
    const parsed = parseDueDay(raw);
    if (!parsed.ok) {
      setError("Due day must be blank or 1–31.");
      return;
    }
    const prev = row.dueDayOfMonth ?? null;
    if (parsed.value === prev) return;
    const bill = await patchBill(row.id, { dueDayOfMonth: parsed.value });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistMonthField(
    row: RecurringExpenseRow,
    field: "payoffMonth" | "effectiveEndMonth",
    raw: string,
  ): Promise<void> {
    const parsed = parseMonthKey(raw);
    if (!parsed.ok) {
      setError("Use YYYY-MM or leave blank.");
      return;
    }
    const prev = field === "payoffMonth" ? row.payoffMonth : row.effectiveEndMonth;
    if (parsed.value === prev) return;
    const bill =
      field === "payoffMonth"
        ? await patchBill(row.id, { payoffMonth: parsed.value })
        : await patchBill(row.id, { effectiveEndMonth: parsed.value });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistCadence(row: RecurringExpenseRow, cadence: BillCadence): Promise<void> {
    if (cadence === row.cadence) return;
    const bill = await patchBill(row.id, { cadence });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistDirection(row: RecurringExpenseRow, direction: CashflowDirection): Promise<void> {
    if (direction === row.direction) return;
    const bill = await patchBill(row.id, { direction });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  async function persistState(row: RecurringExpenseRow, next: "Active" | "Archived"): Promise<void> {
    const current = rowDisplayState(row);
    if (next === current) return;
    const active = next === "Active";
    const bill = await patchBill(row.id, { isArchived: !active, uiVisible: active });
    if (bill) mergeBillIntoRows(bill);
    router.refresh();
  }

  const filteredByView = useMemo(() => {
    if (view === "all") return rows;
    if (view === "active") return rows.filter((r) => rowDisplayState(r) === "Active");
    return rows.filter((r) => rowDisplayState(r) === "Archived");
  }, [rows, view]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return filteredByView;
    return filteredByView.filter((row) =>
      [row.name, row.category, row.direction, row.paymentAccount ?? "", row.websiteUrl ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [filteredByView, query]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      else if (sortKey === "direction") cmp = a.direction.localeCompare(b.direction);
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category, undefined, { sensitivity: "base" });
      else if (sortKey === "defaultAmount") cmp = a.defaultAmount - b.defaultAmount;
      else if (sortKey === "dueDay") cmp = (a.dueDayOfMonth ?? -1) - (b.dueDayOfMonth ?? -1);
      else if (sortKey === "cadence") cmp = a.cadence.localeCompare(b.cadence);
      else if (sortKey === "paymentAccount")
        cmp = (a.paymentAccount ?? "").localeCompare(b.paymentAccount ?? "", undefined, { sensitivity: "base" });
      else if (sortKey === "website") cmp = (a.websiteUrl ?? "").localeCompare(b.websiteUrl ?? "", undefined, { sensitivity: "base" });
      else if (sortKey === "payoffMonth") cmp = (a.payoffMonth ?? "").localeCompare(b.payoffMonth ?? "");
      else if (sortKey === "endMonth") cmp = (a.effectiveEndMonth ?? "").localeCompare(b.effectiveEndMonth ?? "");
      else if (sortKey === "state") cmp = rowDisplayState(a).localeCompare(rowDisplayState(b));
      return cmp * dir;
    });
    return copy;
  }, [filtered, sortDir, sortKey]);

  const emptyMessage =
    view === "active"
      ? "No active recurring expenses."
      : view === "archived"
        ? "No archived or hidden recurring expenses."
        : "No recurring expenses.";

  function toggleSort(key: string): void {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "endMonth" || key === "payoffMonth" ? "desc" : "asc");
    }
  }

  const sortable = (key: string, label: string) => (
    <th key={key} className="pb-2 pr-2">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 hover:text-slate-200"
      >
        <span>{label}</span>
        {sortKey === key ? <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );

  const tableBusy = pendingId !== null;

  return (
    <div>
      <PaidFromSourcesModal open={showPaidFromModal} onClose={() => setShowPaidFromModal(false)} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <h3 className="text-base font-semibold">Recurring expenses</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={tableBusy}
            onClick={() => setShowPaidFromModal(true)}
            className="rounded-full border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50"
          >
            Add paid-from…
          </button>
          <label className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="shrink-0">Show</span>
            <select
              value={view}
              disabled={tableBusy}
              onChange={(event) => setView(event.target.value as ViewMode)}
              className="min-w-[12rem] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60 disabled:opacity-50"
            >
              <option value="active">Active only</option>
              <option value="archived">Archived / hidden only</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      </div>

      <input
        type="search"
        value={query}
        disabled={tableBusy}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name, category, direction, account, website…"
        className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60 disabled:opacity-50"
      />

      {error ? <p className="mb-2 text-xs text-rose-300">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              {sortable("name", "Name")}
              {sortable("direction", "Direction")}
              {sortable("category", "Category")}
              {sortable("defaultAmount", "Default")}
              {sortable("dueDay", "Due")}
              {sortable("cadence", "Cadence")}
              {sortable("paymentAccount", "Paid from")}
              {sortable("website", "Website")}
              {sortable("payoffMonth", "Payoff")}
              {sortable("endMonth", "End month")}
              {sortable("state", "State")}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr className="border-t border-slate-800">
                <td className="py-3 text-slate-500" colSpan={11}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const disabled = tableBusy;
                return (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`n-${row.id}-${row.name}`}
                        type="text"
                        defaultValue={row.name}
                        disabled={disabled}
                        onBlur={(e) => void persistTextField(row, "name", e.target.value)}
                        className={`${inputClass} min-w-[7rem]`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <select
                        value={row.direction}
                        disabled={disabled}
                        onChange={(e) => void persistDirection(row, e.target.value as CashflowDirection)}
                        className={`${inputClass} max-w-[6.5rem]`}
                      >
                        <option value="expense">expense</option>
                        <option value="income">income</option>
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`c-${row.id}-${row.category}`}
                        type="text"
                        defaultValue={row.category}
                        disabled={disabled}
                        onBlur={(e) => void persistTextField(row, "category", e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`a-${row.id}-${row.defaultAmount}`}
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={row.defaultAmount}
                        disabled={disabled}
                        onBlur={(e) => void persistDefaultAmount(row, e.target.value)}
                        className={`${inputClass} max-w-[6rem]`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`d-${row.id}-${row.dueDayOfMonth ?? "x"}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="—"
                        defaultValue={row.dueDayOfMonth ?? ""}
                        disabled={disabled}
                        onBlur={(e) => void persistDueDay(row, e.target.value)}
                        className={`${inputClass} max-w-[3rem]`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <select
                        value={row.cadence}
                        disabled={disabled}
                        onChange={(e) => void persistCadence(row, e.target.value as BillCadence)}
                        className={`${inputClass} max-w-[7rem]`}
                      >
                        {CADENCES.map((c) => (
                          <option key={c} value={c}>
                            {c.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <select
                        key={`p-${row.id}-${row.paymentAccount ?? ""}`}
                        value={row.paymentAccount ?? ""}
                        disabled={disabled}
                        onChange={(e) => void persistPaymentAccount(row, e.target.value)}
                        className={`${inputClass} min-w-[8rem] max-w-[14rem]`}
                      >
                        <option value="">—</option>
                        {paidFromOptions.map((label) => (
                          <option key={label} value={label}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`w-${row.id}-${row.websiteUrl ?? ""}`}
                        type="text"
                        defaultValue={row.websiteUrl ?? ""}
                        disabled={disabled}
                        onBlur={(e) => void persistTextField(row, "websiteUrl", e.target.value)}
                        className={`${inputClass} min-w-[7rem]`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`po-${row.id}-${row.payoffMonth ?? ""}`}
                        type="text"
                        placeholder="YYYY-MM"
                        title={row.payoffMonth ? formatMonthLabel(row.payoffMonth) : undefined}
                        defaultValue={row.payoffMonth ?? ""}
                        disabled={disabled}
                        onBlur={(e) => void persistMonthField(row, "payoffMonth", e.target.value)}
                        className={`${inputClass} max-w-[6.5rem]`}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <input
                        key={`en-${row.id}-${row.effectiveEndMonth ?? ""}`}
                        type="text"
                        placeholder="YYYY-MM"
                        title={row.effectiveEndMonth ? formatMonthLabel(row.effectiveEndMonth) : undefined}
                        defaultValue={row.effectiveEndMonth ?? ""}
                        disabled={disabled}
                        onBlur={(e) => void persistMonthField(row, "effectiveEndMonth", e.target.value)}
                        className={`${inputClass} max-w-[6.5rem]`}
                      />
                    </td>
                    <td className="py-1.5 align-top">
                      <select
                        value={rowDisplayState(row)}
                        disabled={disabled}
                        onChange={(e) => void persistState(row, e.target.value as "Active" | "Archived")}
                        className={`${inputClass} max-w-[6.5rem]`}
                      >
                        <option value="Active">Active</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
