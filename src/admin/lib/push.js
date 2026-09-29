// @ts-check
/** Web Push for the admin app: subscribe with the server's VAPID key, keep the preferences, and
 * leave a copy of them where the service worker can read it (pushsubscriptionchange). */
import {vapidKey,toB64url} from './b64.js';
import {normalizePrefs} from './model.js';

const PREFS_KEY='nerulio-admin-prefs',META_CACHE='nerulio-admin-meta',PREFS_URL='/admin/__prefs';

export function pushSupport(){
 const ok=typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 return {supported:ok,permission:ok?Notification.permission:'unsupported'};
}
/** @returns {Promise<PushSubscription|null>} */
export async function currentSubscription(){
 if(!pushSupport().supported)return null;
 const reg=await navigator.serviceWorker.getRegistration('/admin/');
 return reg?reg.pushManager.getSubscription():null;
}
/** Saved prefs (local copy; the server keeps the real ones). @param {any} [fromServer] */
export function loadPrefs(fromServer){
 if(fromServer)return normalizePrefs(fromServer);
 try{const v=localStorage.getItem(PREFS_KEY);if(v)return normalizePrefs(JSON.parse(v));}catch{}
 return normalizePrefs(null);
}
/** @param {any} prefs */
export async function stashPrefs(prefs){
 try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{}
 try{const c=await caches.open(META_CACHE);await c.put(PREFS_URL,new Response(JSON.stringify(prefs),{headers:{'content-type':'application/json'}}));}catch{}
}
/** @param {{get:Function,post:Function}} api @param {any} prefs */
export async function enablePush(api,prefs){
 const {publicKey}=await api.get('/api/v2/admin/push/key');
 const perm=await Notification.requestPermission();
 if(perm!=='granted')throw Object.assign(new Error('permission'),{name:'PermissionDenied',permission:perm});
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 // A subscription made with another key (the key was rotated) must be replaced.
 const key=sub?.options?.applicationServerKey;
 if(sub&&key&&toB64url(key)!==String(publicKey).replace(/=+$/,'')){await sub.unsubscribe().catch(()=>{});sub=null;}
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:/** @type {Uint8Array<ArrayBuffer>} */(vapidKey(publicKey))});
 await api.post('/api/v2/admin/push/subscribe',{subscription:sub.toJSON(),prefs});
 await stashPrefs(prefs);
 return sub;
}
/** @param {{del:Function}} api */
export async function disablePush(api){
 const sub=await currentSubscription();if(!sub)return;
 const endpoint=sub.endpoint;
 await api.del('/api/v2/admin/push/subscribe',{endpoint});
 await sub.unsubscribe().catch(()=>{});
}
