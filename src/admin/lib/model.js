// @ts-check
/** Derived state for the admin screens: grouping, counts, alerts, notification prefs, traffic
 * shares. Pure functions of API payloads (shapes: ADMIN-CONTRACT.md), tested in Node. */
import {toMs} from './format.js';

const PROBLEM=/** @type {Record<string,number>} */({failing:0,stale:1,never:2});
/** @param {any} c */
export const isProblem=c=>c&&c.state in PROBLEM;

/** Collectors split the way the list shows them: problems first (failing → stale → never, the most
 * recent attempt first), then healthy ones by schedule, manual ones last.
 * @param {any[]} items */
export function groupCollectors(items){
 const list=Array.isArray(items)?items:[];
 const problems=list.filter(isProblem).sort((a,b)=>PROBLEM[a.state]-PROBLEM[b.state]||(toMs(b.last_run_at)||0)-(toMs(a.last_run_at)||0)||String(a.id).localeCompare(String(b.id)));
 /** @type {Record<string,any[]>} */const bySchedule={'30m':[],'6h':[],manual:[]};
 for(const c of list){
  if(isProblem(c))continue;
  const k=c.state==='manual'||c.mode==='manual'||c.schedule==='manual'?'manual':c.schedule==='30m'?'30m':'6h';
  bySchedule[k].push(c);
 }
 for(const k of Object.keys(bySchedule))bySchedule[k].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const counts={all:list.length,problem:problems.length,ok:list.filter(c=>c.state==='ok').length,manual:list.filter(c=>c.state==='manual'||c.mode==='manual').length};
 return {problems,bySchedule,counts};
}
/** @param {any[]} items @param {'all'|'problem'|'ok'|'manual'} filter */
export function filterCollectors(items,filter){
 const list=Array.isArray(items)?items:[];
 if(filter==='problem')return list.filter(isProblem);
 if(filter==='ok')return list.filter(c=>c.state==='ok');
 if(filter==='manual')return list.filter(c=>c.state==='manual'||c.mode==='manual');
 return list;
}
/** Ids "다시 실행" should cover: failing, stale and never-run automatic collectors. @param {any[]} items */
export const rerunIds=items=>(Array.isArray(items)?items:[]).filter(c=>isProblem(c)&&c.mode!=='manual').map(c=>String(c.id));

/** The red card at the top of 홈, or null when nothing needs attention.
 * @param {any} ov overview payload @param {number} [now] */
export function homeAlert(ov,now=Date.now()){
 if(!ov)return null;
 const c=ov.collectors||{},items=/** @type {any[]} */(Array.isArray(c.items)?c.items:[]);
 const failing=items.filter(x=>x.state==='failing');
 const u=usageView(ov.usage);
 const down=/** @type {any[]} */(Array.isArray(ov.status)?ov.status:[]).filter(s=>/major|outage|critical|down/i.test(String(s.state)));
 const parts=[];
 if(failing.length||Number(c.failing)>0){
  const first=failing[0];
  parts.push({title:first?`${first.id} 실패`:`수집기 ${c.failing}개 실패`,body:first?.last_error?shortError(first.last_error):'',at:first?.last_run_at??null});
 }
 const never=Number(c.never)||items.filter(x=>x.state==='never').length,stale=Number(c.stale)||items.filter(x=>x.state==='stale').length;
 if(never||stale)parts.push({title:'',body:[never&&`${never}개 수집기는 실행 기록이 없습니다.`,stale&&`${stale}개 수집기 값이 신선도 기준보다 오래됐습니다.`].filter(Boolean).join(' '),at:null});
 if(u&&u.level!=='ok')parts.push(u.period==='month'
  ?{title:`이번 달 D1 쓰기 ${Math.round(u.ratio*100)}%`,body:u.level==='bad'?'월 포함량을 넘었습니다. 넘은 만큼 요금이 붙습니다.':'월 포함량에 가까워지고 있습니다.',at:null}
  :{title:`D1 쓰기 ${Math.round(u.ratio*100)}%`,body:u.level==='bad'?'오늘 무료 쓰기 한도에 닿았습니다. 09:00(KST)에 초기화됩니다.':'무료 쓰기 한도(하루 100,000행)에 가까워지고 있습니다.',at:null});
 for(const s of down)parts.push({title:`${s.service} 장애`,body:'공식 상태 페이지 기준',at:s.since??null});
 if(!parts.length)return null;
 const ids=rerunIds(items);
 return {parts,rerun:ids,at:parts.find(p=>p.at)?.at??null,now,dailyReset:!!u&&u.period==='day'};
}
/** A one-line summary of a long collector error; the D1 write limit gets plain words.
 * @param {string} e */
