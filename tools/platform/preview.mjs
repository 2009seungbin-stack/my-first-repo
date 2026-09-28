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
import {loadChannel,renderChannel} from '../../platform/render/channel.js';
import {loadPost,renderPost} from '../../platform/render/post.js';
import {loadFront,renderFront} from '../../platform/render/front.js';
import {channelUrl,postUrl,frontUrl,CSS_HREF} from '../../platform/render/ui.js';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const SHOWCASE=[['ai','claude'],['games','caves-of-qud'],['hardware','rtx-5070'],['studio','ableton-live'],['subculture','bleach-tybw-the-calamity']];
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
 for(const l of ['ko','en']){
  const channels=await channelBar(db,l);
  pages.push({url:frontUrl(l),file:`${l}-community.html`,title:l==='ko'?'커뮤니티 홈':'Community front',html:String(renderFront(await loadFront(db,{l,now,channels}),SITE))});
  for(const [v,slug] of SHOWCASE){
   const {entity}=await entityBySlug(db,v,slug);if(!entity)throw Error(`missing showcase channel ${v}/${slug}`);
   if(l==='en'&&slug!=='claude')continue;
   pages.push({url:channelUrl(l,entity),file:`${l}-${slug}.html`,title:(entity.names[l]||entity.names.en)+(l==='ko'?' 채널':''),html:String(renderChannel(await loadChannel(db,entity,{l,now,channels}),SITE))});
   if(l==='ko'&&(slug==='claude'||slug==='caves-of-qud')){
    const top=(await db.prepare('SELECT post_no FROM discussions WHERE entity_id=? AND comment_count>0 ORDER BY post_no DESC LIMIT 1').bind(entity.id).first())?.post_no;
    if(top){const m=await loadPost(db,entity,Number(top),{l,now,channels});if(m)pages.push({url:postUrl(l,entity,Number(top)),file:`${l}-${slug}-${top}.html`,title:m.post.title,html:String(renderPost(m,SITE))});}
   }
  }
 }
 const files=new Map(pages.map(p=>[p.url,p.file]));
 const banner=`<div style="background:#1d2433;color:#fff;font:600 13px/1.4 system-ui,sans-serif;padding:8px 16px;text-align:center">미리보기 · 정보(모델·가격·스펙·일정)는 실제 시드 데이터, 게시판 글은 샘플입니다 · Preview: facts are real seed data, board posts are samples · <a href="index.html" style="color:#8fbaff">페이지 목록</a></div>`;
 for(const p of pages){
  const html=p.html.replace(/href="([^"]*)"/g,(m,href)=>{
   if(href===CSS_HREF)return 'href="n2.css"';
   if(!href.startsWith('/'))return m;
   const bare=href.split(/[?#]/)[0];
   return files.has(bare)?`href="${files.get(bare)}"`:'href="#"';
  }).replace(/<body class="n2">/,`<body class="n2">${banner}`);
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
