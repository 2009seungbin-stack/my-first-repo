// @ts-check
/** Public publishing surface after community retirement. The old community modules remain
 * available to owner tools and isolated legacy tests; the production entry never routes readers
 * or their requests to them. No stored discussions, comments or uploads are deleted. */
import {html,raw,safeHref} from '../../platform/render/html.js';
import {page,nameOf,channelUrl,homeUrl,officialLinks} from '../../platform/render/ui.js';
import {renderHomeContent} from '../../platform/render/home-content.js';
import {digestArticles,digestArticlePath} from '../../platform/digest.js';
import {renderDigestIndex,renderDigestArticle} from '../../platform/render/digest.js';
import {excerptsOf,postByChannelNo,entityBySlug,factsFor,searchEntities,eventsFor} from '../../platform/db/channel.js';
import {plainExcerpt,renderMarkdown} from '../../platform/markdown.js';
import {factRows} from '../../platform/render/panels/generic.js';
import {loadHub,renderHub} from '../../platform/render/hub.js';
import {loadRadar,renderRadar} from '../../platform/render/radar.js';
import {loadHistory,renderHistory} from '../../platform/render/history.js';
import {loadLocalLlm,renderLocalLlm} from '../../platform/render/localllm.js';
import {renderUsedPrices,renderPerformance} from '../../platform/render/hardware-tools.js';
import {renderBracket} from '../../platform/render/bracket.js';
import {radarFeed} from '../../platform/render/feed.js';
import {marketSnapshot} from './hardware-market.js';
import {matchPlatformRoute,canonicalQuery,renderSitemap,siteOrigin,PAGE_HEADERS} from './pages.js';
import {editorDescription} from '../../platform/seo.js';
import {publishedNews} from '../../platform/news.js';
import {renderIncidentHistory} from '../../platform/render/incident-history.js';

const CLOSED_HEADERS={'cache-control':'no-store','x-robots-tag':'noindex, nofollow','x-content-type-options':'nosniff'};
/** Closed at the production entry before authentication, body reads or database writes.
 * Owner administration and the aggregate visit beacon keep their existing authorization. @param {Request} request */
export function retiredCommunityResponse(request){
 const path=new URL(request.url).pathname;
 if(/^\/api\/v2(?:\/|$)/.test(path)){
  if(/^\/api\/v2\/(?:hit\/?$|admin(?:\/|$))/.test(path))return null;
  return new Response(JSON.stringify({error:{code:'COMMUNITY_CLOSED',message:'Community features have been closed.'}}),{status:410,headers:{...CLOSED_HEADERS,'content-type':'application/json; charset=utf-8'}});
 }
 const route=matchPlatformRoute(path);
 if(/^\/[^/]+\/community(?:\/|$)/.test(path)||path.startsWith('/u/')||route&&['profile','best','flag','mod','me','board','board-best','board-feed','board-write','board-post','legacy-post','legacy-write','feed'].includes(route.page)){
  const l=path.startsWith('/en/')?'en':'ko',ko=l==='ko';
  return document(page({l,title:ko?'커뮤니티 운영 종료 | Nerulio':'Community closed | Nerulio',description:'',canonical:new URL(homeUrl(l),request.url).href,noindex:true,channels:[],publicOnly:true,
   body:html`<section class="box narrow pad"><h1>${ko?'커뮤니티 운영을 종료했습니다.':'The community has closed.'}</h1><p>${ko?'게시판·글쓰기·댓글·추천·커뮤니티 이미지 기능은 더 이상 제공하지 않습니다. 도구와 뉴스·해설은 계속 이용할 수 있습니다.':'Boards, posting, comments, voting and community images are no longer available. Tools, news and commentary remain available.'}</p><a class="btn" href="${homeUrl(l)}">${ko?'홈으로':'Home'}</a></section>`}),410);
 }
 return null;
}
/** @param {unknown} body @param {number} [status] */
function document(body,status=200){return new Response(String(body),{status,headers:{...PAGE_HEADERS,...(status===410?CLOSED_HEADERS:{'cache-control':'public, max-age=0, s-maxage=60'})}});}
/** @param {string} l @param {{channel_id:string,channel_no:number}} p */
const newsPath=(l,p)=>'url' in p?String(p.url):`/${l}/news/${p.channel_id}/${p.channel_no}`;
/** @param {string} l @param {number|string} value */
const date=(l,value)=>new Date(value).toLocaleDateString(l==='ko'?'ko-KR':'en-US',{timeZone:'Asia/Seoul'});
/** Tag observations carry a calendar date, not a measured midnight release time. @param {any} p */
const newsDateTime=p=>{const iso=new Date(p.created_at).toISOString();return p.source_kind==='tag'?iso.slice(0,10):iso;};
/** @param {string} l @param {any[]} news @param {Map<string,string>} excerpts */
function newsList(l,news,excerpts){
 return html`<ol class="plist">${news.map(p=>html`<li class="pad"><h3><a href="${newsPath(l,p)}"${p.url?html` rel="noopener" target="_blank"`:''}>${p.title}</a></h3><p class="fine"><time datetime="${newsDateTime(p)}">${date(l,p.created_at)}</time> · ${l==='ko'?'출처 기반 자동 수집':'Collected from sources'}</p>${p.url?html`<p class="fine">${p.source_kind==='tag'?(l==='ko'?'공식 소스 태그로 연결됩니다. 날짜는 태그 커밋에 기록된 날짜이며 실제 배포일과 다를 수 있습니다.':'Opens the official source tag. The date comes from its tag commit and can differ from the download release date.'):(l==='ko'?'공식 릴리스 원문으로 연결됩니다. 날짜·버전·공개 유형은 수집된 기록 기준입니다.':'Opens the original release notes. Date, version and release channel come from collected records.')}</p>`:html`<p>${excerpts.get(p.id)||''}</p>`}</li>`)}</ol>`;
}
/** Both streams are driven by real published records. Drafts and human community posts never
 * become homepage stories. Empty streams are explicitly identified, not filled with samples.
 * @param {any} db @param {string} l */
