// @ts-check
/** Radar (/{l}/radar/): what changed and what is coming, across every channel — Radar changes
 * (price, availability, compatibility, versions) and news posts, releases of the last 30 days and
 * official dates of the next 30, filterable by vertical. The personal version (My Radar) is the
 * same feed limited to followed channels, served to signed-in readers by an island later. */
import {html,safeHref} from './html.js';
import {page,nameOf,channelUrl,box,badge,monogram,TILE} from './ui.js';
import {boardTime,dateText,dday,eventTime,collapseVersions} from './format.js';
import {radarChanges,recentVersions,upcomingEvents,preorderDeadlines,channelsAround,entitiesByIds} from '../db/channel.js';
import {describeChange} from '../change-text.js';
import {VERTICALS} from '../schema.js';
import {verticalOf} from '../verticals/index.js';
import {label} from '../labels.js';

const DAY=864e5;
/** @param {any} db @param {{l:string,now:number,vertical?:string|null,channels?:{name:string,href:string}[]}} o */
export async function loadRadar(db,o){
 const vertical=o.vertical&&VERTICALS.includes(/** @type {any} */(o.vertical))?o.vertical:null,now=o.now;
 // One line per entity and kind of change (several schedule edits to one work read as one).
 const seen=new Set();
 const changes=(await radarChanges(db,{limit:60,minImportance:2})).filter(c=>!vertical||c.vertical===vertical).filter(c=>{const k=`${c.entity_id}|${c.kind}|${c.property||''}`;return seen.has(k)?false:(seen.add(k),true);}).slice(0,25);
 const releases=collapseVersions(await recentVersions(db,{since:now-30*DAY,until:now,vertical,limit:60}),o.l).slice(0,40);
 const upcoming=await upcomingEvents(db,{from:now,to:now+30*DAY,vertical,limit:60});
 // Goods pre-orders closing soon (subculture): on the Radar too, not only on the subculture hub.
 const preorders=!vertical||vertical==='subculture'?await preorderDeadlines(db,now,8):[];
 // For "내 구독만": the channels each schedule item and each goods item belong to (a figure belongs to
 // its character and that character's work), as channel paths.
 const around=await channelsAround(db,[...new Set([...upcoming.flatMap(ev=>ev.about),...preorders.map(p=>p.entity.id)])]);
 const ents=await entitiesByIds(db,[...new Set([...around.values()].flatMap(x=>[...x]))]);
 const paths=(/** @type {string[]} */ ids)=>[...new Set(ids.flatMap(id=>[...(around.get(id)||[])]).map(id=>ents.get(id)).filter(Boolean).map(e=>channelUrl(o.l,/** @type {any} */(e))))].join(' ');
 const chOf={events:new Map(upcoming.map(ev=>[ev.id,paths(ev.about)])),goods:new Map(preorders.map(p=>[p.entity.id,paths([p.entity.id])]))};
 return {vertical,changes,releases,upcoming,preorders,chOf,l:o.l,now,channels:o.channels||[]};
}

