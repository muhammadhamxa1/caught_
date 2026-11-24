import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, sales } from "@/db/schema";
import { config } from "@/lib/config";
import { balancesFor } from "@/server/ledger";
import { sign, verify } from "@/server/signing";
import { handleWebhook } from "@/server/webhooks";
import { click, makeCreator, makeProduct } from "./helpers";

function send(source: "tiktok" | "amazon" | "brand", body: object, secret = config.secrets[source]) {
  const raw = JSON.stringify(body);
  return handleWebhook(source, raw, sign(secret, raw));
}

describe("signatures", () => {
  it("accepts a fresh valid signature and refuses the rest", () => {
    const body = '{"a":1}';
    expect(verify("s", body, sign("s", body)).ok).toBe(true);
    expect(verify("s", body, sign("other", body)).ok).toBe(false);
    expect(verify("s", '{"a":2}', sign("s", body)).ok).toBe(false);
    const old = sign("s", body, Date.now() - 10 * 60 * 1000);
    expect(verify("s", body, old)).toMatchObject({ ok: false, reason: "Signature timestamp too old" });
  });

  it("rejects unsigned webhooks with 401", () => {
    expect(handleWebhook("tiktok", "{}", null).status).toBe(401);
  });
});

describe("TikTok Shop order flow", () => {
  const { userId, accountId } = makeCreator();
  const p = makeProduct(accountId, [{ destination: "tiktok", rateBps: 1500, minMonthlyUnits: 0 }]);
  const cid = click(accountId, p.id);
  const ts = Math.floor(Date.now() / 1000);

  it("records an order once, even when the event is sent twice", () => {
    const created = {
      event_id: "evt_1",
      type: "ORDER_CREATED",
      timestamp: ts,
      data: { order_id: "576001", affiliate_click_id: cid, quantity: 1, unit_price: "20.00", seller_discount: "0.00" },
    };
    expect(send("tiktok", created).body).toMatchObject({ status: "processed" });
    expect(send("tiktok", created).body).toMatchObject({ duplicate: true });
    expect(balancesFor(userId).pending).toBe(300);
  });

  it("clears on completion and handles a refund after that", () => {
    send("tiktok", { event_id: "evt_2", type: "ORDER_DELIVERED", timestamp: ts, data: { order_id: "576001" } });
    send("tiktok", { event_id: "evt_3", type: "ORDER_COMPLETED", timestamp: ts, data: { order_id: "576001" } });
    expect(balancesFor(userId)).toMatchObject({ pending: 0, available: 300 });

    send("tiktok", { event_id: "evt_4", type: "ORDER_REFUNDED", timestamp: ts, data: { order_id: "576001", refund_amount: "10.00" } });
    expect(balancesFor(userId).available).toBe(150);
    const s = db.select().from(sales).where(eq(sales.networkOrderId, "576001")).get()!;
    expect(s.refundedCents).toBe(1000);
  });

  it("logs bad payloads without throwing", () => {
    expect(send("tiktok", { event_id: "x", type: "ORDER_CREATED", timestamp: ts, data: {} }).status).toBe(400);
  });
});

describe("stock sync", () => {
  it("marks a linked product sold out and picks a backup", () => {
    const { accountId } = makeCreator();
    const sold = makeProduct(accountId, []);
    const other = makeProduct(accountId, []);
    db.update(products).set({ catalogId: "999" }).where(eq(products.id, sold.id)).run();

    send("tiktok", {
      event_id: "stock_1",
      type: "PRODUCT_STOCK_CHANGED",
      timestamp: Math.floor(Date.now() / 1000),
      data: { product_id: "999", in_stock: false },
    });
    const after = db.select().from(products).where(eq(products.id, sold.id)).get()!;
    expect(after.status).toBe("sold_out");
    expect(after.backupProductId).toBe(other.id);
  });
});

describe("other networks", () => {
  it("reads Amazon and brand payloads through their adapters", () => {
    const { userId, accountId } = makeCreator();
    const p = makeProduct(accountId, [
      { destination: "amazon", rateBps: 400, minMonthlyUnits: 0 },
      { destination: "brand", rateBps: 2000, minMonthlyUnits: 0 },
    ]);
    send("amazon", {
      id: "a1",
      event: "order.placed",
      created_at: new Date().toISOString(),
      order: { id: "112-1", ascsubtag: click(accountId, p.id, "amazon"), quantity: 1, item_price_cents: 2500 },
    });
    send("brand", {
      id: "b1",
      type: "conversion",
      occurred_at: new Date().toISOString(),
      order_ref: "BR-1",
      subid: click(accountId, p.id, "brand"),
      sale_amount: "25.00",
    });
    // 4% of 25 + 20% of 25
    expect(balancesFor(userId).pending).toBe(100 + 500);
  });
});
