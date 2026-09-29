// @ts-check
/** 수집기 목록: problems on top, then by schedule; manual ones as one compact row. All times KST.
 * Data: GET /api/v2/admin/collectors. Also exports the "지금 실행" confirm sheet. */
import {h} from '../lib/dom.js';
import {box,dot,vt,chips,failure,fill,skeleton,empty,confirmSheet,toast,kv} from '../lib/ui.js';
import {num,relTime,dayClock,clock,hoursSpan} from '../lib/format.js';
import {groupCollectors,filterCollectors,shortError,usageView,rerunIds} from '../lib/model.js';
import {COLLECTOR_STATE,SCHEDULE} from '../lib/labels.js';

export const title='수집기';
export const tab='collectors';
/** @type {'all'|'problem'|'ok'|'manual'} */let filter='all';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(6));
 let data;
 try{data=await ctx.api.get('/api/v2/admin/collectors');}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const items=Array.isArray(data?.items)?data.items:[];
 const now=ctx.now(),g=groupCollectors(items);
 const draw=()=>{
  const bar=chips([{value:'all',label:`전체 ${g.counts.all}`},{value:'problem',label:`문제 ${g.counts.problem}`},{value:'ok',label:`정상 ${g.counts.ok}`},{value:'manual',label:`수동 ${g.counts.manual}`}],filter,v=>{filter=/** @type {any} */(v);draw();},'수집기 거르기');
  if(!items.length){fill(main,bar,box('',null,empty('수집기가 없습니다','collectors 테이블이 비어 있어요. 수집 워크플로가 한 번 실행되면 채워집니다.')),ctx.stamp(data?.generatedAt));return;}
  const ids=rerunIds(items);
  if(filter!=='all'){
   const list=filterCollectors(items,filter);
   fill(main,bar,box('',null,list.length?h('ul.rows',...list.map(c=>row(c,now))):empty('해당하는 수집기가 없습니다')),ctx.stamp(data?.generatedAt));return;
  }
  fill(main,bar,
   g.problems.length?h('section.box.hl',h('div.hd2',h('span',`문제 있음 · ${g.problems.length}`),ids.length?h('button.btn.sm.p',{type:'button',onclick:()=>runSheet(ctx,ids,{usage:ctx.overview?.usage})},`${ids.length}개 다시 실행`):null),h('ul.rows',...g.problems.map(c=>row(c,now)))):null,
   h('section.box',
    ...['30m','6h'].flatMap(k=>g.bySchedule[k].length?[h('div.hd2',h('span',SCHEDULE[k]),h('span',nextOf(g.bySchedule[k]))),h('ul.rows',...g.bySchedule[k].map(c=>row(c,now)))]:[]),
    g.bySchedule.manual.length?[h('div.hd2',h('span',`수동 입력 · ${g.bySchedule.manual.length}`),h('span','자동 실행 안 함')),
     h('ul.rows',h('li.manual',h('span.dotc.idle',{'aria-hidden':'true'}),h('span.tt.mono',...g.bySchedule.manual.flatMap((c,i)=>[i?' · ':'',h('a',{href:`#/collectors/${encodeURIComponent(c.id)}`},c.id)]))))]:null),
   ctx.stamp(data?.generatedAt));
 };
 draw();
}
/** @param {any[]} list */
function nextOf(list){
 const t=list.map(c=>Number(c.next_run_at)||0).filter(Boolean).sort((a,b)=>a-b)[0];
 return t?`다음 ${clock(t)}`:'';
}
/** One collector row (a link to its detail). @param {any} c @param {number} now */
export function row(c,now){
 const s=COLLECTOR_STATE[c.state]||{label:c.state,tone:'mute'};
 let line;
 if(c.state==='failing')line=h('span.l2.badtxt',`${dayClock(c.last_run_at,now)} 실패 · ${shortError(c.last_error)}`);
 else if(c.state==='never')line=h('span.l2','실행 기록 없음',c.freshnessHours?` · 신선도 ${hoursSpan(c.freshnessHours)}`:'');
 else if(c.state==='stale')line=h('span.l2',c.last_success_at?`${dayClock(c.last_success_at,now)} 마지막 성공 · 신선도 ${hoursSpan(c.freshnessHours)} 넘음`:'성공 기록 없음');
 else if(c.state==='manual')line=h('span.l2','수동 입력 · 자동 실행 안 함');
 else line=h('span.l2',[dayClock(c.last_success_at??c.last_run_at,now),c.observations!=null&&`관측 ${num(c.observations)}`,c.changes!=null&&`변경 ${num(c.changes)}`,c.rows_written!=null&&`쓰기 ${num(c.rows_written)}행`].filter(Boolean).join(' · '));
 const problem=c.state==='failing'||c.state==='never'||c.state==='stale';
 const right=problem?(c.next_run_at?h('span.r','다음',h('br'),clock(c.next_run_at)):null):c.state==='manual'?null:h('span.r',relTime(c.last_success_at??c.last_run_at,now));
 return h('li',h('a.rowa',{href:`#/collectors/${encodeURIComponent(c.id)}`},dot(s.tone,s.label),h('span.tt',h('span.mono',h('b',c.id)),' ',vt(c.vertical),line),right));
}

/**
 * "지금 실행" confirm sheet → POST /api/v2/admin/collectors/run. With `single` the sheet offers
 * "이것만" or all problem collectors.
 * @param {any} ctx @param {string[]} ids @param {{usage?:any,single?:string}} [o]
 */
export async function runSheet(ctx,ids,o={}){
 const u=usageView(o.usage);
 const single=o.single||null;
 const choices=single&&ids.length>1&&ids.some(x=>x!==single)?{label:'실행할 수집기',value:'one',options:[{value:'one',label:'이것만'},{value:'all',label:`실패·기록 없음 ${ids.length}개`}]}:null;
 const list=single?[single]:ids;
 const res=await confirmSheet({
  title:list.length===1?`${list[0]}를 지금 실행할까요?`:`${list.length}개 수집기를 지금 실행할까요?`,
  body:[h('p','GitHub Actions의 ',h('b','Nerulio 2.0 collectors'),' 워크플로를 ',h('span.mono',`adapters=${list.length>3?list.slice(0,3).join(',')+'…':list.join(',')}`),'로 실행합니다. 보통 1–3분 뒤 결과가 여기에 표시됩니다.'),
   u?kv(u.period==='month'?[['이번 달 남은 쓰기 포함량',`${num(u.remaining)}행`],['이번 달 사용',`${Math.round(u.ratio*100)}%`]]:[['오늘 남은 쓰기',`${num(u.remaining)}행`],['쓰기 한도',`${Math.round(u.ratio*100)}% 사용`]]):null],
  choices,confirm:'실행',
  run:async({choice})=>ctx.api.post('/api/v2/admin/collectors/run',{adapters:choice==='all'?ids:list}),
 });
 if(!res)return;
 toast('실행을 요청했어요. 1–3분 뒤 새로 고침하세요.',res.runUrl?{action:{label:'GitHub에서 보기',run:()=>window.open(res.runUrl,'_blank','noopener')},ms:8000}:{});
}
