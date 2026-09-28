// @ts-check
/** Server-rendered platform pages (architecture D4), only in builds with PLATFORM=on:
 *   /{l}/community/            community front (?v=vertical)
 *   /{l}/community/best/       념글 across channels (?period=day|week|month&v=)
 *   /{l}/community/report      신고 form (?target=kind:id)
 *   /{l}/search/               search (?q=&in=entity)
 *   /{l}/radar/                what changed / what is coming (?v=)
 *   /{l}/{vertical}/{slug}/    channel (?kind=&sort=&best=1&page=)
 *   /{l}/{vertical}/{slug}/{no} · …/write · …/history · …/status
 * Anonymous HTML is identical for everyone (personal state comes from islands), so responses are
 * cached at the edge. Only known query parameters with valid values reach the renderers and the
 * cache key; anything else is redirected to the canonical URL (no cache-busting by ?x=random). */
import {entityBySlug,activeChannels,entitiesByIds,SORTS} from '../../platform/db/channel.js';
import {loadChannel,renderChannel} from '../../platform/render/channel.js';
import {loadPost,renderPost} from '../../platform/render/post.js';
import {loadFront,renderFront,loadBest,renderBest,BEST_PERIODS} from '../../platform/render/front.js';
import {loadWrite,renderWrite} from '../../platform/render/write.js';
import {loadHistory,renderHistory} from '../../platform/render/history.js';
import {loadStatus,renderStatus} from '../../platform/render/status.js';
import {loadSearch,renderSearch} from '../../platform/render/search.js';
import {loadRadar,renderRadar} from '../../platform/render/radar.js';
import {renderFlag,FLAG_TARGET} from '../../platform/render/flag.js';
import {loadLocalLlm,renderLocalLlm} from '../../platform/render/localllm.js';
import {channelUrl,nameOf} from '../../platform/render/ui.js';
import {VERTICALS,PLATFORM_LOCALES,ENTITY_ID} from '../../platform/schema.js';
import {POST_KINDS} from '../../platform/community.js';
import {sitemapEntities} from '../../platform/db/channel.js';
import {indexable,PLATFORM_SITEMAPS} from '../../platform/seo.js';

const L=PLATFORM_LOCALES.join('|'),V=VERTICALS.join('|');
const ROUTE=new RegExp(`^/(${L})/(?:(community)/(?:(best)/|(report))?|(search|radar)/|(${V})/([a-z0-9][a-z0-9-]{0,95})/(?:(\\d{1,9})|(write|history|status|local-llm))?)$`);
export const CACHE_CONTROL='public, max-age=0, s-maxage=60, stale-while-revalidate=600';
/** Channel bar for anonymous readers: the week's most active channels, topped up with featured ones. */
export const FEATURED=Object.freeze(['service:claude','service:chatgpt','service:gemini-app','service:claude-code','gpu:rtx-5070','app:blender','app:ableton-live']);
/** Security headers of every server-rendered page (the static site's _headers do not apply to Worker responses). */
export const PAGE_HEADERS=Object.freeze({
 'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'SAMEORIGIN',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
});

/** @typedef {{l:string,page:'front'|'best'|'flag'|'search'|'radar'|'channel'|'post'|'write'|'history'|'status'|'local-llm',vertical?:string,slug?:string,no?:number|null}} Route */
/** @param {string} pathname @returns {Route|null} */
export function matchPlatformRoute(pathname){
 const m=ROUTE.exec(pathname);
 if(!m)return null;
 const [,l,community,best,report,top,vertical,slug,no,sub]=m;
 if(community)return {l,page:best?'best':report?'flag':'front'};
 if(top)return {l,page:/** @type {'search'|'radar'} */(top)};
 return {l,page:no?'post':/** @type {'write'|'history'|'status'|'local-llm'|undefined} */(sub)||'channel',vertical,slug,no:no?Number(no):null};
}

