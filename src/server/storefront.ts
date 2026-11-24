import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { accounts, products, videoProducts, videos } from "@/db/schema";
import type { Storefront } from "@/lib/public";

export function loadStorefront(handle: string): Storefront | null {
  const account = db.select().from(accounts).where(eq(accounts.handle, handle.toLowerCase())).get();
  if (!account) return null;

  const rows = db
    .select()
    .from(products)
    .where(eq(products.accountId, account.id))
    .orderBy(desc(products.number))
    .all();

  const vids = db
    .select()
    .from(videos)
    .where(eq(videos.accountId, account.id))
    .orderBy(desc(videos.postedAt))
    .all();

  const links = vids.length
    ? db
        .select()
        .from(videoProducts)
        .where(inArray(videoProducts.videoId, vids.map((v) => v.id)))
        .orderBy(videoProducts.position)
        .all()
    : [];

  return {
    account: {
      id: account.id,
      handle: account.handle,
      displayName: account.displayName,
      bio: account.bio,
      avatarUrl: account.avatarUrl,
      socials: account.socials as Record<string, string>,
    },
    products: rows.map((p) => ({
      id: p.id,
      number: p.number,
      name: p.name,
      imageUrl: p.imageUrl,
      category: p.category,
      keywords: p.keywords,
      priceCents: p.priceCents,
      salePriceCents: p.salePriceCents,
      status: p.status,
      backupId: p.backupProductId,
      hasAmazon: Boolean(p.amazonUrl),
      brandName: p.brandName,
      hasBrand: Boolean(p.brandUrl),
    })),
    videos: vids
      .map((v) => ({
        id: v.id,
        caption: v.caption,
        thumbnailUrl: v.thumbnailUrl,
        views: v.views,
        postedAt: v.postedAt.getTime(),
        productIds: links.filter((l) => l.videoId === v.id).map((l) => l.productId),
      }))
      .filter((v) => v.productIds.length > 0),
  };
}

export function productByNumber(store: Storefront, n: number) {
  return store.products.find((p) => p.number === n) ?? null;
}

export function videosFor(store: Storefront, productId: string) {
  return store.videos.filter((v) => v.productIds.includes(productId));
}

export { backupFor } from "@/lib/public";

export function accountIdForProduct(productId: string) {
  return (
    db.select({ accountId: products.accountId }).from(products).where(eq(products.id, productId)).get()
      ?.accountId ?? null
  );
}

export function productInAccount(productId: string, accountId: string) {
  return Boolean(
    db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.accountId, accountId)))
      .get(),
  );
}
