テキストを決まったサイズでしか描かないなら、**ビットマップフォント**（BMFont の `.fnt` ＋ PNG）がもっとも正確です。ドットフォントは常にこの方式で、デザインサイズの整数倍・アンチエイリアスなし・ニアレスト（最近傍）フィルタで描きます。同じテキストを拡大縮小したり、アウトラインやグローを安く付けたいなら **SDF**、大きなサイズでも角をシャープに保ちたいなら **MSDF** を使います。Godot 4.7 ではインポートオプション *Multichannel Signed Distance Field*、Unity 6 のフォントアセットは既定で SDF、PixiJS 8 は `distanceField` を含む BMFont ファイルから SDF/MSDF を読み込みます。Phaser の BitmapText は通常のビットマップのみです。

以下の画像は、すべてキャプションに書いたエンジンが実際にレンダリングしたものです。

![Godot 4.7.2 で同じ UI テキストを 5 通りに描画](shot:engine-godot-font-modes "Godot 4.7.2（Compatibility レンダラー）で描画。A: アンチエイリアス・ヒンティング・サブピクセルをオフにしたドットフォント、16px を 3 倍。B: 同じフォントを既定のインポートで 20px：ドットの大きさが不揃い。C: 通常のラスターフォントを 6 倍：ぼやける。D: 12px で焼いた BMFont をニアレストで 6 倍：ギザギザ。E: 同じ TTF で MSDF：6 倍でもシャープ、2px アウトライン付き。フォント：Kenney Pixel、Kenney Future（CC0）。")

## ビットマップ・SDF・MSDF の仕組み {#how-they-work}

どの方式もテクスチャアトラスからグリフを取り出して描きます。違うのは、テクセル 1 つに何を記録するかです。

| 方式 | テクセルの中身 | 拡大すると | アウトライン・グロー・影 | テクスチャのコスト |
|---|---|---|---|---|
| ビットマップ | あるサイズでのカバレッジ | ぼやける（linear）かギザギザ（nearest） | 画像に焼き込む | サイズ・スタイルごとにアトラス 1 枚 |
| SDF | 輪郭までの距離（1 チャンネル） | 滑らかだが角が丸くなる | シェーダーでほぼ無料 | 全サイズでアトラス 1 枚、セルに余白が必要 |
| MSDF | R・G・B の 3 つの距離、中央値が輪郭 | 滑らかで角もシャープ | シェーダーでほぼ無料 | SDF と同じで 3 チャンネル |

ビットマップのグリフは完成したピクセルなので、焼いたサイズでしか正確ではありません。符号付き距離場（signed distance field）は各テクセルが輪郭からどれだけ離れているかを記録し、シェーダーが距離 0 の位置で輪郭を作り直すため、どの倍率でも滑らかです。ただしチャンネルが 1 つだと角の周りの距離場が丸くなり、拡大すると角がつぶれます。MSDF は輪郭を 3 チャンネルに分けて中央値を取ることで角を保ちます。

![PixiJS 8.21 でのビットマップ・SDF・MSDF フォントの比較](shot:engine-pixi-sdf-msdf "Chromium 上の PixiJS 8.21.0（WebGL）で描画。12px で焼いたビットマップフォントは 12px では問題ないが 72px ではぼやける。msdf-atlas-gen 1.4 で 32px から作った SDF・MSDF アトラスは 72px でも滑らか。下段：Kenney Pixel 240px。SDF は四角い角が丸くなり、MSDF は保たれる。フォント：Kenney Future、Kenney Pixel（CC0）。")

## くっきりした UI テキストの設定手順 {#set-up}

