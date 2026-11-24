"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clicks, products } from "@/db/schema";
import { config } from "@/lib/config";
import { deliver, newOrderId, orderPayload } from "@/sandbox/emit";
import { priceNow } from "@/server/products";

export async function placeOrder(form: FormData) {
  if (!config.sandboxNetworks) return;
  const clickId = String(form.get("clickId") ?? "");
  const quantity = Math.min(Math.max(Number(form.get("quantity")) || 1, 1), 3);

  const row = db
    .select({ click: clicks, product: products })
    .from(clicks)
    .innerJoin(products, eq(products.id, clicks.productId))
    .where(eq(clicks.id, clickId))
    .get();
  if (!row) return;

  const orderId = newOrderId(row.click.destination);
  const payload = orderPayload(row.click.destination, "placed", {
    orderId,
    clickId,
    quantity,
    unitPriceCents: priceNow(row.product),
    discountCents: 0,
  });
  const res = await deliver(row.click.destination, payload, config.appUrl);
  const detail = (res.body as { detail?: string; error?: string }).detail ?? (res.body as { error?: string }).error ?? `HTTP ${res.status}`;

  redirect(`/sandbox/checkout/${clickId}?order=${encodeURIComponent(orderId)}&result=${encodeURIComponent(detail)}`);
}
