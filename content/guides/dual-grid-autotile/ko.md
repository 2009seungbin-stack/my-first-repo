듀얼 그리드(dual grid) 타일맵은 지형 데이터를 한 그리드에 저장하고, 화면에는 반 타일 어긋난 두 번째 그리드로 그립니다. 그러면 그려지는 타일 하나가 논리 칸 네 개가 만나는 지점에 놓이므로, 네 모서리 중 어디가 채워졌는지만 알면 됩니다. 블롭 오토타일의 47가지 대신 **16가지 조합(타일 15장 + 빈칸)** 이면 충분합니다. Godot 4에서는 TileMapLayer 두 개로 만듭니다. 숨겨 둔 논리 레이어와, 반 타일 어긋나게 둔 표시 레이어이며, 표시 레이어는 짧은 스크립트가 4모서리 마스크로 채웁니다.

아래에서 숫자가 맞아떨어지는 이유, 실제로 돌려 본 GDScript 구현, Godot의 Match Corners 모드와의 차이(이것은 듀얼 그리드가 *아닙니다*), Tiled에서의 대응 기능을 차례로 설명합니다.

![논리 그리드를 겹쳐 표시한, Godot 4.7.2로 렌더링한 듀얼 그리드 맵](shot:engine-dual-grid "아래 dual_grid.gd 스크립트와 Wisp0468(OpenGameArt)의 CC0 \"Wang S-V2\" 2-코너 템플릿(32px 타일, 2배)으로 Godot 4.7.2에서 렌더링. 가는 선이 논리(월드) 그리드, 점이 칠한 칸이며, 그려진 타일은 반 타일 어긋나 그리드 교차점에 중심이 놓입니다.")

## 47장 대신 16장인 이유 {#why-16}

일반 오토타일에서는 타일이 논리 칸 *위에* 놓이고, 그 칸이 이웃 8칸과 어떻게 맞닿는지 보여 줘야 합니다. 이웃 8칸의 조합은 256가지이고, 모서리는 양옆 두 변이 모두 채워졌을 때만 의미가 있으므로 47가지로 줄어듭니다([Godot 4 터레인과 47타일 블롭](guide:godot-4-terrain-autotile-47-blob) 참고).

듀얼 그리드는 그려지는 타일을 옮겨, 타일의 중심이 **그리드 교차점**(논리 칸 네 개가 만나는 곳)에 오게 합니다. 그려지는 타일의 4분의 1씩이 논리 칸 하나에 정확히 대응하므로, 타일은 NW·NE·SE·SW 칸이 채워졌는지라는 네 가지 질문에만 답하면 됩니다. 2⁴ = 16가지입니다. 전부 빈 조합은 보통 아무것도 그리지 않으므로 아티스트가 그릴 타일은 15장이고, 그중 여럿은 서로 회전한 모양입니다. 블롭 세트를 크게 만드는 "이 모서리가 안쪽 모서리냐 바깥 모서리냐" 하는 문제가 사라집니다. 모서리 칸 자체가 데이터이기 때문입니다.

타일링 이론에서 **2-코너 Wang 세트**라고 부르는 세트이자, Godot 3의 "2×2" 비트마스크와 같은 세트입니다. 이 기법은 Oskar Stålberg의 작업과 jess::codes의 영상 [Draw fewer tiles – by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg)으로 널리 알려졌습니다.

대신 감수할 점도 있습니다.

- **아트를 모서리 기준으로 그려야 합니다.** 타일 중심이 그리드 교차점이므로 지형 경계선이 타일 한가운데를 지나야 합니다. 일반 47타일 시트를 그대로 쓸 수는 없습니다.
- **레이어 두 개를 맞춰야 합니다.** 게임플레이(충돌, 길찾기, "이 칸에 뭐가 있지?")는 논리 레이어가 담당하고, 표시 레이어는 모양만 담당합니다.
- **외톨이 칸은 둥글게 보입니다.** 칠한 칸 하나는 주변 네 타일의 4분의 1 조각으로 그려지므로, 전용 "외톨이" 타일이 아니라 아트의 모서리 모양을 따릅니다.

## Godot 4에서 듀얼 그리드 만들기 {#godot-dual-grid}

:::steps
1. **16타일 모서리 시트 준비.** 모서리 조합(NW, NE, SE, SW가 채워졌는지)마다 타일이 하나씩 있는 4×4 시트를 씁니다. 위 이미지의 2-코너 Wang 템플릿이 그 예입니다. 칸마다 어떤 마스크인지 적어 둡니다.
2. **TileSet 하나 만들기.** **Tile Size**를 타일 크기로 맞추고 시트를 아틀라스로 추가합니다. 타일은 스크립트가 고르므로 터레인 세트는 필요 없습니다.
3. **TileMapLayer 두 개 추가.** 하나는 `World`(논리 레이어), 하나는 `Display`로 이름 짓고 같은 TileSet을 줍니다. `World`를 다 칠했으면 **Visible**을 끕니다.
4. **스크립트 붙이기.** `Display`에 아래 `dual_grid.gd`를 붙이고 **World Layer** 속성에 `World`를 지정합니다. 시작할 때 `Display`를 반 타일만큼 왼쪽 위로 옮기고, 표시 칸마다 네 월드 칸을 보고 타일을 그립니다.
5. **월드 칠하기.** `World`에 세트의 아무 타일이나 칠하거나, 코드에서 `set_terrain(cell, true)`를 호출합니다. 바뀔 때마다 그 월드 칸에 닿는 표시 칸 네 개를 다시 그립니다.
6. **게임플레이는 World에.** 충돌은 `World`가 쓰는 타일(또는 별도 물리 레이어)에 넣고, 코드에서도 `World`를 조회합니다. `Display`는 보여 주기 위한 것입니다.
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

