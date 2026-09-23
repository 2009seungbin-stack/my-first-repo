Godot 4のオートタイルは **テレイン(terrain)** で作ります。TileSetに **Match Corners and Sides** モードのテレインセットを追加し、47タイルの「ブロブ(blob)」シートの各タイルにテレインと8つのピアリングビットを設定してから、TileMapLayerの **Terrains** タブで塗る(または `set_cells_terrain_connect()` を呼ぶ)だけです。おかしなタイルが置かれるときは、ほぼ必ず組み合わせが足りないか、ビットの塗り間違いです。Godotは警告を出さずにいちばん近いタイルで代用し、その選択が隣のセルまで書き換えます。

このガイドでは実際の47タイルシートでテレインを設定し、同じTileSetをGDScriptで組み立てるコードを示したうえで、「タイルがずれる」原因をGodot 4.7.2で一つずつ再現します。

![Godot 4.7.2がset_cells_terrain_connectで塗った洞窟のテレイン](shot:engine-godot-terrain-47 "Godot 4.7.2(Compatibilityレンダラー)で描画:OpenGameArtの\"second\"によるCC0の洞窟47タイルシートからMatch Corners and Sidesのテレインを作り、set_cells_terrain_connectを1回呼んで塗ったもの。43セルすべてに、周囲の形に合うタイルが入っています。")

## Godot 4のテレインのしくみ {#how-terrains-work}

TileSetは1つ以上の **テレインセット(Terrain Sets)** を持ちます。セットごとに **モード(Mode)** と **テレイン(Terrains)** の一覧(草、土、水…)があり、各タイルは次の2つを指定します。

- **Terrain**:タイルの中央がどのテレインか。
- **ピアリングビット(peering bits)**:隣接する位置ごとに、どのテレインが来るべきか。`-1` は空です。

塗るとき、Godotはセルの周囲のテレインを見て、ビットがいちばん合うタイルを選びます。どのビットを見るかはモードで決まります。

| モード | 使うビット | テレイン1つに必要なタイル | 主な用途 |
|---|---|---|---|
| Match Corners and Sides | 辺4+角4 | 47(ブロブ) | 47タイルシート、Godot 3の「3×3 minimal」 |
| Match Corners | 角4 | 15(16番目は空) | 2コーナーWang、Godot 3の「2×2」 |
| Match Sides | 辺4 | 16 | パイプ、道、柵 |

### ブロブが47枚になる理由 {#why-47}

周囲8セルの埋まり方は256通りあります。しかし角が見た目に影響するのは、**両隣の辺がどちらも埋まっているときだけ** です。上のセルが空なら上辺の縁はどのみち描かれるので、右上の斜めのセルが何であっても隠れます。意味のない角を除くと、256通りはちょうど **47通り** にまとまります。そのため47タイルのテンプレートには、孤立タイル、端、直線の縁、外角、T字、内角、全面のタイルがそろっています。

同じ47枚でも並び順はいくつもあります(cr31の昇順、GameMakerの8×6テンプレート、7×7の「wang blob」、Godot 3の12×4テンプレートなど)。PNGの中にはどの順番かが書かれていないので、チュートリアルのビット配置を並びの違うシートにそのまま写すと、めちゃくちゃになります。

## エディタで47タイルのテレインを設定する {#setup}

:::steps
1. **レイヤーとTileSetを作る。** **TileMapLayer** ノードを追加し、インスペクターで **New TileSet** を作ります。画像を入れる *前に* **Tile Size** をタイルの大きさ(上のシートなら64×64)に合わせます。
2. **アトラスを追加する。** エディタ下部の **TileSet** パネルを開き、PNGをドラッグ&ドロップします。タイルを自動作成するか聞かれたら **Yes** を選びます。タイルの間に隙間があるシートなら **Margins** と **Separation** を設定します。
3. **テレインセットを追加する。** TileSetのインスペクターで **Terrain Sets** を開いて **Add Element** を押し、**Mode** を **Match Corners and Sides** にします。
4. **テレインを追加する。** そのセットの **Terrains** にテレインを1つ追加し、名前と、絵の上で見分けやすい色を決めます。
5. **タイルに印を付ける。** TileSetパネルで **Paint** を選び、塗るプロパティに **Terrains** を指定して、テレインセット0とテレインを選びます。各タイルの中央をクリックしてテレインを設定し、つながるべき辺と角の領域をクリックします。右クリックで消せます。
6. **47通りを確認する。** 47通りの組み合わせがそれぞれ1回ずつ必要です(ビットがまったく同じタイルを複数置くとランダムなバリエーションになります)。角の両隣の辺のどちらかが開いているなら、その角のビットは塗りません。
7. **塗る。** TileMapLayerを選び、TileMapパネルの **Terrains** タブで **Connect** モードとテレインを選んで塗ります。通路や道には **Path** モードを使います。
:::

