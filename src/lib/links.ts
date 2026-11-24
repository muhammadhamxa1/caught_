import type { Entry } from "@/db/schema";

/** Buy buttons point at /go, which logs the click and then redirects. */
export function buyHref(productId: string, dest: "tiktok" | "amazon" | "brand", entry: Entry, videoId?: string | null) {
  const q = new URLSearchParams({ e: entry });
  if (videoId) q.set("v", videoId);
  return `/go/${productId}/${dest}?${q}`;
}
