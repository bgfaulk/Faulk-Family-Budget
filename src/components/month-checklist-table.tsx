"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { MonthEntryView } from "@/lib/services/budget-service";

type SortDirection = "asc" | "desc";

function parseNonNegativeAmount(raw: string): number | null {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseDueDayInput(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = String(raw).trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 31) return { ok: false };
  return { ok: true, value: n };
}

type ConfirmDeleteState = {
  row: MonthEntryView;
  warning: string;
} | null;

function compareBy<T>(a: T, b: T, getter: (value: T) => string | number): number {
  const av = getter(a);
  const bv = getter(b);
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
}

export function MonthChecklistTable({ month, entries }: { month: string; entries: MonthEntryView[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(entries);
  const [tableError, setTableError] = useState<string | null>(null);

  useEffect(() => {
    setRows(entries);
  }, [entries]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"due" | "name" | "planned" | "status">("due");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [pending, setPending] = useState<string | null>(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState>(null);
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeNote, setIncomeNote] = useState("");
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillDueDay, setNewBillDueDay] = useState("");
  const [newBillAccount, setNewBillAccount] = useState("");
  const [newBillPaidNow, setNewBillPaidNow] = useState(true);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((row) =>
          [row.name, row.category, row.direction, row.status].some((value) =>
            value.toLowerCase().includes(q),
          ),
        )
      : rows;

    const sorted = [...filtered];
    if (sortKey === "due") sorted.sort((a, b) => compareBy(a, b, (v) => v.dueDayOfMonth ?? -1));
    if (sortKey === "name") sorted.sort((a, b) => compareBy(a, b, (v) => v.name));
    if (sortKey === "planned") sorted.sort((a, b) => compareBy(a, b, (v) => v.plannedAmount));
    if (sortKey === "status") sorted.sort((a, b) => compareBy(a, b, (v) => v.status));
    const ordered = sortDir === "desc" ? sorted.reverse() : sorted;

    const notPaid = ordered.filter((r) => r.status !== "paid");
    const paidRows = ordered.filter((r) => r.status === "paid");
    return [...notPaid, ...paidRows];
  }, [rows, search, sortKey, sortDir]);

  const inputCellClass =
    "w-full min-w-[4.5rem] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none focus:border-emerald-400/60 disabled:opacity-50";

  async function postMonthEntries(
    payload: Record<string, unknown>,
  ): Promise<{ ok: false } | { ok: true; actual?: { id: string } }> {
    setTableError(null);
    try {
      const response = await fetch(`/api/months/${month}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok?: boolean; actual?: { id: string }; error?: string };
      if (!response.ok) {
        setTableError(typeof data.error === "string" ? data.error : "Update failed.");
        return { ok: false };
      }
      return { ok: true, actual: data.actual };
    } catch {
      setTableError("Network error.");
      return { ok: false };
    }
  }

  function paidDateForStatus(status: MonthEntryView["status"]): string | null {
    return status === "paid" ? new Date().toISOString().slice(0, 10) : null;
  }

  function actualAmountWhenMarkingPaid(row: MonthEntryView): number {
    if (row.actualAmount > 0) return row.actualAmount;
    if (row.plannedAmount > 0) return row.plannedAmount;
    return 0;
  }

  async function persistPlanned(row: MonthEntryView, raw: string): Promise<void> {
    if (!row.linkedTemplateId) return;
    const amount = parseNonNegativeAmount(raw);
    if (amount === null) {
      setTableError("Planned amount must be a valid number ≥ 0.");
      return;
    }
    if (amount === row.plannedAmount) return;
    setPending(row.billTemplateId);
    try {
      const result = await postMonthEntries({
        plan: {
          billTemplateId: row.linkedTemplateId,
          plannedAmount: amount,
          source: "manual",
        },
      });
      if (!result.ok) return;
      setRows((current) =>
        current.map((item) =>
          item.billTemplateId === row.billTemplateId ? { ...item, plannedAmount: amount } : item,
        ),
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function persistActualFields(
    row: MonthEntryView,
    rawAmount: string,
    status: MonthEntryView["status"],
  ): Promise<void> {
    const amount = parseNonNegativeAmount(rawAmount);
    if (amount === null) {
      setTableError("Actual amount must be a valid number ≥ 0.");
      return;
    }
    const statusChanged = status !== row.status;
    const amountChanged = amount !== row.actualAmount;
    if (!statusChanged && !amountChanged) return;

    setPending(row.billTemplateId);
    try {
      const body: Record<string, unknown> = {
        actualId: row.actualEntryId ?? undefined,
        billTemplateId: row.linkedTemplateId,
        direction: row.direction,
        actualAmount: amount,
        paidDate: paidDateForStatus(status),
        status,
      };
      if (!row.linkedTemplateId) {
        body.memo = (row.memo ?? row.name).trim() || "Manual expense entry";
      }
      const result = await postMonthEntries({ actual: body });
      if (!result.ok) return;
      setRows((current) =>
        current.map((item) => {
          if (item.billTemplateId !== row.billTemplateId) return item;
          const next: MonthEntryView = { ...item, actualAmount: amount, status };
          if (result.actual?.id) next.actualEntryId = result.actual.id;
          return next;
        }),
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function persistStatus(row: MonthEntryView, status: MonthEntryView["status"]): Promise<void> {
    if (status === row.status) return;
    let amount = row.actualAmount;
    if (status === "paid" && amount === 0 && row.plannedAmount > 0 && row.linkedTemplateId) {
      amount = row.plannedAmount;
    }
    setPending(row.billTemplateId);
    try {
      const body: Record<string, unknown> = {
        actualId: row.actualEntryId ?? undefined,
        billTemplateId: row.linkedTemplateId,
        direction: row.direction,
        actualAmount: amount,
        paidDate: paidDateForStatus(status),
        status,
      };
      if (!row.linkedTemplateId) {
        body.memo = (row.memo ?? row.name).trim() || "Manual expense entry";
      }
      const result = await postMonthEntries({ actual: body });
      if (!result.ok) return;
      setRows((current) =>
        current.map((item) => {
          if (item.billTemplateId !== row.billTemplateId) return item;
          const next: MonthEntryView = { ...item, status, actualAmount: amount };
          if (result.actual?.id) next.actualEntryId = result.actual.id;
          return next;
        }),
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function persistBillField(
    row: MonthEntryView,
    field: { name?: string; category?: string; dueDayOfMonth?: number | null },
  ): Promise<void> {
    if (!row.linkedTemplateId) return;
    if (field.name !== undefined && !field.name.trim()) {
      setTableError("Name cannot be empty.");
      return;
    }
    setPending(row.billTemplateId);
    setTableError(null);
    try {
      const patch: Record<string, string | number | null> = { id: row.linkedTemplateId };
      if (field.name !== undefined) patch.name = field.name.trim();
      if (field.category !== undefined) patch.category = field.category.trim();
      if (field.dueDayOfMonth !== undefined) patch.dueDayOfMonth = field.dueDayOfMonth;

      const response = await fetch("/api/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        setTableError("Could not update recurring expense.");
        return;
      }
      setRows((current) =>
        current.map((item) => {
          if (item.billTemplateId !== row.billTemplateId) return item;
          const next = { ...item };
          if (field.name !== undefined) next.name = field.name.trim();
          if (field.category !== undefined) next.category = field.category.trim() || item.category;
          if (field.dueDayOfMonth !== undefined) next.dueDayOfMonth = field.dueDayOfMonth;
          return next;
        }),
      );
      router.refresh();
    } catch {
      setTableError("Network error.");
    } finally {
      setPending(null);
    }
  }

  async function persistManualLabel(row: MonthEntryView, raw: string): Promise<void> {
    if (row.linkedTemplateId || !row.actualEntryId) return;
    const label = raw.trim();
    if (!label) {
      setTableError("Name cannot be empty.");
      return;
    }
    if (label === row.name.trim()) return;
    setPending(row.billTemplateId);
    try {
      const result = await postMonthEntries({
        actual: {
          actualId: row.actualEntryId,
          billTemplateId: null,
          direction: row.direction,
          actualAmount: row.actualAmount,
          paidDate: paidDateForStatus(row.status),
          status: row.status,
          memo: label,
        },
      });
      if (!result.ok) return;
      setRows((current) =>
        current.map((item) =>
          item.billTemplateId === row.billTemplateId ? { ...item, name: label, memo: label } : item,
        ),
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function setRowPaidState(row: MonthEntryView, nextPaid: boolean): Promise<void> {
    setPending(row.billTemplateId);
    setTableError(null);
    try {
      const nextAmount = nextPaid ? actualAmountWhenMarkingPaid(row) : 0;
      const result = await postMonthEntries({
        actual: {
          actualId: row.actualEntryId ?? undefined,
          billTemplateId: row.linkedTemplateId ?? null,
          direction: row.direction,
          actualAmount: nextAmount,
          paidDate: nextPaid ? new Date().toISOString().slice(0, 10) : null,
          status: nextPaid ? "paid" : "planned",
        },
      });
      if (!result.ok) return;

      setRows((current) =>
        current.map((item) => {
          if (item.billTemplateId !== row.billTemplateId) return item;
          const next: MonthEntryView = {
            ...item,
            status: nextPaid ? "paid" : "planned",
            actualAmount: nextAmount,
          };
          if (result.actual?.id) next.actualEntryId = result.actual.id;
          return next;
        }),
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function togglePaid(row: MonthEntryView): Promise<void> {
    await setRowPaidState(row, row.status !== "paid");
  }

  async function undoPaid(row: MonthEntryView): Promise<void> {
    if (row.status !== "paid") return;
    await setRowPaidState(row, false);
  }

  async function persistIncome(): Promise<boolean> {
    const amount = Number(incomeAmount);
    if (!Number.isFinite(amount) || amount <= 0) return false;

    setPending("income");
    try {
      const response = await fetch(`/api/months/${month}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual: {
            billTemplateId: null,
            direction: "income",
            actualAmount: amount,
            paidDate: new Date().toISOString().slice(0, 10),
            status: "paid",
            memo: incomeNote.trim() || "Monthly income entry",
          },
        }),
      });
      if (!response.ok) throw new Error("Failed to save monthly income");
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function submitIncome(options: { keepOpen: boolean }): Promise<void> {
    const success = await persistIncome();
    if (!success) return;

    setIncomeAmount("");
    setIncomeNote("");

    if (options.keepOpen) return;
    setShowIncomeModal(false);
    router.refresh();
  }

  async function persistNewBill(): Promise<boolean> {
    const amount = Number(newBillAmount);
    const dueDay = Number(newBillDueDay);
    if (!newBillName.trim() || !Number.isFinite(amount) || amount <= 0) return false;
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return false;

    setPending("new-bill");
    try {
      const billResponse = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBillName.trim(),
          counterpartyName: newBillName.trim(),
          direction: "expense",
          category: "household",
          defaultAmount: amount,
          dueDayOfMonth: dueDay,
          cadence: "monthly",
          effectiveStartMonth: month,
          paymentAccount: newBillAccount.trim() || null,
        }),
      });

      if (!billResponse.ok) throw new Error("Failed to create recurring expense");
      const billData = await billResponse.json();
      const billId = billData?.bill?.id as string | undefined;
      if (!billId) throw new Error("Recurring expense id missing from API response");

      const monthResponse = await fetch(`/api/months/${month}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: {
            billTemplateId: billId,
            plannedAmount: amount,
            source: "manual",
          },
          actual: newBillPaidNow
            ? {
                billTemplateId: billId,
                actualAmount: amount,
                paidDate: new Date().toISOString().slice(0, 10),
                status: "paid",
                memo: "Paid when monthly bill was created",
              }
            : undefined,
        }),
      });
      if (!monthResponse.ok) throw new Error("Failed to add new bill to this month");

      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function submitNewBill(options: { keepOpen: boolean }): Promise<void> {
    const success = await persistNewBill();
    if (!success) return;

    setNewBillName("");
    setNewBillAmount("");
    setNewBillDueDay("");
    setNewBillAccount("");
    setNewBillPaidNow(true);

    if (options.keepOpen) return;
    setShowNewBillModal(false);
    router.refresh();
  }

  function openDeleteConfirm(row: MonthEntryView): void {
    const warning = row.linkedTemplateId
      ? "This removes the item from this month only (planned + actual for this month). The recurring expense definition will remain."
      : "This permanently deletes this manual entry from this month.";
    setConfirmDelete({ row, warning });
  }

  async function confirmDeleteEntry(): Promise<void> {
    if (!confirmDelete) return;
    const { row } = confirmDelete;
    setPending(row.billTemplateId);
    try {
      const response = await fetch(`/api/months/${month}/entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualId: row.actualEntryId ?? null,
          billTemplateId: row.linkedTemplateId ?? null,
        }),
      });
      if (!response.ok) throw new Error("Failed to delete monthly entry");

      setRows((current) => current.filter((item) => item.billTemplateId !== row.billTemplateId));
      setConfirmDelete(null);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => setShowIncomeModal(true)}
          className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400/40 disabled:opacity-60"
        >
          Add Monthly Income
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => setShowNewBillModal(true)}
          className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400/40 disabled:opacity-60"
        >
          Add New Monthly Bill
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search monthly checklist..."
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60 sm:max-w-sm"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            ["due", "Due"],
            ["name", "Name"],
            ["planned", "Planned"],
            ["status", "Status"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                const k = key as "due" | "name" | "planned" | "status";
                if (k === sortKey) {
                  setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                } else {
                  setSortKey(k);
                  setSortDir("desc");
                }
              }}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 hover:border-emerald-400/40"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tableError ? <p className="text-xs text-rose-300">{tableError}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="pb-2 pr-3">Paid</th>
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3">Category</th>
              <th className="pb-2 pr-3">Due</th>
              <th className="pb-2 pr-3">Planned</th>
              <th className="pb-2 pr-3">Actual</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Undo / delete</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const firstPaidIndex = filteredSorted.findIndex((r) => r.status === "paid");
              return filteredSorted.map((row, index) => {
              const checked = row.status === "paid";
              const isFirstPaidBand =
                checked && firstPaidIndex >= 0 && index === firstPaidIndex && firstPaidIndex > 0;
              return (
                <tr
                  key={row.billTemplateId}
                  className={`border-t border-slate-800 transition-colors ${
                    isFirstPaidBand ? "border-t-2 border-slate-600" : ""
                  } ${
                    checked
                      ? "bg-slate-950/40 text-slate-500 [&>td:not(:first-child):not(:last-child)]:line-through [&_input:not([type=checkbox])]:line-through [&_select]:line-through"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending !== null}
                      onChange={() => void togglePaid(row)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                    />
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      key={`n-${row.billTemplateId}-${row.name}`}
                      type="text"
                      defaultValue={row.name}
                      disabled={pending !== null}
                      onBlur={(e) =>
                        row.linkedTemplateId
                          ? void persistBillField(row, { name: e.target.value })
                          : void persistManualLabel(row, e.target.value)
                      }
                      className={`${inputCellClass} min-w-[8rem]`}
                    />
                  </td>
                  <td className="py-2 pr-3 capitalize text-slate-300">{row.direction}</td>
                  <td className="py-2 pr-3 align-top">
                    {row.linkedTemplateId ? (
                      <input
                        key={`c-${row.billTemplateId}-${row.category}`}
                        type="text"
                        defaultValue={row.category}
                        disabled={pending !== null}
                        onBlur={(e) => void persistBillField(row, { category: e.target.value })}
                        className={inputCellClass}
                      />
                    ) : (
                      <span className="text-slate-500">manual</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    {row.linkedTemplateId ? (
                      <input
                        key={`d-${row.billTemplateId}-${row.dueDayOfMonth ?? "x"}`}
                        type="text"
                        inputMode="numeric"
                        placeholder="—"
                        defaultValue={row.dueDayOfMonth ?? ""}
                        disabled={pending !== null}
                        onBlur={(e) => {
                          const parsed = parseDueDayInput(e.target.value);
                          if (!parsed.ok) {
                            setTableError("Due day must be blank or 1–31.");
                            return;
                          }
                          const prev = row.dueDayOfMonth ?? null;
                          if (parsed.value === prev) return;
                          void persistBillField(row, { dueDayOfMonth: parsed.value });
                        }}
                        className={`${inputCellClass} max-w-[3.5rem]`}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    {row.linkedTemplateId ? (
                      <input
                        key={`p-${row.billTemplateId}-${row.plannedAmount}`}
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={row.plannedAmount}
                        disabled={pending !== null}
                        onBlur={(e) => void persistPlanned(row, e.target.value)}
                        className={`${inputCellClass} max-w-[6.5rem]`}
                      />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <input
                      key={`a-${row.billTemplateId}-${row.actualAmount}-${row.status}`}
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={row.actualAmount}
                      disabled={pending !== null}
                      onBlur={(e) => void persistActualFields(row, e.target.value, row.status)}
                      className={`${inputCellClass} max-w-[6.5rem]`}
                    />
                  </td>
                  <td className="py-2 align-top">
                    <select
                      value={row.status}
                      disabled={pending !== null}
                      onChange={(e) => {
                        const status = e.target.value as MonthEntryView["status"];
                        void persistStatus(row, status);
                      }}
                      className={`${inputCellClass} max-w-[7.5rem] cursor-pointer`}
                    >
                      {(["planned", "paid", "partial", "skipped"] as const).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 align-top">
                    {checked ? (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => void undoPaid(row)}
                        className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-200 hover:border-emerald-400/50 hover:text-emerald-100 disabled:opacity-50"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => openDeleteConfirm(row)}
                        className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>

      {showIncomeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h4 className="text-base font-semibold">Add Monthly Income</h4>
            <p className="mt-1 text-xs text-slate-400">
              Save one or more income entries for this month.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={incomeAmount}
                onChange={(event) => setIncomeAmount(event.target.value)}
                placeholder="Amount"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60"
              />
              <input
                type="text"
                value={incomeNote}
                onChange={(event) => setIncomeNote(event.target.value)}
                placeholder="Note (optional)"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60 sm:col-span-2"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void submitIncome({ keepOpen: false })}
                className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void submitIncome({ keepOpen: true })}
                className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400/40 disabled:opacity-60"
              >
                Save & add another
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setShowIncomeModal(false)}
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs hover:border-slate-400 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showNewBillModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h4 className="text-base font-semibold">Add New Monthly Bill</h4>
            <p className="mt-1 text-xs text-slate-400">
              Create the recurring expense and add it to this month.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                type="text"
                value={newBillName}
                onChange={(event) => setNewBillName(event.target.value)}
                placeholder="Bill name"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60 sm:col-span-2"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={newBillAmount}
                onChange={(event) => setNewBillAmount(event.target.value)}
                placeholder="Amount"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60"
              />
              <input
                type="number"
                min="1"
                max="31"
                value={newBillDueDay}
                onChange={(event) => setNewBillDueDay(event.target.value)}
                placeholder="Due day"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60"
              />
              <input
                type="text"
                value={newBillAccount}
                onChange={(event) => setNewBillAccount(event.target.value)}
                placeholder="Payment account (optional)"
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-400/60 sm:col-span-3"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={newBillPaidNow}
                  onChange={(event) => setNewBillPaidNow(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-400"
                />
                Mark paid now
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void submitNewBill({ keepOpen: false })}
                className="rounded-full border border-emerald-500/50 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void submitNewBill({ keepOpen: true })}
                className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs hover:border-emerald-400/40 disabled:opacity-60"
              >
                Save & add another
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setShowNewBillModal(false)}
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs hover:border-slate-400 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h4 className="text-base font-semibold text-rose-200">Confirm Delete</h4>
            <p className="mt-2 text-sm text-slate-200">
              You are about to delete <span className="font-medium">{confirmDelete.row.name}</span> from{" "}
              {month}. This action updates your monthly tracking data.
            </p>
            <p className="mt-2 text-xs text-rose-200/90">{confirmDelete.warning}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => void confirmDeleteEntry()}
                className="rounded-full border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-500/30 disabled:opacity-60"
              >
                Yes, delete
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setConfirmDelete(null)}
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs hover:border-slate-400 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
