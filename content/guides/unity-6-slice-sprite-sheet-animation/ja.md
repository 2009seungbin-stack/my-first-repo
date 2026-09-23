Unity 6 でスプライトシートを分割するには、PNG を選択して **Texture Type** を **Sprite (2D and UI)**、**Sprite Mode** を **Multiple** にし、**Apply** を押します。次に **Sprite Editor** を開き、**Slice → Grid By Cell Size** にフレームサイズを、フレーム間の隙間を **Padding** に入力して、もう一度 **Apply** します。分割したフレームを Project ウィンドウで選んで Scene にドラッグすると、Unity はクリップの保存先を尋ねたうえで、12 fps の Animation Clip、Animator Controller、Animator コンポーネントをまとめて作ります。

以下の内容はすべて Unity 6000.5.3f1（Unity 6.5）と標準搭載の 2D Sprite パッケージで確認しました。数値は、Sprite Editor と同じグリッド分割処理を呼び出すバッチモードのスクリプトで測定したものです。テスト用のシートは Kenney の CC0 素材 Pixel Platformer のキャラクターシート（224×74 px、24 px のフレーム、隙間 1 px）です。

## シートを分割してクリップを作る {#steps}

:::steps
1. **インポート設定を変えます。** Project ウィンドウでシートを選択し、Inspector で **Texture Type** を **Sprite (2D and UI)**、**Sprite Mode** を **Multiple** にします。**Pixels Per Unit** はタイルやキャラクター 1 マスの大きさ（16、24、32 …）に合わせます。ドット絵なら **Filter Mode** を **Point (no filter)**、**Compression** を **None** にして **Apply** を押します。
2. **Sprite Editor を開きます。** Inspector の **Open Sprite Editor** を押します。2D Sprite パッケージが入っていないため Sprite Editor ウィンドウを使えない、というメッセージが出たら、**Window → Package Manager** から **2D Sprite** をインストールします（2D テンプレートには最初から入っています）。
3. **グリッドを決めます。** ツールバーの **Slice** を押し、**Type** を **Grid By Cell Size** にします。**Pixel Size** にフレームサイズ（この例では 24 × 24）、**Offset** に最初のフレームの手前の余白、**Padding** にフレーム間の隙間（この例では 1 × 1）を入力します。マスごとに必ずスプライトが要る場合以外は **Keep Empty Rects** はオフのままにします。
4. **ピボットを選んで分割します。** 地面に立つキャラクターなら **Pivot** を **Bottom** にします（または **Custom** にして **Pivot Unit Mode** を **Pixels**）。最初の分割では **Method** を **Delete Existing** のまま **Slice** を押します。すべての枠がフレームにぴったり合っているか確かめてから **Apply** を押します。
5. **クリップを作ります。** Project ウィンドウでシートを展開し、1 つのアニメーションに使うフレーム（例：`characters_0` と `characters_1`）を選んで Scene ビューにドラッグします。保存ダイアログが出たら `.anim` ファイルを保存します。Unity が SpriteRenderer、Animator、新しい Animator Controller を付けて、クリップが再生されるようにしてくれます。
6. **速度とループを決めます。** **Window → Animation → Animation** を開いて GameObject を選択し、Animation ウィンドウのオプションメニューで **Show Sample Rate** をオンにします。**Samples**（1 秒あたりのフレーム数）を 12 から好きな値に変えます。歩き・待機のように繰り返す動きは `.anim` ファイルを選んで Inspector の **Loop Time** をオンに、攻撃や倒れる動きのように 1 回だけ再生するものはオフにします。
:::

![Nerulio Studio の Sprite ワークスペースが CC0 の侍シートから 48×48 のグリッドを信頼度・候補とともに検出した画面（分割前）](shot:studio-sprite-import "Sprite ワークスペースは信頼度付きでグリッドを提案し、分割前にほかの候補と比べられます。")

## Slice の種類の選び方 {#slice-types}

