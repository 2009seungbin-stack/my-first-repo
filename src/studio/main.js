/** Entry point of /game/studio/ (all language prefixes). */
import {createStudio} from './app.js';
import viewer from './workspaces/viewer.js';
import sprite from './workspaces/sprite.js';
import pack from './workspaces/pack.js';
import tile from './workspaces/tile/index.js';
import texture from './workspaces/texture/index.js';
import pixel from './workspaces/pixel/index.js';
import {COMING} from './workspaces/coming.js';
const host=document.getElementById('studio');
// ?renderer=2d forces the Canvas2D fallback (diagnostics and the fallback benchmark).
const renderer=new URLSearchParams(location.search).get('renderer')==='2d'?'2d':'auto';
// Monetization (docs/ADS.md, docs/PRICING-MODEL.md): only builds with accounts or a Studio ad
// unit load it; its ad/no-ad decision is made before the editor is built (no layout shift),
// and any failure there leaves the editor exactly as without it.
const monetization=document.querySelector('meta[name="nerulio-service"],meta[name="nerulio-studio-ad"]')?await import('./monetize/index.js').then(m=>m.prepareMonetization()).catch(()=>null):null;
const studio=createStudio(host,{rootURL:new URL('../../',import.meta.url),renderer});
try{monetization?.attach(studio,host.firstElementChild);}catch(e){console.error(e);}
studio.register(viewer);
studio.register(sprite);
studio.register(pack);
studio.register(tile);
studio.register(pixel);
studio.register(texture);
for(const w of COMING)studio.register(w);
// Exposed for tests and for power users' console scripts; nothing on the page depends on it.
window.nerulioStudio=studio;
studio.start();
// ?ws=tile opens a workspace directly (links from tool pages and docs).
const ws=new URLSearchParams(location.search).get('ws');
if(ws&&studio.workspaces.get(ws)?.status==='ready')studio.activateWorkspace(ws);
