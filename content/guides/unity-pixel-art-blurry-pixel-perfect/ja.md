Unity でドット絵がぼやけるのは、テクスチャの既定のインポート設定が原因です。新しい PNG は **Filter Mode** が **Bilinear**（拡大時にピクセルを混ぜて滑らかにする）、**Compression** が **Normal Quality**（4×4 ブロック単位で色を崩す）で読み込まれ、**Max Size**（既定 2048）より大きいシートは警告なしで縮小されます。**Filter Mode** を **Point (no filter)**、**Compression** を **None** にし、**Max Size** を画像以上に、全スプライトの **Pixels Per Unit** を同じ値にそろえたうえで、**Pixel Perfect Camera** を付けて画面を整数倍で描画すれば直ります。

以下の内容はすべて Unity 6000.5.3f1（Unity 6.5）、URP 17.5 とその 2D Renderer で確認しました。画像はそのエディターで実際に描画したものです。

![Unity 6000.5.3f1 で同じ 48 px の CC0 侍フレームを 6 倍で描画した 4 つの結果：Bilinear + Normal Quality 圧縮、Point + Normal Quality、Point + Max Size 128、Point + None](shot:engine-unity-pixel-import-compare "Unity 6000.5.3f1（Built-in Render Pipeline）で 6 倍描画。左から Bilinear + 圧縮（既定）、Point + 圧縮（顔の細部が消える）、Point + Max Size 128（シートが 77×128 に縮小）、Point + None。素材：sebshady の侍、CC0。")

## インポート設定を直す {#steps}

:::steps
1. **スプライトを選択します。** Project ウィンドウでドット絵のテクスチャをすべて選びます（複数選んでまとめて編集できます）。
2. **スプライトとして読み込みます。** Inspector で **Texture Type** を **Sprite (2D and UI)** にします。**Pixels Per Unit** は全スプライトでタイルやグリッドの大きさ（例：16）にして、タイル 1 枚がワールドの 1 ユニットになるようにします。
3. **フィルタリングを切ります。** **Advanced** セクションを開き、**Filter Mode** を **Point (no filter)** にして、**Generate Mip Maps** をオフにします。
4. **圧縮を切り、Max Size を確認します。** プラットフォーム欄（**Default** タブ）で **Compression** を **None** にし、**Max Size** をテクスチャの長辺以上にします（3000 px のシートなら 4096）。**Apply** を押します。
5. **Pixel Perfect Camera を付けます。** カメラを選び、**Add Component** から **Pixel Perfect Camera** を追加します。**Assets Pixels Per Unit** はスプライトと同じ値、**Reference Resolution** はゲームのドット解像度（例：320 × 180）にします。URP ではカメラが 2D Renderer を使っている必要があります。
6. **スナップ方法を選びます。** サブピクセル移動を止めたいなら **Grid Snapping** を **Pixel Snapping** に、シーンを基準解像度で描いてから拡大したいなら **Upscale Render Texture** にします。後者は回転したスプライトもドットのグリッドにそろえます。画面の縦横比が基準解像度と違うときの扱いは **Crop Frame** で選びます。
:::

## それぞれの設定が効く理由 {#why}

288×480 の CC0 シート（48 px のフレーム）で測った結果です。

| 設定 | 新しい PNG の既定値 | ドット絵への影響 |
|---|---|---|
| **Filter Mode** | Bilinear | 拡大時に隣のテクセルを混ぜ、すべての輪郭がグラデーションになる（左の描画は 12 色ではなく 4,230 色） |
| **Compression** | Normal Quality（Windows では DXT5） | 4×4 ブロック単位で色が変わる。Point でもくっきりはするが色が違い、2 枚目では顔の細部が消えた |
| **Max Size** | 2048 | それより大きいテクスチャは警告なしで縮小される。Max Size 128 ではシートが 77×128 になった |
| **Generate Mip Maps** | Sprite はオフ、Default はオン | 小さく描くときに使われる縮小版で、ドット絵をぼかす |
| **Pixels Per Unit** | 100 | スプライトごとに違うと、画面上のピクセルの大きさがそろわない |