**Slice** メニューの種類は 4 つです。6000.5.3f1 の `SpriteEditorMenuSetting.SlicingType` にも、Automatic、GridByCellSize、GridByCellCount、IsometricGrid の 4 つだけが定義されています。

| Type | 動作 | 向いている用途 |
|---|---|---|
| Automatic | 不透明ピクセルのかたまりごとに、ぴったりの矩形を 1 つ | アイコン、小物、UI パーツ。アニメーションには不向き |
| Grid By Cell Size | 固定の **Pixel Size** のマスに **Offset** と **Padding** | フレームサイズが分かっているアニメーションシート |
| Grid By Cell Count | **Column & Row** を入れるとマスの大きさを計算 | フレーム数だけ分かっているシート |
| Isometric Grid | ひし形のマス（**Is Alternate** で行ごとにずらす） | アイソメトリックタイル |

**アニメーションに Automatic を使ってはいけません。** テスト用シートで Automatic は 27 個のかたまりを正しく見つけましたが、大きさは 11×15 から 24×24 まで 16 種類でした。切り出した矩形ごとに別々のピボットになるので、再生するとキャラクターががたつきます。グリッドで分割すれば全フレームが同じ大きさになり、絵の位置がずれません。

## Padding、Offset と 1 ピクセルずつのずれ {#padding-offset}

「1 マスずれる」と言われる問題の多くは、フレーム間の隙間を無視して分割したことが原因です。枚数が間違うわけではないので気付きにくいのが厄介です。224×74 のシート（24 px のフレーム、隙間 1 px）で 3 つの設定を測りました。

| 設定 | スプライト数 | 各列の開始位置 |
|---|---|---|
| Grid By Cell Size 24、Padding 0 | 27 | 0, 24, 48 … 192 — 列ごとに 1 px ずつずれ、最後の列は 8 px ずれる |
| Grid By Cell Count 9 × 3、Padding 0 | 27 | 同じ。224 / 9 = 24.9 を 24 に切り捨て |
| Grid By Cell Size 24、Padding 1 | 27 | 0, 25, 50 … 200 — 正確 |

上の 2 つもフレーム数は合っているので、一覧を見ても異常はありません。ところが再生すると、キャラクターがフレームごとに少しずつ横へずれ、端に隣のフレームの一部が映り込みます。**Grid By Cell Count** でも Padding の入力が必要です。Unity はマスの大きさを `(width − offset − padding × (columns − 1)) / columns` で計算し、小数点以下を切り捨てます。

次の点を守れば防げます。

- 画像編集ソフトでフレーム 1 つと隙間 1 つを測ります。シートの幅は `offset + columns × cell + (columns − 1) × padding` と一致するはずです。この例では 0 + 9 × 24 + 8 × 1 = 224 です。
- **Offset** は画像の左上から数えます。多くのお絵描きツールもシートをこの向きで並べます。Offset を 1, 1 にすると、最初のマスは右へ 1 px、下へ 1 px 動きました。
- 余ったピクセルはフレームになりません。シートを 1 px 広げたコピーでも 24×24 のスプライトはちょうど 27 個で、細い切れ端のスプライトはできませんでした。古いバージョンのプロジェクトで切れ端が見つかったら、クリップを作る前に Sprite Editor で削除してください。

## 空のマスと Keep Empty Rects {#empty-cells}

行の終わりに空きマスがあるシートはよくあります。**Keep Empty Rects** がオフ（既定）だと、グリッド分割は不透明ピクセルのないマスを飛ばします。CC0 の HQ Trooper シート（64 px のマスが 6 × 13）では、オフで 52 個、オンで 78 個になりました。

注意したいのは番号です。Sprite Editor はスプライトを作った順に `<texture>_0`、`<texture>_1` … と名前を付けます。空きマスを飛ばすと、その後のフレームが次の番号を使うので、「3 行目」が `_12` から始まらなくなり、インデックスでフレームを拾うスクリプトは別のフレームをつかんでしまいます。**Keep Empty Rects** をオンにして空きを手で消すか、クリップを作る前に動作ごとに名前（`run_0`、`run_1` …）を付け直してください。

