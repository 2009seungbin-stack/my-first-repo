import test from 'node:test';
import assert from 'node:assert/strict';
import {ADAPTERS,loadDatabase} from '../src/preflight/adapters/index.js';
import {runPreflight} from '../src/preflight/core/engine.js';
import {markdownReport,escapeMarkdown,MARKDOWN_ROW_LIMIT} from '../src/preflight/core/report.js';
import {FILTERS,FILTER_ORDER,TILE_FILTER,matchesFilter,filterCounts} from '../src/preflight/core/filters.js';
import {snapshotRun,recordRun,listRuns,clearRuns,diffRuns,HISTORY_LIMIT,HISTORY_COMPONENT_LIMIT} from '../src/preflight/storage/history.js';
import {MESSAGES} from '../src/preflight/messages.js';
import {preflightPage} from '../tools/preflight-build.mjs';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v));},removeItem:k=>{m.delete(k);},map:m};};
const sample=async(target={})=>{
 const database=await loadDatabase('obs'),environment=structuredClone(database.sampleEnvironment);
 return runPreflight(environment,{...environment.target,...target},database,ADAPTERS.obs);
};

test('preflight filters: every status lands in exactly the documented filters',()=>{
 const statuses=['READY','UPDATE_REQUIRED','CAUTION','LEGACY','DEPRECATED','UNKNOWN','BLOCKED','NOT_APPLICABLE'];
 assert.deepEqual(Object.keys(FILTERS).sort(),[...FILTER_ORDER].sort());
 for(const s of statuses)assert.equal(matchesFilter(s,'all'),true);
 assert.deepEqual(statuses.filter(s=>matchesFilter(s,'problems')),['UPDATE_REQUIRED','CAUTION','LEGACY','DEPRECATED','UNKNOWN','BLOCKED']);
 assert.deepEqual(statuses.filter(s=>matchesFilter(s,'caution')),['CAUTION','LEGACY','DEPRECATED']);
 assert.deepEqual(statuses.filter(s=>matchesFilter(s,'blocked')),['BLOCKED']);
 assert.deepEqual(statuses.filter(s=>matchesFilter(s,'ready')),['READY']);
 assert.equal(matchesFilter('READY','nope'),false);
 for(const f of Object.values(TILE_FILTER))assert.ok(f in FILTERS);
});

test('preflight filters: counts match the scorecard of a real run',async()=>{
 const result=await sample(),counts=filterCounts(result.components);
 assert.equal(counts.all,result.components.length);
 assert.equal(counts.ready,result.counts.READY);
 assert.equal(counts.updates,result.counts.UPDATE_REQUIRED);
 assert.equal(counts.caution,result.counts.CAUTION+result.counts.LEGACY+result.counts.DEPRECATED);
 assert.equal(counts.unknown,result.counts.UNKNOWN);
 assert.equal(counts.blocked,result.counts.BLOCKED);
 assert.equal(counts.problems,counts.all-result.counts.READY-result.counts.NOT_APPLICABLE);
});

test('preflight markdown: escapes inventory text and keeps the sample label',async()=>{
 assert.equal(escapeMarkdown('a|b\n[x](y) <i>*_`'),'a\\|b \\[x\\](y) \\<i\\>\\*\\_\\`');
 const result=await sample();
 result.components[0].component.name='Evil | name\n# heading <script>';
 for(const locale of ['ko','en','ja']){
  const md=markdownReport(result,locale),lines=md.split('\n');
  assert.equal(lines[0],'# Nerulio Preflight — SAMPLE DATA');
  assert.ok(md.includes('**'+result.overallVerdict+'**'));
  assert.ok(md.includes('Evil \\| name # heading \\<script\\>'));
  assert.equal(lines.filter(l=>l.startsWith('# ')).length,1);
  const table=lines.filter(l=>l.startsWith('| '));
  assert.equal(table.length,result.components.length+2);
  for(const row of table)assert.equal(row.replaceAll('\\|','').split('|').length,8,row);
  assert.equal(lines.filter(l=>l.startsWith('- [ ] ')).length,result.recommendations.length);
  assert.ok(!/\]\((?!https:\/\/)/.test(md.replaceAll('\\](','')),'only https evidence links');
 }
});

