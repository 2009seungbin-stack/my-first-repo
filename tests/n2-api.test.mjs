import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {handlePlatformApi} from '../server/platform/api.js';
import {sha256,base64url} from '../server/crypto.js';
import {createLimiter} from '../server/ratelimit.js';
import {ingest} from '../platform/ingest.js';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',SECRET='test-session-secret-0123456789abcdef-0123456789',T0=Date.UTC(2026,8,28,6,0);
const SEED={schema:'nerulio.seed/1',vertical:'games',sources:[{id:'src:t',kind:'OFFICIAL',url:'https://example.com/',retrieved:'2026-09-01'}],entities:[
 {id:'game:steam-1',type:'game',slug:'test-game',names:{en:'Test Game',ko:'테스트 게임'},versions:[{version:'2.3.1',released:'2026-09-20',src:'src:t'}]},
 {id:'translation_patch:test-game-ko',type:'translation_patch',slug:'test-game-korean-patch',names:{en:'Test Game Korean patch',ko:'테스트 게임 한글패치'},relations:[{p:'translates',o:'game:steam-1',src:'src:t'}]}]};

async function harness(){
 const db=D1Shim.migrated(),clock={now:T0},limiter=createLimiter();
 await ingest(db,SEED,{mode:'seed',actor:'seed',now:T0-864e5});
 await ingest(db,{schema:'nerulio.seed/1',vertical:'ai',sources:[],entities:[{id:'service:svc',type:'service',slug:'svc',names:{en:'Svc'}},{id:'feature:feat',type:'feature',slug:'feat',names:{en:'Feat'}}]},{mode:'seed',actor:'seed',now:T0-864e5});
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN};
 const users={};
 const h={db,clock,
  async signIn(name){
   const id='u-'+name,token=base64url(crypto.getRandomValues(new Uint8Array(32)));
   await db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,?2,?3,'google',?4,?5)").bind(id,`${name}@example.test`,`Real Name ${name}`,'sub-'+name,T0-30*864e5).run();
   await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,T0,T0+864e5).run();
   users[name]=token;return id;
  },
  async call(method,path,{body,as,origin=ORIGIN}={}){
   const headers=new Headers();
   if(as)headers.set('cookie',`nerulio_session=${users[as]}`);
   if(method==='POST'&&origin)headers.set('origin',origin);
   if(body!==undefined)headers.set('content-type','application/json');
   const r=await handlePlatformApi(new Request(ORIGIN+'/api/v2'+path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined}),env,null,{now:()=>clock.now,limiter});
   return {status:r.status,json:await r.json()};
  }};
 return h;
}

test('reading state is anonymous; every write needs an account',{skip},async()=>{
 const h=await harness();
 const s=await h.call('GET','/state?entity=game:steam-1');
 assert.equal(s.status,200);assert.equal(s.json.signedIn,false);
 const w=await h.call('POST','/posts',{body:{entityId:'game:steam-1',kind:'question',title:'질문 있어요',body:'본문'}});
 assert.equal(w.status,401);assert.equal(w.json.error.code,'LOGIN_REQUIRED');
});

test('cross-site POSTs are refused before anything is read',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const r=await h.call('POST','/follow',{as:'a',origin:'https://evil.example',body:{entityId:'game:steam-1'}});
 assert.equal(r.status,403);assert.equal(r.json.error.code,'FORBIDDEN_ORIGIN');
});

test('posting: per-channel numbers, allowed tags only, public nickname never the account name',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const p1=await h.call('POST','/posts?l=ko',{as:'a',body:{entityId:'game:steam-1',kind:'patch',title:'패치 공지',body:'내용'}});
 assert.equal(p1.status,201);assert.equal(p1.json.postNo,1);assert.equal(p1.json.url,'/ko/games/test-game/1');
 const p2=await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'question',title:'두 번째',body:'x'}});
 assert.equal(p2.json.postNo,2);
 const bad=await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'patch',title:'패치?',body:'x'}});
 assert.equal(bad.status,400,'한글패치 tag is games-only');
 const notice=await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'notice',title:'공지',body:'x'}});
 assert.equal(notice.status,400,'notice is staff-only');
 const short=await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'free',title:'a',body:'x'}});
 assert.equal(short.status,400);assert.equal(short.json.error.field,'title');
 const extra=await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'free',title:'제목입니다',body:'x',author_id:'system:radar-bot'}});
 assert.equal(extra.status,400,'unknown fields are refused');
 const prof=h.db.raw.prepare("SELECT display_name FROM user_profiles WHERE user_id='u-a'").get();
 assert.match(prof.display_name,/^user-/);assert(!prof.display_name.includes('Real Name'));
 assert.equal((await h.call('POST','/profile',{as:'a',body:{displayName:'레이더봇'}})).status,400,'reserved nickname');
 assert.equal((await h.call('POST','/profile',{as:'a',body:{displayName:'로그라이커'}})).json.displayName,'로그라이커');
 await h.signIn('b');
 assert.equal((await h.call('POST','/profile',{as:'b',body:{displayName:'로그라이커'}})).status,409,'nicknames are unique');
});

