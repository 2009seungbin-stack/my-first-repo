// @ts-check
/** Community images: POST /api/v2/uploads (members and anonymous writers) → R2 (binding UPLOADS), and
 * GET /u/<id>/full.<ext> on the site's own origin (so the images are served through the nerulio.com zone,
 * where Cloudflare's CSAM Scanning Tool and cache apply, and never hotlinked from elsewhere).
 *
 * - The body is the image itself (the picker re-encodes it first); server/platform/images.js checks the
 *   magic bytes, strips metadata and trailing data, and enforces size and pixel limits.
 * - An upload belongs to its uploader (owner) until a post uses it; only images that are part of a visible
 *   post are served. Unattached uploads are deleted after a day; an image of a hidden post answers 404
 *   (moderators still see it, uncached), an image removed by a moderator 451.
 * - Takedown: every request (cache hit or not, any query string) first checks the image's state in D1,
 *   remembered in the isolate for at most IMAGE_CACHE.stateTtlMs, so a deleted or hidden image stops being
 *   served everywhere within seconds; a purge (Cache API: one Cloudflare location only) is not needed for
 *   that. The edge copy (Cache API) only saves the R2 read; browsers keep an image an hour, privately.
 * - Without the UPLOADS binding the API answers 503 NOT_CONFIGURED {need:'UPLOADS'} and the pages hide the
 *   image picker. */
import {ApiError,json} from '../http.js';
import {hex,hmacHex} from '../crypto.js';
import {cleanImage,ImageError,IMAGE_LIMITS} from './images.js';
import {ANON} from './anon.js';

export const UPLOAD_PATH=/^\/u\/([a-z0-9]{8,64})\/(?:thumb|medium|full)\.(webp|png|jpg)$/;
const IMAGE_REF=/!\[[^\]\n]{0,200}\]\(\/u\/([a-z0-9]{8,64})\/(?:thumb|medium|full)\.(?:webp|png|jpg)\)/g;
const EXT=/** @type {Record<string,string>} */({'image/webp':'webp','image/png':'png','image/jpeg':'jpg'});
/** Caching of community images, chosen so a takedown is fast everywhere:
 * - control: what browsers get. `private` keeps shared caches (proxies, a CDN rule) out of it; an hour is the
 *   longest a viewer who already loaded an image keeps seeing it from their own cache (that copy cannot be
 *   revoked). After the hour the browser revalidates with If-None-Match and gets a 304 without the bytes.
 * - edge: the Worker's Cache API copy of the bytes (key: the request origin + /u/<id>/full.<ext>). It is never
 *   served without the state check, so its lifetime only bounds how long removed bytes sit unserved.
 * - stateTtlMs: how long an isolate trusts a "public" (or "deleted", which is final) answer from D1 before it
 *   asks again: the worst case for an isolate that did not handle the takedown itself. */
export const IMAGE_CACHE=Object.freeze({control:'private, max-age=3600',edge:'public, max-age=3600',stateTtlMs:10e3});

/** @param {any} env */
export const uploadsConfigured=env=>!!(env?.UPLOADS&&typeof env.UPLOADS.put==='function'&&typeof env.UPLOADS.get==='function');
export const uploadsNotConfigured=()=>new ApiError('NOT_CONFIGURED','Image uploads need the R2 binding UPLOADS on this deployment.',{need:'UPLOADS'},{need:'UPLOADS',missing:['UPLOADS']});

/** Upload ids referenced by a text, in order, without repeats. @param {string} md */
export function imageRefs(md){
 /** @type {string[]} */
 const out=[];
 for(const m of String(md||'').matchAll(IMAGE_REF))if(!out.includes(m[1]))out.push(m[1]);
 return out;
}
/** Any image syntax pointing at our upload path (also malformed ones). @param {string} md */
export const hasImageSyntax=md=>/!\[[^\]\n]{0,200}\]\(\/u\//.test(String(md||''));
/** Owner key of an upload. @param {{user?:{id:string}|null,anonId?:string|null}} context @param {string} secret */
export async function ownerOf(context,secret){
 return context.user?`u:${context.user.id}`:`a:${(await hmacHex(secret,`upload-owner/v1\n${context.anonId}`)).slice(0,32)}`;
}

/** Read a raw body up to `limit` bytes. @param {Request} request @param {number} limit */
async function readRaw(request,limit){
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>limit)throw new ApiError('PAYLOAD_TOO_LARGE',`Images must be at most ${Math.round(limit/1048576)} MB.`,{field:'image'});
 if(!request.body)return new Uint8Array(0);
 const reader=request.body.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw new ApiError('PAYLOAD_TOO_LARGE',`Images must be at most ${Math.round(limit/1048576)} MB.`,{field:'image'});}chunks.push(value);}
 const all=new Uint8Array(size);let o=0;for(const c of chunks){all.set(c,o);o+=c.byteLength;}
 return all;
}
/** ImageError → API error (codes are the client contract). @param {unknown} e */
function imageApiError(e){
 if(!(e instanceof ImageError))return e;
 if(e.code==='TOO_LARGE')return new ApiError('PAYLOAD_TOO_LARGE',e.message,{field:'image',reason:e.code});
 if(e.code==='UNSUPPORTED'||e.code==='ANIMATED')return new ApiError('UNSUPPORTED_MEDIA_TYPE',e.message,{field:'image',reason:e.code});
 return new ApiError('BAD_REQUEST',e.message,{field:'image',reason:e.code});
}

