# Caught

A link in bio for TikTok Shop affiliates. Every product gets a short number. The creator says "it's #47 in my bio", the viewer types 47 and buys on TikTok Shop, Amazon or the brand's site, and the creator gets credit either way.

Nothing slips.

## Quick start

Requires Node 20.12 or newer. No accounts, API keys or database server needed.

```bash
npm install
npm run setup
npm run dev
```

`npm run setup` creates `.env` with fresh secrets, builds the SQLite database and seeds 90 days of demo data. Then open http://localhost:3000.

## Demo

| | |
| --- | --- |
| Bio page | http://localhost:3000/mayafinds |
| Product by number | http://localhost:3000/mayafinds/47 |
| Sold out, with backup | http://localhost:3000/mayafinds/43 |
| Creator dashboard | http://localhost:3000/login |

Demo creator: `demo@caughtshop.com` / `nothingslips`, or the "Log in as the demo creator" button.

Everything outside the app (TikTok Shop, Amazon, brand stores, texts, payouts) is simulated. The Sandbox page in the dashboard drives it.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app on port 3000 |
| `npm run setup` | Create `.env`, migrate and seed |
| `npm run seed` | Reset the demo data |
| `npm test` | Run the unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## Stack

Next.js 16, React 19 and TypeScript. SQLite through better-sqlite3 and Drizzle. Tailwind CSS 4, Zod, Vitest. The reasons for each are in [docs/technology.md](docs/technology.md).

## Decisions

The brief left a lot open. The main calls I made:

- The number box is the page. Typing a number shows the buy button inline, two taps from landing to TikTok Shop.
- Numbers are never reused, so an old video never points to the wrong product.
- Sold out products stay findable and show the creator's backup.
- TikTok Shop is always the main button. Amazon and the brand site sit under it.
- Caught is the partner of record for its links, the way LTK works, so it can track and pay out commission.

Every decision and the reason behind it: [docs/decisions.md](docs/decisions.md).

## What I'd build next

Real TikTok Shop, Amazon and brand network connections. A tracker for TikTok policy violations. Real SMS and payouts. Postgres with a job queue. The full list is at the end of [docs/decisions.md](docs/decisions.md).

## Documentation

| Doc | What's in it |
| --- | --- |
| [Architecture](docs/architecture.md) | What the app does and how a request moves through the code |
| [Money](docs/money.md) | Attribution, commission, the ledger and payouts |
| [Data](docs/data.md) | How data is stored, the tables and the rules they follow |
| [Technology](docs/technology.md) | Each tool, why I picked it and what I compared it to |
| [Security](docs/security.md) | How webhooks, sessions, uploads and payouts are protected |
| [Decisions](docs/decisions.md) | Every call I made where the brief was open, and what's next |

## Credits

Demo product art uses [Lucide](https://lucide.dev) icons (ISC). Fonts are Instrument Sans and Martian Mono (SIL Open Font License) via Fontsource.
