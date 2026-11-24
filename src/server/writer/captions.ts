import { PUBLIC_HOST } from "@/lib/config";
import { money } from "@/lib/money";

export type WriterProduct = {
  number: number;
  name: string;
  category: string;
  priceCents: number;
  salePriceCents: number | null;
};

export type Kit = {
  hooks: string[];
  caption: string;
  pinnedComment: string;
  linkReply: string;
  hashtags: string[];
};

// Small seeded random so "Try again" gives a new mix but the same seed
// always gives the same kit. Handy for tests and for undo.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(list: T[], rand: () => number, count: number) {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/** "Satin pillowcase, 2 pack" becomes "satin pillowcase". */
export function shortName(name: string) {
  return name
    .split(",")[0]
    .replace(/\b\d+\s*(pack|pc|piece|count|pairs?|sheets?)\b/gi, "")
    .trim()
    .toLowerCase();
}

const HOOKS_ANY = [
  "I keep rebuying this {thing} and I finally know why",
  "the {thing} people keep asking me about",
  "{price} and I use it every single day",
  "if you've been looking for a good {thing}, this is it",
  "honest review of the {thing} that's all over my feed",
  "I almost didn't buy this {thing}. glad I did",
  "this {thing} lives in my bag now",
  "3 weeks with the {thing}, here's the truth",
];

const HOOKS_BY_CATEGORY: Record<string, string[]> = {
  beauty: ["my 10 second {thing} step", "the {thing} I reach for before anything else"],
  skincare: ["the {thing} in my morning routine right now", "texture check on the {thing}"],
  hair: ["no heat, no salon, just this {thing}", "the {thing} that made my mornings faster"],
  kitchen: ["kitchen gadget that actually earns its drawer space", "the {thing} I use more than my microwave"],
  home: ["small change, my room feels different: {thing}", "the {thing} everyone notices when they come over"],
  gadgets: ["the {thing} I didn't know I needed", "tiny {thing}, big difference"],
  body: ["shower routine upgrade: {thing}", "the {thing} that smells this good for {price}"],
};

const SALE_HOOKS = [
  "the {thing} is {sale} right now, it's usually {price}",
  "{thing} went on sale. this almost never happens",
];

const CATEGORY_TAG: Record<string, string> = {
  beauty: "beautyfinds",
  skincare: "skincare",
  hair: "hairtok",
  kitchen: "kitchengadgets",
  home: "homefinds",
  gadgets: "gadgets",
  body: "bodycare",
  accessories: "accessories",
  fashion: "fashionfinds",
};

function fill(t: string, p: WriterProduct) {
  return t
    .replaceAll("{thing}", shortName(p.name))
    .replaceAll("{price}", money(p.priceCents))
    .replaceAll("{sale}", money(p.salePriceCents ?? p.priceCents));
}

export function localKit(p: WriterProduct, handle: string, seed = 1): Kit {
  const rand = rng(seed * 7919 + p.number);
  const onSale = p.salePriceCents !== null && p.salePriceCents < p.priceCents;
  const pool = [...(HOOKS_BY_CATEGORY[p.category] ?? []), ...HOOKS_ANY];
  const hooks = [...(onSale ? pick(SALE_HOOKS, rand, 1) : []), ...pick(pool, rand, onSale ? 2 : 3)].map(
    (h) => fill(h, p),
  );

  const n = `#${p.number}`;
  const link = `${PUBLIC_HOST}/${handle}`;
  const hashtags = ["tiktokshop", CATEGORY_TAG[p.category] ?? "founditontiktok", "tiktokmademebuyit"];

  const opener = pick(
    [
      `${shortName(p.name)} review, no fluff.`,
      `this ${shortName(p.name)} is staying in my routine.`,
      `everyone asked, so here it is.`,
      `the ${shortName(p.name)} from my last few videos.`,
    ],
    rand,
    1,
  )[0];

  return {
    hooks,
    caption: `${opener} it's ${n} in my bio if the basket doesn't show up. ${hashtags.map((h) => `#${h}`).join(" ")}`,
    pinnedComment: `Link not showing? It's ${n} at ${link}`,
    linkReply: pick([`it's ${n} in my bio!`, `${n} in my bio, type the number and it pops up`, `${n} at ${link}/${p.number}`], rand, 1)[0],
    hashtags,
  };
}
