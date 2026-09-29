// @ts-check
/** WebAuthn (passkeys) without dependencies: a minimal CBOR decoder, COSE ES256/RS256 keys imported
 * into WebCrypto, and the registration / authentication checks of WebAuthn Level 2 §7.1 and §7.2 that
 * matter for a relying party that does not evaluate attestation (attestation "none": the admin's
 * first credential is authorized by ADMIN_SETUP_CODE, later ones by a signed-in admin, never by the
 * authenticator's make or model).
 *
 * Challenges are stateless: the challenge bytes ARE a signed, expiring token (HMAC with SESSION_SECRET),
 * so issuing options writes nothing to D1. The caller binds them to a short-lived cookie nonce and
 * records a used challenge on success (replay protection for synced passkeys whose signCount stays 0). */
import {base64url,fromBase64url,sign,unsign,randomToken,sha256} from './crypto.js';

export const ALG=Object.freeze({ES256:-7,RS256:-257});
export const CHALLENGE_TTL_MS=5*60e3;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
/** WebCrypto's typings want ArrayBuffer-backed views. @param {Uint8Array} u @returns {BufferSource} */
const bs=u=>/** @type {BufferSource} */(/** @type {unknown} */(u));

/* ---------- CBOR (RFC 8949), definite lengths only: all WebAuthn structures use them ---------- */

/** Decode one CBOR item at the start of `bytes`. Maps become Map (keys may be ints or strings).
 * @param {Uint8Array} bytes @returns {{value:any,length:number}} */
export function decodeCborPrefix(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let o=0;
 const need=(/** @type {number} */ n)=>{if(o+n>bytes.length)throw Error('CBOR: truncated');};
 const len=(/** @type {number} */ ai)=>{
  if(ai<24)return ai;
  if(ai===24){need(1);return view.getUint8(o++);}
  if(ai===25){need(2);const v=view.getUint16(o);o+=2;return v;}
  if(ai===26){need(4);const v=view.getUint32(o);o+=4;return v;}
  if(ai===27){need(8);const v=view.getUint32(o)*2**32+view.getUint32(o+4);o+=8;if(!Number.isSafeInteger(v))throw Error('CBOR: integer too large');return v;}
  throw Error('CBOR: indefinite or reserved length');
 };
 /** @param {number} depth @returns {any} */
 const item=depth=>{
  if(depth>16)throw Error('CBOR: too deep');
  need(1);const b=view.getUint8(o++),mt=b>>5,ai=b&31;
  switch(mt){
   case 0:return len(ai);
   case 1:return -1-len(ai);
   case 2:{const n=len(ai);need(n);const v=bytes.slice(o,o+n);o+=n;return v;}
   case 3:{const n=len(ai);need(n);const v=dec.decode(bytes.subarray(o,o+n));o+=n;return v;}
   case 4:{const n=len(ai);if(n>1024)throw Error('CBOR: array too long');const a=[];for(let i=0;i<n;i++)a.push(item(depth+1));return a;}
   case 5:{const n=len(ai);if(n>256)throw Error('CBOR: map too long');const m=new Map();for(let i=0;i<n;i++){const k=item(depth+1);if(m.has(k))throw Error('CBOR: duplicate key');m.set(k,item(depth+1));}return m;}
   case 6:len(ai);return item(depth+1);
   default:
    if(ai===20)return false;if(ai===21)return true;if(ai===22)return null;if(ai===23)return undefined;
    if(ai===26){need(4);const v=view.getFloat32(o);o+=4;return v;}
    if(ai===27){need(8);const v=view.getFloat64(o);o+=8;return v;}
    throw Error('CBOR: unsupported simple value');
  }
 };
 const value=item(0);
 return {value,length:o};
}
/** @param {Uint8Array} bytes */
export function decodeCbor(bytes){const r=decodeCborPrefix(bytes);if(r.length!==bytes.length)throw Error('CBOR: trailing bytes');return r.value;}

/* ---------- authenticator data (§6.1) ---------- */

