/** Engine channel layouts as data, with the documentation each claim rests on. Nothing here is
 * inferred from a forum post: every preset carries `doc` (the page that states it) and, where an
 * engine does not document its own channel order, `orderSource` says where the order actually
 * comes from. The channel packer and the unpacker both read this file, so a layout is described
 * once. Tooltips exist in ko/en/ja because the UI shows them verbatim. */
export const CHANNEL_LETTERS=Object.freeze(['r','g','b','a']);
const channel=(letter,role,label,tooltip,extra={})=>({channel:letter,role,label,tooltip,colorSpace:'linear',...extra});
export const ENGINE_PRESETS=Object.freeze({
 'unity-hdrp-mask':{
  engine:'unity',
  label:{ko:'Unity HDRP 마스크 맵',en:'Unity HDRP Mask Map',ja:'Unity HDRP マスクマップ'},
  summary:{ko:'R 메탈릭 · G 앰비언트 오클루전 · B 디테일 마스크 · A 스무스니스',en:'R metallic · G ambient occlusion · B detail mask · A smoothness',ja:'R メタリック・G アンビエントオクルージョン・B ディテールマスク・A スムースネス'},
  orderSource:'engine-docs',
  doc:{title:'Mask and detail maps — High Definition Render Pipeline',section:'Mask map',url:'https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html'},
  channels:[
   channel('r','metallic',{ko:'메탈릭',en:'Metallic',ja:'メタリック'},{ko:'금속 여부. 0은 비금속, 255는 금속입니다. HDRP 문서의 마스크 맵 표에 R = Metallic으로 명시되어 있습니다.',en:'Metal or not: 0 is dielectric, 255 is metal. The HDRP mask map table states R = Metallic.',ja:'金属かどうか。0が非金属、255が金属。HDRPのマスクマップ表にR = Metallicと明記されています。'}),
   channel('g','ao',{ko:'앰비언트 오클루전',en:'Ambient occlusion',ja:'アンビエントオクルージョン'},{ko:'주변광이 닿기 어려운 정도. 밝을수록 가려지지 않은 면입니다.',en:'How much ambient light reaches the surface; brighter means less occluded.',ja:'環境光の届きにくさ。明るいほど遮られていない面です。'}),
   channel('b','detail',{ko:'디테일 마스크',en:'Detail mask',ja:'ディテールマスク'},{ko:'디테일 맵을 적용할 영역. HDRP에서만 쓰이며 다른 엔진에는 대응 슬롯이 없습니다.',en:'Where the detail map is applied. HDRP-specific: other engines have no matching slot.',ja:'ディテールマップを適用する範囲。HDRP専用で、他エンジンに対応スロットはありません。'}),
   channel('a','smoothness',{ko:'스무스니스',en:'Smoothness',ja:'スムースネス'},{ko:'러프니스의 반대값입니다. 러프니스 맵을 넣으려면 255에서 뺀 값으로 반전하세요.',en:'The inverse of roughness. A roughness map must be inverted (255 − value) before it goes here.',ja:'ラフネスの逆値。ラフネスマップは255から引いて反転してください。'},{invertOf:'roughness'})
  ]},
 'unity-urp-metallic':{
  engine:'unity',
  label:{ko:'Unity URP·내장 메탈릭 맵',en:'Unity URP / Built-in Metallic map',ja:'Unity URP・組み込みメタリックマップ'},
  summary:{ko:'R 메탈릭 (G·B 무시) · A 스무스니스',en:'R metallic (G and B ignored) · A smoothness',ja:'R メタリック（G・Bは無視）・A スムースネス'},
  orderSource:'engine-docs',
  doc:{title:'Configure reflections with the Standard Shader — Unity Manual',section:'Metallic parameter',url:'https://docs.unity3d.com/Manual/StandardShaderMaterialParameterMetallic.html'},
  note:{ko:'Unity 문서는 “메탈릭은 텍스처의 Red 채널, 스무스니스는 Alpha 채널에서 읽고 Green·Blue는 무시된다”고 적고 있습니다. 회색으로 RGB 전체에 같은 값을 써도 결과는 같습니다. URP Lit은 스무스니스 출처를 Metallic Alpha 또는 Albedo Alpha 중에서 고를 수 있습니다.',en:'Unity states that metallic comes from the texture’s Red channel and smoothness from Alpha, and that Green and Blue are ignored. Writing the same grey into RGB is equivalent. URP’s Lit shader also lets smoothness come from the albedo alpha instead.',ja:'Unityの文書では「メタリックはRedチャンネル、スムースネスはAlphaチャンネルから読み、Green・Blueは無視される」と記載されています。RGBに同じ値を書いても結果は同じです。URPのLitはスムースネスの取得元をMetallic AlphaとAlbedo Alphaから選べます。'},
  channels:[
   channel('r','metallic',{ko:'메탈릭',en:'Metallic',ja:'メタリック'},{ko:'Unity가 실제로 읽는 유일한 메탈릭 채널입니다.',en:'The only channel Unity actually reads for metallic.',ja:'Unityが実際に読む唯一のメタリックチャンネルです。'}),
   channel('g','ignored',{ko:'무시됨',en:'Ignored',ja:'無視'},{ko:'셰이더가 읽지 않습니다. 보통 메탈릭과 같은 회색 값을 넣습니다.',en:'Not read by the shader; normally filled with the same grey as metallic.',ja:'シェーダーは読みません。通常はメタリックと同じ値を入れます。'}),
   channel('b','ignored',{ko:'무시됨',en:'Ignored',ja:'無視'},{ko:'셰이더가 읽지 않습니다.',en:'Not read by the shader.',ja:'シェーダーは読みません。'}),
   channel('a','smoothness',{ko:'스무스니스',en:'Smoothness',ja:'スムースネス'},{ko:'러프니스의 반대값입니다. PNG의 알파이므로 저장할 때 알파가 눌리지 않아야 합니다.',en:'The inverse of roughness. It lives in the PNG alpha, so the file must keep its alpha intact.',ja:'ラフネスの逆値。PNGのアルファに入るため、保存時にアルファが失われない必要があります。'},{invertOf:'roughness'})
  ]},
 'unreal-orm':{
  engine:'unreal',
  label:{ko:'Unreal ORM (glTF 배치)',en:'Unreal ORM (glTF layout)',ja:'Unreal ORM（glTF配置）'},
  summary:{ko:'R 오클루전 · G 러프니스 · B 메탈릭',en:'R occlusion · G roughness · B metallic',ja:'R オクルージョン・G ラフネス・B メタリック'},
  orderSource:'gltf',
  doc:{title:'Using Texture Masks in Unreal Engine',section:'RGB channel packing',url:'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-texture-masks-in-unreal-engine'},
  orderDoc:{title:'glTF 2.0 schema — material.pbrMetallicRoughness / material.occlusionTexture',section:'metallicRoughnessTexture, occlusionTexture',url:'https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json'},
  note:{ko:'Unreal에는 ORM 입력 슬롯이 없습니다. 머티리얼 그래프에서 채널을 직접 분리해 연결합니다. R=오클루전·G=러프니스·B=메탈릭 순서는 Epic 문서가 아니라 glTF 2.0 스펙이 정한 것이며, Epic의 채널 패킹 예시는 다른 배치를 씁니다. Epic 문서는 마스크 텍스처에서 sRGB를 끄고 샘플러를 Linear Color로 바꾸라고 안내합니다.',en:'Unreal has no ORM input: you split the channels yourself in the material graph. The R=occlusion, G=roughness, B=metallic order is fixed by the glTF 2.0 spec, not by Epic — Epic’s own packing example uses a different layout. Epic does document that mask textures must have sRGB disabled and the sampler set to Linear Color.',ja:'UnrealにORM入力はなく、マテリアルグラフでチャンネルを分けて接続します。R=オクルージョン・G=ラフネス・B=メタリックの順序はEpicではなくglTF 2.0仕様が定めたもので、Epicの例は別の配置です。Epicの文書はマスクテクスチャのsRGBを切り、サンプラーをLinear Colorにするよう指示しています。'},
  channels:[
   channel('r','ao',{ko:'앰비언트 오클루전',en:'Ambient occlusion',ja:'アンビエントオクルージョン'},{ko:'glTF 2.0은 오클루전을 R 채널에서 선형으로 읽는다고 규정합니다.',en:'glTF 2.0 says occlusion values are linearly sampled from the R channel.',ja:'glTF 2.0はオクルージョンをRチャンネルから線形に読むと規定しています。'}),
   channel('g','roughness',{ko:'러프니스',en:'Roughness',ja:'ラフネス'},{ko:'0은 거울처럼 매끈함, 255는 완전히 거칢입니다.',en:'0 is mirror-smooth, 255 is fully rough.',ja:'0は鏡のように滑らか、255は完全に粗い。'}),
   channel('b','metallic',{ko:'메탈릭',en:'Metallic',ja:'メタリック'},{ko:'glTF 2.0은 메탈니스를 B 채널에서 읽습니다.',en:'glTF 2.0 samples metalness from the B channel.',ja:'glTF 2.0はメタルネスをBチャンネルから読みます。'}),
   channel('a','unused',{ko:'사용 안 함',en:'Unused',ja:'未使用'},{ko:'비워 둡니다. 알파를 쓰면 압축 크기만 커집니다.',en:'Left empty; an unused alpha channel only costs memory.',ja:'空のままにします。使わないアルファは容量だけ増えます。'})
  ]},
 'godot-orm':{
  engine:'godot',
  label:{ko:'Godot 4 ORMMaterial3D',en:'Godot 4 ORMMaterial3D',ja:'Godot 4 ORMMaterial3D'},
  summary:{ko:'R 오클루전 · G 러프니스 · B 메탈릭',en:'R occlusion · G roughness · B metallic',ja:'R オクルージョン・G ラフネス・B メタリック'},
  orderSource:'engine-source',
  doc:{title:'ORMMaterial3D — Godot Engine (stable) documentation',section:'Description',url:'https://docs.godotengine.org/en/stable/classes/class_ormmaterial3d.html'},
  orderDoc:{title:'godot/scene/resources/material.cpp — BaseMaterial3D::_update_shader (4.4)',section:'ROUGHNESS = orm_tex.g; METALLIC = orm_tex.b; AO = orm_tex.r;',url:'https://github.com/godotengine/godot/blob/4.4/scene/resources/material.cpp'},
  note:{ko:'Godot 문서는 “각 파라미터에 텍스처의 서로 다른 색 채널이 쓰인다”고만 적고 채널 순서를 명시하지 않습니다. 순서는 엔진 소스(생성되는 셰이더 코드)에서 확인했습니다. 한편 StandardMaterial3D는 ao_texture_channel·roughness_texture_channel·metallic_texture_channel로 채널을 직접 지정할 수 있어, ORM이 아닌 배치도 문서화된 방법으로 읽을 수 있습니다.',en:'The Godot manual only says "the different color channels of that texture are used for each parameter" — it never states the order. The order here was read from the engine source that generates the shader. Separately, StandardMaterial3D documents ao_texture_channel, roughness_texture_channel and metallic_texture_channel, so a non-ORM layout can also be read without guessing.',ja:'Godotの文書は「各パラメータにテクスチャの異なる色チャンネルが使われる」としか書かず、順序は明示されていません。順序はシェーダーを生成するエンジンのソースで確認しました。なおStandardMaterial3Dはao_texture_channel・roughness_texture_channel・metallic_texture_channelでチャンネルを指定できます。'},
  channels:[
   channel('r','ao',{ko:'앰비언트 오클루전',en:'Ambient occlusion',ja:'アンビエントオクルージョン'},{ko:'생성된 셰이더에서 AO = orm_tex.r 입니다.',en:'The generated shader reads AO = orm_tex.r.',ja:'生成シェーダーではAO = orm_tex.rです。'}),
   channel('g','roughness',{ko:'러프니스',en:'Roughness',ja:'ラフネス'},{ko:'ROUGHNESS = orm_tex.g. 텍스처 힌트도 hint_roughness_g입니다.',en:'ROUGHNESS = orm_tex.g; the uniform even carries the hint_roughness_g hint.',ja:'ROUGHNESS = orm_tex.g。ユニフォームのヒントもhint_roughness_gです。'}),
   channel('b','metallic',{ko:'메탈릭',en:'Metallic',ja:'メタリック'},{ko:'METALLIC = orm_tex.b 입니다.',en:'METALLIC = orm_tex.b.',ja:'METALLIC = orm_tex.bです。'}),
   channel('a','unused',{ko:'사용 안 함',en:'Unused',ja:'未使用'},{ko:'ORM 텍스처는 알파를 쓰지 않습니다.',en:'An ORM texture does not use alpha.',ja:'ORMテクスチャはアルファを使いません。'})
  ]},
 'gltf-metallic-roughness':{
  engine:'generic',
  label:{ko:'glTF 2.0 메탈릭·러프니스',en:'glTF 2.0 metallic-roughness',ja:'glTF 2.0 メタリック・ラフネス'},
  summary:{ko:'G 러프니스 · B 메탈릭 (오클루전은 R, 같은 텍스처를 써도 됨)',en:'G roughness · B metallic (occlusion in R, may share the same texture)',ja:'G ラフネス・B メタリック（オクルージョンはR、同一テクスチャ可）'},
  orderSource:'spec',
  doc:{title:'glTF 2.0 schema — material.pbrMetallicRoughness',section:'metallicRoughnessTexture',url:'https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json'},
  note:{ko:'스펙 원문: “메탈니스는 B 채널에서, 러프니스는 G 채널에서 샘플링하며 선형 전달 함수로 인코딩해야 한다.” 오클루전 텍스처는 R 채널에서 읽으므로 세 값을 한 장에 담으면 ORM이 됩니다.',en:'The spec says metalness is sampled from B, roughness from G, and both MUST use a linear transfer function. Occlusion is sampled from R, which is why one shared texture becomes ORM.',ja:'仕様では「メタルネスはB、ラフネスはGからサンプリングし、線形伝達関数でエンコードしなければならない」と規定。オクルージョンはRから読むため、1枚にまとめるとORMになります。'},
  channels:[
   channel('r','ao',{ko:'오클루전 (occlusionTexture)',en:'Occlusion (occlusionTexture)',ja:'オクルージョン (occlusionTexture)'},{ko:'occlusionTexture의 R 채널에서 선형으로 읽습니다. GBA는 무시됩니다.',en:'Linearly sampled from the occlusionTexture’s R channel; GBA are ignored.',ja:'occlusionTextureのRチャンネルから線形に読み、GBAは無視されます。'}),
   channel('g','roughness',{ko:'러프니스',en:'Roughness',ja:'ラフネス'},{ko:'metallicRoughnessTexture의 G 채널입니다.',en:'The G channel of metallicRoughnessTexture.',ja:'metallicRoughnessTextureのGチャンネルです。'}),
   channel('b','metallic',{ko:'메탈릭',en:'Metallic',ja:'メタリック'},{ko:'metallicRoughnessTexture의 B 채널입니다.',en:'The B channel of metallicRoughnessTexture.',ja:'metallicRoughnessTextureのBチャンネルです。'}),
   channel('a','unused',{ko:'사용 안 함',en:'Unused',ja:'未使用'},{ko:'스펙에서 쓰이지 않습니다.',en:'Not used by the spec.',ja:'仕様では使用されません。'})
  ]}
});
export const PRESET_IDS=Object.freeze(Object.keys(ENGINE_PRESETS));
export const presetChannels=id=>{const p=ENGINE_PRESETS[id];if(!p)throw Error('Unknown engine preset');return p.channels;};
export const presetChannel=(id,letter)=>presetChannels(id).find(c=>c.channel===letter)||null;
export const roleTooltip=(id,letter,locale='en')=>presetChannel(id,letter)?.tooltip[locale]||'';
export const presetSummary=(id,locale='en')=>ENGINE_PRESETS[id]?.summary[locale]||'';
/** Which presets put a given role in which channel — the lookup the unpacker uses to label a
 * channel it has just extracted ("this is where Unreal reads roughness"). */
