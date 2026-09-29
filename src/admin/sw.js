/* Nerulio 관리 — service worker, scope /admin/ (classic script: runs on every browser that installs PWAs).
 *  - App shell: cached at install (the build writes the file list and a content hash below), served
 *    cache-first so the app opens offline; page loads try the network first to pick up a deploy.
 *  - Admin data (/api/v2/admin/*, /api/v2/mod/queue): network-first; offline, the last copy is served
 *    with x-admin-offline: <saved at ms> so the app shows an offline banner and the copy's age.
 *    Passkey endpoints and every non-GET request always go to the network.
 *  - push → a notification whose data.url is a /admin/#/… deep link; notificationclick focuses the
 *    open app (and tells it which screen to show) or opens a new window there. */
'use strict';
const VERSION='dev';            // build: content hash of the app (tools/admin-build.mjs)
const SHELL=[];                 // build: every file of the app, as /admin/… paths
const SHELL_CACHE='admin-shell-'+VERSION,DATA_CACHE='admin-data',FONT_CACHE='admin-fonts',META_CACHE='nerulio-admin-meta';
const DEV=VERSION==='dev';

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(SHELL.map(p=>new Request(p,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('admin-shell-')&&k!==SHELL_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

/** Admin data the app may show offline. */
function isData(path){return /^\/api\/v2\/admin\//.test(path)&&!/^\/api\/v2\/admin\/passkey\//.test(path)||path==='/api/v2/mod/queue';}

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin===self.location.origin){
  if(url.pathname.startsWith('/api/')){if(isData(url.pathname))event.respondWith(networkFirst(req));return;}
  if(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))event.respondWith(shell(req));
  return;
 }
 if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')event.respondWith(cacheFirst(req,FONT_CACHE));
});

async function networkFirst(req){
 const cache=await caches.open(DATA_CACHE);
 try{
  const res=await fetch(req);
  if(res.status===200){
   const h=new Headers(res.headers);h.set('x-admin-saved',String(Date.now()));
   const copy=new Response(await res.clone().arrayBuffer(),{status:200,headers:h});
   await cache.put(req,copy);
  }
  return res;
 }catch(e){
  const hit=await cache.match(req);
  if(hit){
   const h=new Headers(hit.headers);h.set('x-admin-offline',hit.headers.get('x-admin-saved')||String(Date.now()));
   return new Response(await hit.arrayBuffer(),{status:200,headers:h});
  }
  return new Response(JSON.stringify({error:{code:'OFFLINE',message:'Offline and nothing saved.'}}),{status:503,headers:{'content-type':'application/json'}});
 }
}
async function shell(req){
 const cache=await caches.open(SHELL_CACHE);
 if(req.mode==='navigate'||DEV){
  try{
   const res=await fetch(req);
   if(res.ok&&DEV)await cache.put(req,res.clone());
   return res;
  }catch(e){
   return (await cache.match(req,{ignoreSearch:true}))||(await cache.match('/admin/'))||(await cache.match('/admin/index.html'))||new Response('오프라인입니다.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
 }
 const hit=await cache.match(req,{ignoreSearch:true});
 if(hit)return hit;
 const res=await fetch(req);
 if(res.ok)await cache.put(req,res.clone());
 return res;
}
async function cacheFirst(req,name){
 const cache=await caches.open(name);
 const hit=await cache.match(req);if(hit)return hit;
 try{const res=await fetch(req);if(res.ok||res.type==='opaque')await cache.put(req,res.clone());return res;}
 catch(e){return new Response('',{status:504});}
}

/* ---------- push ---------- */
const TITLES={collector_failed:'수집기 실패',usage:'이번 달 D1 쓰기',status_stale:'상태 수집 멈춤',flag:'새 신고',flags:'새 신고',proposal:'정보 제안',conflict:'사실 충돌',new_user:'새 가입자',ai_incident:'AI 서비스 장애',test:'테스트 알림'};
/** The screen a notification opens: the sender's url when it points inside the app, else by kind. */
function deepLink(d){
 const raw=typeof d.url==='string'?d.url:'';
 const m=/^(?:\/admin\/?)?(#\/[\w\-\/%.:~]*)$/.exec(raw);
 if(m)return m[1];
 const p=d.payload||{};
 switch(d.kind){
  case 'collector_failed':return p.id||p.adapter?'#/collectors/'+encodeURIComponent(p.id||p.adapter):'#/collectors';
  case 'flag':case 'flags':return '#/mod';
  case 'proposal':case 'conflict':return '#/data';
  case 'new_user':return '#/community';
  case 'traffic':return '#/traffic';
  default:return '#/';
 }
}
self.addEventListener('push',event=>{
 let d={};
 try{d=event.data?event.data.json():{};}catch(e){d={body:event.data?event.data.text():''};}
 if(!d||typeof d!=='object')d={};
 const title=String(d.title||TITLES[d.kind]||'Nerulio 관리');
 const opts={body:String(d.body||''),icon:'/admin/icons/icon-192.png',badge:'/admin/icons/badge-96.png',tag:String(d.tag||d.kind||'nerulio-admin'),renotify:!!d.tag,data:{url:'/admin/'+deepLink(d)},timestamp:Number(d.at)||Date.now(),lang:'ko'};
 event.waitUntil(self.registration.showNotification(title,opts));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=(event.notification.data&&event.notification.data.url)||'/admin/#/';
 const hash=url.slice(url.indexOf('#'))||'#/';
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  const c=list.find(w=>{try{return new URL(w.url).pathname.startsWith('/admin');}catch(e){return false;}});
  if(c){c.postMessage({type:'navigate',hash});return c.focus();}
  return self.clients.openWindow('/admin/'+hash);
 }));
});
/** The browser rotated the push subscription: subscribe again with the same key and prefs. */
self.addEventListener('pushsubscriptionchange',event=>{
 event.waitUntil((async()=>{
  let prefs=null;
  try{const hit=await (await caches.open(META_CACHE)).match('/admin/__prefs');if(hit)prefs=await hit.json();}catch(e){}
  const old=event.oldSubscription;
  let sub=event.newSubscription;
  const key=old&&old.options&&old.options.applicationServerKey;
  if(!sub&&key)sub=await self.registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  if(!sub)return;
  const post=(method,body)=>fetch('/api/v2/admin/push/subscribe',{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).catch(()=>null);
  await post('POST',{subscription:sub.toJSON(),prefs});
  if(old&&old.endpoint&&old.endpoint!==sub.endpoint)await post('DELETE',{endpoint:old.endpoint});
 })());
});
self.addEventListener('message',event=>{
 const d=event.data||{};
 if(d.type==='clear-data')event.waitUntil(caches.delete(DATA_CACHE));
});
