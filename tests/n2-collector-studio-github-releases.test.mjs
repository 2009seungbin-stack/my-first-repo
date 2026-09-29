import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import adapter,{toEntity,compareVersions,REPOS,sourceId} from '../collectors/studio-github-releases/index.js';
import {runAdapter,collectorContext} from '../collectors/_runtime.js';
import {validateSeed} from '../platform/seed.js';

const fx=(/** @type {string} */ f)=>readFileSync(new URL(`./fixtures/n2/collectors/studio-github-releases/${f}`,import.meta.url),'utf8');
const GODOT=fx('godot.json'),OBS=fx('obs-studio.json'),SURGE=fx('surge-xt.json');
const KNOWN={entities:new Set(['app:godot','app:obs-studio','plugin:surge-synth-team-surge-xt'])};
const NOW=Date.UTC(2026,8,28,12);
const fakeFetch=(/** @type {(url:string)=>[string,number]} */ route)=>{const calls=[];const f=async(/** @type {string} */ url,/** @type {any} */ init)=>{calls.push({url,init});const [body,status]=route(url);return new Response(body,{status,headers:{'content-type':'application/json'}});};f.calls=calls;return f;};
const route=(/** @type {string} */ url)=>/** @type {[string,number]} */(url.includes('/godotengine/godot/')?[GODOT,200]:url.includes('/obsproject/obs-studio/')?[OBS,200]:url.includes('/surge-synthesizer/releases-xt/')?[SURGE,200]:['[]',404]);

test('adapter contract: auto mode, api.github.com only, polite', ()=>{
 assert.equal(adapter.id,'studio-github-releases');
 assert.equal(adapter.vertical,'studio');
 assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['api.github.com']);
 assert.ok(adapter.minIntervalMs>=1000);
 assert.deepEqual(Object.keys(REPOS).sort(),['godotengine/godot','obsproject/obs-studio','surge-synthesizer/releases-xt']);
});

test('compareVersions: numeric order, pre-releases sort below the release', ()=>{
 assert.ok(compareVersions('4.7.2','4.7.10')<0);
 assert.ok(compareVersions('32.2.0','32.2.0-rc2')>0);
 assert.ok(compareVersions('33.0.0-beta4','32.2.2')>0);
 assert.equal(compareVersions('4.7','4.7.0'),0);
});

test('Godot fixture: -stable tags normalised, highest stable is latest, 3.x kept as version', ()=>{
 const {source,entity}=toEntity('godotengine/godot',JSON.parse(GODOT),{retrieved:'2026-09-28'});
 assert.equal(entity.id,'app:godot');
 assert.equal(entity.facts[0].p,'latest_version');
 assert.equal(entity.facts[0].v,'4.7.2');
 assert.equal(entity.facts[0].ver,'OFFICIAL');
 assert.ok(entity.versions.some(v=>v.version==='3.6.3'));
 assert.ok(entity.versions.every(v=>!/stable/.test(v.version)&&v.channel==='stable'&&/^https:\/\/github\.com\/godotengine\/godot\/releases\//.test(v.notes_url||'')));
 assert.equal(source.id,sourceId('godotengine/godot'));
 assert.equal(source.kind,'OFFICIAL_API');
});

test('OBS fixture: betas/RCs are versions with channel prerelease but never latest_version', ()=>{
 const {entity}=toEntity('obsproject/obs-studio',JSON.parse(OBS),{retrieved:'2026-09-28'});
 assert.equal(entity.facts[0].v,'32.2.2');
 const beta=entity.versions.find(v=>v.version==='33.0.0-beta4');
 assert.equal(beta?.channel,'prerelease');
 assert.equal(entity.versions[0].version,'33.0.0-beta4');
 assert.equal(entity.versions.find(v=>v.version==='32.2.2')?.released,'2026-08-14');
});

test('malformed input: drafts and unknown tags skipped, bad URLs dropped, non-array rejected', ()=>{
 const logs=[];
 const {entity}=toEntity('obsproject/obs-studio',[
  {tag_name:'32.9.9',draft:true,prerelease:false,published_at:'2026-09-01T00:00:00Z',html_url:'https://github.com/obsproject/obs-studio/releases/tag/32.9.9'},
  {tag_name:'nightly-2026',draft:false,prerelease:false},
  {tag_name:'32.3.0',draft:false,prerelease:false,published_at:'not a date',html_url:'https://evil.example/x'},
 ],{retrieved:'2026-09-28',log:m=>logs.push(m)});
 assert.deepEqual(entity.versions,[{version:'32.3.0',channel:'stable',src:sourceId('obsproject/obs-studio')}]);
 assert.ok(logs.some(m=>/skip tag nightly/.test(m)));
 assert.throws(()=>toEntity('obsproject/obs-studio',{},{retrieved:'2026-09-28'}),/expected a JSON array/);
 const empty=toEntity('godotengine/godot',[],{retrieved:'2026-09-28'});
 assert.deepEqual(empty.entity.facts,[]);
});

test('collect() through the runtime: one request per repo, snapshots, valid partial seed', async()=>{
 const f=fakeFetch(route);
 const run=await runAdapter(adapter,{fetch:f,now:()=>NOW});
 assert.equal(run.error,null);
 assert.equal(f.calls.length,3);
 assert.ok(f.calls.every(c=>new URL(c.url).hostname==='api.github.com'));
 assert.equal(run.snapshots.length,3);
 assert.deepEqual(validateSeed(run.doc,KNOWN),[]);
 assert.deepEqual(run.doc.entities.map((/** @type {any} */ e)=>e.id),['app:godot','app:obs-studio','plugin:surge-synth-team-surge-xt']);
 assert.equal(run.doc.entities[2].facts[0].v,'1.3.4');
 assert.ok(run.doc.sources.every((/** @type {any} */ s)=>s.retrieved==='2026-09-28'&&s.adapter==='studio-github-releases'));
 assert.doesNotMatch(JSON.stringify(run.doc),/browser_download_url|\.exe"|\.dmg"/);
});

test('HTTP errors surface as run errors; foreign hosts are refused', async()=>{
 const run=await runAdapter(adapter,{fetch:fakeFetch(()=>['rate limited',403]),now:()=>NOW});
 assert.equal(run.doc,null);
 assert.match(run.error,/HTTP 403/);
 const ctx=collectorContext(adapter,{fetch:fakeFetch(route),now:()=>NOW});
 await assert.rejects(ctx.get('https://github.com/godotengine/godot/releases',{source:'x'}),/not allowlisted/);
});
