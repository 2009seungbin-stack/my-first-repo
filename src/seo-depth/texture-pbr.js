/** Intent content for the texture-pbr pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: docs/TEXTURE-LAB.md (Lab pages: outputs MEASURED, engine import UNVERIFIED),
 * docs/STUDIO-TEXTURE.md (tiling seams: Studio Texture workspace, engine-verified), src/game/texture-*.js,
 * src/mask-packer.js, src/task/texture-lab*.js, src/task/mask-packer.js, src/game/normals/*.js.
 * Engine behaviour: the official docs cited in each page's `versions.sources` (checked 2026-09-28:
 * glTF 2.0 spec + schema, Unity 6 manual / URP 17 (Unity 6.0) / HDRP 17.1, Godot 4.7 docs, Godot 4.4
 * material.cpp, Unity-Technologies/Graphics CommonMaterial.hlsl). */
const S={
 gltf:'[glTF 2.0 specification (Khronos)](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)',
 gltfMR:'[glTF 2.0 schema: material.pbrMetallicRoughness](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json)',
 gltfMat:'[glTF 2.0 schema: material (normal, occlusion)](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json)',
 hdrpMask:'[Unity HDRP 17.1: Mask and detail maps](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html)',
 hdrpLit:'[Unity HDRP 17.1: Lit material Inspector reference](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/lit-material-inspector-reference.html)',
 urpLit:'[Unity 6 URP: Lit shader](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/lit-shader.html)',
 urpPacked:'[Unity 6 URP: Assign a channel-packed texture](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/shaders-in-universalrp-channel-packed-texture.html)',
 unityMetallic:'[Unity Manual: Metallic parameter (Standard Shader)](https://docs.unity3d.com/Manual/StandardShaderMaterialParameterMetallic.html)',
 unityImport:'[Unity 6 Manual: Default texture import settings](https://docs.unity3d.com/Manual/texture-type-default.html)',
 unityNormalImport:'[Unity 6 Manual: Normal map texture type](https://docs.unity3d.com/Manual/texture-type-normal-map.html)',
 unityNormal:'[Unity Manual: Normal map (bump mapping)](https://docs.unity3d.com/Manual/StandardShaderMaterialParameterNormalMap.html)',
 unitySmooth:'[Unity Graphics source: CommonMaterial.hlsl](https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.core/ShaderLibrary/CommonMaterial.hlsl)',
 godotStd:'[Godot 4.7 docs: Standard Material 3D and ORM Material 3D](https://docs.godotengine.org/en/stable/tutorials/3d/standard_material_3d.html)',
 godotOrm:'[Godot 4.7 docs: ORMMaterial3D](https://docs.godotengine.org/en/stable/classes/class_ormmaterial3d.html)',
 godotBase:'[Godot 4.7 docs: BaseMaterial3D](https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html)',
 godotImport:'[Godot 4.7 docs: Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)',
 godotShading:'[Godot 4.7 docs: Shading language (source_color)](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html)',
 godotSrc:'[Godot 4.4 source: scene/resources/material.cpp](https://github.com/godotengine/godot/blob/4.4/scene/resources/material.cpp)'
};
export default {
 // ------------------------------------------------------------------ Texture Lab (the whole set)
 'game/texture-lab':{
  type:'engine',
  intent:{primary:'check and prepare a PBR texture set so an engine reads every map correctly',secondary:['which maps are sRGB colour and which are linear data','packed channel layouts per engine (HDRP mask, URP metallic, ORM)','normal map convention','same size and power of two'],
   goal:'a material whose maps have the right role, size, channel layout and colour-space setting when imported into Unity, Godot or a glTF exporter',input:'the maps of one material (PNG for exact bytes; JPEG/WebP decoded by the browser)',output:'texture-report.json, channel PNGs, packed mask/ORM PNG, converted normal map, batch ZIP',target:'Unity 6 (URP/HDRP), Godot 4, glTF 2.0 — from their documentation; engine import not run',support:'partial',
   evidence:['docs/TEXTURE-LAB.md (Verification table: channel unpack max difference 0, ORM (10,80,220,255), OpenGL↔DirectX green only)','src/game/texture-set.js (roles, workflows, validation)','src/game/texture-presets.js (layouts + sources)','src/task/texture-lab.js (report fields)'],
   external:['glTF 2.0: base colour sRGB, metallic-roughness linear, occlusion R','Unity: sRGB (Color Texture), HDRP mask map, URP channel-packed texture','Godot 4.7: ORMMaterial3D, *_texture_channel, Normal Map Invert Y, source_color']},
  en:{
   answer:'A PBR material is several textures that have to agree: the same size, each map in the slot that expects it, colour maps imported as sRGB and data maps (normal, roughness, metallic, AO, height) as linear, packed channels in the order your engine reads, and a normal map in the engine\'s green-channel convention. Drop one material\'s maps into the Texture Lab: it sorts them by file name, checks the set against the workflow you choose (separate maps, Unity HDRP mask, Unity URP metallic, Godot ORM, Unreal ORM) and writes a JSON report with the number behind every issue. Its files are measured byte for byte; import into Unity, Unreal or Godot was not run.',
   concept:{title:'What a PBR set has to get right before import',body:[
    'Colour or data. Base colour (albedo) and emission are pictures authored in sRGB; the engine decodes them before lighting. Roughness, metallic, ambient occlusion, height and normal maps are numbers and must reach the shader unchanged, so they are imported as linear (non-colour) data. glTF 2.0 makes this normative: base colour RGB MUST use the sRGB transfer function, the metallic and roughness values MUST be linear. In Unity the switch is the importer\'s `sRGB (Color Texture)` checkbox; Godot\'s shading docs say colour textures get a `source_color` hint and normal, roughness, metallic and height textures do not.',
    'Packing. To save texture samples, engines read several grey maps from the channels of one RGBA image, and every engine picks its own order: Unity HDRP\'s Mask Map is R metallic, G AO, B detail mask, A smoothness; URP\'s channel-packed texture is R metallic, G occlusion, A smoothness; glTF 2.0 reads roughness from G and metallic from B, occlusion from R (so one image can serve as "ORM"); Godot\'s `ORMMaterial3D` uses the same R/G/B order, which the Godot 4.4 shader source states and the manual does not. Unity stores smoothness, which is 1 − roughness.',
    'Normals. Unity and Godot expect OpenGL-style normal maps (green = +Y, up). A DirectX-style map differs only in its green channel; the fix is 255 − g, not a re-bake. A single map cannot be measured to tell which one it is, so the Lab converts but does not guess.',
    'Why measure in the Lab rather than a canvas: a browser canvas stores pixels premultiplied, so every texel with alpha 0 comes back as (0, 0, 0, 0) and the packed bytes under it are gone. The Lab decodes PNG files itself (all non-interlaced colour types, 1–16 bit) and marks JPEG/WebP inputs "not byte-exact".'],
    terms:[['sRGB / linear','How the engine interprets the 0–255 values: sRGB values are decoded as colour (128 → about 0.216), linear values are used as they are (128 → 0.502).'],['Packed (channel-packed) texture','One RGBA image whose four channels hold four unrelated grey maps.'],['ORM','Occlusion in R, roughness in G, metallic in B — the glTF 2.0 channel order, also read by Godot\'s `ORMMaterial3D`.'],['Smoothness','Unity\'s inverse of roughness: smoothness = 1 − roughness (255 − value in 8 bits).']]},
   example:{title:'Example: an ambientCG brick set checked against three workflows',lead:'Four 1024 × 1024 PNGs from one ambientCG set. The roles come from the file names; the issues are what the Lab\'s validator returns (the roughness file is assumed saved as RGB with three equal channels):',lines:[
    'File                                     Role       Import as',
    'Bricks076C_1K-PNG_Color.png              albedo     sRGB',
    'Bricks076C_1K-PNG_Roughness.png          roughness  linear',
    'Bricks076C_1K-PNG_AmbientOcclusion.png   ao         linear',
    'Bricks076C_1K-PNG_Displacement.png       height     linear',
    '',
    'Separate maps (glTF / generic)   warn  missing-recommended  normal, metallic',
    '                                 info  gray-stored-as-rgb   Roughness.png (R = G = B)',
    'Unity HDRP mask map              error missing-required     mask map',
    '                                 warn  missing-recommended  normal',
    'Godot 4 ORM                      warn  missing-recommended  normal, orm'],
    after:'The set is fine for separate maps once you add the normal map (ambientCG ships `_NormalGL` for Unity and Godot and `_NormalDX`; add only one, or the Lab warns about a duplicate role). For HDRP the mask map is an error because HDRP has no separate metallic or AO slot; there is no "pack available" hint here because the set has no metallic map — a metallic of 0 has to come from a constant channel in the [[texture-mask-packer|mask packer]].'},
   outputs:{rows:[
    ['texture-report.json','The check report: per texture its role, size, power of two, exact PNG channels, colour type, bit depth, `srgbChunkPresent`, colour-space guidance, alpha and normal measurements; every issue with its id, level and numbers.'],
    ['rock-channels.zip','From the Channels stage: `rock-r-ao.png`, `rock-g-roughness.png` … one 8-bit grey PNG per channel, byte-identical to the source.'],
    ['rock-mask.png','From the Pack stage: grey maps packed in the chosen engine layout.'],
    ['rock-directx.png / rock-normal.png','From the Normal stage: a converted map, or a normal map generated from height.'],
    ['nerulio-textures.zip','From Export: every file resized (optional), edge-bled (optional) and encoded, in that order.']]},
   target:{title:'Use the checked set in Unity, Godot or glTF',lead:'Settings below follow the engines\' documentation; Nerulio did not run these imports.',steps:[
    'Unity: select every data texture (roughness, metallic, AO, mask map) and turn off `sRGB (Color Texture)` in the Inspector; keep it on for base colour and emission. HDRP additionally asks for Texture Type `Default` on the mask map.',
    'Unity normal maps: set Texture Type to `Normal map`. If the file is DirectX-style, tick `Flip Green Channel` in the same importer (Unity 6) or convert the file first.',
    'Unity URP Lit (Workflow Mode `Metallic`): assign the packed texture to Metallic Map and to Occlusion Map, and leave Smoothness › Source on `Metallic Alpha`. HDRP Lit: assign the mask map to Mask Map; the Metallic, Smoothness and AO Remapping sliders then appear.',
    'Godot 4: use an `ORMMaterial3D` for an ORM texture, or a `StandardMaterial3D` with separate maps. A packed texture of another layout still works in `StandardMaterial3D`: set `roughness_texture_channel`, `metallic_texture_channel` and `ao_texture_channel` to the channel that holds each map.',
    'Godot import: for a DirectX-style normal map enable Process › Normal Map Invert Y in the Import dock and click Reimport.',
    'glTF: put roughness in G and metallic in B of the metallicRoughness texture, occlusion in R (the same image may be referenced as the occlusion texture), and keep the normal map +Y up.']},
   verify:{steps:[
    'Drop the processed files back into the Lab and choose the same workflow: the report should show 0 errors, and the Channels stage should show each channel with the min/max you expect (a constant channel reads min = max).',
    'In the engine, look at a surface you know: a polished metal area should give a sharp highlight and a rough stone area a broad dull one. Everything glossy or everything matte usually means inverted roughness or a data map imported as sRGB.',
    'Put a light above the material: raised details should be lit on their upper edge. Lit from below means the normal map is in the other convention.']},
   trouble:{rows:[
    ['The whole material is too glossy or too matte','A data map was imported as sRGB (a value of 128 is read as about 0.216), or roughness sits where smoothness is expected','Importer: is `sRGB (Color Texture)` on for the roughness, metallic or mask map? Unpack the channel and compare it with the source','Turn sRGB off for data maps; invert roughness for Unity with [[game/roughness-to-smoothness|roughness → smoothness]]'],
    ['Metal or AO shows up in the wrong places after packing','The texture was packed in another engine\'s layout (glTF\'s G is roughness, HDRP\'s G is AO)','Open the packed file in the Channels stage with each layout preset and read the channel stats','Repack with the right preset in the [[texture-mask-packer|mask packer]]'],
    ['Bumps look like dents, or light seems to come from below','The normal map is in the other green-channel convention','Light from above: which edge of a bump is bright?','Convert with the [[game/normal-map-converter|normal map converter]], or use Unity\'s Flip Green Channel / Godot\'s Normal Map Invert Y'],
    ['URP material turns dark in its ambient light after assigning the packed texture to Occlusion','URP reads occlusion from G; Nerulio\'s URP preset writes G = 0','Channels stage: G reads min = max = 0','Do not assign it to Occlusion, or pack AO into G with a custom mapping'],
    ['Dark or light fringe around cut-out edges (leaves, decals)','RGB under alpha 0 is averaged into the edge by filtering and mipmaps','Fix › Mipmaps preview at 1/4 … 1/16','Bleed the edge colour with [[game/texture-edge-bleed|texture edge bleed]]'],
    ['`dimension-mismatch` error','One map was exported at another resolution','The issue lists every file with its size','Export all maps at one size; the Fix stage\'s power-of-two resize uses a quality resampler if you must resize']]},
   alternatives:{rows:[
    ['The engine\'s own texture importer','One or two maps whose layout you already know: you set sRGB, Texture Type and the normal-map flip there anyway, and no extra files are made.'],
    ['Your texturing application\'s export preset','The maps come from a painting tool: exporting straight into the engine\'s layout avoids a separate packing step. Godot\'s docs note that Substance Painter and ArmorPaint export ORM with their Unreal Engine preset.'],
    ['[[game/pbr-texture-validator|PBR texture validator]]','You only need the checklist (names, sizes, missing maps) and the JSON report, not the conversion stages.']]},
   limits:['The material preview is a one-light GGX approximation with flat ambient; judge lighting in the engine.','The Unreal ORM preset follows the glTF order, which Epic does not document as Unreal\'s own.'],
   versions:{body:['Measured on the Texture Lab (docs/TEXTURE-LAB.md): channel unpack byte-identical on R, G, B and A (max difference 0) with 2048 alpha-0 texels kept; the ORM preset over AO 10 / roughness 80 / metallic 220 wrote (10, 80, 220, 255); OpenGL ↔ DirectX differed exactly in green; the check report\'s `alpha.zeroPixels` matched the fixture. Import into Unity, Unreal or Godot was not attempted: the layouts come from the documentation below, and Godot\'s ORM order from its 4.4 engine source, read directly.'],
    sources:[S.gltf,S.hdrpMask,S.urpPacked,S.unityImport,S.godotStd,S.godotBase,S.godotImport,S.godotSrc]}
  },
  ko:{
   answer:'PBR 머티리얼은 서로 맞아야 하는 여러 장의 텍스처입니다. 크기가 같아야 하고, 맵마다 그 맵을 기대하는 슬롯에 들어가야 하며, 색 맵은 sRGB로, 데이터 맵(노멀·러프니스·메탈릭·AO·하이트)은 리니어로 가져와야 합니다. 패킹한 채널은 엔진이 읽는 순서여야 하고 노멀맵은 엔진의 초록 채널 규약을 따라야 합니다. 머티리얼 하나의 맵을 텍스처 랩에 넣으면 파일 이름으로 역할을 나누고, 고른 워크플로(개별 맵·Unity HDRP 마스크·Unity URP 메탈릭·Godot ORM·Unreal ORM)에 맞는지 점검해 문제마다 근거 수치를 JSON 보고서에 적습니다. 결과 파일은 바이트 단위로 측정했고, Unity·Unreal·Godot 가져오기는 실행하지 않았습니다.',
   concept:{title:'가져오기 전에 PBR 세트가 맞춰야 할 것',body:[
    '색인가, 데이터인가. 베이스 컬러(알베도)와 에미션은 sRGB로 그린 그림이라 엔진이 조명 계산 전에 디코딩합니다. 러프니스·메탈릭·앰비언트 오클루전·하이트·노멀맵은 숫자이므로 셰이더까지 그대로 가야 하고, 그래서 리니어(비색상) 데이터로 가져옵니다. glTF 2.0은 이를 규정으로 정해, 베이스 컬러 RGB는 반드시 sRGB 전달 함수를, 메탈릭·러프니스 값은 반드시 리니어를 쓰게 합니다. Unity에서는 임포터의 `sRGB (Color Texture)` 체크가 이 스위치이고, Godot 셰이딩 문서는 색 텍스처에만 `source_color` 힌트를 주고 노멀·러프니스·메탈릭·하이트에는 주지 않는다고 안내합니다.',
    '패킹. 엔진은 샘플링 횟수를 줄이려고 여러 회색 맵을 RGBA 한 장의 채널에서 읽는데, 순서는 엔진마다 다릅니다. Unity HDRP 마스크 맵은 R 메탈릭·G AO·B 디테일 마스크·A 스무스니스, URP 채널 패킹 텍스처는 R 메탈릭·G 오클루전·A 스무스니스입니다. glTF 2.0은 러프니스를 G, 메탈릭을 B, 오클루전을 R에서 읽으므로 한 장으로 "ORM"을 만들 수 있고, Godot `ORMMaterial3D`도 같은 R·G·B 순서를 쓰는데 이는 매뉴얼이 아니라 Godot 4.4 셰이더 소스에 적혀 있습니다. Unity는 러프니스 대신 1 − 러프니스인 스무스니스를 저장합니다.',
    '노멀. Unity와 Godot는 OpenGL 방식 노멀맵(초록 = +Y, 위쪽)을 기대합니다. DirectX 방식은 초록 채널만 다르며, 다시 구울 필요 없이 255 − g로 바뀝니다. 맵 한 장의 픽셀만으로는 어느 쪽인지 측정할 수 없어 랩은 변환만 하고 추측하지 않습니다.',
    '캔버스가 아니라 랩으로 재는 이유: 브라우저 캔버스는 픽셀을 미리 곱한(premultiplied) 상태로 보관하므로 알파가 0인 텍셀은 모두 (0, 0, 0, 0)으로 돌아오고 그 아래 패킹된 바이트는 사라집니다. 랩은 PNG를 직접 디코딩하며(인터레이스가 아닌 모든 색 형식, 1~16비트) JPEG·WebP 입력에는 "바이트 동일 아님"을 표시합니다.'],
    terms:[['sRGB / 리니어','엔진이 0~255 값을 읽는 방식. sRGB는 색으로 디코딩하고(128 → 약 0.216), 리니어는 그대로 씁니다(128 → 0.502).'],['채널 패킹 텍스처','네 채널에 서로 무관한 회색 맵 네 장을 담은 RGBA 이미지 한 장.'],['ORM','R 오클루전·G 러프니스·B 메탈릭. glTF 2.0의 채널 순서이며 Godot `ORMMaterial3D`도 이 순서로 읽습니다.'],['스무스니스','Unity가 쓰는 러프니스의 반대값. 스무스니스 = 1 − 러프니스(8비트로는 255 − 값).']]},
   example:{title:'예시: ambientCG 벽돌 세트를 세 워크플로로 점검',lead:'ambientCG 세트 하나의 1024 × 1024 PNG 네 장입니다. 역할은 파일 이름에서 나오고, 문제 목록은 랩의 검사기가 돌려주는 값입니다(러프니스 파일은 세 채널이 같은 RGB로 저장됐다고 가정).',lines:[
    '파일                                     역할       가져오기',
    'Bricks076C_1K-PNG_Color.png              albedo     sRGB',
    'Bricks076C_1K-PNG_Roughness.png          roughness  linear',
    'Bricks076C_1K-PNG_AmbientOcclusion.png   ao         linear',
    'Bricks076C_1K-PNG_Displacement.png       height     linear',
    '',
    '개별 맵 (glTF·공통)             warn  missing-recommended  normal, metallic',
    '                                 info  gray-stored-as-rgb   Roughness.png (R = G = B)',
    'Unity HDRP 마스크 맵             error missing-required     mask map',
    '                                 warn  missing-recommended  normal',
    'Godot 4 ORM                      warn  missing-recommended  normal, orm'],
    after:'노멀맵만 더하면 개별 맵 워크플로로는 문제가 없습니다(ambientCG는 Unity·Godot용 `_NormalGL`과 `_NormalDX`를 함께 주므로 하나만 넣으세요. 둘 다 넣으면 역할 중복 경고가 뜹니다). HDRP에는 메탈릭·AO 슬롯이 따로 없어 마스크 맵이 없으면 오류입니다. 이 세트에는 메탈릭 맵이 없어서 "패킹 가능" 안내도 나오지 않으며, 메탈릭 0은 [[texture-mask-packer|마스크 패커]]의 상수 채널로 채워야 합니다.'},
   outputs:{rows:[
    ['texture-report.json','점검 보고서: 텍스처마다 역할·크기·2의 거듭제곱 여부·정확한 PNG 채널 여부·색 형식·비트 깊이·`srgbChunkPresent`·색 공간 안내·알파와 노멀 측정값, 그리고 문제마다 id·수준·수치.'],
    ['rock-channels.zip','채널 단계 결과: `rock-r-ao.png`, `rock-g-roughness.png` 등 채널마다 8비트 회색 PNG 한 장, 원본과 바이트 동일.'],
    ['rock-mask.png','패킹 단계 결과: 고른 엔진 배치로 패킹한 회색 맵.'],
    ['rock-directx.png / rock-normal.png','노멀 단계 결과: 변환한 맵, 또는 하이트에서 만든 노멀맵.'],
    ['nerulio-textures.zip','내보내기 결과: 모든 파일을 (선택) 크기 변경 → (선택) 가장자리 번짐 → 인코딩 순서로 처리.']]},
   target:{title:'점검한 세트를 Unity·Godot·glTF에서 쓰기',lead:'아래 설정은 각 엔진 문서를 따른 것이며, Nerulio가 이 가져오기를 실행하지는 않았습니다.',steps:[
    'Unity: 데이터 텍스처(러프니스·메탈릭·AO·마스크 맵)를 모두 선택하고 인스펙터에서 `sRGB (Color Texture)`를 끕니다. 베이스 컬러와 에미션은 켠 채로 둡니다. HDRP는 마스크 맵의 Texture Type을 `Default`로 두라고 추가로 안내합니다.',
    'Unity 노멀맵: Texture Type을 `Normal map`으로 설정합니다. 파일이 DirectX 방식이면 같은 임포터의 `Flip Green Channel`(Unity 6)을 켜거나 먼저 파일을 변환합니다.',
    'Unity URP Lit(Workflow Mode `Metallic`): 패킹한 텍스처를 Metallic Map과 Occlusion Map에 지정하고 Smoothness › Source는 `Metallic Alpha`로 둡니다. HDRP Lit: 마스크 맵을 Mask Map에 지정하면 Metallic·Smoothness·AO Remapping 슬라이더가 나타납니다.',
    'Godot 4: ORM 텍스처는 `ORMMaterial3D`에, 개별 맵은 `StandardMaterial3D`에 씁니다. 다른 배치의 패킹 텍스처도 `StandardMaterial3D`에서 `roughness_texture_channel`·`metallic_texture_channel`·`ao_texture_channel`을 해당 채널로 지정하면 읽을 수 있습니다.',
    'Godot 가져오기: DirectX 방식 노멀맵은 가져오기 독에서 Process › Normal Map Invert Y를 켜고 Reimport를 누릅니다.',
    'glTF: metallicRoughness 텍스처의 G에 러프니스, B에 메탈릭, R에 오클루전을 넣고(같은 이미지를 오클루전 텍스처로 참조해도 됨) 노멀맵은 +Y 위쪽 규약으로 둡니다.']},
   verify:{steps:[
    '처리한 파일을 랩에 다시 넣고 같은 워크플로를 고릅니다. 보고서의 오류는 0이어야 하고, 채널 단계에서 각 채널의 최소·최대가 예상과 같아야 합니다(상수 채널은 최소 = 최대).',
    '엔진에서 잘 아는 표면을 봅니다. 연마한 금속은 날카로운 하이라이트, 거친 돌은 넓고 흐린 하이라이트여야 합니다. 전부 번들거리거나 전부 무광이면 대개 러프니스가 반전됐거나 데이터 맵을 sRGB로 가져온 것입니다.',
    '조명을 머티리얼 위쪽에 둡니다. 튀어나온 부분은 위쪽 가장자리가 밝아야 하며, 아래가 밝으면 노멀맵이 반대 규약입니다.']},
   trouble:{rows:[
    ['머티리얼 전체가 너무 번들거리거나 너무 무광','데이터 맵을 sRGB로 가져왔거나(128이 약 0.216으로 읽힘), 스무스니스 자리에 러프니스가 들어감','러프니스·메탈릭·마스크 맵의 `sRGB (Color Texture)`가 켜져 있는지 확인하고, 채널을 풀어 원본과 비교','데이터 맵은 sRGB를 끄고, Unity용은 [[game/roughness-to-smoothness|러프니스 → 스무스니스]]로 반전'],
    ['패킹 후 금속이나 AO가 엉뚱한 곳에 보임','다른 엔진의 배치로 패킹함(glTF의 G는 러프니스, HDRP의 G는 AO)','채널 단계에서 배치 프리셋을 바꿔 가며 채널 통계를 읽기','[[texture-mask-packer|마스크 패커]]에서 맞는 프리셋으로 다시 패킹'],
    ['튀어나온 곳이 들어가 보이거나 빛이 아래에서 오는 듯함','노멀맵이 초록 채널 규약이 반대','위에서 비출 때 요철의 어느 가장자리가 밝은지 확인','[[game/normal-map-converter|노멀맵 변환기]]로 바꾸거나 Unity의 Flip Green Channel·Godot의 Normal Map Invert Y 사용'],
    ['패킹 텍스처를 URP의 오클루전에도 지정하자 주변광이 어두워짐','URP는 G에서 오클루전을 읽는데 Nerulio의 URP 프리셋은 G에 0을 씀','채널 단계에서 G의 최소 = 최대 = 0','오클루전에 지정하지 않거나, 직접 배치로 G에 AO를 패킹'],
    ['잘라 낸 가장자리(잎·데칼)에 어둡거나 밝은 테두리','알파 0 아래의 RGB가 필터링과 밉맵으로 가장자리에 섞임','보정 › 밉맵 미리보기에서 1/4~1/16 확인','[[game/texture-edge-bleed|텍스처 가장자리 번짐]]으로 색을 채우기'],
    ['`dimension-mismatch` 오류','맵 하나를 다른 해상도로 내보냄','문제 항목에 파일마다 크기가 나옴','모든 맵을 같은 크기로 내보내기. 꼭 줄여야 하면 보정 단계의 2의 거듭제곱 변경이 품질 리샘플러를 씀']]},
   alternatives:{rows:[
    ['엔진 자체의 텍스처 임포터','배치를 이미 아는 맵 한두 장일 때. sRGB·Texture Type·노멀 반전은 어차피 거기서 정하며 파일이 늘지 않습니다.'],
    ['텍스처링 프로그램의 내보내기 프리셋','맵이 페인팅 도구에서 나올 때. 처음부터 엔진 배치로 내보내면 패킹 단계가 필요 없습니다. Godot 문서는 Substance Painter와 ArmorPaint가 Unreal Engine 프리셋으로 ORM을 내보낸다고 적고 있습니다.'],
    ['[[game/pbr-texture-validator|PBR 텍스처 검사기]]','변환 단계 없이 점검 목록(이름·크기·누락 맵)과 JSON 보고서만 필요할 때.']]},
   limits:['머티리얼 미리보기는 조명 하나와 균일한 주변광의 GGX 근사입니다. 조명 판단은 엔진에서 하세요.','Unreal ORM 프리셋은 glTF 순서를 따르며, Epic이 Unreal의 순서로 문서화한 것은 아닙니다.'],
   versions:{body:['텍스처 랩에서 측정한 값(docs/TEXTURE-LAB.md): 채널 분리가 R·G·B·A 모두 바이트 동일(최대 차이 0), 알파 0 텍셀 2048개 유지. ORM 프리셋에 AO 10 / 러프니스 80 / 메탈릭 220을 넣으면 (10, 80, 220, 255). OpenGL ↔ DirectX는 초록만 다름. 점검 보고서의 `alpha.zeroPixels`가 시험 파일과 일치. Unity·Unreal·Godot 가져오기는 시도하지 않았으며, 배치는 아래 문서에서, Godot ORM 순서는 4.4 엔진 소스를 직접 읽어 확인했습니다.'],
    sources:[S.gltf,S.hdrpMask,S.urpPacked,S.unityImport,S.godotStd,S.godotBase,S.godotImport,S.godotSrc]}
  },
  ja:{
   answer:'PBRマテリアルは、互いに整合していなければならない複数のテクスチャです。サイズがそろい、各マップがそれを期待するスロットに入り、色のマップはsRGB、データのマップ（ノーマル・ラフネス・メタリック・AO・ハイト）はリニアで読み込まれ、パックしたチャンネルはエンジンが読む順番で、ノーマルマップはエンジンの緑チャンネルの規約に合っている必要があります。1つのマテリアルのマップをテクスチャラボに入れると、ファイル名で役割を分け、選んだワークフロー（個別マップ・Unity HDRPマスク・Unity URPメタリック・Godot ORM・Unreal ORM）に合うかを確認し、問題ごとの根拠の数値をJSONレポートに書きます。出力はバイト単位で測定済みで、Unity・Unreal・Godotへの読み込みは実行していません。',
   concept:{title:'読み込む前にPBRセットがそろえるべきこと',body:[
    '色かデータか。ベースカラー（アルベド）とエミッションはsRGBで描かれた絵で、エンジンはライティングの前にデコードします。ラフネス・メタリック・アンビエントオクルージョン・ハイト・ノーマルマップは数値なので、そのままシェーダーに届く必要があり、リニア（非カラー）データとして読み込みます。glTF 2.0はこれを規定としており、ベースカラーのRGBはsRGB伝達関数、メタリックとラフネスの値はリニアでなければなりません。Unityではインポーターの`sRGB (Color Texture)`がこの切り替えで、Godotのシェーディング言語の文書は、色のテクスチャには`source_color`ヒントを付け、ノーマル・ラフネス・メタリック・ハイトには付けないと案内しています。',
    'パック。サンプリング回数を減らすため、エンジンは複数のグレーマップをRGBA 1枚のチャンネルから読みますが、順番はエンジンごとに違います。Unity HDRPのマスクマップはRメタリック・G AO・Bディテールマスク・Aスムースネス、URPのチャンネルパックテクスチャはRメタリック・Gオクルージョン・Aスムースネスです。glTF 2.0はラフネスをG、メタリックをB、オクルージョンをRから読むため、1枚で「ORM」にできます。Godotの`ORMMaterial3D`も同じR・G・Bの順ですが、それを書いているのはマニュアルではなくGodot 4.4のシェーダーのソースです。Unityはラフネスの代わりに、1 − ラフネスであるスムースネスを保存します。',
    'ノーマル。UnityとGodotはOpenGL方式のノーマルマップ（緑 = +Y、上向き）を期待します。DirectX方式は緑チャンネルだけが異なり、焼き直さなくても255 − gで直ります。1枚のマップのピクセルだけではどちらか測定できないため、ラボは変換だけを行い、推測はしません。',
    'Canvasではなくラボで測る理由：ブラウザのCanvasはピクセルを乗算済み（premultiplied）で保持するため、アルファ0のテクセルはすべて(0, 0, 0, 0)として返り、その下にパックされたバイトは消えます。ラボはPNGを自前でデコードし（インターレース以外の全カラー形式、1〜16ビット）、JPEG・WebPの入力には「バイト一致ではない」と表示します。'],
    terms:[['sRGB / リニア','エンジンが0〜255の値をどう解釈するか。sRGBは色としてデコード（128 → 約0.216）、リニアはそのまま使用（128 → 0.502）。'],['チャンネルパックテクスチャ','4つのチャンネルに互いに無関係なグレーマップ4枚を入れたRGBA画像1枚。'],['ORM','Rオクルージョン・Gラフネス・Bメタリック。glTF 2.0のチャンネル順で、Godotの`ORMMaterial3D`もこの順で読みます。'],['スムースネス','Unityが使うラフネスの逆値。スムースネス = 1 − ラフネス（8ビットでは255 − 値）。']]},
   example:{title:'例：ambientCGのレンガのセットを3つのワークフローで確認',lead:'ambientCGの1セットに含まれる1024 × 1024のPNG 4枚です。役割はファイル名から決まり、問題の一覧はラボの検証が返す結果です（ラフネスのファイルは3チャンネルが等しいRGBで保存されていると仮定）。',lines:[
    'ファイル                                 役割       読み込み',
    'Bricks076C_1K-PNG_Color.png              albedo     sRGB',
    'Bricks076C_1K-PNG_Roughness.png          roughness  linear',
    'Bricks076C_1K-PNG_AmbientOcclusion.png   ao         linear',
    'Bricks076C_1K-PNG_Displacement.png       height     linear',
    '',
    '個別マップ（glTF・汎用）         warn  missing-recommended  normal, metallic',
    '                                 info  gray-stored-as-rgb   Roughness.png (R = G = B)',
    'Unity HDRPマスクマップ           error missing-required     mask map',
    '                                 warn  missing-recommended  normal',
    'Godot 4 ORM                      warn  missing-recommended  normal, orm'],
    after:'ノーマルマップを足せば、個別マップのワークフローでは問題ありません（ambientCGはUnity・Godot向けの`_NormalGL`と`_NormalDX`の両方を配布しているので、片方だけ入れてください。両方入れると役割の重複の警告が出ます）。HDRPにはメタリックやAOの個別スロットがないため、マスクマップがないとエラーです。このセットにはメタリックがないので「パック可能」の案内も出ず、メタリック0は[[texture-mask-packer|マスクパッカー]]の定数チャンネルで埋める必要があります。'},
   outputs:{rows:[
    ['texture-report.json','チェックレポート：テクスチャごとの役割・サイズ・2のべき乗か・PNGチャンネルが厳密か・カラー形式・ビット深度・`srgbChunkPresent`・色空間の案内・アルファとノーマルの測定値、問題ごとのid・レベル・数値。'],
    ['rock-channels.zip','チャンネルステージの結果：`rock-r-ao.png`、`rock-g-roughness.png`などチャンネルごとに8ビットのグレーPNG 1枚、元とバイト一致。'],
    ['rock-mask.png','パックステージの結果：選んだエンジン配置でパックしたグレーマップ。'],
    ['rock-directx.png / rock-normal.png','ノーマルステージの結果：変換したマップ、またはハイトから作ったノーマルマップ。'],
    ['nerulio-textures.zip','書き出しの結果：全ファイルを（任意）リサイズ → （任意）エッジブリード → エンコードの順で処理。']]},
   target:{title:'確認したセットをUnity・Godot・glTFで使う',lead:'以下の設定は各エンジンのドキュメントに従ったもので、Nerulioがこの読み込みを実行したわけではありません。',steps:[
    'Unity：データのテクスチャ（ラフネス・メタリック・AO・マスクマップ）をすべて選び、インスペクターで`sRGB (Color Texture)`をオフにします。ベースカラーとエミッションはオンのままです。HDRPはマスクマップのTexture Typeを`Default`にするよう追加で案内しています。',
    'Unityのノーマルマップ：Texture Typeを`Normal map`にします。DirectX方式のファイルなら、同じインポーターの`Flip Green Channel`（Unity 6）をオンにするか、先にファイルを変換します。',
    'Unity URPのLit（Workflow Mode `Metallic`）：パックしたテクスチャをMetallic MapとOcclusion Mapに割り当て、Smoothness › Sourceは`Metallic Alpha`のままにします。HDRPのLit：マスクマップをMask Mapに割り当てると、Metallic・Smoothness・AOのRemappingスライダーが現れます。',
    'Godot 4：ORMテクスチャは`ORMMaterial3D`、個別マップは`StandardMaterial3D`で使います。別の配置のパックテクスチャも、`StandardMaterial3D`で`roughness_texture_channel`・`metallic_texture_channel`・`ao_texture_channel`を該当チャンネルにすれば読めます。',
    'Godotのインポート：DirectX方式のノーマルマップは、インポートドックでProcess › Normal Map Invert Yをオンにして再インポートします。',
    'glTF：metallicRoughnessテクスチャのGにラフネス、Bにメタリック、Rにオクルージョンを入れ（同じ画像をオクルージョンテクスチャとして参照してよい）、ノーマルマップは+Y上向きの規約にします。']},
   verify:{steps:[
    '処理したファイルをラボに入れ直し、同じワークフローを選びます。レポートのエラーは0で、チャンネルステージの各チャンネルの最小・最大が想定どおりのはずです（定数のチャンネルは最小 = 最大）。',
    'エンジンで性質を知っている面を見ます。磨いた金属は鋭いハイライト、粗い石は広くにぶいハイライトになるはずです。全体がてかる、または全体がつや消しなら、たいていラフネスの反転か、データマップをsRGBで読み込んだのが原因です。',
    'ライトをマテリアルの上に置きます。盛り上がった部分は上側の縁が明るいはずで、下側が明るければノーマルマップの規約が逆です。']},
   trouble:{rows:[
    ['マテリアル全体がてかりすぎ、またはつや消しすぎ','データマップをsRGBで読み込んだ（128が約0.216になる）、またはスムースネスの位置にラフネスが入っている','ラフネス・メタリック・マスクマップの`sRGB (Color Texture)`がオンか確認し、チャンネルを分解して元と比較','データマップはsRGBをオフに。Unity向けは[[game/roughness-to-smoothness|ラフネス → スムースネス]]で反転'],
    ['パック後に金属やAOが違う場所に出る','別のエンジンの配置でパックした（glTFのGはラフネス、HDRPのGはAO）','チャンネルステージで配置のプリセットを切り替えてチャンネルの統計を読む','[[texture-mask-packer|マスクパッカー]]で正しいプリセットでパックし直す'],
    ['凸が凹に見える、光が下から当たっているように見える','ノーマルマップの緑チャンネルの規約が逆','上から照らしたとき、凹凸のどちらの縁が明るいか','[[game/normal-map-converter|ノーマルマップ変換]]で変換するか、UnityのFlip Green Channel・GodotのNormal Map Invert Yを使う'],
    ['パックテクスチャをURPのオクルージョンにも割り当てたら環境光で暗くなった','URPはGからオクルージョンを読むが、NerulioのURPプリセットはGに0を書く','チャンネルステージでGの最小 = 最大 = 0','オクルージョンに割り当てないか、手動の割り当てでGにAOをパックする'],
    ['切り抜いた縁（葉・デカール）に暗い、または明るいふち','アルファ0の下のRGBがフィルタリングとミップマップで縁に混ざる','補正 › ミップマップのプレビューで1/4〜1/16を見る','[[game/texture-edge-bleed|テクスチャのエッジブリード]]で色を埋める'],
    ['`dimension-mismatch`のエラー','1枚だけ別の解像度で書き出した','問題の項目にファイルごとのサイズが出る','全マップを同じサイズで書き出す。どうしても縮めるなら補正ステージの2のべき乗リサイズが高品質リサンプラーを使う']]},
   alternatives:{rows:[
    ['エンジン自体のテクスチャインポーター','配置が分かっているマップ1〜2枚のとき。sRGB・Texture Type・ノーマルの反転はどのみちそこで設定し、ファイルも増えません。'],
    ['テクスチャリングソフトの書き出しプリセット','マップがペイントツールから来るとき。最初からエンジンの配置で書き出せばパックの手順が要りません。Godotの文書には、Substance PainterとArmorPaintがUnreal EngineプリセットでORMを書き出せるとあります。'],
    ['[[game/pbr-texture-validator|PBRテクスチャ バリデーター]]','変換ステージは不要で、チェック項目（名前・サイズ・不足マップ）とJSONレポートだけが欲しいとき。']]},
   limits:['マテリアルプレビューはライト1灯と一様な環境光によるGGXの近似です。ライティングの判断はエンジンで行ってください。','Unreal ORMプリセットはglTFの順序に従っており、EpicがUnrealの順序として文書化したものではありません。'],
   versions:{body:['テクスチャラボで測定した値（docs/TEXTURE-LAB.md）：チャンネル分解はR・G・B・Aすべてでバイト一致（最大差0）、アルファ0のテクセル2048個を保持。ORMプリセットにAO 10 / ラフネス 80 / メタリック 220を入れると(10, 80, 220, 255)。OpenGL ↔ DirectXは緑だけが異なる。チェックレポートの`alpha.zeroPixels`がテスト用ファイルと一致。Unity・Unreal・Godotへの読み込みは試しておらず、配置は下記のドキュメント、GodotのORMの順序は4.4のエンジンソースを直接読んで確認しました。'],
    sources:[S.gltf,S.hdrpMask,S.urpPacked,S.unityImport,S.godotStd,S.godotBase,S.godotImport,S.godotSrc]}
  }
 },
 // ------------------------------------------------------------------ Channel unpacker
 'game/channel-unpacker':{
  type:'conversion',
  intent:{primary:'split a packed texture (ORM, mask map, RGBA) into separate grey maps',secondary:['which channel is what in HDRP, URP, glTF and Godot','keep the bytes under transparent texels','roughness ↔ smoothness while unpacking','move a packed texture from one engine layout to another'],
   goal:'one exact 8-bit grey PNG per channel, labelled with its meaning in the chosen engine layout, ready to use or to repack',input:'a packed PNG (JPEG/WebP work but are marked not byte-exact)',output:'NAME-r/g/b/a-ROLE.png grey PNGs, or NAME-channels.zip',target:'Godot 4 StandardMaterial3D / ORMMaterial3D, Unity URP/HDRP, glTF 2.0 (documentation; engine import not run)',support:'partial',
   evidence:['docs/TEXTURE-LAB.md (channel unpack max difference 0 on R, G, B, A; 2048 alpha-0 texels; mode L 64×64)','src/game/texture-channels.js (extractChannel, invertPlane)','src/task/texture-lab-maps.js (saveChannels file names)','src/game/texture-presets.js'],
   external:['Unity HDRP mask map table','Unity URP channel-packed texture table','glTF 2.0 metallicRoughness/occlusion channels','Godot BaseMaterial3D *_texture_channel defaults']},
  en:{
   answer:'A packed texture keeps up to four unrelated grey maps in its R, G, B and A channels — an ORM texture holds occlusion, roughness and metallic in R, G and B; a Unity HDRP mask map holds metallic, AO, detail mask and smoothness. Splitting it means writing each channel to its own single-channel image without changing a byte. The Channel Unpacker reads the PNG itself, labels each channel for the layout you pick (HDRP, URP, glTF, Godot ORM, Unreal ORM), can invert a channel (smoothness ↔ roughness) and saves 8-bit grey PNGs that are byte-identical to the source, including under fully transparent texels.',
   concept:{title:'What is inside a packed texture, and why the order matters',body:[
    'Each channel of a packed texture is an independent 0–255 number per texel, not part of a colour. Viewed as a picture it shows odd colours; only the layout tells you that G means roughness (glTF, Godot ORM), ambient occlusion (Unity HDRP) or occlusion (Unity URP). The file name rarely tells the order: `_ORM`, `_ARM`, `_MaskMap` and `_packed` all just say "packed", so the Lab classifies them all as a packed map and lets you choose the layout.',
    'The alpha channel is where tools lose data. In a Unity mask map, a fully rough texel has smoothness 0, which is alpha 0. A browser canvas stores pixels premultiplied, so that texel\'s metallic, AO and detail bytes come back as 0. The Unpacker decodes PNG files with its own reader (all non-interlaced colour types, bit depths 1–16, `tRNS`) and writes each channel as a colour-type-0 PNG, one byte per texel, with no colour conversion.',
    'Inverting is exact: the saved plane is 255 − value, and inverting twice returns the original bytes. That is how a Unity smoothness channel becomes the roughness another engine wants.'],
    terms:[['Channel plane','The w × h bytes of one channel, saved as a greyscale PNG.'],['Premultiplied alpha','Colour stored already multiplied by alpha; at alpha 0 every colour becomes 0, so packed bytes there are lost.'],['Mask map','Unity HDRP\'s packed texture: R metallic, G ambient occlusion, B detail mask, A smoothness.'],['16-bit input','Accepted; the Lab keeps the high byte of each sample. Output is always 8-bit.']]},
   example:{title:'Example: one texel of an HDRP mask map',lead:'A fully rough metal texel with AO 200 and no detail mask. Its smoothness is 0, so its alpha is 0:',lines:[
    'Source texel (crate_MaskMap.png)   R 255   G 200   B 0   A 0',
    'Read through a browser canvas      R 0     G 0     B 0   A 0     (premultiplied: colour × 0)',
    'Read by the Lab\'s PNG decoder      R 255   G 200   B 0   A 0',
    '',
    'Saved with the Unity HDRP layout, A inverted:',
    '  crate_MaskMap-r-metallic.png                 255',
    '  crate_MaskMap-g-ao.png                       200',
    '  crate_MaskMap-b-detail.png                   0',
    '  crate_MaskMap-a-inverted-smoothness.png      255   (255 − 0: roughness)'],
    after:'The inverted file keeps the channel\'s layout name (`smoothness`) with `inverted-` in front, so its content is roughness. Rename it if another tool picks maps by file name.'},
   mapping:{title:'Which channel holds what, per layout',head:['Channel','Unity HDRP Mask Map','glTF 2.0 / Godot ORM','Unity URP channel-packed'],rows:[
    ['R','Metallic','Occlusion','Metallic'],
    ['G','Ambient occlusion','Roughness','Occlusion'],
    ['B','Detail mask (HDRP only)','Metallic','Not used'],
    ['A','Smoothness — invert for roughness','Not used','Smoothness — invert for roughness']],
    note:'The Built-in Standard shader\'s metallic map reads only R (metallic) and A (smoothness). Nerulio\'s "Unity URP / Built-in" preset follows that page and labels G "ignored"; Unity\'s URP page reads occlusion from G when the same texture is also assigned to Occlusion.'},
   outputs:{rows:[
    ['crate_MaskMap-r-metallic.png … -a-smoothness.png','One 8-bit grey PNG per channel (colour type 0), named `file-channel-role`; `inverted-` is added before the role when you inverted it.'],
    ['crate_MaskMap-channels.zip','All four channel PNGs in one archive (Save all four channels).']]},
   target:{title:'Move a packed texture to another engine\'s layout',lead:'Example: a Unity HDRP mask map going to Godot 4 or glTF. The engine settings follow their documentation; Nerulio did not run the imports.',steps:[
    'Open the packed PNG and set Read channels as to the layout it came from (here Unity HDRP Mask Map). Check the channel stats: a channel with min = max is a constant filler.',
    'Click Invert on A so smoothness becomes roughness, then Save all four channels (ZIP).',
    'Godot 4 with separate maps: in a `StandardMaterial3D` assign the roughness, metallic and AO PNGs to their texture slots (enable Ambient Occlusion first). Each slot\'s `*_texture_channel` defaults to Red, which a grey PNG satisfies.',
    'Godot `ORMMaterial3D` or glTF: repack AO, roughness and metallic with the ORM preset in the [[texture-mask-packer|mask packer]] (R occlusion, G roughness, B metallic).',
    'Unity: import every grey PNG or repacked texture with `sRGB (Color Texture)` off. URP and HDRP have no separate roughness slot, so pack metallic and smoothness again rather than using the planes one by one.']},
   verify:{steps:[
    'Repack the planes with the layout you unpacked them with and unpack the result: every channel should read the same min, max, mean and unique-value count as before (the Lab measured max difference 0).',
    'Open a saved PNG in any image tool: it is a single-channel 8-bit grey image at full resolution, not an RGB copy.',
    'For an inverted plane, a texel that read v before reads 255 − v after (the stage shows the in → out pair side by side).']},
   trouble:{rows:[
    ['A channel is black wherever the texture is transparent (in another tool)','That tool read the file through premultiplied alpha','Open the same PNG in the Channels stage: the bytes are there','Unpack in the Lab, and keep packed data out of tools that use a canvas'],
    ['The file is marked "decoded by the browser (not byte-exact)"','JPEG or WebP input; JPEG compression also mixes channels','The file list and the report (`exactChannels: false`)','Unpack the PNG the texture was made from'],
    ['The unpacked "AO" looks like roughness, or metallic looks noisy','The wrong layout is selected (G is AO in HDRP, roughness in glTF)','Switch Read channels as and compare the stats and previews','Pick the layout of the program that exported the texture'],
    ['Roughness looks inverted in the target engine','The source channel was smoothness (Unity) and was not inverted','Its file name has no `inverted-`','Click Invert on that channel and save again'],
    ['A 16-bit texture loses precision','Output is 8-bit; the high byte of each sample is kept','Bit depth in the report','Use a 16-bit capable editor when you need 16-bit planes']]},
   alternatives:{rows:[
    ['Keep the texture packed','Godot\'s `StandardMaterial3D` can read each map from a chosen channel (`roughness_texture_channel`, `metallic_texture_channel`, `ao_texture_channel`), so no split is needed when the order is simply different.'],
    ['An image editor\'s channel split','Opaque textures with no alpha-0 texels, when you are already in that editor; check the alpha area before trusting it with a mask map.'],
    ['[[game/roughness-to-smoothness|Roughness to smoothness]]','You only need one inverted grey map for Unity.']]},
   versions:{body:['Measured on the Texture Lab (docs/TEXTURE-LAB.md): a 64×64 ORM of random bytes unpacked with max difference 0 on R, G, B and A; all 2048 alpha-0 texels kept their RGB (an explicit (1, 2, 3, 0) corner came back with R = 1); the files re-opened in Pillow as mode `L`, 64×64; the inverted roughness plane equalled 255 − roughness exactly. The layouts are the engines\' documented ones listed below (Godot\'s ORM order from its engine source); nothing was imported into an engine.'],
    sources:[S.hdrpMask,S.urpPacked,S.unityMetallic,S.gltfMR,S.godotBase,S.godotSrc]}
  },
  ko:{
   answer:'채널 패킹 텍스처는 서로 무관한 회색 맵을 최대 네 장까지 R·G·B·A 채널에 담습니다. ORM 텍스처는 R·G·B에 오클루전·러프니스·메탈릭을, Unity HDRP 마스크 맵은 메탈릭·AO·디테일 마스크·스무스니스를 담습니다. 분리한다는 것은 채널마다 바이트 하나 바꾸지 않고 단일 채널 이미지로 쓰는 일입니다. 채널 분리기는 PNG를 직접 읽어 고른 배치(HDRP·URP·glTF·Godot ORM·Unreal ORM)에 따라 채널에 이름을 붙이고, 채널을 반전(스무스니스 ↔ 러프니스)할 수 있으며, 완전히 투명한 텍셀 아래까지 원본과 바이트가 같은 8비트 회색 PNG로 저장합니다.',
   concept:{title:'패킹 텍스처 안에 든 것과 순서가 중요한 이유',body:[
    '패킹 텍스처의 각 채널은 텍셀마다 독립된 0~255 숫자이지 색의 일부가 아닙니다. 그림으로 보면 이상한 색으로 보이고, G가 러프니스(glTF·Godot ORM)인지 앰비언트 오클루전(Unity HDRP)인지 오클루전(Unity URP)인지는 배치를 알아야 압니다. 파일 이름으로는 순서를 알기 어렵습니다. `_ORM`·`_ARM`·`_MaskMap`·`_packed`는 모두 "패킹됨"이라는 뜻일 뿐이라, 랩은 모두 패킹 맵으로 분류하고 배치는 직접 고르게 합니다.',
    '데이터를 잃는 곳은 알파 채널입니다. Unity 마스크 맵에서 완전히 거친 텍셀은 스무스니스가 0, 곧 알파가 0입니다. 브라우저 캔버스는 픽셀을 미리 곱해 보관하므로 그 텍셀의 메탈릭·AO·디테일 바이트가 0으로 돌아옵니다. 분리기는 자체 리더로 PNG를 디코딩하고(인터레이스가 아닌 모든 색 형식, 1~16비트, `tRNS`) 채널마다 색 변환 없이 텍셀당 1바이트인 색 형식 0 PNG로 씁니다.',
    '반전은 정확합니다. 저장되는 값은 255 − 값이며, 두 번 반전하면 원래 바이트로 돌아옵니다. Unity의 스무스니스 채널은 이렇게 다른 엔진이 원하는 러프니스가 됩니다.'],
    terms:[['채널 평면','한 채널의 w × h 바이트. 회색 PNG로 저장됩니다.'],['미리 곱한 알파','알파를 이미 곱한 색. 알파 0에서는 모든 색이 0이 되어 그 자리의 패킹 바이트가 사라집니다.'],['마스크 맵','Unity HDRP의 패킹 텍스처. R 메탈릭·G 앰비언트 오클루전·B 디테일 마스크·A 스무스니스.'],['16비트 입력','받을 수 있으며 샘플마다 상위 바이트를 씁니다. 출력은 항상 8비트입니다.']]},
   example:{title:'예시: HDRP 마스크 맵의 텍셀 하나',lead:'AO가 200이고 디테일 마스크가 없는, 완전히 거친 금속 텍셀입니다. 스무스니스가 0이라 알파도 0입니다.',lines:[
    '원본 텍셀 (crate_MaskMap.png)      R 255   G 200   B 0   A 0',
    '브라우저 캔버스로 읽음             R 0     G 0     B 0   A 0     (미리 곱함: 색 × 0)',
    '랩의 PNG 디코더로 읽음             R 255   G 200   B 0   A 0',
    '',
    'Unity HDRP 배치로 저장, A 반전:',
    '  crate_MaskMap-r-metallic.png                 255',
    '  crate_MaskMap-g-ao.png                       200',
    '  crate_MaskMap-b-detail.png                   0',
    '  crate_MaskMap-a-inverted-smoothness.png      255   (255 − 0: 러프니스)'],
    after:'반전한 파일은 배치상의 이름(`smoothness`) 앞에 `inverted-`가 붙으므로 내용은 러프니스입니다. 다른 도구가 파일 이름으로 맵을 고른다면 이름을 바꾸세요.'},
   mapping:{title:'배치별로 채널에 든 것',head:['채널','Unity HDRP 마스크 맵','glTF 2.0 / Godot ORM','Unity URP 채널 패킹'],rows:[
    ['R','메탈릭','오클루전','메탈릭'],
    ['G','앰비언트 오클루전','러프니스','오클루전'],
    ['B','디테일 마스크(HDRP 전용)','메탈릭','사용 안 함'],
    ['A','스무스니스 — 반전하면 러프니스','사용 안 함','스무스니스 — 반전하면 러프니스']],
    note:'내장 Standard 셰이더의 메탈릭 맵은 R(메탈릭)과 A(스무스니스)만 읽습니다. Nerulio의 "Unity URP·내장" 프리셋은 이 문서를 따라 G를 "무시됨"으로 표시하며, Unity URP 문서는 같은 텍스처를 Occlusion에도 지정하면 G에서 오클루전을 읽는다고 적고 있습니다.'},
   outputs:{rows:[
    ['crate_MaskMap-r-metallic.png … -a-smoothness.png','채널마다 8비트 회색 PNG(색 형식 0) 한 장. 이름은 `파일-채널-역할`이며, 반전했으면 역할 앞에 `inverted-`가 붙습니다.'],
    ['crate_MaskMap-channels.zip','네 채널 PNG를 한 압축 파일로(네 채널 모두 저장).']]},
   target:{title:'패킹 텍스처를 다른 엔진 배치로 옮기기',lead:'예: Unity HDRP 마스크 맵을 Godot 4나 glTF로 옮기는 경우. 엔진 설정은 각 문서를 따른 것이며 Nerulio가 가져오기를 실행하지는 않았습니다.',steps:[
    '패킹된 PNG를 열고 "채널 해석"을 원래 배치(여기서는 Unity HDRP 마스크 맵)로 정합니다. 채널 통계를 보세요. 최소 = 최대인 채널은 상수로 채운 것입니다.',
    'A의 "반전"을 눌러 스무스니스를 러프니스로 바꾼 뒤 "네 채널 모두 저장 (ZIP)"을 누릅니다.',
    'Godot 4에서 개별 맵으로 쓰기: `StandardMaterial3D`의 텍스처 슬롯에 러프니스·메탈릭·AO PNG를 지정합니다(Ambient Occlusion은 먼저 켭니다). 슬롯마다 `*_texture_channel` 기본값이 Red라 회색 PNG는 그대로 읽힙니다.',
    'Godot `ORMMaterial3D`나 glTF: [[texture-mask-packer|마스크 패커]]에서 ORM 프리셋(R 오클루전·G 러프니스·B 메탈릭)으로 AO·러프니스·메탈릭을 다시 패킹합니다.',
    'Unity: 회색 PNG나 다시 패킹한 텍스처는 모두 `sRGB (Color Texture)`를 끄고 가져옵니다. URP·HDRP에는 러프니스 슬롯이 따로 없으므로 평면을 하나씩 쓰지 말고 메탈릭과 스무스니스를 다시 패킹하세요.']},
   verify:{steps:[
    '분리할 때와 같은 배치로 평면들을 다시 패킹하고 그 결과를 분리합니다. 채널마다 최소·최대·평균·고유값 개수가 전과 같아야 합니다(랩 측정: 최대 차이 0).',
    '저장한 PNG를 아무 이미지 도구로 엽니다. RGB 복사본이 아니라 원본 해상도의 단일 채널 8비트 회색 이미지여야 합니다.',
    '반전한 평면은 전에 v였던 텍셀이 255 − v여야 합니다(단계 화면에 원본 → 결과가 나란히 보입니다).']},
   trouble:{rows:[
    ['다른 도구에서 텍스처가 투명한 곳마다 채널이 검게 나옴','그 도구가 미리 곱한 알파로 파일을 읽음','같은 PNG를 채널 단계에서 열면 바이트가 남아 있음','랩에서 분리하고, 패킹 데이터는 캔버스를 쓰는 도구에 넣지 않기'],
    ['파일에 "브라우저 디코딩(바이트 동일 아님)" 표시','JPEG·WebP 입력. JPEG 압축은 채널끼리 섞이기도 함','파일 목록과 보고서의 `exactChannels: false`','텍스처를 만든 원본 PNG를 분리'],
    ['분리한 "AO"가 러프니스처럼 보이거나 메탈릭이 지저분함','배치를 잘못 고름(G가 HDRP에서는 AO, glTF에서는 러프니스)','"채널 해석"을 바꿔 가며 통계와 미리보기 비교','텍스처를 내보낸 프로그램의 배치를 고르기'],
    ['대상 엔진에서 러프니스가 뒤집혀 보임','원본 채널이 스무스니스(Unity)였는데 반전하지 않음','파일 이름에 `inverted-`가 없음','그 채널의 "반전"을 누르고 다시 저장'],
    ['16비트 텍스처의 정밀도가 줄어듦','출력은 8비트이며 샘플마다 상위 바이트만 남김','보고서의 비트 깊이','16비트 평면이 필요하면 16비트를 다루는 편집기 사용']]},
   alternatives:{rows:[
    ['패킹된 채로 쓰기','Godot `StandardMaterial3D`는 맵마다 읽을 채널을 고를 수 있어(`roughness_texture_channel`·`metallic_texture_channel`·`ao_texture_channel`) 순서만 다를 때는 분리할 필요가 없습니다.'],
    ['이미지 편집기의 채널 분리','알파 0 텍셀이 없는 불투명 텍스처를 이미 그 편집기에서 다루고 있을 때. 마스크 맵이라면 투명 영역을 먼저 확인하세요.'],
    ['[[game/roughness-to-smoothness|러프니스를 스무스니스로]]','Unity용으로 반전한 회색 맵 한 장만 필요할 때.']]},
   versions:{body:['텍스처 랩에서 측정(docs/TEXTURE-LAB.md): 무작위 바이트로 된 64×64 ORM을 분리하면 R·G·B·A 모두 최대 차이 0, 알파 0 텍셀 2048개가 모두 RGB 유지(일부러 넣은 (1, 2, 3, 0) 모서리는 R = 1로 복원), 파일은 Pillow에서 모드 `L`, 64×64로 열림, 반전한 러프니스 평면은 정확히 255 − 러프니스. 배치는 아래 엔진 문서의 것이며(Godot ORM 순서는 엔진 소스), 엔진 가져오기는 하지 않았습니다.'],
    sources:[S.hdrpMask,S.urpPacked,S.unityMetallic,S.gltfMR,S.godotBase,S.godotSrc]}
  },
  ja:{
   answer:'チャンネルパックテクスチャは、互いに無関係なグレーマップを最大4枚、R・G・B・Aの各チャンネルに入れたものです。ORMテクスチャはR・G・Bにオクルージョン・ラフネス・メタリックを、Unity HDRPのマスクマップはメタリック・AO・ディテールマスク・スムースネスを持ちます。分解するとは、各チャンネルを1バイトも変えずに単一チャンネルの画像に書き出すことです。チャンネル分解はPNGを直接読み、選んだ配置（HDRP・URP・glTF・Godot ORM・Unreal ORM）に従って各チャンネルに意味を付け、チャンネルの反転（スムースネス ↔ ラフネス）もでき、完全に透明なテクセルの下まで元とバイト一致の8ビットグレーPNGとして保存します。',
   concept:{title:'パックテクスチャの中身と、順番が大事な理由',body:[
    'パックテクスチャの各チャンネルはテクセルごとの独立した0〜255の数値で、色の一部ではありません。絵として見ると不思議な色に見え、Gがラフネス（glTF・Godot ORM）なのか、アンビエントオクルージョン（Unity HDRP）なのか、オクルージョン（Unity URP）なのかは配置を知らないと分かりません。ファイル名から順番はまず分かりません。`_ORM`・`_ARM`・`_MaskMap`・`_packed`はどれも「パック済み」を意味するだけなので、ラボはすべてパックマップに分類し、配置は自分で選ぶ形にしています。',
    'データが失われるのはアルファチャンネルです。Unityのマスクマップでは、完全に粗いテクセルはスムースネス0、つまりアルファ0です。ブラウザのCanvasはピクセルを乗算済みで保持するため、そのテクセルのメタリック・AO・ディテールのバイトは0として返ります。チャンネル分解は自前のリーダーでPNGをデコードし（インターレース以外の全カラー形式、1〜16ビット、`tRNS`）、各チャンネルを色変換なしの1テクセル1バイト、カラー形式0のPNGとして書き出します。',
    '反転は厳密です。保存される値は255 − 値で、2回反転すると元のバイトに戻ります。Unityのスムースネスのチャンネルは、こうして他のエンジンが求めるラフネスになります。'],
    terms:[['チャンネル平面','1チャンネル分のw × hバイト。グレーのPNGとして保存します。'],['乗算済みアルファ','アルファを掛けた後の色。アルファ0では色がすべて0になり、そこにパックされたバイトは失われます。'],['マスクマップ','Unity HDRPのパックテクスチャ。Rメタリック・Gアンビエントオクルージョン・Bディテールマスク・Aスムースネス。'],['16ビット入力','受け付けますが、サンプルごとに上位バイトを使います。出力は常に8ビットです。']]},
   example:{title:'例：HDRPマスクマップの1テクセル',lead:'AOが200でディテールマスクのない、完全に粗い金属のテクセルです。スムースネスが0なのでアルファも0です。',lines:[
    '元のテクセル (crate_MaskMap.png)   R 255   G 200   B 0   A 0',
    'ブラウザのCanvasで読む             R 0     G 0     B 0   A 0     （乗算済み：色 × 0）',
    'ラボのPNGデコーダーで読む          R 255   G 200   B 0   A 0',
    '',
    'Unity HDRPの配置で保存、Aを反転：',
    '  crate_MaskMap-r-metallic.png                 255',
    '  crate_MaskMap-g-ao.png                       200',
    '  crate_MaskMap-b-detail.png                   0',
    '  crate_MaskMap-a-inverted-smoothness.png      255   （255 − 0：ラフネス）'],
    after:'反転したファイルは配置上の名前（`smoothness`）の前に`inverted-`が付くので、中身はラフネスです。ほかのツールがファイル名でマップを選ぶ場合は名前を変えてください。'},
   mapping:{title:'配置ごとの各チャンネルの中身',head:['チャンネル','Unity HDRPマスクマップ','glTF 2.0 / Godot ORM','Unity URPチャンネルパック'],rows:[
    ['R','メタリック','オクルージョン','メタリック'],
    ['G','アンビエントオクルージョン','ラフネス','オクルージョン'],
    ['B','ディテールマスク（HDRPのみ）','メタリック','未使用'],
    ['A','スムースネス — 反転でラフネス','未使用','スムースネス — 反転でラフネス']],
    note:'組み込みのStandardシェーダーのメタリックマップはR（メタリック）とA（スムースネス）だけを読みます。Nerulioの「Unity URP・組み込み」プリセットはこのページに従ってGを「無視」と表示しますが、UnityのURPのページは、同じテクスチャをOcclusionにも割り当てるとGからオクルージョンを読むとしています。'},
   outputs:{rows:[
    ['crate_MaskMap-r-metallic.png … -a-smoothness.png','チャンネルごとに8ビットのグレーPNG（カラー形式0）を1枚。名前は`ファイル-チャンネル-役割`で、反転した場合は役割の前に`inverted-`が付きます。'],
    ['crate_MaskMap-channels.zip','4チャンネルのPNGを1つのアーカイブに（4チャンネルすべて保存）。']]},
   target:{title:'パックテクスチャを別のエンジンの配置へ移す',lead:'例：Unity HDRPのマスクマップをGodot 4やglTFへ移す場合。エンジンの設定は各ドキュメントに従ったもので、Nerulioは読み込みを実行していません。',steps:[
    'パック済みのPNGを開き、「チャンネルの解釈」を元の配置（ここではUnity HDRPマスクマップ）にします。チャンネルの統計を見てください。最小 = 最大のチャンネルは定数で埋められたものです。',
    'Aの「反転」を押してスムースネスをラフネスにし、「4チャンネルすべて保存（ZIP）」を押します。',
    'Godot 4で個別マップとして使う：`StandardMaterial3D`のテクスチャスロットにラフネス・メタリック・AOのPNGを割り当てます（Ambient Occlusionは先に有効化）。各スロットの`*_texture_channel`の既定はRedなので、グレーPNGはそのまま読まれます。',
    'Godotの`ORMMaterial3D`やglTF：[[texture-mask-packer|マスクパッカー]]のORMプリセット（Rオクルージョン・Gラフネス・Bメタリック）でAO・ラフネス・メタリックをパックし直します。',
    'Unity：グレーPNGやパックし直したテクスチャはすべて`sRGB (Color Texture)`をオフにして読み込みます。URP・HDRPにはラフネス専用のスロットがないため、平面を1枚ずつ使わず、メタリックとスムースネスをパックし直してください。']},
   verify:{steps:[
    '分解したときと同じ配置で平面をパックし直し、それを分解します。各チャンネルの最小・最大・平均・固有値の数が前と同じはずです（ラボの測定：最大差0）。',
    '保存したPNGを任意の画像ツールで開きます。RGBのコピーではなく、元の解像度の単一チャンネル8ビットグレー画像のはずです。',
    '反転した平面では、以前vだったテクセルが255 − vになっているはずです（ステージに元 → 結果が並んで表示されます）。']},
   trouble:{rows:[
    ['別のツールで、透明な場所ごとにチャンネルが黒くなる','そのツールが乗算済みアルファでファイルを読んだ','同じPNGをチャンネルステージで開くとバイトは残っている','ラボで分解し、パックデータはCanvasを使うツールに通さない'],
    ['ファイルに「ブラウザでデコード（バイト一致ではない）」と出る','JPEG・WebPの入力。JPEGの圧縮はチャンネル同士を混ぜることもある','ファイル一覧とレポートの`exactChannels: false`','テクスチャの元になったPNGを分解する'],
    ['分解した「AO」がラフネスに見える、メタリックが荒れている','配置の選択が違う（GはHDRPではAO、glTFではラフネス）','「チャンネルの解釈」を切り替えて統計とプレビューを比べる','テクスチャを書き出したソフトの配置を選ぶ'],
    ['移した先のエンジンでラフネスが逆に見える','元のチャンネルがスムースネス（Unity）で、反転していない','ファイル名に`inverted-`がない','そのチャンネルの「反転」を押して保存し直す'],
    ['16ビットのテクスチャの精度が落ちる','出力は8ビットで、サンプルごとに上位バイトだけを残す','レポートのビット深度','16ビットの平面が必要なら16ビット対応の編集ソフトを使う']]},
   alternatives:{rows:[
    ['パックしたまま使う','Godotの`StandardMaterial3D`はマップごとに読むチャンネルを選べる（`roughness_texture_channel`・`metallic_texture_channel`・`ao_texture_channel`）ため、順番が違うだけなら分解は不要です。'],
    ['画像編集ソフトのチャンネル分解','アルファ0のテクセルがない不透明なテクスチャを、すでにそのソフトで扱っているとき。マスクマップなら透明な部分を先に確認してください。'],
    ['[[game/roughness-to-smoothness|ラフネスをスムースネスに]]','Unity向けに反転したグレーマップが1枚だけ必要なとき。']]},
   versions:{body:['テクスチャラボで測定（docs/TEXTURE-LAB.md）：ランダムなバイトの64×64 ORMを分解するとR・G・B・Aすべて最大差0、アルファ0のテクセル2048個がすべてRGBを保持（わざと入れた(1, 2, 3, 0)の角はR = 1で復元）、ファイルはPillowでモード`L`・64×64として開け、反転したラフネスの平面は正確に255 − ラフネス。配置は下記のエンジンのドキュメントのもので（GodotのORMの順序はエンジンのソース）、エンジンへの読み込みは行っていません。'],
    sources:[S.hdrpMask,S.urpPacked,S.unityMetallic,S.gltfMR,S.godotBase,S.godotSrc]}
  }
 },
 // ------------------------------------------------------------------ PBR texture validator
 'game/pbr-texture-validator':{
  type:'tool',
  intent:{primary:'validate a PBR texture set: naming, sizes, missing maps, grey and normal maps',secondary:['which maps a workflow needs','power of two','file naming conventions','JSON report for a pipeline'],
   goal:'a list of every problem in the set, each with its file and the measured number, before the maps reach an engine',input:'the maps of one material (PNG exact; JPEG/WebP decoded by the browser)',output:'on-screen issue list + texture-report.json',target:'generic; workflows for glTF/separate maps, Unity HDRP, Unity URP, Godot ORM, Unreal ORM',support:'full',
   evidence:['src/game/texture-set.js (RULES, WORKFLOWS, validateTextureSet thresholds)','src/game/texture-normal.js (validateNormalMap: tolerance 0.12, 1 % / 5 %)','src/game/texture-channels.js (colorSpread ≤ 2, alphaStats)','docs/TEXTURE-LAB.md (report fields verified)'],
   external:['glTF 2.0 non-power-of-two textures','Unity import Non Power of 2']},
  en:{
   answer:'A PBR validator checks a texture set before import: every map has a role, all maps are the same size, the chosen workflow\'s required and recommended maps are there, sizes are powers of two, grey maps really are grey and a normal map really decodes to unit vectors. Drop one material\'s maps: roles come from the file names (`_basecolor`, `_normal`, `_roughness`, `_ORM` …), you choose the workflow, and every issue is listed with its file and the measured number. The JSON report keeps the measurements; no file is renamed or changed.',
   concept:{title:'What is checked, and against which numbers',body:[
    'Roles from names. The file name is lower-cased, separators become `_`, and the first matching token wins, most specific first: packed (`orm`, `arm`, `rma`, `mra`, `maskmap`, `mask`), albedo (`albedo`, `basecolor`, `diffuse`, `color` …), normal (`normalgl`, `normaldx`, `normal`, `nrm`, `n`), roughness, smoothness (`gloss`), metallic, AO (`ao`, `occlusion`, `ambientocclusion`), height (`height`, `displacement`, `bump`), emission, opacity, specular. Tokens of one or two letters (`_n`, `_m`, `_r`) count as low confidence. Every role is a drop-down, so you correct a wrong guess instead of renaming files.',
    'Workflows decide what is missing. Separate maps (glTF / generic): albedo required; normal, roughness, metallic recommended. Unity HDRP: albedo and the mask map required, normal recommended. Unity URP: albedo required; normal and metallic recommended. Godot ORM and Unreal ORM: albedo required; normal and the ORM texture recommended — and when roughness and metallic are present but the ORM is not, you get "pack available" instead of a bare "missing". A roughness map satisfies smoothness and the other way round.',
    'Measurements, not guesses. A single-channel role (roughness, metallic, AO, height, opacity) stored as RGB is "grey stored as RGB" when no texel\'s channels differ by more than 2, and "channels differ" (probably packed) when they do. A normal map is decoded texel by texel: a sample is off-unit when its length is more than 0.12 from 1; the map passes when at most 1 % of samples are off-unit and no blue is below 128 (a vector pointing into the surface). A map assigned another role that passes the normal-map test (≤ 5 % off-unit, ≤ 0.1 % negative blue) is flagged "looks like a normal map".',
    'Power of two is a warning, not an error. glTF 2.0 says clients SHOULD resize non-power-of-two textures on platforms with limited support when the sampler repeats or uses mipmaps; Unity\'s importer has a Non Power of 2 option that scales such textures. Whether that matters depends on your target, so the validator reports it and leaves the decision to you.'],
    terms:[['Workflow','The set of maps an engine\'s material expects, including how they are packed.'],['Set name','What is left of the file name after the role token; different set names in one drop trigger "naming inconsistent".'],['Off-unit sample','A decoded normal whose length differs from 1 by more than 0.12.'],['Power of two','A size of 2ⁿ pixels: 256, 512, 1024, 2048 …']]},
   example:{title:'Example: a rock set checked for Godot 4 ORM',lead:'Four PNGs dropped together, workflow Godot 4 ORM. This is what the validator returns:',lines:[
    'rock_basecolor.png   2048 × 2048   albedo',
    'rock_normal.png      2048 × 2048   normal',
    'rock_roughness.png   1000 × 1000   roughness',
    'rock_metallic.png    2048 × 2048   metallic',
    '',
    'error  dimension-mismatch    2048x2048 vs 1000x1000 (rock_roughness.png)',
    'warn   missing-recommended   orm',
    'info   pack-available        roughness + metallic → Godot 4 ORM preset',
    'warn   not-power-of-two      rock_roughness.png 1000 × 1000',
    '',
    'set ok: no (1 error)'],
    after:'One re-export of the roughness at 2048 × 2048 clears the error and the power-of-two warning; packing roughness and metallic (with AO if you have one) in the [[texture-mask-packer|mask packer]] clears "missing orm".'},
   verify:{steps:[
    'After fixing, drop the new files and keep the same workflow: the summary shows ✓ when there are no errors and no warnings.',
    'Download `texture-report.json` and read `issues`: each entry has `id`, `level`, the files and the numbers (sizes, `maxDeviation`, `ratio`, `minBlue`).',
    'For a normal map, `normalCheck.meanLength` should be close to 1 and `blueNonNegative` true.']},
   trouble:{rows:[
    ['`unclassified` for a file you know','The name has no known token (`rock_03.png`), or a token outside the English list','The role column shows Unknown','Pick the role in its drop-down; the report keeps your choice'],
    ['`duplicate-role` for the normal map','Both `_NormalGL` and `_NormalDX` from one download were dropped','Two files carry the role normal','Keep the one your engine expects (GL for Unity and Godot); convert with the [[game/normal-map-converter|normal map converter]] if you only have the other'],
    ['`gray-channels-differ` on a roughness or metallic file','It is really a packed texture (or a coloured preview) with a single-map name','The issue gives the largest channel spread and the share of texels that differ','Set its role to the packed map, or unpack it with the [[game/channel-unpacker|channel unpacker]]'],
    ['`looks-like-normal` on a height or bump file','A normal map saved as `_bump`, which the name rules read as height','It passes the unit-length and blue test','Change its role to normal'],
    ['`normal-blue-negative` or `normal-not-unit`','Not a tangent-space normal map (a height or object-space map, or a map resized as colour)','The issue shows `minBlue` and the off-unit share','Use the right file, or generate one from height with the [[normal-map-generator|normal map generator]]'],
    ['`unexpected-alpha` on a roughness, metallic or AO map','The exporter added an alpha channel the engine will not read','The issue lists the lowest alpha and the number of alpha-0 texels','Export without alpha; the colour under alpha 0 is kept by the Lab, but most engines ignore it']]},
   alternatives:{rows:[
    ['[[game/texture-lab|The full Texture Lab]]','You also need to fix what the check finds: convert normals, unpack or pack channels, bleed edges, resize, and export a batch.'],
    ['Checking in the engine','One material and one engine: import settings and missing slots show up in the material inspector, but sizes, grey-stored-as-RGB and normal validity are not measured there.']]},
   limits:['Colour space is not detected: no ICC profile or gamma is read; the report states which roles an engine expects as sRGB or linear and whether a PNG has an sRGB chunk.','The OpenGL/DirectX convention of a normal map is not detected here (only a `_NormalGL`/`_NormalDX` name is read); the Studio\'s Texture workspace has a detector.','Name rules know English tokens only; files are never renamed.','The report is generic JSON; no engine imports it.'],
   versions:{body:['The check report was verified on the Texture Lab (docs/TEXTURE-LAB.md): `schemaVersion` 1, `engineTarget` generic, `alpha.zeroPixels` = 2048 matching the fixture, `exactChannels` true; a JPEG input gives `exactChannels: false`. The numbers on this page are the thresholds in `src/game/texture-set.js` and `src/game/texture-normal.js`.'],
    sources:[S.gltf,S.unityImport,S.godotShading]}
  },
  ko:{
   answer:'PBR 검사기는 가져오기 전에 텍스처 세트를 점검합니다. 맵마다 역할이 있는지, 모든 맵의 크기가 같은지, 고른 워크플로의 필수·권장 맵이 있는지, 크기가 2의 거듭제곱인지, 회색 맵이 정말 회색인지, 노멀맵이 정말 단위 벡터로 디코딩되는지 확인합니다. 머티리얼 하나의 맵을 넣으면 파일 이름(`_basecolor`, `_normal`, `_roughness`, `_ORM` 등)으로 역할을 정하고, 워크플로를 고르면 문제마다 파일과 측정값이 나옵니다. JSON 보고서에 측정값이 남으며 파일 이름이나 내용은 바꾸지 않습니다.',
   concept:{title:'무엇을 어떤 기준으로 점검하나',body:[
    '이름으로 정하는 역할. 파일 이름을 소문자로 바꾸고 구분자를 `_`로 통일한 뒤, 더 구체적인 것부터 처음 맞는 토큰을 씁니다. 패킹(`orm`·`arm`·`rma`·`mra`·`maskmap`·`mask`), 알베도(`albedo`·`basecolor`·`diffuse`·`color` 등), 노멀(`normalgl`·`normaldx`·`normal`·`nrm`·`n`), 러프니스, 스무스니스(`gloss`), 메탈릭, AO(`ao`·`occlusion`·`ambientocclusion`), 하이트(`height`·`displacement`·`bump`), 에미션, 불투명도, 스페큘러 순입니다. 한두 글자 토큰(`_n`·`_m`·`_r`)은 신뢰도 낮음으로 봅니다. 역할은 모두 선택 상자라서 파일 이름을 바꾸지 않고 잘못된 추측을 고치면 됩니다.',
    '누락은 워크플로가 정합니다. 개별 맵(glTF·공통): 알베도 필수, 노멀·러프니스·메탈릭 권장. Unity HDRP: 알베도와 마스크 맵 필수, 노멀 권장. Unity URP: 알베도 필수, 노멀·메탈릭 권장. Godot ORM·Unreal ORM: 알베도 필수, 노멀과 ORM 텍스처 권장이며, 러프니스와 메탈릭은 있는데 ORM이 없으면 그냥 "누락" 대신 "패킹 가능"이 나옵니다. 러프니스 맵은 스무스니스를, 스무스니스 맵은 러프니스를 대신합니다.',
    '추측이 아니라 측정. 단일 채널 역할(러프니스·메탈릭·AO·하이트·불투명도)이 RGB로 저장돼 있을 때, 어느 텍셀도 채널 차이가 2를 넘지 않으면 "RGB로 저장된 회색", 넘으면 "채널이 서로 다름"(패킹된 것일 가능성)으로 보고합니다. 노멀맵은 텍셀마다 디코딩해, 길이가 1에서 0.12보다 멀면 단위 밖 샘플로 셉니다. 단위 밖이 1% 이하이고 파랑이 128 미만(표면 안쪽을 향하는 벡터)인 곳이 없어야 통과입니다. 다른 역할로 지정됐는데 노멀맵 시험(단위 밖 5% 이하, 음의 파랑 0.1% 이하)을 통과하면 "노멀맵처럼 보임"으로 알립니다.',
    '2의 거듭제곱은 오류가 아니라 경고입니다. glTF 2.0은 샘플러가 반복하거나 밉맵을 쓸 때, 지원이 제한된 플랫폼에서는 2의 거듭제곱이 아닌 텍스처의 크기를 바꾸는 것이 좋다(SHOULD)고 하고, Unity 임포터에는 그런 텍스처의 크기를 조정하는 Non Power of 2 옵션이 있습니다. 중요한지는 대상에 따라 다르므로 검사기는 알리기만 하고 판단은 맡깁니다.'],
    terms:[['워크플로','엔진 머티리얼이 기대하는 맵 구성(패킹 방식 포함).'],['세트 이름','파일 이름에서 역할 토큰을 뺀 나머지. 한 번에 넣은 파일의 세트 이름이 다르면 "이름 불일치"가 나옵니다.'],['단위 밖 샘플','디코딩한 노멀의 길이가 1과 0.12보다 더 차이 나는 샘플.'],['2의 거듭제곱','2ⁿ 픽셀 크기: 256, 512, 1024, 2048 …']]},
   example:{title:'예시: Godot 4 ORM으로 점검한 바위 세트',lead:'PNG 네 장을 함께 넣고 워크플로를 Godot 4 ORM으로 골랐을 때 검사기가 돌려주는 결과입니다.',lines:[
    'rock_basecolor.png   2048 × 2048   albedo',
    'rock_normal.png      2048 × 2048   normal',
    'rock_roughness.png   1000 × 1000   roughness',
    'rock_metallic.png    2048 × 2048   metallic',
    '',
    'error  dimension-mismatch    2048x2048 대 1000x1000 (rock_roughness.png)',
    'warn   missing-recommended   orm',
    'info   pack-available        roughness + metallic → Godot 4 ORM 프리셋',
    'warn   not-power-of-two      rock_roughness.png 1000 × 1000',
    '',
    '세트 통과: 아니요 (오류 1)'],
    after:'러프니스를 2048 × 2048로 다시 내보내면 오류와 2의 거듭제곱 경고가 함께 사라집니다. [[texture-mask-packer|마스크 패커]]에서 러프니스와 메탈릭(AO가 있으면 AO도)을 패킹하면 "orm 누락"도 사라집니다.'},
   verify:{steps:[
    '고친 뒤 새 파일을 넣고 같은 워크플로를 유지합니다. 오류와 경고가 없으면 요약에 ✓가 나옵니다.',
    '`texture-report.json`을 받아 `issues`를 봅니다. 항목마다 `id`·`level`·파일·수치(크기, `maxDeviation`, `ratio`, `minBlue`)가 있습니다.',
    '노멀맵은 `normalCheck.meanLength`가 1에 가깝고 `blueNonNegative`가 true여야 합니다.']},
   trouble:{rows:[
    ['아는 파일인데 `unclassified`','이름에 아는 토큰이 없거나(`rock_03.png`) 영어 목록에 없는 토큰','역할 칸이 알 수 없음으로 표시됨','선택 상자에서 역할을 고르기. 보고서에도 그 선택이 남음'],
    ['노멀맵에 `duplicate-role`','한 다운로드의 `_NormalGL`과 `_NormalDX`를 둘 다 넣음','역할이 노멀인 파일이 두 개','엔진이 기대하는 쪽만 남기기(Unity·Godot는 GL). 다른 쪽만 있으면 [[game/normal-map-converter|노멀맵 변환기]]로 변환'],
    ['러프니스·메탈릭 파일에 `gray-channels-differ`','이름은 단일 맵인데 실제로는 패킹 텍스처(또는 색이 든 미리보기)','문제 항목에 가장 큰 채널 차이와 차이 나는 텍셀 비율이 나옴','역할을 패킹 맵으로 바꾸거나 [[game/channel-unpacker|채널 분리기]]로 분리'],
    ['하이트·범프 파일에 `looks-like-normal`','노멀맵을 `_bump`로 저장해 이름 규칙이 하이트로 읽음','단위 길이와 파랑 시험을 통과함','역할을 노멀로 바꾸기'],
    ['`normal-blue-negative`나 `normal-not-unit`','탄젠트 공간 노멀맵이 아님(하이트·오브젝트 공간 맵, 또는 색처럼 크기를 바꾼 맵)','문제 항목에 `minBlue`와 단위 밖 비율이 나옴','맞는 파일을 쓰거나 [[normal-map-generator|노멀맵 생성기]]로 하이트에서 만들기'],
    ['러프니스·메탈릭·AO 맵에 `unexpected-alpha`','내보내기 프로그램이 엔진이 읽지 않을 알파를 붙임','문제 항목에 가장 낮은 알파와 알파 0 텍셀 수가 나옴','알파 없이 다시 내보내기. 알파 0 아래 색은 랩이 유지하지만 대부분의 엔진은 무시함']]},
   alternatives:{rows:[
    ['[[game/texture-lab|텍스처 랩 전체]]','점검에서 나온 문제를 고치는 것까지 필요할 때: 노멀 변환, 채널 분리·패킹, 가장자리 번짐, 크기 변경, 일괄 내보내기.'],
    ['엔진에서 점검하기','머티리얼 하나, 엔진 하나일 때. 가져오기 설정과 빈 슬롯은 머티리얼 인스펙터에서 보이지만, 크기·RGB로 저장된 회색·노멀 유효성은 거기서 측정되지 않습니다.']]},
   limits:['색 공간은 감지하지 않습니다. ICC 프로필이나 감마를 읽지 않고, 엔진이 역할별로 sRGB와 리니어 중 무엇을 기대하는지와 PNG에 sRGB 청크가 있는지만 알립니다.','노멀맵의 OpenGL·DirectX 규약은 여기서 감지하지 않습니다(`_NormalGL`·`_NormalDX` 이름만 읽음). 감지기는 Studio 텍스처 작업 공간에 있습니다.','이름 규칙은 영어 토큰만 알며, 파일 이름은 절대 바꾸지 않습니다.','보고서는 일반 JSON이며 엔진이 가져가는 형식이 아닙니다.'],
   versions:{body:['점검 보고서는 텍스처 랩에서 확인했습니다(docs/TEXTURE-LAB.md): `schemaVersion` 1, `engineTarget` generic, 시험 파일과 같은 `alpha.zeroPixels` = 2048, `exactChannels` true. JPEG 입력은 `exactChannels: false`. 이 페이지의 수치는 `src/game/texture-set.js`와 `src/game/texture-normal.js`의 기준값입니다.'],
    sources:[S.gltf,S.unityImport,S.godotShading]}
  },
  ja:{
   answer:'PBRバリデーターは読み込み前にテクスチャセットを確認します。各マップに役割があるか、全マップのサイズが同じか、選んだワークフローの必須・推奨マップがそろっているか、サイズが2のべき乗か、グレーマップが本当にグレーか、ノーマルマップが本当に単位ベクトルにデコードされるかを見ます。1つのマテリアルのマップを入れると、ファイル名（`_basecolor`、`_normal`、`_roughness`、`_ORM`など）から役割を決め、ワークフローを選ぶと問題ごとにファイルと測定値が出ます。JSONレポートに測定値が残り、ファイル名や中身は一切変えません。',
   concept:{title:'何を、どの基準で確認するか',body:[
    '名前から決まる役割。ファイル名を小文字にし、区切りを`_`にそろえてから、具体的なものから順に最初に一致したトークンを使います。パック（`orm`・`arm`・`rma`・`mra`・`maskmap`・`mask`）、アルベド（`albedo`・`basecolor`・`diffuse`・`color`など）、ノーマル（`normalgl`・`normaldx`・`normal`・`nrm`・`n`）、ラフネス、スムースネス（`gloss`）、メタリック、AO（`ao`・`occlusion`・`ambientocclusion`）、ハイト（`height`・`displacement`・`bump`）、エミッション、不透明度、スペキュラーの順です。1〜2文字のトークン（`_n`・`_m`・`_r`）は信頼度低とします。役割はすべてプルダウンなので、ファイル名を変えずに誤った推定を直せます。',
    '不足はワークフローが決めます。個別マップ（glTF・汎用）：アルベド必須、ノーマル・ラフネス・メタリック推奨。Unity HDRP：アルベドとマスクマップが必須、ノーマル推奨。Unity URP：アルベド必須、ノーマル・メタリック推奨。Godot ORM・Unreal ORM：アルベド必須、ノーマルとORMテクスチャ推奨で、ラフネスとメタリックはあるのにORMがない場合は、単なる「不足」ではなく「パック可能」と出ます。ラフネスのマップはスムースネスの代わりになり、その逆も同様です。',
    '推測ではなく測定。単一チャンネルの役割（ラフネス・メタリック・AO・ハイト・不透明度）がRGBで保存されているとき、どのテクセルでもチャンネル差が2以下なら「RGBで保存されたグレー」、超えれば「チャンネルが異なる」（パック済みの可能性）と報告します。ノーマルマップはテクセルごとにデコードし、長さが1から0.12より離れたサンプルを単位外と数えます。単位外が1%以下で、青が128未満（面の内側を向くベクトル）のものがなければ合格です。別の役割なのにノーマルマップの判定（単位外5%以下、負の青0.1%以下）を通るものは「ノーマルマップに見える」と警告します。',
    '2のべき乗はエラーではなく警告です。glTF 2.0は、サンプラーがリピートやミップマップを使う場合、対応が限られるプラットフォームでは2のべき乗でないテクスチャをリサイズすべき（SHOULD）としており、UnityのインポーターにはそうしたテクスチャをスケールするNon Power of 2の設定があります。問題になるかは対象次第なので、バリデーターは報告だけして判断は任せます。'],
    terms:[['ワークフロー','エンジンのマテリアルが期待するマップの構成（パックの仕方を含む）。'],['セット名','ファイル名から役割のトークンを除いた残り。一度に入れたファイルのセット名が違うと「名前の不統一」が出ます。'],['単位外のサンプル','デコードしたノーマルの長さが1から0.12より離れているサンプル。'],['2のべき乗','2ⁿピクセルのサイズ：256、512、1024、2048 …']]},
   example:{title:'例：Godot 4 ORMで確認した岩のセット',lead:'PNGを4枚まとめて入れ、ワークフローをGodot 4 ORMにしたときにバリデーターが返す結果です。',lines:[
    'rock_basecolor.png   2048 × 2048   albedo',
    'rock_normal.png      2048 × 2048   normal',
    'rock_roughness.png   1000 × 1000   roughness',
    'rock_metallic.png    2048 × 2048   metallic',
    '',
    'error  dimension-mismatch    2048x2048 と 1000x1000 (rock_roughness.png)',
    'warn   missing-recommended   orm',
    'info   pack-available        roughness + metallic → Godot 4 ORMプリセット',
    'warn   not-power-of-two      rock_roughness.png 1000 × 1000',
    '',
    'セット合格：いいえ（エラー1）'],
    after:'ラフネスを2048 × 2048で書き出し直せば、エラーと2のべき乗の警告が同時に消えます。[[texture-mask-packer|マスクパッカー]]でラフネスとメタリック（AOがあればAOも）をパックすれば「orm不足」も消えます。'},
   verify:{steps:[
    '修正後に新しいファイルを入れ、同じワークフローのままにします。エラーも警告もなければサマリーに✓が出ます。',
    '`texture-report.json`をダウンロードして`issues`を読みます。各項目に`id`・`level`・ファイル・数値（サイズ、`maxDeviation`、`ratio`、`minBlue`）があります。',
    'ノーマルマップでは`normalCheck.meanLength`が1に近く、`blueNonNegative`がtrueのはずです。']},
   trouble:{rows:[
    ['分かっているファイルなのに`unclassified`','名前に既知のトークンがない（`rock_03.png`）、または英語の一覧にないトークン','役割の欄が不明になっている','プルダウンで役割を選ぶ。レポートにもその選択が残る'],
    ['ノーマルマップに`duplicate-role`','1つのダウンロードの`_NormalGL`と`_NormalDX`を両方入れた','役割がノーマルのファイルが2つある','エンジンが期待する方だけ残す（Unity・GodotはGL）。もう一方しかなければ[[game/normal-map-converter|ノーマルマップ変換]]で変換'],
    ['ラフネス・メタリックのファイルに`gray-channels-differ`','単一マップの名前だが、実はパックテクスチャ（または色付きのプレビュー）','問題の項目に最大のチャンネル差と、差のあるテクセルの割合が出る','役割をパックマップに変えるか、[[game/channel-unpacker|チャンネル分解]]で分ける'],
    ['ハイト・バンプのファイルに`looks-like-normal`','ノーマルマップを`_bump`で保存し、名前のルールがハイトと読んだ','単位長と青の判定を通っている','役割をノーマルに変える'],
    ['`normal-blue-negative`や`normal-not-unit`','接空間ノーマルマップではない（ハイトやオブジェクト空間のマップ、色としてリサイズしたマップ）','問題の項目に`minBlue`と単位外の割合が出る','正しいファイルを使うか、[[normal-map-generator|ノーマルマップ生成]]でハイトから作る'],
    ['ラフネス・メタリック・AOに`unexpected-alpha`','書き出したソフトが、エンジンが読まないアルファを付けた','問題の項目に最小のアルファとアルファ0のテクセル数が出る','アルファなしで書き出し直す。アルファ0の下の色はラボでは保持されるが、多くのエンジンは無視する']]},
   alternatives:{rows:[
    ['[[game/texture-lab|テクスチャラボ全体]]','チェックで見つかった問題の修正まで必要なとき：ノーマル変換、チャンネルの分解・パック、エッジブリード、リサイズ、一括書き出し。'],
    ['エンジン上で確認する','マテリアル1つ、エンジン1つのとき。インポート設定や空きスロットはマテリアルのインスペクターで分かりますが、サイズ・RGBで保存されたグレー・ノーマルの妥当性はそこでは測定されません。']]},
   limits:['色空間は判定しません。ICCプロファイルやガンマを読まず、エンジンが役割ごとにsRGBとリニアのどちらを期待するかと、PNGにsRGBチャンクがあるかだけを示します。','ノーマルマップのOpenGL・DirectXの規約はここでは判定しません（`_NormalGL`・`_NormalDX`の名前だけを読む）。判定機能はStudioのテクスチャ作業画面にあります。','名前のルールは英語のトークンだけで、ファイル名は決して変更しません。','レポートは汎用JSONで、エンジンが読み込む形式ではありません。'],
   versions:{body:['チェックレポートはテクスチャラボで確認しました（docs/TEXTURE-LAB.md）：`schemaVersion` 1、`engineTarget` generic、テスト用ファイルと一致する`alpha.zeroPixels` = 2048、`exactChannels` true。JPEG入力では`exactChannels: false`。このページの数値は`src/game/texture-set.js`と`src/game/texture-normal.js`の基準値です。'],
    sources:[S.gltf,S.unityImport,S.godotShading]}
  }
 },
 // ------------------------------------------------------------------ Edge bleed
 'game/texture-edge-bleed':{
  type:'troubleshoot',
  intent:{primary:'fix dark or white halos around transparent sprites and textures (alpha bleed / edge padding / dilation)',secondary:['why transparent pixels\' RGB shows at mipmaps and bilinear edges','how many pixels to bleed','engine import options that do the same'],
   goal:'edges that keep their own colour when filtered and when the engine shows smaller mip levels',input:'a PNG with transparency',output:'NAME-bleed.png (RGB changed only where alpha is 0) or a batch ZIP',target:'any engine that filters or mipmaps straight-alpha textures',support:'full',
   evidence:['src/game/texture-fix.js (dilateEdges, mipChain)','docs/TEXTURE-LAB.md (448 texels, alpha 0 differing bytes, (210,40,30,0))','src/task/texture-lab-fix.js (default 4 px, export order resize → bleed → encode)'],
   external:['Godot 4.7 import: Process › Fix Alpha Border','Unity 6 import: Alpha is Transparency']},
  en:{
   answer:'A dark (or white) outline around a transparent sprite, leaf or decal means the texture\'s fully transparent pixels still hold black or white RGB, and bilinear filtering or smaller mipmap levels average that hidden colour into the visible edge. The fix is to fill those pixels with the edge\'s own colour — edge bleed, also called dilation or alpha padding — or to let the engine do it on import (Godot\'s Fix Alpha Border, Unity\'s Alpha is Transparency). Nerulio\'s Edge bleed pushes RGB 2, 4, 8 or 16 px into texels with alpha 0 and never writes alpha.',
   concept:{title:'Where the halo comes from',body:[
    'A PNG stores colour and alpha separately (straight alpha), so a texel with alpha 0 still has an RGB value. Most programs write (0, 0, 0) or (255, 255, 255) there. You never see it at 1:1, because alpha 0 hides it.',
    'Filtering and mipmaps mix neighbours. A bilinear sample halfway between an opaque edge texel and a transparent one averages both colours and both alphas; a mip level averages each 2 × 2 block of the level above. The result has the right, half-way alpha but a colour pulled towards the hidden black or white, so the edge darkens or glows — more at every smaller mip level, which is why the outline often appears only when the object is far away or scaled down.',
    'Edge bleed replaces the hidden colour. Nerulio grows the colour one ring per round: every transparent texel next to one that already has colour takes the average RGB of those neighbours (all 8 directions), so after N rounds everything within N px of the sprite carries its edge colour. Texels with alpha above 0 are never touched and no alpha byte is written. Premultiplied-alpha textures avoid the problem in another way: their colour is already multiplied by alpha, so a transparent texel adds nothing.',
    'How far to bleed. In a box-filtered mip chain a texel of level k covers 2ᵏ × 2ᵏ source texels, so a transparent texel mixed into an edge block is at most 2ᵏ − 1 px from the sprite. A 4 px bleed therefore keeps the levels down to 1/4 clean, 8 px down to 1/8 and 16 px down to 1/16 — the three levels the Lab\'s mipmap preview shows.'],
    terms:[['Straight alpha','Colour and alpha stored independently; RGB exists even where alpha is 0.'],['Edge bleed (dilation)','Copying edge colour outwards into transparent texels without changing their alpha.'],['Mip level','A pre-shrunk copy (1/2, 1/4, 1/8 …) the GPU uses when the texture is drawn small.'],['Premultiplied alpha','Colour already multiplied by alpha; hidden colour cannot leak.']]},
   example:{title:'Example: one edge block, before and after',lead:'A red sprite texel (210, 40, 30, 255) sits next to a transparent texel that holds black. Mip level 1 averages the 2 × 2 block (two opaque, two transparent):',lines:[
    'Without bleed   (210+210+0+0)/4, (40+40+0+0)/4, (30+30+0+0)/4, alpha (255+255+0+0)/4',
    '              = (105, 20, 15, 128)    half transparent and half as bright: the dark rim',
    'With bleed      transparent texels now hold (210, 40, 30, 0)',
    '              = (210, 40, 30, 128)    half transparent, same red',
    '',
    'Texels filled around a 24 × 24 opaque square (bleed N px: (24 + 2N)² − 24²):',
    '  2 px → 208    4 px → 448    8 px → 1024    16 px → 2560'],
    after:'The 4 px figure is the one the Lab measured on its test sprite: 448 texels changed, all with alpha 0, and not a single alpha byte changed.'},
   trouble:{rows:[
    ['Dark or white outline only when the object is small or far away','Mip levels average the hidden RGB into the edge','Fix › Mipmaps: compare 1/4, 1/8, 1/16 before and after bleeding','Bleed at least as far as the smallest level you see (4 px → 1/4, 8 px → 1/8, 16 px → 1/16), or turn on the engine\'s import option'],
    ['A thin fringe at 1:1 when the sprite moves, rotates or is scaled','Bilinear filtering samples between the edge and the transparent neighbour','Zoom the engine view: the fringe follows the silhouette','Bleed 2 px or more; for pixel art use Nearest filtering instead ([[game/godot-pixel-art-blurry|blurry pixel art in Godot]])'],
    ['The bleed disappeared after resizing the texture','The resize went through a canvas, which discards colour under alpha 0','Open the resized file in the Channels stage: RGB under alpha 0 is 0 again','Resize first and bleed last — the Lab\'s Export runs resize → bleed → encode in that order'],
    ['The bleed is gone after saving as WebP or JPEG','Those formats are encoded through the browser canvas; JPEG has no alpha at all','Compare the PNG and the WebP in the Channels stage','Keep bled textures as PNG'],
    ['Colour of the neighbouring sprite shows at the edge in an atlas','Sprites are packed without gaps, so filtering reaches the next sprite','Look at the atlas: are sprites touching?','That needs padding or extrusion between sprites, not bleed: see [[atlas-padding|atlas padding]] and [[sprite-sheet-maker|the sprite sheet packer]]'],
    ['Semi-transparent edge pixels themselves are dark','The art was exported against a black matte, so the colour is baked into pixels with alpha 1–254','The dark pixels have alpha above 0','Nerulio cannot fix this (bleed never touches alpha > 0): re-export from the source without a matte']]},
   verify:{steps:[
    'In Fix › Mipmaps, the edge at 1/4 … 1/16 should keep the sprite\'s colour after bleeding instead of turning darker.',
    'The result note says how many transparent texels were filled; open the saved PNG in the Channels stage: the A channel is unchanged and RGB under alpha 0 now carries the edge colour.',
    'In the engine, view the object small or far away with mipmaps on: the outline should be gone.']},
   alternatives:{rows:[
    ['Godot 4: Process › Fix Alpha Border (import option)','Textures imported into Godot: it fills transition pixels with the surrounding colour on import and is on by default, so a bled PNG is usually not needed there.'],
    ['Unity: Alpha is Transparency (import option)','Textures imported into Unity: it dilates the colour channels to avoid filtering artifacts at alpha edges.'],
    ['Premultiplied alpha','Your renderer blends premultiplied textures: hidden colour cannot leak at all.']]},
   versions:{body:['Measured on the Texture Lab (docs/TEXTURE-LAB.md): edge bleed changed 448 texels around a 24 × 24 square (exactly four rings), none with alpha above 0; the alpha plane had 0 differing bytes; the first ring read (210, 40, 30, 0). The mipmap preview is the same per-channel box average as `mipChain` in `src/game/texture-fix.js`. Engine import options are quoted from the Godot 4.7 and Unity 6 documentation.'],
    sources:[S.godotImport,S.unityImport]}
  },
  ko:{
   answer:'투명한 스프라이트·잎·데칼 주위의 검은(또는 흰) 테두리는 텍스처의 완전히 투명한 픽셀에 검정이나 흰색 RGB가 남아 있고, 이중선형 필터나 작은 밉맵 레벨이 그 숨은 색을 보이는 가장자리에 섞기 때문에 생깁니다. 해결책은 그 픽셀을 가장자리 자신의 색으로 채우는 것(가장자리 번짐, 딜레이션, 알파 패딩)이거나, 엔진이 가져올 때 하게 하는 것(Godot의 Fix Alpha Border, Unity의 Alpha is Transparency)입니다. Nerulio의 가장자리 번짐은 알파 0 텍셀로 RGB를 2·4·8·16px 밀어 넣으며 알파는 절대 쓰지 않습니다.',
   concept:{title:'테두리가 생기는 곳',body:[
    'PNG는 색과 알파를 따로 저장하므로(스트레이트 알파) 알파가 0인 텍셀에도 RGB 값이 있습니다. 대부분의 프로그램은 거기에 (0, 0, 0)이나 (255, 255, 255)를 씁니다. 1:1에서는 알파 0이 가려서 보이지 않습니다.',
    '필터링과 밉맵은 이웃을 섞습니다. 불투명한 가장자리 텍셀과 투명한 텍셀 사이 한가운데의 이중선형 샘플은 두 색과 두 알파를 평균하고, 밉맵 레벨은 위 레벨의 2 × 2 블록을 평균합니다. 결과의 알파는 맞게 절반이지만 색은 숨은 검정이나 흰색 쪽으로 끌려가 가장자리가 어두워지거나 빛납니다. 밉맵 레벨이 작아질수록 심해지므로 물체가 멀리 있거나 작게 그려질 때만 테두리가 보이는 경우가 많습니다.',
    '가장자리 번짐은 숨은 색을 바꿔 줍니다. Nerulio는 한 바퀴씩 색을 넓힙니다. 이미 색이 있는 텍셀 옆의 투명 텍셀은 그런 이웃(8방향)의 RGB 평균을 받으므로, N바퀴 뒤에는 스프라이트에서 N px 안의 모든 텍셀이 가장자리 색을 가집니다. 알파가 0보다 큰 텍셀은 건드리지 않고 알파 바이트는 하나도 쓰지 않습니다. 미리 곱한 알파 텍스처는 다른 방식으로 문제를 피합니다. 색에 이미 알파가 곱해져 있어 투명 텍셀이 아무것도 더하지 않기 때문입니다.',
    '얼마나 번지게 할까. 박스 필터 밉맵에서 레벨 k의 텍셀 하나는 원본 2ᵏ × 2ᵏ 텍셀을 덮으므로, 가장자리 블록에 섞이는 투명 텍셀은 스프라이트에서 최대 2ᵏ − 1 px 떨어져 있습니다. 따라서 4px 번짐은 1/4 레벨까지, 8px는 1/8까지, 16px는 1/16까지 깨끗하게 지킵니다. 랩의 밉맵 미리보기가 보여 주는 세 레벨입니다.'],
    terms:[['스트레이트 알파','색과 알파를 따로 저장하는 방식. 알파가 0인 곳에도 RGB가 있습니다.'],['가장자리 번짐(딜레이션)','투명 텍셀의 알파는 그대로 두고 가장자리 색을 바깥으로 복사하는 것.'],['밉맵 레벨','텍스처가 작게 그려질 때 GPU가 쓰는 미리 줄인 사본(1/2, 1/4, 1/8 …).'],['미리 곱한 알파','색에 알파를 이미 곱해 둔 방식. 숨은 색이 새어 나올 수 없습니다.']]},
   example:{title:'예시: 가장자리 블록 하나의 전후',lead:'빨간 스프라이트 텍셀 (210, 40, 30, 255) 옆에 검정이 든 투명 텍셀이 있습니다. 밉맵 레벨 1은 2 × 2 블록(불투명 둘, 투명 둘)을 평균합니다.',lines:[
    '번짐 없음   (210+210+0+0)/4, (40+40+0+0)/4, (30+30+0+0)/4, 알파 (255+255+0+0)/4',
    '          = (105, 20, 15, 128)    반투명이면서 밝기도 절반: 어두운 테두리',
    '번짐 있음   투명 텍셀에 이제 (210, 40, 30, 0)이 들어 있음',
    '          = (210, 40, 30, 128)    반투명, 빨강은 그대로',
    '',
    '24 × 24 불투명 사각형 주변에서 채워지는 텍셀 수 (N px 번짐: (24 + 2N)² − 24²):',
    '  2 px → 208    4 px → 448    8 px → 1024    16 px → 2560'],
    after:'4px 값은 랩이 시험 스프라이트에서 측정한 수치와 같습니다. 텍셀 448개가 바뀌었고 모두 알파 0이었으며, 알파 바이트는 하나도 바뀌지 않았습니다.'},
   trouble:{rows:[
    ['물체가 작거나 멀 때만 검은·흰 테두리가 보임','밉맵 레벨이 숨은 RGB를 가장자리에 섞음','보정 › 밉맵에서 번짐 전후의 1/4·1/8·1/16을 비교','보이는 가장 작은 레벨만큼 번지게 하거나(4px → 1/4, 8px → 1/8, 16px → 1/16) 엔진의 가져오기 옵션을 켜기'],
    ['스프라이트가 움직이거나 회전·확대될 때 1:1에서도 얇은 테두리','이중선형 필터가 가장자리와 투명한 이웃 사이를 샘플링','엔진 화면을 확대하면 테두리가 실루엣을 따라감','2px 이상 번지게 하기. 도트 그림은 대신 Nearest 필터 사용([[game/godot-pixel-art-blurry|Godot에서 흐린 도트]])'],
    ['텍스처 크기를 바꾼 뒤 번짐이 사라짐','크기 변경이 캔버스를 거쳐 알파 0 아래의 색을 버림','바꾼 파일을 채널 단계에서 열면 알파 0 아래 RGB가 다시 0','크기를 먼저 바꾸고 번짐은 마지막에. 랩의 내보내기는 크기 변경 → 번짐 → 인코딩 순서로 돌아감'],
    ['WebP·JPEG로 저장하자 번짐이 없어짐','이 형식은 브라우저 캔버스를 거쳐 인코딩되며 JPEG에는 알파가 아예 없음','PNG와 WebP를 채널 단계에서 비교','번짐을 준 텍스처는 PNG로 보관'],
    ['아틀라스에서 옆 스프라이트의 색이 가장자리에 보임','스프라이트를 틈 없이 패킹해 필터가 다음 스프라이트까지 닿음','아틀라스에서 스프라이트끼리 붙어 있는지 확인','번짐이 아니라 스프라이트 사이 여백·익스트루드가 필요: [[atlas-padding|아틀라스 여백]], [[sprite-sheet-maker|스프라이트 시트 패커]]'],
    ['반투명한 가장자리 픽셀 자체가 어두움','검은 매트 위에서 내보내 알파 1~254인 픽셀에 색이 구워져 있음','어두운 픽셀의 알파가 0보다 큼','Nerulio로는 고칠 수 없음(번짐은 알파가 0보다 큰 텍셀을 건드리지 않음). 원본에서 매트 없이 다시 내보내기']]},
   verify:{steps:[
    '보정 › 밉맵에서 번짐 뒤에는 1/4~1/16의 가장자리가 어두워지지 않고 스프라이트 색을 유지해야 합니다.',
    '결과 안내에 채운 투명 텍셀 수가 나옵니다. 저장한 PNG를 채널 단계에서 열면 A 채널은 그대로이고 알파 0 아래 RGB에 가장자리 색이 들어 있습니다.',
    '엔진에서 밉맵을 켠 채 물체를 작게 또는 멀리 봅니다. 테두리가 없어야 합니다.']},
   alternatives:{rows:[
    ['Godot 4: Process › Fix Alpha Border (가져오기 옵션)','Godot로 가져오는 텍스처. 가져올 때 경계 픽셀을 주변 색으로 채우며 기본으로 켜져 있어, 보통은 번짐 PNG가 필요 없습니다.'],
    ['Unity: Alpha is Transparency (가져오기 옵션)','Unity로 가져오는 텍스처. 알파 가장자리의 필터링 결함을 피하려고 색 채널을 딜레이션합니다.'],
    ['미리 곱한 알파','렌더러가 미리 곱한 텍스처로 블렌딩할 때. 숨은 색이 새어 나올 수 없습니다.']]},
   versions:{body:['텍스처 랩에서 측정(docs/TEXTURE-LAB.md): 24 × 24 사각형 주변 텍셀 448개(정확히 네 바퀴)가 바뀌었고 알파가 0보다 큰 텍셀은 없었습니다. 알파 평면은 다른 바이트 0개, 첫 바퀴는 (210, 40, 30, 0). 밉맵 미리보기는 `src/game/texture-fix.js`의 `mipChain`과 같은 채널별 박스 평균입니다. 엔진 가져오기 옵션은 Godot 4.7과 Unity 6 문서에서 인용했습니다.'],
    sources:[S.godotImport,S.unityImport]}
  },
  ja:{
   answer:'透明なスプライト・葉・デカールの周りの黒い（または白い）ふちは、テクスチャの完全に透明なピクセルに黒や白のRGBが残っていて、バイリニアフィルターや小さなミップマップレベルがその隠れた色を見える縁に混ぜるために出ます。直し方は、そのピクセルを縁自身の色で埋める（エッジブリード、ダイレーション、アルファパディング）か、エンジンに読み込み時にやらせる（GodotのFix Alpha Border、UnityのAlpha is Transparency）かです。Nerulioのエッジブリードはアルファ0のテクセルへRGBを2・4・8・16px押し広げ、アルファは一切書き換えません。',
   concept:{title:'ふちはどこから来るか',body:[
    'PNGは色とアルファを別々に保存するので（ストレートアルファ）、アルファ0のテクセルにもRGBの値があります。多くのソフトはそこに(0, 0, 0)か(255, 255, 255)を書きます。等倍ではアルファ0が隠すので見えません。',
    'フィルタリングとミップマップは隣同士を混ぜます。不透明な縁のテクセルと透明なテクセルのちょうど中間のバイリニアサンプルは、2つの色と2つのアルファを平均し、ミップマップの各レベルは上のレベルの2 × 2ブロックを平均します。結果のアルファは正しく半分ですが、色は隠れた黒や白に引っぱられ、縁が暗くなったり光ったりします。レベルが小さくなるほど強まるため、物体が遠いときや小さく描かれたときだけふちが見えることがよくあります。',
    'エッジブリードは隠れた色を置き換えます。Nerulioは1周ずつ色を広げます。すでに色のあるテクセルに隣接する透明テクセルは、その隣（8方向）のRGBの平均を受け取るので、N周の後にはスプライトからN px以内のすべてが縁の色を持ちます。アルファが0より大きいテクセルには触れず、アルファのバイトは1つも書きません。乗算済みアルファのテクスチャは別の方法でこの問題を避けます。色にアルファが掛かっているので、透明なテクセルは何も加えないからです。',
    'どこまでにじませるか。ボックスフィルターのミップマップでは、レベルkの1テクセルが元の2ᵏ × 2ᵏテクセルを覆うため、縁のブロックに混ざる透明テクセルはスプライトから最大2ᵏ − 1 px離れています。したがって4pxのブリードで1/4まで、8pxで1/8まで、16pxで1/16までのレベルがきれいに保たれます。ラボのミップマッププレビューが表示する3つのレベルです。'],
    terms:[['ストレートアルファ','色とアルファを独立に保存する方式。アルファ0の場所にもRGBがあります。'],['エッジブリード（ダイレーション）','透明テクセルのアルファは変えずに、縁の色を外側へコピーすること。'],['ミップマップレベル','テクスチャが小さく描かれるときにGPUが使う縮小済みのコピー（1/2、1/4、1/8 …）。'],['乗算済みアルファ','色にアルファを掛けておく方式。隠れた色が漏れ出すことはありません。']]},
   example:{title:'例：縁のブロック1つの前後',lead:'赤いスプライトのテクセル(210, 40, 30, 255)の隣に、黒を持つ透明なテクセルがあります。ミップマップのレベル1は2 × 2ブロック（不透明2つ、透明2つ）を平均します。',lines:[
    'ブリードなし   (210+210+0+0)/4, (40+40+0+0)/4, (30+30+0+0)/4, アルファ (255+255+0+0)/4',
    '             = (105, 20, 15, 128)    半透明で明るさも半分：暗いふち',
    'ブリードあり   透明テクセルが (210, 40, 30, 0) を持つ',
    '             = (210, 40, 30, 128)    半透明、赤はそのまま',
    '',
    '24 × 24の不透明な正方形の周りで埋まるテクセル数（N pxのブリード：(24 + 2N)² − 24²）：',
    '  2 px → 208    4 px → 448    8 px → 1024    16 px → 2560'],
    after:'4pxの値は、ラボがテスト用スプライトで測定した数値と同じです。448テクセルが変わり、すべてアルファ0で、アルファのバイトは1つも変わりませんでした。'},
   trouble:{rows:[
    ['物体が小さいときや遠いときだけ黒・白のふちが出る','ミップマップのレベルが隠れたRGBを縁に混ぜている','補正 › ミップマップでブリード前後の1/4・1/8・1/16を比べる','見える最小のレベルまでにじませる（4px → 1/4、8px → 1/8、16px → 1/16）か、エンジンのインポート設定を使う'],
    ['スプライトが動く・回る・拡大されると等倍でも細いふちが出る','バイリニアフィルターが縁と透明な隣の間をサンプリングしている','エンジンの画面を拡大するとふちがシルエットに沿っている','2px以上にじませる。ドット絵なら代わりにNearestフィルター（[[game/godot-pixel-art-blurry|Godotでぼやけるドット絵]]）'],
    ['テクスチャをリサイズしたらブリードが消えた','リサイズがCanvasを通り、アルファ0の下の色を捨てた','リサイズ後のファイルをチャンネルステージで開くと、アルファ0の下のRGBが0に戻っている','リサイズを先に、ブリードは最後に。ラボの書き出しはリサイズ → ブリード → エンコードの順で動く'],
    ['WebPやJPEGで保存したらブリードが消えた','これらの形式はブラウザのCanvasを通してエンコードされ、JPEGにはアルファ自体がない','PNGとWebPをチャンネルステージで比べる','ブリードしたテクスチャはPNGで保存する'],
    ['アトラスで隣のスプライトの色が縁に出る','スプライトが隙間なくパックされ、フィルターが隣のスプライトまで届く','アトラスでスプライト同士が接しているか見る','必要なのはブリードではなくスプライト間の余白・押し出し：[[atlas-padding|アトラスの余白]]、[[sprite-sheet-maker|スプライトシートのパッカー]]'],
    ['半透明の縁のピクセル自体が暗い','黒いマット上で書き出され、アルファ1〜254のピクセルに色が焼き込まれている','暗いピクセルのアルファが0より大きい','Nerulioでは直せない（ブリードはアルファが0より大きいテクセルに触れない）。元データからマットなしで書き出し直す']]},
   verify:{steps:[
    '補正 › ミップマップで、ブリード後は1/4〜1/16の縁が暗くならずスプライトの色を保つはずです。',
    '結果の注記に埋めた透明テクセルの数が出ます。保存したPNGをチャンネルステージで開くと、Aチャンネルは変わらず、アルファ0の下のRGBに縁の色が入っています。',
    'エンジンでミップマップを有効にしたまま物体を小さく、または遠くに表示します。ふちが消えているはずです。']},
   alternatives:{rows:[
    ['Godot 4：Process › Fix Alpha Border（インポート設定）','Godotに読み込むテクスチャ。読み込み時に境目のピクセルを周囲の色で埋め、既定でオンなので、通常はブリード済みPNGは不要です。'],
    ['Unity：Alpha is Transparency（インポート設定）','Unityに読み込むテクスチャ。アルファの縁のフィルタリングの乱れを避けるため、色チャンネルをダイレーションします。'],
    ['乗算済みアルファ','レンダラーが乗算済みテクスチャでブレンドする場合。隠れた色が漏れることはありません。']]},
   versions:{body:['テクスチャラボで測定（docs/TEXTURE-LAB.md）：24 × 24の正方形の周りで448テクセル（ちょうど4周）が変わり、アルファが0より大きいものはなし。アルファ平面の差は0バイト、最初の周は(210, 40, 30, 0)。ミップマッププレビューは`src/game/texture-fix.js`の`mipChain`と同じチャンネルごとのボックス平均です。エンジンのインポート設定はGodot 4.7とUnity 6のドキュメントから引用しました。'],
    sources:[S.godotImport,S.unityImport]}
  }
 },
 // ------------------------------------------------------------------ Mask / ORM packer
 'texture-mask-packer':{
  type:'conversion',
  intent:{primary:'pack separate grey maps into one ORM / mask map texture for an engine',secondary:['Unity HDRP mask map layout','Unity URP metallic + smoothness','ORM for glTF and Godot','invert roughness to smoothness while packing','keep bytes under alpha 0'],
   goal:'one PNG whose R, G, B and A hold the right maps in the order the engine reads, imported as linear data',input:'up to four grey maps of the same size (PNG, JPEG, WebP)',output:'FIRSTINPUT-mask.png',target:'Unity HDRP Mask Map, Unity URP Lit metallic/occlusion, Godot 4 ORMMaterial3D, glTF 2.0 metallicRoughness + occlusion (documentation; engine import not run)',support:'partial',
   evidence:['src/mask-packer.js (Rec. 709 luminance per input, invert per channel, own PNG encoder)','src/task/mask-packer.js (presets: ignored → 0, unused alpha → 255; inputs fill channels in order)','docs/TEXTURE-LAB.md (ORM (10,80,220,255), custom (220,10,80,0), inverted R (245,80,220,255))','src/capabilities.js mask-packer checks'],
   external:['Unity HDRP mask map table and import settings','Unity URP channel-packed texture','glTF 2.0 metallicRoughness/occlusion','Godot ORMMaterial3D']},
  en:{
   answer:'Channel packing puts separate grey maps into the R, G, B and A of one PNG in the order your engine reads: Unity HDRP Mask Map = R metallic, G ambient occlusion, B detail mask, A smoothness; Unity URP channel-packed texture = R metallic, G occlusion, A smoothness; ORM for glTF 2.0 and Godot 4 = R occlusion, G roughness, B metallic. Drop up to four same-size grey maps, pick a preset or map each channel yourself, tick Invert where the engine wants smoothness instead of roughness, and download `…-mask.png`. The packed bytes were measured; import into an engine was not run.',
   concept:{title:'How the packer fills each channel',body:[
    'Each input is read as a grey value per texel: its Rec. 709 luminance, 0.2126 R + 0.7152 G + 0.0722 B, rounded. For a real grey map (R = G = B) that is exactly the stored value, so a grey byte goes into its channel unchanged. A coloured image would be mixed down to luminance, which is rarely what you want for a data map.',
    'Presets only choose where inputs go. Inputs fill the meaningful channels in the order you dropped them; a channel the layout ignores is written as 0 and an unused alpha as 255, so the file stays opaque. Nothing is inverted automatically: Unity\'s smoothness is 1 − roughness, so if you hold a roughness map you tick Invert on the smoothness channel (255 − value).',
    'Alpha is data here. In an HDRP or URP texture, smoothness 0 means alpha 0. The packer writes the PNG with its own encoder (32 rows at a time), not through a canvas, so the metallic and AO bytes under those texels survive. Its inputs are read by the browser\'s image decoder, so feed it plain grey PNGs rather than files with transparency.',
    'Import it as data. Unity\'s HDRP page asks you to disable `sRGB (Color Texture)` and use Texture Type Default for the mask map, and URP\'s page asks for sRGB off on its channel-packed texture; glTF 2.0 requires metallic and roughness values to be linear.'],
    terms:[['Mask map','Unity HDRP\'s packed texture: R metallic, G AO, B detail mask, A smoothness.'],['ORM','Occlusion, roughness, metallic in R, G, B — glTF 2.0\'s order, also Godot\'s ORMMaterial3D.'],['Constant channel','A channel written as 0 or 255 everywhere because the layout needs no map there.'],['Invert','255 − value, the 8-bit form of 1 − x; turns roughness into smoothness and back.']]},
   example:{title:'Example: the same three maps in three layouts',lead:'Three grey maps of one texel: AO 10, roughness 80, metallic 220. The mapping line is how the packer shows it (number = dropped file, ⁻ = inverted):',lines:[
    'ORM (glTF 2.0, Godot 4)   files: ao, roughness, metallic     R←1 · G←2 · B←3 · A←255   → (10, 80, 220, 255)',
    'Unity HDRP mask map       files: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    'Unity URP packed          files: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    '',
    'smoothness = 255 − 80 = 175  (1 − 0.314 = 0.686)',
    'Measured in the Lab: ORM preset (10, 80, 220, 255); custom mapping (220, 10, 80, 0); R inverted (245, 80, 220, 255)'],
    after:'The HDRP and URP rows are identical here because there is no detail mask; HDRP would read B as detail mask, URP ignores it. With the HDRP preset and only three files dropped, the third file lands in B, so set B to 0 and A to file 3 with Invert, as shown.'},
   mapping:{title:'Where each grey map goes',head:['Grey map you have','Unity HDRP Mask Map','Unity URP channel-packed','glTF 2.0 / Godot ORM'],rows:[
    ['Metallic','R','R','B'],
    ['Ambient occlusion','G','G (read when the texture is also assigned to Occlusion)','R'],
    ['Roughness','A, inverted (smoothness)','A, inverted (smoothness)','G'],
    ['Detail mask','B','—','—'],
    ['No map for a channel','Constant 0 (e.g. B without detail)','B = 0','A = 255 (unused)']],
    note:'Nerulio\'s "Unity metallic + smoothness" preset follows the Built-in Standard shader page (G and B unused) and writes G = 0. For URP with occlusion, choose Custom and map the AO file to G.'},
   outputs:{rows:[
    ['rock_metallic-mask.png','The packed texture, named after the first file you dropped: 8-bit RGBA PNG, RGB kept where alpha is 0.'],
    ['rock_metallic-mask-channels.zip','Optional check: open the packed file in the [[game/channel-unpacker|channel unpacker]] and save its four planes to compare with your inputs.']]},
   target:{title:'Use the packed texture in the engine',lead:'Steps from the engines\' documentation; Nerulio did not run these imports.',steps:[
    'Unity HDRP: import the PNG, disable `sRGB (Color Texture)`, set Texture Type to `Default`, and assign it to Mask Map under Surface Inputs of the HDRP Lit material. Metallic, Smoothness and AO Remapping sliders appear once a mask map is assigned.',
    'Unity URP: import with `sRGB (Color Texture)` off, set the Lit material\'s Workflow Mode to `Metallic`, assign the texture to Metallic Map and to Occlusion Map, and keep Smoothness › Source at `Metallic Alpha` (the default).',
    'Godot 4: create an `ORMMaterial3D` and assign the ORM PNG as its ORM texture. A `StandardMaterial3D` can read the same file by setting `ao_texture_channel` to Red, `roughness_texture_channel` to Green and `metallic_texture_channel` to Blue.',
    'glTF 2.0: reference the ORM image as the material\'s metallicRoughness texture and, if it carries occlusion, as its occlusion texture too; base colour stays a separate sRGB image.']},
   verify:{steps:[
    'Open the packed PNG in the [[game/channel-unpacker|channel unpacker]] with the same layout: each plane should match the grey map you put there (the capability check measured byte-identical channels on ambientCG grey maps), and inverted channels read 255 − value.',
    'A constant channel shows min = max (0 or 255) in the channel stats.',
    'In the engine, a rough area should look dull and a polished one sharp; if it is the other way round, the smoothness channel was not inverted.']},
   trouble:{rows:[
    ['Rough areas look polished in Unity','Roughness went into alpha without Invert','Unpack A: it equals the roughness map instead of 255 − roughness','Tick Invert on A and pack again'],
    ['A map landed in the wrong channel','Inputs fill channels in the order they were dropped','The mapping line (e.g. `R←1 · G←2 · B←3 · A←255`) under the preview','Pick the right file in each channel\'s drop-down'],
    ['"All channel inputs must have the same dimensions"','One grey map has another size','The file list shows each size','Export every map at the same size first'],
    ['URP material goes dark in ambient light','The texture is assigned to Occlusion, and the Unity preset wrote G = 0','Unpack G: min = max = 0','Map the AO file to G with Custom, or leave Occlusion Map empty'],
    ['Everything too glossy or too matte after import','The packed texture was imported with sRGB on','Unity: the texture\'s `sRGB (Color Texture)` checkbox','Turn sRGB off; the values are data'],
    ['A channel has unexpected values','A coloured input was reduced to its luminance','The input is not grey (R, G, B differ)','Unpack the coloured source to its real channel first, then pack that plane']]},
   alternatives:{rows:[
    ['Godot\'s channel selectors, no packing','Godot only: `StandardMaterial3D` reads each map from a chosen channel of one texture, so an existing packed file in another order needs no repacking.'],
    ['Your texturing application\'s export preset','The maps come from a painting tool that can export in the engine\'s layout directly; Godot\'s docs name Substance Painter and ArmorPaint (Unreal Engine preset) for ORM.'],
    ['Shader Graph (Unity)','Your textures use a layout no preset covers; Unity\'s URP page points to Shader Graph for channels packed differently.']]},
   versions:{body:['Measured on the Texture Lab (docs/TEXTURE-LAB.md): the ORM preset over AO 10 / roughness 80 / metallic 220 wrote (10, 80, 220, 255) from inside the Lab and from this page; a custom mapping gave (220, 10, 80, 0) and an inverted R (245, 80, 220, 255). The browser capability check packs three ambientCG grey maps and finds each channel byte-identical to its input. The layouts come from the documentation below (Godot\'s ORM order from its engine source); no engine import was run.'],
    sources:[S.hdrpMask,S.hdrpLit,S.urpPacked,S.urpLit,S.gltfMR,S.godotOrm,S.godotSrc]}
  },
  ko:{
   answer:'채널 패킹은 따로 있는 회색 맵을 엔진이 읽는 순서대로 PNG 한 장의 R·G·B·A에 넣는 일입니다. Unity HDRP 마스크 맵은 R 메탈릭·G 앰비언트 오클루전·B 디테일 마스크·A 스무스니스, Unity URP 채널 패킹 텍스처는 R 메탈릭·G 오클루전·A 스무스니스, glTF 2.0과 Godot 4용 ORM은 R 오클루전·G 러프니스·B 메탈릭입니다. 크기가 같은 회색 맵을 네 장까지 넣고 프리셋을 고르거나 채널을 직접 배치한 뒤, 엔진이 러프니스 대신 스무스니스를 원하는 채널에 "반전"을 체크하고 `…-mask.png`를 받으세요. 패킹된 바이트는 측정했고 엔진 가져오기는 실행하지 않았습니다.',
   concept:{title:'패커가 채널을 채우는 방식',body:[
    '입력은 텍셀마다 회색 값 하나로 읽힙니다. Rec. 709 휘도, 곧 0.2126 R + 0.7152 G + 0.0722 B를 반올림한 값입니다. 진짜 회색 맵(R = G = B)이면 저장된 값과 정확히 같으므로 회색 바이트가 바뀌지 않고 채널에 들어갑니다. 색이 있는 이미지는 휘도로 섞여 버리는데, 데이터 맵에서 원하는 결과는 거의 아닙니다.',
    '프리셋은 입력이 들어갈 자리만 정합니다. 입력은 넣은 순서대로 의미 있는 채널을 채우고, 배치가 무시하는 채널은 0, 쓰지 않는 알파는 255로 써서 파일이 불투명하게 유지됩니다. 자동 반전은 없습니다. Unity의 스무스니스는 1 − 러프니스이므로 러프니스 맵을 가졌다면 스무스니스 채널에 "반전"(255 − 값)을 체크합니다.',
    '여기서 알파는 데이터입니다. HDRP·URP 텍스처에서 스무스니스 0은 알파 0입니다. 패커는 캔버스가 아니라 자체 인코더로(32줄씩) PNG를 쓰므로 그런 텍셀 아래의 메탈릭·AO 바이트가 살아남습니다. 입력은 브라우저 이미지 디코더로 읽으므로 투명도가 있는 파일보다 평범한 회색 PNG를 넣으세요.',
    '데이터로 가져오세요. Unity HDRP 문서는 마스크 맵의 `sRGB (Color Texture)`를 끄고 Texture Type을 Default로 두라고, URP 문서는 채널 패킹 텍스처의 sRGB를 끄라고 안내하며, glTF 2.0은 메탈릭·러프니스 값이 리니어여야 한다고 규정합니다.'],
    terms:[['마스크 맵','Unity HDRP의 패킹 텍스처. R 메탈릭·G AO·B 디테일 마스크·A 스무스니스.'],['ORM','R·G·B에 오클루전·러프니스·메탈릭. glTF 2.0의 순서이며 Godot ORMMaterial3D도 같습니다.'],['상수 채널','배치상 맵이 필요 없어 전체를 0이나 255로 쓴 채널.'],['반전','255 − 값. 1 − x의 8비트 형태로, 러프니스와 스무스니스를 서로 바꿉니다.']]},
   example:{title:'예시: 같은 맵 세 장을 세 가지 배치로',lead:'텍셀 하나의 회색 맵 세 장: AO 10, 러프니스 80, 메탈릭 220. 배치 줄은 패커가 보여 주는 형식입니다(숫자 = 넣은 파일, ⁻ = 반전).',lines:[
    'ORM (glTF 2.0, Godot 4)   파일: ao, roughness, metallic     R←1 · G←2 · B←3 · A←255   → (10, 80, 220, 255)',
    'Unity HDRP 마스크 맵      파일: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    'Unity URP 패킹            파일: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    '',
    '스무스니스 = 255 − 80 = 175  (1 − 0.314 = 0.686)',
    '랩 측정: ORM 프리셋 (10, 80, 220, 255), 직접 배치 (220, 10, 80, 0), R 반전 (245, 80, 220, 255)'],
    after:'디테일 마스크가 없어서 HDRP와 URP 줄이 같습니다. HDRP는 B를 디테일 마스크로 읽고 URP는 무시합니다. HDRP 프리셋에 파일을 세 장만 넣으면 세 번째 파일이 B에 들어가므로, 위처럼 B를 0으로, A를 3번 파일 반전으로 바꾸세요.'},
   mapping:{title:'회색 맵마다 들어갈 곳',head:['가진 회색 맵','Unity HDRP 마스크 맵','Unity URP 채널 패킹','glTF 2.0 / Godot ORM'],rows:[
    ['메탈릭','R','R','B'],
    ['앰비언트 오클루전','G','G(텍스처를 Occlusion에도 지정하면 읽음)','R'],
    ['러프니스','A, 반전(스무스니스)','A, 반전(스무스니스)','G'],
    ['디테일 마스크','B','—','—'],
    ['채널에 넣을 맵이 없음','상수 0(예: 디테일 없는 B)','B = 0','A = 255(사용 안 함)']],
    note:'Nerulio의 "Unity 메탈릭+스무스니스" 프리셋은 내장 Standard 셰이더 문서(G·B 사용 안 함)를 따라 G에 0을 씁니다. URP에서 오클루전도 쓰려면 직접 배치를 골라 AO 파일을 G에 두세요.'},
   outputs:{rows:[
    ['rock_metallic-mask.png','패킹한 텍스처. 처음 넣은 파일 이름을 따릅니다. 8비트 RGBA PNG이며 알파 0인 곳의 RGB도 유지됩니다.'],
    ['rock_metallic-mask-channels.zip','선택 확인용: 패킹한 파일을 [[game/channel-unpacker|채널 분리기]]로 열어 네 평면을 저장하고 입력과 비교합니다.']]},
   target:{title:'패킹한 텍스처를 엔진에서 쓰기',lead:'엔진 문서에 있는 단계이며 Nerulio가 이 가져오기를 실행하지는 않았습니다.',steps:[
    'Unity HDRP: PNG를 가져와 `sRGB (Color Texture)`를 끄고 Texture Type을 `Default`로 둔 뒤, HDRP Lit 머티리얼의 Surface Inputs에서 Mask Map에 지정합니다. 마스크 맵을 지정하면 Metallic·Smoothness·AO Remapping 슬라이더가 나타납니다.',
    'Unity URP: `sRGB (Color Texture)`를 끄고 가져와 Lit 머티리얼의 Workflow Mode를 `Metallic`으로 두고, 텍스처를 Metallic Map과 Occlusion Map에 지정한 뒤 Smoothness › Source는 기본값 `Metallic Alpha`로 둡니다.',
    'Godot 4: `ORMMaterial3D`를 만들고 ORM PNG를 ORM 텍스처로 지정합니다. `StandardMaterial3D`도 `ao_texture_channel`을 Red, `roughness_texture_channel`을 Green, `metallic_texture_channel`을 Blue로 두면 같은 파일을 읽습니다.',
    'glTF 2.0: ORM 이미지를 머티리얼의 metallicRoughness 텍스처로, 오클루전을 담았다면 오클루전 텍스처로도 참조합니다. 베이스 컬러는 별도의 sRGB 이미지로 둡니다.']},
   verify:{steps:[
    '패킹한 PNG를 같은 배치로 [[game/channel-unpacker|채널 분리기]]에서 엽니다. 각 평면이 넣은 회색 맵과 같아야 하고(기능 점검에서 ambientCG 회색 맵으로 바이트 동일 확인), 반전한 채널은 255 − 값이어야 합니다.',
    '상수 채널은 채널 통계에서 최소 = 최대(0 또는 255)로 보입니다.',
    '엔진에서 거친 곳은 흐리게, 연마된 곳은 날카롭게 보여야 합니다. 반대라면 스무스니스 채널을 반전하지 않은 것입니다.']},
   trouble:{rows:[
    ['Unity에서 거친 곳이 매끈해 보임','러프니스를 반전 없이 알파에 넣음','A를 분리하면 255 − 러프니스가 아니라 러프니스 그대로','A의 "반전"을 체크하고 다시 패킹'],
    ['맵이 엉뚱한 채널에 들어감','입력은 넣은 순서대로 채널을 채움','미리보기 아래 배치 줄(예: `R←1 · G←2 · B←3 · A←255`)','채널마다 선택 상자에서 맞는 파일 고르기'],
    ['"All channel inputs must have the same dimensions"','회색 맵 하나의 크기가 다름','파일 목록에 크기가 나옴','모든 맵을 먼저 같은 크기로 내보내기'],
    ['URP 머티리얼이 주변광에서 어두워짐','텍스처를 Occlusion에 지정했는데 Unity 프리셋이 G에 0을 씀','G를 분리하면 최소 = 최대 = 0','직접 배치로 AO 파일을 G에 두거나 Occlusion Map을 비워 두기'],
    ['가져온 뒤 전체가 너무 번들거리거나 무광','패킹 텍스처를 sRGB 켠 채로 가져옴','Unity 텍스처의 `sRGB (Color Texture)` 체크','sRGB 끄기. 값은 데이터임'],
    ['채널 값이 예상과 다름','색이 있는 입력이 휘도로 줄어듦','입력이 회색이 아님(R·G·B가 다름)','색이 있는 원본을 먼저 실제 채널로 분리한 뒤 그 평면을 패킹']]},
   alternatives:{rows:[
    ['패킹 없이 Godot 채널 선택 사용','Godot 전용. `StandardMaterial3D`가 텍스처 한 장의 원하는 채널에서 맵을 읽으므로, 순서만 다른 기존 패킹 파일은 다시 패킹할 필요가 없습니다.'],
    ['텍스처링 프로그램의 내보내기 프리셋','맵을 그린 도구가 엔진 배치로 바로 내보낼 수 있을 때. Godot 문서는 ORM용으로 Substance Painter와 ArmorPaint(Unreal Engine 프리셋)를 꼽습니다.'],
    ['Shader Graph (Unity)','어느 프리셋에도 없는 배치를 쓸 때. Unity URP 문서도 채널을 다르게 패킹했다면 Shader Graph를 쓰라고 안내합니다.']]},
   versions:{body:['텍스처 랩에서 측정(docs/TEXTURE-LAB.md): AO 10 / 러프니스 80 / 메탈릭 220에 ORM 프리셋을 쓰면 랩 안에서도 이 페이지에서도 (10, 80, 220, 255). 직접 배치는 (220, 10, 80, 0), R 반전은 (245, 80, 220, 255). 브라우저 기능 점검은 ambientCG 회색 맵 세 장을 패킹해 채널마다 입력과 바이트가 같음을 확인합니다. 배치는 아래 문서(Godot ORM 순서는 엔진 소스)에서 왔으며 엔진 가져오기는 실행하지 않았습니다.'],
    sources:[S.hdrpMask,S.hdrpLit,S.urpPacked,S.urpLit,S.gltfMR,S.godotOrm,S.godotSrc]}
  },
  ja:{
   answer:'チャンネルパックとは、別々のグレーマップを、エンジンが読む順番どおりにPNG 1枚のR・G・B・Aへ入れることです。Unity HDRPのマスクマップはRメタリック・Gアンビエントオクルージョン・Bディテールマスク・Aスムースネス、Unity URPのチャンネルパックテクスチャはRメタリック・Gオクルージョン・Aスムースネス、glTF 2.0とGodot 4向けのORMはRオクルージョン・Gラフネス・Bメタリックです。同じサイズのグレーマップを4枚まで入れ、プリセットを選ぶかチャンネルを手動で割り当て、エンジンがラフネスではなくスムースネスを求めるチャンネルに「反転」を付けて`…-mask.png`をダウンロードします。パック後のバイトは測定済みで、エンジンへの読み込みは実行していません。',
   concept:{title:'パッカーが各チャンネルを埋める仕組み',body:[
    '入力はテクセルごとに1つのグレー値として読まれます。Rec. 709の輝度、つまり0.2126 R + 0.7152 G + 0.0722 Bを丸めた値です。本物のグレーマップ（R = G = B）なら保存値とぴったり同じなので、グレーのバイトは変わらずチャンネルに入ります。色のある画像は輝度に混ぜられてしまい、データマップとしては望む結果になることはまずありません。',
    'プリセットが決めるのは入力の行き先だけです。入力は入れた順に意味のあるチャンネルを埋め、配置が無視するチャンネルは0、使わないアルファは255で書くので、ファイルは不透明のままです。自動の反転はありません。Unityのスムースネスは1 − ラフネスなので、ラフネスマップを持っているならスムースネスのチャンネルで「反転」（255 − 値）を付けます。',
    'ここではアルファもデータです。HDRP・URPのテクスチャではスムースネス0がアルファ0です。パッカーはCanvasではなく自前のエンコーダーで（32行ずつ）PNGを書くので、そうしたテクセルの下のメタリックやAOのバイトも残ります。入力はブラウザの画像デコーダーで読むため、透明度のあるファイルではなく普通のグレーPNGを入れてください。',
    'データとして読み込みます。UnityのHDRPのページはマスクマップの`sRGB (Color Texture)`をオフにしTexture TypeをDefaultにするよう、URPのページはチャンネルパックテクスチャのsRGBをオフにするよう案内し、glTF 2.0はメタリックとラフネスの値をリニアと規定しています。'],
    terms:[['マスクマップ','Unity HDRPのパックテクスチャ。Rメタリック・G AO・Bディテールマスク・Aスムースネス。'],['ORM','R・G・Bにオクルージョン・ラフネス・メタリック。glTF 2.0の順で、GodotのORMMaterial3Dも同じです。'],['定数チャンネル','配置上マップが要らないため、全体を0か255で書いたチャンネル。'],['反転','255 − 値。1 − xの8ビット版で、ラフネスとスムースネスを相互に変換します。']]},
   example:{title:'例：同じ3枚のマップを3つの配置で',lead:'1テクセル分のグレーマップ3枚：AO 10、ラフネス 80、メタリック 220。割り当ての行はパッカーの表示形式です（数字 = 入れたファイル、⁻ = 反転）。',lines:[
    'ORM (glTF 2.0, Godot 4)   ファイル: ao, roughness, metallic     R←1 · G←2 · B←3 · A←255   → (10, 80, 220, 255)',
    'Unity HDRPマスクマップ    ファイル: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    'Unity URPパック           ファイル: metallic, ao, roughness     R←1 · G←2 · B←0 · A←3⁻    → (220, 10, 0, 175)',
    '',
    'スムースネス = 255 − 80 = 175  (1 − 0.314 = 0.686)',
    'ラボで測定：ORMプリセット (10, 80, 220, 255)、手動割り当て (220, 10, 80, 0)、R反転 (245, 80, 220, 255)'],
    after:'ディテールマスクがないので、HDRPとURPの行は同じです。HDRPはBをディテールマスクとして読み、URPは無視します。HDRPプリセットにファイルを3枚だけ入れると3枚目がBに入るため、上のようにBを0に、Aを3番のファイルの反転にしてください。'},
   mapping:{title:'グレーマップごとの入れ先',head:['手元のグレーマップ','Unity HDRPマスクマップ','Unity URPチャンネルパック','glTF 2.0 / Godot ORM'],rows:[
    ['メタリック','R','R','B'],
    ['アンビエントオクルージョン','G','G（テクスチャをOcclusionにも割り当てると読まれる）','R'],
    ['ラフネス','A、反転（スムースネス）','A、反転（スムースネス）','G'],
    ['ディテールマスク','B','—','—'],
    ['そのチャンネルに入れるマップがない','定数0（例：ディテールなしのB）','B = 0','A = 255（未使用）']],
    note:'Nerulioの「Unity メタリック+スムースネス」プリセットは組み込みStandardシェーダーのページ（G・Bは未使用）に従い、Gに0を書きます。URPでオクルージョンも使うなら、手動割り当てでAOのファイルをGにしてください。'},
   outputs:{rows:[
    ['rock_metallic-mask.png','パックしたテクスチャ。最初に入れたファイルの名前になります。8ビットRGBAのPNGで、アルファ0の場所のRGBも保持します。'],
    ['rock_metallic-mask-channels.zip','任意の確認用：パックしたファイルを[[game/channel-unpacker|チャンネル分解]]で開き、4つの平面を保存して入力と比べます。']]},
   target:{title:'パックしたテクスチャをエンジンで使う',lead:'各エンジンのドキュメントにある手順で、Nerulioがこの読み込みを実行したわけではありません。',steps:[
    'Unity HDRP：PNGを読み込み、`sRGB (Color Texture)`をオフ、Texture Typeを`Default`にして、HDRP LitマテリアルのSurface InputsでMask Mapに割り当てます。マスクマップを割り当てるとMetallic・Smoothness・AOのRemappingスライダーが現れます。',
    'Unity URP：`sRGB (Color Texture)`をオフにして読み込み、LitマテリアルのWorkflow Modeを`Metallic`にし、テクスチャをMetallic MapとOcclusion Mapに割り当て、Smoothness › Sourceは既定の`Metallic Alpha`のままにします。',
    'Godot 4：`ORMMaterial3D`を作り、ORMのPNGをORMテクスチャとして割り当てます。`StandardMaterial3D`でも、`ao_texture_channel`をRed、`roughness_texture_channel`をGreen、`metallic_texture_channel`をBlueにすれば同じファイルを読めます。',
    'glTF 2.0：ORM画像をマテリアルのmetallicRoughnessテクスチャとして、オクルージョンを含むならオクルージョンテクスチャとしても参照します。ベースカラーは別のsRGB画像のままです。']},
   verify:{steps:[
    'パックしたPNGを同じ配置で[[game/channel-unpacker|チャンネル分解]]で開きます。各平面は入れたグレーマップと同じはずで（機能チェックでambientCGのグレーマップによりバイト一致を確認）、反転したチャンネルは255 − 値のはずです。',
    '定数チャンネルは、チャンネルの統計で最小 = 最大（0か255）と表示されます。',
    'エンジンで、粗い部分はにぶく、磨いた部分は鋭く見えるはずです。逆ならスムースネスのチャンネルを反転していません。']},
   trouble:{rows:[
    ['Unityで粗い部分がつるつるに見える','ラフネスを反転せずにアルファに入れた','Aを分解すると255 − ラフネスではなくラフネスそのもの','Aの「反転」を付けてパックし直す'],
    ['マップが違うチャンネルに入った','入力は入れた順にチャンネルを埋める','プレビュー下の割り当ての行（例：`R←1 · G←2 · B←3 · A←255`）','各チャンネルのプルダウンで正しいファイルを選ぶ'],
    ['「All channel inputs must have the same dimensions」','1枚だけサイズが違う','ファイル一覧に各サイズが出る','先に全マップを同じサイズで書き出す'],
    ['URPのマテリアルが環境光で暗くなる','テクスチャをOcclusionにも割り当てたが、UnityプリセットがGに0を書いた','Gを分解すると最小 = 最大 = 0','手動割り当てでAOのファイルをGにするか、Occlusion Mapを空にする'],
    ['読み込み後、全体がてかりすぎ・つや消しすぎ','パックテクスチャをsRGBオンのまま読み込んだ','Unityのテクスチャの`sRGB (Color Texture)`','sRGBをオフにする。値はデータ'],
    ['チャンネルの値が想定と違う','色のある入力が輝度にまとめられた','入力がグレーでない（R・G・Bが異なる）','色のある元画像を先に実際のチャンネルへ分解し、その平面をパックする']]},
   alternatives:{rows:[
    ['パックせずGodotのチャンネル選択を使う','Godotのみ。`StandardMaterial3D`は1枚のテクスチャの任意のチャンネルからマップを読むため、順番が違うだけの既存のパックファイルはパックし直す必要がありません。'],
    ['テクスチャリングソフトの書き出しプリセット','マップを描いたツールがエンジンの配置で直接書き出せるとき。GodotのドキュメントはORM用としてSubstance PainterとArmorPaint（Unreal Engineプリセット）を挙げています。'],
    ['Shader Graph（Unity）','どのプリセットにもない配置を使うとき。UnityのURPのページも、チャンネルを別の順でパックした場合はShader Graphを案内しています。']]},
   versions:{body:['テクスチャラボで測定（docs/TEXTURE-LAB.md）：AO 10 / ラフネス 80 / メタリック 220にORMプリセットを使うと、ラボ内でもこのページでも(10, 80, 220, 255)。手動割り当ては(220, 10, 80, 0)、R反転は(245, 80, 220, 255)。ブラウザの機能チェックはambientCGのグレーマップ3枚をパックし、各チャンネルが入力とバイト一致することを確認します。配置は下記のドキュメント（GodotのORMの順序はエンジンのソース）に基づき、エンジンへの読み込みは実行していません。'],
    sources:[S.hdrpMask,S.hdrpLit,S.urpPacked,S.urpLit,S.gltfMR,S.godotOrm,S.godotSrc]}
  }
 },
 // ------------------------------------------------------------------ Roughness → smoothness
 'game/roughness-to-smoothness':{
  type:'conversion',
  intent:{primary:'convert a roughness map to the smoothness map Unity expects',secondary:['smoothness = 1 − roughness','where Unity reads smoothness (metallic alpha, HDRP mask alpha)','linear vs sRGB for data maps','gloss maps are already smoothness'],
   goal:'a smoothness channel equal to 255 − roughness, packed where the Unity material reads it and imported as linear data',input:'a roughness map (grey PNG) or the G channel of an ORM texture',output:'NAME-g-inverted-roughness.png, or a packed NAME-mask.png with smoothness in alpha',target:'Unity 6 URP Lit / Built-in Standard / HDRP Lit (documentation; import not run)',support:'partial',
   evidence:['src/game/texture-channels.js (invertPlane: exactly 255 − v)','docs/TEXTURE-LAB.md (Roughness → smoothness inversion VERIFIED: saved plane equals 255 − roughness)','src/capabilities.js (roughness-to-smoothness check)','src/task/texture-lab-maps.js (file names)'],
   external:['Unity CommonMaterial.hlsl PerceptualSmoothnessToPerceptualRoughness = 1 − s','URP Lit Smoothness Source','URP channel-packed texture','HDRP mask map','Unity sRGB (Color Texture)']},
  en:{
   answer:'Unity\'s metallic workflow reads smoothness, while glTF, Godot and most PBR texture sources give roughness. Unity\'s own shader library defines perceptual roughness as 1 − smoothness, so the conversion is an exact inversion: smoothness = 1 − roughness, which is 255 − value in an 8-bit PNG (roughness 80 → smoothness 175). Do it on linear data and put the result where Unity reads it — the alpha of the URP / Built-in metallic map or of the HDRP mask map. Nerulio inverts the channel byte-exactly in the browser (measured); Unity import was not run.',
   concept:{title:'Roughness, smoothness and why gamma matters',body:[
    'Both maps describe the same thing from opposite ends: roughness 0 is a mirror, roughness 1 fully rough; smoothness 1 is a mirror. In Unity\'s render-pipeline shader library, `PerceptualSmoothnessToPerceptualRoughness` returns 1 − smoothness, and only afterwards is the value squared (`PerceptualRoughnessToRoughness`). Both maps store the perceptual value an artist paints, so you invert — you do not square or take a square root.',
    'Inversion is exact only on linear data. The bytes of a roughness map are numbers, not colours. If a map is treated as sRGB anywhere — a colour-managed editor or an importer with sRGB on — the values move: a smoothness byte of 175 means 0.686 as linear data but about 0.429 when decoded as sRGB. So import the result with `sRGB (Color Texture)` off, and do not "correct" it with a gamma curve.',
    'Where the smoothness goes. URP Lit takes it from the alpha of the Metallic Map (Smoothness › Source `Metallic Alpha`, the default) or from the base map\'s alpha; URP\'s channel-packed texture and the Built-in Standard shader\'s metallic map both hold it in A; HDRP\'s Mask Map holds it in A. A lone grey smoothness PNG is only useful for a custom shader or for packing.',
    'A gloss or glossiness map already is smoothness. Nerulio\'s name rules classify `gloss` as smoothness for that reason; inverting it would give roughness back.'],
    terms:[['Roughness','0 = mirror-smooth, 1 (255) = fully rough; the glTF, Godot and Unreal convention.'],['Smoothness','Unity\'s inverse: 1 − roughness.'],['Perceptual roughness','The painted value; engines square it before lighting.'],['Linear (non-colour) data','Values used as stored, without sRGB decoding.']]},
   example:{title:'Example: the numbers',lead:'Four roughness bytes, inverted exactly as the Lab writes them:',lines:[
    'roughness byte   roughness   smoothness = 1 − r   smoothness byte (255 − v)',
    '  0              0.000       1.000                255',
    ' 80              0.314       0.686                175',
    '128              0.502       0.498                127',
    '255              1.000       0.000                  0',
    '',
    'Same byte 175 imported with sRGB (Color Texture) on:',
    '175 / 255 = 0.686 → sRGB decode → 0.429   (a noticeably rougher surface)'],
    after:'Inverting twice returns the original bytes, so the conversion loses nothing. The Lab measured it on the downloaded file: the saved plane equals 255 − roughness at every texel.'},
   mapping:{title:'From your roughness to Unity\'s smoothness',head:['You have','In Nerulio','In Unity'],rows:[
    ['A grey roughness PNG','Channels: Invert the channel labelled roughness, save it','A grey smoothness map (for packing or a custom shader)'],
    ['Roughness + metallic PNGs','Mask packer, preset "Unity metallic + smoothness": R ← metallic, A ← roughness inverted','URP / Built-in: Metallic Map, smoothness from Metallic Alpha'],
    ['Roughness + metallic + AO (+ detail)','Mask packer, preset "Unity HDRP mask": R metallic, G AO, B detail or 0, A roughness inverted','HDRP Lit: Mask Map'],
    ['An ORM texture (roughness in G)','Channels, layout ORM: Invert G, save; then pack it into A','Alpha of the metallic map or mask map'],
    ['A gloss / glossiness map','Nothing to invert: it is already smoothness','Pack it into A as it is']]},
   outputs:{rows:[
    ['rock_roughness-g-inverted-roughness.png','The inverted plane as an 8-bit grey PNG. The name keeps the source role (`roughness`) with `inverted-` in front, so its content is smoothness.'],
    ['rock_metallic-mask.png','From the mask packer: metallic in R and the inverted roughness in A (plus AO and detail for HDRP), ready for the Unity material.']]},
   target:{title:'Put the smoothness where Unity reads it',lead:'Unity steps follow the Unity 6 / HDRP 17.1 documentation; Nerulio did not run the import.',steps:[
    'Open the [[texture-mask-packer|mask packer]], drop the metallic map first and the roughness map second, and choose "Unity metallic + smoothness" (URP / Built-in) or "Unity HDRP mask" (then map AO to G and set B to 0 if you have no detail mask).',
    'Tick Invert on the A channel and download the packed PNG. For URP with ambient occlusion, switch to Custom and put the AO file in G.',
    'In Unity, select the texture and turn off `sRGB (Color Texture)`; for HDRP also set Texture Type to `Default`.',
    'URP Lit: Workflow Mode `Metallic`, assign the texture to Metallic Map (and Occlusion Map if G holds AO), keep Smoothness › Source on `Metallic Alpha`.',
    'HDRP Lit: assign it to Mask Map under Surface Inputs; the Smoothness Remapping slider rescales the range if the result needs tuning.']},
   verify:{steps:[
    'Unpack the packed PNG in the [[game/channel-unpacker|channel unpacker]]: A should read 255 − roughness everywhere (a texel of roughness 80 reads 175).',
    'In Unity, compare a known rough area (dull, broad highlight) with a polished one (sharp highlight). Reversed means the channel was not inverted, or was inverted twice.',
    'Check the texture\'s Inspector: `sRGB (Color Texture)` must be off for the packed map.']},
   trouble:{rows:[
    ['Everything looks wet or mirror-like','Roughness went into alpha without inversion','Unpack A and compare it with the roughness map: identical instead of inverted','Tick Invert on A and pack again'],
    ['Surfaces look rougher than in the texturing app','The packed map is imported as sRGB (175 is read as about 0.429)','Unity Inspector: `sRGB (Color Texture)` is on','Turn it off; do not apply a gamma curve to compensate'],
    ['The smoothness map has no effect','Smoothness › Source is `Albedo Alpha`, or a tool saved the PNG without its alpha channel','Material Inspector; unpack the PNG and check that A is not constant 255','Set Source to `Metallic Alpha`, and save packed maps as RGBA PNG'],
    ['A gloss map ended up rough where it was shiny','A gloss map is already smoothness and was inverted','The source file name contains `gloss` or `glossiness`','Pack it without Invert'],
    ['URP material darkens in ambient light','The packed texture is also assigned to Occlusion but G was written as 0','Unpack G: constant 0','Put the AO file in G with Custom mapping, or leave Occlusion Map empty']]},
   alternatives:{rows:[
    ['Invert in an image editor','A grey 8-bit roughness map in an editor that does not colour-manage it: Invert gives the same 255 − v; you still have to pack it into alpha yourself.'],
    ['Shader Graph (Unity)','You would rather keep the roughness texture and invert in the shader; Unity\'s URP page points to Shader Graph for layouts other than the default packing.'],
    ['[[game/channel-unpacker|Channel unpacker]]','The roughness is inside another packed texture (an ORM\'s G) and has to come out first.']]},
   versions:{body:['Measured on the Texture Lab (docs/TEXTURE-LAB.md): inverting G of a roughness map and downloading it gave a plane equal to 255 − roughness exactly, and the stage showed the in → out pair; the packer\'s inverted-R check gave (245, 80, 220, 255) from an AO of 10. The 1 − smoothness relation is from Unity\'s render-pipeline source; channel locations and import settings are from the Unity pages below. Unity import was not run.'],
    sources:[S.unitySmooth,S.urpLit,S.urpPacked,S.hdrpMask,S.unityMetallic,S.unityImport]}
  },
  ko:{
   answer:'Unity 메탈릭 워크플로는 스무스니스를 읽는데, glTF·Godot와 대부분의 PBR 텍스처 소스는 러프니스를 줍니다. Unity 셰이더 라이브러리는 지각 러프니스를 1 − 스무스니스로 정의하므로 변환은 정확한 반전입니다. 스무스니스 = 1 − 러프니스, 8비트 PNG로는 255 − 값입니다(러프니스 80 → 스무스니스 175). 리니어 데이터 상태에서 반전하고, 결과를 Unity가 읽는 곳, 곧 URP·내장 메탈릭 맵의 알파나 HDRP 마스크 맵의 알파에 넣으세요. Nerulio는 브라우저에서 채널을 바이트 단위로 정확히 반전하며(측정함), Unity 가져오기는 실행하지 않았습니다.',
   concept:{title:'러프니스·스무스니스와 감마가 중요한 이유',body:[
    '두 맵은 같은 성질을 반대쪽에서 나타냅니다. 러프니스 0은 거울, 1은 완전히 거칢이고, 스무스니스 1이 거울입니다. Unity 렌더 파이프라인 셰이더 라이브러리의 `PerceptualSmoothnessToPerceptualRoughness`는 1 − 스무스니스를 돌려주고, 그 뒤에야 값을 제곱합니다(`PerceptualRoughnessToRoughness`). 두 맵 모두 아티스트가 칠하는 지각 값을 저장하므로 반전만 하면 되고 제곱이나 제곱근은 하지 않습니다.',
    '반전이 정확한 것은 리니어 데이터일 때뿐입니다. 러프니스 맵의 바이트는 색이 아니라 숫자입니다. 색 관리를 하는 편집기나 sRGB를 켠 임포터처럼 어디서든 sRGB로 취급되면 값이 움직입니다. 스무스니스 바이트 175는 리니어 데이터로는 0.686이지만 sRGB로 디코딩하면 약 0.429입니다. 그러니 결과는 `sRGB (Color Texture)`를 끄고 가져오고, 감마 곡선으로 "보정"하지 마세요.',
    '스무스니스가 들어갈 곳. URP Lit은 Metallic Map의 알파(Smoothness › Source `Metallic Alpha`, 기본값)나 베이스 맵의 알파에서 읽습니다. URP 채널 패킹 텍스처와 내장 Standard 셰이더의 메탈릭 맵은 A에, HDRP 마스크 맵도 A에 담습니다. 회색 스무스니스 PNG 한 장은 커스텀 셰이더나 패킹에만 쓸모가 있습니다.',
    '글로스(glossiness) 맵은 이미 스무스니스입니다. 그래서 Nerulio의 이름 규칙은 `gloss`를 스무스니스로 분류하며, 반전하면 러프니스로 되돌아갑니다.'],
    terms:[['러프니스','0 = 거울처럼 매끈, 1(255) = 완전히 거칢. glTF·Godot·Unreal의 규약.'],['스무스니스','Unity의 반대값: 1 − 러프니스.'],['지각 러프니스','칠해서 저장하는 값. 엔진은 조명 계산 전에 제곱합니다.'],['리니어(비색상) 데이터','sRGB 디코딩 없이 저장된 그대로 쓰는 값.']]},
   example:{title:'예시: 숫자로 보기',lead:'러프니스 바이트 네 개를 랩이 쓰는 방식 그대로 반전한 값입니다.',lines:[
    '러프니스 바이트   러프니스   스무스니스 = 1 − r   스무스니스 바이트 (255 − v)',
    '  0              0.000       1.000                255',
    ' 80              0.314       0.686                175',
    '128              0.502       0.498                127',
    '255              1.000       0.000                  0',
    '',
    '같은 바이트 175를 sRGB (Color Texture) 켠 채로 가져오면:',
    '175 / 255 = 0.686 → sRGB 디코딩 → 0.429   (눈에 띄게 거친 표면)'],
    after:'두 번 반전하면 원래 바이트로 돌아오므로 변환에 손실이 없습니다. 랩은 내려받은 파일에서 저장된 평면이 모든 텍셀에서 255 − 러프니스와 같음을 측정했습니다.'},
   mapping:{title:'러프니스에서 Unity 스무스니스로',head:['가진 것','Nerulio에서','Unity에서'],rows:[
    ['회색 러프니스 PNG','채널: 러프니스로 표시된 채널을 반전해 저장','회색 스무스니스 맵(패킹이나 커스텀 셰이더용)'],
    ['러프니스 + 메탈릭 PNG','마스크 패커, "Unity 메탈릭+스무스니스" 프리셋: R ← 메탈릭, A ← 러프니스 반전','URP·내장: Metallic Map, 스무스니스는 Metallic Alpha에서'],
    ['러프니스 + 메탈릭 + AO(+ 디테일)','마스크 패커, "Unity HDRP 마스크" 프리셋: R 메탈릭, G AO, B 디테일 또는 0, A 러프니스 반전','HDRP Lit: Mask Map'],
    ['ORM 텍스처(G에 러프니스)','채널, ORM 배치: G 반전 후 저장, 그다음 A에 패킹','메탈릭 맵이나 마스크 맵의 알파'],
    ['글로스·glossiness 맵','반전할 것 없음: 이미 스무스니스','그대로 A에 패킹']]},
   outputs:{rows:[
    ['rock_roughness-g-inverted-roughness.png','반전한 평면을 담은 8비트 회색 PNG. 이름은 원래 역할(`roughness`) 앞에 `inverted-`가 붙으므로 내용은 스무스니스입니다.'],
    ['rock_metallic-mask.png','마스크 패커 결과: R에 메탈릭, A에 반전한 러프니스(HDRP면 AO와 디테일도). Unity 머티리얼에 바로 씁니다.']]},
   target:{title:'Unity가 읽는 곳에 스무스니스 넣기',lead:'Unity 단계는 Unity 6·HDRP 17.1 문서를 따르며, Nerulio가 가져오기를 실행하지는 않았습니다.',steps:[
    '[[texture-mask-packer|마스크 패커]]를 열고 메탈릭 맵을 먼저, 러프니스 맵을 두 번째로 넣은 뒤 "Unity 메탈릭+스무스니스"(URP·내장)나 "Unity HDRP 마스크"를 고릅니다(HDRP에서 디테일 마스크가 없으면 AO를 G에, B는 0으로).',
    'A 채널의 "반전"을 체크하고 패킹한 PNG를 받습니다. URP에서 앰비언트 오클루전도 쓰려면 직접 배치로 바꿔 AO 파일을 G에 둡니다.',
    'Unity에서 텍스처를 선택해 `sRGB (Color Texture)`를 끕니다. HDRP는 Texture Type도 `Default`로 둡니다.',
    'URP Lit: Workflow Mode `Metallic`, 텍스처를 Metallic Map(G에 AO가 있으면 Occlusion Map에도)에 지정하고 Smoothness › Source는 `Metallic Alpha`로 둡니다.',
    'HDRP Lit: Surface Inputs의 Mask Map에 지정합니다. 결과를 조정해야 하면 Smoothness Remapping 슬라이더로 범위를 다시 맞춥니다.']},
   verify:{steps:[
    '패킹한 PNG를 [[game/channel-unpacker|채널 분리기]]에서 풉니다. A는 어디서나 255 − 러프니스여야 합니다(러프니스 80인 텍셀은 175).',
    'Unity에서 거친 곳(흐리고 넓은 하이라이트)과 연마된 곳(날카로운 하이라이트)을 비교합니다. 반대라면 반전하지 않았거나 두 번 반전한 것입니다.',
    '텍스처 인스펙터에서 패킹 맵의 `sRGB (Color Texture)`가 꺼져 있어야 합니다.']},
   trouble:{rows:[
    ['전부 젖은 듯하거나 거울처럼 보임','러프니스를 반전 없이 알파에 넣음','A를 풀어 러프니스 맵과 비교하면 반전되지 않고 똑같음','A의 "반전"을 체크하고 다시 패킹'],
    ['텍스처링 프로그램보다 표면이 거칠어 보임','패킹 맵을 sRGB로 가져옴(175가 약 0.429로 읽힘)','Unity 인스펙터에서 `sRGB (Color Texture)`가 켜짐','끄기. 감마 곡선으로 보정하지 않기'],
    ['스무스니스 맵이 효과가 없음','Smoothness › Source가 `Albedo Alpha`이거나, 어떤 도구가 알파 채널 없이 PNG를 저장함','머티리얼 인스펙터 확인, PNG를 풀어 A가 상수 255가 아닌지 확인','Source를 `Metallic Alpha`로, 패킹 맵은 RGBA PNG로 저장'],
    ['반짝이던 곳이 거칠어진 글로스 맵','글로스 맵은 이미 스무스니스인데 반전함','원본 파일 이름에 `gloss`나 `glossiness`가 있음','반전 없이 패킹'],
    ['URP 머티리얼이 주변광에서 어두워짐','패킹 텍스처를 Occlusion에도 지정했는데 G가 0으로 쓰임','G를 풀면 상수 0','직접 배치로 AO 파일을 G에 두거나 Occlusion Map 비우기']]},
   alternatives:{rows:[
    ['이미지 편집기에서 반전','색 관리를 하지 않는 편집기에서 8비트 회색 러프니스 맵을 다룰 때. 반전 결과는 똑같이 255 − v지만 알파로 패킹하는 것은 직접 해야 합니다.'],
    ['Shader Graph (Unity)','러프니스 텍스처를 그대로 두고 셰이더에서 반전하고 싶을 때. Unity URP 문서는 기본 패킹과 다른 배치에 Shader Graph를 안내합니다.'],
    ['[[game/channel-unpacker|채널 분리기]]','러프니스가 다른 패킹 텍스처(ORM의 G) 안에 있어 먼저 꺼내야 할 때.']]},
   versions:{body:['텍스처 랩에서 측정(docs/TEXTURE-LAB.md): 러프니스 맵의 G를 반전해 내려받으면 평면이 정확히 255 − 러프니스였고, 단계 화면에 원본 → 결과가 나란히 나왔습니다. 패커의 R 반전 점검은 AO 10에서 (245, 80, 220, 255)를 냈습니다. 1 − 스무스니스 관계는 Unity 렌더 파이프라인 소스에서, 채널 위치와 가져오기 설정은 아래 Unity 문서에서 왔습니다. Unity 가져오기는 실행하지 않았습니다.'],
    sources:[S.unitySmooth,S.urpLit,S.urpPacked,S.hdrpMask,S.unityMetallic,S.unityImport]}
  },
  ja:{
   answer:'Unityのメタリックワークフローはスムースネスを読みますが、glTF・Godotや多くのPBRテクスチャの素材はラフネスを提供します。Unityのシェーダーライブラリは知覚ラフネスを1 − スムースネスと定義しているので、変換は厳密な反転です。スムースネス = 1 − ラフネス、8ビットのPNGでは255 − 値です（ラフネス80 → スムースネス175）。リニアなデータのまま反転し、結果をUnityが読む場所、つまりURP・組み込みのメタリックマップのアルファか、HDRPのマスクマップのアルファに入れます。Nerulioはブラウザ上でチャンネルをバイト単位で正確に反転し（測定済み）、Unityへの読み込みは実行していません。',
   concept:{title:'ラフネス・スムースネスと、ガンマが問題になる理由',body:[
    '2つのマップは同じ性質を逆側から表します。ラフネス0が鏡、1が完全に粗い面で、スムースネスは1が鏡です。Unityのレンダーパイプラインのシェーダーライブラリでは`PerceptualSmoothnessToPerceptualRoughness`が1 − スムースネスを返し、その後で値を2乗します（`PerceptualRoughnessToRoughness`）。どちらのマップもアーティストが描く知覚値を保存しているので、反転するだけで、2乗や平方根はとりません。',
    '反転が厳密なのはリニアなデータのときだけです。ラフネスマップのバイトは色ではなく数値です。カラーマネジメントをする編集ソフトやsRGBをオンにしたインポーターなど、どこかでsRGBとして扱われると値がずれます。スムースネスのバイト175はリニアなら0.686ですが、sRGBとしてデコードすると約0.429です。結果は`sRGB (Color Texture)`をオフにして読み込み、ガンマカーブで「補正」しないでください。',
    'スムースネスの入れ先。URPのLitはMetallic Mapのアルファ（Smoothness › Source `Metallic Alpha`、既定）かベースマップのアルファから読みます。URPのチャンネルパックテクスチャと組み込みStandardシェーダーのメタリックマップはAに、HDRPのマスクマップもAに持ちます。グレーのスムースネスPNG単体は、カスタムシェーダーかパック用にしか使えません。',
    'グロス（glossiness）マップはすでにスムースネスです。そのためNerulioの名前のルールは`gloss`をスムースネスに分類し、反転するとラフネスに戻ってしまいます。'],
    terms:[['ラフネス','0 = 鏡のように滑らか、1（255）= 完全に粗い。glTF・Godot・Unrealの規約。'],['スムースネス','Unityの逆値：1 − ラフネス。'],['知覚ラフネス','描いて保存する値。エンジンはライティングの前に2乗します。'],['リニア（非カラー）データ','sRGBデコードせず保存値のまま使う値。']]},
   example:{title:'例：数値で見る',lead:'ラフネスのバイト4つを、ラボが書くとおりに反転した値です。',lines:[
    'ラフネスのバイト  ラフネス    スムースネス = 1 − r   スムースネスのバイト (255 − v)',
    '  0              0.000       1.000                255',
    ' 80              0.314       0.686                175',
    '128              0.502       0.498                127',
    '255              1.000       0.000                  0',
    '',
    '同じバイト175をsRGB (Color Texture)オンで読み込むと：',
    '175 / 255 = 0.686 → sRGBデコード → 0.429   （目に見えて粗い面）'],
    after:'2回反転すると元のバイトに戻るので、変換で何も失いません。ラボはダウンロードしたファイルで、保存した平面がすべてのテクセルで255 − ラフネスと一致することを測定しました。'},
   mapping:{title:'ラフネスからUnityのスムースネスへ',head:['手元にあるもの','Nerulioで','Unityで'],rows:[
    ['グレーのラフネスPNG','チャンネル：ラフネスと表示されたチャンネルを反転して保存','グレーのスムースネスマップ（パックやカスタムシェーダー用）'],
    ['ラフネス + メタリックのPNG','マスクパッカー、「Unity メタリック+スムースネス」プリセット：R ← メタリック、A ← ラフネス反転','URP・組み込み：Metallic Map、スムースネスはMetallic Alphaから'],
    ['ラフネス + メタリック + AO（+ ディテール）','マスクパッカー、「Unity HDRP マスク」プリセット：Rメタリック、G AO、Bディテールか0、Aラフネス反転','HDRP Lit：Mask Map'],
    ['ORMテクスチャ（Gにラフネス）','チャンネル、ORM配置：Gを反転して保存し、Aにパック','メタリックマップかマスクマップのアルファ'],
    ['グロス・glossinessマップ','反転不要：すでにスムースネス','そのままAにパック']]},
   outputs:{rows:[
    ['rock_roughness-g-inverted-roughness.png','反転した平面の8ビットグレーPNG。名前は元の役割（`roughness`）の前に`inverted-`が付くので、中身はスムースネスです。'],
    ['rock_metallic-mask.png','マスクパッカーの結果：Rにメタリック、Aに反転したラフネス（HDRPならAOとディテールも）。Unityのマテリアルにそのまま使えます。']]},
   target:{title:'Unityが読む場所にスムースネスを入れる',lead:'Unityの手順はUnity 6・HDRP 17.1のドキュメントに従ったもので、Nerulioは読み込みを実行していません。',steps:[
    '[[texture-mask-packer|マスクパッカー]]を開き、メタリックマップを1枚目、ラフネスマップを2枚目に入れて、「Unity メタリック+スムースネス」（URP・組み込み）か「Unity HDRP マスク」を選びます（HDRPでディテールマスクがなければAOをGに、Bは0に）。',
    'Aチャンネルの「反転」を付け、パックしたPNGをダウンロードします。URPでアンビエントオクルージョンも使うなら手動割り当てに切り替え、AOのファイルをGにします。',
    'Unityでテクスチャを選び、`sRGB (Color Texture)`をオフにします。HDRPではTexture Typeも`Default`にします。',
    'URP Lit：Workflow Mode `Metallic`、テクスチャをMetallic Map（GにAOがあればOcclusion Mapにも）に割り当て、Smoothness › Sourceは`Metallic Alpha`のままにします。',
    'HDRP Lit：Surface InputsのMask Mapに割り当てます。調整が必要ならSmoothness Remappingのスライダーで範囲を合わせ直します。']},
   verify:{steps:[
    'パックしたPNGを[[game/channel-unpacker|チャンネル分解]]で開きます。Aはどこでも255 − ラフネスのはずです（ラフネス80のテクセルは175）。',
    'Unityで粗い部分（にぶく広いハイライト）と磨いた部分（鋭いハイライト）を比べます。逆なら反転していないか、2回反転しています。',
    'テクスチャのインスペクターで、パックマップの`sRGB (Color Texture)`がオフになっているはずです。']},
   trouble:{rows:[
    ['全体が濡れたよう、鏡のように見える','ラフネスを反転せずアルファに入れた','Aを分解してラフネスマップと比べると、反転されず同じ','Aの「反転」を付けてパックし直す'],
    ['テクスチャリングソフトより面が粗く見える','パックマップをsRGBで読み込んだ（175が約0.429になる）','Unityのインスペクターで`sRGB (Color Texture)`がオン','オフにする。ガンマカーブで補正しない'],
    ['スムースネスマップが効かない','Smoothness › Sourceが`Albedo Alpha`、またはどこかのツールがアルファなしでPNGを保存した','マテリアルのインスペクターを確認し、PNGを分解してAが定数255でないか見る','Sourceを`Metallic Alpha`にし、パックマップはRGBAのPNGで保存'],
    ['つやのあった部分が粗くなったグロスマップ','グロスマップはすでにスムースネスなのに反転した','元のファイル名に`gloss`や`glossiness`がある','反転せずにパックする'],
    ['URPのマテリアルが環境光で暗くなる','パックテクスチャをOcclusionにも割り当てたが、Gが0で書かれている','Gを分解すると定数0','手動割り当てでAOのファイルをGにするか、Occlusion Mapを空にする']]},
   alternatives:{rows:[
    ['画像編集ソフトで反転','カラーマネジメントをしないソフトで8ビットのグレーのラフネスマップを扱うとき。反転結果は同じ255 − vですが、アルファへのパックは自分で行う必要があります。'],
    ['Shader Graph（Unity）','ラフネスのテクスチャのまま、シェーダー内で反転したいとき。UnityのURPのページは、既定と違うパックにはShader Graphを案内しています。'],
    ['[[game/channel-unpacker|チャンネル分解]]','ラフネスが別のパックテクスチャ（ORMのG）の中にあり、先に取り出す必要があるとき。']]},
   versions:{body:['テクスチャラボで測定（docs/TEXTURE-LAB.md）：ラフネスマップのGを反転してダウンロードすると、平面は正確に255 − ラフネスで、ステージには元 → 結果が並んで表示されました。パッカーのR反転のチェックはAO 10から(245, 80, 220, 255)を出しました。1 − スムースネスの関係はUnityのレンダーパイプラインのソース、チャンネルの位置とインポート設定は下記のUnityのページに基づきます。Unityへの読み込みは実行していません。'],
    sources:[S.unitySmooth,S.urpLit,S.urpPacked,S.hdrpMask,S.unityMetallic,S.unityImport]}
  }
 },
};
