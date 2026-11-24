import { z } from "zod";
import type { Destination } from "@/db/schema";
import { parseMoney } from "@/lib/money";

// Every network reports orders in its own shape. These adapters turn each one
// into the same small set of events so the rest of the code never cares
// where an order came from. Adding a network means adding one adapter.

export type NetworkEvent =
  | {
      kind: "order.placed";
      eventId: string;
      orderId: string;
      clickId: string | null;
      quantity: number;
      unitPriceCents: number;
      discountCents: number;
      at: Date;
    }
  | {
      kind: "order.shipped" | "order.delivered" | "order.completed";
      eventId: string;
      orderId: string;
      at: Date;
    }
  | { kind: "order.refunded"; eventId: string; orderId: string; amountCents: number; at: Date }
  | { kind: "product.stock"; eventId: string; catalogId: string; inStock: boolean; at: Date };

const cents = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const parsed = typeof v === "number" ? Math.round(v * 100) : parseMoney(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Invalid amount" });
      return z.NEVER;
    }
    return parsed;
  });

// TikTok Shop sends amounts as decimal strings and unix seconds.
const tiktokSchema = z.object({
  event_id: z.string().min(1),
  type: z.enum([
    "ORDER_CREATED",
    "ORDER_SHIPPED",
    "ORDER_DELIVERED",
    "ORDER_COMPLETED",
    "ORDER_REFUNDED",
    "PRODUCT_STOCK_CHANGED",
  ]),
  timestamp: z.number().int(),
  data: z.object({
    order_id: z.string().optional(),
    affiliate_click_id: z.string().nullish(),
    quantity: z.number().int().positive().optional(),
    unit_price: cents.optional(),
    seller_discount: cents.optional(),
    refund_amount: cents.optional(),
    product_id: z.string().optional(),
    in_stock: z.boolean().optional(),
  }),
});

function fromTikTok(body: unknown): NetworkEvent {
  const e = tiktokSchema.parse(body);
  const at = new Date(e.timestamp * 1000);
  const d = e.data;
  switch (e.type) {
    case "ORDER_CREATED":
      return {
        kind: "order.placed",
        eventId: e.event_id,
        orderId: need(d.order_id),
        clickId: d.affiliate_click_id ?? null,
        quantity: d.quantity ?? 1,
        unitPriceCents: need(d.unit_price),
        discountCents: d.seller_discount ?? 0,
        at,
      };
    case "ORDER_SHIPPED":
      return { kind: "order.shipped", eventId: e.event_id, orderId: need(d.order_id), at };
    case "ORDER_DELIVERED":
      return { kind: "order.delivered", eventId: e.event_id, orderId: need(d.order_id), at };
    case "ORDER_COMPLETED":
      return { kind: "order.completed", eventId: e.event_id, orderId: need(d.order_id), at };
    case "ORDER_REFUNDED":
      return {
        kind: "order.refunded",
        eventId: e.event_id,
        orderId: need(d.order_id),
        amountCents: need(d.refund_amount),
        at,
      };
    case "PRODUCT_STOCK_CHANGED":
      return {
        kind: "product.stock",
        eventId: e.event_id,
        catalogId: need(d.product_id),
        inStock: d.in_stock ?? true,
        at,
      };
  }
}

// Amazon style report: integer cents, ISO dates, our click id in ascsubtag.
const amazonSchema = z.object({
  id: z.string().min(1),
  event: z.enum(["order.placed", "order.shipped", "order.delivered", "order.closed", "order.returned"]),
  created_at: z.iso.datetime(),
  order: z.object({
    id: z.string().min(1),
    ascsubtag: z.string().nullish(),
    quantity: z.number().int().positive().optional(),
    item_price_cents: z.number().int().nonnegative().optional(),
    discount_cents: z.number().int().nonnegative().optional(),
    refund_cents: z.number().int().positive().optional(),
  }),
});

function fromAmazon(body: unknown): NetworkEvent {
  const e = amazonSchema.parse(body);
  const at = new Date(e.created_at);
  const o = e.order;
  switch (e.event) {
    case "order.placed":
      return {
        kind: "order.placed",
        eventId: e.id,
        orderId: o.id,
        clickId: o.ascsubtag ?? null,
        quantity: o.quantity ?? 1,
        unitPriceCents: need(o.item_price_cents),
        discountCents: o.discount_cents ?? 0,
        at,
      };
    case "order.shipped":
      return { kind: "order.shipped", eventId: e.id, orderId: o.id, at };
    case "order.delivered":
      return { kind: "order.delivered", eventId: e.id, orderId: o.id, at };
    case "order.closed":
      return { kind: "order.completed", eventId: e.id, orderId: o.id, at };
    case "order.returned":
      return { kind: "order.refunded", eventId: e.id, orderId: o.id, amountCents: need(o.refund_cents), at };
  }
}

// Brand sites usually come through an affiliate network postback.
const brandSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "conversion",
    "conversion.shipped",
    "conversion.delivered",
    "conversion.locked",
    "conversion.reversed",
  ]),
  occurred_at: z.iso.datetime(),
  order_ref: z.string().min(1),
  subid: z.string().nullish(),
  qty: z.number().int().positive().optional(),
  sale_amount: cents.optional(),
  discount: cents.optional(),
  reversed_amount: cents.optional(),
});

function fromBrand(body: unknown): NetworkEvent {
  const e = brandSchema.parse(body);
  const at = new Date(e.occurred_at);
  switch (e.type) {
    case "conversion":
      return {
        kind: "order.placed",
        eventId: e.id,
        orderId: e.order_ref,
        clickId: e.subid ?? null,
        quantity: e.qty ?? 1,
        unitPriceCents: need(e.sale_amount),
        discountCents: e.discount ?? 0,
        at,
      };
    case "conversion.shipped":
      return { kind: "order.shipped", eventId: e.id, orderId: e.order_ref, at };
    case "conversion.delivered":
      return { kind: "order.delivered", eventId: e.id, orderId: e.order_ref, at };
    case "conversion.locked":
      return { kind: "order.completed", eventId: e.id, orderId: e.order_ref, at };
    case "conversion.reversed":
      return {
        kind: "order.refunded",
        eventId: e.id,
        orderId: e.order_ref,
        amountCents: need(e.reversed_amount),
        at,
      };
  }
}

function need<T>(v: T | undefined | null): T {
  if (v === undefined || v === null) throw new Error("Missing field for this event type");
  return v;
}

export const adapters: Record<Destination, (body: unknown) => NetworkEvent> = {
  tiktok: fromTikTok,
  amazon: fromAmazon,
  brand: fromBrand,
};

export const payoutEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["payout.paid", "payout.failed"]),
  created_at: z.iso.datetime(),
  data: z.object({
    payout_ref: z.string().min(1),
    provider_ref: z.string().optional(),
    failure_reason: z.string().optional(),
  }),
});
