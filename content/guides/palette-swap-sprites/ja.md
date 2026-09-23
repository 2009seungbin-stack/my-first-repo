スプライトのパレットスワップ(敵のランク違い、チームカラー、スキン)には二つのやり方があります。バリエーションごとに色を塗り替えた画像をあらかじめ**焼き込む**か、スプライトを**インデックスマップ**として描き、小さなシェーダーでピクセルごとに**パレットテクスチャ**(バリエーション1つにつき1行)から色を引く方法です。焼き込みはシェーダーなしでどのエンジンでも使えます。シェーダー方式はバリエーションがいくつあってもテクスチャ1枚で済み、実行中にパレットを切り替えられます。ただし両方のテクスチャを最近傍(Nearest)フィルタでサンプリングし、非可逆圧縮や色空間変換なしでインポートしたときだけ正確な色になります。

このガイドでは、Godot 4とUnity 6(URP 2D)でシェーダー方式を組み、PhaserとPixiJSではバリエーションを焼き込みます。インデックスマップを壊すフィルタリングのミスも実際のレンダリングで確認します。

![1つのGodotシェーダーで描いたKenneyのエイリアンのパレット違い5種](shot:engine-palette-swap-godot "Godot 4.7.2(Compatibilityレンダラー)でレンダリング:48×24のインデックスマップ1枚と7×5のパレットテクスチャ1枚。ShaderMaterialを共有する5つのSprite2Dが、それぞれ別のパレット行を使っています。全ピクセルが期待したパレット色と完全に一致しました。アート:Kenney Pixel Platformer(CC0)。")

## 方式を選ぶ {#approaches}

| 方式 | 仕組み | 向いている場面 | 注意点 |
|---|---|---|---|
| 焼き込み済みバリエーション | バリエーションごとにPNGの色を一度だけ塗り替える(ビルド前またはロード時) | バリエーションが少ない、全エンジン、シェーダーを使えない | バリエーションごとにテクスチャ1枚:メモリ増、バッチが途切れる |
| インデックスマップ+パレットテクスチャ | Rチャンネルにパレット番号を入れ、シェーダーがパレット画像のn行目から色を読む | バリエーションが多い、実行中の切り替え、プレイヤーが選ぶ色 | 最近傍フィルタと、可逆・非sRGBのインポートが必須 |
| 色比較シェーダー | シェーダーが各ピクセルを元の色リストと比べ、一致したら置き換える | 元のアートのまま手早く差し替え | ピクセルごとにループ。フィルタや圧縮で色が少しでも変わると失敗 |
| グラデーションマップ | ピクセルの明るさでグラデーションから色を選ぶ | 単色のアート、状態異常の演出 | 明るさが同じ別パーツが同じ色になる |

シェーダー方式ではインデックスマップがいちばん堅牢なので、ここから始めます。

## Godot 4でシェーダーによるパレットスワップ {#godot-shader}

例はKenneyの緑のエイリアンです。24×24のフレームが2枚、色は7色(輪郭、4段階の体のランプ、ヘルメット、白)です。

:::steps
1. **パレットの順番を決める。** スプライトの色を決まった順に並べ、ランプは暗い色から明るい色の順にします:輪郭、体(4段階)、ヘルメット、白。この位置が列番号になります。
2. **パレットテクスチャを描く。** 色数ぶんの幅で、バリエーション1つにつき1行のPNGを作ります。0行目は元の色、残りの行は同じ列を別の色で塗ります(青、ピンク、赤のエリート、金のボス)。
3. **インデックスマップを作る。** 不透明なピクセルをすべて`Color8(列, 0, 0, アルファ)`に置き換え、透明なピクセルはそのままにします。下の`make_index_map.gd`がこの処理をします。結果がほぼ黒く見えるのは正常です。
4. **インポートを確認する。** **Import**ドックで両方のPNGを**Compress > Mode: Lossless**(2Dの既定値)のままにし、**Mipmaps > Generate**はオフにします。VRAM圧縮はインデックスの値を変えてしまいます。
5. **シェーダーを作る。** 下の`palette_swap.gdshader`を保存し、それを使う**ShaderMaterial**を作って**Palette**パラメーターに`palettes.png`を設定します。
6. **Nearestフィルタにする。** 各Sprite2DやAnimatedSprite2Dで**CanvasItem > Texture > Filter**を**Nearest**にするか、**Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter**を**Nearest**にします。
7. **ノードごとに行を選ぶ。** すべての敵に同じマテリアルを使い、`set_instance_shader_parameter("palette_row", n)`でバリエーションを選びます。いつでも変更できます。
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

`texelFetch`はテクセルを1つだけフィルタなしで読むので、隣り合うパレット色が混ざることはありません。`tint`のvaryingのおかげで、被弾時のフラッシュやフェードに使う`modulate`もそのまま効きます。

