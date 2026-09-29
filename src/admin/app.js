// @ts-check
/** Nerulio 관리 — the owner-only admin PWA (/admin/). Vanilla ES modules, no framework.
 * Hash routes (#/, #/collectors, #/collectors/:id, #/mod, #/data, #/traffic, #/community,
 * #/notifications, #/settings, #/setup) so a static host serves every screen from one file and a
 * notification can deep-link into any of them. Auth: passkey session (ADMIN-CONTRACT.md); a 404
 * from /api/v2/admin/me means "not an admin" and shows the sign-in screen. */
import {h,icon,logo,replace} from './lib/dom.js';
import {createApi,AdminError} from './lib/api.js';
import {badges} from './lib/model.js';
import {relTime} from './lib/format.js';
import {toast,confirmSheet,failure,fill} from './lib/ui.js';
import {login,passkeyError,lastCredential} from './lib/passkey.js';
import {currentSubscription} from './lib/push.js';
import * as home from './screens/home.js';
import * as collectors from './screens/collectors.js';
import * as collector from './screens/collector.js';
import * as mod from './screens/mod.js';
import * as data from './screens/data.js';
import * as community from './screens/community.js';
import * as traffic from './screens/traffic.js';
import * as notify from './screens/notify.js';
import * as settings from './screens/settings.js';
import {signIn,setup} from './screens/auth.js';

/** @typedef {{title:string,tab:string,back?:string,render:(ctx:any,main:HTMLElement,params:any)=>Promise<void>}} Screen */
const ROUTES=/** @type {[RegExp,Screen,((m:RegExpExecArray)=>any)?][]} */([
 [/^$/,home],[/^collectors$/,collectors],[/^collectors\/(.+)$/,collector,m=>({id:decodeURIComponent(m[1])})],
 [/^mod$/,mod],[/^data$/,data],[/^traffic$/,traffic],[/^community$/,community],[/^notifications$/,notify],[/^settings$/,settings],
]);
const TABS=[{id:'home',href:'#/',label:'홈',icon:'home'},{id:'collectors',href:'#/collectors',label:'수집기',icon:'pulse'},{id:'mod',href:'#/mod',label:'신고',icon:'flag'},{id:'data',href:'#/data',label:'데이터',icon:'data'},{id:'traffic',href:'#/traffic',label:'방문자',icon:'visitors'}];
const VERSION=document.querySelector('meta[name="admin-version"]')?.getAttribute('content')||'dev';

/* ---------- shell ---------- */
const backBtn=h('a.ib.backl',{href:'#/','aria-label':'뒤로'},icon('back',{width:2.2}));
const titleEl=h('span.ttl');
const env=envLabel();
const badgeSlot=h('span.hbadge');
const refreshBtn=h('button.ib',{type:'button','aria-label':'새로 고침',onclick:()=>ctx.refresh()},icon('refresh'));
const bellBtn=h('a.ib',{href:'#/notifications','aria-label':'알림 설정'},icon('bell'),h('span.dot',{hidden:true}));
const gearBtn=h('a.ib',{href:'#/settings','aria-label':'설정'},icon('gear'));
const actions=h('div.acts',refreshBtn,bellBtn,gearBtn);
const appbar=h('header.ab',backBtn,h('div.t',h('span.lg',logo(24)),titleEl,env?h('span.env',env):null),h('span.sp'),badgeSlot,actions);
const offline=h('div.offline',{role:'status',hidden:true},icon('offline',{size:18}),h('span'));
const ptr=h('div.ptr',{'aria-hidden':'true'},icon('refresh',{size:18}),h('span','당겨서 새로 고침'));
const main=h('main#main',{tabindex:'-1'});
const tabs=h('nav.bn',{'aria-label':'주요 화면'},...TABS.map(t=>h('a',{href:t.href,'data-tab':t.id},icon(t.icon,{size:22}),h('span',t.label),h('span.bdg',{hidden:true}))));
const app=/** @type {HTMLElement} */(document.getElementById('app'));
replace(app,appbar,offline,ptr,main,tabs);

