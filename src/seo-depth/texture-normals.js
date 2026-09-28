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
 'game/godot-2d-normal-map':{
  type:'engine',
  intent:{primary:'use a normal map on a 2D sprite in Godot 4 so Light2D nodes shade it',secondary:['CanvasTexture normal map setup','PointLight2D height and DirectionalLight2D height','light mask / item cull mask','normal map has no effect in Godot 2D'],
   goal:'a Sprite2D in Godot 4 whose relief follows PointLight2D / DirectionalLight2D lights',input:'sprite or cut sheet (PNG) plus its normal map, or a sprite to generate one from',output:'_lit.tscn (Sprite2D + CanvasTexture + CanvasModulate + PointLight2D + AnimationPlayer), _canvas_texture.tres, PNGs',target:'Godot 4 (verified 4.7.2, Compatibility renderer)',support:'full',
   evidence:['src/game/normals/export.js godotScene / godotCanvasTexture','src/game/normals/lighting.js (Godot canvas light model)','docs/STUDIO-TEXTURE.md (Godot 4.7.2 6/6, negative control)'],
   external:['Godot 4.7: CanvasTexture, PointLight2D.height (pixels, default 0), DirectionalLight2D.height (0–1), Light2D.range_item_cull_mask, CanvasItem.light_mask (default 1), CanvasModulate, import option Normal Map Invert Y']},
  en:{
   answer:'In Godot 4 a 2D normal map works only inside a `CanvasTexture`: set it as the Normal Map Texture next to the sprite\'s Diffuse Texture, then light the sprite with a `PointLight2D` or `DirectionalLight2D` whose Height is above 0 and whose Item Cull Mask matches the sprite\'s Light Mask. Nerulio\'s Texture workspace generates the map and exports that scene ready-made (Sprite2D, CanvasTexture, CanvasModulate, one PointLight2D per light and an AnimationPlayer for frames), rendered by Godot 4.7.2 within 1/255 of the preview.',
   concept:{title:'How Godot 4 lights a normal-mapped sprite',body:[
    'Godot draws 2D lights per pixel on top of the sprite\'s colour. A plain texture has no normals, so a light only brightens it; a `CanvasTexture` bundles a diffuse texture, a normal map and an optional specular map, and the normal map "only has a visible effect if Light2Ds are affecting this CanvasTexture". Godot expects X+, Y+ and Z+ normals, the OpenGL style.',
    'Per pixel the light adds colour × energy × falloff × N·L, where L points from the pixel to the light raised by its Height. For a `PointLight2D` Height is in pixels: the docs\' example is a height of 100 lighting an object 100 px away at 45°. Its default is 0, which puts the light in the sprite\'s plane. A `DirectionalLight2D` has a Height from 0 (parallel to the plane) to 1 (perpendicular), and its direction is the node\'s rotation.',
    'The light\'s size and falloff come from its texture: a `PointLight2D` draws a (usually grey) texture scaled by Texture Scale. A `CanvasModulate` multiplies the whole canvas by an ambient colour, which is what makes unlit parts dark. Which nodes a light reaches is decided by its Range settings: Item Cull Mask against each CanvasItem\'s Light Mask (default layer 1), plus layer and z ranges.',
    'Nerulio\'s preview is this model computed on the CPU and in WebGL2 (`lighting.js`): N is decoded from red and green like Godot does, with blue rebuilt from them, and each exported light carries the Studio\'s falloff curve as a 256 px texture, so the brightness in Godot matches the preview, not only the direction.'],
    terms:[['CanvasTexture','A 2D texture resource holding diffuse, normal and specular maps plus specular colour and shininess.'],['Height','How far above the canvas a light sits; only visible on normal-mapped surfaces.'],['Item Cull Mask / Light Mask','Layer bits on the light and on the sprite; they must share one for the light to reach it.'],['CanvasModulate','One node per canvas that tints everything by an ambient colour.']]},
   example:{title:'Example: what Height and Texture Scale do to one pixel',lead:'A flat pixel (N = 0, 0, 1) and a PointLight2D 64 px to its left:',lines:[
    'Height 64 px   → elevation atan(64/64)  = 45°   flat N·L = sin 45° = 0.707',
    'Height 0 (default)  → elevation 0°            flat N·L = 0: only slopes facing the light are lit',
    'Height 256 px  → elevation atan(256/64) = 76°   flat N·L = 0.970: the relief almost disappears',
    '',
    'Nerulio falloff PNG = 256 px wide, so texture_scale = 2 × radius / 256',
    'radius 128 px → texture_scale 1.0     radius 256 px → texture_scale 2.0',
    '',
    'DirectionalLight2D: Height 0 = parallel to the plane, 1 = straight down onto it'],
    after:'A low light exaggerates relief and a high one flattens it; most scenes land between 30° and 60° of elevation. Change Height before you change the normal map\'s strength.'},
   outputs:{lead:'For a sprite called torch.png the `godot/` folder holds:',rows:[
    ['torch_lit.tscn','Node2D with the Ambient CanvasModulate, the Sprite2D (region on, Nearest for pixel art), one PointLight2D per light and, for frames, an AnimationPlayer.'],
    ['torch_canvas_texture.tres','The CanvasTexture alone (diffuse, normal, optional specular and shininess) for your own Sprite2D.'],
    ['torch.png, torch_n.png','The sprite or sheet, byte for byte, and its OpenGL normal map.'],
    ['torch_light_smooth.png','The falloff texture of each falloff type used (smooth, linear, quadratic or constant).'],
    ['torch_s.png','A specular map, only when specular is above 0.'],
    ['README.md','These steps and the verification status.']]},
   target:{title:'Set it up in Godot 4',steps:[
    'Copy the `godot` folder anywhere under `res://` (the files refer to each other by relative paths) and open `torch_lit.tscn` to see the lit result; the steps below are for your own nodes.',
    'Select your Sprite2D; in its Texture property create a New CanvasTexture, then set Diffuse Texture to the sprite PNG and Normal Map Texture to `torch_n.png`, or load `torch_canvas_texture.tres`.',
    'Add a PointLight2D: give it a Texture (the bundle\'s falloff PNG, or any soft round gradient), a Height above 0 in pixels and an Energy; move it over the sprite.',
    'Check the masks: the light\'s Range › Item Cull Mask must share a layer with the sprite\'s Light Mask (layer 1 by default).',
    'Add one CanvasModulate with a dark colour so unlit areas get dark; without it the sprite starts at full brightness and lights only add to it.',
    'For pixel art set the Sprite2D\'s Texture › Filter to Nearest (the bundle does); if you use a DirectX-style map from elsewhere, enable Process › Normal Map Invert Y in its Import dock and reimport.']},
   verify:{steps:[
    'Move the light above the sprite: top edges must brighten. If bottom edges do, the map is DirectX-style.',
    'Drag the light\'s Height from 0 upwards: the relief must get softer as the light rises. No change at all means the normal map is not being read.',
    'Compare with the Studio\'s Lit view: in our runs Godot 4.7.2 matched it within 1/255 on every checked frame.']},
   trouble:{rows:[
    ['The normal map changes nothing','The sprite uses a plain texture, not a CanvasTexture with a Normal Map Texture','Inspector: Sprite2D › Texture shows CanvasTexture?','Wrap the texture in a CanvasTexture or load `torch_canvas_texture.tres`'],
    ['Only the rims facing the light glow; the middle stays dark','PointLight2D Height is 0, its default, so the light lies in the sprite\'s plane','Inspector: the light\'s Height','Raise Height; about the light\'s distance to the sprite gives 45°'],
    ['The sprite is not lit at all','The light\'s Item Cull Mask and the sprite\'s Light Mask share no layer, or the sprite lies outside the light\'s texture','Toggle the light; compare both masks; look at Texture Scale','Put both on one layer; raise Texture Scale'],
    ['Lit from below when the light is above','A DirectX-style (Y−) normal map','Top edges dark under a light straight above','Use `torch_n.png` (OpenGL), or enable Process › Normal Map Invert Y and reimport; see [[game/normal-map-opengl-or-directx|OpenGL or DirectX]]'],
    ['Everything looks washed out','No CanvasModulate, so the base colour is already at full brightness','The scene tree has no CanvasModulate','Add one with a dark colour, like the bundle\'s Ambient node'],
    ['Pixel-art relief looks smeared','Linear filtering on the node or the CanvasTexture','Zoom in: soft pixel edges','Filter Nearest; see [[game/godot-pixel-art-blurry|blurry pixel art in Godot]]']]},
   alternatives:{rows:[
    ['Build the CanvasTexture and lights yourself','You already have normal maps (a 3D bake, Laigter, hand-painted): follow the steps above with your own `_n` file.'],
    ['A canvas_item shader of your own','You need a light Godot\'s Light2D does not draw, such as a rim light; that is why the Studio\'s rim light stays in the preview.'],
    ['An AnimatedSprite2D from [[game/aseprite-to-godot|the SpriteFrames export]]','You prefer SpriteFrames for animation; attaching normal maps to its frames was not part of our check.']]},
   limits:['Checked with the Compatibility renderer (gl_compatibility) of Godot 4.7.2; Forward+ and Mobile were not run.','Shadows (LightOccluder2D) are not exported.','The exported scene animates a Sprite2D through an AnimationPlayer, not an AnimatedSprite2D.'],
   versions:{body:['Godot 4.7.2 (gl_compatibility), six real CC0 cases: every checked frame within 1/255 of the Studio\'s reference, mean 0.14–0.22 levels, also through the exported AnimationPlayer; the same render with green flipped was 3.8–37 levels off, so the check sees a wrong convention. Property names and defaults above follow the Godot 4.7 class reference.'],sources:[G_LIGHTS,G_CANVAS,G_POINT,G_DIR,G_LIGHT2D,G_ITEM,G_IMPORT]}
  },
  ko:{
   answer:'Godot 4에서 2D 노멀맵은 `CanvasTexture` 안에서만 작동합니다. 스프라이트의 Diffuse Texture 옆 Normal Map Texture에 노멀맵을 넣고, Height가 0보다 크며 Item Cull Mask가 스프라이트의 Light Mask와 겹치는 `PointLight2D`나 `DirectionalLight2D`로 비춰야 합니다. Nerulio 텍스처 작업 공간은 노멀맵을 만들고, 그 씬(Sprite2D, CanvasTexture, CanvasModulate, 조명마다 PointLight2D, 프레임용 AnimationPlayer)을 완성된 상태로 내보냅니다. Godot 4.7.2 렌더와 미리보기 차이는 1/255 이내였습니다.',
   concept:{title:'Godot 4가 노멀맵 스프라이트를 비추는 방식',body:[
    'Godot는 스프라이트 색 위에 2D 조명을 픽셀 단위로 그립니다. 일반 텍스처에는 노멀이 없어 조명이 밝게만 할 뿐이고, 디퓨즈 텍스처·노멀맵·스페큘러 맵을 묶는 `CanvasTexture`에 넣어야 합니다. 문서대로 노멀맵은 Light2D가 그 CanvasTexture에 영향을 줄 때만 눈에 보입니다. Godot가 기대하는 것은 X+, Y+, Z+ 즉 OpenGL 방식입니다.',
    '조명은 픽셀마다 색 × 에너지 × 감쇠 × N·L을 더하며, L은 픽셀에서 Height만큼 들어 올린 조명으로 향하는 방향입니다. `PointLight2D`의 Height는 픽셀 단위로, 문서의 예는 높이 100이 100px 떨어진 물체를 45°로 비춘다는 것입니다. 기본값은 0이라 조명이 스프라이트 평면 위에 놓입니다. `DirectionalLight2D`의 Height는 0(평면과 평행)부터 1(수직)까지이고 방향은 노드의 회전으로 정합니다.',
    '조명의 크기와 감쇠는 텍스처에서 옵니다. `PointLight2D`는 보통 회색인 텍스처를 Texture Scale만큼 키워 그립니다. `CanvasModulate`는 캔버스 전체에 주변광 색을 곱해 조명이 닿지 않는 곳을 어둡게 만듭니다. 조명이 어느 노드에 닿는지는 Range 설정이 정하는데, 조명의 Item Cull Mask와 각 CanvasItem의 Light Mask(기본 1번 레이어), 그리고 레이어·z 범위입니다.',
    'Nerulio의 미리보기는 이 모델을 CPU와 WebGL2로 계산한 것입니다(`lighting.js`). Godot처럼 빨강·초록에서 N을 읽고 파랑은 그 둘로 다시 계산하며, 내보내는 조명마다 Studio의 감쇠 곡선을 256px 텍스처로 넣기 때문에 방향뿐 아니라 밝기까지 미리보기와 같습니다.'],
    terms:[['CanvasTexture','디퓨즈·노멀·스페큘러 맵과 스페큘러 색·광택을 담는 2D 텍스처 리소스.'],['Height','조명이 캔버스 위로 얼마나 떠 있는지. 노멀맵이 있는 면에서만 차이가 보입니다.'],['Item Cull Mask / Light Mask','조명과 스프라이트의 레이어 비트. 하나라도 겹쳐야 조명이 닿습니다.'],['CanvasModulate','캔버스마다 하나 두는 노드로, 모든 것에 주변광 색을 곱합니다.']]},
   example:{title:'예시: Height와 Texture Scale이 한 픽셀에 주는 영향',lead:'평평한 픽셀(N = 0, 0, 1)과 그 왼쪽 64px에 있는 PointLight2D:',lines:[
    'Height 64px    → 앙각 atan(64/64)  = 45°    평면 N·L = sin 45° = 0.707',
    'Height 0(기본) → 앙각 0°                    평면 N·L = 0: 조명을 향한 경사만 밝음',
    'Height 256px   → 앙각 atan(256/64) = 76°    평면 N·L = 0.970: 입체감이 거의 사라짐',
    '',
    'Nerulio 감쇠 PNG 폭 = 256px 이므로 texture_scale = 2 × 반경 / 256',
    '반경 128px → texture_scale 1.0     반경 256px → texture_scale 2.0',
    '',
    'DirectionalLight2D: Height 0 = 평면과 평행, 1 = 바로 위에서 수직'],
    after:'낮은 조명은 입체를 과장하고 높은 조명은 평평하게 만듭니다. 대부분의 장면은 앙각 30°~60° 사이에 들어옵니다. 노멀맵 강도를 바꾸기 전에 Height부터 조절하세요.'},
   outputs:{lead:'torch.png라는 스프라이트라면 `godot/` 폴더에 다음이 들어 있습니다.',rows:[
    ['torch_lit.tscn','주변광 CanvasModulate, Sprite2D(region 사용, 도트면 Nearest), 조명마다 PointLight2D, 프레임이 있으면 AnimationPlayer가 든 Node2D.'],
    ['torch_canvas_texture.tres','내 Sprite2D에 쓸 CanvasTexture 단독 파일(디퓨즈, 노멀, 필요하면 스페큘러와 광택).'],
    ['torch.png, torch_n.png','원본과 바이트까지 같은 스프라이트·시트, 그리고 OpenGL 노멀맵.'],
    ['torch_light_smooth.png','쓰인 감쇠 종류(smooth·linear·quadratic·constant)마다 하나씩인 감쇠 텍스처.'],
    ['torch_s.png','스페큘러가 0보다 클 때만 들어가는 스페큘러 맵.'],
    ['README.md','이 단계와 검증 상태.']]},
   target:{title:'Godot 4에서 설정하기',steps:[
    '`godot` 폴더를 `res://` 아래 아무 곳에 복사하고(파일끼리 상대 경로로 참조) `torch_lit.tscn`을 열어 결과를 봅니다. 아래는 내 노드에 직접 설정할 때입니다.',
    'Sprite2D를 선택하고 Texture 속성에서 새 CanvasTexture를 만든 뒤 Diffuse Texture에 스프라이트 PNG, Normal Map Texture에 `torch_n.png`를 넣거나 `torch_canvas_texture.tres`를 불러옵니다.',
    'PointLight2D를 추가하고 Texture(번들의 감쇠 PNG나 부드러운 원형 그러데이션), 0보다 큰 Height(픽셀), Energy를 정한 뒤 스프라이트 위로 옮깁니다.',
    '마스크를 확인합니다. 조명의 Range › Item Cull Mask와 스프라이트의 Light Mask(기본 1번 레이어)가 한 레이어 이상 겹쳐야 합니다.',
    '어두운 색의 CanvasModulate를 하나 두어 조명이 없는 곳을 어둡게 합니다. 없으면 스프라이트가 처음부터 최대 밝기이고 조명은 더하기만 합니다.',
    '도트 그림이면 Sprite2D의 Texture › Filter를 Nearest로 둡니다(번들은 설정됨). 다른 곳에서 받은 DirectX 방식 맵이라면 Import 독에서 Process › Normal Map Invert Y를 켜고 다시 가져옵니다.']},
   verify:{steps:[
    '조명을 스프라이트 위로 옮기세요. 윗가장자리가 밝아져야 하고, 아랫가장자리가 밝아지면 DirectX 방식 맵입니다.',
    '조명의 Height를 0부터 올려 보세요. 조명이 높아질수록 입체가 부드러워져야 하며, 전혀 변화가 없으면 노멀맵이 읽히지 않는 것입니다.',
    'Studio의 Lit 보기와 비교하세요. 검증에서 Godot 4.7.2는 확인한 모든 프레임에서 1/255 이내로 같았습니다.']},
   trouble:{rows:[
    ['노멀맵을 넣어도 아무 변화가 없음','스프라이트가 노멀맵이 든 CanvasTexture가 아닌 일반 텍스처를 씀','인스펙터에서 Sprite2D의 Texture가 CanvasTexture인지','텍스처를 CanvasTexture로 감싸거나 `torch_canvas_texture.tres` 불러오기'],
    ['조명 쪽 테두리만 빛나고 가운데는 어두움','PointLight2D의 Height가 기본값 0이라 조명이 스프라이트 평면에 놓임','인스펙터에서 조명의 Height','Height를 올리기. 스프라이트까지의 거리만큼이면 45°'],
    ['스프라이트가 전혀 밝아지지 않음','조명의 Item Cull Mask와 스프라이트의 Light Mask가 겹치지 않거나, 스프라이트가 조명 텍스처 범위 밖에 있음','조명을 껐다 켜 보고, 두 마스크와 Texture Scale 확인','같은 레이어에 두고 Texture Scale 키우기'],
    ['조명이 위에 있는데 아래에서 비친 듯함','DirectX 방식(Y−) 노멀맵','바로 위 조명에서 윗가장자리가 어두움','OpenGL인 `torch_n.png`를 쓰거나 Process › Normal Map Invert Y를 켜고 다시 가져오기. [[game/normal-map-opengl-or-directx|OpenGL·DirectX 판별]] 참고'],
    ['화면 전체가 허옇게 뜸','CanvasModulate가 없어 기본색이 이미 최대 밝기','씬 트리에 CanvasModulate가 없음','번들의 Ambient 노드처럼 어두운 색으로 하나 추가'],
    ['도트 입체가 번져 보임','노드나 CanvasTexture의 선형 필터','확대하면 픽셀 경계가 부드러움','Nearest 필터. [[game/godot-pixel-art-blurry|Godot 도트 흐림 해결]] 참고']]},
   alternatives:{rows:[
    ['CanvasTexture와 조명을 직접 구성','이미 노멀맵이 있을 때(3D 굽기, Laigter, 손으로 그림). 위 단계를 내 `_n` 파일로 따라 하면 됩니다.'],
    ['직접 만든 canvas_item 셰이더','림 라이트처럼 Godot의 Light2D가 그리지 않는 조명이 필요할 때. 그래서 Studio의 림 라이트는 미리보기에만 있습니다.'],
    ['[[game/aseprite-to-godot|SpriteFrames 내보내기]]의 AnimatedSprite2D','애니메이션을 SpriteFrames로 다루고 싶을 때. 그 프레임에 노멀맵을 붙이는 것은 검증 대상이 아니었습니다.']]},
   limits:['Godot 4.7.2의 Compatibility 렌더러(gl_compatibility)로만 확인했습니다. Forward+와 Mobile은 돌려 보지 않았습니다.','그림자(LightOccluder2D)는 내보내지 않습니다.','내보낸 씬은 AnimatedSprite2D가 아니라 AnimationPlayer로 Sprite2D를 움직입니다.'],
   versions:{body:['Godot 4.7.2(gl_compatibility), 실제 CC0 사례 6건: 확인한 모든 프레임이 Studio 기준과 1/255 이내(평균 0.14~0.22단계)였고 내보낸 AnimationPlayer를 거쳐도 같았습니다. 초록을 뒤집은 렌더는 3.8~37단계 어긋나, 검사가 잘못된 규약을 잡아낸다는 것도 확인했습니다. 속성 이름과 기본값은 Godot 4.7 클래스 레퍼런스를 따릅니다.'],sources:[G_LIGHTS,G_CANVAS,G_POINT,G_DIR,G_LIGHT2D,G_ITEM,G_IMPORT]}
  },
  ja:{
   answer:'Godot 4の2Dノーマルマップは `CanvasTexture` の中でだけ働きます。スプライトのDiffuse Textureの隣のNormal Map Textureにノーマルマップを入れ、Heightが0より大きく、Item Cull MaskがスプライトのLight Maskと重なる `PointLight2D` か `DirectionalLight2D` で照らす必要があります。Nerulioのテクスチャ作業画面はノーマルマップを作り、そのシーン（Sprite2D、CanvasTexture、CanvasModulate、ライトごとのPointLight2D、フレーム用のAnimationPlayer）を完成した状態で書き出します。Godot 4.7.2での描画とプレビューの差は1/255以内でした。',
   concept:{title:'Godot 4がノーマルマップ付きスプライトを照らす仕組み',body:[
    'Godotはスプライトの色の上に2Dライトをピクセル単位で描きます。普通のテクスチャには法線がないのでライトは明るくするだけです。ディフューズ・ノーマルマップ・スペキュラーマップをまとめる `CanvasTexture` に入れる必要があり、ドキュメントのとおり、ノーマルマップはLight2DがそのCanvasTextureに当たっているときだけ目に見えます。Godotが期待するのはX+、Y+、Z+、つまりOpenGL方式です。',
    'ライトはピクセルごとに 色 × エネルギー × 減衰 × N·L を加えます。Lはピクセルから、Heightの分だけ持ち上げたライトへの方向です。`PointLight2D` のHeightはピクセル単位で、ドキュメントの例では高さ100が100px離れた物体を45°で照らします。既定値は0で、ライトがスプライトの平面上に置かれます。`DirectionalLight2D` のHeightは0（平面と平行）から1（垂直）までで、向きはノードの回転で決まります。',
    'ライトの大きさと減衰はテクスチャから来ます。`PointLight2D` はふつうグレーのテクスチャをTexture Scaleの分だけ拡大して描きます。`CanvasModulate` はキャンバス全体に環境光の色を掛け、光の当たらない所を暗くします。ライトがどのノードに届くかはRangeの設定で決まり、ライトのItem Cull Maskと各CanvasItemのLight Mask（既定はレイヤー1）、さらにレイヤーとzの範囲です。',
    'Nerulioのプレビューはこのモデルを CPU と WebGL2 で計算したものです（`lighting.js`）。Godotと同じく赤と緑からNを読み、青はその2つから計算し直します。書き出す各ライトにはStudioの減衰カーブを256pxのテクスチャとして入れるので、向きだけでなく明るさもプレビューと一致します。'],
    terms:[['CanvasTexture','ディフューズ・ノーマル・スペキュラーのマップとスペキュラーの色・光沢を持つ2Dテクスチャのリソース。'],['Height','ライトがキャンバスからどれだけ浮いているか。ノーマルマップのある面でだけ違いが見えます。'],['Item Cull Mask / Light Mask','ライトとスプライトのレイヤーのビット。1つでも重ならないと光が届きません。'],['CanvasModulate','キャンバスに1つ置くノードで、全体に環境光の色を掛けます。']]},
   example:{title:'具体例：HeightとTexture Scaleが1ピクセルに与える影響',lead:'平らなピクセル（N = 0, 0, 1）と、その左64pxにあるPointLight2D：',lines:[
    'Height 64px    → 仰角 atan(64/64)  = 45°    平面の N·L = sin 45° = 0.707',
    'Height 0（既定）→ 仰角 0°                   平面の N·L = 0：光に向いた斜面だけが明るい',
    'Height 256px   → 仰角 atan(256/64) = 76°    平面の N·L = 0.970：立体感がほぼ消える',
    '',
    'Nerulioの減衰PNGは幅256px なので texture_scale = 2 × 半径 / 256',
    '半径128px → texture_scale 1.0     半径256px → texture_scale 2.0',
    '',
    'DirectionalLight2D：Height 0 = 平面と平行、1 = 真上から垂直'],
    after:'低いライトは立体を強調し、高いライトは平らにします。多くの場面は仰角30°〜60°に収まります。ノーマルマップの強さを変える前に、まずHeightを調整してください。'},
   outputs:{lead:'torch.pngというスプライトなら、`godot/` フォルダーの中身は次のとおりです。',rows:[
    ['torch_lit.tscn','環境光のCanvasModulate、Sprite2D（region有効、ドット絵ならNearest）、ライトごとのPointLight2D、フレームがあればAnimationPlayerを持つNode2D。'],
    ['torch_canvas_texture.tres','自分のSprite2D用のCanvasTexture単体（ディフューズ、ノーマル、必要ならスペキュラーと光沢）。'],
    ['torch.png, torch_n.png','元とバイト単位で同じスプライト・シートと、そのOpenGLノーマルマップ。'],
    ['torch_light_smooth.png','使った減衰の種類（smooth・linear・quadratic・constant）ごとの減衰テクスチャ。'],
    ['torch_s.png','スペキュラーが0より大きいときだけ入るスペキュラーマップ。'],
    ['README.md','この手順と検証状況。']]},
   target:{title:'Godot 4で設定する',steps:[
    '`godot` フォルダーを `res://` 以下の好きな場所にコピーし（ファイル同士は相対パスで参照）、`torch_lit.tscn` を開いて結果を見ます。以下は自分のノードに設定する場合です。',
    'Sprite2Dを選び、Textureプロパティで新しいCanvasTextureを作り、Diffuse TextureにスプライトのPNG、Normal Map Textureに `torch_n.png` を入れるか、`torch_canvas_texture.tres` を読み込みます。',
    'PointLight2Dを追加し、Texture（バンドルの減衰PNGか、やわらかい円形グラデーション）、0より大きいHeight（ピクセル）、Energyを決めてスプライトの上へ動かします。',
    'マスクを確認します。ライトのRange › Item Cull MaskとスプライトのLight Mask（既定はレイヤー1）が1つ以上重なっている必要があります。',
    '暗い色のCanvasModulateを1つ置き、光の当たらない所を暗くします。ないとスプライトは最初から最大の明るさで、ライトは足し算するだけになります。',
    'ドット絵ならSprite2DのTexture › FilterをNearestにします（バンドルは設定済み）。よそで作ったDirectX方式のマップなら、ImportドックでProcess › Normal Map Invert Yをオンにして再インポートします。']},
   verify:{steps:[
    'ライトをスプライトの上に動かします。上の縁が明るくなるはずで、下の縁が明るくなるならDirectX方式のマップです。',
    'ライトのHeightを0から上げてみます。ライトが高くなるほど立体がやわらかくなるはずで、まったく変わらなければノーマルマップが読まれていません。',
    'StudioのLit表示と比べます。検証ではGodot 4.7.2が確認した全フレームで1/255以内で一致しました。']},
   trouble:{rows:[
    ['ノーマルマップを入れても何も変わらない','スプライトがノーマルマップ入りのCanvasTextureではなく普通のテクスチャを使っている','インスペクターでSprite2DのTextureがCanvasTextureか','テクスチャをCanvasTextureで包むか、`torch_canvas_texture.tres` を読み込む'],
    ['光に向いた縁だけ光り、中央は暗い','PointLight2DのHeightが既定の0で、ライトがスプライトの平面上にある','インスペクターでライトのHeight','Heightを上げる。スプライトまでの距離と同じくらいで45°'],
    ['スプライトがまったく明るくならない','ライトのItem Cull MaskとスプライトのLight Maskが重ならない、またはスプライトがライトのテクスチャの範囲外','ライトをオンオフし、両方のマスクとTexture Scaleを確認','同じレイヤーに置き、Texture Scaleを大きくする'],
    ['ライトが上にあるのに下から照らされたよう','DirectX方式（Y−）のノーマルマップ','真上のライトで上の縁が暗い','OpenGLの `torch_n.png` を使うか、Process › Normal Map Invert Yをオンにして再インポート。[[game/normal-map-opengl-or-directx|OpenGL・DirectXの判定]]を参照'],
    ['全体が白っぽく浮いて見える','CanvasModulateがなく、基本色がすでに最大の明るさ','シーンツリーにCanvasModulateがない','バンドルのAmbientノードのように暗い色で1つ追加'],
    ['ドット絵の凹凸がにじむ','ノードかCanvasTextureの線形フィルター','拡大するとピクセルの境目がやわらかい','Nearestフィルター。[[game/godot-pixel-art-blurry|Godotでドット絵がぼやける]]を参照']]},
   alternatives:{rows:[
    ['CanvasTextureとライトを自分で組む','ノーマルマップがすでにあるとき（3Dベイク、Laigter、手描き）。上の手順を自分の `_n` ファイルでなぞれば済みます。'],
    ['自作のcanvas_itemシェーダー','リムライトのように、GodotのLight2Dが描かないライトが必要なとき。そのためStudioのリムライトはプレビュー専用です。'],
    ['[[game/aseprite-to-godot|SpriteFrames書き出し]]のAnimatedSprite2D','アニメーションをSpriteFramesで扱いたいとき。そのフレームにノーマルマップを付ける構成は検証の対象外でした。']]},
   limits:['Godot 4.7.2のCompatibilityレンダラー（gl_compatibility）でのみ確認しました。Forward+とMobileは試していません。','影（LightOccluder2D）は書き出しません。','書き出したシーンはAnimatedSprite2DではなくAnimationPlayerでSprite2Dを動かします。'],
   versions:{body:['Godot 4.7.2（gl_compatibility）、実在するCC0の6ケース：確認した全フレームがStudioの基準と1/255以内（平均0.14〜0.22段階）で、書き出したAnimationPlayerを通しても同じでした。緑を反転した描画は3.8〜37段階ずれ、チェックが誤った規約を見分けられることも確かめています。プロパティ名と既定値はGodot 4.7のクラスリファレンスに従います。'],sources:[G_LIGHTS,G_CANVAS,G_POINT,G_DIR,G_LIGHT2D,G_ITEM,G_IMPORT]}
  }
 },
 'game/unity-2d-normal-map':{
  type:'engine',
  intent:{primary:'use a normal map on a 2D sprite in Unity 6 URP so Light 2D shades it',secondary:['Secondary Texture _NormalMap','Light 2D Normal Map Quality and Distance','Light Render Texture Scale for pixel art','normal map not working in Unity 2D'],
   goal:'a Unity 6 URP 2D sprite whose relief follows Light 2D lights',input:'sprite or cut sheet (PNG) plus its normal map, or a sprite to generate one from',output:'PNGs + nerulio-texture.json + Editor/NerulioNormalMapImporter.cs',target:'Unity 6 URP 2D (verified 6000.5.3f1, URP 17.5)',support:'full',
   evidence:['src/game/normals/export.js UNITY_IMPORTER / unityBlock','docs/STUDIO-TEXTURE.md (Unity 12/12, negative control, three importer bugs)','tests/normals.test.mjs (importer checks)'],
   external:['Unity manual: Secondary Textures _NormalMap, Sprite-Lit-Default','Light 2D: Normal Map Quality (Disabled default), Normal Map Distance (units)','Renderer 2D: Light Render Texture Scale default 0.5','Unity uses Y+ normal maps']},
  en:{
   answer:'In Unity 6 a 2D normal map is read only when four things line up: the project renders with URP and its 2D Renderer, the sprite uses the Sprite-Lit-Default material, the map is attached to the sprite texture as a Secondary Texture named `_NormalMap`, and the Light 2D has Normal Map Quality set to Fast or Accurate (it is Disabled by default). Nerulio exports the PNGs, a JSON and an editor script that does the texture part and can place matching Light 2D lights; it passed 12 of 12 runs in Unity 6000.5.3f1 with URP 17.5.',
   concept:{title:'How URP\'s 2D lights read a sprite normal map',body:[
    'URP\'s lit sprite shader samples the normal map through the sprite\'s Secondary Textures: extra textures stored with the sprite, found by name. The name `_NormalMap` is what the shader looks for, and the map must share the sprite\'s UVs, so it has to have exactly the sprite sheet\'s size and layout. Unity uses Y+ normal maps (the OpenGL style), with RGB = XYZ and (0.5, 0.5, 1) as the flat normal.',
    'A normal map holds vectors, not colours, so sRGB (Color Texture) must be off or the values are gamma-decoded and every slope tilts. Unity\'s manual imports it with Texture Type Normal Map; Nerulio\'s importer keeps it a Default texture with sRGB off, uncompressed, no mipmaps and Non-Power of 2 set to None, which is the setup that passed in Unity 6.',
    'On the light, Normal Map Quality switches normal mapping on (Fast or Accurate) and Normal Map Distance sets how far the light sits from the sprite, in Unity units. It works like a height: a small distance means light arriving at a steep angle from the side, a large one light from almost straight above.',
    'The 2D Renderer computes lights into textures at a fraction of the screen resolution, 0.5 by default (Light Render Texture Scale). For smooth art that is invisible; for pixel art it softens one-pixel lighting bands, so the Nerulio README suggests 1.'],
    terms:[['Secondary Texture','An extra texture attached to a sprite and found by name; `_NormalMap` for normals, `_MaskTex` for masks.'],['Normal Map Quality','Disabled (default), Fast or Accurate on each Light 2D.'],['Normal Map Distance','The light\'s distance from the sprite plane in Unity units; Nerulio sets it to the Studio height ÷ Pixels Per Unit.'],['Pixels Per Unit','How many texture pixels make one Unity unit; 100 in the export by default.']]},
   example:{title:'Example: one Studio light converted to Unity units',lead:'A 32 × 32 frame, Pixels Per Unit 100, a Studio light at x 8, y 6 (pixels, y down), height 24 px, radius 96 px:',lines:[
    'position x = (8  − 32/2) / 100 = −0.08',
    'position y = (32/2 − 6)  / 100 = +0.10     (Unity y points up)',
    'Normal Map Distance = 24 / 100 = 0.24     Outer Radius = 96 / 100 = 0.96',
    '',
    'sprite rect, sheet 192 × 32, frame 3:  x = 96, y = 32 − (0 + 32) = 0',
    '',
    'Light Render Texture Scale 0.5 at 1920 × 1080 → lights drawn at 960 × 540',
    '                             1.0             → 1920 × 1080, one light texel per screen pixel'],
    after:'Positions are measured from the sprite\'s centre pivot, which the importer sets for every frame. Rects are written bottom-up because Unity counts texture rows from the bottom.'},
   outputs:{lead:'For a sprite called torch.png the `unity/` folder holds:',rows:[
    ['torch.png, torch_n.png','The sprite or sheet, byte for byte, and its OpenGL (Y+) normal map.'],
    ['nerulio-texture.json','Size, Pixels Per Unit, Point filter flag, frame rects (bottom-up) and the lights with position, height, energy, radius and colour.'],
    ['Editor/NerulioNormalMapImporter.cs','Adds Tools › Nerulio › Apply Texture JSON and Create Lit Preview.'],
    ['README.md','These steps, the Light Render Texture Scale hint and the verification status.']]},
   target:{title:'Set it up in Unity 6 (URP 2D)',steps:[
    'Use a project that renders with URP and a 2D Renderer, and keep the sprites on the Sprite-Lit-Default material.',
    'Copy the `unity` folder into `Assets/`; Unity compiles `Editor/NerulioNormalMapImporter.cs`.',
    'Run Tools › Nerulio › Apply Texture JSON and pick `nerulio-texture.json`: the sprite gets its frame rects (Multiple mode for sheets, Point filter for pixel art) and `_NormalMap` as Secondary Texture; the normal map gets sRGB off, no compression, no mipmaps and no power-of-two resize.',
    'Run Tools › Nerulio › Create Lit Preview: a `NerulioLitPreview` object with the first frame and one Light 2D per Studio light, Normal Map Quality Accurate and Normal Map Distance = height ÷ Pixels Per Unit.',
    'For your own lights (GameObject › Light, for example Spot Light 2D), set Normal Map Quality to Fast or Accurate and a Normal Map Distance, and make sure Target Sorting Layers include the sprite\'s layer.',
    'For pixel art, open your Renderer 2D asset and set Light Render Texture Scale to 1.']},
   verify:{steps:[
    'Select the sprite texture › Open Sprite Editor › Secondary Textures: `_NormalMap` points at `torch_n.png`.',
    'Select `torch_n.png`: sRGB (Color Texture) off and the size in the inspector equals the PNG\'s size.',
    'Move a Light 2D above the sprite: top edges brighten. Set its Normal Map Quality to Disabled and the relief disappears, which proves the map is read.']},
   trouble:{rows:[
    ['Only a flat glow, no relief','The Light 2D\'s Normal Map Quality is Disabled, its default','Light 2D inspector','Set Fast or Accurate (Create Lit Preview sets Accurate)'],
    ['Relief tilted the wrong way, lit from below','A DirectX-style (Y−) map, or sRGB left on so the vectors are gamma-decoded','Import settings of the normal map; the Studio\'s Check panel verdict','Use Nerulio\'s `torch_n.png` (Y+) and turn sRGB off; see [[game/normal-map-opengl-or-directx|OpenGL or DirectX]]'],
    ['Normals blurred or shifted against the pixels','The map was resized to a power of two or compressed (a 96 × 64 map became 128 × 64 in our first run)','The inspector shows another size than the PNG','Non-Power of 2 None, Uncompressed; the current importer sets both'],
    ['Soft, blocky light bands on pixel art','Light Render Texture Scale is 0.5','Renderer 2D asset','Set it to 1; see also [[game/unity-pixel-art-blurry|blurry pixel art in Unity]]'],
    ['The sprite is not lit at all','Sprite-Unlit-Default material, or the light\'s Target Sorting Layers leave out the sprite\'s layer','Sprite Renderer material; the light\'s Target Sorting Layers','Use Sprite-Lit-Default and include the layer'],
    ['Create Lit Preview placed no lights','URP is not installed (the console says so), or an old copy of the importer searched the pre-Unity 6 assembly for Light2D','Console message after the command','Install URP; re-export so the current importer is used']]},
   alternatives:{rows:[
    ['Unity\'s Sprite Editor › Secondary Textures by hand','One or two sprites: add `_NormalMap` yourself. Unity\'s manual sets the map\'s Texture Type to Normal Map; the importer keeps Default with sRGB off, which is the variant that was verified.'],
    ['A custom lit sprite shader (Shader Graph)','You need a lighting look URP\'s 2D lights do not give; the texture settings above still apply.'],
    ['[[game/unity-sprite-sheet|Unity sprite sheet export]]','You only need the frames sliced in Unity, without normal maps.']]},
   limits:['Brightness follows URP\'s own light falloff, not the Studio\'s; placement, height and the N·L term were verified.','No specular map is exported for Unity (Godot only).','Only Unity 6000.5.3f1 with URP 17.5 was run; other versions may name the light fields differently.'],
   versions:{body:['Unity 6000.5.3f1, URP 17.5, 2D Renderer, Direct3D 12: 12 of 12 PASS (6 real cases × Gamma and Linear colour space), mean |N·L error| 0.0037–0.0085 and p95 0.013–0.022 against the exported map; with the map green-flipped inside Unity every run failed (mean error 0.07–0.19). The probe ran the shipped importer. Menu names, defaults and the Secondary Texture name follow the Unity manual.'],sources:[U_SECONDARY,U_LIGHT,U_RENDERER,U_PREPARE,U_NORMAL]}
  },
  ko:{
   answer:'Unity 6에서 2D 노멀맵은 네 가지가 맞아야 읽힙니다. 프로젝트가 URP와 2D 렌더러로 그리고, 스프라이트가 Sprite-Lit-Default 머티리얼을 쓰며, 노멀맵이 스프라이트 텍스처에 이름이 `_NormalMap`인 보조 텍스처로 붙어 있고, Light 2D의 Normal Map Quality가 Fast나 Accurate여야 합니다(기본값은 Disabled). Nerulio는 PNG, JSON, 그리고 텍스처 쪽 설정을 대신하고 맞는 Light 2D까지 배치하는 에디터 스크립트를 내보내며, Unity 6000.5.3f1·URP 17.5에서 12회 중 12회 통과했습니다.',
   concept:{title:'URP 2D 조명이 스프라이트 노멀맵을 읽는 방식',body:[
    'URP의 조명용 스프라이트 셰이더는 스프라이트의 보조 텍스처(Secondary Textures)에서 노멀맵을 읽습니다. 스프라이트와 함께 저장되고 이름으로 찾는 추가 텍스처이며, 셰이더가 찾는 이름이 `_NormalMap`입니다. 스프라이트와 UV를 공유하므로 시트와 크기·배치가 정확히 같아야 합니다. Unity는 Y+ 노멀맵(OpenGL 방식)을 쓰고, RGB가 XYZ이며 평평한 노멀은 (0.5, 0.5, 1)입니다.',
    '노멀맵은 색이 아니라 벡터를 담으므로 sRGB(Color Texture)를 꺼야 합니다. 켜 두면 값이 감마 변환되어 모든 경사가 틀어집니다. Unity 매뉴얼은 Texture Type을 Normal Map으로 가져오지만, Nerulio 임포터는 Default 텍스처로 두고 sRGB 끔, 무압축, 밉맵 없음, Non-Power of 2 None으로 설정하며, 이것이 Unity 6에서 통과한 구성입니다.',
    '조명 쪽에서는 Normal Map Quality가 노멀 매핑을 켜고(Fast 또는 Accurate), Normal Map Distance가 조명과 스프라이트 사이 거리를 Unity 단위로 정합니다. 높이처럼 작동해서, 거리가 작으면 빛이 옆에서 가파르게 들어오고 크면 거의 바로 위에서 들어옵니다.',
    '2D 렌더러는 조명을 화면 해상도의 일부 크기 텍스처에 계산하며 기본값은 0.5입니다(Light Render Texture Scale). 부드러운 그림에서는 티가 안 나지만 도트 그림에서는 1픽셀짜리 조명 띠가 뭉개지므로, Nerulio README는 1을 권합니다.'],
    terms:[['보조 텍스처','스프라이트에 붙어 이름으로 찾는 추가 텍스처. 노멀은 `_NormalMap`, 마스크는 `_MaskTex`.'],['Normal Map Quality','Light 2D마다 있는 설정. Disabled(기본)·Fast·Accurate.'],['Normal Map Distance','조명과 스프라이트 평면 사이 거리(Unity 단위). Nerulio는 Studio 높이 ÷ Pixels Per Unit으로 넣습니다.'],['Pixels Per Unit','Unity 1단위에 해당하는 텍스처 픽셀 수. 내보내기 기본값은 100.']]},
   example:{title:'예시: Studio 조명 하나를 Unity 단위로 바꾸기',lead:'32 × 32 프레임, Pixels Per Unit 100, Studio 조명이 x 8, y 6(픽셀, 아래가 +), 높이 24px, 반경 96px일 때:',lines:[
    '위치 x = (8  − 32/2) / 100 = −0.08',
    '위치 y = (32/2 − 6)  / 100 = +0.10     (Unity는 위가 +)',
    'Normal Map Distance = 24 / 100 = 0.24     Outer Radius = 96 / 100 = 0.96',
    '',
    '스프라이트 영역, 시트 192 × 32, 3번 프레임:  x = 96, y = 32 − (0 + 32) = 0',
    '',
    'Light Render Texture Scale 0.5, 1920 × 1080 화면 → 조명을 960 × 540으로 계산',
    '                             1.0                  → 1920 × 1080, 화면 픽셀마다 조명 텍셀 하나'],
    after:'위치는 임포터가 모든 프레임에 설정하는 가운데 피벗을 기준으로 잽니다. Unity는 텍스처 행을 아래에서부터 세기 때문에 영역도 아래 기준으로 기록됩니다.'},
   outputs:{lead:'torch.png라는 스프라이트라면 `unity/` 폴더에 다음이 들어 있습니다.',rows:[
    ['torch.png, torch_n.png','원본과 바이트까지 같은 스프라이트·시트와 OpenGL(Y+) 노멀맵.'],
    ['nerulio-texture.json','크기, Pixels Per Unit, Point 필터 여부, 아래 기준 프레임 영역, 조명의 위치·높이·세기·반경·색.'],
    ['Editor/NerulioNormalMapImporter.cs','Tools › Nerulio › Apply Texture JSON과 Create Lit Preview 메뉴를 추가합니다.'],
    ['README.md','이 단계, Light Render Texture Scale 안내, 검증 상태.']]},
   target:{title:'Unity 6(URP 2D)에서 설정하기',steps:[
    'URP와 2D 렌더러로 그리는 프로젝트를 쓰고, 스프라이트 머티리얼은 Sprite-Lit-Default로 둡니다.',
    '`unity` 폴더를 `Assets/`에 복사하면 Unity가 `Editor/NerulioNormalMapImporter.cs`를 컴파일합니다.',
    'Tools › Nerulio › Apply Texture JSON을 실행해 `nerulio-texture.json`을 고릅니다. 스프라이트에 프레임 영역(시트는 Multiple, 도트는 Point 필터)과 보조 텍스처 `_NormalMap`이 들어가고, 노멀맵은 sRGB 끔·무압축·밉맵 없음·2의 거듭제곱 크기 변경 없음으로 설정됩니다.',
    'Tools › Nerulio › Create Lit Preview를 실행하면 첫 프레임과 Studio 조명마다 Light 2D가 든 `NerulioLitPreview` 오브젝트가 생기며, Normal Map Quality는 Accurate, Normal Map Distance는 높이 ÷ Pixels Per Unit입니다.',
    '직접 만든 조명(GameObject › Light, 예: Spot Light 2D)은 Normal Map Quality를 Fast나 Accurate로 바꾸고 Normal Map Distance를 정한 뒤, Target Sorting Layers에 스프라이트의 레이어가 포함되는지 확인합니다.',
    '도트 그림이면 Renderer 2D 에셋을 열어 Light Render Texture Scale을 1로 둡니다.']},
   verify:{steps:[
    '스프라이트 텍스처를 선택 › Open Sprite Editor › Secondary Textures에서 `_NormalMap`이 `torch_n.png`를 가리키는지 봅니다.',
    '`torch_n.png`를 선택해 sRGB(Color Texture)가 꺼져 있고 인스펙터의 크기가 PNG 크기와 같은지 확인합니다.',
    'Light 2D를 스프라이트 위로 옮기면 윗가장자리가 밝아집니다. Normal Map Quality를 Disabled로 바꾸면 입체가 사라지는데, 이것으로 맵이 읽히고 있음이 확인됩니다.']},
   trouble:{rows:[
    ['평평하게 빛나기만 하고 입체가 없음','Light 2D의 Normal Map Quality가 기본값 Disabled','Light 2D 인스펙터','Fast나 Accurate로 바꾸기(Create Lit Preview는 Accurate로 설정)'],
    ['입체가 반대로 기울고 아래에서 비친 듯함','DirectX 방식(Y−) 맵이거나 sRGB가 켜져 벡터가 감마 변환됨','노멀맵 가져오기 설정, Studio 점검 패널의 판정','Nerulio의 `torch_n.png`(Y+)를 쓰고 sRGB 끄기. [[game/normal-map-opengl-or-directx|OpenGL·DirectX 판별]] 참고'],
    ['노멀이 흐리거나 픽셀과 어긋남','맵이 2의 거듭제곱으로 늘어나거나 압축됨(첫 실행에서 96 × 64가 128 × 64로 바뀜)','인스펙터 크기가 PNG와 다름','Non-Power of 2 None, 무압축. 현재 임포터는 둘 다 설정'],
    ['도트 그림의 조명 띠가 뭉개지고 계단처럼 보임','Light Render Texture Scale이 0.5','Renderer 2D 에셋','1로 바꾸기. [[game/unity-pixel-art-blurry|Unity 도트 흐림 해결]]도 참고'],
    ['스프라이트가 전혀 밝아지지 않음','Sprite-Unlit-Default 머티리얼이거나, 조명의 Target Sorting Layers에 스프라이트 레이어가 빠짐','Sprite Renderer 머티리얼과 조명의 Target Sorting Layers','Sprite-Lit-Default를 쓰고 레이어 포함하기'],
    ['Create Lit Preview가 조명을 만들지 않음','URP가 설치되지 않았거나(콘솔에 표시), Unity 6 이전 어셈블리에서 Light2D를 찾던 옛 임포터','명령 뒤의 콘솔 메시지','URP 설치, 다시 내보내 현재 임포터 쓰기']]},
   alternatives:{rows:[
    ['Unity Sprite Editor › Secondary Textures에서 직접','스프라이트가 한두 개라면 `_NormalMap`을 직접 추가하세요. Unity 매뉴얼은 맵의 Texture Type을 Normal Map으로 두지만, 임포터는 sRGB를 끈 Default로 두며 검증한 것은 이 구성입니다.'],
    ['직접 만든 조명 스프라이트 셰이더(Shader Graph)','URP 2D 조명으로는 안 나오는 표현이 필요할 때. 위의 텍스처 설정은 그대로 적용됩니다.'],
    ['[[game/unity-sprite-sheet|Unity 스프라이트 시트 내보내기]]','노멀맵 없이 Unity에서 프레임만 잘리면 될 때.']]},
   limits:['밝기는 Studio가 아니라 URP 자체의 감쇠를 따릅니다. 검증한 것은 위치, 높이, N·L 항입니다.','Unity용 스페큘러 맵은 내보내지 않습니다(Godot 전용).','Unity 6000.5.3f1과 URP 17.5에서만 돌려 봤으며, 다른 버전은 조명 필드 이름이 다를 수 있습니다.'],
   versions:{body:['Unity 6000.5.3f1, URP 17.5, 2D 렌더러, Direct3D 12: 12회 중 12회 통과(실제 사례 6건 × Gamma·Linear 색 공간). 내보낸 맵 대비 N·L 평균 오차 0.0037~0.0085, p95 0.013~0.022였고, Unity 안에서 맵의 초록을 뒤집으면 모든 실행이 실패했습니다(평균 오차 0.07~0.19). 검사는 배포하는 임포터를 그대로 실행했습니다. 메뉴 이름, 기본값, 보조 텍스처 이름은 Unity 매뉴얼을 따릅니다.'],sources:[U_SECONDARY,U_LIGHT,U_RENDERER,U_PREPARE,U_NORMAL]}
  },
  ja:{
   answer:'Unity 6で2Dノーマルマップが読まれるのは、4つがそろったときだけです。プロジェクトがURPと2D Rendererで描画し、スプライトがSprite-Lit-Defaultマテリアルを使い、ノーマルマップがスプライトのテクスチャに `_NormalMap` という名前のセカンダリテクスチャとして付き、Light 2DのNormal Map QualityがFastかAccurateであること（既定はDisabled）。NerulioはPNG、JSON、そしてテクスチャ側の設定を代わりに行い対応するLight 2Dも置けるエディタースクリプトを書き出し、Unity 6000.5.3f1・URP 17.5で12回中12回合格しました。',
   concept:{title:'URPの2Dライトがスプライトのノーマルマップを読む仕組み',body:[
    'URPのライト対応スプライトシェーダーは、スプライトのセカンダリテクスチャからノーマルマップを読みます。スプライトと一緒に保存され、名前で探される追加のテクスチャで、シェーダーが探す名前が `_NormalMap` です。スプライトとUVを共有するので、シートとサイズ・配置が完全に同じである必要があります。UnityはY+のノーマルマップ（OpenGL方式）を使い、RGBがXYZ、平らな法線は (0.5, 0.5, 1) です。',
    'ノーマルマップは色ではなくベクトルなので、sRGB（Color Texture）をオフにしなければなりません。オンだと値がガンマ変換され、すべての斜面が傾きます。UnityのマニュアルはTexture TypeをNormal Mapで読み込みますが、NerulioのインポーターはDefaultのまま、sRGBオフ・無圧縮・ミップマップなし・Non-Power of 2 Noneに設定し、これがUnity 6で合格した構成です。',
    'ライト側では、Normal Map Qualityが法線マッピングをオンにし（FastかAccurate）、Normal Map Distanceがライトとスプライトの距離をUnityの単位で決めます。高さのように働き、距離が小さいと光が横から急な角度で入り、大きいとほぼ真上から入ります。',
    '2D Rendererはライトを画面解像度の一部の大きさのテクスチャに計算し、既定は0.5です（Light Render Texture Scale）。なめらかな絵では目立ちませんが、ドット絵では1ピクセル幅の光の帯がぼやけるため、NerulioのREADMEは1を勧めています。'],
    terms:[['セカンダリテクスチャ','スプライトに付けて名前で探す追加のテクスチャ。法線は `_NormalMap`、マスクは `_MaskTex`。'],['Normal Map Quality','Light 2Dごとの設定。Disabled（既定）・Fast・Accurate。'],['Normal Map Distance','ライトとスプライトの平面の距離（Unityの単位）。NerulioはStudioの高さ ÷ Pixels Per Unitを入れます。'],['Pixels Per Unit','Unityの1単位に当たるテクスチャのピクセル数。書き出しの既定は100。']]},
   example:{title:'具体例：Studioのライト1つをUnityの単位に換算',lead:'32 × 32のフレーム、Pixels Per Unit 100、Studioのライトがx 8、y 6（ピクセル、下が＋）、高さ24px、半径96pxのとき：',lines:[
    '位置 x = (8  − 32/2) / 100 = −0.08',
    '位置 y = (32/2 − 6)  / 100 = +0.10     （Unityは上が＋）',
    'Normal Map Distance = 24 / 100 = 0.24     Outer Radius = 96 / 100 = 0.96',
    '',
    'スプライトの範囲、シート192 × 32、フレーム3:  x = 96、y = 32 − (0 + 32) = 0',
    '',
    'Light Render Texture Scale 0.5、画面1920 × 1080 → ライトを960 × 540で計算',
    '                             1.0                → 1920 × 1080、画面の1ピクセルに光のテクセル1つ'],
    after:'位置は、インポーターが全フレームに設定する中央のピボットから測ります。Unityはテクスチャの行を下から数えるので、範囲も下基準で書かれます。'},
   outputs:{lead:'torch.pngというスプライトなら、`unity/` フォルダーの中身は次のとおりです。',rows:[
    ['torch.png, torch_n.png','元とバイト単位で同じスプライト・シートと、OpenGL（Y+）のノーマルマップ。'],
    ['nerulio-texture.json','サイズ、Pixels Per Unit、Pointフィルターの有無、下基準のフレームの範囲、ライトの位置・高さ・強さ・半径・色。'],
    ['Editor/NerulioNormalMapImporter.cs','Tools › Nerulio › Apply Texture JSONとCreate Lit Previewのメニューを追加します。'],
    ['README.md','この手順、Light Render Texture Scaleの案内、検証状況。']]},
   target:{title:'Unity 6（URP 2D）で設定する',steps:[
    'URPと2D Rendererで描画するプロジェクトを使い、スプライトのマテリアルはSprite-Lit-Defaultのままにします。',
    '`unity` フォルダーを `Assets/` にコピーすると、Unityが `Editor/NerulioNormalMapImporter.cs` をコンパイルします。',
    'Tools › Nerulio › Apply Texture JSONを実行して `nerulio-texture.json` を選びます。スプライトにフレームの範囲（シートはMultiple、ドット絵はPointフィルター）とセカンダリテクスチャ `_NormalMap` が入り、ノーマルマップはsRGBオフ・無圧縮・ミップマップなし・2の累乗へのリサイズなしになります。',
    'Tools › Nerulio › Create Lit Previewを実行すると、最初のフレームとStudioのライトごとのLight 2Dを持つ `NerulioLitPreview` が作られます。Normal Map QualityはAccurate、Normal Map Distanceは高さ ÷ Pixels Per Unitです。',
    '自分で作るライト（GameObject › Light、たとえばSpot Light 2D）は、Normal Map QualityをFastかAccurateにしてNormal Map Distanceを決め、Target Sorting Layersにスプライトのレイヤーが含まれているか確認します。',
    'ドット絵なら、Renderer 2DアセットでLight Render Texture Scaleを1にします。']},
   verify:{steps:[
    'スプライトのテクスチャを選択 › Open Sprite Editor › Secondary Texturesで、`_NormalMap` が `torch_n.png` を指しているか見ます。',
    '`torch_n.png` を選び、sRGB（Color Texture）がオフで、インスペクターのサイズがPNGのサイズと同じか確かめます。',
    'Light 2Dをスプライトの上へ動かすと上の縁が明るくなります。Normal Map QualityをDisabledにすると立体が消え、マップが読まれていることが確かめられます。']},
   trouble:{rows:[
    ['平らに光るだけで立体がない','Light 2DのNormal Map Qualityが既定のDisabled','Light 2Dのインスペクター','FastかAccurateにする（Create Lit PreviewはAccurateに設定）'],
    ['立体が逆に傾き、下から照らされたよう','DirectX方式（Y−）のマップか、sRGBがオンでベクトルがガンマ変換された','ノーマルマップのインポート設定、Studioのチェックパネルの判定','Nerulioの `torch_n.png`（Y+）を使い、sRGBをオフに。[[game/normal-map-opengl-or-directx|OpenGL・DirectXの判定]]を参照'],
    ['法線がぼやける、ピクセルとずれる','マップが2の累乗にリサイズされたか圧縮された（最初の実行では96 × 64が128 × 64になった）','インスペクターのサイズがPNGと違う','Non-Power of 2 None、無圧縮。現在のインポーターは両方を設定'],
    ['ドット絵の光の帯がぼやけて段々に見える','Light Render Texture Scaleが0.5','Renderer 2Dアセット','1にする。[[game/unity-pixel-art-blurry|Unityでドット絵がぼやける]]も参照'],
    ['スプライトがまったく明るくならない','Sprite-Unlit-Defaultマテリアル、またはライトのTarget Sorting Layersにスプライトのレイヤーがない','Sprite Rendererのマテリアルとライトの Target Sorting Layers','Sprite-Lit-Defaultを使い、レイヤーを含める'],
    ['Create Lit Previewがライトを作らない','URPが入っていない（コンソールに表示）、またはUnity 6より前のアセンブリでLight2Dを探していた古いインポーター','コマンド後のコンソールのメッセージ','URPを入れ、書き出し直して現在のインポーターを使う']]},
   alternatives:{rows:[
    ['UnityのSprite Editor › Secondary Texturesで手作業','スプライトが1〜2個なら `_NormalMap` を自分で追加。UnityのマニュアルはマップのTexture TypeをNormal Mapにしますが、インポーターはsRGBオフのDefaultにしており、検証したのはこの構成です。'],
    ['自作のライト対応スプライトシェーダー（Shader Graph）','URPの2Dライトでは出せない表現が必要なとき。上のテクスチャ設定はそのまま当てはまります。'],
    ['[[game/unity-sprite-sheet|Unity用スプライトシートの書き出し]]','ノーマルマップなしで、Unityでフレームを切り分けるだけでよいとき。']]},
   limits:['明るさはStudioではなくURP独自の減衰に従います。検証したのは位置、高さ、N·Lの項です。','Unity用のスペキュラーマップは書き出しません（Godotのみ）。','試したのはUnity 6000.5.3f1とURP 17.5だけで、ほかのバージョンではライトのフィールド名が違うことがあります。'],
   versions:{body:['Unity 6000.5.3f1、URP 17.5、2D Renderer、Direct3D 12：12回中12回合格（実在の6ケース × Gamma・Linearの色空間）。書き出したマップに対するN·Lの平均誤差は0.0037〜0.0085、p95は0.013〜0.022で、Unityの中でマップの緑を反転させると全実行が不合格になりました（平均誤差0.07〜0.19）。検証は配布しているインポーターをそのまま実行しています。メニュー名、既定値、セカンダリテクスチャの名前はUnityのマニュアルに従います。'],sources:[U_SECONDARY,U_LIGHT,U_RENDERER,U_PREPARE,U_NORMAL]}
  }
 },
 'game/normal-map-sprite-sheet':{
  type:'create',
  intent:{primary:'make a normal map for an animated sprite sheet without seams or flicker between frames',secondary:['per-frame normal map generation','frame border / edge handling','same layout as the colour sheet','animated lit sprite in Godot or Unity'],
   goal:'a normal-map sheet with the colour sheet\'s exact layout, each frame computed on its own with the same settings',input:'sprite sheet PNG (cut into frames in the Sprite workspace)',output:'_n.png sheet + Godot 4 scene with AnimationPlayer or Unity 6 rects + _NormalMap',target:'Godot 4, Unity 6 URP 2D, or any engine reading a normal sheet',support:'full',
   evidence:['src/game/normals/pipeline.js (regionsOf, baseHeight, normalMap per region; bleed 2 px)','src/game/normals/height.js (border "outside": the frame edge counts as transparent)','tests/normals.test.mjs (frames are independent)','src/game/normals/export.js (region_rect keys, Unity rects bottom-up)','docs/STUDIO-TEXTURE.md (adventurer 720×330, samurai 60 frames)'],
   external:['Unity manual: normal map must share the sprite UVs','Godot 4.7 2D lights and CanvasTexture']},
  en:{
   answer:'Give an animated sprite sheet its normal map frame by frame: each frame\'s relief is computed inside its own rectangle with the same settings in pixels, and the result is one normal-map sheet with exactly the colour sheet\'s layout. In Nerulio you cut the sheet in the Sprite workspace (grid or islands, then Apply), open the Texture tab, and export `_n.png` plus a Godot 4 scene whose AnimationPlayer steps through the frames, or a Unity 6 importer that sets the same sprite rects and attaches `_NormalMap`.',
   concept:{title:'What goes wrong at frame borders, and how per-frame generation avoids it',body:[
    'A normal map generator looks at neighbouring pixels. The slope kernel reads 1 px around each pixel (Pixel, Sobel, Scharr) or 2 px (Sobel 5×5), the bevel measures the distance to the nearest transparent pixel, and blurs reach further. Over a whole sheet all three cross frame borders: where two frames touch, the bevel treats the next frame\'s pixels as more body, and the kernel mixes both drawings in the border columns.',
    'Nerulio processes each frame region on its own. The kernels clamp at the region border (they repeat the frame\'s last pixel), the distance transform treats the frame edge as transparent, and blur never reads across it. Width, depth and strength are absolute pixels, never rescaled per frame, so a pose that repeats gets identical relief wherever it sits on the sheet; `tests/normals.test.mjs` checks that a frame\'s map does not depend on its neighbours and moves with the sprite.',
    'Outside the drawing each frame gets the flat normal (128, 128, 255) with full alpha, and the silhouette\'s normals are copied 2 px outward into the transparent area. When the engine filters or mipmaps the sheet, the texels next to the sprite\'s edge therefore hold plausible normals instead of nothing.',
    'Lights are stored in frame pixels, so the preview and the exported scene light every frame from the same relative position: the animation does not drift through the light as its region moves across the sheet.'],
    terms:[['Frame region','The rectangle of one frame on the sheet; all normal-map work stays inside it.'],['Clamp','An edge mode that repeats the last pixel instead of reading past the border.'],['Edge bleed','Copying edge normals into transparent pixels so filtering at the silhouette stays correct.']]},
   example:{title:'Example: a 720 × 330 sheet of 80 × 110 frames',lead:'The CC0 adventurer sheet from our Godot and Unity checks (720 × 330 is not a power of two):',lines:[
    '720 / 80 = 9 columns    330 / 110 = 3 rows    → 27 cells',
    'each region: bevel, kernel and blur run inside 80 × 110 only',
    'normal sheet: 720 × 330, same layout, saved as _n.png',
    '',
    'Godot  frame 10 = row 1, column 1 → region_rect Rect2(80, 110, 80, 110)',
    'Unity  rects count rows from the bottom: y = 330 − (110 + 110) = 110',
    '       row 0 → y = 220      row 2 → y = 0'],
    after:'In the Godot scene each frame is a key on `region_rect`, placed at the sum of the durations before it, and the Animation\'s length is the sum of all of them; one CanvasTexture holds the normal map for every frame.'},
   verify:{steps:[
    'Press ` to switch between the whole sheet and one frame: the frame\'s relief must look the same in both.',
    'Press Enter in the Lit view: if the relief flickers between two frames that look alike, compare them in the Height view; the difference is in the drawings, not in their neighbours.',
    'Open `_n.png` next to the colour sheet: the silhouettes line up pixel for pixel.',
    'In Godot, play the AnimationPlayer: `region_rect` advances one frame per key and the normals move with the sprite.']},
   trouble:{rows:[
    ['A straight bright ridge along one side of a frame','The drawing touches the frame edge, and the frame border counts as transparent, so a rim is built there','The ridge lies exactly on the frame border','Re-cut with room around the drawing, or flatten that strip with the Height brush'],
    ['The relief of one pose leaks into the next','The normal map was made from the whole sheet (another tool, or a sheet whose frames were never cut)','Texture workspace shows one region; the Frames panel is empty','Cut the frames in the Sprite workspace (see [[sprite-slicer|the sheet cutter]]) and regenerate'],
    ['Edges shimmer as the sprite moves in the engine','Bilinear filtering samples across frame borders of the normal sheet','Gone with Nearest / Point filtering','Nearest or Point for pixel art; for filtered art leave spacing between frames ([[atlas-padding|atlas padding]])'],
    ['Unity shows the wrong part of the sheet','The sheet was edited or resized after export, so the rects no longer fit','Sprite Editor rects against the PNG size','Export again and re-run Apply Texture JSON']]},
   alternatives:{rows:[
    ['Generate each frame separately in any tool and reassemble','A few frames and a tool you already use; you have to keep the layout identical by hand.'],
    ['Laigter\'s sheet splitting','Its app splits a sheet by frame count or grid size (release 1.12.0); how its bevel treats frame borders was not measured.'],
    ['Pack colour and normal atlases together (TexturePacker `--pack-normalmaps`)','Many sprites packed into one atlas: the Studio\'s Texture workspace works on one sheet, not on a packed multi-sprite atlas.']]},
   limits:['The Texture workspace does not cut frames; a sheet without frames is lit as one picture.','Near a region border in Wrap or Mirror mode the live brush preview can differ slightly until the exact recompute after the stroke.','Normal maps are not packed together with a multi-sprite atlas.'],
   versions:{body:['`tests/normals.test.mjs` shows that a frame\'s map does not depend on its neighbours and moves with the sprite. Godot 4.7.2 rendered the exported AnimationPlayer frames within 1/255, including the 60-frame samurai and the 720 × 330 adventurer; the same six cases passed 12 of 12 runs in Unity 6000.5.3f1. That the normal map must share the sprite\'s UVs is stated in the Unity manual.'],sources:[U_SECONDARY,G_CANVAS,G_LIGHTS]}
  },
  ko:{
   answer:'애니메이션 스프라이트 시트의 노멀맵은 프레임마다 만들어야 합니다. 각 프레임의 입체를 자기 사각형 안에서 픽셀 단위 같은 설정으로 계산하면, 색 시트와 배치가 똑같은 노멀맵 시트 한 장이 나옵니다. Nerulio에서는 스프라이트 작업 공간에서 시트를 자르고(격자나 덩어리, 그다음 Apply) 텍스처 탭을 연 뒤 `_n.png`와 함께, AnimationPlayer가 프레임을 넘기는 Godot 4 씬이나 같은 스프라이트 영역을 설정하고 `_NormalMap`을 붙이는 Unity 6 임포터를 내보냅니다.',
   concept:{title:'프레임 경계에서 생기는 문제와 프레임별 생성으로 피하는 방법',body:[
    '노멀맵 생성기는 이웃 픽셀을 봅니다. 기울기 커널은 픽셀 둘레 1px(Pixel·Sobel·Scharr)이나 2px(Sobel 5×5)을 읽고, 베벨은 가장 가까운 투명 픽셀까지 거리를 재며, 블러는 더 멀리 퍼집니다. 시트 전체에 돌리면 셋 다 프레임 경계를 넘습니다. 두 프레임이 맞닿은 곳에서는 베벨이 옆 프레임의 픽셀을 몸통의 연장으로 보고, 커널은 경계 열에서 두 그림을 섞습니다.',
    'Nerulio는 프레임 영역마다 따로 처리합니다. 커널은 영역 경계에서 멈추고(프레임의 마지막 픽셀을 반복), 거리 변환은 프레임 가장자리를 투명으로 보며, 블러는 경계를 넘어 읽지 않습니다. 폭·깊이·강도는 프레임마다 다시 맞추지 않는 절대 픽셀 값이라, 같은 포즈는 시트의 어디에 있든 같은 입체가 됩니다. `tests/normals.test.mjs`가 프레임의 맵이 이웃에 좌우되지 않고 스프라이트와 함께 움직이는지 확인합니다.',
    '그림 바깥에는 알파가 꽉 찬 평평한 노멀 (128, 128, 255)이 들어가고, 실루엣의 노멀은 투명한 곳으로 2px 복사됩니다. 그래서 엔진이 시트를 필터링하거나 밉맵을 만들 때 스프라이트 가장자리 옆 텍셀에 빈 값이 아니라 그럴듯한 노멀이 있습니다.',
    '조명은 프레임 픽셀 기준으로 저장되므로 미리보기와 내보낸 씬 모두 모든 프레임을 같은 상대 위치에서 비춥니다. 영역이 시트 위를 옮겨 다녀도 애니메이션이 조명 속을 흘러가지 않습니다.'],
    terms:[['프레임 영역','시트 위 프레임 하나의 사각형. 노멀맵 계산은 모두 그 안에서만 합니다.'],['Clamp','경계 너머를 읽지 않고 마지막 픽셀을 반복하는 가장자리 방식.'],['가장자리 번짐','가장자리 노멀을 투명 픽셀로 복사해 실루엣에서 필터링해도 올바르게 하는 처리.']]},
   example:{title:'예시: 80 × 110 프레임으로 된 720 × 330 시트',lead:'Godot·Unity 검증에 쓴 CC0 모험가 시트(720 × 330은 2의 거듭제곱이 아님):',lines:[
    '720 / 80 = 9열    330 / 110 = 3행    → 27칸',
    '영역마다: 베벨·커널·블러가 80 × 110 안에서만 동작',
    '노멀 시트: 720 × 330, 같은 배치, _n.png로 저장',
    '',
    'Godot  10번 프레임 = 1행 1열 → region_rect Rect2(80, 110, 80, 110)',
    'Unity  영역은 아래에서부터 셈: y = 330 − (110 + 110) = 110',
    '       0행 → y = 220      2행 → y = 0'],
    after:'Godot 씬에서 프레임은 `region_rect`의 키 하나이며 그 앞 프레임들의 길이를 더한 시점에 놓이고, 애니메이션 길이는 전체 길이의 합입니다. CanvasTexture 하나가 모든 프레임의 노멀맵을 담습니다.'},
   verify:{steps:[
    '` 키로 시트 전체와 프레임 하나를 오가 보세요. 그 프레임의 입체가 양쪽에서 같아야 합니다.',
    'Lit 보기에서 Enter를 누르세요. 비슷해 보이는 두 프레임 사이에서 입체가 깜박이면 높이 보기로 비교하세요. 차이는 이웃이 아니라 그림 자체에 있습니다.',
    '`_n.png`를 색 시트 옆에 열어 보면 실루엣이 픽셀 단위로 겹쳐야 합니다.',
    'Godot에서 AnimationPlayer를 재생하면 키마다 `region_rect`가 한 프레임씩 넘어가고 노멀도 스프라이트와 함께 움직입니다.']},
   trouble:{rows:[
    ['프레임 한쪽 변을 따라 곧은 밝은 능선이 생김','그림이 프레임 가장자리에 닿아 있고, 프레임 경계는 투명으로 간주되어 거기에 테두리가 만들어짐','능선이 프레임 경계와 정확히 겹침','그림 둘레에 여유를 두고 다시 자르거나, 높이 브러시로 그 줄을 평평하게'],
    ['한 포즈의 입체가 다음 포즈로 새어 들어감','노멀맵을 시트 전체로 만듦(다른 툴이거나 프레임을 자르지 않은 시트)','텍스처 작업 공간에 영역이 하나뿐이고 프레임 패널이 비어 있음','스프라이트 작업 공간에서 프레임을 자르고([[sprite-slicer|시트 자르기]] 참고) 다시 생성'],
    ['엔진에서 스프라이트가 움직일 때 가장자리가 반짝임','이중선형 필터가 노멀 시트의 프레임 경계 너머를 샘플링함','Nearest·Point 필터에서는 사라짐','도트는 Nearest·Point, 필터를 쓰는 그림은 프레임 사이에 간격 두기([[atlas-padding|아틀라스 여백]])'],
    ['Unity에서 시트의 엉뚱한 부분이 보임','내보낸 뒤 시트를 고치거나 크기를 바꿔 영역이 맞지 않음','Sprite Editor 영역과 PNG 크기 비교','다시 내보내고 Apply Texture JSON 재실행']]},
   alternatives:{rows:[
    ['아무 툴에서나 프레임을 하나씩 만들어 다시 합치기','프레임이 적고 이미 쓰는 툴이 있을 때. 배치를 손으로 똑같이 유지해야 합니다.'],
    ['Laigter의 시트 나누기','앱에서 프레임 수나 격자 크기로 시트를 나눕니다(1.12.0 릴리스). 베벨이 프레임 경계를 어떻게 다루는지는 측정하지 않았습니다.'],
    ['색·노멀 아틀라스를 함께 패킹(TexturePacker `--pack-normalmaps`)','여러 스프라이트를 아틀라스 하나로 패킹할 때. Studio 텍스처 작업 공간은 시트 한 장 단위이며 여러 스프라이트를 패킹한 아틀라스는 다루지 않습니다.']]},
   limits:['텍스처 작업 공간은 프레임을 자르지 않습니다. 프레임이 없는 시트는 그림 한 장으로 비춥니다.','Wrap·Mirror 모드에서 영역 경계 근처의 실시간 브러시 미리보기는 칠한 뒤 정확히 다시 계산될 때까지 조금 다를 수 있습니다.','노멀맵을 여러 스프라이트 아틀라스와 함께 패킹하지 않습니다.'],
   versions:{body:['`tests/normals.test.mjs`는 프레임의 맵이 이웃에 좌우되지 않고 스프라이트와 함께 움직임을 보여 줍니다. Godot 4.7.2는 60프레임 사무라이와 720 × 330 모험가를 포함해 내보낸 AnimationPlayer 프레임을 1/255 이내로 렌더했고, 같은 6개 사례가 Unity 6000.5.3f1에서 12회 중 12회 통과했습니다. 노멀맵이 스프라이트와 UV를 공유해야 한다는 점은 Unity 매뉴얼에 있습니다.'],sources:[U_SECONDARY,G_CANVAS,G_LIGHTS]}
  },
  ja:{
   answer:'アニメーションするスプライトシートのノーマルマップは、フレームごとに作ります。各フレームの立体を自分の矩形の中でピクセル単位の同じ設定で計算すれば、色のシートとまったく同じ配置のノーマルマップのシートが1枚できます。Nerulioではスプライト作業画面でシートを切り（グリッドか塊、そしてApply）、テクスチャタブを開き、`_n.png` と一緒に、AnimationPlayerがフレームを送るGodot 4のシーンか、同じスプライトの範囲を設定して `_NormalMap` を付けるUnity 6のインポーターを書き出します。',
   concept:{title:'フレームの境目で起きることと、フレームごとの生成で避ける方法',body:[
    'ノーマルマップの生成ツールは隣のピクセルを見ます。傾きのカーネルは各ピクセルの周り1px（Pixel・Sobel・Scharr）か2px（Sobel 5×5）を読み、面取りはいちばん近い透明ピクセルまでの距離を測り、ぼかしはさらに遠くまで広がります。シート全体にかけると3つとも境目を越えます。2つのフレームが接する所では、面取りが隣のフレームのピクセルを体の続きとみなし、カーネルは境目の列で2つの絵を混ぜます。',
    'Nerulioはフレームの領域ごとに別々に処理します。カーネルは領域の境目で止まり（フレームの最後のピクセルを繰り返す）、距離変換はフレームの縁を透明とみなし、ぼかしは境目を越えて読みません。幅・深さ・強さはフレームごとに合わせ直さない絶対ピクセル値なので、同じポーズはシートのどこにあっても同じ立体になります。`tests/normals.test.mjs` が、フレームのマップが隣に左右されず、スプライトと一緒に動くことを確かめています。',
    '絵の外側にはアルファ最大の平らな法線 (128, 128, 255) が入り、シルエットの法線は透明な所へ2px複製されます。そのため、エンジンがシートをフィルタリングしたりミップマップを作ったりしても、スプライトの縁の隣のテクセルには空ではなくもっともらしい法線があります。',
    'ライトはフレームのピクセル基準で保存されるので、プレビューでも書き出したシーンでも、すべてのフレームを同じ相対位置から照らします。領域がシートの上を移っても、アニメーションが光の中を流れていくことはありません。'],
    terms:[['フレームの領域','シート上のフレーム1つの矩形。ノーマルマップの計算はすべてその中だけで行います。'],['Clamp','境目の先を読まず、最後のピクセルを繰り返す縁の処理。'],['エッジブリード','縁の法線を透明ピクセルへ複製し、シルエットでフィルタリングしても正しく保つ処理。']]},
   example:{title:'具体例：80 × 110のフレームが並ぶ720 × 330のシート',lead:'GodotとUnityの検証に使ったCC0の冒険者のシート（720 × 330は2の累乗ではない）：',lines:[
    '720 / 80 = 9列    330 / 110 = 3行    → 27マス',
    '領域ごとに：面取り・カーネル・ぼかしは80 × 110の中だけで動く',
    'ノーマルのシート：720 × 330、同じ配置、_n.pngとして保存',
    '',
    'Godot  フレーム10 = 1行1列 → region_rect Rect2(80, 110, 80, 110)',
    'Unity  範囲は下から数える：y = 330 − (110 + 110) = 110',
    '       0行 → y = 220      2行 → y = 0'],
    after:'Godotのシーンでは、各フレームは `region_rect` のキー1つで、それより前のフレームの長さの合計の時刻に置かれ、アニメーションの長さは全フレームの長さの合計です。1つのCanvasTextureが全フレームのノーマルマップを持ちます。'},
   verify:{steps:[
    '` キーでシート全体と1フレームを切り替えます。そのフレームの立体がどちらでも同じに見えるはずです。',
    'Lit表示でEnterを押します。よく似た2つのフレームの間で立体がちらつくなら、高さ表示で比べてください。違いは隣ではなく絵そのものにあります。',
    '`_n.png` を色のシートの隣で開くと、シルエットがピクセル単位で重なるはずです。',
    'GodotでAnimationPlayerを再生すると、キーごとに `region_rect` が1フレームずつ進み、法線もスプライトと一緒に動きます。']},
   trouble:{rows:[
    ['フレームの一辺に沿ってまっすぐな明るい尾根が出る','絵がフレームの縁に触れており、フレームの境目は透明とみなされるのでそこに縁ができた','尾根がフレームの境目とぴったり重なる','絵の周りに余白を取って切り直すか、高さブラシでその帯を平らにする'],
    ['あるポーズの立体が次のポーズへ漏れる','ノーマルマップをシート全体から作った（別のツール、またはフレームを切っていないシート）','テクスチャ作業画面の領域が1つだけで、フレームパネルが空','スプライト作業画面でフレームを切り（[[sprite-slicer|シート分割]]を参照）、生成し直す'],
    ['エンジンでスプライトが動くと縁がちらつく','バイリニアフィルターがノーマルのシートのフレームの境目の先をサンプリングしている','Nearest・Pointフィルターでは消える','ドット絵はNearest・Point、フィルターを使う絵はフレーム間に間隔を空ける（[[atlas-padding|アトラスの余白]]）'],
    ['Unityでシートの違う部分が表示される','書き出し後にシートを編集・リサイズしたため範囲が合わない','Sprite Editorの範囲とPNGのサイズを比べる','書き出し直してApply Texture JSONを再実行']]},
   alternatives:{rows:[
    ['任意のツールでフレームを1枚ずつ作って組み直す','フレームが少なく、使い慣れたツールがあるとき。配置を手作業で同じに保つ必要があります。'],
    ['Laigterのシート分割','アプリでフレーム数かグリッドサイズでシートを分割できます（1.12.0リリース）。面取りがフレームの境目をどう扱うかは測定していません。'],
    ['色とノーマルのアトラスを一緒にパック（TexturePacker `--pack-normalmaps`）','多数のスプライトを1つのアトラスにパックするとき。Studioのテクスチャ作業画面はシート1枚単位で、複数スプライトをパックしたアトラスは扱いません。']]},
   limits:['テクスチャ作業画面はフレームを切りません。フレームのないシートは1枚の絵として照らします。','Wrap・Mirrorモードでは、領域の境目付近のブラシのライブプレビューが、描いた後の正確な再計算まで少し違うことがあります。','ノーマルマップを複数スプライトのアトラスと一緒にパックすることはしません。'],
   versions:{body:['`tests/normals.test.mjs` は、フレームのマップが隣に左右されず、スプライトと一緒に動くことを示しています。Godot 4.7.2は60フレームの侍と720 × 330の冒険者を含め、書き出したAnimationPlayerのフレームを1/255以内で描画し、同じ6ケースがUnity 6000.5.3f1で12回中12回合格しました。ノーマルマップがスプライトとUVを共有する必要があることはUnityのマニュアルに書かれています。'],sources:[U_SECONDARY,G_CANVAS,G_LIGHTS]}
  }
 },
//PAGE7
};
