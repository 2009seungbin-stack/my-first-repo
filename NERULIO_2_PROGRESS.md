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

## In progress
- Wave-1 data agents (brief `C:\Users\2009s\nerulio-handoff\N2-DATA-AGENT-BRIEF.md`), branches `nerulio/n2-data-{ai,games,hardware,studio,subculture}`.
- UI mockups (시안) for the owner: Design canvas created at https://claude.ai/artifact/FkbKnfqfrbmLKgo4tixbqz (empty so far). Screens to draw, from the study §6–7: anonymous home, My Radar home, Radar feed, GPU entity, game entity (Korean patch matrix), AI feature + rollout widget, /community, thread, report form, Studio preflight, subculture upcoming, search; desktop 1120 grid + mobile.

## Next
1. Draw the mockups → owner review → only then renderers/islands.
2. Community logic (verification score, rollout aggregation, reputation tiers), search queries, radar/my-radar feeds, analytics ingestion, preflight evaluator, API v2 router, GitHub/Discord OAuth.
3. Merge data branches, D1 local seeding, SSR renderers, build integration behind `PLATFORM=on`, E2E, docs `NERULIO_2_MIGRATION_PLAN.md`, `docs/NERULIO_2_SCHEMA.md` (ERD).

## Known risks
- Workers Free plan: 10 ms CPU + 100k requests/day for SSR pages → Workers Paid ($5/mo) likely at launch.
- D1 bulk seed must run from Node (D1 REST / wrangler), not through the Worker (CPU limit); update D6 in the architecture doc (collectors write via D1 REST instead of an ingest endpoint).
- Production needs owner actions: create D1, bind to Pages, apply migrations, secrets, flip `PLATFORM=on`.
