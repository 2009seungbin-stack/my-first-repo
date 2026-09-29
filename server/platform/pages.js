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
import {renderFlag,loadFlagTarget,FLAG_TARGET} from '../../platform/render/flag.js';
import {renderMod} from '../../platform/render/mod.js';
import {renderMe} from '../../platform/render/me.js';
import {loadTransparency,renderTransparency} from '../../platform/render/transparency.js';
import {renderPolicy} from '../../platform/render/policy.js';
import {loadHub,renderHub} from '../../platform/render/hub.js';
import {channelFeed,radarFeed} from '../../platform/render/feed.js';
import {loadLocalLlm,renderLocalLlm} from '../../platform/render/localllm.js';
import {channelUrl,nameOf,page} from '../../platform/render/ui.js';
import {html as rawHtml} from '../../platform/render/html.js';
import {VERTICALS,PLATFORM_LOCALES,ENTITY_ID} from '../../platform/schema.js';
import {POST_KINDS} from '../../platform/community.js';
import {sitemapEntities} from '../../platform/db/channel.js';
import {indexable,PLATFORM_SITEMAPS} from '../../platform/seo.js';

const L=PLATFORM_LOCALES.join('|'),V=VERTICALS.join('|');
const ROUTE=new RegExp(`^/(${L})/(?:(community)/(?:(best)/|(report|mod|me|transparency|policy))?|(search|radar)/(feed\\.xml)?|(${V})/(?:([a-z0-9][a-z0-9-]{0,95})/(?:(\\d{1,9})|(write|history|status|local-llm|feed\\.xml))?)?)$`);
export const CACHE_CONTROL='public, max-age=0, s-maxage=60, stale-while-revalidate=60';
/** Channel bar for anonymous readers: the week's most active channels, topped up with featured ones. */
export const FEATURED=Object.freeze(['service:claude','service:chatgpt','service:gemini-app','service:claude-code','gpu:rtx-5070','app:blender','app:ableton-live']);
/** Security headers of every server-rendered page (the static site's _headers do not apply to Worker responses). */
export const PAGE_HEADERS=Object.freeze({
 'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'SAMEORIGIN',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
});

/** @typedef {{l:string,page:'front'|'best'|'flag'|'mod'|'me'|'transparency'|'policy'|'hub'|'feed'|'radar-feed'|'search'|'radar'|'channel'|'post'|'write'|'history'|'status'|'local-llm',vertical?:string,slug?:string,no?:number|null}} Route */
/** @param {string} pathname @returns {Route|null} */
export function matchPlatformRoute(pathname){
 const m=ROUTE.exec(pathname);
 if(!m)return null;
 const [,l,community,best,report,top,topFeed,vertical,slug,no,sub]=m;
 if(top==='radar'&&topFeed)return {l,page:'radar-feed'};
 if(sub==='feed.xml')return {l,page:'feed',vertical,slug,no:null};
 if(community)return {l,page:best?'best':report==='mod'?'mod':report==='me'?'me':report==='transparency'?'transparency':report==='policy'?'policy':report?'flag':'front'};
 if(top)return {l,page:/** @type {'search'|'radar'} */(top)};
 if(!slug)return {l,page:'hub',vertical};
 return {l,page:no?'post':/** @type {'write'|'history'|'status'|'local-llm'|undefined} */(sub)||'channel',vertical,slug,no:no?Number(no):null};
}

