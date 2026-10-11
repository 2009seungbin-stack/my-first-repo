// @ts-check
/** Post view (/{l}/community/{channel}/{no}, mockup 3 "글"): the channel and the post's tags, 말머리 + "AI 생성",
 * title and meta, the structured report table when the post carries a report, the body (safe markdown) — an
 * AI 창작 post shows its images as a grid with a download (ZIP) instead of inline —, the recipe card (① 만들기:
 * generator and prompt with copy; ② 다듬기: the numbered steps; 레시피만 저장 · 내 이미지로 해보기), votes,
 * share/link/report, 리믹스 N (the posts that remix it), threaded comments with the best comment on top, then
 * the channel's board around this post. Phones get a bottom bar with ↑ and "내 사진으로 해보기". */
import {html,raw} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,postHref,postRow,boardHead,author,authorText,kindChip,aiChip,tagChip,signInUrl,channelName,channelTile} from './ui.js';
import {fullTime,boardTime,compact} from './format.js';
import {postByChannelNo,commentsOf,reportById,boardPosts,entitiesByIds,compatibilityOf,mediaOf,remixesOf,recipePosts} from '../db/channel.js';
import {renderMarkdown,plainExcerpt} from '../markdown.js';
import {COMPAT_STATUS_LABEL,label} from '../labels.js';
import {confirmationsNeeded} from '../community.js';
import {proposeForm} from './channel.js';
import {channelPath,postPath,writePath,makePath,isReadOnly} from '../channels.js';
import {summarize,GENERATOR_NAMES} from '../recipe.js';
export {GENERATOR_NAMES};
import {typeDef} from '../verticals/index.js';
import {loadRail,renderRail} from './rail.js';
import {icon,identicon} from './icons.js';

/** The writer's initial in a circle (the Radar bot: ⚙; ㅇㅇ: ㅇ). @param {{author_name:string|null,bot?:boolean,anon_id?:string|null}} a */
const avatar=a=>a.bot?html`<span class="av bot" aria-hidden="true">${icon('gear',16)}</span>`:html`<span class="av" aria-hidden="true">${identicon(a.anon_id?`${a.author_name||'ㅇㅇ'}#${a.anon_id}`:a.author_name||'?',30)}</span>`;

/** Best comment: most upvotes, at least 5, and ahead of the runner-up. */
export const BEST_COMMENT_MIN=5;
/** The comment search box shows on posts with at least this many comments. */
export const COMMENT_SEARCH_MIN=30;

