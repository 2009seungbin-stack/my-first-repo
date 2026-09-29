// @ts-check
/** base64url ⇄ bytes, and the WebAuthn JSON forms the admin API speaks (contract: options arrive
 * with base64url strings where the browser wants ArrayBuffers; credentials go back the same way).
 * Pure: no DOM, no navigator — tests/admin.test.mjs runs it in Node. */

/** @param {ArrayBuffer|ArrayBufferView} buf */
export function toB64url(buf){
 const bytes=buf instanceof ArrayBuffer?new Uint8Array(buf):new Uint8Array(buf.buffer,buf.byteOffset,buf.byteLength);
 let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/** Accepts base64url or standard base64, padded or not. @param {string} str @returns {Uint8Array} */
export function fromB64url(str){
 if(typeof str!=='string'||!/^[A-Za-z0-9\-_+/]*={0,2}$/.test(str))throw new TypeError('Invalid base64url value');
 const b=str.replace(/-/g,'+').replace(/_/g,'/').replace(/=+$/,'');
 if(b.length%4===1)throw new TypeError('Invalid base64url length');
 const bin=atob(b+'='.repeat((4-b.length%4)%4));
 const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
 return out;
}
/** @param {string} str */
export const bufferOf=str=>{const u=fromB64url(str);return u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength);};

/** The server may send the options bare or wrapped as {publicKey:{…}} (both forms exist in the wild).
 * @param {any} o */
const unwrap=o=>o&&typeof o==='object'&&o.publicKey&&typeof o.publicKey==='object'?o.publicKey:o;
/** @param {any} list */
const descriptors=list=>Array.isArray(list)?list.map(d=>({...d,type:d.type||'public-key',id:bufferOf(d.id)})):undefined;

/** PublicKeyCredentialCreationOptions (JSON form) → what navigator.credentials.create() takes.
 * @param {any} json */
export function creationOptions(json){
 const o=unwrap(json);
 if(!o||typeof o.challenge!=='string'||!o.user||typeof o.user.id!=='string')throw new TypeError('Invalid creation options');
 /** @type {any} */const out={...o,challenge:bufferOf(o.challenge),user:{...o.user,id:bufferOf(o.user.id)}};
 if(o.excludeCredentials)out.excludeCredentials=descriptors(o.excludeCredentials);
 return out;
}
/** PublicKeyCredentialRequestOptions (JSON form) → what navigator.credentials.get() takes.
 * @param {any} json */
export function requestOptions(json){
 const o=unwrap(json);
 if(!o||typeof o.challenge!=='string')throw new TypeError('Invalid request options');
 /** @type {any} */const out={...o,challenge:bufferOf(o.challenge)};
 if(o.allowCredentials)out.allowCredentials=descriptors(o.allowCredentials);
 return out;
}
/** @param {any} v */
const enc=v=>v instanceof ArrayBuffer||ArrayBuffer.isView(v)?toB64url(v):v;
/** A PublicKeyCredential from create() → RegistrationResponseJSON (WebAuthn L3 shape).
 * @param {any} cred */
export function registrationJSON(cred){
 const r=cred.response;
 /** @type {any} */const response={clientDataJSON:enc(r.clientDataJSON),attestationObject:enc(r.attestationObject)};
 try{const t=r.getTransports?.();if(Array.isArray(t))response.transports=t;}catch{}
 try{const a=r.getPublicKeyAlgorithm?.();if(typeof a==='number')response.publicKeyAlgorithm=a;}catch{}
 try{const k=r.getPublicKey?.();if(k)response.publicKey=enc(k);}catch{}
 try{const d=r.getAuthenticatorData?.();if(d)response.authenticatorData=enc(d);}catch{}
 return {id:cred.id,rawId:enc(cred.rawId),type:cred.type||'public-key',authenticatorAttachment:cred.authenticatorAttachment??null,response,clientExtensionResults:safeExt(cred)};
}
/** A PublicKeyCredential from get() → AuthenticationResponseJSON. @param {any} cred */
export function authenticationJSON(cred){
 const r=cred.response;
 return {id:cred.id,rawId:enc(cred.rawId),type:cred.type||'public-key',authenticatorAttachment:cred.authenticatorAttachment??null,
  response:{clientDataJSON:enc(r.clientDataJSON),authenticatorData:enc(r.authenticatorData),signature:enc(r.signature),userHandle:r.userHandle?enc(r.userHandle):null},
  clientExtensionResults:safeExt(cred)};
}
/** @param {any} cred */
function safeExt(cred){try{return cred.getClientExtensionResults?.()||{};}catch{return {};}}

/** A VAPID public key (base64url) → the Uint8Array pushManager.subscribe() wants. @param {string} key */
export const vapidKey=key=>fromB64url(key);
