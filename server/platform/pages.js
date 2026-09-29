// @ts-check
/** Server-rendered platform pages (architecture D4), only in builds with PLATFORM=on:
 *   / · /en/                   the portal home (Korean · English): the feed, AI status, news (?sort=new)
 *   /ko/ · /{l}/community/     → 301 to the portal home
 *   /{l}/community/u/{name}    a member's profile (?tab=comments; noindex)
 *   /{l}/community/best/       전체 베스트 (?period=day|week|month&ch=)
 *   /{l}/community/{ch}/       a channel's board (?kind=&tag=&sort=&best=1&page=, 게임: &platform= | &genre=)
 *   /{l}/community/{ch}/{no} · …/write (?tag=&kind=) · …/best · …/feed.xml
 *   /{l}/community/report      신고 form (?target=kind:id)
 *   /{l}/search/               search (?q=&in=entity)
 *   /{l}/radar/                what changed / what is coming (?v=)
 *   /{l}/{vertical}/{slug}/    tag page: facts and the tag's posts in every channel (?kind=&sort=&best=1&page=&sub=0)
 *   /{l}/{vertical}/{slug}/{no} → 301 to the post's channel address (legacy_posts); …/write → 302 to the
 *   channel's write page with the tag; …/history · …/status · …/local-llm · …/feed.xml
 * Anonymous HTML is identical for everyone (personal state comes from islands), so responses are
 * cached at the edge. Only known query parameters with valid values reach the renderers and the
 * cache key; anything else is redirected to the canonical URL (no cache-busting by ?x=random). */
import {entityBySlug,legacyPost,factsFor,SORTS} from '../../platform/db/channel.js';
import {loadChannel,renderChannel} from '../../platform/render/channel.js';
import {loadBoard,renderBoard} from '../../platform/render/board.js';
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
import {loadProfile,renderProfile} from '../../platform/render/profile.js';
import {loadTransparency,renderTransparency} from '../../platform/render/transparency.js';
import {renderPolicy} from '../../platform/render/policy.js';
import {loadHub,renderHub} from '../../platform/render/hub.js';
import {channelFeed,radarFeed,boardFeed} from '../../platform/render/feed.js';
import {loadLocalLlm,renderLocalLlm} from '../../platform/render/localllm.js';
import {page,channelName,channelUrl,homeUrl} from '../../platform/render/ui.js';
import {html as rawHtml} from '../../platform/render/html.js';
import {VERTICALS,PLATFORM_LOCALES,ENTITY_ID} from '../../platform/schema.js';
import {POST_KINDS} from '../../platform/community.js';
import {CHANNEL_IDS,channelById,channelOfVertical,defaultChannelOf,channelPath,postPath,writePath,channelBarLinks} from '../../platform/channels.js';
import {sitemapEntities} from '../../platform/db/channel.js';
import {indexable,PLATFORM_SITEMAPS} from '../../platform/seo.js';
import {RAIL_SERVICES} from '../../platform/render/rail.js';

const L=PLATFORM_LOCALES.join('|'),V=VERTICALS.join('|'),CH=CHANNEL_IDS.join('|');
const ROUTE=new RegExp(`^/(${L})/(?:(community)/(?:(best)/|(report|mod|me|transparency|policy)|(${CH})/(?:(\\d{1,9})|(write|best|feed\\.xml))?)?|(search|radar)/(feed\\.xml)?|(${V})/(?:([a-z0-9][a-z0-9-]{0,95})/(?:(\\d{1,9})|(write|history|status|local-llm|feed\\.xml))?)?)$`);
/** A member's profile: /{l}/community/u/{nickname} (the nickname URL-encoded). */
const PROFILE=new RegExp(`^/(${L})/community/u/([^/]{1,160})$`);
export const CACHE_CONTROL='public, max-age=0, s-maxage=60, stale-while-revalidate=60';
/** Security headers of every server-rendered page (the static site's _headers do not apply to Worker responses). */
export const PAGE_HEADERS=Object.freeze({
 'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'SAMEORIGIN',
 'permissions-policy':'camera=(), microphone=(), geolocation=()',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
});

