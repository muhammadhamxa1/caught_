import { randomBytes } from "node:crypto";

const LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const MIXED =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Rejection sampling so every character is equally likely.
function random(length: number, alphabet: string) {
  const max = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < max) out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Internal primary keys. */
export const newId = () => random(16, LOWER);

/** Ids that end up in URLs (click ids, receipt ids). Short but hard to guess. */
export const publicId = (length = 12) => random(length, MIXED);

/** Human friendly refs like PO-7H3KQ2, no 0/O or 1/I to avoid misreads. */
export const humanRef = (prefix: string) =>
  `${prefix}-${random(6, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}`;

export const token = (bytes = 32) => randomBytes(bytes).toString("base64url");
