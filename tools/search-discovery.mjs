/** Public discovery files derived from the sitemap registry AND the emitted HTML.
 * This is navigation metadata, not a crawler permission or a ranking signal.
 * Read the final build outputs so portal tool URLs and service-only pages keep their
 * real canonical, robots, title and description instead of a second copy registry.
 */
import {BRAND} from '../src/brand.js';
import {LOCALES} from '../src/i18n.js';
import {INTENTS} from '../src/intents.js';
import {POLICY_ROUTES} from '../src/policies.js';
import {DIRECTORY} from '../src/task/registry.js';
import {normalizeSiteURL,pagePath} from '../src/seo.js';
import {sitemapGroups,W3C_DATETIME} from './sitemaps.mjs';
import {guideLastmod} from './guides-registry.mjs';

export const SEARCH_DISCOVERY_FILES=Object.freeze({guide:'llms.txt',index:'search-discovery.json'});

const decode=text=>String(text).replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi,entity=>{
 const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
 const key=entity.toLowerCase();if(named[key])return named[key];
 const n=key.startsWith('&#x')?parseInt(key.slice(3,-1),16):parseInt(key.slice(2,-1),10);
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\ufffd';
});
const plain=text=>decode(text).replace(/\s+/g,' ').trim();
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4])]));
const markdown=text=>plain(text).replace(/[\\\[\]*_`]/g,'\\$&').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const htmlEscape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Null for noindex, canonical aliases or conflicting canonical declarations. */
export function discoveryPage(html,{url,language,path,group,lastmod}={}){
 const head=String(html).match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
 const metas=[...head.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
 if(metas.some(m=>/^(robots|googlebot|bingbot)$/i.test(m.name||'')&&/(?:^|[\s,])(noindex|none)(?:$|[\s,])/i.test(m.content||'')))return null;
 const canonicals=[...head.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0])).filter(a=>a.rel?.toLowerCase().split(/\s+/).includes('canonical'));
 if(!canonicals.length)return null;
 let canonical;
 try{canonical=new URL(canonicals[0].href,url).href;if(canonicals.some(c=>new URL(c.href,url).href!==canonical))return null;}catch{return null;}
 if(canonical!==url)return null;
 const title=plain(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const description=plain(metas.find(m=>m.name?.toLowerCase()==='description')?.content||'');
 if(!title||!description)throw Error(`Discovery page lacks a title or description: ${url}`);
 const page={url:canonical,path,language,group,title,description};
 // There is deliberately no build date. Missing content dates remain absent.
 if(lastmod){if(!W3C_DATETIME.test(lastmod)||!Number.isFinite(Date.parse(lastmod)))throw Error(`Invalid discovery content date for ${url}: ${lastmod}`);page.lastmod=lastmod;}
 return page;
}

/** Optional HTML discovery pointer. Preview callers pass an empty site URL. */
export function searchDiscoveryLinks(siteURL){
 const root=normalizeSiteURL(siteURL);if(!root)return '';
 return `<link rel="describedby" type="text/plain" href="${htmlEscape(new URL(SEARCH_DISCOVERY_FILES.guide,root).href)}">`;
}

// Existing task-directory groups supply the compact entry points. Specific keyword
// landings remain in the JSON inventory and sitemaps rather than bloating llms.txt.
const categoryPaths=category=>(DIRECTORY.find(([key])=>key===category)?.[1]||[]).map(id=>INTENTS[id]?.path).filter(p=>p!==undefined);
const GAME_ENTRY_PATHS=Object.freeze(['game','game/sprite-lab','game/pixel-lab','game/tile-lab','game/texture-lab','game/ui-lab','sprite-sheet-maker','game/sfx-generator']);

function guideText(root,pages){
 const english=pages.filter(p=>p.language==='en'),byPath=new Map(english.map(p=>[p.path,p]));
 const lines=[`# ${BRAND.name}`,'',
  '> Public creator tools, game asset workflows and site information. This guide links to canonical pages; the pages contain the actual capabilities and limitations.','',
  'Korean, English and Japanese tool pages are available. Tool files are processed in the browser; community and channel content is served separately. Read the relevant page and its support labels before describing a capability.',
  'Use the XML sitemap index for live community and channel URLs. The JSON discovery index describes the localized static pages in this build. robots.txt remains the crawler access policy.',''];
 const add=(heading,rows)=>{if(!rows.length)return;lines.push(`## ${heading}`,'',...rows.map(p=>`- [${markdown(p.title)}](${p.url}): ${markdown(p.description)}`),'');};
 add('Start here',pages.filter(p=>p.path===''));
 add('Game asset workflows',GAME_ENTRY_PATHS.map(p=>byPath.get(p)).filter(Boolean));
 add('Image tools',categoryPaths('image').map(p=>byPath.get(p)).filter(Boolean));
 add('PDF tools',categoryPaths('pdf').map(p=>byPath.get(p)).filter(Boolean));
 add('Video, audio and text tools',[...categoryPaths('video'),...categoryPaths('text'),'audio-lab'].map(p=>byPath.get(p)).filter(Boolean));
 add('Guides',english.filter(p=>p.group==='guides').slice(0,8));
 add('About, policies and plans',[...POLICY_ROUTES,'pricing'].map(p=>byPath.get(p)).filter(Boolean));
 lines.push('## Discovery files','',
  `- [Canonical page inventory](${new URL(SEARCH_DISCOVERY_FILES.index,root).href}): Titles, descriptions, languages and known content dates from the emitted indexable pages.`,
  `- [XML sitemap index](${new URL('sitemap.xml',root).href}): The current public URL inventory, including live channel sitemaps when the community platform is enabled.`,
  `- [Crawler access policy](${new URL('robots.txt',root).href}): Crawling directives for this deployment.`,'');
 return lines.join('\n');
}