const hasOwn=(/** @type {object} */ o,/** @type {string} */ k)=>Object.prototype.hasOwnProperty.call(o,k);
/** Allowed parameters per page with their canonical form (null = drop). */
const PARAMS=/** @type {Record<string,Record<string,(v:string)=>string|null>>} */({
 channel:{kind:v=>hasOwn(POST_KINDS,v)?v:null,sort:v=>SORTS.includes(/** @type {any} */(v))&&v!=='new'?v:null,best:v=>v==='1'?'1':null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null},
 front:{v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 best:{period:v=>hasOwn(BEST_PERIODS,v)&&v!=='day'?v:null,v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 radar:{v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 hub:{type:v=>/^[a-z_]{2,20}$/.test(v)?v:null,org:v=>/^[a-z0-9][a-z0-9-]{0,40}$/.test(v)?v:null,sort:v=>v==='cheap'||v==='new'?v:null,vs:v=>/^[a-z0-9][a-z0-9-]{0,60},[a-z0-9][a-z0-9-]{0,60}$/.test(v)&&v.split(',')[0]!==v.split(',')[1]?v.split(',').sort().join(','):null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null},
 search:{q:v=>v.trim().slice(0,80)||null,in:v=>ENTITY_ID.test(v)?v:null,more:v=>v==='1'?'1':null},
 flag:{target:v=>FLAG_TARGET.test(v)?v:null},
 write:{kind:v=>hasOwn(POST_KINDS,v)?v:null,result:v=>v==='works'||v==='works_with_issues'||v==='broken'?v:null},
});
/** The canonical search string for a page: known params only, valid values only, fixed order. @param {string} page @param {URLSearchParams} q */
export function canonicalQuery(page,q){
 const spec=PARAMS[page]||{},out=new URLSearchParams();
 for(const k of Object.keys(spec)){const raw=q.get(k);if(raw===null)continue;const v=spec[k](raw);if(v!==null)out.set(k,v);}
 // Commas stay literal (a GPU pair is ?vs=a,b in links, canonicals and sitemaps alike).
 const s=out.toString().replace(/%2C/gi,',');return s?`?${s}`:'';
}

/** Channel bar, cached per isolate for a minute (it does not depend on the page). */
const barCache=new Map();
/** @param {any} db @param {string} l @param {number} now */
export async function channelBar(db,l,now){
 const hit=barCache.get(l);if(hit&&now-hit.at<60e3)return hit.bar;
 const [act,byId]=await Promise.all([activeChannels(db,now-7*864e5,8),entitiesByIds(db,[...FEATURED])]);
 const active=act.map(c=>c.entity),ids=new Set(active.map(e=>e.id));
 const featured=FEATURED.filter(id=>!ids.has(id));
 const bar=[...active,...featured.map(id=>byId.get(id)).filter(Boolean)].slice(0,9).map(e=>({name:nameOf(/** @type {any} */(e),l),href:channelUrl(l,/** @type {any} */(e))}));
 barCache.set(l,{at:now,bar});
 return bar;
}
export const resetChannelBarCache=()=>barCache.clear();

/**
 * Render a platform page, or null when the path is not one (the static site handles it).
 * @param {Request} request @param {{DB:any}} env @param {{origin:string,now?:()=>number,providers?:string[]}} site
 */
export async function renderPlatformPage(request,env,site){
 const url=new URL(request.url),route=matchPlatformRoute(url.pathname);
 if(!route||!env.DB)return null;
 const search=canonicalQuery(route.page,url.searchParams);
 // Compare in URLSearchParams' own encoding (":" → "%3A"), so an already canonical URL never redirects.
 const given=url.searchParams.toString().replace(/%2C/gi,',');
 if(search!==(given?`?${given}`:''))return redirect(new URL(url.pathname+search,url).href);
 const q=new URLSearchParams(search);
 const now=(site.now||Date.now)(),db=env.DB,l=route.l,s={origin:site.origin||url.origin,providers:site.providers||[]};
 const bar=()=>channelBar(db,l,now);
 switch(route.page){
  case 'front':return html(String(renderFront(await loadFront(db,{l,now,vertical:q.get('v'),channels:await bar()}),s)));
  case 'best':return html(String(renderBest(await loadBest(db,{l,now,period:q.get('period')||'day',vertical:q.get('v'),channels:await bar()}),s)));
  case 'flag':return html(String(renderFlag({l,target:q.get('target'),about:await loadFlagTarget(db,q.get('target'),l),channels:await bar()},s)));
  case 'policy':return html(String(renderPolicy({l,channels:await bar()},s)));
  case 'transparency':return html(String(renderTransparency(await loadTransparency(db,{l,now,channels:await bar()}),s)));
  case 'me':return html(String(renderMe({l,channels:await bar()},s)));
  case 'mod':return html(String(renderMod({l,channels:await bar()},s)),'private, no-store');
  case 'search':return html(String(renderSearch(await loadSearch(db,{l,now,q:q.get('q')||'',in:q.get('in'),more:q.get('more')==='1',channels:await bar()}),s)),'private, no-store');
  case 'radar-feed':return xml(await radarFeed(db,l,s.origin));
  case 'radar':return html(String(renderRadar(await loadRadar(db,{l,now,vertical:q.get('v'),channels:await bar()}),s)));
 }
 if(route.page==='hub'){const m=await loadHub(db,/** @type {string} */(route.vertical),{l,now,type:q.get('type'),org:q.get('org'),sort:q.get('sort'),vs:q.get('vs'),page:Number(q.get('page'))||1,channels:await bar()});return m?html(String(renderHub(m,s))):null;}
 const {entity,redirect:moved}=await entityBySlug(db,/** @type {string} */(route.vertical),/** @type {string} */(route.slug));
 if(!entity){
  if(moved)return redirect(new URL(`/${l}/${route.vertical}/${moved}/${route.page==='channel'||route.page==='post'?route.no??'':route.page==='feed'?'feed.xml':route.page}${search}`,url).href);
  return null;
 }
 const channels=await bar();
 switch(route.page){
  case 'feed':return xml(await channelFeed(db,entity,l,s.origin));
  case 'history':return html(String(renderHistory(await loadHistory(db,entity,{l,now,channels}),s)));
  case 'local-llm':return entity.type==='gpu'?html(String(renderLocalLlm(await loadLocalLlm(db,entity,{l,now,channels}),s))):null;
  case 'status':return entity.type==='service'?html(String(renderStatus(await loadStatus(db,entity,{l,now,channels}),s))):null;
  case 'write':return html(String(renderWrite(await loadWrite(db,entity,{l,kind:q.get('kind'),result:q.get('result'),channels}),s)));
  case 'post':{
   const m=await loadPost(db,entity,/** @type {number} */(route.no),{l,now,channels});
   if(m)return html(String(renderPost(m,s)));
   // A deleted or hidden post (or a number never used) in a real channel: say so and lead back to
   // the channel, with a real 404 status so search engines drop the URL.
   const ko=l==='ko',base=channelUrl(l,entity);
   const body=page({l,title:ko?'글을 찾을 수 없습니다 | Nerulio':'Post not found | Nerulio',description:'',canonical:s.origin+base,noindex:true,channels,
    body:rawHtml`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'삭제되었거나 숨겨진 글입니다':'This post was deleted or hidden'}</h1></div><p class="empty">${ko?'작성자가 삭제했거나, 신고로 임시조치된 글일 수 있어요.':'The author deleted it, or it was hidden after a report.'}</p><p class="pad"><a class="btn p" href="${base}">${ko?`${nameOf(entity,l)} 채널로 가기 ›`:`Go to ${nameOf(entity,l)} ›`}</a></p></section></div>`});
   return new Response(String(body),{status:404,headers:{...PAGE_HEADERS,'cache-control':CACHE_CONTROL}});
  }
 }
 return html(String(renderChannel(await loadChannel(db,entity,{l,now,kind:q.get('kind'),sort:q.get('sort')||'new',best:q.get('best')==='1',page:Number(q.get('page'))||1,channels}),s)));
}
const html=(/** @type {string} */ body,cache=CACHE_CONTROL)=>new Response(body,{headers:{...PAGE_HEADERS,'cache-control':cache}});
const xml=(/** @type {string} */ body)=>new Response(body,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public, max-age=0, s-maxage=600','x-content-type-options':'nosniff'}});
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
 const hub={ko:`${origin}/ko/${vertical}/`,en:`${origin}/en/${vertical}/`};
 for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(hub[l])}</loc><xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(hub.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(hub.en)}"/></url>`);
 // Change histories with real changes (at least 3 besides first sightings) are pages of their own.
 const hist=new Set(((await db.prepare(`SELECT entity_id FROM changes WHERE vertical=? AND visibility='public' AND kind NOT IN ('entity_added','fact_added') GROUP BY entity_id HAVING COUNT(*)>=3`).bind(vertical).all()).results||[]).map((/** @type {any} */ r)=>String(r.entity_id)));
 // The comparison tables, and (in the AI file) the community front and the Radar.
 const extra=[...({ai:['?type=plan','?type=model'],hardware:['?type=gpu']}[vertical]||[]).map(q=>[`/${vertical}/${q}`]),...(vertical==='ai'?[['/community/'],['/radar/']]:[])];
 for(const [p] of extra){
  const alt={ko:`${origin}/ko${p}`,en:`${origin}/en${p}`};
  for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(alt[l])}</loc><xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(alt.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(alt.en)}"/></url>`);
 }
 for(const e of rows){
  const paths=[''];if(e.type==='service')paths.push('status');if(e.type==='gpu')paths.push('local-llm');if(hist.has(e.id))paths.push('history');
  for(const p of paths){
   const alt={ko:origin+channelUrl('ko',e)+p,en:origin+channelUrl('en',e)+p};
   for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(alt[l])}</loc>${e.lastmod?`<lastmod>${new Date(e.lastmod).toISOString().slice(0,10)}</lastmod>`:''}<xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(alt.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(alt.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(alt.en)}"/></url>`);
  }
 }
 // GPU pairs worth a page of their own: a card and the card it succeeds (RTX 4070 → RTX 5070).
 if(vertical==='hardware'){
  const ok=new Set(rows.filter(e=>e.type==='gpu').map(e=>e.id)),slug=new Map(rows.map(e=>[e.id,e.slug]));
  const pairs=((await db.prepare("SELECT subject_id,object_id FROM relations WHERE predicate='successor_of' AND valid_until IS NULL").all()).results||[])
   .filter((/** @type {any} */ r)=>ok.has(r.subject_id)&&ok.has(r.object_id)).map((/** @type {any} */ r)=>[slug.get(r.subject_id),slug.get(r.object_id)].sort().join(','));
  for(const pr of [...new Set(pairs)]){
   const alt={ko:`${origin}/ko/hardware/?type=gpu&vs=${pr}`,en:`${origin}/en/hardware/?type=gpu&vs=${pr}`};
   for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(alt[l])}</loc><xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(alt.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(alt.en)}"/></url>`);
  }
 }
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

/** Edge cache in front of renderPlatformPage (GET only). The key is the canonical URL, so junk
 * parameters are answered by a cacheable redirect instead of a fresh render.
 * @param {Request} request @param {any} env @param {any} ctx @param {{origin:string,providers?:string[]}} site */
export async function handlePlatformPage(request,env,ctx,site){
 if(request.method!=='GET'&&request.method!=='HEAD')return null;
 const path=new URL(request.url).pathname,sm=SITEMAP.exec(path);
 if(sm){
  if(!PLATFORM_SITEMAPS.includes(`sitemap-n2-${sm[1]}.xml`)||!env.DB)return null;
  const cache=/** @type {any} */(globalThis).caches?.default,key=new Request(request.url,{method:'GET'});
  const hit=cache?await cache.match(key):null;if(hit)return hit;
  const res=new Response(await renderSitemap(env.DB,sm[1],site.origin),{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600, s-maxage=3600','x-content-type-options':'nosniff'}});
  if(cache)ctx?.waitUntil?.(cache.put(key,res.clone()));
  return res;
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
