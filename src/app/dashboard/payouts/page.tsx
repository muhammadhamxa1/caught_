import { Check, X } from "lucide-react";
import { config } from "@/lib/config";
import { publicId } from "@/lib/ids";
import { money } from "@/lib/money";
import { balancesFor } from "@/server/ledger";
import { payoutChecks, payoutHistory, payoutMethodFor } from "@/server/payouts";
import { dashboardContext } from "@/server/scope";
import { Empty, PageHeader, Panel, Status, shortDate } from "../_components/bits";
import { MethodForm, RequestForm } from "./PayoutForms";

export default async function PayoutsPage() {
  const ctx = await dashboardContext();
  const wallet = balancesFor(ctx.user.id);
  const checks = payoutChecks(ctx.user.id);
  const method = payoutMethodFor(ctx.user.id);
  const history = payoutHistory(ctx.user.id);
  const canRequest = checks.every((c) => c.ok);

  return (
    <>
      <PageHeader title="Payouts">
        Cash out cleared commission from all your accounts at once. The minimum is {money(config.payoutMinCents)}.
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <Panel>
            <p className="text-sm text-ink-2">Available to cash out</p>
            <p className="num mt-1 text-[2.5rem] leading-none font-semibold tracking-[-0.03em] text-money">{money(Math.max(wallet.available, 0))}</p>
            {wallet.available < 0 && (
              <p className="mt-2 text-sm text-alert">
                A late refund left you {money(-wallet.available)} behind. New commission pays that off first.
              </p>
            )}
            <p className="mt-2 text-sm text-ink-2">
              <span className="num">{money(wallet.pending)}</span> more is still in return windows.
            </p>
            <ul className="mt-5 grid gap-1.5 text-[0.9375rem]">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.ok ? <Check size={16} aria-label="Done" /> : <X size={16} className="text-alert" aria-label="Not yet" />}
                  <span className={c.ok ? "" : "text-ink-2"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <RequestForm
                availableCents={Math.max(wallet.available, 0)}
                idempotencyKey={publicId(20)}
                disabled={!canRequest}
                method={method?.label ?? null}
              />
            </div>
          </Panel>

          <Panel title="Payout method">
            <MethodForm current={method ? { type: method.type, label: method.label } : null} />
          </Panel>
        </div>

        <Panel title="History" note="Pending, then approved, then paid. A failed or rejected payout goes back to your available balance.">
          {history.length === 0 ? (
            <Empty>No payouts yet.</Empty>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[36rem] text-left text-[0.9375rem]">
                <thead className="text-sm text-ink-3">
                  <tr className="border-b border-rule">
                    <th className="py-2 pr-3 font-medium">Payout</th>
                    <th className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">To</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Timeline</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="border-b border-rule align-top last:border-0">
                      <td className="num py-2.5 pr-3 text-sm whitespace-nowrap">{p.ref}</td>
                      <td className={`num py-2.5 pr-3 text-right ${p.status === "paid" ? "text-money" : ""}`}>{money(p.amountCents)}</td>
                      <td className="py-2.5 pr-3 text-sm text-ink-2">{p.methodLabel}</td>
                      <td className="py-2.5 pr-3">
                        <Status value={p.status} />
                      </td>
                      <td className="py-2.5 text-sm text-ink-2">
                        <span className="block">Requested {shortDate(p.requestedAt)}</span>
                        {p.approvedAt && <span className="block">Approved {shortDate(p.approvedAt)}</span>}
                        {p.paidAt && (
                          <span className="block">
                            Paid {shortDate(p.paidAt)} <span className="num text-ink-3">{p.providerRef}</span>
                          </span>
                        )}
                        {p.closedAt && <span className="block">Closed {shortDate(p.closedAt)}</span>}
                        {p.note && <span className="block text-ink-3">{p.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
