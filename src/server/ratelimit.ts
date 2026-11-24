// Fixed window counter in memory. Fine for one process. With more than one
// instance this moves to Redis with the same interface.

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
let lastSweep = Date.now();

export function allow(key: string, max: number, windowMs: number, now = Date.now()) {
  if (now - lastSweep > 60_000) {
    for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }

  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= max) return false;
  w.count++;
  return true;
}

export function clientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "local"
  );
}
