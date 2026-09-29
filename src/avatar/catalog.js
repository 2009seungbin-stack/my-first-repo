/** Original CC0 pixel part catalog, version 1. Coordinates are authored in a 16×16 grid.
 * See docs/avatar-prototype/SOURCES.md for the visual gate and dedication. */
export const CATALOG_VERSION=1;
export const PARTS=Object.freeze({
 face:[['round','Round'],['angular','Angular']],
 hair:[['bob','Bob'],['swept','Swept']],
 eyes:[['bright','Bright'],['sleepy','Sleepy']],
 outfit:[['hoodie','Hoodie'],['jacket','Jacket']],
 accessory:[['none','None'],['earring','Earring'],['glasses','Glasses']],
 background:[['transparent','Transparent'],['sky','Sky'],['plum','Plum']],
});
export const CATEGORIES=Object.freeze(Object.keys(PARTS));
export const IDS=Object.freeze(Object.fromEntries(CATEGORIES.map(key=>[key,Object.freeze(PARTS[key].map(([id])=>id))])));
export const RAMPS=Object.freeze({
 skin:[[96,49,53,255],[189,113,93,255],[238,174,137,255],[255,213,174,255]],
 skinTan:[[72,39,47,255],[137,79,66,255],[194,121,82,255],[239,175,112,255]],
 skinDeep:[[49,34,46,255],[94,60,62,255],[145,88,72,255],[193,136,94,255]],
 dark:[[24,28,48,255],[45,53,79,255],[79,99,117,255],[139,164,163,255]],
 red:[[77,35,55,255],[135,52,69,255],[200,80,83,255],[246,147,112,255]],
 blue:[[23,45,77,255],[34,83,125,255],[58,139,164,255],[127,208,202,255]],
 gold:[[75,51,48,255],[153,93,62,255],[222,156,83,255],[255,217,136,255]],
 eye:[[24,28,48,255],[38,65,89,255],[65,119,129,255],[221,243,219,255]],
});
export const PALETTES=Object.freeze({skin:['skin','skinTan','skinDeep'],hair:['dark','red'],outfit:['blue','gold']});
