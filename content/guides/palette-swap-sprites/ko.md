스프라이트 팔레트 스왑(적 등급, 팀 색상, 스킨)은 두 가지 방법으로 만듭니다. 변형마다 색을 바꾼 이미지를 미리 **구워 두거나**, 스프라이트를 **인덱스 맵**으로 그려 두고 작은 셰이더가 픽셀마다 **팔레트 텍스처**(변형 하나당 한 줄)에서 색을 찾아오게 하는 방법입니다. 굽는 방식은 셰이더 없이 어느 엔진에서나 됩니다. 셰이더 방식은 변형이 몇 개든 텍스처 하나로 끝나고 실행 중에 팔레트를 바꿀 수 있지만, 두 텍스처 모두 최근접(Nearest) 필터로 샘플링하고 손실 압축이나 색 공간 변환 없이 임포트해야 색이 정확하게 나옵니다.

이 가이드는 Godot 4와 Unity 6(URP 2D)에서 셰이더 방식을 만들고, Phaser와 PixiJS에서는 변형을 굽는 방법을 보여 줍니다. 인덱스 맵을 망가뜨리는 필터링 실수도 실제 렌더로 확인합니다.

![Godot 셰이더 하나로 그린 Kenney 외계인의 팔레트 변형 다섯 가지](shot:engine-palette-swap-godot "Godot 4.7.2(Compatibility 렌더러)로 렌더링: 48×24 인덱스 맵 하나와 7×5 팔레트 텍스처 하나, ShaderMaterial 하나를 공유하는 Sprite2D 다섯 개가 각자 다른 팔레트 줄을 씁니다. 모든 픽셀이 기대한 팔레트 색과 정확히 일치했습니다. 아트: Kenney Pixel Platformer(CC0).")

## 방법 고르기 {#approaches}

| 방법 | 원리 | 적합한 경우 | 주의할 점 |
|---|---|---|---|
| 미리 구운 변형 | 변형마다 PNG 색을 한 번 바꿔 둠(빌드 전 또는 로드 시) | 변형이 적을 때, 모든 엔진, 셰이더를 못 쓸 때 | 변형마다 텍스처 한 장: 메모리 증가, 배칭 끊김 |
| 인덱스 맵 + 팔레트 텍스처 | R 채널에 팔레트 인덱스를 저장하고, 셰이더가 팔레트 이미지의 n번째 줄에서 색을 읽음 | 변형이 많을 때, 실행 중 교체, 플레이어가 고르는 색 | 최근접 필터, 무손실·비 sRGB 임포트 필수 |
| 색 비교 셰이더 | 셰이더가 픽셀을 원본 색 목록과 비교해 일치하면 교체 | 원본 아트를 그대로 둔 빠른 교체 | 픽셀마다 반복문, 필터링·압축으로 색이 조금만 바뀌어도 실패 |
| 그라디언트 맵 | 픽셀 밝기로 그라디언트에서 색을 고름 | 단색 아트, 상태 이상 효과 | 밝기가 같은 다른 부위가 같은 색이 됨 |

셰이더 방식 중에서는 인덱스 맵이 가장 튼튼하므로 여기서부터 시작합니다.

## Godot 4에서 셰이더로 팔레트 스왑 {#godot-shader}

예제는 Kenney의 초록 외계인입니다. 24×24 프레임 두 장에 색은 일곱 가지(외곽선, 4단계 몸통 램프, 헬멧, 흰색)입니다.

