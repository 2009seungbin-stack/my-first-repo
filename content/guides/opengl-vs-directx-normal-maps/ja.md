OpenGL形式とDirectX形式のノーマルマップの違いは、緑（Y）チャンネルの向きだけです。OpenGL形式（Y+）では明るい緑が「この斜面は画像の上を向いている」という意味になり、DirectX形式（Y−）ではその逆になります。Godot、Unity、Blender、glTFはOpenGL形式を前提とし、Unreal EngineはDirectX形式で扱います。変換は緑チャンネルだけを反転します（新しいG = 255 − G）。いちばん簡単なのはエンジン側のインポート設定で、Godotなら **Normal Map Invert Y**、UnityとUnrealなら **Flip Green Channel** です。

形式を取り違えると、出っ張りがへこみに見え、上から当てたライトが下から当たっているように見えます。赤と青のチャンネルもファイルサイズも変わらないため、気づきにくいミスです。

![同じベベル形状を3つ並べ、それぞれ真上のライトで照らした画像：正しい見え方、下から照らされたような見え方、再び正しい見え方](shot:engine-normal-yflip-render "Godot 4.7.2（Compatibilityレンダラー）でレンダリングしました。2DのCanvasTextureと、各形状の真上に置いたPointLight2Dを使っています。左：OpenGL形式のマップ。中央：同じマップのDirectX版をそのままインポートした結果で、ドームがへこみになり、下側のベベルに光が当たっています。右：同じDirectXファイルでNormal Map Invert Yをオンにした結果です。")

## エンジン・ツールごとの前提 {#which-convention}

| エンジン・ツール | 前提の形式 | 緑を反転する場所 | 公式に明記? |
|---|---|---|---|
| Godot 4.7（3D・2D） | OpenGL、Y+ | Importドック → **Normal Map Invert Y** | はい、マニュアル |
| Unity 6 | OpenGL、Y+ | Texture Type **Normal map** → **Flip Green Channel** | はい、マニュアル |
| Unreal Engine 5 | DirectX、Y− | テクスチャエディタ → **Flip Green Channel** | 推定（下記参照） |
| Blender（5.2マニュアル） | 既定はOpenGL | Normal Mapノード → **Convention** | はい、マニュアル |
| Substance 3D Painter | プロジェクトごとに設定 | プロジェクトの **Normal Map Format**、書き出しは **Normal OpenGL** / **Normal DirectX** | はい |
| glTF 2.0ファイル | +Yが上（OpenGL） | 書き出す前にテクスチャを合わせる | はい、仕様書 |

Epicのテクスチャのドキュメントは、Flip Green Channelを「一部のノーマルマップで役立つ」と説明しているだけで、形式の名前は書いていません。UnrealをY−とした根拠は別の2つです。AdobeのPainterのドキュメントは、Unreal（と3ds Max）にはDirectX、Unity・Maya・BlenderにはOpenGLを推奨しています。また、EpicのglTFエクスポーターには緑を反転して「UnrealからglTFの規約へ」合わせる `adjust_normalmaps` オプションがあり、glTFは+Yが上です。

Godotの2Dライティングも同じ規則です。上のレンダーでは、OpenGL形式のマップを入れた `CanvasTexture` と真上の `PointLight2D` で、ドームの上側が明るくなっています。2Dでの設定手順は [2Dノーマルマップとライティング](guide:2d-normal-maps-lighting-godot-unity) で解説しています。

## 緑チャンネルの意味 {#green-channel}

タンジェント空間のノーマルマップは、ピクセルごとに1つの向きを保存しています。赤がX（テクスチャの右方向）、緑がY、青がZ（表面の外側、見る人の方向）です。−1〜1の値を0〜255で保存するため、平らなピクセルはおよそ `(128, 128, 255)`、おなじみの薄紫色になります。

2つの形式は赤と青では一致していて、+Yの向きだけが違います。OpenGLは **画像の上方向**、DirectXは **画像の下方向** です。そのため、テクスチャの上を向いた斜面は、OpenGL形式ではGが128より大きく、DirectX形式では128より小さくなります。変換は全ピクセルに `G' = 255 − G` を適用するだけで、2回行うと元のバイトに戻ります。ベクトルの長さも1のままなので、「正しいノーマルマップか」のチェックはどちらも通ります。

## 手元のマップがどちらかを見分ける {#identify}

ファイル内に形式を記録するメタデータはなく、どちらも正しいデータです。手早い方法から確実な方法の順に確認します。

