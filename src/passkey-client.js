/** Member passkeys in the browser (server/member-passkey.js): sign up with a nickname, sign in with a
 * discoverable passkey ("지문으로 로그인"), add or remove a device. Used by the account page and the
 * sign-in sheet on channel pages. No dependencies; options arrive as JSON (base64url) and are turned into
 * the ArrayBuffers navigator.credentials wants, and the answer goes back as PublicKeyCredential JSON.
 * Every function resolves to {ok:true,data} or {ok:false,code,message?,field?}; code 'CANCELLED' means the
 * person closed the passkey prompt (nothing to report). */
const toB64u=buf=>{let s='';for(const b of new Uint8Array(buf))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
const fromB64u=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((String(s).length+3)%4)),c=>c.charCodeAt(0));

/** WebAuthn with a platform or roaming authenticator is available in this browser. */
export const passkeySupported=()=>typeof window!=='undefined'&&!!window.PublicKeyCredential&&!!navigator.credentials?.create&&window.isSecureContext!==false;

/** A short name for this device, shown in the account's device list ("iPhone", "Windows"…). */
export function deviceLabel(){
 const ua=navigator.userAgent||'';
 const os=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android':/Macintosh|Mac OS X/.test(ua)?'Mac':/Windows/.test(ua)?'Windows':/CrOS/.test(ua)?'ChromeOS':/Linux/.test(ua)?'Linux':'';
 const br=/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung Internet':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'';
 return [os,br].filter(Boolean).join(' · ').slice(0,40);
}
function credentialJSON(c){
 const r=c.response,out={id:c.id,rawId:toB64u(c.rawId),type:c.type,clientExtensionResults:c.getClientExtensionResults?.()||{},response:{clientDataJSON:toB64u(r.clientDataJSON)}};
 if(r.attestationObject){out.response.attestationObject=toB64u(r.attestationObject);try{out.response.transports=r.getTransports?.()||[];}catch{out.response.transports=[];}}
 if(r.authenticatorData){out.response.authenticatorData=toB64u(r.authenticatorData);out.response.signature=toB64u(r.signature);if(r.userHandle)out.response.userHandle=toB64u(r.userHandle);}
 return out;
}
async function post(api,path,body){
 try{
  const r=await fetch(`${api}auth/passkey/${path}`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})});
  const data=await r.json().catch(()=>null);
  return r.ok?{ok:true,data}:{ok:false,status:r.status,code:data?.error?.code||'ERROR',message:data?.error?.message||'',field:data?.error?.field,reason:data?.error?.reason,siteKey:data?.error?.siteKey,need:data?.need};
 }catch{return {ok:false,status:0,code:'NETWORK'};}
}
/** navigator.credentials errors → codes the UIs explain. */
function browserError(e){
 const n=e?.name||'';
 if(n==='NotAllowedError'||n==='AbortError')return {ok:false,code:'CANCELLED'};
 if(n==='InvalidStateError')return {ok:false,code:'ALREADY_REGISTERED'};
 if(n==='NotSupportedError'||n==='SecurityError')return {ok:false,code:'UNSUPPORTED'};
 return {ok:false,code:'BROWSER',message:String(e?.message||e)};
}
async function create(options){
 const o={...options,challenge:fromB64u(options.challenge),user:{...options.user,id:fromB64u(options.user.id)},excludeCredentials:(options.excludeCredentials||[]).map(c=>({...c,id:fromB64u(c.id)}))};
 try{return {ok:true,credential:credentialJSON(await navigator.credentials.create({publicKey:o}))};}catch(e){return browserError(e);}
}

/** Sign up: nickname → (bot check) → passkey → signed in. `getToken(siteKey)` runs the Turnstile check
 * when the server asks for one and resolves to the token ('' = cancelled).
 * @param {{api?:string,displayName:string,locale?:string,getToken?:(siteKey:string)=>Promise<string>}} o */
