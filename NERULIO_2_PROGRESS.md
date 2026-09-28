# Nerulio 2.0 — Progress

Branch `nerulio/n2-platform` (worktree `C:\Users\2009s\Desktop\SITE-n2`). Baseline on origin/main cd1e69a:
`npm test` 2277 pass / 0 fail, build 904 pages; route baseline `tests/fixtures/n2-route-baseline.txt`.

## Completed (verified)
- Audit + `NERULIO_2_ARCHITECTURE.md` (decisions D1–D7: keep static stack, **D1 not Neon** with rationale, JSDoc+tsc, Worker SSR + edge cache, `PLATFORM=on` flag, collectors in GitHub Actions, auth reuse).
- Schema migrations `0003_platform_graph.sql`, `0004_platform_community.sql` — apply cleanly on node:sqlite (51 tables, FTS5 trigram verified for Korean).
- `platform/schema.js`, `platform/verticals/*` (5 vertical configs), `platform/seed.js` + `tools/platform/validate-seed.mjs`, `docs/n2/SEED-FORMAT.md`.
- `collectors/_runtime.js` (host allowlist, politeness, snapshots with sha256) + `tools/platform/collect.mjs`.
- `platform/ingest.js` — one pipeline for seed/collector/admin: facts with scope + history, changes, conflicts (community never overrides official), versions, events, availability, compatibility, UNVERIFIED_AFTER_UPDATE state machine, search reindex. `tests/n2-ingest.test.mjs` 5/5.
- `platform/markdown.js` safe renderer — `tests/n2-markdown.test.mjs` 3/3 (XSS vectors).
- UI research of DC Inside / Quasarzone / Arca.live (live) + Reddit (from knowledge; the site blocks automation): `C:\Users\2009s\nerulio-handoff\research\COMMUNITY-UI-STUDY.md` (§7 component specs).

- All five wave-1 data branches merged (ai, hardware, games, studio, subculture): 32 seed files, 1,580 entities, 0 invalid.
- `tools/platform/seed-db.mjs` imports every seed file through `platform/ingest.js` (two passes for cross-file references). Fixed while doing so: duplicate compatibility/availability keys in one document (validator now refuses them; ingest keeps the last row), the same relation cited twice (stored once, first source wins).
- v3 "channel" UI in code (owner-approved direction: channel header → channel-specific live panel → trending → 말머리 board, wiki on the right):
  - `platform/db/channel.js` (all read SQL), `platform/render/{html,format,strings,ui,channel,post,front}.js`, `src/platform/n2.css` (1180 grid, one column < 1000px, two-line board rows < 640px, dark mode).
  - Panels `platform/render/panels/`: `ai` (status from status-page incidents, recent changes, models + API prices, plans, rollouts), `game` (Steam update, Korean patch compat strip + matrix, official Korean), `gpu` (driver, VRAM-fit ESTIMATE with method, community bench board, specs), `studio` (latest version, OS compatibility per app version), `ip` (countdown, D-days, merch, cast), `generic` fallback.
  - Worker: `server/platform/pages.js` (routes `/{ko,en}/community/`, `/{l}/{vertical}/{slug}/`, `/{l}/{vertical}/{slug}/{no}`, slug redirects, edge cache 60 s + SWR), wired in `server/index.js` behind the build flag `PLATFORM=on` (requires `SERVICE_API=on`; `_routes.json` adds only the platform prefixes).
  - `tools/platform/preview.mjs` renders a local preview (real seed facts + SAMPLE boards from `tools/platform/demo-posts.mjs`, never used in production). Published: https://claude.ai/artifact/6VHYBiwFzrznBeAYNwdU2T
  - Tests: `tests/n2-render.test.mjs` (escaping, formats, every entity type renders ko/en, panels, post, front, routes); `service-build` platform build test. Fixed the admin user count, which counted the Radar bot.

## Not built on purpose (no data source yet)
- Steam concurrent players, "people viewing now", and the Claude usage-limit poll from the v3 mockup: no collector/table yet, so they are left out instead of showing invented numbers.

## Next
1. Islands (`src/platform/*`): follow, vote (post/compat/rollout/driver issue), new-post bar, countdown tick, comment form; API v2 write endpoints they call.
2. Write page (글쓰기, report forms), search page, Radar feed, My Radar.
3. D1 provisioning + seeding via D1 REST, collectors on GitHub Actions, per-vertical sitemaps, E2E with wrangler; docs `NERULIO_2_MIGRATION_PLAN.md`, `docs/NERULIO_2_SCHEMA.md`.

## Known risks
- Workers Free plan: 10 ms CPU + 100k requests/day for SSR pages → Workers Paid ($5/mo) likely at launch.
- D1 bulk seed must run from Node (D1 REST / wrangler), not through the Worker (CPU limit); update D6 in the architecture doc (collectors write via D1 REST instead of an ingest endpoint).
- Production needs owner actions: create D1, bind to Pages, apply migrations, secrets, flip `PLATFORM=on`.
