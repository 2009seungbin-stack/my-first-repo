2Dスプライトにノーマルマップのライティングを当てるには、レイアウトがまったく同じ画像が2枚必要です。色のついたスプライトと、表面の各部分がどちらを向いているかをピクセルごとに記録したノーマルマップです。**Godot 4**では2枚を**CanvasTexture**（DiffuseとNormal Map）にまとめ、テクスチャが設定され**Height**が0より大きい**PointLight2D**で照らします。**Unity 6**ではURPの**2D Renderer**を使い、ノーマルマップをスプライトの`_NormalMap`という**Secondary Texture**として登録し、各Light 2Dの**Normal Maps → Quality**を**Fast**か**Accurate**にします。どちらのエンジンもOpenGL形式（Y+）のノーマルマップを前提にしています。ドット絵なら、ノーマルマップもスプライトと同じくニアレスト（Nearest）フィルターでサンプリングします。

以下はすべて、Godot 4.7.2とUnity 6000.5.3f1（URP 17.5.0）で、KenneyのCC0素材*Tiny Dungeon*とNerulioのTexture Labで作ったノーマルマップを使って実際に動かした結果です。

![同じダンジョンのシーンと光源を2回レンダリングした画像。左は通常のテクスチャ、右はノーマルマップ入りのCanvasTextureで、下段は光源まわりの壁の拡大](shot:engine-normal2d-compare "Godot 4.7.2（Compatibilityレンダラー）でレンダリング：高さ30 pxのPointLight2D、LightOccluder2DによるPCF5の影。左は通常のテクスチャ、右は同じテクスチャをノーマルマップと一緒にCanvasTextureに入れたものです。レンガは光の方を向いた面だけが明るくなります。素材：Kenney Tiny Dungeon（CC0）。")

## 2Dノーマルマップの仕組み {#how-it-works}

ノーマルマップは、スプライトの1ピクセルごとに表面の向きを保存しています。赤は左右の傾き、緑は上下の傾き、青は画面の正面をどれだけ向いているかです。平らで正面を向いたピクセルは薄紫の`(128, 128, 255)`になります。エンジンは光の方を向いたピクセルを明るくするので、たいまつが左にあればレンガの左の縁が、右に動けば右の縁が光ります。

正しく見えるかどうかは、次の2点で決まります。

- **規格（Convention）。** GodotもUnityも緑を「上向き」と読みます（OpenGL、Y+）。Unreal向けツールが出力したDirectX形式を入れると、上下が逆向きに光ります。見分け方と反転方法は[OpenGLとDirectXのノーマルマップ](guide:opengl-vs-directx-normal-maps)にまとめています。
- **光源の高さ。** 2Dの光源はスプライトと同じ平面上にあります。仮想の高さがないと光が真横から入るため、正面を向いたピクセルはほとんど照らされません。

## Godot 4での設定 {#godot}

