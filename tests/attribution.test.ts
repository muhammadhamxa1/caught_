import { describe, expect, it } from "vitest";
import { attributeOrder, deviceOf, isBot, recordClick } from "@/server/tracking";
import { click, makeCreator, makeProduct, PHONE_UA } from "./helpers";

const HOUR = 3_600_000;

function report(clickId: string | null, extra: Partial<Parameters<typeof attributeOrder>[0]> = {}) {
  return attributeOrder({
    destination: "tiktok",
    clickId,
    networkOrderId: `o-${Math.random()}`,
    quantity: 1,
    unitPriceCents: 1500,
    discountCents: 0,
    at: new Date(),
    ...extra,
  });
}

describe("attribution", () => {
  const { accountId } = makeCreator();
  const p = makeProduct(accountId, [
    { destination: "tiktok", rateBps: 1000, minMonthlyUnits: 0 },
    { destination: "amazon", rateBps: 300, minMonthlyUnits: 0 },
  ]);

  it("credits a valid click", () => {
    const r = report(click(accountId, p.id));
    expect(r.ok).toBe(true);
  });

  it("ignores orders without a known click", () => {
    expect(report(null)).toMatchObject({ ok: false, reason: "No click id on the order" });
    expect(report("nope")).toMatchObject({ ok: false, reason: "Unknown click id" });
  });

  it("refuses a click made for another store", () => {
    const r = report(click(accountId, p.id, "amazon"));
    expect(r).toMatchObject({ ok: false });
  });

  it("respects each store's window. Amazon is 24 hours", () => {
    const old = new Date(Date.now() - 30 * HOUR);
    const amazonClick = click(accountId, p.id, "amazon", old);
    expect(report(amazonClick, { destination: "amazon" })).toMatchObject({
      ok: false,
      reason: "Outside the attribution window",
    });
    // same age is fine on TikTok Shop, which allows 7 days
    expect(report(click(accountId, p.id, "tiktok", old)).ok).toBe(true);
  });

  it("does not record the same order twice", () => {
    const c = click(accountId, p.id);
    expect(report(c, { networkOrderId: "dup-1" }).ok).toBe(true);
    expect(report(c, { networkOrderId: "dup-1" })).toMatchObject({ ok: false, duplicate: true });
  });

  it("does not credit bot clicks", () => {
    const botClick = recordClick({
      accountId,
      productId: p.id,
      destination: "tiktok",
      entry: "direct",
      userAgent: "facebookexternalhit/1.1",
    });
    expect(report(botClick)).toMatchObject({ ok: false, reason: "Click was flagged as a bot" });
  });
});

describe("user agents", () => {
  it("spots TikTok's in-app browser and bots", () => {
    expect(deviceOf(PHONE_UA)).toBe("tiktok");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
    expect(isBot("Googlebot/2.1")).toBe(true);
    expect(isBot(PHONE_UA)).toBe(false);
    expect(isBot(null)).toBe(true);
  });
});