1. **ファイル名。** 両方を配布しているライブラリは多く、ambientCGは `_NormalGL` と `_NormalDX`、Poly Havenは `nor_gl` と `nor_dx` で区別しています。Substance 3D Painterから書き出したものなら、書き出しプリセットが **Normal OpenGL** と **Normal DirectX** のどちらの変換マップを使ったかを確認します。
2. **確実に出っ張っている部分を見る。** リベット、レンガ、ボタンなどです。OpenGL形式では上の縁が緑、下の縁が紫で、右上から光が当たっているように見えます。DirectX形式では緑が下の縁にあり、右下から光が当たっているように見えます。
3. **ライトで確かめる。** オブジェクトの **真上** にライトを1つ置き、同じ部分を見ます。下の縁に光が当たっていれば、そのエンジンには合わない形式です。

![OpenGL形式のテストマップとDirectX版をライティングなしで描いた画像：左は上の縁、右は下の縁が緑](shot:engine-normal-yflip-maps "Godot 4.7.2がライティングなしで描いた2枚のテストマップです。左：OpenGL（Y+）、上向きの斜面が緑。右：DirectX（Y−）、同じマップに G = 255 − G を適用したものです。")

> **ヒント：** ライトは横ではなく、上か下に置いて確かめます。完全に水平なディレクショナルライトでは、法線のY成分がライティングにまったく影響しないため、2つの形式が同じに見えます。近くのポイントライトを横に置くと差は出ますが、ずっと小さくなります。

## ノーマルマップを変換・反転する {#convert}

:::steps
1. **使う側の前提を確認します。** Godot、Unity、Blender、glTFはOpenGL（Y+）、Unreal EngineはDirectX（Y−）です。上の表を参照します。
2. **手元のマップの形式を確認します。** ファイル名を見て、オブジェクトの上にライトを置いて確かめます。
3. **Godot 4：インポートで反転します。** FileSystemドックでテクスチャを選び、Importドックで **Process → Normal Map Invert Y** をオンにして **Reimport** を押します。`.import` ファイルに `process/normal_map_invert_y=true` が書き込まれます。
4. **Unity 6：インポートで反転します。** テクスチャを選び、Inspectorで **Texture Type** を **Normal map** にして **Flip Green Channel** にチェックを入れ、**Apply** を押します。
5. **Unreal Engine：テクスチャエディタで反転します。** テクスチャを開いて **Flip Green Channel** にチェックを入れ、アセットを保存します。
6. **またはファイル自体を一度だけ変換します。** 画像編集ソフトで緑チャンネルだけを選んで反転します（255 − G）。赤・青・アルファには触れず、圧縮による劣化が出ないようPNGで保存します。
7. **もう一度確かめます。** 真上にライトを1つ置いたとき、出っ張りの上の縁が明るくなれば正解です。反転は1か所だけで行います。変換済みのファイルにインポート設定まで重ねると、元に戻ってしまいます。
:::

できればインポート設定を使うのがおすすめです。元のファイルは受け取ったままにしておけて、あとで別のエンジンに移るときもチェックボックス1つで済みます。

## Godot 4の詳細 {#godot}

手順3のあと、テクスチャの `.import` ファイルの該当行は次のようになります。

```ini
; nm_directx.png.import（該当行のみ）
[params]
compress/normal_map=0
process/normal_map_invert_y=true
```

Godot 4.7.2でDirectX形式のテストマップをこの設定でインポートし、インポート後のピクセルを読み戻して確認しました。緑チャンネルは反転され、OpenGL形式の元データと1/255（丸め誤差）以内で一致し、赤と青は変わりませんでした。Godot 4.7には同じ結果になる別の方法もあります。**Process → Channel Remap → Green → Green Inverted**（`.import` ファイルでは `process/channel_remap/green=5`）です。どちらか一方だけを使います。

`compress/normal_map`（既定値はDetect）は別の設定です。テクスチャがノーマルマップとして使われているとGodotが検出したときに、赤と緑だけを残すRGTC圧縮に切り替えるもので、形式は変えません。

実行時に読み込んだテクスチャなど、再インポートできない場合は、2Dノードならシェーダーで緑を反転できます。ノードのマテリアルに設定し、DirectX形式のマップはCanvasTextureのノーマルのスロットにそのまま入れておきます。

```glsl
// flip_green.gdshader: use a DirectX (Y-) normal map on a 2D node without re-importing it
shader_type canvas_item;

void fragment() {
	vec3 n = texture(NORMAL_TEXTURE, UV).rgb;
	n.g = 1.0 - n.g; // DirectX (Y-) -> OpenGL (Y+), which Godot expects
	NORMAL_MAP = n;
}
```

レンダリングしてみると、インポート設定を使った結果と同じに見えました。差があったのはドームの縁のいちばん急なピクセルだけで、最大21/255でした。`flip_h = true` でスプライトを反転する場合、ノーマルマップを別に用意する必要はありません。Godot 4.7.2が法線のXを自動で反転し、テストでも反転したスプライトはライト側の面が明るく描かれました。

