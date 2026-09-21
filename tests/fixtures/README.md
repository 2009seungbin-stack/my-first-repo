# Quality fixtures

`astronaut.png`: NASA portrait of Eileen Collins, public domain. Obtained from the pinned scikit-image v0.21.0 data tree; SHA-256 `88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5`.

Source: https://raw.githubusercontent.com/scikit-image/scikit-image/v0.21.0/skimage/data/astronaut.png
Rights statement: https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut
Used solely as an engineering fixture; no endorsement implied.

Other fixtures are generated deterministically by tests/quality-browser.mjs and tools/benchmark.py. The large PNG is 7680×4320 seeded random RGB converted to opaque RGBA and saved with PNG compression level 0. It exercises real 100 MiB+ decoding and output through the UI. It is not a natural-photo or perceptual-quality reference.

Coverage still missing: natural landscape, anime, fur/hair ground-truth mattes, real product cutouts, diverse camera HEICs, PDFs and long media. Never substitute the small set here for those acceptance gates.
