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

No units are placed in the drop zone, controls, toolbar, file strip, previews, modals, or beside Download on tool pages. The Studio has its own separate desktop column (below); a mobile anchor remains a future measured experiment, not an activated placement. Auto Ads exclusions must also be configured and inspected in Google's interface; a custom HTML attribute alone does not enforce them.

## Configuration

Use issued production IDs only: `ADSENSE_CLIENT`, `ADSENSE_SLOT_CONTENT_1`, `ADSENSE_SLOT_CONTENT_2`, and `ADSENSE_SLOT_STUDIO` for the Studio column (below). The build validates formats. Enable slots only after configuring and checking the applicable Google-certified consent setup, then set `ADSENSE_CMP_READY=true`. No fake consent checkbox substitutes for it. Preview builds disable ads even if they inherit production variables.

Ad-enabled deployments keep the existing Cloudflare worker with per-response nonce CSP. The browser-test failure was repaired in the test harness; production script CSP was not weakened to allow unsafe-eval. Without an ad client, there is no advertising script/worker. Ownership verification alone is not a request to turn ads on.

## Tests and later experiments

`tests/deployment.test.mjs` covers disabled, verification-only, enabled, preview and clean rebuild modes. `tests/seo-browser.py` intercepts synthetic advertising requests before navigation; no test publisher reaches Google. It checks distinct ad labels, exclusions from the editor, node preservation during locale changes and 320/390px layouts. The optional workerd suite tests actual worker response nonces.

Establish a baseline for successful runs/downloads, layout shift, interaction latency and returning visits before changing placement. Change one position at a time, compare RPM and completed useful sessions, and roll back meaningful UX regressions. More ads alone do not establish higher revenue. Do not click your own ads or manufacture ad traffic. Live ad delivery, account review and region-specific CMP behavior require separate operational verification.

## Studio ad column (`/game/studio/`, desktop only)

The Studio follows the Photopea model: the free editor shows **one fixed, clearly labelled ad column** on large desktop screens, separated from every tool; Pro removes it and the canvas takes the space. There are no ads in the Studio on phones, tablets or small windows. Content pages keep their own in-content units (`content-1`/`content-2`, laid out by the content-page templates).

### Research (2026-09-24, screenshots in the handoff folder `scratch/monetization/`)

| Product | Editor ad | What paying removes / free limits |
| --- | --- | --- |
| Photopea (measured in Chromium) | A right-hand column outside the panels: 180 px wide with one 160×600 unit at 1024–1440 px; 320 px wide with a stack of four 300×250 units at 1920 px; ~19 px between the panels and the unit; a 320×50 anchor at the bottom on phones. No "Advertisement" label. | Premium ($5/month, $50/year): no ads (the editor becomes full width), 60 instead of 30 history steps, AI tools and storage. No usage limits on free. |
| Pixlr | Ads in the free editors | Free: 3 saves per day plus a small AI credit allowance; Plus/Premium remove ads and the save cap. The save cap is widely criticised (browser extensions exist only to bypass it). |
| Kapwing | — | Free: watermark, 720p, 1-minute exports, 30 min export time per month. |
| remove.bg | — | Free: preview-size results (0.25 MP); full resolution costs credits. |
| Canva | — | Free: capped AI uses per month (≈200 standard / 20 premium). |
| Figma | — | Starter: 3 design files in a team (drafts unlimited). |
| TexturePacker (closest competitor) | — | Free "Essential" mode: advanced features turn sprites red / watermark the output. |

Nerulio keeps its rule of never degrading Free output (no watermark, no resolution cap, no slow mode), so the Studio's levers are the ad column and a daily count of *engine export bundles* only ([PRICING-MODEL.md](PRICING-MODEL.md)).

### Policy basis (Google AdSense / Publisher Policies) and the conservative choices

