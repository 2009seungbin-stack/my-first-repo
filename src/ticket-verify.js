/** Verifies a signed answer from the account service (server/tickets.js) with the public key
 * baked into this build. Dependency-free; used by src/entitlement.js and the Node tests.
 * Returns the payload when the signature is valid AND every expected field matches, else null.
 * There is no expiry check on purpose: freshness comes from the nonce the page chose for this
 * very request (the operationId, or the /me nonce), so client clocks never matter. */
const keys=new Map();
const b64=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(s).length/4)*4,'=')),c=>c.charCodeAt(0));
function publicKey(raw){
 if(!keys.has(raw))keys.set(raw,crypto.subtle.importKey('raw',b64(raw),{name:'ECDSA',namedCurve:'P-256'},false,['verify']));
 return keys.get(raw);
}
export async function verifyTicket(publicKeyRaw,ticket,expect={}){
 try{
  if(!publicKeyRaw||typeof ticket!=='string')return null;
  const i=ticket.indexOf('.');if(i<1||ticket.length>4096)return null;
  const body=ticket.slice(0,i),sig=b64(ticket.slice(i+1));
  if(sig.length!==64)return null;
  const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},await publicKey(publicKeyRaw),sig,new TextEncoder().encode(body));
  if(!ok)return null;
  const payload=JSON.parse(new TextDecoder().decode(b64(body)));
  if(payload?.v!==1)return null;
  for(const [k,v]of Object.entries(expect))if(payload[k]!==v)return null;
  return payload;
 }catch{return null;}
}
/** A fresh random nonce for one request. */
export function newNonce(){const a=crypto.getRandomValues(new Uint8Array(18));let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
