// @ts-check
/** Community rules shared by the API, the renderers and tests: post kinds (말머리), the ★ best
 * (념글) rule, contributor tiers, the compatibility verification score and rollout aggregation.
 * Pure functions first; the few DB helpers at the bottom use the D1 binding API. */

/** 말머리. `verticals` limits a kind to some channels (e.g. translation patches → games). */
export const POST_KINDS=Object.freeze({
 notice:{ko:'공지',en:'Notice',staff:true},
 news:{ko:'소식',en:'News'},
 report:{ko:'리포트',en:'Report'},
 patch:{ko:'한글패치',en:'Korean patch',verticals:['games']},
 question:{ko:'질문',en:'Question'},
 guide:{ko:'공략',en:'Guide'},
 benchmark:{ko:'벤치',en:'Benchmark',verticals:['hardware','ai']},
 screenshot:{ko:'스샷',en:'Screenshot'},
 free:{ko:'자유',en:'Talk'},
});
/** Kinds a member may pick when writing in a channel of this vertical. @param {string} vertical */
export function writableKinds(vertical){
 return Object.entries(POST_KINDS).filter(([,k])=>!('staff' in k)&&(!('verticals' in k)||/** @type {string[]} */(k.verticals).includes(vertical))).map(([id])=>id).filter(id=>id!=='news');
}

/** Input limits shared by the write API and the write form. */
export const LIMITS=Object.freeze({title:/** @type {[number,number]} */([2,120]),body:/** @type {[number,number]} */([1,20000]),comment:/** @type {[number,number]} */([1,4000]),nickname:/** @type {[number,number]} */([2,20]),version:40,postsPerMinute:3,commentsPerMinute:10,votesPerMinute:60});

/** ★ best (념글): shown openly in the UI so it is never a black box. */
export const BEST_RULE=Object.freeze({minUp:10,minRatio:0.7,windowMs:24*3600e3,floor:5,cap:100,sampleDays:7});
/**
 * The channel's ★ threshold follows its activity (as DC minor galleries do, capped at 100): the
 * upvotes of the top 10 % of its posts in the last 7 days, never below 5 — a quiet channel still
 * gets 념글, a busy one does not flood them. With fewer than 20 recent posts the default (10) holds.
 * @param {number[]} recentUps upvote counts of the channel's posts in the sample window
 */
export function bestThreshold(recentUps){
 if(recentUps.length<20)return BEST_RULE.minUp;
 const s=[...recentUps].sort((a,b)=>a-b),p90=s[Math.floor(s.length*0.9)];
 return Math.max(BEST_RULE.floor,Math.min(BEST_RULE.cap,p90));
}
/** @param {{up_count:number,down_count:number,created_at:number,best_at?:number|null}} p @param {number} now @param {number} [minUp] */
export function qualifiesBest(p,now,minUp=BEST_RULE.minUp){
 if(p.best_at)return true;
 const total=p.up_count+p.down_count;
 return now-p.created_at<=BEST_RULE.windowMs&&p.up_count>=minUp&&total>0&&p.up_count/total>=BEST_RULE.minRatio;
}
/** @param {any} db @param {string} entityId @param {number} now */
export async function channelBestThreshold(db,entityId,now){
 const rows=(await db.prepare("SELECT up_count FROM discussions WHERE entity_id=? AND status='published' AND created_at>=? LIMIT 2000").bind(entityId,now-BEST_RULE.sampleDays*864e5).all()).results||[];
 return bestThreshold(rows.map((/** @type {any} */ r)=>Number(r.up_count)));
}

/** Trust weight of a contributor tier in verification. */
export const TIER_WEIGHT=Object.freeze({new:0.5,contributor:1,trusted:2,maintainer:3,curator:3});
/** Tier from verified contribution only (no points). maintainer/curator are granted, never computed.
 * @param {{tier?:string,accepted_contributions:number,rejected_contributions:number,strikes:number,created_at:number}} p @param {number} now */
