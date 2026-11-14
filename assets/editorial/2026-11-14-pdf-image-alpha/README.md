# Transparent WebP inside PDF: a paired native-tool study

This package contains 16 PDF downloads: four authored controls in Chromium and Firefox, before and after Nerulio's image-to-PDF transparency fix. It is a narrow test of image-resource alpha and the visible result on a white PDF page, not a general converter ranking.

## Captured conditions

- Before deployed source: `8889f53d61fee2f21b6705310b68fc02a66f4a3b`.
- After deployed source: `66c351586b1538ab21502f5cd64982cca1b298e0`.
- Acquisition protocol was committed before the baseline at `222b19593f185b0d4046426eb305f2611a0e02de`. Its normalized bytes are identical in both acquisitions; each original `measurements.json` records its protocol hash and checkout commit.
- Actual route: `/en/jpg-to-pdf/`, default A4, 24 pt margins, one image per PDF. The protocol used the native file chooser and the normal export button. No runtime interception, simulated PDF bytes or timing gate was used for these captures.
- Each source image is 96 x 96. The transparent pair has 5,120 alpha-zero pixels, 2,048 alpha-128 pixels and 2,048 alpha-255 pixels. The source PNG and lossless WebP have identical decoded RGBA. Opaque WebP and JPG are negative controls.
- Browser versions and acquisition UTC times are preserved in each measurements file. Both acquisitions used Chromium 153.0.8010.12 and Firefox 155.0.
- `fixed-environment.json` was recorded immediately before the fixed acquisition: Python 3.10.11, Pillow 12.3.0, pypdf 6.19.0, Playwright 1.63.0 and Poppler 26.07.0. The baseline records its browser versions; no historical package-version field has been invented for it.
- The acquisition checked the exact deployed build before and after each download and compared five served application modules against the source commit before and after each browser's run.

All inputs and the two measurement records are copied from acquisition without rewriting. `before/` and `after/` each contain four input files, eight PDFs, eight Poppler PNG renders and the original measurements file. `paired-analysis.json` adds independently recalculated comparisons. The archive also includes the frozen acquisition code and a standalone verifier. The top-level `before-chromium.png` and `after-chromium.png` are byte-identical copies of the corresponding captured WebP PDF renders, used as article images.

## Independently checked results

Each PDF contains one A4 page, 595.28 x 841.89 pt, with one 96 x 96 image resource. Image alpha is compared at every one of its 9,216 samples. An absent soft mask is treated as opaque in these specific image objects, which have no color-key mask. This is not a general-purpose PDF transparency interpreter.

Before the fix, the transparent WebP became a JPEG image with no soft mask. Its 7,168 non-opaque alpha samples no longer matched the input in both engines. After the fix it has a soft mask and all alpha samples match. The PNG control has matching alpha in both states. All four opaque-control embedded JPEG streams are byte-identical between states.

The stored page renders were reproduced in full, pixel for pixel, using Poppler at 72 dpi. The three recorded RGB sample positions refer to source-image coordinates: `(8,8)` in the transparent border, `(32,32)` in the half-alpha patch, and `(64,64)` in the opaque patch. Their page coordinates account for A4 placement and margins. The enlarged page render is not compared pixel for pixel against the smaller source image.

## Verify the downloaded evidence

Install Python with Pillow and pypdf, and put `pdftoppm` on PATH. Poppler is supplied by `poppler-utils` on many Linux distributions. Extract the ZIP without editing the files, then run from its root:

```text
python verify-pdf-image-alpha.py
```

Alternatively, pass the extracted package directory to the repository copy of `tools/editorial/verify-pdf-image-alpha.py`.

The verifier checks the exact file inventory and hashes, the matching input RGBA, all image-resource alpha values, PDF page dimensions, recorded RGB samples and all 16 complete render replays. It also recalculates the four opaque JPEG-stream comparisons. It makes no network requests and does not modify evidence files. If the ZIP itself is beside the extracted files, it additionally checks its integrity, exact member set and bytes. Interpreter or third-party tool caches are outside this package-level integrity check.

The full-render replay is deliberately exact for the recorded Poppler environment. Another renderer version can change edge pixels even when file hashes and image alpha agree. Use the recorded Poppler build when checking exact page-render equality.

## Make a new native acquisition

Run the committed repository copy of `tools/editorial/measure-pdf-image-alpha.py`, not its archive copy: the script uses the repository layout and Git source history. It requires Pillow, pypdf, Playwright's Chromium/Firefox browsers and `pdftoppm`.

```text
python tools/editorial/measure-pdf-image-alpha.py --sha YOUR_40_CHARACTER_SOURCE_SHA --output my-pdf-alpha-run
```

Use the full SHA actually served by the target's `build.txt`; the protocol refuses an unexpected build or application module. Results go into a new directory below `test-results`. Nothing is overwritten. `--base` can point to a specific Nerulio preview or a local HTTP build server.

For a historical native replay, build and serve the desired source revision in a separate checkout, then run the protocol from a checkout containing the committed measurement script and that source history, with `--base` pointing to the historical server and `--sha` set to its build. The old baseline revision predates the measurement script, so copying a command into that revision alone is insufficient.

A new capture may have different file hashes because of document creation times or encoder versions. Archive verification authenticates the saved evidence against its records; it does not demand that newly generated PDF bytes repeat historical hashes. To reuse exact archived inputs, select those files manually in the tool. The automated protocol instead regenerates the disclosed authored pattern and records the new input hashes.

## Limits and rights

Matching alpha does not establish matching RGB, hidden RGB, metadata or ICC profiles. This study does not cover HDR, 16-bit inputs, animation, arbitrary files, alternate paper settings, printing, PDF/A, accessibility tagging or every browser. PDF bytes were independently parsed and rendered; no human perceptual or printer trial is claimed. The separate paper-setting timing regression is not part of these 16 unmodified acquisitions.

The controls are original geometric patterns with no user document, photo, brand asset or personal data. The new controls, outputs, renders, records and scripts in this package are dedicated under CC0 1.0; see `LICENSE.txt`. Third-party browsers, libraries and tools retain their own licenses and are not included.
