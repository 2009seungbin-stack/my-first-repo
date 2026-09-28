/** SEO intent inventory: every indexable search page of the build, its family, declared intent and
 * type (src/seo-depth), which sections it shows, how much page-specific text it has per language,
 * what its type still misses, and the pages closest to it (possible cannibalization).
 *
 *   node tools/seo-inventory.mjs            → docs/SEO-INTENT-INVENTORY.json + .md
 *   node tools/seo-inventory.mjs --stdout   → JSON to stdout (nothing written)
 *
 * Source of truth: tools/sitemaps.mjs (what the sitemap lists), not a hand-kept list. */
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {sitemapGroups} from './sitemaps.mjs';
import {gamePageFor} from './game-landing-build.mjs';
import {LANDINGS,landingText} from '../src/landings.js';
import {INTENTS} from '../src/intents.js';
import {t,LOCALES} from '../src/i18n.js';
import {POLICY_ROUTES} from '../src/policies.js';
import {DEPTH,GROUPS} from '../src/seo-depth/index.js';
import {plain,DEPTH_ORDER} from '../src/seo-depth/render.js';
import {REQUIRED} from '../src/seo-depth/rules.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const walk=v=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(walk):v&&typeof v==='object'?Object.values(v).flatMap(walk):[];
const groupOf=p=>Object.entries(GROUPS).find(([,ps])=>ps.includes(p))?.[0]||'';
/** The copy a page had before intent content: lead/what/steps/FAQ/table (game) or intro (tool). */
function baseCopy(p,locale){
 const g=gamePageFor(p);
 if(g&&g.kind!=='hub'){const c=g.page.copy[locale];return {family:g.page.family||g.kind,ws:g.page.ws,parts:{lead:1,what:c.what.length,steps:c.steps.length,faq:c.faq.length,table:c.table?1:0,compare:c.compare?1:0},text:[c.lead,...c.what,...c.steps,...c.faq.flat(),...walk(c.table),...walk(c.compare),...(c.better||[])].join('\n')};}
 const land=landingText(p,locale),id=LANDINGS[p]?.intent||Object.keys(INTENTS).find(k=>INTENTS[k].path===p);
 return {family:'file-tool',ws:id,parts:{intro:land?.intro?.length||0},text:[land?.title,...(land?.intro||[]),t(`intent.${id}.description`,{},locale)].filter(Boolean).join('\n')};
}
const shingles=(s,n)=>{const x=s.toLowerCase().replace(/\s+/g,' ');const out=new Set();for(let i=0;i+n<=x.length;i++)out.add(x.slice(i,i+n));return out;};
const jaccard=(a,b)=>{let i=0;for(const x of a)if(b.has(x))i++;return i/(a.size+b.size-i||1);};
export function inventory(){
 const g=sitemapGroups(),pages=[...g.game,...g.tools].filter(p=>p&&p!=='game'&&!POLICY_ROUTES.includes(p));
 const rows=pages.map(p=>{
  const e=DEPTH[p],base=Object.fromEntries(LOCALES.map(l=>[l,baseCopy(p,l)]));
  const sections=e?Object.fromEntries(LOCALES.map(l=>[l,Object.keys(e[l]||{})])):null;
  const depthText=l=>e?.[l]?walk(e[l]).map(plain).join('\n'):'';
  const need=e?REQUIRED[e.type]:null;
  const missing=need?Object.keys(need).filter(ids=>!ids.split('|').some(id=>(e.en||{})[id])):['intent content'];
  return {route:p,locales:LOCALES,group:groupOf(p),family:base.en.family,workspace:base.en.ws,type:e?.type||null,intent:e?.intent||null,
   existing:base.en.parts,sections:sections?.en||[],
   chars:Object.fromEntries(LOCALES.map(l=>[l,{existing:base[l].text.length,intent:depthText(l).length}])),
   missing,_text:base.en.text+'\n'+depthText('en')};
 });
 // Closest pages by English text (character 6-shingles): the candidates for the cannibalization audit.
 const sh=rows.map(r=>shingles(r._text,6));
 for(let i=0;i<rows.length;i++){
  const near=rows.map((r,j)=>[r.route,i===j?0:jaccard(sh[i],sh[j])]).sort((a,b)=>b[1]-a[1]).slice(0,3);
  rows[i].closest=near.map(([route,s])=>({route,similarity:+s.toFixed(3)}));
 }
 for(const r of rows)delete r._text;
 const byType={},byGroup={};for(const r of rows){byType[r.type||'pending']=(byType[r.type||'pending']||0)+1;byGroup[r.group]=(byGroup[r.group]||0)+1;}
 return {generated:new Date().toISOString(),source:'tools/sitemaps.mjs sitemapGroups() — indexable game + tool pages, hub and policy pages excluded',pages:rows.length,urls:rows.length*LOCALES.length,byType,byGroup,rows};
}
function markdown(inv){
 const L=['# SEO intent inventory','',`Generated ${inv.generated} by \`node tools/seo-inventory.mjs\` from ${inv.source}.`,'',
  `**${inv.pages} pages × 3 languages = ${inv.urls} URLs.** Types: ${Object.entries(inv.byType).map(([k,v])=>`${k} ${v}`).join(', ')}.`,'',
  'Columns: page type and primary intent (src/seo-depth), the input → output the visitor has, the target, whether Nerulio supports it (full/partial/none), the intent sections shown, characters of page-specific text per language (existing copy + intent content), required sections still missing, and the closest other page by text (6-shingle Jaccard; see docs/SEO-CANNIBALIZATION-AUDIT.md).','',
  '| Page | Group | Type | Primary intent | Input → output | Target | Support | Intent sections | Chars en / ko / ja | Missing | Closest |','| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
 const cell=s=>String(s??'').replace(/\|/g,'\\|').replace(/\n/g,' ');
 for(const r of inv.rows){
  const i=r.intent||{},c=r.chars,tot=l=>c[l].existing+c[l].intent;
  L.push(`| \`${r.route}\` | ${r.group} | ${r.type||'—'} | ${cell(i.primary)} | ${cell(i.input)} → ${cell(i.output)} | ${cell(i.target)} | ${i.support||'—'} | ${r.sections.filter(s=>s!=='answer').join(', ')||'—'} | ${tot('en')} / ${tot('ko')} / ${tot('ja')} | ${r.missing.join(', ')||'—'} | \`${r.closest[0].route}\` ${r.closest[0].similarity} |`);
 }
 return L.join('\n')+'\n';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const inv=inventory();
 if(process.argv.includes('--stdout'))console.log(JSON.stringify(inv,null,1));
 else{writeFileSync(path.join(ROOT,'docs/SEO-INTENT-INVENTORY.json'),JSON.stringify(inv,null,1)+'\n');writeFileSync(path.join(ROOT,'docs/SEO-INTENT-INVENTORY.md'),markdown(inv));console.log(`${inv.pages} pages (${inv.urls} URLs):`,inv.byType);}
}
