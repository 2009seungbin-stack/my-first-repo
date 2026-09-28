/** Intent content for the ui pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: docs/UI-LAB.md, docs/TILE-LAB.md, src/game/nine-slice.js, src/game/ui-states.js,
 * src/game/bmfont.js, src/game/sdf.js, src/game/contrast.js, src/game/ui-layout.js, src/game/seams.js,
 * src/game/tile-grid.js, src/atlas.js, src/primitives.js, src/task/ui-lab.js, src/task/tile-lab.js.
 * Every worked number below was recomputed with those modules. Engine behaviour: the official docs
 * cited in each page's `versions.sources` (fetched 2026-09-28). */
const S={
 ninePatch:'[Godot 4.7: NinePatchRect](https://docs.godotengine.org/en/stable/classes/class_ninepatchrect.html)',
 styleBox:'[Godot 4.7: StyleBoxTexture](https://docs.godotengine.org/en/stable/classes/class_styleboxtexture.html)',
 atlasTexture:'[Godot 4.7: AtlasTexture](https://docs.godotengine.org/en/stable/classes/class_atlastexture.html)',
 textureButton:'[Godot 4.7: TextureButton](https://docs.godotengine.org/en/stable/classes/class_texturebutton.html)',
 button:'[Godot 4.7: Button theme properties](https://docs.godotengine.org/en/stable/classes/class_button.html)',
 fonts:'[Godot 4.7: Using fonts, Bitmap fonts](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html)',
 bmImporter:'[Godot 4.7: ResourceImporterBMFont](https://docs.godotengine.org/en/stable/classes/class_resourceimporterbmfont.html)',
 resolutions:'[Godot 4.7: Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)',
 displayServer:'[Godot 4.7: DisplayServer](https://docs.godotengine.org/en/stable/classes/class_displayserver.html)',
 atlasSource:'[Godot 4.7: TileSetAtlasSource](https://docs.godotengine.org/en/stable/classes/class_tilesetatlassource.html)',
 unitySlice:'[Unity 6.3 Manual: Set up your sprite for 9-slicing](https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/9-slice/set-sprite-9slicing.html)',
 unitySliceDraw:'[Unity 6.2 Manual: 9-slice your sprite](https://docs.unity3d.com/6000.2/Documentation/Manual/sprite/9-slice/9-slice-sprite.html)',
 unityBorder:'[Unity Scripting API: Sprite.border](https://docs.unity3d.com/ScriptReference/Sprite-border.html)',
 unityImage:'[Unity UI 2.0: Visual components (Image Type)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/UIVisualComponents.html)',
 unityTransition:'[Unity UI 2.0: Transition options](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/script-SelectableTransition.html)',
 unitySafe:'[Unity Scripting API: Screen.safeArea](https://docs.unity3d.com/ScriptReference/Screen-safeArea.html)',
 unityGrid:'[Unity 6.2 Manual: Sprite Editor slicing](https://docs.unity3d.com/6000.2/Documentation/Manual/sprite/sprite-editor/automatic-slicing.html)',
 phaserNine:'[Phaser API: NineSlice](https://docs.phaser.io/api-documentation/class/gameobjects-nineslice)',
 phaserLoader:'[Phaser API: LoaderPlugin.bitmapFont](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)',
 phaserTilemap:'[Phaser API: Tilemap.addTilesetImage](https://docs.phaser.io/api-documentation/class/tilemaps-tilemap)',
 pixiBitmap:'[PixiJS 8 guide: BitmapText](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)',
 bmfont:'[AngelCode BMFont: file format](https://www.angelcode.com/products/bmfont/doc/file_format.html)',
 gettext:'[GNU gettext manual: PO files](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html)',
 wcag:'[W3C WCAG 2.2 (contrast ratio, relative luminance, 1.4.3, 1.4.11, 2.4.13)](https://www.w3.org/TR/WCAG22/)',
 ebu:'[EBU R 95 v1.1: Safe areas for 16:9 television production](https://tech.ebu.ch/docs/r/r095.pdf)',
 tiled:'[Tiled manual: Editing tilesets](https://doc.mapeditor.org/en/stable/manual/editing-tilesets/)',
 tpSettings:'[TexturePacker documentation: texture settings (padding, extrude)](https://www.codeandweb.com/texturepacker/documentation/texture-settings)'
};
const CONTENT={
 'game/ui-lab':{
  type:'create',
  intent:{primary:'turn a game UI sheet into named elements and a padded UI atlas',secondary:['detect buttons, panels and icons on one transparent PNG','padding and extrude for a UI atlas','keep nine-slice borders per element'],
   goal:'ui-atlas.png plus ui-atlas.json whose rects and borders can be entered in an engine',input:'one transparent PNG UI sheet (buttons, panels, icons)',output:'ui-atlas.png + ui-atlas.json (+ SETUP.md when an element has nine-slice borders)',target:'generic (rects and borders for Godot 4 / Unity)',support:'partial',
   evidence:['docs/UI-LAB.md §3 and verification rows 10–12, 27','src/task/ui-lab.js detectElements/packAtlas/exportAtlas','src/game/ui-layout.js mergeRects','src/primitives.js components','src/game/exporters/ui-envelope.js'],
   external:['Godot 4.7 AtlasTexture region','TexturePacker padding/extrude definitions']},
  en:{
   answer:'A UI sheet (buttons, panels and icons drawn on one transparent PNG) has to become separate, named rectangles before an engine can draw any of it. The UI Lab finds every element as an island of pixels above an alpha threshold, joins islands closer than the merge distance (a button and the badge beside it), packs the elements into `ui-atlas.png` with padding and optional extrude, and writes each rect and any nine-slice border to `ui-atlas.json`. It writes numbers, not Godot or Unity resource files; the 9-Slice, States, Font and Check stages work on the same image.',
   concept:{title:'From a UI sheet to atlas rectangles',body:[
    'An element is found the way you would outline it by hand. Pixels whose alpha is above the threshold (default 8 of 255) are grouped with their eight neighbours into islands, and islands smaller than the minimum size (default 16 pixels) are dropped as specks of dust.',
    'Islands are candidates, not meaning. An icon with a separate dot next to it is two islands; the merge distance (default 4 px) unions any two boxes whose gap is at most that many pixels and repeats until nothing merges, so a chain of nearby pieces becomes one element tagged `merged`. Two buttons that touch are a single island and stay one element whatever the merge distance.',
    'Packing places the elements on one page of at most 4096 × 4096 px with MaxRects and leaves the padding (default 2 px) free around them. Extrude repeats each element\'s outermost pixels outward by N px, so a filtered or mipmapped sample that lands just outside the element still reads the element\'s own colour. The rect in the JSON is the element itself; the extruded ring lies outside it.'],
    terms:[['Alpha island','A group of 8-connected pixels above the alpha threshold.'],['Merge distance','The largest gap, in pixels, at which two boxes become one element.'],['Padding','Empty pixels left between packed elements.'],['Extrude','Copies of an element\'s edge pixels placed around it, outside its rect.']]},
   example:{title:'Example: one 256 × 128 sheet, measured',lead:'Five shapes on a transparent sheet, run through the same detection, merge and packing code the Lab uses:',lines:[
    'sheet 256 × 128   alpha threshold 8   minimum 16 px   merge distance 4',
    'islands  panel 64×64 @8,8   button 96×32 @96,8   icon 16×16 @200,12   dot 4×4 @218,12   arrow 20×20 @96,64',
    'gap icon → dot = 218 − (200 + 16) = 2 px ≤ 4   → one element 22×16 @200,12, tag "merged"',
    'result   5 islands → 4 elements  (merge distance 0 would keep 5)',
    'pack     padding 2, extrude 1   → ui-atlas.png 102 × 108',
    'rects    element-02 3,3 96×32   element-01 3,41 64×64   element-03 73,41 22×16   element-04 73,63 20×20'],
    after:'Elements are numbered top to bottom, then left to right, before packing: element-01 is the panel, element-03 the merged icon. Rename them before export, because the names become the keys under `frames` in the JSON.'},
   verify:{steps:[
    'Open `ui-atlas.json`: `frames` has one entry per element you kept, and every `rect` lies inside `meta.size`.',
    'Crop one `rect` out of `ui-atlas.png` in any image editor and compare it with the same element on the source sheet; they are the same pixels.',
    'Look for `"tag": "merged"`: each one should be a piece you meant to join, not two buttons that happen to sit close together.',
    'If you gave an element nine-slice borders, `SETUP.md` has a section with its name and the four numbers.']},
   trouble:{rows:[
    ['Two buttons came out as one element','They touch, or the gap between them is not larger than the merge distance','The element\'s box covers both buttons; the tag says `merged` when it came from more than one island','Set the merge distance to 0; if they touch, leave at least one transparent pixel between them in the art'],
    ['A label, glow or shadow became its own element','Its pixels are separated from the button by more than the merge distance, or they are fainter than the alpha threshold','Count the elements against what you expect; zoom into the gap','Raise the merge distance a few pixels; lower the alpha threshold if a soft shadow is being cut off'],
    ['Tiny specks appear as elements','Stray pixels form islands above the minimum size','Very small rects in the element list','Raise the minimum pixels, or erase the dust in the art'],
    ['Thin lines of a neighbour appear at an element\'s edge in the engine','The engine filters or mipmaps across the rect border and padding 0 lets it read the neighbour','Zoom in on the edge in the running game','Use padding 2 and extrude 1–2, or Nearest filtering for pixel art'],
    ['The atlas fails to pack','The elements do not fit on one 4096 × 4096 page','The summary shows the error instead of a size','Split the sheet and build two atlases; there is no multi-page UI atlas']]},
   alternatives:{rows:[
    ['A packer for separate PNG files ([[sprite-sheet-maker|sprite sheet packer]], TexturePacker)','Each element already exists as its own file: no detection is needed, and a packer writes engine-specific atlas formats. See [[game/texture-packer-free|packing without TexturePacker]].'],
    ['Unity\'s Sprite Editor slicing','The sheet is only used in Unity and you want the rects stored in Unity\'s own import settings.'],
    ['Godot `AtlasTexture` resources set by hand','Two or three elements: point `atlas` at the sheet and type each `region`; no extra file at all.']]},
   limits:['One atlas page, at most 4096 × 4096, and no rotated packing.','No engine resource files: Godot `.tres` or Unity `.meta` are not written, only rects and border numbers.'],
   versions:{body:['Measured in Chromium (Playwright) on Windows 11 for docs/UI-LAB.md: a 128 × 64 sheet with one button and a transparent hole gave 4 elements that merge distance 40 joins into one; packed pixels equal their source rects and extrude 1 duplicates the edge pixel outside the rect; borders 5/5/4/4 set on an element reach `ui-atlas.json`; a 1024 × 1024 sheet with 40 elements was detected, merged, packed and drawn in 76 ms. Loading the atlas in Godot or Unity was not run. Engine names above follow the Godot 4.7 documentation.'],sources:[S.atlasTexture,S.tpSettings]}
  },
  ko:{
   answer:'UI 시트(버튼·패널·아이콘을 투명 PNG 한 장에 그린 것)는 엔진이 그리기 전에 이름 붙은 사각형들로 나뉘어야 합니다. UI 랩은 알파 임계값을 넘는 픽셀 덩어리(섬)를 요소로 찾고, 합치기 거리보다 가까운 섬(버튼과 옆의 배지)을 하나로 묶은 뒤, 여백과 선택형 가장자리 확장을 넣어 `ui-atlas.png`에 패킹하고 각 영역과 나인 슬라이스 테두리를 `ui-atlas.json`에 씁니다. Godot·Unity 리소스 파일이 아니라 숫자를 쓰며, 9슬라이스·상태·폰트·점검 단계가 같은 이미지를 이어서 씁니다.',
   concept:{title:'UI 시트에서 아틀라스 사각형까지',body:[
    '요소는 손으로 윤곽을 그리듯 찾습니다. 알파가 임계값(기본 255 중 8)보다 큰 픽셀을 여덟 방향 이웃과 묶어 섬을 만들고, 최소 크기(기본 16픽셀)보다 작은 섬은 먼지로 보고 버립니다.',
    '섬은 후보일 뿐 의미를 알지는 못합니다. 아이콘 옆에 떨어진 점이 있으면 섬이 둘입니다. 합치기 거리(기본 4px)는 틈이 그 이하인 두 상자를 합치고 더 합칠 것이 없을 때까지 반복하므로, 가까이 붙은 조각들이 `merged` 태그가 붙은 한 요소가 됩니다. 서로 닿아 있는 버튼 두 개는 처음부터 한 섬이라 합치기 거리와 상관없이 한 요소로 남습니다.',
    '패킹은 MaxRects로 요소를 최대 4096 × 4096px 한 페이지에 놓고 주변에 여백(기본 2px)을 비워 둡니다. 가장자리 확장은 요소의 맨 바깥 픽셀을 N px만큼 바깥으로 복제해서, 필터링이나 밉맵이 요소 바로 바깥을 샘플링해도 요소 자신의 색을 읽게 합니다. JSON의 영역은 요소 자체이고 확장된 테두리는 그 바깥에 있습니다.'],
    terms:[['알파 섬','알파 임계값을 넘는, 8방향으로 이어진 픽셀 묶음.'],['합치기 거리','두 상자를 한 요소로 합치는 최대 틈(픽셀).'],['여백(padding)','패킹된 요소 사이에 비워 두는 픽셀.'],['가장자리 확장(extrude)','요소 영역 바깥에 둘러 놓는 가장자리 픽셀의 복사본.']]},
   example:{title:'예시: 256 × 128 시트 하나를 실제로 측정',lead:'투명 시트 위 도형 다섯 개를 랩과 같은 감지·합치기·패킹 코드로 처리한 결과입니다.',lines:[
    '시트 256 × 128   알파 임계값 8   최소 16px   합치기 거리 4',
    '섬      패널 64×64 @8,8   버튼 96×32 @96,8   아이콘 16×16 @200,12   점 4×4 @218,12   화살표 20×20 @96,64',
    '아이콘 → 점 틈 = 218 − (200 + 16) = 2px ≤ 4   → 요소 하나 22×16 @200,12, 태그 "merged"',
    '결과    섬 5개 → 요소 4개  (합치기 거리 0이면 5개 유지)',
    '패킹    여백 2, 확장 1   → ui-atlas.png 102 × 108',
    '영역    element-02 3,3 96×32   element-01 3,41 64×64   element-03 73,41 22×16   element-04 73,63 20×20'],
    after:'요소 번호는 패킹 전에 위에서 아래, 왼쪽에서 오른쪽 순으로 붙습니다. element-01이 패널, element-03이 합쳐진 아이콘입니다. 이름이 JSON `frames`의 키가 되므로 내보내기 전에 바꿔 두세요.'},
   verify:{steps:[
    '`ui-atlas.json`을 엽니다. `frames`에 남긴 요소마다 항목이 하나씩 있고, 모든 `rect`가 `meta.size` 안에 있어야 합니다.',
    '아무 이미지 편집기에서 `ui-atlas.png`의 `rect` 하나를 잘라 원본 시트의 같은 요소와 비교합니다. 같은 픽셀이어야 합니다.',
    '`"tag": "merged"`를 찾아보세요. 모두 일부러 합친 조각이어야 하며, 우연히 가까이 놓인 버튼 두 개면 안 됩니다.',
    '요소에 나인 슬라이스 테두리를 줬다면 `SETUP.md`에 그 이름의 절과 숫자 네 개가 있습니다.']},
   trouble:{rows:[
    ['버튼 두 개가 한 요소로 나옴','서로 닿아 있거나 틈이 합치기 거리 이하임','요소 상자가 두 버튼을 모두 덮고, 섬이 여럿이면 태그가 `merged`','합치기 거리를 0으로. 닿아 있다면 그림에서 투명 픽셀을 한 줄 이상 띄우기'],
    ['글자·빛·그림자가 따로 요소가 됨','버튼과의 거리가 합치기 거리보다 멀거나, 픽셀이 알파 임계값보다 흐림','예상한 요소 개수와 비교하고 틈을 확대해 보기','합치기 거리를 몇 픽셀 올리고, 부드러운 그림자가 잘리면 알파 임계값을 낮추기'],
    ['작은 점들이 요소로 잡힘','흩어진 픽셀이 최소 크기를 넘는 섬을 만듦','요소 목록에 아주 작은 영역이 있음','최소 픽셀 수를 올리거나 그림에서 먼지를 지우기'],
    ['엔진에서 요소 가장자리에 이웃 요소의 선이 보임','엔진이 영역 경계를 넘어 필터링·밉맵하는데 여백이 0이라 이웃을 읽음','실행 화면에서 가장자리를 확대','여백 2와 확장 1~2를 쓰거나, 픽셀 아트라면 Nearest 필터'],
    ['아틀라스 패킹이 실패함','요소들이 4096 × 4096 한 페이지에 들어가지 않음','요약에 크기 대신 오류가 표시됨','시트를 나눠 아틀라스를 두 개 만들기. 여러 페이지 UI 아틀라스는 없음']]},
   alternatives:{rows:[
    ['낱장 PNG용 패커([[sprite-sheet-maker|스프라이트 시트 패커]], TexturePacker)','요소가 이미 파일로 하나씩 있을 때. 감지가 필요 없고 엔진별 아틀라스 형식을 씁니다. [[game/texture-packer-free|TexturePacker 없이 패킹하기]]도 참고.'],
    ['Unity Sprite Editor의 슬라이스','시트를 Unity에서만 쓰고 영역을 Unity 가져오기 설정에 저장하고 싶을 때.'],
    ['Godot `AtlasTexture`를 직접 만들기','요소가 두세 개뿐일 때. `atlas`에 시트를 지정하고 `region`을 입력하면 추가 파일이 전혀 없습니다.']]},
   limits:['아틀라스는 한 페이지, 최대 4096 × 4096이며 회전 패킹은 없습니다.','엔진 리소스 파일(Godot `.tres`, Unity `.meta`)은 쓰지 않고 영역과 테두리 숫자만 씁니다.'],
   versions:{body:['docs/UI-LAB.md를 위해 Windows 11의 Chromium(Playwright)에서 측정했습니다. 버튼 하나와 투명한 구멍이 있는 128 × 64 시트에서 요소 4개가 나오고 합치기 거리 40에서 하나로 합쳐졌습니다. 패킹된 픽셀은 원본 영역과 같고, 확장 1은 가장자리 픽셀을 영역 바깥에 복제합니다. 요소에 준 테두리 5/5/4/4가 `ui-atlas.json`에 들어갑니다. 요소 40개가 있는 1024 × 1024 시트는 감지·합치기·패킹·그리기가 76ms에 끝났습니다. Godot·Unity에서 아틀라스를 불러오지는 않았습니다. 위의 엔진 이름은 Godot 4.7 공식 문서를 따릅니다.'],sources:[S.atlasTexture,S.tpSettings]}
  },
  ja:{
   answer:'UIシート（ボタン・パネル・アイコンを1枚の透明PNGに描いたもの）は、エンジンが描画する前に名前つきの矩形に分ける必要があります。UIラボはアルファのしきい値を超えるピクセルのかたまり（島）を要素として見つけ、統合距離より近い島（ボタンと横のバッジ）をまとめ、余白と任意の縁の拡張を入れて`ui-atlas.png`にパックし、各矩形とナインスライスの境界を`ui-atlas.json`に書き出します。書くのは数値で、GodotやUnityのリソースファイルではありません。9スライス・状態・フォント・チェックの各ステージは同じ画像で続けて使えます。',
   concept:{title:'UIシートからアトラスの矩形へ',body:[
    '要素は手で輪郭をなぞるのと同じ考え方で見つけます。アルファがしきい値（既定は255中8）を超えるピクセルを8方向の隣とつないで島にし、最小サイズ（既定16ピクセル）未満の島はゴミとして捨てます。',
    '島は候補にすぎず、意味はわかりません。アイコンの横に離れた点があれば島は2つです。統合距離（既定4px）は、すき間がその値以下の箱どうしを合わせ、合わせるものがなくなるまで繰り返すので、近くに並んだ部品は`merged`タグつきの1要素になります。接している2つのボタンは最初から1つの島なので、統合距離に関係なく1要素のままです。',
    'パックはMaxRectsで要素を最大4096 × 4096pxの1ページに置き、周りに余白（既定2px）を空けます。縁の拡張は要素のいちばん外側のピクセルをN px外へ複製し、フィルタリングやミップマップが要素のすぐ外をサンプリングしても要素自身の色を読むようにします。JSONの矩形は要素そのもので、拡張した縁はその外側にあります。'],
    terms:[['アルファの島','アルファのしきい値を超え、8方向につながったピクセルのまとまり。'],['統合距離','2つの箱を1要素にまとめる最大のすき間（ピクセル）。'],['余白（padding）','パックした要素の間に空けるピクセル。'],['縁の拡張（extrude）','要素の矩形の外側に並べる、縁のピクセルのコピー。']]},
   example:{title:'例：256 × 128のシート1枚を実測',lead:'透明なシート上の図形5つを、ラボと同じ検出・統合・パックのコードで処理した結果です。',lines:[
    'シート 256 × 128   アルファしきい値 8   最小 16px   統合距離 4',
    '島      パネル 64×64 @8,8   ボタン 96×32 @96,8   アイコン 16×16 @200,12   点 4×4 @218,12   矢印 20×20 @96,64',
    'アイコン → 点のすき間 = 218 − (200 + 16) = 2px ≤ 4   → 1要素 22×16 @200,12、タグ "merged"',
    '結果    島5つ → 要素4つ（統合距離0なら5つのまま）',
    'パック  余白 2、拡張 1   → ui-atlas.png 102 × 108',
    '矩形    element-02 3,3 96×32   element-01 3,41 64×64   element-03 73,41 22×16   element-04 73,63 20×20'],
    after:'要素の番号はパック前に上から下、左から右の順に付きます。element-01がパネル、element-03が統合されたアイコンです。名前はJSONの`frames`のキーになるので、書き出す前に変えておきましょう。'},
   verify:{steps:[
    '`ui-atlas.json`を開きます。`frames`には残した要素ごとに1項目あり、すべての`rect`が`meta.size`の内側にあるはずです。',
    '任意の画像エディターで`ui-atlas.png`から`rect`を1つ切り出し、元シートの同じ要素と比べます。同じピクセルのはずです。',
    '`"tag": "merged"`を探します。どれも意図してまとめた部品であるべきで、たまたま近くにあった2つのボタンであってはいけません。',
    '要素にナインスライスの境界を付けた場合、`SETUP.md`にその名前の節と4つの数値があります。']},
   trouble:{rows:[
    ['2つのボタンが1要素になる','接している、またはすき間が統合距離以下','要素の箱が両方のボタンを覆い、島が複数ならタグが`merged`','統合距離を0に。接しているなら絵の上で透明ピクセルを1列以上空ける'],
    ['文字・光・影が別の要素になる','ボタンとの距離が統合距離より遠い、またはピクセルがアルファのしきい値より薄い','期待する要素数と比べ、すき間を拡大して見る','統合距離を数px上げる。柔らかい影が切れるならアルファのしきい値を下げる'],
    ['小さな点が要素として拾われる','散らばったピクセルが最小サイズを超える島になっている','要素一覧にごく小さい矩形がある','最小ピクセル数を上げるか、絵のゴミを消す'],
    ['エンジンで要素の縁に隣の要素の線が出る','エンジンが矩形の境界をまたいでフィルタリング・ミップマップし、余白0のため隣を読んでいる','実行画面で縁を拡大する','余白2と拡張1〜2を使う。ピクセルアートならNearestフィルター'],
    ['アトラスのパックに失敗する','要素が4096 × 4096の1ページに収まらない','概要にサイズではなくエラーが出る','シートを分けてアトラスを2つ作る。複数ページのUIアトラスはない']]},
   alternatives:{rows:[
    ['個別PNG向けのパッカー（[[sprite-sheet-maker|スプライトシートパッカー]]、TexturePacker）','要素がすでに1ファイルずつあるとき。検出は不要で、エンジン別のアトラス形式を書き出せます。[[game/texture-packer-free|TexturePackerなしでパックする]]も参照。'],
    ['UnityのSprite Editorでのスライス','シートをUnityだけで使い、矩形をUnityのインポート設定に保存したいとき。'],
    ['Godotの`AtlasTexture`を手で作る','要素が2〜3個だけのとき。`atlas`にシートを指定して`region`を入力すれば、追加ファイルは一切不要です。']]},
   limits:['アトラスは1ページ、最大4096 × 4096で、回転してのパックはありません。','エンジンのリソースファイル（Godotの`.tres`、Unityの`.meta`）は書かず、矩形と境界の数値だけを書きます。'],
   versions:{body:['docs/UI-LAB.mdのためにWindows 11のChromium（Playwright）で測定しました。ボタン1つと透明な穴がある128 × 64のシートから要素が4つ見つかり、統合距離40で1つにまとまりました。パックしたピクセルは元の矩形と一致し、拡張1は縁のピクセルを矩形の外に複製します。要素に付けた境界5/5/4/4は`ui-atlas.json`に入ります。要素40個の1024 × 1024シートは検出・統合・パック・描画が76msで終わりました。GodotやUnityでアトラスを読み込んではいません。上のエンジン名はGodot 4.7の公式ドキュメントに基づきます。'],sources:[S.atlasTexture,S.tpSettings]}
  }
 },
 'game/9-slice-editor':{
  type:'engine',
  intent:{primary:'set nine-slice (9-patch) borders on a UI panel and use them in Godot, Unity or Phaser',secondary:['what stretches and what tiles','border values in pixels','Godot patch_margin, Unity Sprite Editor border, Phaser NineSlice'],
   goal:'a panel that resizes in the engine with unchanged corners, using borders measured once',input:'one panel or button PNG',output:'source PNG + previews/<w>x<h>.png + nine-slice.json + SETUP.md',target:'Godot 4 NinePatchRect / StyleBoxTexture, Unity Sprite Editor + Image Type Sliced, Phaser 3.60+ NineSlice (engine rendering not run)',support:'partial',
   evidence:['src/game/nine-slice.js (borders, suggestBorders, nineSlicePlan, engineBorders)','docs/UI-LAB.md §1 and verification rows 3–7, 29–30','src/task/ui-lab.js exportSlice/setupNotes'],
   external:['Godot 4.7 NinePatchRect + StyleBoxTexture','Unity 6 9-slicing manual + Sprite.border','Unity UI Image Type','Phaser NineSlice']},
  en:{
   answer:'A nine-slice (9-patch) border is four numbers in source pixels — left, right, top, bottom — that cut an image into a 3 × 3 grid. The four corners are always drawn at their own size, the top and bottom edges stretch or repeat horizontally, the left and right edges vertically, and the centre both ways. Set the borders once here (suggested from identical columns and rows), preview any size, then enter the same numbers in Godot 4 (`NinePatchRect.patch_margin_*`), Unity (Sprite Editor border, Image Type Sliced) or Phaser (`add.nineslice`). The download is PNG + `nine-slice.json` + `SETUP.md`; rendering inside the engines was not run.',
   concept:{title:'The nine regions and what each one does',body:[
    'For a W × H image with borders L, R, T and B the cuts give four corners (L × T, R × T, L × B, R × B), a top and a bottom edge (W − L − R wide), a left and a right edge (H − T − B tall) and the centre. When the panel is resized, corners are copied unscaled, horizontal edges change only their width, vertical edges only their height and the centre both. That is why a rounded or bevelled corner survives any size, and why the smallest size that shows every corner whole is (L + R) × (T + B).',
    'Stretch resamples an edge or the centre to the new length, which is right for flat colour or a gradient along the other axis. Tile repeats it at its natural size, which keeps a pattern (rivets, stitches, a brick edge) undistorted; Nerulio clips the last partial tile. Godot 4 also has Tile Fit, which stretches the tiles slightly so each one is shown whole; Nerulio\'s preview does not draw that mode.',
    'Every engine stores the same four numbers under different names and in a different order. Godot 4 uses `patch_margin_left/right/top/bottom` on a NinePatchRect (integers, in pixels) and `texture_margin_*` on a StyleBoxTexture. Unity\'s Sprite Editor has L, R, T and B fields, while the scripting value `Sprite.border` is a Vector4 in the order left, bottom, right, top. Phaser\'s NineSlice takes `leftWidth, rightWidth, topHeight, bottomHeight` after the size, and becomes a 3-slice when only the left and right widths are given.'],
    terms:[['Border (patch margin)','The distance in source pixels from one edge of the image to the cut line.'],['Stretch','An edge or the centre is scaled to fill the new length.'],['Tile','An edge or the centre is repeated at its original size.'],['Minimum size','(L + R) × (T + B): below it the corners cannot be drawn whole and are squashed.']]},
   example:{title:'Example: a 48 × 48 panel drawn at 300 × 80',lead:'Borders 12 px on every side. These are the rectangles the editor\'s draw plan produces, the same plan the exported previews use:',lines:[
    'source 48 × 48   borders L 12 · R 12 · T 12 · B 12   target 300 × 80   stretch',
    'corners     4 × (12×12 → 12×12)     copied 1:1, never resampled',
    'top/bottom  24×12 → 276×12          276 = 300 − 12 − 12   (×11.5 horizontally only)',
    'left/right  12×24 → 12×56           56 = 80 − 12 − 12     (×2.33 vertically only)',
    'centre      24×24 → 276×56',
    'tile mode   top edge = 11 tiles of 24 px + 1 clipped tile of 12 px   (11 × 24 + 12 = 276)',
    'too small   target 20 × 80: 20 < 12 + 12 → corners squashed to 10 + 10 (warning "narrow")',
    'asymmetric  L 10 · R 6 · T 8 · B 14   →  Unity Sprite.border (x, y, z, w) = (L, B, R, T) = (10, 14, 6, 8)',
    'Godot       patch_margin_left 12 · right 12 · top 12 · bottom 12',
    'Phaser      this.add.nineslice(x, y, "panel", null, 300, 80, 12, 12, 12, 12)'],
    after:'With an integer scale of 2 the corners are drawn at exactly 24 × 24 (each source pixel becomes 2 × 2), so a pixel-art frame stays crisp at double size.'},
   outputs:{rows:[
    ['panel.png','The source image, unchanged, named after your file.'],
    ['previews/100x40.png, 300x80.png, 800x200.png + custom size','The panel rendered at each preview size with your mode and scale (the custom size defaults to 420 × 120).'],
    ['nine-slice.json','The borders as `pixels`, `normalized` (border ÷ width or height), `godot4` (`patch_margin_*`) and `unity` (`border` in L, B, R, T order, named), plus mode, scale and the preview sizes.'],
    ['SETUP.md','Short Godot 4 and Unity steps with your numbers filled in, marked as not run inside the engines.']]},
   target:{title:'Enter the borders in Godot, Unity or Phaser',steps:[
    'Godot 4: add a `NinePatchRect`, set its Texture to the PNG and `patch_margin_left`, `patch_margin_right`, `patch_margin_top`, `patch_margin_bottom` to the four numbers from `nine-slice.json`.',
    'Godot 4, tile mode: set `axis_stretch_horizontal` and `axis_stretch_vertical` to Tile (or Tile Fit). For a Button or Panel theme, use a `StyleBoxTexture` with the same numbers in `texture_margin_*` and the same axis stretch settings.',
    'Unity: select the texture, set Mesh Type to Full Rect and click Apply, open the Sprite Editor and drag the green handles or type the L, R, T and B fields (the `pixels` values).',
    'Unity: on a Sprite Renderer set Draw Mode to Sliced (or Tiled, with Tile Mode Continuous or Adaptive); on a UI Image set Image Type to Sliced (or Tiled).',
    'Phaser 3.60 or later: `this.add.nineslice(x, y, key, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight)`. The Phaser 4.1 API lists `tileX` and `tileY` to repeat instead of stretch.',
    'For pixel art keep Nearest filtering and resize by whole numbers of source pixels, so the corners stay sharp.']},
   verify:{steps:[
    'Resize the engine node to 300 × 80 and compare it with `previews/300x80.png`: the four 12 × 12 corners should match pixel for pixel.',
    'Shrink it below L + R wide: Nerulio warns "narrow" for the same size, and Phaser documents L + R as the minimum width.',
    'In Unity, `Debug.Log(sprite.border)` should print the `unity.border` numbers from the JSON (left, bottom, right, top).']},
   trouble:{rows:[
    ['Corners stretch in Unity','Mesh Type is Tight, or the Image or Sprite Renderer still draws Simple','Texture import settings; Image Type or Draw Mode','Mesh Type Full Rect + Apply, then Image Type Sliced or Draw Mode Sliced'],
    ['Top and bottom borders look swapped in Unity','The Vector4 order (left, bottom, right, top) was typed into the L, R, T, B fields, or the other way round','Compare the Sprite Editor fields with `pixels` in the JSON','Type `pixels` into the Sprite Editor; use `unity.border` only for `Sprite.border` in scripts'],
    ['Corners look squashed at small sizes','The control is smaller than L + R or T + B','Nerulio shows the "narrow" or "short" warning for that size','Make the control larger or the borders smaller'],
    ['A patterned edge looks smeared','The edge is stretched, so a repeating pattern is resampled','Switch the preview to Tile and compare','Godot: axis stretch Tile or Tile Fit; Unity: Tiled; Phaser 4: `tileX` / `tileY`'],
    ['Pixel-art corners are blurry','Linear filtering, or a scale that is not a whole number','Zoom in: soft steps on the corner','Nearest filtering and integer scales (the editor\'s scale is 1–4)'],
    ['Phaser NineSlice from a TexturePacker atlas looks wrong','The frame was trimmed; the Phaser docs say NineSlice does not support trimmed TexturePacker textures','Check the atlas JSON for trimmed frames','Pack the panel untrimmed, or load it as its own image'],
    ['"Suggest borders" finds no clear run','The middle is a gradient or noise, so no columns or rows are identical','The suggestion says there is no repeating column or row','Place the guides by hand where the corner art ends']]},
   alternatives:{rows:[
    ['Set the borders directly in Godot\'s NinePatchRect inspector or Unity\'s Sprite Editor','One or two panels, already in the engine: you see the real engine rendering while you drag.'],
    ['[[game/ui-lab|The UI Lab atlas stage]]','Many panels on one sheet: each element gets its own borders and they all travel in one `ui-atlas.json`.']]},
   limits:['Rendering inside Godot, Unity or Phaser was not run: the numbers match their documentation, not an engine test.','No engine files are written (no `.tres`, `.meta` or Android `.9.png`).','Tile mode at an integer scale above 1 squashes the final partial tile by up to (scale − 1) ÷ scale of a source pixel.'],
   versions:{body:['Measured in Chromium for docs/UI-LAB.md: the 6 × 6 corner blocks of every exported preview are byte-identical to the source at 100 × 40, 300 × 80, 800 × 200 and 420 × 120; a plan has 0 gaps and 0 overlaps at 300 × 80, at scale 3 and when squashed to 8 × 4; a striped 12 × 12 panel tiles with its 4 px period; the suggestion finds 6 · 6 · 6 · 6 from runs of 12 identical columns and rows. In Firefox semi-transparent corner pixels can shift by one alpha-rounding step. Godot and Unity import is UNVERIFIED. Engine settings above follow Godot 4.7, Unity 6 and the Phaser API documentation.'],sources:[S.ninePatch,S.styleBox,S.unitySlice,S.unitySliceDraw,S.unityBorder,S.unityImage,S.phaserNine]}
  },
  ko:{
   answer:'나인 슬라이스(9패치) 테두리는 원본 픽셀 기준 숫자 네 개(왼쪽·오른쪽·위·아래)로, 이미지를 3 × 3 격자로 나눕니다. 네 모서리는 항상 원래 크기로 그려지고, 위·아래 변은 가로로만, 왼쪽·오른쪽 변은 세로로만 늘어나거나 반복되며, 가운데는 양쪽으로 변합니다. 여기서 테두리를 한 번 정하고(동일한 열·행에서 제안), 원하는 크기로 미리 본 뒤, 같은 숫자를 Godot 4(`NinePatchRect.patch_margin_*`), Unity(Sprite Editor 테두리, Image Type Sliced), Phaser(`add.nineslice`)에 넣으면 됩니다. 결과물은 PNG + `nine-slice.json` + `SETUP.md`이며 엔진 안에서의 렌더링은 실행해 보지 않았습니다.',
   concept:{title:'아홉 영역과 각 영역이 하는 일',body:[
    'W × H 이미지에 테두리 L·R·T·B를 주면 모서리 넷(L × T, R × T, L × B, R × B), 너비 W − L − R인 위·아래 변, 높이 H − T − B인 왼쪽·오른쪽 변, 그리고 가운데가 생깁니다. 패널 크기를 바꾸면 모서리는 그대로 복사되고, 가로 변은 너비만, 세로 변은 높이만, 가운데는 양쪽이 바뀝니다. 그래서 둥글거나 경사진 모서리가 어떤 크기에서도 유지되며, 모든 모서리를 온전히 보여 주는 최소 크기는 (L + R) × (T + B)입니다.',
    '늘이기(Stretch)는 변이나 가운데를 새 길이로 리샘플링하므로 단색이나 반대 축 방향 그라데이션에 맞습니다. 반복(Tile)은 원래 크기로 되풀이해 무늬(리벳, 바느질, 벽돌 테두리)가 일그러지지 않으며, Nerulio는 마지막 조각을 잘라 냅니다. Godot 4에는 조각이 모두 온전히 보이도록 살짝 늘이는 Tile Fit도 있지만 Nerulio 미리보기는 이 모드를 그리지 않습니다.',
    '엔진마다 같은 숫자 네 개를 다른 이름과 순서로 저장합니다. Godot 4는 NinePatchRect의 `patch_margin_left/right/top/bottom`(정수, 픽셀)과 StyleBoxTexture의 `texture_margin_*`를 씁니다. Unity Sprite Editor에는 L·R·T·B 칸이 있지만, 스크립트 값 `Sprite.border`는 왼쪽·아래·오른쪽·위 순서의 Vector4입니다. Phaser NineSlice는 크기 뒤에 `leftWidth, rightWidth, topHeight, bottomHeight`를 받고, 왼쪽·오른쪽 폭만 주면 3슬라이스가 됩니다.'],
    terms:[['테두리(patch margin)','이미지 한쪽 끝에서 자르는 선까지의 거리(원본 픽셀).'],['늘이기(Stretch)','변이나 가운데를 새 길이에 맞게 확대·축소.'],['반복(Tile)','변이나 가운데를 원래 크기로 되풀이.'],['최소 크기','(L + R) × (T + B). 이보다 작으면 모서리를 온전히 그릴 수 없어 찌그러집니다.']]},
   example:{title:'예시: 48 × 48 패널을 300 × 80으로',lead:'모든 변의 테두리가 12px입니다. 편집기의 그리기 계획이 만드는 사각형이며, 내보낸 미리보기도 같은 계획을 씁니다.',lines:[
    '원본 48 × 48   테두리 L 12 · R 12 · T 12 · B 12   목표 300 × 80   늘이기',
    '모서리      4 × (12×12 → 12×12)     1:1 복사, 리샘플링 없음',
    '위/아래     24×12 → 276×12          276 = 300 − 12 − 12   (가로로만 ×11.5)',
    '왼/오른     12×24 → 12×56           56 = 80 − 12 − 12     (세로로만 ×2.33)',
    '가운데      24×24 → 276×56',
    '반복 모드   위 변 = 24px 조각 11개 + 잘린 12px 조각 1개   (11 × 24 + 12 = 276)',
    '너무 작음   목표 20 × 80: 20 < 12 + 12 → 모서리가 10 + 10으로 찌그러짐 (경고 "narrow")',
    '비대칭      L 10 · R 6 · T 8 · B 14   →  Unity Sprite.border (x, y, z, w) = (L, B, R, T) = (10, 14, 6, 8)',
    'Godot       patch_margin_left 12 · right 12 · top 12 · bottom 12',
    'Phaser      this.add.nineslice(x, y, "panel", null, 300, 80, 12, 12, 12, 12)'],
    after:'정수 배율 2를 쓰면 모서리가 정확히 24 × 24로(원본 픽셀 하나가 2 × 2로) 그려져, 픽셀 아트 테두리가 두 배 크기에서도 선명합니다.'},
   outputs:{rows:[
    ['panel.png','원본 이미지. 바꾸지 않고 파일 이름을 따릅니다.'],
    ['previews/100x40.png, 300x80.png, 800x200.png + custom size','선택한 모드와 배율로 각 미리보기 크기에 그린 패널(사용자 크기 기본값 420 × 120).'],
    ['nine-slice.json','테두리를 `pixels`, `normalized`(테두리 ÷ 너비 또는 높이), `godot4`(`patch_margin_*`), `unity`(L·B·R·T 순서의 `border`, 순서 이름 포함)로 담고, 모드·배율·미리보기 크기도 기록.'],
    ['SETUP.md','숫자를 채운 Godot 4·Unity 설정 단계. 엔진 안에서 실행하지 않았다고 표시.']]},
   target:{title:'Godot·Unity·Phaser에 테두리 넣기',steps:[
    'Godot 4: `NinePatchRect`를 추가하고 Texture에 PNG를, `patch_margin_left`·`patch_margin_right`·`patch_margin_top`·`patch_margin_bottom`에 `nine-slice.json`의 숫자 네 개를 넣습니다.',
    'Godot 4 반복 모드: `axis_stretch_horizontal`과 `axis_stretch_vertical`을 Tile(또는 Tile Fit)로 둡니다. Button·Panel 테마라면 `StyleBoxTexture`의 `texture_margin_*`에 같은 숫자를, 축 늘이기도 같게 설정합니다.',
    'Unity: 텍스처를 선택해 Mesh Type을 Full Rect로 바꾸고 Apply한 뒤, Sprite Editor를 열어 초록 핸들을 끌거나 L·R·T·B 칸에 `pixels` 값을 입력합니다.',
    'Unity: Sprite Renderer라면 Draw Mode를 Sliced(또는 Tiled, Tile Mode는 Continuous나 Adaptive)로, UI Image라면 Image Type을 Sliced(또는 Tiled)로 둡니다.',
    'Phaser 3.60 이상: `this.add.nineslice(x, y, key, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight)`. Phaser 4.1 API에는 늘이지 않고 반복하는 `tileX`·`tileY`가 있습니다.',
    '픽셀 아트라면 Nearest 필터를 유지하고 원본 픽셀의 정수배로 크기를 바꿔 모서리를 선명하게 두세요.']},
   verify:{steps:[
    '엔진 노드를 300 × 80으로 바꾸고 `previews/300x80.png`와 비교합니다. 12 × 12 모서리 네 개가 픽셀 단위로 같아야 합니다.',
    'L + R보다 좁게 줄여 봅니다. 같은 크기에서 Nerulio는 "narrow" 경고를 내고, Phaser 문서도 L + R을 최소 너비로 적고 있습니다.',
    'Unity에서 `Debug.Log(sprite.border)`가 JSON의 `unity.border` 숫자(왼쪽·아래·오른쪽·위)를 출력해야 합니다.']},
   trouble:{rows:[
    ['Unity에서 모서리가 늘어남','Mesh Type이 Tight이거나 Image·Sprite Renderer가 아직 Simple로 그림','텍스처 가져오기 설정과 Image Type 또는 Draw Mode','Mesh Type을 Full Rect로 바꾸고 Apply한 뒤 Image Type Sliced나 Draw Mode Sliced로'],
    ['Unity에서 위·아래 테두리가 뒤바뀐 듯 보임','Vector4 순서(왼쪽·아래·오른쪽·위)를 L·R·T·B 칸에 넣었거나 그 반대','Sprite Editor 칸과 JSON의 `pixels` 비교','Sprite Editor에는 `pixels`를 입력하고, `unity.border`는 스크립트의 `Sprite.border`에만 사용'],
    ['작은 크기에서 모서리가 찌그러짐','컨트롤이 L + R 또는 T + B보다 작음','Nerulio가 그 크기에 "narrow"·"short" 경고 표시','컨트롤을 키우거나 테두리를 줄이기'],
    ['무늬가 있는 변이 번져 보임','변을 늘여서 반복 무늬가 리샘플링됨','미리보기를 반복으로 바꿔 비교','Godot은 축 늘이기 Tile·Tile Fit, Unity는 Tiled, Phaser 4는 `tileX`·`tileY`'],
    ['픽셀 아트 모서리가 흐림','Linear 필터이거나 배율이 정수가 아님','확대하면 모서리 계단이 부드러움','Nearest 필터와 정수 배율(편집기 배율은 1~4)'],
    ['TexturePacker 아틀라스의 Phaser NineSlice가 이상함','프레임이 트림됨. Phaser 문서는 NineSlice가 트림된 TexturePacker 텍스처를 지원하지 않는다고 적음','아틀라스 JSON에서 트림된 프레임 확인','패널을 트림 없이 패킹하거나 별도 이미지로 불러오기'],
    ['"테두리 제안"이 뚜렷한 구간을 못 찾음','가운데가 그라데이션이나 노이즈라 같은 열·행이 없음','제안에 반복되는 열·행이 없다고 나옴','모서리 그림이 끝나는 곳에 가이드를 직접 놓기']]},
   alternatives:{rows:[
    ['Godot NinePatchRect 인스펙터나 Unity Sprite Editor에서 직접 설정','패널이 한두 개이고 이미 엔진에서 작업할 때. 끌면서 실제 엔진 렌더링을 봅니다.'],
    ['[[game/ui-lab|UI 랩의 아틀라스 단계]]','한 시트에 패널이 많을 때. 요소마다 테두리를 주고 모두 `ui-atlas.json` 하나에 담깁니다.']]},
   limits:['Godot·Unity·Phaser 안에서 렌더링해 보지 않았습니다. 숫자는 엔진 문서와 맞춘 것이지 엔진 시험 결과가 아닙니다.','엔진 파일(`.tres`, `.meta`, Android `.9.png`)은 쓰지 않습니다.','1보다 큰 정수 배율의 반복 모드에서는 마지막 조각이 원본 픽셀의 (배율 − 1) ÷ 배율만큼 찌그러질 수 있습니다.'],
   versions:{body:['docs/UI-LAB.md를 위해 Chromium에서 측정했습니다. 내보낸 모든 미리보기의 6 × 6 모서리 블록이 100 × 40, 300 × 80, 800 × 200, 420 × 120에서 원본과 바이트 동일했고, 그리기 계획은 300 × 80, 배율 3, 8 × 4로 찌그러뜨린 경우 모두 빈틈·겹침 0이었습니다. 줄무늬 12 × 12 패널은 4px 주기로 반복되고, 제안은 동일한 열·행 12개 구간에서 6 · 6 · 6 · 6을 찾았습니다. Firefox에서는 반투명 모서리 픽셀이 알파 반올림 한 단계만큼 다를 수 있습니다. Godot·Unity 가져오기는 UNVERIFIED입니다. 위 엔진 설정은 Godot 4.7, Unity 6, Phaser API 공식 문서를 따릅니다.'],sources:[S.ninePatch,S.styleBox,S.unitySlice,S.unitySliceDraw,S.unityBorder,S.unityImage,S.phaserNine]}
  },
  ja:{
   answer:'ナインスライス（9パッチ）の境界は元画像のピクセル単位の4つの数値（左・右・上・下）で、画像を3 × 3のグリッドに分けます。四隅は常に元の大きさで描かれ、上下の辺は横方向だけ、左右の辺は縦方向だけ伸びるか繰り返され、中央は両方向に変わります。ここで境界を一度決め（同一の列・行から提案）、好きなサイズでプレビューし、同じ数値をGodot 4（`NinePatchRect.patch_margin_*`）、Unity（Sprite Editorの境界とImage Type Sliced）、Phaser（`add.nineslice`）に入れます。出力はPNG + `nine-slice.json` + `SETUP.md`で、エンジン内での描画は実行していません。',
   concept:{title:'9つの領域と、それぞれの役割',body:[
    'W × Hの画像に境界L・R・T・Bを付けると、四隅（L × T、R × T、L × B、R × B）、幅W − L − Rの上下の辺、高さH − T − Bの左右の辺、そして中央ができます。パネルのサイズを変えると、四隅はそのままコピーされ、横の辺は幅だけ、縦の辺は高さだけ、中央は両方が変わります。だから丸い角や面取りした角はどのサイズでも保たれ、四隅がすべて欠けずに見える最小サイズは(L + R) × (T + B)です。',
    '引き伸ばし（Stretch）は辺や中央を新しい長さにリサンプリングするので、単色や反対軸方向のグラデーションに向きます。タイル（Tile）は元の大きさで繰り返すので、模様（リベット、ステッチ、レンガの縁）がゆがみません。Nerulioは最後の1枚を切り取ります。Godot 4には各タイルが欠けずに見えるよう少し伸ばすTile Fitもありますが、Nerulioのプレビューはこのモードを描きません。',
    '同じ4つの数値を、エンジンごとに別の名前と順序で保存します。Godot 4はNinePatchRectの`patch_margin_left/right/top/bottom`（整数、ピクセル）とStyleBoxTextureの`texture_margin_*`。UnityのSprite EditorにはL・R・T・Bの欄がありますが、スクリプトの値`Sprite.border`は左・下・右・上の順のVector4です。PhaserのNineSliceはサイズの後に`leftWidth, rightWidth, topHeight, bottomHeight`を受け取り、左右の幅だけを渡すと3スライスになります。'],
    terms:[['境界（patch margin）','画像の端から切り分け線までの距離（元画像のピクセル）。'],['引き伸ばし（Stretch）','辺や中央を新しい長さに合わせて拡大縮小する。'],['タイル（Tile）','辺や中央を元の大きさのまま繰り返す。'],['最小サイズ','(L + R) × (T + B)。これより小さいと四隅を欠けずに描けず、つぶれます。']]},
   example:{title:'例：48 × 48のパネルを300 × 80で描く',lead:'境界はすべての辺で12pxです。エディターの描画プランが作る矩形で、書き出すプレビューも同じプランを使います。',lines:[
    '元画像 48 × 48   境界 L 12 · R 12 · T 12 · B 12   目標 300 × 80   引き伸ばし',
    '四隅        4 × (12×12 → 12×12)     1:1でコピー、リサンプリングなし',
    '上/下       24×12 → 276×12          276 = 300 − 12 − 12   （横方向だけ×11.5）',
    '左/右       12×24 → 12×56           56 = 80 − 12 − 12     （縦方向だけ×2.33）',
    '中央        24×24 → 276×56',
    'タイル      上の辺 = 24pxのタイル11枚 + 切り取った12pxの1枚   (11 × 24 + 12 = 276)',
    '小さすぎ    目標 20 × 80：20 < 12 + 12 → 四隅が10 + 10につぶれる（警告 "narrow"）',
    '非対称      L 10 · R 6 · T 8 · B 14   →  Unity Sprite.border (x, y, z, w) = (L, B, R, T) = (10, 14, 6, 8)',
    'Godot       patch_margin_left 12 · right 12 · top 12 · bottom 12',
    'Phaser      this.add.nineslice(x, y, "panel", null, 300, 80, 12, 12, 12, 12)'],
    after:'整数倍率2なら四隅はちょうど24 × 24（元の1ピクセルが2 × 2）で描かれ、ピクセルアートの枠が2倍でもくっきりしたままです。'},
   outputs:{rows:[
    ['panel.png','元画像。変更せず、ファイル名を引き継ぎます。'],
    ['previews/100x40.png, 300x80.png, 800x200.png + custom size','選んだモードと倍率で各プレビューサイズに描いたパネル（任意サイズの既定値は420 × 120）。'],
    ['nine-slice.json','境界を`pixels`、`normalized`（境界 ÷ 幅または高さ）、`godot4`（`patch_margin_*`）、`unity`（L・B・R・T順の`border`と順序名）で持ち、モード・倍率・プレビューサイズも記録。'],
    ['SETUP.md','数値を埋めたGodot 4・Unityの設定手順。エンジン内で実行していないと明記。']]},
   target:{title:'Godot・Unity・Phaserに境界を入れる',steps:[
    'Godot 4：`NinePatchRect`を追加し、TextureにPNGを、`patch_margin_left`・`patch_margin_right`・`patch_margin_top`・`patch_margin_bottom`に`nine-slice.json`の4つの数値を入れます。',
    'Godot 4のタイルモード：`axis_stretch_horizontal`と`axis_stretch_vertical`をTile（またはTile Fit）にします。Button・Panelのテーマなら`StyleBoxTexture`の`texture_margin_*`に同じ数値を入れ、軸の伸ばし方も同じにします。',
    'Unity：テクスチャを選んでMesh TypeをFull RectにしてApplyし、Sprite Editorを開いて緑のハンドルをドラッグするか、L・R・T・Bの欄に`pixels`の値を入力します。',
    'Unity：Sprite RendererならDraw ModeをSliced（またはTiled、Tile ModeはContinuousかAdaptive）に、UIのImageならImage TypeをSliced（またはTiled）にします。',
    'Phaser 3.60以降：`this.add.nineslice(x, y, key, frame, width, height, leftWidth, rightWidth, topHeight, bottomHeight)`。Phaser 4.1のAPIには、伸ばさずに繰り返す`tileX`・`tileY`があります。',
    'ピクセルアートではNearestフィルターのまま、元ピクセルの整数倍でサイズを変えて四隅をくっきり保ちます。']},
   verify:{steps:[
    'エンジンのノードを300 × 80にして`previews/300x80.png`と比べます。12 × 12の四隅がピクセル単位で一致するはずです。',
    'L + Rより狭くしてみます。同じサイズでNerulioは"narrow"の警告を出し、PhaserのドキュメントもL + Rを最小幅としています。',
    'Unityで`Debug.Log(sprite.border)`がJSONの`unity.border`の数値（左・下・右・上）を出力するはずです。']},
   trouble:{rows:[
    ['Unityで四隅が伸びる','Mesh TypeがTight、またはImage・Sprite RendererがまだSimpleで描いている','テクスチャのインポート設定と、Image TypeまたはDraw Mode','Mesh TypeをFull RectにしてApplyし、Image Type SlicedかDraw Mode Slicedに'],
    ['Unityで上下の境界が入れ替わって見える','Vector4の順（左・下・右・上）をL・R・T・Bの欄に入れた、またはその逆','Sprite Editorの欄とJSONの`pixels`を比べる','Sprite Editorには`pixels`を入力し、`unity.border`はスクリプトの`Sprite.border`だけに使う'],
    ['小さいサイズで四隅がつぶれる','コントロールがL + RまたはT + Bより小さい','Nerulioがそのサイズで"narrow"・"short"の警告を出す','コントロールを大きくするか境界を小さくする'],
    ['模様のある辺がにじんで見える','辺を引き伸ばしたため、繰り返し模様がリサンプリングされた','プレビューをタイルに切り替えて比べる','GodotはTile・Tile Fit、UnityはTiled、Phaser 4は`tileX`・`tileY`'],
    ['ピクセルアートの角がぼやける','Linearフィルター、または倍率が整数でない','拡大すると角の段差がやわらかい','Nearestフィルターと整数倍率（エディターの倍率は1〜4）'],
    ['TexturePackerのアトラスでPhaserのNineSliceがおかしい','フレームがトリムされている。PhaserのドキュメントはNineSliceがトリムされたTexturePackerのテクスチャに非対応と記載','アトラスのJSONでトリムされたフレームを確認','パネルをトリムなしでパックするか、単独の画像として読み込む'],
    ['「境界を提案」がはっきりした区間を見つけない','中央がグラデーションやノイズで、同一の列・行がない','提案に繰り返す列・行が明確でないと出る','角の絵が終わる位置にガイドを手で置く']]},
   alternatives:{rows:[
    ['GodotのNinePatchRectのインスペクターやUnityのSprite Editorで直接設定','パネルが1〜2枚で、すでにエンジンで作業しているとき。ドラッグしながら実際のエンジンの描画を確認できます。'],
    ['[[game/ui-lab|UIラボのアトラスステージ]]','1枚のシートにパネルが多いとき。要素ごとに境界を付け、すべてを1つの`ui-atlas.json`にまとめます。']]},
   limits:['Godot・Unity・Phaserの中での描画は実行していません。数値は各エンジンのドキュメントに合わせたもので、エンジンでの試験結果ではありません。','エンジンのファイル（`.tres`、`.meta`、Androidの`.9.png`）は書き出しません。','1より大きい整数倍率のタイルモードでは、最後の1枚が元ピクセルの(倍率 − 1) ÷ 倍率ぶんつぶれることがあります。'],
   versions:{body:['docs/UI-LAB.mdのためにChromiumで測定しました。書き出したすべてのプレビューの6 × 6の四隅ブロックは100 × 40、300 × 80、800 × 200、420 × 120で元画像とバイト一致し、描画プランは300 × 80、倍率3、8 × 4につぶした場合のいずれもすき間・重なり0でした。縞模様の12 × 12パネルは4pxの周期でタイルされ、提案は同一の列・行12本の区間から6 · 6 · 6 · 6を見つけました。Firefoxでは半透明の角のピクセルがアルファの丸め1段階ぶん変わることがあります。Godot・Unityでの読み込みはUNVERIFIEDです。上のエンジン設定はGodot 4.7、Unity 6、PhaserのAPI公式ドキュメントに基づきます。'],sources:[S.ninePatch,S.styleBox,S.unitySlice,S.unitySliceDraw,S.unityBorder,S.unityImage,S.phaserNine]}
  }
 },
 'game/button-state-generator':{
  type:'create',
  intent:{primary:'make hover, pressed, disabled and focus images of a game UI button from one PNG',secondary:['default values that can be edited','use the states in Godot TextureButton or Unity Sprite Swap','focus ring and disabled contrast'],
   goal:'five state PNGs plus a strip and a JSON that records every value, ready for an engine button',input:'one button PNG',output:'states/normal|hover|pressed|disabled|focus.png + button-states.png + states.json + README.txt',target:'Godot 4 TextureButton / Button theme, Unity UI Button Sprite Swap (not engine-tested)',support:'partial',
   evidence:['src/game/ui-states.js (DEFAULT_OPS, adjust, shift, variant)','docs/UI-LAB.md §2 and verification rows 8–9','src/task/ui-lab.js exportStates/buildStrip'],
   external:['Godot 4.7 TextureButton texture_* and Button focus StyleBox','Unity UI 2.0 Selectable transitions','WCAG 2.2 1.4.3, 1.4.11, 2.4.13']},
  en:{
   answer:'A game button usually needs five images: normal, hover, pressed, disabled and focus. The generator derives them from one PNG with pixel operations you can read and change. Defaults: hover +10 % brightness and +8 % saturation, pressed −10 % brightness and 1 px down, disabled fully desaturated at 50 % alpha, focus a 2 px `#3182f6` ring. It exports `states/*.png`, one packed strip and `states.json` with every value used. It only changes pixels that are already there; it draws no new artwork.',
   concept:{title:'How a state is computed',body:[
    'Each state is an ordered list of operations on the RGBA pixels. First the canvas grows if the state has an outline, then brightness adds the value × 255 to R, G and B, contrast scales around mid grey (128), saturation moves each channel away from or towards the pixel\'s luma (0.2126 R + 0.7152 G + 0.0722 B), an optional colour overlay is mixed in, the pixels are offset, the outline is drawn as a square dilation of the shape, and finally alpha is multiplied. Fully transparent pixels are never recoloured.',
    'Engines expect these images in fixed slots. Godot 4\'s `TextureButton` has `texture_normal`, `texture_hover`, `texture_pressed`, `texture_disabled` and `texture_focused`; a disabled button without its own texture shows the normal one, and the focused texture is drawn on top of the base texture. Unity\'s UI Button with Transition = Sprite Swap takes a normal sprite on its Target Graphic plus Highlighted, Pressed and Disabled sprites.',
    'Two WCAG 2.2 rules are worth knowing even though games are not web pages. Success Criterion 1.4.3 exempts text that is part of an inactive (disabled) component from its contrast minimum, which is why a faded disabled state is acceptable. 2.4.13 Focus Appearance (level AAA) asks for a focus indicator at least as large as a 2 CSS px perimeter of the component with a 3:1 contrast between focused and unfocused pixels; the default ring is 2 px, and `#3182f6` against white measures 3.71:1.'],
    terms:[['Brightness','Added to every channel: +0.1 means +25.5 levels.'],['Saturation','+0.08 pushes each channel 8 % further from the luma; −1 turns the pixel grey.'],['Offset','Moves the pixels inside the same canvas; what leaves is dropped, what enters is transparent.'],['Outline','A ring of the chosen colour and width around the opaque shape; the canvas grows by that width.']]},
   example:{title:'Example: one pixel through the five default states',lead:'A 40 × 16 button filled with the colour (200, 120, 40). The numbers are what the exported PNGs contain:',lines:[
    'state      pixel (R, G, B, A)     size     operations',
    'normal     (200, 120, 40, 255)    40 × 16  none',
    'hover      (231, 145, 58, 255)    40 × 16  brightness +0.1 (+25.5), saturation +0.08',
    'pressed    (174, 94, 14, 255)     40 × 16  brightness −0.1, offset 0,1 → row 0 becomes transparent',
    'disabled   (131, 131, 131, 128)   40 × 16  saturation −1, alpha × 0.5',
    'focus      (200, 120, 40, 255)    44 × 20  canvas +2 px per side, 2 px ring (49, 130, 246)',
    '',
    'disabled grey  0.2126 × 200 + 0.7152 × 120 + 0.0722 × 40 = 131.2 → 131;  alpha 255 × 0.5 = 127.5 → 128',
    'hover green    luma 156.7 + (145.5 − 156.7) × 1.08 = 144.6 → 145'],
    after:'The focus image is 4 px wider and taller than the others, and its ring covers the corner pixels too, because the outline is a square dilation. `states.json` records each state\'s size and padding so the difference is never a surprise.'},
   target:{title:'Use the states in Godot or Unity',steps:[
    'Godot 4: add a `TextureButton` and assign `normal.png`, `hover.png`, `pressed.png` and `disabled.png` to `texture_normal`, `texture_hover`, `texture_pressed` and `texture_disabled`.',
    'Godot 4 draws `texture_focused` over the base texture and its documentation recommends a partly transparent image such as an outline. `focus.png` contains the whole button, so for that slot erase the button inside the ring in an image editor and keep the 44 × 20 canvas.',
    'Unity UI: on the Button set Transition to Sprite Swap, put `normal.png` on the Target Graphic\'s Image and `hover.png`, `pressed.png`, `disabled.png` into Highlighted Sprite, Pressed Sprite and Disabled Sprite.',
    'If the button must resize, give each state PNG the same nine-slice borders in the [[game/9-slice-editor|9-slice editor]] before assigning them, because the states carry no borders of their own.']},
   verify:{steps:[
    'Every `rect` in `states.json` cuts exactly its state out of `button-states.png`, and `states.hover.ops` lists the values used.',
    '`normal.png` is the source byte for byte (in Firefox semi-transparent pixels can differ by one alpha-rounding step).',
    'Run the game and hover, press and disable the button: nothing jumps, and the pressed state moves by exactly the offset.']},
   trouble:{rows:[
    ['The pressed image loses its bottom row','The 1 px offset moves the pixels inside the same canvas, so the last row falls off and row 0 becomes transparent','Compare the bottom edge of `pressed.png` with the source','Leave one transparent row under the art, or set the offset to 0 and move the label in the engine instead'],
    ['The focused button jumps or looks doubled','`focus.png` is larger (44 × 20 for a 40 × 16 button) and Godot draws the focus texture over the base','`states.json` → `states.focus.size`','Centre it by −outline px, or use a ring-only overlay as described above'],
    ['The disabled button almost vanishes on a dark background','Alpha 0.5 lets the background show through','Look at it over your real background, not on white','Raise the disabled alpha (0.7) or keep alpha 1 and only desaturate'],
    ['Hover is barely visible on a light button','Brightness is additive and channels already near 255 clip','Pixel values above about 230 in the source','Use an overlay colour or contrast for hover instead of brightness']]},
   alternatives:{rows:[
    ['Unity Transition = Color Tint','The states only differ in colour: no extra images, but a tint multiplies colours and cannot move pixels (pressed offset) or add a ring.'],
    ['Draw each state by hand in an art program','The states differ in shape: a bevel that flips, an icon that changes, a glow. Pixel arithmetic cannot draw what is not in the source.']]},
   limits:['No per-state nine-slice borders: set them on the state PNGs in the 9-slice editor.','Engine use was not tested; the slot names above come from the Godot and Unity documentation.'],
   versions:{body:['Measured in Chromium for docs/UI-LAB.md on a 40 × 16 button: normal is byte-identical to the source, hover is brighter, pressed is offset with the vacated rows cleared, disabled is grey at alpha 128, focus is 44 × 20 with a `#3182f6` ring and untouched artwork, and all five rects in `states.json` cut exactly their state out of the strip. The example values above were recomputed with the same module. Godot and Unity import were not run.'],sources:[S.textureButton,S.button,S.unityTransition,S.wcag]}
  },
  ko:{
   answer:'게임 버튼에는 보통 normal·hover·pressed·disabled·focus 다섯 장의 이미지가 필요합니다. 이 생성기는 PNG 한 장에서 읽고 고칠 수 있는 픽셀 연산으로 다섯 장을 만듭니다. 기본값은 hover 밝기 +10%·채도 +8%, pressed 밝기 −10%와 1px 아래로, disabled 채도 완전 제거와 알파 50%, focus 2px `#3182f6` 링입니다. `states/*.png`, 패킹된 스트립 하나, 사용한 모든 값을 기록한 `states.json`을 내보냅니다. 이미 있는 픽셀만 바꾸며 새 그림을 그리지는 않습니다.',
   concept:{title:'상태 하나가 계산되는 방식',body:[
    '각 상태는 RGBA 픽셀에 적용하는 순서 있는 연산 목록입니다. 외곽선이 있으면 먼저 캔버스를 키우고, 밝기는 값 × 255를 R·G·B에 더하며, 대비는 중간 회색(128)을 기준으로 늘이고, 채도는 각 채널을 그 픽셀의 휘도(0.2126 R + 0.7152 G + 0.0722 B)에서 멀어지거나 가까워지게 합니다. 이어서 선택형 색 덧씌우기, 픽셀 이동, 모양을 네모로 팽창시킨 외곽선을 그리고, 마지막에 알파를 곱합니다. 완전히 투명한 픽셀은 다시 칠하지 않습니다.',
    '엔진은 이 이미지들을 정해진 칸에 받습니다. Godot 4의 `TextureButton`에는 `texture_normal`, `texture_hover`, `texture_pressed`, `texture_disabled`, `texture_focused`가 있고, 자기 텍스처가 없는 disabled 버튼은 normal을 보여 주며, focused 텍스처는 기본 텍스처 위에 겹쳐 그려집니다. Unity UI Button은 Transition을 Sprite Swap으로 두면 Target Graphic의 기본 스프라이트와 Highlighted·Pressed·Disabled 스프라이트를 받습니다.',
    '게임은 웹 페이지가 아니지만 WCAG 2.2의 두 규칙은 알아 둘 만합니다. 성공 기준 1.4.3은 비활성(disabled) 컴포넌트의 텍스트를 대비 최소 기준에서 제외하므로, 흐린 disabled 상태가 허용됩니다. 2.4.13 Focus Appearance(AAA)는 컴포넌트 둘레 2 CSS px 이상 크기의 포커스 표시와, 포커스 전후 픽셀 사이 3:1 대비를 요구합니다. 기본 링은 2px이고 `#3182f6`은 흰색 대비 3.71:1로 측정됩니다.'],
    terms:[['밝기','모든 채널에 더하는 값. +0.1은 +25.5단계입니다.'],['채도','+0.08은 각 채널을 휘도에서 8% 더 멀리, −1은 픽셀을 회색으로 만듭니다.'],['오프셋','같은 캔버스 안에서 픽셀을 옮깁니다. 밖으로 나간 것은 버리고 들어오는 곳은 투명합니다.'],['외곽선','불투명한 모양 둘레의 지정 색·두께 링. 캔버스가 그 두께만큼 커집니다.']]},
   example:{title:'예시: 픽셀 하나가 기본 상태 다섯 개를 거치면',lead:'색 (200, 120, 40)으로 채운 40 × 16 버튼입니다. 내보낸 PNG에 실제로 들어가는 값입니다.',lines:[
    '상태       픽셀 (R, G, B, A)      크기     연산',
    'normal     (200, 120, 40, 255)    40 × 16  없음',
    'hover      (231, 145, 58, 255)    40 × 16  밝기 +0.1 (+25.5), 채도 +0.08',
    'pressed    (174, 94, 14, 255)     40 × 16  밝기 −0.1, 오프셋 0,1 → 0번 줄이 투명해짐',
    'disabled   (131, 131, 131, 128)   40 × 16  채도 −1, 알파 × 0.5',
    'focus      (200, 120, 40, 255)    44 × 20  캔버스 변마다 +2px, 2px 링 (49, 130, 246)',
    '',
    'disabled 회색  0.2126 × 200 + 0.7152 × 120 + 0.0722 × 40 = 131.2 → 131;  알파 255 × 0.5 = 127.5 → 128',
    'hover 초록     휘도 156.7 + (145.5 − 156.7) × 1.08 = 144.6 → 145'],
    after:'focus 이미지는 다른 상태보다 가로·세로 4px 크고, 외곽선이 네모 팽창이라 모서리 픽셀까지 링이 덮습니다. `states.json`에 상태마다 크기와 여백이 기록되므로 차이에 놀랄 일은 없습니다.'},
   target:{title:'Godot·Unity에서 상태 쓰기',steps:[
    'Godot 4: `TextureButton`을 추가하고 `normal.png`·`hover.png`·`pressed.png`·`disabled.png`를 `texture_normal`·`texture_hover`·`texture_pressed`·`texture_disabled`에 지정합니다.',
    'Godot 4는 `texture_focused`를 기본 텍스처 위에 그리며, 문서는 외곽선처럼 일부가 투명한 이미지를 권합니다. `focus.png`에는 버튼 전체가 들어 있으므로 이 칸에 쓰려면 이미지 편집기에서 링 안쪽의 버튼을 지우고 44 × 20 캔버스를 유지하세요.',
    'Unity UI: Button의 Transition을 Sprite Swap으로 두고, Target Graphic의 Image에 `normal.png`를, Highlighted Sprite·Pressed Sprite·Disabled Sprite에 `hover.png`·`pressed.png`·`disabled.png`를 넣습니다.',
    '버튼 크기가 바뀌어야 한다면, 상태에는 테두리가 없으므로 지정하기 전에 [[game/9-slice-editor|9슬라이스 편집기]]에서 상태 PNG마다 같은 나인 슬라이스 테두리를 주세요.']},
   verify:{steps:[
    '`states.json`의 모든 `rect`가 `button-states.png`에서 해당 상태를 정확히 잘라 내고, `states.hover.ops`에 사용한 값이 나열됩니다.',
    '`normal.png`는 원본과 바이트 동일합니다(Firefox에서는 반투명 픽셀이 알파 반올림 한 단계만큼 다를 수 있음).',
    '게임을 실행해 버튼에 마우스를 올리고, 누르고, 비활성화해 봅니다. 튀는 곳이 없고 pressed는 오프셋만큼만 움직여야 합니다.']},
   trouble:{rows:[
    ['pressed 이미지의 맨 아래 줄이 사라짐','1px 오프셋이 같은 캔버스 안에서 픽셀을 옮겨 마지막 줄이 밀려나고 0번 줄은 투명해짐','`pressed.png` 아래 가장자리를 원본과 비교','그림 아래에 투명한 줄을 하나 남기거나, 오프셋을 0으로 두고 엔진에서 글자를 움직이기'],
    ['포커스된 버튼이 튀거나 겹쳐 보임','`focus.png`가 더 크고(40 × 16 버튼이면 44 × 20) Godot는 focus 텍스처를 기본 위에 그림','`states.json` → `states.focus.size`','외곽선 두께만큼 음수로 옮겨 가운데 맞추거나, 위 설명처럼 링만 남긴 이미지 사용'],
    ['어두운 배경에서 disabled 버튼이 거의 안 보임','알파 0.5라 배경이 비쳐 보임','흰 바탕이 아닌 실제 배경 위에서 확인','disabled 알파를 0.7로 올리거나, 알파는 1로 두고 채도만 빼기'],
    ['밝은 버튼에서 hover 차이가 거의 없음','밝기는 더하는 방식이라 이미 255에 가까운 채널은 잘림','원본 픽셀 값이 약 230 이상','hover에 밝기 대신 색 덧씌우기나 대비 사용']]},
   alternatives:{rows:[
    ['Unity Transition = Color Tint','상태가 색만 다를 때. 이미지가 더 필요 없지만, 색을 곱할 뿐이라 픽셀을 옮기거나(pressed 오프셋) 링을 더할 수 없습니다.'],
    ['그림 프로그램에서 상태마다 직접 그리기','모양이 달라질 때(뒤집히는 베벨, 바뀌는 아이콘, 빛). 픽셀 계산은 원본에 없는 것을 그릴 수 없습니다.']]},
   limits:['상태별 나인 슬라이스 테두리는 없습니다. 9슬라이스 편집기에서 상태 PNG에 주세요.','엔진에서 시험하지 않았습니다. 위의 칸 이름은 Godot·Unity 공식 문서에서 가져왔습니다.'],
   versions:{body:['docs/UI-LAB.md를 위해 Chromium에서 40 × 16 버튼으로 측정했습니다. normal은 원본과 바이트 동일, hover는 더 밝고, pressed는 오프셋되며 비워진 줄은 투명, disabled는 알파 128의 회색, focus는 `#3182f6` 링이 있는 44 × 20이고 그림은 그대로였으며, `states.json`의 다섯 영역이 스트립에서 각 상태를 정확히 잘라 냈습니다. 위 예시 값은 같은 모듈로 다시 계산했습니다. Godot·Unity 가져오기는 실행하지 않았습니다.'],sources:[S.textureButton,S.button,S.unityTransition,S.wcag]}
  },
  ja:{
   answer:'ゲームのボタンには、ふつうnormal・hover・pressed・disabled・focusの5枚の画像が必要です。このジェネレーターは1枚のPNGから、読めて変更できるピクセル操作で5枚を作ります。既定値はhoverが明るさ+10%・彩度+8%、pressedが明るさ−10%と1px下へ、disabledが彩度を完全に落としてアルファ50%、focusが2pxの`#3182f6`のリングです。`states/*.png`、パック済みストリップ1枚、使ったすべての値を記録した`states.json`を書き出します。既にあるピクセルを変えるだけで、新しい絵は描きません。',
   concept:{title:'1つの状態が計算される流れ',body:[
    '各状態はRGBAピクセルに順に適用する操作の一覧です。アウトラインがあれば先にキャンバスを広げ、明るさは値 × 255をR・G・Bに足し、コントラストは中間のグレー（128）を中心に広げ、彩度は各チャンネルをそのピクセルの輝度（0.2126 R + 0.7152 G + 0.0722 B）から遠ざけたり近づけたりします。続いて任意の色のオーバーレイ、ピクセルの移動、形を正方形に膨らませたアウトラインを描き、最後にアルファを掛けます。完全に透明なピクセルは塗り替えません。',
    'エンジンはこれらの画像を決まった枠で受け取ります。Godot 4の`TextureButton`には`texture_normal`、`texture_hover`、`texture_pressed`、`texture_disabled`、`texture_focused`があり、専用のテクスチャがないdisabledのボタンはnormalを表示し、focusedのテクスチャは基本のテクスチャの上に重ねて描かれます。UnityのUI ButtonはTransitionをSprite Swapにすると、Target Graphicの基本スプライトとHighlighted・Pressed・Disabledのスプライトを受け取ります。',
    'ゲームはWebページではありませんが、WCAG 2.2の2つの規定は知っておく価値があります。達成基準1.4.3は無効（disabled）なコンポーネントの一部であるテキストをコントラストの最低基準から除外しているので、薄くしたdisabledは許容されます。2.4.13 Focus Appearance（AAA）は、コンポーネントの外周2 CSS px以上の大きさのフォーカス表示と、フォーカス前後のピクセル間で3:1のコントラストを求めます。既定のリングは2pxで、`#3182f6`は白に対して3.71:1と測定されます。'],
    terms:[['明るさ','すべてのチャンネルに足す値。+0.1は+25.5段階です。'],['彩度','+0.08は各チャンネルを輝度から8%遠ざけ、−1はピクセルをグレーにします。'],['オフセット','同じキャンバスの中でピクセルを移動。はみ出た分は捨て、入ってくる側は透明です。'],['アウトライン','不透明な形の周りに付く指定の色・太さのリング。キャンバスがその太さ分広がります。']]},
   example:{title:'例：1ピクセルが既定の5状態を通ると',lead:'色(200, 120, 40)で塗った40 × 16のボタンです。書き出したPNGに実際に入る値です。',lines:[
    '状態       ピクセル (R, G, B, A)  サイズ   操作',
    'normal     (200, 120, 40, 255)    40 × 16  なし',
    'hover      (231, 145, 58, 255)    40 × 16  明るさ +0.1 (+25.5)、彩度 +0.08',
    'pressed    (174, 94, 14, 255)     40 × 16  明るさ −0.1、オフセット 0,1 → 0行目が透明に',
    'disabled   (131, 131, 131, 128)   40 × 16  彩度 −1、アルファ × 0.5',
    'focus      (200, 120, 40, 255)    44 × 20  キャンバス各辺 +2px、2pxのリング (49, 130, 246)',
    '',
    'disabledのグレー  0.2126 × 200 + 0.7152 × 120 + 0.0722 × 40 = 131.2 → 131；アルファ 255 × 0.5 = 127.5 → 128',
    'hoverの緑         輝度 156.7 + (145.5 − 156.7) × 1.08 = 144.6 → 145'],
    after:'focusの画像はほかより縦横4px大きく、アウトラインが正方形の膨張なので角のピクセルまでリングが覆います。`states.json`に状態ごとのサイズと余白が記録されるので、違いに驚くことはありません。'},
   target:{title:'Godot・Unityで状態を使う',steps:[
    'Godot 4：`TextureButton`を追加し、`normal.png`・`hover.png`・`pressed.png`・`disabled.png`を`texture_normal`・`texture_hover`・`texture_pressed`・`texture_disabled`に割り当てます。',
    'Godot 4は`texture_focused`を基本のテクスチャの上に描き、ドキュメントはアウトラインのような一部が透明な画像を勧めています。`focus.png`にはボタン全体が入っているので、この枠に使うなら画像エディターでリングの内側のボタンを消し、44 × 20のキャンバスはそのままにします。',
    'Unity UI：ButtonのTransitionをSprite Swapにし、Target GraphicのImageに`normal.png`を、Highlighted Sprite・Pressed Sprite・Disabled Spriteに`hover.png`・`pressed.png`・`disabled.png`を入れます。',
    'ボタンのサイズを変える必要があるなら、状態には境界がないので、割り当てる前に[[game/9-slice-editor|9スライスエディター]]で各状態のPNGに同じナインスライスの境界を付けてください。']},
   verify:{steps:[
    '`states.json`のすべての`rect`が`button-states.png`から該当の状態を正確に切り出し、`states.hover.ops`に使った値が並びます。',
    '`normal.png`は元画像とバイト一致します（Firefoxでは半透明ピクセルがアルファの丸め1段階ぶん違うことがあります）。',
    'ゲームを実行してボタンにカーソルを乗せ、押し、無効にしてみます。跳ねる箇所がなく、pressedはオフセットの分だけ動くはずです。']},
   trouble:{rows:[
    ['pressedの画像のいちばん下の行が消える','1pxのオフセットが同じキャンバス内でピクセルを動かすため、最後の行がはみ出し0行目が透明になる','`pressed.png`の下端を元画像と比べる','絵の下に透明な行を1つ残すか、オフセットを0にしてエンジン側で文字を動かす'],
    ['フォーカス時にボタンが跳ねる・二重に見える','`focus.png`が大きく（40 × 16のボタンなら44 × 20）、Godotはfocusのテクスチャを基本の上に描く','`states.json` → `states.focus.size`','アウトラインの太さ分マイナスにずらして中央を合わせるか、上の説明どおりリングだけの画像を使う'],
    ['暗い背景でdisabledのボタンがほとんど見えない','アルファ0.5で背景が透けている','白地ではなく実際の背景の上で確認する','disabledのアルファを0.7に上げるか、アルファは1のまま彩度だけ落とす'],
    ['明るいボタンでhoverの差がほとんどない','明るさは加算なので、255に近いチャンネルは頭打ちになる','元画像のピクセル値がおよそ230以上','hoverには明るさの代わりに色のオーバーレイかコントラストを使う']]},
   alternatives:{rows:[
    ['UnityのTransition = Color Tint','状態が色だけ違うとき。画像は増えませんが、色を掛けるだけなのでピクセルを動かしたり（pressedのオフセット）リングを足したりはできません。'],
    ['お絵描きソフトで状態ごとに手描きする','形が変わるとき（反転するベベル、変わるアイコン、光）。ピクセルの計算では元にないものは描けません。']]},
   limits:['状態ごとのナインスライス境界はありません。9スライスエディターで状態のPNGに付けてください。','エンジンでは試していません。上の枠の名前はGodot・Unityの公式ドキュメントによるものです。'],
   versions:{body:['docs/UI-LAB.mdのためにChromiumで40 × 16のボタンを使って測定しました。normalは元画像とバイト一致、hoverはより明るく、pressedはオフセットされ空いた行は透明、disabledはアルファ128のグレー、focusは`#3182f6`のリング付きの44 × 20で絵はそのまま、`states.json`の5つの矩形はストリップから各状態を正確に切り出しました。上の例の値は同じモジュールで計算し直しています。Godot・Unityでの読み込みは実行していません。'],sources:[S.textureButton,S.button,S.unityTransition,S.wcag]}
  }
 },
 'game/missing-glyph-checker':{
  type:'troubleshoot',
  intent:{primary:'find which characters of a translation are missing from a bitmap font before they show as boxes',secondary:['why Korean or Japanese text shows □ or blanks','check a .po file against a .fnt','Unicode code points in a BMFont'],
   goal:'a list of every missing character with its code point, count and line, to add to the font',input:'.po / .json / .csv / .tsv / .txt or pasted text, plus a .fnt or the UI Lab font',output:'on-screen list + missing-glyphs.json + missing-glyphs.txt',target:'any engine that renders a BMFont (the check itself is engine-independent)',support:'partial',
   evidence:['src/game/bmfont.js (extractText, occurrences, missingCharacters, parseFnt, fntCodepoints)','docs/UI-LAB.md §5 and verification row 18','src/task/ui-lab.js exportMissing'],
   external:['AngelCode BMFont format: char id','GNU gettext PO format','Godot ResourceImporterBMFont fallbacks']},
  en:{
   answer:'Boxes (□) or blank gaps where Korean or Japanese letters should be mean that the font has no glyph for those code points. A bitmap font contains only the characters baked into it, one `char id=` line per glyph in its `.fnt`. The checker pulls the translated text out of your `.po` (the `msgstr` values), `.json`, `.csv`/`.tsv` or `.txt`, compares every distinct character with the `.fnt` (or the font built in the UI Lab\'s Font stage), and lists each missing character with its Unicode code point, how often it is used and the first lines it appears on. It cannot read a TTF\'s character map yet.',
   concept:{title:'Why letters turn into boxes',body:[
    'Every character is a Unicode code point, and a BMFont stores it in decimal: `시` is U+C2DC, which the `.fnt` writes as `char id=49884`. The check is plain set membership: the distinct characters of the text minus the `char id` values of the font. Scripts are large, which is why game fonts for Korean or Japanese are built from the strings the game actually uses: the precomposed Hangul syllables U+AC00–U+D7A3 are 11,172 code points, and the CJK Unified Ideographs block U+4E00–U+9FFF spans 20,992.',
    'The usual causes are a translation updated after the font was baked; a font built from the source-language text; look-alike characters with different code points (full-width `！` U+FF01 against `!` U+0021); and decomposed Hangul, where `가` arrives as the jamo U+1100 U+1161 instead of the single syllable U+AC00. The checker compares code points exactly, so it reports all of these.',
    'What is read from each file matters. From a `.po` only `msgstr` (and `msgstr[n]`) values are taken, never the `msgid` source keys, but the header entry\'s `msgstr` (`Language:`, `Content-Type:`) counts as text too. JSON contributes every string value, CSV and TSV every cell including the key and source columns. Whitespace, including the no-break space U+00A0 and the ideographic space U+3000, is skipped because it is not drawn as a glyph.']},
   example:{title:'Example: a Korean .po against a 4-glyph .fnt',lead:'The font was baked from 시, 작, 끝 and 내. The report below is what the checker returns for this file:',lines:[
    'ko.po (9 lines)                         font.fnt (4 glyphs)',
    'msgid ""                                char id=49884   시 U+C2DC',
    'msgstr ""                               char id=51089   작 U+C791',
    '"Language: ko\\n"                        char id=45149   끝 U+B05D',
    'msgid "Start"  →  msgstr "시작"         char id=45236   내 U+B0B4',
    'msgid "Quit"   →  msgstr "끝내기"',
    '',
    'text checked   "Language: ko" / "시작" / "끝내기"   (msgid values are not read)',
    'missing        기 U+AE30 ×1   (text line 5)',
    '               a ×2, g ×2, :, L, e, k, n, o, u   (header entry, text line 2)',
    'to add         기 = 0xAE30 = 44592 → the rebuilt font needs "char id=44592"'],
    after:'The Latin letters come from the header entry, not from a translation. Either add ASCII to the font (most games need digits and Latin letters anyway) or ignore those rows; the real gap here is `기`.'},
   verify:{steps:[
    'After adding the characters and rebuilding the font, run the check again: it should say that nothing is missing and name how many distinct characters were checked.',
    'Open `missing-glyphs.json`: every entry has `char`, `codepoint` as `U+XXXX`, `count` and `lines`; `missing-glyphs.txt` is the same characters on one line, ready to paste into a font tool\'s character field.',
    'In the game, show one test string that contains every character of the language file: no box and no blank should remain.']},
   mapping:{title:'Where the checked text comes from',head:['File','What is read','What is ignored'],rows:[
    ['`.po`','`msgstr` and `msgstr[n]` values with their continuation lines (the header entry included)','`msgid`, `msgctxt`, comments'],
    ['`.json`','Every string value at any depth','Object keys, numbers, booleans'],
    ['`.csv` / `.tsv`','Every cell of every row, header row and key column included','Separators and quotes'],
    ['`.txt` or pasted text','Everything','Line breaks and other whitespace'],
    ['`.fnt` (glyph source)','The `id` of every `char` line','Kerning, pages, metrics']]},
   trouble:{rows:[
    ['Latin letters (L, a, n, g…) are reported for a Korean or Japanese .po','The header entry\'s `msgstr` (`Language:`, `Content-Type:`) is read as text','The listed lines point at the first lines of the extracted text','Add ASCII to the font, or ignore those rows'],
    ['The English source column of a CSV is reported','Every CSV/TSV cell is read, including key and source columns','Most missing characters are Latin and appear on every line','Export only the target-language column, or paste its text instead'],
    ['A character that looks present is reported','A look-alike with another code point (full-width `！`, `～`, a different dash)','Compare the `U+` code in the report with the `.fnt` ids','Add that exact code point to the font, or normalise the text before export'],
    ['Hangul syllables are reported although the font has them','The text is decomposed: jamo U+1100–U+11FF instead of syllables','The report lists `U+11xx` codes','Normalise the strings to NFC in your localisation pipeline'],
    ['Nothing is missing but the game still shows boxes','The game draws with another font or weight than the checked `.fnt`, or the UI Lab font was built in font-file mode, where a character missing from the TTF is rendered by the browser\'s fallback font and baked in','Check the `.fnt` the build actually ships; look at the glyph sheet for letters in a different style','Check against the shipped `.fnt`; in Godot a BMFont can list fallback fonts in its importer'],
    ['The line numbers do not match the file','Lines are counted in the extracted text, not in the original file','Line 2 of a `.po` report is the header text','Search the file for the character itself'],
    ['A TTF or OTF cannot be chosen as the glyph source','The font\'s cmap table is not parsed in this release','—','Build a `.fnt` from the font first, then check against it']]},
   versions:{body:['Measured in Chromium for docs/UI-LAB.md: a `.po` checked against a 4-glyph `.fnt` reported exactly `a 시 작 끝 내 기` with the right counts and line numbers, and the present `가` was not reported. The worked example above was recomputed with the same functions; its header-entry rows are how the current parser behaves. The `.fnt` field meanings follow the AngelCode BMFont documentation, the `.po` structure the GNU gettext manual.'],sources:[S.bmfont,S.gettext,S.bmImporter]}
  },
  ko:{
   answer:'한국어·일본어 글자가 있어야 할 자리에 네모(□)나 빈칸이 보이면 폰트에 그 코드 포인트의 글리프가 없다는 뜻입니다. 비트맵 폰트에는 구울 때 넣은 글자만 있고, `.fnt`에 글리프마다 `char id=` 줄이 하나씩 있습니다. 검사기는 `.po`(`msgstr` 값), `.json`, `.csv`·`.tsv`, `.txt`에서 번역문을 꺼내 서로 다른 글자 하나하나를 `.fnt`(또는 UI 랩 폰트 단계에서 만든 폰트)와 비교하고, 빠진 글자마다 유니코드 코드 포인트·사용 횟수·처음 나오는 줄을 보여 줍니다. TTF의 문자 표는 아직 읽지 못합니다.',
   concept:{title:'글자가 네모로 바뀌는 이유',body:[
    '모든 글자는 유니코드 코드 포인트이고 BMFont는 이를 10진수로 저장합니다. `시`는 U+C2DC이며 `.fnt`에는 `char id=49884`로 적힙니다. 검사는 단순한 집합 비교입니다. 텍스트에 쓰인 서로 다른 글자에서 폰트의 `char id` 값을 빼면 됩니다. 문자 체계가 크기 때문에 한국어·일본어 게임 폰트는 실제로 쓰는 문자열로 만듭니다. 완성형 한글 음절 U+AC00~U+D7A3은 11,172개 코드 포인트이고, 한중일 통합 한자 블록 U+4E00~U+9FFF는 20,992개에 이릅니다.',
    '흔한 원인은 폰트를 구운 뒤 갱신된 번역, 원문 언어로 만든 폰트, 모양은 같지만 코드 포인트가 다른 글자(전각 `！` U+FF01과 `!` U+0021), 그리고 분해된 한글입니다. 분해형에서는 `가`가 음절 하나(U+AC00)가 아니라 자모 U+1100 U+1161로 들어옵니다. 검사기는 코드 포인트를 정확히 비교하므로 이것들을 모두 보고합니다.',
    '파일마다 무엇을 읽는지가 중요합니다. `.po`에서는 `msgstr`(와 `msgstr[n]`) 값만 읽고 원문 키 `msgid`는 읽지 않지만, 헤더 항목의 `msgstr`(`Language:`, `Content-Type:`)도 텍스트로 셉니다. JSON은 모든 문자열 값, CSV·TSV는 키와 원문 열을 포함한 모든 칸을 읽습니다. 줄 바꿈 없는 공백 U+00A0, 전각 공백 U+3000을 포함한 공백 문자는 글리프로 그리지 않으므로 건너뜁니다.']},
   example:{title:'예시: 한국어 .po와 글리프 4개짜리 .fnt',lead:'폰트는 시·작·끝·내로 구웠습니다. 이 파일에 대해 검사기가 돌려주는 결과입니다.',lines:[
    'ko.po (9줄)                             font.fnt (글리프 4개)',
    'msgid ""                                char id=49884   시 U+C2DC',
    'msgstr ""                               char id=51089   작 U+C791',
    '"Language: ko\\n"                        char id=45149   끝 U+B05D',
    'msgid "Start"  →  msgstr "시작"         char id=45236   내 U+B0B4',
    'msgid "Quit"   →  msgstr "끝내기"',
    '',
    '검사한 텍스트  "Language: ko" / "시작" / "끝내기"   (msgid 값은 읽지 않음)',
    '빠진 글자      기 U+AE30 ×1   (텍스트 5번 줄)',
    '               a ×2, g ×2, :, L, e, k, n, o, u   (헤더 항목, 텍스트 2번 줄)',
    '추가할 것      기 = 0xAE30 = 44592 → 다시 만든 폰트에 "char id=44592" 필요'],
    after:'라틴 문자는 번역이 아니라 헤더 항목에서 나왔습니다. 폰트에 ASCII를 넣거나(대부분의 게임은 어차피 숫자와 라틴 문자가 필요함) 그 줄들을 무시하세요. 여기서 진짜로 빠진 글자는 `기`입니다.'},
   verify:{steps:[
    '글자를 추가하고 폰트를 다시 만든 뒤 검사를 다시 돌립니다. 빠진 것이 없다고 나오고, 검사한 서로 다른 글자 수가 표시돼야 합니다.',
    '`missing-glyphs.json`을 엽니다. 항목마다 `char`, `U+XXXX` 형식의 `codepoint`, `count`, `lines`가 있고, `missing-glyphs.txt`는 같은 글자를 한 줄로 모아 폰트 도구의 문자 칸에 바로 붙여 넣을 수 있습니다.',
    '게임에서 언어 파일의 모든 글자가 든 시험 문자열을 하나 띄웁니다. 네모나 빈칸이 하나도 없어야 합니다.']},
   mapping:{title:'검사하는 텍스트는 어디서 오나',head:['파일','읽는 것','무시하는 것'],rows:[
    ['`.po`','`msgstr`와 `msgstr[n]` 값, 이어지는 줄 포함(헤더 항목도 포함)','`msgid`, `msgctxt`, 주석'],
    ['`.json`','깊이에 상관없이 모든 문자열 값','객체 키, 숫자, 불리언'],
    ['`.csv` / `.tsv`','모든 행의 모든 칸(머리글 행과 키 열 포함)','구분자와 따옴표'],
    ['`.txt` 또는 붙여 넣은 텍스트','전부','줄 바꿈과 그 밖의 공백'],
    ['`.fnt`(글리프 출처)','모든 `char` 줄의 `id`','커닝, 페이지, 수치']]},
   trouble:{rows:[
    ['한국어·일본어 .po인데 라틴 문자(L, a, n, g…)가 빠졌다고 나옴','헤더 항목의 `msgstr`(`Language:`, `Content-Type:`)를 텍스트로 읽음','줄 번호가 꺼낸 텍스트의 첫 줄들을 가리킴','폰트에 ASCII를 넣거나 그 줄들을 무시'],
    ['CSV의 영어 원문 열이 보고됨','키·원문 열을 포함해 CSV·TSV의 모든 칸을 읽음','빠진 글자 대부분이 라틴 문자이고 모든 줄에 나옴','대상 언어 열만 내보내거나 그 텍스트를 붙여 넣기'],
    ['있어 보이는 글자가 빠졌다고 나옴','코드 포인트가 다른 닮은 글자(전각 `！`, `～`, 다른 대시)','보고서의 `U+` 코드와 `.fnt`의 id 비교','그 코드 포인트를 폰트에 추가하거나, 내보내기 전에 텍스트를 정규화'],
    ['폰트에 있는 한글 음절이 빠졌다고 나옴','텍스트가 분해형이라 음절 대신 자모 U+1100~U+11FF','보고서에 `U+11xx` 코드가 나열됨','현지화 파이프라인에서 문자열을 NFC로 정규화'],
    ['빠진 글자는 없는데 게임에 여전히 네모가 나옴','게임이 검사한 `.fnt`와 다른 폰트·굵기로 그리거나, UI 랩 폰트를 폰트 파일 모드로 만들어 TTF에 없는 글자를 브라우저 대체 폰트가 그린 채로 구움','빌드에 실제로 들어가는 `.fnt` 확인, 글리프 시트에서 모양이 다른 글자 찾기','실제 배포하는 `.fnt`로 검사. Godot에서는 BMFont 가져오기 설정에 대체 폰트를 지정 가능'],
    ['줄 번호가 파일과 맞지 않음','원본 파일이 아니라 꺼낸 텍스트의 줄을 셈','`.po` 보고서의 2번 줄이 헤더 텍스트임','파일에서 그 글자 자체를 검색'],
    ['TTF·OTF를 글리프 출처로 고를 수 없음','이번 버전은 폰트의 cmap 표를 해석하지 않음','—','먼저 폰트로 `.fnt`를 만든 뒤 그것과 비교']]},
   versions:{body:['docs/UI-LAB.md를 위해 Chromium에서 측정했습니다. 글리프 4개짜리 `.fnt`로 `.po`를 검사하자 `a 시 작 끝 내 기`를 정확한 개수·줄 번호와 함께 보고했고, 폰트에 있는 `가`는 보고하지 않았습니다. 위 예시는 같은 함수로 다시 계산했으며, 헤더 항목 줄은 현재 파서의 동작 그대로입니다. `.fnt` 필드의 의미는 AngelCode BMFont 문서를, `.po` 구조는 GNU gettext 매뉴얼을 따릅니다.'],sources:[S.bmfont,S.gettext,S.bmImporter]}
  },
  ja:{
   answer:'韓国語・日本語の文字があるはずの場所に四角（□）や空白が出るのは、フォントにそのコードポイントのグリフがないからです。ビットマップフォントには焼き込んだ文字しかなく、`.fnt`にはグリフごとに`char id=`の行が1つあります。チェッカーは`.po`（`msgstr`の値）、`.json`、`.csv`・`.tsv`、`.txt`から訳文を取り出し、異なる文字を1つずつ`.fnt`（またはUIラボのフォントステージで作ったフォント）と比べ、欠けた文字ごとにUnicodeのコードポイント・使用回数・最初に出る行を示します。TTFの文字マップはまだ読めません。',
   concept:{title:'文字が四角になる理由',body:[
    'すべての文字はUnicodeのコードポイントで、BMFontはそれを10進数で保存します。韓国語の`시`はU+C2DCで、`.fnt`には`char id=49884`と書かれます。チェックは単純な集合の比較で、テキストに出てくる異なる文字からフォントの`char id`を引くだけです。文字体系が大きいため、韓国語・日本語のゲーム用フォントは実際に使う文字列から作ります。ハングルの完成形音節U+AC00〜U+D7A3は11,172コードポイント、CJK統合漢字のブロックU+4E00〜U+9FFFは20,992コードポイントあります。',
    'よくある原因は、フォントを焼いた後に更新された翻訳、原文の言語で作ったフォント、見た目が同じでコードポイントが違う文字（全角の`！` U+FF01と`!` U+0021）、そして分解されたハングルです。分解形では`가`が1つの音節（U+AC00）ではなく字母U+1100 U+1161として届きます。チェッカーはコードポイントを厳密に比べるので、これらをすべて報告します。',
    'ファイルごとに何を読むかが重要です。`.po`からは`msgstr`（と`msgstr[n]`）の値だけを読み、原文のキー`msgid`は読みませんが、ヘッダー項目の`msgstr`（`Language:`、`Content-Type:`）もテキストとして数えます。JSONはすべての文字列値、CSV・TSVはキーや原文の列を含むすべてのセルを読みます。ノーブレークスペースU+00A0や全角スペースU+3000を含む空白文字は、グリフとして描かないので飛ばします。']},
   example:{title:'例：韓国語の.poと4グリフの.fnt',lead:'フォントは시・작・끝・내から焼いたものです。このファイルに対してチェッカーが返す結果です。',lines:[
    'ko.po (9行)                             font.fnt (グリフ4つ)',
    'msgid ""                                char id=49884   시 U+C2DC',
    'msgstr ""                               char id=51089   작 U+C791',
    '"Language: ko\\n"                        char id=45149   끝 U+B05D',
    'msgid "Start"  →  msgstr "시작"         char id=45236   내 U+B0B4',
    'msgid "Quit"   →  msgstr "끝내기"',
    '',
    'チェックした文  "Language: ko" / "시작" / "끝내기"   （msgidの値は読まない）',
    '欠けている文字  기 U+AE30 ×1   （テキスト5行目）',
    '                a ×2, g ×2, :, L, e, k, n, o, u   （ヘッダー項目、テキスト2行目）',
    '追加するもの    기 = 0xAE30 = 44592 → 作り直したフォントに "char id=44592" が必要'],
    after:'ラテン文字は翻訳ではなくヘッダー項目から来ています。フォントにASCIIを入れる（多くのゲームはどのみち数字とラテン文字が必要です）か、それらの行を無視してください。ここで本当に欠けているのは`기`です。'},
   verify:{steps:[
    '文字を追加してフォントを作り直したら、もう一度チェックします。欠落なしと表示され、チェックした異なる文字の数が出るはずです。',
    '`missing-glyphs.json`を開きます。各項目に`char`、`U+XXXX`形式の`codepoint`、`count`、`lines`があり、`missing-glyphs.txt`は同じ文字を1行にまとめたもので、フォントツールの文字欄にそのまま貼れます。',
    'ゲーム内で、言語ファイルのすべての文字を含むテスト用の文字列を1つ表示します。四角や空白が1つも残らないはずです。']},
   mapping:{title:'チェックするテキストの出どころ',head:['ファイル','読むもの','無視するもの'],rows:[
    ['`.po`','`msgstr`と`msgstr[n]`の値と続きの行（ヘッダー項目も含む）','`msgid`、`msgctxt`、コメント'],
    ['`.json`','深さに関係なくすべての文字列値','オブジェクトのキー、数値、真偽値'],
    ['`.csv` / `.tsv`','すべての行のすべてのセル（見出し行とキー列を含む）','区切り文字と引用符'],
    ['`.txt`または貼り付けたテキスト','すべて','改行とその他の空白'],
    ['`.fnt`（グリフの出どころ）','すべての`char`行の`id`','カーニング、ページ、メトリクス']]},
   trouble:{rows:[
    ['韓国語・日本語の.poなのにラテン文字（L、a、n、g…）が欠落と出る','ヘッダー項目の`msgstr`（`Language:`、`Content-Type:`）をテキストとして読んでいる','行番号が取り出したテキストの最初の行を指している','フォントにASCIIを入れるか、それらの行を無視する'],
    ['CSVの英語の原文列が報告される','キー列・原文列を含め、CSV・TSVのすべてのセルを読んでいる','欠けた文字の大半がラテン文字で、すべての行に出てくる','対象言語の列だけを書き出すか、そのテキストを貼り付ける'],
    ['あるように見える文字が欠落と出る','コードポイントが違うそっくりな文字（全角の`！`、`～`、別のダッシュ）','レポートの`U+`コードと`.fnt`のidを比べる','そのコードポイントをフォントに追加するか、書き出す前にテキストを正規化する'],
    ['フォントにあるハングル音節が欠落と出る','テキストが分解形で、音節ではなく字母U+1100〜U+11FFになっている','レポートに`U+11xx`のコードが並ぶ','ローカライズの工程で文字列をNFCに正規化する'],
    ['欠落はないのにゲームでは四角が出る','ゲームがチェックした`.fnt`とは別のフォント・太さで描いている、またはUIラボのフォントをフォントファイルモードで作り、TTFにない文字をブラウザーの代替フォントで描いたまま焼き込んだ','ビルドに実際に入る`.fnt`を確認し、グリフシートで形の違う文字を探す','実際に配布する`.fnt`でチェックする。GodotではBMFontのインポート設定に代替フォントを指定できる'],
    ['行番号がファイルと合わない','元のファイルではなく、取り出したテキストの行を数えている','`.po`のレポートの2行目はヘッダーのテキスト','ファイル内でその文字自体を検索する'],
    ['TTF・OTFをグリフの出どころに選べない','このリリースはフォントのcmap表を解析しない','—','先にフォントから`.fnt`を作り、それと比べる']]},
   versions:{body:['docs/UI-LAB.mdのためにChromiumで測定しました。4グリフの`.fnt`で`.po`をチェックすると`a 시 작 끝 내 기`を正しい件数と行番号で報告し、フォントにある`가`は報告しませんでした。上の例は同じ関数で計算し直したもので、ヘッダー項目の行は現在のパーサーの動作どおりです。`.fnt`のフィールドの意味はAngelCode BMFontのドキュメント、`.po`の構造はGNU gettextのマニュアルに基づきます。'],sources:[S.bmfont,S.gettext,S.bmImporter]}
  }
 },
 'game/ui-scale-preview':{
  type:'tool',
  intent:{primary:'preview a game UI element at real resolutions, aspect ratios, safe areas and UI scales',secondary:['integer vs fractional UI scale for pixel art','title-safe and action-safe areas','WCAG contrast ratio of a button label','text overflow in Korean, English and Japanese'],
   goal:'know before building whether the element stays crisp, inside the safe area, readable and big enough for its text',input:'one UI element PNG (the checks also work without an image)',output:'on-screen measurements (no file)',target:'any engine; anchor numbers follow Godot 4 Control anchors',support:'partial',
   evidence:['src/game/ui-layout.js (ANCHORS, anchoredRect, SAFE_AREAS, safeRect, SCREENS, ASPECTS, SCALES, wrap, textFit)','src/game/contrast.js','src/task/ui-lab.js paintScales/paintText','docs/UI-LAB.md §5 and verification rows 19–22'],
   external:['W3C WCAG 2.2 contrast ratio and relative luminance','EBU R 95 safe areas','Godot 4.7 multiple resolutions (integer scale mode)','Unity Screen.safeArea, Godot DisplayServer.get_display_safe_area']},
  en:{
   answer:'The preview draws your panel or button inside a simulated 1280 × 720 to 3840 × 2160 screen (4:3, 16:9, 16:10 or 21:9), places it with Godot-style anchors, overlays a 90 % title-safe or 93 % / 95 % action-safe area, and shows it at 1×, 1.25×, 1.5×, 1.75×, 2×, 2.5× and 3×: integer scales keep pixel art crisp, fractional ones soften it. The same Check stage measures Korean, English and Japanese labels against a box and computes the WCAG contrast ratio (white on black is 21:1). It is arithmetic in the browser, not an engine layout pass.',
   concept:{title:'Scale, safe areas and contrast in numbers',body:[
    'At an integer scale every source pixel becomes a whole block of screen pixels: at 2× a 16 px icon is 32 px and each pixel is 2 × 2. At 1.5× two source pixels have to cover three screen pixels, so with nearest filtering the columns alternate between 1 and 2 px wide, and with linear filtering neighbouring colours blend into a soft edge; the preview draws fractional scales smoothed. Godot 4.2 and later have a stretch scale mode Integer that rounds the scale factor down (2.5 becomes 2), which its documentation recommends for pixel-art games together with the viewport stretch mode.',
    'Safe areas come from television: EBU R 95 (version 1.1, 2017) keeps essential action 3.5 % and graphics 5 % in from every edge, which is the 93 % action-safe and 90 % title-safe rectangle the preview draws; the 95 % preset is an extra, looser option and not part of R 95. Phones and consoles report their own safe area at run time instead (Unity `Screen.safeArea` in pixels, Godot `DisplayServer.get_display_safe_area()`), so those are entered here as custom insets rather than shipped as presets.',
    'Contrast uses the WCAG 2.2 formula: each sRGB channel is linearised, relative luminance is L = 0.2126 R + 0.7152 G + 0.0722 B, and the ratio is (L1 + 0.05) ÷ (L2 + 0.05) with the lighter colour first, from 1:1 to 21:1. Success Criterion 1.4.3 asks for 4.5:1 for text and 3:1 for large text (18 pt, or 14 pt bold; the preview uses 24 px and 18.66 px), 1.4.6 for 7:1, and 1.4.11 for 3:1 on the visual parts of UI components. A ratio describes two flat colours; text over artwork has a different ratio at every pixel.'],
    terms:[['Integer scale','A scale factor that is a whole number, so each source pixel covers an exact block of screen pixels.'],['Title-safe (graphics safe)','The inner 90 % of the frame: 5 % margin on every side in EBU R 95.'],['Action-safe','The inner 93 % of the frame: 3.5 % margin on every side in EBU R 95.'],['Relative luminance','The brightness of a colour from 0 (black) to 1 (white) after linearising sRGB, used for the contrast ratio.'],['Anchor','Where an element is pinned in its parent, as four numbers from 0 to 1 (left, top, right, bottom).']]},
   example:{title:'Example: the numbers the Check stage computes',lead:'Every value below comes from the same functions the preview uses:',lines:[
    'contrast   L = 0.2126 R + 0.7152 G + 0.0722 B   (sRGB linearised first)',
    'white/black        (1.00 + 0.05) / (0.00 + 0.05) = 21.0 : 1',
    '#767676 on white   L = 0.1812 → 1.05 / 0.2312 = 4.54 : 1   passes 4.5:1 by 0.04',
    'white on #3182f6   L = 0.2327 → 1.05 / 0.2827 = 3.71 : 1   UI 3:1 and large text: yes · 16 px text AA: no',
    'safe 1920×1080     title-safe 90 % → x 96, y 54, 1728 × 972   action-safe 93 % → x 67, y 38, 1786 × 1004',
    'anchor             bottom-right, 300 × 80 button, 32 px margin → x = 1920 − 300 − 32 = 1588, y = 1080 − 80 − 32 = 968',
    'scale              base 640 × 360 → 1920 × 1080 is exactly 3×;  1366 × 768 is 2.13× → Integer mode draws 2× (1280 × 720)'],
    after:'The default colours of the contrast tab are white on `#3182f6`: fine for a large label or an icon, too low for 16 px body text. At 1920 × 1080 EBU R 95 itself gives 67 px as 3.5 % of the width, the same number the preview draws.'},
   verify:{steps:[
    'Scale strip: pixel art at 2× and 3× should keep hard edges; if the 1.5× version is unacceptable, plan for integer steps or a base resolution that divides your target screens.',
    'Sizes tab: the element\'s rectangle stays inside the safe-area numbers on every aspect ratio you ship, including 21:9.',
    'Localisation tab: every language reads "fits" (or "wraps" where your UI allows wrapping); then repeat with your game font, because the preview measures a browser font.',
    'Contrast tab: body-text labels reach at least 4.5:1, large labels and icons at least 3:1.']},
   trouble:{rows:[
    ['Pixel-art UI looks blurry on some monitors','The UI is drawn at a fractional scale (for example 2.13× on 1366 × 768) with linear filtering','Compare the 1.5× and 2× cells of the scale strip','In Godot use the viewport stretch mode with the Integer scale mode and Nearest filtering; see [[game/godot-pixel-art-blurry|blurry pixel art in Godot]]'],
    ['A label fits in the preview but overflows in the game','The preview measured the text with a browser font; the game font has other widths','Measure the same string with the game font (the Font stage builds one)','Leave spare width, allow wrapping, or shorten the translation'],
    ['Korean or Japanese breaks in the middle of a word','Text without spaces is broken per character by the preview\'s greedy line breaker','Look at where the line ends in the Localisation tab','Accept per-character breaks, or insert explicit breaks; engines have their own line-breaking rules'],
    ['An element leaves the safe area only on 21:9','It is anchored to a screen edge, and the wider frame moves that edge','Switch the aspect to 21:9 with the safe area on','Add a margin at least as large as the safe-area inset, or anchor inside a safe-area container'],
    ['The contrast passes but the label is hard to read over art','The ratio compares two flat colours, and the art behind the text varies','Measure the lightest and darkest pixels behind the text','Put a backing panel, an outline or a shadow behind the label']]},
   alternatives:{rows:[
    ['Run the scene in the engine at each target resolution','You need the real layout: containers, size flags, theme margins and the engine\'s own text rendering.'],
    ['[[game/pixel-perfect-checker|Pixel-perfect checker]]','You have a screenshot from the game and want to know whether it was scaled by a whole number.']]},
   limits:['No engine layout pass: containers, size flags and theme margins are not modelled, only the anchor arithmetic.','No console or phone presets: those safe areas are device-specific and go in custom insets.','Text widths come from a browser font, not your game font.'],
   versions:{body:['Measured in Chromium for docs/UI-LAB.md: title-safe at 3840 × 2160 is 192, 108 · 3456 × 1944; a top-left anchor with a 64 px margin lands at 64, 64; a 120 px box makes an English label overflow while the Korean sample fits; black on white is exactly 21:1 and `#767676` on white 4.54:1. The example values were recomputed with the same functions. Safe-area percentages follow EBU R 95, the contrast formula WCAG 2.2, the integer scale mode the Godot 4.7 documentation.'],sources:[S.wcag,S.ebu,S.resolutions,S.unitySafe,S.displayServer]}
  },
  ko:{
   answer:'미리보기는 패널이나 버튼을 1280 × 720부터 3840 × 2160까지(4:3·16:9·16:10·21:9) 가상 화면 안에 그리고, Godot 방식 앵커로 배치하며, 90% 타이틀 세이프나 93%·95% 액션 세이프 영역을 겹쳐 보이고, 1×·1.25×·1.5×·1.75×·2×·2.5×·3×로 보여 줍니다. 정수 배율은 픽셀 아트를 선명하게 유지하고 비정수 배율은 흐리게 만듭니다. 같은 점검 단계에서 한국어·영어·일본어 라벨이 상자에 들어가는지 재고 WCAG 대비(검정 위 흰색 21:1)를 계산합니다. 브라우저 안의 계산이며 엔진의 레이아웃 처리가 아닙니다.',
   concept:{title:'배율·안전 영역·대비를 숫자로',body:[
    '정수 배율에서는 원본 픽셀 하나가 화면 픽셀 덩어리 하나가 됩니다. 2×에서 16px 아이콘은 32px이고 픽셀마다 2 × 2입니다. 1.5×에서는 원본 픽셀 두 개가 화면 픽셀 세 개를 덮어야 하므로, 최근접 필터면 열 너비가 1px과 2px로 번갈아 나오고 선형 필터면 이웃 색이 섞여 가장자리가 흐려집니다. 미리보기는 비정수 배율을 부드럽게 그립니다. Godot 4.2 이상에는 배율을 내림하는(2.5가 2가 되는) 스트레치 배율 모드 Integer가 있고, 문서는 픽셀 아트 게임에 viewport 스트레치 모드와 함께 이를 권합니다.',
    '안전 영역은 텔레비전에서 왔습니다. EBU R 95(버전 1.1, 2017)는 중요한 동작을 모든 가장자리에서 3.5%, 그래픽을 5% 안쪽에 두도록 하며, 이것이 미리보기가 그리는 93% 액션 세이프와 90% 타이틀 세이프 사각형입니다. 95% 프리셋은 더 느슨한 추가 옵션으로 R 95에 없는 값입니다. 휴대폰과 콘솔은 실행 중에 자기 안전 영역을 알려 주므로(Unity `Screen.safeArea`는 픽셀 단위, Godot `DisplayServer.get_display_safe_area()`), 여기서는 프리셋이 아니라 사용자 여백으로 입력합니다.',
    '대비는 WCAG 2.2 공식을 씁니다. sRGB 채널을 선형으로 바꾼 뒤 상대 휘도 L = 0.2126 R + 0.7152 G + 0.0722 B를 구하고, 밝은 색을 앞에 두어 (L1 + 0.05) ÷ (L2 + 0.05)로 비율을 냅니다. 범위는 1:1부터 21:1입니다. 성공 기준 1.4.3은 텍스트 4.5:1, 큰 텍스트(18pt 또는 굵은 14pt, 미리보기에서는 24px·18.66px) 3:1을, 1.4.6은 7:1을, 1.4.11은 UI 컴포넌트의 시각 요소에 3:1을 요구합니다. 비율은 단색 두 개에 대한 값이라 그림 위 글자는 픽셀마다 비율이 다릅니다.'],
    terms:[['정수 배율','배율이 정수여서 원본 픽셀 하나가 화면 픽셀 덩어리 하나를 정확히 덮는 경우.'],['타이틀 세이프(그래픽 세이프)','화면 안쪽 90%. EBU R 95에서 모든 변에 5% 여백.'],['액션 세이프','화면 안쪽 93%. EBU R 95에서 모든 변에 3.5% 여백.'],['상대 휘도','sRGB를 선형으로 바꾼 뒤 0(검정)~1(흰색)로 나타낸 색의 밝기. 대비 계산에 씀.'],['앵커','요소가 부모 안 어디에 고정되는지를 0~1 숫자 네 개(왼쪽·위·오른쪽·아래)로 나타낸 것.']]},
   example:{title:'예시: 점검 단계가 계산하는 숫자',lead:'아래 값은 모두 미리보기와 같은 함수로 계산했습니다.',lines:[
    '대비       L = 0.2126 R + 0.7152 G + 0.0722 B   (먼저 sRGB 선형화)',
    '흰색/검정          (1.00 + 0.05) / (0.00 + 0.05) = 21.0 : 1',
    '#767676 / 흰색     L = 0.1812 → 1.05 / 0.2312 = 4.54 : 1   4.5:1을 0.04 차이로 통과',
    '흰색 / #3182f6     L = 0.2327 → 1.05 / 0.2827 = 3.71 : 1   UI 3:1·큰 텍스트: 통과 · 16px 텍스트 AA: 미달',
    '안전 1920×1080     타이틀 90% → x 96, y 54, 1728 × 972   액션 93% → x 67, y 38, 1786 × 1004',
    '앵커               오른쪽 아래, 300 × 80 버튼, 여백 32px → x = 1920 − 300 − 32 = 1588, y = 1080 − 80 − 32 = 968',
    '배율               기준 640 × 360 → 1920 × 1080은 정확히 3×;  1366 × 768은 2.13× → Integer 모드는 2×(1280 × 720)로 그림'],
    after:'대비 탭의 기본 색은 `#3182f6` 위 흰색입니다. 큰 라벨이나 아이콘에는 괜찮지만 16px 본문 텍스트에는 부족합니다. 1920 × 1080에서 EBU R 95도 너비의 3.5%를 67px로 적고 있어 미리보기가 그리는 값과 같습니다.'},
   verify:{steps:[
    '배율 비교: 2×와 3×의 픽셀 아트는 가장자리가 딱딱해야 합니다. 1.5× 결과가 받아들일 수 없다면 정수 단계나 목표 화면을 나누어떨어지게 하는 기준 해상도를 계획하세요.',
    '크기 탭: 배포할 모든 화면비(21:9 포함)에서 요소 사각형이 안전 영역 숫자 안에 있어야 합니다.',
    '현지화 탭: 모든 언어가 "fits"(줄바꿈을 허용하는 UI라면 "wraps")여야 합니다. 미리보기는 브라우저 폰트로 재므로 게임 폰트로 한 번 더 확인하세요.',
    '대비 탭: 본문 크기 라벨은 4.5:1 이상, 큰 라벨과 아이콘은 3:1 이상이어야 합니다.']},
   trouble:{rows:[
    ['픽셀 아트 UI가 일부 모니터에서 흐림','UI가 비정수 배율(예: 1366 × 768에서 2.13×)과 선형 필터로 그려짐','배율 비교의 1.5×와 2× 칸을 비교','Godot에서는 viewport 스트레치 모드와 Integer 배율 모드, Nearest 필터 사용. [[game/godot-pixel-art-blurry|Godot 픽셀 아트 흐림]] 참고'],
    ['미리보기에서는 맞는데 게임에서 라벨이 넘침','미리보기는 브라우저 폰트로 쟀고 게임 폰트는 폭이 다름','같은 문자열을 게임 폰트로 재기(폰트 단계에서 만들 수 있음)','여유 폭을 두거나, 줄바꿈을 허용하거나, 번역을 줄이기'],
    ['한국어·일본어가 단어 중간에서 끊김','공백이 없는 텍스트는 미리보기의 탐욕적 줄바꿈이 글자 단위로 끊음','현지화 탭에서 줄이 끝나는 위치 확인','글자 단위 줄바꿈을 받아들이거나 명시적으로 줄을 나누기. 엔진은 자체 줄바꿈 규칙이 있음'],
    ['21:9에서만 요소가 안전 영역을 벗어남','화면 가장자리에 앵커를 걸었는데 넓은 화면에서 그 가장자리가 이동함','안전 영역을 켜고 화면비를 21:9로 전환','안전 영역 여백 이상의 여백을 주거나, 안전 영역 컨테이너 안에 앵커 걸기'],
    ['대비는 통과했는데 그림 위 라벨이 읽기 어려움','비율은 단색 두 개를 비교하고 글자 뒤 그림은 변함','글자 뒤에서 가장 밝은 픽셀과 가장 어두운 픽셀을 측정','라벨 뒤에 받침 패널·외곽선·그림자 넣기']]},
   alternatives:{rows:[
    ['엔진에서 목표 해상도마다 씬 실행','실제 레이아웃이 필요할 때: 컨테이너, 크기 플래그, 테마 여백, 엔진 자체의 텍스트 렌더링.'],
    ['[[game/pixel-perfect-checker|픽셀 퍼펙트 검사]]','게임 스크린샷이 있고 정수배로 확대됐는지 알고 싶을 때.']]},
   limits:['엔진 레이아웃 처리가 아닙니다. 컨테이너·크기 플래그·테마 여백은 모델링하지 않고 앵커 계산만 합니다.','콘솔·휴대폰 프리셋은 없습니다. 기기마다 다른 안전 영역은 사용자 여백으로 넣습니다.','텍스트 폭은 게임 폰트가 아니라 브라우저 폰트로 잰 값입니다.'],
   versions:{body:['docs/UI-LAB.md를 위해 Chromium에서 측정했습니다. 3840 × 2160의 타이틀 세이프는 192, 108 · 3456 × 1944, 여백 64px의 왼쪽 위 앵커는 64, 64에 놓였고, 120px 상자에서 영어 라벨은 넘치고 한국어 예시는 들어갔으며, 흰 바탕 검정은 정확히 21:1, `#767676`/흰색은 4.54:1이었습니다. 예시 값은 같은 함수로 다시 계산했습니다. 안전 영역 비율은 EBU R 95, 대비 공식은 WCAG 2.2, 정수 배율 모드는 Godot 4.7 공식 문서를 따릅니다.'],sources:[S.wcag,S.ebu,S.resolutions,S.unitySafe,S.displayServer]}
  },
  ja:{
   answer:'プレビューはパネルやボタンを1280 × 720から3840 × 2160までの仮想画面（4:3・16:9・16:10・21:9）に描き、Godot式のアンカーで配置し、90%のタイトルセーフや93%・95%のアクションセーフを重ね、1×・1.25×・1.5×・1.75×・2×・2.5×・3×で表示します。整数倍はピクセルアートをくっきり保ち、非整数倍はぼかします。同じチェックステージで韓国語・英語・日本語のラベルが枠に収まるかを測り、WCAGのコントラスト比（黒地に白で21:1）を計算します。ブラウザ内の計算で、エンジンのレイアウト処理ではありません。',
   concept:{title:'スケール・セーフエリア・コントラストを数値で',body:[
    '整数倍では元の1ピクセルが画面ピクセルのかたまり1つになります。2×では16pxのアイコンが32pxになり、各ピクセルは2 × 2です。1.5×では元の2ピクセルで画面の3ピクセルを覆う必要があるため、最近傍フィルターでは列の幅が1pxと2pxで交互になり、線形フィルターでは隣の色が混ざって縁がぼやけます。プレビューは非整数倍をなめらかに描きます。Godot 4.2以降には倍率を切り捨てる（2.5が2になる）ストレッチのスケールモードIntegerがあり、ドキュメントはピクセルアートのゲームにviewportのストレッチモードと組み合わせて勧めています。',
    'セーフエリアはテレビ由来です。EBU R 95（バージョン1.1、2017年）は重要な動きをすべての端から3.5%、グラフィックを5%内側に置くよう定めており、これがプレビューの描く93%のアクションセーフと90%のタイトルセーフの矩形です。95%のプリセットはよりゆるい追加の選択肢で、R 95の値ではありません。スマートフォンやコンソールは実行時に自分のセーフエリアを返すので（Unityの`Screen.safeArea`はピクセル単位、Godotの`DisplayServer.get_display_safe_area()`）、ここではプリセットではなく任意の余白として入力します。',
    'コントラストはWCAG 2.2の式を使います。sRGBの各チャンネルを線形化し、相対輝度L = 0.2126 R + 0.7152 G + 0.0722 Bを求め、明るい色を先にして(L1 + 0.05) ÷ (L2 + 0.05)で比を出します。範囲は1:1から21:1です。達成基準1.4.3はテキストに4.5:1、大きいテキスト（18ポイント、または太字14ポイント。プレビューでは24px・18.66px）に3:1、1.4.6は7:1、1.4.11はUIコンポーネントの視覚的な部分に3:1を求めます。比は2つの単色についての値で、絵の上の文字はピクセルごとに比が変わります。'],
    terms:[['整数倍','倍率が整数で、元の1ピクセルが画面ピクセルのかたまりをちょうど覆う状態。'],['タイトルセーフ（グラフィックセーフ）','画面の内側90%。EBU R 95ではすべての辺に5%の余白。'],['アクションセーフ','画面の内側93%。EBU R 95ではすべての辺に3.5%の余白。'],['相対輝度','sRGBを線形化したあと0（黒）〜1（白）で表した色の明るさ。コントラスト比に使う。'],['アンカー','要素を親のどこに固定するかを0〜1の4つの数値（左・上・右・下）で表したもの。']]},
   example:{title:'例：チェックステージが計算する数値',lead:'以下の値はすべてプレビューと同じ関数で計算しています。',lines:[
    'コントラスト  L = 0.2126 R + 0.7152 G + 0.0722 B   （先にsRGBを線形化）',
    '白/黒              (1.00 + 0.05) / (0.00 + 0.05) = 21.0 : 1',
    '#767676 / 白       L = 0.1812 → 1.05 / 0.2312 = 4.54 : 1   4.5:1を0.04差で満たす',
    '白 / #3182f6       L = 0.2327 → 1.05 / 0.2827 = 3.71 : 1   UI 3:1・大きいテキスト：可 · 16pxのテキストAA：不可',
    'セーフ 1920×1080   タイトル90% → x 96, y 54, 1728 × 972   アクション93% → x 67, y 38, 1786 × 1004',
    'アンカー           右下、300 × 80のボタン、余白32px → x = 1920 − 300 − 32 = 1588, y = 1080 − 80 − 32 = 968',
    'スケール           基準640 × 360 → 1920 × 1080はちょうど3×；1366 × 768は2.13× → Integerモードは2×（1280 × 720）で描く'],
    after:'コントラストタブの既定の色は`#3182f6`の上の白です。大きいラベルやアイコンには十分ですが、16pxの本文には足りません。1920 × 1080ではEBU R 95自身も幅の3.5%を67pxとしており、プレビューの値と同じです。'},
   verify:{steps:[
    'スケール比較：2×と3×のピクセルアートは縁が硬いままのはずです。1.5×の結果が許容できなければ、整数刻みか、目標の画面を割り切れる基準解像度を計画してください。',
    'サイズタブ：出荷するすべての画面比（21:9を含む）で、要素の矩形がセーフエリアの数値の内側にあるはずです。',
    'ローカライズタブ：すべての言語が"fits"（折り返しを許すUIなら"wraps"）であるべきです。プレビューはブラウザーのフォントで測るので、ゲームのフォントでもう一度確認してください。',
    'コントラストタブ：本文サイズのラベルは4.5:1以上、大きいラベルとアイコンは3:1以上であるべきです。']},
   trouble:{rows:[
    ['ピクセルアートのUIが一部のモニターでぼやける','UIが非整数倍（例：1366 × 768で2.13×）と線形フィルターで描かれている','スケール比較の1.5×と2×の枠を比べる','Godotではviewportのストレッチモード、Integerのスケールモード、Nearestフィルターを使う。[[game/godot-pixel-art-blurry|Godotでピクセルアートがぼやける]]を参照'],
    ['プレビューでは収まるのにゲームでラベルがあふれる','プレビューはブラウザーのフォントで測り、ゲームのフォントは幅が違う','同じ文字列をゲームのフォントで測る（フォントステージで作れる）','幅に余裕を持たせる、折り返しを許す、または訳を短くする'],
    ['韓国語・日本語が単語の途中で切れる','空白のないテキストは、プレビューの貪欲な改行が1文字単位で切る','ローカライズタブで行の終わる位置を確認','1文字単位の改行を受け入れるか、明示的に改行を入れる。エンジンには独自の改行規則がある'],
    ['21:9でだけ要素がセーフエリアからはみ出す','画面の端にアンカーを付けており、横長の画面でその端が動く','セーフエリアを表示して画面比を21:9に切り替える','セーフエリアの余白以上のマージンを付けるか、セーフエリアのコンテナ内にアンカーを付ける'],
    ['コントラストは合格なのに絵の上のラベルが読みにくい','比は2つの単色を比べるもので、文字の後ろの絵は変化している','文字の後ろで最も明るいピクセルと最も暗いピクセルを測る','ラベルの後ろに下地のパネル・アウトライン・影を入れる']]},
   alternatives:{rows:[
    ['エンジンで目標解像度ごとにシーンを実行する','実際のレイアウトが必要なとき：コンテナ、サイズフラグ、テーマの余白、エンジン自身の文字描画。'],
    ['[[game/pixel-perfect-checker|ピクセルパーフェクトチェッカー]]','ゲームのスクリーンショットがあり、整数倍で拡大されたかを知りたいとき。']]},
   limits:['エンジンのレイアウト処理ではありません。コンテナ・サイズフラグ・テーマの余白はモデル化せず、アンカーの計算だけです。','コンソール・スマートフォンのプリセットはありません。機種ごとのセーフエリアは任意の余白として入れます。','テキストの幅はゲームのフォントではなくブラウザーのフォントで測った値です。'],
   versions:{body:['docs/UI-LAB.mdのためにChromiumで測定しました。3840 × 2160のタイトルセーフは192, 108 · 3456 × 1944、余白64pxの左上アンカーは64, 64に置かれ、120pxの枠で英語のラベルはあふれて韓国語の例は収まり、白地に黒はちょうど21:1、`#767676`/白は4.54:1でした。例の値は同じ関数で計算し直しています。セーフエリアの割合はEBU R 95、コントラストの式はWCAG 2.2、整数のスケールモードはGodot 4.7の公式ドキュメントに基づきます。'],sources:[S.wcag,S.ebu,S.resolutions,S.unitySafe,S.displayServer]}
  }
 },
 'bitmap-font-maker':{
  type:'create',
  intent:{primary:'make a bitmap font (.fnt + .png) from a glyph sheet or a TTF/OTF',secondary:['BMFont text format fields','character sets for Korean or Japanese','SDF bitmap font','load .fnt in Godot, PixiJS or Phaser'],
   goal:'font.png + font.fnt that a BMFont-reading engine draws with the right spacing',input:'a glyph sheet PNG in a fixed grid, or a TTF/OTF file from the device',output:'font.png + font.fnt (BMFont text) + font.json + README.txt (+ font-sdf.png/.json/.txt)',target:'Godot 4 (BMFont import), PixiJS 8; Phaser needs the XML variant (engine import not tested)',support:'partial',
   evidence:['src/game/bmfont.js (gridFont, measuredFont, fntText, parseFnt, charset)','src/game/sdf.js','src/task/ui-lab.js buildFont/renderTTFSheet/exportFont/buildSDFSheet','docs/UI-LAB.md §4 and verification rows 13–17, 25–26','docs/SEO-KEYWORDS.md §6 and nerulio-handoff START-HERE (font-file mode issues)'],
   external:['AngelCode BMFont file format','Godot 4.7 bitmap fonts and ResourceImporterBMFont','PixiJS 8 BitmapText','Phaser LoaderPlugin.bitmapFont (XML)']},
  en:{
   answer:'A bitmap font is a PNG of glyphs plus a table that says where each character is and how far the pen moves after it. The maker builds that table from a fixed-grid sheet (every glyph is its whole cell), from the same sheet with widths measured from the ink, or from a TTF/OTF rendered on your device, and writes `font.png`, a BMFont text `font.fnt` (`info`, `common`, `page`, `chars`, one `char` line per glyph, `kernings count=0`) and `font.json`, optionally with an SDF texture (Beta). Godot 4 imports `.fnt` directly and PixiJS 8 loads it; Phaser\'s loader expects the XML variant. Engine import was not tested.',
   concept:{title:'What a .fnt file says, line by line',body:[
    '`info` names the face and size and records padding and spacing. `common` holds `lineHeight` (the distance in pixels between two lines of text), `base` (pixels from the top of a line to the baseline), `scaleW` and `scaleH` (the texture size) and `pages`. `page id=0 file="font.png"` names the texture, relative to the `.fnt`. Each `char` line gives `id` (the Unicode code point in decimal), `x y width height` (the glyph\'s rectangle in the texture), `xoffset yoffset` (where to draw that rectangle relative to the pen position and the top of the line) and `xadvance` (how far the pen moves afterwards). `kerning first second amount` lines adjust particular pairs; Nerulio writes none, because a bitmap sheet carries no kerning data.',
    'To draw a string an engine starts the pen at x = 0, and for every character copies its rectangle to (pen + xoffset, line top + yoffset) and adds xadvance to the pen; the next line starts lineHeight lower. In the fixed-grid mode every advance is the cell width, which suits monospaced pixel fonts. The measured mode keeps only each cell\'s opaque pixels (alpha above 8), puts them back with the offsets and advances by the ink\'s right edge plus the glyph spacing; an empty cell such as the space still advances.',
    'Character sets decide the atlas size. ASCII is 95 characters (U+0020–U+007E) and Latin-1 191; precomposed Hangul alone is 11,172 syllables and the main CJK ideograph block 20,992 code points, so the Korean and Japanese presets take only the characters that occur in text you paste. A signed distance field (SDF) stores, per texel, the distance to the glyph\'s edge instead of its coverage, so a shader can cut a sharp edge at other sizes; Nerulio encodes 128 as the edge and `spread` pixels of distance across the byte range, computes the exact distance per glyph at 4× resolution, and ships a single-channel SDF, not MSDF.'],
    terms:[['lineHeight','Pixels from one line of text to the next.'],['base','Pixels from the top of a line down to the baseline.'],['xoffset / yoffset','Where the glyph rectangle is drawn relative to the pen and the line top.'],['xadvance','How far the pen moves after the glyph.'],['SDF spread','How many pixels of distance the 0–255 range covers; 128 is the glyph edge.']]},
   example:{title:'Example: the same three glyphs in grid and measured mode',lead:'A 24 × 8 sheet with 8 × 8 cells for `A`, `i` and a space, baseline 7. These are the lines the maker writes:',lines:[
    'common    lineHeight=8 base=7 scaleW=24 scaleH=8 pages=1',
    'grid      char id=65  x=0  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    '          char id=105 x=8  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    'measured  char id=65  x=1  y=1 width=5 height=6 xoffset=1 yoffset=1 xadvance=7   (1 + 5 + spacing 1)',
    '          char id=105 x=11 y=1 width=1 height=6 xoffset=3 yoffset=1 xadvance=5   (3 + 1 + 1)',
    '          char id=32  x=16 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=3   (empty cell: round(8 ÷ 3))',
    'draw "iA i" measured   i at 0 + 3 = 3 → pen 5;  A at 5 + 1 = 6 → pen 12;  space → pen 15;  i at 18 → width 20 px',
    'draw "iA i" grid       4 glyphs × 8 = 32 px'],
    after:'The measured font sets `i` 5 px apart instead of 8, which is why proportional text looks natural. `font.json` carries the same numbers as `glyphs[].xAdvance`, `xOffset` and `yOffset`.'},
   target:{title:'Load the font in an engine',steps:[
    'Keep `font.fnt` and `font.png` together: the `page` line names the PNG by a relative file name, so rename both or neither.',
    'Godot 4: copy both files into the project; Godot imports the `.fnt` as a bitmap font. Assign it to a Label or other Control as its font theme override. Bitmap fonts have a fixed design size, so draw pixel fonts at that size or whole multiples.',
    'PixiJS 8: `await Assets.load(\'font.fnt\')`, then create `new BitmapText({ text, style: { fontFamily: \'Nerulio Grid\' } })` — the family is the `face` in the `info` line (Nerulio Grid, Nerulio Measured, or Nerulio plus your font file name).',
    'Phaser: `this.load.bitmapFont(key, \'font.png\', \'font.xml\')` expects BMFont data as XML. Nerulio writes the text variant, so convert `font.fnt` to XML with a BMFont-compatible tool first.']},
   verify:{steps:[
    'Open `font.fnt` in a text editor: `chars count` equals the number of `char` lines, and every rectangle lies inside `scaleW × scaleH`.',
    'The sample line under the sheet is drawn with the font\'s own metrics: letters that overlap or drift apart there will do the same in the engine.',
    'Run the [[game/missing-glyph-checker|missing glyph checker]] with your localisation file against this font before shipping.']},
   trouble:{rows:[
    ['The engine loads the font but shows nothing','`font.png` was renamed or moved away from the `.fnt`','The `page id=0 file=` line and the actual file name','Put the PNG next to the `.fnt` with the name the page line gives'],
    ['Phaser fails to parse the font','Phaser\'s `load.bitmapFont` expects the XML variant of BMFont','The console error when the loader parses the data','Convert the text `.fnt` to XML, or use Godot or PixiJS, which read the text variant'],
    ['Letters touch or sit too far apart in measured mode','The glyph spacing value, or faint pixels above alpha 8 widening a glyph\'s ink box','Compare `xadvance` of a narrow and a wide glyph in the `.fnt`','Change the glyph spacing, or clean faint pixels off the sheet'],
    ['Font-file mode: `info size` is larger than the size you chose','The size written is the cell height (ascent + descent + padding), not the font size you typed','Compare `info size` with the Font size field','Where an engine uses `size`, set it by hand to the size you rendered'],
    ['Font-file mode: some letters look like another typeface','A character your TTF lacks was drawn by the browser\'s fallback font and baked into the sheet','Look at the glyph sheet for letters in a different style','Remove those characters, or pick a font file that contains them'],
    ['Font-file mode: a pixel font comes out blurry','Canvas text is anti-aliased, so edges get partial alpha','Zoom into the sheet: grey edge pixels','Draw the pixel font as a sheet and use the grid or measured mode'],
    ['Grid mode says the character order does not fit','More characters than cells, a repeated character, or an empty order','Columns × rows of the sheet against the number of characters','Remove duplicates or use a larger sheet; a strip narrower than a cell at the edge is ignored']]},
   alternatives:{rows:[
    ['Godot\'s own image-font import (import type Font Data (Image Font))','The font is only for Godot and the sheet is in a simple order: no extra files, and the import dock also takes character ranges, margins and kerning pairs.'],
    ['AngelCode BMFont or another BMFont-compatible generator','You need kerning pairs, several texture pages, outlines or XML/binary output, which this maker does not write.'],
    ['A dynamic font (the TTF itself) in the engine','Text size changes a lot or the language needs thousands of glyphs; Godot documents MSDF rendering for dynamic fonts, not for bitmap fonts.']]},
   limits:['One texture page, no kerning pairs, no MSDF; the SDF output is Beta and was not rendered by an engine shader.','Font-file mode writes the cell height as `info size`, bakes anti-aliased text, and fills characters missing from the TTF with the browser\'s fallback font.','Import into Godot, PixiJS or Phaser was not tested; the steps follow their documentation.'],
   versions:{body:['Measured in Chromium for docs/UI-LAB.md: a fixed-grid font writes `char id=12354 x=8 y=0 width=8 height=8` for あ in a 16 × 8 `font.png`; an independent parser in the test read the `.fnt` header and every glyph record back equal to the JSON; measured mode gives tight rects, at least three distinct advances and an advancing empty cell; an ASCII-95 atlas at 32 px from a TTF built in 28 ms (350 × 380 sheet) and its SDF in 1174 ms. The font-file issues listed above are known, unfixed issues of this release. BMFont fields follow the AngelCode documentation; engine loading follows Godot 4.7, PixiJS 8 and the Phaser API.'],sources:[S.bmfont,S.fonts,S.bmImporter,S.pixiBitmap,S.phaserLoader]}
  },
  ko:{
   answer:'비트맵 폰트는 글리프를 그린 PNG와, 각 글자가 어디 있고 그린 뒤 펜을 얼마나 옮기는지 적은 표로 이뤄집니다. 이 도구는 그 표를 고정 격자 시트(글리프마다 칸 전체), 잉크로 폭을 잰 같은 시트, 또는 기기에서 렌더링한 TTF/OTF로 만들고, `font.png`, BMFont 텍스트 `font.fnt`(`info`, `common`, `page`, `chars`, 글리프마다 `char` 한 줄, `kernings count=0`), `font.json`을 씁니다. SDF 텍스처(베타)도 선택할 수 있습니다. Godot 4는 `.fnt`를 바로 가져오고 PixiJS 8도 읽지만, Phaser 로더는 XML 형식을 요구합니다. 엔진 가져오기는 시험하지 않았습니다.',
   concept:{title:'.fnt 파일이 말하는 것, 한 줄씩',body:[
    '`info`는 글꼴 이름과 크기, 여백과 간격을 적습니다. `common`에는 `lineHeight`(텍스트 한 줄에서 다음 줄까지 픽셀), `base`(줄 맨 위에서 베이스라인까지 픽셀), `scaleW`·`scaleH`(텍스처 크기), `pages`가 있습니다. `page id=0 file="font.png"`는 `.fnt` 기준 상대 경로로 텍스처를 가리킵니다. `char` 줄마다 `id`(10진수 유니코드 코드 포인트), `x y width height`(텍스처 안 글리프 사각형), `xoffset yoffset`(펜 위치와 줄 맨 위 기준으로 그 사각형을 그릴 자리), `xadvance`(그 뒤 펜 이동 거리)가 있습니다. `kerning first second amount` 줄은 특정 글자 쌍을 조정하는데, 비트맵 시트에는 커닝 정보가 없어 Nerulio는 쓰지 않습니다.',
    '엔진은 문자열을 그릴 때 펜을 x = 0에서 시작해 글자마다 사각형을 (펜 + xoffset, 줄 맨 위 + yoffset)에 복사하고 펜에 xadvance를 더하며, 다음 줄은 lineHeight만큼 아래에서 시작합니다. 고정 격자 모드에서는 모든 전진 폭이 칸 너비라 고정폭 픽셀 폰트에 맞습니다. 측정 모드는 칸마다 불투명 픽셀(알파 8 초과)만 남기고 오프셋으로 원래 자리에 되돌리며, 잉크 오른쪽 끝에 글리프 간격을 더한 만큼 전진합니다. 공백처럼 빈 칸도 전진합니다.',
    '문자 집합이 아틀라스 크기를 정합니다. ASCII는 95자(U+0020~U+007E), Latin-1은 191자이고, 완성형 한글만 11,172음절, 주요 한중일 한자 블록은 20,992 코드 포인트이므로 한국어·일본어 프리셋은 붙여 넣은 텍스트에 실제로 나오는 글자만 가져옵니다. 부호 있는 거리장(SDF)은 텍셀마다 덮임 정도 대신 글리프 가장자리까지의 거리를 저장해, 셰이더가 다른 크기에서도 날카로운 경계를 자를 수 있게 합니다. Nerulio는 128을 가장자리로, `spread` 픽셀의 거리를 바이트 범위에 담고, 글리프마다 4배 해상도에서 정확한 거리를 계산하며, MSDF가 아닌 단일 채널 SDF를 만듭니다.'],
    terms:[['lineHeight','텍스트 한 줄에서 다음 줄까지의 픽셀.'],['base','줄 맨 위에서 베이스라인까지의 픽셀.'],['xoffset / yoffset','펜과 줄 맨 위를 기준으로 글리프 사각형을 그리는 위치.'],['xadvance','글리프를 그린 뒤 펜이 이동하는 거리.'],['SDF spread','0~255 범위가 담는 거리(픽셀). 128이 글리프 가장자리.']]},
   example:{title:'예시: 같은 글리프 세 개를 격자·측정 모드로',lead:'`A`, `i`, 공백을 위한 8 × 8 칸이 있는 24 × 8 시트, 베이스라인 7. 도구가 쓰는 줄입니다.',lines:[
    'common    lineHeight=8 base=7 scaleW=24 scaleH=8 pages=1',
    '격자      char id=65  x=0  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    '          char id=105 x=8  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    '측정      char id=65  x=1  y=1 width=5 height=6 xoffset=1 yoffset=1 xadvance=7   (1 + 5 + 간격 1)',
    '          char id=105 x=11 y=1 width=1 height=6 xoffset=3 yoffset=1 xadvance=5   (3 + 1 + 1)',
    '          char id=32  x=16 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=3   (빈 칸: round(8 ÷ 3))',
    '"iA i" 측정   i는 0 + 3 = 3 → 펜 5;  A는 5 + 1 = 6 → 펜 12;  공백 → 펜 15;  i는 18 → 너비 20px',
    '"iA i" 격자   글리프 4개 × 8 = 32px'],
    after:'측정 폰트는 `i`를 8px이 아니라 5px 간격으로 놓아 비례 텍스트가 자연스럽게 보입니다. `font.json`에도 같은 값이 `glyphs[].xAdvance`, `xOffset`, `yOffset`로 들어 있습니다.'},
   target:{title:'엔진에서 폰트 불러오기',steps:[
    '`font.fnt`와 `font.png`를 함께 두세요. `page` 줄이 PNG를 상대 파일 이름으로 가리키므로 이름을 바꾸려면 둘 다 바꿔야 합니다.',
    'Godot 4: 두 파일을 프로젝트에 복사하면 Godot가 `.fnt`를 비트맵 폰트로 가져옵니다. Label 등 Control의 폰트 테마 오버라이드에 지정하세요. 비트맵 폰트는 설계 크기가 고정이므로 픽셀 폰트는 그 크기나 정수배로 그리세요.',
    'PixiJS 8: `await Assets.load(\'font.fnt\')` 뒤 `new BitmapText({ text, style: { fontFamily: \'Nerulio Grid\' } })`를 만듭니다. family는 `info` 줄의 `face`입니다(Nerulio Grid, Nerulio Measured, 또는 Nerulio와 폰트 파일 이름).',
    'Phaser: `this.load.bitmapFont(key, \'font.png\', \'font.xml\')`는 BMFont 데이터를 XML로 요구합니다. Nerulio는 텍스트 형식을 쓰므로 먼저 BMFont 호환 도구로 `font.fnt`를 XML로 변환하세요.']},
   verify:{steps:[
    '텍스트 편집기로 `font.fnt`를 엽니다. `chars count`가 `char` 줄 수와 같고, 모든 사각형이 `scaleW × scaleH` 안에 있어야 합니다.',
    '시트 아래 예시 줄은 폰트 자신의 수치로 그립니다. 여기서 겹치거나 벌어지는 글자는 엔진에서도 그렇게 됩니다.',
    '배포 전에 현지화 파일로 이 폰트를 [[game/missing-glyph-checker|누락 글리프 검사]]에 돌려 보세요.']},
   trouble:{rows:[
    ['엔진이 폰트를 불러오는데 아무것도 안 보임','`font.png` 이름을 바꿨거나 `.fnt`와 다른 곳으로 옮김','`page id=0 file=` 줄과 실제 파일 이름','`page` 줄에 적힌 이름으로 PNG를 `.fnt` 옆에 두기'],
    ['Phaser가 폰트를 해석하지 못함','Phaser `load.bitmapFont`는 BMFont의 XML 형식을 요구함','로더가 데이터를 해석할 때의 콘솔 오류','텍스트 `.fnt`를 XML로 변환하거나, 텍스트 형식을 읽는 Godot·PixiJS 사용'],
    ['측정 모드에서 글자가 붙거나 너무 벌어짐','글리프 간격 값, 또는 알파 8을 넘는 흐린 픽셀이 잉크 상자를 넓힘','`.fnt`에서 좁은 글리프와 넓은 글리프의 `xadvance` 비교','글리프 간격을 바꾸거나 시트의 흐린 픽셀을 지우기'],
    ['폰트 파일 모드: `info size`가 고른 크기보다 큼','크기에 입력한 폰트 크기가 아니라 칸 높이(ascent + descent + 여백)를 씀','`info size`와 폰트 크기 칸 비교','엔진이 `size`를 쓰는 곳에서는 렌더링한 크기를 직접 지정'],
    ['폰트 파일 모드: 일부 글자가 다른 서체처럼 보임','TTF에 없는 글자를 브라우저 대체 폰트가 그려 시트에 구워 넣음','글리프 시트에서 모양이 다른 글자 찾기','그 글자를 빼거나, 그 글자가 있는 폰트 파일 고르기'],
    ['폰트 파일 모드: 픽셀 폰트가 흐리게 나옴','캔버스 텍스트는 안티앨리어싱되어 가장자리에 반투명 알파가 생김','시트를 확대하면 가장자리에 회색 픽셀','픽셀 폰트는 시트로 그려 격자·측정 모드 사용'],
    ['격자 모드에서 글자 순서가 격자에 맞지 않는다고 나옴','칸보다 글자가 많거나, 같은 글자가 반복되거나, 순서가 비어 있음','시트의 열 × 행과 글자 수 비교','중복을 빼거나 더 큰 시트 사용. 가장자리의 칸보다 좁은 띠는 무시됨']]},
   alternatives:{rows:[
    ['Godot 자체 이미지 폰트 가져오기(가져오기 유형 Font Data (Image Font))','Godot에서만 쓰고 시트 순서가 단순할 때. 추가 파일이 없고, 가져오기 독에서 문자 범위·여백·커닝 쌍도 지정할 수 있습니다.'],
    ['AngelCode BMFont 등 BMFont 호환 생성기','커닝 쌍, 여러 텍스처 페이지, 외곽선, XML·바이너리 출력이 필요할 때. 이 도구는 쓰지 않습니다.'],
    ['엔진에서 동적 폰트(TTF 자체) 사용','글자 크기가 크게 바뀌거나 수천 개 글리프가 필요한 언어일 때. Godot 문서는 MSDF 렌더링을 비트맵 폰트가 아닌 동적 폰트에 대해 설명합니다.']]},
   limits:['텍스처 페이지 1장, 커닝 쌍 없음, MSDF 없음. SDF 출력은 베타이며 엔진 셰이더로 그려 보지 않았습니다.','폰트 파일 모드는 `info size`에 칸 높이를 쓰고, 안티앨리어싱된 글자를 굽고, TTF에 없는 글자를 브라우저 대체 폰트로 채웁니다.','Godot·PixiJS·Phaser 가져오기는 시험하지 않았습니다. 위 단계는 각 공식 문서를 따릅니다.'],
   versions:{body:['docs/UI-LAB.md를 위해 Chromium에서 측정했습니다. 고정 격자 폰트는 16 × 8 `font.png`에서 あ를 `char id=12354 x=8 y=0 width=8 height=8`로 쓰고, 테스트 안의 독립 파서가 `.fnt` 헤더와 모든 글리프 레코드를 JSON과 같게 읽었습니다. 측정 모드는 딱 맞는 사각형, 세 가지 이상의 전진 폭, 전진하는 빈 칸을 만들었고, TTF에서 32px ASCII-95 아틀라스는 28ms(350 × 380 시트), SDF는 1174ms에 만들어졌습니다. 위의 폰트 파일 모드 문제는 이번 버전에서 아직 고치지 못한 알려진 문제입니다. BMFont 필드는 AngelCode 문서를, 엔진 불러오기는 Godot 4.7·PixiJS 8·Phaser API 문서를 따릅니다.'],sources:[S.bmfont,S.fonts,S.bmImporter,S.pixiBitmap,S.phaserLoader]}
  },
  ja:{
   answer:'ビットマップフォントは、グリフを描いたPNGと、各文字がどこにあり描いた後にペンをどれだけ進めるかを書いた表でできています。このツールはその表を、固定グリッドのシート（グリフごとにセル全体）、インクから幅を測った同じシート、または端末で描画したTTF/OTFから作り、`font.png`、BMFontテキスト形式の`font.fnt`（`info`、`common`、`page`、`chars`、グリフごとに`char`が1行、`kernings count=0`）、`font.json`を書き出します。SDFテクスチャ（ベータ）も選べます。Godot 4は`.fnt`を直接インポートし、PixiJS 8も読み込めますが、PhaserのローダーはXML形式を求めます。エンジンでの読み込みは試していません。',
   concept:{title:'.fntファイルが1行ずつ伝えること',body:[
    '`info`は書体名とサイズ、余白と間隔を記録します。`common`には`lineHeight`（テキストの1行から次の行までのピクセル）、`base`（行の上端からベースラインまでのピクセル）、`scaleW`・`scaleH`（テクスチャのサイズ）、`pages`があります。`page id=0 file="font.png"`は`.fnt`からの相対ファイル名でテクスチャを指します。`char`の各行は`id`（10進数のUnicodeコードポイント）、`x y width height`（テクスチャ内のグリフの矩形）、`xoffset yoffset`（ペンの位置と行の上端を基準にその矩形を描く位置）、`xadvance`（描いた後にペンが進む距離）です。`kerning first second amount`の行は特定の文字の組を調整しますが、ビットマップのシートにはカーニングの情報がないので、Nerulioは書きません。',
    '文字列を描くとき、エンジンはペンをx = 0から始め、文字ごとに矩形を(ペン + xoffset, 行の上端 + yoffset)にコピーしてペンにxadvanceを足し、次の行はlineHeightだけ下から始めます。固定グリッドモードでは送り幅がすべてセル幅なので、等幅のピクセルフォントに向きます。実測モードはセルごとに不透明なピクセル（アルファ8超）だけを残し、オフセットで元の位置に戻し、インクの右端にグリフ間隔を足した分だけ進めます。スペースのような空のセルも送り幅を持ちます。',
    '文字セットがアトラスの大きさを決めます。ASCIIは95文字（U+0020〜U+007E）、Latin-1は191文字で、完成形のハングルだけで11,172音節、主要なCJK統合漢字ブロックは20,992コードポイントあるため、韓国語・日本語のプリセットは貼り付けたテキストに実際に出てくる文字だけを取り出します。符号付き距離場（SDF）はテクセルごとに被覆率の代わりにグリフの縁までの距離を保存し、シェーダーが別のサイズでもくっきりした縁を切り出せるようにします。Nerulioは128を縁、`spread`ピクセル分の距離をバイトの範囲に割り当て、グリフごとに4倍の解像度で正確な距離を計算し、MSDFではない1チャンネルのSDFを出力します。'],
    terms:[['lineHeight','テキストの1行から次の行までのピクセル。'],['base','行の上端からベースラインまでのピクセル。'],['xoffset / yoffset','ペンと行の上端を基準に、グリフの矩形を描く位置。'],['xadvance','グリフを描いた後にペンが進む距離。'],['SDF spread','0〜255の範囲に割り当てる距離（ピクセル）。128がグリフの縁。']]},
   example:{title:'例：同じ3つのグリフをグリッドと実測で',lead:'`A`、`i`、スペース用の8 × 8セルを持つ24 × 8のシート、ベースライン7。ツールが書き出す行です。',lines:[
    'common    lineHeight=8 base=7 scaleW=24 scaleH=8 pages=1',
    'グリッド  char id=65  x=0  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    '          char id=105 x=8  y=0 width=8 height=8 xoffset=0 yoffset=0 xadvance=8',
    '実測      char id=65  x=1  y=1 width=5 height=6 xoffset=1 yoffset=1 xadvance=7   (1 + 5 + 間隔1)',
    '          char id=105 x=11 y=1 width=1 height=6 xoffset=3 yoffset=1 xadvance=5   (3 + 1 + 1)',
    '          char id=32  x=16 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=3   (空のセル：round(8 ÷ 3))',
    '"iA i" 実測     iは0 + 3 = 3 → ペン5；Aは5 + 1 = 6 → ペン12；スペース → ペン15；iは18 → 幅20px',
    '"iA i" グリッド グリフ4つ × 8 = 32px'],
    after:'実測フォントは`i`を8pxではなく5px間隔で置くので、プロポーショナルな文字が自然に見えます。`font.json`にも同じ値が`glyphs[].xAdvance`、`xOffset`、`yOffset`として入っています。'},
   target:{title:'エンジンでフォントを読み込む',steps:[
    '`font.fnt`と`font.png`は一緒に置いてください。`page`の行がPNGを相対ファイル名で指しているので、名前を変えるなら両方変えます。',
    'Godot 4：2つのファイルをプロジェクトにコピーすると、Godotが`.fnt`をビットマップフォントとしてインポートします。LabelなどControlのフォントのテーマオーバーライドに割り当てます。ビットマップフォントはデザインサイズが固定なので、ピクセルフォントはそのサイズか整数倍で描いてください。',
    'PixiJS 8：`await Assets.load(\'font.fnt\')`のあと`new BitmapText({ text, style: { fontFamily: \'Nerulio Grid\' } })`を作ります。familyは`info`行の`face`です（Nerulio Grid、Nerulio Measured、またはNerulioとフォントファイル名）。',
    'Phaser：`this.load.bitmapFont(key, \'font.png\', \'font.xml\')`はBMFontのデータをXMLで求めます。Nerulioはテキスト形式を書くので、先にBMFont互換のツールで`font.fnt`をXMLに変換してください。']},
   verify:{steps:[
    'テキストエディターで`font.fnt`を開きます。`chars count`が`char`の行数と同じで、すべての矩形が`scaleW × scaleH`の内側にあるはずです。',
    'シートの下のサンプル行はフォント自身の値で描いています。ここで重なったり離れたりする文字は、エンジンでも同じようになります。',
    '出荷前に、ローカライズファイルでこのフォントを[[game/missing-glyph-checker|欠落グリフチェッカー]]にかけてください。']},
   trouble:{rows:[
    ['エンジンがフォントを読み込むが何も表示されない','`font.png`の名前を変えた、または`.fnt`と別の場所に移した','`page id=0 file=`の行と実際のファイル名','`page`の行に書かれた名前でPNGを`.fnt`の隣に置く'],
    ['Phaserがフォントを解析できない','Phaserの`load.bitmapFont`はBMFontのXML形式を求める','ローダーがデータを解析するときのコンソールのエラー','テキストの`.fnt`をXMLに変換するか、テキスト形式を読めるGodot・PixiJSを使う'],
    ['実測モードで文字がくっつく・離れすぎる','グリフ間隔の値、またはアルファ8を超える薄いピクセルがインクの箱を広げている','`.fnt`で細いグリフと太いグリフの`xadvance`を比べる','グリフ間隔を変えるか、シートの薄いピクセルを消す'],
    ['フォントファイルモード：`info size`が選んだサイズより大きい','入力したフォントサイズではなく、セルの高さ（ascent + descent + 余白）を書いている','`info size`とフォントサイズの欄を比べる','エンジンが`size`を使う箇所では、描画したサイズを手で指定する'],
    ['フォントファイルモード：一部の文字が別の書体に見える','TTFにない文字をブラウザーの代替フォントが描き、シートに焼き込んだ','グリフシートで形の違う文字を探す','その文字を外すか、その文字を含むフォントファイルを選ぶ'],
    ['フォントファイルモード：ピクセルフォントがぼやける','Canvasの文字はアンチエイリアスされ、縁に半透明のアルファが出る','シートを拡大すると縁にグレーのピクセル','ピクセルフォントはシートとして描き、グリッドか実測モードを使う'],
    ['グリッドモードで文字順がグリッドに収まらないと出る','セルより文字が多い、同じ文字が重複している、または順序が空','シートの列 × 行と文字数を比べる','重複を消すか大きいシートを使う。端にあるセルより狭い帯は無視される']]},
   alternatives:{rows:[
    ['Godot自身の画像フォントのインポート（インポートの種類 Font Data (Image Font)）','Godotだけで使い、シートの並びが単純なとき。追加ファイルが不要で、インポートドックで文字範囲・余白・カーニングペアも指定できます。'],
    ['AngelCode BMFontなどBMFont互換のジェネレーター','カーニングペア、複数のテクスチャページ、アウトライン、XML・バイナリ出力が必要なとき。このツールはそれらを書き出しません。'],
    ['エンジンで動的フォント（TTFそのもの）を使う','文字サイズが大きく変わる、または数千のグリフが必要な言語のとき。GodotのドキュメントはMSDF描画をビットマップフォントではなく動的フォントについて説明しています。']]},
   limits:['テクスチャは1ページ、カーニングペアなし、MSDFなし。SDF出力はベータで、エンジンのシェーダーで描いていません。','フォントファイルモードは`info size`にセルの高さを書き、アンチエイリアスされた文字を焼き込み、TTFにない文字をブラウザーの代替フォントで埋めます。','Godot・PixiJS・Phaserでの読み込みは試していません。手順は各公式ドキュメントに基づきます。'],
   versions:{body:['docs/UI-LAB.mdのためにChromiumで測定しました。固定グリッドのフォントは16 × 8の`font.png`で、あを`char id=12354 x=8 y=0 width=8 height=8`と書き、テスト内の独立したパーサーが`.fnt`のヘッダーと全グリフの記録をJSONと同じ値で読み戻しました。実測モードはぴったりの矩形、3種類以上の送り幅、送り幅を持つ空のセルを作り、TTFからの32pxのASCII-95アトラスは28ms（350 × 380のシート）、SDFは1174msで作られました。上のフォントファイルモードの問題は、このリリースで未修正の既知の問題です。BMFontのフィールドはAngelCodeのドキュメント、エンジンでの読み込みはGodot 4.7・PixiJS 8・PhaserのAPIドキュメントに基づきます。'],sources:[S.bmfont,S.fonts,S.bmImporter,S.pixiBitmap,S.phaserLoader]}
  }
 },
 'game/seamless-tile-checker':{
  type:'tool',
  intent:{primary:'check whether a texture or tile repeats without a visible seam, and fix it',secondary:['measure the wrap edges','seamless texture test with a 2×2 / 3×3 repeat','make a texture tileable'],
   goal:'a per-axis verdict with numbers, and a healed PNG when the seam is real',input:'one texture or tile (PNG, WebP, JPEG, GIF), or a tile of a sheet',output:'on-screen measurements + <name>-<index>-seamless.png',target:'any engine or 3D tool that repeats a texture',support:'full',
   evidence:['src/game/seams.js (seamReport, makeSeamless, edgeMatch, heatmap)','docs/TILE-LAB.md §6 and the seam verdict row of its verification table','tests/game-seams.test.mjs','src/task/tile-lab.js saveHealed'],
   external:[]},
  en:{
   answer:'A texture tiles without a visible seam when its right column continues into its left column and its bottom row into its top row. The checker measures exactly those wrap pairs and reports each axis next to the same difference taken between ordinary neighbouring lines inside the tile, because "mean 23" only means something compared with the texture\'s own variation. It shows 2 × 2 and 3 × 3 repeats, a heatmap along each edge and a verdict per axis, and can make the tile seamless by offsetting it half a tile and cross-fading, which changes the art inside the blend bands.',
   concept:{title:'How a seam is measured',body:[
    'For every row the checker compares the last pixel with the first (the horizontal wrap), and for every column the bottom pixel with the top one (the vertical wrap). The difference of two pixels is the largest of their four channel differences, alpha included, on the 0–255 scale. Each axis gets a mean and a worst value, plus a per-line profile for the heatmap.',
    'The reference is the mean difference between every pair of adjacent columns (or rows) inside the tile. An axis passes when its wrap mean is at most max(2, 1.25 × that neighbour mean), and the tile is called seamless when both axes pass. That is why a noisy stone texture whose wrap differs by 21 levels passes (its neighbours differ by 21 too) while a smooth gradient with a jump of 252 fails (its neighbours differ by 4). The heatmap is scaled against the same neighbour mean, so a seamless tile stays dark instead of being normalised to bright red.',
    'Make seamless offsets the tile by half its width and height, so the old wrap edges meet in the middle, then cross-fades a band on each side of that middle line with the half-shifted copy, using smooth weights. The band defaults to 12 % of the tile (8 px on a 64 px tile) and can be set from 0 to 64 px. The new edges wrap by construction; the price is a blended cross through the middle, where large features can appear doubled. Nothing is synthesised.'],
    terms:[['Wrap pair','The two lines that touch when the tile repeats: last column and first column, bottom row and top row.'],['Neighbour mean','The average difference between adjacent lines inside the tile, the texture\'s own variation.'],['Ratio','Wrap mean ÷ neighbour mean; around 1 is invisible, 63 is a hard seam.'],['Blend band','The strip on each side of the moved seam that is cross-faded by Make seamless.']]},
   example:{title:'Example: a gradient that fails and a noise tile that passes',lead:'Both tiles are 64 × 64. The numbers are what the checker reports:',lines:[
    'ramp tile       grey 0 → 252 from left to right (+4 per column), all rows identical',
    'horizontal      column 63 (252) against column 0 (0): mean 252, worst 252',
    'neighbour mean  4.00 → ratio 252 / 4 = 63; limit max(2, 4 × 1.25) = 5 → seam',
    'vertical        rows identical: wrap 0, neighbours 0 → passes',
    'make seamless   offset 32, 32; band round(64 × 0.12) = 8 px → wrap mean 4, neighbours 5.78, ratio 0.69 → seamless',
    'noise tile      values 96–160: wrap mean 20.8 / 18.8, neighbour mean 21.5 → ratio 0.97 / 0.87 → seamless'],
    after:'The noise tile has a larger wrap difference than the healed ramp and still passes, because its interior varies just as much. A single threshold on the raw number would get both of these wrong.'},
   verify:{steps:[
    'Look at the centre of the 3 × 3 repeat at 100 % and 200 %: no line, no step in brightness and no change of texture density along its borders.',
    'Read both axes: each ratio near 1 or below; the heatmap has no bright band along a whole edge.',
    'After Make seamless, compare before and after inside the blend bands for doubled features, and check the verdict again.',
    'Put the downloaded PNG on a large repeating surface in your engine and move the camera across a seam.']},
   trouble:{rows:[
    ['The checker says seamless but a line shows in the game','The engine clamps instead of repeating, or mipmaps and compression change the edge texels','Compare the 3 × 3 preview with the game at the same zoom; test with mipmaps off','Set the texture to repeat/wrap in the engine\'s sampler settings; check the compressed texture'],
    ['A seam is flagged on a sprite with a transparent border','Alpha counts in the difference, and a transparent edge against an opaque one is a real jump','Is the tile meant to repeat at all?','Ignore the result for sprites; the check is for repeating textures and tiles'],
    ['Make seamless leaves a blurry or doubled cross in the middle','The cross-fade mixes two different parts of the texture inside the band','Compare before and after around the middle lines','Try a narrower band under Advanced, or repaint the middle in an image editor'],
    ['The tile passes but the surface looks obviously repeated','Distinct features recur at the tile period: that is repetition, not a seam','Look at the 3 × 3 preview from a distance','Use a larger texture, several tile variants, or break the pattern with decals']]},
   alternatives:{rows:[
    ['Offset the image by half in an image editor and repaint the cross by hand','The seam needs real painting (a crack or a plank edge) rather than a blend.'],
    ['Export the texture with tiling from the tool that generated it','A procedural or material tool made the texture: its own tiling option avoids healing afterwards. For normal maps see [[game/tiling-normal-map-seams|seams in tiling normal maps]].']]},
   limits:['The verdict measures pixel differences at the wrap; it does not detect visible repetition or lighting that changes across the tile.','Only the healed PNG is written; the measurements stay on screen.'],
   versions:{body:['Measured for docs/TILE-LAB.md and in `tests/game-seams.test.mjs`: a cosine tile that wraps gives a ratio below 1.3 and is reported seamless; a ramp gives a mean above 240 and a ratio above 20 and is reported as a seam; after Make seamless the mean falls below 8. The worked example above was recomputed with the same module (a 64 px ramp and a seeded noise tile).']}
  },
  ko:{
   answer:'텍스처가 이음새 없이 반복되려면 오른쪽 끝 열이 왼쪽 첫 열로, 맨 아래 행이 맨 위 행으로 이어져야 합니다. 검사기는 바로 그 경계 쌍을 재고, 축마다 타일 안 평범한 이웃 줄 사이의 같은 차이와 나란히 보고합니다. "평균 23"은 텍스처 자체의 변화와 비교할 때만 의미가 있기 때문입니다. 2 × 2·3 × 3 반복, 가장자리 히트맵, 축별 판정을 보여 주고, 반 타일 이동 후 교차 혼합으로 이음새를 없앨 수도 있는데 이때 혼합 띠 안의 그림이 바뀝니다.',
   concept:{title:'이음새를 재는 방법',body:[
    '검사기는 행마다 마지막 픽셀과 첫 픽셀(가로 경계), 열마다 맨 아래 픽셀과 맨 위 픽셀(세로 경계)을 비교합니다. 두 픽셀의 차이는 알파를 포함한 네 채널 차이 중 가장 큰 값(0~255)입니다. 축마다 평균과 최대값, 히트맵용 줄별 값이 나옵니다.',
    '기준은 타일 안에서 이웃한 모든 열(또는 행) 쌍 사이의 평균 차이입니다. 경계 평균이 max(2, 1.25 × 이웃 평균) 이하면 그 축은 통과이고, 두 축이 모두 통과하면 이음새 없음으로 판정합니다. 그래서 경계 차이가 21단계인 거친 돌 텍스처는 통과하고(이웃도 21만큼 다름), 252만큼 튀는 부드러운 그라데이션은 실패합니다(이웃은 4만큼 다름). 히트맵도 같은 이웃 평균으로 눈금을 맞추므로 이음새 없는 타일이 새빨갛게 칠해지지 않고 어둡게 남습니다.',
    '이음새 없애기는 타일을 가로·세로 절반만큼 옮겨 기존 경계가 가운데에서 만나게 한 뒤, 그 가운데 선 양쪽 띠를 반 칸 옮긴 복사본과 부드러운 가중치로 교차 혼합합니다. 띠는 기본 타일의 12%(64px 타일이면 8px)이고 0~64px로 정할 수 있습니다. 새 경계는 구조상 이어지지만, 대신 가운데에 섞인 십자가 생기고 큰 무늬가 겹쳐 보일 수 있습니다. 새로 그려 넣는 것은 없습니다.'],
    terms:[['경계 쌍','타일이 반복될 때 맞닿는 두 줄: 마지막 열과 첫 열, 맨 아래 행과 맨 위 행.'],['이웃 평균','타일 안 이웃한 줄 사이의 평균 차이. 텍스처 자체의 변화.'],['비율','경계 평균 ÷ 이웃 평균. 1 근처면 보이지 않고 63이면 뚜렷한 이음새.'],['혼합 띠','옮겨진 이음새 양쪽에서 이음새 없애기가 교차 혼합하는 띠.']]},
   example:{title:'예시: 실패하는 그라데이션과 통과하는 노이즈 타일',lead:'두 타일 모두 64 × 64입니다. 검사기가 보고하는 숫자입니다.',lines:[
    '램프 타일      회색 0 → 252, 왼쪽에서 오른쪽으로(열마다 +4), 모든 행 동일',
    '가로           63번 열(252)과 0번 열(0): 평균 252, 최대 252',
    '이웃 평균      4.00 → 비율 252 / 4 = 63; 한계 max(2, 4 × 1.25) = 5 → 이음새',
    '세로           행이 모두 같음: 경계 0, 이웃 0 → 통과',
    '이음새 없애기  이동 32, 32; 띠 round(64 × 0.12) = 8px → 경계 평균 4, 이웃 5.78, 비율 0.69 → 이음새 없음',
    '노이즈 타일    값 96~160: 경계 평균 20.8 / 18.8, 이웃 평균 21.5 → 비율 0.97 / 0.87 → 이음새 없음'],
    after:'노이즈 타일은 고친 램프보다 경계 차이가 크지만 내부도 그만큼 변하므로 통과합니다. 날것의 숫자 하나에 임계값을 걸면 두 경우를 모두 틀리게 판정합니다.'},
   verify:{steps:[
    '3 × 3 반복의 가운데를 100%와 200%로 봅니다. 경계를 따라 선, 밝기 단차, 질감 밀도 변화가 없어야 합니다.',
    '두 축을 모두 읽습니다. 비율이 1 근처나 그 이하이고, 히트맵에 한 변 전체를 따라 밝은 띠가 없어야 합니다.',
    '이음새 없애기 뒤에는 혼합 띠 안에서 무늬가 겹치지 않는지 전후를 비교하고 판정을 다시 확인합니다.',
    '받은 PNG를 엔진의 넓은 반복 표면에 입히고 카메라를 이음새 위로 움직여 봅니다.']},
   trouble:{rows:[
    ['검사기는 이음새 없음인데 게임에서 선이 보임','엔진이 반복 대신 가장자리 고정(clamp)으로 샘플링하거나, 밉맵·압축이 가장자리 텍셀을 바꿈','같은 확대에서 3 × 3 미리보기와 게임 비교, 밉맵을 끄고 시험','엔진 샘플러 설정에서 텍스처를 반복(wrap)으로, 압축된 텍스처도 확인'],
    ['가장자리가 투명한 스프라이트에 이음새가 잡힘','차이에 알파가 포함되고, 투명한 가장자리와 불투명한 가장자리는 실제로 크게 다름','이 타일이 반복될 용도인지 확인','스프라이트라면 결과를 무시. 이 검사는 반복 텍스처와 타일용'],
    ['이음새 없애기 뒤 가운데에 흐리거나 겹친 십자가 남음','교차 혼합이 띠 안에서 텍스처의 서로 다른 부분을 섞음','가운데 선 주변의 전후 비교','고급 설정에서 띠를 좁히거나, 이미지 편집기에서 가운데를 다시 그리기'],
    ['통과했는데 표면이 누가 봐도 반복돼 보임','눈에 띄는 무늬가 타일 주기로 되풀이됨. 이음새가 아니라 반복 문제','3 × 3 미리보기를 멀리서 보기','더 큰 텍스처, 여러 변형 타일, 데칼로 무늬를 깨기']]},
   alternatives:{rows:[
    ['이미지 편집기에서 절반 이동 후 십자 부분을 직접 다시 그리기','혼합이 아니라 실제로 그려야 하는 이음새(균열, 판자 경계)일 때.'],
    ['텍스처를 만든 도구에서 타일링 옵션으로 내보내기','절차적 도구나 재질 도구로 만든 텍스처일 때. 도구 자체의 타일링으로 나중에 고칠 필요가 없습니다. 노멀맵은 [[game/tiling-normal-map-seams|반복 노멀맵의 이음새]] 참고.']]},
   limits:['판정은 경계의 픽셀 차이를 잽니다. 눈에 띄는 반복이나 타일 안에서 바뀌는 조명은 찾지 못합니다.','고친 PNG만 저장되며 측정값은 화면에만 표시됩니다.'],
   versions:{body:['docs/TILE-LAB.md와 `tests/game-seams.test.mjs`에서 측정했습니다. 이어지는 코사인 타일은 비율 1.3 미만으로 이음새 없음, 램프는 평균 240 초과·비율 20 초과로 이음새 있음이었고, 이음새 없애기 뒤 평균은 8 미만으로 떨어졌습니다. 위 예시는 같은 모듈로 다시 계산했습니다(64px 램프와 시드 고정 노이즈 타일).']}
  },
  ja:{
   answer:'テクスチャが継ぎ目なく繰り返せるのは、右端の列が左端の列に、最下行が最上行につながるときです。チェッカーはまさにその境界のペアを測り、軸ごとにタイル内のふつうの隣接行どうしの差と並べて報告します。「平均23」はテクスチャ自体の変化と比べて初めて意味を持つからです。2 × 2・3 × 3のリピート、縁のヒートマップ、軸ごとの判定を表示し、半タイルずらしてクロスフェードすることで継ぎ目を消すこともできますが、その場合ブレンド帯の中の絵が変わります。',
   concept:{title:'継ぎ目の測り方',body:[
    'チェッカーは行ごとに最後のピクセルと最初のピクセル（横の境界）、列ごとに最下のピクセルと最上のピクセル（縦の境界）を比べます。2つのピクセルの差は、アルファを含む4チャンネルの差のうち最大の値（0〜255）です。軸ごとに平均と最大、ヒートマップ用の行ごとの値が出ます。',
    '基準はタイル内で隣り合うすべての列（または行）のペアの平均差です。境界の平均がmax(2, 1.25 × 隣接の平均)以下ならその軸は合格で、両方の軸が合格すれば継ぎ目なしと判定します。だから境界の差が21段階ある粗い石のテクスチャは合格し（隣どうしも21違う）、252跳ぶなめらかなグラデーションは不合格になります（隣どうしは4しか違わない）。ヒートマップも同じ隣接の平均で目盛りを合わせるので、継ぎ目のないタイルが真っ赤に塗られず暗いままです。',
    'シームレス化はタイルを幅と高さの半分ずらして元の境界を中央で出会わせ、その中央線の両側の帯を半分ずらしたコピーとなめらかな重みでクロスフェードします。帯の既定はタイルの12%（64pxのタイルなら8px）で、0〜64pxに設定できます。新しい境界は構造上つながりますが、代わりに中央にブレンドされた十字ができ、大きな模様が二重に見えることがあります。新たに描き足すものはありません。'],
    terms:[['境界のペア','タイルを繰り返したときに接する2本の線：最後の列と最初の列、最下行と最上行。'],['隣接の平均','タイル内で隣り合う線どうしの平均差。テクスチャ自体の変化。'],['比','境界の平均 ÷ 隣接の平均。1前後なら見えず、63ならはっきりした継ぎ目。'],['ブレンド帯','移動した継ぎ目の両側で、シームレス化がクロスフェードする帯。']]},
   example:{title:'例：不合格のグラデーションと合格のノイズタイル',lead:'どちらのタイルも64 × 64です。チェッカーが報告する数値です。',lines:[
    'ランプタイル    グレー 0 → 252、左から右へ（列ごとに+4）、全行同じ',
    '横              63列目(252)と0列目(0)：平均252、最大252',
    '隣接の平均      4.00 → 比 252 / 4 = 63；上限 max(2, 4 × 1.25) = 5 → 継ぎ目あり',
    '縦              全行同じ：境界0、隣接0 → 合格',
    'シームレス化    ずらし32, 32；帯 round(64 × 0.12) = 8px → 境界平均4、隣接5.78、比0.69 → 継ぎ目なし',
    'ノイズタイル    値96〜160：境界平均 20.8 / 18.8、隣接の平均21.5 → 比0.97 / 0.87 → 継ぎ目なし'],
    after:'ノイズタイルは修正後のランプより境界の差が大きいのに、内部も同じくらい変化しているので合格します。生の数値1つにしきい値を置くと、この2つをどちらも誤判定します。'},
   verify:{steps:[
    '3 × 3リピートの中央を100%と200%で見ます。境界に沿って線、明るさの段差、質感の密度の変化がないはずです。',
    '両方の軸を読みます。比が1前後かそれ以下で、ヒートマップに辺全体に沿った明るい帯がないはずです。',
    'シームレス化の後は、ブレンド帯の中で模様が二重になっていないか前後を比べ、判定をもう一度確認します。',
    'ダウンロードしたPNGをエンジンの広い繰り返し面に貼り、カメラを継ぎ目の上で動かしてみます。']},
   trouble:{rows:[
    ['チェッカーは継ぎ目なしなのにゲームで線が見える','エンジンが繰り返しではなく端の固定（clamp）でサンプリングしている、またはミップマップや圧縮が縁のテクセルを変えている','同じ拡大率で3 × 3プレビューとゲームを比べ、ミップマップを切って試す','エンジンのサンプラー設定でテクスチャを繰り返し（wrap）にし、圧縮後のテクスチャも確認する'],
    ['縁が透明なスプライトに継ぎ目が出る','差にはアルファも含まれ、透明な縁と不透明な縁は実際に大きく違う','そのタイルが繰り返す用途かを確認','スプライトなら結果は無視する。このチェックは繰り返すテクスチャとタイル向け'],
    ['シームレス化の後、中央にぼやけた・二重の十字が残る','クロスフェードが帯の中でテクスチャの別々の部分を混ぜている','中央線の周りで前後を比べる','詳細設定で帯を狭くするか、画像エディターで中央を描き直す'],
    ['合格したのに面が明らかに繰り返して見える','目立つ模様がタイルの周期で繰り返されている。継ぎ目ではなく繰り返しの問題','3 × 3プレビューを離れて見る','大きいテクスチャ、複数のバリエーションタイル、デカールで模様を崩す']]},
   alternatives:{rows:[
    ['画像エディターで半分ずらし、十字の部分を手で描き直す','ブレンドではなく本当に描く必要がある継ぎ目（ひび、板の境目）のとき。'],
    ['テクスチャを作ったツールのタイリング設定で書き出す','プロシージャルや素材のツールで作ったテクスチャのとき。ツール自身のタイリングなら後から直す必要がありません。ノーマルマップは[[game/tiling-normal-map-seams|繰り返すノーマルマップの継ぎ目]]を参照。']]},
   limits:['判定は境界のピクセル差を測ります。目立つ繰り返しや、タイル内で変わるライティングは検出しません。','保存されるのは修正したPNGだけで、測定値は画面上に表示されます。'],
   versions:{body:['docs/TILE-LAB.mdと`tests/game-seams.test.mjs`で測定しました。つながるコサインのタイルは比1.3未満で継ぎ目なし、ランプは平均240超・比20超で継ぎ目ありと判定され、シームレス化の後は平均が8未満に下がりました。上の例は同じモジュールで計算し直したものです（64pxのランプとシード固定のノイズタイル）。']}
  }
 },
 'tile-grid-slicer':{
  type:'tool',
  intent:{primary:'split a tileset or grid image into one PNG per tile',secondary:['find tile size, margin and spacing','tile position math','when engines need single tile files'],
   goal:'tiles/tile-NNN.png exact region copies plus metadata.json with each tile\'s rect, column and row',input:'a tileset or any grid image',output:'ZIP: tiles/tile-NNN.png + metadata.json (+ variants/, padded-atlas.png)',target:'tools that take one file per tile; engines that read the whole sheet use the same margin and spacing',support:'full',
   evidence:['src/game/tile-grid.js (tileRects, tileName, sliceMetadata, axis ranking)','src/task/tile-lab.js slice()','docs/TILE-LAB.md §1–2 and verification rows (grid detection 10/10, 13/13 tiles byte-identical, 1600 tiles in 2.2 s)'],
   external:['Godot 4.7 TileSetAtlasSource margins/separation','Tiled tileset types','Phaser addTilesetImage tileMargin/tileSpacing','Unity Sprite Editor grid slicing']},
  en:{
   answer:'Cutting a tileset into single images takes three numbers per axis: the tile size, the margin (pixels before the first tile) and the spacing (pixels between tiles). The slicer measures them from the pixels and ranks the candidates, you confirm or type them, and it writes `tiles/tile-NNN.png` as exact region copies plus `metadata.json` with each tile\'s rect, column and row. Blank tiles are skipped by default and duplicates can be reported as aliases. Most engines read the whole sheet with the same margin and spacing, so single files are only needed when a tool asks for them.',
   concept:{title:'Tile size, margin and spacing',body:[
    'Tile n in column c and row r starts at x = margin + c × (tile width + spacing) and y = margin + r × (tile height + spacing). The number of columns that fit is floor((image width − margin + spacing) ÷ (tile width + spacing)); pixels left over at the right or bottom edge are ignored. Each tile is copied out of the decoded sheet as an exact rectangle, never resampled.',
    'Measurement looks for the period of the art: per axis it builds the difference between each line and the one before, folds that profile at every period from 4 px to half the image and scores how well each fold explains it. Lines that a margin or spacing would reserve must be blank or flat, a blank first or last line inside every tile means the tile is smaller and that line is spacing ("16 px + 1 px gap" beats "17 px tiles"), and a multiple of the true period loses to its divisor. Above 4 megapixels nothing is measured and the size is typed in.',
    'Engines take the same numbers for the whole sheet: Godot 4\'s `TileSetAtlasSource` has `margins`, `separation` and `texture_region_size`, Tiled\'s image-based tileset has margin and spacing, Phaser\'s `addTilesetImage` takes `tileMargin` and `tileSpacing`, and Unity\'s Sprite Editor grid slicing has Pixel Size, Offset and Padding. Only a Tiled "Collection of Images" tileset, where each tile refers to its own image file, needs the single PNGs.'],
    terms:[['Margin','Pixels between the image edge and the first tile.'],['Spacing (separation)','Pixels between two neighbouring tiles.'],['Blank tile','A tile whose every pixel has alpha 0; skipped by default and counted in `skippedBlank`.'],['Alias','A tile identical to an earlier one; written once and mapped in `aliases`.']]},
   example:{title:'Example: a 203 × 186 sheet with 16 px tiles and 1 px spacing',lead:'The numbers the slicer uses, and the same layout in three engines:',lines:[
    'sheet     203 × 186, tiles 16 × 16, margin 0, spacing 1',
    'columns   floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    'rows      floor((186 − 0 + 1) / 17) = floor(187 / 17) = 11   → 132 tiles',
    'tile 13   column 1, row 1 → x = 0 + 1 × 17 = 17, y = 17, 16 × 16 → tiles/tile-013.png',
    'names     3 digits up to 1000 tiles (tile-005); 4 digits above (tile-0005 in a 1600-tile sheet)',
    'other     100 × 64 sheet, margin 1, spacing 2 → 5 × 3 tiles at x = 1, 19, 37, 55, 73; 11 px on the right are unused',
    'engines   Godot margins (0, 0), separation (1, 1) · Tiled margin 0, spacing 1 · Phaser addTilesetImage(name, key, 16, 16, 0, 1)'],
    after:'File names keep the tile\'s grid index, so when blank tiles are skipped the numbering has gaps on purpose: tile-013 is always column 1, row 1 of this sheet.'},
   verify:{steps:[
    'Turn on the grid lines: every line should fall in a gap or on a tile edge, never through the art.',
    'Open `metadata.json`: `tileSet.columns × rows` is the grid, `count` the files written, `skippedBlank` and `deduplicated` explain any difference.',
    'Open one tile PNG: it is exactly the tile size, and its `rect` in `frames` satisfies x = margin + col × (tile + spacing).']},
   trouble:{rows:[
    ['Every tile carries a line of its neighbour or is shifted by a pixel','Wrong margin or spacing, typically 17 px tiles instead of 16 + 1','Grid lines cross the art instead of the gaps','Pick the other candidate in the ranked list, or type the margin and spacing'],
    ['Fewer files than tiles in the grid','Blank tiles are skipped, or duplicates were written once as aliases','`skippedBlank`, `deduplicated` and `aliases` in `metadata.json`','Turn blank skipping or duplicate detection off to get one file per grid cell'],
    ['The period found is 32 px but the tiles are 16 px','The art repeats a larger pattern, so a multiple of the tile scores well','Compare the scores of the 16 px and 32 px candidates','Choose the 16 px candidate or type the size'],
    ['The tile size is not suggested at all','The image is above 4 megapixels, where the grid is not measured','The field is empty and the note says to type it','Type the tile size, margin and spacing; slicing still works']]},
   alternatives:{rows:[
    ['Load the whole sheet in the engine with the margin and spacing','Almost every tilemap: Godot `TileSetAtlasSource`, a Tiled image-based tileset or Phaser `addTilesetImage` read one image and no tile files have to be managed.'],
    ['[[game/tileset-slicer|Tileset slicer]]','You need an engine tileset with terrain rules for Godot, Tiled, Unity or LDtk rather than loose PNGs.'],
    ['Unity Sprite Editor, Grid By Cell Size','The sheet is only used in Unity: Pixel Size, Offset and Padding create the sprite rects inside Unity\'s importer.']]},
   limits:['At most 4096 tiles per slice; near-duplicate grouping is capped at 2048 tiles.','The ZIP carries no engine tileset; `metadata.json` is the generic envelope with rects, columns and rows.'],
   versions:{body:['Measured for docs/TILE-LAB.md: the true grid ranked first on 10 of 10 synthetic sheets (margin 1 with spacing 2, odd 15 px, 16 × 32 tiles, outlined tiles); 13 of 13 sliced tiles byte-identical to their source regions (Chromium + Pillow); 47 of 48 tiles written with 1 blank skipped and 1 alias; 1600 tiles of 8 px sliced in 2.2 s with a working cancel. The engine parameter names follow the Godot 4.7, Tiled, Phaser and Unity documentation.'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.unityGrid]}
  },
  ko:{
   answer:'타일셋을 낱장 이미지로 자르려면 축마다 세 숫자가 필요합니다. 타일 크기, 여백(첫 타일 앞의 픽셀), 간격(타일 사이 픽셀)입니다. 이 도구는 픽셀에서 그 값을 재고 후보에 순위를 매기며, 확인하거나 직접 입력하면 영역을 그대로 복사한 `tiles/tile-NNN.png`와 각 타일의 영역·열·행이 든 `metadata.json`을 씁니다. 빈 타일은 기본으로 건너뛰고 중복은 별칭으로 표시할 수 있습니다. 대부분의 엔진은 같은 여백·간격으로 시트 전체를 읽으므로, 낱장 파일은 도구가 요구할 때만 필요합니다.',
   concept:{title:'타일 크기·여백·간격',body:[
    '열 c, 행 r의 타일은 x = 여백 + c × (타일 너비 + 간격), y = 여백 + r × (타일 높이 + 간격)에서 시작합니다. 들어가는 열 수는 floor((이미지 너비 − 여백 + 간격) ÷ (타일 너비 + 간격))이고, 오른쪽·아래 가장자리에 남는 픽셀은 무시합니다. 각 타일은 디코딩한 시트에서 정확한 사각형으로 복사하며 리샘플링하지 않습니다.',
    '측정은 그림의 주기를 찾습니다. 축마다 각 줄과 앞 줄의 차이로 윤곽을 만들고, 4px부터 이미지 절반까지 모든 주기로 접어 각 접기가 윤곽을 얼마나 잘 설명하는지 점수를 매깁니다. 여백이나 간격이 차지할 줄은 비어 있거나 단색이어야 하고, 모든 타일의 첫 줄이나 마지막 줄이 비어 있으면 타일이 더 작고 그 줄이 간격이며("16px + 1px 간격"이 "17px 타일"을 이김), 실제 주기의 배수는 약수에 집니다. 4메가픽셀을 넘으면 측정하지 않고 크기를 입력합니다.',
    '엔진은 시트 전체에 같은 숫자를 씁니다. Godot 4의 `TileSetAtlasSource`에는 `margins`, `separation`, `texture_region_size`가, Tiled의 이미지 기반 타일셋에는 margin과 spacing이, Phaser `addTilesetImage`에는 `tileMargin`과 `tileSpacing`이, Unity Sprite Editor의 격자 자르기에는 Pixel Size·Offset·Padding이 있습니다. 타일마다 자기 이미지 파일을 가리키는 Tiled의 "Collection of Images" 타일셋만 낱장 PNG가 필요합니다.'],
    terms:[['여백(margin)','이미지 가장자리와 첫 타일 사이의 픽셀.'],['간격(spacing, separation)','이웃한 두 타일 사이의 픽셀.'],['빈 타일','모든 픽셀의 알파가 0인 타일. 기본으로 건너뛰며 `skippedBlank`에 셉니다.'],['별칭','앞의 타일과 똑같은 타일. 한 번만 쓰고 `aliases`에 대응을 기록합니다.']]},
   example:{title:'예시: 16px 타일, 간격 1px인 203 × 186 시트',lead:'도구가 쓰는 숫자와, 같은 배치를 세 엔진에 넣는 값입니다.',lines:[
    '시트      203 × 186, 타일 16 × 16, 여백 0, 간격 1',
    '열        floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    '행        floor((186 − 0 + 1) / 17) = floor(187 / 17) = 11   → 타일 132개',
    '13번      1열, 1행 → x = 0 + 1 × 17 = 17, y = 17, 16 × 16 → tiles/tile-013.png',
    '이름      1000개까지 3자리(tile-005), 그 이상은 4자리(1600타일 시트에서 tile-0005)',
    '다른 예   100 × 64 시트, 여백 1, 간격 2 → 5 × 3 타일, x = 1, 19, 37, 55, 73; 오른쪽 11px 미사용',
    '엔진      Godot margins (0, 0), separation (1, 1) · Tiled margin 0, spacing 1 · Phaser addTilesetImage(name, key, 16, 16, 0, 1)'],
    after:'파일 이름은 타일의 격자 번호를 유지하므로, 빈 타일을 건너뛰면 번호에 일부러 빈자리가 생깁니다. tile-013은 이 시트에서 언제나 1열 1행입니다.'},
   verify:{steps:[
    '격자선을 켭니다. 모든 선이 틈이나 타일 경계에 있어야 하고 그림을 가로지르면 안 됩니다.',
    '`metadata.json`을 엽니다. `tileSet.columns × rows`가 격자, `count`가 쓴 파일 수이고, 차이는 `skippedBlank`와 `deduplicated`로 설명됩니다.',
    '타일 PNG 하나를 엽니다. 정확히 타일 크기이고, `frames`의 `rect`가 x = 여백 + 열 × (타일 + 간격)을 만족해야 합니다.']},
   trouble:{rows:[
    ['모든 타일에 이웃 타일의 선이 붙거나 한 픽셀 밀림','여백이나 간격이 틀림. 흔히 16 + 1 대신 17px 타일','격자선이 틈이 아니라 그림을 가로지름','순위 목록의 다른 후보를 고르거나 여백·간격을 입력'],
    ['격자의 타일보다 파일이 적음','빈 타일을 건너뛰었거나, 중복을 별칭으로 한 번만 씀','`metadata.json`의 `skippedBlank`, `deduplicated`, `aliases`','격자 칸마다 파일이 필요하면 빈 타일 건너뛰기나 중복 찾기를 끄기'],
    ['타일은 16px인데 32px 주기를 찾음','그림이 더 큰 무늬를 반복해 타일의 배수도 점수가 높음','16px와 32px 후보의 점수 비교','16px 후보를 고르거나 크기를 입력'],
    ['타일 크기가 전혀 제안되지 않음','이미지가 4메가픽셀을 넘어 격자를 측정하지 않음','칸이 비어 있고 직접 입력하라는 안내가 나옴','타일 크기·여백·간격을 입력. 자르기는 그대로 작동']]},
   alternatives:{rows:[
    ['엔진에서 여백·간격을 지정해 시트 전체를 불러오기','거의 모든 타일맵. Godot `TileSetAtlasSource`, Tiled 이미지 기반 타일셋, Phaser `addTilesetImage`는 이미지 하나를 읽으므로 관리할 타일 파일이 없습니다.'],
    ['[[game/tileset-slicer|타일셋 자르기]]','낱장 PNG가 아니라 Godot·Tiled·Unity·LDtk용 지형 규칙이 있는 엔진 타일셋이 필요할 때.'],
    ['Unity Sprite Editor, Grid By Cell Size','시트를 Unity에서만 쓸 때. Pixel Size·Offset·Padding으로 Unity 가져오기 안에서 스프라이트 영역을 만듭니다.']]},
   limits:['한 번에 최대 4096타일, 비슷한 타일 묶기는 2048타일까지입니다.','ZIP에 엔진 타일셋은 없습니다. `metadata.json`은 영역·열·행이 든 일반 형식입니다.'],
   versions:{body:['docs/TILE-LAB.md를 위해 측정했습니다. 합성 시트 10개 중 10개에서 실제 격자가 1순위였고(여백 1·간격 2, 홀수 15px, 16 × 32 타일, 외곽선 타일), 잘라 낸 타일 13개 중 13개가 원본 영역과 바이트 동일했으며(Chromium + Pillow), 48개 중 47개를 쓰고 빈 타일 1개를 건너뛰고 별칭 1개를 만들었고, 8px 타일 1600개를 2.2초에 자르며 취소도 작동했습니다. 엔진 매개변수 이름은 Godot 4.7, Tiled, Phaser, Unity 공식 문서를 따릅니다.'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.unityGrid]}
  },
  ja:{
   answer:'タイルセットを1枚ずつの画像に切るには、軸ごとに3つの数値が必要です。タイルサイズ、余白（最初のタイルの前のピクセル）、間隔（タイルの間のピクセル）です。このツールはピクセルからそれらを測って候補に順位を付け、確認か入力をすると、範囲をそのままコピーした`tiles/tile-NNN.png`と、各タイルの範囲・列・行を記した`metadata.json`を書き出します。空のタイルは既定で飛ばし、重複はエイリアスとして示せます。ほとんどのエンジンは同じ余白・間隔でシート全体を読むので、個別のファイルが必要なのはツールが求めるときだけです。',
   concept:{title:'タイルサイズ・余白・間隔',body:[
    '列c・行rのタイルはx = 余白 + c × (タイル幅 + 間隔)、y = 余白 + r × (タイル高さ + 間隔)から始まります。収まる列数はfloor((画像の幅 − 余白 + 間隔) ÷ (タイル幅 + 間隔))で、右端や下端に余ったピクセルは無視します。各タイルはデコードしたシートから正確な矩形としてコピーし、リサンプリングしません。',
    '測定は絵の周期を探します。軸ごとに各行と前の行の差でプロファイルを作り、4pxから画像の半分までのすべての周期で折り返して、それぞれがプロファイルをどれだけ説明するかを採点します。余白や間隔が占める行は空か単色でなければならず、どのタイルも最初か最後の行が空ならタイルはもっと小さくその行が間隔です（「16px + 1pxの間隔」が「17pxのタイル」に勝つ）。本当の周期の倍数は約数に負けます。4メガピクセルを超えると測定せず、サイズを入力します。',
    'エンジンはシート全体に同じ数値を使います。Godot 4の`TileSetAtlasSource`には`margins`、`separation`、`texture_region_size`、Tiledの画像ベースのタイルセットにはmarginとspacing、Phaserの`addTilesetImage`には`tileMargin`と`tileSpacing`、UnityのSprite Editorのグリッド分割にはPixel Size・Offset・Paddingがあります。タイルごとに自分の画像ファイルを指すTiledの「Collection of Images」タイルセットだけが個別のPNGを必要とします。'],
    terms:[['余白（margin）','画像の端と最初のタイルの間のピクセル。'],['間隔（spacing、separation）','隣り合う2つのタイルの間のピクセル。'],['空のタイル','すべてのピクセルのアルファが0のタイル。既定で飛ばし、`skippedBlank`で数えます。'],['エイリアス','前のタイルとまったく同じタイル。1回だけ書き、対応を`aliases`に記録します。']]},
   example:{title:'例：16pxのタイル、間隔1pxの203 × 186のシート',lead:'ツールが使う数値と、同じ配置を3つのエンジンに入れる値です。',lines:[
    'シート    203 × 186、タイル 16 × 16、余白0、間隔1',
    '列        floor((203 − 0 + 1) / (16 + 1)) = floor(204 / 17) = 12',
    '行        floor((186 − 0 + 1) / 17) = floor(187 / 17) = 11   → タイル132枚',
    '13番      1列、1行 → x = 0 + 1 × 17 = 17, y = 17、16 × 16 → tiles/tile-013.png',
    '名前      1000枚までは3桁（tile-005）、それ以上は4桁（1600枚のシートでtile-0005）',
    '別の例    100 × 64のシート、余白1、間隔2 → 5 × 3タイル、x = 1, 19, 37, 55, 73；右の11pxは未使用',
    'エンジン  Godot margins (0, 0), separation (1, 1) · Tiled margin 0, spacing 1 · Phaser addTilesetImage(name, key, 16, 16, 0, 1)'],
    after:'ファイル名はタイルのグリッド番号を保つので、空のタイルを飛ばすと番号に意図的な欠番ができます。tile-013はこのシートで常に1列1行です。'},
   verify:{steps:[
    'グリッド線を表示します。すべての線がすき間かタイルの境目にあり、絵を横切らないはずです。',
    '`metadata.json`を開きます。`tileSet.columns × rows`がグリッド、`count`が書き出したファイル数で、差は`skippedBlank`と`deduplicated`で説明されます。',
    'タイルのPNGを1つ開きます。ちょうどタイルサイズで、`frames`の`rect`がx = 余白 + 列 × (タイル + 間隔)を満たすはずです。']},
   trouble:{rows:[
    ['すべてのタイルに隣のタイルの線が付く・1ピクセルずれる','余白か間隔が違う。多いのは16 + 1ではなく17pxのタイル','グリッド線がすき間ではなく絵を横切っている','順位リストの別の候補を選ぶか、余白・間隔を入力する'],
    ['グリッドのタイル数よりファイルが少ない','空のタイルを飛ばした、または重複をエイリアスとして1回だけ書いた','`metadata.json`の`skippedBlank`、`deduplicated`、`aliases`','グリッドのセルごとにファイルが要るなら、空タイルのスキップや重複検出を切る'],
    ['タイルは16pxなのに32pxの周期が見つかる','絵がより大きな模様を繰り返し、タイルの倍数も高得点になる','16pxと32pxの候補の得点を比べる','16pxの候補を選ぶかサイズを入力する'],
    ['タイルサイズがまったく提案されない','画像が4メガピクセルを超え、グリッドを測定しない','欄が空で、入力するよう案内が出る','タイルサイズ・余白・間隔を入力する。分割はそのまま動く']]},
   alternatives:{rows:[
    ['エンジンで余白・間隔を指定してシート全体を読み込む','ほぼすべてのタイルマップ。Godotの`TileSetAtlasSource`、Tiledの画像ベースのタイルセット、Phaserの`addTilesetImage`は画像1枚を読むので、管理するタイルファイルがありません。'],
    ['[[game/tileset-slicer|タイルセット分割]]','個別のPNGではなく、Godot・Tiled・Unity・LDtk向けの地形ルールつきのエンジン用タイルセットが必要なとき。'],
    ['UnityのSprite Editor、Grid By Cell Size','シートをUnityだけで使うとき。Pixel Size・Offset・PaddingでUnityのインポート内にスプライトの範囲を作ります。']]},
   limits:['1回の分割は最大4096タイル、類似タイルのまとめは2048タイルまでです。','ZIPにエンジン用のタイルセットは入りません。`metadata.json`は範囲・列・行を持つ汎用の形式です。'],
   versions:{body:['docs/TILE-LAB.mdのために測定しました。合成シート10枚中10枚で本当のグリッドが1位（余白1・間隔2、奇数の15px、16 × 32のタイル、アウトラインつきのタイル）、切り出したタイル13枚中13枚が元の範囲とバイト一致（Chromium + Pillow）、48枚中47枚を書き出して空タイル1枚を飛ばしエイリアス1つ、8pxのタイル1600枚を2.2秒で分割しキャンセルも動作しました。エンジンのパラメーター名はGodot 4.7、Tiled、Phaser、Unityの公式ドキュメントに基づきます。'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.unityGrid]}
  }
 },
 'atlas-padding':{
  type:'troubleshoot',
  intent:{primary:'stop lines and gaps between tiles by extruding each tile\'s edge pixels (tileset extruder)',secondary:['texture bleeding between tiles','padding vs extrude','new margin and spacing after extrusion','tilemap gaps in Phaser, Tiled, Unity'],
   goal:'a padded atlas whose tiles are surrounded by copies of their own edge pixels, with the margin and spacing to enter in the engine',input:'a tileset on a regular grid (margin and spacing allowed)',output:'padded-atlas.png (+ tiles/*.png and metadata.json with the source rects)',target:'any tilemap that samples with filtering or mipmaps (Tiled, Phaser, Unity…); Godot 4 pads TileSets itself',support:'partial',
   evidence:['src/atlas.js extrudeRegions','src/primitives.js sheetLayout','src/task/tile-lab.js (extrude 2 on the atlas-padding route, 0–16)','docs/TILE-LAB.md §2 padded atlas and its verification rows','src/capabilities.js atlas-padding quality evidence'],
   external:['Godot 4.7 TileSetAtlasSource use_texture_padding','Tiled margin/spacing for extruded tilesets','Phaser addTilesetImage','TexturePacker padding vs extrude']},
  en:{
   answer:'Thin lines or gaps between tiles appear when the GPU samples a texel just outside a tile\'s rectangle: linear filtering, mipmaps or a camera at a fractional position read the neighbouring tile or the empty gap. Extrusion fixes that by copying each tile\'s outermost pixels outward into a ring, so a sample that lands outside the tile still reads the tile\'s own colour. This page extrudes every tile of a grid sheet (2 px by default, 0–16) into `padded-atlas.png`, where tiles sit at margin = extrude and spacing = 2 × extrude. Check your engine first: Godot 4 TileSets already add 1 px of padding internally.',
   concept:{title:'Why lines appear between tiles',body:[
    'A tilemap draws every tile from a rectangle of the atlas. With nearest filtering and the camera on whole pixels each screen pixel reads one texel inside that rectangle and nothing bleeds. Linear filtering blends the four nearest texels, so a sample at the very edge takes up to half its colour from the texel next door; mipmaps average 2 × 2 blocks per level, so at smaller sizes the neighbour mixes in further; and a zoom or camera position that is not a whole number moves samples onto those edges.',
    'Padding and extrusion are different fixes. Padding (TexturePacker\'s shape padding) leaves transparent pixels between the rectangles: the neighbour is no longer read, but the empty gap is, which shows as a dark or see-through line. Extrusion repeats the edge pixels outward (TexturePacker: "repeats the sprite\'s pixels at the border; sprite\'s size is not changed"), so whatever leaks in has the tile\'s own colour. For tiles that must meet edge to edge, extrusion is the one that hides the line.',
    'Some engines already do it. Godot 4\'s `TileSetAtlasSource.use_texture_padding` is on by default and generates an internal texture with one extra pixel around each tile, so a Godot 4 TileSet usually needs nothing here. Tiled supports margin and spacing precisely so that extruded tilesets can be used, and Phaser\'s `addTilesetImage` takes `tileMargin` and `tileSpacing`. After extruding, those two numbers change, and forgetting that is the most common new problem.']},
   example:{title:'Example: extruding a 203 × 186 sheet by 2 px',lead:'The sheet has 12 × 11 tiles of 16 × 16 with 1 px spacing. Pixel positions in the output:',lines:[
    'source    203 × 186: 12 × 11 tiles of 16 × 16, margin 0, spacing 1',
    'extrude 2 → each cell 16 + 2 × 2 = 20 px → padded-atlas.png 12 × 20 = 240 by 11 × 20 = 220',
    'tile 13   column 1, row 1: source 17,17 → atlas x = 1 × 20 + 2 = 22, y = 22 (pixels 22–37)',
    'ring      x 20–21 repeat the tile\'s column 0, x 38–39 repeat column 15; each 2 × 2 corner repeats the corner pixel',
    'engine    margin 2, spacing 4 → Tiled margin 2 / spacing 4 · Phaser addTilesetImage(name, key, 16, 16, 2, 4) · Godot margins (2, 2), separation (4, 4)',
    'padding   the same 4 px left transparent: a linear sample halfway between texel 37 and 38 is 50 % tile, 50 % nothing'],
    after:'The source sheet\'s own 1 px spacing disappears: the atlas is laid out again from the grid. `metadata.json` in the same ZIP keeps the source rects (tile 13 at 17,17), so use margin and spacing for the padded atlas.'},
   verify:{steps:[
    'Open `padded-atlas.png`: it is columns × (tile + 2 × extrude) by rows × (tile + 2 × extrude), and tile 0 starts at (extrude, extrude).',
    'Zoom into the ring around one tile: every ring pixel equals the nearest edge pixel of that tile.',
    'In the engine, set margin = extrude and spacing = 2 × extrude, then pan and zoom the camera by fractional amounts across a tile border: no line should appear.']},
   trouble:{rows:[
    ['Lines flicker only while the camera moves or zooms','Fractional positions plus linear filtering sample across tile borders','Stop the camera at a whole-pixel position: the lines disappear','Extrude the atlas, or use nearest filtering with whole-pixel camera positions'],
    ['Lines appear only when the map is zoomed out','Mipmaps average blocks that include the neighbouring tile','Turn mipmaps off for the tileset texture: the lines vanish','Extrude more (2–4 px), or disable mipmaps for 2D tilemaps'],
    ['After extruding, every tile shows part of its neighbour','The engine still uses the old margin and spacing','Tile 0 should start at (extrude, extrude) in the padded atlas','Set margin = extrude and spacing = 2 × extrude (extrude 2 → 2 and 4)'],
    ['Dark fringes around transparent parts of tiles','The colour under fully transparent pixels is black and filtering blends it in; extrusion only adds pixels around tiles','Look at the RGB of transparent pixels near the edge','Fill the colour under transparent pixels with [[game/texture-edge-bleed|edge bleed]]'],
    ['Gaps remain with nearest filtering and no mipmaps','The tiles themselves are placed apart: map positions or scale are not whole pixels','Check tile positions and the camera scale','Fix the map or camera; this is outside what an atlas can fix, and Nerulio cannot change it']]},
   versions:{body:['Measured for docs/TILE-LAB.md and `tests/recipes-browser.py`: a 2 × 1 sheet of 1 px tiles with 1 px extrusion gives a 6 × 3 atlas with the edge pixels isolated; a sheet with 8 px tiles, margin 1 and separation 2 gives a 36 × 24 atlas whose 6 × 64 tile pixels and 6 × 8 left-edge pixels equal the source; the output is byte-identical to the reference extrusion for a 32 × 32 sheet at padding 3 and for 1 × 1, 1 × 16 and 16 × 1 cells at padding 2 (Chromium and Firefox). The example positions were recomputed with the same layout function. Engine behaviour follows the Godot 4.7, Tiled, Phaser and TexturePacker documentation.'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.tpSettings]}
  },
  ko:{
   answer:'타일 사이의 가는 선이나 틈은 GPU가 타일 사각형 바로 바깥의 텍셀을 샘플링할 때 생깁니다. 선형 필터링, 밉맵, 정수가 아닌 위치의 카메라가 이웃 타일이나 빈 틈을 읽는 것입니다. 가장자리 확장은 각 타일의 맨 바깥 픽셀을 바깥 테두리로 복사해, 타일 밖에 떨어진 샘플도 타일 자신의 색을 읽게 해서 이를 고칩니다. 이 페이지는 격자 시트의 모든 타일을 확장해(기본 2px, 0~16) `padded-atlas.png`를 만들며, 타일은 여백 = 확장 폭, 간격 = 확장 폭 × 2에 놓입니다. 먼저 엔진을 확인하세요. Godot 4 TileSet은 이미 내부적으로 1px 여백을 둡니다.',
   concept:{title:'타일 사이에 선이 생기는 이유',body:[
    '타일맵은 모든 타일을 아틀라스의 사각형 하나에서 그립니다. 최근접 필터에 카메라가 정수 픽셀 위에 있으면 화면 픽셀마다 사각형 안 텍셀 하나를 읽어 번짐이 없습니다. 선형 필터는 가장 가까운 텍셀 네 개를 섞으므로 가장자리의 샘플은 색의 최대 절반을 옆 텍셀에서 가져옵니다. 밉맵은 단계마다 2 × 2 블록을 평균하므로 작게 그릴수록 이웃이 더 섞이고, 정수가 아닌 확대나 카메라 위치는 샘플을 그 가장자리로 옮깁니다.',
    '여백(padding)과 확장(extrude)은 다른 해결책입니다. 여백(TexturePacker의 shape padding)은 사각형 사이에 투명 픽셀을 남겨 이웃은 읽지 않지만 빈 틈을 읽게 되고, 이것이 어둡거나 비쳐 보이는 선이 됩니다. 확장은 가장자리 픽셀을 바깥으로 반복하므로(TexturePacker: "repeats the sprite\'s pixels at the border; sprite\'s size is not changed") 새어 들어오는 것도 타일 자신의 색입니다. 모서리끼리 딱 붙어야 하는 타일이라면 선을 숨기는 것은 확장입니다.',
    '이미 이것을 하는 엔진도 있습니다. Godot 4의 `TileSetAtlasSource.use_texture_padding`은 기본으로 켜져 있고 타일마다 1픽셀을 더 두른 내부 텍스처를 만들므로, Godot 4 TileSet에는 대개 이 작업이 필요 없습니다. Tiled는 확장된 타일셋을 쓰도록 margin과 spacing을 지원하고, Phaser `addTilesetImage`는 `tileMargin`과 `tileSpacing`을 받습니다. 확장하면 이 두 숫자가 바뀌며, 이를 잊는 것이 가장 흔한 새 문제입니다.']},
   example:{title:'예시: 203 × 186 시트를 2px 확장',lead:'시트는 16 × 16 타일 12 × 11개, 간격 1px입니다. 결과의 픽셀 위치:',lines:[
    '원본      203 × 186: 16 × 16 타일 12 × 11개, 여백 0, 간격 1',
    '확장 2    → 칸마다 16 + 2 × 2 = 20px → padded-atlas.png 12 × 20 = 240, 11 × 20 = 220',
    '13번      1열, 1행: 원본 17,17 → 아틀라스 x = 1 × 20 + 2 = 22, y = 22 (픽셀 22~37)',
    '테두리    x 20~21은 타일의 0번 열 반복, x 38~39는 15번 열 반복; 2 × 2 모서리는 모서리 픽셀 반복',
    '엔진      여백 2, 간격 4 → Tiled margin 2 / spacing 4 · Phaser addTilesetImage(name, key, 16, 16, 2, 4) · Godot margins (2, 2), separation (4, 4)',
    '여백만    같은 4px를 투명으로 두면: 37번과 38번 텍셀 중간의 선형 샘플은 타일 50%, 빈 곳 50%'],
    after:'원본 시트의 1px 간격은 사라집니다. 아틀라스를 격자에서 새로 배치하기 때문입니다. 같은 ZIP의 `metadata.json`은 원본 영역(13번은 17,17)을 유지하므로, 여백 아틀라스에는 여백·간격 값을 쓰세요.'},
   verify:{steps:[
    '`padded-atlas.png`를 엽니다. 크기가 열 수 × (타일 + 2 × 확장) × 행 수 × (타일 + 2 × 확장)이고, 0번 타일이 (확장, 확장)에서 시작해야 합니다.',
    '타일 하나의 테두리를 확대합니다. 테두리 픽셀이 모두 그 타일의 가장 가까운 가장자리 픽셀과 같아야 합니다.',
    '엔진에서 여백 = 확장, 간격 = 2 × 확장으로 두고, 카메라를 타일 경계 위로 소수 단위로 움직이고 확대해 봅니다. 선이 보이지 않아야 합니다.']},
   trouble:{rows:[
    ['카메라가 움직이거나 확대할 때만 선이 깜빡임','소수 위치와 선형 필터가 타일 경계 너머를 샘플링','카메라를 정수 픽셀 위치에 멈추면 선이 사라짐','아틀라스를 확장하거나, 최근접 필터와 정수 픽셀 카메라 위치 사용'],
    ['맵을 축소했을 때만 선이 보임','밉맵이 이웃 타일을 포함한 블록을 평균함','타일셋 텍스처의 밉맵을 끄면 선이 사라짐','더 많이 확장하거나(2~4px), 2D 타일맵의 밉맵 끄기'],
    ['확장한 뒤 모든 타일에 이웃 타일이 보임','엔진이 아직 예전 여백·간격을 씀','여백 아틀라스에서 0번 타일은 (확장, 확장)에서 시작해야 함','여백 = 확장, 간격 = 2 × 확장으로(확장 2 → 2와 4)'],
    ['타일의 투명한 부분 둘레에 어두운 테두리','완전히 투명한 픽셀 아래 색이 검정이고 필터가 이를 섞음. 확장은 타일 바깥에만 픽셀을 더함','가장자리 근처 투명 픽셀의 RGB 확인','[[game/texture-edge-bleed|가장자리 번짐 채우기]]로 투명 픽셀 아래 색 채우기'],
    ['최근접 필터에 밉맵이 없어도 틈이 남음','타일 자체가 떨어져 배치됨: 맵 위치나 배율이 정수 픽셀이 아님','타일 위치와 카메라 배율 확인','맵이나 카메라를 고치기. 아틀라스로 고칠 수 있는 범위가 아니며 Nerulio도 바꿀 수 없음']]},
   versions:{body:['docs/TILE-LAB.md와 `tests/recipes-browser.py`에서 측정했습니다. 1px 타일 2 × 1개 시트를 1px 확장하면 가장자리 픽셀이 분리된 6 × 3 아틀라스가 되고, 8px 타일·여백 1·간격 2 시트는 36 × 24 아틀라스가 되며 타일 픽셀 6 × 64개와 왼쪽 가장자리 픽셀 6 × 8개가 원본과 같았습니다. 32 × 32 시트의 여백 3, 1 × 1·1 × 16·16 × 1 칸의 여백 2에서 기준 확장 결과와 바이트 동일했습니다(Chromium·Firefox). 예시 위치는 같은 배치 함수로 다시 계산했습니다. 엔진 동작은 Godot 4.7, Tiled, Phaser, TexturePacker 공식 문서를 따릅니다.'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.tpSettings]}
  },
  ja:{
   answer:'タイルの間の細い線やすき間は、GPUがタイルの矩形のすぐ外のテクセルをサンプリングしたときに出ます。線形フィルタリング、ミップマップ、整数でない位置のカメラが、隣のタイルや空のすき間を読んでしまうのです。縁の拡張は各タイルのいちばん外側のピクセルを外側の縁にコピーし、タイルの外に落ちたサンプルもタイル自身の色を読むようにして直します。このページはグリッドのシートの全タイルを拡張し（既定2px、0〜16）`padded-atlas.png`を作り、タイルは余白 = 拡張幅、間隔 = 拡張幅 × 2に置かれます。先にエンジンを確認してください。Godot 4のTileSetはすでに内部で1pxの余白を付けています。',
   concept:{title:'タイルの間に線が出る理由',body:[
    'タイルマップはすべてのタイルをアトラスの矩形1つから描きます。最近傍フィルターでカメラが整数ピクセル上にあれば、画面の各ピクセルは矩形内のテクセル1つを読み、にじみません。線形フィルターは最も近い4つのテクセルを混ぜるので、縁のサンプルは色の最大半分を隣のテクセルから取ります。ミップマップは段階ごとに2 × 2のブロックを平均するので小さく描くほど隣が混ざり、整数でない拡大率やカメラ位置はサンプルをその縁に動かします。',
    '余白（padding）と拡張（extrude）は別の対策です。余白（TexturePackerのshape padding）は矩形の間に透明なピクセルを残すので、隣は読まなくなりますが空のすき間を読み、それが暗い線や透けた線になります。拡張は縁のピクセルを外へ繰り返すので（TexturePacker："repeats the sprite\'s pixels at the border; sprite\'s size is not changed"）、入り込むのもタイル自身の色です。縁どうしがぴったり接するべきタイルなら、線を隠すのは拡張です。',
    'すでにこれを行うエンジンもあります。Godot 4の`TileSetAtlasSource.use_texture_padding`は既定でオンで、タイルごとに1ピクセル余分に囲んだ内部テクスチャを作るので、Godot 4のTileSetにはたいていこの作業は不要です。Tiledは拡張済みのタイルセットを使えるようmarginとspacingに対応し、Phaserの`addTilesetImage`は`tileMargin`と`tileSpacing`を受け取ります。拡張するとこの2つの数値が変わり、それを忘れるのが最もよくある新しい問題です。']},
   example:{title:'例：203 × 186のシートを2px拡張',lead:'シートは16 × 16のタイルが12 × 11枚、間隔1pxです。出力でのピクセル位置：',lines:[
    '元        203 × 186：16 × 16のタイルが12 × 11枚、余白0、間隔1',
    '拡張2     → セルごとに 16 + 2 × 2 = 20px → padded-atlas.png 12 × 20 = 240 × 11 × 20 = 220',
    '13番      1列、1行：元 17,17 → アトラス x = 1 × 20 + 2 = 22, y = 22（ピクセル22〜37）',
    '縁        x 20〜21はタイルの0列目を繰り返し、x 38〜39は15列目を繰り返す；2 × 2の角は角のピクセルを繰り返す',
    'エンジン  余白2、間隔4 → Tiled margin 2 / spacing 4 · Phaser addTilesetImage(name, key, 16, 16, 2, 4) · Godot margins (2, 2), separation (4, 4)',
    '余白だけ  同じ4pxを透明のままにすると：37番と38番のテクセルの中間の線形サンプルはタイル50%、空50%'],
    after:'元のシートの1pxの間隔は消えます。アトラスをグリッドから配置し直すためです。同じZIPの`metadata.json`は元の範囲（13番は17,17）を保つので、余白アトラスには余白・間隔の値を使ってください。'},
   verify:{steps:[
    '`padded-atlas.png`を開きます。サイズは列数 × (タイル + 2 × 拡張) × 行数 × (タイル + 2 × 拡張)で、0番のタイルが(拡張, 拡張)から始まるはずです。',
    'タイル1つの縁を拡大します。縁のピクセルはすべて、そのタイルの最も近い縁のピクセルと同じはずです。',
    'エンジンで余白 = 拡張、間隔 = 2 × 拡張にし、カメラをタイルの境目の上で小数単位で動かしたり拡大したりします。線が出ないはずです。']},
   trouble:{rows:[
    ['カメラが動く・拡大するときだけ線がちらつく','小数の位置と線形フィルターがタイルの境目をまたいでサンプリングしている','カメラを整数ピクセルの位置で止めると線が消える','アトラスを拡張するか、最近傍フィルターと整数ピクセルのカメラ位置を使う'],
    ['マップを縮小したときだけ線が出る','ミップマップが隣のタイルを含むブロックを平均している','タイルセットのテクスチャのミップマップを切ると線が消える','もっと拡張する（2〜4px）か、2Dタイルマップのミップマップを切る'],
    ['拡張した後、すべてのタイルに隣のタイルが見える','エンジンがまだ古い余白・間隔を使っている','余白アトラスでは0番のタイルが(拡張, 拡張)から始まるはず','余白 = 拡張、間隔 = 2 × 拡張にする（拡張2 → 2と4）'],
    ['タイルの透明な部分の周りに暗い縁が出る','完全に透明なピクセルの下の色が黒で、フィルターがそれを混ぜる。拡張はタイルの外側にピクセルを足すだけ','縁の近くの透明ピクセルのRGBを確認','[[game/texture-edge-bleed|エッジブリード]]で透明ピクセルの下の色を埋める'],
    ['最近傍フィルターでミップマップなしでもすき間が残る','タイル自体が離れて配置されている：マップの位置や倍率が整数ピクセルでない','タイルの位置とカメラの倍率を確認','マップかカメラを直す。アトラスで直せる範囲外で、Nerulioでも変えられない']]},
   versions:{body:['docs/TILE-LAB.mdと`tests/recipes-browser.py`で測定しました。1pxのタイル2 × 1枚のシートを1px拡張すると縁のピクセルが分離した6 × 3のアトラスになり、8pxのタイル・余白1・間隔2のシートは36 × 24のアトラスになってタイルのピクセル6 × 64個と左端のピクセル6 × 8個が元と一致しました。32 × 32のシートの余白3、1 × 1・1 × 16・16 × 1のセルの余白2で、基準の拡張結果とバイト一致しました（Chromium・Firefox）。例の位置は同じ配置関数で計算し直しています。エンジンの動作はGodot 4.7、Tiled、Phaser、TexturePackerの公式ドキュメントに基づきます。'],sources:[S.atlasSource,S.tiled,S.phaserTilemap,S.tpSettings]}
  }
 }

};

