import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, clicks, products } from "@/db/schema";
import { config } from "@/lib/config";
import { money } from "@/lib/money";
import { networkLabel } from "@/server/networks";
import { priceNow } from "@/server/products";
import { placeOrder } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sandbox checkout", robots: { index: false } };

type Props = {
  params: Promise<{ clickId: string }>;
  searchParams: Promise<{ order?: string; result?: string }>;
};

// Stands in for the real store page. Deliberately plain and unbranded so
// nobody mistakes it for TikTok Shop or Amazon. Placing an order here sends
// a signed webhook to /api/webhooks, the same way the real store would.
export default async function SandboxCheckout({ params, searchParams }: Props) {
  if (!config.sandboxNetworks) notFound();
  const { clickId } = await params;
  const { order, result } = await searchParams;

  const row = db
    .select({ click: clicks, product: products, handle: accounts.handle })
    .from(clicks)
    .innerJoin(products, eq(products.id, clicks.productId))
    .innerJoin(accounts, eq(accounts.id, clicks.accountId))
    .where(eq(clicks.id, clickId))
    .get();
  if (!row) notFound();

  const { click, product, handle } = row;
  const store = click.destination === "brand" ? (product.brandName ?? "Brand site") : networkLabel(click.destination);
  const unit = priceNow(product);

  return (
    <div className="min-h-dvh bg-[#e9e9eb] font-[system-ui,-apple-system,sans-serif] text-[#1d1d1f]">
      <div className="bg-[#1d1d1f] px-4 py-2.5 text-center text-[13px] text-white">
        Sandbox store standing in for {store}. No real payment is taken.
      </div>
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="text-[13px] text-[#6e6e73]">{store} (simulated)</p>

        {order ? (
          <section className="mt-3 rounded-2xl bg-white p-5">
            <h1 className="text-xl font-semibold">Order placed</h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">Order {order}</p>
            <div className="mt-4 rounded-xl bg-[#f5f5f7] p-3 text-[13px]">
              <p className="font-semibold">What the store reported to Caught</p>
              <p className="mt-1 font-mono">{result ?? "Sent"}</p>
            </div>
            <Link href={`/${handle}`} className="mt-5 block rounded-xl bg-[#1d1d1f] py-3 text-center font-semibold text-white">
              Back to @{handle}
            </Link>
          </section>
        ) : (
          <form action={placeOrder} className="mt-3 rounded-2xl bg-white p-5">
            <input type="hidden" name="clickId" value={click.id} />
            <div className="flex gap-4">
              {product.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="size-20 rounded-lg object-cover" />
              )}
              <div>
                <h1 className="text-lg leading-snug font-semibold">{product.name}</h1>
                <p className="mt-1 text-[15px]">{money(unit)}</p>
              </div>
            </div>
            <label className="mt-5 flex items-center justify-between text-[15px]">
              Quantity
              <select name="quantity" defaultValue="1" className="rounded-lg border border-[#d2d2d7] px-3 py-1.5">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <p className="mt-4 text-[13px] text-[#6e6e73]">
              Tracking id from Caught: <span className="font-mono">{click.id}</span>
            </p>
            <button type="submit" className="mt-5 w-full rounded-xl bg-[#1d1d1f] py-3.5 font-semibold text-white">
              Place test order
            </button>
            <Link href={`/${handle}/${product.number}`} className="mt-3 block text-center text-[14px] text-[#6e6e73] underline">
              Leave without buying
            </Link>
          </form>
        )}
      </main>
    </div>
  );
}