## Unity 6の詳細 {#unity}

**Normal map** のテクスチャタイプではsRGBが自動でオフになり（インポーターの値は `sRGBTexture = false`）、**Flip Green Channel** はスクリプトでは `TextureImporter.flipGreenChannel` です。DirectX形式のマップを含むライブラリをまとめて直すなら、アセットポストプロセッサーでインポート時に設定させます。

```csharp
// Assets/Editor/FlipDirectXNormals.cs
using UnityEditor;

// Imports every texture whose file name ends in _NormalDX or _nor_dx as a normal map
// and flips its green channel, so DirectX-style (Y-) maps work in Unity, which expects OpenGL (Y+).
public class FlipDirectXNormals : AssetPostprocessor
{
    void OnPreprocessTexture()
    {
        string name = System.IO.Path.GetFileNameWithoutExtension(assetPath).ToLowerInvariant();
        if (!name.EndsWith("_normaldx") && !name.EndsWith("_nor_dx")) return;

        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.NormalMap;
        importer.flipGreenChannel = true;
    }
}
```

Unity 6000.5.3f1で、`brick_NormalDX.png` という名前のDirectX形式のテストマップがこのスクリプトを通ってNormal map、Flip Green Channelオンでインポートされ、インポート後のピクセルはOpenGL形式の元データと完全に一致しました。スクリプトはインポートのたびに実行されるため、名前が一致するファイルではこの2つの設定を手で変えても上書きされます。スクリプトを入れる前にインポートしたファイルは **Reimport** が必要です。

URPの2Dレンダラーで照らすスプライトの場合、ノーマルマップはスプライトのセカンダリテクスチャとして設定します。手順は [2Dノーマルマップとライティング](guide:2d-normal-maps-lighting-godot-unity) で解説しています。

## Unreal、Blender、Substance {#other-tools}

- **Unreal Engine。** Y+のソース（Blender、`_NormalGL` ファイル、Unity向けのアセットパック）から来たマップは、テクスチャエディタで **Flip Green Channel** をオンにします。逆に、Unreal向けに作られたマップはGodotやUnity側で反転します。
- **Blender。** Normal Mapノードの既定はOpenGLです。現行のマニュアル（5.2 LTS）には、DirectX形式のマップ用に **Convention** プロパティが記載されています。使っているバージョンのノードにこのプロパティがなければ、ノードの手前で緑を反転します。Separate Color → Subtractに設定したMathノード（1 − G）→ Combine Colorの順です。
- **Substance 3D Painter。** プロジェクトの **Normal Map Format** が影響するのはビューポートとベイカーだけで、Adobeのドキュメントによるとレイヤースタックとは独立しています。レイヤーやツールに読み込んだノーマルマップは既定でDirectX形式として扱われ、マップ横の小さな矢印から変更できます。書き出し時は、使うエンジンに合わせて変換マップ **Normal OpenGL** か **Normal DirectX** を選びます。

## チャンネルの詰め方が違う場合 {#packed-channels}

「緑を反転する」は、正確には「Yが入っているチャンネルを反転する」という意味です。いま見ているファイルで、それが常に緑とは限りません。

- **2チャンネルのノーマルマップ。** BC5/RGTCなどの形式はXとYだけを保存し、Zはシェーダーが計算し直します。GodotのNormal Map圧縮も赤と緑だけを残します。この場合、青は意味を持たず、Yは緑のままです。
- **Unityがインポートしたノーマルマップはチャンネルが並べ替え（スウィズル）されます。** WindowsのUnity 6000.5.3f1で非圧縮のNormal mapをスクリプトから読むと、R = 255、G = Y、B = Y、A = Xになっていました。シェーダーはこの配置を自動で解釈します。ただしスクリプトでインポート済みテクスチャを読んでも元のRGBではないため、インポート済みテクスチャをピクセルのループで直すのではなく、元ファイルを変えるかインポーター設定を使います。
- **パックされたディテールマップ。** Unity HDRPのディテールマップは、アルベド（赤）、スムースネス（青）と一緒に、法線のYを緑、法線のXをアルファに保存します。これを反転するときも緑だけを反転します。

うまくいかない方法も2つあります。画像を上下反転するとピクセルがUVからずれ、全チャンネルを反転するとX（赤）まで反転し、青が表面の内側を向いてしまいます。

