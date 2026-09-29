// @ts-check
/** 내 정보 (/{l}/community/me): nickname and followed channels. A data-free, noindex shell; the
 * islands fill it from /api/v2/state and /api/v2/follows for the signed-in reader. */
import {html} from './html.js';
import {page,signInUrl} from './ui.js';
import {LIMITS} from '../community.js';

/** @param {{l:string,channels?:{name:string,href:string}[]}} o @param {{origin:string}} site */
export function renderMe(o,site){
 const {l}=o,ko=l==='ko',base=`/${l}/community/me`;
 const body=html`<div class="narrow" data-island="me">
<section class="box"><div class="bh"><h1 class="wt">${ko?'내 정보':'My account'}</h1><button class="btn x" type="button" data-logout hidden>${ko?'로그아웃':'Sign out'}</button></div>
<p class="needlogin pad" data-signed-out>${ko?'로그인하면 닉네임과 구독 채널을 관리할 수 있어요.':'Sign in to manage your nickname and channels.'} <a href="${signInUrl(base)}" rel="nofollow" data-signin>${ko?'로그인 ›':'Sign in ›'}</a></p>
<form class="wform" data-nickname hidden><label>${ko?'닉네임 (글과 댓글에 보이는 이름)':'Nickname (shown on posts and comments)'}<input name="displayName" minlength="${LIMITS.nickname[0]}" maxlength="${LIMITS.nickname[1]}" required autocomplete="nickname"></label>
<p class="fine">${ko?'로그인한 Google·GitHub·Discord 계정의 이름과 이메일은 공개되지 않습니다. 글과 댓글에는 이 닉네임만 보여요.':'The name and e-mail of the Google, GitHub or Discord account you sign in with are never shown; posts show this nickname only.'}</p><p class="fine" data-suggested hidden>${ko?'로그인한 계정의 아이디를 넣어 두었어요. 저장해야 닉네임이 됩니다.':'Your account handle is filled in; it becomes your nickname only when you save it.'}</p><p class="fine" data-autonick hidden>${ko?'지금 닉네임은 자동으로 만든 이름이에요. 기억하기 쉬운 이름으로 바꿔 보세요.':'This nickname was made automatically. Pick your own.'}</p><div class="acts"><button class="btn p" type="submit">${ko?'저장':'Save'}</button></div></form></section>
<section class="box" data-mine hidden><div class="bh"><h2>${ko?'내가 쓴 글':'My posts'}</h2></div><ul class="rows" data-posts></ul></section>
<section class="box" data-mine hidden><div class="bh"><h2>${ko?'내가 쓴 댓글':'My comments'}</h2></div><ul class="rows" data-comments></ul></section>
<section class="box" data-mine hidden><div class="bh"><h2>${ko?'로그인 방법':'Sign-in methods'}</h2></div><p class="pad fine">${ko?'Google·GitHub·Discord 로그인 연결과 해제는 계정 페이지에서 할 수 있어요.':'Link or unlink Google, GitHub and Discord on the account page.'} <a href="/${l}/account/">${ko?'연결된 로그인 관리 ›':'Manage sign-in methods ›'}</a></p></section>
<section class="box" data-follows hidden><div class="bh"><h2>${ko?'구독한 채널':'Channels you follow'}</h2><a class="x" href="/${l}/radar/#mine">${ko?'내 레이더 ›':'My Radar ›'}</a></div><ul class="rows"></ul></section></div>`;
 return page({l,title:ko?'내 정보 | Nerulio':'My account | Nerulio',description:'',canonical:site.origin+base,noindex:true,channels:o.channels||[],body});
}
