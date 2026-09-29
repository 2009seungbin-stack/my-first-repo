// @ts-check
/** /api/v2 — the platform's write API for the page islands (PLATFORM=on builds only).
 * Same conventions as /api/v1: JSON bodies only (image uploads send the image bytes), same-origin POSTs,
 * no CORS, session cookie auth, app-level burst limits, error codes as the client contract. Reading is
 * anonymous. Members write with their account; posts, comments, votes, reports and images also work
 * without one (유동: nickname + daily ID + edit password, behind Turnstile and per-network limits —
 * server/platform/anon.js). Follows, profile, proposals, compat/benchmark reports and rollout votes stay
 * member-only. After a write, the edge-cached page it changes is purged so the author sees it at once. */
import {runtimeConfig} from '../config.js';
import {ApiError,json,errorResponse,readJSON} from '../http.js';
import {resolveContext} from '../identity.js';
import {allowRequest} from '../ratelimit.js';
import {randomToken} from '../crypto.js';
import {assertSameOrigin} from '../api.js';
import {POST_KINDS,writableKinds,createPost,castVote,recomputeCompat,boardOpen,LIMITS} from '../../platform/community.js';
export {LIMITS};
import {envKey,ENTITY_ID,PLATFORMS} from '../../platform/schema.js';
import {channelUrl,postUrl,nameOf} from '../../platform/render/ui.js';
import {changesFor,entitiesByIds} from '../../platform/db/channel.js';
import {describeChange} from '../../platform/change-text.js';
import {validateSeed,SEED_SCHEMA} from '../../platform/seed.js';
import {ingest} from '../../platform/ingest.js';
import {typeDef,propertyDef} from '../../platform/verticals/index.js';
import {handleAdminApi,isAdminRoute} from './admin.js';
import {notifyNewFlag} from './admin-notify.js';
import {handleHit} from '../traffic.js';
import {configuredProviders} from '../oauth/providers.js';
import {ANON,REPORT,ANON_USER,anonIdentity,anonSecret,anonMode,assertAnonEnabled,humanGate,takeDaily,readDaily,hourKey,assertNotBanned,countLinks,blocklistVerdict,textHash,anonCleanupStatements,hashPassword,verifyPassword,kstDay,normalizeText} from './anon.js';
import {uploadsConfigured,uploadsNotConfigured,storeUpload,uploaded,attachPlan,hasImageSyntax,imagesOf,deleteImages,purgeImages,expireUnattached,ownerOf} from './uploads.js';
import {IMAGE_LIMITS} from './images.js';

const ROUTES=/** @type {Record<string,1>} */({'GET /state':1,'GET /new-posts':1,'POST /follow':1,'POST /posts':1,'POST /comments':1,'POST /votes':1,'POST /reports':1,'POST /rollout':1,'POST /profile':1,'POST /flags':1,'GET /my-radar':1,'POST /my-radar/seen':1,'GET /mod/queue':1,'GET /mine':1,'POST /facts/propose':1,'GET /open-data/compat':1,'GET /comments/source':1,'GET /follows':1,'GET /posts/source':1,'POST /posts/solve':1,'POST /posts/edit':1,'POST /posts/delete':1,'POST /comments/edit':1,'POST /comments/delete':1,'POST /mod/action':1,'POST /anon/check':1,'POST /uploads':1});
/** Writes that also work without an account. */
const ANON_ROUTES=/** @type {Record<string,1>} */({'POST /posts':1,'POST /comments':1,'POST /votes':1,'POST /flags':1,'POST /anon/check':1,'POST /uploads':1,'POST /posts/edit':1,'POST /posts/delete':1,'POST /comments/edit':1,'POST /comments/delete':1});
/** Edits of an anonymous post or comment: by its password, signed in or not. */
const ANON_EDITS=/** @type {Record<string,1>} */({'POST /posts/edit':1,'POST /posts/delete':1,'POST /comments/edit':1,'POST /comments/delete':1});
/** 신고 categories: the 0004 reasons plus the ones that hide at once (REPORT.severe). */
export const FLAG_CATEGORIES=Object.freeze(Object.keys(REPORT.reasonOf));