| Policy text (source) | What the Studio does |
| --- | --- |
| "Be careful when placing links, play buttons, download buttons, navigation buttons … drop-down menus, or applications near ads because they might lead to accidental clicks." — Ad placement policies, support.google.com/adsense/answer/1346295 | The unit lives in its own grid column to the right of the panels, behind a border, with 20 px of clear space on each side (more than Photopea's ~19 px). Tests measure every interactive element: ≥ 20 px from the unit; export/save/open/download controls ≥ 24 px (≥ 31 px in practice). The only link in the column ("Remove ads — Nerulio Pro") sits at the column's bottom, far below the unit. |
| "Publishers are not permitted to place Google ads in any window that is not initiated by an intentional user interaction"; no ads in pop-ups — same page, and AdSense Program policies, support.google.com/adsense/answer/48182 | Never in dialogs, menus, sheets or toasts. Dialog backdrops and the file-drop overlay stop at the column; a menu opened near the right edge is moved left of it. |
| "Publishers are not permitted to refresh a page or an element of a page without the user requesting a refresh." — answer/1346295 | One `push()` per page, no timers, no re-request on workspace or language changes or resizes (tested: filled exactly once). |
| Not allowed: "Hiding ad units at anytime (e.g., display:none), unless you're implementing a responsive ad unit"; not allowed: code "that covers content or where content covers ads". — Modifying ad code, support.google.com/adsense/answer/1354736 | The unit uses Google's fixed-size code (explicit `width`/`height`, no `data-ad-format`). The column is hidden only by a viewport media query (Google's documented responsive pattern, support.google.com/adsense/answer/9183363); nothing overlays it. Unfilled units are hidden with Google's documented `ins.adsbygoogle[data-ad-status="unfilled"]` selector while the reserved box keeps its size. |
| No Google-served ads on screens "without publisher-content or with low-value content", "under construction", or "used for alerts, navigation or other behavioral purposes". — Publisher Policies, support.google.com/publisherpolicies/answer/11112688 | **Ambiguous for an editor.** The Studio is the product (the user's own work on the canvas plus our tools), not an exit/thank-you/error screen, and Photopea runs the same model with Google demand. Conservative choices: the ad is only a side column, never the main content; **no ad on the loading screen, on phones/tablets or in any dialog**; the owner must exclude `/game/studio/` from **Auto ads** in the AdSense UI so Google never injects extra units into the app. If Google's review objects to ads in the app, leave `ADSENSE_SLOT_STUDIO` empty: the Studio is ad-free again without a code change. |
| Labels: "Advertisements" / "Sponsored Links" are allowed; misleading labels are not. — answer/48182 | Label "Advertisement" (ko 광고, ja 広告), switching with the Studio language. The house line shown when the unit is blocked or unfilled never asks anyone to click an ad. |
| A Google-certified CMP is required for EEA/UK/CH traffic | Same gate as the content slots: the build refuses `ADSENSE_SLOT_STUDIO` without `ADSENSE_CMP_READY=true`. |

### Behaviour

* **Configuration**: `ADSENSE_CLIENT` + `ADSENSE_SLOT_STUDIO` (a 10-digit display ad unit ID; create one "Display ads" unit for the Studio in AdSense) + `ADSENSE_CMP_READY=true`. Validated like the content slots; previews never get it. The Studio unit is **not** one of `slots` (content pages never mount it; the Studio never mounts content units).
* **HTML**: the Studio head carries only `<meta name="nerulio-studio-ad">` (client + slot), the account-service meta when `SERVICE_API=on`, `src/studio/monetize/monetize.css` (render-blocking) and `boot.js`. **Never a Google tag.** Builds without either meta load none of this (only the 2 tiny modules the workspaces import: `meter.js`, `strings.js`).
* **Decision before the editor exists** (`src/studio/monetize/index.js`): with accounts on, `boot.js` starts the single `GET /me` while the editor's modules download; `main.js` waits for it at most 1.5 s, then builds the editor with or without the column in the same frame. Free (server says `ads:true`) or a build without accounts → column; **Pro, an unreachable service, or no answer within 1.5 s → no Google request, no ad DOM, full-width canvas** for the whole page life. The decision never flips later, so there is no late layout shift.
* **Size**: viewport ≥ 1280×700 CSS px only. 160×600 below 1600 px wide (column 200 px), 300×600 from 1600 px (column 340 px). Chosen once at mount. A window that starts smaller gets the column the first time it is made large enough (a user-initiated resize); making it smaller again hides the column via the media query and the canvas takes the space.
* **Blocked / failed / unfilled**: the column keeps its size and shows one quiet line ("Ads keep Nerulio Studio free. Your files never leave your device."). The editor never waits on the ad and works fully (tested: import → pack → export with the script aborted).
* **Auto ads**: keep `/game/studio/*` excluded in AdSense → Ads → Auto ads → URL exclusions (a `data-ad-exclude` attribute alone does not enforce it).
* **Measure before changing**: compare exports per session, session length and returning Studio users with and without the column (e.g. one week on preview traffic) before adding anything; a second unit or a wider unit is a new experiment, not a default.

Tests: `tests/studio-monetization.test.mjs` (config validation, decision matrix, geometry, strings), `tests/studio-monetization-browser.py` (no ad DOM/requests with ads off; labelled column at 1280/1440/1920, none at 390/768/1024/1440×650; clearance of every interactive control across Viewer, Pack & Export, Tile, Texture; menus/backdrops; CLS 0 and a canvas box that never changes while the ad loads, fails or is unfilled; no refresh; a blocked script keeps the editor working), `tests/service-browser.py` `scenario_studio` (Free vs Pro on the real Pages runtime: Pro makes zero Google requests and gets a canvas exactly 200 px wider; an unreachable API shows no ad).
