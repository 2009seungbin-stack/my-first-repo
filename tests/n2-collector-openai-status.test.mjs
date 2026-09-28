import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{GROUP_ENTITY,PROVIDER,TITLE_PATTERNS,componentGroups,atomComponents} from '../collectors/openai-status/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const routes={
 'https://status.openai.com/api/v2/incidents.json':{body:fixture('openai-status','incidents.json'),type:'application/json'},
 'https://status.openai.com/feed.atom':{body:fixture('openai-status','feed.atom'),type:'application/atom+xml'},
 'https://status.openai.com/proxy/status.openai.com':{body:fixture('openai-status','widget.json'),type:'application/json'},
};

test('openai-status: adapter contract',()=>{
 assert.equal(adapter.id,'openai-status');assert.equal(adapter.vertical,'ai');assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['status.openai.com']);assert.ok(adapter.minIntervalMs>=1000);
});

test('openai-status: widget groups and atom components parse',()=>{
 const g=componentGroups(JSON.parse(fixture('openai-status','widget.json')));
 assert.equal(g.get('Responses'),'APIs');assert.equal(g.get('Conversations'),'ChatGPT');assert.equal(g.get('Codex Web'),'Codex');
 const c=atomComponents(fixture('openai-status','feed.atom'));
 assert.deepEqual(c.get('01M3DCNWMW57HYK8FJ5FBFPA39'),['Codex Web','CLI','VS Code extension','Codex API']);
});

test('openai-status: incidents become valid, linked events',async()=>{
 const r=await run(adapter,routes);
 assert.equal(r.error,null);
 assert.equal(r.calls.length,3);
 for(const c of r.calls)assert.match(c.init.headers['user-agent'],/NerulioCollector/);
 const doc=r.doc;
 assert.deepEqual(validate(doc),[]);
 assert.equal(doc.events.length,3);
 const codex=doc.events.find(e=>e.key==='openai-status:01M3DCNWMW57HYK8FJ5FBFPA39');
 assert.ok(codex);
 assert.deepEqual(codex.entities,['service:codex']);
 assert.equal(codex.kind,'other');assert.equal(codex.impact,'critical');assert.equal(codex.status,'ended');
 assert.equal(codex.starts,'2026-09-25T22:58:48Z');assert.equal(codex.ends,'2026-09-25T23:54:41Z');
 assert.equal(codex.url,'https://status.openai.com/incidents/01M3DCNWMW57HYK8FJ5FBFPA39');
 // model named in the incident title is linked
 const gpt6=doc.events.find(e=>/GPT-6 Astra Pro/.test(e.title.en));
 assert.ok(gpt6&&gpt6.entities.length>=1);
 for(const e of doc.events)assert.ok(!/\.\d{3}Z$/.test(e.starts),'no fractional seconds');
 assert.equal(doc.sources[0].adapter,'openai-status');
});

test('openai-status: works without the atom/widget documents (title patterns, else provider)',async()=>{
 const r=await run(adapter,{'https://status.openai.com/api/v2/incidents.json':routes['https://status.openai.com/api/v2/incidents.json']});
 assert.equal(r.error,null);
 assert.ok(r.doc.events.every(e=>e.entities.length>0));
 assert.deepEqual(r.doc.events.find(e=>/Issues with Codex/.test(e.title.en)).entities,['service:codex']);
 assert.ok(r.doc.events.some(e=>e.entities.includes(PROVIDER)));
});

test('openai-status: incidents.json failure is an adapter error',async()=>{
 const r=await run(adapter,{'https://status.openai.com/api/v2/incidents.json':{status:503,body:'x'}});
 assert.match(r.error,/HTTP 503/);
});

test('openai-status: mapped entity ids exist in the AI seed',()=>{
 const ids=seedEntityIds();if(!ids.size)return;
 for(const id of [...Object.values(GROUP_ENTITY),...TITLE_PATTERNS.map(p=>p[1]),PROVIDER])assert.ok(ids.has(id),`${id} missing from data/seed/ai`);
});

test('shared matcher: names match whole, never inside a longer version or a named variant',async()=>{
 const {entityMatcher}=await import('../collectors/_ai-shared/util.js');
 const m=entityMatcher([{id:'model:gpt-6-astra',type:'model',names:{en:'GPT-6 Astra'},aliases:[],facts:{api_model_id:'gpt-6-astra'}},{id:'model:claude-opus-5',type:'model',names:{en:'Claude Opus 5'},aliases:[],facts:{}}]);
 assert.deepEqual(m('Elevated errors on GPT-6 Astra for some users'),['model:gpt-6-astra']);
 assert.deepEqual(m('Elevated Error Rates on GPT-6 Astra Pro'),[]);
 assert.deepEqual(m('gpt-6-astra-pro is slow'),[]);
 assert.deepEqual(m('Claude Opus 5.5 errors'),[]);
 assert.deepEqual(m('Claude Opus 5 and Claude Opus 5.5'),['model:claude-opus-5']);
});
