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
   return {status:r.status,headers:r.headers,json:await r.json()};
  }};
 return h;
}

test('reading state is anonymous; member-only writes need an account, anonymous posts need a password',{skip},async()=>{
 const h=await harness();
 const s=await h.call('GET','/state?entity=game:steam-1');
 assert.equal(s.status,200);assert.equal(s.json.signedIn,false);
 const w=await h.call('POST','/posts',{body:{entityId:'game:steam-1',kind:'question',title:'질문 있어요',body:'본문'}});
 assert.equal(w.status,400);assert.equal(w.json.error.field,'password','writing without an account needs an edit password');
 for(const [path,body] of [['/follow',{entityId:'game:steam-1'}],['/profile',{displayName:'누구'}],['/rollout',{featureId:'feature:feat',hasIt:true}],['/reports',{kind:'issue',entityId:'service:svc',result:'broken'}]]){
  const r=await h.call('POST',path,{body});
  assert.equal(r.status,401,path);assert.equal(r.json.error.code,'LOGIN_REQUIRED');
 }
});

test('cross-site POSTs are refused before anything is read',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const r=await h.call('POST','/follow',{as:'a',origin:'https://evil.example',body:{entityId:'game:steam-1'}});
 assert.equal(r.status,403);assert.equal(r.json.error.code,'FORBIDDEN_ORIGIN');
});

test('posting: per-channel numbers, allowed tags only, public nickname never the account name',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const p1=await h.call('POST','/posts?l=ko',{as:'a',body:{entityId:'game:steam-1',kind:'patch',title:'패치 공지',body:'내용'}});
 assert.equal(p1.status,201);assert.equal(p1.json.postNo,1);assert.equal(p1.json.url,'/ko/community/games/1');assert.equal(p1.json.channel,'games');
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
 const np=await h.call('GET','/new-posts?channel=games&after=0');
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
 assert.equal(last.status,201);assert.match(last.json.url,/^\/ko\/community\/games\/\d+$/);
 assert.equal(last.json.verdict.verification,'COMMUNITY_VERIFIED');
 const row=h.db.raw.prepare("SELECT status,verification,confirmations FROM compatibility WHERE is_current=1 AND subject_id='translation_patch:test-game-ko' AND target_version='2.3.1'").get();
 assert.deepEqual({...row},{status:'works',verification:'COMMUNITY_VERIFIED',confirmations:3});
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM discussions WHERE entity_id='game:steam-1' AND kind='report' AND report_id IS NOT NULL").get().n,3);
 const bad=await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',result:'maybe'}});
 assert.equal(bad.status,400);
 const envBad=await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',result:'works',env:{'<x>':'y'}}});
 assert.equal(envBad.status,400);
});

