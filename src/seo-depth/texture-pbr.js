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
};