いちばん右の描画（**Point**、**None**、Max Size 2048）は、元のフレームをニアレストネイバーで 6 倍にした画像とピクセル単位で完全に一致しました。

**Texture Type も確認してください。** 2D モードではないプロジェクトでは、新しい PNG が **Sprite (2D and UI)** ではなく **Default** として読み込まれます。この場合ミップマップがオンになり、2 のべき乗でない画像はサイズが変わります。試した 288×480 のシートは 256×512 になりました。スプライトのはずのテクスチャがぼやけて少し伸びて見えるなら、まず **Texture Type** を見てください。

## Pixel Perfect Camera の設定 {#pixel-perfect-camera}

Unity 6 の URP では、**Pixel Perfect Camera** は URP に含まれるコンポーネント（`UnityEngine.Rendering.Universal.PixelPerfectCamera`）で、カメラが **2D Renderer** を使っている必要があります。ほかのレンダラーでは Inspector にエラーが出ます。Built-in Render Pipeline では別パッケージの **2D Pixel Perfect**（6000.5 には 6.0.0 が付属）を使い、こちらは昔ながらのチェックボックス形式の設定です。

| プロパティ | 6000.5.3f1 での値 | 用途 |
|---|---|---|
| **Assets Pixels Per Unit** | 既定 100 | スプライトの **Pixels Per Unit** と同じにする |
| **Reference Resolution** | 既定 320 × 180 | 絵の基準になる解像度。カメラは画面に収まる最大の整数倍を選ぶ |
| **Crop Frame** | None、Pillarbox、Letterbox、Windowbox、Stretch Fill | 余った画面の扱い：黒帯を入れるか、引き伸ばして埋めるか |
| **Grid Snapping** | None、Pixel Snapping、Upscale Render Texture | Pixel Snapping は描画時にスプライトレンダラーをドットのグリッドへ合わせる。Upscale Render Texture は基準解像度で描いてから拡大する |
| **Filter Mode** | Retro AA（既定）、Point | **Crop Frame** が **Stretch Fill** のときだけ表示。Retro AA は最も近い整数倍まで Point で拡大し、残りを Bilinear で画面サイズに合わせる。Point はくっきりするがちらつきが増える |

ゲームの実行中は、Inspector の **Current Pixel Ratio** にカメラが決めた倍率（例：4:1）が表示されます。目標の解像度で整数にならないなら、**Reference Resolution** か **Crop Frame** を変えてください。基準解像度 48 × 48 で 288 px のテスト描画をしたときの倍率は 6 でした。

![同じフレームを 20° 回転させて URP で描画した 2 つの結果：Grid Snapping None では大きなピクセルごと傾き、Upscale Render Texture ではピクセルがグリッドに沿ったまま](shot:engine-unity-pixel-perfect-rotation "Unity 6000.5.3f1、URP 17.5 2D Renderer、Pixel Perfect Camera で 6 倍。左が Grid Snapping None、右が Upscale Render Texture、スプライトは 20° 回転。")

**Grid Snapping** の違いが大きく出るのは、スプライトを回転・拡大縮小するときです。**None** では回転したスプライトを画面解像度で描くので、大きなピクセルごと傾いてドットのグリッドを横切ります（いわゆる「ミクセル」）。**Upscale Render Texture** ではまずシーンを基準解像度で描くため、回転したスプライトもほかの絵と同じグリッドでドット化し直されます。Unity のドキュメントにもあるとおり、ピクセルをくっきりさせるほど動いたときのちらつきは増えます。

## 新しいテクスチャに自動で設定する {#presets}

1 枚ずつ手で設定していると、ぼやけたスプライトがまた紛れ込みます。確実に自動化する方法は 2 つあり、どちらも 6000.5.3f1 で試しました。

