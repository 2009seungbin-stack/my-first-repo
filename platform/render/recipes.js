// @ts-check
/** 레시피 모음 (/{l}/community/recipes/ ?sort=new &ch= &page=) — every post that carries a recipe, most tried
 * first — and 이번 주 유행 (/{l}/community/trends/) — the trends picked by hand (platform/render/rail.js TRENDS)
 * with the preset that finishes each, and the recipes tried most in the last 7 days. Both are the home's feed
 * cards in the same page shell (AI 창작 pivot, 2026-10-11). */
import {html} from './html.js';
import {page} from './ui.js';
import {feedCard,SITE_WHAT} from './front.js';
import {loadRail,renderRail,TRENDS,kstDate,presetLabel} from './rail.js';
import {icon,EMPTY_ART} from './icons.js';
import {recipePosts,trendingRecipes,withCards} from '../db/channel.js';
import {CHANNELS,channelById,channelPath,recipesPath,trendsPath,makePath} from '../channels.js';

const DAY=864e5;
export const RECIPES_PAGE_SIZE=20;
const OPEN=CHANNELS.filter(c=>c.inBar&&c.id!=='notice');

/** @param {any} db @param {{l:string,now:number,sort?:string|null,channel?:string|null,page?:number,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadRecipes(db,o){
 const sort=o.sort==='new'?'new':'tries',channel=o.channel&&channelById(o.channel)?o.channel:null,pageNo=Math.max(1,Math.floor(o.page||1));
 const [list,rail]=await Promise.all([recipePosts(db,{sort,channel,page:pageNo,limit:RECIPES_PAGE_SIZE}),loadRail(db,{now:o.now})]);
 return {l:o.l,now:o.now,sort,channel,page:pageNo,more:list.more,posts:await withCards(db,list.posts),rail,channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadRecipes>>} m @param {{origin:string}} site */
export function renderRecipes(m,site){
 const {l,now}=m,ko=l==='ko',lang=ko?'ko':'en',base=recipesPath(l);
 const q=(/** @type {Record<string,string|number|null>} */ p)=>{const u=new URLSearchParams();const all={sort:m.sort==='tries'?null:m.sort,ch:m.channel,page:m.page>1?m.page:null,...p};for(const [k,v] of Object.entries(all))if(v!==null&&v!==undefined&&v!=='')u.set(k,String(v));const x=u.toString();return base+(x?`?${x}`:'');};
 const tabs=html`<nav class="feedtabs" aria-label="${ko?'정렬':'Sort'}"><a href="${q({sort:null,page:null})}"${m.sort==='tries'?html` class="on" aria-current="page"`:''}>${icon('flame',16)}${ko?'많이 해본 순':'Most tried'}</a><a rel="nofollow" href="${q({sort:'new',page:null})}"${m.sort==='new'?html` class="on" aria-current="page"`:''}>${ko?'최신':'Latest'}</a><span class="sp"></span><a class="btn p" href="${makePath(l)}">${icon('pencil',16)}<span>${ko?'다듬고 올리기':'Finish and post'}</span></a></nav>`;
 const chips=html`<nav class="chipsrow" aria-label="${ko?'채널':'Channel'}"><a rel="nofollow" href="${q({ch:null,page:null})}"${!m.channel?html` class="on" aria-current="true"`:''}>${ko?'전체':'All'}</a>${OPEN.map(c=>html`<a rel="nofollow" href="${q({ch:c.id,page:null})}"${m.channel===c.id?html` class="on" aria-current="true"`:''}>${c.names[lang]}</a>`)}</nav>`;
 const feed=m.posts.length?html`<ol class="feed">${m.posts.map(p=>feedCard(p,l,now))}</ol>`:html`<div class="empty box emptyv">${EMPTY_ART}<p>${ko?'아직 레시피가 붙은 글이 없어요. 작업대에서 다듬고 올리면 쓴 단계가 레시피로 같이 올라가요.':'No posts with a recipe yet. Posting from the workbench attaches the steps you used as a recipe.'}</p><p><a class="btn p" href="${makePath(l)}">${ko?'다듬고 올리기':'Finish and post'}</a></p></div>`;
 const pager=m.page>1||m.more?html`<nav class="pager" aria-label="${ko?'페이지':'Pages'}">${m.page>1?html`<a class="btn" rel="nofollow" href="${q({page:m.page-1===1?null:m.page-1})}">‹ ${ko?'이전':'Previous'}</a>`:''}<span class="fine">${m.page}</span>${m.more?html`<a class="btn" rel="nofollow" href="${q({page:m.page+1})}">${ko?'다음':'Next'} ›</a>`:''}</nav>`:'';
 const head=html`<header class="lhead"><span class="tile ch-recipes" aria-hidden="true">${icon('recipe',22)}</span><div><h1>${ko?'레시피 모음':'Recipes'}</h1><p class="desc">${ko?'만든 방법(프롬프트 + 다듬기 단계)이 붙은 글. "내 사진으로 해보기"를 누르면 같은 단계가 내 이미지에 그대로 적용돼요.':'Posts that carry how they were made (prompt + finishing steps). "Try on my image" replays the same steps on yours.'}</p></div></header>`;
 const body=html`<div class="front"><main class="mainc">${head}${tabs}${chips}${feed}${pager}</main><div class="side">${renderRail(m.rail,l)}</div></div>`;
 const filtered=!!(m.channel||m.sort!=='tries'||m.page>1),other=ko?'en':'ko';
 return page({l,title:ko?'레시피 모음 — AI 이미지 다듬기 레시피 | Nerulio':'Recipes — AI image finishing recipes | Nerulio',
  description:ko?'카톡 이모티콘·LINE 스탬프·지브리 프사·배경화면·AI 도트를 만든 프롬프트와 다듬기 단계. 내 이미지에 그대로 해 볼 수 있어요.':'Prompts and finishing steps behind KakaoTalk emoticons, LINE stickers, avatars, wallpapers and AI pixel art — replay them on your own image.',
  canonical:site.origin+(filtered?q({}):base),noindex:filtered,alternates:filtered?{}:{[l]:site.origin+base,[other]:site.origin+recipesPath(other),'x-default':site.origin+recipesPath('en')},
  channels:m.channels,recipesOn:true,body,jsonld:filtered?null:{'@context':'https://schema.org','@type':'CollectionPage',name:ko?'레시피 모음':'Recipes',url:site.origin+base,description:SITE_WHAT[lang].description}});
}

