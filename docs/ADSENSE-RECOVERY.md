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

## Deployed static atlas intent

PR **#86** merged as **`80a46f39b3634c989747705d26575ed35d5604a7`**: https://github.com/2009seungbin-stack/my-first-repo/pull/86 . Its frozen head `113e02769aeff1bf73448fb53898ab09acaedbf8` passed full validation run `43488426309` (29m27s) and both Cloudflare previews. Live `/build.txt` matched the merge commit. Commit `60b9e9ff310124f43ee9721ce1c2ccd9cfdfe505` contains the core fix; later copy/guard refinements are included. No new article was published by this PR.

- Explicitly static frames stay in the atlas, with no fabricated Phaser animation JSON. Unlabelled loose assets retain the fallback; manually added tags still work. Mixed assets exclude static choices from implicit animations.
- This tool's Godot SpriteFrames exporter needs a tag: its action is disabled with a translated explanation for a wholly static project. Explicit GIF/APNG/WebM output still requests a sequence.
- The implicit-animation note now correctly says existing frame durations are preserved and the displayed fps is a fallback.
- Checks: 31 Node pack/export tests; public game-landing Part 2 **59 checks across Chromium and Firefox**; full Studio Pack browser **61 checks**, including all formats, source pixels, 1,000 frames, ko/ja copy and 390px layout. String parity passed after copy changes.
- Verify actual production None→static export separately from the matching build identifier. Do not equate a successful deployment with Google approval.

## Current branch: ordered grid edits and the second original case study

Working branch **`codex/sprite-grid-edits`** now includes merged main. Core source/test/reproduction commit **`bb1b9e08233d87e76d48ae6e32a1f8d69e161cc9`** is the measurement reference. This branch is not yet verified in production. **Do not publish the old raw results.**

- Input: committed CC0 `tests/fixtures/kenney/tiny-dungeon-tilemap.png` (203×186, 16px cells, 1px gaps, 12×11).
- Both correct and wrong grids can show 132 frames. Correct 1px gaps match all 132 intended tile crops. A confirmed two-axis 0px grid matches only 1 intended tile; x/y of its final cell are 176/160 instead of 187/170.
- Earlier Chromium data reported 12 matches because only the vertical gap became 0; horizontal gap silently reverted to 1. This was corrected in the user update. Those results are superseded input-condition evidence, not a valid both-axis comparison.
- Preserve private evidence under `test-results/sprite-grid-unsettled-input/`, `sprite-grid-before-animation-fix/`, `sprite-grid-case/`. None of those should be published. The candidate public sprite-grid assets were moved into test-results after verifying both absolute paths stayed inside this checkout.
- Root cause: grid input callbacks captured an entire old grid; `changeChoice` captured the next import choice before awaiting worker cell analysis. Rapid X/Y edits overwrote each other and Apply could overtake them. The fix sends sparse field patches, resolves them against the latest choice and serializes each asset's edits/Apply. Drag edits preserve unrelated spacing. Enter→blur does not add a duplicate history step; failed work does not poison the queue.
- Controlled-worker regression failed on the previous source and passes with the fix. Nineteen Node grid/sprite checks passed; game-landing Part 2 passed **65 checks / 33 distinct assertions across Chromium and Firefox**, including delayed analysis, rapid edits before/after Apply, every source rectangle, undo/redo and static atlas intent. The owned source preview on port 4181 may still be running; inspect ownership before stopping it.
- Tracked `tools/editorial/measure-sprite-grid.py` verifies the actual applied grid before each export. Its default output is test-results and it refuses overwriting an existing public evidence directory. Reproductions after commit bb1 record `sourceModifiedAfterCommit: false`.
- Fresh valid evidence is under **`assets/editorial/2026-11-14-sprite-grid/{chromium,firefox}/`**: exact CC0 input, four downloaded exports, UI captures, per-frame results and nearest-neighbour last-tile comparison. Both engines: gap 1→132 reference-coordinate/pixel matches; both gaps 0→1 match; all four exports preserve all 132 selected crops. Both have zero animation tags/files and a disabled Godot SpriteFrames action requiring a tag. Pillow comparisons ignore RGB only where alpha is zero.
- All four ZIPs were checked for unsafe paths, unexpected file types and known credential/authentication/private-key patterns; findings were empty. Hashes/member paths are in `audit.json`. This is not a general security certification.
- New Korean/English original commentary: `/ko/ai/digest/sprite-grid-spacing/` and English equivalent. Includes data, source commit, reproduction script, limitations, source/license links and downloads. Godot region-size/margins/separation mapping applies to the original sheet, not its rearranged packed atlas. No native Phaser/Godot execution or separate human review is claimed.
- Local public-site browser QA passed both articles in both languages at 1440px and 390px, including decoded figures, tables, ZIP links, home visibility, no community UI/API calls and closure. Mobile English table wrapping exposed split words: Markdown tables now keep words intact inside their existing horizontal scroll container; CSS cache version bumped. Eighteen digest/Markdown/public Node tests passed, including platform build and draft isolation. Typecheck and syntax checks passed before the final copy/CSS changes; full remote CI remains required.
- Next: commit the case-study assets/content, open a PR against main, wait for checks, merge with the exact tested head, then verify production grid edits, both home articles, all evidence hashes and public-reader flows. Do not mark this goal complete before its deadline and remaining required work.

## Further work after these fixes

Audit thin/duplicate publicly indexable reference directories against actual usefulness, check collector freshness/failures, and verify broken routes/mobile/accessibility using concrete evidence. Keep useful tool functions; do not noindex a tool solely because its UI is short. Existing six AI-news draft files remain private. Skip weak articles rather than filling a quota.

At the deadline, report verified code/content/deployments and remaining limitations, then stop this heartbeat. Keep technical deployment, Google indexing and AdSense review/approval separate.
