デュアルグリッド(dual grid)のタイルマップは、地形データを1つのグリッドに持ち、画面には半タイルずらした2つ目のグリッドで描きます。描かれるタイルはどれも論理セル4つが接する点に置かれるので、4つの角のどれが埋まっているかさえわかれば十分です。ブロブ型オートタイルの47通りではなく、**16通り(タイル15枚+空)** で済みます。Godot 4では2つのTileMapLayerで作ります。非表示の論理レイヤーと、半タイルずらした表示レイヤーで、表示レイヤーは短いスクリプトが4角のマスクから埋めていきます。

以下では、数が合う理由、実際に動かして確かめたGDScriptの実装、GodotのMatch Cornersモードとの違い(これはデュアルグリッドでは *ありません*)、Tiledでの対応機能を順に説明します。

![論理グリッドを重ねて表示した、Godot 4.7.2で描画したデュアルグリッドのマップ](shot:engine-dual-grid "下のdual_grid.gdスクリプトと、Wisp0468(OpenGameArt)によるCC0の\"Wang S-V2\" 2コーナーテンプレート(32pxタイル、2倍表示)を使いGodot 4.7.2で描画。細い線が論理(ワールド)グリッド、点が塗ったセルで、描かれたタイルは半タイルずれ、グリッドの交点に中心があります。")

## 47枚ではなく16枚で済む理由 {#why-16}

通常のオートタイルでは、タイルは論理セルの *上に* 置かれ、そのセルが周囲8セルとどう接するかを表す必要があります。周囲8セルの組み合わせは256通りで、角は両隣の辺がどちらも埋まっているときだけ意味を持つため、47通りにまとまります([Godot 4のテレインと47タイルのブロブ](guide:godot-4-terrain-autotile-47-blob)を参照)。

デュアルグリッドは描くタイルをずらし、タイルの中心が **グリッドの交点**(論理セル4つが接する点)に来るようにします。描かれるタイルの4分の1ずつが、ちょうど1つの論理セルに対応するので、タイルが答える問いは「NW・NE・SE・SWのセルは埋まっているか」の4つだけです。2⁴ = 16通りになります。すべて空の組み合わせはふつう何も描かないので、描くタイルは15枚で、その多くは互いに回転した形です。ブロブのセットを大きくしている「この角は内角か外角か」という問題が消えます。角のセルそのものがデータだからです。

これはタイリングの分野で **2コーナーWangセット** と呼ばれるもので、Godot 3の「2×2」ビットマスクと同じセットです。この手法はOskar Stålbergの作品と、jess::codesの動画 [Draw fewer tiles – by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg) で広く知られるようになりました。

その代わりに、次の点は受け入れる必要があります。

- **絵を角基準で描く必要があります。** タイルの中心がグリッドの交点なので、地形の境界線はタイルの真ん中を通ります。通常の47タイルシートはそのままでは使えません。
- **2つのレイヤーをそろえる必要があります。** ゲームプレイ(当たり判定、経路探索、「このセルに何があるか」)は論理レイヤーが受け持ち、表示レイヤーは見た目だけです。
- **孤立したセルは丸く見えます。** 塗ったセル1つは周囲4タイルの4分の1ずつで描かれるので、専用の「孤立」タイルではなく、絵の角の形になります。

## Godot 4でデュアルグリッドを作る {#godot-dual-grid}

:::steps
1. **16タイルの角シートを用意する。** 角の組み合わせ(NW、NE、SE、SWが埋まっているか)ごとにタイルが1枚ずつある4×4のシートを使います。上の画像の2コーナーWangテンプレートがその例です。各セルがどのマスクかをメモしておきます。
2. **TileSetを1つ作る。** **Tile Size** をタイルの大きさに合わせ、シートをアトラスとして追加します。タイルはスクリプトが選ぶので、テレインセットは不要です。
3. **TileMapLayerを2つ追加する。** 1つを `World`(論理レイヤー)、もう1つを `Display` とし、同じTileSetを割り当てます。`World` を塗り終えたら **Visible** をオフにします。
4. **スクリプトを付ける。** `Display` に下の `dual_grid.gd` を付け、**World Layer** プロパティに `World` を指定します。起動時に `Display` を半タイル左上へずらし、表示セルごとに4つのワールドセルを見てタイルを描きます。
5. **ワールドを塗る。** `World` にセットのどのタイルでも塗るか、コードから `set_terrain(cell, true)` を呼びます。変更のたびに、そのワールドセルに接する4つの表示セルを描き直します。
6. **ゲームプレイはWorldに置く。** 当たり判定は `World` が使うタイル(または別の物理レイヤー)に入れ、コードでも `World` を参照します。`Display` は見た目のためのものです。
:::

