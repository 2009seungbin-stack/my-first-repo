// Loaded only by builds with a validated real publisher ID. No timers or refreshes.
import {labels} from './content.js';
const config=document.querySelector('meta[name="adsense-config"]');
if(config){
 const {client,slots}=JSON.parse(config.content);
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
