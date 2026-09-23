Godot 4에서 스프라이트 시트를 애니메이션으로 만들려면 **AnimatedSprite2D**를 추가하고, **Sprite Frames** 속성에서 **New SpriteFrames**를 만든 뒤 SpriteFrames 패널의 **Add Frames from Sprite Sheet**를 누릅니다. **Select Frames** 대화상자에서 격자(**Horizontal**/**Vertical** 프레임 수, 또는 픽셀 단위 **Size**·**Separation**·**Offset**)를 맞추고 재생할 순서대로 프레임을 클릭한 다음 **Add N Frame(s)**를 누르면 됩니다. 이어서 FPS, 반복, 자동 재생을 정하고 코드에서는 `$AnimatedSprite2D.play("run")`으로 재생합니다.

아래 내용은 모두 Godot 4.7.2(gl_compatibility 렌더러)에서 직접 확인했습니다. 테스트 시트는 CC0 에셋으로, sebshady의 사무라이 시트(288×480px, 48px 프레임 6×10개)와 Kenney의 Pixel Platformer 캐릭터 시트(224×74px, 24px 프레임 사이에 1px 간격)입니다.

## 스프라이트 시트를 가져와 애니메이션 만들기 {#steps}

:::steps
1. **픽셀 아트부터 선명하게 설정합니다.** **Project → Project Settings**에서 **Rendering → Textures → Canvas Textures**로 가서 **Default Texture Filter**를 **Nearest**로 바꿉니다. 이 설정이 없으면 Godot가 Linear 필터로 그려서 도트가 뿌옇게 보입니다. PNG 기본 가져오기 설정(**Compress Mode** Lossless, 밉맵 없음)은 2D에 이미 알맞습니다.
2. **노드와 SpriteFrames를 만듭니다.** 씬에 **AnimatedSprite2D**를 추가합니다. 인스펙터에서 비어 있는 **Sprite Frames** 속성을 눌러 **New SpriteFrames**를 고르고, 만들어진 리소스를 한 번 더 누르면 에디터 아래쪽에 **SpriteFrames** 패널이 열립니다.
3. **시트를 엽니다.** **Animation Frames** 툴바에서 **Add Frames from Sprite Sheet**(Ctrl+Shift+O)를 누르고 PNG를 고릅니다. **Select Frames** 대화상자가 4×4 격자로 열립니다.
4. **격자를 맞춥니다.** 오른쪽 설정에서 **Horizontal**·**Vertical**에 프레임 수를 넣거나, **Size**에 프레임 한 칸의 픽셀 크기를 넣습니다. 프레임 사이에 빈 줄이 있으면 **Separation**을, 첫 프레임 앞에 여백이 있으면 **Offset**을 채웁니다. 선이 모두 프레임과 프레임 사이에 정확히 놓였는지 확인합니다.
5. **재생 순서대로 프레임을 고릅니다.** 하나씩 클릭하거나 드래그해서 고르고, Shift+클릭으로 범위를 한 번에 고를 수 있습니다. 프레임 위의 숫자가 추가될 순서입니다. **Frame Order**가 **As Selected**이면 클릭한 순서 그대로이고, **Left to Right, Top to Bottom**을 고르면 클릭 순서와 상관없이 왼쪽 위부터 들어갑니다. 마지막으로 **Add N Frame(s)**를 누릅니다.
6. **애니메이션 이름과 타이밍을 정합니다.** **Animations** 목록에서 `default`의 이름을 바꾸고(예: `run`), **FPS** 칸에 속도를 입력합니다. **Animation Looping** 버튼을 눌러 반복, 핑퐁(Godot 4.7 신규), 끄기 중 하나로 맞춥니다. `attack`처럼 한 번만 재생할 애니메이션은 끕니다. 특정 프레임만 길게 보여 주려면 그 프레임을 골라 **Frame Duration**을 올립니다(2.0이면 두 배). 애니메이션마다 3~6단계를 반복하고, 새 애니메이션은 **Add Animation**(Ctrl+N)으로 만듭니다.
7. **재생합니다.** 저절로 시작할 애니메이션에서 **Autoplay on Load**를 켜거나, 스크립트에서 `play()`를 부릅니다([코드로 재생하기](#code) 참고). F5/F6으로 실행해서 실제 게임 화면에서 확인합니다.
:::

![같은 시트에서 잘라 낸 Kenney 캐릭터 9개. 위 줄은 Separation 0이라 프레임마다 1px씩 밀리고, 아래 줄은 Separation 1이라 모두 가운데에 놓입니다](shot:engine-godot-spritesheet-separation "Godot 4.7.2(gl_compatibility)에서 AnimatedSprite2D를 4배, Nearest로 렌더링한 결과입니다. 위: Auto Slice가 만드는 격자와 같은 24×24, Separation 0. 아래: 이 시트에 맞는 Separation 1. 그림: Kenney, CC0.")

## Select Frames 대화상자 항목별 설명 {#select-frames-dialog}

이 대화상자는 고른 칸마다 **AtlasTexture**를 하나씩 만듭니다. 영역은 `Offset + (열, 행) × (Size + Separation)`이고, 크기는 **Size**입니다. 각 칸은 서로 영향을 줍니다.

| 항목 | 의미 | 바꾸면 달라지는 것 |
|---|---|---|
| **Horizontal**, **Vertical** | 한 행, 한 열의 프레임 수 | **Size**를 다시 계산: (시트 − Offset − 간격) ÷ 개수, 소수점 버림 |
| **Size** | 프레임 한 칸의 픽셀 크기 | 시트 크기로 프레임 수를 다시 계산 |
| **Separation** | 프레임 사이 간격(px) | 마지막으로 입력한 쪽(개수 또는 Size)을 기준으로 유지 |
| **Offset** | 첫 프레임 앞의 여백(px) | Separation과 같음 |
| **Auto Slice**(Godot 4.4+) | 빈 행·열을 보고 프레임 수를 추정 | **Separation**과 **Offset**을 0으로 설정 |

잘못 잘리는 경우는 대부분 다음 세 가지 때문입니다.

- **4×4 초기화.** 직전에 연 시트와 픽셀 크기가 다른 시트를 열면 대화상자가 4×4, 간격 0, 오프셋 0으로 돌아갑니다. 이전 값은 크기가 같은 시트를 열 때만 남습니다.
- **Auto Slice는 간격을 무시합니다.** 비어 있지 않은 열과 행의 묶음 수를 세고, 시트 크기를 그 수로 나눈 뒤 Separation을 0으로 둡니다. Kenney 시트에서는 24px 프레임 9×3개를 찾지만, 위 이미지의 윗줄처럼 프레임마다 1px씩 오른쪽으로 밀립니다. 그림이 옆 칸에 닿아 있거나 프레임 안에 빈 줄이 있으면 개수 자체도 틀립니다. 사무라이 시트에서는 48×48 프레임 6×10개가 아니라 48×80 프레임 6×6개로 추정합니다. 결과는 항상 격자선과 비교해 확인하세요.
- **테두리 여백이 있으면 개수 입력이 틀어집니다.** 시트 전체에 테두리가 있다면 **Offset**을 먼저 넣고 **Size**를 입력합니다. 개수로 계산할 때는 첫 프레임 앞의 오프셋만 빼고 마지막 프레임 뒤의 여백은 빼지 않기 때문입니다.

## 타이밍: FPS, 프레임 길이, speed_scale {#timing}

SpriteFrames 애니메이션에는 **FPS** 값 하나(새 애니메이션은 5 FPS, 반복 켜짐), 반복 모드(`LOOP_NONE`, `LOOP_LINEAR`, Godot 4.7부터는 `set_animation_loop_mode()`로 쓰는 `LOOP_PINGPONG`), 그리고 프레임마다 *상대값*인 **Frame Duration**(기본 1.0)이 있습니다. 한 프레임이 화면에 머무는 시간은 다음과 같습니다.

```text
seconds = frame_duration / (FPS × abs(speed_scale × custom_speed))
```

12 FPS에서 길이 2.0인 프레임은 2 ÷ 12 ≈ 0.167초 동안 보입니다. Aseprite나 에셋 설명에 적힌 프레임별 밀리초를 옮길 때는 `duration = ms × FPS ÷ 1000`으로 계산합니다. 예를 들어 12 FPS에서 250ms는 3.0입니다. 노드의 `speed_scale`은 모든 애니메이션의 속도를 바꾸고(2.0이면 두 배 빠름), `play("run", 1.5)`는 `custom_speed`로 그 재생에만 배율을 줍니다.

60fps 고정으로 실행한 테스트에서 10 FPS, 길이 3.0인 프레임은 18틱(0.3초) 동안 유지됐고, `speed_scale = 2.0`에서는 절반이 됐습니다.

## 코드로 재생하기 {#code}

`play()`는 이미 재생 중인 애니메이션을 처음부터 다시 틀지 않으므로 매 물리 프레임마다 불러도 됩니다. `animation_finished`는 반복이 꺼진 애니메이션에서만 발생합니다.

```gdscript
# player.gd - on a CharacterBody2D with an AnimatedSprite2D child
extends CharacterBody2D

const SPEED := 120.0
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D
var attacking := false

func _physics_process(_delta: float) -> void:
	var dir := Input.get_axis("ui_left", "ui_right")
	velocity.x = dir * SPEED
	move_and_slide()
	if attacking:
		return
	if dir != 0.0:
		sprite.flip_h = dir < 0.0
		sprite.play("run")   # already playing "run"? Then nothing restarts.
	else:
		sprite.play("idle")

func attack() -> void:
	attacking = true
	sprite.play("attack")   # "attack" has looping off
	await sprite.animation_finished
	attacking = false
```

그 밖에 자주 쓰는 멤버로는 `play_backwards()`, `pause()`(현재 프레임과 진행도 유지), `stop()`(0번 프레임으로), `frame`, `frame_progress`, 진행 단계를 잃지 않고 애니메이션을 바꿀 때 쓰는 `set_frame_and_progress()`, 그리고 `frame_changed`·`animation_looped` 시그널이 있습니다.

## 코드로 SpriteFrames 만들기 {#spriteframes-from-code}

시트가 크거나 자주 다시 내보낸다면, 대화상자와 같은 공식으로 리소스를 만드는 편이 빠릅니다. `ResourceSaver.save(frames, "res://hero_frames.tres")`로 한 번 저장해 두거나 실행 중에 만들 수 있습니다.

```gdscript
# sheet_frames.gd - build SpriteFrames from a grid sprite sheet in code.
# Same math as the editor's "Add Frames from Sprite Sheet" dialog:
# region = offset + cell_index * (frame_size + separation)
class_name SheetFrames
extends RefCounted

static func add_animation(frames: SpriteFrames, anim: StringName, sheet: Texture2D,
		frame_size: Vector2i, cells: Array[Vector2i], fps := 10.0, loop := true,
		separation := Vector2i.ZERO, offset := Vector2i.ZERO, durations: Array[float] = []) -> void:
	if frames.has_animation(anim):
		frames.remove_animation(anim)
	frames.add_animation(anim)
	frames.set_animation_speed(anim, fps)
	frames.set_animation_loop(anim, loop)
	for i in cells.size():
		var atlas := AtlasTexture.new()
		atlas.atlas = sheet
		atlas.region = Rect2(offset + cells[i] * (frame_size + separation), frame_size)
		# Relative duration: 1.0 = one tick of `fps`, 2.0 = shown twice as long.
		var duration := durations[i] if i < durations.size() else 1.0
		frames.add_frame(anim, atlas, duration)
```

예를 들어 `SheetFrames.add_animation(frames, &"run", load("res://samurai.png"), Vector2i(48, 48), [Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)], 12.0)`은 사무라이 시트 세 번째 행의 앞 프레임 3개를 추가합니다. 새 `SpriteFrames`에는 빈 `default` 애니메이션이 들어 있으니 쓰지 않는다면 지워 두세요.

## AnimatedSprite2D와 Sprite2D + AnimationPlayer, 무엇을 쓸까 {#which-node}

| | AnimatedSprite2D + SpriteFrames | Sprite2D + AnimationPlayer |
|---|---|---|
| 설정 | 위의 대화상자, 캐릭터마다 리소스 하나 | Sprite2D의 **Hframes**/**Vframes**를 정하고 타임라인에 **Frame** 키 입력 |
| 타이밍 | FPS와 프레임별 상대 길이 | 초 단위 키 시간 |
| 같은 애니메이션에서 다른 속성 제어 | 불가 | 가능: 히트박스, 사운드, 메서드 호출, 오프셋 |
| 크기가 다른 프레임, 여러 장의 시트 | 가능(프레임마다 별도 텍스처) | Sprite2D당 시트 하나, 균일한 격자 |

단순한 캐릭터 반복 동작에는 AnimatedSprite2D가 편합니다. 공격 세 번째 프레임에서 히트박스를 켜는 것처럼 정확한 프레임에 다른 것도 움직여야 한다면 AnimationPlayer를 씁니다([히트박스와 피벗](guide:hitboxes-pivots-2d-animation) 참고). AnimationPlayer 방식이라면 사무라이 시트에서 **Hframes** 6, **Vframes** 10으로 두고 0.0, 0.1, 0.2초…에 **Frame** 키를 넣습니다. **Frame Coords**(열, 행)로 격자 위치를 지정해도 결과는 같습니다. 인스펙터에서 **Frame**에 키를 넣으면 Godot는 **Discrete** 트랙을 만드는데, 그대로 두세요. **Continuous** 트랙에서는 정수가 보간되어, 테스트에서 0.1초가 아니라 0.06초에 다음 프레임으로 넘어갔습니다.

## 자주 하는 실수 {#common-mistakes}

- **프레임이 흐릿합니다.** 노드가 프로젝트 기본값인 Linear 필터를 물려받았기 때문입니다. 1단계처럼 프로젝트 기본값을 Nearest로 바꾸거나 노드의 **CanvasItem → Texture → Filter**를 **Nearest**로 설정합니다. 자세한 내용은 [Godot 4 픽셀 아트 흐림·떨림 해결](guide:godot-4-pixel-art-blurry-jitter)에 있습니다.
- **뒤로 갈수록 프레임이 점점 더 밀립니다.** 시트에 간격이 있는데 **Separation**이 0이거나(위 이미지), 여백이 있는데 **Offset**이 0인 경우입니다.
- **프레임이 하나 많거나 모자랍니다(off-by-one).** 끝에 남는 빈 칸이나 테두리 때문에 개수로 계산한 Size가 버림 처리된 경우입니다. 개수 대신 **Size**를 직접 입력하고, 그림이 있는 칸만 고르세요.
- **프레임 순서가 뒤섞였습니다.** 프레임은 클릭한 순서대로 들어갑니다. **Select None**으로 선택을 지우고 다시 클릭하거나 **Frame Order**를 고르세요.
- **캐릭터가 제자리에서 흔들립니다.** 칸마다 그림 위치가 달라 정렬이 필요하거나, 트리밍된 아틀라스가 오프셋을 잃은 경우입니다. AnimatedSprite2D의 **Offset**은 모든 프레임에 하나뿐입니다. [피벗과 히트박스](guide:hitboxes-pivots-2d-animation)를 참고하세요.
- **`animation_finished`가 오지 않습니다.** 애니메이션이 여전히 반복(또는 핑퐁) 중입니다. **Animation Looping**을 끄세요.
- **스크립트에서 autoplay를 넣었는데 재생되지 않습니다.** `autoplay`는 노드가 트리에 들어갈 때 읽힙니다. 그 뒤에 설정하면 경고만 출력되니 `play()`를 부르세요.
- **Autoplay가 먹지 않는 것 같습니다.** **Autoplay on Load**는 씬을 실행했을 때 시작되며 2D 에디터 화면에서는 재생되지 않습니다. 에디터에서는 패널의 재생 버튼으로 미리 봅니다.

:::nerulio ws=sprite
Studio의 스프라이트 작업 공간은 자르기와 타이밍을 브라우저 안에서 처리하고, Godot가 그대로 불러오는 SpriteFrames 리소스로 내보냅니다. 간격과 여백까지 포함해 격자를 찾아 확신도와 함께 보여 줍니다(Kenney 시트: **격자 24×24 s1**, 높음). 이미지에는 타이밍 정보가 없으므로 직접 정할 때까지 타이밍은 '낮음'으로 표시됩니다.

- 시트를 끌어다 놓고 **자르기**와 **애니메이션** 판단(기본은 행마다 애니메이션 하나)을 확인한 뒤 **적용**을 누릅니다.
- 타임라인에서 태그 이름을 바꾸고, 프레임별 또는 선택 범위 전체의 길이를 밀리초로 입력합니다.
- **패킹 & 내보내기**에서 **Godot 4**를 고르고 **Godot 4용으로 내보내기**를 누릅니다. 밀리초를 FPS와 상대 길이로 바꾼 `.tres` SpriteFrames, Nearest가 설정된 AnimatedSprite2D `.tscn`, `.png.import`(Lossless, 밉맵 없음)가 함께 나오며, Godot 4.7.2에서 불러와 그려지는 것을 확인했습니다.
- 한계: AnimatedSprite2D는 노드마다 오프셋이 하나라서 씬은 첫 프레임의 피벗을 씁니다(피벗은 모두 리소스 메타데이터에 남습니다). Godot 프리셋은 프레임을 회전시키지 않고, Godot 3에서는 읽을 수 없습니다.
:::

![사무라이 시트를 끌어다 놓은 직후의 스프라이트 작업 공간. 48×48 격자에 번호가 붙은 프레임 60개와 확신도 87%의 자르기 판단, 대안 목록이 보입니다](shot:studio-sprite-import "Nerulio Studio: 자르기 전에 가져오기 패널이 자동 판단마다 확신도와 한 번에 바꿀 수 있는 대안을 보여 줍니다.")

## 자주 묻는 질문 {#faq}

### Godot 스프라이트 시트 대화상자는 왜 항상 4×4로 시작하나요?

**Select Frames** 대화상자는 새 시트의 픽셀 크기가 직전 시트와 다르면 4×4, Separation 0, Offset 0으로 초기화됩니다. 이미지별로 격자 설정을 저장하지 않으므로 시트마다 **Size**와 **Separation**을 입력하거나, **Auto Slice**(Godot 4.4+)를 써 보고 결과를 확인하세요.

### Godot 4에서 한 프레임만 길이를 다르게 하려면 어떻게 하나요?

SpriteFrames 패널에서 그 프레임을 고르고 **Frame Duration**을 바꿉니다. 값은 상대값이라서 2.0이면 같은 FPS에서 1.0짜리 프레임보다 두 배 오래 보입니다. 밀리초에서 바꿀 때는 `duration = ms × FPS ÷ 1000`을 씁니다.

### 스프라이트 애니메이션에 AnimatedSprite2D와 AnimationPlayer 중 무엇을 써야 하나요?

대기, 달리기, 점프 같은 단순 반복에는 AnimatedSprite2D가 빠릅니다. 같은 타임라인에서 히트박스, 사운드, 오프셋, 메서드 호출까지 정확한 프레임에 맞춰야 한다면 Sprite2D와 AnimationPlayer를 쓰세요.

### 자른 프레임이 왜 흐릿하게 보이나요?

필터는 시트가 아니라 노드에 설정됩니다. 프로젝트 기본값이 Linear이므로 **Rendering → Textures → Canvas Textures → Default Texture Filter**를 **Nearest**로 바꾸거나, 노드의 **Texture → Filter**를 Nearest로 설정하세요.

### Godot 4에서 Aseprite 파일을 바로 애니메이션으로 쓸 수 있나요?

아니요. Godot에는 `.aseprite` 가져오기 기능이 내장되어 있지 않습니다. Aseprite 명령줄을 호출하는 플러그인을 쓰거나, Aseprite에서 PNG 시트와 JSON을 내보내거나, 브라우저에서 변환하세요. [Godot·Unity·Phaser에서 Aseprite 파일 쓰기](guide:aseprite-files-godot-unity-phaser)를 참고하세요.

## 출처 {#sources}

- [2D sprite animation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_sprite_animation.html) — Godot 4.7 매뉴얼
- [AnimatedSprite2D](https://docs.godotengine.org/en/4.7/classes/class_animatedsprite2d.html) — Godot 4.7 클래스 레퍼런스
- [SpriteFrames](https://docs.godotengine.org/en/4.7/classes/class_spriteframes.html) — Godot 4.7 클래스 레퍼런스(상대 프레임 길이, LoopMode)
- [Sprite2D](https://docs.godotengine.org/en/4.7/classes/class_sprite2d.html) — Godot 4.7 클래스 레퍼런스(hframes, vframes, frame_coords)
- [Animation](https://docs.godotengine.org/en/4.7/classes/class_animation.html) — Godot 4.7 클래스 레퍼런스(값 트랙 업데이트 모드)
- [ProjectSettings: default_texture_filter](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html#class-projectsettings-property-rendering-textures-canvas-textures-default-texture-filter) — Godot 4.7
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html) — Godot 4.7 매뉴얼
- [sprite_frames_editor_plugin.cpp (4.7.2-stable)](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/scene/sprite_frames_editor_plugin.cpp) — Select Frames 대화상자 소스(4×4 초기화, Auto Slice, Frame Order)
