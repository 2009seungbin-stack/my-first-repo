import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{SERVICE,parseReleaseNotes} from '../collectors/claude-release-notes/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const URL_MD='https://platform.claude.com/docs/en/release-notes/overview.md';

test('claude-release-notes: adapter contract',()=>{
 assert.equal(adapter.id,'claude-release-notes');assert.equal(adapter.vertical,'ai');assert.deepEqual(adapter.hosts,['platform.claude.com']);
});

test('claude-release-notes: one entry per bullet under a dated heading',()=>{
 const e=parseReleaseNotes(fixture('claude-release-notes','overview.md'));
 assert.equal(e[0].date,'2026-09-24');
 assert.equal(e.filter(x=>x.date==='2026-09-22').length,4);
 assert.ok(!e.some(x=>/^<Tip>/.test(x.text)),'front matter / tip blocks are not entries');
});

test('claude-release-notes: launch note links the launched model only',async()=>{
 const r=await run(adapter,{[URL_MD]:{body:fixture('claude-release-notes','overview.md'),type:'text/markdown'}});
 assert.equal(r.error,null);assert.deepEqual(validate(r.doc),[]);
 const launch=r.doc.events.find(e=>/launched \*?\*?Claude Opus 5\.5|launched Claude Opus 5\.5/.test(e.title.en));
 assert.ok(launch);assert.equal(launch.kind,'release');
 assert.deepEqual(launch.entities,['model:claude-opus-5-5']);
 const infra=r.doc.events.find(e=>/Cache diagnostics is out of beta/.test(e.title.en));
 assert.deepEqual(infra.entities,[SERVICE]);
});

test('claude-release-notes: fallback service exists in the AI seed',()=>{
 const ids=seedEntityIds();if(ids.size)assert.ok(ids.has(SERVICE));
});
