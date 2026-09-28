// @ts-check
/** Server-rendered platform pages (architecture D4), only in builds with PLATFORM=on:
 *   /{l}/community/                     community front
 *   /{l}/{vertical}/{slug}/             channel (entity wiki + board)
 *   /{l}/{vertical}/{slug}/{no}         post
 * Anonymous HTML is identical for everyone (personal state comes from islands), so responses are
 * cached at the edge for a minute and served stale while they re-render. */
import {entityBySlug,activeChannels,entitiesByIds} from '../../platform/db/channel.js';
import {loadChannel,renderChannel} from '../../platform/render/channel.js';
import {loadPost,renderPost} from '../../platform/render/post.js';
import {loadFront,renderFront} from '../../platform/render/front.js';
import {loadWrite,renderWrite} from '../../platform/render/write.js';
import {channelUrl,nameOf} from '../../platform/render/ui.js';
import {VERTICALS,PLATFORM_LOCALES} from '../../platform/schema.js';

const ROUTE=new RegExp(`^/(${PLATFORM_LOCALES.join('|')})/(?:(community)/|(${VERTICALS.join('|')})/([a-z0-9][a-z0-9-]{0,95})/(?:(\\d{1,9})|(write))?)$`);
export const CACHE_CONTROL='public, max-age=0, s-maxage=60, stale-while-revalidate=600';
/** Channel bar for anonymous readers: the week's most active channels, topped up with featured ones. */
export const FEATURED=Object.freeze(['service:claude','service:chatgpt','service:gemini-app','service:claude-code','gpu:rtx-5070','app:blender','app:ableton-live']);

/** @param {string} pathname */
export function matchPlatformRoute(pathname){
 const m=ROUTE.exec(pathname);
 if(!m)return null;
 const [,l,community,vertical,slug,no,write]=m;
 return community?{l,page:/** @type {const} */('front')}:{l,page:no?/** @type {const} */('post'):write?/** @type {const} */('write'):/** @type {const} */('channel'),vertical,slug,no:no?Number(no):null};
}

/** @param {any} db @param {string} l @param {number} now */
export async function channelBar(db,l,now){
 const active=(await activeChannels(db,now-7*864e5,8)).map(c=>c.entity);
 const ids=new Set(active.map(e=>e.id));
 const featured=[...(await entitiesByIds(db,FEATURED.filter(id=>!ids.has(id)))).values()];
 return [...active,...featured].slice(0,9).map(e=>({name:nameOf(e,l),href:channelUrl(l,e)}));
}

/**
 * Render a platform page, or null when the path is not one (the static site handles it).
 * @param {Request} request @param {{DB:any}} env @param {{origin:string,now?:()=>number}} site
 */
export async function renderPlatformPage(request,env,site){
 const url=new URL(request.url),route=matchPlatformRoute(url.pathname);
 if(!route||!env.DB)return null;
 const now=(site.now||Date.now)(),db=env.DB,l=route.l,s={origin:site.origin||url.origin};
 const channels=await channelBar(db,l,now);
 if(route.page==='front'){
  const v=url.searchParams.get('v');
  return html(String(renderFront(await loadFront(db,{l,now,vertical:v,channels}),s)));
 }
 const {entity,redirect}=await entityBySlug(db,/** @type {string} */(route.vertical),/** @type {string} */(route.slug));
 if(!entity){
  if(redirect)return Response.redirect(new URL(`/${l}/${route.vertical}/${redirect}/${route.page==='write'?'write':route.no??''}${url.search}`,url).href,301);
  return null;
 }
 if(route.page==='write')return html(String(renderWrite(await loadWrite(db,entity,{l,kind:url.searchParams.get('kind'),channels}),s)));
 if(route.page==='post'){
  const m=await loadPost(db,entity,/** @type {number} */(route.no),{l,now,channels});
  return m?html(String(renderPost(m,s))):null;
 }
 const q=url.searchParams,page=Math.min(1000,Math.max(1,Number(q.get('page'))||1));
 return html(String(renderChannel(await loadChannel(db,entity,{l,now,kind:q.get('kind'),sort:q.get('sort')||'new',best:q.get('best')==='1',page,channels}),s)));
}
const html=(/** @type {string} */ body)=>new Response(body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':CACHE_CONTROL,'x-content-type-options':'nosniff'}});

/** Edge cache in front of renderPlatformPage (GET only; query strings are part of the key).
 * @param {Request} request @param {any} env @param {any} ctx @param {{origin:string}} site */
export async function handlePlatformPage(request,env,ctx,site){
 if(request.method!=='GET'&&request.method!=='HEAD')return null;
 if(!matchPlatformRoute(new URL(request.url).pathname))return null;
 const cache=/** @type {any} */(globalThis).caches?.default;
 const key=new Request(request.url,{method:'GET'});
 const hit=cache?await cache.match(key):null;
 if(hit)return hit;
 const res=await renderPlatformPage(request,env,site);
 if(res&&res.status===200&&cache)ctx?.waitUntil?.(cache.put(key,res.clone()));
 return res;
}