export function computeTier(p,now){
 if(p.tier==='maintainer'||p.tier==='curator')return p.tier;
 const ageDays=(now-p.created_at)/864e5,done=p.accepted_contributions+p.rejected_contributions;
 const accuracy=done?p.accepted_contributions/done:0;
 if(p.accepted_contributions>=25&&accuracy>=0.9&&p.strikes===0&&ageDays>=30)return 'trusted';
 if(p.accepted_contributions>=5&&accuracy>=0.7&&ageDays>=3)return 'contributor';
 return 'new';
}

/** Verification thresholds for community compatibility (docs/n2 + UI copy). */
export const VERIFY_RULE=Object.freeze({minUsers:3,minWeight:3,maxContradiction:0.2,disputeMinority:0.3,halfLifeDays:60,needContributor:true});
/**
 * Community verdict for one (subject@version, target@version, env) key.
 * Only the latest report per user counts; weight = tier weight × recency (half-life 60 days).
 * @param {{user_id:string,result:'works'|'works_with_issues'|'broken',created_at:number,tier?:string}[]} reports
 * @param {number} now
 * @returns {{status:'works'|'works_with_issues'|'broken'|'unknown',verification:'COMMUNITY_VERIFIED'|'COMMUNITY'|'DISPUTED'|'UNKNOWN',confirmations:number,contradictions:number,score:number,users:number}}
 */
export function compatVerdict(reports,now){
 /** @type {Map<string,any>} */const latest=new Map();
 for(const r of reports){const cur=latest.get(r.user_id);if(!cur||r.created_at>cur.created_at)latest.set(r.user_id,r);}
 const list=[...latest.values()];
 if(!list.length)return {status:'unknown',verification:'UNKNOWN',confirmations:0,contradictions:0,score:0,users:0};
 let pos=0,neg=0,issues=0,trustedPos=false,trustedNeg=false;
 for(const r of list){
  const w=(TIER_WEIGHT[/** @type {keyof typeof TIER_WEIGHT} */(r.tier||'new')]??0.5)*Math.pow(0.5,Math.max(0,now-r.created_at)/(VERIFY_RULE.halfLifeDays*864e5));
  const senior=r.tier&&r.tier!=='new';
  if(r.result==='broken'){neg+=w;if(senior)trustedNeg=true;}else{pos+=w;if(r.result==='works_with_issues')issues+=w;if(senior)trustedPos=true;}
 }
 const total=pos+neg,share=total?pos/total:0,users=list.length;
 const posUsers=list.filter(r=>r.result!=='broken').length,negUsers=users-posUsers;
 const majority=pos>=neg?(issues>=pos*0.4?'works_with_issues':'works'):'broken';
 const base={confirmations:majority==='broken'?negUsers:posUsers,contradictions:majority==='broken'?posUsers:negUsers,score:Math.round(total*100)/100,users};
 const minority=Math.min(share,1-share);
 if(posUsers>=1&&negUsers>=1&&minority>=VERIFY_RULE.disputeMinority)return {...base,status:majority,verification:'DISPUTED'};
 const sideUsers=majority==='broken'?negUsers:posUsers,sideWeight=majority==='broken'?neg:pos,senior=majority==='broken'?trustedNeg:trustedPos;
 if(sideUsers>=VERIFY_RULE.minUsers&&sideWeight>=VERIFY_RULE.minWeight*0.5&&minority<VERIFY_RULE.maxContradiction&&(!VERIFY_RULE.needContributor||senior))
  return {...base,status:majority,verification:'COMMUNITY_VERIFIED'};
 return {...base,status:majority,verification:'COMMUNITY'};
}
/** How many more independent confirmations the UI should ask for ("1명 더 확인하면 검증"). */
export function confirmationsNeeded(/** @type {{users:number,verification:string}} */ v){
 return v.verification==='COMMUNITY_VERIFIED'||v.verification==='DISPUTED'?0:Math.max(0,VERIFY_RULE.minUsers-v.users);
}

