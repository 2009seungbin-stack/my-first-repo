import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {parseEcb,krwPerUsd,storeRate} from '../tools/platform/fx.mjs';
import {approxKrw} from '../platform/render/format.js';
import {fxUsdKrw} from '../platform/db/channel.js';

const XML=`<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope><Cube><Cube time='2026-09-25'><Cube currency='USD' rate='1.1700'/><Cube currency='JPY' rate='172.10'/><Cube currency='KRW' rate='1638.00'/></Cube></Cube></gesmes:Envelope>`;

test('ECB table → KRW per USD (cross rate through the euro)',()=>{
 const t=parseEcb(XML);
 assert.equal(t.asOf,'2026-09-25');assert.equal(t.rates.KRW,1638);
 assert.equal(krwPerUsd(t),1400);
 assert.equal(krwPerUsd(parseEcb('<Cube time="2026-09-25"><Cube currency="USD" rate="1.1"/></Cube>')),null,'KRW missing');
});
test('≈ ₩ is a rounded approximation on Korean pages only',()=>{
 assert.equal(approxKrw(20,{rate:1400,asOf:'2026-09-25'},'ko'),'≈ ₩28,000');
 assert.equal(approxKrw(20,{rate:1400,asOf:'2026-09-25'},'en'),'');
 assert.equal(approxKrw(20,null,'ko'),'');
});
test('the stored rate is used for 10 days, then ignored',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated(),now=Date.parse('2026-09-28T00:00:00Z');
 assert.equal(await fxUsdKrw(db,now),null);
 await storeRate(db,{rate:1400,asOf:'2026-09-25'},now);
 assert.deepEqual(await fxUsdKrw(db,now+864e5),{rate:1400,asOf:'2026-09-25'});
 assert.equal(await fxUsdKrw(db,now+11*864e5),null,'stale rates are not shown');
});
