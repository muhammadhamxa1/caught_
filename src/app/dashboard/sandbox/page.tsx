import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { commissions, messages, payouts, products, sales, webhookLog } from "@/db/schema";
import { money } from "@/lib/money";
import { NETWORKS } from "@/server/networks";
import { maskContact } from "@/server/notify";
import { dashboardContext } from "@/server/scope";
import { orderStep, payoutOps, securityCheck, stockChange } from "../_actions/sandbox";
import { PageHeader, Panel, Status, ago } from "../_components/bits";
import { TrafficForm } from "./TrafficForm";

const STEPS: { step: string; label: string; from: string[] }[] = [
  { step: "shipped", label: "Ship", from: ["placed"] },
  { step: "delivered", label: "Deliver", from: ["placed", "shipped"] },
  { step: "completed", label: "Close returns", from: ["placed", "shipped", "delivered"] },
  { step: "refund_half", label: "Refund half", from: ["placed", "shipped", "delivered", "completed"] },
  { step: "refunded", label: "Refund all", from: ["placed", "shipped", "delivered", "completed"] },
];

const small = "rounded-md px-2 py-1 text-xs font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk disabled:opacity-35";

export default async function SandboxPage() {
  const ctx = await dashboardContext();
  const ids = ctx.accountIds;

  const recent = db
    .select({ sale: sales, c: commissions, number: products.number, name: products.name })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .where(inArray(sales.accountId, ids))
    .orderBy(desc(sales.placedAt))
    .limit(8)
    .all();

  const linkable = db
    .select()
    .from(products)
    .where(and(inArray(products.accountId, ids), isNotNull(products.catalogId)))
    .orderBy(desc(products.number))
    .all()
    .filter((p) => p.status !== "archived");

  const open = db
    .select()
    .from(payouts)
    .where(and(eq(payouts.userId, ctx.user.id), inArray(payouts.status, ["pending", "approved"])))
    .all();
  const log = db.select().from(webhookLog).orderBy(desc(webhookLog.id)).limit(20).all();
  const outbox = db.select().from(messages).where(inArray(messages.accountId, ids)).orderBy(desc(messages.createdAt)).limit(8).all();

  return (
    <>
      <PageHeader title="Sandbox">
        This page plays the outside world: TikTok Shop, Amazon, brand networks, the text message provider and the payout provider. Every
        button sends a signed webhook to <span className="num text-sm">/api/webhooks</span>, the same path real traffic would take.
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Send viewers" note="Fake viewers land on the page, look things up and click. Some of them buy.">
          <TrafficForm accounts={ctx.accounts.map((a) => ({ id: a.id, handle: a.handle }))} defaultId={ctx.primary.id} />
        </Panel>

        <Panel title="Payout provider" note="Approve or reject as Caught's ops team, then let the provider pay or bounce it.">
          {open.length === 0 ? (
            <p className="text-sm text-ink-2">No payouts in progress. Request one on the Payouts page.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {open.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="num text-sm">{p.ref}</span>
                  <span className="num">{money(p.amountCents)}</span>
                  <Status value={p.status} />
                  <form action={payoutOps} className="ml-auto flex gap-1.5">
                    <input type="hidden" name="payoutId" value={p.id} />
                    {p.status === "pending" && (
                      <button name="op" value="approve" className={small}>
                        Approve
                      </button>
                    )}
                    <button name="op" value="reject" className={small}>
                      Reject
                    </button>
                    {p.status === "approved" && (
                      <>
                        <button name="op" value="paid" className={small}>
                          Send payment
                        </button>
                        <button name="op" value="failed" className={small}>
                          Payment bounces
                        </button>
                      </>
                    )}
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="xl:col-span-2" title="Order lifecycle" note="Move recent orders along as the store would. Commission clears when returns close.">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[50rem] text-left text-[0.9375rem]">
              <tbody>
                {recent.map(({ sale, c, number, name }) => (
                  <tr key={sale.id} className="border-b border-rule last:border-0">
                    <td className="py-2 pr-3 text-sm text-ink-3">{ago(sale.placedAt)}</td>
                    <td className="max-w-[14rem] truncate py-2 pr-3">
                      <span className="num">#{number}</span> {name}
                    </td>
                    <td className="py-2 pr-3 text-sm">{NETWORKS[sale.destination].label}</td>
                    <td className="py-2 pr-3 text-sm text-ink-2">{sale.status}</td>
                    <td className="num py-2 pr-3 text-right">
                      <span className={c.status === "reversed" ? "text-ink-3 line-through" : "text-money"}>{money(c.amountCents || c.grossCents)}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <Status value={c.status} />
                    </td>
                    <td className="py-2">
                      <form action={orderStep} className="flex justify-end gap-1.5">
                        <input type="hidden" name="saleId" value={sale.id} />
                        {STEPS.map((s) => (
                          <button key={s.step} name="step" value={s.step} disabled={!s.from.includes(sale.status)} className={small}>
                            {s.label}
                          </button>
                        ))}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Stock sync" note="TikTok Shop tells us when a listing sells out. The product flips to its backup on its own.">
          <form action={stockChange} className="flex flex-wrap gap-2">
            <select name="productId" aria-label="Product" className="field h-11 min-w-0 flex-1">
              {linkable.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name} ({p.status === "sold_out" ? "sold out" : "in stock"})
                </option>
              ))}
            </select>
            <button name="inStock" value="0" className="btn btn-quiet h-11 px-3 text-sm">
              Report sold out
            </button>
            <button name="inStock" value="1" className="btn btn-quiet h-11 px-3 text-sm">
              Report back in stock
            </button>
          </form>
        </Panel>

        <Panel title="Security checks" note="Both should be refused. Watch the log below.">
          <form action={securityCheck} className="flex flex-wrap gap-2">
            <button name="kind" value="bad-signature" className="btn btn-quiet h-11 px-3 text-sm">
              Send a forged order
            </button>
            <button name="kind" value="replay" className="btn btn-quiet h-11 px-3 text-sm">
              Replay the last order event
            </button>
          </form>
        </Panel>

        <Panel title="Webhook log" note="Every webhook this install received, newest first." className="xl:col-span-2">
          {log.length === 0 ? (
            <p className="text-sm text-ink-2">Nothing yet. Place an order from a product page or send viewers above.</p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <tbody>
                  {log.map((l) => (
                    <tr key={l.id} className="border-b border-rule last:border-0">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-ink-3">{ago(l.receivedAt)}</td>
                      <td className="py-1.5 pr-3">{l.source}</td>
                      <td className="num py-1.5 pr-3 text-xs">{l.type ?? ""}</td>
                      <td className={`py-1.5 pr-3 font-medium ${l.status === "rejected" || l.status === "failed" ? "text-alert" : ""}`}>{l.status}</td>
                      <td className="py-1.5 text-ink-2">{l.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Text and email outbox" note="Messages to people who asked to hear about a sale or restock." className="xl:col-span-2">
          {outbox.length === 0 ? (
            <p className="text-sm text-ink-2">No messages sent yet.</p>
          ) : (
            <ul className="divide-y divide-rule text-[0.9375rem]">
              {outbox.map((m) => (
                <li key={m.id} className="grid gap-x-4 py-2 sm:grid-cols-[4rem_11rem_1fr]">
                  <span className="text-sm text-ink-3">{ago(m.createdAt)}</span>
                  <span className="num truncate text-sm">{maskContact(m.to)}</span>
                  <span className="text-ink-2">{m.body}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