:::steps
1. **팔레트 순서 정하기.** 스프라이트의 색을 고정된 순서로 나열하고, 램프는 어두운 색에서 밝은 색 순으로 둡니다: 외곽선, 몸통(4단계), 헬멧, 흰색. 이 위치가 열 인덱스가 됩니다.
2. **팔레트 텍스처 그리기.** 팔레트 색 수만큼 가로로 길고, 변형 하나당 한 줄인 PNG를 만듭니다. 0번 줄은 원래 색이고, 나머지 줄은 같은 열을 다른 색으로 칠합니다(파랑, 분홍, 빨강 정예, 금색 보스).
3. **인덱스 맵 만들기.** 불투명한 픽셀을 모두 `Color8(열, 0, 0, 알파)`로 바꾸고 투명한 픽셀은 그대로 둡니다. 아래 `make_index_map.gd`가 이 작업을 합니다. 결과가 거의 검게 보이는 것이 정상입니다.
4. **임포트 확인.** **Import** 독에서 두 PNG 모두 **Compress > Mode: Lossless**(2D 기본값)로 두고 **Mipmaps > Generate**는 끕니다. VRAM 압축은 인덱스 값을 바꿔 버립니다.
5. **셰이더 만들기.** 아래 `palette_swap.gdshader`를 저장하고, 이 셰이더로 **ShaderMaterial**을 만든 뒤 **Palette** 파라미터에 `palettes.png`를 넣습니다.
6. **Nearest 필터 설정.** 각 Sprite2D나 AnimatedSprite2D에서 **CanvasItem > Texture > Filter**를 **Nearest**로 바꾸거나, **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter**를 **Nearest**로 설정합니다.
7. **노드마다 줄 고르기.** 모든 적에게 같은 머티리얼을 주고 `set_instance_shader_parameter("palette_row", n)`으로 변형을 고릅니다. 언제든 바꿀 수 있습니다.
:::

```glsl
// palette_swap.gdshader — Godot 4 (canvas_item)
// The sprite texture is an INDEX MAP: its red channel holds a palette index 0–255.
// `palette` holds one palette per row: column = colour index, row = variant.
shader_type canvas_item;

uniform sampler2D palette : source_color, filter_nearest;
// Per node: set_instance_shader_parameter("palette_row", 2). One shared material for every enemy.
instance uniform int palette_row = 0;

varying vec4 tint; // vertex colour, so modulate / self_modulate still work

void vertex() {
	tint = COLOR;
}

void fragment() {
	vec4 src = texture(TEXTURE, UV);              // set the node's texture_filter to Nearest
	int index = int(round(src.r * 255.0));
	vec4 swapped = texelFetch(palette, ivec2(index, palette_row), 0);
	COLOR = vec4(swapped.rgb, src.a) * tint;
}
```

`texelFetch`는 텍셀 하나를 필터링 없이 그대로 읽으므로 이웃한 팔레트 색이 섞이지 않습니다. `tint` varying 덕분에 피격 번쩍임이나 페이드에 쓰는 `modulate`도 그대로 동작합니다.

변환 스크립트는 `godot --headless --path . --script res://make_index_map.gd`로 한 번 실행합니다.

```gdscript
# make_index_map.gd — reads the sprite and the palette strip (row 0 = the sprite's own colours,
# in ramp order) and writes an index map whose red channel is the column of each pixel's colour.
extends SceneTree

func _init() -> void:
	var sprite := Image.load_from_file("res://alien_green.png")
	var palette := Image.load_from_file("res://palettes.png")
	sprite.convert(Image.FORMAT_RGBA8)
	var lookup := {}
	for x in palette.get_width():
		lookup[palette.get_pixel(x, 0).to_rgba32() | 0xff] = x   # key: RGB with alpha forced to 255
	var out := Image.create(sprite.get_width(), sprite.get_height(), false, Image.FORMAT_RGBA8)
	var missing := 0
	for y in sprite.get_height():
		for x in sprite.get_width():
			var c := sprite.get_pixel(x, y)
			if c.a8 == 0:
				continue                                  # stays transparent
			var key := c.to_rgba32() | 0xff
			if not lookup.has(key):
				missing += 1
				continue
			out.set_pixel(x, y, Color8(lookup[key], 0, 0, c.a8))
	out.save_png("res://alien_index_gd.png")
	print("index map written, colours not in the palette: ", missing)
	quit()
```

팔레트에 없는 색이 나오면 대개 안티앨리어싱된 가장자리입니다. 먼저 정리하세요([팔레트 밖 픽셀 정리하기](guide:fix-ai-generated-pixel-art) 참고). 적마다 붙이는 스크립트는 다음과 같습니다.

