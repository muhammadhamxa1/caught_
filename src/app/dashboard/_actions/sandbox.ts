"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { payouts, products, sales, videoProducts, videos, webhookLog } from "@/db/schema";
import { config } from "@/lib/config";
import { money } from "@/lib/money";
import { deliver, newOrderId, orderPayload, payoutPayload, stockPayload, type OrderStep } from "@/sandbox/emit";
import { seeded, simulateVisit, type SimProduct } from "@/sandbox/traffic";
import { movePayout } from "@/server/payouts";
import { priceNow } from "@/server/products";
import { ownsAccount, requireUser } from "@/server/session";
import { sign, SIGNATURE_HEADER } from "@/server/signing";

// Everything here pretends to be an outside service. Orders, stock changes
// and payout results all travel as signed webhooks to /api/webhooks.

export type SandboxResult = { message: string } | null;

const done = (message: string): SandboxResult => {
  revalidatePath("/dashboard", "layout");
  return { message };
};

export async function sendTraffic(_prev: SandboxResult, form: FormData): Promise<SandboxResult> {
  const user = await requireUser();
  const accountId = String(form.get("accountId"));
  if (!ownsAccount(user.id, accountId)) return { message: "Pick one of your accounts." };
  const count = Math.min(Math.max(Number(form.get("count")) || 25, 1), 100);
  // much higher than real life so something visible happens in a demo
  const conversion = 0.3;

  const list = db.select().from(products).where(eq(products.accountId, accountId)).all();
  const sim: SimProduct[] = list.map((p) => ({
    id: p.id,
    number: p.number,
    name: p.name,
    keywords: p.keywords,
    category: p.category,
    status: p.status,
    backupId: p.backupProductId,
    priceCents: priceNow(p),
    dests: ["tiktok", ...(p.amazonUrl ? (["amazon"] as const) : []), ...(p.brandUrl ? (["brand"] as const) : [])],
    weight: 1,
  }));
  const vids = db.select().from(videos).where(eq(videos.accountId, accountId)).orderBy(desc(videos.postedAt)).limit(4).all();
  const links = vids.length
    ? db.select().from(videoProducts).where(inArray(videoProducts.videoId, vids.map((v) => v.id))).all()
    : [];

  const rand = seeded(Date.now());
  let clicks = 0;
  let orders = 0;
  let caught = 0;
  for (let i = 0; i < count; i++) {
    const v = rand() < 0.7 && vids.length ? vids[Math.floor(rand() * vids.length)] : null;
    const at = new Date(Date.now() - (count - i) * 4000 - 90_000);
    const made = simulateVisit({
      accountId,
      products: sim,
      video: v ? { id: v.id, productIds: links.filter((l) => l.videoId === v.id).map((l) => l.productId) } : null,
      misses: ["lip liner", "stanley cup", "air fryer"],
      at,
      rand,
      signups: true,
    });
    for (const c of made) {
      clicks++;
      if (rand() > conversion) continue;
      const p = sim.find((x) => x.id === c.productId)!;
      const payload = orderPayload(c.destination, "placed", {
        orderId: newOrderId(c.destination),
        clickId: c.clickId,
        quantity: 1,
        unitPriceCents: p.priceCents,
        discountCents: 0,
      });
      const res = await deliver(c.destination, payload, config.appUrl);
      const detail = (res.body as { detail?: string }).detail ?? "";
      const m = detail.match(/Caught \$([\d.,]+)/);
      if (m) {
        orders++;
        caught += Math.round(Number(m[1].replace(/,/g, "")) * 100);
      }
    }
  }
  return done(`${count} visits, ${clicks} buy clicks, ${orders} orders. Caught ${money(caught)}.`);
}

async function ownedSale(saleId: string) {
  const user = await requireUser();
  const s = db.select().from(sales).where(eq(sales.id, saleId)).get();
  if (!s || s.userId !== user.id) return null;
  return s;
}

export async function orderStep(form: FormData) {
  const sale = await ownedSale(String(form.get("saleId")));
  if (!sale) return;
  const step = String(form.get("step")) as OrderStep | "refund_half";
  const remaining = sale.baseCents - sale.refundedCents;
  const refund = step === "refund_half" ? Math.ceil(remaining / 2) : remaining;
  const payload = orderPayload(sale.destination, step === "refund_half" ? "refunded" : step, {
    orderId: sale.networkOrderId,
    refundCents: refund,
  });
  await deliver(sale.destination, payload, config.appUrl);
  revalidatePath("/dashboard", "layout");
}

export async function stockChange(form: FormData) {
  const user = await requireUser();
  const p = db.select().from(products).where(eq(products.id, String(form.get("productId")))).get();
  if (!p?.catalogId || !ownsAccount(user.id, p.accountId)) return;
  await deliver("tiktok", stockPayload(p.catalogId, form.get("inStock") === "1"), config.appUrl);
  revalidatePath("/dashboard", "layout");
}

export async function payoutOps(form: FormData) {
  const user = await requireUser();
  const p = db.select().from(payouts).where(eq(payouts.id, String(form.get("payoutId")))).get();
  if (!p || p.userId !== user.id) return;
  const op = String(form.get("op"));

  // approve and reject are decisions made by Caught's own ops team
  if (op === "approve") movePayout(p.id, "approved", { note: "Approved by ops" });
  if (op === "reject") movePayout(p.id, "rejected", { note: "Rejected by ops: details didn't match" });
  // paid and failed come back from the payout provider as webhooks
  if (op === "paid") await deliver("payouts", payoutPayload(p.ref, "paid"), config.appUrl);
  if (op === "failed") await deliver("payouts", payoutPayload(p.ref, "failed", "Receiving account is closed"), config.appUrl);
  revalidatePath("/dashboard", "layout");
}

export async function securityCheck(form: FormData) {
  await requireUser();
  const kind = String(form.get("kind"));

  if (kind === "bad-signature") {
    const body = JSON.stringify(orderPayload("tiktok", "placed", { orderId: "FORGED-1", clickId: "x", quantity: 1, unitPriceCents: 99900 }));
    await fetch(`${config.appUrl}/api/webhooks/tiktok`, {
      method: "POST",
      headers: { "content-type": "application/json", [SIGNATURE_HEADER]: sign("not-the-secret", body) },
      body,
    }).catch(() => null);
  }

  if (kind === "replay") {
    const last = db
      .select()
      .from(webhookLog)
      .where(and(eq(webhookLog.status, "processed"), inArray(webhookLog.source, ["tiktok", "amazon", "brand"])))
      .orderBy(desc(webhookLog.id))
      .get();
    if (last) await deliver(last.source as "tiktok", JSON.parse(last.payload), config.appUrl);
  }
  revalidatePath("/dashboard/sandbox");
}
