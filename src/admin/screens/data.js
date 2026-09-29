// @ts-check
/** 데이터 (레이더): fact conflicts (adopt / keep), member proposals (approve / reject), new-tag proposals
 * (create the tag / reject) and recent changes (hide / importance). Data: GET /api/v2/admin/radar?cursor=; actions POST /radar/action. */
import {h} from '../lib/dom.js';
import {box,vt,chips,failure,fill,skeleton,empty,confirmSheet,toast} from '../lib/ui.js';
import {dayClock,num,relTime} from '../lib/format.js';

export const title='데이터';
export const tab='data';
/** @type {'all'|'conflicts'|'proposals'|'tags'|'changes'} */let view='all';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(5));
 let d;
 try{d=await ctx.api.get('/api/v2/admin/radar');}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const conflicts=list(d?.conflicts),proposals=list(d?.proposals),tags=list(d?.tags),changes=list(d?.changes);
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
 const total=Number(d?.counts?.changes)||0;
 const changeCount=()=>total?num(total):`${changes.length}${next?'+':''}`;
 const draw=()=>{
  const bar=chips([{value:'all',label:'전체'},{value:'conflicts',label:`충돌 ${conflicts.length}`},{value:'proposals',label:`제안 ${proposals.length}`},{value:'tags',label:`새 태그 ${tags.length}`},{value:'changes',label:`변경 ${changeCount()}`}],view,v=>{view=/** @type {any} */(v);draw();},'데이터 보기');
  const show=(/** @type {string} */ k)=>view==='all'||view===k;
  fill(main,bar,
   show('conflicts')?box('사실 충돌','공식 값은 자동으로 바뀌지 않음',conflicts.length?h('div',...conflicts.map(c=>conflictCard(ctx,c))):empty('열린 충돌이 없습니다','자동 수집 값이 공식 값과 다르면 여기에 모입니다.')):null,
   show('proposals')?box('정보 제안','fact_proposals',proposals.length?h('div',...proposals.map(p=>proposalCard(ctx,p,now))):empty('검토할 제안이 없습니다','회원이 출처와 함께 값을 제안하면 여기서 승인(커뮤니티 검증 값으로 반영)하거나 사유를 적어 반려합니다.')):null,
   show('tags')?box('새 태그 제안','고정닉이 요청한 태그',tags.length?h('div',...tags.map(t=>tagCard(ctx,t,now))):empty('검토할 태그 제안이 없습니다','회원이 글쓰기에서 없는 태그를 제안하면 여기서 종류를 골라 만들어요.')):null,
   show('changes')?box('최근 변경',changes.length?`${changeCount()}건`:null,changes.length?[changeRows,h('div.pad.center',more)]:empty('최근 변경이 없습니다')):null,
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
/** Channel name with a link to it (opens the public page). @param {any} x */
const channelOf=x=>{const name=x.channel||x.entity||x.name||x.entity_id||'?';return x.url?h('a.chn',{href:x.url,target:'_blank',rel:'noopener'},name):h('b',name);};
/** @param {any} ctx @param {any} c */
function conflictCard(ctx,c){
 const cur=c.current??{value:c.current_value,verification:c.current_verification},nw=c.proposed??c.new??{value:c.value??c.new_value,verification:c.verification,source:c.source};
 const unit=cur?.unit??null,prop=c.label||c.property||'';
 const nwText=show(nw?.value,nw?.unit??unit);
 return h('div.cf',
  h('div.meta',vt(c.vertical),h('span',channelOf(c),' · ',prop,c.region&&c.region!=='*'?` (${c.region})`:'')),
  h('div.vs',h('div',h('span.fine',`현재 · ${VER[cur?.verification]||cur?.verification||'공식'}`),h('b',show(cur?.value,unit))),
   h('div.nw',h('span.fine',`새 값 · ${VER[nw?.verification]||nw?.verification||'자동 수집'}`),h('b',nwText),nw?.source||c.adapter?h('span.fine.mono',String(nw?.source||c.adapter).replace(/^src:/,'')):null)),
  c.note?h('p.fine.warntxt',c.note):null,
  cur&&cur.isCurrent===false?h('p.fine.warntxt','현재 값이 그 뒤에 바뀌어 이 충돌은 오래됐어요. 현재 값 유지로 닫으세요.'):null,
  h('div.btns',
   h('button.btn.sm.p',{type:'button',disabled:cur?.isCurrent===false,onclick:()=>radarAct(ctx,{kind:'conflict',id:c.id,action:'adopt'},'새 값 채택',`${c.channel||c.entity||''} ${prop}을(를) ${nwText}(으)로 바꿉니다. 레이더에 변경으로 기록돼요.`)},'새 값 채택'),
   h('button.btn.sm',{type:'button',onclick:()=>radarAct(ctx,{kind:'conflict',id:c.id,action:'keep'},'현재 값 유지',`현재 값 ${show(cur?.value,unit)}을(를) 유지하고 충돌을 닫습니다.`)},'현재 값 유지')));
}
/** A new-tag proposal: the owner picks what kind of thing it is (in the channel's area) and creates it.
 * @param {any} ctx @param {any} t @param {number} now */
function tagCard(ctx,t,now){
 const types=Array.isArray(t.types)?t.types:[];
 const pick=h('select',{'aria-label':'태그 종류'},...types.map((/** @type {any} */ x)=>h('option',{value:x.id},x.label)));
 return h('div.flag',
  h('div.meta',h('a.chn',{href:t.url,target:'_blank',rel:'noopener'},t.channel),h('span',`${t.author||'회원'}`),t.created_at?h('span.push',relTime(t.created_at,now)):null),
  h('div.vs',h('div.nw',h('span.fine','새 태그'),h('b',t.name),t.source?h('a.fine',{href:t.source,target:'_blank',rel:'noopener nofollow noreferrer'},'출처 열기'):null)),
  t.note?h('p.note',t.note):null,
  types.length?h('label.fine','종류 ',pick):h('p.fine.warntxt','이 채널은 태그 종류가 없어 만들 수 없어요. 반려해 주세요.'),
  h('div.btns',
   h('button.btn.sm.p',{type:'button',disabled:!types.length,onclick:()=>radarAct(ctx,{kind:'tag',id:t.id,action:'approve',value:/** @type {HTMLSelectElement} */(pick).value},'태그 만들기',`“${t.name}” 태그를 만듭니다. 검색에 바로 나오고, 사실 정보가 모이기 전까지 검색엔진 색인에서는 빠져요.`)},'태그 만들기'),
   h('button.btn.sm',{type:'button',onclick:()=>radarAct(ctx,{kind:'tag',id:t.id,action:'reject'},'반려','제안을 닫습니다. 사유는 처리 기록에 남아요.')},'반려')));
}
/** @param {any} ctx @param {any} p @param {number} now */
function proposalCard(ctx,p,now){
 const id=p.id??String(p.target||'').replace(/^proposal:/,'');
 // current: a bare value (admin API) or {value,unit,verification} (moderation queue shape).
 const cur=p.current&&typeof p.current==='object'&&'value' in p.current?p.current:p.current==null?null:{value:p.current,unit:p.unit};
 const at=p.created_at??p.at;
 return h('div.flag',
  h('div.meta',vt(p.vertical),h('span',channelOf(p),' · ',p.label||p.property||''),at?h('span.push',relTime(at,now)):null),
  h('div.vs',h('div',h('span.fine',`현재${cur?.verification?' · '+(VER[cur.verification]||cur.verification):''}`),h('b',cur?show(cur.value,cur.unit??p.unit):'—')),
   h('div.nw',h('span.fine',`제안 · ${p.author||'회원'}`),h('b',show(p.value,p.unit)),p.source?h('a.fine',{href:p.source,target:'_blank',rel:'noopener nofollow noreferrer'},'출처 열기'):null)),
  p.note?h('p.note',p.note):null,
  h('div.btns',
   h('button.btn.sm.p',{type:'button',onclick:()=>radarAct(ctx,{kind:'proposal',id,action:'approve'},'승인','커뮤니티 검증 값으로 반영합니다. 공식 값은 바뀌지 않아요. 출처를 먼저 확인하세요.')},'승인'),
   h('button.btn.sm',{type:'button',onclick:()=>radarAct(ctx,{kind:'proposal',id,action:'reject'},'반려','제안을 닫습니다. 사유는 처리 기록에 남아요.')},'반려')));
}
/** @param {any} c */
function changeTitle(c){
 if(c.text||c.title)return String(c.text||c.title);
 if(c.summary&&typeof c.summary==='object')return String(c.summary.ko||c.summary.en||'');
 if(typeof c.summary==='string')return c.summary;
 return [c.channel||c.entity||c.name||c.entity_id,c.property,c.new_value!=null?`→ ${show(c.new_value)}`:''].filter(Boolean).join(' ');
}
const VIS=/** @type {Record<string,string>} */({hidden:'숨김',pending:'승인 대기'});
/** @param {any} ctx @param {any} c @param {number} now */
function changeRow(ctx,c,now){
 const imp=Number(c.importance),title=changeTitle(c);
 return h('li'+(c.visibility==='hidden'?'.dim':''),
  h(`span.imp.i${imp>=2?2:imp>=1?1:0}`,{'aria-label':`중요도 ${imp}`},String(imp)),
  h('span.tt',c.url?h('a.chn',{href:c.url,target:'_blank',rel:'noopener'},h('b',title)):h('b',title),c.count>1?h('span.fine',` ×${c.count}`):null,' ',vt(c.vertical),
   c.detail?h('span.l2',String(c.detail)):null,
   h('span.l2',[dayClock(c.detected_at??c.at,now),c.adapter||(c.source?String(c.source).replace(/^src:/,''):''),VIS[c.visibility]||''].filter(Boolean).join(' · '),c.note?h('span.warntxt',` · ${c.note}`):null)),
  h('button.btn.sm',{type:'button','aria-label':`${title} 조치`,onclick:()=>changeSheet(ctx,c)},'조치'));
}
/** @param {any} ctx @param {any} c */
async function changeSheet(ctx,c){
 const imp=Number(c.importance);
 const done=await confirmSheet({
  title:'이 변경을 어떻게 할까요?',
  body:[h('p.quote',changeTitle(c))],
  choices:{label:'조치',value:c.visibility==='public'||!c.visibility?'hide':'approve',options:[...(c.visibility==='public'||!c.visibility?[{value:'hide',label:'숨기기'}]:[{value:'approve',label:'공개'}]),...[3,2,1,0].filter(n=>n!==imp).map(n=>({value:'imp'+n,label:n?`중요도 ${n}`:'중요도 0 (이력만)'}))]},
  reason:{label:'사유 (처리 기록에 남습니다, 2–500자)',quick:['중복 기록','잘못된 수집','중요하지 않음','중요한 변경']},
  confirm:'적용',
  run:({reason,choice})=>ctx.api.post('/api/v2/admin/radar/action',choice==='hide'||choice==='approve'?{kind:'change',id:c.id,action:choice,reason}:{kind:'change',id:c.id,action:'importance',value:Number(choice.slice(3)),reason}),
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
