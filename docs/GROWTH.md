# Nerulio growth architecture

The shipped loop is search → a focused intent → local processing → a download → up to three related tools or a shared preset/result card. Home continues to show four featured entries and Search, rather than the full catalog. `src/brand.js` owns the public name; legacy storage keys and repository/hosting names stay stable.

## Intent and content rules

`src/intents.js` owns stable intent IDs, canonical paths, input types and relevant next steps. `src/tool-registry.js` adds the sixteen bounded recipes. A new canonical intent requires a real workflow, reviewed output, localized purpose/limits, a relevant next step and tests. Parameter variants belong in shared query settings, never new sitemap entries. Alias URLs consolidate to the corresponding canonical intent; they are not additional indexed tools. Unimplemented PDF booklet, collision and other roadmap ideas have no placeholder landing pages.

Below each workspace, `src/content.js` supplies specific instructions, formats, limits and FAQs in Korean, English and Japanese. `src/examples.js` renders ordinary dimensioned, lazy HTML images. `tools/generate-examples.py` uses the actual processing engines and original geometric fixtures; ZIP examples are explicitly previews. Do not fabricate before/after quality or imply recovered detail. Regenerate assets after changing the brand or example-producing algorithms.

## Share and related-tool loop

The navigation's preset-share control copies a localized URL. The recipe codec in `src/presets.js` permits bounded numeric, boolean, enum and color settings; it excludes filenames, file bytes, user-authored font characters and arbitrary fields. Basic image/pixel controls have corresponding allowlisted parsing in `intentDefaults`. Presets do not recreate user files or manual sprite boxes.

Result actions offer a browser-generated 1200×630 share card, using native file sharing when available and a PNG download otherwise, plus Copy tool link. Only the card carries the brand. Actual image/PDF/ZIP results are untouched. Social metadata describes the public tool, not a privately selected image: no server upload is performed to create link previews.

Related links are crawlable anchors. Clicking normally reuses an image result in memory; a PDF result is loaded into a replacement PDF workspace before changing tools. ZIP preview thumbnails are never passed off as their full archive. Media and ZIP workflows can require new input; do not promise universal state transfer. Reloading or opening a new tab cannot retain in-memory files.

## Analytics contract

`src/analytics.js` has no vendor, cookies, persistent identity, network endpoint or background queue. It is disabled until an operator installs a consent-appropriate adapter with `setAnalyticsAdapter(fn)`. `null` disables it. Adapter failures cannot break the editor. Do not add raw GA event forwarding around this boundary.

Events: `page_view`, `tool_open`, `file_selected`, `tool_run`, `tool_success`, `tool_error`, `download`, `related_tool_click`, `share_result`, `share_preset`, `language_change`.

Allowed dimensions: intent, landing intent, target intent, language, mobile/desktop class, direct/internal/google/bing/referral category, coarse file kind and bounded count, fixed error code and share method. Full referrer URLs/queries, arbitrary error text, filenames, file contents and glyph text are not forwarded. File size and image/PDF contents are not event properties. The initial `page_view` is emitted during app setup; install an adapter before initialization or intentionally record the first view once from the integration. No events are buffered pending consent.

Focused and generic editor processing actions emit run/success/failure. A download counts when the browser download is initiated, not proof that the user saved it. Native-share cancellation is not success. File selection is counted after successful loading. Session IDs and sessionization are intentionally left to a future consent-aware integration; pages/session cannot yet be read from a built-in dashboard.

| Dashboard metric | Definition |
| --- | --- |
| Page views / tool opens | Respective event count, grouped by stable intent and language |
| Run completion | `tool_success / tool_run`; retain cancelled/error breakdown |
| Download rate | Sessions or runs with download / successful runs, using a documented deduplication model |
| Related tool CTR | `related_tool_click / tool_success` as an initial approximation; add impression measurement if experimenting |
| Share rate | Result/preset shares / successful runs, separating method and cancellations |
| Pages/session | Future adapter sessionization, with consistent consent and retention |
| Search and revenue | Join canonical intent/locale to Search Console and AdSense exports; not fabricated in the app |

## Search-led iteration

1. Submit the canonical sitemap through Search Console; wait for actual coverage/performance data.
2. Compare the same date window and device/language segment. High impressions with low CTR suggest reviewing truthful titles/descriptions against the query intent.
3. Queries with impressions and positions roughly 8–30 are candidates for better examples, clearer limitations and stronger functions. Position alone does not prove the required change.
4. Search demand with no supported workflow becomes a registry proposal; build and validate the function before publishing its landing page.
5. Join downloads, related-tool clicks and share events to search landing intent. Optimize successful useful sessions, not manufactured page transitions.

## Experiments after baseline data exists

- Compare two accurate titles on a high-impression intent, one change at a time.
- Compare two genuinely related next steps; cap visible choices at three.
- Compare preset sharing versus result-card discovery after a successful download.
- Measure ad RPM alongside completed downloads, interaction latency, layout shift and return visits. Do not maximize slots without a UX baseline.

The editor/result containers carry `data-ad-exclude`; see [ADS.md](ADS.md). This attribute is an operator targeting hook, not an automatic Google exclusion policy. There is no default Auto Ads experiment.

## Performance scope

No runtime package, framework or analytics vendor was added. Heavy pre-existing PDF/HEIC/AI dependencies retain their on-demand loading. Examples are below-fold lazy images; social metadata does not cause the page to download all social cards. The 48 example PNGs total 36,357 bytes; 114 social PNGs total 3,986,745 bytes stored for individual social-crawler requests. Sum of separately gzipped source JS grew from 86,637 to approximately 125,400 bytes with both the 16-tool expansion and Growth update. This is a source-size comparison, not measured initial transfer, Core Web Vitals or a zero-regression speed claim. Test real device LCP/CLS/INP and cold caches before revenue experiments.
