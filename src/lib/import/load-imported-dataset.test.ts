import { describe, expect, it } from "vitest";

import { loadImportedDataset } from "@/lib/import/load-imported-dataset";

describe("loadImportedDataset", () => {
  it("loads normalized records from provided files", async () => {
    const data = await loadImportedDataset();
    expect(data.billTemplates.length).toBeGreaterThan(0);
    expect(data.monthlyPlanEntries.length).toBeGreaterThan(0);
    expect(data.accountSnapshots.length).toBeGreaterThan(0);
  });
});
