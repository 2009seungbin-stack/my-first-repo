// @ts-check
/** Sign-in ("지문으로 로그인") and first-time setup (setup code → register this phone's passkey).
 * Shown instead of the tabs whenever /api/v2/admin/me answers 404 (not an admin / signed out). */
import {h,icon,logo} from '../lib/dom.js';
import {fill,needCard} from '../lib/ui.js';
import {AdminError} from '../lib/api.js';
import {login,register,deviceName,passkeyError,supported} from '../lib/passkey.js';

/** @param {any} ctx @param {HTMLElement} main @param {{reason?:string}} [o] */
export function signIn(ctx,main,o={}){
 const err=h('p.auth-err',{role:'alert',hidden:true});
 const ok=supported();
 const btn=/** @type {HTMLButtonElement} */(h('button.btn.p.big#signin',{type:'button',disabled:!ok,onclick:async()=>{
  btn.disabled=true;btn.classList.add('busy');err.hidden=true;
  try{await login(ctx.rawApi);ctx.signedIn();}
  catch(e){err.textContent=passkeyError(e);err.hidden=false;btn.disabled=false;btn.classList.remove('busy');}
 }},icon('fingerprint',{size:22}),'지문으로 로그인'));
 fill(main,h('div.auth',
  h('div.auth-logo',logo(56)),
  h('h1','Nerulio 관리'),
  h('p.lead','운영자 전용 화면입니다. 이 기기에 등록한 패스키(지문·화면 잠금)로 로그인하세요.'),
  o.reason==='reauth'?h('p.note-box','보안을 위해 12시간마다 한 번 더 확인해요.'):o.reason==='signedout'?h('p.note-box','로그아웃했어요.'):null,
  ok?null:h('p.note-box.warn','이 브라우저는 패스키를 지원하지 않아요. 최신 Chrome에서 열어 주세요.'),
  btn,err,
  h('div.auth-alt',h('span','처음이신가요?'),h('a.btn',{href:'#/setup'},'이 휴대폰 등록하기')),
  h('p.fine','관리자가 아니면 이 화면 너머로 들어갈 수 없어요. 비밀번호는 쓰지 않습니다.')));
 if(o.reason!=='signedout'&&ok)btn.focus();
}

/** @param {any} ctx @param {HTMLElement} main */
export function setup(ctx,main){
 const err=h('div.auth-err',{role:'alert',hidden:true});
 const code=/** @type {HTMLInputElement} */(h('input#setup-code',{type:'password',autocomplete:'one-time-code',required:true,minlength:4,maxlength:200,spellcheck:'false','aria-describedby':'setup-code-help'}));
 const name=/** @type {HTMLInputElement} */(h('input#setup-name',{type:'text',value:deviceName(),maxlength:40,autocomplete:'off'}));
 const submit=/** @type {HTMLButtonElement} */(h('button.btn.p.big',{type:'submit',disabled:!supported()},icon('fingerprint',{size:22}),'이 휴대폰 등록'));
 const form=h('form.auth-form',{novalidate:true,onsubmit:async(/** @type {Event} */ e)=>{
  e.preventDefault();err.hidden=true;
  if(code.value.trim().length<4){err.replaceChildren('설정 코드를 입력해 주세요.');err.hidden=false;code.focus();return;}
  submit.disabled=true;submit.classList.add('busy');
  try{await register(ctx.rawApi,{setupCode:code.value.trim(),name:name.value.trim()||deviceName()});ctx.signedIn('등록했어요. 이제 지문으로 들어올 수 있어요.');}
  catch(x){
   if(x instanceof AdminError&&x.code==='NOT_CONFIGURED')err.replaceChildren(needCard(x.need||'ADMIN_SETUP_CODE'));
   else if(x instanceof AdminError&&(x.code==='OPERATION_CONFLICT'||x.status===409))err.replaceChildren('이미 등록된 관리자 기기가 있어요. 그 기기에서 설정 › "기기 추가"로 이 기기를 추가하세요.');
   else err.replaceChildren(passkeyError(x));
   err.hidden=false;submit.disabled=false;submit.classList.remove('busy');
  }
 }},
  h('div.field',h('label',{for:'setup-code'},'설정 코드'),code,h('span.fine#setup-code-help','Pages 비밀값 ADMIN_SETUP_CODE에 넣은 값')),
  h('div.field',h('label',{for:'setup-name'},'기기 이름'),name),
  submit,err);
 fill(main,h('div.auth',
  h('div.auth-top',h('a.btn.sm',{href:'#/'},'‹ 로그인으로')),
  h('h1','이 휴대폰 등록'),
  h('ol.steps',h('li','설정 코드를 입력합니다.'),h('li','지문(또는 화면 잠금)으로 이 휴대폰에 패스키를 만듭니다.'),h('li','끝. 다음부터는 지문 한 번으로 들어옵니다.')),
  supported()?null:h('p.note-box.warn','이 브라우저는 패스키를 지원하지 않아요. 최신 Chrome에서 열어 주세요.'),
  form,
  h('p.fine','설정 코드는 첫 기기에만 씁니다. 관리자 기기가 한 대라도 등록되면 다른 기기는 로그인한 관리자가 "기기 추가"로만 늘릴 수 있어요.')));
 code.focus();
}
