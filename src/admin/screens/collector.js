// @ts-check
/** 수집기 상세: state, last error with plain-Korean advice, recent runs, "지금 실행".
 * Data: GET /api/v2/admin/collectors (the row) + /collectors/:id/runs?limit=20. */
import {h} from '../lib/dom.js';
import {box,st,vt,failure,fill,skeleton,empty,kv} from '../lib/ui.js';
import {num,relTime,dateTime,dayClock,shortDate,clockSec,hoursSpan,duration} from '../lib/format.js';
import {errorAdvice,rerunIds} from '../lib/model.js';
import {COLLECTOR_STATE,VERTICALS,SCHEDULE} from '../lib/labels.js';
import {runSheet} from './collectors.js';

export const title='수집기';
export const tab='collectors';
export const back='#/collectors';

/** @param {any} ctx @param {HTMLElement} main @param {{id:string}} params */
export async function render(ctx,main,params){
 const id=params.id;
 ctx.setTitle(id,{mono:true});
 fill(main,skeleton(4));
 let list,runs;
 try{[list,runs]=await Promise.all([ctx.api.get('/api/v2/admin/collectors'),ctx.api.get(`/api/v2/admin/collectors/${encodeURIComponent(id)}/runs?limit=20`).catch((/** @type {any} */ e)=>({error:e}))]);}
 catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const items=Array.isArray(list?.items)?list.items:[];
 const c=items.find((/** @type {any} */ x)=>String(x.id)===id);
 if(!c){fill(main,box('',null,empty('이 수집기를 찾을 수 없습니다',`"${id}"는 collectors 목록에 없어요.`,h('a.btn.sm',{href:'#/collectors'},'목록으로'))));return;}
 const s=COLLECTOR_STATE[c.state]||{label:c.state,tone:'mute'};
 ctx.setBadge(st(s.tone==='idle'?'mute':s.tone,s.label));
 const now=ctx.now(),manual=c.state==='manual'||c.mode==='manual';
 const runItems=Array.isArray(runs?.items)?runs.items:[];
 const lastRun=runItems[0];
 fill(main,
  box('',null,h('div.pad',kv([
   ['분야',VERTICALS[c.vertical]?vt(c.vertical):c.vertical],
   ['실행 방식',manual?'수동 입력':SCHEDULE[c.schedule]||c.schedule||'—'],
   ['마지막 성공',c.last_success_at?`${dateTime(c.last_success_at)} (${relTime(c.last_success_at,now)})`:'없음'],
   ['마지막 시도',c.last_run_at?`${shortDate(c.last_run_at)} ${clockSec(c.last_run_at)}`:'없음'],
   ['연속 실패',c.consecutive_failures!=null?h('span'+(Number(c.consecutive_failures)?'.badtxt.b':''),`${num(c.consecutive_failures)}회`):null],
   ['신선도 기준',hoursSpan(c.freshnessHours)],
   ['다음 예약',c.next_run_at?`${dayClock(c.next_run_at,now)} (${relTime(c.next_run_at,now)})`:manual?'자동 실행 안 함':'—'],
   ['마지막 실행 결과',lastRun?[lastRun.observations!=null&&`관측 ${num(lastRun.observations)}`,lastRun.changes!=null&&`변경 ${num(lastRun.changes)}`,lastRun.rows_written!=null&&`쓰기 ${num(lastRun.rows_written)}행`].filter(Boolean).join(' · ')||null:null],
  ]))),
  c.last_error?box('마지막 오류',c.last_run_at?dayClock(c.last_run_at,now):null,h('div.pad',h('pre.err',String(c.last_error)),errorAdvice(c.last_error)?h('p.advice',errorAdvice(c.last_error)):null)):null,
  runsBox(runs,runItems,now),
  h('div.btns.sticky-actions',
   manual?h('p.fine','수동 입력 수집기는 자동으로 실행하지 않아요. 시드 파일을 고친 뒤 배포하면 반영됩니다.')
    :h('button.btn.p',{type:'button',onclick:()=>runSheet(ctx,rerunIds(items).includes(id)?rerunIds(items):[id],{usage:ctx.overview?.usage,single:id})},'지금 실행')),
  ctx.stamp(list?.generatedAt));
}
/** @param {any} runs @param {any[]} items @param {number} now */
function runsBox(runs,items,now){
 if(runs?.error)return box('최근 실행',null,failure(runs.error,null));
 if(!items.length)return box('최근 실행','collector_runs',empty('실행 기록 0건','쓰기 한도에 걸리면 실행 기록 자체가 남지 않을 수 있어, 홈에서는 "기록 없음"도 문제로 셉니다.'));
 return box('최근 실행',`${items.length}건`,h('ul.rows',...items.map(r=>h('li',
  h('span.dotw',h(`span.dotc.${r.status==='error'||(!r.status&&r.error)?'bad':r.status==='partial'?'warn':r.status==='running'?'idle':'ok'}`,{'aria-hidden':'true'}),h('span.sr-only',({error:'실패',partial:'일부 실패',running:'실행 중',ok:'성공'})[/** @type {'ok'} */(r.status)]||(r.error?'실패':'성공'))),
  h('span.tt',h('b',`${dayClock(r.started_at,now)}`),r.finished_at?h('span.fine',` · ${duration(r.started_at,r.finished_at)}`):h('span.fine',' · 실행 중'),
   h('span.l2',[r.observations!=null&&`관측 ${num(r.observations)}`,r.changes!=null&&`변경 ${num(r.changes)}`,r.rows_written!=null&&`쓰기 ${num(r.rows_written)}행`,r.queries!=null&&`쿼리 ${num(r.queries)}`].filter(Boolean).join(' · ')),
   r.error?h('span.l2.badtxt',String(r.error).slice(0,160)):null),
  h('span.r',relTime(r.started_at,now))))));
}
