Godot 4でドット絵がぼやけるのは、2Dテクスチャが既定で**Linear**フィルターで描画されるためです。**Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter**を**Nearest**にすれば直ります。ガタつきやピクセルのちらつきは、整数でない倍率での拡大や、スプライト・カメラがピクセルの間に位置することが原因です。**Display → Window → Stretch**で**Mode**を`viewport`、**Scale Mode**を`integer`（Godot 4.2以降）にし、**Rendering → 2D → Snap → Snap 2D Transforms to Pixel**をオンにして、カメラを整数ピクセル単位で動かしてください。

以下の設定と数値はすべてGodot 4.7.2（gl_compatibilityレンダラー）で確認しました。画像はKenneyのCC0素材（Pixel Platformer、Tiny Dungeon）をGodotで実際に描画したものです。Godot 4.7で変わった点が1つあります。4.7で新規作成したプロジェクトは**Stretch Mode**が`canvas_items`、**Aspect**が`expand`で始まるので、新しいプロジェクトでもこの設定を必ず確認してください。

## ドット絵をくっきり・安定させる {#steps}

:::steps
1. **テクスチャフィルターをNearestにします。** **Project → Project Settings**で**Rendering → Textures → Canvas Textures**を開き、**Default Texture Filter**を**Nearest**にします。フィルターが**Inherit**のノードは、すべてテクセルをくっきりした四角形で描くようになります。特定のノードだけ変えたい場合は、そのノードの**CanvasItem → Texture → Filter**を**Nearest**にします。
2. **インポート設定を確認します。** FileSystemドックでPNGを選び、**Import**ドックを開きます。**Compress → Mode**は**Lossless**（既定値）、**Mipmaps → Generate**はオフ（既定値）にします。ドット絵に**VRAM Compressed**は使わないでください。値を変えたら**Reimport**を押します。
3. **基準解像度を決めます。** **Display → Window → Size**で、**Viewport Width**と**Viewport Height**をゲームのピクセル解像度（例：320×180、640×360）にします。どちらも1280×720、1920×1080、2560×1440にきれいに収まります。起動時のウィンドウを大きくしたいときは、**Window Width Override**と**Window Height Override**を設定します（例：1280×720）。
4. **整数倍でだけ拡大します。** **Display → Window → Stretch**で、**Mode**を`viewport`、**Aspect**を`keep`（黒帯）または`expand`（横長の画面では表示範囲が広がる）、**Scale Mode**を`integer`にします。ゲームは基準解像度で描画されてから2倍、3倍、4倍と整数倍で拡大され、3.125倍のような倍率にはなりません。
5. **スプライトをピクセルにスナップします。** **Rendering → 2D → Snap**で**Snap 2D Transforms to Pixel**をオンにします。**Snap 2D Vertices to Pixel**はオフのままにしてください。両方を同時に使わないようドキュメントで推奨されています。スナップの設定はゲーム起動時にしか読まれないので、変更後はゲームを再起動します。
6. **カメラを整数ピクセル単位で動かします。** プレイヤーを追うCamera2Dの**Position Smoothing**をオフにし、カメラをプレイヤーの位置を丸めた座標に置きます（下のスクリプト）。スムージングをかけたカメラは、ほとんどのフレームでピクセルとピクセルの間にいます。
7. **高リフレッシュレート画面でのカクつきを取ります。** 120／144Hzで動きがぎこちない場合は、**Physics → Common → Physics Interpolation**をオンにします（2DはGodot 4.3以降）。物体は`_physics_process()`で動かし、オンにしたあとでカメラの動きを確認し直します。
:::

![同じKenneyのキャラクター2体を6倍で描画。左はLinearフィルターで柔らかくにじみ、右はNearestでピクセルがひとつずつくっきりした四角形になっています](shot:engine-godot-pixel-linear-vs-nearest "Godot 4.7.2（gl_compatibility）で描画：Sprite2Dを6倍、texture_filterがLinear（左）とNearest（右）。素材：Kenney Pixel Platformer（CC0）")

## 設定をまとめると {#project-godot}

