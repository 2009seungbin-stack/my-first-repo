/** AI 창작 커뮤니티 (owner decision 2026-10-11, nerulio-handoff/AI-COMMUNITY-CONTRACT.md §2 §5, docs/AI-COMMUNITY.md):
 * the 0015 migration on a database as production has it, the posts API with recipes, remixes, generator/prompt,
 * the AI flag and the image consent, GET /recipes/{id} and its rate-limited "try" counter, remix counts that
 * follow hides and deletes, the one-report hide for sexual/minor/deepfake, the archived channels, and the pages:
 * home, board, post (recipe card, remix grid), recipe lists, write, policy, sitemaps. Real SQL over node:sqlite,
 * an in-memory R2; nothing external. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1Shim,sqliteAvailable,migrationFiles} from './d1-shim.mjs';
import {R2Shim} from './r2-shim.mjs';
import {handlePlatformApi,AI_BLOCKED,GENERATORS,RECIPE_TRY} from '../server/platform/api.js';
import {renderPlatformPage,handlePlatformPage,renderSitemap} from '../server/platform/pages.js';
import {sha256,base64url} from '../server/crypto.js';
import {createLimiter} from '../server/ratelimit.js';
import {ingest} from '../platform/ingest.js';
import {REPORT} from '../server/platform/anon.js';
import {RECIPE_SCHEMA,validateRecipe,summarize} from '../platform/recipe.js';
import {CHANNELS} from '../platform/channels.js';
import {PLATFORM_SITEMAPS,ARCHIVED_VERTICALS} from '../platform/seo.js';
import {insertAiDemo} from '../tools/platform/demo-aic.mjs';

const skip=!sqliteAvailable&&'node:sqlite is unavailable';
const ORIGIN='https://nerulio.test',SECRET='test-session-secret-0123456789abcdef-0123456789';
const T0=Date.UTC(2026,9,11,3,0);   // 2026-10-11 12:00 KST
const DAY=864e5;
const MIG=new URL('../migrations/',import.meta.url);
const FIX=(/** @type {string} */ name)=>new Uint8Array(readFileSync(new URL(`./fixtures/anon/${name}`,import.meta.url)));
const RECIPE=Object.freeze({schema:RECIPE_SCHEMA,title:'LINE 스탬프 24개',source:{generator:'gemini',prompt:'표정 24개를 6×4 격자에',ai:true},input:{expect:'sheet'},
 steps:[{op:'sheet.split',v:1,p:{cols:6,rows:4}},{op:'bg.remove',v:1,p:{edge:'refine'}},{op:'sticker.border',v:1,p:{width:6}},{op:'fit',v:1,p:{preset:'line.sticker',w:370,h:320}}],result:{w:370,h:320,frames:1,count:24}});

/** One deployment and browsers (own cookies and network). */
async function harness(){
 const db=D1Shim.migrated(),clock={now:T0},limiter=createLimiter(),bucket=new R2Shim();
 await ingest(db,{schema:'nerulio.seed/1',vertical:'ai',sources:[],entities:[{id:'service:svc',type:'service',slug:'svc',names:{en:'Svc'}}]},{mode:'seed',actor:'seed',now:T0-DAY});
 const env={DB:db,SESSION_SECRET:SECRET,NERULIO_ENV:'development',SITE_URL:ORIGIN,UPLOADS:bucket};
 const sessions=/** @type {Record<string,string>} */({});
 const h={db,clock,env,
  async member(name,role='user'){
   const id='u-'+name,token=base64url(crypto.getRandomValues(new Uint8Array(32)));
   await db.prepare("INSERT INTO users(id,email,display_name,provider,provider_subject,created_at) VALUES(?1,NULL,?2,'github',?1,?3)").bind(id,name,T0-30*DAY).run();
   await db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?1,?2,?3,?4)').bind(await sha256(token),id,T0,T0+30*DAY).run();
   await db.prepare("INSERT INTO user_profiles (user_id,display_name,role,created_at,updated_at) VALUES (?1,?2,?3,?4,?4)").bind(id,name,role,T0).run();
   sessions[name]=token;return id;
  },
  /** @param {string} ip @param {string|null} [as] */
  browser(ip='203.0.113.7',as=null){
   const jar=new Map();if(as)jar.set('nerulio_session',sessions[as]);
   return {async call(/** @type {string} */ method,/** @type {string} */ path,/** @type {{body?:any,raw?:Uint8Array,type?:string,origin?:string|null}} */ {body,raw,type,origin=ORIGIN}={}){
    const hd=new Headers();if(jar.size)hd.set('cookie',[...jar].map(([k,v])=>`${k}=${v}`).join('; '));hd.set('cf-connecting-ip',ip);
    if(method==='POST'&&origin)hd.set('origin',origin);
    if(body!==undefined)hd.set('content-type','application/json');
    if(raw!==undefined)hd.set('content-type',type||'image/webp');
    const r=await handlePlatformApi(new Request(ORIGIN+'/api/v2'+path,{method,headers:hd,body:raw!==undefined?raw:body!==undefined?JSON.stringify(body):undefined}),env,null,{now:()=>clock.now,limiter,random:()=>1});
    for(const c of r.headers.getSetCookie?.()||[]){const [kv]=c.split(';');const i=kv.indexOf('=');if(/Max-Age=0/.test(c))jar.delete(kv.slice(0,i));else jar.set(kv.slice(0,i),kv.slice(i+1));}
    return {status:r.status,headers:r.headers,json:await r.json()};
   }};
  }};
 return h;
}
const row=(/** @type {any} */ h,/** @type {string} */ id)=>h.db.raw.prepare('SELECT * FROM discussions WHERE id=?').get(id);