/** @param {any} db @param {{l:string,now:number,channels?:{name:string,href:string,id?:string}[]}} o */
export async function loadTrends(db,o){
 const [week,rail]=await Promise.all([trendingRecipes(db,{since:kstDate(o.now-6*DAY),limit:12}),loadRail(db,{now:o.now})]);
 // A quiet week: the most tried recipes of all time below the trends.
 const fill=week.length<4?(await recipePosts(db,{sort:'tries',limit:8})).posts.filter(p=>!week.some(w=>w.id===p.id)):[];
 return {l:o.l,now:o.now,week:await withCards(db,week),allTime:await withCards(db,fill),rail,channels:o.channels||[]};
}
/** @param {Awaited<ReturnType<typeof loadTrends>>} m @param {{origin:string}} site */
export function renderTrends(m,site){
 const {l,now}=m,ko=l==='ko',lang=ko?'ko':'en',base=trendsPath(l),other=ko?'en':'ko';
 const picked=html`<ol class="trendlist">${TRENDS.map((x,i)=>{const p=presetLabel(x.preset,l);return html`<li id="${x.id}"><span class="rk mono">${i+1}</span><div class="tb"><h2>${x[lang]} <span class="rw">${x.where[lang]}</span></h2><p>${x.desc[lang]}</p><p class="ta"><a class="btn p" href="${makePath(l,{slug:x.preset})}">${ko?`${p.name}로 다듬기`:`Finish as ${p.name}`}</a><a class="btn" href="${channelPath(l,x.channel)}">${channelById(x.channel)?.names[lang]||x.channel} ›</a></p></div></li>`;})}</ol>`;
 const week=m.week.length?html`<h2 class="lsub">${ko?'이번 주 많이 해본 레시피':'Most tried this week'}</h2><ol class="feed">${m.week.map(p=>feedCard(p,l,now))}</ol>`:'';
 const all=m.allTime.length?html`<h2 class="lsub">${ko?'많이 해본 레시피':'Most tried recipes'}</h2><ol class="feed">${m.allTime.map(p=>feedCard(p,l,now))}</ol>`:'';
 const head=html`<header class="lhead"><span class="tile ch-trends" aria-hidden="true">${icon('trend',22)}</span><div><h1>${ko?'이번 주 유행':'Trending this week'}</h1><p class="desc">${ko?'지금 많이 만드는 AI 이미지와, 그걸 규격에 맞게 다듬는 방법.':'What people are making with AI right now, and how to finish it to size.'}</p></div></header>`;
 const body=html`<div class="front"><main class="mainc">${head}${picked}${week}${all}${!week&&!all?html`<p class="fine pad">${ko?'이번 주에 "내 이미지로 해보기"를 누른 레시피가 아직 없어요.':'No recipe was tried this week yet.'} <a href="${recipesPath(l)}">${ko?'레시피 모음':'Recipes'} ›</a></p>`:''}</main><div class="side">${renderRail(m.rail,l)}</div></div>`;
 return page({l,title:ko?'이번 주 유행 — AI 이미지 트렌드와 다듬는 법 | Nerulio':'Trending this week — AI image trends and how to finish them | Nerulio',
  description:ko?`${TRENDS.map(x=>x.ko).join(' · ')} — 요즘 유행하는 AI 이미지와 카톡·LINE·프사·배경화면 규격으로 다듬는 레시피.`:`${TRENDS.map(x=>x.en).join(' · ')} — trending AI images and recipes that finish them to size.`,
  canonical:site.origin+base,alternates:{[l]:site.origin+base,[other]:site.origin+trendsPath(other),'x-default':site.origin+trendsPath('en')},channels:m.channels,trendsOn:true,body});
}
