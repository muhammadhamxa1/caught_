"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SCOPE_COOKIE } from "@/server/scope";
import { ownsAccount, requireUser } from "@/server/session";

export async function setScope(value: string) {
  const user = await requireUser();
  const jar = await cookies();
  if (value === "all" || !ownsAccount(user.id, value)) jar.delete(SCOPE_COOKIE);
  else jar.set(SCOPE_COOKIE, value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/dashboard", "layout");
}
