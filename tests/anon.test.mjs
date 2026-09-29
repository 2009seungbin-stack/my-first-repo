/** Writing without an account (유동): daily ID, passwords, limits, bans, the bot check, images and
 * report-driven auto-hide. Real SQL over node:sqlite (tests/d1-shim.mjs), an in-memory R2 bucket
 * (tests/r2-shim.mjs) and a mocked Turnstile siteverify; nothing external is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {R2Shim} from './r2-shim.mjs';
import {handlePlatformApi} from '../server/platform/api.js';
import {serveUpload,resetImageStateCache,IMAGE_CACHE,imageCacheKeys} from '../server/platform/uploads.js';
import {cacheOrigins} from '../server/platform/api.js';
import {handlePlatformPage} from '../server/platform/pages.js';
import {sha256,base64url} from '../server/crypto.js';
import {createLimiter} from '../server/ratelimit.js';
import {ingest} from '../platform/ingest.js';
import {networkPrefix,kstDay,anonIdentity,dailyIdOf,hashPassword,verifyPassword,anonCleanupStatements,ANON,REPORT,countLinks,linkedHosts,resetBlocklistCache} from '../server/platform/anon.js';
import {cleanImage,sniff,IMAGE_LIMITS} from '../server/platform/images.js';
import {notifyNewFlag} from '../server/platform/admin-notify.js';
import {generateAdminKeys} from '../tools/admin-keys.mjs';
import {author} from '../platform/render/ui.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',SECRET='test-session-secret-0123456789abcdef-0123456789';
// 2026-09-28 06:00 UTC = 15:00 KST.
const T0=Date.UTC(2026,8,28,6,0);
const FIX=name=>new Uint8Array(readFileSync(new URL(`./fixtures/anon/${name}`,import.meta.url)));
const SEED={schema:'nerulio.seed/1',vertical:'ai',sources:[],entities:[{id:'service:svc',type:'service',slug:'svc',names:{en:'Svc',ko:'서비스'}},{id:'service:two',type:'service',slug:'two',names:{en:'Two'}}]};

/** One deployment (D1 + optional R2 + optional Turnstile) and browsers with their own cookies and address. */
async function harness(o={}){
 const db=D1Shim.migrated(),clock={now:T0},limiter=createLimiter();
 await ingest(db,SEED,{mode:'seed',actor:'seed',now:T0-864e5});
 const bucket=o.uploads===false?null:new R2Shim();
 const env={DB:db,SESSION_SECRET:SECRET,...(o.production?{}:{NERULIO_ENV:'development'}),SITE_URL:ORIGIN,...(bucket?{UPLOADS:bucket}:{}),
  ...(o.turnstile?{TURNSTILE_SITE_KEY:'site-key-1',TURNSTILE_SECRET_KEY:'secret-key-1'}:{})};
 const verifies=[];
 const fetch=async(url,init)=>{const token=init.body.get('response');verifies.push(token);
  const testing=token==='testing-key';
  return new Response(JSON.stringify(token==='bad'?{success:false}:testing?{success:true,hostname:'example.com',metadata:{result_with_testing_key:true}}:{success:true,action:'community',hostname:'nerulio.test'}),{headers:{'content-type':'application/json'}});};
 const sessions={};
 const h={db,clock,env,bucket,verifies,
  async member(name,role){
   const id='u-'+name,token=base64url(crypto.getRandomValues(new Uint8Array(32)));
   await db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,NULL,?2,'github',?1,?3)").bind(id,name,T0-30*864e5).run();
   await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,T0,T0+864e5).run();
   if(role||o.nick)await db.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES (?1,?2,?3,?4,?4)").bind(id,name,role||'user',T0).run();
   sessions[name]=token;return id;
  },
  /** A browser: its own cookie jar, a client address, optionally signed in. */
  browser(ip='203.0.113.7',as=null){
   const jar=new Map();if(as)jar.set('nerulio_session',sessions[as]);
   const b={ip,jar,
    async call(method,path,{body,raw,type,headers={},host=ORIGIN,origin=host}={}){
     const hd=new Headers(headers);
     if(jar.size)hd.set('cookie',[...jar].map(([k,v])=>`${k}=${v}`).join('; '));
     if(ip)hd.set('cf-connecting-ip',ip);
     if(method==='POST'&&origin)hd.set('origin',origin);
     if(body!==undefined)hd.set('content-type','application/json');
     if(raw!==undefined)hd.set('content-type',type||'image/webp');
     const r=await handlePlatformApi(new Request(host+'/api/v2'+path,{method,headers:hd,body:raw!==undefined?raw:body!==undefined?JSON.stringify(body):undefined}),env,null,{now:()=>clock.now,limiter,fetch,random:()=>1});
     for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const i=kv.indexOf('=');const k=kv.slice(0,i),v=kv.slice(i+1);if(/Max-Age=0/.test(c))jar.delete(k);else jar.set(k,v);}
     return {status:r.status,headers:r.headers,json:await r.json()};
    },
    async image(path,{host=ORIGIN,headers={},method='GET',ctx=null,now}={}){
     const hd=new Headers(headers);if(jar.size)hd.set('cookie',[...jar].map(([k,v])=>`${k}=${v}`).join('; '));
     return serveUpload(new Request(host+path,{headers:hd,method}),env,ctx,{...(now?{now}:{}),isModerator:async()=>!!as&&!!(await db.prepare("SELECT 1 FROM user_profiles WHERE user_id=? AND role IN ('moderator','curator','admin')").bind('u-'+as).first())});
    }};
   return b;
  }};
 return h;
}
const post=(b,extra={})=>b.call('POST','/posts?l=ko',{body:{entityId:'service:svc',kind:'free',title:'익명 글 제목',body:'본문입니다',password:'1234',...extra}});

/* ---------- daily ID, network key, passwords ---------- */

test('network prefix: IPv4 /24, IPv6 /48 (expanded), IPv4-mapped IPv6 counts as IPv4',()=>{
 assert.equal(networkPrefix('203.0.113.7'),'v4:203.0.113');
 assert.equal(networkPrefix('203.0.113.250'),'v4:203.0.113');
 assert.equal(networkPrefix('2001:db8:1234:5678::1'),'v6:2001:db8:1234');
 assert.equal(networkPrefix('2001:db8:1234::'),'v6:2001:db8:1234');
 assert.equal(networkPrefix('2001:0db8:1234:ffff:ffff::9'),'v6:2001:db8:1234');
 assert.equal(networkPrefix('::ffff:203.0.113.9'),'v4:203.0.113');
 assert.equal(networkPrefix(''),'none');
 assert.equal(networkPrefix('999.1.1.1'),'bad');assert.equal(networkPrefix('not-an-ip'),'bad');
});

