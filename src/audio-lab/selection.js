/** Selection helpers for Audio Lab. They read the waveform overview (min/max pairs per bucket), not the full PCM,
 * so results are accurate to one overview bucket; one extra bucket is kept on each side so audible audio is not cut.
 */
export const EDGE_THRESHOLD_DB=-50;
/** First and last overview bucket whose absolute peak reaches thresholdDb, as seconds. Returns null when none does. */
export function audibleRange(peaks,duration,thresholdDb=EDGE_THRESHOLD_DB){const n=peaks?peaks.length>>1:0,limit=10**(thresholdDb/20);if(!n||!(duration>0)||!Number.isFinite(limit))return null;let first=-1,last=-1;
 for(let i=0;i<n;i++)if(Math.max(Math.abs(peaks[i*2]),Math.abs(peaks[i*2+1]))>=limit){if(first<0)first=i;last=i;}
 if(first<0)return null;const start=Math.floor(Math.max(0,first-1)/n*duration*1000+1e-6)/1000;let end=Math.min(duration,Math.ceil(Math.min(n,last+2)/n*duration*1000-1e-6)/1000);if(end-start<.01)end=Math.min(duration,start+.01);
 return {start,end,resolution:duration/n,trimmedStart:start,trimmedEnd:Math.max(0,duration-end)};}
/** Clamp a start/end pair to the file and to the editor's 10 ms minimum length. */
export function clampSelection(start,end,duration){if(!(duration>0))return {start:0,end:0};let a=Number.isFinite(start)?start:0,b=Number.isFinite(end)?end:duration;if(a>b)[a,b]=[b,a];a=Math.min(Math.max(0,a),Math.max(0,duration-.01));b=Math.min(duration,Math.max(a+.01,b));return {start:a,end:b};}
const TICK_STEPS=[.01,.02,.05,.1,.2,.5,1,2,5,10,15,30,60];
/** Ruler ticks for a visible time range: the finest "nice" step that needs at most maxTicks labels. */
export function timeTicks(start,end,maxTicks=8){const span=end-start;if(!(span>0)||!Number.isFinite(span)||!(maxTicks>=1))return {step:0,digits:0,ticks:[]};const step=TICK_STEPS.find(s=>span/s<=maxTicks)||TICK_STEPS[TICK_STEPS.length-1],digits=step>=1?0:step>=.1?1:2,ticks=[];
 for(let k=Math.ceil(start/step-1e-9);k*step<=end+1e-9&&ticks.length<=maxTicks+1;k++)ticks.push(+(k*step).toFixed(2));return {step,digits,ticks};}
