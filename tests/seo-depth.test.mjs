/** Intent content gates (docs/SEO-CONTENT-MODEL.md). Every indexable search page has intent
 * content of a declared type in en, ko and ja, with the sections that type needs, the same shape in
 * every language, working links, official sources, and no text reused across many pages.
 *
 *   node --test tests/seo-depth.test.mjs                        every page (the release gate)
 *   SEO_DEPTH_GROUP=sprite-engines node --test tests/seo-depth.test.mjs   one group's pages only
 *   SEO_DEPTH_PAGE=game/aseprite-to-godot node --test tests/seo-depth.test.mjs   one page */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUPS,DEPTH,TYPES,groupFile} from '../src/seo-depth/index.js';
import {plain,linksIn,DEPTH_ORDER} from '../src/seo-depth/render.js';
import {sitemapGroups} from '../tools/sitemaps.mjs';
import {resolveLink} from '../tools/game-landing-build.mjs';
import {entry} from '../tools/build.mjs';
import {POLICY_ROUTES} from '../src/policies.js';

const L=['en','ko','ja'],ONLY=process.env.SEO_DEPTH_GROUP||'';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),origin='https://nerulio.example.test/';
const groups=sitemapGroups(),INDEXABLE=[...groups.game,...groups.tools].filter(p=>p&&p!=='game'&&!POLICY_ROUTES.includes(p));
const PAGE=process.env.SEO_DEPTH_PAGE||'';
const PAGES=PAGE?[PAGE]:ONLY?GROUPS[ONLY]:INDEXABLE;
if(ONLY&&!PAGES)throw Error(`Unknown SEO_DEPTH_GROUP ${ONLY}; groups: ${Object.keys(GROUPS).join(', ')}`);
import {SOURCE_HOSTS} from '../src/seo-depth/sources.js';

/** Minimum entries per section and type (docs/SEO-CONTENT-MODEL.md, "Types"). `|` = one of. */
export const REQUIRED=Object.freeze({
 conversion:{answer:1,concept:1,example:1,mapping:4,outputs:2,target:4,verify:2,trouble:4,alternatives:2,versions:1},
 engine:{answer:1,concept:1,example:1,outputs:1,target:4,verify:1,trouble:4,alternatives:1,versions:1},
 troubleshoot:{answer:1,concept:1,trouble:4,verify:2,'example|mapping':1,versions:1},
 create:{answer:1,concept:1,example:1,'verify|target':1,trouble:3,alternatives:2},
 format:{answer:1,concept:1,'example|mapping':1,'outputs|target':1,trouble:3,versions:1},
 compare:{answer:1,concept:1,alternatives:2,limits:3,versions:1},
 tool:{answer:1,concept:1,example:1,verify:1,trouble:3,alternatives:1,limits:1}
});
/** Types whose `versions` must cite at least one official source (they describe another program). */
const NEEDS_SOURCE=new Set(['conversion','engine','troubleshoot','format','compare']);
const count=(d,id)=>{const b=d?.[id];if(!b)return 0;if(id==='answer')return b?1:0;if(Array.isArray(b))return b.length;
 if(b.rows)return b.rows.length;if(b.steps)return b.steps.length;if(b.items)return b.items.length;if(b.lines)return b.lines.length?1:0;if(b.body)return 1;return 0;};
