// @ts-check
/** 알림 설정 · 설치: install to the home screen, turn Web Push on/off for this phone, choose what to
 * be told about (contract `prefs`), quiet hours, and a test notification. */
import {h,logo} from '../lib/dom.js';
import {box,failure,fill,skeleton,toast,needCard} from '../lib/ui.js';
import {AdminError,errorText} from '../lib/api.js';
import {normalizePrefs} from '../lib/model.js';
import {pushSupport,currentSubscription,loadPrefs,stashPrefs,enablePush,disablePush} from '../lib/push.js';

export const title='알림 설정';
export const tab='home';
export const back='#/';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(4));
 const sup=pushSupport();
 /** @type {any} */let keyErr=null;
 let sub=null;
 try{sub=await currentSubscription();}catch{}
 if(sup.supported)await ctx.api.get('/api/v2/admin/push/key').catch((/** @type {any} */ e)=>{keyErr=e;});
 let prefs=loadPrefs(ctx.me?.push?.prefs??ctx.me?.prefs);
 const status=h('span.fine.savestate',{role:'status','aria-live':'polite'});
 /** @type {number} */let timer=0;
 /** @type {HTMLElement|null} */let prefsEl=null;/** @type {HTMLElement|null} */let quietEl=null;
 const save=(/** @type {any} */ patch)=>{
  prefs=normalizePrefs({...prefs,...patch});stashPrefs(prefs);
  // Redraw the two boxes in place and keep focus on the control that was used.
  const focused=document.activeElement?.id;
  if(prefsEl){const n=prefsBox(prefs,save,status);prefsEl.replaceWith(n);prefsEl=n;}
  if(quietEl){const n=quietBox(prefs,save);quietEl.replaceWith(n);quietEl=n;}
  if(focused)document.getElementById(focused)?.focus();
  if(!sub){status.textContent='저장됨 · 알림을 켜면 이 설정으로 받아요';return;}
  status.textContent='저장 중…';clearTimeout(timer);
  timer=window.setTimeout(async()=>{try{await ctx.api.put('/api/v2/admin/push/prefs',{prefs});status.textContent='저장됨';}catch(e){status.textContent='';toast(errorText(e));}},500);
 };
 const draw=()=>{
  fill(main,
   installCard(ctx),
   h('div.fine.b','알림 미리보기'),
   h('div.notif',{'aria-hidden':'true'},h('span.ico',logo(20)),h('div.b',h('span.a','Nerulio 관리 · 09:30'),h('br'),h('b','이번 달 D1 쓰기 80%'),h('br'),'월 포함량 5,000만 행 중 4,000만 행을 썼어요.')),
   keyErr&&keyErr instanceof AdminError&&keyErr.code==='NOT_CONFIGURED'?needCard(keyErr.need||'VAPID_PUBLIC_KEY'):keyErr?failure(keyErr,()=>ctx.refresh()):null,
   deviceBox(ctx,sup,sub,!!keyErr,async on=>{
    try{
     if(on){sub=await enablePush(ctx.api,prefs);toast('이 휴대폰에서 알림을 받아요');}
     else{await disablePush(ctx.api);sub=null;toast('알림을 껐어요');}
    }catch(e){
     const x=/** @type {any} */(e);
     toast(x?.name==='PermissionDenied'?(x.permission==='denied'?'알림이 차단되어 있어요. 브라우저 사이트 설정에서 알림을 허용해 주세요.':'알림 권한을 허용하지 않았어요.'):e instanceof AdminError?errorText(e):'알림을 켜지 못했어요. 다시 시도해 주세요.',{ms:5000});
    }
    draw();
   }),
   prefsEl=prefsBox(prefs,save,status),
   quietEl=quietBox(prefs,save),
   sub?h('button.btn.full',{type:'button',onclick:async(/** @type {Event} */ ev)=>{const b=/** @type {HTMLButtonElement} */(ev.currentTarget);b.disabled=true;try{await ctx.api.post('/api/v2/admin/push/test',{});toast('테스트 알림을 보냈어요. 몇 초 안에 도착해요.');}catch(e){toast(errorText(e),{ms:5000});}b.disabled=false;}},'테스트 알림 보내기'):null,
   h('p.fine','알림을 받는 기기: 알림을 켠 기기만. 기기를 바꾸면 거기서 다시 켜세요.'));
 };
 draw();
}
/** @param {any} ctx */
function installCard(ctx){
 if(ctx.installed())return null;
 let dismissed=false;try{dismissed=localStorage.getItem('nerulio-admin-install-later')==='1';}catch{}
 const can=ctx.canInstall();
 if(dismissed&&!can)return null;
 const card=h('div.install',h('span.ico',logo(26)),h('div.tx',h('b','홈 화면에 설치'),'주소창 없이 앱처럼 열리고, 앱을 닫아도 알림을 받을 수 있습니다.',
  can?h('div.btns',h('button.btn.p.sm',{type:'button',onclick:async()=>{const r=await ctx.install();if(r==='accepted')card.remove();}},'설치'),
   h('button.btn.sm',{type:'button',onclick:()=>{try{localStorage.setItem('nerulio-admin-install-later','1');}catch{}card.remove();}},'나중에'))
   :h('p.fine','Chrome 메뉴(⋮)에서 "홈 화면에 추가" 또는 "앱 설치"를 누르세요.')));
 return card;
}
/** @param {any} ctx @param {{supported:boolean,permission:string}} sup @param {any} sub @param {boolean} blocked @param {(on:boolean)=>Promise<void>} toggle */
function deviceBox(ctx,sup,sub,blocked,toggle){
 const perm=sup.supported?Notification.permission:'unsupported';
 const state=!sup.supported?'이 브라우저는 푸시 알림을 지원하지 않아요':sub?'이 기기에서 알림을 받는 중':perm==='denied'?'브라우저에서 알림이 차단됨':perm==='granted'?'권한 있음 · 구독 안 함':'아직 요청하지 않음';
 const btn=sup.supported&&!blocked?h(`button.btn.sm${sub?'':'.p'}`,{type:'button',onclick:async(/** @type {Event} */ e)=>{const b=/** @type {HTMLButtonElement} */(e.currentTarget);b.disabled=true;b.textContent=sub?'끄는 중…':'켜는 중…';await toggle(!sub);}},sub?'알림 끄기':'알림 켜기'):null;
 return box('이 기기',null,h('ul.rows',h('li',h('span.tt','알림 권한',h('span.l2',{'data-push-state':sub?'on':'off'},state)),btn)));
}
/** @param {any} p @param {(p:any)=>void} save @param {HTMLElement} status */
function prefsBox(p,save,status){
 const sw=(/** @type {string} */ id,/** @type {boolean} */ on,/** @type {string} */ label,/** @type {(v:boolean)=>void} */ set)=>h('input',{id,type:'checkbox',role:'switch',checked:on,'aria-label':label,onchange:(/** @type {Event} */ e)=>set(/** @type {HTMLInputElement} */(e.currentTarget).checked)});
 const th=[80,90,95];
 const thChips=h('div.chips.inline',{role:'group','aria-label':'월 포함량 기준'},...th.map(n=>h('button.chipf.sm',{type:'button',id:`n-th-${n}`,'aria-pressed':String(p.usageThresholds.includes(n)),class:p.usageThresholds.includes(n)?'on':'',disabled:!p.usageThresholds.length,
  onclick:()=>{const next=p.usageThresholds.includes(n)?p.usageThresholds.filter((/** @type {number} */ x)=>x!==n):[...p.usageThresholds,n];if(next.length)save({usageThresholds:next});}},`${n}%`)));
 return h('section.box',h('div.bh',h('h2','무엇을 알릴까요'),status),
  h('div.sw',h('label.tt',{for:'n-fail-n'},'수집기 실패',h('span.l2','연속 실패 횟수가 기준에 닿을 때')),
   h('select',{id:'n-fail-n','aria-label':'연속 실패 기준',onchange:(/** @type {Event} */ e)=>save({collectorFailN:Number(/** @type {HTMLSelectElement} */(e.currentTarget).value)})},...[1,2,3].map(n=>h('option',{value:n,selected:p.collectorFailN===n},`${n}회`)))),
  h('div.sw',h('label.tt',{for:'n-stale'},'상태 수집 멈춤',h('span.l2','Claude·OpenAI 상태가 2시간 넘게 안 바뀜')),sw('n-stale',p.statusStale,'상태 수집 멈춤',v=>save({statusStale:v}))),
  h('div.sw.wrap',h('label.tt',{for:'n-d1'},'이번 달 D1 쓰기',h('span.l2','이번 달 쓰기가 월 포함량의 기준에 닿을 때 (30분마다 확인)')),sw('n-d1',p.usageThresholds.length>0,'이번 달 D1 쓰기',v=>save({usageThresholds:v?[80,90,95]:[]})),thChips),
  h('div.sw',h('label.tt',{for:'n-flag'},'신고 접수',h('span.l2','즉시 또는 1시간마다 모아서')),
   h('select',{id:'n-flag-m','aria-label':'신고 알림 방식',disabled:p.flags==='off',onchange:(/** @type {Event} */ e)=>save({flags:/** @type {HTMLSelectElement} */(e.currentTarget).value})},h('option',{value:'instant',selected:p.flags!=='hourly'},'즉시'),h('option',{value:'hourly',selected:p.flags==='hourly'},'1시간')),
   sw('n-flag',p.flags!=='off','신고 접수',v=>save({flags:v?'instant':'off'}))),
  h('div.sw',h('label.tt',{for:'n-inc'},'AI 서비스 장애',h('span.l2','Claude·OpenAI 공식 상태가 장애로 바뀔 때')),sw('n-inc',p.aiIncident,'AI 서비스 장애',v=>save({aiIncident:v}))),
  h('div.sw',h('label.tt',{for:'n-data'},'정보 제안·사실 충돌',h('span.l2','하루 한 번 모아서')),sw('n-data',p.proposals,'정보 제안과 사실 충돌',v=>save({proposals:v}))),
  h('div.sw',h('label.tt',{for:'n-user'},'새 가입자',h('span.l2','가입 즉시')),sw('n-user',p.newUsers,'새 가입자',v=>save({newUsers:v}))));
}
/** @param {any} p @param {(p:any)=>void} save */
function quietBox(p,save){
 const q=p.quiet||{from:'23:00',to:'07:00'};
 const time=(/** @type {'from'|'to'} */ k,/** @type {string} */ label)=>h('label.time',label,h('input',{type:'time',value:q[k],step:900,disabled:!p.quiet,onchange:(/** @type {Event} */ e)=>{const v=/** @type {HTMLInputElement} */(e.currentTarget).value;if(v)save({quiet:{...q,[k]:v}});}}));
 return h('section.box',
  h('div.sw',h('label.tt',{for:'n-quiet'},`방해 금지 ${q.from}–${q.to}`,h('span.l2','수집기 실패·이번 달 D1 쓰기 95%는 그래도 알림')),h('input',{id:'n-quiet',type:'checkbox',role:'switch',checked:!!p.quiet,'aria-label':'방해 금지 시간',onchange:(/** @type {Event} */ e)=>save({quiet:/** @type {HTMLInputElement} */(e.currentTarget).checked?q:null})})),
  p.quiet?h('div.times',time('from','시작'),time('to','끝')):null);
}
