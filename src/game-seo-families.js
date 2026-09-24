/** The page families added in docs/SEO-KEYWORDS.md (branch nerulio/game-landings-2): broad product
 * pages per workspace, engine how-tos, format conversions, problem fixes and honest comparisons.
 *
 * Each family file exports PAGES: keyword landings with the shape of src/game-seo.js
 * GAME_KEYWORD_PAGES — {intent, ws, shot, family, copy:{en,ko,ja:{title, description, lead, what[],
 * steps[], faq[[q,a]], table?, compare?, better?}}, related[], highlight?, vs?} — rendered by
 * tools/game-landing-build.mjs and gated by tests/game-seo-quality.test.mjs (length, overlap,
 * page-specific table/steps/FAQ, deep link).
 *
 * The copy is large, so it is loaded only where pages are BUILT (Node: the static build, the tests,
 * the screenshot and social-card tools). Browser modules that import src/game-seo.js through
 * src/landings.js (every file-tool page) get an empty object and never download it; no browser code
 * reads these pages — the landings themselves are static HTML with src/game-landing.js. */
const NODE=typeof process!=='undefined'&&!!process.versions?.node;
const FILES=['./game-seo-broad.js','./game-seo-engines.js','./game-seo-formats.js','./game-seo-fixes.js','./game-seo-compare.js'];
const mods=NODE?await Promise.all(FILES.map(f=>import(f))):[];
export const GAME_FAMILY_PAGES=Object.freeze(Object.assign({},...mods.map(m=>m.PAGES)));
/** Families and the hub group each one is listed in (null = its workspace's group). */
export const FAMILIES=Object.freeze({
 broad:{group:null},
 engines:{group:'engines'},
 formats:{group:'formats'},
 fixes:{group:'fixes'},
 compare:{group:'compare'}
});