**Preset Manager（コード不要）。** 1 枚のテクスチャを正しく設定し、Inspector 右上のプリセットセレクター（スライダーのアイコン）を押して、**Select Preset** ウィンドウの **Create New** でプリセットアセットを保存します。そのプリセットを選んで Inspector の **Add to default** を押し、**Edit → Project Settings → Preset Manager** で `glob:"Assets/Art/Sprites/**"` のような **Filter** を付けます。試したところ、そのフォルダーに新しく入れた PNG は Sprite / Point / None とプリセットの Pixels Per Unit で読み込まれ、フォルダー外の PNG は既定値のままでした。既存のアセットを Reimport しても既定のプリセットは適用されません。また、プリセットは持っている設定をすべてコピーするため、プロパティを除外しない限り **Sprite Mode** まで上書きします。

**AssetPostprocessor（コード）。** 次のスクリプトは新しいファイルにだけ効くので、あとで Inspector で変えた値はそのまま残ります。

```csharp
// Assets/Editor/PixelArtImportSettings.cs
using UnityEditor;
using UnityEngine;

// Gives every texture imported under Assets/Art/Pixel/ pixel-art settings on its first import.
public class PixelArtImportSettings : AssetPostprocessor
{
    const string Folder = "Assets/Art/Pixel/";
    const float PixelsPerUnit = 16f;

    void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith(Folder)) return;
        if (!assetImporter.importSettingsMissing) return; // only new files: later Inspector edits are kept
        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.Sprite;
        importer.spritePixelsPerUnit = PixelsPerUnit;
        importer.filterMode = FilterMode.Point;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.maxTextureSize = 16384;                     // never downscale silently
    }
}
```

試したところ、`Assets/Art/Pixel/` に新しく入れたファイルは Sprite、Point、非圧縮、Max Size 16384、16 PPU、ミップマップなしで読み込まれました。その後 Inspector で Bilinear に変えて再インポートしても、Bilinear のままでした。フォルダーのルールを常に優先したい場合は `importSettingsMissing` の行を消してください。

## Sprite Atlas とタイルマップのすき間 {#atlas-tilemap}

- **Sprite Atlas には独自のテクスチャ設定があります。** 6000.5.3f1 では、新しいアトラスは **Filter Mode** が Bilinear、**Compression** が Normal Quality、**Padding** が 4、**Allow Rotation** と **Tight Packing** がオンの状態で始まります。パックされたスプライトはアトラスのテクスチャで描かれるので、アトラスも **Point** と **None** にしてください。そうしないと、パックした後にまたぼやけます。
- **タイルの間の細い線**は、たいていタイルの端で隣のテクセルを拾ってしまうことが原因です。きっかけは、ピクセルの間に来るカメラ位置やズーム、Bilinear、ミップマップ、圧縮です。多くは Point フィルター、ミップマップなし、Pixel Perfect Camera で直ります。残りは、タイルを Padding 2 以上・Point フィルターの Sprite Atlas にまとめれば直ります。端の押し出し（extrude）とその仕組みは [タイルの継ぎ目とテクスチャのにじみ](guide:tile-seams-texture-bleeding-padding-extrude) で扱っています。
- **動いたときのガタつき**（スプライトが背景に対して 1 ピクセルずつ揺れる）はサブピクセル移動が原因です。**Grid Snapping** を使うか、カメラとスプライトの位置を `1 / Pixels Per Unit` の倍数に保ってください。

