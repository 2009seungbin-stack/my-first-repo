import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{PROVIDER,SERVICE_PATTERNS,parseUpdates} from '../collectors/claude-status/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const routes={'https://status.claude.com/history.atom':{body:fixture('claude-status','history.atom'),type:'application/atom+xml'}};

test('claude-status: adapter contract and robots-respecting endpoint',()=>{
 assert.equal(adapter.id,'claude-status');assert.equal(adapter.vertical,'ai');assert.equal(adapter.mode,'auto');
 assert.deepEqual(adapter.hosts,['status.claude.com']);
 assert.match(adapter.terms,/Disallow \/api\//);
});

test('claude-status: update timestamps get the year from the entry',()=>{
 const html="<p><small>Dec <var data-var='date'>31</var>, <var data-var='time'>23:50</var> UTC</small><br><strong>Investigating</strong> - a</p><p><small>Jan <var data-var='date'>1</var>, <var data-var='time'>00:20</var> UTC</small><br><strong>Resolved</strong> - b</p>";
 const u=parseUpdates(html,'2027-01-01T00:20:00Z');
 assert.deepEqual(u.map(x=>[x.at,x.status]),[['2026-12-31T23:50:00Z','Investigating'],['2027-01-01T00:20:00Z','Resolved']]);
});

test('claude-status: feed entries become valid events linked to models/services',async()=>{
 const r=await run(adapter,routes);
 assert.equal(r.error,null);
 assert.equal(r.calls.length,1);assert.equal(r.calls[0].url,'https://status.claude.com/history.atom');
 const doc=r.doc;assert.deepEqual(validate(doc),[]);
 assert.equal(doc.events.length,4);
 const first=doc.events[0];
 assert.equal(first.title.en,'Elevated errors for multiple models');
 assert.equal(first.starts,'2026-09-22T00:57:00Z');assert.equal(first.ends,'2026-09-22T02:35:00Z');
 assert.equal(first.status,'ended');assert.equal(first.kind,'other');
 assert.ok(first.entities.includes('model:claude-mythos-5-1'));
 assert.ok(first.entities.includes('model:claude-opus-5'));
 assert.ok(!first.entities.includes('model:claude-opus-5-5'),'Opus 5 must not match Opus 5.5');
 assert.deepEqual(doc.events.find(e=>/Google Play/.test(e.title.en)).entities,[PROVIDER]);
 assert.deepEqual(doc.events.find(e=>/Cowork/.test(e.title.en)).entities,['service:claude-cowork']);
 assert.equal(first.url,'https://status.claude.com/incidents/7g1qpkyz5gxh');
});

test('claude-status: HTTP failure is an adapter error',async()=>{
 const r=await run(adapter,{'https://status.claude.com/history.atom':{status:500,body:''}});
 assert.match(r.error,/HTTP 500/);
});

test('claude-status: mapped entity ids exist in the AI seed',()=>{
 const ids=seedEntityIds();if(!ids.size)return;
 for(const id of [PROVIDER,...SERVICE_PATTERNS.map(p=>p[1])])assert.ok(ids.has(id),`${id} missing from data/seed/ai`);
});