test('daily ID: same network and KST day → same ID; other network or next KST day → another; the address is not in it',async()=>{
 const a=await anonIdentity('203.0.113.7',SECRET,T0),b=await anonIdentity('203.0.113.99',SECRET,T0+3600e3);
 assert.equal(a.id,b.id,'same /24, same KST day');assert.equal(a.key,b.key);assert.equal(a.net,b.net);
 assert.match(a.id,/^[0-9A-Za-z]{4}$/);assert.match(a.net,/^[0-9a-f]{32}$/);
 const other=await anonIdentity('198.51.100.7',SECRET,T0);
 assert.notEqual(other.id,a.id);assert.notEqual(other.net,a.net);
 // 15:00 UTC is 00:00 KST: the ID changes, the network key (bans, limits) does not.
 assert.equal(kstDay(Date.UTC(2026,8,28,14,59)),'2026-09-28');assert.equal(kstDay(Date.UTC(2026,8,28,15,0)),'2026-09-29');
 const next=await anonIdentity('203.0.113.7',SECRET,Date.UTC(2026,8,28,15,0));
 assert.notEqual(next.id,a.id,'rotates at midnight KST');assert.equal(next.net,a.net);
 const late=await anonIdentity('203.0.113.7',SECRET,Date.UTC(2026,8,28,14,59));assert.equal(late.id,a.id);
 // Keyed: another secret gives unrelated values; nothing contains the address.
 const k2=await anonIdentity('203.0.113.7','another-secret-0123456789abcdef-0123456789',T0);
 assert.notEqual(k2.id,a.id);assert.notEqual(k2.net,a.net);
 for(const v of [a.id,a.key,a.net])assert(!v.includes('203')&&!v.includes('113'));
 const v6a=await anonIdentity('2001:db8:1234:5678::1',SECRET,T0),v6b=await anonIdentity('2001:db8:1234:9999::7',SECRET,T0);
 assert.equal(v6a.id,v6b.id,'one /48');
 assert.equal(dailyIdOf(new Uint8Array([0,0,0,0])),'0000');
});

test('edit passwords: PBKDF2-SHA256 100k with a per-item salt and a secret pepper',async()=>{
 const h1=await hashPassword('1234',SECRET),h2=await hashPassword('1234',SECRET);
 assert.match(h1,/^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
 assert.notEqual(h1,h2,'salted');assert(!h1.includes('1234'));
 assert.equal(await verifyPassword('1234',h1,SECRET),true);
 assert.equal(await verifyPassword('12345',h1,SECRET),false);
 assert.equal(await verifyPassword('1234',h1,'another-secret-0123456789abcdef-0123456789'),false,'the pepper is the secret');
 assert.equal(await verifyPassword('1234','plain',SECRET),false);
 assert.equal(await verifyPassword('1234',h1.replace('100000','9999999'),SECRET),false,'iteration count is bounded');
 const t=performance.now();await hashPassword('abcd',SECRET);assert(performance.now()-t<2000);
});

test('links and hosts are counted the way the rules describe',()=>{
 assert.equal(countLinks('a https://x.com b http://y.com [c](https://z.com) www.q.com'),4);
 assert.equal(countLinks('no links here, just example.com'),0);
 assert.deepEqual(linkedHosts('see https://WWW.Spam.example/x and http://ok.test'),['spam.example','ok.test']);
});

/* ---------- writing without an account ---------- */

test('an anonymous post: nickname + daily ID, hashed password, network key, never the IP address',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 const st=(await b.call('GET','/state')).json;
 assert.equal(st.signedIn,false);assert.deepEqual([st.anon.enabled,st.anon.check],[true,'none'],'development without Turnstile: on, no bot check');
 assert.equal(st.uploads.perPost,10);
 const r=await post(b,{name:'지나가던 사람'});
 assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(r.json.name,'지나가던 사람');assert.match(r.json.anonId,/^[0-9A-Za-z]{4}$/);assert.equal(r.json.check,'none');
 const row=h.db.raw.prepare('SELECT author_id,anon_name,anon_id,anon_net,anon_pw,text_hash FROM discussions WHERE id=?').get(r.json.id);
 assert.equal(row.author_id,'anon');assert.equal(row.anon_name,'지나가던 사람');assert.equal(row.anon_id,r.json.anonId);
 assert.match(row.anon_net,/^[0-9a-f]{32}$/);assert.match(row.anon_pw,/^pbkdf2-sha256\$/);assert.match(row.text_hash,/^[0-9a-f]{32}$/);
 // No table holds the client address in any form we could search for.
 for(const {name} of h.db.raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()){
  const rows=h.db.raw.prepare(`SELECT * FROM "${name}"`).all();
  assert(!JSON.stringify(rows).includes('203.0.113'),`address stored in ${name}`);
 }
 const empty=await post(h.browser('198.51.100.1'),{name:'',title:'다른 네트워크 글'});
 assert.equal(empty.json.name,'ㅇㅇ','empty nickname → ㅇㅇ');
 assert.equal((await post(h.browser('198.51.100.2'),{name:'운영자',title:'x 제목'})).status,400,'reserved');
 assert.equal((await post(h.browser('198.51.100.3'),{name:'ㅇㅇ (a3F9)',title:'x 제목'})).status,400,'cannot imitate an ID');
 assert.equal((await post(h.browser('198.51.100.4'),{name:'열세글자닉네임은너무길어요',title:'x 제목'})).status,400);
 assert.equal((await post(h.browser('198.51.100.5'),{password:'123',title:'x 제목'})).json.error.field,'password');
 assert.equal((await post(h.browser('198.51.100.6'),{author_id:'u-x'})).status,400,'unknown fields refused');
 // A member's nickname (고정닉) is not available to anonymous writers, and members cannot take ㅇㅇ.
 const h2=await harness({nick:true});await h2.member('밤샘테스터');
 assert.equal((await post(h2.browser(),{name:'밤샘테스터'})).json.error.message,'This nickname belongs to a member.');
 const m=h2.browser('203.0.113.8','밤샘테스터');
 assert.equal((await m.call('POST','/profile',{body:{displayName:'ㅇㅇ'}})).status,400);
});

test('boards, tags and member-only features stay as they are for anonymous writers',{skip},async()=>{
 const h=await harness(),b=h.browser();
 assert.equal((await post(b,{kind:'notice'})).status,400,'staff tag');
 assert.equal((await b.call('POST','/follow',{body:{entityId:'service:svc'}})).status,401);
 assert.equal((await b.call('POST','/facts/propose',{body:{entityId:'service:svc'}})).status,401);
 assert.equal((await b.call('POST','/mod/action',{body:{target:'discussion:x',action:'hide',reason:'xx'}})).status,401);
});

test('유동 in a channel: 말머리 of that channel, tags from any area, the post URL is the channel number',{skip},async()=>{
 const h=await harness();
 const r=await post(h.browser('203.0.113.20'),{entityId:undefined,channel:'free',kind:'question',tags:['service:svc'],name:'지나가던 사람'});
 assert.equal(r.status,201,JSON.stringify(r.json));
 assert.match(r.json.url,/^\/ko\/community\/free\/\d+$/);assert.equal(r.json.channel,'free');
 const row=h.db.raw.prepare('SELECT author_id,anon_name,channel_id,flair FROM discussions WHERE id=?').get(r.json.id);
 assert.deepEqual({...row},{author_id:'anon',anon_name:'지나가던 사람',channel_id:'free',flair:'question'});
 assert.deepEqual(h.db.raw.prepare('SELECT entity_id FROM discussion_tags WHERE discussion_id=?').all(r.json.id).map(x=>x.entity_id),['service:svc']);
 assert.equal((await post(h.browser('203.0.113.21'),{entityId:undefined,channel:'free',kind:'notice',tags:[]})).status,400,'공지 stays staff-only');
 assert.equal((await post(h.browser('192.0.2.22'),{entityId:undefined,channel:'notice',kind:'feedback',tags:[],title:'건의 드립니다'})).status,201,'유동 may leave 건의');
 // 유동 cannot propose tags or keep pins on the server.
 assert.equal((await h.browser('203.0.113.23').call('POST','/tags/propose',{body:{name:'새 게임',channel:'games'}})).status,401);
 assert.equal((await h.browser('203.0.113.24').call('POST','/pins',{body:{channels:['ai']}})).status,401);
 assert.deepEqual((await h.browser('203.0.113.25').call('GET','/pins')).json,{pins:null},'signed out: pins live in the browser');
});

