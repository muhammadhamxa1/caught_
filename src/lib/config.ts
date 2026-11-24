function int(name: string, fallback: number) {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  sandboxNetworks: process.env.SANDBOX_NETWORKS !== "false",
  payoutMinCents: int("PAYOUT_MIN_CENTS", 2500),
  payoutAutoApproveMaxCents: int("PAYOUT_AUTO_APPROVE_MAX_CENTS", 25000),
  secrets: {
    tiktok: process.env.TIKTOK_WEBHOOK_SECRET || "dev-tiktok-secret",
    amazon: process.env.AMAZON_WEBHOOK_SECRET || "dev-amazon-secret",
    brand: process.env.BRAND_WEBHOOK_SECRET || "dev-brand-secret",
    payouts: process.env.PAYOUT_WEBHOOK_SECRET || "dev-payout-secret",
  },
  writer: {
    url: process.env.WRITER_API_URL || "",
    key: process.env.WRITER_API_KEY || "",
    model: process.env.WRITER_MODEL || "",
  },
};

/** Host shown to viewers in copy, like caughtshop.com/mayafinds/47 */
export const PUBLIC_HOST = "caughtshop.com";
