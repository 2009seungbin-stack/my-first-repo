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
<p class="needlogin pad" data-signed-out>${ko?'로그인하면 닉네임과 구독 채널을 관리할 수 있어요.':'Sign in to manage your nickname and channels.'} <a href="${signInUrl(base)}" rel="nofollow">${ko?'로그인 ›':'Sign in ›'}</a></p>
<form class="wform" data-nickname hidden><label>${ko?'닉네임 (글과 댓글에 보이는 이름)':'Nickname (shown on posts and comments)'}<input name="displayName" minlength="${LIMITS.nickname[0]}" maxlength="${LIMITS.nickname[1]}" required autocomplete="nickname"></label>
<p class="fine">${ko?'Google 계정 이름은 어디에도 공개되지 않습니다.':'Your Google account name is never shown.'}</p><p class="fine" data-autonick hidden>${ko?'지금 닉네임은 자동으로 만든 이름이에요. 기억하기 쉬운 이름으로 바꿔 보세요.':'This nickname was made automatically. Pick your own.'}</p><div class="acts"><button class="btn p" type="submit">${ko?'저장':'Save'}</button></div></form></section>
<section class="box" data-mine hidden><div class="bh"><h2>${ko?'내가 쓴 글':'My posts'}</h2></div><ul class="rows" data-posts></ul></section>
<section class="box" data-mine hidden><div class="bh"><h2>${ko?'내가 쓴 댓글':'My comments'}</h2></div><ul class="rows" data-comments></ul></section>
<section class="box" data-follows hidden><div class="bh"><h2>${ko?'구독한 채널':'Channels you follow'}</h2><a class="x" href="/${l}/radar/#mine">${ko?'내 레이더 ›':'My Radar ›'}</a></div><ul class="rows"></ul></section></div>`;
 return page({l,title:ko?'내 정보 | Nerulio':'My account | Nerulio',description:'',canonical:site.origin+base,noindex:true,channels:o.channels||[],body});
}
