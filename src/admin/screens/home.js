// @ts-check
/** 홈 · 오늘 상태: what needs attention today. A red card only when something is wrong; every tile
 * opens its tab. Data: GET /api/v2/admin/overview (one request). */
import {h,icon} from '../lib/dom.js';
import {box,st,dot,needCard,failure,fill,skeleton} from '../lib/ui.js';
import {meter,spark} from '../lib/charts.js';
import {num,compact,relTime,dayClock,shortDate,pct} from '../lib/format.js';
import {homeAlert,usageView,trafficTile,rerunIds} from '../lib/model.js';
import {statusState} from '../lib/labels.js';
import {runSheet} from './collectors.js';

export const title='관리';
export const tab='home';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 if(!ctx.overview)fill(main,skeleton(5));
 let ov;
 try{ov=await ctx.loadOverview();}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const now=ctx.now();
 fill(main,alertCard(ctx,ov,now),usageSlot(ctx,ov.usage,now),tiles(ov),trafficBox(ov.traffic),statusBox(ov.status,now),graphLine(ov.graph),ctx.stamp(ov.generatedAt));
}

/** @param {any} ctx @param {any} ov @param {number} now */
function alertCard(ctx,ov,now){
 const a=homeAlert(ov,now);if(!a)return h('p.allok',{role:'status'},icon('check',{size:18}),'지금 챙길 문제가 없습니다.');
 return h('div.alert',{role:'alert'},
  h('div.h',icon('alert',{size:20}),h('div',
   ...a.parts.map((p,i)=>h('p',p.title?h('b',p.title):null,p.title&&p.body?' · ':'',p.body)),
   h('span.l2',[a.at?`${dayClock(a.at,now)} (${relTime(a.at,now)})`:'',a.dailyReset?'한도는 매일 09:00(KST)에 초기화됨':''].filter(Boolean).join(' · ')))),
  h('div.btns',
   rerunCount(ov,a.rerun)?h('button.btn.p',{type:'button',onclick:async()=>{
    // The overview lists only the first few problem collectors: take the ids from the full list.
    let ids=a.rerun;
    if(ids.length<rerunCount(ov,ids))try{ids=rerunIds((await ctx.api.get('/api/v2/admin/collectors'))?.items)||ids;}catch{}
    runSheet(ctx,ids,{usage:ov.usage});
   }},`${rerunCount(ov,a.rerun)}개 다시 실행`):null,
   h('a.btn',{href:'#/collectors'},'자세히')));
}
/** Problem collectors to re-run: the overview's counts (its item list is capped). @param {any} ov @param {string[]} ids */
const rerunCount=(ov,ids)=>Math.max(ids.length,(Number(ov.collectors?.failing)||0)+(Number(ov.collectors?.never)||0)+(Number(ov.collectors?.stale)||0));
/** The overview carries usage, or null when it is not configured or Cloudflare did not answer:
 * then /usage is asked once for the exact reason (which settings are missing). @param {any} ctx @param {any} usage @param {number} now */
function usageSlot(ctx,usage,now){
 if(usageView(usage))return usageBox(usage,now);
 const slot=h('div.usage-slot',skeleton(1));
 ctx.api.get('/api/v2/admin/usage').then((/** @type {any} */ u)=>fill(slot,usageBox(u,now)),(/** @type {any} */ e)=>fill(slot,failure(e,()=>ctx.refresh(),'CF_ANALYTICS_TOKEN')));
 return slot;
}
/** D1 usage: month-to-date vs the monthly included amount (Workers Paid), or today vs the daily
 * free limit (older API shape). @param {any} usage @param {number} now */
