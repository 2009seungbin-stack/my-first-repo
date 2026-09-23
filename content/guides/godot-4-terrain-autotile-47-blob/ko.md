Godot 4의 오토타일은 **터레인(terrain)** 으로 만듭니다. TileSet에 **Match Corners and Sides** 모드의 터레인 세트를 추가하고, 47타일 "블롭(blob)" 시트의 타일마다 터레인과 8개의 피어링 비트를 지정한 뒤, TileMapLayer의 **Terrains** 탭으로 칠하거나 `set_cells_terrain_connect()`를 호출하면 됩니다. 엉뚱한 타일이 깔린다면 거의 항상 조합이 하나 빠졌거나 비트를 잘못 칠한 경우입니다. Godot는 경고 없이 가장 비슷한 타일로 대신 채우고, 그 선택이 옆 칸까지 바꿔 놓습니다.

이 글에서는 실제 47타일 시트로 터레인을 설정하고, 같은 TileSet을 GDScript로 만드는 코드를 보여 준 다음, "타일이 잘못 깔리는" 원인을 Godot 4.7.2에서 하나씩 재현합니다.

![Godot 4.7.2가 set_cells_terrain_connect로 칠한 동굴 터레인](shot:engine-godot-terrain-47 "Godot 4.7.2(Compatibility 렌더러)로 렌더링: OpenGameArt의 \"second\"가 만든 CC0 동굴 47타일 시트로 Match Corners and Sides 터레인을 만들고 set_cells_terrain_connect 한 번으로 칠했습니다. 43칸 모두 주변 모양에 맞는 타일이 들어갔습니다.")

## Godot 4 터레인의 동작 방식 {#how-terrains-work}

TileSet은 하나 이상의 **터레인 세트(Terrain Sets)** 를 가집니다. 세트마다 **모드(Mode)** 와 **터레인(Terrains)** 목록(잔디, 흙, 물…)이 있고, 각 타일은 두 가지를 지정합니다.

- **Terrain**: 타일 가운데가 어느 터레인인지.
- **피어링 비트(peering bits)**: 이웃 위치마다 어떤 터레인이 와야 하는지. `-1`은 빈칸입니다.

칠할 때 Godot는 칸 주변의 터레인을 보고 비트가 가장 잘 맞는 타일을 고릅니다. 어떤 비트를 볼지는 모드가 정합니다.

| 모드 | 사용하는 비트 | 터레인 1개에 필요한 타일 | 주로 쓰는 아트 |
|---|---|---|---|
| Match Corners and Sides | 변 4 + 모서리 4 | 47 (블롭) | 47타일 시트, Godot 3 "3×3 minimal" |
| Match Corners | 모서리 4 | 15 (16번째는 빈칸) | 2-코너 Wang, Godot 3 "2×2" |
| Match Sides | 변 4 | 16 | 파이프, 길, 울타리 |

### 블롭 세트가 47장인 이유 {#why-47}

이웃 8칸의 채움/비움 조합은 256가지입니다. 그런데 모서리는 **양옆 두 변이 모두 채워졌을 때만** 모양에 차이를 만듭니다. 위 칸이 비어 있으면 윗변 테두리가 어차피 그려지므로, 오른쪽 위 대각선 칸이 무엇이든 가려집니다. 의미 없는 모서리를 빼면 256가지가 정확히 **47가지**로 줄어듭니다. 그래서 47타일 템플릿에는 외톨이 타일, 끝 타일, 직선 테두리, 바깥 모서리, T자, 안쪽 모서리, 가득 찬 내부 타일이 들어 있습니다.

같은 47장이라도 배치 순서는 여러 가지입니다(cr31 오름차순, GameMaker 8×6 템플릿, 7×7 "wang blob", Godot 3의 12×4 템플릿 등). PNG 안에는 어느 순서인지 적혀 있지 않으므로, 튜토리얼의 비트 배치를 순서가 다른 시트에 그대로 옮기면 엉망이 됩니다.

## 에디터에서 47타일 터레인 설정하기 {#setup}

