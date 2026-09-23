PixiJS 8では、スプライトシートのJSONを `await Assets.load('hero.json')` に渡して読み込みます。すると `meta.image` に書かれた画像も読み込まれ、`Spritesheet` が返ります。`sheet.textures` にはフレームごとのテクスチャが、`sheet.animations` にはJSONの `animations` の項目ごとにテクスチャの配列が入っています。その配列を `new AnimatedSprite(...)` に渡し、`animationSpeed`（60Hzの1ティックあたりのフレーム数なので、毎秒6フレームなら `6 / 60`）を設定して `play()` を呼びます。ドット絵の場合は、何かを読み込む前に `TextureSource.defaultOptions.scaleMode = 'nearest'` を設定します。

以下のコードはすべてPixiJS 8.21.0（WebGLレンダラー、Chromium）で実行しました。本文の計測値もそのときのものです。

## PixiJSが読むスプライトシートJSON {#json-format}

PixiJS 8が読むのはTexturePackerの「JSON hash」形式で、`frames` はフレーム名をキーにしたオブジェクトです。アニメーションに関わる任意のフィールドもいくつか読みます。

```json
{
  "frames": {
    "green_walk_0": {
      "frame": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "sourceSize": { "w": 24, "h": 24 },
      "anchor": { "x": 0.5, "y": 1 }
    },
    "green_walk_1": { "frame": { "x": 25, "y": 0, "w": 24, "h": 24 }, "anchor": { "x": 0.5, "y": 1 } }
  },
  "animations": {
    "green_walk": ["green_walk_0", "green_walk_1"]
  },
  "meta": { "image": "hero.png", "size": { "w": 224, "h": 74 }, "scale": "1" }
}
```

| フィールド | PixiJSでの扱い |
|---|---|
| `frames[name].frame` | ページ上の矩形。`rotated` のフレームは、PixiJSが幅と高さを自動で入れ替えます |
| `spriteSourceSize`, `sourceSize` | トリミングされたフレームを元の大きさの枠の中に戻します |
| `anchor` | `texture.defaultAnchor` になり、そのテクスチャから作ったSpriteの初期アンカーになります |
| `animations` | 名前 → 再生順のフレーム名。`sheet.animations` になります |
| `meta.scale` | テクスチャの解像度を決めます。`"2"` は@2xの画像という意味です（後述） |
| `meta.related_multi_packs` | 同じアトラスの別のJSONファイル。自動で一緒に読み込まれます |

汎用のJSONエクスポーターの多くは `animations` を出力しません。これがないと `sheet.animations` は空になるので、フレームの一覧を自分で作る必要があります。PixiJSのAPIドキュメントにも、既定のアンカー、9スライスの境界、アニメーションのグループ化は「現在TexturePackerだけが対応している」と書かれています。後で紹介するNerulioのPixiJS書き出しも、この3つをすべて出力します。Aseprite JSONはフレームの集まりとしては問題なく読めますが、PixiJSがAsepriteの `frameTags` をアニメーションにしてくれることはありません。

## スプライトシートを読み込んでアニメーションを再生する {#load-and-play}

:::steps
1. **animations付きのJSON hashで書き出します。** PNGとJSONは同じフォルダーに置きます。`meta.image` はJSONファイルからの相対パスとして解決されます。
2. **既定のフィルターをnearestにします（ドット絵の場合）。** 最初の `Assets.load` より前に `TextureSource.defaultOptions.scaleMode = 'nearest'` を設定します。この設定は、実行後に作られるテクスチャにだけ効きます。
3. **アプリケーションを作ります。** `const app = new Application(); await app.init({ width, height, roundPixels: true });` を実行し、`app.canvas` をページに追加します。v8では `init` が非同期になり、`app.view` の代わりに `app.canvas` を使います。
4. **JSONを読み込みます。** `const sheet = await Assets.load('assets/hero.json')`。画像を取得し、フレームを解析して `Spritesheet` を返します。
5. **AnimatedSpriteを作ります。** `const walk = new AnimatedSprite(sheet.animations.green_walk)`。毎秒6フレームなら `walk.animationSpeed = 6 / 60` にして、`walk.play()` を呼びます。`autoPlay` の既定値はfalseなので、`play()` を呼ばないと最初のフレームしか表示されません。
6. **配置してステージに追加します。** 倍率は整数（`walk.scale.set(3)`）にして位置を決めます。アンカーはJSONから設定済みです。JSONにアンカーがなければ左上（0, 0）が基準になります。
:::