export function shortError(e){
 const s=String(e||'');
 if(/row write limit|exceeded D1's free tier/i.test(s))return 'D1 무료 쓰기 한도 초과';
 if(/row read limit/i.test(s))return 'D1 무료 읽기 한도 초과';
 if(/\b(429|rate limit)/i.test(s))return '상대 사이트가 요청을 제한함 (429)';
 if(/\b(5\d\d)\b/.test(s)&&/fetch|http|status/i.test(s))return `상대 사이트 오류 (${/\b(5\d\d)\b/.exec(s)?.[1]})`;
 if(/timed? ?out|timeout|aborted/i.test(s))return '응답 시간 초과';
 const line=s.replace(/^\w+:\s*/,'').split('\n')[0];
 return line.length>90?line.slice(0,88)+'…':line;
}
/** Plain-Korean advice under the raw error on the collector screen. @param {string} e */
export function errorAdvice(e){
 const s=String(e||'');
 if(/row write limit|exceeded D1's free tier/i.test(s))return '무료 요금제의 하루 쓰기 10만 행을 넘었습니다. 한도는 매일 09:00(KST)에 초기화되니 그 뒤에 다시 실행할 수 있습니다.';
 if(/\b429\b|rate limit/i.test(s))return '상대 사이트가 너무 잦은 요청을 막았습니다. 다음 예약 실행까지 기다리는 편이 안전합니다.';
 if(/timed? ?out|timeout|aborted/i.test(s))return '상대 사이트가 제때 응답하지 않았습니다. 일시적인 경우가 많아 다시 실행해 볼 수 있습니다.';
 if(/parse|selector|unexpected token|schema/i.test(s))return '상대 페이지의 형식이 바뀌었을 수 있습니다. 수집기 코드를 확인해야 할 수 있습니다.';
 return '';
}

/** D1 usage → meter values; null when the API has none. Two shapes (coordinator, 2026-09-29):
 *  - Workers Paid: {plan:'paid',period:'month',today,month,included:{rowsReadMonth,rowsWrittenMonth},limit,days}
 *    → the meter is month-to-date against the monthly included amount (overage is billed, not blocked).
 *  - Free / old: {today,limit:{rowsRead,rowsWritten},days} → today against the daily limit.
 * @param {any} u */
export function usageView(u){
 if(!u||typeof u!=='object'||(!u.today&&!u.month))return null;
 const monthly=u.period==='month'||!!u.month||!!u.included;
 const t={w:Number(u.today?.rowsWritten)||0,r:Number(u.today?.rowsRead)||0};
 const cur=monthly?u.month||u.today||{}:u.today||{};
 const limitW=Number(monthly?u.included?.rowsWrittenMonth??u.limit?.rowsWritten:u.limit?.rowsWritten)||(monthly?50_000_000:100_000);
 const limitR=Number(monthly?u.included?.rowsReadMonth??u.limit?.rowsRead:u.limit?.rowsRead)||(monthly?25_000_000_000:5_000_000);
 const w=Number(cur.rowsWritten)||0,r=Number(cur.rowsRead)||0,ratio=w/limitW;
 return {period:monthly?'month':'day',plan:String(u.plan||(monthly?'paid':'free')),written:w,read:r,limitW,limitR,ratio,readRatio:r/limitR,remaining:Math.max(0,limitW-w),
  level:ratio>=1?'bad':ratio>=0.8?'warn':'ok',today:t,days:Array.isArray(u.days)?u.days:[]};
}

/** Tab badges from the overview. @param {any} ov */
export function badges(ov){
 if(!ov)return {collectors:0,mod:0,data:0};
 const c=ov.collectors||{};
 return {collectors:(Number(c.failing)||0)+(Number(c.stale)||0)+(Number(c.never)||0),mod:Number(ov.flags?.open)||0,data:Number(ov.radar?.conflicts)||0};
}

/** Notification preferences (contract `prefs`). */
export const DEFAULT_PREFS=Object.freeze({collectorFailN:1,statusStale:true,usageThresholds:[80,90,95],flags:'instant',aiIncident:true,proposals:false,newUsers:false,quiet:{from:'23:00',to:'07:00'}});
const HHMM=/^([01]\d|2[0-3]):[0-5]\d$/;
/** Anything → a valid prefs object (unknown fields dropped, bad values replaced by defaults).
 * @param {any} p */
export function normalizePrefs(p){
 const d=DEFAULT_PREFS,o=p&&typeof p==='object'?p:{};
 const n=Number(o.collectorFailN);
 const th=Array.isArray(o.usageThresholds)?[...new Set(/** @type {number[]} */(o.usageThresholds.map(Number)).filter(x=>x===80||x===90||x===95))].sort((a,b)=>a-b):[...d.usageThresholds];
 const q=o.quiet===null?null:o.quiet&&HHMM.test(o.quiet.from)&&HHMM.test(o.quiet.to)?{from:o.quiet.from,to:o.quiet.to}:{...d.quiet};
 return {
  collectorFailN:n===1||n===2||n===3?n:d.collectorFailN,
  statusStale:typeof o.statusStale==='boolean'?o.statusStale:d.statusStale,
  usageThresholds:th,
  flags:o.flags==='instant'||o.flags==='hourly'||o.flags==='off'?o.flags:d.flags,
  aiIncident:typeof o.aiIncident==='boolean'?o.aiIncident:d.aiIncident,
  proposals:typeof o.proposals==='boolean'?o.proposals:d.proposals,
  newUsers:typeof o.newUsers==='boolean'?o.newUsers:d.newUsers,
  quiet:q,
 };
}

/** Traffic payload (server/traffic.js mapTraffic) → what the 방문자 screen draws. Bot rows are
 * verified (확인됨), declared (자칭: says it is a bot, cannot be verified — e.g. GPTBot, ClaudeBot,
 * Yeti) or suspected (의심: automation that does not say so). @param {any} t */
export function trafficView(t){
 const tot=t?.totals||{};
 const human=Number(tot.human)||0,verified=Number(tot.verifiedBot)||0,declared=Number(tot.declaredBot)||0,suspected=Number(tot.suspectedBot)||0;
 const bot=verified+declared+suspected,all=human+bot;
 /** @typedef {{name:string,category:string,verified:boolean,suspected:boolean,requests:number,cls:'verified'|'declared'|'suspected'}} BotRow */
 const bots=/** @type {BotRow[]} */((Array.isArray(t?.bots)?t.bots:[]).map((/** @type {any} */ b)=>({name:String(b.name||'?'),category:String(b.category||'other'),verified:!!b.verified,suspected:!b.verified&&!!b.suspected,requests:Number(b.requests)||0}))
  .map((/** @type {any} */ b)=>({...b,cls:b.verified?'verified':b.suspected?'suspected':'declared'})).sort((/** @type {any} */ a,/** @type {any} */ b)=>b.requests-a.requests));
 /** @type {Record<string,number>} */const byCategory={};
 for(const b of bots)byCategory[b.category]=(byCategory[b.category]||0)+b.requests;
 const series=(Array.isArray(t?.series)?t.series:[]).map((/** @type {any} */ s)=>({t:s.t,human:Number(s.human)||0,bot:Number(s.bot)||0}));
 const hu=t?.humans||{};
 /** @param {any} o @returns {{key:string,n:number}[]} */
 const pairs=o=>Array.isArray(o)?o.map(x=>({key:String(x.country??x.key??x.name??'?'),n:Number(x.n)||0})):o&&typeof o==='object'?Object.entries(o).map(([key,n])=>({key,n:Number(n)||0})):[];
 const sortDesc=(/** @type {{key:string,n:number}[]} */ a)=>a.filter(x=>x.n>0).sort((x,y)=>y.n-x.n);
 const cov=t?.coverage||{};
 return {human,bot,verified,declared,suspected,all,botShare:all?bot/all:0,pageviews:Number(hu.pageviews)||0,visitors:hu.visitors==null?null:Number(hu.visitors),unconfirmed:Number(hu.unconfirmed)||0,
  aiBotRequests:t?.aiBotRequests==null?bots.filter(b=>b.category==='ai').reduce((n,b)=>n+b.requests,0):Number(t.aiBotRequests)||0,
  breakdown:{sources:sortDesc(pairs(hu.sources)),devices:sortDesc(pairs(hu.devices)),browsers:sortDesc(pairs(hu.browsers)),locales:sortDesc(pairs(hu.locales)),countries:sortDesc(pairs(hu.countries))},
  bots,byCategory,maxBot:bots[0]?.requests||0,series,topPages:{human:Array.isArray(t?.topPages?.human)?t.topPages.human:[],bot:Array.isArray(t?.topPages?.bot)?t.topPages.bot:[]},
  coverage:{workerSeesHtml:cov.workerSeesHtml!==false,note:String(cov.note||''),recording:cov.recording!==false,seen:Array.isArray(cov.seen)?cov.seen.map(String):[],unseen:Array.isArray(cov.unseen)?cov.unseen.map(String):[]}};
}
/** The overview's compact traffic block → tile text parts. @param {any} tr */
export function trafficTile(tr){
 if(!tr)return null;
 const top=tr.topBot,topName=typeof top==='string'?top:top&&typeof top==='object'?String(top.name||''):'';
 return {human:Number(tr.humanPageviews)||0,bot:Number(tr.botRequests)||0,ai:Number(tr.aiBotRequests)||0,topBot:topName,topBotRequests:top&&typeof top==='object'?Number(top.requests)||0:null};
}
