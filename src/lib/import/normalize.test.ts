import { describe, expect, it } from "vitest";

import {
  inferCadence,
  inferCategory,
  inferDirection,
  inferDueDay,
  makeTemplateKey,
  parseAmount,
} from "@/lib/import/normalize";

describe("import normalize utilities", () => {
  it("parses currency strings into numeric amounts", () => {
    expect(parseAmount("$2,271.33")).toBe(2271.33);
    expect(parseAmount("")).toBeNull();
  });

  it("infers direction and category from labels", () => {
    expect(inferDirection("Brian")).toBe("income");
    expect(inferDirection("Mortgage Payment")).toBe("expense");
    expect(inferCategory("Netflix")).toBe("subscriptions");
    expect(inferCategory("Mortgage Payment")).toBe("debt");
  });

  it("infers due day and cadence", () => {
    expect(inferDueDay("15th of each month")).toBe(15);
    expect(inferDueDay("N/A")).toBeNull();
    expect(inferCadence("Paid Quarterly")).toBe("quarterly");
    expect(inferCadence("Monthly bill")).toBe("monthly");
  });

  it("creates stable template keys", () => {
    const a = makeTemplateKey("Mortgage Payment (automatic)");
    const b = makeTemplateKey("Mortgage Payment (automatic)");
    expect(a).toBe(b);
    expect(a.startsWith("bill_")).toBe(true);
  });
});
