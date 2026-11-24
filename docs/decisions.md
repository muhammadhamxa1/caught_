# Decisions

The brief left these open. For each one, this is what I picked and why.

## The viewer side

**The number box is the page.** A viewer comes from one video with one number in their head and maybe ten seconds of patience. So the first thing on the page, right under the creator's name, is one big box: "Type the number from the video". Typing 47 shows a buy card right under the box, with the TikTok Shop button already there. They don't need to open another page.

**One box for numbers and words.** "47", "#47" and "lip oil" all work. If the input is only digits it's treated as a number, otherwise as a search. Two separate boxes would mean the viewer has to decide first.

**Search runs in the browser.** The page already has every product on it, so search is instant even on a bad connection. The server uses the same search code, so a "miss" means the same thing on both sides.

**The newest video's numbers show as chips under the box.** Most viewers come from the latest video, so one tap gets them there.

**Missed searches are logged when the viewer stops typing.** Not on every key press, which would log "s", "st", "sta". We log once per distinct search after a short pause. Numbers that don't exist are logged too, as "#52", because that tells the creator they said the wrong number in a video.

**Numbers are never reused.** Each account has a counter. Archiving a product keeps its number taken. A video from months ago still says "#12", and #12 should never become a different product.

**Sold out products stay findable.** The old video is still out there getting views. Hiding the product would make the number look broken. Instead the page says "#43 Peach lip oil is sold out. Maya picked #47 instead." and shows the backup with its own buy buttons. If the backup also sells out, we follow its backup, up to three steps.

**Backups are suggested.** When a creator marks something sold out, we suggest a backup: in stock, same category first, then what already gets clicks, then the closest price. When TikTok Shop reports a listing sold out on its own, that suggestion is applied automatically so there is never a dead end.

**Archived products say so.** Typing an archived number says it's no longer listed and offers the backup if there is one.

**TikTok Shop is always the main button.** It's where the creator usually earns the most, and the viewer is already logged in to TikTok. Amazon and the brand site sit under it, labelled by store name. A viewer who trusts Amazon more still buys through the creator.

**"Text me when it's on sale" takes a phone or an email in one field.** Phones are normalised (a 10 digit number is treated as US). The same person signing up twice is one signup. If the product is sold out, the signup is for the restock instead, and the label says so. Messages go out on their own when the creator sets a sale price or marks the product back in stock. Each signup gets one message, with a STOP line on texts.

**Find by video opens the product straight away when the video has one product.** With more than one, a sheet slides up with that video's products.

**The page discloses affiliate links** in the footer, in plain words.

## The creator side

**Sign up claims a handle first.** It's the first field because it's the thing they'll paste into their TikTok bio. Handles that clash with app routes or could confuse viewers are reserved.

**Adding a product starts with a TikTok Shop link.** Paste it and the name, price, image and commission plan fill in. In the sandbox this reads a small fake catalog. Everything can still be typed by hand.

**Videos are linked by product numbers.** The form asks "Product numbers in this video: 47, 43". That's how creators already think about their products. The first number is shown on the video's tile.

**Videos track whether TikTok pulled the basket link.** It's one field, and it lets the dashboard show what Caught earned from videos that would otherwise earn nothing.

**The dashboard leads with money, then traffic.** The headline is the commission caught in the period. Under it, the numbers read like a receipt. The brief asked for clicks per product and which button people chose, so there is a table for that. Missed searches each have an "Add" button that opens the new product form with the search filled in.

**"Sales the basket would have missed"** is its own panel: sales from videos with pulled links, from sold out backups, and from Amazon and brand sites. That's the case for Caught in one place.

**Multiple accounts under one login.** Creators run several niche accounts. One login owns any number of handles, the default view combines them, and a switcher narrows to one. They share one wallet and one payout.

**Receipt cards.** Every sale has a receipt page with an id that can't be guessed, plus a 1080 by 1350 image sized for stories. It shows the product, store, rate and commission. Nothing about the buyer.

**Caption writer.** It writes hooks, a caption, a pinned comment and a reply for "link??" comments, all with the product number in them. It works with no API key using a built in writer. It can also use any OpenAI compatible endpoint, including a local Ollama, through `WRITER_API_URL` and `WRITER_MODEL`. If that call fails, it falls back to the built in writer.

**Claim check.** The brief says one word like a health claim can get a link pulled, and repeat violations can freeze commissions. So every caption the writer produces, every video caption, and anything pasted into the checker is scanned for wording that often causes that: cure, heal, treat, naming a condition, growth claims, weight loss, "clinically proven", guarantees. It explains why and suggests safer wording. It's a heuristic list, not TikTok's rulebook, so it warns and never blocks.

**The dashboard works on a phone.** Creators run their business from their phones. The side nav becomes a scrolling tab bar and tables scroll sideways.

## Money

**Caught is the partner of record.** The brief says the creator gets credit either way, and asks nothing about how money moves. For payouts to mean anything, I assumed Caught works like LTK: the stores and networks settle commission to Caught, and Caught pays the creator. If the real product keeps creators on their own TikTok and Amazon affiliate accounts, the ledger still works as a reconciliation view and the payout module can be switched off.

