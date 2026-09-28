/** Intent content for the tile-core pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/tiles/{patterns,layouts,identify,generator,godot-terrain,tiled,ldtk,unity}.js,
 * src/game/tile-grid.js (tileRects, detectGrid), src/game/autotile.js, src/studio/workspaces/tile/
 * (state.js: map size, resolve.js: problems, tile-worker.js, verify-status.js), docs/STUDIO-TILE.md
 * (corpus table, competitors 2026-09-23), docs/TILE-LAB.md. Grid numbers for the Kenney sheets were
 * measured with detectGrid on the corpus files (2026-09-28). Engine and tool behaviour: the official
 * docs cited in each page's `versions.sources`. */
const src=(label,url)=>`[${label}](${url})`;
const U={
 godotTilesets:'https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html',
 godotTilemaps:'https://docs.godotengine.org/en/stable/tutorials/2d/using_tilemaps.html',
 godotLayer:'https://docs.godotengine.org/en/stable/classes/class_tilemaplayer.html',
 tiledTerrain:'https://doc.mapeditor.org/en/stable/manual/terrain/',
 tiledTilesets:'https://doc.mapeditor.org/en/stable/manual/editing-tilesets/',
 tiledHome:'https://www.mapeditor.org/',
 unityRule:'https://docs.unity3d.com/Packages/com.unity.2d.tilemap.extras@8.0/manual/RuleTile.html',
 ldtkAuto:'https://ldtk.io/docs/general/auto-layers/',
 ldtkHome:'https://ldtk.io/',
 sfAutotile:'https://www.spritefusion.com/docs/tilemap-editor/editor/autotile-system',
 sfExport:'https://www.spritefusion.com/docs/tilemap-editor/exporting-maps/export-overview',
 sfImport:'https://www.spritefusion.com/docs/tilemap-editor/editor/importing-tilesets',
 sfLayers:'https://www.spritefusion.com/docs/tilemap-editor/editor/layers-and-collisions',
 sfHome:'https://www.spritefusion.com/'
};
const L={en:{g:'Godot 4.7 docs',t:'Tiled docs',u:'Unity 2D Tilemap Extras 8.0 manual',l:'LDtk docs',s:'Sprite Fusion docs'},
 ko:{g:'Godot 4.7 문서',t:'Tiled 문서',u:'Unity 2D Tilemap Extras 8.0 매뉴얼',l:'LDtk 문서',s:'Sprite Fusion 문서'},
 ja:{g:'Godot 4.7ドキュメント',t:'Tiledドキュメント',u:'Unity 2D Tilemap Extras 8.0マニュアル',l:'LDtkドキュメント',s:'Sprite Fusionドキュメント'}};
