// Channel restructure (migrations/0014_channels.sql, platform/channels.js): existing posts move into the 7
// channels without losing anything, keep a redirect from their old number, and new posts get channel
// numbers and tags.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable,migrationFiles} from './d1-shim.mjs';
import {createPost,castVote,writableKinds,POST_KINDS} from '../platform/community.js';
import {CHANNELS,channelById,channelOfVertical,defaultChannelOf,flairLabel,writableFlairs,storedKind,writePath,postPath} from '../platform/channels.js';

const MIG=new URL('../migrations/',import.meta.url);
/** A database migrated up to (not including) 0014, as production is before this change. */
function before14(){
 const db=new D1Shim();
 for(const f of migrationFiles().filter(f=>f<'0014'))db.raw.exec(readFileSync(new URL(f,MIG),'utf8'));
 return db;
}
const apply14=(/** @type {D1Shim} */ db)=>db.raw.exec(readFileSync(new URL('0014_channels.sql',MIG),'utf8'));
const T0=Date.UTC(2026,8,1);
async function entity(db,id,vertical,type,slug){
 await db.prepare("INSERT INTO entities (id,vertical,type,slug,names,created_at,updated_at) VALUES (?,?,?,?,?,0,0)").bind(id,vertical,type,slug,JSON.stringify({ko:slug,en:slug})).run();
}
async function user(db,id){await db.prepare("INSERT INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES (?,NULL,?,'google',?,0)").bind(id,id,id).run();}
/** An old-style post (per-entity number, no channel). */
async function oldPost(db,id,entityId,no,kind,at,extra={}){
 await db.prepare(`INSERT INTO discussions (id,entity_id,post_no,kind,title,body_md,locale,author_id,created_at,updated_at,last_activity_at,status,up_count,best_at) VALUES (?,?,?,?,?,?,'ko',?,?,?,?,?,?,?)`)
  .bind(id,entityId,no,kind,`t-${id}`,'body',extra.author||'u1',at,at,at,extra.status||'published',extra.up||0,extra.best||null).run();
}

test('channel config: 7 channels, flairs per the owner decision, labels per channel',()=>{
 assert.deepEqual(CHANNELS.map(c=>c.id),['free','games','sub','hw','ai','studio','notice']);
 assert.deepEqual(CHANNELS.filter(c=>c.inBar).map(c=>c.id),['free','games','sub','hw','ai','studio']);
 const labels=(/** @type {string} */ ch)=>writableFlairs(ch).map(f=>flairLabel(ch,f,'ko'));
 assert.deepEqual(labels('ai'),['소식','정보','질문','사용기','팁','벤치','잡담']);
 assert.deepEqual(labels('games'),['소식','정보','질문','공략','한글패치','리포트','스샷','잡담']);
 assert.deepEqual(labels('hw'),['소식','정보','질문','견적','벤치','사용기','잡담']);
 assert.deepEqual(labels('studio'),['소식','질문','호환','팁','작업물','잡담']);
 assert.deepEqual(labels('sub'),['소식','정보','감상','행사·굿즈','팬아트','질문','잡담']);
 assert.deepEqual(labels('free'),['잡담','질문','정보']);
 assert.deepEqual(labels('notice'),['건의']);
 // 공지 only for staff, in any channel; English labels exist for every flair.
 assert.ok(!writableKinds('ai').includes('notice')&&writableKinds('ai',{staff:true})[0]==='notice');
 for(const c of CHANNELS)for(const f of c.flairs)assert.ok(flairLabel(c.id,f,'en')&&flairLabel(c.id,f,'en')!==f,`${c.id}:${f}`);
 for(const f of ['info','review','buy','event','feedback'])assert.ok(f in POST_KINDS);
 // The stored kind always satisfies the old CHECK of discussions.kind.
 const legacy=['notice','news','report','patch','question','guide','benchmark','screenshot','free'];
 for(const f of Object.keys(POST_KINDS))assert.ok(legacy.includes(storedKind(f)),f);
 assert.equal(channelOfVertical('hardware'),'hw');assert.equal(channelOfVertical('subculture'),'sub');assert.equal(channelOfVertical('tools'),'free');
 // A subculture work that is a game defaults to 게임; a GPU to PC·하드웨어.
 assert.equal(defaultChannelOf({vertical:'subculture',type:'work'},[{property:'media_type',value:'game'}]),'games');
 assert.equal(defaultChannelOf({vertical:'subculture',type:'work'},[{property:'media_type',value:'tv_anime'}]),'sub');
 assert.equal(defaultChannelOf({vertical:'hardware',type:'gpu'}),'hw');
 assert.equal(writePath('ko','ai',{tag:'service:claude'}),'/ko/community/ai/write?tag=service:claude');
 assert.equal(postPath('en','games',12),'/en/community/games/12');
 assert.equal(channelById('nope'),null);
});

