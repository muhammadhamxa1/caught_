import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, messages, products, signups } from "@/db/schema";
import { PUBLIC_HOST } from "@/lib/config";
import { newId } from "@/lib/ids";
import { money } from "@/lib/money";

export type Contact = { channel: "sms" | "email"; contact: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Accepts an email or a phone number and returns it in one stored format. */
export function parseContact(raw: string): Contact | null {
  const value = raw.trim();
  if (!value || value.length > 120) return null;
  if (value.includes("@")) {
    return EMAIL.test(value) ? { channel: "email", contact: value.toLowerCase() } : null;
  }
  const digits = value.replace(/[^\d]/g, "");
  const plus = value.startsWith("+");
  // No country code means a US number, that is where TikTok Shop runs today.
  if (!plus && digits.length === 10) return { channel: "sms", contact: `+1${digits}` };
  if (!plus && digits.length === 11 && digits.startsWith("1")) {
    return { channel: "sms", contact: `+${digits}` };
  }
  if (plus && digits.length >= 8 && digits.length <= 15) {
    return { channel: "sms", contact: `+${digits}` };
  }
  return null;
}

export function maskContact(contact: string) {
  if (contact.includes("@")) {
    const [name, domain] = contact.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return `•••• ${contact.slice(-4)}`;
}

export function addSignup(productId: string, raw: string, at = new Date()) {
  const parsed = parseContact(raw);
  if (!parsed) return { ok: false as const, error: "Enter a phone number or an email." };

  const product = db.select().from(products).where(eq(products.id, productId)).get();
  if (!product || product.status === "archived") {
    return { ok: false as const, error: "This product is no longer listed." };
  }
  const reason = product.status === "sold_out" ? "restock" : "sale";

  // Signing up again after a message went out puts them back in the queue.
  db.insert(signups)
    .values({
      id: newId(),
      accountId: product.accountId,
      productId,
      channel: parsed.channel,
      contact: parsed.contact,
      reason,
      createdAt: at,
    })
    .onConflictDoUpdate({
      target: [signups.productId, signups.contact],
      set: { status: "waiting", reason, createdAt: at, sentAt: null },
    })
    .run();

  return { ok: true as const, reason, channel: parsed.channel };
}

function messageFor(
  product: typeof products.$inferSelect,
  handle: string,
  reason: "sale" | "restock",
) {
  const link = `${PUBLIC_HOST}/${handle}/${product.number}`;
  if (reason === "restock") {
    return `#${product.number} ${product.name} is back in stock. ${link}`;
  }
  const price = product.salePriceCents ?? product.priceCents;
  return `#${product.number} ${product.name} is on sale: ${money(price)} (was ${money(product.priceCents)}). ${link}`;
}

/**
 * Sends to everyone waiting for this reason. The outbox stands in for an
 * SMS and email provider. Each signup gets one message, then waits again
 * only if they sign up again.
 */
export function sendWaiting(productId: string, reason: "sale" | "restock", at = new Date()) {
  return db.transaction(() => {
    const row = db
      .select({ product: products, handle: accounts.handle })
      .from(products)
      .innerJoin(accounts, eq(accounts.id, products.accountId))
      .where(eq(products.id, productId))
      .get();
    if (!row) return 0;

    const waiting = db
      .select()
      .from(signups)
      .where(
        and(
          eq(signups.productId, productId),
          eq(signups.status, "waiting"),
          eq(signups.reason, reason),
        ),
      )
      .all();
    if (waiting.length === 0) return 0;

    const body = messageFor(row.product, row.handle, reason);
    for (const s of waiting) {
      db.insert(messages)
        .values({
          id: newId(),
          accountId: s.accountId,
          signupId: s.id,
          channel: s.channel,
          to: s.contact,
          body: s.channel === "sms" ? `${body} Reply STOP to opt out.` : body,
          createdAt: at,
        })
        .run();
      db.update(signups).set({ status: "sent", sentAt: at }).where(eq(signups.id, s.id)).run();
    }
    return waiting.length;
  });
}
