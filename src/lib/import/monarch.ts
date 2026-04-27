import type { ImportedAccountSnapshot } from "@/lib/import/types";
import { readCsvRows } from "@/lib/import/file-utils";
import { parseAmount } from "@/lib/import/normalize";

export async function parseMonarchCsv(fileName = "Faulk Monarch Data.csv"): Promise<ImportedAccountSnapshot[]> {
  const rows = await readCsvRows(fileName);
  const snapshots: ImportedAccountSnapshot[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const snapshotDate = (row[0] ?? "").trim();
    const balance = parseAmount(row[1] ?? "");
    const accountName = (row[2] ?? "").trim();
    if (!snapshotDate || !accountName || balance === null) continue;
    snapshots.push({
      snapshotDate,
      accountName,
      balance,
      source: "monarch_import",
    });
  }

  return snapshots;
}