const S=Object.fromEntries(Object.entries(L).map(([k,l])=>[k,{
 godotTilesets:src(`${l.g}: Using TileSets`,U.godotTilesets),
 godotTilemaps:src(`${l.g}: Using TileMaps`,U.godotTilemaps),
 godotLayer:src(`${l.g}: TileMapLayer`,U.godotLayer),
 tiledTerrain:src(`${l.t}: Terrain`,U.tiledTerrain),
 tiledTilesets:src(`${l.t}: Working with tilesets`,U.tiledTilesets),
 tiledHome:src('Tiled (mapeditor.org)',U.tiledHome),
 unityRule:src(`${l.u}: Rule Tile`,U.unityRule),
 ldtkAuto:src(`${l.l}: Auto-layers`,U.ldtkAuto),
 ldtkHome:src('LDtk (ldtk.io)',U.ldtkHome),
 sfAutotile:src(`${l.s}: Autotile system`,U.sfAutotile),
 sfExport:src(`${l.s}: Export overview`,U.sfExport),
 sfImport:src(`${l.s}: Importing tilesets`,U.sfImport),
 sfLayers:src(`${l.s}: Layers and collisions`,U.sfLayers),
 sfHome:src('Sprite Fusion (spritefusion.com)',U.sfHome)
}]));
export default {
 'game/tile-lab':{
  type:'create',
  intent:{primary:'turn an autotile tileset image into terrain rules an engine uses (peering bits, Wang IDs, Rule Tiles)',secondary:['which 47-tile layout is my sheet','check that no combination is missing','test the rules before the engine','export for Godot 4, Tiled, Unity, LDtk'],
   goal:'a tileset whose every tile carries correct terrain bits, checked complete, exported as files the engine builds its autotiling from',input:'PNG tileset (any autotile layout, several blocks or terrains allowed)',output:'ZIP per engine: Godot 4 importer + JSON, Tiled .tsx + sample.tmx, LDtk .ldtk, Unity RuleTile JSON + editor script, generic tileset.json',target:'Godot 4 (4.7.2), Tiled (1.12.2), Unity 6 (6000.5.3f1), LDtk (1.5.3 schema)',support:'full',
   evidence:['docs/STUDIO-TILE.md (layout identification, corpus table 2026-09-23, exports)','src/game/tiles/identify.js (AUC, confidenceOf: 0.97 / 0.88 / margin 0.03)','src/game/tiles/layouts.js (12 layouts)','src/studio/workspaces/tile/verify-status.js'],
   external:['Godot 4.7 docs: Using TileSets (terrain set modes, peering bits)','Tiled docs: Terrain (corner, edge, mixed sets)','Unity 2D Tilemap Extras 8.0: Rule Tile','LDtk docs: Auto-layers']},
  en:{
   answer:'An autotile sheet is only a picture until every tile says which neighbours it connects to — Godot calls these terrain peering bits, Tiled calls them Wang IDs, Unity writes them as Rule Tile neighbours. Tile Lab (the Tile workspace of Nerulio Studio) takes a PNG sheet, measures its grid, recognises which of 12 published layouts it is from the seams between tiles, writes the bits, lists missing combinations and paints a test map with Godot\'s or Tiled\'s rule. The export was built and painted in Godot 4.7.2, Tiled 1.12.2 and Unity 6000.5.3f1; the LDtk file was checked against the 1.5.3 schema and loader.',
   concept:{title:'How the layout is recognised from the pixels, and when it fails',body:[
    'A layout is a table: for each cell of the sheet, the neighbour mask that tile stands for. The same 47 blob tiles are published in at least five incompatible orders (cr31 ascending 8×6, wang blob 7×7, caeles, GameMaker, the Godot 3 12×4 template), and nothing in a PNG says which one you have. Apply the wrong table and every tile lands in the wrong rule.',
    'So the workspace tests each table against the art. If a layout says tile A connects on its right and tile B connects on its left, A|B must join without a visible seam; if only one of them connects, the layout promises a break. For every neighbouring pair it compares the pixels across the shared edge (split into the two corner segments and the middle), and scores the layout by the probability that a "should be seamless" pair really is smoother than a "should break" pair — the ROC AUC, where 1.0 is perfect and 0.5 means the pixels say nothing. Only edge pixels count, so slot numbers printed on template tiles do not disturb it.',
    'Every layout is tried at every position on small sheets and on its own block grid on sheets above 400 cells: a quick sampled pass, then a full pass for the best six placements. Confidence is high when the AUC is at least 0.97, no cell of the layout is blank and it leads the next different reading by at least 0.03; medium from an AUC of 0.88 with at most one blank cell; anything else is low. Nothing is written until you press Apply.',
    'It fails in predictable places: seamless art where every piece looks alike (an RPG Maker A2 floor scored 0.5), heavily textured art (the 64 px cave set scored 0.964, still all 47 tiles right), a layout that is not in the list (Tilesetter\'s output order is not published), and sheets that are not autotile sets at all. Then you paint the bits yourself or let the workspace suggest them from the pixels as a preview.'],
    terms:[['Peering bit','Godot 4\'s name for the terrain a tile expects at one of its 8 neighbour positions; Tiled stores the same idea as a Wang ID, Unity as a Rule Tile neighbour rule.'],['Layout','The order in which a sheet stores its tiles: which neighbour mask sits in which cell.'],['Seam AUC','How cleanly a layout\'s "seamless" pairs beat its "broken" pairs on edge pixel difference: 1.0 perfect, 0.5 no information.'],['Match mode','Which neighbours count: corners and sides (47-tile blob), sides only (16 edge tiles), corners only (16 corner / dual-grid tiles).']]},
   example:{title:'What identification said about real sheets',lead:'Corpus run of 2026-09-23 (docs/STUDIO-TILE.md), grid and layout found from the pixels with no hints:',lines:[
    'Sheet                              Detected as               Confidence  Seam AUC  Bits right',
    'GameMaker 47 template              GameMaker 47              high        1.000     47/47',
    'caeles template 7×7                caeles 7×7                high        1.000     49/49',
    'Tiled wangblob example             wang blob 7×7             high        1.000     49/49',
    'cave platformer 47 (64 px art)     GameMaker 47              medium      0.964     47/47',
    'Wang S-V2 (corner template)        corner16 cr31             high        1.000     16/16',
    'coolschool A2 (seamless floor)     nothing from the pixels   low         0.5       size hint → assembled',
    'Kenney tiny dungeon (no autotile)  low, or a 3×3 box with the warning "only part of the sheet: 9 of N tiles"',
    '',
    'Godot 4.7.2 painting the exported sets: 485 of 485 test cells equal the Studio\'s prediction on each blob set.'],
    after:'The cave set is the typical real case: textured rock makes the edges noisier, so the AUC drops below 0.97 and the result is labelled medium even though every tile is right. Read the confidence as "how much to double-check", then confirm with the test map.'},
   verify:{title:'Check the result before you export',steps:[
    'Check panel: it says Complete only when every combination has a tile, no tile has a corner bit behind an open side, and the art-vs-bits check was measured and found nothing. "Not measured" is shown as such, never as a tick.',
    'Missing combinations appear as ghost tiles with their mask; draw exactly those, or generate them with the [[game/tileset-generator|tileset generator]].',
    'Press M and look at the starter island with the Godot rule, then the Tiled rule: outlined cells are where the engine would leave a hole or substitute a tile ([[game/autotile-tester|what the outlines mean]]).',
    'After export, paint the same shapes in the engine: in Godot 4 run the shipped `nerulio_tileset_import.gd` (File › Run), assign the saved `nerulio-tileset.tres` to a TileMapLayer and paint with the Terrains tab; details in [[game/godot-autotile|Godot 4 autotile]].']},
   trouble:{rows:[
    ['The top layout candidate is low, or plainly wrong','Seamless or heavily textured art, or a layout that is not one of the 12 known ones','Read its seam AUC and the warning "explains only part of the sheet"','Paint the bits with the Bits tool (B), or select the full tile and use Suggest bits from pixels, then accept the preview'],
    ['Candidates show twice or half the real tile size','A multiple of the true tile explains the same edges (a 64×32 cell made of eight 16×16 tiles)','The dashed grid preview cuts through drawn tiles, or cols × rows is not 8×6, 7×7, 4×4 or 12×4','Pick the candidate whose cols × rows matches a layout, or type the tile size'],
    ['Check lists "corner bits behind open sides"','A corner bit was set where one of its two sides is open: no map ever needs that tile','Click the listed tile; the 3×3 bit editor shows the corner and the open side','Clear the corner bit or connect the side; one click each, one undo step'],
    ['The art check flags exactly two tiles','Two tiles are swapped in the sheet compared with the layout','The art check lists both tiles by position; the drawn rims of each contradict its bits','Swap their bits (copy / paste bits) or fix the order in the sheet and re-import'],
    ['An RPG Maker sheet gets no layout at all','A2 / A4 sheets hold the pieces tiles are assembled from, not the tiles; a seamless floor scores 0.5','A size hint appears, e.g. 768×576 = RPG Maker A2 at 48 px','Use "Assemble from this block"; see [[game/rpg-maker-autotile-to-godot|RPG Maker autotiles in Godot]]']]},
   alternatives:{rows:[
    ['Godot\'s own TileSet editor: select tiles in Select mode and set the Terrain Peering Bits by hand','A small set in an unusual layout that only you use; nothing to install, and you see Godot\'s own UI while you learn it.'],
    ['Tiled\'s terrain set editor','Your levels live in Tiled and you mark Wang colours there anyway; [[game/tiled-wang-set|Tiled Wang sets]] shows what the export writes.'],
    ['LDtk auto-layer rules','You build levels in LDtk and want its rule editor (rules on an IntGrid layer) rather than per-tile bits; see [[game/ldtk-autotile-rules|LDtk autotile rules]].'],
    ['A base-block generator such as Blobsmith, or Nerulio\'s own generator','You have not drawn 47 tiles yet: draw a 2×3 base and assemble the rest ([[game/tileset-generator|tileset generator]]).']]},
   limits:['Isometric and hexagonal tiles, animated tiles, alternative tiles, occlusion and navigation layers are not handled.','Tiled\'s terrain brush, the LDtk app and Godot\'s editor painter were not driven; the checks used their file readers and `set_cells_terrain_connect`.','Rules for more than two terrains meeting at one point are only as complete as the art.'],
   versions:{body:['Verified by Nerulio (docs/STUDIO-TILE.md, 2026-09-23, Windows 11): Godot 4.7.2.stable.official built the TileSet with the shipped importer and painted every corpus map exactly as the Studio predicted; Tiled 1.12.2 read every Wang ID as written; Unity 6000.5.3f1 with 2D Tilemap Extras 8.0.3 built the Rule Tiles and matched in every cell; LDtk only against the 1.5.3 JSON schema and the official loader. Engine concepts above follow the linked documentation.'],sources:[S.en.godotTilesets,S.en.tiledTerrain,S.en.unityRule,S.en.ldtkAuto]}
  },
  ko:{
   answer:'오토타일 시트는 각 타일이 어느 이웃과 이어지는지 적혀 있기 전까지는 그냥 그림입니다. 고도 엔진은 이것을 지형 피어링 비트, Tiled는 Wang ID, 유니티는 룰 타일의 이웃 규칙으로 저장합니다. 타일 작업실(Nerulio Studio의 타일 작업 공간)은 PNG 시트의 격자를 재고, 타일 사이 이음새를 보고 공개된 배치 12가지 중 어느 것인지 알아낸 뒤 비트를 적고, 빠진 조합을 찾고, 고도나 Tiled 규칙으로 테스트 맵을 칠합니다. 내보낸 파일은 Godot 4.7.2, Tiled 1.12.2, Unity 6000.5.3f1에서 실제로 불러와 칠해 봤고, LDtk 파일은 1.5.3 스키마와 공식 로더로 확인했습니다.',
   concept:{title:'픽셀에서 배치를 알아내는 방법과 실패하는 경우',body:[
    '배치란 시트의 칸마다 그 타일이 나타내는 이웃 마스크를 적은 표입니다. 같은 블롭 47장도 서로 호환되지 않는 순서가 적어도 다섯 가지(cr31 오름차순 8×6, wang blob 7×7, caeles, 게임메이커, 고도 3의 12×4 템플릿)나 되고, PNG 안에는 어느 순서인지 적혀 있지 않습니다. 표를 잘못 고르면 모든 타일이 엉뚱한 규칙에 들어갑니다.',
    '그래서 작업 공간은 표마다 그림과 맞는지 시험합니다. 어떤 배치가 "A는 오른쪽이 이어지고 B는 왼쪽이 이어진다"고 하면 A와 B를 붙였을 때 이음새가 보이지 않아야 하고, 한쪽만 이어진다고 하면 끊겨 보여야 합니다. 이웃한 모든 쌍에서 맞닿는 가장자리 픽셀 차이를 재고(양 끝 모서리 구간과 가운데를 따로), "매끄러워야 할 쌍"이 "끊겨야 할 쌍"보다 실제로 더 매끄러울 확률로 점수를 매깁니다. 이것이 ROC AUC이며 1.0은 완벽, 0.5는 픽셀이 아무 정보도 주지 못한다는 뜻입니다. 가장자리 픽셀만 보므로 템플릿에 인쇄된 번호는 영향을 주지 않습니다.',
    '작은 시트에서는 모든 위치에, 칸이 400개를 넘는 시트에서는 그 배치의 블록 격자에만 대 보며, 표본으로 빠르게 한 번 훑은 뒤 위치별 상위 6개만 전체를 다시 잽니다. 신뢰도는 AUC 0.97 이상이고 빈 칸이 없으며 다른 해석보다 0.03 이상 앞설 때 높음, AUC 0.88 이상이고 빈 칸이 하나 이하면 중간, 나머지는 낮음입니다. 적용을 누르기 전에는 아무것도 기록하지 않습니다.',
    '실패하는 곳도 정해져 있습니다. 모든 조각이 똑같아 보이는 이음새 없는 그림(알만툴 A2 바닥은 0.5), 질감이 강한 그림(64px 동굴 세트는 0.964였지만 47장 모두 맞음), 목록에 없는 배치(Tilesetter의 출력 순서는 공개되지 않음), 애초에 오토타일 세트가 아닌 시트입니다. 이럴 때는 비트를 직접 칠하거나 픽셀에서 비트를 제안받아 미리보기로 확인합니다.'],
    terms:[['피어링 비트','고도 4에서 타일이 8방향 이웃 자리마다 기대하는 지형. Tiled는 같은 개념을 Wang ID로, 유니티는 룰 타일의 이웃 규칙으로 저장합니다.'],['배치(레이아웃)','시트가 타일을 담는 순서. 어느 칸에 어느 이웃 마스크의 타일이 있는지.'],['이음새 AUC','배치가 "이어진다"고 한 쌍이 "끊긴다"고 한 쌍보다 가장자리 픽셀 차이가 얼마나 확실히 작은지. 1.0 완벽, 0.5 정보 없음.'],['매칭 모드','어느 이웃을 볼지: 모서리와 변(블롭 47), 변만(변 타일 16), 모서리만(모서리·듀얼 그리드 16).']]},
   example:{title:'실제 시트에서 나온 인식 결과',lead:'2026-09-23 코퍼스 실행(docs/STUDIO-TILE.md). 힌트 없이 픽셀만으로 격자와 배치를 찾았습니다.',lines:[
    '시트                               인식 결과                  신뢰도      이음새 AUC  맞은 비트',
    'GameMaker 47 템플릿                GameMaker 47              높음        1.000       47/47',
    'caeles 템플릿 7×7                  caeles 7×7                높음        1.000       49/49',
    'Tiled wangblob 예제                wang blob 7×7             높음        1.000       49/49',
    '동굴 플랫포머 47 (64px 실제 그림)  GameMaker 47              중간        0.964       47/47',
    'Wang S-V2 (모서리 템플릿)          corner16 cr31             높음        1.000       16/16',
    'coolschool A2 (이음새 없는 바닥)   픽셀로는 알 수 없음       낮음        0.5         크기 힌트 → 조립',
    'Kenney tiny dungeon (오토타일 아님) 낮음, 또는 "시트 일부만 설명함: 타일 N개 중 9개" 경고가 붙은 3×3 박스',
    '',
    '내보낸 세트를 Godot 4.7.2로 칠한 결과: 블롭 세트마다 테스트 칸 485개 중 485개가 Studio 예측과 같음.'],
    after:'동굴 세트가 전형적인 실제 사례입니다. 바위 질감 때문에 가장자리가 거칠어 AUC가 0.97 아래로 내려가 중간으로 표시되지만 타일은 모두 맞았습니다. 신뢰도는 "얼마나 더 확인할지"로 읽고, 테스트 맵으로 확인하세요.'},
   verify:{title:'내보내기 전에 결과 확인하기',steps:[
    '점검 패널: 모든 조합에 타일이 있고, 열린 변 뒤에 모서리 비트가 있는 타일이 없고, 그림과 비트 점검을 실제로 재서 문제가 없을 때만 완료라고 표시합니다. "측정 못 함"은 체크 표시가 아니라 그대로 적힙니다.',
    '빠진 조합은 마스크와 함께 반투명 타일로 보입니다. 그 타일만 그리거나 [[game/tileset-generator|타일셋 생성기]]로 만드세요.',
    'M을 눌러 시작 섬을 고도 규칙과 Tiled 규칙으로 번갈아 봅니다. 윤곽선이 쳐진 칸은 엔진이 비워 두거나 다른 타일로 대신할 곳입니다([[game/autotile-tester|윤곽선의 의미]]).',
    '내보낸 뒤 엔진에서 같은 모양을 칠해 봅니다. 고도 4에서는 함께 온 `nerulio_tileset_import.gd`를 실행(File › Run)하고, 저장된 `nerulio-tileset.tres`를 TileMapLayer에 지정해 Terrains 탭으로 칠합니다. 자세한 내용은 [[game/godot-autotile|고도 4 오토타일]].']},
   trouble:{rows:[
    ['첫 배치 후보의 신뢰도가 낮거나 명백히 틀림','이음새 없는 그림, 질감이 강한 그림, 또는 알려진 12가지에 없는 배치','이음새 AUC와 "시트 일부만 설명함" 경고를 읽기','비트 도구(B)로 직접 칠하거나, 가득 찬 타일을 고른 뒤 픽셀에서 비트 제안을 받아 미리보기를 적용'],
    ['후보 타일 크기가 실제의 두 배나 절반','실제 타일의 배수도 같은 경계를 설명함(16×16 타일 여덟 장으로 된 64×32 칸)','점선 격자가 그려진 타일을 가로지르거나, 열×행이 8×6·7×7·4×4·12×4가 아님','배치와 열×행이 맞는 후보를 고르거나 타일 크기를 직접 입력'],
    ['점검에 "열린 변 뒤의 모서리 비트"가 뜸','두 변 중 하나가 열린 모서리에 비트를 칠함. 어떤 맵도 그 타일을 쓰지 않음','목록의 타일을 누르면 3×3 비트 편집기에 모서리와 열린 변이 보임','모서리 비트를 지우거나 변을 이음. 각각 한 번 클릭, 되돌리기 한 단계'],
    ['그림 점검이 정확히 타일 두 장을 지적함','배치와 비교해 시트에서 두 타일이 뒤바뀜','그림 점검이 두 타일의 위치를 알려 줌. 각 타일의 그려진 테두리가 자기 비트와 어긋남','비트를 서로 바꾸거나(비트 복사·붙여넣기) 시트 순서를 고쳐 다시 가져오기'],
    ['알만툴 시트에서 배치가 하나도 안 나옴','A2·A4 시트는 타일이 아니라 타일을 조립할 조각을 담음. 이음새 없는 바닥은 0.5','크기 힌트가 뜸(예: 768×576 = 48px 알만툴 A2)','"이 블록으로 조립"을 사용. [[game/rpg-maker-autotile-to-godot|알만툴 오토타일을 고도로]] 참고']]},
   alternatives:{rows:[
    ['고도 자체 TileSet 편집기에서 Select 모드로 타일을 골라 Terrain Peering Bits를 손으로 설정','나만 쓰는 특이한 배치의 작은 세트일 때. 설치할 것이 없고 고도의 화면을 익히는 데도 좋습니다.'],
    ['Tiled의 지형 세트 편집기','레벨을 Tiled에서 만들고 어차피 거기서 Wang 색을 표시할 때. 내보내기가 무엇을 쓰는지는 [[game/tiled-wang-set|Tiled Wang 세트]]에 있습니다.'],
    ['LDtk 오토 레이어 규칙','레벨을 LDtk에서 만들고, 타일별 비트보다 IntGrid 레이어에 거는 규칙 편집기가 편할 때. [[game/ldtk-autotile-rules|LDtk 오토타일 규칙]] 참고.'],
    ['Blobsmith 같은 기본 블록 생성기, 또는 Nerulio 생성기','아직 47장을 그리지 않았을 때. 2×3 기본 블록만 그리고 나머지는 조립합니다([[game/tileset-generator|타일셋 생성기]]).']]},
   limits:['아이소메트릭·육각 타일, 애니메이션 타일, 대체 타일, 차폐·내비게이션 레이어는 다루지 않습니다.','Tiled의 지형 브러시, LDtk 앱, 고도 편집기의 칠하기 도구를 직접 조작하지는 않았습니다. 점검은 파일 읽기 도구와 `set_cells_terrain_connect`로 했습니다.','세 가지 이상의 지형이 한 점에서 만나는 규칙은 그림이 갖춘 만큼만 완성됩니다.'],
   versions:{body:['Nerulio 검증(docs/STUDIO-TILE.md, 2026-09-23, Windows 11): Godot 4.7.2.stable.official가 함께 온 가져오기 스크립트로 TileSet을 만들고 코퍼스의 모든 맵을 Studio 예측과 똑같이 칠했습니다. Tiled 1.12.2는 모든 Wang ID를 쓴 그대로 읽었고, Unity 6000.5.3f1 + 2D Tilemap Extras 8.0.3은 룰 타일을 만들어 모든 칸이 일치했습니다. LDtk는 1.5.3 JSON 스키마와 공식 로더로만 확인했습니다. 위의 엔진 개념은 링크한 공식 문서를 따릅니다.'],sources:[S.ko.godotTilesets,S.ko.tiledTerrain,S.ko.unityRule,S.ko.ldtkAuto]}
  },
  ja:{
   answer:'オートタイルのシートは、各タイルがどの隣とつながるかが書かれるまではただの絵です。Godotはこれを地形のピアリングビット、TiledはWang ID、UnityはRule Tileの隣接ルールとして持ちます。タイル工房（Nerulio StudioのTileワークスペース）はPNGシートのグリッドを測り、タイル同士の継ぎ目から公開済みの12配置のどれかを見分けてビットを書き込み、足りない組み合わせを挙げ、GodotかTiledのルールでテストマップを塗ります。書き出したファイルはGodot 4.7.2、Tiled 1.12.2、Unity 6000.5.3f1で実際に読み込んで塗り、LDtkファイルは1.5.3のスキーマと公式ローダーで確認しました。',
   concept:{title:'ピクセルから配置を見分ける仕組みと、失敗するケース',body:[
    '配置とは、シートのマスごとに「そのタイルがどの隣接マスクを表すか」を並べた表です。同じブロブ47枚でも、互換性のない並びが少なくとも5種類（cr31昇順8×6、wang blob 7×7、caeles、GameMaker、Godot 3の12×4テンプレート）あり、PNGの中にはどれなのか書かれていません。表を取り違えると、全タイルが違うルールに入ります。',
    'そこでワークスペースは、表ごとに絵と照らし合わせます。ある配置が「Aは右がつながり、Bは左がつながる」と言うなら、AとBを並べても継ぎ目は見えないはずで、片方だけなら切れ目が見えるはずです。隣り合う全ペアで接する辺のピクセル差を測り（両端の角の区間と中央を別々に）、「滑らかなはずのペア」が「切れるはずのペア」より実際に滑らかである確率で採点します。これがROC AUCで、1.0は完全、0.5はピクセルから何もわからないという意味です。辺のピクセルだけを見るので、テンプレートに印刷された番号は影響しません。',
    '小さいシートでは全位置で、400マスを超えるシートではその配置のブロック格子上だけで試し、まずサンプルで素早く測ってから、配置ごとに上位6か所だけを全ペアで測り直します。信頼度は、AUCが0.97以上・空きマスなし・次の別解釈に0.03以上の差があれば高、AUC 0.88以上で空きマスが1つ以下なら中、それ以外は低です。「適用」を押すまで何も書き込みません。',
    '失敗する場面も決まっています。どの部品も同じに見える継ぎ目のない絵（RPGツクールA2の床は0.5）、質感の強い絵（64pxの洞窟セットは0.964でしたが47枚すべて正解）、一覧にない配置（Tilesetterの出力順は公開されていません）、そもそもオートタイルでないシートです。その場合はビットを自分で塗るか、ピクセルからビットを提案させてプレビューで確かめます。'],
    terms:[['ピアリングビット','Godot 4で、タイルが8方向の隣の位置ごとに期待する地形。Tiledは同じ考え方をWang IDで、UnityはRule Tileの隣接ルールで保存します。'],['配置（レイアウト）','シートがタイルを並べる順番。どのマスにどの隣接マスクのタイルがあるか。'],['継ぎ目AUC','配置が「つながる」としたペアが「切れる」としたペアより、辺のピクセル差でどれだけはっきり小さいか。1.0は完全、0.5は情報なし。'],['マッチモード','どの隣を見るか：角と辺（ブロブ47）、辺のみ（辺タイル16）、角のみ（角・デュアルグリッド16）。']]},
   example:{title:'実在のシートでの判定結果',lead:'2026-09-23のコーパス実行（docs/STUDIO-TILE.md）。ヒントなしでピクセルだけからグリッドと配置を求めました。',lines:[
    'シート                             判定                      信頼度      継ぎ目AUC  正しいビット',
    'GameMaker 47テンプレート           GameMaker 47              高          1.000      47/47',
    'caelesテンプレート 7×7             caeles 7×7                高          1.000      49/49',
    'Tiled wangblobサンプル             wang blob 7×7             高          1.000      49/49',
    '洞窟プラットフォーマー47（64px）   GameMaker 47              中          0.964      47/47',
    'Wang S-V2（角テンプレート）        corner16 cr31             高          1.000      16/16',
    'coolschool A2（継ぎ目のない床）    ピクセルからは不明        低          0.5        サイズのヒント → 組み立て',
    'Kenney tiny dungeon（非オートタイル） 低、または「シートの一部のみ：N枚中9枚」の警告付きの3×3ボックス',
    '',
    '書き出したセットをGodot 4.7.2で塗った結果：各ブロブセットでテストセル485個中485個がStudioの予測と一致。'],
    after:'洞窟セットが典型的な実例です。岩の質感で辺が荒くなりAUCが0.97を下回るため「中」と表示されますが、タイルはすべて正解でした。信頼度は「どれだけ念入りに確かめるか」の目安として読み、テストマップで確認してください。'},
   verify:{title:'書き出す前に結果を確かめる',steps:[
    'チェックパネル：すべての組み合わせにタイルがあり、開いた辺の奥に角ビットを持つタイルがなく、絵とビットの照合を実際に測って問題がないときだけ「完了」と表示します。「測定できず」はチェックマークではなくそのまま表示されます。',
    '足りない組み合わせはマスク付きの半透明タイルで表示されます。そのタイルだけを描くか、[[game/tileset-generator|タイルセットジェネレーター]]で作ります。',
    'Mを押し、最初の島をGodotルールとTiledルールで見比べます。枠が付いたセルは、エンジンが空けるか別のタイルで代用する場所です（[[game/autotile-tester|枠の意味]]）。',
    '書き出し後、エンジンで同じ形を塗ります。Godot 4では同梱の`nerulio_tileset_import.gd`を実行（File › Run）し、保存された`nerulio-tileset.tres`をTileMapLayerに設定してTerrainsタブで塗ります。詳しくは[[game/godot-autotile|Godot 4のオートタイル]]。']},
   trouble:{rows:[
    ['最初の配置候補の信頼度が低い、または明らかに違う','継ぎ目のない絵や質感の強い絵、または既知の12配置にない並び','継ぎ目AUCと「シートの一部しか説明しない」という警告を読む','ビットツール（B）で自分で塗るか、全面タイルを選んでピクセルからビットを提案させ、プレビューを適用'],
    ['候補のタイルサイズが実際の2倍や半分','本当のタイルの倍数でも同じ境界を説明できる（16×16が8枚で64×32のマス）','点線のグリッドが描かれたタイルを横切る、または列×行が8×6・7×7・4×4・12×4でない','配置と列×行が合う候補を選ぶか、タイルサイズを直接入力'],
    ['チェックに「開いた辺の奥の角ビット」が出る','2辺のどちらかが開いている角にビットを塗った。そのタイルを使うマップは存在しない','一覧のタイルをクリックすると3×3ビットエディターに角と開いた辺が見える','角ビットを消すか辺をつなぐ。どちらも1クリック、取り消し1段階'],
    ['絵の照合がちょうど2枚のタイルを指摘する','配置と比べて、シート上で2枚が入れ替わっている','絵の照合が2枚の位置を示す。どちらも描かれた縁が自分のビットと矛盾している','ビットを入れ替える（ビットのコピー・貼り付け）か、シートの並びを直して読み込み直す'],
    ['RPGツクールのシートで配置が1つも出ない','A2・A4シートはタイルではなく、タイルを組み立てる部品を持つ。継ぎ目のない床は0.5','サイズのヒントが出る（例：768×576 = 48pxのRPGツクールA2）','「このブロックから組み立てる」を使う。[[game/rpg-maker-autotile-to-godot|RPGツクールのオートタイルをGodotへ]]も参照']]},
   alternatives:{rows:[
    ['Godot自身のTileSetエディターで、Selectモードでタイルを選びTerrain Peering Bitsを手で設定','自分しか使わない変わった配置の小さなセットのとき。何も入れずに済み、GodotのUIを覚えるのにも向きます。'],
    ['Tiledの地形セットエディター','レベルをTiledで作り、どのみちそこでWangの色を付けるとき。書き出しの中身は[[game/tiled-wang-set|TiledのWangセット]]にあります。'],
    ['LDtkのオートレイヤールール','レベルをLDtkで作り、タイルごとのビットよりIntGridレイヤーに掛けるルールエディターのほうが扱いやすいとき。[[game/ldtk-autotile-rules|LDtkのオートタイルルール]]を参照。'],
    ['Blobsmithのような基本ブロックのジェネレーター、またはNerulioのジェネレーター','まだ47枚を描いていないとき。2×3の基本ブロックだけ描いて残りを組み立てます（[[game/tileset-generator|タイルセットジェネレーター]]）。']]},
   limits:['アイソメトリック・六角形のタイル、アニメーションタイル、代替タイル、オクルージョン・ナビゲーションのレイヤーは扱いません。','Tiledの地形ブラシ、LDtkアプリ、Godotエディターの塗りツールは直接操作していません。確認はファイルの読み込みと`set_cells_terrain_connect`で行いました。','3種類以上の地形が1点で出会うルールは、絵がそろっている範囲でしか完成しません。'],
   versions:{body:['Nerulioの検証（docs/STUDIO-TILE.md、2026-09-23、Windows 11）：Godot 4.7.2.stable.officialが同梱のインポートスクリプトでTileSetを作り、コーパスの全マップをStudioの予測どおりに塗りました。Tiled 1.12.2はすべてのWang IDを書いたとおりに読み、Unity 6000.5.3f1＋2D Tilemap Extras 8.0.3はRule Tileを作って全セルが一致しました。LDtkは1.5.3のJSONスキーマと公式ローダーでのみ確認しています。上のエンジンの説明はリンク先の公式ドキュメントに基づきます。'],sources:[S.ja.godotTilesets,S.ja.tiledTerrain,S.ja.unityRule,S.ja.ldtkAuto]}
  }
 },
 'game/autotile-tester':{
  type:'troubleshoot',
  intent:{primary:'test an autotile set before the engine and find the cells it will draw wrong or leave empty',secondary:['why does Godot put the wrong tile here','missing autotile combinations','Tiled terrain brush leaves gaps','does painting order matter'],
   goal:'a list of every map cell the engine would get wrong, with the neighbour pattern it needed, so the tileset can be fixed before export',input:'a tileset with terrain bits (from a recognised layout or painted)',output:'an on-screen test map with problem cells outlined and explained; then the fixed tileset exported',target:'Godot 4 terrain painting (4.7.2), Tiled Wang matching (1.12.2)',support:'partial',
   evidence:['src/studio/workspaces/tile/resolve.js (missing / wrong / gap)','src/game/tiles/godot-terrain.js (port of set_cells_terrain_connect)','src/game/tiles/tiled.js (exact Wang match, corner sets on grid points)','src/studio/workspaces/tile/state.js (24×16 default, 128 max, starter island)','docs/STUDIO-TILE.md (Godot = Studio 485/485; Tiled drops all-zero Wang IDs; Unity default sprite)'],
   external:['Godot 4.7 TileMapLayer: set_cells_terrain_connect "best fitting tile"','Godot 4.7 Using TileMaps: Connect / Path modes','Tiled Terrain: corner / edge / mixed sets','Unity Rule Tile: Default Sprite']},
  en:{
   answer:'An autotile set can look complete on the sheet and still leave holes in a real map, because the engine needs one tile for every neighbour pattern the map produces. The tester paints a test map and resolves it the way the engine does — a port of Godot 4\'s `set_cells_terrain_connect` that equalled Godot 4.7.2 in every compared cell, or Tiled\'s exact Wang match — and outlines each cell the engine would leave empty, fill with a substitute, or cannot match, naming the pattern it needed. It diagnoses the tileset; it does not repair art, and it is not the engine\'s own editor.',
   concept:{title:'Why an engine draws the wrong tile, or nothing',body:[
    'A missing combination. A 47-tile set with one tile short works on most maps and fails exactly where a shape needs that tile — typically an inner corner of a lake. Godot then places the tile whose bits fit best, or leaves the cell empty; Tiled has no exact tile; Unity paints the Rule Tile\'s Default Sprite.',
    'Wrong bits. If two tiles are swapped in the layout, or a bit was painted on the wrong side, the engine obeys the bits: it places the tile the bits ask for, and the art shows a rim where land continues.',
    'A set that cannot draw the shape. A 3×3 box of 9 tiles matches sides only and covers 9 of the 16 side combinations: one-tile-wide strips, ends and lone tiles have no tile, by construction.',
    'Engine-specific rules. Tiled drops a Wang tile whose ID is all zeros, so the isolated tile of a one-colour blob set is never written and Tiled cannot place it. Godot\'s editor paints stroke by stroke and its result depends on the order of your strokes; the tester shows one pass per terrain, row by row — what a script calling `set_cells_terrain_connect` does.'],
    terms:[['Missing (Godot rule)','A painted cell the engine leaves empty because no tile fits.'],['Wrong (Godot rule)','The engine drew a tile whose bits do not fit the neighbourhood: a substitute.'],['Gap (Tiled rule)','No tile has exactly the Wang colours the neighbours ask for.']]},
   example:{title:'Example: the tile a lake needs',lead:'The starter map is an island with a lake. Take the land cell diagonally below-right of the lake\'s bottom-right water cell:',lines:[
    'neighbours       NW = water, the other 7 = land',
    'raw mask         N1 + NE2 + E4 + SE8 + S16 + SW32 + W64 = 127',
    'reduced mask     127  (NE, SE, SW count: both of their sides are land)',
    'tile needed      the inner corner "N E S W · NE SE SW"',
    '',
    'the same lake also needs 253 (NE open), 247 (SE open) and 223 (SW open): one per corner',
    'set without 127  Godot rule → that cell outlined (missing or wrong)   Tiled rule → gap',
    'fix              draw that one tile, or generate the set, and the outline disappears'],
    after:'Every rectangular lake needs all four inner corners, so a set short of one of them fails on the first lake you draw — which is why the starter map has one.'},
   mapping:{title:'What each engine does with the same situation',head:['Situation on the map','Godot 4 (Godot rule)','Tiled (Tiled rule)','Unity Rule Tile'],rows:[
    ['The set has the combination','The tile with those peering bits','The tile with that Wang ID','The tiling rule that matches'],
    ['The set lacks the combination','Best-fitting substitute, or an empty cell: outlined as wrong or missing','No exact tile: outlined as a gap','The Default Sprite is drawn'],
    ['A lone cell, one-colour blob set','The isolated tile','The isolated tile is not written (all-zero Wang ID): flagged','Drawn by its rule; the blob sets matched in every cell in Unity 6'],
    ['A corner (dual-grid) set','Match Corners terrain on ordinary cells','Tiles on grid points, a layer shifted half a tile','Not exported: a Rule Tile draws on cells'],
    ['Two terrains meet','The best-fitting transition tile, if the art has one','A tile whose Wang colours equal the neighbours','One Rule Tile per terrain, no transitions between them'],
    ['Painting order','The editor\'s result depends on stroke order; the tester paints each terrain once, row by row','An exact match: order does not change it','—']],
    note:'The Godot rule is a port of the engine\'s matcher that equalled Godot 4.7.2 cell for cell on every corpus map; the Tiled rule is the exact Wang lookup that the exported `sample.tmx` uses (Tiled\'s interactive terrain brush, which can insert transitions, was not driven). Unity\'s behaviour comes from the Unity 6 verification runs.'},
   trouble:{rows:[
    ['Outlines at the inner corners of every lake','The inner-corner tiles (masks 127, 253, 247, 223) are missing or carry wrong bits','Hover an outlined cell: it names the pattern it wanted; the Check panel lists the same masks as ghost tiles','Draw those tiles or generate them from a base block; the outlines clear as soon as the set has them'],
    ['A cell is "wrong": Godot drew a tile with a rim where land continues','Two tiles are swapped, or one bit is on the wrong side','Hover shows the tile drawn and its bits next to the wanted pattern','Fix the bits of that tile (3×3 bit editor) or the order in the sheet'],
    ['Lone cells are flagged only with the Tiled rule','Tiled drops the isolated tile of a one-colour blob set (its Wang ID is all zeros)','Switch to the Godot rule: the same cells are fine there','Avoid lone cells in Tiled maps, or build an A-over-B set whose open sides carry terrain B'],
    ['One-tile-wide paths and ends break','The set is a 9-tile 3×3 box: 7 of the 16 side combinations cannot exist in it','Check panel: 7 missing side combinations','Use a 16-tile side set or a 47-tile blob set; see [[game/blob-47-tileset|the 47-tile blob]]'],
    ['Godot\'s editor paints something the tester did not','The editor\'s painter is path-dependent: strokes in another order give other tiles','Repaint the area in one Connect stroke, or call `set_cells_terrain_connect` from a script','Nothing to fix in the tileset; if the difference matters, paint that area as one stroke — see [[game/godot-terrain-wrong-tiles|wrong tiles in Godot]]'],
    ['The corner set looks shifted half a tile with the Tiled rule','Corner sets sit on grid points: a map of W × H cells shows (W+1) × (H+1) tiles','Toggle to the Godot rule: tiles return to the cells','Expected; the exported `sample.tmx` carries the same half-tile layer offset']]},
   verify:{title:'When the set is ready',steps:[
    'The starter island shows no outlined cell with the Godot rule and none with the Tiled rule (lone cells aside, see above).',
    'Paint the awkward shapes on purpose: a single cell, a one-tile corridor, two cells touching only at a corner, a 2×2 block, a lake. Then use random fill a few times; outlines are what is left to fix.',
    'The Check panel says Complete, and the count of problem cells under the map is 0.',
    'In the engine, paint the same shapes once: the tiles should match the test map.']},
   alternatives:{rows:[
    ['Paint directly in Godot\'s TileMap editor (Terrains tab)','Your set is small and you only target Godot: you see Godot\'s own result, including its stroke-order effects, with nothing in between.'],
    ['Paint with Tiled\'s terrain brush','You build levels in Tiled; its brush can also insert transition tiles on its way, which the exact-match Tiled rule here does not.']]},
   limits:['The Godot editor\'s own stroke-by-stroke painter and Tiled\'s interactive brush are not reproduced; the tester shows one pass per terrain.','Test maps go up to 128 × 128 cells; LDtk rules are exported but not shown as a live rule on the map.','It shows where the art is missing; it does not draw it (the generator can assemble sets from a base block).'],
   versions:{body:['Verified by Nerulio (docs/STUDIO-TILE.md, 2026-09-23): the Godot rule equalled Godot 4.7.2.stable.official in every painted cell of every corpus map, including incomplete and multi-terrain sets whose engine picks are replayed by the unit tests; Tiled 1.12.2 read the Wang IDs as written and rendered `sample.tmx` pixel-exact; Unity 6000.5.3f1 drew the Default Sprite exactly where the Studio predicted it. What the engines do in their editors follows the linked documentation.'],sources:[S.en.godotLayer,S.en.godotTilemaps,S.en.tiledTerrain,S.en.unityRule]}
  },
  ko:{
   answer:'오토타일 세트는 시트에서는 다 갖춘 것처럼 보여도 실제 맵에서는 구멍이 날 수 있습니다. 엔진은 맵이 만들어 내는 이웃 패턴마다 타일이 한 장씩 필요하기 때문입니다. 테스트 도구는 테스트 맵을 칠하고 엔진과 같은 방식으로 풉니다. 고도 4의 `set_cells_terrain_connect`를 옮긴 규칙(비교한 모든 칸에서 Godot 4.7.2와 같았음) 또는 Tiled의 정확한 Wang 매칭입니다. 엔진이 비워 두거나, 다른 타일로 대신하거나, 맞출 수 없는 칸마다 윤곽선을 치고 필요한 패턴을 알려 줍니다. 타일셋을 진단할 뿐 그림을 고쳐 주지는 않으며, 엔진 자체의 편집기도 아닙니다.',
   concept:{title:'엔진이 엉뚱한 타일을 놓거나 아무것도 놓지 않는 이유',body:[
    '빠진 조합. 47장 세트에서 한 장이 모자라면 대부분의 맵에서는 문제가 없다가, 그 타일이 필요한 모양에서만 정확히 실패합니다. 대개 호수의 안쪽 모서리입니다. 이때 고도는 비트가 가장 잘 맞는 타일을 놓거나 칸을 비워 두고, Tiled는 정확히 맞는 타일이 없으며, 유니티는 룰 타일의 기본 스프라이트를 그립니다.',
    '잘못된 비트. 배치에서 두 타일이 뒤바뀌었거나 비트를 엉뚱한 변에 칠했다면 엔진은 비트를 따릅니다. 비트가 요구하는 타일을 놓으므로 땅이 이어지는 곳에 테두리가 보입니다.',
    '그 모양을 그릴 수 없는 세트. 9장짜리 3×3 박스는 변만 보고, 변 조합 16가지 중 9가지만 다룹니다. 한 칸 폭의 줄, 끝부분, 외딴 타일은 구조상 타일이 없습니다.',
    '엔진마다 다른 규칙. Tiled는 Wang ID가 모두 0인 타일을 버립니다. 그래서 한 가지 색 블롭 세트의 외딴 타일은 기록되지 않고 Tiled는 그 타일을 놓을 수 없습니다. 고도 편집기는 한 획씩 칠하며 결과가 획의 순서에 따라 달라집니다. 테스트 도구는 지형마다 한 번, 행 순서로 칠한 결과를 보여 줍니다. 스크립트에서 `set_cells_terrain_connect`를 부르는 것과 같은 방식입니다.'],
    terms:[['빈칸(고도 규칙)','칠한 칸인데 맞는 타일이 없어 엔진이 비워 두는 칸.'],['잘못됨(고도 규칙)','엔진이 이웃과 비트가 맞지 않는 타일을 대신 놓은 칸.'],['틈(Tiled 규칙)','이웃이 요구하는 Wang 색과 정확히 같은 타일이 없는 칸.']]},
   example:{title:'예시: 호수가 필요로 하는 타일',lead:'시작 맵은 호수가 있는 섬입니다. 호수의 오른쪽 아래 물 칸에서 대각선 오른쪽 아래에 있는 땅 칸을 봅시다.',lines:[
    '이웃             NW = 물, 나머지 7칸 = 땅',
    '원래 마스크      N1 + NE2 + E4 + SE8 + S16 + SW32 + W64 = 127',
    '줄인 마스크      127  (NE, SE, SW는 양옆 변이 모두 땅이라 셈에 들어감)',
    '필요한 타일      안쪽 모서리 "N E S W · NE SE SW"',
    '',
    '같은 호수는 253(NE 열림), 247(SE 열림), 223(SW 열림)도 필요: 모서리마다 하나',
    '127이 없는 세트  고도 규칙 → 그 칸에 윤곽선(빈칸 또는 잘못됨)   Tiled 규칙 → 틈',
    '해결             그 타일 한 장을 그리거나 세트를 생성하면 윤곽선이 사라짐'],
    after:'네모난 호수는 안쪽 모서리 네 개를 모두 요구하므로, 그중 하나라도 빠진 세트는 처음 그린 호수에서 바로 드러납니다. 시작 맵에 호수가 있는 이유입니다.'},
   mapping:{title:'같은 상황에서 엔진마다 하는 일',head:['맵의 상황','고도 4(고도 규칙)','Tiled(Tiled 규칙)','유니티 룰 타일'],rows:[
    ['세트에 그 조합이 있음','그 피어링 비트를 가진 타일','그 Wang ID를 가진 타일','맞는 타일링 규칙'],
    ['세트에 그 조합이 없음','가장 잘 맞는 대체 타일 또는 빈칸: 잘못됨·빈칸으로 표시','정확한 타일 없음: 틈으로 표시','기본 스프라이트를 그림'],
    ['외딴 칸, 한 가지 색 블롭 세트','외딴 타일','외딴 타일이 기록되지 않음(Wang ID가 모두 0): 표시됨','자기 규칙으로 그림. 블롭 세트는 유니티 6에서 모든 칸이 일치'],
    ['모서리(듀얼 그리드) 세트','일반 칸 위의 Match Corners 지형','격자점 위의 타일, 반 칸 밀린 레이어','내보내지 않음: 룰 타일은 칸 위에 그림'],
    ['두 지형이 만남','그림에 있다면 가장 잘 맞는 전환 타일','Wang 색이 이웃과 같은 타일','지형마다 룰 타일 하나, 지형 사이 전환 없음'],
    ['칠하는 순서','편집기 결과는 획 순서에 따라 달라짐. 테스트 도구는 지형마다 한 번, 행 순서로 칠함','정확한 매칭이라 순서와 무관','—']],
    note:'고도 규칙은 엔진의 매칭을 옮긴 것으로, 코퍼스의 모든 맵에서 Godot 4.7.2와 칸 단위로 같았습니다. Tiled 규칙은 내보낸 `sample.tmx`가 쓰는 정확한 Wang 조회입니다(전환 타일을 끼워 넣을 수 있는 Tiled의 대화형 지형 브러시는 조작하지 않았습니다). 유니티의 동작은 유니티 6 검증 실행 결과입니다.'},
   trouble:{rows:[
    ['호수마다 안쪽 모서리에 윤곽선','안쪽 모서리 타일(마스크 127, 253, 247, 223)이 없거나 비트가 틀림','윤곽선 칸에 마우스를 올리면 필요한 패턴이 나옴. 점검 패널에도 같은 마스크가 반투명 타일로 나옴','그 타일들을 그리거나 기본 블록에서 생성. 세트에 들어가는 즉시 윤곽선이 사라짐'],
    ['"잘못됨" 칸: 땅이 이어지는데 고도가 테두리 있는 타일을 놓음','두 타일이 뒤바뀌었거나 비트 하나가 엉뚱한 변에 있음','마우스를 올리면 놓인 타일과 그 비트가 필요한 패턴 옆에 나옴','그 타일의 비트(3×3 비트 편집기)나 시트 순서를 고침'],
    ['Tiled 규칙에서만 외딴 칸이 표시됨','Tiled는 한 가지 색 블롭 세트의 외딴 타일(Wang ID가 모두 0)을 버림','고도 규칙으로 바꾸면 같은 칸이 정상','Tiled 맵에서는 외딴 칸을 피하거나, 열린 변에 지형 B가 들어가는 A 위 B 세트를 만듦'],
    ['한 칸 폭 길과 끝부분이 깨짐','세트가 9장짜리 3×3 박스: 변 조합 16가지 중 7가지는 들어갈 수 없음','점검 패널: 변 조합 7개 부족','변 타일 16장이나 블롭 47장 세트를 사용. [[game/blob-47-tileset|47장 블롭]] 참고'],
    ['고도 편집기가 테스트 도구와 다르게 칠함','편집기의 칠하기는 경로에 따라 달라짐: 획 순서가 다르면 다른 타일이 놓임','그 구역을 Connect 모드 한 획으로 다시 칠하거나 스크립트에서 `set_cells_terrain_connect` 호출','타일셋에서 고칠 것은 없음. 차이가 중요하면 그 구역을 한 획으로 칠함. [[game/godot-terrain-wrong-tiles|고도에서 틀린 타일]] 참고'],
    ['Tiled 규칙에서 모서리 세트가 반 칸 밀려 보임','모서리 세트는 격자점 위에 놓임: W × H 칸 맵에 (W+1) × (H+1) 타일','고도 규칙으로 바꾸면 타일이 칸 위로 돌아옴','정상. 내보낸 `sample.tmx`에도 같은 반 칸 레이어 오프셋이 들어감']]},
   verify:{title:'세트가 준비됐는지',steps:[
    '시작 섬에서 고도 규칙과 Tiled 규칙 모두 윤곽선 칸이 없어야 합니다(위에서 말한 외딴 칸 제외).',
    '까다로운 모양을 일부러 칠해 봅니다. 한 칸, 한 칸 폭 통로, 모서리로만 닿은 두 칸, 2×2 덩어리, 호수. 그다음 무작위 채우기를 몇 번 합니다. 남는 윤곽선이 고칠 것입니다.',
    '점검 패널이 완료라고 하고, 맵 아래 문제 칸 수가 0입니다.',
    '엔진에서 같은 모양을 한 번 칠해 봅니다. 타일이 테스트 맵과 같아야 합니다.']},
   alternatives:{rows:[
    ['고도 TileMap 편집기(Terrains 탭)에서 바로 칠하기','세트가 작고 고도만 쓸 때. 획 순서의 영향까지 포함해 고도 자체의 결과를 중간 단계 없이 봅니다.'],
    ['Tiled 지형 브러시로 칠하기','레벨을 Tiled에서 만들 때. 브러시는 도중에 전환 타일을 끼워 넣기도 하는데, 여기의 정확 매칭 Tiled 규칙은 그렇게 하지 않습니다.']]},
   limits:['고도 편집기의 획 단위 칠하기와 Tiled의 대화형 브러시는 재현하지 않습니다. 지형마다 한 번 칠한 결과를 보여 줍니다.','테스트 맵은 최대 128 × 128칸입니다. LDtk 규칙은 내보내지만 맵에서 실시간 규칙으로 보여 주지는 않습니다.','그림이 어디서 모자란지 보여 줄 뿐 그려 주지는 않습니다(생성기는 기본 블록에서 세트를 조립할 수 있습니다).'],
   versions:{body:['Nerulio 검증(docs/STUDIO-TILE.md, 2026-09-23): 고도 규칙은 코퍼스 모든 맵의 칠한 모든 칸에서 Godot 4.7.2.stable.official과 같았고, 불완전한 세트와 여러 지형 세트에서 엔진이 고른 결과는 단위 테스트가 다시 재생합니다. Tiled 1.12.2는 Wang ID를 쓴 그대로 읽고 `sample.tmx`를 픽셀 단위로 똑같이 렌더링했습니다. Unity 6000.5.3f1은 Studio가 예측한 칸에 정확히 기본 스프라이트를 그렸습니다. 엔진 편집기에서의 동작은 링크한 공식 문서를 따릅니다.'],sources:[S.ko.godotLayer,S.ko.godotTilemaps,S.ko.tiledTerrain,S.ko.unityRule]}
  },
  ja:{
   answer:'オートタイルのセットは、シート上ではそろって見えても実際のマップでは穴が空くことがあります。エンジンは、マップが生む隣接パターンごとに1枚ずつタイルを必要とするからです。テスターはテストマップを塗り、エンジンと同じ方法で解決します。Godot 4の`set_cells_terrain_connect`の移植（比較したすべてのセルでGodot 4.7.2と一致）か、Tiledの厳密なWangマッチです。エンジンが空けるセル、別のタイルで代用するセル、合わせられないセルに枠を付け、必要だったパターンを示します。タイルセットを診断するだけで絵は直さず、エンジン自身のエディターでもありません。',
   concept:{title:'エンジンが違うタイルを置く、または何も置かない理由',body:[
    '足りない組み合わせ。47枚のセットで1枚足りないと、たいていのマップでは問題が出ず、そのタイルが要る形でだけ確実に失敗します。多くは湖の内側の角です。このときGodotはビットが最もよく合うタイルを置くかセルを空け、Tiledにはぴったりのタイルがなく、UnityはRule TileのDefault Spriteを描きます。',
    '間違ったビット。配置の中で2枚が入れ替わっていたり、ビットを違う辺に塗っていたりすると、エンジンはビットに従います。ビットが求めるタイルを置くので、地面が続く場所に縁が見えます。',
    'その形を描けないセット。9枚の3×3ボックスは辺だけを見て、辺の組み合わせ16通りのうち9通りしか扱えません。1マス幅の帯や端、孤立したマスには、構造上タイルがありません。',
    'エンジンごとの決まり。TiledはWang IDがすべて0のタイルを捨てるため、単色ブロブセットの孤立タイルは書き込まれず、Tiledでは置けません。Godotのエディターは1ストロークずつ塗り、結果がストロークの順番で変わります。テスターは地形ごとに1回、行の順に塗った結果を表示します。スクリプトから`set_cells_terrain_connect`を呼ぶのと同じ方法です。'],
    terms:[['空き（Godotルール）','塗ったのに合うタイルがなく、エンジンが空けるセル。'],['誤り（Godotルール）','周りとビットが合わないタイルをエンジンが代わりに置いたセル。'],['すき間（Tiledルール）','隣が求めるWangの色とぴったり同じタイルがないセル。']]},
   example:{title:'例：湖に必要なタイル',lead:'最初のマップは湖のある島です。湖の右下の水マスから見て、斜め右下にある陸マスを取り上げます。',lines:[
    '隣接             NW = 水、ほかの7マス = 陸',
    '元のマスク       N1 + NE2 + E4 + SE8 + S16 + SW32 + W64 = 127',
    '縮約後           127（NE・SE・SWは両側の辺がどちらも陸なので数える）',
    '必要なタイル     内側の角「N E S W · NE SE SW」',
    '',
    '同じ湖には253（NEが空き）、247（SEが空き）、223（SWが空き）も必要：角ごとに1枚',
    '127がないセット  Godotルール → そのセルに枠（空きか誤り）   Tiledルール → すき間',
    '対処             その1枚を描くかセットを生成すれば枠は消える'],
    after:'四角い湖は内側の角を4つとも求めるので、そのうち1枚でも欠けたセットは最初に描いた湖ですぐにわかります。最初のマップに湖がある理由です。'},
   mapping:{title:'同じ状況で各エンジンがすること',head:['マップ上の状況','Godot 4（Godotルール）','Tiled（Tiledルール）','UnityのRule Tile'],rows:[
    ['セットにその組み合わせがある','そのピアリングビットを持つタイル','そのWang IDを持つタイル','一致するタイリングルール'],
    ['セットにその組み合わせがない','最もよく合う代用タイル、または空きセル：誤り・空きとして表示','ぴったりのタイルなし：すき間として表示','Default Spriteを描く'],
    ['孤立したマス、単色ブロブセット','孤立タイル','孤立タイルが書き込まれない（Wang IDがすべて0）：表示される','自分のルールで描く。ブロブセットはUnity 6で全セル一致'],
    ['角（デュアルグリッド）セット','通常のセル上のMatch Corners地形','格子点上のタイル、半タイルずれたレイヤー','書き出さない：Rule Tileはセルの上に描く'],
    ['2つの地形が接する','絵にあれば最もよく合う遷移タイル','Wangの色が隣と同じタイル','地形ごとにRule Tileが1つ、地形間の遷移はなし'],
    ['塗る順番','エディターの結果はストロークの順で変わる。テスターは地形ごとに1回、行の順に塗る','厳密なマッチなので順番に左右されない','—']],
    note:'Godotルールはエンジンのマッチングの移植で、コーパスの全マップでGodot 4.7.2とセル単位で一致しました。Tiledルールは書き出した`sample.tmx`が使う厳密なWangの照合です（途中に遷移タイルを挟むことがあるTiledの対話的な地形ブラシは操作していません）。Unityの動作はUnity 6の検証結果によります。'},
   trouble:{rows:[
    ['どの湖でも内側の角に枠が付く','内側の角のタイル（マスク127・253・247・223）がないか、ビットが違う','枠のセルにカーソルを合わせると必要なパターンが出る。チェックパネルにも同じマスクが半透明で出る','それらを描くか基本ブロックから生成。セットに入った時点で枠は消える'],
    ['「誤り」のセル：陸が続くのにGodotが縁のあるタイルを置いた','2枚が入れ替わっているか、ビットが1つ違う辺にある','カーソルを合わせると、置かれたタイルとそのビットが必要なパターンと並んで出る','そのタイルのビット（3×3ビットエディター）かシートの並びを直す'],
    ['Tiledルールでだけ孤立マスが表示される','Tiledは単色ブロブセットの孤立タイル（Wang IDがすべて0）を捨てる','Godotルールに切り替えると同じセルは問題なし','Tiledのマップでは孤立マスを避けるか、開いた辺に地形Bが入るA over Bのセットを作る'],
    ['1マス幅の道や端が崩れる','セットが9枚の3×3ボックス：辺の組み合わせ16通りのうち7通りは入れられない','チェックパネル：辺の組み合わせが7つ不足','辺タイル16枚かブロブ47枚のセットを使う。[[game/blob-47-tileset|47枚のブロブ]]を参照'],
    ['Godotのエディターがテスターと違う塗り方をする','エディターの塗りは経路に依存する：ストロークの順が違えば別のタイルになる','その範囲をConnectモードの1ストロークで塗り直すか、スクリプトで`set_cells_terrain_connect`を呼ぶ','タイルセット側で直すものはない。差が問題ならその範囲を1ストロークで塗る。[[game/godot-terrain-wrong-tiles|Godotで違うタイルになる]]を参照'],
    ['Tiledルールで角セットが半タイルずれて見える','角セットは格子点の上に置かれる：W × Hマスのマップに(W+1) × (H+1)枚','Godotルールに切り替えるとタイルがセルの上に戻る','正常。書き出した`sample.tmx`にも同じ半タイルのレイヤーオフセットが入る']]},
   verify:{title:'セットの準備ができたか',steps:[
    '最初の島で、GodotルールでもTiledルールでも枠の付いたセルがないこと（上で触れた孤立マスは除く）。',
    '難しい形をわざと塗ります。1マス、1マス幅の通路、角だけで接する2マス、2×2の塊、湖。そのあとランダム塗りを何度か。残った枠が直すべき所です。',
    'チェックパネルが「完了」と表示し、マップ下の問題セル数が0であること。',
    'エンジンで同じ形を一度塗り、タイルがテストマップと同じになること。']},
   alternatives:{rows:[
    ['GodotのTileMapエディター（Terrainsタブ）で直接塗る','セットが小さく、Godotだけを使うとき。ストロークの順の影響も含めて、Godot自身の結果を間に何も挟まずに見られます。'],
    ['Tiledの地形ブラシで塗る','レベルをTiledで作るとき。ブラシは途中に遷移タイルを挟むこともありますが、ここの厳密マッチのTiledルールはそうしません。']]},
   limits:['Godotエディターのストローク単位の塗りと、Tiledの対話的なブラシは再現しません。地形ごとに1回塗った結果を示します。','テストマップは最大128 × 128マスです。LDtkのルールは書き出しますが、マップ上でライブのルールとしては表示しません。','絵がどこで足りないかを示すだけで、描きはしません（ジェネレーターは基本ブロックからセットを組み立てられます）。'],
   versions:{body:['Nerulioの検証（docs/STUDIO-TILE.md、2026-09-23）：Godotルールはコーパスの全マップの塗ったすべてのセルでGodot 4.7.2.stable.officialと一致し、不完全なセットや複数地形のセットでエンジンが選んだ結果は単体テストが再生します。Tiled 1.12.2はWang IDを書いたとおりに読み、`sample.tmx`をピクセル単位で同じに描画しました。Unity 6000.5.3f1はStudioの予測どおりのセルにDefault Spriteを描きました。エンジンのエディターでの動作はリンク先の公式ドキュメントに基づきます。'],sources:[S.ja.godotLayer,S.ja.godotTilemaps,S.ja.tiledTerrain,S.ja.unityRule]}
  }
 },
 'game/tileset-slicer':{
  type:'tool',
  intent:{primary:'find a tileset image\'s tile size, margin and spacing and cut it into a correct grid',secondary:['tileset with 1 px spacing','how many columns and rows','Kenney tileset tile size','why tiles drift when slicing'],
   goal:'the exact grid (tile size, margin, spacing, columns × rows) so every tile is cut on its own pixels, carried into the engine tileset',input:'PNG tileset (with or without gaps between tiles)',output:'the grid applied in the Studio and exported with the tileset (Godot 4, Tiled, Unity, LDtk); per-tile PNGs from the classic tile grid slicer',target:'any engine that takes tile size + margin + spacing',support:'full',
   evidence:['src/game/tile-grid.js (tileRects: floor((len - margin + spacing) / (tile + spacing)); detectGrid)','src/studio/workspaces/tile/tile-worker.js (detection up to 16 MP, layout-fit sizes)','docs/TILE-LAB.md §1 grid detection, §2 slicer','detectGrid run on the Kenney Tiny Dungeon and Pixel Platformer corpus files, 2026-09-28','docs/TILE-LAB.md (Godot 4.7.2: margin 1 / spacing 2 reached TileSetAtlasSource)'],
   external:['Godot 4.7 Using TileSets: Margins, Separation, Texture Region Size','Tiled: tileset margin and spacing','Sprite Fusion: tileset size must be a multiple of the tile size']},
  en:{
   answer:'To cut a tileset you need three numbers per axis: the tile size, the margin (pixels before the first tile) and the spacing (pixels between tiles). The count is columns = floor((width − margin + spacing) ÷ (tile + spacing)), and the same for rows: Kenney Tiny Dungeon\'s 203 × 186 px sheet with 16 px tiles and 1 px spacing gives 12 × 11 = 132 tiles. The Studio measures these numbers from the pixels, shows the best grid dashed until you press Use this grid, and carries it into the Godot 4, Tiled, Unity and LDtk exports; a ZIP of single tile PNGs comes from the [[tile-grid-slicer|classic tile grid slicer]].',
   concept:{title:'The grid model, the formula, and how the numbers are measured',body:[
    'Every tile has the same size. The margin is skipped once before the first column (and row), the spacing sits between two neighbouring tiles, and nothing is assumed after the last tile. Tile (c, r) therefore starts at x = margin + c × (tile + spacing), y = margin + r × (tile + spacing). Godot names the same numbers Texture Region Size, Margins and Separation; Tiled names them tile size, Margin and Spacing.',
    'n tiles need margin + n × tile + (n − 1) × spacing pixels, so the most that fit is floor((W − margin + spacing) ÷ (tile + spacing)). With the same margin on both sides the textbook form (W − 2 × margin + spacing) ÷ (tile + spacing) comes out exact; Nerulio\'s floor gives the same count whenever the leftover strip on the right is narrower than one tile plus spacing, which is also why a sheet with a few spare pixels still slices cleanly.',
    'The detector reads the image one line at a time: how much each row and column differs from the previous one. It folds that profile at every period from 4 px to half the image and keeps the periods that explain the most of its variation, then checks the phase, and demands that every line a margin or spacing claims is really blank or flat. When the first or last line of every tile is blank, "16 px + 1 px spacing" beats "17 px tiles"; a multiple of the true size loses when a divisor scores within 0.02 of it. The Studio also tries the sizes at which a published autotile layout fits exactly.',
    'It is weakest where a sheet gives no separators: packed tiles whose interiors are busier than their borders. It cannot measure one tile per axis, and the Studio measures images up to 16 megapixels; above that, type the size.'],
    terms:[['Tile size','Width and height of one tile in pixels (Godot: Texture Region Size).'],['Margin','Pixels before the first tile, at the left and top edge.'],['Spacing','Pixels between two neighbouring tiles (Godot: Separation). Often 1 px, sometimes extruded border pixels.'],['Packed sheet','Tiles edge to edge, no spacing: the easiest for other editors, the hardest to measure.']]},
   example:{title:'Example: two Kenney sheets from the test corpus',lead:'Measured with Nerulio\'s grid detector on the CC0 files (2026-09-28):',lines:[
    'Kenney Tiny Dungeon   tilemap.png          203 × 186 px   16 px tiles, 1 px spacing, margin 0',
    'columns = floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    'rows    = floor((186 − 0 + 1) / (16 + 1)) = floor(187 / 17) = 11          → 132 tiles',
    'tile 13 = column 1, row 1  → x = 0 + 1 × 17 = 17, y = 17, size 16 × 16',
    'detected: 16 × 16, spacing 1, 12 × 11, score 0.976 (high)',
    '',
    'tilemap_packed.png    192 × 176 px   same tiles, no spacing → 192 / 16 = 12, 176 / 16 = 11',
    'detected: 16 × 16, 12 × 11, but score 0.514 (low): no blank line between tiles',
    '',
    'Kenney Pixel Platformer  tilemap.png  379 × 170 px → (379 + 1) / (18 + 1) = 20, (170 + 1) / 19 = 9',
    'its tiles are 18 px, not 16: detected 18 × 18, spacing 1, 20 × 9, score 0.946 (high)'],
    after:'The same art scores 0.976 with gaps and 0.514 without them: blank separator lines are the strongest evidence a sheet can give. On a packed sheet, look at the dashed grid before you press Use this grid, or type the size you know.'},
   verify:{title:'Check the grid before you use it',steps:[
    'The dashed lines sit in the gaps all the way to the last column and the last row. If they are right on the left and wrong on the right, the tile size or spacing is off.',
    'Columns × rows match what you expect (12 × 11 = 132 for Tiny Dungeon), and the tiles counted as blank are really empty.',
    'After export, Godot\'s atlas shows the same Texture Region Size, Margins and Separation; Nerulio\'s Godot export with margin 1 and spacing 2 reached `TileSetAtlasSource` unchanged in Godot 4.7.2.',
    'For single tile PNGs, the classic slicer\'s tiles are copied region by region, never resampled: each one equals its source rectangle byte for byte.']},
   trouble:{rows:[
    ['Tiles drift further off with every column','Wrong tile size: Pixel Platformer\'s 18 px tiles read as 16 px + 1 px put tile c at 17 × c instead of 19 × c, 2 px more off per column','The grid fits the first column and misses the tenth by 18 px','Take the candidate with 18 px, or type tile 18, spacing 1'],
    ['Every tile is cut 1 px too far up and left','A border was not declared as margin','The first row and column of the image are blank or one flat colour','Set margin 1; the count formula subtracts it once'],
    ['A partial column or row is left at the right or bottom','The tile size does not divide the sheet; the floor drops anything narrower than one tile plus spacing','Compute (W − margin + spacing) ÷ (tile + spacing): it should be a whole number or just above one','Recheck the tile size; a remainder of many pixels means the reading is wrong, not the sheet'],
    ['The top candidate is only low or medium','A packed sheet: nothing blank between tiles, and busy tile interiors','Score and confidence next to each candidate','Confirm the dashed grid, pick another candidate, or type the size'],
    ['No candidates at all on a huge image','The Studio measures sheets up to 16 megapixels','Image width × height','Type the tile size, margin and spacing by hand'],
    ['Another editor refuses the sheet','Some editors take no spacing: Sprite Fusion asks that the tileset width and height be exact multiples of the tile size','Does W ÷ tile give a whole number?','Use the packed version of the sheet, or repack it without gaps']]},
   alternatives:{rows:[
    ['Type the numbers in the engine: Godot\'s atlas (Texture Region Size, Margins, Separation) or Tiled\'s new-tileset dialog (tile size, Margin, Spacing)','You already know the grid, for example from the asset pack\'s readme.'],
    ['The [[tile-grid-slicer|classic tile grid slicer]]','You want every tile as its own PNG, exact and near duplicates found, rotated and flipped variants, or an [[atlas-padding|extruded atlas]] against bleeding.'],
    ['The [[sprite-slicer|sprite slicer]]','The sheet has sprites of different sizes with no grid; tile slicing needs a regular grid.']]},
   limits:['Regular grids only; isometric or hexagonal sheets are not modelled.','The Studio does not write one PNG per tile; that stays in the classic slicer.','A sheet with a single tile per axis has no period to measure.'],
   versions:{body:['The formula and the rectangles are those of `tileRects` in src/game/tile-grid.js; detection was checked on 10 synthetic sheets (true grid first in 10 of 10) and the Kenney numbers above were measured on the corpus files on 2026-09-28. The Godot 4.7.2 run of 2026-09-22 read margin 1 and separation 2 back from the built TileSet. Engine field names follow the linked documentation.'],sources:[S.en.godotTilesets,S.en.tiledTilesets,S.en.sfImport]}
  },
  ko:{
   answer:'타일셋을 자르려면 축마다 세 숫자가 필요합니다. 타일 크기, 여백(첫 타일 앞의 픽셀), 간격(타일 사이의 픽셀)입니다. 개수는 열 = floor((너비 − 여백 + 간격) ÷ (타일 + 간격))이고 행도 같습니다. Kenney Tiny Dungeon의 203 × 186px 시트는 16px 타일과 1px 간격으로 12 × 11 = 132장이 됩니다. Studio는 이 숫자를 픽셀에서 재고, 이 격자 사용을 누를 때까지 가장 좋은 격자를 점선으로 보여 주며, Godot 4·Tiled·유니티·LDtk 내보내기에 그대로 넘깁니다. 타일마다 PNG로 된 ZIP은 [[tile-grid-slicer|기존 타일 격자 자르기]]에서 받습니다.',
   concept:{title:'격자 모델, 공식, 그리고 숫자를 재는 방법',body:[
    '모든 타일은 크기가 같습니다. 여백은 첫 열(과 첫 행) 앞에서 한 번만 건너뛰고, 간격은 이웃한 두 타일 사이에 있으며, 마지막 타일 뒤에는 아무것도 가정하지 않습니다. 그래서 (c, r) 타일은 x = 여백 + c × (타일 + 간격), y = 여백 + r × (타일 + 간격)에서 시작합니다. 고도는 같은 숫자를 Texture Region Size, Margins, Separation이라 부르고, Tiled는 타일 크기, Margin, Spacing이라 부릅니다.',
    '타일 n장에는 여백 + n × 타일 + (n − 1) × 간격 픽셀이 필요하므로, 들어가는 최대 개수는 floor((W − 여백 + 간격) ÷ (타일 + 간격))입니다. 양쪽 여백이 같으면 교과서식 (W − 2 × 여백 + 간격) ÷ (타일 + 간격)이 딱 나누어떨어집니다. Nerulio의 floor는 오른쪽에 남는 띠가 타일 하나와 간격보다 좁기만 하면 같은 개수를 주며, 여분 픽셀이 조금 있는 시트도 깔끔하게 잘리는 이유가 이것입니다.',
    '감지기는 이미지를 한 줄씩 읽어 각 행과 열이 앞줄과 얼마나 다른지 봅니다. 그 프로필을 4px부터 이미지 절반까지의 모든 주기로 접어 변화를 가장 많이 설명하는 주기를 고르고, 위상을 확인하고, 여백이나 간격이라고 주장하는 줄이 실제로 비었거나 단색인지 따집니다. 모든 타일의 첫 줄이나 마지막 줄이 비어 있으면 "16px + 1px 간격"이 "17px 타일"을 이깁니다. 실제 크기의 배수는 약수의 점수가 0.02 이내면 집니다. Studio는 공개된 오토타일 배치가 딱 맞는 크기도 함께 시험합니다.',
    '가장 약한 경우는 구분선이 전혀 없는 시트, 즉 타일 속이 테두리보다 복잡한 촘촘한 시트입니다. 축마다 타일이 하나뿐이면 잴 수 없고, Studio는 16메가픽셀까지의 이미지만 잽니다. 그보다 크면 크기를 직접 입력하세요.'],
    terms:[['타일 크기','타일 한 장의 가로·세로 픽셀(고도: Texture Region Size).'],['여백','왼쪽과 위쪽 가장자리에서 첫 타일 앞에 있는 픽셀.'],['간격','이웃한 두 타일 사이의 픽셀(고도: Separation). 보통 1px, 가장자리 픽셀을 늘린 경우도 있음.'],['촘촘한 시트','간격 없이 타일을 붙인 시트. 다른 에디터에는 가장 편하지만 재기는 가장 어렵습니다.']]},
   example:{title:'예시: 테스트 코퍼스의 Kenney 시트 두 장',lead:'CC0 파일을 Nerulio 격자 감지기로 잰 결과(2026-09-28):',lines:[
    'Kenney Tiny Dungeon   tilemap.png          203 × 186 px   16px 타일, 1px 간격, 여백 0',
    '열 = floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    '행 = floor((186 − 0 + 1) / (16 + 1)) = floor(187 / 17) = 11              → 132장',
    '13번 타일 = 1열 1행  → x = 0 + 1 × 17 = 17, y = 17, 크기 16 × 16',
    '감지: 16 × 16, 간격 1, 12 × 11, 점수 0.976 (높음)',
    '',
    'tilemap_packed.png    192 × 176 px   같은 타일, 간격 없음 → 192 / 16 = 12, 176 / 16 = 11',
    '감지: 16 × 16, 12 × 11, 하지만 점수 0.514 (낮음): 타일 사이에 빈 줄이 없음',
    '',
    'Kenney Pixel Platformer  tilemap.png  379 × 170 px → (379 + 1) / (18 + 1) = 20, (170 + 1) / 19 = 9',
    '타일은 16px가 아니라 18px: 감지 18 × 18, 간격 1, 20 × 9, 점수 0.946 (높음)'],
    after:'같은 그림이 간격이 있으면 0.976, 없으면 0.514입니다. 비어 있는 구분선은 시트가 줄 수 있는 가장 강한 증거입니다. 촘촘한 시트라면 이 격자 사용을 누르기 전에 점선 격자를 보거나, 알고 있는 크기를 입력하세요.'},
   verify:{title:'쓰기 전에 격자 확인하기',steps:[
    '점선이 마지막 열과 마지막 행까지 간격 위에 놓여야 합니다. 왼쪽은 맞는데 오른쪽이 틀리면 타일 크기나 간격이 어긋난 것입니다.',
    '열 × 행이 예상과 같고(Tiny Dungeon은 12 × 11 = 132), 빈 타일로 센 칸이 정말 비어 있어야 합니다.',
    '내보낸 뒤 고도 아틀라스의 Texture Region Size, Margins, Separation이 같은 값이어야 합니다. 여백 1·간격 2로 내보낸 Nerulio 고도 파일은 Godot 4.7.2에서 `TileSetAtlasSource`에 그대로 들어갔습니다.',
    '타일별 PNG가 필요하면 기존 자르기 도구는 영역을 그대로 복사하고 다시 샘플링하지 않으므로, 각 타일이 원본 사각형과 바이트 단위로 같습니다.']},
   trouble:{rows:[
    ['열이 넘어갈수록 타일이 점점 어긋남','타일 크기가 틀림: Pixel Platformer의 18px 타일을 16px + 1px로 읽으면 c번째 타일이 19 × c가 아니라 17 × c에서 시작해 열마다 2px씩 더 어긋남','첫 열은 맞는데 열 번째 열은 18px 빗나감','18px 후보를 고르거나 타일 18, 간격 1을 입력'],
    ['모든 타일이 위·왼쪽으로 1px씩 밀려 잘림','테두리를 여백으로 지정하지 않음','이미지의 첫 행과 첫 열이 비었거나 한 가지 색','여백 1로 설정. 개수 공식은 여백을 한 번 뺌'],
    ['오른쪽이나 아래에 반쪽 열·행이 남음','타일 크기가 시트를 나누지 못함. floor는 타일 하나와 간격보다 좁은 부분을 버림','(W − 여백 + 간격) ÷ (타일 + 간격)을 계산: 정수이거나 정수보다 조금 커야 함','타일 크기를 다시 확인. 남는 픽셀이 많다면 시트가 아니라 해석이 틀린 것'],
    ['첫 후보가 낮음이나 중간뿐','촘촘한 시트: 타일 사이에 빈 줄이 없고 타일 속이 복잡함','후보마다 붙은 점수와 신뢰도','점선 격자를 확인하거나, 다른 후보를 고르거나, 크기를 입력'],
    ['아주 큰 이미지에서 후보가 하나도 없음','Studio는 16메가픽셀까지의 시트만 잼','이미지 너비 × 높이','타일 크기·여백·간격을 직접 입력'],
    ['다른 에디터가 시트를 받지 않음','간격을 받지 않는 에디터가 있음: Sprite Fusion은 타일셋 너비와 높이가 타일 크기의 정확한 배수여야 함','W ÷ 타일이 정수인가?','시트의 촘촘한 버전을 쓰거나 간격 없이 다시 패킹']]},
   alternatives:{rows:[
    ['엔진에 숫자를 직접 입력: 고도 아틀라스(Texture Region Size, Margins, Separation)나 Tiled 새 타일셋 대화상자(타일 크기, Margin, Spacing)','에셋 팩의 설명서 등으로 격자를 이미 알고 있을 때.'],
    ['[[tile-grid-slicer|기존 타일 격자 자르기]]','타일마다 PNG 파일, 완전·유사 중복 찾기, 회전·뒤집기 변형, 번짐을 막는 [[atlas-padding|가장자리 확장 아틀라스]]가 필요할 때.'],
    ['[[sprite-slicer|스프라이트 자르기]]','크기가 제각각인 스프라이트가 격자 없이 놓인 시트일 때. 타일 자르기는 규칙적인 격자가 필요합니다.']]},
   limits:['규칙적인 격자만 다룹니다. 아이소메트릭·육각 시트는 모델링하지 않습니다.','Studio는 타일마다 PNG를 쓰지 않습니다. 그 기능은 기존 자르기 도구에 있습니다.','축마다 타일이 하나뿐인 시트는 잴 주기가 없습니다.'],
   versions:{body:['공식과 사각형은 src/game/tile-grid.js의 `tileRects` 그대로입니다. 감지는 합성 시트 10장에서 확인했고(10장 모두 실제 격자가 1위), 위의 Kenney 숫자는 2026-09-28에 코퍼스 파일로 쟀습니다. 2026-09-22 Godot 4.7.2 실행에서 만들어진 TileSet이 여백 1과 간격 2를 그대로 읽어 냈습니다. 엔진의 필드 이름은 링크한 공식 문서를 따릅니다.'],sources:[S.ko.godotTilesets,S.ko.tiledTilesets,S.ko.sfImport]}
  },
  ja:{
   answer:'タイルセットを切り分けるには、軸ごとに3つの数が必要です。タイルサイズ、余白（最初のタイルの前のピクセル）、間隔（タイル同士の間のピクセル）です。個数は列 = floor((幅 − 余白 + 間隔) ÷ (タイル + 間隔))で、行も同じです。Kenney Tiny Dungeonの203 × 186pxのシートは、16pxのタイルと1pxの間隔で12 × 11 = 132枚になります。Studioはこれらの数をピクセルから測り、「このグリッドを使う」を押すまで最良のグリッドを点線で示し、Godot 4・Tiled・Unity・LDtkへの書き出しにそのまま渡します。タイルごとのPNGのZIPは[[tile-grid-slicer|従来のタイルグリッド分割]]で作れます。',
   concept:{title:'グリッドのモデル、計算式、数の測り方',body:[
    'タイルはすべて同じ大きさです。余白は最初の列（と行）の前で一度だけ飛ばし、間隔は隣り合う2枚の間にあり、最後のタイルの後ろには何も仮定しません。したがってタイル(c, r)はx = 余白 + c × (タイル + 間隔)、y = 余白 + r × (タイル + 間隔)から始まります。Godotは同じ数をTexture Region Size、Margins、Separationと呼び、Tiledはタイルサイズ、Margin、Spacingと呼びます。',
    'n枚のタイルには余白 + n × タイル + (n − 1) × 間隔のピクセルが要るので、入る最大数はfloor((W − 余白 + 間隔) ÷ (タイル + 間隔))です。両側の余白が同じなら、教科書どおりの(W − 2 × 余白 + 間隔) ÷ (タイル + 間隔)が割り切れます。Nerulioのfloorは、右側に残る帯がタイル1枚と間隔より狭ければ同じ個数になり、数ピクセル余ったシートでもきれいに切れるのはこのためです。',
    '検出器は画像を1行ずつ読み、各行・各列が前の行とどれだけ違うかを見ます。その変化の並びを4pxから画像の半分までのあらゆる周期で折り重ね、変化を最もよく説明する周期を選び、位相を確かめ、余白や間隔と主張する行が本当に空か単色かを調べます。どのタイルも最初か最後の行が空なら「16px＋1pxの間隔」が「17pxのタイル」に勝ち、本当のサイズの倍数は、約数のスコアが0.02以内なら負けます。Studioは公開オートタイル配置がぴったり収まるサイズも併せて試します。',
    '最も苦手なのは区切りがまったくないシート、つまりタイルの中身が縁より複雑な詰めたシートです。軸ごとにタイルが1枚しかないと測れず、Studioが測るのは16メガピクセルまでの画像です。それより大きい場合はサイズを入力してください。'],
    terms:[['タイルサイズ','タイル1枚の幅と高さ（Godot：Texture Region Size）。'],['余白','左端と上端で、最初のタイルの前にあるピクセル。'],['間隔','隣り合うタイルの間のピクセル（Godot：Separation）。多くは1px、縁のピクセルを引き伸ばしたものもある。'],['詰めたシート','間隔なしでタイルを並べたシート。ほかのエディターには最も扱いやすく、測るのは最も難しい。']]},
   example:{title:'例：テストコーパスのKenneyシート2枚',lead:'CC0のファイルをNerulioのグリッド検出器で測った結果（2026-09-28）：',lines:[
    'Kenney Tiny Dungeon   tilemap.png          203 × 186 px   16pxタイル、間隔1px、余白0',
    '列 = floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    '行 = floor((186 − 0 + 1) / (16 + 1)) = floor(187 / 17) = 11              → 132枚',
    'タイル13 = 1列目・1行目  → x = 0 + 1 × 17 = 17、y = 17、サイズ16 × 16',
    '検出：16 × 16、間隔1、12 × 11、スコア0.976（高）',
    '',
    'tilemap_packed.png    192 × 176 px   同じタイル、間隔なし → 192 / 16 = 12、176 / 16 = 11',
    '検出：16 × 16、12 × 11、ただしスコア0.514（低）：タイル間に空の行がない',
    '',
    'Kenney Pixel Platformer  tilemap.png  379 × 170 px → (379 + 1) / (18 + 1) = 20、(170 + 1) / 19 = 9',
    'タイルは16pxではなく18px：検出18 × 18、間隔1、20 × 9、スコア0.946（高）'],
    after:'同じ絵でも間隔があれば0.976、なければ0.514です。空の区切り線は、シートが示せる最も強い手がかりです。詰めたシートでは「このグリッドを使う」を押す前に点線のグリッドを確かめるか、わかっているサイズを入力してください。'},
   verify:{title:'使う前にグリッドを確かめる',steps:[
    '点線が最後の列・最後の行まで間隔の上に乗っていること。左は合っているのに右がずれるなら、タイルサイズか間隔が違います。',
    '列 × 行が予想どおりで（Tiny Dungeonなら12 × 11 = 132）、空タイルとして数えたマスが本当に空であること。',
    '書き出し後、Godotのアトラスで Texture Region Size、Margins、Separationが同じ値であること。余白1・間隔2で書き出したNerulioのGodotファイルは、Godot 4.7.2で`TileSetAtlasSource`にそのまま入りました。',
    'タイルごとのPNGが要るなら、従来の分割ツールは領域をそのままコピーし再サンプリングしないので、各タイルが元の矩形とバイト単位で一致します。']},
   trouble:{rows:[
    ['列が進むほどタイルがずれていく','タイルサイズの誤り：Pixel Platformerの18pxタイルを16px＋1pxと読むと、c番目のタイルが19 × cではなく17 × cから始まり、1列ごとに2pxずつずれる','最初の列は合うのに10列目では18px外れる','18pxの候補を選ぶか、タイル18・間隔1を入力'],
    ['すべてのタイルが上と左に1pxずれて切れる','外周の枠を余白として指定していない','画像の最初の行と列が空か単色','余白を1にする。個数の式は余白を1回だけ引く'],
    ['右端や下端に半端な列・行が残る','タイルサイズがシートを割り切れない。floorはタイル1枚と間隔より狭い部分を捨てる','(W − 余白 + 間隔) ÷ (タイル + 間隔)を計算：整数か、整数よりわずかに大きいはず','タイルサイズを見直す。余りが大きいならシートではなく読み取りが間違っている'],
    ['最初の候補が低か中しかない','詰めたシート：タイル間に空の行がなく、中身が複雑','各候補のスコアと信頼度','点線のグリッドを確かめる、別の候補を選ぶ、またはサイズを入力'],
    ['とても大きい画像で候補が1つも出ない','Studioが測るのは16メガピクセルまで','画像の幅 × 高さ','タイルサイズ・余白・間隔を手で入力'],
    ['ほかのエディターがシートを受け付けない','間隔を扱わないエディターがある：Sprite Fusionはタイルセットの幅と高さがタイルサイズのちょうど倍数であることを求める','W ÷ タイルが整数か','シートの詰めた版を使うか、間隔なしで詰め直す']]},
   alternatives:{rows:[
    ['エンジンに数を直接入力：Godotのアトラス（Texture Region Size、Margins、Separation）やTiledの新規タイルセット画面（タイルサイズ、Margin、Spacing）','素材パックの説明などでグリッドがもうわかっているとき。'],
    ['[[tile-grid-slicer|従来のタイルグリッド分割]]','タイルごとのPNG、完全一致と近似の重複検出、回転・反転の派生、にじみ対策の[[atlas-padding|縁を拡張したアトラス]]が欲しいとき。'],
    ['[[sprite-slicer|スプライト分割]]','大きさの違うスプライトがグリッドなしで並んだシートのとき。タイルの分割には規則的なグリッドが必要です。']]},
   limits:['規則的なグリッドのみ扱います。アイソメトリック・六角形のシートはモデル化していません。','StudioはタイルごとのPNGを書き出しません。その機能は従来の分割ツールにあります。','軸ごとにタイルが1枚しかないシートには、測る周期がありません。'],
   versions:{body:['計算式と矩形はsrc/game/tile-grid.jsの`tileRects`そのものです。検出は合成シート10枚で確認し（10枚すべてで本当のグリッドが1位）、上のKenneyの数値は2026-09-28にコーパスのファイルで測りました。2026-09-22のGodot 4.7.2の実行では、作成したTileSetから余白1と間隔2がそのまま読み戻せました。エンジンの項目名はリンク先の公式ドキュメントに基づきます。'],sources:[S.ja.godotTilesets,S.ja.tiledTilesets,S.ja.sfImport]}
  }
 },
/*END*/
};
