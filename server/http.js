/** Response, error and cookie conventions for /api/v1. Never emits CORS headers. */
export const API_HEADERS=Object.freeze({
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
 'Cross-Origin-Resource-Policy':'same-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
});
/** Error codes are the client contract; localized text lives in the frontend. */
export const ERRORS=Object.freeze({
 BAD_REQUEST:400,INVALID_JSON:400,UNKNOWN_TOOL:400,NOT_METERED:400,INVALID_OPERATION:400,
 LOGIN_REQUIRED:401,INVALID_SIGNATURE:401,
 FORBIDDEN_ORIGIN:403,CHALLENGE_REQUIRED:403,CHALLENGE_FAILED:403,FORBIDDEN:403,
 NOT_FOUND:404,METHOD_NOT_ALLOWED:405,OPERATION_CONFLICT:409,ALREADY_PRO:409,
 PAYLOAD_TOO_LARGE:413,UNSUPPORTED_MEDIA_TYPE:415,DAILY_LIMIT:429,NETWORK_LIMIT:429,RATE_LIMITED:429,SIGN_IN_REQUIRED:403,ACCOUNT_FLAGGED:403,OPERATION_EXPIRED:409,PRICE_UNAVAILABLE:400,
 INTERNAL:500,BILLING_UNAVAILABLE:503,SERVICE_NOT_CONFIGURED:503,UPSTREAM_FAILED:502
});
const DEFAULT_MESSAGES={DAILY_LIMIT:'Daily free heavy-job limit reached.',LOGIN_REQUIRED:'Sign in required.',FORBIDDEN_ORIGIN:'Cross-site request rejected.',SERVICE_NOT_CONFIGURED:'Account service is not configured on this deployment.',INTERNAL:'Internal error.'};
export class ApiError extends Error{
 constructor(code,message,extra={},top={}){super(message||DEFAULT_MESSAGES[code]||code);this.code=code;this.status=ERRORS[code]||500;this.extra=extra;this.top=top;}
}
export function json(body,status=200,headers={}){
 const h=new Headers(API_HEADERS);
 for(const [k,v]of Object.entries(headers))if(Array.isArray(v))for(const x of v)h.append(k,x);else h.set(k,v);
 return new Response(JSON.stringify(body),{status,headers:h});
}
/** {"error":{"code","message",...extra}} — no stack traces, no internal detail. */
export function errorResponse(error,headers={}){
 const e=error instanceof ApiError?error:new ApiError('INTERNAL');
 return json({...e.top,error:{code:e.code,message:e.message,...e.extra}},e.status,headers);
}
export function redirect(location,cookies=[]){
 const h=new Headers({Location:location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 for(const c of cookies)h.append('Set-Cookie',c);
 return new Response(null,{status:302,headers:h});
}
export function parseCookies(header){
 const out={};for(const part of String(header||'').split(';')){
  const i=part.indexOf('=');if(i<1)continue;
  const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();if(!(k in out))out[k]=v;
 }
 return out;
}
/** HttpOnly + SameSite=Lax + Path=/ by default; Secure except on plain-http localhost dev. */
export function cookie(name,value,{maxAge,path='/',secure=true,httpOnly=true}={}){
 return [`${name}=${value}`,`Path=${path}`,maxAge!==undefined&&`Max-Age=${Math.max(0,Math.floor(maxAge))}`,httpOnly&&'HttpOnly',secure&&'Secure','SameSite=Lax'].filter(Boolean).join('; ');
}
export const clearCookie=(name,options={})=>cookie(name,'',{...options,maxAge:0});
/** Read at most `limit` bytes; the API never accepts file content, so bodies are tiny. */
export async function readBody(request,limit){
 const declared=Number(request.headers.get('content-length')||0);
 if(declared>limit)throw new ApiError('PAYLOAD_TOO_LARGE');
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw new ApiError('PAYLOAD_TOO_LARGE');}chunks.push(value);}
 const all=new Uint8Array(size);let o=0;for(const c of chunks){all.set(c,o);o+=c.byteLength;}
 return new TextDecoder().decode(all);
}
export async function readJSON(request,limit=2048){
 if(!/^application\/json(\s*;|$)/i.test(request.headers.get('content-type')||''))throw new ApiError('UNSUPPORTED_MEDIA_TYPE','Content-Type must be application/json.');
 const text=await readBody(request,limit);
 try{const value=JSON.parse(text||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw 0;return value;}catch{throw new ApiError('INVALID_JSON','Body must be a JSON object.');}
}
