import test from 'node:test';
import assert from 'node:assert/strict';
import {D1Shim,sqliteAvailable} from './d1-shim.mjs';
import {seedDatabase} from '../tools/platform/seed-db.mjs';
import {insertDemoContent} from '../tools/platform/demo-posts.mjs';
import {html,raw,safeHref} from '../platform/render/html.js';
import {compact,boardTime,dday,money} from '../platform/render/format.js';
import {entityBySlug,factsFor} from '../platform/db/channel.js';
import {loadChannel,renderChannel,trendingTerms,dayStart} from '../platform/render/channel.js';
import {loadPost,renderPost} from '../platform/render/post.js';
import {loadFront,renderFront} from '../platform/render/front.js';
import {panelFor} from '../platform/render/panels/index.js';
import {createPost} from '../platform/community.js';
import {matchPlatformRoute,renderPlatformPage} from '../server/platform/pages.js';

const NOW=Date.UTC(2026,8,28,6,0);   // 2026-09-28 15:00 KST
const SITE={origin:'https://nerulio.com'};
let db=null;
async function seeded(){
 if(db)return db;
 db=D1Shim.migrated();
 await seedDatabase(db,undefined,NOW-2*864e5);
 await insertDemoContent(db,NOW);
 return db;
}
const channel=async(vertical,slug,o={})=>{const d=await seeded();const {entity}=await entityBySlug(d,vertical,slug);assert(entity,`${vertical}/${slug} exists`);const m=await loadChannel(d,entity,{l:'ko',now:NOW,...o});return {m,out:String(renderChannel(m,SITE))};};

test('html`` escapes every value and only trusts raw()/nested templates',()=>{
 const x='<img src=x onerror=alert(1)>';
 assert.equal(String(html`<b>${x}</b>`),'<b>&lt;img src=x onerror=alert(1)&gt;</b>');
 assert.equal(String(html`<i>${html`<u>${'&'}</u>`}${raw('<br>')}${null}${false}${[1,'<']}</i>`),'<i><u>&amp;</u><br>1&lt;</i>');
 assert.equal(String(html`<a title="${'"q"'}">`),'<a title="&quot;q&quot;">');
 assert.equal(safeHref('javascript:alert(1)'),'#');assert.equal(safeHref('//evil.example'),'#');assert.equal(safeHref('/ko/ai/claude/'),'/ko/ai/claude/');
});

test('board formatting: counts, times in Korea time, D-day, money',()=>{
 assert.equal(compact(12480,'ko'),'1.2만');assert.equal(compact(1900,'ko'),'1.9천');assert.equal(compact(640,'ko'),'640');assert.equal(compact(12480,'en'),'12.5K');
 assert.equal(boardTime(NOW-60e3,NOW,'ko'),'14:59');                          // same KST day
 assert.equal(boardTime(Date.UTC(2026,8,27,16,0),NOW,'ko'),'01:00');          // 01:00 KST today
 assert.equal(boardTime(Date.UTC(2026,8,26,1,0),NOW,'ko'),'09.26');
 assert.equal(boardTime(Date.UTC(2025,0,2),NOW,'ko'),'2025.01.02');
 assert.equal(dday(Date.UTC(2026,9,2,15,0),NOW,'ko'),'D-5');                    // Oct 3 00:00 KST
 assert.equal(money(4,'USD','ko'),'$4');assert.equal(money(0.25,'USD','en'),'$0.25');
 assert.equal(dayStart(NOW,'ko'),Date.UTC(2026,8,27,15,0));
});

test('trending terms need two posts and skip the channel name and filler words',()=>{
 const t=trendingTerms([{title:'API 지연 있나요',weight:1},{title:'지금 API 느림',weight:2},{title:'Claude 한도 질문',weight:1},{title:'혹시 Claude 한도',weight:1},{title:'혼자 나온 단어',weight:9}],'Claude');
 assert.deepEqual(t.slice(0,2).sort(),['API','한도']);
 assert(!t.includes('Claude')&&!t.includes('단어'));
});

test('seed import loads every seed file through the ingest pipeline',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const n=Number((await d.prepare('SELECT COUNT(*) AS n FROM entities').first()).n);
 assert(n>=1500,`entities: ${n}`);
 assert.equal(Number((await d.prepare("SELECT COUNT(*) AS n FROM changes WHERE importance>0 AND kind IN ('fact_added','entity_added')").first()).n),0,'seed history is not Radar news');
});