test('a bare compat click is one vote per person: no post, a repeat changes the vote, counts agree',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const click=(as,result)=>h.call('POST','/reports',{as,body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',targetVersion:'2.3.1',result}});
 for(let i=0;i<3;i++)assert.equal((await click('a','works')).status,201);
 const r=await click('a','broken');assert.equal(r.json.vote,true);assert.equal(r.json.url,null);
 await click('b','works');
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM discussions WHERE kind='report'").get().n,0,'clicks never become posts');
 assert.equal(h.db.raw.prepare("SELECT COUNT(*) n FROM community_reports WHERE kind='compat'").get().n,2,'one row per person');
 const {compatReportCounts}=await import('../platform/db/channel.js');
 const counts=Object.fromEntries((await compatReportCounts(h.db,'translation_patch:test-game-ko','game:steam-1')).map(c=>[c.result,c.n]));
 assert.deepEqual(counts,{broken:1,works:1});
 // A detailed report of the same person is a post and replaces their vote in the counts.
 await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',targetId:'game:steam-1',targetVersion:'2.3.1',result:'works',comment:'Windows 11에서 문제 없음'}});
 const after=Object.fromEntries((await compatReportCounts(h.db,'translation_patch:test-game-ko','game:steam-1')).map(c=>[c.result,c.n]));
 assert.deepEqual(after,{works:2},'people, not clicks');
 // A detailed report naming a patch version also replaces the same person's bare vote.
 await click('b','works');
 await h.call('POST','/reports',{as:'b',body:{kind:'compat',entityId:'translation_patch:test-game-ko',subjectVersion:'1.7',targetId:'game:steam-1',targetVersion:'2.3.1',result:'broken',comment:'크래시'}});
 const final=Object.fromEntries((await compatReportCounts(h.db,'translation_patch:test-game-ko','game:steam-1')).map(c=>[c.result,c.n]));
 assert.deepEqual(final,{works:1,broken:1},'b counts once, with the report');
});

test('내 정보: my posts and comments, newest first, only mine',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'내 글',body:'x'}})).json;
 await h.call('POST','/comments',{as:'a',body:{postId:p.id,body:'내 댓글'}});
 await h.call('POST','/posts',{as:'b',body:{entityId:'game:steam-1',kind:'free',title:'남의 글',body:'x'}});
 const r=(await h.call('GET','/mine?l=ko',{as:'a'})).json;
 assert.deepEqual(r.posts.map(x=>x.title),['내 글']);assert.match(r.posts[0].url,/^\/ko\/community\/games\/\d+$/);
 assert.deepEqual(r.comments.map(x=>x.text),['내 댓글']);
 assert.equal((await h.call('GET','/mine')).status,401);
});

test('open data: published compat reports by month, no account data, cacheable',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 await h.call('POST','/reports',{as:'a',body:{kind:'compat',entityId:'translation_patch:test-game-ko',subjectVersion:'1.7',targetId:'game:steam-1',targetVersion:'2.3.1',result:'works',env:{os:'Windows 11',note:'비밀 메모'},comment:'내 PC에서 됨'}});
 const idx=await h.call('GET','/open-data/compat');
 assert.equal(idx.status,200);assert.equal(idx.json.license,'ODbL-1.0');assert.equal(idx.json.months.length,1);
 const r=await h.call('GET',idx.json.months[0].url.replace('/api/v2',''));
 assert.match(r.headers.get('cache-control'),/public/);
 const row=r.json.reports[0];
 assert.deepEqual({...row,day:undefined},{subject:'translation_patch:test-game-ko',subjectVersion:'1.7',target:'game:steam-1',targetVersion:'2.3.1',env:{os:'windows'},result:'works',day:undefined});
 assert(!JSON.stringify(r.json).includes('u-a')&&!JSON.stringify(r.json).includes('비밀')&&!JSON.stringify(r.json).includes('내 PC'),'no user ids, notes or comments');
 // A report whose post was deleted leaves the export.
 const post=h.db.raw.prepare("SELECT id FROM discussions WHERE report_id IS NOT NULL LIMIT 1").get();
 h.db.raw.prepare("UPDATE discussions SET status='deleted' WHERE id=?").run(post.id);
 assert.equal((await h.call('GET',idx.json.months[0].url.replace('/api/v2',''))).json.reports.length,0);
});

