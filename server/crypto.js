/** WebCrypto helpers shared by the Worker and Node tests (both expose globalThis.crypto). */
const encoder=new TextEncoder();
export function base64url(bytes){
 let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function fromBase64url(text){
 const s=atob(String(text).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(text).length/4)*4,'='));
 return Uint8Array.from(s,c=>c.charCodeAt(0));
}
/** 256-bit CSPRNG token, URL/cookie safe. */
export const randomToken=(bytes=32)=>base64url(crypto.getRandomValues(new Uint8Array(bytes)));
export const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function sha256(text){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
export async function sha256Bytes(text){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)));}
async function hmacKey(secret){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);}
export async function hmac(secret,message){return new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),encoder.encode(message)));}
export async function hmacHex(secret,message){return hex(await hmac(secret,message));}
/** Constant-time comparison for equal-length strings; length itself is not secret here. */
export function safeEqual(a,b){
 a=String(a);b=String(b);if(a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
/** Tamper-evident value: "<payload>.<mac>". Purpose separates keys for different cookies. */
export async function sign(secret,purpose,payload){return `${payload}.${base64url(await hmac(secret,purpose+'\n'+payload))}`;}
export async function unsign(secret,purpose,value){
 const text=String(value||''),i=text.lastIndexOf('.');if(i<1)return null;
 const payload=text.slice(0,i);
 return safeEqual(await sign(secret,purpose,payload),text)?payload:null;
}