test('AI service channel: status, models with official API prices, plans in the wiki',{skip:!sqliteAvailable},async()=>{
 const {m,out}=await channel('ai','claude');
 assert.equal(m.panel.id,'ai-service');
 assert.match(out,/<h1>Claude 채널 <span class="ha">클로드<\/span><\/h1>/);
 assert(out.includes('서비스 상태')&&out.includes('확인 전')&&!out.includes('보고된 장애 없음'),'no status claim before the status collector has run');
 const d=await seeded();
 await d.prepare("INSERT OR REPLACE INTO collectors (adapter,vertical,last_success_at) VALUES ('claude-status','ai',?)").bind(NOW-600e3).run();
 const fresh=String(renderChannel(await loadChannel(d,m.entity,{l:'ko',now:NOW}),SITE));
 assert(fresh.includes('보고된 장애 없음')&&fresh.includes('10분 전 확인'),'after a fresh collector run');
 await d.prepare("DELETE FROM collectors WHERE adapter='claude-status'").run();
 assert(out.includes('Claude Opus 5.5')&&out.includes('$4 / $20'),'Opus 5.5 at $4 / $20 from the seed');
 assert(out.includes('Claude 위키')&&out.includes('>Pro<')&&out.includes('$20'),'plans table');
 assert(out.includes('rel="canonical" href="https://nerulio.com/ko/ai/claude/"'));
 assert(out.includes('hreflang="en" href="https://nerulio.com/en/ai/claude/"'));
 assert(/class="pr[^"]*"><span class="no">\d+<\/span><a class="tt" href="\/ko\/ai\/claude\/\d+">/.test(out),'board rows link to posts');
});

test('game channel: latest Steam update, Korean patch compatibility, official Korean',{skip:!sqliteAvailable},async()=>{
 const {m,out}=await channel('games','caves-of-qud');
 assert.equal(m.panel.id,'game');
 assert(out.includes('최신 업데이트')&&out.includes('1.04'));
 assert(out.includes('공식 한국어 없음'));
 assert(out.includes('한글패치 호환표')&&out.includes('2.0.212.31'));
});

test('GPU channel: official specs and a labelled VRAM estimate, never a speed estimate',{skip:!sqliteAvailable},async()=>{
 const {m,out}=await channel('hardware','rtx-5070');
 assert.equal(m.panel.id,'gpu');
 assert(out.includes('12 GB')&&out.includes('Blackwell')&&out.includes('$549'));
 assert(out.includes('≈ 추정')&&out.includes('추정 방법'),'estimate is labelled and explained');
 assert(!/≈[^<]*tok\/s/.test(out),'tokens/s only from community measurements');
 for(const f of m.data.fit)assert.equal(f.r.label,'ESTIMATE');
});

test('studio and IP channels render their panels from seed data',{skip:!sqliteAvailable},async()=>{
 const a=await channel('studio','ableton-live');
 assert.equal(a.m.panel.id,'studio');assert(a.out.includes('업그레이드해도 될까?')&&a.out.includes('12.4.6'));
 const b=await channel('subculture','bleach-tybw-the-calamity');
 assert.equal(b.m.panel.id,'ip');assert(b.out.includes('다음 일정')&&b.out.includes('class="cd"'));
});

test('filtered/paged board views are noindex and keep the filter in links',{skip:!sqliteAvailable},async()=>{
 const {out}=await channel('ai','claude',{kind:'question',sort:'top'});
 assert(out.includes('<meta name="robots" content="noindex,follow">'));
 assert(out.includes('href="/ko/ai/claude/?kind=question&amp;sort=top"')||out.includes('kind=question'));
 const plain=(await channel('ai','claude')).out;
 assert(!plain.includes('noindex'));
});

