import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ENTRIES, type Entry } from "@/db/schema";
import { BuyButtons } from "@/components/store/BuyButtons";
import { NotifyForm } from "@/components/store/NotifyForm";
import { StoreFooter } from "@/components/store/StoreFooter";
import { ViewBeacon } from "@/components/store/ViewBeacon";
import { Price, ProductImage } from "@/components/ui";
import { backupFor, type PublicProduct, type Storefront } from "@/lib/public";
import { compact } from "@/lib/money";
import { loadStorefront, productByNumber, videosFor } from "@/server/storefront";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string; number: string }>;
  searchParams: Promise<{ e?: string; v?: string }>;
};

async function load(props: Props) {
  const { handle, number } = await props.params;
  const n = Number(number.replace(/^#/, ""));
  const store = loadStorefront(handle);
  if (!store || !Number.isInteger(n)) return null;
  return { store, n, product: productByNumber(store, n) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(props);
  if (!data?.product) return { title: "Not found" };
  return { title: `#${data.product.number} ${data.product.name}` };
}

export default async function ProductPage(props: Props) {
  const data = await load(props);
  if (!data) notFound();
  const { store, n, product } = data;
  const { account } = store;
  const firstName = account.displayName.split(/[\s']/)[0];

  const sp = await props.searchParams;
  const entry: Entry = (ENTRIES as readonly string[]).includes(sp.e ?? "") ? (sp.e as Entry) : "direct";
  const videoId = sp.v && store.videos.some((v) => v.id === sp.v) ? sp.v : null;

  return (
    <main className="mx-auto max-w-[34rem] px-5 pt-5 pb-10">
      <Link href={`/${account.handle}`} className="inline-flex items-center gap-1.5 py-2 text-[0.9375rem] text-ink-2 hover:text-ink">
        <ArrowLeft size={18} aria-hidden />
        All of {firstName}&apos;s finds
      </Link>

      {!product ? (
        <div className="mt-6 rounded-2xl bg-sunk p-5">
          <p className="text-lg">
            There is no <span className="num font-semibold">#{n}</span> on {firstName}&apos;s page.
          </p>
          <p className="mt-1 text-ink-2">Check the number in the video, or search by name.</p>
          <Link href={`/${account.handle}`} className="btn btn-primary mt-4 h-12 w-full">
            Search {firstName}&apos;s page
          </Link>
        </div>
      ) : (
        <>
          <ViewBeacon handle={account.handle} type="product_view" productId={product.id} entry={entry} videoId={videoId} />
          {product.status === "active" ? (
            <Receipt product={product} entry={entry} videoId={videoId} />
          ) : (
            <Unavailable store={store} product={product} firstName={firstName} />
          )}
          <InVideos store={store} product={product} handle={account.handle} />
        </>
      )}

      <StoreFooter firstName={firstName} />
    </main>
  );
}

function Receipt({ product, entry, videoId }: { product: PublicProduct; entry: Entry; videoId: string | null }) {
  const onSale = product.salePriceCents !== null && product.salePriceCents < product.priceCents;
  return (
    <div className="lift mt-3">
      <article className="torn bg-sheet px-5 pt-5 pb-9">
        <ProductImage src={product.imageUrl} alt={product.name} className="aspect-square w-full" />
        <div className="mt-5 flex items-end justify-between gap-3">
          <span className="num text-[2.75rem] leading-none font-semibold tracking-[-0.03em]">#{product.number}</span>
          <Price priceCents={product.priceCents} salePriceCents={product.salePriceCents} className="pb-1 text-xl" />
        </div>
        <h1 className="mt-2 text-[1.375rem] leading-snug font-semibold">{product.name}</h1>
        {onSale && <p className="mt-1 text-[0.9375rem] text-ink-2">On sale right now.</p>}
        <div className="mt-5">
          <BuyButtons product={product} entry={entry} videoId={videoId} />
        </div>
        <hr className="perf my-6" />
        <NotifyForm productId={product.id} number={product.number} soldOut={false} />
      </article>
    </div>
  );
}

function Unavailable({ store, product, firstName }: { store: Storefront; product: PublicProduct; firstName: string }) {
  const backup = backupFor(product, store.products);
  const soldOut = product.status === "sold_out";
  return (
    <div className="mt-3">
      <div className="flex items-center gap-4 rounded-2xl bg-sunk p-4">
        <ProductImage src={product.imageUrl} alt="" size={64} muted className="shrink-0" />
        <div>
          <p className="num text-lg font-semibold">#{product.number}</p>
          <p className="leading-snug">
            {product.name} {soldOut ? "is sold out." : "is no longer listed."}
          </p>
        </div>
      </div>

      {backup ? (
        <>
          <p className="mt-6 mb-1 text-lg">
            {firstName} picked <span className="num font-semibold">#{backup.number}</span> instead.
          </p>
          <Receipt product={backup} entry="backup" videoId={null} />
        </>
      ) : (
        <Link href={`/${store.account.handle}`} className="btn btn-primary mt-5 h-12 w-full">
          See what else {firstName} has
        </Link>
      )}

      {soldOut && (
        <div className="mt-8">
          <NotifyForm productId={product.id} number={product.number} soldOut />
        </div>
      )}
    </div>
  );
}

function InVideos({ store, product, handle }: { store: Storefront; product: PublicProduct; handle: string }) {
  const list = videosFor(store, product.id).slice(0, 3);
  if (list.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="in-videos">
      <h2 id="in-videos" className="mb-3 text-base font-semibold">
        In {list.length === 1 ? "this video" : "these videos"}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {list.map((v) => (
          <li key={v.id}>
            <Link href={`/${handle}#videos`} className="block">
              <span className="relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-ink">
                {v.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
                )}
                <span className="num absolute bottom-1.5 left-1.5 text-[0.75rem] text-paper">{compact(v.views)} views</span>
              </span>
              <span className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-2">{v.caption}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
