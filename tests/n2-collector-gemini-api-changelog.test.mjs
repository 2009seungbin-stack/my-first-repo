import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{SERVICE,parseChangelog} from '../collectors/gemini-api-changelog/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const URL_MD='https://ai.google.dev/gemini-api/docs/changelog.md.txt';

test('gemini-api-changelog: adapter contract',()=>{
 assert.equal(adapter.id,'gemini-api-changelog');assert.equal(adapter.vertical,'ai');assert.deepEqual(adapter.hosts,['ai.google.dev']);
});

test('gemini-api-changelog: bold item titles spanning lines are joined',()=>{
 const e=parseChangelog(fixture('gemini-api-changelog','changelog.md.txt'));
 assert.equal(e[0].date,'2026-09-22');
 assert.equal(e[0].title,'Gemini 3.8 Flash TTS and Gemini 3.8 Flash-Lite TTS generally available (GA)');
});

test('gemini-api-changelog: events link models by backticked model codes',async()=>{
 const r=await run(adapter,{[URL_MD]:{body:fixture('gemini-api-changelog','changelog.md.txt'),type:'text/markdown'}});
 assert.equal(r.error,null);assert.deepEqual(validate(r.doc),[]);
 const tts=r.doc.events[0];
 assert.equal(tts.kind,'release');assert.deepEqual(tts.entities,['model:gemini-3.8-flash-tts']);
 const live=r.doc.events.find(e=>/3\.8 Live/.test(e.title.en));
 assert.deepEqual(live.entities,['model:gemini-3.8-live']);
 const access=r.doc.events.find(e=>/2\.5 models access/.test(e.title.en));
 assert.deepEqual(access.entities,[SERVICE]);assert.equal(access.kind,'update');
});

test('gemini-api-changelog: fallback service exists in the AI seed',()=>{
 const ids=seedEntityIds();if(ids.size)assert.ok(ids.has(SERVICE));
});
