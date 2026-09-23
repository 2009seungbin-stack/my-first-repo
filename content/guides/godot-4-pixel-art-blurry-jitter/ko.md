Godot 4에서 도트(픽셀 아트)가 흐리게 보이는 이유는 2D 텍스처를 기본적으로 **Linear** 필터로 그리기 때문입니다. **Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter**를 **Nearest**로 바꾸면 해결됩니다. 떨림이나 픽셀이 일렁이는 현상은 정수가 아닌 배율로 늘리거나 스프라이트·카메라가 픽셀 사이에 걸칠 때 생깁니다. 이때는 **Display → Window → Stretch**에서 **Mode**를 `viewport`, **Scale Mode**를 `integer`(Godot 4.2+)로 두고, **Rendering → 2D → Snap → Snap 2D Transforms to Pixel**을 켠 뒤, 카메라를 정수 픽셀 단위로 움직이세요.

아래의 설정과 수치는 모두 Godot 4.7.2(gl_compatibility 렌더러)에서 확인했습니다. 이미지는 Kenney의 CC0 에셋(Pixel Platformer, Tiny Dungeon)을 Godot로 실제 렌더링한 결과입니다. Godot 4.7에서 달라진 점이 하나 있습니다. 4.7로 새로 만든 프로젝트는 **Stretch Mode**가 `canvas_items`, **Aspect**가 `expand`로 시작하므로 새 프로젝트라도 이 설정을 꼭 확인하세요.

## 도트를 선명하고 안정적으로 만들기 {#steps}

:::steps
1. **텍스처 필터를 Nearest로 바꿉니다.** **Project → Project Settings**에서 **Rendering → Textures → Canvas Textures**로 가서 **Default Texture Filter**를 **Nearest**로 설정합니다. 필터가 **Inherit**인 노드는 모두 텍셀을 또렷한 사각형으로 그리게 됩니다. 특정 노드만 바꾸려면 그 노드의 **CanvasItem → Texture → Filter**를 **Nearest**로 설정합니다.
2. **가져오기 설정을 확인합니다.** FileSystem 독에서 PNG를 고르고 **Import** 독을 엽니다. **Compress → Mode**는 **Lossless**(기본값), **Mipmaps → Generate**는 꺼짐(기본값)이어야 합니다. 도트 그림에는 **VRAM Compressed**를 쓰지 마세요. 값을 바꿨다면 **Reimport**를 누릅니다.
3. **기준 해상도를 정합니다.** **Display → Window → Size**에서 **Viewport Width**와 **Viewport Height**를 게임의 픽셀 해상도로 설정합니다(예: 320×180, 640×360). 둘 다 1280×720, 1920×1080, 2560×1440에 딱 맞게 늘어납니다. 시작할 때 창을 크게 띄우려면 **Window Width Override**와 **Window Height Override**를 설정합니다(예: 1280×720).
4. **정수 배율로만 늘립니다.** **Display → Window → Stretch**에서 **Mode**를 `viewport`, **Aspect**를 `keep`(검은 여백) 또는 `expand`(넓은 화면에서 더 많은 영역 표시), **Scale Mode**를 `integer`로 설정합니다. 그러면 게임이 기준 해상도로 그려진 뒤 2배, 3배, 4배처럼 정수배로만 확대되고 3.125배 같은 배율은 쓰이지 않습니다.
5. **스프라이트를 픽셀에 맞춥니다.** **Rendering → 2D → Snap**에서 **Snap 2D Transforms to Pixel**을 켭니다. **Snap 2D Vertices to Pixel**은 꺼 두세요. 둘을 함께 쓰지 말라고 문서에서 권합니다. 스냅 설정은 게임을 시작할 때만 읽으므로 바꾼 뒤에는 다시 실행해야 합니다.
6. **카메라를 정수 픽셀 단위로 움직입니다.** 플레이어를 따라가는 Camera2D의 **Position Smoothing**을 끄고, 카메라를 플레이어의 반올림한 위치에 둡니다(아래 스크립트). 스무딩을 켠 카메라는 대부분의 프레임에서 픽셀과 픽셀 사이에 놓입니다.
7. **고주사율 화면의 끊김을 없앱니다.** 120/144Hz에서 움직임이 고르지 않다면 **Physics → Common → Physics Interpolation**을 켭니다(2D는 Godot 4.3+). 물체는 `_physics_process()`에서 움직이고, 켠 뒤에는 카메라를 다시 확인하세요.
:::

