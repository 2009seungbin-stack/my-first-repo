# AdSense content recovery — bounded autonomous work

Owner request: repeated rejection for “가치가 별로 없는 콘텐츠”; close community and make news/commentary visible on the homepage; work alone until **2026-11-15 10:00 Asia/Seoul (2026-11-15 01:00 UTC)**.

Heartbeat automation: `nerulio-11-15-10`, current chat, every 30 minutes until the deadline. Preserve that deadline. Do not create duplicate tasks. This file is the continuation ledger; update it with verified evidence after each batch.

## Authorization and boundaries

Implementation, meaningful local checks, PR, merge, deployment and production verification are authorized. Preserve unrelated edits and retained community data. Do not submit AdSense review, change account/billing settings, delete stored posts/uploads, post external promotion or message other people. Do not claim Google approval or that a particular page count guarantees approval. No invented people, experiences, human review, benchmarks or licensing claims. AI assistance must be disclosed honestly.

Official quality reference: https://support.google.com/adsense/answer/7299563?hl=ko . Source aggregation alone is not an original editorial contribution. Prefer original reproducible work useful to the site's actual tool users.

## Production baseline, verified before this batch

- Community closure PR #83 merged as `bf0b8aacd60a23fb238f5c3089079427323be41a`; live `/build.txt` matched it.
- Retired pages, uploads and public v2 community endpoints return 410 before auth/DB access; owner admin and aggregate hit beacon remain. No data deleted.
- Read-only public UI passed desktop/mobile checks; published news and commentary were both zero on home.
- Full CI exposed stale service-browser scenarios that still expected a comment form; this is a test migration issue, not a reason to reopen community.
- `/ko/radar/` already had official release records. Homepage only queried the separate system-news discussion table, so collected releases were invisible on home.

## Current batch — PR #84, not yet deployed

- `platform/news.js`: merge official recent release metadata with system news; latest release per entity; reject unsafe URLs, future/stale/unverified records. Do not create faux articles. External release links are labeled automatic source collection. Automated news index is noindex and absent from sitemap.
- Public homepage puts publication streams after the intro, ahead of the long tool directory.
- Original Korean/English case study `small-transparent-png`: 12 real encoder runs, original CC0 logo + Kenney CC0 tile sheet. Published assets and SHA-256 evidence in `assets/editorial/2026-11-14-png/`; reproduction script `tools/editorial/measure-compression.py`. No fake human review. Existing six AI-news draft files remain private.
- Editorial note now describes actual AI assistance and technical checks; local editorial images opt-in to Markdown, no remote or traversal image paths.
- Closed-community counts no longer qualify references or derived pages for indexing; sitemap and robots gates agree while explicit owner overrides remain.
- Service browser now tests account OAuth/passkeys on Account, production community closure and unchanged retained data. Old community scenarios are no longer default gates; legacy adapter tests remain isolated.

Checks so far: full Node suite 2,880 passed / 1 skipped; focused indexing/publication tests 14 passed; typecheck and syntax passed (JSDoc updated after the new public-only counter check). Desktop/mobile article and home browser checks passed. Pages Worker + local D1 passkey/public/meteroff: 50 checks passed; signin/social/traffic: 47 passed; free/ads/studio passed in an earlier all-scenario run before a Windows Wrangler migration subprocess exited without output at the next scenario. Remote CI is the single-run gate. First PR head regression and both Cloudflare preview deployments passed; final CI and live deployment remain pending. PR: https://github.com/2009seungbin-stack/my-first-repo/pull/84 .

## Next work, in order

1. Finish desktop/mobile article QA, original-retention/news safety tests and required CI checks. Correct failures rather than weakening active-function coverage.
2. Review diff and content for accurate claims/licenses; commit, create and attach PR; wait for CI, merge and verify exact production build and both languages, sources, article figures, sitemap/noindex and community 410.
3. Audit publicly indexable thin reference pages and duplicate/empty directory routes. Align discovery/sitemaps with actual substantive content; preserve useful tools and valid published commentary.
4. Add another genuinely useful, measured workflow only if it has separate evidence (for example sprite-sheet frame boundaries/export round-trip). Avoid a flood of generic AI-generated news.
5. Check news collector freshness and real pipeline failures, including jobs still writing only to closed community tables. Keep read-only official metadata available without enabling user writes.
6. At the deadline report only verified changes, tests/deployments and remaining limitations; stop this heartbeat. Google review outcome is external and must remain unclaimed.
