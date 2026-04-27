import { createHash } from "node:crypto";

import type { BillCadence, CashflowDirection } from "@/lib/budget/types";
import { parseNumeric } from "@/lib/budget/utils";

export function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeTemplateKey(name: string): string {
  const normalized = normalizeLabel(name);
  const hash = createHash("sha1").update(normalized).digest("hex").slice(0, 10);
  return `bill_${hash}`;
}

export function inferDirection(label: string): CashflowDirection {
  const normalized = normalizeLabel(label);
  if (/\b(income|paycheck|salary|deposit|brian|lauren|what we make)\b/.test(normalized)) {
    return "income";
  }
  return "expense";
}

export function inferCategory(label: string): string {
  const normalized = normalizeLabel(label);
  if (/\b(mortgage|loan|auto|car|student|bank|visa|card|payment)\b/.test(normalized)) return "debt";
  if (/\b(internet|water|electric|entergy|utility|trash)\b/.test(normalized)) return "utilities";
  if (/\b(netflix|spotify|disney|youtube)\b/.test(normalized)) return "subscriptions";
  if (/\b(insurance|travlers|travelers)\b/.test(normalized)) return "insurance";
  if (/\b(income|salary|paycheck|brian|lauren)\b/.test(normalized)) return "income";
  return "household";
}

export function inferCadence(text: string): BillCadence {
  const normalized = normalizeLabel(text);
  if (normalized.includes("quartly") || normalized.includes("quarterly")) return "quarterly";
  if (normalized.includes("annual") || normalized.includes("year")) return "annual";
  if (normalized.includes("biweekly")) return "biweekly";
  if (normalized.includes("one time") || normalized.includes("one off")) return "one_off";
  return "monthly";
}

export function inferDueDay(text: string): number | null {
  const match = text.match(/(\d{1,2})(?:st|nd|rd|th)?/i);
  if (!match) return null;
  const day = Number(match[1]);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

export function parseAmount(value: string | number | null | undefined): number | null {
  const numeric = parseNumeric(value);
  return Number.isFinite(numeric) ? numeric : null;
}
