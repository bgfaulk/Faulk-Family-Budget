import { describe, expect, it } from "vitest";

import { filterTemplatesForMonth, generateMonthPlanFromTemplates } from "@/lib/services/budget-service";

describe("budget-service lifecycle rules", () => {
  const templates = [
    {
      id: "a",
      name: "Mortgage",
      counterpartyName: "Mortgage",
      direction: "expense" as const,
      category: "debt",
      defaultAmount: 2000,
      dueDayOfMonth: 1,
      cadence: "monthly" as const,
      effectiveStartMonth: "2024-01",
      effectiveEndMonth: null,
      payoffMonth: null,
      websiteUrl: null,
      paymentAccount: null,
      isArchived: false,
      uiVisible: true,
      archivedAt: null,
      archivedReason: null,
      notes: null,
    },
    {
      id: "b",
      name: "Old Subscription",
      counterpartyName: "Old Subscription",
      direction: "expense" as const,
      category: "subscriptions",
      defaultAmount: 20,
      dueDayOfMonth: 10,
      cadence: "monthly" as const,
      effectiveStartMonth: "2023-01",
      effectiveEndMonth: "2024-12",
      payoffMonth: null,
      websiteUrl: null,
      paymentAccount: null,
      isArchived: false,
      uiVisible: true,
      archivedAt: null,
      archivedReason: null,
      notes: null,
    },
    {
      id: "c",
      name: "Archived Bill",
      counterpartyName: "Archived Bill",
      direction: "expense" as const,
      category: "household",
      defaultAmount: 100,
      dueDayOfMonth: 20,
      cadence: "monthly" as const,
      effectiveStartMonth: "2023-01",
      effectiveEndMonth: null,
      payoffMonth: null,
      websiteUrl: null,
      paymentAccount: null,
      isArchived: true,
      uiVisible: false,
      archivedAt: null,
      archivedReason: "legacy",
      notes: null,
    },
  ];

  it("filters out archived and end-dated bills outside month range", () => {
    const activeIn2025 = filterTemplatesForMonth(templates, "2025-02");
    expect(activeIn2025.map((item) => item.id)).toEqual(["a"]);
  });

  it("generates month plan rows from active templates", () => {
    const rows = generateMonthPlanFromTemplates(templates, "2024-06");
    expect(rows.length).toBe(2);
    expect(rows.every((row) => row.source === "template")).toBe(true);
  });
});
