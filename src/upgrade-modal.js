import {S,text,duration,priceText} from './service-content.js';
import {ensureStyles} from './service-ui.js';
import {track} from './analytics.js';
/** Shown when a Free heavy job is refused. It never navigates the current tab: "Upgrade"
 * opens pricing in a new tab, so the file, selection and settings in memory are kept. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function showLimit({resetAt,locale='en',pricing=null}){
 ensureStyles();
 const t=(k,v)=>esc(text(locale,k,v)),wait=duration(locale,Date.parse(resetAt)-Date.now());
 const dialog=document.createElement('dialog');dialog.className='service-dialog';dialog.id='upgradeDialog';
 dialog.setAttribute('aria-labelledby','upgradeTitle');
 dialog.innerHTML=`<h2 id="upgradeTitle">${t('limitTitle')}</h2><p>${t('limitBody',{time:wait})}</p><p class="keep-work">${t('keepWork')}</p>
<div class="pro-box"><strong>${t('proPitch')}${pricing?.amount?` · ${esc(priceText(pricing,locale))}`:''}</strong><ul>${(S[locale]||S.en).proBullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>
<div class="service-actions"><a class="primary" data-upgrade href="${locale}/pricing/" target="_blank" rel="noopener">${t('upgrade')}</a><button type="button" class="secondary" data-later>${t('later')}</button></div>`;
 document.body.append(dialog);
 track('upgrade_view',{plan:'free'});
 return new Promise(resolve=>{
  const close=()=>{if(dialog.open)dialog.close();};
  dialog.querySelector('[data-later]').addEventListener('click',close);
  dialog.querySelector('[data-upgrade]').addEventListener('click',()=>setTimeout(close,0));
  dialog.addEventListener('close',()=>{dialog.remove();resolve();},{once:true});
  dialog.showModal();
  dialog.querySelector('[data-later]').focus();
 });
}
