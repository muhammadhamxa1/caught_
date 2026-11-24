"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { products, type Destination } from "@/db/schema";
import { parseMoney } from "@/lib/money";
import { artUrl, brandUrl, catalogIdFromUrl, catalogItem } from "@/sandbox/catalog";
import { sendWaiting } from "@/server/notify";
import {
  archiveProduct,
  createProduct,
  isOnSale,
  markInStock,
  markSoldOut,
  setBackup,
  updateProduct,
  type ProductInput,
} from "@/server/products";
import { ownsAccount, requireUser } from "@/server/session";
import { cleanImageUrl, saveImage } from "@/server/uploads";

export type ProductFormState = { error?: string; saved?: boolean } | null;

/** The product, but only if the logged in user owns it. */
async function ownedProduct(productId: string) {
  const user = await requireUser();
  const p = db.select().from(products).where(eq(products.id, productId)).get();
  if (!p || !ownsAccount(user.id, p.accountId)) throw new Error("Not your product");
  return p;
}

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function httpsUrl(raw: string, hosts?: RegExp): string | null | false {
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (hosts && !hosts.test(u.hostname)) return false;
    return u.toString();
  } catch {
    return false;
  }
}

/** "15" or "12.5%" to basis points. */
function rateBps(raw: string) {
  if (!raw) return 0;
  const n = Number(raw.replace("%", ""));
  if (!Number.isFinite(n) || n < 0 || n > 80) return NaN;
  return Math.round(n * 100);
}

function readForm(form: FormData): { input?: Omit<ProductInput, "imageUrl">; error?: string } {
  const name = str(form, "name");
  if (!name) return { error: "Add a product name." };
  if (name.length > 120) return { error: "Keep the name under 120 characters." };

  const priceCents = parseMoney(str(form, "price"));
  if (priceCents === null || priceCents <= 0) return { error: "Enter a price, like 14.99." };
  const saleRaw = str(form, "salePrice");
  const salePriceCents = saleRaw ? parseMoney(saleRaw) : null;
  if (saleRaw && (salePriceCents === null || salePriceCents >= priceCents)) {
    return { error: "The sale price has to be lower than the price." };
  }

  const tiktokUrl = httpsUrl(str(form, "tiktokUrl"), /(^|\.)tiktok\.com$/i);
  if (!tiktokUrl) return { error: "Paste the product's TikTok Shop link." };
  const amazonUrl = httpsUrl(str(form, "amazonUrl"), /(^|\.)(amazon\.[a-z.]+|amzn\.to)$/i);
  if (amazonUrl === false) return { error: "The Amazon link doesn't look like an Amazon link." };
  const brandLink = httpsUrl(str(form, "brandUrl"));
  if (brandLink === false) return { error: "The brand link isn't a valid web address." };

  const rules: ProductInput["rules"] = [];
  const add = (destination: Destination, raw: string, minMonthlyUnits = 0) => {
    const bps = rateBps(raw);
    if (Number.isNaN(bps)) throw new Error("Commission rates are percentages between 0 and 80.");
    if (bps > 0) rules.push({ destination, rateBps: bps, minMonthlyUnits });
  };
  try {
    add("tiktok", str(form, "tiktokRate"));
    const tierUnits = Number.parseInt(str(form, "tierUnits"), 10);
    if (str(form, "tierRate") && tierUnits > 0) add("tiktok", str(form, "tierRate"), tierUnits);
    if (amazonUrl) add("amazon", str(form, "amazonRate"));
    if (brandLink) add("brand", str(form, "brandRate"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  return {
    input: {
      name,
      category: str(form, "category") || "other",
      keywords: str(form, "keywords").slice(0, 200),
      priceCents,
      salePriceCents,
      tiktokUrl,
      amazonUrl,
      brandUrl: brandLink,
      brandName: brandLink ? str(form, "brandName") || null : null,
      catalogId: str(form, "catalogId") || null,
      rules,
    },
  };
}

export async function saveProduct(_prev: ProductFormState, form: FormData): Promise<ProductFormState> {
  const user = await requireUser();
  const { input, error } = readForm(form);
  if (!input) return { error };

  const upload = await saveImage(form.get("image") as File | null);
  if (upload && "error" in upload) return { error: upload.error };
  const imageUrl = upload?.url ?? cleanImageUrl(str(form, "imageUrl"));

  const id = str(form, "id");
  if (id) {
    await ownedProduct(id);
    updateProduct(id, { ...input, imageUrl });
    revalidatePath("/dashboard", "layout");
    return { saved: true };
  }

  const accountId = str(form, "accountId");
  if (!ownsAccount(user.id, accountId)) return { error: "Pick one of your accounts." };
  const created = createProduct(accountId, { ...input, imageUrl });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/products/${created.id}?created=1`);
}

export type CatalogFill = {
  error?: string;
  item?: {
    catalogId: string;
    name: string;
    priceCents: number;
    category: string;
    keywords: string;
    imageUrl: string;
    tiktokUrl: string;
    rateBps: number;
    tier?: { minUnits: number; rateBps: number };
    brandName?: string;
    brandUrl?: string | null;
    brandRateBps?: number;
  };
};

/** Stands in for the TikTok Shop product API: paste a link, get the details. */
export async function lookupCatalog(url: string): Promise<CatalogFill> {
  await requireUser();
  const id = catalogIdFromUrl(url);
  const item = id ? catalogItem(id) : null;
  if (!item) return { error: "Couldn't find that product. Fill the details in by hand, or try a link from the sandbox catalog below." };
  return {
    item: {
      catalogId: item.id,
      name: item.title,
      priceCents: item.priceCents,
      category: item.category,
      keywords: item.keywords,
      imageUrl: artUrl(item),
      tiktokUrl: `https://shop.tiktok.com/view/product/${item.id}`,
      rateBps: item.rateBps,
      tier: item.tier,
      brandName: item.brand?.name,
      brandUrl: brandUrl(item),
      brandRateBps: item.brand?.rateBps,
    },
  };
}

export async function soldOutAction(form: FormData) {
  const p = await ownedProduct(String(form.get("productId")));
  const backup = String(form.get("backupId") ?? "") || null;
  try {
    if (p.status === "sold_out") setBackup(p.id, backup);
    else markSoldOut(p.id, backup);
  } catch (e) {
    redirect(`/dashboard/products/${p.id}?error=${encodeURIComponent((e as Error).message)}`);
  }
  revalidatePath("/dashboard", "layout");
}

export async function inStockAction(form: FormData) {
  const p = await ownedProduct(String(form.get("productId")));
  const sent = markInStock(p.id);
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/products/${p.id}?restocked=${sent}`);
}

export async function archiveAction(form: FormData) {
  const p = await ownedProduct(String(form.get("productId")));
  archiveProduct(p.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/products");
}

export async function sendWaitingNow(form: FormData) {
  const p = await ownedProduct(String(form.get("productId")));
  if (p.status !== "active") return;
  sendWaiting(p.id, "restock");
  if (isOnSale(p)) sendWaiting(p.id, "sale");
  revalidatePath("/dashboard", "layout");
}
