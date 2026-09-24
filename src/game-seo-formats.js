/** Format conversions: only formats the Studio reads and writes today.
 * Shape and rules: src/game-seo-families.js. Every claim rests on docs/STUDIO-*.md and the labels in src/game-seo.js. */
const page=(intent,ws,shot,copy,extra={})=>Object.freeze({intent,ws,shot,family:'formats',copy,...extra});
export const PAGES=Object.freeze({
});
