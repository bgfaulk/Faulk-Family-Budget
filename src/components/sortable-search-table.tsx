"use client";

import { useMemo, useState } from "react";

type SortDirection = "asc" | "desc";
type SortType = "string" | "number" | "month" | "date";

export type SortableColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  sortType?: SortType;
  sortKey?: string;
};

export type SortableRow = Record<string, string | number | null | undefined>;

function compareValues(a: unknown, b: unknown, sortType: SortType): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;

  if (sortType === "number") {
    const aNum = typeof a === "number" ? a : Number(a);
    const bNum = typeof b === "number" ? b : Number(b);
    return aNum - bNum;
  }

  if (sortType === "month") {
    return String(a).localeCompare(String(b));
  }

  if (sortType === "date") {
    const aTime = new Date(String(a)).getTime();
    const bTime = new Date(String(b)).getTime();
    return aTime - bTime;
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function SortableSearchTable({
  columns,
  rows,
  defaultSortKey,
  defaultSortDir = "asc",
  searchPlaceholder = "Search table...",
  emptyMessage = "No rows found.",
  searchKeys,
}: {
  columns: SortableColumn[];
  rows: SortableRow[];
  defaultSortKey?: string;
  defaultSortDir?: SortDirection;
  searchPlaceholder?: string;
  emptyMessage?: string;
  searchKeys?: string[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(defaultSortKey ?? columns[0]?.key ?? "");
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDir);

  const activeColumn = useMemo(
    () => columns.find((column) => column.key === sortKey) ?? columns[0],
    [columns, sortKey],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;

    const keys = searchKeys && searchKeys.length > 0 ? searchKeys : columns.map((column) => column.key);
    return rows.filter((row) =>
      keys.some((key) => String(row[key] ?? "").toLowerCase().includes(normalized)),
    );
  }, [columns, query, rows, searchKeys]);

  const sortedRows = useMemo(() => {
    if (!activeColumn) return filteredRows;
    const targetSortType = activeColumn.sortType ?? "string";
    const targetSortKey = activeColumn.sortKey ?? activeColumn.key;
    const copy = [...filteredRows].sort((a, b) =>
      compareValues(a[targetSortKey], b[targetSortKey], targetSortType),
    );
    return sortDir === "desc" ? copy.reverse() : copy;
  }, [activeColumn, filteredRows, sortDir]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
      />

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              {columns.map((column) => {
                const isActive = sortKey === column.key;
                const isSortable = column.sortable !== false;
                return (
                  <th key={column.key} className="pb-2 pr-3">
                    <button
                      type="button"
                      disabled={!isSortable}
                      onClick={() => {
                        if (!isSortable) return;
                        if (isActive) {
                          setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                        } else {
                          setSortKey(column.key);
                          setSortDir("asc");
                        }
                      }}
                      className={`inline-flex items-center gap-1 ${
                        isSortable ? "hover:text-slate-200" : "cursor-default"
                      }`}
                    >
                      <span>{column.label}</span>
                      {isActive ? <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr className="border-t border-slate-800">
                <td className="py-3 text-slate-400" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-t border-slate-800">
                  {columns.map((column) => (
                    <td key={column.key} className="py-2 pr-3">
                      {String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
