// @ts-check
/** RSS 2.0 feeds: a tag's new posts (every channel) and recorded changes (/{l}/{vertical}/{slug}/feed.xml),
 * a channel's new posts (/{l}/community/{channel}/feed.xml), the site-wide Radar (/{l}/radar/feed.xml) and a
 * service's status (/{l}/ai/{slug}/status/feed.xml: official incidents and user-report spikes, each start
 * and end, always labelled which is which).
 * Naver Search Advisor and feed readers take RSS. */
import {nameOf,channelUrl,postHref,channelName} from './ui.js';
import {boardPosts,changesFor,radarChanges,recentVersions,issueReportsSince} from '../db/channel.js';
import {loadStatus} from './status.js';
import {spikeEpisodes} from '../status-signal.js';
import {channelPath,flairLabel,channelById} from '../channels.js';
import {describeChange} from '../change-text.js';

const x=(/** @type {unknown} */ s)=>String(s??'').replace(/[&<>"']/g,c=>/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
/** @param {{title:string,link:string,description:string,l:string,items:{title:string,link:string,at:number,guid:string,category?:string,description?:string}[]}} f */
function rss(f){
 const items=f.items.sort((a,b)=>b.at-a.at).slice(0,40).map(i=>`<item><title>${x(i.title)}</title><link>${x(i.link)}</link><guid isPermaLink="false">${x(i.guid)}</guid><pubDate>${new Date(i.at).toUTCString()}</pubDate>${i.description?`<description>${x(i.description)}</description>`:''}${i.category?`<category>${x(i.category)}</category>`:''}</item>`).join('');
 return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(f.title)}</title><link>${x(f.link)}</link><description>${x(f.description)}</description><language>${f.l==='ko'?'ko-KR':'en'}</language>${items}</channel></rss>`;
}
/** @param {any} db @param {import('../db/channel.js').Entity} e @param {string} l @param {string} origin */
export async function channelFeed(db,e,l,origin){
 const name=nameOf(e,l),posts=(await boardPosts(db,{tag:e.id,limit:30})).posts,changes=await changesFor(db,[e.id],{minImportance:1,limit:20});
 const ko=l==='ko';
 return rss({title:ko?`${name} 채널 — Nerulio`:`${name} — Nerulio`,link:origin+channelUrl(l,e),description:ko?`${name}의 새 글과 바뀐 것`:`New posts and changes in ${name}`,l,
  items:[...posts.map(p=>({title:p.title,link:origin+postHref(l,p),at:p.created_at,guid:`post:${p.id}`,category:flairLabel(p.channel_id,p.kind,l)})),
   ...changes.map(c=>{const d=describeChange(c,{name},/** @type {'ko'|'en'} */(l));return {title:d.detail?`${d.title} — ${d.detail}`:d.title,link:origin+channelUrl(l,e)+'history',at:c.detected_at,guid:`change:${c.id}`,category:ko?'변경':'change'};})]});
}
/** A channel's newest posts. @param {any} db @param {string} ch @param {string} l @param {string} origin */
export async function boardFeed(db,ch,l,origin){
 const ko=l==='ko',name=channelName(ch,l),c=channelById(ch),posts=(await boardPosts(db,{channel:ch,limit:40})).posts;
 return rss({title:ko?`${name} 채널 — Nerulio 커뮤니티`:`${name} — Nerulio community`,link:origin+channelPath(l,ch),description:c?c.desc[ko?'ko':'en']:name,l,
  items:posts.map(p=>({title:p.title,link:origin+postHref(l,p),at:p.created_at,guid:`post:${p.id}`,category:flairLabel(ch,p.kind,l)}))});
}
/** @param {any} db @param {string} l @param {string} origin */
export async function radarFeed(db,l,origin){
 const ko=l==='ko',changes=await radarChanges(db,{limit:40,minImportance:2});
 // Releases of the last 30 days too (the Radar page shows them), so the feed is never empty.
 const now=Date.now(),releases=await recentVersions(db,{since:now-30*864e5,until:now,limit:40});
 const rel=releases.map(r=>({title:ko?`${nameOf(r.entity,l)} ${r.version} 출시`:`${nameOf(r.entity,l)} ${r.version} released`,link:origin+channelUrl(l,r.entity),at:r.released_at,guid:`version:${r.entity.id}:${r.version}`,category:ko?'출시':'release',description:ko?`${nameOf(r.entity,l)}의 새 버전 ${r.version}`:`New version ${r.version} of ${nameOf(r.entity,l)}`}));
 return rss({title:ko?'Nerulio 레이더':'Nerulio Radar',link:origin+`/${l}/radar/`,description:ko?'AI·게임·하드웨어·창작 도구에서 바뀐 것':'What changed in AI, games, hardware and creator tools',l,
  items:[...rel,...changes.map(c=>{const d=describeChange(c,{name:nameOf(c.entity,l)},/** @type {'ko'|'en'} */(l));return {title:d.detail?`${d.title} — ${d.detail}`:d.title,link:origin+channelUrl(l,c.entity),at:c.detected_at,guid:`change:${c.id}`,category:c.vertical,description:d.detail||d.title};})]});
}

/** A service's status as a feed: an official incident's start and end (from the status page the collector
 * reads), and a spike of Nerulio users' "안 돼요" reports starting and ending (clock hours, SPIKE rule).
 * @param {any} db @param {import('../db/channel.js').Entity} e @param {string} l @param {string} origin @param {number} now */
export async function statusFeed(db,e,l,origin,now){
 const ko=l==='ko',name=nameOf(e,l),link=origin+channelUrl(l,e)+'status';
 const [m,reports]=await Promise.all([loadStatus(db,e,{l,now}),issueReportsSince(db,[e.id],now-21*864e5)]);
 const label=m.alias?`${name}(${m.alias})`:name;
 /** @type {{title:string,link:string,at:number,guid:string,category?:string,description?:string}[]} */const items=[];
 for(const x of m.incidents){
  const who=x.about?nameOf(x.about,l):name,t=x.title[l]||x.title.en||'',src=ko?`출처: 공식 상태 페이지 ${x.url}`:`Source: official status page ${x.url}`;
  if(x.starts_at)items.push({title:ko?`${who} 공식 장애: ${t}`:`${who} official incident: ${t}`,link,at:x.starts_at,guid:`incident:${x.id}:start`,category:ko?'공식 장애':'official incident',description:src});
  if(x.status==='ended'&&x.ends_at)items.push({title:ko?`${who} 공식 장애 해결: ${t}`:`${who} official incident resolved: ${t}`,link,at:x.ends_at,guid:`incident:${x.id}:end`,category:ko?'공식 장애':'official incident',description:src});
 }
 for(const s of spikeEpisodes(reports,now)){
  items.push({title:ko?`${name} 사용자 리포트 급증 시작`:`${name}: user reports spiking`,link,at:s.start,guid:`spike:${e.id}:${s.start}:start`,category:ko?'사용자 리포트':'user reports',
   description:ko?`Nerulio 사용자들의 ‘안 돼요’ 리포트가 평소보다 많아졌어요 (가장 많은 한 시간 ${s.peak}건). 공식 장애 여부는 공식 상태 페이지 기준으로 따로 표시합니다.`:`More “not working” reports from Nerulio users than usual (peak ${s.peak} in an hour). Whether there is an official incident is shown separately, from the official status page.`});
  if(s.end)items.push({title:ko?`${name} 사용자 리포트 급증 끝`:`${name}: user reports back to usual`,link,at:s.end,guid:`spike:${e.id}:${s.start}:end`,category:ko?'사용자 리포트':'user reports',
   description:ko?'사용자 리포트가 평소 수준으로 돌아왔어요.':'User reports are back to the usual level.'});
 }
 return rss({title:ko?`${label} 장애·상태 알림 — Nerulio`:`${name} outages and status — Nerulio`,link,description:ko?`${label}의 공식 장애 기록과 Nerulio 사용자 리포트 급증 (시작·해결)`:`Official incidents of ${name} and spikes of Nerulio user reports (start and end)`,l,items});
}
