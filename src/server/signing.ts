import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe style signature header: t=<unix seconds>,v1=<hex hmac of "t.body">.
// Signing the timestamp with the body stops old requests from being replayed.

export const SIGNATURE_HEADER = "x-caught-signature";
const TOLERANCE_SECONDS = 5 * 60;

function hmac(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function sign(secret: string, body: string, now = Date.now()) {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${hmac(secret, `${t}.${body}`)}`;
}

export function verify(
  secret: string,
  body: string,
  header: string | null,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!header) return { ok: false, reason: "Missing signature" };

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const given = parts.v1;
  if (!Number.isFinite(t) || !given) return { ok: false, reason: "Malformed signature" };

  if (Math.abs(now / 1000 - t) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "Signature timestamp too old" };
  }

  const expected = Buffer.from(hmac(secret, `${t}.${body}`), "hex");
  const actual = Buffer.from(given, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}