test('user text is escaped in board rows and on the post page',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();const {entity}=await entityBySlug(d,'ai','claude');
 const no=await createPost(d,{id:'xss-1',entityId:entity.id,kind:'free',title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)> **굵게**',locale:'ko',authorId:'demo:u3'},NOW-1000);
 const {out}=await channel('ai','claude');
 assert(!out.includes('<script>alert(1)</script>')&&out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 const page=String(renderPost(await loadPost(d,entity,no,{l:'ko',now:NOW}),SITE));
 assert(!page.includes('<img src=x')&&page.includes('<strong>굵게</strong>'));
 await d.prepare("DELETE FROM discussions WHERE id='xss-1'").run();
});

test('post page: meta, threaded comments with the best comment on top, board around it',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();const {entity}=await entityBySlug(d,'ai','claude');
 const row=await d.prepare("SELECT post_no FROM discussions WHERE entity_id=? AND title LIKE 'Opus 5.5로%'").bind(entity.id).first();
 const m=await loadPost(d,entity,Number(row.post_no),{l:'ko',now:NOW});
 const out=String(renderPost(m,SITE));
 assert(out.includes('댓글 2')&&out.includes('class="co re"'));
 assert(!out.includes('class="co bestc"'),'with two comments the best one is not pinned twice');
 const withThree={...m,comments:[...m.comments,{...m.comments[0],id:'c-extra',parent_id:null,up:0}]};
 assert(String(renderPost(withThree,SITE)).includes('class="co bestc"'),'with three or more the best comment is pinned on top');
 assert(out.includes('aria-current="page"'),'current post marked in the list');
 assert(out.includes('"@type":"DiscussionForumPosting"'));
 assert.equal(await loadPost(d,entity,999999,{l:'ko',now:NOW}),null);
});

test('community front: best, Radar bot news only, questions, popular channels',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const m=await loadFront(d,{l:'ko',now:NOW});
 const out=String(renderFront(m,SITE));
 assert(out.includes('실시간 베스트')&&out.includes('5070 vs 4070 SUPER'));
 assert(m.news.every(p=>p.bot),'"changing now" lists Radar bot posts only');
 assert(out.includes('답을 기다리는 질문')&&out.includes('인기 채널'));
});

test('every entity type renders a channel page in both languages',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const types=(await d.prepare("SELECT vertical,type,MIN(slug) AS slug FROM entities WHERE status='active' GROUP BY vertical,type").all()).results;
 assert(types.length>=20);
 for(const t of types)for(const l of ['ko','en']){
  const {entity}=await entityBySlug(d,t.vertical,t.slug);
  const out=String(renderChannel(await loadChannel(d,entity,{l,now:NOW}),SITE));
  assert(out.startsWith('<!doctype html>')&&out.includes('</html>'),`${t.vertical}:${t.type} ${l}`);
  assert(!/undefined|NaN|\[object Object\]/.test(out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,'')),`${t.vertical}:${t.type} ${l} has no undefined/NaN`);
 }
 // English pages use English chrome.
 const {out}=await channel('ai','claude',{l:'en'});
 assert(out.includes('<html lang="en">')&&out.includes('Service status')&&!out.includes('서비스 상태'));
});

test('panel registry picks a panel per channel kind',()=>{
 const e=(vertical,type)=>({vertical,type});
 assert.equal(panelFor(e('ai','service')).id,'ai-service');assert.equal(panelFor(e('games','game')).id,'game');
 assert.equal(panelFor(e('hardware','gpu')).id,'gpu');assert.equal(panelFor(e('studio','plugin')).id,'studio');
 assert.equal(panelFor(e('subculture','work')).id,'ip');assert.equal(panelFor(e('ai','plan')).id,'generic');
});

