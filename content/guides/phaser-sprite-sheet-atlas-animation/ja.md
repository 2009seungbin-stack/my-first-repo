Phaserでは、コマのサイズがそろったスプライトシートを `this.load.spritesheet(key, url, { frameWidth, frameHeight, margin, spacing })` で読み込み、`this.anims.create({ frames: this.anims.generateFrameNumbers(key, { start, end }) })` でアニメーションにします。パック済みのアトラス（TexturePacker形式のJSON、hashまたはarray）は `this.load.atlas` と `generateFrameNames`、Asepriteの書き出しは `this.load.aseprite` で読み込んで `this.anims.createFromAseprite` でアニメーションを作ります。同じコードがPhaser 3.90とPhaser 4でそのまま動きます。ドット絵をぼやけさせないために、ゲーム設定に `pixelArt: true` を入れます。

このページのコードはすべてPhaser 3.90.0とPhaser 4.2.1（WebGL、Chromium）で実際に動かして確認しました。2つのバージョンが描いたテスト画面はピクセル単位で一致しました。

## ファイルの種類とローダー {#which-loader}

| 手元のファイル | ローダー | フレームのキー | アニメーション用ヘルパー |
|---|---|---|---|
| PNG 1枚、全コマ同じサイズ | `load.spritesheet` | 数字 0, 1, 2… | `generateFrameNumbers` |
| PNG + TexturePacker形式のJSON（hash/array） | `load.atlas` | JSON内の名前 | `generateFrameNames` |
| 複数のPNGページ + `textures` 配列を持つJSON 1つ | `load.multiatlas` | JSON内の名前 | `generateFrameNames` |
| Asepriteから書き出したPNG + JSON | `load.aseprite` | `"0"`, `"1"`… | `createFromAseprite` |
| JSONで保存したアニメーション定義 | `load.json` | （任意のテクスチャ） | `anims.fromJSON` |

最初は格子状のシートがいちばん簡単です。フレームのサイズがばらばらになったとき、透明な余白をトリミングしたいとき、複数のキャラクターを1枚のテクスチャにまとめたいときはアトラスが向いています。違いは[スプライトシートとテクスチャアトラスの違い](guide:sprite-sheet-vs-texture-atlas)で詳しく説明しています。

## スプライトシートを読み込んで再生する {#load-and-play}

:::steps
1. **格子を測ります。** PNGを開き、コマのサイズ、シート全体を囲む余白（`margin`）、コマとコマの間隔（`spacing`）を確認します。下の例で使うKenneyのPixel Platformerのキャラクターは24×24のコマで、間隔1px、外周の余白0です。
2. **ドット絵向けの設定を有効にします。** ゲーム設定に `pixelArt: true` を入れます。テクスチャがニアレストネイバー（nearest）補間になり、アンチエイリアスが切れ、座標が整数に丸められます。
3. **`preload` でシートを読み込みます。** `this.load.spritesheet('chars', 'assets/characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1, margin: 0 })` を呼びます。フレーム番号は左から右、上から下の順に0から振られます。
4. **`create` でアニメーションを作ります。** `this.anims.create({ key: 'green-walk', frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }), frameRate: 6, repeat: -1 })`。`repeat: -1` は無限ループです。
5. **スプライトを置いて再生します。** `this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk')`。元の1ピクセルが画面の同じ数のピクセルを覆うよう、倍率は2、3、4のような整数にします。
6. **コマがおかしいときは切り出し結果を確かめます。** `this.textures.get('chars').frameTotal` は「列数 × 行数 + 1」になるはずです（Phaserは画像全体を表す `__BASE` フレームを1つ追加します）。この例では 9 × 3 + 1 = 28 です。
:::

実際に動かしたシーンの全体です。