/** Read and check one uploaded image (the request body) before anything is counted or stored.
 * @param {Request} request @returns {Promise<import('./images.js').CleanImage>} */
export async function readUpload(request){
 if(!/^image\/(webp|jpeg|png|gif|avif|heic|heif)$|^application\/octet-stream$/i.test(request.headers.get('content-type')||''))throw new ApiError('UNSUPPORTED_MEDIA_TYPE','Send the image bytes with an image Content-Type.',{field:'image'});
 const raw=await readRaw(request,IMAGE_LIMITS.maxBytes);
 try{return cleanImage(raw);}catch(e){throw imageApiError(e);}
}
/**
 * Store one checked image in R2 and D1. The caller has already done the bot check and the limits.
 * @param {{env:any,db:any,img:import('./images.js').CleanImage,owner:string,userId:string,anonNet:string|null,now:number}} o
 */
export async function storeUpload(o){
 const img=o.img;
 const id=hex(crypto.getRandomValues(new Uint8Array(12))),key=`c/${id}.${img.ext}`;
 const digest=hex(await crypto.subtle.digest('SHA-256',/** @type {BufferSource} */(/** @type {unknown} */(img.bytes))));
 await o.env.UPLOADS.put(key,img.bytes,{httpMetadata:{contentType:img.mime,cacheControl:IMAGE_CACHE.control,contentDisposition:`inline; filename="${id}.${img.ext}"`}});
 try{
  await o.db.prepare("INSERT INTO uploads (id,user_id,purpose,r2_key,mime,bytes,width,height,status,created_at,owner,anon_net,sha256) VALUES (?,?,'community',?,?,?,?,?,'active',?,?,?,?)")
   .bind(id,o.userId,key,img.mime,img.bytes.length,img.width,img.height,o.now,o.owner,o.anonNet,digest).run();
 }catch(e){await o.env.UPLOADS.delete(key).catch(()=>{});throw e;}
 return {id,url:`/u/${id}/full.${img.ext}`,width:img.width,height:img.height,bytes:img.bytes.length,mime:img.mime,stripped:img.stripped};
}

/**
 * Check the images a post (or its edit) uses and return the statements that attach them. Every image must
 * be the writer's own upload, still unattached, or already part of this post. Images a post no longer uses
 * after an edit are returned in `dropped` (the caller deletes them).
 * @param {any} db @param {{md:string,owner:string,kind:'discussion'|'comment',id:string,max?:number}} o
 */
