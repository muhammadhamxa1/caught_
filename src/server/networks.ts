import type { Destination } from "@/db/schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type Network = {
  label: string;
  /** How long after a click a purchase still counts. Set by each network. */
  attributionWindowMs: number;
  /** Days after delivery before a commission clears, covers the return window. */
  holdDays: number;
  /** Query param the network reads our click id from. */
  trackingParam: string;
};

export const NETWORKS: Record<Destination, Network> = {
  tiktok: {
    label: "TikTok Shop",
    attributionWindowMs: 7 * DAY,
    holdDays: 15,
    trackingParam: "affiliate_click_id",
  },
  amazon: {
    label: "Amazon",
    // Amazon's cookie only lasts 24 hours
    attributionWindowMs: 24 * HOUR,
    holdDays: 30,
    trackingParam: "ascsubtag",
  },
  brand: {
    label: "Brand site",
    attributionWindowMs: 30 * DAY,
    holdDays: 30,
    trackingParam: "subid",
  },
};

export const DAY_MS = DAY;

export function networkLabel(d: Destination) {
  return NETWORKS[d].label;
}

/**
 * Where a buy click goes outside the sandbox. We append our click id in the
 * param each network passes back on its conversion report.
 */
export function outboundUrl(destination: Destination, url: string, clickId: string) {
  const u = new URL(url);
  u.searchParams.set(NETWORKS[destination].trackingParam, clickId);
  return u.toString();
}