```js
// main.js — Phaser 3.90 と Phaser 4.x でそのまま動く
function preload() {
  // 24x24 のコマ、コマ間 1px、外周の余白なし
  this.load.spritesheet('chars', 'assets/characters.png', {
    frameWidth: 24,
    frameHeight: 24,
    spacing: 1,
    margin: 0
  });
}

function create() {
  this.anims.create({
    key: 'green-walk',
    frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }),
    frameRate: 6,
    repeat: -1
  });
  // 順番は自由、同じコマの繰り返しも可: 15, 16, 17, 16 と回る待機モーション
  this.anims.create({
    key: 'spike-idle',
    frames: this.anims.generateFrameNumbers('chars', { frames: [15, 16, 17, 16] }),
    frameRate: 8,
    repeat: -1
  });
  this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk');
  this.add.sprite(200, 100, 'chars', 15).setScale(3).play('spike-idle');
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 720,
  height: 310,
  pixelArt: true, // nearest 補間、アンチエイリアスなし、座標の丸め
  scene: { preload, create }
});
```

![Phaserのテスト画面：spacingあり・なしで切り出したシートと、5種類のローダーで作ったアニメーション](shot:engine-phaser-spritesheet "Phaser 4.2.1（WebGL）で pixelArt: true、3倍で描画。Phaser 3.90.0も同じ画像を描きました。素材：Kenney（CC0）。")

## margin・spacing・startFrame・endFrame {#spritesheet-config}

Phaserは列数を `floor((width − margin + spacing) / (frameWidth + spacing))` で求め、行数も同じように数えます。各コマは前のコマから `frameWidth + spacing` だけ進んだ位置から始まります。コマ間に隙間があるシートで `spacing` を指定し忘れると、フレームごとに本来の位置より1pxずつ左から切り出されていきます。テスト用シートのフレーム8はx = 200ではなく192から始まりました。上の画像の中段で少しずつずれていくのがこれです。最初のコマは正しいのに後ろほどずれるならspacing、格子全体がまとめてずれているならmarginを直します。

- `frameHeight` を省略すると `frameWidth` と同じ値になります。正方形のコマなら `frameWidth` だけで足ります。
- `startFrame` と `endFrame` はシートの一部だけを使うための設定です。`endFrame` は**格子全体でのインデックスで、そのフレームも含みます**。APIドキュメントには「取り出すフレームの総数」とありますが、実際の動作は違います。残したフレームは**0から振り直されます**。`startFrame: 9, endFrame: 10` ならフレーム0と1（と `__BASE`）ができ、フレーム0は (0, 25) のコマです。
- `generateFrameNumbers` は `start`、`end`（既定値の−1は最後のフレーム）、`first`（先頭に1枚足すフレーム）、または順番を直接書く `frames` 配列を受け取ります。

## テクスチャアトラス：JSON hashとJSON array {#atlas-hash-array}

TexturePackerをはじめ多くのパッカーは、2種類のJSONのどちらかを書き出します。**hash**形式は `frames` がフレーム名をキーにしたオブジェクト、**array**形式は `frames` が `filename` を持つオブジェクトの配列です。どちらなのかをPhaserに伝える必要はありません。`load.atlas` が `frames` が配列かどうかを見て、合うパーサーを選びます。テストでは、どちらのファイルからも同じ10フレームと `__BASE` ができました。

```js
// preload
this.load.atlas('chars-atlas', 'assets/characters.png', 'assets/characters.json');

// create — フレーム名は "blue/walk_0001", "blue/walk_0002"
this.anims.create({
  key: 'blue-walk',
  frames: this.anims.generateFrameNames('chars-atlas', {
    prefix: 'blue/walk_',
    start: 1,
    end: 2,
    zeroPad: 4 // 1 -> "0001"
  }),
  frameRate: 6,
  repeat: -1
});
```

`generateFrameNames` は名前を「`prefix` + `zeroPad` 桁にゼロ埋めした数字 + `suffix`」で組み立てます。**存在しない名前は飛ばし**、コンソールに警告（"Frame … not found in texture …"）を出すだけです。アニメーションのコマが足りないときは、ほぼ間違いなくprefix、`.png` のようなsuffix、または `zeroPad` がJSONと合っていません。設定なしで `generateFrameNames('chars-atlas')` と呼ぶと、アトラスの全フレームが返ります。

