// @ts-check
/** 설정: this admin's passkey devices ("기기 추가" registers another passkey while signed in),
 * notification settings, theme, sign-out. Data: GET /api/v2/admin/me. */
import {h,icon} from '../lib/dom.js';
import {box,failure,fill,skeleton,empty,seg,confirmSheet,toast,st} from '../lib/ui.js';
import {dayClock,relTime} from '../lib/format.js';
import {register,deviceName,passkeyError,supported} from '../lib/passkey.js';

export const title='설정';
export const tab='home';
export const back='#/';

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 fill(main,skeleton(3));
 let me;
 try{me=await ctx.api.get('/api/v2/admin/me');ctx.me=me;}catch(e){fill(main,failure(e,()=>ctx.refresh()));return;}
 const now=ctx.now(),devices=Array.isArray(me?.devices)?me.devices:[];
 const current=ctx.currentDevice();
 fill(main,
  box('관리자',null,h('ul.rows',h('li',h('span.tt',h('b',me?.name||'관리자'),h('span.l2','패스키로 로그인 · 12시간마다 다시 확인'))))),
  box('로그인 기기',`${devices.length}대`,
   devices.length?h('ul.rows',...devices.map((/** @type {any} */ d)=>h('li',h('span.devico',icon('phone',{size:20})),
    h('span.tt',h('b',d.name||'이름 없는 기기'),current&&String(d.id)===current?[' ',st('ok','이 기기')]:null,
     h('span.l2',`등록 ${dayClock(d.created_at,now)}`,d.last_used_at?` · 마지막 사용 ${relTime(d.last_used_at,now)}`:' · 아직 사용 안 함'))))):empty('등록된 기기가 없습니다'),
   h('div.pad',h('button.btn.full',{type:'button',disabled:!supported(),onclick:()=>addDevice(ctx)},icon('plus',{size:18}),'기기 추가'),
    h('p.fine','다른 휴대폰이나 PC를 추가하려면 여기서 패스키를 하나 더 만듭니다. 화면에 "다른 기기 사용"이 보이면 QR 코드로 그 기기에 만들 수 있어요. 기기 삭제는 아직 서버에서만 할 수 있어요.'))),
  box('알림',null,h('ul.rows',h('li',h('a.rowa',{href:'#/notifications'},h('span.tt','알림 설정 · 설치',h('span.l2','무엇을 알릴지, 방해 금지 시간, 홈 화면에 설치')),h('span.r','›'))))),
  box('화면',null,h('div.pad',seg([{value:'system',label:'시스템'},{value:'light',label:'밝게'},{value:'dark',label:'어둡게'}],ctx.theme(),v=>{ctx.setTheme(v);ctx.refresh();},'화면 테마'))),
  h('button.btn.full.d',{type:'button',onclick:()=>signOut(ctx)},'로그아웃'),
  h('p.fine.center',`버전 ${ctx.version}`));
}
/** @param {any} ctx */
async function addDevice(ctx){
 const input=/** @type {HTMLInputElement} */(h('input',{id:'dev-name',type:'text',value:deviceName(),maxlength:40,autocomplete:'off'}));
 const ok=await confirmSheet({
  title:'기기를 추가할까요?',
  body:[h('p','새 패스키를 만듭니다. 이 휴대폰에 하나 더 만들거나, "다른 기기 사용"을 골라 QR 코드로 다른 기기에 만들 수 있어요.'),h('div.field',h('label',{for:'dev-name'},'기기 이름'),input)],
  confirm:'패스키 만들기',
  run:async()=>{
   try{return await register(ctx.api,{name:input.value.trim()||deviceName()});}
   catch(e){throw Object.assign(new Error('passkey'),{userMessage:passkeyError(e)});}
  },
 });
 if(ok){toast('기기를 추가했어요');ctx.refresh();}
}
/** @param {any} ctx */
async function signOut(ctx){
 const ok=await confirmSheet({title:'로그아웃할까요?',body:[h('p','다시 들어올 때 지문(패스키)으로 로그인합니다. 알림은 계속 받아요.')],confirm:'로그아웃',danger:true,
  run:()=>ctx.rawApi.post('/api/v1/auth/logout',{})});
 if(ok)ctx.signedOut();
}
