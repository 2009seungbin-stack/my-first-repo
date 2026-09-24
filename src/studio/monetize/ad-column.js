/** The Studio's desktop ad column (docs/ADS.md, "Studio ad column").
 * - Mounted only for a session already decided as Free (or a build without accounts), only
 *   on a viewport of at least 1280×700, and at most once per page. Pro and an unreachable
 *   account service never reach this module: no Google request and no ad DOM at all.
 * - One fixed-size unit (160×600, or 300×600 from 1600 px) chosen at mount and never resized,
 *   reloaded or refreshed. Its column is a grid track laid out in the same frame as the
 *   editor, so neither the unit loading, being unfilled nor being blocked moves the editor.
 * - Labelled "Advertisement" (ko 광고 / ja 広告), separated from the dock by a border and
 *   20 px of clear space, never inside a dialog, and nothing of the editor is drawn over it
 *   (the drop hint and dialog backdrops stop at the column; menus are kept left of it). */
import {adUnitSize,clampLeftOfColumn} from './layout.js';
import {mt} from './strings.js';
export const ADSENSE_SRC='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
export function mountAdColumn(root,{client,slot,pricingURL=null}){
 const body=root?.querySelector('.st-body');
 const state={mounted:false,size:null,script:'idle',unit:null,column:null};
 if(!root||!body)return state;
 const loc=()=>root.lang||document.documentElement.lang||'en';
 function mount(){
  const size=adUnitSize(innerWidth,innerHeight);if(!size||state.mounted)return false;
  state.mounted=true;state.size=size;
  root.style.setProperty('--ad-col',size.column+'px');
  const label=document.createElement('span');label.className='st-ad-label';
  const box=document.createElement('div');box.className='st-ad-slot';box.style.width=size.width+'px';box.style.height=size.height+'px';
  // Fixed-size AdSense unit code: no data-ad-format / full-width-responsive, explicit size.
  const ins=document.createElement('ins');ins.className='adsbygoogle';
  ins.style.cssText=`display:inline-block;width:${size.width}px;height:${size.height}px`;
  ins.dataset.adClient=client;ins.dataset.adSlot=slot;
  const house=document.createElement('p');house.className='st-ad-house';house.hidden=true;
  box.append(ins,house);
  const column=document.createElement('aside');column.className='st-ad';column.dataset.adColumn='';
  column.append(label,box);
  let pro=null;
  // Only with accounts on (a pricing page exists); far below the unit, never beside it.
  if(pricingURL){pro=document.createElement('a');pro.className='st-ad-pro';pro.target='_blank';pro.rel='noopener';pro.dataset.proLink='';column.append(pro);}
  const relabel=()=>{const l=loc();label.textContent=mt(l,'ad.label');column.setAttribute('aria-label',mt(l,'ad.label'));house.textContent=mt(l,'ad.house');if(pro){pro.textContent=mt(l,'ad.removePro');pro.href=pricingURL(l);}};
  relabel();new MutationObserver(relabel).observe(root,{attributes:true,attributeFilter:['lang']});
  body.append(column);root.classList.add('has-ad');
  state.unit=ins;state.column=column;
  // Unfilled units are hidden by CSS (Google's documented selector); the reserved box then
  // shows the quiet house line instead of an empty rectangle.
  new MutationObserver(()=>{if(ins.dataset.adStatus==='unfilled')house.hidden=false;}).observe(ins,{attributes:true,attributeFilter:['data-ad-status']});
  keepMenusOut(root,column);
  const script=document.createElement('script');
  script.async=true;script.crossOrigin='anonymous';script.src=`${ADSENSE_SRC}?client=${encodeURIComponent(client)}`;
  state.script='loading';
  script.onload=()=>{state.script='loaded';};
  // Blocked or failed: the column keeps its size (no shift); the editor never waits on it.
  script.onerror=()=>{state.script='failed';house.hidden=false;};
  document.head.append(script);
  try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch{}
  return true;
 }
 if(!mount()){
  // A window that starts small gets the column the first time it is made large enough
  // (a user-initiated resize, so no unexpected shift); at most one unit per page.
  let t=0;const onResize=()=>{clearTimeout(t);t=setTimeout(()=>{if(mount())removeEventListener('resize',onResize);},250);};
  addEventListener('resize',onResize);
 }
 return state;
}
/** Menus are positioned by the shell; a menu opened near the right edge is moved left of the
 * column so that editor UI never covers the ad (AdSense: content must not cover ads). */
function keepMenusOut(root,column){
 const host=root.querySelector('.st-menus');if(!host)return;
 // Runs in the mutation callback (before the frame is painted), so a menu is never drawn
 // over the column even for one frame. Moving it causes one more record, which is a no-op.
 const fix=()=>{
  if(getComputedStyle(column).display==='none')return;
  const colLeft=column.getBoundingClientRect().left;
  for(const m of host.querySelectorAll('.st-menu')){const r=m.getBoundingClientRect();if(r.right>colLeft-4){const left=clampLeftOfColumn(r.left,r.width,colLeft);m.style.left=left+'px';}}
 };
 new MutationObserver(fix).observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
}
