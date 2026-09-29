// @ts-check
/** The one ingest pipeline: seed data, collector output and admin edits all become graph writes
 * here. Given a nerulio.seed/1 document it
 *   1. upserts sources and records snapshots (provenance),
 *   2. creates/updates entities and their aliases (fields the document leaves out are kept;
 *      `names`/`description` merge per locale; `official_urls` merge per url),
 *   3. diffs every fact/availability/compatibility row against the CURRENT row of the same scope:
 *      same value → only `observed_at` moves (last verified); new/different value → old row is closed
 *      (valid_until) and kept forever, a new current row is written and a `changes` row explains it;
 *      a less-trusted value never overwrites a more-trusted one → one open `fact_conflicts` row for
 *      the admin (schema.js `supersedes`: the trust ladder plus "a newer version wins"),
 *   4. adds relations, versions and events (with Radar changes),
 *   5. runs the compatibility state machine (a new game version → UNVERIFIED_AFTER_UPDATE),
 *   6. refreshes the search index and bumps entity versions (edge-cache keys).
 * Re-ingesting the same document writes nothing (D1 bills rows written).
 *
 * The seed identity (actor 'seed', used by tools/platform/seed-db.mjs and seed-sync.mjs) is a
 * curator's statement, not an observation: re-syncing an unchanged seed file never moves "last
 * verified" and never reverts a value that a collector, admin or the community wrote after the seed
 * did — only an edited seed value (different from what the seed itself last said) is applied.
 * Works on any object with the D1 binding API (Cloudflare D1, node:sqlite shim, D1 REST client). */
import {normName,dateMs,datePrecision,envKey,mayOverride,supersedes,VERSION_PROPERTIES,compareVersionStrings} from './schema.js';
import {verticalOf} from './verticals/index.js';

/** @typedef {{prepare(sql:string):any,batch(stmts:any[]):Promise<any[]>}} D1 */
/** @typedef {'seed'|'collector'|'admin'|'community'} IngestMode */
/** @typedef {{mode:IngestMode,actor:string,now?:number,adapter?:string}} IngestOptions */

/** The actor under which curated seed files are written (see the header). */
export const SEED_ACTOR='seed';

/** Canonical JSON (sorted keys) so equal values compare equal. @param {unknown} v @returns {string} */
export function canon(v){
 if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
 if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(/** @type {any} */(v)[k])).join(',')+'}';
 return JSON.stringify(v);
}
const CHUNK=40;
/** @template T @param {T[]} a @param {number} n @returns {T[][]} */
const chunks=(a,n=CHUNK)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
const qs=(/** @type {number} */ n)=>Array(n).fill('?').join(',');
/** @param {unknown} s @param {any} fallback */
const parseJSON=(s,fallback)=>{if(s==null)return fallback;try{return JSON.parse(String(s));}catch{return fallback;}};
/** "Last verified" timestamps are shown per day ("9/28 확인", UTC or KST). A re-confirmation writes only
 * when it moves that day, so collectors that run every 30 minutes / 6 hours do not rewrite unchanged
 * rows (D1 bills rows written; the free tier allows 100k a day). @param {number|null|undefined} prev @param {number} now */
export const newDay=(prev,now)=>{
 if(prev==null)return true;const p=Number(prev),K=9*36e5;
 return Math.floor(p/864e5)!==Math.floor(now/864e5)||Math.floor((p+K)/864e5)!==Math.floor((now+K)/864e5);
};
/** Scope columns of a fact row. */
export const SCOPE=/** @type {const} */(['region','language','platform','plan','app_version']);
/** @param {any} f */
export const factScope=f=>({region:f.region||'*',language:f.language||'*',platform:f.platform||'*',plan:f.plan||'*',app_version:f.app_version||'*'});
const scopeKey=(/** @type {string} */ entity,/** @type {string} */ p,/** @type {Record<string,string>} */ s)=>[entity,p,...SCOPE.map(k=>s[k])].join('\u0001');

/** Per-locale text ({en,ko,ja}): the incoming document wins for every locale it names, locales it
 * does not name are kept (a seed file without `ja` never erases a collector's `ja`), null removes one.
 * @param {Record<string,unknown>|null|undefined} stored @param {Record<string,unknown>|null|undefined} incoming @returns {Record<string,unknown>} */
export function mergeLocales(stored,incoming){
 /** @type {Record<string,unknown>} */const out={...(stored&&typeof stored==='object'?stored:{})};
 for(const [k,v] of Object.entries(incoming||{})){if(v==null)delete out[k];else out[k]=v;}
 return out;
}
/** Official links: stored order kept, an incoming url replaces its stored entry (new label), new
 * urls are appended; a url is never dropped by a document that simply does not list it.
 * @param {any[]} stored @param {any[]} incoming @returns {any[]} */
export function mergeUrls(stored,incoming){
 const s=Array.isArray(stored)?stored:[],inc=Array.isArray(incoming)?incoming:[];
 const byUrl=new Map(inc.map(u=>[u?.url,u]));
 return [...s.map(u=>byUrl.has(u?.url)?byUrl.get(u?.url):u),...inc.filter(u=>!s.some(x=>x?.url===u?.url))];
}
/** A stable release line and its LTS label name the same release ("4.5.14" stable = "4.5.14" lts). */
const channelGroup=(/** @type {string} */ c)=>c==='lts'?'stable':c;