```gdscript
# enemy.gd — on a Sprite2D whose texture is the index map and whose material uses palette_swap.gdshader
extends Sprite2D

@export var tier := 0   # row in palettes.png

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	set_instance_shader_parameter("palette_row", tier)
```

### instance uniform을 쓰는 이유 {#instance-uniform}

일반 `uniform`을 쓰면 변형마다 머티리얼이 하나씩 필요하고, 머티리얼이 바뀔 때마다 2D 배칭이 끊깁니다. Godot 4.7.2에서 측정해 보니, `instance uniform`으로 줄만 다르게 하고 머티리얼 하나를 공유한 스프라이트 200개는 드로 콜 **1**번에 그려졌습니다. 같은 200개에 머티리얼을 각각 복제해 주면 **200**번이 들었고, Compatibility와 Forward+ 렌더러 모두 같았습니다. 인스턴스 유니폼은 스칼라와 벡터만 되며 셰이더당 최대 16개입니다.

### 인덱스 맵 없이: 색 비교 {#color-match}

아트를 변환할 수 없다면 셰이더에서 색을 비교합니다. 원본 PNG에 그대로 쓸 수 있고 테스트에서도 픽셀 단위로 정확했지만, 압축·필터링·리샘플링이 조금이라도 들어가면 일치하지 않게 됩니다.

```glsl
// color_match.gdshader — Godot 4 (canvas_item)
// Every pixel whose colour matches from_colors[i] becomes to_colors[i].
shader_type canvas_item;

const int MAX_COLORS = 8;
uniform vec4 from_colors[MAX_COLORS] : source_color;
uniform vec4 to_colors[MAX_COLORS] : source_color;
uniform int color_count = 0;
uniform float tolerance = 0.004; // about 1/255: exact matches only

varying vec4 tint;

void vertex() {
	tint = COLOR;
}

void fragment() {
	vec4 src = texture(TEXTURE, UV);
	vec3 rgb = src.rgb;
	for (int i = 0; i < color_count; i++) {
		if (distance(src.rgb, from_colors[i].rgb) < tolerance) {
			rgb = to_colors[i].rgb;
			break;
		}
	}
	COLOR = vec4(rgb, src.a) * tint;
}
```

배열은 `material.set_shader_parameter("from_colors", [...])`로 넣고, 길이를 `MAX_COLORS`에 맞춰 채웁니다.

### 그라디언트 맵 {#gradient-map}

그라디언트 맵은 `GradientTexture1D`에서 `texture(gradient, vec2(밝기, 0.5))`로 색을 읽습니다(도트처럼 딱 끊기게 하려면 Gradient의 **Interpolation Mode**를 **Constant**로). 준비가 필요 없지만 밝기밖에 모릅니다. 외계인의 경우 밝은 헬멧과 몸통 하이라이트가 같은 색 구간에 들어갔습니다. 여러 부위로 된 캐릭터보다는 단색 아트나 상태 이상 효과에 쓰세요.

## 램프를 일관되게 유지하기 {#ramps}

- **램프 단계 수를 맞춥니다.** 몸통이 4단계면 바꿀 램프도 어두운 색부터 4단계여야 합니다. 3단계 램프를 4칸에 억지로 넣으면 명암이 납작해집니다.
- **밝기 단계를 유지합니다.** 색상(hue)은 바꾸되 각 단계의 밝기는 원래와 비슷하게 둡니다. 중간 톤이 하이라이트보다 밝으면 명암이 뒤집혀 보입니다.
- **부위마다 칸을 나눕니다.** 외곽선과 헬멧이 따로 칸을 가지고 있어서 변형마다 그대로 두거나 바꿀 수 있습니다(금색 보스는 둘 다 바꿈). 원본에서 한 색을 공유하는 부위는 따로 바꿀 수 없습니다.
- **모든 프레임에 팔레트 하나.** 팔레트는 모든 프레임에서 한꺼번에 뽑아야 합니다. 그렇지 않으면 7번 프레임에만 있는 색이 인덱스에서 빠집니다.
- **램프에 색상 이동을 넣습니다.** 좋은 램프는 그림자는 차갑게, 하이라이트는 따뜻하게 흐릅니다. Lospec 팔레트 목록에 검증된 램프가 많습니다.

