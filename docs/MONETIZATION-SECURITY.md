# Monetization security — threat model, red-team results and hardening plan

Status: **Phase 2 implemented (2026-09-24)** — see §7 for the before → after results. Phase 1 text below is kept as written. The owner
approves the plan before Phase 2. Branch: `nerulio/monetization-hardening` (off
`origin/nerulio/studio-monetization`). Live production has the account service OFF (`/api/v1/me`
→ 404) and ads OFF, so nothing here is exploitable in production yet; all work is on local builds.

Scope: the Pro entitlement, the Free daily usage limits (`FREE_DAILY_STUDIO_EXPORTS`,
`FREE_DAILY_JOBS`), billing/webhook integrity and the ad column. Read alongside
[PRICING-MODEL.md](PRICING-MODEL.md), [AUTH.md](AUTH.md), [BILLING.md](BILLING.md),
[ADS.md](ADS.md), [CLOUDFLARE.md](CLOUDFLARE.md).

## 0. The one fact that governs everything: local-first

Nerulio processes every file **in the browser**. No file is uploaded and there is no server-side
render/export step. The only thing the server can meter is a small `{operationId, toolId}` ping the
page chooses to send. Therefore:

- **The export/engine bundle itself is produced entirely by client JS an attacker fully controls.**
  A determined user who edits the JS, overrides `fetch`, or calls the exporter modules from the
  console can always produce the bundle without asking the server. This is not a bug we can patch
  away; it is the physics of a local-first web app.
- The realistic goal is therefore **not "unbreakable"**. It is: (a) make the *honest* path robust
  and server-authoritative so casual users and simple ad/JS blockers cannot trivially get unlimited
  Pro-grade use; (b) make the *dishonest* path require real, ongoing effort (editing code every
  session, running a userscript) so it does not scale into a business problem; (c) fully close the
  attacks that ARE server-verifiable — **Pro entitlement and billing** — because those cost real
  money. Compare Photopea (no usage limit at all — ads only) and Pixlr (a 3-save/day cap that spawned
  a cottage industry of bypass extensions): a browser-side count is a *nudge to convert*, never a
  vault. Our design should be honest about that with the owner.

What this means for priorities: **spend the security budget on billing/Pro (money) and on farming/DoS
(cost + fairness). Treat the Free export counter as a soft, best-effort nudge, and do not pay a
large UX price to defend a number that JS-editing defeats anyway.**

## 1. Assets, actors, trust boundaries

### Assets (what an attacker wants, ranked by cost to us)
1. **Pro entitlement** — worth the subscription price × time. Server-verifiable. Must be hard.
2. **Billing state** — refund/chargeback abuse, entitlement after non-payment. Real money. Must be hard.
3. **Free daily counters** (studio exports, heavy jobs) — no server cost per use; value is only as a
   conversion lever. Best-effort.
4. **Ad impressions / revenue** — ad blockers are expected and accepted (stated policy). Concern is
   only that Pro must never silently request Google, and Free must not be *forced* to keep ads by us.
5. **Service availability / D1 write budget** — an attacker (or a botnet) writing rows to exhaust the
   D1 free tier or run up cost. Real operational cost.

### Actors
- **Casual free user** — clears cookies, uses incognito, a second browser, maybe a VPN. No tooling.
- **Power user with devtools** — overrides `fetch`, edits Local Overrides, calls console functions.
- **Scripter** — a userscript/extension or headless script; repeatable, unattended, at scale.
- **Account farmer** — creates many free Google accounts, or many anonymous identities across IPs.
- **Chargeback/refund fraud** — pays, uses Pro, then refunds or charges back.

### Trust boundaries
- **Browser (fully untrusted).** All JS, the DOM, `localStorage`, `fetch`, every client module.
  Nothing the browser says about plan or usage may be trusted for entitlement. (Today the client
  correctly re-derives entitlement only from `/me`, never from storage — good.)
- **Edge → Worker (`/api/v1`, trusted code, untrusted inputs).** `server/**` on Cloudflare Pages
  advanced mode. Sees cookies, `CF-Connecting-IP`, request bodies. This is the only place a decision
  can be authoritative.
