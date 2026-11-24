import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  clicks,
  commissionRules,
  products,
  type Destination,
} from "@/db/schema";
import { newId } from "@/lib/ids";
import { sendWaiting } from "./notify";

export type Product = typeof products.$inferSelect;

export type RuleInput = { destination: Destination; rateBps: number; minMonthlyUnits: number };

export type ProductInput = {
  name: string;
  imageUrl: string | null;
  category: string;
  keywords: string;
  priceCents: number;
  salePriceCents: number | null;
  tiktokUrl: string;
  amazonUrl: string | null;
  brandUrl: string | null;
  brandName: string | null;
  catalogId?: string | null;
  rules: RuleInput[];
};

export function isOnSale(p: Pick<Product, "priceCents" | "salePriceCents">) {
  return p.salePriceCents !== null && p.salePriceCents < p.priceCents;
}

export function priceNow(p: Pick<Product, "priceCents" | "salePriceCents">) {
  return isOnSale(p) ? p.salePriceCents! : p.priceCents;
}

function writeRules(productId: string, rules: RuleInput[]) {
  db.delete(commissionRules).where(eq(commissionRules.productId, productId)).run();
  const seen = new Set<string>();
  for (const r of rules) {
    const key = `${r.destination}:${r.minMonthlyUnits}`;
    if (seen.has(key) || r.rateBps <= 0) continue;
    seen.add(key);
    db.insert(commissionRules)
      .values({ id: newId(), productId, ...r })
      .run();
  }
}

/** Numbers come from a counter on the account, so they are never reused. */
export function createProduct(accountId: string, input: ProductInput, at = new Date()) {
  return db.transaction(() => {
    const account = db
      .select({ nextNumber: accounts.nextNumber })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get();
    if (!account) throw new Error("Account not found");

    const id = newId();
    const { rules, ...fields } = input;
    db.insert(products)
      .values({
        id,
        accountId,
        number: account.nextNumber,
        ...fields,
        catalogId: fields.catalogId ?? null,
        createdAt: at,
        updatedAt: at,
      })
      .run();
    db.update(accounts)
      .set({ nextNumber: account.nextNumber + 1 })
      .where(eq(accounts.id, accountId))
      .run();
    writeRules(id, rules);

    return db.select().from(products).where(eq(products.id, id)).get()!;
  });
}

export function updateProduct(productId: string, input: ProductInput, at = new Date()) {
  const sent = db.transaction(() => {
    const before = db.select().from(products).where(eq(products.id, productId)).get();
    if (!before) throw new Error("Product not found");
    const { rules, ...fields } = input;
    db.update(products)
      .set({ ...fields, updatedAt: at })
      .where(eq(products.id, productId))
      .run();
    writeRules(productId, rules);

    // Going on sale is the moment people asked to hear about.
    const after = { ...before, ...fields };
    const newSale =
      isOnSale(after) &&
      (!isOnSale(before) || after.salePriceCents! < before.salePriceCents!);
    return newSale && after.status === "active" ? "sale" : null;
  });
  return sent ? sendWaiting(productId, "sale", at) : 0;
}

function assertBackup(product: Product, backupId: string) {
  if (backupId === product.id) throw new Error("A product can't back up itself.");
  const backup = db.select().from(products).where(eq(products.id, backupId)).get();
  if (!backup || backup.accountId !== product.accountId) {
    throw new Error("Pick a backup from the same account.");
  }
  if (backup.status !== "active") throw new Error("The backup has to be in stock.");
}

export function markSoldOut(productId: string, backupId: string | null, at = new Date()) {
  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product) throw new Error("Product not found");

  const chosen = backupId ?? suggestBackups(productId, 1)[0]?.id ?? null;
  if (chosen) assertBackup(product, chosen);

  db.update(products)
    .set({ status: "sold_out", backupProductId: chosen, updatedAt: at })
    .where(eq(products.id, productId))
    .run();
  return chosen;
}

export function setBackup(productId: string, backupId: string | null) {
  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product) throw new Error("Product not found");
  if (backupId) assertBackup(product, backupId);
  db.update(products)
    .set({ backupProductId: backupId, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .run();
}

export function markInStock(productId: string, at = new Date()) {
  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product || product.status === "active") return 0;
  db.update(products)
    .set({ status: "active", updatedAt: at })
    .where(eq(products.id, productId))
    .run();
  return sendWaiting(productId, "restock", at);
}

/** Archived products keep their number so old videos still resolve. */
export function archiveProduct(productId: string, at = new Date()) {
  db.update(products)
    .set({ status: "archived", updatedAt: at })
    .where(eq(products.id, productId))
    .run();
}

/**
 * Follows the backup chain to the first product that is in stock. If the
 * backup sold out too, its own backup is used. Capped so a loop can't hang.
 */
export function resolveBackup(product: Product, byId: Map<string, Product>) {
  let current: Product | undefined = product;
  for (let hop = 0; hop < 4 && current; hop++) {
    if (!current.backupProductId) return null;
    const next = byId.get(current.backupProductId);
    if (!next || next.id === product.id) return null;
    if (next.status === "active") return next;
    current = next;
  }
  return null;
}

/**
 * Best stand-in for a sold out product: in stock, same category first, then
 * the ones that already get clicked, then the closest price.
 */
export function suggestBackups(productId: string, limit = 3) {
  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product) return [];

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const candidates = db
    .select({
      p: products,
      clicks: sql<number>`(select count(*) from ${clicks} where ${clicks.productId} = ${products.id} and ${clicks.createdAt} >= ${since.getTime()})`,
    })
    .from(products)
    .where(
      and(
        eq(products.accountId, product.accountId),
        eq(products.status, "active"),
        ne(products.id, product.id),
      ),
    )
    .all();

  const maxClicks = Math.max(1, ...candidates.map((c) => Number(c.clicks)));
  return candidates
    .map(({ p, clicks: n }) => {
      const sameCategory = p.category === product.category ? 2 : 0;
      const popularity = Number(n) / maxClicks;
      const priceGap = Math.abs(p.priceCents - product.priceCents) / Math.max(product.priceCents, 1);
      return { ...p, score: sameCategory + popularity - Math.min(priceGap, 1) * 0.5 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function productsForAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return [];
  return db
    .select()
    .from(products)
    .where(inArray(products.accountId, accountIds))
    .orderBy(desc(products.number))
    .all();
}

export function clicksSince(productIds: string[], since: Date) {
  if (productIds.length === 0) return new Map<string, number>();
  const rows = db
    .select({ productId: clicks.productId, n: sql<number>`count(*)` })
    .from(clicks)
    .where(and(inArray(clicks.productId, productIds), gte(clicks.createdAt, since)))
    .groupBy(clicks.productId)
    .all();
  return new Map(rows.map((r) => [r.productId, Number(r.n)]));
}