:::steps
1. **サイズを書き出します。** テキストのスタイルごとに画面上の最小・最大ピクセルサイズ、UI やカメラが拡大縮小するか、必要なエフェクトを書き出します。サイズが 1 つでエフェクトなしならビットマップ、ズームやスケールのトゥイーン、大きなタイトルがあるなら SDF か MSDF です。
2. **形式を選びます。** ドットフォントはビットマップか、アンチエイリアスを切ったダイナミックフォント。いくつかの固定サイズの本文はビットマップかエンジンのダイナミックフォント。サイズが変わりアウトラインが要るテキストは SDF。大きなタイトルや角のあるフォントは MSDF です。
3. **実際に使う文字だけを焼きます。** 実行時に入る数字や名前のために ASCII は入れておきます。日本語・韓国語・中国語は [CJK フォントアトラスの作り方](guide:cjk-font-atlas-localization) を参照してください。
4. **適切な設定でインポートします。** Godot はフォントを選択して下記の Import ドックのオプションを変え、**Reimport** を押します。Unity は **Window > TextMesh Pro > Font Asset Creator** で選んだ Render Mode のフォントアセットを作ります。
5. **アトラスが想定するサイズで描きます。** ビットマップフォントは焼いたサイズかその整数倍で、ドットフォントはニアレストフィルタで描きます。SDF・MSDF はどのサイズでも構いません。
6. **アウトラインと影はレンダラー側で付けます。** SDF/MSDF はエンジンの設定で付け、画像に焼き込むのはビットマップフォントのときだけにします。
7. **実際の解像度で確認します。** 125%・150% のディスプレイ拡大率も確認してください。16px でくっきりしたドットフォントも 20px では不揃いになります。
:::

## ドットフォント：整数サイズ、アンチエイリアスなし {#pixel-fonts}

ドットフォントはフォント単位の格子の上に描かれていて、格子の 1 マスが画面の 1 ピクセルにぴったり重なるときだけくっきり表示されます。Kenney Pixel は 16px の格子でデザインされているので、16・32・48px はくっきり、20px はそうなりません（上の B 行：画面 1 ピクセル幅のドットと 2 ピクセル幅のドットが混ざる）。Godot のドキュメントにも同じルールが書かれています。フォントサイズはデザインサイズの整数倍、Control のスケールも整数倍にする必要があります。

Godot 4.7 では `.ttf` を選択し、**Import** ドックで次のように設定します。

- **Antialiasing:** None（選択肢は None、Grayscale、LCD Subpixel。既定は Grayscale）。
- **Hinting:** None。**Subpixel Positioning:** Disabled。
- **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter:** Nearest（またはその Control の **Texture Filter** を Nearest）。

Godot 4.7 の既定値は一部を自動で処理します。**Hinting** の既定は *Light (Except Pixel Fonts)*、**Subpixel Positioning** の既定は *Auto (Except Pixel Fonts)* で、私たちのテストでは Kenney Pixel に対してどちらも自動でオフになりました。ただし **Antialiasing は Grayscale のまま** だったので、自分で None に変える必要があります。プロジェクトの既定フォントにも **Project Settings > GUI > Theme** に同じオプション（`gui/theme/default_font_antialiasing` など）があります。

Unity では、アンチエイリアスなしの Render Mode（**RASTER** または **RASTER_HINTED**）と **Sampling Point Size** ＝デザインサイズで静的な TextMesh Pro フォントアセットを作ります。カメラやキャンバスのスケールは [Unity でドット絵がぼやける問題](guide:unity-pixel-art-blurry-pixel-perfect) で扱っています。Phaser と PixiJS のニアレストフィルタは [Phaser・PixiJS でドット絵をくっきり表示する](guide:pixel-art-crisp-in-browser-phaser-pixi) のゲーム全体の設定で決まります。

## Godot 4.7：BMFont のインポートと MSDF {#godot}

**ビットマップフォント。** `.fnt` と PNG をプロジェクトに入れると、Godot が `FontFile` としてインポートします。ファイルの `info` 行の `size` がフォントの **fixed size** になり、ほかのサイズでの扱いはインポートオプション **Scaling Mode**（*Disabled*、*Enabled (Integer)*、*Enabled (Fractional)*。既定は Fractional）で決まります。ドットフォントでは **Enabled (Integer)** を選んでください。グリフシート画像を直接フォントとしてインポートすることもできます。**Import As** を *Font Data (Image Font)* にして、**Columns**、**Rows**、**Character Ranges** を入力します。

**MSDF。** `.ttf`/`.otf` を選択し、**Multichannel Signed Distance Field** をオンにして **Reimport** します。**MSDF Size**（既定 48）は距離場を生成するサイズ、**MSDF Pixel Range**（既定 8）は距離の勾配の幅です。Godot のドキュメントが挙げる制約は 3 つです。ピクセル範囲は **アウトラインサイズの 2 倍以上** にすること、輪郭が自己交差するフォントは正しく描画されないこと、LCD サブピクセルのアンチエイリアスは使えないことです。上の E 行がこの設定に 2px のアウトラインを付けた結果です。

