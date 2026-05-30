import { describe, expect, it } from "vitest";

import { parseSnowballExportRows } from "@/lib/import/snowball-export";

describe("snowball-export", () => {
  it("parses dividend rows and aggregates by month", () => {
    const rows = [
      ["Event", "Date", "Symbol", "Price", "Quantity", "Currency"],
      ["DIVIDEND", "2026-05-14 03:00:00", "CHPY", "0", "0.66", "USD"],
      ["DIVIDEND", "2026-05-21 03:00:00", "CHPY", "0", "0.65", "USD"],
      ["DIVIDEND", "2026-05-15 03:00:00", "GDXY", "0", "5.10", "USD"],
      ["BUY", "2026-05-11 03:00:00", "JEPI", "55.945", "1", "USD"],
    ];
    const parsed = parseSnowballExportRows(rows);
    expect(parsed.tickers).toContain("CHPY");
    expect(parsed.tickers).toContain("JEPI");
    const may = parsed.dividendsByMonth.get("2026-05");
    expect(may?.get("CHPY")).toBeCloseTo(1.31, 2);
    expect(may?.get("GDXY")).toBeCloseTo(5.1, 2);
  });
});