変換スクリプトは`godot --headless --path . --script res://make_index_map.gd`で一度だけ実行します。

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

パレットにない色が出る場合、たいていはアンチエイリアスのかかった縁です。先に整理してください([パレット外のピクセルを直す](guide:fix-ai-generated-pixel-art)を参照)。敵ごとのスクリプトは次のとおりです。

```gdscript
# enemy.gd — on a Sprite2D whose texture is the index map and whose material uses palette_swap.gdshader
extends Sprite2D

@export var tier := 0   # row in palettes.png

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	set_instance_shader_parameter("palette_row", tier)
```

### instance uniformを使う理由 {#instance-uniform}

普通の`uniform`だとバリエーションごとにマテリアルが必要になり、マテリアルが変わるたびに2Dのバッチングが途切れます。Godot 4.7.2で計測したところ、`instance uniform`で行だけ変えてマテリアル1つを共有したスプライト200個はドローコール**1**回で描かれました。同じ200個にマテリアルを1つずつ複製すると**200**回かかり、CompatibilityとForward+のどちらのレンダラーでも同じでした。インスタンスユニフォームはスカラーとベクトルのみで、1シェーダーあたり最大16個です。

### インデックスマップを使わない:色比較 {#color-match}

アートを変換できない場合は、シェーダー内で色を比較します。元のPNGにそのまま使え、テストでもピクセル単位で正確でしたが、圧縮・フィルタ・リサンプリングが少しでも入ると一致しなくなります。

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

配列は`material.set_shader_parameter("from_colors", [...])`で渡し、長さを`MAX_COLORS`にそろえます。

### グラデーションマップ {#gradient-map}

グラデーションマップは`GradientTexture1D`から`texture(gradient, vec2(明るさ, 0.5))`で色を読みます(ドット絵らしくくっきり分けるにはGradientの**Interpolation Mode**を**Constant**に)。下準備は不要ですが、明るさしか見ません。エイリアンでは明るいヘルメットと体のハイライトが同じ色帯に入りました。複数パーツのキャラクターより、単色のアートや状態異常の演出に向いています。

## ランプの一貫性を保つ {#ramps}

- **ランプの段数をそろえる。** 体が4段階なら、差し替えるランプも暗い順に4段階必要です。3段階のランプを4列に押し込むと陰影が平板になります。
- **明るさの段差を保つ。** 色相は変えても、各段の明るさは元とほぼ同じにします。中間色がハイライトより明るいと陰影が裏返って見えます。
- **パーツごとに列を分ける。** 輪郭とヘルメットが専用の列を持っているので、バリエーションごとに据え置くことも変えることもできます(金のボスは両方を変更)。元のアートで1色を共有しているパーツは、別々には塗り替えられません。
- **全フレームでパレットは1つ。** パレットは全フレームからまとめて抽出します。そうしないと、7フレーム目にしかない色がインデックスから漏れます。
- **ランプに色相のずれを入れる。** よいランプは影で寒色に、ハイライトで暖色に寄ります。Lospecのパレット一覧に実績のあるランプが揃っています。

## フィルタリングとインポートの問題 {#filtering}

インデックスマップは色ではなくデータです。隣のテクセルを混ぜる処理が入るとインデックスが狂い、狂ったインデックスは無関係なパレット列の色を拾います。

![Godotで同じインデックスマップをNearestとLinearでフィルタした比較](shot:engine-palette-filter-godot "Godot 4.7.2でレンダリング:同じインデックスマップとパレット行。左はNearestフィルタ(正確)、右はインデックスマップだけLinearフィルタにした結果です。混ざったインデックスが別のパレット列を指し、輪郭が体とヘルメットの色の縁取りに変わっています。アート:Kenney(CC0)。")

- **インデックスマップはNearestに。** 上のレンダリングでは、インデックスマップだけをLinearにしたところ、画面の20,736ピクセル中5,350ピクセルが変わりました。[Godot 4のドット絵のぼやけ対策](guide:godot-4-pixel-art-blurry-jitter)も参照してください。
- **パレットは正確に読む。** `texelFetch` / `LOAD_TEXTURE2D`を使うか、Pointサンプリングでテクセルの中心を読みます。
- **インデックスマップにミップマップ、非可逆圧縮、GPU圧縮は使わない。**
- **インデックスマップに色空間変換をかけない。** Godotは試した2つのレンダラーのどちらでもそのままでしたが、UnityのLinear色空間ではsRGBでインポートしたインデックスマップがデコードされてしまいます(後述)。
- **インデックスカラーのPNGは役に立たない。** エンジンはインポート時に普通の色へ展開するので、インデックスはチャンネルに書き込む必要があります。
- **拡大はファイルではなくノードで。** 画像エディタでインデックスマップをリサンプリングするとインデックスが混ざります。