:::steps
1. **スプライトと同じレイアウトのノーマルマップを用意します。** スプライト1ピクセルにノーマル1ピクセル、同じサイズ、シートなら同じフレーム位置、OpenGL（Y+）規格にします。作り方は[後述](#making-normal-maps)します。
2. **ドット絵ならニアレストフィルターにします。** *Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter*を**Nearest**にするか、ノードの*Texture → Filter*を**Nearest**にします。CanvasTextureはディフューズとノーマルマップを同じフィルターでサンプリングします。
3. **CanvasTextureを作ります。** Sprite2D（またはAnimatedSprite2Dのフレーム、TileSetのアトラス、Controlなど）で*Texture → New CanvasTexture*を選びます。スプライトを*Diffuse → Texture*に、ノーマルマップを*Normal Map → Texture*に入れます。Specularは任意です。
4. **シーンを暗くします。** 暗い色の**CanvasModulate**を追加します。光が届かない場所の色になります。
5. **PointLight2Dを追加してTextureを設定します。** テクスチャのないPointLight2Dは何も照らしません。放射状の*GradientTexture2D*で十分で、光の大きさはテクスチャのサイズ × *Texture Scale*です。
6. **光源のHeightを上げます。** PointLight2Dの*Height*はピクセル単位です（100なら100 px離れた点を45°で照らします）。20〜100の範囲で光源を動かしながら調整します。DirectionalLight2Dの*Height*は0（平面と平行）から1（真上）です。
7. **必要なら影を付けます。** 光源の*Shadow → Enabled*をオンにします。Sprite2Dを選んで*Sprite2D → Create LightOccluder2D Sibling*を使うか、OccluderPolygon2Dを手で描きます。*Shadow → Filter*はNone、PCF5、PCF13から選べます。
8. **光源を動かして確認します。** 出っ張りは光の方を向いた側が明るくなるはずです。上下が逆に光る場合はDirectX形式なので、緑チャンネルを反転します。
:::

同じシーンをコードで組むと次のとおりです。Godot 4.7.2でこのまま実行しました。

```gdscript
# lit_scene.gd: attach to a Node2D. Builds a normal-mapped sprite, a light and a shadow.
extends Node2D

func _ready() -> void:
	# 1. Diffuse + normal map in one CanvasTexture
	var tex := CanvasTexture.new()
	tex.diffuse_texture = preload("res://art/knight.png")
	tex.normal_texture = preload("res://art/knight_n.png")  # OpenGL (+Y) normal map
	var knight := Sprite2D.new()
	knight.texture = tex
	knight.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST  # pixel art: diffuse AND normal
	knight.scale = Vector2(4, 4)
	knight.position = Vector2(288, 160)
	add_child(knight)

	# 2. A shadow caster at the sprite's feet
	var occluder := LightOccluder2D.new()
	var poly := OccluderPolygon2D.new()
	poly.polygon = PackedVector2Array([Vector2(-5, 4), Vector2(5, 4), Vector2(5, 7), Vector2(-5, 7)])
	occluder.occluder = poly
	knight.add_child(occluder)

	# 3. Darken everything the light does not reach
	var ambient := CanvasModulate.new()
	ambient.color = Color(0.15, 0.15, 0.2)
	add_child(ambient)

	# 4. A point light: it needs a texture, and a height for normal mapping
	var falloff := Gradient.new()
	falloff.set_color(0, Color.WHITE)   # centre
	falloff.set_color(1, Color.BLACK)   # edge
	var shape := GradientTexture2D.new()
	shape.width = 256              # light size = texture size x texture_scale
	shape.height = 256
	shape.gradient = falloff
	shape.fill = GradientTexture2D.FILL_RADIAL
	shape.fill_from = Vector2(0.5, 0.5)
	shape.fill_to = Vector2(1.0, 0.5)
	var light := PointLight2D.new()
	light.texture = shape          # without a texture the light draws nothing
	light.texture_scale = 2.0
	light.height = 30.0            # pixels; at 0 flat normal-mapped areas stay dark
	light.shadow_enabled = true
	light.shadow_filter = Light2D.SHADOW_FILTER_PCF5
	light.position = Vector2(200, 110)
	add_child(light)
```

> **GradientTexture2Dの既定サイズは64×64しかありません。** そのままだと上の光源の半径は64 pxで、100 px離れたスプライトに届きません。そのためスニペットでは`width`と`height`を指定しています。

### 光源の高さ：「ノーマルマップが効かない」の一番の原因 {#light-height}

PointLight2Dの*Height*の既定値は**0**です。0だと光がスプライトと平行に入るので、正面を向いたノーマルマップのピクセルはほとんど照らされません。テストシーンでは、高さ0の光源のままノーマルマップをオンにすると画面がほぼ真っ黒になりました（平均輝度は255中22、ノーマルマップなしでは84）。Godotのマニュアルも*Height*を上げるよう案内しています。30 pxで立体感が出て、150 pxでは光がほぼ真上から来るため再び明るく平坦になります。

ノーマルマップを入れたスプライトは、入れていないスプライトより暗くなるのが普通です。ノーマルマップのないスプライトは、光を完全に正面から受けているものとして計算されるからです。ノーマルマップを外すのではなく、光源の*Energy*を上げてください。

### ドット絵：ノーマルマップにもニアレストフィルター {#pixel-art}

ノーマルマップがぼやけてサンプリングされると、色がくっきりしていてもピクセルの境目ごとにハイライトがにじみます。3倍に拡大したスプライトをDirectionalLight2Dで照らし（ライティングがノーマルだけで決まるように）確かめました。

- ノードの*Texture Filter*が**Nearest**：画面上の3×3ブロックはすべて単色でした（9,216個中0個が変化）。2枚ともニアレストでサンプリングされています。
- ノードのフィルターが**Linear**：9,216個すべてのブロックで色が混ざりました。
- CanvasTexture自身の*Texture Filter*が*Inherit*以外なら、ディフューズとノーマルマップの両方でノードの設定より優先されます。

つまり1つの設定で2枚とも切り替わります。ノーマルマップはスプライトの原寸で作り、ロスレスのままにしてください。VRAM圧縮もミップマップも、隣り合うノーマルを平均してしまいます。そのほかのドット絵向け設定は[Godot 4 ドット絵がぼやける・ガタつく](guide:godot-4-pixel-art-blurry-jitter)を参照してください。

### スプライトシート、AnimatedSprite2D、TileMap {#sheets-and-tilemaps}

ノーマルマップは、フレーム単位までスプライトとレイアウトをそろえる必要があります。テクスチャがCanvasTextureなら、シートを描く一般的な方法ではどれもノーマルマップが保たれます。左と右から順に照らしたとき、変化したピクセル数は次のとおりです。

- *Atlas*がCanvasTextureの**AtlasTexture**領域で作ったSpriteFramesを使う**AnimatedSprite2D**：16,384個中2,864個
- CanvasTextureに*Hframes*/*Vframes*を使う**Sprite2D**：同じ結果
- TileSetAtlasSourceの*Texture*がCanvasTextureの**TileMapLayer**：16,384個中12,800個
- 比較用に、通常のPNGから切り出した同じフレーム：0個

スプライトをアトラスにパックするなら、ノーマルマップもまったく同じレイアウトでパックするか、完成したアトラスからノーマルマップを作ってください。トリミングと回転もそろえる必要があります。詳しくは[スプライトシートとテクスチャアトラスの違い](guide:sprite-sheet-vs-texture-atlas)で解説しています。

*Specular*は任意です。グレースケールの*Specular → Texture*で光沢のあるピクセル（金属、濡れた石）を指定し、*Shininess*でハイライトの鋭さを、*Color*で色味を決めます。

## Unity 6での設定（URP 2D Renderer） {#unity}

Unityの2DライトにはURPの**2D Renderer**が必要です。**Universal 2D**プロジェクトテンプレートには最初から入っています（6000.5.3f1に同梱のテンプレートには`Assets/Settings/Renderer2D.asset`と、*Global Light 2D*を置いたシーンがあります）。既存のURPプロジェクトなら、*Assets → Create → Rendering → URP Asset (with 2D Renderer)*でアセットを作り、*Project Settings → Graphics*（品質レベルで上書きしている場合は*Quality*も）で有効なレンダーパイプラインに設定します。

1. **ノーマルマップをインポートします。** *Texture Type*を**Normal Map**にします。マニュアルの指示どおりsRGBもオフになります。ドット絵なら*Filter Mode*を**Point**、*Compression*を**None**にします。
2. **スプライトに登録します。** スプライトのテクスチャを選んで*Sprite Editor*を開き、ドロップダウンから**Secondary Textures**を選んで**+**を押します。*Name*を`_NormalMap`、*Texture*をノーマルマップにします。Unityはスプライトと同じUVでサンプリングするので、レイアウトが一致している必要があります。
3. **ライティング対応のマテリアルを使います。** 2D Rendererでは、新しいSprite Rendererに**Sprite-Lit-Default**が割り当てられ、これが`_NormalMap`を読みます。
4. **光源を追加します。** *GameObject → Light → Spot Light 2D*を使います（APIではこのライトタイプの名前はまだ`Point`です）。
5. **その光源でノーマルマップを有効にします。** **Normal Maps**の折りたたみを開き、*Quality*を**Fast**か**Accurate**にします。新しい光源はすべて**Disabled**から始まります。*Distance*（既定値3）はスプライトから光源までの仮想の高さで、Godotの*Height*に当たります。（マニュアルでは*Use Normal Map* / *Normal Map Quality*と書かれていますが、6000.5.3f1のインスペクターでは*Quality*と*Distance*と表示されます。）
6. **グローバルライトを弱めます。** テンプレートの*Global Light 2D*は強度1で、すべてを均一に照らして立体感を消してしまいます。0.1〜0.3程度に下げてください。
7. **影（任意）。** 光を遮るスプライトに**Shadow Caster 2D**コンポーネントを追加し、光源の*Shadows*セクションで*Strength*を調整します。

エディタースクリプトでノーマルマップを登録するなら、次のコードが使えます。6000.5.3f1のバッチモードで実行したものです。

```csharp
// Editor/NormalMapImport.cs: pixel-art sprite + its normal map as the _NormalMap secondary texture
using UnityEditor;
using UnityEngine;

public static class NormalMapImport
{
    public static void Assign(string spritePath, string normalPath)
    {
        var n = (TextureImporter)AssetImporter.GetAtPath(normalPath);
        n.textureType = TextureImporterType.NormalMap;   // also sets sRGB off
        n.filterMode = FilterMode.Point;                 // pixel art: Point on the normal map too
        n.mipmapEnabled = false;
        n.textureCompression = TextureImporterCompression.Uncompressed;
        n.SaveAndReimport();

        var d = (TextureImporter)AssetImporter.GetAtPath(spritePath);
        d.textureType = TextureImporterType.Sprite;
        d.filterMode = FilterMode.Point;
        d.secondarySpriteTextures = new[] {
            new SecondarySpriteTexture { name = "_NormalMap", texture = AssetDatabase.LoadAssetAtPath<Texture2D>(normalPath) }
        };
        d.SaveAndReimport();
    }
}
```

URP 17.5では、Light 2Dの`normalMapQuality`と`normalMapDistance`にpublicなsetterがありません。インスペクターで設定するか、エディターコードなら`SerializedObject`経由で`m_NormalMapQuality` / `m_NormalMapDistance`を変更してください。

![Unityで同じシーンをレンダリングした画像。左はノーマルマップDisabled、右はAccurateで、下段は壁の拡大](shot:engine-normal2d-unity "Unity 6000.5.3f1、URP 17.5.0の2D Renderer（バッチモード、Direct3D 12）でレンダリング：Sprite-Lit-Default、_NormalMapのセカンダリテクスチャ、Spot Light 2Dが1つと強度0.15のGlobal Light 2D。左はNormal Maps QualityがDisabled、右はAccurate、Distance 1です。素材：Kenney Tiny Dungeon（CC0）。")

この実行では*Distance*を下げるほど立体感が強くなり、この小さなシーンでは*Fast*と*Accurate*の結果がピクセル単位で同じでした。実際の素材で両方を比べてみてください。ノーマルマップにはコストがあります。マニュアルによると、Unityはレイヤーバッチごとに画面サイズのレンダーテクスチャへ深度プリパスを追加します。

**Sprite Atlas**では、セカンダリテクスチャもスプライトと一緒にパックされます。アトラスに入れるすべてのスプライトに同じセカンダリテクスチャのセットを持たせないと、まとめられたノーマルマップのページに空きが多く出ます。

## スプライト用ノーマルマップの作り方 {#making-normal-maps}

| 方法 | 向いているもの | ツール |
|---|---|---|
| 明度から生成（「明るい＝高い」） | 石、レンガ、木、質感のあるタイル、手早い確認 | Nerulio Texture Lab、[Laigter](https://github.com/azagaya/laigter)、[SpriteIlluminator](https://www.codeandweb.com/spriteilluminator) |
| アルファの縁から生成（ベベル） | 丸いアイテム、UI、シルエット | Laigter、SpriteIlluminator、Nerulio（*高さの取得元：アルファチャンネル*） |
| ライティングプロファイルを描いて生成 | 立体感の欲しいキャラクター | [Sprite Lamp](http://www.snakehillgames.com/spritelamp/)（別方向から照らした絵を2〜5枚） |
| ノーマルを手描き | キービジュアル、1ピクセルが大事な小さいドット絵 | 任意のペイントソフト＋ノーマル用パレット |
| 3Dからレンダリング | プリレンダースプライト | 3Dソフトのノーマルパス |

自動生成したノーマルマップは出発点にすぎません。明るさは高さではないので、暗い目や黒い輪郭線は穴として読まれます。光源を動かして確認してください。Godotのマニュアルは Laigter（無料、GPL-3.0、2Dライトのプレビュー付き）を紹介しており、SpriteIlluminatorには立体を手で整えるブラシがあります。

シート全体から生成するときは、フレームの間に透明ピクセルを空けてください。3×3カーネルは隣のフレームを1ピクセル、5×5カーネルは2ピクセル読みます。

:::nerulio tool=texture-lab
Texture Labの**ノーマル**ステージは、スプライトやタイルをブラウザー内でノーマルマップに変換します。ファイルはアップロードされません。画像を高さとして読み、それに対応するノーマルを書き出すので、シートやアトラスのレイアウトはそのまま保たれます。規格は画面に表示し、推測はしません。
- PNGをドロップして**ハイト → ノーマル**を選び、Godot・Unity向けなら**規格：OpenGL +Y**を選びます。
- **強さ**（0〜10、既定値2）を決めます。*詳細設定*で**微分カーネル**（Sobel 3×3、Scharr 3×3、Sobel 5×5）、**高さの取得元**（明度またはアルファチャンネル）、タイルなら**端をつないでサンプリング**を選びます。
- **ノーマルマップを保存（PNG）**を押すと、原寸の`<名前>-normal.png`が保存されます。上のレンダリングに使ったノーマルマップもこのボタンで作りました。
- DirectX形式のノーマルマップが手元にあるなら、**OpenGL ↔ DirectX**で緑チャンネルを正確に反転できます。
- 制限：一度に1枚ずつ、2Dライトのプレビューなし（Previewステージは3Dマテリアルのプレビュー）、スペキュラマップの生成なし。
:::

![Nerulio Texture Labのノーマルステージ：ダンジョンタイルの元画像、生成したノーマルマップ、OpenGL/DirectXの規格選択](shot:lab-texture-normal "Nerulio Texture Lab：OpenGL +Y規格でのハイト → ノーマルと、エンジンごとの想定規格の表。")

## よくある質問 {#faq}

### Godot 4でノーマルマップがまったく効きません {#faq-godot-no-effect}

テクスチャは通常のPNGではなくCanvasTextureにする必要があります。PointLight2DにはTextureが必要で、光が届く範囲はそのテクスチャのサイズ × Texture Scaleです。Heightは0より大きくしてください。0のままだと平らなノーマルマップ部分はほぼ真っ黒です。スプライトのLight Maskと光源のItem Cull Maskが一致しているかも確認します。

### Unityのスプライトがノーマルマップを無視します {#faq-unity-ignored}

新しいLight 2DはすべてNormal Maps → QualityがDisabledです。FastかAccurateにしてください。プロジェクトが2D Rendererを使っているか、マテリアルがSprite-Lit-Default（またはライティング対応のShader Graph）か、セカンダリテクスチャの名前が正確に`_NormalMap`かも確認します。

### GodotとUnityのノーマルマップはOpenGLとDirectXのどちらですか？ {#faq-convention}

どちらもOpenGL形式（Y+）を前提にしています。上下の光り方が逆に見えるなら、ノーマルマップの緑チャンネルを反転してください。Godotはインポート設定の*Normal Map Invert Y*、Unityは*Flip Green Channel*で対応できます。

### ドット絵のノーマルマップもNearestフィルターにすべきですか？ {#faq-nearest}

はい。GodotのCanvasTextureはノーマルマップをスプライトと同じフィルターでサンプリングするので、ノード・CanvasTexture・プロジェクト既定値のどれかをNearestにすれば両方に効きます。Unityではノーマルマップ自体のFilter ModeをPoint、CompressionをNoneにしてください。

### TileMapやアニメーションするスプライトにもノーマルマップは使えますか？ {#faq-tilemap-animation}

どちらのエンジンでも使えます。Godotでは、TileSetのアトラステクスチャや、SpriteFrames内のAtlasTextureのアトラスにCanvasTextureを使います。Unityでは、スプライトシートごとに`_NormalMap`のセカンダリテクスチャを設定すれば同じスライスに従います。

## 参考資料 {#sources}

- Godot Engine 4.7 ドキュメント：[2D lights and shadows](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html)
- Godot 4.7 クラスリファレンス：[CanvasTexture](https://docs.godotengine.org/en/stable/classes/class_canvastexture.html)、[PointLight2D](https://docs.godotengine.org/en/stable/classes/class_pointlight2d.html)、[DirectionalLight2D](https://docs.godotengine.org/en/stable/classes/class_directionallight2d.html)、[Light2D](https://docs.godotengine.org/en/stable/classes/class_light2d.html)
- Godot 4.7 クラスリファレンス：[ProjectSettings, rendering/textures/canvas_textures/default_texture_filter](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)
- Unity 6.5（6000.5）マニュアル：[Add a normal map or a mask map to a sprite in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/SecondaryTextures.html)
- Unity 6.5 マニュアル：[Light 2D component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2DLightProperties.html)
- Unity 6.5 マニュアル：[Create a 2D light in URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-light-properties-explained.html)
- Unity 6.5 マニュアル：[Set up a project for 2D games with the Universal 2D template](https://docs.unity3d.com/6000.5/Documentation/Manual/setup-project-2d-game.html)
- Unity 6.5 マニュアル：[Create a sprite atlas](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/create-sprite-atlas.html)
- Laigter：[GitHubリポジトリ（GPL-3.0）](https://github.com/azagaya/laigter)
- CodeAndWeb：[SpriteIlluminator](https://www.codeandweb.com/spriteilluminator)
- Snake Hill Games：[Sprite Lamp](http://www.snakehillgames.com/spritelamp/)