test('Worker routes: platform paths only, renamed slugs redirect, unknown channels fall through',{skip:!sqliteAvailable},async()=>{
 assert.deepEqual(matchPlatformRoute('/ko/ai/claude/'),{l:'ko',page:'channel',vertical:'ai',slug:'claude',no:null});
 assert.deepEqual(matchPlatformRoute('/en/games/caves-of-qud/12'),{l:'en',page:'post',vertical:'games',slug:'caves-of-qud',no:12});
 assert.deepEqual(matchPlatformRoute('/ko/community/'),{l:'ko',page:'front'});
 for(const p of ['/ko/ai/claude','/ja/ai/claude/','/ko/image/compress/','/ko/ai/Claude/','/ko/ai/claude/x'])assert.equal(matchPlatformRoute(p),null,p);
 const d=await seeded();
 const res=await renderPlatformPage(new Request('https://nerulio.com/ko/ai/claude/'),{DB:d},{origin:'https://nerulio.com',now:()=>NOW});
 assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/s-maxage=60/);
 assert((await res.text()).includes('Claude 채널'));
 assert.equal(await renderPlatformPage(new Request('https://nerulio.com/ko/ai/no-such-channel/'),{DB:d},{origin:'https://nerulio.com',now:()=>NOW}),null);
 await d.prepare("INSERT INTO entity_redirects (vertical,slug,entity_id,created_at) VALUES ('ai','claude-ai','service:claude',0)").run();
 const r=await renderPlatformPage(new Request('https://nerulio.com/ko/ai/claude-ai/3'),{DB:d},{origin:'https://nerulio.com',now:()=>NOW});
 assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://nerulio.com/ko/ai/claude/3');
 const go=async p=>renderPlatformPage(new Request('https://nerulio.com'+p),{DB:d},{origin:'https://nerulio.com',now:()=>NOW});
 // Junk or invalid parameters are redirected to the canonical URL (no cache-busting renders).
 assert.equal((await go('/ko/ai/claude/?x=1')).headers.get('location'),'https://nerulio.com/ko/ai/claude/');
 assert.equal((await go('/ko/ai/claude/?page=1.5&kind=constructor&sort=new')).headers.get('location'),'https://nerulio.com/ko/ai/claude/');
 assert.equal((await go('/ko/ai/claude/?sort=top&kind=question&utm=1')).headers.get('location'),'https://nerulio.com/ko/ai/claude/?kind=question&sort=top');
 assert.equal((await go('/ko/ai/claude/?kind=question&sort=top')).status,200);
 const page=await go('/ko/ai/claude/');
 assert.match(page.headers.get('content-security-policy'),/form-action 'self'/);assert.equal(page.headers.get('x-content-type-options'),'nosniff');
 for(const p of ['/ko/search/?q=claude','/ko/radar/','/ko/community/best/','/ko/community/report?target=discussion:abc'])assert.equal((await go(p)).status,200,p);
 const search=await (await go('/ko/search/?q=5070')).text();
 assert(search.includes('/ko/hardware/rtx-5070/'),'model numbers find the GPU channel');
 const cheap=await (await go('/ko/ai/?type=model&org=anthropic&sort=cheap')).text();
 assert(cheap.indexOf('Claude Haiku 4.5')<cheap.indexOf('Claude Sonnet 5')&&!cheap.includes('GPT-'),'company filter and cheapest-first sort');
 assert.equal((await go('/ko/ai/?sort=cheap&org=anthropic&type=model')).headers.get('location'),'https://nerulio.com/ko/ai/?type=model&org=anthropic&sort=cheap');
 assert.equal((await go('/ko/hardware/?type=gpu&vs=rtx-5070,rtx-4070')).headers.get('location'),'https://nerulio.com/ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070','one URL per pair');
 const vs=await (await go('/ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070')).text();
 assert(/<title>[^<]*RTX 4070 vs [^<]*RTX 5070 비교/.test(vs)&&vs.includes('<link rel="canonical" href="https://nerulio.com/ko/hardware/?type=gpu&amp;vs=rtx-4070,rtx-5070"'),'the pair is its own page');
 assert(/4070 vs [^<]*5070/.test(vs),'two cards side by side');
 assert(vs.includes('class="mt vs"'));
 // Boards open first on AI, 한글패치 and GPU channels (OPEN_BOARDS); others read "준비 중".
 const studio=await (await go('/ko/studio/ableton-live/')).text();
 assert(studio.includes('게시판은 준비 중')&&!studio.includes('href="/ko/studio/ableton-live/write"'),'closed board: no write button');
 assert((await (await go('/ko/studio/ableton-live/write')).text()).includes('게시판 준비 중'));
 assert((await (await go('/ko/hardware/rtx-5070/')).text()).includes('href="/ko/hardware/rtx-5070/write"'),'GPU boards are open');
 const gone=await go('/ko/ai/claude/999999');
 assert.equal(gone.status,404);assert((await gone.text()).includes('href="/ko/ai/claude/"'),'a missing post leads back to its channel');
 const both=await (await go('/ko/search/?q=5070+4070')).text();
 assert(both.includes('/ko/hardware/rtx-5070/')&&both.includes('/ko/hardware/rtx-4070/'),'several words: each word finds its channel');
 const claudeAll=await (await go('/ko/search/?q=claude')).text();
 assert(claudeAll.includes('more=1'),'a long result list offers more');
 assert.equal((await go('/ko/search/?q=claude&more=1')).status,200);
 const gpt=await (await go('/ko/search/?q='+encodeURIComponent('챗GPT'))).text();
 assert(gpt.includes('href="/ko/ai/chatgpt/"'),'Korean spelling finds ChatGPT');
 const down=await (await go('/ko/search/?q=Claude+%EC%9E%A5%EC%95%A0')).text();
 assert(down.includes('href="/ko/ai/claude/status"'),'"Claude 장애" leads to the status page');
 assert(down.includes('href="/ko/ai/claude/"'),'and still lists the channel');
});