/** @param {unknown} v @param {[number,number]} range @param {string} field */
function text(v,[min,max],field){
 if(typeof v!=='string')throw new ApiError('BAD_REQUEST',`${field} is required.`);
 const s=v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
 if([...s].length<min||[...s].length>max)throw new ApiError('BAD_REQUEST',`${field} must be ${min}–${max} characters.`,{field});
 return s;
}
/** @param {unknown} v */
// Real version names include "Hotfix #36", "v1.0.2", "2.0.212.31 (beta)", "Patch 8"; control
// characters and markup never. The value is stored as text and always escaped on output.
const optVersion=v=>{if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||v.length>LIMITS.version||!/^[\p{L}\p{N}._+\-# ()*:/,']+$/u.test(v))throw new ApiError('BAD_REQUEST','Invalid version.');return v.trim();};
/** @param {Record<string,unknown>} body @param {string[]} allowed */
function only(body,allowed){for(const k of Object.keys(body))if(!allowed.includes(k))throw new ApiError('BAD_REQUEST',`Unexpected field: ${k.slice(0,40)}`);return body;}

/** Until a member picks a nickname: "user-" + the first characters of the account id. @param {string} id */
export const defaultNickname=id=>`user-${String(id).replace(/[^A-Za-z0-9]/g,'').slice(0,6).toLowerCase()}`;
/** Reserved: staff-looking names and the "user-xxxxxx" form every new account starts with. @param {string} name */
export const reservedNickname=name=>/^(레이더봇|radar ?bot|운영자|관리자|admin|nerulio)/i.test(name)||/^user-[a-z0-9]{1,12}$/i.test(name)||/^(ㅇㅇ|익명|유동|anonymous)$/i.test(name.trim());
/** A nickname to offer a member who still has the automatic one: the handle of their GitHub or Discord
 * account (a public handle there; never a Google or display name, which can be a legal name). It is only
 * pre-filled in the 내 정보 form; nothing is published until the member saves it. Null when the handle
 * breaks the nickname rules or someone already uses it. @param {any} db @param {string} userId */
export async function nicknameSuggestion(db,userId){
 let row=null;
 // A deployment whose D1 has not had 0011 applied yet simply offers nothing.
 try{row=await db.prepare("SELECT handle FROM user_identities WHERE user_id=? AND handle IS NOT NULL AND provider IN ('github','discord') ORDER BY COALESCE(last_login_at,created_at) DESC LIMIT 1").bind(userId).first();}catch{return null;}
 const name=typeof row?.handle==='string'?row.handle.trim():'';
 if([...name].length<LIMITS.nickname[0]||[...name].length>LIMITS.nickname[1]||reservedNickname(name))return null;
 const taken=await db.prepare('SELECT 1 FROM user_profiles WHERE lower(display_name)=lower(?) AND user_id<>?').bind(name,userId).first();
 return taken?null:name;
}
/** Public nickname: never the provider account's name. Created on first write. @param {any} db @param {any} user @param {number} now */
export async function ensureProfile(db,user,now){
 const row=await db.prepare('SELECT user_id,display_name,tier,role,banned_at,restricted_until FROM user_profiles WHERE user_id=?').bind(user.id).first();
 if(row)return row;
 const name=defaultNickname(user.id);
 await db.prepare("INSERT OR IGNORE INTO user_profiles (user_id,display_name,created_at,updated_at) VALUES (?,?,?,?)").bind(user.id,name,now,now).run();
 return {user_id:user.id,display_name:name,tier:'new',role:'user',banned_at:null,restricted_until:null};
}
/** @param {any} profile @param {number} now */
function assertMayWrite(profile,now){
 if(profile.banned_at)throw new ApiError('FORBIDDEN','This account cannot post.');
 if(profile.restricted_until&&Number(profile.restricted_until)>now)throw new ApiError('FORBIDDEN','This account is temporarily restricted.',{until:new Date(Number(profile.restricted_until)).toISOString()});
}
/** @param {any} db @param {string} id */
async function entity(db,id){
 if(typeof id!=='string'||!ENTITY_ID.test(id))throw new ApiError('BAD_REQUEST','Invalid channel.');
 const e=await db.prepare("SELECT id,vertical,type,slug,names FROM entities WHERE id=? AND status='active'").bind(id).first();
 if(!e)throw new ApiError('NOT_FOUND','Channel not found.');
 let names={};try{names=JSON.parse(String(e.names));}catch{}
 return /** @type {{id:string,vertical:string,type:string,slug:string,names:Record<string,string>}} */({id:String(e.id),vertical:String(e.vertical),type:String(e.type),slug:String(e.slug),names});
}
/** Purge the cached HTML of pages a write changed (both languages). @param {string} origin @param {string[]} paths */
async function purge(origin,paths){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return;
 await Promise.all(paths.map(p=>cache.delete(new Request(origin+p)).catch(()=>false)));
}
/** @template T @param {(l:string)=>T} f @returns {T[]} */
const bothLocales=f=>['ko','en'].map(f);
/** Every cached page a post or its channel appears on (both languages): the post, the channel's
 * default board and feed, the community front and 념글. Filtered board views (?sort, ?kind, ?page)
 * expire on their own within a minute. @param {{vertical:string,slug:string}} e @param {number|null} [no] */
const pagesOf=(e,no=null)=>bothLocales(l=>[...(no?[postUrl(l,e,no)]:[]),channelUrl(l,e),channelUrl(l,e)+'feed.xml',`/${l}/community/`,`/${l}/community/best/`]).flat();

/**
 * @param {Request} request @param {any} env @param {any} ctx
 * @param {{now?:()=>number,limiter?:any,fetch?:any}} [deps]
 */
export async function handlePlatformApi(request,env,ctx,deps={}){
 const url=new URL(request.url),route=url.pathname.replace(/^\/api\/v2/,'').replace(/\/+$/,'')||'/',key=`${request.method} ${route}`;
 // Visit beacon (src/hit.js → server/traffic.js): no session, no D1 — one Analytics Engine data point.
 if(route==='/hit')return handleHit(request,env,ctx);
 /** @type {any} */let context=null;
 try{
  // The owner-only admin app has its own router, auth (passkeys) and origin rules.
  if(isAdminRoute(route))return handleAdminApi(request,env,ctx,deps);
  if(!ROUTES[key]){
   const methods=['GET','POST'].filter(m=>ROUTES[`${m} ${route}`]);
   if(methods.length)return errorResponse(new ApiError('METHOD_NOT_ALLOWED'),{Allow:methods.join(', ')});
   throw new ApiError('NOT_FOUND');
  }
  const cfg=runtimeConfig(env),now=(deps.now||Date.now)(),db=env.DB;
  if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
  if(request.method==='POST')assertSameOrigin(request,cfg);
  // Open data (ODbL): published compat reports by month, with no account data. Public and cacheable,
  // so it is answered before any session lookup.
  if(key==='GET /open-data/compat'){
   // Served from the edge cache for an hour: anonymous, so it must not run a scan on every hit.
   const month=url.searchParams.get('month'),cache=/** @type {any} */(globalThis).caches?.default,ck=new Request(`${url.origin}/api/v2/open-data/compat${month?`?month=${encodeURIComponent(month)}`:''}`);
   const hit=cache?await cache.match(ck):null;if(hit)return hit;
   const res=json(await openCompat(db,month),200,{'Cache-Control':'public, max-age=3600, s-maxage=3600','Access-Control-Allow-Origin':'*'});
   if(cache)ctx?.waitUntil?.(cache.put(ck,res.clone()));
   return res;
  }
  context=await resolveContext(request,cfg,db,now);
  const done=(/** @type {any} */ body,status=200)=>json(body,status,{'Set-Cookie':context.setCookies});
  const origin=cfg.siteOrigin||url.origin;
  // Reads (anonymous allowed).
  if(key==='GET /state')return done({...await state(db,context,url.searchParams,{env,cfg,now,ip:clientIp(request)}),providers:configuredProviders(cfg)});
  if(key==='GET /new-posts'){
   const e=await entity(db,String(url.searchParams.get('entity')||''));
   const after=Number(url.searchParams.get('after'))||0;
   const r=await db.prepare("SELECT COUNT(*) AS n,MAX(post_no) AS last FROM discussions WHERE entity_id=? AND post_no>? AND status='published'").bind(e.id,after).first();
   return done({count:Number(r?.n||0),last:Number(r?.last||after)});
  }
  if(key==='GET /follows'){
   if(!context.user)throw new ApiError('LOGIN_REQUIRED');
   const l=url.searchParams.get('l')==='en'?'en':'ko';
   const rows=(await db.prepare("SELECT e.id,e.vertical,e.slug,e.names FROM follows f JOIN entities e ON e.id=f.entity_id WHERE f.user_id=? AND e.status='active' ORDER BY f.created_at DESC LIMIT 500").bind(context.user.id).all()).results||[];
   return done({follows:rows.map((/** @type {any} */ r)=>{const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};return {id:String(r.id),name:nameOf(e,l),url:channelUrl(l,e)};})});
  }
  if(key==='GET /comments/source'){
   if(!context.user)throw new ApiError('LOGIN_REQUIRED');
   const c=await db.prepare("SELECT body_md,author_id,status FROM comments WHERE id=?").bind(String(url.searchParams.get('id')||'')).first();
   if(!c||c.author_id!==context.user.id||c.status!=='published')throw new ApiError('NOT_FOUND');
   return done({body:String(c.body_md)});
  }
  if(key==='GET /posts/source'){
   if(!context.user)throw new ApiError('LOGIN_REQUIRED');
   const p=await db.prepare("SELECT d.title,d.body_md,d.author_id,d.status,d.kind,e.vertical FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(url.searchParams.get('id')||'')).first();
   if(!p||p.author_id!==context.user.id||!(p.status==='published'||p.status==='locked'))throw new ApiError('NOT_FOUND');
   // The tags the author may switch to (a 리포트 post stays one: it carries a structured report).
   const l=url.searchParams.get('l')==='en'?'en':'ko';
   // The post's own tag is always offered first (a staff 공지 stays a 공지 when its text is edited).
   const ids=p.kind==='report'?[]:[...new Set([String(p.kind),...writableKinds(String(p.vertical)).filter(k=>k!=='report')])];
   const kinds=ids.filter(k=>k in POST_KINDS).map(k=>({id:k,label:/** @type {any} */(POST_KINDS)[k][l]}));
   return done({title:String(p.title),body:String(p.body_md),kind:String(p.kind),kinds});
  }
  if(key==='GET /mine'){
   // 내 글·댓글 for the 내 정보 page (the author's own, including locked posts).
   if(!context.user)throw new ApiError('LOGIN_REQUIRED');
   const l=url.searchParams.get('l')==='en'?'en':'ko';
   const ent=(/** @type {any} */ r)=>({vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))});
   const posts=((await db.prepare(`SELECT d.post_no,d.title,d.kind,d.comment_count,d.up_count,d.created_at,e.vertical,e.slug,e.names FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.author_id=? AND d.status IN ('published','locked') ORDER BY d.created_at DESC LIMIT 30`).bind(context.user.id).all()).results||[])
    .map((/** @type {any} */ r)=>({title:String(r.title),kind:String(r.kind),comments:Number(r.comment_count),up:Number(r.up_count),at:Number(r.created_at),url:postUrl(l,ent(r),Number(r.post_no)),channel:nameOf(ent(r),l)}));
   const comments=((await db.prepare(`SELECT c.id,c.body_md,c.created_at,d.post_no,d.title,e.vertical,e.slug,e.names FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id WHERE c.author_id=? AND c.status='published' AND d.status IN ('published','locked') ORDER BY c.created_at DESC LIMIT 30`).bind(context.user.id).all()).results||[])
    .map((/** @type {any} */ r)=>({text:String(r.body_md).replace(/\s+/g,' ').slice(0,80),on:String(r.title),at:Number(r.created_at),url:postUrl(l,ent(r),Number(r.post_no))+`#c-${r.id}`}));
   return done({posts,comments});
  }
  if(key==='GET /mod/queue'){const p=await moderator(db,context);return done(await modQueue(db,p));}
  if(key==='GET /my-radar'){if(!context.user)throw new ApiError('LOGIN_REQUIRED');return done(await myRadar(db,context.user.id,url.searchParams.get('l')==='en'?'en':'ko',now));}
  // Writes.
  /** @type {WriteCtx} */
  const x={request,env,ctx,deps,cfg,context,now,db,origin,url,l:url.searchParams.get('l')==='en'?'en':'ko'};
  if(key==='POST /uploads'){const r=await uploadRoute(x);maybeCleanup(x);return r;}
  if(!context.user&&!ANON_ROUTES[key])throw new ApiError('LOGIN_REQUIRED');
  const body=await readJSON(request,key==='POST /posts'||key==='POST /posts/edit'?64*1024:8192);
  // Without an account, or with the password of an anonymous item (its edit works signed in too).
  if(!context.user||key==='POST /anon/check'||(ANON_EDITS[key]&&typeof body.password==='string')){
   const r=await anonRoute(key,body,x);
   if(r.status===201)maybeCleanup(x);
   return done(r.body,r.status);
  }
  const limit=async(/** @type {string} */ name,/** @type {number} */ n)=>{if(!await allowRequest({env,limiter:deps.limiter,key:`v2:${name}|u:${context.user.id}`,limit:n,now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});};
  const profile=await ensureProfile(db,context.user,now);
  assertMayWrite(profile,now);
  const owner=await ownerOf(context,anonSecret(env,cfg));
  switch(key){
   case 'POST /profile':{
    only(body,['displayName']);
    const name=text(body.displayName,LIMITS.nickname,'displayName');
    if(reservedNickname(name))throw new ApiError('BAD_REQUEST','This nickname is reserved.',{field:'displayName'});
    await limit('profile',5);
    const taken=await db.prepare('SELECT 1 FROM user_profiles WHERE lower(display_name)=lower(?) AND user_id<>?').bind(name,context.user.id).first();
    if(taken)throw new ApiError('OPERATION_CONFLICT','This nickname is taken.',{field:'displayName'});
    try{await db.prepare('UPDATE user_profiles SET display_name=?,updated_at=? WHERE user_id=?').bind(name,now,context.user.id).run();}
    catch(e){if(/UNIQUE/i.test(String(/** @type {any} */(e)?.message)))throw new ApiError('OPERATION_CONFLICT','This nickname is taken.',{field:'displayName'});throw e;}
    return done({displayName:name});
   }
   case 'POST /follow':{
    only(body,['entityId','follow']);
    const e=await entity(db,/** @type {string} */(body.entityId));await limit('follow',LIMITS.votesPerMinute);
    if(body.follow===false)await db.prepare('DELETE FROM follows WHERE user_id=? AND entity_id=?').bind(context.user.id,e.id).run();
    else await db.prepare('INSERT OR IGNORE INTO follows (user_id,entity_id,created_at) VALUES (?,?,?)').bind(context.user.id,e.id,now).run();
    const n=await db.prepare('SELECT COUNT(*) AS n FROM follows WHERE entity_id=?').bind(e.id).first();
    return done({following:body.follow!==false,followers:Number(n?.n||0)});
   }
   case 'POST /posts':{
    only(body,['entityId','kind','title','body']);
    const e=await entity(db,/** @type {string} */(body.entityId));
    const kind=String(body.kind||'');
    const staff=profile.role==='moderator'||profile.role==='curator'||profile.role==='admin';
    if(!(kind in POST_KINDS)||!(writableKinds(e.vertical).includes(kind)||(staff&&kind==='notice')))throw new ApiError('BAD_REQUEST','This tag cannot be used in this channel.',{field:'kind'});
    if(!staff&&!boardOpen(/** @type {any} */(e)))throw new ApiError('FORBIDDEN','This channel\'s board is not open yet.');
    const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body');
    await limit('post',LIMITS.postsPerMinute);
    const verdict=staff?null:await blocklistVerdict(db,`${title}\n${md}`,now);
    if(verdict==='reject')throw blockedText();
    const id=randomToken(12);
    const plan=await attachPlan(db,{md,owner,kind:'discussion',id});
    const no=await createPost(db,{id,entityId:e.id,kind,title,body:md,locale:x.l,authorId:context.user.id,hasImage:plan.ids.length>0,status:verdict==='hide'?'hidden':'published'},now);
    if(plan.statements.length)await db.batch(plan.statements);
    if(verdict==='hide')await autoHold(x,'discussion',id);
    await purge(origin,pagesOf(e));
    return done({id,postNo:no,url:postUrl(x.l,e,no),...(verdict==='hide'?{held:true}:{})},201);
   }
   case 'POST /comments':{
    only(body,['postId','parentId','body']);
    const post=await db.prepare("SELECT d.id,d.entity_id,d.post_no,d.status,e.vertical,e.type,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
    if(!post||post.status==='hidden'||post.status==='deleted')throw new ApiError('NOT_FOUND','Post not found.');
    if(!boardOpen(/** @type {any} */(post))&&!['moderator','curator','admin'].includes(String(profile.role)))throw new ApiError('FORBIDDEN','This channel\'s board is not open yet.');
    if(post.status==='locked')throw new ApiError('FORBIDDEN','Comments are closed on this post.');
    let parent=null;
    if(body.parentId!==undefined&&body.parentId!==null&&body.parentId!==''){
     parent=await db.prepare("SELECT id FROM comments WHERE id=? AND discussion_id=? AND status<>'hidden'").bind(String(body.parentId),post.id).first();
     if(!parent)throw new ApiError('BAD_REQUEST','The comment you replied to is gone.',{field:'parentId'});
    }
    const md=text(body.body,LIMITS.comment,'body');
    if(hasImageSyntax(md))throw noCommentImages();
    await limit('comment',LIMITS.commentsPerMinute);
    const verdict=await blocklistVerdict(db,md,now);
    if(verdict==='reject')throw blockedText();
    const id=randomToken(12);
    await db.batch([
     db.prepare('INSERT INTO comments (id,discussion_id,parent_id,author_id,body_md,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,post.id,parent?parent.id:null,context.user.id,md,verdict==='hide'?'hidden':'published',now,now),
     db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published'),last_activity_at=? WHERE id=?").bind(post.id,now,post.id)]);
    if(verdict==='hide')await autoHold(x,'comment',id);
    await purge(origin,pagesOf({vertical:String(post.vertical),slug:String(post.slug)},Number(post.post_no)));
    return done({id,...(verdict==='hide'?{held:true}:{})},201);
   }
   case 'POST /votes':{
    only(body,['kind','id','value']);
    const kind=body.kind==='comment'?'comment':body.kind==='discussion'?'discussion':null;
    const value=body.value===1||body.value===-1||body.value===0?body.value:null;
    if(!kind||value===null||typeof body.id!=='string')throw new ApiError('BAD_REQUEST','Invalid vote.');
    const own=await db.prepare(`SELECT author_id,status FROM ${kind==='discussion'?'discussions':'comments'} WHERE id=?`).bind(body.id).first();
    if(!own||!(own.status==='published'||(kind==='discussion'&&own.status==='locked')))throw new ApiError('NOT_FOUND');
    if(own.author_id===context.user.id)throw new ApiError('FORBIDDEN','You cannot vote on your own writing.');
    await limit('vote',LIMITS.votesPerMinute);
    const r=await castVote(db,{kind,id:body.id,userId:context.user.id,value},now);
    return done(r);
   }
   case 'POST /posts/edit':case 'POST /posts/delete':{
    only(body,key==='POST /posts/edit'?['postId','title','body','kind']:['postId']);
    const p=await db.prepare("SELECT d.id,d.author_id,d.status,d.post_no,d.kind,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
    // Only the author, and only while the post is visible (a moderator-hidden post stays as the moderator left it).
    if(!p||p.author_id!==context.user.id||!(p.status==='published'||p.status==='locked'))throw new ApiError('NOT_FOUND');
    await limit('post-edit',10);
    if(key==='POST /posts/edit'){
     const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body');
     let kind=String(p.kind);
     if(body.kind!==undefined&&body.kind!==kind){
      if(kind==='report'||body.kind==='report'||!writableKinds(String(p.vertical)).includes(String(body.kind)))throw new ApiError('BAD_REQUEST','This tag cannot be used in this channel.',{field:'kind'});
      kind=String(body.kind);
     }
     if(await blocklistVerdict(db,`${title}\n${md}`,now)==='reject')throw blockedText();
     const plan=await attachPlan(db,{md,owner,kind:'discussion',id:String(p.id)});
     await db.batch([db.prepare('UPDATE discussions SET title=?,body_md=?,kind=?,has_image=?,edited_at=?,updated_at=? WHERE id=?').bind(title,md,kind,plan.ids.length?1:0,now,now,p.id),...plan.statements]);
     await deleteImages(env,db,plan.dropped,'author',origin);
    }else{
     await db.prepare("UPDATE discussions SET status='deleted',updated_at=? WHERE id=?").bind(now,p.id).run();
     await deleteImages(env,db,(await imagesOf(db,'discussion',String(p.id))).filter(i=>i.status!=='deleted'),'author',origin);
    }
    await purge(origin,pagesOf({vertical:String(p.vertical),slug:String(p.slug)},Number(p.post_no)));
    return done({ok:true});
   }
   case 'POST /posts/solve':{
    only(body,['postId','commentId']);
    const p=await db.prepare("SELECT d.id,d.author_id,d.kind,d.status,d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
    if(!p||p.author_id!==context.user.id||!(p.status==='published'||p.status==='locked'))throw new ApiError('NOT_FOUND');
    if(p.kind!=='question')throw new ApiError('BAD_REQUEST','Only questions have an accepted answer.');
    let cid=null;
    if(body.commentId!==null&&body.commentId!==undefined&&body.commentId!==''){
     const c=await db.prepare("SELECT id,author_id FROM comments WHERE id=? AND discussion_id=? AND status='published'").bind(String(body.commentId),p.id).first();
     if(!c)throw new ApiError('NOT_FOUND','No such comment on this post.');
     if(c.author_id===context.user.id)throw new ApiError('BAD_REQUEST','Pick someone else\'s answer.');
     cid=String(c.id);
    }
    await db.prepare('UPDATE discussions SET solved_comment_id=?,updated_at=? WHERE id=?').bind(cid,now,p.id).run();
    await purge(origin,pagesOf({vertical:String(p.vertical),slug:String(p.slug)},Number(p.post_no)));
    return done({solved:cid});
   }
   case 'POST /comments/edit':case 'POST /comments/delete':{
    only(body,key==='POST /comments/edit'?['commentId','body']:['commentId']);
    const c=await db.prepare("SELECT c.id,c.author_id,c.status,c.discussion_id,d.post_no,e.vertical,e.slug FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id WHERE c.id=?").bind(String(body.commentId||'')).first();
    if(!c||c.author_id!==context.user.id||c.status!=='published')throw new ApiError('NOT_FOUND');
    await limit('post-edit',10);
    if(key==='POST /comments/edit'){const md=text(body.body,LIMITS.comment,'body');if(hasImageSyntax(md))throw noCommentImages();if(await blocklistVerdict(db,md,now)==='reject')throw blockedText();await db.prepare('UPDATE comments SET body_md=?,edited_at=?,updated_at=? WHERE id=?').bind(md,now,now,c.id).run();}
    else await db.batch([db.prepare("UPDATE comments SET status='deleted',updated_at=? WHERE id=?").bind(now,c.id),
     db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published') WHERE id=?").bind(c.discussion_id,c.discussion_id)]);
    await purge(origin,pagesOf({vertical:String(c.vertical),slug:String(c.slug)},Number(c.post_no)));
    return done({ok:true});
   }
   case 'POST /mod/action':{
    const me=await moderator(db,context);
    return done(await modAction(db,context.user.id,String(me.role),body,now,origin,env,ctx,deps));
   }
   case 'POST /my-radar/seen':{
    only(body,['lastChangeId','repliesSeenAt']);
    const id=Number(body.lastChangeId??0);if(!Number.isInteger(id)||id<0)throw new ApiError('BAD_REQUEST','Invalid lastChangeId.');
    // Replies are marked seen up to a time the reader actually saw (never in the future).
    const rs=Math.min(now,Math.max(0,Number(body.repliesSeenAt)||0));
    await db.prepare('INSERT INTO radar_state (user_id,last_seen_change_id,replies_seen_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen_change_id=MAX(radar_state.last_seen_change_id,excluded.last_seen_change_id),replies_seen_at=MAX(radar_state.replies_seen_at,excluded.replies_seen_at),updated_at=excluded.updated_at').bind(context.user.id,id,rs,now).run();
    return done({ok:true});
   }
   case 'POST /facts/propose':{
    only(body,['entityId','property','value','unit','sourceUrl','note','postId']);
    const e=await entity(db,/** @type {string} */(body.entityId));
    const full=(await db.prepare('SELECT type FROM entities WHERE id=?').bind(e.id).first());
    const prop=String(body.property||''),def=propertyDef(String(e.vertical),prop);
    // Only the properties this kind of channel shows in its wiki, never hidden ones.
    if(!def||def.public===false||def.type==='url'||!(typeDef(String(e.vertical),String(full?.type))?.props||[]).includes(prop))throw new ApiError('BAD_REQUEST','This property cannot be proposed here.',{field:'property'});
    // A unit only where the property takes one (a currency for a price without a fixed currency).
    if(body.unit!==undefined&&body.unit!==''&&!(def.type==='money'&&!def.unit&&/^[A-Z]{3}$/.test(String(body.unit))))throw new ApiError('BAD_REQUEST','The value does not fit this property.',{field:'unit'});
    // At most 20 open proposals per member, so one person cannot bury everyone else's in the queue.
    const openN=Number((await db.prepare("SELECT COUNT(*) AS n FROM fact_proposals WHERE user_id=? AND status='open'").bind(context.user.id).first())?.n||0);
    if(openN>=20)throw new ApiError('RATE_LIMITED','Too many open proposals. Please wait for a review.');
    const sourceUrl=String(body.sourceUrl||'');
    if(!/^https?:\/\/[^\s]{4,2000}$/.test(sourceUrl))throw new ApiError('BAD_REQUEST','A source link (http/https) is required.',{field:'sourceUrl'});
    const note=body.note===undefined||body.note===''?null:text(body.note,[1,500],'note');
    const src=`src:proposal-${randomToken(8).toLowerCase().replace(/[^a-z0-9]/g,'')}`;
    const fact={p:prop,v:body.value,...(body.unit?{unit:String(body.unit)}:{}),ver:'COMMUNITY_VERIFIED',src};
    const doc={schema:SEED_SCHEMA,vertical:String(e.vertical),sources:[{id:src,kind:'COMMUNITY',url:sourceUrl,retrieved:new Date(now).toISOString().slice(0,10)}],entities:[{id:e.id,facts:[fact]}]};
    // The same validation as seed files (types, units, currencies): a proposal is a one-fact seed.
    const errors=validateSeed(doc,{entities:new Set([e.id])});
    if(errors.length)throw new ApiError('BAD_REQUEST','The value does not fit this property.',{field:'value',detail:errors[0].slice(0,200)});
    let discussion=null;
    if(body.postId){const d=await db.prepare("SELECT id FROM discussions WHERE id=? AND entity_id=? AND status IN ('published','locked')").bind(String(body.postId),e.id).first();discussion=d?String(d.id):null;}
    await limit('proposal',5);
    const id=randomToken(12);
    await db.prepare('INSERT INTO fact_proposals (id,entity_id,property,value,unit,source_url,note,discussion_id,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
     .bind(id,e.id,prop,JSON.stringify(body.value),body.unit?String(body.unit):null,sourceUrl,note,discussion,context.user.id,now).run();
    return done({ok:true,id},201);
   }
   case 'POST /flags':{
    only(body,['target','reason','note']);
    const f=await flagInput(db,body);
    await limit('flag',10);
    const r=await fileFlag(x,f,{id:context.user.id,key:null});
    return done(r,r.updated?200:201);
   }
   case 'POST /reports':return done(await report(db,context,body,now,limit,origin),201);
   case 'POST /rollout':{
    only(body,['featureId','hasIt','country','planId','platform','appVersion']);
    const f=await entity(db,/** @type {string} */(body.featureId));
    if(!f.id.startsWith('feature:'))throw new ApiError('BAD_REQUEST','Not a feature.');
    if(typeof body.hasIt!=='boolean')throw new ApiError('BAD_REQUEST','hasIt must be true or false.');
    const country=typeof body.country==='string'&&/^[A-Z]{2}$/.test(body.country)?body.country:'*';
    const platform=typeof body.platform==='string'&&PLATFORMS.includes(/** @type {any} */(body.platform))?body.platform:'*';
    const plan=typeof body.planId==='string'&&/^plan:[a-z0-9][a-z0-9.-]{0,95}$/.test(body.planId)?body.planId:'*';
    await limit('vote',LIMITS.votesPerMinute);
    await db.prepare(`INSERT INTO rollout_votes (feature_id,user_id,has_it,country,plan_id,platform,app_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(feature_id,user_id) DO UPDATE SET has_it=excluded.has_it,country=excluded.country,plan_id=excluded.plan_id,platform=excluded.platform,app_version=excluded.app_version,updated_at=excluded.updated_at`)
     .bind(f.id,context.user.id,body.hasIt?1:0,country,plan,platform,optVersion(body.appVersion),now,now).run();
    return done({ok:true});
   }
  }
  throw new ApiError('NOT_FOUND');
 }catch(error){
  if(!(error instanceof ApiError))console.error('api/v2',key,/** @type {any} */(error)?.name,/** @type {any} */(error)?.message);
  return errorResponse(error,context?{'Set-Cookie':context.setCookies}:{});
 }
}

/** What the islands need for one page: who is signed in, follow state, the reader's votes, and how
 * writing without an account works here (anon: on/off, bot check, image uploads, limits).
 * @param {any} db @param {any} context @param {URLSearchParams} q @param {{env:any,cfg:any,now:number,ip:string}} o */
async function state(db,context,q,o){
 const user=context.user,mode=anonMode(o.cfg);
 const out=/** @type {any} */({signedIn:!!user,user:null,following:false,votes:{},
  anon:{enabled:mode.enabled,check:mode.mode==='turnstile'?'turnstile':mode.mode==='strict'?'none':'off',siteKey:mode.siteKey,
   name:ANON.name,defaultName:ANON.defaultName,password:ANON.password,links:ANON.links},
  uploads:uploadsConfigured(o.env)?{maxBytes:IMAGE_LIMITS.maxBytes,maxSide:IMAGE_LIMITS.maxSide,perPost:ANON.imagesPerPost,types:['image/webp','image/jpeg','image/png']}:null});
 const post=q.get('post'),flag=q.get('flag');
 const FLAG=/^(discussion|comment|report|wiki_revision|fact|entity|user):([\w:.-]{1,100})$/;
 if(!user){
  // A signed-out reader's votes and reports are keyed by today's network key: show them back.
  if((post&&/^[\w-]{1,64}$/.test(post))||flag){
   const ident=await anonIdentity(o.ip,anonSecret(o.env,o.cfg),o.now);
   if(post&&/^[\w-]{1,64}$/.test(post)){
    const rows=(await db.prepare(`SELECT target_id,value FROM anon_votes WHERE voter=? AND ((target_kind='discussion' AND target_id=?) OR (target_kind='comment' AND target_id IN (SELECT id FROM comments WHERE discussion_id=?)))`).bind(ident.key,post,post).all()).results||[];
    for(const r of rows)out.votes[r.target_id]=Number(r.value);
   }
   const m=flag?FLAG.exec(flag):null;
   if(m){const f=await db.prepare("SELECT reason,category FROM content_flags WHERE target_kind=? AND target_id=? AND reporter_key=? AND status='open'").bind(m[1],m[2],ident.key).first();out.flagged=f?{reason:String(f.category||f.reason)}:null;}
  }
  return out;
 }
 const p=await db.prepare('SELECT display_name,tier FROM user_profiles WHERE user_id=?').bind(user.id).first();
 out.user={name:p?.display_name||defaultNickname(user.id),tier:p?.tier||'new'};
 if(/^user-[0-9a-z]{1,6}$/.test(out.user.name)){const suggest=await nicknameSuggestion(db,user.id);if(suggest)out.user.suggest=suggest;}
 const entityId=q.get('entity');
 if(entityId&&ENTITY_ID.test(entityId)){
  out.following=!!(await db.prepare('SELECT 1 FROM follows WHERE user_id=? AND entity_id=?').bind(user.id,entityId).first());
  // The reader's latest compat result per patch on this game (the strip highlights it after a reload).
  const cv=(await db.prepare(`SELECT entity_id,COALESCE(target_version,'*') AS tv,result FROM community_reports WHERE kind='compat' AND user_id=? AND target_id=? AND status='published' ORDER BY created_at DESC,rowid DESC LIMIT 20`).bind(user.id,entityId).all()).results||[];
  out.compat={};for(const r of cv){const k=`${r.entity_id}|${r.tv}`;if(!(k in out.compat))out.compat[k]=String(r.result);}
 }
 if(flag){const m=FLAG.exec(flag);
  if(m){const f=await db.prepare("SELECT reason,category FROM content_flags WHERE target_kind=? AND target_id=? AND reporter_id=? AND status='open'").bind(m[1],m[2],user.id).first();out.flagged=f?{reason:String(f.category||f.reason)}:null;}}
 if(post&&/^[\w-]{1,64}$/.test(post)){
  const own=await db.prepare('SELECT author_id FROM discussions WHERE id=?').bind(post).first();
  out.mine={post:own?.author_id===user.id,comments:((await db.prepare("SELECT id FROM comments WHERE discussion_id=? AND author_id=? AND status='published'").bind(post,user.id).all()).results||[]).map((/** @type {any} */ r)=>String(r.id))};
  const rows=(await db.prepare(`SELECT target_kind,target_id,value FROM votes WHERE user_id=? AND ((target_kind='discussion' AND target_id=?) OR (target_kind='comment' AND target_id IN (SELECT id FROM comments WHERE discussion_id=?)))`).bind(user.id,post,post).all()).results||[];
  for(const r of rows)out.votes[r.target_id]=Number(r.value);
 }
 return out;
}

/* ---------- writing without an account (유동), images, 신고 → 자동 임시조치 ---------- */

/** @typedef {{request:Request,env:any,ctx:any,deps:{now?:()=>number,limiter?:any,fetch?:any,random?:()=>number},cfg:any,context:any,now:number,db:any,origin:string,url:URL,l:'ko'|'en'}} WriteCtx */
/** @param {Request} r */
const clientIp=r=>r.headers.get('cf-connecting-ip')||'';
const blockedText=()=>new ApiError('BAD_REQUEST','This text contains a blocked word or link.',{field:'body',reason:'blocked'});
const noCommentImages=()=>new ApiError('BAD_REQUEST','Images can be added to posts, not comments.',{field:'body',reason:'images'});
/** Retention and unused-upload cleanup, on about 1 in 100 successful writes, after the response. @param {WriteCtx} x */
function maybeCleanup(x){
 if(((x.deps.random||Math.random)())>=0.01)return;
 const run=async()=>{try{await x.db.batch(anonCleanupStatements(x.db,x.now));await expireUnattached(x.env,x.db,x.now,x.origin);}catch(e){console.error('anon cleanup',/** @type {any} */(e)?.message);}};
 const p=run();x.ctx?.waitUntil?.(p);
}

/** The typed nickname: 1–12 characters, ㅇㅇ when empty; never a reserved or staff-looking name, a
 * member's nickname (고정닉), or characters that imitate the ID or badges. @param {any} db @param {unknown} v */
async function anonName(db,v){
 if(v!==undefined&&v!==null&&typeof v!=='string')throw new ApiError('BAD_REQUEST','name must be text.',{field:'name'});
 const s=String(v??'').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2060\ufeff]/g,'').replace(/\s+/g,' ').trim();
 if(!s)return ANON.defaultName;
 if([...s].length>ANON.name[1])throw new ApiError('BAD_REQUEST',`name must be ${ANON.name[0]}–${ANON.name[1]} characters.`,{field:'name'});
 if(s===ANON.defaultName)return s;
 if(/[()（）\[\]<>✓✔☑⚙★]/.test(s)||reservedNickname(s))throw new ApiError('BAD_REQUEST','This nickname is reserved.',{field:'name'});
 if(await db.prepare('SELECT 1 FROM user_profiles WHERE lower(display_name)=lower(?)').bind(s).first())throw new ApiError('BAD_REQUEST','This nickname belongs to a member.',{field:'name'});
 return s;
}
/** @param {unknown} v */
function anonPassword(v){
 if(typeof v!=='string'||[...v].length<ANON.password[0]||[...v].length>ANON.password[1]||/[\u0000-\u001f\u007f]/.test(v))throw new ApiError('BAD_REQUEST',`password must be ${ANON.password[0]}–${ANON.password[1]} characters.`,{field:'password'});
 return v;
}
/** Password of an anonymous item, with attempt limits (per item and per network, per hour).
 * @param {WriteCtx} x @param {{kind:string,id:string,password:unknown,stored:unknown,ident:import('./anon.js').AnonIdentity,max:number}} o */
async function checkPassword(x,o){
 const hk=hourKey(x.now),itemKey=`pwf:${o.kind}:${o.id}`,netKey=`pwn:${o.ident.net}`;
 const [a,b]=await Promise.all([readDaily(x.db,itemKey,hk),readDaily(x.db,netKey,hk)]);
 if(a>=ANON.passwordFailuresPerItem||b>=o.max)throw new ApiError('RATE_LIMITED','Too many wrong passwords. Please try again later.',{retryAfter:3600,reason:'password'});
 if(typeof o.password==='string'&&await verifyPassword(o.password,String(o.stored||''),anonSecret(x.env,x.cfg)))return;
 const bump=(/** @type {string} */ k)=>x.db.prepare('INSERT INTO anon_counters (key,day,n) VALUES (?,?,1) ON CONFLICT(key,day) DO UPDATE SET n=n+1').bind(k,hk);
 await x.db.batch([bump(itemKey),bump(netKey)]);
 throw new ApiError('FORBIDDEN','Wrong password.',{field:'password',reason:'password'});
}
/** Links, the first-write link rule, identical-text floods and the blocklist for an anonymous text.
 * @param {WriteCtx} x @param {{text:string,kind:'post'|'comment',ident:import('./anon.js').AnonIdentity,edit?:boolean}} o */
async function anonContentChecks(x,o){
 const links=countLinks(o.text),max=o.kind==='post'?ANON.links.post:ANON.links.comment;
 if(links>max)throw new ApiError('BAD_REQUEST',`Without an account a ${o.kind} may contain at most ${max} link${max>1?'s':''}.`,{field:'body',reason:'links',max});
 if(links&&!o.edit&&(await readDaily(x.db,`p:${o.ident.net}`,o.ident.day))+(await readDaily(x.db,`c:${o.ident.net}`,o.ident.day))===0)
  throw new ApiError('BAD_REQUEST','Links are allowed from your second post or comment of the day.',{field:'body',reason:'first_links'});
 const verdict=await blocklistVerdict(x.db,o.text,x.now);
 if(verdict==='reject')throw blockedText();
 const hash=await textHash(o.text);
 if(!o.edit){
  const table=o.kind==='post'?'discussions':'comments',len=normalizeText(o.text).length;
  const rows=(await x.db.prepare(`SELECT anon_net,created_at FROM ${table} WHERE text_hash=? AND created_at>? AND status<>'deleted' LIMIT 50`).bind(hash,x.now-ANON.duplicateSameNetworkMs).all()).results||[];
  const recent=(/** @type {any} */ r)=>Number(r.created_at)>x.now-ANON.duplicateAnyMs;
  const dup=o.kind==='post'
   ?rows.some((/** @type {any} */ r)=>r.anon_net===o.ident.net||recent(r))
   :rows.some((/** @type {any} */ r)=>(r.anon_net===o.ident.net&&(recent(r)||len>=20))||(recent(r)&&len>=30));
  if(dup)throw new ApiError('DUPLICATE_CONTENT','The same text was just posted. Please write something new.',{field:'body'});
 }
 return {hash,hide:verdict==='hide'};
}
/** The anonymous post or comment an edit, delete or password check is about. @param {any} db @param {'discussion'|'comment'} kind @param {unknown} id */
async function anonItem(db,kind,id){
 const row=kind==='discussion'
  ?await db.prepare("SELECT d.id,d.title,d.body_md,d.kind,d.author_id,d.status,d.post_no,d.anon_pw,d.anon_id,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(id||'')).first()
  :await db.prepare("SELECT c.id,c.body_md,c.author_id,c.status,c.discussion_id,c.anon_pw,c.anon_id,d.post_no,e.vertical,e.slug FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id WHERE c.id=?").bind(String(id||'')).first();
 const visible=row&&(kind==='discussion'?row.status==='published'||row.status==='locked':row.status==='published');
 if(!row||row.author_id!==ANON_USER||!visible||!row.anon_pw)throw new ApiError('NOT_FOUND');
 return row;
}

/**
 * Signed-out writes (and password edits of anonymous items). Order: input → ban → bot check → burst
 * limit → content checks → daily limit → write, so a refused request costs the network nothing.
 * @param {string} key @param {any} body @param {WriteCtx} x @returns {Promise<{status:number,body:any}>}
 */
async function anonRoute(key,body,x){
 const {db,cfg,env,now,context}=x;
 const mode=anonMode(cfg);assertAnonEnabled(mode,cfg);
 const secret=anonSecret(env,cfg),ip=clientIp(x.request);
 const ident=await anonIdentity(ip,secret,now);
 const L=ANON.limits[mode.mode==='strict'?'strict':'normal'];
 const minute=async(/** @type {string} */ name,/** @type {number} */ n)=>{if(!await allowRequest({env,limiter:x.deps.limiter,key:`v2anon:${name}|${ident.net}`,limit:n,now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});};
 const daily=async(/** @type {string} */ name,/** @type {number} */ n)=>{if(!await takeDaily(db,`${name}:${ident.net}`,ident.day,n))throw new ApiError('RATE_LIMITED','Today\'s limit for writing without an account is used up on this network. Sign in, or try again tomorrow.',{retryAfter:3600,reason:'daily',limit:n});};
 const gate=(/** @type {boolean} */ fresh)=>humanGate({cfg,context,ident,token:body.turnstileToken,fresh,ip,now,fetch:x.deps.fetch,mode});
 const strict=mode.mode==='strict'?{check:'none'}:{};
 switch(key){
  case 'POST /anon/check':{
   only(body,['target','password']);
   const m=/^(discussion|comment):([\w-]{1,64})$/.exec(String(body.target||''));if(!m)throw new ApiError('BAD_REQUEST','Invalid target.',{field:'target'});
   const kind=/** @type {'discussion'|'comment'} */(m[1]),row=await anonItem(db,kind,m[2]);
   await checkPassword(x,{kind,id:String(row.id),password:body.password,stored:row.anon_pw,ident,max:L.passwordFailuresPerHour});
   if(kind==='comment')return {status:200,body:{ok:true,body:String(row.body_md)}};
   const ids=row.kind==='report'?[]:[...new Set([String(row.kind),...writableKinds(String(row.vertical)).filter(k=>k!=='report')])];
   return {status:200,body:{ok:true,title:String(row.title),body:String(row.body_md),kind:String(row.kind),kinds:ids.filter(k=>k in POST_KINDS).map(k=>({id:k,label:/** @type {any} */(POST_KINDS)[k][x.l]}))}};
  }
  case 'POST /posts':{
   only(body,['entityId','kind','title','body','name','password','turnstileToken']);
   const e=await entity(db,/** @type {string} */(body.entityId));
   const kind=String(body.kind||'');
   if(!(kind in POST_KINDS)||!writableKinds(e.vertical).includes(kind))throw new ApiError('BAD_REQUEST','This tag cannot be used in this channel.',{field:'kind'});
   if(!boardOpen(/** @type {any} */(e)))throw new ApiError('FORBIDDEN','This channel\'s board is not open yet.');
   const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body'),password=anonPassword(body.password),name=await anonName(db,body.name);
   await assertNotBanned(db,ident.net,now);
   await gate(true);
   await minute('post',L.postsPerMinute);
   const c=await anonContentChecks(x,{text:`${title}\n${md}`,kind:'post',ident});
   const id=randomToken(12);
   const plan=await attachPlan(db,{md,owner:await ownerOf(context,secret),kind:'discussion',id});
   await daily('p',L.postsPerDay);
   const no=await createPost(db,{id,entityId:e.id,kind,title,body:md,locale:x.l,authorId:ANON_USER,hasImage:plan.ids.length>0,status:c.hide?'hidden':'published',textHash:c.hash,
    anon:{name,id:ident.id,net:ident.net,pw:await hashPassword(password,secret)}},now);
   if(plan.statements.length)await db.batch(plan.statements);
   if(c.hide)await autoHold(x,'discussion',id);
   await purge(x.origin,pagesOf(e));
   return {status:201,body:{id,postNo:no,url:postUrl(x.l,e,no),name,anonId:ident.id,...strict,...(c.hide?{held:true}:{})}};
  }
  case 'POST /comments':{
   only(body,['postId','parentId','body','name','password','turnstileToken']);
   const post=await db.prepare("SELECT d.id,d.entity_id,d.post_no,d.status,e.vertical,e.type,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
   if(!post||post.status==='hidden'||post.status==='deleted')throw new ApiError('NOT_FOUND','Post not found.');
   if(!boardOpen(/** @type {any} */(post)))throw new ApiError('FORBIDDEN','This channel\'s board is not open yet.');
   if(post.status==='locked')throw new ApiError('FORBIDDEN','Comments are closed on this post.');
   let parent=null;
   if(body.parentId!==undefined&&body.parentId!==null&&body.parentId!==''){
    parent=await db.prepare("SELECT id FROM comments WHERE id=? AND discussion_id=? AND status<>'hidden'").bind(String(body.parentId),post.id).first();
    if(!parent)throw new ApiError('BAD_REQUEST','The comment you replied to is gone.',{field:'parentId'});
   }
   const md=text(body.body,LIMITS.comment,'body'),password=anonPassword(body.password),name=await anonName(db,body.name);
   if(hasImageSyntax(md))throw noCommentImages();
   await assertNotBanned(db,ident.net,now);
   await gate(false);
   await minute('comment',L.commentsPerMinute);
   const c=await anonContentChecks(x,{text:md,kind:'comment',ident});
   await daily('c',L.commentsPerDay);
   const id=randomToken(12);
   await db.batch([
    db.prepare('INSERT INTO comments (id,discussion_id,parent_id,author_id,body_md,status,anon_name,anon_id,anon_net,anon_pw,text_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
     .bind(id,post.id,parent?parent.id:null,ANON_USER,md,c.hide?'hidden':'published',name,ident.id,ident.net,await hashPassword(password,secret),c.hash,now,now),
    db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published'),last_activity_at=? WHERE id=?").bind(post.id,now,post.id)]);
   if(c.hide)await autoHold(x,'comment',id);
   await purge(x.origin,pagesOf({vertical:String(post.vertical),slug:String(post.slug)},Number(post.post_no)));
   return {status:201,body:{id,name,anonId:ident.id,...strict,...(c.hide?{held:true}:{})}};
  }
  case 'POST /votes':{
   only(body,['kind','id','value','turnstileToken']);
   const kind=body.kind==='comment'?'comment':body.kind==='discussion'?'discussion':null;
   const value=body.value===1||body.value===-1||body.value===0?body.value:null;
   if(!kind||value===null||typeof body.id!=='string')throw new ApiError('BAD_REQUEST','Invalid vote.');
   const own=await db.prepare(`SELECT status,anon_id,created_at FROM ${kind==='discussion'?'discussions':'comments'} WHERE id=?`).bind(body.id).first();
   if(!own||!(own.status==='published'||(kind==='discussion'&&own.status==='locked')))throw new ApiError('NOT_FOUND');
   if(own.anon_id&&own.anon_id===ident.id&&kstDay(Number(own.created_at))===ident.day)throw new ApiError('FORBIDDEN','You cannot vote on your own writing.');
   await assertNotBanned(db,ident.net,now);
   await gate(false);
   await minute('vote',L.votesPerMinute);
   await daily('v',L.votesPerDay);
   return {status:200,body:await castVote(db,{kind,id:body.id,voter:ident.key,value},now)};
  }
  case 'POST /flags':{
   only(body,['target','reason','note','turnstileToken']);
   const f=await flagInput(db,body);
   await gate(false);
   await minute('flag',10);
   await daily('r',L.reportsPerDay);
   const r=await fileFlag(x,f,{id:null,key:ident.key});
   return {status:r.updated?200:201,body:r};
  }
  case 'POST /posts/edit':case 'POST /posts/delete':{
   only(body,key==='POST /posts/edit'?['postId','title','body','kind','password','turnstileToken']:['postId','password','turnstileToken']);
   const p=await anonItem(db,'discussion',body.postId);
   await checkPassword(x,{kind:'discussion',id:String(p.id),password:body.password,stored:p.anon_pw,ident,max:L.passwordFailuresPerHour});
   await gate(false);
   await minute('post-edit',10);
   if(key==='POST /posts/edit'){
    await assertNotBanned(db,ident.net,now);
    const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body');
    let kind=String(p.kind);
    if(body.kind!==undefined&&body.kind!==kind){
     if(kind==='report'||body.kind==='report'||!writableKinds(String(p.vertical)).includes(String(body.kind)))throw new ApiError('BAD_REQUEST','This tag cannot be used in this channel.',{field:'kind'});
     kind=String(body.kind);
    }
    const c=await anonContentChecks(x,{text:`${title}\n${md}`,kind:'post',ident,edit:true});
    // The images the post already has stay usable; new ones must be this browser's own uploads.
    const plan=await attachPlan(db,{md,owner:await ownerOf(context,secret),kind:'discussion',id:String(p.id)});
    await db.batch([db.prepare('UPDATE discussions SET title=?,body_md=?,kind=?,has_image=?,text_hash=?,edited_at=?,updated_at=? WHERE id=?').bind(title,md,kind,plan.ids.length?1:0,c.hash,now,now,p.id),...plan.statements]);
    await deleteImages(env,db,plan.dropped,'author',x.origin);
    if(c.hide)await autoHold(x,'discussion',String(p.id));
   }else{
    await db.prepare("UPDATE discussions SET status='deleted',updated_at=? WHERE id=?").bind(now,p.id).run();
    await deleteImages(env,db,(await imagesOf(db,'discussion',String(p.id))).filter(i=>i.status!=='deleted'),'author',x.origin);
   }
   await purge(x.origin,pagesOf({vertical:String(p.vertical),slug:String(p.slug)},Number(p.post_no)));
   return {status:200,body:{ok:true}};
  }
  case 'POST /comments/edit':case 'POST /comments/delete':{
   only(body,key==='POST /comments/edit'?['commentId','body','password','turnstileToken']:['commentId','password','turnstileToken']);
   const cm=await anonItem(db,'comment',body.commentId);
   await checkPassword(x,{kind:'comment',id:String(cm.id),password:body.password,stored:cm.anon_pw,ident,max:L.passwordFailuresPerHour});
   await gate(false);
   await minute('post-edit',10);
   if(key==='POST /comments/edit'){
    await assertNotBanned(db,ident.net,now);
    const md=text(body.body,LIMITS.comment,'body');
    if(hasImageSyntax(md))throw noCommentImages();
    const c=await anonContentChecks(x,{text:md,kind:'comment',ident,edit:true});
    await db.prepare('UPDATE comments SET body_md=?,text_hash=?,edited_at=?,updated_at=? WHERE id=?').bind(md,c.hash,now,now,cm.id).run();
    if(c.hide)await autoHold(x,'comment',String(cm.id));
   }else await db.batch([db.prepare("UPDATE comments SET status='deleted',updated_at=? WHERE id=?").bind(now,cm.id),
    db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published') WHERE id=?").bind(cm.discussion_id,cm.discussion_id)]);
   await purge(x.origin,pagesOf({vertical:String(cm.vertical),slug:String(cm.slug)},Number(cm.post_no)));
   return {status:200,body:{ok:true}};
  }
 }
 throw new ApiError('LOGIN_REQUIRED');
}

/** POST /api/v2/uploads: one image (the body), for a member or an anonymous writer. @param {WriteCtx} x */
async function uploadRoute(x){
 const {env,db,cfg,context,now}=x;
 if(!uploadsConfigured(env))throw uploadsNotConfigured();
 const secret=anonSecret(env,cfg),owner=await ownerOf(context,secret);
 const tooMany=()=>new ApiError('RATE_LIMITED','Today\'s image limit is used up. Please try again tomorrow.',{retryAfter:3600,reason:'daily'});
 if(context.user){
  assertMayWrite(await ensureProfile(db,context.user,now),now);
  if(!await allowRequest({env,limiter:x.deps.limiter,key:`v2:upload|u:${context.user.id}`,limit:20,now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});
  if(!await takeDaily(db,`img:u:${context.user.id}`,kstDay(now),ANON.memberImagesPerDay))throw tooMany();
  return uploaded(await storeUpload({env,db,request:x.request,owner,userId:String(context.user.id),anonNet:null,now}),context.setCookies);
 }
 const mode=anonMode(cfg);assertAnonEnabled(mode,cfg);
 const ip=clientIp(x.request),ident=await anonIdentity(ip,secret,now),L=ANON.limits[mode.mode==='strict'?'strict':'normal'];
 await assertNotBanned(db,ident.net,now);
 await humanGate({cfg,context,ident,token:x.request.headers.get('x-turnstile-token'),fresh:false,ip,now,fetch:x.deps.fetch,mode});
 if(!await allowRequest({env,limiter:x.deps.limiter,key:`v2anon:upload|${ident.net}`,limit:12,now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});
 if(!await takeDaily(db,`img:${ident.net}`,ident.day,L.imagesPerDay))throw tooMany();
 return uploaded(await storeUpload({env,db,request:x.request,owner,userId:ANON_USER,anonNet:ident.net,now}),context.setCookies);
}

/** @typedef {{kind:string,id:string,category:string,reason:string,note:string|null}} FlagInput */
/** Validate a 신고: target, category (FLAG_CATEGORIES), note. @param {any} db @param {any} body @returns {Promise<FlagInput>} */
async function flagInput(db,body){
 const m=/^(discussion|comment|report|wiki_revision|fact|entity|user):([\w:.-]{1,100})$/.exec(String(body.target||''));
 if(!m)throw new ApiError('BAD_REQUEST','Invalid target.',{field:'target'});
 const category=String(body.reason||'');
 if(!FLAG_CATEGORIES.includes(category))throw new ApiError('BAD_REQUEST','Invalid reason.',{field:'reason'});
 const note=body.note===undefined||body.note===''?null:text(body.note,[1,1000],'note');
 const TABLE=/** @type {Record<string,string>} */({discussion:'discussions',comment:'comments',report:'community_reports',wiki_revision:'wiki_revisions',fact:'facts',entity:'entities',user:'users'});
 if(m[1]==='user'&&m[2]===ANON_USER)throw new ApiError('BAD_REQUEST','Report the post or comment instead.',{field:'target'});
 if(!await db.prepare(`SELECT 1 FROM ${TABLE[m[1]]} WHERE id=?`).bind(m[1]==='wiki_revision'||m[1]==='fact'?Number(m[2])||-1:m[2]).first())throw new ApiError('NOT_FOUND','Nothing to report at this address.',{field:'target'});
 return {kind:m[1],id:m[2],category,reason:REPORT.reasonOf[category],note};
}
/**
 * Record a 신고 (one open flag per reporter and target: a member by account, a signed-out reader by today's
 * network key; a repeat changes the reason), then hide the post or comment at once when enough different
 * people reported it (REPORT.threshold) or the category is one that must not stay up while it is checked
 * (REPORT.severe). The admin's phone gets a push either way.
 * @param {WriteCtx} x @param {FlagInput} f @param {{id:string|null,key:string|null}} who
 * @returns {Promise<{ok:boolean,updated?:boolean,previousReason?:string,hidden?:boolean}>}
 */
async function fileFlag(x,f,who){
 const {db,now}=x;
 const col=who.id?'reporter_id':'reporter_key',val=who.id||who.key;
 const open=await db.prepare(`SELECT id,reason,category FROM content_flags WHERE target_kind=? AND target_id=? AND ${col}=? AND status='open'`).bind(f.kind,f.id,val).first();
 if(open){
  await db.prepare('UPDATE content_flags SET reason=?,category=?,note=COALESCE(?,note) WHERE id=?').bind(f.reason,f.category,f.note,open.id).run();
 }else{
  await db.prepare('INSERT INTO content_flags (id,target_kind,target_id,reporter_id,reporter_key,reason,category,note,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
   .bind(randomToken(12),f.kind,f.id,who.id,who.id?null:who.key,f.reason,f.category,f.note,now).run();
 }
 const hidden=await autoHide(x,f);
 // A new flag (or one that hid the item) reaches the admin's phone at once, after the response.
 if(!open||hidden)x.ctx?.waitUntil?.(notifyNewFlag(x.env,{target:`${f.kind}:${f.id}`,reason:f.reason,category:f.category,autoHidden:!!hidden,reports:hidden?hidden.reports:undefined},{now,fetch:x.deps.fetch,origin:x.origin}));
 if(open)return {ok:true,updated:true,previousReason:String(open.category||open.reason),...(hidden?{hidden:true}:{})};
 return {ok:true,...(hidden?{hidden:true}:{})};
}
/** Auto temporary-hide (자동 임시조치) of a reported post or comment. Returns the report count when it hid it.
 * @param {WriteCtx} x @param {FlagInput} f @returns {Promise<{reports:number}|null>} */
async function autoHide(x,f){
 if(f.kind!=='discussion'&&f.kind!=='comment')return null;
 const {db,now}=x,table=f.kind==='discussion'?'discussions':'comments';
 const cur=await db.prepare(`SELECT status FROM ${table} WHERE id=?`).bind(f.id).first();
 if(!cur||!(cur.status==='published'||cur.status==='locked'))return null;
 const reporters=Number((await db.prepare("SELECT COUNT(DISTINCT COALESCE(reporter_id,'k:'||reporter_key)) AS n FROM content_flags WHERE target_kind=? AND target_id=? AND status='open'").bind(f.kind,f.id).first())?.n||0);
 const severe=REPORT.severe.includes(f.category);
 if(!severe&&reporters<REPORT.threshold)return null;
 const reason=severe?`자동 임시조치: ${f.category} 신고 (확인 전까지 숨김)`:`자동 임시조치: 서로 다른 ${reporters}명 신고`;
 await hideStatements(x,f.kind,f.id,String(cur.status),reason,{auto:true,reports:reporters,category:f.category});
 return {reports:reporters};
}
/** Hide (임시조치) by the system: status hidden, logged like a moderator's hide (so 복구 restores the previous
 * state), pages and images purged. @param {WriteCtx} x @param {string} kind @param {string} id @param {string} previous @param {string} reason @param {Record<string,unknown>} meta */
async function hideStatements(x,kind,id,previous,reason,meta){
 const {db,now}=x,table=kind==='discussion'?'discussions':'comments';
 const w=[db.prepare(`UPDATE ${table} SET status='hidden',updated_at=? WHERE id=? AND status IN ('published','locked')`).bind(now,id),
  db.prepare("INSERT INTO moderation_actions (actor_id,action,target_kind,target_id,reason,meta,created_at) VALUES ('system:automod','hide',?,?,?,?,?)").bind(kind,id,reason,JSON.stringify({previous,...meta}),now)];
 if(kind==='comment')w.push(db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=discussions.id AND status='published') WHERE id=(SELECT discussion_id FROM comments WHERE id=?)").bind(id));
 await db.batch(w);
 await purgeTarget(x.db,x.origin,kind,id);
}
/** A write the blocklist marked "hide": published hidden, waiting in the queue. @param {WriteCtx} x @param {'discussion'|'comment'} kind @param {string} id */
async function autoHold(x,kind,id){
 await x.db.prepare("INSERT INTO moderation_actions (actor_id,action,target_kind,target_id,reason,meta,created_at) VALUES ('system:automod','hide',?,?,?,?,?)").bind(kind,id,'자동 보류: 차단 목록 단어·링크',JSON.stringify({previous:'published',auto:true,blocklist:true}),x.now).run();
 x.ctx?.waitUntil?.(notifyNewFlag(x.env,{target:`${kind}:${id}`,reason:'spam',category:'spam',autoHidden:true},{now:x.now,fetch:x.deps.fetch,origin:x.origin}));
}
/** Purge the pages (and images) of a post or comment. @param {any} db @param {string} origin @param {string} kind @param {string} id */
async function purgeTarget(db,origin,kind,id){
 const d=await db.prepare(`SELECT d.id,d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=${kind==='discussion'?'?':'(SELECT discussion_id FROM comments WHERE id=?)'}`).bind(id).first();
 if(!d)return;
 await purge(origin,pagesOf({vertical:String(d.vertical),slug:String(d.slug)},Number(d.post_no)));
 if(kind==='discussion')await purgeImages(origin,(await imagesOf(db,'discussion',String(d.id))).map(i=>i.id));
}

/** An outage click counts for an hour: a user who is still affected later can click again (the
 * status page shows reports per hour), but repeated clicks within the hour count once. */
const ISSUE_VOTE_MS=36e5;
/** Structured compat/issue report (ProtonDB-style): stored as a community report, recomputes the
 * community verdict, and becomes a 리포트 post so it can be discussed.
 * @param {any} db @param {any} context @param {any} body @param {number} now @param {(n:string,l:number)=>Promise<void>} limit @param {string} origin */
async function report(db,context,body,now,limit,origin){
 only(body,['kind','entityId','subjectVersion','targetId','targetVersion','result','env','comment','title','metrics']);
 if(body.kind==='benchmark')return benchmark(db,context,body,now,limit,origin);
 if(body.kind!=='compat'&&body.kind!=='issue')throw new ApiError('BAD_REQUEST','kind must be compat, issue or benchmark.');
 const subject=await entity(db,body.entityId);
 const target=body.targetId?await entity(db,body.targetId):null;
 if(body.kind==='compat'&&!target)throw new ApiError('BAD_REQUEST','A compatibility report needs a target.',{field:'targetId'});
 const result=['works','works_with_issues','broken'].includes(body.result)?body.result:null;
 if(!result)throw new ApiError('BAD_REQUEST','result must be works, works_with_issues or broken.',{field:'result'});
 /** @type {Record<string,string>} */const env={};
 if(body.env!==undefined){
  if(!body.env||typeof body.env!=='object'||Array.isArray(body.env))throw new ApiError('BAD_REQUEST','env must be an object.');
  for(const [k,v] of Object.entries(body.env).slice(0,8)){if(!/^[a-z_]{1,20}$/.test(k)||typeof v!=='string'||v.length>60)throw new ApiError('BAD_REQUEST','Invalid env field.');env[k]=v.trim();}
 }
 const comment=body.comment===undefined||body.comment===''?null:text(body.comment,[1,2000],'comment');
 // Everything is validated before the first write (a 400 must leave nothing behind).
 const titleIn=body.title?text(body.title,[2,120],'title'):null;
 const sv=optVersion(body.subjectVersion),tv=optVersion(body.targetVersion);
 const quick=!comment&&!body.title&&(body.kind==='issue'||!Object.keys(env).length);
 // A report with text becomes a post, so it needs an open board (a one-click vote works anywhere).
 if(!quick&&!boardOpen(target&&body.kind==='compat'?target:subject))throw new ApiError('FORBIDDEN','This channel\'s board is not open yet.');
 await limit(quick?'vote':'report',quick?LIMITS.votesPerMinute:LIMITS.postsPerMinute);
 const id=randomToken(12);
 // A bare click ("✓ 작동" on a game channel, "안 돼요" on a status page) is a vote: one per user and
 // combination, a new click replaces the old one, and it never becomes a post. A report with text
 // or a title is a post on the board (and still counts once per user: see compatVerdict).
 // A person's bare vote on this patch × game version is replaced by their next click and by their
 // detailed report (whatever patch version it names): one person, one voice per game version.
 const replaced=quick||body.kind==='compat'?await db.prepare(`DELETE FROM community_reports WHERE kind=? AND user_id=? AND entity_id=?${quick?" AND COALESCE(subject_version,'*')=?":''} AND COALESCE(target_id,'')=? AND COALESCE(target_version,'*')=? AND comment IS NULL
  AND NOT EXISTS (SELECT 1 FROM discussions d WHERE d.report_id=community_reports.id)${body.kind==='issue'?' AND created_at>?':''} RETURNING COALESCE(subject_version,'*') AS sv`)
  .bind(body.kind,context.user.id,subject.id,...(quick?[sv||'*']:[]),target?.id??'',tv||'*',...(body.kind==='issue'?[now-ISSUE_VOTE_MS]:[])).all():{results:[]};
 const staleSv=[...new Set(((replaced.results||[])).map((/** @type {any} */ r)=>String(r.sv)))].filter(x=>x!==(sv||'*'));
 await db.prepare(`INSERT INTO community_reports (id,kind,entity_id,subject_version,target_id,target_version,env,result,comment,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(id,body.kind,subject.id,sv,target?.id??null,tv,JSON.stringify(env),result,comment,context.user.id,now,now).run();
 /** @type {any} */let verdict=null;
 /** The verdicts of other patch versions this person's removed vote counted in. */
 const recomputeStale=async()=>{if(body.kind==='compat'&&target)for(const x of staleSv)await recomputeCompat(db,{subject:subject.id,subjectVersion:x,target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now);};
 const recompute=async()=>{await recomputeStale();if(body.kind==='compat'&&target){try{verdict=(await recomputeCompat(db,{subject:subject.id,subjectVersion:sv||'*',target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now)).verdict;}
  catch(e){if(!/UNIQUE/i.test(String(/** @type {any} */(e)?.message)))throw e;verdict=(await recomputeCompat(db,{subject:subject.id,subjectVersion:sv||'*',target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now)).verdict;}}};
 if(quick){
  await recompute();
  if(body.kind==='compat'&&target)await purge(origin,[...pagesOf(target),...pagesOf(subject)]);
  return {id,verdict,postNo:null,url:null,vote:true};
 }
 const board=target&&body.kind==='compat'?target:subject;
 const RESULT_KO=/** @type {Record<string,string>} */({works:'작동',works_with_issues:'일부 문제',broken:'안 됨'});
 // "테스트 게임 한글패치 1.7 × 테스트 게임 2.3.1: 작동" — names in Korean, the report language.
 const nm=(/** @type {{names:Record<string,string>}} */ x)=>x.names.ko||x.names.en||'';
 // The game's name is not repeated: "Caves of Qud 한글패치 (qudkorean) × Caves of Qud 1.04" → "한글패치 (qudkorean) × 1.04".
 const subj=target&&nm(subject).startsWith(nm(target)+' ')?nm(subject).slice(nm(target).length+1):nm(subject);
 const title=titleIn?titleIn:(target?`${subj}${sv?' '+sv:''} × ${subj===nm(subject)?nm(target)+(tv?' '+tv:''):(tv||nm(target))}: ${RESULT_KO[result]}`:`${nm(subject)}${sv?' '+sv:''}: ${RESULT_KO[result]}`).slice(0,120);
 const postId=randomToken(12);
 const no=await createPost(db,{id:postId,entityId:board.id,kind:'report',title,body:comment||RESULT_KO[result],locale:'ko',authorId:context.user.id,reportId:id},now);
 await recompute();
 await purge(origin,[...pagesOf(board),...(board.id!==subject.id?pagesOf(subject):[])]);
 return {id,verdict,postNo:no,url:postUrl('ko',board,no)};
}

/** A measured benchmark (model × GPU): tokens/s with runtime, quantization and context. Never an
 * estimate; the GPU page shows the median and the count. @param {any} db @param {any} context @param {any} body @param {number} now @param {(n:string,l:number)=>Promise<void>} limit @param {string} origin */
async function benchmark(db,context,body,now,limit,origin){
 const model=await entity(db,body.entityId),gpu=await entity(db,body.targetId);
 if(!model.id.startsWith('model:')||!gpu.id.startsWith('gpu:'))throw new ApiError('BAD_REQUEST','A benchmark is a model measured on a GPU.');
 const tps=body.metrics&&typeof body.metrics==='object'?Number(body.metrics.tokens_per_s):NaN;
 if(!Number.isFinite(tps)||tps<=0||tps>5000)throw new ApiError('BAD_REQUEST','tokens_per_s must be between 0 and 5000.',{field:'tokens_per_s'});
 /** @type {Record<string,string>} */const env={};
 for(const [k,v] of Object.entries(body.env&&typeof body.env==='object'?body.env:{}).slice(0,6)){if(!/^[a-z_]{1,20}$/.test(k)||typeof v!=='string'||v.length>60)throw new ApiError('BAD_REQUEST','Invalid env field.');env[k]=v.trim();}
 await limit('report',LIMITS.postsPerMinute);
 const id=randomToken(12);
 // One measurement per user per model × GPU × runtime × quantization: a repeat replaces the old one.
 await db.prepare("DELETE FROM community_reports WHERE kind='benchmark' AND user_id=? AND entity_id=? AND target_id=? AND COALESCE(json_extract(env,'$.runtime'),'')=? AND COALESCE(json_extract(env,'$.quant'),'')=?").bind(context.user.id,model.id,gpu.id,env.runtime||'',env.quant||'').run();
 await db.prepare(`INSERT INTO community_reports (id,kind,entity_id,target_id,env,metrics,user_id,created_at,updated_at) VALUES (?,'benchmark',?,?,?,?,?,?,?)`)
  .bind(id,model.id,gpu.id,JSON.stringify(env),JSON.stringify({tokens_per_s:Math.round(tps*100)/100}),context.user.id,now,now).run();
 await purge(origin,[...bothLocales(l=>channelUrl(l,gpu)),...bothLocales(l=>channelUrl(l,gpu)+'local-llm')]);
 return {id};
}

/** My Radar: changes and new posts in the channels the reader follows, with an unread count.
 * @param {any} db @param {string} userId @param {'ko'|'en'} l @param {number} [now] */
async function myRadar(db,userId,l,now=Date.now()){
 const ids=((await db.prepare('SELECT entity_id FROM follows WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(userId).all()).results||[]).map((/** @type {any} */ r)=>String(r.entity_id));
 const st=await db.prepare('SELECT last_seen_change_id AS n,replies_seen_at AS r FROM radar_state WHERE user_id=?').bind(userId).first();
 const seen=Number(st?.n||0),repliesSeen=Number(st?.r||0);
 const replies=await repliesTo(db,userId,l,repliesSeen);
 // The fate of my 정보 제안 (last 30 days) shows up with the replies.
 const reviewed=((await db.prepare(`SELECT f.id,f.property,f.status,f.reason,f.reviewed_at,e.vertical,e.slug,e.names FROM fact_proposals f JOIN entities e ON e.id=f.entity_id WHERE f.user_id=? AND f.status<>'open' AND f.reviewed_at>? ORDER BY f.reviewed_at DESC LIMIT 10`).bind(userId,now-30*864e5).all()).results||[]);
 for(const r of reviewed){const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};const def=propertyDef(e.vertical,String(r.property));
  replies.push({at:Number(r.reviewed_at),author:l==='ko'?'운영자':'Moderator',text:r.status==='accepted'?(l==='ko'?`정보 제안을 반영했어요 (${def?.label?.ko||r.property})`:`Your proposal was accepted (${def?.label?.en||r.property})`):(l==='ko'?`정보 제안을 반려했어요: ${r.reason||''}`:`Your proposal was declined: ${r.reason||''}`),on:nameOf(e,l),why:'proposal',url:channelUrl(l,e),unread:Number(r.reviewed_at)>repliesSeen});}
 replies.sort((a,b)=>b.at-a.at);
 const unreadReplies=replies.filter(r=>r.unread).length;
 if(!ids.length)return {following:0,unread:unreadReplies,unreadReplies,lastChangeId:seen,changes:[],posts:[],replies};
 const ents=await entitiesByIds(db,ids);
 const raw=await changesFor(db,ids,{minImportance:1,limit:30});
 // Schedule items carry the event's own date (a broadcast on 10/20 is not "09/26", when it was found).
 const evIds=[...new Set(raw.filter(c=>String(c.kind).startsWith('event_')&&c.ref_id).map(c=>Number(c.ref_id)))];
 /** @type {Map<number,{starts:number|null,ends:number|null,precision:string}>} */const evAt=new Map();
 if(evIds.length)for(const r of (await db.prepare(`SELECT id,starts_at,ends_at,date_precision FROM events WHERE id IN (${evIds.map(()=>'?').join(',')})`).bind(...evIds).all()).results||[])evAt.set(Number(r.id),{starts:r.starts_at==null?null:Number(r.starts_at),ends:r.ends_at==null?null:Number(r.ends_at),precision:String(r.date_precision||'day')});
 const changes=raw.map(c=>{const e=ents.get(c.entity_id),name=e?nameOf(e,l):'';const d=describeChange(c,{name},l);
  // The channel name is shown once, beside the item: drop it from the start of the text.
  const title=name&&d.title.startsWith(name+': ')?d.title.slice(name.length+2):d.title;
  const ev=c.ref_id&&String(c.kind).startsWith('event_')?evAt.get(Number(c.ref_id)):undefined;
  return {id:c.id,at:c.detected_at,eventAt:ev?.starts??null,eventEnd:ev?.ends??null,title,detail:d.detail,unread:c.id>seen,url:e?channelUrl(l,e):null,channel:name};});
 const q=ids.slice(0,40);
 const posts=((await db.prepare(`SELECT d.post_no,d.title,d.kind,d.comment_count,d.created_at,e.vertical,e.slug,e.names FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.status='published' AND d.entity_id IN (${q.map(()=>'?').join(',')}) ORDER BY d.created_at DESC LIMIT 20`).bind(...q).all()).results||[])
  .map((/** @type {any} */ r)=>{const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};return {title:String(r.title),kind:String(r.kind),comments:Number(r.comment_count),at:Number(r.created_at),url:postUrl(l,e,Number(r.post_no)),channel:nameOf(e,l)};});
 return {following:ids.length,unread:changes.filter(c=>c.unread).length+unreadReplies,unreadReplies,lastChangeId:Math.max(seen,...changes.map(c=>c.id)),changes,posts,replies};
}
/** Comments on the reader's posts and replies to the reader's comments (not their own), newest first.
 * Two indexed queries instead of one OR. @param {any} db @param {string} userId @param {'ko'|'en'} l @param {number} seenAt */
async function repliesTo(db,userId,l,seenAt){
 const COLS=`c.id,c.body_md,c.created_at,d.post_no,d.title,e.vertical,e.slug,e.names,COALESCE(c.anon_name||' ('||c.anon_id||')',p.display_name,'user-'||lower(substr(c.author_id,1,6))) AS author`;
 const FROM=`FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id LEFT JOIN user_profiles p ON p.user_id=c.author_id`;
 const OK=`c.status='published' AND d.status IN ('published','locked') AND c.author_id<>?`;
 const [onPosts,onComments]=await Promise.all([
  db.prepare(`SELECT ${COLS},'post' AS why ${FROM} WHERE d.author_id=? AND ${OK} ORDER BY c.created_at DESC LIMIT 20`).bind(userId,userId).all(),
  db.prepare(`SELECT ${COLS},'comment' AS why ${FROM} JOIN comments pc ON pc.id=c.parent_id WHERE pc.author_id=? AND ${OK} ORDER BY c.created_at DESC LIMIT 20`).bind(userId,userId).all()]);
 /** @type {Map<string,any>} */const byId=new Map();
 for(const r of [...(onComments.results||[]),...(onPosts.results||[])])if(!byId.has(String(r.id)))byId.set(String(r.id),r);
 return [...byId.values()].sort((a,b)=>Number(b.created_at)-Number(a.created_at)).slice(0,20).map(r=>{const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};
  return {at:Number(r.created_at),author:String(r.author),text:String(r.body_md).replace(/\s+/g,' ').slice(0,80),on:String(r.title),why:String(r.why),url:postUrl(l,e,Number(r.post_no))+`#c-${r.id}`,unread:Number(r.created_at)>seenAt};});
}

/* ---------- open data ---------- */

export const OPEN_DATA=Object.freeze({schema:'nerulio.compat-reports/1',license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'Nerulio community (nerulio.com)'});
/** ?month=YYYY-MM → that month's published compatibility reports (subject/target ids and versions,
 * setup, result, day). Without a month: the months that have reports, with counts. Never user ids,
 * comments or free text. @param {any} db @param {string|null} month */
async function openCompat(db,month){
 const MONTH=/^(\d{4})-(0[1-9]|1[0-2])$/;
 if(!month||!MONTH.test(month)){
  const rows=(await db.prepare(`SELECT strftime('%Y-%m',created_at/1000,'unixepoch') AS m,COUNT(*) AS n FROM community_reports WHERE kind='compat' AND status='published' AND visibility<>'private' GROUP BY 1 ORDER BY 1 DESC`).all()).results||[];
  return {...OPEN_DATA,months:rows.map((/** @type {any} */ r)=>({month:String(r.m),reports:Number(r.n),url:`/api/v2/open-data/compat?month=${r.m}`}))};
 }
 const from=Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1),to=Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1);
 // Public reports only, and only while the post they belong to (if any) is still public.
 const rows=(await db.prepare(`SELECT r.entity_id,r.subject_version,r.target_id,r.target_version,r.env,r.result,r.created_at FROM community_reports r
  WHERE r.kind='compat' AND r.status='published' AND r.visibility='public' AND r.created_at>=? AND r.created_at<?
  AND NOT EXISTS (SELECT 1 FROM discussions d WHERE d.report_id=r.id AND d.status NOT IN ('published','locked')) ORDER BY r.created_at LIMIT 50001`).bind(from,to).all()).results||[];
 const truncated=rows.length>50000;if(truncated)rows.length=50000;
 // Free text never leaves: the OS is reduced to its family; runtime and quantization are short codes.
 const OS=[[/windows/i,'windows'],[/mac|os x/i,'macos'],[/steam ?deck|steamos/i,'steamos'],[/linux|ubuntu|fedora|arch/i,'linux'],[/android/i,'android'],[/ios|iphone|ipad/i,'ios']];
 const SAFE_ENV=['runtime','quant'];
 return {...OPEN_DATA,month,reports:rows.map((/** @type {any} */ r)=>{const env=/** @type {Record<string,string>} */({});try{const e=/** @type {Record<string,unknown>} */(JSON.parse(String(r.env||'{}')));for(const k of SAFE_ENV){const v=e[k];if(typeof v==='string'&&/^[\w.\- ]{1,24}$/.test(v))env[k]=v;}
  const os=typeof e.os==='string'?OS.find(([re])=>/** @type {RegExp} */(re).test(/** @type {string} */(e.os)))?.[1]:undefined;if(os)env.os=String(os);}catch{}
  return {subject:String(r.entity_id),subjectVersion:r.subject_version??null,target:r.target_id??null,targetVersion:r.target_version??null,env,result:String(r.result),day:new Date(Number(r.created_at)).toISOString().slice(0,10)};}),truncated};
}

/* ---------- moderation (신고 → 임시조치 → 처리 기록) ---------- */

/** Moderators, curators and admins only; everyone else gets 404 (the queue's existence is not advertised). @param {any} db @param {any} context */
async function moderator(db,context){
 if(!context.user)throw new ApiError('NOT_FOUND');
 const p=await db.prepare('SELECT role FROM user_profiles WHERE user_id=?').bind(context.user.id).first();
 if(!p||!['moderator','curator','admin'].includes(String(p.role)))throw new ApiError('NOT_FOUND');
 return p;
}
/** Staff rank: an action on an account needs a strictly higher rank than the account's. */
const RANK=/** @type {Record<string,number>} */({user:0,moderator:1,curator:2,admin:3});
/** Open flags grouped by target, oldest first, with a preview of the flagged text; the content
 * currently hidden (임시조치 중) with the reason it was hidden, so a moderator can restore it; and the
 * action log. @param {any} db @param {any} _p */
async function modQueue(db,_p){
 const rows=(await db.prepare(`SELECT target_kind,target_id,GROUP_CONCAT(COALESCE(category,reason)) AS reasons,COUNT(*) AS n,COUNT(DISTINCT COALESCE(reporter_id,'k:'||reporter_key)) AS people,MIN(created_at) AS first_at,GROUP_CONCAT(note,' / ') AS notes FROM content_flags WHERE status='open' GROUP BY target_kind,target_id ORDER BY first_at LIMIT 100`).all()).results||[];
 const hiddenRows=(await db.prepare(`SELECT kind,id,updated_at FROM (SELECT 'discussion' AS kind,id,updated_at FROM discussions WHERE status='hidden' UNION ALL SELECT 'comment',id,updated_at FROM comments WHERE status='hidden') ORDER BY updated_at DESC LIMIT 50`).all()).results||[];
 // One query per kind for every target on the page (no per-row lookups).
 const targets=await modTargets(db,[...rows.map((/** @type {any} */ r)=>[String(r.target_kind),String(r.target_id)]),...hiddenRows.map((/** @type {any} */ r)=>[String(r.kind),String(r.id)])]);
 const items=rows.map((/** @type {any} */ r)=>({target:`${r.target_kind}:${r.target_id}`,reasons:[...new Set(String(r.reasons).split(','))],count:Number(r.n),people:Number(r.people),severe:String(r.reasons).split(',').some(x=>REPORT.severe.includes(x)),firstAt:Number(r.first_at),note:r.notes?String(r.notes).slice(0,600):null,...(targets.get(`${r.target_kind}:${r.target_id}`)||EMPTY_TARGET)}));
 /** @type {Map<string,{reason:string,created_at:number,auto:boolean}>} */const hides=new Map();
 const hk=hiddenRows.map((/** @type {any} */ r)=>`${r.kind}:${r.id}`);
 if(hk.length)for(const a of (await db.prepare(`SELECT actor_id,target_kind,target_id,reason,created_at FROM moderation_actions WHERE action='hide' AND (target_kind||':'||target_id) IN (${hk.map(()=>'?').join(',')}) ORDER BY id`).bind(...hk).all()).results||[])
  hides.set(`${a.target_kind}:${a.target_id}`,{reason:String(a.reason),created_at:Number(a.created_at),auto:a.actor_id==='system:automod'});   // the latest hide wins
 const hidden=hiddenRows.map((/** @type {any} */ r)=>{const k=`${r.kind}:${r.id}`,a=hides.get(k);return {target:k,hiddenAt:a?.created_at??Number(r.updated_at),reason:a?.reason??null,auto:!!a?.auto,...(targets.get(k)||EMPTY_TARGET)};});
 // Fact proposals waiting for review, with the value the wiki shows now.
 const props=(await db.prepare(`SELECT f.id,f.entity_id,f.property,f.value,f.unit,f.source_url,f.note,f.discussion_id,f.created_at,e.vertical,e.slug,e.names,COALESCE(p.display_name,'user-'||lower(substr(f.user_id,1,6))) AS author
  FROM fact_proposals f JOIN entities e ON e.id=f.entity_id LEFT JOIN user_profiles p ON p.user_id=f.user_id WHERE f.status='open' ORDER BY f.created_at LIMIT 50`).all()).results||[];
 const proposals=[];
 for(const r of props){
  // The most trusted current value (an official one for any region), so the moderator compares against it.
  const cur=await db.prepare("SELECT value,unit,verification,region FROM facts WHERE entity_id=? AND property=? AND is_current=1 AND plan='*' ORDER BY CASE verification WHEN 'OFFICIAL' THEN 0 WHEN 'AUTOMATED' THEN 1 WHEN 'COMMUNITY_VERIFIED' THEN 2 ELSE 3 END,CASE region WHEN 'KR' THEN 0 WHEN '*' THEN 1 ELSE 2 END LIMIT 1").bind(r.entity_id,r.property).first();
  const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};
  const def=propertyDef(e.vertical,String(r.property));
  proposals.push({target:`proposal:${r.id}`,channel:nameOf(e,'ko'),url:channelUrl('ko',e),property:def?.label?.ko||r.property,value:JSON.parse(String(r.value)),unit:r.unit??null,current:cur?{value:JSON.parse(String(cur.value)),unit:cur.unit??null,verification:String(cur.verification),region:String(cur.region)}:null,source:String(r.source_url),note:r.note??null,author:String(r.author),at:Number(r.created_at)});
 }
 const logRows=((await db.prepare('SELECT actor_id,action,target_kind,target_id,reason,created_at FROM moderation_actions ORDER BY id DESC LIMIT 30').all()).results||[]);
 // The log names what was acted on (title or comment excerpt), not an internal id.
 const logTargets=await modTargets(db,logRows.filter((/** @type {any} */ r)=>r.target_kind==='discussion'||r.target_kind==='comment').map((/** @type {any} */ r)=>[String(r.target_kind),String(r.target_id)]));
 const log=logRows.map((/** @type {any} */ r)=>({...r,label:logTargets.get(`${r.target_kind}:${r.target_id}`)?.preview?.slice(0,40)??null}));
 return {items,hidden,proposals,log};
}
const EMPTY_TARGET=Object.freeze({preview:null,excerpt:null,status:null,author:null,authorId:null,url:null,anon:null,images:[]});
/** What a moderator needs to judge a flagged or hidden target without opening it (a hidden post is
 * 404 on the public page): title or excerpt, author, status, and the post it belongs to.
 * @param {any} db @param {[string,string][]} list @returns {Promise<Map<string,any>>} */
async function modTargets(db,list){
 const out=new Map();
 /** D1 binds at most 100 parameters per statement. @param {string} sql @param {string[]} xs */
 const rowsIn=async(sql,xs)=>{const all=[];for(let i=0;i<xs.length;i+=90){const part=xs.slice(i,i+90);all.push(...((await db.prepare(sql.replace('(?*)',`(${part.map(()=>'?').join(',')})`)).bind(...part).all()).results||[]));}return all;};
 const ids=(/** @type {string} */ kind)=>[...new Set(list.filter(([k])=>k===kind).map(([,id])=>id))];
 const d=ids('discussion'),c=ids('comment');
 const AUTHOR=(/** @type {string} */ a)=>`COALESCE(${a}.anon_name||' ('||${a}.anon_id||')',p.display_name,'user-'||lower(substr(${a}.author_id,1,6)))`;
 /** @type {Map<string,{id:string,net:string|null}>} */const anonOf=new Map();
 for(const r of await rowsIn(`SELECT d.id,d.title,d.body_md,d.status,d.post_no,d.author_id,d.anon_id,d.anon_net,e.vertical,e.slug,${AUTHOR('d')} AS author FROM discussions d JOIN entities e ON e.id=d.entity_id LEFT JOIN user_profiles p ON p.user_id=d.author_id WHERE d.id IN (?*)`,d)){
  if(r.anon_id)anonOf.set(`discussion:${r.id}`,{id:String(r.anon_id),net:r.anon_net??null});
  out.set(`discussion:${r.id}`,{preview:String(r.title),excerpt:String(r.body_md).slice(0,4000),status:String(r.status),author:String(r.author),authorId:r.author_id===ANON_USER?null:String(r.author_id),url:postUrl('ko',{vertical:String(r.vertical),slug:String(r.slug)},Number(r.post_no)),anon:null,images:[]});
 }
 for(const r of await rowsIn(`SELECT c.id,c.body_md,c.status,c.author_id,c.anon_id,c.anon_net,d.title,d.post_no,e.vertical,e.slug,${AUTHOR('c')} AS author FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id LEFT JOIN user_profiles p ON p.user_id=c.author_id WHERE c.id IN (?*)`,c)){
  if(r.anon_id)anonOf.set(`comment:${r.id}`,{id:String(r.anon_id),net:r.anon_net??null});
  out.set(`comment:${r.id}`,{preview:String(r.body_md).slice(0,200),excerpt:null,status:String(r.status),author:String(r.author),authorId:r.author_id===ANON_USER?null:String(r.author_id),url:postUrl('ko',{vertical:String(r.vertical),slug:String(r.slug)},Number(r.post_no)),context:String(r.title),anon:null,images:[]});
 }
 // Anonymous authors: their daily ID and whether their network is banned now (the key itself stays on the server).
 const nets=[...new Set([...anonOf.values()].map(a=>a.net).filter(Boolean))];
 /** @type {Map<string,number>} */const bans=new Map();
 for(const b of await rowsIn('SELECT net,until FROM anon_bans WHERE net IN (?*)',/** @type {string[]} */(nets)))bans.set(String(b.net),Number(b.until));
 for(const [k,a] of anonOf){const t=out.get(k);if(t)t.anon={id:a.id,bannable:!!a.net,bannedUntil:a.net?bans.get(a.net)??null:null};}
 // The images of listed posts (moderators see them even while the post is hidden).
 for(const r of await rowsIn(`SELECT id,mime,attached_id,status FROM uploads WHERE attached_kind='discussion' AND attached_id IN (?*)`,d)){
  const t=out.get(`discussion:${r.attached_id}`);if(t&&r.status!=='deleted')t.images.push(`/u/${r.id}/full.${({'image/webp':'webp','image/png':'png','image/jpeg':'jpg'})[/** @type {'image/webp'} */(String(r.mime))]||'webp'}`);
 }
 return out;
}
const MOD_ACTIONS=Object.freeze(['hide','unhide','dismiss','restrict','unrestrict','accept','reject','delete','ban','unban']);
/** Apply one moderator action; always logged in moderation_actions with its reason.
 * hide = 임시조치 (the content disappears from boards but is kept), unhide = restore, dismiss = no action,
 * delete = removed for good (its images are deleted from R2 and answer 451), ban/unban = the anonymous
 * author's network may not write without an account for `days` (1–365) days.
 * @param {any} db @param {string} actor @param {string} actorRole @param {any} body @param {number} now @param {string} origin
 * @param {any} [env] @param {any} [ctx] @param {any} [deps] */
export async function modAction(db,actor,actorRole,body,now,origin,env={},ctx=null,deps={}){
 only(body,['target','action','reason','days']);
 const m=/^(discussion|comment|user|proposal):([\w:.-]{1,100})$/.exec(String(body.target||''));
 if(!m)throw new ApiError('BAD_REQUEST','Invalid target.',{field:'target'});
 const action=String(body.action);if(!MOD_ACTIONS.includes(action))throw new ApiError('BAD_REQUEST','Invalid action.',{field:'action'});
 const reason=text(body.reason,[2,500],'reason');
 const [,kind,id]=m,w=[];
 /** @type {Record<string,unknown>} */let meta={};
 if(kind==='discussion'||kind==='comment'){
  const table=kind==='discussion'?'discussions':'comments';
  const cur=await db.prepare(`SELECT status FROM ${table} WHERE id=?`).bind(id).first();
  if(!cur)throw new ApiError('NOT_FOUND','No such post or comment.');
  if(action==='hide'){
   if(cur.status==='hidden'||cur.status==='deleted')throw new ApiError('OPERATION_CONFLICT',`Already ${cur.status}.`);
   meta={previous:cur.status};   // restored exactly by unhide (a locked post stays locked)
   w.push(db.prepare(`UPDATE ${table} SET status='hidden',updated_at=? WHERE id=?`).bind(now,id));
  }
  if(action==='unhide'){
   if(cur.status!=='hidden')throw new ApiError('OPERATION_CONFLICT','Not hidden.');
   const last=await db.prepare("SELECT meta FROM moderation_actions WHERE target_kind=? AND target_id=? AND action='hide' ORDER BY id DESC LIMIT 1").bind(kind,id).first();
   let prev='published';try{const p=JSON.parse(String(last?.meta||'{}')).previous;if(p==='published'||p==='locked')prev=p;}catch{}
   w.push(db.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=? AND status='hidden'`).bind(prev,now,id));
  }
  if(action==='delete'){
   if(cur.status==='deleted')throw new ApiError('OPERATION_CONFLICT','Already deleted.');
   meta={previous:cur.status};
   w.push(db.prepare(`UPDATE ${table} SET status='deleted',updated_at=? WHERE id=?`).bind(now,id));
  }
  if(action==='ban'||action==='unban'){
   const a=await db.prepare(`SELECT anon_id,anon_net FROM ${table} WHERE id=?`).bind(id).first();
   if(!a?.anon_id)throw new ApiError('BAD_REQUEST','Only anonymous writers are banned by network; restrict a member instead.');
   if(!a.anon_net)throw new ApiError('OPERATION_CONFLICT','This item is older than 90 days; its network is no longer kept.');
   const days=Math.min(365,Math.max(1,Math.round(Number(body.days)||1)));
   meta={anonId:String(a.anon_id),...(action==='ban'?{days}:{})};
   w.push(action==='ban'
    ?db.prepare('INSERT INTO anon_bans (net,until,anon_id,reason,actor_id,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(net) DO UPDATE SET until=MAX(anon_bans.until,excluded.until),anon_id=excluded.anon_id,reason=excluded.reason,actor_id=excluded.actor_id,created_at=excluded.created_at').bind(a.anon_net,now+days*864e5,a.anon_id,reason,actor,now)
    :db.prepare('DELETE FROM anon_bans WHERE net=?').bind(a.anon_net));
  }
  if(kind==='comment'&&(action==='hide'||action==='unhide'||action==='delete'))w.push(db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=discussions.id AND status='published') WHERE id=(SELECT discussion_id FROM comments WHERE id=?)").bind(id));
 }
 if(kind==='proposal'){
  // accept = the value goes into the graph through the ingest pipeline (COMMUNITY_VERIFIED, so an
  // official value is never replaced; a conflict is recorded instead); reject = closed with the reason.
  if(action!=='accept'&&action!=='reject')throw new ApiError('BAD_REQUEST','This action does not apply to this target.');
  const pr=await db.prepare("SELECT f.*,e.vertical FROM fact_proposals f JOIN entities e ON e.id=f.entity_id WHERE f.id=?").bind(id).first();
  if(!pr)throw new ApiError('NOT_FOUND','No such proposal.');
  if(pr.status!=='open')throw new ApiError('OPERATION_CONFLICT','Already reviewed.');
  // Claim the proposal first, so two moderators acting at once cannot both apply it.
  const claim=await db.prepare("UPDATE fact_proposals SET status=?,reviewer_id=?,reviewed_at=?,reason=? WHERE id=? AND status='open'").bind(action==='accept'?'accepted':'rejected',actor,now,reason,id).run();
  if(!Number(claim?.meta?.changes))throw new ApiError('OPERATION_CONFLICT','Already reviewed.');
  if(action==='accept'){
   const src=`src:proposal-${String(id).toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,40)}`;
   await ingest(db,{schema:SEED_SCHEMA,vertical:String(pr.vertical),sources:[{id:src,kind:'COMMUNITY',url:String(pr.source_url),retrieved:new Date(Number(pr.created_at)).toISOString().slice(0,10)}],
    entities:[{id:String(pr.entity_id),facts:[{p:String(pr.property),v:JSON.parse(String(pr.value)),...(pr.unit?{unit:String(pr.unit)}:{}),ver:'COMMUNITY_VERIFIED',src,note:`Proposed by a member, accepted by a moderator (${reason})`.slice(0,300)}]}]},{mode:'community',actor:`moderator:${actor}`,now});
  }
 }
 if(kind==='user'){
  if(id===actor)throw new ApiError('FORBIDDEN','You cannot moderate your own account.');
  if(id===ANON_USER)throw new ApiError('BAD_REQUEST','Anonymous writers are banned by network: use 차단 on their post or comment.');
  if(!await db.prepare('SELECT 1 FROM users WHERE id=?').bind(id).first())throw new ApiError('NOT_FOUND','No such account.');
  const target=await db.prepare('SELECT role FROM user_profiles WHERE user_id=?').bind(id).first();
  if((RANK[String(target?.role||'user')]??0)>=(RANK[actorRole]??0))throw new ApiError('FORBIDDEN','Only a higher role can act on this account.');
  // A member who never wrote has no profile yet: create it so the restriction applies.
  await db.prepare("INSERT OR IGNORE INTO user_profiles (user_id,display_name,created_at,updated_at) VALUES (?,?,?,?)").bind(id,defaultNickname(id),now,now).run();
  const days=Math.min(365,Math.max(1,Number(body.days)||7));
  if(action==='restrict')w.push(db.prepare('UPDATE user_profiles SET restricted_until=?,strikes=strikes+1,updated_at=? WHERE user_id=?').bind(now+days*864e5,now,id));
  if(action==='unrestrict')w.push(db.prepare('UPDATE user_profiles SET restricted_until=NULL,updated_at=? WHERE user_id=?').bind(now,id));
 }
 if(!w.length&&action!=='dismiss'&&kind!=='proposal')throw new ApiError('BAD_REQUEST','This action does not apply to this target.');
 // A ban leaves the reports open: the post or comment itself still needs a decision.
 if(action!=='ban'&&action!=='unban')w.push(db.prepare("UPDATE content_flags SET status=?,resolved_by=?,resolved_at=? WHERE target_kind=? AND target_id=? AND status='open'").bind(action==='dismiss'?'dismissed':'resolved',actor,now,kind,id));
 w.push(db.prepare('INSERT INTO moderation_actions (actor_id,action,target_kind,target_id,reason,meta,created_at) VALUES (?,?,?,?,?,?,?)').bind(actor,action,kind,id,reason,JSON.stringify(kind==='user'&&action==='restrict'?{days:Number(body.days)||7}:meta),now));
 await db.batch(w);
 if(kind==='discussion'||kind==='comment'){
  // A deleted post's images are removed from R2 for good (and answer 451 from now on).
  if(action==='delete'&&kind==='discussion')await deleteImages(env,db,(await imagesOf(db,'discussion',id)).filter(i=>i.status!=='deleted'),'mod',origin);
  await purgeTarget(db,origin,kind,id);
 }
 return {ok:true};
}
