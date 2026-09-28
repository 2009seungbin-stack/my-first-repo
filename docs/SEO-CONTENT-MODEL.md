# Search intent content model

Every indexable search page (the sitemap's game and tool pages, ko/en/ja) answers the task behind
its query, not only "Nerulio can do X". The page's existing copy (`src/game-seo*.js`,
`src/landings.js`) stays; the **intent content** in `src/seo-depth/<group>.js` adds what a
visitor would otherwise search for again: the concept, a worked example, what maps to what, the
files, the steps in the target engine or app, how to check the result, troubleshooting,
alternatives, limits and sources.

The task is the protagonist. Nerulio is the most convenient way to do one step inside a guide that
is useful to someone who never uses Nerulio.

## Files

* `src/seo-depth/index.js` — `GROUPS` (which file owns which canonical path) and `DEPTH`.
* `src/seo-depth/<group>.js` — `export default {'<canonical path>': {type, intent, en, ko, ja}}`.
* `src/seo-depth/render.js` — the renderer (static HTML, dependency-free).
* Game landings: `tools/game-landing-build.mjs` places the sections; `tools/game-seo-build.mjs`
  extends the HowTo JSON-LD with the `target` steps (they are visible under `#target`).
* File tools: `tools/build.mjs` (`toolDepth`) injects the sections as static HTML into
  `#siteContent` and the answer under the H1. The browser never loads the content.
* Tests: `tests/seo-depth.test.mjs` (`SEO_DEPTH_GROUP=<group>` runs one group's pages only).
* Inventory: `node tools/seo-inventory.mjs` → `docs/SEO-INTENT-INVENTORY.{json,md}`.

## Page entry

```js
'game/aseprite-to-godot': {
  type: 'conversion',            // see Types
  intent: {                      // English, for the inventory (not rendered)
    primary: 'convert an .aseprite file into a working Godot 4 animated sprite',
    secondary: ['keep tags and frame timing', 'pixel-art import settings'],
    goal: 'an AnimatedSprite2D that plays the Aseprite tags at the right speed',
    input: '.aseprite (any colour mode, tags optional)',
    output: 'SpriteFrames .tres + PNG atlas + .tscn + .png.import',
    target: 'Godot 4',
    support: 'full',             // full | partial | none (the page must say what is missing)
    evidence: ['docs/STUDIO-PACK.md (Godot 4.7.2 runs)', 'docs/STUDIO-SPRITE.md §10'],
    external: ['Godot 4.7 docs: SpriteFrames, AnimatedSprite2D']
  },
  en: { answer, concept, example, mapping, outputs, target, verify, trouble, alternatives, limits, versions },
  ko: { …same sections, same row counts… },
  ja: { … }
}
```

Every section is optional in the model; the **type** decides which are required (tests enforce it).

| Section | Shape | Rendered as |
| --- | --- | --- |
| `answer` | string, 2–4 sentences | under the H1, before the tool |
| `concept` | `{title, body:[para…], terms?:[[term, definition]…]}` | "How it works" |
| `example` | `{title, lead?, lines:[…], after?}` | monospace block: real numbers, a calculation |
| `mapping` | `{title, lead?, head:[3–4 cols], rows:[[…]…], note?}` | source → Nerulio → target table |
| `outputs` | `{title?, lead?, rows:[[fileName, purpose]…]}` | files you get |
| `target` | `{title, lead?, steps:[…], note?}` | steps in the engine/app AFTER Nerulio (also HowTo JSON-LD) |
| `verify` | `{title?, lead?, steps:[…]}` | how to check the result |
| `trouble` | `{title?, lead?, rows:[[symptom, cause, check, fix]…]}` | troubleshooting table |
| `alternatives` | `{title?, lead?, rows:[[option, whenBetter]…]}` | other ways, honestly |
| `limits` | `[…]` or `{title, items:[…]}` | page-specific limits (game pages: first items of "Limits") |
| `versions` | `{title?, body:[…], sources:['[label](https://official-doc)'…]}` | versions tested + official docs |

Inline markup in any prose or table cell: `` `code` ``, `[[canonical/path|link text]]` (internal,
must exist — the build throws otherwise), `[text](https://…)` (external, official docs only).
`example.lines` is printed verbatim (no markup).

## Types and what each must contain

Required sections per locale (tests/seo-depth.test.mjs `REQUIRED`):

* **conversion** (X → Y): answer, concept, example, mapping (≥ 4 rows), outputs (≥ 2), target
  (≥ 4 steps), verify (≥ 2), trouble (≥ 4), alternatives (≥ 2), versions (with ≥ 1 source).
* **engine** (use an asset in engine E): answer, concept, example, outputs, target (≥ 4), verify,
  trouble (≥ 4), alternatives, versions (≥ 1 source).
* **troubleshoot** (why is it broken): answer, concept (the causes), trouble (≥ 4), verify (≥ 2),
  example or mapping, versions. Diagnose first; say what Nerulio cannot fix.
* **create** (make/edit an artifact): answer, concept, example, verify or target, trouble (≥ 3),
  alternatives (≥ 2).
* **format** (what is this format, how to use/convert it): answer, concept with ≥ 3 terms,
  example or mapping, outputs or target, trouble (≥ 3), versions (≥ 1 source).
* **compare** (X vs Nerulio / alternatives): answer, concept, alternatives (≥ 2 rows, including
  when the other tool is better), limits (≥ 3: what Nerulio lacks), versions (≥ 1 source).
* **tool** (general file tools: convert, compress, resize, PDF, video): answer, concept, example,
  verify, trouble (≥ 3), alternatives (≥ 1), limits (≥ 1).

All types: `answer` ≥ 200 characters (en) / 80 (ko, ja); the same row and step counts in every
locale; no placeholders; no internal link to a page that does not exist.

## Writing rules

1. **Answer first.** The first sentences say what the visitor needs, what goes in, what comes out,
   and the supported scope/version. No marketing.
2. **Numbers that work.** Show real calculations (384 × 64 ÷ 6 columns = 64 × 64 frames;
   125 ms → 8 FPS → duration 1.0). Recompute every number; examples must match the implementation.
3. **Continue after the export.** Engine/app steps until the result works there (where files go,
   which node/importer, which setting). Only steps you verified in official docs or in the repo.
4. **Troubleshooting = real failure modes**: symptom, likely cause, how to check, fix. No filler rows.
5. **Honesty.** Nerulio behaviour comes from the repository (code, `docs/STUDIO-*.md`,
   `docs/ENGINE-VERIFY.md`, tests). Engine behaviour comes from official docs (cite them in
   `versions.sources`). Say which is which: "Verified in Godot 4.7.2" only when the repo says so;
   otherwise "According to the Godot 4.7 documentation…". UNVERIFIED stays UNVERIFIED. No "best",
   "#1", invented scores, testimonials, benchmark numbers or menu paths.
6. **Comparisons are comparisons.** What the other tool does better, what Nerulio lacks, when to use
   each. No winner labels.
7. **No keyword stuffing.** Write normal technical prose; the query words appear where they belong.
8. **Contextual links.** Link the next task where it arises ("if frames wobble after trimming, see
   [[game/sprite-jitter-after-trim|fixing jitter]]"), not a list of keywords.
9. **Three real languages.** Korean and Japanese are written as native technical prose, not literal
   translations; identifiers, file names, units and menu labels stay exact (use the engine's
   localized UI label only if you verified it; otherwise the English label in `code`).
10. **Page-specific.** A sentence that could sit unchanged on ten pages does not belong in the
    intent content (tests reject long strings repeated across pages).