test('fact proposals: validated like seed facts, reviewed by a moderator, never above an official value',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('mod');
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('u-mod','운영자1','moderator',0,0)").run();
 const type=h.db.raw.prepare("SELECT type,vertical FROM entities WHERE id='game:steam-1'").get();
 const {typeDef,propertyDef}=await import('../platform/verticals/index.js');
 const prop=typeDef(type.vertical,type.type).props.find(p=>propertyDef(type.vertical,p)?.type==='date');
 const send=body=>h.call('POST','/facts/propose',{as:'a',body:{entityId:'game:steam-1',property:prop,sourceUrl:'https://example.com/news',...body}});
 assert.equal((await send({value:'next friday'})).status,400,'a date must be a date');
 assert.equal((await send({value:'2026-10-20',sourceUrl:'javascript:1'})).status,400,'a real source link');
 assert.equal((await send({property:'no_such_prop',value:'x'})).status,400);
 assert.equal((await send({value:'2026-10-20',unit:'<b>'})).status,400,'a unit only where the property takes one');
 const ok=await send({value:'2026-10-20',note:'공식 공지'});assert.equal(ok.status,201);
 const q=(await h.call('GET','/mod/queue',{as:'mod'})).json;
 assert.equal(q.proposals.length,1);assert.equal(q.proposals[0].value,'2026-10-20');
 assert.equal((await h.call('POST','/mod/action',{as:'mod',body:{target:q.proposals[0].target,action:'accept',reason:'공식 공지 확인'}})).status,200);
 const f=h.db.raw.prepare('SELECT value,verification FROM facts WHERE entity_id=? AND property=? AND is_current=1').get('game:steam-1',prop);
 assert.deepEqual({...f},{value:'"2026-10-20"',verification:'COMMUNITY_VERIFIED'});
 assert.equal((await h.call('GET','/mod/queue',{as:'mod'})).json.proposals.length,0);
 const radar=(await h.call('GET','/my-radar?l=ko',{as:'a'})).json;
 assert(radar.replies.some(x=>x.why==='proposal'&&/반영/.test(x.text)),'the proposer hears the outcome');
 assert.equal((await h.call('POST','/mod/action',{as:'mod',body:{target:q.proposals[0].target,action:'accept',reason:'again'}})).status,409,'reviewed once');
 assert.equal((await h.call('POST','/mod/action',{as:'a',body:{target:q.proposals[0].target,action:'accept',reason:'me'}})).status,404,'members cannot review');
 // An official value for one region stays what readers see after a community value for all regions.
 const {pickFact}=await import('../platform/db/channel.js');
 const rows=[{property:'price',plan:'*',platform:'*',region:'JP',language:'*',verification:'OFFICIAL',value:16500},{property:'price',plan:'*',platform:'*',region:'*',language:'*',verification:'COMMUNITY_VERIFIED',value:1}];
 assert.equal(pickFact(rows,'price',{region:'KR'}).value,16500);
 assert.equal(pickFact([...rows,{...rows[0],region:'KR',value:9900,verification:'COMMUNITY'}],'price',{region:'KR'}).value,9900,'the reader\'s own region still comes first');
});

test('reply alerts: comments on my posts and replies to my comments, unread until seen',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'내 글',body:'x'}})).json;
 const mine=(await h.call('POST','/comments',{as:'a',body:{postId:p.id,body:'내 댓글'}})).json;
 h.clock.now+=1000;await h.call('POST','/comments',{as:'b',body:{postId:p.id,body:'글에 댓글'}});
 h.clock.now+=1000;await h.call('POST','/comments',{as:'b',body:{postId:p.id,body:'답글',parentId:mine.id}});
 const r=(await h.call('GET','/my-radar?l=ko',{as:'a'})).json;
 assert.deepEqual(r.replies.map(x=>x.text),['답글','글에 댓글'],'newest first, own comments left out');
 assert.equal(r.unreadReplies,2);assert.equal(r.unread,2,'the header count includes replies');
 await h.call('POST','/my-radar/seen',{as:'a',body:{lastChangeId:0,repliesSeenAt:r.replies[0].at}});
 assert.equal((await h.call('GET','/my-radar?l=ko',{as:'a'})).json.unreadReplies,0);
 assert.equal((await h.call('GET','/my-radar?l=ko',{as:'b'})).json.replies.length,0,'b wrote them');
});