```js
// main.js — PixiJS 8
import { Application, Assets, AnimatedSprite, TextureSource } from 'pixi.js';

// ドット絵：これ以降に作られるテクスチャソースはすべて 'nearest' でサンプリング
TextureSource.defaultOptions.scaleMode = 'nearest';

const app = new Application();
await app.init({ width: 720, height: 290, background: '#1b2030', roundPixels: true });
document.body.appendChild(app.canvas);

const sheet = await Assets.load('assets/hero.json'); // hero.png も読み込んで解析する
const walk = new AnimatedSprite(sheet.animations.green_walk);
walk.animationSpeed = 6 / 60; // 60ティック基準で毎秒6フレーム
walk.scale.set(3);
walk.position.set(50, 110);
walk.play();
app.stage.addChild(walk);
```

![PixiJSのテスト画面：スプライトシートのアニメーション、meta.scaleが正しい@2xシートと誤った@2xシート、linearとnearestで描いた同じフレーム](shot:engine-pixi-spritesheet "PixiJS 8.21.0（WebGL）で描画。上：JSONのアンカーで足元をそろえたAnimatedSprite、meta.scaleが2の@2xシート（同じ大きさ）と1のシート（2倍の大きさ）。下：'linear' と 'nearest'。素材：Kenney（CC0）。")

## 速度・ループ・フレームごとの時間 {#playback}

- **`animationSpeed`** は、60Hzのティック1回あたりに進むフレーム数で、ティッカーの `deltaTime` で補正されます。そのためモニターのリフレッシュレートに関係なく、毎秒のフレーム数は `animationSpeed × 60` です。テストでは `6 / 60` のとき、平均166.6msごとにフレームが切り替わりました。
- **1回だけ再生するアニメーション：** `new AnimatedSprite({ textures, animationSpeed: 0.1, loop: false, autoPlay: true, onComplete: () => … })`。オプションオブジェクトにはSpriteのオプション（`anchor`、`position`…）もそのまま書けます。テストでは `onComplete` がちょうど1回呼ばれ、スプライトは最後のフレームで止まって `playing === false` になりました。
- **そのほかのフック：** `onFrameChange(frame)` はテクスチャが変わるたび、`onLoop()` はループするアニメーションが先頭に戻ったときに呼ばれます。`gotoAndStop(n)` と `gotoAndPlay(n)` でフレーム `n` に移動でき、`animationSpeed` を負の値にすると逆再生になります。
- **フレームごとの時間：** テクスチャの代わりに `{ texture, time }` オブジェクトを渡します。`time` の単位は**ミリ秒**です。テストでは `[{ texture: a, time: 300 }, { texture: b, time: 100 }]` がそれぞれ300ms、100ms表示されました。この時間にも `animationSpeed` が掛かるので、実時間どおりに再生するなら1のままにします。

```js
// 最初のフレームを長めに見せる：時間はミリ秒
const hit = new AnimatedSprite([
  { texture: sheet.textures.blue_walk_0, time: 300 },
  { texture: sheet.textures.blue_walk_1, time: 100 }
]);
hit.play();
```

Aseprite JSONの表示時間を使いたい場合は、`sheet.data.frames[name].duration` に残っている各フレームの `duration` から `{ texture, time }` のリストを作ります。

## ドット絵：v8のscaleMode 'nearest' {#pixel-art}

PixiJSのテクスチャは既定で `'linear'` 補間なので、拡大した途端にドット絵がぼやけます（上の画像の左下）。v7の名前はv8ではなくなりました。`SCALE_MODES.NEAREST` は文字列の `'nearest'` になり、`BaseTexture` もありません。設定方法は3つです。

- **全体に適用：** 読み込み前に `TextureSource.defaultOptions.scaleMode = 'nearest'`。
- **1つのアセットだけに適用：** `await Assets.load({ src: 'assets/hero.json', data: { textureOptions: { scaleMode: 'nearest' } } })`。スプライトシートのローダーが `textureOptions` を画像にそのまま渡します。テストでは、そのアセットに限ってグローバルの既定値より優先されました。
- **読み込み後に適用：** `sheet.textureSource.scaleMode = 'nearest'`、テクスチャ1つなら `texture.source.scaleMode`。1枚のシートのフレームはすべて同じソースを共有しています。

あわせて `app.init` に `roundPixels: true` を渡してスプライトを整数ピクセルの位置に描かせ、倍率は整数にします。CSSでの拡大や `devicePixelRatio` など、ブラウザ側で起きるぼやけは[ブラウザでドット絵をくっきり表示する：Phaser・PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi)で扱っています。