**複数ページのアトラス。** パッカーが複数のページに分けた場合は、各ページの画像とそのフレームを `textures` 配列に並べたJSONを1つ書き出します。`this.load.multiatlas('chars-multi', 'assets/characters-multi.json', 'assets/')` で読み込みます。3番目の引数はページ画像のあるフォルダーです。あとは1枚のアトラスと同じようにフレーム名を使えます。1つのアニメーションが複数ページのフレームを使っても問題ありません。

> **回転：** Nerulioのエンジンテストでは、TexturePacker形式で回転して格納したフレームが、Phaser 3.90と4.2のどちらでも反転して描かれました。自分で確認していない限り、Phaser向けには回転をオフにしてパックしてください。

## Asepriteファイル {#aseprite}

Asepriteで **File › Export Sprite Sheet** を開きます。Outputタブで **JSON Data**（HashかArray）を有効にし、Metaの **Tags** はチェックしたままにして、**Item Filename** を `{frame}` にします。コマンドラインなら `aseprite -b hero.aseprite --sheet hero.png --data hero.json --format json-hash --list-tags --filename-format "{frame}"` です。この `{frame}` が重要です。`createFromAseprite` は `"0"`, `"1"`… というキーでフレームを探すので、`hero 0.aseprite` のようなAsepriteの既定の名前のままだと、どのアニメーションにもフレームが入りません。

```js
// preload
this.load.aseprite('aliens', 'assets/aliens.png', 'assets/aliens.json');

// create — Asepriteのタグごとに、タグ名のアニメーションが1つできる
this.anims.createFromAseprite('aliens');
this.add.sprite(300, 100, 'aliens').setScale(3).play({ key: 'pink-walk', repeat: -1 });
```

Aseprite 1.3.18で保存したファイルで確認できたこと：

- タグごとに、タグ名（大文字・小文字を区別）のアニメーションが1つできます。タグ名の配列を渡すと、そのタグだけを作ります。
- フレームごとの表示時間が保たれます。200msと100msに設定したフレームは、実際に200ms、100ms表示されました。
- **ping-pong** のタグは `yoyo: true` になり、reverseのタグは逆順になります。
- アニメーションは**1回だけ再生されます**。`createFromAseprite` は `repeat` を設定しないので、`play('pink-walk')` は1周で止まります。ループさせるには、上のように再生時に `repeat: -1` を渡します。

`.aseprite` をほかのエンジンに持っていく方法は、[AsepriteファイルをGodot・Unity・Phaserで使う](guide:aseprite-files-godot-unity-phaser)にまとめています。

## フレームごとの時間はframeRateを置き換える {#frame-durations}

フレームにはミリ秒単位の `duration` を個別に持たせられます。例：`frames: [{ key: 'chars', frame: 0, duration: 300 }, { key: 'chars', frame: 1 }]`。Phaserのアニメーションのドキュメントには、この値は `frameRate` から決まるフレーム時間に*加算される*と書かれています。しかし3.90.0と4.2.1ではそうなりませんでした。`frameRate: 10`（100ms）のとき、`duration: 300` のフレームは**400msではなく300ms**表示され、durationのないフレームは100msでした。どちらのバージョンも同じコード（`currentFrame.duration || msPerFrame`）で動いています。例外が1つあります。`play({ key, frameRate })` で `frameRate` を上書きすると、フレームごとの時間はすべて無視されます。`frameRate: 20` で再生すると、どちらのフレームも50msでした。

## アニメーション定義をJSONで持つ {#anims-json}

`this.anims.toJSON()` はグローバルなアニメーションを `{ anims: [...], globalTimeScale }` の形で書き出し、`this.anims.fromJSON(data)` はそこからアニメーションを作り直します。アニメーションの一覧をコードではなくアート側のツールで管理できます。