export const FLAGS=Object.freeze({UP:0x01,UV:0x04,BE:0x08,BS:0x10,AT:0x40,ED:0x80});
/** @param {Uint8Array} a */
export function parseAuthData(a){
 if(a.length<37)throw Error('authenticatorData too short');
 const flags=a[32],signCount=new DataView(a.buffer,a.byteOffset+33,4).getUint32(0);
 /** @type {{rpIdHash:Uint8Array,flags:number,signCount:number,credentialId?:Uint8Array,publicKey?:Uint8Array,aaguid?:Uint8Array}} */
 const out={rpIdHash:a.slice(0,32),flags,signCount};
 if(flags&FLAGS.AT){
  if(a.length<55)throw Error('attested credential data truncated');
  out.aaguid=a.slice(37,53);
  const n=(a[53]<<8)|a[54];if(n<16||n>1023||a.length<55+n)throw Error('bad credential id length');
  out.credentialId=a.slice(55,55+n);
  const {length}=decodeCborPrefix(a.subarray(55+n));
  out.publicKey=a.slice(55+n,55+n+length);
  if(!(flags&FLAGS.ED)&&55+n+length!==a.length)throw Error('trailing bytes in authenticatorData');
 }
 return out;
}

/* ---------- COSE keys → WebCrypto ---------- */

/** Validate a COSE_Key and return its algorithm. @param {Uint8Array} cose */
export function coseAlg(cose){
 const k=decodeCbor(cose);if(!(k instanceof Map))throw Error('COSE key is not a map');
 const kty=k.get(1),alg=k.get(3);
 if(kty===2&&alg===ALG.ES256){
  const x=k.get(-2),y=k.get(-3);
  if(k.get(-1)!==1||!(x instanceof Uint8Array)||!(y instanceof Uint8Array)||x.length!==32||y.length!==32)throw Error('unsupported EC2 key');
  return ALG.ES256;
 }
 if(kty===3&&alg===ALG.RS256){
  const n=k.get(-1),e=k.get(-2);
  if(!(n instanceof Uint8Array)||!(e instanceof Uint8Array)||n.length<256)throw Error('unsupported RSA key');
  return ALG.RS256;
 }
 throw Error('unsupported COSE algorithm');
}
/** @param {Uint8Array} cose @returns {Promise<{key:CryptoKey,alg:number}>} */
export async function importCoseKey(cose){
 const alg=coseAlg(cose),k=decodeCbor(cose);
 if(alg===ALG.ES256)return {alg,key:await crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:base64url(k.get(-2)),y:base64url(k.get(-3)),ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['verify'])};
 return {alg,key:await crypto.subtle.importKey('jwk',{kty:'RSA',n:base64url(k.get(-1)),e:base64url(k.get(-2)),alg:'RS256',ext:true},{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify'])};
}
/** ASN.1 DER ECDSA-Sig-Value → the 64-byte r‖s that WebCrypto verifies. @param {Uint8Array} der */
export function derToRaw(der){
 let o=0;const fail=()=>{throw Error('bad ECDSA signature');};
 if(der[o++]!==0x30)fail();
 let total=der[o++];if(total&0x80){if(total!==0x81)fail();total=der[o++];}
 if(o+total!==der.length)fail();
 const int=()=>{if(der[o++]!==0x02)fail();const n=der[o++];if(n<1||n>33||o+n>der.length)fail();let v=der.subarray(o,o+n);o+=n;while(v.length>1&&v[0]===0)v=v.subarray(1);if(v.length>32)fail();const out=new Uint8Array(32);out.set(v,32-v.length);return out;};
 const r=int(),s=int();if(o!==der.length)fail();
 const raw=new Uint8Array(64);raw.set(r,0);raw.set(s,32);return raw;
}
/** @param {Uint8Array} cose @param {Uint8Array} signature @param {Uint8Array} data */
export async function verifySignature(cose,signature,data){
 const {key,alg}=await importCoseKey(cose);
 if(alg===ALG.ES256)return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bs(derToRaw(signature)),bs(data));
 return crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,bs(signature),bs(data));
}

/* ---------- stateless challenges ---------- */

/** A challenge that carries its own purpose, data and expiry, signed with the session secret.
 * @param {string} secret @param {Record<string,unknown>} data @param {number} now @param {number} [ttl] */
export async function makeChallenge(secret,data,now,ttl=CHALLENGE_TTL_MS){
 const payload=base64url(enc.encode(JSON.stringify({...data,e:now+ttl,r:randomToken(16)})));
 return base64url(enc.encode(await sign(secret,'webauthn/v1',payload)));
}
/** @param {string} secret @param {string} challenge @param {number} now @returns {Promise<Record<string,any>|null>} */
export async function readChallenge(secret,challenge,now){
 try{
  if(typeof challenge!=='string'||challenge.length>1024)return null;
  const payload=await unsign(secret,'webauthn/v1',new TextDecoder().decode(fromBase64url(challenge)));
  if(!payload)return null;
  const data=JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
  return data&&typeof data==='object'&&Number(data.e)>now?data:null;
 }catch{return null;}
}
export const challengeHash=(/** @type {string} */ challenge)=>sha256('webauthn-used\n'+challenge);

/* ---------- ceremonies ---------- */

const B64U=/^[A-Za-z0-9_-]*$/;
/** @param {unknown} v @param {string} field @param {number} max */
function b64(v,field,max){
 if(typeof v!=='string'||!B64U.test(v)||v.length>max)throw new WebAuthnError(`${field} missing or malformed`);
 try{return fromBase64url(v);}catch{throw new WebAuthnError(`${field} missing or malformed`);}
}
export class WebAuthnError extends Error{}

/** clientDataJSON checks shared by both ceremonies (§7.1 steps 7–10, §7.2 steps 11–14).
 * @param {Uint8Array} bytes @param {string} type @param {string} origin */
function clientData(bytes,type,origin){
 let c;try{c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new WebAuthnError('clientDataJSON is not JSON');}
 if(!c||c.type!==type)throw new WebAuthnError('wrong ceremony type');
 if(typeof c.challenge!=='string')throw new WebAuthnError('no challenge');
 if(c.origin!==origin)throw new WebAuthnError('origin mismatch');
 if(c.crossOrigin===true)throw new WebAuthnError('cross-origin ceremony');
 return /** @type {{challenge:string}} */(c);
}
/** @param {Uint8Array} a @param {Uint8Array} b */
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const rpHash=async(/** @type {string} */ rpId)=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(rpId)));

/**
 * Verify a registration response (PublicKeyCredential.toJSON() of navigator.credentials.create()).
 * `checkChallenge` receives the challenge from clientDataJSON and returns its data, or null to refuse.
 * @param {any} credential
 * @param {{origin:string,rpId:string,checkChallenge:(c:string)=>Promise<Record<string,any>|null>,requireUV?:boolean}} o
 */
