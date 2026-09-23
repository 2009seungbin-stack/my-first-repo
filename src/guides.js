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
 {slug:"godot-4-sprite-sheet-animation",section:"sprites",engines:["godot"],updated:"2026-09-24",tools:["sprite-slicer","sprite-animation-preview"],open:{ws:"sprite"},related:["godot-4-pixel-art-blurry-jitter","hitboxes-pivots-2d-animation","aseprite-files-godot-unity-phaser","unity-6-slice-sprite-sheet-animation"],tested:["Godot 4.7.2"],
  title:{ko:"Godot 4 스프라이트 시트 애니메이션 만들기",en:"Godot 4 Sprite Sheet Animation: SpriteFrames and AnimatedSprite2D",ja:"Godot4 スプライトシート アニメーションの作り方"},
  description:{ko:"Godot 4.7에서 스프라이트 시트를 잘라 AnimatedSprite2D로 재생하는 방법. 격자 크기·간격·오프셋, FPS와 프레임 길이, 코드까지 실제로 확인했습니다.",en:"Slice a sprite sheet in Godot 4.7 with Add Frames from Sprite Sheet: grid size, separation, offset, frame order, FPS, frame durations and code, tested.",ja:"Godot 4.7でスプライトシートを分割しAnimatedSprite2Dで再生する手順。サイズ・間隔・オフセット、FPSとフレーム時間、コードまで実機で確認しました。"}},
 {slug:"unity-6-slice-sprite-sheet-animation",section:"sprites",engines:["unity"],updated:"2026-09-24",tools:["sprite-slicer","sprite-animation-preview","sprite-pivot-editor"],open:{ws:"sprite"},related:["unity-pixel-art-blurry-pixel-perfect","aseprite-files-godot-unity-phaser","godot-4-sprite-sheet-animation","hitboxes-pivots-2d-animation"],tested:["Unity 6000.5.3f1"],
  title:{ko:"유니티 스프라이트 시트 자르기와 애니메이션 만들기",en:"Unity 6: Slice a Sprite Sheet and Make Animation Clips",ja:"Unity スプライトシート 分割とアニメーション作成"},
  description:{ko:"Unity 6 Sprite Editor로 스프라이트 시트를 자르는 법(셀 크기, Padding, Offset, 피벗)과 1픽셀 밀림 해결, 프레임으로 애니메이션 클립 만들기까지 정리합니다.",en:"Slice a sprite sheet in Unity 6 with the Sprite Editor (cell size, padding, offset, pivot), fix the one-pixel drift and build looping Animation Clips.",ja:"Unity 6 の Sprite Editor でスプライトシートを分割する手順（セルサイズ、Padding、Offset、ピボット）と 1 ピクセルずれの防ぎ方、アニメーションクリップの作り方を解説します。"}},
 {slug:"phaser-sprite-sheet-atlas-animation",section:"animation",engines:["phaser","aseprite"],updated:"2026-09-24",tools:["sprite-slicer","sprite-sheet-maker","sprite-animation-preview","atlas-padding"],open:{ws:"sprite"},related:["sprite-sheet-vs-texture-atlas","aseprite-files-godot-unity-phaser","pixel-art-crisp-in-browser-phaser-pixi","pixijs-8-spritesheet-animation"],tested:["Phaser 3.90.0","Phaser 4.2.1","Aseprite 1.3.18"],
  title:{ko:"Phaser 스프라이트 시트·아틀라스 애니메이션 (Phaser 3/4)",en:"Phaser sprite sheet & atlas animation (Phaser 3.90 and 4)",ja:"Phaser スプライトシート・アトラスのアニメーション (3/4対応)"},
  description:{ko:"Phaser 3.90·4에서 스프라이트 시트, 아틀라스, 멀티아틀라스, Aseprite 파일을 불러와 애니메이션을 만드는 방법. 프레임 밀림과 흐림 해결까지 실행해 확인했습니다.",en:"Load sprite sheets, TexturePacker atlases, multiatlases and Aseprite files in Phaser 3.90 and 4, build animations, fix drifting frames and blur. Tested code.",ja:"Phaser 3.90と4でスプライトシート、アトラス、マルチアトラス、Asepriteを読み込みアニメーションを作る方法。コマのずれやぼやけの直し方まで実機で確認済み。"}},
 {slug:"godot-4-terrain-autotile-47-blob",section:"tiles",engines:["godot"],updated:"2026-09-24",tools:["autotile-tester","tile-lab","tileset-slicer"],open:{ws:"tile"},related:["dual-grid-autotile","rpg-maker-a2-autotile-to-godot","tiled-wang-sets-terrain","unity-rule-tile-autotile"],tested:["Godot 4.7.2"],
  title:{ko:"Godot 4 오토타일 터레인 설정: 47타일과 잘못 깔리는 타일 해결",en:"Godot 4 Terrain Autotile: 47-Tile Blob Setup and Wrong-Tile Fixes",ja:"Godot4 オートタイル(テレイン)設定:47タイルと誤配置の直し方"},
  description:{ko:"47타일 블롭 시트로 Godot 4 터레인 세트를 만들고 TileMapLayer로 칠하는 법, 조합 누락·칠하는 순서·피어링 비트 실수로 타일이 잘못 깔리는 원인과 해결을 설명합니다.",en:"Set up a Godot 4 terrain for a 47-tile blob sheet, paint it with TileMapLayer, and fix wrong tiles from missing combinations, painting order and bad bits.",ja:"47タイルのブロブシートでGodot 4のテレインセットを作りTileMapLayerで塗る手順と、組み合わせ不足・塗る順番・ピアリングビットの誤りでタイルがずれる原因と直し方。"}},
 {slug:"dual-grid-autotile",section:"tiles",engines:["godot","tiled"],updated:"2026-09-24",tools:["autotile-tester","tile-lab"],open:{ws:"tile"},related:["godot-4-terrain-autotile-47-blob","tiled-wang-sets-terrain","rpg-maker-a2-autotile-to-godot"],tested:["Godot 4.7.2"],
  title:{ko:"듀얼 그리드 타일맵: 47장 대신 16장 (Godot 4)",en:"Dual-Grid Tilemaps: 16 Tiles Instead of 47 (Godot 4 Guide)",ja:"デュアルグリッドのタイルマップ:47枚ではなく16枚(Godot 4)"},
  description:{ko:"듀얼 그리드 오토타일의 원리, 47장 대신 모서리 타일 16장이면 되는 이유, TileMapLayer 두 개와 반 타일 오프셋으로 Godot 4에서 구현하는 방법을 설명합니다.",en:"How dual-grid autotiling works, why it needs 16 corner tiles instead of 47, and a tested Godot 4 setup with two TileMapLayers and a half-tile offset.",ja:"デュアルグリッドのオートタイルのしくみ、47枚ではなく角タイル16枚で済む理由、TileMapLayer2枚と半タイルのずらしでGodot 4に実装する手順を解説します。"}},
 {slug:"sprite-sheet-vs-texture-atlas",section:"atlas",engines:["phaser","pixi","godot","unity","defold","love","gamemaker"],updated:"2026-09-24",tools:["sprite-sheet-maker","atlas-padding","sprite-slicer"],open:{ws:"pack"},related:["tile-seams-texture-bleeding-padding-extrude","phaser-sprite-sheet-atlas-animation","pixijs-8-spritesheet-animation","godot-4-sprite-sheet-animation"],tested:["Phaser 3.90.0","Phaser 4.2.1","PixiJS 8.21.0","Spine runtime spine-canvas 4.2","Godot 4.7.2"],
  title:{ko:"스프라이트 시트 vs 텍스처 아틀라스: 트림·회전·패딩",en:"Sprite Sheet vs Texture Atlas: Trim, Rotation, Padding",ja:"スプライトシートとテクスチャアトラスの違い"},
  description:{ko:"그리드 스프라이트 시트와 패킹 아틀라스의 차이, 트림 오프셋, 회전 프레임을 읽는 엔진, 패딩·익스트루드, 최대 텍스처 크기와 드로우 콜을 실제 엔진으로 검증했습니다.",en:"Grid sprite sheet or packed atlas? Trim offsets, which engines read rotated frames, padding and extrude, max texture size and draw calls, tested in engines.",ja:"等間隔スプライトシートとパック済みアトラスの違い、トリムのオフセット、回転フレーム対応エンジン、パディング・押し出し、最大テクスチャサイズとドローコールを実機で検証しました。"}},
 {slug:"opengl-vs-directx-normal-maps",section:"lighting",engines:["godot","unity"],updated:"2026-09-24",tools:["normal-map-converter","texture-lab","texture-map"],open:{tool:"normal-map-converter"},related:["2d-normal-maps-lighting-godot-unity","tile-seams-texture-bleeding-padding-extrude","godot-4-pixel-art-blurry-jitter"],tested:["Godot 4.7.2","Unity 6000.5.3f1"],
  title:{ko:"노멀맵 OpenGL vs DirectX 차이와 그린 채널 반전",en:"OpenGL vs DirectX Normal Maps: Which One and How to Convert",ja:"ノーマルマップのOpenGLとDirectXの違いと緑チャンネル反転"},
  description:{ko:"OpenGL(Y+)과 DirectX(Y−) 노멀맵은 그린 채널만 다릅니다. Godot·Unity·Unreal·Blender가 기대하는 규격, 구별법, 반전 방법을 정리합니다.",en:"OpenGL (Y+) and DirectX (Y−) normal maps differ only in the green channel. Which one Godot, Unity, Unreal and Blender expect, how to tell, and how to flip it.",ja:"OpenGL(Y+)とDirectX(Y−)のノーマルマップは緑チャンネルだけが違います。Godot・Unity・Unreal・Blenderの規格、見分け方、反転方法を解説します。"}}
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