/** @param {any} db @param {string} channel @param {number} no @param {{l:string,now:number,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadPost(db,channel,no,o){
 const post=await postByChannelNo(db,channel,no);
 if(!post)return null;
 const comments=await commentsOf(db,post.id);
 const report=post.report_id?await reportById(db,post.report_id):null;
 let reportNames=new Map(),compat=null;
 if(report){
  reportNames=await entitiesByIds(db,[report.entity_id,report.target_id].filter(Boolean));
  if(report.kind==='compat'&&report.target_id){
   const rows=await compatibilityOf(db,{target:report.target_id});
   compat=rows.find(r=>r.subject_id===report.entity_id&&r.target_version===(report.target_version||'*')&&r.subject_version===(report.subject_version||'*'))||null;
  }
 }
 // The board around this post (the newest page of its channel), its images, remixes, the post it remixes and
 // recipes like it — independent reads, run together.
 const p=/** @type {any} */(post);
 const [around,rail,media,remixes,parent,similar]=await Promise.all([boardPosts(db,{channel,limit:12}).then(r=>r.posts),loadRail(db,{now:o.now}),
  post.has_image?mediaOf(db,[post.id]).then(x=>x.get(post.id)||null):Promise.resolve(null),
  p.has_recipe||p.remixes?remixesOf(db,post.id,12):Promise.resolve([]),
  p.remix_of?db.prepare("SELECT channel_id,channel_no,title FROM discussions WHERE id=? AND status IN ('published','locked')").bind(p.remix_of).first():Promise.resolve(null),
  p.has_recipe?recipePosts(db,{sort:'tries',channel,limit:5}).then(r=>r.posts.filter(x=>x.id!==post.id).slice(0,4)):Promise.resolve([])]);
 const rm=remixes.length?await mediaOf(db,remixes.filter(x=>x.has_image).map(x=>x.id)):new Map();
 return {channel,entity:post.tags[0]||null,post,comments,report,reportNames,compat,around,rail,media,
  remixes:remixes.map(x=>({...x,media:rm.get(x.id)||null})),parent:parent?{channel:String(parent.channel_id),no:Number(parent.channel_no),title:String(parent.title)}:null,similar,l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {NonNullable<Awaited<ReturnType<typeof loadPost>>>} m @param {{origin:string}} site */
export function renderPost(m,site){
 const {entity:e,post:p,l,now}=m,s=t(l);
 const name=channelName(m.channel,l),base=channelPath(l,m.channel),url=postHref(l,p);
 const top=m.comments.filter(c=>!c.deleted).sort((a,b)=>b.up-a.up);
 const accepted=p.solved?m.comments.find(c=>c.id===p.solved&&!c.deleted)||null:null;
 // Pinned above the thread only when there is a thread to skip (3+ comments); with one or two it
 // would show the same comment twice.
 const best=accepted||top.length<3?null:top[0]&&top[0].up>=BEST_COMMENT_MIN&&(!top[1]||top[0].up>top[1].up)?top[0]:null;
 /** @type {Map<string|null,typeof m.comments>} */const kids=new Map();
 for(const c of m.comments){const k=c.parent_id;kids.set(k,[...(kids.get(k)||[]),c]);}
 const ko=l==='ko';
 /** @param {(typeof m.comments)[number]} c */
 const isOp=c=>c.anon_id?c.anon_id===p.anon_id&&c.author_name===p.author_name:c.author_id===p.author_id;
 /** Replies under a comment, all levels (the "답글 N개" count). @param {string} id @returns {number} */
 const under=id=>(kids.get(id)||[]).reduce((n,x)=>n+1+under(x.id),0);
 // The ⋯ menu: report, and (shown by the islands to whoever may use them) accept, edit and delete.
 const menu=(/** @type {(typeof m.comments)[number]} */ c,/** @type {boolean} */ pinned)=>html`<details class="cmore"><summary aria-label="${ko?'더보기':'More'}">${icon('dots',18)}</summary><div class="cmenu"><a href="/${l}/community/report?target=comment:${c.id}">${icon('flag',15)}${s.flag}</a>${!c.deleted&&p.kind==='question'&&!pinned?html`<button class="lnk" type="button" data-accept="${c.id}" hidden>${icon('check',15)}${ko?'답변 채택':'Accept'}</button>`:''}${c.deleted?'':c.anon_id?html`<button class="lnk" type="button" data-anon-edit="comment:${c.id}" hidden>${icon('pencil',15)}${ko?'수정':'Edit'}</button><button class="lnk" type="button" data-anon-delete="comment:${c.id}" hidden>${icon('xCircle',15)}${ko?'삭제':'Delete'}</button>`:html`<button class="lnk" type="button" data-edit-comment="${c.id}" hidden>${icon('pencil',15)}${ko?'수정':'Edit'}</button><button class="lnk" type="button" data-own-comment="${c.id}" hidden>${icon('xCircle',15)}${ko?'삭제':'Delete'}</button>`}</div></details>`;
 // Reddit-style thread: the avatar and the header on one line, the body and the actions indented under
 // the name, replies nested inside their parent (three levels; deeper replies continue on the third) with
 // a thread line from the parent's avatar down to each reply.
 const MAXD=3;
 const comment=(/** @type {(typeof m.comments)[number]} */ c,/** @type {number} */ depth,/** @type {boolean} */ pinned=false)=>{
  const nested=!pinned&&depth<MAXD-1?thread(c.id,depth+1):[];
  const score=c.up-c.down;
  return html`<li class="co${depth?' re':''}${pinned?' bestc':''}${c.deleted?' del':''}${nested.length?' hk':''}" id="${pinned?'best-':''}c-${c.id}" data-score="${score}" data-t="${c.created_at}"${pinned?'':html` data-replies="${under(c.id)}"`}><div class="h">${avatar(c)}${pinned&&accepted&&c.id===accepted.id?html`<span class="bb ok">${ko?'✓ 채택된 답변':'✓ Accepted answer'}</span>`:pinned?html`<span class="bb">${s.bestComment}</span>`:''}${author({author_name:c.author_name,author_tier:c.author_tier,anon_id:c.anon_id},l)}${isOp(c)?html`<span class="op">${s.op}</span>`:''}<span class="dot" aria-hidden="true">•</span><time class="fine" datetime="${new Date(c.created_at).toISOString()}">${boardTime(c.created_at,now,l)}</time></div>
<div class="cbody"><div class="cb">${c.deleted?s.deletedComment:raw(renderMarkdown(c.body_md))}</div><div class="a"><span class="cvote"><a class="cv" href="#c-${c.id}" data-vote-comment="${c.id}" data-value="1" aria-label="${s.up}">${icon('up',16)}</a><b>${score}</b><a class="cv dn" href="#c-${c.id}" data-vote-comment="${c.id}" data-value="-1" aria-label="${s.down}">${icon('down',16)}</a></span>${c.deleted?'':html`<a class="ca" href="#comment-form" data-reply="${c.id}" data-name="${authorText(c,'')}">${icon('bubble',16)}<span>${ko?'답글 달기':'Reply'}</span></a>`}<a class="ca" href="${url}#c-${c.id}" data-share-comment>${icon('share',16)}<span>${s.share}</span></a>${menu(c,pinned)}</div></div>${nested.length?html`<ol class="kids">${nested}</ol>`:''}</li>`;
 };
 /** @param {string|null} parent @param {number} depth @returns {unknown[]} */
 const thread=(parent,depth)=>(kids.get(parent)||[]).flatMap(c=>[comment(c,Math.min(depth,MAXD-1)),...(depth>=MAXD-1?thread(c.id,depth+1):[])]);
 const nComments=m.comments.filter(x=>!x.deleted).length;
 // Sorting and search run in the browser (islands); the server order is oldest first.
 const sortBar=html`<div class="csort"><label class="csel" hidden data-comment-sort><span>${ko?'정렬 기준:':'Sort by:'}</span><select aria-label="${ko?'댓글 정렬':'Sort comments'}"><option value="old">${s.byOrder}</option><option value="top">${s.byTop}</option><option value="new">${s.byNew}</option></select>${icon('chevDown',16)}</label>${nComments>=COMMENT_SEARCH_MIN?html`<label class="csearch" hidden data-comment-search>${icon('search',16)}<input type="search" placeholder="${ko?'댓글 검색':'Search comments'}" aria-label="${ko?'댓글 검색':'Search comments'}"></label>`:''}</div>`;
 const rep=m.report;
 // 정보 제안 from this post: the post becomes the evidence linked to the proposal.
 const propose=e?proposeForm(e,l,typeDef(e.vertical,e.type)?.props||[],p.id):'';
 const nm=(/** @type {string|null|undefined} */ id)=>{const x=id?m.reportNames.get(id):null;return x?html`<a href="${channelUrl(l,x)}">${nameOf(x,l)}</a>`:id||'';};
 const RESULT=/** @type {Record<string,string>} */({works:'c',works_with_issues:'u',broken:'d'});
 const envText=rep?Object.entries(rep.env||{}).map(([,v])=>String(v)).join(' · '):'';
 const facts=rep?html`<table class="facts"><tbody>
<tr><th>${s.report.target}</th><td>${nm(rep.entity_id)}${rep.subject_version?` ${rep.subject_version}`:''}${rep.target_id?html` → ${nm(rep.target_id)}`:''}</td></tr>
${rep.target_version?html`<tr><th>${s.report.version}</th><td>${rep.target_version}</td></tr>`:''}
${rep.result?html`<tr><th>${s.report.result}</th><td><span class="st ${RESULT[rep.result]||'u'}">${label(/** @type {any} */(COMPAT_STATUS_LABEL)[rep.result],l)}</span></td></tr>`:''}
${envText?html`<tr><th>${s.report.env}</th><td>${envText}</td></tr>`:''}
${Object.keys(rep.metrics||{}).length?html`<tr><th>${s.report.metrics}</th><td>${Object.entries(rep.metrics).map(([k,v])=>`${k.replace(/_/g,' ')} ${v}`).join(' · ')}</td></tr>`:''}
</tbody></table>`:'';
 const c=m.compat;
 const vstate=c?html`<p class="vstate"><b>${l==='ko'?'이 조합 상태':'This combination'}</b> <span class="st ${c.verification==='COMMUNITY_VERIFIED'?'c':c.verification==='DISPUTED'?'d':'u'}">${label(/** @type {any} */(COMPAT_STATUS_LABEL)[c.status],l)}</span> — ${l==='ko'?`확인 ${c.confirmations}명 · 반대 ${c.contradictions}명`:`${c.confirmations} confirm · ${c.contradictions} disagree`}${confirmationsNeeded({users:c.confirmations+c.contradictions,verification:c.verification})?html`. ${s.needMore(confirmationsNeeded({users:c.confirmations+c.contradictions,verification:c.verification}))}`:''}</p>`:'';
 const ro=isReadOnly(m.channel),x=/** @type {any} */(p),recipe=x.recipe||null;
 // An AI 창작 post (a recipe, a prompt, the AI flag or a remix) shows its images as a grid, not inline.
 const gallery=!!(m.media?.images.length&&(recipe||x.ai||x.prompt||x.remix_of));
 const md=gallery?p.body_md.replace(/^[ \t]*!\[[^\]\n]*\]\(\/u\/[^)\s]+\)[ \t]*$/gm,'').replace(/\n{3,}/g,'\n\n').trim():p.body_md;
 const writeBtn=ro?'':m.channel==='howto'||m.channel==='free'||m.channel==='notice'?html`<a class="btn p" href="${writePath(l,m.channel,{tag:e?.id||null})}">${icon('pencil',16)}${s.write}</a>`:html`<a class="btn p" href="${makePath(l)}">${icon('pencil',16)}${ko?'다듬고 올리기':'Finish and post'}</a>`;
 const body=html`<div class="crumb">${channelTile(m.channel,l)}<a class="chl" href="${base}">${s.channel(name)}</a>${p.tags.length?html`<span class="rtags">${p.tags.map(x=>tagChip(x,l))}</span>`:''}<span class="sp"></span><a class="btn" href="${base}">${s.list}</a>${writeBtn}</div>
<article class="box post"><header class="ph1"><p class="ph1tags">${kindChip(p.kind,l,m.channel)}${x.ai?aiChip(l):''}${p.best_at?html`<span class="star">${icon('starFill',14)} ${l==='ko'?'념글':'Best'}</span>`:''}</p><h1>${p.title}</h1>
<div class="meta1">${avatar(p)}${author(p,l)}<span class="sep">|</span><time datetime="${new Date(p.created_at).toISOString()}">${fullTime(p.created_at,l)}</time>${p.edited_at?html`<span>${s.editedAt(boardTime(p.edited_at,now,l))}</span>`:''}<span class="sep">|</span><span>${s.up} ${p.up}</span><span class="sep">|</span><span>${s.comments} ${p.comments}</span><span class="sep">|</span><span>${s.views} ${compact(p.views,l)}</span></div>
${m.parent?html`<p class="remixof">${icon('remix',15)}<span>${ko?'리믹스 원본':'Remix of'}</span> <a href="${postPath(l,m.parent.channel,m.parent.no)}">${m.parent.title}</a></p>`:''}</header>
${facts}${md?html`<div class="pbody">${raw(renderMarkdown(md))}</div>`:''}${gallery?imageGrid(/** @type {any} */(m.media),l,p):''}${vstate}
${recipe||x.prompt||x.generator?recipeCard(p,l):''}
<div class="vote" data-island="post-vote" data-post="${p.id}"${rep?.kind==='compat'?html` data-report="${JSON.stringify({kind:'compat',entityId:rep.entity_id,targetId:rep.target_id,subjectVersion:rep.subject_version||undefined,targetVersion:rep.target_version||undefined,result:rep.result})}"`:''}><button class="up" type="button" disabled>${icon('up',18)}<b>${p.up}</b><span>${s.up}</span></button>${rep?.kind==='compat'?html`<button type="button" disabled><b>0</b><span>${s.sameHere}</span></button><button type="button" disabled><b>0</b><span>${s.notRepro}</span></button>`:html`<button type="button" disabled>${icon('down',18)}<b>${p.down}</b><span>${s.down}</span></button>`}</div>
<div class="pact">${p.anon_id?html`<span class="own" data-island="anon-own" data-target="discussion:${p.id}" hidden><button class="btn" type="button" data-anon-edit="discussion:${p.id}">${l==='ko'?'수정':'Edit'}</button><button class="btn" type="button" data-anon-delete="discussion:${p.id}">${l==='ko'?'삭제':'Delete'}</button></span>`:''}<span class="own" data-island="own-post" data-post="${p.id}" hidden><button class="btn" type="button" data-edit>${l==='ko'?'수정':'Edit'}</button><button class="btn" type="button" data-delete>${l==='ko'?'삭제':'Delete'}</button></span><button class="btn" type="button" data-island="share">${icon('share',16)}<span>${s.share}</span></button><a class="btn" href="${url}">${icon('link',16)}<span>${s.copyLink}</span></a><a class="btn" href="/${l}/community/report?target=discussion:${p.id}">${icon('flag',16)}<span>${s.flag}</span></a></div></article>
${recipe||m.remixes.length?remixSection(m,l):''}
${propose?html`<section class="box">${propose}</section>`:''}
<section class="box" id="comments"><h2 class="cmh">${s.commentsN(nComments)}</h2>
<form class="cform" id="comment-form" data-island="comment-form" data-post="${p.id}"><input type="hidden" name="parentId" value=""><div class="cfw"><p class="replying" hidden><span></span> <button type="button" class="lnk" data-cancel>${l==='ko'?'취소':'Cancel'}</button></p><textarea name="body" rows="3" maxlength="4000" placeholder="${s.writeComment}" aria-label="${s.writeComment}"></textarea>${anonFields(l,url)}</div><button class="btn p" type="submit">${s.submit}</button></form>
${nComments?sortBar:''}<ol class="cl">${accepted?comment(accepted,0,true):best?comment(best,0,true):''}${thread(null,0)}</ol></section>
<section class="box"><div class="cmh">${s.channelList(name)}</div><ol class="plist">${boardHead(l)}${m.around.map(x=>postRow(x,{l,now,current:x.id===p.id}))}</ol><div class="pager"><a class="btn" href="${base}">${s.moreList}</a></div></section>
${recipe?html`<div class="mbar"><span class="mup" data-mbar-up>${icon('up',16)}<b>${p.up}</b></span><a class="btn p" href="${makePath(l,{recipe:p.id})}" rel="nofollow">${ko?'내 사진으로 해보기':'Try on my image'}</a></div>`:''}`;
 const wrapped=html`<div class="front postv${recipe?' hasbar':''}"><div class="mainc">${body}</div><div class="side">${renderRail(m.rail,l,recipe?recipeRail(m,l):'')}</div></div>`;
 const description=plainExcerpt(p.body_md,150)||p.title;
 // A post exists in the language it was written in: that URL is canonical and the only one indexed.
 const own=site.origin+postPath(p.locale==='en'?'en':'ko',m.channel,p.channel_no);
 return page({l,title:`${p.title} - ${s.channel(name)} | Nerulio`,description,canonical:own,ogImage:m.media?.after?{url:m.media.after.url,alt:p.title}:null,
  alternates:{[p.locale==='en'?'en':'ko']:own},noindex:p.locale!==l,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:e?{name:nameOf(e,l),id:e.id}:null,body:wrapped,
  jsonld:postJsonLd(m,site.origin+url,s)});
}

