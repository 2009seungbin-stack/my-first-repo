import {getLocale,setLocale,localeFromEnvironment,locationParts,savePreference,LANGUAGE_NAMES,LOCALES} from './i18n.js';
import {policyContent,footer,policies} from './policies.js?v=20261115-policy-contents';
import {labels} from './content.js';
import {seoLinks} from './seo.js';
import {BRAND} from './brand.js';
const root=new URL('../',import.meta.url),page=locationParts(location.pathname,root.pathname).path;
let storage;try{storage=localStorage;}catch{}
const url=new URL(location.href);
setLocale(localeFromEnvironment(url,root,{storage,languages:navigator.languages}));
function render(){
 const locale=getLocale();document.documentElement.lang=locale;
 document.title=labels[locale][page]+' · '+BRAND.name;
 for(const selector of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(selector).content=policies[locale][page][0][1];
 document.querySelector('meta[property="og:title"]').content=document.title;
 document.querySelector('main').innerHTML=policyContent(page,locale,!!document.querySelector('meta[name="adsense-config"]'),/** @type {HTMLElement} */(document.querySelector('main')).dataset.service==='accounts'?'accounts':!!document.querySelector('meta[name="nerulio-service"]'),!!document.querySelector('meta[name="web-analytics"]'),!!document.querySelector('script[src="/src/hit.js"]'),!!document.querySelector('meta[name="nerulio-portal"]'));
 document.querySelectorAll('[data-policy-print]').forEach(b=>{/** @type {HTMLElement} */(b).hidden=false;});
 document.getElementById('policyFooter').innerHTML=footer(locale);
 const nav=document.querySelector('.policy-languages');nav.setAttribute('aria-label',labels[locale].language);
 nav.innerHTML=LOCALES.map(l=>`<a href="${l}/${page}/" lang="${l}" ${l===locale?'aria-current="page"':''}>${LANGUAGE_NAMES[l]}</a>`).join('');
 document.querySelectorAll('[data-site-seo]').forEach(e=>e.remove());
 document.head.insertAdjacentHTML('beforeend',seoLinks(page,locale,document.querySelector('meta[name="site-url"]')?.content||''));
}
document.querySelector('.policy-languages').addEventListener('click',e=>{
 const a=e.target.closest('a');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
 e.preventDefault();setLocale(a.lang);savePreference(a.lang,storage);const next=new URL(a.href);next.search=url.search;next.searchParams.delete('lang');history.replaceState({},'',next);render();
});
/** Scrolls to a contents target and moves keyboard focus there; false when the id is not on this page. */
function reveal(id,smooth=false){
 const target=id&&document.getElementById(id);if(!target)return false;
 target.scrollIntoView({behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'auto',block:'start'});
 target.focus({preventScroll:true});return true;
}
// The page sets <base>, so in-page links carry the full route; handle them here without a reload.
document.querySelector('main').addEventListener('click',e=>{
 const el=/** @type {Element} */(e.target);
 if(el.closest('[data-policy-print]')){window.print();return;}
 const a=/** @type {HTMLAnchorElement|null} */(el.closest('a[data-policy-anchor]'));if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
 const hash=new URL(a.href).hash;if(!reveal(decodeURIComponent(hash.slice(1)),true))return;
 e.preventDefault();history.replaceState(history.state,'',location.pathname+location.search+hash);
});
render();
if(location.hash)reveal(decodeURIComponent(location.hash.slice(1)));
