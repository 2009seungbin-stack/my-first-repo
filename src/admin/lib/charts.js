// @ts-check
/** Small charts drawn with HTML boxes (heights/widths through CSSOM, so no inline style attributes
 * and no SVG text distortion): meter, sparkline, human-vs-bot column series, horizontal bars.
 * Series colors: human = --c-human (brand blue), bot = --c-bot (orange); validated pair
 * (dataviz validator, light + dark). Every chart has a text alternative. */
import {h,s} from './dom.js';
import {num,clock,shortDate,pct} from './format.js';

/** A usage meter with a warning tick. @param {number} ratio @param {{tick?:number,label:string}} o */
export function meter(ratio,{tick=0.8,label}){
 const f=h('div.f'+(ratio>=1?'.full':ratio>=tick?'.warnf':''));f.style.width=Math.max(0,Math.min(1,ratio))*100+'%';
 const t=h('div.tick');t.style.left=tick*100+'%';
 return h('div.meter',{role:'img','aria-label':label},f,t);
}
/** Area sparkline (one series). @param {number[]} values @param {string} label */
export function spark(values,label){
 const v=values.length?values:[0],max=Math.max(1,...v),W=300,H=44,step=v.length>1?(W-8)/(v.length-1):0;
 const pts=v.map((x,i)=>[4+i*step,H-3-(x/max)*(H-8)]);
 const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
 return s('svg',{class:'spark',viewBox:`0 0 ${W} ${H}`,preserveAspectRatio:'none',role:'img','aria-label':label},
  s('line',{x1:0,y1:H-1,x2:W,y2:H-1,class:'axis'}),
  s('path',{d:`${line} L${pts[pts.length-1][0].toFixed(1)} ${H-1} L${pts[0][0].toFixed(1)} ${H-1}Z`,class:'area'}),
  s('path',{d:line,class:'line','vector-effect':'non-scaling-stroke'}));
}
/** Two-part share bar (human vs bot) with a 2px gap. @param {number} human @param {number} bot */
export function shareBar(human,bot){
 const all=human+bot||1;
 const a=h('i.c-human'),b=h('i.c-bot');a.style.flexGrow=String(human);b.style.flexGrow=String(bot);
 return h('div.share',{role:'img','aria-label':`사람 ${num(human)} (${pct(human,all)}), 봇 ${num(bot)} (${pct(bot,all)})`},human?a:null,bot?b:null);
}
/** @param {unknown} t @param {'today'|'7d'|'30d'} range */
const bucketLabel=(t,range)=>range==='today'?clock(t):shortDate(t);
/**
 * Stacked columns per bucket: human (bottom) + bot. Tap/hover/focus a column for its numbers;
 * the same numbers are in a table under "표로 보기".
 * @param {{t:any,human:number,bot:number}[]} series @param {'today'|'7d'|'30d'} range
 */
export function columns(series,range){
 const max=Math.max(1,...series.map(x=>x.human+x.bot));
 const tip=h('div.tip',{role:'status','aria-live':'polite',hidden:true});
 const show=(/** @type {any} */ x,/** @type {HTMLElement} */ col)=>{
  tip.replaceChildren(h('b',bucketLabel(x.t,range)),h('span',h('i.key.c-human'),`사람 ${num(x.human)}`),h('span',h('i.key.c-bot'),`봇 ${num(x.bot)}`));
  tip.hidden=false;
  const wrap=col.parentElement?.getBoundingClientRect(),r=col.getBoundingClientRect();
  if(wrap){const left=r.left-wrap.left+r.width/2;tip.style.left=Math.max(60,Math.min(wrap.width-60,left))+'px';}
 };
 const cols=series.map(x=>{
  const hu=h('i.c-human'),bo=h('i.c-bot');
  hu.style.height=(x.human/max*100)+'%';bo.style.height=(x.bot/max*100)+'%';
  const col=h('button.col',{type:'button','aria-label':`${bucketLabel(x.t,range)} 사람 ${num(x.human)}, 봇 ${num(x.bot)}`},x.bot?bo:null,x.human?hu:null);
  col.addEventListener('pointerenter',()=>show(x,col));col.addEventListener('focus',()=>show(x,col));col.addEventListener('click',()=>show(x,col));
  return col;
 });
 const plot=h('div.cols',...cols);
 plot.addEventListener('pointerleave',()=>{tip.hidden=true;});
 const first=series[0],last=series[series.length-1],mid=series[Math.floor(series.length/2)];
 const axis=h('div.xaxis',h('span',first?bucketLabel(first.t,range):''),h('span',series.length>2&&mid?bucketLabel(mid.t,range):''),h('span',last&&series.length>1?bucketLabel(last.t,range):''));
 const legend=h('div.legend',h('span',h('i.key.c-human'),'사람'),h('span',h('i.key.c-bot'),'봇'),h('span.fine','최고 '+num(max)));
 const table=h('details.tablev',h('summary','표로 보기'),h('table',h('thead',h('tr',h('th',{scope:'col'},range==='today'?'시각':'날짜'),h('th',{scope:'col'},'사람'),h('th',{scope:'col'},'봇'))),
  h('tbody',...series.map(x=>h('tr',h('td',bucketLabel(x.t,range)),h('td',num(x.human)),h('td',num(x.bot)))))));
 return h('div.chart',legend,h('div.plotw',tip,plot),axis,table);
}
/** Horizontal bars with labels and values. @param {{label:any,value:number,cls?:string}[]} rows @param {number} [max] */
export function hbars(rows,max){
 const m=max||Math.max(1,...rows.map(r=>r.value));
 return h('div.hbs',...rows.map(r=>{const i=h('i'+(r.cls?'.'+r.cls:''));i.style.width=(r.value/m*100)+'%';return h('div.hb',h('span.hl',r.label),h('span.tr',{'aria-hidden':'true'},i),h('span.n',num(r.value)));}));
}
