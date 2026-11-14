---
title: "Where translucent PNG RGB changes: two browsers, sixteen diagnostic cases"
date: 2026-11-14
summary: "Alpha stayed unchanged while RGB did not. We compare actual canvas readback, PNG and lossless WebP output with authored inputs, with raw RGBA buffers, observer controls and an offline evidence package."
status: published
sources:
  - title: "Measurements: inputs, readback, exports and all file hashes"
    url: "https://nerulio.com/assets/editorial/2026-11-14-alpha-roundtrip/measurements.json"
  - title: "Frozen protocol calling the actual decode and blobOf functions"
    url: "https://github.com/2009seungbin-stack/my-first-repo/blob/83ca3ce879e7e5f9520c8f74bd6cca1afb610a0b/tools/editorial/measure-alpha-roundtrip.py"
  - title: "WHATWG HTML: premultiplied alpha and the 2D rendering context"
    url: "https://html.spec.whatwg.org/multipage/canvas.html"
  - title: "Google: the lossless VP8L format in a WebP container"
    url: "https://developers.google.com/speed/webp/docs/riff_container"
---
## Matching alpha did not mean matching RGB

After an authored translucent PNG went through Nerulio's actual image-processing code, 2,679 of the 3,072 pixels in its alpha-64 band had different RGB in the Chromium PNG. The Firefox PNG changed RGB in 2,882 pixels. Alpha stayed unchanged; the largest individual RGB-channel differences were 2 and 4, respectively. Those numbers are differences on a 0–255 scale, not percentages of visible quality lost.

PNG and lossless VP8L WebP outputs recovered the same RGBA in these cases. They did not, however, recover every original translucent RGB sample. When original data must remain exact, a lossless output codec and a pixel-preserving end-to-end workflow are separate things to check.

An AI agent operated the browsers, compared the samples and wrote this analysis. There was no human perceptual evaluation or game-engine trial. The saved files and calculations are available below.

## What the sixteen cases contain

The inputs are an [opaque pattern](/assets/editorial/2026-11-14-alpha-roundtrip/opaque-chart.png) and an [alpha-band pattern](/assets/editorial/2026-11-14-alpha-roundtrip/alpha-chart.png). Both are original CC0 test materials: 128×96 RGBA8 PNGs. Four vertical bands use alpha 0, 64, 128 and 255: 0 is fully transparent, 255 is fully opaque, and 64/128 lie between them. Each band contains 32×96, or 3,072, pixels. The separate opaque input uses the same RGB pattern with alpha 255 throughout.

The capture ran on November 14, 2026, using live source `522f177ee86ada4c3d548f915ef36a5124c6f8b3`, Chromium 153.0.8010.12 and Firefox 155.0. Four relevant served source files matched that commit, and the deployed source was checked before and after each browser. There was no resizing or background compositing.

| Diagnostic | Operation on a fresh canvas | Cases |
| --- | --- | ---: |
| Readback | Actual `Im.decode`, then RGBA from `getImageData` | 4 |
| PNG control | Actual `Im.blobOf` PNG export without that readback | 4 |
| Readback then PNG | Read RGBA, then export PNG to check observer effects | 4 |
| WebP | Export WebP at quality 1.0 without readback | 4 |

Two inputs, two browsers and four diagnostics produce sixteen combinations. **This is not sixteen new native UI download clicks.** These are direct calls to the functions used by the actual page; Pillow independently decoded the resulting files. Eight earlier native PNG/WebP100 downloads from the [conversion-guide study](/en/image/convert/) are included with a `native-` prefix and identified as a separate acquisition.

## Input samples versus exported samples

This table compares the alpha-band input with its PNG exports. The WebP100 exports decode to identical RGBA in this test, and their VP8L image data was checked. A changed pixel is counted once if any RGB channel differs.

| Browser | Input alpha | Pixels compared | Pixels with changed RGB | Largest channel difference |
| --- | ---: | ---: | ---: | ---: |
| Chromium | 64 | 3,072 | 2,679 | 2 |
| Chromium | 128 | 3,072 | 2,295 | 1 |
| Firefox | 64 | 3,072 | 2,882 | 4 |
| Firefox | 128 | 3,072 | 2,691 | 2 |

No alpha values changed. Neither the alpha-255 band nor the separate 12,288-pixel opaque control changed RGB. For one concrete example, with the top-left pixel numbered `(0, 0)`, the Firefox PNG changes `(32, 0)` from `(32, 160, 0, 64)` to `(36, 163, 0, 64)`. This is a numerical channel difference, not a perceptual colour-distance or quality score.

In the fully transparent band, 3,071 of 3,072 hidden RGB values changed. That data is invisible by itself, so it is not added to the table as visible quality loss. Preserving otherwise invisible channel data and producing an ordinary displayed image are different requirements.

## Differences were present before PNG export, but that was not the entire story

Separating `getImageData` readback from the saved file gives the following counts. Each number is how many of the same 3,072 pixels differ in RGB from the input.

| Browser and input alpha | Canvas readback | PNG after export |
| --- | ---: | ---: |
| Chromium, 64 | 2,679 | 2,679 |
| Chromium, 128 | 2,295 | 2,295 |
| Firefox, 64 | 2,304 | 2,882 |
| Firefox, 128 | 1,535 | 2,691 |

Chromium readback and exported RGBA matched. Firefox also showed differences between its readback and file output. We therefore do not assign every difference to a decoder or to PNG compression alone. `getImageData` itself is a converted readback, not a dump of internal backing-store samples.

The WHATWG HTML standard requires premultiplied alpha for a 2D canvas bitmap and explains that finite-precision conversion to and from ordinary RGBA can lose accuracy for non-opaque colours. The observations are consistent with that mechanism. This experiment did not trace browser internals or establish which particular internal function caused each difference.

We also checked whether the extra readback changed the PNG being measured. All four observed/control pairs had identical encoded PNG bytes in this setup. That is a result for these controls, not a universal promise that every measurement is non-invasive.

## A different file hash does not establish different pixels

All twelve exported diagnostic files have the same decoded RGBA as their corresponding earlier native downloads. The Firefox PNG byte sequences nevertheless differ from the earlier acquisition. A hash checks whether the file bytes are exact; a pixel comparison checks the decoded samples. Neither replaces the other, and this evidence does not identify the internal cause of that PNG byte difference.

Keep a separate copy of the original when exact preservation is the goal. When a format change is required, compare the actual result from the [conversion tool](/en/image/convert/) against the input, checking RGB, alpha and dimensions separately. Data workflows that require exact channel values need their own input/output checks. This study does not evaluate photographs, colour-managed wide-gamut inputs, HDR, 16-bit images, repeated saves, texture filtering or game-engine imports.

## Recheck the files and numbers

The [evidence ZIP](/assets/editorial/2026-11-14-alpha-roundtrip/alpha-roundtrip-evidence.zip) contains inputs, raw RGBA, PNG/WebP output, earlier native references, measurements, method and an offline verifier. With Python and Pillow installed, extract it and run:

```text
python verify-alpha-roundtrip.py
```

This reads local files and recalculates hashes, changed-pixel counts, channel differences, observer controls and VP8L structure. It is not a fresh browser capture or an independent guarantee of the acquisition environment. The [measurement JSON](/assets/editorial/2026-11-14-alpha-roundtrip/measurements.json) and [method and limits](/assets/editorial/2026-11-14-alpha-roundtrip/README.md) record the deployed source, frozen protocol, browser versions, file hashes and conditions for a new acquisition.
