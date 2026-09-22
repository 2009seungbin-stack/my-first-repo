# Processing dependencies and licenses

Reviewed 2026-09-21 against the pinned packages/model cards. Library and model licenses are separate. This is a redistribution inventory, not evidence of output quality. User files stay in the browser; requests fetch public engine assets/weights only.

| Library | Version | Purpose | License | Model license | Commercial-use status | Source |
|---|---|---|---|---|---|---|
| Pica | 10.0.3 | Worker/tiled mks2013 and Lanczos resampling | MIT | N/A | Permitted; notices included | https://github.com/nodeca/pica |
| glur / multimath | 2.0.0 / 3.0.0 | Pica internals | MIT | N/A | Permitted; notices included | https://github.com/nodeca/glur / https://github.com/nodeca/multimath |
| ONNX Runtime Web | 1.30.0 | Optional SR and matting Worker runtime | MIT | Separate entries below | Permitted | https://github.com/microsoft/onnxruntime |
| pdf-lib | 1.17.1 | Native page objects, fonts, marks and image optimization | MIT | N/A | Permitted; notice included | https://github.com/Hopding/pdf-lib |
| PDF.js | 6.3.289 | Ranged reader, lazy preview/render | Apache-2.0 | N/A | Permitted; notice included | https://github.com/mozilla/pdf.js |
| @pdf-lib/fontkit | 1.1.1 | Optional CJK font embedding | MIT | N/A | Permitted; attribution and upstream README included | https://github.com/Hopding/fontkit |
| Noto Sans CJK Korean | pinned f8d1575 | Optional CJK glyphs | SIL OFL-1.1 | N/A | Commercial embedding permitted; OFL included | https://github.com/notofonts/noto-cjk |
| Mediabunny | 1.58.1 | Blob-range demux, WebCodecs conversion, MP4/WebM/WAV mux | MPL-2.0 | N/A | Permitted with file-level copyleft; library source and notice included | https://github.com/Vanilagy/mediabunny/tree/v1.58.1 |
| @mediabunny/mp3-encoder | 1.58.1 | On-demand Worker MP3 encoder bridge | MPL-2.0 | N/A | Covered source included; local import-path modification documented | https://www.npmjs.com/package/@mediabunny/mp3-encoder |
| LAME | 3.100 | Encoder-only MP3 WASM | LGPL-2.0-or-later | N/A | Permitted subject to LGPL; matching source, license, Emscripten replacement/relink instructions included | https://lame.sourceforge.io/ |
| gifenc | 1.0.3 | Incremental frame encoding/adaptive palettes | MIT | N/A | Permitted; notice included | https://github.com/mattdesl/gifenc |
| heic2any (legacy) | 0.0.4 | Fallback HEIC decoding | MIT wrapper | N/A | Wrapper permitted; bundled libheif/libde265 provenance and redistribution review remains OPEN | https://github.com/alexcorvi/heic2any |
| lamejs (legacy) | 1.2.1 | Explicit AudioContext compatibility path | LGPL-3.0 | N/A | Commercial use subject to LGPL; existing remote dependency, outside new vendored encoder | https://github.com/zhuker/lamejs |

| Weights / conversion | Revision | Purpose | Weight license / provenance | Commercial status | Source |
|---|---|---|---|---|---|
| Xenova Swin2SR x2 | 93dfc9089abda257351d3a58d5771e2c1ff69442 | Experimental 2× SR | Apache-2.0 on original caidas model card; ONNX card identifies base model | Permitted under base license; retain attribution | https://huggingface.co/Xenova/swin2SR-classical-sr-x2-64 / https://huggingface.co/caidas/swin2SR-classical-sr-x2-64 |
| Xenova Swin2SR x4 | c60eac19ef391153929330791f241a7c861b3214 | Experimental 4× SR | Apache-2.0 on original caidas model card; same conversion provenance | Permitted under base license | https://huggingface.co/Xenova/swin2SR-classical-sr-x4-64 / https://huggingface.co/caidas/swin2SR-classical-sr-x4-64 |
| CoderViking realesr-general-x4v3 ONNX | c6a971706797c7502945a2b4c4274fce4900d4ab | Faster candidate, not UI default | BSD-3-Clause on conversion card; official Real-ESRGAN v0.2.5.0 weights with source SHA | Permitted; Xintao Wang attribution | https://huggingface.co/CoderViking/realesr-general-x4v3-onnx / https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE |
| studioludens BiRefNet lite 512 | 4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7 | General foreground candidate | MIT on converted and original model cards; original repo MIT | Permitted; ZhengPeng attribution | https://huggingface.co/studioludens/birefnet-lite-512 / https://huggingface.co/ZhengPeng7/BiRefNet_lite |
| BritishWerewolf U-2-Netp ONNX | 7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8 | 4.6 MB first-pass matte shown while BiRefNet downloads; also the "Fast" quality option | Apache-2.0 on the conversion card; original xuebinqin/U-2-Net is Apache-2.0 |

