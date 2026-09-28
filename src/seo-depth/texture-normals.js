/** Intent content for the texture-normals pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/normals/*.js (normal.js quantiser and kernels, pipeline.js per-frame
 * regions and suggestions, lighting.js = Godot's canvas light, convention.js, export.js), the Texture
 * Lab (src/game/texture-normal.js, src/task/texture-lab-maps.js), docs/STUDIO-TEXTURE.md,
 * docs/TEXTURE-LAB.md and docs/H2H-PAID.md. Every worked number was recomputed with those modules.
 * Engine behaviour: the official docs in each page's `versions.sources` (read 2026-09-28).
 * Laigter / NormalMap-Online features: their own GitHub repositories, release notes and tool page. */
const G_LIGHTS='[Godot 4.7 docs: 2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)';
const G_CANVAS='[Godot 4.7 docs: CanvasTexture](https://docs.godotengine.org/en/stable/classes/class_canvastexture.html)';
const G_POINT='[Godot 4.7 docs: PointLight2D](https://docs.godotengine.org/en/stable/classes/class_pointlight2d.html)';
const G_DIR='[Godot 4.7 docs: DirectionalLight2D](https://docs.godotengine.org/en/stable/classes/class_directionallight2d.html)';
const G_LIGHT2D='[Godot 4.7 docs: Light2D](https://docs.godotengine.org/en/stable/classes/class_light2d.html)';
const G_ITEM='[Godot 4.7 docs: CanvasItem (light_mask)](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html)';
const G_IMPORT='[Godot 4.7 docs: Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)';
const U_NORMAL='[Unity manual: Normal map (Y+, RGB = XYZ)](https://docs.unity3d.com/Manual/StandardShaderMaterialParameterNormalMap.html)';
const U_SECONDARY='[Unity manual: Add a normal map or a mask map to a sprite in URP](https://docs.unity3d.com/Manual/urp/SecondaryTextures.html)';
const U_LIGHT='[Unity 6 manual: Light 2D component reference](https://docs.unity3d.com/6000.4/Documentation/Manual/urp/2DLightProperties.html)';
const U_RENDERER='[Unity 6 manual: Renderer 2D asset reference](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/2DRendererData-overview.html)';
const U_PREPARE='[Unity 6 manual: Prepare your project for 2D lighting](https://docs.unity3d.com/6000.1/Documentation/Manual/urp/create-light-2d.html)';
const LAIGTER='[Laigter on GitHub (README)](https://github.com/azagaya/laigter)';
const LAIGTER_REL='[Laigter release notes](https://github.com/azagaya/laigter/releases)';
const NMO='[NormalMap-Online on GitHub](https://github.com/cpetry/NormalMap-Online)';
export default {
 'game/sprite-normal-map':{
  type:'create',
  intent:{primary:'generate a normal map for a 2D sprite so it reacts to 2D lights',secondary:['what the colours of a normal map mean','bevel vs detail from brightness','use the map in Godot or Unity'],
   goal:'a normal map PNG (or an engine bundle) that makes a sprite shade correctly under moving 2D lights',input:'sprite PNG with transparency (optionally a height map of the same size)',output:'_n.png (OpenGL) / _n_dx.png (DirectX), Godot 4 or Unity 6 URP 2D bundle',target:'any 2D engine; Godot 4 and Unity 6 verified',support:'full',
   evidence:['src/game/normals/pipeline.js (suggestParams, generate)','src/game/normals/normal.js (normalsFromHeight, encodeNormals)','docs/STUDIO-TEXTURE.md (Godot 4.7.2 6/6, Unity 12/12, head-to-head)','docs/H2H-PAID.md §2'],
   external:['Unity manual: Y+ normal maps, RGB = XYZ','Godot CanvasTexture normal_texture (X+, Y+, Z+)','Godot PointLight2D height','Unity Secondary Textures _NormalMap']},
  en:{
   answer:'A sprite normal map is a second PNG, the same size as the sprite, whose RGB says which way each pixel\'s surface faces, so 2D lights can shade a flat drawing as if it had relief. Drop a sprite with transparency and the Studio\'s Texture workspace builds one at once (a bevel grown in from the transparent edge, plus detail from brightness), lights it with Godot 4\'s own 2D formula and exports `_n.png` (OpenGL, Y+), `_n_dx.png` (DirectX) or a ready Godot 4 or Unity 6 URP 2D bundle, both checked in the engines.',
   concept:{title:'What a sprite normal map stores, and where the relief comes from',body:[
    'A tangent-space normal map stores one unit vector per pixel as a colour: red is X (towards the right of the image), green is Y (towards the top, in the OpenGL convention Godot and Unity use) and blue is Z (out of the screen). Each component is written as (n + 1) ÷ 2 × 255, so a pixel that faces the viewer straight on is (128, 128, 255), the lavender-blue of every normal map, and a face tilted 45° to the right is (218, 128, 218).',
    'A drawing has no depth, so every generator guesses a height field and takes its slope. Nerulio builds that height from a bevel that rises from the transparent edge (distance to the silhouette, shaped by a round, linear, smooth, cove or ledge profile) and, optionally, detail from brightness, which the Studio labels an approximation because paint is not shape. Your own height map of the same size, 16-bit included, can be added.',
    'The normal is the slope of that height: n ∝ (−strength·∂h/∂x, strength·∂h/∂y, 1) with rows counted downward, normalised to length 1. Heights are in pixels, so strength 1 turns a rise of 1 px per px into a 45° face. The kernel (Pixel, Sobel, Scharr or Sobel 5×5) only decides how much the slope is smoothed.',
    'A 2D light then brightens each pixel by N·L, the cosine between the normal and the direction to the light, and the light\'s height above the sprite plane decides how steeply it arrives. The same map looks almost flat under a light high above and deeply carved under a low, grazing one.'],
    terms:[['Tangent space','Directions measured on the sprite\'s own surface: X right, Y up, Z towards the viewer.'],['Flat normal','(128, 128, 255): no tilt, so a light shades the pixel as if there were no map.'],['Bevel','Height that grows inward from the transparent edge: a thin rounded rim, or a pillow over the whole shape.'],['Strength','The multiplier on every slope; it steepens faces without moving where the relief is.']]},
   example:{title:'Example: the numbers behind one bevelled edge',lead:'The left rim of a sprite, where the height climbs 1 px per px to the right into the body, with the Pixel kernel:',lines:[
    'slope ∂h/∂x = 1 px/px          n ∝ (−s·1, 0, 1)',
    'strength 0.5 → tilt 26.6°      RGB ( 70, 128, 242)',
    'strength 1   → tilt 45.0°      RGB ( 37, 128, 218)',
    'strength 2   → tilt 63.4°      RGB ( 13, 128, 185)',
    '',
    'light 64 px to the LEFT, 64 px high → L = (−0.707, 0, 0.707)',
    'strength 1:  N·L = 0.707·0.707 + 0.707·0.707 = 1.00 → fully lit',
    'light 64 px to the RIGHT:        N·L = max(0, −0.5 + 0.5) = 0 → ambient only'],
    after:'The rim that faces the light glows and the opposite rim goes dark; that contrast is the whole effect. Strength steepens every face at once, so to make a body look rounder rather than sharper, widen the bevel instead: the Studio suggests 1.5 px for frames up to 128 px and about 0.9 × the typical inscribed radius for larger sprites.'},
   target:{title:'Use the map in your engine',steps:[
    'Godot 4: put `_n.png` into the Normal Map Texture of a `CanvasTexture` used as the sprite\'s texture, and give a `PointLight2D` a Height above 0 (its default is 0). The exported `_lit.tscn` scene is already wired; details on [[game/godot-2d-normal-map|the Godot 2D normal map page]].',
    'Unity 6 URP 2D: attach `_n.png` to the sprite as Secondary Texture `_NormalMap`, keep the Sprite-Lit-Default material, and set the Light 2D\'s Normal Map Quality to Fast or Accurate (it is Disabled by default). The shipped importer does the texture part; see [[game/unity-2d-normal-map|the Unity 2D normal map page]].',
    'An engine that expects DirectX-style green: take `_n_dx.png` from the PNG set. It differs from `_n.png` only in green (255 − g).',
    'An animated sheet: cut the frames in the Sprite workspace first so every frame gets its own relief; see [[game/normal-map-sprite-sheet|normal maps for sprite sheets]].']},
   verify:{steps:[
    'Drag the light in a circle around the sprite in the Lit view: the bright rim must follow the light. A rim that lights up on the far side means the map is being read in the other convention.',
    'Press C to split flat and lit. Anything darker in the lit half than in the flat half is a face turned away from every light; check that this is where you expect shadowed sides.',
    'Switch to the Height view: a dark cloak or outline that appears as a pit is brightness read as shape.',
    'Open `_n.png` in any viewer: transparent areas are (128, 128, 255) with full alpha on purpose, and the edge normals are copied 2 px outward so filtering at the silhouette never mixes in a wrong vector.']},
   trouble:{rows:[
    ['Dark paint (a cloak, an outline) looks like a hole','Detail from brightness reads dark as low','Height view: the area sits in a pit','Lower the brightness height, set a smaller "Ignore shading wider than", or raise the area with the Height brush (B)'],
    ['The sprite looks like a flat plate with a thin lit edge','A pixel-art rim (1.5 px) on a large painted sprite','Normal view: colour only in a 1–2 px ring','Widen the bevel towards ≈ 0.9 × the inscribed radius, or choose the round profile'],
    ['Lit from the wrong side in the engine','The engine reads the other green convention, or another tool wrote red inverted','Put a light above the sprite: top edges must brighten','Use `_n.png` for Godot and Unity; for a map from elsewhere read [[game/normal-map-opengl-or-directx|OpenGL or DirectX]]'],
    ['No visible effect in the engine','The map is not where the renderer reads it, or the light ignores normal maps','Godot: the CanvasTexture\'s normal slot; Unity: `_NormalMap` and the Light 2D quality','Use the exported scene or importer, or follow the engine page'],
    ['Hand-painted pixel art looks worse lit than unlit','Stylised shading cannot be derived from the colours','Compare with the flat half (C)','Paint relief with the Height brush, try [[game/pixel-art-normal-map|quantised pixel-art normals]], or hand-paint the map']]},
   alternatives:{rows:[
    ['Laigter (desktop; free GPL-3 build on GitHub)','You want a desktop app with presets, specular, occlusion and parallax maps and a command line. Its default dome came closest on 3D-rendered sprites (18.3° against the Studio\'s 20.0°); see [[game/laigter-alternative|Laigter compared]].'],
    ['Bake from a 3D model','Sprites rendered from 3D: baked normals are the ground truth that every generator only approximates.'],
    ['Paint the normal map by hand','Stylised pixel art: on a hand-painted CC0 torch every generator, Nerulio included, was 37–42° off the artist\'s map.'],
    ['[[normal-map-generator|Height-to-normal generator]] (Texture Lab)','You already have a height or grey image and want only its gradient, without bevel or lights.']]},
   limits:['The relief is a guess from the silhouette and the colours, not the shape the artist had in mind.','The rim light in the preview is not exported: no engine draws it without a custom shader.','In Unity the brightness curve is URP\'s own falloff; the normal-map term (N·L) is what was verified.'],
   versions:{body:['Nerulio: the Godot 4 bundle was rendered by Godot 4.7.2 (Compatibility renderer) on six real CC0 cases, every checked frame within 1/255 of the preview; the Unity 6 bundle passed 12 of 12 runs in Unity 6000.5.3f1 with URP 17.5 (mean N·L error 0.0037–0.0085). The angles against real reference normals come from the head-to-head of 2026-09-24. The byte encoding and the Y+ convention follow the Unity and Godot documentation below.'],sources:[U_NORMAL,G_CANVAS,G_POINT,U_SECONDARY]}
  },
  ko:{
   answer:'스프라이트 노멀맵은 스프라이트와 같은 크기의 PNG 한 장으로, 픽셀마다 표면이 어느 쪽을 향하는지를 RGB로 담습니다. 그래서 평평한 그림도 2D 조명 아래에서 입체처럼 음영이 생깁니다. 투명 배경 스프라이트를 넣으면 Studio 텍스처 작업 공간이 투명한 가장자리에서 안쪽으로 올라오는 베벨과 밝기 디테일로 곧바로 노멀맵을 만들고, Godot 4의 2D 계산식 그대로 비춰 보여 준 뒤 `_n.png`(OpenGL, Y+), `_n_dx.png`(DirectX), 또는 엔진에서 확인한 Godot 4·Unity 6 URP 2D 번들로 내보냅니다.',
   concept:{title:'스프라이트 노멀맵에 담기는 것과 입체감의 출처',body:[
    '탄젠트 공간 노멀맵은 픽셀마다 단위 벡터 하나를 색으로 저장합니다. 빨강은 X(이미지 오른쪽), 초록은 Y(Godot와 Unity가 쓰는 OpenGL 방식에서는 위쪽), 파랑은 Z(화면 밖)입니다. 각 성분은 (n + 1) ÷ 2 × 255로 기록되므로 정면을 보는 픽셀은 모든 노멀맵에서 보이는 연보라색 (128, 128, 255)이고, 오른쪽으로 45° 기운 면은 (218, 128, 218)입니다.',
    '그림에는 깊이가 없으니 어떤 생성기든 높이를 추측한 뒤 그 기울기를 구합니다. Nerulio는 투명한 가장자리에서 솟아오르는 베벨(실루엣까지의 거리에 둥근·직선·부드러운·오목·턱 모양을 적용)과, 선택적으로 밝기에서 얻은 디테일로 높이를 만듭니다. 밝기 디테일은 칠이 곧 형태는 아니므로 화면에 근사치라고 표시됩니다. 같은 크기의 높이 맵(16비트 포함)을 더할 수도 있습니다.',
    '노멀은 그 높이의 기울기입니다. 행을 아래로 세는 이미지 좌표에서 n ∝ (−강도·∂h/∂x, 강도·∂h/∂y, 1)을 길이 1로 정규화합니다. 높이는 픽셀 단위라서 강도 1이면 1픽셀당 1픽셀 오르는 경사가 45° 면이 됩니다. 커널(Pixel·Sobel·Scharr·Sobel 5×5)은 기울기를 얼마나 부드럽게 할지만 정합니다.',
    '2D 조명은 픽셀마다 N·L, 즉 노멀과 조명 방향 사이 각도의 코사인만큼 밝게 합니다. 조명이 스프라이트 평면에서 얼마나 높이 있는지가 빛이 들어오는 각도를 정하므로, 같은 맵도 높은 조명 아래에서는 거의 평평하고 낮게 스치는 조명 아래에서는 깊게 파인 듯 보입니다.'],
    terms:[['탄젠트 공간','스프라이트 표면 기준의 방향. X는 오른쪽, Y는 위, Z는 보는 사람 쪽.'],['평평한 노멀','(128, 128, 255). 기울기가 없어 노멀맵이 없는 것처럼 비춰집니다.'],['베벨','투명한 가장자리에서 안쪽으로 올라오는 높이. 얇고 둥근 테두리나 전체가 부푼 모양.'],['강도','모든 기울기에 곱하는 값. 입체의 위치는 그대로 두고 면을 더 가파르게 합니다.']]},
   example:{title:'예시: 베벨 가장자리 하나의 숫자',lead:'스프라이트의 왼쪽 테두리, 즉 오른쪽으로 갈수록 몸통 쪽으로 1픽셀당 1픽셀씩 높아지는 곳을 Pixel 커널로 계산하면:',lines:[
    '기울기 ∂h/∂x = 1 px/px          n ∝ (−s·1, 0, 1)',
    '강도 0.5 → 기울기 26.6°         RGB ( 70, 128, 242)',
    '강도 1   → 기울기 45.0°         RGB ( 37, 128, 218)',
    '강도 2   → 기울기 63.4°         RGB ( 13, 128, 185)',
    '',
    '조명이 왼쪽 64px, 높이 64px → L = (−0.707, 0, 0.707)',
    '강도 1:  N·L = 0.707·0.707 + 0.707·0.707 = 1.00 → 가장 밝음',
    '조명이 오른쪽 64px:             N·L = max(0, −0.5 + 0.5) = 0 → 주변광만'],
    after:'빛을 향한 테두리는 빛나고 반대쪽 테두리는 어두워지는데, 이 대비가 효과의 전부입니다. 강도는 모든 면을 한꺼번에 가파르게 하므로 몸통을 날카롭게 말고 둥글게 보이게 하려면 베벨 폭을 넓히세요. Studio는 128px 이하 프레임에 1.5px, 그보다 큰 스프라이트에는 대표 내접 반지름의 약 0.9배를 추천합니다.'},
   target:{title:'엔진에서 노멀맵 쓰기',steps:[
    'Godot 4: 스프라이트 텍스처로 쓰는 `CanvasTexture`의 Normal Map Texture에 `_n.png`를 넣고, `PointLight2D`의 Height를 0보다 크게 둡니다(기본값 0). 내보낸 `_lit.tscn` 씬은 이미 연결되어 있습니다. 자세한 내용은 [[game/godot-2d-normal-map|Godot 2D 노멀맵 페이지]].',
    'Unity 6 URP 2D: `_n.png`를 스프라이트의 보조 텍스처 `_NormalMap`으로 붙이고, Sprite-Lit-Default 머티리얼을 쓰며, Light 2D의 Normal Map Quality를 Fast나 Accurate로 바꿉니다(기본값 Disabled). 텍스처 쪽은 함께 내보내는 임포터가 처리합니다. [[game/unity-2d-normal-map|Unity 2D 노멀맵 페이지]] 참고.',
    'DirectX 방식 초록을 읽는 엔진: PNG 세트의 `_n_dx.png`를 쓰세요. `_n.png`와는 초록(255 − g)만 다릅니다.',
    '애니메이션 시트: 먼저 스프라이트 작업 공간에서 프레임을 잘라야 프레임마다 입체가 따로 계산됩니다. [[game/normal-map-sprite-sheet|스프라이트 시트 노멀맵]] 참고.']},
   verify:{steps:[
    'Lit 보기에서 조명을 스프라이트 둘레로 한 바퀴 끌어 보세요. 밝은 테두리가 조명을 따라가야 합니다. 먼 쪽 테두리가 밝아지면 다른 규약으로 읽히고 있는 것입니다.',
    'C로 평면과 조명 화면을 나눕니다. 조명 쪽이 평면 쪽보다 어두운 곳은 모든 조명에서 등을 돌린 면이니, 그늘져야 할 자리인지 확인하세요.',
    '높이 보기로 바꿉니다. 어두운 망토나 외곽선이 움푹 파여 보이면 밝기를 형태로 읽은 것입니다.',
    '`_n.png`를 아무 뷰어로 열어 보세요. 투명한 부분이 알파가 꽉 찬 (128, 128, 255)인 것은 의도된 것이고, 가장자리 노멀을 2px 밖으로 복사해 실루엣에서 필터링해도 엉뚱한 벡터가 섞이지 않습니다.']},
   trouble:{rows:[
    ['어두운 칠(망토, 외곽선)이 구멍처럼 보임','밝기 디테일이 어두운 곳을 낮은 곳으로 읽음','높이 보기에서 그 부분이 파여 있음','밝기 높이를 낮추거나 "넓은 음영 무시" 값을 줄이거나, 높이 브러시(B)로 올리기'],
    ['스프라이트가 테두리만 빛나는 납작한 판처럼 보임','큰 채색 스프라이트에 도트용 1.5px 테두리가 적용됨','노멀 보기에서 1~2px 고리에만 색이 있음','베벨을 내접 반지름의 약 0.9배로 넓히거나 둥근 모양 선택'],
    ['엔진에서 반대쪽이 밝아짐','엔진이 다른 초록 규약을 읽거나, 다른 툴이 빨강을 뒤집어 저장함','조명을 위에 두면 윗가장자리가 밝아져야 함','Godot·Unity에는 `_n.png` 사용. 다른 곳에서 받은 맵은 [[game/normal-map-opengl-or-directx|OpenGL·DirectX 판별]] 참고'],
    ['엔진에서 아무 변화가 없음','렌더러가 읽는 자리에 맵이 없거나, 조명이 노멀맵을 무시함','Godot는 CanvasTexture의 노멀 칸, Unity는 `_NormalMap`과 Light 2D 품질','내보낸 씬이나 임포터를 쓰거나 엔진별 페이지를 따라 하기'],
    ['손으로 찍은 도트가 조명을 켜면 더 어색함','양식화된 음영은 색에서 계산해 낼 수 없음','C로 평면 화면과 비교','높이 브러시로 입체를 칠하거나 [[game/pixel-art-normal-map|양자화한 도트 노멀]]을 쓰거나, 맵을 직접 그리기']]},
   alternatives:{rows:[
    ['Laigter(데스크톱, GitHub의 무료 GPL-3 빌드)','프리셋, 스페큘러·오클루전·패럴랙스 맵, 명령줄이 있는 데스크톱 앱이 필요할 때. 3D로 렌더한 스프라이트에서는 기본 돔 모양이 가장 가까웠습니다(18.3°, Studio 20.0°). [[game/laigter-alternative|Laigter 비교]] 참고.'],
    ['3D 모델에서 굽기','3D로 렌더한 스프라이트라면 구운 노멀이 정답이고, 생성기는 그것을 흉내 낼 뿐입니다.'],
    ['노멀맵을 손으로 그리기','양식화된 도트 그림. 손으로 칠한 CC0 횃불에서는 Nerulio를 포함한 모든 생성기가 원작자의 맵과 37~42° 차이 났습니다.'],
    ['[[normal-map-generator|높이 → 노멀 생성기]](텍스처 랩)','이미 높이 맵이나 회색 이미지가 있고 베벨이나 조명 없이 기울기만 필요할 때.']]},
   limits:['입체는 실루엣과 색에서 추측한 것이지, 작가가 생각한 형태가 아닙니다.','미리보기의 림 라이트는 내보내지 않습니다. 커스텀 셰이더 없이 그리는 엔진이 없기 때문입니다.','Unity의 밝기 곡선은 URP 자체 감쇠이며, 검증한 것은 노멀맵 항(N·L)입니다.'],
   versions:{body:['Nerulio: Godot 4 번들은 Godot 4.7.2(Compatibility 렌더러)가 실제 CC0 사례 6건을 렌더했고 확인한 모든 프레임이 미리보기와 1/255 이내였습니다. Unity 6 번들은 Unity 6000.5.3f1·URP 17.5에서 12회 중 12회 통과했습니다(N·L 평균 오차 0.0037~0.0085). 실제 기준 노멀과의 각도는 2026-09-24 비교 측정 결과입니다. 바이트 인코딩과 Y+ 규약은 아래 Unity·Godot 문서를 따릅니다.'],sources:[U_NORMAL,G_CANVAS,G_POINT,U_SECONDARY]}
  },
  ja:{
   answer:'スプライトのノーマルマップ（法線マップ）は、スプライトと同じサイズのPNGで、各ピクセルの面がどちらを向いているかをRGBで持ちます。これで平らな絵も2Dライトの下で立体的に陰影がつきます。透過付きのスプライトをドロップすると、Studioのテクスチャ作業画面が透明な縁から内側へ立ち上がる面取りと明るさの細部ですぐにノーマルマップを作り、Godot 4の2Dの計算式そのままで照らして見せ、`_n.png`（OpenGL、Y+）、`_n_dx.png`（DirectX）、またはエンジンで確認済みのGodot 4・Unity 6 URP 2D用バンドルとして書き出します。',
   concept:{title:'スプライトのノーマルマップが持つ情報と、立体感の出どころ',body:[
    '接空間ノーマルマップは、ピクセルごとに単位ベクトルを1つ色として保存します。赤がX（画像の右）、緑がY（GodotとUnityが使うOpenGL方式では上）、青がZ（画面の手前）です。各成分は (n + 1) ÷ 2 × 255 で書かれるので、正面を向いたピクセルはどのノーマルマップにもある薄紫の (128, 128, 255)、右へ45°傾いた面は (218, 128, 218) になります。',
    '絵には奥行きがないため、どの生成ツールも高さを推定してからその傾きを求めます。Nerulioは、透明な縁から立ち上がる面取り（シルエットまでの距離に丸・直線・なめらか・くぼみ・段の形状を適用）と、必要なら明るさからの細部で高さを作ります。塗りは形そのものではないので、明るさの細部は画面上で近似と明記されます。同じサイズの高さマップ（16ビットも可）を足すこともできます。',
    'ノーマルはその高さの傾きです。行を下向きに数える画像座標で n ∝ (−強さ·∂h/∂x, 強さ·∂h/∂y, 1) を長さ1に正規化します。高さはピクセル単位なので、強さ1なら1ピクセルにつき1ピクセル上がる斜面が45°の面になります。カーネル（Pixel・Sobel・Scharr・Sobel 5×5）が決めるのは、傾きをどれだけなめらかにするかだけです。',
    '2Dライトは各ピクセルをN·L、つまりノーマルと光の方向のなす角のコサインの分だけ明るくします。スプライトの平面からライトまでの高さが光の入る角度を決めるため、同じマップでも高い位置のライトではほぼ平らに、低くかすめるライトでは深く彫られたように見えます。'],
    terms:[['接空間','スプライトの面を基準にした方向。Xが右、Yが上、Zが見る人の側。'],['平らなノーマル','(128, 128, 255)。傾きがなく、マップがないのと同じように照らされます。'],['面取り（ベベル）','透明な縁から内側へ上がる高さ。細く丸い縁か、全体がふくらむクッション形。'],['強さ','すべての傾きに掛ける値。凹凸の位置は変えずに面を急にします。']]},
   example:{title:'具体例：面取りした縁ひとつの数値',lead:'スプライトの左の縁、つまり右へ行くほど体の内側へ1ピクセルにつき1ピクセル高くなる所を、Pixelカーネルで計算すると：',lines:[
    '傾き ∂h/∂x = 1 px/px           n ∝ (−s·1, 0, 1)',
    '強さ 0.5 → 傾き 26.6°          RGB ( 70, 128, 242)',
    '強さ 1   → 傾き 45.0°          RGB ( 37, 128, 218)',
    '強さ 2   → 傾き 63.4°          RGB ( 13, 128, 185)',
    '',
    'ライトが左64px・高さ64px → L = (−0.707, 0, 0.707)',
    '強さ1:  N·L = 0.707·0.707 + 0.707·0.707 = 1.00 → 最も明るい',
    'ライトが右64px:               N·L = max(0, −0.5 + 0.5) = 0 → 環境光のみ'],
    after:'光の側の縁が輝き、反対側の縁が暗くなる。この対比が効果のすべてです。強さはすべての面を一度に急にするので、体を鋭くではなく丸く見せたいときは面取りの幅を広げてください。Studioは128px以下のフレームに1.5px、それより大きいスプライトには代表的な内接半径の約0.9倍を推奨します。'},
   target:{title:'エンジンでノーマルマップを使う',steps:[
    'Godot 4：スプライトのテクスチャにした `CanvasTexture` のNormal Map Textureに `_n.png` を入れ、`PointLight2D` のHeightを0より大きくします（既定値は0）。書き出した `_lit.tscn` シーンは接続済みです。詳しくは[[game/godot-2d-normal-map|Godot 2Dノーマルマップのページ]]へ。',
    'Unity 6 URP 2D：`_n.png` をスプライトのセカンダリテクスチャ `_NormalMap` として追加し、マテリアルはSprite-Lit-Defaultのまま、Light 2DのNormal Map QualityをFastかAccurateにします（既定はDisabled）。テクスチャ側は同梱のインポーターが設定します。[[game/unity-2d-normal-map|Unity 2Dノーマルマップのページ]]を参照。',
    'DirectX方式の緑を読むエンジン：PNGセットの `_n_dx.png` を使います。`_n.png` との違いは緑（255 − g）だけです。',
    'アニメーションのシート：先にスプライト作業画面でフレームを切ると、フレームごとに立体が計算されます。[[game/normal-map-sprite-sheet|スプライトシートのノーマルマップ]]を参照。']},
   verify:{steps:[
    'Lit表示でライトをスプライトの周りに一周ドラッグします。明るい縁がライトについてくるはずです。遠い側の縁が光るなら、別の規約で読まれています。',
    'Cでフラットとライティングを並べます。ライティング側がフラット側より暗い所は、どのライトにも背を向けた面です。影になるべき場所か確かめてください。',
    '高さ表示に切り替えます。暗いマントや輪郭がくぼんで見えたら、明るさを形として読んでいます。',
    '`_n.png` を任意のビューアーで開きます。透明部分がアルファ最大の (128, 128, 255) なのは意図どおりで、縁のノーマルを2px外側へ複製しているので、シルエットでフィルタリングしても誤ったベクトルが混ざりません。']},
   trouble:{rows:[
    ['暗い塗り（マント、輪郭）が穴に見える','明るさの細部が暗い所を低いと読んだ','高さ表示でその部分がくぼんでいる','明るさの高さを下げる、「広い陰影を無視」の値を小さくする、または高さブラシ（B）で持ち上げる'],
    ['スプライトが縁だけ光る平たい板に見える','大きな塗りのスプライトにドット絵向けの1.5pxの縁が使われた','ノーマル表示で色があるのが1〜2pxの輪だけ','面取りを内接半径の約0.9倍へ広げるか、丸形を選ぶ'],
    ['エンジンで反対側が明るくなる','エンジンが別の緑の規約を読む、またはほかのツールが赤を反転して保存した','ライトを上に置くと上の縁が明るくなるはず','GodotとUnityには `_n.png`。よそで作ったマップは[[game/normal-map-opengl-or-directx|OpenGL・DirectXの判定]]へ'],
    ['エンジンで何も変わらない','レンダラーが読む場所にマップがない、またはライトがノーマルマップを無視している','GodotはCanvasTextureのノーマル欄、Unityは `_NormalMap` とLight 2Dの品質','書き出したシーンやインポーターを使うか、エンジン別のページどおりに設定'],
    ['手打ちのドット絵がライトで余計に不自然','様式化された陰影は色から計算できない','Cでフラット表示と比べる','高さブラシで凹凸を描く、[[game/pixel-art-normal-map|量子化したドット絵用ノーマル]]を使う、またはマップを手で描く']]},
   alternatives:{rows:[
    ['Laigter（デスクトップ、GitHubに無料のGPL-3版）','プリセット、スペキュラー・オクルージョン・パララックスのマップ、コマンドラインがあるデスクトップアプリがほしいとき。3Dから描画したスプライトでは既定のドーム形が最も近い結果でした（18.3°、Studioは20.0°）。[[game/laigter-alternative|Laigterとの比較]]を参照。'],
    ['3Dモデルからベイク','3Dからレンダリングしたスプライトなら、ベイクしたノーマルが正解で、生成ツールはそれを近似するだけです。'],
    ['ノーマルマップを手で描く','様式化したドット絵。手描きのCC0のたいまつでは、Nerulioを含むすべての生成ツールが作者のマップと37〜42°ずれました。'],
    ['[[normal-map-generator|高さ → ノーマル生成]]（テクスチャラボ）','高さマップやグレー画像がすでにあり、面取りもライトもなしで勾配だけがほしいとき。']]},
   limits:['立体はシルエットと色から推定したもので、作者が考えた形ではありません。','プレビューのリムライトは書き出しません。カスタムシェーダーなしで描くエンジンがないためです。','Unityの明るさのカーブはURP独自の減衰で、検証したのはノーマルマップの項（N·L）です。'],
   versions:{body:['Nerulio：Godot 4用バンドルはGodot 4.7.2（Compatibilityレンダラー）が実在するCC0の6ケースを描画し、確認した全フレームがプレビューと1/255以内でした。Unity 6用バンドルはUnity 6000.5.3f1・URP 17.5で12回中12回合格（N·Lの平均誤差0.0037〜0.0085）。実際の正解ノーマルとの角度は2026-09-24の比較測定によるものです。バイトの符号化とY+の規約は下記のUnity・Godotのドキュメントに従います。'],sources:[U_NORMAL,G_CANVAS,G_POINT,U_SECONDARY]}
  }
 },
 'normal-map-generator':{
  type:'create',
  intent:{primary:'generate a normal map from a height map or grey image online',secondary:['Sobel vs Scharr vs Sobel 5×5','how strength changes the tilt','OpenGL or DirectX output','seamless (wrap) normal maps'],
   goal:'a tangent-space normal map PNG whose slopes match the height image, in the convention the engine reads',input:'height map, grey texture or sprite (PNG exact; JPEG/WebP decoded by the browser)',output:'normal map PNG, OpenGL (Y+) or DirectX (Y−)',target:'any engine or 3D app',support:'full',
   evidence:['src/game/texture-normal.js (heightToNormal, kernels, flipGreen, validateNormalMap)','src/task/texture-lab-maps.js (luminance or alpha source, strength 0–10, default 2)','src/game/texture-fix.js (heightFromLuminance, Rec. 709)','docs/TEXTURE-LAB.md (Verification)'],
   external:['Unity manual: Y+ normal maps, RGB = XYZ','Godot import option Normal Map Invert Y']},
  en:{
   answer:'A normal map generator turns a height or grey image into a tangent-space normal map: for every pixel it measures how steeply the height rises left–right and up–down and writes that tilt as RGB, with flat areas at exactly (128, 128, 255). This page opens the Texture Lab: drop a height map, a grey texture or a sprite, pick brightness or alpha as the height, a Sobel, Scharr or Sobel 5×5 kernel, a strength and OpenGL (Godot, Unity) or DirectX green, and download the PNG. It runs in the browser; nothing is uploaded.',
   concept:{title:'From height to normal: gradient, kernel and strength',body:[
    'The Lab reads one height value per pixel: either the brightness of the image (Rec. 709 luma, 0.2126 R + 0.7152 G + 0.0722 B) or its alpha channel, from 0 to 255, used as 0 to 1. White is high, black is low.',
    'A derivative kernel estimates the slope in x and in y from the neighbouring pixels. Sobel 3×3 is the default; Scharr 3×3 weighs the centre row more, which keeps diagonal slopes more consistent; Sobel 5×5 averages over a wider area, which calms noise and loses fine detail. Every kernel is normalised so that a ramp of one full height unit per pixel reads as slope 1, so the same strength gives the same tilt whichever kernel you pick.',
    'The normal is (−strength·∂h/∂x, strength·∂h/∂y, 1) normalised to length 1 and encoded as (n + 1) × 127.5; DirectX output negates green, which is the only difference between the two files. With Wrap on, the kernel samples across the opposite edge, which a repeating texture needs; with Wrap off the border pixels are clamped and a tiled copy shows a seam.'],
    terms:[['Height map','A grey image where white is high and black is low.'],['Kernel','The small grid of weights that estimates the slope from neighbouring pixels.'],['Strength','The slope multiplier: 0–10 on the slider, 2 by default.'],['Wrap','Sampling across the opposite edge, so a tileable map has no seam.']]},
   example:{title:'Example: a brightness ramp of 32 levels per pixel',lead:'A grey image that gets 32 levels brighter per pixel towards the right, Sobel 3×3, OpenGL:',lines:[
    'slope = 32 / 255 = 0.1255 per pixel',
    'strength 1:  n ∝ (−0.1255, 0, 1) → (−0.124, 0, 0.992) → RGB (112, 128, 254)   tilt  7.2°',
    'strength 2:  n ∝ (−0.2510, 0, 1) → (−0.243, 0, 0.970) → RGB ( 96, 128, 251)   tilt 14.1°',
    'flat area:   n = (0, 0, 1)                            → RGB (128, 128, 255)'],
    after:'Red drops below 128 because a surface rising to the right faces left. Doubling the strength does not double the tilt, because the vector is normalised again: tilt = atan(strength × slope).'},
   verify:{steps:[
    'Flat parts of the height image must come out exactly (128, 128, 255); the Lab tests this for all three kernels and both conventions.',
    'Read the validation under the result: mean vector length close to 1.000 and blue never below 128, since a normal cannot point into the surface.',
    'For a tileable texture, check the joins with Wrap on, for example with [[game/tiling-normal-map-seams|the tiling seam check]].',
    'Light it before you ship: in your engine, or in the Lab\'s material preview, which is labelled an approximation (one light, GGX).']},
   trouble:{rows:[
    ['Bumps look like dents','In this picture dark is raised, but the Lab reads dark as low','A known bump: its lit side faces away from the light','Tick both Invert X and Invert Y (the same as inverting the height); if only up–down is wrong, switch the convention instead'],
    ['A line appears where the texture repeats','Wrap was off, so the border pixels were clamped','Tile the result 2 × 2 and look at the joins','Turn Wrap on and export again'],
    ['Grainy, noisy relief','JPEG artefacts or painted texture read as height','Zoom into areas that should be smooth','Use a PNG source, Sobel 5×5 or a lower strength'],
    ['A sprite\'s outline stays flat while its inside is bumpy','Brightness has no bevel: the silhouette is height only when alpha is the source','Switch the source to Alpha and compare','Use alpha as height, or the bevel in [[game/sprite-normal-map|the sprite normal map generator]]']]},
   alternatives:{rows:[
    ['Studio Texture workspace ([[game/sprite-normal-map|sprite normal maps]])','Sprites: a bevel from the silhouette, lights computed like Godot, per-frame sheets and verified Godot 4 and Unity 6 exports.'],
    ['Bake from a high-poly model in a 3D program','The surface exists in 3D: a bake gives true normals instead of a guess from brightness.'],
    ['[[game/normal-map-converter|OpenGL ↔ DirectX converter]]','You already have a normal map and only need the other green convention.']]},
   limits:['Brightness is not shape: painted shadows become dents and painted highlights become bumps.','No bevel, no 2D light preview and no engine bundle here; these maps were checked numerically, not rendered in an engine.','Output is an 8-bit PNG; a 16-bit height input keeps only its high byte.'],
   versions:{body:['Texture Lab, measured on downloaded files: generated and converted maps decode to unit vectors (mean length 1.0001, worst deviation 0.0002); a flat height gives (128, 128, 255, 255) with all three kernels and both conventions; a wrapped edge equals the same pixel inside a real 2 × repeat; OpenGL and DirectX outputs differ in green only (255 − g). The Y+ convention of Unity and Godot is taken from their documentation.'],sources:[U_NORMAL,G_IMPORT]}
  },
  ko:{
   answer:'노멀맵 생성기는 높이 이미지나 회색 이미지를 탄젠트 공간 노멀맵으로 바꿉니다. 픽셀마다 높이가 좌우·상하로 얼마나 가파르게 오르는지 재서 그 기울기를 RGB로 쓰며, 평평한 곳은 정확히 (128, 128, 255)가 됩니다. 이 페이지는 텍스처 랩을 엽니다. 높이 맵·회색 텍스처·스프라이트를 넣고, 높이로 쓸 밝기나 알파, Sobel·Scharr·Sobel 5×5 커널, 강도, OpenGL(Godot·Unity)이나 DirectX 초록을 고른 뒤 PNG를 받으면 됩니다. 브라우저에서 처리하며 업로드하지 않습니다.',
   concept:{title:'높이에서 노멀로: 기울기, 커널, 강도',body:[
    '랩은 픽셀마다 높이 값 하나를 읽습니다. 이미지의 밝기(Rec. 709 휘도, 0.2126 R + 0.7152 G + 0.0722 B)나 알파 채널을 0~255로 읽어 0~1로 씁니다. 흰색이 높고 검은색이 낮습니다.',
    '미분 커널이 이웃 픽셀로 x·y 방향 기울기를 추정합니다. 기본은 Sobel 3×3이고, Scharr 3×3은 가운데 줄에 무게를 더 둬서 대각선 기울기가 더 고르게 나오며, Sobel 5×5는 더 넓게 평균을 내 잡음은 줄지만 잔디테일도 사라집니다. 모든 커널은 1픽셀에 높이 한 단위가 오르는 경사를 기울기 1로 읽도록 정규화되어 있어, 어떤 커널을 골라도 같은 강도면 같은 기울기가 나옵니다.',
    '노멀은 (−강도·∂h/∂x, 강도·∂h/∂y, 1)을 길이 1로 정규화해 (n + 1) × 127.5로 기록합니다. DirectX 출력은 초록만 부호가 반대이며, 두 파일의 차이는 그것뿐입니다. Wrap을 켜면 커널이 반대쪽 가장자리를 이어서 읽는데, 반복 텍스처에는 이것이 필요합니다. 끄면 가장자리 픽셀을 늘려 쓰기 때문에 이어 붙였을 때 이음새가 보입니다.'],
    terms:[['높이 맵','흰색이 높고 검은색이 낮은 회색 이미지.'],['커널','이웃 픽셀로 기울기를 추정하는 작은 가중치 격자.'],['강도','기울기에 곱하는 값. 슬라이더 0~10, 기본 2.'],['Wrap','반대쪽 가장자리를 이어서 읽어 반복 맵에 이음새가 없게 하는 방식.']]},
   example:{title:'예시: 픽셀마다 32단계씩 밝아지는 경사',lead:'오른쪽으로 갈수록 픽셀당 32단계 밝아지는 회색 이미지, Sobel 3×3, OpenGL:',lines:[
    '기울기 = 32 / 255 = 픽셀당 0.1255',
    '강도 1:  n ∝ (−0.1255, 0, 1) → (−0.124, 0, 0.992) → RGB (112, 128, 254)   기울기  7.2°',
    '강도 2:  n ∝ (−0.2510, 0, 1) → (−0.243, 0, 0.970) → RGB ( 96, 128, 251)   기울기 14.1°',
    '평평한 곳: n = (0, 0, 1)                           → RGB (128, 128, 255)'],
    after:'오른쪽으로 오르는 면은 왼쪽을 향하므로 빨강이 128보다 작아집니다. 벡터를 다시 정규화하기 때문에 강도를 두 배로 해도 기울기가 두 배가 되지는 않습니다. 기울기 = atan(강도 × 경사)입니다.'},
   verify:{steps:[
    '높이 이미지의 평평한 부분은 정확히 (128, 128, 255)가 나와야 합니다. 랩은 세 커널과 두 규약 모두에서 이를 시험합니다.',
    '결과 아래의 검증 값을 보세요. 벡터 평균 길이가 1.000에 가깝고, 노멀은 표면 안쪽을 향할 수 없으니 파랑이 128 아래로 내려가지 않아야 합니다.',
    '반복 텍스처라면 Wrap을 켠 상태에서 이음새를 확인하세요. 예를 들어 [[game/tiling-normal-map-seams|반복 노멀맵 이음새 점검]]으로.',
    '쓰기 전에 조명으로 비춰 보세요. 엔진에서, 또는 근사치(조명 1개, GGX)라고 표시된 랩의 재질 미리보기에서.']},
   trouble:{rows:[
    ['볼록한 곳이 오목하게 보임','이 그림은 어두운 곳이 솟은 부분인데 랩은 어두운 곳을 낮게 읽음','확실한 볼록부의 밝은 면이 조명 반대쪽을 향함','Invert X와 Invert Y를 둘 다 켜기(높이 반전과 같음). 위아래만 틀리면 규약만 바꾸기'],
    ['반복되는 자리에 선이 생김','Wrap이 꺼져 있어 가장자리 픽셀을 늘려 씀','결과를 2 × 2로 이어 붙여 경계 확인','Wrap을 켜고 다시 내보내기'],
    ['입체가 자글자글하고 잡음이 많음','JPEG 압축 흔적이나 칠의 질감을 높이로 읽음','매끈해야 할 곳을 확대','PNG 원본, Sobel 5×5, 또는 낮은 강도 사용'],
    ['스프라이트 외곽은 납작하고 안쪽만 울퉁불퉁함','밝기에는 베벨이 없어, 알파를 소스로 할 때만 실루엣이 높이가 됨','소스를 알파로 바꿔 비교','알파를 높이로 쓰거나 [[game/sprite-normal-map|스프라이트 노멀맵 생성기]]의 베벨 사용']]},
   alternatives:{rows:[
    ['Studio 텍스처 작업 공간([[game/sprite-normal-map|스프라이트 노멀맵]])','스프라이트라면 실루엣 베벨, Godot와 같은 계산의 조명, 프레임별 시트, 검증된 Godot 4·Unity 6 내보내기.'],
    ['3D 프로그램에서 하이폴리 모델로 굽기','표면이 실제로 3D로 있다면 밝기에서 추측하는 대신 진짜 노멀을 얻습니다.'],
    ['[[game/normal-map-converter|OpenGL ↔ DirectX 변환기]]','이미 노멀맵이 있고 다른 초록 규약만 필요할 때.']]},
   limits:['밝기는 형태가 아닙니다. 칠한 그림자는 오목하게, 칠한 하이라이트는 볼록하게 나옵니다.','여기에는 베벨, 2D 조명 미리보기, 엔진 번들이 없으며, 이 맵들은 수치로만 확인했고 엔진에서 렌더하지 않았습니다.','출력은 8비트 PNG이며, 16비트 높이 입력은 상위 바이트만 씁니다.'],
   versions:{body:['텍스처 랩, 내려받은 파일로 측정: 생성·변환한 맵은 단위 벡터로 디코딩되고(평균 길이 1.0001, 최대 오차 0.0002), 평평한 높이는 세 커널과 두 규약 모두에서 (128, 128, 255, 255)이며, Wrap 가장자리는 실제로 2배 반복한 이미지 속 같은 픽셀과 같고, OpenGL과 DirectX 출력은 초록(255 − g)만 다릅니다. Unity와 Godot의 Y+ 규약은 각 문서를 따릅니다.'],sources:[U_NORMAL,G_IMPORT]}
  },
  ja:{
   answer:'ノーマルマップ生成ツールは、高さ画像やグレー画像を接空間ノーマルマップに変換します。ピクセルごとに高さが左右・上下へどれだけ急に上がるかを測り、その傾きをRGBで書き込み、平らな所はちょうど (128, 128, 255) になります。このページはテクスチャラボを開きます。高さマップ・グレーのテクスチャ・スプライトをドロップし、高さにする明るさかアルファ、Sobel・Scharr・Sobel 5×5のカーネル、強さ、OpenGL（Godot・Unity）かDirectXの緑を選んでPNGをダウンロード。処理はブラウザ内で、アップロードはしません。',
   concept:{title:'高さからノーマルへ：勾配・カーネル・強さ',body:[
    'ラボはピクセルごとに高さの値を1つ読みます。画像の明るさ（Rec. 709の輝度、0.2126 R + 0.7152 G + 0.0722 B）かアルファチャンネルを0〜255で読み、0〜1として使います。白が高く、黒が低い扱いです。',
    '微分カーネルが隣のピクセルからx方向とy方向の傾きを推定します。既定はSobel 3×3。Scharr 3×3は中央の行を重く見るので斜めの傾きがそろいやすく、Sobel 5×5は広く平均するためノイズは減りますが細部も消えます。どのカーネルも1ピクセルで高さが1単位上がる坂を傾き1と読むよう正規化されているので、カーネルを変えても同じ強さなら同じ傾きになります。',
    'ノーマルは (−強さ·∂h/∂x, 強さ·∂h/∂y, 1) を長さ1に正規化し、(n + 1) × 127.5 で書き込みます。DirectXの出力は緑の符号が逆になるだけで、2つのファイルの違いはそれだけです。Wrapをオンにするとカーネルが反対側の縁をつないで読み、繰り返しテクスチャにはこれが必要です。オフだと縁のピクセルを引き延ばすので、並べたときに継ぎ目が出ます。'],
    terms:[['高さマップ','白が高く黒が低いグレー画像。'],['カーネル','隣のピクセルから傾きを推定する小さな重みの格子。'],['強さ','傾きに掛ける値。スライダーは0〜10、既定は2。'],['Wrap','反対側の縁をつないで読み、繰り返しマップに継ぎ目を作らない方式。']]},
   example:{title:'具体例：1ピクセルごとに32段階明るくなる坂',lead:'右へ行くほど1ピクセルにつき32段階明るくなるグレー画像、Sobel 3×3、OpenGL：',lines:[
    '傾き = 32 / 255 = 1ピクセルあたり0.1255',
    '強さ1:  n ∝ (−0.1255, 0, 1) → (−0.124, 0, 0.992) → RGB (112, 128, 254)   傾き  7.2°',
    '強さ2:  n ∝ (−0.2510, 0, 1) → (−0.243, 0, 0.970) → RGB ( 96, 128, 251)   傾き 14.1°',
    '平らな所: n = (0, 0, 1)                           → RGB (128, 128, 255)'],
    after:'右へ上がる面は左を向くので、赤が128より小さくなります。ベクトルを正規化し直すため、強さを2倍にしても傾きは2倍になりません。傾き = atan(強さ × 勾配) です。'},
   verify:{steps:[
    '高さ画像の平らな部分は正確に (128, 128, 255) になるはずです。ラボは3つのカーネルと2つの規約すべてでこれを試験しています。',
    '結果の下にある検証値を見ます。ベクトルの平均長が1.000に近く、ノーマルは面の内側を向けないので青が128を下回らないこと。',
    '繰り返しテクスチャなら、Wrapをオンにした状態で継ぎ目を確認します。たとえば[[game/tiling-normal-map-seams|タイル状ノーマルマップの継ぎ目チェック]]で。',
    '使う前にライトで照らしてみます。エンジンで、または近似（ライト1灯、GGX）と明記されたラボの材質プレビューで。']},
   trouble:{rows:[
    ['凸が凹に見える','この絵は暗い所が盛り上がっているのに、ラボは暗い所を低いと読む','確実な凸部の明るい面がライトと反対を向いている','Invert XとInvert Yを両方オン（高さの反転と同じ）。上下だけおかしいなら規約だけを切り替える'],
    ['繰り返す所に線が出る','Wrapがオフで、縁のピクセルが引き延ばされた','結果を2 × 2に並べて境目を見る','Wrapをオンにして書き出し直す'],
    ['凹凸がざらざらしてノイズが多い','JPEGの圧縮ノイズや塗りの質感を高さとして読んだ','なめらかなはずの所を拡大','PNGの元画像、Sobel 5×5、または低い強さを使う'],
    ['スプライトの輪郭は平らで内側だけでこぼこ','明るさには面取りがなく、アルファをソースにしたときだけシルエットが高さになる','ソースをアルファに切り替えて比べる','アルファを高さに使うか、[[game/sprite-normal-map|スプライト用ノーマルマップ生成]]の面取りを使う']]},
   alternatives:{rows:[
    ['Studioのテクスチャ作業画面（[[game/sprite-normal-map|スプライトのノーマルマップ]]）','スプライトなら、シルエットからの面取り、Godotと同じ計算のライト、フレームごとのシート、検証済みのGodot 4・Unity 6書き出し。'],
    ['3Dソフトでハイポリモデルからベイク','面が実際に3Dで存在するなら、明るさからの推定ではなく本物のノーマルが得られます。'],
    ['[[game/normal-map-converter|OpenGL ↔ DirectX変換]]','ノーマルマップはもうあり、別の緑の規約だけが必要なとき。']]},
   limits:['明るさは形ではありません。塗った影はくぼみに、塗ったハイライトはふくらみになります。','ここには面取り、2Dライトのプレビュー、エンジン用バンドルはありません。これらのマップは数値で確認しただけで、エンジンでは描画していません。','出力は8ビットPNGで、16ビットの高さ入力は上位バイトだけを使います。'],
   versions:{body:['テクスチャラボ、ダウンロードしたファイルで測定：生成・変換したマップは単位ベクトルにデコードされ（平均長1.0001、最大誤差0.0002）、平らな高さは3つのカーネルと2つの規約すべてで (128, 128, 255, 255)、Wrapの縁は実際に2倍に並べた画像内の同じピクセルと一致し、OpenGLとDirectXの出力は緑（255 − g）だけが違います。UnityとGodotのY+の規約は各ドキュメントに従います。'],sources:[U_NORMAL,G_IMPORT]}
  }
 },
 'game/pixel-art-normal-map':{
  type:'create',
  intent:{primary:'make a normal map for pixel art that keeps the pixel look under 2D lights',secondary:['why quantise pixel-art normals','how many directions and tilts','pixel-sized bevel','filtering in the engine'],
   goal:'a pixel-art normal map whose lit result breaks into clean bands instead of noise',input:'pixel-art sprite PNG (frames up to 128 px count as pixel art in the Studio)',output:'normal map PNG (OpenGL or DirectX); Studio: quantised map plus Godot/Unity bundle',target:'Godot 4, Unity 6 URP 2D or any engine with 2D normal-mapped lights',support:'partial',
   evidence:['src/game/normals/normal.js quantizeNormals (4/8/16/32 directions, 1–4 tiers, max tilt 60°, default 8 × 2)','src/game/normals/pipeline.js suggestParams (pixelArt: 1.5 px bevel, central kernel)','src/studio/workspaces/texture/index.js isPixelArt (frame ≤ 128 px)','tests/normals.test.mjs (quantisation)','docs/H2H-PAID.md (torch lit in Godot 4.7.2)'],
   external:['Godot PointLight2D height','Unity Renderer 2D Light Render Texture Scale']},
  en:{
   answer:'Pixel-art normal maps look best with only a few normal directions, the way artists paint them: flat, then one or two tilts towards each side. This page opens the Texture Lab, which turns a sprite\'s brightness or alpha into a normal map at pixel scale. The Studio\'s Texture workspace adds a 1.5 px bevel from the silhouette and "Pixel-art normals", which snap every pixel to 8 directions × 2 tilts plus flat by default, 17 possible normals, and exports them for Godot 4 or Unity 6.',
   concept:{title:'Why pixel-art normals are quantised',body:[
    'A normal map made from a gradient has a slightly different vector in almost every pixel. Under a moving light that becomes soft ramps and one-level steps of brightness inside a 16 × 16 sprite, which reads as noise next to a limited palette. Hand-painted pixel normals use a handful of values instead: flat, and a small set of tilts facing each direction, so the lit sprite breaks into clean bands that jump from pixel to pixel as the light moves.',
    'Nerulio\'s quantiser in the Studio reproduces that. Each pixel keeps its own direction and tilt but snaps: the direction to 4, 8, 16 or 32 evenly spaced angles, the tilt to 1–4 steps up to 60°. With the default 8 directions × 2 steps, tilts under 15° become flat, 15–45° become 30° and anything steeper becomes 60°. Every pixel is snapped on its own, so a one-pixel ledge stays one pixel wide.',
    'The height underneath should be pixel-sized too. For frames up to 128 px the Studio suggests a 1.5 px bevel rim and the Pixel kernel, a plain central difference without smoothing, so the rim does not spread into a blur. With 17 normals and a distant light, each colour of the sprite can take at most 17 brightness levels.',
    'The engine decides the rest: a normal map filtered bilinearly mixes neighbouring normals again, a Godot PointLight2D left at Height 0 grazes the sprite from the side, and Unity computes 2D lighting at half the screen resolution unless Light Render Texture Scale is set to 1.'],
    terms:[['Direction step','360° ÷ directions: 45° for 8, so a tilted pixel faces right, up-right, up and so on.'],['Tilt step','How far a pixel leans from facing the viewer; 2 steps up to 60° give 30° and 60°.'],['Pixel kernel','A central difference with no cross smoothing, so a 1 px ledge stays 1 px wide.']]},
   example:{title:'Example: the 17 normals of the default setting (OpenGL bytes)',lead:'8 directions × 2 tilts + flat, as the quantiser writes them:',lines:[
    'flat (tilt under 15°)                    128,128,255',
    '30° ring  right 191,128,238  up 128,191,238  up-right  173,173,238',
    '          left   64,128,238  down 128,64,238  down-left  82, 82,238',
    '60° ring  right 238,128,191  up 128,238,191  up-right  206,206,191',
    '          left   17,128,191  down 128,17,191  down-left  49, 49,191',
    '',
    'input tilt 14° → flat    40° → 30°    46° → 60°    80° → 60°'],
    after:'Up-left and down-right follow the same pattern (82,173,238 and 173,82,238 at 30°). Every pixel of such a map is one of these 17 byte triples, so you can also touch it up by hand with an eyedropper.'},
   verify:{steps:[
    'Count the colours of the exported normal map in any editor: with Pixel-art normals at 8 × 2 there are at most 17.',
    'Move the light slowly across the sprite in the Lit view: bands should jump from pixel to pixel, not fade.',
    'In the engine use Nearest (Godot) or Point (Unity) filtering; linear filtering blends neighbouring normals and brings the soft ramps back.']},
   trouble:{rows:[
    ['The lit sprite looks noisy or dithered','Unquantised gradient normals: this page\'s Lab output, or Pixel-art normals switched off','The normal map has hundreds of colours','Turn on Pixel-art normals in the Studio\'s Normal map panel'],
    ['Light bands are soft in the engine','Linear texture filtering, or Unity\'s 2D lights at half resolution','Zoom to 400 %: soft edges between bands','Nearest in Godot ([[game/godot-pixel-art-blurry|blurry pixel art in Godot]]); Point filter and Light Render Texture Scale 1 in Unity'],
    ['Outlines light up like ridges','A dark outline read as low height, so its edge becomes a slope','Height view: a trench along the outline','Lower the brightness detail or flatten the outline with the Height brush'],
    ['Everything tilts, nothing stays flat','Strength too high for pixel-sized relief, so most tilts pass 45°','Most pixels hold 60° values (238 or 17 in red or green)','Lower the strength, or use 3–4 tilt steps']]},
   alternatives:{rows:[
    ['Paint the normals by hand in a pixel editor','Stylised art: lit in Godot 4.7.2, every generator\'s map of a hand-painted CC0 torch was further from the artist\'s own map than a flat map was (flat 26.6 levels, Nerulio 36.2).'],
    ['Studio Texture workspace with Pixel-art normals','You want the bevel, the quantisation, a lit preview computed like Godot and verified Godot/Unity exports: start from [[game/sprite-normal-map|the sprite normal map page]].'],
    ['[[game/laigter-alternative|Laigter]]','A desktop app with presets and its own lit preview; quantised pixel-art normals were not seen in it.']]},
   limits:['The Texture Lab on this page computes gradients only: no bevel, no quantisation, no engine test. Quantised normals are in the Studio.','No generator derives an artist\'s stylised shading from the colours; quantisation makes a generated map look painted, not correct.','The maximum tilt is fixed at 60°.'],
   versions:{body:['`tests/normals.test.mjs` checks that only the allowed directions and tilts appear and that flat stays flat. The Studio\'s Godot export was rendered by Godot 4.7.2 on two pixel-art cases (a 6-frame 32 px torch and a 60-frame 48 px samurai), all checked frames within 1/255; that run covers the export path, not the quantiser specifically. The Lab maps on this page were checked numerically only. Engine settings follow the Godot and Unity documentation below.'],sources:[G_POINT,G_LIGHTS,U_RENDERER]}
  },
  ko:{
   answer:'도트 그림 노멀맵은 작가가 손으로 찍듯 노멀 방향을 몇 가지로만 쓸 때 가장 보기 좋습니다. 평평한 면, 그리고 각 방향으로 한두 단계 기운 면입니다. 이 페이지는 스프라이트의 밝기나 알파를 픽셀 단위 노멀맵으로 바꾸는 텍스처 랩을 엽니다. Studio 텍스처 작업 공간은 여기에 실루엣에서 1.5px 베벨과 "픽셀아트 노멀"을 더합니다. 기본값으로 모든 픽셀을 8방향 × 2단계 기울기 + 평면, 즉 노멀 17가지로 맞추고 Godot 4·Unity 6용으로 내보냅니다.',
   concept:{title:'도트 노멀을 양자화하는 이유',body:[
    '기울기로 만든 노멀맵은 거의 모든 픽셀의 벡터가 조금씩 다릅니다. 조명이 움직이면 16 × 16 스프라이트 안에서 부드러운 그러데이션과 한 단계짜리 밝기 계단이 생기고, 제한된 팔레트 옆에서는 잡음처럼 보입니다. 손으로 찍은 도트 노멀은 평면과 방향마다 몇 안 되는 기울기만 쓰기 때문에, 조명을 받으면 깔끔한 띠로 나뉘고 빛이 움직일 때 픽셀 단위로 넘어갑니다.',
    'Studio의 양자화기가 이것을 재현합니다. 픽셀마다 자기 방향과 기울기를 유지하되 방향은 4·8·16·32개의 고른 각도로, 기울기는 60°까지 1~4단계로 맞춥니다. 기본값인 8방향 × 2단계에서는 15° 미만이 평면, 15~45°가 30°, 그보다 가파르면 60°가 됩니다. 픽셀마다 따로 맞추므로 1픽셀 턱은 1픽셀 그대로 남습니다.',
    '그 밑의 높이도 픽셀 크기여야 합니다. 128px 이하 프레임에는 Studio가 1.5px 베벨 테두리와 부드럽게 만들지 않는 단순 중앙 차분인 Pixel 커널을 제안하므로 테두리가 뭉개지지 않습니다. 노멀이 17가지이고 조명이 멀리 있으면 스프라이트의 한 색이 가질 수 있는 밝기는 최대 17단계입니다.',
    '나머지는 엔진이 정합니다. 이중선형 필터를 거친 노멀맵은 이웃 노멀을 다시 섞고, Height가 0인 Godot PointLight2D는 스프라이트를 옆에서 스치듯 비추며, Unity는 Light Render Texture Scale을 1로 바꾸지 않으면 2D 조명을 화면 해상도의 절반으로 계산합니다.'],
    terms:[['방향 단계','360° ÷ 방향 수. 8방향이면 45°라서 기운 픽셀은 오른쪽, 오른쪽 위, 위 등을 향합니다.'],['기울기 단계','픽셀이 정면에서 얼마나 기우는지. 60°까지 2단계면 30°와 60°.'],['Pixel 커널','가로세로로 부드럽게 하지 않는 중앙 차분. 1px 턱이 1px로 남습니다.']]},
   example:{title:'예시: 기본 설정의 노멀 17가지(OpenGL 바이트)',lead:'양자화기가 쓰는 8방향 × 2단계 + 평면:',lines:[
    '평면(기울기 15° 미만)                   128,128,255',
    '30° 고리  오른쪽 191,128,238  위 128,191,238  오른쪽 위 173,173,238',
    '          왼쪽    64,128,238  아래 128,64,238  왼쪽 아래  82, 82,238',
    '60° 고리  오른쪽 238,128,191  위 128,238,191  오른쪽 위 206,206,191',
    '          왼쪽    17,128,191  아래 128,17,191  왼쪽 아래  49, 49,191',
    '',
    '입력 기울기 14° → 평면   40° → 30°   46° → 60°   80° → 60°'],
    after:'왼쪽 위와 오른쪽 아래도 같은 규칙입니다(30°에서 82,173,238과 173,82,238). 이런 맵의 모든 픽셀은 이 17가지 바이트 조합 중 하나라서, 스포이트로 골라 손으로 고치기도 쉽습니다.'},
   verify:{steps:[
    '내보낸 노멀맵의 색 수를 아무 편집기에서 세어 보세요. 픽셀아트 노멀 8 × 2라면 최대 17색입니다.',
    'Lit 보기에서 조명을 스프라이트 위로 천천히 옮기세요. 띠가 서서히 번지지 않고 픽셀 단위로 넘어가야 합니다.',
    '엔진에서는 Nearest(Godot)나 Point(Unity) 필터를 쓰세요. 선형 필터는 이웃 노멀을 섞어 부드러운 그러데이션을 되살립니다.']},
   trouble:{rows:[
    ['조명을 받은 스프라이트가 자글자글하거나 디더링처럼 보임','양자화하지 않은 기울기 노멀. 이 페이지의 랩 결과이거나 픽셀아트 노멀이 꺼져 있음','노멀맵의 색이 수백 가지','Studio 노멀맵 패널에서 픽셀아트 노멀 켜기'],
    ['엔진에서 조명 띠가 흐릿함','선형 텍스처 필터, 또는 절반 해상도로 계산되는 Unity 2D 조명','400%로 확대하면 띠 경계가 부드러움','Godot는 Nearest([[game/godot-pixel-art-blurry|Godot 도트 흐림 해결]]), Unity는 Point 필터와 Light Render Texture Scale 1'],
    ['외곽선이 능선처럼 빛남','어두운 외곽선을 낮은 높이로 읽어 그 가장자리가 경사가 됨','높이 보기에서 외곽선을 따라 도랑이 보임','밝기 디테일을 낮추거나 높이 브러시로 외곽선을 평평하게'],
    ['모든 픽셀이 기울고 평평한 곳이 없음','픽셀 크기 입체에 비해 강도가 커서 대부분 45°를 넘음','대부분 픽셀이 60° 값(빨강이나 초록이 238 또는 17)','강도를 낮추거나 기울기 단계를 3~4로']]},
   alternatives:{rows:[
    ['도트 편집기에서 노멀을 직접 찍기','양식화된 그림. Godot 4.7.2에서 비춰 보니, 손으로 칠한 CC0 횃불은 모든 생성기의 맵이 평평한 맵보다 작가의 맵에서 더 멀었습니다(평평 26.6단계, Nerulio 36.2).'],
    ['픽셀아트 노멀을 켠 Studio 텍스처 작업 공간','베벨, 양자화, Godot와 같은 계산의 조명 미리보기, 검증된 Godot·Unity 내보내기가 필요할 때. [[game/sprite-normal-map|스프라이트 노멀맵 페이지]]에서 시작하세요.'],
    ['[[game/laigter-alternative|Laigter]]','프리셋과 자체 조명 미리보기가 있는 데스크톱 앱. 양자화한 도트 노멀 기능은 보이지 않았습니다.']]},
   limits:['이 페이지의 텍스처 랩은 기울기만 계산합니다. 베벨·양자화·엔진 시험이 없고, 양자화 노멀은 Studio에 있습니다.','어떤 생성기도 색에서 작가의 양식화된 음영을 계산해 내지 못합니다. 양자화는 생성한 맵을 손으로 찍은 듯 보이게 할 뿐, 정답으로 만들지는 않습니다.','최대 기울기는 60°로 고정입니다.'],
   versions:{body:['`tests/normals.test.mjs`는 허용된 방향과 기울기만 나오고 평면은 평면으로 남는지 확인합니다. Studio의 Godot 내보내기는 도트 사례 2건(6프레임 32px 횃불, 60프레임 48px 사무라이)을 Godot 4.7.2가 렌더해 확인한 모든 프레임이 1/255 이내였습니다. 이것은 내보내기 경로의 검증이며 양자화기 자체의 검증은 아닙니다. 이 페이지의 랩 맵은 수치로만 확인했습니다. 엔진 설정은 아래 Godot·Unity 문서를 따릅니다.'],sources:[G_POINT,G_LIGHTS,U_RENDERER]}
  },
  ja:{
   answer:'ドット絵のノーマルマップは、作者が手で打つように法線の向きを少数に絞ると最もきれいに見えます。平らな面と、各方向に1〜2段階傾いた面だけです。このページは、スプライトの明るさやアルファをピクセル単位のノーマルマップにするテクスチャラボを開きます。Studioのテクスチャ作業画面はさらに、シルエットからの1.5pxの面取りと「ピクセルアート法線」を加えます。既定では全ピクセルを8方向×2段階の傾き＋平ら、つまり17種類の法線にそろえ、Godot 4・Unity 6向けに書き出します。',
   concept:{title:'ドット絵の法線を量子化する理由',body:[
    '勾配から作ったノーマルマップは、ほぼすべてのピクセルでベクトルが少しずつ違います。ライトが動くと16 × 16のスプライトの中にやわらかいグラデーションと1段階だけの明るさの段差ができ、限られたパレットの横ではノイズに見えます。手打ちのドット絵の法線は平らな面と方向ごとの少数の傾きしか使わないので、照らすときれいな帯に分かれ、光が動くとピクセル単位で切り替わります。',
    'Studioの量子化はこれを再現します。各ピクセルは自分の向きと傾きを保ったまま、向きを4・8・16・32の等間隔の角度に、傾きを60°までの1〜4段階にそろえます。既定の8方向×2段階では、15°未満は平ら、15〜45°は30°、それより急なら60°になります。ピクセルごとに個別にそろえるので、1ピクセルの段差は1ピクセルのまま残ります。',
    'その下の高さもピクセルサイズであるべきです。128px以下のフレームには、Studioが1.5pxの面取りの縁と、なめらかにしない単純な中心差分のPixelカーネルを提案するので、縁がぼけません。法線が17種類でライトが遠くにあれば、スプライトの1色が取れる明るさは最大17段階です。',
    '残りはエンジンが決めます。バイリニアでフィルタリングされたノーマルマップは隣の法線をまた混ぜ、Heightが0のままのGodotのPointLight2Dはスプライトを横からかすめるように照らし、UnityはLight Render Texture Scaleを1にしない限り2Dライティングを画面解像度の半分で計算します。'],
    terms:[['方向の段階','360° ÷ 方向数。8方向なら45°で、傾いたピクセルは右・右上・上などを向きます。'],['傾きの段階','ピクセルが正面からどれだけ傾くか。60°まで2段階なら30°と60°。'],['Pixelカーネル','縦横になめらかにしない中心差分。1pxの段差が1pxのまま残ります。']]},
   example:{title:'具体例：既定設定の17種類の法線（OpenGLのバイト値）',lead:'量子化が書き出す8方向×2段階＋平ら：',lines:[
    '平ら（傾き15°未満）                    128,128,255',
    '30°の輪  右 191,128,238   上 128,191,238   右上 173,173,238',
    '         左  64,128,238   下 128,64,238    左下  82, 82,238',
    '60°の輪  右 238,128,191   上 128,238,191   右上 206,206,191',
    '         左  17,128,191   下 128,17,191    左下  49, 49,191',
    '',
    '入力の傾き 14° → 平ら   40° → 30°   46° → 60°   80° → 60°'],
    after:'左上と右下も同じ規則です（30°で82,173,238と173,82,238）。こうしたマップの全ピクセルはこの17通りのバイト値のどれかなので、スポイトで拾って手で直すのも簡単です。'},
   verify:{steps:[
    '書き出したノーマルマップの色数を任意のエディターで数えます。ピクセルアート法線8×2なら最大17色です。',
    'Lit表示でライトをスプライトの上でゆっくり動かします。帯がじわっと変わらず、ピクセル単位で切り替わるはずです。',
    'エンジンではNearest（Godot）かPoint（Unity）のフィルターを使います。線形フィルターは隣の法線を混ぜ、やわらかいグラデーションを戻してしまいます。']},
   trouble:{rows:[
    ['照らしたスプライトがざらついて、ディザのように見える','量子化していない勾配の法線。このページのラボの出力か、ピクセルアート法線がオフ','ノーマルマップの色が数百ある','Studioのノーマルマップパネルでピクセルアート法線をオンにする'],
    ['エンジンで光の帯がぼやける','線形のテクスチャフィルター、または半分の解像度で計算されるUnityの2Dライト','400%に拡大すると帯の境目がやわらかい','GodotはNearest（[[game/godot-pixel-art-blurry|Godotでドット絵がぼやける]]）、UnityはPointフィルターとLight Render Texture Scale 1'],
    ['輪郭線が尾根のように光る','暗い輪郭線を低い高さと読み、その縁が斜面になった','高さ表示で輪郭に沿った溝が見える','明るさの細部を下げるか、高さブラシで輪郭を平らにする'],
    ['全部が傾いて平らな所がない','ピクセルサイズの凹凸に対して強さが大きく、ほとんどが45°を超えた','大半のピクセルが60°の値（赤か緑が238か17）','強さを下げるか、傾きの段階を3〜4にする']]},
   alternatives:{rows:[
    ['ドットエディターで法線を手打ちする','様式化した絵。Godot 4.7.2で照らすと、手描きのCC0のたいまつでは、どの生成ツールのマップも平らなマップより作者のマップから遠い結果でした（平ら26.6段階、Nerulio 36.2）。'],
    ['ピクセルアート法線をオンにしたStudioのテクスチャ作業画面','面取り、量子化、Godotと同じ計算のライトプレビュー、検証済みのGodot・Unity書き出しがほしいとき。[[game/sprite-normal-map|スプライトのノーマルマップのページ]]から始めてください。'],
    ['[[game/laigter-alternative|Laigter]]','プリセットと独自のライトプレビューがあるデスクトップアプリ。量子化したドット絵向けの法線は見当たりませんでした。']]},
   limits:['このページのテクスチャラボが計算するのは勾配だけです。面取り・量子化・エンジンでの試験はなく、量子化した法線はStudioにあります。','どの生成ツールも、作者の様式化した陰影を色から計算することはできません。量子化は生成したマップを手打ち風に見せるだけで、正解にはしません。','最大の傾きは60°で固定です。'],
   versions:{body:['`tests/normals.test.mjs` は、許された方向と傾きだけが出ること、平らな所が平らなままであることを確認しています。StudioのGodot書き出しは、ドット絵の2ケース（6フレーム32pxのたいまつ、60フレーム48pxの侍）をGodot 4.7.2が描画し、確認した全フレームが1/255以内でした。これは書き出し経路の検証で、量子化そのものの検証ではありません。このページのラボのマップは数値でのみ確認しています。エンジンの設定は下記のGodot・Unityのドキュメントに従います。'],sources:[G_POINT,G_LIGHTS,U_RENDERER]}
  }
 },
//PAGE4
};
