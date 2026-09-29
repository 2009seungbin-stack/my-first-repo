// @ts-check
/** 데이터 (레이더): fact conflicts (adopt / keep), member proposals (approve / reject) and recent
 * changes (hide / importance). Data: GET /api/v2/admin/radar?cursor=; actions POST /radar/action. */
import {h} from '../lib/dom.js';
import {box,vt,chips,failure,fill,skeleton,empty,confirmSheet,toast} from '../lib/ui.js';
import {dayClock,num,relTime} from '../lib/format.js';

export const title='데이터';
export const tab='data';
/** @type {'all'|'conflicts'|'proposals'|'changes'} */let view='all';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(5));
 let d;
 try{d=await ctx.api.get('/api/v2/admin/radar');}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const conflicts=list(d?.conflicts),proposals=list(d?.proposals),changes=list(d?.changes);
 let next=d?.next||null;
 const now=ctx.now();
 const changeRows=h('ul.rows');
 const more=h('button.btn.sm.morebtn',{type:'button',hidden:!next,onclick:async()=>{
  more.setAttribute('disabled','');more.textContent='불러오는 중…';
  try{const p=await ctx.api.get(`/api/v2/admin/radar?cursor=${encodeURIComponent(next)}`);const add=list(p?.changes);changes.push(...add);changeRows.append(...add.map(c=>changeRow(ctx,c,now)));next=p?.next||null;}
  catch(e){toast('더 불러오지 못했어요');}
  more.removeAttribute('disabled');more.textContent='더 보기';more.hidden=!next;
 }},'더 보기');
 changeRows.append(...changes.map(c=>changeRow(ctx,c,now)));
 const total=Number(d?.counts?.changes)||changes.length;
 const draw=()=>{
  const bar=chips([{value:'all',label:'전체'},{value:'conflicts',label:`충돌 ${conflicts.length}`},{value:'proposals',label:`제안 ${proposals.length}`},{value:'changes',label:`변경 ${num(total)}`}],view,v=>{view=/** @type {any} */(v);draw();},'데이터 보기');
  const show=(/** @type {string} */ k)=>view==='all'||view===k;
  fill(main,bar,
   show('conflicts')?box('사실 충돌','공식 값은 자동으로 바뀌지 않음',conflicts.length?h('div',...conflicts.map(c=>conflictCard(ctx,c))):empty('열린 충돌이 없습니다','자동 수집 값이 공식 값과 다르면 여기에 모입니다.')):null,
   show('proposals')?box('정보 제안','fact_proposals',proposals.length?h('div',...proposals.map(p=>proposalCard(ctx,p,now))):empty('검토할 제안이 없습니다','회원이 출처와 함께 값을 제안하면 여기서 승인(커뮤니티 검증 값으로 반영)하거나 사유를 적어 반려합니다.')):null,
   show('changes')?box('최근 변경',changes.length?`${num(total)}건`:null,changes.length?[changeRows,h('div.pad.center',more)]:empty('최근 변경이 없습니다')):null,
   ctx.stamp(d?.generatedAt));
 };
 draw();
}
/** @param {any} v */
const list=v=>Array.isArray(v)?[...v]:[];
/** A fact value as text. @param {any} v @param {any} [unit] */
export function show(v,unit){
 if(v&&typeof v==='object'&&'value' in v)return show(v.value,v.unit??unit);
 const s=Array.isArray(v)?v.join(', '):typeof v==='boolean'?(v?'예':'아니요'):v===null||v===undefined?'—':typeof v==='object'?JSON.stringify(v):String(v);
 return unit?`${s} ${unit}`:s;
}
const VER=/** @type {Record<string,string>} */({OFFICIAL:'공식',AUTOMATED:'자동 수집',COMMUNITY_VERIFIED:'커뮤니티',ESTIMATED:'추정',REPORTED:'리포트'});
/** @param {any} ctx @param {any} c */
function conflictCard(ctx,c){
 const cur=c.current??{value:c.current_value,verification:c.current_verification},nw=c.proposed??c.new??{value:c.value??c.new_value,verification:c.verification,source:c.source};
 return h('div.cf',
  h('div.meta',vt(c.vertical),h('span',h('b',c.entity||c.name||c.entity_id||'?'),' · ',c.property||'')),
  h('div.vs',h('div',h('span.fine',`현재 · ${VER[cur?.verification]||cur?.verification||'공식'}`),h('b',show(cur))),
   h('div.nw',h('span.fine',`새 값 · ${VER[nw?.verification]||nw?.verification||'자동 수집'}`),h('b',show(nw)),nw?.source||c.adapter?h('span.fine.mono',nw?.source||c.adapter):null)),
  c.note?h('p.fine.warntxt',c.note):null,
  h('div.btns',
   h('button.btn.sm.p',{type:'button',onclick:()=>radarAct(ctx,{kind:'conflict',id:c.id,action:'adopt'},'새 값 채택',`${c.entity||c.name||''} ${c.property||''}을(를) ${show(nw)}로 바꿉니다.`)},'새 값 채택'),
   h('button.btn.sm',{type:'button',onclick:()=>radarAct(ctx,{kind:'conflict',id:c.id,action:'keep'},'현재 값 유지',`현재 값 ${show(cur)}을(를) 유지하고 충돌을 닫습니다.`)},'현재 값 유지')));
}
/** @param {any} ctx @param {any} p @param {number} now */
function proposalCard(ctx,p,now){
 const id=p.id??String(p.target||'').replace(/^proposal:/,'');
 return h('div.flag',
  h('div.meta',vt(p.vertical),h('span',h('b',p.channel||p.entity||'?'),' · ',p.property||''),p.at?h('span.push',relTime(p.at,now)):null),
  h('div.vs',h('div',h('span.fine',`현재 · ${VER[p.current?.verification]||'없음'}`),h('b',p.current?show(p.current):'—')),
   h('div.nw',h('span.fine',`제안 · ${p.author||'회원'}`),h('b',show(p.value,p.unit)),p.source?h('a.fine',{href:p.source,target:'_blank',rel:'noopener nofollow noreferrer'},'출처 열기'):null)),
  p.note?h('p.note',p.note):null,
  h('div.btns',
   h('button.btn.sm.p',{type:'button',onclick:()=>radarAct(ctx,{kind:'proposal',id,action:'approve'},'승인','커뮤니티 검증 값으로 반영합니다. 공식 값은 바뀌지 않아요. 출처를 먼저 확인하세요.')},'승인'),
   h('button.btn.sm',{type:'button',onclick:()=>radarAct(ctx,{kind:'proposal',id,action:'reject'},'반려','제안을 닫습니다. 사유는 제안한 회원에게 보입니다.')},'반려')));
}
/** @param {any} c */
function changeTitle(c){
 if(c.text||c.title)return String(c.text||c.title);
 if(c.summary&&typeof c.summary==='object')return String(c.summary.ko||c.summary.en||'');
 if(typeof c.summary==='string')return c.summary;
 return [c.entity||c.name||c.entity_id,c.property,c.new_value!=null?`→ ${show(c.new_value)}`:''].filter(Boolean).join(' ');
}
/** @param {any} ctx @param {any} c @param {number} now */
function changeRow(ctx,c,now){
 const imp=Number(c.importance);
 return h('li',
  h(`span.imp.i${imp>=2?2:imp>=1?1:0}`,{'aria-label':`중요도 ${imp}`},String(imp)),
  h('span.tt',h('b',changeTitle(c)),c.count>1?h('span.fine',` ×${c.count}`):null,' ',vt(c.vertical),
   h('span.l2',[dayClock(c.detected_at??c.at,now),c.adapter||c.source,c.visibility&&c.visibility!=='public'?({hidden:'숨김',pending:'대기'})[/** @type {'hidden'} */(c.visibility)]||c.visibility:''].filter(Boolean).join(' · '),c.note?h('span.warntxt',` · ${c.note}`):null)),
  h('button.btn.sm',{type:'button','aria-label':`${changeTitle(c)} 조치`,onclick:()=>changeSheet(ctx,c)},'조치'));
}
/** @param {any} ctx @param {any} c */
async function changeSheet(ctx,c){
 const imp=Number(c.importance);
 const done=await confirmSheet({
  title:'이 변경을 어떻게 할까요?',
  body:[h('p.quote',changeTitle(c))],
  choices:{label:'조치',value:'hide',options:[{value:'hide',label:'숨기기'},...[3,2,1,0].filter(n=>n!==imp).map(n=>({value:'imp'+n,label:n?`중요도 ${n}`:'중요도 0 (이력만)'}))]},
  reason:{label:'사유 (처리 기록에 남습니다, 2–500자)',quick:['중복 기록','잘못된 수집','중요하지 않음','중요한 변경']},
  confirm:'적용',
  run:({reason,choice})=>ctx.api.post('/api/v2/admin/radar/action',choice==='hide'?{kind:'change',id:c.id,action:'hide',reason}:{kind:'change',id:c.id,action:'importance',value:Number(choice.slice(3)),reason}),
 });
 if(done){toast('적용했어요');ctx.refresh();}
}
/** @param {any} ctx @param {{kind:string,id:any,action:string}} body @param {string} label @param {string} text */
async function radarAct(ctx,body,label,text){
 const done=await confirmSheet({
  title:`${label} 할까요?`,body:[h('p',text)],
  reason:{label:'사유 (처리 기록에 남습니다, 2–500자)',quick:body.kind==='conflict'?['공식 발표 확인','시간대 차이','자동 수집 오류']:['출처 확인함','출처 없음','값 형식 틀림']},
  confirm:label,danger:body.action==='reject',
  run:({reason})=>ctx.api.post('/api/v2/admin/radar/action',{...body,reason}),
 });
 if(done){toast(`${label} 처리했어요`);ctx.refresh();}
}
