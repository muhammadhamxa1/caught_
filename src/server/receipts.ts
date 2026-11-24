import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, commissions, products, sales } from "@/db/schema";
import { NETWORKS } from "./networks";

/** Public data for a shareable receipt. No buyer details, no click data. */
export function loadReceipt(receiptId: string) {
  if (!/^[A-Za-z0-9]{6,20}$/.test(receiptId)) return null;
  const row = db
    .select({ sale: sales, c: commissions, number: products.number, name: products.name, handle: accounts.handle, displayName: accounts.displayName })
    .from(sales)
    .innerJoin(commissions, eq(commissions.saleId, sales.id))
    .innerJoin(products, eq(products.id, sales.productId))
    .innerJoin(accounts, eq(accounts.id, sales.accountId))
    .where(eq(sales.receiptId, receiptId))
    .get();
  if (!row) return null;
  return {
    receiptId,
    handle: row.handle,
    displayName: row.displayName,
    number: row.number,
    name: row.name,
    store: row.sale.destination === "brand" ? "the brand site" : NETWORKS[row.sale.destination].label,
    placedAt: row.sale.placedAt,
    saleCents: row.sale.baseCents,
    rateBps: row.c.rateBps,
    commissionCents: row.c.amountCents,
    refunded: row.c.status === "reversed",
  };
}