/** @typedef {{l:string,name?:string,page:'profile'|'front'|'home-moved'|'best'|'flag'|'mod'|'me'|'transparency'|'policy'|'hub'|'feed'|'radar-feed'|'search'|'radar'|'channel'|'post'|'write'|'history'|'status'|'local-llm'|'board'|'board-best'|'board-post'|'board-write'|'board-feed'|'legacy-post'|'legacy-write',vertical?:string,slug?:string,no?:number|null,ch?:string}} Route */
/** @param {string} pathname @returns {Route|null} */
export function matchPlatformRoute(pathname){
 // The portal home: Korean at the site root, English at /en/; /ko/ and the old community fronts move there.
 if(pathname==='/')return {l:'ko',page:'front'};
 if(pathname==='/en/')return {l:'en',page:'front'};
 if(pathname==='/ko/')return {l:'ko',page:'home-moved'};
 const pm=PROFILE.exec(pathname);
 if(pm){let name='';try{name=decodeURIComponent(pm[2]);}catch{return null;}return name&&name.length<=40?{l:pm[1],page:'profile',name}:null;}
 const m=ROUTE.exec(pathname);
 if(!m)return null;
 const [,l,community,best,report,ch,chNo,chSub,top,topFeed,vertical,slug,no,sub]=m;
 if(top==='radar'&&topFeed)return {l,page:'radar-feed'};
 if(ch){
  if(chNo)return {l,page:'board-post',ch,no:Number(chNo)};
  return {l,page:chSub==='write'?'board-write':chSub==='best'?'board-best':chSub==='feed.xml'?'board-feed':'board',ch};
 }
 if(sub==='feed.xml')return {l,page:'feed',vertical,slug,no:null};
 if(community)return {l,page:best?'best':report==='mod'?'mod':report==='me'?'me':report==='transparency'?'transparency':report==='policy'?'policy':report?'flag':'front'};
 if(top)return {l,page:/** @type {'search'|'radar'} */(top)};
 if(!slug)return {l,page:'hub',vertical};
 if(no)return {l,page:'legacy-post',vertical,slug,no:Number(no)};
 if(sub==='write')return {l,page:'legacy-write',vertical,slug,no:null};
 return {l,page:/** @type {'history'|'status'|'local-llm'|undefined} */(sub)||'channel',vertical,slug,no:null};
}

