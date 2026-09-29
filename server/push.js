// @ts-check
/** Web Push without dependencies: VAPID (RFC 8292) JWT signed with ES256, and the message encrypted
 * for the browser's push service with "aes128gcm" (RFC 8291 over RFC 8188), all with WebCrypto.
 * The push service only ever sees ciphertext; the admin's service worker decrypts nothing itself
 * (the browser does) and shows {title, body, url}. */
import {base64url,fromBase64url} from './crypto.js';

const enc=new TextEncoder();
/** @param {...Uint8Array} parts */
export function concat(...parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
/** WebCrypto's typings want ArrayBuffer-backed views. @param {Uint8Array} u @returns {BufferSource} */
const bs=u=>/** @type {BufferSource} */(/** @type {unknown} */(u));
/** @param {Uint8Array} key @param {Uint8Array} data */
async function hmac(key,data){const k=await crypto.subtle.importKey('raw',bs(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,bs(data)));}

/** An uncompressed P-256 point (65 bytes, 0x04‖x‖y) + optional private scalar → JWK. @param {Uint8Array} pub @param {Uint8Array} [d] */
export function p256Jwk(pub,d){
 if(pub.length!==65||pub[0]!==4)throw Error('P-256 public key must be 65 bytes, uncompressed');
 /** @type {JsonWebKey} */const jwk={kty:'EC',crv:'P-256',x:base64url(pub.slice(1,33)),y:base64url(pub.slice(33,65)),ext:true};
 if(d){if(d.length!==32)throw Error('P-256 private key must be 32 bytes');jwk.d=base64url(d);}
 return jwk;
}

/* ---------- RFC 8291 message encryption ---------- */

/**
 * Encrypt one push message (a single aes128gcm record, record size 4096).
 * `salt` and `serverKeys` are only passed by tests (the RFC 8291 §5 vector); normally both are fresh.
 * @param {{plaintext:Uint8Array,uaPublic:Uint8Array,authSecret:Uint8Array,salt?:Uint8Array,serverKeys?:{privateKey:CryptoKey,publicRaw:Uint8Array}}} o
 */
export async function encryptPush(o){
 if(o.uaPublic.length!==65||o.uaPublic[0]!==4)throw Error('p256dh must be an uncompressed P-256 point');
 if(o.authSecret.length!==16)throw Error('auth secret must be 16 bytes');
 if(o.plaintext.length>3993)throw Error('push payload too large');
 const salt=o.salt||crypto.getRandomValues(new Uint8Array(16));
 let as=o.serverKeys;
 if(!as){const kp=/** @type {CryptoKeyPair} */(await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']));as={privateKey:kp.privateKey,publicRaw:new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey))};}
 const uaKey=await crypto.subtle.importKey('raw',bs(o.uaPublic),{name:'ECDH',namedCurve:'P-256'},false,[]);
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:uaKey},as.privateKey,256));
 // RFC 8291 §3.3–3.4: IKM from the ECDH secret and the auth secret, then RFC 8188 key and nonce.
 const prkKey=await hmac(o.authSecret,ecdh);
 const ikm=await hmac(prkKey,concat(enc.encode('WebPush: info\0'),o.uaPublic,as.publicRaw,new Uint8Array([1])));
 const prk=await hmac(salt,ikm);
 const cek=(await hmac(prk,concat(enc.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16);
 const nonce=(await hmac(prk,concat(enc.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const key=await crypto.subtle.importKey('raw',bs(cek),{name:'AES-GCM'},false,['encrypt']);
 // One record, so it is the last one: padding delimiter 0x02 and no further padding.
 const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:bs(nonce),tagLength:128},key,bs(concat(o.plaintext,new Uint8Array([2])))));
 const header=new Uint8Array(21+as.publicRaw.length);
 header.set(salt,0);new DataView(header.buffer).setUint32(16,4096);header[20]=as.publicRaw.length;header.set(as.publicRaw,21);
 return concat(header,ct);
}

/* ---------- RFC 8292 VAPID ---------- */

/** @type {Map<string,Promise<CryptoKey>>} */
const signingKeys=new Map();
/** @param {{publicKey:string,privateKey:string}} v */
function vapidKey(v){
 const k=v.publicKey+'|'+v.privateKey;
 let p=signingKeys.get(k);
 if(!p){p=crypto.subtle.importKey('jwk',p256Jwk(fromBase64url(v.publicKey),fromBase64url(v.privateKey)),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);signingKeys.set(k,p);if(signingKeys.size>4)signingKeys.delete(/** @type {string} */(signingKeys.keys().next().value));}
 return p;
}
/** `Authorization: vapid t=…, k=…` for one push service origin.
 * @param {{publicKey:string,privateKey:string,subject:string}} vapid @param {string} audience @param {number} now */
export async function vapidAuthorization(vapid,audience,now){
 const b=(/** @type {unknown} */ x)=>base64url(enc.encode(JSON.stringify(x)));
 const unsigned=`${b({typ:'JWT',alg:'ES256'})}.${b({aud:audience,exp:Math.floor(now/1000)+12*3600,sub:vapid.subject})}`;
 const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},await vapidKey(vapid),enc.encode(unsigned)));
 return `vapid t=${unsigned}.${base64url(sig)}, k=${vapid.publicKey}`;
}
/** VAPID settings from the environment, or null when push is not configured.
 * @param {any} env @param {string} fallbackSubject */
