import { config as loadEnv } from "dotenv";
import { importDatasetToDatabase } from "../src/lib/import/import-to-db";

loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const result = await importDatasetToDatabase();
  console.log("Import complete:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
