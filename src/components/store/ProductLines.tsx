import Link from "next/link";
import type { Entry } from "@/db/schema";
import type { PublicProduct } from "@/lib/public";
import { Price, ProductImage } from "@/components/ui";

// The product list reads like a receipt: number, item, dotted leader, price.
export function ProductLines({
  handle,
  products,
  entry,
  videoId,
}: {
  handle: string;
  products: PublicProduct[];
  entry: Entry;
  videoId?: string;
}) {
  return (
    <ul className="divide-y divide-rule">
      {products.map((p) => {
        const q = new URLSearchParams({ e: entry });
        if (videoId) q.set("v", videoId);
        const soldOut = p.status === "sold_out";
        return (
          <li key={p.id}>
            <Link
              href={`/${handle}/${p.number}?${q}`}
              className="flex items-center gap-3 py-2.5 transition-colors hover:bg-sunk/60 active:bg-sunk"
            >
              <span className="num w-11 shrink-0 text-[0.9375rem] font-semibold">#{p.number}</span>
              <ProductImage src={p.imageUrl} alt="" size={44} muted={soldOut} className="shrink-0" />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className={`truncate ${soldOut ? "text-ink-3" : ""}`}>{p.name}</span>
                <span className="leader hidden min-[380px]:block" />
              </span>
              {soldOut ? (
                <span className="shrink-0 text-sm text-ink-3">Sold out</span>
              ) : (
                <Price priceCents={p.priceCents} salePriceCents={p.salePriceCents} className="shrink-0 text-sm" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