## 필터링과 임포트 문제 {#filtering}

인덱스 맵은 색이 아니라 데이터입니다. 이웃 텍셀을 섞는 처리가 들어가면 인덱스가 틀어지고, 틀린 인덱스는 전혀 상관없는 팔레트 칸의 색을 가져옵니다.

![Godot에서 같은 인덱스 맵을 Nearest와 Linear로 필터링한 비교](shot:engine-palette-filter-godot "Godot 4.7.2로 렌더링: 같은 인덱스 맵과 팔레트 줄. 왼쪽은 Nearest 필터(정확), 오른쪽은 인덱스 맵에만 Linear 필터를 준 결과입니다. 섞인 인덱스가 다른 팔레트 열을 가리켜 외곽선이 몸통·헬멧 색의 테두리로 바뀝니다. 아트: Kenney(CC0).")

- **인덱스 맵은 Nearest.** 위 렌더에서 인덱스 맵만 Linear로 바꾸자 화면 픽셀 20,736개 중 5,350개가 달라졌습니다. [Godot 도트 흐림 해결](guide:godot-4-pixel-art-blurry-jitter)도 참고하세요.
- **팔레트는 정확히 읽기.** `texelFetch` / `LOAD_TEXTURE2D`를 쓰거나, Point 샘플링으로 텍셀 중심을 읽습니다.
- **인덱스 맵에는 밉맵, 손실 압축, GPU 압축 금지.**
- **인덱스 맵에는 색 공간 변환 금지.** Godot은 테스트한 두 렌더러 모두 그대로 두었지만, Unity의 Linear 색 공간은 sRGB로 임포트한 인덱스 맵을 디코딩해 버립니다(아래 참고).
- **인덱스 PNG(Indexed PNG)는 소용없습니다.** 엔진이 임포트할 때 일반 색으로 풀어 버리므로, 인덱스는 채널에 직접 써 넣어야 합니다.
- **파일이 아니라 노드를 확대합니다.** 이미지 편집기에서 인덱스 맵을 리샘플링하면 인덱스가 섞입니다.

## Unity 6(URP 2D Renderer) {#unity}

이 언릿 스프라이트 셰이더는 Unity 6000.5.3f1 + URP 17.5.0에서 오류 없이 컴파일되었고, 2D Renderer 카메라가 Gamma와 Linear 색 공간 모두에서 다섯 변형을 픽셀 단위로 정확히 그렸습니다. SpriteRenderer의 **Color**와 **Flip X**도 그대로 동작합니다.

```text
// PaletteSwap2D.shader — Unity 6, URP 2D Renderer (unlit sprite)
// _MainTex is an INDEX MAP (red channel = palette index 0–255), imported with sRGB OFF.
// _Palette has one palette per row (column = index), row 0 = the TOP row of the PNG.
Shader "Custom/PaletteSwap2D"
{
    Properties
    {
        [MainTexture] _MainTex ("Index Map", 2D) = "white" {}
        [NoScaleOffset] _Palette ("Palette", 2D) = "white" {}
        _PaletteRow ("Palette Row", Float) = 0
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "RenderPipeline" = "UniversalPipeline" }
        Blend SrcAlpha OneMinusSrcAlpha, One OneMinusSrcAlpha
        Cull Off
        ZWrite Off

        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            TEXTURE2D(_MainTex);  SAMPLER(sampler_MainTex);
            TEXTURE2D(_Palette);
            float4 _Palette_TexelSize;          // (1/width, 1/height, width, height)

            CBUFFER_START(UnityPerMaterial)
                float _PaletteRow;
            CBUFFER_END

            struct Attributes { float3 positionOS : POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };
            struct Varyings  { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };

            Varyings vert (Attributes v)
            {
                Varyings o;
                // unity_SpriteProps.xy = flipX/flipY, unity_SpriteColor = SpriteRenderer.color
                o.positionCS = TransformObjectToHClip(float3(v.positionOS.xy * unity_SpriteProps.xy, v.positionOS.z));
                o.uv = v.uv;
                o.color = v.color * unity_SpriteColor;
                return o;
            }

            half4 frag (Varyings i) : SV_Target
            {
                half4 src = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, i.uv);   // Filter Mode: Point
                int index = (int)round(src.r * 255.0);
                int row = (int)_Palette_TexelSize.w - 1 - (int)_PaletteRow;     // Unity rows start at the bottom
                half4 swapped = LOAD_TEXTURE2D(_Palette, int2(index, row));
                return half4(swapped.rgb, src.a) * i.color;
            }
            ENDHLSL
        }
    }
}
```