/** Default Radar importance of a changed property: prices/availability/versions matter most. */
function importanceOf(/** @type {string} */ vertical,/** @type {string} */ property){
 const def=verticalOf(vertical)?.properties[property];
 if(!def)return 1;
 if(def.volatility==='static')return 1;
 return def.group==='pricing'||['latest_version','current_build','korean_official','status','airing_status','patch_version','verified_game_version'].includes(property)?3:2;
}

/**
 * Apply a seed document to the graph.
 * @param {D1} db @param {any} doc @param {IngestOptions} opts
 * @returns {Promise<{entities:number,created:number,facts:{added:number,changed:number,confirmed:number,conflicts:number,kept:number},changes:number,touched:string[]}>}
 */
export async function ingest(db,doc,opts){
 const now=opts.now??Date.now(),mode=opts.mode,actor=opts.actor,vertical=doc.vertical;
 const quiet=mode==='seed';            // seed history is not news: changes are recorded at importance 0
 const fromSeed=actor===SEED_ACTOR;    // a curator's statement: never a re-verification (see header)
 /** @type {any[]} */const writes=[];
 const W=(/** @type {string} */ sql,/** @type {any[]} */ ...p)=>{writes.push(db.prepare(sql).bind(...p));};
 const stats={entities:0,created:0,facts:{added:0,changed:0,confirmed:0,conflicts:0,kept:0},changes:0,touched:/** @type {string[]} */([])};
 const touched=new Set();
 /** @type {any[]} */const changeRows=[];
 const change=(/** @type {Record<string,any>} */ c)=>{changeRows.push(c);};

 // 1. sources + snapshots
 for(const s of doc.sources||[]){
  W(`INSERT INTO sources (id,url,title,publisher,kind,adapter,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,publisher=excluded.publisher,kind=excluded.kind,adapter=COALESCE(excluded.adapter,sources.adapter),note=excluded.note,updated_at=excluded.updated_at
     WHERE sources.url IS NOT excluded.url OR sources.title IS NOT excluded.title OR sources.publisher IS NOT excluded.publisher OR sources.kind IS NOT excluded.kind
      OR (excluded.adapter IS NOT NULL AND sources.adapter IS NOT excluded.adapter) OR sources.note IS NOT excluded.note`,
   s.id,s.url??null,s.title??null,s.publisher??null,s.kind,s.adapter??opts.adapter??null,s.note??null,now,now);
 }
 await flush(db,writes);
 /** snapshot index in doc.snapshots → row id */
 /** @type {Map<number,number>} */const snapIds=new Map();
 // An unchanged page (same checksum as the newest snapshot of that url) reuses that snapshot row:
 // provenance stays exact and a collector that reads 265 pages does not write 265 rows every run.
 /** @type {Map<string,Map<string,{id:number,checksum:string|null}>|null>} */const latestSnap=new Map();
 for(const [i,s] of (doc.snapshots||[]).entries()){
  if(!s?.source)continue;
  if(!latestSnap.has(s.source)){
   const exists=await db.prepare('SELECT 1 FROM sources WHERE id=?').bind(s.source).first();
   /** @type {Map<string,{id:number,checksum:string|null}>|null} */let m=null;
   if(exists){
    m=new Map();
    const r=await db.prepare('SELECT id,url,checksum FROM snapshots WHERE id IN (SELECT MAX(id) FROM snapshots WHERE source_id=? GROUP BY url)').bind(s.source).all();
    for(const row of r.results||[])m.set(row.url??'',{id:Number(row.id),checksum:row.checksum??null});
   }
   latestSnap.set(s.source,m);
  }
  const known=latestSnap.get(s.source);
  if(!known)continue;
  const prev=known.get(s.url??'');
  if(prev&&s.checksum&&!s.error&&prev.checksum===s.checksum){snapIds.set(i,prev.id);continue;}
  const excerpt=s.excerpt===undefined?null:JSON.stringify(s.excerpt).slice(0,16384);
  const row=await db.prepare(`INSERT INTO snapshots (source_id,adapter,url,fetched_at,http_status,content_type,checksum,byte_size,r2_key,excerpt,parser_version,error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`)
   .bind(s.source,opts.adapter??null,s.url??null,Date.parse(s.fetched_at)||now,s.http_status??null,s.content_type??null,s.checksum??null,s.byte_size??null,s.r2_key??null,excerpt,s.parser_version??null,s.error??null).first();
  if(row){snapIds.set(i,Number(row.id));known.set(s.url??'',{id:Number(row.id),checksum:s.error?null:s.checksum??null});}
 }

 // 2. entities
 const list=doc.entities||[];
 /** @type {Map<string,any>} */const existing=new Map();
 for(const c of chunks([...new Set(list.map((/** @type {any} */ e)=>e.id))])){
  const r=await db.prepare(`SELECT id,vertical,type,slug,names,descriptions,official_urls,regions,image_url,status,merged_into FROM entities WHERE id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results)existing.set(row.id,row);
 }
 // A merged entity forwards writes to its target.
 const resolveId=(/** @type {string} */ id)=>{const e=existing.get(id);return e?.status==='merged'&&e.merged_into?e.merged_into:id;};
 const createdNow=new Set();
 /** Entities whose search rows must be rebuilt (names, descriptions, aliases or status changed). */
 const reindex=new Set();
 /** @type {Set<string>} existing alias keys entity\u0001norm */const aliasKnown=new Set();
 const aliasOwners=[...new Set(list.filter((/** @type {any} */ e)=>e.names!==undefined||e.slug!==undefined).map((/** @type {any} */ e)=>resolveId(e.id)))];
 for(const c of chunks(aliasOwners)){
  const r=await db.prepare(`SELECT entity_id,norm FROM entity_aliases WHERE entity_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results||[])aliasKnown.add(row.entity_id+'\u0001'+row.norm);
 }
 for(const e of list){
  // A bare reference (facts/events only) changes nothing about the entity itself.
  if(e.names===undefined&&e.slug===undefined)continue;
  stats.entities++;
  const cur=existing.get(e.id);
  if(!cur){
   const names=JSON.stringify(mergeLocales({},e.names)),desc=JSON.stringify(mergeLocales({},e.description)),urls=JSON.stringify(e.official_urls||[]),regions=JSON.stringify(e.regions||['GLOBAL']);
   W(`INSERT INTO entities (id,vertical,type,slug,names,descriptions,image_url,image_credit,regions,languages,official_urls,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'active',?,?)`,
    e.id,vertical,e.type,e.slug,names,desc,e.image_url??null,e.image_credit??null,regions,JSON.stringify(e.languages||[]),urls,now,now);
   existing.set(e.id,{id:e.id,vertical,type:e.type,slug:e.slug,names,descriptions:desc,official_urls:urls,regions,image_url:e.image_url??null,status:'active',merged_into:null});
   createdNow.add(e.id);stats.created++;
   change({entity_id:e.id,vertical,kind:'entity_added',importance:quiet?0:1,effective_at:now});
   touched.add(e.id);reindex.add(e.id);
  }else if(cur.status!=='merged'){
   // Only what the document states is applied; what it leaves out stays (see mergeLocales/mergeUrls).
   const was={names:parseJSON(cur.names,{}),descriptions:parseJSON(cur.descriptions,{}),official_urls:parseJSON(cur.official_urls,[]),regions:parseJSON(cur.regions,['GLOBAL'])};
   const next={names:e.names!==undefined?mergeLocales(was.names,e.names):was.names,
    descriptions:e.description!==undefined?mergeLocales(was.descriptions,e.description):was.descriptions,
    official_urls:e.official_urls!==undefined?mergeUrls(was.official_urls,e.official_urls):was.official_urls,
    regions:e.regions!==undefined?e.regions:was.regions};
   const slug=e.slug??cur.slug,image=e.image_url!==undefined&&e.image_url!==null&&e.image_url!==cur.image_url;
   const diff=/** @type {(keyof typeof next)[]} */(Object.keys(next)).some(k=>canon(next[k])!==canon(was[k]));
   if(diff||slug!==cur.slug||image){
    if(slug!==cur.slug)W(`INSERT OR IGNORE INTO entity_redirects (vertical,slug,entity_id,created_at) VALUES (?,?,?,?)`,cur.vertical,cur.slug,e.id,now);
    const names=JSON.stringify(next.names),desc=JSON.stringify(next.descriptions),urls=JSON.stringify(next.official_urls),regions=JSON.stringify(next.regions);
    W(`UPDATE entities SET names=?,descriptions=?,official_urls=?,regions=?,slug=?,image_url=COALESCE(?,image_url),updated_at=? WHERE id=?`,names,desc,urls,regions,slug,e.image_url??null,now,e.id);
    // A second definition of the same entity in this document compares against what was just written.
    existing.set(e.id,{...cur,names,descriptions:desc,official_urls:urls,regions,slug,image_url:e.image_url??cur.image_url});
    touched.add(e.id);reindex.add(e.id);
   }
  }
  const owner=resolveId(e.id);
  const aliasList=[...Object.entries(e.names||{}).filter(([,n])=>typeof n==='string').map(([l,n])=>[n,l,'name']),...(e.aliases||[]).map((/** @type {string} */ a)=>[a,'*','alias'])];
  for(const [alias,locale,kind] of aliasList){
   const n=normName(alias);if(!n||aliasKnown.has(owner+'\u0001'+n))continue;
   aliasKnown.add(owner+'\u0001'+n);
   W(`INSERT OR IGNORE INTO entity_aliases (entity_id,norm,alias,locale,kind) VALUES (?,?,?,?,?)`,owner,n,alias,locale,kind);
   touched.add(owner);reindex.add(owner);
  }
 }
 await flush(db,writes);

 // 3. facts (the same scope twice in one document: the last row wins)
 const factInputs=[...new Map(list.flatMap((/** @type {any} */ e)=>(e.facts||[]).map((/** @type {any} */ f)=>{const x={...f,entity:resolveId(e.id)};return [scopeKey(x.entity,x.p,factScope(x)),x];}))).values()];
 /** @type {Map<string,any>} */const currentFacts=new Map();
 const factEntities=[...new Set(factInputs.map((/** @type {any} */ f)=>f.entity))];
 for(const c of chunks(factEntities)){
  const r=await db.prepare(`SELECT id,entity_id,property,region,language,platform,plan,app_version,value,unit,verification,source_id,observed_at,created_by FROM facts WHERE is_current=1 AND entity_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results)currentFacts.set(scopeKey(row.entity_id,row.property,row),row);
 }
 const vOf=(/** @type {string} */ id)=>existing.get(id)?.vertical||vertical;
 /** conflicts raised by this document: fact\u0001value\u0001verification\u0001source */
 const conflictSeen=new Set();
 for(const f of factInputs){
  const s=factScope(f),key=scopeKey(f.entity,f.p,s),value=canon(f.v),cur=currentFacts.get(key);
  const validFrom=f.from?dateMs(f.from):now,snap=f.snap!==undefined?snapIds.get(f.snap)??null:null;
  if(cur&&cur.value===value&&(cur.unit??null)===(f.unit??null)){
   stats.facts.confirmed++;
   // Re-confirmation moves "last verified" (once per shown day); a more trusted source upgrades the label.
   // A seed re-sync states nothing new: it may upgrade the label but never moves "last verified".
   if(cur.id!=null&&mayOverride(f.ver,cur.verification)&&f.ver!==cur.verification){
    if(fromSeed)W(`UPDATE facts SET verification=?,source_id=? WHERE id=?`,f.ver,f.src??null,cur.id);
    else W(`UPDATE facts SET observed_at=?,verification=?,source_id=?,snapshot_id=COALESCE(?,snapshot_id) WHERE id=?`,now,f.ver,f.src??null,snap,cur.id);
    cur.verification=f.ver;
   }else if(!fromSeed&&cur.id!=null&&newDay(cur.observed_at,now)){W(`UPDATE facts SET observed_at=MAX(observed_at,?),snapshot_id=COALESCE(?,snapshot_id) WHERE id=?`,now,snap,cur.id);cur.observed_at=now;}
   continue;
  }
  if(cur&&fromSeed&&cur.id!=null&&cur.created_by!==SEED_ACTOR){
   // Someone else wrote the current value after the seed. An unchanged seed line must not revert it,
   // and a seed never moves a "newest version" property backwards.
   const last=await db.prepare(`SELECT value,unit FROM facts WHERE entity_id=? AND property=? AND region=? AND language=? AND platform=? AND plan=? AND app_version=? AND created_by=? ORDER BY id DESC LIMIT 1`)
    .bind(f.entity,f.p,s.region,s.language,s.platform,s.plan,s.app_version,SEED_ACTOR).first();
   const unchanged=last&&last.value===value&&(last.unit??null)===(f.unit??null);
   const backwards=VERSION_PROPERTIES.has(f.p)&&(compareVersionStrings(f.v,parseJSON(cur.value,null))??0)<0;
   if(unchanged||backwards){stats.facts.kept++;continue;}
  }
  if(cur&&!supersedes({ver:f.ver,value:f.v,property:f.p},{verification:cur.verification,value:parseJSON(cur.value,null)})){
   if(cur.id==null)continue;   // superseded earlier in this very document
   stats.facts.conflicts++;
   // One open conflict per (fact, value, label, source): a collector that re-reads the same page every
   // run refreshes it (once per shown day) instead of piling up rows; a value the admin rejected for
   // this fact is not raised again.
   const ck=[cur.id,value,f.ver,f.src??''].join('\u0001');
   if(conflictSeen.has(ck))continue;conflictSeen.add(ck);
   const known=await db.prepare(`SELECT id,status,observed_at FROM fact_conflicts WHERE fact_id=? AND value=? AND verification=? AND COALESCE(source_id,'')=? AND status IN ('open','rejected') ORDER BY status='open' DESC,id DESC LIMIT 1`)
    .bind(cur.id,value,f.ver,f.src??'').first();
   if(known){
    if(known.status==='open'&&newDay(known.observed_at,now))W(`UPDATE fact_conflicts SET observed_at=?,snapshot_id=COALESCE(?,snapshot_id) WHERE id=?`,now,snap,known.id);
    continue;
   }
   W(`INSERT INTO fact_conflicts (fact_id,value,verification,source_id,snapshot_id,observed_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,cur.id,value,f.ver,f.src??null,snap,now,actor,now);
   continue;
  }
  if(cur){
   if(cur.id!=null){
    W(`UPDATE facts SET is_current=0,valid_until=? WHERE id=?`,Math.max(validFrom,now),cur.id);
    // Conflicts raised against the value that just went out of date are settled by this change.
    W(`UPDATE fact_conflicts SET status=CASE WHEN value=? THEN 'accepted' ELSE 'rejected' END,resolved_by='system:ingest',resolved_at=? WHERE fact_id=? AND status='open'`,value,now,cur.id);
   }
   stats.facts.changed++;
  }
  else stats.facts.added++;
  W(`INSERT INTO facts (entity_id,property,region,language,platform,plan,app_version,value,unit,verification,confidence,source_id,snapshot_id,note,valid_from,observed_at,is_current,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
   f.entity,f.p,s.region,s.language,s.platform,s.plan,s.app_version,value,f.unit??null,f.ver,f.confidence??1,f.src??null,snap,f.note??null,validFrom,now,actor,now);
  currentFacts.set(key,{id:null,value,unit:f.unit??null,verification:f.ver,created_by:actor});
  const isNew=createdNow.has(f.entity);
  change({entity_id:f.entity,vertical:vOf(f.entity),kind:cur?'fact_changed':'fact_added',property:f.p,scope:JSON.stringify(s),old_value:cur?cur.value:null,new_value:value,importance:quiet||isNew?0:!cur?1:importanceOf(vOf(f.entity),f.p),source_id:f.src??null,effective_at:validFrom});
  touched.add(f.entity);
 }
 await flush(db,writes);

 // 4a. relations (the same relation cited twice, e.g. once per work, is stored once: first source wins).
 // A weaker source never rewrites a stronger one's row, and two sources of equal trust citing the
 // same relation do not take turns rewriting it (a seed line and a collector would, every run).
 /** @type {Map<string,any>} */const curRel=new Map();
 const relKeyOf=(/** @type {string} */ s,/** @type {string} */ p,/** @type {string} */ o,/** @type {string} */ r)=>[s,p,o,r].join('\u0001');
 const relSubjects=[...new Set(list.filter((/** @type {any} */ e)=>e.relations?.length).map((/** @type {any} */ e)=>resolveId(e.id)))];
 for(const c of chunks(relSubjects)){
  const r=await db.prepare(`SELECT id,subject_id,predicate,object_id,region,meta,verification,source_id FROM relations WHERE subject_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results||[])curRel.set(relKeyOf(row.subject_id,row.predicate,row.object_id,row.region),row);
 }
 const seenRel=new Set();
 for(const e of list)for(const r of e.relations||[]){
  const subject=resolveId(e.id),object=resolveId(r.o),region=r.region||'*',relKey=relKeyOf(subject,r.p,object,region);
  if(seenRel.has(relKey))continue;seenRel.add(relKey);
  const cur=curRel.get(relKey);
  if(cur){
   const ver=r.ver||'OFFICIAL';
   if(!mayOverride(ver,cur.verification))continue;
   const meta=r.meta!==undefined?JSON.stringify(r.meta||{}):cur.meta,stronger=ver!==cur.verification;
   if(canon(parseJSON(meta,{}))!==canon(parseJSON(cur.meta,{}))||stronger||(cur.source_id==null&&r.src)){
    W('UPDATE relations SET meta=?,verification=?,source_id=?,updated_at=? WHERE id=?',meta,ver,stronger?r.src??cur.source_id??null:cur.source_id??r.src??null,now,cur.id);
   }
   continue;
  }
  W(`INSERT INTO relations (subject_id,predicate,object_id,meta,region,valid_from,verification,source_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,subject,r.p,object,JSON.stringify(r.meta||{}),region,r.from?dateMs(r.from):null,r.ver||'OFFICIAL',r.src??null,now,now);
  if(!quiet&&!createdNow.has(subject))change({entity_id:subject,vertical:vOf(subject),kind:'relation_added',property:r.p,new_value:JSON.stringify(object),importance:1,source_id:r.src??null,effective_at:now});
  touched.add(subject);touched.add(object);
 }
 await flush(db,writes);

 // 4b. versions (+ compatibility state machine for updated targets)
 /** @type {Set<string>} entity\u0001channel group\u0001version */const knownVer=new Set();
 const verEntities=[...new Set(list.filter((/** @type {any} */ e)=>e.versions?.length).map((/** @type {any} */ e)=>resolveId(e.id)))];
 for(const c of chunks(verEntities)){
  const r=await db.prepare(`SELECT entity_id,channel,version FROM versions WHERE entity_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results||[])knownVer.add([row.entity_id,channelGroup(row.channel),row.version].join('\u0001'));
 }
 for(const e of list)for(const x of e.versions||[]){
  const id=resolveId(e.id),channel=x.channel||'stable',verKey=[id,channelGroup(channel),x.version].join('\u0001');
  if(knownVer.has(verKey))continue;knownVer.add(verKey);
  const released=x.released?dateMs(x.released):null;
  const newest=await db.prepare('SELECT MAX(released_at) AS m FROM versions WHERE entity_id=? AND channel=?').bind(id,channel).first();
  const row=await db.prepare(`INSERT INTO versions (entity_id,version,channel,released_at,build_id,notes_url,source_id,verification,detected_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`)
   .bind(id,x.version,channel,released,x.build_id??null,x.notes_url??null,x.src??null,x.ver||'OFFICIAL',now).first();
  const isLatest=channel==='stable'&&(released===null||newest?.m==null||released>=newest.m);
  const recent=released===null||now-released<30*864e5;
  change({entity_id:id,vertical:vOf(id),kind:'version_released',new_value:JSON.stringify(x.version),importance:quiet||createdNow.has(id)||!recent?0:2,source_id:x.src??null,ref_id:String(row?.id??''),effective_at:released??now});
  if(isLatest&&!quiet&&!createdNow.has(id))await unverifyAfterUpdate(db,id,x.version,now,change);
  touched.add(id);
 }

 // 4c. events. One page can announce several dates (episode 49 and 50 on one news page), so an
 // event is (url, kind, title); a changed title still matches when that url has exactly one event.
 // A page that repeats a title ("Deprecation announcement" on two dates of one changelog) makes the
 // start part of the identity; the same item listed twice (same title and start) is one event.
 const evTitleKey=(/** @type {any} */ x)=>[x.url??'',x.kind,canon(x.title)].join('\u0001');
 /** @type {Map<string,any>} */const uniq=new Map();
 for(const x of doc.events||[]){
  const k=evTitleKey(x)+'\u0001'+(x.starts??'')+'\u0001'+(x.ends??''),prev=uniq.get(k);
  uniq.set(k,prev?{...x,entities:[...new Set([...prev.entities,...x.entities])],roles:undefined}:x);
 }
 const events=[...uniq.values()];
 /** @type {Map<string,number>} */const perUrl=new Map(),perTitle=new Map();
 for(const x of events){
  if(x.url){const k=`${x.url}\u0001${x.kind}`;perUrl.set(k,(perUrl.get(k)||0)+1);}
  perTitle.set(evTitleKey(x),(perTitle.get(evTitleKey(x))||0)+1);
 }
 /** DB rows already matched by an event of this document (never match one row twice). */
 const matched=new Set();
 const EV_COLS='id,starts_at,ends_at,status,title';
 for(const x of events){
  const starts=x.starts?Date.parse(x.starts.length<=10?x.starts+'T00:00:00Z':x.starts):null;
  const ends=x.ends?Date.parse(x.ends.length<=10?x.ends+'T00:00:00Z':x.ends):null;
  const precision=x.precision||(x.starts&&x.starts.length>10?'time':x.starts?datePrecision(x.starts):'day');
  const ids=[...new Set(x.entities.map(resolveId))],title=JSON.stringify(x.title);
  /** @type {any} */let cur=null;
  const same=x.url
   ?(await db.prepare(`SELECT ${EV_COLS} FROM events WHERE url=? AND kind=? AND title=? ORDER BY id LIMIT 20`).bind(x.url,x.kind,title).all()).results||[]
   :(await db.prepare(`SELECT ${EV_COLS} FROM events WHERE url IS NULL AND title=? AND kind=? ORDER BY id LIMIT 20`).bind(title,x.kind).all()).results||[];
  const free=same.filter((/** @type {any} */ r)=>!matched.has(Number(r.id)));
  cur=free.find((/** @type {any} */ r)=>r.starts_at===starts)||null;
  if(!cur&&perTitle.get(evTitleKey(x))===1&&free.length===1&&same.length===1)cur=free[0];
  if(!cur&&!same.length&&x.url&&perUrl.get(`${x.url}\u0001${x.kind}`)===1){
   const byUrl=(await db.prepare(`SELECT ${EV_COLS} FROM events WHERE url=? AND kind=? LIMIT 2`).bind(x.url,x.kind).all()).results||[];
   if(byUrl.length===1&&!matched.has(Number(byUrl[0].id)))cur=byUrl[0];
  }
  if(cur){
   matched.add(Number(cur.id));
   const status=x.status||'announced';
   if(cur.starts_at!==starts||cur.ends_at!==ends||cur.status!==status||cur.title!==title){
    W('UPDATE events SET title=?,starts_at=?,ends_at=?,date_precision=?,status=?,location=?,region=?,updated_at=? WHERE id=?',title,starts,ends,precision,status,x.location??null,x.region||'*',now,cur.id);
    for(const id of ids)change({entity_id:id,vertical:vOf(id),kind:'event_changed',new_value:canon({starts:x.starts??null,ends:x.ends??null,status}),old_value:canon({starts_at:cur.starts_at,ends_at:cur.ends_at,status:cur.status}),importance:quiet?0:2,source_id:x.src??null,ref_id:String(cur.id),effective_at:now});
   }
   continue;
  }
  const row=await db.prepare(`INSERT INTO events (entity_id,kind,title,starts_at,ends_at,date_precision,region,location,url,status,verification,source_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`)
   .bind(x.page?resolveId(x.page):null,x.kind,title,starts,ends,precision,x.region||'*',x.location??null,x.url??null,x.status||'announced',x.ver||'OFFICIAL',x.src??null,now,now).first();
  const eventId=Number(row?.id);matched.add(eventId);
  for(const [i,id] of ids.entries()){
   W('INSERT OR IGNORE INTO event_entities (event_id,entity_id,role) VALUES (?,?,?)',eventId,id,x.roles?.[i]||'about');
   const past=(ends??starts??now)<now;
   change({entity_id:id,vertical:vOf(id),kind:'event_announced',new_value:title,importance:past?0:quiet?1:2,source_id:x.src??null,ref_id:String(eventId),effective_at:now});
   touched.add(id);
  }
 }
 await flush(db,writes);

 // 4d. availability (a repeated key in one document: the last row wins)
 const availRows=[...new Map((doc.availability||[]).map((/** @type {any} */ a)=>[[resolveId(a.entity),a.plan||'*',a.platform||'*',a.region||'*'].join('\u0001'),a])).values()];
 /** @type {Map<string,any>} */const curAvail=new Map();
 for(const c of chunks([...new Set(availRows.map(a=>resolveId(a.entity)))])){
  const r=await db.prepare(`SELECT id,entity_id,plan_id,platform,region,state,verification,source_id,observed_at FROM availability WHERE is_current=1 AND entity_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results||[])curAvail.set([row.entity_id,row.plan_id,row.platform,row.region].join('\u0001'),row);
 }
 for(const a of availRows){
  const id=resolveId(a.entity),plan=a.plan||'*',platform=a.platform||'*',region=a.region||'*';
  const cur=curAvail.get([id,plan,platform,region].join('\u0001'));
  if(cur&&cur.state===a.state){if(!fromSeed&&newDay(cur.observed_at,now))W('UPDATE availability SET observed_at=? WHERE id=?',now,cur.id);continue;}
  if(cur&&!mayOverride(a.ver,cur.verification))continue;
  // An unchanged seed line (the same state from the same source as the seed's last row) keeps a newer value.
  if(cur&&fromSeed&&a.src&&cur.source_id!==a.src){
   const last=await db.prepare('SELECT state FROM availability WHERE entity_id=? AND plan_id=? AND platform=? AND region=? AND source_id=? ORDER BY id DESC LIMIT 1').bind(id,plan,platform,region,a.src).first();
   if(last&&last.state===a.state)continue;
  }
  const from=a.from?dateMs(a.from):now;
  if(cur)W('UPDATE availability SET is_current=0,valid_until=? WHERE id=?',Math.max(from,now),cur.id);
  W(`INSERT INTO availability (entity_id,plan_id,platform,region,state,verification,source_id,note,valid_from,observed_at,is_current,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)`,id,plan,platform,region,a.state,a.ver,a.src??null,a.note??null,from,now,now);
  change({entity_id:id,vertical:vOf(id),kind:'availability_changed',scope:JSON.stringify({plan,platform,region}),old_value:cur?JSON.stringify(cur.state):null,new_value:JSON.stringify(a.state),importance:quiet||createdNow.has(id)?0:3,source_id:a.src??null,effective_at:from});
  touched.add(id);
 }
 await flush(db,writes);

 // 4e. official/curated compatibility (a repeated key in one document: the last row wins)
 const compatKey=(/** @type {string} */ s,/** @type {string} */ sv,/** @type {string} */ t,/** @type {string} */ tv,/** @type {string} */ ek)=>[s,sv,t,tv,ek].join('\u0001');
 const compatRows=[...new Map((doc.compatibility||[]).map((/** @type {any} */ c)=>[compatKey(resolveId(c.subject),c.subject_version||'*',resolveId(c.target),c.target_version||'*',envKey(c.env||{})),c])).values()];
 /** @type {Map<string,any>} */const curCompat=new Map();
 for(const c of chunks([...new Set(compatRows.map(c=>resolveId(c.subject)))])){
  const r=await db.prepare(`SELECT id,subject_id,subject_version,target_id,target_version,env_key,status,verification,source_id,last_confirmed_at FROM compatibility WHERE is_current=1 AND subject_id IN (${qs(c.length)})`).bind(...c).all();
  for(const row of r.results||[])curCompat.set(compatKey(row.subject_id,row.subject_version,row.target_id,row.target_version,row.env_key),row);
 }
 for(const c of compatRows){
  const subject=resolveId(c.subject),target=resolveId(c.target),sv=c.subject_version||'*',tv=c.target_version||'*',env=c.env||{},ek=envKey(env);
  const cur=curCompat.get(compatKey(subject,sv,target,tv,ek));
  if(cur&&cur.status===c.status){if(!fromSeed&&newDay(cur.last_confirmed_at,now))W('UPDATE compatibility SET last_confirmed_at=?,updated_at=? WHERE id=?',now,now,cur.id);continue;}
  if(cur&&!mayOverride(c.ver,cur.verification))continue;
  // An unchanged seed line keeps a community verdict or a newer statement written since.
  if(cur&&fromSeed&&c.src&&cur.source_id!==c.src){
   const last=await db.prepare('SELECT status FROM compatibility WHERE subject_id=? AND subject_version=? AND target_id=? AND target_version=? AND env_key=? AND source_id=? ORDER BY id DESC LIMIT 1').bind(subject,sv,target,tv,ek,c.src).first();
   if(last&&last.status===c.status)continue;
  }
  if(cur)W('UPDATE compatibility SET is_current=0,valid_until=?,updated_at=? WHERE id=?',now,now,cur.id);
  W(`INSERT INTO compatibility (subject_id,subject_version,target_id,target_version,env,env_key,status,verification,source_id,note,min_subject_version,last_confirmed_at,valid_from,is_current,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
   subject,sv,target,tv,JSON.stringify(env),ek,c.status,c.ver,c.src??null,c.note??null,c.min_subject_version??null,now,now,now,now);
  change({entity_id:subject,vertical:vOf(subject),kind:'compat_changed',scope:canon({target,target_version:tv,subject_version:sv,env}),old_value:cur?JSON.stringify(cur.status):null,new_value:JSON.stringify(c.status),importance:quiet||createdNow.has(subject)?0:2,source_id:c.src??null,effective_at:now});
  touched.add(subject);touched.add(target);
 }
 await flush(db,writes);

 // 5. changes (one row per distinct change), search index, entity versions
 const seenChange=new Set();
 for(const c of changeRows){
  const k=canon([c.entity_id,c.kind,c.property??null,c.scope??'{}',c.old_value??null,c.new_value??null,c.ref_id??null]);
  if(seenChange.has(k))continue;seenChange.add(k);
  W(`INSERT INTO changes (entity_id,vertical,kind,property,scope,old_value,new_value,summary,importance,source_id,ref_id,visibility,effective_at,detected_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
   c.entity_id,c.vertical,c.kind,c.property??null,c.scope??'{}',c.old_value??null,c.new_value??null,c.summary??null,c.importance??2,c.source_id??null,c.ref_id??null,c.visibility||'public',c.effective_at??now,now);
 }
 stats.changes=seenChange.size;
 const ids=[...touched];
 for(const c of chunks(ids))W(`UPDATE entities SET version=version+1,updated_at=? WHERE id IN (${qs(c.length)})`,now,...c);
 await flush(db,writes);
 await reindexEntities(db,[...reindex]);
 stats.touched=ids;
 return stats;
}

/** Game (or other target) got a new version: community/verified compatibility for older versions
 * no longer proves anything → a new current row UNVERIFIED_AFTER_UPDATE for the new version.
 * Official vendor statements ('supported'/'unsupported') are left alone.
 * @param {D1} db @param {string} targetId @param {string} version @param {number} now @param {(c:any)=>void} change */
export async function unverifyAfterUpdate(db,targetId,version,now,change){
 const rows=(await db.prepare(`SELECT c.*, e.vertical AS subject_vertical FROM compatibility c JOIN entities e ON e.id=c.subject_id WHERE c.is_current=1 AND c.target_id=? AND c.target_version<>? AND c.status IN ('works','works_with_issues','broken') ORDER BY c.valid_from DESC`).bind(targetId,version).all()).results;
 /** @type {any[]} */const w=[];const seen=new Set();
 for(const r of rows){
  // Only the newest verified row per (patch version, environment) carries forward.
  const k=r.subject_id+''+r.subject_version+''+r.env_key;if(seen.has(k))continue;seen.add(k);
  const dup=await db.prepare('SELECT id FROM compatibility WHERE is_current=1 AND subject_id=? AND subject_version=? AND target_id=? AND target_version=? AND env_key=?').bind(r.subject_id,r.subject_version,targetId,version,r.env_key).first();
  if(dup)continue;
  w.push(db.prepare(`INSERT INTO compatibility (subject_id,subject_version,target_id,target_version,env,env_key,status,verification,source_id,note,min_subject_version,confirmations,contradictions,score,last_confirmed_at,valid_from,is_current,created_at,updated_at) VALUES (?,?,?,?,?,?,'unverified_after_update','UNKNOWN',NULL,?,?,0,0,0,NULL,?,1,?,?)`)
   .bind(r.subject_id,r.subject_version,targetId,version,r.env,r.env_key,`Previously ${r.status} on ${r.target_version}`,r.min_subject_version,now,now,now));
  change({entity_id:r.subject_id,vertical:r.subject_vertical,kind:'compat_changed',scope:canon({target:targetId,target_version:version,subject_version:r.subject_version}),old_value:JSON.stringify(r.status),new_value:JSON.stringify('unverified_after_update'),importance:3,effective_at:now});
 }
 await flush(db,w);
}

/** Rebuild the search rows of these entities (one row per locale with a name).
 * @param {D1} db @param {string[]} ids */
export async function reindexEntities(db,ids){
 /** @type {any[]} */const w=[];
 for(const c of chunks(ids)){
  const ents=(await db.prepare(`SELECT id,vertical,type,names,descriptions,status FROM entities WHERE id IN (${qs(c.length)})`).bind(...c).all()).results;
  const aliases=(await db.prepare(`SELECT entity_id,alias FROM entity_aliases WHERE entity_id IN (${qs(c.length)})`).bind(...c).all()).results;
  for(const e of ents){
   w.push(db.prepare('DELETE FROM search_docs WHERE doc_key=?').bind('entity:'+e.id));
   if(e.status!=='active')continue;
   const names=JSON.parse(e.names),desc=JSON.parse(e.descriptions||'{}'),al=aliases.filter((/** @type {any} */ a)=>a.entity_id===e.id).map((/** @type {any} */ a)=>a.alias);
   for(const locale of Object.keys(names).length?Object.keys(names):['en']){
    w.push(db.prepare('INSERT INTO search_docs (doc_key,kind,vertical,locale,title,body) VALUES (?,?,?,?,?,?)').bind('entity:'+e.id,e.type,e.vertical,locale,names[locale]||names.en,[...new Set(al)].join(' · ')+' '+(desc[locale]||desc.en||'')));
   }
  }
 }
 await flush(db,w);
}

/** Execute queued statements in transactional chunks. @param {D1} db @param {any[]} writes */
export async function flush(db,writes){
 const all=writes.splice(0,writes.length);
 for(const c of chunks(all,90))await db.batch(c);
}
