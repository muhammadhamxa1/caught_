import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Finder } from "@/components/store/Finder";
import { ProductLines } from "@/components/store/ProductLines";
import { Socials } from "@/components/store/Socials";
import { StoreFooter } from "@/components/store/StoreFooter";
import { VideoGrid } from "@/components/store/VideoGrid";
import { ViewBeacon } from "@/components/store/ViewBeacon";
import { Avatar } from "@/components/ui";
import { loadStorefront } from "@/server/storefront";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = loadStorefront((await params).handle);
  if (!store) return { title: "Not found" };
  return {
    title: `${store.account.displayName} (@${store.account.handle})`,
    description: store.account.bio,
  };
}

export default async function BioPage({ params }: Props) {
  const store = loadStorefront((await params).handle);
  if (!store) notFound();

  const { account } = store;
  const firstName = account.displayName.split(/[\s']/)[0];
  const listed = store.products.filter((p) => p.status !== "archived");
  const byId = new Map(store.products.map((p) => [p.id, p]));
  const latestNumbers = (store.videos[0]?.productIds ?? [])
    .map((id) => byId.get(id)?.number)
    .filter((n): n is number => typeof n === "number");

  return (
    <main className="mx-auto max-w-[34rem] px-5 pt-8 pb-10">
      <ViewBeacon handle={account.handle} type="page_view" />

      <header className="flex items-center gap-4">
        <Avatar name={account.displayName} url={account.avatarUrl} size={64} />
        <div className="min-w-0">
          <h1 className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em]">{account.displayName}</h1>
          <p className="text-[0.9375rem] text-ink-2">@{account.handle}</p>
        </div>
      </header>
      {account.bio && <p className="mt-4 max-w-[60ch] text-[0.9375rem] leading-relaxed">{account.bio}</p>}
      <div className="mt-4">
        <Socials socials={account.socials} />
      </div>

      <div className="mt-8">
        <Finder handle={account.handle} firstName={firstName} products={store.products} latestNumbers={latestNumbers} />
      </div>

      {store.videos.length > 0 && (
        <section className="mt-11" aria-labelledby="videos">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="videos" className="text-lg font-semibold">
              Find it by video
            </h2>
            <span className="num text-sm text-ink-3">{store.videos.length}</span>
          </div>
          <VideoGrid handle={account.handle} videos={store.videos} products={store.products} />
        </section>
      )}

      <section className="mt-11" aria-labelledby="all">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="all" className="text-lg font-semibold">
            Everything on this page
          </h2>
          <span className="num text-sm text-ink-3">{listed.length}</span>
        </div>
        <ProductLines handle={account.handle} products={listed} entry="list" />
      </section>

      <StoreFooter firstName={firstName} />
    </main>
  );
}
