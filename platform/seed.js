// @ts-check
/** Seed documents: curated, sourced graph data under data/seed/<vertical>/*.json
 * (format: docs/n2/SEED-FORMAT.md). validateSeed() is strict on purpose: a seed file that
 * passes can be imported by the same ingest pipeline collectors use. */
import {VERIFICATION,SOURCE_KINDS,COMPAT_STATUS,AVAILABILITY_STATE,EVENT_KINDS,PREDICATES,PLATFORMS,ENTITY_ID,SLUG,SOURCE_ID,ISO_DATE,REGION,isObject,isHttpURL,VERTICALS} from './schema.js';
import {verticalOf} from './verticals/index.js';

export const SEED_SCHEMA='nerulio.seed/1';
const LOCALE_KEYS=['en','ko','ja'];
/** @param {unknown} v */
const isLabel=v=>isObject(v)&&Object.keys(/** @type {object} */(v)).length>0&&Object.entries(/** @type {object} */(v)).every(([k,x])=>LOCALE_KEYS.includes(k)&&typeof x==='string'&&x.trim().length>0&&x.length<=2000);

/**
 * Validate one seed document. `known` = ids of entities/sources defined in OTHER seed files
 * (cross-file references are allowed).
 * @param {any} doc @param {{entities?:Set<string>,sources?:Set<string>}} [known]
 * @returns {string[]} errors (empty = valid)
 */
