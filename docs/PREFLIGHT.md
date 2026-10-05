# Nerulio Preflight

## Repository audit (2026-10-05, before implementation)

The source checkout is an older `quality/engine-overhaul` branch with unrelated CSS edits. This implementation starts at current `origin/main` (6536f55) in the managed nerulio-preflight worktree.

* Framework: native ES modules, vanilla DOM islands and generated HTML. No React or client router.
* Routing: `tools/build.mjs` creates static entry pages; `server/platform/pages.js` handles the community in the Cloudflare Pages Worker. New Preflight routes remain static.
* Types: strict TypeScript checking of JSDoc JavaScript in platform/server/admin; extend it to Preflight rather than introduce a second build system.
* Styling: plain CSS, no Tailwind. Portal tokens in `src/platform/n2.css`, self-hosted SUIT / JetBrains Mono, saved explicit light/dark choice in `src/platform/theme.js`.
* Localization: ko/en/ja static tool routes (`src/i18n.js`); ko/en portal strings. Preflight gets all three tool languages, using the existing platform shell (Japanese shell currently falls back to English).
* Tools: `src/task` contains single-task tools and tool directory. Shared portal `page()`, HTML escaping and inline SVG icons can be reused at build time.
* State: DOM islands, localStorage for small preferences; IndexedDB for larger Studio/file handoffs. No external state library.
* SEO: static canonical/hreflang, OG, JSON-LD and grouped sitemaps. New routes follow the English canonical for language-neutral tool aliases.
* Deployment: `npm run build` exports dist; SERVICE_API/PLATFORM optionally packages the existing Worker. No new API, backend, credentials or account requirement.
* PWA: admin/Studio have separate implementations. Do not register a broad service worker for Preflight.
* Tests: node:test, syntax check, strict JSDoc typecheck, Python Playwright real HTTP tests. Engine tests must run without a DOM.

## Architecture

`src/preflight/core` contains types, validation/parser, numeric version normalization, indexed compatibility resolution, evidence/freshness, dependency propagation, named verdict rules, recommendations and report generation. `runPreflight(environment,target,database,adapter,{now})` is deterministic for a supplied clock and never mutates inputs.

`src/preflight/adapters` supplies host names, categories, runtime requirements, sample version defaults and input normalization. `src/preflight/data` is dynamically imported per vertical. A new vertical adds an adapter and dataset; the verdict algorithm does not change.

The UI is a browser island; the static page includes explanatory content, form labels and links before JavaScript runs. All environment inputs, analysis, saves and exports stay in the browser. An optional tools-only variant of the existing portal shell reuses fonts, SVG icons, theme and drawer, without community/account islands or unavailable static links. Production traffic remains independent of the tool; no installation inventory is passed to it.

## Data policy

Catalog membership and vendor links do **not** imply compatibility. Missing, insufficient, conflicting or out-of-scope evidence yields UNKNOWN. Sample components have fictional `demo-*` identities; sample records are accepted only for those identities and a sample environment. Sample source statements are always labelled SAMPLE, never official. Real records and OBS installation rules cite their bounded claim and verification date. Do not infer upper-version support from a minimum requirement.

See the dataset READMEs and `tests/fixtures/preflight`. Compatibility coverage is intentionally conservative. Full Studio/Blender/Godot catalog coverage needs vendor/repository statements curated by OS, architecture, host, component version and target version before production judgments can be expanded.

## Scanner contract

The web application cannot enumerate installed software. It accepts manual entry, pasted lists, environment JSON and local scanner JSON. Scanner output is an inventory, not trusted compatibility evidence. There is no fake PC scan or runtime shell integration.

`schemaVersion:1`, `vertical`, `platform`, `architecture`, `generatedAt`, `host:{name,version}`, `components:[]` and optional `target` define the interchange contract. Imports reject future schemas and oversized/malformed files transactionally. Report exports include the environment so they can be re-imported, but imported verdicts/evidence are discarded and recomputed from the bundled curated database.

## Verdict semantics

Hard critical blocker → BLOCKED. Unresolved break or required dependency blocker → WAIT unless hard. Other blockers, updates, legacy, unknown, stale evidence, prerelease target or explicit exclusions → CAUTION. READY requires a nonempty fully verified applicable stack and a valid current/target/platform/architecture. Reasons carry stable codes plus localized display text. Confidence is evidence-derived, with the weakest relevant component/requirement controlling overall confidence. Recommendations distinguish general safety advice from source-backed actions.

The risk score is deterministic and explanatory, not a probability of success. Status/count/confidence/evidence remain visible. Excluding a component never changes its result to READY.

## Verification

`npm run check`, `npm run typecheck`, `npm test`, `SITE_URL=https://nerulio.com npm run build`, and `python tests/preflight-browser.py`. Production-like build: additionally set SERVICE_API=on, PLATFORM=on, TOOL_METERING=off. QA screenshots and exported artifacts are in test-results/preflight.

Verification record on 2026-10-05:

| Check | Result |
| --- | --- |
| Syntax and strict JSDoc TypeScript | Passed |
| Preflight suite | 36 passed, including 10,000 components and a 10,000-node dependency chain |
| Entire Node suite | 2,797 passed, 1 existing skip, 0 failures (2,798 total) |
| Plain and SERVICE_API/PLATFORM builds | 947 static entry pages each |
| Static SEO audit | 505 canonical pages, 20,107 internal links, 0 errors |
| Chromium browser flows | 23 flows: inputs, dependencies, exclusions, four verticals, comparison, local saves, cross-vertical reload, JSON/HTML exports, clipboard and printing |
| Responsive/accessibility smoke | 320/390/768/1440 widths, light/dark, keyboard picker, reduced-motion-safe captures, ko/en/ja and no-JS SEO |
| Subpath deployment | Same browser flows at /preflight-preview; local fonts and modules loaded successfully |

The static browser server does not execute the existing Cloudflare traffic Worker; its isolated `/api/v2/hit` endpoint is excluded from static asset failures. No inventory upload, page exception or failed module/font request was observed. These checks do not claim a deployed production release or hardware-specific upgrade validation.

Next data priority: curate source-backed OBS plugin releases for the supported host/OS/architecture combinations, then Studio driver/license dependencies and Blender/Godot API/native constraints. A release-ingestion pipeline must retain bounded claims, verification dates and provenance. Scanner CLI, automatic ingestion, hosted permalinks and community submissions are not implemented; the schema, fixtures, adapter/data separation and report envelope provide their integration points.