![같은 Kenney 캐릭터 두 개를 6배로 그린 모습. 왼쪽은 Linear 필터라 부드럽게 번지고, 오른쪽은 Nearest라 픽셀 하나하나가 또렷한 사각형입니다](shot:engine-godot-pixel-linear-vs-nearest "Godot 4.7.2(gl_compatibility) 렌더링: Sprite2D 6배, texture_filter Linear(왼쪽)와 Nearest(오른쪽). 그림: Kenney Pixel Platformer, CC0.")

## 설정을 한곳에 모으면 {#project-godot}

파일을 직접 고치는 편이 편하다면, 위 단계가 `project.godot`에 쓰는 줄은 다음과 같습니다. Godot 4.7.2에서 그대로 읽힙니다. 1000×600 창에서는 320×180 게임이 정확히 3배로 그려지고 좌우 20px, 위아래 30px의 여백이 생겼습니다. `scale_mode="fractional"`로 바꾸면 같은 창에서 3.125배가 됐습니다.

```ini
[display]

window/size/viewport_width=320
window/size/viewport_height=180
window/size/window_width_override=1280
window/size/window_height_override=720
window/stretch/mode="viewport"
window/stretch/aspect="keep"
window/stretch/scale_mode="integer"

[rendering]

textures/canvas_textures/default_texture_filter=0
2d/snap/snap_2d_transforms_to_pixel=true
```

`default_texture_filter=0`이 Nearest이고, 기본값 1은 Linear입니다. 정수 배율에서는 창이 기준 크기보다 작아지면 화면이 잘립니다. 플레이어가 창 크기를 바꿀 수 있다면 루트 창의 `min_size`를 기준 크기로 설정하세요.

## 도트가 흐려지는 이유 {#why-blurry}