:::nerulio tool=pixel-perfect-checker
拡大して書き出した、滑らかにリサイズした、実際のグリッドを持たない生成系の「ドット絵」など、PNG そのものがすでにぼやけている場合は、Unity の設定では直せません。Nerulio の Pixel Perfect Checker はブラウザー内でファイルを測り、どのケースかを教えてくれます。
- 拡大された絵のピクセルサイズとグリッドのずれを見つけます。正確なグリッドがあれば **Recover 1× source** で本来の等倍画像を取り出して読み込めます。
- 2 色の中間色になっている輪郭ピクセル（ニアレスト拡大なら 0、滑らかにリサイズした画像なら多数）と色数を数え、元のピクセルを復元できないときははっきりそう伝えます。
- Studio の [Pack & Export](studio:pack) の Unity 6 向け書き出しは、Point・非圧縮・ミップマップなしで読み込み、Max Size をアトラスのページに合わせて引き上げます。この書き出しは Unity 6000.5.3f1 で検証済みです。
:::

![Nerulio Pixel Perfect Checker が約 7.29 倍でリサンプルされた画像を測り、高い信頼度でスムージングを報告し、中間色の輪郭ピクセル 84.6% を表示した画面](shot:lab-pixel-cleanup "グリッドを当て推量せず、整数でないリサンプルとスムージングをそのまま報告します。")

## FAQ {#faq}

### Game ビューでだけドット絵がぼやけるのはなぜですか？

Scene ビューと Game ビューでは拡大のしかたが違います。整数でない倍率では **Point** でもピクセルの大きさが不ぞろいになり、**Bilinear** ならさらにぼやけます。Game ビューを固定解像度にし、Pixel Perfect Camera で整数倍に拡大してください。

### Unity のドット絵には Point と Bilinear のどちらを使うべきですか？

**Point (no filter)** です。Bilinear は滑らかな絵のためのもので、ドット絵のスプライトを拡大すると隣のピクセルを平均してしまいます。Pixel Perfect Camera で **Stretch Fill** を使う場合、最後の拡大に使われる **Filter Mode**（Retro AA）は別の設定です。

### Point にしてもまだぼやけます。ほかに何を見ればいいですか？

**Compression**（None）、**Max Size**（画像より小さくしない）、**Generate Mip Maps**（オフ）、そしてスプライトが Filter Mode が Bilinear のままの Sprite Atlas に入っていないかを確認してください。テクスチャが **Default** として読み込まれていないかも確認が必要です。

### Pixels Per Unit はいくつにすればいいですか？

タイルやグリッド 1 マスの大きさ（16 px のタイルセットなら 16）を使い、全スプライトとカメラの **Assets Pixels Per Unit** を同じ値にしてください。数値そのものは設計上の選択で、大事なのはすべてをそろえることです。

### Built-in Render Pipeline でも Pixel Perfect Camera は使えますか？

URP のコンポーネントは使えません。Built-in パイプラインでは、今も配布されている **2D Pixel Perfect** パッケージ（Unity 6.5 向けは 6.0.0）を使います。URP では 2D Renderer と一緒に URP 付属のコンポーネントを使ってください。

## 参考資料 {#sources}

- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- Unity 6.5 Manual — [Add a pixel perfect camera (prepare your sprites)](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html)
- Unity 6.5 Manual — [Configure a pixel perfect camera](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-configure.html)
- Unity 6.5 Manual — [Pixel Perfect Camera component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-ref.html)
- 2D Pixel Perfect パッケージ 6.0 — [2D Pixel Perfect (Built-in Render Pipeline)](https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@6.0/manual/index.html)
- Unity 6.5 Manual — [Preset Manager](https://docs.unity3d.com/6000.5/Documentation/Manual/class-PresetManager.html)、[Apply default presets by folder](https://docs.unity3d.com/6000.5/Documentation/Manual/DefaultPresetsByFolder.html)
- Unity 6.5 Scripting API — [AssetPostprocessor.OnPreprocessTexture](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetPostprocessor.OnPreprocessTexture.html)、[AssetImporter.importSettingsMissing](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetImporter-importSettingsMissing.html)
- Unity 6.5 Manual — [Sprite Atlas Inspector window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html)
- テスト用素材：[sebshady の Samurai sprites](https://opengameart.org/content/samurai-sprites)、CC0
