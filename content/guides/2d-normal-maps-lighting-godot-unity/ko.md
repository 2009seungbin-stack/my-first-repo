2D 스프라이트에 노멀맵 조명을 적용하려면 레이아웃이 똑같은 이미지 두 장이 필요합니다. 색이 들어간 스프라이트와, 표면의 각 부분이 어느 쪽을 향하는지 픽셀마다 기록한 노멀맵입니다. **Godot 4**에서는 두 이미지를 **CanvasTexture**(Diffuse와 Normal Map)에 넣고, 텍스처가 지정되어 있고 **Height**가 0보다 큰 **PointLight2D**로 비춥니다. **Unity 6**에서는 URP의 **2D Renderer**를 쓰고, 노멀맵을 스프라이트의 `_NormalMap` **Secondary Texture**로 연결한 뒤, 각 Light 2D의 **Normal Maps → Quality**를 **Fast** 또는 **Accurate**로 바꿉니다. 두 엔진 모두 OpenGL 방식(Y+) 노멀맵을 기대합니다. 도트 그래픽이라면 노멀맵도 스프라이트처럼 최근접(Nearest) 필터로 샘플링해야 합니다.

아래 내용은 모두 Godot 4.7.2와 Unity 6000.5.3f1(URP 17.5.0)에서 Kenney의 CC0 *Tiny Dungeon* 타일과, Nerulio Texture Lab으로 만든 노멀맵을 써서 직접 실행했습니다.

![같은 던전 장면과 조명을 두 번 렌더링한 이미지. 왼쪽은 일반 텍스처, 오른쪽은 노멀맵을 넣은 CanvasTexture이며 아래는 조명 주변 벽을 확대한 것](shot:engine-normal2d-compare "Godot 4.7.2(Compatibility 렌더러)에서 렌더링: 높이 30 px의 PointLight2D, LightOccluder2D로 만든 PCF5 그림자. 왼쪽은 일반 텍스처, 오른쪽은 같은 텍스처를 노멀맵과 함께 CanvasTexture로 넣은 것입니다. 벽돌이 빛을 향한 면에서만 밝아집니다. 아트: Kenney Tiny Dungeon (CC0).")

## 2D 노멀맵은 어떻게 동작하나 {#how-it-works}

노멀맵은 스프라이트 픽셀마다 표면이 어느 방향을 향하는지 저장합니다. 빨강은 좌우 기울기, 초록은 상하 기울기, 파랑은 화면을 얼마나 정면으로 보는지입니다. 평평하게 정면을 보는 픽셀은 연보라색 `(128, 128, 255)`입니다. 엔진은 빛을 향한 픽셀을 밝게 칠하므로, 횃불이 왼쪽에 있으면 벽돌의 왼쪽 모서리가, 횃불이 오른쪽으로 옮겨 가면 오른쪽 모서리가 밝아집니다.

제대로 보이느냐는 두 가지에 달려 있습니다.

- **규격(Convention).** Godot와 Unity는 모두 초록을 '위쪽을 향함'으로 읽습니다(OpenGL, Y+). Unreal용 도구에서 나온 DirectX 방식 노멀맵을 넣으면 위아래가 반대로 빛을 받습니다. 구별하고 뒤집는 법은 [OpenGL vs DirectX 노멀맵](guide:opengl-vs-directx-normal-maps)에 정리했습니다.
- **조명 높이.** 2D 조명은 스프라이트와 같은 평면 위에 있습니다. 가상의 높이가 없으면 빛이 정확히 옆에서 들어오므로, 정면을 보는 픽셀은 빛을 거의 받지 못합니다.

## Godot 4에서 설정하기 {#godot}