const hasOwn=(/** @type {object} */ o,/** @type {string} */ k)=>Object.prototype.hasOwnProperty.call(o,k);
/** Allowed parameters per page with their canonical form (null = drop). */
const PARAMS=/** @type {Record<string,Record<string,(v:string)=>string|null>>} */({
 channel:{kind:v=>hasOwn(POST_KINDS,v)?v:null,sort:v=>SORTS.includes(/** @type {any} */(v))&&v!=='new'?v:null,best:v=>v==='1'?'1':null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null},
 front:{v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 best:{period:v=>hasOwn(BEST_PERIODS,v)&&v!=='day'?v:null,v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 radar:{v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 search:{q:v=>v.trim().slice(0,80)||null,in:v=>ENTITY_ID.test(v)?v:null},
 flag:{target:v=>FLAG_TARGET.test(v)?v:null},
 write:{kind:v=>hasOwn(POST_KINDS,v)?v:null},
});
/** The canonical search string for a page: known params only, valid values only, fixed order. @param {string} page @param {URLSearchParams} q */
export function canonicalQuery(page,q){
 const spec=PARAMS[page]||{},out=new URLSearchParams();
 for(const k of Object.keys(spec)){const raw=q.get(k);if(raw===null)continue;const v=spec[k](raw);if(v!==null)out.set(k,v);}
 const s=out.toString();return s?`?${s}`:'';
}

/** Channel bar, cached per isolate for a minute (it does not depend on the page). */
const barCache=new Map();
/** @param {any} db @param {string} l @param {number} now */
export async function channelBar(db,l,now){
 const hit=barCache.get(l);if(hit&&now-hit.at<60e3)return hit.bar;
 const active=(await activeChannels(db,now-7*864e5,8)).map(c=>c.entity);
 const ids=new Set(active.map(e=>e.id));
 const featured=FEATURED.filter(id=>!ids.has(id)),byId=await entitiesByIds(db,featured);
 const bar=[...active,...featured.map(id=>byId.get(id)).filter(Boolean)].slice(0,9).map(e=>({name:nameOf(/** @type {any} */(e),l),href:channelUrl(l,/** @type {any} */(e))}));
 barCache.set(l,{at:now,bar});
 return bar;
}
export const resetChannelBarCache=()=>barCache.clear();

/**
 * Render a platform page, or null when the path is not one (the static site handles it).
 * @param {Request} request @param {{DB:any}} env @param {{origin:string,now?:()=>number}} site
 */
export async function renderPlatformPage(request,env,site){
 const url=new URL(request.url),route=matchPlatformRoute(url.pathname);
 if(!route||!env.DB)return null;
 const search=canonicalQuery(route.page,url.searchParams);
 // Compare in URLSearchParams' own encoding (":" → "%3A"), so an already canonical URL never redirects.
 const given=url.searchParams.toString();
 if(search!==(given?`?${given}`:''))return redirect(new URL(url.pathname+search,url).href);
 const q=new URLSearchParams(search);
 const now=(site.now||Date.now)(),db=env.DB,l=route.l,s={origin:site.origin||url.origin};
 const bar=()=>channelBar(db,l,now);
 switch(route.page){
  case 'front':return html(String(renderFront(await loadFront(db,{l,now,vertical:q.get('v'),channels:await bar()}),s)));
  case 'best':return html(String(renderBest(await loadBest(db,{l,now,period:q.get('period')||'day',vertical:q.get('v'),channels:await bar()}),s)));
  case 'flag':return html(String(renderFlag({l,target:q.get('target'),channels:await bar()},s)));
  case 'search':return html(String(renderSearch(await loadSearch(db,{l,now,q:q.get('q')||'',in:q.get('in'),channels:await bar()}),s)),'private, no-store');
  case 'radar':return html(String(renderRadar(await loadRadar(db,{l,now,vertical:q.get('v'),channels:await bar()}),s)));
 }
 const {entity,redirect:moved}=await entityBySlug(db,/** @type {string} */(route.vertical),/** @type {string} */(route.slug));
 if(!entity){
  if(moved)return redirect(new URL(`/${l}/${route.vertical}/${moved}/${route.page==='channel'||route.page==='post'?route.no??'':route.page}${search}`,url).href);
  return null;
 }
 const channels=await bar();
 switch(route.page){
  case 'history':return html(String(renderHistory(await loadHistory(db,entity,{l,now,channels}),s)));
  case 'local-llm':return entity.type==='gpu'?html(String(renderLocalLlm(await loadLocalLlm(db,entity,{l,now,channels}),s))):null;
  case 'status':return entity.type==='service'?html(String(renderStatus(await loadStatus(db,entity,{l,now,channels}),s))):null;
  case 'write':return html(String(renderWrite(await loadWrite(db,entity,{l,kind:q.get('kind'),channels}),s)));
  case 'post':{const m=await loadPost(db,entity,/** @type {number} */(route.no),{l,now,channels});return m?html(String(renderPost(m,s))):null;}
 }
 return html(String(renderChannel(await loadChannel(db,entity,{l,now,kind:q.get('kind'),sort:q.get('sort')||'new',best:q.get('best')==='1',page:Number(q.get('page'))||1,channels}),s)));
}
const html=(/** @type {string} */ body,cache=CACHE_CONTROL)=>new Response(body,{headers:{...PAGE_HEADERS,'cache-control':cache}});
const redirect=(/** @type {string} */ to)=>new Response(null,{status:301,headers:{location:to,'cache-control':'public, max-age=3600'}});

const SITEMAP=/^\/sitemap-n2-([a-z]+)\.xml$/;
const xmlEsc=(/** @type {string} */ s)=>s.replace(/[&<>"']/g,c=>/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
/**
 * Entity sitemap of one vertical: only channels that pass the content gate, both languages with
 * hreflang alternates, lastmod = last visible change or post. Service status pages are listed too.
 * @param {any} db @param {string} vertical @param {string} origin
 */
export async function renderSitemap(db,vertical,origin){
 const rows=(await sitemapEntities(db,vertical)).filter(e=>indexable(e,{facts:e.facts,relations:e.relations,posts:e.posts,description:!!(e.descriptions.ko||e.descriptions.en)}));
 const urls=[];
 for(const e of rows){
  const paths=[''];if(e.type==='service')paths.push('status');if(e.type==='gpu')paths.push('local-llm');
  for(const p of paths){
   const alt={ko:origin+channelUrl('ko',e)+p,en:origin+channelUrl('en',e)+p};
   for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(alt[l])}</loc>${e.lastmod?`<lastmod>${new Date(e.lastmod).toISOString().slice(0,10)}</lastmod>`:''}<xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(alt.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(alt.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(alt.en)}"/></url>`);
  }
 }
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

/** Edge cache in front of renderPlatformPage (GET only). The key is the canonical URL, so junk
 * parameters are answered by a cacheable redirect instead of a fresh render.
 * @param {Request} request @param {any} env @param {any} ctx @param {{origin:string}} site */
export async function handlePlatformPage(request,env,ctx,site){
 if(request.method!=='GET'&&request.method!=='HEAD')return null;
 const path=new URL(request.url).pathname,sm=SITEMAP.exec(path);
 if(sm){
  if(!PLATFORM_SITEMAPS.includes(`sitemap-n2-${sm[1]}.xml`)||!env.DB)return null;
  return new Response(await renderSitemap(env.DB,sm[1],site.origin),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600, s-maxage=3600','x-content-type-options':'nosniff'}});
 }
 if(!matchPlatformRoute(path))return null;
 const cache=/** @type {any} */(globalThis).caches?.default;
 const key=new Request(request.url,{method:'GET'});
 const hit=cache?await cache.match(key):null;
 if(hit)return hit;
 let res;
 try{res=await renderPlatformPage(request,env,site);}
 catch(e){
  console.error('platform page',/** @type {any} */(e)?.message);
  return new Response('<!doctype html><meta charset="utf-8"><title>Nerulio</title><p>잠시 후 다시 시도해 주세요. Please try again in a moment.</p>',{status:503,headers:{...PAGE_HEADERS,'cache-control':'no-store','retry-after':'30'}});
 }
 if(res&&(res.status===200||res.status===301)&&cache&&!/no-store/.test(res.headers.get('cache-control')||''))ctx?.waitUntil?.(cache.put(key,res.clone()));
 return res;
}
