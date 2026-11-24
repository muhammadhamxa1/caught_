/**
 * One command after npm install: writes a .env with fresh secrets if there
 * isn't one, then builds and seeds the database.
 */
import fs from "node:fs";
import { randomBytes } from "node:crypto";

if (!fs.existsSync(".env")) {
  const example = fs.readFileSync(".env.example", "utf8");
  const filled = example.replace(/^(\w+_SECRET)=.*$/gm, (_, key) => `${key}=${randomBytes(24).toString("hex")}`);
  fs.writeFileSync(".env", filled);
  console.log("Created .env with fresh webhook secrets.");
}

void import("./seed");