:::steps
1. **레이어와 TileSet 만들기.** **TileMapLayer** 노드를 추가하고 인스펙터에서 **New TileSet**을 만듭니다. 이미지를 넣기 *전에* **Tile Size**를 타일 크기(위 시트는 64×64)로 맞춥니다.
2. **아틀라스 추가.** 에디터 아래쪽 **TileSet** 패널을 열고 PNG를 끌어다 놓습니다. 타일을 자동으로 만들지 물으면 **Yes**를 누릅니다. 시트에 타일 사이 간격이 있다면 **Margins**와 **Separation**을 설정합니다.
3. **터레인 세트 추가.** TileSet 인스펙터에서 **Terrain Sets**를 펼쳐 **Add Element**를 누르고 **Mode**를 **Match Corners and Sides**로 바꿉니다.
4. **터레인 추가.** 그 세트의 **Terrains**에 터레인을 하나 추가하고, 이름과 아트 위에서 잘 보이는 색을 정합니다.
5. **타일 표시하기.** TileSet 패널에서 **Paint**를 고르고 칠할 속성으로 **Terrains**를 선택한 뒤 터레인 세트 0과 터레인을 고릅니다. 터레인 타일마다 가운데를 클릭해 터레인을 정하고, 연결되어야 하는 변과 모서리 영역을 클릭합니다. 오른쪽 클릭은 지웁니다.
6. **47가지 확인.** 47가지 조합이 각각 한 번씩 있어야 합니다(비트가 똑같은 타일을 여러 장 두면 랜덤 변형이 됩니다). 모서리 옆 변 중 하나라도 열려 있으면 그 모서리 비트는 칠하지 않습니다.
7. **칠하기.** TileMapLayer를 선택하고 TileMap 패널의 **Terrains** 탭에서 **Connect** 모드와 터레인을 고른 뒤 칠합니다. 통로나 길은 **Path** 모드를 씁니다.
:::

> **Godot 4.3 이상:** 여러 레이어를 가진 `TileMap` 노드는 폐지 예정(deprecated)이 되었고, 레이어마다 **TileMapLayer** 노드를 하나씩 씁니다. 기존 TileMap은 TileMap 패널 오른쪽 위 도구 상자 아이콘의 **Extract TileMap layers as individual TileMapLayer nodes**로 변환합니다.

## 같은 TileSet을 GDScript로 만들기 {#gdscript}

피어링 비트 188개를 손으로 찍다 보면 실수가 나기 마련입니다. 시트의 배치를 알고 있다면 짧은 스크립트로 한 번에 설정할 수 있습니다. 아래 코드는 GameMaker 47 템플릿 순서로 적은 이웃 마스크 표(N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128)를 읽으며, 이 글의 이미지에 쓰인 TileSet이 바로 이 코드로 만든 것입니다.

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

칠하는 것도 코드로 할 수 있습니다. `set_cells_terrain_connect(cells, terrain_set, terrain, ignore_empty_terrains = true)`는 모든 칸을 같은 터레인의 이웃과 잇고, `set_cells_terrain_path()`는 배열에서 *연달아 오는* 칸끼리만 잇습니다.

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

다른 시트에 쓰려면 `MASKS`를 그 시트 배치의 표로 바꾸면 됩니다. 결과를 `.tres`로 남기려면 `ResourceSaver.save(ts, "res://cave_tileset.tres")`를 한 번 호출합니다.

### Connect와 Path의 차이 {#connect-vs-path}

**Connect** 모드(`set_cells_terrain_connect`)는 레이어 위에서 같은 터레인인 이웃이라면 모두 잇습니다. **Path** 모드(`set_cells_terrain_path`)는 한 번의 스트로크에서 차례로 칠한 칸끼리만 잇습니다. 나란히 그린 길 두 개가 Path 모드에서는 두 길로 남지만, Connect 모드에서는 하나의 넓은 길로 합쳐집니다.

## Godot가 엉뚱한 타일을 까는 이유 {#wrong-tiles}

클래스 레퍼런스에도 분명히 적혀 있습니다. 터레인 칠하기는 "TileSet에 필요한 모든 터레인 조합이 설정되어 있어야 제대로 동작하며, 그렇지 않으면 예상치 못한 결과가 나올 수 있다"는 것입니다. 그 "예상치 못한 결과"를 Godot 4.7.2에서 재현하면 다음과 같습니다.

### 1. 조합이 빠진 경우 {#missing-combination}

칸 주변 모양에 맞는 타일이 없어도 Godot는 칸을 비우거나 경고를 띄우지 않습니다. 터레인의 모든 타일에 점수를 매겨 어긋나는 비트가 가장 적은 타일을 씁니다. 완전한 세트에서 안쪽 모서리 하나짜리 타일 네 장(마스크 127, 253, 247, 223)을 지우고 같은 맵을 다시 칠해 보았습니다.

![안쪽 모서리 4장이 빠졌을 때 Godot 4.7.2가 다른 타일로 대신 채운 모습](shot:engine-godot-terrain-missing "Godot 4.7.2로 렌더링: 같은 맵에서 TileSet의 안쪽 모서리 타일 4장을 뺀 결과(CC0 GameMaker 47 템플릿, MechanicalRage). 테두리 표시된 칸은 대체 타일이 들어가 없어야 할 안쪽 모서리 홈이 생겼습니다.")

여섯 칸이 틀렸는데, 그중 한 칸은 *맞는 타일이 있었는데도* 틀렸습니다. 빠진 안쪽 모서리 대신 들어간 타일이 이웃 칸과 공유하는 모서리를 가져가 버려서, 이웃 칸도 거기에 맞춰 바뀐 것입니다. 타일 한 장이 빠지면 아무 문제 없는 칸까지 망가질 수 있습니다.

