import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim} from './d1-shim.mjs';
import {parseItems,gigglePost,frenchPost,rssPosts} from '../collectors/_hardware-market/parse.js';
import {collectCommunity,robotsAllowed,SOURCES,discovery} from '../collectors/_hardware-market/collect.js';
import {saveCommunity} from '../platform/hardware-community.js';
import {marketSnapshot} from '../server/platform/hardware-market.js';
import {renderUsedPrices} from '../platform/render/hardware-tools.js';
const now=Date.now();
const input={title:'[VDS] GPU',body:'<p>RTX 5070 Ti 16 Go</p><p>Excellent état</p><p>Prix: 1 050&euro;out</p>',source:'hardwarefr',postId:'123',url:'https://forum.hardware.fr/hfr/AchatsVentes/Hardware/gpu-sujet_123_1.htm',country:'FR',currency:'EUR'};
const parsed=o=>parseItems({...input,...o});
const result=(items,time=now,extra={})=>({source:'hardwarefr',country:'FR',status:'ok',observedAt:time,items,posts:[{id:'123',unchanged:false}],fetches:[],excluded:0,...extra});
const request=(q='RTX 5070 Ti 16GB',extra='')=>new Request(`https://nerulio.com/ko/hardware/used-prices/?country=FR&q=${encodeURIComponent(q)}${extra}`);

