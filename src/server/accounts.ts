import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users, type Socials } from "@/db/schema";
import { newId } from "@/lib/ids";
import { hashPassword } from "./password";

// Paths the app already uses, plus words that would confuse viewers.
const RESERVED = new Set([
  "admin", "api", "app", "dashboard", "go", "login", "logout", "signup", "settings",
  "sandbox", "media", "r", "receipt", "help", "support", "terms", "privacy", "about",
  "caught", "caughtshop", "tiktok", "amazon", "shop", "static", "public", "demo",
  "favicon.ico", "robots.txt", "sitemap.xml",
]);

export const HANDLE_RULES = "3 to 24 characters: letters, numbers, dots and underscores.";

export function normalizeHandle(raw: string) {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function handleProblem(handle: string): string | null {
  if (!/^[a-z0-9._]{3,24}$/.test(handle)) return HANDLE_RULES;
  if (handle.startsWith(".") || handle.endsWith(".") || handle.includes("..")) {
    return "Dots can't be at the start, the end, or next to each other.";
  }
  if (RESERVED.has(handle)) return "That handle is reserved.";
  return null;
}

export function handleTaken(handle: string) {
  return Boolean(db.select({ id: accounts.id }).from(accounts).where(eq(accounts.handle, handle)).get());
}

export async function createUser(email: string, name: string, password: string, at = new Date()) {
  const id = newId();
  db.insert(users)
    .values({
      id,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      passwordHash: await hashPassword(password),
      createdAt: at,
    })
    .run();
  return id;
}

export function createAccount(
  userId: string,
  input: { handle: string; displayName: string; bio?: string; socials?: Socials },
  at = new Date(),
) {
  const id = newId();
  db.insert(accounts)
    .values({
      id,
      userId,
      handle: input.handle,
      displayName: input.displayName,
      bio: input.bio ?? "",
      socials: input.socials ?? {},
      createdAt: at,
    })
    .run();
  return id;
}

export function accountsFor(userId: string) {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.createdAt))
    .all();
}

export function accountByHandle(handle: string) {
  return db.select().from(accounts).where(eq(accounts.handle, handle)).get() ?? null;
}

/** Keeps only http(s) links, so a creator can't put a javascript: link on their page. */
export function cleanSocials(input: Record<string, string | undefined>): Socials {
  const out: Socials = {};
  for (const key of ["tiktok", "instagram", "youtube", "amazon", "website"] as const) {
    const v = input[key]?.trim();
    if (!v) continue;
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(url);
      if (u.protocol === "https:" || u.protocol === "http:") out[key] = u.toString();
    } catch {
      // ignore links we can't parse
    }
  }
  return out;
}
