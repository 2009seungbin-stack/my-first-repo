// Loaded only by builds with a validated real publisher ID. No timers or refreshes.
// Advertising is isolated from the editor: every failure here is swallowed, and nothing
// in processing, download or navigation waits on it.
import {labels} from './content.js';
import {adsAllowed} from './entitlement.js';
const config=document.querySelector('meta[name="adsense-config"]');
const ADSENSE='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
function mount(client,slots){
 for(const [position,slotId] of Object.entries(slots)){
  const host=document.getElementById('siteContent');if(!host)break;
  const walker=document.createTreeWalker(host,128);let marker;
  while((marker=walker.nextNode()))if(marker.data===`ad:${position}`)break;
  if(!marker)continue;
  const slot=document.createElement('aside');slot.className='ad-slot';slot.dataset.position=position;
  const label=document.createElement('span');label.className='ad-label';label.dataset.adLabel='';label.textContent=labels[document.documentElement.lang].ad;
  const ad=document.createElement('ins');ad.className='adsbygoogle';ad.dataset.adClient=client;ad.dataset.adSlot=slotId;ad.dataset.adFormat='auto';ad.dataset.fullWidthResponsive='true';
  slot.append(label,ad);marker.replaceWith(slot);
  (window.adsbygoogle=window.adsbygoogle||[]).push({});
 }
}
if(config){
 const {client,slots}=JSON.parse(config.content);
 if(!document.querySelector('meta[name="nerulio-service"]'))mount(client,slots);// script tag already in <head>
 else{
  // Accounts enabled: ask the server first. Pro (or an unreachable service) means no
  // Google request and no ad DOM at all — no placeholder, no layout gap.
  adsAllowed().then(show=>{
   if(!show)return;
   const script=document.createElement('script');
   script.async=true;script.crossOrigin='anonymous';script.src=`${ADSENSE}?client=${encodeURIComponent(client)}`;
   script.onerror=()=>document.querySelectorAll('.ad-slot').forEach(slot=>slot.remove());
   document.head.append(script);
   mount(client,slots);
  }).catch(()=>{});
 }
}
