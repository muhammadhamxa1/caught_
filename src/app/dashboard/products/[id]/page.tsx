import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, signups } from "@/db/schema";
import { money, percent } from "@/lib/money";
import { productStats, rangeFor } from "@/server/analytics";
import { rulesFor } from "@/server/commissions";
import { suggestBackups } from "@/server/products";
import { dashboardContext } from "@/server/scope";
import { archiveAction, inStockAction, soldOutAction } from "../../_actions/products";
import { Line, PageHeader, Panel, Status } from "../../_components/bits";
import { ProductForm } from "../ProductForm";
import type { ProductValues } from "../values";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; restocked?: string; error?: string }>;
};

const pct = (bps?: number) => (bps ? String(bps / 100) : "");
const dollars = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));

export default async function EditProduct({ params, searchParams }: Props) {
  const ctx = await dashboardContext();
  const { id } = await params;
  const sp = await searchParams;
  const p = db.select().from(products).where(eq(products.id, id)).get();
  if (!p || !ctx.accounts.some((a) => a.id === p.accountId)) notFound();

  const handle = ctx.handles.get(p.accountId)!;
  const rules = rulesFor(p.id);
  const tiktokBase = rules.find((r) => r.destination === "tiktok" && r.minMonthlyUnits === 0);
  const tier = rules.find((r) => r.destination === "tiktok" && r.minMonthlyUnits > 0);
  const values: ProductValues = {
    id: p.id,
    accountId: p.accountId,
    catalogId: p.catalogId ?? "",
    name: p.name,
    imageUrl: p.imageUrl ?? "",
    category: p.category,
    keywords: p.keywords,
    price: dollars(p.priceCents),
    salePrice: dollars(p.salePriceCents),
    tiktokUrl: p.tiktokUrl,
    tiktokRate: pct(tiktokBase?.rateBps),
    tierRate: pct(tier?.rateBps),
    tierUnits: tier ? String(tier.minMonthlyUnits) : "",
    amazonUrl: p.amazonUrl ?? "",
    amazonRate: pct(rules.find((r) => r.destination === "amazon")?.rateBps),
    brandName: p.brandName ?? "",
    brandUrl: p.brandUrl ?? "",
    brandRate: pct(rules.find((r) => r.destination === "brand")?.rateBps),
  };

  const stat = productStats([p.accountId], rangeFor(30)).find((s) => s.id === p.id);
  const clicks = stat ? stat.clicks.tiktok + stat.clicks.amazon + stat.clicks.brand : 0;
  const candidates = db
    .select()
    .from(products)
    .where(and(eq(products.accountId, p.accountId), eq(products.status, "active")))
    .all()
    .filter((c) => c.id !== p.id)
    .sort((a, b) => b.number - a.number);
  const suggested = suggestBackups(p.id, 3);
  const backup = p.backupProductId ? db.select().from(products).where(eq(products.id, p.backupProductId)).get() : null;
  const waiting = db
    .select({ id: signups.id })
    .from(signups)
    .where(and(eq(signups.productId, p.id), eq(signups.status, "waiting")))
    .all().length;

  return (
    <>
      <PageHeader
        title={`#${p.number} ${p.name}`}
        action={
          <div className="flex gap-2">
            <Link href={`/dashboard/writer?product=${p.id}`} className="btn btn-quiet h-10 px-4 text-sm">
              Write captions
            </Link>
            <Link href={`/${handle}/${p.number}`} target="_blank" className="btn btn-quiet h-10 px-4 text-sm">
              View on page
            </Link>
          </div>
        }
      >
        <span className="flex items-center gap-2">
          <Status value={p.status} /> caughtshop.com/{handle}/{p.number}
        </span>
      </PageHeader>

      {sp.created && <p className="mb-5 rounded-xl bg-sunk px-4 py-3">Added as #{p.number}. Say it in your next video.</p>}
      {sp.restocked && (
        <p className="mb-5 rounded-xl bg-sunk px-4 py-3">
          Back in stock. {Number(sp.restocked) > 0 ? `Texted ${sp.restocked} people who were waiting.` : "No one was waiting."}
        </p>
      )}
      {sp.error && <p className="mb-5 rounded-xl bg-sunk px-4 py-3 text-alert">{sp.error}</p>}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="max-w-3xl">
          <ProductForm initial={values} accounts={[]} />
        </div>

        <div className="grid content-start gap-5">
          <Panel title="Last 30 days">
            <div className="text-[0.9375rem]">
              <Line label="Product views">{stat?.views.toLocaleString() ?? 0}</Line>
              <Line label="Buy clicks">{clicks.toLocaleString()}</Line>
              <Line label="TikTok Shop">{percent(stat?.clicks.tiktok ?? 0, clicks)}</Line>
              <Line label="Amazon">{percent(stat?.clicks.amazon ?? 0, clicks)}</Line>
              <Line label="Brand site">{percent(stat?.clicks.brand ?? 0, clicks)}</Line>
              <Line label="Sales">{stat?.orders ?? 0}</Line>
              <Line label="Commission" strong>
                <span className="text-money">{money(stat?.commissionCents ?? 0)}</span>
              </Line>
              <Line label="Waiting for a text">{waiting}</Line>
            </div>
          </Panel>

          {p.status !== "archived" && (
            <Panel
              title={p.status === "sold_out" ? "Sold out" : "Stock"}
              note={
                p.status === "sold_out"
                  ? "Viewers who type this number see your backup instead."
                  : "When it sells out, viewers get your backup pick instead of a dead link."
              }
            >
              <form action={soldOutAction} className="grid gap-3">
                <input type="hidden" name="productId" value={p.id} />
                <label className="label mb-0" htmlFor="backupId">
                  Backup product
                </label>
                <select id="backupId" name="backupId" defaultValue={p.backupProductId ?? suggested[0]?.id ?? ""} className="field h-11">
                  <option value="">No backup</option>
                  {suggested.length > 0 && (
                    <optgroup label="Suggested">
                      {suggested.map((c) => (
                        <option key={`s-${c.id}`} value={c.id}>
                          #{c.number} {c.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All in stock">
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.number} {c.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
                {suggested[0] && p.status === "active" && (
                  <p className="text-sm text-ink-3">Suggested by category, clicks and price.</p>
                )}
                {p.status === "sold_out" && backup && (
                  <p className="text-sm">
                    Showing <span className="num">#{backup.number}</span> {backup.name} instead.
                  </p>
                )}
                <button className="btn btn-primary h-11">{p.status === "sold_out" ? "Save backup" : "Mark sold out"}</button>
              </form>
              {p.status === "sold_out" && (
                <form action={inStockAction} className="mt-3">
                  <input type="hidden" name="productId" value={p.id} />
                  <button className="btn btn-secondary h-11 w-full">
                    Back in stock{waiting > 0 ? `, text ${waiting} people` : ""}
                  </button>
                </form>
              )}
            </Panel>
          )}

          {p.status === "archived" && (
            <Panel title="Archived" note={`Viewers who type #${p.number} are told it's no longer listed${backup ? ` and sent to #${backup.number}` : ""}.`}>
              <form action={inStockAction}>
                <input type="hidden" name="productId" value={p.id} />
                <button className="btn btn-secondary h-11 w-full">Put back on my page</button>
              </form>
            </Panel>
          )}

          {p.status !== "archived" && (
            <Panel title="Remove from page" note={`#${p.number} stays reserved, so old videos that mention it still land somewhere.`}>
              <form action={archiveAction}>
                <input type="hidden" name="productId" value={p.id} />
                <button className="btn btn-quiet h-11 w-full">Archive #{p.number}</button>
              </form>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
