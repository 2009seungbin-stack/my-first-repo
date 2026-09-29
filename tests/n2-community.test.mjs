import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {ingest} from '../platform/ingest.js';
import {compatVerdict,confirmationsNeeded,qualifiesBest,computeTier,rolloutSummary,writableKinds,createPost,castVote,recomputeCompat,ROLLOUT_MIN_CELL} from '../platform/community.js';

const NOW=Date.UTC(2026,8,28),DAY=864e5;
const rep=(user,result,tier='contributor',age=1)=>({user_id:user,result,tier,created_at:NOW-age*DAY});

test('verification needs independent users, a contributor and few contradictions',()=>{
 assert.equal(compatVerdict([],NOW).verification,'UNKNOWN');
 assert.equal(compatVerdict([rep('a','works'),rep('b','works')],NOW).verification,'COMMUNITY','two users are not enough');
 const v=compatVerdict([rep('a','works'),rep('b','works','new'),rep('c','works','new')],NOW);
 assert.deepEqual([v.status,v.verification,v.confirmations],['works','COMMUNITY_VERIFIED',3]);
 assert.equal(compatVerdict([rep('a','works','new'),rep('b','works','new'),rep('c','works','new')],NOW).verification,'COMMUNITY','three brand-new accounts cannot verify');
 assert.equal(compatVerdict([rep('a','works'),rep('a','works'),rep('a','works')],NOW).users,1,'one user counts once');
 const d=compatVerdict([rep('a','works'),rep('b','works'),rep('c','broken'),rep('d','broken','trusted')],NOW);
 assert.equal(d.verification,'DISPUTED');
 const b=compatVerdict([rep('a','broken'),rep('b','broken'),rep('c','broken','new')],NOW);
 assert.deepEqual([b.status,b.verification],['broken','COMMUNITY_VERIFIED']);
 // the latest report of a user wins (they re-tested after an update)
 assert.equal(compatVerdict([{...rep('a','broken'),created_at:NOW-5*DAY},rep('a','works')],NOW).status,'works');
 assert.equal(confirmationsNeeded({users:2,verification:'COMMUNITY'}),1);
});

test('★ best rule, tiers and writable kinds',()=>{
 assert.equal(qualifiesBest({up_count:10,down_count:2,created_at:NOW-3600e3},NOW),true);
 assert.equal(qualifiesBest({up_count:10,down_count:6,created_at:NOW-3600e3},NOW),false,'ratio');
 assert.equal(qualifiesBest({up_count:30,down_count:0,created_at:NOW-2*DAY},NOW),false,'window');
 const base={accepted_contributions:0,rejected_contributions:0,strikes:0,created_at:NOW-100*DAY};
 assert.equal(computeTier(base,NOW),'new');
 assert.equal(computeTier({...base,accepted_contributions:5},NOW),'contributor');
 assert.equal(computeTier({...base,accepted_contributions:30,rejected_contributions:1},NOW),'trusted');
 assert.equal(computeTier({...base,accepted_contributions:30,strikes:1},NOW),'contributor');
 assert.equal(computeTier({...base,tier:'maintainer'},NOW),'maintainer');
 assert.ok(writableKinds('games').includes('patch'));
 assert.ok(!writableKinds('ai').includes('patch'));
 assert.ok(!writableKinds('games').includes('notice')&&writableKinds('games').includes('news'),'소식 is a 게임 말머리; 공지 is staff-only');
 assert.ok(writableKinds('games',{staff:true}).includes('notice'));
});

test('rollout summary never shows a percentage for tiny cells and separates new accounts',()=>{
 const v=(has,country,platform,plan,newAcct=false)=>({has_it:has,country,platform,plan_id:plan,account_created_at:newAcct?NOW-DAY:NOW-90*DAY,updated_at:NOW-DAY});
 const votes=[...Array(6)].map((_,i)=>v(i<4?1:0,'KR','web','plan:plus')).concat([v(1,'US','ios','plan:plus'),v(1,'KR','web','plan:plus',true)]);
 const s=rolloutSummary(votes,NOW);
 assert.equal(s.newAccounts,1);
 assert.deepEqual(s.total,{n:7,has:5,pct:71});
 assert.equal(s.country.KR.pct,67);
 assert.equal(s.country.US.pct,null,`fewer than ${ROLLOUT_MIN_CELL} → counts only`);
 assert.equal(s.countryPlatform.KR.web.n,6);
});