export async function attachPlan(db,o){
 const ids=imageRefs(o.md),max=o.max??ANON.imagesPerPost;
 if(ids.length>max)throw new ApiError('BAD_REQUEST',`At most ${max} images per post.`,{field:'body',reason:'images'});
 const rows=ids.length?((await db.prepare(`SELECT id,owner,status,attached_kind,attached_id FROM uploads WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all()).results||[]):[];
 const byId=new Map(rows.map((/** @type {any} */ r)=>[String(r.id),r]));
 for(const id of ids){
  const r=byId.get(id);
  const mine=r&&r.status==='active'&&((r.attached_id==null&&r.owner===o.owner)||(r.attached_kind===o.kind&&r.attached_id===o.id));
  if(!mine)throw new ApiError('BAD_REQUEST','An image in the text is not one you uploaded (or it was removed).',{field:'body',reason:'image_ref'});
 }
 const current=((await db.prepare("SELECT id,r2_key FROM uploads WHERE attached_kind=? AND attached_id=? AND status='active'").bind(o.kind,o.id).all()).results||[]);
 const dropped=current.filter((/** @type {any} */ r)=>!ids.includes(String(r.id))).map((/** @type {any} */ r)=>({id:String(r.id),r2_key:String(r.r2_key)}));
 const fresh=ids.filter(id=>byId.get(id)?.attached_id==null);
 const statements=fresh.length?[db.prepare(`UPDATE uploads SET attached_kind=?,attached_id=? WHERE attached_id IS NULL AND id IN (${fresh.map(()=>'?').join(',')})`).bind(o.kind,o.id,...fresh)]:[];
 return {ids,statements,dropped};
}

/** Where images and pages can sit in the Cache API: every origin the site answers on (the request's own,
 * SITE_URL, the build's site URL). @param {string|string[]} origins */
export const originList=origins=>[...new Set((Array.isArray(origins)?origins:[origins]).filter(Boolean))];
/** Every cache key an image can have under the given origins (all variants and extensions; today only
 * /u/<id>/full.<ext> is stored, older deployments stored the requested variant). @param {string|string[]} origins @param {string[]} ids */
export const imageCacheKeys=(origins,ids)=>originList(origins).flatMap(o=>ids.flatMap(id=>['thumb','medium','full'].flatMap(v=>['webp','png','jpg'].map(ext=>`${o}/u/${id}/${v}.${ext}`))));
/** Forget the images' remembered state in this isolate and purge their edge copies at this Cloudflare
 * location, under every origin. Other isolates and locations re-check D1 within IMAGE_CACHE.stateTtlMs.
 * @param {string|string[]} origins @param {string[]} ids */
export async function purgeImages(origins,ids){
 if(!ids.length)return;
 for(const id of ids)stateMemo.delete(id);
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return;
 await Promise.all(imageCacheKeys(origins,ids).map(k=>cache.delete(new Request(k)).catch(()=>false)));
}
/** Images of a post or comment (for hide/restore/delete). @param {any} db @param {'discussion'|'comment'} kind @param {string} id
 * @returns {Promise<{id:string,r2_key:string,status:string,url:string,width:number,height:number}[]>} */
export async function imagesOf(db,kind,id){
 return ((await db.prepare('SELECT id,r2_key,status,mime,width,height FROM uploads WHERE attached_kind=? AND attached_id=?').bind(kind,id).all()).results||[])
  .map((/** @type {any} */ r)=>({id:String(r.id),r2_key:String(r.r2_key),status:String(r.status),url:`/u/${r.id}/full.${EXT[String(r.mime)]||'webp'}`,width:Number(r.width),height:Number(r.height)}));
}
/** Delete image bytes from R2 and mark the rows deleted. removed: author | mod | expired.
 * @param {any} env @param {any} db @param {{id:string,r2_key:string}[]} list @param {string} removed @param {string|string[]} origins */
export async function deleteImages(env,db,list,removed,origins){
 if(!list.length)return;
 if(uploadsConfigured(env))await env.UPLOADS.delete(list.map(x=>x.r2_key)).catch(()=>Promise.all(list.map(x=>env.UPLOADS.delete(x.r2_key).catch(()=>{}))));
 await db.prepare(`UPDATE uploads SET status='deleted',removed=? WHERE id IN (${list.map(()=>'?').join(',')})`).bind(removed,...list.map(x=>x.id)).run();
 await purgeImages(origins,list.map(x=>x.id));
}
/** Uploads nobody used within a day: bytes deleted, rows marked expired (a few per run).
 * @param {any} env @param {any} db @param {number} now @param {string|string[]} origins */
export async function expireUnattached(env,db,now,origins){
 if(!uploadsConfigured(env))return;
 const rows=((await db.prepare("SELECT id,r2_key FROM uploads WHERE attached_id IS NULL AND status='active' AND purpose='community' AND created_at<? LIMIT 50").bind(now-864e5).all()).results||[]);
 await deleteImages(env,db,rows.map((/** @type {any} */ r)=>({id:String(r.id),r2_key:String(r.r2_key)})),'expired',origins);
}

const IMAGE_HEADERS=Object.freeze({'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",'cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer'});
/** @param {number} status @param {string} [cache] */
const refuse=(status,cache='no-store')=>new Response(status===451?'Unavailable for legal reasons':'Not found',{status,headers:{...IMAGE_HEADERS,'content-type':'text/plain; charset=utf-8','cache-control':cache}});

/** @typedef {{id:string,r2_key:string,mime:string,status:string,removed:string|null,attached_id:string|null,parent:string|null}} ImageRow */
/** An image's state per id, remembered in this isolate. Only answers that cannot surprise a viewer are kept
 * (public, and deleted, which is final); hidden, unattached and unknown ids are asked every time, so a
 * restore or a fresh post shows at once. @type {Map<string,{at:number,row:ImageRow}>} */
const stateMemo=new Map();
export const resetImageStateCache=()=>stateMemo.clear();
/** @param {ImageRow} r */
const isPublic=r=>r.status==='active'&&r.attached_id!=null&&(r.parent==='published'||r.parent==='locked');
/** @param {any} db @param {string} id @param {number} now @returns {Promise<ImageRow|null>} */
async function imageState(db,id,now){
 const hit=stateMemo.get(id);
 if(hit&&now>=hit.at&&now-hit.at<IMAGE_CACHE.stateTtlMs)return hit.row;
 const r=await db.prepare(`SELECT u.id,u.r2_key,u.mime,u.status,u.removed,u.attached_id,
  CASE u.attached_kind WHEN 'discussion' THEN (SELECT status FROM discussions WHERE id=u.attached_id)
   WHEN 'comment' THEN (SELECT CASE WHEN c.status='published' AND d.status IN ('published','locked') THEN 'published' ELSE 'hidden' END FROM comments c JOIN discussions d ON d.id=c.discussion_id WHERE c.id=u.attached_id) END AS parent
  FROM uploads u WHERE u.id=?`).bind(id).first();
 if(!r){stateMemo.delete(id);return null;}
 /** @type {ImageRow} */
 const row={id:String(r.id),r2_key:String(r.r2_key),mime:String(r.mime),status:String(r.status),removed:r.removed==null?null:String(r.removed),attached_id:r.attached_id==null?null:String(r.attached_id),parent:r.parent==null?null:String(r.parent)};
 if(isPublic(row)||row.status==='deleted'){
  if(stateMemo.size>=5000)stateMemo.clear();
  stateMemo.set(id,{at:now,row});
 }else stateMemo.delete(id);
 return row;
}

/**
 * GET/HEAD /u/<id>/{thumb,medium,full}.<ext>. The image's state is checked on every request before the edge
 * copy is used, so neither a query string nor a cached copy ever serves a removed image. `isModerator` is
 * asked only for an image that is not public (hidden post), so ordinary views never read the session.
 * @param {Request} request @param {any} env @param {any} ctx
 * @param {{isModerator?:()=>Promise<boolean>,now?:()=>number}} [o] @returns {Promise<Response|null>}
 */
export async function serveUpload(request,env,ctx,o={}){
 const url=new URL(request.url),m=UPLOAD_PATH.exec(url.pathname);
 if(!m)return null;
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
 if(!uploadsConfigured(env)||!env.DB)return refuse(404);
 const row=await imageState(env.DB,m[1],(o.now||Date.now)());
 // An id that never existed (or the wrong extension) never becomes an image: that answer may be cached briefly.
 if(!row||EXT[row.mime]!==m[2])return refuse(404,'public, max-age=60');
 if(row.status==='deleted')return row.removed==='mod'?refuse(451,'public, max-age=300'):refuse(404);
 let privateView=false;
 if(!isPublic(row)){
  // Hidden (임시조치) images stay visible to moderators so they can judge them; never cached.
  if(!o.isModerator||!(await o.isModerator()))return refuse(404);
  privateView=true;
 }
 const etag=`"${row.id}"`;
 const headers=/** @type {Record<string,string>} */({...IMAGE_HEADERS,'content-type':row.mime,'content-disposition':`inline; filename="${row.id}.${m[2]}"`,etag,
  'cache-control':privateView?'private, no-store':IMAGE_CACHE.control});
 // The bytes of an id never change: a browser revalidating a public image gets a 304 without them.
 if(!privateView&&(request.headers.get('if-none-match')||'').split(',').map(v=>v.trim().replace(/^W\//,'')).includes(etag))return new Response(null,{status:304,headers});
 const cache=privateView?null:/** @type {any} */(globalThis).caches?.default;
 // One edge copy per image and origin, whatever variant or query string was asked for.
 const key=new Request(`${url.origin}/u/${row.id}/full.${m[2]}`);
 const hit=cache?await cache.match(key).catch(()=>null):null;
 if(hit){
  const len=hit.headers.get('content-length');
  if(request.method==='HEAD')await hit.body?.cancel?.().catch(()=>{});
  return new Response(request.method==='HEAD'?null:hit.body,{headers:{...headers,...(len?{'content-length':len}:{})}});
 }
 const obj=await env.UPLOADS.get(row.r2_key);
 if(!obj)return refuse(404);
 if(obj.size!=null)headers['content-length']=String(obj.size);
 if(request.method==='HEAD'){await obj.body?.cancel?.().catch(()=>{});return new Response(null,{headers});}
 const body=obj.body??await obj.arrayBuffer();
 if(!cache)return new Response(body,{headers});
 // The edge copy carries its own lifetime (IMAGE_CACHE.edge); what a browser gets is decided above.
 const edge=new Response(body,{headers:{...headers,'cache-control':IMAGE_CACHE.edge}}),res=edge.clone();
 const p=cache.put(key,edge).catch(()=>{});ctx?.waitUntil?.(p);
 return new Response(res.body,{headers});
}

/** Response for a successful upload. @param {Awaited<ReturnType<typeof storeUpload>>} r @param {string[]} cookies */
export const uploaded=(r,cookies)=>json({id:r.id,url:r.url,width:r.width,height:r.height,bytes:r.bytes,mime:r.mime},201,{'Set-Cookie':cookies});
