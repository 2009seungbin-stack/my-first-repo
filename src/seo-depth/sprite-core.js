/** Intent content for the sprite-core pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/grid-detect.js, src/studio/sprite/import-plan.js (customFit),
 * src/studio/sprite/grid-rerank.js, src/game/frame-ops.js (normalizeFrames, alignOffset),
 * src/game/jitter.js (jitterReport, autoFixJitter; the worked jitter numbers were computed with it),
 * src/game/contour.js (collisionPolygons), src/studio/workspaces/sprite.js (defaults), src/game/export/*
 * (what each target writes), src/game/export/anim.js (GIF/APNG), docs/STUDIO-SPRITE.md, docs/STUDIO-PACK.md,
 * docs/ENGINE-VERIFY.md, docs/SEO-KEYWORDS.md §4 (ezgif hands-on). Engine behaviour: the official docs and
 * official source repositories cited in each page's `versions.sources`. */
const S={
 godotAnim:'[Godot 4.7 docs: AnimatedSprite2D](https://docs.godotengine.org/en/stable/classes/class_animatedsprite2d.html)',
 godotTut:'[Godot 4.7 docs: 2D sprite animation](https://docs.godotengine.org/en/stable/tutorials/2d/2d_sprite_animation.html)',
 godotArea:'[Godot 4.7 docs: Area2D](https://docs.godotengine.org/en/stable/classes/class_area2d.html)',
 godotPoly:'[Godot 4.7 docs: CollisionPolygon2D](https://docs.godotengine.org/en/stable/classes/class_collisionpolygon2d.html)',
 godotRect:'[Godot 4.7 docs: RectangleShape2D](https://docs.godotengine.org/en/stable/classes/class_rectangleshape2d.html)',
 godotMeta:'[Godot 4.7 docs: Object.get_meta](https://docs.godotengine.org/en/stable/classes/class_object.html)',
 unityEditor:'[Unity 6 manual: Sprite Editor tab reference](https://docs.unity3d.com/Manual/sprite/sprite-editor/sprite-editor-window-reference.html)',
 unitySlice:'[Unity 6 manual: Use the Sprite Editor](https://docs.unity3d.com/Manual/sprite/sprite-editor/use-editor.html)',
 unityPhys:'[Unity 6 manual: Create collision shapes for a sprite](https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/create-collision-geometry.html)',
 unityPoints:'[Unity scripting API: PolygonCollider2D.points](https://docs.unity3d.com/ScriptReference/PolygonCollider2D-points.html)',
 unityBox:'[Unity scripting API: BoxCollider2D](https://docs.unity3d.com/ScriptReference/BoxCollider2D.html)',
 phaserJson:'[Phaser 3.90 source: JSONHash parser (pivot, trim)](https://github.com/phaserjs/phaser/blob/v3.90.0/src/textures/parsers/JSONHash.js)',
 phaserAnim:'[Phaser 3.90 source: AnimationState.setCurrentFrame](https://github.com/phaserjs/phaser/blob/v3.90.0/src/animations/AnimationState.js)',
 phaserBody:'[Phaser docs: Arcade Physics Body](https://docs.phaser.io/api-documentation/class/physics-arcade-body)',
 pixiAnim:'[PixiJS 8 docs: AnimatedSprite (updateAnchor)](https://pixijs.download/release/docs/scene.AnimatedSprite.html)',
 pixiSheet:'[PixiJS 8 docs: Spritesheet](https://pixijs.download/release/docs/assets.Spritesheet.html)',
 pixiTex:'[PixiJS 8 docs: Texture.defaultAnchor](https://pixijs.download/release/docs/rendering.Texture.html)',
 aseSlices:'[Aseprite docs: Slices](https://www.aseprite.org/docs/slices/)',
 aseTags:'[Aseprite docs: Tags](https://www.aseprite.org/docs/tags/)',
 aseCli:'[Aseprite docs: Command line interface](https://www.aseprite.org/docs/cli/)',
 tpTrim:'[TexturePacker docs: Trim mode](https://www.codeandweb.com/texturepacker/documentation/texture-settings)',
 gmSprites:'[GameMaker manual: The Sprite Editor](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Sprites.htm)',
 gif:'[W3C: GIF89a specification (Delay Time, Disposal Method)](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)',
 ezCutter:'[ezgif: Sprite sheet cutter](https://ezgif.com/sprite-cutter)',
 ezMaker:'[ezgif: GIF maker](https://ezgif.com/maker)'
};
export default {
 // ------------------------------------------------------------------ sprite-slicer
 'sprite-slicer':{
  type:'tool',
  intent:{primary:'cut a sprite sheet into individual frames',secondary:['find the cell size, margin and spacing','cut irregular sheets without a grid','remove a magenta background'],
   goal:'every frame of the sheet as its own region, in order, ready for animation or engine export',input:'PNG sprite sheet (grid, irregular or colour-keyed)',output:'frames in a Studio project (engine export next); separate PNGs from the classic Sprite Lab',support:'full',
   evidence:['src/game/grid-detect.js (candidates, MAX_MARGIN 64, spacing ≤ min(16, cell/4))','src/studio/sprite/import-plan.js customFit','src/studio/sprite/grid-rerank.js','docs/STUDIO-SPRITE.md §9–10 (16/16 real assets)'],
   external:['Unity 6 Sprite Editor slice types and parameters','Godot 4.7 Add frames from a Sprite Sheet']},
  en:{
   answer:'Cutting a sprite sheet needs four numbers per axis: the cell width and height, the margin before the first cell and the spacing between cells. Drop the PNG here and Nerulio measures them from the transparent gaps in the art, previews the cut with a confidence, and cuts only when you press Apply; sheets without a grid are cut along their transparent gaps instead. The frames stay in one project for tags, timing and engine export; one PNG file per frame comes from the classic Sprite Lab.',
   concept:{title:'Cell, margin and spacing: how a grid sheet is laid out',body:[
    'A grid sheet is a table of equal cells. Column n starts at margin + n × (cell width + spacing), so one wrong number makes the cut drift, clip the first row or split sprites. The file size alone cannot tell you the grid: a 256 × 256 sheet divides evenly by 8, 16, 32, 64 and 128, and only the pixels show which one the artist used.',
    'The importer scores candidate grids on evidence it can show you: rows and columns that are fully transparent where the grid puts a gap, art that repeats at the cell pitch, content that never crosses a cell border, and content bounds that look alike in every cell. It tries margins up to 64 px and gaps up to a quarter of the cell (16 px at most), then lists the winner and its alternatives with high, medium or low confidence and the reasons.',
    'Two kinds of sheet need a different cut. Sprites of mixed sizes packed without a grid are cut as islands: each group of touching opaque pixels becomes a frame, and small pieces such as sparks are attached to the nearest sprite when that is unambiguous. Sheets drawn on flat magenta or another solid colour have no transparency to read, so the key colour is found on the border first and made transparent; the original stays in the project for undo.'],
    terms:[['Cell','One frame\'s rectangle on the sheet: width × height in pixels.'],['Margin (Offset X / Y)','Blank pixels before the first cell, from the left and from the top edge.'],['Spacing (Gap X / Y)','Blank pixels between two neighbouring cells.'],['Islands','Frames cut along transparent gaps instead of a grid, for sheets without one.']]},
   example:{title:'Example: a 136 × 68 sheet with a 1 px margin and 2 px gaps',lead:'Four columns and two rows of 32 × 32 frames. Where each cell starts, and what goes wrong without the margin and gap:',lines:[
    'x of column n = 1 + n × (32 + 2)       → 1, 35, 69, 103',
    'y of row r    = 1 + r × (32 + 2)       → 1, 35',
    'width used    = 1 + 4 × 32 + 3 × 2 = 135   → 1 px left over (right margin)',
    'height used   = 1 + 2 × 32 + 1 × 2 = 67    → 1 px left over (bottom margin)',
    'Custom grid   W 32  H 32  Offset 1  Gap 2  → "4 × 2 = 8 whole cells fit"',
    '',
    'typed as 32 × 32, no offset, no gap: column n starts at n × 32 → 0, 32, 64, 96',
    'error per column                       → 1, 3, 5, 7 px (grows by the gap)'],
    after:'The Custom grid panel does this arithmetic live and reports the pixels left over on the right and bottom. When the numbers are wrong the error grows column by column; [[game/sprite-sheet-slicing-off|slicing that drifts or clips]] walks through each case.'},
   verify:{steps:[
    'Before Apply, compare the preview\'s frame count with the frames you can see; empty cells at the end of a half-filled row are skipped, not counted.',
    'After Apply, switch to Sheet view (`): every region outline should run through the gaps, never through the art. Drag any region that is still off.',
    'Play one row with Enter. A frame that jumps by a whole gap width means the spacing is wrong; a one-pixel bob is usually drawn that way ([[normalize-sprite-frames|align the frames]] if not).',
    'In Islands mode look for pieces drawn in red: they belong to no frame and are left out unless you drag a region over them.']},
   trouble:{rows:[
    ['Each column is a little further off than the last','Spacing between cells that the grid ignores','In Sheet view the error grows by the same amount per column','Set Gap X (and Gap Y), or pick the listed alternative that has the gap'],
    ['The whole sheet becomes one frame','An opaque background: magenta, black or another flat colour leaves no transparency between frames','The import panel shows no key-colour decision, or a rejected one','Choose the key-colour alternative in the import panel; the untouched original stays for undo'],
    ['Sprites are cut in half, or two sprites share a frame','The cell is half or double the real size','The frame count is double or half of what you see','Pick the other cell size from the list or type it; use Islands for sprites of different sizes'],
    ['Sparks or dust vanish or become tiny frames','Islands mode treats detached pixels as pieces; pieces far from every sprite stay unassigned','Red pieces on the canvas in the preview','Drag the frame region over them, or cut by a grid instead of islands']]},
   alternatives:{rows:[
    ['The engine\'s own slicer: Godot\'s SpriteFrames panel (Add frames from a Sprite Sheet) or Unity\'s Sprite Editor (Slice: Grid By Cell Size, Grid By Cell Count, Automatic)','You already know the cell size and want the frames inside the project. Unity\'s slicer also takes Offset and Padding. See [[game/godot-sprite-sheet|sprite sheets in Godot]] and [[game/unity-sprite-sheet|sprite sheets in Unity]].'],
    ['The classic Sprite Lab','You need one PNG file per frame in a ZIP: [[game/sprite-sheet-to-png-frames|sprite sheet to PNG frames]].'],
    ['The atlas data that came with the sheet','A packed atlas has no grid at all; open the PNG together with its JSON or XML in the [[game/sprite-atlas-viewer|atlas viewer]].']]},
   limits:['Automatic detection searches margins up to 64 px and gaps up to 16 px; a wider layout needs the Custom grid.','A trimmed or rotated atlas cannot be recovered from the PNG alone; its data file holds the rectangles.','Separate PNG files per frame are not a Studio export yet.'],
   versions:{body:['With the default choices the importer cut 16 of 16 real assets correctly (plain and colour-keyed sheets, a 4096² effect sheet, atlas data, frame files, GIFs and .aseprite files; 2026-09-23). The engine slicers named above are described from the Unity 6 manual and the Godot 4.7 documentation.'],sources:[S.unityEditor,S.unitySlice,S.godotTut]}
  },
  ko:{
   answer:'스프라이트 시트를 자르려면 축마다 네 값이 필요합니다. 칸의 너비와 높이, 첫 칸 앞의 여백(마진), 칸 사이 간격입니다. PNG를 여기에 놓으면 Nerulio가 그림 사이의 투명한 틈에서 이 값을 재고, 신뢰도와 함께 자를 모습을 미리 보여 주며, 적용을 눌러야 비로소 자릅니다. 격자가 없는 시트는 투명한 틈을 따라 자릅니다. 프레임은 태그·타이밍·엔진 내보내기를 위해 한 프로젝트에 남고, 프레임마다 PNG 파일 하나가 필요하면 기존 스프라이트 랩을 씁니다.',
   concept:{title:'칸·마진·간격: 격자 시트의 구조',body:[
    '격자 시트는 같은 크기 칸으로 된 표입니다. n번째 열은 마진 + n × (칸 너비 + 간격)에서 시작하므로 값 하나만 틀려도 잘린 위치가 점점 밀리거나 첫 줄이 잘리거나 스프라이트가 둘로 나뉩니다. 파일 크기만으로는 격자를 알 수 없습니다. 256 × 256 시트는 8, 16, 32, 64, 128로 모두 나누어떨어지고, 작가가 어느 값을 썼는지는 픽셀만 알려 줍니다.',
    '가져오기는 보여 줄 수 있는 근거로 후보 격자에 점수를 매깁니다. 격자상 틈이어야 할 행과 열이 완전히 투명한지, 그림이 칸 간격으로 반복되는지, 내용이 칸 경계를 넘지 않는지, 칸마다 내용의 범위가 비슷한지입니다. 마진은 64px까지, 간격은 칸의 4분의 1(최대 16px)까지 찾아보고, 가장 좋은 후보와 대안을 높음·중간·낮음 신뢰도와 근거와 함께 보여 줍니다.',
    '다르게 잘라야 하는 시트가 두 가지 있습니다. 크기가 제각각인 스프라이트를 격자 없이 채운 시트는 덩어리(아일랜드) 단위로 자릅니다. 서로 닿은 불투명 픽셀 묶음이 프레임 하나가 되고, 불꽃 같은 작은 조각은 가장 가까운 스프라이트가 분명할 때 거기에 붙습니다. 마젠타나 단색 배경에 그린 시트는 읽을 투명도가 없으므로 먼저 테두리에서 배경색을 찾아 투명하게 만들고, 원본은 되돌리기용으로 프로젝트에 남깁니다.'],
    terms:[['칸(셀)','시트 위 프레임 하나의 사각형. 너비 × 높이(픽셀).'],['마진(오프셋 X / Y)','첫 칸 앞, 왼쪽과 위쪽 가장자리의 빈 픽셀.'],['간격(Gap X / Y)','이웃한 두 칸 사이의 빈 픽셀.'],['아일랜드','격자 대신 투명한 틈을 따라 자른 프레임. 격자가 없는 시트용.']]},
   example:{title:'예시: 마진 1px, 간격 2px인 136 × 68 시트',lead:'32 × 32 프레임이 4열 2행입니다. 칸이 시작하는 위치와, 마진·간격을 빼먹었을 때 생기는 일:',lines:[
    'n열의 x = 1 + n × (32 + 2)            → 1, 35, 69, 103',
    'r행의 y = 1 + r × (32 + 2)            → 1, 35',
    '쓰인 너비 = 1 + 4 × 32 + 3 × 2 = 135   → 오른쪽 1px 남음(오른쪽 마진)',
    '쓰인 높이 = 1 + 2 × 32 + 1 × 2 = 67    → 아래 1px 남음(아래 마진)',
    '직접 격자  W 32  H 32  오프셋 1  간격 2  → "4 × 2 = 칸 8개가 온전히 들어감"',
    '',
    '오프셋·간격 없이 32 × 32로 입력하면 n열은 n × 32에서 시작 → 0, 32, 64, 96',
    '열마다 어긋남                          → 1, 3, 5, 7px(간격만큼 커짐)'],
    after:'직접 격자 패널은 이 계산을 입력하는 즉시 보여 주고 오른쪽과 아래에 남는 픽셀도 알려 줍니다. 값이 틀리면 어긋남이 열마다 커집니다. 경우별 진단은 [[game/sprite-sheet-slicing-off|자른 위치가 밀리거나 잘릴 때]]를 보세요.'},
   verify:{steps:[
    '적용 전에 미리보기의 프레임 수를 눈에 보이는 프레임 수와 비교합니다. 반만 찬 마지막 줄의 빈 칸은 세지 않고 건너뜁니다.',
    '적용 후 시트 보기(`)로 바꿉니다. 모든 영역 윤곽이 그림이 아니라 틈을 지나야 합니다. 아직 어긋난 영역은 드래그해 옮기세요.',
    '한 줄을 Enter로 재생합니다. 간격 폭만큼 튀는 프레임은 간격 값이 틀린 것이고, 1px 정도 들썩이는 건 대개 원래 그렇게 그린 것입니다(아니라면 [[normalize-sprite-frames|프레임 정렬]]).',
    '아일랜드 모드에서는 빨간 조각이 있는지 봅니다. 어느 프레임에도 속하지 않아, 영역을 넓혀 덮지 않으면 빠집니다.']},
   trouble:{rows:[
    ['열마다 조금씩 더 어긋남','격자가 칸 사이 간격을 무시함','시트 보기에서 어긋남이 열마다 같은 만큼 늘어남','간격 X(필요하면 Y)를 넣거나, 목록에서 간격이 있는 대안을 고름'],
    ['시트 전체가 프레임 하나가 됨','불투명한 배경(마젠타·검정·단색)이라 프레임 사이에 투명한 틈이 없음','가져오기 패널에 배경색 결정이 없거나 거부된 상태','가져오기 패널에서 배경색 대안을 선택. 손대지 않은 원본은 되돌리기용으로 남음'],
    ['스프라이트가 반으로 잘리거나 두 개가 한 프레임에 들어감','칸 크기가 실제의 절반이나 두 배','프레임 수가 눈에 보이는 수의 두 배이거나 절반','목록에서 다른 칸 크기를 고르거나 직접 입력. 크기가 제각각이면 아일랜드'],
    ['불꽃이나 먼지가 사라지거나 아주 작은 프레임이 됨','아일랜드 모드는 떨어진 픽셀을 조각으로 보고, 어느 스프라이트와도 먼 조각은 배정하지 않음','미리보기 캔버스에 빨간 조각이 보임','프레임 영역을 넓혀 덮거나, 아일랜드 대신 격자로 자르기']]},
   alternatives:{rows:[
    ['엔진 자체의 자르기: Godot SpriteFrames 패널(Add frames from a Sprite Sheet), Unity Sprite Editor(Slice: Grid By Cell Size, Grid By Cell Count, Automatic)','칸 크기를 이미 알고 프레임을 프로젝트 안에서 만들고 싶을 때. Unity 쪽은 Offset과 Padding도 받습니다. [[game/godot-sprite-sheet|Godot에서 스프라이트 시트 쓰기]], [[game/unity-sprite-sheet|Unity에서 스프라이트 시트 쓰기]] 참고.'],
    ['기존 스프라이트 랩','프레임마다 PNG 파일 하나를 ZIP으로 받아야 할 때: [[game/sprite-sheet-to-png-frames|스프라이트 시트를 PNG 프레임으로]].'],
    ['시트와 함께 온 아틀라스 데이터','패킹된 아틀라스에는 격자가 아예 없습니다. PNG와 JSON·XML을 함께 [[game/sprite-atlas-viewer|아틀라스 뷰어]]로 여세요.']]},
   limits:['자동 감지는 마진 64px, 간격 16px까지 찾습니다. 그보다 넓으면 직접 격자로 입력하세요.','트림되거나 회전된 아틀라스는 PNG만으로 되살릴 수 없습니다. 사각형 정보는 데이터 파일에 있습니다.','프레임별 PNG 파일은 아직 Studio 내보내기에 없습니다.'],
   versions:{body:['기본 선택 그대로 실제 에셋 16개를 모두 올바르게 잘랐습니다(일반·배경색 시트, 4096² 이펙트 시트, 아틀라스 데이터, 프레임 파일, GIF, .aseprite; 2026-09-23). 위에 적은 엔진 자르기 기능은 Unity 6 매뉴얼과 Godot 4.7 문서를 따릅니다.'],sources:[S.unityEditor,S.unitySlice,S.godotTut]}
  },
  ja:{
   answer:'スプライトシートを切り分けるには、軸ごとに4つの値が要ります。セルの幅と高さ、最初のセルまでの余白（マージン）、セル同士の間隔です。PNGをここにドロップすると、Nerulioが絵のあいだの透明なすき間からこれらを測り、信頼度つきで切り方をプレビューし、適用を押したときに初めて切り出します。グリッドのないシートは透明なすき間に沿って切ります。フレームはタグ・タイミング・エンジン書き出しのために1つのプロジェクトに残り、フレームごとのPNGファイルは従来のスプライトラボで作れます。',
   concept:{title:'セル・マージン・間隔：グリッドシートの構造',body:[
    'グリッドシートは同じ大きさのセルが並んだ表です。n列目は「マージン + n ×（セル幅 + 間隔）」から始まるので、値が1つ違うだけで切り位置がずれていく、1行目が欠ける、スプライトが2つに割れる、といったことが起きます。ファイルの大きさだけではグリッドは決まりません。256 × 256のシートは8・16・32・64・128のどれでも割り切れ、作者がどれを使ったかはピクセルを見ないとわかりません。',
    'インポートは、示せる根拠で候補のグリッドを採点します。グリッド上すき間になるはずの行・列が完全に透明か、絵がセルの周期で繰り返しているか、内容がセルの境界をまたがないか、セルごとの内容の範囲が似ているか、です。マージンは64pxまで、間隔はセルの4分の1（最大16px）まで試し、最有力の候補と代替案を高・中・低の信頼度と理由つきで並べます。',
    '別の切り方が必要なシートが2種類あります。大きさの違うスプライトをグリッドなしで詰めたシートは「島」単位で切ります。つながった不透明ピクセルのまとまりが1フレームになり、火花のような小さな欠片は、最寄りのスプライトがはっきりしていればそこに付きます。マゼンタなどの単色背景に描いたシートは透明度がないため、まず外周から背景色を見つけて透明にし、元の画像は取り消し用にプロジェクトに残します。'],
    terms:[['セル','シート上の1フレーム分の矩形。幅 × 高さ（ピクセル）。'],['マージン（オフセット X / Y）','最初のセルの手前、左端と上端の空きピクセル。'],['間隔（Gap X / Y）','隣り合う2つのセルのあいだの空きピクセル。'],['島（アイランド）','グリッドではなく透明なすき間に沿って切ったフレーム。グリッドのないシート用。']]},
   example:{title:'例：マージン1px・間隔2pxの136 × 68シート',lead:'32 × 32のフレームが4列2行。各セルの開始位置と、マージンと間隔を入れ忘れたときに起きること：',lines:[
    'n列目のx = 1 + n × (32 + 2)          → 1, 35, 69, 103',
    'r行目のy = 1 + r × (32 + 2)          → 1, 35',
    '使う幅   = 1 + 4 × 32 + 3 × 2 = 135  → 右に1px余る（右マージン）',
    '使う高さ = 1 + 2 × 32 + 1 × 2 = 67   → 下に1px余る（下マージン）',
    'カスタムグリッド W 32 H 32 オフセット 1 間隔 2 → 「4 × 2 = 8セルがまるごと収まる」',
    '',
    'オフセットも間隔もなしで32 × 32と入れると、n列目はn × 32から → 0, 32, 64, 96',
    '列ごとのずれ                          → 1, 3, 5, 7px（間隔ぶんずつ増える）'],
    after:'カスタムグリッドのパネルは、この計算を入力と同時に行い、右と下に余るピクセル数も表示します。値が違うとずれは列ごとに大きくなります。症状別の診断は[[game/sprite-sheet-slicing-off|切り位置がずれる・欠けるとき]]を参照してください。'},
   verify:{steps:[
    '適用の前に、プレビューのフレーム数と目に見えるフレーム数を比べます。半端な最終行の空セルは数えずに飛ばします。',
    '適用後、シート表示（`）に切り替えます。どの領域の枠も絵ではなくすき間を通っているはずです。ずれている領域はドラッグで直します。',
    '1行をEnterで再生します。間隔の幅ぶん跳ねるフレームは間隔の値が違います。1px程度の上下動は、たいてい元の絵がそうなっています（違うなら[[normalize-sprite-frames|フレームをそろえる]]）。',
    '島モードでは赤い欠片がないか確認します。どのフレームにも属さず、領域を広げて覆わないかぎり抜け落ちます。']},
   trouble:{rows:[
    ['列が進むごとに少しずつずれる','セル間の間隔をグリッドが無視している','シート表示で、ずれが列ごとに同じだけ増える','間隔X（必要ならY）を入れるか、一覧から間隔つきの候補を選ぶ'],
    ['シート全体が1フレームになる','不透明な背景（マゼンタ・黒・単色）でフレームのあいだに透明なすき間がない','インポートパネルに背景色の判断がない、または却下されている','インポートパネルで背景色の候補を選ぶ。手つかずの元画像は取り消し用に残る'],
    ['スプライトが半分に切れる／2体が1フレームに入る','セルの大きさが実際の半分か2倍','フレーム数が見た目の2倍か半分','一覧から別のセルサイズを選ぶか入力する。大きさがまちまちなら島モード'],
    ['火花や砂ぼこりが消える、または極小のフレームになる','島モードは離れたピクセルを欠片とみなし、どのスプライトからも遠い欠片は割り当てない','プレビューのキャンバスに赤い欠片がある','フレーム領域を広げて覆うか、島ではなくグリッドで切る']]},
   alternatives:{rows:[
    ['エンジン側の分割機能：GodotのSpriteFramesパネル（Add frames from a Sprite Sheet）、UnityのSprite Editor（Slice: Grid By Cell Size / Grid By Cell Count / Automatic）','セルの大きさがわかっていて、プロジェクトの中でフレームを作りたいとき。Unity側はOffsetとPaddingも指定できます。[[game/godot-sprite-sheet|Godotでスプライトシートを使う]]、[[game/unity-sprite-sheet|Unityでスプライトシートを使う]]も参照。'],
    ['従来のスプライトラボ','フレームごとのPNGファイルをZIPで欲しいとき：[[game/sprite-sheet-to-png-frames|スプライトシートをPNGフレームに]]。'],
    ['シートに付いてきたアトラスデータ','パック済みのアトラスにはそもそもグリッドがありません。PNGとJSON・XMLを一緒に[[game/sprite-atlas-viewer|アトラスビューア]]で開いてください。']]},
   limits:['自動検出が探すのはマージン64px・間隔16pxまでです。それより広いレイアウトはカスタムグリッドで入力します。','トリムや回転をしたアトラスはPNGだけでは復元できません。矩形の情報はデータファイルにあります。','フレームごとのPNGファイルは、まだStudioの書き出しにありません。'],
   versions:{body:['既定の選択のまま、実在のアセット16件をすべて正しく切り出しました（通常・背景色つきシート、4096²のエフェクトシート、アトラスデータ、フレーム画像、GIF、.aseprite；2026-09-23）。上に挙げたエンジン側の分割機能は、Unity 6マニュアルとGodot 4.7ドキュメントに基づきます。'],sources:[S.unityEditor,S.unitySlice,S.godotTut]}
  }
 },
 // ------------------------------------------------------------------ game/sprite-lab
 'game/sprite-lab':{
  type:'create',
  intent:{primary:'turn sprite art into tagged, timed game animations with pivots and boxes, and export them',secondary:['import sheets, GIFs and .aseprite files','per-frame durations and tags','engine files for Godot, Unity, Phaser'],
   goal:'one project whose animations, timing, pivots and boxes arrive in the chosen engine',input:'PNG sheet, numbered frames, GIF/APNG, .aseprite, Aseprite/TexturePacker JSON, Starling XML',output:'engine bundles (18 formats) from Pack & Export',support:'full',
   evidence:['docs/STUDIO-SPRITE.md §1–10','docs/STUDIO-PACK.md (49 engine runs, 47 pass)','src/game/export/targets.js'],
   external:['Aseprite docs: tags','Godot 4.7 AnimatedSprite2D','Unity 6 Sprite Editor pivot']},
  en:{
   answer:'The Sprite workspace is the step between finished art and a game engine. It imports a PNG sheet, numbered frame files, a GIF or APNG, an .aseprite file or an existing atlas with its JSON or XML, and turns it into animations (tags) with a duration in milliseconds on every frame, a pivot per frame and hit, hurt or custom boxes. Pack & Export then writes the files Godot 4, Unity 6, Phaser, PixiJS, LÖVE and other targets load. Painting pixels happens in the Pixel workspace of the same project.',
   concept:{title:'What a game-ready sprite needs besides pixels',body:[
    'An engine does not play a picture; it plays a list of frames. Each frame needs its rectangle on a texture, the canvas it belongs to (so a trimmed frame lands where it was drawn), a pivot that says which pixel sits on the object\'s position, and a duration. An animation is a named run of frames with a direction and a repeat count. Hit and hurt boxes are extra rectangles per frame that game code checks.',
    'The Studio keeps exactly that document. A sheet is one shared image and its frames are regions of it, so reordering or re-tagging never touches pixels. A pivot is stored as 0–1 of the frame canvas (bottom-centre 0.5, 1.0 unless you set it), durations are milliseconds (100 by default, as in Aseprite), and a tag\'s repeat follows Aseprite: 0 loops, n plays n times. Every automatic guess on import is listed with its confidence and one-click alternatives, and Apply is one undo step.',
    'Each export target writes what its engine can read and says what it cannot carry: Godot gets per-frame durations and boxes in resource metadata, Unity gets per-frame pivots and one clip per tag but no boxes, Defold plays one FPS per animation.'],
    terms:[['Tag','A named run of frames with a direction (forward, reverse, ping-pong) and a repeat count.'],['Pivot','The point of a frame that sits on the object\'s position; stored as 0–1 of the frame canvas.'],['Frame canvas','The full size a frame is drawn on, even when only its opaque part is packed.']]},
   example:{title:'Example: one 384 × 256 sheet to a Godot 4 bundle',lead:'A sheet of 8 columns × 4 rows of 48 × 64 frames, one move per row.',lines:[
    'Import     grid 48 × 64, margin 0, gap 0 · 32 frames · one animation per row',
    'Timeline   rows renamed idle, run, jump, attack',
    'idle       8 × 100 ms = 800 ms, repeat 0 (loop)',
    'attack     7 × 100 ms + frame 5 held 250 ms = 950 ms, repeat 1 (plays once)',
    'Pivot      bottom-centre (0.5, 1.0) = pixel (24, 64) on every frame',
    'Hit box    attack frames 4–6: 16 × 12 px at (34, 30), same box id on all three',
    'Export     Godot 4 → hero.tres (4 animations) + hero.png + hero.tscn + hero.png.import',
    '           attack in Godot: loop off; idle: loop on'],
    after:'The same project exports again for Unity or Phaser without redoing the timeline. What happens in Godot next is on [[game/aseprite-to-godot|Aseprite to Godot]] and [[game/godot-sprite-sheet|sprite sheets in Godot]].'},
   verify:{steps:[
    'Play every tag with Enter before export; each frame shows for its own milliseconds, and a play-once tag stops on its last frame.',
    'In Pack & Export read the line under the target: "Loaded in Godot 4.7.2" (or UNVERIFIED in amber for GameMaker) and any setting the target changes before export.',
    'After export read the notes: they list what the target could not carry, such as differing pivots in one Godot animation or boxes that Unity does not receive.',
    'Open the result in the engine and play one tag next to Nerulio\'s preview at the same zoom.']},
   trouble:{rows:[
    ['The proposed grid is wrong','Uneven gaps, or sprites of mixed sizes on a sheet that looks like a grid','The decision shows medium or low confidence, with reasons about split or crossed cells','Pick an alternative or Islands; see [[game/sprite-sheet-slicing-off|slicing that is off]]'],
    ['An .aseprite file arrives flattened','Its layers do not compose exactly in the Studio (5 of 231 test files), or cels use z-index (4 of 231)','The import panel states the reason','Frames and timing are still right; keep layered editing in Aseprite and re-import'],
    ['Boxes or pivots are missing in the engine','The target has no place for them: Unity gets pivots but no boxes, Defold and CSS get neither','The export notes under the button','Export the Godot bundle or the generic JSON for boxes, or add them in the engine'],
    ['The character hops when the animation changes','Frames have different pivots but the Godot scene node has one offset','The Godot export notes warn about differing pivots','Use one pivot for the tag, see [[game/sprite-pivot-editor|pivots per frame]]']]},
   alternatives:{rows:[
    ['Aseprite, then its File › Export Sprite Sheet and an engine plugin','You draw and animate in Aseprite anyway and your engine has a maintained importer; plugins that call Aseprite need it installed on every machine that imports.'],
    ['TexturePacker','You mainly pack many separate images into atlases for many frameworks and want its command-line automation; it does not edit tags, pivots per frame or boxes the way a sprite editor does.'],
    ['The engine\'s own editors (Unity Sprite Editor, Godot SpriteFrames panel)','One or two animations with even timing that you prefer to set up inside the project.']]},
   limits:['Rotated frames from an imported atlas stay rotated, and exporting them is UNVERIFIED; repack without rotation.','GameMaker strips are not verified in GameMaker itself.','Painting tools live in the Pixel workspace, which lacks some Aseprite tools (layer groups, tilemap layers, RotSprite, text).'],
   versions:{body:['Import: frames correct on 16 of 16 real assets with the default choices; 231 of 231 .aseprite files came back from Nerulio\'s writer into Aseprite 1.3.18 with the same tags, durations and pixels. Export: 47 of 49 engine runs pass (Godot 4.7.2, Unity 6000.5.3f1, Phaser 3.90 and 4.2, PixiJS 8.21, LÖVE 11.5, Spine runtime 4.2, Defold bob.jar 1.13.1); the two failures are Phaser 3.90\'s bug with trimmed Sparrow XML, which the Sparrow XML (Phaser 3) preset avoids.'],sources:[S.aseTags,S.godotAnim,S.unityEditor]}
  },
  ko:{
   answer:'스프라이트 작업 공간은 완성된 그림과 게임 엔진 사이의 단계입니다. PNG 시트, 번호 붙은 프레임 파일, GIF·APNG, .aseprite 파일, JSON·XML이 딸린 기존 아틀라스를 가져와서, 프레임마다 밀리초 길이가 있는 애니메이션(태그), 프레임별 피벗, 히트·허트·사용자 박스로 바꿉니다. 그다음 Pack & Export가 Godot 4, Unity 6, Phaser, PixiJS, LÖVE 등이 읽는 파일을 씁니다. 픽셀을 그리는 일은 같은 프로젝트의 픽셀 작업 공간에서 합니다.',
   concept:{title:'게임에 쓰려면 픽셀 말고도 필요한 것',body:[
    '엔진은 그림 한 장이 아니라 프레임 목록을 재생합니다. 프레임마다 텍스처 위 사각형, 원래 속한 캔버스(트림된 프레임이 그린 자리에 오도록), 오브젝트 위치에 놓일 픽셀을 뜻하는 피벗, 길이가 필요합니다. 애니메이션은 방향과 반복 횟수가 있는 이름 붙은 프레임 묶음이고, 히트·허트 박스는 게임 코드가 검사하는 프레임별 사각형입니다.',
    'Studio는 바로 이 문서를 저장합니다. 시트는 공유 그림 한 장이고 프레임은 그 위의 영역이라, 순서를 바꾸거나 태그를 다시 달아도 픽셀은 건드리지 않습니다. 피벗은 프레임 캔버스 기준 0~1로 저장하고(따로 정하지 않으면 아래 가운데 0.5, 1.0), 길이는 밀리초(Aseprite처럼 기본 100), 태그의 반복은 Aseprite 방식(0은 무한 반복, n은 n번 재생)입니다. 가져올 때의 자동 추측은 모두 신뢰도와 원클릭 대안과 함께 표시되고, 적용은 되돌리기 한 번 단위입니다.',
    '내보내기 대상마다 그 엔진이 읽을 수 있는 것을 쓰고, 담지 못하는 것은 알려 줍니다. Godot는 프레임별 길이와 박스(리소스 메타데이터)를 받고, Unity는 프레임별 피벗과 태그별 클립을 받지만 박스는 받지 않으며, Defold는 애니메이션마다 FPS 하나로 재생합니다.'],
    terms:[['태그','방향(정방향·역방향·핑퐁)과 반복 횟수가 있는, 이름 붙은 프레임 묶음.'],['피벗','오브젝트 위치에 놓이는 프레임의 점. 프레임 캔버스 기준 0~1로 저장.'],['프레임 캔버스','불투명한 부분만 패킹되더라도 프레임이 그려지는 원래 크기.']]},
   example:{title:'예시: 384 × 256 시트 한 장을 Godot 4 번들로',lead:'48 × 64 프레임이 8열 × 4행, 한 줄에 동작 하나인 시트입니다.',lines:[
    '가져오기   격자 48 × 64, 마진 0, 간격 0 · 프레임 32개 · 줄마다 애니메이션 하나',
    '타임라인   줄 이름을 idle, run, jump, attack으로 변경',
    'idle       8 × 100ms = 800ms, 반복 0(무한)',
    'attack     7 × 100ms + 5번 프레임 250ms 유지 = 950ms, 반복 1(한 번 재생)',
    '피벗       아래 가운데(0.5, 1.0) = 모든 프레임에서 픽셀 (24, 64)',
    '히트 박스  attack 4~6번 프레임: (34, 30)에 16 × 12px, 세 프레임 모두 같은 박스 id',
    '내보내기   Godot 4 → hero.tres(애니메이션 4개) + hero.png + hero.tscn + hero.png.import',
    '           Godot에서 attack은 loop 끔, idle은 loop 켬'],
    after:'같은 프로젝트를 타임라인을 다시 만들지 않고 Unity나 Phaser로도 내보낼 수 있습니다. Godot에서 이어지는 단계는 [[game/aseprite-to-godot|Aseprite를 Godot로]]와 [[game/godot-sprite-sheet|Godot에서 스프라이트 시트 쓰기]]에 있습니다.'},
   verify:{steps:[
    '내보내기 전에 모든 태그를 Enter로 재생합니다. 프레임마다 자기 밀리초만큼 보이고, 한 번 재생 태그는 마지막 프레임에서 멈춰야 합니다.',
    'Pack & Export에서 대상 아래 줄을 읽습니다. "Loaded in Godot 4.7.2"(GameMaker는 주황색 UNVERIFIED)와, 내보내기 전에 대상이 바꾸는 설정이 표시됩니다.',
    '내보낸 뒤 안내를 읽습니다. 한 Godot 애니메이션 안의 서로 다른 피벗, Unity가 받지 않는 박스처럼 대상이 담지 못한 것이 나옵니다.',
    '엔진에서 결과를 열고 같은 배율로 Nerulio 미리보기와 나란히 태그 하나를 재생해 봅니다.']},
   trouble:{rows:[
    ['제안된 격자가 틀림','간격이 고르지 않거나, 격자처럼 보이는 시트에 크기가 제각각인 스프라이트','결정의 신뢰도가 중간·낮음이고 근거에 칸 분할·경계 침범이 나옴','대안이나 아일랜드를 선택. [[game/sprite-sheet-slicing-off|자르기가 어긋날 때]] 참고'],
    ['.aseprite 파일이 합쳐진 채 들어옴','레이어가 Studio에서 정확히 합성되지 않거나(테스트 231개 중 5개), 셀이 z-index를 씀(231개 중 4개)','가져오기 패널에 이유가 나옴','프레임과 타이밍은 그대로 맞음. 레이어 편집은 Aseprite에서 하고 다시 가져오기'],
    ['엔진에서 박스나 피벗이 없음','대상에 들어갈 자리가 없음: Unity는 피벗만 받고 박스는 없음, Defold와 CSS는 둘 다 없음','내보내기 버튼 아래 안내','박스가 필요하면 Godot 번들이나 일반 JSON으로 내보내거나 엔진에서 추가'],
    ['애니메이션이 바뀔 때 캐릭터가 튐','프레임마다 피벗이 다른데 Godot 씬 노드의 오프셋은 하나','Godot 내보내기 안내에 피벗 불일치 경고','태그 전체에 피벗 하나를 쓰기. [[game/sprite-pivot-editor|프레임별 피벗]] 참고']]},
   alternatives:{rows:[
    ['Aseprite에서 File › Export Sprite Sheet 후 엔진 플러그인','어차피 Aseprite에서 그리고 움직이며, 엔진에 관리되는 가져오기 도구가 있을 때. Aseprite를 호출하는 플러그인은 가져오는 모든 컴퓨터에 Aseprite가 있어야 합니다.'],
    ['TexturePacker','주로 낱장 이미지를 여러 프레임워크용 아틀라스로 패킹하고 명령줄 자동화가 필요할 때. 태그, 프레임별 피벗, 박스를 스프라이트 편집기처럼 다루지는 않습니다.'],
    ['엔진 자체 편집기(Unity Sprite Editor, Godot SpriteFrames 패널)','타이밍이 일정한 애니메이션 한두 개를 프로젝트 안에서 설정하는 편이 좋을 때.']]},
   limits:['가져온 아틀라스의 회전된 프레임은 회전된 채 남고, 내보내기는 UNVERIFIED입니다. 회전 없이 다시 패킹하세요.','GameMaker 스트립은 GameMaker 자체에서 검증하지 않았습니다.','그리기 도구는 픽셀 작업 공간에 있고, Aseprite 도구 일부(레이어 그룹, 타일맵 레이어, RotSprite, 텍스트)는 없습니다.'],
   versions:{body:['가져오기: 기본 선택으로 실제 에셋 16개 모두 프레임이 맞았고, .aseprite 231개는 Nerulio의 쓰기를 거쳐 Aseprite 1.3.18에서 같은 태그·길이·픽셀로 다시 열렸습니다. 내보내기: 엔진 실행 49건 중 47건 통과(Godot 4.7.2, Unity 6000.5.3f1, Phaser 3.90·4.2, PixiJS 8.21, LÖVE 11.5, Spine 런타임 4.2, Defold bob.jar 1.13.1). 실패 2건은 트림된 Sparrow XML에 대한 Phaser 3.90의 버그이며, Sparrow XML (Phaser 3) 프리셋으로 피할 수 있습니다.'],sources:[S.aseTags,S.godotAnim,S.unityEditor]}
  },
  ja:{
   answer:'スプライト作業画面は、完成した絵とゲームエンジンのあいだの工程です。PNGシート、連番のフレーム画像、GIF・APNG、.asepriteファイル、JSONやXMLの付いた既存のアトラスを読み込み、フレームごとにミリ秒の長さを持つアニメーション（タグ）、フレームごとのピボット、ヒット・ハート・任意のボックスに変えます。その後Pack & Exportが、Godot 4、Unity 6、Phaser、PixiJS、LÖVEなどが読むファイルを書き出します。ピクセルを描く作業は同じプロジェクトのピクセル作業画面で行います。',
   concept:{title:'ゲームで使うには、ピクセル以外に何が要るか',body:[
    'エンジンが再生するのは1枚の絵ではなく、フレームの一覧です。フレームごとに、テクスチャ上の矩形、元のキャンバス（トリムしたフレームを描いた位置に戻すため）、オブジェクトの位置に置かれるピクセルを示すピボット、表示時間が要ります。アニメーションは方向と繰り返し回数を持つ名前付きのフレームの並びで、ヒット・ハートボックスはゲームのコードが判定に使うフレームごとの矩形です。',
    'Studioはまさにこの文書を保存します。シートは共有の画像1枚で、フレームはその上の領域なので、並べ替えやタグの付け直しでピクセルは変わりません。ピボットはフレームキャンバスに対する0〜1で保存し（指定しなければ下中央の0.5, 1.0）、長さはミリ秒（Asepriteと同じく既定100）、タグの繰り返しはAseprite方式（0は無限ループ、nはn回再生）です。読み込み時の自動判断はすべて信頼度とワンクリックの代替案つきで示され、適用は1回の取り消し単位です。',
    '書き出し先ごとに、そのエンジンが読めるものを書き、載せられないものは知らせます。Godotはフレームごとの長さとボックス（リソースのメタデータ）を受け取り、Unityはフレームごとのピボットとタグごとのクリップを受け取りますがボックスは受け取らず、Defoldはアニメーションごとに1つのFPSで再生します。'],
    terms:[['タグ','方向（順・逆・ピンポン）と繰り返し回数を持つ、名前付きのフレームの並び。'],['ピボット','オブジェクトの位置に置かれるフレーム上の点。フレームキャンバスに対する0〜1で保存。'],['フレームキャンバス','不透明部分だけをパックしても、フレームが描かれる本来の大きさ。']]},
   example:{title:'例：384 × 256のシート1枚をGodot 4のバンドルへ',lead:'48 × 64のフレームが8列 × 4行、1行に1動作のシートです。',lines:[
    '読み込み   グリッド 48 × 64、マージン 0、間隔 0 · 32フレーム · 行ごとに1アニメーション',
    'タイムライン 行の名前を idle, run, jump, attack に変更',
    'idle       8 × 100ms = 800ms、繰り返し 0（ループ）',
    'attack     7 × 100ms + 5番目を250ms保持 = 950ms、繰り返し 1（1回再生）',
    'ピボット   下中央 (0.5, 1.0) = 全フレームでピクセル (24, 64)',
    'ヒット     attack 4〜6番目：(34, 30) に 16 × 12px、3フレームとも同じボックスID',
    '書き出し   Godot 4 → hero.tres（アニメーション4つ）+ hero.png + hero.tscn + hero.png.import',
    '           Godotでは attack は loop オフ、idle は loop オン'],
    after:'同じプロジェクトは、タイムラインを作り直さずにUnityやPhaserにも書き出せます。Godotでの続きは[[game/aseprite-to-godot|AsepriteをGodotへ]]と[[game/godot-sprite-sheet|Godotでスプライトシートを使う]]にあります。'},
   verify:{steps:[
    '書き出す前にすべてのタグをEnterで再生します。各フレームが自分のミリ秒だけ表示され、1回再生のタグは最後のフレームで止まるはずです。',
    'Pack & Exportで書き出し先の下の行を読みます。「Loaded in Godot 4.7.2」（GameMakerは琥珀色のUNVERIFIED）と、書き出し前に先方の都合で変わる設定が表示されます。',
    '書き出し後の注記を読みます。1つのGodotアニメーション内でピボットが違う、Unityにボックスが渡らない、など書き出し先が載せられなかったものが並びます。',
    'エンジンで結果を開き、同じ倍率でNerulioのプレビューと並べてタグを1つ再生してみます。']},
   trouble:{rows:[
    ['提案されたグリッドが違う','間隔が不ぞろい、またはグリッドに見えるシートに大きさの違うスプライトがある','判断の信頼度が中・低で、理由にセルの分割や境界またぎが出ている','代替案か島モードを選ぶ。[[game/sprite-sheet-slicing-off|切り位置がずれるとき]]を参照'],
    ['.asepriteファイルが統合されて入る','レイヤーがStudioで正確に合成できない（テスト231件中5件）、またはセルがz-indexを使う（231件中4件）','インポートパネルに理由が出る','フレームとタイミングは正しいまま。レイヤー編集はAsepriteで行って読み込み直す'],
    ['エンジンでボックスやピボットがない','書き出し先に入れる場所がない：Unityはピボットのみでボックスなし、DefoldとCSSはどちらもなし','書き出しボタンの下の注記','ボックスが要るならGodotバンドルか汎用JSONで書き出すか、エンジン側で追加する'],
    ['アニメーションが切り替わるときにキャラが跳ねる','フレームごとにピボットが違うが、Godotのシーンのノードのオフセットは1つ','Godot書き出しの注記にピボット不一致の警告','タグ全体でピボットを1つにそろえる。[[game/sprite-pivot-editor|フレームごとのピボット]]を参照']]},
   alternatives:{rows:[
    ['AsepriteのFile › Export Sprite Sheetとエンジン用プラグイン','どのみちAsepriteで描いて動かし、エンジンに保守されたインポーターがあるとき。Asepriteを呼び出すプラグインは、取り込むすべてのPCにAsepriteが必要です。'],
    ['TexturePacker','主にばらばらの画像を多くのフレームワーク向けのアトラスにまとめ、コマンドラインで自動化したいとき。タグやフレームごとのピボット、ボックスをスプライトエディターのようには扱いません。'],
    ['エンジン内のエディター（UnityのSprite Editor、GodotのSpriteFramesパネル）','長さが均一なアニメーション1〜2個を、プロジェクトの中で設定したいとき。']]},
   limits:['読み込んだアトラスの回転フレームは回転したまま残り、その書き出しはUNVERIFIEDです。回転なしでパックし直してください。','GameMaker用ストリップはGameMaker本体では検証していません。','描画ツールはピクセル作業画面にあり、Asepriteの一部の機能（レイヤーグループ、タイルマップレイヤー、RotSprite、テキスト）はありません。'],
   versions:{body:['読み込み：既定の選択で実在アセット16件すべてのフレームが正しく、.asepriteの231件はNerulioの書き出しを経てAseprite 1.3.18で同じタグ・長さ・ピクセルのまま開けました。書き出し：エンジンでの実行49件中47件が合格（Godot 4.7.2、Unity 6000.5.3f1、Phaser 3.90・4.2、PixiJS 8.21、LÖVE 11.5、Spineランタイム4.2、Defold bob.jar 1.13.1）。不合格の2件はトリムしたSparrow XMLに対するPhaser 3.90の不具合で、Sparrow XML (Phaser 3) プリセットで回避できます。'],sources:[S.aseTags,S.godotAnim,S.unityEditor]}
  }
 },
 // ------------------------------------------------------------------ normalize-sprite-frames
 'normalize-sprite-frames':{
  type:'tool',
  intent:{primary:'put animation frames on one canvas with a shared anchor so they stop wobbling',secondary:['measure frame jitter in pixels','fix jitter without losing intended motion','no resampling of pixel art'],
   goal:'frames of one tag on one canvas size, aligned at a common anchor, with measured wobble under 1.5 px',input:'frames of different sizes (trimmed separately, cut from different sheets)',output:'the same frames on one canvas (pivots, boxes, collision moved with them), then any export',support:'full',
   evidence:['src/game/frame-ops.js normalizeFrames / alignOffset / shiftFrame','src/game/jitter.js jitterReport / autoFixJitter (window 5, warn 1.5 px, maxShift 64)','src/studio/workspaces/sprite.js normalize(), fixJitter()','docs/STUDIO-SPRITE.md §9 Align'],
   external:[]},
  en:{
   answer:'Frames that were cut or trimmed one by one have different sizes, so an engine that places each one by its corner or centre makes the character hop. Normalizing puts every frame of a tag on one canvas (the largest frame\'s width and height plus padding, unless you type a size) and places each frame\'s opaque bounds at the same anchor, such as bottom-centre, moving art by whole pixels and never scaling it. Measure then reports the wobble that is left, in pixels, and Fix removes it while keeping intended motion, or pins every frame to the first.',
   concept:{title:'Aligning, then measuring what is left',body:[
    'Aligning answers one question: where does each frame sit on its canvas? With "Measure each frame\'s opaque bounds first" on, the Studio finds each frame\'s visible pixels, makes the canvas as wide and tall as the largest of them, and places every frame so that its bounds touch the anchor. Bottom-centre puts the lowest opaque row on the canvas bottom and centres the bounds horizontally; a half pixel is rounded, never resampled, so pixel art stays sharp.',
    'Bottom-centre means the middle of the lowest opaque row, not the feet: a sword tip, a cape or a dust puff below the feet moves it. That is why aligning is followed by a measurement. Measure takes one reference point per frame (bottom-centre of the art, centre of the art, the alpha centroid or the pivot), fits a smooth path through the series with a local quadratic five frames wide, and reports how far each frame sits off that path: the maximum and the RMS in pixels. Above 1.5 px it warns that the shake is visible. Frame-to-frame movement is reported separately, because it includes motion drawn on purpose.',
    'Pivots, boxes and collision polygons move with the art, so a pivot placed at the feet is still at the feet after aligning or fixing.'],
    terms:[['Anchor','Where each frame\'s opaque bounds are placed on the shared canvas: bottom-centre, centre, top, bottom, left, right or top-left.'],['Wobble (residual)','How far a frame\'s reference point sits off the smoothed path, in pixels.'],['Fix (keep motion) / Pin to first frame','Remove only the wobble around the smooth path, or hold every frame on frame 1\'s point.']]},
   example:{title:'Example: three trimmed frames onto one canvas',lead:'The frames of one tag were trimmed separately to 20 × 30, 22 × 28 and 18 × 31 px. Align with the default canvas, padding 0 and the bottom-centre anchor:',lines:[
    'canvas  = largest width × largest height = 22 × 31',
    'offset  x = round((22 − w) ÷ 2)    y = 31 − h',
    'frame 1  20 × 30  →  x = 1, y = 1',
    'frame 2  22 × 28  →  x = 0, y = 3',
    'frame 3  18 × 31  →  x = 2, y = 0',
    'check   every lowest opaque row ends at y = 31; every middle is at x = 1 + 10 = 0 + 11 = 2 + 9 = 11'],
    after:'If the art itself was drawn a pixel or two off, Measure shows it and Fix corrects it; a worked jitter measurement is on [[game/sprite-jitter-after-trim|sprite jitter after trimming]].'},
   verify:{steps:[
    'Play the tag with onion skin (F3): the feet of neighbouring frames should overlap instead of stepping sideways.',
    'Press Measure: the Align panel shows "Wobble: max … px, RMS … px", and the timeline marks each frame\'s distance from the smooth path.',
    'After Fix the panel shows the wobble before and after; play the loop again, including the step from the last frame back to the first.',
    'In Pack & Export\'s Packed frames list every frame of the tag has the same canvas size.']},
   trouble:{rows:[
    ['An error says a frame does not fit','A typed canvas is smaller than a frame, and pixels are never scaled','The message names the largest frame\'s size','Leave width and height empty (the largest frame is used) or type a bigger size'],
    ['The character still hops after aligning','Bottom-centre follows the lowest opaque pixel: a weapon, cape or shadow under the feet moved it','With onion skin the lowest pixels line up but the feet do not','Measure with the centre of the art or the alpha centroid, or place pivots on the feet and use the Pivot reference'],
    ['A walk cycle is pinned in place after Fix','Pin to first frame holds every frame on frame 1\'s point, so motion drawn into the frames is removed too','Frame-to-frame movement was large while the wobble was small','Undo and use Fix (keep motion), or leave the tag as it was'],
    ['Fix refuses to run','Jitter can only be fixed on frames that share one canvas','The message asks to normalize the frames first','Press Align frames for the scope, then Measure and Fix']]},
   alternatives:{rows:[
    ['Draw every frame on one fixed canvas from the start (Aseprite keeps one canvas per sprite)','The art is yours to redraw; nothing needs aligning afterwards.'],
    ['Keep the trim offsets when packing instead of trimming frames apart','The frames were aligned before packing and only the packer broke it: see [[game/sprite-jitter-after-trim|jitter after trimming]] and [[sprite-sheet-maker|the sprite sheet packer]].']]},
   limits:['The anchor is geometric (lowest opaque row, centre of the bounds); nothing recognises feet.','Padding is 0–256 px, and a fix that would move a frame more than 64 px is clamped.','When a fix would push a frame past the canvas edge, the canvas grows instead of clipping the art.'],
   versions:{body:['Behaviour from src/game/frame-ops.js and src/game/jitter.js (unit-tested in tests/game-frame-ops.test.mjs and tests/game-jitter.test.mjs). The smoothing keeps deliberate motion: on a 16-frame sine it passes 0.998 of the motion at window 5, where a plain moving average keeps 0.852.'],sources:[S.aseTags]}
  },
  ko:{
   answer:'하나씩 자르거나 트림한 프레임은 크기가 제각각이라, 모서리나 가운데를 기준으로 프레임을 놓는 엔진에서는 캐릭터가 튑니다. 정렬은 태그의 모든 프레임을 한 캔버스(따로 입력하지 않으면 가장 큰 프레임의 너비·높이 + 여백)에 올리고, 각 프레임의 불투명 범위를 아래 가운데 같은 같은 기준점에 맞춥니다. 그림은 정수 픽셀 단위로만 옮기고 크기를 바꾸지 않습니다. 이어서 측정이 남은 흔들림을 픽셀로 알려 주고, 보정은 의도한 움직임을 살린 채 흔들림만 없애거나 모든 프레임을 첫 프레임에 고정합니다.',
   concept:{title:'정렬한 다음, 남은 흔들림 재기',body:[
    '정렬은 "각 프레임이 캔버스의 어디에 있나"에 답합니다. "각 프레임의 불투명 영역을 먼저 측정"을 켜면 Studio가 프레임마다 보이는 픽셀을 찾고, 그중 가장 큰 너비와 높이로 캔버스를 만든 뒤, 각 프레임의 범위가 기준점에 닿도록 놓습니다. 아래 가운데는 가장 아래 불투명 줄을 캔버스 바닥에 대고 가로로 가운데 맞춤입니다. 반 픽셀은 반올림할 뿐 다시 샘플링하지 않으므로 도트가 흐려지지 않습니다.',
    '아래 가운데는 발이 아니라 가장 아래 불투명 줄의 가운데입니다. 칼끝, 망토, 발밑 먼지가 이 점을 옮깁니다. 그래서 정렬 다음에 측정합니다. 측정은 프레임마다 기준점 하나(그림의 아래 가운데, 그림의 가운데, 알파 무게중심, 피벗)를 잡고, 5프레임 폭의 국소 2차식으로 매끄러운 경로를 맞춘 뒤, 각 프레임이 그 경로에서 얼마나 벗어나는지 최대값과 RMS를 픽셀로 보여 줍니다. 1.5px를 넘으면 눈에 보이는 흔들림이라고 경고합니다. 프레임 간 이동은 일부러 그린 움직임을 포함하므로 따로 표시합니다.',
    '피벗, 박스, 충돌 폴리곤은 그림과 함께 움직이므로, 발에 둔 피벗은 정렬이나 보정 후에도 발에 있습니다.'],
    terms:[['기준점(앵커)','각 프레임의 불투명 범위를 공유 캔버스의 어디에 둘지: 아래 가운데, 가운데, 위, 아래, 왼쪽, 오른쪽, 왼쪽 위.'],['흔들림(잔차)','프레임의 기준점이 매끄러운 경로에서 벗어난 거리(픽셀).'],['보정(움직임 유지) / 첫 프레임에 고정','매끄러운 경로 주변의 흔들림만 없애기, 또는 모든 프레임을 1번 프레임의 점에 붙들기.']]},
   example:{title:'예시: 트림된 프레임 세 개를 한 캔버스로',lead:'한 태그의 프레임이 각각 20 × 30, 22 × 28, 18 × 31px로 트림돼 있습니다. 기본 캔버스, 여백 0, 아래 가운데 기준으로 정렬하면:',lines:[
    '캔버스   = 가장 큰 너비 × 가장 큰 높이 = 22 × 31',
    '오프셋   x = round((22 − w) ÷ 2)    y = 31 − h',
    '프레임 1  20 × 30  →  x = 1, y = 1',
    '프레임 2  22 × 28  →  x = 0, y = 3',
    '프레임 3  18 × 31  →  x = 2, y = 0',
    '검산     가장 아래 줄은 모두 y = 31에서 끝남. 가운데는 1 + 10 = 0 + 11 = 2 + 9 = 11'],
    after:'그림 자체가 한두 픽셀 어긋나게 그려졌다면 측정이 보여 주고 보정이 고칩니다. 흔들림 측정의 계산 예시는 [[game/sprite-jitter-after-trim|트림 후 스프라이트 흔들림]]에 있습니다.'},
   verify:{steps:[
    '어니언 스킨(F3)을 켜고 태그를 재생합니다. 이웃 프레임의 발이 옆으로 밀리지 않고 겹쳐야 합니다.',
    '측정을 누르면 정렬 패널에 "흔들림: 최대 … px, RMS … px"가 나오고, 타임라인에 프레임마다 매끄러운 경로와의 거리가 표시됩니다.',
    '보정 후 패널에 보정 전후의 흔들림이 나옵니다. 마지막 프레임에서 첫 프레임으로 넘어가는 순간까지 다시 재생해 보세요.',
    'Pack & Export의 패킹된 프레임 목록에서 태그의 모든 프레임이 같은 캔버스 크기인지 봅니다.']},
   trouble:{rows:[
    ['프레임이 들어가지 않는다는 오류','입력한 캔버스가 프레임보다 작고, 픽셀은 절대 축소하지 않음','메시지에 가장 큰 프레임의 크기가 나옴','너비·높이를 비워 두거나(가장 큰 프레임 크기 사용) 더 크게 입력'],
    ['정렬 후에도 캐릭터가 튐','아래 가운데는 가장 아래 불투명 픽셀을 따르므로, 발밑의 무기·망토·그림자가 기준을 옮김','어니언 스킨에서 가장 아래 픽셀은 맞지만 발은 안 맞음','그림의 가운데나 알파 무게중심으로 측정하거나, 발에 피벗을 두고 피벗 기준 사용'],
    ['보정 후 걷기 동작이 제자리에 붙음','첫 프레임에 고정은 모든 프레임을 1번 프레임의 점에 두므로, 프레임에 그려 넣은 이동도 사라짐','프레임 간 이동은 컸고 흔들림은 작았음','되돌리고 보정(움직임 유지)을 쓰거나 그대로 둠'],
    ['보정이 실행되지 않음','흔들림 보정은 한 캔버스를 공유하는 프레임에서만 가능','메시지가 먼저 프레임을 정렬하라고 안내','범위에 프레임 정렬을 누른 뒤 측정, 보정']]},
   alternatives:{rows:[
    ['처음부터 모든 프레임을 고정된 캔버스 하나에 그리기(Aseprite는 스프라이트마다 캔버스 하나)','직접 다시 그릴 수 있는 그림일 때. 나중에 정렬할 일이 없습니다.'],
    ['프레임을 따로 트림하지 말고 패킹할 때 트림 오프셋 유지','패킹 전에는 맞았는데 패커가 망가뜨린 경우: [[game/sprite-jitter-after-trim|트림 후 흔들림]]과 [[sprite-sheet-maker|스프라이트 시트 패커]] 참고.']]},
   limits:['기준점은 기하학적입니다(가장 아래 불투명 줄, 범위의 가운데). 발을 알아보지는 못합니다.','여백은 0~256px이고, 64px보다 크게 옮기는 보정은 64px로 제한됩니다.','보정으로 프레임이 캔버스 밖으로 밀리면 그림을 자르지 않고 캔버스를 키웁니다.'],
   versions:{body:['동작은 src/game/frame-ops.js와 src/game/jitter.js를 따릅니다(tests/game-frame-ops.test.mjs, tests/game-jitter.test.mjs에서 단위 테스트). 매끄럽게 하는 방식은 의도한 움직임을 살립니다. 16프레임 사인 곡선에서 창 5일 때 움직임의 0.998을 남기며, 단순 이동 평균은 0.852만 남깁니다.'],sources:[S.aseTags]}
  },
  ja:{
   answer:'1枚ずつ切り出したりトリムしたりしたフレームは大きさがばらばらなので、角や中心を基準に置くエンジンではキャラクターが跳ねます。そろえる処理は、タグの全フレームを1つのキャンバス（入力しなければ最大フレームの幅と高さ + 余白）に載せ、各フレームの不透明範囲を下中央などの同じ基準点に合わせます。絵は整数ピクセル単位で動かすだけで、拡大縮小はしません。続いて「測定」が残ったブレをピクセルで示し、「補正」が意図した動きを残してブレだけを消すか、全フレームを最初のフレームに固定します。',
   concept:{title:'そろえてから、残ったブレを測る',body:[
    'そろえる処理が答えるのは「各フレームはキャンバスのどこにあるか」です。「各フレームの不透明範囲を先に測る」をオンにすると、Studioはフレームごとに見えるピクセルを探し、その最大の幅と高さでキャンバスを作り、各フレームの範囲が基準点に接するように置きます。下中央は、いちばん下の不透明な行をキャンバスの底に付け、横方向は中央に置きます。半ピクセルは丸めるだけで再サンプリングしないため、ドット絵はぼやけません。',
    '下中央は足ではなく「いちばん下の不透明な行の中央」です。剣先やマント、足元の砂煙がこの点を動かします。だから、そろえたあとに測ります。測定はフレームごとに基準点を1つ（絵の下中央、絵の中央、アルファの重心、ピボット）取り、5フレーム幅の局所2次式で滑らかな軌道を当てはめ、各フレームがそこからどれだけずれているかを最大値とRMS（ピクセル）で示します。1.5pxを超えると、目に見える揺れだと警告します。フレーム間の移動量は意図した動きも含むので、別に表示します。',
    'ピボット・ボックス・衝突ポリゴンは絵と一緒に動くので、足に置いたピボットは、そろえても補正しても足の位置のままです。'],
    terms:[['基準点（アンカー）','各フレームの不透明範囲を共通キャンバスのどこに置くか：下中央・中央・上・下・左・右・左上。'],['ブレ（残差）','フレームの基準点が滑らかな軌道から外れている距離（ピクセル）。'],['補正（動きを保つ）／最初のフレームに固定','滑らかな軌道まわりのブレだけを消すか、全フレームを1枚目の点に留めるか。']]},
   example:{title:'例：トリム済みの3フレームを1つのキャンバスへ',lead:'1つのタグのフレームが、それぞれ20 × 30、22 × 28、18 × 31pxにトリムされています。既定のキャンバス、余白0、下中央でそろえると：',lines:[
    'キャンバス = 最大の幅 × 最大の高さ = 22 × 31',
    'オフセット x = round((22 − w) ÷ 2)    y = 31 − h',
    'フレーム1  20 × 30  →  x = 1, y = 1',
    'フレーム2  22 × 28  →  x = 0, y = 3',
    'フレーム3  18 × 31  →  x = 2, y = 0',
    '検算       いちばん下の行はすべて y = 31 で終わり、中央は 1 + 10 = 0 + 11 = 2 + 9 = 11'],
    after:'絵そのものが1〜2ピクセルずれて描かれていれば、測定がそれを示し、補正が直します。ブレの測定の計算例は[[game/sprite-jitter-after-trim|トリム後のスプライトのブレ]]にあります。'},
   verify:{steps:[
    'オニオンスキン（F3）を付けてタグを再生します。隣り合うフレームの足が横にずれず重なるはずです。',
    '測定を押すと、揃えパネルに「ブレ：最大 … px、RMS … px」が出て、タイムラインにフレームごとの軌道からの距離が付きます。',
    '補正後、パネルに補正前後のブレが出ます。最後のフレームから最初のフレームへ戻る瞬間まで、もう一度再生してください。',
    'Pack & Exportのパック済みフレーム一覧で、タグの全フレームが同じキャンバスサイズか確認します。']},
   trouble:{rows:[
    ['フレームが収まらないというエラー','入力したキャンバスがフレームより小さく、ピクセルは決して縮小しない','メッセージに最大フレームの大きさが出る','幅と高さを空欄にする（最大フレームを使う）か、大きく入力する'],
    ['そろえてもキャラが跳ねる','下中央はいちばん下の不透明ピクセルに従うため、足元の武器・マント・影が基準を動かした','オニオンスキンで、いちばん下のピクセルは合うが足は合わない','絵の中央かアルファの重心で測るか、足にピボットを置いてピボット基準を使う'],
    ['補正したら歩きが足踏みになった','最初のフレームに固定は全フレームを1枚目の点に留めるので、描き込んだ移動も消える','フレーム間の移動は大きく、ブレは小さかった','取り消して補正（動きを保つ）を使うか、そのままにする'],
    ['補正が実行されない','ブレの補正は同じキャンバスを共有するフレームでしかできない','メッセージが先にフレームをそろえるよう案内する','範囲に対してフレームをそろえてから、測定・補正']]},
   alternatives:{rows:[
    ['最初から全フレームを固定の1キャンバスに描く（Asepriteはスプライトごとにキャンバス1つ）','自分で描き直せる絵なら、あとでそろえる必要がなくなります。'],
    ['フレームを個別にトリムせず、パック時にトリムのオフセットを残す','パック前はそろっていて、パッカーが崩した場合：[[game/sprite-jitter-after-trim|トリム後のブレ]]と[[sprite-sheet-maker|スプライトシートパッカー]]を参照。']]},
   limits:['基準点は幾何学的なもの（いちばん下の不透明な行、範囲の中央）で、足を認識するわけではありません。','余白は0〜256pxで、64pxを超えて動かす補正は64pxに制限されます。','補正でフレームがキャンバスの外に出る場合は、絵を切らずにキャンバスを広げます。'],
   versions:{body:['動作はsrc/game/frame-ops.jsとsrc/game/jitter.jsに基づきます（tests/game-frame-ops.test.mjs と tests/game-jitter.test.mjs で単体テスト）。滑らかにする方法は意図した動きを残します。16フレームの正弦波で、窓5なら動きの0.998を残し、単純移動平均では0.852しか残りません。'],sources:[S.aseTags]}
  }
 },
 // ------------------------------------------------------------------ game/sprite-animation-preview
 'game/sprite-animation-preview':{
  type:'tool',
  intent:{primary:'preview a sprite animation with its real per-frame timing before it reaches the engine',secondary:['ms per frame vs FPS','ping-pong and repeat counts','onion skin, zoomed preview','GIF/APNG export'],
   goal:'see exactly how each tag will play (order, per-frame duration, loop) and export that timing',input:'sheet, frame files, GIF/APNG or .aseprite',output:'playback in the browser; GIF, APNG or engine data with the same timing',support:'full',
   evidence:['src/studio/sprite/playback.js (repeat and ping-pong semantics)','src/game/export/anim.js (GIF 1/100 s, min 2 cs, 1-bit alpha)','docs/STUDIO-SPRITE.md §10 (GIF 408/408, APNG 132/132)'],
   external:['GIF89a Delay Time and Disposal Method','Aseprite tags: direction and repeat']},
  en:{
   answer:'Previewing a sprite animation honestly needs the frames in order, each frame\'s own duration in milliseconds, and the tag\'s direction and repeat count; one FPS slider hides the poses an animator holds longer. Drop a sheet, frame files, a GIF or an .aseprite file, apply the import, pick a tag and press Enter: it plays with per-frame timing and loops inside the tag, steps with , and . , compares neighbours with onion skin (F3) and plays at 1×–8× in a floating window (F7). The same timing exports as GIF, APNG or engine data.',
   concept:{title:'Milliseconds, direction and repeat',body:[
    'A frame\'s duration is how long it stays on screen. FPS is a shorthand for equal durations: 1000 ÷ FPS milliseconds per frame, so 12 FPS is 83.3 ms and 8 FPS is 125 ms. Animation holds key poses longer (a 250 ms hit pose between 100 ms steps), and a preview that forces one rate plays those poses wrong.',
    'A tag plays forward, reverse or ping-pong. Ping-pong does not show the end frames twice: four frames play 1-2-3-4-3-2 and start again. The repeat count follows Aseprite: 0 loops forever, n plays n times, and for ping-pong one repeat is one pass in one direction, so 2 is there and back.',
    'Onion skin draws the frames before and after the current one at lower opacity, previous frames tinted red and next ones blue if you want, which shows uneven spacing and wobble that full-speed playback hides. The floating preview plays the loop at whole-number zoom on a background you choose, so pixels stay square.'],
    terms:[['Duration','Milliseconds a frame stays on screen; 100 ms when a file carries no timing.'],['Ping-pong','Forward then back without repeating the end frames.'],['Repeat','0 = loop forever; n = play n times.'],['Onion skin','Neighbouring frames drawn faintly behind the current one.']]},
   example:{title:'Example: an attack that holds its hit pose',lead:'Two tags on one timeline:',lines:[
    'attack   frames 1–5   forward    repeat 1',
    'ms       100, 100, 100, 250, 150',
    'one play 100 + 100 + 100 + 250 + 150 = 700 ms, then it stops on frame 5',
    'at 10 FPS instead: 5 × 100 = 500 ms, and the hit pose flashes for 100 ms',
    'GIF      delays 10, 10, 10, 25, 15 (hundredths of a second)',
    '',
    'idle     frames 6–9   ping-pong  repeat 0',
    'order    6 7 8 9 8 7 | 6 7 8 9 8 7 | …'],
    after:'The same milliseconds go to every export: [[game/godot-animation-frame-duration|Godot relative durations]] are computed from them, and [[game/sprite-sheet-to-gif|GIF export]] rounds them to hundredths of a second.'},
   verify:{steps:[
    'Watch the floating preview (F7) at the zoom and on the background colour your game uses.',
    'Step with , and . across the loop point: going from the last frame to the first should look like any other step.',
    'Hover a frame on the timeline: its tooltip shows its duration in milliseconds.',
    'Export a GIF and open it in a browser; the export notes list any delay that had to be rounded.']},
   trouble:{rows:[
    ['The GIF plays faster or slower than the preview','GIF stores hundredths of a second: 125 ms becomes 13 (130 ms), and delays under 20 ms are raised to 20 ms, because browsers play 0 or 1 as 10','The export notes count the rounded frames','Use durations in steps of 10 ms, or export APNG, which keeps milliseconds'],
    ['Soft edges turn jagged in the GIF','GIF transparency is on or off: alpha of 128 and above becomes opaque, below becomes transparent','The export note says semi-transparent pixels changed','Export APNG, which keeps every alpha level'],
    ['Every frame of an imported sheet lasts 100 ms','A plain PNG, TexturePacker JSON and Sparrow XML carry no timing, so the default applies','The timeline shows 100 on every frame','Select the frames and type the duration once for all of them'],
    ['The loop hitches at the seam','The last frame repeats the first, so that pose plays twice','Step from the last frame to the first with onion skin','Delete the duplicate frame, or switch the tag to ping-pong']]},
   alternatives:{rows:[
    ['Aseprite\'s own preview','You are still drawing; its preview and tags are the source of the timing anyway.'],
    ['The engine\'s player (Godot\'s SpriteFrames panel, Unity\'s Animation window)','The final check: what the engine does with speed scale, state changes and physics can only be seen there.'],
    ['[[game/sprite-sheet-to-gif|Sprite sheet to GIF]]','You only need a shareable GIF of each animation.']]},
   limits:['This is a player: pixels are edited in the Pixel workspace.','Engines that play one FPS per animation (Defold, GameMaker) cannot follow different durations inside one tag; the export notes say so.'],
   versions:{body:['GIF decoding matched Pillow on 408 of 408 frames of 29 real GIFs, APNG on 132 of 132 frames of 16 files (every dispose and blend mode). GIF delay units and disposal follow the GIF89a specification.'],sources:[S.gif,S.aseTags]}
  },
  ko:{
   answer:'스프라이트 애니메이션을 제대로 미리 보려면 프레임 순서, 프레임마다의 밀리초 길이, 태그의 방향과 반복 횟수가 필요합니다. FPS 슬라이더 하나로는 애니메이터가 오래 멈춰 둔 포즈가 사라집니다. 시트, 프레임 파일, GIF, .aseprite 파일을 넣고 가져오기를 적용한 뒤 태그를 골라 Enter를 누르면, 프레임별 타이밍으로 태그 안에서 반복 재생되고, , 와 . 로 한 칸씩 넘기고, 어니언 스킨(F3)으로 이웃 프레임을 비교하고, 떠 있는 창(F7)에서 1~8배로 볼 수 있습니다. 같은 타이밍을 GIF, APNG, 엔진 데이터로 내보냅니다.',
   concept:{title:'밀리초, 방향, 반복',body:[
    '프레임 길이는 그 프레임이 화면에 머무는 시간입니다. FPS는 길이가 모두 같을 때의 줄임말로, 프레임당 1000 ÷ FPS 밀리초입니다. 12FPS는 83.3ms, 8FPS는 125ms입니다. 애니메이션은 핵심 포즈를 더 오래 보여 주므로(100ms 동작 사이의 250ms 타격 포즈), 한 속도로 고정한 미리보기는 그 포즈를 틀리게 보여 줍니다.',
    '태그는 정방향, 역방향, 핑퐁으로 재생됩니다. 핑퐁은 끝 프레임을 두 번 보여 주지 않아서, 프레임 네 개는 1-2-3-4-3-2로 재생한 뒤 다시 시작합니다. 반복 횟수는 Aseprite를 따릅니다. 0은 무한 반복, n은 n번 재생이고, 핑퐁에서는 한 방향 한 번이 반복 1이라 2는 갔다가 돌아오기입니다.',
    '어니언 스킨은 현재 프레임 앞뒤 프레임을 흐리게 겹쳐 그리고, 원하면 이전은 빨강, 다음은 파랑으로 물들입니다. 제속도 재생에서는 안 보이는 고르지 않은 간격과 흔들림이 드러납니다. 떠 있는 미리보기는 정수 배율과 고른 배경색에서 반복 재생하므로 픽셀이 네모나게 유지됩니다.'],
    terms:[['길이','프레임이 화면에 머무는 밀리초. 파일에 타이밍이 없으면 100ms.'],['핑퐁','끝 프레임을 반복하지 않고 앞으로 갔다가 되돌아오기.'],['반복','0 = 무한 반복, n = n번 재생.'],['어니언 스킨','이웃 프레임을 현재 프레임 뒤에 흐리게 그리기.']]},
   example:{title:'예시: 타격 포즈를 붙잡아 두는 공격',lead:'타임라인 하나에 태그 두 개:',lines:[
    'attack   프레임 1–5   정방향     반복 1',
    'ms       100, 100, 100, 250, 150',
    '1회 재생 100 + 100 + 100 + 250 + 150 = 700ms, 그 뒤 5번 프레임에서 멈춤',
    '10FPS로 고정하면 5 × 100 = 500ms, 타격 포즈는 100ms만 번쩍임',
    'GIF      지연 10, 10, 10, 25, 15(100분의 1초)',
    '',
    'idle     프레임 6–9   핑퐁       반복 0',
    '순서     6 7 8 9 8 7 | 6 7 8 9 8 7 | …'],
    after:'같은 밀리초가 모든 내보내기로 갑니다. [[game/godot-animation-frame-duration|Godot의 상대 길이]]는 이 값에서 계산하고, [[game/sprite-sheet-to-gif|GIF 내보내기]]는 100분의 1초로 반올림합니다.'},
   verify:{steps:[
    '떠 있는 미리보기(F7)를 게임과 같은 배율, 같은 배경색으로 봅니다.',
    ', 와 . 로 반복 지점을 넘겨 봅니다. 마지막 프레임에서 첫 프레임으로 가는 한 칸이 다른 칸과 똑같이 자연스러워야 합니다.',
    '타임라인의 프레임에 마우스를 올리면 툴팁에 밀리초 길이가 나옵니다.',
    'GIF를 내보내 브라우저로 엽니다. 반올림해야 했던 지연은 내보내기 안내에 나옵니다.']},
   trouble:{rows:[
    ['GIF가 미리보기보다 빠르거나 느림','GIF는 100분의 1초 단위라 125ms는 13(130ms)이 되고, 브라우저가 0이나 1을 10으로 재생하므로 20ms 미만은 20ms로 올림','내보내기 안내에 반올림된 프레임 수가 나옴','길이를 10ms 단위로 쓰거나, 밀리초를 그대로 담는 APNG로 내보내기'],
    ['GIF에서 부드러운 가장자리가 거칠어짐','GIF 투명도는 켜짐·꺼짐뿐이라 알파 128 이상은 불투명, 그 미만은 투명이 됨','내보내기 안내에 반투명 픽셀이 바뀌었다고 나옴','모든 알파 단계를 담는 APNG로 내보내기'],
    ['가져온 시트의 모든 프레임이 100ms','PNG 시트, TexturePacker JSON, Sparrow XML에는 타이밍이 없어 기본값이 적용됨','타임라인의 모든 프레임에 100이 표시됨','프레임을 선택하고 길이를 한 번에 입력'],
    ['반복 이음새에서 끊김','마지막 프레임이 첫 프레임과 같아서 그 포즈가 두 번 나옴','어니언 스킨을 켜고 마지막에서 첫 프레임으로 넘겨 보기','중복 프레임을 지우거나 태그를 핑퐁으로']]},
   alternatives:{rows:[
    ['Aseprite 자체 미리보기','아직 그리는 중일 때. 어차피 타이밍의 원본은 거기의 미리보기와 태그입니다.'],
    ['엔진의 재생기(Godot SpriteFrames 패널, Unity Animation 창)','최종 확인. 속도 배율, 상태 전환, 물리와 함께 어떻게 되는지는 엔진에서만 보입니다.'],
    ['[[game/sprite-sheet-to-gif|스프라이트 시트를 GIF로]]','애니메이션마다 공유용 GIF만 필요할 때.']]},
   limits:['재생기입니다. 픽셀 수정은 픽셀 작업 공간에서 합니다.','애니메이션마다 FPS 하나로 재생하는 엔진(Defold, GameMaker)은 한 태그 안의 서로 다른 길이를 따르지 못하며, 내보내기 안내가 이를 알려 줍니다.'],
   versions:{body:['GIF 디코딩은 실제 GIF 29개의 408프레임 전부, APNG는 16개 파일(모든 dispose·blend 조합)의 132프레임 전부가 Pillow와 일치했습니다. GIF 지연 단위와 disposal은 GIF89a 규격을 따릅니다.'],sources:[S.gif,S.aseTags]}
  },
  ja:{
   answer:'スプライトアニメーションを正しくプレビューするには、フレームの順序、フレームごとのミリ秒の長さ、タグの方向と繰り返し回数が必要です。FPSスライダー1本では、アニメーターが長く見せたいポーズが消えてしまいます。シート、フレーム画像、GIF、.asepriteを入れて読み込みを適用し、タグを選んでEnterを押すと、フレームごとのタイミングでタグ内をループ再生し、, と . でコマ送り、オニオンスキン（F3）で前後比較、フローティングウィンドウ（F7）で1〜8倍表示ができます。同じタイミングをGIF・APNG・エンジン用データに書き出せます。',
   concept:{title:'ミリ秒・方向・繰り返し',body:[
    'フレームの長さは、そのフレームが画面に出ている時間です。FPSは長さがすべて同じ場合の略記で、1フレームあたり1000 ÷ FPSミリ秒。12FPSなら83.3ms、8FPSなら125msです。アニメーションは決めのポーズを長く見せる（100msの動きのあいだに250msの打撃ポーズ）ので、1つの速度に固定したプレビューではそのポーズが正しく見えません。',
    'タグは順方向・逆方向・ピンポンで再生します。ピンポンは端のフレームを2回見せないので、4フレームなら1-2-3-4-3-2と再生して最初に戻ります。繰り返し回数はAseprite準拠で、0は無限ループ、nはn回再生。ピンポンでは片道1回が繰り返し1なので、2で往復になります。',
    'オニオンスキンは前後のフレームを薄く重ね、必要なら前を赤、後を青に着色します。等速再生では見えない間隔のむらやブレが見えてきます。フローティングのプレビューは整数倍率と選んだ背景色でループするので、ピクセルは四角いままです。'],
    terms:[['長さ','フレームが画面に出ているミリ秒。ファイルにタイミングがなければ100ms。'],['ピンポン','端のフレームを繰り返さずに往復する再生。'],['繰り返し','0 = 無限ループ、n = n回再生。'],['オニオンスキン','前後のフレームを現在のフレームの後ろに薄く描く表示。']]},
   example:{title:'例：打撃ポーズを長く見せる攻撃',lead:'1つのタイムラインに2つのタグ：',lines:[
    'attack   フレーム1–5   順方向     繰り返し 1',
    'ms       100, 100, 100, 250, 150',
    '1回再生  100 + 100 + 100 + 250 + 150 = 700ms、その後フレーム5で停止',
    '10FPS固定だと 5 × 100 = 500ms、打撃ポーズは100msで一瞬消える',
    'GIF      ディレイ 10, 10, 10, 25, 15（1/100秒）',
    '',
    'idle     フレーム6–9   ピンポン   繰り返し 0',
    '順序     6 7 8 9 8 7 | 6 7 8 9 8 7 | …'],
    after:'同じミリ秒がすべての書き出しに渡ります。[[game/godot-animation-frame-duration|Godotの相対的な長さ]]はこの値から計算し、[[game/sprite-sheet-to-gif|GIF書き出し]]は1/100秒に丸めます。'},
   verify:{steps:[
    'フローティングプレビュー（F7）を、ゲームと同じ倍率・同じ背景色で見ます。',
    ', と . でループの継ぎ目をまたいでコマ送りします。最後のフレームから最初へ戻る1コマが、ほかのコマと同じように自然なはずです。',
    'タイムラインのフレームにカーソルを載せると、ツールチップにミリ秒の長さが出ます。',
    'GIFを書き出してブラウザで開きます。丸める必要があったディレイは書き出しの注記に出ます。']},
   trouble:{rows:[
    ['GIFがプレビューより速い・遅い','GIFは1/100秒単位なので125msは13（130ms）になり、ブラウザが0や1を10として再生するため20ms未満は20msに上げる','書き出しの注記に丸めたフレーム数が出る','長さを10ms刻みにするか、ミリ秒を保持するAPNGで書き出す'],
    ['GIFで柔らかい縁がギザギザになる','GIFの透明はオンかオフだけで、アルファ128以上は不透明、未満は透明になる','書き出しの注記に半透明ピクセルが変わったと出る','すべてのアルファ段階を保つAPNGで書き出す'],
    ['読み込んだシートの全フレームが100ms','PNGシート、TexturePacker JSON、Sparrow XMLにはタイミングがなく、既定値が入る','タイムラインの全フレームに100と出る','フレームを選択して長さをまとめて入力する'],
    ['ループの継ぎ目で引っかかる','最後のフレームが最初と同じで、そのポーズが2回出る','オニオンスキンを付けて最後から最初へコマ送りする','重複フレームを消すか、タグをピンポンにする']]},
   alternatives:{rows:[
    ['Aseprite自体のプレビュー','まだ描いている段階なら。タイミングの元はどのみちそこのプレビューとタグです。'],
    ['エンジンのプレーヤー（GodotのSpriteFramesパネル、UnityのAnimationウィンドウ）','最終確認に。速度倍率や状態遷移、物理と組み合わせた結果はエンジンでしか見られません。'],
    ['[[game/sprite-sheet-to-gif|スプライトシートをGIFに]]','アニメーションごとに共有用のGIFだけ欲しいとき。']]},
   limits:['これはプレーヤーです。ピクセルの修正はピクセル作業画面で行います。','アニメーションごとにFPSが1つのエンジン（Defold、GameMaker）は、1つのタグ内の異なる長さを再現できず、書き出しの注記がそれを知らせます。'],
   versions:{body:['GIFのデコードは実在のGIF 29件・408フレームすべて、APNGは16ファイル（dispose・blendの全組み合わせ）・132フレームすべてでPillowと一致しました。GIFのディレイの単位とdisposalはGIF89a仕様に従います。'],sources:[S.gif,S.aseTags]}
  }
 },
 // ------------------------------------------------------------------ game/sprite-pivot-editor
 'game/sprite-pivot-editor':{
  type:'create',
  intent:{primary:'set a sprite pivot (origin, anchor) per frame and get it into the engine',secondary:['pivot units per engine','per-frame pivots vs one node offset','pivots of trimmed frames'],
   goal:'the pivot sits on the same spot of the character in the engine, for every frame and after trimming',input:'imported frames (sheet, frames, GIF, .aseprite)',output:'the pivot written in each target\'s own field',support:'partial',
   evidence:['src/game/export/godot.js (offset = −first pivot, notes)','src/game/export/unity.js (pivot normalised in the rect, y up)','src/game/export/atlas-json.js (Phaser pivot, Pixi anchor, Aseprite pivot slice)','src/game/export/engines.js (LÖVE px/py, Starling pivotX/Y, GameMaker pivotCell)','docs/ENGINE-VERIFY.md frames.anchor (Unity)'],
   external:['Unity 6 Sprite Editor Pivot / Pivot Unit Mode','Godot AnimatedSprite2D offset, centered','Phaser 3.90 source: JSONHash pivot, AnimationState setOrigin','PixiJS AnimatedSprite.updateAnchor, Texture.defaultAnchor','GameMaker sprite origin']},
  en:{
   answer:'A pivot (also called origin or anchor) is the point of a frame that sits on the game object\'s position: rotation turns around it, and frames of different sizes line up on it. In Nerulio you click it onto the pixel grid (P) for one frame, the selection, a tag or every frame; it is stored as 0–1 of the frame canvas and written into each engine\'s own field on export. Unity, Phaser and PixiJS can follow a pivot per frame; a Godot node has one offset, so the table below says what each target really gets.',
   concept:{title:'One pivot value, many engine conventions',body:[
    'Engines count pivots differently. Unity measures a sprite\'s pivot from the bottom-left of that sprite\'s rect, as 0–1 (Normalized) or in pixels. Phaser and PixiJS use 0–1 of the frame with y pointing down. Godot\'s AnimatedSprite2D has no pivot at all, only a drawing offset in pixels for the whole node. Nerulio keeps one value, 0–1 of the frame canvas with y down (bottom-centre 0.5, 1.0 unless you set it), and converts it per target, so a pivot set once survives trimming, packing and a change of engine.',
    'Per-frame pivots matter when frames differ in size or are trimmed. The Godot scene therefore uses the first frame\'s pivot as the node offset, keeps every frame\'s pivot in the resource metadata, and warns when one animation has differing pivots. The robust setup for any engine is frames on one canvas and one pivot per tag at the feet.',
    'The pivot tool snaps to whole pixels, and pivots travel with the art when frames are aligned, mirrored or fixed for jitter.'],
    terms:[['Pivot / origin / anchor','The point of a frame placed on the object\'s position; the name depends on the engine.'],['Normalized pivot','0–1 across the frame or sprite rect; Unity counts y from the bottom, Phaser and PixiJS from the top.'],['Node offset (Godot)','Pixels by which an AnimatedSprite2D draws its texture away from the node origin; one value for every frame.']]},
   example:{title:'Example: one pivot, written for five engines',lead:'A 48 × 64 frame canvas with the pivot at bottom-centre. The packer trims a standing frame to 20 × 30 at (14, 34) and a jumping frame to 20 × 30 at (14, 20).',lines:[
    'Nerulio           pivot (0.5, 1.0) of 48 × 64   → pixel (24, 64)',
    'Godot .tscn       centered = false, offset = (−24, −64)',
    'Phaser / PixiJS   pivot / anchor (0.5, 1.0) of the 48 × 64 source frame',
    'LÖVE              px = 24, py = 64',
    'Unity, stand      ((24 − 14) ÷ 20, (30 − (64 − 34)) ÷ 30) = (0.5, 0.0)',
    'Unity, jump       ((24 − 14) ÷ 20, (30 − (64 − 20)) ÷ 30) = (0.5, −0.467)'],
    after:'The jump frame\'s Unity pivot lies below its own rect; that is exactly what keeps the feet on the same spot. Why trimming moves pivots is explained on [[game/sprite-jitter-after-trim|sprite jitter after trimming]].'},
   mapping:{title:'What each target receives',head:['Target','What Nerulio writes','What the engine does with it'],rows:[
    ['Godot 4','Scene: `centered = false`, `offset` = −pivot of the first frame of the first animation; every frame\'s pivot in `metadata/nerulio`','AnimatedSprite2D draws every frame with that one offset; per-frame pivots need your own script'],
    ['Unity 6','A custom pivot per sprite, 0–1 inside the sprite rect with y up (outside 0–1 for some trimmed frames)','Each sprite keeps its own pivot, so a clip changes pivot with the frame (read back in Unity 6000.5.3f1)'],
    ['Phaser 3 / 4','`pivot` {x, y} per frame in the atlas JSON','Phaser 3.90 marks it as the frame\'s custom pivot and calls setOrigin with it on every frame change, animation frames included'],
    ['PixiJS 8','`anchor` {x, y} per frame','It becomes the texture\'s default anchor: a Sprite takes it when created; an AnimatedSprite follows it per frame only with `updateAnchor = true`'],
    ['Aseprite JSON, .aseprite','A `pivot` slice keyed on the frames where the pivot changes','Aseprite shows a slice with a pivot point'],
    ['LÖVE 11','`px`, `py` in the Lua frame table','The shipped `nerulio_atlas.lua` draws each frame with its pivot on (x, y)'],
    ['GameMaker','One strip per tag with every pivot on one point; that point is the origin in `gamemaker.json` and the README','Type it as the sprite\'s Origin in the Sprite Editor (UNVERIFIED in GameMaker)'],
    ['Defold, Spine / libGDX, CSS','No pivot','Set it in the engine']],
    note:'Starling / Sparrow XML also gets `pivotX` and `pivotY` in pixels; whether a reader uses them depends on that reader.'},
   verify:{steps:[
    'Turn on onion skin (F3) and step through the tag: the pivot cross should stay on the same spot of the body.',
    'Godot: read the export notes (they warn about differing pivots) and `print($Hero.sprite_frames.get_meta("nerulio"))` for every frame\'s pivot.',
    'Unity: open the texture in the Sprite Editor; each sprite\'s Pivot is Custom with the normalized value from the example.',
    'Phaser: after `sprite.play(\'run\')`, `sprite.originX` and `sprite.originY` equal the current frame\'s pivot.']},
   trouble:{rows:[
    ['The Godot character jumps between animations','The node has one offset, taken from the first frame of the first animation, and other animations use other pivots','The Godot export notes; compare pivots in `metadata/nerulio`','Give all tags of the character one pivot, or set `offset` from the metadata in a script when the animation changes'],
    ['A PixiJS AnimatedSprite ignores per-frame pivots','`updateAnchor` is false by default, so the anchor of the first texture stays','Log `sprite.updateAnchor`','Set `updateAnchor = true`, or keep one pivot for the tag'],
    ['Unity pivots below 0 or above 1','The frame was trimmed and the full-canvas pivot lies outside the smaller rect','Sprite Editor: the Custom Pivot value','Nothing to fix: it keeps the art aligned. Pack with trim off if a tool demands 0–1']]},
   alternatives:{rows:[
    ['Set the pivot in the engine (Unity Sprite Editor Pivot, GameMaker Origin, Godot node offset)','One sprite with one pivot that you rarely re-export.'],
    ['Pivot slices in Aseprite','You keep pivots in the .aseprite source; Nerulio reads a pivot slice on import and writes it back to .aseprite and Aseprite JSON.']]},
   limits:['Godot gets one pivot per node, not per frame, unless you script it.','Defold, Spine / libGDX and CSS exports carry no pivot.','GameMaker origins are UNVERIFIED in GameMaker itself.'],
   versions:{body:['Unity 6000.5.3f1 read back every sprite\'s pivot and it put the art where it was relative to one common anchor. Godot 4.7.2 loaded the scene with its offset. What Phaser and PixiJS do with the pivot comes from the Phaser 3.90 source and the PixiJS 8 documentation, not from a Nerulio run.'],sources:[S.unityEditor,S.godotAnim,S.phaserJson,S.phaserAnim,S.pixiAnim,S.pixiTex,S.aseSlices,S.gmSprites]}
  },
  ko:{
   answer:'피벗(오리진, 앵커라고도 함)은 게임 오브젝트의 위치에 놓이는 프레임의 점입니다. 회전은 이 점을 중심으로 돌고, 크기가 다른 프레임은 이 점에서 맞춰집니다. Nerulio에서는 한 프레임, 선택, 태그, 전체 프레임을 대상으로 픽셀 격자 위를 클릭(P)해 정하고, 프레임 캔버스 기준 0~1로 저장했다가 내보낼 때 엔진마다의 필드로 씁니다. Unity, Phaser, PixiJS는 프레임별 피벗을 따를 수 있지만 Godot 노드는 오프셋이 하나뿐이므로, 대상마다 실제로 무엇을 받는지 아래 표에 정리했습니다.',
   concept:{title:'피벗 값은 하나, 엔진 규칙은 여럿',body:[
    '엔진마다 피벗을 세는 방식이 다릅니다. Unity는 스프라이트 사각형의 왼쪽 아래에서 0~1(Normalized) 또는 픽셀로 잽니다. Phaser와 PixiJS는 y가 아래로 가는 프레임 기준 0~1입니다. Godot의 AnimatedSprite2D에는 피벗이 없고 노드 전체에 대한 픽셀 단위 그리기 오프셋만 있습니다. Nerulio는 값 하나(프레임 캔버스 기준 0~1, y는 아래 방향, 따로 정하지 않으면 아래 가운데 0.5, 1.0)만 저장하고 대상마다 변환하므로, 한 번 정한 피벗이 트림·패킹·엔진 변경 뒤에도 유지됩니다.',
    '프레임 크기가 다르거나 트림되면 프레임별 피벗이 중요해집니다. 그래서 Godot 씬은 첫 프레임의 피벗을 노드 오프셋으로 쓰고, 모든 프레임의 피벗을 리소스 메타데이터에 남기며, 한 애니메이션 안에서 피벗이 다르면 경고합니다. 어느 엔진에서든 튼튼한 구성은 프레임을 한 캔버스에 두고 태그마다 발에 피벗 하나를 두는 것입니다.',
    '피벗 도구는 정수 픽셀에 맞춰지고, 프레임을 정렬·반전·흔들림 보정할 때 그림과 함께 움직입니다.'],
    terms:[['피벗 / 오리진 / 앵커','오브젝트 위치에 놓이는 프레임의 점. 엔진에 따라 이름이 다릅니다.'],['정규화 피벗','프레임이나 스프라이트 사각형 기준 0~1. Unity는 y를 아래에서, Phaser와 PixiJS는 위에서 셉니다.'],['노드 오프셋(Godot)','AnimatedSprite2D가 텍스처를 노드 원점에서 떨어뜨려 그리는 픽셀 값. 모든 프레임에 하나.']]},
   example:{title:'예시: 피벗 하나를 엔진 다섯 곳에 쓰기',lead:'48 × 64 프레임 캔버스, 피벗은 아래 가운데. 패커가 서 있는 프레임을 (14, 34)의 20 × 30으로, 점프 프레임을 (14, 20)의 20 × 30으로 트림합니다.',lines:[
    'Nerulio           피벗 (0.5, 1.0), 48 × 64 기준  → 픽셀 (24, 64)',
    'Godot .tscn       centered = false, offset = (−24, −64)',
    'Phaser / PixiJS   pivot / anchor (0.5, 1.0), 48 × 64 원본 프레임 기준',
    'LÖVE              px = 24, py = 64',
    'Unity, 서기       ((24 − 14) ÷ 20, (30 − (64 − 34)) ÷ 30) = (0.5, 0.0)',
    'Unity, 점프       ((24 − 14) ÷ 20, (30 − (64 − 20)) ÷ 30) = (0.5, −0.467)'],
    after:'점프 프레임의 Unity 피벗은 자기 사각형보다 아래에 있습니다. 바로 그 덕분에 발이 같은 자리에 머뭅니다. 트림이 피벗을 옮기는 이유는 [[game/sprite-jitter-after-trim|트림 후 스프라이트 흔들림]]에서 설명합니다.'},
   mapping:{title:'대상마다 받는 것',head:['대상','Nerulio가 쓰는 것','엔진이 하는 일'],rows:[
    ['Godot 4','씬: `centered = false`, `offset` = 첫 애니메이션 첫 프레임의 −피벗. 모든 프레임의 피벗은 `metadata/nerulio`','AnimatedSprite2D는 모든 프레임을 그 오프셋 하나로 그림. 프레임별 피벗은 직접 스크립트 필요'],
    ['Unity 6','스프라이트마다 사용자 피벗, 스프라이트 사각형 기준 0~1, y는 위 방향(트림된 프레임은 0~1 밖일 수 있음)','스프라이트마다 피벗을 가지므로 클립이 프레임과 함께 피벗을 바꿈(Unity 6000.5.3f1에서 다시 읽어 확인)'],
    ['Phaser 3 / 4','아틀라스 JSON의 프레임별 `pivot` {x, y}','Phaser 3.90은 프레임의 사용자 피벗으로 표시하고, 애니메이션 프레임을 포함해 프레임이 바뀔 때마다 setOrigin을 호출'],
    ['PixiJS 8','프레임별 `anchor` {x, y}','텍스처의 기본 앵커가 됨. Sprite는 만들 때 가져가고, AnimatedSprite는 `updateAnchor = true`일 때만 프레임마다 따름'],
    ['Aseprite JSON, .aseprite','피벗이 바뀌는 프레임에 키가 있는 `pivot` 슬라이스','Aseprite에서 피벗 점이 있는 슬라이스로 보임'],
    ['LÖVE 11','Lua 프레임 표의 `px`, `py`','함께 온 `nerulio_atlas.lua`가 각 프레임의 피벗을 (x, y)에 맞춰 그림'],
    ['GameMaker','태그마다 스트립 하나, 모든 피벗을 한 점에 맞춤. 그 점이 `gamemaker.json`과 README의 오리진','Sprite Editor에서 스프라이트의 Origin으로 입력(GameMaker에서는 UNVERIFIED)'],
    ['Defold, Spine / libGDX, CSS','피벗 없음','엔진에서 설정']],
    note:'Starling / Sparrow XML에도 픽셀 단위 `pivotX`, `pivotY`가 들어가지만, 쓰는지는 읽는 쪽에 달려 있습니다.'},
   verify:{steps:[
    '어니언 스킨(F3)을 켜고 태그를 넘겨 봅니다. 피벗 십자가 몸의 같은 자리에 머물러야 합니다.',
    'Godot: 내보내기 안내(피벗 불일치 경고)를 읽고, `print($Hero.sprite_frames.get_meta("nerulio"))`로 프레임마다의 피벗을 봅니다.',
    'Unity: Sprite Editor에서 텍스처를 열면 스프라이트마다 Pivot이 Custom이고 값은 예시의 정규화 값입니다.',
    'Phaser: `sprite.play(\'run\')` 뒤에 `sprite.originX`, `sprite.originY`가 현재 프레임의 피벗과 같습니다.']},
   trouble:{rows:[
    ['Godot에서 애니메이션이 바뀔 때 캐릭터가 튐','노드 오프셋은 첫 애니메이션 첫 프레임에서 온 하나뿐인데 다른 애니메이션은 피벗이 다름','Godot 내보내기 안내, `metadata/nerulio`의 피벗 비교','캐릭터의 모든 태그에 피벗 하나를 쓰거나, 애니메이션이 바뀔 때 스크립트로 메타데이터에서 `offset`을 설정'],
    ['PixiJS AnimatedSprite가 프레임별 피벗을 무시함','`updateAnchor`가 기본값 false라 첫 텍스처의 앵커가 유지됨','`sprite.updateAnchor` 값을 출력','`updateAnchor = true`로 두거나 태그에 피벗 하나만 쓰기'],
    ['Unity 피벗이 0보다 작거나 1보다 큼','트림된 프레임이라 전체 캔버스 기준 피벗이 작아진 사각형 밖에 있음','Sprite Editor의 Custom Pivot 값','고칠 필요 없음. 그래야 그림이 맞춰짐. 0~1이 꼭 필요한 도구라면 트림을 끄고 패킹']]},
   alternatives:{rows:[
    ['엔진에서 피벗 설정(Unity Sprite Editor Pivot, GameMaker Origin, Godot 노드 오프셋)','피벗이 하나뿐인 스프라이트를 거의 다시 내보내지 않을 때.'],
    ['Aseprite의 피벗 슬라이스','피벗을 .aseprite 원본에 두고 싶을 때. Nerulio는 가져올 때 피벗 슬라이스를 읽고 .aseprite와 Aseprite JSON에 다시 씁니다.']]},
   limits:['Godot는 스크립트를 쓰지 않는 한 프레임별이 아니라 노드마다 피벗 하나를 받습니다.','Defold, Spine / libGDX, CSS 내보내기에는 피벗이 없습니다.','GameMaker 오리진은 GameMaker 자체에서 UNVERIFIED입니다.'],
   versions:{body:['Unity 6000.5.3f1이 모든 스프라이트의 피벗을 다시 읽었고, 공통 기준점에 대해 그림이 원래 자리에 놓였습니다. Godot 4.7.2는 오프셋이 있는 씬을 불러왔습니다. Phaser와 PixiJS가 피벗으로 하는 일은 Phaser 3.90 소스와 PixiJS 8 문서에 따른 것이며, Nerulio가 실행해 본 결과는 아닙니다.'],sources:[S.unityEditor,S.godotAnim,S.phaserJson,S.phaserAnim,S.pixiAnim,S.pixiTex,S.aseSlices,S.gmSprites]}
  },
  ja:{
   answer:'ピボット（オリジン、アンカーとも呼ぶ）は、ゲームオブジェクトの位置に置かれるフレーム上の点です。回転はこの点を中心に行われ、大きさの違うフレームはこの点でそろいます。Nerulioでは、1フレーム・選択・タグ・全フレームを対象に、ピクセルグリッド上をクリック（P）して決め、フレームキャンバスに対する0〜1で保存し、書き出し時に各エンジンの項目へ変換します。Unity・Phaser・PixiJSはフレームごとのピボットに従えますが、Godotのノードはオフセットが1つだけなので、書き出し先ごとに実際に何が渡るかを下の表にまとめました。',
   concept:{title:'ピボットの値は1つ、エンジンの流儀はいろいろ',body:[
    'ピボットの数え方はエンジンごとに違います。Unityはスプライト矩形の左下から0〜1（Normalized）かピクセルで測ります。PhaserとPixiJSはyが下向きのフレームに対する0〜1です。GodotのAnimatedSprite2Dにはピボットがなく、ノード全体に対するピクセル単位の描画オフセットがあるだけです。Nerulioは値を1つ（フレームキャンバスに対する0〜1、yは下向き、指定しなければ下中央0.5, 1.0）だけ持ち、書き出し先ごとに変換するので、一度決めたピボットはトリム・パック・エンジンの変更を経ても保たれます。',
    'フレームの大きさが違ったりトリムされたりすると、フレームごとのピボットが効いてきます。そのためGodotのシーンは最初のフレームのピボットをノードのオフセットにし、全フレームのピボットをリソースのメタデータに残し、1つのアニメーション内でピボットが違えば警告します。どのエンジンでも堅実なのは、フレームを1つのキャンバスに載せ、タグごとに足元へピボットを1つ置く構成です。',
    'ピボットツールは整数ピクセルにスナップし、フレームをそろえる・反転する・ブレを補正するときに絵と一緒に動きます。'],
    terms:[['ピボット／オリジン／アンカー','オブジェクトの位置に置かれるフレーム上の点。呼び名はエンジンによって違います。'],['正規化ピボット','フレームやスプライト矩形に対する0〜1。Unityはyを下から、PhaserとPixiJSは上から数えます。'],['ノードのオフセット（Godot）','AnimatedSprite2Dがテクスチャをノードの原点からずらして描くピクセル値。全フレームで1つ。']]},
   example:{title:'例：1つのピボットを5つのエンジン向けに書く',lead:'48 × 64のフレームキャンバスで、ピボットは下中央。パッカーは立ちフレームを (14, 34) の 20 × 30 に、ジャンプフレームを (14, 20) の 20 × 30 にトリムします。',lines:[
    'Nerulio           ピボット (0.5, 1.0)、48 × 64 基準 → ピクセル (24, 64)',
    'Godot .tscn       centered = false、offset = (−24, −64)',
    'Phaser / PixiJS   pivot / anchor (0.5, 1.0)、48 × 64 の元フレーム基準',
    'LÖVE              px = 24、py = 64',
    'Unity 立ち        ((24 − 14) ÷ 20, (30 − (64 − 34)) ÷ 30) = (0.5, 0.0)',
    'Unity ジャンプ    ((24 − 14) ÷ 20, (30 − (64 − 20)) ÷ 30) = (0.5, −0.467)'],
    after:'ジャンプフレームのUnityのピボットは自分の矩形より下にあります。だからこそ足が同じ位置に留まります。トリムでピボットが動く理由は[[game/sprite-jitter-after-trim|トリム後のスプライトのブレ]]で説明しています。'},
   mapping:{title:'書き出し先ごとに渡るもの',head:['書き出し先','Nerulioが書くもの','エンジン側の扱い'],rows:[
    ['Godot 4','シーン：`centered = false`、`offset` = 最初のアニメーションの最初のフレームの −ピボット。全フレームのピボットは `metadata/nerulio`','AnimatedSprite2Dは全フレームをそのオフセット1つで描く。フレームごとのピボットには自作のスクリプトが必要'],
    ['Unity 6','スプライトごとのカスタムピボット。スプライト矩形に対する0〜1、yは上向き（トリムしたフレームでは0〜1の外もある）','スプライトごとにピボットを持つので、クリップはフレームとともにピボットも切り替える（Unity 6000.5.3f1で読み戻し確認）'],
    ['Phaser 3 / 4','アトラスJSONのフレームごとの `pivot` {x, y}','Phaser 3.90はフレームのカスタムピボットとして扱い、アニメーションのフレームも含めてフレームが変わるたびにsetOriginを呼ぶ'],
    ['PixiJS 8','フレームごとの `anchor` {x, y}','テクスチャの既定アンカーになる。Spriteは作成時に取り込み、AnimatedSpriteは `updateAnchor = true` のときだけフレームごとに従う'],
    ['Aseprite JSON、.aseprite','ピボットが変わるフレームにキーを持つ `pivot` スライス','Asepriteではピボット点つきのスライスとして見える'],
    ['LÖVE 11','Luaのフレーム表の `px`、`py`','同梱の `nerulio_atlas.lua` が各フレームのピボットを (x, y) に合わせて描く'],
    ['GameMaker','タグごとに1本のストリップで、全ピボットを1点に合わせる。その点が `gamemaker.json` とREADMEのオリジン','Sprite EditorでスプライトのOriginとして入力（GameMakerではUNVERIFIED）'],
    ['Defold、Spine / libGDX、CSS','ピボットなし','エンジン側で設定']],
    note:'Starling / Sparrow XMLにもピクセル単位の `pivotX`・`pivotY` が入りますが、使うかどうかは読み込む側しだいです。'},
   verify:{steps:[
    'オニオンスキン（F3）を付けてタグをコマ送りします。ピボットの十字が体の同じ位置に留まるはずです。',
    'Godot：書き出しの注記（ピボット不一致の警告）を読み、`print($Hero.sprite_frames.get_meta("nerulio"))` でフレームごとのピボットを見ます。',
    'Unity：Sprite Editorでテクスチャを開くと、各スプライトのPivotはCustomで、値は例の正規化値です。',
    'Phaser：`sprite.play(\'run\')` のあと、`sprite.originX`・`sprite.originY` が現在のフレームのピボットと同じです。']},
   trouble:{rows:[
    ['Godotでアニメーションが切り替わるとキャラが跳ねる','ノードのオフセットは最初のアニメーションの最初のフレームから取った1つだけで、ほかのアニメーションはピボットが違う','Godot書き出しの注記、`metadata/nerulio` のピボットを比べる','キャラの全タグでピボットを1つにするか、アニメーション切り替え時にスクリプトでメタデータから `offset` を設定する'],
    ['PixiJSのAnimatedSpriteがフレームごとのピボットを無視する','`updateAnchor` の既定値がfalseで、最初のテクスチャのアンカーのままになる','`sprite.updateAnchor` を出力する','`updateAnchor = true` にするか、タグのピボットを1つにする'],
    ['Unityのピボットが0未満や1超えになる','トリムしたフレームで、キャンバス全体に対するピボットが小さくなった矩形の外にある','Sprite EditorのCustom Pivotの値','直す必要はない。それで絵がそろう。0〜1が必須のツールならトリムなしでパックする']]},
   alternatives:{rows:[
    ['エンジン側でピボットを設定（UnityのSprite EditorのPivot、GameMakerのOrigin、Godotのノードのオフセット）','ピボットが1つのスプライトを、めったに書き出し直さないとき。'],
    ['Asepriteのピボットスライス','ピボットを.asepriteの元データで管理したいとき。Nerulioは読み込み時にピボットスライスを読み、.asepriteとAseprite JSONに書き戻します。']]},
   limits:['Godotには、スクリプトを書かないかぎりフレームごとではなくノードごとに1つのピボットが渡ります。','Defold、Spine / libGDX、CSSの書き出しにはピボットがありません。','GameMakerのオリジンはGameMaker本体ではUNVERIFIEDです。'],
   versions:{body:['Unity 6000.5.3f1が全スプライトのピボットを読み戻し、共通の基準点に対して絵が元の位置に置かれました。Godot 4.7.2はオフセット付きのシーンを読み込みました。PhaserとPixiJSがピボットをどう扱うかはPhaser 3.90のソースとPixiJS 8のドキュメントによるもので、Nerulioで実行した結果ではありません。'],sources:[S.unityEditor,S.godotAnim,S.phaserJson,S.phaserAnim,S.pixiAnim,S.pixiTex,S.aseSlices,S.gmSprites]}
  }
 },
 // ------------------------------------------------------------------ game/hitbox-editor
 'game/hitbox-editor':{
  type:'create',
  intent:{primary:'draw hitboxes and hurtboxes per animation frame and use them in a game engine',secondary:['hit vs hurt boxes','box coordinates relative to the pivot','which export carries boxes'],
   goal:'per-frame boxes with stable ids, in a file the game can read, placed correctly relative to the object',input:'imported frames with tags',output:'boxes in the Godot bundle metadata, the generic JSON and (rectangles) Aseprite slices',support:'partial',
   evidence:['src/game/export/godot.js (metadata nerulio boxes)','src/game/export/atlas-json.js (Aseprite JSON: rect boxes only; generic JSON: all)','src/studio/sprite/aseprite-bridge.js (.aseprite: circle/polygon skipped with a reason)','src/game/export/unity.js (no boxes, note)','docs/STUDIO-PACK.md rows 48–49, docs/ENGINE-VERIFY.md meta.boxes / slice keys'],
   external:['Godot Area2D, CollisionShape2D, RectangleShape2D, get_meta','Unity BoxCollider2D size and offset','Phaser Arcade Body setSize / setOffset / setCircle','Aseprite slices']},
  en:{
   answer:'A hitbox (the area that deals damage) and a hurtbox (the area that can be hit) are per-frame shapes that game code checks; they are not part of the image. Nerulio lets you draw rectangle, circle or polygon boxes typed hit, hurt, interact or any custom word on each frame, copy one box along a tag with the same id, and nudge it frame by frame. Every box is exported into the Godot bundle\'s metadata and the generic JSON, rectangles also as Aseprite slices; no engine nodes or colliders are generated, so you build Area2D shapes, Unity colliders or Phaser bodies from that data.',
   concept:{title:'Boxes belong to frames, and engines build them from data',body:[
    'Action games switch boxes with the animation: an attack\'s hitbox exists only on its active frames, while the hurtbox follows the body on every frame. So boxes belong to frames, not to the sprite, and the same logical box needs one identity across frames. In Nerulio a box has an id, a type and a shape in frame-canvas pixels (origin top-left, y down); drawing or copying it with the tag scope keeps the id, so code can track the sword box from frame to frame.',
    'Engines do not read boxes from images. Godot detects overlaps with Area2D nodes that carry CollisionShape2D or CollisionPolygon2D children; Unity uses Collider2D components such as BoxCollider2D, which has a size and an offset in local units; a Phaser Arcade body is sized with setSize, setOffset or setCircle and otherwise uses the frame size. In all three you update the shape per frame yourself, in code or an animation track. The export gives you the numbers; it does not create those nodes or components.',
    'Box coordinates are relative to the frame canvas. To place a box on the object, subtract the pivot: in the Godot scene, where the offset is −pivot, a box at (x, y) on the frame sits at (x − pivot x, y − pivot y) in node space. Unity counts y upwards and in units, so divide by Pixels Per Unit (100 in the Unity export).'],
    terms:[['Hitbox','The area of an attack frame that deals damage.'],['Hurtbox','The area of the body that can be hit.'],['Box id','Stays the same on every frame the box was copied to, so code can follow one box.'],['Frame-canvas pixels','Coordinates from the top-left corner of the frame\'s full canvas, y down.']]},
   example:{title:'Example: one hitbox, placed in Godot and Unity',lead:'Frame canvas 48 × 64 with the pivot at (24, 64). On attack frames 4–6 a hit box at x 34, y 30, 16 × 12 px.',lines:[
    'Nerulio (frame canvas, y down)   x 34, y 30, w 16, h 12',
    'relative to the pivot            left 34 − 24 = 10, top 30 − 64 = −34',
    'Godot node space (y down)        rectangle 10, −34, 16 × 12, centre (18, −28)',
    'Unity (y up, 100 px per unit)    centre ((34 + 8 − 24) ÷ 100, (64 − (30 + 6)) ÷ 100) = (0.18, 0.28)',
    '                                 size (0.16, 0.12)',
    'Godot metadata                   get_meta("nerulio")["frames"]["attack_004"]["boxes"]',
    '                                 [{"id": …, "type": "hit", "shape": "rect", "x": 34, "y": 30, "w": 16, "h": 12}]'],
    after:'Circles are stored as cx, cy, r and polygons as a list of points, in the same pixels. For solid collision outlines rather than attack boxes, see the [[game/collision-polygon-generator|collision polygon generator]].'},
   mapping:{title:'Which export carries the boxes',head:['Target','Boxes in the export','What you build in the engine'],rows:[
    ['Godot 4','Every box (rectangle, circle, polygon) with id and type, per frame, in the SpriteFrames `metadata/nerulio`','Area2D with CollisionShape2D or CollisionPolygon2D children, moved per frame by your script (the metadata was read back by Godot 4.7.2)'],
    ['Generic JSON','Every box per frame, with the pivot and the collision polygons','Any engine: read `frames[key].boxes`'],
    ['.aseprite, Aseprite JSON','Rectangles only: one slice per box type and slot, keyed where the box changes; circles and polygons are skipped','Aseprite shows slices (read back by Aseprite 1.3.18); JSON readers get `meta.slices`'],
    ['Unity 6','None; the export notes say so','Colliders built by your own script from the generic JSON'],
    ['Phaser, PixiJS, LÖVE, Spine, Starling, Defold, GameMaker, CSS','None','Load the generic JSON next to the atlas']]},
   verify:{steps:[
    'Step through the attack with , and . and watch the box on each frame; boxes that reach past the frame canvas are kept and marked.',
    'After a Godot export, `print($Hero.sprite_frames.get_meta("nerulio")["frames"].keys())` lists the frame keys, and each entry\'s `boxes` holds your boxes.',
    'After an .aseprite export, open the file in Aseprite: each rectangle box type is a slice whose keys change on the frames where the box moves.']},
   trouble:{rows:[
    ['Circle or polygon boxes are missing in Aseprite','Aseprite slices are rectangles, so the .aseprite export skips other shapes and names them','The export message lists the skipped boxes','Use rectangles for boxes that must reach Aseprite, or read circles and polygons from the generic JSON'],
    ['Boxes appear in the wrong place in the engine','Box coordinates start at the frame canvas\'s top-left corner, not at the pivot','Compare one box with the worked example above','Subtract the pivot; in Unity also flip y and divide by Pixels Per Unit'],
    ['A box shows up on frames where it should not','It was drawn or copied with the scope set to the tag or all frames','Step through the frames: the same id appears on each','Delete it on those frames, or redraw it with the scope set to this frame'],
    ['The Unity import has no boxes','The Unity export writes sprite rects, pivots and clips only','The export notes: hitboxes have no Unity sprite field','Export the generic JSON as well and create colliders from it']]},
   alternatives:{rows:[
    ['Draw the shapes in the engine (Godot CollisionShape2D, Unity BoxCollider2D, Phaser body setSize and setOffset)','One or two boxes that do not change from frame to frame.'],
    ['Slices in Aseprite','Rectangle boxes drawn next to the art; Nerulio imports named slices as boxes (hit, hurt …) and writes them back.']]},
   limits:['No engine nodes, colliders or physics bodies are generated; the export carries data only.','Aseprite formats carry rectangle boxes only.','Box coordinates are whole pixels on the frame canvas.'],
   versions:{body:['Boxes in the Godot bundle were read back by Godot 4.7.2, and rectangle slices by Aseprite 1.3.18, including boxes that reach past the frame canvas. The node and component names follow the Godot 4.7, Unity 6 and Phaser documentation.'],sources:[S.godotArea,S.godotRect,S.godotMeta,S.unityBox,S.phaserBody,S.aseSlices]}
  },
  ko:{
   answer:'히트박스(피해를 주는 영역)와 허트박스(맞을 수 있는 영역)는 게임 코드가 검사하는 프레임별 도형이며 그림의 일부가 아닙니다. Nerulio에서는 프레임마다 hit, hurt, interact나 원하는 이름의 사각형·원·폴리곤 박스를 그리고, 박스 하나를 같은 id로 태그 전체에 복사하고, 프레임마다 미세 조정할 수 있습니다. 모든 박스는 Godot 번들의 메타데이터와 일반 JSON으로, 사각형은 Aseprite 슬라이스로도 내보냅니다. 엔진 노드나 콜라이더는 만들어지지 않으므로 Area2D 도형, Unity 콜라이더, Phaser 바디는 이 데이터로 직접 구성합니다.',
   concept:{title:'박스는 프레임에 속하고, 엔진은 데이터로 만든다',body:[
    '액션 게임은 애니메이션에 따라 박스를 켜고 끕니다. 공격의 히트박스는 유효 프레임에만 있고, 허트박스는 매 프레임 몸을 따라갑니다. 그래서 박스는 스프라이트가 아니라 프레임에 속하고, 같은 논리적 박스는 프레임이 바뀌어도 하나의 정체성을 가져야 합니다. Nerulio의 박스는 id, 유형, 프레임 캔버스 픽셀(원점 왼쪽 위, y는 아래) 단위의 도형을 가지며, 태그 범위로 그리거나 복사하면 id가 유지돼 코드가 칼 박스를 프레임마다 추적할 수 있습니다.',
    '엔진은 이미지에서 박스를 읽지 않습니다. Godot는 CollisionShape2D나 CollisionPolygon2D 자식을 가진 Area2D 노드로 겹침을 감지하고, Unity는 로컬 단위의 크기와 오프셋을 가진 BoxCollider2D 같은 Collider2D 컴포넌트를 쓰며, Phaser Arcade 바디는 setSize, setOffset, setCircle로 크기를 정하고 아니면 프레임 크기를 씁니다. 세 엔진 모두 프레임마다 도형을 코드나 애니메이션 트랙으로 직접 바꿔야 합니다. 내보내기는 숫자를 줄 뿐, 그런 노드나 컴포넌트를 만들지 않습니다.',
    '박스 좌표는 프레임 캔버스 기준입니다. 오브젝트에 놓으려면 피벗을 빼세요. 오프셋이 −피벗인 Godot 씬에서 프레임의 (x, y)에 있는 박스는 노드 공간의 (x − 피벗 x, y − 피벗 y)에 있습니다. Unity는 y가 위로 가고 단위가 유닛이므로 Pixels Per Unit(Unity 내보내기에서는 100)으로 나눕니다.'],
    terms:[['히트박스','공격 프레임에서 피해를 주는 영역.'],['허트박스','몸에서 맞을 수 있는 영역.'],['박스 id','박스를 복사한 모든 프레임에서 같아서, 코드가 박스 하나를 따라갈 수 있음.'],['프레임 캔버스 픽셀','프레임 전체 캔버스의 왼쪽 위 모서리부터의 좌표, y는 아래 방향.']]},
   example:{title:'예시: 히트박스 하나를 Godot와 Unity에 놓기',lead:'프레임 캔버스 48 × 64, 피벗 (24, 64). attack 4~6번 프레임에 x 34, y 30, 16 × 12px 히트 박스.',lines:[
    'Nerulio(프레임 캔버스, y 아래)    x 34, y 30, w 16, h 12',
    '피벗 기준                         왼쪽 34 − 24 = 10, 위 30 − 64 = −34',
    'Godot 노드 공간(y 아래)           사각형 10, −34, 16 × 12, 중심 (18, −28)',
    'Unity(y 위, 유닛당 100px)         중심 ((34 + 8 − 24) ÷ 100, (64 − (30 + 6)) ÷ 100) = (0.18, 0.28)',
    '                                  크기 (0.16, 0.12)',
    'Godot 메타데이터                  get_meta("nerulio")["frames"]["attack_004"]["boxes"]',
    '                                  [{"id": …, "type": "hit", "shape": "rect", "x": 34, "y": 30, "w": 16, "h": 12}]'],
    after:'원은 cx, cy, r로, 폴리곤은 점 목록으로 같은 픽셀 단위로 저장됩니다. 공격 박스가 아니라 단단한 충돌 윤곽이 필요하면 [[game/collision-polygon-generator|충돌 폴리곤 생성기]]를 보세요.'},
   mapping:{title:'박스가 들어가는 내보내기',head:['대상','내보내기에 든 박스','엔진에서 만들 것'],rows:[
    ['Godot 4','모든 박스(사각형·원·폴리곤)를 id·유형과 함께 프레임별로 SpriteFrames `metadata/nerulio`에','CollisionShape2D나 CollisionPolygon2D 자식을 가진 Area2D, 스크립트로 프레임마다 이동(메타데이터는 Godot 4.7.2에서 다시 읽어 확인)'],
    ['일반 JSON','프레임별 모든 박스, 피벗, 충돌 폴리곤','어느 엔진이든 `frames[key].boxes`를 읽기'],
    ['.aseprite, Aseprite JSON','사각형만: 박스 유형·순번마다 슬라이스 하나, 박스가 바뀌는 프레임에 키. 원과 폴리곤은 빠짐','Aseprite에서 슬라이스로 보임(Aseprite 1.3.18에서 확인). JSON을 읽는 쪽은 `meta.slices`'],
    ['Unity 6','없음. 내보내기 안내에 표시됨','일반 JSON을 읽는 직접 만든 스크립트로 콜라이더 구성'],
    ['Phaser, PixiJS, LÖVE, Spine, Starling, Defold, GameMaker, CSS','없음','아틀라스 옆에 일반 JSON을 함께 불러오기']]},
   verify:{steps:[
    ', 와 . 로 공격을 넘기며 프레임마다 박스를 봅니다. 프레임 캔버스 밖으로 나간 박스도 유지되고 표시됩니다.',
    'Godot로 내보낸 뒤 `print($Hero.sprite_frames.get_meta("nerulio")["frames"].keys())`로 프레임 키를 보고, 각 항목의 `boxes`에 박스가 있는지 확인합니다.',
    '.aseprite로 내보낸 뒤 Aseprite에서 엽니다. 사각형 박스 유형마다 슬라이스가 있고, 박스가 움직이는 프레임에서 키가 바뀝니다.']},
   trouble:{rows:[
    ['Aseprite에 원이나 폴리곤 박스가 없음','Aseprite 슬라이스는 사각형이라 .aseprite 내보내기가 다른 도형을 건너뛰고 이름을 알려 줌','내보내기 메시지에 건너뛴 박스가 나옴','Aseprite까지 가야 하는 박스는 사각형으로 그리거나, 원·폴리곤은 일반 JSON에서 읽기'],
    ['엔진에서 박스 위치가 틀림','박스 좌표는 피벗이 아니라 프레임 캔버스의 왼쪽 위 모서리에서 시작함','위 예시와 박스 하나를 비교','피벗을 빼기. Unity라면 y를 뒤집고 Pixels Per Unit으로도 나누기'],
    ['박스가 있으면 안 되는 프레임에 나옴','범위를 태그나 전체 프레임으로 두고 그리거나 복사함','프레임을 넘겨 보면 같은 id가 모두 있음','그 프레임에서 지우거나, 범위를 이 프레임으로 두고 다시 그리기'],
    ['Unity로 가져온 결과에 박스가 없음','Unity 내보내기는 스프라이트 사각형, 피벗, 클립만 씀','내보내기 안내: 히트박스를 넣을 Unity 스프라이트 필드가 없음','일반 JSON도 내보내 그걸로 콜라이더 만들기']]},
   alternatives:{rows:[
    ['엔진에서 도형 그리기(Godot CollisionShape2D, Unity BoxCollider2D, Phaser 바디 setSize·setOffset)','프레임마다 바뀌지 않는 박스가 한두 개일 때.'],
    ['Aseprite의 슬라이스','그림 옆에 사각형 박스를 그릴 때. Nerulio는 이름 있는 슬라이스(hit, hurt …)를 박스로 가져오고 다시 씁니다.']]},
   limits:['엔진 노드, 콜라이더, 물리 바디는 만들지 않습니다. 내보내기에는 데이터만 들어갑니다.','Aseprite 형식에는 사각형 박스만 들어갑니다.','박스 좌표는 프레임 캔버스의 정수 픽셀입니다.'],
   versions:{body:['Godot 번들의 박스는 Godot 4.7.2가, 사각형 슬라이스는 Aseprite 1.3.18이 다시 읽었습니다(프레임 캔버스 밖으로 나간 박스 포함). 노드와 컴포넌트 이름은 Godot 4.7, Unity 6, Phaser 문서를 따릅니다.'],sources:[S.godotArea,S.godotRect,S.godotMeta,S.unityBox,S.phaserBody,S.aseSlices]}
  },
  ja:{
   answer:'ヒットボックス（ダメージを与える範囲）とハートボックス（攻撃を受ける範囲）は、ゲームのコードが判定に使うフレームごとの図形で、画像の一部ではありません。Nerulioでは、フレームごとにhit・hurt・interactや任意の名前の矩形・円・ポリゴンのボックスを描き、1つのボックスを同じIDのままタグ全体にコピーし、フレームごとに微調整できます。すべてのボックスはGodotバンドルのメタデータと汎用JSONに、矩形はAsepriteのスライスにも書き出されます。エンジンのノードやコライダーは生成しないので、Area2Dの形状やUnityのコライダー、Phaserのボディはこのデータから組み立てます。',
   concept:{title:'ボックスはフレームに属し、エンジンはデータから作る',body:[
    'アクションゲームはアニメーションに合わせてボックスを出し入れします。攻撃のヒットボックスは有効なフレームにだけあり、ハートボックスは毎フレーム体を追います。そのためボックスはスプライトではなくフレームに属し、同じ論理的なボックスはフレームをまたいで1つの身元を持つ必要があります。Nerulioのボックスは、ID・種類・フレームキャンバスのピクセル（原点は左上、yは下向き）での図形を持ち、タグ範囲で描いたりコピーしたりするとIDが保たれるので、コードは剣のボックスをフレームごとに追えます。',
    'エンジンは画像からボックスを読みません。GodotはCollisionShape2DやCollisionPolygon2Dを子に持つArea2Dノードで重なりを検出し、Unityはローカル単位のサイズとオフセットを持つBoxCollider2DなどのCollider2Dコンポーネントを使い、PhaserのArcadeボディはsetSize・setOffset・setCircleで大きさを決め、指定しなければフレームの大きさになります。どれもフレームごとの形状の更新は、コードかアニメーショントラックで自分で行います。書き出しは数値を渡すだけで、そうしたノードやコンポーネントは作りません。',
    'ボックスの座標はフレームキャンバス基準です。オブジェクトに置くにはピボットを引きます。オフセットが −ピボットのGodotのシーンでは、フレーム上 (x, y) のボックスはノード空間の (x − ピボットx, y − ピボットy) にあります。Unityはyが上向きで単位はユニットなので、Pixels Per Unit（Unity書き出しでは100）で割ります。'],
    terms:[['ヒットボックス','攻撃フレームでダメージを与える範囲。'],['ハートボックス','体のうち攻撃を受ける範囲。'],['ボックスID','ボックスをコピーした全フレームで同じなので、コードが1つのボックスを追える。'],['フレームキャンバスのピクセル','フレーム全体のキャンバスの左上角からの座標。yは下向き。']]},
   example:{title:'例：1つのヒットボックスをGodotとUnityに置く',lead:'フレームキャンバス48 × 64、ピボット (24, 64)。attackの4〜6フレーム目に x 34、y 30、16 × 12pxのヒットボックス。',lines:[
    'Nerulio（キャンバス、y下向き）   x 34、y 30、w 16、h 12',
    'ピボット基準                     左 34 − 24 = 10、上 30 − 64 = −34',
    'Godotのノード空間（y下向き）     矩形 10, −34, 16 × 12、中心 (18, −28)',
    'Unity（y上向き、100px/ユニット）  中心 ((34 + 8 − 24) ÷ 100, (64 − (30 + 6)) ÷ 100) = (0.18, 0.28)',
    '                                 サイズ (0.16, 0.12)',
    'Godotのメタデータ                get_meta("nerulio")["frames"]["attack_004"]["boxes"]',
    '                                 [{"id": …, "type": "hit", "shape": "rect", "x": 34, "y": 30, "w": 16, "h": 12}]'],
    after:'円はcx・cy・r、ポリゴンは点のリストとして、同じピクセル単位で保存されます。攻撃判定ではなく体の衝突形状が欲しい場合は[[game/collision-polygon-generator|衝突ポリゴン生成]]を参照してください。'},
   mapping:{title:'ボックスが入る書き出し',head:['書き出し先','書き出しに入るボックス','エンジンで作るもの'],rows:[
    ['Godot 4','すべてのボックス（矩形・円・ポリゴン）をID・種類つきでフレームごとにSpriteFramesの `metadata/nerulio` へ','CollisionShape2DかCollisionPolygon2Dを子に持つArea2Dを、スクリプトでフレームごとに動かす（メタデータはGodot 4.7.2で読み戻し確認）'],
    ['汎用JSON','フレームごとの全ボックス、ピボット、衝突ポリゴン','どのエンジンでも `frames[key].boxes` を読む'],
    ['.aseprite、Aseprite JSON','矩形のみ：ボックスの種類と順番ごとに1スライス、ボックスが変わるフレームにキー。円とポリゴンは除外','Asepriteでスライスとして見える（Aseprite 1.3.18で確認）。JSONを読む側は `meta.slices`'],
    ['Unity 6','なし。書き出しの注記に出る','汎用JSONを読む自作スクリプトでコライダーを作る'],
    ['Phaser、PixiJS、LÖVE、Spine、Starling、Defold、GameMaker、CSS','なし','アトラスの隣に汎用JSONも読み込む']]},
   verify:{steps:[
    ', と . で攻撃をコマ送りし、フレームごとのボックスを見ます。フレームキャンバスの外にはみ出したボックスも保持され、印が付きます。',
    'Godotに書き出したら、`print($Hero.sprite_frames.get_meta("nerulio")["frames"].keys())` でフレームキーを確認し、各項目の `boxes` にボックスがあるか見ます。',
    '.asepriteに書き出したらAsepriteで開きます。矩形ボックスの種類ごとにスライスがあり、ボックスが動くフレームでキーが変わります。']},
   trouble:{rows:[
    ['Asepriteで円やポリゴンのボックスがない','Asepriteのスライスは矩形なので、.aseprite書き出しはほかの図形を飛ばし、その名前を知らせる','書き出しメッセージに飛ばしたボックスが出る','Asepriteまで届けたいボックスは矩形で描くか、円とポリゴンは汎用JSONから読む'],
    ['エンジンでボックスの位置がずれる','ボックスの座標はピボットではなくフレームキャンバスの左上角から始まる','上の例とボックスを1つ比べる','ピボットを引く。Unityではさらにyを反転しPixels Per Unitで割る'],
    ['あってはいけないフレームにボックスが出る','範囲をタグか全フレームにして描いた、またはコピーした','コマ送りすると同じIDが各フレームにある','そのフレームで削除するか、範囲を「このフレーム」にして描き直す'],
    ['Unityに取り込んだ結果にボックスがない','Unity書き出しはスプライト矩形・ピボット・クリップだけを書く','書き出しの注記：ヒットボックスを入れるUnityのスプライト項目がない','汎用JSONも書き出し、そこからコライダーを作る']]},
   alternatives:{rows:[
    ['エンジン側で形状を描く（GodotのCollisionShape2D、UnityのBoxCollider2D、PhaserのボディのsetSize・setOffset）','フレームごとに変わらないボックスが1〜2個のとき。'],
    ['Asepriteのスライス','絵の横で矩形のボックスを描くとき。Nerulioは名前付きスライス（hit、hurt …）をボックスとして読み込み、書き戻します。']]},
   limits:['エンジンのノード・コライダー・物理ボディは生成しません。書き出しに入るのはデータだけです。','Aseprite形式に入るのは矩形のボックスだけです。','ボックスの座標はフレームキャンバス上の整数ピクセルです。'],
   versions:{body:['Godotバンドルのボックスは Godot 4.7.2 が、矩形のスライスは Aseprite 1.3.18 が読み戻しました（フレームキャンバスからはみ出したボックスを含む）。ノードとコンポーネントの名前は Godot 4.7、Unity 6、Phaser のドキュメントに従います。'],sources:[S.godotArea,S.godotRect,S.godotMeta,S.unityBox,S.phaserBody,S.aseSlices]}
  }
 },
 // ------------------------------------------------------------------ game/collision-polygon-generator
 'game/collision-polygon-generator':{
  type:'create',
  intent:{primary:'generate a collision polygon from a sprite\'s transparency and use it in an engine',secondary:['alpha threshold','vertex cap and simplification','per-frame polygons','Godot CollisionPolygon2D, Unity PolygonCollider2D'],
   goal:'a simple, non-self-crossing polygon per frame that follows the silhouette, placed correctly on the object',input:'imported frames with transparency',output:'polygons per frame in the Godot bundle metadata and the generic JSON',support:'partial',
   evidence:['src/game/contour.js collisionPolygons (lattice tracing, RDP, self-intersection rejected, maxPolygons 8, minArea 4)','src/studio/workspaces/sprite.js DEFAULTS (maxVertices 12, alphaThreshold 127), panels-ui.js (3–64, 0–254)','src/game/export/godot.js / atlas-json.js genericJson (collision)','src/game/export/unity.js (not written, note); the worked numbers were computed with collisionPolygons'],
   external:['Godot CollisionPolygon2D (concave, build mode)','Unity PolygonCollider2D.points local space; Custom Physics Shape']},
  en:{
   answer:'A collision polygon traced from a sprite\'s alpha follows its silhouette more closely than a box. Nerulio traces each frame\'s outline along pixel edges at an alpha threshold (127 by default, so pixels at least half opaque count), simplifies it until it fits a vertex cap (12 by default, 3–64) without letting the outline cross itself, and keeps up to 8 polygons per frame in frame-canvas pixels. The polygons are exported in the Godot bundle\'s metadata and the generic JSON; Nerulio does not create CollisionPolygon2D nodes or Unity colliders.',
   concept:{title:'Tracing, simplifying, and handing the points to an engine',body:[
    'The outline runs along the edges between opaque and transparent pixels, not through pixel centres, so every vertex sits on a whole pixel corner: a 16 × 16 opaque square becomes exactly (0, 0), (16, 0), (16, 16), (0, 16). Outer outlines come back clockwise on screen (y down), and specks smaller than 4 px² are dropped.',
    'Simplification (Ramer–Douglas–Peucker) removes points that lie close to a straight line. The tolerance starts at 1 px and is raised until the polygon has no more vertices than the cap; a tolerance that would make the outline cross itself is rejected, because a self-crossing outline is not a usable physics shape. Raising the tolerance happens in steps, so a cap can be met with fewer vertices than it allows, and a low cap can round away gaps such as the space between two legs.',
    'Engines take such polygons as point lists relative to the object. Godot\'s CollisionPolygon2D accepts concave polygons and, in its default solids mode, splits them into convex parts itself; it must be the child of an Area2D or a physics body. Unity\'s PolygonCollider2D takes points in local space, and Unity can also build its own outline from a sprite\'s Custom Physics Shape. In both, subtract the frame\'s pivot first; in Unity also flip y and divide by Pixels Per Unit.'],
    terms:[['Alpha threshold','The highest alpha still counted as transparent; 127 keeps pixels that are at least half opaque.'],['Vertex cap','The most points a polygon may have after simplification.'],['Tolerance','How far (in pixels) simplification may move the outline.']]},
   example:{title:'Example: one 32 × 48 character frame at three settings',lead:'A head, a body and two legs with a 4 px gap between them, plus a faint glow (alpha 60) around the head. Numbers from Nerulio\'s tracer:',lines:[
    'traced outline (alpha > 127)            48 vertices, area 544 px²',
    'cap 64   tolerance 1 px     16 vertices, area 540 px² (−0.7 %), max deviation 1.0 px, legs kept apart',
    'cap 12   tolerance 3.8 px    5 vertices, area 428 px² (−21 %), max deviation 3.8 px, leg gap gone',
    'threshold 40, cap 12        glow counted: area 628 px², 12 vertices at tolerance 2.0 px',
    '',
    'Godot, pivot (16, 48)       polygon point (22, 48) → node space (22 − 16, 48 − 48) = (6, 0)'],
    after:'A cap of 12 did not give 12 points here: the next tolerance step already went down to 5. If the shape matters, raise the cap and compare the vertex count the Studio reports after Auto from alpha.'},
   mapping:{title:'Where the polygons go',head:['Target','Polygons in the export','What you build in the engine'],rows:[
    ['Godot 4','`collision` per frame in `metadata/nerulio`, each polygon as a flat list x0, y0, x1, y1 …','A CollisionPolygon2D under an Area2D or a body, its `polygon` set from the list minus the pivot, per frame by your script'],
    ['Generic JSON','`frames[key].collision`: each polygon as [[x, y], …]','Any engine that takes a point list'],
    ['Unity 6','None; the export notes point to the generic JSON','PolygonCollider2D points from the generic JSON, or Unity\'s own Custom Physics Shape'],
    ['Aseprite, Phaser, PixiJS, LÖVE, Spine, Starling, Defold, GameMaker, CSS','None','Load the generic JSON next to the atlas']]},
   verify:{steps:[
    'After Auto from alpha the toast reports how many frames and vertices were made; step through the tag and look at the outline on each frame.',
    'Toggle the threshold between 127 and a low value on a frame with glow or smoke and compare the outlines.',
    'In Godot, add a CollisionPolygon2D under an Area2D with the converted points and turn on Debug › Visible Collision Shapes to see it over the sprite.']},
   trouble:{rows:[
    ['The polygon swallows gaps such as the space between the legs','The vertex cap forced a tolerance larger than the gap','The vertex count after Auto is far below the cap, or the outline bridges the gap','Raise the cap (for example to 24) and run Auto again'],
    ['Glow or smoke is inside the collision shape','Its alpha is above the threshold','Lower and raise the threshold and compare','Raise the threshold so faint pixels count as transparent'],
    ['The shape is offset in the engine','Points are frame-canvas pixels from the top-left, not relative to the pivot','Compare one point with the worked example','Subtract the pivot; in Unity also flip y and divide by Pixels Per Unit'],
    ['Only some parts got a polygon','Up to 8 separate shapes per frame are kept, and specks under 4 px² are dropped','The Auto message mentions dropped specks or extra shapes','Join the parts in the art, or draw the missing polygon by hand']]},
   alternatives:{rows:[
    ['Unity\'s Custom Physics Shape in the Sprite Editor','Unity only: Unity generates and edits the outline itself, and a Polygon Collider 2D uses it for new instances of the sprite.'],
    ['A box or circle per frame','Most platformer bodies; cheaper and steadier than a detailed polygon. Draw it with the [[game/hitbox-editor|hitbox editor]], or use the convex hull, rectangle and circle options of the classic Sprite Lab.']]},
   limits:['Polygons are data in the export: no CollisionPolygon2D nodes or Unity colliders are created.','Collision polygons do not reach Unity, Aseprite or the atlas formats; use the generic JSON.','Holes inside a shape are not part of the Studio\'s polygons.'],
   versions:{body:['The tracer and the numbers in the example come from Nerulio\'s own module (src/game/contour.js). The Godot bundle that carries the metadata was loaded by Godot 4.7.2; the collision polygons in it were not used as physics shapes in that run. Engine behaviour follows the Godot 4.7 and Unity 6 documentation.'],sources:[S.godotPoly,S.godotArea,S.unityPoints,S.unityPhys]}
  },
  ko:{
   answer:'스프라이트의 알파로 따낸 충돌 폴리곤은 박스보다 실루엣을 더 가깝게 따릅니다. Nerulio는 프레임마다 알파 임계값(기본 127, 즉 절반 이상 불투명한 픽셀이 포함)으로 픽셀 가장자리를 따라 윤곽을 따고, 윤곽이 스스로 교차하지 않게 하면서 꼭짓점 상한(기본 12, 3~64)에 맞을 때까지 단순화하며, 프레임마다 폴리곤을 최대 8개까지 프레임 캔버스 픽셀로 저장합니다. 폴리곤은 Godot 번들의 메타데이터와 일반 JSON으로 내보내며, CollisionPolygon2D 노드나 Unity 콜라이더를 만들지는 않습니다.',
   concept:{title:'윤곽 따기, 단순화, 엔진에 점 넘기기',body:[
    '윤곽은 픽셀 중심이 아니라 불투명 픽셀과 투명 픽셀 사이의 경계를 따라가므로, 모든 꼭짓점이 정수 픽셀 모서리에 놓입니다. 16 × 16 불투명 정사각형은 정확히 (0, 0), (16, 0), (16, 16), (0, 16)이 됩니다. 바깥 윤곽은 화면 기준 시계 방향(y 아래)으로 나오고, 4px²보다 작은 점 조각은 버립니다.',
    '단순화(Ramer–Douglas–Peucker)는 직선에 가까운 점을 지웁니다. 허용 오차는 1px에서 시작해 꼭짓점 수가 상한 이하가 될 때까지 올라가고, 윤곽이 스스로 교차하게 만드는 오차는 거부합니다. 스스로 교차하는 윤곽은 물리 도형으로 쓸 수 없기 때문입니다. 오차는 단계적으로 오르므로 상한보다 적은 꼭짓점으로 끝날 수 있고, 상한이 낮으면 두 다리 사이 같은 틈이 뭉개질 수 있습니다.',
    '엔진은 이런 폴리곤을 오브젝트 기준 점 목록으로 받습니다. Godot의 CollisionPolygon2D는 오목한 폴리곤도 받으며, 기본 솔리드 모드에서는 스스로 볼록 조각으로 나눕니다. Area2D나 물리 바디의 자식이어야 합니다. Unity의 PolygonCollider2D는 로컬 공간의 점을 받고, 스프라이트의 Custom Physics Shape로 자체 윤곽을 만들 수도 있습니다. 두 엔진 모두 먼저 프레임의 피벗을 빼고, Unity라면 y를 뒤집고 Pixels Per Unit으로 나눕니다.'],
    terms:[['알파 임계값','투명으로 치는 가장 높은 알파 값. 127이면 절반 이상 불투명한 픽셀이 남음.'],['꼭짓점 상한','단순화 후 폴리곤이 가질 수 있는 최대 점 수.'],['허용 오차','단순화가 윤곽을 옮겨도 되는 거리(픽셀).']]},
   example:{title:'예시: 32 × 48 캐릭터 프레임 하나, 설정 세 가지',lead:'머리, 몸, 4px 틈을 둔 두 다리, 머리 둘레의 옅은 빛(알파 60). Nerulio 윤곽 추적기로 계산한 값:',lines:[
    '따낸 윤곽(알파 > 127)                  꼭짓점 48개, 면적 544px²',
    '상한 64   오차 1px       꼭짓점 16개, 면적 540px²(−0.7%), 최대 편차 1.0px, 다리 사이 유지',
    '상한 12   오차 3.8px     꼭짓점 5개, 면적 428px²(−21%), 최대 편차 3.8px, 다리 사이 틈 사라짐',
    '임계값 40, 상한 12      빛까지 포함: 면적 628px², 오차 2.0px에서 꼭짓점 12개',
    '',
    'Godot, 피벗 (16, 48)    폴리곤 점 (22, 48) → 노드 공간 (22 − 16, 48 − 48) = (6, 0)'],
    after:'여기서는 상한 12가 꼭짓점 12개를 주지 않았습니다. 다음 오차 단계에서 이미 5개로 줄었기 때문입니다. 모양이 중요하면 상한을 올리고, 알파로 자동 생성 뒤 Studio가 알려 주는 꼭짓점 수를 비교하세요.'},
   mapping:{title:'폴리곤이 가는 곳',head:['대상','내보내기에 든 폴리곤','엔진에서 만들 것'],rows:[
    ['Godot 4','`metadata/nerulio`의 프레임별 `collision`, 폴리곤마다 x0, y0, x1, y1 … 평탄한 목록','Area2D나 바디 아래 CollisionPolygon2D. 스크립트로 프레임마다 목록에서 피벗을 뺀 값을 `polygon`에 설정'],
    ['일반 JSON','`frames[key].collision`: 폴리곤마다 [[x, y], …]','점 목록을 받는 어느 엔진이든'],
    ['Unity 6','없음. 내보내기 안내가 일반 JSON을 가리킴','일반 JSON의 점으로 PolygonCollider2D, 또는 Unity 자체 Custom Physics Shape'],
    ['Aseprite, Phaser, PixiJS, LÖVE, Spine, Starling, Defold, GameMaker, CSS','없음','아틀라스 옆에 일반 JSON을 함께 불러오기']]},
   verify:{steps:[
    '알파로 자동 생성하면 알림에 만든 프레임 수와 꼭짓점 수가 나옵니다. 태그를 넘기며 프레임마다 윤곽을 봅니다.',
    '빛이나 연기가 있는 프레임에서 임계값을 127과 낮은 값 사이로 바꿔 윤곽을 비교합니다.',
    'Godot에서 Area2D 아래에 변환한 점으로 CollisionPolygon2D를 추가하고, Debug › Visible Collision Shapes를 켜서 스프라이트 위에 겹쳐 봅니다.']},
   trouble:{rows:[
    ['폴리곤이 다리 사이 같은 틈을 메움','꼭짓점 상한 때문에 틈보다 큰 오차가 쓰임','자동 생성 후 꼭짓점 수가 상한보다 훨씬 적거나, 윤곽이 틈을 건너감','상한을 올리고(예: 24) 다시 자동 생성'],
    ['빛이나 연기가 충돌 도형 안에 들어감','그 픽셀의 알파가 임계값보다 높음','임계값을 낮췄다 올리며 비교','임계값을 올려 옅은 픽셀을 투명으로 취급'],
    ['엔진에서 도형이 어긋남','점은 피벗이 아니라 프레임 캔버스 왼쪽 위 기준 픽셀','예시와 점 하나를 비교','피벗을 빼기. Unity라면 y를 뒤집고 Pixels Per Unit으로도 나누기'],
    ['일부 부분에만 폴리곤이 생김','프레임마다 떨어진 도형은 8개까지만 남고, 4px² 미만 조각은 버림','자동 생성 메시지에 버린 조각이나 초과 도형이 나옴','그림에서 부분을 잇거나, 빠진 폴리곤을 직접 그리기']]},
   alternatives:{rows:[
    ['Unity Sprite Editor의 Custom Physics Shape','Unity 전용. Unity가 윤곽을 만들고 편집하며, Polygon Collider 2D가 스프라이트의 새 인스턴스에 그 윤곽을 씁니다.'],
    ['프레임마다 박스나 원 하나','대부분의 플랫포머 몸체. 복잡한 폴리곤보다 가볍고 안정적입니다. [[game/hitbox-editor|히트박스 편집기]]로 그리거나, 기존 스프라이트 랩의 볼록 껍질·사각형·원 옵션을 쓰세요.']]},
   limits:['폴리곤은 내보내기에 데이터로만 들어갑니다. CollisionPolygon2D 노드나 Unity 콜라이더는 만들지 않습니다.','충돌 폴리곤은 Unity, Aseprite, 아틀라스 형식으로 가지 않습니다. 일반 JSON을 쓰세요.','도형 안의 구멍은 Studio 폴리곤에 포함되지 않습니다.'],
   versions:{body:['윤곽 추적과 예시의 숫자는 Nerulio 자체 모듈(src/game/contour.js)에서 나왔습니다. 메타데이터가 든 Godot 번들은 Godot 4.7.2가 불러왔지만, 그 실행에서 충돌 폴리곤을 물리 도형으로 쓰지는 않았습니다. 엔진 동작은 Godot 4.7과 Unity 6 문서를 따릅니다.'],sources:[S.godotPoly,S.godotArea,S.unityPoints,S.unityPhys]}
  },
  ja:{
   answer:'スプライトのアルファからなぞった衝突ポリゴンは、ボックスよりもシルエットに沿います。Nerulioはフレームごとに、アルファのしきい値（既定127、つまり半分以上不透明なピクセルが対象）でピクセルの境界に沿って輪郭をなぞり、輪郭が自己交差しないようにしながら頂点数の上限（既定12、3〜64）に収まるまで単純化し、フレームごとに最大8個のポリゴンをフレームキャンバスのピクセルで保存します。ポリゴンはGodotバンドルのメタデータと汎用JSONに書き出され、CollisionPolygon2DノードやUnityのコライダーは作りません。',
   concept:{title:'なぞる、単純化する、エンジンに点を渡す',body:[
    '輪郭はピクセルの中心ではなく、不透明と透明のピクセルの境目をたどるので、どの頂点も整数ピクセルの角に乗ります。16 × 16の不透明な正方形は、ちょうど (0, 0)、(16, 0)、(16, 16)、(0, 16) になります。外側の輪郭は画面上で時計回り（yは下向き）になり、4px²未満の粒は捨てます。',
    '単純化（Ramer–Douglas–Peucker）は直線に近い点を取り除きます。許容誤差は1pxから始まり、頂点数が上限以下になるまで引き上げられ、輪郭を自己交差させる誤差は採用しません。自己交差した輪郭は物理形状として使えないからです。誤差は段階的に上がるので、上限より少ない頂点数で止まることがあり、上限が低いと両脚のあいだのようなすき間がつぶれます。',
    'エンジンはこうしたポリゴンを、オブジェクト基準の点のリストとして受け取ります。GodotのCollisionPolygon2Dは凹ポリゴンも受け付け、既定のソリッドモードでは自分で凸の部品に分けます。Area2Dか物理ボディの子である必要があります。UnityのPolygonCollider2Dはローカル空間の点を受け取り、スプライトのCustom Physics Shapeから独自の輪郭を作ることもできます。どちらもまずフレームのピボットを引き、Unityではさらにyを反転してPixels Per Unitで割ります。'],
    terms:[['アルファしきい値','透明とみなす最大のアルファ値。127なら半分以上不透明なピクセルが残る。'],['頂点数の上限','単純化後のポリゴンが持てる点の最大数。'],['許容誤差','単純化で輪郭を動かしてよい距離（ピクセル）。']]},
   example:{title:'例：32 × 48のキャラクター1フレーム、3つの設定',lead:'頭・胴・4pxのすき間をあけた両脚と、頭のまわりの淡い光（アルファ60）。Nerulioの輪郭追跡で計算した値：',lines:[
    'なぞった輪郭（アルファ > 127）          頂点48、面積544px²',
    '上限64   誤差1px      頂点16、面積540px²（−0.7%）、最大偏差1.0px、両脚は分かれたまま',
    '上限12   誤差3.8px    頂点5、面積428px²（−21%）、最大偏差3.8px、脚のすき間が消える',
    'しきい値40、上限12   光も含む：面積628px²、誤差2.0pxで頂点12',
    '',
    'Godot、ピボット (16, 48)  ポリゴンの点 (22, 48) → ノード空間 (22 − 16, 48 − 48) = (6, 0)'],
    after:'この例では上限12でも頂点は12になりませんでした。次の誤差の段階で一気に5まで減ったからです。形が大事なら上限を上げ、アルファから自動生成したあとにStudioが示す頂点数を比べてください。'},
   mapping:{title:'ポリゴンの行き先',head:['書き出し先','書き出しに入るポリゴン','エンジンで作るもの'],rows:[
    ['Godot 4','`metadata/nerulio` のフレームごとの `collision`。ポリゴンごとに x0, y0, x1, y1 … の平らなリスト','Area2Dかボディの下のCollisionPolygon2D。スクリプトでフレームごとに、リストからピボットを引いた値を `polygon` に設定'],
    ['汎用JSON','`frames[key].collision`：ポリゴンごとに [[x, y], …]','点のリストを受け取るどのエンジンでも'],
    ['Unity 6','なし。書き出しの注記が汎用JSONを案内する','汎用JSONの点でPolygonCollider2D、またはUnity独自のCustom Physics Shape'],
    ['Aseprite、Phaser、PixiJS、LÖVE、Spine、Starling、Defold、GameMaker、CSS','なし','アトラスの隣に汎用JSONも読み込む']]},
   verify:{steps:[
    'アルファから自動生成すると、通知に作ったフレーム数と頂点数が出ます。タグをコマ送りしてフレームごとの輪郭を見ます。',
    '光や煙のあるフレームで、しきい値を127と低い値のあいだで切り替えて輪郭を比べます。',
    'GodotでArea2Dの下に変換した点でCollisionPolygon2Dを追加し、Debug › Visible Collision Shapesをオンにしてスプライトに重ねて確認します。']},
   trouble:{rows:[
    ['ポリゴンが両脚のあいだなどのすき間を埋める','頂点数の上限のせいで、すき間より大きな誤差が使われた','自動生成後の頂点数が上限よりかなり少ない、または輪郭がすき間をまたぐ','上限を上げて（例：24）自動生成し直す'],
    ['光や煙が衝突形状に入る','そのピクセルのアルファがしきい値より高い','しきい値を上げ下げして比べる','しきい値を上げて、淡いピクセルを透明扱いにする'],
    ['エンジンで形状がずれる','点はピボットではなくフレームキャンバスの左上を基準にしたピクセル','例と点を1つ比べる','ピボットを引く。Unityではさらにyを反転しPixels Per Unitで割る'],
    ['一部の部位にしかポリゴンがない','離れた形状はフレームごとに8個まで、4px²未満の粒は捨てる','自動生成のメッセージに捨てた粒や超過した形状が出る','絵の上で部位をつなぐか、足りないポリゴンを手で描く']]},
   alternatives:{rows:[
    ['UnityのSprite EditorのCustom Physics Shape','Unity専用。Unityが輪郭を作って編集し、Polygon Collider 2Dがスプライトの新しいインスタンスでそれを使います。'],
    ['フレームごとにボックスか円を1つ','多くのプラットフォーマーの体。細かいポリゴンより軽く安定します。[[game/hitbox-editor|ヒットボックスエディター]]で描くか、従来のスプライトラボの凸包・矩形・円の選択肢を使ってください。']]},
   limits:['ポリゴンは書き出しにデータとして入るだけで、CollisionPolygon2DノードやUnityのコライダーは作りません。','衝突ポリゴンはUnity、Aseprite、アトラス形式には入りません。汎用JSONを使ってください。','形状の中の穴はStudioのポリゴンに含まれません。'],
   versions:{body:['輪郭の追跡と例の数値はNerulio自身のモジュール（src/game/contour.js）によるものです。メタデータ入りのGodotバンドルはGodot 4.7.2で読み込みましたが、その実行で衝突ポリゴンを物理形状として使ったわけではありません。エンジンの動作はGodot 4.7とUnity 6のドキュメントに従います。'],sources:[S.godotPoly,S.godotArea,S.unityPoints,S.unityPhys]}
  }
 }
};
