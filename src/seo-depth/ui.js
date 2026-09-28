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
/*PAGES-BELOW*/
};
