import {mayPromote} from '../src/capabilities.js';
import {imageSitemap,verificationHead,notFound} from './growth-build.mjs';
import {BRAND} from '../src/brand.js';
import {logoMark,faviconSVG} from '../src/logo.js';
import {LANDINGS,LANDING_PATHS,landingText} from '../src/landings.js';
import {isTask} from '../src/task/registry.js';
import {homePage,taskPage} from './task-build.mjs';
import {mkdir,rm,cp,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {LOCALES,locationParts,t} from '../src/i18n.js';
import {INTENTS,intentFor,ROUTES} from '../src/intents.js';
import {toolContent,labels,footer} from '../src/content.js';
import {POLICY_ROUTES,policyContent,policies} from '../src/policies.js';
import {normalizeSiteURL,seoLinks,structuredData,pagePath,socialMetadata,navigationData} from '../src/seo.js';
import {configuration,adHead,headers} from './site-config.mjs';
import {serviceMeta,emitService,SERVICE_HEADERS} from './service-build.mjs';
import {STUDIO_PATH,studioPage} from './studio-build.mjs';
import {gamePageFor,gameLandingPage,gameHubPage,isClassicPath,gameSitemapPaths} from './game-landing-build.mjs';
import {gameHead} from './game-seo-build.mjs';
import {GAME_HUB_PATH} from '../src/game-seo.js';
export {ROUTES};
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
// The Studio app (/game/studio/) is an app shell, not an intent: no sitemap entry, noindex.
// /game/ is the hub of the game landing pages (tools/game-landing-build.mjs).
export const ALL_ROUTES=['',...ROUTES,...POLICY_ROUTES,STUDIO_PATH,GAME_HUB_PATH,...LOCALES.flatMap(l=>[l,...[...ROUTES,...POLICY_ROUTES,STUDIO_PATH,GAME_HUB_PATH].map(r=>`${l}/${r}`)])];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Localized static HTML remains meaningful before JavaScript runs. */
export function entry(html,route='',siteURL='',config={}){
 html=html.replaceAll('{{brand}}',escape(BRAND.name)).replaceAll('{{initial}}',escape(BRAND.name[0].toLowerCase())).replaceAll('{{logo}}',logoMark());
 siteURL=normalizeSiteURL(siteURL);
 const parts=locationParts('/'+route),locale=parts.locale||'en',id=intentFor(parts.path),intent=INTENTS[id];
 const depth=route.split('/').filter(Boolean).length,base='../'.repeat(depth)||'./';
 if(POLICY_ROUTES.includes(parts.path))return policyEntry(parts.path,locale,base,siteURL,config);
 if(parts.path===STUDIO_PATH)return studioPage({locale,base});
 // Game routes the Studio covers, game keyword landings and /game/: dark landing pages that open the Studio.
 const game=gamePageFor(parts.path);
 if(game){
  const prefix=parts.locale?parts.locale+'/':'',headHTML=gameHead(game,locale,siteURL,config);
  return game.kind==='hub'?gameHubPage({locale,prefix,base,headHTML}):gameLandingPage({game,locale,prefix,base,headHTML});
 }
 // A landing page (src/landings.js) is its base tool with its own copy and canonical URL.
 const land=landingText(parts.path,locale),landing=land?parts.path:'';
 const title=(land?.title||t(`intent.${id}.title`,{},locale))+' · '+BRAND.name,description=land?.description||t(`intent.${id}.description`,{},locale);
 // The home directory and migrated tools use the single-task UI (src/task); every other
 // route keeps the classic editor until its task page is a superset of that flow.
 if(!parts.path||isTask(id)){
  // <game route>/classic: the old Lab behind a Studio landing — reachable, never indexed.
  const classic=isClassicPath(parts.path)?'<meta data-classic-robots name="robots" content="noindex,follow">':'';
  const prefix=parts.locale?parts.locale+'/':'',headHTML=classic+head(landing||intent.path,locale,siteURL,config)+structuredData(id,locale,siteURL,landing)+socialMetadata(id,locale,siteURL,land?{title,description}:{})+navigationData(id,locale,siteURL,landing),contentHTML=toolContent(id,locale,landing);
  return parts.path?taskPage({id,locale,prefix,base,title,heading:land?.title||t(`intent.${id}.title`,{},locale),description,headHTML,contentHTML,landing}):homePage({locale,prefix,base,headHTML,contentHTML});
 }
 let out=html.replace('<base href="./">',`<base href="${base}">`).replace(/<html lang="[^"]*"/,`<html lang="${locale}"`);
 out=out.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`);
 out=out.replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}">`);
 out=out.replace(/<meta property="og:title"[^>]*>/,`<meta property="og:title" content="${escape(title)}">`).replace(/<meta property="og:description"[^>]*>/,`<meta property="og:description" content="${escape(description)}">`);
 out=out.replace(/<([a-z][\w-]*)([^>]*\bdata-i18n="([^"]+)"[^>]*)>[\s\S]*?<\/\1>/gi,(_,tag,attrs,key)=>`<${tag}${attrs}>${escape(t(key,{},locale))}</${tag}>`);
 for(const [data,attribute]of [['data-i18n-aria','aria-label'],['data-i18n-tip','data-tip'],['data-i18n-placeholder','placeholder']]){
  out=out.replace(new RegExp(`<[^>]*\\b${data}="([^"]+)"[^>]*>`,'g'),(tag,key)=>tag.replace(new RegExp(`${attribute}="[^"]*"`),`${attribute}="${escape(t(key,{},locale))}"`));
 }
 for(const [elementId,text]of [['editorTitle',land?.title||t(`intent.${id}.title`,{},locale)],['emptyTitle',land?.headline||t(`intent.${id}.headline`,{},locale)],['emptySubtitle',description],['pickLabel',t(intent.accept==='pdf'?'intent.pickPDF':intent.accept==='media'?'intent.pickMedia':intent.accept==='auto'?'shell.open':'intent.pick',{},locale)]]){
  out=out.replace(new RegExp(`(<[a-z][^>]*\\bid="${elementId}"[^>]*>)[\\s\\S]*?(<\\/[a-z][\\w-]*>)`),(whole,a,b)=>a+escape(text)+b);
 }
 out=out.replace('<option value="auto">Auto-detect</option>',`<option value="auto">${escape(t('language.auto',{},locale))}</option>`);
 out=out.replace('<!--site-content-->',toolContent(id,locale,landing));
 out=out.replace('</head>',head(landing||intent.path,locale,siteURL,config)+structuredData(id,locale,siteURL,landing)+socialMetadata(id,locale,siteURL,land?{title,description}:{})+navigationData(id,locale,siteURL,landing)+'\n</head>');
 return out;
}
function head(route,locale,siteURL,config){return `<meta name="site-url" content="${escape(siteURL)}">${config.preview?'<meta name="robots" content="noindex,nofollow">':!mayPromote(intentFor(route))?'<meta data-quality-robots name="robots" content="noindex,follow">':''}`+seoLinks(route,locale,siteURL)+verificationHead(config)+serviceMeta(config)+(config.webAnalytics?'<meta name="web-analytics" content="cloudflare">':'')+adHead(config);}
function policyEntry(route,locale,base,siteURL,config){
 const title=labels[locale][route]+' · '+BRAND.name,description=policies[locale][route][0][1];
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="content.css">${head(route,locale,siteURL,{...config,slots:{}})}${socialMetadata('home',locale,siteURL,{title,description})}<script type="module" src="src/policy-page.js"></script></head><body><header class="policy-header"><span class="brand policy-brand">${logoMark({size:28})}<strong>${escape(BRAND.name)}<span class="brand-dot">.</span></strong></span><nav class="policy-languages" aria-label="${escape(labels[locale].language)}">${LOCALES.map(l=>`<a href="${l}/${route}/" lang="${l}" ${l===locale?'aria-current="page"':''}>${{ko:'한국어',en:'English',ja:'日本語'}[l]}</a>`).join('')}</nav></header><main class="policy-main">${policyContent(route,locale,!!config.client,!!config.service,!!config.webAnalytics)}</main><div id="policyFooter">${footer(locale)}</div></body></html>`;
}
export function sitemap(siteURL,extra=[]){
 // Landing pages are listed only when their base tool is qualified for search.
 // Order: home, then the game pages (hub, Studio landings, game keyword pages), then everything else.
 const indexable=[...Object.entries(INTENTS).filter(([id])=>mayPromote(id)).map(([,i])=>i.path),...LANDING_PATHS.filter(p=>mayPromote(LANDINGS[p].intent))];
 const game=gameSitemapPaths().filter(p=>p===GAME_HUB_PATH||indexable.includes(p));
 const paths=[...new Set(['',...game,...indexable,...POLICY_ROUTES,...extra])].filter(p=>p!==''||indexable.includes(''));
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
 if(config.redirectTo){
  // Every path and query moves permanently to the same location on the new origin.
  await writeFile(path.join(dist,'_redirects'),`/* ${config.redirectTo}/:splat 301\n`);
  console.log(`Built redirect-only site → ${config.redirectTo}`);
  return;
 }
 for(const f of ['styles.css','experience.css','content.css','src','assets','ai-runtime'])await cp(path.join(ROOT,f),path.join(dist,f),{recursive:true});
 await writeFile(path.join(dist,'_headers'),headers(await readFile(path.join(ROOT,'_headers'),'utf8'),config));
 await writeFile(path.join(dist,'favicon.svg'),faviconSVG());
 const html=await readFile(path.join(ROOT,'index.html'),'utf8');
 for(const route of ALL_ROUTES){const dir=path.join(dist,route);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),entry(html,route,siteURL,config));}
 await writeFile(path.join(dist,'.nojekyll'),'');
 await writeFile(path.join(dist,'404.html'),notFound(siteURL));
 await writeFile(path.join(dist,'sitemap.xml'),sitemap(config.preview?'':siteURL,config.service?['pricing']:[]));
 await writeFile(path.join(dist,'sitemap-images.xml'),imageSitemap(config.preview?'':siteURL));
 if(config.indexNowKey)await writeFile(path.join(dist,config.indexNowKey+'.txt'),config.indexNowKey);
 await writeFile(path.join(dist,'robots.txt'),`User-agent: *\n${config.preview?'Disallow: /':'Allow: /'}\n${siteURL&&!config.preview?'Sitemap: '+new URL('sitemap.xml',siteURL).href+'\nSitemap: '+new URL('sitemap-images.xml',siteURL).href+'\n':''}`);
 if(config.verificationClient)await writeFile(path.join(dist,'ads.txt'),`google.com, ${config.verificationClient.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
 if(config.client){
  await cp(path.join(ROOT,'tools/ads-worker.mjs'),path.join(dist,'_worker.js'));
  await writeFile(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:['/src/*','/ai-runtime/*','/styles.css','/experience.css','/content.css','/favicon.svg','/robots.txt','/sitemap.xml','/ads.txt']},null,2));
 }
 if(config.service){await emitService(dist,config,head);await writeFile(path.join(dist,'_headers'),(await readFile(path.join(dist,'_headers'),'utf8')).replace(/\n*$/,'\n')+SERVICE_HEADERS);}
 console.log(`Built ${ALL_ROUTES.length} static entry pages → dist/`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