test('posting is rate limited per account',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const statuses=[];
 for(let i=0;i<4;i++)statuses.push((await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'free',title:`제목 ${i}`,body:'x'}})).status);
 assert.deepEqual(statuses,[201,201,201,429]);
 h.clock.now+=61e3;
 assert.equal((await h.call('POST','/posts',{as:'a',body:{entityId:'service:svc',kind:'free',title:'다음 분',body:'x'}})).status,201);
});

test('comments thread under their post, update counts; votes are one per user and never on your own post',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'question',title:'업뎃 후 패치?',body:'x'}})).json;
 const c1=await h.call('POST','/comments',{as:'b',body:{postId:p.id,body:'다시 깔아야 해요'}});
 assert.equal(c1.status,201);
 const c2=await h.call('POST','/comments',{as:'a',body:{postId:p.id,parentId:c1.json.id,body:'감사합니다'}});
 assert.equal(c2.status,201);
 assert.equal((await h.call('POST','/comments',{as:'a',body:{postId:p.id,parentId:'nope',body:'x'}})).status,400);
 assert.equal(h.db.raw.prepare('SELECT comment_count FROM discussions WHERE id=?').get(p.id).comment_count,2);
 assert.equal((await h.call('POST','/votes',{as:'a',body:{kind:'discussion',id:p.id,value:1}})).status,403,'own post');
 const v=await h.call('POST','/votes',{as:'b',body:{kind:'discussion',id:p.id,value:1}});
 assert.deepEqual([v.status,v.json.up],[200,1]);
 assert.equal((await h.call('POST','/votes',{as:'b',body:{kind:'discussion',id:p.id,value:1}})).json.up,1,'voting again does not add');
 const st=await h.call('GET',`/state?entity=game:steam-1&post=${p.id}`,{as:'b'});
 assert.equal(st.json.votes[p.id],1);
 const np=await h.call('GET','/new-posts?entity=game:steam-1&after=0');
 assert.deepEqual(np.json,{count:1,last:1});
});

test('follow toggles and counts followers',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 assert.deepEqual((await h.call('POST','/follow',{as:'a',body:{entityId:'game:steam-1',follow:true}})).json,{following:true,followers:1});
 assert.equal((await h.call('GET','/state?entity=game:steam-1',{as:'a'})).json.following,true);
 assert.deepEqual((await h.call('POST','/follow',{as:'a',body:{entityId:'game:steam-1',follow:false}})).json,{following:false,followers:0});
 assert.equal((await h.call('POST','/follow',{as:'a',body:{entityId:'game:nope'}})).status,404);
});

test('a compat report becomes a 리포트 post in the game channel and moves the community verdict',{skip},async()=>{
 const h=await harness();
 for(const n of ['a','b','c'])await h.signIn(n);
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,tier,created_at,updated_at) VALUES ('u-c','숙련자','trusted',0,0)").run();
 let last;
 for(const n of ['a','b','c'])last=await h.call('POST','/reports',{as:n,body:{kind:'compat',entityId:'translation_patch:test-game-ko',subjectVersion:'1.7',targetId:'game:steam-1',targetVersion:'2.3.1',result:'works',env:{os:'Windows 11'}}});
 assert.equal(last.status,201);assert.match(last.json.url,/^\/ko\/games\/test-game\/\d+$/);
 assert.equal(last.json.verdict.verification,'COMMUNITY_VERIFIED');
 const row=h.db.raw.prepare("SELECT status,verification,confirmations FROM compatibility WHERE is_current=1 AND subject_id='translation_patch:test-game-ko' AND target_version='2.3.1'").get();
 assert.deepEqual({...row},{status:'works',verification:'COMMUNITY_VERIFIED',confirmations:3});
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM discussions WHERE entity_id='game:steam-1' AND kind='report' AND report_id IS NOT NULL").get().n,3);
 const bad=await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',result:'maybe'}});
 assert.equal(bad.status,400);
 const envBad=await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',result:'works',env:{'<x>':'y'}}});
 assert.equal(envBad.status,400);
});

test('rollout votes: one per user per feature, features only',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 assert.equal((await h.call('POST','/rollout',{as:'a',body:{featureId:'feature:feat',hasIt:true,country:'KR',platform:'ios'}})).status,200);
 assert.equal((await h.call('POST','/rollout',{as:'a',body:{featureId:'feature:feat',hasIt:false,country:'KR'}})).status,200);
 const rows=h.db.raw.prepare("SELECT has_it,country FROM rollout_votes WHERE feature_id='feature:feat'").all();
 assert.deepEqual(rows.map(r=>({...r})),[{has_it:0,country:'KR'}]);
 assert.equal((await h.call('POST','/rollout',{as:'a',body:{featureId:'service:svc',hasIt:true}})).status,400);
});

test('banned and restricted accounts cannot write',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,banned_at,created_at,updated_at) VALUES ('u-a','x',1,0,0)").run();
 assert.equal((await h.call('POST','/follow',{as:'a',body:{entityId:'game:steam-1'}})).status,403);
});
