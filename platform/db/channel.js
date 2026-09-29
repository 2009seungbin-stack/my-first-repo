// @ts-check
/** Read-side repository for channel pages (entity = channel). All SQL for the channel, post and
 * community-front renderers lives here (architecture D2: no SQL in handlers or renderers).
 * Works on any object with the D1 binding API (Cloudflare D1, node:sqlite shim). */

/** @typedef {{prepare(sql:string):any,batch?(stmts:any[]):Promise<any[]>}} D1 */
/** @typedef {{id:string,vertical:string,type:string,slug:string,names:Record<string,string>,descriptions:Record<string,string>,official_urls:{label:string,url:string}[],image_url:string|null,status:string,index_state:string,updated_at:number}} Entity */
/** @typedef {{entity_id:string,property:string,value:any,unit:string|null,verification:string,region:string,language:string,platform:string,plan:string,source_id:string|null,observed_at:number,note:string|null}} Fact */

import {VERIFICATION} from '../schema.js';

const CHUNK=40;
const qs=(/** @type {number} */ n)=>Array(n).fill('?').join(',');
/** @param {string|null|undefined} s @param {any} fallback */
const json=(s,fallback)=>{if(s===null||s===undefined)return fallback;try{return JSON.parse(s);}catch{return fallback;}};
/** @param {any} r @returns {Entity} */
export const entityRow=r=>({id:r.id,vertical:r.vertical,type:r.type,slug:r.slug,names:json(r.names,{}),descriptions:json(r.descriptions,{}),official_urls:json(r.official_urls,[]),image_url:r.image_url??null,status:r.status,index_state:r.index_state||'auto',updated_at:Number(r.updated_at)});
const ENTITY_COLS='id,vertical,type,slug,names,descriptions,official_urls,image_url,status,index_state,updated_at';
/** @param {D1} db @param {string} sql @param {any[]} params @returns {Promise<any[]>} */
const all=async(db,sql,params=[])=>(await db.prepare(sql).bind(...params).all()).results||[];
/** Run an IN (...) query in chunks. @param {D1} db @param {string[]} ids @param {(ph:string)=>string} sql @param {any[]} [pre] @param {any[]} [post] @returns {Promise<any[]>} */
async function inChunks(db,ids,sql,pre=[],post=[]){
 const out=[];const uniq=[...new Set(ids)];
 for(let i=0;i<uniq.length;i+=CHUNK){const c=uniq.slice(i,i+CHUNK);out.push(...await all(db,sql(qs(c.length)),[...pre,...c,...post]));}
 return out;
}

/** The channel for /{l}/{vertical}/{slug}/, following renamed slugs. @param {D1} db @param {string} vertical @param {string} slug */
export async function entityBySlug(db,vertical,slug){
 const r=await db.prepare(`SELECT ${ENTITY_COLS} FROM entities WHERE vertical=? AND slug=? AND status='active'`).bind(vertical,slug).first();
 if(r)return {entity:entityRow(r),redirect:null};
 const red=await db.prepare(`SELECT e.slug FROM entity_redirects r JOIN entities e ON e.id=r.entity_id WHERE r.vertical=? AND r.slug=? AND e.status='active'`).bind(vertical,slug).first();
 return {entity:null,redirect:red?String(red.slug):null};
}
/** @param {D1} db @param {string[]} ids @returns {Promise<Map<string,Entity>>} */
export async function entitiesByIds(db,ids){
 const rows=await inChunks(db,ids,ph=>`SELECT ${ENTITY_COLS} FROM entities WHERE status='active' AND id IN (${ph})`);
 return new Map(rows.map(r=>[r.id,entityRow(r)]));
}
/** Current facts of many entities. @param {D1} db @param {string[]} ids @returns {Promise<Map<string,Fact[]>>} */
export async function factsFor(db,ids){
 const rows=await inChunks(db,ids,ph=>`SELECT entity_id,property,value,unit,verification,region,language,platform,plan,source_id,observed_at,note FROM facts WHERE is_current=1 AND entity_id IN (${ph})`);
 /** @type {Map<string,Fact[]>} */const out=new Map();
 for(const r of rows){const list=out.get(r.entity_id)||[];list.push({...r,value:json(r.value,null),observed_at:Number(r.observed_at)});out.set(r.entity_id,list);}
 return out;
}
const verRank=(/** @type {string} */ v)=>{const i=VERIFICATION.indexOf(/** @type {any} */(v));return i<0?99:i;};
const neutral=(/** @type {{region:string}} */ f)=>f.region==='*'||f.region==='GLOBAL'?1:0;
/**
 * The fact to show for a property: the reader's region first (KR on Korean pages), then the global
 * row, then any row. Plan/platform-scoped rows are only used when asked for.
 * @param {Fact[]|undefined} facts @param {string} property @param {{region?:string,plan?:string,platform?:string,language?:string}} [scope]
 */
export function pickFact(facts,property,scope={}){
 const rows=(facts||[]).filter(f=>f.property===property&&f.plan===(scope.plan||'*')&&(scope.platform?f.platform===scope.platform:true));
 if(!rows.length)return null;
 // Text facts may have a translation (language 'ko'): the reader's language first, then the
 // language-neutral row, then any other.
 const lr=(/** @type {any} */ f)=>scope.language&&f.language===scope.language?0:!f.language||f.language==='*'?1:2;
 rows.sort((a,b)=>lr(a)-lr(b));
 const own=rows.find(f=>scope.region&&f.region===scope.region);if(own)return own;
 // No row for the reader's region: the most trusted row, the region-neutral one on a tie (a
 // community value for all regions never hides an official value for one region).
 const lang=lr(rows[0]);
 return rows.filter(f=>lr(f)===lang).sort((a,b)=>verRank(a.verification)-verRank(b.verification)||neutral(b)-neutral(a))[0];
}
/** Relations of an entity, with the entity on the other side. dir 'out' = entity is subject.
 * @param {D1} db @param {string} id @param {'out'|'in'} dir @param {string[]} predicates */