/** Question posts are QAPage (accepted/suggested answers); everything else DiscussionForumPosting
 * with its first comments, as Google's forum and Q&A rich results expect. @param {any} m @param {string} url @param {any} s */
function postJsonLd(m,url,s){
 const p=m.post,person=(/** @type {string|null} */ n,/** @type {boolean} */ bot)=>({'@type':'Person',name:bot?s.bot:n||s.anonymous});
 const who=(/** @type {any} */ x)=>authorText(x,s.anonymous);
 const text=plainExcerpt(p.body_md,500)||p.title;
 const comments=m.comments.filter((/** @type {any} */ c)=>!c.deleted);
 const asComment=(/** @type {any} */ c)=>({'@type':p.kind==='question'?'Answer':'Comment',text:plainExcerpt(c.body_md,500),datePublished:new Date(c.created_at).toISOString(),author:person(who(c),false),upvoteCount:c.up,url:`${url}#c-${c.id}`});
 // A question is a QAPage once it has an answer; before that it is a forum post like any other.
 if(p.kind==='question'&&comments.length){
  const acc=p.solved?comments.find((/** @type {any} */ c)=>c.id===p.solved):null;
  return {'@context':'https://schema.org','@type':'QAPage',mainEntity:{'@type':'Question',name:p.title,text,dateCreated:new Date(p.created_at).toISOString(),author:person(who(p),p.bot),answerCount:comments.length,upvoteCount:p.up,
   ...(acc?{acceptedAnswer:asComment(acc)}:{}),suggestedAnswer:comments.filter((/** @type {any} */ c)=>!acc||c.id!==acc.id).slice(0,10).map(asComment)}};
 }
 return {'@context':'https://schema.org','@type':'DiscussionForumPosting',headline:p.title,text,url,datePublished:new Date(p.created_at).toISOString(),author:person(who(p),p.bot),commentCount:p.comments,
  interactionStatistic:{'@type':'InteractionCounter',interactionType:'https://schema.org/LikeAction',userInteractionCount:p.up},comment:comments.slice(0,10).map(asComment)};
}