ファイルを直接編集したい場合、上の手順で`project.godot`に書き込まれる行は次のとおりです。Godot 4.7.2でそのまま読み込めます。1000×600のウィンドウでは320×180のゲームがちょうど3倍で描かれ、左右20px、上下30pxの黒帯が付きました。`scale_mode="fractional"`にすると、同じウィンドウで3.125倍になりました。

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

`default_texture_filter=0`がNearest、既定値の1がLinearです。整数倍スケールでは、ウィンドウが基準サイズより小さくなると画面が切れます。プレイヤーがウィンドウサイズを変えられるなら、ルートウィンドウの`min_size`を基準サイズにしてください。

## ドット絵がぼやける理由 {#why-blurry}

- **フィルターは画像ではなくノードのプロパティです。** すべてのCanvasItemに**Texture → Filter**があります。既定値の**Inherit**は親のフィルターを引き継ぎ、最上位ではビューポートのフィルター、つまりプロジェクト設定に従います。
- **SubViewportは独自のフィルターを持ちます。** 新しく作ったSubViewportの**Canvas Items → Default Texture Filter**は、プロジェクト設定に関係なく**Linear**です（4.7.2で確認）。CRT風エフェクトや画面分割でゲームをSubViewportに描画するなら、そちらも**Nearest**にしてください。
- **圧縮とミップマップ。** VRAM圧縮はブロック状の崩れや色ずれを生みます。ミップマップは*Mipmap*系のフィルターでしか使われず、カメラを縮小するとスプライトがよりぼやけます。2Dのドット絵ではほぼ不要です。Importドックの**2D**プリセットなら、テクスチャが3Dで使われてもLosslessのままです。既定の**2D/3D (Auto-Detect)**プリセットでは、そうしたテクスチャがVRAM Compressedに切り替わります。
- **絵そのものがすでにぼやけている。** 取り込む前に補間付きでリサイズしたスプライトや、ペイントソフトで2.5倍にした画像は、エンジンの設定では直せません。ファイル自体を確認してください（[Nerulioのブロック](#nerulio)を参照）。

## ドット絵がガタつく・ちらつく理由 {#why-jitter}

「ガタつき」と呼ばれる現象は、実は3種類あります。この順に対処してください。

**1. ピクセルの大きさがそろわない（ちらつき）。** 整数でない倍率では、ある元ピクセルは画面上で3px、別のピクセルは2pxになります。カメラが動くと太い列と細い列がスプライトの上を流れ、絵がうごめいて見えます。`Scale Mode = integer`で解消できますが、代わりに黒帯が付きます。

![96×56pxの画面を、左は2.5倍で線や輪郭が2pxと3pxに不ぞろいになり、右は3倍ですべてのピクセルが同じ大きさです](shot:engine-godot-pixel-fractional-vs-integer "Godot 4.7.2で描画：1つの96×56 SubViewportをNearestで2.5倍（左）と3倍（右）で表示し、キャプチャ後にニアレストネイバーで2倍に拡大。素材：Kenney Tiny Dungeon・Pixel Platformer（CC0）")

**2. プレイヤーが背景に対して揺れる（サブピクセルのカメラ）。** 低解像度のビューポートでは、スプライトとカメラがそれぞれ別々に整数ピクセルへ丸められます。スムージングしたカメラが小数の距離だけ遅れてプレイヤーを追うと、2つの丸めの結果がフレームごとに食い違い、プレイヤーが1pxずつ前後に跳ねます。**Snap 2D Transforms to Pixel**をオンにした96×56のビューポートで、一定速度で歩くプレイヤーを描画して確かめました。標準の**Position Smoothing**では、プレイヤーの画面上の位置が180フレーム中78フレームで変わり、毎回同じ2列の間を行き来しました。カメラをプレイヤーの丸めた位置に置くと、一度も変わりませんでした。

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

低解像度のゲームで、なめらかに遅れて付いてくるカメラがどうしても必要な場合は「サブピクセルカメラ」の手法を使います。ゲームを画面より1px大きいSubViewportに描画し、カメラは整数ピクセルに置き、拡大した画像を余った小数分 × 倍率だけずらす方法です。Godotにはこれを有効にする組み込みのスイッチはありません。

**3. 更新の周期が合わずカクつく。** 物理は毎秒60ティックで動きます。144Hzのモニターでは、あるティックは2フレーム、別のティックは3フレーム表示されるため、ピクセルが完璧でも動きが不均一になります。プレイヤーを`_physics_process()`で動かしているのに、スムージングしたCamera2Dが毎フレーム更新される（**Process Callback**の既定値は**Idle**）と、さらに悪化します。144fpsのテストでは、プレイヤーの画面上の位置が288フレームの間に238回向きを変えましたが、カメラの**Process Callback**を**Physics**にすると0回になりました。**Physics Interpolation**（Godot 4.3以降）はさらに一歩進めて、2つのティックの間の位置を補間して描画します。オンにするとCamera2Dも自動で物理更新に切り替わり、一緒に補間されます（Godotは「Camera2D overridden to physics process mode due to use of physics interpolation」と出力します）。ノードを瞬間移動させたあとは`reset_physics_interpolation()`を呼び、すべるように動かないようにしてください。

## canvas_itemsとviewportのどちらを使うか {#stretch-modes}

| | `viewport` | `canvas_items` |
|---|---|---|
| 描画解像度 | 基準解像度で描いてから拡大 | ウィンドウの解像度 |
| ピクセル | 常にゲームのピクセル単位（本物の低解像度） | 回転・拡大したスプライトではより細かいピクセル（ミクセル）が出ることがある |
| テキスト・UI | 絵と同じピクセルサイズ | どのサイズでもくっきり |
| ドキュメントの推奨 | ドット絵のゲーム | ドット絵以外のほとんどのゲーム、一部のドット絵ゲーム |

どちらのモードも`integer`スケールとNearestフィルターと組み合わせられます。すべてを同じピクセルグリッドにそろえたいなら`viewport`、高解像度のテキストやなめらかな回転・ズームが欲しいなら`canvas_items`を選びます。Godot 4.7の新規プロジェクトは`canvas_items`で始まります。

## ピクセルフォント {#pixel-fonts}

LabelもCanvasItemなので、Nearestフィルターが同じように効きます。TTF／OTFのピクセルフォントは、FileSystemドックで選んで**Import**ドックで次を確認します。

- 設計サイズの整数倍で描かないなら、**Antialiasing**を**Disabled**にします。
- Godot 4.4から、**Hinting**と**Subpixel Positioning**の既定値は「(Except Pixel Fonts)」モードです。グリフが水平・垂直の直線だけでできたフォントでは、どちらも自動でオフになります。それより前のバージョンでは、**Subpixel Positioning**を自分で**Disabled**にしてください。
- フォントサイズは設計サイズの倍数にします（8pxのフォントなら8、16、24…）。

**GUI → Theme**の既定フォント設定はGodot内蔵フォントにだけ効き、インポートしたフォントには影響しません。スプライトシートから作るビットマップフォントについては[ゲームUI向けビットマップ／SDFフォント](guide:bitmap-font-sdf-msdf-game-ui)を参照してください。

## バージョンごとの違い {#versions}

- **Godot 4.x：** フィルターはCanvasItemのプロパティ（**Texture → Filter**）で、プロジェクト全体の既定値は**Default Texture Filter**です。Godot 3ではインポートのオプションでした。**Snap 2D Transforms/Vertices to Pixel**は4.0からあります。
- **4.2：** **Stretch → Scale Mode**（`fractional`／`integer`）が追加。
- **4.3：** 2D向けの組み込み**Physics Interpolation**が追加。
- **4.4：** フォントのインポート既定値がピクセルフォントを検出（「Except Pixel Fonts」モード）。
- **4.7：** 新規プロジェクトが**Stretch Mode** `canvas_items`、**Aspect** `expand`で始まる。SpriteFramesにピンポンのループモードが追加。

:::nerulio tool=pixel-perfect-checker
スプライトのファイル自体に問題があるかどうかは、Pixel Perfect Checkerで分かります。画像のピクセル倍率とグリッドのオフセットを測り、輪郭の中間色ピクセルを数え、正確なブロックグリッドがある場合にだけ**1×の元画像を復元**を表示します。Kenneyのキャラクターをニアレストネイバーで3倍にしたファイルは「整数のピクセル格子を確認しました · 3×」、2.5倍では「整数格子なし — 非整数倍率」（推定約2.547倍）と判定されました。バイリニアで3倍にしたファイルはグリッドのない約2.98倍のリサンプルと判定され、輪郭ピクセルの61.5%が中間色でした。

- スプライトやフレームをページにドロップし、**検査**を開きます。処理はすべて端末内で行われます。
- きれいな1×のフレームを書き出すか、**書き出し倍率（最近傍）**で整数倍の拡大画像を作ります。
- Godot向けには、[パック & 書き出し](studio:pack)がシーンのノードをNearestにしたSpriteFramesのバンドルを書き出します。`.png.import`はLossless・ミップマップなしで、アルファ境界の補正をオフにしているため、薄いピクセルの色もそのまま残ります。Godot 4.7.2で読み込みを確認済みです。プロジェクト全体のフィルターとストレッチの設定は、手順1〜5で自分で行ってください。
:::

## よくある質問 {#faq}

### Godot 4でドット絵がぼやけるのはなぜですか？ {#faq-blurry}

2Dノードは既定でLinearフィルターを使い、隣り合うテクセルを混ぜて描画します。**Rendering → Textures → Canvas Textures → Default Texture Filter**を**Nearest**にし、SubViewportや独自の**Texture → Filter**を持つノードもNearestになっているか確認してください。

### Godot 4のテクスチャフィルターの設定はどこにありますか？ {#faq-filter-setting}

Godot 3のようなインポートのオプションではなくなりました。CanvasItemごと（**Texture → Filter**）、Viewportごと（**Canvas Items → Default Texture Filter**）、プロジェクト全体では**Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter**で設定します。

### Godot 4で整数倍スケーリングにするには？ {#faq-integer-scaling}

**Display → Window → Stretch → Scale Mode**を`integer`にします（Godot 4.2以降）。**Stretch Mode**は`viewport`か`canvas_items`にします。倍率は整数に切り捨てられ、余ったスペースは黒帯になります。

### カメラが動くとプレイヤーがガタつくのはなぜですか？ {#faq-camera-jitter}

カメラとプレイヤーが別々にピクセルへ丸められているか、異なる周期で更新されているためです。Camera2Dをスムージングなしでプレイヤーの丸めた位置に置くか、**Process Callback**を**Physics**にしてください。モニターのリフレッシュレートと物理ティックが違う場合は**Physics Interpolation**をオンにします。

### Snap 2D TransformsとSnap 2D Vertices to Pixelのどちらを使うべきですか？ {#faq-snap}

**Snap 2D Transforms to Pixel**を使ってください。両方をオンにすると動きがさらにぎこちなくなるため、Godotのドキュメントもこちらだけを有効にするよう推奨しています。

## 出典 {#sources}

- [ProjectSettings](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html) — Godot 4.7 クラスリファレンス（default_texture_filter、stretch mode/aspect/scale_mode、snap_2d_*、physics_interpolation）
- [Multiple resolutions](https://docs.godotengine.org/en/4.7/tutorials/rendering/multiple_resolutions.html) — Godot 4.7 マニュアル（ドット絵：viewport、keep/expand、integer）
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html)、[ResourceImporterTexture](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html) — Godot 4.7
- [CanvasItem](https://docs.godotengine.org/en/4.7/classes/class_canvasitem.html)、[Viewport](https://docs.godotengine.org/en/4.7/classes/class_viewport.html) — Godot 4.7 クラスリファレンス（texture_filter、canvas_item_default_texture_filter）
- [Camera2D](https://docs.godotengine.org/en/4.7/classes/class_camera2d.html) — Godot 4.7 クラスリファレンス（process_callback、位置のスムージング）
- [Using physics interpolation](https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/using_physics_interpolation.html) — Godot 4.7 マニュアル
- [ResourceImporterDynamicFont](https://docs.godotengine.org/en/4.7/classes/class_resourceimporterdynamicfont.html) — Godot 4.7 クラスリファレンス（antialiasing、hinting、subpixel positioning）
- [editor_node.cpp（4.7.2-stable）](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/editor_node.cpp) — `get_initial_settings()`：新規プロジェクトのストレッチ既定値