export function presetsWithRole(role){
 return PRESET_IDS.flatMap(id=>presetChannels(id).filter(c=>c.role===role).map(c=>({preset:id,channel:c.channel,engine:ENGINE_PRESETS[id].engine})));
}
/** Normal-map and colour-space conventions, with the page that states each one. `documented`
 * says whether the engine itself spells the claim out; 'inferred' means the claim is only
 * provable by chaining two official statements, and the Lab says so in the UI. */
export const ENGINE_DOCS=Object.freeze({
 normalConvention:{
  opengl:{engines:['unity','godot','blender'],label:{ko:'OpenGL (+Y, 초록 = 위)',en:'OpenGL (+Y, green = up)',ja:'OpenGL (+Y、緑 = 上)'},documented:true,
   docs:[{engine:'unity',title:'Introduction to normal maps (bump mapping) — Unity Manual',quote:'Unity uses Y+ normal maps, sometimes known as OpenGL format.',url:'https://docs.unity3d.com/Manual/StandardShaderMaterialParameterNormalMap.html'},
    {engine:'godot',title:'Standard Material 3D and ORM Material 3D — Godot docs',quote:'Godot requires the normal map to use the X+, Y+ and Z+ coordinates, this is known as OpenGL style.',url:'https://docs.godotengine.org/en/stable/tutorials/3d/standard_material_3d.html'},
    {engine:'blender',title:'Normal Map Node — Blender Manual',quote:'Blender uses the OpenGL convention by default for rendering and baking, where the Y axis in the green channel points up.',url:'https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html'}]},
  directx:{engines:['unreal'],label:{ko:'DirectX (−Y, 초록 = 아래)',en:'DirectX (−Y, green = down)',ja:'DirectX (−Y、緑 = 下)'},documented:'inferred',
   docs:[{engine:'unreal',title:'unreal.GLTFExportOptions — Unreal Python API',quote:'If enabled, exported normalmaps will be adjusted from Unreal to glTF convention (i.e. the green channel is flipped).',url:'https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExportOptions'},
    {engine:'khronos',title:'glTF 2.0 schema — material.normalTexture',quote:'The normal vectors use the convention +X is right and +Y is up.',url:'https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json'}]}
 },
 colorSpace:[
  {engine:'unity',title:'Default texture Import Settings — Unity Manual',quote:'Enable this property for non-HDR color textures such as albedo and specular color. Disable this property if the texture stores information that you need the exact value for.',url:'https://docs.unity3d.com/Manual/texture-type-default.html'},
  {engine:'unreal',title:'Using Texture Masks in Unreal Engine',quote:'When packing multiple Mask Textures into a single texture, you should Disable sRGB as your masks should not be Gamma corrected.',url:'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-texture-masks-in-unreal-engine'},
  {engine:'godot',title:'Shading language — Godot docs',quote:'Albedo and color textures should typically have a source_color hint. Normal, roughness, metallic, and height textures typically do not need a source_color hint.',url:'https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html'}
 ],
 channelSlots:[
  {engine:'godot',title:'BaseMaterial3D — Godot docs (ao_texture_channel)',quote:'Specifies the channel of the ao_texture in which the ambient occlusion information is stored. This is useful when you store the information for multiple effects in a single texture.',url:'https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html'},
  {engine:'unreal',title:'Using Texture Masks in Unreal Engine',quote:'This is commonly referred to as RGB channel packing and is the preferred method when creating masks, as it offers considerable performance and memory savings.',url:'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-texture-masks-in-unreal-engine'}
 ]
});
export const conventionFor=engine=>ENGINE_DOCS.normalConvention.directx.engines.includes(engine)?'directx':ENGINE_DOCS.normalConvention.opengl.engines.includes(engine)?'opengl':null;