## Unity 6(URP 2D Renderer) {#unity}

このアンリットのスプライトシェーダーはUnity 6000.5.3f1+URP 17.5.0でエラーなくコンパイルでき、2D RendererのカメラがGammaとLinearの両方の色空間で5つのバリエーションをピクセル単位で正確に描きました。SpriteRendererの**Color**と**Flip X**もそのまま効きます。

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

シェーダーよりもインポート設定のほうが重要です。

- **インデックスマップ:** Texture Type **Sprite (2D and UI)**、**sRGB (Color Texture)**オフ、**Filter Mode** Point (no filter)、**Compression** None、**Generate Mipmaps**オフ。LinearのプロジェクトでsRGBをオンのままにしたところ、スプライト全体が輪郭の色になりました。小さなインデックス値が0寄りにデコードされたためです。
- **パレットテクスチャ:** Texture Type **Default**、sRGBオン、Filter Mode Point、Compression None、**Non-Power of 2**は**None**。Defaultタイプの既定値(To nearest、Bilinear、Compressed)のままだと、7×5のパレットが8×4にリサイズされてインポートされ、すべての列がずれました。
- **バリエーションごとにマテリアル1つ:** ランクごとにマテリアルアセットを作り、**Palette Row**を設定します。`MaterialPropertyBlock`でも動きますが、UnityのマニュアルはSRP Batcherの条件として「MaterialPropertyBlockを使わないこと」を挙げています。

Shader Graphで作る場合は**Assets > Create > Shader Graph > URP > Sprite Unlit Shader Graph**を作成します。`_MainTex`をサンプリングしてRに255を掛け、**Round**して0.5を足し、**Texture Size**ノードのパレット幅で割るとUになります。Vは`1 − (row + 0.5) / height`です。パレットは**Sampler State**を**Point**にした**Sample Texture 2D LOD**(LOD 0)で読んで**Base Color**へ、メインテクスチャのAは**Alpha**へつなぎます。

## PhaserとPixiJS:ロード時にバリエーションを焼き込む {#web}

Webではいちばん簡単で確実なのが焼き込みです。画像をcanvasに描き、ピクセルデータの色を置き換え、結果を新しいテクスチャとして登録します。次のコードはPhaser 3.90と4.2で変更なしに動き、焼き込んだシートからアニメーションも再生できました。

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

PixiJS 8.21版はループが同じで、最後の手順だけが違います。

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

フレームは`new Texture({ source: baked.source, frame: new Rectangle(x, y, w, h) })`で切り出します。どちらのエンジンでもcanvasは色を乗算済み(プリマルチプライド)で保持するため、半透明のピクセルは1段階ほどずれることがあります(完全な不透明と完全な透明は正確です)。またバリエーションごとにテクスチャが別になりバッチが増えるので、数が多いときは1枚のアトラスに焼き込みましょう。くっきり拡大する方法は[Phaser・PixiJSでドット絵をくっきり表示](guide:pixel-art-crisp-in-browser-phaser-pixi)を参照してください。

## 焼き込みか、実行時シェーダーか {#trade-offs}

- **メモリ:** 焼き込みはバリエーションごとにシート全体を持ち、シェーダー方式はインデックスマップ1枚と数ピクセルのパレットだけです。
- **ドローコール:** インスタンスごとの行を使う共有マテリアルはバッチされます。焼き込んだバリエーションは同じアトラスページにあるときだけバッチされます。
- **実行中の変更:** プレイヤーが選んだ色や状態異常の色味は、シェーダーならパラメーター1つ、焼き込みなら焼き直しです。
- **移植性:** 焼き込んだPNGはどこでも使えますが、インデックスマップはゲームの外では黒く見え、描く場所すべてでシェーダーが必要です。
- **目安:** 固定のバリエーションが数個なら焼き込み、多い場合や実行中に選ぶ場合はインデックスマップとパレットです。

:::nerulio tool=pixel-lab
NerulioのPixel Labは、パレットスワップのアート側の作業をアップロードなしでブラウザ内で行います。全フレームで1つのパレット、ランプを崩さない塗り替え、焼き込み済みバリエーションまで対応します。インデックスマップやパレットテクスチャはまだ出力しないため、シェーダー方式ではPixel Labから書き出したパレットで列の順番を決め、上の変換スクリプトを実行してください。
- **Palette**:全フレームからまとめてパレットを抽出し、並べ替え・固定して`.gpl`、`.hex`、JSONで書き出します。
- **Recolour > Ramp swap**:元のランプを選ぶと明るさの順に対象ランプへ対応づけるので、いちばん暗い色は暗いままです。**Hue range**と**Status tint**(凍結、毒、炎上など)はパレット全体にかかります。
- **Export team variants (ZIP)**:`red,blue,gold`や`#RRGGBB`のように基準色を入力すると、バリエーションごとのフォルダに全フレームとそのバリエーションの`.gpl`が入ります。
- 一度きりの簡単な差し替えなら、[パレットスワップツール](tool:palette-swap)が選んだ色を許容誤差と陰影維持オプション付きで置き換えます。画像1枚でも複数枚でも使えます。
:::

