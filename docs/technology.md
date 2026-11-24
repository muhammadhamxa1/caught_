# Technology

Each tool in the project, why I picked it, and what I compared it to. The goal was an app a reviewer can run with three commands, that is fast on a phone inside TikTok's browser, and that the real product could grow from.

## Next.js 16 with the App Router, React 19, TypeScript

**What it does here.** One app serves the public bio page, the creator dashboard, the click redirect and the webhook endpoints.

**Why.** Three features carry most of the weight:

- **Server components.** The bio page is rendered on the server with every product already in the HTML. The viewer gets a full page on the first response, with no loading state. TikTok's browser is slow and viewers leave in seconds, so this matters more than anything else on the viewer side.
- **Server actions.** Dashboard forms call server functions directly. No hand written API layer for create product, mark sold out or request payout, and the ownership check sits right next to the write.
- **Route handlers.** `/go`, `/api/events` and `/api/webhooks` are plain request handlers in the same codebase.

One language end to end also means the search code in `src/lib/search.ts` runs in the browser for instant results and on the server for logging, and both always agree.

**Compared with.** A React single page app with a separate API (Express or FastAPI) means two deploys, CORS, and a blank page until the JavaScript loads. Rails or Django would be good for the dashboard, but the instant in-browser search would need its logic written twice. Remix is close to Next and would also work.

**One setting worth knowing.** Next 16 ships a newer caching mode, Cache Components. I left it off. Every page that reads the database renders per request, which is simple and always correct for live data, and SQLite reads are fast enough that it costs very little.

## SQLite with better-sqlite3

**Why.** A reviewer should not need Docker or a database server. SQLite is a real SQL database in one file. better-sqlite3 runs queries and transactions synchronously, so a transaction is a plain function and nothing can interleave with it. For payout checks and balance holds, that removes a whole class of race conditions with no extra code.

**Compared with.**

- **Postgres** is the right production database, but it adds a setup step for reviewers. The schema is written so moving later is a driver change, async transactions and a new migration. See [data.md](data.md).
- **Node's built in `node:sqlite`** would remove the native dependency, but it was still marked experimental and isn't in every Node version reviewers may have.
- **libSQL or Turso** would need a network service.

**Trade off.** better-sqlite3 is a native module. It ships prebuilt binaries for macOS, Linux and Windows on current Node versions, so `npm install` doesn't compile anything for most people.

## Drizzle ORM and Drizzle Kit

**Why.** The schema is TypeScript (`src/db/schema.ts`) and every query is typed from it. Queries read like SQL, so there is little magic to learn. It works with better-sqlite3's synchronous API, which keeps the money code straightforward. Drizzle Kit generates plain SQL migration files that are easy to review.

**Compared with.** Prisma needs a separate generate step, and its transactions are async. Kysely is a great query builder but has no schema or migration tool of its own. Raw SQL would work but loses type checking on every query.

## Tailwind CSS 4

**Why.** The design is a small token set: paper, ink, one green, two fonts. Tailwind 4 defines those once in `src/app/globals.css` with `@theme`, and every component uses the same names. There is no CSS runtime, and styles live next to the markup they affect.

**Compared with.** CSS Modules would mean jumping between files for every change. A component library would fight the receipt look.

## Zod

**Why.** Everything that comes from outside is checked before it touches the database: webhook payloads from each store, events from the browser, and the sign up form. The store adapters in `src/server/adapters.ts` are Zod schemas, so a malformed webhook fails with a clear reason that goes into the webhook log.

## Authentication: scrypt and database sessions

**Why.** The app needs email and password login and nothing else. That's about 80 lines (`src/server/password.ts`, `src/server/session.ts`):

- Passwords are hashed with **scrypt** from Node's own crypto module. It's slow and memory hard on purpose, which makes stolen hashes expensive to crack. bcrypt and argon2 are also good choices, but both need a native module.
- **Sessions live in the database.** The cookie holds a random token and the table holds its SHA256 hash. Logging out deletes the row, so a session really ends. A JWT can't be revoked before it expires without extra machinery.

**Compared with.** Auth.js or Clerk add providers and hosted features this MVP doesn't need, and Clerk would need API keys. Both are easy to move to later because only `currentUser()` and `requireUser()` know how sessions work.

## Signed webhooks (HMAC SHA256)

**Why.** This is the industry pattern for webhooks, the same shape Stripe uses: the sender signs the timestamp plus the raw body with a shared secret, and the receiver checks it in constant time and refuses old timestamps. It proves the request came from that store and wasn't changed or replayed.

**Compared with.** A static token in a header can be replayed forever if it leaks. Mutual TLS is stronger but far too heavy for this stage.

## Charts

**Why hand built.** The dashboard shows one series at a time as simple bars, plus a monochrome split bar. A few divs with heights do that, with a hover readout and a table view. It keeps a 100 KB chart library out of the bundle and matches the receipt style exactly.

**Compared with.** Recharts or Chart.js would be the move once the dashboard needs many chart types.

## Live updates: polling

**Why.** The activity feed asks `/api/live` every five seconds. It works behind any proxy and holds no open connections.

**Compared with.** Server sent events would be the next step, then websockets if the dashboard ever needs two way updates.

## Shareable receipt images: next/og

**Why.** `next/og` turns JSX into a PNG on the server. The receipt card at `/r/:id/card` is 1080 by 1350, sized for stories, with no headless browser involved.

## Fonts: Fontsource

**Why.** Instrument Sans and Martian Mono are installed as npm packages, so the app works offline and the build never downloads fonts. The receipt image uses a static copy of Martian Mono because the image renderer needs a WOFF file.

## Images: plain img tags

**Why.** Creator images can come from any host. `next/image` needs every remote host listed in config. In production I'd put images behind an image CDN and switch then.

## Vitest

**Why.** Fast, runs TypeScript directly, and the config points every test file at its own in-memory SQLite database. The tests exercise the real money code against a real database, not mocks.

## Lucide

The demo product art and UI icons come from Lucide (ISC license). The product art is generated once into `public/demo` as plain SVG files.

## How this grows

| Now | Later | When |
| --- | --- | --- |
| SQLite file | Postgres | More than one server writing |
| Clearing on dashboard load | Cron job | First real traffic |
| Webhooks handled inline | Queue with retries | When a slow store response could hold a request |
| In memory rate limits | Redis | More than one server |
| Polling | Server sent events | If the feed needs to be instant |
| Local uploads | S3 or R2 with a CDN | First real creators |
| Bio page rendered per request | Cached at the edge, refreshed on product change | Real traffic spikes from viral videos |
