import { and, eq, gte, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  commissionRules,
  commissions,
  products,
  sales,
  type Destination,
  type SaleStatus,
} from "@/db/schema";
import { newId, publicId } from "@/lib/ids";
import { applyRate, money } from "@/lib/money";
import { post } from "./ledger";
import { DAY_MS, NETWORKS } from "./networks";

export type Rule = { rateBps: number; minMonthlyUnits: number };

/**
 * Brands often pay more once a creator moves volume, for example 12% up to
 * 50 units a month and 15% after. We pick the highest tier already reached
 * before this order, so the order that crosses the line is still paid at the
 * old rate. That matches how TikTok Shop applies tiered plans.
 */
export function pickRule(rules: Rule[], unitsSoFar: number): Rule | null {
  let best: Rule | null = null;
  for (const r of rules) {
    if (unitsSoFar < r.minMonthlyUnits) continue;
    if (!best || r.minMonthlyUnits > best.minMonthlyUnits) best = r;
  }
  return best;
}

/** What is left of a commission after refunds. Refunds cut it pro rata. */
export function amountAfterRefund(
  grossCents: number,
  baseCents: number,
  refundedCents: number,
) {
  if (baseCents <= 0) return 0;
  const refunded = Math.min(Math.max(refundedCents, 0), baseCents);
  return Math.round((grossCents * (baseCents - refunded)) / baseCents);
}

/** Items after seller discounts. Tax and shipping never earn commission. */
export function commissionBase(qty: number, unitPriceCents: number, discountCents: number) {
  return Math.max(0, qty * unitPriceCents - discountCents);
}

function monthStart(at: Date) {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export function unitsThisMonth(
  accountId: string,
  productId: string,
  destination: Destination,
  at: Date,
) {
  const row = db
    .select({ units: sql<number>`coalesce(sum(${sales.quantity}), 0)` })
    .from(sales)
    .where(
      and(
        eq(sales.accountId, accountId),
        eq(sales.productId, productId),
        eq(sales.destination, destination),
        gte(sales.placedAt, monthStart(at)),
        lt(sales.placedAt, at),
        ne(sales.status, "refunded"),
      ),
    )
    .get();
  return Number(row?.units ?? 0);
}

export type NewSale = {
  accountId: string;
  userId: string;
  productId: string;
  clickId: string | null;
  destination: Destination;
  networkOrderId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  at: Date;
};

export function recordSale(input: NewSale) {
  return db.transaction(() => {
    const base = commissionBase(input.quantity, input.unitPriceCents, input.discountCents);
    const rules = db
      .select({
        rateBps: commissionRules.rateBps,
        minMonthlyUnits: commissionRules.minMonthlyUnits,
      })
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.productId, input.productId),
          eq(commissionRules.destination, input.destination),
        ),
      )
      .all();

    const units = unitsThisMonth(input.accountId, input.productId, input.destination, input.at);
    const rule = pickRule(rules, units);
    const rateBps = rule?.rateBps ?? 0;
    const gross = applyRate(base, rateBps);

    const saleId = newId();
    db.insert(sales)
      .values({
        id: saleId,
        receiptId: publicId(10),
        accountId: input.accountId,
        userId: input.userId,
        productId: input.productId,
        clickId: input.clickId,
        destination: input.destination,
        networkOrderId: input.networkOrderId,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        discountCents: input.discountCents,
        baseCents: base,
        placedAt: input.at,
      })
      .run();

    const commissionId = newId();
    db.insert(commissions)
      .values({
        id: commissionId,
        saleId,
        accountId: input.accountId,
        userId: input.userId,
        productId: input.productId,
        rateBps,
        tierUnits: rule?.minMonthlyUnits ?? 0,
        grossCents: gross,
        amountCents: gross,
        createdAt: input.at,
      })
      .run();

    post(
      {
        userId: input.userId,
        accountId: input.accountId,
        kind: "earned",
        saleId,
        memo: `${NETWORKS[input.destination].label} order ${input.networkOrderId}`,
        at: input.at,
      },
      [{ bucket: "pending", amountCents: gross }],
    );

    return { saleId, commissionId, rateBps, amountCents: gross, baseCents: base };
  });
}

const STEP: Record<SaleStatus, number> = {
  placed: 0,
  shipped: 1,
  delivered: 2,
  completed: 3,
  refunded: 4,
};

function loadSale(saleId: string) {
  const sale = db.select().from(sales).where(eq(sales.id, saleId)).get();
  if (!sale) throw new Error(`Unknown sale ${saleId}`);
  return sale;
}

function loadCommission(saleId: string) {
  return db.select().from(commissions).where(eq(commissions.saleId, saleId)).get();
}

/** Status only ever moves forward. Late or replayed events are ignored. */
function canMove(from: SaleStatus, to: SaleStatus) {
  return from !== "refunded" && STEP[to] > STEP[from];
}

