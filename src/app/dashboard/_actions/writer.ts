"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, products } from "@/db/schema";
import { allow } from "@/server/ratelimit";
import { ownsAccount, requireUser } from "@/server/session";
import { writeKit, type WriterResult } from "@/server/writer";

export async function writeKitAction(productId: string, seed: number): Promise<{ error?: string; kit?: WriterResult }> {
  const user = await requireUser();
  if (!allow(`writer:${user.id}`, 30, 60_000)) return { error: "Slow down a little, then try again." };

  const row = db
    .select({ p: products, handle: accounts.handle })
    .from(products)
    .innerJoin(accounts, eq(accounts.id, products.accountId))
    .where(eq(products.id, productId))
    .get();
  if (!row || !ownsAccount(user.id, row.p.accountId)) return { error: "Pick one of your products." };

  const kit = await writeKit(
    {
      number: row.p.number,
      name: row.p.name,
      category: row.p.category,
      priceCents: row.p.priceCents,
      salePriceCents: row.p.salePriceCents,
    },
    row.handle,
    seed,
  );
  return { kit };
}
