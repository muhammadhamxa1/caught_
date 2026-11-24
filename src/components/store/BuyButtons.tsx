import type { Entry } from "@/db/schema";
import type { PublicProduct } from "@/lib/public";
import { buyHref } from "@/lib/links";

// TikTok Shop is always the main button. It's where the creator earns the
// most and where the viewer already has an account. The others sit below
// it so a viewer who trusts Amazon more still buys through the creator.
export function BuyButtons({
  product,
  entry,
  videoId,
  size = "lg",
}: {
  product: PublicProduct;
  entry: Entry;
  videoId?: string | null;
  size?: "lg" | "md";
}) {
  const tall = size === "lg" ? "h-14 text-[1.0625rem]" : "h-12 text-base";
  const others = [
    product.hasAmazon ? { dest: "amazon" as const, label: "Amazon" } : null,
    product.hasBrand ? { dest: "brand" as const, label: product.brandName ?? "Brand site" } : null,
  ].filter(Boolean) as { dest: "amazon" | "brand"; label: string }[];

  return (
    <div className="grid gap-2">
      <a href={buyHref(product.id, "tiktok", entry, videoId)} className={`btn btn-primary w-full ${tall}`} rel="nofollow">
        Buy on TikTok Shop
      </a>
      {others.length > 0 && (
        <div className={`grid gap-2 ${others.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {others.map((o) => (
            <a key={o.dest} href={buyHref(product.id, o.dest, entry, videoId)} className="btn btn-secondary h-12 px-3 text-[0.9375rem]" rel="nofollow">
              <span className="truncate">{others.length === 1 ? `Buy on ${o.label}` : o.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
