// @ts-check
/** A member's public profile (/{l}/community/u/{nickname}): the nickname, tier and since when, what they
 * wrote under it (posts, comments, upvotes received), the tags they write about, then their posts and
 * comments. Only what the member posted under their nickname: posts and comments written as ㅇㅇ never
 * appear. Not indexed (people's activity pages are for readers, not search results). */
import {html} from './html.js';
import {t} from './strings.js';
import {page,channelUrl,nameOf,profilePath} from './ui.js';
import {boardTime,compact,int} from './format.js';
import {feedCard} from './front.js';
import {profileByName,postsByAuthor,commentsByAuthor,tagsByAuthor,excerptsOf} from '../db/channel.js';
import {TIER_WEIGHT} from '../community.js';
import {postPath} from '../channels.js';

/** @param {any} db @param {string} name @param {{l:string,now:number,tab?:string,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadProfile(db,name,o){
 const p=await profileByName(db,name);
 if(!p)return null;
 const [posts,comments,tags]=await Promise.all([postsByAuthor(db,p.user_id,20),commentsByAuthor(db,p.user_id,20),tagsByAuthor(db,p.user_id,5)]);
 const ex=await excerptsOf(db,posts.map(x=>x.id));
 return {l:o.l,now:o.now,tab:o.tab==='comments'?'comments':'posts',profile:p,posts:posts.map(x=>({...x,excerpt:ex.get(x.id)||''})),comments,tags,channels:o.channels||[]};
}

/** @param {NonNullable<Awaited<ReturnType<typeof loadProfile>>>} m @param {{origin:string}} site */
export function renderProfile(m,site){
 const {l,now,profile:p}=m,ko=l==='ko',s=t(l),base=profilePath(l,p.name);
 const tier=/** @type {Record<string,string>} */(s.tier)[p.tier]||'';
 const since=new Intl.DateTimeFormat(ko?'ko-KR':'en-US',{year:'numeric',month:'long',timeZone:ko?'Asia/Seoul':'UTC'}).format(new Date(p.since));
 const weight=/** @type {Record<string,number>} */(TIER_WEIGHT)[p.tier];
 const tierNote=p.tier==='new'?(ko?'새 계정은 채택된 기여가 쌓이면 기여자 · 신뢰 등급이 자동으로 붙어요.':'Accepted contributions earn the contributor and trusted tiers automatically.')
  :(ko?`등급은 채택된 기여와 정확도로 자동으로 정해져요. 호환 리포트에서 이 사용자의 한 표는 ${weight}표로 셉니다.`:`Tiers follow accepted contributions and accuracy. In compatibility reports this member's vote counts ${weight}×.`);
 const initial=[...p.name][0]||'?';
 const head=html`<section class="box prof" aria-labelledby="prof-h"><div class="pban" aria-hidden="true"></div><div class="pbody2">
<div class="ptop"><span class="pav" aria-hidden="true">${initial}</span><div class="pnm"><h1 id="prof-h">${p.name}</h1><span class="fine">${ko?`${since} 가입`:`Member since ${since}`}</span></div>${tier?html`<span class="ptier">${tier}${ko?' 사용자':''}</span>`:''}</div>
<p class="fine">${tierNote}</p>
<dl class="pstat"><div><dt>${ko?'글':'Posts'}</dt><dd>${int(p.posts,l)}</dd></div><div><dt>${ko?'댓글':'Comments'}</dt><dd>${int(p.comments,l)}</dd></div><div><dt>${ko?'받은 추천':'Upvotes received'}</dt><dd>${int(p.ups,l)}</dd></div></dl>
${m.tags.length?html`<p class="ptags"><span class="fine">${ko?'자주 쓰는 태그':'Writes about'}</span>${m.tags.map(e=>html`<a class="ftag" href="${channelUrl(l,e)}">#${nameOf(e,l)}</a>`)}</p>`:''}</div></section>`;
 const tabs=html`<nav class="feedtabs" aria-label="${ko?'활동':'Activity'}"><a href="${base}"${m.tab==='posts'?html` class="on" aria-current="page"`:''}>${ko?`글 ${p.posts}`:`Posts ${p.posts}`}</a><a href="${base}?tab=comments"${m.tab==='comments'?html` class="on" aria-current="page"`:''}>${ko?`댓글 ${p.comments}`:`Comments ${p.comments}`}</a></nav>`;
 const list=m.tab==='posts'
  ?(m.posts.length?html`<ol class="feed">${m.posts.map(x=>feedCard(x,l,now))}</ol>`:html`<p class="empty box">${ko?'아직 쓴 글이 없어요.':'No posts yet.'}</p>`)
  :(m.comments.length?html`<ol class="feed pcom">${m.comments.map(c=>html`<li><article class="fc"><p class="pcb">${c.excerpt}</p><div class="fm"><a href="${postPath(l,c.channel_id,c.channel_no)}#c-${c.id}">${c.title}</a><time datetime="${new Date(c.created_at).toISOString()}">${boardTime(c.created_at,now,l)}</time><span class="fv">▲ ${compact(c.up,l)}</span></div></article></li>`)}</ol>`:html`<p class="empty box">${ko?'아직 쓴 댓글이 없어요.':'No comments yet.'}</p>`);
 const body=html`<div class="narrow prof-page">${head}${tabs}${list}</div>`;
 return page({l,title:ko?`${p.name} — 프로필 | Nerulio`:`${p.name} — profile | Nerulio`,description:ko?`${p.name}님이 Nerulio에 쓴 글과 댓글`:`Posts and comments by ${p.name} on Nerulio`,
  canonical:site.origin+base+(m.tab==='comments'?'?tab=comments':''),noindex:true,channels:m.channels,body});
}
