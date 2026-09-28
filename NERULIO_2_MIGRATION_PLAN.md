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
1. Apply migrations 0003–0005 to preview first, then production:
   `npx wrangler d1 migrations apply nerulio-preview --remote --config ops/d1.wrangler.toml`
2. Load the seed graph (sources, entities, facts, relations, versions, events, compatibility, search index):
   ```
   node tools/platform/export-sql.mjs dist-seed.sql          # ≈ 7 MB, rebuilt from data/seed
   npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --file dist-seed.sql
   ```
   It is for the first load: rows are `INSERT OR IGNORE`, so re-running adds nothing and never deletes
   collector or community data. Later seed edits go through the ingest pipeline.
3. Check: `--command "SELECT vertical,COUNT(*) FROM entities GROUP BY 1"` → 5 rows, 1,580 total.

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

## 5. Collectors (owner: a D1 API token as a GitHub secret)
Collectors (`collectors/*`, `tools/platform/collect.mjs`) fetch official feeds and write through the
ingest pipeline. Scheduling them on GitHub Actions against D1's REST API is the next engineering task
(architecture D6 to be updated: D1 REST instead of an ingest endpoint).

## 6. Production (owner)
Same as steps 2–3 on production, then:
- Search Console + Naver Search Advisor: submit `sitemap.xml` (it lists the `sitemap-n2-*` files).
- Keep boards low-key at first: the market research recommends opening AI, 한글패치 and GPU channels
  first and having the 신고 → 임시조치 → 처리 기록 flow staffed before any promotion.

## Rollback
Unset `PLATFORM` and redeploy: the platform routes leave `_routes.json` and the static site is served
as before. D1 tables stay; nothing in the static site reads them.
