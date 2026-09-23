Godot 4でスプライトシートをアニメーションにするには、**AnimatedSprite2D**を追加し、**Sprite Frames**プロパティで**New SpriteFrames**を作成して、SpriteFramesパネルの**Add Frames from Sprite Sheet**をクリックします。**Select Frames**ダイアログでグリッド（**Horizontal**／**Vertical**のフレーム数、またはピクセル単位の**Size**・**Separation**・**Offset**）を合わせ、再生したい順にフレームをクリックして**Add N Frame(s)**を押します。あとはFPS・ループ・自動再生を設定し、コードからは`$AnimatedSprite2D.play("run")`で再生します。

以下の内容はすべてGodot 4.7.2（gl_compatibilityレンダラー）で確認しました。テスト用のシートはCC0素材で、sebshadyのサムライシート（288×480px、48pxのフレームが6×10）と、KenneyのPixel Platformerキャラクターシート（224×74px、24pxのフレームの間に1pxの隙間）です。

## スプライトシートを読み込んでアニメーションにする {#steps}

:::steps
1. **最初にドット絵をくっきり表示する設定にします。** **Project → Project Settings**の**Rendering → Textures → Canvas Textures**で、**Default Texture Filter**を**Nearest**にします。この設定がないとGodotはLinearフィルターで描画するため、ドット絵がぼやけます。PNGのインポート設定は既定値（**Compress Mode** Lossless、ミップマップなし）のままで2Dには適しています。
2. **ノードとSpriteFramesを作ります。** シーンに**AnimatedSprite2D**を追加します。インスペクターで空の**Sprite Frames**プロパティをクリックして**New SpriteFrames**を選び、作成されたリソースをもう一度クリックすると、エディター下部に**SpriteFrames**パネルが開きます。
3. **シートを開きます。** **Animation Frames**のツールバーで**Add Frames from Sprite Sheet**（Ctrl+Shift+O）をクリックし、PNGを選びます。**Select Frames**ダイアログが4×4のグリッドで開きます。
4. **グリッドを合わせます。** 右側の設定で、**Horizontal**と**Vertical**にフレーム数を入れるか、**Size**に1フレームのピクセルサイズを入れます。フレームの間に隙間があれば**Separation**、最初のフレームの前に余白があれば**Offset**を入力します。すべての線がフレームとフレームのちょうど間に来ているか確認してください。
5. **再生順にフレームを選びます。** 1つずつクリックするか、ドラッグでまとめて選びます。Shift+クリックで範囲選択もできます。各フレームに表示される番号が追加される順番です。**Frame Order**が**As Selected**ならクリックした順、**Left to Right, Top to Bottom**を選ぶとクリック順に関係なく左上から並びます。最後に**Add N Frame(s)**をクリックします。
6. **アニメーション名とタイミングを決めます。** **Animations**の一覧で`default`の名前を変え（例：`run`）、**FPS**欄に速度を入力します。**Animation Looping**ボタンをクリックして、ループ、ピンポン（Godot 4.7で追加）、オフのいずれかにします。`attack`のような1回だけのアニメーションはオフにします。1フレームだけ長く見せたいときは、そのフレームを選んで**Frame Duration**を上げます（2.0で2倍）。アニメーションごとに手順3〜6を繰り返し、新しいアニメーションは**Add Animation**（Ctrl+N）で追加します。
7. **再生します。** 自動で始めたいアニメーションで**Autoplay on Load**をオンにするか、スクリプトから`play()`を呼びます（[コードから再生する](#code)を参照）。F5／F6で実行し、ゲーム画面で動きを確認します。
:::

![同じシートから切り出したKenneyのキャラクター9体。上の段はSeparation 0のためフレームごとに1pxずつずれ、下の段はSeparation 1のためすべて中央に収まっています](shot:engine-godot-spritesheet-separation "Godot 4.7.2（gl_compatibility）でAnimatedSprite2Dを4倍・Nearestで描画した結果です。上：Auto Sliceが作るのと同じ24×24・Separation 0。下：このシートに合ったSeparation 1。素材：Kenney（CC0）")

## Select Framesダイアログの各項目 {#select-frames-dialog}

このダイアログは、選んだマスごとに**AtlasTexture**を1つ作ります。領域は`Offset + (列, 行) × (Size + Separation)`で、大きさは**Size**です。各項目はお互いに影響します。

| 項目 | 意味 | 変更すると変わるもの |
|---|---|---|
| **Horizontal**、**Vertical** | 1行・1列あたりのフレーム数 | **Size**を再計算：(シート − Offset − 隙間) ÷ 個数、切り捨て |
| **Size** | 1フレームのピクセルサイズ | シートのサイズからフレーム数を再計算 |
| **Separation** | フレーム間の隙間（px） | 最後に入力した側（個数かSize）を基準に保つ |
| **Offset** | 最初のフレームの前の余白（px） | Separationと同じ |
| **Auto Slice**（Godot 4.4以降） | 空の行・列からフレーム数を推定 | **Separation**と**Offset**を0にする |

切り出しがずれる原因のほとんどは次の3つです。

- **4×4へのリセット。** 直前に開いたシートとピクセルサイズが違うシートを開くと、ダイアログは4×4・隙間0・オフセット0に戻ります。前の値が残るのは、同じサイズのシートを開いたときだけです。
- **Auto Sliceは隙間を無視します。** 空でない列と行のまとまりを数え、シートのサイズをその数で割り、Separationを0にします。Kenneyのシートでは24pxのフレームを9×3個見つけますが、上の画像の上段のようにフレームごとに1pxずつ右へずれていきます。絵が隣のマスに接していたり、フレーム内に空の行があったりすると、個数そのものも間違えます。サムライのシートでは48×48が6×10個ではなく、48×80が6×6個と推定されます。結果は必ずグリッド線と見比べてください。
- **外周の余白があると個数入力がずれます。** シート全体に枠のような余白があるなら、先に**Offset**を入れてから**Size**を入力します。個数から計算するときは、最初のフレームの前のオフセットしか差し引かず、最後のフレームの後ろの余白は考慮されないためです。

## タイミング：FPS、フレーム時間、speed_scale {#timing}

SpriteFramesのアニメーションには、**FPS**の値が1つ（新しいアニメーションは5 FPS、ループはオン）、ループモード（`LOOP_NONE`、`LOOP_LINEAR`、Godot 4.7からは`set_animation_loop_mode()`で使える`LOOP_PINGPONG`）、そしてフレームごとの*相対値*である**Frame Duration**（既定値1.0）があります。1フレームが表示される時間は次のとおりです。

```text
seconds = frame_duration / (FPS × abs(speed_scale × custom_speed))
```

12 FPSでFrame Durationが2.0のフレームは、2 ÷ 12 ≈ 0.167秒表示されます。Asepriteや素材の説明に書かれたフレームごとのミリ秒を移すときは、`duration = ms × FPS ÷ 1000`で計算します。たとえば12 FPSで250msなら3.0です。ノードの`speed_scale`はすべてのアニメーションの速度を変え（2.0で2倍速）、`play("run", 1.5)`は`custom_speed`でその再生だけに倍率をかけます。

60fps固定で実行したテストでは、10 FPS・Frame Duration 3.0のフレームが18ティック（0.3秒）表示され、`speed_scale = 2.0`でその半分になりました。

## コードから再生する {#code}

`play()`はすでに再生中のアニメーションを最初からやり直さないので、毎物理フレーム呼んでも問題ありません。`animation_finished`はループがオフのアニメーションでだけ発生します。

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

ほかによく使うものに、`play_backwards()`、`pause()`（フレームと進み具合を保持）、`stop()`（フレーム0に戻る）、`frame`、`frame_progress`、進行を保ったままアニメーションを切り替える`set_frame_and_progress()`、そしてシグナルの`frame_changed`と`animation_looped`があります。

## コードでSpriteFramesを作る {#spriteframes-from-code}

大きなシートや、何度も書き出し直すシートなら、ダイアログと同じ式でリソースをコードから作るほうが確実です。`ResourceSaver.save(frames, "res://hero_frames.tres")`で一度保存しておくか、実行時に作ります。

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

たとえば`SheetFrames.add_animation(frames, &"run", load("res://samurai.png"), Vector2i(48, 48), [Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)], 12.0)`は、サムライシートの3行目の最初の3フレームを追加します。新しい`SpriteFrames`には空の`default`アニメーションが入っているので、使わない場合は削除しておきましょう。

## AnimatedSprite2DとSprite2D + AnimationPlayer、どちらを使うか {#which-node}

| | AnimatedSprite2D + SpriteFrames | Sprite2D + AnimationPlayer |
|---|---|---|
| 設定 | 上のダイアログ、キャラクターごとにリソース1つ | Sprite2Dの**Hframes**／**Vframes**を設定し、タイムラインで**Frame**にキーを打つ |
| タイミング | FPSとフレームごとの相対時間 | 秒単位のキー時間 |
| 同じアニメーションでほかのプロパティも動かす | できない | できる：当たり判定、サウンド、メソッド呼び出し、オフセット |
| サイズの違うフレームや複数のシート | できる（フレームごとに別テクスチャ） | Sprite2Dごとにシート1枚、均一なグリッド |

単純なキャラクターのループにはAnimatedSprite2Dが手軽です。攻撃の3フレーム目で当たり判定を有効にするなど、決まったフレームでほかのものも動かしたいならAnimationPlayerを使います（[当たり判定とピボット](guide:hitboxes-pivots-2d-animation)を参照）。AnimationPlayerの場合、サムライシートなら**Hframes**を6、**Vframes**を10にして、0.0、0.1、0.2秒…に**Frame**のキーを打ちます。**Frame Coords**（列, 行）でグリッド上の位置を指定しても同じです。インスペクターから**Frame**にキーを打つとGodotは**Discrete**トラックを作るので、そのままにしてください。**Continuous**トラックでは整数が補間され、テストでは0.1秒ではなく0.06秒で次のフレームに切り替わりました。

## よくある失敗 {#common-mistakes}

- **フレームがぼやける。** ノードがプロジェクト既定のLinearフィルターを継承しています。手順1のとおりプロジェクトの既定値をNearestにするか、ノードの**CanvasItem → Texture → Filter**を**Nearest**にします。詳しくは[Godot 4でドット絵がぼやける・ガタつくときの対処](guide:godot-4-pixel-art-blurry-jitter)をご覧ください。
- **後ろのフレームほどずれが大きくなる。** シートに隙間があるのに**Separation**が0（上の画像）か、余白があるのに**Offset**が0です。
- **フレームが1つ多い・少ない（off-by-one）。** 末尾の空きマスや外周の余白のせいで、個数から計算したSizeが切り捨てられています。個数ではなく**Size**を直接入力し、絵のあるマスだけを選んでください。
- **フレームの順番がばらばら。** フレームはクリックした順に追加されます。**Select None**で選択を解除して選び直すか、**Frame Order**を指定します。
- **キャラクターがその場で揺れる。** マスごとに絵の位置が違うため位置合わせが必要か、トリミングしたアトラスがオフセットを失っています。AnimatedSprite2Dの**Offset**は全フレーム共通の1つだけです。[ピボットと当たり判定](guide:hitboxes-pivots-2d-animation)を参照してください。
- **`animation_finished`が来ない。** アニメーションがまだループ（またはピンポン）しています。**Animation Looping**をオフにします。
- **スクリプトでautoplayを設定しても再生されない。** `autoplay`はノードがツリーに入ったときに読まれます。そのあとで設定しても警告が出るだけなので、`play()`を呼んでください。
- **Autoplayが効いていないように見える。** **Autoplay on Load**はシーンを実行したときに始まり、2Dエディターの画面では再生されません。エディターではパネルの再生ボタンでプレビューします。

:::nerulio ws=sprite
Studioのスプライト作業画面では、切り出しとタイミングの設定をブラウザー内で行い、GodotがそのままロードできるSpriteFramesリソースとして書き出せます。隙間や余白も含めてグリッドを検出し、その確信度を表示します（Kenneyのシート：**グリッド 24×24 s1**、高）。画像にはタイミングの情報がないため、自分で設定するまでタイミングは「低」と表示されます。

- シートをドロップし、**切り出し**と**アニメーション**の判定（既定は1行1アニメーション）を確認して**適用**を押します。
- タイムラインでタグ名を変え、フレームごと、または選択範囲まとめて長さをミリ秒で入力します。
- **パック & 書き出し**で**Godot 4**を選び、**Godot 4 向けに書き出す**を押します。ミリ秒をFPSと相対時間に変換した`.tres`のSpriteFrames、NearestにしたAnimatedSprite2Dの`.tscn`、`.png.import`（Lossless、ミップマップなし）が出力され、Godot 4.7.2で読み込んで描画できることを確認済みです。
- 制限：AnimatedSprite2Dはノードごとにオフセットが1つなので、シーンでは最初のフレームのピボットを使います（すべてのピボットはリソースのメタデータに残ります）。Godotプリセットはフレームを回転させず、Godot 3では読み込めません。
:::

![サムライのシートをドロップした直後のスプライト作業画面。48×48のグリッドで番号付きの60フレーム、確信度87%の切り出し判定と代替案が表示されています](shot:studio-sprite-import "Nerulio Studio：切り出す前に、インポートパネルが自動判定ごとの確信度とワンクリックで選べる代替案を表示します。")

## よくある質問 {#faq}

### Godotのスプライトシートのダイアログはなぜいつも4×4で始まるのですか？

**Select Frames**ダイアログは、新しいシートのピクセルサイズが直前のシートと違うと、4×4・Separation 0・Offset 0にリセットされます。画像ごとにグリッド設定を保存しないので、シートごとに**Size**と**Separation**を入力するか、**Auto Slice**（Godot 4.4以降）を試して結果を確認してください。

### Godot 4で1フレームだけ表示時間を変えるには？

SpriteFramesパネルでそのフレームを選び、**Frame Duration**を変更します。値は相対値で、2.0なら同じFPSの1.0のフレームより2倍長く表示されます。ミリ秒から換算するときは`duration = ms × FPS ÷ 1000`を使います。

### スプライトアニメーションにはAnimatedSprite2DとAnimationPlayerのどちらを使うべきですか？

待機・走り・ジャンプのような単純なループならAnimatedSprite2Dが手早く作れます。同じタイムラインで当たり判定、サウンド、オフセット、メソッド呼び出しも決まったフレームに合わせたいなら、Sprite2DとAnimationPlayerを使います。

### 切り出したフレームがぼやけるのはなぜですか？

フィルターはシートではなくノードに設定されます。プロジェクトの既定値はLinearなので、**Rendering → Textures → Canvas Textures → Default Texture Filter**を**Nearest**にするか、ノードの**Texture → Filter**をNearestにしてください。

### Godot 4でAsepriteファイルを直接アニメーションに使えますか？

いいえ。Godotには`.aseprite`のインポート機能が組み込まれていません。Asepriteのコマンドラインを呼び出すプラグインを使うか、AsepriteからPNGシートとJSONを書き出すか、ブラウザーで変換してください。[Godot・Unity・PhaserでAsepriteファイルを使う](guide:aseprite-files-godot-unity-phaser)を参照してください。

## 出典 {#sources}

- [2D sprite animation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_sprite_animation.html) — Godot 4.7 マニュアル
- [AnimatedSprite2D](https://docs.godotengine.org/en/4.7/classes/class_animatedsprite2d.html) — Godot 4.7 クラスリファレンス
- [SpriteFrames](https://docs.godotengine.org/en/4.7/classes/class_spriteframes.html) — Godot 4.7 クラスリファレンス（相対フレーム時間、LoopMode）
- [Sprite2D](https://docs.godotengine.org/en/4.7/classes/class_sprite2d.html) — Godot 4.7 クラスリファレンス（hframes、vframes、frame_coords）
- [Animation](https://docs.godotengine.org/en/4.7/classes/class_animation.html) — Godot 4.7 クラスリファレンス（値トラックの更新モード）
- [ProjectSettings: default_texture_filter](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html#class-projectsettings-property-rendering-textures-canvas-textures-default-texture-filter) — Godot 4.7
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html) — Godot 4.7 マニュアル
- [sprite_frames_editor_plugin.cpp（4.7.2-stable）](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/scene/sprite_frames_editor_plugin.cpp) — Select Framesダイアログのソース（4×4リセット、Auto Slice、Frame Order）
