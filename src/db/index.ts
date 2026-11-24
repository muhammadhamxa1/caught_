import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

function open(file: string): DB {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

// Keep one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { caughtDb?: DB };

export const db: DB =
  globalForDb.caughtDb ?? open(process.env.DATABASE_PATH || "data/caught.db");

if (process.env.NODE_ENV !== "production") globalForDb.caughtDb = db;

export function runMigrations(target: DB = db) {
  migrate(target, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export { schema };
