// @ts-check
/** Recipes (nerulio.recipe/1) — the contract's import path (AI-COMMUNITY-CONTRACT §4) for the Worker and
 * the server renderers. The module itself lives in src/pipeline/recipe.js because the browser pipeline
 * imports it too and only src/ is served to browsers (tools/build.mjs copies src, assets, ai-runtime). */
export * from '../src/pipeline/recipe.js';
