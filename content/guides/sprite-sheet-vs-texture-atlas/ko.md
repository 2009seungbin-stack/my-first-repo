**스프라이트 시트**는 프레임을 같은 크기의 격자로 늘어놓은 이미지 한 장입니다. 칸 크기만 알면 n번째 프레임의 위치가 계산되므로 데이터 파일이 필요 없습니다. **텍스처 아틀라스**는 크기가 제각각인 이미지를 최대한 빽빽하게 채워 넣고, 각 프레임의 사각형·트림 오프셋·(경우에 따라) 90° 회전 정보를 데이터 파일(JSON, XML, `.atlas`, `.tres`)에 따로 기록합니다. 크기가 같은 작은 애니메이션이라면 그리드 시트로 충분하고, 프레임 크기가 다르거나 투명 여백이 많거나 많은 스프라이트를 텍스처 하나·드로우 콜 하나로 그리고 싶다면 패킹된 아틀라스를 쓰는 편이 좋습니다. 어떤 방식이든 트림 오프셋은 반드시 남겨야 하고, 회전은 대상 엔진이 모두 회전 프레임을 읽을 때만 켜야 합니다. PixiJS와 Spine은 읽고, Phaser와 Godot는 읽지 못합니다.

이 글의 엔진 동작은 Kenney의 CC0 에셋 *Space Shooter Redux*로 만든 테스트 아틀라스 하나를 Phaser 3.90.0, Phaser 4.2.1, PixiJS 8.21.0, Spine 4.2 캔버스 런타임, Godot 4.7.2에 직접 불러와 확인했습니다.

## 스프라이트 시트와 아틀라스의 차이 {#difference}

| | 그리드 스프라이트 시트 | 패킹된 텍스처 아틀라스 |
|---|---|---|
| 배치 | 같은 크기의 칸, 필요하면 margin·spacing | 크기 제각각, 패커(MaxRects, Skyline…)가 배치 |
| 데이터 파일 | 없음(칸 크기, margin, spacing) | 필수: 사각형, 트림 오프셋, 회전, 피벗 |
| 투명 여백 | 칸마다 그대로 남음 | 잘라내므로 페이지가 작아짐 |
| 엔진에서 설정 | 그리드 분할(`load.spritesheet`, Godot 그리드, Unity *Grid By Cell Size*) | 엔진의 아틀라스 로더나 임포터 |
| 알맞은 용도 | 크기가 같은 도트 캐릭터, 타일 | 크기가 섞인 이펙트·UI, 여러 캐릭터를 한 페이지에 |

둘 중 하나만 골라야 하는 것은 아닙니다. Aseprite에서는 그리드 스트립으로 애니메이션을 그리고, 빌드할 때 모든 스트립의 프레임을 아틀라스 하나로 패킹하는 프로젝트가 많습니다. 타일셋은 타일맵 에디터가 격자 번호로 타일을 찾기 때문에 그리드로 두는 것이 일반적입니다([타일 틈과 익스트루드](guide:tile-seams-texture-bleeding-padding-extrude) 참고).

## 어느 엔진에서나 제대로 읽히는 아틀라스 만들기 {#steps}