export function vapidFromEnv(env,fallbackSubject){
 const publicKey=String(env?.VAPID_PUBLIC_KEY||''),privateKey=String(env?.VAPID_PRIVATE_KEY||'');
 if(!/^[A-Za-z0-9_-]{87}$/.test(publicKey)||!/^[A-Za-z0-9_-]{43}$/.test(privateKey))return null;
 const s=String(env?.VAPID_SUBJECT||'');
 return {publicKey,privateKey,subject:/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(s)?s:fallbackSubject};
}

/* ---------- subscriptions ---------- */

/** Push services a subscription may point at. The Worker POSTs to the endpoint, so anything else
 * (an internal address, a random host) is refused at subscribe time. */
const PUSH_HOSTS=[/^fcm\.googleapis\.com$/,/^android\.googleapis\.com$/,/^updates\.push\.services\.mozilla\.com$/,/^[a-z0-9-]+\.push\.services\.mozilla\.com$/,/^web\.push\.apple\.com$/,/^[a-z0-9-]+\.push\.apple\.com$/,/^[a-z0-9-]+\.notify\.windows\.com$/];
/** @param {unknown} s @returns {{endpoint:string,p256dh:string,auth:string}} */
export function parseSubscription(s){
 const x=/** @type {any} */(s);
 if(!x||typeof x!=='object'||typeof x.endpoint!=='string'||x.endpoint.length>1024)throw Error('endpoint');
 let u;try{u=new URL(x.endpoint);}catch{throw Error('endpoint');}
 if(u.protocol!=='https:'||u.port||u.username||u.password||!PUSH_HOSTS.some(re=>re.test(u.hostname)))throw Error('endpoint');
 const p256dh=String(x.keys?.p256dh||''),auth=String(x.keys?.auth||'');
 if(!/^[A-Za-z0-9_-]{87}$/.test(p256dh)||fromBase64url(p256dh)[0]!==4)throw Error('p256dh');
 if(!/^[A-Za-z0-9_-]{22}$/.test(auth))throw Error('auth');
 return {endpoint:u.href,p256dh,auth};
}

/**
 * Send one message. Returns the push service's status (201/202 = accepted; 404/410 = the
 * subscription is gone and should be deleted).
 * @param {{endpoint:string,p256dh:string,auth:string}} sub @param {unknown} message
 * @param {{vapid:{publicKey:string,privateKey:string,subject:string},now:number,fetch?:typeof fetch,ttl?:number,urgency?:'very-low'|'low'|'normal'|'high',topic?:string}} o
 */
export async function sendPush(sub,message,o){
 const body=await encryptPush({plaintext:enc.encode(JSON.stringify(message)),uaPublic:fromBase64url(sub.p256dh),authSecret:fromBase64url(sub.auth)});
 const u=new URL(sub.endpoint);
 /** @type {Record<string,string>} */
 const headers={'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm',TTL:String(o.ttl??86400),Urgency:o.urgency||'normal',Authorization:await vapidAuthorization(o.vapid,u.origin,o.now)};
 // Topic replaces an undelivered message with the same topic (e.g. a newer usage level).
 if(o.topic&&/^[A-Za-z0-9_-]{1,32}$/.test(o.topic))headers.Topic=o.topic;
 const res=await (o.fetch||fetch)(sub.endpoint,{method:'POST',headers,body});
 return res.status;
}
