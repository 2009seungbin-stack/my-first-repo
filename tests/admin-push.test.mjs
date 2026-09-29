import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptPush,p256Jwk,vapidAuthorization,parseSubscription,sendPush,vapidFromEnv,concat} from '../server/push.js';
import {base64url,fromBase64url} from '../server/crypto.js';

// RFC 8291 §5 (and Appendix A): the one published aes128gcm Web Push example.
const RFC={
 plaintext:'When I grow up, I want to be a watermelon',
 asPublic:'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
 asPrivate:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
 uaPublic:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
 uaPrivate:'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
 auth:'BTBZMqHH6r4Tts7J_aSIgg',salt:'DGv6ra1nlYgDCS1FRnbzlw',
 message:'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};

test('RFC 8291 §5 test vector: byte-exact aes128gcm message',async()=>{
 const privateKey=await crypto.subtle.importKey('jwk',p256Jwk(fromBase64url(RFC.asPublic),fromBase64url(RFC.asPrivate)),{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const out=await encryptPush({plaintext:new TextEncoder().encode(RFC.plaintext),uaPublic:fromBase64url(RFC.uaPublic),authSecret:fromBase64url(RFC.auth),salt:fromBase64url(RFC.salt),serverKeys:{privateKey,publicRaw:fromBase64url(RFC.asPublic)}});
 assert.equal(base64url(out),RFC.message);
});

/** Decrypt as a user agent would (RFC 8291 §3.4 from the receiving side). */
async function uaDecrypt(message,uaPrivateJwk,uaPublic,auth){
 const salt=message.slice(0,16),idlen=message[20],asPublic=message.slice(21,21+idlen),ct=message.slice(21+idlen);
 const h=async(k,d)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']),d));
 const priv=await crypto.subtle.importKey('jwk',uaPrivateJwk,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
 const pub=await crypto.subtle.importKey('raw',asPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const ecdh=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:pub},priv,256));
 const e=new TextEncoder();
 const ikm=await h(await h(auth,ecdh),concat(e.encode('WebPush: info\0'),uaPublic,asPublic,new Uint8Array([1])));
 const prk=await h(salt,ikm);
 const cek=(await h(prk,concat(e.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16);
 const nonce=(await h(prk,concat(e.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),ct));
 assert.equal(pt[pt.length-1],2,'last-record delimiter');
 return new TextDecoder().decode(pt.slice(0,-1));
}

test('fresh keys: a user agent decrypts what sendPush posts, with a valid VAPID JWT',async()=>{
 const ua=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const uaPublic=new Uint8Array(await crypto.subtle.exportKey('raw',ua.publicKey)),auth=crypto.getRandomValues(new Uint8Array(16));
 const vk=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',vk.privateKey);
 const vapid={publicKey:base64url(await crypto.subtle.exportKey('raw',vk.publicKey)),privateKey:jwk.d,subject:'mailto:ops@nerulio.test'};
 let seen;
 const status=await sendPush({endpoint:'https://fcm.googleapis.com/fcm/send/abc',p256dh:base64url(uaPublic),auth:base64url(auth)},{title:'t',body:'한글 본문'},{vapid,now:Date.UTC(2026,8,29),topic:'usage',urgency:'high',fetch:async(url,init)=>{seen={url,init};return new Response(null,{status:201});}});
 assert.equal(status,201);
 assert.equal(seen.init.headers['Content-Encoding'],'aes128gcm');
 assert.equal(seen.init.headers.Urgency,'high');assert.equal(seen.init.headers.Topic,'usage');
 const text=await uaDecrypt(seen.init.body,await crypto.subtle.exportKey('jwk',ua.privateKey),uaPublic,auth);
 assert.deepEqual(JSON.parse(text),{title:'t',body:'한글 본문'});
 // VAPID: t=<jwt>, k=<public key>; ES256 over header.payload; aud = push service origin.
 const m=/^vapid t=([^,]+), k=(.+)$/.exec(seen.init.headers.Authorization);
 assert(m);assert.equal(m[2],vapid.publicKey);
 const [h,p,s]=m[1].split('.');
 const claims=JSON.parse(new TextDecoder().decode(fromBase64url(p)));
 assert.equal(claims.aud,'https://fcm.googleapis.com');assert.equal(claims.sub,vapid.subject);
 assert(claims.exp*1000>Date.UTC(2026,8,29)&&claims.exp*1000<=Date.UTC(2026,8,29)+24*36e5);
 assert.equal(JSON.parse(new TextDecoder().decode(fromBase64url(h))).alg,'ES256');
 assert(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},vk.publicKey,fromBase64url(s),new TextEncoder().encode(`${h}.${p}`)));
});

test('subscriptions: only https push services, well-formed keys',()=>{
 const keys={p256dh:RFC.uaPublic,auth:RFC.auth};
 assert.equal(parseSubscription({endpoint:'https://fcm.googleapis.com/fcm/send/x',keys}).endpoint,'https://fcm.googleapis.com/fcm/send/x');
 assert(parseSubscription({endpoint:'https://updates.push.services.mozilla.com/wpush/v2/x',keys}));
 for(const endpoint of ['http://fcm.googleapis.com/x','https://evil.example/x','https://fcm.googleapis.com.evil.example/x','https://127.0.0.1/x','https://fcm.googleapis.com:8443/x','https://u:p@fcm.googleapis.com/x'])
  assert.throws(()=>parseSubscription({endpoint,keys}),undefined,endpoint);
 assert.throws(()=>parseSubscription({endpoint:'https://fcm.googleapis.com/x',keys:{p256dh:'abc',auth:RFC.auth}}));
 assert.throws(()=>parseSubscription({endpoint:'https://fcm.googleapis.com/x',keys:{p256dh:RFC.uaPublic,auth:'short'}}));
});

test('VAPID config: both keys required, subject falls back to the site',()=>{
 assert.equal(vapidFromEnv({},'https://nerulio.test'),null);
 assert.equal(vapidFromEnv({VAPID_PUBLIC_KEY:RFC.asPublic},'https://nerulio.test'),null);
 const v=vapidFromEnv({VAPID_PUBLIC_KEY:RFC.asPublic,VAPID_PRIVATE_KEY:RFC.asPrivate},'https://nerulio.test');
 assert.equal(v.subject,'https://nerulio.test');
 assert.equal(vapidFromEnv({VAPID_PUBLIC_KEY:RFC.asPublic,VAPID_PRIVATE_KEY:RFC.asPrivate,VAPID_SUBJECT:'mailto:a@b.c'},'x').subject,'mailto:a@b.c');
});