### 오프셋의 원리 {#offset}

표시 칸 `(x, y)`는 반 타일 왼쪽 위에 그려지므로, 월드 칸 `(x-1, y-1)`의 오른쪽 아래 4분의 1, `(x, y-1)`의 왼쪽 아래 4분의 1, `(x, y)`의 왼쪽 위 4분의 1, `(x-1, y)`의 오른쪽 위 4분의 1을 덮습니다. 마스크가 읽는 네 칸과 정확히 같습니다. 그래서 W×H 월드에는 (W+1)×(H+1)개의 표시 칸이 필요합니다. 15×9 월드로 돌려 본 결과, 표시 칸 160개가 모두 따로 계산한 모서리 마스크와 일치했습니다.

아트에 따라 달라지는 부분은 `ATLAS` 표뿐입니다. 시트 순서가 다르다면(예: 타일 *n*이 마스크 *n*인 "바이너리" 순서) 그 표를 적으면 됩니다. 표가 틀리면 경계가 엉뚱한 방향을 향하므로 바로 알 수 있습니다.

### 에디터 미리보기와 기성 플러그인 {#plugins}

위 스크립트는 실행 중에 그립니다. 에디터에서 칠하면서 결과를 보려면 `@tool` 스크립트로 만들어 `World`가 바뀔 때 다시 그리거나, 플러그인을 씁니다. [TileMapDual](https://github.com/pablogila/TileMapDual)(MIT)은 에디터와 게임 양쪽에서 이를 처리하는 커스텀 TileMapLayer 노드로, 정사각형과 아이소메트릭 그리드를 지원합니다. [jess::codes 시스템의 GDScript 포트](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript)는 최소한의 참고 구현입니다. 듀얼 그리드를 엔진 기본 기능으로 넣자는 제안 [godot-proposals#10567](https://github.com/godotengine/godot-proposals/issues/10567)은 아직 열려 있습니다.

## Godot의 Match Corners 모드가 듀얼 그리드가 아닌 이유 {#match-corners}

Godot 4 터레인에는 **Match Corners** 모드가 있고, 모서리 세트는 여기에 딱 맞습니다(타일 15장, 모서리 피어링 비트만 사용). 그러나 Godot는 이 타일을 반 타일 어긋나게가 아니라 **칠한 칸 위에** 그립니다. 칠한 칸이 모서리 *점*으로 취급되므로, 지형은 칠한 칸들의 중심 사이에 그려집니다.

![같은 맵을 Godot의 Match Corners 터레인으로 칠한 결과](shot:engine-godot-match-corners "Godot 4.7.2로 렌더링: 같은 15장으로 만든 Match Corners 터레인에 같은 38칸을 set_cells_terrain_connect로 칠한 결과. 모래가 칠한 칸 중심 사이 영역으로 줄어들고, 외톨이 칸과 한 칸 폭의 선은 물만 있는 타일이 됩니다. 어두운 칸은 칠하지 않은 칸입니다.")

모든 모양이 사방으로 반 칸씩 줄어들고, 외톨이 칸이나 한 칸 폭의 선은 사라집니다. 칠한 38칸 중 전부 모래인 타일이 들어간 칸은 1칸뿐이었습니다. Match Corners도 그리드 교차점 기준으로 *생각하는* 경우에는 쓸모가 있습니다. 채우고 싶은 모서리를 칠하고, 칠한 칸이 곧 모서리라는 점을 받아들이면 됩니다. "내가 클릭한 칸이 모래"이기를 원한다면 레이어 두 개짜리 듀얼 그리드를 쓰세요.

## Tiled와 다른 에디터 {#tiled}

Tiled의 터레인 시스템에서는 이것을 **Corner Set**이라고 부르며, 매뉴얼에는 "터레인 2개로 된 완전한 세트는 16장"이라고 나옵니다. 코너 세트에서 Terrain Brush는 타일 사이의 교차점을 칠하므로 듀얼 그리드와 같은 발상입니다. 맵에 저장되는 것은 모서리 데이터가 아니라 결과 타일입니다. 설정과 내보내기는 [Tiled 터레인 세트](guide:tiled-wang-sets-terrain)를 참고하세요. LDtk에서는 오토 레이어 규칙과 반 타일 오프셋으로 듀얼 그리드를 흉내 낼 수 있습니다.

## 터레인이 여러 개일 때 {#multiple-terrains}

터레인이 두 개(이미지의 모래와 물)라면 마스크 0은 "전부 물" 타일이므로 모든 표시 칸이 그려집니다. 터레인이 더 많으면 보통 터레인마다 표시 레이어를 하나씩 두고 우선순위대로 쌓습니다(물, 그 위에 모래, 그 위에 잔디). 레이어마다 "투명 위의 터레인" 16타일 세트를 쓰고, 스크립트 주석처럼 마스크 0인 칸은 지웁니다. 그러면 터레인 쌍마다 전환 세트를 만들 필요 없이 터레인당 15장으로 끝납니다.

:::nerulio ws=tile
Nerulio Tile 작업 공간은 16타일 모서리 시트(cr31 2-코너 / Godot 3 "2×2" / 듀얼 그리드 4×4 순서)를 픽셀로 인식하고, 여러 블록이 든 팩은 터레인까지 구분합니다. 47타일 세트에 쓰는 것과 같은 4분의 1 조각으로 듀얼 그리드 16장 세트를 *생성*할 수도 있습니다(예: RPG 쯔꾸르 A2 블록에서).
- **Test map**에서 **Tiled** 규칙(듀얼 그리드처럼 모서리 세트를 반 타일 어긋나게 그림)과 **Godot 4** 규칙(위 두 번째 이미지처럼 칸 위에 그림)을 모두 볼 수 있습니다.
- **Export → Tiled**는 코너 Wang 세트와, 레이어를 반 타일 어긋나게 둔 샘플 맵을 씁니다. Tiled 1.12.2로 다시 읽어 확인했습니다.
- **Export → Godot 4**는 Match Corners 터레인을 쓰며 Godot 4.7.2에서 검증했습니다. Godot에서 진짜 듀얼 그리드를 쓰려면 그 세트의 배치로 위 스크립트의 `ATLAS` 표를 만들거나 TileMapDual을 쓰세요. Unity 내보내기에는 모서리 세트가 없습니다(RuleTile은 칸 위에 그리기 때문입니다).
:::

## 자주 묻는 질문 {#faq}

### 듀얼 그리드 타일셋에는 타일이 몇 장 필요한가요? {#faq-1}
모서리 조합은 16가지이고, 전부 빈 조합은 보통 그리지 않으므로 터레인당 15장입니다. 회전을 허용하면 서로 다른 모양은 5가지(모서리 하나, 이웃한 모서리 둘, 마주 보는 모서리 둘, 모서리 셋, 가득 참)뿐이므로, 5장만 그리고 나머지는 회전해 쓸 수 있습니다.

### 듀얼 그리드와 Godot의 Match Corners 터레인은 같은 건가요? {#faq-2}
아닙니다. 둘 다 같은 15장 모서리 세트를 쓰지만, Match Corners는 칠한 칸 위에 타일을 그리고 칸을 모서리 점으로 취급하므로 모양이 반 칸씩 줄어듭니다. 듀얼 그리드는 반 타일 어긋난 두 번째 그리드에 그리므로 칠한 칸이 그대로 채워져 보입니다.

### 일반 47타일 타일셋을 듀얼 그리드에 쓸 수 있나요? {#faq-3}
그대로는 안 됩니다. 듀얼 그리드 타일은 지형 경계가 타일 한가운데를 지나고, 블롭 타일은 경계가 타일 테두리에 있습니다. 모서리(16장) 시트가 필요하며, 같은 4분의 1 조각으로 이를 조립해 주는 도구를 써도 됩니다.

### 듀얼 그리드에서 충돌은 어디에 넣나요? {#faq-4}
게임플레이 그리드와 정렬된 논리(월드) 레이어에 넣습니다. 표시 레이어는 반 타일 어긋나 있고 보여 주기 위한 용도일 뿐입니다.

### Tiled는 듀얼 그리드 타일셋을 지원하나요? {#faq-5}
네, 터레인 시스템의 Corner Set으로 지원합니다. Terrain Brush가 그리드 교차점을 칠하고 맞는 모서리 타일을 놓습니다. 엔진은 그 결과 타일을 다른 Tiled 맵처럼 불러옵니다.

## 참고 자료 {#sources}

- [Using TileSets — Godot Engine 4.7 documentation](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) (터레인 모드, Match Corners)
- [TileMapLayer 클래스 레퍼런스(4.7)](https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html) (`set_cell`, `erase_cell`, `get_cell_source_id`, `set_cells_terrain_connect`)
- [Using Terrains — Tiled 1.12 documentation](https://doc.mapeditor.org/en/stable/manual/terrain/) (Corner Set, Edge Set, Mixed Set)
- [godot-proposals#10567: 듀얼 그리드 타일맵 시스템 추가 제안](https://github.com/godotengine/godot-proposals/issues/10567)
- [TileMapDual](https://github.com/pablogila/TileMapDual), [dual-grid-tilemap-system-godot-gdscript](https://github.com/GlitchedinOrbit/dual-grid-tilemap-system-godot-gdscript) (커뮤니티 구현)
- [jess::codes — Draw fewer tiles, by using a Dual-Grid system!](https://youtu.be/jEWFSv3ivTg)
- 아트: [Wisp0468의 Tileset templates](https://opengameart.org/content/tileset-templates) (CC0, OpenGameArt)
