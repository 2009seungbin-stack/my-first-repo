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
export default {
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
/*PAGES-BELOW*/
};
