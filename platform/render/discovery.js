// @ts-check
import {html} from './html.js';
import {discoveryTopics} from '../discovery.js';
/** A compact directory of useful reference pages, rendered for readers and crawlers alike.
 * @param {string} l */
export function renderDiscovery(l){
 const ko=l==='ko';
 return html`<section class="box" data-search-discovery aria-labelledby="explore-topics"><div class="bh"><h2 id="explore-topics">${ko?'주제별 정보와 비교':'Reference pages and comparisons'}</h2></div>
<p class="pad fine">${ko?'공식 자료, 자동 수집 결과, 커뮤니티 제보와 추정을 구분해 표시합니다. 각 페이지에서 근거와 적용 범위를 확인하세요.':'Official sources, automated observations, community reports and estimates are labeled separately. Check the evidence and scope on each page.'}</p>
<ul class="hubg">${discoveryTopics(l).map(x=>html`<li><div><a class="tt" href="${x.href}"><b>${x.name}</b></a><p class="fine">${x.description}</p>${x.links.length?html`<p class="fine">${x.links.map((a,i)=>html`${i?' · ':''}<a href="${a.href}">${a.name}</a>`)}</p>`:''}</div></li>`)}</ul></section>`;
}
