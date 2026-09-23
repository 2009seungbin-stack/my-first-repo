/** Guides (/guides/…): the page is complete without this script. It adds the language switch
 * (a saved preference, like the rest of the site), sends the language-neutral URL to the
 * visitor's language, and puts a copy button on code blocks. */
import {LOCALES,readPreference,savePreference,normalizeLocale} from './i18n.js';
let storage;try{storage=localStorage;}catch{}
const root=new URL('../',import.meta.url);
const select=document.getElementById('guideLanguage');
if(document.body.hasAttribute('data-neutral')){
 // The neutral URL carries the English copy (x-default); a visitor who chose or reads
 // Korean or Japanese goes to that version. Crawlers keep the English page.
 const want=readPreference(storage)||(navigator.languages||[]).map(normalizeLocale).find(Boolean);
 if(want&&want!=='en'&&LOCALES.includes(want)){
  const route=select?.selectedOptions[0]?.dataset.href?.replace(/^[a-z]{2}\//,'');
  if(route)location.replace(new URL(want+'/'+route,root).href+location.hash);
 }
}
select?.addEventListener('change',()=>{
 const option=select.selectedOptions[0];savePreference(option.value,storage);
 location.assign(new URL(option.dataset.href,root).href+location.hash);
});
const copyLabel={ko:['복사','복사됨'],en:['Copy','Copied'],ja:['コピー','コピーしました']}[document.documentElement.lang]||['Copy','Copied'];
for(const box of document.querySelectorAll('.guide-code')){
 const button=document.createElement('button');button.type='button';button.className='guide-copy';button.textContent=copyLabel[0];
 button.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(box.querySelector('code').textContent);button.textContent=copyLabel[1];setTimeout(()=>{button.textContent=copyLabel[0];},1600);}catch{}
 });
 box.append(button);
}
