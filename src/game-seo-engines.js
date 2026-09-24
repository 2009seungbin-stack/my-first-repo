/** Engine how-tos: one engine × one task, with the engine's own settings in a table.
 * Shape and rules: src/game-seo-families.js. Every claim rests on docs/STUDIO-*.md and the labels in src/game-seo.js. */
const page=(intent,ws,shot,copy,extra={})=>Object.freeze({intent,ws,shot,family:'engines',copy,...extra});
export const PAGES=Object.freeze({
});