export async function homePublishing(db,l){
 const news=await publishedNews(db,l,6);
 return {news,excerpts:await excerptsOf(db,news.map(p=>p.id)),articles:digestArticles(l).slice(0,6)};
}
/** @param {any} m @param {string} l */
export function renderPublishing(m,l){
 const ko=l==='ko';
 const news=html`<section class="box" id="news" data-home-news data-published-count="${m.news.length}"><div class="bh"><h2>${ko?'뉴스':'News'}</h2><a href="/${l}/news/">${ko?'전체 뉴스':'All news'} ›</a></div><p class="pad fine">${ko?'출처에서 자동 수집한 소식입니다. 편집자의 해설과 구분해 제공합니다.':'Source-based news is collected automatically and kept separate from editorial commentary.'}</p>${m.news.length?newsList(l,m.news,m.excerpts):html`<p class="empty">${ko?'아직 게시된 뉴스가 없습니다.':'No news has been published yet.'}</p>`}</section>`;
 const commentary=html`<section class="box" id="commentary" data-home-digest data-published-count="${m.articles.length}"><div class="bh"><h2>${ko?'실측·해설':'Tests & commentary'}</h2><a href="/${l}/ai/digest/">${ko?'해설 목록':'Commentary'} ›</a></div>${m.articles.length?html`<ol class="plist">${m.articles.map((/** @type {any} */ a)=>html`<li class="pad"><h3><a href="${digestArticlePath(l,a.slug)}">${a.title}</a></h3><time datetime="${a.date}">${date(l,a.date)}</time><p>${a.summary}</p></li>`)}</ol>`:html`<p class="empty">${ko?'아직 게시된 해설이 없습니다. 검토 중인 초안은 공개하지 않습니다.':'No commentary has been published yet. Drafts under review are not public.'}</p>`}</section>`;
 return html`${commentary}${news}`;
}
/** Read-only facts replace the entity's former board, follow button and proposal form.
 * @param {any} db @param {any} e @param {string} l @param {string} origin @param {number} now @param {boolean} status */
