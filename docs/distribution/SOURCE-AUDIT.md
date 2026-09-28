# Source and capability audit — 2026-09-28

The original SITE checkout was on `quality/engine-overhaul` (`d9fd223`) and lacked the current
game SEO architecture. Work was isolated in `codex/nerulio-distribution`, based on production
`origin/main` (`19d422c`). The original checkout and its branch were preserved.

| Area inspected | Current source and implications |
| --- | --- |
| Sitemap | `tools/sitemaps.mjs`: game, guides and tools groups; capability-qualified routes only. `tools/build.mjs` renders 904 static entries; the production-origin audit inspects 472 sitemap URLs. |
| Search registries | `src/intents.js`, `src/landings.js`, `src/game-seo*.js`; `gamePageFor` resolves original intents, keyword pages and lab pages. Application/classic routes are not article candidates. |
| Intent depth | `src/seo-depth/index.js`: 13 ownership groups, typed problem statements, worked examples, target steps, evidence and limitations. All 108 eligible game pages have English depth content. |
| Languages | English, Korean and Japanese are present; this system takes English only and never emits translated duplicates. |
| Guides | `tools/guides-registry.mjs` currently returns no guide pages because `src/guides.js` is absent. No fictional guide URLs were added. |
| Existing audits | `docs/SEO-CONTENT-MODEL.md`, `SEO-AUDIT.md`, `SEO-CANNIBALIZATION-AUDIT.md` and the generated intent inventory were inspected. Near-topic cooldown complements, rather than changes, existing canonicals. |
| Deployment | `DEPLOYMENT.md`, `tools/site-config.mjs`, `tools/service-build.mjs`; Cloudflare production follows main. Journal writes use a separate branch. Live source checks do not assume a main commit has deployed. |
| Actions | Existing `ci.yml` and `indexnow.yml` remain unchanged. New distribution workflow has its own state and concurrency. |
| Sprite / Aseprite | `src/game/export/godot.js`, `src/studio/sprite/import-build.js`, `src/studio/sprite/atlas-data.js`, `docs/STUDIO-SPRITE.md`, `docs/ASEPRITE-IO.md`. Frame timing, tag and trim limits remain explicit. |
| Pixel / normal | `src/game/pixel-cleanup.js`, `src/game/texture-normal.js`, `src/game/normals/convention.js`, Pixel and Texture workspace code/docs. Distinguish palette changes, alpha changes and convention inference. |
| Tile | `docs/STUDIO-TILE.md`, terrain algorithms and recorded Godot fixture under `tests/fixtures/tile/`. Missing tile art is not repaired by changing metadata. |
| Verification | `docs/ENGINE-VERIFY.md`, `STUDIO-PACK.md`, `STUDIO-TEXTURE.md`, `STUDIO-PIXEL.md` and checked-in tests/fixtures. The new articles use illustrative arithmetic, not fresh benchmark claims or unbounded compatibility claims. |
| Pricing/privacy | `docs/PRICING-MODEL.md`, `src/policies.js`, service and quota code. Current live game page has no service meta; optional Free/Pro infrastructure is not represented as a live paid offer. Root package license is UNLICENSED, so listings must not call Nerulio open source. |

All eight initial canonical destinations returned HTTP 200 HTML with an exact self canonical and
without an HTML or HTTP noindex directive on 2026-09-28. This verifies availability for distribution,
not Google indexing, traffic, ranking or conversion performance.

The inventory includes existing screenshot and social-card paths, not proof that every image is
suitable for every channel. Launch materials list originals and needed crops; no screenshot was
fabricated. Site loading, palette retrieval, optional dependencies, analytics/advertising or enabled
account services may make network requests. Local file processing is not a promise of zero traffic.