:::nerulio tool=normal-map-converter
Nerulioのノーマルマップ変換はテクスチャラボの **ノーマル** 段階で、ブラウザの中で動きます。ファイルはアップロードされません。**OpenGL ↔ DirectX** モードは緑チャンネルだけを反転し、2回変換すると元のバイトに戻ります。PNGはcanvasを通さずバイト単位でデコードするため、ラボのテストで赤・青・アルファはそのまま、`G' = 255 − G` が正確に成り立つことを確認しています。
- ノーマルマップをドロップし、**OpenGL ↔ DirectX** を選んで **ノーマルマップを保存（PNG）** を押します。
- **プレビュー** 段階で **ノーマルマップをDirectXとして見る（緑を反転）** にチェックを入れると、同じライトの下で2つの解釈を比べられます。エンジンのレンダラーではなく、近似のプレビューです。
- **ハイト → ノーマル** は、選んだ **規格**（**OpenGL +Y** または **DirectX −Y**）で新しいマップを作ります。
- ファイルがどちらの形式かは判定できません。確実に判定する方法はどこにもありません。代わりに、エンジンごとの前提を根拠のドキュメント付きで示し、変換します。
:::

![Nerulioテクスチャラボのノーマル段階：元画像と結果、OpenGL・DirectXの規格ボタン、エンジンごとの前提の一覧](shot:lab-texture-normal "テクスチャラボのノーマル段階：規格の切り替えボタンと、項目ごとに根拠のドキュメントが付いたエンジン一覧です。")

## FAQ {#faq}

### UnityのノーマルマップはOpenGLとDirectXのどちらですか?
OpenGLです。Unityのマニュアルに「Unity uses Y+ normal maps, sometimes known as OpenGL format.」と書かれています。DirectX形式のマップは、Texture TypeをNormal mapにしてFlip Green Channelにチェックを入れます。

### Unreal EngineはDirectX形式のノーマルマップですか?
はい、UnrealはDirectX形式（Y−）のマップで扱います。Epicのドキュメントにそのままの言葉では書かれていませんが、AdobeはUnrealにDirectXを推奨しており、EpicのglTFエクスポーターはglTFの+Yに合わせるため緑を反転します。OpenGL形式のマップにはFlip Green Channelをオンにします。

### GodotのノーマルマップはOpenGLとDirectXのどちらですか?
Godotのマニュアルにある通り、OpenGL（X+、Y+、Z+）です。CanvasTextureを使う2Dライティングも同じです。DirectX形式のマップは、ImportドックでNormal Map Invert Yをオンにして再インポートします。

### DirectX形式のノーマルマップは画像の上下反転で直せますか?
いいえ。上下反転は全ピクセルの位置を動かすため、テクスチャがモデルのUVと合わなくなり、ライティングも正しくなりません。緑チャンネルの値だけを反転するか、エンジンの反転設定を使います。

### ノーマルマップがOpenGLかDirectXか、どう見分けますか?
まずファイル名（`_NormalGL`/`_NormalDX`、`nor_gl`/`nor_dx`）を確認します。次に出っ張っている部分を見て、上の縁が緑ならOpenGL、下の縁が緑ならDirectXです。エンジンでオブジェクトを真上から照らせば確実にわかります。

## Sources {#sources}

- [Importing images, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html)
- [ResourceImporterTexture, Godot Engine 4.7 class reference](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html)
- [Standard Material 3D and ORM Material 3D, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/3d/standard_material_3d.html)
- [2D lights and shadows, Godot Engine 4.7 documentation](https://docs.godotengine.org/en/4.7/tutorials/2d/2d_lights_and_shadows.html)
- [Introduction to normal maps (bump mapping), Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/StandardShaderMaterialParameterNormalMap.html)
- [Normal map texture type, Unity 6.5 Manual](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-normal-map.html)
- [TextureImporter.flipGreenChannel, Unity 6.5 Scripting API](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-flipGreenChannel.html)
- [Mask and detail maps, Unity HDRP 17.1 documentation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/Mask-Map-and-Detail-Map.html)
- [Texture Asset Editor, Unreal Engine documentation](https://dev.epicgames.com/documentation/en-us/unreal-engine/texture-asset-editor-in-unreal-engine)
- [unreal.GLTFExportOptions (adjust_normalmaps), Unreal Engine Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/GLTFExportOptions)
- [Normal Map Node, Blender 5.2 LTS Manual](https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/normal_map.html)
- [Project configuration, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/interface/project-configuration.html)
- [Normal map looks incorrect when loaded in layer or tool properties, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/technical-support/workflow-issues/tools-issues/normal-map-looks-incorrect-when-loaded-in-layer-or-tool-properties.html)
- [Output templates, Adobe Substance 3D Painter](https://helpx.adobe.com/substance-3d-painter/getting-started/export/export-window/output-templates.html)
- [What is the difference between the OpenGL and DirectX normal format?, Adobe Substance 3D bakers](https://helpx.adobe.com/substance-3d-bake/common-questions/what-is-the-difference-between-the-opengl-and-directx-normal-format.html)
- [glTF 2.0 material schema (normalTexture), Khronos Group](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json)
