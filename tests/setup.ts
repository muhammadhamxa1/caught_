import { runMigrations } from "@/db";

// each test file gets its own in-memory database
runMigrations();
