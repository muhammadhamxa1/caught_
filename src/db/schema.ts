import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// All money is stored as integer cents and all rates as basis points
// (1250 = 12.5%). No floats touch the ledger.

const ts = (name: string) => integer(name, { mode: "timestamp_ms" });

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // sha256 of the cookie token, so a leaked db can't be used to log in
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// One login can own several creator accounts (handles).
export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    socials: text("socials", { mode: "json" })
      .$type<Socials>()
      .notNull()
      .default({}),
    // numbers are said out loud in videos, so they are never reused
    nextNumber: integer("next_number").notNull().default(1),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export type Socials = {
  tiktok?: string;
  instagram?: string;
  youtube?: string;
  amazon?: string;
  website?: string;
};

export const PRODUCT_STATUS = ["active", "sold_out", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    category: text("category").notNull().default("other"),
    keywords: text("keywords").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    salePriceCents: integer("sale_price_cents"),
    tiktokUrl: text("tiktok_url").notNull(),
    amazonUrl: text("amazon_url"),
    brandUrl: text("brand_url"),
    brandName: text("brand_name"),
    status: text("status", { enum: PRODUCT_STATUS }).notNull().default("active"),
    backupProductId: text("backup_product_id"),
    catalogId: text("catalog_id"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("products_account_number_uq").on(t.accountId, t.number),
    index("products_account_status_idx").on(t.accountId, t.status),
  ],
);

export const DESTINATIONS = ["tiktok", "amazon", "brand"] as const;
export type Destination = (typeof DESTINATIONS)[number];

// A product can have several rules per destination. The engine picks the
// rule with the highest min_monthly_units the creator has already reached.
export const commissionRules = sqliteTable(
  "commission_rules",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    destination: text("destination", { enum: DESTINATIONS }).notNull(),
    rateBps: integer("rate_bps").notNull(),
    minMonthlyUnits: integer("min_monthly_units").notNull().default(0),
  },
  (t) => [
    uniqueIndex("rules_product_dest_tier_uq").on(
      t.productId,
      t.destination,
      t.minMonthlyUnits,
    ),
  ],
);

export const BASKET_STATUS = ["live", "pulled", "none"] as const;

export const videos = sqliteTable(
  "videos",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption").notNull().default(""),
    views: integer("views").notNull().default(0),
    basket: text("basket", { enum: BASKET_STATUS }).notNull().default("live"),
    postedAt: ts("posted_at").notNull(),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [index("videos_account_idx").on(t.accountId, t.postedAt)],
);

export const videoProducts = sqliteTable(
  "video_products",
  {
    videoId: text("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.videoId, t.productId] }),
    index("video_products_product_idx").on(t.productId),
  ],
);

// How the viewer got to the product. Used for the "where sales came from" view.
export const ENTRIES = [
  "number",
  "search",
  "video",
  "list",
  "backup",
  "direct",
] as const;
export type Entry = (typeof ENTRIES)[number];

export const EVENT_TYPES = ["page_view", "product_view", "search"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    productId: text("product_id"),
    videoId: text("video_id"),
    entry: text("entry", { enum: ENTRIES }),
    query: text("query"),
    resultCount: integer("result_count"),
    visitorId: text("visitor_id"),
    device: text("device"),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    index("events_account_type_time_idx").on(t.accountId, t.type, t.createdAt),
    index("events_product_idx").on(t.productId),
  ],
);

export const clicks = sqliteTable(
  "clicks",
  {
    // public click id, passed to the network as the tracking sub id
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    videoId: text("video_id"),
    destination: text("destination", { enum: DESTINATIONS }).notNull(),
    entry: text("entry", { enum: ENTRIES }).notNull().default("direct"),
    visitorId: text("visitor_id"),
    device: text("device"),
    isBot: integer("is_bot", { mode: "boolean" }).notNull().default(false),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    index("clicks_account_time_idx").on(t.accountId, t.createdAt),
    index("clicks_product_idx").on(t.productId),
  ],
);

export const signups = sqliteTable(
  "signups",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["sms", "email"] }).notNull(),
    contact: text("contact").notNull(),
    reason: text("reason", { enum: ["sale", "restock"] }).notNull(),
    status: text("status", { enum: ["waiting", "sent"] })
      .notNull()
      .default("waiting"),
    createdAt: ts("created_at").notNull(),
    sentAt: ts("sent_at"),
  },
  (t) => [
    uniqueIndex("signups_product_contact_uq").on(t.productId, t.contact),
    index("signups_account_status_idx").on(t.accountId, t.status),
  ],
);