:::steps
1. **페이지 크기부터 정합니다.** 가장 약한 대상 기기가 읽을 수 있는 최대 페이지 크기를 정합니다. OpenGL ES 3.0(즉 WebGL 2)이 보장하는 것은 한 변 2048 px까지이고, 그보다 큰 크기를 허용하는 기기도 많으므로 실제 한계는 실행 중에 확인합니다. 한 장에 다 들어가지 않으면 멀티팩을 켭니다.
2. **트림하되 오프셋은 남깁니다.** 투명 테두리는 잘라내되 원래 프레임 크기와 위치를 기록하는 모드를 고릅니다(TexturePacker *Trim*, Nerulio *Trim (keep size and position)*). 애니메이션 프레임에는 crop 계열 모드를 쓰지 않습니다.
3. **모든 대상이 읽지 못하면 회전은 끕니다.** 회전으로 아끼는 공간은 작은데, Phaser와 Godot에서는 오류 없이 잘못 그려집니다([회전 표](#rotation) 참고).
4. **샘플링 방식에 맞게 패딩을 정합니다.** 니어리스트 필터·밉맵 없는 도트 그래픽은 셰이프 패딩 2 px, 익스트루드 1 px이면 됩니다. 필터링·확대축소·밉맵을 쓰는 그림은 4~8 px에 익스트루드나 알파 블리드를 더합니다.
5. **같은 프레임은 한 번만 저장합니다.** 중복 감지(TexturePacker *Detect identical sprites*, libGDX `alias`, Nerulio *Store identical frames once*)를 켜면 멈춰 있는 프레임이나 왕복 루프가 픽셀을 더 차지하지 않습니다.
6. **크기 제약을 고릅니다.** 2의 거듭제곱(POT)은 필요할 때만 씁니다. WebGL 1에서 밉맵이나 반복(repeat)을 쓰거나 오래된 압축 포맷을 쓸 때가 그렇습니다. 그 밖에는 *Smallest*나 *Any size*가 공간 낭비가 적습니다.
7. **엔진 고유 포맷으로 내보내고 표준 로더로 읽습니다.** Phaser `this.load.atlas`, PixiJS `Assets.load`, `AtlasTexture`로 이루어진 Godot `SpriteFrames`, libGDX/Spine `.atlas` 등입니다.
8. **모든 프레임을 원래 크기로 확인합니다.** 단색 배경 위에 각 프레임을 원본 크기로 그려 원본 이미지와 비교합니다. 위치가 어긋난 트림 프레임이나 옆으로 누운 회전 프레임이 바로 드러납니다.
:::

## 트림: 오프셋을 반드시 남겨야 하는 이유 {#trimming}

트림은 패킹 전에 프레임마다 투명 테두리를 잘라냅니다. 이때 그림이 원래 프레임 안의 어디에 있었는지를 아틀라스가 함께 기록해야만 제대로 동작합니다. 기록이 없으면 걷기 동작의 프레임마다 자기 바운딩 박스를 기준으로 다시 가운데 정렬되어, 캐릭터가 떨리거나 발이 바닥에서 뜹니다. TexturePacker 형식 JSON은 프레임마다 세 가지를 저장합니다.

- `frame`: 아틀라스 페이지 위의 사각형
- `spriteSourceSize`: 잘린 그림이 원래 프레임 안에서 놓인 위치(`x`, `y`)
- `sourceSize`: 원래 프레임 크기. `"trimmed": true`이면 Phaser와 PixiJS는 원래 크기를 유지한 것처럼 스프라이트를 그립니다.

테스트에서는 128×112 프레임을 99×75 우주선만 남도록 트림했고, Phaser 3.90, Phaser 4.2, PixiJS 8.21 모두 정확한 위치에 픽셀 단위로 똑같이 그렸습니다. Starling/Sparrow XML은 같은 정보를 `frameX`/`frameY`(음수 오프셋)와 `frameWidth`/`frameHeight`로 저장합니다.

> **Phaser 3.90과 트림된 Sparrow XML:** Phaser 3.90의 `atlasXML` 파서는 `setTrim`에 크기 값을 잘못된 순서로 넘깁니다. 그래서 트림된 XML 프레임이 잘린 크기(128×112가 아니라 99×75)로 보고되고, 기본값인 가운데 원점(origin)을 쓰면 엉뚱한 위치에 그려집니다. Phaser 4.2에서는 고쳐졌습니다. Phaser 3에서는 JSON을 쓰거나 XML을 트림 없이 내보내세요.

Godot의 `AtlasTexture`는 같은 정보를 `margin`으로 표현합니다. position은 트림 오프셋, size는 원래 크기에서 region 크기를 뺀 값입니다.

```gdscript
# Restore a trimmed atlas frame in Godot 4 (checked in Godot 4.7.2).
# The ship's source frame was 128x112; the trimmed art (99x75) is stored at (105, 2)
# on the atlas and sat at (10, 20) inside the original frame.
var frame := AtlasTexture.new()
frame.atlas = preload("res://atlas.png")
frame.region = Rect2(105, 2, 99, 75)
frame.margin = Rect2(10, 20, 128 - 99, 112 - 75)  # offset, then source size - region size
print(frame.get_size())  # (128.0, 112.0): the sprite behaves like the untrimmed frame
```

이 프레임을 `Sprite2D`로 그린 결과는 트림하지 않은 원본 이미지와 비교해 다른 픽셀이 0개였습니다.

crop 계열 모드는 다릅니다. *Crop, keep position*은 프레임 자체를 작게 만들고 그림이 제자리에 있도록 피벗을 옮기고, *Crop, flush position*은 오프셋을 아예 버립니다. 정지한 소품이나 아이콘에는 괜찮지만, 애니메이션 떨림의 전형적인 원인입니다. 피벗 쪽 이야기는 [히트박스와 피벗](guide:hitboxes-pivots-2d-animation)에서 다룹니다.

## 회전: 어떤 엔진이 회전 프레임을 읽을까 {#rotation}

회전을 켜면 패커는 빈 틈에 맞추기 위해 프레임을 90° 돌려서 저장할 수 있고, 엔진은 그리기 전에 다시 돌려놓아야 합니다. TexturePacker JSON에서 `"rotated": true`는 프레임이 시계 방향으로 90° 돌아간 채 저장되었다는 뜻이며, `frame.w`/`frame.h`는 똑바로 선 상태의 크기입니다. Spine/libGDX `.atlas`는 반대 방향으로, `rotate: true`(또는 `90`)가 반시계 방향 90°를 뜻합니다. Starling XML의 `rotated="true"`는 시계 방향입니다.

| 엔진·포맷 | 회전 프레임을 읽는가 | 확인한 결과 |
|---|---|---|
| PixiJS 8.21 (TexturePacker JSON) | 예 | 시계 방향 프레임을 똑바로, 정확하게 그렸습니다. 대조군인 반시계 방향 프레임은 틀리게 나와 규칙이 확인되었습니다. |
| Phaser 3.90, 4.2 (JSON hash, `atlasXML`) | 아니요 | 오류 없이 로드되지만 옆으로 누운 채 잘려서 그려집니다. 프레임 크기 규칙을 두 가지 모두 시험했습니다. `atlasXML`은 `rotated`를 아예 무시합니다. |
| Spine 런타임 / libGDX `.atlas` | 예(반시계 방향) | spine-canvas 4.2가 `rotate: 90` 영역을 똑바로 그렸습니다. libGDX 패커는 `rotation`이 기본으로 꺼져 있고, 회전된 영역은 앱이 따로 신경 써서 그려야 한다고 경고합니다. |
| Godot 4.7 | 아니요 | `AtlasTexture`에는 `atlas`, `region`, `margin`, `filter_clip`뿐이고 회전 속성이 없습니다. TexturePacker의 Godot 임포터도 회전하지 말라고 안내합니다. |
| Unity 6 | 자체 Sprite Atlas 안에서만 | *Allow Rotation*은 Sprite Atlas 옵션이며, 매뉴얼은 Canvas UI에서는 끄라고 안내합니다. 외부 아틀라스를 스프라이트 사각형으로 잘라 쓰는 경우에는 회전을 표현할 수 없습니다. |
| LÖVE, Defold, GameMaker | 미리 패킹된 아틀라스로는 불가 | LÖVE의 `Quad`는 단순한 사각형입니다. Defold와 GameMaker는 개별 이미지를 받아 텍스처 페이지를 스스로 만듭니다. |

![같은 아틀라스를 각 엔진이 그린 결과: 원본 프레임, PixiJS 8.21, Phaser 3.90, Phaser 4.2](shot:engine-atlas-rotation "Chromium에서 TexturePacker 형식 JSON 아틀라스 하나를 PixiJS 8.21, Phaser 3.90, Phaser 4.2가 그린 결과입니다. 1 트림 없음, 2 트림, 3 트림 + 시계 방향 90° 회전 저장, 4 회전된 레이저. 회전 프레임을 되돌려 그린 것은 PixiJS뿐입니다. 그림: Kenney, CC0.")

대상 중 하나라도 '아니요'에 해당하면 회전 없이 패킹하세요. 대부분의 프레임 세트에서 회전으로 줄어드는 크기는 크지 않습니다.

## 패딩, 익스트루드, 밉맵 {#padding}

이웃 스프라이트가 번져 들어오는 것을 막는 설정은 세 가지입니다.

- **테두리 패딩(border padding):** 스프라이트와 페이지 가장자리 사이의 빈 픽셀입니다.
- **셰이프 패딩(shape padding):** 스프라이트끼리의 간격입니다. TexturePacker 문서는 OpenGL 렌더링이라면 최소 2를 권장합니다.
- **익스트루드(extrude):** 스프라이트 가장자리 픽셀을 바깥으로 복제합니다. 사각형 바로 바깥을 샘플링해도 투명한 틈이나 이웃 스프라이트가 아니라 자기 색이 나옵니다. Unity의 *Alpha Dilation*과 libGDX의 `bleed`도 같은 이유로 투명 픽셀 밑의 색을 채웁니다.

번짐은 샘플링 때문에 생깁니다. 선형 필터링은 픽셀을 이웃과 섞고, 서브픽셀 카메라 위치나 정수가 아닌 배율은 사각형 경계 너머를 샘플링합니다. 밉맵은 단계마다 2×2 블록을 평균하므로, 2 px 간격은 밉 레벨 1에서 1 텍셀로 줄고 레벨 2에서는 사라집니다. 실제로 쓰이는 밉 레벨이 깊을수록 간격도 넓어야 합니다. GameMaker의 텍스처 그룹은 테두리 기본값이 2 px이고 밉맵을 켜면 8 px로 강제하며, Unity Sprite Atlas의 패딩 기본값은 4 px입니다.

| 그림과 샘플링 | 셰이프 패딩 | 익스트루드 / 블리드 |
|---|---|---|
| 도트 그래픽, 니어리스트, 밉맵 없음, 정수 배율 | 2 px | 1 px(서브픽셀 카메라 위치까지 대비) |
| 빈틈없이 이어 그리는 타일 | 2 px | 1~2 px(이음새 해결책) |
| 부드러운 그림, 선형 필터, 밉맵 없음 | 2~4 px | 1~2 px 또는 알파 블리드 |
| 밉맵을 쓰거나 크게 축소하는 그림 | 8 px 이상 | 알파 블리드, 쓰는 밉 레벨에 맞춰 늘린 패딩 |

## 페이지 크기: POT, NPOT, 최대 텍스처 크기 {#page-size}

- **최대 크기.** OpenGL ES 3.0 사양이 보장하는 `GL_MAX_TEXTURE_SIZE`는 2048 이상뿐입니다. 이 테스트 PC의 Chromium은 AMD GPU로 16384, SwiftShader 소프트웨어 렌더러로 8192를 보고했습니다. libGDX 패커 기본값은 1024('모든 기기에서 안전'), TexturePacker 기본값은 2048입니다. 추측하지 말고 실행 중에 실제 값을 확인하세요.
- **메모리.** 압축하지 않은 RGBA8888 페이지는 가로 × 세로 × 4바이트입니다. 2048²는 16 MiB, 4096²는 64 MiB이고, 절반이 빈 POT 페이지도 꽉 찬 페이지와 같은 메모리를 씁니다.
- **2의 거듭제곱.** WebGL 1은 POT가 아닌 텍스처에 밉맵이나 repeat를 쓸 수 없고, WebGL 2와 요즘 데스크톱·모바일 API는 쓸 수 있습니다. 블록 압축 포맷은 4×4 블록 단위로 동작하므로 패커에 *multiple of 4* 옵션이 있습니다. POT는 대상이 요구할 때만 씁니다.
- **멀티팩.** 프레임이 한 페이지에 다 들어가지 않으면 패커가 여러 장을 씁니다.
  - Phaser는 `load.multiatlas`로 읽습니다.
  - PixiJS는 `meta.related_multi_packs`를 따라갑니다.
  - Defold의 *Max Page Size*는 `*_paged_atlas.material` 머티리얼과 함께 쓰면 여러 페이지로 나뉘어도 드로우 콜 하나로 그립니다.
  - 애니메이션 하나는 한 페이지에 모아 두어야 재생 중에 텍스처가 바뀌지 않습니다.

```js
// Ask the renderer instead of guessing (both lines were run in Chromium).
const phaserMax = this.game.renderer.getMaxTextureSize();                 // Phaser 3.90 / 4.2, inside a Scene
const pixiMax = app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE); // PixiJS 8, WebGL renderer
```

## 드로우 콜과 배칭 {#batching}

GPU 드로우 콜 하나는 그때 바인딩된 텍스처만 샘플링할 수 있습니다. 다음 스프라이트에 바인딩되지 않은 텍스처가 필요하면 렌더러는 배치를 끝내고 새로 시작합니다. 서로 다른 이미지 40개를 번갈아 쓰는 스프라이트 200개로 실제 WebGL 드로우 콜 수를 세어 보았습니다.

| 엔진 | 개별 텍스처 40개 | 같은 40개를 아틀라스 한 장의 프레임으로 |
|---|---|---|
| Phaser 3.90 | 드로우 콜 13회 | 1회 |
| Phaser 4.2 | 드로우 콜 13회 | 1회 |
| PixiJS 8.21 | 드로우 콜 7회 | 1회 |

요즘 웹 렌더러는 이미 드로우 콜 하나에 텍스처 여러 장을 묶기 때문에 예전 조언만큼 차이가 크지는 않습니다. 그래도 아틀라스를 쓰면 여러 번의 호출이 한 번으로 줄어듭니다. Unity 매뉴얼도 스프라이트 아틀라스 안의 스프라이트는 드로우 콜 하나로 그릴 수 있다고 설명합니다. 그리는 순서도 중요합니다. 두 아틀라스의 스프라이트가 깊이 순서상 번갈아 나오면 배치가 계속 끊기므로, 함께 그려지는 것끼리 같은 페이지에 두세요.

## 엔진별 아틀라스 포맷 {#formats}

| 엔진 | 패킹된 아틀라스 포맷 | 불러오는 방법 |
|---|---|---|
| Phaser 3 / 4 | TexturePacker JSON hash·array, 멀티아틀라스 JSON, Starling/Sparrow XML | `load.atlas`, `load.multiatlas`, `load.atlasXML`([Phaser 가이드](guide:phaser-sprite-sheet-atlas-animation)) |
| PixiJS 8 | `animations`, `meta.scale`, `related_multi_packs`가 들어간 TexturePacker JSON hash | `Assets.load('atlas.json')` → `Spritesheet`([PixiJS 가이드](guide:pixijs-8-spritesheet-animation)) |
| Godot 4 | `AtlasTexture`(region + margin)로 이루어진 `SpriteFrames`, 내장 *Import As: TextureAtlas*, TexturePacker 플러그인 | `.tres` 리소스([Godot 가이드](guide:godot-4-sprite-sheet-animation)) |
| Unity 6 | Sprite Atlas 에셋(Unity가 패킹) 또는 Sprite Mode *Multiple* 텍스처 한 장과 스프라이트 사각형 | Sprite Atlas / Sprite Editor |
| libGDX, Spine | `.atlas` 텍스트(`bounds`, 아래쪽 기준 `offsets`, `rotate`) | `TextureAtlas` / Spine 런타임 |
| Defold | 개별 이미지로 Defold가 만드는 `.atlas` | Atlas 리소스([Defold 가이드](guide:defold-atlas-tile-source-flipbook)) |

Godot의 내장 *TextureAtlas* 임포트 모드도 알아 두면 좋습니다. 여러 PNG에 같은 `atlas_file`을 지정하면 Godot가 이미지 한 장으로 패킹하고 각각을 `AtlasTexture`로 만듭니다. `trim_alpha_border_from_region`은 기본으로 켜져 있고, *Mesh* 모드는 크고 대부분 투명한 스프라이트용 폴리곤 메시를 만듭니다.

:::nerulio ws=pack
Nerulio의 Pack & Export 작업 공간은 프로젝트의 모든 프레임을 브라우저 안에서 패킹합니다. 아무것도 업로드되지 않으며, 같은 프레임이 모든 엔진으로 나갑니다.

- **패커.** MaxRects, Skyline, Guillotine 중에서 고르거나 전부 시도하게 할 수 있습니다. 페이지 크기는 POT, 정사각형, 고정, 최소 크기 중에서 고르며, 멀티팩은 최대 64장까지입니다.
- **트림 모드.** *None*, *Trim (keep size and position)*, *Crop, keep position*, *Crop*과 알파 임계값을 지원합니다.
- **패딩과 같은 프레임.** 셰이프 패딩(기본 2 px), 테두리 패딩, 익스트루드를 설정할 수 있고, *Store identical frames once*가 기본으로 켜져 있습니다. 배율 변형(@0.5x~@4x)은 니어리스트 방식이라 도트가 흐려지지 않습니다.
- **엔진 프리셋.** 회전을 읽지 못하는 엔진(Godot, Unity, Phaser, LÖVE)에서는 프리셋이 회전을 끄고, PixiJS와 Spine에서는 허용합니다.
- **내보내기 검증 표시.** 각 포맷을 어떻게 검증했는지 "Loaded in Godot 4.7.2"처럼 보여 줍니다. GameMaker 스트립은 테스트할 GameMaker가 없어 UNVERIFIED로 표시됩니다.
:::

![Nerulio Pack & Export: 트림·패딩·익스트루드 설정과 사용률이 보이는 패킹된 아틀라스 페이지](shot:studio-pack-atlas "Nerulio Pack & Export: 패킹된 페이지 한 장, 프레임별 트림 크기, 이를 만든 설정입니다.")

![Nerulio Pack & Export: Loaded in Godot 4.7.2 검증 표시가 있는 엔진 목록](shot:studio-pack-export "내보내기 대상마다 검증 방식이 표시되고, GameMaker는 UNVERIFIED로 표시됩니다.")

## 자주 묻는 질문 {#faq}

### 스프라이트 시트와 텍스처 아틀라스는 같은 것인가요?

두 말을 느슨하게 섞어 쓰지만, 보통 스프라이트 시트는 데이터 파일이 필요 없는 같은 크기의 격자를 말합니다. 텍스처 아틀라스는 크기가 제각각인 이미지를 빽빽하게 채우고 프레임별 사각형과 오프셋을 데이터 파일에 담은 것을 말합니다. 둘 다 여러 이미지를 텍스처 한 장에 모읍니다.

### 프레임을 패킹한 뒤 캐릭터가 떨리는 이유는 무엇인가요?

프레임을 crop하면서 오프셋을 잃었거나, 로더가 오프셋을 무시했기 때문입니다. `sourceSize`와 `spriteSourceSize`를 남기는 트림 모드(Godot라면 `AtlasTexture.margin`)로 패킹하고, 애니메이션 프레임에는 crop 모드를 쓰지 마세요.

### Phaser나 Godot용으로 TexturePacker에서 회전을 허용해도 되나요?

안 됩니다. Phaser 3.90과 4.2는 `"rotated": true` 프레임을 불러오지만 옆으로 누운 채 그리고, Godot의 `AtlasTexture`에는 회전 속성이 없습니다. PixiJS 8과 Spine/libGDX 런타임은 회전 프레임을 제대로 읽습니다.

### 도트 그래픽에는 패딩과 익스트루드를 얼마나 주어야 하나요?

니어리스트 필터, 밉맵 없음, 정수 배율이라면 셰이프 패딩 2 px과 익스트루드 1 px이면 됩니다. 익스트루드는 타일이나 서브픽셀 카메라 위치에서 그려지는 스프라이트에 특히 효과가 큽니다. 밉맵을 쓰는 그림은 8 px 이상과 알파 블리드가 필요합니다.

### 아틀라스는 최대 몇 픽셀까지 만들 수 있나요?

OpenGL ES 3.0과 WebGL 2가 보장하는 크기는 2048×2048뿐입니다. 더 큰 크기를 받는 GPU도 많고, 이 테스트 PC는 16384를 보고했습니다. 실행 중에 `MAX_TEXTURE_SIZE`를 읽고, 저사양 모바일이나 알 수 없는 브라우저까지 대상이라면 페이지를 2048로 유지하세요.

## 출처 {#sources}

- TexturePacker documentation, *Texture settings*(트림 모드, 패딩, 익스트루드, 회전, 최대 크기, 멀티팩): https://www.codeandweb.com/texturepacker/documentation/texture-settings
- libGDX wiki, *Texture packer*(설정과 기본값: `paddingX`, `rotation`, `alias`, `bleed`, `maxWidth` 1024): https://libgdx.com/wiki/tools/texture-packer
- Spine, *Atlas export format*(`bounds`, `offsets`, `rotate`): https://esotericsoftware.com/spine-atlas-format
- Starling API, `TextureAtlas`(XML 포맷, `frameX`, `rotated`): https://doc.starling-framework.org/current/starling/textures/TextureAtlas.html
- Godot 4 클래스 레퍼런스, `AtlasTexture`: https://docs.godotengine.org/en/stable/classes/class_atlastexture.html
- Godot 4 클래스 레퍼런스, `ResourceImporterTextureAtlas`: https://docs.godotengine.org/en/stable/classes/class_resourceimportertextureatlas.html
- Godot 4용 TexturePacker 임포터(회전 미지원): https://github.com/CodeAndWeb/texturepacker-godot-plugin
- Unity 6 매뉴얼, *Packing sprites into atlas textures*: https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/atlas-landing.html
- Unity 6 매뉴얼, *Sprite Atlas Inspector window reference*: https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html
- Phaser API, `LoaderPlugin`(`atlas`, `atlasXML`, `multiatlas`): https://docs.phaser.io/api-documentation/class/loader-loaderplugin
- PixiJS 8 가이드, *Spritesheets*: https://pixijs.com/8.x/guides/components/sprite-sheets
- Defold 매뉴얼, *Atlas*(margin, inner padding, extrude borders, max page size): https://defold.com/manuals/atlas/
- GameMaker 매뉴얼, *Texture Groups*(border size, mipmaps): https://manual.gamemaker.io/monthly/en/Settings/Texture_Groups.htm
- LÖVE wiki, `love.graphics.newQuad`: https://love2d.org/wiki/love.graphics.newQuad
- MDN, *Using textures in WebGL*(WebGL 1의 NPOT 제한): https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
- Khronos, OpenGL ES 3.0 `glGet`(`GL_MAX_TEXTURE_SIZE` 최소 2048): https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml
