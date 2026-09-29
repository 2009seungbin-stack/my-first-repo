# Audio Lab reference audio

## Original synthetic ground truth

`generate.py` produces the 13 WAV files described by `manifest.json` using mathematical sine waves and clicks; no source recording is sampled. The WAVs and generator are offered under CC0-1.0. Tempo and key are **construction labels**, not perceptual or population accuracy claims. The sustained tone and silence are rejection controls.

## Kenney Music Jingles (real CC0 recordings)

- Author: Kenney Vleugels, [Music Jingles](https://kenney.nl/assets/music-jingles), 85 assets, Creative Commons Zero (CC0-1.0). The source page and the archive's `License.txt` both state CC0; the unmodified licence text is copied as `KENNEY-LICENSE.txt`.
- Retrieved 2026-09-28 from the official page's “Continue without donating” link: `https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip`.
- Archive SHA-256: `b729ba57959bd58793d2c5cafa348aaf2655d354f3da35ec4729e03ec77197b8` (stored under ignored `test-results/audio-lab/kenney/` during validation).
- `kenney-preview.ogg` is the archive's `Preview.ogg`, SHA-256 `e3cf15383007de5c5f5dd68027ea87ee4c8c0a7e382a2252ead55c1f21608c60`; FFprobe: Vorbis, 48 kHz, 2 channels, 13.017 s.
- `kenney-nes00.ogg` is `Audio/8-Bit jingles/jingles_NES00.ogg`, SHA-256 `1010c9b566d6c090ff03a4aaaf7439e26eb4cc4f20373800d0b7e6a9057b795d`; FFprobe: Vorbis, 44.1 kHz, 2 channels, 1.758 s.

The Kenney files have **no supplied BPM or key labels**. They are for real audio decode, editing, codec and listening QA. They must not be counted in tempo or key accuracy until an independent annotation procedure assigns ground truth.
