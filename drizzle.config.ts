import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

// Drizzle CLI does not automatically read Next.js .env.local.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