export async function related(db,id,dir,predicates){
 const [me,other]=dir==='out'?['subject_id','object_id']:['object_id','subject_id'];
 const rows=await all(db,`SELECT r.predicate,r.meta,r.verification,r.source_id,${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM relations r JOIN entities e ON e.id=r.${other}
  WHERE r.${me}=? AND r.predicate IN (${qs(predicates.length)}) AND r.valid_until IS NULL AND e.status='active'`,[id,...predicates]);
 return rows.map(r=>({predicate:String(r.predicate),meta:json(r.meta,{}),verification:String(r.verification),entity:entityRow(r)}));
}
/** Relations for many entities at once (e.g. voice actors of all characters). @param {D1} db @param {string[]} ids @param {string} predicate */
export async function relatedMany(db,ids,predicate){
 const rows=await inChunks(db,ids,ph=>`SELECT r.subject_id AS from_id,${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM relations r JOIN entities e ON e.id=r.object_id
  WHERE r.predicate=? AND r.valid_until IS NULL AND e.status='active' AND r.subject_id IN (${ph})`,[predicate]);
 /** @type {Map<string,Entity[]>} */const out=new Map();
 for(const r of rows){const l=out.get(r.from_id)||[];l.push(entityRow(r));out.set(r.from_id,l);}
 return out;
}
/** Newest first. @param {D1} db @param {string} id @param {number} [limit] */
export async function versionsOf(db,id,limit=10){
 const rows=await all(db,`SELECT version,channel,released_at,notes_url,verification,detected_at FROM versions WHERE entity_id=? ORDER BY COALESCE(released_at,detected_at) DESC,id DESC LIMIT ?`,[id,limit]);
 return rows.map(r=>({version:String(r.version),channel:String(r.channel),released_at:r.released_at===null?null:Number(r.released_at),notes_url:r.notes_url??null,verification:String(r.verification),detected_at:Number(r.detected_at)}));
}
/** Events linked to any of the entities. @param {D1} db @param {string[]} ids @param {{from?:number,to?:number,kinds?:string[],limit?:number,desc?:boolean}} [o] */
export async function eventsFor(db,ids,o={}){
 if(!ids.length)return [];
 const kinds=o.kinds||[];
 const rows=await inChunks(db,ids,ph=>`SELECT DISTINCT ev.id,ev.kind,ev.title,ev.starts_at,ev.ends_at,ev.date_precision,ev.region,ev.location,ev.url,ev.status,ev.verification,ev.updated_at FROM events ev JOIN event_entities x ON x.event_id=ev.id
  WHERE x.entity_id IN (${ph}) AND ev.status<>'cancelled'${o.from!==undefined?' AND COALESCE(ev.ends_at,ev.starts_at)>=?':''}${o.to!==undefined?' AND ev.starts_at<=?':''}${kinds.length?` AND ev.kind IN (${qs(kinds.length)})`:''}`,[],[...(o.from!==undefined?[o.from]:[]),...(o.to!==undefined?[o.to]:[]),...kinds]);
 const seen=new Set(),list=[];
 for(const r of rows){if(seen.has(r.id))continue;seen.add(r.id);list.push({id:Number(r.id),kind:String(r.kind),title:json(r.title,{}),starts_at:r.starts_at===null?null:Number(r.starts_at),ends_at:r.ends_at===null?null:Number(r.ends_at),precision:String(r.date_precision),region:String(r.region),location:r.location??null,url:r.url??null,status:String(r.status),verification:String(r.verification),updated_at:Number(r.updated_at)});}
 list.sort((a,b)=>o.desc?(b.starts_at??0)-(a.starts_at??0):(a.starts_at??Infinity)-(b.starts_at??Infinity));
 return list.slice(0,o.limit??50);
}
/** Radar changes about the entities, newest first. @param {D1} db @param {string[]} ids @param {{minImportance?:number,limit?:number}} [o] */
export async function changesFor(db,ids,o={}){
 const rows=await inChunks(db,ids,ph=>`SELECT id,entity_id,vertical,kind,property,scope,old_value,new_value,summary,importance,source_id,ref_id,effective_at,detected_at FROM changes
  WHERE visibility='public' AND importance>=? AND entity_id IN (${ph}) ORDER BY id DESC LIMIT ?`,[o.minImportance??1],[o.limit??20]);
 // scope/old/new/summary stay JSON text: describeChange() (platform/change-text.js) parses them.
 return rows.map(r=>({...r,id:Number(r.id),importance:Number(r.importance),effective_at:Number(r.effective_at),detected_at:Number(r.detected_at)}))
  .sort((a,b)=>b.detected_at-a.detected_at||b.id-a.id).slice(0,o.limit??20);
}
/** Current availability rows. @param {D1} db @param {string[]} ids */
export async function availabilityFor(db,ids){
 const rows=await inChunks(db,ids,ph=>`SELECT entity_id,plan_id,platform,region,state,verification,note,observed_at FROM availability WHERE is_current=1 AND entity_id IN (${ph})`);
 return rows.map(r=>({...r,observed_at:Number(r.observed_at)}));
}
/** Current compatibility rows where the entity is target (patches → game) or subject (app → OS).
 * @param {D1} db @param {{target?:string,subject?:string}} k */
export async function compatibilityOf(db,k){
 const [col,id]=k.target?['target_id',k.target]:['subject_id',/** @type {string} */(k.subject)];
 const rows=await all(db,`SELECT subject_id,subject_version,target_id,target_version,env,status,verification,note,min_subject_version,confirmations,contradictions,last_confirmed_at,updated_at FROM compatibility WHERE is_current=1 AND ${col}=?`,[id]);
 return rows.map(r=>({...r,env:json(r.env,{}),confirmations:Number(r.confirmations),contradictions:Number(r.contradictions),updated_at:Number(r.updated_at)}));
}
/** Published compat reports per (subject version, target version) for the vote counts under a panel.
 * @param {D1} db @param {string} subject @param {string} target */
export async function compatReportCounts(db,subject,target){
 // Each person's latest report per game version (whatever patch version it names): the strip,
 // the wiki table and the verdict all count people, not clicks.
 const rows=await all(db,`SELECT sv,tv,result,COUNT(*) AS n FROM (SELECT COALESCE(subject_version,'*') AS sv,COALESCE(target_version,'*') AS tv,result,
  ROW_NUMBER() OVER (PARTITION BY user_id,COALESCE(target_version,'*') ORDER BY created_at DESC,rowid DESC) AS rn FROM community_reports
  WHERE kind='compat' AND status='published' AND visibility<>'private' AND entity_id=? AND target_id=?) WHERE rn=1 GROUP BY 1,2,3`,[subject,target]);
 return rows.map(r=>({sv:String(r.sv),tv:String(r.tv),result:String(r.result),n:Number(r.n)}));
}
/** Community benchmark reports measured on a GPU. @param {D1} db @param {string} gpuId */
export async function benchmarksOn(db,gpuId){
 const rows=await all(db,`SELECT entity_id,subject_version,env,metrics,created_at FROM community_reports WHERE kind='benchmark' AND status='published' AND visibility<>'private' AND (target_id=? OR entity_id=?)`,[gpuId,gpuId]);
 return rows.map(r=>({entity_id:String(r.entity_id),env:json(r.env,{}),metrics:json(r.metrics,{}),created_at:Number(r.created_at)}));
}
/** Issue reports filed against an entity version (e.g. "driver 581.xx: problems?"). @param {D1} db @param {string} id @param {string|null} version */
export async function issueCounts(db,id,version){
 const rows=await all(db,`SELECT result,COUNT(*) AS n FROM community_reports WHERE kind='issue' AND status='published' AND entity_id=? AND COALESCE(subject_version,'*')=? GROUP BY 1`,[id,version??'*']);
 return Object.fromEntries(rows.map(r=>[String(r.result),Number(r.n)]));
}
/** Rollout votes of features, for rolloutSummary(). @param {D1} db @param {string[]} featureIds */
export async function rolloutVotes(db,featureIds){
 const rows=await inChunks(db,featureIds,ph=>`SELECT v.feature_id,v.has_it,v.country,v.plan_id,v.platform,v.updated_at,u.created_at AS account_created_at FROM rollout_votes v JOIN users u ON u.id=v.user_id WHERE v.status='ok' AND v.feature_id IN (${ph})`);
 /** @type {Map<string,any[]>} */const out=new Map();
 for(const r of rows){const l=out.get(r.feature_id)||[];l.push({has_it:Number(r.has_it),country:String(r.country),plan_id:String(r.plan_id),platform:String(r.platform),updated_at:Number(r.updated_at),account_created_at:Number(r.account_created_at)});out.set(r.feature_id,l);}
 return out;
}
/** Collector health for "last checked" labels. @param {D1} db @param {string[]} adapters */
export async function collectorState(db,adapters){
 const rows=await inChunks(db,adapters,ph=>`SELECT adapter,last_success_at,last_attempt_at,consecutive_failures FROM collectors WHERE adapter IN (${ph})`);
 return new Map(rows.map(r=>[String(r.adapter),{last_success_at:r.last_success_at===null?null:Number(r.last_success_at),failures:Number(r.consecutive_failures)}]));
}

