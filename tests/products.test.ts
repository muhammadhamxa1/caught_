import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, products } from "@/db/schema";
import { addSignup, parseContact } from "@/server/notify";
import {
  archiveProduct,
  markInStock,
  markSoldOut,
  resolveBackup,
  updateProduct,
  type Product,
} from "@/server/products";
import { checkClaims } from "@/lib/claims";
import { localKit } from "@/server/writer/captions";
import { makeCreator, makeProduct } from "./helpers";

describe("product numbers", () => {
  it("counts up and never reuses a number", () => {
    const { accountId } = makeCreator();
    const a = makeProduct(accountId, []);
    const b = makeProduct(accountId, []);
    archiveProduct(b.id);
    const c = makeProduct(accountId, []);
    expect([a.number, b.number, c.number]).toEqual([1, 2, 3]);
  });
});

describe("sold out and backups", () => {
  it("follows the backup chain to something in stock", () => {
    const { accountId } = makeCreator();
    const a = makeProduct(accountId, []);
    const b = makeProduct(accountId, []);
    const c = makeProduct(accountId, []);
    markSoldOut(b.id, c.id);
    markSoldOut(a.id, null);
    db.update(products).set({ backupProductId: b.id }).where(eq(products.id, a.id)).run();

    const all = db.select().from(products).all();
    const byId = new Map<string, Product>(all.map((p) => [p.id, p]));
    expect(resolveBackup(byId.get(a.id)!, byId)?.id).toBe(c.id);
  });

  it("refuses a backup that is itself sold out", () => {
    const { accountId } = makeCreator();
    const a = makeProduct(accountId, []);
    const b = makeProduct(accountId, []);
    markSoldOut(b.id, null);
    expect(() => markSoldOut(a.id, b.id)).toThrow();
  });
});

describe("text me when it's on sale", () => {
  it("reads phones and emails", () => {
    expect(parseContact("(555) 201-3344")).toEqual({ channel: "sms", contact: "+15552013344" });
    expect(parseContact("Maya@Example.com ")).toEqual({ channel: "email", contact: "maya@example.com" });
    expect(parseContact("hello")).toBeNull();
    expect(parseContact("123")).toBeNull();
  });

  it("messages people when the product goes on sale or comes back", () => {
    const { accountId } = makeCreator();
    const p = makeProduct(accountId, []);
    addSignup(p.id, "555 201 3344");
    addSignup(p.id, "555 201 3344"); // same person twice is one signup

    const sent = updateProduct(p.id, {
      name: p.name,
      imageUrl: null,
      category: p.category,
      keywords: "",
      priceCents: p.priceCents,
      salePriceCents: p.priceCents - 500,
      tiktokUrl: p.tiktokUrl,
      amazonUrl: null,
      brandUrl: null,
      brandName: null,
      rules: [],
    });
    expect(sent).toBe(1);

    markSoldOut(p.id, null);
    addSignup(p.id, "fan@example.com");
    expect(markInStock(p.id)).toBe(1);
    expect(db.select().from(messages).where(eq(messages.accountId, accountId)).all()).toHaveLength(2);
  });
});

describe("caption writer", () => {
  it("flags health claims and leaves normal copy alone", () => {
    expect(checkClaims("this cured my acne in a week").map((h) => h.id)).toEqual(["cure", "conditions"]);
    expect(checkClaims("my lips look glassy all day")).toHaveLength(0);
  });

  it("puts the number in every kit", () => {
    const kit = localKit(
      { number: 47, name: "Cherry lip oil", category: "beauty", priceCents: 1499, salePriceCents: null },
      "mayafinds",
    );
    expect(kit.caption).toContain("#47");
    expect(kit.pinnedComment).toContain("caughtshop.com/mayafinds");
    expect(kit.hooks).toHaveLength(3);
    expect(checkClaims(kit.hooks.join(" "))).toHaveLength(0);
  });
});

describe("image links", () => {
  it("keeps our own paths and refuses odd schemes", async () => {
    const { cleanImageUrl } = await import("@/server/uploads");
    expect(cleanImageUrl("/demo/products/cherry-lip-oil.svg")).toBe("/demo/products/cherry-lip-oil.svg");
    expect(cleanImageUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(cleanImageUrl("javascript:alert(1)")).toBeNull();
    expect(cleanImageUrl("//evil.example/x.png")).toBeNull();
    expect(cleanImageUrl("")).toBeNull();
  });
});
