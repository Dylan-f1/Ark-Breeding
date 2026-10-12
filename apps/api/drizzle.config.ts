import { defineConfig } from "drizzle-kit";

// Only generates SQL migrations; wrangler applies them to D1 (local or remote).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
