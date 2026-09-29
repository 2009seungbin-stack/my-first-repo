// @ts-check
/** Nerulio users' outage reports ("안 돼요" clicks) as a signal: reports per hour for the last 24
 * hours, the usual rate from the week before, and a spike when the last rolling hour has at least
 * SPIKE.minReports and SPIKE.factor × the usual rate. Used by the status page and by the status box
 * on AI channels, so both say the same thing. */
const HOUR=36e5,DAY=864e5;
export const SPIKE=Object.freeze({minReports:3,factor:3});
/** What an outage click can say went wrong (the status page's buttons; the API accepts only these). */
export const SYMPTOMS=Object.freeze({down:{ko:'접속 안 됨',en:'Won’t load'},slow:{ko:'느림',en:'Slow'},error:{ko:'오류 메시지',en:'Errors'},login:{ko:'로그인 안 됨',en:'Can’t sign in'},limit:{ko:'한도 오류',en:'Limit errors'}});

/** @param {{created_at:number}[]} reports at least the last 8 days @param {number} now */
export function reportSignal(reports,now){
 const hourStart=Math.floor(now/HOUR)*HOUR;
 const hours=Array.from({length:24},(_,i)=>{const from=hourStart-(23-i)*HOUR;return {from,n:reports.filter(r=>r.created_at>=from&&r.created_at<from+HOUR).length};});
 const week=reports.filter(r=>r.created_at<hourStart-23*HOUR&&r.created_at>=hourStart-23*HOUR-7*DAY).length;
 const baseline=week/(7*24);
 const last=hours[23].n+hours[22].n*((HOUR-(now-hourStart))/HOUR);   // a rolling hour across the boundary
 const spike=last>=SPIKE.minReports&&last>=SPIKE.factor*Math.max(baseline,0.34);
 return {hours,baseline,last:Math.round(last),spike,total24:hours.reduce((a,h)=>a+h.n,0)};
}
