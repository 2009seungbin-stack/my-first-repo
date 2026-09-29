# T8 held-out comic-art fixture

Source: [Manga-style background](https://opengameart.org/content/manga-style-background) by Pavel Kutejnikov (OpenGameArt user Kutejnikov), published 2023-05-15, downloaded 2026-09-29. The page and archive `ReadMe.txt` declare **CC0 / public domain**. The `manga_bg.7z` archive SHA-256 is `1c992756d2709e464772ca3f9c904a7b276dd133abfdd71cbe3bc46`.

The output `comic-page.png` uses these unmodified-source assets as panel backgrounds before cropping and adds original panel frames, character silhouettes, speech bubbles and text. The new compositing and drawn elements are also dedicated **CC0** by the T8 implementation author. This is a constructed test comic page, not an upload from a commercial webtoon.

| Archive member | SHA-256 |
| --- | --- |
| `manga_bg_01.png` | `0ef477947fa90d6f541937a0624769e4e55862f44d290547cf7c68282bef600b` |
| `manga_bg_04.png` | `ee4ec8983ffb9f0d36290ec039dbd9143900cb49899ac2c74e786eff90cd9557` |
| `manga_bg_08.png` | `edef0221f542da383546ff30b927a6bf965cf40ca64c8b40f07a477783312724` |

The composition script is `make-comic-fixture.py`. The image was designed with full panels, gutters, a white dialogue bubble and dark backgrounds so a cut test can reveal both safe gutters and unsafe blank panel interiors. It must be visually inspected at 100% and after actual platform-size export.

The committed 800×3000 RGB PNG is 1,189,902 bytes, SHA-256 `966113e0fa460eaca3b0a536d116096b9efe7b22a7a346fcde55514510ac266d`. Visual inspection on 2026-09-29 confirmed three readable panel scenes and balloons, visible 110 px gutters, and a high-contrast silhouette. The source is deliberately a testing page rather than a production comic sample.
