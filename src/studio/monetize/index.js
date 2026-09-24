/** Studio monetization entry (docs/ADS.md, docs/PRICING-MODEL.md). Loaded only when the head
 * carries the account-service or Studio-ad meta (boot.js preloads it); main.js does:
 *    const monetization=await loadMonetization();       // before createStudio()
 *    const studio=createStudio(host,…);monetization?.attach(studio,host.firstElementChild);
 * - Nothing configured (no accounts, no Studio ad unit): resolves at once, attaches nothing.
 * - Studio ad unit + accounts: waits for the single GET /me (already started by boot.js) for at
 *   most DECISION_CAP_MS so the column is part of the editor's first layout. Free → column;
 *   Pro, an unreachable service or no answer in time → no Google request and no ad DOM for
 *   this page. The decision never changes during the page's life (no late layout shift).
 * - Accounts on: Studio exports are metered (meter.js) with the Studio's own limit dialog. */
import {enabled,load,current,openSignIn,onSignIn} from '../../entitlement.js';
import {adsForSession} from './layout.js';
import {mountAdColumn} from './ad-column.js';
import {bindStudio} from './meter.js';
import {startRemainingNotes} from './notes.js';
import {showStudioLimit,showStudioSignIn} from './limit-dialog.js';
import {mt} from './strings.js';
export const DECISION_CAP_MS=1500;
export function studioAdConfig(doc=document){
 try{const c=JSON.parse(doc.querySelector('meta[name="nerulio-studio-ad"]')?.content||'null');return c?.client&&c?.slot?{client:String(c.client),slot:String(c.slot)}:null;}catch{return null;}
}
export async function prepareMonetization(){
 const ad=studioAdConfig();
 let entitlement={enabled};
 if(ad&&enabled){
  const outcome=await Promise.race([load().then(()=>'done',()=>'done'),new Promise(r=>setTimeout(()=>r('timeout'),DECISION_CAP_MS))]);
  const {status,me}=current();
  entitlement={enabled,status:outcome==='timeout'&&['idle','loading'].includes(status)?'timeout':status,me};
 }
 const decision=adsForSession(ad,entitlement);
 const out={decision,ad:null,attach(studio,root){
  if(!root)return out;
  const pricingURL=enabled?l=>new URL(`${l}/pricing/`,document.baseURI).href:null;
  if(decision.ads)out.ad=mountAdColumn(root,{client:ad.client,slot:ad.slot,pricingURL});
  if(enabled){
   const refresh=startRemainingNotes(root,()=>studio.locale);
   bindStudio(studio,{usageChanged:refresh,onLimit:info=>showStudioLimit(studio,root,{...info,pricingURL:pricingURL(studio.locale)}),
    onSignIn:info=>showStudioSignIn(studio,root,{...info,openSignIn})});
   // Sign-in finished in the other tab: say so quietly; the project was never touched.
   onSignIn(()=>{refresh();studio.toast(mt(studio.locale,'meter.signedIn'));});
  }
  return out;
 }};
 // Read-only diagnostics for tests and support ("why is there no ad?"); nothing depends on it.
 window.nerulioMonetization=out;
 return out;
}
