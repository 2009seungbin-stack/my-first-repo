# BMP V4 to PNG: source-sample checks

On 2026-11-14 an AI agent used the actual `/en/image/bmp-to-png/` interface on `https://nerulio.com` to download four PNGs. Two authored 128 × 96 BMP V4 patterns were converted once each in Chromium 153.0.8010.12 and Firefox 155.0. Pillow decoded the downloads independently. This is an input-format counterexample for the BMP guide, rather than another general-purpose image benchmark.

The capture protocol was committed as `0ef8f8250c1c483a5e3d17b0195453fc5b6efee5` before capture. The actual served source was `03076e89a814dd84be7f5e9c9507003e4ab529da`; four relevant served modules matched Git, with source identity checked before and after each browser. `measurements.json` records those hashes, versions, filenames and observations. The included capture-script copy matches its recorded LF-byte hash.

## Inputs

Both files use a 108-byte BITMAPV4HEADER, 32 bits per pixel, BI_BITFIELDS, explicit 8-bit RGBA masks, positive height/bottom-up BGRA order and the sRGB header constant. There is no embedded profile. Each file is 49,274 bytes: a 14-byte file header, a 108-byte DIB header and 49,152 sample bytes. The DPI fields are 2,835 pixels/metre, approximately 72.009 DPI. This differs from the common 54-byte-header, opaque 24-bit BMPs in the older size example.

For pixel `(x,y)`, `R=(17x+3y)%256`, `G=(5x+19y)%256`, and `B` alternates between 0 and 255. The opaque control has alpha 255. The second pattern has four 32-pixel-wide bands with alpha 0, 64, 128 and 255. These are synthetic controls, not photographs or user documents. Header definitions are documented in [Microsoft's BITMAPV4HEADER reference](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-bitmapv4header).

## Results

Each band contains 3,072 pixels. A changed RGB pixel has at least one unequal RGB channel. Maximum delta is an absolute 8-bit channel difference, not a perceptual score.

| Input band | Chromium changed RGB / max delta | Firefox changed RGB / max delta |
| --- | --- | --- |
| Alpha 64 | 2,679 / 2 | 2,882 / 4 |
| Alpha 128 | 2,295 / 1 | 2,691 / 2 |
| Alpha 255 | 0 / 0 | 0 / 0 |

All alpha samples are unchanged. The full opaque control also has zero RGB changes in all 12,288 pixels in both browsers. In the alpha-0 band, 3,071 hidden RGB samples change in each browser; this is not labelled visible quality loss. All four PNGs have no `pHYs` or `iCCP` chunk and no metadata keys reported by Pillow; the input BMP DPI fields were not preserved in these outputs. No general claim that every browser writes no output metadata is made.

Lossless PNG compression does not establish end-to-end preservation of every BMP sample through browser decoding, canvas handling and export. This study does not trace which internal stage changes each value or test all BMP variants, colour profiles, wide-gamut behaviour, bit depths, browsers, visual perception or repeated saves. The related [transparent RGB analysis](https://nerulio.com/en/ai/digest/transparent-rgb-roundtrip/) discusses the separate earlier PNG-input study and its limits.

## Verify offline

Install Pillow if needed, extract the ZIP, then run:

```text
python verify-bmp-png.py .
```

The verifier makes no network request and writes no files. It restricts filenames to the expected local directory, parses original BMP samples directly, checks the recorded input/output hashes, decodes the four PNGs, recomputes all bands and validates PNG chunk CRCs. Its output can be compared with `analysis.json`.

The capture script is an inspectable copy. Re-capture requires the repository version at `tools/editorial/measure-bmp-png.py`, a clean committed checkout, Pillow, Playwright and installed browsers. Supply the currently served, locally available exact source SHA and a new output directory; a new run is a separate acquisition. The original protocol is available at [its pinned commit](https://github.com/2009seungbin-stack/my-first-repo/blob/0ef8f8250c1c483a5e3d17b0195453fc5b6efee5/tools/editorial/measure-bmp-png.py).

## Files and rights

The package contains both inputs, four native PNG downloads, the capture report, independent offline analysis, capture/verifier scripts and this method. `manifest.json` covers the 11 non-manifest/non-ZIP files; the ZIP has 12 members including the manifest. This authored dataset and its scripts are offered under CC0 1.0. External linked documentation retains its own terms. No external photo, user file, browser cookie or credential is included.