```js
// preload
this.load.json('anims', 'assets/anims.json');
// create — JSONが参照するテクスチャは先に読み込んでおく
this.anims.fromJSON(this.cache.json.get('anims'));
```

各要素のフィールドは `anims.create` に渡すオブジェクトと同じです。アニメーションはグローバルなので、シーンごとではなく一度だけ作ります。

## ドット絵とPhaser 4での違い {#phaser-4}

スプライトシートとアニメーションのAPIは、Phaser 4で何も変わっていません。このページの呼び出しは3.90と4.2でまったく同じです。違いは描画まわりにあります。

- **`pixelArt: true`** の効果は両バージョンで同じです。`antialias` と `antialiasGL` がfalseになり、`roundPixels` がtrueになります（両バージョンで `game.config` から読み出して確認）。`pixelArt` を指定しない場合、`roundPixels` の既定値はfalseです。
- **Phaser 4は安全なときだけ丸めます。** 既定（`vertexRoundMode` の `"safeAuto"`）では、拡大縮小も回転もしていないオブジェクトを、`roundPixels` が有効なカメラで描くときだけ座標を丸めます。拡大したスプライトもnearest補間なのでくっきりしたままですが、座標は整数にそろえられません。
- **`smoothPixelArt: true`**（Phaser 4で追加）は、テクセルを四角く保ったまま境界だけをなめらかにします。整数でない倍率での拡大や回転を伴うドット絵向けで、有効にすると `pixelArt` はオフになります。
- **`this.load.atlasPCT`**（Phaser 4で追加）はPhaser Compact Textureアトラスを読み込みます。JSONよりずっと小さい行単位のテキスト形式です。JSONのアトラスも引き続き使えます。
- Phaser 4ではCanvasレンダラーが非推奨になりました。WebGLを使ってください（`Phaser.AUTO` はWebGLを選びます）。
- トリミングしたStarling/Sparrow XMLアトラス（`load.atlasXML`）は、Phaser 3.90では位置がずれます。Phaser 4.0で修正されました。Phaser 3ではJSONか、トリミングなしのXMLを使ってください。

コマとは関係のないぼやけ（キャンバスのCSS拡大、整数でないズーム、カメラの移動など）は、[ブラウザでドット絵をくっきり表示する：Phaser・PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi)で扱っています。

## よくあるトラブル {#troubleshooting}

- **最後の列や行が欠ける：** 画像のサイズが `margin + n × frameWidth + (n − 1) × spacing` とぴったり一致していません。サイズを確認するか、コマをそろえて書き出し直してください。
- **再生されるコマが足りない：** コンソールの "Frame … not found" 警告を確認してください。生成した名前がアトラスのキーと合っていません。
- **ぼやける、動かすとちらつく：** `pixelArt: true` を有効にし、スプライトの倍率とカメラのズームを整数に保ってください。
- **端に隣のコマの線が見える：** 1〜2pxのパディングかエクストルード（extrude）を付けてパックしてください。理由は[タイルの継ぎ目とテクスチャのにじみ](guide:tile-seams-texture-bleeding-padding-extrude)で説明しています。

:::nerulio ws=sprite
素材側の作業は、NerulioのStudioがブラウザの中で行います。ファイルが端末の外に出ることはありません。シートやコマ画像のフォルダーをSpriteワークスペースにドロップすると、marginとspacingを含めて格子を検出し、信頼度と別の候補を表示します。タイムラインでアニメーションのタグを付け、フレームごとの時間を決めたら、Pack & ExportがPhaser用のファイルを書き出します。このファイルは、Nerulioのエンジンテストで Phaser 3.90と4.2が読み込んで描画することを確認済みです。

- **Sprite** タブ：PNGをドロップし、検出された格子を確認して **Apply** を押します。次にタグのレーンをドラッグして、アニメーションごとに名前を付けます。
- **Pack & Export** タブ：**Phaser 3 / 4** を選びます。アトラスJSON（hash、ページが複数ならmultiatlas）と、`this.anims.fromJSON` 用の `<名前>.anims.json` が出力されます。時間はフレームごとのms、ping-pongは `yoyo`、ループは `repeat: -1` になります。このプリセットはフレームを回転しません。
- `load.aseprite` を使いたい場合は **Aseprite JSON**（hashまたはarray）で書き出してください。`createFromAseprite` が必要とする `"0"`, `"1"`… のキーになっています。
:::

