import type { Destination, Entry } from "@/db/schema";
import { searchProducts } from "@/lib/search";
import { addSignup } from "@/server/notify";
import { recordClick, recordEvent } from "@/server/tracking";

// Fake viewers for the seed and for the "send traffic" button in the
// sandbox. They behave the way the brief describes: most arrive from one
// video with a number in their head, a few search, a few browse.

export type Rand = () => number;

export function seeded(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SimProduct = {
  id: string;
  number: number;
  name: string;
  keywords: string;
  category: string;
  status: "active" | "sold_out" | "archived";
  backupId: string | null;
  priceCents: number;
  dests: Destination[];
  weight: number;
};

export type SimVideo = { id: string; productIds: string[] };

export type SimClick = {
  clickId: string;
  destination: Destination;
  productId: string;
  at: Date;
};

const USER_AGENTS: [string, number][] = [
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.2.0 JsSdk/2.0 NetType/WIFI BytedanceWebview/d8a21c6", 52],
  ["Mozilla/5.0 (Linux; Android 14; SM-S921U Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 trill_370203 BytedanceWebview/d8a21c6", 20],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 356.0.0.24.89", 8],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", 12],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", 8],
];

export function pickWeighted<T>(items: T[], weight: (t: T) => number, rand: Rand): T | null {
  const total = items.reduce((s, i) => s + Math.max(weight(i), 0), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const i of items) {
    r -= Math.max(weight(i), 0);
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

function pickDestination(dests: Destination[], rand: Rand): Destination {
  const weights: Record<Destination, number> = { tiktok: 68, amazon: 24, brand: 12 };
  return pickWeighted(dests, (d) => weights[d], rand) ?? "tiktok";
}

function contact(rand: Rand) {
  if (rand() < 0.6) {
    return `+1555${String(Math.floor(rand() * 1e7)).padStart(7, "0")}`;
  }
  const names = ["jess", "kayla", "mari", "tash", "bri", "lex", "dani", "sam", "nina", "ash"];
  return `${names[Math.floor(rand() * names.length)]}${Math.floor(rand() * 900 + 100)}@example.com`;
}

function searchTermFor(p: SimProduct, rand: Rand) {
  const pool = [...p.name.split(",")[0].toLowerCase().split(" "), ...p.keywords.split(" ")].filter(
    (w) => w.length > 3,
  );
  const a = pool[Math.floor(rand() * pool.length)] ?? p.name;
  if (rand() < 0.5) return a;
  const name = p.name.split(",")[0].toLowerCase().split(" ");
  return name.slice(-2).join(" ");
}

export type VisitInput = {
  accountId: string;
  products: SimProduct[];
  video: SimVideo | null;
  misses: string[];
  at: Date;
  rand: Rand;
  signups?: boolean;
};

export function simulateVisit(v: VisitInput): SimClick[] {
  const { rand, products } = v;
  const ua = pickWeighted(USER_AGENTS, (u) => u[1], rand)![0];
  const visitorId = `v_${Math.floor(rand() * 1e12).toString(36)}`;
  const at = (seconds: number) => new Date(v.at.getTime() + seconds * 1000);
  const byId = new Map(products.map((p) => [p.id, p]));
  const listed = products.filter((p) => p.status !== "archived");
  const active = products.filter((p) => p.status === "active");

  recordEvent({ accountId: v.accountId, type: "page_view", visitorId, userAgent: ua, at: v.at });

  let product: SimProduct | null = null;
  let entry: Entry = "list";
  const roll = rand();

  if (v.video) {
    const fromVideo = v.video.productIds.map((id) => byId.get(id)).filter(Boolean) as SimProduct[];
    product = fromVideo[Math.floor(rand() * fromVideo.length)] ?? null;
    entry = roll < 0.62 ? "number" : roll < 0.88 ? "video" : roll < 0.96 ? "search" : "list";
  } else {
    entry = roll < 0.35 ? "number" : roll < 0.62 ? "search" : roll < 0.9 ? "list" : "direct";
    product = pickWeighted(entry === "list" ? active : listed, (p) => p.weight, rand);
  }
  if (!product) return [];

  if (entry === "search") {
    const missed = !v.video && rand() < 0.22 && v.misses.length > 0;
    const query = missed ? v.misses[Math.floor(rand() * v.misses.length)] : searchTermFor(product, rand);
    const found = searchProducts(listed, query);
    recordEvent({
      accountId: v.accountId,
      type: "search",
      query,
      resultCount: found.results.length,
      visitorId,
      userAgent: ua,
      at: at(4),
    });
    if (found.results.length === 0) {
      if (rand() < 0.7) return [];
      entry = "list";
      product = pickWeighted(active, (p) => p.weight, rand);
      if (!product) return [];
    } else {
      product = found.results.find((r) => r.id === product!.id) ?? found.results[0];
    }
  }

  recordEvent({
    accountId: v.accountId,
    type: "product_view",
    productId: product.id,
    videoId: entry === "video" ? v.video?.id : null,
    entry,
    visitorId,
    userAgent: ua,
    at: at(8),
  });

  // Sold out: the page shows the creator's backup instead.
  if (product.status !== "active") {
    if (v.signups !== false && rand() < 0.12) addSignup(product.id, contact(rand), at(20));
    const backup = product.backupId ? byId.get(product.backupId) : null;
    if (!backup || backup.status !== "active" || rand() > 0.45) return [];
    product = backup;
    entry = "backup";
  } else if (v.signups !== false && rand() < 0.006) {
    addSignup(product.id, contact(rand), at(25));
  }

  if (rand() > 0.5) return [];

  const destination = pickDestination(product.dests, rand);
  const clickAt = at(14 + Math.floor(rand() * 30));
  const clickId = recordClick({
    accountId: v.accountId,
    productId: product.id,
    videoId: v.video?.id ?? null,
    destination,
    entry,
    visitorId,
    userAgent: ua,
    at: clickAt,
  });
  return [{ clickId, destination, productId: product.id, at: clickAt }];
}

/** Chance a click turns into an order, by store. Amazon converts best. */
export const CONVERSION: Record<Destination, number> = { tiktok: 0.075, amazon: 0.1, brand: 0.045 };
