import {mayPromote} from '../src/capabilities.js';
import {BRAND} from '../src/brand.js';
import {EXAMPLES} from '../src/examples.js';
import {INTENTS} from '../src/intents.js';
import {LOCALES} from '../src/i18n.js';
import {pagePath} from '../src/seo.js';
import {esc} from '../src/ui.js';
import {SHOTS,isGameIntentPage} from '../src/game-seo.js';
import {gameSitemapPaths,gamePageFor} from './game-landing-build.mjs';
export function verificationHead(config={}) {
  return [['google-site-verification',config.searchVerification],['naver-site-verification',config.naverVerification],['msvalidate.01',config.bingVerification]].filter(([,v])=>v).map(([name,v])=>`<meta name="${name}" content="${esc(v)}">`).join('');
}
/** Game landing pages first, each with the Studio screenshot it shows; then the before/after
 * examples of the other tools (a game landing shows the Studio, not its old example images). */
export function imageSitemap(siteURL) {
  const game=siteURL?gameSitemapPaths().map(p=>gamePageFor(p)).filter(g=>g&&(g.kind==='hub'||mayPromote(g.id))).flatMap(g=>LOCALES.map(l=>{const shot=SHOTS[g.kind==='hub'?'sprite-frame':g.page.shot];return `<url><loc>${esc(new URL(pagePath(g.canonical,l),siteURL).href)}</loc><image:image><image:loc>${esc(new URL(`assets/studio/${shot.file}.webp`,siteURL).href)}</image:loc></image:image></url>`;})).join(''):'';
  const rows=game+(siteURL?Object.entries(EXAMPLES).filter(([id])=>mayPromote(id)&&!isGameIntentPage(id)).flatMap(([id,e])=>LOCALES.map(l=>`<url><loc>${esc(new URL(pagePath(INTENTS[id].path,l),siteURL).href)}</loc>${['before','after'].map(k=>`<image:image><image:loc>${esc(new URL('assets/examples/'+e[k].file,siteURL).href)}</image:loc></image:image>`).join('')}</url>`)).join(''):'');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${rows}</urlset>`;
}
export function notFound(siteURL='') {
  const base=siteURL?new URL(siteURL).pathname:'/';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(BRAND.name)} · Tool not found</title></head><body><main><h1>404 · Tool not found</h1><p>Check the address or search tools from the home page.</p><a href="${esc(base)}en/?explore=1">Search tools</a><nav aria-label="Popular tools"><a href="${esc(base)}en/image/compress/">Compress image</a> · <a href="${esc(base)}en/pdf/merge/">Merge PDF</a> · <a href="${esc(base)}en/game-asset-pixelizer/">Game Asset Refiner</a></nav><p lang="ko">도구를 찾을 수 없습니다. <a href="${esc(base)}ko/?explore=1">도구 검색</a></p><p lang="ja">ツールが見つかりません。<a href="${esc(base)}ja/?explore=1">ツールを検索</a></p></main></body></html>`;
}