test('channels: 말머리 of the channel, 0–3 tags from any area, 공지 staff-only, 건의 in 공지·건의',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('mod');
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('u-mod','운영자1','moderator',0,0)").run();
 await ingest(h.db,{schema:'nerulio.seed/1',vertical:'studio',sources:[{id:'src:s',kind:'OFFICIAL',url:'https://example.com/s',retrieved:'2026-09-01'}],entities:[{id:'app:test-daw',type:'app',slug:'test-daw',names:{en:'Test DAW'}}]},{mode:'seed',actor:'seed',now:T0});
 const post=(as,body)=>{h.clock.now+=61e3;return h.call('POST','/posts?l=ko',{as,body:{title:'채널 글입니다',body:'x',...body}});};
 // Every channel is open (no "준비 중").
 const st=await post('a',{channel:'studio',kind:'report',tags:['app:test-daw']});
 assert.equal(st.status,201,st.text);assert.equal(st.json.url,'/ko/community/studio/1');
 // A tag from another area: an AI post tagged with a game shows on the game's page too.
 const cross=await post('a',{channel:'ai',kind:'review',tags:['service:svc','game:steam-1']});
 assert.equal(cross.status,201,cross.text);
 const tags=h.db.raw.prepare('SELECT entity_id FROM discussion_tags WHERE discussion_id=? ORDER BY pos').all(cross.json.id).map(r=>r.entity_id);
 assert.deepEqual(tags,['service:svc','game:steam-1']);
 const d=h.db.raw.prepare('SELECT kind,flair,channel_id,channel_no FROM discussions WHERE id=?').get(cross.json.id);
 assert.deepEqual({...d},{kind:'free',flair:'review',channel_id:'ai',channel_no:1},'사용기 is stored as a flair; kind keeps a value its CHECK accepts');
 // 자유 without tags.
 assert.equal((await post('a',{channel:'free',kind:'free',tags:[]})).status,201);
 // Refusals: a 말머리 of another channel, 4 tags, an unknown tag, a placeholder tag, no channel, member 공지.
 assert.equal((await post('a',{channel:'ai',kind:'patch',tags:[]})).json.error.field,'kind');
 assert.equal((await post('a',{channel:'free',kind:'free',tags:['service:svc','game:steam-1','app:test-daw','translation_patch:test-game-ko']})).json.error.field,'tags');
 assert.equal((await post('a',{channel:'free',kind:'free',tags:['game:nope']})).status,400);
 assert.equal((await post('a',{channel:'free',kind:'free',tags:['channel:ai']})).status,400);
 assert.equal((await post('a',{channel:'nope',kind:'free'})).json.error.field,'channel');
 assert.equal((await post('a',{channel:'games',kind:'notice',tags:[]})).status,400,'공지 is staff-only');
 assert.equal((await post('a',{channel:'notice',kind:'feedback',tags:[]})).status,201,'anyone may leave 건의');
 assert.equal((await post('mod',{channel:'studio',kind:'notice',tags:[]})).status,201,'staff 공지 in any channel');
 // The old entity-based body still works: the entity's default channel with it as the only tag.
 h.clock.now+=61e3;
 const old=await h.call('POST','/posts',{as:'a',body:{entityId:'app:test-daw',kind:'free',title:'예전 방식',body:'x'}});
 assert.equal(old.status,201);assert.equal(old.json.channel,'studio');
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

test('flags: one open flag per reporter and target, validated reason and target',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'신고될 글',body:'x'}})).json;
 assert.equal((await h.call('POST','/flags',{as:'a',body:{target:`discussion:${p.id}`,reason:'copyright',note:'원본은 여기'}})).status,201);
 const again=await h.call('POST','/flags',{as:'a',body:{target:`discussion:${p.id}`,reason:'spam'}});
 assert.equal(again.status,200);assert.deepEqual([again.json.updated,again.json.previousReason],[true,'copyright'],'the reporter is told the earlier reason was replaced');
 assert.equal((await h.call('POST','/flags',{as:'a',body:{target:'discussion:does-not-exist',reason:'spam'}})).status,404,'nothing to report');
 const rows=h.db.raw.prepare("SELECT reason FROM content_flags WHERE target_id=?").all(p.id);
 assert.deepEqual(rows.map(r=>r.reason),['spam'],'the repeat updates the open flag');
 assert.equal((await h.call('POST','/flags',{as:'a',body:{target:'javascript:alert(1)',reason:'spam'}})).status,400);
 assert.equal((await h.call('POST','/flags',{as:'a',body:{target:'comment:x',reason:'because'}})).status,400);
 assert.equal((await h.call('POST','/flags',{body:{target:'comment:x',reason:'spam'}})).status,404,'signed-out reports work too (the target must exist)');
});