> **Godot 4.3以降:** 複数レイヤーを持つ `TileMap` ノードは非推奨(deprecated)になり、レイヤーごとに **TileMapLayer** ノードを1つ使います。既存のTileMapは、TileMapパネル右上のツールボックスアイコンにある **Extract TileMap layers as individual TileMapLayer nodes** で変換できます。

## 同じTileSetをGDScriptで作る {#gdscript}

188個のピアリングビットを手でクリックしていると、どこかで間違えます。シートの並びがわかっていれば、短いスクリプトで一度に設定できます。次のコードは、GameMaker 47テンプレートの順に書いた隣接マスクの表(N=1、NE=2、E=4、SE=8、S=16、SW=32、W=64、NW=128)を読みます。このページの画像のTileSetは、まさにこのコードで作ったものです。

```gdscript
# blob47_tileset.gd - builds a "Match Corners and Sides" terrain set from a 47-tile sheet.
# Each number is the tile's neighbour mask (N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128),
# written in the order of the GameMaker 47-tile template. null = unused cell.
class_name Blob47Tileset

const MASKS := [
	[null, 127, 253, 125, 247, 119, 245, 117],
	[223, 95, 221, 93, 215, 87, 213, 85],
	[31, 29, 23, 21, 124, 116, 92, 84],
	[241, 209, 113, 81, 199, 71, 197, 69],
	[17, 68, 28, 20, 112, 80, 193, 65],
	[7, 5, 16, 4, 1, 64, 0, 255],
]

# mask bit -> Godot peering bit
const BITS := {
	1: TileSet.CELL_NEIGHBOR_TOP_SIDE,
	2: TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER,
	4: TileSet.CELL_NEIGHBOR_RIGHT_SIDE,
	8: TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER,
	16: TileSet.CELL_NEIGHBOR_BOTTOM_SIDE,
	32: TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER,
	64: TileSet.CELL_NEIGHBOR_LEFT_SIDE,
	128: TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER,
}


static func build(texture: Texture2D, tile_px: int, skip := []) -> TileSet:
	var ts := TileSet.new()
	ts.tile_size = Vector2i(tile_px, tile_px)
	ts.add_terrain_set()
	ts.set_terrain_set_mode(0, TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES)
	ts.add_terrain(0)
	ts.set_terrain_name(0, 0, "Cave")

	var src := TileSetAtlasSource.new()
	src.texture = texture
	src.texture_region_size = ts.tile_size
	ts.add_source(src, 0)  # add the source first: TileData checks bits against the TileSet

	for row in MASKS.size():
		for col in MASKS[row].size():
			var mask = MASKS[row][col]
			if mask == null or mask in skip:
				continue
			var coords := Vector2i(col, row)
			src.create_tile(coords)
			var td := src.get_tile_data(coords, 0)
			td.terrain_set = 0
			td.terrain = 0  # the tile's centre belongs to terrain 0
			for bit in BITS:
				if mask & bit:
					td.set_terrain_peering_bit(BITS[bit], 0)  # neighbour must be terrain 0
				# bits left unset stay -1 = "empty" on that side/corner
	return ts
```

塗るのもコードでできます。`set_cells_terrain_connect(cells, terrain_set, terrain, ignore_empty_terrains = true)` はすべてのセルを同じテレインの隣とつなぎ、`set_cells_terrain_path()` は配列の中で *連続する* セル同士だけをつなぎます。

```gdscript
# level.gd - attach to a TileMapLayer node
extends TileMapLayer

func _ready() -> void:
	tile_set = Blob47Tileset.build(preload("res://cave-autotile47.png"), 64)

	# A 6x4 room: one call, so every cell sees its final neighbours.
	var room: Array[Vector2i] = []
	for y in 4:
		for x in 6:
			room.append(Vector2i(x, y))
	set_cells_terrain_connect(room, 0, 0)  # terrain set 0, terrain 0

	# A corridor that only joins consecutive cells of the path.
	var corridor: Array[Vector2i] = [Vector2i(8, 1), Vector2i(9, 1), Vector2i(10, 1), Vector2i(10, 2)]
	set_cells_terrain_path(corridor, 0, 0)
```

別のシートで使うなら、`MASKS` をそのシートの並びの表に差し替えます。結果を `.tres` として残すには、`ResourceSaver.save(ts, "res://cave_tileset.tres")` を一度呼びます。

### ConnectとPathの違い {#connect-vs-path}

**Connect** モード(`set_cells_terrain_connect`)は、レイヤー上で同じテレインの隣接セルとすべてつなぎます。**Path** モード(`set_cells_terrain_path`)は、1回のストロークで順番に塗ったセル同士だけをつなぎます。並べて描いた2本の道は、Pathモードなら2本のまま、Connectモードでは1本の太い道にまとまります。