/** Rollout cells with fewer votes than this show counts only, never a percentage. */
export const ROLLOUT_MIN_CELL=5;
/**
 * Aggregate "I have it / not yet" votes. Votes from accounts younger than 7 days are counted
 * separately (shown in parentheses), never mixed into the headline percentage.
 * @param {{has_it:number,country:string,plan_id:string,platform:string,account_created_at:number,updated_at:number}[]} votes
 * @param {number} now
 */
export function rolloutSummary(votes,now){
 const recent=votes.filter(v=>now-v.updated_at<=60*864e5);
 const established=recent.filter(v=>now-v.account_created_at>=7*864e5),fresh=recent.length-established.length;
 const cell=(/** @type {typeof votes} */ list)=>{const n=list.length,has=list.filter(v=>v.has_it).length;return {n,has,pct:n>=ROLLOUT_MIN_CELL?Math.round(has/n*100):null};};
 const by=(/** @type {'country'|'plan_id'|'platform'} */ key)=>{
  /** @type {Record<string,any>} */const out={};
  for(const v of established)(out[v[key]]??=[]).push(v);
  return Object.fromEntries(Object.entries(out).filter(([k])=>k!=='*').map(([k,l])=>/** @type {[string,{n:number,has:number,pct:number|null}]} */([k,cell(l)])).sort((a,b)=>b[1].n-a[1].n));
 };
 /** @type {Record<string,any>} */const countryPlatform={};
 for(const v of established)if(v.country!=='*'&&v.platform!=='*')(countryPlatform[v.country]??={})[v.platform]=null;
 for(const c of Object.keys(countryPlatform))for(const p of Object.keys(countryPlatform[c]))countryPlatform[c][p]=cell(established.filter(v=>v.country===c&&v.platform===p));
 return {total:cell(established),newAccounts:fresh,country:by('country'),plan:by('plan_id'),platform:by('platform'),countryPlatform};
}

/* ---------- DB helpers (D1 binding API) ---------- */

/**
 * Create a post with the next per-channel number in one statement (no read-then-write race).
 * @param {any} db @param {{id:string,entityId:string,kind:string,title:string,body:string,locale:string,authorId:string,changeId?:number|null,reportId?:string|null,hasImage?:boolean}} p @param {number} now
 */
export async function createPost(db,p,now){
 if(!(p.kind in POST_KINDS))throw Error('unknown post kind');
 const row=await db.prepare(`INSERT INTO discussions (id,entity_id,post_no,kind,title,body_md,locale,author_id,change_id,report_id,has_image,created_at,updated_at,last_activity_at)
  SELECT ?,?,COALESCE(MAX(post_no),0)+1,?,?,?,?,?,?,?,?,?,?,? FROM discussions WHERE entity_id=? RETURNING post_no`)
  .bind(p.id,p.entityId,p.kind,p.title,p.body,p.locale,p.authorId,p.changeId??null,p.reportId??null,p.hasImage?1:0,now,now,now,p.entityId).first();
 return Number(row?.post_no);
}

/**
 * Up/down vote on a post or comment; one vote per user, changeable. Updates counters and ★ best.
 * @param {any} db @param {{kind:'discussion'|'comment',id:string,userId:string,value:1|-1|0}} v @param {number} now
 */
export async function castVote(db,v,now){
 const table=v.kind==='discussion'?'discussions':'comments';
 const stmts=[v.value===0
  ?db.prepare('DELETE FROM votes WHERE target_kind=? AND target_id=? AND user_id=?').bind(v.kind,v.id,v.userId)
  :db.prepare('INSERT INTO votes (target_kind,target_id,user_id,value,created_at) VALUES (?,?,?,?,?) ON CONFLICT(target_kind,target_id,user_id) DO UPDATE SET value=excluded.value').bind(v.kind,v.id,v.userId,v.value,now),
  db.prepare(`UPDATE ${table} SET up_count=(SELECT COUNT(*) FROM votes WHERE target_kind=? AND target_id=? AND value=1),down_count=(SELECT COUNT(*) FROM votes WHERE target_kind=? AND target_id=? AND value=-1) WHERE id=?`).bind(v.kind,v.id,v.kind,v.id,v.id)];
 await db.batch(stmts);
 const row=await db.prepare(`SELECT up_count,down_count,created_at${v.kind==='discussion'?',best_at,entity_id':''} FROM ${table} WHERE id=?`).bind(v.id).first();
 const minUp=row&&v.kind==='discussion'&&!row.best_at?await channelBestThreshold(db,String(row.entity_id),now):BEST_RULE.minUp;
 if(row&&v.kind==='discussion'&&!row.best_at&&qualifiesBest(row,now,minUp))await db.prepare('UPDATE discussions SET best_at=? WHERE id=? AND best_at IS NULL').bind(now,v.id).run();
 return row?{up:Number(row.up_count),down:Number(row.down_count),best:v.kind==='discussion'?!!(row.best_at||qualifiesBest(row,now,minUp)):false,bestThreshold:minUp}:null;
}

