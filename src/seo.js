import {LOCALES,t} from './i18n.js';
import {INTENTS} from './intents.js';
import {labels} from './content.js';
import {esc} from './ui.js';

export function normalizeSiteURL(value){
 if(!value)return '';
 const u=new URL(value);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('SITE_URL must be an HTTP(S) base URL without credentials, query or fragment');
 u.pathname=u.pathname.replace(/\/+$/,'')+'/';return u.href;
}
export function pagePath(path,locale){return `${locale?locale+'/':''}${path?path+'/':''}`;}
export function seoLinks(path,locale,siteURL){
 if(!siteURL)return '';
 const href=l=>esc(new URL(pagePath(path,l),siteURL).href);
 return `<link data-site-seo rel="canonical" href="${href(locale)}"><meta data-site-seo property="og:url" content="${href(locale)}">`+LOCALES.map(l=>`<link data-site-seo rel="alternate" hreflang="${l}" href="${href(l)}">`).join('')+`<link data-site-seo rel="alternate" hreflang="x-default" href="${href(null)}">`;
}
export function structuredData(id,locale,siteURL){
 const app={'@context':'https://schema.org','@type':'WebApplication',name:`${t(`intent.${id}.title`,{},locale)} · FileForge`,description:t(`intent.${id}.description`,{},locale),applicationCategory:'UtilitiesApplication',operatingSystem:'Web browser',inLanguage:locale,browserRequirements:'JavaScript, Canvas and browser-supported file codecs'};
 if(siteURL)app.url=new URL(pagePath(INTENTS[id].path,locale),siteURL).href;
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(app).replaceAll('<','\\u003c')}</script>`;
}
export function updateSEO(id,locale,siteURL){
 document.querySelectorAll('[data-site-seo]').forEach(e=>e.remove());
 document.head.insertAdjacentHTML('beforeend',seoLinks(INTENTS[id].path,locale,siteURL)+structuredData(id,locale,siteURL));
 document.querySelectorAll('[data-ad-label]').forEach(e=>e.textContent=labels[locale].ad);
}