async function reference(db,e,l,origin,now,status=false){
 const facts=(await factsFor(db,[e.id])).get(e.id)||[],name=nameOf(e,l);
 const ctx={db,entity:e,facts,l,now,region:l==='ko'?'KR':'US'},rows=factRows(ctx);
 const events=status?await eventsFor(db,[e.id],{kinds:['incident','other'],from:now-14*864e5,to:now,officialOnly:true,desc:true,limit:20}):[];
 const canonical=origin+channelUrl(l,e)+(status?'status':'');
 const purpose=l==='ko'?'공식 장애 이력':'Official incident history',heading=status?`${name} — ${purpose}`:name;
 return page({l,publicOnly:true,title:`${name} — ${status?purpose:l==='ko'?'정보·출처':'Reference & sources'} | Nerulio`,description:e.descriptions[l]||'',canonical,noindex:e.index_state==='noindex'||!(e.index_state==='index'||editorDescription(e,l)),channels:[],
  body:html`<div class="narrow"><section class="box pad"><h1>${heading}</h1>${e.descriptions[l]?html`<p>${e.descriptions[l]}</p>`:''}<p><a href="/${l}/${e.vertical}/">${l==='ko'?'정보 목록':'Reference directory'} ›</a> · <a href="${channelUrl(l,e)}history">${l==='ko'?'변경 기록':'History'}</a></p>${e.type==='service'?html`<p><a href="${channelUrl(l,e)}${status?'':'status'}">${status?(l==='ko'?'서비스 정보·출처':'Service reference & sources'):purpose}</a></p>`:''}</section>${status?renderIncidentHistory(events,l):''}${rows.length?html`<section class="box pad"><h2>${l==='ko'?'확인된 정보':'Reference facts'}</h2><table class="wk"><tbody>${rows}</tbody></table></section>`:''}<section class="box pad"><h2>${l==='ko'?'공식 출처':'Official sources'}</h2>${officialLinks(e.official_urls)}</section></div>`});
}
/** Production-only read-only routing. No fallback to the old boards for a recognized platform URL.
 * @param {Request} request @param {any} env @param {any} ctx @param {{origin:string,verify?:any}} site */