## @2xシートとmeta.scale {#resolution}

v8では `meta.scale` がシートのテクスチャソースの解像度を直接決めます。JSONに `"scale": "2"` と書かれた@2xシートは、画像の48×48ピクセルを24×24のテクスチャとして扱います。そのため@1xのシートと同じ大きさで、より細かく描かれます。同じ画像に `"scale": "1"` と書くとテクスチャが48×48になり、すべてのスプライトが**2倍の大きさ**で描かれました（上の画像の右上）。v8に上げたらHDのアトラスが急に2倍に見える、という場合はまず `meta.scale` を確認してください。ファイル名に `@2x` があっても `meta.scale` のほうが優先されます。

端末に合ったバージョンをPixiJSに選ばせるには、ファイル名を `hero@1x.json`、`hero@2x.json` にして解像度のパターンを使います。

```js
await Assets.init({ texturePreference: { resolution: Math.min(2, window.devicePixelRatio) } });
Assets.add({ alias: 'hero', src: 'assets/hero@{1,2}x.json' });
const sheet = await Assets.load('hero'); // 2x の画面では hero@2x.json
```

`Assets.init` は最初の `Assets.load` より前に実行する必要があります。テストで優先解像度を2にすると `hero@2x.json` が読み込まれ、テクスチャの大きさは24×24のままでした。

## 複数ページのシート {#multipack}

アトラスが複数ページに分かれると、ページごとにJSONがあり、`meta.related_multi_packs` にほかのJSONファイルが並びます。1つ目を読み込むと残りも読み込まれ（`sheet.linkedSheets`）、すべてのフレーム名がテクスチャキャッシュに登録されます。ただし落とし穴があります。**`sheet.animations` は自分のページにあるフレームしか解決しません。** ページ0に書かれたアニメーションがページ1のフレームを使っていると、`undefined` だらけの配列になりました。こうしたアニメーションは、読み込み完了後にキャッシュから作ります。

```js
const sheet = await Assets.load('assets/pack-0.json'); // pack-1.json も読み込まれる
const robot = new AnimatedSprite(['robot_walk_0', 'robot_walk_1', 'robot_walk_2'].map(n => Texture.from(n)));
```

v8の `Texture.from(name)` はキャッシュを見るだけです。シートの読み込みが終わる前だと `Texture.EMPTY` が返るので、`await Assets.load` の後で呼んでください。

## アンカーとピボット {#anchor}

JSONに書いたフレームの `anchor` は `texture.defaultAnchor` になります。`new Sprite(texture)` と `new AnimatedSprite(textures)` は、最初のテクスチャからこの値を受け取ります。テストでは、JSONのアンカーを `{ "x": 0.5, "y": 1 }` にするとすべてのキャラクターの足元が指定位置にそろいました。フレームごとにピボットが違う場合（剣を振る、しゃがむなど）は `updateAnchor: true` を渡し、フレームが変わるたびにアンカーを取り直させます。自分で設定した `anchor` はJSONの値より優先されますが、`updateAnchor` が有効なら次のフレーム切り替えで上書きされます。ピボットを足元や腰に置く理由は[2Dアニメーションの当たり判定とピボット](guide:hitboxes-pivots-2d-animation)で説明しています。

## よくあるトラブル {#troubleshooting}

- **何も表示されない、`Texture.EMPTY` になる：** `await Assets.load` が終わる前にテクスチャを作ったか、フレーム名が間違っています。v8の `Texture.from` はURLを読み込みません。
- **最初のフレームしか表示されない：** `play()` を呼ぶか、`autoPlay: true` を渡してください。
- **アニメーションが速すぎる：** `animationSpeed` は毎秒のフレーム数ではありません。`fps / 60` を使ってください。FrameObjectの `time` は秒ではなくミリ秒です。
- **HDのスプライトが2倍の大きさになる：** `meta.scale` が画像と合っていません。
- **ドット絵がぼやける、ちらつく：** 読み込み前に `'nearest'` を設定し、`roundPixels: true` と整数の倍率を使ってください。
- **フレームの端に隣の絵の線がにじむ：** 1〜2pxのパディングかエクストルードを付けてパックしてください（[原因の説明](guide:tile-seams-texture-bleeding-padding-extrude)）。

