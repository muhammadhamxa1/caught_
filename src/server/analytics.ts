import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  clicks,
  commissions,
  events,
  products,
  sales,
  signups,
  videos,
  type Destination,
  type Entry,
} from "@/db/schema";

export type Range = { from: Date; to: Date };

export function rangeFor(days: number, now = new Date()): Range {
  const to = new Date(now);
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

const ids = (list: string[]) => (list.length ? list : ["__none__"]);

export function summary(accountIds: string[], r: Range) {
  const a = ids(accountIds);

  const ev = db
    .select({
      visits: sql<number>`sum(case when ${events.type} = 'page_view' then 1 else 0 end)`,
      visitors: sql<number>`count(distinct case when ${events.type} = 'page_view' then ${events.visitorId} end)`,
      inApp: sql<number>`sum(case when ${events.type} = 'page_view' and ${events.device} = 'tiktok' then 1 else 0 end)`,
      productViews: sql<number>`sum(case when ${events.type} = 'product_view' then 1 else 0 end)`,
      searches: sql<number>`sum(case when ${events.type} = 'search' then 1 else 0 end)`,
      missed: sql<number>`sum(case when ${events.type} = 'search' and ${events.resultCount} = 0 then 1 else 0 end)`,
    })
    .from(events)
    .where(and(inArray(events.accountId, a), gte(events.createdAt, r.from), lt(events.createdAt, r.to)))
    .get();

  const cl = db
    .select({ destination: clicks.destination, n: sql<number>`count(*)` })
    .from(clicks)
    .where(
      and(
        inArray(clicks.accountId, a),
        eq(clicks.isBot, false),
        gte(clicks.createdAt, r.from),
        lt(clicks.createdAt, r.to),
      ),
    )
    .groupBy(clicks.destination)
    .all();

  const sa = db
    .select({
      orders: sql<number>`count(*)`,
      units: sql<number>`coalesce(sum(${sales.quantity}), 0)`,
      gmv: sql<number>`coalesce(sum(${sales.baseCents}), 0)`,
      refunded: sql<number>`coalesce(sum(${sales.refundedCents}), 0)`,
      commission: sql<number>`coalesce(sum(${commissions.amountCents}), 0)`,
      pending: sql<number>`coalesce(sum(case when ${commissions.status} = 'pending' then ${commissions.amountCents} else 0 end), 0)`,
    })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .where(and(inArray(sales.accountId, a), gte(sales.placedAt, r.from), lt(sales.placedAt, r.to)))
    .get();

  const byDest: Record<Destination, number> = { tiktok: 0, amazon: 0, brand: 0 };
  for (const c of cl) byDest[c.destination] = Number(c.n);
  const totalClicks = byDest.tiktok + byDest.amazon + byDest.brand;

  return {
    visits: Number(ev?.visits ?? 0),
    visitors: Number(ev?.visitors ?? 0),
    inApp: Number(ev?.inApp ?? 0),
    productViews: Number(ev?.productViews ?? 0),
    searches: Number(ev?.searches ?? 0),
    missedSearches: Number(ev?.missed ?? 0),
    clicks: totalClicks,
    clicksByDest: byDest,
    orders: Number(sa?.orders ?? 0),
    units: Number(sa?.units ?? 0),
    gmvCents: Number(sa?.gmv ?? 0),
    refundedCents: Number(sa?.refunded ?? 0),
    commissionCents: Number(sa?.commission ?? 0),
    pendingCents: Number(sa?.pending ?? 0),
  };
}

export type DayRow = { day: string; visits: number; clicks: number; orders: number; commissionCents: number };

export function daily(accountIds: string[], r: Range): DayRow[] {
  const a = ids(accountIds);
  const dayOf = (col: unknown) => sql<string>`date(${col} / 1000, 'unixepoch')`;

  const visits = db
    .select({ day: dayOf(events.createdAt), n: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        inArray(events.accountId, a),
        eq(events.type, "page_view"),
        gte(events.createdAt, r.from),
        lt(events.createdAt, r.to),
      ),
    )
    .groupBy(sql`1`)
    .all();

  const cl = db
    .select({ day: dayOf(clicks.createdAt), n: sql<number>`count(*)` })
    .from(clicks)
    .where(
      and(inArray(clicks.accountId, a), eq(clicks.isBot, false), gte(clicks.createdAt, r.from), lt(clicks.createdAt, r.to)),
    )
    .groupBy(sql`1`)
    .all();

  const sa = db
    .select({
      day: dayOf(sales.placedAt),
      n: sql<number>`count(*)`,
      c: sql<number>`coalesce(sum(${commissions.amountCents}), 0)`,
    })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .where(and(inArray(sales.accountId, a), gte(sales.placedAt, r.from), lt(sales.placedAt, r.to)))
    .groupBy(sql`1`)
    .all();

  const rows = new Map<string, DayRow>();
  const start = new Date(Date.UTC(r.from.getUTCFullYear(), r.from.getUTCMonth(), r.from.getUTCDate()));
  for (let d = start; d < r.to; d = new Date(d.getTime() + 86_400_000)) {
    const day = d.toISOString().slice(0, 10);
    rows.set(day, { day, visits: 0, clicks: 0, orders: 0, commissionCents: 0 });
  }
  for (const v of visits) if (rows.has(v.day)) rows.get(v.day)!.visits = Number(v.n);
  for (const c of cl) if (rows.has(c.day)) rows.get(c.day)!.clicks = Number(c.n);
  for (const s of sa) {
    const row = rows.get(s.day);
    if (row) {
      row.orders = Number(s.n);
      row.commissionCents = Number(s.c);
    }
  }
  return [...rows.values()];
}

export type ProductStats = {
  id: string;
  accountId: string;
  number: number;
  name: string;
  imageUrl: string | null;
  status: string;
  views: number;
  clicks: Record<Destination, number>;
  orders: number;
  commissionCents: number;
  waiting: number;
};

export function productStats(accountIds: string[], r: Range): ProductStats[] {
  const a = ids(accountIds);
  const list = db
    .select()
    .from(products)
    .where(inArray(products.accountId, a))
    .orderBy(desc(products.number))
    .all();

  const views = db
    .select({ id: events.productId, n: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        inArray(events.accountId, a),
        eq(events.type, "product_view"),
        gte(events.createdAt, r.from),
        lt(events.createdAt, r.to),
      ),
    )
    .groupBy(events.productId)
    .all();

  const cl = db
    .select({ id: clicks.productId, d: clicks.destination, n: sql<number>`count(*)` })
    .from(clicks)
    .where(
      and(inArray(clicks.accountId, a), eq(clicks.isBot, false), gte(clicks.createdAt, r.from), lt(clicks.createdAt, r.to)),
    )
    .groupBy(clicks.productId, clicks.destination)
    .all();

  const sa = db
    .select({
      id: sales.productId,
      n: sql<number>`count(*)`,
      c: sql<number>`coalesce(sum(${commissions.amountCents}), 0)`,
    })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .where(and(inArray(sales.accountId, a), gte(sales.placedAt, r.from), lt(sales.placedAt, r.to)))
    .groupBy(sales.productId)
    .all();

  const waiting = db
    .select({ id: signups.productId, n: sql<number>`count(*)` })
    .from(signups)
    .where(and(inArray(signups.accountId, a), eq(signups.status, "waiting")))
    .groupBy(signups.productId)
    .all();

  const viewMap = new Map(views.map((v) => [v.id, Number(v.n)]));
  const saleMap = new Map(sa.map((s) => [s.id, { n: Number(s.n), c: Number(s.c) }]));
  const waitMap = new Map(waiting.map((w) => [w.id, Number(w.n)]));
  const clickMap = new Map<string, Record<Destination, number>>();
  for (const c of cl) {
    const row = clickMap.get(c.id) ?? { tiktok: 0, amazon: 0, brand: 0 };
    row[c.d] = Number(c.n);
    clickMap.set(c.id, row);
  }

  return list.map((p) => ({
    id: p.id,
    accountId: p.accountId,
    number: p.number,
    name: p.name,
    imageUrl: p.imageUrl,
    status: p.status,
    views: viewMap.get(p.id) ?? 0,
    clicks: clickMap.get(p.id) ?? { tiktok: 0, amazon: 0, brand: 0 },
    orders: saleMap.get(p.id)?.n ?? 0,
    commissionCents: saleMap.get(p.id)?.c ?? 0,
    waiting: waitMap.get(p.id) ?? 0,
  }));
}

export function byEntry(accountIds: string[], r: Range) {
  const a = ids(accountIds);
  const cl = db
    .select({ entry: clicks.entry, n: sql<number>`count(*)` })
    .from(clicks)
    .where(
      and(inArray(clicks.accountId, a), eq(clicks.isBot, false), gte(clicks.createdAt, r.from), lt(clicks.createdAt, r.to)),
    )
    .groupBy(clicks.entry)
    .all();

  const sa = db
    .select({
      entry: clicks.entry,
      n: sql<number>`count(*)`,
      c: sql<number>`coalesce(sum(${commissions.amountCents}), 0)`,
    })
    .from(sales)
    .innerJoin(clicks, eq(clicks.id, sales.clickId))
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .where(and(inArray(sales.accountId, a), gte(sales.placedAt, r.from), lt(sales.placedAt, r.to)))
    .groupBy(clicks.entry)
    .all();

  const out = new Map<Entry, { clicks: number; orders: number; commissionCents: number }>();
  for (const c of cl) out.set(c.entry, { clicks: Number(c.n), orders: 0, commissionCents: 0 });
  for (const s of sa) {
    const row = out.get(s.entry) ?? { clicks: 0, orders: 0, commissionCents: 0 };
    row.orders = Number(s.n);
    row.commissionCents = Number(s.c);
    out.set(s.entry, row);
  }
  return out;
}

/** Sales that came through a video whose TikTok basket link was pulled. */
export function caughtFromPulledVideos(accountIds: string[], r: Range) {
  const row = db
    .select({
      n: sql<number>`count(*)`,
      c: sql<number>`coalesce(sum(${commissions.amountCents}), 0)`,
    })
    .from(sales)
    .innerJoin(clicks, eq(clicks.id, sales.clickId))
    .innerJoin(videos, eq(videos.id, clicks.videoId))
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .where(
      and(
        inArray(sales.accountId, ids(accountIds)),
        eq(videos.basket, "pulled"),
        gte(sales.placedAt, r.from),
        lt(sales.placedAt, r.to),
      ),
    )
    .get();
  return { orders: Number(row?.n ?? 0), commissionCents: Number(row?.c ?? 0) };
}

export function missedSearches(accountIds: string[], r: Range, limit = 8) {
  return db
    .select({
      query: events.query,
      n: sql<number>`count(*)`,
      last: sql<number>`max(${events.createdAt})`,
    })
    .from(events)
    .where(
      and(
        inArray(events.accountId, ids(accountIds)),
        eq(events.type, "search"),
        eq(events.resultCount, 0),
        gte(events.createdAt, r.from),
        lt(events.createdAt, r.to),
      ),
    )
    .groupBy(events.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all()
    .map((m) => ({ query: m.query ?? "", count: Number(m.n), lastAt: new Date(Number(m.last)) }));
}

export type FeedItem =
  | { kind: "sale"; at: Date; id: string; number: number; name: string; destination: Destination; amountCents: number; receiptId: string; handle: string }
  | { kind: "click"; at: Date; id: string; number: number; name: string; destination: Destination; entry: Entry; handle: string }
  | { kind: "signup"; at: Date; id: string; number: number; name: string; handle: string }
  | { kind: "miss"; at: Date; id: string; query: string; handle: string };

export function feed(accountIds: string[], handles: Map<string, string>, limit = 14): FeedItem[] {
  const a = ids(accountIds);
  const recentSales = db
    .select({
      id: sales.id,
      at: sales.placedAt,
      accountId: sales.accountId,
      destination: sales.destination,
      receiptId: sales.receiptId,
      amount: commissions.amountCents,
      number: products.number,
      name: products.name,
    })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .where(inArray(sales.accountId, a))
    .orderBy(desc(sales.placedAt))
    .limit(limit)
    .all();

  const recentClicks = db
    .select({
      id: clicks.id,
      at: clicks.createdAt,
      accountId: clicks.accountId,
      destination: clicks.destination,
      entry: clicks.entry,
      number: products.number,
      name: products.name,
    })
    .from(clicks)
    .innerJoin(products, eq(products.id, clicks.productId))
    .where(and(inArray(clicks.accountId, a), eq(clicks.isBot, false)))
    .orderBy(desc(clicks.createdAt))
    .limit(limit)
    .all();

  const recentSignups = db
    .select({
      id: signups.id,
      at: signups.createdAt,
      accountId: signups.accountId,
      number: products.number,
      name: products.name,
    })
    .from(signups)
    .innerJoin(products, eq(products.id, signups.productId))
    .where(inArray(signups.accountId, a))
    .orderBy(desc(signups.createdAt))
    .limit(limit)
    .all();

  const misses = db
    .select({ id: events.id, at: events.createdAt, accountId: events.accountId, query: events.query })
    .from(events)
    .where(and(inArray(events.accountId, a), eq(events.type, "search"), eq(events.resultCount, 0)))
    .orderBy(desc(events.createdAt))
    .limit(limit)
    .all();

  const h = (id: string) => handles.get(id) ?? "";
  const items: FeedItem[] = [
    ...recentSales.map((s) => ({
      kind: "sale" as const,
      at: s.at,
      id: s.id,
      number: s.number,
      name: s.name,
      destination: s.destination,
      amountCents: s.amount,
      receiptId: s.receiptId,
      handle: h(s.accountId),
    })),
    ...recentClicks.map((c) => ({
      kind: "click" as const,
      at: c.at,
      id: c.id,
      number: c.number,
      name: c.name,
      destination: c.destination,
      entry: c.entry,
      handle: h(c.accountId),
    })),
    ...recentSignups.map((s) => ({
      kind: "signup" as const,
      at: s.at,
      id: s.id,
      number: s.number,
      name: s.name,
      handle: h(s.accountId),
    })),
    ...misses.map((m) => ({
      kind: "miss" as const,
      at: m.at,
      id: String(m.id),
      query: m.query ?? "",
      handle: h(m.accountId),
    })),
  ];
  return items.sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, limit);
}
