import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ADAPTERS,emptyEnvironment,loadDatabase} from '../src/preflight/adapters/index.js';
import {normalizeVersion,compareVersions,matchesRange} from '../src/preflight/core/versions.js';
import {runPreflight,compareTargets} from '../src/preflight/core/engine.js';
import {createCatalogIndex,parsePasteList,importEnvironment,validateEnvironment} from '../src/preflight/core/parser.js';
import {copySummary,exportJSON,exportCompatibilityReport} from '../src/preflight/core/report.js';
import {saveSetup,loadSetup,renameSetup,deleteSetup,listSetups} from '../src/preflight/storage/setups.js';
import {MESSAGES,reasonText} from '../src/preflight/messages.js';
import {PREFLIGHT_PATHS,preflightPage} from '../tools/preflight-build.mjs';
import {sitemapGroups,urlEntries} from '../tools/sitemaps.mjs';
import {entry,ALL_ROUTES} from '../tools/build.mjs';

const now=Date.parse('2026-10-05T12:00:00Z'),adapter=ADAPTERS.obs;
// Unit-test synthetic vendor statements are fixtures only, never shipped compatibility data.
const evidence={sourceType:'vendor',title:'Fixture vendor compatibility statement',url:'https://vendor.example.test/releases',
 checkedAt:'2026-10-05',quoteSummary:'Synthetic bounded test evidence.'};
const component=(id='a',options={})=>({id,name:id,category:'Plugin',critical:true,version:'1.2.0',...options});
const record=(id='a',options={})=>({id:'record-'+id,componentId:id,componentName:id,vendor:'Fixture',componentType:'Plugin',
 platform:['windows'],architecture:['x86_64'],host:'OBS Studio',hostVersionRange:'>=33 <34',componentVersionRange:'>=1 <2',
 compatibilityStatus:'READY',notes:'Fixture supports the bounded target.',dependencies:[],knownIssues:[],breakingChanges:[],
 evidence:[evidence],lastVerifiedAt:'2026-10-05',sample:false,...options});
const analyze=(components=[component()],records=[record()],target={},env={})=>{
 const environment={...emptyEnvironment('obs'),...env,components};
 return runPreflight(environment,{...environment.target,...target},{records,catalog:[]},adapter,{now});
};

test('all verified ready → READY with reasons and HIGH confidence; pure input',()=>{
 const c=[component()],r=[record()],before=JSON.stringify([c,r]),out=analyze(c,r);
 assert.equal(out.overallVerdict,'READY');assert.equal(out.confidence,'HIGH');assert(out.reasons.length);
 assert.equal(out.ruleIds[0],'verified-stack');assert.equal(JSON.stringify([c,r]),before);
});
test('one actionable update → CAUTION, minimum and recommended versions retained',()=>{
 const out=analyze([component('a',{version:'0.9'})],[record('a',{minimumVersion:'1.0',recommendedVersion:'1.2',requiredAction:'Update from the vendor installer.'})]);
 assert.equal(out.components[0].status,'UPDATE_REQUIRED');assert.equal(out.overallVerdict,'CAUTION');
 assert(out.recommendations.some(x=>x.kind==='evidence'));assert.equal(out.components[0].recommendedVersion,'1.2');
});
test('unknown IDs and unsupported targets are never inferred READY',()=>{
 assert.equal(analyze([component('not-known')]).components[0].status,'UNKNOWN');
 assert.equal(analyze(undefined,undefined,{version:'34'}).overallVerdict,'CAUTION');
 assert.equal(analyze(undefined,undefined,{version:'34'}).confidence,'LOW');
});

test('OS-upgrade adapter maps host by platform; Mac records never approve Windows',()=>{
 const environment={...emptyEnvironment('studio'),platform:'windows',host:{name:'Windows',version:'10'},components:[component()]};
 const target={version:'11',platform:'windows',architecture:'x86_64'};
 const mac=record('a',{host:'macOS',hostVersionRange:'>=10 <27',platform:['windows','macos']});
 const windows={...mac,id:'windows',host:'Windows'};
 assert.equal(runPreflight(environment,target,{records:[mac],catalog:[]},ADAPTERS.studio,{now}).components[0].status,'UNKNOWN');
 assert.equal(runPreflight(environment,target,{records:[windows],catalog:[]},ADAPTERS.studio,{now}).overallVerdict,'READY');
});

