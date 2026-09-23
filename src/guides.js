/** Editorial how-to guides for 2D game developers (/guides/ and /guides/<slug>/, every language).
 *
 * Contract with the rest of the site (the sitemap, landing pages and internal links read this):
 *  - GUIDES        metadata of every guide; the body lives in content/guides/<slug>/<locale>.md and is
 *                  rendered at build time by tools/guides-build.mjs.
 *  - GUIDE_ROUTES  language-neutral routes, like src/intents.js ROUTES: 'guides' (the index) and
 *                  'guides/<slug>'. Every route also exists under /ko/, /en/ and /ja/.
 *  - guideLastmod(route) → 'YYYY-MM-DD' for a sitemap <lastmod>.
 * Dependency-free: shared by the static build, the browser and tests.
 *
 * Guide fields: slug, section (GUIDE_SECTIONS), engines (GUIDE_ENGINES keys), updated 'YYYY-MM-DD',
 * tools (intent ids in src/intents.js), open ({ws} = a Studio workspace, or {tool} = an intent id —
 * the target of the "Do it in Nerulio" button), related (guide slugs), tested (engine builds the steps
 * and snippets were actually run in), title {ko,en,ja}, description {ko,en,ja}. */
export const GUIDE_INDEX='guides';
export const GUIDE_LOCALES=Object.freeze(['ko','en','ja']);
/** Topic groups of the index, in reading order. */
export const GUIDE_SECTIONS=Object.freeze([
 ['sprites',{ko:'스프라이트 시트와 애니메이션',en:'Sprite sheets and animation',ja:'スプライトシートとアニメーション'}],
 ['pixel-art',{ko:'픽셀 아트 선명하게',en:'Crisp pixel art',ja:'ドット絵をくっきり'}],
 ['tiles',{ko:'타일맵과 오토타일',en:'Tilemaps and autotiles',ja:'タイルマップとオートタイル'}],
 ['atlas',{ko:'아틀라스와 패킹',en:'Atlases and packing',ja:'アトラスとパッキング'}],
 ['animation',{ko:'피벗·히트박스',en:'Pivots and hitboxes',ja:'ピボットと当たり判定'}],
 ['lighting',{ko:'노멀맵과 2D 조명',en:'Normal maps and 2D lighting',ja:'ノーマルマップと2Dライティング'}],
 ['ui',{ko:'UI와 폰트',en:'UI and fonts',ja:'UIとフォント'}]
]);
export const GUIDE_ENGINES=Object.freeze({godot:'Godot 4',unity:'Unity 6',gamemaker:'GameMaker',phaser:'Phaser',pixi:'PixiJS',defold:'Defold',love:'LÖVE',tiled:'Tiled',ldtk:'LDtk',aseprite:'Aseprite',rpgmaker:'RPG Maker'});
export const STUDIO_WORKSPACES=Object.freeze(['sprite','pack','tile']);

export const GUIDES=Object.freeze([
]);

export const guidePath=slug=>`${GUIDE_INDEX}/${slug}`;
export const GUIDE_ROUTES=Object.freeze([GUIDE_INDEX,...GUIDES.map(g=>guidePath(g.slug))]);
const BY_SLUG=new Map(GUIDES.map(g=>[g.slug,g]));
export const guideBySlug=slug=>BY_SLUG.get(slug)||null;
/** 'guides' → {index:true}; 'guides/<slug>' → {guide}; anything else → null. */
export function guideRoute(path){
 const p=String(path).replace(/^\/+|\/+$/g,'');
 if(p===GUIDE_INDEX)return {index:true,guide:null};
 const m=p.match(/^guides\/([a-z0-9-]+)$/);const g=m&&BY_SLUG.get(m[1]);
 return g?{index:false,guide:g}:null;
}
export const isGuideRoute=path=>!!guideRoute(path);
/** Latest update of a route (the index changes whenever any guide does). */
export function guideLastmod(path){
 const r=guideRoute(path);if(!r)return null;
 return r.guide?r.guide.updated:GUIDES.reduce((a,g)=>g.updated>a?g.updated:a,'');
}