## Godotが違うタイルを置く理由 {#wrong-tiles}

クラスリファレンスにもはっきり書かれています。テレインでの塗りは「TileSetに必要なテレインの組み合わせがすべて設定されていないと、予期しない結果になることがある」というものです。その「予期しない結果」をGodot 4.7.2で再現すると、次のようになります。

### 1. 組み合わせが足りない {#missing-combination}

セルの周囲に合うタイルがなくても、Godotはセルを空けたり警告を出したりしません。テレインのタイルすべてに点数を付け、食い違うビットがいちばん少ないタイルを使います。完全なセットから内角1つだけのタイル4枚(マスク127、253、247、223)を消して、同じマップを塗り直してみました。

![内角4枚が足りないときにGodot 4.7.2が別のタイルで代用した様子](shot:engine-godot-terrain-missing "Godot 4.7.2で描画:同じマップで、TileSetから内角タイル4枚を外した結果(CC0のGameMaker 47テンプレート、MechanicalRage作)。枠で囲んだセルには代わりのタイルが入り、あるはずのない内角の切り欠きができています。")

6セルが間違い、そのうち1セルは *正しいタイルがあるのに* 間違っていました。足りない内角の代わりに入ったタイルが、隣のセルと共有する角を取ってしまい、隣のセルもそれに合わせて書き換えられたのです。タイルが1枚欠けるだけで、何も欠けていないセルまで崩れることがあります。

**直し方:** セットをそろえます。モードに必要な組み合わせの数(47、16、15)を数え、1つずつあるか確かめます。絵として用意できない組み合わせなら、その部分は普通のタイルとして塗るか、その組み合わせが出ないようにマップを変えます。

### 2. 塗る順番で結果が変わる {#painting-order}