/** Steps that run an AI model in the browser (marked "AI 모델" on the recipe card). */
const MODEL_OPS=new Set(['bg.remove','upscale']);
const EXT_NAME=/** @type {Record<string,string>} */({webp:'WebP',png:'PNG',jpg:'JPEG'});
/** The result images of an AI 창작 post as a grid (원본 first, labelled), with their size, format and count, and a
 * download: one image directly, several as a ZIP built in the browser (islands, data-island="zip").
 * @param {{images:{id:string,url:string,w:number,h:number,source:boolean}[]}} media @param {string} l @param {{id:string,title:string}} p */
function imageGrid(media,l,p){
 const ko=l==='ko',results=media.images.filter(i=>!i.source),src=media.images.find(i=>i.source);
 const first=results[0]||src,ext=first?first.url.split('.').pop()||'':'';
 const same=results.length>0&&results.every(i=>i.w===results[0].w&&i.h===results[0].h);
 const meta=[same&&first?.w?`${first.w}×${first.h}`:'',EXT_NAME[ext]||'',results.length>1?(ko?`${results.length}개`:`${results.length} images`):''].filter(Boolean).join(' · ');
 const cols=results.length>=6?6:results.length>=3?3:results.length||1;
 const dl=results.length>1?html`<button type="button" class="btn" data-island="zip" data-name="${`nerulio-${p.id}`}" data-urls="${JSON.stringify(results.map(i=>i.url))}">${icon('download',16)}${ko?'ZIP 받기':'Download ZIP'}</button>`:first?html`<a class="btn" href="${first.url}" download>${icon('download',16)}${ko?'이미지 받기':'Download'}</a>`:'';
 return html`${src?html`<figure class="rsrc"><img src="${src.url}" alt="${ko?'원본 이미지':'Source image'}" loading="lazy" decoding="async"${src.w?html` width="${src.w}" height="${src.h}"`:''}><figcaption>${ko?'원본':'Before'}</figcaption></figure>`:''}${results.length?html`<div class="rgrid chk c${cols}">${results.map((i,k)=>html`<a href="${i.url}" class="rgi"><img src="${i.url}" alt="${ko?`결과 ${k+1}`:`Result ${k+1}`}" loading="lazy" decoding="async"${i.w?html` width="${i.w}" height="${i.h}"`:''}></a>`)}</div>`:''}
<div class="rmeta"><span class="mono">${meta}</span><span class="sp"></span>${dl}</div>`;
}
/** The recipe card (mockup 3): ① 만들기 — the generator (an outside service) and the prompt with a copy button;
 * ② 다듬기 — the numbered steps (platform/recipe.js summarize), replayed in the workbench; 레시피만 저장 (the
 * recipe JSON) and the lime 내 이미지로 해보기. A post with a prompt but no recipe shows ① only.
 * @param {any} p @param {string} l */