// Mock SMS/email outbox. In production this is a queue in front of Twilio/Postmark.
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  signupId: text("signup_id"),
  channel: text("channel", { enum: ["sms", "email"] }).notNull(),
  to: text("to").notNull(),
  body: text("body").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const SALE_STATUS = [
  "placed",
  "shipped",
  "delivered",
  "completed",
  "refunded",
] as const;
export type SaleStatus = (typeof SALE_STATUS)[number];

export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey(),
    // public id used for the shareable receipt card
    receiptId: text("receipt_id").notNull().unique(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    clickId: text("click_id"),
    destination: text("destination", { enum: DESTINATIONS }).notNull(),
    networkOrderId: text("network_order_id").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    // what the commission is calculated on: items after discounts, no tax or shipping
    baseCents: integer("base_cents").notNull(),
    refundedCents: integer("refunded_cents").notNull().default(0),
    status: text("status", { enum: SALE_STATUS }).notNull().default("placed"),
    placedAt: ts("placed_at").notNull(),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    completedAt: ts("completed_at"),
  },
  (t) => [
    uniqueIndex("sales_network_order_uq").on(t.destination, t.networkOrderId),
    index("sales_account_time_idx").on(t.accountId, t.placedAt),
    index("sales_product_idx").on(t.productId),
  ],
);

export const COMMISSION_STATUS = ["pending", "cleared", "reversed"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUS)[number];

export const commissions = sqliteTable(
  "commissions",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .unique()
      .references(() => sales.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    rateBps: integer("rate_bps").notNull(),
    tierUnits: integer("tier_units").notNull().default(0),
    grossCents: integer("gross_cents").notNull(),
    // gross minus refunds, this is what the creator actually keeps
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: COMMISSION_STATUS })
      .notNull()
      .default("pending"),
    clearsAt: ts("clears_at"),
    clearedAt: ts("cleared_at"),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    index("commissions_status_clears_idx").on(t.status, t.clearsAt),
    index("commissions_user_idx").on(t.userId),
  ],
);

// Append only. Every money movement is two rows with the same txn id that
// sum to zero, except the first "earned" row which brings money in.
export const BUCKETS = ["pending", "available", "locked", "paid"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const LEDGER_KINDS = [
  "earned",
  "cleared",
  "refund",
  "clawback",
  "payout_hold",
  "payout_paid",
  "payout_release",
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const ledger = sqliteTable(
  "ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    txnId: text("txn_id").notNull(),
    userId: text("user_id").notNull(),
    accountId: text("account_id"),
    bucket: text("bucket", { enum: BUCKETS }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    kind: text("kind", { enum: LEDGER_KINDS }).notNull(),
    saleId: text("sale_id"),
    payoutId: text("payout_id"),
    memo: text("memo").notNull().default(""),
    createdAt: ts("created_at").notNull(),
  },
  (t) => [
    index("ledger_user_bucket_idx").on(t.userId, t.bucket),
    index("ledger_txn_idx").on(t.txnId),
  ],
);

export const payoutMethods = sqliteTable("payout_methods", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["paypal", "bank"] }).notNull(),
  // only a masked label is stored, never the full account details
  label: text("label").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const PAYOUT_STATUS = [
  "pending",
  "approved",
  "paid",
  "rejected",
  "failed",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUS)[number];

export const payouts = sqliteTable(
  "payouts",
  {
    id: text("id").primaryKey(),
    ref: text("ref").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    methodType: text("method_type").notNull(),
    methodLabel: text("method_label").notNull(),
    status: text("status", { enum: PAYOUT_STATUS }).notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    note: text("note"),
    providerRef: text("provider_ref"),
    requestedAt: ts("requested_at").notNull(),
    approvedAt: ts("approved_at"),
    paidAt: ts("paid_at"),
    closedAt: ts("closed_at"),
  },
  (t) => [index("payouts_user_idx").on(t.userId, t.requestedAt)],
);

export const webhookLog = sqliteTable(
  "webhook_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    eventId: text("event_id"),
    type: text("type"),
    status: text("status", {
      enum: ["processed", "duplicate", "rejected", "ignored", "failed"],
    }).notNull(),
    detail: text("detail").notNull().default(""),
    payload: text("payload").notNull(),
    receivedAt: ts("received_at").notNull(),
  },
  (t) => [index("webhook_source_event_idx").on(t.source, t.eventId)],
);