**해결:** 세트를 채웁니다. 모드에 필요한 조합 수(47, 16, 15)를 세고 하나하나 있는지 확인합니다. 아트로 만들 수 없는 조합이라면 그 부분은 일반 타일로 칠하거나, 그 조합이 생기지 않도록 맵을 바꿉니다.

### 2. 칠하는 순서에 따라 결과가 달라지는 경우 {#painting-order}

Connect 호출은 매번 이미 놓인 이웃 타일을 다시 쓸 수 있습니다. 세트가 완전하면 순서는 상관없습니다. 43칸짜리 맵을 한 번에, 절반씩 두 번에, 한 칸씩 앞에서부터, 한 칸씩 뒤에서부터 칠했더니 결과가 모두 같았습니다. 그런데 1번의 불완전한 세트로 같은 실험을 하면, 한 칸씩 앞에서부터 칠한 결과는 한 번에 칠한 결과와 1칸, 뒤에서부터 칠한 결과는 6칸이 달랐습니다. [godot#73903](https://github.com/godotengine/godot/issues/73903)에 보고된 "칠하는 순서에 따라 결과가 달라지는" 현상이 바로 이것입니다.

**해결:** 먼저 세트를 완성합니다. 코드에서는 칸마다 반복 호출하지 말고, 한 터레인의 칸을 모두 모아 `set_cells_terrain_connect` **한 번**에 넘깁니다.

### 3. 열린 변 뒤의 모서리 비트 {#corner-bits}

손으로 비트를 칠할 때 흔한 실수는, 옆 변이 열려 있는데도 그림상 "채워 보여서" 모서리를 연결로 표시하는 것입니다. 왼쪽 위 바깥 모서리 타일(마스크 28, E와 S 변)에 오른쪽 위 모서리 비트 하나를 잘못 추가해 보았습니다. 그러자 Godot는 그 타일이 들어가야 할 자리에서 이 타일을 쓰지 않고, 안쪽 모서리 홈이 *있는* E+S 타일(마스크 20)을 대신 넣었습니다. 맵에서 블록 두 개의 왼쪽 위 모서리에 쓸데없는 홈이 생겼습니다.

**해결:** Match Corners and Sides에서는 모서리 양옆의 두 변이 모두 설정된 경우에만 그 모서리 비트를 칠합니다.

### 4. 다른 터레인으로 칠한 비트, 가운데 터레인이 없는 타일 {#wrong-terrain}

**Terrain**이 `-1`로 남은 타일은 피어링 비트가 있어도 터레인 칠하기에서 무시됩니다. 터레인이 여러 개일 때 비트를 0 대신 1로 칠하면, 잔디 테두리 타일이 잔디→모래 전환 타일이 되어 옆에 실제로 모래가 있을 때만 쓰입니다. TileSet 패널의 **Paint → Terrains** 화면에서는 영역마다 어느 터레인인지 색으로 보이므로, 한 번 훑어보면 잘못된 색을 찾을 수 있습니다.

### 5. 변형 타일과 확률 {#probability}

비트가 똑같은 타일이 여러 장일 수 있습니다(예: 가득 찬 바위 타일 변형 세 장). 이때 Godot는 각 타일의 **Probability** 를 가중치로 삼아 무작위로 고릅니다. 28×28 내부 영역에서 확률 1.0짜리 가득 찬 타일 두 장은 404/380으로 나뉘었고, 변형 타일을 0.25로 낮추자 165/619, 0.0으로 두자 변형 타일은 한 번도 쓰이지 않았습니다.

## 도움이 되는 도구 {#tools}

Godot의 매칭 방식이 계속 말썽이라면 커뮤니티 플러그인으로 바꾸거나 보완할 수 있습니다. [Better Terrain](https://github.com/Portponky/better-terrain)은 자체 규칙 유형을 추가하고, [Terrain Autotiler](https://github.com/dandeliondino/terrain-autotiler)는 매칭을 다시 구현해 순서에 따라 결과가 바뀌지 않게 합니다. 모서리만으로 된 아트라면 47타일 세트 없이 듀얼 그리드를 쓸 수 있습니다([듀얼 그리드 가이드](guide:dual-grid-autotile)). RPG 쯔꾸르 A2 블록은 [RPG 쯔꾸르 A2를 Godot로](guide:rpg-maker-a2-autotile-to-godot), 타일 사이에 가는 선이 보인다면 [타일 틈과 블리딩](guide:tile-seams-texture-bleeding-padding-extrude)을 참고하세요.

:::nerulio ws=tile
Nerulio의 Tile 작업 공간은 비트 작업을 대신해 주고, Godot를 열기 전에 무엇이 빠졌는지 알려 줍니다. 픽셀을 분석해 배치(GameMaker 47, cr31, 7×7 wang blob, Godot 3 12×4, 16타일 변/모서리 세트)를 알아내고, 후보마다 신뢰도를 보여 준 뒤 피어링 비트를 모두 채우고 세트를 검사합니다.
- 시트를 Tile 작업 공간에 넣고 **Use this grid**, 인식된 배치에서 **Apply**를 누릅니다.
- **Check** 패널이 빠진 조합(고스트 타일), 중복, 열린 변 뒤의 모서리 비트를 보여 줍니다.
- **Test map**은 **Godot 4** 규칙으로 칠합니다. `set_cells_terrain_connect`를 옮긴 것으로, 저희 검사에서 Godot 4.7.2와 칸 단위로 일치했습니다. Godot가 타일을 대신 넣을 칸은 테두리로 표시됩니다.
- **Export → Godot 4**는 PNG, JSON, 그리고 Godot에서 터레인이 설정된 TileSet을 만드는 `nerulio_tileset_import.gd`를 내보냅니다. 이 임포터는 Godot 4.7.2에서 검증했습니다.
:::

![GameMaker 47 배치를 인식한 Nerulio Tile 작업 공간](shot:studio-tile-layout "Nerulio Tile 작업 공간: 동굴 시트를 GameMaker 47타일 배치로 인식(신뢰도 중간, 이음새 점수 96.4%)하고 피어링 비트를 적용해 검사 결과 47/47 조합이 나온 모습.")

## 자주 묻는 질문 {#faq}

### Godot 4에서 오토타일이 엉뚱하게 깔리는 이유는 무엇인가요? {#faq-1}
대개 TileSet에 조합이 빠졌거나 피어링 비트가 잘못되었기 때문입니다. 그러면 Godot는 경고 없이 어긋나는 비트가 가장 적은 타일을 쓰고, 그 대체 타일에 맞추려고 이웃 칸까지 바꿀 수 있습니다. 47가지(또는 16가지) 조합을 모두 채우고 모서리 비트를 다시 확인하세요.

### Godot 4 터레인에는 타일이 몇 장 필요한가요? {#faq-2}
빈칸과 맞닿는 터레인 하나 기준으로 Match Corners and Sides는 47장, Match Sides는 16장, Match Corners는 15장입니다(16번째 모서리 조합은 전부 빈칸이라 타일이 필요 없습니다). 터레인끼리의 전환이 늘어날 때마다 그 조합도 따로 필요합니다.

### Godot 4에서 오토타일 비트마스크는 어디로 갔나요? {#faq-3}
터레인으로 바뀌었습니다. 타일별 비트마스크는 피어링 비트가 되었고, 47타일 "3×3 minimal" 세트는 Match Corners and Sides 터레인, "2×2" 세트는 Match Corners 터레인이 됩니다.

### set_cells_terrain_connect와 set_cells_terrain_path는 어떻게 다른가요? {#faq-4}
`set_cells_terrain_connect`는 레이어의 같은 터레인 이웃과 모두 잇고, `set_cells_terrain_path`는 배열에서 연달아 오는 칸끼리만 잇습니다(길을 한 획으로 그리는 것과 같습니다). 둘 다 `(cells, terrain_set, terrain, ignore_empty_terrains = true)`를 받습니다.

### TileMap과 TileMapLayer 중 무엇을 써야 하나요? {#faq-5}
TileMapLayer를 쓰세요. Godot 4.3부터 TileMap 노드는 폐지 예정이 되었고 레이어마다 TileMapLayer 노드를 씁니다. 터레인 API는 같습니다.

## 참고 자료 {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) (터레인 세트, 모드, 피어링 비트, 타일 자동 생성)
- [Using TileMaps — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html) (Connect/Path 칠하기 모드)
- [TileMapLayer 클래스 레퍼런스(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html) (`set_cells_terrain_connect`, `set_cells_terrain_path`)
- [TileSet 클래스 레퍼런스(4.7)](https://docs.godotengine.org/en/stable/classes/class_tileset.html) (`TerrainMode`, `CellNeighbor`)
- [TileData 클래스 레퍼런스(4.7)](https://docs.godotengine.org/en/stable/classes/class_tiledata.html) (`terrain_set`, `terrain`, `probability`, `set_terrain_peering_bit`)
- [TileMap 클래스 레퍼런스(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemap.html) (폐지 예정 안내)
- [godotengine/godot#73903: 칠하는 순서에 따라 터레인 결과가 달라지는 문제](https://github.com/godotengine/godot/issues/73903)
- 아트: [Cave platformer tileset 47](https://opengameart.org/content/cave-platformer-tileset-47), [GameMaker autotile templates](https://opengameart.org/content/gamemaker-autotile-templates) (둘 다 OpenGameArt의 CC0)