:::nerulio ws=sprite
NerulioのStudioは、PixiJS用のスプライトシートをブラウザの中で作ります。ファイルがアップロードされることはありません。Spriteワークスペースにシート、個別のフレーム画像、GIF、`.aseprite` ファイルを読み込むと、格子を検出して信頼度と別の候補を表示します。そのうえでアニメーションのタグを付け、フレームごとの時間を決め、フレームごとにピボットを置きます。Pack & Exportが書き出すJSONは、Nerulioのエンジンテストで PixiJS 8.21が読み込んで描画することを確認済みです。回転して格納したフレームや複数ページのシートも含みます。

- **Sprite** タブ：ファイルをドロップし、検出された格子を確認して **Apply** を押します。タグのレーンでアニメーションに名前を付け、**P** でピボットを置きます。
- **Pack & Export** タブ：**PixiJS 8** を選びます。再生順の `animations`、ピボットから設定した `anchor`、複数ページ用の `related_multi_packs`、@2xや@0.5xのバリエーションごとに合わせた `meta.scale` を含むスプライトシートJSONが出力されます。
- フレームごとの時間（ms）は `meta.nerulio.animations` に入っているので、そのまま `{ texture, time }` のフレームを作れます。同梱のREADMEに、それを使う3行のコードがあります。
:::

![シートをドロップした直後のNerulioのSpriteワークスペース：検出した格子と信頼度、切り出したフレーム](shot:studio-sprite-import "NerulioのSpriteワークスペースは、切り出す前に格子を信頼度付きで提案します。")

## よくある質問 {#faq}

### PixiJS 8でスプライトシートのアニメーションを再生するには？ {#faq-play-animation}

`const sheet = await Assets.load('hero.json')` でJSONを読み込み、`const anim = new AnimatedSprite(sheet.animations.walk)` を作ります。`anim.animationSpeed = fps / 60` を設定して `anim.play()` を呼び、ステージに追加します。JSONに `animations` がない場合は、`sheet.textures` からテクスチャの配列を自分で作ります。

### PixiJSでドット絵がぼやけるのはなぜ？ {#faq-blurry}

テクスチャの既定の補間が `'linear'` だからです。読み込み前なら `TextureSource.defaultOptions.scaleMode = 'nearest'`、読み込み後なら `sheet.textureSource.scaleMode = 'nearest'` を設定し、`roundPixels: true` と整数の倍率を使います。v7の `SCALE_MODES.NEAREST` はv8にはありません。

### PixiJS 8で@2xのスプライトシートが2倍の大きさになるのはなぜ？ {#faq-2x-double-size}

PixiJS 8はテクスチャの解像度を `meta.scale` から取ります。@2xの画像なのにJSONが `"scale": "1"` だと1xとして扱われ、すべてのフレームが2倍の大きさになります。そのJSONを `"scale": "2"` にしてください。

### PixiJSでフレームごとに表示時間を変えるには？ {#faq-frame-duration}

テクスチャの代わりにオブジェクトを渡します：`new AnimatedSprite([{ texture, time: 300 }, { texture: next, time: 100 }])`。`time` はミリ秒で、これにも `animationSpeed` が掛かります。

### 複数ページのスプライトシートでアニメーションがundefinedになるのはなぜ？ {#faq-multipack-undefined}

`sheet.animations` は自分のページのフレームしか探しません。ほかのページのフレームはテクスチャキャッシュにあるので、`await Assets.load` の後に `names.map(n => Texture.from(n))` でアニメーションを作るか、1つのアニメーションを1つのページにまとめてください。

## 参考資料 {#sources}

- [PixiJS API：Spritesheet](https://pixijs.download/release/docs/assets.Spritesheet.html) — JSON形式、`animations`、アンカー、TexturePackerについての記述（v8リリースのドキュメント）
- [PixiJS API：AnimatedSprite](https://pixijs.download/release/docs/scene.AnimatedSprite.html) — `animationSpeed`、`loop`、`onComplete`、`updateAnchor`、FrameObject
- [PixiJSガイド：Assets](https://pixijs.com/8.x/guides/components/assets)、[Resolver](https://pixijs.com/8.x/guides/components/assets/resolver) — `Assets.load`、`Assets.init`、解像度パターン（8.x）
- [PixiJSガイド：Textures](https://pixijs.com/8.x/guides/components/textures) — `TextureSource`、`scaleMode`（8.x）
- [PixiJS v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8) — `SCALE_MODES.NEAREST` → `'nearest'`、非同期の `app.init`、`app.canvas`
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — テストに使ったCC0素材
