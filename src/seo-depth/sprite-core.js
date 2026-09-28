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
 }
};
