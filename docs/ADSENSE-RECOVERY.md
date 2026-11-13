# AdSense content recovery — bounded autonomous work

Owner request: repeated rejection for “가치가 별로 없는 콘텐츠”; close community; make news/commentary visible on home; work alone until **2026-11-15 10:00 Asia/Seoul (2026-11-15 01:00 UTC)**. Google approval itself is not claimed.

Heartbeat: `nerulio-11-15-10`, current chat, every 30 minutes until that deadline. Preserve the deadline and avoid duplicate automations. Keep the active goal intact.

## Authorization and boundaries

Implementation, local checks, PR, merge, deployment and production verification are authorized. Preserve unrelated work and stored community data. Do not submit AdSense review, change account/billing settings, delete stored posts/uploads, send external promotion or messages, or invent people, human review, experiences, measurements or licenses. No agents: the owner asked to work alone. AI assistance must be disclosed honestly.

Quality reference: https://support.google.com/adsense/answer/7299563?hl=ko . Prefer original reproducible material useful to actual tool users; do not flood the archive with generic summaries or assume a page count guarantees approval.

## Verified production — first batch complete

- PR #84 merged as `f71c92e319f9528d7913b2e852c4b4c816c286d9`; PR #85 merged as **`baf564b6e9129ebf62834afa6834db7e6628138b`**. Live `/build.txt` matched the latter on 2026-11-14 KST.
- PR validation runs `43480704459` (#84, 29m24s) and `43480888577` (#85, 29m03s) passed all stages. OAuth regression and Cloudflare previews passed. Main push validation may still be running; inspect its current state before making claims.
- Korean and English home: **6 official release/source news items + 1 published original commentary article per language**. Commentary appears after the intro, before news and the tool directory. About/contact/corrections links are reachable.
- Original case study: `/ko/ai/digest/small-transparent-png/` and English equivalent. Twelve actual encoder runs; downloadable CC0 logo/Kenney inputs and outputs, settings, hashes, limitations, reproduction script. All 12 deployed output hashes matched the evidence. Both article figures and the four responsive home example images decoded in the real production browser.
- Community pages, images and public v2 writes/reads remain HTTP 410 before auth/DB access. Owner admin and aggregate hit beacon remain; records are preserved. No community requests from the public browser pages except the allowed beacon.
- Automated news is explicitly collected metadata, links to official originals, and stays noindex/outside the sitemap. It now reads the existing radar release records rather than an empty discussion-only feed. Future/stale/unverified/unsafe URLs are filtered. Retained community counts no longer qualify references for indexing.
- Compression target warning is deployed in ko/en/ja: a retained 5,339-byte original at a 1KiB target reports the miss; 10KiB clears it; exact original download bytes preserved.
- Production evidence: `test-results/adsense-production-release.json`, `test-results/adsense-production-browser/results.json`, `.../home-image-results.json` and screenshots. Desktop 1440px and mobile-size 390px tested; this is browser viewport QA, not physical-device or human continuous review. Ad requests were blocked during tool QA; ad delivery/AdSense approval were not tested.
- Sitemap baseline audit: 26 URLs all HTTP 200, no noindex or community links (`test-results/adsense-sitemap-before.json`); published digest adds index/article URLs. Python/browser-emulation clients sometimes saw challenges while normal HTTP/browser worked. This does not prove verified Google crawlers are blocked; do not disable security on that assumption.

## Current unpublished branch — static atlas intent

Working branch: **`codex/static-atlas-intent`**, based on merged production main. Commit `60b9e9ff310124f43ee9721ce1c2ccd9cfdfe505` fixes explicit Animations/Grouping → None being turned into an implicit engine animation during atlas export. Later copy/guard refinements are included on this branch. No new article is published by this branch yet.

- Explicitly static frames stay in the atlas, with no fabricated Phaser animation JSON. Unlabelled loose assets retain the fallback; manually added tags still work. Mixed assets exclude static choices from implicit animations.
- This tool's Godot SpriteFrames exporter needs a tag: its action is disabled with a translated explanation for a wholly static project. Explicit GIF/APNG/WebM output still requests a sequence.
- The implicit-animation note now correctly says existing frame durations are preserved and the displayed fps is a fallback.
- Checks: 31 Node pack/export tests; public game-landing Part 2 **59 checks across Chromium and Firefox**; full Studio Pack browser **61 checks**, including all formats, source pixels, 1,000 frames, ko/ja copy and 390px layout. String parity passed after copy changes.
- Publish this source fix as a focused PR, wait for CI, merge, verify exact production build and actual None→static export. Do not include unfinished measurement assets in that PR.

## Open: rapid custom-grid edits can be lost

A second original case study is in preparation. **Do not publish its old raw results.**

- Input: committed CC0 `tests/fixtures/kenney/tiny-dungeon-tilemap.png` (203×186, 16px cells, 1px gaps, 12×11).
- Both correct and wrong grids can show 132 frames. Correct 1px gaps match all 132 intended tile crops. A confirmed two-axis 0px grid matches only 1 intended tile; x/y of its final cell are 176/160 instead of 187/170.
- Earlier Chromium data reported 12 matches because only the vertical gap became 0; horizontal gap silently reverted to 1. This was corrected in the user update. Those results are superseded input-condition evidence, not a valid both-axis comparison.
- Preserve private evidence under `test-results/sprite-grid-unsettled-input/`, `sprite-grid-before-animation-fix/`, `sprite-grid-case/`. None of those should be published. The candidate public sprite-grid assets were moved into test-results after verifying both absolute paths stayed inside this checkout.
- Root cause located: `src/studio/sprite/panels-ui.js` custom grid input callbacks capture an entire old grid (`{...g,[k]:v}`). `src/studio/sprite/importers.js::changeChoice` captures `next`, awaits cell measurement, then commits. Fast edits to X/Y overwrite each other. Firefox happened to settle both; Chromium exposed the race.
- Next fix: preserve ordered choice transitions and merge sparse grid edits against the latest state. Also handle Apply pressed while edits are pending, without deadlocking internal re-application. Inspect callers/undo behavior first; do not merely add sleeps to hide the production race. Drag edits should preserve unrelated spacing fields.
- Add browser coverage for rapid X/Y edits before and after Apply using the authoritative applied `asset.grid`, preview residuals and final frame coordinates. Preserve the existing static atlas regression.
- **Untracked** `tools/editorial/measure-sprite-grid.py` is a candidate reproduction tool. It now asserts the exact applied grid before exporting, so it should fail rather than silently publish the wrong condition. Keep it untracked until the race and complete measurement are verified. Its default output is test-results and it refuses overwriting an existing public evidence directory.
- Once fixed, regenerate both browsers into a fresh dated asset directory, verify every downloaded frame against independent Pillow crops (RGB ignored only under alpha=0), audit generated ZIPs for credentials, inspect figures, then write Korean/English commentary. Distinguish PNG/JSON reconstruction from actual engine execution. Godot TileSetAtlasSource docs were consulted for region size/margins/separation; no native Godot run has been claimed.

## Further work after these fixes

Audit thin/duplicate publicly indexable reference directories against actual usefulness, check collector freshness/failures, and verify broken routes/mobile/accessibility using concrete evidence. Keep useful tool functions; do not noindex a tool solely because its UI is short. Existing six AI-news draft files remain private. Skip weak articles rather than filling a quota.

At the deadline, report verified code/content/deployments and remaining limitations, then stop this heartbeat. Keep technical deployment, Google indexing and AdSense review/approval separate.
