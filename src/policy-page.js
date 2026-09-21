import {getLocale,setLocale,localeFromEnvironment,locationParts,savePreference,LANGUAGE_NAMES,LOCALES} from './i18n.js';
import {policyContent,footer,policies} from './policies.js';
import {labels} from './content.js';
import {seoLinks} from './seo.js';
const root=new URL('../',import.meta.url),page=locationParts(location.pathname,root.pathname).path;
let storage;try{storage=localStorage;}catch{}
const url=new URL(location.href);
setLocale(localeFromEnvironment(url,root,{storage,languages:navigator.languages}));
function render(){
 const locale=getLocale();document.documentElement.lang=locale;
 document.title=labels[locale][page]+' · FileForge';
 for(const selector of ['meta[name="description"]','meta[property="og:description"]'])document.querySelector(selector).content=policies[locale][page][0][1];
 document.querySelector('meta[property="og:title"]').content=document.title;
 document.querySelector('main').innerHTML=policyContent(page,locale,!!document.querySelector('meta[name="adsense-config"]'),!!document.querySelector('meta[name="nerulio-service"]'));
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
render();
