import {mkdir,rm,cp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {LOCALES} from '../src/i18n.js';
import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {footer} from '../src/content.js';
import {socialMetadata} from '../src/seo.js';
import {SERVICE_ROUTES,text,pricingHTML,accountHTML} from '../src/service-content.js';
/** Build outputs that exist only when SERVICE_API=on: the /api/v1 Worker, its routes,
 * the pricing/account pages and the Turnstile frame. A build without the flag is the
 * unchanged static site. */
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Public, non-secret configuration read by src/entitlement.js. */
export function serviceMeta(config){
 if(!config.service)return '';
 return `<meta name="nerulio-service" content="${escape(JSON.stringify({api:'api/v1/',pricing:config.pricing,freeDailyJobs:config.freeDailyJobs,freeDailyStudio:config.freeDailyStudio}))}">`;
}
/** Static assets that must never wake the Worker, even in advertising builds. */
export const STATIC_EXCLUDES=Object.freeze(['/src/*','/assets/*','/ai-runtime/*','/verify/*','/styles.css','/experience.css','/content.css','/favicon.svg','/robots.txt','/sitemap.xml','/sitemap-game.xml','/sitemap-guides.xml','/sitemap-tools.xml','/sitemap-images.xml','/ads.txt']);
export function serviceRoutes(config){
 // Without ads only /api/* is dynamic. With ads, HTML also needs a per-response nonce.
 // /_worker.js/* is routed only so the Worker can refuse to serve its own source.
 return config.client?{version:1,include:['/*'],exclude:[...STATIC_EXCLUDES]}:{version:1,include:['/api/*','/_worker.js/*'],exclude:[]};
}
/** Appended after the site-wide block. The Turnstile frame needs its own CSP: it loads
 * challenges.cloudflare.com and may be framed by our own pages only. */
export const SERVICE_HEADERS=`/verify/*
  ! Content-Security-Policy
  Content-Security-Policy: default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'
  X-Robots-Tag: noindex, nofollow
/account/*
  X-Robots-Tag: noindex, nofollow
/:lang/account/*
  X-Robots-Tag: noindex, nofollow
`;
function servicePage(route,locale,base,siteURL,config,head){
 const title=text(locale,route)+' · '+BRAND.name,description=route==='pricing'?text(locale,'pricingLead'):text(locale,'signedOutLead');
 const body=route==='pricing'?pricingHTML(locale,config):accountHTML(locale);
 const robots=route==='account'&&!config.preview?'<meta name="robots" content="noindex,nofollow">':'';
 // No advertising on account pages: head() receives a config without an ad client.
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="content.css"><link rel="stylesheet" href="src/service.css">${robots}${head(route,locale,siteURL,{...config,client:'',slots:{}})}${socialMetadata('home',locale,siteURL,{title,description})}<script type="module" src="src/${route}-page.js"></script></head><body class="service-page"><header class="policy-header"><a class="brand policy-brand" href="${locale}/">${logoMark({size:28})}<strong>${escape(BRAND.name)}<span class="brand-dot">.</span></strong></a><nav class="policy-languages" aria-label="Language">${LOCALES.map(l=>`<a href="${l}/${route}/" lang="${l}" ${l===locale?'aria-current="page"':''}>${{ko:'한국어',en:'English',ja:'日本語'}[l]}</a>`).join('')}</nav></header><main class="policy-main service-main" data-route="${route}">${body}</main><div id="policyFooter">${footer(locale)}</div></body></html>`;
}
const VERIFY=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Verification</title><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center;padding:4px}</style><script type="module" src="../src/verify-page.js"></script></head><body><div id="turnstile"></div></body></html>`;
export async function emitService(dist,config,head){
 if(!config.service)return;
 for(const route of SERVICE_ROUTES)for(const locale of [null,...LOCALES]){
  const rel=locale?`${locale}/${route}`:route,dir=path.join(dist,rel);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),servicePage(route,locale||'en',locale?'../../':'../',config.siteURL,config,head));
 }
 await mkdir(path.join(dist,'verify'),{recursive:true});await writeFile(path.join(dist,'verify','index.html'),VERIFY);
 // Pages advanced mode: a _worker.js directory whose index.js is the entry module.
 // Replaces the ads-only single-file worker; it keeps the same nonce CSP for ad HTML.
 const root=new URL('../',import.meta.url),worker=path.join(dist,'_worker.js');
 await rm(worker,{recursive:true,force:true});
 await cp(new URL('server/',root),path.join(worker,'server'),{recursive:true});
 await mkdir(path.join(worker,'src'),{recursive:true});await cp(new URL('src/quota.js',root),path.join(worker,'src','quota.js'));
 await mkdir(path.join(worker,'tools'),{recursive:true});await cp(new URL('tools/ads-worker.mjs',root),path.join(worker,'tools','ads-worker.mjs'));
 await writeFile(path.join(worker,'server','build-info.js'),`export default Object.freeze(${JSON.stringify({service:true,adsHtml:!!config.client,preview:!!config.preview,siteURL:config.siteURL||''})});\n`);
 await writeFile(path.join(worker,'index.js'),"export {default} from './server/index.js';\n");
 await writeFile(path.join(dist,'_routes.json'),JSON.stringify(serviceRoutes(config),null,2));
}
