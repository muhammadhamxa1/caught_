const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const usdShort = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function money(cents: number) {
  return usd.format(cents / 100);
}

/** $1,284 instead of $1,284.37, for chart labels and tight spaces. */
export function moneyShort(cents: number) {
  return usdShort.format(Math.round(cents / 100));
}

export function rate(bps: number) {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** Round half up on integer cents. Used for every commission line. */
export function applyRate(baseCents: number, bps: number) {
  return Math.round((baseCents * bps) / 10_000);
}

/** "14.99" or "$14.99" to 1499. Returns null when it can't be read. */
export function parseMoney(input: string | null | undefined) {
  if (!input) return null;
  const clean = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(".0K", "K");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
}

export function percent(part: number, whole: number) {
  if (!whole) return "0%";
  const p = (part / whole) * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
}
