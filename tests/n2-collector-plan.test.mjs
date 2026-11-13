import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plan,STATUS_SCHEDULE,STATUS_ADAPTERS} from '../tools/platform/collector-plan.mjs';
import {adapterIds,loadAdapter} from '../tools/platform/collect.mjs';

test('collector plan: status schedule, explicit list, everything automated otherwise',async()=>{
 assert.deepEqual(await plan({schedule:STATUS_SCHEDULE}),[...STATUS_ADAPTERS]);
 assert.deepEqual(await plan({adapters:'steam-news, claude-status'}),['steam-news','claude-status']);
 await assert.rejects(plan({adapters:'nope'}),/unknown adapters: nope/);
 const all=await plan({schedule:'17 */6 * * *'});
 assert.deepEqual(await plan({}),all);
 for(const id of adapterIds())assert.equal(all.includes(id),(await loadAdapter(id)).mode!=='manual',id);
 for(const id of STATUS_ADAPTERS)assert.ok(adapterIds().includes(id),id);
});

test('collectors workflow: the 30-minute cron is the one the planner treats as status-only',()=>{
 const yml=readFileSync(new URL('../.github/workflows/collectors.yml',import.meta.url),'utf8');
 assert.ok(yml.includes(`cron: '${STATUS_SCHEDULE}'`));
 assert.ok(yml.includes(`github.event.schedule != '${STATUS_SCHEDULE}'`),'status-only runs skip the six-hourly FX work');
 assert.ok(yml.includes(`if [ "$SCHEDULE" = '${STATUS_SCHEDULE}' ]; then post tick`),'admin freshness ticks use the active status schedule');
 assert.ok(!yml.includes('*/30 * * * *'),'no consumer retains the superseded on-the-hour cron');
 assert.match(yml,/matrix:\s*\n\s*adapter: \$\{\{ fromJSON\(needs\.plan\.outputs\.adapters\) \}\}/);
 assert.match(yml,/fail-fast: false/);
});
