import { CATALOG, tiktokUrl } from "@/sandbox/catalog";
import { productsForAccounts } from "@/server/products";
import { dashboardContext } from "@/server/scope";
import { PageHeader } from "../../_components/bits";
import { ProductForm } from "../ProductForm";
import { emptyProduct } from "../values";

type Props = { searchParams: Promise<{ q?: string; welcome?: string }> };

export default async function NewProduct({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const sp = await searchParams;

  // Offer catalog items this creator hasn't linked yet, the missed search first.
  const linked = new Set(productsForAccounts(ctx.accounts.map((a) => a.id)).map((p) => p.catalogId));
  const q = sp.q?.toLowerCase() ?? "";
  const samples = CATALOG.filter((c) => !linked.has(c.id))
    .sort((a, b) => Number(b.title.toLowerCase().includes(q) && q !== "") - Number(a.title.toLowerCase().includes(q) && q !== ""))
    .slice(0, 6)
    .map((c) => ({ title: c.title, url: tiktokUrl(c) }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add product">
        {sp.welcome
          ? "Your page is live. Add the products from your videos and each one gets a number."
          : sp.q
            ? `People searched your page for "${sp.q}". Add it so they find it next time.`
            : null}
      </PageHeader>
      <ProductForm
        initial={{ ...emptyProduct, name: sp.q ? sp.q[0].toUpperCase() + sp.q.slice(1) : "", accountId: ctx.primary.id, keywords: sp.q ?? "" }}
        accounts={ctx.accounts.map((a) => ({ id: a.id, handle: a.handle }))}
        nextNumbers={Object.fromEntries(ctx.accounts.map((a) => [a.id, a.nextNumber]))}
        samples={samples}
      />
    </div>
  );
}
