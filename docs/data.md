# Data

How the data is stored, what each table holds, and the rules that keep it correct.

## Where it lives

Everything is in one SQLite file, `data/caught.db`. SQLite is a full SQL database that lives in a single file, so nobody has to install or run a database server to try the app.

The app talks to it through **better-sqlite3**, a driver where queries and transactions run synchronously. For money code that helps a lot: a transaction is just a function, and nothing else can run in the middle of it.

**Drizzle** sits on top. The tables are defined once in TypeScript in `src/db/schema.ts`, and every query is typed from that, so a wrong column name fails at compile time. Drizzle Kit turns the schema into plain SQL migrations in `drizzle/`. `npm run setup` applies them, and `npm run db:generate` creates a new one after a schema change.

The connection is opened once in `src/db/index.ts` with three settings:

- `journal_mode = WAL`, so the dashboard can read while a webhook writes,
- `foreign_keys = ON`, so deleting an account cleans up its rows,
- `busy_timeout = 5000`, so a busy moment waits instead of failing.

## The tables

| Group | Table | What it holds |
| --- | --- | --- |
| People | `users` | One row per login. Email and a scrypt password hash. |
| | `sessions` | Who is logged in. Stores a hash of the session token, never the token. |
| | `accounts` | A creator page like @mayafinds. One login can own many. Holds the counter for product numbers. |
| Catalog | `products` | Name, prices, store links, status (active, sold out, archived), backup product and number. |
| | `commission_rules` | Rate per product per store, with optional tiers by monthly units. |
| | `videos`, `video_products` | Videos, which products are in each one and in what order, and whether TikTok pulled the basket link. |
| Behaviour | `events` | Page views, product views and searches, with how many results each search found. |
| | `clicks` | Every buy click with its public click id. Attribution matches on this. |
| Money | `sales` | One row per order a store reported: quantity, price, discount, refunds, status. |
| | `commissions` | One per sale: rate used, original amount, amount after refunds, pending, cleared or reversed. |
| | `ledger` | Append only money movements. Every balance is a sum of this table. See [money.md](money.md). |
| | `payouts`, `payout_methods` | Payout requests with their status history, and a masked label for where money goes. |
| Messages | `signups`, `messages` | "Text me" signups per product, and the outbox standing in for SMS and email. |
| Audit | `webhook_log` | Every webhook received: source, event id, status and what we did with it. |

## Rules the data follows

**Money is integer cents, rates are basis points.** 15% is 1500. No floating point math touches money.

**Time is stored as milliseconds since 1970, in UTC.** Daily charts group by UTC day.

**Two kinds of ids.** Internal rows get a random 16 character id. Anything that appears in a URL, like click ids and receipt ids, gets a mixed case random id that can't be guessed (`src/lib/ids.ts`).

**Product numbers are never reused.** They come from `next_number` on the account, not from counting products. Archiving never frees a number, so an old video can't point at a new product.

**Statuses only move forward.** Orders go placed, shipped, delivered, completed. Payouts follow a fixed table of allowed moves. Anything else is ignored or refused.

**The database blocks duplicates too.** Unique indexes on store plus order id, on product plus number, on product plus contact for signups, and on the payout idempotency key. Even with a bug in the code, the same order can't be stored twice.

**Facts are stored, totals are computed.** Balances come from the ledger. Dashboard numbers come from events, clicks and sales at read time. There is no stored counter that can drift out of sync.

**Things that belong together are written together.** One transaction each for: a sale with its commission and ledger row; a payout's checks with its balance hold; a new product with the account's number counter.

## What the public page can see

`loadStorefront()` in `src/server/storefront.ts` builds a separate public shape: no store links, no commission rates, no internal flags. Buy buttons point to `/go`, which looks the link up on the server. Keeping a separate shape for public data means a new column added to `products` never leaks by accident.

## Uploaded images

Product images, video thumbnails and avatars that creators upload are saved in `data/uploads` with random names and served by `src/app/media/[file]/route.ts`. In production this would be S3 or R2 behind a CDN.

## The demo data

`scripts/seed.ts` doesn't insert finished totals. It walks through 90 days one day at a time, with a fixed random seed so every run gives the same data, and calls the same functions the app uses for every visit, click, order, delivery, refund and payout, in time order. That's why the dashboard, the ledger and the payout history agree.

Running `npm run seed` again deletes the database and rebuilds it.

## Moving to Postgres

The schema only uses plain text, integer and timestamp columns. Moving to Postgres means swapping the Drizzle driver, making the transaction functions async, and generating a new migration. The business logic doesn't change. I'd do it before more than one server needs to write at the same time.
