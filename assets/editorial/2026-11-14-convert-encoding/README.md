# Browser image conversion: measured downloads, 2026-11-14

These are actual native downloads from Nerulio image conversion, not simulated encoder calls.
AI agents operated the browsers and performed the technical comparisons. No human visual review,
physical-device test, universal quality guarantee or AdSense approval is claimed.

## Conditions

- Live source: `8896489d1157171654ae33c98dab4fdc62b6b770`, checked before and after each browser.
- Playwright Chromium 153.0.8010.12 and Firefox 155.0; Windows; Pillow 12.3.0 decoded every file.
- Two original procedural PNG inputs, 128 x 96: opaque RGB chart and four alpha bands (0, 64, 128, 255).
- Each input was uploaded separately at `https://nerulio.com/en/image/convert/`.
- URL settings: `?format=png&quality=92`, `?format=webp&quality=92`,
  `?format=webp&quality=100`, `?format=jpeg&quality=92`. JPEG used default white background.
- The selected format and visible quality value were checked before clicking the main download button.
- Relevant served convert/image/compression module bytes matched the recorded source commit (UTF-8 LF hashes in JSON).
- The PNG result from each browser is its comparison baseline, separating browser decode/canvas rounding
  from the subsequent encoder. Opaque input pixels also match both PNG baselines exactly.

## Read the results

`measurements.json` records all 16 downloads, hashes, dimensions, byte counts and WebP chunk types.
`visibleRgbChangedPixels` ignores fully transparent pixels. Alpha differences are counted separately;
`opaqueRgbChangedPixels` compares RGB only where the PNG baseline alpha is 255.
An alpha-preserving WebP can still change visible RGB. JPEG has no alpha and flattens these inputs onto white.
`VP8 ` identifies lossy WebP image data; `VP8L` identifies lossless WebP image data. `VP8X` alone is not a codec.

The opaque chart has 12,288 pixels. WebP 92 changed all of them in both browsers; WebP 100 changed zero
and used VP8L in both. On this deliberately regular chart, Chromium's files were 8,898 vs 1,464 bytes;
Firefox's were 8,422 vs 68 bytes. Both 100 outputs decode to the same 10,240 distinct input colours.
These are properties of the supplied pattern and the observed browser versions, not expected photo sizes.
All four WebP alpha-chart outputs retained their baseline alpha values; quality 92 changed visible RGB.

## Reproduce

With Python and Pillow installed, extract the whole ZIP and run `python compare_outputs.py`.
It reads local files, verifies their hashes and reproduces pixel counts/chunk types without network access.
`python generate_fixtures.py NEW_DIRECTORY` recreates the input pixels in a new directory; PNG byte hashes
can depend on Pillow's encoder version. To repeat capture, upload each input to the tool separately using
the four URL settings above in both browsers, save the downloads and record browser versions and current build.
Later browser/site versions may produce different files. This package does not include EXIF/GPS inputs,
wide-gamut profiles, photographs, animation, resize or repeated-save experiments.

## Sources and reuse

- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- https://developers.google.com/speed/webp/docs/riff_container

The input patterns, downloaded derivatives, comparison scripts and this measurement report are original
test material released under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ .
The linked external documentation retains its own terms. No external photographs, source headers,
credentials, cookies or personal user files are included. The JSON timestamps describe collection,
not human review or a publisher endorsement.