export function validateSeed(doc,known={}){
 /** @type {string[]} */const errors=[];const err=(/** @type {string} */ m)=>{if(errors.length<200)errors.push(m);};
 if(!isObject(doc))return ['document must be an object'];
 if(doc.schema!==SEED_SCHEMA)err(`schema must be "${SEED_SCHEMA}"`);
 if(!VERTICALS.includes(doc.vertical))err(`vertical must be one of ${VERTICALS.join(', ')}`);
 const v=verticalOf(doc.vertical);
 const sources=new Set(known.sources||[]),entities=new Set(known.entities||[]);
 for(const s of doc.sources||[]){
  if(!SOURCE_ID.test(s?.id))err(`source id invalid: ${s?.id}`);
  if(!SOURCE_KINDS.includes(s.kind))err(`source ${s.id}: kind must be one of ${SOURCE_KINDS.join(', ')}`);
  if(s.kind!=='MANUAL_SOURCE'&&s.kind!=='ESTIMATE_METHOD'&&!isHttpURL(s.url))err(`source ${s.id}: url required (http/https)`);
  if(s.url!==undefined&&!isHttpURL(s.url))err(`source ${s.id}: invalid url`);
  if(!s.retrieved||!/^\d{4}-\d\d-\d\d$/.test(s.retrieved))err(`source ${s.id}: retrieved (YYYY-MM-DD) required`);
  if(sources.has(s.id)&&!(known.sources||new Set()).has(s.id))err(`duplicate source ${s.id}`);
  sources.add(s.id);
 }
 const localIds=new Set();
 for(const e of doc.entities||[])if(e?.id)localIds.add(e.id);
 const exists=(/** @type {string} */ id)=>localIds.has(id)||entities.has(id);
 const src=(/** @type {unknown} */ id,/** @type {string} */ where)=>{if(id===undefined)return err(`${where}: src required`);if(!sources.has(/** @type {string} */(id)))err(`${where}: unknown source ${id}`);};
 const ver=(/** @type {unknown} */ x,/** @type {string} */ where)=>{if(!VERIFICATION.includes(/** @type {any} */(x)))err(`${where}: ver must be one of ${VERIFICATION.join(', ')}`);};
 const scope=(/** @type {any} */ f,/** @type {string} */ where)=>{
  if(f.region!==undefined&&!REGION.test(f.region))err(`${where}: region must be ISO alpha-2, EEA, EU, GLOBAL or *`);
  if(f.platform!==undefined&&!PLATFORMS.includes(f.platform))err(`${where}: platform must be one of ${PLATFORMS.join(', ')}`);
  if(f.plan!==undefined&&!ENTITY_ID.test(f.plan))err(`${where}: plan must be a plan entity id`);
  if(f.plan!==undefined&&!exists(f.plan))err(`${where}: unknown plan ${f.plan}`);
  if(f.from!==undefined&&!ISO_DATE.test(f.from))err(`${where}: from must be an ISO date`);
 };
 const slugs=new Set();
 for(const e of doc.entities||[]){
  const where=`entity ${e?.id}`;
  if(!ENTITY_ID.test(e?.id))err(`${where}: id must match type:key (lower-case)`);
  const [type]=String(e?.id).split(':');
  // A collector may update an entity defined elsewhere with just {id, facts/versions/…}.
  const partial=entities.has(e.id)&&e.names===undefined&&e.slug===undefined;
  if(!partial){
   if(e.type!==type)err(`${where}: type must equal the id prefix (${type})`);
   if(v&&!v.types[e.type])err(`${where}: type ${e.type} is not defined for vertical ${doc.vertical}`);
   if(!SLUG.test(e.slug))err(`${where}: slug invalid`);
   if(slugs.has(e.slug))err(`${where}: duplicate slug ${e.slug}`);slugs.add(e.slug);
   if(!isLabel(e.names)||!e.names.en)err(`${where}: names.en required`);
  }
  if(e.description!==undefined&&!isLabel(e.description))err(`${where}: description must be {en,ko} text`);
  if(e.aliases!==undefined&&(!Array.isArray(e.aliases)||e.aliases.some((/** @type {unknown} */ a)=>typeof a!=='string'||!a.trim()||a.length>120)))err(`${where}: aliases must be strings`);
  if(e.regions!==undefined&&(!Array.isArray(e.regions)||e.regions.some((/** @type {string} */ r)=>!REGION.test(r))))err(`${where}: regions invalid`);
  for(const u of e.official_urls||[])if(!isHttpURL(u?.url)||typeof u.label!=='string')err(`${where}: official_urls entries need {label,url}`);
  for(const f of e.facts||[]){
   const w=`${where} fact ${f?.p}`;
   if(v&&!v.properties[f?.p])err(`${w}: property not defined for vertical ${doc.vertical}`);
   if(f.v===undefined||f.v===null||f.v==='')err(`${w}: value required (omit the fact when unknown)`);
   const def=v?.properties[f.p];
   if(def){
    if(def.type==='number'||def.type==='tokens'){if(typeof f.v!=='number'||!Number.isFinite(f.v))err(`${w}: number expected`);}
    else if(def.type==='money'){if(typeof f.v!=='number'||!Number.isFinite(f.v)||f.v<0)err(`${w}: amount expected`);if(!def.unit&&!/^[A-Z]{3}$/.test(f.unit||''))err(`${w}: ISO currency unit required`);}
    else if(def.type==='date'){if(typeof f.v!=='string'||!ISO_DATE.test(f.v))err(`${w}: ISO date expected`);}
    else if(def.type==='bool'){if(typeof f.v!=='boolean')err(`${w}: boolean expected`);}
    else if(def.type==='list'){if(!Array.isArray(f.v)||f.v.some((/** @type {unknown} */ x)=>typeof x!=='string'))err(`${w}: list of strings expected`);}
    else if(def.type==='url'){if(!isHttpURL(f.v))err(`${w}: url expected`);}
    else if(def.type==='enum'){if(!def.values||!(f.v in def.values))err(`${w}: one of ${Object.keys(def.values||{}).join(', ')}`);}
    else if(typeof f.v!=='string')err(`${w}: text expected`);
   }
   ver(f.ver,w);src(f.src,w);scope(f,w);
  }
  for(const r of e.relations||[]){
   const w=`${where} relation ${r?.p}`;
   if(!(r?.p in PREDICATES))err(`${w}: unknown predicate`);
   if(!exists(r.o))err(`${w}: unknown object ${r.o}`);
   if(r.src!==undefined)src(r.src,w);
   if(r.ver!==undefined)ver(r.ver,w);
  }
  for(const x of e.versions||[]){
   const w=`${where} version ${x?.version}`;
   if(typeof x?.version!=='string'||!x.version)err(`${w}: version required`);
   if(x.released!==undefined&&!ISO_DATE.test(x.released))err(`${w}: released must be an ISO date`);
   if(x.notes_url!==undefined&&!isHttpURL(x.notes_url))err(`${w}: notes_url invalid`);
   src(x.src,w);
  }
 }
 for(const x of doc.events||[]){
  const w=`event ${JSON.stringify(x?.title?.en||'')}`;
  if(!EVENT_KINDS.includes(x?.kind))err(`${w}: kind must be one of ${EVENT_KINDS.join(', ')}`);
  if(!isLabel(x.title)||!x.title.en)err(`${w}: title.en required`);
  if(x.starts!==undefined&&!/^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(Z|[+-]\d\d:\d\d))?)?)?$/.test(x.starts))err(`${w}: starts must be an ISO date/time`);
  if(x.ends!==undefined&&!/^\d{4}(-\d\d(-\d\d(T\d\d:\d\d(:\d\d)?(Z|[+-]\d\d:\d\d))?)?)?$/.test(x.ends))err(`${w}: ends must be an ISO date/time`);
  if(!Array.isArray(x.entities)||!x.entities.length||x.entities.some((/** @type {string} */ id)=>!exists(id)))err(`${w}: entities must list known entity ids`);
  if(x.url!==undefined&&!isHttpURL(x.url))err(`${w}: url invalid`);
  if(x.region!==undefined&&!REGION.test(x.region))err(`${w}: region invalid`);
  ver(x.ver,w);src(x.src,w);
 }
 for(const a of doc.availability||[]){
  const w=`availability ${a?.entity}`;
  if(!exists(a?.entity))err(`${w}: unknown entity`);
  if(!AVAILABILITY_STATE.includes(a.state))err(`${w}: state must be one of ${AVAILABILITY_STATE.join(', ')}`);
  scope(a,w);ver(a.ver,w);src(a.src,w);
 }
 for(const c of doc.compatibility||[]){
  const w=`compatibility ${c?.subject}→${c?.target}`;
  if(!exists(c?.subject))err(`${w}: unknown subject`);
  if(!exists(c?.target))err(`${w}: unknown target`);
  if(!COMPAT_STATUS.includes(c.status))err(`${w}: status must be one of ${COMPAT_STATUS.join(', ')}`);
  if(c.env!==undefined&&!isObject(c.env))err(`${w}: env must be an object`);
  ver(c.ver,w);src(c.src,w);
 }
 return errors;
}