/**
 * Recompute community compatibility for one key from published compat reports and write the
 * current compatibility row. Official vendor rows (supported/unsupported) are never overwritten.
 * @param {any} db @param {{subject:string,subjectVersion:string,target:string,targetVersion:string,envKey:string,env?:object}} k @param {number} now
 */
export async function recomputeCompat(db,k,now){
 const reports=(await db.prepare(`SELECT r.user_id,r.result,r.created_at,COALESCE(p.tier,'new') AS tier FROM community_reports r LEFT JOIN user_profiles p ON p.user_id=r.user_id
  WHERE r.kind='compat' AND r.status='published' AND r.visibility<>'private' AND r.entity_id=? AND COALESCE(r.subject_version,'*')=? AND r.target_id=? AND COALESCE(r.target_version,'*')=?`)
  .bind(k.subject,k.subjectVersion,k.target,k.targetVersion).all()).results;
 const v=compatVerdict(reports,now);
 const cur=await db.prepare('SELECT id,status,verification FROM compatibility WHERE is_current=1 AND subject_id=? AND subject_version=? AND target_id=? AND target_version=? AND env_key=?').bind(k.subject,k.subjectVersion,k.target,k.targetVersion,k.envKey).first();
 if(cur&&cur.verification==='OFFICIAL')return {verdict:v,changed:false};
 if(v.status==='unknown')return {verdict:v,changed:false};
 if(cur&&cur.status===v.status&&cur.verification===v.verification){
  await db.prepare('UPDATE compatibility SET confirmations=?,contradictions=?,score=?,last_confirmed_at=?,updated_at=? WHERE id=?').bind(v.confirmations,v.contradictions,v.score,now,now,cur.id).run();
  return {verdict:v,changed:false};
 }
 const w=[];
 if(cur)w.push(db.prepare('UPDATE compatibility SET is_current=0,valid_until=?,updated_at=? WHERE id=?').bind(now,now,cur.id));
 w.push(db.prepare(`INSERT INTO compatibility (subject_id,subject_version,target_id,target_version,env,env_key,status,verification,confirmations,contradictions,score,last_confirmed_at,valid_from,is_current,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`)
  .bind(k.subject,k.subjectVersion,k.target,k.targetVersion,JSON.stringify(k.env||{}),k.envKey,v.status,v.verification,v.confirmations,v.contradictions,v.score,now,now,now,now));
 // Only verified/disputed transitions are Radar news; single reports stay on the channel.
 if(v.verification!=='COMMUNITY'){
  const vertical=(await db.prepare('SELECT vertical FROM entities WHERE id=?').bind(k.subject).first())?.vertical||'games';
  w.push(db.prepare(`INSERT INTO changes (entity_id,vertical,kind,scope,old_value,new_value,importance,visibility,effective_at,detected_at) VALUES (?,?,'compat_changed',?,?,?,2,'public',?,?)`)
   .bind(k.subject,vertical,JSON.stringify({target:k.target,target_version:k.targetVersion,subject_version:k.subjectVersion,verification:v.verification}),cur?JSON.stringify(cur.status):null,JSON.stringify(v.status),now,now));
 }
 await db.batch(w);
 return {verdict:v,changed:true};
}
