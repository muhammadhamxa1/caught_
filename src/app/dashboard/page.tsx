import Link from "next/link";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, signups } from "@/db/schema";
import { Earned } from "@/components/ui";
import { compact, money, percent } from "@/lib/money";
import { byEntry, caughtFromPulledVideos, daily, feed, missedSearches, productStats, rangeFor, summary } from "@/server/analytics";
import { isOnSale } from "@/server/products";
import { dashboardContext } from "@/server/scope";
import { sendWaitingNow } from "./_actions/products";
import { Line, PageHeader, Panel, RangeTabs, rangeDays } from "./_components/bits";
import { DailyChart } from "./_components/DailyChart";
import { LiveFeed } from "./_components/LiveFeed";

type Props = { searchParams: Promise<{ d?: string }> };

const ENTRY_LABEL: Record<string, string> = {
  number: "Typed the number",
  video: "Tapped a video",
  search: "Searched",
  list: "Browsed the list",
  backup: "Sold-out backup",
  direct: "Direct product link",
};

export default async function Overview({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const days = rangeDays((await searchParams).d);
  const range = rangeFor(days);
  const ids = ctx.accountIds;

  const s = summary(ids, range);
  const rows = daily(ids, range);
  const stats = productStats(ids, range).filter((p) => p.status !== "archived" || p.views > 0);
  const top = [...stats].sort((a, b) => clicksOf(b) - clicksOf(a)).slice(0, 10);
  const entries = byEntry(ids, range);
  const pulled = caughtFromPulledVideos(ids, range);
  const misses = missedSearches(ids, range);
  const live = feed(ids, ctx.handles).map((r) => ({ ...r, at: r.at.getTime() }));
  const waiting = waitingList(ids);

  const backup = entries.get("backup");
  const offTikTok = sumOffTikTok(ids, range.from, range.to);
  const multi = ctx.accounts.length > 1 && !ctx.selected;

  return (
    <>
      <PageHeader
        title={multi ? `All accounts` : `@${ctx.primary.handle}`}
        action={<RangeTabs days={days} basePath="/dashboard" />}
      >
        {multi ? `Combined totals for ${ctx.accounts.map((a) => `@${a.handle}`).join(" and ")}.` : null}
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <p className="text-sm text-ink-2">Last {days} days</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <Earned cents={s.commissionCents} className="text-[2.75rem] leading-none font-semibold tracking-[-0.03em]" />
            <span className="text-ink-2">
              caught from <span className="num text-ink">{s.orders}</span> sales
            </span>
          </p>
          <div className="mt-6 grid gap-x-10 sm:grid-cols-2">
            <div className="text-[0.9375rem]">
              <Line label="Page visits">{s.visits.toLocaleString()}</Line>
              <Line label="From TikTok's app">{percent(s.inApp, s.visits)}</Line>
              <Line label="Product views">{s.productViews.toLocaleString()}</Line>
              <Line label="Buy clicks">{s.clicks.toLocaleString()}</Line>
              <Line label="Clicks that bought">{percent(s.orders, s.clicks)}</Line>
            </div>
            <div className="text-[0.9375rem]">
              <Line label="Sales">{s.orders.toLocaleString()}</Line>
              <Line label="GMV">{money(s.gmvCents)}</Line>
              <Line label="Refunded">{s.refundedCents ? `-${money(s.refundedCents)}` : money(0)}</Line>
              <Line label="In return window">{money(s.pendingCents)}</Line>
              <Line label="Commission" strong>
                <span className="text-money">{money(s.commissionCents)}</span>
              </Line>
            </div>
          </div>
        </Panel>

        <Panel title="Sales the basket would have missed" note="The TikTok basket link can't take credit for these.">
          <div className="text-[0.9375rem]">
            <Line label="Videos with pulled links">
              <span className="text-money">{money(pulled.commissionCents)}</span>
            </Line>
            <p className="-mt-1 mb-1 text-xs text-ink-3">{pulled.orders} sales from videos TikTok removed the link from</p>
            <Line label="Sold-out backups">
              <span className="text-money">{money(backup?.commissionCents ?? 0)}</span>
            </Line>
            <p className="-mt-1 mb-1 text-xs text-ink-3">{backup?.orders ?? 0} sales from your backup picks</p>
            <Line label="Amazon and brand sites">
              <span className="text-money">{money(offTikTok.cents)}</span>
            </Line>
            <p className="-mt-1 text-xs text-ink-3">{offTikTok.orders} sales from viewers who wanted another store</p>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Day by day">
          <DailyChart rows={rows} />
        </Panel>

        <Panel title="Which button people chose" note={`${s.clicks.toLocaleString()} buy clicks`}>
          <ButtonSplit byDest={s.clicksByDest} />
          <h3 className="mt-6 mb-1 text-sm font-semibold">How they found the product</h3>
          <div className="text-[0.9375rem]">
            {Object.keys(ENTRY_LABEL).map((k) => {
              const e = entries.get(k as never);
              if (!e) return null;
              return (
                <Line key={k} label={ENTRY_LABEL[k]}>
                  {percent(e.clicks, s.clicks)}
                </Line>
              );
            })}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-3"
          title="Clicks per product"
          note="Top 10 by buy clicks"
          action={
            <Link href="/dashboard/products" className="text-sm text-ink-2 underline underline-offset-4">
              All products
            </Link>
          }
        >
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[46rem] text-left text-[0.9375rem]">
              <thead className="text-sm text-ink-3">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Product</th>
                  <th className="py-2 pr-2 text-right font-medium">Views</th>
                  <th className="py-2 pr-2 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-2 text-right font-medium">TikTok Shop</th>
                  <th className="py-2 pr-2 text-right font-medium">Amazon</th>
                  <th className="py-2 pr-2 text-right font-medium">Brand</th>
                  <th className="py-2 pr-2 text-right font-medium">Sales</th>
                  <th className="py-2 pr-2 text-right font-medium">Commission</th>
                  <th className="py-2 text-right font-medium">Waiting</th>
                </tr>
              </thead>
              <tbody className="num">
                {top.map((p) => {
                  const total = clicksOf(p);
                  return (
                    <tr key={p.id} className="border-b border-rule last:border-0">
                      <td className="py-2 pr-2 font-semibold">{p.number}</td>
                      <td className="max-w-[14rem] truncate py-2 pr-2 font-sans">
                        <Link href={`/dashboard/products/${p.id}`} className="hover:underline">
                          {p.name}
                        </Link>
                        {multi && <span className="ml-1.5 text-xs text-ink-3">@{ctx.handles.get(p.accountId)}</span>}
                      </td>
                      <td className="py-2 pr-2 text-right">{compact(p.views)}</td>
                      <td className="py-2 pr-2 text-right">{compact(total)}</td>
                      <td className="py-2 pr-2 text-right">{share(p.clicks.tiktok, total)}</td>
                      <td className="py-2 pr-2 text-right">{share(p.clicks.amazon, total)}</td>
                      <td className="py-2 pr-2 text-right">{share(p.clicks.brand, total)}</td>
                      <td className="py-2 pr-2 text-right">{p.orders}</td>
                      <td className="py-2 pr-2 text-right text-money">{money(p.commissionCents)}</td>
                      <td className="py-2 text-right">{p.waiting || ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Searches that found nothing" note="What to link next">
          {misses.length === 0 ? (
            <p className="text-sm text-ink-2">Every search found something.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {misses.map((m) => (
                <li key={m.query} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">&quot;{m.query}&quot;</span>
                  <span className="num text-sm text-ink-2">{m.count}x</span>
                  {!m.query.startsWith("#") && (
                    <Link
                      href={`/dashboard/products/new?q=${encodeURIComponent(m.query)}`}
                      className="rounded-md px-2 py-1 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk"
                    >
                      Add
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="People waiting" note="Sign ups for a sale or restock text">
          {waiting.length === 0 ? (
            <p className="text-sm text-ink-2">No one is waiting right now.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {waiting.slice(0, 8).map((w) => (
                <li key={w.id} className="flex items-center gap-3 py-2">
                  <span className="num w-9 shrink-0 font-semibold">#{w.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{w.name}</span>
                    <span className="text-xs text-ink-3">
                      <span className="num">{w.sale}</span> for a sale, <span className="num">{w.restock}</span> for restock
                    </span>
                  </span>
                  {w.canSend && (
                    <form action={sendWaitingNow}>
                      <input type="hidden" name="productId" value={w.id} />
                      <button className="rounded-md px-2 py-1 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk">
                        Send now
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Live" note="Updates every few seconds">
          <LiveFeed initial={live} showHandle={multi} />
        </Panel>
      </div>
    </>
  );
}

function clicksOf(p: { clicks: Record<string, number> }) {
  return p.clicks.tiktok + p.clicks.amazon + p.clicks.brand;
}

function share(n: number, total: number) {
  return n ? percent(n, total) : "";
}

function sumOffTikTok(accountIds: string[], from: Date, to: Date) {
  const row = db.get<{ n: number; c: number }>(sql`
    select count(*) as n, coalesce(sum(c.amount_cents), 0) as c
    from sales s join commissions c on c.sale_id = s.id
    where s.account_id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
      and s.destination != 'tiktok'
      and s.placed_at >= ${from.getTime()} and s.placed_at < ${to.getTime()}
  `);
  return { orders: Number(row?.n ?? 0), cents: Number(row?.c ?? 0) };
}

function waitingList(accountIds: string[]) {
  const rows = db
    .select({
      product: products,
      sale: sql<number>`sum(case when ${signups.reason} = 'sale' then 1 else 0 end)`,
      restock: sql<number>`sum(case when ${signups.reason} = 'restock' then 1 else 0 end)`,
    })
    .from(signups)
    .innerJoin(products, eq(products.id, signups.productId))
    .where(and(inArray(signups.accountId, accountIds), eq(signups.status, "waiting")))
    .groupBy(products.id)
    .all();

  return rows
    .map((r) => {
      const sale = Number(r.sale);
      const restock = Number(r.restock);
      const p = r.product;
      const canSend = (restock > 0 && p.status === "active") || (sale > 0 && p.status === "active" && isOnSale(p));
      return { id: p.id, number: p.number, name: p.name, sale, restock, total: sale + restock, canSend };
    })
    .sort((a, b) => b.total - a.total);
}

function ButtonSplit({ byDest }: { byDest: Record<"tiktok" | "amazon" | "brand", number> }) {
  const total = byDest.tiktok + byDest.amazon + byDest.brand || 1;
  // Monochrome on purpose: solid, hatched and outlined segments, each
  // labelled, so it still reads in print and for colour blind viewers.
  const parts = [
    { key: "tiktok", label: "TikTok Shop", n: byDest.tiktok, style: { background: "var(--color-ink)" } },
    {
      key: "amazon",
      label: "Amazon",
      n: byDest.amazon,
      style: { background: "repeating-linear-gradient(135deg, var(--color-ink) 0 2px, transparent 2px 6px)", boxShadow: "inset 0 0 0 1.5px var(--color-ink)" },
    },
    { key: "brand", label: "Brand site", n: byDest.brand, style: { background: "var(--color-sheet)", boxShadow: "inset 0 0 0 1.5px var(--color-ink)" } },
  ];
  return (
    <div>
      <div className="flex h-7 gap-[2px] overflow-hidden rounded-md" role="img" aria-label={parts.map((p) => `${p.label} ${percent(p.n, total)}`).join(", ")}>
        {parts.map((p) => (p.n > 0 ? <div key={p.key} className="first:rounded-l-md last:rounded-r-md" style={{ width: `${(p.n / total) * 100}%`, ...p.style }} /> : null))}
      </div>
      <ul className="mt-3 grid gap-1 text-[0.9375rem]">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="size-3.5 shrink-0 rounded-sm" style={p.style} aria-hidden />
            <span className="flex-1">{p.label}</span>
            <span className="num">{p.n.toLocaleString()}</span>
            <span className="num w-12 text-right text-ink-2">{percent(p.n, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
