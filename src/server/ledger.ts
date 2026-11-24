import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { ledger, type Bucket, type LedgerKind } from "@/db/schema";
import { newId } from "@/lib/ids";

type Leg = { bucket: Bucket; amountCents: number };

type Entry = {
  userId: string;
  accountId?: string | null;
  kind: LedgerKind;
  saleId?: string | null;
  payoutId?: string | null;
  memo?: string;
  at: Date;
};

// These kinds move money in or out of the creator's wallet, so they are a
// single leg. Everything else is a move between buckets and must net to zero.
const EXTERNAL: LedgerKind[] = ["earned", "refund", "clawback"];

export function post(entry: Entry, legs: Leg[]) {
  const legsToWrite = legs.filter((l) => l.amountCents !== 0);
  if (legsToWrite.length === 0) return null;

  const net = legsToWrite.reduce((sum, l) => sum + l.amountCents, 0);
  if (!EXTERNAL.includes(entry.kind) && net !== 0) {
    throw new Error(`Ledger ${entry.kind} does not balance (${net})`);
  }

  const txnId = newId();
  db.insert(ledger)
    .values(
      legsToWrite.map((leg) => ({
        txnId,
        userId: entry.userId,
        accountId: entry.accountId ?? null,
        bucket: leg.bucket,
        amountCents: leg.amountCents,
        kind: entry.kind,
        saleId: entry.saleId ?? null,
        payoutId: entry.payoutId ?? null,
        memo: entry.memo ?? "",
        createdAt: entry.at,
      })),
    )
    .run();
  return txnId;
}

export type Balances = Record<Bucket, number>;

const empty = (): Balances => ({ pending: 0, available: 0, locked: 0, paid: 0 });

/** Wallet balances for one login, across all of its accounts. */
export function balancesFor(userId: string): Balances {
  const rows = db
    .select({
      bucket: ledger.bucket,
      total: sql<number>`coalesce(sum(${ledger.amountCents}), 0)`,
    })
    .from(ledger)
    .where(eq(ledger.userId, userId))
    .groupBy(ledger.bucket)
    .all();

  const out = empty();
  for (const r of rows) out[r.bucket] = Number(r.total);
  return out;
}

/**
 * Earnings split per account. Payout rows have no account, so this only
 * shows how much each account brought in and where that money sits.
 */
export function earningsByAccount(userId: string, accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, Balances>();
  const rows = db
    .select({
      accountId: ledger.accountId,
      bucket: ledger.bucket,
      total: sql<number>`coalesce(sum(${ledger.amountCents}), 0)`,
    })
    .from(ledger)
    .where(and(eq(ledger.userId, userId), inArray(ledger.accountId, accountIds)))
    .groupBy(ledger.accountId, ledger.bucket)
    .all();

  const out = new Map<string, Balances>();
  for (const r of rows) {
    if (!r.accountId) continue;
    const b = out.get(r.accountId) ?? empty();
    b[r.bucket] = Number(r.total);
    out.set(r.accountId, b);
  }
  return out;
}
