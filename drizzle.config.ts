import { defineConfig } from "drizzle-kit";

// Used by `npm run db:generate` after a schema change. Setup applies the
// generated SQL in ./drizzle, so reviewers never need to run it.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_PATH || "data/caught.db" },
});
