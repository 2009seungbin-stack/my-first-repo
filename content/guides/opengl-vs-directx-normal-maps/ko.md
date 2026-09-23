OpenGL 노멀맵과 DirectX 노멀맵은 딱 한 가지, 그린(Y) 채널의 방향만 다릅니다. OpenGL 방식(Y+)에서 밝은 초록은 "이 경사면이 이미지 위쪽을 향한다"는 뜻이고, DirectX 방식(Y−)에서는 그 반대입니다. Godot, Unity, Blender, glTF는 OpenGL을 기대하고 Unreal Engine은 DirectX로 작업합니다. 변환은 그린 채널만 반전하면 됩니다(새 G = 255 − G). 가장 간단한 방법은 엔진의 임포트 옵션입니다. Godot은 **Normal Map Invert Y**, Unity와 Unreal은 **Flip Green Channel**입니다.

규격이 틀리면 튀어나온 부분이 움푹 들어가 보이고, 위에서 비춘 조명이 아래에서 비춘 것처럼 보입니다. 빨강·파랑 채널과 파일 크기는 그대로라서 실수를 알아차리기 어렵습니다.

![같은 베벨 도형 세 개를 각각 바로 위의 조명으로 비춘 모습: 정상, 아래에서 비춘 듯한 모습, 다시 정상](shot:engine-normal-yflip-render "Godot 4.7.2(Compatibility 렌더러)에서 렌더링했습니다. 2D CanvasTexture와 도형 바로 위에 둔 PointLight2D를 사용했습니다. 왼쪽: OpenGL 맵. 가운데: 같은 맵의 DirectX 버전을 그대로 임포트한 결과로, 돔이 움푹 파인 모양이 되고 아래쪽 베벨에 빛이 맺힙니다. 오른쪽: 같은 DirectX 파일에 Normal Map Invert Y를 켠 결과입니다.")

## 엔진·툴별로 기대하는 규격 {#which-convention}

| 엔진·툴 | 기대하는 규격 | 그린 반전 위치 | 공식 문서에 명시? |
|---|---|---|---|
| Godot 4.7 (3D·2D) | OpenGL, Y+ | Import 독 → **Normal Map Invert Y** | 예, 매뉴얼 |
| Unity 6 | OpenGL, Y+ | Texture Type **Normal map** → **Flip Green Channel** | 예, 매뉴얼 |
| Unreal Engine 5 | DirectX, Y− | 텍스처 에디터 → **Flip Green Channel** | 추론(아래 참고) |
| Blender (5.2 매뉴얼) | 기본값 OpenGL | Normal Map 노드 → **Convention** | 예, 매뉴얼 |
| Substance 3D Painter | 프로젝트마다 설정 | 프로젝트 **Normal Map Format**, 내보내기 **Normal OpenGL** / **Normal DirectX** | 예 |
| glTF 2.0 파일 | +Y 위(OpenGL) | 내보내기 전에 텍스처를 맞춤 | 예, 사양서 |

Epic의 텍스처 문서는 Flip Green Channel을 "일부 노멀맵에 유용하다"고만 설명하고 규격 이름은 적지 않습니다. Unreal을 Y−로 분류한 근거는 다른 두 곳입니다. Adobe의 Painter 문서는 Unreal(과 3ds Max)에는 DirectX를, Unity·Maya·Blender에는 OpenGL을 권장합니다. 그리고 Epic의 glTF 익스포터에는 그린을 뒤집어 "Unreal 규격에서 glTF 규격으로" 바꾸는 `adjust_normalmaps` 옵션이 있는데, glTF는 +Y가 위입니다.

Godot의 2D 조명도 같은 규칙을 따릅니다. 위 렌더에서 OpenGL 맵을 넣은 `CanvasTexture`와 머리 위의 `PointLight2D`는 돔의 윗부분을 밝힙니다. 2D 설정 방법 자체는 [2D 노멀맵과 조명](guide:2d-normal-maps-lighting-godot-unity)에서 다룹니다.

## 그린 채널의 의미 {#green-channel}

탄젠트 공간 노멀맵은 픽셀마다 방향 하나를 저장합니다. 빨강은 X(텍스처 오른쪽), 초록은 Y, 파랑은 Z(표면 바깥, 보는 사람 쪽)입니다. −1에서 1 사이의 값을 0~255로 저장하므로 평평한 픽셀은 대략 `(128, 128, 255)`, 흔히 보는 연보라색입니다.