test('facts shown on a channel are the current rows',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const f=(await factsFor(d,['gpu:rtx-5070'])).get('gpu:rtx-5070');
 assert(f.find(x=>x.property==='vram_gb'&&x.value===12));
});

test('status, history and write pages render; status is only for services',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const get=async p=>renderPlatformPage(new Request('https://nerulio.com'+p),{DB:d},{origin:'https://nerulio.com',now:()=>NOW});
 const st=await get('/ko/ai/claude/status');
 const html=await st.text();
 assert(html.includes('지금 Claude(클로드) 장애?')&&html.includes('최근 24시간 사용자 리포트')&&html.includes('<svg class="hchart"'));
 assert(html.includes('사용자 리포트 급증'),'sample clicks in the last hour are a spike against the quiet week');
 assert(html.includes('커뮤니티 리포트'),'user reports are labelled as community reports');
 // With a reference rate, USD plan prices get "≈ ₩" and the rate's date.
 await d.prepare("INSERT INTO fx_rates (base,quote,rate,as_of,source_url,fetched_at) VALUES ('USD','KRW',1400,'2026-09-25','https://www.ecb.europa.eu/',?)").bind(NOW).run();
 const plans=await (await get('/ko/ai/?type=plan')).text();
 assert(plans.includes('≈ ₩28,000')&&plans.includes('ECB 기준환율(2026-09-25'),'Claude Pro $20 ≈ ₩28,000');
 assert((await (await get('/ko/ai/claude/')).text()).includes('≈ ₩28,000'));
 const pro=await (await get('/ko/ai/claude-pro/')).text(),proEn=await (await get('/en/ai/claude-pro/')).text();
 assert(pro.includes('연간 결제 시 월 $17')&&!pro.includes('with annual billing'),'Korean pages show the Korean price note');
 assert(proEn.includes('with annual billing'),'English pages keep the official text');
 const ch=await (await get('/ko/ai/claude/')).text();
 assert(ch.includes('사용자 리포트 급증'),'the channel status box says what the status page says');
 assert(!ch.includes('>확인 전<'),'no bare "not checked" when users are reporting');
 assert.equal(await get('/ko/hardware/rtx-5070/status'),null,'no status page for a GPU');
 const hist=await (await get('/ko/hardware/rtx-5070/history')).text();
 assert(hist.includes('변경 기록')&&hist.includes('출처'));
 const w=await (await get('/ko/games/caves-of-qud/write')).text();
 assert(w.includes('구조화 리포트')&&w.includes('noindex')&&w.includes('data-island="write-form"'));
 const w2=await (await get('/ko/ai/claude/write')).text();
 assert(!w2.includes('구조화 리포트'),'no report form where there is nothing to report on');
 assert(!w2.includes('value="patch"'),'한글패치 tag only on game channels');
});

test('content gate: thin name-only channels are noindex and left out of the entity sitemaps',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const {renderSitemap}=await import('../server/platform/pages.js');
 const xml=await renderSitemap(d,'hardware','https://nerulio.com');
 assert(xml.startsWith('<?xml')&&xml.includes('https://nerulio.com/ko/hardware/rtx-5070/')&&xml.includes('hreflang="en"'));
 assert(xml.includes('/ko/hardware/?type=gpu&amp;vs=rtx-3090,rtx-4090'),'successor GPU pairs are listed');
 const ai=await renderSitemap(d,'ai','https://nerulio.com');
 assert(ai.includes('/ko/ai/claude/status'),'service status pages are listed');
 // A company page with only a name and a relation or two is not indexable.
 const thin=(await d.prepare("SELECT e.slug FROM entities e WHERE e.type='org' AND NOT EXISTS (SELECT 1 FROM facts f WHERE f.entity_id=e.id AND f.is_current=1) AND e.descriptions='{}' LIMIT 1").first());
 if(thin){
  const {out}=await channel('games',thin.slug);
  assert(out.includes('noindex'),`${thin.slug} is thin`);
  assert(!(await renderSitemap(d,'games','https://nerulio.com')).includes(`/games/${thin.slug}/`));
 }
 assert(!(await channel('hardware','rtx-5070')).out.includes('noindex'),'a rich channel is indexed');
});

