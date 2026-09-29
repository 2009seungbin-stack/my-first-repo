// @ts-check
/** Passkey (WebAuthn) sign-in and registration against /api/v2/admin/passkey/* (contract). */
import {creationOptions,requestOptions,registrationJSON,authenticationJSON} from './b64.js';
import {AdminError,errorText} from './api.js';

export const supported=()=>typeof window!=='undefined'&&!!window.PublicKeyCredential&&!!navigator.credentials;

/** @param {{post:(p:string,b?:any)=>Promise<any>}} api */
export async function login(api){
 if(!supported())throw new AdminError({status:0,code:'UNSUPPORTED'});
 const opts=await api.post('/api/v2/admin/passkey/login/options',{});
 const cred=await navigator.credentials.get({publicKey:requestOptions(opts)});
 if(!cred)throw new DOMException('No credential','NotAllowedError');
 const res=await api.post('/api/v2/admin/passkey/login/verify',{credential:authenticationJSON(cred)});
 remember(cred.id);return res;
}
/** First registration (with the setup code) or "기기 추가" by a signed-in admin (no code).
 * @param {{post:(p:string,b?:any)=>Promise<any>}} api @param {{setupCode?:string,name:string}} o */
export async function register(api,{setupCode,name}){
 if(!supported())throw new AdminError({status:0,code:'UNSUPPORTED'});
 const opts=await api.post('/api/v2/admin/passkey/register/options',setupCode?{setupCode}:{});
 const cred=await navigator.credentials.create({publicKey:creationOptions(opts)});
 if(!cred)throw new DOMException('No credential','NotAllowedError');
 const res=await api.post('/api/v2/admin/passkey/register/verify',{credential:registrationJSON(cred),name});
 if(setupCode||!lastCredential())remember(cred.id);return res;
}
/** The credential this browser last signed in with (settings marks it "이 기기"). @param {string} id */
function remember(id){try{localStorage.setItem('nerulio-admin-cred',id);}catch{}}
export function lastCredential(){try{return localStorage.getItem('nerulio-admin-cred');}catch{return null;}}
/** A default device name from the user agent ("Android 휴대폰", "Windows PC"…). @param {string} [ua] */
export function deviceName(ua=typeof navigator!=='undefined'?navigator.userAgent:''){
 if(/Android/i.test(ua))return /Mobile/i.test(ua)?'Android 휴대폰':'Android 태블릿';
 if(/iPhone/i.test(ua))return 'iPhone';
 if(/iPad/i.test(ua))return 'iPad';
 if(/Windows/i.test(ua))return 'Windows PC';
 if(/Mac OS X/i.test(ua))return 'Mac';
 if(/Linux/i.test(ua))return 'Linux PC';
 return '이 기기';
}
/** Korean text for a failed passkey step (browser errors and server errors). @param {unknown} e */
export function passkeyError(e){
 const name=/** @type {any} */(e)?.name;
 if(name==='NotAllowedError'||name==='AbortError')return '취소했거나 시간이 지났어요. 다시 눌러 주세요.';
 if(name==='InvalidStateError')return '이 기기에는 이미 등록된 패스키가 있어요. 로그인을 눌러 주세요.';
 if(name==='SecurityError')return '이 주소에서는 패스키를 쓸 수 없어요. https 주소로 열어 주세요.';
 if(name==='NotSupportedError')return '이 기기는 이 방식의 패스키를 지원하지 않아요.';
 if(e instanceof AdminError){
  if(e.code==='UNSUPPORTED')return '이 브라우저는 패스키를 지원하지 않아요. 최신 Chrome에서 열어 주세요.';
  if(e.status===403&&/setup/i.test(e.serverMessage))return '설정 코드가 맞지 않아요.';
  return errorText(e);
 }
 if(e instanceof TypeError)return '서버가 보낸 패스키 정보를 읽지 못했어요.';
 return '패스키 확인에 실패했어요. 다시 시도해 주세요.';
}