두 규격은 빨강과 파랑에서는 일치하고, +Y가 어느 쪽인지만 다릅니다. OpenGL은 **이미지 위쪽**, DirectX는 **이미지 아래쪽**입니다. 그래서 텍스처 위쪽을 향한 경사면은 OpenGL 맵에서 G가 128보다 크고 DirectX 맵에서는 128보다 작습니다. 변환은 모든 픽셀에 `G' = 255 − G`를 적용하는 것이고, 두 번 하면 원래 바이트로 돌아옵니다. 벡터 길이도 그대로 1이므로 "올바른 노멀맵인가" 검사는 두 버전 모두 통과합니다.

## 내 노멀맵이 어느 쪽인지 구별하기 {#identify}

파일 안에는 규격을 기록하는 메타데이터가 없고, 두 버전 모두 올바른 데이터입니다. 빠른 방법부터 확실한 방법 순으로 확인합니다.

1. **파일 이름.** 두 버전을 함께 배포하는 라이브러리가 많습니다. ambientCG는 `_NormalGL`과 `_NormalDX`, Poly Haven은 `nor_gl`과 `nor_dx`로 구분합니다. Substance 3D Painter에서 받은 파일이라면 내보내기 프리셋이 **Normal OpenGL**과 **Normal DirectX** 중 어느 변환 맵을 썼는지 확인합니다.
2. **튀어나온 것이 확실한 부분을 봅니다.** 리벳, 벽돌, 버튼 같은 곳입니다. OpenGL 맵에서는 윗가장자리가 초록, 아랫가장자리가 보라색이라 오른쪽 위에서 빛을 받은 것처럼 보입니다. DirectX 맵에서는 초록이 아랫가장자리에 있어 오른쪽 아래에서 빛을 받은 것처럼 보입니다.
3. **조명 테스트.** 오브젝트 **바로 위**에 조명 하나를 두고 같은 부분을 봅니다. 아랫가장자리에 빛이 맺히면 이 엔진에는 맞지 않는 규격입니다.

![OpenGL 테스트 맵과 DirectX 버전을 조명 없이 그린 모습: 왼쪽은 윗가장자리, 오른쪽은 아랫가장자리가 초록](shot:engine-normal-yflip-maps "Godot 4.7.2가 조명 없이 그린 두 테스트 맵입니다. 왼쪽: OpenGL(Y+), 위를 향한 경사면이 초록. 오른쪽: DirectX(Y−), 같은 맵에 G = 255 − G를 적용한 것입니다.")

> **팁:** 조명은 옆이 아니라 위나 아래에 두고 테스트합니다. 정확히 수평인 디렉셔널 라이트에서는 노멀의 Y 성분이 조명에 전혀 영향을 주지 않으므로 두 버전이 똑같이 보입니다. 가까운 포인트 라이트를 옆에 두면 차이가 보이긴 하지만 훨씬 작습니다.

## 노멀맵 변환·반전하기 {#convert}

:::steps
1. **대상이 기대하는 규격을 확인합니다.** Godot, Unity, Blender, glTF는 OpenGL(Y+), Unreal Engine은 DirectX(Y−)입니다. 위 표를 참고합니다.
2. **가지고 있는 맵의 규격을 확인합니다.** 파일 이름을 보고, 조명을 오브젝트 위에 두고 테스트합니다.
3. **Godot 4: 임포트에서 반전합니다.** FileSystem 독에서 텍스처를 선택하고, Import 독에서 **Process → Normal Map Invert Y**를 켠 뒤 **Reimport**를 누릅니다. `.import` 파일에 `process/normal_map_invert_y=true`가 기록됩니다.
4. **Unity 6: 임포트에서 반전합니다.** 텍스처를 선택하고 Inspector에서 **Texture Type**을 **Normal map**으로 바꾼 뒤 **Flip Green Channel**을 체크하고 **Apply**를 누릅니다.
5. **Unreal Engine: 텍스처 에디터에서 반전합니다.** 텍스처를 열어 **Flip Green Channel**을 체크하고 에셋을 저장합니다.
6. **또는 파일 자체를 한 번 변환합니다.** 이미지 편집기에서 그린 채널만 선택해 반전합니다(255 − G). 빨강·파랑·알파는 건드리지 않고, 압축 손실이 없도록 PNG로 저장합니다.
7. **다시 확인합니다.** 오브젝트 위에 조명 하나를 두었을 때 튀어나온 부분의 윗가장자리가 밝아야 합니다. 반전은 한 곳에서만 합니다. 이미 변환한 파일에 임포트 옵션까지 켜면 다시 원래대로 뒤집힙니다.
:::

가능하면 임포트 옵션을 쓰는 편이 좋습니다. 원본 파일은 받은 그대로 두고, 나중에 엔진을 옮길 때도 체크박스 하나만 바꾸면 됩니다.

## Godot 4 자세히 {#godot}

3단계를 마치면 텍스처의 `.import` 파일에서 관련된 줄은 다음과 같습니다.

```ini
; nm_directx.png.import (관련된 줄만)
[params]
compress/normal_map=0
process/normal_map_invert_y=true
```

Godot 4.7.2에서 DirectX 테스트 맵을 이렇게 임포트하고 결과 픽셀을 다시 읽어 확인했습니다. 그린 채널이 반전되어 OpenGL 원본과 1/255(반올림 오차) 이내로 일치했고, 빨강과 파랑은 바뀌지 않았습니다. Godot 4.7에는 같은 결과를 내는 두 번째 방법도 있습니다. **Process → Channel Remap → Green → Green Inverted**(`.import` 파일에서는 `process/channel_remap/green=5`)입니다. 둘 중 하나만 씁니다.

`compress/normal_map`(기본값 Detect)은 다른 설정입니다. 텍스처가 노멀맵으로 쓰인다고 Godot이 감지하면 빨강·초록만 남기는 RGTC 압축으로 바꾸는 옵션이며, 규격은 바꾸지 않습니다.

런타임에 불러온 텍스처처럼 다시 임포트할 수 없는 경우, 2D 노드라면 셰이더에서 그린을 뒤집을 수 있습니다. 노드의 머티리얼로 지정하고, DirectX 맵은 CanvasTexture의 노멀 슬롯에 그대로 둡니다.

```glsl
// flip_green.gdshader: use a DirectX (Y-) normal map on a 2D node without re-importing it
shader_type canvas_item;

void fragment() {
	vec3 n = texture(NORMAL_TEXTURE, UV).rgb;
	n.g = 1.0 - n.g; // DirectX (Y-) -> OpenGL (Y+), which Godot expects
	NORMAL_MAP = n;
}
```

렌더링해 보니 임포트 옵션을 쓴 결과와 똑같아 보였습니다. 돔 가장자리의 가장 가파른 픽셀들만 최대 21/255 차이가 있었습니다. 스프라이트를 `flip_h = true`로 뒤집을 때는 노멀맵을 따로 만들 필요가 없습니다. Godot 4.7.2가 노멀의 X를 알아서 뒤집어 주며, 테스트에서도 뒤집힌 스프라이트는 조명 쪽 면이 밝게 나왔습니다.

## Unity 6 자세히 {#unity}

**Normal map** 텍스처 타입은 sRGB를 자동으로 끄고(임포터 값 `sRGBTexture = false`), **Flip Green Channel**은 스크립트에서 `TextureImporter.flipGreenChannel`입니다. DirectX 맵이 들어 있는 라이브러리 전체를 고치려면 에셋 포스트프로세서가 임포트 때 설정하게 하면 됩니다.

```csharp
// Assets/Editor/FlipDirectXNormals.cs
using UnityEditor;

// Imports every texture whose file name ends in _NormalDX or _nor_dx as a normal map
// and flips its green channel, so DirectX-style (Y-) maps work in Unity, which expects OpenGL (Y+).
public class FlipDirectXNormals : AssetPostprocessor
{
    void OnPreprocessTexture()
    {
        string name = System.IO.Path.GetFileNameWithoutExtension(assetPath).ToLowerInvariant();
        if (!name.EndsWith("_normaldx") && !name.EndsWith("_nor_dx")) return;

        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.NormalMap;
        importer.flipGreenChannel = true;
    }
}
```

Unity 6000.5.3f1에서 `brick_NormalDX.png`라는 DirectX 테스트 맵이 이 스크립트를 거쳐 Normal map, Flip Green Channel 켜짐 상태로 임포트되었고, 임포트된 픽셀은 OpenGL 원본과 완전히 같았습니다. 스크립트는 임포트할 때마다 실행되므로, 이름이 맞는 파일에서는 이 두 설정을 손으로 바꿔도 덮어씁니다. 스크립트를 넣기 전에 임포트한 파일은 **Reimport**가 필요합니다.