export async function verifyRegistration(credential,o){
 if(!credential||typeof credential!=='object'||credential.type!=='public-key')throw new WebAuthnError('not a public-key credential');
 const r=credential.response||{};
 const rawId=b64(credential.rawId??credential.id,'rawId',1400);
 const cdBytes=b64(r.clientDataJSON,'clientDataJSON',6000),att=b64(r.attestationObject,'attestationObject',24000);
 const c=clientData(cdBytes,'webauthn.create',o.origin);
 const challenge=await o.checkChallenge(c.challenge);if(!challenge)throw new WebAuthnError('challenge rejected');
 let obj;try{obj=decodeCbor(att);}catch{throw new WebAuthnError('attestationObject is not CBOR');}
 if(!(obj instanceof Map)||!(obj.get('authData') instanceof Uint8Array)||typeof obj.get('fmt')!=='string')throw new WebAuthnError('malformed attestationObject');
 let ad;try{ad=parseAuthData(obj.get('authData'));}catch(e){throw new WebAuthnError(String(/** @type {any} */(e)?.message||e));}
 if(!same(ad.rpIdHash,await rpHash(o.rpId)))throw new WebAuthnError('rpId mismatch');
 if(!(ad.flags&FLAGS.UP))throw new WebAuthnError('user not present');
 if(o.requireUV&&!(ad.flags&FLAGS.UV))throw new WebAuthnError('user not verified');
 if(!ad.credentialId||!ad.publicKey)throw new WebAuthnError('no attested credential');
 if(!same(ad.credentialId,rawId))throw new WebAuthnError('credential id mismatch');
 let alg;try{alg=coseAlg(ad.publicKey);await importCoseKey(ad.publicKey);}catch(e){throw new WebAuthnError(String(/** @type {any} */(e)?.message||e));}
 const transports=Array.isArray(r.transports)?r.transports.filter((/** @type {unknown} */ t)=>typeof t==='string'&&/^[a-z-]{2,20}$/.test(t)).slice(0,6):[];
 return {credentialId:base64url(rawId),publicKey:base64url(ad.publicKey),alg,signCount:ad.signCount,uv:!!(ad.flags&FLAGS.UV),backedUp:!!(ad.flags&FLAGS.BS),transports,fmt:String(obj.get('fmt')),challenge,clientChallenge:c.challenge};
}

/**
 * Verify an authentication response (navigator.credentials.get()). `getCredential` looks the stored
 * credential up by its base64url id.
 * @param {any} credential
 * @param {{origin:string,rpId:string,checkChallenge:(c:string)=>Promise<Record<string,any>|null>,getCredential:(id:string)=>Promise<{publicKey:string,signCount:number}|null>,requireUV?:boolean}} o
 */
export async function verifyAuthentication(credential,o){
 if(!credential||typeof credential!=='object'||credential.type!=='public-key')throw new WebAuthnError('not a public-key credential');
 const r=credential.response||{};
 const rawId=b64(credential.rawId??credential.id,'rawId',1400),id=base64url(rawId);
 const cdBytes=b64(r.clientDataJSON,'clientDataJSON',6000),authData=b64(r.authenticatorData,'authenticatorData',4000),sig=b64(r.signature,'signature',1100);
 const c=clientData(cdBytes,'webauthn.get',o.origin);
 const challenge=await o.checkChallenge(c.challenge);if(!challenge)throw new WebAuthnError('challenge rejected');
 const stored=await o.getCredential(id);if(!stored)throw new WebAuthnError('unknown credential');
 let ad;try{ad=parseAuthData(authData);}catch(e){throw new WebAuthnError(String(/** @type {any} */(e)?.message||e));}
 if(!same(ad.rpIdHash,await rpHash(o.rpId)))throw new WebAuthnError('rpId mismatch');
 if(!(ad.flags&FLAGS.UP))throw new WebAuthnError('user not present');
 if(o.requireUV&&!(ad.flags&FLAGS.UV))throw new WebAuthnError('user not verified');
 const signed=new Uint8Array(authData.length+32);signed.set(authData,0);signed.set(new Uint8Array(await crypto.subtle.digest('SHA-256',bs(cdBytes))),authData.length);
 let ok=false;try{ok=await verifySignature(fromBase64url(stored.publicKey),sig,signed);}catch{ok=false;}
 if(!ok)throw new WebAuthnError('bad signature');
 // §7.2 step 21: a counter that does not move forward means a cloned authenticator. Synced passkeys
 // report 0 forever, which is allowed (both zero).
 const prev=Number(stored.signCount)||0;
 if((ad.signCount!==0||prev!==0)&&ad.signCount<=prev)throw new WebAuthnError('signature counter went backwards');
 const userHandle=typeof r.userHandle==='string'&&r.userHandle?r.userHandle:null;
 return {credentialId:id,signCount:ad.signCount,uv:!!(ad.flags&FLAGS.UV),userHandle,challenge,clientChallenge:c.challenge};
}
