/** The AI status moment: an official incident opening or a spike of "안 돼요" reports is announced once to
 * the service's followers (내 레이더) and, only when STATUS_WEBHOOK_URL is set, to a Discord-compatible
 * webhook. Real SQL over node:sqlite; the webhook is a stub, nothing external is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {ingest} from '../platform/ingest.js';
import {watchStatus,statusEvents,webhookMessage,webhookUrl,WATCH} from '../server/platform/status-watch.js';
import {changesFor,radarChanges} from '../platform/db/channel.js';
import {describeChange} from '../platform/change-text.js';
import {handlePlatformApi} from '../server/platform/api.js';
import {createLimiter} from '../server/ratelimit.js';
import {generateAdminKeys} from '../tools/admin-keys.mjs';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const T0=Date.UTC(2026,8,29,3,0),H=36e5,DAY=864e5,ORIGIN='https://nerulio.test',HOOK='https://discord.test/api/webhooks/1/abc';
const SEED={schema:'nerulio.seed/1',vertical:'ai',sources:[],entities:[
 {id:'provider:anthropic',type:'provider',slug:'anthropic',names:{en:'Anthropic'}},
 {id:'service:claude',type:'service',slug:'claude',names:{en:'Claude',ko:'Claude'}},
 {id:'service:claude-code',type:'service',slug:'claude-code',names:{en:'Claude Code'}},
 {id:'provider:openai',type:'provider',slug:'openai',names:{en:'OpenAI'}},
 {id:'service:chatgpt',type:'service',slug:'chatgpt',names:{en:'ChatGPT',ko:'ChatGPT'}}]};

async function setup(env={}){
 const db=D1Shim.migrated();
 await ingest(db,SEED,{mode:'seed',actor:'seed',now:T0-30*DAY});
 const posts=[];
 const fetch=async(url,init)=>{posts.push({url:String(url),body:JSON.parse(init.body)});return new Response(null,{status:204});};
 const clock={now:T0};
 const run=(o)=>watchStatus({env:{DB:db,...env},db,now:clock.now,fetch,origin:ORIGIN},o);
 return {db,posts,clock,run};
}
let evId=100;
async function incident(db,{on,starts,status='confirmed',title='Elevated errors'}){
 const id=++evId;
 await db.prepare("INSERT INTO events (id,entity_id,kind,title,starts_at,date_precision,region,url,status,verification,created_at,updated_at) VALUES (?,NULL,'other',?,?,'time','*',?,?,'OFFICIAL',?,?)").bind(id,JSON.stringify({en:title}),starts,`https://status.claude.com/incidents/i${id}`,status,starts,starts).run();
 await db.prepare("INSERT INTO event_entities (event_id,entity_id,role) VALUES (?,?,'about')").bind(id,on).run();
 return id;
}
async function clicks(db,service,at,n){
 for(let i=0;i<n;i++)await db.prepare("INSERT INTO community_reports (id,kind,entity_id,env,result,user_id,created_at,updated_at) VALUES (?,'issue',?,?,'broken','anon',?,?)").bind(`r${service}${at}${i}`,service,JSON.stringify({who:`net${i}`}),at+i,at+i).run();
}

test('an official incident: announced once to followers and the webhook; only open, recent, status-page incidents',{skip},async()=>{
 const t=await setup({STATUS_WEBHOOK_URL:HOOK});
 const id=await incident(t.db,{on:'provider:anthropic',starts:T0-20*60e3});
 await incident(t.db,{on:'provider:anthropic',starts:T0-30*60e3,status:'ended',title:'Resolved already'});
 await incident(t.db,{on:'provider:anthropic',starts:T0-WATCH.incidentWindowMs-60e3,title:'Too old'});
 await incident(t.db,{on:'service:claude-code',starts:T0-10*60e3,title:'Claude Code only'});
 const r=await t.run();
 assert.deepEqual(r.new,[{kind:'incident',service:'service:claude'}],'the provider-wide open incident, not the ended, old or sister-service ones');
 assert.deepEqual(r.webhook,[204]);assert.equal(t.posts.length,1);
 const msg=t.posts[0];assert.equal(msg.url,HOOK);
 assert.equal(msg.body.embeds[0].title,'[공식 장애] Claude: 공식 장애 — Elevated errors');
 assert(msg.body.embeds[0].url==='https://nerulio.test/ko/ai/claude/status'&&msg.body.embeds[0].description.includes(`https://status.claude.com/incidents/i${id}`));
 assert.deepEqual(msg.body.allowed_mentions,{parse:[]},'never pings anyone');
 const ch=await changesFor(t.db,['service:claude'],{minImportance:1});
 assert.equal(ch.length,1);assert.equal(ch[0].kind,'incident');assert.equal(describeChange(ch[0],{name:'Claude'},'ko').title,'Claude: 공식 장애 — Elevated errors');
 assert(!(await radarChanges(t.db,{minImportance:2})).some(c=>c.entity_id==='service:claude'),'followers only, not the public Radar');
 // Every later tick: nothing new, nothing posted.
 t.clock.now+=30*60e3;assert.deepEqual((await t.run()).new,[]);assert.equal(t.posts.length,1);
 // Filed on the service itself: ingest already told the followers; the webhook still hears it once.
 await incident(t.db,{on:'service:claude',starts:t.clock.now-60e3,title:'Login failures'});
 assert.equal((await t.run()).new.length,1);assert.equal(t.posts.length,2);
 assert.equal((await changesFor(t.db,['service:claude'],{minImportance:1})).length,1,'no second row for a direct incident');
});

test('a spike of user reports: once per episode, labelled as user reports; a new episode after a quiet gap',{skip},async()=>{
 const t=await setup({STATUS_WEBHOOK_URL:HOOK});
 for(let d=1;d<=6;d++)await clicks(t.db,'service:chatgpt',T0-d*DAY-5*H,1);   // a quiet week
 assert.deepEqual((await t.run()).new,[],'no spike');
 await clicks(t.db,'service:chatgpt',T0-20*60e3,5);
 const r=await t.run();
 assert.deepEqual(r.new,[{kind:'spike',service:'service:chatgpt'}]);
 assert.equal(t.posts[0].body.embeds[0].title,'[사용자 리포트 급증] ChatGPT');
 assert(t.posts[0].body.embeds[0].description.includes('공식 장애 여부는 공식 상태 페이지 기준으로 따로 확인하세요'),'never called an outage');
 const ch=(await changesFor(t.db,['service:chatgpt'],{minImportance:1}))[0];
 assert.equal(ch.kind,'note');assert.equal(describeChange(ch,{name:'ChatGPT'},'en').title,'ChatGPT: user “not working” reports spiking (Nerulio user reports)');
 // Still spiking 20 minutes later (more clicks): the same episode.
 t.clock.now+=20*60e3;await clicks(t.db,'service:chatgpt',t.clock.now-60e3,3);
 assert.deepEqual((await t.run()).new,[]);assert.equal(t.posts.length,1);
 // Concurrent checks (two clicks at once) cannot both announce it.
 t.clock.now+=4*H;await clicks(t.db,'service:chatgpt',t.clock.now-10*60e3,6);
 const both=await Promise.all([t.run({ids:['service:chatgpt'],incidents:false}),t.run({ids:['service:chatgpt'],incidents:false})]);
 assert.equal(both.flatMap(x=>x.new).length,1,'a new episode after the gap, announced once');
 assert.equal(t.posts.length,2);
});

test('the webhook is optional: off without STATUS_WEBHOOK_URL or with a non-https one; followers still hear it',{skip},async()=>{
 assert.equal(webhookUrl({}),null);assert.equal(webhookUrl({STATUS_WEBHOOK_URL:'http://discord.test/x'}),null);assert.equal(webhookUrl({STATUS_WEBHOOK_URL:'https://localhost/x'}),null);
 assert.equal(webhookUrl({STATUS_WEBHOOK_URL:' '+HOOK+' '}),HOOK);
 const t=await setup();
 await incident(t.db,{on:'provider:anthropic',starts:T0-60e3});
 const r=await t.run();
 assert.equal(r.webhook,'off');assert.equal(t.posts.length,0);assert.equal(r.new.length,1);
 assert.equal((await changesFor(t.db,['service:claude'],{minImportance:1})).length,1);
 // A failing webhook is logged, never retried into a flood.
 const f=await setup({STATUS_WEBHOOK_URL:HOOK});await incident(f.db,{on:'provider:anthropic',starts:T0-60e3});
 const bad=await watchStatus({env:{STATUS_WEBHOOK_URL:HOOK},db:f.db,now:T0,fetch:async()=>{throw Error('down');},origin:ORIGIN});
 assert.deepEqual(bad.webhook,[0]);
 assert.deepEqual((await watchStatus({env:{STATUS_WEBHOOK_URL:HOOK},db:f.db,now:T0+60e3,fetch:async()=>new Response(null,{status:204}),origin:ORIGIN})).webhook,[],'claimed: not posted again');
 const m=webhookMessage((await statusEvents(f.db,T0))[0],ORIGIN);assert.equal(m.username,'Nerulio');
});

test('the collectors tick runs the watch, with or without push set up; an outage click checks for a spike at once',{skip},async()=>{
 const KEYS=await generateAdminKeys();
 const t=await setup();
 const posts=[],waits=[];
 const env={DB:t.db,SESSION_SECRET:'test-session-secret-0123456789abcdef-0123456789',NERULIO_ENV:'development',SITE_URL:ORIGIN,NOTIFY_TOKEN:KEYS.NOTIFY_TOKEN,STATUS_WEBHOOK_URL:HOOK};
 const call=(path,body,headers={},ip='203.0.113.1')=>handlePlatformApi(new Request(ORIGIN+'/api/v2'+path,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':ip,...headers,...(headers.authorization?{}:{origin:ORIGIN})},body:JSON.stringify(body)}),env,{waitUntil:p=>waits.push(p)},
  {now:()=>t.clock.now,limiter:createLimiter(),fetch:async(url,init)=>{posts.push({url:String(url),body:JSON.parse(init.body)});return new Response(null,{status:204});}});
 await incident(t.db,{on:'provider:openai',starts:T0-60e3});
 const tick=await call('/admin/notify',{kind:'tick'},{authorization:`Bearer ${KEYS.NOTIFY_TOKEN}`});
 assert.equal(tick.status,503,'push itself is not configured here');
 assert.equal(posts.length,1,'but the status watch ran first');assert.equal(posts[0].body.embeds[0].title,'[공식 장애] ChatGPT: 공식 장애 — Elevated errors');
 // Five networks click "안 돼요" on Claude within the hour (a quiet week before): the fifth starts a spike.
 for(const [i,ip] of ['198.51.100.1','192.0.2.1','203.0.113.50','198.18.0.1','100.64.0.1'].entries()){
  if(i===4)assert.equal(posts.length,1,'four people are not a spike yet');const r=await call('/reports',{kind:'issue',entityId:'service:claude',result:'broken',env:{symptom:'down'}},{},ip);assert.equal(r.status,201);}
 await Promise.all(waits);
 assert.equal(posts.length,2);assert.equal(posts[1].body.embeds[0].title,'[사용자 리포트 급증] Claude');
});