test('per-network limits: burst per minute, daily cap; stricter without a bot check',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 assert.equal((await post(b,{title:'첫 번째 글'})).status,201);
 const second=await post(h.browser('203.0.113.77'),{title:'두 번째 글'});
 assert.equal(second.status,429,'1 post per minute per /24 without Turnstile');
 for(let i=0;i<4;i++){h.clock.now+=61e3;assert.equal((await post(b,{title:`글 번호 ${i}`,body:`본문 ${i}`})).status,201);}
 h.clock.now+=61e3;
 const capped=await post(b,{title:'여섯 번째 글',body:'또 다른 본문'});
 assert.equal(capped.status,429);assert.equal(capped.json.error.reason,'daily');
 assert.equal((await post(h.browser('198.51.100.9'),{title:'다른 네트워크'})).status,201,'another network has its own budget');
 // The next KST day starts a new budget.
 h.clock.now=Date.UTC(2026,8,28,15,1);
 assert.equal((await post(b,{title:'다음 날 글',body:'새 본문'})).status,201);
 assert.equal(ANON.limits.strict.postsPerDay,5);assert.equal(ANON.limits.normal.postsPerDay,20);
});

test('links: none in the first write of the day, at most 2 per post and 1 per comment',{skip},async()=>{
 const h=await harness(),b=h.browser();
 const first=await post(b,{body:'첫 글에 링크 https://example.com'});
 assert.equal(first.status,400);assert.equal(first.json.error.reason,'first_links');
 const ok=await post(b,{body:'링크 없는 첫 글'});assert.equal(ok.status,201);
 h.clock.now+=61e3;
 assert.equal((await post(b,{title:'링크 셋',body:'https://a.test https://b.test https://c.test'})).json.error.reason,'links');
 h.clock.now+=61e3;
 assert.equal((await post(b,{title:'링크 둘',body:'https://a.test https://b.test'})).status,201);
 const c=await b.call('POST','/comments',{body:{postId:ok.json.id,body:'https://a.test https://b.test',password:'1234'}});
 assert.equal(c.json.error.reason,'links');
});

test('identical text: refused from the same network for a day, from anyone for 10 minutes',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 assert.equal((await post(b,{title:'도배 제목',body:'도배 본문'})).status,201);
 h.clock.now+=61e3;
 const again=await post(b,{title:'도배 제목',body:'도배  본문'});
 assert.equal(again.status,409);assert.equal(again.json.error.code,'DUPLICATE_CONTENT');
 assert.equal((await post(h.browser('198.51.100.9'),{title:'도배 제목',body:'도배 본문'})).status,409,'another network, within 10 minutes');
 h.clock.now+=11*60e3;
 assert.equal((await post(h.browser('198.51.100.9'),{title:'도배 제목',body:'도배 본문'})).status,201,'another network, later');
 // Short comments like "감사합니다" from different people are fine.
 const p=(await post(h.browser('192.0.2.1'),{title:'댓글 받을 글',body:'x'})).json.id;
 for(const ip of ['192.0.2.10','198.18.0.1'])assert.equal((await h.browser(ip).call('POST','/comments',{body:{postId:p,body:'감사합니다',password:'1234'}})).status,201);
});

test('blocklist: reject refuses the write, hide publishes it hidden for review',{skip},async()=>{
 const h=await harness(),b=h.browser();resetBlocklistCache();
 h.db.raw.exec("INSERT INTO blocklist (kind,pattern,action,created_at) VALUES ('keyword','카 지 노','reject',0),('domain','spam.example','hide',0)");
 const r=await post(b,{body:'오늘도 카지노 가자'});
 assert.equal(r.status,400);assert.equal(r.json.error.reason,'blocked');
 await post(b,{title:'평범한 글',body:'링크 규칙을 풀기 위한 첫 글'});h.clock.now+=61e3;
 const held=await post(b,{title:'홍보 글',body:'여기 https://www.spam.example/x'});
 assert.equal(held.status,201);assert.equal(held.json.held,true);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(held.json.id).status,'hidden');
 assert.equal(h.db.raw.prepare("SELECT actor_id FROM moderation_actions WHERE target_id=?").get(held.json.id).actor_id,'system:automod');
 resetBlocklistCache();
});

