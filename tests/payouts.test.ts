import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { commissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { clearCommission } from "@/server/commissions";
import { balancesFor } from "@/server/ledger";
import { movePayout, requestPayout, savePayoutMethod } from "@/server/payouts";
import { attributeOrder } from "@/server/tracking";
import { click, makeCreator, makeProduct } from "./helpers";

/** A creator with `cents` cleared and ready to cash out. */
function creatorWithBalance(cents: number, withMethod = true) {
  const { userId, accountId } = makeCreator();
  const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 10_000, minMonthlyUnits: 0 }], cents);
  const r = attributeOrder({
    destination: "tiktok",
    clickId: click(accountId, p.id),
    networkOrderId: `o-${Math.random()}`,
    quantity: 1,
    unitPriceCents: cents,
    discountCents: 0,
    at: new Date(),
  });
  if (!r.ok) throw new Error(r.reason);
  const c = db.select().from(commissions).where(eq(commissions.saleId, r.saleId)).get()!;
  clearCommission(c.id, new Date());
  if (withMethod) savePayoutMethod(userId, "paypal", "m••••a@gmail.com");
  return userId;
}

describe("payout requests", () => {
  it("checks the minimum, the method and the balance", () => {
    const noMethod = creatorWithBalance(10_000, false);
    expect(requestPayout(noMethod, 5000, "k1")).toMatchObject({ ok: false, error: "Add a payout method first." });

    const user = creatorWithBalance(10_000);
    expect(requestPayout(user, 1000, "k2")).toMatchObject({ ok: false });
    expect(requestPayout(user, 20_000, "k3")).toMatchObject({ ok: false, error: "You have $100.00 available." });
  });

  it("holds the money and allows one payout at a time", () => {
    const user = creatorWithBalance(10_000);
    const r = requestPayout(user, 6000, "a");
    expect(r.ok).toBe(true);
    expect(balancesFor(user)).toMatchObject({ available: 4000, locked: 6000 });
    expect(requestPayout(user, 3000, "b")).toMatchObject({ ok: false, error: "You already have a payout in progress." });
  });

  it("returns the same payout for a repeated idempotency key", () => {
    const user = creatorWithBalance(10_000);
    const first = requestPayout(user, 5000, "same");
    const again = requestPayout(user, 5000, "same");
    expect(first.ok && again.ok && first.payout.id === again.payout.id).toBe(true);
    expect(balancesFor(user).locked).toBe(5000);
  });

  it("moves through pending, approved, paid", () => {
    const user = creatorWithBalance(10_000);
    const r = requestPayout(user, 10_000, "p");
    if (!r.ok) throw new Error(r.error);
    expect(r.payout.status).toBe("pending");

    expect(movePayout(r.payout.id, "paid")).toMatchObject({ ok: false });
    expect(movePayout(r.payout.id, "approved").ok).toBe(true);
    expect(movePayout(r.payout.id, "paid", { providerRef: "pp_1" }).ok).toBe(true);
    expect(balancesFor(user)).toEqual({ pending: 0, available: 0, locked: 0, paid: 10_000 });
    expect(movePayout(r.payout.id, "failed")).toMatchObject({ ok: false });
  });

  it("gives the money back when a payout fails", () => {
    const user = creatorWithBalance(10_000);
    const r = requestPayout(user, 8000, "f");
    if (!r.ok) throw new Error(r.error);
    movePayout(r.payout.id, "approved");
    movePayout(r.payout.id, "failed", { note: "PayPal account can't receive funds" });
    expect(balancesFor(user)).toMatchObject({ available: 10_000, locked: 0 });
  });

  it("auto approves small payouts once a creator has been paid before", () => {
    const user = creatorWithBalance(20_000);
    const first = requestPayout(user, 5000, "x1");
    if (!first.ok) throw new Error(first.error);
    expect(first.payout.status).toBe("pending");
    movePayout(first.payout.id, "approved");
    movePayout(first.payout.id, "paid");

    const second = requestPayout(user, 5000, "x2");
    expect(second.ok && second.payout.status).toBe("approved");
  });
});
