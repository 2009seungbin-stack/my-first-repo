// @ts-check
/** 방문자 (봇/사람): human pageviews vs bot requests, bots by category with a verified badge, top
 * pages for each, the hourly/daily series, and what the Worker cannot see.
 * Data: GET /api/v2/admin/traffic?range=today|7d|30d (TRAFFIC agent; 503 NOT_CONFIGURED → 설정 필요). */
import {h} from '../lib/dom.js';
import {box,st,seg,chips,failure,fill,skeleton,empty} from '../lib/ui.js';
import {columns,shareBar,hbars} from '../lib/charts.js';
import {num,pct} from '../lib/format.js';
import {trafficView} from '../lib/model.js';
import {BOT_CATEGORIES} from '../lib/labels.js';

export const title='방문자';
export const tab='traffic';
/** @type {'today'|'7d'|'30d'} */let range='today';
let category='all';
/** @type {'human'|'bot'} */let pages='human';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 const rangeBar=()=>seg([{value:'today',label:'오늘'},{value:'7d',label:'7일'},{value:'30d',label:'30일'}],range,v=>{range=/** @type {any} */(v);ctx.refresh();},'기간');
 fill(main,rangeBar(),skeleton(5));
 let t;
 try{t=await ctx.api.get(`/api/v2/admin/traffic?range=${range}`);}catch(e){fill(main,rangeBar(),failure(e,()=>ctx.refresh(),'TRAFFIC'));return;}
 const v=trafficView(t);
 const draw=()=>{
  const cats=Object.keys(BOT_CATEGORIES).filter(k=>v.byCategory[k]);
  const bots=category==='all'?v.bots:v.bots.filter(b=>b.category===category);
  fill(main,rangeBar(),
   v.coverage.workerSeesHtml?null:h('div.note-box',{role:'note'},h('b','일부만 집계돼요'),h('p',v.coverage.note||'정적 HTML은 Worker를 거치지 않아 봇 요청이 빠질 수 있어요. 사람 수는 페이지 안 신호로 셉니다.')),
   box(range==='today'?'오늘 사람 vs 봇':range==='7d'?'최근 7일 사람 vs 봇':'최근 30일 사람 vs 봇',null,h('div.pad',
    h('div.duo',
     h('div',h('span.lb',h('i.key.c-human',{'aria-hidden':'true'}),'사람 페이지뷰'),h('span.big',num(v.pageviews)),h('span.fine',v.visitors!=null?`방문자 ${num(v.visitors)}명`:`사람 요청 ${num(v.human)}`)),
     h('div',h('span.lb',h('i.key.c-bot',{'aria-hidden':'true'}),'봇 요청'),h('span.big',num(v.bot)),h('span.fine',`전체 요청의 ${pct(v.bot,v.all)}`))),
    shareBar(v.human,v.bot),
    h('dl.kv.small',h('dt','확인된 봇'),h('dd',num(v.verified)),h('dt','자칭 봇 (UA만)'),h('dd',num(v.declared)),h('dt','봇 의심'),h('dd',num(v.suspected))))),
   box(range==='today'?'시간별':'일별',null,h('div.pad',v.series.length?columns(v.series,range):empty('아직 기록이 없습니다')) ),
   box('봇',`${v.bots.length}종`,
    cats.length?h('div.pad.tight',chips([{value:'all',label:'전체'},...cats.map(k=>({value:k,label:`${BOT_CATEGORIES[k]} ${num(v.byCategory[k])}`}))],category,x=>{category=x;draw();},'봇 분류')):null,
    bots.length?h('ul.rows',...bots.slice(0,40).map(b=>{const bar=h('i.c-bot');bar.style.width=(b.requests/(v.maxBot||1)*100)+'%';
     return h('li',h('span.tt',h('b',b.name),' ',h('span.vt.cat',BOT_CATEGORIES[b.category]||b.category),' ',b.verified?st('ok','확인됨'):st('mute','미확인'),h('span.tr.botbar',{'aria-hidden':'true'},bar)),h('span.r',num(b.requests)));})):empty('봇 요청이 없습니다')),
   box('많이 본 페이지',null,
    h('div.pad.tight',seg([{value:'human',label:'사람'},{value:'bot',label:'봇'}],pages,x=>{pages=/** @type {any} */(x);draw();},'페이지 기준')),
    v.topPages[pages].length?h('div.pad',hbars(v.topPages[pages].slice(0,15).map((/** @type {any} */ p)=>({label:h('span.mono.path',String(p.path)),value:Number(p.n)||0,cls:pages==='bot'?'c-bot':'c-human'})))):empty('기록된 페이지가 없습니다')),
   h('p.fine','확인된 봇: 검색·AI 회사가 공개한 주소나 Cloudflare 검증으로 확인한 봇. 미확인: 이름만 봇이라고 밝힌 요청.'),
   ctx.stamp(t?.generatedAt));
 };
 draw();
}
