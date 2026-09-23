**スプライトシート**は、同じサイズのコマを格子状に並べた 1 枚の画像です。セルのサイズさえ分かれば n 番目のフレームの位置を計算できるので、データファイルは要りません。**テクスチャアトラス**は、大きさの違う画像をできるだけ詰めて配置し、各フレームの矩形・トリムのオフセット・（場合によっては）90° 回転をデータファイル（JSON、XML、`.atlas`、`.tres`）に記録したものです。同じサイズの小さなアニメーションなら等間隔のスプライトシートで十分です。フレームの大きさがばらばらなとき、透明な余白が多いとき、たくさんのスプライトを 1 枚のテクスチャ・1 回のドローコールで描きたいときはアトラスを使います。どちらの場合もトリムのオフセットは必ず残してください。回転は、対象のエンジンがすべて回転フレームを読めるときだけ有効にします。PixiJS と Spine は読めますが、Phaser と Godot は読めません。

このページのエンジンの挙動は、Kenney の CC0 素材 *Space Shooter Redux* で作ったテスト用アトラスを Phaser 3.90.0、Phaser 4.2.1、PixiJS 8.21.0、Spine 4.2 の canvas ランタイム、Godot 4.7.2 で実際に読み込んで確認しました。

## スプライトシートとアトラスの違い {#difference}

| | 等間隔スプライトシート | パックしたテクスチャアトラス |
|---|---|---|
| 配置 | 同じサイズのセル（margin・spacing は任意） | 大きさ自由、パッカー（MaxRects、Skyline…）が配置 |
| データファイル | 不要（セルサイズ、margin、spacing） | 必須：矩形、トリムのオフセット、回転、ピボット |
| 透明な余白 | セルごとに残る | 切り取るのでページが小さくなる |
| エンジン側の設定 | グリッド分割（`load.spritesheet`、Godot のグリッド、Unity の *Grid By Cell Size*） | エンジンのアトラスローダーやインポーター |
| 向いている用途 | 同じサイズのドット絵キャラ、タイル | サイズの混ざったエフェクト・UI、複数キャラを 1 ページに |

どちらか一方しか使えないわけではありません。Aseprite では等間隔のストリップでアニメーションを描き、ビルド時に全ストリップのフレームを 1 枚のアトラスへパックするプロジェクトはよくあります。タイルセットは、タイルマップエディタがグリッド番号でタイルを参照するので、等間隔のままにするのが普通です（[タイルの隙間と押し出し](guide:tile-seams-texture-bleeding-padding-extrude)を参照）。

## どのエンジンでも正しく読めるアトラスを作る {#steps}