test('verified Rosetta-only native binary stays CAUTION instead of a false architecture blocker',()=>{
 const environment={...emptyEnvironment('studio'),components:[component('a',{native:true,architecture:'x86_64'})]};
 const target=environment.target;
 const r=record('a',{host:'macOS',hostVersionRange:'>=26 <27',platform:['macos'],architecture:['arm64'],requirements:{nativeMode:'rosetta'}});
 const out=runPreflight(environment,target,{records:[r],catalog:[]},ADAPTERS.studio,{now});
 assert.equal(out.components[0].status,'CAUTION');assert(out.components[0].reasons.some(r=>r.code==='rosetta'));
 assert.equal(out.overallVerdict,'CAUTION');
 assert.equal(runPreflight(environment,target,{records:[],catalog:[]},ADAPTERS.studio,{now}).components[0].status,'BLOCKED');
});
test('hard critical blocker outranks an unresolved break',()=>{
 const out=analyze([component(),component('b')],[record('a',{compatibilityStatus:'BLOCKED',hardBlocker:true}),record('b',{breakingChanges:[{id:'break',targetVersionRange:'>=33',description:'API removed.',evidence:[evidence]}]})]);
 assert.equal(out.overallVerdict,'BLOCKED');assert.equal(out.ruleIds[0],'critical-hard-blocker');
});
test('critical unresolved change → WAIT; published workaround → CAUTION',()=>{
 const change={id:'api',targetVersionRange:'>=33',description:'API removed.',evidence:[evidence]};
 assert.equal(analyze(undefined,[record('a',{breakingChanges:[change]})]).overallVerdict,'WAIT');
 assert.equal(analyze(undefined,[record('a',{breakingChanges:[{...change,resolution:'Use supported API.'}]})]).overallVerdict,'CAUTION');
});
test('missing breaking-change evidence cannot fabricate a BLOCKED conclusion',()=>{
 assert.equal(analyze(undefined,[record('a',{breakingChanges:[{id:'x',targetVersionRange:'>=33',description:'Unverified',evidence:[]}]})]).overallVerdict,'READY');
});
test('required dependency blocker propagates and recommendations order dependency first',()=>{
 const out=analyze([component('parent'),component('runtime',{critical:false})],
  [record('parent',{dependencies:[{componentId:'runtime'}]}),record('runtime',{compatibilityStatus:'BLOCKED',hardBlocker:true,requiredAction:'Replace runtime.'})]);
 assert.equal(out.components[0].status,'BLOCKED');assert.equal(out.overallVerdict,'BLOCKED');
 assert(out.components[0].reasons.some(r=>r.code==='dependencyStatus'));
 assert.equal(out.components[0].dependencyResults[0].status,'BLOCKED');
 assert.equal(out.recommendations.find(r=>r.componentId)?.componentId,'runtime');
});
test('missing, ignored and version-mismatched required dependencies block; optional dependencies do not',()=>{
 const dep={componentId:'runtime',versionRange:'>=2'};
 assert.equal(analyze(undefined,[record('a',{dependencies:[dep]})]).overallVerdict,'WAIT');
 const c=[component(),component('runtime',{version:'1.2',ignored:true})];
 assert.equal(analyze(c,[record('a',{dependencies:[dep]}),record('runtime')]).components[0].status,'BLOCKED');
 assert.equal(analyze([component(),component('runtime')],[record('a',{dependencies:[dep]}),record('runtime')]).components[0].status,'BLOCKED');
 assert.equal(analyze(undefined,[record('a',{dependencies:[{...dep,optional:true}]})]).overallVerdict,'READY');
});
test('legacy and deprecated statuses produce CAUTION',()=>{
 for(const status of ['LEGACY','DEPRECATED'])assert.equal(analyze(undefined,[record('a',{compatibilityStatus:status})]).overallVerdict,'CAUTION');
});
test('stale evidence remains visible and reduces confidence / verdict',()=>{
 const out=analyze(undefined,[record('a',{lastVerifiedAt:'2026-01-01'})]);
 assert.equal(out.components[0].stale,true);assert(out.components[0].ageDays>180);
 assert.equal(out.overallVerdict,'CAUTION');assert.equal(out.confidence,'LOW');
 assert(out.components[0].reasons.some(r=>r.code==='stale'));
});
test('stale dependency and low confidence propagate to the ready parent',()=>{
 const out=analyze([component('parent'),component('runtime')],[record('parent',{dependencies:[{componentId:'runtime'}]}),record('runtime',{lastVerifiedAt:'2026-01-01'})]);
 assert.equal(out.components[0].stale,true);assert.equal(out.components[0].confidence,'LOW');assert.equal(out.components[0].status,'CAUTION');
});
test('numeric, prerelease, LTS and common ranges compare correctly',()=>{
 assert.equal(compareVersions('4.10','4.9'),1);assert.equal(compareVersions('5.2 LTS','5.2.0'),0);
 assert.equal(compareVersions('33.0-beta4','33.0-beta3'),1);assert.equal(compareVersions('33.0-beta4','33.0'),-1);
 assert.equal(matchesRange('4.7','>=4.6 <4.8'),true);assert.equal(matchesRange('4.8','>=4.6 <4.8'),false);
 assert.equal(matchesRange('32.2','<=32.2'),true);assert.equal(matchesRange('33','exact 33'),true);
 assert.equal(matchesRange('5.2 LTS','=5.2 LTS'),true);
 assert.equal(matchesRange('4.7','^4.6'),true);assert.equal(matchesRange('4.7','~4.6'),false);
 assert.equal(matchesRange('4.7.2','4.7.x'),true);assert.equal(matchesRange('5','<4 || >=5'),true);
 assert.equal(matchesRange('33.0-beta4','>=33.0-beta1 <34'),true);
 assert.equal(matchesRange('33.0-beta4','>=32 <34'),false);
 assert.equal(matchesRange('unknown','*'),null);assert.equal(matchesRange('33','invalid'),null);
 assert.equal(normalizeVersion('nightly'),null);
});
test('beta target does not reuse stable records; even explicit beta support is CAUTION',()=>{
 assert.equal(analyze(undefined,undefined,{version:'33.0-beta4'}).components[0].status,'UNKNOWN');
 const out=analyze(undefined,[record('a',{hostVersionRange:'>=33.0-beta1 <34'})],{version:'33.0-beta4'});
 assert.equal(out.components[0].status,'READY');assert.equal(out.overallVerdict,'CAUTION');
});
test('missing target/current/installed version cannot claim readiness',()=>{
 assert.equal(analyze(undefined,undefined,{version:''}).overallVerdict,'CAUTION');
 assert.equal(analyze(undefined,undefined,{}, {host:{name:'OBS Studio',version:''}}).overallVerdict,'CAUTION');
 assert.equal(analyze([component('a',{version:undefined})],[record('a',{minimumVersion:'1'})]).components[0].status,'UNKNOWN');
 assert.equal(analyze([]).overallVerdict,'CAUTION');
});
test('cyclic dependencies are bounded; unknown and blockers propagate around the cycle',()=>{
 const c=[component('a'),component('b')],r=[record('a',{dependencies:[{componentId:'b'}]}),record('b',{dependencies:[{componentId:'a'}]})];
 assert.equal(analyze(c,r).overallVerdict,'READY');
 const out=analyze(c,[r[0],{...r[1],compatibilityStatus:'BLOCKED',hardBlocker:true}]);
 assert.equal(out.overallVerdict,'BLOCKED');assert(out.components.every(c=>c.status==='BLOCKED'));
 assert.equal(analyze(c,[r[0]]).components[0].status,'UNKNOWN');
});
test('hard flags propagate even through nodes already marked BLOCKED',()=>{
 const out=analyze([component('a'),component('b'),component('c')],[
  record('a',{compatibilityStatus:'BLOCKED',dependencies:[{componentId:'b'}]}),
  record('b',{compatibilityStatus:'BLOCKED',dependencies:[{componentId:'c'}]}),
  record('c',{compatibilityStatus:'BLOCKED',hardBlocker:true})]);
 assert(out.components.every(c=>c.hardBlocker));assert.equal(out.overallVerdict,'BLOCKED');
});
test('different OS/architecture scopes become UNKNOWN; definite native inventory mismatch blocks',()=>{
 assert.equal(analyze(undefined,undefined,{platform:'macos'}).components[0].status,'UNKNOWN');
 assert.equal(analyze(undefined,undefined,{architecture:'arm64'}).components[0].status,'UNKNOWN');
 assert.equal(analyze([component('a',{native:true,architecture:'x86_64'})],undefined,{architecture:'arm64'}).overallVerdict,'BLOCKED');
 assert.equal(analyze([component('a',{platform:'macos'})]).overallVerdict,'BLOCKED');
});
test('renderer, language, OS, runtime, formats and native mode are common requirements',()=>{
 assert.equal(analyze(undefined,[record('a',{requirements:{renderer:['mobile']}})],{renderer:'forward_plus'}).components[0].status,'BLOCKED');
 assert.equal(analyze(undefined,[record('a',{requirements:{runtimes:{Python:'>=3.13'}}})]).components[0].status,'UNKNOWN');
 assert.equal(analyze(undefined,[record('a',{requirements:{runtimes:{Python:'>=3.13'}}})],{runtimes:{Python:'3.10'}}).components[0].status,'BLOCKED');
 assert.equal(analyze(undefined,[record('a',{requirements:{os:'>=15'}})],{osVersion:'14'}).components[0].status,'BLOCKED');
 assert.equal(analyze(undefined,[record('a',{requirements:{formats:['AU']}})],{formats:['VST3']}).components[0].status,'BLOCKED');
 const rosetta=record('a',{platform:['macos'],architecture:['universal'],requirements:{nativeMode:'rosetta'}});
 assert.equal(analyze(undefined,[rosetta],{platform:'macos',architecture:'arm64'}).components[0].status,'CAUTION');
 assert.equal(analyze(undefined,[{...rosetta,requirements:{nativeMode:'intel'}}],{platform:'macos',architecture:'arm64'}).overallVerdict,'BLOCKED');
});
test('ordinary community / inference / missing / future evidence cannot establish READY',()=>{
 for(const ev of [[],[{...evidence,sourceType:'inference'}],[{...evidence,sourceType:'community'}],[{...evidence,url:'javascript:alert(1)'}],[{...evidence,checkedAt:'2027-01-01'}]])
  assert.equal(analyze(undefined,[record('a',{evidence:ev})]).components[0].status,'UNKNOWN');
 const repository=analyze(undefined,[record('a',{evidence:[{...evidence,sourceType:'repository'}]})]);
 assert.equal(repository.confidence,'MEDIUM');
});
test('conflicting scoped records yield UNKNOWN rather than choosing convenient green',()=>{
 assert.equal(analyze(undefined,[record(),record('a',{id:'conflict',compatibilityStatus:'BLOCKED'})]).components[0].status,'UNKNOWN');
});
test('target comparison includes component status and changed reasons',()=>{
 const before=analyze(),after=analyze(undefined,[record(),record('a',{id:'next',hostVersionRange:'>=34 <35',compatibilityStatus:'BLOCKED',hardBlocker:true})],{version:'34'});
 const diff=compareTargets(before,after);assert.equal(diff.before,'READY');assert.equal(diff.after,'BLOCKED');
 assert.equal(diff.changes[0].before,'READY');assert.equal(diff.changes[0].after,'BLOCKED');
});
test('excluding a problem is never permission to return READY',()=>{
 const out=analyze([component(),component('b',{ignored:true})]);
 assert.equal(out.overallVerdict,'CAUTION');assert.equal(out.excluded,1);
 assert.equal(out.components[1].status,'UNKNOWN');assert.equal(out.confidence,'LOW');
});
test('OBS real path observation scopes: 33 legacy, documented Program Files 34 blocked, no invented cutoff elsewhere',()=>{
 const path='C:\\Program Files\\obs-studio\\plugins\\test\\bin\\64bit\\test.dll';
 const make=(installPath,version,platform='windows')=>analyze([component('unknown',{installPath})],[],{version,platform});
 assert(make(path,'33').components[0].reasons.some(r=>r.code==='obsLegacy'));
 assert.equal(make(path,'34').overallVerdict,'BLOCKED');
 assert.equal(make('C:\\ProgramData\\obs-studio\\plugins\\test\\bin\\64bit\\test.dll','34').components[0].status,'UNKNOWN');
 assert(!make(path,'33','macos').components[0].reasons.some(r=>r.code==='obsLegacy'));
 assert.equal(make('C:\\Program Files\\obs-studio\\obs-plugins\\64bit\\test.dll','34').components[0].status,'UNKNOWN');
 assert.equal(analyze([component('unknown',{builtForHost:'34'})],[],{version:'33'}).overallVerdict,'BLOCKED');
});
test('all four fictional samples are segregated; each has 16 components and varied statuses',async()=>{
 for(const vertical of Object.keys(ADAPTERS)){
  const db=await loadDatabase(vertical),env=db.sampleEnvironment,out=runPreflight(env,env.target,db,ADAPTERS[vertical],{now});
  assert.equal(env.components.length,16);assert(out.sample);assert.equal(out.confidence,'LOW');
  for(const s of ['READY','UPDATE_REQUIRED','UNKNOWN','LEGACY','BLOCKED'])assert(out.counts[s]>0,vertical+' '+s);
  const real=emptyEnvironment(vertical);real.components=[component(db.catalog.find(c=>!c.sample).id)];
  assert.equal(runPreflight(real,real.target,db,ADAPTERS[vertical],{now}).components[0].status,'UNKNOWN');
 }
 const obs=await loadDatabase('obs');
 assert.equal(runPreflight(obs.sampleEnvironment,obs.sampleEnvironment.target,obs,ADAPTERS.obs,{now}).overallVerdict,'CAUTION');
 const studio=await loadDatabase('studio');assert.equal(runPreflight(studio.sampleEnvironment,studio.sampleEnvironment.target,studio,ADAPTERS.studio,{now}).overallVerdict,'BLOCKED');
});
test('OBS real minimum-host record does not extrapolate support for later releases',async()=>{
 const db=await loadDatabase('obs'),env=emptyEnvironment('obs');env.components=[component('move-transition',{version:'3.2.0'})];
 assert.equal(runPreflight(env,{...env.target,version:'31.0'},db,ADAPTERS.obs,{now}).overallVerdict,'BLOCKED');
 assert.equal(runPreflight(env,{...env.target,version:'33'},db,ADAPTERS.obs,{now}).components[0].status,'UNKNOWN');
});
test('built-in OBS websocket record never approves an unknown standalone binary',async()=>{
 const db=await loadDatabase('obs'),env=emptyEnvironment('obs');env.components=[component('obs-websocket',{installType:'builtin'})];
 assert.equal(runPreflight(env,env.target,db,ADAPTERS.obs,{now}).overallVerdict,'READY');
 env.components[0].installType='unknown';
 assert.equal(runPreflight(env,env.target,db,ADAPTERS.obs,{now}).components[0].status,'UNKNOWN');
});
test('maximum tested version and DAW requirements are explicit constraints',()=>{
 assert.equal(analyze(undefined,[record('a',{maximumTestedVersion:'32'})]).components[0].status,'UNKNOWN');
 assert.equal(analyze(undefined,[record('a',{requirements:{daw:['Logic Pro']}})],{daw:'REAPER'}).components[0].status,'BLOCKED');
});
test('a 10,000-node dependency chain terminates without recursion or transitive source explosion',()=>{
 const components=Array.from({length:10000},(_,i)=>component('chain-'+i,{dependencies:i<9999?[{componentId:'chain-'+(i+1)}]:[]}));
 const records=components.map(c=>record(c.id,{evidence:[{...evidence,title:c.id}]}));
 const out=analyze(components,records);
 assert.equal(out.overallVerdict,'READY');assert(out.components.every(c=>c.evidence.length<=2));
});
test('paste aliases, versions, deduplication and scanner/report imports work transactionally',async()=>{
 const db=await loadDatabase('obs'),index=createCatalogIndex(db.catalog);
 const list=parsePasteList('Move @ 3.2.0\n- StreamFX\nMove Transition @ 3.2.0\nCustom filter v1.2',index);
 assert.equal(list.length,3);assert.equal(list[0].id,'move-transition');assert.equal(list[2].version,'1.2');
 assert(index.query('exeldro transition').some(c=>c.id==='move-transition'));
 const env=emptyEnvironment('obs');env.components=list;
 assert.deepEqual(importEnvironment(JSON.stringify(env),'obs').components.map(c=>c.id),list.map(c=>c.id));
 assert.throws(()=>importEnvironment(JSON.stringify({...env,schemaVersion:2})));
 assert.throws(()=>importEnvironment(JSON.stringify(env),'godot'));
 assert.throws(()=>validateEnvironment({...env,components:[component(),component()]}));
 assert.throws(()=>importEnvironment(' '.repeat(5*1024*1024+1)));
 const out=analyze();assert.equal(importEnvironment(exportJSON(out)).vertical,'obs');
 const fake={...env,report:{overallVerdict:'READY'},components:[{...component(),status:'READY',evidence:[evidence]}]};
 assert.equal(validateEnvironment(fake).components[0].status,undefined);
});
test('report export escapes hostile input, retains provenance and evidence and can be reimported',()=>{
 const out=analyze([component('a',{name:'<img src=x onerror=alert(1)>'})]);
 const h=exportCompatibilityReport(out);
 assert(!h.includes('<img src=x'));assert(h.includes('&lt;img'));assert(h.includes(evidence.url));
 assert(copySummary(out).includes('READY'));assert.equal(importEnvironment(exportJSON(out)).components[0].name,out.components[0].component.name);
});
test('separate versioned saves support rename/load/delete and quota rollback',()=>{
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const env=emptyEnvironment('obs');saveSetup(store,env,'one');saveSetup(store,{...env,name:'second'},'two');
 assert.equal(listSetups(store).length,2);renameSetup(store,'one','Renamed');assert.equal(loadSetup(store,'one').name,'Renamed');
 deleteSetup(store,'two');assert.equal(listSetups(store).length,1);
 const quota={...store,setItem:(k,v)=>{if(k.endsWith('index'))throw Error('quota');data.set(k,v);}};
 assert.throws(()=>saveSetup(quota,env,'three'));assert(!data.has('nerulio.preflight.v1.setup.three'));
 assert.equal(loadSetup(store,'one').name,'Renamed');
});
test('10,000-item independent inventory resolves without recursion or DOM',()=>{
 const components=Array.from({length:10000},(_,i)=>component('custom-'+i));
 const out=analyze(components,[]);assert.equal(out.components.length,10000);assert.equal(out.counts.UNKNOWN,10000);
 assert.throws(()=>analyze([...components,component('extra')],[]));
});
test('all stable reason codes and UI strings have all three translations',()=>{
 for(const [key,translations] of Object.entries(MESSAGES)){assert.equal(translations.length,3);assert(translations.every(Boolean),key);}
 for(const r of analyze().reasons)assert(!reasonText('ko',r).startsWith('reason.'));
});
test('15 localized pages and aliases are static, indexable, meaningful and have matching SEO',async()=>{
 const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
 for(const path of PREFLIGHT_PATHS){
  assert(ALL_ROUTES.includes(path));assert(sitemapGroups().tools.includes(path));
  for(const l of ['ko','en','ja']){
   assert(ALL_ROUTES.includes(l+'/'+path));
   const out=entry(source,l+'/'+path,'https://nerulio.com/');
   assert(out.includes('<html lang="'+l+'"'));assert.equal((out.match(/rel="canonical"/g)||[]).length,1);
   assert(out.includes('href="https://nerulio.com/'+l+'/'+path+'/"'));
   assert(out.includes('application/ld+json'));assert(!out.includes('name="robots" content="noindex'));
   assert(out.includes('src/platform/n2.css'));assert(out.includes('pf-explain'));
   assert(!out.includes('/src/platform/islands.js')&&!out.includes('data-island="account"'));
   assert(!out.includes('href="/ja/tools/"'));
   if(path!=='preflight')assert(out.includes('pf-environment')&&out.includes('src/preflight/app.js'));
  }
 }
 assert(preflightPage({path:'preflight/obs',preview:true}).includes('noindex'));
 assert(urlEntries(PREFLIGHT_PATHS,'https://nerulio.com/').includes('https://nerulio.com/ja/preflight/godot/'));
});
