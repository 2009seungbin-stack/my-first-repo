// @ts-check
/** Reader-facing formatting shared by every platform renderer: numbers, money, dates, relative
 * times and fact values. Korean pages use Korea time; English pages use UTC. */
import {propertyDef} from '../verticals/index.js';
import {label} from '../labels.js';

export const TZ=/** @type {Record<string,string>} */({ko:'Asia/Seoul',en:'UTC'});
const DAY=864e5;

/** 1,234 → "1,234"; 12,480 → "1.2만" (ko) / "12.5K" (en), as community boards show counts. */
export function compact(/** @type {number} */ n,/** @type {string} */ l){
 if(!Number.isFinite(n))return '';
 const a=Math.abs(n);
 if(l==='ko'){
  if(a>=1e8)return trim(n/1e8)+'억';
  if(a>=1e4)return trim(n/1e4)+'만';
  if(a>=1e3)return trim(n/1e3)+'천';
  return String(n);
 }
 if(a>=1e6)return trim(n/1e6)+'M';
 if(a>=1e3)return trim(n/1e3)+'K';
 return String(n);
}
const trim=(/** @type {number} */ x)=>(Math.round(x*10)/10).toString();
export const int=(/** @type {number} */ n,/** @type {string} */ l)=>new Intl.NumberFormat(l==='ko'?'ko-KR':'en-US').format(n);

/** Amount with ISO currency. USD keeps cents only when present ($0.25, $4). */
export function money(/** @type {number} */ amount,/** @type {string} */ currency,/** @type {string} */ l){
 const cur=currency||'USD';
 const frac=Number.isInteger(amount)?0:2;
 try{return new Intl.NumberFormat(l==='ko'?'ko-KR':'en-US',{style:'currency',currency:cur,currencyDisplay:'narrowSymbol',minimumFractionDigits:frac,maximumFractionDigits:frac}).format(amount);}
 catch{return `${amount} ${cur}`;}
}