test('preflight markdown: problems first, long inventories are truncated with a stated limit',async()=>{
 const result=await sample(),first=result.components.find(c=>c.status==='READY'),problem=result.components.find(c=>c.status!=='READY'&&c.status!=='NOT_APPLICABLE');
 const md=markdownReport(result,'en');
 assert.ok(md.indexOf('| '+escapeMarkdown(problem.component.name)+' |')<md.indexOf('| '+escapeMarkdown(first.component.name)+' |'));
 assert.ok(!md.includes('Export JSON for the full list'));
 const big={...result,components:Array.from({length:MARKDOWN_ROW_LIMIT+5},(_,i)=>({...first,component:{...first.component,id:'c'+i,name:'Row '+i}}))};
 const long=markdownReport(big,'en');
 assert.equal(long.split('\n').filter(l=>l.startsWith('| Row ')).length,MARKDOWN_ROW_LIMIT);
 assert.ok(long.includes('first '+MARKDOWN_ROW_LIMIT+' of '+(MARKDOWN_ROW_LIMIT+5)+' components'));
});

test('preflight history: records runs newest first, de-duplicates and caps the list',async()=>{
 const store=memory(),a=await sample({version:'33.0'}),b=await sample({version:'34.0'});
 assert.deepEqual(listRuns(store,'obs'),[]);
 assert.equal(recordRun(store,'obs',a).length,1);
 assert.equal(recordRun(store,'obs',{...a,generatedAt:'2026-11-15T10:00:00.000Z'}).length,1,'identical rerun refreshes the entry');
 assert.equal(listRuns(store,'obs')[0].at,'2026-11-15T10:00:00.000Z');
 const runs=recordRun(store,'obs',b);
 assert.equal(runs.length,2);assert.equal(runs[0].to,'34.0');assert.equal(runs[1].to,'33.0');assert.equal(runs[0].sample,true);
 assert.deepEqual(listRuns(store,'godot'),[],'history is per vertical');
 for(let i=0;i<HISTORY_LIMIT+4;i++)recordRun(store,'obs',{...a,environment:{...a.environment,name:'run '+i}});
 assert.equal(listRuns(store,'obs').length,HISTORY_LIMIT);
 assert.equal(listRuns(store,'obs')[0].name,'run '+(HISTORY_LIMIT+3));
 clearRuns(store,'obs');assert.deepEqual(listRuns(store,'obs'),[]);
});

test('preflight history: unreadable or foreign data reads as empty and is replaced by the next run',async()=>{
 const store=memory(),a=await sample();
 for(const bad of ['{nope','{"schemaVersion":2,"runs":[]}','{"schemaVersion":1,"runs":[{"at":1}]}','null']){
  store.setItem('nerulio.preflight.v1.history.obs',bad);assert.deepEqual(listRuns(store,'obs'),[]);
 }
 assert.equal(recordRun(store,'obs',a).length,1);
 const stored=JSON.parse(store.getItem('nerulio.preflight.v1.history.obs'));
 assert.equal(stored.schemaVersion,1);
 assert.ok(!JSON.stringify(stored).includes('installPath'),'only names, ids and statuses are kept');
});

