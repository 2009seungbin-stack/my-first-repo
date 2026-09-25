import {t} from '../i18n.js';
import {INTENTS} from '../intents.js';
import {SEARCH_TERMS} from '../search-terms.js';
import {SUGGEST,kindOf} from './registry.js';
import {text,toast,continueWith,onLocale,toolURL,pagePrefix,locale} from './shell.js';
import {stashFiles} from './handoff.js';
/** Home: the directory is server-rendered (tools/task-build.mjs) so it works without
 * JavaScript; this adds search, localisation on language switch and "drop a file, get the
 * right tools". Returns the intake function for dropped / picked / pasted files. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
let held=[];
function relabel(){
 for(const a of document.querySelectorAll('.tool-card[data-tool]')){
  const id=a.dataset.tool;a.href=toolURL(id);a.querySelector('b').textContent=t(`intent.${id}.title`);a.querySelector('small').textContent=t(`intent.${id}.description`);
  a.dataset.search=[t(`intent.${id}.title`),t(`intent.${id}.description`),...(SEARCH_TERMS[id]||[]),id,INTENTS[id].path].join(' ').toLowerCase();
 }
 for(const h of document.querySelectorAll('[data-cat]'))h.textContent=text('cat.'+h.dataset.cat);
 for(const a of document.querySelectorAll('[data-tool-link]'))a.href=toolURL(a.dataset.toolLink);
 for(const a of document.querySelectorAll('[data-hub-link]'))a.href=pagePrefix()+'game/'+(a.dataset.hubLink?'#hub-'+a.dataset.hubLink:'');
 // The product shots are captured per language (tools/home-screens.py): swap them with the copy.
 const l=locale(),shot=$('#heroShot');
 if(shot){shot.srcset=[1280,1600,2560].map(w=>`assets/home/shot-hero-${l}-${w}.webp ${w}w`).join(', ');shot.src=`assets/home/shot-hero-${l}-1600.webp`;shot.alt=text('gh.heroAlt');
  const crop=shot.parentElement.querySelector('source');if(crop)crop.srcset=[780,1040].map(w=>`assets/home/shot-hero-crop-${l}-${w}.webp ${w}w`).join(', ');}
 for(const img of document.querySelectorAll('img[data-shot]')){const n=img.dataset.shot;img.srcset=`assets/home/shot-${n}-${l}-1040.webp 1040w, assets/home/shot-${n}-${l}-1600.webp 1600w`;img.src=`assets/home/shot-${n}-${l}-1040.webp`;const cap=img.closest('figure')?.querySelector('figcaption');if(cap)img.alt=cap.textContent;}
 const demo=$('.gh-demo-stage');if(demo)demo.setAttribute('aria-label',text('gh.flow.demo'));
 const q=$('#toolQuery');if(q){q.placeholder=text('search');q.setAttribute('aria-label',text('searchLabel'));}
 filter();if(held.length)suggest(held);
}
function filter(){
 const words=($('#toolQuery')?.value||'').toLowerCase().split(/\s+/).filter(Boolean);let shown=0;
 for(const a of document.querySelectorAll('.tool-card[data-tool]')){const hit=words.every(w=>a.dataset.search.includes(w));a.hidden=!hit;if(hit)shown++;}
 for(const s of document.querySelectorAll('.directory section,.directory .gh-group'))s.hidden=!s.querySelector('.tool-card:not([hidden])');
 // folded groups (all game tools, other file tools) open by themselves when a search hits inside them
 for(const d of document.querySelectorAll('#directory details')){const hit=!!d.querySelector('.tool-card:not([hidden])');if(d.id==='file-tools')d.hidden=!hit;if(words.length&&hit)d.open=true;}
 const none=$('#noResult');if(none){none.hidden=shown>0;none.textContent=text('noResult');}
}
/** Sprite sheets, frames, GIFs, .aseprite files and atlas data open in the Studio (the product);
 * PDFs and video still get the file-tool suggestions. */
const isGameFile=f=>kindOf(f)==='image'||/\.(ase|aseprite|json|xml)$/i.test(f.name||'');
async function openInStudio(files){
 toast(text('gh.opening'));
 await stashFiles(files,{from:'home'});
 location.assign(pagePrefix()+'game/studio/?ws=sprite');
}
function suggest(files){
 if(files.length&&files.every(isGameFile))return void openInStudio(files);
 const kinds=[...new Set(files.map(kindOf))],bar=$('#suggest');
 if(kinds.includes('')&&kinds.length===1){toast(text('suggestUnknown'),{error:true});return;}
 if(kinds.filter(Boolean).length!==1){toast(text('suggestMixed'),{error:true});return;}
 held=files.filter(f=>kindOf(f));const kind=kinds.find(Boolean);
 bar.innerHTML=`<strong>${esc(text('suggest',{n:held.length}))}</strong><div class="suggest-tools">${SUGGEST[kind].map(id=>`<button type="button" class="chip" data-suggest="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}</div><button type="button" class="link" data-suggest-clear>${esc(text('clear'))}</button>`;
 bar.hidden=false;bar.querySelector('.chip')?.focus();
}
export function mount(){
 relabel();onLocale(relabel);
 $('#toolQuery')?.addEventListener('input',filter);
 $('#toolQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=document.querySelector('.tool-card:not([hidden])');if(first)location.assign(first.href);}});
 $('#suggest')?.addEventListener('click',e=>{
  const go=e.target.closest('[data-suggest]');if(go)return continueWith(go.dataset.suggest,held);
  if(e.target.closest('[data-suggest-clear]')){held=[];$('#suggest').hidden=true;}
 });
 return suggest;
}
