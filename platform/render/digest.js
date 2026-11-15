// @ts-check
/** 도구 실측·AI 해설 / Tool tests & AI commentary pages (/{l}/ai/digest/ and /{l}/ai/digest/{slug}/), rendered by the
 * Worker from the published articles of platform/digest.js. Ad markers (docs/ADS.md) sit only after
 * the article text, inside a [data-ad-host]; the platform pages do not load an ad script today. */
import {html,raw,safeHref} from './html.js';
import {page} from './ui.js';
import {renderMarkdown} from '../markdown.js';
import {digestArticles,digestArticle,digestIndexPath,digestArticlePath} from '../digest.js';
import {PLATFORM_LOCALES} from '../schema.js';

const other=(/** @type {string} */ l)=>PLATFORM_LOCALES.filter(x=>x!==l);
/** Editorial text: the safe Markdown renderer, with plain editorial links instead of the UGC rel. @param {string} md */
const articleHtml=md=>renderMarkdown(md,{headingBase:1,editorialImages:true}).replaceAll('rel="nofollow ugc noopener noreferrer"','rel="noopener"');
/** "2026-10-31" → "2026년 10월 31일" / "October 31, 2026". @param {string} d @param {string} l */
export function digestDate(d,l){
 const [y,m,day]=d.split('-').map(Number);
 return l==='ko'?`${y}년 ${m}월 ${day}일`:new Date(Date.UTC(y,m-1,day)).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
}
/** Minutes to read an article, from its own text: code blocks, link targets and Markdown marks are dropped,
 * then 500 characters a minute for Korean and 230 words a minute for English, rounded up (at least 1).
 * An approximation, shown with 약 / About. @param {string} md @param {string} l */
export function digestReadingMinutes(md,l){
 const text=String(md).replace(/```[\s\S]*?(```|$)/g,' ').replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[#>*_`|~-]+/g,' ');
 const n=l==='ko'?text.replace(/\s+/g,'').length/500:(text.match(/\S+/g)||[]).length/230;
 return Math.max(1,Math.ceil(n));
}
/** @param {string} md @param {string} l */
const readingLabel=(md,l)=>{const n=digestReadingMinutes(md,l);return l==='ko'?`읽는 데 약 ${n}분`:`About ${n} min read`;};
/** Give every section heading (h2) of rendered article HTML an id and list them for the table of contents.
 * The text is the heading's own escaped HTML with its tags removed, so it can be written out as it is.
 * @param {string} rendered @returns {{html:string,toc:{id:string,text:string}[]}} */
export function digestSections(rendered){
 /** @type {{id:string,text:string}[]} */
 const toc=[];
 const out=String(rendered).replace(/<h2>([\s\S]*?)<\/h2>/g,(_,inner)=>{
  const id=`sec-${toc.length+1}`;toc.push({id,text:String(inner).replace(/<[^>]+>/g,'').trim()});
  return `<h2 id="${id}" tabindex="-1">${inner}</h2>`;
 });
 return {html:out,toc};
}
/** The articles on either side of one in the published list (newest first): newer and older, or null.
 * @template {{slug:string}} T @param {T[]} list @param {string} slug @returns {{newer:T|null,older:T|null}} */
export function digestNeighbours(list,slug){
 const i=list.findIndex(a=>a.slug===slug);
 return {newer:i>0?list[i-1]:null,older:i>=0&&i<list.length-1?list[i+1]:null};
}
const editorialNote=(/** @type {boolean} */ ko)=>ko
 ?'게임 에셋과 파일 작업에 관한 실측과 출처 기반 해설입니다. AI 에이전트가 자료 조사·작성·기술 검증을 보조합니다. 자동 수집 뉴스와 구분하며, 실측 글에는 입력·설정·결과·한계를 공개합니다. 별도로 명시하지 않은 사람의 검토나 체험을 주장하지 않습니다. 오류는 사이트 하단의 문의 링크로 알려 주세요.'
 :'Measurements and source-based commentary for game assets and file workflows. AI agents assist with research, writing and technical checks. This is separate from automatically collected news. Test reports disclose inputs, settings, outputs and limits. Human review or experience is not claimed unless explicitly stated. Report corrections through the contact link in the footer.';

/** @param {{l:string,channels:{name:string,href:string}[]}} o @param {{origin:string,publicOnly?:boolean}} site */
export function renderDigestIndex(o,site){
 const {l}=o,ko=l==='ko',list=digestArticles(l),canonical=site.origin+digestIndexPath(l);
 const title=ko?'도구 실측·AI 해설 — 게임 에셋·파일 작업 | Nerulio':'Tool tests and AI commentary for game assets and file workflows | Nerulio';
 const description=ko?'직접 재현한 도구 실측과 AI·게임 에셋·파일 작업 해설. 원본과 결과, 설정, 출처와 한계를 함께 공개합니다.':'Reproducible tool tests and commentary for AI, game assets and file workflows, with inputs, outputs, settings, sources and limits.';
 // An empty index is thin: it stays reachable but is noindex, unlinked (digestLink) and unlisted.
 const alternates=list.length?Object.fromEntries([[l,canonical],...other(l).filter(x=>digestArticles(x).length).map(x=>[x,site.origin+digestIndexPath(x)])]):{};
 const items=list.length?html`<ol class="plist">${list.map(a=>html`<li class="pad"><h2 class="wt"><a href="${digestArticlePath(l,a.slug)}">${a.title}</a></h2><p class="fine"><time datetime="${a.date}">${digestDate(a.date,l)}</time> · ${readingLabel(a.body,l)}</p><p>${a.summary}</p></li>`)}</ol>`
  :html`<p class="empty">${ko?'아직 게시된 해설이 없습니다.':'No articles have been published yet.'}</p>`;
 const body=html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'도구 실측·AI 해설':'Tool tests & AI commentary'}</h1></div><p class="pad desc">${editorialNote(ko)}</p></section>