test('benchmarks: a model measured on a GPU, tokens/s bounded, shown as a median',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 await ingest(h.db,{schema:'nerulio.seed/1',vertical:'hardware',sources:[{id:'src:h',kind:'OFFICIAL',url:'https://example.com/g',retrieved:'2026-09-01'}],entities:[{id:'gpu:test-12',type:'gpu',slug:'test-12',names:{en:'Test 12'},facts:[{p:'vram_gb',v:12,ver:'OFFICIAL',src:'src:h'}]}]},{mode:'seed',actor:'seed',now:T0});
 await ingest(h.db,{schema:'nerulio.seed/1',vertical:'ai',sources:[],entities:[{id:'model:open-8b',type:'model',slug:'open-8b',names:{en:'Open 8B'},facts:[{p:'parameters_b',v:8,ver:'OFFICIAL',src:'src:h'},{p:'open_weights',v:true,ver:'OFFICIAL',src:'src:h'}]}]},{mode:'seed',actor:'seed',now:T0});
 for(const [who,tps] of [['a',40],['b',50]])assert.equal((await h.call('POST','/reports',{as:who,body:{kind:'benchmark',entityId:'model:open-8b',targetId:'gpu:test-12',metrics:{tokens_per_s:tps},env:{runtime:'llama.cpp',quant:'Q4_K_M'}}})).status,201);
 assert.equal((await h.call('POST','/reports',{as:'a',body:{kind:'benchmark',entityId:'model:open-8b',targetId:'gpu:test-12',metrics:{tokens_per_s:99999}}})).status,400);
 assert.equal((await h.call('POST','/reports',{as:'a',body:{kind:'benchmark',entityId:'gpu:test-12',targetId:'model:open-8b',metrics:{tokens_per_s:5}}})).status,400,'model on GPU, not the reverse');
 const {loadLocalLlm,renderLocalLlm}=await import('../platform/render/localllm.js');
 const {entitiesByIds}=await import('../platform/db/channel.js');
 const gpu=(await entitiesByIds(h.db,['gpu:test-12'])).get('gpu:test-12');
 const out=String(renderLocalLlm(await loadLocalLlm(h.db,gpu,{l:'ko',now:T0}),{origin:ORIGIN}));
 assert(out.includes('Test 12에서 돌아가는 로컬 LLM')&&out.includes('<b>45</b> tok/s')&&out.includes('추정 방법'));
 assert(/class="fy"><b>맞음<\/b>/.test(out),'8B at Q4_K_M fits in 12 GB (estimate)');
});

test('My Radar: changes and posts of followed channels, unread until seen',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 assert.equal((await h.call('GET','/my-radar',{as:'a'})).json.following,0);
 await h.call('POST','/follow',{as:'a',body:{entityId:'game:steam-1'}});
 await ingest(h.db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',versions:[{version:'2.4.0',released:'2026-09-28',src:'src:t'}]}]},{mode:'collector',actor:'collector:steam',now:T0});
 await h.call('POST','/posts',{as:'b',body:{entityId:'game:steam-1',kind:'question',title:'2.4 패치 됨?',body:'x'}});
 const r=(await h.call('GET','/my-radar?l=ko',{as:'a'})).json;
 assert.equal(r.following,1);assert(r.unread>=1);assert(r.changes.some(c=>c.title.includes('2.4.0')));assert.equal(r.posts[0].url,'/ko/community/games/1');
 await h.call('POST','/my-radar/seen',{as:'a',body:{lastChangeId:r.lastChangeId}});
 assert.equal((await h.call('GET','/my-radar',{as:'a'})).json.unread,0);
 assert.equal((await h.call('GET','/my-radar')).status,401);
});

