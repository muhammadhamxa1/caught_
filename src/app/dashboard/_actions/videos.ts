"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { BASKET_STATUS, products, videoProducts, videos } from "@/db/schema";
import { newId } from "@/lib/ids";
import { ownsAccount, requireUser } from "@/server/session";
import { cleanImageUrl, saveImage } from "@/server/uploads";

export type VideoFormState = { error?: string } | null;

const s = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

export async function saveVideo(_prev: VideoFormState, form: FormData): Promise<VideoFormState> {
  const user = await requireUser();
  const id = s(form, "id");
  const existing = id ? db.select().from(videos).where(eq(videos.id, id)).get() : null;
  const accountId = existing?.accountId ?? s(form, "accountId");
  if (!ownsAccount(user.id, accountId)) return { error: "Pick one of your accounts." };

  let url: string;
  try {
    const u = new URL(s(form, "url"));
    if (!/(^|\.)tiktok\.com$/.test(u.hostname)) throw new Error();
    url = u.toString();
  } catch {
    return { error: "Paste the TikTok video link." };
  }

  const caption = s(form, "caption").slice(0, 300);
  const basket = BASKET_STATUS.includes(s(form, "basket") as never) ? (s(form, "basket") as (typeof BASKET_STATUS)[number]) : "live";
  const views = Math.max(0, Number.parseInt(s(form, "views").replace(/[,\s]/g, ""), 10) || 0);
  const posted = s(form, "postedAt") ? new Date(`${s(form, "postedAt")}T12:00:00`) : new Date();

  // Products are entered by number, the same way the creator says them.
  const numbers = [...new Set(s(form, "numbers").split(/[^\d]+/).filter(Boolean).map(Number))];
  if (numbers.length === 0) return { error: "Add at least one product number, like 47." };
  const found = db
    .select({ id: products.id, number: products.number })
    .from(products)
    .where(and(eq(products.accountId, accountId), inArray(products.number, numbers)))
    .all();
  const missing = numbers.filter((n) => !found.some((f) => f.number === n));
  if (missing.length) return { error: `No product with number ${missing.map((n) => `#${n}`).join(", ")} on this account.` };

  const upload = await saveImage(form.get("thumbnail") as File | null);
  if (upload && "error" in upload) return { error: upload.error };
  const thumbnailUrl = upload?.url ?? cleanImageUrl(s(form, "thumbnailUrl")) ?? existing?.thumbnailUrl ?? null;

  const videoId = existing?.id ?? newId();
  db.transaction(() => {
    if (existing) {
      db.update(videos).set({ url, caption, basket, views, postedAt: posted, thumbnailUrl }).where(eq(videos.id, videoId)).run();
      db.delete(videoProducts).where(eq(videoProducts.videoId, videoId)).run();
    } else {
      db.insert(videos)
        .values({ id: videoId, accountId, url, caption, basket, views, postedAt: posted, thumbnailUrl, createdAt: new Date() })
        .run();
    }
    numbers.forEach((n, position) => {
      const productId = found.find((f) => f.number === n)!.id;
      db.insert(videoProducts).values({ videoId, productId, position }).run();
    });
  });

  revalidatePath("/dashboard/videos");
  redirect("/dashboard/videos?saved=1");
}

export async function deleteVideo(form: FormData) {
  const user = await requireUser();
  const v = db.select().from(videos).where(eq(videos.id, s(form, "id"))).get();
  if (!v || !ownsAccount(user.id, v.accountId)) return;
  db.delete(videos).where(eq(videos.id, v.id)).run();
  revalidatePath("/dashboard/videos");
  redirect("/dashboard/videos");
}
