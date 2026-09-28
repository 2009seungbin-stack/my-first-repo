// @ts-check
/** /api/v2 — the platform's write API for the page islands (PLATFORM=on builds only).
 * Same conventions as /api/v1: JSON bodies only, same-origin POSTs, no CORS, session cookie auth,
 * app-level burst limits, error codes as the client contract. Reading is anonymous; every write
 * needs a signed-in account (architecture D7). After a write, the edge-cached page it changes is
 * purged so the author sees it at once. */
import {runtimeConfig} from '../config.js';
import {ApiError,json,errorResponse,readJSON} from '../http.js';
import {resolveContext} from '../identity.js';
import {allowRequest} from '../ratelimit.js';
import {randomToken} from '../crypto.js';
import {assertSameOrigin} from '../api.js';
import {POST_KINDS,writableKinds,createPost,castVote,recomputeCompat,LIMITS} from '../../platform/community.js';
export {LIMITS};
import {envKey,ENTITY_ID,PLATFORMS} from '../../platform/schema.js';
import {channelUrl,postUrl,nameOf} from '../../platform/render/ui.js';
import {changesFor,entitiesByIds} from '../../platform/db/channel.js';
import {describeChange} from '../../platform/change-text.js';

const ROUTES=/** @type {Record<string,1>} */({'GET /state':1,'GET /new-posts':1,'POST /follow':1,'POST /posts':1,'POST /comments':1,'POST /votes':1,'POST /reports':1,'POST /rollout':1,'POST /profile':1,'POST /flags':1,'GET /my-radar':1,'POST /my-radar/seen':1,'GET /mod/queue':1,'GET /follows':1,'GET /posts/source':1,'POST /posts/edit':1,'POST /posts/delete':1,'POST /comments/edit':1,'POST /comments/delete':1,'POST /mod/action':1});

/** @param {unknown} v @param {[number,number]} range @param {string} field */
function text(v,[min,max],field){
 if(typeof v!=='string')throw new ApiError('BAD_REQUEST',`${field} is required.`);
 const s=v.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim();
 if([...s].length<min||[...s].length>max)throw new ApiError('BAD_REQUEST',`${field} must be ${min}–${max} characters.`,{field});
 return s;
}
/** @param {unknown} v */
const optVersion=v=>{if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||v.length>LIMITS.version||!/^[\w.+\- ()*]+$/.test(v))throw new ApiError('BAD_REQUEST','Invalid version.');return v.trim();};
/** @param {Record<string,unknown>} body @param {string[]} allowed */
function only(body,allowed){for(const k of Object.keys(body))if(!allowed.includes(k))throw new ApiError('BAD_REQUEST',`Unexpected field: ${k.slice(0,40)}`);return body;}

