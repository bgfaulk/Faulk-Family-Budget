import { readFileSync } from "node:fs";

import type { DividendCadence } from "@/lib/dividend/types";
import { dataPath } from "@/lib/import/file-utils";

type CadenceFile = {
  weekly: string[];
  monthly: string[];
};

let cached: Map<string, DividendCadence> | null = null;

export function loadDividendCadenceMap(): Map<string, DividendCadence> {
  if (cached) return cached;

  const map = new Map<string, DividendCadence>();
  try {
    const raw = readFileSync(dataPath("dividend-cadence.json"), "utf8");
    const payload = JSON.parse(raw) as CadenceFile;
    for (const ticker of payload.weekly) {
      map.set(ticker.toUpperCase(), "weekly");
    }
    for (const ticker of payload.monthly) {
      map.set(ticker.toUpperCase(), "monthly");
    }
  } catch {
    // optional file
  }

  cached = map;
  return map;
}

export function cadenceForTicker(ticker: string): DividendCadence {
  return loadDividendCadenceMap().get(ticker.toUpperCase()) ?? "other";
}
