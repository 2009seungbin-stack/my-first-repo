/** Anti-doorway / anti-thin gates for the page families of src/game-seo-families.js (Google's spam
 * policies on doorway pages and scaled content abuse): every family page must stand on its own.
 *
 *  (a) page-specific copy (lead, what, steps, its own FAQ, its table / comparison) above a minimum
 *      length per language;
 *  (b) overlap with every other game page (old or new) under the thresholds below — the thresholds
 *      are the most similar pair among the 64 pages that existed before the families
 *      (texture-map ↔ game/pixel-art-normal-map), so no new page may be closer to another page than
 *      the closest existing pair;
 *  (c) at least one page-specific element: a table of its own (engine settings, fields, a fix) or a
 *      head-to-head table with what the other tool does better, plus steps and FAQ answers that no
 *      other page has;
 *  (d) a deep link into the workspace that does the job, and 4–6 related pages that exist.
 * Plus SERP-length titles and descriptions per language, unique across every game page, and the
 * honesty rules (UNVERIFIED stays UNVERIFIED; no "AI" wording for heuristics).
 * `node --test tests/game-seo-quality.test.mjs` prints the numbers the report quotes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_INTENT_PAGES,GAME_LAB_PAGES,GAME_KEYWORD_PAGES,GAME_FAMILY_PAGES,FAMILIES,SHOTS,kindOf,isStudioKind} from '../src/game-seo.js';
import {INTENTS} from '../src/intents.js';
import {LANDINGS} from '../src/landings.js';
import {mayPromote} from '../src/capabilities.js';
import {gamePageFor,targetOf} from '../tools/game-landing-build.mjs';

const L=['en','ko','ja'];
const ALL=[...Object.entries(GAME_INTENT_PAGES),...Object.entries(GAME_LAB_PAGES),...Object.entries(GAME_KEYWORD_PAGES)];
const FAM=Object.entries(GAME_FAMILY_PAGES);
const cells=tb=>tb?[tb.title,tb.lead||'',tb.note||'',...tb.head,...tb.rows.flat()]:[];
/** The copy that belongs to this page alone (the common FAQ, chrome and export table are shared). */
export const ownText=c=>[c.lead,...c.what,...c.steps,...c.faq.flat(),...cells(c.table),...cells(c.compare),...(c.better||[])].join('\n');
export const GATES=Object.freeze({
 minLength:{en:1500,ko:800,ja:800},
 // Jaccard of character shingles (6 for English words, 3 for Korean/Japanese) and containment
 // (shared shingles ÷ the smaller page): the closest pair of the pre-family pages, rounded up.
 shingle:{en:6,ko:3,ja:3},
 maxJaccard:{en:0.30,ko:0.35,ja:0.31},
 maxContainment:{en:0.46,ko:0.55,ja:0.49},
 // What a results page shows without cutting (the build appends " · Nerulio").
 title:{en:[20,62],ko:[10,36],ja:[10,38]},
 description:{en:[100,165],ko:[45,110],ja:[45,120]}
});
const shingles=(s,n)=>{s=s.toLowerCase().replace(/\s+/g,' ');const set=new Set();for(let i=0;i+n<=s.length;i++)set.add(s.slice(i,i+n));return set;};
const inter=(a,b)=>{let i=0;const [x,y]=a.size<b.size?[a,b]:[b,a];for(const v of x)if(y.has(v))i++;return i;};
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];};
const stats={};

test('family pages exist, name a known family and are wired as keyword landings',()=>{
 assert(FAM.length>=30,`${FAM.length} family pages`);
 for(const [path,p] of FAM){
  assert(path.startsWith('game/')&&/^game\/[a-z0-9-]+$/.test(path),path);
  assert(FAMILIES[p.family],`${path}: family ${p.family}`);
  assert(LANDINGS[path]?.studio===p&&GAME_KEYWORD_PAGES[path]===p,`${path}: a keyword landing`);
  assert(INTENTS[p.intent]&&mayPromote(p.intent),`${path}: base intent ${p.intent} qualifies`);
  assert(SHOTS[p.shot]&&kindOf(p.ws),`${path}: shot and workspace`);
  assert.equal(gamePageFor(path)?.key,path);
 }
});

test('(a) every family page has page-specific copy above the minimum length in each language',()=>{
 for(const l of L){
  const lens=FAM.map(([k,p])=>[ownText(p.copy[l]).length,k]);
  for(const [n,k] of lens)assert(n>=GATES.minLength[l],`${l}/${k}: ${n} characters of its own copy (min ${GATES.minLength[l]})`);
  stats[l]={pages:lens.length,minLength:Math.min(...lens.map(x=>x[0])),medianLength:median(lens.map(x=>x[0]))};
 }
});

test('(b) no family page is closer to any other game page than the closest pre-family pair',()=>{
 for(const l of L){
  const n=GATES.shingle[l],sh=new Map(ALL.map(([k,p])=>[k,shingles(ownText(p.copy[l]),n)]));
  let worst={j:0},worstC={c:0};
  for(const [k] of FAM)for(const [o] of ALL){
   if(o===k)continue;
   const a=sh.get(k),b=sh.get(o),i=inter(a,b),j=i/(a.size+b.size-i),c=i/Math.min(a.size,b.size);
   assert(j<=GATES.maxJaccard[l],`${l}: ${k} ↔ ${o} Jaccard ${j.toFixed(3)} > ${GATES.maxJaccard[l]}`);
   assert(c<=GATES.maxContainment[l],`${l}: ${k} ↔ ${o} containment ${c.toFixed(3)} > ${GATES.maxContainment[l]}`);
   if(j>worst.j)worst={j,pair:`${k} ↔ ${o}`};if(c>worstC.c)worstC={c,pair:`${k} ↔ ${o}`};
  }
  Object.assign(stats[l]||(stats[l]={}),{maxJaccard:+worst.j.toFixed(3),maxJaccardPair:worst.pair,maxContainment:+worstC.c.toFixed(3),maxContainmentPair:worstC.pair});
 }
});

