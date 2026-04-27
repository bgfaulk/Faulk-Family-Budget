export function parseNumeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const cleaned = value.replace(/\$/g, "").replace(/,/g, "").trim();
  if (!cleaned) return NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyCompare(a: string, b: string): number {
  return a.localeCompare(b);
}

export function monthToDate(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, 1));
}

export function addMonths(monthKey: string, delta: number): string {
  const d = monthToDate(monthKey);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return toMonthKey(d);
}

export function monthInRange(month: string, start: string | null, end: string | null): boolean {
  if (start && month < start) return false;
  if (end && month > end) return false;
  return true;
}

export function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return monthKey;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}
