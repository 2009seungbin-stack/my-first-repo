import {t} from '../i18n.js';
import {INTENTS} from '../intents.js';
import {SEARCH_TERMS} from '../search-terms.js';
import {SUGGEST,kindOf} from './registry.js';
import {text,toast,continueWith,onLocale,toolURL,pagePrefix,locale} from './shell.js';
import {stashFiles} from './handoff.js';
import {preflightDirectory} from '../preflight/directory.js';
import {rankTools,finderMove,finderWords,finderMarks,readToolPrefs,pushRecent,TOOL_PREF_KEY} from './home-finder.js';
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
 for(const a of document.querySelectorAll('[data-pc-tool]')){const l=locale()==='ko'?'ko':'en';a.href='/'+l+'/'+a.dataset.path+'/';a.querySelector('b').textContent=a.dataset[l==='ko'?'titleKo':'titleEn'];a.querySelector('small').textContent=l==='ko'?'국가별 가격과 실측 성능 비교':'Country prices and measured performance';a.dataset.search=[a.dataset.titleKo,a.dataset.titleEn,a.dataset.path,'gpu cpu 중고 시세 성능 가격 used price benchmark'].join(' ').toLowerCase();}
 for(const a of document.querySelectorAll('[data-preflight-link]')){const info=preflightDirectory(locale());a.href=pagePrefix()+'preflight/';a.querySelector('b').textContent=info.title;a.querySelector('small').textContent=info.description;a.dataset.search=info.search;}
 const pcHeading=document.querySelector('[data-pc-heading]');if(pcHeading)pcHeading.textContent=locale()==='ko'?'PC 도구':'PC tools';
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
 const dlg=$('#toolFinder');if(dlg){dlg.setAttribute('aria-label',text('gh.find.open'));const fq=$('#finderQuery');fq.placeholder=text('gh.find.hint');fq.setAttribute('aria-label',text('gh.find.open'));$('#finderList').setAttribute('aria-label',text('gh.find.list'));if(dlg.open)renderFinder();}
 renderRecent();
 filter();if(held.length)suggest(held);
}
function filter(){
 const words=($('#toolQuery')?.value||'').toLowerCase().split(/\s+/).filter(Boolean);let shown=0;
 for(const a of document.querySelectorAll('.tool-card[data-tool],.tool-card[data-pc-tool],.tool-card[data-preflight-link]')){const hit=words.every(w=>a.dataset.search.includes(w));a.hidden=!hit;if(hit)shown++;}
 for(const s of document.querySelectorAll('.directory section,.directory .gh-group'))s.hidden=!s.querySelector('.tool-card:not([hidden])');
 // folded groups (all game tools, other file tools) open by themselves when a search hits inside them
 for(const d of document.querySelectorAll('#directory details')){const hit=!!d.querySelector('.tool-card:not([hidden])');if(d.id==='file-tools')d.hidden=!hit;if(words.length&&hit)d.open=true;}
 const none=$('#noResult');if(none){none.hidden=shown>0;none.textContent=text('noResult');}
}
/** Favourites and the three most recent tools, from the local preference the tool kit already keeps
 * (tool ids only, never file names or contents). Opening a tool from this page adds it to "recent". */
const isTool=id=>!!INTENTS[id]&&id!=='home';
function toolPrefs(){try{return readToolPrefs(localStorage.getItem(TOOL_PREF_KEY),isTool);}catch{return {favorites:[],recent:[]};}}
function remember(id){if(!isTool(id))return;try{localStorage.setItem(TOOL_PREF_KEY,JSON.stringify(pushRecent(localStorage.getItem(TOOL_PREF_KEY),id)));}catch{/* storage blocked: nothing to remember */}}
function renderRecent(){
 const el=$('#homeRecent');if(!el)return;
 const {favorites,recent}=toolPrefs(),fav=favorites.slice(0,4),rec=recent.filter(id=>!fav.includes(id));
 const chips=(label,ids,star)=>ids.length?`<div><h3>${esc(label)}</h3><ul>${ids.map(id=>`<li><a class="gh-chip" data-tool-link="${id}" href="${esc(toolURL(id))}">${star?'<i aria-hidden="true">★</i>':''}${esc(t(`intent.${id}.title`))}</a></li>`).join('')}</ul></div>`:'';
 el.innerHTML=chips(t('kit.favorites'),fav,true)+chips(t('kit.recent'),rec,false);
 el.hidden=!fav.length&&!rec.length;el.setAttribute('aria-label',[fav.length&&t('kit.favorites'),rec.length&&t('kit.recent')].filter(Boolean).join(' · ')||t('kit.recent'));
}
/** The tool finder: a dialog with a combobox over every card in the directory (game, file, PC and
 * Preflight), ranked by src/task/home-finder.js. The cards are the data, so it always lists exactly
 * what the page links to, in the current language. */
