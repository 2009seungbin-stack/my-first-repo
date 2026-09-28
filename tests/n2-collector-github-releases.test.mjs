import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{REPOS,entityUpdate} from '../collectors/github-releases/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const API='https://api.github.com/repos/';
const routes=Object.fromEntries(REPOS.map(r=>[`${API}${r.repo}/releases?per_page=10`,{body:fixture('github-releases',r.repo.replace('/','_')+'.json'),type:'application/json'}]));

test('github-releases: adapter contract',()=>{
 assert.equal(adapter.id,'github-releases');assert.equal(adapter.vertical,'ai');assert.deepEqual(adapter.hosts,['api.github.com']);
});

test('github-releases: latest stable skips prereleases, except for llama.cpp builds',()=>{
 const ollama=entityUpdate(REPOS[1],JSON.parse(fixture('github-releases','ollama_ollama.json')));
 assert.equal(ollama.facts[0].v,'v0.34.4');
 assert.equal(ollama.versions.find(v=>v.version==='v0.40.0-rc0').channel,'prerelease');
 const llama=entityUpdate(REPOS[0],JSON.parse(fixture('github-releases','ggml-org_llama.cpp.json')));
 assert.equal(llama.facts[0].v,'b11229');assert.match(llama.facts[0].note,/pre-release/);
 assert.equal(llama.versions.length,5);
});

test('github-releases: keeps the newest stable when more than 5 prereleases follow it',()=>{
 const rel=[...Array(6)].map((_,i)=>({tag_name:`v2.0.0-rc${6-i}`,prerelease:true,draft:false,published_at:`2026-09-2${i}T00:00:00Z`,html_url:'https://github.com/x/y/releases/tag/rc'}));
 rel.push({tag_name:'v1.9.0',prerelease:false,draft:false,published_at:'2026-09-01T00:00:00Z',html_url:'https://github.com/x/y/releases/tag/v1.9.0'});
 rel.push({tag_name:'v3-draft',prerelease:false,draft:true,published_at:'2026-09-28T00:00:00Z',html_url:'https://github.com/x/y/releases/tag/d'});
 const u=entityUpdate({repo:'x/y',entity:'runtime:y',buildsArePrereleases:false},rel);
 assert.equal(u.facts[0].v,'v1.9.0');assert.equal(u.versions.length,6);assert.ok(!u.versions.some(v=>v.version==='v3-draft'));
});

test('github-releases: partial entity updates validate',async()=>{
 const r=await run(adapter,routes);
 assert.equal(r.error,null);assert.equal(r.calls.length,3);
 assert.deepEqual(validate(r.doc),[]);
 assert.deepEqual(r.doc.entities.map(e=>e.id),['runtime:llama-cpp','runtime:ollama','runtime:vllm']);
 assert.ok(r.doc.entities.every(e=>e.names===undefined&&e.slug===undefined),'collector never redefines entities');
 assert.ok(r.doc.sources.every(s=>s.kind==='OFFICIAL_API'&&s.adapter==='github-releases'));
});

test('github-releases: one failing repo is logged, all failing is an error',async()=>{
 const one={...routes};delete one[`${API}vllm-project/vllm/releases?per_page=10`];
 const r1=await run(adapter,one);assert.equal(r1.error,null);assert.equal(r1.doc.entities.length,2);
 const r2=await run(adapter,{});assert.match(r2.error,/no repository answered/);
});

test('github-releases: runtime ids exist in the AI seed',()=>{
 const ids=seedEntityIds();if(!ids.size)return;
 for(const r of REPOS)assert.ok(ids.has(r.entity),`${r.entity} missing`);
});
