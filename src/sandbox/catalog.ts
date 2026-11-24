// A fake slice of the TikTok Shop catalog. In production this comes from the
// TikTok Shop affiliate API. Pasting one of these links in "Add product"
// fills in the name, price, image and commission plan.

export type CatalogItem = {
  id: string;
  slug: string;
  title: string;
  category: string;
  priceCents: number;
  /** open plan rate on TikTok Shop */
  rateBps: number;
  /** bonus rate after N units in a month, if the seller offers one */
  tier?: { minUnits: number; rateBps: number };
  keywords: string;
  amazonRateBps?: number;
  brand?: { name: string; rateBps: number };
  inStock?: boolean;
};

export const CATALOG: CatalogItem[] = [
  // beauty, skincare, hair, home, gadgets
  { id: "1729401837261540", slug: "satin-pillowcase", title: "Satin pillowcase, 2 pack", category: "home", priceCents: 1999, rateBps: 1200, keywords: "silk pillow case hair frizz sleep", amazonRateBps: 300 },
  { id: "1729401837261541", slug: "heatless-curling-ribbon", title: "Heatless curling ribbon", category: "hair", priceCents: 1299, rateBps: 1500, keywords: "curls overnight no heat rod", amazonRateBps: 300 },
  { id: "1729401837261542", slug: "claw-clips", title: "Matte claw clips, 4 pack", category: "hair", priceCents: 999, rateBps: 1800, keywords: "hair clip claw neutral", amazonRateBps: 300 },
  { id: "1729401837261543", slug: "ice-roller", title: "Ice roller", category: "skincare", priceCents: 1199, rateBps: 1500, keywords: "face roller cold puffy morning", amazonRateBps: 300 },
  { id: "1729401837261544", slug: "vitamin-c-serum", title: "Vitamin C serum", category: "skincare", priceCents: 1850, rateBps: 1600, keywords: "glow serum brightening", brand: { name: "Dewlane", rateBps: 1800 } },
  { id: "1729401837261545", slug: "lash-serum", title: "Lash serum", category: "beauty", priceCents: 2400, rateBps: 2000, keywords: "eyelash growth lashes", amazonRateBps: 300 },
  { id: "1729401837261546", slug: "clear-brow-gel", title: "Clear brow gel", category: "beauty", priceCents: 899, rateBps: 1400, keywords: "eyebrow gel soap brows laminated" },
  { id: "1729401837261547", slug: "bubble-eye-patches", title: "Bubble eye patches, 30 pairs", category: "skincare", priceCents: 1599, rateBps: 1500, keywords: "under eye patch hydrogel gel", amazonRateBps: 300 },
  { id: "1729401837261548", slug: "mini-straightener", title: "Mini hair straightener", category: "hair", priceCents: 2299, rateBps: 1200, keywords: "flat iron travel bangs", amazonRateBps: 400 },
  { id: "1729401837261549", slug: "silk-scrunchies", title: "Silk scrunchies, 6 pack", category: "hair", priceCents: 1399, rateBps: 1500, keywords: "scrunchie hair tie", amazonRateBps: 300 },
  { id: "1729401837261550", slug: "under-eye-stick", title: "Under eye brightener stick", category: "beauty", priceCents: 1600, rateBps: 1800, keywords: "concealer dark circles stick" },
  { id: "1729401837261551", slug: "pimple-patches", title: "Pimple patches, 72 count", category: "skincare", priceCents: 1099, rateBps: 1500, keywords: "spot patch hydrocolloid zit", amazonRateBps: 300 },
  { id: "1729401837261552", slug: "sunscreen-stick", title: "Sunscreen stick SPF 50", category: "skincare", priceCents: 1799, rateBps: 1300, keywords: "spf sunblock stick face", amazonRateBps: 300, brand: { name: "Halcyon Skin", rateBps: 1500 } },
  { id: "1729401837261553", slug: "makeup-sponges", title: "Makeup sponge set", category: "beauty", priceCents: 949, rateBps: 1500, keywords: "blender sponge beauty blender", amazonRateBps: 300 },
  { id: "1729401837261554", slug: "setting-spray", title: "Dewy setting spray", category: "beauty", priceCents: 1400, rateBps: 1600, keywords: "makeup setting mist fixing" },
  { id: "1729401837261555", slug: "gua-sha", title: "Gua sha stone", category: "skincare", priceCents: 1200, rateBps: 1500, keywords: "face sculpt quartz", amazonRateBps: 300 },
  { id: "1729401837261556", slug: "rosemary-hair-oil", title: "Rosemary hair oil", category: "hair", priceCents: 1699, rateBps: 1600, tier: { minUnits: 60, rateBps: 2000 }, keywords: "scalp oil rosemary mint", amazonRateBps: 300, brand: { name: "Halcyon Hair", rateBps: 2000 } },
  { id: "1729401837261557", slug: "whitening-strips", title: "Teeth whitening strips", category: "beauty", priceCents: 2999, rateBps: 1500, keywords: "white teeth strips", amazonRateBps: 300 },
  { id: "1729401837261558", slug: "led-vanity-mirror", title: "LED vanity mirror", category: "home", priceCents: 3499, rateBps: 1000, keywords: "makeup mirror light up", amazonRateBps: 300 },
  { id: "1729401837261559", slug: "jade-roller", title: "Jade face roller", category: "skincare", priceCents: 1350, rateBps: 1400, keywords: "face roller jade", amazonRateBps: 300 },
  { id: "1729401837261560", slug: "peel-off-lip-stain", title: "Peel off lip stain", category: "beauty", priceCents: 1100, rateBps: 1800, keywords: "lip tint peel stain" },
  { id: "1729401837261561", slug: "tinted-moisturizer", title: "Tinted moisturizer", category: "beauty", priceCents: 2100, rateBps: 1500, keywords: "skin tint foundation light", brand: { name: "Dewlane", rateBps: 1800 } },
  { id: "1729401837261562", slug: "press-on-nails", title: "Press on nail set", category: "beauty", priceCents: 899, rateBps: 2000, keywords: "nails glue on manicure" },
  { id: "1729401837261563", slug: "cuticle-oil-pen", title: "Cuticle oil pen", category: "beauty", priceCents: 799, rateBps: 1800, keywords: "nail oil cuticle" },
  { id: "1729401837261564", slug: "vanilla-body-butter", title: "Vanilla body butter", category: "body", priceCents: 1500, rateBps: 1500, keywords: "body cream vanilla moisturizer lotion", brand: { name: "Nook & Linen", rateBps: 1500 } },
  { id: "1729401837261565", slug: "exfoliating-mitt", title: "Exfoliating mitt", category: "body", priceCents: 850, rateBps: 1500, keywords: "scrub glove exfoliate", amazonRateBps: 300 },
  { id: "1729401837261566", slug: "shower-steamers", title: "Eucalyptus shower steamers", category: "body", priceCents: 1299, rateBps: 1500, keywords: "shower tablets eucalyptus aromatherapy", amazonRateBps: 300 },
  { id: "1729401837261567", slug: "lint-remover", title: "Rechargeable lint remover", category: "home", priceCents: 1499, rateBps: 1200, keywords: "fabric shaver pills sweater", amazonRateBps: 300 },
  { id: "1729401837261568", slug: "jewelry-case", title: "Travel jewelry case", category: "accessories", priceCents: 1199, rateBps: 1500, keywords: "jewellery box travel", amazonRateBps: 400 },
  { id: "1729401837261569", slug: "phone-lanyard", title: "Beaded phone lanyard", category: "accessories", priceCents: 999, rateBps: 1800, keywords: "phone strap charm beads" },
  { id: "1729401837261570", slug: "sunset-lamp", title: "Sunset lamp", category: "home", priceCents: 1999, rateBps: 1200, keywords: "projection lamp golden hour light", amazonRateBps: 300 },
  { id: "1729401837261571", slug: "cloud-slides", title: "Cloud slides", category: "fashion", priceCents: 2199, rateBps: 1400, keywords: "slippers sandals pillow slides", amazonRateBps: 400 },
  { id: "1729401837261572", slug: "handheld-fan", title: "Mini handheld fan", category: "gadgets", priceCents: 1399, rateBps: 1200, keywords: "portable fan neck", amazonRateBps: 300 },
  { id: "1729401837261573", slug: "wireless-earbuds", title: "Wireless earbuds", category: "gadgets", priceCents: 2999, rateBps: 1000, keywords: "earphones bluetooth headphones", amazonRateBps: 300 },
  { id: "1729401837261574", slug: "phone-tripod", title: "Phone tripod with remote", category: "gadgets", priceCents: 1899, rateBps: 1200, keywords: "tripod stand selfie filming", amazonRateBps: 300 },
  { id: "1729401837261575", slug: "hair-dryer-brush", title: "Hair dryer brush", category: "hair", priceCents: 3999, rateBps: 1000, keywords: "blowout brush volumizer hot", amazonRateBps: 400 },
  { id: "1729401837261576", slug: "blotting-papers", title: "Blotting papers, 200 sheets", category: "beauty", priceCents: 699, rateBps: 1500, keywords: "oil control sheets" },
  { id: "1729401837261577", slug: "scalp-massager", title: "Scalp massager", category: "hair", priceCents: 899, rateBps: 1500, keywords: "shampoo scalp scrubber", amazonRateBps: 300 },
  { id: "1729401837261578", slug: "overnight-lip-mask", title: "Overnight lip mask", category: "beauty", priceCents: 1300, rateBps: 1600, keywords: "lip balm sleeping mask" },
  { id: "1729401837261579", slug: "toner-pads", title: "Hydrating toner pads", category: "skincare", priceCents: 1900, rateBps: 1500, keywords: "toner pad hydrating", amazonRateBps: 300 },
  { id: "1729401837261580", slug: "retinol-night-cream", title: "Retinol night cream", category: "skincare", priceCents: 2250, rateBps: 1500, keywords: "night cream retinol", brand: { name: "Mira Skin", rateBps: 2000 } },
  { id: "1729401837261581", slug: "bronzing-drops", title: "Bronzing drops", category: "beauty", priceCents: 2600, rateBps: 1600, keywords: "bronzer drops glow tan", brand: { name: "Dewlane", rateBps: 1800 } },
  { id: "1729401837261582", slug: "peach-lip-oil", title: "Peach lip oil", category: "beauty", priceCents: 1499, rateBps: 1500, keywords: "lip oil gloss peach", amazonRateBps: 300, inStock: false },
  { id: "1729401837261583", slug: "heatless-curl-headband", title: "Heatless curl headband", category: "hair", priceCents: 1499, rateBps: 1500, keywords: "curls overnight headband rod", amazonRateBps: 300 },
  { id: "1729401837261584", slug: "collagen-sheet-masks", title: "Collagen sheet masks, 10 pack", category: "skincare", priceCents: 1699, rateBps: 1500, keywords: "face mask sheet hydrating", amazonRateBps: 300 },
  { id: "1729401837261585", slug: "perfume-oil", title: "Vanilla musk perfume oil", category: "beauty", priceCents: 1800, rateBps: 1800, keywords: "perfume roll on scent vanilla" },
  { id: "1729401837261586", slug: "cherry-lip-oil", title: "Cherry lip oil", category: "beauty", priceCents: 1499, rateBps: 1500, tier: { minUnits: 25, rateBps: 2000 }, keywords: "lip oil gloss cherry tinted shine", amazonRateBps: 300, brand: { name: "Glossworth", rateBps: 2000 } },
  { id: "1729401837261587", slug: "glass-skin-serum", title: "Glass skin serum", category: "skincare", priceCents: 2199, rateBps: 1600, keywords: "glass skin serum glow niacinamide", amazonRateBps: 300 },

  // kitchen
  { id: "1729402551803310", slug: "mini-waffle-maker", title: "Mini waffle maker", category: "kitchen", priceCents: 1999, rateBps: 1200, keywords: "waffle iron chaffle breakfast", amazonRateBps: 450 },
  { id: "1729402551803311", slug: "veggie-chopper", title: "Veggie chopper", category: "kitchen", priceCents: 2499, rateBps: 1300, tier: { minUnits: 30, rateBps: 1600 }, keywords: "onion chopper dicer slicer", amazonRateBps: 450 },
  { id: "1729402551803312", slug: "oil-sprayer", title: "Glass oil sprayer", category: "kitchen", priceCents: 999, rateBps: 1500, keywords: "olive oil mister air fryer spray", amazonRateBps: 450 },
  { id: "1729402551803313", slug: "air-fryer-liners", title: "Silicone air fryer liners", category: "kitchen", priceCents: 1299, rateBps: 1500, keywords: "air fryer basket liner reusable", amazonRateBps: 450 },
  { id: "1729402551803314", slug: "milk-frother", title: "Handheld milk frother", category: "kitchen", priceCents: 1499, rateBps: 1200, keywords: "frother latte foam coffee matcha", amazonRateBps: 450 },
  { id: "1729402551803315", slug: "glass-containers", title: "Glass food containers, 10 piece", category: "kitchen", priceCents: 3299, rateBps: 1000, keywords: "meal prep containers glass", amazonRateBps: 450, brand: { name: "Orrin Home", rateBps: 1200 } },
  { id: "1729402551803316", slug: "herb-scissors", title: "Herb scissors", category: "kitchen", priceCents: 899, rateBps: 1500, keywords: "herb shears 5 blade", amazonRateBps: 450 },
  { id: "1729402551803317", slug: "magnetic-spice-jars", title: "Magnetic spice jars", category: "kitchen", priceCents: 2799, rateBps: 1200, keywords: "spice rack fridge magnet", amazonRateBps: 450, brand: { name: "Saltbox Kitchen", rateBps: 1500 } },
  { id: "1729402551803318", slug: "salt-grinder", title: "Electric salt and pepper grinder", category: "kitchen", priceCents: 2199, rateBps: 1200, keywords: "pepper mill electric grinder", amazonRateBps: 450 },
  { id: "1729402551803319", slug: "pan-organizer", title: "Pan organizer rack", category: "kitchen", priceCents: 1899, rateBps: 1200, keywords: "pot lid organizer cabinet", amazonRateBps: 450 },
  { id: "1729402551803320", slug: "sphere-ice-tray", title: "Sphere ice tray", category: "kitchen", priceCents: 1199, rateBps: 1500, keywords: "ice ball mold cocktail", amazonRateBps: 450 },
  { id: "1729402551803321", slug: "garlic-rocker", title: "Garlic press rocker", category: "kitchen", priceCents: 799, rateBps: 1500, keywords: "garlic crusher press", amazonRateBps: 450 },
  { id: "1729402551803322", slug: "collapsible-colander", title: "Collapsible colander", category: "kitchen", priceCents: 1399, rateBps: 1500, keywords: "strainer silicone colander", amazonRateBps: 450 },
  { id: "1729402551803323", slug: "bento-box", title: "Bento lunch box", category: "kitchen", priceCents: 1999, rateBps: 1300, keywords: "lunch box bento kids adult", amazonRateBps: 450 },

  // not linked by the demo creator yet, useful for trying "Add product"
  { id: "1729403902117740", slug: "shower-filter", title: "Vitamin C shower filter", category: "body", priceCents: 2499, rateBps: 1500, keywords: "shower head filter hard water", amazonRateBps: 300 },
  { id: "1729403902117741", slug: "mini-projector", title: "Mini projector", category: "gadgets", priceCents: 5999, rateBps: 800, keywords: "projector movie night bedroom", amazonRateBps: 300 },
  { id: "1729403902117742", slug: "lip-liner-set", title: "Lip liner set, 6 shades", category: "beauty", priceCents: 1299, rateBps: 1800, keywords: "lip liner pencil nude" },
  { id: "1729403902117743", slug: "pet-hair-roller", title: "Pet hair roller", category: "home", priceCents: 1599, rateBps: 1500, keywords: "lint roller dog cat hair", amazonRateBps: 300 },
  { id: "1729403902117744", slug: "clip-desk-lamp", title: "Clip on desk lamp", category: "home", priceCents: 2299, rateBps: 1200, keywords: "reading light clamp lamp", amazonRateBps: 300 },
  { id: "1729403902117745", slug: "hand-cream-trio", title: "Hand cream trio", category: "body", priceCents: 1400, rateBps: 1600, keywords: "hand lotion gift set" },
];

const byId = new Map(CATALOG.map((c) => [c.id, c]));
const bySlug = new Map(CATALOG.map((c) => [c.slug, c]));

export const catalogItem = (id: string) => byId.get(id) ?? null;
export const catalogBySlug = (slug: string) => bySlug.get(slug) ?? null;

export const tiktokUrl = (item: CatalogItem) => `https://shop.tiktok.com/view/product/${item.id}`;

export const amazonUrl = (item: CatalogItem) =>
  `https://www.amazon.com/dp/B0${item.id.slice(-8)}`;

export const brandUrl = (item: CatalogItem) =>
  item.brand
    ? `https://${item.brand.name.toLowerCase().replace(/[^a-z]/g, "")}.com/products/${item.slug}`
    : null;

export const artUrl = (item: CatalogItem) => `/demo/products/${item.slug}.svg`;

/** Pulls the product id out of the link formats creators actually paste. */
export function catalogIdFromUrl(raw: string) {
  const m =
    raw.match(/\/product\/(\d{12,20})/) ??
    raw.match(/[?&]product_id=(\d{12,20})/) ??
    raw.match(/\b(\d{15,20})\b/);
  return m ? m[1] : null;
}
