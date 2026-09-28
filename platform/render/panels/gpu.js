// @ts-check
/** GPU channel: latest driver + "problems after updating?" reports, which open models fit in this
 * card's VRAM (labelled ESTIMATE, platform/estimates/llm-memory.js) next to community measurements,
 * the community benchmark board, and the official spec sheet in the wiki box. */
import {html} from '../html.js';
import {t} from '../strings.js';
import {box,badge,nameOf,channelUrl,postUrl,kindChip} from '../ui.js';
import {isoDateText,int} from '../format.js';
import {related,factsFor,pickFact,versionsOf,benchmarksOn,issueCounts,openModels,entitiesWithFact,entitiesByIds,channelPosts} from '../../db/channel.js';
import {estimateLlmMemory,METHOD} from '../../estimates/llm-memory.js';
import {factRows} from './generic.js';

const QUANT='Q4_K_M';
/** @param {import('./index.js').PanelContext} ctx */
async function load(ctx){
 const {db,entity:e}=ctx;
 const vram=Number(pickFact(ctx.facts,'vram_gb')?.value||0);
 // Independent reads run together (every D1 query is a round trip).
 const [madeBy,driverRel,bench,models,succOut,succIn,sameVram,benchPage]=await Promise.all([related(db,e.id,'out',['made_by']),related(db,e.id,'in',['related_to','runs_on']),
  benchmarksOn(db,e.id),vram>0?openModels(db):Promise.resolve([]),related(db,e.id,'out',['successor_of']),related(db,e.id,'in',['successor_of']),
  vram?entitiesWithFact(db,'gpu','vram_gb',vram,8):Promise.resolve([]),channelPosts(db,e.id,{kind:'benchmark',sort:'top',limit:3})]);
 const vendor=madeBy[0]?.entity||null;
 // Only drivers linked to this card (a data-center branch is not a GeForce card's driver).
 const drivers=driverRel.map(r=>r.entity).filter(x=>x.type==='driver');
 const [df,driverVersions]=await Promise.all([factsFor(db,drivers.map(x=>x.id)),Promise.all(drivers.map(dr=>versionsOf(db,dr.id,1)))]);
 let driver=null;
 for(const [i,dr] of drivers.entries()){
  const v=driverVersions[i][0];const latest=v?.version||pickFact(df.get(dr.id),'latest_version')?.value;
  if(!latest)continue;
  const at=v?(v.released_at??v.detected_at):0;
  if(!driver||at>driver.at)driver={entity:dr,version:String(latest),at,notes:v?.notes_url||null,issues:await issueCounts(db,dr.id,String(latest))};
 }
 // Representative open models: the two largest that fit, the largest that is tight, the smallest that does not fit.
 /** @type {any[]} */let fit=[];
 if(vram>0){
  const est=models.map(m=>({...m,r:estimateLlmMemory({paramsB:m.paramsB,quant:QUANT,vramGiB:vram})})).sort((a,b)=>a.paramsB-b.paramsB);
  const fits=est.filter(x=>x.r.verdict==='fits'),tight=est.filter(x=>x.r.verdict==='tight'),no=est.filter(x=>x.r.verdict==='does_not_fit');
  const pickSizes=(/** @type {typeof est} */ list,/** @type {number} */ n)=>{const out=[];const seen=new Set();for(const x of [...list].reverse()){const k=Math.round(x.paramsB);if(seen.has(k))continue;seen.add(k);out.push(x);if(out.length===n)break;}return out.reverse();};
  fit=[...pickSizes(fits,2),...pickSizes(tight,1),...no.slice(0,1)].map(x=>({...x,measured:bench.filter(b=>b.entity_id===x.entity.id&&typeof b.metrics.tokens_per_s==='number').map(b=>b.metrics.tokens_per_s)}));
 }
 // Benchmark board: median per (model, runtime, quant).
 /** @type {Map<string,{model:string,runtime:string,quant:string,values:number[]}>} */const groups=new Map();
 for(const b of bench){const v=b.metrics.tokens_per_s;if(typeof v!=='number')continue;const k=[b.entity_id,b.env.runtime||'',b.env.quant||''].join('|');const g=groups.get(k)||{model:b.entity_id,runtime:String(b.env.runtime||''),quant:String(b.env.quant||''),values:[]};g.values.push(v);groups.set(k,g);}
 const succ=[...succOut,...succIn].map(r=>r.entity);
 const same=sameVram.filter(x=>x.id!==e.id);
 const similar=[...new Map([...succ,...same].map(x=>[x.id,x])).values()].slice(0,5);
 const [sf,benchNames]=await Promise.all([factsFor(db,similar.map(x=>x.id)),entitiesByIds(db,[...groups.values()].map(g=>g.model))]);
 const board=[...groups.values()].sort((a,b)=>b.values.length-a.values.length).slice(0,6).map(g=>({...g,name:benchNames.get(g.model)?nameOf(/** @type {any} */(benchNames.get(g.model)),ctx.l):g.model,median:median(g.values)}));
 // 벤치 posts on this channel: shown with the board, so a measurement written as a post is not
 // hidden behind "no reports yet".
 const benchPosts=benchPage.posts;
 return {vendor,driver,vram,fit,board,benchPosts,similar:similar.map(x=>({e:x,vram:pickFact(sf.get(x.id),'vram_gb')?.value}))};
}
const median=(/** @type {number[]} */ v)=>{const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function top(d,ctx){
 const {l,entity:e}=ctx,s=t(l).panel;
 const dr=d.driver;
 const issues=dr?dr.issues:{};
 const ok=(issues.works||0),bad=(issues.works_with_issues||0)+(issues.broken||0),n=ok+bad;
 const driver=!dr?'':box({title:s.driver,extra:badge('AUTOMATED',l)},dr?html`<div class="kv pad"><a href="${channelUrl(l,dr.entity)}" class="big">${dr.version}</a><span class="fine">${nameOf(dr.entity,l)}${dr.at?` · ${isoDateText(new Date(dr.at).toISOString().slice(0,10))}`:''}</span></div>
<div class="pad top-line"><span><b>${s.driverOk}</b> ${t(l).panel.reports(n)}</span>${n>=5?html`<div class="meter"><span class="bar"><i class="okc" style="width:${Math.round(ok/n*100)}%"></i></span><b>${s.noProblem} ${Math.round(ok/n*100)}%</b></div>`:''}
<div class="vbs" data-island="issue-vote" data-entity="${dr.entity.id}" data-version="${dr.version}"><button class="vb" type="button" disabled>${s.noProblem}</button><button class="vb" type="button" disabled>${s.problem}</button></div></div>`:html`<p class="empty">${s.noDriver}</p>`);
 const VERDICT=/** @type {Record<string,[string,string]>} */({fits:[s.fits,'fy'],tight:[s.tight,'fm'],does_not_fit:[s.noFit,'fn']});
 const fit=d.fit.length?box({title:s.localAi,extra:html`<a class="st e" href="#estimate-method">${s.estimateMethod}</a>`,note:`${QUANT} · ${l==='ko'?'KV 캐시 제외':'KV cache excluded'}`},html`<ul class="fitg">${d.fit.map(x=>{const [lab,cls]=VERDICT[/** @type {string} */(x.r.verdict)];return html`<li class="fit"><a class="fine" href="${channelUrl(l,x.entity)}">${nameOf(x.entity,l)}</a><b class="${cls}">${lab}</b><span class="fine">≈ ${x.r.gib.total.low.toFixed(1)}–${x.r.gib.total.high.toFixed(1)} GiB</span><span class="fine">${x.measured.length?html`${l==='ko'?'측정 중앙값':'measured median'} <b>${int(Math.round(median(x.measured)*10)/10,l)}</b> tok/s · ${s.measured(x.measured.length)}`:s.noMeasure}</span></li>`;})}</ul>
<p class="fine pad"><a href="${channelUrl(l,ctx.entity)}local-llm">${l==='ko'?'모든 모델 보기 · 내 측정값 올리기 ›':'All models · post a measurement ›'}</a></p><details class="method" id="estimate-method"><summary>${l==='ko'?'추정 방법':'How this is estimated'}</summary><p>${METHOD.method[/** @type {'ko'|'en'} */(l)]||METHOD.method.en}</p></details>`):'';
 const empty=d.benchPosts.length?(l==='ko'?'아직 표로 모은 측정값이 없습니다. 아래 벤치 글의 수치를 “측정값 올리기”로 남기면 중앙값에 들어갑니다.':'No structured measurements yet. Add the numbers from the posts below to count them.'):s.benchEmpty;
 const posts=d.benchPosts.length?html`<ul class="rows">${d.benchPosts.map(p=>html`<li>${kindChip('benchmark',l)}<a class="tt" href="${postUrl(l,e,p.post_no)}">${p.title}${p.comments?html`<span class="cmt">[${p.comments}]</span>`:''}</a><span class="fine">${p.up?`▲ ${p.up}`:''}</span></li>`)}</ul>`:'';
 const board=box({title:s.benchBoard,extra:badge('COMMUNITY',l),note:s.benchNote},html`${d.board.length?html`<div class="tw"><table class="mt"><thead><tr><th>${s.task}</th><th>${s.setting}</th><th>${s.median}</th><th>${s.count}</th></tr></thead><tbody>${d.board.map(b=>html`<tr><td>${b.name}</td><td>${[b.runtime,b.quant].filter(Boolean).join(' · ')}</td><td><b>${int(Math.round(b.median*10)/10,l)} tok/s</b></td><td>${b.values.length}</td></tr>`)}</tbody></table></div>`:html`<p class="empty">${empty}</p>`}${posts}
<p class="fine pad"><a href="${channelUrl(l,e)}local-llm#bench">${l==='ko'?'측정값 올리기 ›':'Add a measurement ›'}</a> · <a href="${channelUrl(l,e)}?kind=benchmark">${l==='ko'?'벤치 글 모두 보기 ›':'All benchmark posts ›'}</a></p>`);
 return html`<div class="g2 c">${driver}${fit}</div>${board}`;
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function wiki(d,ctx){
 const {l}=ctx;
 return html`<table class="wk"><tbody>${d.vendor?html`<tr><th>${l==='ko'?'제조사':'Vendor'}</th><td><a href="${channelUrl(l,d.vendor)}">${nameOf(d.vendor,l)}</a></td></tr>`:''}${factRows(ctx)}</tbody></table>`;
}
/** @param {Awaited<ReturnType<typeof load>>} d @param {import('./index.js').PanelContext} ctx */
function side(d,ctx){
 const {l}=ctx,s=t(l).panel;
 return d.similar.length?box({title:s.similar},html`<ul class="rows">${d.similar.map(x=>html`<li><a class="tt" href="${channelUrl(l,x.e)}">${nameOf(x.e,l)}</a>${x.vram?html`<span class="fine">${x.vram} GB</span>`:''}<a class="fine" href="/${l}/hardware/?type=gpu&vs=${[ctx.entity.slug,x.e.slug].sort().join(',')}">${l==='ko'?'비교 ›':'Compare ›'}</a></li>`)}</ul>`):'';
}

/** @type {import('./index.js').Panel} */
export default {id:'gpu',types:['hardware:gpu'],load,top,wiki,side};
