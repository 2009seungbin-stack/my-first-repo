import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS,parsePrice,priceSummary,marketLinks} from '../src/hardware/market.js';
import {renderUsedPrices,renderPerformance} from '../platform/render/hardware-tools.js';
import {canonicalQuery,matchPlatformRoute,renderPlatformPage,renderSitemap} from '../server/platform/pages.js';
import DATA from '../data/hardware/blender.js';
import {D1Shim} from './d1-shim.mjs';

test('local prices: decimal/grouping precision, explicit foreign currencies and malformed inputs',()=>{
 for(const [country,input,expected] of [['KR','₩250,000원',250000],['JP','¥25,000',25000],['US','$1,234.50 USD',1234.5],['DE','1.234,50 EUR',1234.5],['FR','1\u202f234,50 €',1234.5],['FR','€1 234,50',1234.5],['CA','CA$123.45',123.45],['AU','A$123.45',123.45],['GB','£123.45',123.45]])assert.equal(parsePrice(input,country),expected,`${country} ${input}`);
 for(const value of ['0','-10','Infinity','NaN','100–200','RTX 4060 200','1,23','1.001','100\n200','€100','100 EUR'])assert.equal(parsePrice(value,'US'),null,value);
 assert.equal(parsePrice('100 USD','KR'),null);assert.equal(parsePrice('1.20','JP'),null);assert.equal(parsePrice('1,234.50','DE'),null);
});
test('price distribution retains outliers and duplicates; invalid lines reject the entire sample',()=>{
 const s=priceSummary('100\n100\n200\n300\n10000','US');assert.equal(s.count,5);assert.equal(s.median,200);assert.equal(s.q1,100);assert.equal(s.q3,300);assert.equal(s.max,10000);
 assert.equal(priceSummary('42','US').median,42);assert.equal(priceSummary('100\n200','US').median,150);
 assert.deepEqual(priceSummary('100\nno price\n200','US'),{error:'invalid',lines:[2]});
 assert.equal(priceSummary('','KR').error,'empty');assert.equal(priceSummary(Array(201).fill('100').join('\n'),'KR').error,'limit');
});
test('public marketplace searches encode input and distinguish asking/sold, without crossing currencies',()=>{
 for(const m of MARKETS){const links=marketLinks(m.id,'RTX 4060 & 8GB/#?');assert(links.length);for(const x of links){const u=new URL(x.url);assert.equal(u.protocol,'https:');assert(!u.hash);}}
 const [asking,sold]=marketLinks('GB','RTX 4060');assert.equal(new URL(asking.url).hostname,'www.ebay.co.uk');assert(!asking.url.includes('LH_Sold'));assert(sold.url.includes('LH_Sold=1'));
 assert.equal(marketLinks('JP','Ryzen 5600')[0].kind,'mixed');assert.equal(marketLinks('KR','')[0],undefined);
});
test('hardware page routing and canonical query guard cross-type reset and cache pollution',()=>{
 assert.equal(matchPlatformRoute('/ko/hardware/used-prices/').page,'used-prices');assert.equal(matchPlatformRoute('/en/hardware/performance/').page,'performance');
 assert.equal(canonicalQuery('used-prices',new URLSearchParams('country=DE&q=+RTX+4060+&tracking=x')),'?country=DE&q=RTX+4060');
 assert.equal(canonicalQuery('performance',new URLSearchParams('type=cpu&country=CA&a=63d8da86df4eb55f&b=a357ad27544ae337&reset=1')),'?type=cpu&country=CA');
 assert.equal(canonicalQuery('performance',new URLSearchParams('type=ram&country=XX&a=<script>')),'');
});
test('benchmark snapshot integrity: provenance, positive medians, no CPU/GPU conflation',()=>{
 assert.equal(DATA.version,'4.5.0');assert.equal(DATA.license,'CC0-1.0');assert.match(DATA.archiveSha256,/^[a-f0-9]{64}$/);
 assert.equal(new Set(DATA.devices.map(d=>d.id)).size,DATA.devices.length);
 for(const d of DATA.devices){assert(d.samples>=3);assert(Number.isFinite(d.score)&&d.score>0);assert.equal(d.type,d.backend==='CPU'?'cpu':'gpu');}
 const options={l:'ko',origin:'https://nerulio.com',channels:[],query:'',tool:'performance',q:new URLSearchParams('type=cpu')};const cpu=String(renderPerformance(options));
 assert(cpu.includes('AMD Ryzen 5 5600')&&cpu.includes('AMD Ryzen 5 7600'));assert(!cpu.includes('NVIDIA GeForce RTX 4060'));
 assert(cpu.includes('게임 FPS')&&cpu.includes(DATA.asOf)&&cpu.includes('중앙값'));
 const invalid=String(renderPerformance({...options,q:new URLSearchParams('type=cpu&a=63d8da86df4eb55f')}));assert(invalid.includes('측정 결과가 없습니다'));
 const used=String(renderUsedPrices({...options,tool:'used-prices',q:new URLSearchParams('country=KR&q=<img src=x onerror=alert(1)>')}));assert(!used.includes('<img src=x'));assert(used.includes('&lt;img'));
});
test('real Worker renderer and sitemap expose both utilities in both languages',async()=>{
 const db=D1Shim.migrated();
 for(const l of ['ko','en'])for(const tool of ['used-prices','performance']){
  const res=await renderPlatformPage(new Request(`https://nerulio.com/${l}/hardware/${tool}/`),{DB:db},{origin:'https://nerulio.com/'});assert.equal(res.status,200);
  const body=await res.text();assert(body.includes('nav-pc')&&body.includes('/src/platform/islands.js'));assert(!body.includes('https://nerulio.com//'));
 }
 const xml=await renderSitemap(db,'hardware','https://nerulio.com');assert(xml.includes('/ko/hardware/used-prices/')&&xml.includes('/en/hardware/performance/'));
 db.raw.close();
});