test('0014 moves every existing post into its channel, numbers by date, keeps tags and old numbers',{skip:!sqliteAvailable},async()=>{
 const db=before14();
 await user(db,'u1');await user(db,'u2');
 await entity(db,'service:claude','ai','service','claude');
 await entity(db,'gpu:rtx-5070','hardware','gpu','rtx-5070');
 await entity(db,'game:balatro','games','game','balatro');
 await entity(db,'work:frieren','subculture','work','frieren');
 await entity(db,'app:blender','studio','app','blender');
 // Posts written in this order across entities; one hidden, one deleted, one ★ best, one notice.
 await oldPost(db,'p1','service:claude',1,'question',T0+1);
 await oldPost(db,'p2','gpu:rtx-5070',1,'benchmark',T0+2,{up:12,best:T0+3});
 await oldPost(db,'p3','service:claude',2,'free',T0+3,{status:'hidden'});
 await oldPost(db,'p4','game:balatro',1,'patch',T0+4);
 await oldPost(db,'p5','service:claude',3,'notice',T0+5,{author:'u2'});
 await oldPost(db,'p6','work:frieren',1,'screenshot',T0+6);
 await oldPost(db,'p7','app:blender',1,'guide',T0+7,{status:'deleted'});
 await oldPost(db,'p8','service:claude',4,'news',T0+8);
 // Comments, votes and a flag hang on them and must survive.
 await db.prepare("INSERT INTO comments (id,discussion_id,author_id,body_md,status,created_at,updated_at) VALUES ('c1','p1','u2','hi','published',?,?)").bind(T0+9,T0+9).run();
 await db.prepare("INSERT INTO votes (target_kind,target_id,user_id,value,created_at) VALUES ('discussion','p2','u1',1,?)").bind(T0+9).run();
 const counts=async()=>Object.fromEntries(await Promise.all(['discussions','comments','votes','content_flags','uploads'].map(async t=>[t,Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()).n)])));
 const beforeCounts=await counts();
 apply14(db);
 assert.deepEqual(await counts(),beforeCounts,'no row lost');
 const rows=(await db.prepare('SELECT id,channel_id,channel_no,flair,kind,status,best_at FROM discussions ORDER BY id').all()).results;
 const by=Object.fromEntries(rows.map(r=>[r.id,r]));
 assert.deepEqual(rows.map(r=>[r.id,r.channel_id,r.channel_no]),[['p1','ai',1],['p2','hw',1],['p3','ai',2],['p4','games',1],['p5','ai',3],['p6','sub',1],['p7','studio',1],['p8','ai',4]]);
 assert.equal(by.p3.status,'hidden');assert.equal(by.p7.status,'deleted');assert.equal(by.p2.best_at,T0+3);
 for(const r of rows)assert.equal(r.flair,r.kind);
 // Every old post has its entity as the first tag and an old-number row.
 const tags=(await db.prepare('SELECT discussion_id,entity_id,pos FROM discussion_tags ORDER BY discussion_id').all()).results;
 assert.equal(tags.length,8);assert.ok(tags.every(t=>t.pos===0));
 assert.equal(tags.find(t=>t.discussion_id==='p6').entity_id,'work:frieren');
 const legacy=await db.prepare("SELECT d.channel_id,d.channel_no FROM legacy_posts l JOIN discussions d ON d.id=l.discussion_id WHERE l.entity_id='service:claude' AND l.post_no=4").first();
 assert.deepEqual({...legacy},{channel_id:'ai',channel_no:4});
 assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM legacy_posts').first()).n),8);
 // The channel counters continue after the migrated posts.
 const seq=Object.fromEntries((await db.prepare('SELECT id,post_seq FROM channels').all()).results.map(r=>[r.id,r.post_seq]));
 assert.deepEqual(seq,{ai:4,games:1,hw:1,studio:1,sub:1,free:0,notice:0});
 const next=await createPost(db,{id:'n1',channel:'ai',kind:'review',tags:['service:claude','gpu:rtx-5070'],title:'new',body:'b',locale:'ko',authorId:'u1'},T0+20);
 assert.equal(next,5);
 const n1=await db.prepare("SELECT entity_id,post_no,channel_no,kind,flair FROM discussions WHERE id='n1'").first();
 assert.deepEqual({...n1},{entity_id:'service:claude',post_no:5,channel_no:5,kind:'free',flair:'review'});
 // Comments and votes still point at their posts.
 assert.equal((await db.prepare("SELECT discussion_id FROM comments WHERE id='c1'").first()).discussion_id,'p1');
});