test('(c) every family page has its own table or head-to-head, steps and FAQ answers no other page has',()=>{
 const steps=new Map(),faqs=new Map();
 for(const [k,p] of ALL)for(const l of L){
  const c=p.copy[l];steps.set(`${l}|${c.steps.join('|')}`,[...(steps.get(`${l}|${c.steps.join('|')}`)||[]),k]);
  for(const [q,a] of c.faq){const key=`${l}|${q}`;faqs.set(key,[...(faqs.get(key)||[]),k]);const ka=`${l}|a|${a}`;faqs.set(ka,[...(faqs.get(ka)||[]),k]);}
 }
 for(const [k,p] of FAM)for(const l of L){
  const c=p.copy[l],en=p.copy.en;
  if(p.family==='compare'){
   assert(c.compare&&c.compare.rows.length>=5&&c.compare.head.length>=3&&c.compare.source,`${l}/${k}: a head-to-head table (5+ rows) with its source`);
   assert((c.better||[]).length>=2&&c.better.length===(en.better||[]).length,`${l}/${k}: at least two things the other tool does better`);
   assert(p.vs,`${k}: names the other tool`);
  }else assert(c.table&&c.table.rows.length>=3&&c.table.head.length>=2,`${l}/${k}: a table of its own (3+ rows)`);
  for(const tb of [c.table,c.compare].filter(Boolean)){
   assert(tb.rows.every(r=>r.length===tb.head.length),`${l}/${k}: every row has a cell per column`);
   const tEn=tb===c.table?en.table:en.compare;assert.equal(tb.rows.length,tEn.rows.length,`${l}/${k}: table rows parity with en`);
  }
  assert(c.what.length>=4&&c.steps.length>=4&&c.faq.length>=3,`${l}/${k}: 4+ features, 4+ steps, 3+ questions`);
  assert.equal(c.faq.length,en.faq.length,`${l}/${k}: FAQ parity with en`);
  assert.deepEqual(steps.get(`${l}|${c.steps.join('|')}`),[k],`${l}/${k}: steps shared with another page`);
  for(const [q,a] of c.faq){assert.deepEqual(faqs.get(`${l}|${q}`),[k],`${l}/${k}: question also on ${faqs.get(`${l}|${q}`)}: ${q}`);assert.deepEqual(faqs.get(`${l}|a|${a}`),[k],`${l}/${k}: answer shared`);}
 }
});

test('(d) the deep link opens the workspace that does the job, and 4–6 related pages exist',()=>{
 const want={sprite:'game/studio/?ws=sprite',pack:'game/studio/?ws=sprite',tile:'game/studio/?ws=tile',normalmap:'game/studio/?ws=texture',pixelart:'game/studio/?ws=pixel'};
 for(const [k,p] of FAM){
  const t=targetOf(gamePageFor(k));
  if(isStudioKind(p.ws)&&p.via){assert.equal(t.route,`game/studio/?ws=${p.via}`,k);assert.equal(`game/studio/?ws=${t.then}`,want[p.ws],`${k}: goes on to its own workspace`);}
  else if(isStudioKind(p.ws)){assert.equal(t.type,'studio',k);assert.equal(t.route,want[p.ws],k);if(p.ws==='pack')assert.equal(t.then,'pack',k);}
  else assert(t.type==='lab'&&/\/(app|classic)\/$/.test(t.route),`${k}: a Lab page opens its Lab`);
  const rel=p.related||[];
  assert(rel.length>=4&&rel.length<=6,`${k}: ${rel.length} related pages`);
  assert(new Set(rel).size===rel.length&&!rel.includes(k),`${k}: related pages unique, not itself`);
  for(const r of rel)assert(INTENTS[r]||LANDINGS[r],`${k}: related ${r} exists`);
 }
});

test('titles and descriptions fit the results page and are unique in each language',()=>{
 for(const l of L){
  const seen=new Map();
  for(const [k,p] of ALL){const c=p.copy[l];for(const v of [c.title,c.description]){assert(!seen.has(v),`${l}: ${k} repeats ${seen.get(v)}: ${v}`);seen.set(v,k);}}
  for(const [k,p] of FAM){
   const c=p.copy[l],[t0,t1]=GATES.title[l],[d0,d1]=GATES.description[l];
   assert(c.title.length>=t0&&c.title.length<=t1,`${l}/${k}: title ${c.title.length} chars: ${c.title}`);
   assert(c.description.length>=d0&&c.description.length<=d1,`${l}/${k}: description ${c.description.length} chars`);
   assert(c.lead.length>=(l==='en'?120:60),`${l}/${k}: lead`);
  }
 }
});

test('honesty: UNVERIFIED and partly verified targets say so, and no "AI" wording',()=>{
 for(const [k,p] of FAM)for(const l of L){
  const c=p.copy[l],all=[c.title,c.description,ownText(c)].join('\n');
  if(/GameMaker/.test(c.title+c.lead))assert(/UNVERIFIED|미검증|未検証/.test(all),`${l}/${k}: GameMaker output is UNVERIFIED in GameMaker`);
  if(/LDtk/.test(c.title))assert(/partly|일부|一部/.test(all),`${l}/${k}: LDtk is partly verified`);
  assert(!/(^|[^A-Za-z])AI([^A-Za-z]|$)|인공지능|人工知能/.test(all),`${l}/${k}: no "AI" wording`);
 }
});

test.after(()=>{console.log('seo-quality',JSON.stringify(stats));});
