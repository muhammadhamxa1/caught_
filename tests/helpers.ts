import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { newId } from "@/lib/ids";
import { createProduct, type RuleInput } from "@/server/products";
import { recordClick } from "@/server/tracking";
import type { Destination } from "@/db/schema";

export const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_36.1.0 BytedanceWebview";

let n = 0;

export function makeCreator() {
  n++;
  const userId = newId();
  db.insert(users)
    .values({ id: userId, email: `c${n}@test.dev`, name: `Creator ${n}`, passwordHash: "x", createdAt: new Date() })
    .run();
  const accountId = newId();
  db.insert(accounts)
    .values({ id: accountId, userId, handle: `creator${n}`, displayName: `Creator ${n}`, createdAt: new Date() })
    .run();
  return { userId, accountId };
}

export function makeProduct(accountId: string, rules: RuleInput[], priceCents = 2000) {
  return createProduct(accountId, {
    name: "Test lip oil",
    imageUrl: null,
    category: "beauty",
    keywords: "",
    priceCents,
    salePriceCents: null,
    tiktokUrl: "https://shop.tiktok.com/view/product/1",
    amazonUrl: "https://www.amazon.com/dp/B000000001",
    brandUrl: null,
    brandName: null,
    rules,
  });
}

export function click(accountId: string, productId: string, destination: Destination = "tiktok", at = new Date()) {
  return recordClick({ accountId, productId, destination, entry: "number", userAgent: PHONE_UA, at });
}
