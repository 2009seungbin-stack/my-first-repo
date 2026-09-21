import {CAPABILITIES,mayPromote} from './capabilities.js';
import {BRAND} from './brand.js';
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
 const app={'@context':'https://schema.org','@type':'WebApplication',name:`${t(`intent.${id}.title`,{},locale)} · ${BRAND.name}`,description:t(`intent.${id}.description`,{},locale),featureList:[CAPABILITIES[id].engine,`Maturity: ${CAPABILITIES[id].maturity}`],applicationCategory:'UtilitiesApplication',operatingSystem:'Web browser',inLanguage:locale,browserRequirements:'JavaScript, Canvas and browser-supported file codecs'};
 if(siteURL)app.url=new URL(pagePath(INTENTS[id].path,locale),siteURL).href;
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(app).replaceAll('<','\\u003c')}</script>`;
}
export function socialMetadata(id,locale,siteURL,overrides={}){
 const title=overrides.title||t(`intent.${id}.title`,{},locale)+' · '+BRAND.name,description=overrides.description||t(`intent.${id}.description`,{},locale);
 const image=siteURL?new URL(`assets/social/${locale}-${id}.png`,siteURL).href:'';
 return `<meta data-site-seo property="og:type" content="website"><meta data-site-seo property="og:site_name" content="${esc(BRAND.name)}"><meta data-site-seo property="og:locale" content="${{en:'en_US',ko:'ko_KR',ja:'ja_JP'}[locale]}"><meta data-site-seo name="twitter:card" content="summary_large_image"><meta data-site-seo name="twitter:title" content="${esc(title)}"><meta data-site-seo name="twitter:description" content="${esc(description)}">`+(image?`<meta data-site-seo property="og:image" content="${esc(image)}"><meta data-site-seo property="og:image:width" content="1200"><meta data-site-seo property="og:image:height" content="630"><meta data-site-seo property="og:image:alt" content="${esc(title)}"><meta data-site-seo name="twitter:image" content="${esc(image)}">`:'');
}
export function navigationData(id,locale,siteURL){
 if(!siteURL||id==='home')return '';
 const data={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:BRAND.name,item:new URL(pagePath('',locale),siteURL).href},{'@type':'ListItem',position:2,name:t(`intent.${id}.title`,{},locale),item:new URL(pagePath(INTENTS[id].path,locale),siteURL).href}]};
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;
}
export function updateSEO(id,locale,siteURL){
 document.querySelectorAll('[data-site-seo],[data-quality-robots]').forEach(e=>e.remove());
 document.head.insertAdjacentHTML('beforeend',(!mayPromote(id)?'<meta data-quality-robots name="robots" content="noindex,follow">':'')+seoLinks(INTENTS[id].path,locale,siteURL)+structuredData(id,locale,siteURL)+socialMetadata(id,locale,siteURL)+navigationData(id,locale,siteURL));
 document.querySelectorAll('[data-ad-label]').forEach(e=>e.textContent=labels[locale].ad);
}