test('edit and delete by password, with attempt limits',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 const p=(await post(b,{title:'수정할 글',password:'myp@ss'})).json;
 const wrong=await b.call('POST','/anon/check',{body:{target:`discussion:${p.id}`,password:'nope'}});
 assert.equal(wrong.status,403);assert.equal(wrong.json.error.reason,'password');
 const ok=await b.call('POST','/anon/check',{body:{target:`discussion:${p.id}`,password:'myp@ss'}});
 assert.equal(ok.status,200);assert.equal(ok.json.title,'수정할 글');assert(ok.json.kinds.some(k=>k.id==='free'));
 // Another browser on another network with the password can edit too (the password is the key).
 const other=h.browser('198.51.100.5');
 const ed=await other.call('POST','/posts/edit',{body:{postId:p.id,title:'수정된 글',body:'새 본문',password:'myp@ss'}});
 assert.equal(ed.status,200,JSON.stringify(ed.json));
 assert.equal(h.db.raw.prepare('SELECT title FROM discussions WHERE id=?').get(p.id).title,'수정된 글');
 // Signed-in members use the password path for anonymous items too; without it an anonymous post is not theirs.
 await h.member('m1');const m=h.browser('203.0.113.9','m1');
 assert.equal((await m.call('POST','/posts/edit',{body:{postId:p.id,title:'가로채기',body:'x'}})).status,404);
 // 8 wrong tries lock the item for the hour, even with the right password afterwards.
 const guess=h.browser('192.0.2.50');
 for(let i=1;i<ANON.passwordFailuresPerItem;i++)assert.equal((await guess.call('POST','/anon/check',{body:{target:`discussion:${p.id}`,password:`guess${i}`}})).status,403);
 assert.equal((await b.call('POST','/anon/check',{body:{target:`discussion:${p.id}`,password:'myp@ss'}})).status,429);
 h.clock.now+=3600e3;
 const del=await b.call('POST','/posts/delete',{body:{postId:p.id,password:'myp@ss'}});
 assert.equal(del.status,200);assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p.id).status,'deleted');
 // Comments: the same.
 const q=(await post(h.browser('198.51.100.60'),{title:'댓글용 글',body:'y'})).json.id;
 const c=(await b.call('POST','/comments',{body:{postId:q,body:'익명 댓글',password:'4321',name:'댓글러'}})).json;
 assert.equal((await b.call('POST','/comments/edit',{body:{commentId:c.id,body:'고친 댓글',password:'4321'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT body_md FROM comments WHERE id=?').get(c.id).body_md,'고친 댓글');
 assert.equal((await b.call('POST','/comments/delete',{body:{commentId:c.id,password:'0000'}})).status,403);
 assert.equal((await b.call('POST','/comments/delete',{body:{commentId:c.id,password:'4321'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT comment_count FROM discussions WHERE id=?').get(q).comment_count,0);
});

test('Turnstile: a post needs a fresh token; a solved check gives a 10-minute pass for comments, votes and reports',{skip},async()=>{
 const h=await harness({turnstile:true}),b=h.browser();
 const st=(await b.call('GET','/state')).json;assert.deepEqual([st.anon.check,st.anon.siteKey],['turnstile','site-key-1']);
 const need=await post(b);
 assert.equal(need.status,403);assert.equal(need.json.error.code,'CHALLENGE_REQUIRED');assert.equal(need.json.error.siteKey,'site-key-1');
 assert.equal((await post(b,{turnstileToken:'bad'})).json.error.code,'CHALLENGE_FAILED');
 const ok=await post(b,{turnstileToken:'tok-1'});assert.equal(ok.status,201);assert(b.jar.has('nerulio_anonpass'));
 const c=await b.call('POST','/comments',{body:{postId:ok.json.id,body:'패스로 쓰는 댓글',password:'1234'}});
 assert.equal(c.status,201,'the pass covers a comment');
 h.clock.now+=61e3;
 assert.equal((await post(b,{title:'두 번째 글',body:'또'})).json.error.code,'CHALLENGE_REQUIRED','a post always needs a fresh token');
 // The pass is bound to this browser and network, and expires.
 const other=h.browser('198.51.100.1');other.jar.set('nerulio_anonpass',b.jar.get('nerulio_anonpass'));
 assert.equal((await other.call('POST','/comments',{body:{postId:ok.json.id,body:'훔친 패스',password:'1234'}})).json.error.code,'CHALLENGE_REQUIRED');
 h.clock.now+=11*60e3;
 assert.equal((await b.call('POST','/comments',{body:{postId:ok.json.id,body:'만료된 패스',password:'1234'}})).json.error.code,'CHALLENGE_REQUIRED');
 // Cloudflare's testing keys pass on development only.
 assert.equal((await post(h.browser('192.0.2.9'),{turnstileToken:'testing-key',title:'테스트 키'})).status,201);
 const prod=await harness({turnstile:true,production:true});
 assert.equal((await post(prod.browser(),{turnstileToken:'testing-key'})).json.error.code,'CHALLENGE_FAILED','testing-key answers are refused on production');
 assert.equal((await post(prod.browser('198.51.100.3'),{turnstileToken:'tok-2'})).status,201);
});

test('production without Turnstile: anonymous writing answers 503 NOT_CONFIGURED in the admin envelope',{skip},async()=>{
 const h=await harness({production:true}),b=h.browser();
 const st=(await b.call('GET','/state')).json;assert.deepEqual([st.anon.enabled,st.anon.check],[false,'off']);
 const r=await post(b);
 assert.equal(r.status,503);assert.equal(r.json.error.code,'NOT_CONFIGURED');
 assert.equal(r.json.need,'TURNSTILE_SECRET_KEY');assert.deepEqual(r.json.missing,['TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY']);assert.equal(r.json.error.need,'TURNSTILE_SECRET_KEY');
 assert.equal((await b.call('POST','/uploads',{raw:FIX('gps.webp')})).json.error.code,'NOT_CONFIGURED');
});

test('anonymous votes: one per daily ID per target, counted with members, never on your own post',{skip},async()=>{
 const h=await harness(),a=h.browser('203.0.113.7');
 const p=(await post(a)).json.id;
 assert.equal((await a.call('POST','/votes',{body:{kind:'discussion',id:p,value:1}})).status,403,'own post (same daily ID)');
 const b=h.browser('198.51.100.7');
 assert.equal((await b.call('POST','/votes',{body:{kind:'discussion',id:p,value:1}})).json.up,1);
 assert.equal((await h.browser('198.51.100.99').call('POST','/votes',{body:{kind:'discussion',id:p,value:1}})).json.up,1,'same /24 = same voter');
 assert.equal((await b.call('POST','/votes',{body:{kind:'discussion',id:p,value:-1}})).json.down,1);
 await h.member('v');const m=h.browser('192.0.2.1','v');
 const r=await m.call('POST','/votes',{body:{kind:'discussion',id:p,value:1}});
 assert.deepEqual([r.json.up,r.json.down],[1,1],'member votes and anonymous votes add up');
 const s=(await h.browser('198.51.100.7').call('GET',`/state?post=${p}`)).json;assert.equal(s.votes[p],-1,'the reader sees their vote back');
});

test('reports: 3 different reporters hide it, a severe category hides it at once; the admin restores it',{skip},async()=>{
 const h=await harness(),p=(await post(h.browser('203.0.113.7'))).json.id;
 const flag=(ip,reason='spam')=>h.browser(ip).call('POST','/flags',{body:{target:`discussion:${p}`,reason}});
 assert.equal((await flag('198.51.100.1')).status,201);
 assert.equal((await flag('198.51.100.2')).status,200,'same /24: the same reporter, the repeat updates the reason');
 assert.equal((await flag('192.0.2.1')).json.hidden,undefined);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p).status,'published','2 people so far');
 await h.member('r1');
 const third=await h.browser('198.18.0.9','r1').call('POST','/flags',{body:{target:`discussion:${p}`,reason:'abuse'}});
 assert.equal(third.json.hidden,true,'members count as reporters too');
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p).status,'hidden');
 const log=h.db.raw.prepare("SELECT actor_id,reason,meta FROM moderation_actions WHERE target_id=?").get(p);
 assert.equal(log.actor_id,'system:automod');assert.match(log.reason,/3명/);assert.equal(JSON.parse(log.meta).previous,'published');
 // The admin sees it in the queue (with the anonymous author and daily ID) and restores it.
 await h.member('boss','admin');const admin=h.browser('192.0.2.200','boss');
 const q=(await admin.call('GET','/mod/queue')).json;
 const it=q.items.find(x=>x.target===`discussion:${p}`);
 assert.equal(it.status,'hidden');assert.equal(it.people,3);assert.match(it.author,/^ㅇㅇ \([0-9A-Za-z]{4}\)$/);assert.equal(it.anon.bannable,true);assert.equal(it.authorId,null);
 assert(q.hidden.some(x=>x.target===`discussion:${p}`&&x.auto));
 assert.equal((await admin.call('POST','/mod/action',{body:{target:`discussion:${p}`,action:'unhide',reason:'문제 없음'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p).status,'published');
 // Severe categories: one report hides at once.
 h.clock.now+=61e3;
 const q2=(await post(h.browser('203.0.113.8'),{title:'두 번째 글',body:'다른 본문'})).json.id;
 for(const [reason,target] of [['csam',q2]]){
  const r=await h.browser('198.51.100.50').call('POST','/flags',{body:{target:`discussion:${target}`,reason}});
  assert.equal(r.json.hidden,true);
 }
 assert.equal(h.db.raw.prepare('SELECT category,reason FROM content_flags WHERE target_id=?').get(q2).category,'csam');
 assert.deepEqual([...REPORT.severe].sort(),['csam','illegal_filming','privacy']);
 assert.equal((await h.browser().call('POST','/flags',{body:{target:`discussion:${p}`,reason:'because'}})).status,400);
 assert.equal((await h.browser().call('POST','/flags',{body:{target:'user:anon',reason:'spam'}})).status,400);
});

test('auto-hide pushes to the admin at once, also to hourly devices and in quiet hours; a plain report only to instant ones',{skip},async()=>{
 const KEYS=await generateAdminKeys(),db=D1Shim.migrated(),now=Date.UTC(2026,8,28,16,0);   // 01:00 KST, quiet hours
 db.raw.exec(`INSERT INTO users (id,provider,provider_subject,created_at) VALUES ('adm','passkey','h',0);INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('adm','운영자','admin',0,0)`);
 const sub=async(prefs)=>{const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const ep=`https://fcm.googleapis.com/fcm/send/${base64url(crypto.getRandomValues(new Uint8Array(12)))}`;
  db.raw.prepare('INSERT INTO push_subscriptions (endpoint,user_id,p256dh,auth,prefs,created_at,updated_at) VALUES (?,?,?,?,?,0,0)').run(ep,'adm',base64url(await crypto.subtle.exportKey('raw',ua.publicKey)),base64url(crypto.getRandomValues(new Uint8Array(16))),JSON.stringify(prefs));return ep;};
 const hourly=await sub({flags:'hourly',quiet:{from:'23:00',to:'07:00'}}),instant=await sub({flags:'instant',quiet:null}),off=await sub({flags:'off'});
 const env={DB:db,VAPID_PUBLIC_KEY:KEYS.VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY:KEYS.VAPID_PRIVATE_KEY,VAPID_SUBJECT:'mailto:ops@nerulio.test'};
 let sent=[];const fetch=async(url,init)=>{sent.push({url:String(url),urgency:new Headers(init.headers).get('urgency')});return new Response(null,{status:201});};
 await notifyNewFlag(env,{target:'discussion:x',reason:'abuse',category:'csam',autoHidden:true,reports:1},{now,origin:ORIGIN,fetch});
 assert.deepEqual(sent.map(x=>x.url).sort(),[hourly,instant].sort(),'hourly devices too, even in quiet hours; never flags:off');
 assert.equal(sent[0].urgency,'high');
 sent=[];
 await notifyNewFlag(env,{target:'discussion:x',reason:'spam',category:'spam'},{now,origin:ORIGIN,fetch});
 assert.deepEqual(sent.map(x=>x.url),[instant],'a plain report: instant devices only');
 assert(off);
});

test('bans: 이 ID 차단 blocks the network from anonymous writing for N days; members are not affected',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 const p=(await post(b)).json.id;
 await h.member('mod','moderator');const mod=h.browser('192.0.2.1','mod');
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${p}`,action:'ban',reason:'도배 반복',days:7}})).status,200);
 const q=(await mod.call('GET','/mod/queue')).json;
 h.clock.now+=61e3;
 const r=await b.call('POST','/comments',{body:{postId:p,body:'차단된 댓글',password:'1234'}});
 assert.equal(r.status,403);assert.equal(r.json.error.reason,'banned');
 assert.equal((await h.browser('203.0.113.200').call('POST','/votes',{body:{kind:'discussion',id:p,value:1}})).status,403,'the whole /24');
 assert.equal((await post(h.browser('198.51.100.1'),{title:'다른 네트워크',body:'z'})).status,201);
 await h.member('mm');assert.equal((await h.browser('203.0.113.7','mm').call('POST','/comments',{body:{postId:p,body:'회원 댓글'}})).status,201,'members are not affected');
 // Members are restricted, not banned by network; anonymous rows cannot be "restricted".
 assert.equal((await mod.call('POST','/mod/action',{body:{target:'user:anon',action:'restrict',reason:'안 됨',days:7}})).status,400);
 assert(Array.isArray(q.items));
 h.clock.now+=8*864e5;
 assert.equal((await b.call('POST','/comments',{body:{postId:p,body:'차단 끝',password:'1234'}})).status,201,'the ban ends');
 // Unban lifts it at once.
 h.db.raw.exec(`UPDATE sessions SET expires_at=${h.clock.now+864e5}`);
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${p}`,action:'ban',reason:'다시 차단',days:1}})).status,200);
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${p}`,action:'unban',reason:'해제'}})).status,200);
 h.clock.now+=61e3;
 assert.equal((await b.call('POST','/comments',{body:{postId:p,body:'해제 뒤 댓글',password:'1234'}})).status,201);
});

test('retention: network keys, voter and reporter keys are dropped after 90 days; old counters and bans go',{skip},async()=>{
 const h=await harness(),b=h.browser();
 const p=(await post(b)).json.id;
 await h.browser('198.51.100.1').call('POST','/votes',{body:{kind:'discussion',id:p,value:1}});
 await h.browser('198.51.100.1').call('POST','/flags',{body:{target:`discussion:${p}`,reason:'spam'}});
 h.db.raw.exec(`INSERT INTO anon_bans (net,until,created_at) VALUES ('old',${T0-1},0)`);
 const later=T0+91*864e5;
 await h.db.batch(anonCleanupStatements(h.db,later));
 assert.equal(h.db.raw.prepare('SELECT anon_net FROM discussions WHERE id=?').get(p).anon_net,null);
 assert.equal(h.db.raw.prepare('SELECT anon_id FROM discussions WHERE id=?').get(p).anon_id.length,4,'the public ID stays with the post');
 assert.match(h.db.raw.prepare('SELECT voter FROM anon_votes').get().voter,/^x[0-9a-f]{24}$/);
 assert.equal(h.db.raw.prepare('SELECT reporter_key FROM content_flags').get().reporter_key,null);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM anon_counters').get().n,0);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM anon_bans').get().n,0);
});

/* ---------- images ---------- */

test('image check: magic bytes only, metadata and trailing data stripped, animation and GIF refused',()=>{
 const jpg=cleanImage(FIX('gps.jpg'));
 assert.equal(jpg.mime,'image/jpeg');assert.deepEqual([jpg.width,jpg.height],[64,48]);
 assert(jpg.stripped.includes('EXIF/XMP')&&jpg.stripped.includes('COM'));
 const s=Buffer.from(jpg.bytes).toString('latin1');
 assert(!s.includes('Exif')&&!s.includes('NeruCam')&&!s.includes('secret comment'),'EXIF (incl. GPS) and comments are gone');
 const webp=cleanImage(FIX('gps.webp'));
 assert.equal(webp.mime,'image/webp');assert(webp.stripped.includes('EXIF'));assert(!Buffer.from(webp.bytes).toString('latin1').includes('NeruCam'));
 assert.equal(Buffer.from(webp.bytes).readUInt32LE(4),webp.bytes.length-8,'RIFF size rewritten');
 const vp8x=Buffer.from(webp.bytes).indexOf('VP8X');if(vp8x>0)assert.equal(webp.bytes[vp8x+8]&0x0c,0,'EXIF/XMP flags cleared');
 const png=cleanImage(FIX('text.png'));assert(png.stripped.includes('tEXt'));assert(!Buffer.from(png.bytes).toString('latin1').includes('location'));
 assert.equal(cleanImage(FIX('lossless.webp')).width,64);
 assert.throws(()=>cleanImage(FIX('anim.webp')),{code:'ANIMATED'});
 assert.throws(()=>cleanImage(FIX('anim.png')),{code:'ANIMATED'});
 assert.throws(()=>cleanImage(FIX('anim.gif')),{code:'UNSUPPORTED'});
 assert.equal(sniff(FIX('anim.gif')),'gif');
 // Polyglots: an image with a ZIP/HTML tail loses the tail; markup inside kept segments is refused.
 const poly=cleanImage(new Uint8Array(Buffer.concat([FIX('gps.jpg'),Buffer.from('PK\x03\x04<html><script>alert(1)</script>')])));
 assert(poly.stripped.includes('trailing data'));assert(!Buffer.from(poly.bytes).toString('latin1').includes('<script'));
 const j=Buffer.from(FIX('gps.jpg')),app0=j.indexOf(Buffer.from([0xff,0xe0]));
 const html=Buffer.from('<html><body>hi</body></html>'),seg=Buffer.concat([Buffer.from([0xff,0xe2,0,html.length+2]),html]);
 const evil=Buffer.concat([j.subarray(0,app0),seg,j.subarray(app0)]);
 assert.throws(()=>cleanImage(new Uint8Array(evil)),{code:'MARKUP'});
 assert.throws(()=>cleanImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')),{code:'UNSUPPORTED'});
 assert.throws(()=>cleanImage(FIX('gps.jpg').subarray(0,400)),{code:'BAD_IMAGE'},'truncated');
 // Limits: bytes and pixels (IHDR says 5000×10).
 assert.throws(()=>cleanImage(new Uint8Array(IMAGE_LIMITS.maxBytes+1)),{code:'TOO_LARGE'});
 const big=Buffer.from(FIX('text.png'));big.writeUInt32BE(5000,16);
 assert.throws(()=>cleanImage(new Uint8Array(big)),{code:'TOO_BIG_DIMENSIONS'});
});

test('uploads: stored in R2, served only as part of a visible post, hidden → 404, deleted by a moderator → 451',{skip},async()=>{
 const h=await harness(),b=h.browser('203.0.113.7');
 const up=await b.call('POST','/uploads',{raw:FIX('gps.jpg'),type:'image/jpeg'});
 assert.equal(up.status,201,JSON.stringify(up.json));assert.match(up.json.url,/^\/u\/[0-9a-f]{24}\/full\.jpg$/);
 const row=h.db.raw.prepare('SELECT user_id,owner,r2_key,mime,width,height,sha256,anon_net FROM uploads WHERE id=?').get(up.json.id);
 assert.equal(row.user_id,'anon');assert.match(row.owner,/^a:[0-9a-f]{32}$/);assert.equal(row.mime,'image/jpeg');assert.match(row.anon_net,/^[0-9a-f]{32}$/);
 const stored=h.bucket.objects.get(row.r2_key);assert(stored);assert(!Buffer.from(stored.bytes).toString('latin1').includes('Exif'),'R2 holds the stripped file');
 assert.equal((await b.image(up.json.url)).status,404,'not part of a post yet');
 // Another browser cannot use it; a comment cannot carry images; the uploader's post can.
 const md=`사진 ![](${up.json.url})`;
 assert.equal((await post(h.browser('198.51.100.1'),{body:md})).json.error.reason,'image_ref');
 const p=await post(b,{body:md});assert.equal(p.status,201,JSON.stringify(p.json));
 assert.equal(h.db.raw.prepare('SELECT has_image FROM discussions WHERE id=?').get(p.json.id).has_image,1);
 assert.equal((await b.call('POST','/comments',{body:{postId:p.json.id,body:md,password:'1234'}})).json.error.reason,'images');
 const img=await h.browser('192.0.2.1').image(up.json.url);
 assert.equal(img.status,200);assert.equal(img.headers.get('content-type'),'image/jpeg');assert.equal(img.headers.get('x-content-type-options'),'nosniff');
 assert.match(img.headers.get('content-disposition'),/^inline/);assert.equal(img.headers.get('cache-control'),IMAGE_CACHE.control);assert.equal(img.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.match(img.headers.get('content-security-policy'),/sandbox/);
 assert.equal((await b.image(up.json.url.replace('.jpg','.webp'))).status,404,'extension must match the stored type');
 // Hidden: 404 for everyone but moderators (uncached).
 await h.member('mod','moderator');const mod=h.browser('192.0.2.9','mod');
 await mod.call('POST','/mod/action',{body:{target:`discussion:${p.json.id}`,action:'hide',reason:'확인 중'}});
 assert.equal((await h.browser('192.0.2.1').image(up.json.url)).status,404);
 const seen=await mod.image(up.json.url);assert.equal(seen.status,200);assert.equal(seen.headers.get('cache-control'),'private, no-store');
 const q=(await mod.call('GET','/mod/queue')).json;
 assert.deepEqual(q.hidden.find(x=>x.target===`discussion:${p.json.id}`).images,[up.json.url],'the queue shows the images');
 // Deleted by a moderator: gone from R2, 451.
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${p.json.id}`,action:'delete',reason:'불법촬영물 확인'}})).status,200);
 assert.equal(h.bucket.objects.has(row.r2_key),false);
 assert.equal((await mod.image(up.json.url)).status,451);
 assert.equal(h.db.raw.prepare('SELECT removed FROM uploads WHERE id=?').get(up.json.id).removed,'mod');
});

