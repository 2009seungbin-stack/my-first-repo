// @ts-check
/** 커뮤니티: one KST day of posts, comments, sign-ups and reports, the 7-day trend, busiest channels,
 * posts by vertical and new members. Data: GET /api/v2/admin/community?day=YYYY-MM-DD. */
import {h} from '../lib/dom.js';
import {box,vt,failure,fill,skeleton,empty} from '../lib/ui.js';
import {spark,hbars} from '../lib/charts.js';
import {num,kstDay,shiftDay,dayClock,shortDate} from '../lib/format.js';
import {VERTICALS} from '../lib/labels.js';

export const title='커뮤니티';
export const tab='home';
export const back='#/';
/** @type {string|null} */let day=null;

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 const today=kstDay(ctx.now());
 if(!day||day>today)day=today;
 fill(main,dayNav(ctx,today),skeleton(4));
 let d;
 try{d=await ctx.api.get(`/api/v2/admin/community?day=${day}`);}catch(e){fill(main,dayNav(ctx,today),failure(e,()=>ctx.refresh()));return;}
 const t=d?.tiles||{},sp=Array.isArray(d?.spark)?d.spark:[],ch=Array.isArray(d?.channels)?d.channels:[],vs=Array.isArray(d?.verticals)?d.verticals:[],nu=Array.isArray(d?.newUsers)?d.newUsers:[];
 const nothing=!Number(t.posts)&&!Number(t.comments)&&!Number(t.users)&&!Number(t.flags)&&!ch.length&&!nu.length&&!sp.some((/** @type {any} */ x)=>Number(x.posts)||Number(x.comments));
 if(nothing){fill(main,dayNav(ctx,today),box('',null,empty('아직 글·댓글·가입자가 없습니다','게시판을 공개하고 첫 글이 올라오면 이 화면이 채워집니다.')),ctx.stamp(d?.generatedAt));return;}
 const prev=sp.length>1?sp[sp.length-2]:null,diff=prev?Number(t.posts||0)-Number(prev.posts||0):null;
 fill(main,dayNav(ctx,today),
  h('div.tiles',
   h('div.tile',h('span.lb','글'),h('span.v',num(t.posts)),h('span.s',diff===null?'':`전날보다 ${diff>=0?'+':''}${diff}`)),
   h('div.tile',h('span.lb','댓글'),h('span.v',num(t.comments)),h('span.s',Number(t.posts)?`글당 ${Math.round(Number(t.comments)/Number(t.posts)*10)/10}`:'')),
   h('div.tile',h('span.lb','새 가입'),h('span.v',num(t.users)),h('span.s','패스키·Google 로그인')),
   h('a.tile',{href:'#/mod'},h('span.lb','신고'),h('span.v',num(t.flags)),h('span.s','신고 처리 ›'))),
  sp.length?box(`최근 ${sp.length}일 글 수`,sp.length?`${shortDate(sp[0].day)}–${shortDate(sp[sp.length-1].day)}`:null,h('div.pad',
   spark(sp.map((/** @type {any} */ x)=>Number(x.posts)||0),`최근 ${sp.length}일 글 수: ${sp.map((/** @type {any} */ x)=>Number(x.posts)||0).join(', ')}`),
   h('div.mlab',h('span',`${shortDate(sp[0].day)} ${num(sp[0].posts)}`),h('span',`${shortDate(sp[sp.length-1].day)} ${num(sp[sp.length-1].posts)}`)),
   h('p.fine',`같은 기간 댓글 ${num(sp.reduce((/** @type {number} */ n,/** @type {any} */ x)=>n+(Number(x.comments)||0),0))}개`))):null,
  box('많이 쓴 채널','글 · 댓글',ch.length?h('ul.rows',...ch.map((/** @type {any} */ c)=>h('li',h('span.tt',h('b',c.name||c.entity_id),' ',vt(c.vertical||String(c.entity_id||'').split(':')[0])),h('span.r',`${num(c.posts)} · ${num(c.comments)}`)))):empty('이 날 글이 올라온 채널이 없습니다')),
  vs.length?box('분야별 글',null,h('div.pad',hbars(vs.map((/** @type {any} */ v)=>({label:VERTICALS[v.vertical]||v.vertical,value:Number(v.posts??v.n)||0}))))):null,
  box('새 가입자',nu.length?`${nu.length}명`:null,nu.length?h('ul.rows',...nu.map((/** @type {any} */ u)=>h('li',h('span.tt',h('b',u.name||u.display_name||'회원'),h('span.l2',[`${dayClock(u.created_at,ctx.now())} 가입`,u.posts!=null&&`글 ${num(u.posts)}`,u.comments!=null&&`댓글 ${num(u.comments)}`].filter(Boolean).join(' · ')))))):empty('이 날 새 가입자가 없습니다')),
  ctx.stamp(d?.generatedAt));
}
/** @param {any} ctx @param {string} today */
function dayNav(ctx,today){
 const d=/** @type {string} */(day);
 return h('div.daynav',
  h('button.btn.sm',{type:'button','aria-label':'전날',onclick:()=>{day=shiftDay(d,-1);ctx.refresh();}},'‹ 전날'),
  h('b',{'aria-live':'polite'},d===today?`오늘 (${shortDate(d)})`:d===shiftDay(today,-1)?`어제 (${shortDate(d)})`:shortDate(d)),
  h('button.btn.sm',{type:'button','aria-label':'다음 날',disabled:d>=today,onclick:()=>{day=shiftDay(d,1);ctx.refresh();}},'다음 날 ›'));
}
