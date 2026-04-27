import { describe, expect, it } from "vitest";

import { buildProjectionPoints, computeRollingAverages } from "@/lib/services/projection-service";

describe("projection-service", () => {
  const sampleTimeline = [
    {
      month: "2026-01",
      incomePlanned: 1000,
      expensePlanned: 700,
      incomeActual: 1100,
      expenseActual: 650,
      netPlanned: 300,
      netActual: 450,
    },
    {
      month: "2026-02",
      incomePlanned: 1000,
      expensePlanned: 800,
      incomeActual: 1000,
      expenseActual: 900,
      netPlanned: 200,
      netActual: 100,
    },
    {
      month: "2026-03",
      incomePlanned: 1000,
      expensePlanned: 750,
      incomeActual: 900,
      expenseActual: 700,
      netPlanned: 250,
      netActual: 200,
    },
  ];

  it("computes rolling averages from timeline", () => {
    const rolling = computeRollingAverages(sampleTimeline);
    expect(rolling.rolling3Income).toBeCloseTo(1000, 4);
    expect(rolling.rolling3Expense).toBeCloseTo(750, 4);
  });

  it("creates forward projection points", () => {
    const points = buildProjectionPoints("2026-03", 1000, 750, 3);
    expect(points.map((point) => point.month)).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(points[0].projectedNet).toBe(250);
  });
});
