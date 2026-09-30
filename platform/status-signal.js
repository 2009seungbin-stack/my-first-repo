// @ts-check
/** Nerulio users' outage reports ("안 돼요" clicks) as a signal: reports per hour for the last 24
 * hours, the usual rate from the week before, and a spike when the last rolling hour has reports from
 * at least SPIKE.minReports different people and SPIKE.factor × the usual rate. Used by the status page
 * and by the status box on AI channels, so both say the same thing. Below that it is "리포트 N건".
 * (2026-09-30: 3 reports were enough before, so a few curious clicks on a quiet site read as 급증.) */
const HOUR=36e5,DAY=864e5;
export const SPIKE=Object.freeze({minReports:5,factor:5});
/** Different people among reports: the account, or for a signed-out click ('anon') the day's network key it
 * stored as env.who; a row with neither counts as one person. @param {Report[]} rows */
const people=rows=>new Set(rows.map((r,i)=>r.user_id&&r.user_id!=='anon'?`u:${r.user_id}`:r.env?.who?`a:${r.env.who}`:`#${i}`)).size;
/** @typedef {{created_at:number,user_id?:string|null,env?:{who?:string}}} Report */
/** What an outage click can say went wrong (the status page's buttons; the API accepts only these). */
export const SYMPTOMS=Object.freeze({down:{ko:'접속 안 됨',en:'Won’t load'},slow:{ko:'느림',en:'Slow'},error:{ko:'오류 메시지',en:'Errors'},login:{ko:'로그인 안 됨',en:'Can’t sign in'},limit:{ko:'한도 오류',en:'Limit errors'}});

/** @param {Report[]} reports at least the last 8 days @param {number} now */
export function reportSignal(reports,now){
 const hourStart=Math.floor(now/HOUR)*HOUR;
 const hours=Array.from({length:24},(_,i)=>{const from=hourStart-(23-i)*HOUR;return {from,n:reports.filter(r=>r.created_at>=from&&r.created_at<from+HOUR).length};});
 const week=reports.filter(r=>r.created_at<hourStart-23*HOUR&&r.created_at>=hourStart-23*HOUR-7*DAY).length;
 const baseline=week/(7*24);
 const last=hours[23].n+hours[22].n*((HOUR-(now-hourStart))/HOUR);   // a rolling hour across the boundary
 const who=people(reports.filter(r=>r.created_at>now-HOUR&&r.created_at<=now));
 const spike=who>=SPIKE.minReports&&last>=SPIKE.minReports&&last>=SPIKE.factor*Math.max(baseline,0.34);
 return {hours,baseline,last:Math.round(last),people:who,spike,total24:hours.reduce((a,h)=>a+h.n,0)};
}

/** Spikes of the last `days` days as episodes, per clock hour: an hour is a spike hour when it has at least
 * SPIKE.minReports reports from different people and SPIKE.factor × the usual hourly rate of the 7 days before it. Consecutive
 * spike hours make one episode; the one still going (its last hour is the current hour, or the rolling
 * hour of reportSignal is a spike now) has no end. For the status feed: when a spike started and ended.
 * @param {Report[]} reports the last `days` + 7 days @param {number} now @param {number} [days]
 * @returns {{start:number,end:number|null,peak:number}[]} oldest first */
export function spikeEpisodes(reports,now,days=14){
 const hourStart=Math.floor(now/HOUR)*HOUR,first=hourStart-(days*24-1)*HOUR;
 const times=reports.map(r=>r.created_at).sort((a,b)=>a-b);
 /** Different people in [from,to). @param {number} from @param {number} to */
 const who=(from,to)=>people(reports.filter(r=>r.created_at>=from&&r.created_at<to));
 /** Reports in [from,to). @param {number} from @param {number} to */
 const count=(from,to)=>{let lo=0,hi=times.length;while(lo<hi){const m=(lo+hi)>>1;if(times[m]<from)lo=m+1;else hi=m;}let n=0;for(let i=lo;i<times.length&&times[i]<to;i++)n++;return n;};
 /** @type {{start:number,end:number|null,peak:number}[]} */const out=[];let cur=null;
 for(let h=first;h<=hourStart;h+=HOUR){
  const n=count(h,h+HOUR),base=count(h-7*DAY,h)/(7*24);
  const hit=n>=SPIKE.minReports&&n>=SPIKE.factor*Math.max(base,0.34)&&who(h,h+HOUR)>=SPIKE.minReports;
  if(hit){if(!cur){cur={start:h,end:/** @type {number|null} */(null),peak:n};out.push(cur);}else cur.peak=Math.max(cur.peak,n);}
  else if(cur){cur.end=h;cur=null;}
 }
 // The rolling hour can be a spike before the clock hour has enough reports: that is an episode too.
 const sig=reportSignal(reports,now);
 const last=out[out.length-1];
 if(sig.spike&&!cur){if(last&&last.end===hourStart)last.end=null;else out.push({start:hourStart,end:null,peak:sig.last});}
 return out;
}
