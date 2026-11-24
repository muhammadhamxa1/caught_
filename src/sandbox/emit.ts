import type { Destination } from "@/db/schema";
import { config } from "@/lib/config";
import { newId, publicId } from "@/lib/ids";
import { sign, SIGNATURE_HEADER } from "@/server/signing";
import { handleWebhook, type WebhookSource } from "@/server/webhooks";

// The sandbox plays the part of TikTok Shop, Amazon, the brand networks and
// the payout provider. It builds each one's payload, signs it with that
// sender's secret and posts it to our real webhook endpoint, so the code
// path is the same one production traffic would take.

export type OrderStep = "placed" | "shipped" | "delivered" | "completed" | "refunded";

type OrderFacts = {
  orderId: string;
  clickId?: string | null;
  quantity?: number;
  unitPriceCents?: number;
  discountCents?: number;
  refundCents?: number;
};

const dollars = (cents = 0) => (cents / 100).toFixed(2);

export function orderPayload(network: Destination, step: OrderStep, o: OrderFacts, at = new Date()) {
  if (network === "tiktok") {
    const type = {
      placed: "ORDER_CREATED",
      shipped: "ORDER_SHIPPED",
      delivered: "ORDER_DELIVERED",
      completed: "ORDER_COMPLETED",
      refunded: "ORDER_REFUNDED",
    }[step];
    return {
      event_id: `tts_${newId()}`,
      type,
      timestamp: Math.floor(at.getTime() / 1000),
      data: {
        order_id: o.orderId,
        ...(step === "placed"
          ? {
              affiliate_click_id: o.clickId,
              quantity: o.quantity,
              unit_price: dollars(o.unitPriceCents),
              seller_discount: dollars(o.discountCents),
            }
          : {}),
        ...(step === "refunded" ? { refund_amount: dollars(o.refundCents) } : {}),
      },
    };
  }

  if (network === "amazon") {
    const event = {
      placed: "order.placed",
      shipped: "order.shipped",
      delivered: "order.delivered",
      completed: "order.closed",
      refunded: "order.returned",
    }[step];
    return {
      id: `amzn_${newId()}`,
      event,
      created_at: at.toISOString(),
      order: {
        id: o.orderId,
        ...(step === "placed"
          ? {
              ascsubtag: o.clickId,
              quantity: o.quantity,
              item_price_cents: o.unitPriceCents,
              discount_cents: o.discountCents ?? 0,
            }
          : {}),
        ...(step === "refunded" ? { refund_cents: o.refundCents } : {}),
      },
    };
  }

  const type = {
    placed: "conversion",
    shipped: "conversion.shipped",
    delivered: "conversion.delivered",
    completed: "conversion.locked",
    refunded: "conversion.reversed",
  }[step];
  return {
    id: `brd_${newId()}`,
    type,
    occurred_at: at.toISOString(),
    order_ref: o.orderId,
    ...(step === "placed"
      ? {
          subid: o.clickId,
          qty: o.quantity,
          sale_amount: dollars(o.unitPriceCents),
          discount: dollars(o.discountCents),
        }
      : {}),
    ...(step === "refunded" ? { reversed_amount: dollars(o.refundCents) } : {}),
  };
}

export function stockPayload(catalogId: string, inStock: boolean, at = new Date()) {
  return {
    event_id: `tts_${newId()}`,
    type: "PRODUCT_STOCK_CHANGED",
    timestamp: Math.floor(at.getTime() / 1000),
    data: { product_id: catalogId, in_stock: inStock },
  };
}

export function payoutPayload(payoutRef: string, outcome: "paid" | "failed", reason?: string) {
  return {
    id: `po_evt_${newId()}`,
    type: outcome === "paid" ? "payout.paid" : "payout.failed",
    created_at: new Date().toISOString(),
    data: {
      payout_ref: payoutRef,
      ...(outcome === "paid" ? { provider_ref: `PP-${publicId(10).toUpperCase()}` } : {}),
      ...(reason ? { failure_reason: reason } : {}),
    },
  };
}

export function newOrderId(network: Destination) {
  const digits = () => String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  if (network === "tiktok") return `5769${digits()}${digits()}`;
  if (network === "amazon") return `113-${digits()}-${digits()}`;
  return `BR-${publicId(8).toUpperCase()}`;
}

/**
 * Posts a signed webhook to our own endpoint at APP_URL. We never build
 * this URL from the request's Host header, so a forged header can't send a
 * signed payload somewhere else. If the call fails (wrong port in dev, or
 * the route is still compiling) the same signed body goes to the handler
 * directly.
 */
export async function deliver(source: WebhookSource, payload: object, origin?: string) {
  const body = JSON.stringify(payload);
  const signature = sign(config.secrets[source], body);

  if (origin) {
    try {
      const res = await fetch(`${origin}/api/webhooks/${source}`, {
        method: "POST",
        headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
        body,
        signal: AbortSignal.timeout(8000),
      });
      return { status: res.status, body: await res.json().catch(() => ({})) };
    } catch {
      // fall through to in-process delivery
    }
  }
  return handleWebhook(source, body, signature);
}
