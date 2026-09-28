import {BRAND} from '../src/brand.js';
import {LOCALES} from '../src/i18n.js';
import {logoMark} from '../src/logo.js';
import {ui} from '../src/task/strings.js';
/** The site root (/): the x-default language entry. src/lang-entry.js sends visitors straight on
 * to /ko/, /en/ or /ja/; this markup is what crawlers without a language preference, visitors
 * without JavaScript and `/?choose` see. It is deliberately not a copy of the English home, which
 * Google had folded into / ("duplicate, Google chose a different canonical" for /en/).
 * `headHTML` carries canonical/hreflang, JSON-LD and social tags as before. */
export const LANGUAGE_NAMES={ko:'한국어',en:'English',ja:'日本語'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function languageEntryPage({base,headHTML}){
 const title=`${BRAND.name} — ${ui('en','homeTitle')} · ${LOCALES.map(l=>LANGUAGE_NAMES[l]).join(' · ')}`,description=ui('en','homeLead');
 const links=LOCALES.map(l=>`<li><a href="${l}/" hreflang="${l}" lang="${l}" data-lang="${l}"><b>${esc(LANGUAGE_NAMES[l])}</b><span>${esc(`${BRAND.name} — ${ui(l,'homeTitle')}`)}</span></a></li>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#0f1114"><base href="${base}"><script src="src/lang-entry.js"></script><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="src/game-site.css"><link rel="stylesheet" href="src/lang-entry.css">${headHTML}
</head><body class="le-page" data-gs><main class="le-card"><a class="le-brand" href="en/" aria-label="${esc(BRAND.name)}">${logoMark()}<strong>${esc(BRAND.name)}</strong></a><h1>${esc(ui('en','homeTitle'))}</h1><p class="le-lead">${esc(description)}</p><nav aria-label="Language · 언어 · 言語"><ul class="le-list">${links}</ul></nav><p class="le-foot">${LOCALES.map(l=>`<span lang="${l}">${esc(ui(l,'gh.footerLine'))}</span>`).join('<br>')}</p></main></body></html>`;
}