<section class="box" aria-label="${ko?'게시된 해설':'Published articles'}">${list.length?html`<p class="pad fine dg-count">${ko?`게시된 글 ${list.length}편 · 최신순`:`${list.length} published ${list.length===1?'article':'articles'} · newest first`}</p>`:''}${items}</section></div>`;
 const jsonld=list.length?{'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','@id':`${canonical}#webpage`,url:canonical,name:title,description,inLanguage:l,
  mainEntity:{'@type':'ItemList',itemListElement:list.map((a,i)=>({'@type':'ListItem',position:i+1,url:site.origin+digestArticlePath(l,a.slug),name:a.title}))}}]}:null;
 return page({publicOnly:site.publicOnly,l,title,description,canonical,alternates,noindex:!list.length,channels:o.channels,body,jsonld});
}

/** @param {{l:string,slug:string,channels:{name:string,href:string}[]}} o @param {{origin:string,publicOnly?:boolean}} site */
export function renderDigestArticle(o,site){
 const {l}=o,ko=l==='ko',a=digestArticle(l,o.slug);
 if(!a)return null;
 const canonical=site.origin+digestArticlePath(l,a.slug),index=site.origin+digestIndexPath(l),org=`${site.origin}/#organization`;
 // hreflang only between published translations of the same slug.
 const tr=other(l).map(x=>digestArticle(x,a.slug)).filter(x=>!!x);
 const alternates=tr.length?Object.fromEntries([[l,canonical],...tr.map(x=>[/** @type {any} */(x).locale,site.origin+digestArticlePath(/** @type {any} */(x).locale,a.slug)])]):{};
 const jsonld={'@context':'https://schema.org','@graph':[
  {'@type':'Article','@id':`${canonical}#article`,headline:a.title,description:a.summary,datePublished:a.date,dateModified:a.updated||a.date,inLanguage:l,url:canonical,
   author:{'@id':org},publisher:{'@id':org},isPartOf:{'@type':'CollectionPage','@id':`${index}#webpage`,url:index},
   citation:a.sources.map(s=>({'@type':'WebPage',url:s.url,name:s.title}))},
  {'@type':'BreadcrumbList','@id':`${canonical}#breadcrumb`,itemListElement:[
   {'@type':'ListItem',position:1,name:'Nerulio',item:site.origin+(l==='ko'?'/':`/${l}/`)},
   {'@type':'ListItem',position:2,name:ko?'도구 실측·AI 해설':'Tool tests & AI commentary',item:index},
   {'@type':'ListItem',position:3,name:a.title,item:canonical}]}]};
 const plain=articleHtml(a.body),sec=digestSections(plain),withToc=sec.toc.length>=3;
 // A table of contents (and the heading ids it points at) only when there is something to jump between.
 const toc=withToc?html`<nav class="dg-toc" aria-labelledby="digest-toc"><h2 id="digest-toc">${ko?'목차':'Contents'}</h2><ol>${sec.toc.map(t=>html`<li><a href="#${t.id}">${raw(t.text)}</a></li>`)}</ol></nav>`:'';
 const {newer,older}=digestNeighbours(digestArticles(l),a.slug);
 const pn=newer||older?html`<nav class="dg-pn" aria-label="${ko?'이전·다음 글':'Previous and next article'}">${older?html`<a class="dg-pn-a" rel="prev" href="${digestArticlePath(l,older.slug)}"><span class="fine">‹ ${ko?'이전 글':'Previous'}</span><b>${older.title}</b></a>`:html`<span></span>`}${newer?html`<a class="dg-pn-a dg-pn-n" rel="next" href="${digestArticlePath(l,newer.slug)}"><span class="fine">${ko?'다음 글':'Next'} ›</span><b>${newer.title}</b></a>`:html`<span></span>`}</nav>`:'';
 const updated=a.updated&&a.updated!==a.date?html` · ${ko?'수정':'Updated'} <time datetime="${a.updated}">${digestDate(a.updated,l)}</time>`:'';
 const body=html`<div class="narrow"><nav class="crumb" aria-label="${ko?'위치':'Breadcrumb'}"><a class="chl" href="${digestIndexPath(l)}">${ko?'도구 실측·AI 해설':'Tool tests & AI commentary'}</a></nav>
<article class="box post" data-ad-host><header class="ph1"><h1>${a.title}</h1><div class="meta1"><span>Nerulio</span><span class="sep">|</span><time datetime="${a.date}">${digestDate(a.date,l)}</time>${updated}<span class="sep">|</span><span>${readingLabel(a.body,l)}</span></div></header>
<p class="pad desc">${a.summary}</p>
${toc}<div class="pbody">${raw(withToc?sec.html:plain)}</div>
${raw('<!--ad:content-1-->')}
<section class="pad" aria-labelledby="digest-sources"><h2 id="digest-sources">${ko?'확인한 출처':'Sources'}</h2><ol>${a.sources.map(s=>html`<li><a href="${safeHref(s.url)}" rel="noopener" target="_blank">${s.title}</a></li>`)}</ol>
<p class="fine">${editorialNote(ko)}</p></section>
${raw('<!--ad:content-2-->')}</article>
${pn}<p class="pad"><a class="btn" href="${digestIndexPath(l)}">${ko?'도구 실측·AI 해설 목록':'All tests and commentary'} ›</a></p></div>`;
 return page({publicOnly:site.publicOnly,l,title:`${a.title} | Nerulio`,description:a.summary,canonical,alternates,channels:o.channels,body,jsonld,ogType:'article'});
}
