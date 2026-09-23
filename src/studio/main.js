/** Entry point of /game/studio/ (all language prefixes). */
import {createStudio} from './app.js';
import viewer from './workspaces/viewer.js';
import tile from './workspaces/tile/index.js';
import {COMING} from './workspaces/coming.js';
const host=document.getElementById('studio');
// ?renderer=2d forces the Canvas2D fallback (diagnostics and the fallback benchmark).
const renderer=new URLSearchParams(location.search).get('renderer')==='2d'?'2d':'auto';
const studio=createStudio(host,{rootURL:new URL('../../',import.meta.url),renderer});
studio.register(viewer);
studio.register(tile);
for(const w of COMING)studio.register(w);
// Exposed for tests and for power users' console scripts; nothing on the page depends on it.
window.nerulioStudio=studio;
studio.start();
// ?ws=tile opens a workspace directly (links from tool pages and docs).
const ws=new URLSearchParams(location.search).get('ws');
if(ws&&studio.workspaces.get(ws)?.status==='ready')studio.activateWorkspace(ws);
