# Transparent RGB round-trip diagnostic — 2026-11-14

## What was measured

Two authored 128 x 96 RGBA8 PNG patterns, using Playwright Chromium 153.0.8010.12 and Firefox 155.0
on the actual Nerulio conversion page. Four diagnostic modes per input/browser give 16 observations:

1. Fresh `Im.decode`, then a `getImageData` RGBA readback (no file export).
2. Fresh `Im.decode`, then `Im.blobOf` PNG without that readback.
3. Fresh `Im.decode`, a recorded readback, then PNG export (observer control).
4. Fresh `Im.decode`, then WebP at quality 1.0 without readback (VP8L verified offline).

These are direct calls to the actual exported application code, not 16 new native UI download clicks.
Earlier native PNG/WebP100 downloads from source 8896489d1157171654ae33c98dab4fdc62b6b770 are included
as eight distinct `native-*` reference files. They are a separate acquisition, not new measurements.

Live source: 522f177ee86ada4c3d548f915ef36a5124c6f8b3, checked before/after each browser.
Four relevant served source modules matched their Git bytes after UTF-8 LF normalization.
Frozen protocol commit: 83ca3ce879e7e5f9520c8f74bd6cca1afb610a0b
https://github.com/2009seungbin-stack/my-first-repo/blob/83ca3ce879e7e5f9520c8f74bd6cca1afb610a0b/tools/editorial/measure-alpha-roundtrip.py

## Read the files

`measurements.json` records input/file hashes, raw comparisons by source alpha, maximum absolute RGB
channel differences, source module hashes, browser versions and the protocol hash. A `.rgba` file is
49152 bytes: 128 x 96 pixels, row-major R,G,B,A, one unsigned byte per channel, no file header.
`decoded-read` is an unpremultiplied API readback, not a view into the browser's internal backing store.
`observed-read` is the independent pre-export buffer from the PNG observer case.

All opaque samples and all alpha values stayed unchanged in these tests. Semi-transparent RGB differed
from the source. Chromium readback and outputs matched one another. Firefox readback and file outputs
also differed; do not attribute every difference to decoding or to one internal browser function.
All four observer PNG pairs had identical encoded bytes with/without the extra readback in this setup.
Fully transparent source RGB was mostly replaced, but that is invisible data and is not counted as
visible quality loss. Numeric channel differences are not a human perception score.

Every exported diagnostic file has the same decoded RGBA as its earlier native counterpart.
Firefox PNG byte sequences differ from the earlier acquisition even though their decoded pixels match.
Thus byte identity, pixel identity, alpha preservation and perceived quality are separate checks.

## Reproduce offline

With Python and Pillow installed, extract the ZIP and run:

    python verify-alpha-roundtrip.py

The script reads this folder only, verifies the manifest, reopens PNG/WebP with Pillow, recomputes
all per-alpha pixel counts/deltas, checks raw observer buffers and earlier native references, and
verifies VP8L chunks. It makes no network requests or file writes. This is a recomputation of saved
evidence, not a new browser capture or independent verification of the acquisition metadata.

For a fresh capture, use the pinned repository protocol above in a checkout containing the expected
live source commit and the earlier conversion-study fixtures. With installed Playwright browsers:

    python tools/editorial/measure-alpha-roundtrip.py --expected-sha FULL_LIVE_COMMIT --output NEW_DIRECTORY

Read `https://nerulio.com/build.txt` for the current build, then use that full commit only if it exists
in your checkout. The command refuses tracked changes or an existing output folder. Later browser,
site or platform versions can produce different results; do not label a later run as the archived run.

## Limits, sources and reuse

AI agents operated the browsers and wrote the analysis; no separate human visual review is claimed.
There were no photos, user uploads, input ICC profiles, HDR/P3/16-bit inputs, resize, game-engine import,
perceptual quality evaluation or repeated-save experiment. Readback/serialization results are consistent
with the alpha precision issue described by the standard, but browser internals were not traced.

- https://html.spec.whatwg.org/multipage/canvas.html (premultiplied alpha and the 2D rendering context)
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData

Original procedural inputs, diagnostic outputs, reports, this method and offline script are released
under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ . Included earlier native references
use the same original inputs and CC0 test-material terms. External documentation keeps its own terms.
No credentials, cookies or personal user files are included.