/** Every string of a locale's content (for placeholders, repetition and language checks). */
export function strings(d){
 const out=[],walk=v=>{if(typeof v==='string')out.push(v);else if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
 walk(d);return out;
}
const ANSWER_MIN={en:200,ko:80,ja:80};
const PLACEHOLDER=/\b(TODO|TBD|FIXME|XXX|lorem ipsum)\b|\?\?\?|\{\{|\}\}|<[a-z]+[^>]*>/i;

test('every indexable search page belongs to exactly one intent group',()=>{
 const assigned=Object.values(GROUPS).flat();
 assert.deepEqual(assigned.filter((p,i)=>assigned.indexOf(p)!==i),[],'a page is in two groups');
 assert.deepEqual(INDEXABLE.filter(p=>!assigned.includes(p)),[],'indexable pages without a group');
 assert.deepEqual(assigned.filter(p=>!INDEXABLE.includes(p)),[],'grouped pages that are not indexable');
 if(PAGE)return;
 for(const [g,paths] of Object.entries(GROUPS))if(!ONLY||g===ONLY){
  const keys=Object.keys(groupFile[g]);
  assert.deepEqual(keys.filter(k=>!paths.includes(k)),[],`${g}.js defines pages it does not own`);
  assert.deepEqual(paths.filter(p=>!keys.includes(p)),[],`${g}.js is missing pages`);
 }
});
test('each page declares its type and search intent',()=>{
 for(const p of PAGES){
  const e=DEPTH[p];assert(e,`${p}: no intent content`);
  assert(TYPES.includes(e.type),`${p}: type ${e.type}`);
  for(const k of ['primary','goal','input','output','support'])assert(typeof e.intent?.[k]==='string'&&e.intent[k].length>3,`${p}: intent.${k}`);
  assert(['full','partial','none'].includes(e.intent.support),`${p}: intent.support`);
  assert(Array.isArray(e.intent.evidence),`${p}: intent.evidence (repo docs/tests the Nerulio claims rest on)`);
 }
});
test('each page has the sections its type needs, in every language, with the same shape',()=>{
 for(const p of PAGES){
  const e=DEPTH[p];if(!e)continue;const need=REQUIRED[e.type];
  for(const l of L){
   const d=e[l];assert(d,`${p}: no ${l}`);
   for(const [ids,min] of Object.entries(need)){
    const best=Math.max(...ids.split('|').map(id=>count(d,id)));
    assert(best>=min,`${p} [${l}]: ${ids} needs ≥ ${min}, has ${best}`);
   }
   assert(plain(d.answer).length>=ANSWER_MIN[l],`${p} [${l}]: answer shorter than ${ANSWER_MIN[l]} characters`);
   if(NEEDS_SOURCE.has(e.type))assert((d.versions?.sources||[]).length>=1,`${p} [${l}]: versions.sources needs an official source`);
   const known=new Set(['answer',...DEPTH_ORDER.map(([id])=>id)]);
   assert.deepEqual(Object.keys(d).filter(k=>!known.has(k)),[],`${p} [${l}]: unknown sections`);
   const arity={outputs:2,trouble:4,alternatives:2};
   for(const [id,n] of Object.entries(arity))for(const r of d[id]?.rows||[])assert.equal(r.length,n,`${p} [${l}]: ${id} row needs ${n} cells: ${r[0]}`);
   if(d.mapping)for(const r of d.mapping.rows)assert.equal(r.length,d.mapping.head.length,`${p} [${l}]: mapping row width`);
  }
  // Same shape in every language: the translations say the same things.
  for(const id of ['mapping','outputs','target','verify','trouble','alternatives','limits']){
   const n=L.map(l=>count(e[l],id));assert(n.every(x=>x===n[0]),`${p}: ${id} counts differ between languages ${n}`);
  }
  const lines=L.map(l=>e[l].example?.lines?.length||0);assert(lines.every(x=>x===lines[0]),`${p}: example.lines differ between languages ${lines}`);
 }
});
test('no placeholders, working internal links, official external sources',()=>{
 for(const p of PAGES){
  const e=DEPTH[p];if(!e)continue;
  for(const l of L){
   for(const s of strings(e[l])){
    assert(!PLACEHOLDER.test(s),`${p} [${l}]: placeholder or raw HTML: ${s.slice(0,80)}`);
    for(const k of linksIn(s)){assert(resolveLink(k)!==null,`${p} [${l}]: link to unknown page [[${k}]]`);assert(k!==p,`${p} [${l}]: links to itself`);}
    for(const m of s.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)){
     const u=new URL(m[1]);assert.equal(u.protocol,'https:',`${p}: ${m[1]}`);
     assert(SOURCE_HOSTS.has(u.host),`${p} [${l}]: ${u.host} is not an allowed official source (src/seo-depth/sources.js)`);
    }
   }
   for(const s of e[l].versions?.sources||[])assert(/^\[[^\]]+\]\(https:\/\/[^)\s]+\)/.test(s),`${p} [${l}]: a source must be a [label](https://…) link`);
  }
 }
});
test('Korean and Japanese are written in Korean and Japanese',()=>{
 for(const p of PAGES){
  const e=DEPTH[p];if(!e)continue;
  for(const [l,re] of [['ko',/[가-힣]/g],['ja',/[぀-ヿ一-鿿]/g]]){
   // Prose only: code spans, links' targets, example lines and table cells that are identifiers are left out.
   const prose=[e[l].answer,...(e[l].concept?.body||[]),...(e[l].trouble?.rows||[]).flatMap(r=>r.slice(1))].map(s=>plain(s).replace(/`[^`]*`/g,'')).join(' ');
   const native=(prose.match(re)||[]).length,latin=(prose.match(/[A-Za-z]/g)||[]).length;
   assert(native>latin*0.8,`${p} [${l}]: mostly Latin script (${native} native vs ${latin} Latin letters)`);
  }
 }
});
test('no long sentence is reused across many pages',()=>{
 for(const l of L){
  const seen=new Map();
  for(const p of PAGES){const e=DEPTH[p];if(!e)continue;for(const s of new Set(strings(e[l]).filter(x=>plain(x).length>=70)))(seen.get(s)||seen.set(s,[]).get(s)).push(p);}
  const reused=[...seen].filter(([,ps])=>ps.length>3);
  assert.deepEqual(reused.map(([s,ps])=>`${ps.length}× ${s.slice(0,70)}`),[],`[${l}] text repeated on more than 3 pages`);
 }
});
test('the built pages show the intent content in every language, and the HowTo includes the engine steps',()=>{
 for(const p of PAGES){
  const e=DEPTH[p];if(!e)continue;
  for(const l of L){
   const page=entry(html,`${l}/${p}`,origin,{});
   assert(page.includes('class="sd-answer"'),`${p} [${l}]: answer not rendered`);
   for(const id of Object.keys(e[l]).filter(k=>k!=='answer'&&k!=='limits'))assert(page.includes(`id="${id}"`),`${p} [${l}]: section #${id} not rendered`);
   if(e[l].target?.steps?.length&&p.startsWith('game/')||e[l].target?.steps?.length&&!p.includes('/')){
    const howto=[...page.matchAll(/<script data-site-seo type="application\/ld\+json">(.*?)<\/script>/g)].map(m=>JSON.parse(m[1])).find(x=>x['@type']==='HowTo');
    if(howto)assert(howto.step.some(s=>s.url?.endsWith('#target')),`${p} [${l}]: HowTo lacks the #target steps`);
   }
  }
 }
});