![エンジンごとの書き出し一覧と、書き出しボタンの下の検証表示が見えるNerulioのPack & Export](shot:studio-pack-export "NerulioのStudioのPack & Export：エンジンごとに書き出しボタンがあり、読み込みを確認したエンジンのバージョンが表示されます。")

## よくある質問 {#faq}

### Phaserのload.spritesheetとload.atlasの違いは？ {#faq-spritesheet-vs-atlas}

`load.spritesheet` は1枚の画像を `frameWidth`、`frameHeight`、`margin`、`spacing` に従って同じサイズのコマに切り分け、0から番号を振ります。`load.atlas` はJSONからフレームごとの矩形を読むので、フレームのサイズが違っていても、トリミングされていても構わず、名前も付けられます。前者は `generateFrameNumbers`、後者は `generateFrameNames` と組み合わせます。

### Phaserのスプライトシートアニメーションに隣のコマが映り込むのはなぜ？ {#faq-neighbour-frame}

格子の設定が画像と合っていないためです。多いのは、コマ間に隙間があるのに `spacing` を指定しておらず、フレームごとに1pxずつずれていくケースです。`margin` の指定漏れや、`frameWidth` が1px違うこともあります。`frameTotal` が「列数 × 行数 + 1」になっているか確認してください。

### Phaser 4でスプライトシートやアニメーションの使い方は変わりましたか？ {#faq-phaser-4}

変わっていません。`load.spritesheet`、`load.atlas`、`load.multiatlas`、`load.aseprite`、`anims.create`、`generateFrameNumbers`、`generateFrameNames`、`createFromAseprite`、`fromJSON` は3.90と4.2でそのまま動きました。Phaser 4では `smoothPixelArt`、小さなPCTアトラス形式（`load.atlasPCT`）、より安全なピクセルの丸めが加わっています。

### PhaserでAsepriteのアニメーションをループさせるには？ {#faq-aseprite-loop}

`createFromAseprite` は `repeat` を指定せずにアニメーションを作るので、1回だけ再生されます。再生時に `sprite.play({ key: 'walk', repeat: -1 })` のように渡すか、作成後に `this.anims.get('walk').repeat = -1` と変更します。

### Phaserで特定のコマだけ長く表示するには？ {#faq-frame-duration}

`frames` 配列でそのフレームにミリ秒単位の `duration` を付けます。そのフレームだけ、`frameRate` から決まる時間が置き換わります（3.90と4.2で計測）。このとき `play()` に `frameRate` を渡さないでください。渡すとフレームごとの時間が無視されます。

## 参考資料 {#sources}

- [Phaserドキュメント：Loader（spritesheet、atlas、multiatlas）](https://docs.phaser.io/phaser/concepts/loader) — Phaser 4.1のドキュメント、v3.90に切り替え可能
- [Phaserドキュメント：Animations（AnimationManager、generateFrameNumbers、createFromAseprite）](https://docs.phaser.io/phaser/concepts/animations) — Phaser 4.1のドキュメント
- [Phaser v3 to v4 Migration Guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md) — round pixels、Canvasレンダラーの非推奨化
- [Phaser 4 Pixel Art Guide](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md) — `pixelArt`、`smoothPixelArt`、`vertexRoundMode`
- [Phaser 4.0.0 変更履歴](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md) — PCTアトラス、AtlasXMLのトリミング修正
- [Asepriteドキュメント：スプライトシートの書き出し](https://www.aseprite.org/docs/sprite-sheet/)、[コマンドラインインターフェース](https://www.aseprite.org/docs/cli/) — Aseprite 1.3
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — テストに使ったCC0素材