test('new posts: channel numbers are consecutive and unique, tags ≤3 in order, untagged posts use the placeholder',{skip:!sqliteAvailable},async()=>{
 const db=D1Shim.migrated();
 await user(db,'u1');await user(db,'u2');
 for(const [id,v,t,s] of [['service:claude','ai','service','claude'],['service:chatgpt','ai','service','chatgpt'],['model:opus','ai','model','opus'],['gpu:rtx-5070','hardware','gpu','rtx-5070']])await entity(db,id,v,t,s);
 const nos=await Promise.all([1,2,3,4,5].map(i=>createPost(db,{id:`a${i}`,channel:'ai',kind:'question',tags:['service:claude'],title:`t${i}`,body:'b',locale:'ko',authorId:'u1'},T0+i)));
 assert.deepEqual([...nos].sort((a,b)=>a-b),[1,2,3,4,5]);
 const hw=await createPost(db,{id:'h1',channel:'hw',kind:'buy',tags:['gpu:rtx-5070','service:claude','model:opus','service:chatgpt'],title:'t',body:'b',locale:'ko',authorId:'u1'},T0+9);
 assert.equal(hw,1,'each channel counts on its own');
 const tags=(await db.prepare("SELECT entity_id FROM discussion_tags WHERE discussion_id='h1' ORDER BY pos").all()).results.map(r=>r.entity_id);
 assert.deepEqual(tags,['gpu:rtx-5070','service:claude','model:opus'],'at most 3, in the writer\'s order');
 const free=await createPost(db,{id:'f1',channel:'free',kind:'free',tags:[],title:'t',body:'b',locale:'ko',authorId:'u1'},T0+10);
 assert.equal(free,1);
 assert.equal((await db.prepare("SELECT entity_id FROM discussions WHERE id='f1'").first()).entity_id,'channel:free');
 assert.equal(Number((await db.prepare("SELECT COUNT(*) AS n FROM discussion_tags WHERE discussion_id='f1'").first()).n),0);
 // A failed insert (unknown tag) leaves no gap in the channel's numbers.
 await assert.rejects(createPost(db,{id:'bad',channel:'hw',kind:'buy',tags:['gpu:nope'],title:'t',body:'b',locale:'ko',authorId:'u1'},T0+11));
 assert.equal(await createPost(db,{id:'h2',channel:'hw',kind:'free',tags:[],title:'t',body:'b',locale:'ko',authorId:'u1'},T0+12),2);
 // ★ best threshold is the channel's: a vote on an AI post counts AI posts only.
 await db.prepare("UPDATE discussions SET up_count=9 WHERE id='a1'").run();
 const r=await castVote(db,{kind:'discussion',id:'a1',userId:'u2',value:1},T0+13);
 assert.equal(r?.bestThreshold,10);
});

