import type { Entry } from "@/db/schema";

type Payload = {
  handle: string;
  type: "page_view" | "product_view" | "search";
  productId?: string;
  videoId?: string | null;
  entry?: Entry;
  query?: string;
  resultCount?: number;
};

/** Fire and forget. sendBeacon survives the page closing, fetch is the fallback. */
export function track(payload: Payload) {
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // some in-app browsers block beacons
  }
  fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(
    () => {},
  );
}