test('first-post scoping cannot include later comments, prices or author contacts',()=>{
 const k='<strong class="cate fl" title="Category">장터</strong><h1>RTX 4060 판매</h1><!--BeforeDocument(123,555)--><div class="document_123_555 xe_content"><div><p>RTX 4060 8GB</p><p>27만원</p></div></div><div class="comment_1 xe_content">5만원</div>';
 assert.equal(parseItems({...input,...gigglePost(k,'123'),country:'KR',currency:'KRW'}).items[0].price,270000);
 const f='<h3>[VDS] RTX 5070 Ti</h3><div id="para1">'+input.body+'<div>nested</div></div><div id="para2">2015: 270 euros</div>';
 assert.equal(parsed(frenchPost(f)).items[0].price,1050);
 assert.throws(()=>gigglePost(k.replace('장터','잡담'),'123'),/SCHEMA/);
 assert.throws(()=>frenchPost('<h3>[VDS]</h3>challenge'),/SCHEMA/);
});
test('item/price pairing excludes complete systems, wanted/new/broken ads, quantity, ambiguity and struck old prices',()=>{
 for(const title of ['RTX 5070 Ti gaming PC','[ACH] RTX 5070 Ti','RTX 5070 Ti BNIB','RTX 5070 Ti 세트','RTX 5070 Ti 삽니다','RTX 5070 Ti 미개봉'])assert.equal(parsed({title}).items.length,0,title);
 for(const body of ['RTX 5070 Ti + Ryzen 5600: 700€','RTX 5070 Ti: 900€ or 950€','RTX 5070 Ti 2 cards: 1800€','RTX 5070 Ti bundle 900€','RTX 5070 Ti for parts 50€'])assert.equal(parsed({body}).items.length,0,body);
 assert.equal(parsed({body:'<p>RTX 5070 Ti 16Go</p><p><del>1200€</del>1050€</p><p>--------------------</p><p>Case: 80€</p>'}).items[0].price,1050);
 assert.equal(parsed({body:'<p>RTX 5070 Ti 16Go 1050€</p><p>Boitier 80€</p>'}).items[0].price,1050);
 assert.equal(parsed({body:'<p>RTX 5070 Ti 16Go 1050€</p><p>RTX 5070 Ti 16Go</p>'}).items.length,1);
 assert.equal(parsed({body:'RTX 5070 Ti 16Go 1050€\nVENDUE à example'}).items[0].basis,'sold');
 assert.equal(parsed({body:'RTX 5070 Ti 16Go 1050€\nLa carte est vendue avec sa boîte'}).items[0].basis,'asking');
});
test('money grouping and decimals are strict; malformed tokens cannot become smaller valid prices',()=>{
 for(const v of ['1,050€','1.050€','1 05€','1.234€'])assert.equal(parsed({body:'RTX 5070 Ti '+v}).items.length,0,v);
 for(const [body,currency,price] of [['RTX 4060 4.5만원','KRW',45000],['RTX 4060 270,000원','KRW',270000],['RTX 5080 $1,600.50 shipped','USD',1600.5],['RTX 5070 Ti 1 050,50€','EUR',1050.5]])assert.equal(parsed({body,currency}).items[0].price,price);
 assert.equal(parsed({body:'RTX 5080 $1,23',currency:'USD'}).items.length,0);
 assert.equal(parsed({body:'RTX 4060 27,00원',currency:'KRW'}).items.length,0);
 assert.equal(parsed({body:'RTX 4060 8GB / 16GB 270€'}).items.length,0);
 assert.equal(parsed({body:'RTX 5080 CA$1600',currency:'USD'}).items.length,0);
 assert.equal(parsed({body:'RTX 4060 270€ or $300',currency:'EUR'}).items.length,0);
 const korean=parsed({title:'사파이어 RX570 4GB',body:'RX570\n택배비 포함 9만원',currency:'KRW'}).items[0];assert.equal(korean.capacity,'4');assert.equal(korean.shipping,0);
});
test('public RSS content:encoded is parsed directly without fetching protected thread HTML',async()=>{
 const feed='<rss><channel><item><title>RTX 5080</title><link>https://hardforum.com/threads/gpu.123/</link><content:encoded><![CDATA[<div>RTX 5080 - $1600 shipped</div>]]></content:encoded></item></channel></rss>';
 assert.equal(rssPosts(feed)[0].body,'<div>RTX 5080 - $1600 shipped</div>');
 const calls=[],get=async url=>{calls.push(url);return new Response(url.endsWith('robots.txt')?'User-agent: *\nDisallow: /threads/':feed,{headers:{'content-type':url.endsWith('robots.txt')?'text/plain':'application/rss+xml'}});};
 const [r]=await collectCommunity({fetch:get,now,delay:0,sources:[SOURCES[1]]});
 assert.equal(r.status,'ok');assert.equal(r.items[0].price,1600);assert.equal(r.items[0].shipping,0);assert.equal(calls.length,2);
 assert(!JSON.stringify(r.items).includes('author'));
});
test('robots specific groups, wildcard paths, Allow ties and source blocking are respected',async()=>{
 const robots='User-agent: *\nDisallow: /\nUser-agent: NerulioCollector\nDisallow: /private*\nAllow: /private/public\n';
 assert(robotsAllowed(robots,'https://example.org/a'));assert(!robotsAllowed(robots,'https://example.org/private/a'));assert(robotsAllowed(robots,'https://example.org/private/public/a'));
 assert(!robotsAllowed('User-agent: *\nDisallow: /*.php$','https://example.org/login.php'));
 assert(robotsAllowed('# User-agent: *\n# Disallow: /','https://example.org/a'));
 let calls=0;const [r]=await collectCommunity({fetch:async()=>{calls++;return new Response('User-agent: *\nDisallow: /',{headers:{'content-type':'text/plain'}});},sources:[SOURCES[0]],delay:0});
 assert.equal(r.status,'ROBOTS');assert.equal(calls,1);
});
test('access/rate limits, oversized responses and schema changes never commit partial source facts',async()=>{
 for(const status of [403,429]){let calls=0;const [r]=await collectCommunity({fetch:async()=>new Response(++calls===1?'User-agent: *\nAllow: /':'blocked',{status:calls===1?200:status,headers:{'content-type':'text/plain'}}),sources:[SOURCES[1]],delay:0});assert.equal(r.status,status===403?'ACCESS_DENIED':'RATE_LIMITED');assert.equal(calls,2);}
 const [r]=await collectCommunity({fetch:async url=>new Response(url.endsWith('robots.txt')?'':'x'.repeat(1024*1024+1),{headers:{'content-type':'text/plain'}}),sources:[SOURCES[1]],delay:0});assert.equal(r.status,'SIZE');
 const db=D1Shim.migrated();await saveCommunity(db,[result(parsed().items)]);await saveCommunity(db,[result([] ,now+1000,{status:'SCHEMA'})]);assert.equal((await db.prepare('SELECT active,last_seen FROM hardware_market_items').first()).active,1);assert.equal((await db.prepare('SELECT success_at FROM hardware_market_sources').first()).success_at,now);db.raw.close();
});
test('discovery stays on canonical market paths and discards unsafe/non-sale/other-category links',()=>{
 const h='<a href="https://gigglehd.com/gg/index.php?mid=bbs&amp;category=14058&amp;document_srl=123">RTX 4060</a><a href="https://evil.test/?document_srl=456">RTX 4060</a><a href="https://gigglehd.com/gg/index.php?category=13759&amp;document_srl=456">RTX 4060</a>';
 assert.deepEqual(discovery(h,SOURCES[0]),[{id:'123',url:'https://gigglehd.com/gg/123'}]);
});
test('D1 idempotence, conditional 304, revisions, sold transitions and vanished items',async()=>{
 const db=D1Shim.migrated(),items=parsed().items;
 await saveCommunity(db,[result(items)]);await saveCommunity(db,[result(items,now+1000)]);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM hardware_market_items').first()).n,1);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM hardware_market_revisions').first()).n,1);
 await saveCommunity(db,[result([],now+2000,{posts:[{id:'123',unchanged:true}]})]);assert.equal((await db.prepare('SELECT changed_at,last_seen FROM hardware_market_items').first()).changed_at,now);
 await saveCommunity(db,[result(items.map(i=>({...i,price:1000,basis:'sold'})),now+3000)]);
 const sold=await marketSnapshot(request('RTX 5070 Ti','&basis=sold'),{DB:db},{now:now+3000,fetch:()=>{throw Error('no network');}});assert.equal(sold.items[0].price,1000);assert.equal(sold.basis,'sold');
 await saveCommunity(db,[result([],now+4000)]);assert.equal((await marketSnapshot(request(),{DB:db},{now:now+4000})).status,'no_results');db.raw.close();
});
test('minimum comparable sample, exact suffix/capacity, time window, stale failure and no personal storage',async()=>{
 const db=D1Shim.migrated(),items=Array.from({length:5},(_,n)=>({...parsed().items[0],id:'item'+n,postId:String(n),price:1000+n*100}));
 await saveCommunity(db,[result(items)]);const s=await marketSnapshot(request(),{DB:db},{now});assert.equal(s.summary.median,1200);
 assert.equal((await marketSnapshot(request('RTX 5070'),{DB:db},{now})).items.length,0);
 assert.equal((await marketSnapshot(request('RTX 5070 Ti Super'),{DB:db},{now})).items.length,0);
 assert.equal((await marketSnapshot(request('RTX 5070 Ti 12GB'),{DB:db},{now})).items.length,0);
 assert.equal((await marketSnapshot(request(),{DB:db},{now:now+4*86400e3})).status,'stale');
 await saveCommunity(db,[result(items,now+31*86400e3)]);assert.equal((await marketSnapshot(request(),{DB:db},{now:now+31*86400e3})).items.length,0);
 assert.equal((await marketSnapshot(request('RTX 5070 Ti','&days=90'),{DB:db},{now:now+31*86400e3})).items.length,5);
 const markup=String(renderUsedPrices({l:'ko',origin:'https://nerulio.com',tool:'used-prices',query:'x',q:new URL(request().url).searchParams,channels:[],market:s}));assert(markup.includes('Hardware.fr'));assert(markup.includes('name="basis"'));assert(!markup.includes('textarea'));assert(!markup.includes('<strong>eBay ·'));
 db.raw.close();
});
test('initial already-sold observations are not presented as recent completed sales',async()=>{
 const db=D1Shim.migrated();await saveCommunity(db,[result(parsed({body:'RTX 5070 Ti 16Go 1000€\nVENDUE à example'}).items)]);
 assert.equal((await marketSnapshot(request('RTX 5070 Ti','&basis=sold'),{DB:db},{now})).items.length,0);db.raw.close();
});
test('ETag conditional post refresh extends verification without duplicating a sample or moving price time',async()=>{
 const db=D1Shim.migrated(),s=SOURCES[0];
 const board='<tr data-gg-block-kind="entry"><a href="https://gigglehd.com/gg/index.php?mid=bbs&amp;category=14058&amp;document_srl=123">RTX 4060</a></tr>';
 const post='<strong class="cate fl" title="Category">장터</strong><h1>RTX 4060 판매</h1><div class="document_123_1 xe_content">RTX 4060 8GB 27만원</div>';
 let conditional=false;
 const get=async(url,init)=>{if(url.endsWith('robots.txt'))return new Response('User-agent: *\nAllow: /',{headers:{'content-type':'text/plain'}});if(url.endsWith('/123')){if(init.headers['if-none-match']==='"v1"'){conditional=true;return new Response(null,{status:304});}return new Response(post,{headers:{'content-type':'text/html',etag:'"v1"'}});}return new Response(board,{headers:{'content-type':'text/html'}});};
 await saveCommunity(db,await collectCommunity({fetch:get,db,now,delay:0,sources:[s]}));
 await saveCommunity(db,await collectCommunity({fetch:get,db,now:now+1000,delay:0,sources:[s]}));
 assert(conditional);assert.equal((await db.prepare('SELECT changed_at,last_seen FROM hardware_market_items').first()).changed_at,now);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM hardware_market_revisions').first()).n,1);db.raw.close();
});
