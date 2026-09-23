import {BRAND} from '../src/brand.js';
import {st} from '../src/studio/strings.js';
/** Static shell of the Studio app at /game/studio/ (and /ko/…, /en/…, /ja/…).
 * An app page, not a landing page: no site header/footer, no SEO copy, no ads, never indexed.
 * Everything visible is built by src/studio/main.js; the markup only carries the title, a boot
 * message and a no-JavaScript explanation. */
export const STUDIO_PATH='game/studio';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function studioPage({locale,base}){
 const title=`${st(locale,'app.title')} · ${BRAND.name}`,description=st(locale,'app.description');
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#16181c"><base href="${base}"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="src/studio/studio.css"><script type="module" src="src/studio/main.js"></script></head><body class="studio-page" data-ad-exclude><div id="studio"><div class="studio-boot" role="status">${esc(st(locale,'app.loading'))}</div><noscript><p class="studio-noscript">${esc(st(locale,'app.noscript'))}</p></noscript></div></body></html>`;
}