URP 2D 렌더러로 비추는 스프라이트의 노멀맵은 스프라이트의 보조 텍스처로 넣습니다. 이 설정은 [2D 노멀맵과 조명](guide:2d-normal-maps-lighting-godot-unity)에서 다룹니다.

## Unreal, Blender, Substance {#other-tools}

- **Unreal Engine.** Y+ 소스(Blender, `_NormalGL` 파일, Unity용 에셋 팩)에서 온 맵은 텍스처 에디터에서 **Flip Green Channel**을 켜야 합니다. 반대로 Unreal용으로 만든 맵은 Godot이나 Unity 쪽에서 반전합니다.
- **Blender.** Normal Map 노드는 기본이 OpenGL입니다. 현재 매뉴얼(5.2 LTS)에는 DirectX 맵을 위한 **Convention** 속성이 있습니다. 쓰는 버전의 노드에 이 속성이 없다면 노드 앞에서 그린을 반전합니다. Separate Color → Subtract로 설정한 Math 노드(1 − G) → Combine Color 순서입니다.
- **Substance 3D Painter.** 프로젝트의 **Normal Map Format**은 뷰포트와 베이커에만 적용되고, Adobe 문서에 따르면 레이어 스택과는 별개입니다. 레이어나 툴에 불러온 노멀맵은 기본적으로 DirectX로 취급되며, 맵 옆의 작은 화살표에서 바꿀 수 있습니다. 내보낼 때는 대상 엔진에 맞춰 변환 맵 **Normal OpenGL** 또는 **Normal DirectX**를 고릅니다.

## 채널이 다르게 패킹된 경우 {#packed-channels}

"그린 반전"은 정확히 말하면 "Y가 들어 있는 채널 반전"입니다. 지금 보고 있는 파일에서 그게 항상 초록인 것은 아닙니다.

- **2채널 노멀맵.** BC5/RGTC 같은 포맷은 X와 Y만 저장하고 Z는 셰이더가 다시 계산합니다. Godot의 Normal Map 압축도 빨강과 초록만 남깁니다. 이때 파랑은 의미가 없고, Y는 여전히 초록입니다.
- **Unity가 임포트한 노멀맵은 채널이 재배치(swizzle)됩니다.** Windows의 Unity 6000.5.3f1에서 압축하지 않은 Normal map을 스크립트로 읽어 보니 R = 255, G = Y, B = Y, A = X로 나왔습니다. 셰이더는 이 배치를 알아서 해석합니다. 하지만 스크립트로 임포트된 텍스처를 읽으면 원래 RGB가 아니므로, 임포트된 텍스처를 픽셀 루프로 고치지 말고 원본 파일을 바꾸거나 임포터 옵션을 씁니다.
- **패킹된 디테일 맵.** Unity HDRP의 디테일 맵은 알베도(빨강), 스무스니스(파랑)와 함께 노멀 Y를 초록에, 노멀 X를 알파에 저장합니다. 이 맵을 반전할 때도 초록만 뒤집습니다.

통하지 않는 방법도 두 가지 있습니다. 이미지를 상하 반전하면 픽셀이 UV에서 어긋나고, 모든 채널을 반전하면 X(빨강)까지 뒤집히고 파랑이 표면 안쪽을 향합니다.

:::nerulio tool=normal-map-converter
Nerulio의 노멀맵 변환기는 텍스처 랩의 **노멀** 단계이며 브라우저 안에서 동작합니다. 파일은 업로드되지 않습니다. **OpenGL ↔ DirectX** 모드는 그린 채널만 반전하고, 두 번 변환하면 원래 바이트로 돌아옵니다. PNG를 캔버스를 거치지 않고 바이트 그대로 디코딩하므로, 랩의 테스트에서 빨강·파랑·알파는 그대로이고 `G' = 255 − G`가 정확히 맞는 것을 확인했습니다.
- 노멀맵을 놓고 **OpenGL ↔ DirectX**를 고른 뒤 **노멀 맵 저장 (PNG)**을 누릅니다.
- **미리보기** 단계에서 **노멀 맵을 DirectX로 보기 (초록 반전)**를 체크하면 같은 조명 아래에서 두 해석을 비교할 수 있습니다. 엔진 렌더러가 아닌 근사 미리보기입니다.
- **하이트 → 노멀**은 고른 **규격**(**OpenGL +Y** 또는 **DirectX −Y**)으로 새 맵을 만듭니다.
- 파일이 어느 규격인지 판별하지는 못합니다. 확실히 판별할 방법은 어디에도 없습니다. 대신 엔진별로 기대하는 규격을 근거 문서와 함께 보여 주고 변환해 줍니다.
:::

