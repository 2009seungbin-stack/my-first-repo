import {toolContent,labels} from './content.js';
import {updateSEO} from './seo.js';
// Re-render only the reading area. Editor files, settings and result objects stay intact.
export function updateSiteContent(id,locale){
 const host=document.getElementById('siteContent');if(!host)return;
 const key=`${id}:${locale}`;if(host.dataset.rendered===key)return;
 const next=document.createElement('template');next.innerHTML=toolContent(id,locale);
 // Keep ad iframes attached: even moving the SAME iframe node can reload it.
 // Replace only editorial siblings, never the reading container or an ad slot.
 const regions=['.related-tools','.reading-content > article','.faq','.site-footer'];
 if(regions.every(selector=>host.querySelector(selector))){
  for(const selector of regions)host.querySelector(selector).replaceWith(next.content.querySelector(selector));
 }else host.replaceChildren(next.content);
 host.dataset.rendered=key;
 for(const label of host.querySelectorAll('[data-ad-label]'))label.textContent=labels[locale].ad;
 updateSEO(id,locale,document.querySelector('meta[name="site-url"]')?.content||'');
}