test('moderation: queue is hidden from members; hide = 임시조치 with a logged reason, restore, restrict',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('mod');
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('u-mod','운영자1','moderator',0,0)").run();
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'문제 있는 글',body:'x'}})).json;
 await h.call('POST','/flags',{as:'mod',body:{target:`discussion:${p.id}`,reason:'copyright',note:'권리자 요청'}});
 assert.equal((await h.call('GET','/mod/queue',{as:'a'})).status,404,'members do not see the queue');
 const q=(await h.call('GET','/mod/queue',{as:'mod'})).json;
 assert.equal(q.items[0].target,`discussion:${p.id}`);assert.deepEqual(q.items[0].reasons,['copyright']);
 assert.equal((await h.call('POST','/mod/action',{as:'mod',body:{target:`discussion:${p.id}`,action:'hide'}})).status,400,'a reason is required');
 assert.equal((await h.call('POST','/mod/action',{as:'mod',body:{target:`discussion:${p.id}`,action:'hide',reason:'권리 침해 신고로 임시조치'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p.id).status,'hidden');
 const after=(await h.call('GET','/mod/queue',{as:'mod'})).json;
 assert.equal(after.items.length,0,'the flag is resolved');
 assert.equal(after.hidden[0].target,`discussion:${p.id}`,'hidden content stays reachable for moderators');
 assert.deepEqual([after.hidden[0].preview,after.hidden[0].reason,after.hidden[0].status],['문제 있는 글','권리 침해 신고로 임시조치','hidden']);
 await h.call('POST','/mod/action',{as:'mod',body:{target:`discussion:${p.id}`,action:'unhide',reason:'게시자 소명 확인'}});
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p.id).status,'published');
 assert.equal((await h.call('GET','/mod/queue',{as:'mod'})).json.hidden.length,0,'restored content leaves the hidden list');
 await h.call('POST','/mod/action',{as:'mod',body:{target:'user:u-a',action:'restrict',reason:'도배',days:3}});
 assert.equal((await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'또 올림',body:'x'}})).status,403);
 assert.equal(h.db.raw.prepare('SELECT COUNT(*) n FROM moderation_actions').get().n,3,'every action is logged');
 await h.signIn('b');
 assert.equal((await h.call('POST','/mod/action',{as:'b',body:{target:'user:u-mod',action:'restrict',reason:'보복'}})).status,404,'members cannot moderate');
});

test('transparency page shows monthly aggregates only',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('mod');
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('u-mod','운영자1','moderator',0,0)").run();
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'비밀 제목',body:'x'}})).json;
 await h.call('POST','/flags',{as:'a',body:{target:`discussion:${p.id}`,reason:'spam'}});
 await h.call('POST','/mod/action',{as:'mod',body:{target:`discussion:${p.id}`,action:'hide',reason:'도배'}});
 const {loadTransparency,renderTransparency}=await import('../platform/render/transparency.js');
 const out=String(renderTransparency(await loadTransparency(h.db,{l:'ko',now:T0+1000}),{origin:ORIGIN}));
 assert(out.includes('2026-09')&&out.includes('임시조치(숨김)'));
 assert(!out.includes('비밀 제목')&&!out.includes(p.id)&&!out.includes('운영자1'),'no targets or moderators');
});