:::steps
1. **最初にページサイズを決めます。** いちばん性能の低い対象機種が読める最大ページサイズを決めます。OpenGL ES 3.0（つまり WebGL 2）が保証するのは 1 辺 2048 px までです。それより大きなサイズを使える機種も多いので、実際の上限は実行時に調べます。1 枚に収まらない場合はマルチパックを有効にします。
2. **トリムしつつ、オフセットは残します。** 透明な縁は切り取り、元のフレームサイズと位置は記録するモードを選びます（TexturePacker の *Trim*、Nerulio の *Trim (keep size and position)*）。アニメーションのフレームに crop 系のモードは使いません。
3. **すべての対象が読めないなら回転は切ります。** 回転で節約できる面積は小さく、Phaser と Godot ではエラーも出さずに表示が崩れます（[回転の表](#rotation)を参照）。
4. **サンプリングの仕方に合わせてパディングを決めます。** ニアレストフィルター・ミップマップなしのドット絵なら、シェイプパディング 2 px と押し出し 1 px で足ります。フィルタリング・拡大縮小・ミップマップを使う絵は 4〜8 px に、押し出しかアルファブリードを加えます。
5. **同じフレームは 1 回だけ保存します。** 重複検出（TexturePacker の *Detect identical sprites*、libGDX の `alias`、Nerulio の *Store identical frames once*）を有効にすると、止めのフレームや往復ループがピクセルを余分に使いません。
6. **サイズの制約を選びます。** 2 のべき乗（POT）は必要なときだけ使います。WebGL 1 でミップマップやリピートを使う場合や、古い圧縮フォーマットを使う場合です。それ以外は *Smallest* や *Any size* のほうが無駄が少なくなります。
7. **エンジン固有の形式で書き出し、標準のローダーで読み込みます。** Phaser の `this.load.atlas`、PixiJS の `Assets.load`、`AtlasTexture` で構成した Godot の `SpriteFrames`、libGDX/Spine の `.atlas` などです。
8. **すべてのフレームを元のサイズで確認します。** 単色の背景の上に各フレームを元のサイズで描き、元画像と比べます。位置のずれたトリムフレームや横倒しの回転フレームがすぐに分かります。
:::

## トリム：オフセットを残さなければならない理由 {#trimming}

トリムはパックの前に、フレームごとの透明な縁を切り取る処理です。絵が元のフレームのどこにあったかをアトラスが記録していなければ、正しく表示できません。記録がないと、歩きアニメの各フレームがそれぞれのバウンディングボックス基準で中央に寄せ直され、キャラがガタついたり足が地面から浮いたりします。TexturePacker 形式の JSON は、フレームごとに次の 3 つを持っています。

- `frame`：アトラスページ上の矩形
- `spriteSourceSize`：切り取った絵が元のフレーム内のどこにあったか（`x`、`y`）
- `sourceSize`：元のフレームのサイズ。`"trimmed": true` なら、Phaser と PixiJS は元のサイズのままであるかのようにスプライトを描きます。

テストでは 128×112 のフレームを 99×75 の宇宙船だけにトリムしました。Phaser 3.90、Phaser 4.2、PixiJS 8.21 のどれも、正しい位置にピクセル単位で同じ絵を描きました。Starling/Sparrow XML は同じ情報を `frameX`/`frameY`（負のオフセット）と `frameWidth`/`frameHeight` で持ちます。

> **Phaser 3.90 とトリムした Sparrow XML：** Phaser 3.90 の `atlasXML` パーサーは、`setTrim` にサイズを間違った順番で渡します。そのためトリムした XML フレームのサイズが、128×112 ではなく切り取った後の 99×75 として扱われます。デフォルトの中央原点（origin）を使うと、描画位置もずれます。Phaser 4.2 では修正済みです。Phaser 3 では JSON を使うか、XML をトリムなしで書き出してください。

Godot の `AtlasTexture` は同じことを `margin` で表します。position がトリムのオフセット、size が元のサイズから region のサイズを引いた値です。

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

このフレームを `Sprite2D` で描いた結果を、トリム前の元画像と比べたところ、違うピクセルは 0 でした。

crop 系のモードは別物です。*Crop, keep position* はフレーム自体を小さくし、絵がその場に留まるようにピボットを動かします。*Crop, flush position* はオフセットを捨てます。静止した小物やアイコンなら問題ありませんが、アニメーションのガタつきの典型的な原因です。ピボットについては[当たり判定とピボット](guide:hitboxes-pivots-2d-animation)で扱っています。

## 回転：回転フレームを読めるエンジンはどれか {#rotation}

回転を有効にすると、パッカーは隙間に収めるためにフレームを 90° 回して保存することがあります。エンジンは描く前にそれを元に戻さなければなりません。TexturePacker の JSON では、`"rotated": true` は時計回りに 90° 回した状態で保存されていることを表し、`frame.w`/`frame.h` は回転前（正立）のサイズです。Spine/libGDX の `.atlas` は逆向きで、`rotate: true`（または `90`）が反時計回り 90° を意味します。Starling XML の `rotated="true"` は時計回りです。

| エンジン・形式 | 回転フレームを読めるか | 確認結果 |
|---|---|---|
| PixiJS 8.21（TexturePacker JSON） | はい | 時計回りのフレームを正立で正確に描きました。対照として入れた反時計回りのフレームは崩れ、向きの規則が確認できました。 |
| Phaser 3.90・4.2（JSON hash、`atlasXML`） | いいえ | エラーなく読み込めますが、横倒しで切れた状態で描かれます。フレームサイズの 2 通りの書き方をどちらも試しました。`atlasXML` は `rotated` を完全に無視します。 |
| Spine ランタイム / libGDX `.atlas` | はい（反時計回り） | spine-canvas 4.2 は `rotate: 90` の領域を正立で描きました。libGDX のパッカーは `rotation` が既定で無効で、回転した領域はアプリ側で特別に扱う必要があると注意書きがあります。 |
| Godot 4.7 | いいえ | `AtlasTexture` のプロパティは `atlas`、`region`、`margin`、`filter_clip` だけで、回転はありません。TexturePacker の Godot 用インポーターも回転しないよう案内しています。 |
| Unity 6 | 自前の Sprite Atlas 内でのみ | *Allow Rotation* は Sprite Atlas のオプションで、マニュアルは Canvas UI では無効にするよう書いています。外部のアトラスをスプライト矩形で切り出す場合、回転は表現できません。 |
| LÖVE、Defold、GameMaker | パック済みアトラスからは不可 | LÖVE の `Quad` はただの矩形です。Defold と GameMaker は、渡した個別画像から自分でテクスチャページを作ります。 |

![同じアトラスを各エンジンが描いた結果：元フレーム、PixiJS 8.21、Phaser 3.90、Phaser 4.2](shot:engine-atlas-rotation "TexturePacker 形式の JSON アトラス 1 つを、Chromium 上の PixiJS 8.21・Phaser 3.90・Phaser 4.2 で描画した結果です。1 トリムなし、2 トリムあり、3 トリム＋時計回り 90° で保存、4 回転したレーザー。回転フレームを元に戻せたのは PixiJS だけです。素材：Kenney（CC0）。")

対象のうち 1 つでも「いいえ」があるなら、回転なしでパックしてください。ほとんどのフレームセットで、回転で減るサイズはわずかです。

## パディング、押し出し、ミップマップ {#padding}

隣のスプライトが混ざり込むのを防ぐ設定は 3 つあります。

- **ボーダーパディング：** スプライトとページの端の間の空白ピクセルです。
- **シェイプパディング：** スプライト同士の間隔です。TexturePacker のドキュメントは、OpenGL で描画するなら 2 以上を勧めています。
- **押し出し（extrude）：** スプライトの縁のピクセルを外側へ複製します。矩形のすぐ外をサンプリングしても、透明な隙間や隣の絵ではなく自分の色が返ります。Unity の *Alpha Dilation* や libGDX の `bleed` も、同じ理由で透明ピクセルの下の色を埋めます。

にじみはサンプリングが原因です。バイリニアなどの線形フィルタリングは隣のピクセルと色を混ぜ、サブピクセルのカメラ位置や整数でない拡大率は矩形の境界の外まで読みに行きます。ミップマップは段ごとに 2×2 ブロックを平均するので、2 px の隙間はミップレベル 1 で 1 テクセルになり、レベル 2 で消えます。実際に使うミップレベルが深いほど、隙間も広く取る必要があります。GameMaker のテクスチャグループはボーダーの既定値が 2 px で、ミップマップを有効にすると 8 px に固定されます。Unity の Sprite Atlas のパディング既定値は 4 px です。

| 絵とサンプリング | シェイプパディング | 押し出し / ブリード |
|---|---|---|
| ドット絵、ニアレスト、ミップマップなし、整数倍 | 2 px | 1 px（サブピクセルのカメラ位置にも対応） |
| 隙間なく敷き詰めるタイル | 2 px | 1〜2 px（継ぎ目対策） |
| 滑らかな絵、線形フィルター、ミップマップなし | 2〜4 px | 1〜2 px またはアルファブリード |
| ミップマップあり、または大きく縮小する絵 | 8 px 以上 | アルファブリード、使うミップレベルに合わせて広げたパディング |

## ページサイズ：POT、NPOT、最大テクスチャサイズ {#page-size}

- **最大サイズ。** OpenGL ES 3.0 の仕様が保証する `GL_MAX_TEXTURE_SIZE` は 2048 以上だけです。このテスト環境の Chromium は、AMD の GPU 経由で 16384、ソフトウェアレンダラーの SwiftShader で 8192 を返しました。libGDX のパッカーの既定値は 1024（「すべての端末で安全」）、TexturePacker は 2048 です。推測せず、実行時に実際の値を調べてください。
- **メモリ。** 非圧縮の RGBA8888 ページは 幅 × 高さ × 4 バイトです。2048² で 16 MiB、4096² で 64 MiB になり、半分空いた POT ページも満杯のページと同じメモリを使います。
- **2 のべき乗。** WebGL 1 は POT でないテクスチャにミップマップもリピートも使えませんが、WebGL 2 や現在のデスクトップ・モバイルの API は使えます。ブロック圧縮フォーマットは 4×4 ブロック単位なので、パッカーには *multiple of 4* の設定があります。POT は対象が必要とするときだけ使います。
- **マルチパック。** 1 ページに収まらない場合、パッカーは複数のページを書き出します。
  - Phaser は `load.multiatlas` で読み込みます。
  - PixiJS は `meta.related_multi_packs` をたどります。
  - Defold の *Max Page Size* は、`*_paged_atlas.material` のマテリアルと組み合わせると、ページが分かれても 1 回のドローコールで描けます。
  - 1 つのアニメーションは同じページにまとめてください。再生中にテクスチャが切り替わらずに済みます。

```js
// Ask the renderer instead of guessing (both lines were run in Chromium).
const phaserMax = this.game.renderer.getMaxTextureSize();                 // Phaser 3.90 / 4.2, inside a Scene
const pixiMax = app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE); // PixiJS 8, WebGL renderer
```

## ドローコールとバッチング {#batching}

GPU のドローコール 1 回でサンプリングできるのは、そのときバインドされているテクスチャだけです。次のスプライトがバインドされていないテクスチャを必要とすると、レンダラーはバッチを閉じて新しいバッチを始めます。40 種類の画像を順番に使うスプライト 200 個で、実際の WebGL ドローコール数を数えました。

| エンジン | 個別テクスチャ 40 枚 | 同じ 40 枚を 1 枚のアトラスのフレームとして |
|---|---|---|
| Phaser 3.90 | ドローコール 13 回 | 1 回 |
| Phaser 4.2 | ドローコール 13 回 | 1 回 |
| PixiJS 8.21 | ドローコール 7 回 | 1 回 |

最近の Web 向けレンダラーは 1 回のドローコールで複数のテクスチャをまとめるので、昔の解説ほどの差はありません。それでもアトラスにすれば複数回の呼び出しが 1 回になります。Unity のマニュアルも、スプライトアトラス内のスプライトは 1 回のドローコールで描けると説明しています。描画順も重要です。2 つのアトラスのスプライトが描画順で交互に並ぶとバッチが途切れるので、一緒に描くものは同じページに置いてください。

## エンジンごとのアトラス形式 {#formats}

| エンジン | パック済みアトラスの形式 | 読み込み方 |
|---|---|---|
| Phaser 3 / 4 | TexturePacker JSON hash・array、マルチアトラス JSON、Starling/Sparrow XML | `load.atlas`、`load.multiatlas`、`load.atlasXML`（[Phaser のガイド](guide:phaser-sprite-sheet-atlas-animation)） |
| PixiJS 8 | `animations`、`meta.scale`、`related_multi_packs` を含む TexturePacker JSON hash | `Assets.load('atlas.json')` → `Spritesheet`（[PixiJS のガイド](guide:pixijs-8-spritesheet-animation)） |
| Godot 4 | `AtlasTexture`（region + margin）で構成した `SpriteFrames`、内蔵の *Import As: TextureAtlas*、TexturePacker のプラグイン | `.tres` リソース（[Godot のガイド](guide:godot-4-sprite-sheet-animation)） |
| Unity 6 | Sprite Atlas アセット（Unity がパック）、または Sprite Mode *Multiple* の 1 枚のテクスチャとスプライト矩形 | Sprite Atlas / Sprite Editor |
| libGDX、Spine | `.atlas` テキスト（`bounds`、下端基準の `offsets`、`rotate`） | `TextureAtlas` / Spine ランタイム |
| Defold | 個別画像から Defold が作る `.atlas` | Atlas リソース（[Defold のガイド](guide:defold-atlas-tile-source-flipbook)） |

Godot 内蔵の *TextureAtlas* インポートモードも覚えておくと便利です。複数の PNG に同じ `atlas_file` を指定すると、Godot が 1 枚の画像にパックし、それぞれを `AtlasTexture` にします。`trim_alpha_border_from_region` は既定で有効で、*Mesh* モードは大きくてほとんど透明なスプライト向けにポリゴンメッシュを作ります。

:::nerulio ws=pack
Nerulio の Pack & Export ワークスペースは、プロジェクトの全フレームをブラウザ内でパックします。何もアップロードされず、同じフレームがすべてのエンジン向けに書き出されます。

- **パッカー。** MaxRects、Skyline、Guillotine から選ぶか、全部を試させることができます。ページサイズは POT、正方形、固定、最小から選べ、マルチパックは最大 64 ページです。
- **トリムモード。** *None*、*Trim (keep size and position)*、*Crop, keep position*、*Crop* と、アルファのしきい値があります。
- **パディングと同一フレーム。** シェイプパディング（既定 2 px）、ボーダーパディング、押し出しを設定できます。*Store identical frames once* は既定で有効です。スケール違い（@0.5x〜@4x）はニアレスト補間なので、ドット絵がぼやけません。
- **エンジン別プリセット。** 回転を読めないエンジン（Godot、Unity、Phaser、LÖVE）では回転を切り、PixiJS と Spine では許可します。
- **書き出しの検証表示。** 形式ごとに、どう検証したかを「Loaded in Godot 4.7.2」のように表示します。GameMaker 用ストリップは、テストできる GameMaker がないため UNVERIFIED と表示されます。
:::

![Nerulio Pack & Export：トリム・パディング・押し出しの設定と使用率が見えるパック済みアトラスページ](shot:studio-pack-atlas "Nerulio Pack & Export：パックしたページ 1 枚、フレームごとのトリムサイズ、それを作った設定。")

![Nerulio Pack & Export：Loaded in Godot 4.7.2 の検証表示があるエンジン一覧](shot:studio-pack-export "書き出し先ごとに検証方法が表示され、GameMaker は UNVERIFIED と表示されます。")

## よくある質問 {#faq}

### スプライトシートとテクスチャアトラスは同じものですか？

言葉としては混同されがちですが、スプライトシートは普通、データファイル不要の等間隔の格子を指します。テクスチャアトラスは、大きさの違う画像を詰めて配置し、フレームごとの矩形とオフセットをデータファイルに持つものを指します。どちらも多くの画像を 1 枚のテクスチャにまとめます。

### フレームをパックしたらキャラがガタつくのはなぜですか？

フレームを crop したときにオフセットが失われたか、ローダーがオフセットを無視しているためです。`sourceSize` と `spriteSourceSize` を残すトリムモード（Godot なら `AtlasTexture.margin`）でパックし、アニメーションのフレームには crop 系のモードを使わないでください。

### Phaser や Godot 向けに TexturePacker で回転を許可してもいいですか？

いいえ。Phaser 3.90 と 4.2 は `"rotated": true` のフレームを読み込みますが、横倒しで描きます。Godot の `AtlasTexture` には回転のプロパティがありません。PixiJS 8 と Spine/libGDX のランタイムは回転フレームを正しく読みます。

### ドット絵のパディングと押し出しはどれくらいにすべきですか？

ニアレストフィルター、ミップマップなし、整数倍の拡大なら、シェイプパディング 2 px と押し出し 1 px で足ります。押し出しは、タイルやサブピクセルのカメラ位置で描かれるスプライトで特に効きます。ミップマップを使う絵には 8 px 以上とアルファブリードが必要です。

### アトラスは最大何ピクセルまで作れますか？

OpenGL ES 3.0 と WebGL 2 が保証するのは 2048×2048 だけです。それより大きなサイズを扱える GPU も多く、このテスト環境では 16384 でした。実行時に `MAX_TEXTURE_SIZE` を読み、ローエンドのモバイルや不明なブラウザも対象にするならページは 2048 に抑えてください。

## 出典 {#sources}

- TexturePacker documentation, *Texture settings*（トリムモード、パディング、押し出し、回転、最大サイズ、マルチパック）：https://www.codeandweb.com/texturepacker/documentation/texture-settings
- libGDX wiki, *Texture packer*（設定と既定値：`paddingX`、`rotation`、`alias`、`bleed`、`maxWidth` 1024）：https://libgdx.com/wiki/tools/texture-packer
- Spine, *Atlas export format*（`bounds`、`offsets`、`rotate`）：https://esotericsoftware.com/spine-atlas-format
- Starling API, `TextureAtlas`（XML 形式、`frameX`、`rotated`）：https://doc.starling-framework.org/current/starling/textures/TextureAtlas.html
- Godot 4 クラスリファレンス, `AtlasTexture`：https://docs.godotengine.org/en/stable/classes/class_atlastexture.html
- Godot 4 クラスリファレンス, `ResourceImporterTextureAtlas`：https://docs.godotengine.org/en/stable/classes/class_resourceimportertextureatlas.html
- Godot 4 用 TexturePacker インポーター（回転は非対応）：https://github.com/CodeAndWeb/texturepacker-godot-plugin
- Unity 6 マニュアル, *Packing sprites into atlas textures*：https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/atlas-landing.html
- Unity 6 マニュアル, *Sprite Atlas Inspector window reference*：https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html
- Phaser API, `LoaderPlugin`（`atlas`、`atlasXML`、`multiatlas`）：https://docs.phaser.io/api-documentation/class/loader-loaderplugin
- PixiJS 8 ガイド, *Spritesheets*：https://pixijs.com/8.x/guides/components/sprite-sheets
- Defold マニュアル, *Atlas*（margin、inner padding、extrude borders、max page size）：https://defold.com/manuals/atlas/
- GameMaker マニュアル, *Texture Groups*（border size、mipmaps）：https://manual.gamemaker.io/monthly/en/Settings/Texture_Groups.htm
- LÖVE wiki, `love.graphics.newQuad`：https://love2d.org/wiki/love.graphics.newQuad
- MDN, *Using textures in WebGL*（WebGL 1 の NPOT 制限）：https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
- Khronos, OpenGL ES 3.0 `glGet`（`GL_MAX_TEXTURE_SIZE` は最低 2048）：https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml
