import {base64url} from './crypto.js';
/** Signed answers (docs/MONETIZATION-SECURITY.md §3b). The Worker signs every permission it
 * grants — an allowed authorize, and the plan in /me — with an ECDSA P-256 private key
 * (TICKET_PRIVATE_KEY, a Pages secret). The page verifies with the public key baked into the
 * build (TICKET_PUBLIC_KEY), so a proxy rule, an extension that rewrites responses or a
 * fetch override cannot mint "allowed" or "pro": only editing the page's code can, which is the
 * accepted local-first residual. Each ticket carries the client's fresh nonce (the operationId,
 * or a random value sent with /me), so a copied response is useless on the next request.
 *
 * Format: base64url(JSON payload) + '.' + base64url(IEEE-P1363 signature r||s). */
const enc=new TextEncoder();
const keys=new Map();
/** TICKET_PRIVATE_KEY is the private JWK as JSON (or base64url of that JSON), from tools/ticket-keys.mjs. */
export function parsePrivateJwk(value){
 if(!value)return null;
 let text=String(value).trim();
 if(!text.startsWith('{'))try{text=new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(text.length/4)*4,'=')),c=>c.charCodeAt(0)));}catch{return null;}
 try{const jwk=JSON.parse(text);return jwk?.kty==='EC'&&jwk.crv==='P-256'&&jwk.d&&jwk.x&&jwk.y?jwk:null;}catch{return null;}
}
async function privateKey(jwk){
 const id=jwk.x+jwk.y;
 if(!keys.has(id))keys.set(id,crypto.subtle.importKey('jwk',{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,d:jwk.d,ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']));
 return keys.get(id);
}
export async function signTicket(jwk,payload){
 if(!jwk)return undefined;
 const body=base64url(enc.encode(JSON.stringify({v:1,...payload})));
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},await privateKey(jwk),enc.encode(body));
 return `${body}.${base64url(sig)}`;
}
/** The raw public point (65 bytes, uncompressed) as base64url — what TICKET_PUBLIC_KEY holds. */
export function publicKeyFromJwk(jwk){
 const b=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
 const raw=new Uint8Array(65);raw[0]=4;raw.set(b(jwk.x),1);raw.set(b(jwk.y),33);
 return base64url(raw);
}
/** Client nonce: a random value chosen by the page for this one request. */
export const NONCE=/^[A-Za-z0-9_-]{16,64}$/;