## ピボットと Pixels Per Unit {#pivot-ppu}

- **Pivot** は、スプライトが GameObject のどこに置かれ、どこを中心に回転するかを決めます。横スクロールのキャラクターは **Center** より **Bottom**（足元）のほうが配置や接地判定が楽です。1 つのアニメーションのフレームはすべて同じピボットにしないと、絵が跳ねます。
- **Pixels Per Unit** は、テクスチャの何ピクセルがワールドの 1 ユニットになるかを決めます。ドット絵のゲームでは全スプライトを同じ値（普通はタイルサイズ）にしてください。そうすれば 16 px のタイルがちょうど 1 ユニットになり、[Pixel Perfect Camera](guide:unity-pixel-art-blurry-pixel-perfect) が整数ピクセルに合わせられます。

## 参照を壊さずに分割し直す {#slice-method}

**Method** は、すでにあるスプライトをどう扱うかを決めます。

- **Delete Existing** は既存の矩形をすべて消し、既定の名前で作り直します。名前を変えたスプライトがあると、参照が失われると Unity が警告します。
- **Smart** は既存の矩形を残したり調整したりしながら、新しい矩形を追加します。
- **Safe** は矩形を追加するだけで、既存のものには手を触れません。

クリップやプレハブがスプライトを使い始めたら、**Smart** か **Safe** で分割し直してください。Unity 6 の Slice パネルには **Slice on Import** もあり、Unity の外で PNG を編集して再インポートされるたびに、同じ設定で自動的に分割し直します。

## フレームレート、フレームの順番、ループ {#frame-rate}

6000.5.3f1 でエディター自身のドラッグ処理を呼び出して再現した結果です。

- クリップは **12 サンプル/秒**、1 フレームにつき 1 キーで保存され、**ループ**します（**Loop Time** オン）。同時に GameObject の名前の Animator Controller が作られ、Animator が付きます。
- フレームはクリックした順ではなく、**自然順ソート**で並びます。`characters_0, characters_1, characters_2, characters_10` の順です。自然順がそのまま再生順になるように名前を付けてください。
- 各フレームは 1/12 秒ずつ表示され、最後のフレームも同じ長さだけ表示されます。クリップの長さは `フレーム数 / Samples`（4 フレームで 0.333 秒）なので、末尾にキーを追加する必要はありません。

特定のフレームを長く見せたいときは、Animation ウィンドウの Dopesheet でそのキーを後ろにずらすか、キーを複製します。クリップ全体の速さは **Samples** で、特定のステートだけ変えたいときは Animator ウィンドウでそのステートの **Speed** を変えます。

## スクリプトで分割する：ISpriteEditorDataProvider {#script}

古い解説では `TextureImporter.spritesheet` がよく使われています。Unity 6 ではこのプロパティが obsolete 扱いで、「Support for accessing sprite meta data through spritesheet has been removed. Please use the UnityEditor.U2D.Sprites.ISpriteEditorDataProvider interface instead.」というメッセージが付いています。代わりに 2D Sprite パッケージの `SpriteDataProviderFactories` を使います。次のエディタースクリプトは 6000.5.3f1 でコンパイル・実行しました。テスト用シートでは、作られた 27 個の矩形が Sprite Editor のグリッド分割の結果と完全に一致し、全スプライトのピクセルが PNG と一致しました。

