import {BRAND} from '../src/brand.js';
import {st} from '../src/studio/strings.js';
import {serviceMeta} from './service-build.mjs';
/** Static shell of the Studio app at /game/studio/ (and /ko/…, /en/…, /ja/…).
 * An app page, not a landing page: no site header/footer, no SEO copy, never indexed.
 * Monetization (docs/ADS.md, docs/PRICING-MODEL.md) adds only non-executable config to the head:
 * the account-service meta (SERVICE_API=on) and the Studio ad-unit meta (ADSENSE_CLIENT +
 * ADSENSE_SLOT_STUDIO + ADSENSE_CMP_READY). No Google tag is ever in this HTML: the
 * monetization module requests it only after the plan is known to be Free.
 * Everything visible is built by src/studio/main.js; the markup only carries the title, a boot
 * message and a no-JavaScript explanation. */
export const STUDIO_PATH='game/studio';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Head additions for monetization; '' when neither accounts nor the Studio ad unit are on. */
export function studioMonetizationHead(config={}){
 const service=serviceMeta(config),ad=config.studioAd?`<meta name="nerulio-studio-ad" content="${esc(JSON.stringify({client:config.studioAd.client,slot:config.studioAd.slot}))}">`:'';
 if(!service&&!ad)return '';
 // boot.js starts the /me request while the (larger) editor graph is still loading;
 // monetize.css must be render-blocking so the ad column never shifts the editor.
 return service+ad+'<link rel="stylesheet" href="src/studio/monetize/monetize.css"><script type="module" src="src/studio/monetize/boot.js"></script>';
}
export function studioPage({locale,base,config={}}){
 const title=`${st(locale,'app.title')} · ${BRAND.name}`,description=st(locale,'app.description');
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#16181c"><base href="${base}"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="src/studio/studio.css">${studioMonetizationHead(config)}<script type="module" src="src/studio/main.js"></script></head><body class="studio-page" data-ad-exclude><div id="studio"><div class="studio-boot" role="status">${esc(st(locale,'app.loading'))}</div><noscript><p class="studio-noscript">${esc(st(locale,'app.noscript'))}</p></noscript></div></body></html>`;
}
