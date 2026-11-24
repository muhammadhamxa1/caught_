"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { cleanSocials, createAccount, handleProblem, handleTaken, normalizeHandle } from "@/server/accounts";
import { SCOPE_COOKIE } from "@/server/scope";
import { ownsAccount, requireUser } from "@/server/session";
import { saveImage } from "@/server/uploads";

export type SettingsState = { ok?: boolean; error?: string; message?: string } | null;

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export async function saveProfile(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const accountId = s(form, "accountId");
  if (!ownsAccount(user.id, accountId)) return { error: "Not your account." };

  const displayName = s(form, "displayName").slice(0, 60);
  if (!displayName) return { error: "Add the name shown on your page." };

  const upload = await saveImage(form.get("avatar") as File | null);
  if (upload && "error" in upload) return { error: upload.error };

  db.update(accounts)
    .set({
      displayName,
      bio: s(form, "bio").slice(0, 200),
      ...(upload ? { avatarUrl: upload.url } : {}),
      ...(form.get("removeAvatar") ? { avatarUrl: null } : {}),
      socials: cleanSocials({
        tiktok: s(form, "tiktok"),
        instagram: s(form, "instagram"),
        youtube: s(form, "youtube"),
        amazon: s(form, "amazon"),
        website: s(form, "website"),
      }),
    })
    .where(eq(accounts.id, accountId))
    .run();

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved. Your page is updated." };
}

export async function addAccount(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const user = await requireUser();
  const handle = normalizeHandle(s(form, "handle"));
  const problem = handleProblem(handle);
  if (problem) return { error: problem };
  if (handleTaken(handle)) return { error: `@${handle} is taken.` };

  const id = createAccount(user.id, { handle, displayName: s(form, "displayName") || handle });
  (await cookies()).set(SCOPE_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: `@${handle} is live at caughtshop.com/${handle}. You're now looking at it.` };
}