```gdscript
# dual_grid.gd - attach to the DISPLAY TileMapLayer (the one players see).
# world_layer is a second, hidden TileMapLayer where you (or your game) paint terrain.
extends TileMapLayer

@export var world_layer: TileMapLayer

# 4-corner mask (NW=1, NE=2, SE=4, SW=8) -> atlas coords of the tile that shows it.
# This table matches the 4x4 "2-corner Wang" template; change it for your sheet.
const ATLAS := {
	8: Vector2i(0, 0), 6: Vector2i(1, 0), 13: Vector2i(2, 0), 12: Vector2i(3, 0),
	5: Vector2i(0, 1), 14: Vector2i(1, 1), 15: Vector2i(2, 1), 11: Vector2i(3, 1),
	2: Vector2i(0, 2), 3: Vector2i(1, 2), 7: Vector2i(2, 2), 9: Vector2i(3, 2),
	0: Vector2i(0, 3), 4: Vector2i(1, 3), 10: Vector2i(2, 3), 1: Vector2i(3, 3),
}


func _ready() -> void:
	# The display grid sits half a tile up-left of the world grid.
	position = world_layer.position - Vector2(tile_set.tile_size) / 2.0
	for c in world_layer.get_used_cells():
		refresh_around(c)


func is_filled(world_cell: Vector2i) -> bool:
	return world_layer.get_cell_source_id(world_cell) != -1


# Display cell (x, y) covers the corners where world cells (x-1..x, y-1..y) meet.
func refresh_display_cell(d: Vector2i) -> void:
	var mask := 0
	if is_filled(d + Vector2i(-1, -1)): mask |= 1  # NW
	if is_filled(d + Vector2i(0, -1)): mask |= 2   # NE
	if is_filled(d): mask |= 4                     # SE
	if is_filled(d + Vector2i(-1, 0)): mask |= 8   # SW
	set_cell(d, 0, ATLAS[mask])  # for "terrain over nothing", erase_cell(d) when mask == 0


# One world cell touches four display cells.
func refresh_around(world_cell: Vector2i) -> void:
	for off in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
		refresh_display_cell(world_cell + off)


# Call this from your game or editor tool to paint.
func set_terrain(world_cell: Vector2i, filled: bool) -> void:
	if filled:
		world_layer.set_cell(world_cell, 0, ATLAS[15])
	else:
		world_layer.erase_cell(world_cell)
	refresh_around(world_cell)
```

### ずらしのしくみ {#offset}

表示セル `(x, y)` は半タイル左上に描かれるので、ワールドセル `(x-1, y-1)` の右下4分の1、`(x, y-1)` の左下4分の1、`(x, y)` の左上4分の1、`(x-1, y)` の右上4分の1を覆います。マスクが読む4セルとぴったり同じです。そのためW×Hのワールドには(W+1)×(H+1)の表示セルが必要です。15×9のワールドで試したところ、表示セル160個すべてが、別に計算した角のマスクと一致しました。

絵によって変わるのは `ATLAS` の表だけです。シートの並びが違う(タイル *n* がマスク *n* の「バイナリ」順など)なら、その表を書きます。表が間違っていると境界がおかしな向きになるので、すぐにわかります。

### エディタでのプレビューと既存のプラグイン {#plugins}

