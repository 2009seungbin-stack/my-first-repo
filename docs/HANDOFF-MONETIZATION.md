# Handoff — Studio monetization (`nerulio/studio-monetization`)

Branch base: `origin/nerulio/ship-studio-texture` (main + Texture, PR #32). Merge `origin/main` once #32 lands.
Owner decisions (2026-09-24, final): Photopea model — Free Studio shows one labelled desktop ad column, Pro removes it
(no ad request at all); no Studio ads on mobile/narrow; Free usage limits, Pro unlimited; never lower Free output
quality; light actions never counted; quiet limit UX; price config-driven (`PRO_PRICE_*`).

## Status

| Part | State |
| --- | --- |
| Research (Photopea/Pixlr/Kapwing/remove.bg/Canva/Figma/TexturePacker; AdSense policy citations) | done — docs/ADS.md "Studio ad column"; screenshots `C:\Users\2009s\nerulio-handoff\scratch\monetization\` |
| Studio ad column (`src/studio/monetize/ad-column.js`, `layout.js`, `monetize.css`) | done, tested |
| Config `ADSENSE_SLOT_STUDIO` (validated, CMP-gated, never in previews) | done, tested |
| Studio export metering (`STUDIO_ACTIONS` in `src/quota.js`, separate counter `FREE_DAILY_STUDIO_EXPORTS`, default 10) | done, tested (unit + real Pages runtime) |
| Limit dialog, remaining note, outage behaviour | done, tested |
| Pricing/account pages: Pro as the game-studio plan, Studio exports | done, tested |
| Docs: ADS.md, PRICING-MODEL.md, STUDIO.md, CLOUDFLARE.md | done |

## Files

New: `src/studio/monetize/{index,boot,layout,ad-column,meter,notes,limit-dialog,strings}.js`, `monetize.css`,
`tests/studio-monetization.test.mjs`, `tests/studio-monetization-browser.py`, this file.

Shared files touched (small, isolated hooks — keep them when merging):
- `src/studio/main.js` — 3 lines: `await import('./monetize/index.js')…prepareMonetization()` before `createStudio()`, `monetization?.attach(...)` after it. Only when the head has the service or studio-ad meta.
- `src/studio/workspaces/pack.js` (`runExport` became async with a `meter('studio-pack-export')` gate), `workspaces/tile/index.js` (`doExport`: one line after the "nothing to export" check), `workspaces/texture/panels.js` (export button: one line) + one import each.
- `tools/studio-build.mjs` (head additions via `studioMonetizationHead(config)`), `tools/build.mjs` (passes `config` to `studioPage`).
- `tools/site-config.mjs` (`ADSENSE_SLOT_STUDIO`, `studioAd`, `freeDailyStudio`), `tools/service-build.mjs` (meta gains `freeDailyStudio`), `tools/regression.py` (suite + env pop).
- `src/quota.js`, `src/entitlement.js` (optional `ui` hooks in `authorize()`; per-class usage + grace), `src/service-content.js`, `src/account-page.js`.
- `server/api.js`, `server/config.js`, `server/usage.js`, `server/auth-google.js` (class-aware counters; no migration).
- `tests/service.test.mjs` (+3 tests, 2 extended), `tests/service-browser.py` (`scenario_studio`, `SERVICE_SCENARIOS` selector).
- NOT touched: `src/studio/app.js`, `src/studio/studio.css`.

## Turning it on (owner, Cloudflare Pages → Settings → Variables; Preview first, then Production)

1. Accounts must already be on for limits and Pro (`SERVICE_API=on`, D1, `SESSION_SECRET` … — docs/CLOUDFLARE.md). Without accounts the Studio has no limits and every visitor is Free for ads.
2. `FREE_DAILY_STUDIO_EXPORTS` (optional, default 10). Check with `=2` on Preview (docs/CLOUDFLARE.md step 9b).
3. `PRO_PRICE_AMOUNT` / `PRO_PRICE_CURRENCY` / `PRO_PRICE_INTERVAL` when the price is decided (with `BILLING_PRICE_ID`).
4. AdSense: after site approval, create one **Display ads** unit named e.g. "Studio column" → `ADSENSE_SLOT_STUDIO=<10 digits>`; `ADSENSE_CLIENT` is already the publisher id. Configure the Google-certified CMP (AdSense → Privacy & messaging → European regulations message), verify it, then `ADSENSE_CMP_READY=true`. In AdSense → Ads → Auto ads, exclude `/game/studio/*` (URL exclusions).
5. Redeploy. Check on Preview: 1440×900 shows the "Advertisement" column; 390 px shows none; a manual Pro row (CLOUDFLARE.md step 10) shows no column and no request to googlesyndication.

## Verification (this branch)

2026-09-24 at `ac43421`: `npm test` 1731 pass / 0 fail / 1 skip; `npm run check` OK;
`NERULIO_CORPUS='C:\nope' python tools/regression.py` FULL PASS (existing 51, recipes 46, growth 22, seo 402, studio 103,
sprite 95, pack 61, tile 45, texture 41, studio-monetization 79); `python tests/service-browser.py` 82 checks
(free + ads + studio 32). Commands:
`npm test`, `npm run check`, `NERULIO_CORPUS='C:\nope' python tools/regression.py`, `python tests/service-browser.py`
(`SERVICE_SCENARIOS=studio` runs only the Studio scenario), `python tests/studio-monetization-browser.py` (standalone;
`SHOTS=<dir>` for screenshots).

## Open / not verified

- Live AdSense delivery, real fill rates, CMP behaviour per region and Google's review of ads inside the app are
  operational and unverified (tests intercept Google). If review objects, empty `ADSENSE_SLOT_STUDIO`.
- Chromium only (no Firefox/WebKit run for the Studio column).
- The UI and Pixel workspaces (other branches) have no metered exports yet; when their bundle exports land, classify
  them in `STUDIO_ACTIONS` and add a `meter()` call (docs/STUDIO.md "Monetization").