export function recipeCard(p,l){
 const ko=l==='ko',lang=ko?'ko':'en',r=p.recipe||null;
 let steps=/** @type {{op:string,name:string,detail:string}[]} */([]),preset='';
 if(r){try{const x=summarize(r,l);steps=x.steps||[];preset=x.preset||'';}catch{}}
 const gen=p.generator||r?.source?.generator||null,prompt=p.prompt||r?.source?.prompt||null;
 const genName=gen?(GENERATOR_NAMES[gen]?.[lang]||gen):(ko?'AI 서비스':'An AI service');
 return html`<section class="rcard" id="recipe" aria-labelledby="rc-h"><div class="rch"><h2 id="rc-h">${ko?'레시피':'Recipe'}</h2>${r?html`<span class="fine">${ko?`해보기 ${p.tries} · 리믹스 ${p.remixes}`:`${p.tries} tries · ${p.remixes} remixes`}</span>`:''}<span class="sp"></span>${r?html`<a class="btn" href="/api/v2/recipes/${p.id}" download="${`nerulio-recipe-${p.id}.json`}" rel="nofollow">${icon('download',15)}${ko?'레시피만 저장':'Save recipe'}</a><a class="btn p" href="${makePath(l,{recipe:p.id})}" rel="nofollow">${ko?'내 이미지로 해보기':'Try on my image'}</a>`:''}</div>
<div class="rcb"><div class="rst"><div class="rsh"><b>${ko?'① 만들기':'① Make'}</b><span class="fine">${genName} · ${ko?'이 단계는 외부 서비스에서 해요':'this step happens in that service'}</span></div>
${prompt?html`<div class="rprompt"><p class="mono" id="prompt-${p.id}">${prompt}</p><button type="button" class="btn sm" data-copy="#prompt-${p.id}">${icon('copy',14)}${ko?'복사':'Copy'}</button></div>`:html`<p class="fine">${ko?'프롬프트는 적지 않았어요.':'No prompt was given.'}</p>`}</div>
${steps.length?html`<div class="rst"><div class="rsh"><b>${ko?'② 다듬기':'② Finish'}</b><span class="fine">${ko?`Nerulio에서 자동 재생 · ${steps.length}단계`:`replayed in Nerulio · ${steps.length} steps`}${preset?` · ${preset}`:''}</span></div>
<ol class="rsteps">${steps.map((x,i)=>html`<li><span class="rn mono">${i+1}</span><b>${x.name}</b><span class="rd">${x.detail}</span>${MODEL_OPS.has(x.op)?html`<span class="mh inf">${ko?'AI 모델':'AI model'}</span>`:''}</li>`)}</ol></div>`:''}</div></section>`;
}
/** 리믹스 N: the posts made with this recipe, as a grid of thumbnails, and the lime 리믹스로 올리기. @param {any} m @param {string} l */
function remixSection(m,l){
 const ko=l==='ko',p=m.post;
 return html`<section class="box remixes" id="remixes" aria-labelledby="rx-h"><div class="rxh"><h2 id="rx-h">${ko?`리믹스 ${m.remixes.length}`:`Remixes ${m.remixes.length}`}</h2><span class="fine">${ko?'이 레시피로 다른 사람들이 만든 것':'Made by others with this recipe'}</span><span class="sp"></span>${p.recipe?html`<a class="btn p" href="${makePath(l,{recipe:p.id})}" rel="nofollow">${ko?'리믹스로 올리기':'Post a remix'}</a>`:''}</div>
${m.remixes.length?html`<ul class="rxgrid">${m.remixes.map((/** @type {any} */ x)=>{const img=x.media?.after||x.media?.before;return html`<li><a href="${postHref(l,x)}"><span class="rxi chk">${img?html`<img src="${img.url}" alt="" loading="lazy" decoding="async">`:icon('remix',22)}</span><b>${authorText(x,ko?'탈퇴한 사용자':'Former member')}</b><span class="fine">${x.title}</span></a></li>`;})}</ul>`:html`<p class="fine">${ko?'아직 리믹스가 없어요. 내 이미지로 해보고 첫 리믹스를 올려 보세요.':'No remixes yet. Try it on your image and post the first one.'}</p>`}</section>`;
}
/** The post's own right-column sections: 이 레시피에 쓴 도구 (each step, and the preset's landing) and 비슷한 레시피.
 * @param {any} m @param {string} l */