上のスクリプトは実行時に描きます。エディタで塗りながら結果を見るには、`@tool` スクリプトにして `World` が変わったら描き直すか、プラグインを使います。[TileMapDual](https://github.com/pablogila/TileMapDual)(MIT)はエディタとゲームの両方でこれを行うカスタムTileMapLayerノードで、正方形とアイソメトリックのグリッドに対応しています。[jess::codesのシステムのGDScript移植版](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript)は最小限の参考実装です。デュアルグリッドをエンジン本体に入れる提案 [godot-proposals#10567](https://github.com/godotengine/godot-proposals/issues/10567) はまだオープンのままです。

## GodotのMatch Cornersモードがデュアルグリッドではない理由 {#match-corners}

Godot 4のテレインには **Match Corners** モードがあり、角のセットはこれにぴったり収まります(タイル15枚、角のピアリングビットだけ)。しかしGodotはこれらのタイルを半タイルずらさず、**塗ったセルの上に** 描きます。塗ったセルは角の *点* として扱われるので、地形は塗ったセルの中心同士の間に描かれます。

![同じマップをGodotのMatch Cornersテレインで塗った結果](shot:engine-godot-match-corners "Godot 4.7.2で描画:同じ15枚から作ったMatch Cornersテレインに、同じ38セルをset_cells_terrain_connectで塗った結果。砂は塗ったセルの中心の間の範囲に縮み、孤立したセルや幅1セルの線は水だけのタイルになります。暗いセルは塗っていないセルです。")

どの形も四方に半セルずつ縮み、孤立セルや幅1セルの線は消えます。塗った38セルのうち、全面が砂のタイルになったのは1セルだけでした。Match Cornersも、グリッドの交点を基準に *考える* 場合には役立ちます。埋めたい角を塗り、塗ったセルが角そのものだと割り切ればよいのです。「クリックしたセルが砂になってほしい」なら、2レイヤーのデュアルグリッドを使ってください。

## Tiledとほかのエディタ {#tiled}

Tiledのテレイン機能ではこれを **Corner Set** と呼び、マニュアルには「テレイン2つの完全なセットは16タイル」とあります。Corner SetではTerrain Brushがタイル間の交点を塗るので、デュアルグリッドと同じ考え方です。マップに保存されるのは角のデータではなく、結果のタイルです。設定と書き出しは[Tiledのテレインセット](guide:tiled-wang-sets-terrain)を参照してください。LDtkでは、オートレイヤーのルールと半タイルのオフセットでデュアルグリッドを再現できます。

## テレインが複数あるとき {#multiple-terrains}

テレインが2つ(画像の砂と水)なら、マスク0は「すべて水」のタイルなので、すべての表示セルが描かれます。テレインがもっと多い場合は、テレインごとに表示レイヤーを1枚ずつ用意し、優先順に重ねるのが一般的です(水、その上に砂、さらにその上に草)。各レイヤーは「透明の上のテレイン」16タイルセットを使い、スクリプトのコメントのとおりマスク0のセルは消します。こうすれば、テレインの組み合わせごとに境界セットを作らなくても、テレインあたり15枚で済みます。

:::nerulio ws=tile
NerulioのTile作業画面は、16タイルの角シート(cr31 2コーナー/Godot 3の「2×2」/デュアルグリッド4×4の並び)をピクセルから判別し、複数ブロックを含むパックではテレインまで見分けます。47タイルのセットと同じ4分の1のパーツから、デュアルグリッドの16枚セットを *生成* することもできます(RPGツクールのA2ブロックからなど)。
- **Test map** では、**Tiled** のルール(デュアルグリッドのように角のセットを半タイルずらして描く)と、**Godot 4** のルール(上の2枚目の画像のようにセルの上に描く)の両方を確認できます。
- **Export → Tiled** は、角のWangセットと、レイヤーを半タイルずらしたサンプルマップを書き出します。Tiled 1.12.2で読み戻して確認済みです。
- **Export → Godot 4** はMatch Cornersのテレインを書き出し、Godot 4.7.2で検証済みです。Godotで本物のデュアルグリッドを使うなら、そのセットの並びから上のスクリプトの `ATLAS` 表を作るか、TileMapDualを使ってください。Unityへの書き出しには角のセットは含まれません(RuleTileはセルの上に描くため)。
:::

## よくある質問 {#faq}

### デュアルグリッドのタイルセットには何枚のタイルが必要ですか? {#faq-1}
角の組み合わせは16通りで、すべて空の組み合わせはふつう描かないので、テレインあたり15枚です。回転を許せば形は5種類(角1つ、隣り合う角2つ、向かい合う角2つ、角3つ、全面)しかないので、5枚だけ描いて残りは回転で作れます。

### デュアルグリッドとGodotのMatch Cornersテレインは同じものですか? {#faq-2}
違います。どちらも同じ15枚の角セットを使いますが、Match Cornersは塗ったセルの上にタイルを描き、セルを角の点として扱うので、形が半セルずつ縮みます。デュアルグリッドは半タイルずらした2つ目のグリッドに描くので、塗ったセルがそのまま埋まって見えます。

### 通常の47タイルのタイルセットをデュアルグリッドに使えますか? {#faq-3}
そのままでは使えません。デュアルグリッドのタイルは地形の境界がタイルの真ん中を通り、ブロブのタイルは境界がタイルの縁にあります。角(16枚)のシートが必要で、同じ4分の1のパーツから組み立ててくれるツールを使う方法もあります。

### デュアルグリッドでは当たり判定をどこに置きますか? {#faq-4}
ゲームプレイのグリッドとそろっている論理(ワールド)レイヤーに置きます。表示レイヤーは半タイルずれていて、見た目のためだけにあります。

### Tiledはデュアルグリッドのタイルセットに対応していますか? {#faq-5}
はい、テレイン機能のCorner Setとして対応しています。Terrain Brushがグリッドの交点を塗り、合う角のタイルを置きます。エンジンはその結果のタイルを、ほかのTiledマップと同じように読み込みます。

## 参考資料 {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html)(テレインのモード、Match Corners)
- [TileMapLayer クラスリファレンス(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html)(`set_cell`、`erase_cell`、`get_cell_source_id`、`set_cells_terrain_connect`)
- [Using Terrains — Tiled 1.12 documentation](https://doc.mapeditor.org/en/stable/manual/terrain/)(Corner Set、Edge Set、Mixed Set)
- [godot-proposals#10567:デュアルグリッドのタイルマップ機能の提案](https://github.com/godotengine/godot-proposals/issues/10567)
- [TileMapDual](https://github.com/pablogila/TileMapDual)、[dual-grid-tilemap-system-godot-gdscript](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript)(コミュニティの実装)
- [jess::codes — Draw fewer tiles, by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg)
- 素材:[Wisp0468のTileset templates](https://opengameart.org/content/tileset-templates)(CC0、OpenGameArt)
