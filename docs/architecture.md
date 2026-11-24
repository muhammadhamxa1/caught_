# Architecture

This doc explains what Caught does and how the code does it. If you are new to the project, read this first, then [money.md](money.md) and [data.md](data.md).

## The problem

A creator makes a video about a product. TikTok only pays them if the viewer buys through the basket link on that video. A lot of the time that link is missing, gets pulled by TikTok, or points to something that sold out. The viewer comments "link??", gets no answer and leaves. The sale happened because of the creator's video, but nobody paid them for it.

Caught gives every product a short number. The creator says "it's #47 in my bio". The viewer opens the bio link, types 47, and buys on TikTok Shop, Amazon or the brand's own site. Caught tracks the click, the store reports the sale back, and the creator gets credit either way.

## Who uses it

- **The viewer.** Just watched a video. On a phone, inside TikTok's own browser, and won't sign up for anything. Only sees the public page.
- **The creator.** Logs in to a dashboard to add products and videos and to watch clicks and money come in.
- **The outside world.** TikTok Shop, Amazon, brand stores, the text message provider and the payout provider. These are other companies' systems. In this repo a sandbox plays all of them.

## The whole path at a glance

```
 viewer's phone                     Caught                                outside world
 ---------------                    ------                                -------------
 /mayafinds  ──── types 47 ───>     search runs in the browser
                                    product views and searches  ───>      /api/events (logged)
 taps "Buy"  ──────────────────>    /go/:product/:store
                                    logs a click, gives it an id  ───>    store page, with our click id
                                                                          viewer buys
                                    /api/webhooks/:store  <────────────   store reports the order (signed)
                                    attribution: whose click was it?
                                    sale + commission (pending)
                                    ledger row
                                    ...return window closes
                                    commission cleared (available)
 creator     ───── cash out ───>    payout (pending, approved)   ───>     payout provider
                                    /api/webhooks/payouts  <──────────    "paid" (signed)
```

## 1. The viewer types 47

The public page is `src/app/[handle]/page.tsx`. It is a React server component. The server builds the full HTML with every product already in it before anything reaches the phone, so the viewer sees a complete page on the first load with no spinner. That matters because TikTok's browser is slow and people leave fast.

The page gets its data from `loadStorefront()` in `src/server/storefront.ts`. It only returns what a viewer may see: names, numbers, prices, images and stock status. Store links and commission rates never go to the browser.

The search box is `src/components/store/Finder.tsx`. It runs in the browser on products already on the page, so it answers on every key press without a round trip. The rules live in `src/lib/search.ts`. Only digits means a number lookup. Anything else matches words in the name and the creator's search words. The server imports the same file, so both sides agree on what "found nothing" means.

When the viewer pauses typing, the page sends one small event to `/api/events` with `sendBeacon`, which still delivers if the page closes. That is how the dashboard learns about product views and failed searches.

If the product is sold out, `backupFor()` in `src/lib/public.ts` follows its backup and the page shows that product instead, with a line saying why.

## 2. The viewer taps "Buy on TikTok Shop"

The button links to our own route, `/go/:productId/tiktok?e=number`, in `src/app/go/[productId]/[dest]/route.ts`. It does three things:

1. Looks up the product and the store link saved on it. It never redirects to a link taken from the URL, so it can't be used to send people somewhere bad.
2. Writes a row in `clicks` with a random click id, the product, the store, how the viewer found it (`e=number`, `search`, `video`, `list`, `backup`) and the device. Bot traffic is flagged so it never earns.
3. Redirects to the store with our click id attached. With real stores the id goes into the store's tracking parameter (Amazon calls it `ascsubtag`). In the sandbox it opens `/sandbox/checkout/:clickId`.

If logging fails, the viewer is still redirected. Losing a click is bad. Losing the sale is worse.

## 3. The store reports the order

When the viewer buys, the store calls us with a webhook: an HTTP POST to `/api/webhooks/tiktok`, `amazon` or `brand`. Every one goes through `handleWebhook()` in `src/server/webhooks.ts`:

1. **Check the signature** (`src/server/signing.ts`). A wrong or old signature gets a 401. This is what stops fake orders.
2. **Translate the payload.** Each store sends a different shape. `src/server/adapters.ts` turns each into the same five events: placed, shipped, delivered, completed, refunded.
3. **Skip duplicates.** Stores retry. An event id we've already handled is logged and ignored.
4. **Apply it and log it** in `webhook_log`.

For a "placed" event, `attributeOrder()` in `src/server/tracking.ts` finds the click and decides if the sale counts. From there the money logic takes over. That part has its own doc: [money.md](money.md).

## 4. The creator dashboard

The pages in `src/app/dashboard` are server components too. They call plain functions in `src/server/analytics.ts`, which run SQL over raw events, clicks and sales when the page opens. Nothing is pre-counted, so numbers are always current. That holds up to a few hundred thousand rows. Past that I'd add daily rollup tables.

Everything a creator changes (add a product, mark it sold out, request a payout) is a server action in `src/app/dashboard/_actions`. Each one first checks that the logged in user owns what it is about to change.

`dashboardContext()` in `src/server/scope.ts` runs at the top of every dashboard page. It loads the user, their accounts and the account they picked in the switcher, and it runs the commission clearing job.

The live feed polls `/api/live` every five seconds.

## 5. The sandbox

The brief asks to mock everything outside. I didn't want mocks that skip the real code, so the sandbox talks to the app exactly like a real store would.

- `src/sandbox/emit.ts` builds each store's payload in that store's own shape, signs it with that store's secret and posts it to `/api/webhooks`. The checkout page, the order buttons, stock changes and payout results all go through the real signature check, adapter, attribution and ledger code.
- `src/sandbox/catalog.ts` is a small fake TikTok Shop catalog. Pasting one of its links in "Add product" fills in the details.
- `src/sandbox/traffic.ts` makes fake viewers. Most arrive from one video with a number in mind, some search, some browse. The seed uses it to build 90 days of history, and the Sandbox page uses it to send viewers live.

## Code layout

```
src/
  app/                  routes and pages
    [handle]/           public bio page and product pages
    go/                 click tracking redirect
    api/                events, webhooks, live feed
    sandbox/            the fake store checkout
    dashboard/          creator side, server actions in _actions/
    r/                  shareable receipt pages and images
  components/           shared UI and the public page pieces
  db/                   Drizzle schema and connection
  lib/                  code used by browser and server: search, money formatting, claim check
  server/               business logic, nothing here knows about React
    writer/             the caption writer
  sandbox/              the fake outside world
scripts/                setup and seed
tests/                  unit tests
drizzle/                SQL migrations
docs/                   these docs
```

The rule I followed: routes stay thin. A page or route reads input, calls a function in `src/server`, and renders the result. All the rules live in `src/server`, which makes them easy to test without a browser.

## Where to start reading

In this order: `src/server/tracking.ts`, `src/server/commissions.ts`, `src/server/ledger.ts`, `src/server/payouts.ts`, `src/server/webhooks.ts`, then `src/components/store/Finder.tsx`. That is the whole path from a typed number to money paid out.

## Tests

`npm test` runs 37 tests, each file on a fresh in-memory database. They cover tier picking, refunds before and after clearing, never clearing twice, the ledger adding up, attribution windows per store, bot clicks, duplicate orders, signature checks, payout rules and status moves, idempotency, number reuse, backup chains, signup parsing and the claim checker.
