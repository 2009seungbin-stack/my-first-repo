// @ts-check
/** Post view (/{l}/{vertical}/{slug}/{no}): title and meta, the structured report table when the
 * post carries a report, the body (safe markdown), votes, threaded comments with the best comment
 * on top, then the channel's board around this post. */
import {html,raw} from './html.js';
import {t} from './strings.js';
import {page,nameOf,channelUrl,postUrl,postRow,author,authorText,kindChip,signInUrl} from './ui.js';
import {fullTime,boardTime,compact} from './format.js';
import {postByNo,commentsOf,reportById,channelPosts,channelStats,entitiesByIds,compatibilityOf} from '../db/channel.js';
import {renderMarkdown,plainExcerpt} from '../markdown.js';
import {COMPAT_STATUS_LABEL,label} from '../labels.js';
import {confirmationsNeeded,boardOpen} from '../community.js';
import {dayStart,proposeForm} from './channel.js';
import {typeDef} from '../verticals/index.js';

/** Best comment: most upvotes, at least 5, and ahead of the runner-up. */
export const BEST_COMMENT_MIN=5;

/** @param {any} db @param {import('../db/channel.js').Entity} entity @param {number} no @param {{l:string,now:number,channels?:{name:string,href:string}[]}} o */
export async function loadPost(db,entity,no,o){
 const post=await postByNo(db,entity.id,no);
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
 // The board around this post: the newest page that contains it.
 const around=(await channelPosts(db,entity.id,{limit:12})).posts;
 const stats=await channelStats(db,entity.id,dayStart(o.now,o.l));
 return {entity,post,comments,report,reportNames,compat,around,stats,l:o.l,now:o.now,channels:o.channels||[]};
}

