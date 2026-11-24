// What the public page is allowed to see. No store links, no commission
// rates, no internal flags. Buy buttons go through /go so every click is
// logged before the viewer leaves.

export type PublicProduct = {
  id: string;
  number: number;
  name: string;
  imageUrl: string | null;
  category: string;
  keywords: string;
  priceCents: number;
  salePriceCents: number | null;
  status: "active" | "sold_out" | "archived";
  backupId: string | null;
  hasAmazon: boolean;
  brandName: string | null;
  hasBrand: boolean;
};

export type PublicVideo = {
  id: string;
  caption: string;
  thumbnailUrl: string | null;
  views: number;
  postedAt: number;
  productIds: string[];
};

export type Storefront = {
  account: {
    id: string;
    handle: string;
    displayName: string;
    bio: string;
    avatarUrl: string | null;
    socials: Record<string, string>;
  };
  products: PublicProduct[];
  videos: PublicVideo[];
};

/** Same rule as the server side resolveBackup, for the public shape. */
export function backupFor(product: PublicProduct, all: PublicProduct[]) {
  const byId = new Map(all.map((p) => [p.id, p]));
  let current: PublicProduct | undefined = product;
  for (let hop = 0; hop < 4 && current?.backupId; hop++) {
    const next = byId.get(current.backupId);
    if (!next || next.id === product.id) return null;
    if (next.status === "active") return next;
    current = next;
  }
  return null;
}
