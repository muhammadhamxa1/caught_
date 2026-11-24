import Link from "next/link";
import { Price, ProductImage } from "@/components/ui";
import { productStats, rangeFor } from "@/server/analytics";
import { productsForAccounts } from "@/server/products";
import { dashboardContext } from "@/server/scope";
import { Empty, PageHeader, Status } from "../_components/bits";

type Props = { searchParams: Promise<{ s?: string }> };

const FILTERS = [
  { key: "live", label: "On my page" },
  { key: "sold_out", label: "Sold out" },
  { key: "archived", label: "Archived" },
];

export default async function ProductsPage({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const filter = (await searchParams).s ?? "live";
  const all = productsForAccounts(ctx.accountIds);
  const stats = new Map(productStats(ctx.accountIds, rangeFor(30)).map((p) => [p.id, p]));
  const multi = ctx.accounts.length > 1 && !ctx.selected;

  const list = all.filter((p) =>
    filter === "live" ? p.status !== "archived" : filter === "sold_out" ? p.status === "sold_out" : p.status === "archived",
  );
  const counts = {
    live: all.filter((p) => p.status !== "archived").length,
    sold_out: all.filter((p) => p.status === "sold_out").length,
    archived: all.filter((p) => p.status === "archived").length,
  };

  return (
    <>
      <PageHeader
        title="Products"
        action={
          <Link href="/dashboard/products/new" className="btn btn-primary h-11 px-5">
            Add product
          </Link>
        }
      >
        Every product gets a number that never changes. Say it in your video: &quot;it&apos;s #47 in my bio&quot;.
      </PageHeader>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/dashboard/products?s=${f.key}`}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              filter === f.key ? "bg-ink font-semibold text-paper" : "text-ink-2 shadow-[inset_0_0_0_1px_var(--color-rule-strong)]"
            }`}
          >
            {f.label} <span className="num">{counts[f.key as keyof typeof counts]}</span>
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty>
          {filter === "live" ? (
            <>
              No products yet.{" "}
              <Link href="/dashboard/products/new" className="underline underline-offset-4">
                Add your first one
              </Link>{" "}
              and it becomes #1.
            </>
          ) : (
            "Nothing here."
          )}
        </Empty>
      ) : (
        <ul className="divide-y divide-rule rounded-2xl bg-sheet px-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
          {list.map((p) => {
            const s = stats.get(p.id);
            const clicks = s ? s.clicks.tiktok + s.clicks.amazon + s.clicks.brand : 0;
            return (
              <li key={p.id}>
                <Link href={`/dashboard/products/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-sunk/50">
                  <span className="num w-10 shrink-0 font-semibold">#{p.number}</span>
                  <ProductImage src={p.imageUrl} alt="" size={44} muted={p.status !== "active"} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
                      <Price priceCents={p.priceCents} salePriceCents={p.salePriceCents} />
                      {p.status !== "active" && <Status value={p.status} />}
                      {multi && <span className="text-ink-3">@{ctx.handles.get(p.accountId)}</span>}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm sm:block">
                    <span className="num block">{clicks.toLocaleString()}</span>
                    <span className="text-ink-3">clicks, 30d</span>
                  </span>
                  <span className="w-20 text-right text-sm">
                    {s?.waiting ? (
                      <>
                        <span className="num block">{s.waiting}</span>
                        <span className="text-ink-3">waiting</span>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
