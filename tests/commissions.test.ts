import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { commissions, ledger, sales } from "@/db/schema";
import {
  amountAfterRefund,
  applyRefund,
  clearCommission,
  markDelivered,
  pickRule,
  settleDue,
} from "@/server/commissions";
import { balancesFor } from "@/server/ledger";
import { attributeOrder } from "@/server/tracking";
import { click, makeCreator, makeProduct } from "./helpers";

const DAY = 86_400_000;

function order(clickId: string, opts: { qty?: number; price?: number; discount?: number; at?: Date; id?: string } = {}) {
  const r = attributeOrder({
    destination: "tiktok",
    clickId,
    networkOrderId: opts.id ?? `o-${Math.random()}`,
    quantity: opts.qty ?? 1,
    unitPriceCents: opts.price ?? 2000,
    discountCents: opts.discount ?? 0,
    at: opts.at ?? new Date(),
  });
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe("pickRule", () => {
  const rules = [
    { rateBps: 1200, minMonthlyUnits: 0 },
    { rateBps: 1500, minMonthlyUnits: 50 },
    { rateBps: 1800, minMonthlyUnits: 200 },
  ];

  it("uses the highest tier already reached", () => {
    expect(pickRule(rules, 0)?.rateBps).toBe(1200);
    expect(pickRule(rules, 49)?.rateBps).toBe(1200);
    expect(pickRule(rules, 50)?.rateBps).toBe(1500);
    expect(pickRule(rules, 999)?.rateBps).toBe(1800);
  });

  it("returns null when nothing applies", () => {
    expect(pickRule([], 10)).toBeNull();
    expect(pickRule([{ rateBps: 1000, minMonthlyUnits: 5 }], 2)).toBeNull();
  });
});

describe("amountAfterRefund", () => {
  it("cuts the commission pro rata", () => {
    expect(amountAfterRefund(300, 2000, 0)).toBe(300);
    expect(amountAfterRefund(300, 2000, 1000)).toBe(150);
    expect(amountAfterRefund(300, 2000, 2000)).toBe(0);
    expect(amountAfterRefund(300, 2000, 5000)).toBe(0);
  });
});

describe("recording a sale", () => {
  it("pays the rate on items after discount, into pending", () => {
    const { userId, accountId } = makeCreator();
    const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 1500, minMonthlyUnits: 0 }]);
    const r = order(click(accountId, p.id), { qty: 2, price: 1499, discount: 300 });

    // (2 x 14.99 - 3.00) x 15% = 4.047 -> 4.05
    expect(r.amountCents).toBe(405);
    expect(balancesFor(userId)).toEqual({ pending: 405, available: 0, locked: 0, paid: 0 });
  });

  it("moves to the bonus tier once the month's units pass the line", () => {
    const { accountId } = makeCreator();
    const p = makeProduct(accountId, [
      { destination: "tiktok", rateBps: 1000, minMonthlyUnits: 0 },
      { destination: "tiktok", rateBps: 2000, minMonthlyUnits: 3 },
    ]);
    const now = new Date();
    const at = (i: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 10, i));

    expect(order(click(accountId, p.id, "tiktok", at(0)), { qty: 2, at: at(1) }).rateBps).toBe(1000);
    // 2 units so far, still under 3
    expect(order(click(accountId, p.id, "tiktok", at(2)), { qty: 1, at: at(3) }).rateBps).toBe(1000);
    // 3 units so far, this one gets the bonus
    expect(order(click(accountId, p.id, "tiktok", at(4)), { qty: 1, at: at(5) }).rateBps).toBe(2000);
  });
});

describe("refunds and clearing", () => {
  it("partial refund before clearing reduces pending", () => {
    const { userId, accountId } = makeCreator();
    const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 1000, minMonthlyUnits: 0 }]);
    const r = order(click(accountId, p.id), { price: 4000 });
    expect(r.amountCents).toBe(400);

    applyRefund(r.saleId, 1000, new Date());
    expect(balancesFor(userId).pending).toBe(300);

    applyRefund(r.saleId, 3000, new Date());
    expect(balancesFor(userId).pending).toBe(0);
    const c = db.select().from(commissions).where(eq(commissions.saleId, r.saleId)).get()!;
    expect(c.status).toBe("reversed");
    const s = db.select().from(sales).where(eq(sales.id, r.saleId)).get()!;
    expect(s.status).toBe("refunded");
  });

  it("clears after delivery plus the hold, then claws back a late refund", () => {
    const { userId, accountId } = makeCreator();
    const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 1000, minMonthlyUnits: 0 }]);
    const placed = new Date(Date.now() - 40 * DAY);
    const r = order(click(accountId, p.id, "tiktok", placed), { price: 5000, at: placed });

    markDelivered(r.saleId, new Date(placed.getTime() + 4 * DAY));
    expect(settleDue(new Date(placed.getTime() + 10 * DAY))).toBe(0);
    expect(settleDue()).toBe(1);
    expect(balancesFor(userId)).toMatchObject({ pending: 0, available: 500 });

    applyRefund(r.saleId, 5000, new Date());
    expect(balancesFor(userId).available).toBe(0);
    const kinds = db.select({ k: ledger.kind }).from(ledger).where(eq(ledger.saleId, r.saleId)).all();
    expect(kinds.map((k) => k.k)).toContain("clawback");
  });

  it("never clears twice", () => {
    const { userId, accountId } = makeCreator();
    const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 1000, minMonthlyUnits: 0 }]);
    const r = order(click(accountId, p.id), { price: 1000 });
    const c = db.select().from(commissions).where(eq(commissions.saleId, r.saleId)).get()!;
    expect(clearCommission(c.id, new Date())).toBe(true);
    expect(clearCommission(c.id, new Date())).toBe(false);
    expect(balancesFor(userId).available).toBe(100);
  });
});

describe("ledger", () => {
  it("always equals the sum of commissions", () => {
    const total = db.select({ t: sql<number>`sum(amount_cents)` }).from(ledger).get()!.t;
    const owed = db.select({ t: sql<number>`sum(amount_cents)` }).from(commissions).get()!.t;
    expect(Number(total)).toBe(Number(owed));
  });
});
