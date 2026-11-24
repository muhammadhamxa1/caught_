import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { payoutMethods, payouts, type PayoutStatus } from "@/db/schema";
import { config } from "@/lib/config";
import { humanRef, newId } from "@/lib/ids";
import { money } from "@/lib/money";
import { balancesFor, post } from "./ledger";

const OPEN: PayoutStatus[] = ["pending", "approved"];

/** Allowed status moves. Anything else is refused. */
export const TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "failed", "rejected"],
  paid: [],
  rejected: [],
  failed: [],
};

export type PayoutCheck = { label: string; ok: boolean };

export function payoutChecks(userId: string, amountCents?: number): PayoutCheck[] {
  const { available } = balancesFor(userId);
  const method = db.select().from(payoutMethods).where(eq(payoutMethods.userId, userId)).get();
  const open = openPayout(userId);
  const amount = amountCents ?? available;
  return [
    { label: `At least ${money(config.payoutMinCents)} available`, ok: available >= config.payoutMinCents },
    { label: "Amount is within your available balance", ok: amount > 0 && amount <= available },
    { label: "Payout method on file", ok: Boolean(method) },
    { label: "No other payout in progress", ok: !open },
  ];
}

export function openPayout(userId: string) {
  return db
    .select()
    .from(payouts)
    .where(and(eq(payouts.userId, userId), inArray(payouts.status, OPEN)))
    .get();
}

type RequestResult =
  | { ok: true; payout: typeof payouts.$inferSelect }
  | { ok: false; error: string };

/**
 * The checks and the balance hold run in one transaction. SQLite serialises
 * writers, so two quick taps can't both pass the balance check. The
 * idempotency key covers the double submit from a slow network.
 */
export function requestPayout(
  userId: string,
  amountCents: number,
  idempotencyKey: string,
  at = new Date(),
): RequestResult {
  return db.transaction(() => {
    const replay = db
      .select()
      .from(payouts)
      .where(and(eq(payouts.userId, userId), eq(payouts.idempotencyKey, idempotencyKey)))
      .get();
    if (replay) return { ok: true as const, payout: replay };

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { ok: false as const, error: "Enter an amount." };
    }
    if (amountCents < config.payoutMinCents) {
      return { ok: false as const, error: `The minimum payout is ${money(config.payoutMinCents)}.` };
    }

    const method = db.select().from(payoutMethods).where(eq(payoutMethods.userId, userId)).get();
    if (!method) return { ok: false as const, error: "Add a payout method first." };

    if (openPayout(userId)) {
      return { ok: false as const, error: "You already have a payout in progress." };
    }

    const { available } = balancesFor(userId);
    if (amountCents > available) {
      return { ok: false as const, error: `You have ${money(Math.max(available, 0))} available.` };
    }

    // Small payouts from creators we have paid before skip manual review.
    const paidBefore = db
      .select({ id: payouts.id })
      .from(payouts)
      .where(and(eq(payouts.userId, userId), eq(payouts.status, "paid")))
      .get();
    const autoApprove = Boolean(paidBefore) && amountCents <= config.payoutAutoApproveMaxCents;

    const id = newId();
    db.insert(payouts)
      .values({
        id,
        ref: humanRef("PO"),
        userId,
        amountCents,
        methodType: method.type,
        methodLabel: method.label,
        status: autoApprove ? "approved" : "pending",
        idempotencyKey,
        note: autoApprove ? "Auto approved" : null,
        requestedAt: at,
        approvedAt: autoApprove ? at : null,
      })
      .run();

    post(
      { userId, kind: "payout_hold", payoutId: id, memo: "Payout requested", at },
      [
        { bucket: "available", amountCents: -amountCents },
        { bucket: "locked", amountCents },
      ],
    );

    const payout = db.select().from(payouts).where(eq(payouts.id, id)).get()!;
    return { ok: true as const, payout };
  });
}

type MoveResult = { ok: true } | { ok: false; error: string };

export function movePayout(
  payoutId: string,
  to: PayoutStatus,
  opts: { note?: string; providerRef?: string; at?: Date } = {},
): MoveResult {
  const at = opts.at ?? new Date();
  return db.transaction(() => {
    const p = db.select().from(payouts).where(eq(payouts.id, payoutId)).get();
    if (!p) return { ok: false as const, error: "Payout not found." };
    if (!TRANSITIONS[p.status].includes(to)) {
      return { ok: false as const, error: `A ${p.status} payout can't be marked ${to}.` };
    }

    const patch: Partial<typeof payouts.$inferInsert> = { status: to };
    if (opts.note) patch.note = opts.note;
    if (to === "approved") patch.approvedAt = at;
    if (to === "paid") {
      patch.paidAt = at;
      patch.providerRef = opts.providerRef ?? null;
    }
    if (to === "rejected" || to === "failed") patch.closedAt = at;

    db.update(payouts).set(patch).where(eq(payouts.id, payoutId)).run();

    if (to === "paid") {
      post(
        { userId: p.userId, kind: "payout_paid", payoutId, memo: `Paid to ${p.methodLabel}`, at },
        [
          { bucket: "locked", amountCents: -p.amountCents },
          { bucket: "paid", amountCents: p.amountCents },
        ],
      );
    }
    if (to === "rejected" || to === "failed") {
      // money goes back to available so the creator can try again
      post(
        { userId: p.userId, kind: "payout_release", payoutId, memo: opts.note ?? `Payout ${to}`, at },
        [
          { bucket: "locked", amountCents: -p.amountCents },
          { bucket: "available", amountCents: p.amountCents },
        ],
      );
    }
    return { ok: true as const };
  });
}

export function payoutHistory(userId: string) {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.requestedAt))
    .all();
}

export function payoutMethodFor(userId: string) {
  return db.select().from(payoutMethods).where(eq(payoutMethods.userId, userId)).get() ?? null;
}

export function savePayoutMethod(userId: string, type: "paypal" | "bank", label: string) {
  db.insert(payoutMethods)
    .values({ userId, type, label, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: payoutMethods.userId,
      set: { type, label, updatedAt: new Date() },
    })
    .run();
}

/** a.lopez@gmail.com becomes a••••z@gmail.com */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const head = name.slice(0, 1);
  const tail = name.length > 2 ? name.slice(-1) : "";
  return `${head}••••${tail}@${domain}`;
}