test('uploads: limits, types, ownership on edit, deletion with the post, NOT_CONFIGURED without R2',{skip},async()=>{
 const h=await harness(),b=h.browser();
 assert.equal((await b.call('POST','/uploads',{raw:FIX('anim.gif'),type:'image/gif'})).status,415);
 assert.equal((await b.call('POST','/uploads',{raw:FIX('anim.webp')})).json.error.reason,'ANIMATED');
 assert.equal((await b.call('POST','/uploads',{raw:new TextEncoder().encode('<html>'),type:'text/html'})).status,415);
 h.clock.now+=61e3;
 // Daily image quota per network (strict: 10 a day); refused files above did not count.
 for(let i=0;i<ANON.limits.strict.imagesPerDay;i++){if(i%12===11)h.clock.now+=61e3;assert.equal((await b.call('POST','/uploads',{raw:FIX('lossless.webp')})).status,201);}
 h.clock.now+=61e3;
 const over=await b.call('POST','/uploads',{raw:FIX('lossless.webp')});assert.equal(over.status,429);assert.equal(over.json.error.reason,'daily');
 // An anonymous post's images: an edit drops one (deleted from R2), deleting the post deletes the rest.
 const ids=((await h.db.raw.prepare("SELECT id FROM uploads WHERE user_id='anon' ORDER BY created_at LIMIT 2").all())).map(r=>`/u/${r.id}/full.webp`);
 const p=(await post(b,{body:ids.map(u=>`![](${u})`).join('\n')})).json;
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM uploads WHERE attached_id=?").get(p.id).n,2);
 const before=h.bucket.objects.size;
 assert.equal((await b.call('POST','/posts/edit',{body:{postId:p.id,title:'이미지 하나 뺌',body:`![](${ids[0]})`,password:'1234'}})).status,200);
 assert.equal(h.bucket.objects.size,before-1);
 assert.equal((await b.call('POST','/posts/delete',{body:{postId:p.id,password:'1234'}})).status,200);
 assert.equal(h.bucket.objects.size,before-2,'deleting the post deletes its images');
 // Members: their own quota and owner u:<id>; at most 10 images per post.
 await h.member('m');const m=h.browser('203.0.113.7','m');
 const mine=[];for(let i=0;i<11;i++){if(i===10)h.clock.now+=61e3;const r=await m.call('POST','/uploads',{raw:FIX('gps.webp')});assert.equal(r.status,201,JSON.stringify(r.json));mine.push(r.json.url);}
 assert.equal(h.db.raw.prepare('SELECT owner FROM uploads WHERE id=?').get(mine[0].split('/')[2]).owner,'u:u-m');
 const mp=body=>m.call('POST','/posts',{body:{entityId:'service:svc',kind:'free',title:'회원 사진',body}});
 assert.equal((await mp(mine.map(u=>`![](${u})`).join('\n'))).json.error.reason,'images','at most 10 per post');
 h.clock.now+=61e3;
 assert.equal((await mp(mine.slice(0,10).map(u=>`![](${u})`).join('\n'))).status,201);
 // Unused uploads are cleaned up after a day.
 const none=await harness({uploads:false});
 const nc=await none.browser().call('POST','/uploads',{raw:FIX('gps.webp')});
 assert.equal(nc.status,503);assert.deepEqual([nc.json.error.code,nc.json.need,nc.json.error.need],['NOT_CONFIGURED','UPLOADS','UPLOADS']);
 assert.equal((await none.browser().call('GET','/state')).json.uploads,null,'the picker stays hidden');
});