test('per-page queries use indexes (D1 bills rows read)',{skip:!sqliteAvailable},async()=>{
 const d=D1Shim.migrated();
 const plan=(sql,...p)=>d.raw.prepare('EXPLAIN QUERY PLAN '+sql).all(...p).map(r=>r.detail).join(' | ');
 for(const [name,sql,params] of [
  ['popular channels',"SELECT e.id,COUNT(d.id) FROM discussions d JOIN entities e ON e.id=d.entity_id WHERE d.status='published' AND d.created_at>=? AND e.status='active' GROUP BY e.id",[0]],
  ['today count',"SELECT COUNT(*) FROM discussions WHERE entity_id=? AND status='published' AND created_at>=?",['a',0]],
  ['board',"SELECT id FROM discussions d WHERE d.entity_id=? AND d.status IN ('published','locked') ORDER BY d.pinned DESC,d.post_no DESC LIMIT 31",['a']],
  ['by tag',"SELECT id FROM discussions d WHERE d.status='published' AND d.kind='report' ORDER BY d.created_at DESC LIMIT 6",[]],
  ['alias prefix','SELECT entity_id FROM entity_aliases WHERE norm>=? AND norm<? LIMIT 60',['a','b']],
  ['releases','SELECT * FROM versions WHERE released_at BETWEEN ? AND ?',[0,1]],
 ]){const p=plan(sql,...params);assert(!/\bSCAN (d|discussions|entity_aliases|versions)\b/.test(p),`${name}: ${p}`);}
});

test('model channels: official API price, price history area, local-run estimate for open weights; typed structured data',{skip:!sqliteAvailable},async()=>{
 const a=await channel('ai','claude-opus-5-5');
 assert.equal(a.m.panel.id,'model');
 assert(a.out.includes('API 가격')&&a.out.includes('$4')&&a.out.includes('가격 변경 이력'));
 assert(!a.out.includes('로컬에서 돌리려면'),'closed models have no local-run box');
 const g=await channel('ai','gemma-4-12b');
 assert(g.out.includes('로컬에서 돌리려면')&&g.out.includes('12GB 카드부터'));
 const ld=JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec((await channel('games','caves-of-qud')).out)[1]);
 assert.equal(ld['@graph'][0].about.additionalType,'https://schema.org/VideoGame','typed without claiming a rich result it cannot fill');assert.equal(ld['@graph'][1]['@type'],'BreadcrumbList');
 assert(!(await channel('games','caves-of-qud')).out.includes('스프라이트 랩'),'game-asset tools are not linked from every game');
});

test('Korean patch: a game update past the last confirmed version is flagged; patch channel links to the author only',{skip:!sqliteAvailable},async()=>{
 const {staleSince}=await import('../platform/render/panels/game.js');
 const rows=[{subject_id:'p',target_version:'1.0.2',status:'works'},{subject_id:'p',target_version:'1.0.3',status:'works_with_issues'},{subject_id:'p',target_version:'*',status:'unknown'}];
 assert.equal(staleSince(rows,'p','1.04'),'1.0.3');
 assert.equal(staleSince([...rows,{subject_id:'p',target_version:'1.04',status:'broken'}],'p','1.04'),null,'current version has a row: no stale flag');
 const d=await seeded();
 const slug=(await d.prepare("SELECT slug FROM entities WHERE type='translation_patch' ORDER BY slug LIMIT 1").first()).slug;
 const {m,out}=await channel('games',slug);
 assert.equal(m.panel.id,'patch');
 assert(out.includes('패치 정보')&&out.includes('Nerulio는 패치 파일을 올리거나 보관하지 않습니다'));
});