Connectの呼び出しは、そのたびにすでに置かれた隣のタイルを書き換えることがあります。セットが完全なら順番は関係ありません。43セルのマップを、1回で、半分ずつ2回で、1セルずつ先頭から、1セルずつ末尾から塗っても、結果はすべて同じでした。ところが1の不完全なセットで同じ実験をすると、1セルずつ先頭から塗った結果は1回で塗った結果と1セル、末尾から塗った結果は6セル違いました。[godot#73903](https://github.com/godotengine/godot/issues/73903) で報告されている「塗る順番で結果が変わる」現象がこれです。

**直し方:** まずセットを完成させます。コードではセルごとにループで呼ばず、1つのテレインのセルをまとめて `set_cells_terrain_connect` に **1回** で渡します。

### 3. 開いた辺の後ろの角ビット {#corner-bits}

手でビットを塗るときによくあるのが、隣の辺が開いているのに、絵が「埋まって見える」からと角をつながりとして塗ってしまう間違いです。左上の外角タイル(マスク28、EとSの辺)に、右上の角のビットを1つだけ誤って足してみました。するとGodotは本来そのタイルが入る場所でこのタイルを使わなくなり、内角の切り欠きが *ある* E+Sタイル(マスク20)を代わりに置きました。マップ上の2つのブロックの左上の角に、余計な切り欠きができました。

**直し方:** Match Corners and Sidesでは、角の両隣の辺がどちらも設定されているときだけ、その角のビットを塗ります。

### 4. 別のテレインで塗ったビット、中央のテレインがないタイル {#wrong-terrain}

**Terrain** が `-1` のままのタイルは、ピアリングビットがあってもテレインでの塗りでは無視されます。テレインが複数あるとき、ビットを0ではなく1で塗ると、草の縁のタイルが草→砂の境界タイルになり、実際に隣が砂のときしか使われません。TileSetパネルの **Paint → Terrains** 表示では各領域のテレインが色で見えるので、一度見渡せば間違った色は見つかります。

### 5. バリエーションと確率 {#probability}

ビットがまったく同じタイルが複数枚あってもかまいません(全面の岩タイルのバリエーション3枚など)。その場合Godotは、各タイルの **Probability** を重みにしてランダムに選びます。28×28の内部領域で試すと、確率1.0の全面タイル2枚は404/380に分かれ、バリエーションを0.25にすると165/619、0.0にするとバリエーションは一度も使われませんでした。

## 役立つツール {#tools}

Godotのマッチングにどうしても悩まされるなら、コミュニティのプラグインで置き換えたり補ったりできます。[Better Terrain](https://github.com/Portponky/better-terrain) は独自のルール種別を追加し、[Terrain Autotiler](https://github.com/dandeliondino/terrain-autotiler) はマッチングを作り直して順番に左右されないようにします。角だけでできた絵なら、47タイルなしでデュアルグリッドが使えます([デュアルグリッドのガイド](guide:dual-grid-autotile))。RPGツクールのA2ブロックは[RPGツクールA2をGodotへ](guide:rpg-maker-a2-autotile-to-godot)、タイルの間に細い線が出るなら[タイルの隙間とにじみ](guide:tile-seams-texture-bleeding-padding-extrude)を参照してください。

:::nerulio ws=tile
NerulioのTile作業画面は、ビットの作業を肩代わりし、Godotを開く前に何が足りないかを教えてくれます。ピクセルから並び(GameMaker 47、cr31、7×7 wang blob、Godot 3の12×4、16タイルの辺/角セット)を判別し、候補ごとに信頼度を表示してから、ピアリングビットをすべて設定してセットをチェックします。
- シートをTile作業画面に入れ、**Use this grid** を押してから、認識された並びで **Apply** を押します。
- **Check** パネルに、足りない組み合わせ(ゴーストタイル)、重複、開いた辺の後ろの角ビットが表示されます。
- **Test map** は **Godot 4** のルールで塗ります。`set_cells_terrain_connect` を移植したもので、私たちの検証ではGodot 4.7.2とセル単位で一致しました。Godotが代用タイルを置くセルは枠で示されます。
- **Export → Godot 4** で、PNG、JSON、そしてGodot上でテレイン付きのTileSetを組み立てる `nerulio_tileset_import.gd` が出力されます。このインポーターはGodot 4.7.2で検証済みです。
:::

![GameMaker 47の並びを認識したNerulioのTile作業画面](shot:studio-tile-layout "NerulioのTile作業画面:洞窟シートをGameMaker 47タイルの並びとして認識(信頼度は中、シームスコア96.4%)し、ピアリングビットを適用してチェックが47/47の組み合わせを報告している様子。")

## よくある質問 {#faq}

### Godot 4でオートタイルがおかしなタイルになるのはなぜですか? {#faq-1}
たいていはTileSetに組み合わせが足りないか、ピアリングビットが間違っています。するとGodotは警告なしに食い違うビットがいちばん少ないタイルを使い、その代用タイルに合わせて隣のセルまで書き換えることがあります。47通り(または16通り)をすべてそろえ、角のビットを見直してください。

### Godot 4のテレインにはタイルが何枚必要ですか? {#faq-2}
空白と接するテレイン1つなら、Match Corners and Sidesで47枚、Match Sidesで16枚、Match Cornersで15枚です(16番目の角の組み合わせはすべて空なのでタイル不要)。テレイン同士の境界が増えるたびに、その組み合わせも別に必要になります。

### Godot 4でオートタイルのビットマスクはどこへ行きましたか? {#faq-3}
テレインに置き換わりました。タイルごとのビットマスクはピアリングビットになり、47タイルの「3×3 minimal」セットはMatch Corners and Sidesのテレイン、「2×2」セットはMatch Cornersのテレインになります。

### set_cells_terrain_connectとset_cells_terrain_pathの違いは何ですか? {#faq-4}
`set_cells_terrain_connect` はレイヤー上の同じテレインの隣接セルとすべてつなぎ、`set_cells_terrain_path` は配列の中で続いているセル同士だけをつなぎます(道を一筆で描くイメージです)。どちらも `(cells, terrain_set, terrain, ignore_empty_terrains = true)` を受け取ります。

### TileMapとTileMapLayerのどちらを使うべきですか? {#faq-5}
TileMapLayerを使ってください。Godot 4.3からTileMapノードは非推奨になり、レイヤーごとにTileMapLayerノードを使います。テレインのAPIは同じです。

## 参考資料 {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html)(テレインセット、モード、ピアリングビット、タイルの自動作成)
- [Using TileMaps — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html)(Connect/Pathの塗りモード)
- [TileMapLayer クラスリファレンス(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html)(`set_cells_terrain_connect`、`set_cells_terrain_path`)
- [TileSet クラスリファレンス(4.7)](https://docs.godotengine.org/en/stable/classes/class_tileset.html)(`TerrainMode`、`CellNeighbor`)
- [TileData クラスリファレンス(4.7)](https://docs.godotengine.org/en/stable/classes/class_tiledata.html)(`terrain_set`、`terrain`、`probability`、`set_terrain_peering_bit`)
- [TileMap クラスリファレンス(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemap.html)(非推奨の案内)
- [godotengine/godot#73903:塗る順番でテレインの結果が変わる問題](https://github.com/godotengine/godot/issues/73903)
- 素材:[Cave platformer tileset 47](https://opengameart.org/content/cave-platformer-tileset-47)、[GameMaker autotile templates](https://opengameart.org/content/gamemaker-autotile-templates)(いずれもOpenGameArtのCC0)