/**
 * @param {string} siteURL Empty for preview builds or builds without a canonical origin.
 * @param {{readPage?: (route:string)=>string|Promise<string>, extra?:string[], lastmod?:(route:string)=>string|null}} options
 * @returns {Promise<Record<string,string>>} Build outputs; no files or URLs in previews.
 */
export async function searchDiscoveryFiles(siteURL,{readPage,extra=[],lastmod=()=>null}={}){
 const root=normalizeSiteURL(siteURL);if(!root)return {};
 if(typeof readPage!=='function')throw Error('searchDiscoveryFiles requires readPage(route) from the final build outputs');
 const groups=sitemapGroups(extra),candidates=Object.entries(groups).flatMap(([group,paths])=>paths.flatMap(p=>LOCALES.map(language=>{
  const route=pagePath(p,language).replace(/\/$/,'');
  return {url:new URL(pagePath(p,language),root).href,path:p,language,group,route,dateRoute:p?`${language}/${p}`:language};
 })));
 const results=await Promise.all(candidates.map(async candidate=>{
  let html;try{html=await readPage(candidate.route);}catch(cause){throw Error(`Cannot read discovery page: ${candidate.route}`,{cause});}
  return discoveryPage(html,{...candidate,lastmod:candidate.group==='guides'?guideLastmod(candidate.path):lastmod(candidate.dateRoute)});
 }));
 const seen=new Set(),pages=results.filter(page=>{if(!page||seen.has(page.url))return false;seen.add(page.url);return true;});
 const index={version:1,site:{name:BRAND.name,url:root,languages:[...LOCALES]},sitemap:new URL('sitemap.xml',root).href,
  scope:'Localized canonical static pages. Discover live community and channel URLs through the XML sitemap index.',pages};
 return {[SEARCH_DISCOVERY_FILES.guide]:guideText(root,pages),[SEARCH_DISCOVERY_FILES.index]:JSON.stringify(index,null,2)+'\n'};
}