- **D1 (trusted store).** Counters, sessions, subscriptions, webhook dedup.
- **Google OAuth, Turnstile, the payment provider (external, semi-trusted).** Reached only server-side
  with secrets that never touch the browser.
- **The build (`tools/*`).** Bakes public config into HTML and the Worker bundle; secrets are Pages
  secrets checked out of `dist`. A misconfiguration here (e.g. `NERULIO_ENV=development` in prod) is
  an operator-side risk, see A9d.

## 2. Red-team results

Two harnesses were written and run against **local builds only** (never the live site or any third
party):

- `tests/redteam/api-attacks.mjs` — in-process against `server/api.js` with an isolated in-memory D1
  (`tests/d1-shim.mjs`), controllable clock. `node tests/redteam/api-attacks.mjs`.
- `tests/redteam/browser-attacks.py` — the **real Pages runtime** (`wrangler pages dev` + local D1 +
  Chromium), same rig as `tests/service-browser.py`, port 4551. Google's ad script is stubbed.
  `python tests/redteam/browser-attacks.py`.

Results are machine-readable in `test-results/redteam/{api,browser}.json`. Verdicts: **WORKS** = the
bypass succeeded, **PARTIAL** = worked with caveats or is a defect short of a full bypass, **BLOCKED**
= the attack was stopped.

### 2a. Summary table

