/** Loaded from the Studio head (before main.js) only when accounts or the Studio ad unit are on.
 * It starts the single GET /me early, while the editor's larger module graph is still
 * downloading, so the ad/no-ad decision is usually ready before the editor paints; importing
 * index.js here also preloads the monetization modules main.js imports dynamically. Module
 * instances are shared with main.js (same URLs, same document). */
import {enabled,load} from '../../entitlement.js';
import './index.js';
if(enabled)load().catch(()=>{});
