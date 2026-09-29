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
 * - Without the UPLOADS binding the API answers 503 NOT_CONFIGURED {need:'UPLOADS'} and the pages hide the
 *   image picker. */
import {ApiError,json} from '../http.js';
import {hex,hmacHex} from '../crypto.js';
import {cleanImage,ImageError,IMAGE_LIMITS} from './images.js';
import {ANON} from './anon.js';

export const UPLOAD_PATH=/^\/u\/([a-z0-9]{8,64})\/(?:thumb|medium|full)\.(webp|png|jpg)$/;
const IMAGE_REF=/!\[[^\]\n]{0,200}\]\(\/u\/([a-z0-9]{8,64})\/(?:thumb|medium|full)\.(?:webp|png|jpg)\)/g;
const EXT=/** @type {Record<string,string>} */({'image/webp':'webp','image/png':'png','image/jpeg':'jpg'});
/** Browsers keep a served image a week (an id never changes content); the edge copy (Cache API, s-maxage)
 * lives an hour, so an image of a post hidden later disappears from every Cloudflare location within the
 * hour even where the purge (Cache API: this location only) did not reach. */
export const IMAGE_CACHE=Object.freeze({control:'public, max-age=604800, s-maxage=3600, immutable'});

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

/**
 * Validate, clean and store one image. The caller has already done the bot check and the limits.
 * @param {{env:any,db:any,request:Request,owner:string,userId:string,anonNet:string|null,now:number}} o
 */
export async function storeUpload(o){
 if(!/^image\/(webp|jpeg|png|gif|avif|heic|heif)$|^application\/octet-stream$/i.test(o.request.headers.get('content-type')||''))throw new ApiError('UNSUPPORTED_MEDIA_TYPE','Send the image bytes with an image Content-Type.',{field:'image'});
 const raw=await readRaw(o.request,IMAGE_LIMITS.maxBytes);
 let img;try{img=cleanImage(raw);}catch(e){throw imageApiError(e);}
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

/** Purge the edge copies of images (this Cloudflare location; the edge copy expires within the hour
 * everywhere else). @param {string} origin @param {string[]} ids */
export async function purgeImages(origin,ids){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache||!ids.length)return;
 await Promise.all(ids.flatMap(id=>['webp','png','jpg'].map(ext=>cache.delete(new Request(`${origin}/u/${id}/full.${ext}`)).catch(()=>false))));
}
/** Images of a post or comment (for hide/restore/delete). @param {any} db @param {'discussion'|'comment'} kind @param {string} id
 * @returns {Promise<{id:string,r2_key:string,status:string,url:string,width:number,height:number}[]>} */
export async function imagesOf(db,kind,id){
 return ((await db.prepare('SELECT id,r2_key,status,mime,width,height FROM uploads WHERE attached_kind=? AND attached_id=?').bind(kind,id).all()).results||[])
  .map((/** @type {any} */ r)=>({id:String(r.id),r2_key:String(r.r2_key),status:String(r.status),url:`/u/${r.id}/full.${EXT[String(r.mime)]||'webp'}`,width:Number(r.width),height:Number(r.height)}));
}
/** Delete image bytes from R2 and mark the rows deleted. removed: author | mod | expired.
 * @param {any} env @param {any} db @param {{id:string,r2_key:string}[]} list @param {string} removed @param {string} origin */
export async function deleteImages(env,db,list,removed,origin){
 if(!list.length)return;
 if(uploadsConfigured(env))await env.UPLOADS.delete(list.map(x=>x.r2_key)).catch(()=>Promise.all(list.map(x=>env.UPLOADS.delete(x.r2_key).catch(()=>{}))));
 await db.prepare(`UPDATE uploads SET status='deleted',removed=? WHERE id IN (${list.map(()=>'?').join(',')})`).bind(removed,...list.map(x=>x.id)).run();
 await purgeImages(origin,list.map(x=>x.id));
}
/** Uploads nobody used within a day: bytes deleted, rows marked expired (a few per run).
 * @param {any} env @param {any} db @param {number} now @param {string} origin */