/* ---------- state + context ---------- */
let authed=false,renderSeq=0,lastOverviewAt=0;
/** @type {number|null} */let servedOfflineAt=null;
/** @type {any} */let deferredInstall=null;
const rawApi=createApi({served:(_p,off)=>noteServed(off)});
const api=createApi({served:(_p,off)=>noteServed(off),reauth,signedOut:()=>{forget();if(authed){authed=false;ctx.me=null;route();}}});
/** Signed out or not an admin: drop the offline copies of admin data from this device. */
function forget(){try{caches.delete('admin-data').catch(()=>{});}catch{}}
const ctx={
 api,rawApi,version:VERSION,
 /** @type {any} */me:null,/** @type {any} */overview:null,
 now:()=>Date.now(),
 async loadOverview(){const ov=await api.get('/api/v2/admin/overview');ctx.overview=ov;lastOverviewAt=Date.now();paintBadges();return ov;},
 refresh:()=>route({keepScroll:true}),
 go:(/** @type {string} */ hash)=>{location.hash=hash;},
 /** @param {string} text @param {{mono?:boolean}} [o] */
 setTitle(text,o={}){titleEl.textContent=text;titleEl.classList.toggle('mono',!!o.mono);},
 /** @param {Node|null} node */setBadge(node){replace(badgeSlot,node);},
 /** "업데이트 3분 전" (or the offline copy's age) under each screen. @param {any} at */
 stamp(at){
  const t=servedOfflineAt||Number(new Date(at||Date.now()))||Date.now();
  return h('p.stamp',servedOfflineAt?`오프라인 · 저장된 화면 (${relTime(t,Date.now())})`:`업데이트 ${relTime(t,Date.now())}`);
 },
 signedIn:(/** @type {string} */ msg)=>{authed=false;boot(msg);},
 signedOut:()=>{forget();authed=false;ctx.me=null;ctx.overview=null;location.hash='#/';route({reason:'signedout'});},
 canInstall:()=>!!deferredInstall,
 installed:()=>matchMedia('(display-mode: standalone)').matches||/** @type {any} */(navigator).standalone===true,
 async install(){if(!deferredInstall)return 'unavailable';deferredInstall.prompt();const r=await deferredInstall.userChoice.catch(()=>({outcome:'dismissed'}));deferredInstall=null;return r.outcome;},
 theme:()=>{try{return localStorage.getItem('nerulio-admin-theme')||'system';}catch{return 'system';}},
 /** @param {string} v */setTheme(v){try{localStorage.setItem('nerulio-admin-theme',v);}catch{}applyTheme();},
 currentDevice:()=>lastCredential(),
};

/** 401 REAUTH: one sheet, one fingerprint, then every waiting request is retried. */
async function reauth(){
 if(!authed)throw new AdminError({status:401,code:'REAUTH'});
 const ok=await confirmSheet({title:'다시 확인이 필요해요',body:[h('p','보안을 위해 12시간마다 지문(패스키)으로 한 번 더 확인해요.')],confirm:'지문으로 확인',
  run:async()=>{try{return await login(rawApi);}catch(e){throw Object.assign(new Error('passkey'),{userMessage:passkeyError(e)});}}});
 if(!ok)throw Object.assign(new AdminError({status:401,code:'REAUTH'}),{userMessage:'다시 확인을 취소했어요. 새로 고침하면 다시 물어봐요.'});
}
/** @param {number|null} off */
function noteServed(off){servedOfflineAt=off;paintOffline();}
function paintOffline(){
 const off=!navigator.onLine||servedOfflineAt!==null;
 offline.hidden=!off;
 /** @type {HTMLElement} */(offline.lastElementChild).textContent=servedOfflineAt!==null?`오프라인 · 저장된 화면을 보여주고 있어요 (${relTime(servedOfflineAt,Date.now())})`:'오프라인 · 연결되면 자동으로 새로 고칩니다';
 document.documentElement.classList.toggle('is-offline',off);
}
function paintBadges(){
 const b=badges(ctx.overview);
 for(const [id,n] of Object.entries({collectors:b.collectors,mod:b.mod,data:b.data})){
  const el=/** @type {HTMLElement|null} */(tabs.querySelector(`[data-tab="${id}"] .bdg`));
  if(el){el.hidden=!n;el.textContent=n>99?'99+':String(n);}
 }
 const tabLinks=tabs.querySelectorAll('a');
 for(const a of tabLinks){const n=/** @type {HTMLElement} */(a.querySelector('.bdg'));a.setAttribute('aria-label',`${a.querySelector('span')?.textContent}${n&&!n.hidden?`, ${n.textContent}건`:''}`);}
 const total=b.collectors+b.mod;
 const nav=/** @type {any} */(navigator);
 try{if(total&&nav.setAppBadge)nav.setAppBadge(total);else if(nav.clearAppBadge)nav.clearAppBadge();}catch{}
}
function envLabel(){
 const host=location.hostname;
 if(host==='localhost'||host==='127.0.0.1')return 'LOCAL';
 if(/\.pages\.dev$/.test(host)||/^preview\./.test(host))return 'PREVIEW';
 return '';
}
function applyTheme(){
 const t=ctx.theme(),root=document.documentElement;
 if(t==='light'||t==='dark')root.dataset.theme=t;else delete root.dataset.theme;
 const dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
 document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content',dark?'#1f3f86':'#2b62d6');
}