| # | Attack | Verdict | Evidence (local build) |
| --- | --- | --- | --- |
| A1 | Clear cookies / incognito / 2nd browser / new profile — fresh anon cookie = fresh full allowance (no Turnstile) | **WORKS** | 50 fresh cookies from one IP → 500 studio exports at limit 10 |
| A1b | Same, with Turnstile configured | PARTIAL | First challenge only after the network soft-limit (default 160); each new cookie's challenge is human-solvable |
| A1c | VPN / IP rotation (distinct IPv4, or distinct IPv6 /64 in one /48) | **WORKS** | 40 IPs → 400 exports, 0 challenges; IPv6 /64 rotation likewise |
| A2 | Replay an ALLOWED operationId after the limit | **WORKS** (harmless today) | Returns `allowed:true` uncharged; client ignores it. Must not become a signed-ticket re-issue |
| A2b | Replay an operationId for a *different* tool | BLOCKED | 409 OPERATION_CONFLICT |
| A2c | Replay a 2-day-old allowed operationId (pre-cleanup) | **WORKS** (harmless today) | Idempotency record still present for 3 days |
| A3 / B9 | Race: parallel authorize at the limit | BLOCKED | Single-batch D1 transaction; 25–30 parallel → exactly 1 allowed, `used` never exceeds limit (both shim and workerd) |
| A4 | Forged bodies: unknown/light tool, `#studio` suffix injection, negative `used`, foreign `subject`, wrong types, oversize | BLOCKED | Closed field set + tool registry: UNKNOWN_TOOL / NOT_METERED / BAD_REQUEST / 413; `used` unchanged |
| A4b | Negative / overflow / non-integer limit config | BLOCKED | Falls back to default 10/30 |
| A5 | Forged/unsigned `nerulio_anon` cookie (choose or reset an id) | BLOCKED | HMAC-signed; bad signature → new id issued |
| A5b | Restore a backed-up cookie jar / share one cookie between browsers | BLOCKED | Counter is server-side, keyed by the signed id |
| A5c | Guessed/forged session token | BLOCKED | Only SHA-256(token) stored; forgery → logged-out, stale cookie cleared |
| A5d | Stale session cookie + used anon cookie → `/me` shows full allowance | **PARTIAL** | Display bug only; `authorize` still denies (429). Fix `me()` to fall back to the anon subject |
| A5e | `SESSION_SECRET` < 32 chars | BLOCKED | Service reports SERVICE_NOT_CONFIGURED (fails closed) |
| A5f | Rotating `SESSION_SECRET` resets every anonymous counter | **WORKS** (operator-only) | No key ring; rotation changes all anon ids. Document as an operational caveat |
| A6 | CSRF on state-changing endpoints (foreign page burns a victim's quota / logs them out) | BLOCKED | Origin + Sec-Fetch-Site + JSON content-type all enforced; no CORS |
| A6b | A script simply sends Origin + Sec-Fetch-Site | **WORKS** (expected) | Origin checks are not bot checks; bots are handled by quota + Turnstile |
| A7 | Anonymous 10/10 then sign in → carry-over (sign-in is not a reset) | BLOCKED | `carryOverStatements` MAX-merges the anon count into the account |
| A7b | Use the account allowance, then log out → the same browser's anon cookie has its own full allowance | **WORKS** | Account and anon are separate subjects; logout reveals the anon subject |
| A7c | Account farming: each free Google account = a fresh 10/day, no per-IP cap for signed-in users | **WORKS** | 20 accounts from one IP → 200 exports |
| A8 | Time / UTC-reset manipulation (client `Date` header, clock edge) | BLOCKED | The day is the Worker's UTC clock; client time ignored; reset exactly at 00:00 UTC |
| A9 | Forge Pro via webhook: unsigned / wrong secret / stale ts / tampered body / replay | BLOCKED | 401 on all; valid event once, replay `duplicate:true` |
| A9b | Out-of-order delivery: old "active" after "canceled" | BLOCKED | `occurredAt` monotonic guard; stays Free |
| A9c | Signed event for an unknown user id | BLOCKED | Recorded `ignored`, grants nothing |
| A9d | Prod build refuses sandbox billing — UNLESS `NERULIO_ENV=development` is set in prod | **WORKS** (operator footgun) | Then sandbox re-enables; exploitation still needs `BILLING_WEBHOOK_SECRET` |
| A10 | Paddle refund / chargeback (`adjustment.created`) | **WORKS** (by design) | Ignored; user keeps Pro until period end. Needs a policy + a handler |
| A10b | `past_due` (card retry in progress) | PARTIAL | Drops Pro immediately — no grace. Policy decision |
| A10c | Only one `BILLING_PRICE_ID` is Pro | PARTIAL | A 2nd price (yearly/discount) stores as plan `other` = paying but not Pro. Handle before adding plans |
| A11 | Pro sharing: one session cookie from 50 networks, unlimited concurrent sessions, Pro leaves no trace | **WORKS** | Password-sharing analogue; accepted risk, but cap concurrent sessions + log |
| A12 | Admin stats/cleanup as anon / normal / stale-admin | BLOCKED | 404 unless an allow-listed Google sub with a session < 12 h old |
| A13 | Unauthenticated D1 write amplification (no WAF on `*.pages.dev`) | **WORKS** | ~4 row-writes per cookie-less authorize; ~25k requests to reach the D1 free write tier |
| A14 | Share a solved-Turnstile `nerulio_human` cookie across fresh identities | BLOCKED | Bound to its anon id; other identity still challenged |
| B1 | Incognito / fresh profile = fresh Studio allowance (real runtime) | **WORKS** | 3 profiles × (limit+1) → limit ZIPs each |
| B2 | Block `/api/v1` → 3 "temporary" exports/browser/day, **reset by clearing `localStorage`** | **WORKS** | grace key `nerulio.grace.v1.studio`; also no ad column while blocked |
| B3 | Rewrite every `/api/v1` response to 503 SERVICE_NOT_CONFIGURED (no-code proxy rule) | **WORKS** | Unlimited exports; client treats "unconfigured" as unmetered |
| B3b | Rewrite only the authorize response to 400 UNKNOWN_TOOL ("version skew") | **WORKS** | Unlimited exports; `/me` still loads normally |
| B4 | Userscript overrides `window.fetch` → authorize returns unlimited | **WORKS** | Unlimited; page then believes it is Pro |
| B5 | Rewrite `GET /me` to a Pro answer | **WORKS** | No ad column, no Google request, unlimited exports, 0 authorize calls |
| B6 | Replace `meter.js` via DevTools Local Overrides / extension | **WORKS** | Unlimited; server never hears of the exports |
| B7 | Import the unbundled exporter modules from the console and build bundles directly | **WORKS** | `core.zip`, `game/tiles/exports.js`, `game/export/targets.js` all reachable; 0 API calls |
| B8 | One transient `/me` failure at load pins the page "offline" for the session | **PARTIAL** | Page never re-checks; spends local grace then pauses while the service is healthy |
| B10 | Real Pro session: zero Google requests, no ad DOM | BLOCKED | Confirms Pro never contacts Google |
| B10b | Free user blocks only `GET /me` → no ad column | **WORKS** (by design) | Unknown plan = no ad (conservative); a user can suppress the column but also loses nothing we sell |
| B11 | Shipped monetization modules are readable, unbundled ES modules | **WORKS** | Obvious patch targets |

### 2b. What this tells us

- **Server-authoritative pieces are solid.** Idempotency, the single-batch counter transaction (no
  race), origin/CSRF, cookie signing, session hashing, webhook signature + dedup + ordering, admin
  gating, config validation, UTC reset, Turnstile binding — all BLOCKED. The backend is well built.
- **The Free export counter is bypassable at will**, in five independent ways that need *no code*
  (B2, B3, B3b, B5) or a trivial userscript (B4, B6), plus identity resets that need nothing at all
  (A1, A1c, B1) and the console path (B7). This is inherent to local-first. **The current
  "fail-open" design makes it worse than it needs to be**: treating `SERVICE_NOT_CONFIGURED`,
  `UNKNOWN_TOOL`/`NOT_METERED`, and any network error as "allow" turns three one-line proxy rules
  into unlimited use (B2/B3/B3b). That is the single biggest cheap win available.
- **Pro/billing is money and is well-defended server-side**, but three product gaps remain: refunds
  and chargebacks are not handled (A10), the grace/`past_due` policy is unset (A10b), and multi-price
  plans would mis-classify (A10c). And **the client trusts a forged `/me` Pro answer** (B5) — but that
  only fools *that browser*; it never actually grants server-side Pro (heavy jobs that DO reach the
  server would still be metered). The real Pro entitlement cannot be forged without the webhook secret.
- **Farming and DoS are open** (A7c, A13) and are the items with genuine cost. No per-IP cap on
  signed-in accounts; no rate limit on `*.pages.dev` (WAF needs a custom domain).
- **Two real defects to fix regardless of the plan:** A5d (`/me` over-reports the allowance when a
  dead session cookie sits next to a used anon cookie) and B8 (a single `/me` failure pins the page
  offline for the whole session, over-triggering the grace path).

## 3. The plan

### 3a. Design principle to adopt: fail-**closed** for metered exports, fail-open for light tools

Today the client fails **open** everywhere (comment in `src/entitlement.js`: "Fail-open… a small
daily grace keeps heavy tools usable during an outage"). For **light** tools (crop, edit, preview,
save `.nerulio`, single PNG) fail-open is correct and must stay — those are never metered and the
product promise is that work is never held hostage.

For **metered engine-export bundles**, the honest trade-off is different. The recommendation:

- Keep a **small, non-resettable** grace for genuine outages, but make it *server-signed* and *not
  stored in plain `localStorage`* (see 3c) so B2 cannot reset it and B3/B3b cannot fake "unconfigured"
  to get unlimited. During a real outage the user still gets the grace count and keeps all their work
  (autosave, `.nerulio`, single PNG) — the product promise holds. After the grace, exports pause.
- This converts B2/B3/B3b from **unlimited** to **grace-limited** — a large gain for one design
  change, at the cost of: during a true multi-hour outage a heavy Pro-less user is limited to the
  grace count of *engine bundles* (they can still export single PNGs and save the project). Given
  engine bundles are the one metered action, this is acceptable and matches Pixlr/-style behavior.

Owner decision required: **fail-open vs fail-closed for metered exports during an outage.**
Recommended default: **fail-closed after a small signed grace (e.g. 3), work never lost.**

### 3b. Recommended metering architecture (as server-authoritative as local-first allows)

The most that is achievable without uploading files: bind the *right to a metered export* to a
server-issued, single-use, signed token, and require a (free) account after an anonymous allowance.

1. **Entitlement only from the server session (already true — keep it).** `/me` derives plan from D1
   subscription rows every request; never from client state. Do not regress this.
2. **Signed, single-use export tickets** (replaces today's advisory authorize):
   - `POST /jobs/authorize` returns a short-lived (e.g. 60 s) **ticket**: `HMAC(secret, subject |
     toolId | operationId | day | exp)`. The client must present the ticket to a **second server
     call at the moment of download**, which marks it spent (idempotent on `operationId`).
   - This does not stop B7/B6 (the client can still build the ZIP itself), but it means the *count*
     cannot be inflated by replay (A2/A2c stop re-issuing), and it gives a clean audit event per real
     export. Residual risk: unchanged for a JS-editing attacker; closes casual/replay inflation.
   - **Honest about limits:** because the bundle is built locally, a ticket can only *gate the count*,
     not the artifact. This is the ceiling of local-first. State this to the owner plainly.
3. **Anonymous allowance, then a free account** (addresses A1/B1 farming of anonymous identities):
   - Allow `N_anon` engine exports per signed anon identity per day (e.g. 3), then require a free
     Google sign-in to continue up to `FREE_DAILY_STUDIO_EXPORTS`. Sign-in raises the cost of a reset
     from "open incognito" to "create a Google account" (A7c), which Google's own anti-abuse throttles.
   - UX cost: the search-driven first-time user hits a login wall sooner. Mitigation: keep `N_anon`
     generous enough that a real hobby session (3–8 exports, per PRICING-MODEL) rarely trips it, and
     never gate light tools or single-PNG/`.nerilio` saves. **Owner decision:** require a free login
     for engine exports after `N_anon`? (Recommended: yes, with `N_anon` ≈ 3–5.)
4. **Fail-closed metered path with a signed grace** (3a): the grace counter is a server-signed cookie
   bound to the anon id (like `nerulio_human`), decremented server-side, not a plain `localStorage`
   integer. Closes B2. `SERVICE_NOT_CONFIGURED` and `UNKNOWN_TOOL`/`NOT_METERED` must **not** mean
   "unlimited" for a build that shipped with the service meta present — treat an unexpected code as
   the grace path, not as unmetered. Closes B3/B3b.
5. **Fix `me()`** so a dead session cookie falls back to the anonymous subject's real counter (A5d),
   and **fix the client** so a single `/me` failure does not pin the session offline — re-check on the
   next metered action (B8).

### 3c. Anti-farming and anti-DoS (the items with real cost)

- **Per-IP + per-/64 caps for signed-in users too** (A7c): today only anonymous traffic hits the
  network bucket. Add a per-network daily ceiling that also counts signed-in accounts, crossing which
  triggers Turnstile (not a hard block — schools/offices are legitimate). Residual: cloud IPs / large
  VPNs still rotate; combine with the free-account requirement so each reset also costs a Google account.
- **Rate limiting** (A13): `*.pages.dev` cannot carry WAF rules. **Owner/ops action:** put the site on
  a **custom Cloudflare zone** and add WAF rate-limiting on `/api/v1/*` (esp. `authorize`, `auth/*`,
  `billing/checkout`) before turning accounts on at scale. Until then, the single-batch write is 4
  rows/req and D1's free write tier is ~100k/day — a botnet can exhaust it. Add an app-level cheap
  guard: cap anonymous authorize attempts per /64 per minute in the Worker as a stopgap.
- **Cap concurrent sessions per account** and **log Pro authorizations** (A11): today a Pro user
  leaves no `job_authorizations` trail (Pro short-circuits before the counter). Emit a lightweight
  audit row (or counter) for Pro exports so admin stats can spot one account serving hundreds of
  distinct networks (sharing). Residual: sharing is a password-sharing-class problem; make it
  visible and cap it, do not try to eliminate it.
- **Admin abuse dashboard**: extend `/admin/stats` with per-day denied/allowed, distinct networks per
  account, top talkers. Data already mostly present.

### 3d. Billing / Pro (money — must be closed before charging)

- **Refunds and chargebacks** (A10): add handlers for `adjustment.created` (Paddle refund/chargeback)
  and the equivalent, and decide the policy. Recommended: on a **chargeback**, downgrade to Free
  immediately and flag the account (chargebacks are adversarial); on a **voluntary refund**, honor the
  paid period unless the refund is full-and-immediate. **Owner decision.**
- **`past_due` grace** (A10b): today `past_due` → Free at once. A short grace (e.g. keep Pro for N days
  while the card retries) reduces false negatives for honest customers. **Owner decision:** grace days
  for `past_due`? (Recommended: 3–7.)
- **Plan/price mapping** (A10c): before introducing yearly/discount prices or team plans, map a set of
  `BILLING_PRICE_ID`s to `plan='pro'`, not a single id, so a paying customer is never left as `other`.
- **Operator footgun** (A9d): make the build **refuse `NERULIO_ENV=development` on a production build**
  (or ignore it), so sandbox billing can never be re-enabled in prod by an env var. Cheap, high-value.
- **Secret rotation caveat** (A5f): document that rotating `SESSION_SECRET` resets all anonymous
  counters and invalidates in-flight OAuth (sessions survive). Acceptable; just record it.

### 3e. Ads (policy, not a vulnerability)
- Ad blockers are **expected and accepted** (existing policy, ADS.md). A free user removing the column
  (B10b) is fine — they also lose nothing we sell; we simply do not earn from them. No action beyond
  the stated policy.
- **Pro must never request Google** — confirmed BLOCKED (B10). Keep the test that asserts zero Google
  requests for Pro (already in `service-browser.py`; mirror it in the red-team suite).
- Keep the conservative "unknown plan → no ad" rule (avoids showing ads to a possible Pro during an
  outage), and never make ad removal depend on client state an attacker sets.

## 4. Test plan for Phase 2 (must go red → green)

The two red-team harnesses are the regression corpus. In Phase 2, the WORKS/PARTIAL rows that the plan
chooses to close must flip to BLOCKED, and the BLOCKED rows must stay BLOCKED. Concretely:

1. **B2** (localStorage grace reset) → BLOCKED: server-signed grace cookie; clearing `localStorage`
   does not restore grace.
2. **B3 / B3b** (fake unconfigured / version-skew → unlimited) → BLOCKED: an unexpected/failed
   authorize on a service build uses the signed grace, then pauses; never unlimited.
3. **A5d** (`/me` over-reports) → BLOCKED: `/me` reports the anon subject's real remaining when the
   session cookie is dead.
4. **B8** (offline pin) → BLOCKED/PARTIAL→OK: a single `/me` failure does not disable metering for the
   session; the next metered action re-checks.
5. **A10 / A10b** (refund/chargeback/past_due) → new tests asserting the chosen policy in
   `tests/service.test.mjs` (unit) with synthetic signed events.
6. **A9d** (prod + `NERULIO_ENV=development`) → BLOCKED: `runtimeConfig` refuses sandbox on a
   production build regardless of `NERULIO_ENV`.
7. **A7c / A13** (farming / DoS) → PARTIAL→mitigated: assert the free-account requirement after
   `N_anon`, and the per-/64 Turnstile trigger for signed-in traffic. WAF rate-limiting is verified
   operationally (custom zone), noted as out-of-repo.
8. Keep asserting the already-BLOCKED invariants: race (A3/B9), idempotency (A2b), forged bodies (A4),
   cookie/session integrity (A5/A5b/A5c), CSRF (A6), UTC reset (A8), webhook integrity (A9/A9b/A9c),
   admin gating (A12), Turnstile binding (A14), Pro-no-Google (B10).

Both harnesses run offline against local builds and contact no third party; wire them into
`tools/regression.py` as an opt-in suite so they do not slow the default run.

## 5. Prioritised implementation checklist

**P0 — must fix before turning accounts on (cheap, high value, or money):**
- [ ] Fail-closed metered exports with a **server-signed** grace bound to the anon id; stop treating
      `SERVICE_NOT_CONFIGURED` / `UNKNOWN_TOOL` / network error as "unlimited" on a service build.
      Closes B2, B3, B3b. (Client + Worker; ~1–2 days.)
- [ ] Refuse `NERULIO_ENV=development` on production builds (A9d). (`server/config.js`; ~1 h.)
- [ ] Refund/chargeback + `past_due` policy and handlers, before any live charge (A10, A10b, A10c).
      (`server/billing/*`, `identity.js`; ~1–2 days incl. tests + owner decisions.)
- [ ] Fix `me()` allowance over-report (A5d) and the offline-pin defect (B8). (~0.5 day.)

**P1 — before scaling / marketing (fairness + cost):**
- [ ] Free-account requirement after `N_anon` anonymous engine exports (A1/B1/A7c). (Client UX +
      Worker; ~2–3 days; owner decision on `N_anon` and the login wall.)
- [ ] Per-IP/per-/64 daily ceiling that also counts signed-in accounts, Turnstile on crossing (A7c).
      (`server/api.js`, `usage.js`; ~1 day.)
- [ ] Custom Cloudflare zone + WAF rate-limiting on `/api/v1/*`; app-level per-/64/min stopgap (A13).
      (Ops + a small Worker guard; ~0.5 day repo-side.)
- [ ] Audit log / admin stats for Pro exports and per-account distinct-network counts (A11). (~1 day.)

**P2 — hardening and depth (raise attacker cost, nice-to-have):**
- [ ] Signed single-use export tickets with a spend-at-download call (3b.2); stop replay re-issue
      (A2/A2c). (~2 days.)
- [ ] Concurrent-session cap per account (A11). (~0.5 day.)
- [ ] Optional: bundle/minify the monetization + exporter modules to raise the bar on B4/B6/B7 —
      **security theatre-adjacent**, do only if it costs little; document that it does not *prevent*
      the console/override path, only slows it. (~0.5 day.)
- [ ] Document the `SESSION_SECRET` rotation caveat (A5f) in CLOUDFLARE.md. (~0.25 h.)

## 6. What we explicitly cannot prevent (and why it's acceptable)

- A user editing JS, overriding `fetch`, using Local Overrides, or calling exporter modules from the
  console can always produce an engine bundle locally without a valid count (B4, B6, B7). No
  client-side gate survives this; only uploading files to a server export step would, which violates
  the local-first product promise and adds server cost we deliberately avoid. **Photopea has no usage
  limit at all; Pixlr's is routinely bypassed.** Our counter is a conversion nudge, not DRM. Accept it.
- A user can suppress the ad column with a blocker or a `/me` filter (B10b). Accepted policy.
- Account/identity farming can never be reduced to zero — only made costly (free account + per-network
  Turnstile). This matches every freemium web tool.

The security budget is therefore spent where the money is: **billing/Pro (fully server-verifiable —
must be airtight) and farming/DoS (real cost — must be bounded)**, with the Free export counter kept
honest-but-soft and, crucially, **not fail-open into unlimited** (the P0 change), which is the one
place the current design leaks more than local-first forces it to.

## 7. Phase 2 — implemented (2026-09-24)

Owner decisions: fail-closed metered exports after a small server-signed grace; free Google sign-in after
`FREE_ANON_STUDIO_EXPORTS` (3) anonymous engine exports; chargeback → immediate Free + flag; refund → keep the
paid period; `past_due` → 7-day grace; Pro monthly (USD 4.99) + yearly (USD 40). Setup order and variables:
[HANDOFF-MONETIZATION-HARDENING.md](HANDOFF-MONETIZATION-HARDENING.md).

### What changed (by mechanism)

| Mechanism | Where | Closes |
| --- | --- | --- |
| Fail-closed client: `SERVICE_NOT_CONFIGURED`, `UNKNOWN_TOOL`/`NOT_METERED`, network errors are not permission | `src/entitlement.js` | B3, B3b |
| Signed offline grace: HMAC tokens in `/me` (≤ `OFFLINE_GRACE_EXPORTS`, ≤ what is left, only after a counted job today), charged once via `POST /jobs/reconcile`; a blocked authorize with a reachable `/me` is not an outage | `server/usage.js`, `server/api.js`, `src/entitlement.js` | B2, B12 |
| Signed answers: ECDSA P-256 over `/me`'s plan and every allowed authorize, bound to the page's nonce / operationId; verified with the build's public key | `server/tickets.js`, `src/ticket-verify.js`, `tools/ticket-keys.mjs` | B3c, B4, B5 |
| Anonymous Studio allowance (3) → `SIGN_IN_REQUIRED` with a friendly new-tab sign-in; anonymous share per network (30) and per /24·/48 (120) | `server/api.js`, `src/studio/monetize/*` | A1, A1c, B1 |
| Network buckets for every Free identity (narrow /32·/64, wide /24·/48, IPv6 expanded), hard cap, Turnstile bound to the solving identity | `server/api.js` | A1b, A7c, A14, A16 |
| Logout moves the day's counters back to the browser; session cap per account | `server/auth-google.js` | A7b, A11 (cap) |
| Replay window: an operationId older than 10 min is `OPERATION_EXPIRED`; replays are flagged | `server/usage.js` | A2c |
| App-level burst limiter (`API_RATE_PER_MINUTE`, optional `RATE_LIMITER` binding) | `server/ratelimit.js` | A13 (stopgap) |
| `/me` counter fix; `/me` retried before a metered action | `server/api.js`, `src/entitlement.js` | A5d, B8 |
| `SESSION_SECRET_PREVIOUS` key ring | `server/identity.js` | A5f |
| Billing: dispute → revoke + flag + no new checkout; canceled keeps the paid period; past_due grace; monthly/yearly/legacy price set | `server/billing/*`, `server/identity.js` | A10, A10b, A10c |
| `NERULIO_ENV` ignored on Cloudflare Pages builds (`CF_PAGES=1`) | `server/config.js`, `tools/site-config.mjs` | A9d |
| Admin stats: refusals by reason, flagged accounts, past_due, Pro-sharing suspects (distinct networks per account) | `server/api.js`, migration 0002 | A11 (visibility) |

### Red-team before → after

`node tests/redteam/api-attacks.mjs` (also in `npm test` via `tests/redteam.test.mjs`) and
`python tests/redteam/browser-attacks.py` (opt-in `REDTEAM=1 python tools/regression.py`).

| Harness | Before (Phase 1) | After (Phase 2) |
| --- | --- | --- |
| API (in-process, D1 shim) | 12 WORKS · 4 PARTIAL · 16 BLOCKED | **0 WORKS · 0 PARTIAL · 32 BLOCKED · 6 ACCEPTED** (38 rows; new rows A1d, A7d, A10r, A15–A17) |
| Browser (workerd + D1 + Chromium) | 10 WORKS · 1 PARTIAL · 2 BLOCKED | **0 WORKS · 0 PARTIAL · 11 BLOCKED · 6 ACCEPTED** (17 rows; new rows B2b, B3c, B6b, B12) |

### Accepted residuals (documented, cannot or should not be closed)

| Row | What still works | Why accepted |
| --- | --- | --- |
| B6, B6b, B7, B11 | Editing the page's code (Local Overrides, an extension replacing modules, calling exporters from the console) | Local-first: the bundle is built in the browser. Only uploading files to a server export would prevent it, which breaks the product promise. Same as Photopea/Pixlr. |
| B10b | Blocking `/me` hides the ad column | Ad blockers are accepted policy; the same block also stops engine exports. |
| B2b | Toggling a block between loads + clearing all site data each cycle | Manual and bounded: each cycle costs one counted export from the network's anonymous share, and yields ≤ `OFFLINE_GRACE_EXPORTS`. |
| A1d | A residential-proxy pool (every request from a different /24) gets 3 anonymous exports per network | Tying networks together would need fingerprinting, which Nerulio does not do. |
| A2 | Replaying an operationId within 10 minutes returns the original decision (flagged `replay`) | Needed for lost-response retries; never a new count. |
| A6b | Scripts can send Origin headers | Origin checks are CSRF protection, not bot protection. |
| A7d | Without Turnstile keys only the hard network cap (800/day) stops farming | Turnstile keys are a required setup step. |
| A10r | Refund + cancel keeps Pro until the paid period ends | Owner policy. |
| A11 | One Pro session shared across networks | Sessions capped (5) and the account appears in admin stats for review. |