export async function passkeySignUp(o){
 const api=o.api||'/api/v1/',body={displayName:o.displayName,...(o.locale?{locale:o.locale}:{})};
 let opt=await post(api,'register/options',body);
 if(!opt.ok&&opt.code==='CHALLENGE_REQUIRED'&&o.getToken){
  const token=await o.getToken(opt.siteKey||'');
  if(!token)return {ok:false,code:'CANCELLED'};
  opt=await post(api,'register/options',{...body,turnstileToken:token});
 }
 if(!opt.ok)return opt;
 const c=await create(opt.data);if(!c.ok)return c;
 return post(api,'register/verify',{credential:c.credential,name:deviceLabel()||undefined});
}
/** Sign in with a passkey saved on this device or a nearby phone. @param {{api?:string}} [o] */
export async function passkeySignIn(o={}){
 const api=o.api||'/api/v1/';
 const opt=await post(api,'login/options',{});if(!opt.ok)return opt;
 let a;
 try{a=await navigator.credentials.get({publicKey:{challenge:fromB64u(opt.data.challenge),rpId:opt.data.rpId,timeout:opt.data.timeout,userVerification:opt.data.userVerification,allowCredentials:[]}});}
 catch(e){return browserError(e);}
 return post(api,'login/verify',{credential:credentialJSON(a)});
}
/** Add this device to the signed-in account. @param {{api?:string,name?:string}} [o] */
export async function passkeyAddDevice(o={}){
 const api=o.api||'/api/v1/';
 const opt=await post(api,'add/options',{});if(!opt.ok)return opt;
 const c=await create(opt.data);if(!c.ok)return c;
 return post(api,'add/verify',{credential:c.credential,name:o.name||deviceLabel()||undefined});
}
/** @param {{api?:string,id:string}} o */
export const passkeyRemove=o=>post(o.api||'/api/v1/','remove',{id:o.id});

/** Fingerprint mark for the passkey buttons (inline SVG; CSP img-src stays 'self'). */
export const PASSKEY_ICON='<svg class="sib-i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 11v3.5a6 6 0 0 1-1.2 3.6"/><path d="M8.6 9.2A4 4 0 0 1 16 11v2.2a10 10 0 0 1-.7 3.8"/><path d="M5.5 16.5A8.5 8.5 0 0 0 6 13v-2a6 6 0 0 1 9.6-4.8"/><path d="M18 9.5c.3.5.5 1 .5 1.5v2a13 13 0 0 1-.6 4"/><path d="M4.3 7.5A8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 6.7 3.3"/><path d="M9 19.6a10 10 0 0 0 .9-2.2"/></svg>';

/** Turnstile inside /verify/ (its own CSP), as a small dialog; resolves to the token or '' if closed.
 * Pages without <base href> (channel pages) pass base '/'. @param {string} siteKey @param {string} action @param {{lang?:string,base?:string,title?:string,close?:string}} [o] */
export function turnstileToken(siteKey,action,o={}){
 if(!/^[0-9A-Za-z_-]{1,100}$/.test(siteKey||''))return Promise.resolve('');
 const d=document.createElement('dialog');d.className='pk-turnstile';d.setAttribute('aria-label',o.title||'Turnstile');
 d.style.cssText='border:0;border-radius:14px;padding:16px;max-width:360px;width:calc(100% - 32px)';
 const p=document.createElement('p');p.textContent=o.title||'';p.style.cssText='margin:0 0 8px;font-size:14px';
 const f=document.createElement('iframe');f.title='Turnstile';f.style.cssText='width:100%;height:80px;border:0;display:block';
 f.src=`${o.base??''}verify/?sitekey=${encodeURIComponent(siteKey)}&action=${encodeURIComponent(action)}&lang=${encodeURIComponent(o.lang||'auto')}`;
 const x=document.createElement('button');x.type='button';x.textContent=o.close||'×';x.className='btn';x.style.marginTop='8px';
 d.append(p,f,x);document.body.append(d);
 return new Promise(resolve=>{
  let token='';
  const onMessage=e=>{if(e.origin!==location.origin||e.source!==f.contentWindow||e.data?.type!=='nerulio-turnstile')return;if(typeof e.data.token==='string'&&e.data.token.length<=2048)token=e.data.token;d.close();};
  const timer=setTimeout(()=>d.open&&d.close(),180e3);
  addEventListener('message',onMessage);x.addEventListener('click',()=>d.close());
  d.addEventListener('close',()=>{clearTimeout(timer);removeEventListener('message',onMessage);d.remove();resolve(token);},{once:true});
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
 });
}

