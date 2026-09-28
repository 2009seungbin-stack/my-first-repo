// @ts-check
/** MANUAL_SOURCE: GPU specifications and launch prices.
 *
 * Why manual: NVIDIA, AMD and Intel publish GPU specs only as HTML product pages / datasheets
 * (no documented product API or feed as of 2026-09-28; see docs/n2/sources-hardware.md). Specs
 * are static after launch, so a scraper would add breakage risk for no freshness gain.
 *
 * How admins update specs:
 *  1. New GPU launched: open the vendor's official spec page and launch announcement, add one
 *     entity to the matching file in data/seed/hardware/ (nvidia-rtx50.json, nvidia-rtx40-30.json,
 *     amd-radeon.json, intel-arc.json, workstation.json) following docs/n2/SEED-FORMAT.md:
 *     every fact `ver:"OFFICIAL"` with a `src` whose `retrieved` is the day you opened the page.
 *     Values the official page does not state are omitted (never copied from TechPowerUp,
 *     Wikipedia, reviews or retailers).
 *  2. Correction: change the value and the source's `retrieved` date; the ingest diff records the
 *     change (old → new) — do not delete history.
 *  3. Run `node tools/platform/validate-seed.mjs` (no arguments) and `node --test tests/n2-*.test.mjs`,
 *     then import through the admin ingest (same pipeline as collectors).
 *  4. Or edit a single fact in the admin console (/admin/) — it writes the same fact/change rows
 *     with the admin as author; still cite the official URL.
 * Review cadence: on every vendor launch event, plus a quarterly pass over the vendor lineup
 * pages to catch new SKUs and memory variants.
 */
export const OFFICIAL_SPEC_SOURCES=Object.freeze([
 {vendor:'NVIDIA',what:'GeForce specs',url:'https://www.nvidia.com/en-us/geforce/graphics-cards/compare/'},
 {vendor:'NVIDIA',what:'launch announcements / MSRP',url:'https://www.nvidia.com/en-us/geforce/news/'},
 {vendor:'NVIDIA',what:'workstation GPUs',url:'https://www.nvidia.com/en-us/products/workstations/'},
 {vendor:'AMD',what:'Radeon specs',url:'https://www.amd.com/en/products/specifications/graphics.html'},
 {vendor:'AMD',what:'launch announcements / SEP',url:'https://www.amd.com/en/newsroom.html'},
 {vendor:'Intel',what:'Arc specs (ark)',url:'https://www.intel.com/content/www/us/en/products/details/discrete-gpus/arc.html'},
 {vendor:'Intel',what:'launch announcements',url:'https://newsroom.intel.com/'},
]);

export default {
 id:'gpu-specs-manual',
 vertical:'hardware',
 mode:'manual',
 freshnessHours:24*90,
 hosts:[],
 minIntervalMs:0,
 terms:'Manual curation from official vendor pages; no automated fetching.',
 async collect(){throw Error('gpu-specs-manual is a MANUAL_SOURCE: specs are curated in data/seed/hardware/ (see the header of this file).');},
};