// Keep the existing worked grid examples; the v2 editor adds import and output paths.
// Update claims here in one place while the engine matrix is being independently rerun.
const fontV2=CONTENT['bitmap-font-maker'];
fontV2.intent.input='A local glyph-sheet PNG, BDF font, editable project JSON, or local TTF/OTF for bitmap baking';
fontV2.intent.output='font.png + BMFont text/XML/binary + font.json; editable projects also include v2 source JSON and a guarded pixel-outline TTF';
fontV2.intent.target='Godot 4 BMFont text, Phaser XML, and PixiJS 8; verify a generated bundle in your target version';
fontV2.intent.evidence.push('src/game/font-bdf.js, font-project.js, font-ttf.js, font-hangul.js and tests/bitmap-font-maker-browser.py');
fontV2.en.answer='Draw pixel glyphs locally or import a PNG sheet, BDF, or editable project. The maker writes one PNG atlas and matching BMFont text, XML and version-3 binary descriptors; editable projects also include the v2 source and, within stated limits, a TrueType pixel-outline font. A live missing-character count and kerning preview help check the actual text you plan to render. No file is uploaded. Exported text, XML, binary, PNG and TTF from two CC0 BDFs were independently reopened; engine loading of the new BDF path remains a separate check.';
fontV2.ko.answer='로컬에서 픽셀 글리프를 그리거나 PNG 시트·BDF·편집 프로젝트를 가져올 수 있습니다. 도구는 PNG 아틀라스 한 장과 같은 수치의 BMFont 텍스트·XML·버전 3 바이너리를 내보냅니다. 편집 프로젝트에는 v2 원본과 한도 안에서 TrueType 픽셀 윤곽선 폰트도 들어갑니다. 입력한 문장의 누락 글자 수와 커닝 미리보기를 볼 수 있으며 파일은 업로드하지 않습니다. CC0 BDF 두 종의 출력은 독립적으로 재열었지만 새 BDF 경로의 엔진 적재는 별도 검증 대상입니다.';
fontV2.ja.answer='ピクセルグリフを端末内で描くか、PNGシート・BDF・編集用プロジェクトを読み込めます。1枚のPNGアトラスと同じメトリクスのBMFontテキスト・XML・バージョン3バイナリを書き出します。編集用プロジェクトにはv2原本と、制限内でTrueTypeのピクセル輪郭フォントも含まれます。入力文の不足文字数とカーニングをプレビューでき、ファイルはアップロードされません。CC0のBDF 2種類の出力は独立して再読込済みですが、新しいBDF経路のエンジン読み込みは別途確認が必要です。';
fontV2.en.concept.body[0]=fontV2.en.concept.body[0].replace('Nerulio writes none, because a bitmap sheet carries no kerning data.','The editable project records pair kerning, while a plain image sheet has no kerning metadata to import.');
fontV2.ko.concept.body[0]=fontV2.ko.concept.body[0].replace('비트맵 시트에는 커닝 정보가 없어 Nerulio는 쓰지 않습니다.','편집 프로젝트는 글자 쌍 커닝을 저장하지만 이미지 시트에는 가져올 커닝 정보가 없습니다.');
fontV2.ja.concept.body[0]=fontV2.ja.concept.body[0].replace('ビットマップのシートにはカーニングの情報がないので、Nerulioは書きません。','編集用プロジェクトには文字ペアのカーニングを保存できますが、画像シート自体には読み込むカーニング情報がありません。');
fontV2.en.target.steps[3]='Phaser: use `this.load.bitmapFont(key, \'font.png\', \'font.xml\')`. The ZIP contains the XML descriptor alongside the PNG; test the loaded result in your Phaser version.';
fontV2.ko.target.steps[3]='Phaser: `this.load.bitmapFont(key, \'font.png\', \'font.xml\')`를 사용하세요. ZIP에 PNG와 XML 설명자가 함께 들어 있습니다. 사용 중인 Phaser 버전에서 실제 표시를 확인하세요.';
fontV2.ja.target.steps[3]='Phaser：`this.load.bitmapFont(key, \'font.png\', \'font.xml\')`を使います。ZIPにはPNGとXML記述子が入っています。利用するPhaserのバージョンで実際の表示を確認してください。';
fontV2.en.trouble.rows[1][3]='Use the included `font.xml` next to `font.png`, then check Phaser console and file paths.';
fontV2.ko.trouble.rows[1][3]='포함된 `font.xml`을 `font.png` 옆에 놓고 Phaser 콘솔과 파일 경로를 확인';
fontV2.ja.trouble.rows[1][3]='同梱の`font.xml`を`font.png`の隣に置き、Phaserのコンソールとパスを確認する';
fontV2.en.alternatives.rows[1][1]='You need verified multi-page atlases, effects, or advanced font features; this editor currently writes one atlas page.';
fontV2.ko.alternatives.rows[1][1]='검증된 여러 텍스처 페이지, 효과 또는 고급 폰트 기능이 필요할 때. 이 편집기는 현재 아틀라스 한 장을 씁니다.';
fontV2.ja.alternatives.rows[1][1]='検証済みの複数テクスチャページ、エフェクト、高度なフォント機能が必要な場合。このエディターは現在1ページのアトラスを書きます。';
fontV2.en.limits=['One atlas page, no verified multi-page CJK output or OTF download; SDF remains Beta. A coverage count does not prove that Hangul composition is legible.','The editable TTF uses pixel-square outlines; two CC0 BDFs reopened with fontTools, but default FreeType hinting moved the detached dots in i and j. Unity TextMeshPro loading is unverified.','The existing local-font bake can use browser fallback glyphs and antialiasing. Inspect every downloaded atlas in the target engine.'];
fontV2.ko.limits=['아틀라스 1장만 출력하며 여러 페이지 CJK 출력·OTF 다운로드는 검증되지 않았습니다. SDF는 베타입니다. 문자 수가 맞아도 조합 한글의 가독성은 보장되지 않습니다.','편집 TTF는 픽셀 사각형 윤곽선을 사용합니다. CC0 BDF 두 종은 fontTools로 재열었지만 FreeType 기본 힌팅에서 i·j의 분리된 점이 움직였습니다. Unity TextMeshPro 적재는 미검증입니다.','기존 로컬 폰트 굽기는 브라우저 대체 글리프와 안티앨리어싱이 섞일 수 있습니다. 대상 엔진에서 다운로드한 아틀라스를 확인하세요.'];
fontV2.ja.limits=['アトラスは1ページです。複数ページのCJK出力とOTFダウンロードは未検証で、SDFはベータです。文字数が合っても合成ハングルの可読性は保証されません。','編集用TTFはピクセルの四角形を輪郭にします。CC0のBDF 2種類をfontToolsで再読込しましたが、FreeTypeの標準ヒンティングではiとjの離れた点が移動しました。Unity TextMeshProでの読み込みは未検証です。','従来のローカルフォント焼き込みではブラウザーの代替グリフやアンチエイリアスが混ざることがあります。対象エンジンで出力アトラスを確認してください。'];
export default CONTENT;