/* ---------- takedown: deleted, hidden and removed images and posts stop being served ---------- */

/** Cloudflare's Cache API (caches.default) in memory: keyed by the full URL (query included), honours
 * s-maxage/max-age and no-store/private on put, answers a hit with CF-Cache-Status: HIT. One instance is
 * one Cloudflare location. */
class CacheShim{
 constructor(clock){this.clock=clock;this.entries=new Map();}
 async match(req){
  const k=typeof req==='string'?req:req.url,e=this.entries.get(k);
  if(!e)return undefined;
  if(this.clock.now>=e.expires){this.entries.delete(k);return undefined;}
  const h=new Headers(e.headers);h.set('cf-cache-status','HIT');
  return new Response(e.bytes.slice(),{status:e.status,headers:h});
 }
 async put(req,res){
  const cc=res.headers.get('cache-control')||'';
  if(/no-store|private/.test(cc))return;
  const ttl=Number((/s-maxage=(\d+)/.exec(cc)||/max-age=(\d+)/.exec(cc)||[])[1]||0);
  if(!ttl)return;
  this.entries.set(typeof req==='string'?req:req.url,{bytes:new Uint8Array(await res.arrayBuffer()),status:res.status,headers:[...res.headers],expires:this.clock.now+ttl*1000});
 }
 async delete(req){return this.entries.delete(typeof req==='string'?req:req.url);}
 has(url){return this.entries.has(url);}
}
/** Run a test body with caches.default installed (and the image state memo empty). */
async function withCache(clock,fn){
 const before=Object.getOwnPropertyDescriptor(globalThis,'caches'),cache=new CacheShim(clock);
 Object.defineProperty(globalThis,'caches',{value:{default:cache},configurable:true,writable:true});
 resetImageStateCache();
 try{return await fn(cache);}
 finally{resetImageStateCache();if(before)Object.defineProperty(globalThis,'caches',before);else delete globalThis.caches;}
}
/** The preview alias a request arrives on, while SITE_URL (ORIGIN) names another host: the live bug. */
const PREVIEW='https://n2-preview.nerulio.test';
/** GET a platform page through its edge cache, as the Worker does. @returns {Promise<Response>} */
async function page(h,host,path){
 const pending=[],ctx={waitUntil:p=>pending.push(p)};
 const r=await handlePlatformPage(new Request(host+path),h.env,ctx,{origin:ORIGIN,now:()=>h.clock.now});
 await Promise.all(pending);return r;
}
/** GET an image, waiting for the edge copy to be stored. */
async function view(b,path,o={}){
 const pending=[],ctx={waitUntil:p=>pending.push(p)};
 const r=await b.image(path,{...o,ctx});await Promise.all(pending);return r;
}
/** An anonymous post with one image, posted on the preview host. */
async function imagePost(h){
 const b=h.browser('203.0.113.7');
 const up=await b.call('POST','/uploads',{raw:FIX('gps.jpg'),type:'image/jpeg',host:PREVIEW});
 assert.equal(up.status,201,JSON.stringify(up.json));
 const p=await post(b,{body:`사진 ![](${up.json.url})`});assert.equal(p.status,201,JSON.stringify(p.json));
 const {channel_id:ch,channel_no:no}=h.db.raw.prepare('SELECT channel_id,channel_no FROM discussions WHERE id=?').get(p.json.id);
 return {b,img:up.json.url,id:up.json.id,postId:p.json.id,postPath:`/ko/community/${ch}/${no}`,board:`/ko/community/${ch}/`};
}

