import {mkdir,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LOCALES,locationParts,t} from '../src/i18n.js';
import {INTENTS,intentFor,ROUTES} from '../src/intents.js';
import {toolContent,labels,footer} from '../src/content.js';
import {POLICY_ROUTES,policyContent,policies} from '../src/policies.js';
import {normalizeSiteURL,seoLinks,structuredData,pagePath} from '../src/seo.js';
import {configuration,adHead,headers} from './site-config.mjs';
export {ROUTES};
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const ALL_ROUTES=['',...ROUTES,...POLICY_ROUTES,...LOCALES.flatMap(l=>[l,...[...ROUTES,...POLICY_ROUTES].map(r=>`${l}/${r}`)])];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Localized static HTML remains meaningful before JavaScript runs. */
export function entry(html,route='',siteURL='',config={}){
 siteURL=normalizeSiteURL(siteURL);
 const parts=locationParts('/'+route),locale=parts.locale||'en',id=intentFor(parts.path),intent=INTENTS[id];
 const depth=route.split('/').filter(Boolean).length,base='../'.repeat(depth)||'./';
 if(POLICY_ROUTES.includes(parts.path))return policyEntry(parts.path,locale,base,siteURL,config);
 const title=t(`intent.${id}.title`,{},locale)+' · FileForge',description=t(`intent.${id}.description`,{},locale);
 let out=html.replace('<base href="./">',`<base href="${base}">`).replace(/<html lang="[^"]*"/,`<html lang="${locale}"`);
 out=out.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`);
 out=out.replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
 out=out.replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${escape(title)}">`).replace(/<meta property="og:description"[^>]*>/,`<meta property="og:description" content="${escape(description)}">`);
 out=out.replace(/<([a-z][\w-]*)([^>]*\bdata-i18n="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/gi,(_,tag,attrs,key)=>`<${tag}${attrs}>${escape(t(key,{},locale))}</${tag}>`);
 for(const [data,attribute]of [['data-i18n-aria','aria-label'],['data-i18n-tip','data-tip'],['data-i18n-placeholder','placeholder']]){
  out=out.replace(new RegExp(`<[^>]*\\b${data}="([^"]+)"[^>]*>`,'g'),(tag,key)=>tag.replace(new RegExp(`${attribute}="[^"]*"`),`${attribute}="${escape(t(key,{},locale))}"`));
 }
 for(const [elementId,key]of [['editorTitle',`intent.${id}.title`],['emptyTitle',`intent.${id}.headline`],['emptySubtitle',`intent.${id}.description`],['pickLabel',intent.accept==='pdf'?'intent.pickPDF':intent.accept==='media'?'intent.pickMedia':intent.accept==='auto'?'shell.open':'intent.pick']]){
  out=out.replace(new RegExp(`(<[a-z][^>]*\\bid="${elementId}"[^>]*>)[\\s\\S]*?(<\\/[a-z][\\w-]*>)`),(whole,a,b)=>a+escape(t(key,{},locale))+b);
 }
 out=out.replace('<option value="auto">Auto-detect</option>',`<option value="auto">${escape(t('language.auto',{},locale))}</option>`);
 out=out.replace('<!--site-content-->',toolContent(id,locale));
 out=out.replace('</head>',head(intent.path,locale,siteURL,config)+structuredData(id,locale,siteURL)+'\n</head>');
 return out;
}
function head(route,locale,siteURL,config){return `<meta name="site-url" content="${escape(siteURL)}">${config.preview?'<meta name="robots" content="noindex,nofollow">':''}`+seoLinks(route,locale,siteURL)+adHead(config);}
function policyEntry(route,locale,base,siteURL,config){
 const title=labels[locale][route]+' · FileForge',description=policies[locale][route][0][1];
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="content.css">${head(route,locale,siteURL,{...config,slots:{}})}<script type="module" src="src/policy-page.js"></script></head><body><header class="policy-header"><strong>FileForge.</strong><nav class="policy-languages" aria-label="${escape(labels[locale].language)}">${LOCALES.map(l=>`<a href="${l}/${route}/" lang="${l}" ${l===locale?'aria-current="page"':''}>${{ko:'한국어',en:'English',ja:'日本語'}[l]}</a>`).join('')}</nav></header><main class="policy-main">${policyContent(route,locale,!!config.client)}</main><div id="policyFooter">${footer(locale)}</div></body></html>`;
}
export function sitemap(siteURL){
 const paths=[...Object.values(INTENTS).map(i=>i.path),...POLICY_ROUTES];
 const urls=siteURL?paths.flatMap(p=>LOCALES.map(l=>`<url><loc>${escape(new URL(pagePath(p,l),siteURL).href)}</loc>${[...LOCALES,null].map(a=>`<xhtml:link rel="alternate" hreflang="${a||'x-default'}" href="${escape(new URL(pagePath(p,a),siteURL).href)}"/>`).join('')}</url>`)).join(''):'';
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}
export async function build(options={}){
 const env={...(options.env||process.env)};
 if(options.siteURL!==undefined)env.SITE_URL=options.siteURL;
 const config=configuration(env);
 const {siteURL}=config,dist=path.resolve(options.outDir||path.join(ROOT,'dist'));
 // Only clear the known output tree; custom test outputs must be named dist too.
 if(path.basename(dist)!=='dist'||dist===path.resolve(ROOT))throw Error('Output directory must be a dedicated dist directory');
 await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
 for(const f of ['styles.css','experience.css','content.css','favicon.svg','src'])await cp(path.join(ROOT,f),path.join(dist,f),{recursive:true});
 await writeFile(path.join(dist,'_headers'),headers(await readFile(path.join(ROOT,'_headers'),'utf8'),config));
 const html=await readFile(path.join(ROOT,'index.html'),'utf8');
 for(const route of ALL_ROUTES){const dir=path.join(dist,route);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),entry(html,route,siteURL,config));}
 await writeFile(path.join(dist,'.nojekyll'),'');
 await writeFile(path.join(dist,'404.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>FileForge · Not found</title></head><body><h1>404 · Page not found</h1><p>Check the address.</p><a href="/en/">Open FileForge</a><p lang="ko">페이지를 찾을 수 없습니다. <a href="/ko/">홈으로</a></p><p lang="ja">ページが見つかりません。<a href="/ja/">ホームへ</a></p></body></html>');
 await writeFile(path.join(dist,'sitemap.xml'),sitemap(config.preview?'':siteURL));
 await writeFile(path.join(dist,'robots.txt'),`User-agent: *\n${config.preview?'Disallow: /':'Allow: /'}\n${siteURL&&!config.preview?'Sitemap: '+new URL('sitemap.xml',siteURL).href+'\n':''}`);
 if(config.verificationClient)await writeFile(path.join(dist,'ads.txt'),`google.com, ${config.verificationClient.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
 if(config.client){
  await cp(path.join(ROOT,'tools/ads-worker.mjs'),path.join(dist,'_worker.js'));
  await writeFile(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:['/src/*','/styles.css','/experience.css','/content.css','/favicon.svg','/robots.txt','/sitemap.xml','/ads.txt']},null,2));
 }
 console.log(`Built ${ALL_ROUTES.length} static entry pages → dist/`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