셰이더보다 임포트 설정이 더 중요합니다.

- **인덱스 맵:** Texture Type **Sprite (2D and UI)**, **sRGB (Color Texture)** 끔, **Filter Mode** Point (no filter), **Compression** None, **Generate Mipmaps** 끔. Linear 프로젝트에서 sRGB를 켠 채로 두었더니 스프라이트 전체가 외곽선 색으로 나왔습니다. 작은 인덱스 값이 0 쪽으로 디코딩되었기 때문입니다.
- **팔레트 텍스처:** Texture Type **Default**, sRGB 켬, Filter Mode Point, Compression None, **Non-Power of 2**는 **None**. Default 타입 기본값(To nearest, Bilinear, Compressed) 그대로 두면 7×5 팔레트가 8×4로 리사이즈되어 임포트되고, 모든 열이 어긋납니다.
- **변형마다 머티리얼 하나:** 등급마다 머티리얼 에셋을 만들고 **Palette Row**를 지정합니다. `MaterialPropertyBlock`도 동작하지만, Unity 매뉴얼은 SRP Batcher 조건으로 "MaterialPropertyBlock을 쓰지 않을 것"을 들고 있습니다.

Shader Graph로 만들 때는 **Assets > Create > Shader Graph > URP > Sprite Unlit Shader Graph**를 만듭니다. `_MainTex`를 샘플링해 R에 255를 곱하고 **Round**, 0.5를 더한 뒤 **Texture Size** 노드의 팔레트 너비로 나누면 U가 됩니다. V는 `1 − (row + 0.5) / height`입니다. 팔레트는 **Sampler State**를 **Point**로 둔 **Sample Texture 2D LOD**(LOD 0)로 읽어 **Base Color**에, 메인 텍스처의 A는 **Alpha**에 연결합니다.

## Phaser와 PixiJS: 로드할 때 변형 굽기 {#web}

웹에서는 굽는 방식이 가장 간단하고 튼튼합니다. 이미지를 캔버스에 그리고, 픽셀 데이터에서 색을 바꾼 다음, 결과를 새 텍스처로 등록합니다. 아래 코드는 Phaser 3.90과 4.2에서 수정 없이 동작했고, 구운 시트로 애니메이션도 재생되었습니다.

```js
// palette-bake.js — works in Phaser 3.90 and 4.x
// from / to: arrays of 0xRRGGBB, same length (from[i] becomes to[i]).
function bakePalette(scene, srcKey, newKey, from, to) {
  const srcTex = scene.textures.get(srcKey);
  const img = srcTex.getSourceImage();
  const tex = scene.textures.createCanvas(newKey, img.width, img.height);
  const ctx = tex.getContext();
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height);
  const map = new Map(from.map((c, i) => [c, to[i]]));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;                       // skip transparent pixels
    const out = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (out === undefined) continue;                    // colour not in the swap list
    d[i] = out >> 16; d[i + 1] = (out >> 8) & 255; d[i + 2] = out & 255;
  }
  ctx.putImageData(data, 0, 0);
  // copy the frame rectangles, so animations can use the same frame names
  for (const name of srcTex.getFrameNames()) {
    const f = srcTex.get(name);
    tex.add(name, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
  }
  tex.refresh();
  return tex;
}
// in create(): bakePalette(this, 'alien', 'alien-red', GREEN, RED);
//              this.add.sprite(100, 100, 'alien-red', 1);
```

PixiJS 8.21 버전은 반복문이 같고 마지막 단계만 다릅니다.

