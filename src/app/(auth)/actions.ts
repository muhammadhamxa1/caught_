"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createAccount, createUser, handleProblem, handleTaken, normalizeHandle } from "@/server/accounts";
import { verifyPassword } from "@/server/password";
import { allow, clientIp } from "@/server/ratelimit";
import { endSession, startSession } from "@/server/session";

export type AuthState = { error: string; fields?: Record<string, string> } | null;

async function limited(key: string) {
  return !allow(`${key}:${clientIp(await headers())}`, 10, 10 * 60_000);
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited("login")) return { error: "Too many attempts. Try again in a few minutes." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = db.select().from(users).where(eq(users.email, email)).get();

  // same message either way, so the form doesn't reveal which emails exist
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Email or password is wrong.", fields: { email } };
  }
  await startSession(user.id);
  redirect("/dashboard");
}

const signupSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(60),
  email: z.email("Enter a valid email.").max(120),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  handle: z.string().max(40),
});

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (await limited("signup")) return { error: "Too many attempts. Try again in a few minutes." };

  const raw = Object.fromEntries(["name", "email", "password", "handle"].map((k) => [k, String(form.get(k) ?? "")]));
  const fields = { name: raw.name, email: raw.email, handle: raw.handle };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const handle = normalizeHandle(parsed.data.handle);
  const problem = handleProblem(handle);
  if (problem) return { error: problem, fields };
  if (handleTaken(handle)) return { error: `@${handle} is taken.`, fields };

  const email = parsed.data.email.toLowerCase();
  if (db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()) {
    return { error: "That email already has an account. Log in instead.", fields };
  }

  const userId = await createUser(email, parsed.data.name, parsed.data.password);
  createAccount(userId, { handle, displayName: parsed.data.name });
  await startSession(userId);
  redirect("/dashboard/products/new?welcome=1");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