test('purge origins: the request host, SITE_URL and the build URL, without repeats',()=>{
 assert.deepEqual(cacheOrigins(new URL('https://n2-preview.nerulio.pages.dev/api/v2/posts/delete'),{SITE_URL:'https://nerulio.pages.dev/'},{siteOrigin:'https://nerulio.pages.dev'}),
  ['https://n2-preview.nerulio.pages.dev','https://nerulio.pages.dev']);
 assert.deepEqual(cacheOrigins(new URL('https://nerulio.com/api/v2/mod/action'),{SITE_URL:'https://nerulio.com'},{siteOrigin:'https://nerulio.com'}),['https://nerulio.com']);
 assert.deepEqual(cacheOrigins(new URL('http://127.0.0.1:8788/api/v2/x'),{SITE_URL:'not a url'},{siteOrigin:''}),['http://127.0.0.1:8788']);
 const keys=imageCacheKeys(['https://a.test','https://b.test'],['abc12345']);
 assert.equal(keys.length,2*3*3,'every variant and extension under every origin');
 assert(keys.includes('https://b.test/u/abc12345/thumb.png')&&keys.includes('https://a.test/u/abc12345/full.webp'));
});

test('takedown: an author\'s password delete stops the image and the post at once under the request host and SITE_URL, query strings too',{skip},async()=>{
 const h=await harness();
 await withCache(h.clock,async cache=>{
  const x=await imagePost(h),viewer=h.browser('192.0.2.1');
  // Readers on both hosts: the page and the image are now edge-cached under each.
  for(const host of [PREVIEW,ORIGIN]){
   assert.equal((await page(h,host,x.postPath)).status,200);
   const feed=await page(h,host,'/ko/ai/svc/feed.xml');assert.match(await feed.text(),/익명 글 제목/);
   assert.equal(feed.headers.get('cache-control'),'public, max-age=0, s-maxage=60','post titles leave the feed within a minute');
   const r=await view(viewer,x.img,{host});assert.equal(r.status,200);
   assert.equal(r.headers.get('cache-control'),'private, max-age=3600','browsers keep it an hour, shared caches not at all');
   assert.equal((await view(viewer,x.img+'?v=1',{host})).status,200);
   assert(cache.has(host+x.postPath),`page cached under ${host}`);assert(cache.has(host+x.img),`image cached under ${host}`);
   assert(!cache.has(host+x.img+'?v=1'),'one edge copy per image, whatever the query string');
  }
  assert.match(cache.entries.get(ORIGIN+x.img).headers.find(([k])=>k==='cache-control')[1],/max-age=3600/,'the edge copy has its own lifetime');
  assert.equal((await page(h,PREVIEW,x.postPath)).headers.get('cf-cache-status'),'HIT','served from the edge cache');
  // The author deletes it by password on the preview host (SITE_URL is the other host).
  const del=await x.b.call('POST','/posts/delete',{body:{postId:x.postId,password:'1234'},host:PREVIEW});
  assert.equal(del.status,200,JSON.stringify(del.json));
  assert.equal(h.db.raw.prepare('SELECT removed FROM uploads WHERE id=?').get(x.id).removed,'author');
  for(const host of [PREVIEW,ORIGIN]){
   assert(!cache.has(host+x.postPath),`page purged under ${host}`);assert(!cache.has(host+x.img),`image purged under ${host}`);
   assert(!cache.has(host+'/ko/ai/svc/')&&!cache.has(host+'/en/ai/svc/'),'the tag page too');
   assert(!cache.has(host+x.board)&&!cache.has(host+x.board+'feed.xml'),'the channel board and its feed too');
   assert.equal((await page(h,host,x.postPath)).status,404,`post gone under ${host}`);
   assert.doesNotMatch(await (await page(h,host,'/ko/ai/svc/feed.xml')).text(),/익명 글 제목/,`feed under ${host}`);
   for(const path of [x.img,x.img+'?v=1',x.img+'?'+Math.random(),x.img.replace('/full.','/thumb.')]){
    const r=await viewer.image(path,{host});assert.equal(r.status,404,`${host}${path}`);assert.equal(r.headers.get('cache-control'),'no-store');
   }
  }
 });
});

