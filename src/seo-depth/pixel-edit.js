/** Intent content for the pixel-edit pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/studio/pixel/*.js (raster, indexed, ramps, palette-io, pixel-doc),
 * src/studio/workspaces/pixel/*.js, docs/STUDIO-PIXEL.md (§3 use, §6 head-to-head with Aseprite 1.3.18),
 * src/game/palette.js + docs/PIXEL-LAB.md (the Pixel Lab pages), src/game/export/anim.js (GIF/APNG).
 * Worked-example numbers were computed with those modules (ramps, outlines, nearest colours).
 * External behaviour: the official pages cited in each page's `versions.sources`; Lospec's download
 * files were fetched from lospec.com on 2026-09-28. */
const A={
 fx:'https://www.aseprite.org/docs/fx/',canvas:'https://www.aseprite.org/docs/canvas/',colorMode:'https://www.aseprite.org/docs/color-mode/',
 colorBar:'https://www.aseprite.org/docs/color-bar/',shading:'https://www.aseprite.org/docs/shading/',onion:'https://www.aseprite.org/docs/onion-skinning/',
 duration:'https://www.aseprite.org/docs/frame-duration/',tilemap:'https://www.aseprite.org/docs/tilemap/',scripting:'https://www.aseprite.org/docs/scripting/',
 cli:'https://www.aseprite.org/docs/cli/',faq:'https://www.aseprite.org/faq/',trial:'https://www.aseprite.org/trial/',props:'https://www.aseprite.org/docs/sprite-properties/',
 symmetry:'https://www.aseprite.org/docs/symmetry/',replace:'https://www.aseprite.org/docs/replace-color/',defaultPalette:'https://www.aseprite.org/docs/default-palette/',
 gplExt:'https://github.com/aseprite/aseprite/blob/main/docs/gpl-palette-extension.md'
};
const LOSPEC={pico:'https://lospec.com/palette-list/pico-8',importing:'https://lospec.com/palette-list/importing-palettes'};
const GIMP_GPL='https://developer.gimp.org/core/standards/gpl/';
const ADOBE_ACT='https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577411_pgfId-1070626';
const GIF89A='https://www.w3.org/Graphics/GIF/spec-gif89a.txt';
const s=(label,url)=>`[${label}](${url})`;
export default {
 // ───────────────────────────────────────────────────────────────── pixel art editor
 'game/pixel-art-editor':{
  type:'create',
  intent:{primary:'draw pixel-art game sprites in a browser editor',secondary:['choose a canvas size that fits the game resolution','RGB or indexed colour','Aseprite-style keys and tools','save .aseprite or PNG'],
   goal:'a sprite drawn at a size that scales cleanly in the game, in a limited palette, saved as .aseprite or PNG and ready to animate or pack',
   input:'nothing (new sprite 1–4096 px per side), or a PNG, GIF, numbered frames or an .aseprite file',output:'.aseprite (layers, blend modes, palette, indexed or RGB), frame PNG (PNG-8 when indexed), .nerulio project',
   target:'any 2D engine, through Pack & Export',support:'full',
   evidence:['src/studio/workspaces/pixel/panels.js (new sprite 32×32 default, DB32, canvas size dialog)','src/studio/pixel/indexed.js, png8.js (indexed cels as PNG-8)','src/studio/pixel/raster.js (pixel-perfect, snapLineEnd 2:1 / 1:1 / 1:2)','docs/STUDIO-PIXEL.md §3, §6, §7'],
   external:['Aseprite docs: Color Mode (indexed, transparent index)','Aseprite docs: Default Palette (DB32)']},
  en:{
   answer:'To draw a pixel-art sprite, fix three things before the first pixel: a canvas sized for the game\'s own resolution (a character that walks on a 16 px tile grid fits in 16×16 to 32×32), a small palette, and hard 1 px edges with no anti-aliasing. In Nerulio\'s Pixel workspace, Pixel › New sprite… opens a 32×32 canvas (any size from 1 to 4096) with the DawnBringer 32 palette, in RGB or indexed colour, and the tools answer to Aseprite\'s keys. Save the result as `.aseprite` or a PNG frame; it runs in the browser and the picture never leaves the device.',
   concept:{title:'Size, colour mode and clean edges: the three decisions behind a sprite',body:[
    'Pixel art is drawn at the size the game renders it, then enlarged by a whole number so every pixel stays square. Start from the game\'s internal resolution: a game drawn at 320×180 is scaled ×6 to fill 1920×1080, ×8 for 2560×1440 and ×12 for 3840×2160; at 640×360 the factors are 3, 4 and 6. With 16 px tiles, 320×180 shows 20 × 11.25 tiles, so a 16×16 or 16×24 hero is one tile wide. Size also sets the workload: every doubling of the side quadruples the pixels of every animation frame (16×16 = 256 px, 32×32 = 1024 px, 64×64 = 4096 px).',
    'RGB (RGBA) stores four values per pixel and does not depend on the palette: in an RGB sprite the palette is a set of swatches, and editing a swatch changes no pixel. Indexed colour stores one number per pixel that points into a palette of at most 256 entries, with one entry drawn as transparent (index 0 by default, the same convention Aseprite uses). Changing an entry recolours every pixel that uses it on every frame, which is what makes palette swaps cheap. Nerulio keeps indexed cels as PNG-8 (a PLTE palette plus tRNS transparency) and a brush in an indexed sprite always lands on the nearest palette colour.',
    'Clean lines come from regular steps. A freehand stroke leaves L-shaped double corners on diagonals; the pixel-perfect filter removes them while you draw and is on by default. Straight lines look even when the steps repeat: Shift on the line tool snaps to 0°, 26.57° (2 across, 1 up), 45°, 63.43° (1 across, 2 up) and 90°.'],
    terms:[['Internal resolution','The size the game draws the world at before scaling it up, for example 320×180.'],['Integer scaling','Enlarging by 2, 3, 4… so each source pixel becomes an exact square block.'],['Indexed colour','Each pixel is a palette index (0–255); the palette holds the actual colours.'],['Transparent index','The palette entry drawn as transparent in an indexed sprite; 0 unless changed.'],['Pixel-perfect stroke','A freehand line with the extra corner pixels removed, so diagonals stay one pixel thick.']]},
   example:{title:'Example: sizing a 16 px-grid hero for a 320×180 game',lead:'The numbers behind the canvas you type into Pixel › New sprite…:',lines:[
    'game resolution      320 × 180        → 1920 × 1080 at ×6, 2560 × 1440 at ×8',
    'tiles on screen      320 / 16 = 20 columns, 180 / 16 = 11.25 rows',
    'hero canvas          16 × 24 px  (one tile wide, one and a half tall)',
    'with a 1 px outline  canvas 18 × 26 px  (Canvas size +1 on every side)',
    'pixels per frame     16 × 24 = 384      (32 × 32 would be 1024, 2.7× the work)',
    'RGBA frame (raw)     384 px × 4 bytes = 1536 bytes',
    'indexed frame (raw)  384 px × 1 byte  = 384 bytes + a 33-entry palette (transparent + DB32)'],
    after:'Raw sizes show what each pixel stores; the PNG files on disk are compressed and smaller. The 33-entry palette is what a new indexed sprite starts with: index 0 transparent, then the 32 DawnBringer colours.'},
   verify:{title:'Check the sprite before you animate it',steps:[
    'View it at 100 % and at a whole zoom (200 %, 300 %): the silhouette should still read at 1×, where the player will see it.',
    'Open the Palette audit and press Check: the colour count per frame should be at or under your budget, with no off-palette colours.',
    'Draw a diagonal with the pencil and zoom in: no L-shaped corner pixels means pixel-perfect is on.',
    'Export the frame as PNG from the Pixel menu and reopen it: an indexed frame that uses only palette colours is written as PNG-8 with its palette.']},
   trouble:{rows:[
    ['Diagonals look thick or jagged','Pixel-perfect is off, or the brush is larger than 1 px','Tool options bar: Pixel-perfect toggle and Size','Turn Pixel-perfect on, set the brush to 1 with [ and redraw the stroke'],
    ['The brush paints a slightly different colour than the one picked','The sprite is indexed: painting snaps to the nearest palette entry','The Colour panel says "Indexed sprite: painting uses the nearest palette colour"','Add the colour to the palette first (Palette panel, add the foreground colour), then paint'],
    ['Nothing happens when painting','The layer is locked or hidden, or no layer is selected','The status message names the locked or hidden layer; check the lock and eye icons in Layers','Unlock or show the layer, or pick another one'],
    ['The outline or a limb is cut at the border','The art touches the canvas edge','Look for opaque pixels in the outermost row or column','Pixel › Canvas size… (Ctrl+Alt+C) adds pixels on each side without scaling anything'],
    ['The sprite is sharp here but blurry in the engine','The engine filters the texture (linear filtering or mipmaps)','Zoom the game view: soft edges mean filtering','Set nearest filtering in the engine; see [[game/godot-pixel-art-blurry|blurry pixel art in Godot]] or [[game/unity-pixel-art-blurry|in Unity]]']]},
   alternatives:{rows:[
    ['Aseprite (paid desktop app)','You need layer groups, tilemap layers, rotation of a selection, custom brushes or Lua scripts. The files move both ways; see [[game/aseprite-alternative|the comparison]].'],
    ['Cleaning up an existing upscaled or generated image instead of drawing','Your art already exists at the wrong scale: use [[game/pixel-art-downscaler|the downscaler]] or [[game/fix-ai-pixel-art|the generated-art cleanup]] first, then edit the result here.'],
    ['Drawing the frames as an animation from the start','When the sprite will move, set up frames and tags right away: [[game/pixel-art-animation|pixel-art animation]].']]},
   limits:['No layer groups, tilemap layers, reference layers or linked cels; no rotation or scaling of a selection beyond flips and 90° turns.','No grayscale colour mode: sprites are RGB or indexed.','The symmetry axis is typed as a number, not dragged on the canvas.'],
   versions:{body:['Nerulio: the Pixel workspace\'s pure modules are covered by `tests/studio-pixel.test.mjs` (34 tests) and a 76-check browser suite on real CC0 sprites; .aseprite files written here reopened in Aseprite 1.3.18 with layers, blend mode and indexed palette intact. Painting a 512×512, 100-frame sprite stayed interactive (21–25 ms to commit a stroke) in headless Chromium. Colour-mode and default-palette statements about Aseprite follow its documentation.'],
    sources:[s('Aseprite docs: Color Mode',A.colorMode),s('Aseprite docs: Default Palette',A.defaultPalette),s('Aseprite docs: Canvas Size',A.canvas)]}
  },
  ko:{
   answer:'도트 스프라이트를 그리기 전에 세 가지를 먼저 정하세요. 게임 해상도에 맞춘 캔버스 크기(16px 타일 격자 위를 걷는 캐릭터라면 16×16~32×32 안에 들어갑니다), 적은 수의 팔레트, 안티앨리어싱 없는 1px 가장자리입니다. Nerulio 픽셀 작업 공간에서 픽셀 › 새 스프라이트…를 고르면 DawnBringer 32 팔레트가 든 32×32 캔버스(1~4096 사이 아무 크기)가 RGB 또는 인덱스 모드로 열리고, 도구는 에이스프라이트와 같은 키로 바뀝니다. 결과는 `.aseprite`나 PNG 프레임으로 저장하며, 브라우저에서 동작하고 그림은 기기 밖으로 나가지 않습니다.',
   concept:{title:'크기, 색 모드, 깔끔한 가장자리: 스프라이트를 정하는 세 가지',body:[
    '도트는 게임이 실제로 그리는 크기로 그린 뒤 정수 배로 키워야 픽셀이 네모나게 유지됩니다. 그러니 게임의 내부 해상도에서 출발하세요. 320×180으로 그리는 게임은 6배로 1920×1080, 8배로 2560×1440, 12배로 3840×2160을 채우고, 640×360이라면 배율은 3·4·6입니다. 16px 타일이면 320×180 화면에 가로 20칸, 세로 11.25칸이 보이므로 16×16이나 16×24 주인공은 타일 한 칸 폭이 됩니다. 크기는 작업량도 정합니다. 한 변을 두 배로 늘리면 애니메이션 프레임마다 그릴 픽셀이 네 배가 됩니다(16×16 = 256px, 32×32 = 1024px, 64×64 = 4096px).',
    'RGB(RGBA)는 픽셀마다 값 네 개를 저장하고 팔레트와 무관합니다. RGB 스프라이트에서 팔레트는 색 견본 모음일 뿐이라 견본을 고쳐도 픽셀은 바뀌지 않습니다. 인덱스 색은 픽셀마다 최대 256칸 팔레트를 가리키는 번호 하나를 저장하고, 그중 한 칸이 투명으로 그려집니다(기본은 0번, 에이스프라이트와 같은 규칙). 한 칸을 바꾸면 그 번호를 쓰는 모든 프레임의 픽셀이 함께 바뀌므로 팔레트 교체가 쉽습니다. Nerulio는 인덱스 셀을 PNG-8(PLTE 팔레트와 tRNS 투명도)로 보관하고, 인덱스 스프라이트에서 브러시는 항상 가장 가까운 팔레트 색으로 칠합니다.',
    '깔끔한 선은 규칙적인 계단에서 나옵니다. 손으로 그은 대각선에는 L자로 겹친 모서리가 생기는데, 픽셀 퍼펙트 필터가 그리는 동안 이를 지우며 기본으로 켜져 있습니다. 직선은 계단이 반복될 때 고르게 보입니다. 직선 도구에서 Shift를 누르면 0°, 26.57°(가로 2칸에 세로 1칸), 45°, 63.43°(가로 1칸에 세로 2칸), 90°로 맞춰집니다.'],
    terms:[['내부 해상도','게임이 확대하기 전에 화면을 그리는 크기. 예: 320×180.'],['정수 배율 확대','2·3·4배처럼 키워 원본 픽셀 하나가 정확한 정사각 블록이 되게 하는 방식.'],['인덱스 색','픽셀마다 팔레트 번호(0~255)를 저장하고, 실제 색은 팔레트에 있는 방식.'],['투명 인덱스','인덱스 스프라이트에서 투명으로 그려지는 팔레트 칸. 바꾸지 않으면 0번.'],['픽셀 퍼펙트 선','여분의 모서리 픽셀을 지워 대각선이 한 픽셀 두께로 유지되는 손그림 선.']]},
   example:{title:'예시: 320×180 게임의 16px 격자용 주인공 크기 정하기',lead:'픽셀 › 새 스프라이트…에 입력할 캔버스 크기의 근거입니다.',lines:[
    '게임 해상도          320 × 180        → 6배 1920 × 1080, 8배 2560 × 1440',
    '화면의 타일 수       320 / 16 = 가로 20칸, 180 / 16 = 세로 11.25칸',
    '주인공 캔버스        16 × 24 px  (타일 1칸 폭, 1.5칸 높이)',
    '1px 외곽선 포함      캔버스 18 × 26 px  (캔버스 크기에서 사방 +1)',
    '프레임당 픽셀        16 × 24 = 384      (32 × 32면 1024, 작업량 2.7배)',
    'RGBA 프레임(원시)    384 px × 4바이트 = 1536바이트',
    '인덱스 프레임(원시)  384 px × 1바이트 = 384바이트 + 팔레트 33칸(투명 + DB32)'],
    after:'원시 크기는 픽셀 하나에 무엇이 저장되는지 보여 줄 뿐이며, 디스크의 PNG 파일은 압축되어 더 작습니다. 팔레트 33칸은 새 인덱스 스프라이트의 시작 상태입니다. 0번이 투명이고 그 뒤에 DawnBringer 32색이 옵니다.'},
   verify:{title:'애니메이션 전에 스프라이트 확인하기',steps:[
    '100 %와 정수 배율(200 %, 300 %)로 봅니다. 플레이어가 보게 될 1배에서도 실루엣이 읽혀야 합니다.',
    '팔레트 검사를 열고 검사를 누릅니다. 프레임별 색 수가 예산 이하이고 팔레트 밖 색이 없어야 합니다.',
    '연필로 대각선을 긋고 확대합니다. L자 모서리 픽셀이 없으면 픽셀 퍼펙트가 켜진 것입니다.',
    '픽셀 메뉴에서 프레임을 PNG로 내보내 다시 엽니다. 팔레트 색만 쓰는 인덱스 프레임은 팔레트가 든 PNG-8로 저장됩니다.']},
   trouble:{rows:[
    ['대각선이 두껍거나 들쭉날쭉함','픽셀 퍼펙트가 꺼졌거나 브러시가 1px보다 큼','도구 옵션 줄의 픽셀 퍼펙트 토글과 크기','픽셀 퍼펙트를 켜고 [ 키로 브러시를 1로 줄인 뒤 다시 긋기'],
    ['고른 색과 조금 다른 색으로 칠해짐','인덱스 스프라이트라 가장 가까운 팔레트 칸으로 맞춰짐','색 패널에 인덱스 스프라이트는 가장 가까운 팔레트 색을 쓴다는 안내가 보임','먼저 팔레트 패널에서 전경색을 팔레트에 추가한 뒤 칠하기'],
    ['칠해도 아무 변화가 없음','레이어가 잠겼거나 숨겨졌거나, 선택된 레이어가 없음','상태 메시지가 잠기거나 숨은 레이어 이름을 알려 줌. 레이어 패널의 자물쇠·눈 아이콘 확인','레이어 잠금을 풀거나 보이게 하거나, 다른 레이어 선택'],
    ['외곽선이나 팔다리가 가장자리에서 잘림','그림이 캔버스 끝에 닿아 있음','가장 바깥 줄·칸에 불투명 픽셀이 있는지 확인','픽셀 › 캔버스 크기…(Ctrl+Alt+C)로 확대 없이 사방에 여백 추가'],
    ['여기서는 선명한데 엔진에서는 흐림','엔진이 텍스처를 필터링함(선형 필터나 밉맵)','게임 화면을 확대했을 때 가장자리가 부드러우면 필터링','엔진에서 최근접 필터로 설정. [[game/godot-pixel-art-blurry|Godot에서 흐린 도트]], [[game/unity-pixel-art-blurry|Unity에서 흐린 도트]] 참고']]},
   alternatives:{rows:[
    ['에이스프라이트(유료 데스크톱 앱)','레이어 그룹, 타일맵 레이어, 선택 영역 회전, 사용자 브러시, Lua 스크립트가 필요할 때. 파일은 양쪽으로 오갑니다. [[game/aseprite-alternative|비교 페이지]] 참고.'],
    ['새로 그리지 않고 확대·생성된 그림을 정리','이미 그림이 잘못된 배율로 있을 때는 [[game/pixel-art-downscaler|도트 축소]]나 [[game/fix-ai-pixel-art|생성 그림 정리]]를 먼저 거친 뒤 여기서 다듬으세요.'],
    ['처음부터 애니메이션으로 그리기','움직일 스프라이트라면 프레임과 태그를 바로 준비하세요. [[game/pixel-art-animation|도트 애니메이션]] 참고.']]},
   limits:['레이어 그룹, 타일맵 레이어, 참조 레이어, 링크된 셀이 없고, 선택 영역은 뒤집기와 90° 회전만 됩니다(자유 회전·크기 조절 없음).','그레이스케일 색 모드는 없으며 스프라이트는 RGB 또는 인덱스입니다.','대칭 축은 숫자로 입력하며 캔버스에서 끌어 옮길 수 없습니다.'],
   versions:{body:['Nerulio: 픽셀 작업 공간의 순수 모듈은 `tests/studio-pixel.test.mjs`(테스트 34개)와 실제 CC0 스프라이트로 76가지를 확인하는 브라우저 테스트가 다룹니다. 여기서 쓴 .aseprite 파일은 Aseprite 1.3.18에서 레이어·블렌드 모드·인덱스 팔레트가 그대로 열렸습니다. 512×512에 100프레임인 스프라이트도 헤드리스 Chromium에서 선 확정 21~25ms로 바로 반응했습니다. 에이스프라이트의 색 모드와 기본 팔레트에 관한 설명은 공식 문서를 따릅니다.'],
    sources:[s('Aseprite 문서: Color Mode',A.colorMode),s('Aseprite 문서: Default Palette',A.defaultPalette),s('Aseprite 문서: Canvas Size',A.canvas)]}
  },
  ja:{
   answer:'ドット絵のスプライトを描く前に、3つを決めておきます。ゲームの解像度に合わせたキャンバスサイズ（16pxのタイルグリッドを歩くキャラなら16×16〜32×32に収まる大きさ）、少ない色数のパレット、アンチエイリアスのない1pxの輪郭です。Nerulioのピクセル作業画面でピクセル › 新しいスプライト…を選ぶと、DawnBringer 32パレット入りの32×32キャンバス（1〜4096の任意サイズ）がRGBかインデックスで開き、ツールはAsepriteと同じキーで切り替わります。結果は`.aseprite`かPNGフレームで保存でき、ブラウザで動き、絵が端末の外に出ることはありません。',
   concept:{title:'サイズ、カラーモード、きれいな輪郭：スプライトを決める3つの判断',body:[
    'ドット絵はゲームが実際に描画する大きさで描き、整数倍で拡大してピクセルを正方形のまま保ちます。出発点はゲームの内部解像度です。320×180で描くゲームなら6倍で1920×1080、8倍で2560×1440、12倍で3840×2160を埋め、640×360なら倍率は3・4・6です。16pxタイルなら320×180の画面に横20マス、縦11.25マスが見えるので、16×16や16×24の主人公はタイル1マス分の幅になります。サイズは作業量も決めます。一辺を2倍にするとアニメの1フレームごとに描くピクセルは4倍です（16×16 = 256px、32×32 = 1024px、64×64 = 4096px）。',
    'RGB（RGBA）はピクセルごとに4つの値を持ち、パレットに依存しません。RGBスプライトのパレットは色見本の集まりで、見本を直してもピクセルは変わりません。インデックスカラーはピクセルごとに最大256色のパレットを指す番号を1つ持ち、そのうち1色が透明として描かれます（既定は0番で、Asepriteと同じ決まり）。1色を変えるとその番号を使う全フレームのピクセルが一緒に変わるので、パレット替えが簡単です。Nerulioはインデックスのセルを PNG-8（PLTEパレットとtRNSの透明度）で保持し、インデックスのスプライトではブラシが常に最も近いパレット色で塗ります。',
    'きれいな線は規則的な階段から生まれます。フリーハンドの斜め線にはL字に重なった角ができますが、ピクセルパーフェクトのフィルターが描きながら取り除き、最初からオンです。直線は段が繰り返すと均一に見えます。直線ツールでShiftを押すと、0°、26.57°（横2・縦1）、45°、63.43°（横1・縦2）、90°にそろいます。'],
    terms:[['内部解像度','ゲームが拡大する前に画面を描く大きさ。例：320×180。'],['整数倍拡大','2・3・4倍などで拡大し、元の1ピクセルが正確な正方形のブロックになる方法。'],['インデックスカラー','ピクセルごとにパレット番号（0〜255）を持ち、実際の色はパレット側にある方式。'],['透明インデックス','インデックスのスプライトで透明として描かれるパレットの番号。変えなければ0番。'],['ピクセルパーフェクトの線','余分な角のピクセルを取り除き、斜めでも太さ1ピクセルを保つ手描きの線。']]},
   example:{title:'例：320×180のゲームで16pxグリッド用の主人公を決める',lead:'ピクセル › 新しいスプライト…に入れるキャンバスサイズの根拠です。',lines:[
    'ゲーム解像度          320 × 180        → 6倍で1920 × 1080、8倍で2560 × 1440',
    '画面のタイル数        320 / 16 = 横20マス、180 / 16 = 縦11.25マス',
    '主人公のキャンバス    16 × 24 px（タイル1マス幅、1.5マスの高さ）',
    '1pxの縁取り込み       キャンバス 18 × 26 px（キャンバスサイズで上下左右+1）',
    '1フレームのピクセル   16 × 24 = 384      （32 × 32なら1024、作業量2.7倍）',
    'RGBAフレーム（生）    384 px × 4バイト = 1536バイト',
    'インデックス（生）    384 px × 1バイト = 384バイト + 33色のパレット（透明 + DB32）'],
    after:'生のサイズは1ピクセルに何が入るかを示すだけで、ディスク上のPNGは圧縮されてもっと小さくなります。33色のパレットは新しいインデックスのスプライトの初期状態で、0番が透明、その後にDawnBringerの32色が続きます。'},
   verify:{title:'アニメーションの前にスプライトを確認する',steps:[
    '100 %と整数倍（200 %、300 %）で表示します。プレイヤーが見る等倍でもシルエットが読み取れるはずです。',
    'パレット検査を開いてチェックを押します。フレームごとの色数が予算以内で、パレット外の色がないはずです。',
    '鉛筆で斜め線を引いて拡大します。L字の角のピクセルがなければピクセルパーフェクトがオンです。',
    'ピクセルメニューからフレームをPNGで書き出して開き直します。パレット色だけのインデックスのフレームは、パレット付きのPNG-8で保存されます。']},
   trouble:{rows:[
    ['斜め線が太い・ギザギザ','ピクセルパーフェクトがオフか、ブラシが1pxより大きい','ツールオプションのピクセルパーフェクトとサイズを確認','ピクセルパーフェクトをオンにし、[キーでブラシを1にして引き直す'],
    ['選んだ色と少し違う色で塗られる','インデックスのスプライトなので最も近いパレット色にそろう','カラーパネルにインデックスでは最も近いパレット色を使うという注意が出る','先にパレットパネルで描画色をパレットに追加してから塗る'],
    ['塗っても何も変わらない','レイヤーがロック・非表示、またはレイヤー未選択','状態メッセージがロック中・非表示のレイヤー名を示す。レイヤーパネルの鍵と目のアイコンを確認','ロックを外す、表示する、または別のレイヤーを選ぶ'],
    ['縁取りや手足が端で切れる','絵がキャンバスの端に接している','いちばん外側の行・列に不透明ピクセルがあるか確認','ピクセル › キャンバスサイズ…（Ctrl+Alt+C）で拡大せずに上下左右へ余白を足す'],
    ['ここではくっきりなのにエンジンではぼやける','エンジンがテクスチャをフィルタリングしている（リニアやミップマップ）','ゲーム画面を拡大して縁がやわらかければフィルタリング','エンジン側でニアレストに設定。[[game/godot-pixel-art-blurry|Godotでぼやける場合]]、[[game/unity-pixel-art-blurry|Unityの場合]]を参照']]},
   alternatives:{rows:[
    ['Aseprite（有料のデスクトップアプリ）','レイヤーグループ、タイルマップレイヤー、選択範囲の回転、カスタムブラシ、Luaスクリプトが必要なとき。ファイルは双方向にやり取りできます。[[game/aseprite-alternative|比較ページ]]を参照。'],
    ['描き起こさず、拡大・生成された絵を整える','絵がすでに違う倍率で存在するなら、先に[[game/pixel-art-downscaler|ドット絵の縮小]]か[[game/fix-ai-pixel-art|生成画像の整理]]を通し、その結果をここで直します。'],
    ['最初からアニメーションとして描く','動かすスプライトなら、すぐにフレームとタグを用意します。[[game/pixel-art-animation|ドット絵アニメーション]]を参照。']]},
   limits:['レイヤーグループ、タイルマップレイヤー、参照レイヤー、リンクセルはありません。選択範囲は反転と90°回転のみで、自由な回転・拡大縮小はできません。','グレースケールのカラーモードはなく、スプライトはRGBかインデックスです。','対称軸は数値で入力し、キャンバス上でドラッグはできません。'],
   versions:{body:['Nerulio：ピクセル作業画面の純粋なモジュールは`tests/studio-pixel.test.mjs`（34テスト）と、実在のCC0スプライトで76項目を確かめるブラウザテストで検証しています。ここで書き出した.asepriteはAseprite 1.3.18でレイヤー・合成モード・インデックスのパレットを保ったまま開きました。512×512で100フレームのスプライトでも、ヘッドレスChromiumで線の確定は21〜25msでした。Asepriteのカラーモードと既定パレットの説明は公式ドキュメントに基づきます。'],
    sources:[s('Asepriteドキュメント：Color Mode',A.colorMode),s('Asepriteドキュメント：Default Palette',A.defaultPalette),s('Asepriteドキュメント：Canvas Size',A.canvas)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── pixel art animation
 'game/pixel-art-animation':{
  type:'create',
  intent:{primary:'animate pixel art frame by frame (walk cycle, idle) in the browser',secondary:['how many frames and how many milliseconds for walk and idle','onion skin','per-frame durations vs FPS','export GIF / APNG / engine files'],
   goal:'a looping walk and idle animation with sensible frame counts and timing, playable and exportable',
   input:'a drawn sprite, or frames from GIF / APNG / numbered PNGs / .aseprite',output:'.aseprite with tags and per-frame durations; GIF or APNG per animation and engine bundles in Pack & Export',
   target:'GIF / APNG preview, Godot / Unity / Phaser through Pack & Export',support:'full',
   evidence:['src/studio/sprite/playback.js (DEFAULT_DURATION 100 ms)','src/game/export/anim.js (GIF delays in 1/100 s, minimum 20 ms; APNG exact ms)','docs/STUDIO-SPRITE.md (timeline, onion skin, tags)','docs/STUDIO-PIXEL.md §7 (100 ms playback measured)'],
   external:['GIF89a: Delay Time in hundredths of a second','Aseprite docs: onion skinning, frame duration']},
  en:{
   answer:'A pixel-art animation is a short loop of frames, each shown for its own number of milliseconds. A workable walk cycle is 6 or 8 frames at about 100 ms (0.6–0.8 s for two steps); an idle is 2–4 frames held longer, 150–300 ms each, so the character breathes instead of buzzing. In the Pixel workspace, Alt+N copies the current frame to redraw the next pose, F3 shows onion skin, each frame gets its own duration (100 ms by default) and Enter plays the loop; save `.aseprite` or export GIF, APNG or engine files per tag.',
   concept:{title:'Frame count, timing and why per-frame durations matter',body:[
    'A walk cycle is two steps. Each step passes through the same key poses: contact (both feet on the ground, legs widest), down (weight lands, body lowest), passing (one leg passes the other) and up (body highest). Four poses per step gives 8 frames; dropping the down pose gives 6. Draw the contact poses first, check them with onion skin, then add the in-betweens.',
    'Timing is milliseconds per frame, not a global frame rate. Eight frames at 100 ms make an 800 ms cycle, so each step takes 400 ms. An idle loop reads better when the extremes are held: 300 ms on the inhale and exhale poses, 150 ms on the in-betweens. Because every frame in Nerulio keeps its own duration, a hold does not need a duplicated frame.',
    'Where the animation goes changes how timing is stored. GIF counts delays in hundredths of a second, so 125 ms becomes 13 hundredths (130 ms) and the exporter reports it; APNG stores the exact milliseconds. Engines that play one speed per animation get an FPS of 1000 ÷ the average duration plus per-frame multipliers from Nerulio\'s engine exports.'],
    terms:[['Key pose','A drawing that defines the motion: contact, down, passing and up in a walk.'],['In-between','A frame drawn between two key poses to smooth the motion.'],['Onion skin','The previous and next frames shown faintly under the one being drawn.'],['Hold','A frame shown longer than its neighbours to let a pose read.'],['Tag','A named frame range (walk, idle) with a direction and a repeat count.']]},
   example:{title:'Example: timing a walk and an idle',lead:'Durations typed on the timeline, and what each export does with them:',lines:[
    'walk   8 frames × 100 ms          = 800 ms per cycle → 400 ms per step',
    'walk   6 frames × 100 ms          = 600 ms per cycle → 300 ms per step (brisker)',
    'idle   4 frames 300,150,300,150   = 900 ms per breath',
    'engine FPS for idle               = 1000 / average(300,150,300,150) = 1000 / 225 = 4.44',
    '       multipliers 300/225 = 1.33, 150/225 = 0.67',
    'GIF    150 ms → 15/100 s (exact)   125 ms → 13/100 s = 130 ms (rounded)',
    'APNG   125 ms → 125/1000 s (exact)',
    'stride foot moves 16 px back over one 400 ms step → move the character 40 px/s'],
    after:'The last line is the check that stops a walk from sliding: the planted foot should travel backwards at the speed the character travels forwards in the game. If the game moves the character faster or slower, change the durations or the stride, not only the movement speed.'},
   verify:{title:'Check the loop before exporting',steps:[
    'Press Enter and watch at least five loops: a jump or a pause at the seam usually means the last frame repeats the first.',
    'Turn on onion skin (F3) on the passing frame: the contact frames on either side should sit symmetrically around it.',
    'Open the preview window (F7) at 1× or 2×: timing that feels right when zoomed in often feels slow at game size.',
    'After exporting a GIF, read the exporter\'s notes: it reports every delay rounded to hundredths of a second.']},
   trouble:{rows:[
    ['The loop hitches once per cycle','The last frame is a copy of the first, so that pose shows twice in a row','Step with , and . across the seam: two identical frames in a row','Delete the duplicate last frame (Alt+C)'],
    ['The character slides or moonwalks in the game','Stride per cycle does not match the in-game movement speed','Measure how many pixels the planted foot moves per step and divide by the step time','Match the movement speed to the stride (16 px per 400 ms = 40 px/s) or retime the frames'],
    ['The GIF plays faster or slower than the preview','GIF stores delays in 1/100 s; odd millisecond values are rounded, and the exporter uses at least 20 ms','The export notes list the rounded frames','Use multiples of 10 ms, or export APNG, which keeps exact milliseconds'],
    ['Timing is right in Nerulio but not in the engine','The engine was given one FPS for the tag and ignored the per-frame durations','Compare a held frame\'s length in the engine with the timeline','Use the engine bundle from Pack & Export, which writes per-frame multipliers; see [[game/godot-animation-frame-duration|frame duration in Godot]]'],
    ['Onion skin shows nothing','It is switched off, or its opacity is too low, or you are on the first frame of the range','Timeline: the onion skin button and its settings','Press F3 and raise the opacity; step to a frame with neighbours']]},
   alternatives:{rows:[
    ['Aseprite','You want linked cels to reuse one drawing across held frames, or tags and onion skin in a desktop app; its documentation covers onion skinning and frame durations.'],
    ['Assembling frames drawn elsewhere','The poses already exist as PNGs: build the animation in [[game/sprite-animator|the sprite animator]] and set durations there.'],
    ['Previewing an existing sheet','You only need to watch the loop, not edit it: [[game/sprite-animation-preview|sprite animation preview]].']]},
   limits:[', and . stop at the first and last frame instead of wrapping; use Enter or loop inside a tag to watch the cycle.','No linked cels: a pose used twice is two copies of its pixels.','No automatic in-betweening; every frame is drawn.'],
   versions:{body:['Nerulio: new frames default to 100 ms (src/studio/sprite/playback.js); playback of a 512×512, 100-frame sprite kept 100 ms frames on time (20 frames in 2 s) in headless Chromium; the GIF writer rounds to 1/100 s with a 20 ms floor and reports it, and the APNG writer keeps exact milliseconds (src/game/export/anim.js). GIF timing follows the GIF89a specification.'],
    sources:[s('W3C: GIF89a specification (Delay Time)',GIF89A),s('Aseprite docs: Onion Skinning',A.onion),s('Aseprite docs: Frame Duration',A.duration)]}
  },
  ko:{
   answer:'도트 애니메이션은 프레임마다 정해진 밀리초 동안 보여 주는 짧은 반복입니다. 걷기는 6~8프레임을 약 100ms씩(두 걸음에 0.6~0.8초) 쓰면 무난하고, 대기 동작은 2~4프레임을 150~300ms씩 더 오래 보여 줘야 떨리지 않고 숨 쉬는 느낌이 납니다. 픽셀 작업 공간에서 Alt+N은 현재 프레임을 복사해 다음 자세를 그리게 하고, F3은 어니언 스킨, 프레임마다 시간을 따로(기본 100ms) 정하며 Enter로 반복 재생합니다. `.aseprite`로 저장하거나 태그마다 GIF·APNG·엔진 파일로 내보내세요.',
   concept:{title:'프레임 수, 타이밍, 그리고 프레임별 시간이 중요한 이유',body:[
    '걷기 한 주기는 두 걸음입니다. 걸음마다 같은 핵심 자세를 지납니다. 접지(두 발이 땅에 닿고 다리가 가장 벌어짐), 하강(체중이 실리며 몸이 가장 낮음), 교차(한 다리가 다른 다리를 지나침), 상승(몸이 가장 높음)입니다. 걸음당 네 자세면 8프레임, 하강을 빼면 6프레임입니다. 접지 자세를 먼저 그려 어니언 스킨으로 확인한 뒤 중간 프레임을 채우세요.',
    '타이밍은 전체 프레임률이 아니라 프레임당 밀리초입니다. 100ms 프레임 8개는 800ms 주기라 한 걸음이 400ms입니다. 대기 동작은 양 끝 자세를 오래 둘 때 잘 읽힙니다. 들숨·날숨 자세에 300ms, 중간 프레임에 150ms를 주는 식입니다. Nerulio는 프레임마다 시간을 따로 가지므로 멈춤을 위해 프레임을 복제할 필요가 없습니다.',
    '애니메이션이 어디로 가느냐에 따라 시간 저장 방식이 달라집니다. GIF는 지연을 1/100초 단위로 세므로 125ms는 13(130ms)이 되고 내보내기가 이를 알려 줍니다. APNG는 밀리초를 그대로 저장합니다. 애니메이션마다 속도 하나로 재생하는 엔진에는 Nerulio 엔진 내보내기가 1000 ÷ 평균 시간을 FPS로, 프레임별 배수를 함께 씁니다.'],
    terms:[['핵심 자세','동작을 정하는 그림. 걷기에서는 접지·하강·교차·상승.'],['중간 프레임','두 핵심 자세 사이에 넣어 동작을 부드럽게 하는 프레임.'],['어니언 스킨','그리는 프레임 아래에 이전·다음 프레임을 흐리게 보여 주는 기능.'],['멈춤','자세가 읽히도록 이웃 프레임보다 오래 보여 주는 프레임.'],['태그','방향과 반복 횟수가 있는 이름 붙은 프레임 구간(walk, idle).']]},
   example:{title:'예시: 걷기와 대기 동작의 타이밍',lead:'타임라인에 입력한 시간과 각 내보내기가 그 값을 다루는 방식입니다.',lines:[
    'walk   8프레임 × 100 ms          = 주기 800 ms → 한 걸음 400 ms',
    'walk   6프레임 × 100 ms          = 주기 600 ms → 한 걸음 300 ms (더 빠른 걸음)',
    'idle   4프레임 300,150,300,150   = 한 번 숨쉬기 900 ms',
    'idle의 엔진 FPS                  = 1000 / 평균(300,150,300,150) = 1000 / 225 = 4.44',
    '       배수 300/225 = 1.33, 150/225 = 0.67',
    'GIF    150 ms → 15/100초(정확)   125 ms → 13/100초 = 130 ms(반올림)',
    'APNG   125 ms → 125/1000초(정확)',
    '보폭   딛은 발이 한 걸음(400 ms) 동안 16 px 뒤로 → 캐릭터를 초당 40 px 이동'],
    after:'마지막 줄은 걷기가 미끄러지지 않게 하는 검산입니다. 딛고 있는 발이 뒤로 가는 속도가 게임에서 캐릭터가 앞으로 가는 속도와 같아야 합니다. 게임의 이동 속도가 다르다면 이동 속도만 바꾸지 말고 프레임 시간이나 보폭을 고치세요.'},
   verify:{title:'내보내기 전에 반복 확인하기',steps:[
    'Enter를 눌러 최소 다섯 번 반복을 봅니다. 이음매에서 튀거나 멈칫하면 대개 마지막 프레임이 첫 프레임과 같은 경우입니다.',
    '교차 프레임에서 어니언 스킨(F3)을 켭니다. 양옆의 접지 프레임이 좌우 대칭으로 놓여야 합니다.',
    '미리보기 창(F7)을 1배나 2배로 엽니다. 확대해서 적당했던 타이밍이 실제 크기에서는 느리게 느껴지는 경우가 많습니다.',
    'GIF로 내보낸 뒤 내보내기 안내를 읽습니다. 1/100초로 반올림된 프레임이 모두 표시됩니다.']},
   trouble:{rows:[
    ['한 주기마다 한 번씩 덜컥거림','마지막 프레임이 첫 프레임의 복사본이라 같은 자세가 두 번 연속 나옴','쉼표·마침표로 이음매를 넘겨 보면 같은 프레임이 연달아 있음','중복된 마지막 프레임 삭제(Alt+C)'],
    ['게임에서 캐릭터가 미끄러지거나 문워크함','한 주기의 보폭과 게임 속 이동 속도가 맞지 않음','딛은 발이 한 걸음에 몇 픽셀 움직이는지 재서 걸음 시간으로 나누기','이동 속도를 보폭에 맞추거나(400ms에 16px = 초당 40px) 프레임 시간을 다시 정하기'],
    ['GIF가 미리보기보다 빠르거나 느림','GIF는 지연을 1/100초로 저장해 애매한 밀리초는 반올림되고, 최소 20ms가 적용됨','내보내기 안내에 반올림된 프레임이 나옴','10ms 배수로 정하거나 밀리초를 그대로 지키는 APNG로 내보내기'],
    ['Nerulio에서는 맞는데 엔진에서 타이밍이 다름','엔진에 태그 하나당 FPS만 주고 프레임별 시간은 버림','멈춤 프레임의 길이를 엔진과 타임라인에서 비교','프레임별 배수를 쓰는 패킹·내보내기의 엔진 번들 사용. [[game/godot-animation-frame-duration|Godot 프레임 시간]] 참고'],
    ['어니언 스킨에 아무것도 안 보임','꺼져 있거나 불투명도가 너무 낮거나 구간의 첫 프레임에 있음','타임라인의 어니언 스킨 버튼과 설정 확인','F3을 누르고 불투명도를 올린 뒤 이웃 프레임이 있는 곳으로 이동']]},
   alternatives:{rows:[
    ['에이스프라이트','멈춘 프레임들에 그림 하나를 재사용하는 링크된 셀이나, 데스크톱 앱의 태그·어니언 스킨이 필요할 때. 어니언 스킨과 프레임 시간은 공식 문서에 설명돼 있습니다.'],
    ['다른 곳에서 그린 프레임 모으기','자세가 이미 PNG로 있다면 [[game/sprite-animator|스프라이트 애니메이터]]에서 애니메이션을 만들고 시간을 정하세요.'],
    ['기존 시트 미리보기','편집 없이 반복만 보려면 [[game/sprite-animation-preview|스프라이트 애니메이션 미리보기]].']]},
   limits:['쉼표·마침표는 처음과 끝에서 멈추고 돌아가지 않습니다. 계속 보려면 Enter나 태그 안 반복을 쓰세요.','링크된 셀이 없어 두 번 쓰는 자세는 픽셀이 두 벌 저장됩니다.','중간 프레임 자동 생성은 없으며 모든 프레임을 직접 그립니다.'],
   versions:{body:['Nerulio: 새 프레임의 기본 시간은 100ms입니다(src/studio/sprite/playback.js). 512×512에 100프레임인 스프라이트에서 100ms 프레임이 제시간에 재생됐습니다(헤드리스 Chromium, 2초에 20프레임). GIF 내보내기는 1/100초로 반올림하고 최소 20ms를 두며 이를 알려 주고, APNG 내보내기는 밀리초를 그대로 씁니다(src/game/export/anim.js). GIF 타이밍 설명은 GIF89a 사양을 따릅니다.'],
    sources:[s('W3C: GIF89a 사양(Delay Time)',GIF89A),s('Aseprite 문서: Onion Skinning',A.onion),s('Aseprite 문서: Frame Duration',A.duration)]}
  },
  ja:{
   answer:'ドット絵アニメーションは、フレームごとに決まったミリ秒だけ表示する短いループです。歩きは6〜8フレームを約100msずつ（2歩で0.6〜0.8秒）にすると扱いやすく、待機は2〜4フレームを150〜300msずつ長めに見せると、震えずに呼吸しているように見えます。ピクセル作業画面では、Alt+Nで現在のフレームを複製して次のポーズを描き、F3でオニオンスキン、フレームごとに時間（既定100ms）を設定し、Enterでループ再生します。`.aseprite`で保存するか、タグごとにGIF・APNG・エンジン用ファイルで書き出します。',
   concept:{title:'フレーム数、タイミング、そしてフレームごとの時間が大切な理由',body:[
    '歩きの1サイクルは2歩です。1歩ごとに同じキーポーズを通ります。接地（両足が地面につき脚が最も開く）、沈み込み（体重が乗り体が最も低い）、交差（片脚がもう片方を追い越す）、伸び上がり（体が最も高い）です。1歩4ポーズなら8フレーム、沈み込みを省けば6フレームです。まず接地のポーズを描いてオニオンスキンで確かめ、それから中割りを足します。',
    'タイミングは全体のフレームレートではなく、1フレームあたりのミリ秒です。100msのフレーム8枚は800msのサイクルで、1歩は400msです。待機は両端のポーズを長めに止めると読みやすくなります。吸う・吐くポーズに300ms、中割りに150msといった具合です。Nerulioはフレームごとに時間を持つので、止めのためにフレームを複製する必要はありません。',
    '書き出し先によって時間の持ち方が変わります。GIFは遅延を1/100秒単位で数えるため125msは13（130ms）になり、書き出し時に知らせます。APNGはミリ秒をそのまま保存します。アニメごとに1つの速度で再生するエンジン向けには、Nerulioのエンジン書き出しが1000 ÷ 平均時間をFPSとし、フレームごとの倍率も書きます。'],
    terms:[['キーポーズ','動きを決める絵。歩きなら接地・沈み込み・交差・伸び上がり。'],['中割り','2つのキーポーズの間に入れて動きをなめらかにするフレーム。'],['オニオンスキン','描いているフレームの下に前後のフレームを薄く表示する機能。'],['止め','ポーズが伝わるよう、前後より長く表示するフレーム。'],['タグ','方向と繰り返し回数を持つ、名前付きのフレーム範囲（walk、idle）。']]},
   example:{title:'例：歩きと待機のタイミング',lead:'タイムラインに入れた時間と、それぞれの書き出しでの扱いです。',lines:[
    'walk   8フレーム × 100 ms         = 1サイクル800 ms → 1歩400 ms',
    'walk   6フレーム × 100 ms         = 1サイクル600 ms → 1歩300 ms（速めの歩き）',
    'idle   4フレーム 300,150,300,150  = 1呼吸900 ms',
    'idleのエンジンFPS                 = 1000 / 平均(300,150,300,150) = 1000 / 225 = 4.44',
    '       倍率 300/225 = 1.33、150/225 = 0.67',
    'GIF    150 ms → 15/100秒（正確）  125 ms → 13/100秒 = 130 ms（丸め）',
    'APNG   125 ms → 125/1000秒（正確）',
    '歩幅   接地した足が1歩（400 ms）で16 px後ろへ → キャラを毎秒40 px移動'],
    after:'最後の行は歩きが滑らないための検算です。接地している足が後ろへ動く速さと、ゲーム内でキャラが前へ進む速さを一致させます。移動速度が違うなら、移動速度だけでなくフレームの時間か歩幅を直してください。'},
   verify:{title:'書き出す前にループを確認する',steps:[
    'Enterで少なくとも5回ループを見ます。つなぎ目で跳ねたり止まったりするなら、たいてい最後のフレームが最初と同じです。',
    '交差のフレームでオニオンスキン（F3）をオンにします。前後の接地フレームが左右対称に並ぶはずです。',
    'プレビューウィンドウ（F7）を1倍か2倍で開きます。拡大時にちょうどよいタイミングは、実寸では遅く感じることがよくあります。',
    'GIFを書き出したら書き出しの注意を読みます。1/100秒に丸めたフレームがすべて表示されます。']},
   trouble:{rows:[
    ['1サイクルに1回カクつく','最後のフレームが最初のコピーで、同じポーズが2回続く','カンマとピリオドでつなぎ目をまたぐと、同じフレームが連続している','重複した最後のフレームを削除（Alt+C）'],
    ['ゲーム内でキャラが滑る・ムーンウォークする','1サイクルの歩幅とゲーム内の移動速度が合っていない','接地した足が1歩で何ピクセル動くか測り、1歩の時間で割る','移動速度を歩幅に合わせる（400msで16px = 毎秒40px）か、フレームの時間を調整'],
    ['GIFがプレビューより速い・遅い','GIFは遅延を1/100秒で保存するため半端なミリ秒は丸められ、最短20msになる','書き出しの注意に丸めたフレームが出る','10msの倍数にするか、ミリ秒を保つAPNGで書き出す'],
    ['Nerulioでは合うのにエンジンではタイミングが違う','エンジンにタグごとのFPSだけを渡し、フレームごとの時間を捨てている','止めのフレームの長さをエンジンとタイムラインで比べる','フレームごとの倍率を書くパック＆書き出しのエンジン用バンドルを使う。[[game/godot-animation-frame-duration|Godotのフレーム時間]]を参照'],
    ['オニオンスキンに何も出ない','オフになっている、不透明度が低すぎる、または範囲の最初のフレームにいる','タイムラインのオニオンスキンのボタンと設定を確認','F3を押して不透明度を上げ、前後にフレームがある位置へ移動']]},
   alternatives:{rows:[
    ['Aseprite','止めのフレームで1枚の絵を使い回すリンクセルや、デスクトップアプリでのタグ・オニオンスキンが欲しいとき。オニオンスキンとフレームの時間は公式ドキュメントに説明があります。'],
    ['ほかで描いたフレームをまとめる','ポーズがすでにPNGであるなら、[[game/sprite-animator|スプライトアニメーター]]でアニメーションを組み、時間を設定します。'],
    ['既存のシートを確認するだけ','編集せずにループを見たいなら[[game/sprite-animation-preview|スプライトアニメーションのプレビュー]]。']]},
   limits:['カンマとピリオドは最初と最後のフレームで止まり、折り返しません。続けて見るにはEnterかタグ内ループを使います。','リンクセルはないため、2回使うポーズはピクセルが2組保存されます。','中割りの自動生成はなく、すべてのフレームを描きます。'],
   versions:{body:['Nerulio：新しいフレームの既定の時間は100msです（src/studio/sprite/playback.js）。512×512で100フレームのスプライトで、100msのフレームが時間どおりに再生されました（ヘッドレスChromium、2秒で20フレーム）。GIFの書き出しは1/100秒に丸めて最短20msとし、その旨を表示します。APNGの書き出しはミリ秒をそのまま書きます（src/game/export/anim.js）。GIFのタイミングはGIF89aの仕様に基づきます。'],
    sources:[s('W3C：GIF89a仕様（Delay Time）',GIF89A),s('Asepriteドキュメント：Onion Skinning',A.onion),s('Asepriteドキュメント：Frame Duration',A.duration)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── palette editor
 'game/pixel-art-palette-editor':{
  type:'create',
  intent:{primary:'build and edit a pixel-art palette for a sprite (ramps, indexed colour)',secondary:['hue-shifted ramps explained','convert RGB to indexed without ruining the picture','reorder or recolour palette entries','export the palette for other tools'],
   goal:'a small, ordered palette of hue-shifted ramps that the sprite uses, in indexed mode, exportable to other tools',
   input:'a sprite (PNG, frames, .aseprite) or a new one; optional palette file or Lospec name',output:'the sprite in indexed colour; palette as .gpl .pal .hex .ase .act .json; indexed .aseprite',
   target:'Aseprite, GIMP, Photoshop and any tool that reads those palette files',support:'full',
   evidence:['src/studio/pixel/ramps.js (hueShiftRamp: OkLCh, cool 265°, warm 85°, base kept)','src/studio/workspaces/pixel/panels.js (ramp dialog defaults 5 / 24 / 18 % / 94 %)','src/studio/pixel/indexed.js (Oklab matcher, transparent index never picked for opaque pixels)','docs/STUDIO-PIXEL.md §6 T5, T6, T14'],
   external:['Aseprite docs: Color Mode, Color Bar, Shading ink, Sprite Properties (transparent colour)']},
  en:{
   answer:'A pixel-art palette is a handful of ramps: each ramp is one material (skin, cloth, metal) going from dark to light in 3–6 steps, and good ramps shift hue as they go, cooler in the shadows and warmer in the lights. In Nerulio\'s Pixel workspace, Pixel › Hue-shifted ramp… builds such a ramp around the foreground colour (5 colours, 24° shift by default, the base kept exactly), Colour mode… turns the sprite into indexed colour with the nearest colour chosen perceptually, and the Palette menu saves the result as .gpl, .pal, .hex, .ase, .act or .json.',
   concept:{title:'Ramps, hue shifting and indexed colour',body:[
    'A ramp that only changes lightness looks grey and muddy in the shadows. Painters shift hue along it instead: the darkest step moves toward blue-violet and loses saturation, the lightest moves toward yellow and also loses some saturation, and the middle keeps the richest colour. Nerulio does this in OkLCh, a colour space where equal lightness steps look equal: shadows move toward hue 265° (blue-violet), lights toward 85° (yellow-orange), each end by up to the Hue shift you type, and the chroma fades toward both ends.',
    'Converting to indexed colour replaces every pixel by a palette index. The choice of "nearest" matters: Nerulio measures distance in Oklab, which follows how the eye sees colour, while Aseprite measures RGB distance. For the green #3e8948 and the PICO-8 palette, Oklab picks PICO-8\'s green #008751, whereas plain RGB distance picks the grey-brown #5f574f. Dithering is off by default, because the noise it adds reads as texture in pixel art.',
    'In an indexed sprite the transparent entry is a palette slot of its own, and an opaque pixel is never matched to it. That is why a palette that starts with black (PICO-8 does) keeps its black pixels black here: the conversion adds a transparent slot in front instead of turning index 0 into the mask.'],
    terms:[['Ramp','An ordered set of colours for one material, dark to light.'],['Hue shift','Rotating the hue along a ramp: shadows cooler, highlights warmer.'],['OkLCh / Oklab','Perceptual colour spaces: L lightness, C chroma (saturation), h hue angle.'],['Shading ink','A brush that moves each pixel one step along the selected ramp.'],['Index map','The renumbering applied to every cel when entries move, so the picture stays the same.']]},
   example:{title:'Example: the ramp Nerulio builds from #3e8948',lead:'Pixel › Hue-shifted ramp… with the default settings (Colours 5, Hue shift 24, Darkest 18 %, Lightest 94 %). Values measured back from the 8-bit colours:',lines:[
    'step  hex      L      C      h',
    '0     #001a0d  0.19   0.044  159°   shadow: darker, hue turned toward blue',
    '1     #005129  0.38   0.097  154°',
    '2     #3e8948  0.57   0.123  146°   base colour, kept exactly',
    '3     #91be77  0.75   0.108  135°',
    '4     #e3f3c1  0.94   0.068  122°   light: brighter, hue turned toward yellow',
    'lightness steps 0.19 → 0.38 → 0.57 → 0.75 → 0.94 (about 0.19 apart)',
    'chroma peaks at the base (0.123) and fades at both ends'],
    after:'The lights moved the full 24° (146° → 122°); the darkest step came back at 159° instead of 170° because a colour that dark has little room left for hue in 8-bit sRGB. Treat the ramp as a starting point: nudge a step by double-clicking it in the Palette panel.'},
   verify:{title:'Check the palette',steps:[
    'Sort by brightness in the Palette menu: each ramp should run dark to light without a step jumping out of order.',
    'Select a ramp with Shift/Ctrl+click and paint with the Shading ink: left click should step lighter, right click darker, one colour at a time.',
    'Run the Palette audit: near-duplicate pairs are listed, which usually means two ramps share a colour that could be merged.',
    'Export the palette and import it again: each format was written and read back identical in the test suite.']},
   trouble:{rows:[
    ['After converting to indexed, all black pixels turned transparent (seen in files from other tools)','The palette\'s index 0 is black and the tool uses index 0 as the transparent colour','In Aseprite, Sprite › Properties shows the transparent colour index','Keep a separate transparent slot (Nerulio adds one in front); in Aseprite change the transparent colour or add an entry'],
    ['The indexed result picks different colours than Aseprite did','Nearest colour is measured in Oklab here and in RGB in Aseprite','Compare one pixel: #3e8948 goes to #008751 here, #5f574f by RGB distance','Keep Nerulio\'s perceptual pick, or convert in Aseprite and open the indexed file here'],
    ['Editing one colour changed pixels everywhere','In an indexed sprite a palette entry is the colour of every pixel that uses it','The edit dialog says every pixel of this index changes with it','Add a new entry for the new colour and repaint only where you want it'],
    ['The Shading ink jumps to unrelated colours','No ramp is selected, so the ink follows the whole palette order','The options bar says "Shading along the palette order"','Shift/Ctrl+click the colours of one ramp, dark to light, before painting'],
    ['The converted sprite looks noisy','A dither pattern was chosen in the Colour mode dialog','Zoom in: checkerboard or Bayer patterns in flat areas','Undo and convert again with Dither: None']]},
   alternatives:{rows:[
    ['Aseprite\'s palette tools','You already work there: the colour bar edits entries, Sprite › Properties sets the transparent colour, and the Shading ink uses the colours selected in the colour bar.'],
    ['A published palette from Lospec','You would rather start from a tested palette than build ramps: see [[game/lospec-palette|using a Lospec palette]], including which file each program reads.'],
    ['Recolouring finished frames without the editor','The sprite is done and only needs a team colour or a status tint: [[game/palette-swap-ramp|ramp swap and team colours]].']]},
   limits:['Ramps are starting points generated from one base colour; they are not art direction.','A palette holds at most 256 colours, and there is no grayscale colour mode.','Nearest-colour matching is Oklab only; Aseprite\'s RGB matching cannot be selected.'],
   versions:{body:['Nerulio: ramps, index maps, the Oklab matcher and every palette reader and writer are unit-tested (`tests/studio-pixel.test.mjs`); the PICO-8 conversion of a 96×144 CC0 sprite gave 100 % of opaque pixels their Oklab-nearest colour with all 1708 black pixels kept black (docs/STUDIO-PIXEL.md §6, T5). The ramp values above were computed with src/studio/pixel/ramps.js. Aseprite\'s behaviour follows its documentation.'],
    sources:[s('Aseprite docs: Color Mode',A.colorMode),s('Aseprite docs: Color Bar',A.colorBar),s('Aseprite docs: Shading ink',A.shading),s('Aseprite docs: Sprite Properties',A.props)]}
  },
  ko:{
   answer:'도트 팔레트는 램프 몇 개로 이뤄집니다. 램프 하나는 피부·옷·금속 같은 한 재질이 어두운 색에서 밝은 색까지 3~6단계로 이어진 것이고, 좋은 램프는 단계마다 색상도 옮겨 가 그림자는 차갑게, 빛은 따뜻하게 갑니다. Nerulio 픽셀 작업 공간의 픽셀 › 색상 이동 램프…는 전경색을 중심으로 이런 램프를 만들고(기본 5색, 24° 이동, 기준 색은 그대로), 색 모드…는 지각적으로 가장 가까운 색을 골라 스프라이트를 인덱스 색으로 바꾸며, 팔레트 메뉴는 결과를 .gpl·.pal·.hex·.ase·.act·.json으로 저장합니다.',
   concept:{title:'램프, 색상 이동, 인덱스 색',body:[
    '명도만 바꾼 램프는 그림자에서 탁하고 회색빛이 됩니다. 그래서 램프를 따라 색상도 옮깁니다. 가장 어두운 단계는 청보라 쪽으로 가며 채도가 줄고, 가장 밝은 단계는 노랑 쪽으로 가며 채도가 조금 줄고, 가운데가 가장 진한 색을 가집니다. Nerulio는 같은 명도 간격이 같게 보이는 색 공간인 OkLCh에서 이 계산을 합니다. 그림자는 색상 265°(청보라), 빛은 85°(주황빛 노랑)를 향해 입력한 색상 이동만큼까지 옮기고, 채도는 양 끝으로 갈수록 줄입니다.',
    '인덱스 색으로 바꾸면 모든 픽셀이 팔레트 번호로 바뀝니다. 이때 무엇을 가장 가깝다고 보느냐가 중요합니다. Nerulio는 눈이 색을 보는 방식을 따르는 Oklab에서 거리를 재고, 에이스프라이트는 RGB 거리를 씁니다. 초록 #3e8948을 PICO-8 팔레트로 바꾸면 Oklab은 PICO-8의 초록 #008751을 고르지만 단순 RGB 거리는 회갈색 #5f574f를 고릅니다. 디더링은 기본으로 꺼져 있습니다. 도트에서는 디더가 만드는 잡음이 질감처럼 보이기 때문입니다.',
    '인덱스 스프라이트에서 투명 칸은 따로 있는 팔레트 칸이며, 불투명 픽셀은 절대 그 칸으로 가지 않습니다. 그래서 검정으로 시작하는 팔레트(PICO-8이 그렇습니다)도 여기서는 검정 픽셀이 검정으로 남습니다. 변환이 0번을 투명으로 만드는 대신 앞에 투명 칸을 하나 추가하기 때문입니다.'],
    terms:[['램프','한 재질의 색을 어두운 것부터 밝은 것까지 순서대로 늘어놓은 묶음.'],['색상 이동','램프를 따라 색상을 돌리는 것. 그림자는 차갑게, 밝은 쪽은 따뜻하게.'],['OkLCh / Oklab','지각 색 공간. L은 명도, C는 채도, h는 색상 각도.'],['셰이딩 잉크','칠할 때마다 픽셀을 선택한 램프에서 한 단계씩 옮기는 브러시.'],['인덱스 표','팔레트 칸을 옮길 때 모든 셀에 적용하는 번호 바꾸기. 그래서 그림이 그대로 유지됩니다.']]},
   example:{title:'예시: #3e8948로 Nerulio가 만드는 램프',lead:'픽셀 › 색상 이동 램프…를 기본값(색 5, 색상 이동 24, 가장 어둡게 18 %, 가장 밝게 94 %)으로 실행한 결과를 8비트 색에서 다시 잰 값입니다.',lines:[
    '단계  hex      L      C      h',
    '0     #001a0d  0.19   0.044  159°   그림자: 더 어둡고 색상은 파랑 쪽으로',
    '1     #005129  0.38   0.097  154°',
    '2     #3e8948  0.57   0.123  146°   기준 색, 그대로 유지',
    '3     #91be77  0.75   0.108  135°',
    '4     #e3f3c1  0.94   0.068  122°   빛: 더 밝고 색상은 노랑 쪽으로',
    '명도 간격 0.19 → 0.38 → 0.57 → 0.75 → 0.94 (약 0.19씩)',
    '채도는 기준 색(0.123)에서 가장 높고 양 끝으로 갈수록 낮아짐'],
    after:'밝은 쪽은 24°를 다 옮겼지만(146° → 122°), 가장 어두운 단계는 170°가 아니라 159°로 돌아왔습니다. 그만큼 어두운 색은 8비트 sRGB에서 색상을 담을 여유가 거의 없기 때문입니다. 램프는 출발점으로 보고, 팔레트 패널에서 칸을 더블클릭해 한 단계씩 다듬으세요.'},
   verify:{title:'팔레트 확인하기',steps:[
    '팔레트 메뉴에서 밝기순으로 정렬합니다. 램프마다 어두운 것에서 밝은 것으로 이어지고 순서를 벗어난 칸이 없어야 합니다.',
    'Shift/Ctrl+클릭으로 램프를 고르고 셰이딩 잉크로 칠합니다. 왼쪽 클릭은 한 단계 밝게, 오른쪽 클릭은 한 단계 어둡게 가야 합니다.',
    '팔레트 검사를 실행합니다. 거의 같은 색 쌍이 나오면 대개 두 램프가 합칠 수 있는 색을 나눠 쓰는 경우입니다.',
    '팔레트를 내보냈다가 다시 가져옵니다. 테스트에서 모든 형식이 쓰고 다시 읽어 똑같았습니다.']},
   trouble:{rows:[
    ['인덱스로 바꾸자 검정 픽셀이 모두 투명해짐(다른 도구에서 만든 파일)','팔레트 0번이 검정인데 도구가 0번을 투명색으로 씀','에이스프라이트에서는 Sprite › Properties에 투명색 번호가 표시됨','투명 칸을 따로 두기(Nerulio는 앞에 하나 추가). 에이스프라이트에서는 투명색을 바꾸거나 칸을 추가'],
    ['인덱스 결과가 에이스프라이트와 다른 색을 고름','여기서는 Oklab, 에이스프라이트는 RGB로 가장 가까운 색을 잼','픽셀 하나로 비교: #3e8948이 여기서는 #008751, RGB 거리로는 #5f574f','Nerulio의 지각 기준 선택을 쓰거나, 에이스프라이트에서 변환한 인덱스 파일을 여기서 열기'],
    ['색 하나를 고쳤더니 여기저기 픽셀이 바뀜','인덱스 스프라이트에서 팔레트 칸은 그 칸을 쓰는 모든 픽셀의 색','편집 대화상자에 이 번호의 모든 픽셀이 함께 바뀐다고 나옴','새 색은 새 칸으로 추가하고 원하는 곳만 다시 칠하기'],
    ['셰이딩 잉크가 엉뚱한 색으로 튐','램프를 고르지 않아 잉크가 팔레트 전체 순서를 따름','옵션 줄에 팔레트 순서를 따라 셰이딩한다고 표시됨','칠하기 전에 한 램프의 색을 어두운 것부터 Shift/Ctrl+클릭'],
    ['변환한 스프라이트가 지저분해 보임','색 모드 대화상자에서 디더 패턴을 골랐음','확대하면 평평한 곳에 체커나 Bayer 무늬가 보임','되돌린 뒤 디더: 없음으로 다시 변환']]},
   alternatives:{rows:[
    ['에이스프라이트의 팔레트 기능','이미 그곳에서 작업한다면. 컬러 바에서 칸을 고치고, Sprite › Properties에서 투명색을 정하며, 셰이딩 잉크는 컬러 바에서 고른 색을 씁니다.'],
    ['Lospec에 공개된 팔레트','램프를 직접 만들기보다 검증된 팔레트에서 시작하고 싶을 때. 프로그램마다 어떤 파일을 읽는지까지 [[game/lospec-palette|Lospec 팔레트 쓰기]]에 정리했습니다.'],
    ['편집기 없이 완성된 프레임 다시 칠하기','그림은 끝났고 팀 색이나 상태 색조만 필요하다면 [[game/palette-swap-ramp|램프 교체와 팀 색]].']]},
   limits:['램프는 기준 색 하나에서 만든 출발점이며 아트 디렉션이 아닙니다.','팔레트는 최대 256색이고 그레이스케일 색 모드는 없습니다.','가장 가까운 색은 Oklab으로만 찾으며 에이스프라이트식 RGB 기준은 고를 수 없습니다.'],
   versions:{body:['Nerulio: 램프, 인덱스 표, Oklab 매칭, 모든 팔레트 읽기·쓰기가 단위 테스트로 확인됩니다(`tests/studio-pixel.test.mjs`). 96×144 CC0 스프라이트를 PICO-8로 바꾸자 불투명 픽셀 100 %가 Oklab 기준 가장 가까운 색이 됐고 검정 픽셀 1708개는 모두 검정으로 남았습니다(docs/STUDIO-PIXEL.md §6, T5). 위 램프 값은 src/studio/pixel/ramps.js로 계산했습니다. 에이스프라이트 동작은 공식 문서를 따릅니다.'],
    sources:[s('Aseprite 문서: Color Mode',A.colorMode),s('Aseprite 문서: Color Bar',A.colorBar),s('Aseprite 문서: Shading',A.shading),s('Aseprite 문서: Sprite Properties',A.props)]}
  },
  ja:{
   answer:'ドット絵のパレットはいくつかのランプでできています。ランプは肌・布・金属など1つの素材を暗い色から明るい色まで3〜6段で並べたもので、良いランプは段ごとに色相もずらし、影は寒色へ、光は暖色へ向かいます。Nerulioのピクセル作業画面では、ピクセル › 色相シフトのランプ…が描画色を中心にこうしたランプを作り（既定5色、24°シフト、基準色はそのまま）、カラーモード…が知覚的に最も近い色を選んでスプライトをインデックスカラーに変え、パレットメニューが結果を.gpl・.pal・.hex・.ase・.act・.jsonで保存します。',
   concept:{title:'ランプ、色相シフト、インデックスカラー',body:[
    '明度だけを変えたランプは、影の部分がにごって灰色っぽくなります。そこでランプに沿って色相もずらします。最も暗い段は青紫へ寄って彩度が下がり、最も明るい段は黄色へ寄って彩度が少し下がり、中央が最も濃い色を持ちます。Nerulioは同じ明度差が同じに見える色空間OkLChで計算します。影は色相265°（青紫）へ、光は85°（黄みのオレンジ）へ、それぞれ入力した色相シフトの分まで回し、彩度は両端に向かって落とします。',
    'インデックスカラーに変換すると、すべてのピクセルがパレット番号に置き換わります。ここで何を「最も近い」とするかが重要です。Nerulioは目の見え方に沿ったOklabで距離を測り、AsepriteはRGBの距離を使います。緑の#3e8948をPICO-8パレットに変換すると、OklabはPICO-8の緑#008751を選び、単純なRGB距離は灰褐色の#5f574fを選びます。ディザは最初オフです。ドット絵ではディザのノイズが質感のように見えてしまうためです。',
    'インデックスのスプライトでは透明は独立したパレットの枠で、不透明なピクセルがそこに割り当てられることはありません。だから黒から始まるパレット（PICO-8がそうです）でも、ここでは黒いピクセルは黒のままです。変換は0番を透明にするのではなく、先頭に透明の枠を1つ足すからです。'],
    terms:[['ランプ','1つの素材の色を暗い順から明るい順に並べた組。'],['色相シフト','ランプに沿って色相を回すこと。影は寒色、ハイライトは暖色へ。'],['OkLCh / Oklab','知覚的な色空間。Lは明度、Cは彩度、hは色相角。'],['シェーディングインク','塗るたびにピクセルを選んだランプ上で1段ずつ動かすブラシ。'],['インデックス表','パレットの枠を動かすときに全セルへ適用する番号の付け替え。絵はそのまま保たれます。']]},
   example:{title:'例：#3e8948からNerulioが作るランプ',lead:'ピクセル › 色相シフトのランプ…を既定値（色数5、色相シフト24、最も暗く18 %、最も明るく94 %）で実行し、8ビットの色から測り直した値です。',lines:[
    '段    hex      L      C      h',
    '0     #001a0d  0.19   0.044  159°   影：より暗く、色相は青寄り',
    '1     #005129  0.38   0.097  154°',
    '2     #3e8948  0.57   0.123  146°   基準色、そのまま保持',
    '3     #91be77  0.75   0.108  135°',
    '4     #e3f3c1  0.94   0.068  122°   光：より明るく、色相は黄色寄り',
    '明度の段差 0.19 → 0.38 → 0.57 → 0.75 → 0.94（約0.19ずつ）',
    '彩度は基準色（0.123）で最大、両端に向かって低下'],
    after:'明るい側は24°いっぱい回りましたが（146° → 122°）、最も暗い段は170°ではなく159°になりました。それほど暗い色は8ビットのsRGBでは色相を表す余地がほとんどないためです。ランプは出発点として扱い、パレットパネルで枠をダブルクリックして1段ずつ調整してください。'},
   verify:{title:'パレットを確認する',steps:[
    'パレットメニューで明るさ順に並べ替えます。各ランプが暗い順から明るい順に続き、順番から外れた段がないはずです。',
    'Shift/Ctrl+クリックでランプを選び、シェーディングインクで塗ります。左クリックで1段明るく、右クリックで1段暗くなるはずです。',
    'パレット検査を実行します。ほぼ同じ色のペアが出たら、たいてい2つのランプがまとめられる色を分け合っています。',
    'パレットを書き出して読み込み直します。テストではすべての形式で書き出しと読み戻しが一致しました。']},
   trouble:{rows:[
    ['インデックスに変換したら黒いピクセルがすべて透明になった（ほかのツールで作ったファイル）','パレットの0番が黒で、ツールが0番を透明色として使っている','AsepriteならSprite › Propertiesに透明色の番号が表示される','透明の枠を別に持つ（Nerulioは先頭に1つ追加）。Asepriteでは透明色を変えるか枠を追加'],
    ['インデックスの結果がAsepriteと違う色を選ぶ','ここではOklab、AsepriteではRGBで最も近い色を測っている','1ピクセルで比較：#3e8948はここでは#008751、RGB距離では#5f574f','Nerulioの知覚的な選択を使うか、Asepriteで変換したインデックスのファイルをここで開く'],
    ['1色を直したらあちこちのピクセルが変わった','インデックスのスプライトでは、パレットの枠はそれを使う全ピクセルの色','編集ダイアログに、この番号のピクセルはすべて一緒に変わると表示される','新しい色は新しい枠として追加し、変えたい所だけ塗り直す'],
    ['シェーディングインクが関係ない色へ飛ぶ','ランプを選んでいないので、インクがパレット全体の順番をたどる','オプションバーにパレット順でシェーディングすると表示される','塗る前に1つのランプの色を暗い順にShift/Ctrl+クリックで選ぶ'],
    ['変換したスプライトがざらついて見える','カラーモードのダイアログでディザのパターンを選んだ','拡大すると平らな面にチェッカーやBayerの模様がある','取り消して、ディザ：なしで変換し直す']]},
   alternatives:{rows:[
    ['Asepriteのパレット機能','すでにAsepriteで作業しているなら。カラーバーで枠を編集し、Sprite › Propertiesで透明色を決め、シェーディングインクはカラーバーで選んだ色を使います。'],
    ['Lospecで公開されているパレット','ランプを自作するより実績のあるパレットから始めたいとき。どのソフトがどのファイルを読むかも[[game/lospec-palette|Lospecパレットの使い方]]にまとめています。'],
    ['エディタを使わず完成済みのフレームを色替え','絵はできていてチームカラーや状態の色味だけ欲しいなら[[game/palette-swap-ramp|ランプの置き換えとチームカラー]]。']]},
   limits:['ランプは基準色1つから作る出発点で、アートディレクションではありません。','パレットは最大256色で、グレースケールのカラーモードはありません。','最も近い色はOklabでのみ判定し、AsepriteのようなRGB基準は選べません。'],
   versions:{body:['Nerulio：ランプ、インデックス表、Oklabのマッチング、すべてのパレットの読み書きを単体テストで確認しています（`tests/studio-pixel.test.mjs`）。96×144のCC0スプライトをPICO-8に変換すると、不透明ピクセルの100 %がOklabで最も近い色になり、黒い1708ピクセルはすべて黒のままでした（docs/STUDIO-PIXEL.md §6、T5）。上のランプの値はsrc/studio/pixel/ramps.jsで計算しました。Asepriteの動作は公式ドキュメントに基づきます。'],
    sources:[s('Asepriteドキュメント：Color Mode',A.colorMode),s('Asepriteドキュメント：Color Bar',A.colorBar),s('Asepriteドキュメント：Shading',A.shading),s('Asepriteドキュメント：Sprite Properties',A.props)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── outline
 'game/pixel-art-outline':{
  type:'create',
  intent:{primary:'add a 1 px outline (and drop shadow) to pixel art',secondary:['inner vs outer outline','why the canvas needs +1 px','4-connected vs 8-connected corners','outline every frame'],
   goal:'a clean 1 px outline around the sprite that is not clipped, on every frame that needs it',
   input:'a sprite or frames with transparency',output:'the same sprite with the outline (and shadow) pixels added, as one undo step',
   target:'the sprite / .aseprite / PNG frames',support:'partial',
   evidence:['src/studio/pixel/raster.js outline() and dropShadow()','src/studio/workspaces/pixel/index.js (command uses outside + 4-connected; shadow dx=dy=1)','src/studio/workspaces/pixel/panels.js (Canvas size dialog defaults to +1 on each side)','docs/STUDIO-PIXEL.md §6 T8 (1846 + 705 px, identical to Aseprite)'],
   external:['Aseprite docs: Edit › FX › Outline (Inside/Outside, shape, Selected/All)','Aseprite docs: Canvas Size']},
  en:{
   answer:'A pixel-art outline is a 1 px ring of a dark colour around the silhouette. An outer outline paints the transparent pixels that touch the sprite, so the sprite grows by 1 px on every side and the canvas needs 1 px of room on each side first; an inner outline repaints the sprite\'s own edge pixels and keeps its size. In Nerulio, Pixel › Canvas size… (Ctrl+Alt+C) offers +1 on every side by default, and Pixel › Outline then draws an outer, edge-touching outline in the foreground colour on the current layer and frame; Pixel › Drop shadow adds a 1 px shadow in the background colour.',
   concept:{title:'Outer or inner, edges or corners, and the extra pixel of canvas',body:[
    'An outer outline keeps every drawn pixel and adds a ring outside it. It is the usual choice for characters that must stand out from busy backgrounds, but it makes the sprite 2 px wider and taller, so a 32×32 character needs a 34×34 canvas or has to be drawn inside 30×30. An inner outline paints over the sprite\'s outermost pixels instead: the size stays, but the thinnest details (a 1 px sword, a strand of hair) disappear into the line.',
    'Which neighbours count decides the corners. A 4-connected outline adds a pixel only where it touches the sprite along an edge, so diagonal corners stay open and the outline looks rounder; an 8-connected one also fills the diagonal corners and looks blockier. Nerulio\'s command draws the 4-connected shape, the same shape as Aseprite\'s default outline on the head-to-head sprite.',
    'The outline is computed from whatever is not transparent on the layer. Enclosed holes, like the gap between an arm and the body, are transparent too and get outlined from the inside; semi-transparent glow counts as solid. Put the full silhouette on one layer, or select the area to outline: with a selection, the command only touches the selected pixels grown by one pixel.'],
    terms:[['Outer outline','Ring of new pixels on the transparent side of the silhouette; the sprite grows 1 px per side.'],['Inner outline','The sprite\'s own edge pixels recoloured; the size stays.'],['4-connected','Neighbours that share an edge (up, down, left, right); corners stay open.'],['8-connected','Edge and diagonal neighbours; corners are filled.'],['Canvas size','Adds or removes pixels at the borders without scaling the art.']]},
   example:{title:'Example: counting outline pixels',lead:'A 4×4 filled square, computed with the same routines the command uses:',lines:[
    'square 4×4 on an 8×8 canvas             16 px of art',
    'outer, 4-connected (Nerulio\'s command)  +16 px   (4 per side, corners open)',
    'outer, 8-connected                      +20 px   (the 4 corners filled too)',
    'inner                                    12 px recoloured, size unchanged',
    'square touching the left edge           outer +12 px   (one side has no room)',
    'after Canvas size +1 on the left         outer +16 px   (complete again)',
    'drop shadow (1 px right and down)        +7 px on the square, +9 px after the outline',
    'real sprite, 96×144 → 98×146 canvas      outline 1846 px, shadow 705 px, same as Aseprite'],
    after:'Run the outline before the shadow: the shadow is then cast by the outlined silhouette, which is how the head-to-head sprite was done in both programs.'},
   verify:{title:'Check the outline',steps:[
    'Before running it, look at the outermost row and column: if any pixel of the art is there, add canvas first.',
    'Zoom to 400 % and follow the silhouette: every edge pixel should have exactly one outline pixel outside it, and diagonal corners stay open.',
    'Hide the outlined layer\'s neighbours: if the arm-to-body gap got an outline you did not want, erase those pixels or fill the gap first.',
    'Step through the frames with , and .: the command acts on the current frame, so each frame that needs the outline shows it.']},
   trouble:{rows:[
    ['The outline is missing on one side','The art touches the canvas edge, so there is no pixel outside it to paint','Opaque pixels in the first or last row or column','Undo, run Pixel › Canvas size… with +1 on each side, then outline again'],
    ['Holes inside the sprite got outlined','Enclosed transparent pixels count as "outside"','Zoom into gaps between limbs and body','Fill the gap, or select the sprite without the gap and run the outline on the selection'],
    ['Only part of the character got an outline','The command works on the current layer, and the silhouette is split across layers','Toggle layer visibility: the outline follows one layer\'s shape','Merge down (Ctrl+E) first, or add the outline on a layer that holds the whole silhouette'],
    ['A glow or smoke got a hard dark border','Every pixel with alpha above 0 counts as solid','Pick a glow pixel: its alpha is between 1 and 254','Select only the body before outlining, or add the glow after the outline'],
    ['The outline is two pixels thick','The command ran twice; each run adds another ring','History shows two Outline entries','Undo once: each run is exactly one History step'],
    ['The other frames have no outline','The command changes only the current frame','Step to the next frame with .','Repeat on each frame, or use the Cleanup panel\'s outline option with the scope set to the tag or all frames']]},
   alternatives:{rows:[
    ['Aseprite: Edit › FX › Outline (Shift+O)','You want an inner outline, a custom shape of neighbours, or the outline applied to all cels of the animation at once; its documentation describes Inside/Outside, shape presets and Selected/All.'],
    ['Drawing the outline by hand','Selective outlining, where the line is lighter on the lit side or dropped where the sprite meets the ground, is an artistic choice no command makes for you.'],
    ['Nerulio\'s Cleanup panel','You are converting an upscaled image anyway: the outline and shadow options apply to the whole scope and give a new sprite. See [[game/pixel-art-downscaler|the downscaler]].']]},
   limits:['Only the outer, 4-connected outline is available as a command; inner and 8-connected outlines are not.','The command works on the current layer and frame; whole animations need Cleanup or one run per frame.','The shadow offset is fixed at 1 px right and 1 px down.'],
   versions:{body:['Nerulio: on the 96×144 CC0 head-to-head sprite, Canvas size +1, Outline and Drop shadow added 1846 and 705 px, pixel-identical to the result made in Aseprite 1.3.18 (docs/STUDIO-PIXEL.md §6, T8). The square counts above come from src/studio/pixel/raster.js. Aseprite\'s options follow its documentation.'],
    sources:[s('Aseprite docs: FX (Outline)',A.fx),s('Aseprite docs: Canvas Size',A.canvas)]}
  },
  ko:{
   answer:'도트 외곽선은 실루엣을 두르는 1px 어두운 테두리입니다. 바깥 외곽선은 스프라이트에 닿은 투명 픽셀을 칠하므로 스프라이트가 사방으로 1px씩 커지고, 그래서 먼저 캔버스에 사방 1px 여유가 있어야 합니다. 안쪽 외곽선은 스프라이트 가장자리 픽셀을 덧칠해 크기가 그대로입니다. Nerulio에서는 픽셀 › 캔버스 크기…(Ctrl+Alt+C)가 기본으로 사방 +1을 제안하고, 이어서 픽셀 › 외곽선이 현재 레이어와 프레임에 전경색으로 변이 맞닿는 바깥 외곽선을 그립니다. 픽셀 › 드롭 섀도는 배경색으로 1px 그림자를 넣습니다.',
   concept:{title:'바깥이냐 안쪽이냐, 변이냐 모서리냐, 그리고 캔버스 1픽셀',body:[
    '바깥 외곽선은 그린 픽셀을 모두 남기고 그 밖에 테두리를 더합니다. 복잡한 배경 위에서 캐릭터를 도드라지게 할 때 흔히 쓰지만 스프라이트가 가로·세로 2px씩 커지므로, 32×32 캐릭터라면 34×34 캔버스가 필요하거나 30×30 안에 그려야 합니다. 안쪽 외곽선은 대신 스프라이트의 가장 바깥 픽셀을 덧칠합니다. 크기는 그대로지만 1px 칼이나 머리카락 한 가닥 같은 가장 가는 부분이 선에 묻혀 사라집니다.',
    '어떤 이웃을 세느냐가 모서리 모양을 정합니다. 4방향 외곽선은 스프라이트와 변으로 맞닿은 곳에만 픽셀을 더해 대각선 모서리가 비고 둥글게 보입니다. 8방향은 대각선 모서리까지 채워 각져 보입니다. Nerulio의 명령은 4방향 모양을 그리며, 비교 시험 스프라이트에서 에이스프라이트 기본 외곽선과 같은 모양이었습니다.',
    '외곽선은 레이어에서 투명하지 않은 모든 것을 기준으로 계산합니다. 팔과 몸 사이 틈처럼 둘러싸인 구멍도 투명이라 안쪽에서 외곽선이 생기고, 반투명한 빛도 채워진 것으로 셉니다. 실루엣 전체를 한 레이어에 두거나 두를 영역을 선택하세요. 선택 영역이 있으면 명령은 선택한 픽셀을 1px 넓힌 범위만 건드립니다.'],
    terms:[['바깥 외곽선','실루엣의 투명한 쪽에 새 픽셀로 두른 테두리. 스프라이트가 사방 1px씩 커짐.'],['안쪽 외곽선','스프라이트 자체의 가장자리 픽셀을 다시 칠한 것. 크기는 그대로.'],['4방향 연결','변을 공유하는 이웃(위·아래·왼쪽·오른쪽). 모서리는 비어 있음.'],['8방향 연결','변과 대각선 이웃. 모서리가 채워짐.'],['캔버스 크기','그림을 확대·축소하지 않고 가장자리에 픽셀을 더하거나 빼는 명령.']]},
   example:{title:'예시: 외곽선 픽셀 세기',lead:'4×4로 채운 정사각형을 명령과 같은 계산으로 처리한 결과입니다.',lines:[
    '8×8 캔버스 위 4×4 정사각형              그림 16 px',
    '바깥, 4방향 (Nerulio 명령)              +16 px   (변마다 4, 모서리 비움)',
    '바깥, 8방향                             +20 px   (모서리 4개도 채움)',
    '안쪽                                     12 px 덧칠, 크기 그대로',
    '왼쪽 가장자리에 닿은 정사각형           바깥 +12 px   (한쪽에 자리가 없음)',
    '왼쪽 캔버스 +1 뒤                       바깥 +16 px   (다시 완전함)',
    '드롭 섀도(오른쪽·아래 1 px)             정사각형만 +7 px, 외곽선 뒤 +9 px',
    '실제 스프라이트 96×144 → 캔버스 98×146  외곽선 1846 px, 그림자 705 px, 에이스프라이트와 동일'],
    after:'외곽선을 먼저, 그림자를 나중에 넣으세요. 그러면 그림자가 외곽선까지 포함한 실루엣에서 떨어지며, 비교 시험 스프라이트도 두 프로그램에서 이 순서로 만들었습니다.'},
   verify:{title:'외곽선 확인하기',steps:[
    '실행하기 전에 가장 바깥 줄과 칸을 봅니다. 그림 픽셀이 하나라도 있으면 먼저 캔버스를 늘립니다.',
    '400 %로 확대해 실루엣을 따라갑니다. 가장자리 픽셀마다 바깥에 외곽선 픽셀이 정확히 하나 있고 대각선 모서리는 비어 있어야 합니다.',
    '외곽선을 넣은 레이어 주변 레이어를 숨겨 봅니다. 팔과 몸 사이 틈에 원치 않는 외곽선이 생겼다면 지우거나 틈을 먼저 메우세요.',
    '쉼표·마침표로 프레임을 넘깁니다. 명령은 현재 프레임에만 적용되므로 필요한 프레임마다 외곽선이 있어야 합니다.']},
   trouble:{rows:[
    ['한쪽 외곽선이 없음','그림이 캔버스 끝에 닿아 칠할 바깥 픽셀이 없음','첫째·마지막 줄이나 칸에 불투명 픽셀이 있음','되돌린 뒤 픽셀 › 캔버스 크기…로 사방 +1을 하고 다시 외곽선'],
    ['스프라이트 안의 구멍에도 외곽선이 생김','둘러싸인 투명 픽셀도 바깥으로 셈','팔다리와 몸 사이 틈을 확대해 봄','틈을 메우거나, 틈을 뺀 스프라이트를 선택하고 선택 영역에 외곽선'],
    ['캐릭터 일부에만 외곽선이 생김','명령은 현재 레이어에만 적용되는데 실루엣이 여러 레이어에 나뉨','레이어 표시를 켜고 끄면 외곽선이 한 레이어 모양만 따름','먼저 아래로 합치기(Ctrl+E)를 하거나, 실루엣 전체가 있는 레이어에 외곽선'],
    ['빛이나 연기에 딱딱한 어두운 테두리가 생김','알파가 0보다 큰 픽셀은 모두 채워진 것으로 셈','빛 픽셀을 찍어 보면 알파가 1~254 사이','몸만 선택한 뒤 외곽선을 넣거나, 빛은 외곽선 뒤에 추가'],
    ['외곽선이 2픽셀 두께','명령을 두 번 실행해 테두리가 한 겹 더 생김','히스토리에 외곽선 항목이 두 개','한 번 되돌리기. 실행마다 히스토리 한 단계'],
    ['다른 프레임에는 외곽선이 없음','명령은 현재 프레임만 바꿈','마침표로 다음 프레임으로 넘겨 봄','프레임마다 반복하거나, 정리 패널의 외곽선 옵션을 범위(태그 또는 모든 프레임)로 사용']]},
   alternatives:{rows:[
    ['에이스프라이트: Edit › FX › Outline(Shift+O)','안쪽 외곽선, 이웃 모양 직접 지정, 애니메이션의 모든 셀에 한 번에 적용이 필요할 때. 공식 문서에 Inside/Outside, 모양 프리셋, Selected/All이 설명돼 있습니다.'],
    ['손으로 외곽선 그리기','빛을 받는 쪽은 밝게, 땅에 닿는 곳은 빼는 선택적 외곽선은 명령이 대신해 주지 못하는 표현상의 선택입니다.'],
    ['Nerulio 정리 패널','어차피 확대된 그림을 변환할 때. 외곽선·그림자 옵션이 정한 범위 전체에 적용되고 새 스프라이트가 됩니다. [[game/pixel-art-downscaler|도트 축소]] 참고.']]},
   limits:['명령으로 쓸 수 있는 것은 바깥·4방향 외곽선뿐이며 안쪽과 8방향 외곽선은 없습니다.','명령은 현재 레이어와 프레임에만 적용됩니다. 애니메이션 전체는 정리 패널이나 프레임마다 실행해야 합니다.','그림자 위치는 오른쪽 1px, 아래 1px로 고정입니다.'],
   versions:{body:['Nerulio: 96×144 CC0 비교 시험 스프라이트에서 캔버스 크기 +1, 외곽선, 드롭 섀도가 1846px와 705px를 더했고, Aseprite 1.3.18에서 만든 결과와 픽셀까지 같았습니다(docs/STUDIO-PIXEL.md §6, T8). 위 정사각형 수치는 src/studio/pixel/raster.js로 계산했습니다. 에이스프라이트 옵션 설명은 공식 문서를 따릅니다.'],
    sources:[s('Aseprite 문서: FX(Outline)',A.fx),s('Aseprite 문서: Canvas Size',A.canvas)]}
  },
  ja:{
   answer:'ドット絵の縁取りは、シルエットを囲む1pxの暗い色の輪です。外側の縁取りはスプライトに接する透明ピクセルを塗るため、スプライトは上下左右に1pxずつ大きくなり、先にキャンバスの四辺に1pxの余白が必要です。内側の縁取りはスプライト自身の端のピクセルを塗り直し、大きさは変わりません。Nerulioではピクセル › キャンバスサイズ…（Ctrl+Alt+C）が既定で四辺+1を提案し、続けてピクセル › アウトラインが現在のレイヤーとフレームに、描画色で辺が接する外側の縁取りを描きます。ピクセル › ドロップシャドウは背景色で1pxの影を足します。',
   concept:{title:'外側か内側か、辺か角か、そしてキャンバスの1ピクセル',body:[
    '外側の縁取りは描いたピクセルをすべて残し、その外に輪を足します。にぎやかな背景の上でキャラを目立たせたいときによく使いますが、スプライトは縦横2pxずつ大きくなるので、32×32のキャラなら34×34のキャンバスが要るか、30×30の中に描く必要があります。内側の縁取りは代わりにスプライトの最も外側のピクセルを塗り直します。大きさは保てますが、1pxの剣や髪の一房のような細い部分が線に埋もれて消えます。',
    'どの隣を数えるかで角の形が決まります。4方向の縁取りはスプライトと辺で接する所にだけピクセルを足すので斜めの角が空き、丸く見えます。8方向は斜めの角まで埋めて角ばって見えます。Nerulioのコマンドは4方向の形を描き、比較テストのスプライトではAsepriteの標準の縁取りと同じ形でした。',
    '縁取りはレイヤー上の透明でないものすべてから計算します。腕と胴の間のすき間のような囲まれた穴も透明なので内側から縁取られ、半透明の光も塗られたものとして数えます。シルエット全体を1つのレイヤーにまとめるか、縁取る範囲を選択してください。選択範囲があると、コマンドは選んだピクセルを1px広げた範囲だけに効きます。'],
    terms:[['外側の縁取り','シルエットの透明側に新しいピクセルで描く輪。スプライトは四辺に1pxずつ大きくなる。'],['内側の縁取り','スプライト自身の端のピクセルを塗り替えたもの。大きさは変わらない。'],['4方向の連結','辺を共有する隣（上・下・左・右）。角は空いたまま。'],['8方向の連結','辺と斜めの隣。角も埋まる。'],['キャンバスサイズ','絵を拡大縮小せずに、端にピクセルを足したり削ったりする操作。']]},
   example:{title:'例：縁取りのピクセルを数える',lead:'4×4の塗りつぶした正方形を、コマンドと同じ処理で計算した結果です。',lines:[
    '8×8キャンバス上の4×4の正方形            絵 16 px',
    '外側・4方向（Nerulioのコマンド）         +16 px（各辺4、角は空く）',
    '外側・8方向                              +20 px（角4つも埋まる）',
    '内側                                      12 px塗り替え、大きさはそのまま',
    '左端に接した正方形                       外側 +12 px（片側に余地がない）',
    '左にキャンバス+1したあと                 外側 +16 px（元どおり完全）',
    'ドロップシャドウ（右と下に1 px）         正方形だけで+7 px、縁取り後は+9 px',
    '実際のスプライト 96×144 → 98×146         縁取り1846 px、影705 px、Asepriteと一致'],
    after:'縁取りを先に、影をあとに入れます。そうすると影は縁取りを含んだシルエットから落ち、比較テストのスプライトも両方のソフトでこの順に作りました。'},
   verify:{title:'縁取りを確認する',steps:[
    '実行する前に、いちばん外側の行と列を見ます。絵のピクセルが1つでもあれば、先にキャンバスを広げます。',
    '400 %に拡大してシルエットをたどります。端のピクセルごとに外側の縁取りピクセルがちょうど1つあり、斜めの角は空いているはずです。',
    '縁取ったレイヤーの周りのレイヤーを隠してみます。腕と胴のすき間に不要な縁取りができていたら消すか、先にすき間を埋めます。',
    'カンマとピリオドでフレームを移ります。コマンドは現在のフレームだけに効くので、必要な各フレームに縁取りがあるはずです。']},
   trouble:{rows:[
    ['片側の縁取りがない','絵がキャンバスの端に接していて、外側に塗るピクセルがない','最初か最後の行・列に不透明なピクセルがある','取り消し、ピクセル › キャンバスサイズ…で四辺+1にしてから縁取り直す'],
    ['スプライト内の穴まで縁取られた','囲まれた透明ピクセルも外側として数える','手足と胴のすき間を拡大して見る','すき間を埋めるか、すき間を除いて選択し、選択範囲に縁取り'],
    ['キャラの一部だけ縁取られた','コマンドは現在のレイヤーだけに効き、シルエットが複数のレイヤーに分かれている','レイヤーの表示を切り替えると、縁取りが1枚のレイヤーの形だけに沿っている','先に下と結合（Ctrl+E）するか、シルエット全体があるレイヤーに縁取り'],
    ['光や煙に硬く暗い縁ができた','アルファが0より大きいピクセルはすべて塗られたものとして数える','光のピクセルを調べるとアルファが1〜254','体だけを選択してから縁取るか、光は縁取りのあとで足す'],
    ['縁取りが2ピクセルの太さ','コマンドを2回実行して輪がもう1本増えた','履歴にアウトラインが2つある','1回取り消す。実行ごとに履歴1手順'],
    ['ほかのフレームに縁取りがない','コマンドは現在のフレームだけを変える','ピリオドで次のフレームへ移って確認','フレームごとに繰り返すか、整理パネルのアウトラインを範囲（タグか全フレーム）で使う']]},
   alternatives:{rows:[
    ['Aseprite：Edit › FX › Outline（Shift+O）','内側の縁取り、隣の形の指定、アニメの全セルへ一度に適用が必要なとき。公式ドキュメントにInside/Outside、形のプリセット、Selected/Allの説明があります。'],
    ['縁取りを手で描く','光の当たる側を明るくしたり、地面に接する所を抜いたりするセレクティブアウトラインは、コマンドでは代われない表現上の判断です。'],
    ['Nerulioの整理パネル','どのみち拡大画像を変換するとき。アウトラインと影のオプションが範囲全体に効き、新しいスプライトになります。[[game/pixel-art-downscaler|ドット絵の縮小]]を参照。']]},
   limits:['コマンドで使えるのは外側・4方向の縁取りだけで、内側と8方向はありません。','コマンドは現在のレイヤーとフレームだけに効きます。アニメ全体には整理パネルか、フレームごとの実行が必要です。','影の位置は右に1px、下に1pxで固定です。'],
   versions:{body:['Nerulio：96×144のCC0比較用スプライトで、キャンバスサイズ+1・アウトライン・ドロップシャドウが1846pxと705pxを追加し、Aseprite 1.3.18で作った結果とピクセル単位で一致しました（docs/STUDIO-PIXEL.md §6、T8）。上の正方形の数値はsrc/studio/pixel/raster.jsで計算しました。Asepriteのオプションは公式ドキュメントに基づきます。'],
    sources:[s('Asepriteドキュメント：FX（Outline）',A.fx),s('Asepriteドキュメント：Canvas Size',A.canvas)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── Pixel Lab (palette lock)
 'game/pixel-lab':{
  type:'create',
  intent:{primary:'lock every frame of a pixel-art animation to one shared palette',secondary:['frames exported from different tools have drifting colours','dither without flicker','prove every exported colour is in the palette'],
   goal:'PNG frames that all use exactly the same palette, with no flicker, plus the palette as .gpl',
   input:'several PNG frames (or one image), each at most 4096×4096',output:'ZIP of PNG frames (1×–8× nearest), palette .gpl, pixel-lab.json',
   target:'any engine or editor that loads PNG frames; the .gpl opens in GIMP and Aseprite',support:'full',
   evidence:['docs/PIXEL-LAB.md §1, §3 and Verification (Chromium, files re-read with Pillow)','src/game/palette.js extract(), lockFrame(), flickers()','src/pixel-engine.js accumulate() (5-bit alpha-weighted histogram), Bayer matrices','src/task/pixel-lab.js (2–256 colours, default 16; scale 1–8; 4096×4096 per frame)'],
   external:['GIMP Palette format (.gpl) specification']},
  en:{
   answer:'Frames exported from different tools, or resized and re-saved, drift apart: the same shade becomes three slightly different colours, and the animation shimmers. Locking fixes that: build one palette from all frames together (2–256 colours, 16 by default, or a preset such as PICO-8), map every pixel of every frame to it, and keep dithering off or ordered so still areas do not flicker. The Pixel Lab does this in the browser and exports the frames as PNG at 1×–8×, the palette as `.gpl` and a `pixel-lab.json` summary; every exported colour is checked to be in the palette.',
   concept:{title:'Why frames drift, and how one palette and the right dither stop it',body:[
    'Each tool that touches a frame can nudge its colours: resampling blends neighbours, JPEG or lossy WebP adds noise, and a canvas that stores colour premultiplied by alpha shifts semi-transparent pixels. Quantising each frame on its own then gives each frame its own palette. The Lab instead feeds all frames into one histogram weighted by alpha, splits it by median cut in Oklab (so both frequency and visible difference count), and refines the result, which yields one palette shared by every frame.',
    'Dithering decides whether the animation flickers. Ordered (Bayer) dithering adds a bias that depends only on the pixel\'s position, so an area that does not change gets the same pixels in every frame. Error diffusion (Floyd–Steinberg, Atkinson) carries the rounding error across the whole frame, so one moving pixel changes the decisions of every pixel after it, and a still wall can flicker. The Lab defaults to None and warns when diffusion is chosen with more than one frame loaded.',
    'The Lab writes the PNGs from the RGBA values directly instead of through a canvas, because a canvas rounds semi-transparent colours through premultiplied alpha. Before that change, 68 of 84 exported colours fell outside a 16-colour locked palette; after it, none did.'],
    terms:[['Palette lock','Mapping every pixel of every frame onto one fixed palette.'],['Median cut','Splitting the colour histogram repeatedly at the median of its widest axis until the target count is reached.'],['Ordered (Bayer) dither','A fixed threshold pattern by pixel position; it cannot flicker between frames.'],['Error diffusion','Dithering that spreads each pixel\'s rounding error to its neighbours; it can flicker in animation.']]},
   example:{title:'Example: eight anti-aliased frames locked to 16 colours',lead:'The Lab\'s browser test, with the exported files re-read by an independent decoder:',lines:[
    'input      8 frames × 48×48 px = 18,432 px, anti-aliased edges',
    'extract    one palette of 16 colours from all 8 frames',
    'lock       every pixel → nearest of the 16 in Oklab, dither None',
    'check      colours in all exported PNGs: 16; outside the palette: 0',
    'flicker    an unchanging band: 1 distinct version across 8 frames (None and Bayer 4×4)',
    'counting   exact up to 4 MP of frame area in total; here 0.018 MP',
    'size cap   each frame at most 4096 × 4096 px'],
    after:'The last check is the one that matters for a game: open the exported PNGs, not the preview, and count their colours. The Lab\'s test does exactly that with Pillow.'},
   verify:{title:'Check the locked frames',steps:[
    'Step through the frames with ← and →: the same shade should show the same swatch in the palette on every frame.',
    'Open two exported PNGs in any image editor and sample the same spot of a still area: the values must be identical.',
    'Count the colours of one exported frame in another tool: the count must not exceed the palette size.',
    'Load the exported `.gpl` in GIMP or Aseprite: it lists the same colours in the same order.']},
   trouble:{rows:[
    ['The animation flickers after locking','An error-diffusion dither (Floyd–Steinberg or Atkinson) is on','The Convert stage shows the flicker warning','Switch to None or a Bayer matrix; compare them side by side in the dither grid'],
    ['A small detail colour disappeared','Median cut weights colours by how many pixels use them; a 2-pixel eye highlight loses to large areas','Look for the colour in the Palette stage after extraction','Lock that colour, then press Extract again, or raise the colour count'],
    ['A dropped sprite sheet came out as one frame','The Lab treats one image as one frame; it does not slice sheets','The frame strip shows a single frame','Slice the sheet first with [[sprite-slicer|the sprite slicer]], then drop the frames'],
    ['The Lab refuses an image','A frame larger than 4096 × 4096 px would freeze the tab, so it is refused','The message names the size and the limit','Scale or crop it first, or slice it into frames'],
    ['The colour counts cover only one frame','Above 4 MP of frame area in total, counting is limited to the visible frame','The panel says so next to the counts','Load fewer frames at once if you need exact totals']]},
   alternatives:{rows:[
    ['Converting inside the Studio\'s Pixel workspace','The frames belong to a layered sprite with a timeline: Colour mode… makes it indexed and keeps layers and tags. See [[game/pixel-art-palette-editor|the palette editor]].'],
    ['A published palette instead of an extracted one','The art must match a known palette such as PICO-8 or Endesga 32: see [[game/lospec-palette|applying a Lospec palette]].'],
    ['Cleaning anti-aliased edges and stray pixels','Locking left odd edge pixels or specks: the Lab\'s Cleanup stage, described on [[game/pixel-art-cleanup|pixel-art cleanup]].']]},
   limits:['No animation playback: frames are stepped, not played.','Everything runs on the main thread with no cancel button; very large batches block the tab until they finish.','Verified in Chromium only.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md, measured in Chromium through Playwright on a built site, with every number read back from the downloaded files (Pillow, zipfile, json); unit tests in tests/game-palette.test.mjs. The .gpl written follows the GIMP palette format.'],
    sources:[s('GIMP developer docs: GIMP Palette format (.gpl)',GIMP_GPL)]}
  },
  ko:{
   answer:'여러 도구에서 내보냈거나 크기를 바꿔 다시 저장한 프레임은 색이 조금씩 어긋납니다. 같은 명암이 미묘하게 다른 세 색이 되고 애니메이션이 반짝거립니다. 고정(lock)은 이를 바로잡습니다. 모든 프레임을 함께 보고 팔레트 하나를 만들고(2~256색, 기본 16색, 또는 PICO-8 같은 프리셋), 모든 프레임의 모든 픽셀을 거기에 맞추며, 디더링은 끄거나 순서형으로 두어 멈춘 부분이 깜박이지 않게 합니다. 픽셀 랩은 브라우저에서 이를 처리하고 프레임을 1×~8× PNG로, 팔레트를 `.gpl`로, 요약을 `pixel-lab.json`으로 내보내며, 내보낸 모든 색이 팔레트 안에 있는지 확인합니다.',
   concept:{title:'프레임 색이 어긋나는 이유와, 팔레트 하나와 알맞은 디더로 막는 방법',body:[
    '프레임을 거치는 도구마다 색을 조금씩 바꿀 수 있습니다. 리샘플링은 이웃 픽셀을 섞고, JPEG나 손실 WebP는 잡음을 더하며, 색을 알파로 미리 곱해 저장하는 캔버스는 반투명 픽셀을 틀어지게 합니다. 이런 프레임을 하나씩 따로 양자화하면 프레임마다 팔레트가 달라집니다. 랩은 대신 모든 프레임을 알파로 가중한 히스토그램 하나에 넣고, Oklab에서 중앙값 분할로 나눈 뒤(빈도와 눈에 보이는 차이를 함께 반영) 다듬어, 모든 프레임이 함께 쓰는 팔레트 하나를 만듭니다.',
    '깜박임은 디더링이 좌우합니다. 순서형(Bayer) 디더는 픽셀 위치에만 따르는 치우침을 더하므로, 바뀌지 않은 영역은 모든 프레임에서 같은 픽셀이 됩니다. 오차 확산(Floyd–Steinberg, Atkinson)은 반올림 오차를 프레임 전체로 넘기므로 픽셀 하나가 움직여도 그 뒤 모든 픽셀의 결정이 바뀌고, 가만히 있는 벽도 깜박일 수 있습니다. 랩의 기본값은 없음이며, 프레임이 둘 이상인데 오차 확산을 고르면 경고합니다.',
    '랩은 캔버스를 거치지 않고 RGBA 값으로 바로 PNG를 씁니다. 캔버스는 반투명 색을 미리 곱한 알파로 반올림하기 때문입니다. 이렇게 바꾸기 전에는 16색으로 고정한 팔레트 밖으로 내보낸 색 84개 중 68개가 벗어났고, 바꾼 뒤에는 하나도 벗어나지 않았습니다.'],
    terms:[['팔레트 고정','모든 프레임의 모든 픽셀을 정해진 팔레트 하나에 맞추는 것.'],['중앙값 분할','목표 개수가 될 때까지 색 히스토그램을 가장 넓은 축의 중앙값에서 계속 나누는 방법.'],['순서형(Bayer) 디더','픽셀 위치로 정해지는 고정 문턱값 무늬. 프레임 사이에서 깜박일 수 없음.'],['오차 확산','픽셀마다 반올림 오차를 이웃에 퍼뜨리는 디더. 애니메이션에서 깜박일 수 있음.']]},
   example:{title:'예시: 안티앨리어싱된 프레임 8장을 16색으로 고정',lead:'랩의 브라우저 테스트이며, 내보낸 파일은 별도 디코더로 다시 읽었습니다.',lines:[
    '입력      프레임 8장 × 48×48 px = 18,432 px, 안티앨리어싱된 가장자리',
    '추출      8장 전체에서 팔레트 하나(16색)',
    '고정      모든 픽셀 → Oklab 기준 16색 중 가장 가까운 색, 디더 없음',
    '확인      내보낸 모든 PNG의 색: 16개, 팔레트 밖: 0개',
    '깜박임    변하지 않는 띠: 8장에서 모두 한 가지 모양(없음, Bayer 4×4 모두)',
    '개수 세기 전체 프레임 면적 4MP까지 정확, 여기서는 0.018MP',
    '크기 제한 프레임 한 장당 최대 4096 × 4096 px'],
    after:'게임에 중요한 것은 마지막 확인입니다. 미리보기가 아니라 내보낸 PNG를 열어 색을 세세요. 랩의 테스트도 Pillow로 바로 그렇게 합니다.'},
   verify:{title:'고정된 프레임 확인하기',steps:[
    '← →로 프레임을 넘깁니다. 같은 명암은 모든 프레임에서 팔레트의 같은 칸으로 표시돼야 합니다.',
    '내보낸 PNG 두 장을 아무 이미지 편집기에서 열어 멈춘 영역의 같은 지점 색을 찍어 봅니다. 값이 완전히 같아야 합니다.',
    '내보낸 프레임 한 장의 색 수를 다른 도구로 셉니다. 팔레트 크기를 넘으면 안 됩니다.',
    '내보낸 `.gpl`을 김프나 에이스프라이트에서 불러옵니다. 같은 색이 같은 순서로 보여야 합니다.']},
   trouble:{rows:[
    ['고정한 뒤 애니메이션이 깜박임','오차 확산 디더(Floyd–Steinberg 또는 Atkinson)가 켜져 있음','변환 단계에 깜박임 경고가 표시됨','없음이나 Bayer로 바꾸고 디더 비교 격자에서 나란히 보기'],
    ['작은 디테일 색이 사라짐','중앙값 분할은 쓰는 픽셀 수로 색에 가중치를 주므로 2픽셀짜리 눈 하이라이트가 큰 면적에 밀림','추출 뒤 팔레트 단계에 그 색이 있는지 확인','그 색을 잠그고 다시 추출하거나 색 개수를 늘리기'],
    ['끌어다 놓은 스프라이트 시트가 프레임 하나가 됨','랩은 이미지 한 장을 프레임 하나로 다루며 시트를 자르지 않음','프레임 줄에 프레임이 하나뿐','먼저 [[sprite-slicer|스프라이트 슬라이서]]로 자른 뒤 프레임을 놓기'],
    ['랩이 이미지를 거부함','4096 × 4096px보다 큰 프레임은 탭을 멈추게 하므로 거부함','메시지에 크기와 제한이 나옴','먼저 줄이거나 자르거나, 프레임으로 나누기'],
    ['색 개수가 한 프레임만 셈','전체 프레임 면적이 4MP를 넘으면 보이는 프레임만 셈','개수 옆 패널에 그렇게 표시됨','정확한 합계가 필요하면 한 번에 넣는 프레임 수 줄이기']]},
   alternatives:{rows:[
    ['Studio 픽셀 작업 공간에서 변환','프레임이 타임라인이 있는 레이어 스프라이트라면 색 모드…가 레이어와 태그를 유지한 채 인덱스로 바꿉니다. [[game/pixel-art-palette-editor|팔레트 편집기]] 참고.'],
    ['추출 대신 공개된 팔레트','PICO-8이나 Endesga 32처럼 정해진 팔레트에 맞춰야 한다면 [[game/lospec-palette|Lospec 팔레트 적용]].'],
    ['안티앨리어싱 가장자리와 외톨이 픽셀 정리','고정 뒤에도 이상한 가장자리 픽셀이나 점이 남았다면 랩의 정리 단계. [[game/pixel-art-cleanup|도트 정리]] 참고.']]},
   limits:['애니메이션 재생은 없고 프레임을 한 장씩 넘겨 봅니다.','모든 처리가 메인 스레드에서 돌고 취소 버튼이 없어, 아주 큰 묶음은 끝날 때까지 탭이 멈춥니다.','Chromium에서만 확인했습니다.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md. 빌드한 사이트에서 Playwright로 Chromium을 돌려 측정했고, 모든 수치는 내려받은 파일을 다시 읽어(Pillow, zipfile, json) 확인했습니다. 단위 테스트는 tests/game-palette.test.mjs입니다. 쓰는 .gpl은 김프 팔레트 형식을 따릅니다.'],
    sources:[s('GIMP 개발자 문서: GIMP Palette 형식(.gpl)',GIMP_GPL)]}
  },
  ja:{
   answer:'別々のツールから書き出したり、サイズを変えて保存し直したりしたフレームは、色が少しずつずれます。同じ陰影が微妙に違う3色になり、アニメがちらつきます。ロックはこれを直します。全フレームを合わせて1つのパレットを作り（2〜256色、既定16色、またはPICO-8などのプリセット）、全フレームの全ピクセルをそこへ対応づけ、ディザはオフか組織的ディザにして止まっている部分がちらつかないようにします。ピクセルラボはこれをブラウザで行い、フレームを1×〜8×のPNG、パレットを`.gpl`、概要を`pixel-lab.json`で書き出し、書き出した全色がパレット内にあることを確認します。',
   concept:{title:'フレームの色がずれる理由と、1つのパレットと適切なディザで防ぐ方法',body:[
    'フレームを通るツールはどれも色を少し動かし得ます。リサンプリングは隣のピクセルを混ぜ、JPEGや非可逆WebPはノイズを加え、色をアルファで乗算して保持するキャンバスは半透明のピクセルをずらします。そうしたフレームを1枚ずつ減色すると、フレームごとに違うパレットになります。ラボは代わりに全フレームをアルファで重み付けした1つのヒストグラムに入れ、Oklabでメディアンカットして（頻度と見た目の差の両方を反映）整え、全フレームが共有する1つのパレットを作ります。',
    'ちらつくかどうかはディザ次第です。組織的（Bayer）ディザはピクセルの位置だけで決まる偏りを加えるので、変わらない部分はどのフレームでも同じピクセルになります。誤差拡散（Floyd–Steinberg、Atkinson）は丸めの誤差をフレーム全体へ運ぶため、1ピクセル動くだけでその後の全ピクセルの判定が変わり、止まっている壁までちらつくことがあります。ラボの既定は「なし」で、複数フレームで誤差拡散を選ぶと警告します。',
    'ラボはキャンバスを通さず、RGBAの値から直接PNGを書きます。キャンバスは半透明の色を乗算済みアルファで丸めてしまうからです。この変更の前は、16色にロックしたパレットの外に書き出した84色のうち68色がはみ出していましたが、変更後は1色もはみ出しません。'],
    terms:[['パレットロック','全フレームの全ピクセルを、決まった1つのパレットに対応づけること。'],['メディアンカット','目標の色数になるまで、色のヒストグラムを最も広い軸の中央値で分け続ける方法。'],['組織的（Bayer）ディザ','ピクセルの位置で決まる固定のしきい値パターン。フレーム間でちらつかない。'],['誤差拡散','各ピクセルの丸め誤差を隣へ広げるディザ。アニメではちらつくことがある。']]},
   example:{title:'例：アンチエイリアスのかかった8フレームを16色にロック',lead:'ラボのブラウザテストで、書き出したファイルは別のデコーダーで読み直しています。',lines:[
    '入力        8フレーム × 48×48 px = 18,432 px、アンチエイリアスの縁',
    '抽出        8フレーム全体から16色のパレットを1つ',
    'ロック      全ピクセル → Oklabで16色中最も近い色、ディザなし',
    '確認        書き出した全PNGの色：16色、パレット外：0色',
    'ちらつき    変化しない帯：8フレームで1通りだけ（なし、Bayer 4×4とも）',
    '色数の計数  全フレーム面積4MPまで正確、ここでは0.018MP',
    'サイズ上限  1フレームあたり最大4096 × 4096 px'],
    after:'ゲームにとって大事なのは最後の確認です。プレビューではなく書き出したPNGを開いて色を数えてください。ラボのテストもPillowでまさにそうしています。'},
   verify:{title:'ロックしたフレームを確認する',steps:[
    '← →でフレームを移ります。同じ陰影はどのフレームでもパレットの同じ見本として表示されるはずです。',
    '書き出したPNGを2枚、任意の画像エディタで開き、止まっている部分の同じ位置の色を調べます。値は完全に一致するはずです。',
    '書き出した1フレームの色数を別のツールで数えます。パレットの色数を超えてはいけません。',
    '書き出した`.gpl`をGIMPかAsepriteで読み込みます。同じ色が同じ順で並ぶはずです。']},
   trouble:{rows:[
    ['ロック後にアニメがちらつく','誤差拡散のディザ（Floyd–SteinbergかAtkinson）がオン','変換の工程にちらつきの警告が出る','「なし」かBayerに切り替え、ディザ比較のグリッドで並べて見る'],
    ['小さなディテールの色が消えた','メディアンカットは使われるピクセル数で色を重み付けするので、2ピクセルの目のハイライトは広い面に負ける','抽出後、パレットの工程にその色があるか確認','その色をロックして「もう一度抽出」するか、色数を増やす'],
    ['ドロップしたスプライトシートが1フレームになった','ラボは1枚の画像を1フレームとして扱い、シートは分割しない','フレームの列が1つだけ','先に[[sprite-slicer|スプライトスライサー]]で分割してからフレームをドロップ'],
    ['ラボが画像を受け付けない','4096 × 4096pxを超えるフレームはタブを固めるので拒否する','メッセージにサイズと上限が表示される','先に縮小・トリミングするか、フレームに分割する'],
    ['色数が1フレーム分しか数えられていない','全フレーム面積が4MPを超えると、表示中のフレームだけを数える','数値の横のパネルにその旨が出る','正確な合計が必要なら一度に読み込むフレームを減らす']]},
   alternatives:{rows:[
    ['Studioのピクセル作業画面で変換','フレームがタイムライン付きのレイヤースプライトなら、カラーモード…がレイヤーとタグを保ったままインデックスにします。[[game/pixel-art-palette-editor|パレットエディタ]]を参照。'],
    ['抽出ではなく公開パレットを使う','PICO-8やEndesga 32など決まったパレットに合わせるなら[[game/lospec-palette|Lospecパレットの適用]]。'],
    ['アンチエイリアスの縁と孤立ピクセルの整理','ロック後も変な縁のピクセルや点が残るなら、ラボの整理の工程。[[game/pixel-art-cleanup|ドット絵の整理]]を参照。']]},
   limits:['アニメーションの再生はなく、フレームは1枚ずつ送って確認します。','処理はすべてメインスレッドで動き、キャンセルボタンがないため、とても大きな一括処理は終わるまでタブが止まります。','確認はChromiumのみです。'],
   versions:{body:['Nerulio：docs/PIXEL-LAB.md。ビルドしたサイトでPlaywrightによりChromiumを動かして測定し、すべての数値はダウンロードしたファイルを読み直して（Pillow、zipfile、json）確認しました。単体テストはtests/game-palette.test.mjsです。書き出す.gplはGIMPのパレット形式に従います。'],
    sources:[s('GIMP開発者ドキュメント：GIMP Palette形式（.gpl）',GIMP_GPL)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── palette extractor
 'game/palette-extractor':{
  type:'create',
  intent:{primary:'extract the colour palette of a sprite or pixel-art image',secondary:['per-colour pixel counts','colour budget: merge the rarest colours','export .gpl / .hex / .json','exact colour list vs reduced palette'],
   goal:'the palette a sprite really uses, with counts, reduced to a budget if needed, saved in a format other tools read',
   input:'one image or several animation frames (PNG etc.)',output:'palette as .gpl, .hex or .json; optionally the recoloured frames',
   target:'GIMP, Aseprite, Lospec-style tools and any program that reads .gpl or a HEX list',support:'full',
   evidence:['src/game/palette.js extract(), usage(), auditBudget(), mergePlan(), parseGPL/parseHexList/parsePaletteJSON, toPaletteJSON','src/pixel-engine.js accumulate() (5-bit buckets)','src/studio/pixel/indexed.js exactPalette() (Studio: exact colours)','docs/PIXEL-LAB.md §1, §2, §6 (budget: 16 → 8 verified)'],
   external:['GIMP Palette format (.gpl)','Lospec download formats']},
  en:{
   answer:'Extracting a palette lists the colours a sprite uses and how many pixels each covers, so you can spot accidental near-duplicates and keep a colour budget. Drop one image or all frames of an animation; the Palette stage builds one palette for all of them (16 colours by default, 2–256), shows each colour\'s exact pixel count and share, sorts it, and can merge the rarest colours into their nearest survivor to meet a target. Save it as GIMP `.gpl`, a HEX list or JSON; nothing is uploaded.',
   concept:{title:'An exact colour list and an extracted palette are not the same thing',body:[
    'The Lab\'s extraction is a reduction. Pixels are first collected into buckets of 5 bits per channel (32 levels instead of 256), weighted by alpha, and the buckets are then split by median cut in Oklab. Two colours that differ by less than 8 levels in every channel land in the same bucket and come out as one averaged colour. That is what you want for a noisy or resized image, but not when you need the literal colours of hand-made pixel art.',
    'For the literal list, use the Studio\'s Pixel workspace: Palette from the picture collects every exact colour (up to 255 plus the transparent entry), ordered by how often it is used. The Lab\'s counts, on the other hand, are exact for its palette: every pixel is assigned to its nearest palette colour in Oklab, with an exact-match shortcut, across every frame while the frames total under 4 megapixels.',
    'A colour budget turns the counts into a decision. Set a target, and the rarest colours over the target are listed; merging moves each of them into its nearest surviving colour in Oklab, never into another colour that is also being removed, so the result really uses the target number of colours.'],
    terms:[['Colour budget','The maximum number of colours a sprite or a frame may use.'],['5-bit bucket','A group of colours whose red, green and blue agree in their top 5 bits (32 levels each).'],['Share','A colour\'s pixel count divided by all opaque pixels.'],['.gpl','GIMP\'s text palette: a "GIMP Palette" header, optional Name and Columns, then one "R G B name" line per colour.']]},
   example:{title:'Example: why two greens become one, and a budget from 16 to 8',lead:'Bucket arithmetic, then the budget test from the Lab\'s verification:',lines:[
    '#3e8948 = (62,137,72)  → buckets 62>>3=7, 137>>3=17, 72>>3=9',
    '#3f8a4a = (63,138,74)  → buckets 63>>3=7, 138>>3=17, 74>>3=9   same bucket',
    'extracted: one colour, the pixel-weighted average of both',
    'exact list (Studio, Palette from the picture): both colours, sorted by use',
    'budget: 16 colours, target 8 → the 8 rarest are listed',
    'merge: each goes to its nearest survivor in Oklab',
    'export: the frames really use 8 colours, 0 outside the palette'],
    after:'If the two greens were drawn on purpose, count them in the Studio; if they came from resizing or compression, the merged colour is the one to keep.'},
   outputs:{title:'Palette files the Lab writes',rows:[
    ['palette.gpl','GIMP Palette text: `Name:`, `Columns:`, then `R G B` and the hex code as the colour name. Opens in GIMP and Aseprite.'],
    ['palette.hex','One `#rrggbb` per line, the plain list Lospec also offers.'],
    ['palette.json','`name`, `colors` as `#rrggbb`, `rgb` as [r,g,b] triples, `count` and `source`.']]},
   verify:{title:'Check the extracted palette',steps:[
    'Compare the colour count with the Studio\'s exact list: a big difference means the image was noisy or resized.',
    'Sort by frequency: colours with a share near 0 % are candidates for the budget merge or stray-pixel cleanup.',
    'Import the exported file again (paste or file): it must give back the same number of colours.',
    'After a merge, export the frames and count their colours in another tool: the count must equal the target.']},
   trouble:{rows:[
    ['Two colours that should stay separate were merged','They fall into the same 5-bit bucket (less than 8 levels apart per channel)','Compare with Palette from the picture in the Studio\'s Pixel workspace','Use the Studio\'s exact list, or make the colours more distinct'],
    ['Asked for 32 colours, got fewer','The image has fewer distinct buckets than requested; a box cannot be split below one colour','The palette shows fewer swatches than the count','Nothing is wrong: the image uses that many colours'],
    ['A palette file will not import','The Lab reads GIMP .gpl, HEX lists and JSON only; a JASC .pal, a Paint.net .txt with AARRGGBB values, or a .gpl with Aseprite\'s "Channels: RGBA" line is rejected','The error names the line it could not read','Download the .gpl or .hex version, or load the file in the Studio\'s Pixel workspace, which reads more formats'],
    ['Counts cover only the visible frame','All frames together exceed 4 megapixels','The panel says so next to the counts','Load fewer frames for exact totals']]},
   alternatives:{rows:[
    ['Studio Pixel workspace: Palette from the picture','You need the literal colours of hand-drawn art, or palette formats beyond .gpl/.hex/.json (.pal, .ase, .act). See [[game/pixel-art-palette-editor|the palette editor]].'],
    ['Starting from a published palette','You want the sprite to follow a known palette instead of its own: [[game/lospec-palette|Lospec palettes]].'],
    ['Checking scale and blur before extracting','The image may be an upscale: counts from a blurred upscale are meaningless until it is snapped to 1×; see [[game/pixel-perfect-checker|the pixel-perfect checker]].']]},
   limits:['Extraction merges colours closer than 8 levels per channel; it is not an exact inventory.','Reads and writes .gpl, HEX and JSON only.','Exact counts stop at 4 megapixels of total frame area.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md (Chromium; the budget merge from 16 to 8 colours was re-counted in the exported PNGs; .gpl, .hex and JSON round trips 16 → 16 colours). The bucket arithmetic follows src/pixel-engine.js. File layouts follow the GIMP specification and Lospec\'s own downloads.'],
    sources:[s('GIMP developer docs: GIMP Palette format (.gpl)',GIMP_GPL),s('Lospec: PICO-8 palette and its download formats',LOSPEC.pico)]}
  },
  ko:{
   answer:'팔레트 추출은 스프라이트가 쓰는 색과 색마다 몇 픽셀을 차지하는지 보여 주므로, 실수로 생긴 거의 같은 색을 찾고 색 예산을 지킬 수 있습니다. 이미지 한 장이나 애니메이션의 모든 프레임을 끌어다 놓으면 팔레트 단계가 전체에 쓸 팔레트 하나(기본 16색, 2~256)를 만들고, 색마다 정확한 픽셀 수와 비율을 보여 주고, 정렬하며, 목표에 맞게 가장 드문 색을 가장 가까운 남는 색으로 합칠 수 있습니다. GIMP `.gpl`, HEX 목록, JSON으로 저장하며 아무것도 업로드하지 않습니다.',
   concept:{title:'정확한 색 목록과 추출한 팔레트는 다릅니다',body:[
    '랩의 추출은 색을 줄이는 과정입니다. 먼저 픽셀을 채널당 5비트(256단계 대신 32단계) 칸에 알파로 가중해 모으고, 그 칸들을 Oklab에서 중앙값 분할로 나눕니다. 모든 채널에서 8단계 미만으로 차이 나는 두 색은 같은 칸에 들어가 평균한 색 하나로 나옵니다. 잡음이 있거나 크기가 바뀐 이미지에는 바람직하지만, 손으로 찍은 도트의 색을 그대로 알아야 할 때는 맞지 않습니다.',
    '그대로의 목록이 필요하면 Studio 픽셀 작업 공간의 그림에서 팔레트 만들기를 쓰세요. 정확한 색을 모두(투명 칸 외에 최대 255개) 모아 많이 쓰인 순으로 늘어놓습니다. 반면 랩의 개수는 랩 팔레트 기준으로 정확합니다. 모든 픽셀을 Oklab 기준 가장 가까운 팔레트 색에 배정하며(정확히 같은 색은 바로 배정), 프레임 합계가 4메가픽셀 미만이면 모든 프레임을 셉니다.',
    '색 예산은 개수를 결정으로 바꿔 줍니다. 목표를 정하면 목표를 넘는 가장 드문 색이 나열되고, 합치기는 각 색을 Oklab에서 가장 가까운 남는 색으로 옮깁니다. 함께 지워질 색끼리는 합치지 않으므로 결과는 정말로 목표 개수의 색만 씁니다.'],
    terms:[['색 예산','스프라이트나 프레임 하나가 쓸 수 있는 최대 색 수.'],['5비트 칸','빨강·초록·파랑의 상위 5비트(각 32단계)가 같은 색들의 묶음.'],['비율','한 색의 픽셀 수를 불투명 픽셀 전체로 나눈 값.'],['.gpl','김프의 텍스트 팔레트. "GIMP Palette" 머리말, 선택적인 Name과 Columns, 그 뒤 색마다 "R G B 이름" 한 줄.']]},
   example:{title:'예시: 초록 둘이 하나가 되는 이유, 그리고 16색에서 8색으로',lead:'칸 계산과, 랩 검증에 쓴 예산 시험입니다.',lines:[
    '#3e8948 = (62,137,72)  → 칸 62>>3=7, 137>>3=17, 72>>3=9',
    '#3f8a4a = (63,138,74)  → 칸 63>>3=7, 138>>3=17, 74>>3=9   같은 칸',
    '추출 결과: 두 색을 픽셀 수로 가중 평균한 색 하나',
    '정확한 목록(Studio, 그림에서 팔레트 만들기): 두 색 모두, 사용량 순',
    '예산: 16색, 목표 8 → 가장 드문 8색이 나열됨',
    '합치기: 각각 Oklab에서 가장 가까운 남는 색으로',
    '내보내기: 프레임이 실제로 8색만 씀, 팔레트 밖 0'],
    after:'두 초록을 일부러 칠했다면 Studio에서 세고, 크기 변경이나 압축 때문에 생긴 색이라면 합쳐진 색을 남기세요.'},
   outputs:{title:'랩이 쓰는 팔레트 파일',rows:[
    ['palette.gpl','김프 팔레트 텍스트: `Name:`, `Columns:`, 그 뒤 `R G B`와 색 이름으로 쓴 hex 코드. 김프와 에이스프라이트에서 열립니다.'],
    ['palette.hex','한 줄에 `#rrggbb` 하나. Lospec도 제공하는 단순 목록.'],
    ['palette.json','`name`, `#rrggbb` 형식의 `colors`, [r,g,b] 형식의 `rgb`, `count`, `source`.']]},
   verify:{title:'추출한 팔레트 확인하기',steps:[
    '색 개수를 Studio의 정확한 목록과 비교합니다. 차이가 크면 이미지에 잡음이 있거나 크기가 바뀐 것입니다.',
    '빈도순으로 정렬합니다. 비율이 0 %에 가까운 색은 예산 합치기나 외톨이 픽셀 정리 대상입니다.',
    '내보낸 파일을 다시 가져옵니다(붙여 넣기나 파일). 같은 수의 색이 돌아와야 합니다.',
    '합친 뒤 프레임을 내보내 다른 도구로 색을 셉니다. 목표와 같아야 합니다.']},
   trouble:{rows:[
    ['따로 남아야 할 두 색이 합쳐짐','같은 5비트 칸에 들어감(채널마다 8단계 미만 차이)','Studio 픽셀 작업 공간의 그림에서 팔레트 만들기와 비교','Studio의 정확한 목록을 쓰거나 두 색의 차이를 키우기'],
    ['32색을 요청했는데 더 적게 나옴','이미지의 서로 다른 칸이 요청보다 적음. 한 색 아래로는 나눌 수 없음','팔레트 견본이 요청 수보다 적음','문제 아님. 이미지가 그만큼의 색만 씀'],
    ['팔레트 파일을 가져올 수 없음','랩은 김프 .gpl, HEX 목록, JSON만 읽음. JASC .pal, AARRGGBB 값의 Paint.net .txt, 에이스프라이트의 "Channels: RGBA" 줄이 있는 .gpl은 거부됨','오류 메시지가 읽지 못한 줄을 알려 줌','.gpl이나 .hex 판을 받거나, 더 많은 형식을 읽는 Studio 픽셀 작업 공간에서 불러오기'],
    ['개수가 보이는 프레임만 셈','전체 프레임 합계가 4메가픽셀을 넘음','개수 옆 패널에 그렇게 표시됨','정확한 합계가 필요하면 프레임을 적게 넣기']]},
   alternatives:{rows:[
    ['Studio 픽셀 작업 공간: 그림에서 팔레트 만들기','손으로 찍은 그림의 색을 그대로 알아야 하거나 .gpl·.hex·.json 밖의 형식(.pal, .ase, .act)이 필요할 때. [[game/pixel-art-palette-editor|팔레트 편집기]] 참고.'],
    ['공개된 팔레트에서 시작','스프라이트 자체 색 대신 알려진 팔레트를 따르게 하려면 [[game/lospec-palette|Lospec 팔레트]].'],
    ['추출 전에 배율과 흐림 확인','확대된 이미지일 수 있다면, 흐리게 확대된 그림의 개수는 1배로 맞추기 전까지 의미가 없습니다. [[game/pixel-perfect-checker|픽셀 퍼펙트 검사]] 참고.']]},
   limits:['추출은 채널마다 8단계보다 가까운 색을 합치므로 정확한 목록이 아닙니다.','.gpl, HEX, JSON만 읽고 씁니다.','정확한 개수는 전체 프레임 면적 4메가픽셀까지입니다.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md(Chromium. 16색에서 8색으로 합친 결과를 내보낸 PNG에서 다시 셌고, .gpl·.hex·JSON 왕복은 16색 → 16색). 칸 계산은 src/pixel-engine.js를 따릅니다. 파일 구조는 김프 사양과 Lospec이 실제로 내려주는 파일을 따릅니다.'],
    sources:[s('GIMP 개발자 문서: GIMP Palette 형식(.gpl)',GIMP_GPL),s('Lospec: PICO-8 팔레트와 다운로드 형식',LOSPEC.pico)]}
  },
  ja:{
   answer:'パレットの抽出は、スプライトが使っている色と、それぞれが何ピクセルを占めるかを示すので、うっかりできたほぼ同じ色を見つけ、色数の予算を守れます。画像1枚かアニメの全フレームをドロップすると、パレットの工程が全体で使うパレットを1つ作り（既定16色、2〜256）、色ごとの正確なピクセル数と割合を表示し、並べ替え、目標に合わせて最も少ない色を最も近い残りの色へ統合できます。GIMPの`.gpl`、HEXリスト、JSONで保存でき、何もアップロードしません。',
   concept:{title:'正確な色の一覧と、抽出したパレットは別物',body:[
    'ラボの抽出は色を減らす処理です。まずピクセルをチャンネルあたり5ビット（256段階ではなく32段階）の箱にアルファで重み付けして集め、その箱をOklabでメディアンカットします。すべてのチャンネルで差が8段階未満の2色は同じ箱に入り、平均した1色として出てきます。ノイズのある画像やサイズを変えた画像には望ましい動きですが、手で打ったドット絵の色をそのまま知りたいときには向きません。',
    'そのままの一覧が必要なら、Studioのピクセル作業画面で「絵からパレットを作る」を使います。正確な色をすべて（透明の枠のほかに最大255色）集め、使用量の多い順に並べます。一方ラボの数値は、ラボのパレットに対しては正確です。すべてのピクセルをOklabで最も近いパレット色へ割り当て（完全一致はそのまま）、フレームの合計が4メガピクセル未満なら全フレームを数えます。',
    '色数の予算は、数値を判断に変えてくれます。目標を決めると、目標を超える最も少ない色が並び、統合は各色をOklabで最も近い残る色へ移します。一緒に消える色どうしは統合しないので、結果は本当に目標の色数だけを使います。'],
    terms:[['色数の予算','スプライトやフレーム1枚が使ってよい最大の色数。'],['5ビットの箱','赤・緑・青の上位5ビット（各32段階）が一致する色のまとまり。'],['割合','ある色のピクセル数を不透明ピクセル全体で割った値。'],['.gpl','GIMPのテキストパレット。「GIMP Palette」のヘッダー、任意のNameとColumns、その後に色ごとの「R G B 名前」の行。']]},
   example:{title:'例：2つの緑が1つになる理由と、16色から8色への予算',lead:'箱の計算と、ラボの検証で使った予算のテストです。',lines:[
    '#3e8948 = (62,137,72)  → 箱 62>>3=7、137>>3=17、72>>3=9',
    '#3f8a4a = (63,138,74)  → 箱 63>>3=7、138>>3=17、74>>3=9   同じ箱',
    '抽出結果：2色をピクセル数で重み付け平均した1色',
    '正確な一覧（Studio、絵からパレットを作る）：2色とも、使用量順',
    '予算：16色、目標8 → 最も少ない8色が並ぶ',
    '統合：それぞれOklabで最も近い残る色へ',
    '書き出し：フレームは実際に8色だけ、パレット外0'],
    after:'2つの緑をわざと塗り分けたならStudioで数え、リサイズや圧縮でできた色なら統合後の色を残してください。'},
   outputs:{title:'ラボが書き出すパレットファイル',rows:[
    ['palette.gpl','GIMPパレットのテキスト：`Name:`、`Columns:`、その後に`R G B`と色名としてのhexコード。GIMPとAsepriteで開けます。'],
    ['palette.hex','1行に`#rrggbb`を1つ。Lospecも配布している素朴な一覧。'],
    ['palette.json','`name`、`#rrggbb`形式の`colors`、[r,g,b]形式の`rgb`、`count`、`source`。']]},
   verify:{title:'抽出したパレットを確認する',steps:[
    '色数をStudioの正確な一覧と比べます。差が大きければ、画像にノイズがあるかリサイズされています。',
    '頻度順に並べます。割合が0 %近い色は、予算の統合か孤立ピクセルの整理の候補です。',
    '書き出したファイルを読み込み直します（貼り付けかファイル）。同じ色数が戻るはずです。',
    '統合後にフレームを書き出し、別のツールで色を数えます。目標と一致するはずです。']},
   trouble:{rows:[
    ['分けておきたい2色がまとめられた','同じ5ビットの箱に入る（チャンネルごとの差が8段階未満）','Studioのピクセル作業画面の「絵からパレットを作る」と比べる','Studioの正確な一覧を使うか、2色の差を広げる'],
    ['32色を指定したのに少なく出た','画像の異なる箱が指定より少ない。1色より細かくは分けられない','パレットの見本が指定数より少ない','問題なし。画像がその色数しか使っていない'],
    ['パレットファイルを読み込めない','ラボが読むのはGIMPの.gpl、HEXリスト、JSONだけ。JASCの.pal、AARRGGBBのPaint.net .txt、Asepriteの「Channels: RGBA」行がある.gplは拒否される','エラーが読めなかった行を示す','.gplか.hex版をダウンロードするか、より多くの形式を読むStudioのピクセル作業画面で読み込む'],
    ['数値が表示中のフレームだけ','全フレームの合計が4メガピクセルを超えている','数値の横のパネルにその旨が出る','正確な合計が必要ならフレームを減らして読み込む']]},
   alternatives:{rows:[
    ['Studioのピクセル作業画面：絵からパレットを作る','手描きの絵の色をそのまま知りたいとき、または.gpl・.hex・.json以外の形式（.pal、.ase、.act）が必要なとき。[[game/pixel-art-palette-editor|パレットエディタ]]を参照。'],
    ['公開パレットから始める','スプライト固有の色ではなく、知られたパレットに従わせたいなら[[game/lospec-palette|Lospecパレット]]。'],
    ['抽出の前に倍率とぼけを確認','拡大画像かもしれないなら、ぼやけた拡大画像の色数は等倍に戻すまで意味がありません。[[game/pixel-perfect-checker|ピクセルパーフェクトチェッカー]]を参照。']]},
   limits:['抽出はチャンネルあたり8段階より近い色をまとめるので、正確な一覧ではありません。','読み書きできるのは.gpl、HEX、JSONだけです。','正確な数値は全フレーム面積4メガピクセルまでです。'],
   versions:{body:['Nerulio：docs/PIXEL-LAB.md（Chromium。16色から8色への統合結果を書き出したPNGで数え直し、.gpl・.hex・JSONの往復は16色 → 16色）。箱の計算はsrc/pixel-engine.jsに従います。ファイルの構造はGIMPの仕様と、Lospecが実際に配布するファイルに基づきます。'],
    sources:[s('GIMP開発者ドキュメント：GIMP Palette形式（.gpl）',GIMP_GPL),s('Lospec：PICO-8パレットとダウンロード形式',LOSPEC.pico)]}
  }
 },
 // ───────────────────────────────────────────────────────────────── palette swap / ramps
 'game/palette-swap-ramp':{
  type:'create',
  intent:{primary:'recolour a pixel-art sprite by swapping whole shading ramps (palette swap, team colours)',secondary:['map a ramp by lightness position, not nearest colour','generate a target ramp from one base colour','team colour variants for every frame','status tints (frozen, poison)'],
   goal:'recoloured frames where every shade keeps its place in the ramp, one set per team colour',
   input:'PNG frames of a sprite',output:'recoloured PNG frames; team variants as a ZIP with one folder and one .gpl per variant',
   target:'any engine that loads PNG frames',support:'full',
   evidence:['src/game/palette.js rampMap(), generateRamp() (hueShift 12, chromaCurve .35), teamVariants(), hueReplace(), STATUS_PRESETS','docs/PIXEL-LAB.md §4 and Verification (4 variants × 8 frames: 3 slots changed, 13 byte-identical)','src/studio/workspaces/pixel/panels.js variantsDialog (Studio alternative)'],
   external:['Aseprite docs: Replace Color (tolerance, Selected/All)']},
  en:{
   answer:'A palette swap recolours a sprite by mapping each colour of one shading ramp onto the step in the same position of another ramp: the darkest red of a cloak becomes the darkest blue, the highlight becomes the highlight, and nothing else changes. In the Pixel Lab\'s Recolour stage you select the source colours, generate a target ramp from one base colour (or pick one), and apply it to every frame; team variants (red, blue, green, yellow or any #RRGGBB) export as one ZIP with a folder and a .gpl per variant.',
   concept:{title:'Map by position in the ramp, never by nearest colour',body:[
    'Replacing each colour by its nearest match in the new palette breaks shading: two neighbouring shades of red can both land on the same blue, and a light red can land on a darker blue than its shadow. The Lab sorts the selected source colours by Oklab lightness and maps them onto the target ramp by position, so the first becomes the darkest target, the last the lightest, and the order cannot invert.',
    'A target ramp can be generated from a single base colour. It keeps the source ramp\'s lightness steps, takes the base colour\'s hue and chroma (so the base\'s own lightness is not used), boosts chroma in the mid-tones and rotates hue by up to 12° across the ramp, darker end one way and lighter end the other. The result is a starting point to adjust, not a finished art decision.',
    'Every recolour is a palette transform: a pixel keeps its palette index and only the colour behind the index changes. Two frames that shared a shade still share it, which is why the swap cannot introduce flicker or stray colours between frames.'],
    terms:[['Ramp swap','Mapping selected source colours onto a target ramp by their position from dark to light.'],['Team variant','The same sprite recoloured with a different base colour for each team or player.'],['Hue window','A range of hues (centre ± degrees) whose colours are replaced while keeping their own lightness.'],['Status tint','A recipe that pulls every colour toward one hue (frozen, poison, burn, ghost, damage flash).']]},
   example:{title:'Example: a red cloak ramp turned into team blue',lead:'Computed with the Lab\'s own functions (L = Oklab lightness, h = hue):',lines:[
    'source (red cloak)   #5a1e28 L0.33 h13 | #a02c3a L0.48 h18 | #dc5a50 L0.63 h27 | #f5a08c L0.79 h34',
    'base: team blue      #3467d6 (L0.54 is ignored; hue 263°, chroma 0.18 are used)',
    'generated ramp       #002d8c L0.35 | #004ed5 L0.48 | #4f7bff L0.62 | #99acff L0.76',
    'hue along the ramp   262° → 262° → 267° → 273°',
    'mapping by position  darkest→darkest … lightest→lightest; black and white untouched',
    '3 colours onto a 5-step ramp: positions 0, 0.5, 1 → steps 0, 2, 4',
    'test: 4 variants × 8 frames = 32 PNGs; 3 selected slots changed, 13 byte-identical'],
    after:'The generated lightness follows the source within 0.03; the lightest blue lands a little lower because sRGB cannot hold that blue at full chroma. Nudge it by hand if the highlight looks dull.'},
   verify:{title:'Check a swap',steps:[
    'Before applying, compare the source and target swatches side by side: both rows should run dark to light.',
    'Step through the frames: every frame should change only the selected colours, and outlines, skin and eyes stay as they were.',
    'Open one variant\'s .gpl: the untouched slots have the original colours in the original order.',
    'Put the variants next to each other at 1×: the teams should be distinguishable at game size, not only zoomed in.']},
   trouble:{rows:[
    ['The shading came out inverted or flat','A colour outside the ramp (outline, skin) was selected with it','The selected swatches do not form one dark-to-light sequence','Select only the ramp\'s colours; the order you click in does not matter, lightness decides'],
    ['Other parts changed colour too','The cloak shares a palette entry with another part of the sprite','Select that swatch and compare its pixel count with the cloak alone: other parts use it too','Give that part its own colour first (for example in the Studio\'s Pixel workspace), then swap'],
    ['The team colour is much darker or lighter than the base I picked','The generated ramp keeps the source lightness steps and uses only the base\'s hue and chroma','Compare the base swatch with the middle of the generated ramp','Pick a target ramp by hand, or choose a base with the hue you want and adjust the steps'],
    ['The hue window catches too much or nothing','The window (± degrees) is too wide or too narrow, and near-grey colours are ignored','The preview marks the matching colours with a tick','Narrow or widen the window; greys need the ramp swap instead']]},
   alternatives:{rows:[
    ['Team-colour variants in the Studio\'s Pixel workspace','The sprite has layers and tags: variants apply to every frame and layer and each becomes a new sprite; in an indexed sprite a single palette edit recolours every frame. See [[game/pixel-art-palette-editor|the palette editor]].'],
    ['One-colour palette swap with a tolerance','You only need to replace a single colour, with a shading offset: [[palette-swap|palette swap]].'],
    ['Aseprite: Edit › Replace Color','You work in Aseprite and replace colours one at a time, with a tolerance, on the selection or on all cels.']]},
   limits:['Variants export as PNG frames and .gpl files, not as .aseprite.','One palette for all loaded frames: a sheet with two unrelated characters must be split first.','Status presets are recipes, not authored art.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md (Chromium; 4 team variants × 8 frames exported as 32 PNGs in 4 folders, each changing exactly the 3 selected palette slots and leaving the other 13 byte-identical). The ramp above was computed with src/game/palette.js. Aseprite\'s Replace Color follows its documentation.'],
    sources:[s('Aseprite docs: Replace Color',A.replace)]}
  },
  ko:{
   answer:'팔레트 교체는 명암 램프의 각 색을 다른 램프의 같은 위치 단계로 옮겨 스프라이트를 다시 칠합니다. 망토의 가장 어두운 빨강은 가장 어두운 파랑이 되고, 하이라이트는 하이라이트가 되며, 나머지는 바뀌지 않습니다. 픽셀 랩의 재채색 단계에서 원본 색을 고르고, 기준 색 하나로 목표 램프를 만들거나 직접 골라 모든 프레임에 적용합니다. 팀 변형(빨강·파랑·초록·노랑 또는 임의 #RRGGBB)은 변형마다 폴더와 .gpl이 든 ZIP 하나로 내보냅니다.',
   concept:{title:'가장 가까운 색이 아니라 램프 속 위치로 옮기기',body:[
    '색마다 새 팔레트에서 가장 가까운 색으로 바꾸면 명암이 깨집니다. 이웃한 빨강 두 단계가 같은 파랑으로 가 버리거나, 밝은 빨강이 그림자보다 더 어두운 파랑으로 갈 수 있습니다. 랩은 고른 원본 색을 Oklab 명도로 정렬한 뒤 위치대로 목표 램프에 대응시킵니다. 첫 색은 목표의 가장 어두운 색, 마지막 색은 가장 밝은 색이 되고 순서가 뒤집힐 수 없습니다.',
    '목표 램프는 기준 색 하나로 만들 수 있습니다. 원본 램프의 명도 간격은 그대로 두고, 기준 색의 색상과 채도만 가져오며(기준 색 자체의 명도는 쓰지 않음), 중간 톤의 채도를 높이고 램프를 따라 색상을 최대 12°까지 한쪽 끝은 이쪽, 다른 끝은 저쪽으로 돌립니다. 결과는 다듬기 위한 출발점이지 완성된 아트 결정이 아닙니다.',
    '모든 재채색은 팔레트 변환입니다. 픽셀은 팔레트 번호를 그대로 유지하고 그 번호 뒤의 색만 바뀝니다. 같은 명암을 쓰던 두 프레임은 계속 같은 명암을 쓰므로, 교체 때문에 프레임 사이에 깜박임이나 튀는 색이 생길 수 없습니다.'],
    terms:[['램프 교체','고른 원본 색을 어두운 것부터 밝은 것까지의 위치대로 목표 램프에 대응시키는 것.'],['팀 변형','팀이나 플레이어마다 기준 색을 달리해 같은 스프라이트를 다시 칠한 것.'],['색상 범위','중심 ± 각도로 정한 색상 구간. 그 안의 색은 자기 명도를 유지한 채 바뀜.'],['상태 색조','모든 색을 한 색상 쪽으로 당기는 레시피(얼음, 독, 화상, 유령, 피격 번쩍임).']]},
   example:{title:'예시: 빨간 망토 램프를 팀 파랑으로',lead:'랩의 함수로 직접 계산한 값입니다(L = Oklab 명도, h = 색상).',lines:[
    '원본(빨간 망토)      #5a1e28 L0.33 h13 | #a02c3a L0.48 h18 | #dc5a50 L0.63 h27 | #f5a08c L0.79 h34',
    '기준: 팀 파랑        #3467d6 (L0.54는 무시, 색상 263°와 채도 0.18을 사용)',
    '만들어진 램프        #002d8c L0.35 | #004ed5 L0.48 | #4f7bff L0.62 | #99acff L0.76',
    '램프를 따른 색상     262° → 262° → 267° → 273°',
    '위치로 대응          가장 어두운 것→가장 어두운 것 … 가장 밝은 것→가장 밝은 것, 검정·흰색은 그대로',
    '3색을 5단계 램프로: 위치 0, 0.5, 1 → 단계 0, 2, 4',
    '시험: 변형 4개 × 프레임 8장 = PNG 32장, 고른 3칸만 바뀌고 13칸은 바이트 그대로'],
    after:'만들어진 명도는 원본과 0.03 이내로 맞습니다. 가장 밝은 파랑이 조금 낮게 나온 것은 sRGB가 그 파랑을 최대 채도로 담지 못하기 때문입니다. 하이라이트가 칙칙해 보이면 손으로 조금 올리세요.'},
   verify:{title:'교체 결과 확인하기',steps:[
    '적용하기 전에 원본과 목표 견본을 나란히 봅니다. 두 줄 모두 어두운 것에서 밝은 것으로 이어져야 합니다.',
    '프레임을 넘겨 봅니다. 모든 프레임에서 고른 색만 바뀌고 외곽선·피부·눈은 그대로여야 합니다.',
    '변형 하나의 .gpl을 엽니다. 건드리지 않은 칸은 원래 색이 원래 순서대로 있어야 합니다.',
    '변형들을 1배로 나란히 놓습니다. 확대해서가 아니라 게임 크기에서 팀이 구별돼야 합니다.']},
   trouble:{rows:[
    ['명암이 뒤집히거나 밋밋해짐','램프가 아닌 색(외곽선, 피부)까지 함께 골랐음','고른 견본이 어두운 것에서 밝은 것으로 한 줄로 이어지지 않음','램프의 색만 고르기. 클릭 순서는 상관없고 명도가 순서를 정함'],
    ['다른 부분 색까지 바뀜','망토가 스프라이트의 다른 부분과 팔레트 칸을 함께 씀','그 견본을 골라 픽셀 수를 망토만의 면적과 비교하면 다른 부분도 쓰고 있음','먼저 그 부분에 따로 색을 주고(예: Studio 픽셀 작업 공간) 교체'],
    ['팀 색이 고른 기준 색보다 훨씬 어둡거나 밝음','만들어진 램프는 원본 명도 간격을 유지하고 기준 색에서는 색상과 채도만 씀','기준 견본과 만들어진 램프의 가운데를 비교','목표 램프를 직접 고르거나, 원하는 색상의 기준을 골라 단계를 조정'],
    ['색상 범위가 너무 많이 잡거나 아무것도 못 잡음','범위(± 각도)가 너무 넓거나 좁고, 회색에 가까운 색은 무시됨','미리보기에서 해당 색에 체크 표시가 붙음','범위를 좁히거나 넓히기. 회색은 램프 교체로']]},
   alternatives:{rows:[
    ['Studio 픽셀 작업 공간의 팀 색 변형','레이어와 태그가 있는 스프라이트라면. 변형이 모든 프레임과 레이어에 적용되고 각각 새 스프라이트가 되며, 인덱스 스프라이트는 팔레트 한 번 수정으로 모든 프레임이 바뀝니다. [[game/pixel-art-palette-editor|팔레트 편집기]] 참고.'],
    ['허용 오차가 있는 한 색 교체','색 하나만 명암 오프셋과 함께 바꾸면 될 때: [[palette-swap|팔레트 교체]].'],
    ['에이스프라이트: Edit › Replace Color','에이스프라이트에서 작업하며 색을 하나씩, 허용 오차를 두고 선택 영역이나 모든 셀에서 바꿀 때.']]},
   limits:['변형은 PNG 프레임과 .gpl로 내보내며 .aseprite는 아닙니다.','불러온 모든 프레임에 팔레트 하나를 씁니다. 관련 없는 캐릭터 둘이 든 시트는 먼저 나눠야 합니다.','상태 프리셋은 레시피이지 직접 그린 아트가 아닙니다.'],
   versions:{body:['Nerulio: docs/PIXEL-LAB.md(Chromium. 팀 변형 4개 × 프레임 8장을 폴더 4개의 PNG 32장으로 내보냈고, 각각 고른 팔레트 3칸만 바뀌고 나머지 13칸은 바이트 그대로였음). 위 램프는 src/game/palette.js로 계산했습니다. 에이스프라이트의 Replace Color 설명은 공식 문서를 따릅니다.'],
    sources:[s('Aseprite 문서: Replace Color',A.replace)]}
  },
  ja:{
   answer:'パレットスワップは、陰影のランプの各色を別のランプの同じ位置の段へ置き換えてスプライトの色を変えます。マントの最も暗い赤は最も暗い青に、ハイライトはハイライトになり、ほかは変わりません。ピクセルラボの色替えの工程で元の色を選び、基準色1つから目標ランプを作るか自分で選んで、全フレームに適用します。チームの色違い（赤・青・緑・黄、または任意の#RRGGBB）は、色違いごとのフォルダーと.gplが入ったZIP1つで書き出します。',
   concept:{title:'最も近い色ではなく、ランプ内の位置で置き換える',body:[
    '色ごとに新しいパレットで最も近い色へ置き換えると、陰影が崩れます。隣り合う赤の2段が同じ青になったり、明るい赤が影よりも暗い青になったりします。ラボは選んだ元の色をOklabの明度で並べ、位置で目標ランプに対応づけます。最初の色は目標の最も暗い色、最後の色は最も明るい色になり、順番が逆転することはありません。',
    '目標ランプは基準色1つから作れます。元のランプの明度の段差はそのまま、基準色の色相と彩度だけを使い（基準色そのものの明度は使わない）、中間調の彩度を上げ、ランプに沿って色相を最大12°、暗い端と明るい端で逆向きに回します。結果は調整のための出発点で、完成したアートの判断ではありません。',
    '色替えはすべてパレットの変換です。ピクセルはパレット番号を保ち、番号の裏の色だけが変わります。同じ陰影を使っていた2フレームは同じ陰影のままなので、スワップによってフレーム間にちらつきや飛んだ色が生じることはありません。'],
    terms:[['ランプの置き換え','選んだ元の色を、暗い順から明るい順の位置で目標ランプに対応づけること。'],['チームの色違い','チームやプレイヤーごとに基準色を変えて、同じスプライトを色替えしたもの。'],['色相範囲','中心 ± 角度で決める色相の区間。範囲内の色は自分の明度を保って置き換わる。'],['状態の色味','すべての色を1つの色相へ寄せるレシピ（凍結、毒、炎上、ゴースト、被弾フラッシュ）。']]},
   example:{title:'例：赤いマントのランプをチームの青に',lead:'ラボの関数で計算した値です（L = Oklabの明度、h = 色相）。',lines:[
    '元（赤いマント）     #5a1e28 L0.33 h13 | #a02c3a L0.48 h18 | #dc5a50 L0.63 h27 | #f5a08c L0.79 h34',
    '基準：チームの青     #3467d6（L0.54は無視、色相263°と彩度0.18を使用）',
    '作られたランプ       #002d8c L0.35 | #004ed5 L0.48 | #4f7bff L0.62 | #99acff L0.76',
    'ランプに沿った色相   262° → 262° → 267° → 273°',
    '位置で対応           最も暗い→最も暗い … 最も明るい→最も明るい、黒と白はそのまま',
    '3色を5段のランプへ：位置0、0.5、1 → 段0、2、4',
    'テスト：色違い4つ × 8フレーム = PNG 32枚、選んだ3枠だけが変わり13枠はバイト一致'],
    after:'作られた明度は元と0.03以内で一致します。最も明るい青が少し低いのは、sRGBがその青を最大の彩度で表せないためです。ハイライトがくすんで見えるなら手で少し上げてください。'},
   verify:{title:'スワップを確認する',steps:[
    '適用する前に、元と目標の見本を並べて見ます。どちらの列も暗い色から明るい色へ続くはずです。',
    'フレームを送ります。どのフレームでも選んだ色だけが変わり、縁取り・肌・目はそのままのはずです。',
    '色違い1つの.gplを開きます。触れていない枠は元の色が元の順で並ぶはずです。',
    '色違いを等倍で並べます。拡大時だけでなく、ゲームの大きさでチームを見分けられるはずです。']},
   trouble:{rows:[
    ['陰影が逆転した・平板になった','ランプ以外の色（縁取り、肌）も一緒に選んでいる','選んだ見本が暗い順から明るい順の1列になっていない','ランプの色だけを選ぶ。クリックの順は関係なく、明度が順番を決める'],
    ['ほかの部分の色まで変わった','マントがスプライトの別の部分とパレットの枠を共有している','その見本を選び、ピクセル数をマントだけの面積と比べると、ほかの部分でも使われている','先にその部分へ別の色を割り当ててから（例：Studioのピクセル作業画面）スワップ'],
    ['チームの色が選んだ基準色よりずっと暗い・明るい','作られたランプは元の明度の段差を保ち、基準色からは色相と彩度だけを使う','基準の見本と作られたランプの中央を比べる','目標ランプを手で選ぶか、欲しい色相の基準を選んで段を調整'],
    ['色相範囲が拾いすぎる・何も拾わない','範囲（± 角度）が広すぎるか狭すぎ、灰色に近い色は無視される','プレビューで該当する色にチェックが付く','範囲を狭める・広げる。灰色はランプの置き換えで']]},
   alternatives:{rows:[
    ['Studioのピクセル作業画面のチームカラー','レイヤーとタグのあるスプライトなら。色違いは全フレーム・全レイヤーに適用され、それぞれ新しいスプライトになり、インデックスのスプライトならパレットを1回直すだけで全フレームが変わります。[[game/pixel-art-palette-editor|パレットエディタ]]を参照。'],
    ['許容範囲つきの単色スワップ','1色だけを陰影オフセット付きで置き換えれば済むなら：[[palette-swap|パレットスワップ]]。'],
    ['Aseprite：Edit › Replace Color','Asepriteで作業していて、色を1つずつ許容範囲付きで、選択範囲か全セルで置き換えるとき。']]},
   limits:['色違いはPNGフレームと.gplで書き出し、.asepriteではありません。','読み込んだ全フレームに1つのパレットを使います。無関係なキャラ2体が入ったシートは先に分けてください。','状態のプリセットはレシピで、描き起こしたアートではありません。'],
   versions:{body:['Nerulio：docs/PIXEL-LAB.md（Chromium。チームの色違い4つ × 8フレームを4フォルダーのPNG 32枚で書き出し、それぞれ選んだパレット3枠だけが変わり残り13枠はバイト一致）。上のランプはsrc/game/palette.jsで計算しました。AsepriteのReplace Colorの説明は公式ドキュメントに基づきます。'],
    sources:[s('Asepriteドキュメント：Replace Color',A.replace)]}
  }
 }
};