```gdscript
# title_label.gd - outline on an MSDF font (MSDF Pixel Range 8 >= 2 x outline 2)
extends Label

func _ready() -> void:
	add_theme_font_size_override("font_size", 12)
	add_theme_constant_override("outline_size", 2)
	add_theme_color_override("font_outline_color", Color(0.1, 0.2, 0.55))
	scale = Vector2(6, 6)   # MSDF: no re-rasterisation, edges stay sharp
```

Label と RichTextLabel には影のオーバーライド **Font Shadow Color**、**Shadow Offset X/Y**、**Shadow Outline Size** もあります。

## Unity 6：TextMesh Pro と UI Toolkit {#unity}

TextMesh Pro は現在 uGUI パッケージに含まれており（Unity 6000.5.3f1 では `com.unity.ugui` 2.5.0）、UI Toolkit は TextCore のフォントアセットを使います。どちらも次の設定を共有します。

- **Render Mode。** ビットマップ：*SMOOTH*、*SMOOTH_HINTED*、*RASTER*、*RASTER_HINTED*（カラーフォント用の *COLOR* 系もあり）。距離場：*SDF*、*SDFAA*、*SDFAA_HINTED*、*SDF8*、*SDF16*、*SDF32*。*SDFAA* は高速だが精度の低い生成方式で、*SDF8/16/32* は順にオーバーサンプリングが増えます。すべて 1 チャンネルで、MSDF モードはありません。
- **Atlas Population Mode。** *Static* はエディターで文字を焼き込み、*Dynamic* は実行時に元のフォントからグリフを追加し（フォントファイルがビルドに含まれる）、*Dynamic OS* はプレイヤーのシステムにインストールされたフォントを使います。
- **エフェクト。** アウトライン、アンダーレイ（影）、グローは SDF シェーダーのマテリアル設定です。

Unity の UI Toolkit マニュアルは、一般的なラベルに Static＋SDF16、タイトルに SDF32、プレイヤーが入力するテキストに Dynamic＋SDFAA、パディングはサンプリングサイズの約 1/10 を推奨しています。また **Unity 6.5 では UI Toolkit の既定の Advanced Text Generator が静的フォントアセットに対応しておらず**、移行ページはフォントをサブセット化してダイナミックアセットを使うよう案内しています。TextMesh Pro は 3 つのモードをそのまま使えます。

## Phaser 3.90・4.2：BitmapText は XML のみ {#phaser}

Phaser の `load.bitmapFont` が解析するのは **XML 形式の BMFont だけ** です。同じフォントで試したところ、Phaser 3.90.0 と 4.2.1 のどちらでもテキスト形式の `.fnt` は「Failed to process file」で失敗し、`.xml` は 95 グリフすべてを読み込みました。テキスト形式の `.fnt`（BMFont の既定であり、Nerulio の出力もこれ）は次のように変換します。

```js
// fnt-to-xml.mjs - convert a BMFont *text* .fnt into the XML flavour Phaser's load.bitmapFont reads.
// Usage: node fnt-to-xml.mjs font.fnt font.xml
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tags = { info: [], common: [], page: [], distanceField: [], char: [], kerning: [] };

for (const line of readFileSync(src, 'utf8').split(/\r?\n/)) {
  const tag = line.split(/\s/, 1)[0];
  if (!(tag in tags)) continue; // skips "chars count=" / "kernings count=" (recounted below)
  const attrs = [...line.matchAll(/(\w+)=("[^"]*"|\S+)/g)]
    .map(([, k, v]) => `${k}="${esc(v.replace(/^"|"$/g, ''))}"`);
  tags[tag].push(`<${tag} ${attrs.join(' ')}/>`);
}

writeFileSync(out, `<?xml version="1.0"?>
<font>
  ${tags.info[0]}
  ${tags.common[0]}
  <pages>${tags.page.join('')}</pages>
  ${tags.distanceField.join('')}
  <chars count="${tags.char.length}">
    ${tags.char.join('\n    ')}
  </chars>
  <kernings count="${tags.kerning.length}">${tags.kerning.join('')}</kernings>
</font>
`);
console.log(`${out}: ${tags.char.length} chars, ${tags.kerning.length} kernings`);
```

```js
// In your scene (Phaser 3.90 or 4.x). With pixelArt: true in the game config the font stays crisp.
preload() {
  this.load.bitmapFont('future12', 'future12.png', 'future12.xml');
}
create() {
  this.add.bitmapText(16, 40, 'future12', 'Wave 7');              // the font's own size: 1:1
  this.add.bitmapText(110, 34, 'future12', 'Wave 7').setScale(6); // whole-number scale
}
```

