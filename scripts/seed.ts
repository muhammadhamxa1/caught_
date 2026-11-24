/**
 * Builds the demo from scratch: one login with two creator accounts, real
 * catalog products, videos, and 90 days of simulated viewers.
 *
 * Nothing is inserted as a finished number. Every visit, click, order,
 * refund and payout goes through the same functions the app uses, in time
 * order, so the dashboards and the ledger agree with each other.
 */
import fs from "node:fs";
import path from "node:path";
import type { SimProduct } from "../src/sandbox/traffic";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env yet, defaults are fine for a local seed
}

const DB_PATH = process.env.DATABASE_PATH || "data/caught.db";

async function main() {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // imported after the old file is gone so the connection opens a fresh db
  const { db, runMigrations } = await import("../src/db");
  const schema = await import("../src/db/schema");
  const { createUser, createAccount } = await import("../src/server/accounts");
  const { createProduct, markSoldOut, markInStock, archiveProduct, setBackup, updateProduct } =
    await import("../src/server/products");
  const { attributeOrder } = await import("../src/server/tracking");
  const { markShipped, markDelivered, applyRefund, settleDue } = await import("../src/server/commissions");
  const { balancesFor } = await import("../src/server/ledger");
  const { requestPayout, movePayout, savePayoutMethod, maskEmail } = await import("../src/server/payouts");
  const { sendWaiting } = await import("../src/server/notify");
  const { CATALOG, tiktokUrl, amazonUrl, brandUrl, artUrl } = await import("../src/sandbox/catalog");
  const { seeded, simulateVisit, CONVERSION } = await import("../src/sandbox/traffic");
  const { newOrderId } = await import("../src/sandbox/emit");
  const { eq } = await import("drizzle-orm");

  runMigrations();

  const rand = seeded(20261121);
  const NOW = new Date();
  const DAY = 86_400_000;
  const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
  const between = (a: number, b: number) => a + rand() * (b - a);
  // the simulated "now" while we walk through the 90 days
  let currentTime = ago(95);

  // ---------- creator ----------
  const userId = await createUser("demo@caughtshop.com", "Maya Reyes", "nothingslips", ago(96));

  const finds = createAccount(
    userId,
    {
      handle: "mayafinds",
      displayName: "Maya Reyes",
      bio: "Everyday finds under $30. Skincare, hair and a little home. Type the number from my video.",
      socials: {
        tiktok: "https://www.tiktok.com/@mayafinds",
        instagram: "https://www.instagram.com/mayafinds",
        youtube: "https://www.youtube.com/@mayafinds",
        amazon: "https://www.amazon.com/shop/mayafinds",
      },
    },
    ago(95),
  );

  const kitchen = createAccount(
    userId,
    {
      handle: "mayakitchen",
      displayName: "Maya's Kitchen",
      bio: "Kitchen gadgets I actually use. Small kitchen, honest reviews.",
      socials: {
        tiktok: "https://www.tiktok.com/@mayakitchen",
        instagram: "https://www.instagram.com/mayakitchen",
      },
    },
    ago(62),
  );

  // ---------- videos ----------
  type VideoSeed = { caption: string; numbers: number[]; views: number; daysAgo: number; basket?: "pulled" };

  const findsVideos: VideoSeed[] = [
    { caption: "satin pillowcase for frizz, my hair in the morning is so different", numbers: [1], views: 120_000, daysAgo: 88 },
    { caption: "heatless curls that actually last all day", numbers: [2], views: 410_000, daysAgo: 84 },
    { caption: "the claw clips that don't slip out", numbers: [3, 10], views: 95_000, daysAgo: 80 },
    { caption: "ice roller every morning before makeup", numbers: [4], views: 260_000, daysAgo: 77 },
    { caption: "vitamin c serum, honest 4 week review", numbers: [5], views: 180_000, daysAgo: 73 },
    { caption: "lash serum week 6 update", numbers: [6], views: 530_000, daysAgo: 70 },
    { caption: "these patches cleared my acne in a week", numbers: [12], views: 340_000, daysAgo: 66, basket: "pulled" },
    { caption: "brow gel and under eye stick, 2 minute face", numbers: [7, 11], views: 150_000, daysAgo: 63 },
    { caption: "whiter teeth before my sister's wedding", numbers: [18], views: 210_000, daysAgo: 55, basket: "pulled" },
    { caption: "mini straightener for bangs, fits in my bag", numbers: [9], views: 88_000, daysAgo: 54 },
    { caption: "the sunscreen stick I actually reapply", numbers: [13], views: 140_000, daysAgo: 52 },
    { caption: "gua sha and jade roller, 5 minutes at night", numbers: [16, 20], views: 205_000, daysAgo: 49 },
    { caption: "rosemary oil for hair growth, month 2", numbers: [17], views: 760_000, daysAgo: 45, basket: "pulled" },
    { caption: "this LED mirror changed my whole vanity", numbers: [19], views: 120_000, daysAgo: 42 },
    { caption: "peel off lip stain, does it last through lunch?", numbers: [21], views: 300_000, daysAgo: 38 },
    { caption: "body butter that smells like a bakery", numbers: [25, 27], views: 175_000, daysAgo: 35 },
    { caption: "lint remover saved my favorite sweater", numbers: [28], views: 92_000, daysAgo: 31 },
    { caption: "sunset lamp, golden hour all day", numbers: [31], views: 640_000, daysAgo: 27 },
    { caption: "travel things under $20 I won't fly without", numbers: [29, 30, 33, 35], views: 230_000, daysAgo: 24 },
    { caption: "hair dryer brush vs my old blowout", numbers: [36], views: 410_000, daysAgo: 19 },
    { caption: "peach lip oil is my whole personality now", numbers: [43], views: 880_000, daysAgo: 15 },
    { caption: "night routine that healed my dry skin in a week", numbers: [40, 45, 41], views: 260_000, daysAgo: 10, basket: "pulled" },
    { caption: "bronzing drops for that summer glow", numbers: [42], views: 320_000, daysAgo: 6 },
    { caption: "the peach one sold out so here's the swap, cherry is even better", numbers: [47, 43], views: 1_200_000, daysAgo: 2 },
    { caption: "glass skin serum first impressions", numbers: [48], views: 150_000, daysAgo: 4 },
  ];

  const kitchenVideos: VideoSeed[] = [
    { caption: "mini waffle maker, 3 minute breakfast", numbers: [1], views: 310_000, daysAgo: 58 },
    { caption: "this chopper saves me 10 minutes every night", numbers: [2], views: 520_000, daysAgo: 52 },
    { caption: "oil sprayer + air fryer liners, no more scrubbing", numbers: [3, 4], views: 240_000, daysAgo: 46 },
    { caption: "iced latte at home for 40 cents", numbers: [5], views: 180_000, daysAgo: 40 },
    { caption: "meal prep in glass, finally", numbers: [6], views: 95_000, daysAgo: 33 },
    { caption: "spice jars on the fridge, small kitchen hack", numbers: [8], views: 410_000, daysAgo: 25 },
    { caption: "kitchen things under $15 that earn their spot", numbers: [7, 11, 12, 13], views: 280_000, daysAgo: 16 },
    { caption: "pan organizer, my cabinet before and after", numbers: [10], views: 150_000, daysAgo: 9 },
    { caption: "packing lunch in 4 minutes", numbers: [14, 6], views: 120_000, daysAgo: 3 },
  ];

  // ---------- products ----------
  // A product is created a little before its first video, and numbers go up
  // with time, so walk backwards to keep both true.
  function creationDays(count: number, videos: VideoSeed[], start: number, end: number) {
    const days = Array.from({ length: count }, (_, i) => start - ((start - end) * i) / Math.max(count - 1, 1));
    for (const v of videos) for (const n of v.numbers) days[n - 1] = Math.max(days[n - 1], v.daysAgo + 0.3);
    for (let i = count - 1; i > 0; i--) days[i - 1] = Math.max(days[i - 1], days[i] + 0.05);
    return days;
  }

  const findsItems = CATALOG.slice(0, 48);
  const kitchenItems = CATALOG.slice(48, 62);
  const HERO: Record<string, number> = {
    "cherry-lip-oil": 3,
    "peach-lip-oil": 2.4,
    "sunset-lamp": 1.8,
    "rosemary-hair-oil": 1.8,
    "veggie-chopper": 2,
  };

  async function addProducts(accountId: string, items: typeof CATALOG, videos: VideoSeed[], start: number, end: number) {
    const days = creationDays(items.length, videos, start, end);
    const out: (SimProduct & { createdDaysAgo: number; slug: string })[] = [];
    items.forEach((item, i) => {
      const dests: ("tiktok" | "amazon" | "brand")[] = ["tiktok"];
      if (item.amazonRateBps) dests.push("amazon");
      if (item.brand) dests.push("brand");
      const p = createProduct(
        accountId,
        {
          name: item.title,
          imageUrl: artUrl(item),
          category: item.category,
          keywords: item.keywords,
          priceCents: item.priceCents,
          salePriceCents: null,
          tiktokUrl: tiktokUrl(item),
          amazonUrl: item.amazonRateBps ? amazonUrl(item) : null,
          brandUrl: brandUrl(item),
          brandName: item.brand?.name ?? null,
          catalogId: item.id,
          rules: [
            { destination: "tiktok", rateBps: item.rateBps, minMonthlyUnits: 0 },
            ...(item.tier ? [{ destination: "tiktok" as const, rateBps: item.tier.rateBps, minMonthlyUnits: item.tier.minUnits }] : []),
            ...(item.amazonRateBps ? [{ destination: "amazon" as const, rateBps: item.amazonRateBps, minMonthlyUnits: 0 }] : []),
            ...(item.brand ? [{ destination: "brand" as const, rateBps: item.brand.rateBps, minMonthlyUnits: 0 }] : []),
          ],
        },
        ago(days[i]),
      );
      out.push({
        id: p.id,
        number: p.number,
        name: p.name,
        keywords: p.keywords,
        category: p.category,
        status: "active",
        backupId: null,
        priceCents: p.priceCents,
        dests,
        weight: (HERO[item.slug] ?? 1) * between(0.5, 1.5),
        createdDaysAgo: days[i],
        slug: item.slug,
      });
    });
    return out;
  }

  const findsProducts = await addProducts(finds, findsItems, findsVideos, 94, 0.6);
  const kitchenProducts = await addProducts(kitchen, kitchenItems, kitchenVideos, 61, 4);

  function addVideos(accountId: string, list: VideoSeed[], prods: typeof findsProducts, handle: string) {
    return list.map((v, i) => {
      const id = `${handle}-v${i + 1}`;
      const lead = prods.find((p) => p.number === v.numbers[0])!;
      db.insert(schema.videos)
        .values({
          id,
          accountId,
          url: `https://www.tiktok.com/@${handle}/video/7431${String(i * 7919 + 100003).padStart(15, "0")}`,
          thumbnailUrl: `/demo/videos/${lead.slug}.svg`,
          caption: v.caption,
          views: v.views,
          basket: v.basket ?? "live",
          postedAt: ago(v.daysAgo),
          createdAt: ago(v.daysAgo),
        })
        .run();
      const productIds = v.numbers.map((n) => prods.find((x) => x.number === n)!.id);
      productIds.forEach((productId, position) => {
        db.insert(schema.videoProducts).values({ videoId: id, productId, position }).run();
      });
      return { id, productIds, seed: v };
    });
  }

  const findsVids = addVideos(finds, findsVideos, findsProducts, "mayafinds");
  const kitchenVids = addVideos(kitchen, kitchenVideos, kitchenProducts, "mayakitchen");

  // ---------- timeline of things the creator did ----------
  const byNumber = (list: typeof findsProducts, n: number) => list.find((p) => p.number === n)!;

  type Action = { daysAgo: number; run: () => void };
  const actions: Action[] = [
    // sunset lamp sold out for a week, then came back and texted everyone waiting
    { daysAgo: 22, run: () => setStatus(byNumber(findsProducts, 31), "sold_out", byNumber(findsProducts, 19)) },
    { daysAgo: 15.5, run: () => setStatus(byNumber(findsProducts, 31), "active") },
    { daysAgo: 48, run: () => setStatus(byNumber(findsProducts, 18), "archived") },
    { daysAgo: 30, run: () => setStatus(byNumber(findsProducts, 1), "archived") },
    { daysAgo: 25, run: () => setStatus(byNumber(findsProducts, 2), "archived", byNumber(findsProducts, 44)) },
    { daysAgo: 20, run: () => setStatus(byNumber(findsProducts, 23), "archived") },
    { daysAgo: 12, run: () => setStatus(byNumber(findsProducts, 28), "archived") },
    { daysAgo: 8, run: () => setStatus(byNumber(findsProducts, 36), "sold_out", byNumber(findsProducts, 9)) },
    { daysAgo: 3, run: () => setStatus(byNumber(findsProducts, 43), "sold_out", byNumber(findsProducts, 47)) },
    { daysAgo: 9, run: () => putOnSale(byNumber(findsProducts, 22), 1599) },
    { daysAgo: 6, run: () => putOnSale(byNumber(kitchenProducts, 1), 1499) },
  ];

  function setStatus(p: (typeof findsProducts)[number], status: "active" | "sold_out" | "archived", backup?: { id: string }) {
    const at = currentTime;
    if (status === "sold_out") markSoldOut(p.id, backup?.id ?? null, at);
    if (status === "active") markInStock(p.id, at);
    if (status === "archived") {
      if (backup) setBackup(p.id, backup.id);
      archiveProduct(p.id, at);
    }
    p.status = status;
    p.backupId = backup?.id ?? p.backupId;
  }

  function putOnSale(p: (typeof findsProducts)[number], salePriceCents: number) {
    const row = db.select().from(schema.products).where(eq(schema.products.id, p.id)).get()!;
    const rules = db.select().from(schema.commissionRules).where(eq(schema.commissionRules.productId, p.id)).all();
    updateProduct(
      p.id,
      {
        name: row.name,
        imageUrl: row.imageUrl,
        category: row.category,
        keywords: row.keywords,
        priceCents: row.priceCents,
        salePriceCents,
        tiktokUrl: row.tiktokUrl,
        amazonUrl: row.amazonUrl,
        brandUrl: row.brandUrl,
        brandName: row.brandName,
        catalogId: row.catalogId,
        rules: rules.map((r) => ({ destination: r.destination, rateBps: r.rateBps, minMonthlyUnits: r.minMonthlyUnits })),
      },
      currentTime,
    );
    p.priceCents = salePriceCents;
  }

  // ---------- payouts ----------
  const payoutPlan: Action[] = [
    { daysAgo: 58, run: () => savePayoutMethod(userId, "paypal", `PayPal ${maskEmail("mayareyes@gmail.com")}`) },
    { daysAgo: 57, run: () => payout("first", (id) => [[56, () => movePayout(id, "approved", { at: currentTime })], [54, () => movePayout(id, "paid", { providerRef: "PP-4KQ7ZJ2M9X", at: currentTime })]]) },
    { daysAgo: 36, run: () => payout("second", (id) => [[35.5, () => maybeApprove(id)], [34, () => movePayout(id, "failed", { note: "PayPal account is limited. Update your payout method and try again.", at: currentTime })]]) },
    { daysAgo: 33.5, run: () => savePayoutMethod(userId, "bank", "Bank account ••4417") },
    { daysAgo: 33, run: () => payout("retry", (id) => [[32.5, () => maybeApprove(id)], [31, () => movePayout(id, "paid", { providerRef: "ACH-81920335", at: currentTime })]]) },
    { daysAgo: 21, run: () => payout("fourth", (id) => [[20.5, () => maybeApprove(id)], [19, () => movePayout(id, "paid", { providerRef: "ACH-82044172", at: currentTime })]]) },
  ];

  function maybeApprove(id: string) {
    const p = db.select().from(schema.payouts).where(eq(schema.payouts.id, id)).get()!;
    if (p.status === "pending") movePayout(id, "approved", { at: currentTime });
  }

  const followUps: { at: number; run: () => void }[] = [];
  function payout(key: string, next: (id: string) => [number, () => void][]) {
    const { available } = balancesFor(userId);
    const amount = Math.floor((available * 0.9) / 500) * 500;
    if (amount < 2500) return;
    const r = requestPayout(userId, amount, `seed-${key}`, currentTime);
    if (!r.ok) return;
    for (const [d, run] of next(r.payout.id)) followUps.push({ at: ago(d).getTime(), run });
  }

  // ---------- 90 days of viewers ----------
  type Pending = { at: number; run: () => void };
  const queue: Pending[] = [];

  const HOUR_WEIGHTS = [6, 7, 8, 7, 5, 3, 2, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6, 6];
  const hourTotal = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  function timeInDay(dayStart: number) {
    let r = rand() * hourTotal;
    let h = 0;
    while (r > HOUR_WEIGHTS[h]) r -= HOUR_WEIGHTS[h++];
    return dayStart + h * 3_600_000 + Math.floor(rand() * 3_600_000);
  }

  type Sim = {
    accountId: string;
    products: typeof findsProducts;
    videos: { id: string; productIds: string[]; seed: VideoSeed }[];
    base: number;
    startDaysAgo: number;
    misses: string[];
  };

  const sims: Sim[] = [
    {
      accountId: finds,
      products: findsProducts,
      videos: findsVids,
      base: 40,
      startDaysAgo: 94,
      misses: ["lip liner", "lip liner", "lip liner", "stanley cup", "black leggings", "blush stick", "shower filter", "shower filter", "the green hoodie", "matcha whisk", "dupe"],
    },
    {
      accountId: kitchen,
      products: kitchenProducts,
      videos: kitchenVids,
      base: 16,
      startDaysAgo: 61,
      misses: ["air fryer", "air fryer", "knife set", "rice cooker", "cutting board", "stanley"],
    },
  ];

  function scheduleOrder(click: { clickId: string; destination: "tiktok" | "amazon" | "brand"; productId: string; at: Date }, price: number) {
    const placedAt = click.at.getTime() + between(3, 120) * 60_000;
    queue.push({
      at: placedAt,
      run: () => {
        const qtyRoll = rand();
        const quantity = qtyRoll < 0.88 ? 1 : qtyRoll < 0.98 ? 2 : 3;
        const discount = click.destination === "tiktok" && rand() < 0.25 ? Math.round(price * quantity * between(0.08, 0.15)) : 0;
        const r = attributeOrder({
          destination: click.destination,
          clickId: click.clickId,
          networkOrderId: newOrderId(click.destination),
          quantity,
          unitPriceCents: price,
          discountCents: discount,
          at: new Date(placedAt),
        });
        if (!r.ok) return;
        const saleId = r.saleId;
        const shipped = placedAt + between(0.6, 2) * DAY;
        const delivered = shipped + between(2, 5) * DAY;
        queue.push({ at: shipped, run: () => markShipped(saleId, new Date(shipped)) });
        queue.push({ at: delivered, run: () => markDelivered(saleId, new Date(delivered)) });
        const roll = rand();
        if (roll < 0.05) {
          const refundAt = delivered + between(1, 12) * DAY;
          const base = quantity * price - discount;
          const amount = rand() < 0.7 ? base : Math.round(base * between(0.3, 0.6));
          queue.push({ at: refundAt, run: () => applyRefund(saleId, amount, new Date(refundAt)) });
        } else if (roll < 0.06) {
          // a late return after the commission already cleared
          const lateAt = delivered + between(32, 40) * DAY;
          queue.push({ at: lateAt, run: () => applyRefund(saleId, quantity * price - discount, new Date(lateAt)) });
        }
      },
    });
  }

  const priceOf = new Map<string, number>();
  const refreshPrices = () => {
    for (const s of sims) for (const p of s.products) priceOf.set(p.id, p.priceCents);
  };
  refreshPrices();

  const allActions = [...actions, ...payoutPlan].sort((a, b) => b.daysAgo - a.daysAgo);
  let visitCount = 0;

  for (let d = 95; d >= 0; d--) {
    const dayStart = NOW.getTime() - d * DAY;
    const dayEnd = Math.min(dayStart + DAY, NOW.getTime());

    db.transaction(() => {
      const items: Pending[] = [];

      for (const a of allActions) {
        const t = ago(a.daysAgo).getTime();
        if (t >= dayStart && t < dayEnd) items.push({ at: t, run: () => { a.run(); refreshPrices(); } });
      }

      for (const sim of sims) {
        if (d > sim.startDaysAgo) continue;
        const dow = new Date(dayStart).getUTCDay();
        const dowFactor = dow === 0 || dow === 6 ? 1.2 : 1;
        const baseCount = Math.round(sim.base * dowFactor * between(0.8, 1.2));
        const plan: { video: (typeof sim.videos)[number] | null; at: number }[] = [];

        for (let i = 0; i < baseCount; i++) plan.push({ video: null, at: timeInDay(dayStart) });
        for (const v of sim.videos) {
          const age = d - v.seed.daysAgo;
          if (age < 0) continue;
          // a spike for a few days, then a long tail. Old videos keep getting views.
          const expected = v.seed.views * 0.0006 * (Math.exp(-age / 3) * (age < 1 ? 1 - age * 0.3 : 1) + 0.02 * Math.exp(-age / 45));
          const n = Math.round(expected * between(0.8, 1.2));
          const posted = ago(v.seed.daysAgo).getTime();
          for (let i = 0; i < n; i++) {
            const t = timeInDay(dayStart);
            plan.push({ video: v, at: Math.max(t, posted + 60_000) });
          }
        }

        for (const visit of plan) {
          if (visit.at > NOW.getTime()) continue;
          items.push({
            at: visit.at,
            run: () => {
              const live = sim.products.filter((p) => NOW.getTime() - p.createdDaysAgo * DAY <= visit.at);
              const clicks = simulateVisit({
                accountId: sim.accountId,
                products: live,
                video: visit.video ? { id: visit.video.id, productIds: visit.video.productIds } : null,
                misses: sim.misses,
                at: new Date(visit.at),
                rand,
              });
              visitCount++;
              for (const c of clicks) {
                if (rand() < CONVERSION[c.destination]) scheduleOrder(c, priceOf.get(c.productId) ?? 0);
              }
            },
          });
        }
      }

      // queued order steps and payout follow ups that fall in this day
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].at < dayEnd) items.push(queue.splice(i, 1)[0]);
      }
      for (let i = followUps.length - 1; i >= 0; i--) {
        if (followUps[i].at < dayEnd) items.push(followUps.splice(i, 1)[0]);
      }

      items.sort((a, b) => a.at - b.at);
      // orders scheduled during this loop can land later the same day
      while (items.length) {
        const item = items.shift()!;
        currentTime = new Date(item.at);
        settleDue(currentTime);
        item.run();
        for (let i = queue.length - 1; i >= 0; i--) {
          if (queue[i].at < dayEnd) {
            const next = queue.splice(i, 1)[0];
            const idx = items.findIndex((x) => x.at > next.at);
            items.splice(idx === -1 ? items.length : idx, 0, next);
          }
        }
      }
      settleDue(new Date(dayEnd));
    });
  }

  // Leave the last few people waiting on the sale item already messaged.
  sendWaiting(byNumber(findsProducts, 22).id, "sale", ago(1));

  const s = db.select({ n: schema.sales.id }).from(schema.sales).all().length;
  const b = balancesFor(userId);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  console.log(`Seeded ${visitCount.toLocaleString()} visits and ${s} orders.`);
  console.log(`Wallet: pending ${money(b.pending)}, available ${money(b.available)}, paid ${money(b.paid)}`);
  console.log("Log in with demo@caughtshop.com / nothingslips");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