:::steps
1. **스프라이트와 레이아웃이 같은 노멀맵을 준비합니다.** 스프라이트 픽셀 하나에 노멀 픽셀 하나, 같은 크기, 시트라면 같은 프레임 위치, OpenGL(Y+) 규격이어야 합니다. 만드는 방법은 [아래](#making-normal-maps)에 있습니다.
2. **도트 그래픽이면 최근접 필터를 켭니다.** *Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter*를 **Nearest**로 바꾸거나, 노드의 *Texture → Filter*를 **Nearest**로 설정합니다. CanvasTexture는 디퓨즈와 노멀맵을 같은 필터로 샘플링합니다.
3. **CanvasTexture를 만듭니다.** Sprite2D(또는 AnimatedSprite2D의 프레임, TileSet 아틀라스, Control 등)에서 *Texture → New CanvasTexture*를 선택합니다. 스프라이트는 *Diffuse → Texture*에, 노멀맵은 *Normal Map → Texture*에 넣습니다. Specular는 선택 사항입니다.
4. **장면을 어둡게 합니다.** 어두운 색의 **CanvasModulate**를 추가합니다. 조명이 닿지 않는 곳의 색이 됩니다.
5. **PointLight2D를 추가하고 Texture를 지정합니다.** 텍스처가 없는 PointLight2D는 아무것도 비추지 않습니다. 방사형 *GradientTexture2D*면 충분하며, 조명의 크기는 텍스처 크기 × *Texture Scale*입니다.
6. **조명의 Height를 올립니다.** PointLight2D의 *Height*는 픽셀 단위입니다(100이면 100 px 떨어진 곳을 45°로 비춥니다). 20–100 사이에서 조명을 움직이며 맞춥니다. DirectionalLight2D의 *Height*는 0(평면과 평행)부터 1(수직)까지입니다.
7. **필요하면 그림자를 넣습니다.** 조명의 *Shadow → Enabled*를 켭니다. Sprite2D를 선택하고 *Sprite2D → Create LightOccluder2D Sibling*을 쓰거나 OccluderPolygon2D를 직접 그립니다. *Shadow → Filter*는 None, PCF5, PCF13 중에서 고릅니다.
8. **조명을 움직여 확인합니다.** 튀어나온 부분은 빛을 향한 쪽이 밝아야 합니다. 위아래가 반대로 밝아지면 DirectX 방식 노멀맵이므로 초록 채널을 반전합니다.
:::

같은 장면을 코드로 만들면 다음과 같습니다. Godot 4.7.2에서 이대로 실행했습니다.

```gdscript
# lit_scene.gd: attach to a Node2D. Builds a normal-mapped sprite, a light and a shadow.
extends Node2D

func _ready() -> void:
	# 1. Diffuse + normal map in one CanvasTexture
	var tex := CanvasTexture.new()
	tex.diffuse_texture = preload("res://art/knight.png")
	tex.normal_texture = preload("res://art/knight_n.png")  # OpenGL (+Y) normal map
	var knight := Sprite2D.new()
	knight.texture = tex
	knight.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST  # pixel art: diffuse AND normal
	knight.scale = Vector2(4, 4)
	knight.position = Vector2(288, 160)
	add_child(knight)

	# 2. A shadow caster at the sprite's feet
	var occluder := LightOccluder2D.new()
	var poly := OccluderPolygon2D.new()
	poly.polygon = PackedVector2Array([Vector2(-5, 4), Vector2(5, 4), Vector2(5, 7), Vector2(-5, 7)])
	occluder.occluder = poly
	knight.add_child(occluder)

	# 3. Darken everything the light does not reach
	var ambient := CanvasModulate.new()
	ambient.color = Color(0.15, 0.15, 0.2)
	add_child(ambient)

	# 4. A point light: it needs a texture, and a height for normal mapping
	var falloff := Gradient.new()
	falloff.set_color(0, Color.WHITE)   # centre
	falloff.set_color(1, Color.BLACK)   # edge
	var shape := GradientTexture2D.new()
	shape.width = 256              # light size = texture size x texture_scale
	shape.height = 256
	shape.gradient = falloff
	shape.fill = GradientTexture2D.FILL_RADIAL
	shape.fill_from = Vector2(0.5, 0.5)
	shape.fill_to = Vector2(1.0, 0.5)
	var light := PointLight2D.new()
	light.texture = shape          # without a texture the light draws nothing
	light.texture_scale = 2.0
	light.height = 30.0            # pixels; at 0 flat normal-mapped areas stay dark
	light.shadow_enabled = true
	light.shadow_filter = Light2D.SHADOW_FILTER_PCF5
	light.position = Vector2(200, 110)
	add_child(light)
```

> **GradientTexture2D의 기본 크기는 64×64밖에 되지 않습니다.** 그대로 쓰면 위 조명의 반지름은 64 px라서 100 px 떨어진 스프라이트에 닿지 않습니다. 그래서 스니펫에서 `width`와 `height`를 지정합니다.

### 조명 높이: '노멀맵이 안 먹힌다'의 가장 흔한 원인 {#light-height}

PointLight2D *Height*의 기본값은 **0**입니다. 0이면 빛이 스프라이트와 평행하게 들어오므로, 정면을 보는 노멀맵 픽셀은 빛을 거의 받지 못합니다. 테스트 장면에서 높이 0인 조명에 노멀맵을 켜자 화면이 거의 까맣게 되었습니다(평균 밝기 255 중 22, 노멀맵이 없을 때는 84). Godot 매뉴얼도 *Height*를 올리라고 안내합니다. 30 px에서 입체감이 드러나고, 150 px에서는 빛이 거의 바로 위에서 오기 때문에 다시 밝고 평평해집니다.

노멀맵을 넣은 스프라이트는 보통 넣지 않은 스프라이트보다 어둡습니다. 노멀맵이 없는 스프라이트는 빛을 완전히 정면으로 받는 것으로 계산되기 때문입니다. 노멀맵을 빼지 말고 조명의 *Energy*를 올리십시오.

### 도트 그래픽: 노멀맵에도 최근접 필터 {#pixel-art}

노멀맵이 흐리게 샘플링되면 색이 선명하더라도 픽셀 경계마다 하이라이트가 번집니다. 3배로 확대한 스프라이트를 DirectionalLight2D로 비춰(조명이 노멀에만 좌우되도록) 확인했습니다.

- 노드 *Texture Filter*가 **Nearest**: 화면의 3×3 블록이 모두 한 가지 색이었습니다(9,216개 중 0개가 달라짐). 두 이미지 모두 최근접으로 샘플링된 것입니다.
- 노드 필터가 **Linear**: 9,216개 블록 모두 색이 섞였습니다.
- CanvasTexture 자체의 *Texture Filter*가 *Inherit*가 아니면, 디퓨즈와 노멀맵 모두 노드 설정 대신 이 값을 따릅니다.

즉 설정 하나로 두 이미지가 함께 바뀝니다. 노멀맵은 스프라이트 원본 해상도로 만들고 무손실로 두십시오. VRAM 압축과 밉맵은 모두 이웃한 노멀을 평균 내 버립니다. 나머지 도트 설정은 [Godot 4 도트 흐림·떨림](guide:godot-4-pixel-art-blurry-jitter)을 참고하십시오.

### 스프라이트 시트, AnimatedSprite2D, TileMap {#sheets-and-tilemaps}

노멀맵은 프레임 하나하나까지 스프라이트와 레이아웃이 같아야 합니다. 텍스처가 CanvasTexture라면 시트를 그리는 일반적인 방법에서 모두 노멀맵이 유지됩니다. 왼쪽과 오른쪽에서 차례로 비췄을 때 달라진 픽셀 수는 다음과 같습니다.

- **AnimatedSprite2D**, *Atlas*가 CanvasTexture인 **AtlasTexture** 영역으로 만든 SpriteFrames: 16,384개 중 2,864개
- CanvasTexture에 *Hframes*/*Vframes*를 쓴 **Sprite2D**: 같은 결과
- TileSetAtlasSource의 *Texture*가 CanvasTexture인 **TileMapLayer**: 16,384개 중 12,800개
- 비교용으로 일반 PNG에서 잘라 낸 같은 프레임: 0개

스프라이트를 아틀라스로 패킹한다면 노멀맵도 완전히 같은 레이아웃으로 패킹하거나, 완성된 아틀라스에서 노멀맵을 만드십시오. 트리밍과 회전도 똑같아야 합니다. 자세한 내용은 [스프라이트 시트와 텍스처 아틀라스의 차이](guide:sprite-sheet-vs-texture-atlas)에 있습니다.

*Specular*는 선택 사항입니다. 회색조 *Specular → Texture*로 반짝이는 픽셀(금속, 젖은 돌)을 표시하고, *Shininess*로 하이라이트의 날카로움을, *Color*로 색을 정합니다.

## Unity 6에서 설정하기 (URP 2D Renderer) {#unity}

Unity의 2D 조명은 URP의 **2D Renderer**가 있어야 동작합니다. **Universal 2D** 프로젝트 템플릿에는 이미 들어 있습니다(6000.5.3f1에 포함된 템플릿에 `Assets/Settings/Renderer2D.asset`과 *Global Light 2D*가 있는 씬이 있습니다). 기존 URP 프로젝트라면 *Assets → Create → Rendering → URP Asset (with 2D Renderer)*로 에셋을 만들고, *Project Settings → Graphics*(품질 레벨이 덮어쓴다면 *Quality*도)에서 활성 렌더 파이프라인으로 지정합니다.

1. **노멀맵을 임포트합니다.** *Texture Type*을 **Normal Map**으로 바꿉니다. 매뉴얼이 요구하는 대로 sRGB도 함께 꺼집니다. 도트 그래픽이면 *Filter Mode*를 **Point**, *Compression*을 **None**으로 설정합니다.
2. **스프라이트에 연결합니다.** 스프라이트 텍스처를 선택해 *Sprite Editor*를 열고, 드롭다운에서 **Secondary Textures**를 고른 뒤 **+**를 누릅니다. *Name*은 `_NormalMap`, *Texture*는 노멀맵으로 지정합니다. Unity는 스프라이트와 같은 UV로 샘플링하므로 레이아웃이 일치해야 합니다.
3. **라이트를 받는 머티리얼을 씁니다.** 2D Renderer에서 새 Sprite Renderer는 **Sprite-Lit-Default**를 받으며, 이 머티리얼이 `_NormalMap`을 읽습니다.
4. **조명을 추가합니다.** *GameObject → Light → Spot Light 2D*를 씁니다(API에서는 이 조명 타입의 이름이 아직 `Point`입니다).
5. **그 조명에서 노멀맵을 켭니다.** **Normal Maps** 폴드아웃을 열고 *Quality*를 **Fast** 또는 **Accurate**로 바꿉니다. 새 조명은 모두 **Disabled**로 시작합니다. *Distance*(기본값 3)는 스프라이트 위 조명의 가상 높이로, Godot의 *Height*에 해당합니다. (매뉴얼은 *Use Normal Map* / *Normal Map Quality*라고 쓰지만 6000.5.3f1 인스펙터에는 *Quality*와 *Distance*로 표시됩니다.)
6. **전역 조명을 낮춥니다.** 템플릿의 *Global Light 2D*는 강도가 1이라 모든 것을 고르게 비춰 입체감이 사라집니다. 0.1–0.3 정도로 낮추십시오.
7. **그림자(선택).** 빛을 막을 스프라이트에 **Shadow Caster 2D** 컴포넌트를 추가하고, 조명의 *Shadows* 섹션에서 *Strength*를 조절합니다.

에디터 스크립트로 노멀맵을 연결하려면 다음 코드를 쓰면 됩니다. 6000.5.3f1 배치 모드에서 실행한 코드입니다.

```csharp
// Editor/NormalMapImport.cs: pixel-art sprite + its normal map as the _NormalMap secondary texture
using UnityEditor;
using UnityEngine;

public static class NormalMapImport
{
    public static void Assign(string spritePath, string normalPath)
    {
        var n = (TextureImporter)AssetImporter.GetAtPath(normalPath);
        n.textureType = TextureImporterType.NormalMap;   // also sets sRGB off
        n.filterMode = FilterMode.Point;                 // pixel art: Point on the normal map too
        n.mipmapEnabled = false;
        n.textureCompression = TextureImporterCompression.Uncompressed;
        n.SaveAndReimport();

        var d = (TextureImporter)AssetImporter.GetAtPath(spritePath);
        d.textureType = TextureImporterType.Sprite;
        d.filterMode = FilterMode.Point;
        d.secondarySpriteTextures = new[] {
            new SecondarySpriteTexture { name = "_NormalMap", texture = AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath) }
        };
        d.SaveAndReimport();
    }
}
```

URP 17.5에서 Light 2D의 `normalMapQuality`와 `normalMapDistance`에는 public setter가 없습니다. 인스펙터에서 설정하거나, 에디터 코드라면 `SerializedObject`로 `m_NormalMapQuality` / `m_NormalMapDistance`를 바꾸십시오.

![Unity에서 같은 장면을 렌더링한 이미지. 왼쪽은 노멀맵 Disabled, 오른쪽은 Accurate이며 아래는 벽 확대](shot:engine-normal2d-unity "Unity 6000.5.3f1, URP 17.5.0 2D Renderer(배치 모드, Direct3D 12)에서 렌더링: Sprite-Lit-Default, _NormalMap 보조 텍스처, Spot Light 2D 하나와 강도 0.15의 Global Light 2D. 왼쪽은 Normal Maps Quality Disabled, 오른쪽은 Accurate, Distance 1입니다. 아트: Kenney Tiny Dungeon (CC0).")

이 실행에서는 *Distance*를 낮출수록 입체감이 강해졌고, 이 작은 장면에서는 *Fast*와 *Accurate*의 결과가 픽셀 단위로 같았습니다. 실제 아트에서 둘을 비교해 보십시오. 노멀맵에는 비용이 있습니다. 매뉴얼에 따르면 Unity는 레이어 배치마다 화면 크기 렌더 텍스처에 깊이 프리패스를 추가합니다.

**Sprite Atlas**에서는 보조 텍스처도 스프라이트와 함께 패킹됩니다. 아틀라스에 들어가는 모든 스프라이트에 같은 보조 텍스처 세트를 주지 않으면, 합쳐진 노멀맵 페이지에 빈 공간이 많이 생깁니다.

## 스프라이트용 노멀맵 만드는 법 {#making-normal-maps}

| 방법 | 잘 맞는 대상 | 도구 |
|---|---|---|
| 밝기에서 생성('밝기 = 높이') | 돌, 벽돌, 나무, 질감 있는 타일, 빠른 테스트 | Nerulio Texture Lab, [Laigter](https://github.com/azagaya/laigter), [SpriteIlluminator](https://www.codeandweb.com/spriteilluminator) |
| 알파 경계에서 생성(베벨) | 둥근 아이템, UI, 실루엣 | Laigter, SpriteIlluminator, Nerulio(*Height from: Alpha channel*) |
| 조명 프로필을 그려서 생성 | 입체감이 필요한 캐릭터 | [Sprite Lamp](http://www.snakehillgames.com/spritelamp/)(여러 방향에서 비춘 그림 2–5장) |
| 노멀을 직접 그리기 | 대표 아트, 픽셀 하나하나가 중요한 작은 도트 | 아무 페인트 프로그램 + 노멀 팔레트 |
| 3D에서 렌더링 | 프리렌더 스프라이트 | 3D 프로그램의 노멀 패스 |

자동 생성한 노멀맵은 출발점일 뿐입니다. 밝기는 높이가 아니므로 어두운 눈이나 검은 외곽선은 구멍처럼 읽힙니다. 조명을 움직이며 확인하십시오. Godot 매뉴얼은 Laigter(무료, GPL-3.0, 2D 조명 미리보기 지원)를 소개하며, SpriteIlluminator는 입체를 손으로 다듬는 브러시를 제공합니다.

시트 전체에서 생성할 때는 프레임 사이에 투명 픽셀을 두십시오. 3×3 커널은 이웃 프레임으로 한 픽셀, 5×5 커널은 두 픽셀을 읽습니다.

:::nerulio tool=texture-lab
Texture Lab의 **노멀** 단계는 스프라이트나 타일을 브라우저 안에서 노멀맵으로 바꿉니다. 파일은 업로드되지 않습니다. 이미지를 높이 필드로 읽어 그에 해당하는 노멀을 쓰므로 시트나 아틀라스의 레이아웃이 그대로 유지됩니다. 규격은 화면에 표시하며, 추측하지 않습니다.
- PNG를 놓고 **하이트 → 노멀**을 고른 뒤, Godot·Unity용이면 **규격: OpenGL +Y**를 선택합니다.
- **강도**(0–10, 기본값 2)를 정합니다. *고급 설정*에서 **미분 커널**(Sobel 3×3, Scharr 3×3, Sobel 5×5), **높이 출처**(밝기 또는 알파 채널), 타일이라면 **가장자리를 이어서 샘플링**을 고릅니다.
- **노멀 맵 저장 (PNG)**을 누르면 원본 해상도의 `<이름>-normal.png`가 저장됩니다. 위 렌더링에 쓴 노멀맵도 이 버튼으로 만들었습니다.
- 이미 DirectX 노멀맵이 있다면 **OpenGL ↔ DirectX**가 초록 채널을 정확히 반전합니다.
- 한계: 한 번에 한 장씩, 2D 조명 미리보기 없음(Preview 단계는 3D 머티리얼 미리보기), 스페큘러 맵 생성 없음.
:::

![Nerulio Texture Lab의 노멀 단계: 던전 타일 원본, 생성된 노멀맵, OpenGL/DirectX 규격 선택](shot:lab-texture-normal "Nerulio Texture Lab: OpenGL +Y 규격으로 하이트 → 노멀, 그리고 엔진별 기대 규격 표.")

## 자주 묻는 질문 {#faq}

### Godot 4에서 노멀맵이 전혀 적용되지 않아요 {#faq-godot-no-effect}

텍스처가 일반 PNG가 아니라 CanvasTexture여야 합니다. PointLight2D에는 Texture가 필요하고, 조명이 닿는 범위는 그 텍스처 크기 × Texture Scale입니다. Height가 0보다 커야 하며, 0이면 평평한 노멀맵 영역이 거의 까맣게 남습니다. 스프라이트의 Light Mask와 조명의 Item Cull Mask도 맞아야 합니다.

### Unity 스프라이트가 노멀맵을 무시해요 {#faq-unity-ignored}

새 Light 2D는 모두 Normal Maps → Quality가 Disabled입니다. Fast 또는 Accurate로 바꾸십시오. 프로젝트가 2D Renderer를 쓰는지, 머티리얼이 Sprite-Lit-Default(또는 라이트를 받는 Shader Graph)인지, 보조 텍스처 이름이 정확히 `_NormalMap`인지도 확인하십시오.

### Godot와 Unity는 OpenGL과 DirectX 중 어느 노멀맵을 쓰나요? {#faq-convention}

둘 다 OpenGL 방식(Y+)을 기대합니다. 위아래 조명이 뒤집혀 보이면 노멀맵의 초록 채널을 반전하십시오. Godot는 임포트 옵션 *Normal Map Invert Y*로, Unity는 *Flip Green Channel*로 처리할 수 있습니다.

### 도트 그래픽 노멀맵도 Nearest 필터를 써야 하나요? {#faq-nearest}

네. Godot의 CanvasTexture는 노멀맵을 스프라이트와 같은 필터로 샘플링하므로, 노드·CanvasTexture·프로젝트 기본값 중 하나를 Nearest로 두면 둘 다 적용됩니다. Unity에서는 노멀맵 자체의 Filter Mode를 Point, Compression을 None으로 설정하십시오.

### TileMap이나 애니메이션 스프라이트에도 노멀맵을 쓸 수 있나요? {#faq-tilemap-animation}

두 엔진 모두 가능합니다. Godot에서는 TileSet 아틀라스 텍스처나 SpriteFrames 안 AtlasTexture의 아틀라스로 CanvasTexture를 쓰면 됩니다. Unity에서는 스프라이트 시트마다 `_NormalMap` 보조 텍스처를 지정하면 같은 슬라이스를 따라갑니다.

## 참고 자료 {#sources}

- Godot Engine 4.7 문서: [2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- Godot 4.7 클래스 레퍼런스: [CanvasTexture](https://docs.godotengine.org/en/stable/classes/class_canvastexture.html), [PointLight2D](https://docs.godotengine.org/en/stable/classes/class_pointlight2d.html), [DirectionalLight2D](https://docs.godotengine.org/en/stable/classes/class_directionallight2d.html), [Light2D](https://docs.godotengine.org/en/stable/classes/class_light2d.html)
- Godot 4.7 클래스 레퍼런스: [ProjectSettings, rendering/textures/canvas_textures/default_texture_filter](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)
- Unity 6.5(6000.5) 매뉴얼: [Add a normal map or a mask map to a sprite in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/SecondaryTextures.html)
- Unity 6.5 매뉴얼: [Light 2D component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2DLightProperties.html)
- Unity 6.5 매뉴얼: [Create a 2D light in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-light-properties-explained.html)
- Unity 6.5 매뉴얼: [Set up a project for 2D games with the Universal 2D template](https://docs.unity3d.com/6000.5/Documentation/Manual/setup-project-2d-game.html)
- Unity 6.5 매뉴얼: [Create a sprite atlas](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/create-sprite-atlas.html)
- Laigter: [GitHub 저장소 (GPL-3.0)](https://github.com/azagaya/laigter)
- CodeAndWeb: [SpriteIlluminator](https://www.codeandweb.com/spriteilluminator)
- Snake Hill Games: [Sprite Lamp](http://www.snakehillgames.com/spritelamp/)