/** @param {NonNullable<Awaited<ReturnType<typeof loadPost>>>} m @param {{origin:string}} site */
export function renderPost(m,site){
 const {entity:e,post:p,l,now}=m,s=t(l);
 const name=nameOf(e,l),base=channelUrl(l,e),url=postUrl(l,e,p.post_no);
 const top=m.comments.filter(c=>!c.deleted).sort((a,b)=>b.up-a.up);
 const accepted=p.solved?m.comments.find(c=>c.id===p.solved&&!c.deleted)||null:null;
 // Pinned above the thread only when there is a thread to skip (3+ comments); with one or two it
 // would show the same comment twice.
 const best=accepted||top.length<3?null:top[0]&&top[0].up>=BEST_COMMENT_MIN&&(!top[1]||top[0].up>top[1].up)?top[0]:null;
 /** @type {Map<string|null,typeof m.comments>} */const kids=new Map();
 for(const c of m.comments){const k=c.parent_id;kids.set(k,[...(kids.get(k)||[]),c]);}
 const comment=(/** @type {(typeof m.comments)[number]} */ c,/** @type {number} */ depth,/** @type {boolean} */ pinned=false)=>html`<li class="co${depth?' re':''}${pinned?' bestc':''}${c.deleted?' del':''}" id="${pinned?'best-':''}c-${c.id}"><div class="h">${depth?'↳ ':''}${pinned&&accepted&&c.id===accepted.id?html`<span class="bb ok">${l==='ko'?'✓ 채택된 답변':'✓ Accepted answer'}</span>`:pinned?html`<span class="bb">${s.bestComment}</span>`:''}${author({author_name:c.author_name,author_tier:c.author_tier,anon_id:c.anon_id},l)}${(c.anon_id?c.anon_id===p.anon_id&&c.author_name===p.author_name:c.author_id===p.author_id)?html`<span class="op">${s.op}</span>`:''}<span class="fine">${boardTime(c.created_at,now,l)}</span></div>
<div class="cb">${c.deleted?s.deletedComment:raw(renderMarkdown(c.body_md))}</div><div class="a"><a href="#c-${c.id}" data-vote-comment="${c.id}">▲ ${c.up}</a>${c.deleted?'':html`<a href="#comment-form" data-reply="${c.id}" data-name="${authorText(c,'')}">${s.reply}</a>`}<a href="/${l}/community/report?target=comment:${c.id}">${s.flag}</a>${!c.deleted&&p.kind==='question'&&!pinned?html`<button class="lnk" type="button" data-accept="${c.id}" hidden>${l==='ko'?'답변 채택':'Accept'}</button>`:''}${c.deleted?'':c.anon_id?html`<button class="lnk" type="button" data-anon-edit="comment:${c.id}" hidden>${l==='ko'?'수정':'Edit'}</button><button class="lnk" type="button" data-anon-delete="comment:${c.id}" hidden>${l==='ko'?'삭제':'Delete'}</button>`:html`<button class="lnk" type="button" data-edit-comment="${c.id}" hidden>${l==='ko'?'수정':'Edit'}</button><button class="lnk" type="button" data-own-comment="${c.id}" hidden>${l==='ko'?'삭제':'Delete'}</button>`}</div></li>`;
 /** @param {string|null} parent @param {number} depth @returns {unknown[]} */
 const thread=(parent,depth)=>(kids.get(parent)||[]).flatMap(c=>[comment(c,Math.min(depth,2)),...thread(c.id,depth+1)]);
 const rep=m.report;
 // 정보 제안 from this post: the post becomes the evidence linked to the proposal.
 const propose=proposeForm(e,l,typeDef(e.vertical,e.type)?.props||[],p.id);
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
 const body=html`<div class="crumb"><a class="chl" href="${base}">${s.channel(name)}</a><span class="fine">${s.followers} ${compact(m.stats.followers,l)}</span><span class="sp"></span><a class="btn" href="${base}">${s.list}</a><a class="btn p" href="${base}write">${s.write}</a></div>
<article class="box post"><header class="ph1"><p class="ph1tags">${kindChip(p.kind,l)}${p.best_at?html`<span class="star">★ ${l==='ko'?'념글':'Best'}</span>`:''}</p><h1>${p.title}</h1>
<div class="meta1">${author(p,l)}<span class="sep">|</span><time datetime="${new Date(p.created_at).toISOString()}">${fullTime(p.created_at,l)}</time>${p.edited_at?html`<span>${s.editedAt(boardTime(p.edited_at,now,l))}</span>`:''}<span class="sep">|</span><span>${s.up} ${p.up}</span><span class="sep">|</span><span>${s.comments} ${p.comments}</span><span class="sep">|</span><span>${s.views} ${compact(p.views,l)}</span></div></header>
${facts}<div class="pbody">${raw(renderMarkdown(p.body_md))}</div>${vstate}
<div class="vote" data-island="post-vote" data-post="${p.id}"${rep?.kind==='compat'?html` data-report="${JSON.stringify({kind:'compat',entityId:rep.entity_id,targetId:rep.target_id,subjectVersion:rep.subject_version||undefined,targetVersion:rep.target_version||undefined,result:rep.result})}"`:''}><button class="up" type="button" disabled><b>${p.up}</b><span>${s.up}</span></button>${rep?.kind==='compat'?html`<button type="button" disabled><b>0</b><span>${s.sameHere}</span></button><button type="button" disabled><b>0</b><span>${s.notRepro}</span></button>`:html`<button type="button" disabled><b>${p.down}</b><span>${s.down}</span></button>`}</div>
<div class="pact">${p.anon_id?html`<span class="own" data-island="anon-own" data-target="discussion:${p.id}" hidden><button class="btn" type="button" data-anon-edit="discussion:${p.id}">${l==='ko'?'수정':'Edit'}</button><button class="btn" type="button" data-anon-delete="discussion:${p.id}">${l==='ko'?'삭제':'Delete'}</button></span>`:''}<span class="own" data-island="own-post" data-post="${p.id}" hidden><button class="btn" type="button" data-edit>${l==='ko'?'수정':'Edit'}</button><button class="btn" type="button" data-delete>${l==='ko'?'삭제':'Delete'}</button></span><button class="btn" type="button" data-island="share">${s.share}</button><a class="btn" href="${url}">${s.copyLink}</a><a class="btn" href="/${l}/community/report?target=discussion:${p.id}">${s.flag}</a></div></article>
${propose?html`<section class="box">${propose}</section>`:''}
<section class="box" id="comments"><div class="cmh">${s.commentsN(m.comments.filter(x=>!x.deleted).length)}<span class="srt"><span>${s.byOrder}</span></span></div>
<ol class="cl">${accepted?comment(accepted,0,true):best?comment(best,0,true):''}${thread(null,0)}</ol>
${boardOpen(e)?html`<form class="cform" id="comment-form" data-island="comment-form" data-post="${p.id}"><input type="hidden" name="parentId" value=""><div class="cfw"><p class="replying" hidden><span></span> <button type="button" class="lnk" data-cancel>${l==='ko'?'취소':'Cancel'}</button></p><textarea name="body" rows="3" maxlength="4000" placeholder="${s.writeComment}" aria-label="${s.writeComment}"></textarea>${anonFields(l,url)}</div><button class="btn p" type="submit">${s.submit}</button></form>`:html`<p class="empty closed">${l==='ko'?'이 채널 게시판은 준비 중이라 댓글을 쓸 수 없어요.':'Comments open when this channel\'s board opens.'}</p>`}</section>
<section class="box"><div class="cmh">${s.channelList(name)}</div><ol class="plist">${m.around.map(x=>postRow(x,{l,now,href:postUrl(l,e,x.post_no),current:x.post_no===p.post_no}))}</ol><div class="pager"><a class="btn" href="${base}">${s.moreList}</a></div></section>`;
 const description=plainExcerpt(p.body_md,150)||p.title;
 // A post exists in the language it was written in: that URL is canonical and the only one indexed.
 const own=site.origin+postUrl(p.locale==='en'?'en':'ko',e,p.post_no);
 return page({l,title:`${p.title} - ${s.channel(name)} | Nerulio`,description,canonical:own,
  alternates:{[p.locale==='en'?'en':'ko']:own},noindex:p.locale!==l,
  channels:m.channels.map(x=>({...x,on:x.href===base})),scope:{name,id:e.id},body,
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

/** Nickname + password for writing without an account (shown by the islands when the reader is signed
 * out and anonymous writing is on), the bot-check notice and the sign-in link. Shared by the comment box
 * and the write page. @param {string} l @param {string} back */
export function anonFields(l,back){
 const ko=l==='ko';
 return html`<div class="anonf" data-anon-fields hidden><div class="anonr"><label class="anonl"><span>${ko?'닉네임':'Nickname'}</span><input name="anonName" maxlength="12" placeholder="ㅇㅇ" autocomplete="nickname" aria-label="${ko?'닉네임 (비우면 ㅇㅇ)':'Nickname (default ㅇㅇ)'}"></label><label class="anonl"><span>${ko?'비밀번호':'Password'}</span><input name="anonPassword" type="password" minlength="4" maxlength="32" autocomplete="new-password" aria-label="${ko?'비밀번호 (수정·삭제용, 4~32자)':'Password (to edit or delete, 4–32)'}"></label></div>
<p class="fine anonn">${ko?'로그인 없이 쓰면 닉네임 옆에 오늘의 ID가 붙어요 (날마다 바뀌고 IP는 보이지 않아요). 비밀번호는 나중에 수정·삭제할 때 필요해요.':'Without an account your nickname shows with today’s ID (it changes daily; your IP is never shown). The password lets you edit or delete later.'} <a href="${signInUrl(back)}" rel="nofollow" data-signin>${ko?'로그인하고 고정닉으로 쓰기 ›':'Sign in instead ›'}</a></p><p class="fine anonw" data-anon-notice hidden></p></div>`;
}
