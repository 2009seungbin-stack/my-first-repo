# Nerulio 2.0 — migration plan (turning the platform on)

Everything below is off until the build flag `PLATFORM=on` is set; without it the build is today's
site. Steps marked **owner** need the Cloudflare account; everything else is in the repository.

## 0. What ships behind the flag
- Server-rendered pages from D1: `/{ko,en}/community/` (front, `best/`, `report`), `/{l}/search/`,
  `/{l}/radar/`, channels `/{l}/{vertical}/{slug}/` with `…/{no}`, `write`, `history`,
  `status` (AI services), `local-llm` (GPUs); entity sitemaps `/sitemap-n2-{vertical}.xml`.
- Write API `/api/v2/*` (follow, posts, comments, votes, compat/issue/benchmark reports, rollout votes,
  flags, nickname) for the page islands in `src/platform/islands.js`.
- `_routes.json` adds only those prefixes; tool pages stay static and never wake the Worker.

## 1. Check locally (no account needed)
```
npm test                       # unit + integration (node:sqlite stands in for D1)
npm run typecheck              # strict JSDoc types of platform/ and server/platform/
npm run test:platform          # browser E2E on tools/platform/dev-server.mjs
npm run dev:platform           # http://localhost:8788/ko/community/ (sign in: /__dev/login?as=me)
npm run preview:platform       # static preview in .n2/preview/
```

## 2. D1 (owner)
Uses the existing D1 setup of the service layer (`docs/CLOUDFLARE.md`, `ops/d1.wrangler.toml`).
1. Apply migrations 0003–0009 to preview first, then production:
   `npx wrangler d1 migrations apply nerulio-preview --remote --config ops/d1.wrangler.toml`
2. Load the seed graph (sources, entities, facts, relations, versions, events, compatibility, search index):
   ```
   node tools/platform/export-sql.mjs dist-seed.sql          # ≈ 7 MB, rebuilt from data/seed
   npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --file dist-seed.sql
   ```
   It is for the first load: rows are `INSERT OR IGNORE`, so re-running adds nothing and never deletes
   collector or community data. Later seed edits go through the ingest pipeline:
   `.github/workflows/seed-sync.yml` runs `node tools/platform/seed-sync.mjs --d1 --verticals <v>` for every
   vertical whose `data/seed/<v>/` changed in a push to `main` (same variable and secrets as step 5; Actions →
   "Nerulio 2.0 seed sync" → Run workflow for a manual run, `radar` = show the edit on the Radar). It writes
   under the seed identity: an unchanged seed writes ~0 rows and never moves "last verified" or reverts what
   collectors, admins or the community wrote since; names/descriptions merge per locale (a collector's `ko`
   name survives a seed without one). Each run is recorded as `seed-sync-<vertical>` in the admin app.
   Locally / against a copy: `node tools/platform/seed-sync.mjs --sqlite copy.sqlite [--verticals games]`.
3. Check: `--command "SELECT vertical,COUNT(*) FROM entities GROUP BY 1"` → 5 rows, 1,580 total.
4. Write budget: the seed load alone writes ≈107,000 D1 rows (FTS index included) — more than the Free plan's
   100,000 rows written per day, which is shared by every database in the account. On Free, load the seed right
   after 00:00 UTC and let the collectors start the next UTC day (they fail with "exceeded D1's free tier daily
   row write limit" until then). Steady-state collector runs write only what changed (each run logs
   `rows written`), so daily use after the first load is small.

## 3. Pages settings (owner)
- Preview environment variables: `SERVICE_API=on`, `PLATFORM=on` (the service Worker renders the pages;
  `PLATFORM=on` without `SERVICE_API=on` fails the build on purpose).
- The D1 binding `DB` and `SESSION_SECRET` already exist for the service layer.
- Google sign-in: the redirect URI is unchanged (`/api/v1/auth/google/callback`); channel pages send
  readers there with `?return=<page>`.

## 4. Preview review
- Open `/ko/community/`, a channel per kind (`/ko/ai/claude/`, `/ko/games/caves-of-qud/`,
  `/ko/hardware/rtx-5070/`, `/ko/studio/ableton-live/`, `/ko/subculture/bleach-tybw-the-calamity/`).
- Sign in, follow, write, comment, report; check `/ko/ai/claude/status` and a GPU's `local-llm` page.
- Status panels say "확인 전" until the status collectors run (step 5): intended.

## 5. Collectors (owner: GitHub secrets + one variable)
`.github/workflows/collectors.yml` runs `tools/platform/collect.mjs --d1` once per adapter (a matrix planned by `tools/platform/collector-plan.mjs`, so one slow collector cannot time out the rest): official feeds → the ingest
pipeline → D1 through the REST API (`platform/db/d1-rest.js`), with every run recorded in
`collectors`/`collector_runs`. Status pages every 30 minutes, everything else every 6 hours.
1. Cloudflare API token with **D1 Edit** (account-scoped: one token covers the preview and production
   databases of the account).
2. GitHub → Settings → Secrets: `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID` (the preview database), `CF_API_TOKEN`.
   Optional `CF_D1_DATABASE_ID_PROD` adds production (step 6). The workflows pass
   `CF_D1_DATABASE_IDS=preview:<id>[,prod:<id>]` to `collect.mjs`, `seed-sync.mjs` and `fx.mjs`
   (`platform/db/d1-targets.js`; a bare `CF_D1_DATABASE_ID` still works for one database): each source is
   fetched **once** and the same document is ingested into each database in turn, logged as
   `d1[preview] <adapter>: ok, N changes, Q queries, R rows written` and recorded in each database's
   `collector_runs`. A failing database never skips the other; the job fails at the end (→ notify).
   Sequential, not parallel: parallel halves the wall time (measured on the local shim) but doubles the request
   rate against the per-user Cloudflare API limit that all six matrix jobs share, so the collect/sync jobs
   get 90 minutes instead (a Steam ingest takes 10–30 min per database).
3. GitHub → Settings → Variables: `PLATFORM_COLLECTORS=on` (until then the workflow does nothing).
4. Run it once by hand (Actions → Nerulio 2.0 collectors → Run workflow) and check
   `SELECT adapter,last_success_at,last_error FROM collectors`.
The status panels switch from "확인 전" to "보고된 장애 없음 / 장애 조사 중" after the first successful run.
The same workflow fetches the ECB reference rate (`tools/platform/fx.mjs`) every 6 hours; "≈ ₩" appears
next to USD plan prices once a rate is stored (hidden again if it is more than 10 days old).

## 6. Production (owner)
Same as steps 2–3 on production (migrations + first seed load into `nerulio-prod`), then add the secret
`CF_D1_DATABASE_ID_PROD` = `bc890e90-fca6-4837-82ad-0574c2378293` (the `nerulio-prod` id; ids are
identifiers, not secrets — the existing token already covers it). From the next run every collector,
seed sync and FX update writes production too, so it needs no separate collector backfill; the first
Steam runs into production are a full ingest (slow, write-heavy). Both databases count against the same
account-wide daily D1 write budget (step 2.4): with two databases, the collectors write about twice as many rows.
Remove the secret to stop writing production. Then:
- Search Console + Naver Search Advisor: submit `sitemap.xml` (it lists the `sitemap-n2-*` files).
- Keep boards low-key at first: the market research recommends opening AI, 한글패치 and GPU channels
  first and having the 신고 → 임시조치 → 처리 기록 flow staffed before any promotion.

## Rollback
Unset `PLATFORM` and redeploy: the platform routes leave `_routes.json` and the static site is served
as before. D1 tables stay; nothing in the static site reads them.
