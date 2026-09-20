# Nerulio validation

The historical expansion record below describes the earlier restricted environment. The current HTTP regression is recorded separately at the end of this document; counts are assertions, not features.

# FileForge expansion validation · 2026-09-20

## Recorded local execution

Source baseline: `200d232540c27a037806cdc9007a0501224e22fe`; validation-only remote successor: `7cc2b45d607d3bd1ba7dd5d1240e49d9eae41625`. Node.js 22.16.0, Python Playwright and system Chromium were available in the editing sandbox. Direct HTTP was blocked by that sandbox; the local browser tests therefore used the explicitly labeled in-memory harness. GitHub publication/HTTP validation must be reported separately from these results.

| Suite | Passed | What the number means |
| --- | ---: | --- |
| `tests/core.test.mjs` | 80 | Existing routes, limits, pixel/ZIP/GIF/pure functions and related cases; route registration increases parameterized coverage |
| `tests/deployment.test.mjs` | 8 | Existing build, static deployment, headers and advertising configuration tests |
| `tests/i18n.test.mjs` | 785 | Translation completeness, route generation, localized HTML/content/metadata and related consistency checks, not 785 image algorithms |
| `tests/primitives.test.mjs` | 19 | New bounds, components, layout, alignment, channel/normal/extrusion values, ZIP paths, FNT metadata, ICO structure and straight-alpha PNG decoding |
| **Node total** | **892** | All above, zero failed/skipped |
| Existing `tests/browser.py --in-memory` | 71 | Existing intent/editor/locale/history behavior and real image/GIF outputs; assertions preserved after extracting the harness |
| New `tests/recipes-browser.py --in-memory` | 43 | Actual recipe files independently reopened plus targeted UI/state/mobile assertions |

`npm run check` passed. `npm run build` generated 208 static entry HTML files. No original test file or original assertion was deleted; the shared browser setup moved to `tests/browser_harness.py`.

## Independent output checks

Pillow reopens generated PNG/JPG and all three ICO sizes; Python `zipfile` opens game/marketplace/print/frame/font/atlas/icon archives. Tests verify actual pixel dimensions, transparency, bounded palettes, ordered frame pixels, JSON coordinates, dated-preset folder paths, all five print ratios, enclosed-white preservation, Unicode FNT records and real manifest icon sizes. A packed-mask test verifies RGB values even with alpha exactly zero. Node zlib/CRC checks independently decode the custom straight-alpha PNG writer. A filename extension alone never counts as an output test.

The 43 checks include six mobile output/share checks and three viewport-overflow checks, search/favorites, state and error checks; they are not 43 separate tools. Screenshots include home desktop, Japanese refiner, sprite slicer, marketplace, ko/en/ja 390-pixel layouts and 1200×630 share cards. `test-results/` is generated/ignored rather than committing users' outputs.

## Reproduction

```sh
npm run check
npm test
npm run build
python -m pip install playwright Pillow
python -m playwright install chromium
# Terminal 1:
node tools/serve.mjs --dist
# Terminal 2 (existing subpath checks):
PORT=4174 BASE_PATH=/my-first-repo node tools/serve.mjs --dist
# Terminal 3:
python tests/browser.py
python tests/recipes-browser.py
```

Use `CHROMIUM_PATH=/usr/bin/chromium` only when testing a system Chromium installation. In an environment that explicitly blocks local HTTP, append `--in-memory` to each Python command. That mode rewrites module URLs/history/storage only for the harness; it is not production code and is not an HTTP/CSP test.

## Not established by local tests

The in-memory sandbox cannot establish real HTTP/CSP module-worker behavior, persistent browser storage, public hosting deployment, Google indexing/AdSense approval, OS-native Web Share, Safari/Firefox support or physical low-end/mobile performance. Its module-worker policy invokes the bounded compatibility path for small new recipes. No arbitrary-device speed or peak-memory claim is made.

The optional external PDF engine, HEIC decoder, MP3 encoder and AI portrait model were not re-executed end-to-end in this local expansion test. Existing PDF/media source and tests are retained; that is not equivalent to a new external-engine compatibility certification. No test or implementation claim is made for the explicitly unshipped PDF/media/collision/deskew/seamless work in TOOLS.md.


## Nerulio Growth HTTP validation · 2026-09-21

The current Windows environment supports real localhost HTTP and CSP. The inherited GitHub failure was a `wait_for_function` string-evaluation wait rejected by CSP. The harness now waits for the workspace's idle locator; the application's CSP is unchanged.

The complete local `python tools/regression.py` run passed syntax, 925 Node assertions (zero failed/skipped), a 236-entry build and the following real Chromium HTTP suites:

| Suite | Passed |
| --- | ---: |
| Existing editor/locale/history/image/GIF browser tests | 62 |
| Recipe outputs independently decoded with Pillow/zipfile/JSON | 43 |
| Growth presets, image handoff, sharing, event privacy, 404, no-JS HTML and Worker cancellation | 24 |
| Disabled / production / mocked-ad / preview SEO and 320/390px layouts | 402 |

Additional checks: 13 workerd/Wrangler 4.135.0 assertions passed against the synthetic ad-enabled fixture. A separate real-CDN PDF probe merged a generated one-page PDF, handed the result to the split tool without another upload, retained its one-page count and downloaded a file with the PDF signature. This is one PDF flow, not exhaustive PDF-engine certification.

The 320px header overflow found during the intermediate run was fixed. Earlier failing attempts are not counted as successful regression runs. A final review also tightened batch-run/share-outcome instrumentation and Japanese privacy copy; publication requires the same full regression in GitHub Actions on the exact proposed revision, including these final changes. Check the [validation workflow](https://github.com/2009seungbin-stack/my-first-repo/actions/workflows/ci.yml) for its settled-tree result. The workflow retains source, built site, reports, logs and screenshots.

Local versions: Node 24.15.0, Playwright 1.63.0, Pillow 12.3.0. CI uses Node 22 and pinned Python test requirements. The local totals and exact-revision CI results should not be confused with each other or with production deployment checks.

Reproduce with `python -m pip install -r requirements-test.txt`, `python -m playwright install chromium`, ffmpeg on PATH, then `python tools/regression.py`. Ports 4173/4174 must be free; the runner starts and stops only its own servers. Browser suites use actual security headers and explicit output decoding, not only mocked DOM success messages.

Not certified: physical phones, Safari/Firefox, low-memory devices, Core Web Vitals, native OS sharing, live Google ads/CMP behavior, Google/Bing indexing, HEIC/MP3/portrait-model compatibility, or every PDF feature. Ads tests intercept synthetic Google requests; no live advertising is exercised. Analytics has no installed network adapter. An absent service integration is not a successful integration test.