function usageBox(usage,now){
 if(usage&&typeof usage==='object'&&(usage.need||usage.error))return needCard(usage.need||'CF_ANALYTICS_TOKEN');
 const u=usageView(usage);
 if(!u)return needCard('CF_ANALYTICS_TOKEN');
 const meterRow=[meter(u.ratio,{label:`${u.period==='month'?'이번 달':'오늘'} 쓰기 ${Math.round(u.ratio*1000)/10}%, 80% 알림선`}),h('div.mlab',h('span','0'),h('span.m80','80% 알림'),h('span',compact(u.limitW)))];
 if(u.period==='month'){
  const days=u.days.slice(-14),w=days.map((/** @type {any} */ d)=>Number(d.rowsWritten)||0);
  return box('D1 쓰기 (이번 달 · 계정 전체)',usage?.resetAt?`${shortDate(usage.resetAt)} 초기화 (${relTime(usage.resetAt,now)})`:'매월 초기화',h('div.pad',
   h('div.big',num(u.written),' ',h('small',`/ ${compact(u.limitW)}행 포함 · 이번 달`)),
   ...meterRow,
   u.level==='bad'?h('p.badtxt.b','월 포함량을 넘었습니다. 넘은 만큼 요금이 붙습니다.'):null,
   h('div.prevday',h('div.hd2',h('span','오늘 (UTC 기준)'),h('span',`쓰기 ${num(u.today.w)}행 · 읽기 ${compact(u.today.r)}행`)),
    days.length>1?spark(w,`최근 ${days.length}일 쓰기: ${w.join(', ')}`):null,
    days.length>1?h('div.mlab',h('span',shortDate(days[0].day)),h('span',`최근 ${days.length}일 쓰기`),h('span',shortDate(days[days.length-1].day))):null),
   h('p.fine',`읽기 ${compact(u.read)} / ${compact(u.limitR)}행 이번 달 (${pct(u.read,u.limitR)}) · 남은 쓰기 포함량 ${compact(u.remaining)}행`)));
 }
 const prev=u.days.filter((/** @type {any} */ d)=>d.day&&d.day<new Date(now).toISOString().slice(0,10)).slice(-1)[0];
 return box('D1 쓰기 (계정 전체)','09:00 초기화',h('div.pad',
  h('div.big',num(u.written),' ',h('small',`/ ${num(u.limitW)}행 · 오늘`)),
  ...meterRow,
  prev?h('div.prevday',h('div.hd2',h('span',`어제 (${shortDate(prev.day)} UTC)`),h('span',`${num(prev.rowsWritten)}행`)),
   meter(Number(prev.rowsWritten)/u.limitW,{label:`어제 쓰기 ${Math.round(Number(prev.rowsWritten)/u.limitW*100)}%`}),
   Number(prev.rowsWritten)>=u.limitW?h('div.mlab',h('span.badtxt','한도 도달 · 수집 중단')):null):null,
  h('p.fine',`읽기 ${num(u.read)} / ${num(u.limitR)}행 · 남은 쓰기 ${num(u.remaining)}행`)));
}
/** @param {any} ov */
function tiles(ov){
 const c=ov.collectors||{},total=['ok','failing','stale','manual','never'].reduce((n,k)=>n+(Number(c[k])||0),0);
 const segs=h('span.seg4',{'aria-hidden':'true'},...[['ok','ok'],['failing','bad'],['never','warn'],['stale','warn'],['manual','track']].filter(([k])=>Number(c[k])>0).map(([k,cls])=>{const i=h('i.'+cls);i.style.flexGrow=String(c[k]);return i;}));
 const cm=ov.community||{};
 return h('div.tiles',
  h('a.tile',{href:'#/collectors'},h('span.lb','수집기'),h('span.v',num(c.ok),h('small',`/${num(total)} 정상`)),segs,
   h('span.s',[Number(c.failing)&&`실패 ${c.failing}`,Number(c.never)&&`기록 없음 ${c.never}`,Number(c.stale)&&`오래됨 ${c.stale}`,Number(c.manual)&&`수동 ${c.manual}`].filter(Boolean).join(' · ')||'모두 정상')),
  h('a.tile',{href:'#/data'},h('span.lb','레이더 새 변경'),h('span.v',num(ov.radar?.today)),h('span.s',`중요도 2 이상 ${num(ov.radar?.importance2plus)}`)),
  h('a.tile',{href:'#/mod'},h('span.lb','신고 대기'),h('span.v'+(Number(ov.flags?.open)?'.hot':''),num(ov.flags?.open)),h('span.s',Number(ov.flags?.open)?'눌러서 처리':'처리할 신고 없음')),
  h('a.tile',{href:'#/community'},h('span.lb','오늘 글 · 댓글'),h('span.v',num(cm.postsToday),h('small',` · ${num(cm.commentsToday)}`)),h('span.s',`새 가입 ${num(cm.newUsersToday)}명 · 커뮤니티 ›`)));
}
/** @param {any} tr */
function trafficBox(tr){
 const t=trafficTile(tr);
 if(!t)return h('a.tile.wide',{href:'#/traffic'},h('span.lb','방문자 · 오늘'),h('span.s','방문자 통계가 아직 없어요 · 설정 보기 ›'));
 return h('a.tile.wide.traffic',{href:'#/traffic'},
  h('span.lb','방문자 · 오늘',h('span.fine','사람 vs 봇 ›')),
  h('span.tv',h('span',h('i.key.c-human',{'aria-hidden':'true'}),h('b',num(t.human)),h('small',' 사람 페이지뷰')),h('span',h('i.key.c-bot',{'aria-hidden':'true'}),h('b',num(t.bot)),h('small',' 봇 요청'))),
  h('span.s',`AI 봇 ${num(t.ai)}`,t.topBot?` · 가장 많은 봇 ${t.topBot}${t.topBotRequests?` (${num(t.topBotRequests)})`:''}`:''));
}
/** @param {any[]} list @param {number} now */
function statusBox(list,now){
 const items=Array.isArray(list)?list:[];
 if(!items.length)return null;
 return box('AI 서비스 상태','공식 상태 페이지 · 30분마다',h('ul.rows',...items.map(s=>{
  const x=statusState(s.state);
  return h('li',dot(x.tone,x.label),h('span.tt',h('b',s.service),h('span.l2',s.since?`${dayClock(s.since,now)}부터 (${relTime(s.since,now)})`:'',s.url?h('a.ext',{href:s.url,target:'_blank',rel:'noopener noreferrer'},' 상태 페이지'):null)),st(x.tone==='mute'?'mute':x.tone,x.label));
 })));
}
/** @param {any} g */
function graphLine(g){
 if(!g)return null;
 return h('p.fine',`그래프: 엔티티 ${num(g.entities)} · 현재 사실 ${num(g.facts)} · 일정 ${num(g.events)}`);
}
