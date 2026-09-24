# Advertising boundaries

Advertising remains optional and off without `ADSENSE_CLIENT`. Existing ownership verification uses `ADSENSE_VERIFICATION_CLIENT` to generate ads.txt **without** loading an ad script. This separation stays intact during the Nerulio rename. Google account approval and actual monetization are operational states, not build-time promises.

## Available placement and exclusions

Two existing manual positions, `content-1` and `content-2`, sit between/after explanatory sections below the full editor. Disabled positions create no empty ad boxes. Enabled positions reserve space, have localized Advertisement labels, and preserve iframe nodes during language/tool changes. The source has `editor-workspace`, `result-workspace` and `data-ad-exclude` hooks around editing, previews, actions and dialogs.

### Game home, /game/ hub and game landings (design of 2026-09-24)

The game pages carry the same two positions, placed between content sections so a visitor reaches them only after reading:

| Page | `content-1` | `content-2` | Host of the markers |
|---|---|---|---|
| Home (`/`, `/ko/`, `/en/`, `/ja/`) | after the "how it works" article, before the FAQ | after the FAQ, before the footer | `#siteContent` (from `src/content.js`) |
| Game landing (`tools/game-landing-build.mjs`) | after "How to do it", before the export table | after the FAQ, before the related pages | `.gl-body[data-ad-host]` |
| `/game/` hub | after the workflow groups, before the export list | after the FAQ | `.gl-body[data-ad-host]` |

`src/ads.js` looks for the `<!--ad:…-->` markers in `#siteContent` and in any `[data-ad-host]`. The hero, the drop zone, the header and the Studio link are outside those hosts and carry `data-ad-exclude`; `tests/seo-browser.py` (ads mode) checks at 390 and 1440 px that each page has exactly two labelled slots, none above the fold, none overlapping a call to action, no horizontal overflow and a layout shift under 0.1, and that the Studio (`/game/studio/`) has no ad script or markup. Enabled slots reserve their height (`min-height` 300 px desktop, 290 px phone, `src/game-site.css`); disabled builds have no ad markup at all.

Third position, proposed and **not** activated: a desktop side rail (`sidebar-1`) in the sticky "On this page" column of the landings (`.gl-toc`, ≥ 1100 px only), below the section links. It would need a new `ADSENSE_SLOT_SIDEBAR_1` in `tools/site-config.mjs`, a marker inside a `[data-ad-host]` in that column and a check that it never shows on phones (a hidden responsive unit reports no width). Measure the two in-content positions first.

No units are placed in the drop zone, controls, toolbar, file strip, previews, modals, or beside Download. A desktop side rail and a mobile top anchor are future measured experiments, not activated placements. Auto Ads exclusions must also be configured and inspected in Google's interface; a custom HTML attribute alone does not enforce them.

## Configuration

Use issued production IDs only: `ADSENSE_CLIENT`, `ADSENSE_SLOT_CONTENT_1`, `ADSENSE_SLOT_CONTENT_2`. The build validates formats. Enable slots only after configuring and checking the applicable Google-certified consent setup, then set `ADSENSE_CMP_READY=true`. No fake consent checkbox substitutes for it. Preview builds disable ads even if they inherit production variables.

Ad-enabled deployments keep the existing Cloudflare worker with per-response nonce CSP. The browser-test failure was repaired in the test harness; production script CSP was not weakened to allow unsafe-eval. Without an ad client, there is no advertising script/worker. Ownership verification alone is not a request to turn ads on.

## Tests and later experiments

`tests/deployment.test.mjs` covers disabled, verification-only, enabled, preview and clean rebuild modes. `tests/seo-browser.py` intercepts synthetic advertising requests before navigation; no test publisher reaches Google. It checks distinct ad labels, exclusions from the editor, node preservation during locale changes and 320/390px layouts. The optional workerd suite tests actual worker response nonces.

Establish a baseline for successful runs/downloads, layout shift, interaction latency and returning visits before changing placement. Change one position at a time, compare RPM and completed useful sessions, and roll back meaningful UX regressions. More ads alone do not establish higher revenue. Do not click your own ads or manufacture ad traffic. Live ad delivery, account review and region-specific CMP behavior require separate operational verification.