test('a tag lists its posts from every channel, its parts included; the board folds 공지 and the bot\'s 소식',{skip:!sqliteAvailable},async()=>{
 const {boardPosts,tagChildren,noticesOf,botNews,frontPosts,postByChannelNo,legacyPost}=await import('../platform/db/channel.js');
 const db=D1Shim.migrated();
 await user(db,'u1');
 for(const [id,v,t,s] of [['service:claude','ai','service','claude'],['service:claude-code','ai','service','claude-code'],['plan:claude-pro','ai','plan','claude-pro'],['model:opus','ai','model','opus'],['gpu:rtx-5070','hardware','gpu','rtx-5070']])await entity(db,id,v,t,s);
 // Claude Code is part of Claude; Claude offers the Pro plan; Pro includes the model (depth 2).
 const rel=(s,p,o)=>db.prepare('INSERT INTO relations (subject_id,predicate,object_id,created_at,updated_at) VALUES (?,?,?,0,0)').bind(s,p,o).run();
 await rel('service:claude-code','part_of','service:claude');await rel('service:claude','offers','plan:claude-pro');await rel('plan:claude-pro','includes_model','model:opus');
 const P=(id,channel,kind,tags,at,o={})=>createPost(db,{id,channel,kind,tags,title:`t-${id}`,body:'b',locale:'ko',authorId:o.author||'u1'},T0+at);
 await P('a1','ai','question',['service:claude'],1);
 await P('a2','ai','guide',['service:claude-code'],2);
 await P('h1','hw','review',['gpu:rtx-5070','service:claude'],3);
 await P('a3','ai','free',['model:opus'],4);
 await P('a4','ai','free',['gpu:rtx-5070'],5);
 await P('n1','ai','notice',[],6);await P('n2','ai','notice',[],7);
 await P('b1','ai','news',['service:claude'],8,{author:'system:radar-bot'});await P('b2','ai','news',[],9,{author:'system:radar-bot'});
 const ids=async o=>(await boardPosts(db,{now:T0+10,...o})).posts.map(p=>p.id).sort();
 assert.deepEqual((await tagChildren(db,'service:claude')).map(e=>e.id).sort(),['model:opus','plan:claude-pro','service:claude-code']);
 const {tagPagesOf}=await import('../platform/db/channel.js');
 assert.deepEqual((await tagPagesOf(db,['model:opus'])).map(e=>e.id).sort(),['model:opus','plan:claude-pro','service:claude'],'a takedown purges the pages of the wholes too');
 assert.deepEqual(await ids({tag:'service:claude'}),['a1','a2','a3','b1','h1'],'every channel, parts included (Claude Code, Pro → Opus)');
 assert.deepEqual(await ids({tag:'service:claude',children:false}),['a1','b1','h1'],'this tag only');
 assert.deepEqual(await ids({tag:'service:claude',channel:'hw'}),['h1'],'a tag inside one channel');
 assert.deepEqual(await ids({tag:'gpu:rtx-5070'}),['a4','h1'],'an AI post tagged with a GPU shows on the GPU');
 assert.deepEqual(await ids({channel:'ai',fold:true}),['a1','a2','a3','a4'],'공지 and the bot\'s 소식 are folded out of the list');
 assert.deepEqual(await ids({channel:'ai',kind:'news'}),['b1','b2'],'the 소식 tab shows them');
 assert.deepEqual((await noticesOf(db,'ai')).map(p=>p.id),['n2','n1'],'newest 공지 first');
 assert.deepEqual(await botNews(db,'ai',T0),{count:2,title:'t-b2'});
 // Old bot news (past the fold window) is an ordinary row again.
 assert.deepEqual(await ids({channel:'ai',fold:true,now:T0+30*864e5}),['a1','a2','a3','a4','b1','b2']);
 // Rows carry their tags in order; a post is found by channel and number; a new post has no old address.
 const h1=await postByChannelNo(db,'hw',1);
 assert.deepEqual(h1.tags.map(e=>e.id),['gpu:rtx-5070','service:claude']);
 assert.equal(await legacyPost(db,'gpu:rtx-5070',1),null);
 // ★ 념글 per channel and overall.
 await db.prepare("UPDATE discussions SET best_at=? WHERE id IN ('a1','h1')").bind(T0+11).run();
 assert.deepEqual((await boardPosts(db,{channel:'ai',best:true,now:T0+12})).posts.map(p=>p.id),['a1']);
 assert.deepEqual((await frontPosts(db,{mode:'best',since:T0,limit:10})).map(p=>p.id).sort(),['a1','h1'],'전체 베스트 spans channels');
 assert.deepEqual((await frontPosts(db,{mode:'best',channel:'hw',since:T0,limit:10})).map(p=>p.id),['h1']);
});

test('per-channel ★ threshold: a busy channel does not raise a quiet one\'s bar',{skip:!sqliteAvailable},async()=>{
 const {channelBestThreshold}=await import('../platform/community.js');
 const db=D1Shim.migrated();
 await user(db,'u1');
 for(let i=0;i<30;i++)await createPost(db,{id:`g${i}`,channel:'games',kind:'free',tags:[],title:'t',body:'b',locale:'ko',authorId:'u1'},T0+i);
 await db.prepare("UPDATE discussions SET up_count=80 WHERE channel_id='games'").run();
 assert.equal(await channelBestThreshold(db,'games',T0+100),80);
 assert.equal(await channelBestThreshold(db,'studio',T0+100),10,'a quiet channel keeps the default');
});