サイズ引数を省くとフォント自身のサイズで描かれ、サイズを渡すとそのサイズとの比率でスケールされます。どちらのバージョンにも距離場の BitmapText はないため（どちらのソースツリーにも SDF/MSDF のコードがない）、Phaser でサイズが変わる大きなタイトルは、大きなビットマップフォントか `Text` オブジェクトで扱います。

## PixiJS 8：SDF・MSDF の BitmapText {#pixijs}

PixiJS 8 は `Assets` で BMFont のテキスト形式と XML の両方を読み込み、フォントが距離場を宣言していれば SDF または MSDF のシェーダーに切り替えます。

```js
import { Assets, BitmapText } from 'pixi.js';

await Assets.load(['future12.fnt', 'pixel-msdf.xml']);

// Bitmap font: fontSize = the size in the file's info line draws it 1:1.
const hud = new BitmapText({ text: 'Wave 7', style: { fontFamily: 'Future12', fontSize: 16, fill: '#ffeea0' } });

// MSDF font (from msdf-atlas-gen): any size stays sharp.
const title = new BitmapText({ text: 'Hi!', style: { fontFamily: 'PixelMSDF', fontSize: 240, fill: '#ffeea0' } });
app.stage.addChild(hud, title);
```

XML には `<distanceField fieldType="msdf" distanceRange="4"/>`（または `fieldType="sdf"`）が必要です。PixiJS 8.21.0 では、`distanceField fieldType=msdf distanceRange=4` の行を含む **テキスト形式** の `.fnt` が *通常の* ビットマップフォントとして読み込まれました。テキストパーサーが小文字のレコード名しか認識せず、その行を飛ばすためです。同じデータを XML で渡すと正しく動いたので、Pixi には SDF/MSDF フォントを XML で渡してください（上の変換スクリプトは `distanceField` を保持します）。msdf-atlas-gen は JSON を出力するので変換が必要で、msdf-bmfont-xml や Snowb は BMFont を直接書き出します。

## アウトライン・影とメモリ {#outlines-memory}

SDF・MSDF のテキストでは、アウトラインは同じ距離に 2 つ目のしきい値を当てたもの、影やグローはオフセットやより柔らかいしきい値でもう一度読んだものなので、新しいテクスチャは要りません。ただし効果が届くのはアトラスに記録した距離の範囲までです。Godot が MSDF Pixel Range ≥ アウトライン × 2 を求め、TextMesh Pro のパディングがアウトラインの太さを制限するのはこのためです。ビットマップフォントでは、フォントを作るときにアウトラインをグリフに焼き込むか、テキストを 2 回描いて 1px のドロップシャドウにします。

メモリ：ビットマップのアトラスは 1 サイズ・1 スタイルしか持たないので、3 サイズにアウトライン版を加えるとアトラスは 4 枚になります。距離場のアトラスは 1 枚ですべてに対応しますが、セルごとに余白が付き、MSDF は RGB が必要です。Kenney Future の印字可能な ASCII 95 文字では、12px のビットマップが 150×160、msdf-atlas-gen の 32px・pixel range 4 では SDF（1 チャンネル）228×228、MSDF（RGB）236×236 でした。ラテン文字の UI ならどれも小さく、メモリを左右するのは文字数です。だから CJK にはサブセットかダイナミックアトラスが必要になります。

## よくある落とし穴 {#pitfalls}

- **`.fnt` の `size` を確認しましょう。** Godot はこれを fixed size として使い、Phaser と Pixi は指定したサイズをこの値との比率でスケールします。
- **ニアレストフィルタと整数スケールは両方必要です。** 片方だけではドットフォントはまだぼやけます。
- **とても小さい文字。** ごく小さいサイズでは、そのサイズ向けにヒンティングしたビットマップのほうが距離場より読みやすいことがよくあります。
- **カーニング** は、ジェネレーターがペアを書き出したときにだけ存在します。グリフシートから作ったフォントにはありません。

