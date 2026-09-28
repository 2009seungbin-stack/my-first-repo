import {mayPromote} from '../src/capabilities.js';
import {verificationHead,notFound} from './growth-build.mjs';
// Sitemap index + per-area sitemaps with hreflang and real lastmod (tools/sitemaps.mjs, tools/lastmod.mjs).
import {sitemapFiles,allPagesSitemap,SITEMAP_INDEX} from './sitemaps.mjs';import {lastmodResolver,pageHashes} from './lastmod.mjs';
import {BRAND} from '../src/brand.js';
import {logoMark,faviconSVG} from '../src/logo.js';
import {LANDINGS,LANDING_PATHS,landingText} from '../src/landings.js';
import {isTask} from '../src/task/registry.js';
import {homePage,taskPage} from './task-build.mjs';
import {languageEntryPage} from './language-entry-build.mjs';
import {DEPTH} from '../src/seo-depth/index.js';
import {answerHTML,depthSlot} from '../src/seo-depth/render.js';
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
import {gamePageFor,gameLandingPage,gameHubPage,isClassicPath,gameSitemapPaths,resolveLink} from './game-landing-build.mjs';
import {gameHead} from './game-seo-build.mjs';
import {GAME_HUB_PATH} from '../src/game-seo.js';
import {AUDIO_LAB_PATH,audioLabPage} from './audio-lab-build.mjs';
export {ROUTES};
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
// The Studio app (/game/studio/) is an app shell, not an intent: no sitemap entry, noindex.
// /game/ is the hub of the game landing pages (tools/game-landing-build.mjs).
export const ALL_ROUTES=['',...ROUTES,...POLICY_ROUTES,STUDIO_PATH,GAME_HUB_PATH,...LOCALES.flatMap(l=>[l,...[...ROUTES,...POLICY_ROUTES,STUDIO_PATH,GAME_HUB_PATH,AUDIO_LAB_PATH].map(r=>`${l}/${r}`)])];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Cloudflare Email Address Obfuscation (on for the nerulio.com zone) rewrites anything shaped like
 * an address at the edge: "hero@2x.json" was served as "[email protected]" with a /cdn-cgi link that 404s.
 * The site publishes no e-mail addresses, so every page opts out. Applied after entry(), so the
 * content hashes behind <lastmod> (tools/lastmod.mjs) are unchanged. tools/live-check.mjs verifies it live. */
export const noEmailObfuscation=html=>html.replace(/(<html\b[^>]*>)/i,'$1<!--email_off-->').replace(/\s*$/,'<!--/email_off-->\n');
/** Intent content of a file-tool page (src/seo-depth): static HTML only, marked [data-sd] with its
 * language. The browser re-renders #siteContent on a language switch but leaves .sd-depth alone
 * (src/site-content.js hides it when the language shown differs), so the content never ships as JS. */
export function toolDepth(key,locale){
 const d=DEPTH[key]?.[locale];if(!d)return {answer:'',sections:''};
 const o={prefix:`${locale}/`,resolve:resolveLink},html=['lead','after-how','after-table','end'].flatMap(s=>depthSlot(s,d,locale,o,'sd-block')).map(x=>x[2]).join('');
 return {answer:answerHTML(d,o).replace('<p class="sd-answer"',`<p class="sd-answer" lang="${locale}" data-sd`),sections:html?`<div class="sd-depth" lang="${locale}" data-sd>${html}</div>`:''};
}
const withDepth=(contentHTML,sections)=>sections?contentHTML.replace('<article>',sections+'<article>'):contentHTML;
/** Icons every page links, for browsers and for the favicon Google shows next to search results
 * (a crawlable square bitmap, a multiple of 48 px, plus /favicon.ico at the root). The SVG stays for
 * browsers that prefer it; PNG/ICO files are rendered from the same logo (assets/brand/). */
