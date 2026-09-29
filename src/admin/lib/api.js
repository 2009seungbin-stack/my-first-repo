// @ts-check
import {needText} from './labels.js';
/** The admin app's only way to the server. Same conventions as src/platform/islands.js: JSON bodies,
 * same-origin credentials, the {error:{code,message,…}} envelope of server/http.js. The contract's
 * shorthand {error:'REAUTH'} / {error:'NOT_CONFIGURED',need} is accepted too.
 *  - 401 REAUTH → the host re-runs the passkey login once, then the request is retried.
 *  - 404 on /api/v2/admin/* or /mod/* → not an admin (or signed out): the host shows sign-in.
 *  - 503 NOT_CONFIGURED → an AdminError whose `need` names the missing secret (never a crash).
 *  - A response the service worker served from its cache while offline carries x-admin-offline. */

export class AdminError extends Error{
 /** @param {{status:number,code:string,message?:string,need?:string|null,missing?:string[],data?:any}} o */
 constructor({status,code,message,need=null,missing=/** @type {string[]} */([]),data=null}){super(message||code);this.status=status;this.code=code;this.need=need;this.missing=missing;this.data=data;this.serverMessage=message||'';}
}

/** Normalizes every error body shape the server may send. @param {number} status @param {any} data */
export function parseError(status,data){
 const e=data&&typeof data==='object'?data.error:null;
 let code=typeof e==='string'?e:e&&typeof e==='object'&&typeof e.code==='string'?e.code:'';
 if(!code)code=status===401?'LOGIN_REQUIRED':status===404?'NOT_FOUND':status===503?'NOT_CONFIGURED':status===0?'NETWORK':status>=500?'INTERNAL':'BAD_REQUEST';
 if(code==='SERVICE_NOT_CONFIGURED')code='NOT_CONFIGURED';
 const need=(data&&typeof data==='object'&&(data.need??(e&&typeof e==='object'?e.need??e.details?.need:null)))||null;
 const message=(e&&typeof e==='object'&&typeof e.message==='string'?e.message:typeof data?.message==='string'?data.message:'')||'';
 const missing=[...new Set([...(Array.isArray(data?.missing)?data.missing:[]),...(e&&typeof e==='object'&&Array.isArray(e.missing)?e.missing:[])].map(String))];
 return {code,need:need?String(need):missing[0]||null,message,missing};
}

/** Paths whose 404 means "you are not an admin" rather than "no such thing". @param {string} path */
export const gated=path=>/^\/api\/v2\/(admin\/|mod\/)/.test(path)&&!/\/passkey\//.test(path);

/**
 * @param {{fetch?:typeof fetch,reauth?:()=>Promise<void>,signedOut?:(e:AdminError)=>void,stillAdmin?:()=>Promise<boolean>,served?:(path:string,offlineAt:number|null)=>void}} hooks
 */
export function createApi(hooks={}){
 const f=hooks.fetch||((/** @type {any} */ ...a)=>globalThis.fetch(...a));
 /** @type {Promise<void>|null} */let reauthing=null;
 /** @param {string} method @param {string} path @param {any} [body] @param {boolean} [retried] @returns {Promise<any>} */
 async function call(method,path,body,retried=false){
  /** @type {Response} */let r;
  try{
   r=await f(path,{method,credentials:'same-origin',cache:'no-store',headers:body!==undefined?{'content-type':'application/json',accept:'application/json'}:{accept:'application/json'},body:body!==undefined?JSON.stringify(body):undefined});
  }catch{throw new AdminError({status:0,code:'NETWORK',message:''});}
  const data=await r.json().catch(()=>null);
  if(r.ok){
   const off=r.headers.get('x-admin-offline');
   hooks.served?.(path,off?Number(off)||Date.now():null);
   return data;
  }
  const {code,need,message,missing}=parseError(r.status,data);
  if(code==='OFFLINE')throw new AdminError({status:0,code:'NETWORK',message:''});
  if(r.status===401&&code==='REAUTH'&&!retried&&hooks.reauth){
   reauthing=reauthing||hooks.reauth().finally(()=>{reauthing=null;});
   await reauthing;
   return call(method,path,body,true);
  }
  // A 404 from an admin endpoint means "not an admin" (the session ended) — unless /me still answers,
  // in which case it is an ordinary "no such thing" (e.g. the runs of a collector that was removed).
  let notAdmin=r.status===404&&gated(path);
  if(notAdmin&&path!=='/api/v2/admin/me'&&hooks.stillAdmin)notAdmin=!(await hooks.stillAdmin().catch(()=>false));
  const err=new AdminError({status:r.status,code:notAdmin?'NOT_ADMIN':code,message,need,missing,data});
  if(err.code==='NOT_ADMIN'||(r.status===401&&code!=='REAUTH'))hooks.signedOut?.(err);
  throw err;
 }
 return {
  /** @param {string} p */get:p=>call('GET',p),
  /** @param {string} p @param {any} [b] */post:(p,b={})=>call('POST',p,b),
  /** @param {string} p @param {any} [b] */put:(p,b={})=>call('PUT',p,b),
  /** @param {string} p @param {any} [b] */del:(p,b={})=>call('DELETE',p,b),
 };
}

/** Server messages are English; the common ones read in Korean, anything else is shown as sent
 * (the owner needs the server's own words to act on an unexpected failure). */
const KO=/** @type {[RegExp,string][]} */([
 [/^Not hidden/,'숨겨진 상태가 아니에요. 새로 고침해 주세요.'],[/^Already hidden/,'이미 임시조치된 대상이에요.'],[/^Already deleted/,'작성자가 이미 삭제했어요.'],
 [/^Already reviewed/,'이미 처리된 항목이에요.'],[/^reason must be (\d+)–(\d+)/,'사유는 $1~$2자로 써 주세요.'],[/^Only a higher role/,'더 높은 권한만 이 계정을 처리할 수 있어요.'],
 [/^You cannot moderate your own/,'자기 계정은 처리할 수 없어요.'],[/^No such post or comment/,'글이나 댓글을 찾을 수 없어요.'],[/^Too many requests/,'요청이 너무 잦아요. 1분 뒤에 다시 해 주세요.'],
 [/^Cross-site request rejected/,'다른 사이트에서 온 요청으로 보여 막았어요. 앱을 다시 열어 주세요.'],
]);
/** Korean text for a failed action, keeping the server's words visible. @param {unknown} e */
export function errorText(e){
 if(e&&typeof e==='object'&&typeof /** @type {any} */(e).userMessage==='string')return /** @type {any} */(e).userMessage;
 if(!(e instanceof AdminError))return '알 수 없는 오류가 났어요.';
 if(e.code==='NETWORK')return '인터넷에 연결되어 있지 않아요. 연결되면 다시 해 주세요.';
 if(e.code==='NOT_CONFIGURED')return `설정 필요: ${needText(e.need).what}`;
 if(e.code==='RATE_LIMITED')return '요청이 너무 잦아요. 1분 뒤에 다시 해 주세요.';
 for(const [re,ko] of KO){const m=re.exec(e.serverMessage);if(m)return ko.replace(/\$(\d)/g,(_,i)=>m[Number(i)]);}
 if(e.serverMessage)return `서버 오류: ${e.serverMessage}`;
 return `서버 오류 (${e.status||'연결 없음'} ${e.code})`;
}