```csharp
// Assets/Editor/SpriteSheetSlicer.cs  (needs the 2D Sprite package, com.unity.2d.sprite)
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class SpriteSheetSlicer
{
    // Cuts a grid sheet into sprites named <file>_0, <file>_1 … (top-left cell first).
    // cell = frame size, pad = gap between frames, off = margin before the first frame (pixels).
    public static int Slice(string path, int cellW, int cellH, int padX = 0, int padY = 0,
                            int offX = 0, int offY = 0, float ppu = 16f, bool skipEmpty = true)
    {
        var importer = (TextureImporter)AssetImporter.GetAtPath(path);
        importer.textureType = TextureImporterType.Sprite;          // "Sprite (2D and UI)"
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = ppu;
        importer.filterMode = FilterMode.Point;                      // pixel art: no blur
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        var provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var texProvider = provider.GetDataProvider<ITextureDataProvider>();
        texProvider.GetTextureActualWidthAndHeight(out int w, out int h); // real size, not Max Size
        Texture2D pixels = skipEmpty ? texProvider.GetReadableTexture2D() : null;

        string baseName = Path.GetFileNameWithoutExtension(path);
        int cols = (w - offX + padX) / (cellW + padX);               // whole cells only
        int rows = (h - offY + padY) / (cellH + padY);
        var rects = new List<SpriteRect>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                int x = offX + c * (cellW + padX);
                int yFromTop = offY + r * (cellH + padY);
                var rect = new Rect(x, h - yFromTop - cellH, cellW, cellH); // Unity rects start bottom-left
                if (pixels != null && IsEmpty(pixels, rect)) continue;
                rects.Add(new SpriteRect
                {
                    name = baseName + "_" + rects.Count,
                    spriteID = GUID.Generate(),
                    rect = rect,
                    alignment = SpriteAlignment.BottomCenter,          // feet on the ground
                    pivot = new Vector2(0.5f, 0f),
                });
            }

        provider.SetSpriteRects(rects.ToArray());
        // Unity 2021.2+: register each name with its ID so references survive a re-slice.
        var names = provider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        names.SetNameFileIdPairs(rects.Select(s => new SpriteNameFileIdPair(s.name, s.spriteID)).ToList());
        provider.Apply();
        importer.SaveAndReimport();
        return rects.Count;
    }

    static bool IsEmpty(Texture2D tex, Rect r)
    {
        foreach (var c in tex.GetPixels((int)r.x, (int)r.y, (int)r.width, (int)r.height))
            if (c.a > 0f) return false;
        return true;
    }

    // One clip from frame indices, e.g. BuildClip(sheet, "Assets/Anim/Walk.anim", new[] {0, 1}, 8).
    public static AnimationClip BuildClip(string sheetPath, string clipPath, int[] frames, float fps, bool loop = true)
    {
        string baseName = Path.GetFileNameWithoutExtension(sheetPath);
        var sprites = AssetDatabase.LoadAllAssetsAtPath(sheetPath).OfType<Sprite>().ToDictionary(s => s.name);
        var keys = new ObjectReferenceKeyframe[frames.Length];
        for (int i = 0; i < frames.Length; i++)   // one key per frame; Unity adds 1/fps after the last key
            keys[i] = new ObjectReferenceKeyframe { time = i / fps, value = sprites[baseName + "_" + frames[i]] };

        var clip = new AnimationClip { frameRate = fps };
        var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
        AnimationUtility.SetObjectReferenceCurve(clip, binding, keys);
        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = loop;
        AnimationUtility.SetAnimationClipSettings(clip, settings);
        AssetDatabase.CreateAsset(clip, clipPath);
        return clip;
    }
}
```

メニュー項目やバッチモードの `-executeMethod` から、`SpriteSheetSlicer.Slice("Assets/Art/characters.png", 24, 24, 1, 1, 0, 0, 24f)` のように呼び出します。キーはクリップの `frameRate` で 1 フレームずつ離れて置かれます。2 フレームを 8 fps で作ったクリップは長さ 0.25 秒で、各フレームが 0.125 秒ずつ表示されます。

> **ヒント:** Sprite Editor は矩形を左下基準で保存しますが、お絵描きツールは左上から数えます。スクリプトで `y` を変換しているのはそのためです。ここを間違えると行の順番が逆になります。

