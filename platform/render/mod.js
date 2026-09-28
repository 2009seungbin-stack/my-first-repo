// @ts-check
/** Moderator queue (/{l}/community/mod): an empty, noindex shell; the queue itself is loaded by the
 * islands from /api/v2/mod/queue, which answers 404 to anyone who is not a moderator. */
import {html} from './html.js';
import {page} from './ui.js';

/** @param {{l:string,channels?:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderMod(o,site){
 const ko=o.l==='ko';
 const body=html`<div class="narrow"><section class="box" data-island="mod-queue"><div class="bh"><h1 class="wt">${ko?'신고 처리':'Moderation queue'}</h1><span class="x">${ko?'임시조치(숨김)·복구·기각은 사유와 함께 기록됩니다':'Every hide, restore or dismissal is logged with its reason'}</span></div>
<p class="empty" data-empty>${ko?'운영자만 볼 수 있습니다.':'Moderators only.'}</p><ul class="rows" data-items></ul></section>
<section class="box" data-proposals hidden><div class="bh"><h2>${ko?'정보 제안':'Fact proposals'}</h2><span class="x">${ko?'출처를 열어 확인한 뒤 반영하세요. 반영하면 커뮤니티 검증 값이 되고, 공식 값은 바뀌지 않습니다.':'Open the source first. Accepted values are community-verified; official values stay.'}</span></div><ul class="rows"></ul></section>
<section class="box" data-hidden hidden><div class="bh"><h2>${ko?'임시조치 중':'Hidden now'}</h2><span class="x">${ko?'공개 페이지에서는 보이지 않는 글·댓글입니다. 복구하면 원래 상태로 돌아갑니다.':'Not shown to readers. Restoring returns them to their previous state.'}</span></div><ul class="rows"></ul></section>
<section class="box"><div class="bh"><h2>${ko?'최근 처리 기록':'Recent actions'}</h2></div><ul class="rows" data-log></ul></section></div>`;
 return page({l:o.l,title:ko?'신고 처리 | Nerulio':'Moderation | Nerulio',description:'',canonical:site.origin+`/${o.l}/community/mod`,noindex:true,channels:o.channels||[],body});
}
