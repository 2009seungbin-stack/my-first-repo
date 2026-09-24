/** Studio export metering (docs/PRICING-MODEL.md, "Studio exports").
 * `if(!await meter('studio-pack-export'))return;` right before a metered export starts:
 * true = go on, false = stop without touching the project, selection or settings (the limit
 * dialog or a toast has explained why).
 * - Light actions (quota class 'none') and builds without accounts return true at once and
 *   never call the API. This module's static imports are tiny on purpose (the workspaces
 *   import it); the account layer is loaded only on builds that have it.
 * - Every call site must use an id from STUDIO_ACTIONS (tests enforce it); an unknown id throws
 *   so a new export can never ship unclassified.
 * - Only {operationId, toolId} leave the page (src/entitlement.js): never a file or a name. */
import {STUDIO_ACTIONS,meteredTool} from '../../quota.js';
import {mt} from './strings.js';
export const LOW_AT=3;// the remaining count appears next to export buttons from here down
const service=typeof document!=='undefined'&&!!document.querySelector('meta[name="nerulio-service"]');
let studio=null,limitHandler=null,onUsage=()=>{};
const loc=()=>studio?.locale||document.documentElement.lang||'en';
/** Called once by monetize/index.js when the Studio exists. */
export function bindStudio(s,{onLimit,usageChanged}={}){studio=s;limitHandler=onLimit||null;onUsage=usageChanged||onUsage;}
export async function meter(action){
 if(!Object.hasOwn(STUDIO_ACTIONS,action))throw Error(`Unclassified Studio action "${action}": add it to STUDIO_ACTIONS in src/quota.js`);
 if(!meteredTool(action)||!service)return true;
 const {authorize}=await import('../../entitlement.js');
 const ok=await authorize(action,{},{
  lowAt:LOW_AT,
  notice(key){
   if(key==='remaining')return;// shown beside the export buttons (notes.js), never as a toast
   const k={graceUsed:'meter.grace',paused:'meter.paused',challengeFailed:'meter.challengeFailed'}[key];
   if(k)studio?.toast(mt(loc(),k),{error:key!=='graceUsed'});
  },
  async limit(info){onUsage();if(limitHandler)await limitHandler(info);}
 });
 onUsage();
 return ok;
}