**Attribution needs our click id.** A store reports an order with the click id we gave it. We credit it only if the click exists, was for that same store, wasn't a bot, and the order landed inside that store's window: TikTok Shop 7 days, Amazon 24 hours, brand sites 30 days. These live in one config file. We allow one minute of clock drift, since stores send whole seconds. An order id is only ever counted once per store.

**Each store has an adapter.** TikTok Shop, Amazon and brand networks all report orders in different shapes. Each adapter turns its payload into the same five events: placed, shipped, delivered, completed, refunded. Adding a store is one adapter.

**Commission base.** Items after seller discounts. Never tax or shipping. Rounded half up per sale, in cents.

**Tiers.** A product can pay more after a number of units in a calendar month (UTC). The rate comes from units sold before this order, so the order that crosses the line is paid at the old rate. Every commission keeps the rate it was paid at.

**Pending, then cleared.** Commission clears when the store's return window closes: delivery plus 15 days on TikTok Shop, 30 on Amazon and brand sites, or right away when the store says the order is complete. The clearing job runs when the dashboard loads. In production it's a cron job.

**Refunds.** Pro rata on the refunded share of the sale. Partial refunds add up. Before clearing, they come off pending. After clearing, they're clawed back from available, which can go negative until new earnings cover it.

**The ledger is append only.** Nothing is edited or deleted. Each money movement is written into four buckets: pending, available, in a payout, and paid. Moves between buckets must add up to zero or the write throws. Balances are sums, never stored numbers that can drift.

**Payout rules.** Minimum $25. One payout in progress at a time. Never more than what's available. A payout method has to be on file. The request and the balance hold run in one transaction, and an idempotency key means a double tap makes one payout. The first payout gets a manual check. After that, payouts up to $250 are approved on their own. Both limits are in `.env`.

**Payout statuses.** Pending, approved, paid. Approve and reject are Caught's own ops decisions. Paid and failed come back from the payout provider as signed webhooks. Rejected and failed payouts release the money back to available.

**Only a masked payout label is stored.** Full account details would live with the payout provider, never in our database.

## Design

**The brand is a receipt.** Off white paper, near black ink, one green. Numbers, prices and totals use a monospaced font, Martian Mono. Everything else uses Instrument Sans. Product and receipt cards have a torn bottom edge, and dashed lines split sections the way a till receipt does.

**Green only where money lands.** Commission, available balance, paid payouts, the "Caught" line on a receipt. Never buttons, never decoration. Buttons are ink.

**The voice is number first and plain.** "Caught $2.25 from #47", not "You earned money!". Errors say what went wrong and what to do.

**Charts are one series at a time.** Commission is green because it's money landing. Clicks and visits are ink. The button split uses solid, hatched and outlined segments with labels, so it reads without colour. Every chart has a table view.

## Technical

**SQLite for the MVP.** It runs anywhere with no setup, and its synchronous transactions make the money code simple. Postgres is the move for production.

**The sandbox uses the real path.** Placing a test order, moving an order along, changing stock and settling a payout all send signed webhooks over HTTP to `/api/webhooks`. If that HTTP call can't be made, the same signed body goes straight to the handler.

**The seed goes through the real engine.** It walks 90 days one day at a time with a fixed random seed. Every visit, click, order, delivery, refund and payout calls the same functions the app uses, in time order. So the dashboard, the ledger and the payout history agree.

**Analytics are SQL over raw events at read time.** That's fine into the hundreds of thousands of rows. Daily rollups come later. Days are grouped in UTC.

**The live feed polls every five seconds.** Simpler than websockets and good enough for an activity list.

**Rate limits are in memory.** Fine for one process. The interface stays the same when it moves to Redis.

**Uploads go to local disk** under `data/uploads`. In production that's S3 or R2 behind a CDN.

## What I'd build next

- **Real store connections.** TikTok Shop affiliate API for product sync and order reports, Amazon Associates reports, and Impact or Awin for brand sites. The adapters are already split per store, so each one is a new adapter.
- **Violation tracker.** Under the June 2026 policy, six of the same violation in 90 days can freeze a creator's commissions. Track pulled links per rule and warn at three.
- **Real texts and emails.** Twilio and Postmark behind the outbox, with double opt in and STOP handling.
- **Real payouts.** Stripe Connect or Tipalti, with tax forms and a scheduled payout run.
- **Video import.** Pull thumbnails, captions and view counts from TikTok, and spot a pulled basket link without the creator telling us.
- **Postgres, a job queue and Redis.** Clearing as a cron job, webhooks through a queue with retries, rate limits in Redis.
- **Cached bio pages** at the edge, refreshed when the creator changes a product, for viral spikes.
- **Agency access.** One manager across many creators, with roles.
- **Smarter backups.** Pick the backup by what actually sells after a sell out, not just by category and clicks.
