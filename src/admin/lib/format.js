// @ts-check
/** Pure formatting for the admin app: Korean relative times, KST clock times, numbers.
 * No DOM access, so tests/admin.test.mjs runs it in Node. Timestamps from the API are epoch
 * milliseconds (the D1 convention); ISO strings and epoch seconds are accepted too. */

const TZ='Asia/Seoul';

/** @param {unknown} v @returns {number|null} epoch ms */
export function toMs(v){
 if(v===null||v===undefined||v==='')return null;
 if(typeof v==='number'&&Number.isFinite(v))return v<1e11?v*1000:v;   // seconds → ms
 if(typeof v==='string'){
  if(/^\d+$/.test(v))return toMs(Number(v));
  const t=Date.parse(v);return Number.isFinite(t)?t:null;
 }
 if(v instanceof Date)return v.getTime();
 return null;
}

/** Parts of a timestamp in KST. @param {number} ms */
function kst(ms){
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 /** @type {Record<string,string>} */const o={};for(const p of f.formatToParts(new Date(ms)))o[p.type]=p.value;
 return {y:Number(o.year),m:Number(o.month),d:Number(o.day),hh:o.hour==='24'?'00':o.hour,mm:o.minute,ss:o.second};
}
/** KST calendar day "YYYY-MM-DD" of a timestamp. @param {unknown} v */
export function kstDay(v){const ms=toMs(v);if(ms===null)return '';const k=kst(ms);return `${k.y}-${String(k.m).padStart(2,'0')}-${String(k.d).padStart(2,'0')}`;}
/** "08:50" in KST. @param {unknown} v */
export function clock(v){const ms=toMs(v);if(ms===null)return '—';const k=kst(ms);return `${k.hh}:${k.mm}`;}
/** "08:50:05" in KST. @param {unknown} v */
export function clockSec(v){const ms=toMs(v);if(ms===null)return '—';const k=kst(ms);return `${k.hh}:${k.mm}:${k.ss}`;}
/** "9/29 08:50" in KST. @param {unknown} v */
export function dateTime(v){const ms=toMs(v);if(ms===null)return '—';const k=kst(ms);return `${k.m}/${k.d} ${k.hh}:${k.mm}`;}
/** "9/29" in KST. @param {unknown} v */
export function shortDate(v){const ms=toMs(v);if(ms===null)return '—';const k=kst(ms);return `${k.m}/${k.d}`;}

/** A day-relative clock: "08:50" today, "어제 08:50", "9/21 08:50" otherwise (all KST).
 * @param {unknown} v @param {number} [now] */
export function dayClock(v,now=Date.now()){
 const ms=toMs(v);if(ms===null)return '—';
 const d=kstDay(ms);
 if(d===kstDay(now))return clock(ms);
 if(d===kstDay(now-864e5))return `어제 ${clock(ms)}`;
 return dateTime(ms);
}

/** Korean relative time: "방금", "3분 전", "2시간 전", "어제", "4일 전", then a date.
 * Future times read "3분 뒤", "2시간 뒤". @param {unknown} v @param {number} [now] */
export function relTime(v,now=Date.now()){
 const ms=toMs(v);if(ms===null)return '—';
 const diff=now-ms,future=diff<0,a=Math.abs(diff);
 const s=Math.round(a/1000),m=Math.floor(a/6e4),h=Math.floor(a/36e5),d=Math.floor(a/864e5);
 if(s<45)return future?'곧':'방금';
 if(m<60)return `${Math.max(1,m)}분 ${future?'뒤':'전'}`;
 if(h<24)return `${h}시간 ${future?'뒤':'전'}`;
 if(!future&&kstDay(ms)===kstDay(now-864e5))return '어제';
 if(d<7)return `${d}일 ${future?'뒤':'전'}`;
 return shortDate(ms);
}

/** "1,240" (Korean grouping); '—' for missing values. @param {unknown} n */
export function num(n){
 if(n===null||n===undefined||n===''||!Number.isFinite(Number(n)))return '—';
 return Math.round(Number(n)).toLocaleString('ko-KR');
}
/** Short Korean magnitudes: 100000 → "10만", 5000000 → "500만", 12500 → "1.3만", 980 → "980".
 * @param {unknown} n */
export function compact(n){
 const v=Number(n);if(!Number.isFinite(v))return '—';
 const a=Math.abs(v);
 if(a>=1e8)return trim(v/1e8)+'억';
 if(a>=1e4)return trim(v/1e4)+'만';
 return num(v);
}
/** @param {number} x */
const trim=x=>{const r=Math.abs(x)>=100?Math.round(x):Math.round(x*10)/10;return String(r).replace(/\.0$/,'');};
/** Percentage with one decimal under 10 %: 1.24 → "1.2%", 45.6 → "46%". @param {number} part @param {number} whole */
export function pct(part,whole){
 if(!whole||!Number.isFinite(part)||!Number.isFinite(whole))return '0%';
 const p=part/whole*100;
 if(p>0&&p<0.1)return '<0.1%';
 return (p<10?Math.round(p*10)/10:Math.round(p))+'%';
}
/** Duration of a run: "7.6초", "2분 5초". @param {unknown} start @param {unknown} end */
export function duration(start,end){
 const a=toMs(start),b=toMs(end);if(a===null||b===null||b<a)return '';
 const s=(b-a)/1000;
 if(s<60)return `${Math.round(s*10)/10}초`;
 const m=Math.floor(s/60),r=Math.round(s%60);
 return r?`${m}분 ${r}초`:`${m}분`;
}
/** Hours as a Korean span: 24 → "24시간", 168 → "7일", 0.5 → "30분". @param {unknown} h */
export function hoursSpan(h){
 const v=Number(h);if(!Number.isFinite(v)||v<=0)return '—';
 if(v<1)return `${Math.round(v*60)}분`;
 if(v>=48&&v%24===0)return `${v/24}일`;
 return `${v}시간`;
}
/** The same day shifted by n days, as YYYY-MM-DD (calendar arithmetic, no time zone).
 * @param {string} day @param {number} n */
export function shiftDay(day,n){
 const [y,m,d]=day.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d+n));
 return t.toISOString().slice(0,10);
}
