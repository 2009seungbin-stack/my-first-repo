// @ts-check
/** AI 주간 해설 / AI weekly digest pages (/{l}/ai/digest/ and /{l}/ai/digest/{slug}/), rendered by the
 * Worker from the published articles of platform/digest.js. Ad markers (docs/ADS.md) sit only after
 * the article text, inside a [data-ad-host]; the platform pages do not load an ad script today. */
import {html,raw,safeHref} from './html.js';
import {page} from './ui.js';
import {renderMarkdown} from '../markdown.js';
import {digestArticles,digestArticle,digestIndexPath,digestArticlePath} from '../digest.js';
import {PLATFORM_LOCALES} from '../schema.js';

const other=(/** @type {string} */ l)=>PLATFORM_LOCALES.filter(x=>x!==l);
/** Editorial text: the safe Markdown renderer, with plain editorial links instead of the UGC rel. @param {string} md */
const articleHtml=md=>raw(renderMarkdown(md,{headingBase:1}).replaceAll('rel="nofollow ugc noopener noreferrer"','rel="noopener"'));
/** "2026-10-31" → "2026년 10월 31일" / "October 31, 2026". @param {string} d @param {string} l */
export function digestDate(d,l){
 const [y,m,day]=d.split('-').map(Number);
 return l==='ko'?`${y}년 ${m}월 ${day}일`:new Date(Date.UTC(y,m-1,day)).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
}
const editorialNote=(/** @type {boolean} */ ko)=>ko
 ?'인디 게임 개발자·픽셀 아티스트·크리에이터를 위해 매주 AI 소식 가운데 게임 에셋과 파일 작업에 영향을 주는 것만 골라 해설합니다. AI 도구로 자료 조사와 초안을 만들고, Nerulio 편집자가 모든 사실을 출처와 대조해 검토한 뒤 게시합니다. 각 글 끝에 확인한 출처를 모두 적습니다.'
 :'Each week we pick the AI news that affects game assets and file workflows for indie developers, pixel artists and creators. Research and a first draft are made with AI tools; a Nerulio editor checks every fact against its source before publishing. Every article lists the sources it was checked against.';

/** @param {{l:string,channels:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderDigestIndex(o,site){
 const {l}=o,ko=l==='ko',list=digestArticles(l),canonical=site.origin+digestIndexPath(l);
 const title=ko?'AI 주간 해설 — 게임 에셋·파일 작업 관점 | Nerulio':'AI weekly digest for game assets and file workflows | Nerulio';
 const description=ko?'매주 AI 소식 중 게임 에셋·스프라이트·파일 작업에 영향을 주는 것만 골라, 무슨 일이 있었고 왜 중요하며 무엇을 하면 되는지 출처와 함께 정리합니다.':'Weekly AI news that matters for game assets, sprites and file workflows: what happened, why it matters and what to do, with sources.';
 // An empty index is thin: it stays reachable but is noindex, unlinked (digestLink) and unlisted.
 const alternates=list.length?Object.fromEntries([[l,canonical],...other(l).filter(x=>digestArticles(x).length).map(x=>[x,site.origin+digestIndexPath(x)])]):{};
 const items=list.length?html`<ol class="plist">${list.map(a=>html`<li class="pad"><h2 class="wt"><a href="${digestArticlePath(l,a.slug)}">${a.title}</a></h2><p class="fine"><time datetime="${a.date}">${digestDate(a.date,l)}</time></p><p>${a.summary}</p></li>`)}</ol>`
  :html`<p class="empty">${ko?'아직 게시된 해설이 없습니다.':'No articles have been published yet.'}</p>`;
 const body=html`<div class="narrow"><section class="box"><div class="bh"><h1 class="wt">${ko?'AI 주간 해설':'AI weekly digest'}</h1></div><p class="pad desc">${editorialNote(ko)}</p></section>
<section class="box" aria-label="${ko?'게시된 해설':'Published articles'}">${items}</section></div>`;
 const jsonld=list.length?{'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','@id':`${canonical}#webpage`,url:canonical,name:title,description,inLanguage:l,
  mainEntity:{'@type':'ItemList',itemListElement:list.map((a,i)=>({'@type':'ListItem',position:i+1,url:site.origin+digestArticlePath(l,a.slug),name:a.title}))}}]}:null;
 return page({l,title,description,canonical,alternates,noindex:!list.length,channels:o.channels,body,jsonld});
}

/** @param {{l:string,slug:string,channels:{name:string,href:string}[]}} o @param {{origin:string}} site */
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
   {'@type':'ListItem',position:2,name:ko?'AI 주간 해설':'AI weekly digest',item:index},
   {'@type':'ListItem',position:3,name:a.title,item:canonical}]}]};
 const updated=a.updated&&a.updated!==a.date?html` · ${ko?'수정':'Updated'} <time datetime="${a.updated}">${digestDate(a.updated,l)}</time>`:'';
 const body=html`<div class="narrow"><nav class="crumb" aria-label="${ko?'위치':'Breadcrumb'}"><a class="chl" href="${digestIndexPath(l)}">${ko?'AI 주간 해설':'AI weekly digest'}</a></nav>
<article class="box post" data-ad-host><header class="ph1"><h1>${a.title}</h1><div class="meta1"><span>Nerulio</span><span class="sep">|</span><time datetime="${a.date}">${digestDate(a.date,l)}</time>${updated}</div></header>
<p class="pad desc">${a.summary}</p>
<div class="pbody">${articleHtml(a.body)}</div>
${raw('<!--ad:content-1-->')}
<section class="pad" aria-labelledby="digest-sources"><h2 id="digest-sources">${ko?'확인한 출처':'Sources'}</h2><ol>${a.sources.map(s=>html`<li><a href="${safeHref(s.url)}" rel="noopener" target="_blank">${s.title}</a></li>`)}</ol>
<p class="fine">${editorialNote(ko)}</p></section>
${raw('<!--ad:content-2-->')}</article>
<p class="pad"><a class="btn" href="${digestIndexPath(l)}">${ko?'AI 주간 해설 목록':'All digest articles'} ›</a></p></div>`;
 return page({l,title:`${a.title} | Nerulio`,description:a.summary,canonical,alternates,channels:o.channels,body,jsonld,ogType:'article'});
}
