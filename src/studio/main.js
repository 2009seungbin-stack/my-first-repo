/** Entry point of /game/studio/ (all language prefixes). */
import {createStudio} from './app.js';
import viewer from './workspaces/viewer.js';
import sprite from './workspaces/sprite.js';
import {COMING} from './workspaces/coming.js';
const host=document.getElementById('studio');
// ?renderer=2d forces the Canvas2D fallback (diagnostics and the fallback benchmark).
const renderer=new URLSearchParams(location.search).get('renderer')==='2d'?'2d':'auto';
const studio=createStudio(host,{rootURL:new URL('../../',import.meta.url),renderer});
studio.register(viewer);
studio.register(sprite);
for(const w of COMING)studio.register(w);
// Exposed for tests and for power users' console scripts; nothing on the page depends on it.
window.nerulioStudio=studio;
studio.start();