- **필터는 이미지가 아니라 노드의 속성입니다.** 모든 CanvasItem에는 **Texture → Filter**가 있습니다. 기본값 **Inherit**는 부모의 필터를 따르고, 맨 위에서는 뷰포트의 필터, 즉 프로젝트 설정을 따릅니다.
- **SubViewport는 필터를 따로 가집니다.** 새로 만든 SubViewport의 **Canvas Items → Default Texture Filter**는 프로젝트 설정과 상관없이 **Linear**입니다(4.7.2에서 확인). CRT 효과나 화면 분할 때문에 게임을 SubViewport에 그린다면 그곳도 **Nearest**로 바꾸세요.
- **압축과 밉맵.** VRAM 압축은 블록 모양의 뭉개짐과 색 틀어짐을 만듭니다. 밉맵은 *Mipmap* 계열 필터에서만 쓰이며 카메라를 축소하면 스프라이트가 더 흐려집니다. 2D 도트에는 거의 필요 없습니다. Import 독의 **2D** 프리셋을 쓰면 텍스처를 3D에서 써도 Lossless가 유지됩니다. 기본 **2D/3D (Auto-Detect)** 프리셋은 그런 텍스처를 VRAM Compressed로 바꿉니다.
- **그림 자체가 이미 흐립니다.** 가져오기 전에 부드럽게 리사이즈했거나 그래픽 툴에서 2.5배로 늘린 스프라이트는 엔진 설정으로 고칠 수 없습니다. 파일 자체를 검사하세요([Nerulio 블록](#nerulio) 참고).

## 도트가 떨리거나 일렁이는 이유 {#why-jitter}

'떨림'이라고 부르는 현상은 사실 세 가지입니다. 이 순서대로 해결하세요.

**1. 픽셀 크기가 들쭉날쭉합니다(일렁임).** 정수가 아닌 배율에서는 어떤 원본 픽셀은 화면 픽셀 3개, 어떤 픽셀은 2개가 됩니다. 카메라가 움직이면 굵은 줄과 가는 줄이 스프라이트 위를 지나가서 그림이 꿈틀대는 것처럼 보입니다. `Scale Mode = integer`로 없앨 수 있으며, 대신 검은 여백이 생깁니다.

![96×56px 화면을 왼쪽은 2.5배로 늘려 선과 외곽선이 2px 또는 3px로 들쭉날쭉하고, 오른쪽은 3배로 늘려 모든 픽셀의 크기가 같습니다](shot:engine-godot-pixel-fractional-vs-integer "Godot 4.7.2 렌더링: 96×56 SubViewport 하나를 Nearest로 2.5배(왼쪽)와 3배(오른쪽)로 표시하고, 캡처 후 최근접 보간으로 2배 확대했습니다. 그림: Kenney Tiny Dungeon, Pixel Platformer, CC0.")

**2. 플레이어가 배경에 대해 흔들립니다(서브픽셀 카메라).** 저해상도 뷰포트에서는 스프라이트와 카메라가 각자 따로 정수 픽셀로 반올림됩니다. 스무딩된 카메라가 플레이어를 소수점 거리만큼 늦게 따라가면, 두 반올림 결과가 프레임마다 어긋나서 플레이어가 1픽셀씩 앞뒤로 튑니다. **Snap 2D Transforms to Pixel**을 켠 96×56 뷰포트에서 플레이어를 일정한 속도로 걷게 하고 렌더링해 봤습니다. 기본 **Position Smoothing**을 쓰면 플레이어의 화면 위치가 180프레임 중 78프레임에서 바뀌었고, 매번 같은 두 열 사이를 오갔습니다. 카메라를 플레이어의 반올림 위치에 두면 한 번도 바뀌지 않았습니다.

```gdscript
# pixel_camera.gd - a Camera2D that follows a target on whole pixels (no smoothing).
# Put it below the target in the scene tree so it runs after the target has moved.
extends Camera2D

@export var target: Node2D

func _ready() -> void:
	position_smoothing_enabled = false
	process_callback = Camera2D.CAMERA2D_PROCESS_PHYSICS

func _physics_process(_delta: float) -> void:
	global_position = target.global_position.round()
```

저해상도 게임에서 부드럽게 뒤따라오는 카메라가 꼭 필요하다면 '서브픽셀 카메라' 기법을 써야 합니다. 게임을 화면보다 1픽셀 큰 SubViewport에 그리고, 카메라는 정수 픽셀에 두고, 확대한 이미지를 남은 소수 부분 × 배율만큼 밀어 주는 방식입니다. Godot에는 이 기능을 켜는 내장 스위치가 없습니다.

**3. 갱신 주기가 달라서 끊겨 보입니다.** 물리는 초당 60틱으로 돕니다. 144Hz 모니터에서는 어떤 틱은 2프레임, 어떤 틱은 3프레임 동안 보이므로, 픽셀이 완벽해도 움직임이 고르지 않습니다. 플레이어는 `_physics_process()`에서 움직이는데 스무딩된 Camera2D가 매 프레임 갱신되면(**Process Callback** 기본값은 **Idle**) 더 심해집니다. 144fps 테스트에서 플레이어의 화면 위치가 288프레임 동안 238번 방향을 바꿨고, 카메라의 **Process Callback**을 **Physics**로 바꾸자 0번이 됐습니다. **Physics Interpolation**(Godot 4.3+)은 한 걸음 더 나아가 두 틱 사이의 위치를 보간해 그립니다. 이 기능을 켜면 Camera2D도 스스로 물리 갱신으로 바뀌어 함께 보간됩니다(Godot가 "Camera2D overridden to physics process mode due to use of physics interpolation"을 출력합니다). 노드를 순간 이동시킨 뒤에는 `reset_physics_interpolation()`을 불러 미끄러지듯 이동하지 않게 하세요.

## canvas_items와 viewport 중 무엇을 쓸까 {#stretch-modes}

| | `viewport` | `canvas_items` |
|---|---|---|
| 렌더링 해상도 | 기준 해상도로 그린 뒤 확대 | 창 해상도 |
| 픽셀 | 항상 게임 픽셀 단위(진짜 저해상도) | 회전·확대한 스프라이트는 더 작은 픽셀('믹셀')이 생길 수 있음 |
| 텍스트, UI | 그림처럼 픽셀 크기 | 어떤 크기에서도 선명 |
| 문서 권장 대상 | 픽셀 아트 게임 | 대부분의 비픽셀 게임, 일부 픽셀 게임 |

두 모드 모두 `integer` 배율과 Nearest 필터와 함께 쓸 수 있습니다. 모든 것이 같은 픽셀 격자에 놓여야 한다면 `viewport`를, 고해상도 텍스트나 부드러운 회전·줌이 필요하다면 `canvas_items`를 쓰세요. Godot 4.7의 새 프로젝트는 `canvas_items`로 시작합니다.

## 픽셀 폰트 {#pixel-fonts}

Label도 CanvasItem이므로 Nearest 필터가 똑같이 적용됩니다. TTF/OTF 픽셀 폰트는 FileSystem 독에서 선택한 뒤 **Import** 독에서 다음을 확인합니다.

- 폰트를 설계 크기의 정수배로 그리지 않는다면 **Antialiasing**을 **Disabled**로 둡니다.
- Godot 4.4부터 **Hinting**과 **Subpixel Positioning**의 기본값이 "(Except Pixel Fonts)" 모드입니다. 글리프가 수평·수직 직선으로만 이루어진 폰트에서는 둘 다 자동으로 꺼집니다. 그 이전 버전에서는 **Subpixel Positioning**을 직접 **Disabled**로 바꾸세요.
- 폰트 크기는 원래 설계 크기의 배수로 씁니다(8px 폰트라면 8, 16, 24…).

**GUI → Theme**의 기본 폰트 설정은 Godot 내장 폰트에만 적용되고, 가져온 폰트에는 영향을 주지 않습니다. 스프라이트 시트로 만든 비트맵 폰트는 [게임 UI용 비트맵·SDF 폰트](guide:bitmap-font-sdf-msdf-game-ui)를 참고하세요.

## 버전별 차이 {#versions}

- **Godot 4.x:** 필터는 CanvasItem 속성(**Texture → Filter**)이고, 프로젝트 전체 기본값은 **Default Texture Filter**입니다. Godot 3에서는 가져오기 옵션이었습니다. **Snap 2D Transforms/Vertices to Pixel**은 4.0부터 있습니다.
- **4.2:** **Stretch → Scale Mode**(`fractional`/`integer`) 추가.
- **4.3:** 2D용 내장 **Physics Interpolation** 추가.
- **4.4:** 폰트 가져오기 기본값이 픽셀 폰트를 감지("Except Pixel Fonts" 모드).
- **4.7:** 새 프로젝트가 **Stretch Mode** `canvas_items`, **Aspect** `expand`로 시작. SpriteFrames에 핑퐁 반복 모드 추가.

:::nerulio tool=pixel-perfect-checker
스프라이트 파일 자체가 문제라면 Pixel Perfect Checker로 알 수 있습니다. 이미지의 픽셀 배율과 격자 오프셋을 재고, 가장자리의 중간색 픽셀을 세며, 정확한 블록 격자가 있을 때만 **1× 원본 복원**을 제공합니다. Kenney 캐릭터를 최근접 3배로 늘린 파일은 "정수 픽셀 격자를 확인했습니다 · 3×", 최근접 2.5배는 "정수 격자가 없습니다 — 비정수 배율"(추정 약 2.547배)로 나왔습니다. 쌍선형 3배 리사이즈는 격자가 없는 약 2.98배 리샘플로 판정됐고, 가장자리 픽셀의 61.5%가 중간색이었습니다.

- 스프라이트나 프레임을 페이지에 끌어다 놓고 **검사**를 엽니다. 모든 처리는 기기 안에서 이루어집니다.
- 깨끗한 1× 프레임을 내보내거나, **내보내기 배율 (최근접)**으로 정수배 확대본을 만듭니다.
- Godot용으로는 [패킹 & 내보내기](studio:pack)가 씬 노드에 Nearest를 지정한 SpriteFrames 번들을 만듭니다. `.png.import`는 Lossless, 밉맵 없음이고, 알파 경계 보정이 꺼져 있어 희미한 픽셀의 색이 그대로 유지됩니다. Godot 4.7.2에서 불러와 확인했습니다. 프로젝트 전체의 필터와 스트레치 설정은 직접 해야 합니다(1~5단계).
:::

## 자주 묻는 질문 {#faq}

### Godot 4에서 도트가 흐릿하게 보이는 이유는 무엇인가요? {#faq-blurry}

2D 노드는 기본적으로 Linear 필터를 써서 이웃 텍셀을 섞어 그립니다. **Rendering → Textures → Canvas Textures → Default Texture Filter**를 **Nearest**로 바꾸고, SubViewport와 자체 **Texture → Filter**를 가진 노드도 Nearest인지 확인하세요.

### Godot 4에서 텍스처 필터 설정은 어디에 있나요? {#faq-filter-setting}

Godot 3처럼 가져오기 옵션에 있지 않습니다. CanvasItem마다(**Texture → Filter**), Viewport마다(**Canvas Items → Default Texture Filter**), 그리고 프로젝트 전체는 **Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter**에서 설정합니다.

### Godot 4에서 정수 배율 확대는 어떻게 하나요? {#faq-integer-scaling}

**Display → Window → Stretch → Scale Mode**를 `integer`로 설정합니다(Godot 4.2 이상). **Stretch Mode**는 `viewport`나 `canvas_items`로 둡니다. 배율이 정수로 내림되고 남는 공간은 검은 여백이 됩니다.

### 카메라가 움직일 때 플레이어가 떨리는 이유는 무엇인가요? {#faq-camera-jitter}

카메라와 플레이어가 각각 따로 픽셀에 반올림되거나 서로 다른 주기로 갱신되기 때문입니다. Camera2D를 스무딩 없이 플레이어의 반올림 위치에 두거나 **Process Callback**을 **Physics**로 바꾸세요. 모니터 주사율과 물리 틱이 다르면 **Physics Interpolation**을 켜세요.

### Snap 2D Transforms와 Snap 2D Vertices to Pixel 중 무엇을 켜야 하나요? {#faq-snap}

**Snap 2D Transforms to Pixel**을 켜세요. 둘을 함께 켜면 움직임이 더 부자연스러워지므로 Godot 문서도 이것 하나만 켜기를 권합니다.

## 출처 {#sources}

- [ProjectSettings](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html) — Godot 4.7 클래스 레퍼런스(default_texture_filter, stretch mode/aspect/scale_mode, snap_2d_*, physics_interpolation)
- [Multiple resolutions](https://docs.godotengine.org/en/4.7/tutorials/rendering/multiple_resolutions.html) — Godot 4.7 매뉴얼(픽셀 아트: viewport, keep/expand, integer)
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html), [ResourceImporterTexture](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html) — Godot 4.7
- [CanvasItem](https://docs.godotengine.org/en/4.7/classes/class_canvasitem.html), [Viewport](https://docs.godotengine.org/en/4.7/classes/class_viewport.html) — Godot 4.7 클래스 레퍼런스(texture_filter, canvas_item_default_texture_filter)
- [Camera2D](https://docs.godotengine.org/en/4.7/classes/class_camera2d.html) — Godot 4.7 클래스 레퍼런스(process_callback, 위치 스무딩)
- [Using physics interpolation](https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/using_physics_interpolation.html) — Godot 4.7 매뉴얼
- [ResourceImporterDynamicFont](https://docs.godotengine.org/en/4.7/classes/class_resourceimporterdynamicfont.html) — Godot 4.7 클래스 레퍼런스(antialiasing, hinting, subpixel positioning)
- [editor_node.cpp (4.7.2-stable)](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/editor_node.cpp) — `get_initial_settings()`: 새 프로젝트의 스트레치 기본값