/* ---------- community (게시판) ---------- */

const POST_COLS=`d.id,d.entity_id,d.post_no,d.channel_id,d.channel_no,COALESCE(d.flair,d.kind) AS kind,d.title,d.locale,d.author_id,d.change_id,d.report_id,d.status,d.pinned,d.solved_comment_id,d.up_count,d.down_count,d.view_count,d.comment_count,d.has_image,d.best_at,d.created_at,d.edited_at,d.last_activity_at,d.anon_name,d.anon_id,
 COALESCE(p.display_name,CASE WHEN u.provider='system' THEN u.display_name ELSE 'user-'||lower(substr(u.id,1,6)) END) AS author_name,COALESCE(p.tier,'new') AS author_tier,COALESCE(p.role,'user') AS author_role`;
/** @param {any} r */
const postRow=r=>({id:String(r.id),entity_id:String(r.entity_id),post_no:Number(r.post_no),channel_id:String(r.channel_id||'free'),channel_no:Number(r.channel_no||0),tags:/** @type {Entity[]} */([]),kind:String(r.kind),title:String(r.title),locale:String(r.locale),author_id:String(r.author_id),author_name:r.anon_name??r.author_name??null,anon_id:r.anon_id==null?null:String(r.anon_id),anon:r.anon_id!=null,author_tier:String(r.author_tier),author_role:String(r.author_role),
 bot:String(r.author_id).startsWith('system:'),change_id:r.change_id??null,report_id:r.report_id??null,status:String(r.status),pinned:!!r.pinned,up:Number(r.up_count),down:Number(r.down_count),views:Number(r.view_count),comments:Number(r.comment_count),has_image:!!r.has_image,
 solved:r.solved_comment_id?String(r.solved_comment_id):null,best_at:r.best_at===null||r.best_at===undefined?null:Number(r.best_at),created_at:Number(r.created_at),edited_at:r.edited_at===null||r.edited_at===undefined?null:Number(r.edited_at),last_activity_at:Number(r.last_activity_at),
 entity:r.e_id?entityRow({id:r.e_id,vertical:r.e_vertical,type:r.e_type,slug:r.e_slug,names:r.e_names,descriptions:'{}',official_urls:'[]',image_url:null,status:'active',updated_at:0}):null});
export const SORTS=/** @type {const} */(['new','hot','top','activity']);
/** Relations that make one tag part of another. A post tagged with a part also shows under the whole:
 * Claude → its plans, features and the models in its plans; Anthropic → Claude, Claude Code and its
 * models; a game → its Korean patches; a franchise → its works, characters and goods; NVIDIA → its cards.
 * CHILD_OF: the subject is the part; PARENT_OF: the object is the part. Two hops at most. */
export const TAG_CHILD_OF=Object.freeze(['part_of','made_by','belongs_to','appears_in','translates','merchandise_of','variant_of','developed_by','published_by','produced_by']);
export const TAG_PARENT_OF=Object.freeze(['has_plan','offers','includes_model']);
export const TAG_DEPTH=2;
const inList=(/** @type {readonly string[]} */ a)=>a.map(x=>`'${x}'`).join(',');
/** SQL of the tag and its parts (a recursive CTE named scope; one bound parameter: the tag). */
const SCOPE_CTE=`WITH RECURSIVE scope(id,depth) AS (SELECT ?,0 UNION SELECT CASE WHEN r.object_id=scope.id THEN r.subject_id ELSE r.object_id END,scope.depth+1 FROM relations r JOIN scope ON ((r.object_id=scope.id AND r.predicate IN (${inList(TAG_CHILD_OF)})) OR (r.subject_id=scope.id AND r.predicate IN (${inList(TAG_PARENT_OF)}))) WHERE scope.depth<${TAG_DEPTH} AND r.valid_until IS NULL)`;
/** A tag's parts (without the tag itself), for "하위 태그" lists. @param {D1} db @param {string} id @param {number} [limit] */
export async function tagChildren(db,id,limit=60){
 const rows=await all(db,`${SCOPE_CTE} SELECT DISTINCT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')},MIN(scope.depth) AS depth FROM scope JOIN entities e ON e.id=scope.id WHERE scope.id<>? AND e.status='active' GROUP BY e.id ORDER BY depth,e.type,e.slug LIMIT ?`,[id,id,limit]);
 return rows.map(r=>entityRow(r));
}
/** The tags (in the writer's order) of many posts. @param {D1} db @param {string[]} ids @returns {Promise<Map<string,Entity[]>>} */
export async function tagsOf(db,ids){
 const rows=await inChunks(db,ids,ph=>`SELECT t.discussion_id,t.pos,${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM discussion_tags t JOIN entities e ON e.id=t.entity_id WHERE e.status='active' AND t.discussion_id IN (${ph}) ORDER BY t.pos`);
 /** @type {Map<string,Entity[]>} */const out=new Map();
 for(const r of rows){const l=out.get(String(r.discussion_id))||[];l.push(entityRow(r));out.set(String(r.discussion_id),l);}
 return out;
}
/** @template {{id:string,tags:Entity[]}} P @param {D1} db @param {P[]} posts @returns {Promise<P[]>} */
async function withTags(db,posts){
 if(!posts.length)return posts;
 const t=await tagsOf(db,posts.map(p=>p.id));
 for(const p of posts)p.tags=t.get(p.id)||[];
 return posts;
}
/**
 * One page of a board: a channel (/{l}/community/{ch}/), a tag across channels (an entity page), or both
 * (a channel filtered by a tag). A tag includes its parts unless `children` is false.
 * `fold` hides the Radar bot's 소식 and the 공지 (the board shows them folded in their own rows).
 * `facet` filters by a fact of the tagged entities (the 게임 channel's platform and genre filter).
 * @param {D1} db
 * @param {{channel?:string|null,tag?:string|null,children?:boolean,kind?:string|null,sort?:string,best?:boolean,limit?:number,page?:number,now?:number,fold?:boolean,facet?:{property:string,value:string}|null}} o
 */
export async function boardPosts(db,o){
 const limit=Math.min(o.limit??30,100),offset=Math.max(0,((o.page??1)-1)*limit);
 const where=["d.status IN ('published','locked')"],params=[];
 let cte='',cteParams=/** @type {any[]} */([]);
 if(o.tag&&o.children!==false){cte=SCOPE_CTE;cteParams=[o.tag];where.push('d.id IN (SELECT t.discussion_id FROM discussion_tags t WHERE t.entity_id IN (SELECT id FROM scope))');}
 else if(o.tag){where.push('d.id IN (SELECT discussion_id FROM discussion_tags WHERE entity_id=?)');params.push(o.tag);}
 if(o.channel){where.push('d.channel_id=?');params.push(o.channel);}
 if(o.kind){where.push('d.flair=?');params.push(o.kind);}
 if(o.best)where.push('d.best_at IS NOT NULL');
 if(o.fold)where.push("NOT (d.flair='news' AND d.author_id LIKE 'system:%')","d.flair<>'notice'");
 if(o.facet){where.push(`d.id IN (SELECT t.discussion_id FROM discussion_tags t JOIN facts f ON f.entity_id=t.entity_id AND f.is_current=1 AND f.property=? WHERE f.value LIKE ? ESCAPE '\\')`);params.push(o.facet.property,'%'+likeEscape(JSON.stringify(o.facet.value))+'%');}
 const order=o.sort==='top'?'d.up_count DESC,d.created_at DESC':o.sort==='activity'?'d.last_activity_at DESC':o.sort==='hot'?'(d.up_count*3+d.comment_count*2+d.view_count/50.0)/((?-d.created_at)/3600000.0+2) DESC':'d.created_at DESC,d.id DESC';
 const orderParams=o.sort==='hot'?[o.now??Date.now()]:[];
 const rows=await all(db,`${cte} SELECT ${POST_COLS} FROM discussions d JOIN users u ON u.id=d.author_id LEFT JOIN user_profiles p ON p.user_id=d.author_id
  WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,[...cteParams,...params,...orderParams,limit+1,offset]);
 return {posts:await withTags(db,rows.slice(0,limit).map(postRow)),more:rows.length>limit};
}
/** A post by its channel number (published or locked). @param {D1} db @param {string} channel @param {number} no */
export async function postByChannelNo(db,channel,no){
 const r=await db.prepare(`SELECT ${POST_COLS},d.body_md FROM discussions d JOIN users u ON u.id=d.author_id LEFT JOIN user_profiles p ON p.user_id=d.author_id
  WHERE d.channel_id=? AND d.channel_no=? AND d.status IN ('published','locked')`).bind(channel,no).first();
 if(!r)return null;
 const [post]=await withTags(db,[{...postRow(r),body_md:String(r.body_md)}]);
 return post;
}
/** Where an old per-entity post number (/{l}/{vertical}/{slug}/{no}) lives now. @param {D1} db @param {string} entityId @param {number} no */
export async function legacyPost(db,entityId,no){
 const r=await db.prepare('SELECT d.channel_id,d.channel_no FROM legacy_posts l JOIN discussions d ON d.id=l.discussion_id WHERE l.entity_id=? AND l.post_no=?').bind(entityId,no).first();
 return r?{channel:String(r.channel_id),no:Number(r.channel_no)}:null;
}
/** A channel's 공지, newest first (the board shows the first and folds the rest). @param {D1} db @param {string} channel @param {number} [limit] */
export async function noticesOf(db,channel,limit=5){
 return withTags(db,(await all(db,`SELECT ${POST_COLS} FROM discussions d JOIN users u ON u.id=d.author_id LEFT JOIN user_profiles p ON p.user_id=d.author_id
  WHERE d.channel_id=? AND d.flair='notice' AND d.status IN ('published','locked') ORDER BY d.pinned DESC,d.created_at DESC LIMIT ?`,[channel,limit])).map(postRow));
}
/** The Radar bot's 소식 in a channel since a time: how many, and the newest title (folded into one row). @param {D1} db @param {string} channel @param {number} since */
export async function botNews(db,channel,since){
 const r=await db.prepare(`SELECT COUNT(*) AS n,(SELECT title FROM discussions WHERE channel_id=?1 AND flair='news' AND author_id LIKE 'system:%' AND status='published' AND created_at>=?2 ORDER BY created_at DESC LIMIT 1) AS title
  FROM discussions WHERE channel_id=?1 AND flair='news' AND author_id LIKE 'system:%' AND status='published' AND created_at>=?2`).bind(channel,since).first();
 return {count:Number(r?.n||0),title:r?.title?String(r.title):null};
}
/** Today's and all posts of a channel, and how many tags it has. @param {D1} db @param {string} channel @param {number} dayStart */
export async function channelCounts(db,channel,dayStart){
 const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM discussions WHERE channel_id=?1 AND status='published' AND created_at>=?2) AS today,(SELECT COUNT(*) FROM discussions WHERE channel_id=?1 AND status='published') AS total`).bind(channel,dayStart).first();
 return {today:Number(r?.today||0),total:Number(r?.total||0)};
}
/** Tags used most in a channel (or everywhere) since a time: the channel's tag chips. @param {D1} db @param {{channel?:string|null,since:number,limit?:number}} o */
export async function popularTags(db,o){
 const rows=await all(db,`SELECT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')},COUNT(*) AS n FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id JOIN entities e ON e.id=t.entity_id
  WHERE d.status='published' AND e.status='active' AND d.created_at>=?${o.channel?' AND d.channel_id=?':''} GROUP BY e.id ORDER BY n DESC LIMIT ?`,[o.since,...(o.channel?[o.channel]:[]),o.limit??12]);
 return rows.map(r=>({entity:entityRow(r),posts:Number(r.n)}));
}
/** Values of a list fact over one entity type, most common first (the 게임 channel's platform and genre
 * filter comes from the games' own facts). @param {D1} db @param {string} type @param {string} property @param {number} [limit] */
export async function factValues(db,type,property,limit=12){
 const rows=await all(db,`SELECT f.value FROM facts f JOIN entities e ON e.id=f.entity_id WHERE e.type=? AND e.status='active' AND f.property=? AND f.is_current=1`,[type,property]);
 /** @type {Map<string,number>} */const n=new Map();
 for(const r of rows){const v=json(r.value,null);for(const x of Array.isArray(v)?v:v===null?[]:[v])if(typeof x==='string')n.set(x,(n.get(x)||0)+1);}
 return [...n.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([value,count])=>({value,count}));
}
/** Oldest first; the renderer threads replies under their parents. @param {D1} db @param {string} discussionId */
export async function commentsOf(db,discussionId){
 const rows=await all(db,`SELECT c.id,c.parent_id,c.author_id,c.body_md,c.status,c.up_count,c.down_count,c.created_at,c.edited_at,COALESCE(c.anon_name,p.display_name,'user-'||lower(substr(u.id,1,6))) AS author_name,COALESCE(p.tier,'new') AS author_tier,c.anon_id
  FROM comments c JOIN users u ON u.id=c.author_id LEFT JOIN user_profiles p ON p.user_id=c.author_id WHERE c.discussion_id=? AND c.status<>'hidden' ORDER BY c.created_at,c.id`,[discussionId]);
 return rows.map(r=>({id:String(r.id),parent_id:r.parent_id??null,author_id:String(r.author_id),author_name:r.author_name??null,author_tier:String(r.author_tier),anon_id:r.anon_id==null?null:String(r.anon_id),anon:r.anon_id!=null,body_md:String(r.body_md),deleted:r.status==='deleted',up:Number(r.up_count),down:Number(r.down_count),created_at:Number(r.created_at),edited_at:r.edited_at??null}));
}
/** Structured report linked to a post (the facts table on a report post). @param {D1} db @param {string} id */
export async function reportById(db,id){
 const r=await db.prepare(`SELECT id,kind,entity_id,subject_version,target_id,target_version,env,result,metrics FROM community_reports WHERE id=? AND status='published'`).bind(id).first();
 return r?{...r,env:json(r.env,{}),metrics:json(r.metrics,{})}:null;
}
/** Followers of a tag and its posts (today and all, in every channel). dayStart = start of the reader's
 * day (ms). @param {D1} db @param {string} id @param {number} dayStart */
