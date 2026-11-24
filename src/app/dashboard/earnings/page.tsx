import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { commissions, ledger, products, sales } from "@/db/schema";
import { money, rate } from "@/lib/money";
import { balancesFor, earningsByAccount } from "@/server/ledger";
import { NETWORKS } from "@/server/networks";
import { dashboardContext } from "@/server/scope";
import { Line, PageHeader, Panel, Status, shortDate } from "../_components/bits";

const PAGE = 40;

const KIND: Record<string, string> = {
  earned: "Commission earned",
  cleared: "Cleared",
  refund: "Refund",
  clawback: "Refund after clearing",
  payout_hold: "Payout requested",
  payout_paid: "Payout sent",
  payout_release: "Payout returned",
};

const BUCKET: Record<string, string> = { pending: "Pending", available: "Available", locked: "In a payout", paid: "Paid out" };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function EarningsPage({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const wallet = balancesFor(ctx.user.id);
  const perAccount = earningsByAccount(ctx.user.id, ctx.accounts.map((a) => a.id));

  const lines = db
    .select({ sale: sales, c: commissions, number: products.number, name: products.name })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .where(inArray(sales.accountId, ctx.accountIds))
    .orderBy(desc(sales.placedAt))
    .limit(PAGE + 1)
    .offset((page - 1) * PAGE)
    .all();
  const more = lines.length > PAGE;

  const entries = db
    .select()
    .from(ledger)
    .where(and(eq(ledger.userId, ctx.user.id)))
    .orderBy(desc(ledger.id))
    .limit(30)
    .all();

  const steps = [
    { key: "pending", label: "Pending", note: "Inside the store's return window" },
    { key: "available", label: "Available", note: "Cleared, ready to cash out" },
    { key: "locked", label: "In a payout", note: "Requested, on its way" },
    { key: "paid", label: "Paid out", note: "In your bank or PayPal" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Earnings"
        action={
          <Link href="/dashboard/payouts" className="btn btn-primary h-11 px-5">
            Cash out
          </Link>
        }
      >
        Every sale starts as pending commission. It clears once the store&apos;s return window closes, then you can cash it out. Refunds
        come off before it clears, or from your available balance after.
      </PageHeader>

      <ol className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.key} className="rounded-2xl bg-sheet p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
            <p className="text-sm text-ink-2">
              <span className="num text-ink-3">{i + 1}.</span> {s.label}
            </p>
            <p className={`num mt-1 text-2xl font-semibold ${s.key === "available" || s.key === "paid" ? "text-money" : ""}`}>
              {money(wallet[s.key])}
            </p>
            <p className="mt-1 text-sm text-ink-3">{s.note}</p>
          </li>
        ))}
      </ol>

      {ctx.accounts.length > 1 && (
        <Panel title="By account" note="One wallet and one payout covers all your accounts." className="mb-6 max-w-xl">
          {ctx.accounts.map((a) => {
            const b = perAccount.get(a.id);
            const earned = b ? b.pending + b.available + b.locked + b.paid : 0;
            return (
              <Line key={a.id} label={`@${a.handle}`}>
                <span className="text-money">{money(earned)}</span>
                <span className="ml-2 text-ink-3">{money(b?.pending ?? 0)} pending</span>
              </Line>
            );
          })}
        </Panel>
      )}

      <Panel title="Commission by sale" className="mb-6">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[52rem] text-left text-[0.9375rem]">
            <thead className="text-sm text-ink-3">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 font-medium">Store</th>
                <th className="py-2 pr-3 text-right font-medium">Sale</th>
                <th className="py-2 pr-3 text-right font-medium">Rate</th>
                <th className="py-2 pr-3 text-right font-medium">Commission</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {lines.slice(0, PAGE).map(({ sale, c, number, name }) => (
                <tr key={sale.id} className="border-b border-rule last:border-0">
                  <td className="num py-2 pr-3 text-sm whitespace-nowrap">{shortDate(sale.placedAt)}</td>
                  <td className="max-w-[16rem] truncate py-2 pr-3">
                    <span className="num">#{number}</span> {name}
                    {sale.quantity > 1 && <span className="num text-ink-3"> x{sale.quantity}</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{NETWORKS[sale.destination].label}</td>
                  <td className="num py-2 pr-3 text-right">
                    {money(sale.baseCents)}
                    {sale.refundedCents > 0 && <span className="block text-xs text-ink-3">-{money(sale.refundedCents)} refunded</span>}
                  </td>
                  <td className="num py-2 pr-3 text-right">
                    {rate(c.rateBps)}
                    {c.tierUnits > 0 && <span className="block text-xs text-ink-3">{c.tierUnits}+ tier</span>}
                  </td>
                  <td className="num py-2 pr-3 text-right">
                    {c.status === "reversed" ? (
                      <s className="text-ink-3">{money(c.grossCents)}</s>
                    ) : (
                      <span className="text-money">{money(c.amountCents)}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Status value={c.status} />
                  </td>
                  <td className="py-2 text-right">
                    {c.status !== "reversed" && (
                      <Link href={`/r/${sale.receiptId}`} className="text-sm text-ink-2 underline underline-offset-2">
                        Receipt
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && (
            <Link href={`/dashboard/earnings?page=${page - 1}`} className="btn btn-quiet h-9 px-3">
              Newer
            </Link>
          )}
          {more && (
            <Link href={`/dashboard/earnings?page=${page + 1}`} className="btn btn-quiet h-9 px-3">
              Older
            </Link>
          )}
        </div>
      </Panel>

      <Panel title="Ledger" note="Every movement of money, newest first. Nothing is ever edited, only added.">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[44rem] text-left text-[0.9375rem]">
            <thead className="text-sm text-ink-3">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">What</th>
                <th className="py-2 pr-3 font-medium">Detail</th>
                <th className="py-2 pr-3 font-medium">Balance</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-rule last:border-0">
                  <td className="num py-2 pr-3 text-sm whitespace-nowrap">{shortDate(e.createdAt)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{KIND[e.kind]}</td>
                  <td className="max-w-[18rem] truncate py-2 pr-3 text-ink-2">{e.memo}</td>
                  <td className="py-2 pr-3 text-ink-2">{BUCKET[e.bucket]}</td>
                  <td className={`num py-2 text-right ${e.amountCents < 0 ? "" : "text-money"}`}>
                    {e.amountCents < 0 ? `-${money(-e.amountCents)}` : `+${money(e.amountCents)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