![Nerulio 텍스처 랩의 노멀 단계: 원본과 결과, OpenGL·DirectX 규격 버튼, 엔진별 기대 규격 목록](shot:lab-texture-normal "텍스처 랩의 노멀 단계: 규격 전환 버튼과, 항목마다 근거 문서가 붙은 엔진 목록입니다.")

## FAQ {#faq}

### Unity는 OpenGL 노멀맵인가요, DirectX 노멀맵인가요?
OpenGL입니다. Unity 매뉴얼에 "Unity uses Y+ normal maps, sometimes known as OpenGL format."이라고 적혀 있습니다. DirectX 맵은 Texture Type을 Normal map으로 바꾸고 Flip Green Channel을 체크합니다.

### Unreal Engine은 DirectX 노멀맵을 쓰나요?
네, Unreal은 DirectX 방식(Y−) 맵으로 작업합니다. Epic 문서에 그렇게 명시되어 있지는 않지만, Adobe가 Unreal에 DirectX를 권장하고 Epic의 glTF 익스포터가 glTF의 +Y에 맞추려고 그린을 뒤집습니다. OpenGL 맵에는 Flip Green Channel을 켭니다.

### Godot은 OpenGL 노멀맵인가요, DirectX 노멀맵인가요?
Godot 매뉴얼에 적힌 대로 OpenGL(X+, Y+, Z+)입니다. CanvasTexture를 쓰는 2D 조명도 마찬가지입니다. DirectX 맵은 Import 독에서 Normal Map Invert Y를 켜고 다시 임포트합니다.

### DirectX 노멀맵을 이미지 상하 반전으로 고칠 수 있나요?
아니요. 상하 반전은 모든 픽셀의 위치를 옮기므로 텍스처가 모델의 UV와 어긋나고, 조명도 여전히 틀립니다. 그린 채널의 값만 반전하거나 엔진의 반전 옵션을 씁니다.

### 노멀맵이 OpenGL인지 DirectX인지 어떻게 알 수 있나요?
먼저 파일 이름(`_NormalGL`/`_NormalDX`, `nor_gl`/`nor_dx`)을 봅니다. 그다음 튀어나온 부분을 보고, 윗가장자리가 초록이면 OpenGL, 아랫가장자리가 초록이면 DirectX입니다. 엔진에서 오브젝트를 위에서 비춰 보면 확실히 알 수 있습니다.

## Sources {#sources}

- [Importing images, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html)
- [ResourceImporterTexture, Godot Engine 4.7 class reference](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html)
- [Standard Material 3D and ORM Material 3D, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/3d/standard_material_3d.html)
- [2D lights and shadows, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_lights_and_shadows.html)
- [Introduction to normal maps (bump mapping), Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/StandardShaderMaterialParameterNormalMap.html)
- [Normal map texture type, Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-normal-map.html)
- [TextureImporter.flipGreenChannel, Unity 6.5 Scripting API](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-flipGreenChannel.html)
- [Mask and detail maps, Unity HDRP 17.1 documentation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html)
- [Texture Asset Editor, Unreal Engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/texture-asset-editor-in-unreal-engine)
- [unreal.GLTFExportOptions (adjust_normalmaps), Unreal Engine Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExportOptions)
- [Normal Map Node, Blender 5.2 LTS Manual](https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html)
- [Project configuration, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/interface/project-configuration.html)
- [Normal map looks incorrect when loaded in layer or tool properties, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/technical-support/workflow-issues/tools-issues/normal-map-looks-incorrect-when-loaded-in-layer-or-tool-properties.html)
- [Output templates, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/getting-started/export/export-window/output-templates.html)
- [What is the difference between the OpenGL and DirectX normal format?, Adobe Substance 3D bakers](https://helpx.adobe.com/substance-3d-bake/common-questions/what-is-the-difference-between-the-opengl-and-directx-normal-format.html)
- [glTF 2.0 material schema (normalTexture), Khronos Group](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json)