export function markShipped(saleId: string, at: Date) {
  const sale = loadSale(saleId);
  if (!canMove(sale.status, "shipped")) return false;
  db.update(sales).set({ status: "shipped", shippedAt: at }).where(eq(sales.id, saleId)).run();
  return true;
}

export function markDelivered(saleId: string, at: Date) {
  return db.transaction(() => {
    const sale = loadSale(saleId);
    if (!canMove(sale.status, "delivered")) return false;
    db.update(sales)
      .set({ status: "delivered", deliveredAt: at, shippedAt: sale.shippedAt ?? at })
      .where(eq(sales.id, saleId))
      .run();

    // The return window starts at delivery. The commission clears after it,
    // unless the network tells us earlier that the order is complete.
    const clearsAt = new Date(at.getTime() + NETWORKS[sale.destination].holdDays * DAY_MS);
    db.update(commissions)
      .set({ clearsAt })
      .where(and(eq(commissions.saleId, saleId), eq(commissions.status, "pending")))
      .run();
    return true;
  });
}

export function markCompleted(saleId: string, at: Date) {
  return db.transaction(() => {
    const sale = loadSale(saleId);
    if (!canMove(sale.status, "completed")) return false;
    db.update(sales)
      .set({
        status: "completed",
        completedAt: at,
        deliveredAt: sale.deliveredAt ?? at,
        shippedAt: sale.shippedAt ?? at,
      })
      .where(eq(sales.id, saleId))
      .run();

    const c = loadCommission(saleId);
    if (c && c.status === "pending") clearCommission(c.id, at);
    return true;
  });
}

export function clearCommission(commissionId: string, at: Date) {
  return db.transaction(() => {
    const c = db.select().from(commissions).where(eq(commissions.id, commissionId)).get();
    if (!c || c.status !== "pending") return false;

    db.update(commissions)
      .set({ status: "cleared", clearedAt: at })
      .where(eq(commissions.id, commissionId))
      .run();

    post(
      {
        userId: c.userId,
        accountId: c.accountId,
        kind: "cleared",
        saleId: c.saleId,
        memo: "Return window closed",
        at,
      },
      [
        { bucket: "pending", amountCents: -c.amountCents },
        { bucket: "available", amountCents: c.amountCents },
      ],
    );
    return true;
  });
}

/**
 * Refund amounts are per event and add up. Before the commission clears we
 * reduce the pending amount. After it clears the money is already available,
 * so we claw it back from the available balance. That can go negative, and
 * future earnings pay it off before the creator can cash out again.
 */
export function applyRefund(saleId: string, refundCents: number, at: Date) {
  return db.transaction(() => {
    const sale = loadSale(saleId);
    const c = loadCommission(saleId);
    if (refundCents <= 0 || sale.refundedCents >= sale.baseCents) return null;

    const refunded = Math.min(sale.baseCents, sale.refundedCents + refundCents);
    const fullyRefunded = refunded >= sale.baseCents;

    db.update(sales)
      .set({ refundedCents: refunded, ...(fullyRefunded ? { status: "refunded" as const } : {}) })
      .where(eq(sales.id, saleId))
      .run();

    if (!c || c.status === "reversed") return { deductedCents: 0, fullyRefunded };

    const newAmount = amountAfterRefund(c.grossCents, sale.baseCents, refunded);
    const deducted = c.amountCents - newAmount;

    db.update(commissions)
      .set({ amountCents: newAmount, ...(fullyRefunded ? { status: "reversed" as const } : {}) })
      .where(eq(commissions.id, c.id))
      .run();

    if (deducted > 0) {
      const cleared = c.status === "cleared";
      post(
        {
          userId: c.userId,
          accountId: c.accountId,
          kind: cleared ? "clawback" : "refund",
          saleId,
          memo: `Refund of ${money(refundCents)} on order ${sale.networkOrderId}`,
          at,
        },
        [{ bucket: cleared ? "available" : "pending", amountCents: -deducted }],
      );
    }
    return { deductedCents: deducted, fullyRefunded };
  });
}

/**
 * Clears every pending commission whose return window has passed.
 * Runs on dashboard load here. In production this is a cron job.
 */
export function settleDue(now = new Date()) {
  const due = db
    .select({ id: commissions.id, clearsAt: commissions.clearsAt })
    .from(commissions)
    .where(and(eq(commissions.status, "pending"), lte(commissions.clearsAt, now)))
    .all();
  for (const c of due) clearCommission(c.id, c.clearsAt ?? now);
  return due.length;
}

export function rulesFor(productId: string) {
  return db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.productId, productId))
    .orderBy(commissionRules.destination, commissionRules.minMonthlyUnits)
    .all();
}

export function productForSale(saleId: string) {
  return db
    .select({ product: products, sale: sales })
    .from(sales)
    .innerJoin(products, eq(products.id, sales.productId))
    .where(eq(sales.id, saleId))
    .get();
}
