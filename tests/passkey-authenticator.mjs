/** A software WebAuthn authenticator for tests: real ES256 / RS256 keys from WebCrypto, real CBOR
 * attestation objects (fmt "none") and assertions, so server/webauthn.js is exercised on the same
 * bytes a phone would send. */
import {base64url} from '../server/crypto.js';

const enc=new TextEncoder();
/** Minimal CBOR encoder (ints, byte/text strings, arrays, maps). */
export function cbor(v){
 const out=[];
 const head=(mt,n)=>{
  if(n<24)out.push(mt<<5|n);
  else if(n<256)out.push(mt<<5|24,n);
  else if(n<65536)out.push(mt<<5|25,n>>8,n&255);
  else out.push(mt<<5|26,(n>>>24)&255,(n>>16)&255,(n>>8)&255,n&255);
 };
 const item=x=>{
  if(typeof x==='number'){if(x>=0)head(0,x);else head(1,-1-x);}
  else if(x instanceof Uint8Array){head(2,x.length);out.push(...x);}
  else if(typeof x==='string'){const b=enc.encode(x);head(3,b.length);out.push(...b);}
  else if(Array.isArray(x)){head(4,x.length);x.forEach(item);}
  else if(x instanceof Map){head(5,x.size);for(const [k,v] of x){item(k);item(v);}}
  else if(x===false)out.push(0xf4);else if(x===true)out.push(0xf5);else if(x===null)out.push(0xf6);
  else if(typeof x==='object'){const e=Object.entries(x);head(5,e.length);for(const [k,v] of e){item(k);item(v);}}
  else throw Error('cbor: unsupported');
 };
 item(v);return new Uint8Array(out);
}
const fromB64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length;}return o;};
const sha=async b=>new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?enc.encode(b):b));
/** r‖s (64 bytes) → ASN.1 DER, as authenticators send ES256 signatures. */
export function rawToDer(raw){
 const int=b=>{let i=0;while(i<b.length-1&&b[i]===0)i++;b=b.slice(i);if(b[0]&0x80)b=cat(new Uint8Array([0]),b);return cat(new Uint8Array([2,b.length]),b);};
 const body=cat(int(raw.slice(0,32)),int(raw.slice(32)));
 return cat(new Uint8Array([0x30,body.length]),body);
}

export class SoftAuthenticator{
 /** @param {{alg?:'ES256'|'RS256'}} [o] */
 constructor(o={}){this.alg=o.alg||'ES256';this.credentials=new Map();}
 async #keys(){
  if(this.alg==='ES256'){
   const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
   const jwk=await crypto.subtle.exportKey('jwk',kp.publicKey);
   return {kp,cose:cbor(new Map([[1,2],[3,-7],[-1,1],[-2,fromB64u(jwk.x)],[-3,fromB64u(jwk.y)]]))};
  }
  const kp=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',kp.publicKey);
  return {kp,cose:cbor(new Map([[1,3],[3,-257],[-1,fromB64u(jwk.n)],[-2,fromB64u(jwk.e)]]))};
 }
 async #sign(privateKey,data){
  if(this.alg==='ES256')return rawToDer(new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,data)));
  return new Uint8Array(await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},privateKey,data));
 }
 /** navigator.credentials.create() → PublicKeyCredential.toJSON().
  * @param {any} options creation options as the server sent them @param {{origin:string,flags?:number,rpId?:string,type?:string,crossOrigin?:boolean,idOverride?:string}} o */
 async create(options,o){
  const {kp,cose}=await this.#keys();
  const id=crypto.getRandomValues(new Uint8Array(32)),rpId=o.rpId??options.rp.id;
  const clientData=enc.encode(JSON.stringify({type:o.type??'webauthn.create',challenge:options.challenge,origin:o.origin,crossOrigin:o.crossOrigin??false}));
  const flags=o.flags??(0x01|0x04|0x40);
  const authData=cat(await sha(rpId),new Uint8Array([flags,0,0,0,0]),new Uint8Array(16),new Uint8Array([0,id.length]),id,cose);
  const credId=base64url(id);
  this.credentials.set(credId,{privateKey:kp.privateKey,count:0,userHandle:options.user.id,rpId});
  return {id:o.idOverride??credId,rawId:o.idOverride??credId,type:'public-key',authenticatorAttachment:'platform',clientExtensionResults:{},
   response:{clientDataJSON:base64url(clientData),attestationObject:base64url(cbor(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]))),transports:['internal','hybrid']}};
 }
 /** navigator.credentials.get() → PublicKeyCredential.toJSON().
  * @param {any} options request options @param {{origin:string,credentialId?:string,flags?:number,counter?:number,rpId?:string,type?:string}} o */
 async get(options,o){
  const credId=o.credentialId??[...this.credentials.keys()][0],c=this.credentials.get(credId);
  if(o.counter!==undefined)c.count=o.counter;else if(c.counting)c.count++;
  const rpId=o.rpId??options.rpId;
  const clientData=enc.encode(JSON.stringify({type:o.type??'webauthn.get',challenge:options.challenge,origin:o.origin}));
  const n=c.count;
  const authData=cat(await sha(rpId),new Uint8Array([o.flags??(0x01|0x04),(n>>>24)&255,(n>>16)&255,(n>>8)&255,n&255]));
  const sig=await this.#sign(c.privateKey,cat(authData,await sha(clientData)));
  return {id:credId,rawId:credId,type:'public-key',clientExtensionResults:{},
   response:{clientDataJSON:base64url(clientData),authenticatorData:base64url(authData),signature:base64url(sig),userHandle:c.userHandle}};
 }
}