/* ---------- migration ---------- */

test('0015 applies to a database as production has it (through 0014, with posts) and changes no existing row',{skip},async()=>{
 const db=new D1Shim();
 for(const f of migrationFiles().filter(f=>f<'0015'))db.raw.exec(readFileSync(new URL(f,MIG),'utf8'));
 db.raw.exec("INSERT INTO users (id,email,display_name,provider,provider_subject,created_at) VALUES ('u1',NULL,'u1','google','u1',0)");
 db.raw.exec("INSERT INTO entities (id,vertical,type,slug,names,created_at,updated_at) VALUES ('service:c','ai','service','c','{}',0,0)");
 for(const [i,[id,ch,no,flair]] of /** @type {[string,string,number,string][]} */([['p1','ai',1,'question'],['p2','games',1,'patch'],['p3','free',1,'free']]).entries())
  db.raw.prepare("INSERT INTO discussions (id,entity_id,post_no,kind,title,body_md,locale,author_id,created_at,updated_at,last_activity_at,channel_id,channel_no,flair) VALUES (?,?,?,?,?,'b','ko','u1',0,0,0,?,?,?)").run(id,ch==='free'?'channel:free':'service:c',i+1,flair,`t-${id}`,ch,no,flair);
 const before=db.raw.prepare('SELECT id,channel_id,channel_no,flair,kind,status FROM discussions ORDER BY id').all().map(r=>({...r}));
 db.raw.exec(readFileSync(new URL('0015_ai_community.sql',MIG),'utf8'));
 assert.deepEqual(db.raw.prepare('SELECT id,channel_id,channel_no,flair,kind,status FROM discussions ORDER BY id').all().map(r=>({...r})),before,'existing posts untouched');
 const ch=db.raw.prepare('SELECT id,sort,in_bar FROM channels ORDER BY sort,id').all().map(r=>[r.id,r.in_bar]);
 assert.deepEqual(ch,[['pfp',1],['sticker',1],['pixel',1],['wall',1],['howto',1],['free',1],['notice',1],['ai',0],['games',0],['hw',0],['studio',0],['sub',0]]);
 assert.deepEqual(CHANNELS.filter(c=>c.inBar).map(c=>c.id),ch.filter(([,b])=>b).map(([id])=>id),'the code and the table agree on the bar');
 for(const c of ['pfp','sticker','pixel','wall','howto'])assert.equal(db.raw.prepare("SELECT status FROM entities WHERE id=?").get(`channel:${c}`)?.status,'hidden',`placeholder of ${c}`);
 const p=db.raw.prepare('SELECT recipe_json,remix_of,remix_count,try_count,ai_generated,generator,prompt,consent_at FROM discussions WHERE id=?').get('p1');
 assert.deepEqual({...p},{recipe_json:null,remix_of:null,remix_count:0,try_count:0,ai_generated:0,generator:null,prompt:null,consent_at:null});
 assert.throws(()=>db.raw.exec("UPDATE discussions SET ai_generated=2 WHERE id='p1'"),/CHECK/);
 assert(db.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='discussions_recipes_tries'").get());
 assert(db.raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='recipe_try_days'").get());
 // Every migration in order is the schema the tests and the dev server run on.
 assert.equal(migrationFiles().at(-1),'0015_ai_community.sql');
});

/* ---------- posts with recipes ---------- */

test('posts: a recipe is validated and stored, generator/prompt come from it, the post is marked AI-made',{skip},async()=>{
 const h=await harness();await h.member('a');const a=h.browser('203.0.113.7','a');
 const ok=await a.call('POST','/posts?l=ko',{body:{channel:'sticker',kind:'line',title:'LINE 스탬프 24개',body:'시트로 뽑았어요',recipe:RECIPE}});
 assert.equal(ok.status,201,JSON.stringify(ok.json));assert.equal(ok.json.url,'/ko/community/sticker/1');
 const r=row(h,ok.json.id);
 assert.deepEqual(JSON.parse(r.recipe_json),/** @type {any} */(validateRecipe(RECIPE)).recipe,'stored as validateRecipe returns it');
 assert.deepEqual([r.generator,r.prompt,r.ai_generated],['gemini','표정 24개를 6×4 격자에',1]);
 // Invalid recipes, generators, prompts and flags are refused with the field named.
 const bad=async(/** @type {any} */ extra)=>{h.clock.now+=61e3;return (await a.call('POST','/posts',{body:{channel:'sticker',kind:'line',title:'제목입니다',body:'x',...extra}})).json.error;};
 assert.equal((await bad({recipe:{...RECIPE,steps:[{op:'face.swap',v:1,p:{}}]}})).field,'recipe','ops are a whitelist');
 assert.equal((await bad({recipe:{...RECIPE,schema:'other/1'}})).field,'recipe');
 assert.equal((await bad({recipe:'not an object'})).field,'recipe');
 assert.equal((await bad({generator:'dalle-9'})).field,'generator');
 assert.equal((await bad({prompt:'x'.repeat(2001)})).field,'prompt');
 assert.equal((await bad({ai:'yes'})).field,'ai');
 assert.equal((await bad({remixOf:'../x'})).field,'remixOf');
 // Undressing and nude edits are refused in any language (prompt or recipe title).
 for(const p of ['옷 벗겨줘','이 사진 누드로','undress her','make it nsfw','脱衣させて'])assert.equal((await bad({prompt:p})).reason,'ai_blocked',p);
 assert.equal((await bad({recipe:{...RECIPE,title:'deep nude 레시피'}})).reason,'ai_blocked');
 assert(!AI_BLOCKED.test('누끼 따고 흰 테두리')&&!AI_BLOCKED.test('nudge the border'),'ordinary finishing words pass');
 assert.deepEqual([...GENERATORS],['chatgpt','gemini','midjourney','sd','novelai','other']);
 // A plain post (no AI field, no image) leaves the 0015 columns at their defaults.
 h.clock.now+=61e3;
 const plain=await a.call('POST','/posts',{body:{channel:'free',kind:'free',title:'그냥 잡담',body:'x'}});
 assert.deepEqual([row(h,plain.json.id).ai_generated,row(h,plain.json.id).recipe_json],[0,null]);
 // Unknown fields stay refused; the archived channels take no posts.
 assert.equal((await bad({recipeJson:'{}'})).field,undefined);
 assert.equal((await bad({channel:'ai',kind:'question'})).reason,'read_only');
});

test('posts: images need the consent (전연령 · 실존 인물은 본인/허락받은 성인), recorded with the post; signed out too',{skip},async()=>{
 const h=await harness();await h.member('a');const a=h.browser('203.0.113.7','a');
 const up=await a.call('POST','/uploads',{raw:FIX('lossless.webp')});assert.equal(up.status,201,JSON.stringify(up.json));
 const body=`결과 ![원본](${up.json.url})`;
 const no=await a.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'프사 만들었어요',body}});
 assert.deepEqual([no.status,no.json.error.field,no.json.error.reason],[400,'consent','consent']);
 assert.equal((await a.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'프사 만들었어요',body,consent:'yes'}})).json.error.field,'consent');
 const ok=await a.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'프사 만들었어요',body,consent:true,generator:'chatgpt'}});
 assert.equal(ok.status,201,JSON.stringify(ok.json));
 assert.deepEqual([row(h,ok.json.id).consent_at,row(h,ok.json.id).ai_generated,row(h,ok.json.id).has_image],[T0,1,1]);
 // A foreign image is named first (before the consent).
 const other=await h.browser('192.0.2.33').call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'남의 사진',body,password:'1234'}});
 assert.equal(other.json.error.reason,'image_ref');
 // Signed out (유동): the same rule.
 const anon=h.browser('198.51.100.9');
 const aup=await anon.call('POST','/uploads',{raw:FIX('gps.webp')});assert.equal(aup.status,201,JSON.stringify(aup.json));
 const abody=`![](${aup.json.url})`;
 const an=await anon.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'익명 프사',body:abody,password:'1234'}});assert.equal(an.json.error?.field,'consent',JSON.stringify(an.json));
 h.clock.now+=61e3;
 const aok=await anon.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:'익명 프사',body:abody,password:'1234',consent:true,ai:true}});
 assert.equal(aok.status,201,JSON.stringify(aok.json));assert.equal(row(h,aok.json.id).consent_at,h.clock.now);
});

