# Guides (/guides/)

Editorial how-to guides for 2D game developers, in ko/en/ja. They answer real search queries
(sprite sheets in each engine, blurry pixel art, autotiles, atlases, normal maps, fonts) with the
exact engine steps and the asset side done in Nerulio.

## Files

| Path | What |
|---|---|
| `src/guides.js` | Registry and contract: `GUIDES` (metadata), `GUIDE_ROUTES` (`guides` + `guides/<slug>`, language-neutral like `ROUTES`), `guideRoute`, `guideLastmod` (sitemap `<lastmod>`) |
| `content/guides/<slug>/<ko|en|ja>.md` | Bodies, in the Markdown dialect below |
| `tools/guides-build.mjs` | Pure renderer: Markdown → HTML, guide page, `/guides/` index, JSON-LD. `tools/build.mjs` calls `guideEntry()` |
| `src/guides.css`, `src/guides-page.js` | Dark game-home look; language switch, neutral-URL redirect, copy buttons (the page reads fine without JS) |
| `assets/guides/` | Screenshots: `<name>-<locale>.webp` (real Studio/Lab UI, `tools/guides-shots.py`) and `engine-*.webp` (drawn by the engine named in the caption). Credits in `CREDITS.txt` |
| `assets/social/<l>-guide-<slug>.png`, `<l>-guides.png` | Social cards, `python tools/generate-guide-social.py` |
| `tests/guides.test.mjs`, `tests/guides-browser.py` | Registry, renderer and page tests; the browser suite runs in `tools/regression.py` |

The site-wide sitemap and the links from game landing pages to guides belong to the SEO build; it
reads `GUIDE_ROUTES`, `guideLastmod` and `GUIDES[].tools/open`.

## Page

One `h1`, a visible "Updated" date, engines and "Tested in" (only engine builds the steps were run
in), intro that answers the query, table of contents (a sticky column on wide screens), the body,
a "Do it in Nerulio" block whose button opens `game/studio/?ws=<sprite|pack|tile>` or a tool page,
FAQ, sources, related guides and tools. Structured data: `Article` (author and publisher Nerulio,
`dateModified`), `BreadcrumbList`, `FAQPage` built from the visible FAQ only, `HowTo` built from the
visible `:::steps` list only. Canonical and hreflang like tool pages: the language-neutral URL is the
English page (x-default, canonical `/en/…`); `src/guides-page.js` sends Korean and Japanese browsers
to their version.

## Markdown dialect

- No `#`; the title comes from `src/guides.js`. Text before the first `##` is the intro.
- `## Heading {#id}` — every `##` needs an id, the same in all three languages. `### Sub {#id}`.
- Inline `**bold**`, `*em*`, `` `code` ``, links: `https://…`, `guide:<slug>[#anchor]`,
  `tool:<intent-id>`, `studio:<ws>`, `#anchor`.
- Lists (`-`, `1.`, one nested level), GFM tables, fenced code with a language, `> ` callouts.
- `![alt](shot:<name> "Caption")` on its own line; `\"` inside captions.
- `:::steps` + an ordered list + `:::` (at most one; becomes HowTo).
- `:::nerulio ws=<sprite|pack|tile>` or `:::nerulio tool=<intent-id>` + body + `:::` (exactly one).
- `## FAQ {#faq}` with `### Question` + answer; `## Sources {#sources}` with the official docs.

`renderMarkdown()` reports anything it cannot place (unknown links, missing screenshots, headings
without ids, a second steps block); the unit test fails on any report.

## Adding a guide

1. Write `content/guides/<slug>/{en,ko,ja}.md` (ko/ja are native rewrites with the same sections,
   steps and images).
2. Add its entry to `GUIDES` (`section`, `engines`, `updated`, `tools`, `open`, `related`, `tested`,
   `title`, `description`).
3. `python tools/generate-guide-social.py`, then `node --test tests/guides.test.mjs`.