/** Parts of a timestamp in the page's time zone. */
function parts(/** @type {number} */ ms,/** @type {string} */ l){
 const f=new Intl.DateTimeFormat('en-CA',{timeZone:TZ[l]||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'});
 /** @type {Record<string,string>} */const o={};for(const p of f.formatToParts(new Date(ms)))o[p.type]=p.value;
 return o;
}
/** Board-style time: "14:32" today, "09.27" this year, "2025.10.02" before. */
export function boardTime(/** @type {number} */ ms,/** @type {number} */ now,/** @type {string} */ l){
 const a=parts(ms,l),b=parts(now,l);
 if(a.year===b.year&&a.month===b.month&&a.day===b.day)return `${a.hour}:${a.minute}`;
 if(a.year===b.year)return `${a.month}.${a.day}`;
 return `${a.year}.${a.month}.${a.day}`;
}
/** "2026.09.28 14:18" */
export function fullTime(/** @type {number} */ ms,/** @type {string} */ l){const a=parts(ms,l);return `${a.year}.${a.month}.${a.day} ${a.hour}:${a.minute}`;}
/** Date at the stored precision: 2025-03 → "2025.03", 2025-03-05 → "2025.03.05". */
export function isoDateText(/** @type {string} */ s){return String(s).replace(/-/g,'.');}
export function dateText(/** @type {number} */ ms,/** @type {string} */ precision,/** @type {string} */ l){
 const a=parts(ms,precision==='time'?l:'en');
 if(precision==='year')return a.year;
 if(precision==='month')return `${a.year}.${a.month}`;
 if(precision==='time')return `${a.year}.${a.month}.${a.day} ${a.hour}:${a.minute}`;
 return `${a.year}.${a.month}.${a.day}`;
}
const WEEKDAY_KO=/** @type {Record<string,string>} */({Mon:'월',Tue:'화',Wed:'수',Thu:'목',Fri:'금',Sat:'토',Sun:'일'});
/** "10월 3일 (금) 23:30" / "Fri, Oct 3, 23:30 UTC" */
export function eventTime(/** @type {number} */ ms,/** @type {string} */ precision,/** @type {string} */ l){
 if(precision!=='time'&&precision!=='day')return dateText(ms,precision,l);
 const a=parts(ms,precision==='time'?l:'en');
 if(l==='ko')return `${+a.month}월 ${+a.day}일 (${WEEKDAY_KO[a.weekday]||a.weekday})${precision==='time'?` ${a.hour}:${a.minute}`:''}`;
 const d=new Intl.DateTimeFormat('en-US',{timeZone:precision==='time'?'UTC':'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(ms));
 return precision==='time'?`${d}, ${a.hour}:${a.minute} UTC`:d;
}
/** Whole days from now to ms in the page's calendar (D-4 = four calendar days ahead). */
export function daysUntil(/** @type {number} */ ms,/** @type {number} */ now,/** @type {string} */ l){
 const a=parts(ms,l),b=parts(now,l);
 return Math.round((Date.UTC(+a.year,+a.month-1,+a.day)-Date.UTC(+b.year,+b.month-1,+b.day))/DAY);
}
export function dday(/** @type {number} */ ms,/** @type {number} */ now,/** @type {string} */ l){
 const d=daysUntil(ms,now,l);
 return d===0?'D-DAY':d>0?`D-${d}`:`D+${-d}`;
}
/** "3분 전" / "3 min ago" */
export function ago(/** @type {number} */ ms,/** @type {number} */ now,/** @type {string} */ l){
 const s=Math.max(0,Math.round((now-ms)/1000));
 const [n,u]=s<60?[s,'s']:s<3600?[Math.floor(s/60),'m']:s<86400?[Math.floor(s/3600),'h']:[Math.floor(s/86400),'d'];
 if(l==='ko')return u==='s'?'방금':`${n}${{m:'분',h:'시간',d:'일'}[u]} 전`;
 return u==='s'?'just now':`${n}${{m:' min',h:' h',d:' d'}[u]} ago`;
}

/** Token counts: 1000000 → "1M", 200000 → "200K". */
export function tokens(/** @type {number} */ n){
 if(n>=1e6)return trim(n/1e6)+'M';
 if(n>=1e3)return trim(n/1e3)+'K';
 return String(n);
}

/**
 * A fact value as text using the vertical's property definition (units, enums, money, lists).
 * @param {string} vertical @param {{property:string,value:any,unit?:string|null}} f @param {string} l
 */
export function factText(vertical,f,l){
 const def=propertyDef(vertical,f.property),v=f.value;
 if(v===null||v===undefined)return '';
 const type=def?.type;
 if(type==='money')return money(Number(v),f.unit||def?.unit||'USD',l);
 if(type==='tokens')return tokens(Number(v));
 if(type==='date')return isoDateText(v);
 if(type==='bool')return v?(l==='ko'?'예':'Yes'):(l==='ko'?'아니요':'No');
 if(type==='enum'){const e=def?.values?.[v];return e?label(e,l):String(v);}
 if(type==='list')return (Array.isArray(v)?v:[v]).map(x=>PLATFORM_NAMES[x]||x).join(' · ');
 if(type==='url'){try{return new URL(v).host.replace(/^www\./,'');}catch{return String(v);}}
 if(type==='number'){const unit=f.unit||def?.unit;return int(Number(v),l)+(unit?` ${unit}`:'');}
 return String(v);
}
export const PLATFORM_NAMES=/** @type {Record<string,string>} */({web:'Web',ios:'iOS',android:'Android',windows:'Windows',macos:'macOS',linux:'Linux',api:'API'});

/** Several builds of one channel on the same day (Korea time) become one line:
 * "0.60.2 → 0.60.5 (4건)". Input newest first, as recentVersions returns it.
 * @template {{version:string,released_at:number,entity:{id:string}}} V @param {V[]} list @param {string} l @returns {V[]} */
export function collapseVersions(list,l){
 /** @type {Map<string,V[]>} */const groups=new Map();/** @type {string[]} */const order=[];
 for(const v of list){
  const k=v.entity.id+'|'+new Date(v.released_at+(l==='ko'?9*36e5:0)).toISOString().slice(0,10);
  if(!groups.has(k)){groups.set(k,[]);order.push(k);}
  /** @type {V[]} */(groups.get(k)).push(v);
 }
 return order.map(k=>{const g=/** @type {V[]} */(groups.get(k));if(g.length===1)return g[0];
  // Same-day builds may share a timestamp: order them by version number, not by arrival.
  const byVer=[...g].sort((a,b)=>String(a.version).localeCompare(String(b.version),undefined,{numeric:true}));
  const newest=byVer[byVer.length-1],oldest=byVer[0];
  return {...newest,version:`${oldest.version} → ${newest.version} (${l==='ko'?`${g.length}건`:`${g.length} builds`})`};});
}

/** "≈ ₩29,400" for a USD amount at a reference rate (rounded to ₩100; an approximation, never a price).
 * @param {number} usd @param {{rate:number,asOf:string}|null} fx @param {string} l */
export function approxKrw(usd,fx,l){
 if(!fx||!(usd>0)||l!=='ko')return '';
 return `≈ ₩${(Math.round(usd*fx.rate/100)*100).toLocaleString('ko-KR')}`;
}
