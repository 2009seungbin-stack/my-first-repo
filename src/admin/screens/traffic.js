// @ts-check
/** 방문자 (봇/사람): human pageviews vs bot requests, where people come from (source, device, browser,
 * language, country), bots by category with 확인됨/자칭/의심, top pages for each, the hourly/daily
 * series, and what the Worker can and cannot see.
 * Data: GET /api/v2/admin/traffic?range=today|7d|30d (server/traffic.js; 503 NOT_CONFIGURED lists `missing`). */
import {h,icon} from '../lib/dom.js';
import {box,seg,chips,failure,fill,skeleton,empty,toast} from '../lib/ui.js';
import {columns,shareBar,hbars} from '../lib/charts.js';
import {num,pct} from '../lib/format.js';
import {trafficView} from '../lib/model.js';
import {BOT_CATEGORIES,BOT_CLASS,SOURCES,DEVICES,LANGS} from '../lib/labels.js';

export const title='방문자';
export const tab='traffic';
/** @type {'today'|'7d'|'30d'} */let range='today';
let category='all';
/** @type {'human'|'bot'} */let pages='human';
/** @type {'sources'|'devices'|'browsers'|'locales'|'countries'} */let facet='sources';

let regionNames=/** @type {Intl.DisplayNames|null} */(null);
try{regionNames=new Intl.DisplayNames(['ko'],{type:'region'});}catch{}
/** @param {string} facetName @param {string} key */
function facetLabel(facetName,key){
 if(facetName==='sources')return SOURCES[key]||key;
 if(facetName==='devices')return DEVICES[key]||key;
 if(facetName==='locales')return LANGS[key]||key;
 if(facetName==='countries'){if(!key||key==='XX')return '알 수 없음';if(key==='T1')return 'Tor';if(/^[A-Z]{2}$/.test(key)){try{return regionNames?.of(key)||key;}catch{return key;}}return key;}
 return key||'기타';
}

