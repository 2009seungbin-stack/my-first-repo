// @ts-check
/** 신고 처리: the existing moderation queue (GET /api/v2/mod/queue, POST /api/v2/mod/action).
 * Every action goes through a confirm sheet with a reason (2–500 chars, kept in the public log). */
import {h} from '../lib/dom.js';
import {box,st,chips,failure,fill,skeleton,empty,confirmSheet,toast} from '../lib/ui.js';
import {relTime,dayClock,num} from '../lib/format.js';
import {FLAG_REASONS,MOD_ACTIONS,TARGET_KIND,QUICK_REASONS} from '../lib/labels.js';

export const title='신고 처리';
export const tab='mod';
/** @type {'open'|'hidden'|'log'} */let view='open';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(4));
 let q;
 try{q=await ctx.api.get('/api/v2/mod/queue');}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const items=/** @type {any[]} */(Array.isArray(q?.items)?q.items:[]),hidden=/** @type {any[]} */(Array.isArray(q?.hidden)?q.hidden:[]),log=/** @type {any[]} */(Array.isArray(q?.log)?q.log:[]);
 const now=ctx.now();
 const draw=()=>{
  const bar=chips([{value:'open',label:`대기 ${items.length}`},{value:'hidden',label:`임시조치 중 ${hidden.length}`},{value:'log',label:'처리 기록'}],view,v=>{view=/** @type {any} */(v);draw();},'신고 보기');
  let body;
  if(view==='open')body=box('',null,items.length?h('div',...items.map(it=>flagCard(ctx,it,now))):empty('처리할 신고가 없습니다','게시판에 신고가 들어오면 여기에 모이고, 알림을 켜 두면 새 신고를 바로 알려 드립니다.'));
  else if(view==='hidden')body=box('임시조치 중','공개 페이지에서 보이지 않음',hidden.length?h('div',...hidden.map(it=>hiddenCard(ctx,it,now))):empty('숨겨진 글·댓글이 없습니다'));
  else body=box('최근 처리 기록','moderation_actions',log.length?h('ul.rows',...log.map(l=>h('li',h('span.tt',`${MOD_ACTIONS[l.action]||l.action} · ${TARGET_KIND[l.target_kind]||l.target_kind}`,h('span.l2',l.reason?`"${l.reason}"`:'',l.label?` · ${l.label}`:'')),h('span.r',dayClock(l.created_at,now))))):empty('아직 처리 기록이 없습니다'));
  fill(main,bar,body,ctx.stamp(null));
 };
 draw();
}
/** @param {any} it */
const kindOf=it=>String(it.target||'').split(':')[0];
/** @param {string} k */
const kindTag=k=>k==='discussion'?st('o','글'):k==='comment'?st('mute','댓글'):st('est',TARGET_KIND[k]||k);

/** @param {any} ctx @param {any} it @param {number} now */
function flagCard(ctx,it,now){
 const k=kindOf(it),content=k==='discussion'||k==='comment';
 const reasons=(Array.isArray(it.reasons)?it.reasons:[]).map((/** @type {string} */ r)=>h('span',FLAG_REASONS[r]||r));
 const text=k==='discussion'?it.excerpt:it.preview;
 const acts=!content?[['dismiss','기각']]:it.status==='hidden'?[['unhide','복구'],['dismiss','기각']]:it.status==='deleted'?[['dismiss','기각']]:[['hide','임시조치(숨김)'],['dismiss','기각']];
 return h('article.flag',
  h('div.meta',kindTag(k),it.author?h('span',it.author):null,it.context?h('span',`「${it.context}」의 댓글`):null,h('span.push',`${relTime(it.firstAt,now)} · 신고 ${num(it.count)}`)),
  k==='discussion'&&it.preview?h('div.ttl',it.url&&it.status!=='hidden'?h('a',{href:it.url,target:'_blank',rel:'noopener'},it.preview):it.preview):null,
  text?excerpt(String(text)):null,
  h('div.rsn',...reasons),
  it.status&&it.status!=='published'?h('p.fine',{hidden:!it.status},`현재 상태: ${({hidden:'임시조치 중',deleted:'작성자가 삭제',locked:'댓글 잠김'})[/** @type {'hidden'} */(it.status)]||it.status}`):null,
  it.note?h('p.note','신고자 설명: ',it.note):null,
  !content?h('p.fine','글·댓글이 아닌 신고는 데이터 탭의 충돌 처리로 넘깁니다.'):null,
  h('div.btns',...acts.map(([a,label])=>h(`button.btn.sm${a==='hide'?'.d':''}`,{type:'button',onclick:()=>act(ctx,it.target,a,label,it)},label)),
   content&&it.authorId?h('button.btn.sm',{type:'button',onclick:()=>act(ctx,'user:'+it.authorId,'restrict','작성자 7일 제한',it)},'작성자 7일 제한'):null,
   !content?h('a.btn.sm',{href:'#/data'},'데이터 탭에서 보기'):null));
}
/** @param {string} t */
function excerpt(t){
 if(t.length<=300)return h('div.pv',t);
 return h('div.pv',t.slice(0,300)+'…',h('details',h('summary','본문 전체 보기'),h('p.full',t)));
}
/** @param {any} ctx @param {any} it @param {number} now */
function hiddenCard(ctx,it,now){
 const k=kindOf(it);
 return h('article.flag',
  h('div.meta',kindTag(k),it.author?h('span',it.author):null,h('span.push',`임시조치 ${dayClock(it.hiddenAt,now)}`)),
  it.preview?h('div.ttl',it.preview):null,
  it.reason?h('p.fine',`사유: ${it.reason}`):null,
  h('div.btns',h('button.btn.sm',{type:'button',onclick:()=>act(ctx,it.target,'unhide','복구',it)},'복구')));
}
/** Confirm sheet → POST /api/v2/mod/action. @param {any} ctx @param {string} target @param {string} action @param {string} label @param {any} it */
async function act(ctx,target,action,label,it){
 const what=action==='restrict'?`작성자(${it.author||'회원'})를 7일 동안 글·댓글 쓰기에서 제한합니다.`:action==='hide'?'공개 페이지에서 숨깁니다. 나중에 복구할 수 있어요.':action==='unhide'?'숨기기 전 상태로 되돌립니다.':'신고를 닫고 내용은 그대로 둡니다.';
 const done=await confirmSheet({
  title:`${label} 할까요?`,
  body:[h('p',what),it.preview?h('p.quote',String(it.preview).slice(0,120)):null],
  reason:{label:'처리 사유 (공개 기록, 2–500자)',quick:QUICK_REASONS},
  confirm:label,danger:action==='hide'||action==='restrict',
  run:({reason})=>ctx.api.post('/api/v2/mod/action',{target,action,reason,...(action==='restrict'?{days:7}:{})}),
 });
 if(!done)return;
 toast(`${label} 처리했어요`);
 ctx.refresh();
}
