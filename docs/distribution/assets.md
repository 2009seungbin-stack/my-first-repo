# Existing assets and launch production notes

Existing images are real repository captures registered in `src/game-seo.js` (`SHOTS`).
Originals remain untouched. The generated inventory attaches available screenshot and social-card
paths per source; DEV articles currently use text and code only so they do not claim an image is
an engine verification result.

| Order | Existing full-size asset | What to show | Accurate caption |
| --- | --- | --- | --- |
| 1 | `assets/studio/sprite-aseprite.webp` | Imported source and animation timeline | Aseprite import and animation inspection in the Sprite workspace |
| 2 | `assets/studio/pack.webp` | Atlas frame rectangles and actual export choices | Pack frames and choose a supported output format |
| 3 | `assets/studio/pixel-cleanup.webp` | Real cleanup candidate controls | Review pixel-cleanup candidates before applying changes |
| 4 | `assets/studio/tile-check.webp` | Layout recognition and pattern check | Inspect tile layout and terrain coverage |
| 5 | `assets/studio/texture-lab.webp` | Normal-map view and displayed convention | Inspect normal-map generation and convention |

Mobile `-780.webp` variants also exist. Social cards in `assets/social/` are search/share images,
not substitute evidence of engine import success. Follow fixture credits in
`tests/fixtures/game-seo/SOURCES.md`, `docs/GAME-CORPUS.md` and screenshot generation sources when
reusing art; do not remove required attribution or claim authorship of fixture artwork.

Needed before a polished manual launch:

- A 630×500 itch.io cover composed from the real Sprite capture and the existing brand mark.
- A square Product Hunt thumbnail using the existing mark and one actual sprite.
- Legible gallery crops at the dimensions accepted by each current form. Retain enough controls
  to make the operation clear. Add plain captions rather than mock UI or invented verification.
- If a cleanup before/after is desired, capture the same input and applied output in the real app;
  the current screenshot alone is not proof of a paired before/after result.

These additional crops/captures are production instructions, not completed assets. All original
screenshots remain available for immediate manual listing previews.