/** @param {any} ctx @param {HTMLElement} main */
export async function render(ctx,main){
 const rangeBar=()=>seg([{value:'today',label:'오늘'},{value:'7d',label:'7일'},{value:'30d',label:'30일'}],range,v=>{range=/** @type {any} */(v);ctx.refresh();},'기간');
 fill(main,rangeBar(),skeleton(5));
 let t;
 try{t=await ctx.api.get(`/api/v2/admin/traffic?range=${range}`);}catch(e){fill(main,rangeBar(),failure(e,()=>ctx.refresh(),'TRAFFIC'));return;}
 const v=trafficView(t);
 const draw=()=>{
  const cats=Object.keys(BOT_CATEGORIES).filter(k=>v.byCategory[k]);
  const bots=category==='all'?v.bots:v.bots.filter(b=>b.category===category);
  const facets=/** @type {const} */([['sources','경로'],['devices','기기'],['browsers','브라우저'],['locales','언어'],['countries','국가']]).filter(([k])=>v.breakdown[k].length);
  if(facets.length&&!facets.some(([k])=>k===facet))facet=facets[0][0];
  fill(main,rangeBar(),
   coverageBox(v.coverage),
   box(range==='today'?'오늘 사람 vs 봇':range==='7d'?'최근 7일 사람 vs 봇':'최근 30일 사람 vs 봇',null,h('div.pad',
    h('div.duo',
     h('div',h('span.lb',h('i.key.c-human',{'aria-hidden':'true'}),'사람 페이지뷰'),h('span.big',num(v.pageviews)),h('span.fine',v.visitors!=null?`방문 시작 ${num(v.visitors)} (추정)`:`사람 요청 ${num(v.human)}`)),
     h('div',h('span.lb',h('i.key.c-bot',{'aria-hidden':'true'}),'봇 요청'),h('span.big',num(v.bot)),h('span.fine',`전체의 ${pct(v.bot,v.all)} · AI 봇 ${num(v.aiBotRequests)}`))),
    shareBar(v.human,v.bot),
    h('dl.kv.small',h('dt','확인된 봇'),h('dd',num(v.verified)),h('dt','자칭 봇'),h('dd',num(v.declared)),h('dt','봇 의심'),h('dd',num(v.suspected)),
     v.unconfirmed?[h('dt','사람 확인 전'),h('dd',num(v.unconfirmed))]:null))),
   box(range==='today'?'시간별':'일별',null,h('div.pad',v.series.length?columns(v.series,range):empty('아직 기록이 없습니다'))),
   facets.length?box('사람은 어디서 왔나',null,
    h('div.pad.tight',chips(facets.map(([k,l])=>({value:k,label:l})),facet,x=>{facet=/** @type {any} */(x);draw();},'나눠 보기')),
    h('div.pad',hbars(v.breakdown[facet].slice(0,10).map(x=>({label:facetLabel(facet,x.key),value:x.n,cls:'c-human'}))))):null,
   box('봇',`${v.bots.length}종`,
    cats.length?h('div.pad.tight',chips([{value:'all',label:'전체'},...cats.map(k=>({value:k,label:`${BOT_CATEGORIES[k]} ${num(v.byCategory[k])}`}))],category,x=>{category=x;draw();},'봇 분류')):null,
    bots.length?h('ul.rows',...bots.slice(0,40).map(b=>{
     const bar=h('i.c-bot');bar.style.width=(b.requests/(v.maxBot||1)*100)+'%';
     const cls=BOT_CLASS[b.cls];
     return h('li',h('span.tt',h('b',b.name),' ',h('span.vt.cat',BOT_CATEGORIES[b.category]||b.category),' ',
      h(`button.st.${cls.tone}.stb`,{type:'button','data-cls':b.cls,'aria-label':`${cls.label} — 설명 보기`,onclick:()=>toast(cls.help,{ms:6000})},cls.label,b.cls==='verified'?null:h('span.qi',{'aria-hidden':'true'},'?')),
      h('span.tr.botbar',{'aria-hidden':'true'},bar)),h('span.r',num(b.requests)));})):empty('봇 요청이 없습니다')),
   box('많이 본 페이지',null,
    h('div.pad.tight',seg([{value:'human',label:'사람'},{value:'bot',label:'봇'}],pages,x=>{pages=/** @type {any} */(x);draw();},'페이지 기준')),
    v.topPages[pages].length?h('div.pad',hbars(v.topPages[pages].slice(0,15).map((/** @type {any} */ p)=>({label:h('span.mono.path',String(p.path)),value:Number(p.n)||0,cls:pages==='bot'?'c-bot':'c-human'})))):empty('기록된 페이지가 없습니다')),
   h('p.fine','확인됨: 공개된 주소·Cloudflare 검증으로 확인한 봇. 자칭: 이름만 봇이라고 밝힌 요청 (GPTBot·ClaudeBot·Yeti는 확인 방법이 없어 항상 자칭). 의심: 밝히지 않았지만 자동화로 보이는 요청. 이 관리 앱(/admin/) 방문은 세지 않아요.'),
   ctx.stamp(t?.generatedAt));
 };
 draw();
}
/** What the numbers can and cannot include. @param {ReturnType<typeof trafficView>['coverage']} c */
function coverageBox(c){
 if(c.workerSeesHtml&&c.recording)return c.note?h('p.fine.covok',icon('check',{size:14}),' ',c.note):null;
 return h('div.note-box',{role:'note'},
  h('b',c.recording?'일부만 집계돼요':'지금은 기록하지 않아요'),
  h('p',c.note||'정적 HTML은 Worker를 거치지 않아 봇 요청이 빠질 수 있어요. 사람 수는 페이지 안 신호로 셉니다.'),
  c.seen.length||c.unseen.length?h('details.cov',h('summary','무엇이 집계되나요'),
   c.seen.length?h('p.fine','보이는 것: '+c.seen.map(seenText).join(', ')):null,
   c.unseen.length?h('p.fine','안 보이는 것: '+c.unseen.map(seenText).join(', ')):null):null);
}
/** @param {string} s */
function seenText(s){
 return ({'beacon':'사람 비콘','robots.txt':'robots.txt','sitemaps':'사이트맵','platform pages':'커뮤니티·채널 페이지','static HTML':'정적 HTML','JS/CSS/images (assets)':'JS·CSS·이미지 파일','static HTML without JavaScript (bots on tool pages)':'도구 페이지의 봇 (JavaScript 없는 정적 HTML)'})[s]||s;
}
