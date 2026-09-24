/** Broad product pages: one entry point per Studio workspace for the broad searches ("sprite
 * editor", "texture atlas generator", "tilemap editor", "normal map generator" …). Shape and rules:
 * src/game-seo-families.js. Every claim rests on docs/STUDIO-*.md and the labels in src/game-seo.js. */
const page=(intent,ws,shot,copy,extra={})=>Object.freeze({intent,ws,shot,family:'broad',copy,...extra});
export const PAGES=Object.freeze({
});
