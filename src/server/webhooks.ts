import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { DESTINATIONS, payouts, products, sales, webhookLog, type Destination } from "@/db/schema";
import { config } from "@/lib/config";
import { money } from "@/lib/money";
import { adapters, payoutEventSchema, type NetworkEvent } from "./adapters";
import { applyRefund, markCompleted, markDelivered, markShipped } from "./commissions";
import { movePayout } from "./payouts";
import { markInStock, markSoldOut } from "./products";
import { verify } from "./signing";
import { attributeOrder } from "./tracking";

export type WebhookSource = Destination | "payouts";

export function isWebhookSource(s: string): s is WebhookSource {
  return s === "payouts" || (DESTINATIONS as readonly string[]).includes(s);
}

type LogStatus = (typeof webhookLog.$inferInsert)["status"];

function log(
  source: WebhookSource,
  status: LogStatus,
  payload: string,
  detail: string,
  eventId: string | null = null,
  type: string | null = null,
) {
  db.insert(webhookLog)
    .values({ source, eventId, type, status, detail, payload: payload.slice(0, 4000), receivedAt: new Date() })
    .run();
}

function alreadyHandled(source: WebhookSource, eventId: string) {
  return Boolean(
    db
      .select({ id: webhookLog.id })
      .from(webhookLog)
      .where(
        and(
          eq(webhookLog.source, source),
          eq(webhookLog.eventId, eventId),
          inArray(webhookLog.status, ["processed", "ignored"]),
        ),
      )
      .get(),
  );
}

type Outcome = { status: "processed" | "ignored"; detail: string };

function findSale(destination: Destination, orderId: string) {
  return db
    .select()
    .from(sales)
    .where(and(eq(sales.destination, destination), eq(sales.networkOrderId, orderId)))
    .get();
}

export function applyNetworkEvent(destination: Destination, e: NetworkEvent): Outcome {
  if (e.kind === "order.placed") {
    const r = attributeOrder({
      destination,
      clickId: e.clickId,
      networkOrderId: e.orderId,
      quantity: e.quantity,
      unitPriceCents: e.unitPriceCents,
      discountCents: e.discountCents,
      at: e.at,
    });
    return r.ok
      ? { status: "processed", detail: `Caught ${money(r.amountCents)} on order ${e.orderId}` }
      : { status: "ignored", detail: r.reason };
  }

  if (e.kind === "product.stock") {
    const linked = db.select().from(products).where(eq(products.catalogId, e.catalogId)).all();
    if (linked.length === 0) return { status: "ignored", detail: "No product linked to that listing" };
    for (const p of linked) {
      if (p.status === "archived") continue;
      if (!e.inStock && p.status === "active") markSoldOut(p.id, p.backupProductId, e.at);
      if (e.inStock && p.status === "sold_out") markInStock(p.id, e.at);
    }
    return {
      status: "processed",
      detail: `${linked.length} product(s) marked ${e.inStock ? "in stock" : "sold out"}`,
    };
  }

  const sale = findSale(destination, e.orderId);
  if (!sale) return { status: "ignored", detail: `Unknown order ${e.orderId}` };

  switch (e.kind) {
    case "order.shipped":
      return markShipped(sale.id, e.at)
        ? { status: "processed", detail: "Marked shipped" }
        : { status: "ignored", detail: `Order is already ${sale.status}` };
    case "order.delivered":
      return markDelivered(sale.id, e.at)
        ? { status: "processed", detail: "Delivered, return window started" }
        : { status: "ignored", detail: `Order is already ${sale.status}` };
    case "order.completed":
      return markCompleted(sale.id, e.at)
        ? { status: "processed", detail: "Completed, commission cleared" }
        : { status: "ignored", detail: `Order is already ${sale.status}` };
    case "order.refunded": {
      const r = applyRefund(sale.id, e.amountCents, e.at);
      return r
        ? { status: "processed", detail: `Refund deducted ${money(r.deductedCents)} commission` }
        : { status: "ignored", detail: "Nothing left to refund" };
    }
  }
}

function applyPayoutEvent(body: unknown): Outcome & { eventId: string; type: string } {
  const e = payoutEventSchema.parse(body);
  const p = db.select().from(payouts).where(eq(payouts.ref, e.data.payout_ref)).get();
  if (!p) return { eventId: e.id, type: e.type, status: "ignored", detail: "Unknown payout" };

  const r =
    e.type === "payout.paid"
      ? movePayout(p.id, "paid", { providerRef: e.data.provider_ref, at: new Date(e.created_at) })
      : movePayout(p.id, "failed", { note: e.data.failure_reason ?? "Payment failed", at: new Date(e.created_at) });

  return r.ok
    ? { eventId: e.id, type: e.type, status: "processed", detail: `${p.ref} marked ${e.type === "payout.paid" ? "paid" : "failed"}` }
    : { eventId: e.id, type: e.type, status: "ignored", detail: r.error };
}

/**
 * One entry point for every incoming webhook: check the signature, turn the
 * payload into our event shape, skip it if we've seen that event id before,
 * apply it, and log what happened. Duplicates return 200 so the sender stops
 * retrying.
 */
export function handleWebhook(source: WebhookSource, rawBody: string, signature: string | null) {
  const check = verify(config.secrets[source], rawBody, signature);
  if (!check.ok) {
    log(source, "rejected", rawBody, check.reason);
    return { status: 401, body: { error: check.reason } };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    log(source, "failed", rawBody, "Body is not JSON");
    return { status: 400, body: { error: "Body is not JSON" } };
  }

  try {
    if (source === "payouts") {
      const peek = payoutEventSchema.safeParse(json);
      if (peek.success && alreadyHandled(source, peek.data.id)) {
        log(source, "duplicate", rawBody, "Already handled", peek.data.id, peek.data.type);
        return { status: 200, body: { duplicate: true } };
      }
      const r = applyPayoutEvent(json);
      log(source, r.status, rawBody, r.detail, r.eventId, r.type);
      return { status: 200, body: { status: r.status, detail: r.detail } };
    }

    const event = adapters[source](json);
    if (alreadyHandled(source, event.eventId)) {
      log(source, "duplicate", rawBody, "Already handled", event.eventId, event.kind);
      return { status: 200, body: { duplicate: true } };
    }
    const r = applyNetworkEvent(source, event);
    log(source, r.status, rawBody, r.detail, event.eventId, event.kind);
    return { status: 200, body: { status: r.status, detail: r.detail } };
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 300) : "Could not process event";
    log(source, "failed", rawBody, detail);
    return { status: 400, body: { error: "Could not process event" } };
  }
}
