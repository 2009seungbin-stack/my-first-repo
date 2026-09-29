# Seed data format (`nerulio.seed/1`)

Curated, **sourced** graph data lives in `data/seed/<vertical>/*.json` and is imported by the same
ingest pipeline that collectors use (`platform/ingest.js`). Validate with:

```
node tools/platform/validate-seed.mjs            # everything
node tools/platform/validate-seed.mjs data/seed/hardware
```

## Rules (non-negotiable)

1. **No invented data.** Every fact, relation, version, event, availability and compatibility row cites
   a source (`src`) that was actually opened on the `retrieved` date. If you cannot find an official
   or clearly reliable source, **omit the fact** — the page shows "Unknown", which is correct.
2. Verification label (`ver`) must be honest:
   - `OFFICIAL` — stated by the maker/owner (spec page, pricing page, docs, official announcement, Steam store data published by the developer).
   - `AUTOMATED` — only for collector output (not for hand-curated seed).
   - `COMMUNITY` — from a community source (a patch author's page, a forum post) — not verified by Nerulio.
   - `ESTIMATE` — computed by a stated method (source kind `ESTIMATE_METHOD` with the method in `note`).
   - `UNKNOWN` is never written as a fact; omit instead.
3. Descriptions are 1–2 factual sentences in **both en and ko**, written by you, no marketing, no
   copying of source text. Omit when you have nothing factual to say.
4. Korean names: use the name officially used in Korea (Korean store page / Korean official site).
   If there is no official Korean name, use the common Korean transliteration **only** if widely used;
   otherwise give only `en`.
5. Never link to or describe unauthorized downloads (cracks, ripped assets, pirate mirrors). Translation
   patches: link to the author's own page only; Nerulio never hosts patch files.
6. Prices: the official list price for the stated region and currency, with the date retrieved. Taxes,
   promotions and regional conversions are not facts — put them in `note` or omit.
7. Dates: ISO `YYYY`, `YYYY-MM` or `YYYY-MM-DD` — use the precision the source gives.
   A day is the local calendar day of the place it happens (a Japanese broadcast "Friday 25:23" is
   Saturday in JST — see `docs/n2/sources-subculture.md`, "Dates of Japanese broadcasts"), never UTC.

## Shape

```jsonc
{
  "schema": "nerulio.seed/1",
  "vertical": "hardware",                 // ai | games | hardware | studio | subculture
  "sources": [
    {
      "id": "src:nvidia-rtx-5070-specs",  // src:<lowercase-key>, unique across all seed files
      "kind": "OFFICIAL",                 // OFFICIAL | OFFICIAL_API | FEED | CURATED | COMMUNITY | MANUAL_SOURCE | ESTIMATE_METHOD
      "url": "https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5070-family/",
      "title": "GeForce RTX 5070 Family",
      "publisher": "NVIDIA",
      "retrieved": "2026-09-28",
      "note": "optional"
    }
  ],
  "entities": [
    {
      "id": "gpu:rtx-5070",               // <type>:<key>; type must exist in platform/verticals/<vertical>.js
      "type": "gpu",
      "slug": "rtx-5070",                 // URL /{ko,en}/hardware/rtx-5070/ — unique within the vertical
      "names": {"en": "NVIDIA GeForce RTX 5070", "ko": "엔비디아 지포스 RTX 5070"},
      "aliases": ["RTX 5070", "GeForce RTX 5070", "5070"],
      "description": {"en": "…", "ko": "…"},                       // optional
      "regions": ["GLOBAL"],                                         // optional
      "official_urls": [{"label": "Product page", "url": "https://…"}],
      "facts": [
        {"p": "vram_gb", "v": 12, "ver": "OFFICIAL", "src": "src:nvidia-rtx-5070-specs"},
        {"p": "release_date", "v": "2025-03", "ver": "OFFICIAL", "src": "src:…"},
        // scoped fact (regional/plan/platform overlay):
        {"p": "price_monthly", "v": 20, "unit": "USD", "region": "US", "ver": "OFFICIAL", "src": "src:…"},
        {"p": "price_monthly", "v": 29000, "unit": "KRW", "region": "KR", "ver": "OFFICIAL", "src": "src:…", "note": "VAT included per the page"}
      ],
      "relations": [
        {"p": "made_by", "o": "vendor:nvidia", "src": "src:…"}      // predicates: platform/schema.js PREDICATES
      ],
      "versions": [
        {"version": "4.5.3", "released": "2025-09-09", "channel": "stable", "notes_url": "https://…", "src": "src:…"}
      ]
    }
  ],
  "events": [                               // dated occurrences (subculture events, releases, collabs)
    {"kind": "collab", "title": {"en": "…", "ko": "…"}, "starts": "2026-10-03", "ends": "2026-11-02",
     "region": "KR", "location": "…", "url": "https://official…", "entities": ["character:…", "work:…"],
     "ver": "OFFICIAL", "src": "src:…"}
  ],
  "availability": [                         // AI features/models per plan × platform × region
    {"entity": "feature:chatgpt-agent", "plan": "plan:chatgpt-plus", "platform": "web", "region": "*",
     "state": "available", "ver": "OFFICIAL", "src": "src:…"}
  ],
  "compatibility": [                        // subject@version × target@version × env
    {"subject": "plugin:fabfilter-pro-q-4", "subject_version": "*", "target": "os_release:macos-26",
     "target_version": "*", "env": {"arch": "arm64", "format": "au"}, "status": "supported",
     "ver": "OFFICIAL", "src": "src:…", "note": "optional"}
  ]
}
```

- Value types come from the property definition (`platform/verticals/<vertical>.js`):
  `number`/`tokens` → JSON number · `money` → number + `unit` ISO currency (unless the property fixes
  the unit) · `date` → ISO date string · `bool` → true/false · `list` → array of strings · `url` →
  https URL · `enum` → one of the listed keys · `text` → string.
- Scope keys on facts: `region` (ISO alpha-2, `EEA`, `EU`, `GLOBAL`, `*`), `platform`
  (`web ios android windows macos linux api *`), `plan` (a plan entity id), `from` (valid from date).
- Entities may reference entities defined in other seed files of any vertical (e.g. a model in `ai`
  referenced by a benchmark in `hardware`).
- Split large verticals into several files (`games/steam-top.json`, `games/patches.json`, …).