test('preflight history: diffRuns reports status changes, added and removed components',async()=>{
 const a=await sample({version:'33.0'}),b=await sample({version:'34.0'});
 const older=snapshotRun(a),newer=snapshotRun(b),d=diffRuns(older,newer);
 const expected=a.components.filter((c,i)=>c.status!==b.components[i].status).length;
 assert.ok(expected>0);assert.equal(d.changes.length,expected);
 assert.equal(d.targetChanged,true);assert.equal(d.verdictChanged,a.overallVerdict!==b.overallVerdict);assert.equal(d.partial,false);
 assert.deepEqual(diffRuns(older,older),{changes:[],verdictChanged:false,targetChanged:false,partial:false});
 const fewer={...older,components:older.components.slice(1),total:older.total-1};
 assert.deepEqual(diffRuns(older,fewer).changes,[{id:older.components[0][0],name:older.components[0][1],before:older.components[0][2],after:null}]);
 assert.deepEqual(diffRuns(fewer,older).changes,[{id:older.components[0][0],name:older.components[0][1],before:null,after:older.components[0][2]}]);
 const first=a.components[0],huge=snapshotRun({...a,components:Array.from({length:HISTORY_COMPONENT_LIMIT+1},(_,i)=>({...first,component:{...first.component,id:'c'+i}}))});
 assert.equal(huge.components.length,HISTORY_COMPONENT_LIMIT);assert.equal(huge.total,HISTORY_COMPONENT_LIMIT+1);
 assert.equal(diffRuns(huge,huge).partial,true);
});

test('preflight page: new controls are rendered and translated in ko/en/ja',()=>{
 const keys=['startTitle','startStep1','startStep2','startStep3','startWhy','startSample','startPaste','startNote','startLoaded','stepDone','markdown','markdownCopied','markdownMore','tileFilter','keysHint','expandAll','collapseAll','history','historyHelp','historyEmpty','historyClear','historyCleared','historyRecorded','historyChanges','historyNoChanges','historyFirst','historyTarget','historyPartial','historyAdded','historyRemoved','historyMore'];
 for(const k of keys){assert.equal(MESSAGES[k]?.length,3,k);assert.equal(new Set(MESSAGES[k]).size,3,k+' must be translated');}
 for(const [locale,i] of [['ko',0],['en',1],['ja',2]]){
  const page=preflightPage({locale,path:'preflight/obs'});
  for(const id of ['pf-start','pf-start-sample','pf-start-paste','pf-copy-md','pf-history','pf-history-list','pf-history-clear','pf-expand-all','pf-collapse-all'])assert.ok(page.includes('id="'+id+'"'),id);
  for(const f of FILTER_ORDER){assert.ok(page.includes('data-filter="'+f+'"'),f);assert.ok(page.includes('data-filter-count="'+f+'"'),f);}
  assert.ok(page.includes(MESSAGES.markdown[i]));assert.ok(page.includes(MESSAGES.keysHint[i]));
  assert.ok(page.includes(MESSAGES.historyHelp[i].replace('{limit}',String(HISTORY_LIMIT)).replace('{components}',String(HISTORY_COMPONENT_LIMIT))));
  assert.ok(page.includes(MESSAGES.startNote[i].replace('{clear}',MESSAGES.clear[i])));
  assert.equal((page.match(/data-step="[123]"/g)||[]).length,3);
  assert.ok(!page.includes('{limit}')&&!page.includes('{components}')&&!page.includes('{clear}'));
 }
});

test('preflight report rows carry column labels for the stacked mobile layout',async()=>{
 const {tableHTML}=await import('../src/preflight/components/report-view.js');
 const saved=globalThis.document;globalThis.document={querySelector:()=>null};
 try{
  const result=await sample();
  for(const [locale,i] of [['ko',0],['en',1],['ja',2]]){
   const html=tableHTML(result.components,locale);
   for(const key of ['installed','recommended','status','confidence','reason'])
    assert.equal(html.split('<td data-label="'+MESSAGES[key][i]+'">').length-1,result.components.length,locale+' '+key);
  }
 }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
 const css=await (await import('node:fs/promises')).readFile(new URL('../src/preflight/preflight.css',import.meta.url),'utf8');
 assert.ok(css.includes('td[data-label]::before{content:attr(data-label)'));
});
