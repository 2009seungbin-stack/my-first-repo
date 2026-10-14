// @ts-check
/** /{l}/bracket/ — 대진표 만들기: names in, a random draw, winners by click or by a coin flip, a full-screen
 * view for the TV. Everything runs in the page (src/bracket/app.js); the server sends the form, the empty
 * board and the how-to. */
import {html} from './html.js';
import {page} from './ui.js';
import {icon} from './icons.js';

/** @param {{l:string,origin:string,channels:any[]}} o */
export function renderBracket(o){
 const ko=o.l==='ko',base='/bracket/';
 const title=ko?'대진표 만들기 · 16강 토너먼트 랜덤 추첨':'Bracket maker · random 16-player tournament draw';
 const description=ko?'참가자 이름만 넣으면 16강 대진표를 랜덤으로 짜 줍니다. 4·8·16·32강, 부전승, 승자 랜덤 뽑기, 전체 화면, 링크 공유까지. 가입 없이 무료.':'Type the names and get a random 16-player bracket. 4 to 32 players, byes, random winner picks, full screen and share links. Free, no sign-up.';
 const faq=ko?[
  ['몇 명까지 되나요?','4강·8강·16강·32강을 고를 수 있고, 칸보다 사람이 적으면 남는 자리는 부전승이 됩니다. 부전승은 한 경기에 하나만 들어가므로 칸의 절반보다 많은 인원이 필요합니다(16강이면 9~16명).'],
  ['승자는 어떻게 정하나요?','이름을 누르면 그 사람이 다음 라운드로 올라갑니다. 직접 정하기 어려우면 「다음 경기 랜덤」이나 「끝까지 자동」으로 뽑기 연출과 함께 정할 수 있고, 잘못 누르면 「되돌리기」로 돌아갑니다.'],
  ['친구에게 보내려면?','「링크 복사」로 대회 이름과 참가자가 담긴 주소를 만들 수 있습니다. 받은 사람이 직접 추첨 버튼을 누르게 할 수 있습니다.'],
  ['저장되나요?','입력한 내용과 진행 상황은 이 브라우저에만 저장됩니다. 서버로 보내지 않습니다.'],
  ['결과가 진짜 랜덤인가요?','예능·몰래카메라용으로 대진 배치를 미리 정해 둘 수 있는 숨은 기능이 있습니다. 상품이나 돈이 걸린 실제 추첨에는 쓰지 마세요.'],
 ]:[
  ['How many players?','Pick a 4, 8, 16 or 32 bracket. With fewer names than slots the free slots become byes — one per match at most, so a bracket needs more than half its slots filled (9–16 names for 16).'],
  ['How are winners decided?','Tap a name to send that player to the next round, or let “Random next match” and “Auto-play to the end” pick with a little animation. “Undo” steps back.'],
  ['Can I send it to a friend?','“Copy link” makes an address with the title and players, and the other person can press the draw button themselves.'],
  ['Is it saved?','Names and progress stay in this browser only. Nothing is sent to a server.'],
  ['Is it really random?','There is a hidden mode that can set the matchups in advance, for party games and hidden-camera pranks. Do not use it for real draws with prizes or money.'],
 ];
 const jsonld={'@context':'https://schema.org','@graph':[
  {'@type':'WebApplication',name:ko?'대진표 만들기':'Bracket maker',url:o.origin+`/${o.l}${base}`,applicationCategory:'UtilitiesApplication',operatingSystem:'Any',inLanguage:o.l,offers:{'@type':'Offer',price:'0',priceCurrency:ko?'KRW':'USD'}},
  {'@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))},
 ]};
 const sizes=[4,8,16,32];
 return page({l:o.l,title:title+' | Nerulio',description,canonical:o.origin+`/${o.l}${base}`,alternates:{ko:o.origin+`/ko${base}`,en:o.origin+`/en${base}`},channels:o.channels,jsonld,
  body:html`<div class="bk" data-island="bracket">
<header class="box chh bk-head"><span class="tile t-hw" aria-hidden="true" data-bk-t>${icon('trophy',24)}</span><div class="chm"><h1 data-bk-t>${ko?'대진표 만들기':'Bracket maker'}</h1><p class="desc">${ko?'참가자를 넣고 추첨하면 토너먼트 대진표가 나옵니다. 이름을 눌러 승자를 올리세요.':'Add the players, draw, and tap a name to send the winner on.'}</p></div></header>
<section class="box bk-setup" aria-labelledby="bk-setup-h"><h2 id="bk-setup-h" class="bk-h2">${ko?'참가자':'Players'}</h2>
<form class="bk-form" data-bk-form><fieldset disabled data-bk-enable>
<div class="bk-row"><label class="bk-title">${ko?'대회 이름':'Tournament name'}<input name="title" maxlength="40" autocomplete="off" placeholder="${ko?'예: 최애 라면 월드컵':'e.g. Best snack cup'}"></label>
<div class="bk-size" role="radiogroup" aria-label="${ko?'대진 크기':'Bracket size'}">${sizes.map(s=>html`<label><input type="radio" name="size" value="${s}"${s===16?html` checked`:''}><span>${ko?`${s}강`:`${s}`}</span></label>`)}</div></div>
<label class="bk-names">${ko?'참가자 이름 · 한 줄에 한 명':'Player names · one per line'}<textarea name="names" rows="8" maxlength="1200" spellcheck="false" placeholder="${ko?'민수\n지영\n현우\n…':'Alex\nSam\nRiley\n…'}"></textarea></label>
<p class="bk-count fine" data-bk-count aria-live="polite"></p>
<div class="bk-actions"><button class="btn p" type="submit" data-bk-draw>${icon('sparkle',16)}${ko?'대진 추첨':'Draw bracket'}</button><button class="btn" type="button" data-bk-order>${ko?'입력 순서대로':'Keep typed order'}</button><button class="btn" type="button" data-bk-sample>${ko?'예시 이름':'Sample names'}</button><button class="btn" type="button" data-bk-clear>${ko?'비우기':'Clear'}</button></div>
</fieldset></form>
<noscript><p class="fine">${ko?'대진표 만들기에는 JavaScript가 필요합니다.':'The bracket maker needs JavaScript.'}</p></noscript>
</section>
<section class="box bk-board" data-bk-board aria-labelledby="bk-board-h" hidden><div class="bk-bar"><h2 id="bk-board-h" class="bk-h2" data-bk-name>${ko?'대진표':'Bracket'}</h2><span class="bk-status fine" data-bk-status role="status" aria-live="polite"></span></div>
<div class="bk-tools"><button class="btn p" type="button" data-bk-next>${ko?'다음 경기 랜덤':'Random next match'}</button><button class="btn" type="button" data-bk-round>${ko?'이번 라운드 랜덤':'Random this round'}</button><button class="btn" type="button" data-bk-auto>${ko?'끝까지 자동':'Auto-play to the end'}</button><button class="btn" type="button" data-bk-undo>${ko?'되돌리기':'Undo'}</button><button class="btn" type="button" data-bk-redraw>${ko?'다시 추첨':'Draw again'}</button><span class="bk-sp"></span><button class="btn" type="button" data-bk-full>${ko?'전체 화면':'Full screen'}</button><button class="btn" type="button" data-bk-link>${ko?'링크 복사':'Copy link'}</button><button class="btn" type="button" data-bk-print>${ko?'인쇄':'Print'}</button></div>
<div class="bk-scroll" data-bk-scroll><div class="bk-tree" data-bk-tree></div></div>
<p class="fine bk-tip">${ko?'이름을 누르면 그 사람이 다음 라운드로 올라갑니다. 이미 정한 경기도 다시 누르면 바뀝니다.':'Tap a name to send that player on. Tap the other name to change a result.'}</p>
</section>
<div class="bk-toast" data-bk-toast role="status" aria-live="polite" hidden></div>
<section class="box bk-help"><h2 class="bk-h2">${ko?'자주 묻는 질문':'FAQ'}</h2>${faq.map(([q,a])=>html`<details><summary>${q}</summary><p>${a}</p></details>`)}</section>
</div>`});
}
