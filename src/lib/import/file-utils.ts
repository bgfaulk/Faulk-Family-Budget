import fs from "node:fs/promises";
import path from "node:path";

export type CsvRow = string[];

export function dataPath(fileName: string): string {
  return path.join(process.cwd(), "data", fileName);
}

export async function readCsvRows(fileName: string): Promise<CsvRow[]> {
  const fullPath = dataPath(fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map(parseCsvLine);
}

function parseCsvLine(line: string): CsvRow {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}
