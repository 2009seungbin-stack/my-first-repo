# Nerulio 2.0 — backlog (from the 2026-09-29 research)

Sources: `research/MARKET.md`, `research/COMPETITORS.md`, `research/SITE-AUDIT.md`. Status is updated as work lands.
Effort: S < 2 h · M ≈ half a day · L ≥ a day. "Owner" = needs an account, money or a production action.

## Why these, in one paragraph
Korean search is Naver 64 % / Google 28 % (H1 2026) and Naver cites its own blogs/cafés; Google's
forum features are mostly Reddit. So Nerulio wins on pages nobody else has in Korean — "지금 Claude 장애?"
(Downdetector + IsDown combined), Korean-patch × game-build compatibility with automatic
"re-check after update" (ProtonDB model, SteamDB-style history), GPU × local-LLM fit with estimate and
measurement kept apart, official model prices with change history — and on the Korean board grammar
users already expect (말머리, 념글, 글번호, [댓글]). Community cold start argues for launching the
AI, 한글패치 and GPU channels first, facts before boards, legal basics before any board opens.

## Done tonight
- [x] Write API `/api/v2` + islands + write page + structured compat report (ProtonDB-style) — COMPETITORS #3
- [x] "지금 {서비스} 장애?" status page with user reports, spike badge, official incidents — COMPETITORS #2
- [x] Per-entity change history page — COMPETITORS #1
- [x] Local dev server + browser E2E (`npm run dev:platform`, `npm run test:platform`)

## Now (no external accounts)
1. [x] Search page on alias + FTS5 index; Radar page; 념글 page; 신고 form + `/api/v2/flags` — AUDIT 4, 15, 16, 21 (M)
2. [x] Cache key: only allowed params, integer page, `Object.hasOwn` for kind, 301 others — AUDIT bug 1 (S)
3. [x] Status box says "not checked yet" until a status collector run exists — AUDIT bug 3 (S)
4. [x] `public:false` properties never rendered; `safeHref` refuses `/\` — AUDIT bug 5 (S)
5. [x] Migration 0005: indexes for board/front/stats queries; channel bar after entity lookup — AUDIT bug 2, 8, 9 (M)
6. [x] SEO content gate `platform/seo.js` (indexMin, facts, relations, posts) → noindex thin pages — AUDIT 7 (M)
7. [x] Entity sitemaps (per vertical) from D1 + sitemap index entry — AUDIT 17, MARKET #4 (M)
8. [x] Post page: best comment id duplicate, cross-locale canonical, sign-in `?return=` — AUDIT runners-up (S)
9. [x] Security headers on SSR responses, `form-action 'self'` for n2 forms in ad builds — AUDIT 11 (S)
10. [x] GPU local-LLM page `/{l}/hardware/{gpu}/local-llm` (estimate vs measured) + benchmark report form — COMPETITORS #8, #9 (M)
11. [x] Board: 념글 tabs today/week/month; per-channel best threshold — COMPETITORS #6 (S)
12. [x] Tool ↔ channel mapping fix (labs on Godot/Blender, not on every game) — AUDIT 14 (S)
13. [x] Structured data per type (Event, BreadcrumbList, SoftwareApplication, Product) — AUDIT 12, MARKET #5 (M)
14. [x] Model price history table on AI channels (official USD only; KRW as note) — COMPETITORS #10, MARKET #1 (S)
15. [~] Korean name backfill + validator warning for missing ko names (69 % of entities lack one) — AUDIT 18 (L). `validate-seed --korean` reports coverage; search now finds games through their Korean patch names. The backfill itself needs sourced names (steam-store collector, Laftel) — not invented.
16. [x] `tsconfig.json` + `tsc --noEmit` in CI; `NERULIO_2_SCHEMA.md`, `NERULIO_2_MIGRATION_PLAN.md` — AUDIT 25 (S)

## Also done tonight
- [x] Korean patch channels + "업데이트 이후 미확인" warning on game channels (COMPETITORS #4)
- [x] Model channels (price, history, availability, local-run estimate)
- [x] Collectors on GitHub Actions → D1 REST with run health (off until the owner enables it)
- [x] My Radar + unread count; moderation queue (임시조치/복구/기각/제한, action log)
- [x] Seed export for D1 + `NERULIO_2_MIGRATION_PLAN.md`

## UX walkthrough fixes (2026-09-29, research/UX-WALKTHROUGH.md)
- [x] Moderators see and restore hidden content (was a blocker); 신고 flow names its target
- [x] Compat click = one vote per person, never a post; counts agree
- [x] Search: several words, Korean names via patches, intent shortcuts (장애 / 가격 / 로컬)
- [x] AI channel status box shows the user-report spike; cheapest model kept; model table filters
- [x] Signed-in front box, mobile Radar link, 내 정보 (my posts, sign-out), Radar filter and pre-orders
- [x] Tables in posts, comment edit, post tag change, 404 page for missing posts, write drafts
- [x] GPU side-by-side comparison (`?type=gpu&vs=a,b`)
- [ ] KRW approximation of USD plan prices (needs a sourced exchange rate — owner decision)
- [ ] Korean names for subculture people and goods (data with sources)

## Later / owner
- Naver Search Advisor + Google Search Console registration, sitemaps submit (owner)
- D1 provisioning, bind, migrations, secrets, `PLATFORM=on` (owner)
- Collectors: set the secrets + PLATFORM_COLLECTORS=on (owner); GeForce driver collector — AUDIT 23
- GitHub/Discord sign-in (OAuth apps) — AUDIT 24
- Transparency page (public summary of moderation actions) — MARKET #7
- Image uploads only after the illegal-image filter duty is covered (MARKET: 100k DAU / all images from 2026-07-01)
- Affiliate links with automatic 광고 disclosure; ads only on fact panels (MARKET #9, #10)
- Alerts: follow → My Radar → email digest (COMPETITORS #5)
