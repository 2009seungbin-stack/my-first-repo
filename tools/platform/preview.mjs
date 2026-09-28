#!/usr/bin/env node
/** Local preview of the platform pages rendered by the real renderers from the real seed data:
 *   node tools/platform/preview.mjs [outDir]   (default .n2/preview)
 * Builds an in-memory D1 (migrations + every seed file), adds the SAMPLE boards from demo-posts.mjs,
 * renders the community front, one channel per panel kind, two posts and an English channel, and
 * rewrites links between the rendered pages to relative files so the folder opens anywhere. */
import {mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {D1Shim} from '../../tests/d1-shim.mjs';
import {seedDatabase} from './seed-db.mjs';
import {insertDemoContent} from './demo-posts.mjs';
import {entityBySlug} from '../../platform/db/channel.js';
import {CSS_HREF} from '../../platform/render/ui.js';
import {renderPlatformPage} from '../../server/platform/pages.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const SHOWCASE=[['ai','claude'],['games','caves-of-qud'],['hardware','rtx-5070'],['studio','ableton-live'],['subculture','bleach-tybw-the-calamity']];
/** [path, title] of every previewed page. */
export const PREVIEW_PATHS=Object.freeze([
 ['/ko/community/','커뮤니티 홈'],['/ko/ai/claude/','Claude 채널'],['/ko/ai/claude/status','지금 Claude 장애?'],['/ko/ai/claude/history','Claude 변경 기록'],
 ['/ko/ai/claude-opus-5-5/','Claude Opus 5.5 (모델 채널)'],['/ko/ai/gemma-4-12b/','Gemma 4 12B (공개 모델 채널)'],
 ['/ko/games/caves-of-qud/','Caves of Qud (게임 채널)'],['/ko/games/wasteland-3-korean-patch/','Wasteland 3 한글패치 (패치 채널)'],
 ['/ko/hardware/rtx-5070/','RTX 5070 채널'],['/ko/hardware/rtx-5070/local-llm','RTX 5070에서 돌아가는 로컬 LLM'],
 ['/ko/studio/ableton-live/','에이블톤 라이브 채널'],['/ko/subculture/bleach-tybw-the-calamity/','블리치 천년혈전 채널'],
 ['/ko/radar/','레이더'],['/ko/games/','게임 채널 모음 (허브)'],['/ko/search/?q=5070','검색: 5070'],['/ko/community/best/','념글'],
 ['/ko/games/caves-of-qud/write','글쓰기 (구조화 리포트)'],['/ko/community/transparency','운영 투명성'],['/en/ai/claude/','Claude channel (English)'],
 ['/ko/hardware/?type=gpu&vs=rtx-4070,rtx-5070','RTX 4070 vs RTX 5070 비교'],['/ko/ai/?type=model&org=anthropic&sort=cheap','AI 모델 API 가격 비교 (회사·정렬)'],['/ko/ai/?type=plan','AI 요금제 비교'],
 ['/ko/search/?q=Claude+%EC%9E%A5%EC%95%A0','검색: Claude 장애'],['/ko/community/policy','운영정책 (계산식 공개)'],['/ko/ai/claude-pro/','Claude Pro (요금제 채널)'],
]);
const SITE={origin:'https://nerulio.com'};

/** Channel bar for anonymous readers (an island replaces it with the reader's subscriptions). */
export async function channelBar(db,l){
 const out=[];
 for(const [v,slug] of [['ai','claude'],['ai','claude-code'],['ai','chatgpt'],['ai','gemini-app'],['hardware','rtx-5070'],['games','caves-of-qud'],['studio','ableton-live'],['studio','blender'],['subculture','bleach-tybw-the-calamity']]){
  const {entity}=await entityBySlug(db,v,slug);if(entity)out.push({name:entity.names[l]||entity.names.en,href:channelUrl(l,entity)});
 }
 return out;
}

export async function buildPreview(outDir=path.join(ROOT,'.n2/preview'),now=Date.now()){
 const db=D1Shim.migrated();
 await seedDatabase(db,undefined,now-2*864e5);
 const demo=await insertDemoContent(db,now);
 rmSync(outDir,{recursive:true,force:true});mkdirSync(outDir,{recursive:true});
 /** @type {{url:string,file:string,html:string,title:string}[]} */const pages=[];
 // Every page goes through the Worker's router, exactly as production renders it.
 const paths=[...PREVIEW_PATHS];
 for(const [v,slug] of [['ai','claude'],['games','caves-of-qud']]){
  const {entity}=await entityBySlug(db,v,slug);
  const top=entity?(await db.prepare('SELECT post_no FROM discussions WHERE entity_id=? AND comment_count>0 ORDER BY post_no DESC LIMIT 1').bind(entity.id).first())?.post_no:null;
  if(top)paths.push([`/ko/${v}/${slug}/${top}`,`글 보기 — ${slug}`]);
 }
 for(const [url,title] of paths){
  const res=await renderPlatformPage(new Request(SITE.origin+url),{DB:db},{origin:SITE.origin,now:()=>now});
  if(!res||res.status!==200)throw Error(`preview: ${url} → ${res?.status}`);
  pages.push({url:url.split('?')[0]===url?url:url,file:url.replace(/^\//,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/-+$/,'')+'.html',title,html:await res.text()});
 }
 const files=new Map(pages.map(p=>[p.url,p.file]));
 const banner=`<div style="background:#1d2433;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">미리보기 · 정보(모델·가격·스펙·일정)는 실제 시드 데이터, 게시판 글은 샘플입니다 · Preview: facts are real seed data, board posts are samples · <a href="index.html" style="color:#8fbaff">페이지 목록</a></div>`;
 for(const p of pages){
  const html=p.html.replace(/href="([^"]*)"/g,(m,href)=>{
   if(href===CSS_HREF)return 'href="n2.css"';
   if(href.endsWith('.xml'))return 'href="#"';
   if(!href.startsWith('/'))return m;
   // Pages with a query (a GPU pair, a filtered table) match in full first, then by path.
   const full=href.replace(/&amp;/g,'&').split('#')[0],bare=href.split(/[?#]/)[0];
   return files.has(full)?`href="${files.get(full)}"`:files.has(bare)?`href="${files.get(bare)}"`:'href="#"';
  }).replace(/<script type="module" src="[^"]*"><\/script>\n?/,'').replace(/<body class="n2">/,`<body class="n2">${banner}`);
  writeFileSync(path.join(outDir,p.file),html);
 }
 copyFileSync(path.join(ROOT,'src/platform/n2.css'),path.join(outDir,'n2.css'));
 writeFileSync(path.join(outDir,'index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nerulio 2.0 미리보기</title><link rel="stylesheet" href="n2.css"></head><body class="n2"><div class="w pg"><section class="box"><div class="bh"><h2>Nerulio 2.0 채널 미리보기 — 실제 렌더러 출력</h2></div><ul class="rows">${pages.map(p=>`<li><a class="tt" href="${p.file}">${p.title.replace(/</g,'&lt;')}</a><span class="fine">${p.url}</span></li>`).join('')}</ul><p class="fine pad">모델·가격·스펙·일정·호환 정보는 data/seed의 실제 출처 데이터입니다. 게시판 글·댓글은 레이아웃 확인용 샘플(tools/platform/demo-posts.mjs)입니다.</p></section></div></body></html>`);
 return {pages:pages.map(p=>p.file),demo};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=path.resolve(process.argv[2]||path.join(ROOT,'.n2/preview'));
 const r=await buildPreview(out);
 console.log(`${r.pages.length} pages (${r.demo.posts} sample posts) → ${path.relative(process.cwd(),out)}`);
}