export async function channelStats(db,id,dayStart){
 const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM follows WHERE entity_id=?1) AS followers,(SELECT COUNT(*) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=?1 AND d.status='published' AND d.created_at>=?2) AS today,(SELECT COUNT(*) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=?1 AND d.status='published') AS total`).bind(id,dayStart).first();
 return {followers:Number(r?.followers||0),today:Number(r?.today||0),total:Number(r?.total||0)};
}
/** Titles of a tag's (or a channel's) recent posts (for "지금 많이 말하는 것").
 * @param {D1} db @param {{tag?:string,channel?:string}|string} scope @param {number} since */
export async function recentTitles(db,scope,since){
 const s=typeof scope==='string'?{tag:scope}:scope;
 // People's own titles only: generated ones (report posts, Radar bot news) would dominate the terms.
 return (await all(db,`SELECT d.title,d.up_count,d.comment_count FROM discussions d WHERE ${s.tag?'d.id IN (SELECT discussion_id FROM discussion_tags WHERE entity_id=?)':'d.channel_id=?'} AND d.status='published' AND d.created_at>=? AND d.report_id IS NULL AND d.author_id NOT LIKE 'system:%' ORDER BY d.created_at DESC LIMIT 300`,[s.tag||s.channel,since])).map(r=>({title:String(r.title),weight:1+Number(r.comment_count)/5+Number(r.up_count)/5}));
}
const XPOST=`SELECT ${POST_COLS},e.id AS e_id,e.vertical AS e_vertical,e.type AS e_type,e.slug AS e_slug,e.names AS e_names FROM discussions d JOIN users u ON u.id=d.author_id LEFT JOIN user_profiles p ON p.user_id=d.author_id LEFT JOIN entities e ON e.id=d.entity_id AND e.status='active'`;
/** Cross-channel lists for the community front and 전체 베스트. @param {D1} db
 * @param {{mode:'best'|'news'|'kind',kind?:string,channel?:string|null,since?:number,limit?:number,unanswered?:boolean}} o */
export async function frontPosts(db,o){
 const where=["d.status='published'"],params=[];
 if(o.channel){where.push('d.channel_id=?');params.push(o.channel);}
 if(o.since!==undefined){where.push('d.created_at>=?');params.push(o.since);}
 if(o.mode==='best')where.push('d.best_at IS NOT NULL');
 if(o.mode==='news')where.push("d.flair='news'","d.author_id LIKE 'system:%'");
 if(o.mode==='kind'&&o.kind){where.push('d.flair=?');params.push(o.kind);}
 if(o.unanswered)where.push('d.solved_comment_id IS NULL','d.comment_count=0');   // nobody has replied yet
 const order=o.mode==='best'?'d.up_count DESC,d.best_at DESC':'d.created_at DESC';
 return withTags(db,(await all(db,`${XPOST} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`,[...params,o.limit??15])).map(postRow));
}
/** Tags with the most posts since a time (인기 태그). @param {D1} db @param {number} since @param {number} [limit] */
export async function activeChannels(db,since,limit=10){
 return (await popularTags(db,{since,limit})).map(r=>({entity:r.entity,posts:r.posts}));
}
/** Recent Radar changes across the site (for the front when no bot posts exist yet). @param {D1} db @param {{limit?:number,minImportance?:number}} [o] */
export async function radarChanges(db,o={}){
 const rows=await all(db,`SELECT c.id,c.entity_id,c.vertical,c.kind,c.property,c.scope,c.old_value,c.new_value,c.summary,c.importance,c.effective_at,c.detected_at,${ENTITY_COLS.split(',').map(x=>'e.'+x+' AS e_'+x).join(',')} FROM changes c JOIN entities e ON e.id=c.entity_id
  WHERE c.visibility='public' AND c.importance>=? AND e.status='active' ORDER BY c.id DESC LIMIT ?`,[o.minImportance??2,o.limit??10]);
 return rows.map(r=>({id:Number(r.id),entity_id:String(r.entity_id),vertical:String(r.vertical),kind:String(r.kind),property:r.property??null,scope:r.scope,old_value:r.old_value??null,new_value:r.new_value??null,summary:r.summary??null,importance:Number(r.importance),effective_at:Number(r.effective_at),detected_at:Number(r.detected_at),
  entity:entityRow({id:r.e_id,vertical:r.e_vertical,type:r.e_type,slug:r.e_slug,names:r.e_names,descriptions:r.e_descriptions,official_urls:r.e_official_urls,image_url:r.e_image_url,status:r.e_status,updated_at:r.e_updated_at})}));
}

/* ---------- panel lookups ---------- */

/** Open-weight models with a parameter count (for the GPU "local AI" estimate). @param {D1} db */
export async function openModels(db){
 const rows=await all(db,`SELECT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')},p.value AS params FROM entities e
  JOIN facts p ON p.entity_id=e.id AND p.property='parameters_b' AND p.is_current=1
  JOIN facts o ON o.entity_id=e.id AND o.property='open_weights' AND o.is_current=1 AND o.value='true'
  WHERE e.type='model' AND e.status='active'`);
 return rows.map(r=>({entity:entityRow(r),paramsB:Number(json(r.params,0))})).filter(r=>r.paramsB>0);
}
/** Entities of a type whose current fact equals a value (e.g. GPUs with 12 GB). @param {D1} db @param {string} type @param {string} property @param {unknown} value @param {number} [limit] */
export async function entitiesWithFact(db,type,property,value,limit=6){
 const rows=await all(db,`SELECT DISTINCT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM entities e JOIN facts f ON f.entity_id=e.id AND f.is_current=1 AND f.property=? AND f.value=?
  WHERE e.type=? AND e.status='active' ORDER BY e.updated_at DESC LIMIT ?`,[property,JSON.stringify(value),type,limit]);
 return rows.map(entityRow);
}

/* ---------- history and status ---------- */

/** Everything recorded about an entity, newest first, with the source it came from (SteamDB-style
 * history). Seed rows (importance 0) are included: history pages show all, the Radar does not.
 * @param {D1} db @param {string} id @param {{limit?:number,before?:number}} [o] */
export async function historyOf(db,id,o={}){
 const rows=await all(db,`SELECT c.id,c.entity_id,c.vertical,c.kind,c.property,c.scope,c.old_value,c.new_value,c.summary,c.importance,c.effective_at,c.detected_at,s.url AS source_url,s.title AS source_title,s.kind AS source_kind
  FROM changes c LEFT JOIN sources s ON s.id=c.source_id WHERE c.entity_id=? AND c.visibility='public' AND c.kind<>'entity_added'${o.before?' AND c.id<?':''} ORDER BY c.effective_at DESC,c.id DESC LIMIT ?`,[id,...(o.before?[o.before]:[]),o.limit??100]);
 return rows.map(r=>({...r,id:Number(r.id),importance:Number(r.importance),effective_at:Number(r.effective_at),detected_at:Number(r.detected_at)}));
}
/** Issue reports (user outage/problem clicks) per hour since `since`. @param {D1} db @param {string[]} ids @param {number} since */
export async function issueReportsSince(db,ids,since){
 const rows=await inChunks(db,ids,ph=>`SELECT entity_id,created_at,env FROM community_reports WHERE kind='issue' AND status='published' AND created_at>=? AND entity_id IN (${ph})`,[since]);
 return rows.map(r=>({entity_id:String(r.entity_id),created_at:Number(r.created_at),env:json(r.env,{})}));
}

/* ---------- search and radar ---------- */

const likeEscape=(/** @type {string} */ s)=>s.replace(/[\\%_]/g,c=>'\\'+c);
/**
 * Channels matching a query: exact/prefix alias match first (short queries, model numbers like
 * "5070"), then the FTS5 trigram index (3+ characters, works for Korean without a morphological
 * analyzer). @param {D1} db @param {string} q @param {{vertical?:string|null,limit?:number}} [o]
 */
export async function searchEntities(db,q,o={}){
 const limit=o.limit??20,tokens=searchTokens(q),whole=tokens.join('');
 if(!whole)return [];
 /** @type {Map<string,number>} */const score=new Map();
 /** @type {Map<string,Set<number>>} */const hits=new Map();
 const add=(/** @type {string} */ id,/** @type {number} */ s,/** @type {number} */ t)=>{score.set(id,Math.max(score.get(id)||0,s));if(t>=0){let h=hits.get(id);if(!h)hits.set(id,h=new Set());h.add(t);}};
 /** Alias prefix (an index range: LIKE cannot use the BINARY index on norm) plus the trigram index. */
 const match=async(/** @type {string} */ norm,/** @type {string} */ phrase,/** @type {number} */ w,/** @type {number} */ t)=>{
  const [prefix,fts]=await Promise.all([all(db,`SELECT entity_id,norm FROM entity_aliases WHERE norm>=? AND norm<? LIMIT 60`,[norm,norm+'\u{10FFFF}']),
   [...phrase].length>=3?all(db,`SELECT doc_key FROM search_docs WHERE search_docs MATCH ? ORDER BY bm25(search_docs,0,0,0,0,10,1) LIMIT 60`,['"'+phrase.replace(/"/g,'""')+'"']).catch(()=>[]):Promise.resolve([])]);
  for(const r of prefix)add(String(r.entity_id),w*(r.norm===norm?100:60-Math.min(40,String(r.norm).length-norm.length)),t);
  for(const [i,r] of fts.entries()){const k=String(r.doc_key);if(k.startsWith('entity:'))add(k.slice(7),w*(40-Math.min(39,i*0.5)),t);}
 };
 // The whole query, and with several words each word on its own too ("5070 4070" → both cards,
 // "caves qud" → Caves of Qud); a channel that matches more of the words ranks higher. In parallel.
 await Promise.all([match(whole,String(q).trim(),1,-1),...(tokens.length>1?[...tokens.entries()].filter(([,w])=>[...w].length>=2).map(([t,w])=>match(w,w,0.6,t)):[])]);
 for(const [id,h] of hits)if(h.size>1)score.set(id,(score.get(id)||0)+15*(h.size-1));
 // A Korean patch's name is often the only Korean name of its game ("테라리아 한글패치"): the game
 // itself ranks just above its patch.
 const ids=[...score.keys()];
 for(const r of await inChunks(db,ids.filter(id=>id.startsWith('translation_patch:')),ph=>`SELECT subject_id,object_id FROM relations WHERE predicate='translates' AND subject_id IN (${ph})`))
  add(String(r.object_id),(score.get(String(r.subject_id))||0)+1,-1);
 const ents=await entitiesByIds(db,[...score.keys()]);
 // Among similar matches, the channels people mean first: a service or game over its models, plans
 // and goods ("GPT" → ChatGPT before twenty GPT models).
 const rank=(/** @type {Entity} */ e)=>(score.get(e.id)||0)+(TYPE_BOOST[e.type]||0);
 return [...ents.values()].filter(e=>!o.vertical||e.vertical===o.vertical).sort((a,b)=>rank(b)-rank(a)).slice(0,limit);
}
const TYPE_BOOST=/** @type {Record<string,number>} */({service:12,provider:8,game:8,gpu:6,app:6,work:6,franchise:6,plan:4,model:0});
/** Search words: NFKC, lower case, punctuation dropped, at most 6. @param {string} q */
export function searchTokens(q){
 return String(q).normalize('NFKC').toLowerCase().split(/\s+/).map(t=>t.replace(/[\p{P}\p{S}]+/gu,'')).filter(Boolean).slice(0,6);
}
/** Posts whose title contains every word of the query (optionally inside one channel), newest first.
 * @param {D1} db @param {string} q @param {{entityId?:string|null,limit?:number}} [o] */
export async function searchPosts(db,q,o={}){
 const words=String(q).trim().split(/\s+/).filter(Boolean).slice(0,6);if(!words.length)return [];
 const where=["d.status='published'"],params=[];
 for(const w of words){where.push("d.title LIKE ? ESCAPE '\\'");params.push('%'+likeEscape(w)+'%');}
 if(o.entityId){where.push('d.id IN (SELECT discussion_id FROM discussion_tags WHERE entity_id=?)');params.push(o.entityId);}
 return withTags(db,(await all(db,`${XPOST} WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT ?`,[...params,o.limit??30])).map(postRow));
}
/** Channels an item belongs to, two relation hops out (goods → character → work), for the Radar's
 * "내 구독만" filter. @param {D1} db @param {string[]} ids @returns {Promise<Map<string,Set<string>>>} */
export async function channelsAround(db,ids){
 /** @type {Map<string,Set<string>>} */const out=new Map(ids.map(id=>[id,new Set([id])]));
 let frontier=new Map(ids.map(id=>[id,[id]]));
 for(let hop=0;hop<2;hop++){
  const all_=[...new Set([...frontier.values()].flat())];if(!all_.length)break;
  const rows=await inChunks(db,all_,ph=>`SELECT subject_id,object_id FROM relations WHERE valid_until IS NULL AND subject_id IN (${ph})`);
  /** @type {Map<string,string[]>} */const next=new Map();
  for(const [root,list] of frontier){const nx=[];for(const r of rows)if(list.includes(String(r.subject_id))){const o=String(r.object_id);if(!out.get(root)?.has(o)){out.get(root)?.add(o);nx.push(o);}}next.set(root,nx);}
  frontier=next;
 }
 return out;
}
/** The other spelling people search for: for a non-Korean name the first Hangul alias ("Claude" →
 * "클로드"), for a Korean name the original ("에이블톤 라이브" → "Ableton Live"); or null.
 * @param {D1} db @param {string} id @param {string} name */
export async function koAlias(db,id,name){
 // A Korean name gets its original name alongside ("에이블톤 라이브" → "Ableton Live").
 if(/[가-힣]/.test(name)){const r=await db.prepare('SELECT names FROM entities WHERE id=?').bind(id).first();const en=json(r?.names,{}).en;return en&&en!==name&&!/[가-힣]/.test(en)?String(en):null;}
 const rows=await all(db,`SELECT alias FROM entity_aliases WHERE entity_id=? AND kind='alias'`,[id]);
 const a=rows.map(r=>String(r.alias)).find(x=>/[가-힣]/.test(x)&&x!==name);
 return a||null;
}
/** The latest KRW per USD reference rate (tools/platform/fx.mjs), if fetched in the last 10 days.
 * @param {D1} db @param {number} now @returns {Promise<{rate:number,asOf:string}|null>} */
export async function fxUsdKrw(db,now){
 try{const r=await db.prepare("SELECT rate,as_of,fetched_at FROM fx_rates WHERE base='USD' AND quote='KRW'").first();
  return r&&now-Number(r.fetched_at)<=10*864e5?{rate:Number(r.rate),asOf:String(r.as_of)}:null;}catch{return null;}
}
/** Versions released recently across all channels (Radar). @param {D1} db @param {{since:number,until:number,vertical?:string|null,limit?:number}} o */
export async function recentVersions(db,o){
 const rows=await all(db,`SELECT v.version,v.released_at,v.notes_url,v.verification,${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM versions v JOIN entities e ON e.id=v.entity_id
  WHERE v.released_at BETWEEN ? AND ? AND e.status='active'${o.vertical?' AND e.vertical=?':''} ORDER BY v.released_at DESC LIMIT ?`,[o.since,o.until,...(o.vertical?[o.vertical]:[]),o.limit??40]);
 return rows.map(r=>({version:String(r.version),released_at:Number(r.released_at),notes_url:r.notes_url??null,verification:String(r.verification),entity:entityRow(r)}));
}
/** Upcoming events across all channels with the first linked entity (Radar). @param {D1} db @param {{from:number,to:number,vertical?:string|null,limit?:number}} o */
export async function upcomingEvents(db,o){
 const rows=await all(db,`SELECT ev.id,ev.kind,ev.title,ev.starts_at,ev.date_precision,ev.url,ev.verification,MIN(x.entity_id) AS eid,GROUP_CONCAT(x.entity_id) AS eids FROM events ev JOIN event_entities x ON x.event_id=ev.id JOIN entities e ON e.id=x.entity_id
  WHERE ev.starts_at BETWEEN ? AND ? AND ev.status NOT IN ('cancelled','ended') AND e.status='active'${o.vertical?' AND e.vertical=?':''} GROUP BY ev.id ORDER BY ev.starts_at LIMIT ?`,[o.from,o.to,...(o.vertical?[o.vertical]:[]),o.limit??40]);
 const ents=await entitiesByIds(db,rows.map(r=>String(r.eid)));
 return rows.map(r=>({id:Number(r.id),kind:String(r.kind),title:json(r.title,{}),starts_at:Number(r.starts_at),precision:String(r.date_precision),url:r.url??null,verification:String(r.verification),entity:ents.get(String(r.eid))||null,about:String(r.eids||'').split(',').filter(Boolean)})).filter(r=>r.entity);
}

/* ---------- SEO ---------- */

/** Content counts of one entity for the content gate (platform/seo.js). @param {D1} db @param {string} id */
export async function contentCounts(db,id){
 const r=await db.prepare(`SELECT (SELECT COUNT(*) FROM facts WHERE entity_id=?1 AND is_current=1) AS facts,(SELECT COUNT(*) FROM relations WHERE subject_id=?1 AND valid_until IS NULL)+(SELECT COUNT(*) FROM relations WHERE object_id=?1 AND valid_until IS NULL) AS relations,
  (SELECT COUNT(*) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=?1 AND d.status='published') AS posts`).bind(id).first();
 return {facts:Number(r?.facts||0),relations:Number(r?.relations||0),posts:Number(r?.posts||0)};
}
/** Every active entity of a vertical with its content counts and last change (entity sitemaps). @param {D1} db @param {string} vertical */
export async function sitemapEntities(db,vertical){
 const rows=await all(db,`SELECT e.id,e.vertical,e.type,e.slug,e.names,e.descriptions,e.index_state,e.updated_at,
  (SELECT COUNT(*) FROM facts f WHERE f.entity_id=e.id AND f.is_current=1) AS facts,
  (SELECT COUNT(*) FROM relations r WHERE r.subject_id=e.id AND r.valid_until IS NULL)+(SELECT COUNT(*) FROM relations r WHERE r.object_id=e.id AND r.valid_until IS NULL) AS relations,
  (SELECT COUNT(*) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=e.id AND d.status='published') AS posts,
  (SELECT MAX(d.last_activity_at) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=e.id AND d.status='published') AS active_at
  FROM entities e WHERE e.vertical=? AND e.status='active' ORDER BY e.id LIMIT 20000`,[vertical]);
 return rows.map(r=>({id:String(r.id),vertical:String(r.vertical),type:String(r.type),slug:String(r.slug),names:json(r.names,{}),descriptions:json(r.descriptions,{}),index_state:String(r.index_state||'auto'),
  lastmod:Math.max(Number(r.updated_at)||0,Number(r.active_at)||0),facts:Number(r.facts),relations:Number(r.relations),posts:Number(r.posts)}));
}

/** Every row (current and closed) of some properties of an entity, oldest first: price history.
 * @param {D1} db @param {string} id @param {string[]} props */
export async function factHistory(db,id,props){
 const rows=await all(db,`SELECT property,value,unit,region,plan,verification,valid_from,valid_until,is_current,source_id FROM facts WHERE entity_id=? AND property IN (${qs(props.length)}) ORDER BY valid_from,id`,[id,...props]);
 return rows.map(r=>({property:String(r.property),value:json(r.value,null),unit:r.unit??null,region:String(r.region),plan:String(r.plan),verification:String(r.verification),valid_from:Number(r.valid_from),valid_until:r.valid_until===null?null:Number(r.valid_until),current:!!r.is_current}));
}

/** Channels of a vertical for its hub page, most active first, then by name; with post counts.
 * @param {D1} db @param {string} vertical @param {{type?:string|null,limit?:number,offset?:number}} [o] */
export async function hubEntities(db,vertical,o={}){
 const rows=await all(db,`SELECT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')},(SELECT COUNT(*) FROM discussion_tags t JOIN discussions d ON d.id=t.discussion_id WHERE t.entity_id=e.id AND d.status='published') AS posts,(SELECT COUNT(*) FROM follows f WHERE f.entity_id=e.id) AS followers
  FROM entities e WHERE e.vertical=? AND e.status='active'${o.type?' AND e.type=?':''} ORDER BY posts DESC,followers DESC,e.updated_at DESC LIMIT ? OFFSET ?`,[vertical,...(o.type?[o.type]:[]),o.limit??60,o.offset??0]);
 return rows.map(r=>({entity:entityRow(r),posts:Number(r.posts),followers:Number(r.followers)}));
}
/** Entity counts per type of a vertical. @param {D1} db @param {string} vertical */
export async function typeCounts(db,vertical){
 return Object.fromEntries((await all(db,"SELECT type,COUNT(*) AS n FROM entities WHERE vertical=? AND status='active' GROUP BY type",[vertical])).map(r=>[String(r.type),Number(r.n)]));
}

/** Korean patches a game update has left unconfirmed: the game's newest version has no
 * compatibility row for the patch, while an older version was reported working (games hub).
 * @param {D1} db @param {number} [limit] */
export async function stalePatches(db,limit=12){
 const rows=await all(db,`WITH latest AS (SELECT entity_id,version,MAX(COALESCE(released_at,detected_at)) AS at FROM versions GROUP BY entity_id)
  SELECT p.id AS pid,p.vertical AS pv,p.slug AS pslug,p.names AS pnames,g.id AS gid,g.vertical AS gv,g.slug AS gslug,g.names AS gnames,latest.version AS current,latest.at AS updated_at,
   (SELECT c2.target_version FROM compatibility c2 WHERE c2.subject_id=p.id AND c2.target_id=g.id AND c2.is_current=1 AND c2.status IN ('works','works_with_issues','supported') AND c2.target_version<>'*' ORDER BY c2.updated_at DESC LIMIT 1) AS last_ok
  FROM relations r JOIN entities p ON p.id=r.subject_id JOIN entities g ON g.id=r.object_id JOIN latest ON latest.entity_id=g.id
  WHERE r.predicate='translates' AND p.status='active' AND g.status='active'
   AND NOT EXISTS (SELECT 1 FROM compatibility c WHERE c.subject_id=p.id AND c.target_id=g.id AND c.is_current=1 AND c.target_version=latest.version)
  ORDER BY latest.at DESC LIMIT ?`,[limit*3]);
 // Only when the game really moved past the confirmed version ("v0.14.7" vs "0.14.5" is not an update).
 return rows.filter(r=>r.last_ok&&versionCompare(String(r.current),String(r.last_ok))>0).slice(0,limit).map(r=>({patch:entityRow({id:r.pid,vertical:r.pv,type:'translation_patch',slug:r.pslug,names:r.pnames,descriptions:'{}',official_urls:'[]',status:'active',updated_at:0}),
  game:entityRow({id:r.gid,vertical:r.gv,type:'game',slug:r.gslug,names:r.gnames,descriptions:'{}',official_urls:'[]',status:'active',updated_at:0}),current:String(r.current),lastOk:String(r.last_ok),updatedAt:Number(r.updated_at)}));
}
/** Pre-orders closing soonest (subculture hub). @param {D1} db @param {number} now @param {number} [limit] */
export async function preorderDeadlines(db,now,limit=8){
 const today=new Date(now).toISOString().slice(0,10);
 const rows=await all(db,`SELECT ${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')},json_extract(f.value,'$') AS ends FROM facts f JOIN entities e ON e.id=f.entity_id
  WHERE f.property='preorder_end' AND f.is_current=1 AND e.status='active' AND json_extract(f.value,'$')>=? ORDER BY ends LIMIT ?`,[today,limit]);
 // What the goods are of (a character or a work), so an English product name still says whose it is.
 const of=await relatedMany(db,rows.map(r=>String(r.id)),'merchandise_of');
 const chars=[...of.values()].map(l=>l[0]).filter(e=>e&&e.type==='character').map(e=>e.id);
 const work=chars.length?await relatedMany(db,chars,'appears_in'):new Map();
 return rows.map(r=>{const o=of.get(String(r.id))?.[0]||null;return {entity:entityRow(r),ends:String(r.ends),of:o,work:o&&o.type==='character'?work.get(o.id)?.[0]||null:null};});
}

/** Compare version strings numerically part by part ("v1.4.10" > "1.4.9"); non-numeric parts as text. @param {string} a @param {string} b */
export function versionCompare(a,b){
 const norm=(/** @type {string} */ s)=>s.trim().replace(/^v(?=\d)/i,'').split(/[.\-_+ ]+/);
 const x=norm(a),y=norm(b);
 for(let i=0;i<Math.max(x.length,y.length);i++){
  const p=x[i]??'0',q=y[i]??'0',np=/^\d+$/.test(p),nq=/^\d+$/.test(q);
  const c=np&&nq?Number(p)-Number(q):p.localeCompare(q);
  if(c)return c>0?1:-1;
 }
 return 0;
}
/** Inverse of relatedMany: for each object id, the subjects pointing at it (e.g. the service that
 * has_plan a plan). @param {D1} db @param {string[]} ids @param {string} predicate */
export async function relatedManyIn(db,ids,predicate){
 const rows=await inChunks(db,ids,ph=>`SELECT r.object_id AS to_id,${ENTITY_COLS.split(',').map(c=>'e.'+c).join(',')} FROM relations r JOIN entities e ON e.id=r.subject_id
  WHERE r.predicate=? AND r.valid_until IS NULL AND e.status='active' AND r.object_id IN (${ph})`,[predicate]);
 /** @type {Map<string,Entity[]>} */const out=new Map();
 for(const r of rows){const l=out.get(r.to_id)||[];l.push(entityRow(r));out.set(r.to_id,l);}
 return out;
}
/** Channels linked to this one by any relation, both directions, with the predicate (sidebar
 * "관련 채널"). @param {D1} db @param {string} id @param {number} [limit] */
export async function relatedChannels(db,id,limit=8){
 const cols=ENTITY_COLS.split(',').map(c=>'e.'+c).join(',');
 const rows=await all(db,`SELECT * FROM (SELECT r.predicate,'out' AS dir,${cols} FROM relations r JOIN entities e ON e.id=r.object_id WHERE r.subject_id=? AND r.valid_until IS NULL AND e.status='active'
  UNION ALL SELECT r.predicate,'in' AS dir,${cols} FROM relations r JOIN entities e ON e.id=r.subject_id WHERE r.object_id=? AND r.valid_until IS NULL AND e.status='active') LIMIT ?`,[id,id,limit*4]);
 const seen=new Set();
 return rows.filter(r=>seen.has(r.id)?false:(seen.add(r.id),true)).slice(0,limit).map(r=>({predicate:String(r.predicate),dir:/** @type {'in'|'out'} */(r.dir),entity:entityRow(r)}));
}