function recipeRail(m,l){
 const ko=l==='ko',p=m.post;
 let steps=/** @type {{op:string,name:string}[]} */([]);try{steps=summarize(p.recipe,l).steps||[];}catch{}
 const seen=new Set(),uniq=steps.filter(x=>seen.has(x.op)?false:(seen.add(x.op),true));
 return html`<section class="rbox" aria-labelledby="rail-used"><div class="rbh"><h2 id="rail-used">${ko?'이 레시피에 쓴 도구':'Tools in this recipe'}</h2></div><ul class="rused">${uniq.map(x=>html`<li><a href="${makePath(l,{recipe:p.id})}" rel="nofollow">${x.name} ›</a></li>`)}</ul></section>
${m.similar.length?html`<section class="rbox" aria-labelledby="rail-sim"><div class="rbh"><h2 id="rail-sim">${ko?'비슷한 레시피':'Similar recipes'}</h2></div><ul class="rsim">${m.similar.map((/** @type {any} */ x)=>html`<li><a href="${postHref(l,x)}">${x.title}</a></li>`)}</ul></section>`:''}`;
}

/** Nickname + password for writing without an account (shown by the islands when the reader is signed
 * out and anonymous writing is on), the bot-check notice and the sign-in link. Shared by the comment box
 * and the write page. @param {string} l @param {string} back */