```js
// PixiJS 8 — returns a new Texture with the colours swapped
function bakePaletteTexture(texture, from, to) {
  const img = texture.source.resource;                  // the loaded image
  const canvas = document.createElement('canvas');
  canvas.width = img.width; canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const map = new Map(from.map((c, i) => [c, to[i]]));
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const out = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (out === undefined) continue;
    d[i] = out >> 16; d[i + 1] = (out >> 8) & 255; d[i + 2] = out & 255;
  }
  ctx.putImageData(data, 0, 0);
  const baked = Texture.from(canvas);
  baked.source.scaleMode = 'nearest';                   // pixel art: no filtering
  return baked;
}
```

프레임은 `new Texture({ source: baked.source, frame: new Rectangle(x, y, w, h) })`로 잘라 냅니다. 두 엔진 모두 캔버스가 색을 프리멀티플라이드로 저장하므로 반투명 픽셀은 한 단계쯤 어긋날 수 있습니다(완전 불투명·완전 투명 픽셀은 정확합니다). 또 변형마다 텍스처가 따로 생겨 배치가 늘어나므로, 변형이 많으면 한 아틀라스로 구우세요. 선명하게 확대하는 법은 [Phaser·PixiJS 도트 선명하게](guide:pixel-art-crisp-in-browser-phaser-pixi)를 참고하세요.

## 미리 굽기 vs 실행 중 셰이더 {#trade-offs}

- **메모리:** 굽는 방식은 변형마다 시트 전체를 저장하고, 셰이더 방식은 인덱스 맵 하나와 몇 픽셀짜리 팔레트만 저장합니다.
- **드로 콜:** 인스턴스별 줄을 쓰는 공유 머티리얼은 배칭되고, 구운 변형은 같은 아틀라스 페이지에 있을 때만 배칭됩니다.
- **실행 중 변경:** 플레이어가 고른 색이나 상태 이상 색조가 셰이더에서는 파라미터 하나, 굽는 방식에서는 다시 굽기입니다.
- **호환성:** 구운 PNG는 어디서나 쓰이지만, 인덱스 맵은 게임 밖에서 검게 보이고 그리는 곳마다 셰이더가 필요합니다.
- **기준:** 고정 변형이 몇 개뿐이면 굽고, 변형이 많거나 실행 중에 고르면 인덱스 맵과 팔레트를 씁니다.

:::nerulio tool=pixel-lab
Nerulio Pixel Lab은 팔레트 스왑의 아트 쪽 작업을 업로드 없이 브라우저에서 처리합니다. 모든 프레임에 팔레트 하나, 램프를 지키는 재채색, 구운 변형까지 됩니다. 아직 인덱스 맵이나 팔레트 텍스처는 만들지 않으므로, 셰이더 방식에서는 Pixel Lab에서 내보낸 팔레트로 열 순서를 정한 뒤 위의 변환 스크립트를 실행하세요.
- **Palette**: 모든 프레임에서 한 번에 팔레트를 추출하고, 정렬·고정한 뒤 `.gpl`, `.hex`, JSON으로 내보냅니다.
- **Recolour > Ramp swap**: 원본 램프를 고르면 밝기 순서대로 대상 램프에 대응시키므로 가장 어두운 색은 계속 가장 어둡습니다. **Hue range**와 **Status tint**(얼음, 독, 화상 등)는 팔레트 전체에 적용됩니다.
- **Export team variants (ZIP)**: `red,blue,gold`나 `#RRGGBB` 같은 기준색을 입력하면 변형마다 폴더 하나에 모든 프레임과 그 변형의 `.gpl`이 들어 있습니다.
- 한 번만 간단히 바꿀 때는 [팔레트 스왑 도구](tool:palette-swap)가 고른 색을 허용 오차와 명암 유지 옵션으로 바꿔 줍니다. 이미지 한 장이든 여러 장이든 됩니다.
:::

![Nerulio Pixel Lab 재채색 단계](shot:lab-pixel-palette "Nerulio Pixel Lab의 Recolour 단계: 모든 프레임에 팔레트 하나, Ramp swap, Hue range, Status tint와 팀 변형 내보내기.")

## 자주 묻는 질문 {#faq}