/** Until a member picks a nickname: "user-" + the first characters of the account id. @param {string} id */
export const defaultNickname=id=>`user-${String(id).replace(/[^A-Za-z0-9]/g,'').slice(0,6).toLowerCase()}`;
/** Public nickname: never the Google account name. Created on first write. @param {any} db @param {any} user @param {number} now */
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
 const e=await db.prepare("SELECT id,vertical,slug,names FROM entities WHERE id=? AND status='active'").bind(id).first();
 if(!e)throw new ApiError('NOT_FOUND','Channel not found.');
 let names={};try{names=JSON.parse(String(e.names));}catch{}
 return /** @type {{id:string,vertical:string,slug:string,names:Record<string,string>}} */({id:String(e.id),vertical:String(e.vertical),slug:String(e.slug),names});
}
/** Purge the cached HTML of pages a write changed (both languages). @param {string} origin @param {string[]} paths */
async function purge(origin,paths){
 const cache=/** @type {any} */(globalThis).caches?.default;if(!cache)return;
 await Promise.all(paths.map(p=>cache.delete(new Request(origin+p)).catch(()=>false)));
}
const bothLocales=(/** @type {(l:string)=>string} */ f)=>['ko','en'].map(f);
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
 /** @type {any} */let context=null;
 try{
  if(!ROUTES[key]){
   const methods=['GET','POST'].filter(m=>ROUTES[`${m} ${route}`]);
   if(methods.length)return errorResponse(new ApiError('METHOD_NOT_ALLOWED'),{Allow:methods.join(', ')});
   throw new ApiError('NOT_FOUND');
  }
  const cfg=runtimeConfig(env),now=(deps.now||Date.now)(),db=env.DB;
  if(!cfg.configured)throw new ApiError('SERVICE_NOT_CONFIGURED');
  if(request.method==='POST')assertSameOrigin(request,cfg);
  context=await resolveContext(request,cfg,db,now);
  const done=(/** @type {any} */ body,status=200)=>json(body,status,{'Set-Cookie':context.setCookies});
  const origin=cfg.siteOrigin||url.origin;
  // Reads (anonymous allowed).
  if(key==='GET /state')return done(await state(db,context,url.searchParams));
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
  if(key==='GET /posts/source'){
   if(!context.user)throw new ApiError('LOGIN_REQUIRED');
   const p=await db.prepare("SELECT title,body_md,author_id,status FROM discussions WHERE id=?").bind(String(url.searchParams.get('id')||'')).first();
   if(!p||p.author_id!==context.user.id||!(p.status==='published'||p.status==='locked'))throw new ApiError('NOT_FOUND');
   return done({title:String(p.title),body:String(p.body_md)});
  }
  if(key==='GET /mod/queue'){const p=await moderator(db,context);return done(await modQueue(db,p));}
  if(key==='GET /my-radar'){if(!context.user)throw new ApiError('LOGIN_REQUIRED');return done(await myRadar(db,context.user.id,url.searchParams.get('l')==='en'?'en':'ko'));}
  // Writes.
  if(!context.user)throw new ApiError('LOGIN_REQUIRED');
  const limit=async(/** @type {string} */ name,/** @type {number} */ n)=>{if(!await allowRequest({env,limiter:deps.limiter,key:`v2:${name}|u:${context.user.id}`,limit:n,now}))throw new ApiError('RATE_LIMITED','Too many requests. Please wait a minute.',{retryAfter:60});};
  const profile=await ensureProfile(db,context.user,now);
  assertMayWrite(profile,now);
  const body=await readJSON(request,key==='POST /posts'?64*1024:8192);
  switch(key){
   case 'POST /profile':{
    only(body,['displayName']);
    const name=text(body.displayName,LIMITS.nickname,'displayName');
    // Reserved: staff-looking names and the "user-xxxxxx" form every new account starts with.
    if(/^(레이더봇|radar ?bot|운영자|관리자|admin|nerulio)/i.test(name)||/^user-[a-z0-9]{1,12}$/i.test(name))throw new ApiError('BAD_REQUEST','This nickname is reserved.',{field:'displayName'});
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
    const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body');
    await limit('post',LIMITS.postsPerMinute);
    const id=randomToken(12);
    const no=await createPost(db,{id,entityId:e.id,kind,title,body:md,locale:url.searchParams.get('l')==='en'?'en':'ko',authorId:context.user.id},now);
    await purge(origin,pagesOf(e));
    return done({id,postNo:no,url:postUrl(url.searchParams.get('l')==='en'?'en':'ko',e,no)},201);
   }
   case 'POST /comments':{
    only(body,['postId','parentId','body']);
    const post=await db.prepare("SELECT d.id,d.entity_id,d.post_no,d.status,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
    if(!post||post.status==='hidden'||post.status==='deleted')throw new ApiError('NOT_FOUND','Post not found.');
    if(post.status==='locked')throw new ApiError('FORBIDDEN','Comments are closed on this post.');
    let parent=null;
    if(body.parentId!==undefined&&body.parentId!==null&&body.parentId!==''){
     parent=await db.prepare("SELECT id FROM comments WHERE id=? AND discussion_id=? AND status<>'hidden'").bind(String(body.parentId),post.id).first();
     if(!parent)throw new ApiError('BAD_REQUEST','The comment you replied to is gone.',{field:'parentId'});
    }
    const md=text(body.body,LIMITS.comment,'body');
    await limit('comment',LIMITS.commentsPerMinute);
    const id=randomToken(12);
    await db.batch([
     db.prepare('INSERT INTO comments (id,discussion_id,parent_id,author_id,body_md,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,post.id,parent?parent.id:null,context.user.id,md,now,now),
     db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published'),last_activity_at=? WHERE id=?").bind(post.id,now,post.id)]);
    await purge(origin,pagesOf({vertical:String(post.vertical),slug:String(post.slug)},Number(post.post_no)));
    return done({id},201);
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
    only(body,key==='POST /posts/edit'?['postId','title','body']:['postId']);
    const p=await db.prepare("SELECT d.id,d.author_id,d.status,d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?").bind(String(body.postId||'')).first();
    // Only the author, and only while the post is visible (a moderator-hidden post stays as the moderator left it).
    if(!p||p.author_id!==context.user.id||!(p.status==='published'||p.status==='locked'))throw new ApiError('NOT_FOUND');
    await limit('post-edit',10);
    if(key==='POST /posts/edit'){
     const title=text(body.title,LIMITS.title,'title'),md=text(body.body,LIMITS.body,'body');
     await db.prepare('UPDATE discussions SET title=?,body_md=?,edited_at=?,updated_at=? WHERE id=?').bind(title,md,now,now,p.id).run();
    }else await db.prepare("UPDATE discussions SET status='deleted',updated_at=? WHERE id=?").bind(now,p.id).run();
    await purge(origin,pagesOf({vertical:String(p.vertical),slug:String(p.slug)},Number(p.post_no)));
    return done({ok:true});
   }
   case 'POST /comments/edit':case 'POST /comments/delete':{
    only(body,key==='POST /comments/edit'?['commentId','body']:['commentId']);
    const c=await db.prepare("SELECT c.id,c.author_id,c.status,c.discussion_id,d.post_no,e.vertical,e.slug FROM comments c JOIN discussions d ON d.id=c.discussion_id JOIN entities e ON e.id=d.entity_id WHERE c.id=?").bind(String(body.commentId||'')).first();
    if(!c||c.author_id!==context.user.id||c.status!=='published')throw new ApiError('NOT_FOUND');
    await limit('post-edit',10);
    if(key==='POST /comments/edit'){const md=text(body.body,LIMITS.comment,'body');await db.prepare('UPDATE comments SET body_md=?,edited_at=?,updated_at=? WHERE id=?').bind(md,now,now,c.id).run();}
    else await db.batch([db.prepare("UPDATE comments SET status='deleted',updated_at=? WHERE id=?").bind(now,c.id),
     db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=? AND status='published') WHERE id=?").bind(c.discussion_id,c.discussion_id)]);
    await purge(origin,pagesOf({vertical:String(c.vertical),slug:String(c.slug)},Number(c.post_no)));
    return done({ok:true});
   }
   case 'POST /mod/action':{
    const me=await moderator(db,context);
    return done(await modAction(db,context.user.id,String(me.role),body,now,origin));
   }
   case 'POST /my-radar/seen':{
    only(body,['lastChangeId']);
    const id=Number(body.lastChangeId);if(!Number.isInteger(id)||id<0)throw new ApiError('BAD_REQUEST','Invalid lastChangeId.');
    await db.prepare('INSERT INTO radar_state (user_id,last_seen_change_id,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen_change_id=MAX(radar_state.last_seen_change_id,excluded.last_seen_change_id),updated_at=excluded.updated_at').bind(context.user.id,id,now).run();
    return done({ok:true});
   }
   case 'POST /flags':{
    only(body,['target','reason','note']);
    const m=/^(discussion|comment|report|wiki_revision|fact|entity|user):([\w:.-]{1,100})$/.exec(String(body.target||''));
    if(!m)throw new ApiError('BAD_REQUEST','Invalid target.',{field:'target'});
    if(!['spam','abuse','wrong_info','source_dispute','duplicate','copyright','other'].includes(String(body.reason)))throw new ApiError('BAD_REQUEST','Invalid reason.',{field:'reason'});
    const note=body.note===undefined||body.note===''?null:text(body.note,[1,1000],'note');
    const TABLE=/** @type {Record<string,string>} */({discussion:'discussions',comment:'comments',report:'community_reports',wiki_revision:'wiki_revisions',fact:'facts',entity:'entities',user:'users'});
    if(!await db.prepare(`SELECT 1 FROM ${TABLE[m[1]]} WHERE ${m[1]==='user'?'id':'id'}=?`).bind(m[1]==='wiki_revision'||m[1]==='fact'?Number(m[2])||-1:m[2]).first())throw new ApiError('NOT_FOUND','Nothing to report at this address.',{field:'target'});
    await limit('flag',10);
    // One open flag per reporter and target; repeats update the reason instead of piling up.
    const open=await db.prepare("SELECT id FROM content_flags WHERE target_kind=? AND target_id=? AND reporter_id=? AND status='open'").bind(m[1],m[2],context.user.id).first();
    if(open)await db.prepare('UPDATE content_flags SET reason=?,note=? WHERE id=?').bind(body.reason,note,open.id).run();
    else await db.prepare('INSERT INTO content_flags (id,target_kind,target_id,reporter_id,reason,note,created_at) VALUES (?,?,?,?,?,?,?)').bind(randomToken(12),m[1],m[2],context.user.id,body.reason,note,now).run();
    return done({ok:true},201);
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

/** What the islands need for one page: who is signed in, follow state, the reader's votes.
 * @param {any} db @param {any} context @param {URLSearchParams} q */
async function state(db,context,q){
 const user=context.user;
 const out=/** @type {any} */({signedIn:!!user,user:null,following:false,votes:{}});
 if(!user)return out;
 const p=await db.prepare('SELECT display_name,tier FROM user_profiles WHERE user_id=?').bind(user.id).first();
 out.user={name:p?.display_name||defaultNickname(user.id),tier:p?.tier||'new'};
 const entityId=q.get('entity');
 if(entityId&&ENTITY_ID.test(entityId))out.following=!!(await db.prepare('SELECT 1 FROM follows WHERE user_id=? AND entity_id=?').bind(user.id,entityId).first());
 const post=q.get('post');
 if(post&&/^[\w-]{1,64}$/.test(post)){
  const own=await db.prepare('SELECT author_id FROM discussions WHERE id=?').bind(post).first();
  out.mine={post:own?.author_id===user.id,comments:((await db.prepare("SELECT id FROM comments WHERE discussion_id=? AND author_id=? AND status='published'").bind(post,user.id).all()).results||[]).map((/** @type {any} */ r)=>String(r.id))};
  const rows=(await db.prepare(`SELECT target_kind,target_id,value FROM votes WHERE user_id=? AND ((target_kind='discussion' AND target_id=?) OR (target_kind='comment' AND target_id IN (SELECT id FROM comments WHERE discussion_id=?)))`).bind(user.id,post,post).all()).results||[];
  for(const r of rows)out.votes[r.target_id]=Number(r.value);
 }
 return out;
}

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
 const sv=optVersion(body.subjectVersion),tv=optVersion(body.targetVersion);
 await limit('report',LIMITS.postsPerMinute);
 const id=randomToken(12);
 await db.prepare(`INSERT INTO community_reports (id,kind,entity_id,subject_version,target_id,target_version,env,result,comment,user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(id,body.kind,subject.id,sv,target?.id??null,tv,JSON.stringify(env),result,comment,context.user.id,now,now).run();
 /** @type {any} */let verdict=null;
 const recompute=async()=>{if(body.kind==='compat'&&target){try{verdict=(await recomputeCompat(db,{subject:subject.id,subjectVersion:sv||'*',target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now)).verdict;}
  catch(e){if(!/UNIQUE/i.test(String(/** @type {any} */(e)?.message)))throw e;verdict=(await recomputeCompat(db,{subject:subject.id,subjectVersion:sv||'*',target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now)).verdict;}}};
 // A compat report (or any report with text) is also a post; a bare "it's down" click is only counted.
 if(body.kind==='issue'&&!comment&&!body.title){await recompute();return {id,verdict,postNo:null,url:null};}
 const board=target&&body.kind==='compat'?target:subject;
 const RESULT_KO=/** @type {Record<string,string>} */({works:'작동',works_with_issues:'일부 문제',broken:'안 됨'});
 // "테스트 게임 한글패치 1.7 × 테스트 게임 2.3.1: 작동" — names in Korean, the report language.
 const nm=(/** @type {{names:Record<string,string>}} */ x)=>x.names.ko||x.names.en||'';
 const title=body.title?text(body.title,[2,120],'title'):(target?`${nm(subject)}${sv?' '+sv:''} × ${nm(target)}${tv?' '+tv:''}: ${RESULT_KO[result]}`:`${nm(subject)}${sv?' '+sv:''}: ${RESULT_KO[result]}`).slice(0,120);
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
 * @param {any} db @param {string} userId @param {'ko'|'en'} l */
async function myRadar(db,userId,l){
 const ids=((await db.prepare('SELECT entity_id FROM follows WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(userId).all()).results||[]).map((/** @type {any} */ r)=>String(r.entity_id));
 const seen=Number((await db.prepare('SELECT last_seen_change_id AS n FROM radar_state WHERE user_id=?').bind(userId).first())?.n||0);
 if(!ids.length)return {following:0,unread:0,lastChangeId:seen,changes:[],posts:[]};
 const ents=await entitiesByIds(db,ids);
 const changes=(await changesFor(db,ids,{minImportance:1,limit:30})).map(c=>{const e=ents.get(c.entity_id);const d=describeChange(c,{name:e?nameOf(e,l):''},l);
  return {id:c.id,at:c.detected_at,title:d.title,detail:d.detail,unread:c.id>seen,url:e?channelUrl(l,e):null,channel:e?nameOf(e,l):''};});
 const q=ids.slice(0,40);
 const posts=((await db.prepare(`SELECT d.post_no,d.title,d.kind,d.comment_count,d.created_at,e.vertical,e.slug,e.names FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.status='published' AND d.entity_id IN (${q.map(()=>'?').join(',')}) ORDER BY d.created_at DESC LIMIT 20`).bind(...q).all()).results||[])
  .map((/** @type {any} */ r)=>{const e={vertical:String(r.vertical),slug:String(r.slug),names:JSON.parse(String(r.names||'{}'))};return {title:String(r.title),kind:String(r.kind),comments:Number(r.comment_count),at:Number(r.created_at),url:postUrl(l,e,Number(r.post_no)),channel:nameOf(e,l)};});
 return {following:ids.length,unread:changes.filter(c=>c.unread).length,lastChangeId:Math.max(seen,...changes.map(c=>c.id)),changes,posts};
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
/** Open flags grouped by target, oldest first, with a preview of the flagged text. @param {any} db @param {any} _p */
async function modQueue(db,_p){
 const rows=(await db.prepare(`SELECT target_kind,target_id,GROUP_CONCAT(reason) AS reasons,COUNT(*) AS n,MIN(created_at) AS first_at,MAX(note) AS note FROM content_flags WHERE status='open' GROUP BY target_kind,target_id ORDER BY first_at LIMIT 100`).all()).results||[];
 const items=[];
 for(const r of rows){
  let preview=null,status=null,url=null;
  if(r.target_kind==='discussion'){const d=await db.prepare('SELECT d.title,d.status,d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=?').bind(r.target_id).first();if(d){preview=d.title;status=d.status;url=postUrl('ko',{vertical:String(d.vertical),slug:String(d.slug)},Number(d.post_no));}}
  if(r.target_kind==='comment'){const c=await db.prepare('SELECT body_md,status FROM comments WHERE id=?').bind(r.target_id).first();if(c){preview=String(c.body_md).slice(0,200);status=c.status;}}
  items.push({target:`${r.target_kind}:${r.target_id}`,reasons:[...new Set(String(r.reasons).split(','))],count:Number(r.n),firstAt:Number(r.first_at),note:r.note??null,preview,status,url});
 }
 const log=((await db.prepare('SELECT actor_id,action,target_kind,target_id,reason,created_at FROM moderation_actions ORDER BY id DESC LIMIT 30').all()).results||[]);
 return {items,log};
}
const MOD_ACTIONS=Object.freeze(['hide','unhide','dismiss','restrict','unrestrict']);
/** Apply one moderator action; always logged in moderation_actions with its reason.
 * hide = 임시조치 (the content disappears from boards but is kept), unhide = restore, dismiss = no action.
 * @param {any} db @param {string} actor @param {string} actorRole @param {any} body @param {number} now @param {string} origin */
async function modAction(db,actor,actorRole,body,now,origin){
 only(body,['target','action','reason','days']);
 const m=/^(discussion|comment|user):([\w:.-]{1,100})$/.exec(String(body.target||''));
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
  if(kind==='comment'&&(action==='hide'||action==='unhide'))w.push(db.prepare("UPDATE discussions SET comment_count=(SELECT COUNT(*) FROM comments WHERE discussion_id=discussions.id AND status='published') WHERE id=(SELECT discussion_id FROM comments WHERE id=?)").bind(id));
 }
 if(kind==='user'){
  if(id===actor)throw new ApiError('FORBIDDEN','You cannot moderate your own account.');
  if(!await db.prepare('SELECT 1 FROM users WHERE id=?').bind(id).first())throw new ApiError('NOT_FOUND','No such account.');
  const target=await db.prepare('SELECT role FROM user_profiles WHERE user_id=?').bind(id).first();
  if((RANK[String(target?.role||'user')]??0)>=(RANK[actorRole]??0))throw new ApiError('FORBIDDEN','Only a higher role can act on this account.');
  // A member who never wrote has no profile yet: create it so the restriction applies.
  await db.prepare("INSERT OR IGNORE INTO user_profiles (user_id,display_name,created_at,updated_at) VALUES (?,?,?,?)").bind(id,defaultNickname(id),now,now).run();
  const days=Math.min(365,Math.max(1,Number(body.days)||7));
  if(action==='restrict')w.push(db.prepare('UPDATE user_profiles SET restricted_until=?,strikes=strikes+1,updated_at=? WHERE user_id=?').bind(now+days*864e5,now,id));
  if(action==='unrestrict')w.push(db.prepare('UPDATE user_profiles SET restricted_until=NULL,updated_at=? WHERE user_id=?').bind(now,id));
 }
 if(!w.length&&action!=='dismiss')throw new ApiError('BAD_REQUEST','This action does not apply to this target.');
 w.push(db.prepare("UPDATE content_flags SET status=?,resolved_by=?,resolved_at=? WHERE target_kind=? AND target_id=? AND status='open'").bind(action==='dismiss'?'dismissed':'resolved',actor,now,kind,id));
 w.push(db.prepare('INSERT INTO moderation_actions (actor_id,action,target_kind,target_id,reason,meta,created_at) VALUES (?,?,?,?,?,?,?)').bind(actor,action,kind,id,reason,JSON.stringify(kind==='user'&&action==='restrict'?{days:Number(body.days)||7}:meta),now));
 await db.batch(w);
 if(kind==='discussion'||kind==='comment'){
  const d=await db.prepare(`SELECT d.post_no,e.vertical,e.slug FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.id=${kind==='discussion'?'?':'(SELECT discussion_id FROM comments WHERE id=?)'}`).bind(id).first();
  if(d)await purge(origin,pagesOf({vertical:String(d.vertical),slug:String(d.slug)},Number(d.post_no)));
 }
 return {ok:true};
}