test('review fixes: role hierarchy, reserved and case-insensitive nicknames, no votes on hidden posts, restore keeps the previous state',{skip},async()=>{
 const h=await harness();for(const n of ['a','b','mod','mod2','adm'])await h.signIn(n);
 h.db.raw.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES ('u-mod','운영자1','moderator',0,0),('u-mod2','운영자2','moderator',0,0),('u-adm','관리1','admin',0,0)").run();
 const act=(as,target,action)=>h.call('POST','/mod/action',{as,body:{target,action,reason:'테스트 사유'}});
 assert.equal((await act('mod','user:u-adm','restrict')).status,403,'a moderator cannot restrict an admin');
 assert.equal((await act('mod','user:u-mod2','restrict')).status,403,'nor another moderator');
 assert.equal((await act('mod','user:u-mod','restrict')).status,403,'nor themselves');
 assert.equal((await act('mod','user:nobody','restrict')).status,404);
 assert.equal((await act('adm','user:u-mod','restrict')).status,200,'an admin can restrict a moderator');
 assert.equal((await act('mod','discussion:missing','hide')).status,403,'a restricted moderator cannot act');
 // nicknames
 assert.equal((await h.call('POST','/profile',{as:'a',body:{displayName:'user-abcdef'}})).status,400,'default form is reserved');
 assert.equal((await h.call('POST','/profile',{as:'a',body:{displayName:'Rogue'}})).status,200);
 assert.equal((await h.call('POST','/profile',{as:'b',body:{displayName:'rogue'}})).status,409,'case-insensitive');
 // votes on hidden posts; restore keeps "locked"
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'잠긴 글',body:'x'}})).json;
 h.db.raw.prepare("UPDATE discussions SET status='locked' WHERE id=?").run(p.id);
 assert.equal((await act('adm',`discussion:${p.id}`,'hide')).status,200);
 assert.equal((await h.call('POST','/votes',{as:'b',body:{kind:'discussion',id:p.id,value:1}})).status,404,'no votes on hidden posts');
 assert.equal((await act('adm',`discussion:${p.id}`,'unhide')).status,200);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p.id).status,'locked','restored to its previous state');
 h.db.raw.prepare("UPDATE discussions SET status='deleted' WHERE id=?").run(p.id);
 assert.equal((await act('adm',`discussion:${p.id}`,'hide')).status,409,'an author-deleted post is not hidden (and so never republished)');
});