/** @param {Awaited<ReturnType<typeof loadRadar>>} m @param {{origin:string}} site */
export function renderRadar(m,site){
 const {l,now}=m,ko=l==='ko',base=`/${l}/radar/`;
 const tabs=html`<nav class="ftabs" aria-label="${ko?'분야':'Area'}"><a href="${base}"${!m.vertical?html` class="on" aria-current="page"`:''}>${ko?'전체':'All'}</a>${VERTICALS.map(v=>html`<a href="${base}?v=${v}"${m.vertical===v?html` class="on" aria-current="page"`:''}>${label(/** @type {any} */(verticalOf(v)).label,l)}</a>`)}</nav>`;
 const tile=(/** @type {any} */ e)=>html`<span class="tile sm ${TILE[e.vertical]||''}" aria-hidden="true">${monogram(e,l)}</span>`;
 const changes=m.changes.length?box({cls:'mf',title:ko?'바뀐 것':'Changed',extra:badge('AUTOMATED',l)},html`<ul class="rows">${m.changes.map(c=>{const d=describeChange(c,{name:nameOf(c.entity,l)},/** @type {'ko'|'en'} */(l));return html`<li><span class="tm">${boardTime(c.detected_at,now,l)}</span>${tile(c.entity)}<a class="tt" href="${channelUrl(l,c.entity)}">${d.title}${d.detail?html` <span class="fine">${d.detail}</span>`:''}</a></li>`;})}</ul>`):'';
 /** @type {Map<string,typeof m.releases>} */const byDay=new Map();for(const r of m.releases){const k=dateText(r.released_at,'day','en');byDay.set(k,[...(byDay.get(k)||[]),r]);}
 const releases=box({cls:'mf',title:ko?'최근 30일 출시·업데이트':'Released in the last 30 days',note:ko?`${m.releases.length}건 · 공식 발표·Steam·GitHub`:`${m.releases.length} · official, Steam, GitHub`},m.releases.length?html`<ol class="hist">${[...byDay.entries()].map(([d,rows])=>html`<li><h3 class="hd2">${d}</h3><ul class="rows">${rows.map(r=>html`<li>${tile(r.entity)}<a class="tt" href="${channelUrl(l,r.entity)}">${nameOf(r.entity,l)} <b>${r.version}</b></a>${r.notes_url?html`<a class="fine" href="${safeHref(r.notes_url)}" rel="noopener nofollow" target="_blank">${ko?'노트':'notes'} ↗</a>`:''}</li>`)}</ul></li>`)}</ol>`:html`<p class="empty">${ko?'최근 30일 동안 수집된 출시가 없습니다.':'No releases collected in the last 30 days.'}</p>`);
 const upcoming=box({cls:'mf',title:ko?'다가오는 공식 일정 (30일)':'Official dates, next 30 days'},m.upcoming.length?html`<ul class="rows">${m.upcoming.map(ev=>html`<li class="ev" data-ch="${m.chOf.events.get(ev.id)||''}"><span class="dday${ev.starts_at-now>14*DAY?' g':''}">${dday(ev.starts_at,now,l)}</span><span class="tt">${ev.url?html`<a href="${safeHref(ev.url)}" rel="noopener" target="_blank">${ev.title[l]||ev.title.en}</a>`:ev.title[l]||ev.title.en} <span class="fine">·</span> <a class="fine" href="${channelUrl(l,/** @type {any} */(ev.entity))}">${nameOf(/** @type {any} */(ev.entity),l)}</a></span><span class="fine">${eventTime(ev.starts_at,ev.precision,l)}</span></li>`)}</ul>`:html`<p class="empty">${ko?'30일 안에 발표된 일정이 없습니다.':'No announced dates in the next 30 days.'}</p>`);
 const preorders=m.preorders.length?box({title:ko?'예약 마감 임박 굿즈':'Pre-orders closing soon',note:ko?'제조사 공식 상품 페이지 기준':'official product pages',cls:'mf'},html`<ul class="rows">${m.preorders.map((/** @type {any} */ p)=>html`<li data-ch="${m.chOf.goods.get(p.entity.id)||''}"><span class="st soon">${ko?'마감':'closes'} ${dday(Date.parse(p.ends+'T23:59:59+09:00'),now,l)}</span><a class="tt" href="${channelUrl(l,p.entity)}">${nameOf(p.entity,l)}</a></li>`)}</ul>`):'';
 const body=html`<section class="box chh rh"><div class="chm"><div class="chn1"><h1>${ko?'레이더':'Radar'}</h1><span class="fine">${ko?'모든 채널에서 무엇이 바뀌었고 무엇이 다가오는지':'What changed and what is coming, across every channel'}</span></div>${tabs}</div></section>
<div class="cols"><main class="mainc"><section class="box" id="mine" data-island="my-radar" hidden><div class="bh"><h2>${ko?'내 레이더':'My Radar'}</h2><span class="x">${ko?'구독한 채널의 변경과 새 글':'Changes and new posts in channels you follow'}</span></div><div data-replies hidden><h3 class="wh pad">${ko?'내 글·댓글의 새 반응':'Replies to you'}</h3><ul class="rows"></ul></div><ul class="rows"></ul></section>${changes}${releases}</main><aside class="side">${upcoming}${preorders}</aside></div>`;
 const other=ko?'en':'ko';
 return page({l,title:ko?'레이더 — AI·게임·하드웨어·창작 도구의 최신 변경 | Nerulio':'Radar — latest changes in AI, games, hardware and creator tools | Nerulio',
  description:ko?'모델 출시, 게임 업데이트, 드라이버, DAW 버전, 애니 방영 일정까지 출처와 함께 모아 봅니다.':'Model launches, game updates, drivers, DAW versions and anime dates, with sources.',
  feed:base+'feed.xml',canonical:site.origin+base+(m.vertical?`?v=${m.vertical}`:''),alternates:{[l]:site.origin+base,[other]:site.origin+`/${other}/radar/`},noindex:!!m.vertical,channels:m.channels,body});
}