let found=[],active=-1;
function finderEntries(){
 return [...document.querySelectorAll('#directory .tool-card')].map(a=>{const g=a.closest('.gh-group');
  return {id:a.dataset.tool||'',title:a.querySelector('b').textContent,desc:a.querySelector('small').textContent,href:a.href,search:a.dataset.search||'',group:g?.dataset.group==='more'?text('cat.game'):g?.querySelector('h3')?.textContent.trim()||''};});
}
function setActive(i,scroll=true){
 active=i;const q=$('#finderQuery');
 for(const [n,o] of [...document.querySelectorAll('#finderList [role=option]')].entries()){o.setAttribute('aria-selected',String(n===i));if(n===i&&scroll)o.scrollIntoView({block:'nearest'});}
 if(i>=0)q.setAttribute('aria-activedescendant','finderOpt'+i);else q.removeAttribute('aria-activedescendant');
}
function renderFinder(){
 const query=$('#finderQuery').value,all=finderEntries(),words=finderWords(query);found=rankTools(query,all);
 if(!query.trim()){ // nothing typed yet: favourites and recent tools first, then the overview
  const {favorites,recent}=toolPrefs(),mine=[...new Set([...recent,...favorites])].map(id=>all.find(e=>e.id===id)).filter(Boolean).slice(0,5).map(e=>({...e,group:t(favorites.includes(e.id)?'kit.favorites':'kit.recent')}));
  found=[...mine,...found.filter(e=>!mine.some(m=>m.id===e.id))];
 }
 $('#finderList').innerHTML=found.map((e,i)=>`<li role="presentation"><a role="option" id="finderOpt${i}" aria-selected="false" tabindex="-1" data-finder-tool="${esc(e.id)}" href="${esc(e.href)}"><span><b>${finderMarks(e.title,words).map(([part,hit])=>hit?`<mark>${esc(part)}</mark>`:esc(part)).join('')}</b><small>${esc(e.desc)}</small></span><em>${esc(e.group)}</em></a></li>`).join('');
 $('#finderStatus').textContent=!query.trim()?text('gh.find.each',{n:all.length}):found.length?text('gh.find.count',{n:found.length}):text('noResult');
 $('#finderList').scrollTop=0;setActive(found.length?0:-1,false);
}
function openFinder(){
 const dlg=$('#toolFinder');if(!dlg||dlg.open||!dlg.showModal)return false;
 $('#finderQuery').value='';dlg.showModal();renderFinder();$('#finderQuery').focus();return true;
}
function mountFinder(){
 const dlg=$('#toolFinder'),q=$('#finderQuery');if(!dlg||!dlg.showModal)return;
 for(const a of document.querySelectorAll('[data-finder-open]')){a.setAttribute('role','button');a.setAttribute('aria-haspopup','dialog');
  a.addEventListener('click',e=>{if(openFinder())e.preventDefault();});
  a.addEventListener('keydown',e=>{if(e.key===' '&&openFinder())e.preventDefault();});}
 q.addEventListener('input',renderFinder);
 q.addEventListener('keydown',e=>{
  if(e.isComposing||e.keyCode===229)return; // an IME is still composing Korean / Japanese text
  if(['ArrowDown','ArrowUp'].includes(e.key)||(['Home','End'].includes(e.key)&&e.ctrlKey)){e.preventDefault();setActive(finderMove(active,found.length,e.key));}
  else if(e.key==='Enter'&&found[active]){e.preventDefault();remember(found[active].id);location.assign(found[active].href);}
 });
 dlg.addEventListener('pointermove',e=>{const o=e.target.closest?.('[role=option]');if(o){const i=+o.id.slice(9);if(i!==active)setActive(i,false);}});
 dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-finder-close]'))dlg.close();});
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing||dlg.open)return;
  const typing=e.target.closest?.('input,textarea,select,[contenteditable=""],[contenteditable="true"]');
  if((e.key==='/'&&!typing&&!e.ctrlKey&&!e.metaKey&&!e.altKey)||(String(e.key).toLowerCase()==='k'&&(e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey)){if(openFinder())e.preventDefault();}
 });
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
/** Workflow rows, the engine box and the index heading ease in as they are scrolled to. Armed by the
 * first scroll and only for blocks still below the viewport then, so nothing is ever hidden on a
 * page that was not scrolled (no JavaScript, print, full-page captures), and never under reduced motion. */
function mountReveal(){
 if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const io=new IntersectionObserver(list=>{for(const e of list)if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}},{rootMargin:'0px 0px -6% 0px'});
 addEventListener('scroll',()=>{for(const el of document.querySelectorAll('.gh-row,.gh-engines-box,.gh-index-head'))if(el.getBoundingClientRect().top>innerHeight){el.classList.add('gh-reveal');io.observe(el);}},{once:true,passive:true});
 addEventListener('beforeprint',()=>{for(const el of document.querySelectorAll('.gh-reveal'))el.classList.add('is-in');});
}
export function mount(){
 relabel();onLocale(relabel);
 mountFinder();mountReveal();
 // a tool opened from the directory, the Lab cards, the chips or the finder becomes a recent tool
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[data-tool],a[data-tool-link],a[data-finder-tool]');if(a)remember(a.dataset.tool||a.dataset.toolLink||a.dataset.finderTool);},true);
 addEventListener('pageshow',e=>{if(e.persisted)renderRecent();});
 $('#toolQuery')?.addEventListener('input',filter);
 $('#toolQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=document.querySelector('.tool-card:not([hidden])');if(first)location.assign(first.href);}});
 $('#suggest')?.addEventListener('click',e=>{
  const go=e.target.closest('[data-suggest]');if(go)return continueWith(go.dataset.suggest,held);
  if(e.target.closest('[data-suggest-clear]')){held=[];$('#suggest').hidden=true;}
 });
 return suggest;
}