async function renderPublicPage(request,env,ctx,site){
 const closed=retiredCommunityResponse(request);if(closed)return closed;
 const url=new URL(request.url),path=url.pathname,origin=siteOrigin(site.origin)||url.origin;
 const newsRoute=/^\/(ko|en)\/news\/(?:([a-z]+)\/(\d{1,9})\/?$|$)/.exec(path);
 const sitemap=/^\/sitemap-n2-(ai|games|hardware|studio|subculture)\.xml$/.exec(path);
 const route=matchPlatformRoute(path);
 if(!route&&!newsRoute&&!sitemap)return null;
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{allow:'GET, HEAD'}});
 if(!env.DB)return new Response('Site data is temporarily unavailable.',{status:503,headers:{'cache-control':'no-store'}});
 const db=env.DB,now=Date.now(),l=newsRoute?.[1]||route?.l||'ko',ko=l==='ko',publicSite={...site,origin,publicOnly:true};
 if(sitemap){
  let body=await renderSitemap(db,sitemap[1],origin,{communityClosed:true});
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
 }
 if(newsRoute){
  const title=ko?'뉴스':'News';
  if(newsRoute[2]){
   const post=await postByChannelNo(db,newsRoute[2],Number(newsRoute[3]));
   if(!post||!post.bot||post.kind!=='news'||post.locale!==l)return new Response('Not found',{status:404,headers:CLOSED_HEADERS});
   return document(page({l,publicOnly:true,title:`${post.title} | Nerulio`,description:plainExcerpt(post.body_md,160),canonical:origin+newsPath(l,post),noindex:true,channels:[],body:html`<article class="box narrow pad"><a href="/${l}/news/">${title} ›</a><h1>${post.title}</h1><p class="fine"><time datetime="${new Date(post.created_at).toISOString()}">${date(l,post.created_at)}</time> · ${ko?'출처 기반 자동 수집':'Collected from sources'}</p><div class="pbody">${raw(renderMarkdown(post.body_md))}</div></article>`}));
  }
  const news=await publishedNews(db,l,30),excerpts=await excerptsOf(db,news.map(p=>p.id));
  return document(page({l,publicOnly:true,title:`${title} | Nerulio`,description:ko?'출처를 표시한 자동 수집 뉴스. 편집 해설과 구분해 제공합니다.':'Source-based collected news, separate from editorial commentary.',canonical:origin+`/${l}/news/`,noindex:true,channels:[],body:html`<section class="box narrow"><div class="bh"><h1>${title}</h1></div><p class="pad">${ko?'자동 수집한 소식입니다. 사실관계와 적용 범위는 각 글의 원문 출처에서 확인하세요.':'News is collected automatically. Check each original source for details and scope.'}</p>${news.length?newsList(l,news,excerpts):html`<p class="empty">${ko?'아직 게시된 뉴스가 없습니다.':'No news has been published yet.'}</p>`}</section>`}));
 }
 if(!route)return null;
 if(route.page==='home-moved')return Response.redirect(origin+homeUrl(l),301);
 const search=canonicalQuery(route.page,url.searchParams);
 if(route.page==='front'){
  if(url.search)return Response.redirect(origin+homeUrl(l),301);
  const m=await homePublishing(db,l),hasCommentary=m.articles.length>0;
  return document(page({l,publicOnly:true,homeOn:true,title:ko?'Nerulio — 브라우저 게임 에셋·파일 도구와 뉴스':'Nerulio — browser game asset and file tools, plus news',description:ko?'브라우저에서 게임 에셋과 파일을 다듬고 출처 기반 뉴스와 게시된 해설을 확인하세요.':'Prepare game assets and files in your browser, with source-based news and published commentary.',canonical:origin+homeUrl(l),alternates:{ko:origin+'/',en:origin+'/en/'},channels:[],verify:site.verify,body:html`<main>${renderHomeContent(l,{hasCommentary,publishing:renderPublishing(m,l)})}</main>`}));
 }
 const q=new URLSearchParams(search),o={l,now,channels:[],publicOnly:true};
 if(route.page==='digest')return document(renderDigestIndex(o,publicSite));
 if(route.page==='digest-article'){const a=renderDigestArticle({...o,slug:route.slug||''},publicSite);return a?document(a):new Response('Not found',{status:404,headers:CLOSED_HEADERS});}
 if(route.page==='hub'){const m=await loadHub(db,route.vertical||'',{...o,type:q.get('type'),org:q.get('org'),sort:q.get('sort'),vs:q.get('vs'),page:Number(q.get('page'))||1});return m?document(renderHub(m,publicSite)):null;}
 if(route.page==='radar')return document(renderRadar(await loadRadar(db,{...o,vertical:q.get('v')}),publicSite));
 if(route.page==='radar-feed')return new Response(await radarFeed(db,l,origin),{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public, max-age=300'}});
 if(route.page==='status-feed')return new Response(null,{status:410,headers:CLOSED_HEADERS});
 if(route.page==='used-prices'||route.page==='performance'){
  const opts={...o,origin,tool:route.page,query:search,q};
  const body=route.page==='used-prices'?renderUsedPrices({...opts,market:await marketSnapshot(request,env)}):renderPerformance(opts);
  const response=document(body);response.headers.set('cache-control','no-store');return response;
 }
 if(route.page==='bracket')return document(renderBracket({...o,origin}));
 if(route.page==='search'){
  const query=(q.get('q')||'').slice(0,80),entities=query?await searchEntities(db,query,{limit:30}):[];
  return document(page({l,publicOnly:true,title:ko?'정보 검색 | Nerulio':'Reference search | Nerulio',description:'',canonical:origin+path,noindex:true,channels:[],body:html`<section class="box narrow pad"><h1>${ko?'정보 검색':'Reference search'}</h1><form method="get"><label>${ko?'검색어':'Search'} <input name="q" value="${query}" maxlength="80"></label><button type="submit">${ko?'검색':'Search'}</button></form><ul>${entities.map(e=>html`<li><a href="${channelUrl(l,e)}">${nameOf(e,l)}</a></li>`)}</ul></section>`}));
 }
 const {entity:e,redirect}=await entityBySlug(db,route.vertical||'',route.slug||'');
 if(!e)return redirect?Response.redirect(origin+`/${l}/${route.vertical}/${redirect}/`,301):new Response('Not found',{status:404,headers:CLOSED_HEADERS});
 if(route.page==='history')return document(renderHistory(await loadHistory(db,e,o),publicSite));
 if(route.page==='local-llm'){const m=await loadLocalLlm(db,e,o);return m?document(renderLocalLlm(m,publicSite)):null;}
 return document(await reference(db,e,l,origin,now,route.page==='status'));
}

/** Keep transient database failures out of the page and never report an empty successful feed.
 * @param {Request} request @param {any} env @param {any} ctx @param {{origin:string,verify?:any}} site */
export async function handlePublicPage(request,env,ctx,site){
 try{return await renderPublicPage(request,env,ctx,site);}
 catch(error){
  console.error('public page',error instanceof Error?error.message:'data unavailable');
  return new Response('잠시 후 다시 시도해 주세요. Please try again shortly.',{status:503,headers:{...PAGE_HEADERS,'cache-control':'no-store','retry-after':'30'}});
 }
}