:::nerulio ws=sprite
Nerulio の Studio はグリッドを代わりに見つけます。Sprite ワークスペースにシートを入れると、ピクセルからマスの大きさ・余白・隙間を測り、信頼度と候補を表示します。適用する前にすべての切り出しを確認でき、タイムラインではフレームごとの長さを持つアニメーションタグを付けられます。**Pack & Export → Unity 6** はアトラス PNG、`.unity.json`、`Editor/NerulioSpriteImporter.cs` を書き出します。Unity で **Tools → Nerulio → Import Studio JSON** を実行すると、Sprite / Multiple / Point / 非圧縮の設定、ピボット付きのフレームごとのスプライト、タグごとに 1 つの `.anim` クリップができます。
- Unity 6000.5.3f1 のバッチモードで、矩形・ピボット・ピクセル・クリップのキーと長さを検証済みです（Studio のエクスポート欄に表示）。
- Pixels Per Unit は 100 で書き出されます。プロジェクトが 16 や 32 を使っているなら、インポート前に `.unity.json` の `pixelsPerUnit` を書き換えてください。
- Sprite Editor と同じく 2D Sprite パッケージが必要です。処理はすべてブラウザー内で行われ、シートはアップロードされません。
:::

![Nerulio の Pack & Export でエンジンの書き出し先一覧に Unity 6 があり、エクスポートボタンの下に検証済みの表示が出ている画面](shot:studio-pack-export "Pack & Export で Unity 6 を選ぶと、インポーター用スクリプト入りのバンドルが出力されます。")

## FAQ {#faq}

### Sprite Editor ウィンドウが使えないと表示されるのはなぜですか？

Sprite Editor は **2D Sprite** パッケージ（`com.unity.2d.sprite`）に含まれています。3D テンプレートで作ったプロジェクトには入っていないことがあるので、**Window → Package Manager → Unity Registry** からインストールしてください。テクスチャの **Texture Type** も **Sprite (2D and UI)** になっている必要があります。

### 分割したフレームが 1〜2 ピクセルずれているのはなぜですか？

フレーム間に隙間があるシートを **Padding** 0 で分割すると、列ごとに 1 ピクセルずつずれていきます。**Padding** に隙間を、**Offset** に外側の余白を入れ、`offset + columns × cell + (columns − 1) × padding` が画像の幅と一致するか確認してください。

### Unity 6 でアニメーションの速さはどこで変えますか？

Animation ウィンドウのオプションメニューで **Show Sample Rate** をオンにし、**Samples** を変えます。スプライトを Scene にドラッグして作ったクリップは 12 から始まります。特定のステートだけ速くしたいときは、Animator ウィンドウでそのステートの **Speed** を変えてください。

### アニメーションがループしない、または 1 回だけのはずがループしてしまいます。

ループするかどうかは `.anim` アセットの **Loop Time** で決まります。スプライトをドラッグして作ったクリップはオンになっています。1 回だけの動きはオフにして、**Has Exit Time** 付きの Animator の遷移で待機に戻してください。

### Aseprite のファイルを直接読み込めますか？

できます。Unity 6 には、`.aseprite` ファイルをタグごとのクリップ付きで読み込む 2D Aseprite Importer パッケージがあります。分割した PNG との違いは [Godot・Unity・Phaser で Aseprite ファイルを使う](guide:aseprite-files-godot-unity-phaser) で比べています。

## 参考資料 {#sources}

- Unity 6.5 Manual — [Cut out sprites from a texture](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/use-editor.html)
- Unity 6.5 Manual — [Sprite Editor window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/sprite-editor-window-reference.html)
- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- 2D Sprite パッケージ 1.0 — [Sprite Editor Data Provider API](https://docs.unity3d.com/Packages/com.unity.2d.sprite@1.0/manual/DataProvider.html)
- Unity 6.5 Scripting API — [TextureImporter.spritesheet](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-spritesheet.html)
- Unity 6.5 Scripting API — [AnimationUtility.SetObjectReferenceCurve](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AnimationUtility.SetObjectReferenceCurve.html)
- Unity 6.5 Manual — [Create a new Animation Clip](https://docs.unity3d.com/6000.5/Documentation/Manual/animeditor-CreatingANewAnimationClip.html)
- テスト用素材：[Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer)、[HQ Trooper（drakzlin）](https://opengameart.org/content/space-soldier-resize-64x64)、いずれも CC0