test('hub pages list a vertical by type; RSS feeds for channels and the Radar',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const go=async p=>renderPlatformPage(new Request('https://nerulio.com'+p),{DB:d},{origin:'https://nerulio.com',now:()=>NOW});
 const hub=await (await go('/ko/hardware/')).text();
 assert(hub.includes('/ko/hardware/rtx-5070/')&&hub.includes('그래픽카드'));
 const typed=await go('/ko/games/?type=translation_patch');assert.equal(typed.status,200);
 assert((await typed.text()).includes('한글패치'));
 assert.equal((await go('/ko/games/?type=zzz')).status,200,'unknown type falls back to all');
 const feed=await go('/ko/ai/claude/feed.xml');
 assert.match(feed.headers.get('content-type'),/rss\+xml/);
 const xml=await feed.text();assert(xml.startsWith('<?xml')&&xml.includes('<rss version="2.0">')&&xml.includes('https://nerulio.com/ko/ai/claude/'));
 assert(!xml.includes('<script'),'escaped');
 assert((await (await go('/ko/radar/feed.xml')).text()).includes('<channel><title>Nerulio 레이더</title>'));
 assert((await (await go('/ko/ai/claude/')).text()).includes('type="application/rss+xml" href="/ko/ai/claude/feed.xml"'));
});

test('AI hub: plan and model price comparison tables from official facts',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const go=async p=>(await renderPlatformPage(new Request('https://nerulio.com'+p),{DB:d},{origin:'https://nerulio.com',now:()=>NOW})).text();
 const plans=await go('/ko/ai/?type=plan');
 assert(plans.includes('AI 요금제 비교')&&plans.includes('Claude Pro')&&plans.includes('$20'));
 assert(!plans.includes('noindex'),'the comparison is indexable');
 const gpus=await go('/ko/hardware/?type=gpu');
 assert(gpus.includes('그래픽카드 VRAM·스펙 비교')&&gpus.includes('/ko/hardware/rtx-5070/local-llm'));
 const models=await go('/ko/ai/?type=model');
 assert(models.includes('AI 모델 API 가격 비교')&&models.includes('Claude Opus 5.5'));
});

test('games hub lists Korean patches a game update left unconfirmed (real version order only)',{skip:!sqliteAvailable},async()=>{
 const {versionCompare,stalePatches}=await import('../platform/db/channel.js');
 assert.equal(versionCompare('1.4.5.7','1.4.5.3'),1);assert.equal(versionCompare('v0.14.7','0.14.5'),1);assert.equal(versionCompare('0.14.5','v0.14.7'),-1);assert.equal(versionCompare('2.0','2.0.0'),0);
 const d=await seeded();
 for(const s of await stalePatches(d,20))assert(versionCompare(s.current,s.lastOk)>0,`${s.game.slug}: ${s.current} vs ${s.lastOk}`);
 const html=await (await renderPlatformPage(new Request('https://nerulio.com/ko/games/'),{DB:d},{origin:'https://nerulio.com',now:()=>NOW})).text();
 assert(html.includes('업데이트로 한글패치 확인이 필요한 게임'));
});

test('works hub shows this week\'s broadcasts by weekday in Korea time',{skip:!sqliteAvailable},async()=>{
 const d=await seeded();
 const html=await (await renderPlatformPage(new Request('https://nerulio.com/ko/subculture/?type=work'),{DB:d},{origin:'https://nerulio.com',now:()=>NOW})).text();
 assert(html.includes('이번 주 방영·공개 시간표 (한국 시간)')&&(html.match(/<li( class="today")?><h3>/g)||[]).length===7);
});

test('community rules page and the wiki box\'s last-checked date',{skip:!sqliteAvailable},async()=>{
 {const {renderPolicy}=await import('../platform/render/policy.js');const out=String(renderPolicy({l:'ko'},SITE));
  assert(out.includes('id="ratings"')&&out.includes('3배 이상')&&out.includes('60일마다'),'the formulas behind the numbers are published');}
 const d=await seeded();
 const go=async p=>(await renderPlatformPage(new Request('https://nerulio.com'+p),{DB:d},{origin:'https://nerulio.com',now:()=>NOW})).text();
 const pol=await go('/ko/community/policy');
 assert(pol.includes('게시판 운영정책')&&pol.includes('임시조치')&&pol.includes('한글패치·유료 소프트웨어 파일 자체'));
 const ch=await go('/ko/hardware/rtx-5070/');
 assert(/\d\d\.\d\d 확인<\/span> · 기록/.test(ch),'last-checked date next to the history link');
 assert(ch.includes('href="/ko/community/policy"'),'footer links the rules');
});