### Godot 4에서 스프라이트 팔레트 스왑은 어떻게 하나요? {#faq-godot}
스프라이트를 인덱스 맵(R 채널에 팔레트 인덱스)으로 바꾸고, 변형 하나당 한 줄인 작은 팔레트 텍스처를 만든 뒤, `texelFetch(palette, ivec2(index, row), 0)`로 색을 읽는 `canvas_item` 셰이더를 씁니다. 노드의 텍스처 필터는 Nearest로 두고, 줄은 `instance uniform`으로 노드마다 고릅니다.

### 팔레트 스왑 셰이더에서 가장자리 색이 이상하게 나와요. {#faq-edges}
인덱스 맵이 필터링되고 있는 것입니다. Linear 필터, 밉맵, 손실 압축이 이웃 인덱스를 섞어 다른 팔레트 열을 가리키게 만듭니다. Nearest(Point) 필터, 밉맵 끄기, 무손실 임포트를 쓰고 팔레트는 정확한 텍셀 읽기로 가져오세요.

### 변형을 미리 구울까요, 셰이더를 쓸까요? {#faq-bake}
고정 변형이 몇 개뿐이거나 커스텀 셰이더를 쓰기 번거로운 엔진이면 굽는 편이 낫습니다. 변형이 많거나, 실행 중에 색을 고르거나, 피격 번쩍임 같은 효과가 필요하면 셰이더를 쓰세요. 텍스처 하나로 끝나고 팔레트가 다른 스프라이트끼리 머티리얼 하나를 공유할 수 있습니다.

### Godot에서는 괜찮은데 Unity에서만 팔레트 색이 틀려요. {#faq-unity}
Unity의 Linear 색 공간에서는 **sRGB (Color Texture)**를 켠 인덱스 맵이 셰이더에 전달되기 전에 변환되어 인덱스 값이 바뀝니다. 인덱스 맵은 sRGB를 끄고, 팔레트는 켜 두고, 팔레트의 **Non-Power of 2**를 **None**으로 두어 리사이즈되지 않게 하세요.

### Aseprite의 인덱스 PNG를 그대로 인덱스 맵으로 쓸 수 있나요? {#faq-indexed-png}
그대로는 안 됩니다. 엔진이 임포트할 때 인덱스 PNG를 일반 색으로 풀어 버려 셰이더에는 인덱스가 전달되지 않습니다. 작업은 Indexed 모드로 해도 좋지만, `make_index_map.gd` 같은 변환 스크립트로 인덱스를 R 채널에 써 넣어야 합니다.

## 참고 자료 {#sources}

- [Shading language — Godot Engine 4.7 문서](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html) (유니폼 힌트 `source_color`·`filter_nearest`, 인스턴스별 유니폼, 유니폼 배열)
- [Built-in functions — Godot Engine 4.7 문서](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_functions.html) (`texelFetch`)
- [CanvasItem shaders — Godot Engine 4.7 문서](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html) (`TEXTURE`, `UV`, `COLOR`)
- [Importing images — Godot Engine 4.7 문서](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html) (Lossless 모드, VRAM 압축과 픽셀 아트)
- [Default texture import settings — Unity 6.5 매뉴얼](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-default.html) (sRGB (Color Texture), Non Power of 2, Filter Mode)
- [SRP Batcher materials — Unity 6.5 매뉴얼](https://docs.unity3d.com/6000.5/Documentation/Manual/SRPBatcher-Materials.html) (MaterialPropertyBlock 조건)
- [Sampler State node — Shader Graph 17.5](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sampler-State-Node.html), [Sample Texture 2D LOD node](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sample-Texture-2D-LOD-Node.html)
- [CanvasTexture — Phaser 4 API 문서](https://docs.phaser.io/api-documentation/class/textures-canvastexture) (`getContext`, `add`, `refresh`)
- [Textures — PixiJS 8 가이드](https://pixijs.com/8.x/guides/components/textures) (`Texture.from`, 텍스처 소스)
- [Lospec palette list](https://lospec.com/palette-list) (검증된 램프)
- 아트: [Pixel Platformer by Kenney](https://kenney.nl/assets/pixel-platformer) (CC0)