export function anonFields(l,back){
 const ko=l==='ko';
 return html`<div class="anonf" data-anon-fields hidden><div class="anonr"><label class="anonl"><span>${ko?'닉네임':'Nickname'}</span><input name="anonName" maxlength="12" placeholder="ㅇㅇ" autocomplete="nickname" aria-label="${ko?'닉네임 (비우면 ㅇㅇ)':'Nickname (default ㅇㅇ)'}"></label><label class="anonl"><span>${ko?'비밀번호':'Password'}</span><input name="anonPassword" type="password" minlength="4" maxlength="32" autocomplete="new-password" aria-label="${ko?'비밀번호 (수정·삭제용, 4~32자)':'Password (to edit or delete, 4–32)'}"></label></div>
<p class="fine anonn">${ko?'로그인 없이 쓰면 닉네임 옆에 오늘의 ID가 붙어요 (날마다 바뀌고 IP는 보이지 않아요). 비밀번호는 나중에 수정·삭제할 때 필요해요.':'Without an account your nickname shows with today’s ID (it changes daily; your IP is never shown). The password lets you edit or delete later.'} <a href="${signInUrl(back)}" rel="nofollow" data-signin>${ko?'로그인하고 고정닉으로 쓰기 ›':'Sign in instead ›'}</a></p><p class="fine anonw" data-anon-notice hidden></p></div>`;
}
