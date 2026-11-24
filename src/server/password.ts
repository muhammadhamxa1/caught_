import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );

// scrypt is in node core, so no native bcrypt build step for reviewers.
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, n, rr, pp, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  return timingSafeEqual(key, expected);
}
