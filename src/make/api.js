/** The workbench's calls to the community API (/api/v2): state, recipes, uploads, posts. One small
 * module so browser tests can answer them (Playwright routes /api/v2/*) while COMMUNITY's endpoints
 * (GET /api/v2/recipes/{id}, POST …/try, posts with recipe fields) are not merged yet.
 *
 * The anonymous path follows src/platform/islands.js exactly — same endpoints, same error codes, same
 * /verify/ Turnstile frame — but islands.js keeps those helpers private, so the few lines are repeated
 * here. TODO(coordinator): export them from one shared module and import it in both places. */
const L=document.documentElement.lang==='en'?'en':'ko';

async function call(path,body,method){
 try{
  const r=await fetch('/api/v2'+path,{method:method||(body?'POST':'GET'),credentials:'same-origin',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>null);
  return {ok:r.ok,status:r.status,data,code:data?.error?.code||'',message:data?.error?.message||''};
 }catch{return {ok:false,status:0,data:null,code:'NETWORK',message:''};}
}
/** Turnstile in the /verify/ frame (its own CSP); resolves to a one-use token or ''. */
export function challenge(siteKey){
 if(!/^[0-9A-Za-z_-]{1,100}$/.test(siteKey||''))return Promise.resolve('');
 const d=document.createElement('dialog');d.className='hc';
 const p=document.createElement('p');p.textContent=L==='ko'?'사람인지 확인할게요. 잠시만 기다려 주세요.':'Checking that you are human. One moment, please.';
 const f=document.createElement('iframe');f.title='Turnstile';f.src=`/verify/?sitekey=${encodeURIComponent(siteKey)}&action=community&lang=${L}`;
 const x=document.createElement('button');x.type='button';x.className='btn x';x.textContent=L==='ko'?'닫기':'Close';
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
function sendImage(blob,token){
 return new Promise(resolve=>{
  const x=new XMLHttpRequest();x.open('POST','/api/v2/uploads');x.withCredentials=true;x.setRequestHeader('content-type',blob.type);
  if(token)x.setRequestHeader('x-turnstile-token',token);
  x.onload=()=>{let data=null;try{data=JSON.parse(x.responseText);}catch{}resolve({ok:x.status>=200&&x.status<300,status:x.status,data,code:data?.error?.code||'',message:data?.error?.message||''});};
  x.onerror=()=>resolve({ok:false,status:0,data:null,code:'NETWORK',message:''});
  x.send(blob);
 });
}

export const api={
 /** {signedIn, anon:{enabled,check,siteKey}, uploads:{perPost,maxBytes}|null, user?} */
 async state(){const r=await call('/state');return r.ok&&r.data?r.data:{signedIn:false,anon:{enabled:false},uploads:null};},
 /** GET /api/v2/recipes/{id} → {id,title,channel,no,recipe,generator,prompt,author} or null. */
 async recipe(id){const r=await call(`/recipes/${encodeURIComponent(id)}`);return r.ok?r.data:null;},
 /** Count one replay (once per run on a visitor's own image). */
 async tried(id){await call(`/recipes/${encodeURIComponent(id)}/try`,{});},
 /** One image, asking for the human check when the server wants it. → {id,url} or {error}. */
 async upload(blob,siteKey){
  let r=await sendImage(blob,'');
  if(r.code==='CHALLENGE_REQUIRED'||r.code==='CHALLENGE_FAILED'){const t=await challenge(r.data?.error?.siteKey||siteKey);if(!t)return {error:'challenge'};r=await sendImage(blob,t);}
  return r.ok?r.data:{error:r.message||r.code||'upload'};
 },
 /** POST /api/v2/posts?l= with the contract's fields; retries once with a Turnstile token when asked. */
 async post(body,siteKey){
  let r=await call(`/posts?l=${L}`,body);
  if(r.code==='CHALLENGE_REQUIRED'||r.code==='CHALLENGE_FAILED'){const t=await challenge(r.data?.error?.siteKey||siteKey);if(!t)return {error:'challenge'};r=await call(`/posts?l=${L}`,{...body,turnstileToken:t});}
  return r.ok?r.data||{}:{error:r.message||r.code||'post',code:r.code,status:r.status};
 },
};
