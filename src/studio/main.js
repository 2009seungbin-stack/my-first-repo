/** Entry point of /game/studio/ (all language prefixes). */
import {createStudio} from './app.js';
import viewer from './workspaces/viewer.js';
import {COMING} from './workspaces/coming.js';
const host=document.getElementById('studio');
const studio=createStudio(host,{rootURL:new URL('../../',import.meta.url)});
studio.register(viewer);
for(const w of COMING)studio.register(w);
// Exposed for tests and for power users' console scripts; nothing on the page depends on it.
window.nerulioStudio=studio;
studio.start();
