import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS} from '../src/hardware/market.js';
import {hardwareQuery,comparableTitle,normalizeEbayItems,marketSnapshot,resetMarketCache} from '../server/platform/hardware-market.js';
import {renderUsedPrices} from '../platform/render/hardware-tools.js';
const env={EBAY_APP_ID:'fixture-app',EBAY_CERT_ID:'fixture-cert',EBAY_BROWSE_APPROVED:'on',RATE_LIMITER:{limit:async()=>({success:true})}};
const request=(country='US',q='RTX 4060')=>new Request(`https://nerulio.com/ko/hardware/used-prices/?country=${country}&q=${encodeURIComponent(q)}`,{headers:{'CF-Connecting-IP':'192.0.2.1'}});
const item=(id,price=200,extra={})=>({itemId:id,title:'MSI GeForce RTX 4060 8GB graphics card',itemWebUrl:`https://www.ebay.com/itm/${id}`,price:{value:String(price),currency:'USD'},itemLocation:{country:'US'},conditionId:'3000',buyingOptions:['FIXED_PRICE'],...extra});
const response=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
function provider(items){const calls=[];const get=async(url,options)=>{calls.push({url,options});return url.includes('/oauth2/')?response({access_token:'fixture-token',expires_in:7200}):response({total:items.length,itemSummaries:items});};return {calls,get};}

