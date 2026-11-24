# Money

How a click becomes a sale, a sale becomes commission, and commission becomes a payout. This is the part of the code that has to be right every time, so it gets its own doc.

All money is integer cents. All rates are basis points, so 15% is stored as 1500. Floats never touch a balance.

## Attribution: whose sale is it?

`attributeOrder()` in `src/server/tracking.ts`.

A store reports an order with the click id we gave it. We only credit the creator when:

- the click id exists,
- the click was for that same store,
- the click wasn't flagged as a bot,
- the order landed inside that store's window: 7 days for TikTok Shop, 24 hours for Amazon, 30 days for brand sites,
- and we haven't recorded that store's order id before.

The windows live in one place, `src/server/networks.ts`. We allow one minute of clock drift, because stores send whole seconds and their clocks aren't ours.

## Commission

`recordSale()` in `src/server/commissions.ts` writes the sale, its commission and its first ledger row in one transaction.

- **Base.** The item price after seller discounts. Never tax or shipping.
- **Rate.** Each product has rules per store in `commission_rules`. A rule can have a minimum number of units per month, which is how tiers work: 15% normally, 20% after 25 units.
- **Which tier.** We count units sold earlier in the same calendar month (UTC) and pick the highest tier already reached. The order that crosses the line is still paid at the old rate. `pickRule()` is a small pure function with its own tests.
- **Rounding.** Half up, per sale, in cents.
- **History.** The rate used is saved on the commission row. Changing a product's rate later never changes money already earned.

## Pending, then cleared

A buyer can return an item, so new commission is **pending**.

- When the store says the order was delivered, `markDelivered()` sets a clear date: delivery plus 15 days for TikTok Shop, 30 for Amazon and brand sites.
- `settleDue()` clears every pending commission whose date has passed. It runs when the dashboard loads. In production it would be a cron job.
- If the store tells us the order is complete before that, `markCompleted()` clears it straight away.

Order status only moves forward: placed, shipped, delivered, completed. A late or replayed event that would move it back is ignored.

## Refunds

`applyRefund()`. Refunds can come in parts, and they add up.

- The commission drops by the same share as the refund. Refund half the order, lose half the commission.
- Before clearing, it comes off **pending**.
- After clearing, the money is already **available**, so it is clawed back from there. Available can go below zero. New earnings pay it back before the creator can cash out again.
- A fully refunded order marks the commission as reversed.

## The ledger

`src/server/ledger.ts`. This is the most important idea in the codebase.

Picture the creator's money in four boxes:

| Box | Meaning |
| --- | --- |
| pending | Earned, but the return window is still open |
| available | Cleared, can be cashed out |
| locked | Asked for in a payout, on its way |
| paid | Sent to the creator |

We never store a balance and update it. Each movement of money is a new row in the `ledger` table, and a balance is the sum of the rows in that box. Rows are never edited or deleted.

| Event | Rows written |
| --- | --- |
| Sale | +amount to pending |
| Return window closes | −amount from pending, +amount to available |
| Refund before clearing | −refund from pending |
| Refund after clearing | −refund from available (clawback) |
| Payout requested | −amount from available, +amount to locked |
| Payout paid | −amount from locked, +amount to paid |
| Payout failed or rejected | −amount from locked, +amount to available |

A move between boxes is always two rows that add up to zero, or `post()` throws. Rows that share a `txn_id` belong to one movement.

Why do it this way? Any balance can be explained by reading its rows. Nothing can drift, because nothing is overwritten. And there is a simple check that must always be true: the whole ledger adds up to the sum of commissions. There is a test for exactly that.

## Payouts

`src/server/payouts.ts`. Payouts are per login, so one payout covers all of a creator's accounts.

**Rules for a request**, all checked inside one transaction together with the balance hold:

- at least $25 (`PAYOUT_MIN_CENTS`),
- not more than what is available,
- a payout method on file,
- no other payout in progress.

SQLite lets only one write run at a time, so two fast taps can't both pass the balance check. The form also sends an idempotency key. If the same key comes again, we return the payout we already made instead of a second one.

**Approval.** A creator's first payout waits for a manual check. After a creator has been paid once, payouts up to $250 (`PAYOUT_AUTO_APPROVE_MAX_CENTS`) are approved on their own.

**Statuses.** The allowed moves are a small table, `TRANSITIONS`:

```
pending   -> approved, rejected
approved  -> paid, failed, rejected
paid, rejected, failed -> nothing
```

Approve and reject are Caught's own ops decisions. Paid and failed come from the payout provider as signed webhooks to `/api/webhooks/payouts`, handled the same way as store webhooks.

**Payout method.** Only a masked label is stored, like `PayPal m••••s@gmail.com`. Full bank or PayPal details would sit with the payout provider.

## The assumption behind payouts

The brief says the creator gets credit either way, but not how the money moves. I assumed Caught works like LTK: it is the partner of record for the links it serves, the stores and networks pay Caught, and Caught pays the creator. That is what makes a payout module meaningful.

If the real product keeps creators on their own TikTok and Amazon affiliate accounts instead, the same ledger works as a reconciliation view of what each store owes them, and the payout module can be switched off.
