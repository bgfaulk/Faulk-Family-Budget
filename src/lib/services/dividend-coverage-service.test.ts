import { describe, expect, it } from "vitest";

import { computeCoverage, sortBillsForCoverage } from "@/lib/services/dividend-coverage-service";

describe("dividend-coverage-service", () => {
  const bills = [
    { billTemplateId: "1", name: "Netflix", amount: 25, dueDayOfMonth: 28 },
    { billTemplateId: "2", name: "Spotify", amount: 21, dueDayOfMonth: 29 },
    { billTemplateId: "3", name: "Mortgage", amount: 2600, dueDayOfMonth: 5 },
  ];

  it("sorts smallest-first by default", () => {
    const sorted = sortBillsForCoverage(bills, "smallest");
    expect(sorted.map((b) => b.name)).toEqual(["Spotify", "Netflix", "Mortgage"]);
  });

  it("sorts by due day when requested", () => {
    const sorted = sortBillsForCoverage(bills, "dueDay");
    expect(sorted.map((b) => b.name)).toEqual(["Mortgage", "Netflix", "Spotify"]);
  });

  it("covers bills in order until dividends run out", () => {
    const result = computeCoverage(bills, 50, "smallest");
    expect(result.billCupTotal).toBe(2646);
    expect(result.fullyCoveredCount).toBe(2);
    expect(result.fullyCoveredNames).toEqual(["Spotify", "Netflix"]);
    expect(result.nextBill?.name).toBe("Mortgage");
    expect(result.nextBill?.remainingNeeded).toBe(2596);
    expect(result.fillPercent).toBeCloseTo((50 / 2646) * 100, 5);
  });

  it("marks partial bill when dividends fall mid-bill", () => {
    const result = computeCoverage(bills, 40, "smallest");
    const partial = result.slices.find((s) => s.status === "partial");
    expect(partial?.name).toBe("Netflix");
    expect(partial?.appliedAmount).toBe(19);
  });

  it("returns 100% fill when dividends exceed all bills", () => {
    const result = computeCoverage(bills, 5000, "smallest");
    expect(result.fullyCoveredCount).toBe(3);
    expect(result.fillPercent).toBe(100);
    expect(result.nextBill).toBeNull();
  });

  it("handles zero dividends", () => {
    const result = computeCoverage(bills, 0, "smallest");
    expect(result.fullyCoveredCount).toBe(0);
    expect(result.nextBill?.name).toBe("Spotify");
    expect(result.slices.every((s) => s.status === "uncovered")).toBe(true);
  });
});