test('hardware titles: exact model, variants, capacity and non-part listings',()=>{
 for(const q of ['RTX 4060','GTX 1060','RX 6600 XT','Arc A770','Ryzen 5 5600','Ryzen 7 7800X3D','i5-12400F','Core Ultra 7 265K'])assert(hardwareQuery(q),q);
 for(const q of ['shoes','RTX 406000','<RTX 4060>','RTX 4060\0','x'.repeat(81)])assert(!hardwareQuery(q),q);
 for(const [title,q] of [['MSI RTX 4060 graphics card 8GB','RTX 4060 8GB'],['AMD Ryzen 5 5600 CPU','Ryzen 5600'],['AMD Radeon RX 6600 XT GPU','RX 6600 XT'],['Intel Core i5-12400F processor','i5-12400F']])assert(comparableTitle(title,q),title);
 for(const title of ['RTX 4060 Ti 8GB','RTX 4060 Super 8GB','RTX 40600 GPU','RTX 4060 laptop','RTX 4060 gaming PC','RTX 4060 for parts','RTX 4060 box only','RTX 4060 sealed','RTX 4060 wanted'])assert(!comparableTitle(title,'RTX 4060'),title);
 assert(!comparableTitle('Ryzen 5 5600X CPU','Ryzen 5 5600'));
 assert(!comparableTitle('Intel i5-12400F CPU','i5-12400'));
 assert(!comparableTitle('RTX 3060 8GB','RTX 3060 12GB'));
});
test('eBay normalization rejects unsafe URLs, wrong currencies/countries/conditions, auctions, duplicates and malformed money',()=>{
 const bad=[{itemWebUrl:'https://evil.test/itm/123'},{itemWebUrl:'javascript:alert(1)'},{itemWebUrl:'https://www.ebay.com@example.com/itm/123'},{itemWebUrl:'https://www.ebay.com/evil'},{price:{value:'200',currency:'EUR'}},{price:{value:'1,234',currency:'USD'}},{price:{value:'0',currency:'USD'}},{price:{value:'1e9',currency:'USD'}},{itemLocation:{country:'CA'}},{conditionId:'7000'},{buyingOptions:['AUCTION']},{title:'RTX 4060 desktop'},{title:'RTX 4060 Ti'}];
 const normalized=normalizeEbayItems({itemSummaries:[item('1'),item('1'),...bad.map((x,i)=>item(String(i+2),200,x))]},'US','RTX 4060');
 assert.equal(normalized.items.length,1);assert.equal(normalized.excluded,14);assert.equal(normalized.items[0].shipping,null);
 assert.throws(()=>normalizeEbayItems({bad:[]},'US','RTX 4060'));
});
test('missing credentials/approval, regional sources and bad queries never call an external service',async()=>{
 resetMarketCache();const get=()=>{throw new Error('must not fetch');};
 for(const opts of [{},{...env,EBAY_CERT_ID:''},{...env,EBAY_BROWSE_APPROVED:'off'}])assert.equal((await marketSnapshot(request(),opts,{fetch:get})).status,'not_connected');
 for(const c of ['KR','JP'])assert.equal((await marketSnapshot(request(c),env,{fetch:get})).status,'not_connected');
 assert.equal((await marketSnapshot(request('XX'),env,{fetch:get})).status,'invalid_query');
 assert.equal((await marketSnapshot(request('US','shoe'),env,{fetch:get})).status,'invalid_query');
});
test('OAuth/search filters, five-minute expiry and concurrent search coalescing',async()=>{
 resetMarketCache();const {get,calls}=provider([item('1'),item('2')]);const now=Date.now();
 const results=await Promise.all(Array.from({length:6},()=>marketSnapshot(request(),env,{fetch:get,now})));
 assert(results.every(x=>x.status==='available'));assert.equal(calls.length,2);
 const u=new URL(calls[1].url);assert.equal(u.searchParams.get('limit'),'50');assert.equal(u.searchParams.get('q'),'RTX 4060');assert(u.searchParams.get('filter').includes('conditionIds:{3000}'));assert(u.searchParams.get('filter').includes('itemLocationCountry:US'));
 assert.equal(calls[1].options.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_US');assert.equal(calls[1].options.headers.Authorization,'Bearer fixture-token');
 assert.equal(calls[0].options.body,'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope');
 const cached=await marketSnapshot(request(),env,{fetch:get,now:now+299000});assert(cached.cached);assert.equal(calls.length,2);
 await marketSnapshot(request(),env,{fetch:get,now:now+300001});assert.equal(calls.length,3);
});
test('all six eBay marketplaces keep local currencies and source-provided active prices',async()=>{
 for(const m of MARKETS.filter(m=>m.ebay)){
  resetMarketCache();const row=item('1',123.45,{itemWebUrl:`https://${m.ebay}/itm/1`,price:{value:'123.45',currency:m.currency},itemLocation:{country:m.id}});
  const {get,calls}=provider([row]);const r=await marketSnapshot(request(m.id),env,{fetch:get});
  assert.equal(r.status,'available',m.id);assert.equal(r.items[0].price,123.45);assert.equal(r.items[0].currency,m.currency);assert.equal(calls[1].options.headers['X-EBAY-C-MARKETPLACE-ID'],`EBAY_${m.id}`);assert.equal(r.summary,null);
 }
});
test('aggregates need separate permission and five samples; no invented numbers or outlier trimming',async()=>{
 const rows=[1,2,3,4,5].map((id,i)=>item(String(id),[100,100,200,300,10000][i]));
 resetMarketCache();const p=provider(rows);const r=await marketSnapshot(request(),{...env,EBAY_PRICE_STATS_APPROVED:'on'},{fetch:p.get});
 assert.deepEqual(r.summary,{count:5,median:200,q1:100,q3:300});assert.equal(r.items[4].price,10000);
 resetMarketCache();const few=await marketSnapshot(request(),{...env,EBAY_PRICE_STATS_APPROVED:'on'},{fetch:provider(rows.slice(0,4)).get});assert.equal(few.summary,null);
});
test('access refusal, rate limit, timeout, malformed response and empty results have distinct honest states',async()=>{
 for(const [failure,status] of [[401,'access_denied'],[429,'rate_limited'],[500,'upstream_error']]){
  resetMarketCache();const r=await marketSnapshot(request(),env,{fetch:async()=>new Response('provider diagnostic',{status:failure})});assert.equal(r.status,status);assert.equal(r.observedAt,null);assert.equal(r.items.length,0);assert(!JSON.stringify(r).includes('provider diagnostic'));
 }
 resetMarketCache();assert.equal((await marketSnapshot(request(),env,{fetch:async()=>{throw new DOMException('timeout','TimeoutError');}})).status,'upstream_error');
 resetMarketCache();assert.equal((await marketSnapshot(request(),env,{fetch:provider([]).get})).status,'no_results');
 resetMarketCache();assert.equal((await marketSnapshot(request(),env,{fetch:async()=>response({unknown:1})})).status,'upstream_error');
 resetMarketCache();const denied={...env,RATE_LIMITER:{limit:async()=>({success:false})}};assert.equal((await marketSnapshot(request(),denied,{fetch:()=>{throw new Error('no fetch');}})).status,'rate_limited');
});
test('server-rendered result has source links/prices/timestamps and no manual prices field or client credentials',async()=>{
 resetMarketCache();const r=await marketSnapshot(request(),env,{fetch:provider([item('1',200,{title:'RTX 4060 <script>alert(1)</script> 8GB',shippingOptions:[{shippingCost:{value:'0.00',currency:'USD'}}]})]).get});
 const options={l:'ko',origin:'https://nerulio.com',channels:[],query:'?country=US&q=RTX+4060',tool:'used-prices',q:new URLSearchParams('country=US&q=RTX+4060'),market:r};
 const s=String(renderUsedPrices(options));assert(s.includes('$200.00'));assert(s.includes('https://www.ebay.com/itm/1'));assert(s.includes('<time datetime='));assert(s.includes('무료배송'));assert(s.includes('&lt;script&gt;'));assert(!s.includes('fixture-app')&&!s.includes('fixture-cert')&&!s.includes('fixture-token'));assert(!s.includes('<textarea')&&!s.includes('name="prices"'));
});
