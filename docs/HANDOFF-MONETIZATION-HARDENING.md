# Handoff — monetization hardening (`nerulio/monetization-hardening`)

Base: `origin/nerulio/studio-monetization` + `origin/main` (PR #34 merged in). Plan and red-team:
[MONETIZATION-SECURITY.md](MONETIZATION-SECURITY.md). Owner decisions (2026-09-24): fail-closed metered
exports after a small server-signed grace; free Google sign-in after `FREE_ANON_STUDIO_EXPORTS` (3)
anonymous engine exports; chargeback → immediate Free + flag, refund → keep the paid period, past_due →
7-day grace; monthly USD 4.99 + yearly USD 40 (config-driven, saving computed).

## Status

| Part | State |
| --- | --- |
| Server: anonymous Studio allowance → `SIGN_IN_REQUIRED`, logout carry-back, session cap | done, tested |
| Server: network buckets (narrow /32 · /64, wide /24 · /48; IPv6 expanded), hard cap, Turnstile bound to the identity, anonymous-Studio network share | done, tested |
| Server: signed offline grace tokens + `POST /jobs/reconcile`; only after a counted job | done, tested |
| Server: ECDSA-signed answers (`/me` plan, every allowed authorize), nonce-bound | done, tested |
| Server: replay window (`OPERATION_EXPIRED`), rate-limit stopgap, `SESSION_SECRET_PREVIOUS` | done, tested |
| Billing: disputes/chargebacks, refund policy, past_due grace, monthly + yearly price ids, `NERULIO_ENV` ignored on Pages builds | done, tested (sandbox + synthetic Paddle events) |
| Admin stats: refusals by reason, flagged accounts, past_due count, Pro-sharing suspects | done, tested |
| Client: fail-closed authorize, signature checks, /me retry (B8), selective-block check, sign-in in a new tab | done, tested |
| Studio: friendly sign-in dialog, quiet anonymous note, outage copy (ko/en/ja) | done, screenshots reviewed |
| Pricing/account: monthly + yearly (saving computed), anonymous allowance, past_due / dispute notes | done, tested |
| Red-team: `tests/redteam/api-attacks.mjs` in `npm test` via `tests/redteam.test.mjs`; `tests/redteam/browser-attacks.py` | API: 32 BLOCKED / 6 ACCEPTED; browser: see below |

## Next tasks (not in this phase)

1. **Paddle checkout page ("default payment link")** — the owner leans to Paddle. `POST /transactions` returns a
   `checkout.url` that must open on a page of our site where Paddle.js runs; that page does not exist yet
   (docs/BILLING.md). Build it, register it as the default payment link in Paddle, and run the full
   sandbox flow (checkout → webhook → Pro → cancel/refund/chargeback) before `BILLING_MODE=live`.
2. **Custom domain + WAF rate limiting** (owner action when the domain is bought): see "Owner setup" step 12.
3. Optional: Workers Rate Limiting binding `RATE_LIMITER` if Pages supports it for the project.

## Owner setup — Cloudflare Pages variables, in this order

Preview first, then Production, each with its own values (never share secrets between them).

1. Accounts base (existing, docs/CLOUDFLARE.md): D1 binding `DB`, `SESSION_SECRET` (secret, ≥ 32 chars),
   `SITE_URL`, `SERVICE_API=on`, Google OAuth (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`).
2. **Apply migration `0002_monetization_hardening.sql`** to `nerulio-preview`, then `nerulio-prod`
   (`npx wrangler d1 migrations apply <db> --remote --config ops/d1.wrangler.toml`). Additive; safe with the old Worker.
3. **Signed answers:** run `node tools/ticket-keys.mjs` once per environment →
   `TICKET_PRIVATE_KEY` (secret) and `TICKET_PUBLIC_KEY` (plain variable; the build reads it).
4. **Turnstile (required before accounts go public):** `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (secret).
   Without it only the hard network cap stops farming (red-team A7d).
5. Limits (optional; defaults shown): `FREE_DAILY_STUDIO_EXPORTS=10`, `FREE_ANON_STUDIO_EXPORTS=3`,
   `FREE_DAILY_JOBS=30`, `ANON_NETWORK_STUDIO_EXPORTS=30`, `ANON_NETWORK_DAILY_JOBS=160` (soft, Turnstile),
   `NETWORK_DAILY_HARD_LIMIT=800`, `NETWORK_WIDE_DAILY_HARD_LIMIT=3200`, `OFFLINE_GRACE_EXPORTS=3`,
   `API_RATE_PER_MINUTE=120`, `MAX_SESSIONS_PER_USER=5`, `PRO_SHARING_NETWORKS=10`.
6. Prices (display): `PRO_PRICE_MONTHLY_AMOUNT=4.99`, `PRO_PRICE_YEARLY_AMOUNT=40`, `PRO_PRICE_CURRENCY=USD`
   (the pricing page computes "save 33%").
7. Billing (Paddle, sandbox first): `BILLING_PROVIDER=paddle`, `BILLING_MODE=sandbox`, `BILLING_API_KEY` (secret),
   `BILLING_WEBHOOK_SECRET` (secret), `BILLING_PRICE_ID` (the USD 4.99 monthly price),
   `BILLING_PRICE_ID_YEARLY` (the USD 40 yearly price), optional `BILLING_PRICE_IDS_LEGACY`.
   Paddle webhook events to enable: `subscription.*` and `adjustment.*`. Needs the checkout page (Next task 1).
8. `PAST_DUE_GRACE_DAYS=7` (3–7 allowed). `ADMIN_GOOGLE_SUBJECTS` for `/api/v1/admin/stats`.
9. Never set `NERULIO_ENV` on Pages (it is ignored on Pages builds anyway; `/health` warns).
10. Redeploy; check `/api/v1/health` → `configured, database, google, turnstile, tickets` all true.
11. Rotating `SESSION_SECRET` later: put the old value in `SESSION_SECRET_PREVIOUS` for a few weeks, or every
    anonymous counter resets.
12. **Later, with a custom domain:** Security → WAF → Rate limiting on `/api/v1/*` (e.g. 60 req/min per IP for
    `jobs/*`, 20/min for `auth/*` and `billing/checkout`). The app-level limiter is only a per-isolate stopgap.

## Verification

See the final report in the session; commands: `npm test`, `npm run check`,
`NERULIO_CORPUS='C:\nope' python tools/regression.py`, `SERVICE_PORT=4551 python tests/service-browser.py`
(scenarios `free,ads,studio,signin`; `SERVICE_SCENARIOS=signin` for one), `node tests/redteam/api-attacks.mjs`,
`python tests/redteam/browser-attacks.py`. Screenshots: `test-results/studio-monetization/`
(`studio-signin-{en,ko,ja}.png`, `studio-outage-{en,ko,ja}.png`, `pricing-{en,ko,ja}.png`, `account-back-to-studio-en.png`).
