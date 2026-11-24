# Security

What is protected and how.

## Webhooks

Stores and the payout provider call us with webhooks, so anyone who can fake one could fake an order or a payment.

- Every webhook is signed with HMAC SHA256 over the timestamp and the exact raw body (`src/server/signing.ts`). The header looks like `t=<unix seconds>,v1=<hex>`, the same pattern Stripe uses.
- Signatures older than five minutes are refused, so a captured request can't be replayed later.
- The compare uses `timingSafeEqual`, so response timing doesn't leak how much of a signature was right.
- Each store and the payout provider has its own secret. A leaked Amazon secret can't fake a TikTok order.
- Event ids we've already handled are ignored, so a retried webhook can't double count.
- Bodies over 64 KB are refused before parsing.
- Every webhook is logged with what we did, including rejected ones.

The Sandbox page has a "Send a forged order" button to show a bad signature being refused.

## The public page and redirects

- The public page only gets names, numbers, prices and images. Store links and commission rates stay on the server.
- `/go` only redirects to the link saved on the product. It never takes a target from the URL, so it can't be used as an open redirect.
- Events from the browser are only trusted if the product or video id belongs to that creator's page.

## Accounts and sessions

- Passwords are hashed with scrypt from Node's own crypto module, with a random salt per password.
- The session cookie is httpOnly, SameSite Lax, and Secure in production. The database stores a SHA256 hash of the session token, so a copy of the database can't be used to log in.
- Login errors say "Email or password is wrong" either way, so the form doesn't reveal which emails have accounts.
- Handles that clash with app routes or could confuse viewers are reserved.

## Ownership

Every dashboard action checks that the logged in user owns the account, product, video, sale or payout it touches (`ownsAccount()` in `src/server/session.ts`). One creator can never change another's data by guessing an id.

## Input

- Webhooks, events and sign up are validated with Zod.
- Links saved on products and profiles must be http or https. A `javascript:` link can't end up on a public page.
- Search queries and captions are length limited.
- Uploaded images are checked by their first bytes, not their name or mime type. Only PNG, JPG and WebP up to 4 MB. They're saved under random names and served with `X-Content-Type-Options: nosniff`.

## Rate limits

`src/server/ratelimit.ts` limits logins, sign ups, "text me" signups, events and buy clicks per IP. A viewer is never blocked from buying: if `/go` is over its limit it still redirects and only skips the log. The limiter is in memory, which is fine for one server. With more servers it moves to Redis behind the same function.

## Payouts

- The payout request and the balance hold happen in one transaction, so two requests can't spend the same money.
- An idempotency key stops a double submit from creating two payouts.
- Only a masked payout label is stored. Real account details would stay with the payout provider.

## Headers and secrets

- Every response sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and a `Permissions-Policy` that turns off camera, microphone and location.
- No secrets are committed. `npm run setup` writes random ones into `.env`, which is git ignored.
- The sandbox posts its webhooks to `APP_URL` from config, never to a URL built from the request's Host header, so a forged header can't redirect a signed payload.

## Not done yet

- CSRF: server actions in Next.js check the Origin header, and cookies are SameSite Lax. There's no separate token.
- No email verification or password reset in the MVP.
- No content security policy yet. It's worth adding once the image hosting is settled.