test('takedown: an edge copy is never served without the state check (another location, another isolate)',{skip},async()=>{
 const h=await harness();
 await withCache(h.clock,async cache=>{
  const x=await imagePost(h),viewer=h.browser('192.0.2.1'),at=()=>h.clock.now;
  assert.equal((await view(viewer,x.img,{now:at})).status,200);assert(cache.has(ORIGIN+x.img));
  // Hidden where this location's cache and this isolate's memo were not told (no purge reaches here).
  h.db.raw.prepare("UPDATE discussions SET status='hidden' WHERE id=?").run(x.postId);
  h.clock.now+=IMAGE_CACHE.stateTtlMs;
  assert(cache.has(ORIGIN+x.img),'the edge copy is still there');
  assert.equal((await viewer.image(x.img,{now:at})).status,404,'the state check wins over the edge copy');
  assert.equal((await viewer.image(x.img+'?cache=bust',{now:at})).status,404,'a query string does not skip the check');
  // Restored: visible again at once (a hidden answer is never remembered).
  h.db.raw.prepare("UPDATE discussions SET status='published' WHERE id=?").run(x.postId);
  assert.equal((await viewer.image(x.img,{now:at})).status,200);
  // Removed by a moderator elsewhere: 451 once the remembered public answer is older than stateTtlMs.
  h.db.raw.prepare("UPDATE uploads SET status='deleted',removed='mod' WHERE id=?").run(x.id);
  h.clock.now+=IMAGE_CACHE.stateTtlMs-1;
  assert.equal((await viewer.image(x.img,{now:at})).status,200,'within the documented bound an isolate may still answer from its memo');
  h.clock.now+=1;
  const gone=await viewer.image(x.img,{now:at});assert.equal(gone.status,451);assert.equal(await gone.text(),'Unavailable for legal reasons');
  assert(IMAGE_CACHE.stateTtlMs<=60e3,'within a minute everywhere');
 });
});

test('takedown: a moderator\'s hide, restore and delete act at once on both hosts; 304 and HEAD keep the check',{skip},async()=>{
 const h=await harness();
 await withCache(h.clock,async cache=>{
  const x=await imagePost(h),viewer=h.browser('192.0.2.1');
  await h.member('mod','moderator');const mod=h.browser('192.0.2.9','mod');
  const warm=async()=>{for(const host of [PREVIEW,ORIGIN]){assert.equal((await page(h,host,x.postPath)).status,200);assert.equal((await view(viewer,x.img,{host})).status,200);}};
  await warm();
  // A browser revalidating gets a 304 without the bytes; HEAD answers without a body.
  const nm=await viewer.image(x.img,{headers:{'if-none-match':`"${x.id}"`}});assert.equal(nm.status,304);assert.equal(nm.body,null);
  const hd=await viewer.image(x.img,{method:'HEAD'});assert.equal(hd.status,200);assert.equal(await hd.text(),'');
  const act=async action=>{const r=await mod.call('POST','/mod/action',{body:{target:`discussion:${x.postId}`,action,reason:'확인 절차'},host:PREVIEW});assert.equal(r.status,200,JSON.stringify(r.json));};
  await act('hide');
  for(const host of [PREVIEW,ORIGIN]){
   assert(!cache.has(host+x.postPath)&&!cache.has(host+x.img),`purged under ${host}`);
   assert.equal((await page(h,host,x.postPath)).status,404);
   assert.equal((await viewer.image(x.img,{host})).status,404);assert.equal((await viewer.image(x.img+'?v=2',{host})).status,404);
  }
  assert.equal((await viewer.image(x.img,{headers:{'if-none-match':`"${x.id}"`}})).status,404,'no 304 for a hidden image');
  assert.equal((await mod.image(x.img)).status,200,'moderators still see it');
  await act('unhide');
  for(const host of [PREVIEW,ORIGIN]){assert.equal((await page(h,host,x.postPath)).status,200,'restored at once');assert.equal((await viewer.image(x.img,{host})).status,200);}
  await warm();
  await act('delete');
  for(const host of [PREVIEW,ORIGIN]){
   assert(!cache.has(host+x.postPath)&&!cache.has(host+x.img),`purged under ${host}`);
   assert.equal((await page(h,host,x.postPath)).status,404);
   for(const path of [x.img,x.img+'?v=1'])assert.equal((await viewer.image(path,{host})).status,451,`${host}${path}`);
  }
 });
});

test('takedown: auto-hide after reports (a severe category at once) takes the image and the page down on both hosts',{skip},async()=>{
 const h=await harness();
 await withCache(h.clock,async cache=>{
  const x=await imagePost(h),viewer=h.browser('192.0.2.1');
  for(const host of [PREVIEW,ORIGIN]){await page(h,host,x.postPath);await view(viewer,x.img,{host});}
  const r=await h.browser('198.51.100.20').call('POST','/flags',{body:{target:`discussion:${x.postId}`,reason:REPORT.severe[0]},host:PREVIEW});
  assert.equal(r.json.hidden,true,JSON.stringify(r.json));
  for(const host of [PREVIEW,ORIGIN]){
   assert(!cache.has(host+x.postPath)&&!cache.has(host+x.img),`purged under ${host}`);
   assert.equal((await page(h,host,x.postPath)).status,404);assert.equal((await viewer.image(x.img,{host})).status,404);
  }
 });
});

test('board display: anonymous "닉네임 (ID)" muted, members with ✓, the Radar bot with ⚙',()=>{
 const a=String(author({author_name:'ㅇㅇ',author_tier:'new',anon_id:'a3F9'},'ko'));
 assert.match(a,/class="nick anon"/);assert.match(a,/ㅇㅇ<span class="aid"> \(a3F9\)<\/span>/);assert(!a.includes('class="ck"'));
 const m=String(author({author_name:'지문테스터',author_tier:'new'},'ko'));
 assert.match(m,/class="nick mem"/);assert.match(m,/<a href="\/ko\/community\/u\/%EC%A7%80%EB%AC%B8%ED%85%8C%EC%8A%A4%ED%84%B0">지문테스터<\/a><b class="ck" title="고정닉 \(로그인 회원\)" role="img" aria-label="고정닉 \(로그인 회원\)"><svg class="i"/,'a member\'s name links to their profile, with the member check (an icon, not the ✓ glyph)');
 const t=String(author({author_name:'측정러',author_tier:'trusted'},'ko'));
 assert.match(t,/<b class="tb t-trusted" title="◆ 신뢰" role="img" aria-label="◆ 신뢰"><svg class="i"/,'tier badge as an icon with its name');
 assert(!/[⚙✎⚑◆◇✓](?![^<]*")/.test(t.replace(/"[^"]*"/g,'""')),'no emoji-prone glyph in the visible text');
 assert.match(String(author({author_name:'<b>x</b>',author_tier:'new',anon_id:'zz00'},'ko')),/&lt;b&gt;x&lt;\/b&gt;/,'names are escaped');
 assert.match(String(author({author_name:null,author_tier:'new',bot:true},'ko')),/nick bot[\s\S]*<svg class="i"/);
});