export async function expireUnattached(env,db,now,origin){
 if(!uploadsConfigured(env))return;
 const rows=((await db.prepare("SELECT id,r2_key FROM uploads WHERE attached_id IS NULL AND status='active' AND purpose='community' AND created_at<? LIMIT 50").bind(now-864e5).all()).results||[]);
 await deleteImages(env,db,rows.map((/** @type {any} */ r)=>({id:String(r.id),r2_key:String(r.r2_key)})),'expired',origin);
}

const IMAGE_HEADERS=Object.freeze({'x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",'cross-origin-resource-policy':'same-origin','referrer-policy':'no-referrer'});
/** @param {number} status @param {string} [cache] */
const refuse=(status,cache='public, max-age=60')=>new Response(status===451?'Unavailable for legal reasons':'Not found',{status,headers:{...IMAGE_HEADERS,'content-type':'text/plain; charset=utf-8','cache-control':cache}});

/**
 * GET/HEAD /u/<id>/full.<ext>. `isModerator` is asked only for an image that is not public (hidden post),
 * so ordinary views never read the session. @param {Request} request @param {any} env @param {any} ctx
 * @param {{isModerator?:()=>Promise<boolean>}} [o] @returns {Promise<Response|null>}
 */
export async function serveUpload(request,env,ctx,o={}){
 const url=new URL(request.url),m=UPLOAD_PATH.exec(url.pathname);
 if(!m)return null;
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
 if(!uploadsConfigured(env)||!env.DB)return refuse(404);
 const cache=/** @type {any} */(globalThis).caches?.default,key=new Request(url.origin+url.pathname);
 const hit=cache?await cache.match(key):null;
 if(hit)return hit;
 const row=await env.DB.prepare(`SELECT u.id,u.r2_key,u.mime,u.status,u.removed,u.attached_kind,u.attached_id,
  CASE u.attached_kind WHEN 'discussion' THEN (SELECT status FROM discussions WHERE id=u.attached_id)
   WHEN 'comment' THEN (SELECT CASE WHEN c.status='published' AND d.status IN ('published','locked') THEN 'published' ELSE 'hidden' END FROM comments c JOIN discussions d ON d.id=c.discussion_id WHERE c.id=u.attached_id) END AS parent
  FROM uploads u WHERE u.id=?`).bind(m[1]).first();
 if(!row||EXT[String(row.mime)]!==m[2])return refuse(404);
 if(row.status==='deleted')return refuse(row.removed==='mod'?451:404);
 const visible=row.status==='active'&&row.attached_id!=null&&(row.parent==='published'||row.parent==='locked');
 let privateView=false;
 if(!visible){
  // Hidden (임시조치) images stay visible to moderators so they can judge them; never cached.
  if(row.status==='deleted'||!o.isModerator||!(await o.isModerator()))return refuse(404,'no-store');
  privateView=true;
 }
 const obj=await env.UPLOADS.get(String(row.r2_key));
 if(!obj)return refuse(404);
 const body=request.method==='HEAD'?null:(obj.body??await obj.arrayBuffer());
 const headers={...IMAGE_HEADERS,'content-type':String(row.mime),'content-disposition':`inline; filename="${row.id}.${m[2]}"`,etag:`"${row.id}"`,
  'cache-control':privateView?'private, no-store':IMAGE_CACHE.control,...(obj.size!=null?{'content-length':String(obj.size)}:{})};
 const res=new Response(body,{headers});
 if(!privateView&&cache&&request.method==='GET'){
  const p=cache.put(key,res.clone()).catch(()=>{});ctx?.waitUntil?.(p);
 }
 return res;
}

/** Response for a successful upload. @param {Awaited<ReturnType<typeof storeUpload>>} r @param {string[]} cookies */
export const uploaded=(r,cookies)=>json({id:r.id,url:r.url,width:r.width,height:r.height,bytes:r.bytes,mime:r.mime},201,{'Set-Cookie':cookies});
