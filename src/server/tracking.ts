import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  accounts,
  clicks,
  events,
  sales,
  type Destination,
  type Entry,
  type EventType,
} from "@/db/schema";
import { publicId } from "@/lib/ids";
import { recordSale } from "./commissions";
import { NETWORKS } from "./networks";

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|headless|lighthouse|curl|wget|python-requests|httpclient/i;

export function isBot(ua: string | null | undefined) {
  if (!ua) return true;
  return BOT_UA.test(ua);
}

/**
 * Most viewers land from TikTok's in-app browser. Knowing that share tells a
 * creator how much traffic comes straight from their videos.
 */
export function deviceOf(ua: string | null | undefined) {
  if (!ua) return "unknown";
  if (/musical_ly|bytedancewebview|tiktok/i.test(ua)) return "tiktok";
  if (/instagram/i.test(ua)) return "instagram";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

type ClickInput = {
  accountId: string;
  productId: string;
  videoId?: string | null;
  destination: Destination;
  entry: Entry;
  visitorId?: string | null;
  userAgent?: string | null;
  at?: Date;
};

export function recordClick(input: ClickInput) {
  const id = publicId(12);
  db.insert(clicks)
    .values({
      id,
      accountId: input.accountId,
      productId: input.productId,
      videoId: input.videoId ?? null,
      destination: input.destination,
      entry: input.entry,
      visitorId: input.visitorId ?? null,
      device: deviceOf(input.userAgent),
      isBot: isBot(input.userAgent),
      createdAt: input.at ?? new Date(),
    })
    .run();
  return id;
}

type EventInput = {
  accountId: string;
  type: EventType;
  productId?: string | null;
  videoId?: string | null;
  entry?: Entry | null;
  query?: string | null;
  resultCount?: number | null;
  visitorId?: string | null;
  userAgent?: string | null;
  at?: Date;
};

export function recordEvent(input: EventInput) {
  if (isBot(input.userAgent)) return;
  db.insert(events)
    .values({
      accountId: input.accountId,
      type: input.type,
      productId: input.productId ?? null,
      videoId: input.videoId ?? null,
      entry: input.entry ?? null,
      query: input.query ? normalizeQuery(input.query) : null,
      resultCount: input.resultCount ?? null,
      visitorId: input.visitorId ?? null,
      device: deviceOf(input.userAgent),
      createdAt: input.at ?? new Date(),
    })
    .run();
}

export function normalizeQuery(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export type OrderReport = {
  destination: Destination;
  clickId: string | null;
  networkOrderId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  at: Date;
};

export type AttributionResult =
  | { ok: true; saleId: string; amountCents: number; rateBps: number; accountId: string }
  | { ok: false; reason: string; duplicate?: boolean };

/**
 * A network reports an order with the click id we gave it. We only credit it
 * when the click exists, was for that same store, wasn't a bot, and the order
 * landed inside that store's attribution window.
 */
export function attributeOrder(report: OrderReport): AttributionResult {
  const existing = db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.destination, report.destination),
        eq(sales.networkOrderId, report.networkOrderId),
      ),
    )
    .get();
  if (existing) return { ok: false, reason: "Order already recorded", duplicate: true };

  if (!report.clickId) return { ok: false, reason: "No click id on the order" };

  const click = db.select().from(clicks).where(eq(clicks.id, report.clickId)).get();
  if (!click) return { ok: false, reason: "Unknown click id" };
  if (click.isBot) return { ok: false, reason: "Click was flagged as a bot" };
  if (click.destination !== report.destination) {
    return { ok: false, reason: `Click was for ${NETWORKS[click.destination].label}` };
  }

  // networks send whole seconds and their clocks drift, so allow a minute
  const age = report.at.getTime() - click.createdAt.getTime();
  if (age < -60_000) return { ok: false, reason: "Order is older than the click" };
  if (age > NETWORKS[report.destination].attributionWindowMs) {
    return { ok: false, reason: "Outside the attribution window" };
  }

  const account = db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.id, click.accountId))
    .get();
  if (!account) return { ok: false, reason: "Account no longer exists" };

  if (report.quantity < 1 || report.unitPriceCents < 0 || report.discountCents < 0) {
    return { ok: false, reason: "Order has invalid amounts" };
  }

  const result = recordSale({
    accountId: click.accountId,
    userId: account.userId,
    productId: click.productId,
    clickId: click.id,
    destination: report.destination,
    networkOrderId: report.networkOrderId,
    quantity: report.quantity,
    unitPriceCents: report.unitPriceCents,
    discountCents: report.discountCents,
    at: report.at,
  });

  return {
    ok: true,
    saleId: result.saleId,
    amountCents: result.amountCents,
    rateBps: result.rateBps,
    accountId: click.accountId,
  };
}