export const ICON_LINKS='<link rel="icon" href="favicon.ico" sizes="48x48"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="icon" type="image/png" sizes="96x96" href="assets/brand/favicon-96.png"><link rel="icon" type="image/png" sizes="192x192" href="assets/brand/favicon-192.png"><link rel="apple-touch-icon" href="apple-touch-icon.png">';
export const withIcons=html=>html.replace(/<link rel="icon"(?: type="image\/svg\+xml")? href="favicon\.svg">/,ICON_LINKS);
/** Localized static HTML remains meaningful before JavaScript runs. */
export function entry(html,route='',siteURL='',config={}){
 html=html.replaceAll('{{brand}}',escape(BRAND.name)).replaceAll('{{initial}}',escape(BRAND.name[0].toLowerCase())).replaceAll('{{logo}}',logoMark());
 siteURL=normalizeSiteURL(siteURL);
 const parts=locationParts('/'+route),locale=parts.locale||'en',id=intentFor(parts.path),intent=INTENTS[id];
 const depth=route.split('/').filter(Boolean).length,base='../'.repeat(depth)||'./';
 if(POLICY_ROUTES.includes(parts.path))return policyEntry(parts.path,locale,base,siteURL,config);
 if(parts.path===STUDIO_PATH)return studioPage({locale,base,config});
 if(parts.path===AUDIO_LAB_PATH)return audioLabPage({locale,base,siteURL,preview:config.preview});
 // Game routes the Studio covers, game keyword landings and /game/: dark landing pages that open the Studio.
 const game=gamePageFor(parts.path);
 if(game){
  // adHead: in-content ad positions on the landings and the hub (markers in [data-ad-host]; docs/ADS.md).
  const prefix=parts.locale?parts.locale+'/':'',headHTML=gameHead(game,locale,siteURL,config)+adHead(config);
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
  // The home page at / adapts to the visitor's language: its own canonical and the x-default (src/seo.js).
  const neutralHome=!parts.locale&&!parts.path;
  const prefix=parts.locale?parts.locale+'/':'',headHTML=classic+head(landing||intent.path,neutralHome?null:locale,siteURL,neutralHome?{...config,client:''}:config)+structuredData(id,locale,siteURL,landing,neutralHome)+socialMetadata(id,locale,siteURL,land?{title,description}:{})+navigationData(id,locale,siteURL,landing),contentHTML=toolContent(id,locale,landing);
  // / is the language entry (tools/language-entry-build.mjs), not a second copy of the English home.
  // No AdSense loader there (client:'' above): it is a redirect page without content of its own.
  if(neutralHome)return languageEntryPage({base,headHTML});
  const dep=toolDepth(landing||intent.path,locale);
  return parts.path?taskPage({id,locale,prefix,base,title,heading:land?.title||t(`intent.${id}.title`,{},locale),description,headHTML,contentHTML:withDepth(contentHTML,dep.sections),landing,answer:dep.answer}):homePage({locale,prefix,base,headHTML,contentHTML});
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
 const dep=toolDepth(landing||intent.path,locale);
 out=out.replace('<!--site-content-->',withDepth(toolContent(id,locale,landing),dep.answer+dep.sections));
 out=out.replace('</head>',head(landing||intent.path,locale,siteURL,config)+structuredData(id,locale,siteURL,landing)+socialMetadata(id,locale,siteURL,land?{title,description}:{})+navigationData(id,locale,siteURL,landing)+'\n</head>');
 return out;
}
function head(route,locale,siteURL,config){return `<meta name="site-url" content="${escape(siteURL)}">${config.preview?'<meta name="robots" content="noindex,nofollow">':!mayPromote(intentFor(route))?'<meta data-quality-robots name="robots" content="noindex,follow">':''}`+seoLinks(route,locale,siteURL)+verificationHead(config)+serviceMeta(config)+(config.webAnalytics?'<meta name="web-analytics" content="cloudflare">':'')+adHead(config);}
function policyEntry(route,locale,base,siteURL,config){
 const title=labels[locale][route]+' · '+BRAND.name,description=policies[locale][route][0][1];
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><link rel="icon" href="favicon.svg"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="content.css">${head(route,locale,siteURL,{...config,slots:{}})}${socialMetadata('home',locale,siteURL,{title,description})}<script type="module" src="src/policy-page.js"></script></head><body><header class="policy-header"><span class="brand policy-brand">${logoMark({size:28})}<strong>${escape(BRAND.name)}<span class="brand-dot">.</span></strong></span><nav class="policy-languages" aria-label="${escape(labels[locale].language)}">${LOCALES.map(l=>`<a href="${l}/${route}/" lang="${l}" ${l===locale?'aria-current="page"':''}>${{ko:'한국어',en:'English',ja:'日本語'}[l]}</a>`).join('')}</nav></header><main class="policy-main">${policyContent(route,locale,!!config.client,!!config.service,!!config.webAnalytics)}</main><div id="policyFooter">${footer(locale)}</div></body></html>`;
}
/** Every indexable page URL in one urlset: home, game pages, guides, then the file tools (tests,
 * IndexNow). The published sitemap.xml is an index of per-area sitemaps (tools/sitemaps.mjs). */
export function sitemap(siteURL,extra=[],lastmod){return allPagesSitemap(siteURL,extra,lastmod);}
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
 for(const f of ['favicon.ico','apple-touch-icon.png'])await cp(path.join(ROOT,'assets/brand',f),path.join(dist,f));
 const html=await readFile(path.join(ROOT,'index.html'),'utf8');
 for(const route of ALL_ROUTES){const dir=path.join(dist,route);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),noEmailObfuscation(withIcons(entry(html,route,siteURL,config))));}
 await writeFile(path.join(dist,'.nojekyll'),'');
 await writeFile(path.join(dist,'404.html'),notFound(siteURL));
 const lastmod=lastmodResolver(pageHashes(entry,ALL_ROUTES,html));
 for(const [file,xml] of Object.entries(sitemapFiles(config.preview?'':siteURL,{extra:config.service?['pricing']:[],lastmod})))await writeFile(path.join(dist,file),xml);
 if(config.indexNowKey)await writeFile(path.join(dist,config.indexNowKey+'.txt'),config.indexNowKey);
 // The commit this build is made from (Cloudflare Pages / GitHub Actions), so tools/live-check.mjs can
 // wait until production serves this build before it checks it.
 const commit=(process.env.CF_PAGES_COMMIT_SHA||process.env.GITHUB_SHA||'').trim();
 if(/^[0-9a-f]{7,40}$/.test(commit))await writeFile(path.join(dist,'build.txt'),commit+'\n');
 await writeFile(path.join(dist,'robots.txt'),`User-agent: *\n${config.preview?'Disallow: /':'Allow: /'}\n${siteURL&&!config.preview?'Sitemap: '+new URL(SITEMAP_INDEX,siteURL).href+'\n':''}`);
 if(config.verificationClient)await writeFile(path.join(dist,'ads.txt'),`google.com, ${config.verificationClient.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
 if(config.client){
  await cp(path.join(ROOT,'tools/ads-worker.mjs'),path.join(dist,'_worker.js'));
  await writeFile(path.join(dist,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:['/src/*','/ai-runtime/*','/build.txt','/styles.css','/experience.css','/content.css','/favicon.svg','/favicon.ico','/apple-touch-icon.png','/robots.txt','/sitemap.xml','/sitemap-game.xml','/sitemap-guides.xml','/sitemap-tools.xml','/sitemap-images.xml','/ads.txt']},null,2));
 }
 if(config.service){await emitService(dist,config,head);await writeFile(path.join(dist,'_headers'),(await readFile(path.join(dist,'_headers'),'utf8')).replace(/\n*$/,'\n')+SERVICE_HEADERS);}
 console.log(`Built ${ALL_ROUTES.length} static entry pages → dist/`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