test('authors edit and delete their own posts and comments; nobody else can',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const p=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'free',title:'처음 제목',body:'처음'}})).json;
 assert.equal((await h.call('GET',`/posts/source?id=${p.id}`,{as:'b'})).status,404);
 assert.equal((await h.call('GET',`/posts/source?id=${p.id}`,{as:'a'})).json.body,'처음');
 assert.equal((await h.call('POST','/posts/edit',{as:'b',body:{postId:p.id,title:'남의 글 수정',body:'x'}})).status,404);
 assert.equal((await h.call('POST','/posts/edit',{as:'a',body:{postId:p.id,title:'고친 제목',body:'고침'}})).status,200);
 const src=(await h.call('GET',`/posts/source?id=${p.id}`,{as:'a'})).json;
 assert(src.kinds.some(k=>k.id==='question')&&!src.kinds.some(k=>k.id==='report'),'tags the author may switch to');
 assert.equal((await h.call('POST','/posts/edit',{as:'a',body:{postId:p.id,title:'고친 제목',body:'고침',kind:'question'}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT kind FROM discussions WHERE id=?').get(p.id).kind,'question');
 assert.equal((await h.call('POST','/posts/edit',{as:'a',body:{postId:p.id,title:'고친 제목',body:'고침',kind:'report'}})).status,400,'not into a 리포트');
 assert.ok(h.db.raw.prepare('SELECT edited_at FROM discussions WHERE id=?').get(p.id).edited_at);
 const c=(await h.call('POST','/comments',{as:'b',body:{postId:p.id,body:'댓글'}})).json;
 assert.equal((await h.call('POST','/comments/delete',{as:'a',body:{commentId:c.id}})).status,404,'the post author cannot delete others\' comments');
 assert.equal((await h.call('POST','/comments/delete',{as:'b',body:{commentId:c.id}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT comment_count FROM discussions WHERE id=?').get(p.id).comment_count,0);
 const st=(await h.call('GET',`/state?post=${p.id}`,{as:'a'})).json;assert.equal(st.mine.post,true);
 assert.equal((await h.call('POST','/posts/delete',{as:'a',body:{postId:p.id}})).status,200);
 assert.equal(h.db.raw.prepare('SELECT status FROM discussions WHERE id=?').get(p.id).status,'deleted');
 assert.equal((await h.call('POST','/posts/edit',{as:'a',body:{postId:p.id,title:'되살리기',body:'x'}})).status,404,'deleted stays deleted');
});

test('question authors accept an answer; the post becomes a QAPage with acceptedAnswer and leaves "unanswered"',{skip},async()=>{
 const h=await harness();await h.signIn('a');await h.signIn('b');
 const q=(await h.call('POST','/posts',{as:'a',body:{entityId:'game:steam-1',kind:'question',title:'패치 어디서 받아요?',body:'질문'}})).json;
 const c=(await h.call('POST','/comments',{as:'b',body:{postId:q.id,body:'제작자 블로그에서요'}})).json;
 const mine=(await h.call('POST','/comments',{as:'a',body:{postId:q.id,body:'감사합니다'}})).json;
 assert.equal((await h.call('POST','/posts/solve',{as:'b',body:{postId:q.id,commentId:c.id}})).status,404,'only the asker');
 assert.equal((await h.call('POST','/posts/solve',{as:'a',body:{postId:q.id,commentId:mine.id}})).status,400,'not your own comment');
 assert.equal((await h.call('POST','/posts/solve',{as:'a',body:{postId:q.id,commentId:c.id}})).json.solved,c.id);
 const {loadPost,renderPost}=await import('../platform/render/post.js');const {entitiesByIds,frontPosts}=await import('../platform/db/channel.js');
 const game=(await entitiesByIds(h.db,['game:steam-1'])).get('game:steam-1');
 const out=String(renderPost(await loadPost(h.db,'games',1,{l:'ko',now:T0}),{origin:ORIGIN}));
 assert(out.includes('✓ 채택된 답변'));
 const ld=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(out)[1]);
 assert.equal(ld['@type'],'QAPage');assert.equal(ld.mainEntity.acceptedAnswer.text,'제작자 블로그에서요');
 assert.equal((await frontPosts(h.db,{mode:'kind',kind:'question',unanswered:true})).length,0);
});

test('pins: members keep channel pins on the account; tag search finds entities; members propose new tags',{skip},async()=>{
 const h=await harness();await h.signIn('a');
 assert.deepEqual((await h.call('GET','/pins',{as:'a'})).json,{pins:[]});
 assert.deepEqual((await h.call('POST','/pins',{as:'a',body:{channels:['games','ai','games']}})).json,{pins:['games','ai']},'order kept, duplicates dropped');
 assert.deepEqual((await h.call('GET','/pins',{as:'a'})).json,{pins:['games','ai']});
 assert.equal((await h.call('POST','/pins',{as:'a',body:{channels:['notice']}})).status,400,'공지·건의 is not on the bar');
 assert.equal((await h.call('POST','/pins',{as:'a',body:{channels:['nope']}})).status,400);
 const found=(await h.call('GET','/tags?q=svc&l=ko')).json.tags;
 assert(found.some(t=>t.id==='service:svc'&&t.url==='/ko/ai/svc/'&&t.channel==='ai'),JSON.stringify(found));
 assert.deepEqual((await h.call('GET','/tags?q=&l=ko')).json.tags,[]);
 const pr=await h.call('POST','/tags/propose',{as:'a',body:{name:'새 게임 이름',channel:'games',sourceUrl:'https://store.steampowered.com/app/1/',note:'출시 예정'}});
 assert.equal(pr.status,201,pr.text);
 assert.deepEqual({...h.db.raw.prepare('SELECT name,channel_id,status FROM tag_proposals WHERE id=?').get(pr.json.id)},{name:'새 게임 이름',channel_id:'games',status:'open'});
 assert.equal((await h.call('POST','/tags/propose',{as:'a',body:{name:'잡담 태그',channel:'free'}})).status,400,'자유 has no tag kinds');
 assert.equal((await h.call('POST','/tags/propose',{as:'a',body:{name:'x',channel:'games'}})).status,400,'too short');
 assert.equal((await h.call('POST','/tags/propose',{as:'a',body:{name:'링크',channel:'games',sourceUrl:'javascript:alert(1)'}})).status,400);
});