![Nerulio Pixel Labの塗り替えステージ](shot:lab-pixel-palette "Nerulio Pixel LabのRecolourステージ:全フレームで1つのパレット、Ramp swap、Hue range、Status tintとチームバリエーションの書き出し。")

## よくある質問 {#faq}

### Godot 4でスプライトのパレットスワップはどうやりますか? {#faq-godot}
スプライトをインデックスマップ(Rチャンネルにパレット番号)に変換し、バリエーションごとに1行の小さなパレットテクスチャを用意して、`texelFetch(palette, ivec2(index, row), 0)`で色を読む`canvas_item`シェーダーを使います。ノードのテクスチャフィルタはNearestにし、行は`instance uniform`でノードごとに選びます。

### パレットスワップのシェーダーで縁の色がおかしくなります。 {#faq-edges}
インデックスマップがフィルタリングされています。Linearフィルタ、ミップマップ、非可逆圧縮は隣のインデックスを混ぜ、別のパレット列を指す値にしてしまいます。Nearest(Point)フィルタ、ミップマップなし、可逆インポートにし、パレットは正確なテクセル読み出しで取得してください。

### バリエーションは焼き込むべきですか、シェーダーを使うべきですか? {#faq-bake}
固定のバリエーションが数個だけ、またはカスタムシェーダーが扱いにくいエンジンなら焼き込みが向いています。バリエーションが多い、実行中に色を選ぶ、被弾フラッシュのような演出が要る場合はシェーダーを使いましょう。テクスチャ1枚で済み、パレットの違うスプライト同士が1つのマテリアルを共有できます。

### Godotでは正しいのにUnityだけパレットの色がずれます。 {#faq-unity}
UnityのLinear色空間では、**sRGB (Color Texture)**をオンにしたインデックスマップがシェーダーに届く前に変換され、インデックス値が変わります。インデックスマップのsRGBはオフ、パレットはオンにし、パレットの**Non-Power of 2**を**None**にしてリサイズされないようにしてください。

### AsepriteのインデックスカラーPNGをそのままインデックスマップに使えますか? {#faq-indexed-png}
そのままでは使えません。エンジンはインポート時にインデックスカラーのPNGを普通の色に展開するので、シェーダーにはインデックスが届きません。制作はIndexedモードで構いませんが、`make_index_map.gd`のような変換スクリプトでインデックスをRチャンネルに書き込む必要があります。

## 参考資料 {#sources}

- [Shading language — Godot Engine 4.7ドキュメント](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html)(ユニフォームヒント`source_color`・`filter_nearest`、インスタンスごとのユニフォーム、ユニフォーム配列)
- [Built-in functions — Godot Engine 4.7ドキュメント](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shader_functions.html)(`texelFetch`)
- [CanvasItem shaders — Godot Engine 4.7ドキュメント](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)(`TEXTURE`、`UV`、`COLOR`)
- [Importing images — Godot Engine 4.7ドキュメント](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)(Losslessモード、VRAM圧縮とドット絵)
- [Default texture import settings — Unity 6.5マニュアル](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-default.html)(sRGB (Color Texture)、Non Power of 2、Filter Mode)
- [SRP Batcher materials — Unity 6.5マニュアル](https://docs.unity3d.com/6000.5/Documentation/Manual/SRPBatcher-Materials.html)(MaterialPropertyBlockの条件)
- [Sampler State node — Shader Graph 17.5](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sampler-State-Node.html)、[Sample Texture 2D LOD node](https://docs.unity3d.com/Packages/com.unity.shadergraph@17.5/manual/Sample-Texture-2D-LOD-Node.html)
- [CanvasTexture — Phaser 4 APIドキュメント](https://docs.phaser.io/api-documentation/class/textures-canvastexture)(`getContext`、`add`、`refresh`)
- [Textures — PixiJS 8ガイド](https://pixijs.com/8.x/guides/components/textures)(`Texture.from`、テクスチャソース)
- [Lospec palette list](https://lospec.com/palette-list)(実績のあるランプ)
- アート:[Pixel Platformer by Kenney](https://kenney.nl/assets/pixel-platformer)(CC0)
