// @ts-check
/** Channel board (/{l}/community/{ch}/, docs/n2/CHANNELS.md, mockup 2 "게시판"): the channel head (an archived
 * channel says so and offers no write button), 말머리 tabs, the 규격 row of the board's presets, popular tag
 * chips (a tag includes its parts: Claude → Claude Code, its plans and models), the sort bar with ★ 념글,
 * one 공지 row with the rest folded, the Radar bot's 소식 folded into one row, then the posts. The 게임
 * channel adds platform and genre filters from the games' own facts. Works without JavaScript. */
import {html} from './html.js';
import {t} from './strings.js';
import {page,box,nameOf,channelUrl,postHref,postRow,boardHead,kindChip,channelTile,signInUrl} from './ui.js';
import {compact,PLATFORM_NAMES} from './format.js';
import {BOT_FOLD_MS,boardPosts,noticesOf,botNews,channelCounts,popularTags,entitiesByIds,frontPosts,tagChildren,typeCounts,factValues,SORTS,mediaOf} from '../db/channel.js';
import {channelBestThreshold,BEST_RULE} from '../community.js';
import {channelById,channelPath,writePath,flairLabel,FEATURED_TAGS,patchCollectionPath,makePath,recipesPath} from '../channels.js';
import {presetLabel} from './rail.js';
import {icon} from './icons.js';
import {typeDef,verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';
import {hardwareToolLinks} from './hardware-tools.js';
import {dayStart} from './channel.js';

export const BOARD_PAGE_SIZE=30;
const DAY=864e5;
/** Steam's genre names in Korean (the 게임 channel's genre filter). */
const GENRE_KO=/** @type {Record<string,string>} */({Action:'액션',Adventure:'어드벤처',Indie:'인디',RPG:'RPG',Simulation:'시뮬레이션',Strategy:'전략',Casual:'캐주얼',Sports:'스포츠',Racing:'레이싱','Massively Multiplayer':'MMO','Early Access':'앞서 해보기','Free To Play':'무료','Free to Play':'무료'});
/** @param {string} v @param {string} l */
export const genreLabel=(v,l)=>l==='ko'?GENRE_KO[v]||v:v;

/**
 * @param {any} db
 * @param {{l:string,now:number,channel:string,kind?:string|null,tag?:string|null,sort?:string,best?:boolean,bestPage?:boolean,page?:number,platform?:string|null,genre?:string|null,channels?:{name:string,href:string,id?:string,on?:boolean}[]}} o
 */
export async function loadBoard(db,o){
 const ch=/** @type {import('../channels.js').Channel} */(channelById(o.channel));
 const kind=o.kind&&ch.flairs.includes(o.kind)||o.kind==='notice'?o.kind:null,sort=SORTS.includes(/** @type {any} */(o.sort))?/** @type {string} */(o.sort):'new';
 const page=Math.max(1,Math.floor(o.page||1)),best=!!(o.best||o.bestPage);
 const facet=ch.id==='games'&&o.platform?{property:'platforms',value:o.platform}:ch.id==='games'&&o.genre?{property:'genres',value:o.genre}:null;
 const fold=!kind&&!o.tag&&!best&&!facet;
 const tagEntity=o.tag?(await entitiesByIds(db,[o.tag])).get(o.tag)||null:null;
 const [board,notices,bots,counts,popular,bestMin,bestList,children,types,platforms,genres]=await Promise.all([
  boardPosts(db,{channel:ch.id,tag:tagEntity?.id||null,kind,sort,best,page,limit:BOARD_PAGE_SIZE,now:o.now,fold,facet}),
  fold&&page===1?noticesOf(db,ch.id,5):Promise.resolve([]),
  fold&&page===1?botNews(db,ch.id,o.now-BOT_FOLD_MS):Promise.resolve({count:0,title:null}),
  channelCounts(db,ch.id,dayStart(o.now,o.l)),
  popularTags(db,{channel:ch.id,since:o.now-30*DAY,limit:12}),
  channelBestThreshold(db,ch.id,o.now),
  frontPosts(db,{mode:'best',channel:ch.id,since:o.now-7*DAY,limit:5}),
  tagEntity?tagChildren(db,tagEntity.id,12):Promise.resolve([]),
  ch.vertical?typeCounts(db,ch.vertical):Promise.resolve({}),
  ch.id==='games'?factValues(db,'game','platforms',8):Promise.resolve([]),
  ch.id==='games'?factValues(db,'game','genres',10):Promise.resolve([]),
 ]);
 // The 36px thumbnail of each row: the post's first result image (or its 원본).
 const media=await mediaOf(db,board.posts.filter(p=>p.has_image).map(p=>p.id));
 for(const p of board.posts){const x=media.get(p.id);/** @type {any} */(p).thumb=x?.after||x?.before||null;}
 // A quiet channel still offers tags to pick: its featured ones fill the chips up to 10.
 const used=new Set(popular.map(p=>p.entity.id));
 const featured=[...(await entitiesByIds(db,(FEATURED_TAGS[ch.id]||[]).filter(id=>!used.has(id)))).values()];
 const tags=[...popular.map(p=>p.entity),...featured].slice(0,12);
 return {l:o.l,now:o.now,ch,kind,tag:tagEntity,children,sort,best,bestPage:!!o.bestPage,page,facet,platform:facet?.property==='platforms'?o.platform:null,genre:facet?.property==='genres'?o.genre:null,
  board,notices,bots,counts,tags,bestMin,bestList,types,platforms,genres,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadBoard>>} m @param {{origin:string}} site */
export function renderBoard(m,site){
 const {l,now,ch}=m,s=t(l),ko=l==='ko',lang=ko?'ko':'en';
 const name=ch.names[lang],base=channelPath(l,ch.id);
 /** A link to this board with some parameters changed (tabs, chips, sort, pages). */
 const q=(/** @type {Record<string,string|number|null>} */ p)=>{
  const u=new URLSearchParams();
  /** @type {Record<string,string|number|null>} */const all={kind:m.kind,tag:m.tag?.id||null,sort:m.sort==='new'?null:m.sort,best:m.best&&!m.bestPage?1:null,platform:m.platform??null,genre:m.genre??null,...p};
  for(const [k,x] of Object.entries(all))if(x!==null&&x!==undefined&&x!=='')u.set(k,String(x));
  const str=u.toString().replace(/%3A/gi,':');return str?`${base}?${str}`:base;
 };
 const v=ch.vertical?verticalOf(ch.vertical):null;
 const typeText=Object.entries(m.types).sort((a,b)=>b[1]-a[1]).map(([type,n])=>{const td=ch.vertical?typeDef(ch.vertical,type):null;return `${td?label(td.label,l):type} ${n}`;}).join(' · ');
 const tagTotal=Object.values(m.types).reduce((a,b)=>a+b,0);
 // Archived channels (since 2026-10-11) keep their tag facts and read-only posts; the AI 창작 boards lead with
 // the workbench (다듬고 올리기) when they have presets, with plain 글쓰기 beside it.
 const ro=!!ch.readOnly,presets=(ch.presets||[]).map(x=>presetLabel(x,l));
 const writeBtns=ro?'':presets.length?html`<a class="btn p" href="${makePath(l)}">${ko?'다듬고 올리기':'Finish and post'}</a><a class="btn" href="${writePath(l,ch.id,{tag:m.tag?.id||null,kind:m.kind&&m.kind!=='notice'?m.kind:null})}">${s.write}</a>`:html`<a class="btn p" href="${writePath(l,ch.id,{tag:m.tag?.id||null,kind:m.kind&&m.kind!=='notice'?m.kind:null})}">${s.write}</a>`;
 const head=html`${ch.id==='hw'?hardwareToolLinks(l):''}<section class="box chh chead">${channelTile(ch.id,l)}<div class="chm"><div class="chn1"><h1>${s.channel(name)}</h1>${ro?html`<span class="fine arch">${ko?'보관된 채널 · 새 글은 받지 않아요':'Archived · no new posts'}</span>`:presets.length?html`<span class="fine">${ko?'레시피 첨부 권장':'Recipes welcome'}</span>`:''}${ch.vertical&&!ro?html`<span class="fine">${ko?`태그 ${compact(tagTotal,l)}개`:`${compact(tagTotal,l)} tags`}${typeText?` · ${typeText}`:''}</span>`:''}</div>
<span class="fine">${s.today} ${compact(m.counts.today,l)} · ${s.posts} ${compact(m.counts.total,l)}${v?html` · <a href="/${l}/${ch.vertical}/">${ko?'태그 모음':'All tags'} ›</a>`:''}</span><p class="desc">${ch.desc[lang]}${ch.id==='games'?html` · <a href="${patchCollectionPath(l)}">${ko?'한글패치 모음':'Korean patches'} ›</a>`:''}</p></div>
<div class="cha">${ch.inBar?html`<button type="button" class="btn pin" data-pin="${ch.id}" aria-pressed="false"><span class="p0">${ko?'고정':'Pin'}</span><span class="p1">✓ ${ko?'고정됨':'Pinned'}</span></button>`:''}${writeBtns}</div></section>`;
 const specRow=presets.length?html`<nav class="specrow" aria-label="${ko?'규격':'Sizes'}"><span class="tl">${ko?'규격':'Sizes'}</span>${presets.map(x=>html`<a href="${makePath(l,{slug:x.slug})}"><b>${x.name}</b><span class="mono">${x.spec}</span></a>`)}</nav>`:'';
 const note=ch.note?html`<p class="chnote"><span class="mh nt">${ko?'공지':'Note'}</span>${ch.note[lang]}</p>`:'';
 const tabs=html`<nav class="mtabs" aria-label="${ko?'말머리':'Flairs'}"><a href="${q({kind:null,page:null})}"${!m.kind?html` class="on" aria-current="page"`:''}>${s.all}</a>${ch.flairs.map(k=>html`<a rel="nofollow" href="${q({kind:k,page:null})}"${m.kind===k?html` class="on" aria-current="page"`:''}>${flairLabel(ch.id,k,l)}</a>`)}</nav>`;
 const chips=m.tags.length?html`<div class="tagbar"><span class="tl">${ko?'인기 태그':'Popular tags'}</span>${m.tags.map(e=>html`<a rel="nofollow" class="tchip${m.tag?.id===e.id?' on':''}" href="${q({tag:m.tag?.id===e.id?null:e.id,page:null})}"${m.tag?.id===e.id?html` aria-current="true"`:''}>${nameOf(e,l)}${ch.vertical&&e.vertical!==ch.vertical?html`<span class="tv">· ${label(/** @type {any} */(verticalOf(e.vertical))?.label||{ko:'',en:''},l)}</span>`:''}</a>`)}${v?html`<a class="more" href="/${l}/${ch.vertical}/">${ko?`태그 ${compact(tagTotal,l)}개 모두`:`All ${compact(tagTotal,l)} tags`} ›</a>`:''}</div>`:'';
 const banner=m.tag?html`<div class="tagon"><b>#${nameOf(m.tag,l)}</b><span>${ko?'태그 글':'tagged posts'}${m.children.length?html` · ${ko?'하위 태그 포함':'with its parts'} (${m.children.slice(0,4).map(e=>nameOf(e,l)).join(' · ')}${m.children.length>4?' …':''})`:''}</span><a href="${channelUrl(l,m.tag)}">${ko?'태그 페이지':'Tag page'} ›</a><a class="btn" href="${q({tag:null,page:null})}">${ko?'태그 해제':'Clear tag'}</a></div>`:'';
 const facets=ch.id==='games'&&(m.platforms.length||m.genres.length)?html`<div class="facets">${m.platforms.length?html`<div class="fr"><span class="tl">${ko?'플랫폼':'Platform'}</span><a rel="nofollow" href="${q({platform:null,genre:null,page:null})}"${!m.platform&&!m.genre?html` class="on"`:''}>${s.all}</a>${m.platforms.map(x=>html`<a rel="nofollow" href="${q({platform:x.value,genre:null,page:null})}"${m.platform===x.value?html` class="on"`:''}>${PLATFORM_NAMES[x.value]||x.value}</a>`)}</div>`:''}${m.genres.length?html`<div class="fr"><span class="tl">${ko?'장르':'Genre'}</span>${m.genres.map(x=>html`<a rel="nofollow" href="${q({genre:x.value,platform:null,page:null})}"${m.genre===x.value?html` class="on"`:''}>${genreLabel(x.value,l)}</a>`)}</div>`:''}</div>`:'';
 const bestTitle=ko?`★ 념글: 24시간 안에 추천 ${m.bestMin} 이상, 추천 비율 ${BEST_RULE.minRatio*100}% 이상 (이 채널 최근 7일 활동 기준)`:`★ Best: ${m.bestMin}+ upvotes and ${BEST_RULE.minRatio*100}%+ ratio within 24 h (this channel's last 7 days)`;
 const sortBar=html`<div class="sb">${[['new',s.sortNew],['hot',s.sortHot],...(ro?[['top',s.sortTop]]:[['tries',ko?'많이 해본 순':'Most tried']]),['activity',s.sortActivity]].map(([k,lab])=>html`<a rel="nofollow" href="${q({sort:k==='new'?null:k,page:null})}"${m.sort===k&&!m.best?html` class="on"`:''}>${lab}</a>`)}<span class="sp"></span><a rel="nofollow" class="best${m.best?' on':''}" href="${m.bestPage?base:m.best?q({best:null,page:null}):`${base}best`}" title="${bestTitle}">${s.best}</a></div>`;
 const tagOn=new Set([m.tag?.id,...m.children.map(e=>e.id)].filter(Boolean).map(String));
 const rows=m.board.posts.map(p=>postRow(p,{l,now,tagOn}));
 // One 공지 visible, the rest behind "공지 n개 더"; the bot's 소식 as one row that opens the 소식 tab.
 const [n1,...nMore]=m.notices;
 const notice=n1?html`<li class="pr pin nrow"><span class="no">${kindChip('notice',l,ch.id)}</span><span class="tc"><a class="tt" href="${postHref(l,n1)}"><b>${n1.title}</b></a>${nMore.length?html`<details class="nmore"><summary>${ko?`공지 ${nMore.length}개 더`:`${nMore.length} more`}</summary><ul>${nMore.map(p=>html`<li><a href="${postHref(l,p)}">${p.title}</a></li>`)}</ul></details>`:''}</span><span class="nick">${ko?'운영자':'Staff'}<b class="ck">✓</b></span><span class="num w"></span><span class="num v"></span><span class="num u"></span></li>`:'';
 const botRow=m.bots.count?html`<li class="pr bot brow"><span class="no">⚙</span><span class="tc"><span class="tt">${kindChip('news',l,ch.id)}${ko?`레이더 소식 ${m.bots.count}건 접힘`:`${m.bots.count} Radar news folded`}${m.bots.title?html` <span class="fine">— ${m.bots.title}${m.bots.count>1?(ko?' 외':' and more'):''}</span>`:''}</span><a class="unfold" rel="nofollow" href="${q({kind:'news',page:null})}">${ko?'펼치기':'Show'}</a></span><span class="nick">${s.bot}</span><span class="num w"></span><span class="num v"></span><span class="num u"></span></li>`:'';
 const pager=m.page>1||m.board.more?html`<nav class="pager" aria-label="${s.page}">${m.page>1?html`<a class="btn" rel="nofollow" href="${q({page:m.page-1===1?null:m.page-1})}">‹ ${s.prev}</a>`:''}<span class="fine">${m.page}</span>${m.board.more?html`<a class="btn" rel="nofollow" href="${q({page:m.page+1})}">${s.next} ›</a>`:''}</nav>`:'';
 const empty=rows.length||notice||botRow?'':html`<p class="empty">${m.kind||m.tag||m.best||m.facet?(ko?'이 조건의 글이 아직 없어요. 첫 글을 써 보세요.':'No posts match yet. Write the first one.'):s.emptyBoard}</p>`;
 const boardBox=html`<section class="box board" id="board">${tabs}${specRow}${chips}${banner}${facets}${note}${sortBar}<div class="newbar" data-island="new-posts" data-channel="${ch.id}" data-after="${m.board.posts[0]?.channel_no||0}" hidden></div>
<ol class="plist" aria-label="${s.channelList(name)}">${boardHead(l)}${notice}${botRow}${rows}</ol>${empty}${pager}</section>`;
 const tagCard=m.tag?html`<section class="box tagcard"><div class="bh"><h2>#${nameOf(m.tag,l)}</h2><span class="x">${label(/** @type {any} */(typeDef(m.tag.vertical,m.tag.type))?.label||{ko:'태그',en:'Tag'},l)}</span></div>${m.tag.descriptions[l]||m.tag.descriptions.en?html`<p class="pad fine">${m.tag.descriptions[l]||m.tag.descriptions.en}</p>`:''}${m.children.length?html`<p class="pad fine">${ko?'하위 태그':'Parts'}: ${m.children.map((e,i)=>html`${i?' · ':''}<a href="${channelUrl(l,e)}">${nameOf(e,l)}</a>`)}</p>`:''}<p class="pad acts2"><a class="btn" href="${channelUrl(l,m.tag)}">${ko?'정보 페이지':'Info page'}</a><a class="btn p" href="${writePath(l,ch.id,{tag:m.tag.id})}">${ko?'이 태그로 글쓰기':'Write with this tag'}</a></p></section>`:'';
 const bestBox=box({title:ko?`★ ${name} 념글`:`★ Best in ${name}`,note:html`<a href="${base}best">${ko?'더보기':'More'} ›</a>`},m.bestList.length?html`<ol class="rows">${m.bestList.map(p=>html`<li><a class="tt" href="${postHref(l,p)}">${kindChip(p.kind,l,p.channel_id)}${p.title}</a><span class="up">▲ ${p.up}</span></li>`)}</ol>`:html`<p class="empty">${ko?'이번 주 념글이 아직 없어요.':'No best posts this week yet.'}</p>`);
 const guide=box({title:ko?'채널 안내':'About this channel'},ro?html`<ul class="rules pad"><li>${ko?'2026년 10월부터 Nerulio는 AI 창작 커뮤니티가 되었어요. 이 채널의 글은 그대로 읽을 수 있지만 새 글은 받지 않아요.':'Since October 2026 Nerulio is an AI creation community. This channel stays readable but takes no new posts.'}</li><li><a href="${recipesPath(l)}">${ko?'레시피 모음 보기':'See the recipes'} ›</a></li><li><a href="/${l}/community/policy">${ko?'게시판 운영정책':'Community rules'}</a></li></ul>`:html`<ul class="rules pad"><li>${ko?'결과 이미지와 함께 레시피를 붙이면 다른 사람이 "내 사진으로 해보기"를 할 수 있어요. 작업대에서 다듬고 올리면 레시피가 자동으로 붙어요.':'Post the result with its recipe and others can "try it on their image". Posting from the workbench attaches the recipe for you.'}</li>${ch.id==='sticker'?html`<li>${ko?'LINE은 AI 스탬프 판매 가능, 카톡은 대화용만':'LINE sells AI stickers; KakaoTalk is for chats only'}</li>`:''}<li>${bestTitle}</li><li>${ko?'전연령 · 실존 인물은 본인 사진만 · ':'All ages · real people: your own photo only · '}<a href="/${l}/community/policy#ai">${ko?'게시판 운영정책':'Community rules'}</a></li></ul>`);
 const body=html`${head}<div class="cols"><main class="mainc">${boardBox}</main><aside class="side">${tagCard}${bestBox}${guide}</aside></div>`;
 const filtered=!!(m.kind||m.tag||m.sort!=='new'||(m.best&&!m.bestPage)||m.page>1||m.facet);
 const other=ko?'en':'ko',path=m.bestPage?`${base}best`:base,otherPath=channelPath(other,ch.id)+(m.bestPage?'best':'');
 const title=m.bestPage?(ko?`${name} 념글 — Nerulio AI 창작 커뮤니티`:`Best in ${name} — Nerulio AI creation community`):(ko?`${name} 채널 — Nerulio AI 창작 커뮤니티`:`${name} — Nerulio AI creation community`);
 const description=ko?`${name} 채널: ${ch.desc.ko}. AI로 만든 이미지와 다듬는 레시피를 나누는 Nerulio 게시판.`:`${name}: ${ch.desc.en}. A Nerulio board for AI images and the recipes that finish them.`;
 return page({l,title,description,canonical:site.origin+(filtered?q({}):path),alternates:{[l]:site.origin+path,[other]:site.origin+otherPath,'x-default':site.origin+channelPath('en',ch.id)+(m.bestPage?'best':'')},
  noindex:filtered,channels:m.channels.map(c=>({...c,on:c.href===base&&!(ch.id==='games'&&m.kind==='patch')})),patchOn:ch.id==='games'&&m.kind==='patch',body,feed:`${base}feed.xml`});
}
