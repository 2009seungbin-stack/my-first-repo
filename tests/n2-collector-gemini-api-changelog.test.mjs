import test from 'node:test';
import assert from 'node:assert/strict';
import adapter,{SERVICE,parseChangelog,buildEvents} from '../collectors/gemini-api-changelog/index.js';
import {fixture,run,validate,seedEntityIds} from './fixtures/n2/collectors/_ai-helpers.mjs';

const URL_MD='https://aistudio.google.com/docs/changelog.md';

test('gemini-api-changelog: adapter contract',()=>{
 assert.equal(adapter.id,'gemini-api-changelog');assert.equal(adapter.vertical,'ai');assert.deepEqual(adapter.hosts,['aistudio.google.com']);
});

test('gemini-api-changelog: bold item titles spanning lines are joined',()=>{
 const e=parseChangelog(fixture('gemini-api-changelog','changelog.md.txt'));
 assert.equal(e[0].date,'2026-09-22');
 assert.equal(e[0].title,'Gemini 3.8 Flash TTS and Gemini 3.8 Flash-Lite TTS generally available (GA)');
});

test('gemini-api-changelog: migrated date anchors preserve entries and stable event keys',()=>{
 const old=fixture('gemini-api-changelog','changelog.md.txt');
 const migrated=old.replace(/^## (.+)$/gm,'## $1  {% id="test-date" %}');
 const before=parseChangelog(old),after=parseChangelog(migrated);
 assert.deepEqual(after,before);
 const now=Date.parse('2026-09-28T00:00:00Z');
 assert.deepEqual(buildEvents(after,[],now,'src:test'),buildEvents(before,[],now,'src:test'));
});

test('gemini-api-changelog: only recognized date headings activate a section; nested bullets stay within one event',()=>{
 const md=`> Untrusted document preface, not a dated item.
# Release notes
## September 22, 2026  {% id='09-22-2026' %}
* **Example release**: Released a model.
  * A nested detail with \`gemini-3.8-live\`.
## Documentation links {% id="links" %}
* This is not a dated event.
## September 23, 2026 {% other="invalid" %}
* An unrecognized suffix must not be treated as a date.
## September 24, 2026
- **Plain heading**: A second update.
`;
 const entries=parseChangelog(md);
 assert.equal(entries.length,2);
 assert.deepEqual(entries.map(e=>[e.date,e.title]),[['2026-09-22','Example release'],['2026-09-24','Plain heading']]);
 assert.match(entries[0].text,/nested detail/);
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

test('gemini-api-changelog: invalid or changed source content fails instead of advancing freshness',async()=>{
 const r=await run(adapter,{[URL_MD]:{body:'<html><h1>Sign in</h1></html>',type:'text/html'}});
 assert.match(r.error,/no dated entries parsed/);
 assert.equal(r.doc,null);
});