const hasOwn=(/** @type {object} */ o,/** @type {string} */ k)=>Object.prototype.hasOwnProperty.call(o,k);
/** Allowed parameters per page with their canonical form (null = drop). */
const PARAMS=/** @type {Record<string,Record<string,(v:string)=>string|null>>} */({
 channel:{kind:v=>hasOwn(POST_KINDS,v)?v:null,sort:v=>SORTS.includes(/** @type {any} */(v))&&v!=='new'?v:null,best:v=>v==='1'?'1':null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null,sub:v=>v==='0'?'0':null},
 board:{kind:v=>hasOwn(POST_KINDS,v)?v:null,tag:v=>ENTITY_ID.test(v)?v:null,sort:v=>SORTS.includes(/** @type {any} */(v))&&v!=='new'?v:null,best:v=>v==='1'?'1':null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null,
  platform:v=>/^[a-z0-9_-]{2,20}$/.test(v)?v:null,genre:v=>/^[A-Za-z0-9][A-Za-z0-9 &'-]{1,39}$/.test(v)?v:null},
 'board-best':{page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null},
 'board-write':{tag:v=>ENTITY_ID.test(v)?v:null,kind:v=>hasOwn(POST_KINDS,v)?v:null,result:v=>v==='works'||v==='works_with_issues'||v==='broken'?v:null},
 'legacy-write':{kind:v=>hasOwn(POST_KINDS,v)?v:null,result:v=>v==='works'||v==='works_with_issues'||v==='broken'?v:null},
 front:{sort:v=>v==='new'?'new':null},
 profile:{tab:v=>v==='comments'?'comments':null},
 best:{period:v=>hasOwn(BEST_PERIODS,v)&&v!=='day'?v:null,ch:v=>CHANNEL_IDS.includes(/** @type {any} */(v))?v:null},
 radar:{v:v=>VERTICALS.includes(/** @type {any} */(v))?v:null},
 hub:{type:v=>/^[a-z_]{2,20}$/.test(v)?v:null,org:v=>/^[a-z0-9][a-z0-9-]{0,40}$/.test(v)?v:null,sort:v=>v==='cheap'||v==='new'?v:null,vs:v=>/^[a-z0-9][a-z0-9-]{0,60},[a-z0-9][a-z0-9-]{0,60}$/.test(v)&&v.split(',')[0]!==v.split(',')[1]?v.split(',').sort().join(','):null,page:v=>/^[1-9]\d{0,3}$/.test(v)&&v!=='1'?v:null},
 search:{q:v=>v.trim().slice(0,80)||null,in:v=>ENTITY_ID.test(v)?v:null,more:v=>v==='1'?'1':null},
 flag:{target:v=>FLAG_TARGET.test(v)?v:null},
});
/** The canonical search string for a page: known params only, valid values only, fixed order. @param {string} page @param {URLSearchParams} q */
export function canonicalQuery(page,q){
 const spec=PARAMS[page]||{},out=new URLSearchParams();
 for(const k of Object.keys(spec)){const raw=q.get(k);if(raw===null)continue;const v=spec[k](raw);if(v!==null)out.set(k,v);}
 // Commas stay literal (a GPU pair is ?vs=a,b in links, canonicals and sitemaps alike), and so do the
 // colons of a tag id (?tag=service:claude).
 const s=out.toString().replace(/%2C/gi,',').replace(/%3A/gi,':');return s?`?${s}`:'';
}

/** The channel bar: the same 6 channels for everyone (an island moves the reader's pinned ones first).
 * @param {any} _db @param {string} l @param {number} _now */
export async function channelBar(_db,l,_now){return channelBarLinks(l);}
export const resetChannelBarCache=()=>{};

/**
 * Render a platform page, or null when the path is not one (the static site handles it).
 * @param {Request} request @param {{DB:any}} env @param {{origin:string,now?:()=>number,providers?:string[]}} site
 */
export async function renderPlatformPage(request,env,site){
 const url=new URL(request.url),route=matchPlatformRoute(url.pathname);
 if(!route||!env.DB)return null;
 const now=(site.now||Date.now)(),db=env.DB,l=route.l,s={origin:site.origin||url.origin,providers:site.providers||[]};
 // Old addresses (the per-entity boards before the channels, 2026-09-29): 301 to where they live now.
 if(route.page==='front'&&url.searchParams.has('v')){const v=url.searchParams.get('v');if(VERTICALS.includes(/** @type {any} */(v)))return redirect(new URL(channelPath(l,channelOfVertical(String(v))),url).href);}
 if(route.page==='best'&&url.searchParams.has('v')){
  const v=url.searchParams.get('v'),q=new URLSearchParams(url.searchParams);q.delete('v');
  if(VERTICALS.includes(/** @type {any} */(v)))q.set('ch',channelOfVertical(String(v)));
  return redirect(new URL(url.pathname+canonicalQuery('best',q),url).href);
 }
 // /ko/ (the tool home before the portal; the tools are at /{l}/tools/ now) and /{l}/community/ → the portal home.
 if(route.page==='home-moved'||(route.page==='front'&&url.pathname!==homeUrl(l)))return redirect(new URL(homeUrl(l)+canonicalQuery('front',url.searchParams),url).href);
 const search=canonicalQuery(route.page,url.searchParams);
 // Compare in URLSearchParams' own encoding (":" → "%3A"), so an already canonical URL never redirects.
 const given=url.searchParams.toString().replace(/%2C/gi,',').replace(/%3A/gi,':');
 if(search!==(given?`?${given}`:''))return redirect(new URL(url.pathname+search,url).href);
 const q=new URLSearchParams(search);
 const bar=()=>channelBar(db,l,now);
 switch(route.page){
  case 'front':return html(String(renderFront(await loadFront(db,{l,now,sort:q.get('sort')||'hot',channels:await bar()}),s)));
  case 'best':return html(String(renderBest(await loadBest(db,{l,now,period:q.get('period')||'day',channel:q.get('ch'),channels:await bar()}),s)));
  case 'flag':return html(String(renderFlag({l,target:q.get('target'),about:await loadFlagTarget(db,q.get('target'),l),channels:await bar()},s)));
  case 'policy':return html(String(renderPolicy({l,channels:await bar()},s)));
  case 'transparency':return html(String(renderTransparency(await loadTransparency(db,{l,now,channels:await bar()}),s)));
  case 'me':return html(String(renderMe({l,channels:await bar()},s)));
  case 'profile':{const m=await loadProfile(db,/** @type {string} */(route.name),{l,now,tab:q.get('tab')||'posts',channels:await bar()});return m?html(String(renderProfile(m,s))):null;}
  case 'mod':return html(String(renderMod({l,channels:await bar()},s)),'private, no-store');
  case 'search':return html(String(renderSearch(await loadSearch(db,{l,now,q:q.get('q')||'',in:q.get('in'),more:q.get('more')==='1',channels:await bar()}),s)),'private, no-store');
  case 'radar-feed':return xml(await radarFeed(db,l,s.origin));
  case 'radar':return html(String(renderRadar(await loadRadar(db,{l,now,vertical:q.get('v'),channels:await bar()}),s)));
 }
 if(route.ch){
  const ch=/** @type {import('../../platform/channels.js').Channel} */(channelById(route.ch));
  switch(route.page){
   case 'board':{
    // 말머리 of another channel, or the 게임 filters elsewhere: drop them (one URL per view).
    const k=q.get('kind'),bad=(k&&!(ch.flairs.includes(k)||k==='notice'))||(ch.id!=='games'&&(q.has('platform')||q.has('genre')))||(q.has('platform')&&q.has('genre'));
    if(bad){const x=new URLSearchParams(q);if(k&&!(ch.flairs.includes(k)||k==='notice'))x.delete('kind');if(ch.id!=='games'){x.delete('platform');x.delete('genre');}else if(x.has('platform'))x.delete('genre');return redirect(new URL(url.pathname+canonicalQuery('board',x),url).href);}
    return html(String(renderBoard(await loadBoard(db,{l,now,channel:ch.id,kind:k,tag:q.get('tag'),sort:q.get('sort')||'new',best:q.get('best')==='1',page:Number(q.get('page'))||1,platform:q.get('platform'),genre:q.get('genre'),channels:await bar()}),s)));
   }
   case 'board-best':return html(String(renderBoard(await loadBoard(db,{l,now,channel:ch.id,bestPage:true,page:Number(q.get('page'))||1,channels:await bar()}),s)));
   case 'board-feed':return xml(await boardFeed(db,ch.id,l,s.origin));
   case 'board-write':return html(String(renderWrite(await loadWrite(db,{l,now,channel:ch.id,tag:q.get('tag'),kind:q.get('kind'),result:q.get('result'),channels:await bar()}),s)));
   case 'board-post':{
    const m=await loadPost(db,ch.id,/** @type {number} */(route.no),{l,now,channels:await bar()});
    if(m)return html(String(renderPost(m,s)));
    // A deleted or hidden post (or a number never used): say so and lead back to the channel, with a
    // real 404 status so search engines drop the URL.
    const ko=l==='ko',base=channelPath(l,ch.id),name=channelName(ch.id,l);
    const body=page({l,title:ko?'글을 찾을 수 없습니다 | Nerulio':'Post not found | Nerulio',description:'',canonical:s.origin+base,noindex:true,channels:await bar(),
     body:rawHtml`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'삭제되었거나 숨겨진 글입니다':'This post was deleted or hidden'}</h1></div><p class="empty">${ko?'작성자가 삭제했거나, 신고로 임시조치된 글일 수 있어요.':'The author deleted it, or it was hidden after a report.'}</p><p class="pad"><a class="btn p" href="${base}">${ko?`${name} 채널로 가기 ›`:`Go to ${name} ›`}</a></p></section></div>`});
    return new Response(String(body),{status:404,headers:{...PAGE_HEADERS,'cache-control':CACHE_CONTROL}});
   }
  }
 }
 if(route.page==='hub'){const m=await loadHub(db,/** @type {string} */(route.vertical),{l,now,type:q.get('type'),org:q.get('org'),sort:q.get('sort'),vs:q.get('vs'),page:Number(q.get('page'))||1,channels:await bar()});return m?html(String(renderHub(m,s))):null;}
 const {entity,redirect:moved}=await entityBySlug(db,/** @type {string} */(route.vertical),/** @type {string} */(route.slug));
 if(!entity){
  if(moved)return redirect(new URL(`/${l}/${route.vertical}/${moved}/${route.page==='channel'?'':route.page==='legacy-post'?route.no:route.page==='feed'?'feed.xml':route.page==='legacy-write'?'write':route.page}${search}`,url).href);
  return null;
 }
 if(route.page==='legacy-post'){
  const to=await legacyPost(db,entity.id,/** @type {number} */(route.no));
  // A number that never existed on the old board: the tag page (its posts are all there now).
  return redirect(new URL(to?postPath(l,to.channel,to.no):`/${l}/${route.vertical}/${route.slug}/`,url).href);
 }
 if(route.page==='legacy-write'){
  const facts=(await factsFor(db,[entity.id])).get(entity.id)||[];
  return new Response(null,{status:302,headers:{location:new URL(writePath(l,defaultChannelOf(entity,facts),{tag:entity.id,kind:q.get('kind')})+(q.get('result')?`&result=${q.get('result')}`:''),url).href,'cache-control':'no-store'}});
 }
 const channels=await bar();
 switch(route.page){
  // Post titles: expires with the pages (a hidden or deleted post leaves every copy within a minute).
  case 'feed':return xml(await channelFeed(db,entity,l,s.origin),60);
  case 'history':return html(String(renderHistory(await loadHistory(db,entity,{l,now,channels}),s)));
  case 'local-llm':return entity.type==='gpu'?html(String(renderLocalLlm(await loadLocalLlm(db,entity,{l,now,channels}),s))):null;
  case 'status':return entity.type==='service'?html(String(renderStatus(await loadStatus(db,entity,{l,now,channels}),s))):null;
 }
 return html(String(renderChannel(await loadChannel(db,entity,{l,now,kind:q.get('kind'),sort:q.get('sort')||'new',best:q.get('best')==='1',page:Number(q.get('page'))||1,children:q.get('sub')!=='0',channels}),s)));
}
const html=(/** @type {string} */ body,cache=CACHE_CONTROL)=>new Response(body,{headers:{...PAGE_HEADERS,'cache-control':cache}});
const xml=(/** @type {string} */ body,edge=600)=>new Response(body,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':`public, max-age=0, s-maxage=${edge}`,'x-content-type-options':'nosniff'}});
const redirect=(/** @type {string} */ to)=>new Response(null,{status:301,headers:{location:to,'cache-control':'public, max-age=3600'}});

const SITEMAP=/^\/sitemap-n2-([a-z]+)\.xml$/;
const xmlEsc=(/** @type {string} */ s)=>s.replace(/[&<>"']/g,c=>/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
/**
 * Entity sitemap of one vertical: only channels that pass the content gate, both languages with
 * hreflang alternates, lastmod = last visible change or post. Service status pages are listed too.
 * @param {any} db @param {string} vertical @param {string} origin
 */
export async function renderSitemap(db,vertical,origin){
 // The home status box's services (Claude, ChatGPT, Gemini) are always listed: their status pages are
 // what people land on when the service breaks ("클로드 안 됨"), whatever the content gate says.
 const always=new Set(RAIL_SERVICES.map(x=>x.id));
 const rows=(await sitemapEntities(db,vertical)).filter(e=>(always.has(e.id)&&e.index_state!=='noindex')||indexable(e,{facts:e.facts,relations:e.relations,posts:e.posts,description:!!(e.descriptions.ko||e.descriptions.en)}));
 const urls=[];
 const hub={ko:`${origin}/ko/${vertical}/`,en:`${origin}/en/${vertical}/`};
 for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(hub[l])}</loc><xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(hub.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(hub.en)}"/></url>`);
 // Change histories with real changes (at least 3 besides first sightings) are pages of their own.
 const hist=new Set(((await db.prepare(`SELECT entity_id FROM changes WHERE vertical=? AND visibility='public' AND kind NOT IN ('entity_added','fact_added') GROUP BY entity_id HAVING COUNT(*)>=3`).bind(vertical).all()).results||[]).map((/** @type {any} */ r)=>String(r.entity_id)));
 // The comparison tables, and (in the AI file) the community front and the Radar.
 // The community front, its 전체 베스트 and every channel board are in the AI file (the first one).
 const extra=[...({ai:['?type=plan','?type=model'],hardware:['?type=gpu']}[vertical]||[]).map(q=>[`/${vertical}/${q}`]),...(vertical==='ai'?[['/community/best/'],...CHANNEL_IDS.map(c=>[`/community/${c}/`]),['/radar/']]:[])];
 if(vertical==='ai'){
  const home={ko:`${origin}/`,en:`${origin}/en/`};
  for(const l of /** @type {const} */(['ko','en']))urls.push(`<url><loc>${xmlEsc(home[l])}</loc><xhtml:link rel="alternate" hreflang="ko" href="${xmlEsc(home.ko)}"/><xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(home.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(home.ko)}"/></url>`);
 }
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
