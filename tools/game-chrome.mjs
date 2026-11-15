import {BRAND} from '../src/brand.js';
import {logoMark} from '../src/logo.js';
import {LOCALES,LANGUAGE_NAMES,t} from '../src/i18n.js';
/** Site chrome shared by the home (tools/task-build.mjs) and the game landings and hub
 * (tools/game-landing-build.mjs): one header, one footer frame, one look (src/game-site.css).
 * Each caller passes its own labels and data attributes, because the home relabels itself in
 * place on a language switch (src/task/shell.js) while a landing navigates to the other URL. */
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const globe='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></svg>';
export const arrow='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5"/></svg>';
/** Attributes as a string: {a:'x',b:true} → ` a="x" b`. */
const attrs=o=>Object.entries(o||{}).filter(([,v])=>v!=null&&v!==false).map(([k,v])=>v===true?` ${k}`:` ${k}="${esc(v)}"`).join('');
/** Label of the phone menu button (siteHeader({menu:true})). */
export const MENU_LABEL={en:'Menu',ko:'메뉴',ja:'メニュー'};
const menuIcon='<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h13"/></svg>';
/**
 * @param {object} o
 * @param {string} o.locale
 * @param {string} o.prefix  '' or 'ko/' etc.
 * @param {{href:string,label:string,attrs?:object}[]} o.links  centre navigation
 * @param {{href:string,label:string,attrs?:object}} o.studio  the one primary action
 * @param {object} [o.brandAttrs]
 * @param {string} [o.extra]  markup before the language menu (e.g. the account link)
 * @param {boolean} [o.menu]  also give phones the centre navigation, as a disclosure menu (the
 *   centre navigation itself is hidden below 900 px). Plain <details>: it opens without script.
 */
export function siteHeader({locale,prefix,links=[],studio,brandAttrs={},extra='',navLabel='Nerulio',menu=false}){
 const anchors=links.map(l=>`<a href="${esc(l.href)}"${attrs(l.attrs)}>${esc(l.label)}</a>`).join('');
 const menuHTML=menu&&links.length?`<details class="gs-menu"><summary aria-label="${esc(MENU_LABEL[locale]||MENU_LABEL.en)}">${menuIcon}</summary><nav class="gs-menu-panel" aria-label="${esc(MENU_LABEL[locale]||MENU_LABEL.en)}">${anchors}</nav></details>`:'';
 const languages=`<label class="gs-lang">${globe}<select id="languageSelect" aria-label="${esc(t('language.label',{},locale))}"><option value="auto">${esc(t('language.auto',{},locale))}</option>${LOCALES.map(l=>`<option value="${l}" lang="${l}"${prefix===l+'/'?' selected':''}>${LANGUAGE_NAMES[l]}</option>`).join('')}</select></label>`;
 return `<a class="gs-skip" href="#main">${esc({en:'Skip to content',ko:'본문으로 건너뛰기',ja:'本文へスキップ'}[locale]||'Skip to content')}</a><header class="gs-header page-header"><div class="gs-wrap gs-header-in"><a class="gs-brand brand" href="${prefix}" aria-label="${esc(BRAND.name)}"${attrs(brandAttrs)}>${logoMark({size:26})}<strong>${esc(BRAND.name)}<span>.</span></strong></a><nav class="gs-nav" aria-label="${esc(navLabel)}">${anchors}</nav><div class="gs-header-end">${extra}${languages}<a class="gs-btn gs-btn-primary gs-btn-s header-studio" href="${esc(studio.href)}"${attrs(studio.attrs)}>${esc(studio.label)}</a>${menuHTML}</div></div></header>`;
}
/** The brand column of the footer; the links come from src/content.js footer(). Both sit in a
 * `.gs-footgrid` container (src/game-site.css), which draws the full-width footer band. */
export const FOOTER_LINE={en:'A 2D game asset studio in the browser. Files stay on your device.',ko:'브라우저에서 쓰는 2D 게임 에셋 스튜디오. 파일은 기기 밖으로 나가지 않습니다.',ja:'ブラウザで使う2Dゲームアセットスタジオ。ファイルは端末の外に出ません。'};
export function footerBrand({locale,prefix,line=FOOTER_LINE[locale]||FOOTER_LINE.en,attrs:a={},linkAttrs={}}){
 return `<div class="gs-footer-brand"><a class="gs-brand" href="${prefix}" aria-label="${esc(BRAND.name)}"${attrs(linkAttrs)}>${logoMark({size:26})}<strong>${esc(BRAND.name)}<span>.</span></strong></a><p${attrs(a)}>${esc(line)}</p></div>`;
}