/** Words for every passkey UI (account page and the sign-in sheet), ko / en / ja. */
export const PASSKEY_TEXT=Object.freeze({
 ko:{title:'지문으로 가입·로그인',signIn:'지문으로 로그인',signUp:'지문으로 가입',newHere:'처음이에요 · 지문으로 가입',nickname:'닉네임',nickHint:'글과 댓글에 ✓ 표시와 함께 보이는 고정 닉네임이에요 (2~20자). 이메일이나 전화번호는 받지 않아요.',
  warn:'패스키는 이 기기(또는 휴대폰·비밀번호 관리자)에 저장돼요. 등록한 기기를 모두 잃어버리면 계정을 되찾을 수 없어요. 기기를 하나 더 등록하거나, 나중에 GitHub·Discord를 연결해 두세요.',
  or:'또는',devices:'패스키 (지문·얼굴·기기 잠금)',add:'이 기기 추가',added:'이 기기를 추가했어요. 이제 이 기기로도 로그인할 수 있어요.',remove:'삭제',removeConfirm:'“{n}” 패스키를 삭제할까요? 그 기기로는 더 이상 로그인할 수 없어요.',removed:'패스키를 삭제했어요.',
  created:'등록 {date}',used:'마지막 사용 {date}',unsupported:'이 브라우저는 패스키를 지원하지 않아요. 최신 Chrome·Safari·Edge·삼성 인터넷에서 열어 주세요.',already:'이 기기에는 이미 이 계정의 패스키가 있어요.',
  reauth:'보안을 위해 다시 로그인한 뒤 기기를 추가해 주세요.',taken:'이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.',reserved:'사용할 수 없는 닉네임이에요.',length:'닉네임은 2~20자로 써 주세요.',
  limit:'이 네트워크에서 오늘 가입이 너무 많아요. 내일 다시 시도해 주세요.',rate:'너무 빨라요. 1분 뒤에 다시 해 주세요.',failed:'패스키를 확인하지 못했어요. 다시 시도해 주세요.',unknown:'이 패스키로 가입한 계정을 찾지 못했어요. 처음이라면 지문으로 가입해 주세요.',
  signupOff:'지금은 새 가입을 받지 않아요. 이미 가입했다면 지문으로 로그인할 수 있어요.',welcome:'{n}님, 가입했어요.',signedIn:'로그인했어요.',challenge:'가입 전에 사람인지 한 번 확인할게요.',close:'닫기',signedInAlready:'이미 로그인되어 있어요.',lastMethod:'이 계정에 로그인할 수 있는 유일한 방법이라 삭제할 수 없어요. 다른 기기를 먼저 추가하세요.'},
 en:{title:'Passkey sign-up and sign-in',signIn:'Sign in with a passkey',signUp:'Sign up with a passkey',newHere:'New here? Sign up with a passkey',nickname:'Nickname',nickHint:'Your fixed nickname, shown with a ✓ on posts and comments (2–20 characters). No e-mail or phone number needed.',
  warn:'A passkey is stored on this device (or your phone / password manager). If you lose every device you registered, the account cannot be recovered. Add a second device, or link GitHub or Discord later.',
  or:'or',devices:'Passkeys (fingerprint, face or screen lock)',add:'Add this device',added:'This device was added. You can sign in with it too.',remove:'Remove',removeConfirm:'Remove the passkey “{n}”? That device will no longer sign in.',removed:'Passkey removed.',
  created:'Added {date}',used:'Last used {date}',unsupported:'This browser does not support passkeys. Please use a current Chrome, Safari, Edge or Samsung Internet.',already:'This device already has a passkey for this account.',
  reauth:'For your security, sign in again before adding a device.',taken:'This nickname is taken. Please choose another.',reserved:'This nickname is not available.',length:'Nicknames are 2–20 characters.',
  limit:'Too many new accounts from this network today. Please try again tomorrow.',rate:'Too fast. Please wait a minute.',failed:'The passkey could not be verified. Please try again.',unknown:'No account uses this passkey. If you are new, sign up with a passkey.',
  signupOff:'New sign-ups are closed for now. If you already have an account, sign in with your passkey.',welcome:'Welcome, {n}.',signedIn:'Signed in.',challenge:'A quick check before signing up.',close:'Close',signedInAlready:'You are already signed in.',lastMethod:'This is the only way to sign in to this account, so it cannot be removed. Add another device first.'},
 ja:{title:'パスキーで登録・ログイン',signIn:'パスキーでログイン',signUp:'パスキーで登録',newHere:'はじめての方 · パスキーで登録',nickname:'ニックネーム',nickHint:'投稿とコメントに ✓ 付きで表示される固定ニックネームです（2〜20文字）。メールアドレスや電話番号は不要です。',
  warn:'パスキーはこの端末（またはスマートフォン・パスワード管理アプリ）に保存されます。登録した端末をすべて失うとアカウントは復元できません。端末をもう1台登録するか、後でGitHub・Discordを連携してください。',
  or:'または',devices:'パスキー（指紋・顔・画面ロック）',add:'この端末を追加',added:'この端末を追加しました。この端末でもログインできます。',remove:'削除',removeConfirm:'パスキー「{n}」を削除しますか？その端末ではログインできなくなります。',removed:'パスキーを削除しました。',
  created:'登録 {date}',used:'最終使用 {date}',unsupported:'このブラウザはパスキーに対応していません。最新のChrome・Safari・Edge・Samsung Internetでお試しください。',already:'この端末にはすでにこのアカウントのパスキーがあります。',
  reauth:'安全のため、もう一度ログインしてから端末を追加してください。',taken:'このニックネームは使われています。別のものを選んでください。',reserved:'このニックネームは使えません。',length:'ニックネームは2〜20文字です。',
  limit:'このネットワークからの今日の登録が多すぎます。明日もう一度お試しください。',rate:'操作が速すぎます。1分後にもう一度お試しください。',failed:'パスキーを確認できませんでした。もう一度お試しください。',unknown:'このパスキーのアカウントが見つかりません。はじめての方はパスキーで登録してください。',
  signupOff:'現在、新規登録は受け付けていません。登録済みの方はパスキーでログインできます。',welcome:'{n}さん、登録しました。',signedIn:'ログインしました。',challenge:'登録の前に簡単な確認を行います。',close:'閉じる',signedInAlready:'すでにログインしています。',lastMethod:'このアカウントの唯一のログイン方法なので削除できません。先に別の端末を追加してください。'}
});
/** @param {string} l @param {string} key @param {Record<string,string>} [v] */
export const passkeyText=(l,key,v={})=>String((PASSKEY_TEXT[l]||PASSKEY_TEXT.en)[key]??PASSKEY_TEXT.en[key]??key).replace(/\{(\w+)\}/g,(_,k)=>v[k]??'');
/** The sentence for a failed passkey call ('' for a cancelled prompt). @param {string} l @param {any} r */
export function passkeyMessage(l,r){
 const t=k=>passkeyText(l,k);
 if(!r||r.ok||r.code==='CANCELLED')return '';
 if(r.code==='UNSUPPORTED')return t('unsupported');
 if(r.code==='ALREADY_REGISTERED')return t('already');
 if(r.code==='REAUTH')return t('reauth');
 if(r.code==='NETWORK_LIMIT')return t('limit');
 if(r.code==='RATE_LIMITED')return t('rate');
 if(r.code==='NOT_CONFIGURED')return t('signupOff');
 if(r.reason==='signed_in')return t('signedInAlready');
 if(r.reason==='last_method')return t('lastMethod');
 if(r.field==='displayName')return /taken/.test(r.message||'')?t('taken'):/reserved/.test(r.message||'')?t('reserved'):t('length');
 if(r.code==='PASSKEY_REJECTED'&&/unknown credential/.test(JSON.stringify(r)))return t('unknown');
 return t('failed');
}
