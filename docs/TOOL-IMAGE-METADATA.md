# Image Metadata Viewer & Remover — implementation and evidence, 2026-11-15

Route `/image/metadata/` (`/ko/`, `/en/`, `/ja/`), intent id `image-metadata`, single-task page.

## What it does

A person drops JPEG, PNG or WebP files. For each file the page shows what it carries — GPS position
as text (decimal and degrees–minutes–seconds, with a copy button), camera, lens, capture time,
software, author/copyright, exposure — and every metadata block with its size. It then saves a copy
without those blocks, one file at a time, all at once as a ZIP, or handed to Compress / Convert /
Resize through the existing local hand-off. Nothing is uploaded and no network request is made.

## How it works

`src/image-metadata.js` is DOM-free and dependency-free:

| Container | Listed and removed | Always kept |
| --- | --- | --- |
| JPEG | APP1 Exif, APP1 XMP (and extended XMP), APP13 IPTC/Photoshop, COM, JFXX thumbnail, other APPn (MPF, maker segments), bytes after EOI | SOI, JFIF APP0, APP14 Adobe (colour transform flag), DQT/DHT/SOF/DRI, every scan with its entropy data, EOI |
| PNG | `tEXt` / `zTXt` / `iTXt` (including XMP), `eXIf`, `tIME`, unknown ancillary chunks, bytes after `IEND` | `IHDR` `PLTE` `IDAT` `IEND` `tRNS` `gAMA` `cHRM` `sRGB` `sBIT` `cICP` `mDCv` `cLLi` `bKGD` `hIST` `sPLT` `pHYs` `acTL` `fcTL` `fdAT`, unknown critical chunks |
| WebP | `EXIF`, `XMP `, unknown chunks, bytes after the RIFF payload | `VP8X` `VP8 ` `VP8L` `ALPH` `ANIM` `ANMF`; the RIFF size and the VP8X flags are corrected |

The colour profile (JPEG APP2 `ICC_PROFILE`, PNG `iCCP`, WebP `ICCP`) is kept unless the person
turns that off. When the removed EXIF rotated the picture (Orientation 2–8), a 26-byte EXIF block
with only the Orientation tag is written back unless the person turns that off, so the copy is not
shown sideways. Kept ranges are copied byte for byte; no pixel is decoded or re-encoded.

A file that is damaged or cut off is kept whole from the damaged part onwards and the page says so.

Before any download the page (`src/task/image-metadata.js`) re-opens the copy with
`createImageBitmap`, checks its size against the container's, and re-inspects it: anything other
than the blocks the options keep fails the check and nothing is saved.

## Evidence

* `tests/image-metadata.test.mjs` — known-answer tests. Hand-written fixtures: a TIFF/EXIF block
  with GPS, an Exif IFD and a thumbnail IFD; a JPEG with every segment kind, stuffed `FF00` and a
  restart marker in the scan; a PNG with text, XMP, EXIF, time, private and animation chunks; WebP
  with and without `VP8X`. Expected outputs are concatenated by the test, not produced by the code.
  Real files: the platform's GPS fixtures (`tests/fixtures/anon/`), animated PNG and WebP, and a
  phone photograph (`tests/fixtures/pixel-converter/flower-landscape.jpg`), whose image data after
  the removed segments must be byte-identical.
* Every tracked JPEG, PNG and WebP in the repository (858 files on 2026-11-15) parsed without a
  damage report and re-inspected clean after stripping.
* Chromium (Playwright, 1280 px and 390 px, ko/en/ja): the cleaned phone photograph and the three
  GPS fixtures decode to pixels identical to the originals; ZIP, hand-off, clear, the rotation
  option and the unsupported-file message work; no console error, no request off the origin.

## Status and limits

Maturity is `basic` and the pages are `noindex`: there is no Chromium + Firefox browser suite yet
(`ADVANCED_CRITERIA` in `src/capabilities.js`). Adding one is what promotes the route.

* JPEG, PNG and WebP only. HEIC, AVIF, TIFF, GIF and RAW are reported as unsupported.
* Only common EXIF fields are decoded for display. Maker notes, XMP and IPTC are reported by
  presence and size (XMP is also searched for a GPS latitude) and removed, not interpreted.
* Motion-photo video, depth maps and HDR gain maps stored after the main image go with the metadata.
* Visible content and watermarks in the pixels are not metadata and are not changed.
* The whole file is read into memory; the limit is the device's.