test('posts get per-channel numbers, votes update counters and ★ best',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[],entities:[{id:'game:steam-1',type:'game',slug:'g1',names:{en:'G1'}},{id:'game:steam-2',type:'game',slug:'g2',names:{en:'G2'}}]},{mode:'seed',actor:'seed',now:NOW});
 db.raw.exec("INSERT INTO users (id,provider,provider_subject,created_at) VALUES ('u1','google','1',0),('u2','google','2',0)");
 assert.equal(await createPost(db,{id:'p1',channel:'games',tags:['game:steam-1'],kind:'question',title:'q',body:'b',locale:'ko',authorId:'u1'},NOW),1);
 assert.equal(await createPost(db,{id:'p2',channel:'games',tags:['game:steam-1'],kind:'free',title:'f',body:'b',locale:'ko',authorId:'u1'},NOW),2);
 assert.equal(await createPost(db,{id:'p3',channel:'games',tags:['game:steam-2'],kind:'free',title:'f',body:'b',locale:'ko',authorId:'system:radar-bot'},NOW),3,'numbers are per channel, not per tag');
 assert.equal(await createPost(db,{id:'p3b',channel:'free',tags:['game:steam-2'],kind:'free',title:'f',body:'b',locale:'ko',authorId:'u1'},NOW),1,'another channel counts on its own');
 await assert.rejects(createPost(db,{id:'p4',channel:'games',tags:['game:steam-1'],kind:'bogus',title:'x',body:'b',locale:'ko',authorId:'u1'},NOW));
 let r=await castVote(db,{kind:'discussion',id:'p1',userId:'u2',value:1},NOW);
 assert.deepEqual({up:r.up,down:r.down,best:r.best},{up:1,down:0,best:false});assert.equal(r.bestThreshold,10,'default threshold under 20 recent posts');
 r=await castVote(db,{kind:'discussion',id:'p1',userId:'u2',value:-1},NOW);
 assert.deepEqual([r.up,r.down],[0,1],'changing a vote does not double count');
 for(let i=0;i<10;i++){db.raw.exec(`INSERT INTO users (id,provider,provider_subject,created_at) VALUES ('v${i}','google','v${i}',0)`);await castVote(db,{kind:'discussion',id:'p2',userId:'v'+i,value:1},NOW);}
 assert.ok(db.raw.prepare("SELECT best_at FROM discussions WHERE id='p2'").get().best_at,'10 up votes within 24h → ★ best');
});

test('community compatibility is recomputed, but official rows are never overwritten',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 await ingest(db,{schema:'nerulio.seed/1',vertical:'games',sources:[{id:'src:o',kind:'OFFICIAL',url:'https://example.com',retrieved:'2026-09-01'}],entities:[{id:'game:steam-1',type:'game',slug:'g1',names:{en:'G1'}},{id:'translation_patch:p',type:'translation_patch',slug:'p',names:{en:'P'}}],compatibility:[{subject:'translation_patch:p',subject_version:'1.7',target:'game:steam-1',target_version:'2.3.0',status:'supported',ver:'OFFICIAL',src:'src:o'}]},{mode:'seed',actor:'seed',now:NOW});
 for(const [u,tier] of [['a','contributor'],['b','new'],['c','new']]){
  db.raw.exec(`INSERT INTO users (id,provider,provider_subject,created_at) VALUES ('${u}','google','${u}',0)`);
  db.raw.exec(`INSERT INTO user_profiles (user_id,tier,created_at,updated_at) VALUES ('${u}','${tier}',0,0)`);
  for(const tv of ['2.3.0','2.3.1'])db.raw.exec(`INSERT INTO community_reports (id,kind,entity_id,subject_version,target_id,target_version,result,user_id,created_at,updated_at) VALUES ('${u}${tv}','compat','translation_patch:p','1.7','game:steam-1','${tv}','works','${u}',${NOW},${NOW})`);
 }
 const off=await recomputeCompat(db,{subject:'translation_patch:p',subjectVersion:'1.7',target:'game:steam-1',targetVersion:'2.3.0',envKey:''},NOW);
 assert.equal(off.changed,false);
 const r=await recomputeCompat(db,{subject:'translation_patch:p',subjectVersion:'1.7',target:'game:steam-1',targetVersion:'2.3.1',envKey:''},NOW);
 assert.equal(r.changed,true);
 const row=db.raw.prepare("SELECT status,verification,confirmations FROM compatibility WHERE is_current=1 AND target_version='2.3.1'").get();
 assert.deepEqual({...row},{status:'works',verification:'COMMUNITY_VERIFIED',confirmations:3});
 assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM changes WHERE kind='compat_changed' AND importance=2").get().n,1);
});

test('념글 threshold follows the channel: default under 20 posts, p90 of recent upvotes, floor 5, cap 100',async()=>{
 const {bestThreshold,qualifiesBest}=await import('../platform/community.js');
 assert.equal(bestThreshold([1,2,3]),10);
 assert.equal(bestThreshold(Array(40).fill(0)),5,'quiet channel: floor');
 assert.equal(bestThreshold([...Array(36).fill(3),40,50,60,70]),40,'p90');
 assert.equal(bestThreshold(Array(40).fill(500)),100,'cap');
 const t=Date.UTC(2026,8,29);
 assert.equal(qualifiesBest({up_count:6,down_count:0,created_at:t-1000},t,5),true);
 assert.equal(qualifiesBest({up_count:6,down_count:0,created_at:t-1000},t),false,'default 10');
});