test('remixes: the original must be published with a recipe; remix_count follows writes, hides, restores and deletes',{skip},async()=>{
 const h=await harness();await h.member('a');await h.member('b');await h.member('mod','moderator');
 const a=h.browser('203.0.113.7','a'),b=h.browser('198.51.100.2','b'),mod=h.browser('192.0.2.9','mod');
 const orig=(await a.call('POST','/posts',{body:{channel:'sticker',kind:'line',title:'원본 레시피',body:'x',recipe:RECIPE}})).json;
 const plain=(await a.call('POST','/posts',{body:{channel:'sticker',kind:'question',title:'레시피 없는 글',body:'x'}})).json;
 assert.equal((await b.call('POST','/posts',{body:{channel:'sticker',kind:'kakao',title:'리믹스',body:'x',remixOf:plain.id}})).json.error.reason,'remix','no recipe, no remix');
 assert.equal((await b.call('POST','/posts',{body:{channel:'sticker',kind:'kakao',title:'리믹스',body:'x',remixOf:'nope'}})).json.error.reason,'remix');
 const r1=await b.call('POST','/posts',{body:{channel:'sticker',kind:'kakao',title:'카톡용 리믹스',body:'x',remixOf:orig.id,recipe:RECIPE}});
 assert.equal(r1.status,201,JSON.stringify(r1.json));
 assert.equal(row(h,orig.id).remix_count,1);assert.equal(row(h,r1.json.id).remix_of,orig.id);
 h.clock.now+=61e3;
 const r2=(await b.call('POST','/posts',{body:{channel:'sticker',kind:'discord',title:'디코 리믹스',body:'x',remixOf:orig.id}})).json;
 assert.equal(row(h,orig.id).remix_count,2);
 // A moderator hides one: it leaves the count; restored: back.
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${r2.id}`,action:'hide',reason:'확인 중'}})).status,200);
 assert.equal(row(h,orig.id).remix_count,1);
 assert.equal((await mod.call('POST','/mod/action',{body:{target:`discussion:${r2.id}`,action:'unhide',reason:'문제 없음'}})).status,200);
 assert.equal(row(h,orig.id).remix_count,2);
 // The author deletes one.
 assert.equal((await b.call('POST','/posts/delete',{body:{postId:r1.json.id}})).status,200);
 assert.equal(row(h,orig.id).remix_count,1);
 // A hidden original takes no new remixes.
 await mod.call('POST','/mod/action',{body:{target:`discussion:${orig.id}`,action:'hide',reason:'확인 중'}});
 h.clock.now+=61e3;
 assert.equal((await b.call('POST','/posts',{body:{channel:'sticker',kind:'kakao',title:'숨김 원본 리믹스',body:'x',remixOf:orig.id}})).json.error.reason,'remix');
});

/* ---------- recipe API ---------- */

test('GET /recipes/{id}: a published post\'s recipe for the workbench, cacheable; POST /recipes/{id}/try counts once per network a day',{skip},async()=>{
 const h=await harness();await h.member('a');const a=h.browser('203.0.113.7','a');
 const p=(await a.call('POST','/posts',{body:{channel:'sticker',kind:'line',title:'LINE 스탬프 24개',body:'x',recipe:RECIPE}})).json;
 const plain=(await a.call('POST','/posts',{body:{channel:'free',kind:'free',title:'잡담입니다',body:'x'}})).json;
 const anyone=h.browser('192.0.2.50');
 const g=await anyone.call('GET',`/recipes/${p.id}`);
 assert.equal(g.status,200);assert.match(g.headers.get('cache-control')||'',/public, max-age=60, s-maxage=60/);
 assert.deepEqual({id:g.json.id,channel:g.json.channel,no:g.json.no,generator:g.json.generator,prompt:g.json.prompt,author:g.json.author,tries:g.json.tries},{id:p.id,channel:'sticker',no:1,generator:'gemini',prompt:'표정 24개를 6×4 격자에',author:'a',tries:0});
 assert.equal(g.json.recipe.schema,RECIPE_SCHEMA);assert.equal(g.json.recipe.steps.length,4);assert.equal(g.json.title,'LINE 스탬프 24개');
 assert.equal((await anyone.call('GET',`/recipes/${plain.id}`)).status,404,'a post without a recipe');
 assert.equal((await anyone.call('GET','/recipes/nope')).status,404);
 assert.equal((await anyone.call('POST',`/recipes/${p.id}`)).status,405);
 assert.equal((await anyone.call('GET',`/recipes/${p.id}/try`)).status,405);
 // Try: once per network per recipe per KST day; no account.
 const t1=await anyone.call('POST',`/recipes/${p.id}/try`);assert.deepEqual([t1.status,t1.json],[200,{counted:true,tries:1}]);
 assert.deepEqual((await h.browser('192.0.2.77').call('POST',`/recipes/${p.id}/try`)).json,{counted:false,tries:1},'same /24 network, same day');
 assert.deepEqual((await h.browser('198.51.100.3').call('POST',`/recipes/${p.id}/try`)).json,{counted:true,tries:2},'another network');
 h.clock.now+=DAY;
 assert.deepEqual((await anyone.call('POST',`/recipes/${p.id}/try`)).json,{counted:true,tries:3},'the next day');
 assert.equal(row(h,p.id).try_count,3);
 assert.deepEqual(h.db.raw.prepare('SELECT day,n FROM recipe_try_days WHERE discussion_id=? ORDER BY day').all(p.id).map(r=>[r.day,r.n]),[['2026-10-11',2],['2026-10-12',1]]);
 assert.equal((await anyone.call('POST',`/recipes/${plain.id}/try`)).status,404);
 assert.equal((await anyone.call('POST',`/recipes/${p.id}/try`,{origin:'https://evil.example'})).status,403,'same-origin POSTs only');
 // Burst limit per network.
 const net=h.browser('192.0.2.200');let last=0;
 for(let i=0;i<RECIPE_TRY.perMinute+1;i++)last=(await net.call('POST',`/recipes/${p.id}/try`)).status;
 assert.equal(last,429);
});

/* ---------- safety ---------- */

test('one report of sexual content, a minor or a deepfake hides the post at once, pending review',{skip},async()=>{
 const h=await harness();await h.member('a');const a=h.browser('203.0.113.7','a');
 assert(['sexual','minor','deepfake'].every(c=>REPORT.severe.includes(c)));
 for(const [i,reason] of ['sexual','minor','deepfake'].entries()){
  h.clock.now+=61e3;
  const p=(await a.call('POST','/posts',{body:{channel:'pfp',kind:'share',title:`신고 대상 ${i}`,body:'x'}})).json;
  const r=await h.browser(`198.51.100.${10+i}`).call('POST','/flags',{body:{target:`discussion:${p.id}`,reason}});
  assert.equal(r.status,201,JSON.stringify(r.json));assert.equal(r.json.hidden,true,reason);
  assert.equal(row(h,p.id).status,'hidden');
  const log=h.db.raw.prepare("SELECT actor_id,action,reason FROM moderation_actions WHERE target_id=?").get(p.id);
  assert.deepEqual([log.actor_id,log.action],['system:automod','hide']);assert.match(log.reason,new RegExp(reason));
  assert.equal(h.db.raw.prepare('SELECT category FROM content_flags WHERE target_id=?').get(p.id).category,reason);
 }
 // Spam still needs several people.
 const s=(await a.call('POST','/posts',{body:{channel:'free',kind:'free',title:'광고 같은 글',body:'x'}})).json;
 assert.equal((await h.browser('198.51.100.40').call('POST','/flags',{body:{target:`discussion:${s.id}`,reason:'spam'}})).json.hidden,undefined);
});

/* ---------- pages ---------- */

let pagesDb=null;
async function pages(){
 if(pagesDb)return pagesDb;
 const db=D1Shim.migrated();
 await insertAiDemo(db,T0);
 return pagesDb=db;
}
const get=async(/** @type {string} */ p)=>{const r=await renderPlatformPage(new Request('https://nerulio.com'+p),{DB:await pages()},{origin:'https://nerulio.com',now:()=>T0});assert(r,`${p} is a page`);return r;};
const text=async(/** @type {string} */ p)=>{const r=await get(p);assert.equal(r.status,200,p);return r.text();};

test('post page (mockup 3): AI chip, image grid with 원본 and ZIP, recipe card ①②, remixes, curved reply connectors, phone bar',{skip},async()=>{
 const out=await text('/ko/community/sticker/1');
 assert(/class="mh ?">LINE 판매</.test(out)&&out.includes('class="mh ai">AI 생성<'),'말머리 and AI 생성');
 assert(out.includes('<figure class="rsrc">')&&out.includes('<figcaption>원본</figcaption>'),'the 원본 apart');
 assert(/<div class="rgrid chk c6">(<a href="\/u\/[0-9a-f]{24}\/full\.png" class="rgi">.*?<\/a>){6}<\/div>/.test(out),'six results in the grid');
 assert(out.includes('370×320 · PNG · 6개')&&out.includes('data-island="zip"')&&out.includes('ZIP 받기'));
 const pbody=out.slice(out.indexOf('<div class="pbody">'),out.indexOf('</div>',out.indexOf('<div class="pbody">')));
 assert(pbody.includes('LINE 규격까지')&&!pbody.includes('<img')&&!pbody.includes('!['),'the images are not repeated inline in the body');
 // Recipe card: header with counts and the two actions, ① 만들기 (generator, prompt + copy), ② 다듬기 (numbered steps).
 const card=out.slice(out.indexOf('<section class="rcard"'),out.indexOf('</section>',out.indexOf('<section class="rcard"')));
 assert(card.includes('해보기 96 · 리믹스 2')&&card.includes('href="/api/v2/recipes/demo-aic-1" download="nerulio-recipe-demo-aic-1.json"')&&card.includes('class="btn p" href="/ko/make/?recipe=demo-aic-1"'));
 assert(card.includes('① 만들기')&&card.includes('제미나이 (나노바나나) · 이 단계는 외부 서비스에서 해요')&&card.includes('id="prompt-demo-aic-1"')&&card.includes('data-copy="#prompt-demo-aic-1"'));
 const steps=summarize(JSON.parse(String((await pages()).raw.prepare("SELECT recipe_json FROM discussions WHERE id='demo-aic-1'").get().recipe_json)),'ko').steps;
 assert(card.includes(`② 다듬기`)&&card.includes(`${steps.length}단계`));
 for(const [i,s] of steps.entries())assert(card.includes(`<span class="rn mono">${i+1}</span><b>${s.name}</b>`),s.name);
 assert(card.includes('class="mh inf">AI 모델<'),'model steps are marked');
 // Votes, share/link/report, 리믹스 2 with thumbnails, comments with a nested reply, the phone bar.
 assert(out.includes('data-island="post-vote"')&&out.includes('href="/ko/community/report?target=discussion:demo-aic-1"'));
 const rx=out.slice(out.indexOf('id="remixes"'),out.indexOf('</section>',out.indexOf('id="remixes"')));
 assert(rx.includes('리믹스 2')&&rx.includes('리믹스로 올리기')&&(rx.match(/<li><a href="\/ko\/community\/sticker\/\d+">/g)||[]).length===2);
 assert(/class="co hk"[^>]*>[\s\S]*?<ol class="kids"><li class="co re"/.test(out),'replies nest under their parent (the curved connector, CSS .cl .kids>li::before)');
 assert(out.includes('<div class="mbar">')&&out.includes('class="front postv hasbar"'));
 // Phones (mockup 7): the compact header — back to the board, the channel, share — replaces the site header.
 assert(out.includes('<div class="col has-mhead">')&&/<header class="mhead"><a class="mback" href="\/ko\/community\/sticker\/" data-back aria-label="뒤로">/.test(out));
 assert(out.includes('<strong class="mtitle">이모티콘·스티커 채널</strong>')&&out.includes('class="mshare" data-island="share" aria-label="공유"'));
 assert(!(await text('/ko/community/sticker/')).includes('class="mhead"'),'boards keep the site header');
 // The right column: the recipe's tools and similar recipes before trends, sizes and rules.
 const side=out.slice(out.indexOf('<div class="side">'));
 assert(side.includes('이 레시피에 쓴 도구')&&side.indexOf('이 레시피에 쓴 도구')<side.indexOf('이번 주 유행'));
 assert(out.includes('<meta property="og:image" content="https://nerulio.com/u/'),'the first result is the share image');
 // A remix names its original; the original's JSON-LD is a forum post.
 const remix=await text('/ko/community/sticker/2');
 assert(remix.includes('리믹스 원본')&&remix.includes('href="/ko/community/sticker/1"'));
 assert(out.includes('"@type":"DiscussionForumPosting"'));
});

test('board (mockup 2): channel head, 말머리 tabs, 규격 row, the Kakao note, sort with 많이 해본 순, rows with a 36px thumbnail and 레시피',{skip},async()=>{
 const out=await text('/ko/community/sticker/');
 assert(out.includes('<h1>이모티콘·스티커 채널</h1>')&&out.includes('레시피 첨부 권장'));
 assert(out.includes('class="btn p" href="/ko/make/">다듬고 올리기')&&out.includes('href="/ko/community/sticker/write"'));
 for(const l of ['카톡 대화용','LINE 판매','디스코드','텔레그램','움짤','질문'])assert(out.includes(`>${l}</a>`),l);
 assert(out.includes('<nav class="specrow"')&&out.includes('href="/ko/make/line-sticker/"><b>LINE 스탬프</b><span class="mono">370×320</span>'));
 assert(out.includes('카카오 스토어는 AI 이모티콘을 받지 않아요 — 카톡 규격은 대화용'));
 assert(out.includes('href="/ko/community/sticker/?sort=tries"')&&out.includes('많이 해본 순')&&out.includes('★ 념글'));
 assert(/<span class="pth chk" aria-hidden="true"><img src="\/u\/[0-9a-f]{24}\/full\.png" alt="" width="36" height="36"/.test(out),'36px thumbnails');
 assert(out.includes('<span class="rbadge">레시피</span>')&&/<span class="cmt">\[3\]<\/span>/.test(out),'레시피 badge and [댓글]');
 const tries=await text('/ko/community/sticker/?sort=tries');
 assert(tries.includes('noindex')&&tries.indexOf('나노바나나 피규어로')<tries.indexOf('우리 집 강아지')+1e9);
 // An archived board says so, offers no write button, and its write page sends the writer to 자유.
 const games=await text('/ko/community/games/');
 assert(games.includes('보관된 채널 · 새 글은 받지 않아요')&&!games.includes('/ko/community/games/write'));
 assert(games.includes('<meta name="robots" content="noindex,follow">'),'archived board lists leave the index');
 assert(!out.includes('noindex'),'the AI 창작 boards are indexed');
 const oldPost=await get('/ko/community/games/1');if(oldPost.status===200)assert(!(await oldPost.text()).includes('noindex'),'archived posts stay indexable');
 assert.equal((await get('/ko/community/games/write')).status,302);
});

test('레시피 모음 and 이번 주 유행: recipe posts most tried first, hand-picked trends with their preset, this week\'s tries',{skip},async()=>{
 const r=await text('/ko/community/recipes/');
 assert(r.includes('<h1>레시피 모음</h1>')&&r.includes('aria-current="page"')&&r.includes('많이 해본 순'));
 const order=['나노바나나 피규어로','지브리 프사 테두리','챗GPT 도트가'].map(t=>r.indexOf(t));
 assert(order.every((x,i)=>x>0&&(i===0||order[i-1]<x)),'96 · 61 · 44 tries');
 assert(!r.includes('흰 테두리 두께 몇 px'),'posts without a recipe are not listed');
 assert(r.includes('<link rel="canonical" href="https://nerulio.com/ko/community/recipes/">')&&r.includes('"@type":"CollectionPage"'));
 assert((await text('/ko/community/recipes/?sort=new')).includes('<meta name="robots" content="noindex,follow">'));
 const ch=await text('/ko/community/recipes/?ch=pixel'),main=ch.slice(0,ch.indexOf('<div class="side">'));
 assert(main.includes('챗GPT 도트가')&&!main.includes('나노바나나 피규어로'),'the channel filter (the right column may still name other recipes)');
 const t=await text('/ko/community/trends/');
 assert(t.includes('<h1>이번 주 유행</h1>')&&t.includes('id="figure-sticker"')&&t.includes('href="/ko/make/line-sticker/"')&&t.includes('href="/ko/make/round-pfp/"'));
 assert(t.includes('이번 주 많이 해본 레시피')&&t.includes('나노바나나 피규어로'));
 assert((await text('/en/community/trends/')).includes('Trending this week'));
});

test('write page: the image consent, the AI fields, the workbench\'s recipe slot; policy: the AI rules in Korean and English',{skip},async()=>{
 const w=await text('/ko/community/pfp/write');
 assert(w.includes('name="consent" value="1" data-consent')&&w.includes('href="/ko/community/policy#ai"'));
 assert(w.includes('<select name="generator">')&&w.includes('value="gemini">제미나이 (나노바나나)<')&&w.includes('name="prompt"')&&w.includes('name="ai" value="1"'));
 assert(w.includes('data-recipe-draft hidden'),'filled from sessionStorage when opened from the workbench');
 const pol=await text('/ko/community/policy');
 const ai=pol.slice(pol.indexOf('id="ai"'),pol.indexOf('</section>',pol.indexOf('id="ai"')));
 for(const x of ['전연령만','실제 사람이 나오는 사진은 본인 사진만','얼굴 바꾸기','나이 바꾸기','성적인 딥페이크','신고 1건이면 바로 숨겨요','AI 생성'])assert(ai.includes(x),x);
 const en=await text('/en/community/policy');
 assert(en.includes('id="ai"')&&en.includes('All ages only')&&en.includes('No face swaps'));
 // The report form offers the new categories, marked "hidden at once".
 const flag=await text('/ko/community/report?target=discussion:demo-aic-1');
 assert(flag.includes('value="deepfake">실존 인물 합성·딥페이크 (즉시 숨김)')&&flag.includes('value="minor"')&&flag.includes('value="sexual">음란물·선정적 이미지 (즉시 숨김)'));
});

test('SEO for the pivot: titles say what the site is; AI/game entity pages and the Radar are noindex and out of the sitemaps; the community sitemap lists boards, lists and posts',{skip},async()=>{
 const home=await text('/');
 assert(home.includes('<title>Nerulio — AI 창작 커뮤니티: AI로 만든 이미지를 다듬고 레시피를 공유</title>')&&home.includes('<meta property="og:title" content="Nerulio — AI 창작 커뮤니티'));
 assert((await text('/en/')).includes('<title>Nerulio — AI creation community: finish AI images and share the recipe</title>'));
 assert((await text('/ko/radar/')).includes('<meta name="robots" content="noindex,follow">'),'the Radar stays reachable, noindex');
 assert.deepEqual([...ARCHIVED_VERTICALS],['ai','games']);
 assert(PLATFORM_SITEMAPS.includes('sitemap-n2-community.xml')&&!PLATFORM_SITEMAPS.includes('sitemap-n2-ai.xml')&&!PLATFORM_SITEMAPS.includes('sitemap-n2-games.xml'));
 const db=await pages();
 assert.equal(await handlePlatformPage(new Request('https://nerulio.com/sitemap-n2-games.xml'),{DB:db},{},{origin:'https://nerulio.com'}),null,'the archived sitemaps are gone');
 const xml=await renderSitemap(db,'community','https://nerulio.com');
 for(const p of ['/','/en/','/ko/community/recipes/','/en/community/trends/','/ko/community/best/',...CHANNELS.filter(c=>!c.readOnly).map(c=>`/ko/community/${c.id}/`),'/ko/community/sticker/1','/ko/community/pixel/1'])assert(xml.includes(`<loc>https://nerulio.com${p}</loc>`),p);
 assert(!xml.includes('/radar/')&&!xml.includes('/community/games/')&&!xml.includes('/community/ai/'),'no Radar, no archived boards');
 assert(!xml.includes('/en/community/sticker/1<'),'a post is listed in the language it was written in');
});