Swin2SR: Conde et al., *Swin2SR: SwinV2 Transformer for Compressed Image Super-Resolution and Restoration* (2022). BiRefNet: Zheng et al., *Bilateral Reference for High-Resolution Dichotomous Image Segmentation* (2024). No BRIA noncommercial weights were added.

## PDF password handling adds no dependency (reviewed 2026-09-22)

`pdf/protect` and `pdf/unlock` needed encryption, which pdf-lib cannot do. Two candidate
dependencies were considered and both rejected: a qpdf WebAssembly build (`@neslinesli93/qpdf-wasm`
0.3.0, `@jspawn/qpdf-wasm` 0.0.2, `qpdf-wasm` 0.1.0 — qpdf is Apache-2.0) would have added a
multi-megabyte binary to a page whose whole optional asset budget is under 100 KB, and loading it
from cdn.jsdelivr.net at runtime would make a core feature depend on a third-party CDN being up.

Instead `src/pdf-crypt.js` implements the ISO 32000 standard security handler directly:
algorithms 2, 2.A, 2.B and 7–13, with SHA-256/384/512 and AES-256-CBC taken from the browser's own
`crypto.subtle`. WebCrypto always applies PKCS#7 padding, so the no-padding CBC that the
specification needs is obtained by dropping the extra ciphertext block on encryption and, on
decryption, by appending one block crafted to decrypt into a full pad block.
MD5 (RFC 1321) and RC4 are implemented in the file because WebCrypto refuses both by design and
revision 2–4 documents require them to be *read*; nothing we write uses either. They are checked
against the RFC 1321 test suite and the published RC4 vectors in `tests/pdf-browser.mjs`.
No new package, no new CDN origin, no change to the CSP, and no code under a new licence: the file
is first-party and covered by this repository's own terms.

`src/pdf-secure.js` writes revision 6 (AES-256) through pdf-lib and removes passwords with its own
byte-level object rewriter, because pdf-lib cannot parse the compressed object streams that
encrypted output from Acrobat, qpdf and MuPDF contains. Verified against pypdf 6.19.0 and
PyMuPDF 1.28 as independent readers: protected files are refused without the password, accept the
user and owner passwords, and carry only the permissions selected; unlocked files open with no
password and render pixel-identically to the original. Certificate and custom security handlers,
and object streams compressed with anything other than Flate, are refused rather than guessed at.

## Static delivery, source availability and security

`npm ci --ignore-scripts` and `npm run vendor` reproduce locally served optional bundles. `assets/vendor/manifest.json` records SHA-256, version and license. Cloudflare's existing `SKIP_DEPENDENCY_INSTALL=true` build remains possible because these assets are checked in. The initial page does not import AI, PDF, video or codec bundles. Pica runtime assets total 97,445 bytes, loaded on first resampling use.

MPL library source is served beside its bundle. The MP3 bundle's bare `mediabunny` import is changed to the pinned relative URL by tools/vendor.mjs; covered modifications remain MPL-2.0. LAME 3.100 source archive (Debian source mirror) is included with SHA-256 `ddfe36cab873794038ae2c1210557ad34857a4b6bdc515785d1da9e175b1da1e`. Its README includes encoder-only, decoder/frontend-disabled Emscripten build and bridge commands. Users can replace/relink the LGPL component. Notices are reachable from the site footer.

ORT and pinned model weights download only when selected and may use Cache Storage. BiRefNet uses the approximately 183 MB fp32 model. Cache contains public models, never selected user files. Model caching denial does not prevent uncached inference. Model hashes beyond the immutable repository revisions are not yet independently checked.

The current npm lockfile audit reports zero known advisories. This does not audit browser implementations, all legacy CDN assets, or prove supply-chain safety. The discarded Transformers experiment is not a runtime dependency; MODNet/Transformers is no longer the background-removal path. HEIC's legacy bundled-codec license inventory remains a release limitation.

A default headless Chromium GPU adapter was unavailable. A separate forced D3D11/WebGPU experiment found an AMD adapter but Swin2SR session creation failed (ORT numeric error 9943656); no successful WebGPU inference is claimed. WASM model quality runs succeeded. Actual deployed CSP, model CDN availability and physical mobile devices remain unverified for this branch.
