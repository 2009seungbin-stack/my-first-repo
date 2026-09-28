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
import {channelUrl,postUrl} from '../../platform/render/ui.js';

const ROUTES=/** @type {Record<string,1>} */({'GET /state':1,'GET /new-posts':1,'POST /follow':1,'POST /posts':1,'POST /comments':1,'POST /votes':1,'POST /reports':1,'POST /rollout':1,'POST /profile':1,'POST /flags':1});

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
    if(/^(레이더봇|radar ?bot|운영자|관리자|admin|nerulio)/i.test(name))throw new ApiError('BAD_REQUEST','This nickname is reserved.',{field:'displayName'});
    const taken=await db.prepare('SELECT 1 FROM user_profiles WHERE display_name=? AND user_id<>?').bind(name,context.user.id).first();
    if(taken)throw new ApiError('OPERATION_CONFLICT','This nickname is taken.',{field:'displayName'});
    await db.prepare('UPDATE user_profiles SET display_name=?,updated_at=? WHERE user_id=?').bind(name,now,context.user.id).run();
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
    await purge(origin,bothLocales(l=>channelUrl(l,e)));
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
    await purge(origin,[...bothLocales(l=>postUrl(l,post,Number(post.post_no))),...bothLocales(l=>channelUrl(l,post))]);
    return done({id},201);
   }
   case 'POST /votes':{
    only(body,['kind','id','value']);
    const kind=body.kind==='comment'?'comment':body.kind==='discussion'?'discussion':null;
    const value=body.value===1||body.value===-1||body.value===0?body.value:null;
    if(!kind||value===null||typeof body.id!=='string')throw new ApiError('BAD_REQUEST','Invalid vote.');
    const own=await db.prepare(`SELECT author_id FROM ${kind==='discussion'?'discussions':'comments'} WHERE id=?`).bind(body.id).first();
    if(!own)throw new ApiError('NOT_FOUND');
    if(own.author_id===context.user.id)throw new ApiError('FORBIDDEN','You cannot vote on your own writing.');
    await limit('vote',LIMITS.votesPerMinute);
    const r=await castVote(db,{kind,id:body.id,userId:context.user.id,value},now);
    return done(r);
   }
   case 'POST /flags':{
    only(body,['target','reason','note']);
    const m=/^(discussion|comment|report|wiki_revision|fact|entity|user):([\w:.-]{1,100})$/.exec(String(body.target||''));
    if(!m)throw new ApiError('BAD_REQUEST','Invalid target.',{field:'target'});
    if(!['spam','abuse','wrong_info','source_dispute','duplicate','copyright','other'].includes(String(body.reason)))throw new ApiError('BAD_REQUEST','Invalid reason.',{field:'reason'});
    const note=body.note===undefined||body.note===''?null:text(body.note,[1,1000],'note');
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
  const rows=(await db.prepare(`SELECT target_kind,target_id,value FROM votes WHERE user_id=? AND ((target_kind='discussion' AND target_id=?) OR (target_kind='comment' AND target_id IN (SELECT id FROM comments WHERE discussion_id=?)))`).bind(user.id,post,post).all()).results||[];
  for(const r of rows)out.votes[r.target_id]=Number(r.value);
 }
 return out;
}

/** Structured compat/issue report (ProtonDB-style): stored as a community report, recomputes the
 * community verdict, and becomes a 리포트 post so it can be discussed.
 * @param {any} db @param {any} context @param {any} body @param {number} now @param {(n:string,l:number)=>Promise<void>} limit @param {string} origin */
async function report(db,context,body,now,limit,origin){
 only(body,['kind','entityId','subjectVersion','targetId','targetVersion','result','env','comment','title']);
 if(body.kind!=='compat'&&body.kind!=='issue')throw new ApiError('BAD_REQUEST','kind must be compat or issue.');
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
 let verdict=null;
 if(body.kind==='compat'&&target)verdict=(await recomputeCompat(db,{subject:subject.id,subjectVersion:sv||'*',target:target.id,targetVersion:tv||'*',envKey:'',env:{}},now)).verdict;
 // A compat report (or any report with text) is also a post; a bare "it's down" click is only counted.
 if(body.kind==='issue'&&!comment&&!body.title)return {id,verdict:null,postNo:null,url:null};
 const board=target&&body.kind==='compat'?target:subject;
 const RESULT_KO=/** @type {Record<string,string>} */({works:'작동',works_with_issues:'일부 문제',broken:'안 됨'});
 // "테스트 게임 한글패치 1.7 × 테스트 게임 2.3.1: 작동" — names in Korean, the report language.
 const nm=(/** @type {{names:Record<string,string>}} */ x)=>x.names.ko||x.names.en||'';
 const title=body.title?text(body.title,[2,120],'title'):(target?`${nm(subject)}${sv?' '+sv:''} × ${nm(target)}${tv?' '+tv:''}: ${RESULT_KO[result]}`:`${nm(subject)}${sv?' '+sv:''}: ${RESULT_KO[result]}`).slice(0,120);
 const postId=randomToken(12);
 const no=await createPost(db,{id:postId,entityId:board.id,kind:'report',title,body:comment||RESULT_KO[result],locale:'ko',authorId:context.user.id,reportId:id},now);
 await purge(origin,[...bothLocales(l=>channelUrl(l,board)),...(board.id!==subject.id?bothLocales(l=>channelUrl(l,subject)):[])]);
 return {id,verdict,postNo:no,url:postUrl('ko',board,no)};
}
