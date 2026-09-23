import {CAPABILITIES,mayPromote} from './capabilities.js';
import {BRAND} from './brand.js';
import {LOCALES,t} from './i18n.js';
import {INTENTS} from './intents.js';
import {labels} from './content.js';
import {landingText} from './landings.js';
import {esc} from './ui.js';

export function normalizeSiteURL(value){
 if(!value)return '';
 const u=new URL(value);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('SITE_URL must be an HTTP(S) base URL without credentials, query or fragment');
 u.pathname=u.pathname.replace(/\/+$/,'')+'/';return u.href;
}
export function pagePath(path,locale){return `${locale?locale+'/':''}${path?path+'/':''}`;}
export function seoLinks(path,locale,siteURL){
 if(!siteURL)return '';
 const href=l=>esc(new URL(pagePath(path,l),siteURL).href);
 return `<link data-site-seo rel="canonical" href="${href(locale)}"><meta data-site-seo property="og:url" content="${href(locale)}">`+LOCALES.map(l=>`<link data-site-seo rel="alternate" hreflang="${l}" href="${href(l)}">`).join('')+`<link data-site-seo rel="alternate" hreflang="x-default" href="${href(null)}">`;
}
/** `path` selects a landing page (src/landings.js); its own title, copy and canonical apply. */
export function structuredData(id,locale,siteURL,path=''){
 if(id==='home'&&!path)return homeStructuredData(locale,siteURL);
 const land=landingText(path,locale);
 const app={'@context':'https://schema.org','@type':'WebApplication',name:`${land?.title||t(`intent.${id}.title`,{},locale)} · ${BRAND.name}`,description:land?.description||t(`intent.${id}.description`,{},locale),featureList:[CAPABILITIES[id].engine,`Maturity: ${CAPABILITIES[id].maturity}`],applicationCategory:'UtilitiesApplication',operatingSystem:'Web browser',inLanguage:locale,browserRequirements:'JavaScript, Canvas and browser-supported file codecs'};
 if(siteURL)app.url=new URL(pagePath(land?path:INTENTS[id].path,locale),siteURL).href;
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(app).replaceAll('<','\\u003c')}</script>`;
}
/** The home page is the game asset studio: a free web DeveloperApplication. Every feature named
 * here ships (docs/STUDIO-*.md); engine names are the targets whose exports were loaded there. */
const HOME_APP={
 en:['Nerulio — Game asset studio',['Sprite sheet slicing and animation timeline','Pivots, hitboxes and collision polygons per frame','Texture atlas packing (MaxRects, trim, extrude, multipack)','Autotile tilesets: layout recognition, terrain bits, test map','Exports for Godot 4, Unity 6, Phaser, PixiJS, Defold, LÖVE, Spine and Tiled','.aseprite read and write']],
 ko:['Nerulio — 게임 에셋 스튜디오',['스프라이트 시트 자르기와 애니메이션 타임라인','프레임별 피벗·히트박스·충돌 폴리곤','텍스처 아틀라스 패킹(MaxRects·트림·가장자리 확장·다중 페이지)','오토타일 타일셋: 배치 인식·지형 비트·테스트 맵','Godot 4·Unity 6·Phaser·PixiJS·Defold·LÖVE·Spine·Tiled 내보내기','.aseprite 읽기·쓰기']],
 ja:['Nerulio — ゲームアセットスタジオ',['スプライトシート分割とアニメーションのタイムライン','フレームごとのピボット・当たり判定・衝突ポリゴン','テクスチャアトラスのパック（MaxRects・トリム・縁の拡張・マルチパック）','オートタイルのタイルセット：配置の認識・地形ビット・テストマップ','Godot 4・Unity 6・Phaser・PixiJS・Defold・LÖVE・Spine・Tiledへの書き出し','.asepriteの読み書き']]
};
function homeStructuredData(locale,siteURL){
 const [name,featureList]=HOME_APP[locale]||HOME_APP.en;
 const app={'@context':'https://schema.org','@type':'SoftwareApplication',name,description:t('intent.home.description',{},locale),applicationCategory:'DeveloperApplication',applicationSubCategory:'2D game asset tool',operatingSystem:'Web',inLanguage:locale,isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},featureList};
 if(siteURL){app.url=new URL(pagePath('',locale),siteURL).href;app.screenshot=new URL('assets/studio/sprite-frame.webp',siteURL).href;}
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(app).replaceAll('<','\\u003c')}</script>`;
}
export function socialMetadata(id,locale,siteURL,overrides={}){
 const title=overrides.title||t(`intent.${id}.title`,{},locale)+' · '+BRAND.name,description=overrides.description||t(`intent.${id}.description`,{},locale);
 const image=siteURL?new URL(`assets/social/${locale}-${id}.png`,siteURL).href:'';
 return `<meta data-site-seo property="og:type" content="website"><meta data-site-seo property="og:site_name" content="${esc(BRAND.name)}"><meta data-site-seo property="og:locale" content="${{en:'en_US',ko:'ko_KR',ja:'ja_JP'}[locale]}"><meta data-site-seo name="twitter:card" content="summary_large_image"><meta data-site-seo name="twitter:title" content="${esc(title)}"><meta data-site-seo name="twitter:description" content="${esc(description)}">`+(image?`<meta data-site-seo property="og:image" content="${esc(image)}"><meta data-site-seo property="og:image:width" content="1200"><meta data-site-seo property="og:image:height" content="630"><meta data-site-seo property="og:image:alt" content="${esc(title)}"><meta data-site-seo name="twitter:image" content="${esc(image)}">`:'');
}
export function navigationData(id,locale,siteURL,path=''){
 if(!siteURL||id==='home')return '';
 const land=landingText(path,locale),tool={'@type':'ListItem',position:2,name:t(`intent.${id}.title`,{},locale),item:new URL(pagePath(INTENTS[id].path,locale),siteURL).href};
 const data={'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:BRAND.name,item:new URL(pagePath('',locale),siteURL).href},tool,...(land?[{'@type':'ListItem',position:3,name:land.title,item:new URL(pagePath(path,locale),siteURL).href}]:[])]};
 return `<script data-site-seo type="application/ld+json">${JSON.stringify(data).replaceAll('<','\\u003c')}</script>`;
}
export function updateSEO(id,locale,siteURL,path=''){
 const land=landingText(path,locale),social=land?{title:land.title+' · '+BRAND.name,description:land.description}:{};
 document.querySelectorAll('[data-site-seo],[data-quality-robots]').forEach(e=>e.remove());
 document.head.insertAdjacentHTML('beforeend',(!mayPromote(id)?'<meta data-quality-robots name="robots" content="noindex,follow">':'')+seoLinks(land?path:INTENTS[id].path,locale,siteURL)+structuredData(id,locale,siteURL,path)+socialMetadata(id,locale,siteURL,social)+navigationData(id,locale,siteURL,path));
 document.querySelectorAll('[data-ad-label]').forEach(e=>e.textContent=labels[locale].ad);
}
