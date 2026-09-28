import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{SERVICE,parseChangelog} from '../collectors/openai-api-changelog/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const URL_MD='https://developers.openai.com/api/docs/changelog.md';

test('openai-api-changelog: adapter contract',()=>{
 assert.equal(adapter.id,'openai-api-changelog');assert.equal(adapter.vertical,'ai');assert.deepEqual(adapter.hosts,['developers.openai.com']);
});

test('openai-api-changelog: parses month/day headings and the tag line',()=>{
 const e=parseChangelog(fixture('openai-api-changelog','changelog.md'));
 assert.equal(e[0].date,'2026-09-25');
 assert.deepEqual(e[0].tags,['Fix','Model: gpt-6-sol','Model: gpt-6-luna']);
 assert.ok(e[1].body.startsWith('Released [GPT-6 Sol]'));
 assert.equal(e.filter(x=>x.date==='2026-09-10').length,3);
});

test('openai-api-changelog: events link models by Model: tags',async()=>{
 const r=await run(adapter,{[URL_MD]:{body:fixture('openai-api-changelog','changelog.md'),type:'text/markdown'}});
 assert.equal(r.error,null);assert.deepEqual(validate(r.doc),[]);
 const rel=r.doc.events.find(e=>e.starts==='2026-09-22');
 assert.equal(rel.kind,'release');
 assert.deepEqual(rel.entities.sort(),['model:gpt-6-luna','model:gpt-6-sol']);
 assert.equal(rel.url,'https://developers.openai.com/api/docs/changelog');
 const live=r.doc.events.find(e=>/GPT-Live 1/.test(e.title.en));
 assert.deepEqual(live.entities,[SERVICE]);assert.deepEqual(live.unmatched_models,['gpt-live-1']);
 assert.ok(r.doc.events.every(e=>e.title.en.length<=160));
});

test('openai-api-changelog: empty/changed format is an error, not an empty success',async()=>{
 const r=await run(adapter,{[URL_MD]:'# Changelog\n\nnothing here'});
 assert.match(r.error,/no dated entries/);
});

test('openai-api-changelog: fallback service exists in the AI seed',()=>{
 const ids=seedEntityIds();if(ids.size)assert.ok(ids.has(SERVICE));
});
