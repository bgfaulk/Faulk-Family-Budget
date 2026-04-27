import { describe, expect, it } from "vitest";

import { aggregateMonthRollups } from "@/lib/services/data-source";

describe("data-source rollups", () => {
  it("aggregates month rollups from imported fallback data", async () => {
    const rollups = await aggregateMonthRollups();
    expect(rollups.length).toBeGreaterThan(0);
    const latest = rollups[rollups.length - 1];
    expect(latest.month).toMatch(/^\d{4}-\d{2}$/);
    expect(Number.isFinite(latest.netPlanned)).toBe(true);
  });
});
