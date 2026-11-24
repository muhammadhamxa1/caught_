import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { token } from "@/lib/ids";

const COOKIE = "caught_session";
const MAX_AGE_DAYS = 30;

const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function startSession(userId: string) {
  const raw = token();
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  db.insert(sessions).values({ id: hash(raw), userId, expiresAt, createdAt: new Date() }).run();

  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) db.delete(sessions).where(eq(sessions.id, hash(raw))).run();
  jar.delete(COOKIE);
}

export async function currentUser() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const row = db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hash(raw)), gt(sessions.expiresAt, new Date())))
    .get();
  return row ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Every write goes through this, so one creator can never touch another's data. */
export function ownsAccount(userId: string, accountId: string) {
  return Boolean(
    db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .get(),
  );
}
