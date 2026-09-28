/** Intent content for the tile → engine pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/tiles/*.js (patterns, layouts, generator, godot-terrain port, godot-export,
 * tiled, ldtk, unity), src/game/godot-tileset.js (the shipped importer), src/game/tile-collision.js,
 * src/studio/workspaces/tile/ and docs/STUDIO-TILE.md (Godot 4.7.2, Tiled 1.12.2, LDtk 1.5.3 schema,
 * Unity 6000.5.3f1 + 2D Tilemap Extras 8.0.3). Numbers in the examples were recomputed with those
 * modules (47 masks, 188 peering bits, Wang IDs, LDtk patterns, Unity neighbour lists, Godot picks).
 * Engine behaviour: the official docs cited in each page's `versions.sources`. */
const GD='https://docs.godotengine.org/en/stable/';
const GODOT_TILESETS=`[Godot 4.7 docs: Using TileSets](${GD}tutorials/2d/using_tilesets.html)`;
const GODOT_TILEMAPS=`[Godot 4.7 docs: Using TileMaps](${GD}tutorials/2d/using_tilemaps.html)`;
const GODOT_LAYER=`[Godot 4.7 docs: TileMapLayer](${GD}classes/class_tilemaplayer.html)`;
const GODOT_TILEDATA=`[Godot 4.7 docs: TileData](${GD}classes/class_tiledata.html)`;
const GODOT_TILESET=`[Godot 4.7 docs: TileSet](${GD}classes/class_tileset.html)`;
const GODOT_EDITORSCRIPT=`[Godot 4.7 docs: Running code in the editor (EditorScript)](${GD}tutorials/plugins/running_code_in_the_editor.html)`;
const GODOT_DEBUG=`[Godot 4.7 docs: Overview of debugging tools](${GD}tutorials/scripting/debug/overview_of_debugging_tools.html)`;
const TILED_TERRAIN='[Tiled docs: Using Terrains](https://doc.mapeditor.org/en/stable/manual/terrain/)';
const TILED_TMX='[Tiled docs: TMX Map Format (wangset, wangtile)](https://doc.mapeditor.org/en/stable/reference/tmx-map-format/)';
const TILED_EDIT='[Tiled docs: Editing Tile Layers (Terrain Brush)](https://doc.mapeditor.org/en/stable/manual/editing-tile-layers/)';
const UX='https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/';
const UNITY_RULETILE=`[2D Tilemap Extras 8.0.3: Create a rule tile](${UX}RuleTile.html)`;
const UNITY_INSPECTOR=`[2D Tilemap Extras 8.0.3: Rule Tile Inspector reference](${UX}RuleTile-Inspector.html)`;
const UNITY_INSTALL=`[2D Tilemap Extras 8.0.3: Install](${UX}install.html)`;
const UM='https://docs.unity3d.com/6000.0/Documentation/Manual/tilemaps/';
const UNITY_TILEMAP=`[Unity 6 Manual: Create a tilemap](${UM}work-with-tilemaps/create-tilemap.html)`;
const UNITY_PALETTE=`[Unity 6 Manual: Create a tile palette](${UM}tiles-for-tilemaps/create-tile-assets.html)`;
const UNITY_COLLIDER=`[Unity 6 Manual: Enable collision detection for tiles](${UM}work-with-tilemaps/tilemap-collider-2d.html)`;
const LDTK_AUTO='[LDtk docs: Auto layers](https://ldtk.io/docs/general/auto-layers/)';
const LDTK_RULES='[LDtk docs: Rules](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)';
const LDTK_JSON='[LDtk JSON 1.5.3 documentation](https://ldtk.io/json/)';
const LDTK_INTGRID='[LDtk docs: IntGrid layers](https://ldtk.io/docs/general/intgrid-layers/)';
const GM_AUTO='[GameMaker Manual: Auto Tiles](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Tile_Set_Editors/Auto_Tiles.htm)';
const GM_TILESETS='[GameMaker Manual: The Tile Set Editor](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Tile_Sets.htm)';
const RM_STANDARDS='[RPG Maker MZ Help: Asset Standards](https://rpgmakerofficial.com/product/MZ_help-en/01_11_01.html)';
const RM_BLOG='[RPG Maker blog: How Autotiles Work](https://www.rpgmakerweb.com/blog/classic-tutorial-how-autotiles-work)';
export default {
 'game/godot-autotile':{
  type:'engine',
  intent:{primary:'set up autotiling in Godot 4 (terrain sets and peering bits) from an autotile sheet',secondary:['which match mode for a 47, 16-side or 16-corner sheet','peering bits for 47 blob tiles without clicking them','paint with the Terrains tab or set_cells_terrain_connect'],
   goal:'a Godot 4 TileSet whose terrain paints the right tile in every cell, in the editor and from code',input:'autotile sheet PNG (blob-47 in a published order, 16-side, 16-corner / dual grid, 3×3 box) or bits painted in the Studio',output:'PNG + nerulio-tileset.json + nerulio_tileset_import.gd + README.txt; the script saves nerulio-tileset.tres inside Godot',target:'Godot 4 (verified 4.7.2)',support:'full',
   evidence:['src/game/tiles/godot-export.js','src/game/godot-tileset.js (Builder: add_terrain_set, set_terrain_peering_bit)','src/game/tiles/godot-terrain.js (port of set_cells_terrain_connect)','docs/STUDIO-TILE.md (Godot 4.7.2: 485/485 per blob set, 251/251 dual grid)'],
   external:['Godot 4.7 docs: Using TileSets (terrain sets, match modes, peering bits)','Using TileMaps (Terrains tab: Connect, Path)','TileMapLayer.set_cells_terrain_connect','EditorScript File › Run']},
  en:{
   answer:'Godot 4 has no "autotile" tile type any more: autotiling is a terrain set on the TileSet (match mode Match Corners and Sides, Match Corners or Match Sides), terrains inside it, and on every tile a terrain plus peering bits that say which terrain each neighbour must have. A 47-tile blob sheet needs 188 connected bits set on the right tiles. Nerulio reads the layout from the pixels, sets the bits and ships a GDScript that builds the TileSet inside Godot; you then paint with the Terrains tab or call `set_cells_terrain_connect()`. Verified in Godot 4.7.2.',
   concept:{title:'Terrain sets, match modes and peering bits',body:[
    'The Godot 4.7 documentation calls terrains "a more powerful replacement" of Godot 3 autotiles. A TileSet owns terrain sets; each set has a mode that decides which neighbours count, and one or more terrains (name and colour). Each tile then gets a Terrain Set and a Terrain ID (both start at 0; −1 means none) and, per neighbour position, a peering bit: the terrain expected there, or −1 for empty. The docs\' own example: a tile whose bits are all 0 only appears when all 8 neighbours are terrain 0.',
    'The mode follows the art. A 47-tile blob set draws inner corners, so it needs Match Corners and Sides (all 8 positions). A 16-tile side set or a 3 × 3 box only cares about the four sides: Match Sides. A 16-tile corner set (Wang 2-corner, the dual-grid 4 × 4) needs Match Corners. Why 47 and not 256: a corner only matters when both sides next to it connect, so the 256 possible neighbourhoods of a cell reduce to 47 different tiles.',
    'When you paint, Godot chooses for each cell the tile whose bits agree best with the neighbours. The TileMapLayer reference warns that this needs "all required terrain combinations"; when one is missing, Godot quietly draws the closest tile or leaves the cell empty — the most common reason a Godot terrain "does not work" (see [[game/godot-terrain-wrong-tiles|wrong Godot terrain tiles]]).'],
    terms:[['Terrain set','A group of terrains that match each other under one mode; a tile belongs to one terrain set.'],['Match Corners and Sides / Match Corners / Match Sides','The three modes: which of the 8 neighbour positions a tile\'s bits describe.'],['Peering bit','Per neighbour position (named after `TileSet.CellNeighbor`, e.g. `top_right_corner`): the terrain ID expected there, −1 = empty.'],['`set_cells_terrain_connect`','The `TileMapLayer` method that paints terrain from code and updates neighbouring cells, the same matching the Terrains tab uses.']]},
   example:{title:'Example: one cell, eight neighbours, one tile',lead:'A map where X is ground and C is the cell being painted. The cr31 mask adds a weight for every ground neighbour:',lines:[
    'map          . X X',
    '             X C .',
    '             . X .',
    'weights      N 1   NE 2   E 4   SE 8   S 16   SW 32   W 64   NW 128',
    'raw mask     N + NE + S + W = 1 + 2 + 16 + 64 = 83',
    'NE counts only when N and E are both ground; E is empty, so NE drops',
    'tile mask    1 + 16 + 64 = 81   (one of the 47)',
    'Godot tile   terrain 0; top_side 0, bottom_side 0, left_side 0; the other 5 bits −1',
    'whole set    47 tiles, 188 bits set to 0 (every other bit stays −1)'],
    after:'In `nerulio-tileset.json` that tile reads `"peering":{"top_side":0,"bottom_side":0,"left_side":0}`; a missing name means −1. The import script maps each name to its `TileSet.CellNeighbor` constant and calls `TileData.set_terrain_peering_bit()`.'},
   outputs:{lead:'The Godot folder of the export ZIP, shown for a sheet called cave.png (the same ZIP also holds Tiled, LDtk, Unity and generic folders plus NOTES.txt):',rows:[
    ['cave.png','The tileset image, unchanged.'],
    ['nerulio-tileset.json','Tile size, margins, separation, the terrain set (mode, terrain names and colours) and for every tile its atlas coordinates, terrain and peering bits; collision polygons and probability when you set them.'],
    ['nerulio_tileset_import.gd','An `EditorScript` whose `Builder` class creates the TileSet through Godot\'s own API and saves `res://nerulio-tileset.tres`. No hand-written .tres is shipped.'],
    ['README.txt','The steps below for this set, with its mode and tile count.']]},
   target:{title:'Build the TileSet in Godot 4 and paint with it',steps:[
    'Copy the PNG, `nerulio-tileset.json` and `nerulio_tileset_import.gd` into the project root. The script reads `res://nerulio-tileset.json` and writes `res://nerulio-tileset.tres`; if you keep them in a subfolder, change `JSON_PATH` and `OUTPUT_PATH` at the top of the script.',
    'Wait until the FileSystem dock has imported the PNG, open the script in the script editor and run File › Run (Ctrl+Shift+X). The Output panel prints a line such as `Saved res://nerulio-tileset.tres: source 0, 47 tiles, 188 peering bits, 0 collision polygons, mode match_corners_and_sides`.',
    'Add a `TileMapLayer` node and load `nerulio-tileset.tres` into its Tile Set property.',
    'With the layer selected, open the TileMap panel at the bottom, switch to the Terrains tab, pick terrain set 0 and your terrain, choose Connect mode and paint. Path mode connects only the cells of one stroke.',
    'From code, paint a whole area at once: `$TileMapLayer.set_cells_terrain_connect(cells, 0, 0)` where `cells` is an `Array[Vector2i]`, 0 the terrain set and 0 the terrain.',
    'For pixel art, set the layer\'s Texture › Filter to Nearest (or the project\'s default canvas texture filter); see [[game/godot-pixel-art-blurry|blurry pixel art in Godot]].']},
   verify:{steps:[
    'The Output line counts the tiles and bits: 47 tiles and 188 bits for a blob set, 16 tiles and 32 bits for a 16-side or 16-corner set.',
    'TileSet editor › Select mode › click a tile: the Terrains section shows Terrain Set 0, Terrain 0, and the peering bits are drawn over the tile.',
    'Paint a 3 × 3 square and a single cell: the square gets 9 different tiles (4 corners, 4 edges, the centre), the single cell the isolated tile.',
    'Paint the same shape on the Studio\'s test map with the Godot rule: Godot 4.7.2 put the same tile in every cell in our runs.']},
   trouble:{rows:[
    ['The script prints `Cannot read res://nerulio-tileset.json`','The files sit in a subfolder or the JSON was renamed','Output panel, first line','Move the three files to `res://`, or edit `JSON_PATH` and `OUTPUT_PATH` in the script and run it again'],
    ['Warning: the PNG "was not imported yet, so its pixels are embedded"','The script ran before the editor imported the image','The `.tres` is much larger than the PNG','Let the FileSystem dock finish importing, then run the script again so the TileSet points at the imported PNG'],
    ['`Tile (x, y) is outside the … atlas grid; skipped`','The PNG in the project is not the exported one, or the grid (margin, spacing) was set wrong before export','Compare the image size with the grid shown in the Studio\'s Tileset panel','Fix the grid, export again and replace both PNG and JSON'],
    ['Painting leaves empty cells or wrong corners','The set lacks a combination; Godot substitutes the closest tile or none','Studio Check panel: combinations present / expected, ghost tiles','Draw or [[game/tileset-generator|generate]] the missing tiles, then export again'],
    ['The Terrains tab shows nothing to paint','The layer uses another TileSet, or tiles have no Terrain Set','Tile Set property of the `TileMapLayer`','Load `nerulio-tileset.tres` into that layer'],
    ['Tiles look soft when zoomed','Linear texture filtering on the layer','Zoom the 2D viewport and look at pixel edges','Set Texture › Filter to Nearest on the layer or project-wide']]},
   alternatives:{rows:[
    ['Set the bits by hand in Godot\'s TileSet editor (Select mode, Terrains section; or tile property painting to apply one value to many tiles)','A handful of tiles, or a sheet in no layout Nerulio knows. No extra files, but a blob set means 47 tiles to configure one by one.'],
    ['Check or complete the set first with the [[game/autotile-tester|autotile tester]] or the [[game/tileset-generator|tileset generator]]','Your sheet is incomplete or you only have a small source block.'],
    ['Draw the map in Tiled with a [[game/tiled-wang-set|Wang set]] and export it with Tiled\'s Godot 4 exporter (since Tiled 1.10)','You design levels in Tiled and only need the finished map in Godot.']]},
   limits:['One terrain set per export (up to 16 terrains inside it); isometric and hexagonal tiles, animated and alternative tiles are not written.','The Godot editor\'s terrain brush was not driven by our tests; `set_cells_terrain_connect`, which it uses, was.','Corner (dual-grid) sets are drawn on the cells in Godot, not half a tile off: see [[game/dual-grid-tileset|dual-grid tilesets]].'],
   versions:{body:['Verified in Godot 4.7.2: the shipped importer built each TileSet headless, the resource was reloaded and painted with `set_cells_terrain_connect`, and every painted cell equalled the Studio\'s prediction — 485/485 cells on each blob set of the corpus, 251/251 on a four-terrain dual-grid pack. Editor menus and node names above follow the Godot 4.7 documentation.'],sources:[GODOT_TILESETS,GODOT_TILEMAPS,GODOT_LAYER,GODOT_EDITORSCRIPT]}
  },
  ko:{
   answer:'Godot 4에는 이제 "오토타일"이라는 타일 종류가 없습니다. 자동 연결은 TileSet의 지형 세트(매칭 모드 Match Corners and Sides·Match Corners·Match Sides)와 그 안의 지형, 그리고 타일마다 지정하는 지형과 피어링 비트(이웃 칸마다 어떤 지형이 와야 하는지)로 이뤄집니다. 47타일 블롭 시트라면 연결 비트 188개를 제자리에 찍어야 합니다. Nerulio는 픽셀에서 배치를 읽어 비트를 설정하고, Godot 안에서 TileSet을 만드는 GDScript를 함께 줍니다. 그 뒤 Terrains 탭으로 칠하거나 `set_cells_terrain_connect()`를 호출하면 됩니다. Godot 4.7.2에서 검증했습니다.',
   concept:{title:'지형 세트, 매칭 모드, 피어링 비트',body:[
    'Godot 4.7 문서는 지형을 Godot 3 오토타일의 "더 강력한 대체"라고 설명합니다. TileSet이 지형 세트를 가지며, 세트마다 어떤 이웃을 볼지 정하는 모드와 하나 이상의 지형(이름과 색)이 있습니다. 각 타일에는 Terrain Set과 Terrain 번호(둘 다 0부터, −1은 없음)를 주고, 이웃 위치마다 피어링 비트, 즉 그 자리에 와야 할 지형 번호(빈칸이면 −1)를 줍니다. 문서의 예처럼 비트가 모두 0인 타일은 8개 이웃이 전부 지형 0일 때만 나옵니다.',
    '모드는 그림을 따릅니다. 안쪽 모서리까지 그린 47타일 블롭 세트는 8방향을 모두 보는 Match Corners and Sides, 변 16타일이나 3 × 3 상자는 네 변만 보는 Match Sides, 모서리 16타일(Wang 2-corner, 듀얼 그리드 4 × 4)은 Match Corners가 맞습니다. 256이 아니라 47인 이유는, 모서리는 양옆 두 변이 모두 이어질 때만 의미가 있어서 한 칸의 이웃 조합 256가지가 서로 다른 타일 47개로 줄어들기 때문입니다.',
    '칠할 때 Godot는 칸마다 이웃과 비트가 가장 잘 맞는 타일을 고릅니다. TileMapLayer 레퍼런스는 이 기능에 "필요한 모든 지형 조합"이 있어야 한다고 경고합니다. 조합이 빠지면 Godot는 아무 경고 없이 가장 가까운 타일을 넣거나 칸을 비워 두는데, "Godot 지형이 안 된다"는 경우의 대부분이 이것입니다([[game/godot-terrain-wrong-tiles|Godot 지형이 틀린 타일을 칠할 때]] 참고).'],
    terms:[['지형 세트(Terrain set)','한 모드 아래에서 서로 맞춰지는 지형의 묶음. 타일 하나는 한 지형 세트에 속합니다.'],['Match Corners and Sides / Match Corners / Match Sides','세 가지 모드. 타일 비트가 8개 이웃 위치 중 어디를 설명하는지 정합니다.'],['피어링 비트','이웃 위치마다(`TileSet.CellNeighbor` 이름, 예: `top_right_corner`) 와야 할 지형 번호. −1은 빈칸.'],['`set_cells_terrain_connect`','코드로 지형을 칠하고 이웃 칸까지 고쳐 주는 `TileMapLayer` 메서드. Terrains 탭과 같은 매칭을 씁니다.']]},
   example:{title:'예시: 칸 하나, 이웃 여덟, 타일 하나',lead:'X는 땅, C는 지금 칠하는 칸입니다. cr31 마스크는 땅인 이웃마다 가중치를 더합니다.',lines:[
    '맵            . X X',
    '              X C .',
    '              . X .',
    '가중치        N 1   NE 2   E 4   SE 8   S 16   SW 32   W 64   NW 128',
    '원래 마스크   N + NE + S + W = 1 + 2 + 16 + 64 = 83',
    'NE는 N과 E가 모두 땅일 때만 셈. E가 비었으므로 NE는 빠짐',
    '타일 마스크   1 + 16 + 64 = 81   (47개 중 하나)',
    'Godot 타일    지형 0; top_side 0, bottom_side 0, left_side 0; 나머지 5비트 −1',
    '세트 전체     타일 47개, 0으로 설정된 비트 188개(나머지는 −1)'],
    after:'`nerulio-tileset.json`에서 이 타일은 `"peering":{"top_side":0,"bottom_side":0,"left_side":0}`으로 적히고, 이름이 없는 위치는 −1입니다. 가져오기 스크립트는 이름마다 `TileSet.CellNeighbor` 상수를 찾아 `TileData.set_terrain_peering_bit()`를 호출합니다.'},
   outputs:{lead:'cave.png라는 시트를 내보냈을 때의 ZIP 속 Godot 폴더입니다(같은 ZIP에 Tiled·LDtk·Unity·범용 폴더와 NOTES.txt도 들어 있습니다).',rows:[
    ['cave.png','타일셋 이미지. 바뀌지 않습니다.'],
    ['nerulio-tileset.json','타일 크기, 여백, 간격, 지형 세트(모드, 지형 이름과 색), 타일마다 아틀라스 좌표·지형·피어링 비트. 설정했다면 충돌 폴리곤과 확률도 들어갑니다.'],
    ['nerulio_tileset_import.gd','`Builder` 클래스가 Godot 자체 API로 TileSet을 만들어 `res://nerulio-tileset.tres`로 저장하는 `EditorScript`. 손으로 쓴 .tres는 주지 않습니다.'],
    ['README.txt','이 세트의 모드와 타일 수가 적힌 아래 단계 안내.']]},
   target:{title:'Godot 4에서 TileSet 만들고 칠하기',steps:[
    'PNG, `nerulio-tileset.json`, `nerulio_tileset_import.gd`를 프로젝트 루트에 복사합니다. 스크립트는 `res://nerulio-tileset.json`을 읽고 `res://nerulio-tileset.tres`를 쓰므로, 하위 폴더에 둘 때는 스크립트 맨 위의 `JSON_PATH`와 `OUTPUT_PATH`를 고치세요.',
    '파일시스템 독이 PNG 가져오기를 마치면 스크립트 편집기에서 스크립트를 열고 File › Run(Ctrl+Shift+X)으로 실행합니다. 출력 패널에 `Saved res://nerulio-tileset.tres: source 0, 47 tiles, 188 peering bits, 0 collision polygons, mode match_corners_and_sides` 같은 줄이 나옵니다.',
    '`TileMapLayer` 노드를 추가하고 Tile Set 속성에 `nerulio-tileset.tres`를 넣습니다.',
    '레이어를 선택한 채 아래쪽 TileMap 패널의 Terrains 탭에서 지형 세트 0과 지형을 고르고 Connect 모드로 칠합니다. Path 모드는 한 번의 획 안에서만 칸을 잇습니다.',
    '코드로는 영역 전체를 한 번에 칠합니다. `$TileMapLayer.set_cells_terrain_connect(cells, 0, 0)`에서 `cells`는 `Array[Vector2i]`, 앞의 0은 지형 세트, 뒤의 0은 지형입니다.',
    '픽셀 아트라면 레이어의 Texture › Filter를 Nearest로(또는 프로젝트 기본 캔버스 텍스처 필터를) 바꾸세요. [[game/godot-pixel-art-blurry|Godot에서 픽셀 아트가 흐릴 때]] 참고.']},
   verify:{steps:[
    '출력 줄의 타일·비트 수를 봅니다. 블롭 세트는 타일 47개·비트 188개, 변 16이나 모서리 16 세트는 타일 16개·비트 32개입니다.',
    'TileSet 편집기 › Select 모드에서 타일을 누르면 Terrains 섹션에 Terrain Set 0, Terrain 0이 보이고 타일 위에 피어링 비트가 그려집니다.',
    '3 × 3 사각형과 외딴 칸 하나를 칠합니다. 사각형에는 서로 다른 타일 9개(모서리 4, 변 4, 가운데)가, 외딴 칸에는 고립 타일이 놓여야 합니다.',
    'Studio 테스트 맵에서 같은 모양을 Godot 규칙으로 칠해 봅니다. 저희 실행에서 Godot 4.7.2는 모든 칸에 같은 타일을 놓았습니다.']},
   trouble:{rows:[
    ['스크립트가 `Cannot read res://nerulio-tileset.json`을 출력','파일이 하위 폴더에 있거나 JSON 이름을 바꿈','출력 패널 첫 줄','세 파일을 `res://`로 옮기거나, 스크립트의 `JSON_PATH`와 `OUTPUT_PATH`를 고친 뒤 다시 실행'],
    ['PNG가 아직 가져와지지 않아 픽셀을 포함했다는 경고','편집기가 이미지를 가져오기 전에 스크립트를 실행함','`.tres`가 PNG보다 훨씬 큼','파일시스템 독의 가져오기가 끝난 뒤 다시 실행해 TileSet이 가져온 PNG를 가리키게 함'],
    ['`Tile (x, y) is outside the … atlas grid; skipped`','프로젝트의 PNG가 내보낸 것과 다르거나, 내보내기 전 격자(여백·간격)가 틀림','Studio 타일셋 패널의 격자와 이미지 크기를 비교','격자를 고쳐 다시 내보내고 PNG와 JSON을 함께 교체'],
    ['칠하면 빈칸이나 틀린 모서리가 생김','세트에 필요한 조합이 없어 Godot가 가까운 타일로 대체하거나 비워 둠','Studio 점검 패널의 있는 조합/필요한 조합, 유령 타일','빠진 타일을 그리거나 [[game/tileset-generator|생성]]한 뒤 다시 내보내기'],
    ['Terrains 탭에 칠할 것이 없음','레이어가 다른 TileSet을 쓰거나, 타일에 Terrain Set이 없음','`TileMapLayer`의 Tile Set 속성','그 레이어에 `nerulio-tileset.tres`를 지정'],
    ['확대하면 타일이 뭉개져 보임','레이어의 텍스처 필터가 Linear','2D 뷰포트를 확대해 픽셀 경계를 봄','레이어나 프로젝트 전체의 Texture › Filter를 Nearest로']]},
   alternatives:{rows:[
    ['Godot TileSet 편집기에서 비트를 직접 설정(Select 모드의 Terrains 섹션, 또는 같은 값을 여러 타일에 칠하는 타일 속성 칠하기)','타일이 몇 개뿐이거나 Nerulio가 모르는 배치일 때. 추가 파일은 없지만 블롭 세트면 타일 47개를 하나씩 설정해야 합니다.'],
    ['먼저 [[game/autotile-tester|오토타일 테스터]]나 [[game/tileset-generator|타일셋 생성기]]로 세트를 점검·보완','시트가 불완전하거나 작은 원본 블록만 있을 때.'],
    ['Tiled에서 [[game/tiled-wang-set|Wang 세트]]로 맵을 그리고 Tiled의 Godot 4 내보내기(Tiled 1.10부터) 사용','레벨을 Tiled에서 설계하고 Godot에는 완성된 맵만 필요할 때.']]},
   limits:['내보내기 하나에 지형 세트 하나(안에 지형 최대 16개). 아이소메트릭·육각 타일, 애니메이션 타일, 대체 타일은 쓰지 않습니다.','Godot 편집기의 지형 브러시 자체는 테스트에서 조작하지 않았고, 브러시가 쓰는 `set_cells_terrain_connect`를 검증했습니다.','모서리(듀얼 그리드) 세트는 Godot에서 반 칸 어긋나지 않고 칸 위에 그려집니다. [[game/dual-grid-tileset|듀얼 그리드 타일셋]] 참고.'],
   versions:{body:['Godot 4.7.2에서 검증: 함께 주는 가져오기 스크립트가 헤드리스로 TileSet을 만들고, 리소스를 다시 불러와 `set_cells_terrain_connect`로 칠한 뒤 모든 칸을 Studio 예측과 비교했습니다. 코퍼스의 블롭 세트마다 485/485칸, 지형 4개짜리 듀얼 그리드 팩에서 251/251칸이 같았습니다. 위의 편집기 메뉴와 노드 이름은 Godot 4.7 공식 문서를 따릅니다.'],sources:[GODOT_TILESETS,GODOT_TILEMAPS,GODOT_LAYER,GODOT_EDITORSCRIPT]}
  },
  ja:{
   answer:'Godot 4には「オートタイル」というタイル種別はもうありません。自動接続は、TileSetの地形セット（マッチモードMatch Corners and Sides・Match Corners・Match Sides）とその中の地形、そしてタイルごとの地形とピアリングビット（隣のセルにどの地形が来るべきか）で決まります。47タイルのブロブシートなら、接続ビット188個を正しいタイルに設定しなければなりません。Nerulioはピクセルから配置を読み取ってビットを設定し、Godot内でTileSetを組み立てるGDScriptを添えます。あとはTerrainsタブで塗るか`set_cells_terrain_connect()`を呼ぶだけです。Godot 4.7.2で検証済みです。',
   concept:{title:'地形セット・マッチモード・ピアリングビット',body:[
    'Godot 4.7のドキュメントは、地形をGodot 3のオートタイルの「より強力な置き換え」と説明しています。TileSetが地形セットを持ち、セットごとにどの隣を見るかを決めるモードと、1つ以上の地形（名前と色）があります。各タイルにはTerrain SetとTerrainの番号（どちらも0から、−1はなし）を与え、隣の位置ごとにピアリングビット、つまりそこに来るべき地形番号（空なら−1）を設定します。ドキュメントの例のとおり、ビットがすべて0のタイルは8方向すべてが地形0のときだけ使われます。',
    'モードは絵で決まります。内角まで描いた47タイルのブロブセットは8方向すべてを見るMatch Corners and Sides、辺16タイルや3 × 3のボックスは4辺だけを見るMatch Sides、角16タイル（Wang 2-corner、デュアルグリッド4 × 4）はMatch Cornersです。256ではなく47になるのは、角は両隣の辺がつながっているときだけ意味を持つため、1セルの近傍256通りが異なるタイル47枚にまとまるからです。',
    '塗るとき、Godotはセルごとに隣とビットが最もよく合うタイルを選びます。TileMapLayerのリファレンスは、これには「必要なすべての地形の組み合わせ」が要ると注意しています。組み合わせが欠けていると、Godotは警告なしに最も近いタイルを置くかセルを空のままにします。「Godotの地形がうまく動かない」原因の大半はこれです（[[game/godot-terrain-wrong-tiles|Godotの地形が違うタイルを塗るとき]]を参照）。'],
    terms:[['地形セット（Terrain set）','1つのモードの下で互いに合わせられる地形のまとまり。タイルは1つの地形セットに属します。'],['Match Corners and Sides / Match Corners / Match Sides','3つのモード。タイルのビットが8つの隣接位置のどれを表すかを決めます。'],['ピアリングビット','隣の位置ごと（`TileSet.CellNeighbor`の名前、例：`top_right_corner`）に来るべき地形番号。−1は空。'],['`set_cells_terrain_connect`','コードから地形を塗り、隣のセルも更新する`TileMapLayer`のメソッド。Terrainsタブと同じマッチングを使います。']]},
   example:{title:'例：1セル、8つの隣、1枚のタイル',lead:'Xは地面、Cはいま塗るセルです。cr31マスクは地面の隣ごとに重みを足します。',lines:[
    'マップ        . X X',
    '              X C .',
    '              . X .',
    '重み          N 1   NE 2   E 4   SE 8   S 16   SW 32   W 64   NW 128',
    '元のマスク    N + NE + S + W = 1 + 2 + 16 + 64 = 83',
    'NEはNとEが両方地面のときだけ数える。Eが空なのでNEは外れる',
    'タイルマスク  1 + 16 + 64 = 81   （47のうちの1つ）',
    'Godotタイル   地形0; top_side 0, bottom_side 0, left_side 0; 残り5ビットは−1',
    'セット全体    タイル47枚、0に設定されたビット188個（それ以外は−1）'],
    after:'`nerulio-tileset.json`ではこのタイルは`"peering":{"top_side":0,"bottom_side":0,"left_side":0}`と書かれ、名前のない位置は−1です。インポートスクリプトは名前ごとに`TileSet.CellNeighbor`の定数を引き、`TileData.set_terrain_peering_bit()`を呼びます。'},
   outputs:{lead:'cave.pngというシートを書き出したときの、ZIP内のGodotフォルダーです（同じZIPにTiled・LDtk・Unity・汎用のフォルダーとNOTES.txtも入っています）。',rows:[
    ['cave.png','タイルセット画像。変更されません。'],
    ['nerulio-tileset.json','タイルサイズ、余白、間隔、地形セット（モード、地形の名前と色）、タイルごとのアトラス座標・地形・ピアリングビット。設定した場合は衝突ポリゴンと確率も入ります。'],
    ['nerulio_tileset_import.gd','`Builder`クラスがGodot自身のAPIでTileSetを作り、`res://nerulio-tileset.tres`として保存する`EditorScript`。手書きの.tresは同梱しません。'],
    ['README.txt','このセットのモードとタイル数を書いた、以下の手順。']]},
   target:{title:'Godot 4でTileSetを作って塗る',steps:[
    'PNG、`nerulio-tileset.json`、`nerulio_tileset_import.gd`をプロジェクトのルートにコピーします。スクリプトは`res://nerulio-tileset.json`を読み`res://nerulio-tileset.tres`を書くので、サブフォルダーに置く場合はスクリプト冒頭の`JSON_PATH`と`OUTPUT_PATH`を書き換えてください。',
    'ファイルシステムドックがPNGのインポートを終えたら、スクリプトエディターでスクリプトを開き、File › Run（Ctrl+Shift+X）で実行します。出力パネルに`Saved res://nerulio-tileset.tres: source 0, 47 tiles, 188 peering bits, 0 collision polygons, mode match_corners_and_sides`のような行が出ます。',
    '`TileMapLayer`ノードを追加し、Tile Setプロパティに`nerulio-tileset.tres`を読み込みます。',
    'レイヤーを選んだまま下部のTileMapパネルのTerrainsタブで地形セット0と地形を選び、Connectモードで塗ります。Pathモードは1回のストローク内のセルだけをつなぎます。',
    'コードでは範囲をまとめて塗ります。`$TileMapLayer.set_cells_terrain_connect(cells, 0, 0)`の`cells`は`Array[Vector2i]`、最初の0が地形セット、次の0が地形です。',
    'ピクセルアートなら、レイヤーのTexture › FilterをNearestに（またはプロジェクト既定のキャンバステクスチャフィルターを）設定します。[[game/godot-pixel-art-blurry|Godotでピクセルアートがぼやけるとき]]も参照。']},
   verify:{steps:[
    '出力行のタイル数とビット数を確認します。ブロブセットはタイル47・ビット188、辺16や角16のセットはタイル16・ビット32です。',
    'TileSetエディター › Selectモードでタイルをクリックすると、TerrainsセクションにTerrain Set 0とTerrain 0が表示され、タイル上にピアリングビットが描かれます。',
    '3 × 3の四角と孤立した1セルを塗ります。四角には異なるタイル9枚（角4・辺4・中央）、孤立セルには孤立タイルが置かれるはずです。',
    'Studioのテストマップで同じ形をGodotルールで塗ります。私たちの実行では、Godot 4.7.2は全セルに同じタイルを置きました。']},
   trouble:{rows:[
    ['スクリプトが`Cannot read res://nerulio-tileset.json`と出力する','ファイルがサブフォルダーにある、またはJSONの名前を変えた','出力パネルの最初の行','3つのファイルを`res://`に移すか、スクリプトの`JSON_PATH`と`OUTPUT_PATH`を直して再実行'],
    ['PNGがまだインポートされておらずピクセルを埋め込んだという警告','エディターが画像を取り込む前にスクリプトを実行した','`.tres`がPNGよりずっと大きい','ファイルシステムドックのインポート完了後に再実行し、TileSetがインポート済みPNGを参照するようにする'],
    ['`Tile (x, y) is outside the … atlas grid; skipped`','プロジェクトのPNGが書き出したものと違う、または書き出し前のグリッド（余白・間隔）が誤り','Studioのタイルセットパネルのグリッドと画像サイズを比べる','グリッドを直して書き出し直し、PNGとJSONを両方置き換える'],
    ['塗ると空のセルや違う角が出る','セットに必要な組み合わせがなく、Godotが近いタイルで代用するか空にする','Studioのチェックパネルの「ある組み合わせ／必要な組み合わせ」とゴーストタイル','足りないタイルを描くか[[game/tileset-generator|生成]]して書き出し直す'],
    ['Terrainsタブに塗れるものがない','レイヤーが別のTileSetを使っている、またはタイルにTerrain Setがない','`TileMapLayer`のTile Setプロパティ','そのレイヤーに`nerulio-tileset.tres`を設定'],
    ['拡大するとタイルがにじむ','レイヤーのテクスチャフィルターがLinear','2Dビューポートを拡大してピクセルの境目を見る','レイヤーかプロジェクト全体のTexture › FilterをNearestに']]},
   alternatives:{rows:[
    ['GodotのTileSetエディターで手作業でビットを設定（SelectモードのTerrainsセクション、または同じ値を多数のタイルに塗るタイルプロパティペイント）','タイルが数枚だけ、またはNerulioの知らない配置のとき。追加ファイルは不要ですが、ブロブセットなら47枚を1枚ずつ設定します。'],
    ['先に[[game/autotile-tester|オートタイルテスター]]や[[game/tileset-generator|タイルセットジェネレーター]]でセットを確認・補完','シートが不完全、または小さな元ブロックしかないとき。'],
    ['Tiledで[[game/tiled-wang-set|Wangセット]]を使ってマップを描き、TiledのGodot 4エクスポーター（Tiled 1.10以降）で書き出す','レベルをTiledで設計し、Godotには完成したマップだけが必要なとき。']]},
   limits:['1回の書き出しにつき地形セット1つ（中に地形は最大16）。アイソメトリック・六角形タイル、アニメーションタイル、代替タイルは書き出しません。','Godotエディターの地形ブラシそのものはテストで操作しておらず、ブラシが使う`set_cells_terrain_connect`を検証しました。','角（デュアルグリッド）セットは、Godotでは半タイルずれずにセルの上に描かれます。[[game/dual-grid-tileset|デュアルグリッドのタイルセット]]を参照。'],
   versions:{body:['Godot 4.7.2で検証：同梱のインポートスクリプトがヘッドレスでTileSetを作り、リソースを読み直して`set_cells_terrain_connect`で塗り、全セルをStudioの予測と比較しました。コーパスの各ブロブセットで485/485セル、4地形のデュアルグリッドパックで251/251セルが一致しました。上のエディターのメニューとノード名はGodot 4.7の公式ドキュメントに基づきます。'],sources:[GODOT_TILESETS,GODOT_TILEMAPS,GODOT_LAYER,GODOT_EDITORSCRIPT]}
  }
 },
 'game/rpg-maker-autotile-to-godot':{
  type:'conversion',
  intent:{primary:'turn an RPG Maker MV/MZ A2 autotile into a 47-tile set that Godot (or Tiled, Unity, LDtk) can autotile',secondary:['how A2 mini-tiles (quarters) make the tiles','RPG Maker autotile to Godot 4 terrain','A4 wall autotiles'],
   goal:'a complete 47-tile sheet assembled pixel for pixel from the A2 block, with engine terrain rules that paint like RPG Maker\'s map editor',input:'RPG Maker MV/MZ A2 sheet (768 × 576 at 48 px) or one 2 × 3 autotile block; A4 wall block',output:'generated 47-tile (or dual-grid 16) PNG + Godot / Tiled / Unity / LDtk files',target:'Godot 4 (verified 4.7.2); Tiled 1.12.2, Unity 6000.5 + Tilemap Extras 8.0.3, LDtk 1.5.3 (partly verified)',support:'partial',
   evidence:['src/game/tiles/generator.js (A2 quarter map, assembleSource, assembleDual)','src/game/tiles/identify.js (A2 size hints 768×576 / 512×384)','docs/STUDIO-TILE.md (coolschool A2 and A4: generated 47, Godot 485/485, Tiled/LDtk/Unity PASS; Blobsmith comparison 47/47)'],
   external:['RPG Maker MZ Help: Asset Standards (48 px tiles, A2 768×576, 6-tile autotile pattern)','RPG Maker blog: 24×24 mini-tiles, preview tile unused','Godot 4.7 docs: terrain sets']},
  en:{
   answer:'An RPG Maker MV/MZ A2 autotile is not 47 tiles: it is a 2 × 3 block of 48 px tiles that the map editor cuts into 24 × 24 mini-tiles and reassembles for every cell. Other engines need the finished tiles. Nerulio performs that assembly once, copying the mini-tiles byte for byte into all 47 blob tiles (or a 16-tile dual grid), and exports them with Godot 4 peering bits, a Tiled Wang set, Unity Rule Tiles or LDtk rules. A1 animated water, A3 buildings and the database flags are not converted.',
   concept:{title:'How an A2 autotile is built from mini-tiles',body:[
    'RPG Maker MZ\'s Asset Standards give 48 × 48 px tiles and a 768 × 576 px A2 (Ground) sheet, and describe each autotile as a 6-tile pattern: a representative tile shown in the palette, a tile with boundaries at each corner, and a group of tiles with one centre and one tile in each of the 8 directions. The official RPG Maker blog adds the key idea: the top-left tile is only a palette preview, and the editor thinks in 24 × 24 mini-tiles, each of which always lands in the same corner of the finished tile.',
    'A quarter of a finished tile depends on just three neighbours — the top-left quarter on north, west and north-west. That leaves five states per quarter: outer corner (both sides open), top or bottom rim, side rim, inner corner (both sides connected, diagonal open) and full. Four quarters × five states = 20 mini-tiles are enough for all 47 combinations.',
    'Nerulio takes the inner-corner quarters from the block\'s top-right tile and the outer corners, rims and centre from the 2 × 2 box below it, exactly one mini-tile per quarter and state, and writes the terrain pattern of every assembled tile at the same time, so the bits cannot disagree with the art. A 2 × 2 A4 wall block only has sides and gives the 16 side-only tiles.'],
    terms:[['Mini-tile (quarter)','A 24 × 24 px quarter of a 48 px tile; RPG Maker and Nerulio build every tile from four of them.'],['A2 block','One ground autotile: 2 × 3 tiles = 96 × 144 px at 48 px.'],['Isolated tile','The tile for a cell with no same-terrain neighbour: four outer-corner mini-tiles.'],['Blob 47','The 47 distinct tiles a corners-and-sides terrain needs against empty.']]},
   example:{title:'Example: one 48 px A2 autotile, quarter by quarter',lines:[
    'A2 sheet   768 × 576 px ÷ 48 = 16 × 12 tiles = 8 × 4 autotile blocks of 2 × 3 tiles',
    'one block  96 × 144 px = 4 × 6 mini-tiles of 24 × 24 px',
    '  mini-columns 0–1, rows 0–1   palette preview (not used)',
    '  mini-columns 2–3, rows 0–1   the four inner corners',
    '  mini-columns 0–3, rows 2–5   box: outer corners, rims, centre',
    'quarter states  outer corner, top/bottom rim, side rim, inner corner, full = 5',
    '4 quarters × 5 states = 20 mini-tiles  →  47 tiles × 4 = 188 quarter copies',
    'isolated tile = the 4 outer corners of the box; full tile = 4 mini-tiles from its centre'],
    after:'Every generated tile is a copy of these mini-tiles, so an edit to one mini-tile in the linked source editor updates every tile that uses it, and the Studio says how many that is.'},
   mapping:{head:['In RPG Maker','In Nerulio','In the engine'],rows:[
    ['2 × 3 autotile block (A2 ground, 48 px)','Source block, found by the sheet size 768 × 576 (or 512 × 384 at 32 px) or as a lone 2 × 3 block','Not used directly: the engine gets finished tiles'],
    ['24 × 24 mini-tiles at fixed corners','20 quarter states copied into 47 tiles (or 16 dual-grid tiles)','One PNG sheet in a published 47 order'],
    ['The editor\'s automatic neighbour choice','A terrain pattern per tile (8 neighbours)','Godot peering bits, Tiled Wang IDs, Unity rules, LDtk 3 × 3 rules'],
    ['Palette preview tile (top-left)','Ignored','—'],
    ['A4 wall block (2 × 2)','16 side-only tiles','Godot Match Sides, Tiled edge set'],
    ['Two ground autotiles side by side','Optional A-over-B transition: open sides become terrain B, plus B\'s full tile','A two-terrain set with transitions'],
    ['A1 animated autotiles, A3 buildings','Not supported','—'],
    ['Passage, bush, counter and other database settings','Not read (they are not in the PNG)','Set collision and data in the engine']]},
   outputs:{lead:'The generated sheet becomes a new image in the project, linked to its A2 source; the export ZIP then holds one folder per engine (names shown for an image called cave.png):',rows:[
    ['cave.png','The generated 47-tile (or 16-tile dual-grid) sheet, pixel copies of the A2 mini-tiles.'],
    ['godot/nerulio-tileset.json + nerulio_tileset_import.gd','The script builds a Godot 4 TileSet with one terrain in Match Corners and Sides and all 188 peering bits.'],
    ['tiled/cave.tsx + sample.tmx','A mixed Wang set and a small sample map.'],
    ['unity/nerulio-ruletile.json + Editor/NerulioRuleTileImporter.cs','One RuleTile with 47 rules (blob sets only).'],
    ['ldtk/cave.ldtk','An IntGrid layer with 47 auto-layer rules and a sample level (partly verified).']]},
   target:{title:'From the generated set to a painted Godot map',steps:[
    'Export (Ctrl+E) with Godot 4 ticked and copy the PNG, `nerulio-tileset.json` and `nerulio_tileset_import.gd` from the `godot` folder into the project root (or edit `JSON_PATH` / `OUTPUT_PATH` in the script).',
    'After the FileSystem dock has imported the PNG, open the script and run File › Run; the Output panel should report 47 tiles and 188 peering bits.',
    'Load `nerulio-tileset.tres` into a `TileMapLayer`\'s Tile Set property. The cell size is taken from the tiles, 48 × 48 px for MV/MZ art.',
    'Paint with the Terrains tab in Connect mode: cells join their neighbours the way RPG Maker\'s editor joins an autotile, including inner corners and single-cell islands.',
    'RPG Maker passability does not travel with the image: add a physics layer yourself, or trace one per tile in Nerulio — see [[game/godot-tileset-collision|Godot tileset collision]].']},
   verify:{steps:[
    'In the Studio, the generated set\'s Check panel reports every combination present, and says the art check does not apply because every pixel is copied from the source.',
    'In Godot, paint a single cell (the isolated tile, four outer corners), a 3 × 3 patch (9 different tiles) and an L shape (an inner corner). They should look like the same shapes drawn in RPG Maker.',
    'Zoom in on any tile: each quarter is identical to a mini-tile of the A2 block, with no blurred or resampled pixels.']},
   trouble:{rows:[
    ['No "RPG Maker A2" suggestion appears','The sheet is not 768 × 576 (or 512 × 384) at 16 tiles across, or the grid is not 48 px','Image size and the grid chosen in the Tileset panel','Set the 48 px grid, or cut one 96 × 144 block and import it alone'],
    ['Corners look inside out (inner corners where outer corners belong)','The block puts the inner corners top-left (a Blobsmith base), or the wrong block was selected','Which top tile of the block shows the four inner corners','Choose the Blobsmith source kind, or select the block\'s top-left tile again'],
    ['Generation refuses the tile size','Quarters need an even width and height','The grid\'s tile size (47 px is a typical mistyped value)','Fix the grid to the real even size, e.g. 48 px'],
    ['Grass and dirt meet with a hard edge in Godot','Each generated block is one terrain against empty','The set has one terrain in the Tileset panel','Generate A-over-B: pick terrain B\'s full tile as the transition background'],
    ['Water does not animate','A1 animated autotiles are not supported','—','Keep animation in the engine (Godot: animated tiles in the TileSet editor), outside this tool'],
    ['The player walks through walls','RPG Maker passability lives in the database, not in the PNG','TileSet editor: no physics layer','Trace collision polygons, or add a physics layer in Godot']]},
   alternatives:{rows:[
    ['Cut the A2 block into 24 × 24 pieces and assemble the 47 tiles by hand in an image editor','You want to redraw some tiles anyway; expect 188 quarter placements and to set the engine bits yourself afterwards.'],
    ['Blobsmith (web)','You only need the 47-tile sheet image; in our test on 2026-09-23 its free tier exported the sheet but not Godot or Tiled terrain files.'],
    ['Assemble quarters at runtime in your own engine code','You need RPG Maker\'s exact behaviour including A1 animation, and you are writing the tile renderer yourself.']]},
   limits:['A1 animated autotiles and A3 building autotiles are not assembled.','Database settings (passage, bush, counter, terrain tags) are not in the image and are not converted.','Unity gets blob and side sets only; a dual-grid set generated from the same block is exported to Godot, Tiled and LDtk.'],
   versions:{body:['On the corpus, a real RPG Maker A2 sheet whose pixels gave no layout signal was recognised by its size, assembled into 47 tiles and painted by Godot 4.7.2 exactly as predicted (485/485 cells); its Tiled, LDtk and Unity exports passed the same checks, and so did an A4 ceiling block. Compared with Blobsmith on the same block, 47 of 47 tiles were byte-identical. The RPG Maker facts above come from the MZ Asset Standards and the official RPG Maker blog; RPG Maker itself was not run.'],sources:[RM_STANDARDS,RM_BLOG,GODOT_TILESETS]}
  },
  ko:{
   answer:'RPG 만들기 MV/MZ의 A2 오토타일은 47개의 타일이 아닙니다. 48px 타일 2 × 3 블록을 맵 편집기가 24 × 24 조각으로 나눠 칸마다 다시 조립하는 구조입니다. 다른 엔진에는 완성된 타일이 필요합니다. Nerulio는 이 조립을 한 번 해서 조각을 바이트 그대로 복사해 블롭 47타일(또는 16타일 듀얼 그리드)을 만들고, Godot 4 피어링 비트·Tiled Wang 세트·Unity Rule Tile·LDtk 규칙과 함께 내보냅니다. A1 움직이는 물, A3 건물, 데이터베이스 설정은 변환하지 않습니다.',
   concept:{title:'A2 오토타일이 조각으로 만들어지는 방식',body:[
    'RPG 만들기 MZ의 소재 규격(Asset Standards)은 타일을 48 × 48px, A2(지면) 시트를 768 × 576px로 정하고, 오토타일 하나를 타일 6개 패턴으로 설명합니다. 팔레트에 보이는 대표 타일, 네 모서리에 경계가 있는 타일, 가운데 하나와 8방향 타일로 이뤄진 묶음입니다. 공식 RPG 만들기 블로그는 핵심을 덧붙입니다. 왼쪽 위 타일은 팔레트 미리보기일 뿐이고, 편집기는 24 × 24 조각 단위로 생각하며 각 조각은 완성 타일의 항상 같은 모서리에 들어갑니다.',
    '완성 타일의 4분의 1은 이웃 세 칸에만 좌우됩니다. 왼쪽 위 조각이라면 북·서·북서입니다. 그래서 조각마다 상태가 다섯 가지뿐입니다. 바깥 모서리(양쪽이 열림), 위아래 테두리, 옆 테두리, 안쪽 모서리(양쪽은 이어지고 대각선만 열림), 가득 참입니다. 4분면 × 5상태 = 조각 20개면 47가지 조합을 모두 만들 수 있습니다.',
    'Nerulio는 안쪽 모서리 조각을 블록의 오른쪽 위 타일에서, 바깥 모서리·테두리·가운데를 그 아래 2 × 2 상자에서 가져옵니다. 분면과 상태마다 정확히 한 조각을 쓰고, 조립하는 순간 각 타일의 지형 패턴도 함께 기록하므로 비트가 그림과 어긋날 수 없습니다. 2 × 2 A4 벽 블록은 변 정보만 있어 변 전용 16타일이 됩니다.'],
    terms:[['조각(4분면)','48px 타일의 24 × 24px 4분의 1. RPG 만들기와 Nerulio 모두 타일을 조각 4개로 만듭니다.'],['A2 블록','지면 오토타일 하나. 타일 2 × 3개 = 48px 기준 96 × 144px.'],['고립 타일','같은 지형 이웃이 하나도 없는 칸의 타일. 바깥 모서리 조각 4개로 이뤄집니다.'],['블롭 47','모서리+변 지형이 빈칸을 상대로 필요로 하는 서로 다른 타일 47개.']]},
   example:{title:'예시: 48px A2 오토타일 하나를 조각별로',lines:[
    'A2 시트   768 × 576px ÷ 48 = 16 × 12타일 = 2 × 3타일 오토타일 블록 8 × 4개',
    '블록 하나  96 × 144px = 24 × 24px 조각 4 × 6개',
    '  조각 열 0–1, 행 0–1   팔레트 미리보기(사용 안 함)',
    '  조각 열 2–3, 행 0–1   안쪽 모서리 네 개',
    '  조각 열 0–3, 행 2–5   상자: 바깥 모서리, 테두리, 가운데',
    '조각 상태  바깥 모서리, 위아래 테두리, 옆 테두리, 안쪽 모서리, 가득 = 5',
    '4분면 × 5상태 = 조각 20개  →  47타일 × 4 = 조각 복사 188번',
    '고립 타일 = 상자의 바깥 모서리 4개, 가득 찬 타일 = 상자 가운데 조각 4개'],
    after:'생성된 타일은 모두 이 조각의 복사본이므로, 연결된 원본 편집기에서 조각 하나를 고치면 그 조각을 쓰는 타일이 전부 바뀌고 Studio가 몇 개인지 알려 줍니다.'},
   mapping:{head:['RPG 만들기','Nerulio','엔진'],rows:[
    ['2 × 3 오토타일 블록(A2 지면, 48px)','원본 블록. 시트 크기 768 × 576(32px면 512 × 384)이나 단독 2 × 3 블록으로 알아봄','직접 쓰지 않음. 엔진에는 완성 타일이 들어감'],
    ['정해진 모서리에 들어가는 24 × 24 조각','조각 상태 20개를 47타일(또는 듀얼 그리드 16타일)에 복사','공개된 47 순서의 PNG 시트 한 장'],
    ['편집기의 자동 이웃 선택','타일마다 지형 패턴(이웃 8칸)','Godot 피어링 비트, Tiled Wang ID, Unity 규칙, LDtk 3 × 3 규칙'],
    ['팔레트 미리보기 타일(왼쪽 위)','무시','—'],
    ['A4 벽 블록(2 × 2)','변 전용 16타일','Godot Match Sides, Tiled 변 세트'],
    ['나란히 놓인 지면 오토타일 두 개','선택: A 위 B 전환(열린 변을 지형 B로, B의 가득 찬 타일 추가)','전환이 있는 지형 2개짜리 세트'],
    ['A1 애니메이션 오토타일, A3 건물','지원 안 함','—'],
    ['통행, 수풀, 카운터 등 데이터베이스 설정','읽지 않음(PNG에 없음)','엔진에서 충돌과 데이터를 설정']]},
   outputs:{lead:'생성된 시트는 A2 원본과 연결된 새 이미지로 프로젝트에 들어가고, 내보내기 ZIP에는 엔진별 폴더가 생깁니다(이미지 이름이 cave.png일 때의 예).',rows:[
    ['cave.png','생성된 47타일(또는 16타일 듀얼 그리드) 시트. A2 조각을 픽셀 그대로 복사한 것.'],
    ['godot/nerulio-tileset.json + nerulio_tileset_import.gd','스크립트가 Match Corners and Sides 지형 하나와 피어링 비트 188개를 가진 Godot 4 TileSet을 만듭니다.'],
    ['tiled/cave.tsx + sample.tmx','혼합(mixed) Wang 세트와 작은 샘플 맵.'],
    ['unity/nerulio-ruletile.json + Editor/NerulioRuleTileImporter.cs','규칙 47개짜리 RuleTile 하나(블롭 세트만).'],
    ['ldtk/cave.ldtk','자동 레이어 규칙 47개가 있는 IntGrid 레이어와 샘플 레벨(일부 검증).']]},
   target:{title:'생성한 세트로 Godot 맵 칠하기',steps:[
    'Godot 4를 체크하고 내보낸(Ctrl+E) 뒤, `godot` 폴더의 PNG, `nerulio-tileset.json`, `nerulio_tileset_import.gd`를 프로젝트 루트에 복사합니다(또는 스크립트의 `JSON_PATH`·`OUTPUT_PATH` 수정).',
    '파일시스템 독이 PNG를 가져온 뒤 스크립트를 열어 File › Run으로 실행합니다. 출력 패널에 타일 47개, 피어링 비트 188개가 나와야 합니다.',
    '`TileMapLayer`의 Tile Set 속성에 `nerulio-tileset.tres`를 넣습니다. 칸 크기는 타일에서 가져오며 MV/MZ 그림이면 48 × 48px입니다.',
    'Terrains 탭의 Connect 모드로 칠합니다. 안쪽 모서리와 외딴 한 칸까지, RPG 만들기 편집기가 오토타일을 잇는 것처럼 이웃과 이어집니다.',
    'RPG 만들기의 통행 설정은 이미지에 없습니다. 물리 레이어를 직접 추가하거나 Nerulio에서 타일마다 충돌을 따세요. [[game/godot-tileset-collision|Godot 타일셋 충돌]] 참고.']},
   verify:{steps:[
    'Studio에서 생성된 세트의 점검 패널이 모든 조합이 있다고 보고하고, 모든 픽셀이 원본 복사이므로 그림 점검은 해당 없다고 알려 줍니다.',
    'Godot에서 외딴 한 칸(고립 타일, 바깥 모서리 4개), 3 × 3 영역(서로 다른 타일 9개), ㄱ자 모양(안쪽 모서리)을 칠해 봅니다. RPG 만들기에서 같은 모양을 그렸을 때와 같아야 합니다.',
    '아무 타일이나 확대해 봅니다. 4분면 하나하나가 A2 블록의 조각과 똑같고, 흐려지거나 다시 샘플링된 픽셀이 없어야 합니다.']},
   trouble:{rows:[
    ['"RPG 만들기 A2" 제안이 나오지 않음','시트가 가로 16타일의 768 × 576(또는 512 × 384)이 아니거나 격자가 48px이 아님','이미지 크기와 타일셋 패널에서 고른 격자','48px 격자를 지정하거나, 96 × 144 블록 하나만 잘라서 가져오기'],
    ['모서리가 뒤집혀 보임(바깥 모서리 자리에 안쪽 모서리)','안쪽 모서리가 왼쪽 위에 있는 블록(Blobsmith 기본형)이거나 다른 블록을 고름','블록 위쪽 타일 중 어느 쪽에 안쪽 모서리 네 개가 있는지','원본 종류를 Blobsmith로 바꾸거나 블록의 왼쪽 위 타일을 다시 선택'],
    ['생성이 타일 크기를 거부함','조각으로 나누려면 가로세로가 짝수여야 함','격자의 타일 크기(47px로 잘못 입력하는 경우가 많음)','격자를 실제 짝수 크기(예: 48px)로 수정'],
    ['Godot에서 풀과 흙이 딱 끊겨 만남','생성한 블록 하나는 빈칸을 상대로 한 지형 하나','타일셋 패널의 지형 수가 하나','A 위 B 생성: 전환 배경으로 지형 B의 가득 찬 타일을 선택'],
    ['물이 움직이지 않음','A1 애니메이션 오토타일은 지원하지 않음','—','애니메이션은 엔진에서 처리(Godot TileSet 편집기의 애니메이션 타일). 이 도구 밖의 작업'],
    ['캐릭터가 벽을 통과함','RPG 만들기의 통행 설정은 PNG가 아니라 데이터베이스에 있음','TileSet 편집기에 물리 레이어가 없음','충돌 폴리곤을 따거나 Godot에서 물리 레이어 추가']]},
   alternatives:{rows:[
    ['A2 블록을 24 × 24로 잘라 이미지 편집기에서 47타일을 손으로 조립','어차피 일부 타일을 다시 그릴 때. 조각 배치 188번과 엔진 비트 설정을 직접 해야 합니다.'],
    ['Blobsmith(웹)','47타일 시트 이미지만 필요할 때. 2026-09-23 저희 테스트에서 무료 버전은 시트만 내보냈고 Godot·Tiled 지형 파일은 주지 않았습니다.'],
    ['직접 만든 엔진 코드에서 실행 중에 조각을 조립','A1 애니메이션까지 RPG 만들기와 똑같이 동작해야 하고 타일 렌더러를 직접 짤 때.']]},
   limits:['A1 애니메이션 오토타일과 A3 건물 오토타일은 조립하지 않습니다.','데이터베이스 설정(통행, 수풀, 카운터, 지형 태그)은 이미지에 없어 변환되지 않습니다.','Unity에는 블롭·변 세트만 갑니다. 같은 블록으로 만든 듀얼 그리드 세트는 Godot·Tiled·LDtk로 내보냅니다.'],
   versions:{body:['코퍼스에서 픽셀로는 배치 신호가 없던 실제 RPG 만들기 A2 시트를 크기로 알아보고 47타일로 조립했으며, Godot 4.7.2가 예측과 똑같이 칠했습니다(485/485칸). Tiled·LDtk·Unity 내보내기도 같은 점검을 통과했고 A4 천장 블록도 마찬가지였습니다. 같은 블록을 Blobsmith와 비교하면 47타일 중 47개가 바이트 단위로 같았습니다. 위의 RPG 만들기 관련 내용은 MZ 소재 규격과 공식 블로그를 따르며, RPG 만들기 자체는 실행하지 않았습니다.'],sources:[RM_STANDARDS,RM_BLOG,GODOT_TILESETS]}
  },
  ja:{
   answer:'RPGツクールMV/MZのA2オートタイルは47枚のタイルではありません。48pxタイルの2 × 3ブロックを、マップエディターが24 × 24のミニタイルに分けてセルごとに組み直す仕組みです。他のエンジンには完成したタイルが必要です。Nerulioはこの組み立てを一度だけ行い、ミニタイルをバイト単位でそのままコピーしてブロブ47タイル（または16タイルのデュアルグリッド）を作り、Godot 4のピアリングビット、TiledのWangセット、UnityのRule Tile、LDtkのルールと一緒に書き出します。A1の動く水、A3の建物、データベースの設定は変換しません。',
   concept:{title:'A2オートタイルがミニタイルから組み立てられる仕組み',body:[
    'RPGツクールMZの素材規格（Asset Standards）は、タイルを48 × 48px、A2（地面）シートを768 × 576pxとし、オートタイル1つを6タイルのパターンとして説明しています。パレットに表示される代表タイル、四隅に境界のあるタイル、中央1つと8方向のタイルからなるまとまりです。公式ブログが要点を補っています。左上のタイルはパレット用の見本にすぎず、エディターは24 × 24のミニタイル単位で考え、各ミニタイルは完成タイルの常に同じ隅に入ります。',
    '完成タイルの4分の1は、隣の3セルだけで決まります。左上の4分の1なら北・西・北西です。そのため4分の1ごとの状態は5つだけです。外角（両側が開いている）、上下の縁、横の縁、内角（両側はつながり斜めだけ開いている）、全面です。4象限 × 5状態 = ミニタイル20枚で、47通りの組み合わせをすべて作れます。',
    'Nerulioは内角のミニタイルをブロック右上のタイルから、外角・縁・中央をその下の2 × 2のボックスから取ります。象限と状態ごとにちょうど1枚を使い、組み立てと同時に各タイルの地形パターンも記録するので、ビットが絵と食い違うことはありません。2 × 2のA4壁ブロックは辺の情報しかないため、辺だけの16タイルになります。'],
    terms:[['ミニタイル（4分の1）','48pxタイルの24 × 24pxの4分の1。RPGツクールもNerulioも、タイルを4枚のミニタイルで作ります。'],['A2ブロック','地面のオートタイル1つ。2 × 3タイル＝48pxで96 × 144px。'],['孤立タイル','同じ地形の隣が1つもないセルのタイル。外角のミニタイル4枚でできています。'],['ブロブ47','角＋辺の地形が空に対して必要とする、異なる47枚のタイル。']]},
   example:{title:'例：48pxのA2オートタイル1つをミニタイルごとに',lines:[
    'A2シート   768 × 576px ÷ 48 = 16 × 12タイル = 2 × 3タイルのオートタイルブロック8 × 4個',
    'ブロック1つ 96 × 144px = 24 × 24pxのミニタイル4 × 6枚',
    '  ミニ列0–1、行0–1   パレットの見本（使わない）',
    '  ミニ列2–3、行0–1   4つの内角',
    '  ミニ列0–3、行2–5   ボックス：外角、縁、中央',
    '4分の1の状態  外角、上下の縁、横の縁、内角、全面 = 5',
    '4象限 × 5状態 = ミニタイル20枚  →  47タイル × 4 = 188回のコピー',
    '孤立タイル = ボックスの外角4枚、全面タイル = ボックス中央のミニタイル4枚'],
    after:'生成したタイルはすべてこれらのミニタイルのコピーなので、リンクした元エディターでミニタイルを1枚直すと、それを使うタイルがすべて更新され、Studioがその枚数を表示します。'},
   mapping:{head:['RPGツクール','Nerulio','エンジン'],rows:[
    ['2 × 3のオートタイルブロック（A2地面、48px）','元ブロック。シートサイズ768 × 576（32pxなら512 × 384）か、単独の2 × 3ブロックとして認識','直接は使わない。エンジンには完成タイルが入る'],
    ['決まった隅に入る24 × 24のミニタイル','20の状態を47タイル（またはデュアルグリッド16タイル）にコピー','公開された47の並びのPNGシート1枚'],
    ['エディターの自動的な隣接選択','タイルごとの地形パターン（隣8セル）','Godotのピアリングビット、TiledのWang ID、Unityのルール、LDtkの3 × 3ルール'],
    ['パレット見本タイル（左上）','無視','—'],
    ['A4壁ブロック（2 × 2）','辺だけの16タイル','GodotのMatch Sides、Tiledの辺セット'],
    ['隣り合う2つの地面オートタイル','任意：AからBへの遷移（開いた辺を地形Bに、Bの全面タイルを追加）','遷移つきの2地形セット'],
    ['A1アニメーションオートタイル、A3建物','非対応','—'],
    ['通行・茂み・カウンターなどのデータベース設定','読まない（PNGにない）','エンジン側で衝突やデータを設定']]},
   outputs:{lead:'生成したシートはA2の元とリンクした新しい画像としてプロジェクトに入り、書き出しZIPにはエンジンごとのフォルダーができます（画像名がcave.pngの場合の例）。',rows:[
    ['cave.png','生成した47タイル（または16タイルのデュアルグリッド）シート。A2のミニタイルをピクセルそのままコピーしたもの。'],
    ['godot/nerulio-tileset.json + nerulio_tileset_import.gd','スクリプトが、Match Corners and Sidesの地形1つとピアリングビット188個を持つGodot 4のTileSetを作ります。'],
    ['tiled/cave.tsx + sample.tmx','混合（mixed）Wangセットと小さなサンプルマップ。'],
    ['unity/nerulio-ruletile.json + Editor/NerulioRuleTileImporter.cs','ルール47個のRuleTile 1つ（ブロブセットのみ）。'],
    ['ldtk/cave.ldtk','オートレイヤールール47個のIntGridレイヤーとサンプルレベル（一部検証）。']]},
   target:{title:'生成したセットでGodotのマップを塗る',steps:[
    'Godot 4にチェックして書き出し（Ctrl+E）、`godot`フォルダーのPNG、`nerulio-tileset.json`、`nerulio_tileset_import.gd`をプロジェクトのルートにコピーします（またはスクリプトの`JSON_PATH`・`OUTPUT_PATH`を修正）。',
    'ファイルシステムドックがPNGを取り込んだら、スクリプトを開いてFile › Runで実行します。出力パネルにタイル47、ピアリングビット188と出るはずです。',
    '`TileMapLayer`のTile Setプロパティに`nerulio-tileset.tres`を設定します。セルサイズはタイルから取られ、MV/MZの絵なら48 × 48pxです。',
    'TerrainsタブのConnectモードで塗ります。内角や孤立した1セルも含め、RPGツクールのエディターがオートタイルをつなぐのと同じように隣とつながります。',
    'RPGツクールの通行設定は画像には含まれません。物理レイヤーを自分で追加するか、Nerulioでタイルごとに衝突形状を取ってください。[[game/godot-tileset-collision|Godotタイルセットの衝突]]を参照。']},
   verify:{steps:[
    'Studioで、生成したセットのチェックパネルがすべての組み合わせがあると報告し、全ピクセルが元のコピーなので絵のチェックは対象外だと表示します。',
    'Godotで孤立した1セル（孤立タイル、外角4つ）、3 × 3の範囲（異なるタイル9枚）、L字（内角）を塗ります。RPGツクールで同じ形を描いたときと同じ見た目になるはずです。',
    '任意のタイルを拡大します。4分の1ずつがA2ブロックのミニタイルと同一で、ぼやけたり再サンプリングされたピクセルがないはずです。']},
   trouble:{rows:[
    ['「RPGツクールA2」の候補が出ない','シートが横16タイルの768 × 576（または512 × 384）でない、またはグリッドが48pxでない','画像サイズとタイルセットパネルで選んだグリッド','48pxのグリッドを指定するか、96 × 144のブロック1つだけを切り出して読み込む'],
    ['角が裏返って見える（外角の位置に内角）','内角が左上にあるブロック（Blobsmithの基本形）か、別のブロックを選んだ','ブロック上段のどちらのタイルに4つの内角があるか','元の種類をBlobsmithに変えるか、ブロックの左上タイルを選び直す'],
    ['生成がタイルサイズを受け付けない','4分割するには幅と高さが偶数である必要がある','グリッドのタイルサイズ（47pxと打ち間違えることが多い）','グリッドを実際の偶数サイズ（例：48px）に直す'],
    ['Godotで草と土がくっきり途切れる','生成したブロック1つは、空に対する地形1つ','タイルセットパネルの地形が1つ','AからBの生成：遷移の背景に地形Bの全面タイルを選ぶ'],
    ['水が動かない','A1のアニメーションオートタイルは非対応','—','アニメーションはエンジン側で扱う（GodotのTileSetエディターのアニメーションタイル）。このツールの範囲外'],
    ['キャラクターが壁をすり抜ける','RPGツクールの通行設定はPNGではなくデータベースにある','TileSetエディターに物理レイヤーがない','衝突ポリゴンを取るか、Godotで物理レイヤーを追加']]},
   alternatives:{rows:[
    ['A2ブロックを24 × 24に切り、画像エディターで47タイルを手で組み立てる','どのみち一部のタイルを描き直すとき。188回のミニタイル配置と、エンジン側のビット設定を自分で行うことになります。'],
    ['Blobsmith（Web）','47タイルのシート画像だけが必要なとき。2026-09-23の私たちのテストでは、無料版はシートを書き出しましたが、GodotやTiledの地形ファイルは出しませんでした。'],
    ['自作エンジンのコードで実行時にミニタイルを組み立てる','A1のアニメーションまでRPGツクールと同じ動作が必要で、タイル描画を自分で書くとき。']]},
   limits:['A1のアニメーションオートタイルとA3の建物オートタイルは組み立てません。','データベースの設定（通行、茂み、カウンター、地形タグ）は画像になく、変換されません。','Unityへはブロブと辺のセットのみです。同じブロックから作ったデュアルグリッドのセットはGodot・Tiled・LDtkへ書き出します。'],
   versions:{body:['コーパスでは、ピクセルからは配置の手がかりがなかった実在のRPGツクールA2シートをサイズから認識し、47タイルに組み立て、Godot 4.7.2が予測どおりに塗りました（485/485セル）。Tiled・LDtk・Unityの書き出しも同じチェックに通り、A4の天井ブロックも同様でした。同じブロックをBlobsmithと比べると、47枚中47枚がバイト単位で一致しました。上のRPGツクールに関する記述はMZの素材規格と公式ブログに基づき、RPGツクール自体は実行していません。'],sources:[RM_STANDARDS,RM_BLOG,GODOT_TILESETS]}
  }
 },
 'game/tiled-wang-set':{
  type:'engine',
  intent:{primary:'set up a Tiled Wang set (terrain set) for an autotile sheet so the Terrain Brush works',secondary:['corner vs edge vs mixed Wang set','Wang ID order','47-tile blob in Tiled','why the isolated tile is missing'],
   goal:'a .tsx whose Wang set is filled in for every tile, so the Terrain Brush paints correct transitions',input:'autotile sheet PNG (blob-47, 16-side, 16-corner / dual grid, 3×3 box) or painted bits',output:'cave.tsx with a Wang set + sample.tmx + PNG + README.txt',target:'Tiled (verified 1.12.2 readers)',support:'full',
   evidence:['src/game/tiles/tiled.js (WANG_TYPE, wangId, tsx, resolveTiled, tmx)','docs/STUDIO-TILE.md (Tiled 1.12.2 --export-tileset/--export-map, tmxrasterizer; brush not driven)'],
   external:['Tiled docs: Using Terrains (corner/edge/mixed sets, marking tiles, Patterns view, Terrain Brush)','TMX format: wangset, wangcolor, wangtile wangid order','Editing Tile Layers: Terrain Brush shortcut T, Ctrl']},
  en:{
   answer:'A Wang set — shown as a Terrain Set in Tiled since 1.5 — labels each tile\'s corners and/or edges with terrain colours so the Terrain Brush can pick matching tiles. Pick the type from the art: Corner Set and Edge Set (16 tiles for two terrains each) or Mixed Set (up to 256; the 47-tile blob works as a reduced mixed set). Nerulio writes the .tsx with every tile\'s Wang ID filled in from the recognised layout, plus a sample .tmx; Tiled 1.12.2 read every ID back as written.',
   concept:{title:'Wang IDs, set types and the empty terrain',body:[
    'In the file, every marked tile has a Wang ID: eight colour indexes in the order top, top-right, right, bottom-right, bottom, bottom-left, left, top-left, where 0 means unset and 1 is the first colour (TMX format reference). A Corner Set only uses the four corner slots, an Edge Set the four sides, a Mixed Set all eight.',
    'The Terrain Brush looks at the colours around the spot you paint and chooses a tile whose Wang ID matches; it also changes neighbouring tiles so they connect. Tiled\'s manual shows that when two terrains have no direct transition it goes through a third one that has (dirt → sand → cobblestone), and its Patterns view darkens every combination that already has a tile.',
    'The manual also says you do not need an explicit terrain for "empty": transitions to nothing are simply left unmarked. For a one-colour blob set that means the isolated tile has the ID 0,0,0,0,0,0,0,0 — and Tiled drops an all-zero Wang tile when it loads the file, so the brush can never place it (a finding from our Tiled runs).'],
    terms:[['Wang set / Terrain Set','Tiled\'s set of terrain labels on a tileset; one tileset can hold several.'],['Wang colour','One terrain of the set (name, colour, optional icon tile, probability).'],['Wang ID','Eight colour indexes per tile, top first and clockwise; 0 = unset.'],['Corner / Edge / Mixed','Which slots a set uses: corners, sides, or both.']]},
   example:{title:'Example: the Wang IDs Nerulio writes',lines:[
    'order: top, top-right, right, bottom-right, bottom, bottom-left, left, top-left',
    'blob tile N NE E SE S (mask 31)    wangid="1,1,1,1,1,0,0,0"   mixed set',
    'side tile N + S (vertical strip)   wangid="1,0,0,0,1,0,0,0"   edge set',
    'corner tile NW + NE                wangid="0,1,0,0,0,0,0,1"   corner set',
    'isolated blob tile                 wangid="0,0,0,0,0,0,0,0"   not written',
    'wangtile entries  blob-47 → 46,  16-side → 15,  16-corner → 15',
    'tile id = row × columns + column   (cr31 8 × 6 sheet: mask 31 at row 1, column 4 → id 12)'],
    after:'The sample map is painted with the same exact-match rule. For a corner set its layer carries `offsetx`/`offsety` of minus half a tile, because corner colours belong to grid points.'},
   outputs:{lead:'The `tiled` folder of the export ZIP; files are named after your image (here cave.png):',rows:[
    ['cave.tsx','The tileset: image, tile size, margin, spacing and one Wang set (type corner, edge or mixed) with a colour per terrain and a `wangtile` per marked tile; tile probabilities when set.'],
    ['sample.tmx','A small map drawn with the set, so you see it work before painting.'],
    ['cave.png','The tileset image, referenced by a relative path.'],
    ['README.txt','Set type, colour count and the Wang ID order.']]},
   target:{title:'Use the Wang set in Tiled',steps:[
    'Unzip the `tiled` folder and keep the PNG next to the .tsx (the image is referenced by file name).',
    'Open `sample.tmx` in Tiled, or open the .tsx and use it from your own map.',
    'To inspect the labels, open the tileset and click the Terrain Sets button on the toolbar: each tile shows its coloured corners or edges, and the Patterns tab highlights combinations that have no tile yet.',
    'Leave the terrain mode, go back to the map, open the Terrain Sets window, select the set and a terrain, and paint with the Terrain Brush (T). Hold Ctrl to paint a whole tile instead of one corner or edge; hold Shift for lines.',
    'On an empty map start by filling an area first (the manual\'s advice), or hold Ctrl, so the brush has neighbours to connect to.',
    'For Godot, either export the map with Tiled\'s Godot 4 exporter or build terrains directly: [[game/godot-autotile|Godot 4 autotile]].']},
   verify:{steps:[
    'Terrain Sets mode: every tile of the sheet except the isolated one shows colours; for a 16-corner set the Patterns view should have all 15 non-empty patterns darkened.',
    'Paint a 3 × 3 block with Ctrl held: 9 different tiles with continuous edges.',
    '`sample.tmx` looks like the Studio\'s test map drawn with the Tiled rule; cells the rule marked as gaps stay empty in Tiled too.']},
   trouble:{rows:[
    ['The brush paints nothing at first','The map is empty and the set has no transition to nothing to build on','The manual describes this case for fresh maps','Fill an area first, or hold Ctrl to paint whole tiles'],
    ['Single-cell islands stay blank','The isolated tile has an all-zero Wang ID and is not part of the set','Terrain Sets mode: that tile shows no colour','Place it with the Stamp Brush where needed'],
    ['The sample map sits half a tile off other layers','Corner-set samples are drawn on grid points with a −½ tile layer offset','Layer Properties: Offset X / Y','Keep the offset for a dual-grid look, or remove it and paint your own layer'],
    ['Wrong tiles or seams everywhere','The set type does not match the art (a blob sheet as an edge set, for example)','The `type` attribute of the `wangset` in the .tsx','Apply the right layout in the Studio and export again'],
    ['Two terrains never blend','No tile is marked with both colours','Patterns view: no pattern mixes the two','Draw transition tiles, or generate A-over-B tiles in the [[game/tileset-generator|generator]]'],
    ['An old Tiled shows no terrain at all','Terrain data written for Tiled 1.5 and later cannot be read by older versions (manual warning)','Help › About Tiled','Update Tiled']]},
   alternatives:{rows:[
    ['Mark the tiles by hand in Tiled\'s Terrain Sets mode (select a terrain, click and drag over tile regions)','Small sets, unusual layouts, or several terrains per tile that no published layout describes.'],
    ['Use LDtk auto-layer rules instead: [[game/ldtk-autotile-rules|LDtk autotile rules]]','You prefer IntGrid painting and rules you can extend with modulo, random chance or flips.'],
    ['Build Godot terrains directly: [[game/godot-autotile|Godot 4 autotile]]','Godot is the only target and you want to paint inside Godot.']]},
   limits:['The Terrain Brush itself was not driven by our checks (Tiled scripting does not run headless on Windows); the file readers were.','Flip and rotation variants (Tile Transformations) are not written.','One Wang set per export.'],
   versions:{body:['Checked with Tiled 1.12.2\'s own command-line readers (`--export-tileset`, `--export-map`): every Wang ID came back as written and every sample map was a valid Wang tiling; `tmxrasterizer` rendered the samples pixel-exact against an independent render. Swapped Wang IDs, a changed gid or spacing +1 make those checks fail. Menu names above follow the Tiled documentation.'],sources:[TILED_TERRAIN,TILED_TMX,TILED_EDIT]}
  },
  ko:{
   answer:'Wang 세트는 Tiled 1.5부터 Terrain Set으로 표시되며, 타일의 모서리나 변(또는 둘 다)에 지형 색을 붙여 Terrain Brush가 맞는 타일을 고르게 합니다. 종류는 그림에 맞춰 고릅니다. Corner Set과 Edge Set(지형 둘이면 각각 16타일), Mixed Set(최대 256, 47타일 블롭은 줄인 혼합 세트로 쓰임)입니다. Nerulio는 인식한 배치에서 모든 타일의 Wang ID를 채운 .tsx와 샘플 .tmx를 씁니다. Tiled 1.12.2가 모든 ID를 쓴 그대로 다시 읽었습니다.',
   concept:{title:'Wang ID, 세트 종류, 빈 지형',body:[
    '파일 안에서 표시된 타일마다 Wang ID가 있습니다. 위, 오른쪽 위, 오른쪽, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽, 왼쪽 위 순서의 색 번호 여덟 개이며, 0은 지정 안 됨, 1은 첫 번째 색입니다(TMX 형식 문서). Corner Set은 모서리 네 자리만, Edge Set은 변 네 자리만, Mixed Set은 여덟 자리를 모두 씁니다.',
    'Terrain Brush는 칠하는 곳 주변의 색을 보고 Wang ID가 맞는 타일을 고르며, 이웃 타일도 이어지도록 바꿉니다. Tiled 매뉴얼에 따르면 두 지형 사이에 직접 전환이 없으면 전환이 있는 세 번째 지형을 거쳐 칠하고(흙 → 모래 → 자갈), Patterns 보기는 이미 타일이 있는 조합을 어둡게 표시합니다.',
    '매뉴얼은 "빈칸"을 위한 지형을 따로 만들 필요가 없고, 아무것도 없는 쪽으로의 전환은 표시하지 않으면 된다고 설명합니다. 색이 하나인 블롭 세트라면 고립 타일의 ID가 0,0,0,0,0,0,0,0이 되는데, Tiled는 파일을 읽을 때 모두 0인 Wang 타일을 버리므로 브러시가 그 타일을 놓을 수 없습니다(저희 Tiled 실행에서 확인한 사실).'],
    terms:[['Wang 세트 / Terrain Set','타일셋에 붙는 Tiled의 지형 표시 묶음. 타일셋 하나에 여러 개를 둘 수 있습니다.'],['Wang 색','세트 안의 지형 하나(이름, 색, 선택적 아이콘 타일, 확률).'],['Wang ID','타일마다 위에서 시작해 시계 방향으로 도는 색 번호 여덟 개. 0은 지정 안 됨.'],['Corner / Edge / Mixed','세트가 쓰는 자리: 모서리, 변, 또는 둘 다.']]},
   example:{title:'예시: Nerulio가 쓰는 Wang ID',lines:[
    '순서: 위, 오른쪽 위, 오른쪽, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽, 왼쪽 위',
    '블롭 타일 N NE E SE S(마스크 31)  wangid="1,1,1,1,1,0,0,0"   mixed 세트',
    '변 타일 N + S(세로 띠)            wangid="1,0,0,0,1,0,0,0"   edge 세트',
    '모서리 타일 NW + NE               wangid="0,1,0,0,0,0,0,1"   corner 세트',
    '고립 블롭 타일                    wangid="0,0,0,0,0,0,0,0"   기록 안 함',
    'wangtile 개수  블롭 47 → 46,  변 16 → 15,  모서리 16 → 15',
    '타일 id = 행 × 열 수 + 열   (cr31 8 × 6 시트: 마스크 31은 1행 4열 → id 12)'],
    after:'샘플 맵도 같은 정확 일치 규칙으로 칠합니다. 모서리 세트는 모서리 색이 격자점에 속하므로 레이어에 반 타일만큼 음수인 `offsetx`/`offsety`가 들어갑니다.'},
   outputs:{lead:'내보내기 ZIP의 `tiled` 폴더입니다. 파일 이름은 이미지 이름을 따릅니다(여기서는 cave.png).',rows:[
    ['cave.tsx','타일셋: 이미지, 타일 크기, 여백, 간격, 그리고 지형마다 색 하나와 표시된 타일마다 `wangtile`이 있는 Wang 세트 하나(corner·edge·mixed). 설정했다면 타일 확률도.'],
    ['sample.tmx','이 세트로 그린 작은 맵. 직접 칠하기 전에 동작을 확인할 수 있습니다.'],
    ['cave.png','타일셋 이미지. 상대 경로로 참조됩니다.'],
    ['README.txt','세트 종류, 색 개수, Wang ID 순서.']]},
   target:{title:'Tiled에서 Wang 세트 쓰기',steps:[
    '`tiled` 폴더의 압축을 풀고 PNG를 .tsx 옆에 둡니다(이미지를 파일 이름으로 참조합니다).',
    'Tiled에서 `sample.tmx`를 열거나, .tsx를 열어 내 맵에서 사용합니다.',
    '표시를 확인하려면 타일셋을 열고 도구 모음의 Terrain Sets 버튼을 누릅니다. 타일마다 색이 칠해진 모서리나 변이 보이고, Patterns 탭은 아직 타일이 없는 조합을 강조합니다.',
    '지형 모드를 끄고 맵으로 돌아가 Terrain Sets 창에서 세트와 지형을 고른 뒤 Terrain Brush(T)로 칠합니다. Ctrl을 누르면 모서리·변 하나가 아니라 타일 전체를, Shift를 누르면 직선을 칠합니다.',
    '빈 맵에서는 매뉴얼의 조언대로 먼저 영역을 채우거나 Ctrl을 눌러, 브러시가 이어 붙일 이웃을 만들어 줍니다.',
    'Godot로 가져가려면 Tiled의 Godot 4 내보내기로 맵을 보내거나, 지형을 직접 만드세요. [[game/godot-autotile|Godot 4 오토타일]] 참고.']},
   verify:{steps:[
    'Terrain Sets 모드에서 고립 타일을 뺀 모든 타일에 색이 보여야 합니다. 모서리 16 세트라면 Patterns 보기에서 빈 것을 뺀 15개 패턴이 모두 어둡게 표시됩니다.',
    'Ctrl을 누른 채 3 × 3 영역을 칠합니다. 가장자리가 이어진 서로 다른 타일 9개가 나와야 합니다.',
    '`sample.tmx`는 Studio 테스트 맵을 Tiled 규칙으로 그린 것과 같아 보입니다. 그 규칙이 빈칸으로 표시한 칸은 Tiled에서도 비어 있습니다.']},
   trouble:{rows:[
    ['처음에 브러시가 아무것도 칠하지 않음','맵이 비어 있고 세트에 빈칸으로의 전환이 없어 붙일 곳이 없음','매뉴얼이 새 맵의 이 경우를 설명함','먼저 영역을 채우거나 Ctrl을 눌러 타일 전체를 칠하기'],
    ['외딴 한 칸이 비어 있음','고립 타일의 Wang ID가 모두 0이라 세트에 들어가지 않음','Terrain Sets 모드에서 그 타일에 색이 없음','필요한 곳에 Stamp Brush로 직접 놓기'],
    ['샘플 맵이 다른 레이어와 반 칸 어긋남','모서리 세트 샘플은 −½타일 레이어 오프셋으로 격자점에 그려짐','레이어 속성의 Offset X / Y','듀얼 그리드처럼 보이려면 오프셋 유지, 아니면 지우고 내 레이어에 칠하기'],
    ['곳곳이 틀린 타일이거나 이음새가 보임','세트 종류가 그림과 맞지 않음(예: 블롭 시트를 edge 세트로)','.tsx의 `wangset` `type` 속성','Studio에서 맞는 배치를 적용해 다시 내보내기'],
    ['두 지형이 섞이지 않음','두 색이 함께 표시된 타일이 없음','Patterns 보기에 두 색이 섞인 패턴이 없음','전환 타일을 그리거나 [[game/tileset-generator|생성기]]에서 A 위 B 타일 생성'],
    ['예전 Tiled에서 지형이 전혀 안 보임','Tiled 1.5 이후 형식의 지형 정보는 이전 버전이 읽지 못함(매뉴얼 경고)','Help › About Tiled','Tiled 업데이트']]},
   alternatives:{rows:[
    ['Tiled의 Terrain Sets 모드에서 직접 표시(지형을 고르고 타일 영역 위로 클릭·드래그)','세트가 작거나 배치가 특이할 때, 또는 공개 배치로 설명되지 않는 여러 지형이 한 타일에 있을 때.'],
    ['LDtk 자동 레이어 규칙 사용: [[game/ldtk-autotile-rules|LDtk 오토타일 규칙]]','IntGrid로 칠하고 modulo·확률·뒤집기로 확장할 수 있는 규칙이 좋을 때.'],
    ['Godot 지형을 바로 만들기: [[game/godot-autotile|Godot 4 오토타일]]','대상이 Godot뿐이고 Godot 안에서 칠하고 싶을 때.']]},
   limits:['Terrain Brush 자체는 저희 점검에서 조작하지 않았습니다(Windows에서 Tiled 스크립트가 헤드리스로 돌지 않음). 파일 읽기는 검증했습니다.','뒤집기·회전 변형(Tile Transformations)은 쓰지 않습니다.','내보내기 하나에 Wang 세트 하나입니다.'],
   versions:{body:['Tiled 1.12.2 자체의 명령줄 읽기(`--export-tileset`, `--export-map`)로 확인했습니다. 모든 Wang ID가 쓴 그대로 돌아왔고 모든 샘플 맵이 올바른 Wang 타일링이었으며, `tmxrasterizer` 렌더가 독립 렌더와 픽셀 단위로 같았습니다. Wang ID를 바꾸거나 gid를 바꾸거나 간격을 1 늘리면 이 점검이 실패합니다. 위의 메뉴 이름은 Tiled 공식 문서를 따릅니다.'],sources:[TILED_TERRAIN,TILED_TMX,TILED_EDIT]}
  },
  ja:{
   answer:'Wangセットは、Tiled 1.5以降Terrain Setとして表示され、タイルの角や辺（または両方）に地形の色を付けて、Terrain Brushが合うタイルを選べるようにするものです。種類は絵に合わせて選びます。Corner SetとEdge Set（地形2つならそれぞれ16タイル）、Mixed Set（最大256、47タイルのブロブは縮小した混合セットとして使えます）。Nerulioは認識した配置から全タイルのWang IDを埋めた.tsxと、サンプルの.tmxを書き出します。Tiled 1.12.2で全IDが書いたとおりに読み戻されました。',
   concept:{title:'Wang ID、セットの種類、空の地形',body:[
    'ファイルの中では、印を付けたタイルごとにWang IDがあります。上、右上、右、右下、下、左下、左、左上の順に並ぶ8つの色番号で、0は未設定、1が最初の色です（TMX形式のリファレンス）。Corner Setは4つの角だけ、Edge Setは4辺だけ、Mixed Setは8つすべてを使います。',
    'Terrain Brushは塗る場所の周りの色を見てWang IDが合うタイルを選び、隣のタイルもつながるように変えます。Tiledのマニュアルによれば、2つの地形の間に直接の遷移がないときは遷移のある3つ目の地形を経由して塗り（土 → 砂 → 石畳）、Patternsビューはすでにタイルがある組み合わせを暗く表示します。',
    'マニュアルは、「空」のための地形を別に作る必要はなく、何もない側への遷移は印を付けなければよいと説明しています。1色のブロブセットでは孤立タイルのIDが0,0,0,0,0,0,0,0になりますが、Tiledは読み込み時にすべて0のWangタイルを捨てるため、ブラシはそのタイルを置けません（私たちのTiledでの実行で確認）。'],
    terms:[['Wangセット／Terrain Set','タイルセットに付くTiledの地形ラベルのまとまり。1つのタイルセットに複数持てます。'],['Wangカラー','セット内の地形1つ（名前、色、任意のアイコンタイル、確率）。'],['Wang ID','タイルごとに上から時計回りに並ぶ8つの色番号。0は未設定。'],['Corner / Edge / Mixed','セットが使う位置：角、辺、または両方。']]},
   example:{title:'例：Nerulioが書くWang ID',lines:[
    '順序：上、右上、右、右下、下、左下、左、左上',
    'ブロブタイル N NE E SE S（マスク31）  wangid="1,1,1,1,1,0,0,0"   mixedセット',
    '辺タイル N + S（縦の帯）              wangid="1,0,0,0,1,0,0,0"   edgeセット',
    '角タイル NW + NE                      wangid="0,1,0,0,0,0,0,1"   cornerセット',
    '孤立ブロブタイル                      wangid="0,0,0,0,0,0,0,0"   書かない',
    'wangtileの数  ブロブ47 → 46、辺16 → 15、角16 → 15',
    'タイルid = 行 × 列数 + 列   （cr31の8 × 6シート：マスク31は1行4列 → id 12）'],
    after:'サンプルマップも同じ完全一致のルールで塗ります。角セットは角の色が格子点に属するため、レイヤーに半タイル分マイナスの`offsetx`/`offsety`が入ります。'},
   outputs:{lead:'書き出しZIPの`tiled`フォルダーです。ファイル名は画像名に従います（ここではcave.png）。',rows:[
    ['cave.tsx','タイルセット：画像、タイルサイズ、余白、間隔、そして地形ごとの色と印付きタイルごとの`wangtile`を持つWangセット1つ（corner・edge・mixed）。設定した場合はタイルの確率も。'],
    ['sample.tmx','このセットで描いた小さなマップ。自分で塗る前に動作を確認できます。'],
    ['cave.png','タイルセット画像。相対パスで参照されます。'],
    ['README.txt','セットの種類、色の数、Wang IDの順序。']]},
   target:{title:'TiledでWangセットを使う',steps:[
    '`tiled`フォルダーを展開し、PNGを.tsxの隣に置きます（画像はファイル名で参照されます）。',
    'Tiledで`sample.tmx`を開くか、.tsxを開いて自分のマップで使います。',
    'ラベルを確認するには、タイルセットを開いてツールバーのTerrain Setsボタンを押します。各タイルに色の付いた角や辺が表示され、Patternsタブはまだタイルがない組み合わせを強調します。',
    '地形モードを抜けてマップに戻り、Terrain Setsウィンドウでセットと地形を選んでTerrain Brush（T）で塗ります。Ctrlを押すと角や辺1つではなくタイル全体を、Shiftで直線を塗れます。',
    '空のマップでは、マニュアルの助言どおり先に範囲を塗りつぶすかCtrlを押して、ブラシがつなげる隣を用意します。',
    'Godotへ持っていくなら、TiledのGodot 4エクスポーターでマップを書き出すか、地形を直接作ります。[[game/godot-autotile|Godot 4のオートタイル]]を参照。']},
   verify:{steps:[
    'Terrain Setsモードで、孤立タイル以外のすべてのタイルに色が表示されるはずです。角16のセットなら、Patternsビューで空以外の15パターンがすべて暗く表示されます。',
    'Ctrlを押しながら3 × 3の範囲を塗ります。縁がつながった異なるタイル9枚が出るはずです。',
    '`sample.tmx`はStudioのテストマップをTiledルールで描いたものと同じに見えます。そのルールが空きと示したセルはTiledでも空のままです。']},
   trouble:{rows:[
    ['最初にブラシが何も塗らない','マップが空で、セットに空への遷移がなく足がかりがない','マニュアルが新しいマップでのこのケースを説明している','先に範囲を塗りつぶすか、Ctrlを押してタイル全体を塗る'],
    ['孤立した1セルが空のまま','孤立タイルのWang IDがすべて0で、セットに含まれない','Terrain Setsモードでそのタイルに色がない','必要な場所にStamp Brushで手で置く'],
    ['サンプルマップが他のレイヤーと半タイルずれる','角セットのサンプルは−½タイルのレイヤーオフセットで格子点に描かれる','レイヤーのプロパティのOffset X / Y','デュアルグリッド風にするならオフセットを維持、そうでなければ消して自分のレイヤーに塗る'],
    ['あちこちで違うタイルや継ぎ目が出る','セットの種類が絵に合っていない（ブロブのシートをedgeセットにした等）','.tsxの`wangset`の`type`属性','Studioで正しい配置を適用して書き出し直す'],
    ['2つの地形が混ざらない','2色を一緒に持つタイルがない','Patternsビューに2色が混ざるパターンがない','遷移タイルを描くか、[[game/tileset-generator|ジェネレーター]]でAからBのタイルを生成'],
    ['古いTiledで地形がまったく表示されない','Tiled 1.5以降の形式の地形情報は旧バージョンで読めない（マニュアルの警告）','Help › About Tiled','Tiledを更新']]},
   alternatives:{rows:[
    ['TiledのTerrain Setsモードで手作業で印を付ける（地形を選び、タイルの領域をクリック・ドラッグ）','セットが小さい、配置が特殊、または公開配置で表せない複数の地形が1タイルにあるとき。'],
    ['代わりにLDtkのオートレイヤールールを使う：[[game/ldtk-autotile-rules|LDtkのオートタイルルール]]','IntGridで塗り、modulo・確率・反転で拡張できるルールが好みのとき。'],
    ['Godotの地形を直接作る：[[game/godot-autotile|Godot 4のオートタイル]]','対象がGodotだけで、Godotの中で塗りたいとき。']]},
   limits:['Terrain Brushそのものは私たちのチェックでは操作していません（WindowsではTiledのスクリプトがヘッドレスで動かないため）。ファイルの読み込みは検証済みです。','反転・回転のバリエーション（Tile Transformations）は書き出しません。','1回の書き出しにつきWangセットは1つです。'],
   versions:{body:['Tiled 1.12.2自身のコマンドライン読み込み（`--export-tileset`、`--export-map`）で確認しました。全Wang IDが書いたとおりに戻り、全サンプルマップが正しいWangタイリングで、`tmxrasterizer`の描画は独立した描画とピクセル単位で一致しました。Wang IDの入れ替え、gidの変更、間隔+1ではこのチェックが失敗します。上のメニュー名はTiledの公式ドキュメントに基づきます。'],sources:[TILED_TERRAIN,TILED_TMX,TILED_EDIT]}
  }
 },
 'game/unity-rule-tile':{
  type:'engine',
  intent:{primary:'make a Unity Rule Tile from a 47-tile or 16-tile tileset without setting every rule by hand',secondary:['how Rule Tile rules and order work','This / Not This neighbours','Rule Tile collision','why dual grid does not work as a Rule Tile'],
   goal:'RuleTile assets in Unity 6 that paint the right sprite in every Tilemap cell',input:'blob-47 or 16-side / 3×3 tileset PNG (corner / dual-grid sets are not exported)',output:'PNG + nerulio-ruletile.json + Editor/NerulioRuleTileImporter.cs; Unity writes Terrain.asset',target:'Unity 6 (verified 6000.5.3f1 + 2D Tilemap Extras 8.0.3)',support:'partial',
   evidence:['src/game/tiles/unity.js (unityRules, UNITY_RULETILE_SCRIPT)','src/studio/workspaces/tile/verify-status.js (unity: 10 corpus sets)','docs/STUDIO-TILE.md (Unity 6000.5.3f1 batch mode, GetSprite = prediction)'],
   external:['2D Tilemap Extras 8.0.3: Create a rule tile, Rule Tile Inspector reference, Install','Unity 6 Manual: create tilemap, tile palette, Tilemap Collider 2D']},
  en:{
   answer:'A Rule Tile (2D Tilemap Extras package) is a list of tiling rules: each rule is a 3 × 3 grid where every neighbour is ignored, must be this Rule Tile (green arrow) or must not be (red cross). Unity checks the rules from the top and paints the first match, or the Default Sprite when none matches. A blob tileset means 47 rules by hand. Nerulio writes the rules from the tile bits and ships an editor script that slices the PNG and creates one RuleTile per terrain; checked in Unity 6000.5.3f1 with Tilemap Extras 8.0.3. Corner and dual-grid sets are not exported to Unity.',
   concept:{title:'How a Rule Tile chooses a sprite',body:[
    'The Tilemap Extras manual describes the parts: Default Sprite (painted when no rule matches), Default Collider, and a list of Tiling Rules, each with a rule grid, a sprite and an output (Single, Random or Animation). In the rule grid a cell can be empty (ignore that neighbour), a green arrow (the neighbour must be this Rule Tile) or a red cross (it must not be). "Unity checks each rule in turn, starting at the top."',
    'Because the first match wins, order matters: a loose rule above a strict one hides it. Nerulio sorts the rules by how many neighbours they check, most first, and leaves a corner empty when a side next to it is open (it cannot change the picture), so a blob rule checks between 4 and 8 neighbours. Unity\'s grid has y pointing up, so the northern neighbour is (0, 1).',
    'A Rule Tile paints on the cell it sits in and looks at the cells around it. A dual-grid tile belongs to the point between four cells, which a Rule Tile cannot express, so corner sets are left out of the Unity export. Several terrains in one sheet become separate Rule Tiles; each treats the others as "not this", so they meet without transition tiles.'],
    terms:[['Rule Tile','A tile asset from 2D Tilemap Extras that picks its sprite from neighbouring tiles.'],['Default Sprite','What Unity paints when no tiling rule matches — for a Nerulio export, the full interior tile.'],['This / Not This','Green arrow: the neighbour is this Rule Tile. Red cross: it is not. Empty: ignored.'],['Rule order','Rules are tested from the top; the first match paints.']]},
   example:{title:'Example: the rule for one blob tile',lines:[
    'tile mask 31: N, NE, E, SE, S connected, W open (Unity grid, y up)',
    '  .  ✓  ✓      . = ignored (corners behind the open west side)',
    '  ✕  C  ✓      ✓ = This (green arrow)',
    '  .  ✓  ✓      ✕ = Not This (red cross)',
    'JSON neighbours [[0,1,1],[1,1,1],[1,0,1],[1,-1,1],[0,-1,1],[-1,0,2]]   (dx, dy, 1 This / 2 NotThis)',
    'blob-47 → 47 rules, most checks first; Default Sprite = the full tile',
    '16-side set → 16 rules, 4 side checks each'],
    after:'Sprites are named after their column and row in the sheet (the mask-31 tile above is `tile_4_1` in a cr31 8 × 6 sheet), and their rectangles are measured from the bottom-left of the texture, as Unity counts.'},
   outputs:{rows:[
    ['nerulio-ruletile.json','Sprite rectangles, pixels per unit (= tile width) and per terrain the default sprite and the ordered rules.'],
    ['Editor/NerulioRuleTileImporter.cs','Adds Tools › Nerulio › Build Rule Tiles: sets the PNG to Sprite (Multiple), Point, no mipmaps, uncompressed; slices it; writes one `RuleTile` per terrain.'],
    ['cave.png','The tileset image.'],
    ['README.txt','These steps.'],
    ['Terrain.asset','Written by Unity when the script runs, next to the JSON; named after the terrain ("Terrain" unless you renamed it).']]},
   target:{title:'Build the Rule Tiles in Unity 6 and paint',steps:[
    'Install 2D Tilemap Extras if the project lacks it: Window › Package Manager › Unity Registry › 2D Tilemap Extras › Install.',
    'Copy the PNG and `nerulio-ruletile.json` into one folder under `Assets/`, and `NerulioRuleTileImporter.cs` into any folder named `Editor`.',
    'Select the JSON in the Project window and run Tools › Nerulio › Build Rule Tiles. The Console reports `Nerulio: wrote 1 RuleTile(s)` and the `.asset` appears next to the JSON.',
    'Create a tilemap: in the Hierarchy, right-click › 2D Object › Tilemap › Rectangular.',
    'Open Window › 2D › Tile Palette, drag the RuleTile asset into a palette, select it and paint with the Paint with Active Brush tool.',
    'For collision, set Default Collider (and each rule\'s Collider) to Grid in the Rule Tile inspector — the script writes None — and add a Tilemap Collider 2D to the tilemap.']},
   verify:{steps:[
    'The RuleTile inspector shows 47 tiling rules for a blob set (16 for a side set), and the Default Sprite is the full interior tile.',
    'Paint a 3 × 3 block and a lone cell: 9 different sprites and the isolated sprite. Where the full tile shows up on an edge, that combination is missing from the sheet.',
    'Sprites stay crisp at any zoom, because the script imports the PNG with Point filtering and no compression.']},
   trouble:{rows:[
    ['There is no Tools › Nerulio menu','The script is not in an `Editor` folder, or it does not compile because 2D Tilemap Extras or the 2D Sprite package is missing','Console: compile errors naming `RuleTile` or `SpriteDataProviderFactories`','Install both packages and move the script into an `Editor` folder'],
    ['`Nerulio: select nerulio-ruletile.json first.`','Something other than the JSON is selected','Project window selection','Select the JSON and run the menu again'],
    ['Exception: the PNG "is not in the project"','The PNG is not next to the JSON or was renamed','`image` in the JSON vs the file name','Put the PNG beside the JSON under its exported name'],
    ['The full tile appears on edges or corners','The sheet lacks that combination, so Unity paints the Default Sprite','Studio Check panel: missing combinations','Draw or [[game/tileset-generator|generate]] the missing tiles and export again'],
    ['Two terrains meet with a hard edge','Each terrain is its own RuleTile and sees the other as "not this"','Two .asset files after the build','Use one terrain per tilemap, or Godot / Tiled when you need transitions'],
    ['No `unity` folder in the ZIP','The set is a corner / dual-grid set; NOTES.txt says it was skipped','Match mode in the Studio: corners','Use Godot or Tiled for [[game/dual-grid-tileset|dual-grid sets]]'],
    ['The player falls through the tilemap','Collider None on the RuleTile, or no Tilemap Collider 2D','RuleTile inspector: Default Collider','Set Grid (or Sprite) and add a Tilemap Collider 2D']]},
   alternatives:{rows:[
    ['Build the rules by hand in the Rule Tile inspector','Few tiles, or rules the export does not write: Extend Neighbor (beyond 3 × 3), Random or Animation outputs.'],
    ['Rule Override Tile (Create › 2D › Tiles › Rule Override Tile)','A second tileset drawn in the same layout: reuse the generated rules and swap only the sprites.'],
    ['Godot terrains or a Tiled Wang set','You need dual-grid sets or transitions between terrains: [[game/godot-autotile|Godot 4]] or [[game/tiled-wang-set|Tiled]].']]},
   limits:['Corner / dual-grid sets are not exported to Unity.','Several terrains become separate RuleTiles with no transitions between them.','No collision shapes: the RuleTiles are written with Collider None; Nerulio\'s traced polygons go to Godot only.'],
   versions:{body:['Checked in Unity 6000.5.3f1 (batch mode) with 2D Tilemap Extras 8.0.3: the shipped script built the RuleTiles, and a painted Tilemap returned the sprite the Studio predicts in every cell on 10 corpus sets, with exact sprite rectangles and pixels. Swapping two sprites in the rule JSON makes the check fail. Unity menu paths above follow the Unity 6 manual and the Tilemap Extras 8.0.3 documentation.'],sources:[UNITY_RULETILE,UNITY_INSPECTOR,UNITY_INSTALL,UNITY_TILEMAP,UNITY_PALETTE,UNITY_COLLIDER]}
  },
  ko:{
   answer:'Rule Tile(2D Tilemap Extras 패키지)은 타일링 규칙의 목록입니다. 규칙마다 3 × 3 격자가 있고, 각 이웃은 무시하거나, 이 Rule Tile이어야 하거나(초록 화살표), 아니어야 합니다(빨간 X). Unity는 위에서부터 규칙을 검사해 처음 맞는 것을 칠하고, 하나도 맞지 않으면 Default Sprite를 칠합니다. 블롭 타일셋이면 규칙 47개를 손으로 만들어야 합니다. Nerulio는 타일 비트로 규칙을 쓰고, PNG를 잘라 지형마다 RuleTile을 만드는 편집기 스크립트를 줍니다. Unity 6000.5.3f1과 Tilemap Extras 8.0.3에서 확인했습니다. 모서리·듀얼 그리드 세트는 Unity로 내보내지 않습니다.',
   concept:{title:'Rule Tile이 스프라이트를 고르는 방식',body:[
    'Tilemap Extras 매뉴얼이 구성 요소를 설명합니다. Default Sprite(맞는 규칙이 없을 때 칠함), Default Collider, 그리고 Tiling Rules 목록이 있고, 규칙마다 규칙 격자·스프라이트·출력(Single, Random, Animation)이 있습니다. 규칙 격자의 칸은 비워 두거나(그 이웃은 무시), 초록 화살표(이 Rule Tile이어야 함), 빨간 X(아니어야 함)로 둡니다. 매뉴얼은 Unity가 "위에서부터 차례로 각 규칙을 검사한다"고 적고 있습니다.',
    '처음 맞는 규칙이 이기므로 순서가 중요합니다. 느슨한 규칙이 위에 있으면 엄격한 규칙이 가려집니다. Nerulio는 확인하는 이웃이 많은 규칙부터 정렬하고, 옆 변이 열린 모서리는 그림을 바꾸지 못하므로 비워 둡니다. 그래서 블롭 규칙 하나는 이웃 4~8칸을 봅니다. Unity 격자는 y축이 위를 향하므로 북쪽 이웃은 (0, 1)입니다.',
    'Rule Tile은 자기가 놓인 칸에 그리고 주변 칸을 봅니다. 듀얼 그리드 타일은 네 칸 사이의 점에 속하므로 Rule Tile로는 표현할 수 없어, 모서리 세트는 Unity 내보내기에서 빠집니다. 한 시트의 지형 여러 개는 각각 별도의 Rule Tile이 되고 서로를 "이것이 아님"으로 보므로, 전환 타일 없이 맞닿습니다.'],
    terms:[['Rule Tile','이웃 타일을 보고 스프라이트를 고르는 2D Tilemap Extras의 타일 에셋.'],['Default Sprite','어떤 규칙도 맞지 않을 때 Unity가 칠하는 스프라이트. Nerulio 내보내기에서는 가득 찬 안쪽 타일.'],['This / Not This','초록 화살표: 이웃이 이 Rule Tile. 빨간 X: 아님. 빈칸: 무시.'],['규칙 순서','규칙은 위에서부터 검사하며 처음 맞는 것이 칠해집니다.']]},
   example:{title:'예시: 블롭 타일 하나의 규칙',lines:[
    '타일 마스크 31: N, NE, E, SE, S 연결, W 열림(Unity 격자, y 위쪽)',
    '  .  ✓  ✓      . = 무시(열린 서쪽 변 뒤의 모서리)',
    '  ✕  C  ✓      ✓ = This(초록 화살표)',
    '  .  ✓  ✓      ✕ = Not This(빨간 X)',
    'JSON 이웃 [[0,1,1],[1,1,1],[1,0,1],[1,-1,1],[0,-1,1],[-1,0,2]]   (dx, dy, 1 This / 2 NotThis)',
    '블롭 47 → 규칙 47개, 확인 수가 많은 것부터; Default Sprite = 가득 찬 타일',
    '변 16 세트 → 규칙 16개, 각각 변 4개 확인'],
    after:'스프라이트 이름은 시트의 열과 행을 따르며(cr31 8 × 6 시트라면 위의 마스크 31 타일은 `tile_4_1`), 사각형은 Unity 방식대로 텍스처 왼쪽 아래부터 잽니다.'},
   outputs:{rows:[
    ['nerulio-ruletile.json','스프라이트 사각형, 유닛당 픽셀(= 타일 너비), 지형마다 기본 스프라이트와 정렬된 규칙.'],
    ['Editor/NerulioRuleTileImporter.cs','Tools › Nerulio › Build Rule Tiles 메뉴를 추가: PNG를 Sprite(Multiple)·Point·밉맵 없음·무압축으로 설정하고 잘라 지형마다 `RuleTile`을 씁니다.'],
    ['cave.png','타일셋 이미지.'],
    ['README.txt','이 단계 안내.'],
    ['Terrain.asset','스크립트를 실행하면 Unity가 JSON 옆에 씁니다. 이름은 지형 이름을 따릅니다(바꾸지 않았다면 "Terrain").']]},
   target:{title:'Unity 6에서 Rule Tile을 만들고 칠하기',steps:[
    '프로젝트에 없다면 2D Tilemap Extras를 설치합니다. Window › Package Manager › Unity Registry › 2D Tilemap Extras › Install.',
    'PNG와 `nerulio-ruletile.json`을 `Assets/` 아래 한 폴더에, `NerulioRuleTileImporter.cs`를 이름이 `Editor`인 아무 폴더에 복사합니다.',
    'Project 창에서 JSON을 선택하고 Tools › Nerulio › Build Rule Tiles를 실행합니다. Console에 `Nerulio: wrote 1 RuleTile(s)`가 나오고 JSON 옆에 `.asset`이 생깁니다.',
    '타일맵을 만듭니다. Hierarchy에서 우클릭 › 2D Object › Tilemap › Rectangular.',
    'Window › 2D › Tile Palette를 열고 RuleTile 에셋을 팔레트로 끌어 놓은 뒤, 선택해서 Paint with Active Brush 도구로 칠합니다.',
    '충돌이 필요하면 Rule Tile 인스펙터에서 Default Collider(와 각 규칙의 Collider)를 Grid로 바꾸고(스크립트는 None으로 씀) 타일맵에 Tilemap Collider 2D를 추가합니다.']},
   verify:{steps:[
    'RuleTile 인스펙터에 블롭 세트면 타일링 규칙 47개(변 세트면 16개)가 보이고, Default Sprite는 가득 찬 안쪽 타일입니다.',
    '3 × 3 영역과 외딴 한 칸을 칠합니다. 서로 다른 스프라이트 9개와 고립 스프라이트가 나와야 합니다. 가장자리에 가득 찬 타일이 나오면 그 조합이 시트에 없는 것입니다.',
    '스크립트가 PNG를 Point 필터·무압축으로 가져오므로 어느 배율에서도 스프라이트가 선명해야 합니다.']},
   trouble:{rows:[
    ['Tools › Nerulio 메뉴가 없음','스크립트가 `Editor` 폴더에 없거나, 2D Tilemap Extras나 2D Sprite 패키지가 없어 컴파일되지 않음','Console에서 `RuleTile`이나 `SpriteDataProviderFactories`를 언급하는 컴파일 오류','두 패키지를 설치하고 스크립트를 `Editor` 폴더로 옮기기'],
    ['`Nerulio: select nerulio-ruletile.json first.`','JSON이 아닌 것이 선택됨','Project 창의 선택','JSON을 선택하고 메뉴를 다시 실행'],
    ['PNG가 "프로젝트에 없다"는 예외','PNG가 JSON 옆에 없거나 이름이 바뀜','JSON의 `image` 값과 파일 이름 비교','내보낸 이름 그대로 PNG를 JSON 옆에 두기'],
    ['가장자리나 모서리에 가득 찬 타일이 나옴','시트에 그 조합이 없어 Unity가 Default Sprite를 칠함','Studio 점검 패널의 빠진 조합','빠진 타일을 그리거나 [[game/tileset-generator|생성]]해 다시 내보내기'],
    ['두 지형이 딱 끊겨 만남','지형마다 별도 RuleTile이라 서로를 "이것이 아님"으로 봄','빌드 후 .asset 파일이 두 개','타일맵 하나에 지형 하나를 쓰거나, 전환이 필요하면 Godot·Tiled 사용'],
    ['ZIP에 `unity` 폴더가 없음','모서리·듀얼 그리드 세트라서 건너뜀(NOTES.txt에 적힘)','Studio의 매칭 모드가 corners','[[game/dual-grid-tileset|듀얼 그리드 세트]]는 Godot나 Tiled로'],
    ['캐릭터가 타일맵을 통과해 떨어짐','RuleTile의 Collider가 None이거나 Tilemap Collider 2D가 없음','RuleTile 인스펙터의 Default Collider','Grid(또는 Sprite)로 바꾸고 Tilemap Collider 2D 추가']]},
   alternatives:{rows:[
    ['Rule Tile 인스펙터에서 규칙을 직접 만들기','타일이 적거나, 내보내기가 쓰지 않는 규칙이 필요할 때: Extend Neighbor(3 × 3 밖), Random·Animation 출력.'],
    ['Rule Override Tile(Create › 2D › Tiles › Rule Override Tile)','같은 배치로 그린 두 번째 타일셋. 생성된 규칙을 그대로 쓰고 스프라이트만 바꿉니다.'],
    ['Godot 지형이나 Tiled Wang 세트','듀얼 그리드 세트나 지형 간 전환이 필요할 때: [[game/godot-autotile|Godot 4]], [[game/tiled-wang-set|Tiled]].']]},
   limits:['모서리·듀얼 그리드 세트는 Unity로 내보내지 않습니다.','지형 여러 개는 서로 전환이 없는 별도의 RuleTile이 됩니다.','충돌 모양은 없습니다. RuleTile은 Collider None으로 쓰이며, Nerulio가 딴 폴리곤은 Godot로만 갑니다.'],
   versions:{body:['Unity 6000.5.3f1(배치 모드)과 2D Tilemap Extras 8.0.3에서 확인했습니다. 함께 주는 스크립트가 RuleTile을 만들었고, 칠한 Tilemap이 코퍼스 10세트의 모든 칸에서 Studio가 예측한 스프라이트를 돌려주었으며 스프라이트 사각형과 픽셀도 정확했습니다. 규칙 JSON에서 스프라이트 두 개를 바꾸면 이 점검이 실패합니다. 위의 Unity 메뉴 경로는 Unity 6 매뉴얼과 Tilemap Extras 8.0.3 문서를 따릅니다.'],sources:[UNITY_RULETILE,UNITY_INSPECTOR,UNITY_INSTALL,UNITY_TILEMAP,UNITY_PALETTE,UNITY_COLLIDER]}
  },
  ja:{
   answer:'Rule Tile（2D Tilemap Extrasパッケージ）はタイリングルールのリストです。ルールごとに3 × 3のグリッドがあり、各隣セルは無視するか、このRule Tileであること（緑の矢印）か、そうでないこと（赤い×）を指定します。Unityはルールを上から調べて最初に合ったものを描き、どれも合わなければDefault Spriteを描きます。ブロブのタイルセットなら47個のルールを手で作ることになります。Nerulioはタイルのビットからルールを書き、PNGを切り分けて地形ごとにRuleTileを作るエディタースクリプトを添えます。Unity 6000.5.3f1とTilemap Extras 8.0.3で確認済みです。角・デュアルグリッドのセットはUnityへは書き出しません。',
   concept:{title:'Rule Tileがスプライトを選ぶ仕組み',body:[
    'Tilemap Extrasのマニュアルが構成を説明しています。Default Sprite（合うルールがないときに描く）、Default Collider、そしてTiling Rulesのリストがあり、各ルールはルールグリッド・スプライト・出力（Single、Random、Animation）を持ちます。ルールグリッドのセルは空（その隣は無視）、緑の矢印（隣がこのRule Tileであること）、赤い×（そうでないこと）のいずれかです。マニュアルには、Unityは「上から順に各ルールを調べる」とあります。',
    '最初に合ったルールが勝つので、順序が重要です。緩いルールが上にあると厳しいルールが隠れます。Nerulioは調べる隣の数が多いルールから並べ、隣の辺が開いている角は絵を変えないので空にします。そのためブロブのルールは4〜8セルを見ます。Unityのグリッドはy軸が上向きなので、北の隣は(0, 1)です。',
    'Rule Tileは自分が置かれたセルに描き、周りのセルを見ます。デュアルグリッドのタイルは4セルの間の点に属するためRule Tileでは表現できず、角セットはUnityの書き出しから外れます。1枚のシートの複数の地形はそれぞれ別のRule Tileになり、互いを「これではない」と見なすので、遷移タイルなしで接します。'],
    terms:[['Rule Tile','隣のタイルからスプライトを選ぶ、2D Tilemap Extrasのタイルアセット。'],['Default Sprite','どのルールにも合わないときにUnityが描くスプライト。Nerulioの書き出しでは内側の全面タイル。'],['This / Not This','緑の矢印：隣がこのRule Tile。赤い×：そうでない。空：無視。'],['ルールの順序','ルールは上から調べられ、最初に合ったものが描かれます。']]},
   example:{title:'例：ブロブタイル1枚のルール',lines:[
    'タイルマスク31：N、NE、E、SE、Sがつながり、Wが開いている（Unityグリッド、y上向き）',
    '  .  ✓  ✓      . = 無視（開いた西の辺の後ろの角）',
    '  ✕  C  ✓      ✓ = This（緑の矢印）',
    '  .  ✓  ✓      ✕ = Not This（赤い×）',
    'JSONの隣 [[0,1,1],[1,1,1],[1,0,1],[1,-1,1],[0,-1,1],[-1,0,2]]   (dx, dy, 1 This / 2 NotThis)',
    'ブロブ47 → ルール47個、確認数の多い順；Default Sprite = 全面タイル',
    '辺16のセット → ルール16個、それぞれ4辺を確認'],
    after:'スプライト名はシート上の列と行から付き（cr31の8 × 6シートなら上のマスク31のタイルは`tile_4_1`）、矩形はUnityの数え方どおりテクスチャの左下から測ります。'},
   outputs:{rows:[
    ['nerulio-ruletile.json','スプライトの矩形、ユニットあたりのピクセル（= タイル幅）、地形ごとの既定スプライトと並べ替えたルール。'],
    ['Editor/NerulioRuleTileImporter.cs','Tools › Nerulio › Build Rule Tilesを追加：PNGをSprite（Multiple）・Point・ミップマップなし・無圧縮にし、切り分けて地形ごとに`RuleTile`を書きます。'],
    ['cave.png','タイルセット画像。'],
    ['README.txt','この手順。'],
    ['Terrain.asset','スクリプト実行時にUnityがJSONの隣に書きます。名前は地形名に従います（変更していなければ「Terrain」）。']]},
   target:{title:'Unity 6でRule Tileを作って塗る',steps:[
    'プロジェクトになければ2D Tilemap Extrasを入れます。Window › Package Manager › Unity Registry › 2D Tilemap Extras › Install。',
    'PNGと`nerulio-ruletile.json`を`Assets/`以下の同じフォルダーに、`NerulioRuleTileImporter.cs`を`Editor`という名前の任意のフォルダーにコピーします。',
    'ProjectウィンドウでJSONを選び、Tools › Nerulio › Build Rule Tilesを実行します。Consoleに`Nerulio: wrote 1 RuleTile(s)`と出て、JSONの隣に`.asset`ができます。',
    'タイルマップを作ります。Hierarchyで右クリック › 2D Object › Tilemap › Rectangular。',
    'Window › 2D › Tile Paletteを開き、RuleTileアセットをパレットにドラッグし、選択してPaint with Active Brushツールで塗ります。',
    '衝突が必要なら、Rule TileのインスペクターでDefault Collider（と各ルールのCollider）をGridにし（スクリプトはNoneで書きます）、タイルマップにTilemap Collider 2Dを追加します。']},
   verify:{steps:[
    'RuleTileのインスペクターに、ブロブセットならタイリングルール47個（辺のセットなら16個）が表示され、Default Spriteは内側の全面タイルです。',
    '3 × 3の範囲と孤立した1セルを塗ります。異なるスプライト9つと孤立スプライトが出るはずです。縁に全面タイルが出たら、その組み合わせがシートにありません。',
    'スクリプトがPNGをPointフィルター・無圧縮で取り込むので、どの倍率でもスプライトはくっきりしているはずです。']},
   trouble:{rows:[
    ['Tools › Nerulioメニューがない','スクリプトが`Editor`フォルダーにない、または2D Tilemap Extrasや2D Spriteパッケージがなくてコンパイルできない','Consoleの`RuleTile`や`SpriteDataProviderFactories`に関するコンパイルエラー','両パッケージを入れ、スクリプトを`Editor`フォルダーへ移す'],
    ['`Nerulio: select nerulio-ruletile.json first.`','JSON以外が選択されている','Projectウィンドウの選択','JSONを選んでメニューを再実行'],
    ['PNGが「プロジェクトにない」という例外','PNGがJSONの隣にない、または名前が変わった','JSONの`image`とファイル名を比べる','書き出したときの名前のままPNGをJSONの隣に置く'],
    ['縁や角に全面タイルが出る','シートにその組み合わせがなく、UnityがDefault Spriteを描いた','Studioのチェックパネルの欠けている組み合わせ','足りないタイルを描くか[[game/tileset-generator|生成]]して書き出し直す'],
    ['2つの地形がくっきり途切れて接する','地形ごとに別のRuleTileで、互いを「これではない」と見なす','ビルド後に.assetが2つある','1つのタイルマップに地形1つにするか、遷移が必要ならGodot・Tiledを使う'],
    ['ZIPに`unity`フォルダーがない','角・デュアルグリッドのセットなので省かれた（NOTES.txtに記載）','Studioのマッチモードがcorners','[[game/dual-grid-tileset|デュアルグリッドのセット]]はGodotかTiledへ'],
    ['キャラクターがタイルマップをすり抜けて落ちる','RuleTileのColliderがNone、またはTilemap Collider 2Dがない','RuleTileのインスペクターのDefault Collider','Grid（またはSprite）にしてTilemap Collider 2Dを追加']]},
   alternatives:{rows:[
    ['Rule Tileのインスペクターでルールを手作業で作る','タイルが少ないとき、または書き出しが書かないルールが必要なとき：Extend Neighbor（3 × 3の外）、Random・Animationの出力。'],
    ['Rule Override Tile（Create › 2D › Tiles › Rule Override Tile）','同じ配置で描いた2つ目のタイルセット。生成したルールを使い回し、スプライトだけ差し替えます。'],
    ['Godotの地形やTiledのWangセット','デュアルグリッドや地形間の遷移が必要なとき：[[game/godot-autotile|Godot 4]]、[[game/tiled-wang-set|Tiled]]。']]},
   limits:['角・デュアルグリッドのセットはUnityへ書き出しません。','複数の地形は、互いに遷移のない別々のRuleTileになります。','衝突形状はありません。RuleTileはCollider Noneで書かれ、Nerulioで取ったポリゴンはGodotにだけ渡ります。'],
   versions:{body:['Unity 6000.5.3f1（バッチモード）と2D Tilemap Extras 8.0.3で確認しました。同梱のスクリプトがRuleTileを作り、塗ったTilemapがコーパス10セットの全セルでStudioの予測どおりのスプライトを返し、スプライトの矩形とピクセルも正確でした。ルールJSONでスプライトを2つ入れ替えるとこのチェックは失敗します。上のUnityのメニューパスはUnity 6のマニュアルとTilemap Extras 8.0.3のドキュメントに基づきます。'],sources:[UNITY_RULETILE,UNITY_INSPECTOR,UNITY_INSTALL,UNITY_TILEMAP,UNITY_PALETTE,UNITY_COLLIDER]}
  }
 },
 'game/ldtk-autotile-rules':{
  type:'engine',
  intent:{primary:'get LDtk auto-layer rules for an autotile sheet without writing 47 rules by hand',secondary:['how LDtk auto-layer rules and IntGrid values work','rule order and break on match','dual-grid tiles in LDtk'],
   goal:'an LDtk project whose IntGrid layer paints the right tile in every cell through its rules',input:'autotile sheet PNG with square tiles (blob-47, 16-side, 16-corner / dual grid, 3×3 box) or painted bits',output:'<name>.ldtk (LDtk 1.5.3 JSON: IntGrid layer, rule group, sample level) + PNG + README.txt',target:'LDtk 1.5.3 JSON (not opened in the LDtk app)',support:'partial',
   evidence:['src/game/tiles/ldtk.js (rulePattern, runRules, ldtkProject)','src/studio/workspaces/tile/verify-status.js (ldtk: partial, 12 corpus sets)','docs/STUDIO-TILE.md (schema + QuickType loader + rule re-run)'],
   external:['LDtk docs: Auto layers, Rules, IntGrid layers','LDtk JSON 1.5.3: AutoRuleDef (pattern, size, breakOnMatch, tileXOffset, outOfBoundsValue), intGridCsv, autoLayerTiles']},
  en:{
   answer:'In LDtk, autotiling is an IntGrid layer with a tileset and auto-layer rules: each rule is a pattern of IntGrid values (1 × 1 up to 7 × 7) that paints a tile where it matches; rules run from the top and "break on match" stops later rules in that cell. Nerulio turns every tile of an autotile sheet into one 3 × 3 rule — 47 for a blob set — and writes an LDtk 1.5.3 project with a sample level. The file passes LDtk\'s JSON schema and official loader and re-running the rules reproduces its tiles, but it was not opened in the LDtk app.',
   concept:{title:'IntGrid values, rules and their order',body:[
    'The LDtk manual describes auto-layers as "IntGrid layers with a twist": a tileset linked to them and rules that paint tiles automatically. You paint integer values (the JSON reference: 0 is an empty cell, values start at 1), and the rules turn them into tiles; a pure auto-layer can instead read its values from another IntGrid layer.',
    'A rule is a square pattern over the cell and its neighbours plus the tile it paints. In the file Nerulio writes, a pattern cell holds v (the neighbour must be value v), −v (it must not be v) or 0 (anything), row by row from the top-left, and the tile lands on the centre cell. Corners behind an open side are 0, so a blob rule checks between 5 and 9 cells. The JSON reference defines `breakOnMatch` ("prevent other rules to be applied in the same cell if it matches"), so Nerulio sorts the rules most specific first and keeps it on.',
    'Corner (dual-grid) sets use LDtk\'s tile offset: each rule reads the cell, its right, bottom and bottom-right neighbours — the four cells that meet at one grid point — and draws its tile half a tile down and right, on that point.'],
    terms:[['IntGrid value','An integer painted per cell; each terrain gets one (terrain 1 = value 1, and so on).'],['Auto-layer rule','A pattern of required and forbidden values plus the tile to paint where it matches.'],['Break on match','When a rule matches, later rules skip that cell (LDtk\'s default).'],['Tile offset','A per-rule pixel shift of the painted tile; half a tile for dual-grid sets.']]},
   example:{title:'Example: the 3 × 3 rule for one blob tile (terrain = IntGrid value 1)',lines:[
    'tile mask 31: N, NE, E, SE, S connected, W open',
    'pattern, row by row from the top-left:',
    '   0   1   1        1 = must be value 1',
    '  -1   1   1       -1 = must not be value 1',
    '   0   1   1        0 = anything (corners behind the open west side)',
    'JSON  "size":3, "pattern":[0,1,1,-1,1,1,0,1,1], "breakOnMatch":true',
    'rules  blob-47 → 47,  16-side → 16,  16-corner → 15 (the all-empty corner tile draws nothing)'],
    after:'Cells outside the level count as empty (`outOfBoundsValue` 0), so terrain touching the level border gets its rim tiles.'},
   outputs:{lead:'The `ldtk` folder of the export ZIP, for a sheet called cave.png:',rows:[
    ['cave.ldtk','An LDtk 1.5.3 project: tileset definition, IntGrid layer `Terrain` with one value per terrain, rule group `Nerulio terrain`, and a level `Sample` whose `autoLayerTiles` are already filled.'],
    ['cave.png','The tileset image, referenced by its file name.'],
    ['README.txt','What the project contains and how many tiles the sample level places.']]},
   target:{title:'Open and paint it in LDtk',steps:[
    'Unzip the `ldtk` folder and keep the PNG next to the `.ldtk` file.',
    'Open the `.ldtk` in LDtk. The level `Sample` already shows the tiles the rules place.',
    'In the LAYERS panel select the IntGrid layer `Terrain`: its values are your terrains and its AUTO PAINT tileset is your PNG.',
    'Click the RULES button of the layer to see the group `Nerulio terrain` with one rule per tile, in the order they are tested.',
    'Paint values with the left mouse button, erase with the right, Shift + drag for rectangles and Shift + click to fill; LDtk re-runs the rules as you paint. Shift+R in the Rules panel shows the raw IntGrid.',
    'In your game, read the level\'s `autoLayerTiles` (LDtk stores them already in display order) or `intGridCsv` if you run your own rules.']},
   verify:{steps:[
    'The Sample level shows complete terrain before you paint anything.',
    'The rule group lists 47 rules for a blob set (16 for a side set, 15 for a corner set).',
    'Paint a single cell and a 3 × 3 square: the isolated tile and 9 different tiles appear. We have not seen this inside the LDtk app — it is the check we could not run, so please report a difference.']},
   trouble:{rows:[
    ['The tileset image is missing','The PNG is not next to the `.ldtk` or was renamed','Tileset definition: path of the image','Put the PNG beside the project under its exported name'],
    ['Painting shows values but no tiles','Painting on another layer, or the layer\'s rules are switched off','LAYERS panel selection; Render option in the Rules panel','Select `Terrain` and keep the rule group active'],
    ['A generic tile shows where a specific one belongs','A rule of your own sits above the group, or Break on match was switched off','Rule order in the Rules panel','Move your rule below the group, or turn Break on match back on'],
    ['Dual-grid tiles look half a tile off the IntGrid','By design: corner rules paint on grid points with a half-tile offset','Tile offset of any rule in the group','Keep it; the tiles line up with each other, not with the IntGrid cells'],
    ['No `ldtk` folder in the ZIP','LDtk needs square tiles and one padding and spacing value','NOTES.txt says why it was skipped','Use a square grid with equal x and y margin and spacing'],
    ['Two terrains meet without a transition','The sheet has no tiles that show both terrains','Studio Check panel for that pair','Generate A-over-B tiles in the [[game/tileset-generator|generator]]']]},
   alternatives:{rows:[
    ['Write the rules by hand in LDtk\'s rule editor','Fewer tiles with LDtk features the export does not use: flipped patterns, modulo, checker, random chance, several tiles per rule.'],
    ['A Tiled Wang set: [[game/tiled-wang-set|Tiled Wang set]]','You edit maps in Tiled and want a terrain brush instead of IntGrid painting.'],
    ['Godot terrains: [[game/godot-autotile|Godot 4 autotile]]','Godot is your engine and you do not need LDtk\'s level editor.']]},
   limits:['Not opened in the LDtk app (it has no command line); the checks were the schema, the official loader and an independent re-run of the rules.','One rule per tile: flips, modulo, checker and Perlin options are left off.','Tiles must be square, with the same margin and spacing on both axes.'],
   versions:{body:['Checked on 12 corpus sets: the project passed the LDtk 1.5.3 JSON schema and loaded with LDtk\'s official QuickType loader, and an independent re-run of the rules gave exactly the exported tiles. A changed tile id or an inverted rule makes the check fail. UI names above come from the LDtk documentation; the app itself was not driven.'],sources:[LDTK_AUTO,LDTK_RULES,LDTK_INTGRID,LDTK_JSON]}
  },
  ko:{
   answer:'LDtk에서 오토타일은 타일셋과 자동 레이어 규칙이 붙은 IntGrid 레이어입니다. 규칙마다 IntGrid 값의 패턴(1 × 1부터 7 × 7까지)이 있어 맞는 곳에 타일을 칠하고, 규칙은 위에서부터 실행되며 "break on match"가 켜져 있으면 그 칸에서 뒤의 규칙은 멈춥니다. Nerulio는 오토타일 시트의 타일마다 3 × 3 규칙 하나를 만들어(블롭 세트면 47개) 샘플 레벨이 있는 LDtk 1.5.3 프로젝트로 씁니다. 파일은 LDtk JSON 스키마와 공식 로더를 통과했고 규칙을 다시 실행하면 같은 타일이 나오지만, LDtk 앱에서 열어 보지는 않았습니다.',
   concept:{title:'IntGrid 값, 규칙, 그리고 순서',body:[
    'LDtk 매뉴얼은 자동 레이어를 "한 가지가 더해진 IntGrid 레이어"라고 설명합니다. 타일셋이 연결되어 있고 규칙이 타일을 자동으로 칠합니다. 사용자는 정수 값을 칠하고(JSON 레퍼런스: 0은 빈칸, 값은 1부터), 규칙이 그 값을 타일로 바꿉니다. 순수 자동 레이어는 다른 IntGrid 레이어의 값을 읽어 올 수도 있습니다.',
    '규칙은 칸과 이웃을 덮는 정사각형 패턴, 그리고 칠할 타일로 이뤄집니다. Nerulio가 쓰는 파일에서 패턴 칸은 v(이웃이 값 v여야 함), −v(v가 아니어야 함), 0(상관없음) 중 하나이고 왼쪽 위부터 행 단위로 적히며, 타일은 가운데 칸에 놓입니다. 열린 변 뒤의 모서리는 0이라 블롭 규칙은 5~9칸을 확인합니다. JSON 레퍼런스는 `breakOnMatch`를 "맞으면 같은 칸에 다른 규칙이 적용되지 않게 함"으로 정의하므로, Nerulio는 가장 구체적인 규칙부터 정렬하고 이 옵션을 켜 둡니다.',
    '모서리(듀얼 그리드) 세트는 LDtk의 타일 오프셋을 씁니다. 규칙은 칸과 그 오른쪽·아래·오른쪽 아래, 즉 한 격자점에서 만나는 네 칸을 읽고, 타일을 반 칸 오른쪽 아래인 그 점 위에 그립니다.'],
    terms:[['IntGrid 값','칸마다 칠하는 정수. 지형마다 하나씩(지형 1 = 값 1 …).'],['자동 레이어 규칙','있어야 할 값과 없어야 할 값의 패턴, 그리고 맞을 때 칠할 타일.'],['Break on match','규칙이 맞으면 뒤의 규칙은 그 칸을 건너뜀(LDtk 기본값).'],['타일 오프셋','규칙마다 칠한 타일을 픽셀 단위로 옮기는 값. 듀얼 그리드 세트는 반 타일.']]},
   example:{title:'예시: 블롭 타일 하나의 3 × 3 규칙(지형 = IntGrid 값 1)',lines:[
    '타일 마스크 31: N, NE, E, SE, S 연결, W 열림',
    '패턴(왼쪽 위부터 행 단위):',
    '   0   1   1        1 = 값 1이어야 함',
    '  -1   1   1       -1 = 값 1이 아니어야 함',
    '   0   1   1        0 = 상관없음(열린 서쪽 변 뒤의 모서리)',
    'JSON  "size":3, "pattern":[0,1,1,-1,1,1,0,1,1], "breakOnMatch":true',
    '규칙 수  블롭 47 → 47,  변 16 → 16,  모서리 16 → 15(모두 빈 모서리 타일은 아무것도 안 그림)'],
    after:'레벨 밖의 칸은 빈칸으로 셉니다(`outOfBoundsValue` 0). 그래서 레벨 경계에 닿은 지형에도 테두리 타일이 붙습니다.'},
   outputs:{lead:'cave.png라는 시트를 내보냈을 때 ZIP의 `ldtk` 폴더입니다.',rows:[
    ['cave.ldtk','LDtk 1.5.3 프로젝트: 타일셋 정의, 지형마다 값 하나가 있는 IntGrid 레이어 `Terrain`, 규칙 그룹 `Nerulio terrain`, `autoLayerTiles`가 이미 채워진 레벨 `Sample`.'],
    ['cave.png','타일셋 이미지. 파일 이름으로 참조됩니다.'],
    ['README.txt','프로젝트 구성과 샘플 레벨에 놓이는 타일 수.']]},
   target:{title:'LDtk에서 열고 칠하기',steps:[
    '`ldtk` 폴더의 압축을 풀고 PNG를 `.ldtk` 파일 옆에 둡니다.',
    'LDtk에서 `.ldtk`를 엽니다. `Sample` 레벨에 규칙이 놓은 타일이 이미 보입니다.',
    'LAYERS 패널에서 IntGrid 레이어 `Terrain`을 고릅니다. 값은 내 지형이고 AUTO PAINT 타일셋은 내 PNG입니다.',
    '레이어의 RULES 버튼을 누르면 타일마다 규칙 하나가 든 `Nerulio terrain` 그룹이 검사 순서대로 보입니다.',
    '왼쪽 버튼으로 값을 칠하고 오른쪽 버튼으로 지우며, Shift + 드래그는 사각형, Shift + 클릭은 채우기입니다. 칠하는 동안 LDtk가 규칙을 다시 실행합니다. Rules 패널에서 Shift+R을 누르면 원래 IntGrid가 보입니다.',
    '게임에서는 레벨의 `autoLayerTiles`(LDtk가 이미 표시 순서대로 저장)를 읽거나, 규칙을 직접 돌린다면 `intGridCsv`를 읽습니다.']},
   verify:{steps:[
    '아무것도 칠하기 전에 Sample 레벨에 지형이 완성되어 보여야 합니다.',
    '규칙 그룹에 블롭 세트는 규칙 47개(변 세트 16개, 모서리 세트 15개)가 있어야 합니다.',
    '외딴 한 칸과 3 × 3 사각형을 칠하면 고립 타일과 서로 다른 타일 9개가 나와야 합니다. LDtk 앱 안에서는 저희가 직접 보지 못한 부분이니, 다르게 나오면 알려 주세요.']},
   trouble:{rows:[
    ['타일셋 이미지가 없다고 나옴','PNG가 `.ldtk` 옆에 없거나 이름이 바뀜','타일셋 정의의 이미지 경로','내보낸 이름 그대로 PNG를 프로젝트 옆에 두기'],
    ['칠하면 값만 보이고 타일이 안 나옴','다른 레이어에 칠하고 있거나 레이어의 규칙이 꺼짐','LAYERS 패널의 선택, Rules 패널의 Render 옵션','`Terrain`을 고르고 규칙 그룹을 켜 두기'],
    ['특정 타일 자리에 일반 타일이 나옴','직접 만든 규칙이 그룹보다 위에 있거나 Break on match를 껐음','Rules 패널의 규칙 순서','내 규칙을 그룹 아래로 옮기거나 Break on match를 다시 켜기'],
    ['듀얼 그리드 타일이 IntGrid와 반 칸 어긋남','설계상 그럼: 모서리 규칙은 반 칸 오프셋으로 격자점에 칠함','그룹 안 규칙의 타일 오프셋','그대로 두기. 타일끼리는 맞물리고 IntGrid 칸과는 반 칸 어긋나는 것이 정상'],
    ['ZIP에 `ldtk` 폴더가 없음','LDtk는 정사각형 타일과 여백·간격 값이 하나씩만 필요함','NOTES.txt에 건너뛴 이유가 적힘','가로세로 여백·간격이 같은 정사각형 격자 사용'],
    ['두 지형이 전환 없이 만남','두 지형이 함께 보이는 타일이 시트에 없음','그 쌍에 대한 Studio 점검 패널','[[game/tileset-generator|생성기]]에서 A 위 B 타일 생성']]},
   alternatives:{rows:[
    ['LDtk 규칙 편집기에서 직접 작성','타일이 적고 내보내기가 쓰지 않는 LDtk 기능이 필요할 때: 뒤집힌 패턴, modulo, checker, 확률, 규칙 하나에 타일 여러 개.'],
    ['Tiled Wang 세트: [[game/tiled-wang-set|Tiled Wang 세트]]','맵을 Tiled에서 편집하고 IntGrid 대신 지형 브러시를 쓰고 싶을 때.'],
    ['Godot 지형: [[game/godot-autotile|Godot 4 오토타일]]','엔진이 Godot이고 LDtk 레벨 편집기가 필요 없을 때.']]},
   limits:['LDtk 앱에서 열지 않았습니다(명령줄이 없음). 점검은 스키마, 공식 로더, 독립적인 규칙 재실행이었습니다.','타일 하나에 규칙 하나: 뒤집기, modulo, checker, Perlin 옵션은 쓰지 않습니다.','타일은 정사각형이어야 하고 여백과 간격이 두 축에서 같아야 합니다.'],
   versions:{body:['코퍼스 12세트에서 확인: 프로젝트가 LDtk 1.5.3 JSON 스키마를 통과하고 LDtk 공식 QuickType 로더로 읽혔으며, 규칙을 독립적으로 다시 실행하면 내보낸 타일과 정확히 같았습니다. 타일 id를 바꾸거나 규칙을 뒤집으면 점검이 실패합니다. 위의 UI 이름은 LDtk 공식 문서를 따르며, 앱 자체는 조작하지 않았습니다.'],sources:[LDTK_AUTO,LDTK_RULES,LDTK_INTGRID,LDTK_JSON]}
  },
  ja:{
   answer:'LDtkのオートタイルは、タイルセットとオートレイヤールールを持つIntGridレイヤーです。ルールごとにIntGrid値のパターン（1 × 1〜7 × 7）があり、合った場所にタイルを塗ります。ルールは上から実行され、「break on match」が有効ならそのセルでは以降のルールが止まります。Nerulioはオートタイルシートのタイル1枚ごとに3 × 3のルールを1つ作り（ブロブセットなら47個）、サンプルレベル付きのLDtk 1.5.3プロジェクトとして書き出します。ファイルはLDtkのJSONスキーマと公式ローダーを通り、ルールを再実行すると同じタイルになりますが、LDtkアプリでは開いていません。',
   concept:{title:'IntGrid値、ルール、そしてその順序',body:[
    'LDtkのマニュアルはオートレイヤーを「ひと工夫したIntGridレイヤー」と説明しています。タイルセットがリンクされ、ルールが自動でタイルを塗ります。ユーザーは整数値を塗り（JSONリファレンス：0は空セル、値は1から）、ルールがそれをタイルに変えます。純粋なオートレイヤーは別のIntGridレイヤーから値を読むこともできます。',
    'ルールは、セルと隣を覆う正方形のパターンと、塗るタイルからなります。Nerulioが書くファイルでは、パターンのセルはv（隣が値vであること）、−v（vでないこと）、0（何でもよい）のいずれかで、左上から行ごとに並び、タイルは中央のセルに置かれます。開いた辺の後ろの角は0なので、ブロブのルールは5〜9セルを確認します。JSONリファレンスは`breakOnMatch`を「合った場合、同じセルに他のルールを適用させない」と定義しているので、Nerulioは最も具体的なルールから並べ、この設定を有効にしています。',
    '角（デュアルグリッド）セットはLDtkのタイルオフセットを使います。ルールはセルとその右・下・右下、つまり1つの格子点で接する4セルを読み、タイルを半タイル右下のその点の上に描きます。'],
    terms:[['IntGrid値','セルごとに塗る整数。地形ごとに1つ（地形1 = 値1 …）。'],['オートレイヤールール','必要な値と禁止する値のパターンと、合ったときに塗るタイル。'],['Break on match','ルールが合うと、以降のルールはそのセルを飛ばす（LDtkの既定）。'],['タイルオフセット','ルールごとに塗ったタイルをピクセル単位でずらす値。デュアルグリッドでは半タイル。']]},
   example:{title:'例：ブロブタイル1枚の3 × 3ルール（地形 = IntGrid値1）',lines:[
    'タイルマスク31：N、NE、E、SE、Sがつながり、Wが開いている',
    'パターン（左上から行ごと）：',
    '   0   1   1        1 = 値1であること',
    '  -1   1   1       -1 = 値1でないこと',
    '   0   1   1        0 = 何でもよい（開いた西の辺の後ろの角）',
    'JSON  "size":3, "pattern":[0,1,1,-1,1,1,0,1,1], "breakOnMatch":true',
    'ルール数  ブロブ47 → 47、辺16 → 16、角16 → 15（すべて空の角タイルは何も描かない）'],
    after:'レベル外のセルは空として数えます（`outOfBoundsValue` 0）。そのためレベルの端に接する地形にも縁のタイルが付きます。'},
   outputs:{lead:'cave.pngというシートを書き出したときの、ZIP内の`ldtk`フォルダーです。',rows:[
    ['cave.ldtk','LDtk 1.5.3プロジェクト：タイルセット定義、地形ごとに値を持つIntGridレイヤー`Terrain`、ルールグループ`Nerulio terrain`、`autoLayerTiles`が埋まったレベル`Sample`。'],
    ['cave.png','タイルセット画像。ファイル名で参照されます。'],
    ['README.txt','プロジェクトの内容と、サンプルレベルに置かれるタイル数。']]},
   target:{title:'LDtkで開いて塗る',steps:[
    '`ldtk`フォルダーを展開し、PNGを`.ldtk`ファイルの隣に置きます。',
    'LDtkで`.ldtk`を開きます。レベル`Sample`にはルールが置いたタイルがすでに表示されています。',
    'LAYERSパネルでIntGridレイヤー`Terrain`を選びます。値があなたの地形で、AUTO PAINTのタイルセットがあなたのPNGです。',
    'レイヤーのRULESボタンを押すと、タイルごとに1ルールを持つグループ`Nerulio terrain`が、調べられる順に表示されます。',
    '左ボタンで値を塗り、右ボタンで消し、Shift + ドラッグで矩形、Shift + クリックで塗りつぶしです。塗るたびにLDtkがルールを再実行します。RulesパネルでShift+Rを押すと元のIntGridが見えます。',
    'ゲームでは、レベルの`autoLayerTiles`（LDtkが表示順に並べて保存）を読むか、自分でルールを回すなら`intGridCsv`を読みます。']},
   verify:{steps:[
    '何も塗る前から、Sampleレベルに完成した地形が表示されるはずです。',
    'ルールグループには、ブロブセットならルール47個（辺のセットは16個、角のセットは15個）があるはずです。',
    '孤立した1セルと3 × 3の四角を塗ると、孤立タイルと異なるタイル9枚が出るはずです。LDtkアプリ内では私たちが実際に確認できていない部分なので、違いがあれば知らせてください。']},
   trouble:{rows:[
    ['タイルセット画像が見つからない','PNGが`.ldtk`の隣にない、または名前が変わった','タイルセット定義の画像パス','書き出したときの名前のままPNGをプロジェクトの隣に置く'],
    ['塗っても値だけでタイルが出ない','別のレイヤーに塗っている、またはレイヤーのルールがオフ','LAYERSパネルの選択、RulesパネルのRenderオプション','`Terrain`を選び、ルールグループを有効にしておく'],
    ['専用タイルの位置に汎用のタイルが出る','自作のルールがグループより上にある、またはBreak on matchを切った','Rulesパネルのルールの順序','自作ルールをグループの下へ移すか、Break on matchを戻す'],
    ['デュアルグリッドのタイルがIntGridと半タイルずれる','仕様：角のルールは半タイルのオフセットで格子点に塗る','グループ内のルールのタイルオフセット','そのままでよい。タイル同士はかみ合い、IntGridのセルとは半タイルずれるのが正常'],
    ['ZIPに`ldtk`フォルダーがない','LDtkは正方形のタイルと、余白・間隔の値を1つずつしか持てない','NOTES.txtに省いた理由がある','縦横の余白と間隔が同じ正方形のグリッドを使う'],
    ['2つの地形が遷移なしで接する','両方の地形が見えるタイルがシートにない','そのペアについてのStudioのチェックパネル','[[game/tileset-generator|ジェネレーター]]でAからBのタイルを生成']]},
   alternatives:{rows:[
    ['LDtkのルールエディターで手作業で書く','タイルが少なく、書き出しが使わないLDtkの機能が必要なとき：反転パターン、modulo、checker、確率、1ルールに複数タイル。'],
    ['TiledのWangセット：[[game/tiled-wang-set|TiledのWangセット]]','マップをTiledで編集し、IntGridの代わりに地形ブラシを使いたいとき。'],
    ['Godotの地形：[[game/godot-autotile|Godot 4のオートタイル]]','エンジンがGodotで、LDtkのレベルエディターが要らないとき。']]},
   limits:['LDtkアプリでは開いていません（コマンドラインがないため）。チェックはスキーマ、公式ローダー、独立したルールの再実行です。','1タイルに1ルール：反転、modulo、checker、Perlinのオプションは使いません。','タイルは正方形で、余白と間隔が縦横で同じである必要があります。'],
   versions:{body:['コーパス12セットで確認：プロジェクトはLDtk 1.5.3のJSONスキーマを通り、LDtk公式のQuickTypeローダーで読み込め、ルールを独立に再実行すると書き出したタイルと完全に一致しました。タイルidを変えたりルールを反転させたりするとチェックは失敗します。上のUI名はLDtkの公式ドキュメントに基づき、アプリ自体は操作していません。'],sources:[LDTK_AUTO,LDTK_RULES,LDTK_INTGRID,LDTK_JSON]}
  }
 },
 'game/godot-tileset-collision':{
  type:'engine',
  intent:{primary:'add collision to a Godot 4 TileSet: a physics layer and a polygon per tile',secondary:['collision polygons traced from tile alpha','why tile collision is offset by half a tile','player falls through the TileMapLayer','collision layer and mask of a tileset'],
   goal:'a TileMapLayer whose tiles collide where the art is solid, with shapes that line up between neighbouring tiles',input:'tileset PNG with alpha, tiles with terrain bits in the Studio',output:'nerulio-tileset.json with physicsLayers + per-tile collision; the import script writes them into nerulio-tileset.tres',target:'Godot 4 (verified 4.7.2)',support:'full',
   evidence:['src/game/tile-collision.js (box, rects, outline, 256-point cap)','src/game/godot-tileset.js (add_physics_layer, set_collision_polygon_points, half-tile shift)','src/studio/workspaces/tile/index.js (export collision option, default None)','docs/STUDIO-TILE.md (polygons read back in Godot 4.7.2)'],
   external:['Godot 4.7 docs: Using TileSets (Physics Layers, collision editor, F)','TileData.set_collision_polygon_points, one-way','TileMapLayer.collision_enabled','Debug › Visible Collision Shapes']},
  en:{
   answer:'In Godot 4, tile collision lives in the TileSet: add a physics layer (its collision layer and mask), then give each tile one or more collision polygons; the points are measured from the tile\'s centre. Nerulio traces a polygon for every tile from its alpha (outline, exact rectangles or one box), lets you move the points, and its import script writes physics layer 0 with collision layer 1 and mask 1 and each polygon shifted by half a tile. Godot 4.7.2 read every polygon back point for point.',
   concept:{title:'Physics layers, polygons and the tile centre',body:[
    'A TileSet has a list of physics layers, each with a collision layer, a collision mask and optionally a physics material (the Godot docs: TileSet inspector › Physics Layers › Add Element). Per layer every tile can hold several polygons (`TileData.set_collision_polygon_points(layer, index, points)`), each optionally one-way. A `TileMapLayer` turns the painted tiles into static collision as long as its `collision_enabled` is on (the default).',
    'Nerulio keeps shapes in tile pixels with the origin at the tile\'s top-left, the way you draw them. Godot measures a tile\'s polygon from the tile centre, so the importer subtracts half the tile size from every point. A tool that skips this shift puts every shape half a tile up and left.',
    'Three readings of the alpha (a pixel counts as solid when its alpha is above 0): Outline follows the solid edge along pixel borders and keeps only outer loops, so a hole becomes solid; Exact rectangles covers exactly the solid pixels with a few boxes, holes stay open; Box is one rectangle around everything. A long outline is simplified until it has at most 256 points.'],
    terms:[['Physics layer','A slot on the TileSet with collision layer, mask and material; tiles store polygons per slot.'],['Collision polygon','A list of points around the tile centre; everything inside counts as solid.'],['Collision layer / mask','Which layers the tiles are on, and which layers they detect; a body collides with the tiles when its mask includes their layer.'],['Half-tile shift','Top-left tile pixels minus (width ÷ 2, height ÷ 2) = Godot\'s centred coordinates.']]},
   example:{title:'Example: a 64 px ground tile, from pixels to Godot',lines:[
    '64 × 64 tile, solid ground in the lower 40 px (pixel rows 24–63)',
    'Nerulio, tile pixels (origin top-left)   (0,24) (64,24) (64,64) (0,64)',
    'half tile = (32, 32)',
    'Godot, from the tile centre              (-32,-8) (32,-8) (32,32) (-32,32)',
    'importer  TileData.set_collision_polygon_points(0, 0, points)   physics layer 0, polygon 0',
    'TileSet   physics layer 0: collision_layer 1, collision_mask 1'],
    after:'A `CharacterBody2D` stands on this tile only if its `collision_mask` includes layer 1; change the TileSet\'s layer numbers after import if your project uses others.'},
   outputs:{lead:'Collision travels inside the Godot files of the export:',rows:[
    ['nerulio-tileset.json','`physicsLayers` (collision layer 1, mask 1, the mode used) and, per tile, `collision`: polygons in tile pixels.'],
    ['nerulio_tileset_import.gd','Adds the physics layer and writes each polygon with the half-tile shift; its Output line counts the polygons.'],
    ['nerulio-tileset.tres','Saved by Godot when the script runs: the TileSet with terrains and collision.']]},
   target:{title:'Get the collision into Godot and test it',steps:[
    'In Nerulio\'s Export panel set Collision (Godot) to Outline polygon, Exact rectangles, Box or Only edited shapes. The default is None, which writes no physics layer at all — even for shapes you edited.',
    'Copy the PNG, JSON and script to the project root, run the script with File › Run, and check the Output line, for example `… 47 tiles, 188 peering bits, 47 collision polygons …`.',
    'Load `nerulio-tileset.tres` into a `TileMapLayer`\'s Tile Set property and paint.',
    'Give your player body a `collision_mask` that includes layer 1 (or change physics layer 0\'s collision layer in the TileSet inspector to the layer your project uses).',
    'Turn on Debug › Visible Collision Shapes and run the scene: the shapes are drawn over the tiles while the game runs.',
    'One-way platforms or a physics material: in the TileSet editor, Select mode, click the tile and edit its Physics Layer 0 section; press F there for a quick full-tile rectangle.']},
   verify:{steps:[
    'The script\'s Output line counts as many collision polygons as you expect (one per tile for Box and most Outline shapes).',
    'TileSet editor › Select mode › click a tile: the Physics Layer 0 section shows the polygon on the art.',
    'With Visible Collision Shapes on, the top edges of neighbouring ground tiles form one continuous line, and a tile with a gap shows the gap when you used Exact rectangles.',
    '`print($TileMapLayer.tile_set.get_physics_layer_collision_layer(0))` prints 1.']},
   trouble:{rows:[
    ['The TileSet has no physics layer','Collision (Godot) was left on None in the export','Output line: 0 collision polygons','Choose a collision mode and export again'],
    ['The player falls through the tiles','The body\'s mask does not include layer 1, or the layer\'s `collision_enabled` is off','Inspector of the body and of the `TileMapLayer`','Add layer 1 to the mask, or set the TileSet\'s physics layer to your project\'s layer'],
    ['Shapes sit half a tile up and left','The polygons came from a tool that wrote top-left coordinates without the shift','Visible Collision Shapes','Re-import with Nerulio\'s script, which applies the shift'],
    ['A tile with an opening is fully solid','Outline keeps only the outer loop','The tile\'s polygon in the TileSet editor','Use Exact rectangles for that set, or edit that tile\'s points'],
    ['The character catches on seams between tiles','Neighbouring polygons end at different heights by a pixel','Visible Collision Shapes, zoomed in on the seam','Use Box or Exact rectangles for full tiles, or drag the points level in the Studio\'s collision tool (C)'],
    ['Some tiles have no shape','Only tiles with terrain bits are exported, and an alpha of 0 everywhere gives no shape','Studio: tiles without bits are dimmed','Paint bits for those tiles, or draw their shape by hand in Godot']]},
   alternatives:{rows:[
    ['Draw the polygons in Godot\'s TileSet editor (F for a full rectangle, then add or remove points; tile property painting copies one shape onto many tiles)','Full blocks and a few slopes; no extra tool, but each shape is placed by hand.'],
    ['Sprite collision instead of tiles: [[game/collision-polygon-generator|collision polygon generator]]','The shape belongs to a character or prop, not to a tile in a TileSet.'],
    ['Unity Rule Tiles with Collider set to Grid: [[game/unity-rule-tile|Unity Rule Tile]]','Your target is Unity; Nerulio\'s traced polygons are written for Godot only.']]},
   limits:['One physics layer, plain polygons: one-way flags, extra layers and physics materials are set in Godot afterwards.','Holes are exact only with Exact rectangles.','Tiles without terrain bits get no collision in the export.'],
   versions:{body:['Checked in Godot 4.7.2 by reading the saved TileSet back: every polygon matched point for point after the half-tile shift — 49/49, 48/48 and 47/47 tiles on the corpus blob sets, 16/16 on the edge and corner templates, 80/80 on a four-terrain dual-grid pack. Editor steps follow the Godot 4.7 documentation.'],sources:[GODOT_TILESETS,GODOT_TILEDATA,GODOT_TILESET,GODOT_LAYER,GODOT_DEBUG]}
  },
  ko:{
   answer:'Godot 4에서 타일 충돌은 TileSet에 들어 있습니다. 물리 레이어(충돌 레이어와 마스크)를 추가하고 타일마다 충돌 폴리곤을 하나 이상 주며, 점 좌표는 타일 중심에서 잽니다. Nerulio는 타일마다 알파에서 폴리곤을 따고(외곽선, 정확한 사각형들, 상자 하나) 점을 옮길 수 있게 하며, 가져오기 스크립트가 충돌 레이어 1·마스크 1인 물리 레이어 0을 만들고 모든 폴리곤을 반 타일만큼 옮겨 씁니다. Godot 4.7.2에서 모든 폴리곤을 점 하나까지 다시 읽어 확인했습니다.',
   concept:{title:'물리 레이어, 폴리곤, 그리고 타일 중심',body:[
    'TileSet에는 물리 레이어 목록이 있고, 레이어마다 충돌 레이어·충돌 마스크·선택적인 물리 재질이 있습니다(Godot 문서: TileSet 인스펙터 › Physics Layers › Add Element). 레이어마다 타일 하나가 폴리곤 여러 개를 가질 수 있고(`TileData.set_collision_polygon_points(layer, index, points)`), 각각 단방향으로 만들 수도 있습니다. `TileMapLayer`는 `collision_enabled`가 켜져 있으면(기본값) 칠한 타일을 정적 충돌로 만듭니다.',
    'Nerulio는 모양을 그리는 방식 그대로 타일 픽셀 단위, 원점은 타일 왼쪽 위로 저장합니다. Godot는 타일 폴리곤을 타일 중심에서 재므로, 가져오기 스크립트가 모든 점에서 타일 크기의 절반을 뺍니다. 이 이동을 빠뜨리는 도구를 쓰면 모든 모양이 왼쪽 위로 반 타일 밀립니다.',
    '알파를 읽는 방식은 세 가지입니다(알파가 0보다 크면 불투명으로 봄). 외곽선은 픽셀 경계를 따라 불투명한 가장자리를 따가며 바깥 고리만 남기므로 구멍은 막힙니다. 정확한 사각형들은 불투명 픽셀만 사각형 몇 개로 덮어 구멍이 열린 채 남습니다. 상자는 전체를 사각형 하나로 감쌉니다. 긴 외곽선은 점이 256개 이하가 될 때까지 단순화합니다.'],
    terms:[['물리 레이어','충돌 레이어·마스크·재질을 가진 TileSet의 칸. 타일은 칸마다 폴리곤을 저장합니다.'],['충돌 폴리곤','타일 중심 기준 점 목록. 안쪽 전체가 막힌 곳으로 취급됩니다.'],['충돌 레이어 / 마스크','타일이 속한 레이어와 감지하는 레이어. 몸체의 마스크에 타일의 레이어가 있어야 부딪힙니다.'],['반 타일 이동','왼쪽 위 기준 타일 픽셀 − (너비 ÷ 2, 높이 ÷ 2) = Godot의 중심 기준 좌표.']]},
   example:{title:'예시: 64px 땅 타일, 픽셀에서 Godot까지',lines:[
    '64 × 64 타일, 아래 40px이 땅(픽셀 행 24–63)',
    'Nerulio, 타일 픽셀(원점 왼쪽 위)   (0,24) (64,24) (64,64) (0,64)',
    '반 타일 = (32, 32)',
    'Godot, 타일 중심 기준              (-32,-8) (32,-8) (32,32) (-32,32)',
    '가져오기  TileData.set_collision_polygon_points(0, 0, points)   물리 레이어 0, 폴리곤 0',
    'TileSet   물리 레이어 0: collision_layer 1, collision_mask 1'],
    after:'`CharacterBody2D`는 `collision_mask`에 레이어 1이 있어야 이 타일 위에 섭니다. 프로젝트가 다른 레이어 번호를 쓰면 가져온 뒤 TileSet의 번호를 바꾸세요.'},
   outputs:{lead:'충돌은 내보내기의 Godot 파일 안에 들어갑니다.',rows:[
    ['nerulio-tileset.json','`physicsLayers`(충돌 레이어 1, 마스크 1, 사용한 방식)와 타일마다 `collision`: 타일 픽셀 단위 폴리곤.'],
    ['nerulio_tileset_import.gd','물리 레이어를 추가하고 폴리곤마다 반 타일 이동을 적용해 씁니다. 출력 줄에 폴리곤 수가 나옵니다.'],
    ['nerulio-tileset.tres','스크립트를 실행하면 Godot가 저장하는, 지형과 충돌이 든 TileSet.']]},
   target:{title:'충돌을 Godot로 가져와 시험하기',steps:[
    'Nerulio 내보내기 패널에서 Collision (Godot)를 외곽선 다각형, 정확한 사각형들, 상자, 직접 고친 모양만 중 하나로 고릅니다. 기본값 None은 물리 레이어를 전혀 쓰지 않으며, 직접 고친 모양도 빠집니다.',
    'PNG·JSON·스크립트를 프로젝트 루트에 복사하고 File › Run으로 스크립트를 실행한 뒤 출력 줄을 확인합니다(예: `… 47 tiles, 188 peering bits, 47 collision polygons …`).',
    '`TileMapLayer`의 Tile Set 속성에 `nerulio-tileset.tres`를 넣고 칠합니다.',
    '플레이어 몸체의 `collision_mask`에 레이어 1을 넣습니다(또는 TileSet 인스펙터에서 물리 레이어 0의 충돌 레이어를 프로젝트가 쓰는 번호로 바꿈).',
    'Debug › Visible Collision Shapes를 켜고 씬을 실행하면, 게임이 도는 동안 타일 위에 충돌 모양이 그려집니다.',
    '단방향 발판이나 물리 재질은 TileSet 편집기 Select 모드에서 타일을 눌러 Physics Layer 0 섹션을 고칩니다. 거기서 F를 누르면 타일 전체 사각형이 바로 생깁니다.']},
   verify:{steps:[
    '스크립트 출력 줄의 충돌 폴리곤 수가 예상과 같아야 합니다(상자와 대부분의 외곽선은 타일마다 하나).',
    'TileSet 편집기 › Select 모드에서 타일을 누르면 Physics Layer 0 섹션에 그림 위의 폴리곤이 보입니다.',
    'Visible Collision Shapes를 켜면 이웃한 땅 타일들의 윗변이 한 줄로 이어지고, 정확한 사각형들을 쓴 틈 있는 타일은 틈이 보여야 합니다.',
    '`print($TileMapLayer.tile_set.get_physics_layer_collision_layer(0))`가 1을 출력합니다.']},
   trouble:{rows:[
    ['TileSet에 물리 레이어가 없음','내보내기에서 Collision (Godot)를 None으로 둠','출력 줄의 0 collision polygons','충돌 방식을 골라 다시 내보내기'],
    ['캐릭터가 타일을 통과해 떨어짐','몸체 마스크에 레이어 1이 없거나 레이어의 `collision_enabled`가 꺼짐','몸체와 `TileMapLayer`의 인스펙터','마스크에 레이어 1을 추가하거나 TileSet 물리 레이어를 프로젝트 레이어로 바꾸기'],
    ['모양이 왼쪽 위로 반 타일 밀림','왼쪽 위 좌표를 이동 없이 쓴 도구에서 온 폴리곤','Visible Collision Shapes','이동을 적용하는 Nerulio 스크립트로 다시 가져오기'],
    ['뚫린 타일이 전부 막힘','외곽선은 바깥 고리만 남김','TileSet 편집기의 타일 폴리곤','그 세트는 정확한 사각형들로 하거나 그 타일의 점을 고치기'],
    ['캐릭터가 타일 이음새에 걸림','이웃 폴리곤의 높이가 1픽셀 차이 남','Visible Collision Shapes로 이음새를 확대','가득 찬 타일은 상자나 정확한 사각형들을 쓰거나, Studio 충돌 도구(C)에서 점 높이를 맞추기'],
    ['일부 타일에 모양이 없음','지형 비트가 있는 타일만 내보내며, 알파가 모두 0이면 모양이 없음','Studio에서 비트 없는 타일은 흐리게 표시됨','그 타일에 비트를 칠하거나 Godot에서 직접 모양을 그리기']]},
   alternatives:{rows:[
    ['Godot TileSet 편집기에서 폴리곤 그리기(F로 전체 사각형, 점 추가·삭제, 타일 속성 칠하기로 한 모양을 여러 타일에 복사)','가득 찬 블록과 경사 몇 개일 때. 도구는 필요 없지만 모양마다 손으로 놓습니다.'],
    ['타일이 아닌 스프라이트 충돌: [[game/collision-polygon-generator|충돌 폴리곤 생성기]]','모양이 TileSet 타일이 아니라 캐릭터나 소품에 속할 때.'],
    ['Collider를 Grid로 둔 Unity Rule Tile: [[game/unity-rule-tile|Unity Rule Tile]]','대상이 Unity일 때. Nerulio가 딴 폴리곤은 Godot용으로만 씁니다.']]},
   limits:['물리 레이어 하나, 단순 폴리곤: 단방향, 추가 레이어, 물리 재질은 나중에 Godot에서 설정합니다.','구멍은 정확한 사각형들에서만 정확합니다.','지형 비트가 없는 타일은 내보내기에서 충돌이 없습니다.'],
   versions:{body:['Godot 4.7.2에서 저장된 TileSet을 다시 읽어 확인했습니다. 반 타일 이동 뒤 모든 폴리곤이 점 단위로 같았습니다. 코퍼스 블롭 세트에서 49/49, 48/48, 47/47타일, 변·모서리 템플릿에서 16/16, 지형 4개짜리 듀얼 그리드 팩에서 80/80. 편집기 단계는 Godot 4.7 공식 문서를 따릅니다.'],sources:[GODOT_TILESETS,GODOT_TILEDATA,GODOT_TILESET,GODOT_LAYER,GODOT_DEBUG]}
  },
  ja:{
   answer:'Godot 4では、タイルの衝突はTileSetにあります。物理レイヤー（衝突レイヤーとマスク）を追加し、タイルごとに1つ以上の衝突ポリゴンを与えます。点の座標はタイルの中心から測ります。Nerulioはタイルごとにアルファからポリゴンを取り（外形、正確な矩形群、ボックス1つ）、点を動かせるようにし、インポートスクリプトが衝突レイヤー1・マスク1の物理レイヤー0を作り、各ポリゴンを半タイルずらして書き込みます。Godot 4.7.2で全ポリゴンを点単位で読み戻して確認しました。',
   concept:{title:'物理レイヤー、ポリゴン、タイルの中心',body:[
    'TileSetには物理レイヤーのリストがあり、レイヤーごとに衝突レイヤー・衝突マスク・任意の物理マテリアルを持ちます（Godotのドキュメント：TileSetインスペクター › Physics Layers › Add Element）。レイヤーごとに1枚のタイルが複数のポリゴンを持てて（`TileData.set_collision_polygon_points(layer, index, points)`）、それぞれ一方通行にもできます。`TileMapLayer`は`collision_enabled`が有効（既定）なら、塗ったタイルを静的な衝突にします。',
    'Nerulioは形状を描いたとおりに、タイルのピクセル単位・原点はタイル左上で保存します。Godotはタイルのポリゴンを中心から測るので、インポートスクリプトが全点からタイルサイズの半分を引きます。このずらしを忘れるツールでは、すべての形状が左上に半タイルずれます。',
    'アルファの読み方は3通りです（アルファが0より大きければ不透明とみなします）。外形はピクセルの境界に沿って不透明な縁をなぞり、外側のループだけを残すので穴は埋まります。正確な矩形群は不透明なピクセルだけを数個の矩形で覆い、穴は開いたままです。ボックスは全体を1つの矩形で囲みます。長い外形は点が256個以下になるまで単純化します。'],
    terms:[['物理レイヤー','衝突レイヤー・マスク・マテリアルを持つTileSetの枠。タイルは枠ごとにポリゴンを持ちます。'],['衝突ポリゴン','タイル中心基準の点のリスト。内側全体がふさがった場所になります。'],['衝突レイヤー／マスク','タイルが属するレイヤーと検出するレイヤー。ボディのマスクにタイルのレイヤーが含まれていればぶつかります。'],['半タイルのずらし','左上基準のタイルピクセル −（幅 ÷ 2、高さ ÷ 2）= Godotの中心基準の座標。']]},
   example:{title:'例：64pxの地面タイル、ピクセルからGodotまで',lines:[
    '64 × 64タイル、下の40pxが地面（ピクセル行24–63）',
    'Nerulio、タイルのピクセル（原点は左上）   (0,24) (64,24) (64,64) (0,64)',
    '半タイル = (32, 32)',
    'Godot、タイル中心基準                     (-32,-8) (32,-8) (32,32) (-32,32)',
    'インポート  TileData.set_collision_polygon_points(0, 0, points)   物理レイヤー0、ポリゴン0',
    'TileSet     物理レイヤー0: collision_layer 1, collision_mask 1'],
    after:'`CharacterBody2D`は`collision_mask`にレイヤー1が含まれているときだけこのタイルの上に立ちます。プロジェクトが別のレイヤー番号を使うなら、インポート後にTileSetの番号を変えてください。'},
   outputs:{lead:'衝突は書き出しのGodotファイルの中に入ります。',rows:[
    ['nerulio-tileset.json','`physicsLayers`（衝突レイヤー1、マスク1、使った方式）と、タイルごとの`collision`：タイルピクセル単位のポリゴン。'],
    ['nerulio_tileset_import.gd','物理レイヤーを追加し、各ポリゴンを半タイルずらして書き込みます。出力行にポリゴン数が出ます。'],
    ['nerulio-tileset.tres','スクリプト実行時にGodotが保存する、地形と衝突入りのTileSet。']]},
   target:{title:'衝突をGodotに取り込んで試す',steps:[
    'Nerulioの書き出しパネルでCollision (Godot)を外形ポリゴン、正確な矩形群、ボックス、編集した形状のみのいずれかにします。既定のNoneでは物理レイヤーがまったく書かれず、編集した形状も含まれません。',
    'PNG・JSON・スクリプトをプロジェクトのルートにコピーし、File › Runでスクリプトを実行して出力行を確認します（例：`… 47 tiles, 188 peering bits, 47 collision polygons …`）。',
    '`TileMapLayer`のTile Setプロパティに`nerulio-tileset.tres`を設定して塗ります。',
    'プレイヤーのボディの`collision_mask`にレイヤー1を含めます（またはTileSetインスペクターで物理レイヤー0の衝突レイヤーをプロジェクトの番号に変えます）。',
    'Debug › Visible Collision Shapesを有効にしてシーンを実行すると、ゲーム実行中にタイルの上へ衝突形状が描かれます。',
    '一方通行の足場や物理マテリアルは、TileSetエディターのSelectモードでタイルをクリックしてPhysics Layer 0セクションを編集します。そこでFを押すとタイル全体の矩形がすぐできます。']},
   verify:{steps:[
    'スクリプトの出力行の衝突ポリゴン数が想定どおりであること（ボックスとほとんどの外形はタイルごとに1つ）。',
    'TileSetエディター › Selectモードでタイルをクリックすると、Physics Layer 0セクションに絵の上のポリゴンが表示されます。',
    'Visible Collision Shapesを有効にすると、隣り合う地面タイルの上辺が1本の線につながり、正確な矩形群を使った隙間のあるタイルでは隙間が見えるはずです。',
    '`print($TileMapLayer.tile_set.get_physics_layer_collision_layer(0))`が1を出力します。']},
   trouble:{rows:[
    ['TileSetに物理レイヤーがない','書き出しでCollision (Godot)をNoneのままにした','出力行の0 collision polygons','衝突の方式を選んで書き出し直す'],
    ['キャラクターがタイルをすり抜けて落ちる','ボディのマスクにレイヤー1がない、またはレイヤーの`collision_enabled`がオフ','ボディと`TileMapLayer`のインスペクター','マスクにレイヤー1を加えるか、TileSetの物理レイヤーをプロジェクトのレイヤーにする'],
    ['形状が左上に半タイルずれる','左上基準の座標をずらさずに書くツールから来たポリゴン','Visible Collision Shapes','ずらしを行うNerulioのスクリプトで取り込み直す'],
    ['穴のあるタイルが全部ふさがる','外形は外側のループだけを残す','TileSetエディターのタイルのポリゴン','そのセットは正確な矩形群にするか、そのタイルの点を直す'],
    ['キャラクターがタイルの継ぎ目に引っかかる','隣のポリゴンの高さが1ピクセル違う','Visible Collision Shapesで継ぎ目を拡大','全面タイルはボックスか正確な矩形群にするか、Studioの衝突ツール（C）で点の高さをそろえる'],
    ['一部のタイルに形状がない','地形ビットのあるタイルだけを書き出し、アルファがすべて0だと形状はできない','Studioではビットのないタイルが暗く表示される','そのタイルにビットを塗るか、Godotで手で形状を描く']]},
   alternatives:{rows:[
    ['GodotのTileSetエディターでポリゴンを描く（Fで全体の矩形、点の追加・削除、タイルプロパティペイントで1つの形状を多数のタイルへ）','全面ブロックと少しの坂だけのとき。ツールは要りませんが、形状は1つずつ手で置きます。'],
    ['タイルではなくスプライトの衝突：[[game/collision-polygon-generator|衝突ポリゴンジェネレーター]]','形状がTileSetのタイルではなく、キャラクターや小物のものであるとき。'],
    ['ColliderをGridにしたUnityのRule Tile：[[game/unity-rule-tile|UnityのRule Tile]]','対象がUnityのとき。Nerulioで取ったポリゴンはGodot向けにだけ書かれます。']]},
   limits:['物理レイヤーは1つ、単純なポリゴンのみ：一方通行、追加レイヤー、物理マテリアルは後でGodotで設定します。','穴が正確になるのは正確な矩形群だけです。','地形ビットのないタイルは、書き出しで衝突を持ちません。'],
   versions:{body:['Godot 4.7.2で、保存したTileSetを読み戻して確認しました。半タイルのずらしの後、全ポリゴンが点単位で一致しました。コーパスのブロブセットで49/49、48/48、47/47タイル、辺・角のテンプレートで16/16、4地形のデュアルグリッドパックで80/80。エディターの手順はGodot 4.7の公式ドキュメントに基づきます。'],sources:[GODOT_TILESETS,GODOT_TILEDATA,GODOT_TILESET,GODOT_LAYER,GODOT_DEBUG]}
  }
 },
};