:::nerulio tool=bitmap-font
Nerulio の UI Lab にあるビットマップフォントのステージは、アップロードなしにブラウザー内でグリフシートやローカルの TTF/OTF を BMFont に変換します。Fixed grid の書き出し（8×12 の CC0 シート）は、Nerulio のエンジン検証で Godot 4.7.2 と PixiJS 8 にピクセル単位で正確に読み込まれました。Font file モードはまだその検証に含まれていませんが、この記事の Kenney Future フォントはこのモードで作ったもので、Godot、Phaser（XML 変換後）、PixiJS で読み込めました。
- **Fixed grid**：格子と文字の並びを信頼度付きで自動検出し、各グリフはセル全体です。
- **Measured widths** と **Font file**：シートのピクセル、または指定サイズで描いた TTF/OTF から、グリフの矩形と文字ごとの advance を測ります。
- **文字セットビルダー**：自分のテキストで使った文字、ASCII、Latin-1、貼り付けたテキストの韓国語・日本語の文字。
- **ダウンロード** で `font.png`、`font.fnt`（BMFont テキスト形式）、`font.json`、README が得られます。**Also build an SDF texture (Beta)** をオンにすると、シェーダーの式を添えた 1 チャンネルの `font-sdf.png` が加わります。
- 制限：1 ページのみ、カーニングなし、MSDF なし、SDF 出力はエンジンでは未検証、Phaser には上記の XML 変換が必要です。
:::

![Nerulio UI Lab のビットマップフォントステージ](shot:lab-ui-font "Nerulio UI Lab のフォントステージ：8×12 のグリフシートを空白文字から始まる 16×6 の格子として検出し、フォント自身のメトリクスで 1 行を描いて確認できます。")

## FAQ {#faq}

### ゲーム UI には SDF と MSDF のどちらがよいですか？

大きなテキストや角のあるフォントには MSDF が向いています。1 チャンネルの SDF は拡大すると角が丸くなるためです。本文サイズや丸いフォントなら SDF でも見た目は変わらず扱いも簡単で、Unity の TextMesh Pro は SDF のみです。

### Godot 4 でドットフォントがぼやけるのはなぜですか？

多くの場合、Import ドックの Antialiasing が Grayscale のまま、サイズがデザインサイズの整数倍でない、または Control が linear フィルタや小数倍率で描かれていることが原因です。Antialiasing と Hinting を None、Subpixel Positioning を Disabled にし、デザインサイズとニアレストフィルタを使ってください。

### Phaser で .fnt ファイルが読み込めないのはなぜですか？

`load.bitmapFont` は XML 形式の BMFont しか解析しません。テキスト形式の `.fnt`（`info face=… size=…` の形式）は「Failed to process file」で失敗するので、XML で書き出すか、上のようなスクリプトで変換してください。

### Unity で MSDF フォントは使えますか？

TextMesh Pro と UI Toolkit では使えません。距離場モードはすべて 1 チャンネルです。大きなテキストもたいてい SDF32 で十分で、本物の MSDF が必要ならサードパーティのソリューションが必要です。

### サイズごとに別のビットマップフォントが必要ですか？

ピクセル単位で正確にしたいなら必要です。サイズごとにアトラスを作るか、1 つのドットフォントの整数倍を使います。距離場フォントは 1 枚のアトラスで全サイズに対応しますが、小さな文字はわずかに柔らかくなります。

## Sources {#sources}

- [ResourceImporterDynamicFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterdynamicfont.html)
- [ResourceImporterBMFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterbmfont.html)
- [Using fonts: bitmap fonts, pixel fonts, MSDF, outlines (Godot 4.7)](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html)
- [Godot 4.7 font importer source, option names and enum labels](https://github.com/godotengine/godot/blob/4.7-stable/editor/import/resource_importer_dynamic_font.cpp)
- [Font Asset Creator (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsCreator.html)
- [Font Asset properties (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsProperties.html)
- [Introduction to font assets (Unity 6.3 Manual, UI Toolkit)](https://docs.unity3d.com/6000.3/Documentation/Manual/UIE-font-asset.html)
- [Migrate static font assets to Advanced Text Generator (Unity 6.5 Manual)](https://docs.unity3d.com/6000.5/Documentation/Manual/ui-systems/migrate-static-font-assets.html)
- [Bitmap Text (Phaser documentation)](https://docs.phaser.io/phaser/concepts/gameobjects/bitmap-text)
- [Bitmap text (PixiJS 8 guide)](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)
- [msdf-atlas-gen (Viktor Chlumský)](https://github.com/Chlumsky/msdf-atlas-gen)
- [BMFont file format (AngelCode)](https://www.angelcode.com/products/bmfont/doc/file_format.html)