/* ---------- routing ---------- */
/** @param {{keepScroll?:boolean,reason?:string}} [o] */
async function route(o={}){
 const seq=++renderSeq;
 const path=decodeURIComponent(location.hash.replace(/^#\/?/,'')).replace(/\/+$/,'');
 const view=h('div.view');main.replaceChildren(view);
 if(!authed){
  document.body.classList.add('signed-out');
  backBtn.hidden=true;actions.hidden=true;tabs.hidden=true;replace(badgeSlot);ctx.setTitle('관리');
  if(path==='setup')setup(ctx,view);else signIn(ctx,view,{reason:o.reason});
  return;
 }
 document.body.classList.remove('signed-out');
 actions.hidden=false;tabs.hidden=false;
 let screen=/** @type {Screen} */(home),params={};
 let found=false;
 for(const [re,s,p] of ROUTES){const m=re.exec(path);if(m){screen=s;params=p?p(m):{};found=true;break;}}
 if(!found&&path==='setup'){location.hash='#/settings';return;}
 ctx.setTitle(screen.title);replace(badgeSlot);
 backBtn.hidden=!screen.back;backBtn.setAttribute('href',screen.back||'#/');
 bellBtn.hidden=!!screen.back;gearBtn.hidden=!!screen.back;
 for(const a of tabs.querySelectorAll('a')){const on=a.getAttribute('data-tab')===screen.tab;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
 if(!o.keepScroll)window.scrollTo(0,0);
 refreshBtn.classList.add('spin');servedOfflineAt=null;
 try{await screen.render(ctx,view,params);}
 catch(e){if(seq===renderSeq)fill(view,failure(e,()=>ctx.refresh()));}
 if(seq===renderSeq){refreshBtn.classList.remove('spin');paintOffline();}
 // Badges stay current on every tab without refetching on each navigation.
 if(screen!==home&&Date.now()-lastOverviewAt>60000)ctx.loadOverview().catch(()=>{});
 if(!o.keepScroll&&document.activeElement===document.body)main.focus({preventScroll:true});
 paintBell();
}
async function paintBell(){
 let on=false;try{on=!!(await currentSubscription());}catch{}
 const dot=/** @type {HTMLElement} */(bellBtn.querySelector('.dot'));
 dot.hidden=on;bellBtn.setAttribute('aria-label',on?'알림 설정':'알림 설정 (알림 꺼짐)');
}

/* ---------- boot ---------- */
/** @param {string} [msg] */
async function boot(msg){
 applyTheme();
 try{
  const me=await rawApi.get('/api/v2/admin/me');
  if(!me||me.admin!==true)throw new AdminError({status:404,code:'NOT_ADMIN'});
  ctx.me=me;authed=true;
  if(location.hash==='#/setup')location.hash='#/';
  await route();
  if(msg)toast(msg);
 }catch(e){
  authed=false;
  if(e instanceof AdminError&&(e.code==='NOT_ADMIN'||e.code==='REAUTH'||e.status===401)){if(e.code==='NOT_ADMIN')forget();route({reason:e.code==='REAUTH'?'reauth':undefined});return;}
  // Not configured / offline / server error: say so, with a retry.
  document.body.classList.add('signed-out');tabs.hidden=true;actions.hidden=true;backBtn.hidden=true;
  main.replaceChildren(h('div.view',h('div.auth',h('div.auth-logo',logo(56)),h('h1','Nerulio 관리'),failure(e,()=>boot()))));
  paintOffline();
 }
}
window.addEventListener('hashchange',()=>route());
window.addEventListener('online',()=>{paintOffline();if(authed)ctx.refresh();else boot();});
window.addEventListener('offline',paintOffline);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
window.addEventListener('appinstalled',()=>{deferredInstall=null;toast('홈 화면에 설치했어요');});
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',applyTheme);

/* Service worker: app shell offline, network-first admin API, push + deep links. */
if('serviceWorker' in navigator){
 const hadController=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.register('/admin/sw.js',{scope:'/admin/'}).catch(()=>{});
 navigator.serviceWorker.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='navigate'&&typeof d.hash==='string'&&d.hash.startsWith('#/')){if(location.hash===d.hash)ctx.refresh();else location.hash=d.hash;}
 });
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadController)toast('새 버전이 준비됐어요',{action:{label:'새로 고침',run:()=>location.reload()},ms:10000});});
}

/* Pull to refresh (at the top of the page, touch only). */
{
 let y0=-1,dy=0;
 window.addEventListener('touchstart',e=>{if(window.scrollY<=0&&authed&&!document.querySelector('dialog[open]')){y0=e.touches[0].clientY;dy=0;}},{passive:true});
 window.addEventListener('touchmove',e=>{if(y0<0)return;dy=e.touches[0].clientY-y0;if(dy>8){ptr.classList.add('on');ptr.style.transform=`translateY(${Math.min(dy,90)/2}px)`;/** @type {HTMLElement} */(ptr.lastElementChild).textContent=dy>70?'놓으면 새로 고침':'당겨서 새로 고침';}},{passive:true});
 window.addEventListener('touchend',()=>{if(y0<0)return;ptr.classList.remove('on');ptr.style.transform='';if(dy>70)ctx.refresh();y0=-1;dy=0;});
}

boot();
