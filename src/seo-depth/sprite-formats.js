/** Intent content for the sprite-formats pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/aseprite.js (reader/writer, toSpriteProject), src/studio/sprite/aseprite-bridge.js
 * (Sprite › Export .aseprite), src/studio/sprite/{gif-decode,apng-decode,atlas-data,import-plan,importers}.js,
 * src/game/color-key.js, src/game/export/{anim,webm,bundle,atlas-json,common}.js, docs/STUDIO-SPRITE.md §10
 * (231-file .aseprite corpus), docs/STUDIO-PACK.md (export verification), docs/ENGINE-VERIFY.md.
 * Format and engine behaviour: the official documents cited in each page's `versions.sources`. */
const ASE_SPEC='[Aseprite file format specification](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md)';
const ASE_CLI='[Aseprite docs: Command line interface](https://www.aseprite.org/docs/cli/)';
const ASE_TAGS='[Aseprite docs: Tags](https://www.aseprite.org/docs/tags/)';
const ASE_SLICES='[Aseprite docs: Slices](https://www.aseprite.org/docs/slices/)';
const ASE_SHEET='[Aseprite docs: Sprite sheet](https://www.aseprite.org/docs/sprite-sheet/)';
const ASE_EXPORT='[Aseprite docs: Exporting](https://www.aseprite.org/docs/exporting/)';
const GIF_SPEC='[W3C: GIF89a specification](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)';
const WEBKIT_DELAY='[WebKit source: ImageDecoderCG::frameDurationAtIndex](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/graphics/cg/ImageDecoderCG.cpp)';
const PNG3='[W3C: PNG Third Edition (APNG chunks acTL, fcTL)](https://www.w3.org/TR/png-3/)';
const MDN_IMAGES='[MDN: Image file type and format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)';
const MDN_ENCODER='[MDN: VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder)';
const FFMPEG='[ffmpeg documentation](https://ffmpeg.org/ffmpeg.html)';
const FFMPEG_CODECS='[ffmpeg codecs: libx264](https://ffmpeg.org/ffmpeg-codecs.html)';
const PHASER_ANIMS='[Phaser docs: AnimationManager.createFromAseprite](https://docs.phaser.io/api-documentation/class/animations-animationmanager)';
const PHASER_LOADER='[Phaser docs: LoaderPlugin.aseprite](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)';
const PHASER_CONFIG='[Phaser docs: GameConfig pixelArt](https://docs.phaser.io/api-documentation/typedef/types-core)';
const PIXI_SHEET='[PixiJS docs: Spritesheet](https://pixijs.download/v8.11.0/docs/assets.Spritesheet.html)';
const PIXI_ANIM='[PixiJS docs: AnimatedSprite](https://pixijs.download/dev/docs/scene.AnimatedSprite.html)';
const PIXI_SCALE='[PixiJS docs: SCALE_MODE](https://pixijs.download/dev/docs/rendering.SCALE_MODE.html)';
const STARLING='[Starling docs: TextureAtlas XML format](https://doc.starling-framework.org/current/starling/textures/TextureAtlas.html)';
const FNF_CHAR='[Friday Night Funkin\' modding docs: Creating a character](https://github.com/FunkinCrew/funkin-modding-docs/blob/main/src/03-custom-characters/03-02-creating-a-character.md)';
export default {
/* ============================================================================ aseprite-viewer */
 'game/aseprite-viewer':{
  type:'format',
  intent:{primary:'open and inspect an .aseprite or .ase file without Aseprite installed',secondary:['what is inside an .aseprite file','play the tags and see frame durations','convert .aseprite to PNG, GIF or JSON'],
   goal:'see every frame, layer, tag, duration and slice of the file exactly as Aseprite exports it, and save it in a format other tools read',input:'.aseprite / .ase (RGBA, grayscale or indexed; layers, tags, slices, tilemaps optional)',output:'on-screen playback; optional PNG sheet + Aseprite JSON, GIF/APNG per tag, or a re-written .aseprite',target:'any machine with a browser (no Aseprite install)',support:'full',
   evidence:['src/game/aseprite.js (reader, renderFrame, toSpriteProject slice mapping)','src/studio/sprite/aseprite-bridge.js (layered vs flattened decision)','docs/STUDIO-SPRITE.md §10 (231 files: 222 layered, 9 flattened; 231/231 reopen in Aseprite 1.3.18.6)'],
   external:['Aseprite file format spec: header, frame duration, cel opacity and z-index, linked cels, tag repeat, slice keys','Aseprite docs: tags, slices, CLI']},
  en:{
   answer:"An `.aseprite` or `.ase` file is Aseprite's own binary document, not an image: it stores every frame with its duration in milliseconds, the layers with blend mode and opacity, the cels, tags, slices and palette. Browsers and image viewers cannot open it. Drop it here: Nerulio parses it inside this tab, composites each frame the way Aseprite's PNG export does (checked on 231 real files against Aseprite 1.3.18.6), plays the tags, and can save a PNG sheet with Aseprite JSON, a GIF or APNG per tag, or a new `.aseprite`. Nothing is uploaded.",
   concept:{title:'What is inside an .aseprite file',body:[
    "The format is documented by the Aseprite project. A 128-byte header holds the magic number `0xA5E0`, the canvas size and the colour depth: 32 bits per pixel is RGBA, 16 is grayscale with alpha, 8 is indexed, where every pixel is a palette index and one index can be transparent. Then come the frames. Each frame has a 16-byte header with its own duration in milliseconds, followed by chunks: layers (in the first frame), cels, palette, tags, slices, user data and, for tilemap layers, tilesets.",
    "What you see in Aseprite is not stored anywhere as a finished picture. A frame is built by drawing the visible layers from bottom to top: each cel (one layer's pixels at one frame, at its own x and y) with the layer opacity times the cel opacity, mixed by one of 19 blend modes from Normal to Divide. A cel can be linked, reusing another frame's pixels, and it can carry a z-index that moves it above or below other layers for that frame only. A viewer that shows the first layer, or ignores blend modes, shows a picture Aseprite would never export.",
    "Nerulio keeps the layers only when drawing them again with its own compositor gives exactly the pixels Aseprite renders; otherwise it shows the flattened frames and names the reason. On the 231-file test corpus 222 files stayed layered and 9 were flattened: 5 whose group composition differs and 4 that reorder layers with cel z-index. The frames are identical either way."],
    terms:[['Cel','One layer\'s pixels at one frame, with its own position and opacity. A linked cel points at the cel of another frame instead of storing pixels.'],
     ['Tag','A named frame range (`from`–`to`) with a direction (forward, reverse, ping-pong, ping-pong reverse) and a repeat count. Repeat 0 means “not specified”: endless in Aseprite\'s editor, once on export.'],
     ['Slice','A named rectangle, optionally with a 9-patch centre or a pivot point. Its keys are per frame: a key holds from its frame until the next key.'],
     ['Colour mode','RGBA, grayscale or indexed. In an indexed file the palette can change during the animation and one index is the transparent colour.']]},
   example:{title:'Example: reading a small character file',lead:'What the Import panel and the Timeline show for a 32 × 32 RGBA file with three layers and three tags, and the timing that follows from it:',lines:[
    'hero.aseprite  32 × 32 px · RGBA · 16 frames · 3 layers · 3 tags · 2 slices',
    'layers  outline  Normal    255',
    '        shadow   Multiply  128   (drawn at 128/255 ≈ 50 % over the layers below)',
    '        body     Normal    255',
    'tags    idle    0–3    4 × 125 ms                    forward ∞   one cycle 500 ms',
    '        walk    4–9    6 × 100 ms                    forward ∞   one cycle 600 ms',
    '        attack  10–15  100,100,100,100,150,250 ms    forward ×1  plays once, 800 ms',
    'slices  pivot  point (16, 31) on every frame  → frame pivot, confidence high (name)',
    '        hit    20 × 8 from frame 12           → hit box, confidence medium (name)'],
    after:'Set `idle` to ping-pong and one cycle becomes 0-1-2-3-2-1: six steps, 750 ms. The two slice guesses are decisions in the Import panel; click one to turn `hit` into a hurt box or to ignore it.'},
   outputs:{title:'What you can save from the viewer',rows:[
    ['hero.png + hero.json','Pack & Export › Aseprite JSON (hash or array): one packed sheet with `frames`, `meta.frameTags` and `meta.slices`, in the layout of Aseprite\'s own sprite sheet export. See [[game/aseprite-to-sprite-sheet|Aseprite to sprite sheet]].'],
    ['hero_idle.gif …','Pack & Export › Animated GIF: one file per tag, delays rounded to 1/100 s. See [[game/aseprite-to-gif|Aseprite to GIF]].'],
    ['hero_idle.png …','Pack & Export › APNG: one animated PNG per tag, every pixel and millisecond exact.'],
    ['hero.aseprite','Sprite › Export .aseprite…: a new file Aseprite opens, with layers, tags, durations and slices. The original you dropped is never changed.']]},
   verify:{steps:[
    'Import panel, layer decision: “layered” means the layer rows reproduce Aseprite\'s render on every frame; “flattened” gives the reason and the first frame that differed.',
    'Step through a tag with `,` and `.` and read each frame\'s duration in the Frame panel; the sum is one cycle (walk: 6 × 100 ms = 600 ms).',
    'Play the tag with Enter: a repeat of ×1 stops on its last frame, ∞ keeps looping.']},
   trouble:{rows:[
    ['“Not an Aseprite file” or “ends early”','The header does not start with Aseprite\'s magic number `0xA5E0` (another program\'s `.ase` file), or the download was cut off','Compare the file size with the source; open it in Aseprite if you can','Get the complete original file; `.ase` files made by other programs cannot be read here'],
    ['Layers show as one “Flattened” layer','The file uses cel z-index or group composition that cannot be rebuilt exactly from separate layers','The layer decision in the Import panel names the reason and the frame','The frames are still exact; to work on single layers, edit the layer structure in Aseprite and import again'],
    ['A layer you see in Aseprite is not in the frames','It is hidden (eye closed) or a reference layer; Aseprite\'s export leaves both out, and so does Nerulio','The layer list in the Import panel, or the eye icon in Aseprite','Make the layer visible in Aseprite and save; reference layers are never part of the frames'],
    ['A slice became the wrong kind of box, or there is no pivot','Box types are guessed from slice names (hit, hurt …); the pivot is the slice named pivot, origin or anchor, else the first slice that has a pivot point','Import panel: each slice decision with its confidence','Pick the right type (hit, hurt, interact, custom) or ignore it; frames without a pivot slice use the bottom centre'],
    ['Colours differ slightly from Aseprite\'s canvas','The file has an ICC colour profile; it is kept but not applied, as in Aseprite\'s PNG export','Aseprite\'s colour profile setting','Compare with a PNG exported from Aseprite rather than with the editor canvas']]},
   alternatives:{rows:[
    ['Aseprite itself','You want to change the file with every Aseprite feature (layers, groups, tilemaps, scripts). Opening here is read-only.'],
    ['Aseprite\'s command line (`aseprite -b`)','You have Aseprite and want output from scripts: `--sheet`, `--data`, `--list-tags`, `--list-slices`, and `--save-as` with `{tag}` for one GIF per tag.'],
    ['[[game/aseprite-alternative|A browser alternative to Aseprite]]','You want to draw and animate rather than only open a file.']]},
   limits:['Group layers are not kept as groups: each leaf layer becomes a row named with its group path, such as `arms/left`.','Reference layers are skipped, as in Aseprite\'s export.'],
   versions:{body:['The reader follows the Aseprite file format specification and was checked on 231 real `.aseprite` files: each was imported, written back with Nerulio\'s writer and opened in Aseprite 1.3.18.6 without a warning, with the same tags (231/231), durations (231/231) and pixels (231/231). The layer decisions come from the same corpus: 222 layered, 9 flattened. What this page says about the format follows the specification and the Aseprite documentation.'],sources:[ASE_SPEC,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  },
  ko:{
   answer:'`.aseprite`·`.ase` 파일은 이미지가 아니라 Aseprite 전용 바이너리 문서입니다. 프레임마다 밀리초 단위 길이, 블렌드 모드와 불투명도가 있는 레이어, 셀, 태그, 슬라이스, 팔레트가 들어 있어 브라우저나 일반 이미지 뷰어로는 열리지 않습니다. 여기에 끌어다 놓으면 Nerulio가 이 탭 안에서 파일을 해석해 Aseprite의 PNG 내보내기와 같은 방식으로 프레임을 합성하고(실제 파일 231개를 Aseprite 1.3.18.6과 비교해 확인), 태그를 재생하며, Aseprite JSON이 딸린 PNG 시트, 태그별 GIF·APNG, 새 `.aseprite`로 저장할 수 있습니다. 업로드는 없습니다.',
   concept:{title:'.aseprite 파일 안에 든 것',body:[
    '이 형식은 Aseprite 프로젝트가 직접 문서로 공개합니다. 128바이트 헤더에 매직 넘버 `0xA5E0`, 캔버스 크기, 색 깊이가 있습니다. 픽셀당 32비트면 RGBA, 16비트면 알파가 있는 그레이스케일, 8비트면 인덱스 컬러로, 모든 픽셀이 팔레트 번호이고 그중 하나를 투명색으로 씁니다. 그 뒤에 프레임이 이어집니다. 프레임마다 16바이트 헤더에 자기 길이(ms)가 있고, 이어서 레이어(첫 프레임), 셀, 팔레트, 태그, 슬라이스, 사용자 데이터, 타일맵 레이어용 타일셋 같은 청크가 옵니다.',
    'Aseprite 화면에 보이는 그림은 완성된 이미지로 저장돼 있지 않습니다. 보이는 레이어를 아래에서 위로 그려서 프레임을 만듭니다. 셀(한 레이어의 한 프레임 픽셀, 자기 x·y 위치)을 레이어 불투명도 × 셀 불투명도로, Normal부터 Divide까지 19가지 블렌드 모드 중 하나로 섞습니다. 셀은 다른 프레임의 픽셀을 그대로 가리키는 링크 셀일 수 있고, 그 프레임에서만 레이어 순서를 바꾸는 z-index를 가질 수도 있습니다. 첫 레이어만 보여 주거나 블렌드 모드를 무시하는 뷰어는 Aseprite가 절대 내보내지 않을 그림을 보여 줍니다.',
    'Nerulio는 자체 합성기로 레이어를 다시 그렸을 때 Aseprite 렌더와 픽셀이 완전히 같을 때만 레이어를 유지합니다. 아니면 합쳐진 프레임을 보여 주고 이유를 적습니다. 테스트용 실제 파일 231개 중 222개는 레이어가 유지됐고 9개는 합쳐졌습니다(그룹 합성이 달라지는 5개, 셀 z-index로 레이어 순서를 바꾸는 4개). 어느 쪽이든 프레임 픽셀은 같습니다.'],
    terms:[['셀(Cel)','한 레이어의 한 프레임 픽셀. 위치와 불투명도를 따로 가집니다. 링크 셀은 픽셀 대신 다른 프레임의 셀을 가리킵니다.'],
     ['태그','이름 붙은 프레임 구간(`from`–`to`). 방향(정방향·역방향·핑퐁·역핑퐁)과 반복 횟수가 있습니다. 반복 0은 “지정 안 함”으로, Aseprite 편집기에서는 무한, 내보낼 때는 한 번입니다.'],
     ['슬라이스','이름 붙은 사각형. 9-패치 중앙이나 피벗 점을 가질 수 있고, 키가 프레임별로 있어 한 키는 다음 키가 나올 때까지 유지됩니다.'],
     ['컬러 모드','RGBA, 그레이스케일, 인덱스. 인덱스 파일은 애니메이션 도중 팔레트가 바뀔 수 있고 번호 하나가 투명색입니다.']]},
   example:{title:'예시: 작은 캐릭터 파일 읽기',lead:'레이어 3개, 태그 3개인 32 × 32 RGBA 파일을 넣었을 때 가져오기 패널과 타임라인이 보여 주는 내용, 그리고 거기서 계산되는 타이밍입니다.',lines:[
    'hero.aseprite  32 × 32 px · RGBA · 16프레임 · 레이어 3 · 태그 3 · 슬라이스 2',
    'layers  outline  Normal    255',
    '        shadow   Multiply  128   (아래 레이어 위에 128/255 ≈ 50 %로 그림)',
    '        body     Normal    255',
    'tags    idle    0–3    4 × 125 ms                    정방향 ∞   한 사이클 500 ms',
    '        walk    4–9    6 × 100 ms                    정방향 ∞   한 사이클 600 ms',
    '        attack  10–15  100,100,100,100,150,250 ms    정방향 ×1  한 번 재생, 800 ms',
    'slices  pivot  점 (16, 31), 모든 프레임       → 프레임 피벗, 신뢰도 높음(이름)',
    '        hit    20 × 8, 12번 프레임부터         → 히트 박스, 신뢰도 중간(이름)'],
    after:'`idle`을 핑퐁으로 바꾸면 한 사이클이 0-1-2-3-2-1, 여섯 단계 750 ms가 됩니다. 슬라이스 두 개의 추정은 가져오기 패널의 결정 항목이라, 클릭해서 `hit`을 허트 박스로 바꾸거나 무시할 수 있습니다.'},
   outputs:{title:'뷰어에서 저장할 수 있는 것',rows:[
    ['hero.png + hero.json','패킹·내보내기 › Aseprite JSON(해시 또는 배열): `frames`, `meta.frameTags`, `meta.slices`가 있는 패킹 시트 한 장. Aseprite 자체 스프라이트 시트 내보내기와 같은 구조입니다. [[game/aseprite-to-sprite-sheet|Aseprite를 스프라이트 시트로]] 참고.'],
    ['hero_idle.gif …','패킹·내보내기 › Animated GIF: 태그마다 파일 하나, 지연은 1/100초 단위로 반올림. [[game/aseprite-to-gif|Aseprite를 GIF로]] 참고.'],
    ['hero_idle.png …','패킹·내보내기 › APNG: 태그마다 애니메이션 PNG 하나, 모든 픽셀과 밀리초가 그대로.'],
    ['hero.aseprite','스프라이트 › .aseprite 내보내기…: 레이어·태그·길이·슬라이스를 담은, Aseprite가 여는 새 파일. 넣은 원본은 바뀌지 않습니다.']]},
   verify:{steps:[
    '가져오기 패널의 레이어 결정: “layered”는 레이어 행이 모든 프레임에서 Aseprite 렌더를 그대로 재현한다는 뜻이고, “flattened”에는 이유와 처음 달라진 프레임이 적힙니다.',
    '`,`와 `.`로 태그를 한 프레임씩 넘기며 프레임 패널에서 길이를 읽으세요. 합이 한 사이클입니다(walk: 6 × 100 ms = 600 ms).',
    'Enter로 태그를 재생하세요. 반복 ×1이면 마지막 프레임에서 멈추고, ∞이면 계속 돕니다.']},
   trouble:{rows:[
    ['“Aseprite 파일이 아님” 또는 “일찍 끝남”','헤더가 Aseprite 매직 넘버 `0xA5E0`으로 시작하지 않거나(다른 프로그램의 `.ase` 파일), 내려받기가 중간에 끊겼습니다','원본과 파일 크기를 비교하고, 가능하면 Aseprite로 열어 봅니다','완전한 원본 파일을 받으세요. 다른 프로그램이 만든 `.ase`는 여기서 읽을 수 없습니다'],
    ['레이어가 “Flattened” 한 줄로 보임','셀 z-index나 그룹 합성처럼 레이어를 따로 두면 똑같이 재현되지 않는 기능을 씁니다','가져오기 패널의 레이어 결정에 이유와 프레임이 있습니다','프레임 픽셀은 정확합니다. 레이어별로 작업하려면 Aseprite에서 레이어 구조를 고친 뒤 다시 가져오세요'],
    ['Aseprite에서 보이던 레이어가 프레임에 없음','숨긴 레이어(눈 꺼짐)이거나 참조 레이어입니다. Aseprite 내보내기도 둘 다 빼고, Nerulio도 같습니다','가져오기 패널의 레이어 목록, 또는 Aseprite의 눈 아이콘','Aseprite에서 레이어를 보이게 하고 저장하세요. 참조 레이어는 프레임에 들어가지 않습니다'],
    ['슬라이스가 엉뚱한 박스가 되거나 피벗이 없음','박스 종류는 슬라이스 이름(hit, hurt …)으로 추정하고, 피벗은 이름이 pivot·origin·anchor인 슬라이스, 없으면 피벗 점이 있는 첫 슬라이스입니다','가져오기 패널: 슬라이스마다 결정과 신뢰도','맞는 종류(hit, hurt, interact, custom)를 고르거나 무시하세요. 피벗 슬라이스가 없는 프레임은 아래 가운데를 씁니다'],
    ['색이 Aseprite 캔버스와 조금 다름','파일에 ICC 색 프로필이 있습니다. 프로필은 보존하지만 적용하지 않으며, Aseprite의 PNG 내보내기도 같습니다','Aseprite의 색 프로필 설정','편집기 캔버스가 아니라 Aseprite에서 내보낸 PNG와 비교하세요']]},
   alternatives:{rows:[
    ['Aseprite 본체','레이어·그룹·타일맵·스크립트까지 모든 기능으로 파일을 고쳐야 할 때. 여기서 여는 것은 읽기 전용입니다.'],
    ['Aseprite 명령줄(`aseprite -b`)','Aseprite가 있고 스크립트로 결과물을 뽑고 싶을 때: `--sheet`, `--data`, `--list-tags`, `--list-slices`, 태그별 GIF는 `--save-as`에 `{tag}`.'],
    ['[[game/aseprite-alternative|브라우저용 Aseprite 대안]]','파일을 열기만 하는 게 아니라 그리고 애니메이션을 만들고 싶을 때.']]},
   limits:['그룹 레이어는 그룹으로 남지 않습니다. 가장 안쪽 레이어마다 `arms/left`처럼 그룹 경로를 이름으로 단 행이 됩니다.','참조 레이어는 Aseprite 내보내기처럼 건너뜁니다.'],
   versions:{body:['읽기 코드는 Aseprite 파일 형식 명세를 따르며 실제 `.aseprite` 파일 231개로 확인했습니다. 파일마다 가져온 뒤 Nerulio 기록기로 다시 써서 Aseprite 1.3.18.6에서 열었고, 경고 없이 태그(231/231), 길이(231/231), 픽셀(231/231)이 같았습니다. 레이어 결정도 같은 파일 묶음에서 나온 결과입니다(222개 유지, 9개 합침). 형식에 관한 설명은 명세와 Aseprite 공식 문서를 따릅니다.'],sources:[ASE_SPEC,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  },
  ja:{
   answer:'`.aseprite`・`.ase`ファイルは画像ではなく、Aseprite独自のバイナリ文書です。フレームごとのミリ秒単位の長さ、ブレンドモードと不透明度を持つレイヤー、セル、タグ、スライス、パレットが入っているため、ブラウザや一般的な画像ビューアでは開けません。ここにドロップすると、Nerulioがこのタブの中で解析し、AsepriteのPNG書き出しと同じ方法でフレームを合成し（実ファイル231個をAseprite 1.3.18.6と照合済み）、タグを再生します。Aseprite JSON付きのPNGシート、タグごとのGIF・APNG、新しい`.aseprite`として保存もできます。アップロードはありません。',
   concept:{title:'.asepriteファイルの中身',body:[
    'この形式はAsepriteプロジェクト自身が仕様を公開しています。128バイトのヘッダーにはマジックナンバー`0xA5E0`、キャンバスサイズ、色深度があります。1ピクセル32ビットならRGBA、16ビットならアルファ付きグレースケール、8ビットならインデックスカラーで、全ピクセルがパレット番号になり、そのうち1つを透明色に使えます。その後にフレームが続きます。各フレームは16バイトのヘッダーに自分の長さ（ms）を持ち、レイヤー（最初のフレーム）、セル、パレット、タグ、スライス、ユーザーデータ、タイルマップレイヤー用のタイルセットといったチャンクが続きます。',
    'Asepriteの画面で見える絵は、完成画像としてはどこにも保存されていません。表示中のレイヤーを下から上へ描いてフレームを作ります。セル（1レイヤーの1フレーム分のピクセル、固有のx・y位置）を、レイヤー不透明度×セル不透明度で、NormalからDivideまで19種類のブレンドモードのどれかで重ねます。セルは別フレームのピクセルを参照するリンクセルのこともあり、そのフレームだけレイヤー順を入れ替えるz-indexを持つこともあります。最初のレイヤーしか見せない、あるいはブレンドモードを無視するビューアは、Asepriteが決して書き出さない絵を表示します。',
    'Nerulioは、自前の合成処理でレイヤーを描き直した結果がAsepriteのレンダリングとピクセル単位で一致する場合だけレイヤーを保持します。一致しなければ統合したフレームを表示し、理由を記録します。テスト用の実ファイル231個では222個がレイヤー保持、9個が統合でした（グループ合成が再現できない5個、セルz-indexでレイヤー順を変える4個）。どちらでもフレームのピクセルは同じです。'],
    terms:[['セル（Cel）','1レイヤーの1フレーム分のピクセル。位置と不透明度を個別に持ちます。リンクセルはピクセルの代わりに別フレームのセルを参照します。'],
     ['タグ','名前付きのフレーム範囲（`from`–`to`）。方向（順方向・逆方向・ピンポン・逆ピンポン）と繰り返し回数を持ちます。繰り返し0は「指定なし」で、Asepriteのエディタでは無限、書き出し時は1回です。'],
     ['スライス','名前付きの矩形。9パッチの中央やピボット点を持てます。キーはフレーム単位で、あるキーは次のキーまで有効です。'],
     ['カラーモード','RGBA、グレースケール、インデックス。インデックスのファイルはアニメーションの途中でパレットが変わることがあり、番号の1つが透明色です。']]},
   example:{title:'具体例：小さなキャラクターファイルを読む',lead:'レイヤー3枚・タグ3つの32 × 32 RGBAファイルを読み込んだときに、インポートパネルとタイムラインに出る内容と、そこから計算できるタイミングです。',lines:[
    'hero.aseprite  32 × 32 px · RGBA · 16フレーム · レイヤー3 · タグ3 · スライス2',
    'layers  outline  Normal    255',
    '        shadow   Multiply  128   (下のレイヤーの上に 128/255 ≈ 50 % で描画)',
    '        body     Normal    255',
    'tags    idle    0–3    4 × 125 ms                    順方向 ∞   1サイクル 500 ms',
    '        walk    4–9    6 × 100 ms                    順方向 ∞   1サイクル 600 ms',
    '        attack  10–15  100,100,100,100,150,250 ms    順方向 ×1  1回再生、800 ms',
    'slices  pivot  点 (16, 31)、全フレーム        → フレームのピボット、信頼度 高（名前）',
    '        hit    20 × 8、フレーム12から          → ヒットボックス、信頼度 中（名前）'],
    after:'`idle`をピンポンにすると1サイクルは0-1-2-3-2-1の6ステップ、750 msになります。2つのスライスの推定はインポートパネルの判断項目なので、クリックして`hit`をハートボックスに変えたり無視したりできます。'},
   outputs:{title:'ビューアから保存できるもの',rows:[
    ['hero.png + hero.json','パック＆書き出し › Aseprite JSON（ハッシュまたは配列）：`frames`、`meta.frameTags`、`meta.slices`を持つパック済みシート1枚。Aseprite自身のスプライトシート書き出しと同じ構造です。[[game/aseprite-to-sprite-sheet|Asepriteからスプライトシートへ]]を参照。'],
    ['hero_idle.gif …','パック＆書き出し › Animated GIF：タグごとに1ファイル、ディレイは1/100秒単位に丸め。[[game/aseprite-to-gif|AsepriteからGIFへ]]を参照。'],
    ['hero_idle.png …','パック＆書き出し › APNG：タグごとにアニメーションPNG 1つ、全ピクセルとミリ秒がそのまま。'],
    ['hero.aseprite','スプライト › .aseprite書き出し…：レイヤー・タグ・長さ・スライスを持つ、Asepriteで開ける新しいファイル。ドロップした元ファイルは変わりません。']]},
   verify:{steps:[
    'インポートパネルのレイヤー判断：「layered」はレイヤー行が全フレームでAsepriteのレンダリングを再現するという意味、「flattened」には理由と最初に食い違ったフレームが書かれます。',
    '`,`と`.`でタグを1フレームずつ送り、フレームパネルで長さを読みます。合計が1サイクルです（walk：6 × 100 ms = 600 ms）。',
    'Enterでタグを再生します。繰り返し×1なら最後のフレームで止まり、∞ならループし続けます。']},
   trouble:{rows:[
    ['「Asepriteファイルではない」「途中で終わっている」','ヘッダーがAsepriteのマジックナンバー`0xA5E0`で始まっていない（別のプログラムの`.ase`）、またはダウンロードが途中で切れています','元ファイルとサイズを比べ、可能ならAsepriteで開いてみます','完全な元ファイルを入手してください。別のプログラムが作った`.ase`はここでは読めません'],
    ['レイヤーが「Flattened」1枚になる','セルz-indexやグループ合成など、レイヤーを分けたままでは同じ結果にならない機能を使っています','インポートパネルのレイヤー判断に理由とフレームがあります','フレームのピクセルは正確です。レイヤー単位で作業するならAsepriteでレイヤー構成を直して読み込み直してください'],
    ['Asepriteで見えていたレイヤーがフレームにない','非表示（目のアイコンがオフ）か参照レイヤーです。Asepriteの書き出しも両方を除外し、Nerulioも同じです','インポートパネルのレイヤー一覧、またはAsepriteの目のアイコン','Asepriteでレイヤーを表示にして保存してください。参照レイヤーはフレームに含まれません'],
    ['スライスが違う種類のボックスになる、ピボットがない','ボックスの種類はスライス名（hit、hurt …）から推定し、ピボットは名前がpivot・origin・anchorのスライス、なければピボット点を持つ最初のスライスです','インポートパネル：スライスごとの判断と信頼度','正しい種類（hit、hurt、interact、custom）を選ぶか無視します。ピボットスライスのないフレームは下中央を使います'],
    ['色がAsepriteのキャンバスと少し違う','ファイルにICCカラープロファイルがあります。保持はしますが適用はせず、AsepriteのPNG書き出しと同じ扱いです','Asepriteのカラープロファイル設定','エディタのキャンバスではなく、Asepriteから書き出したPNGと比べてください']]},
   alternatives:{rows:[
    ['Aseprite本体','レイヤー・グループ・タイルマップ・スクリプトまで、すべての機能でファイルを編集したいとき。ここで開くのは読み取り専用です。'],
    ['Asepriteのコマンドライン（`aseprite -b`）','Asepriteがあり、スクリプトで出力したいとき：`--sheet`、`--data`、`--list-tags`、`--list-slices`、タグごとのGIFは`--save-as`に`{tag}`。'],
    ['[[game/aseprite-alternative|ブラウザで使えるAseprite代替]]','ファイルを開くだけでなく、描いてアニメーションを作りたいとき。']]},
   limits:['グループレイヤーはグループとして残りません。末端のレイヤーごとに`arms/left`のようなグループパスを名前にした行になります。','参照レイヤーはAsepriteの書き出しと同じく除外します。'],
   versions:{body:['読み込み処理はAsepriteファイル形式の仕様に従い、実際の`.aseprite`ファイル231個で確認しました。各ファイルを読み込み、Nerulioの書き出し処理で書き直してAseprite 1.3.18.6で開いたところ、警告なしでタグ（231/231）、長さ（231/231）、ピクセル（231/231）が一致しました。レイヤーの判断も同じファイル群の結果です（保持222、統合9）。形式の説明は仕様書とAseprite公式ドキュメントに基づきます。'],sources:[ASE_SPEC,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  }
 },
/* ============================================================================ aseprite-to-gif */
 'game/aseprite-to-gif':{
  type:'conversion',
  intent:{primary:'convert an .aseprite animation into animated GIFs',secondary:['one GIF per tag','keep frame timing in a GIF','GIF transparency and colours from Aseprite','why a GIF plays slower than Aseprite'],
   goal:'one GIF per tag that plays at the drawn speed with clean on/off transparency',input:'.aseprite / .ase with tags (optional)',output:'ZIP with one .gif per tag',target:'browsers, chats and forums that play GIF',support:'full',
   evidence:['src/game/export/anim.js (encodeGIF: cs = max(2, round(ms/10)), alpha ≥ 128, ≤ 255 colours exact, disposal 2)','src/game/export/bundle.js (animationFrames, loop count from repeat)','docs/STUDIO-PACK.md (GIF decoded by Pillow, every frame and delay)'],
   external:['W3C GIF89a: delay in 1/100 s, disposal methods, transparency index, colour table ≤ 256','WebKit: frames ≤ 10 ms play as 100 ms','Aseprite docs: Export As, CLI --save-as {tag}']},
  en:{
   answer:"Drop the `.aseprite` file, open Pack & Export and choose Animated GIF: you get one GIF per tag (`hero_walk.gif`) with the frames in playback order on one pivot-aligned cell. GIF stores delays in hundredths of a second, so each frame's milliseconds are rounded (125 ms → 130 ms, 16 ms → 20 ms, never below 20 ms); alpha becomes on/off at 128, and up to 255 colours stay exact. It all runs in the browser, without Aseprite installed.",
   concept:{title:'What a GIF can store, and what an Aseprite frame has',body:[
    "A GIF (GIF89a) is a series of images on one logical screen. Before each image a Graphic Control Extension sets the delay in hundredths of a second, the disposal method (what happens to the image before the next one: 0 not specified, 1 leave it, 2 restore to background, 3 restore to previous) and an optional transparent colour index. Colours come from tables of at most 256 entries. The loop count is not in the GIF89a specification; players read it from the NETSCAPE2.0 application extension.",
    "An Aseprite frame has millisecond timing, 256 levels of alpha per pixel and, in RGBA mode, any number of colours. Converting therefore means three decisions: round the timing to 1/100 s, cut alpha to on/off, and fit the colours into one table. Nerulio writes every frame as a full image with disposal 2, so transparent areas never pile up from one frame to the next.",
    "Very short delays are a trap. WebKit's image decoder plays any frame of 10 ms or less for 100 ms, and its source says this follows Firefox; a delay of 1/100 s can therefore play ten times slower than intended. Nerulio never writes less than 2/100 s (20 ms) and lists how many delays it rounded."],
    terms:[['Delay time','Hundredths of a second per frame, stored in the Graphic Control Extension: 13 means 130 ms.'],
     ['Disposal method','What the decoder does with a frame before drawing the next. Nerulio writes 2, restore to background, on every full-size frame.'],
     ['Transparent index','One palette entry that is not drawn. Nerulio uses index 0 for every pixel with alpha below 128.'],
     ['Loop count','The NETSCAPE2.0 value; 0 loops forever. Nerulio writes repeat − 1 for a finite repeat and no loop block for a tag that plays once.']]},
   example:{title:'Example: what common frame times become',lines:[
    'Aseprite frame    GIF delay                  plays as   change',
    '125 ms  ( 8 fps)  12.5 → 13 /100 s           130 ms     +5 ms',
    '100 ms  (10 fps)  10 /100 s                  100 ms     exact',
    ' 83 ms  (12 fps)  8.3 → 8 /100 s              80 ms     −3 ms',
    ' 50 ms  (20 fps)  5 /100 s                    50 ms     exact',
    ' 33 ms  (30 fps)  3.3 → 3 /100 s              30 ms     −3 ms',
    ' 16 ms  (60 fps)  1.6 → 2 /100 s              20 ms     +4 ms',
    ' 10 ms            1 → raised to 2 /100 s      20 ms     (1 would play as 100 ms in WebKit)',
    '',
    'walk    6 × 83 ms = 498 ms in Aseprite  →  6 × 80 ms = 480 ms in the GIF',
    'effect 12 × 16 ms = 192 ms at 60 fps    → 12 × 20 ms = 240 ms (25 % slower)'],
    after:'Frame times that are whole hundredths (10, 20, 30 … ms, so 10, 20, 25 or 50 fps) survive exactly. When the timing must stay to the millisecond, export APNG from the same panel: it stores each delay as a fraction of a second.'},
   mapping:{head:['In Aseprite','In Nerulio','In the GIF'],rows:[
    ['Tag','One animation; a file without tags becomes one animation with every frame','One file per tag, e.g. `hero_walk.gif`'],
    ['Frame duration (ms)','Kept per frame, rounded on export','Delay in 1/100 s, at least 2'],
    ['Direction reverse / ping-pong','Playback order written out (ping-pong 0-1-2-3-2-1)','Frames stored in that order'],
    ['Repeat ∞ / n / 1','Loop forever / n plays / once','Loop count 0 / n − 1 / no loop block'],
    ['Pixel alpha 0–255','Threshold at 128','Opaque colour, or the transparent index'],
    ['Colours (RGBA)','≤ 255: exact; more: median cut over all frames, nearest colour, no dithering','One global colour table'],
    ['Layers, blend modes, opacity','Composited as Aseprite\'s export draws them','Flat frames'],
    ['Pivot','All frames of the tag on one cell, pivots on the same point','Full-size frames, disposal 2'],
    ['Slices, hit boxes, user data','Kept in the Studio','Not stored: GIF has no field for them']]},
   outputs:{rows:[
    ['hero_gif.zip','The download, with a folder `hero_gif/` (the name follows the export name in Pack & Export).'],
    ['hero_gif/hero_walk.gif','The `walk` tag: its frames, delays and loop count. The frame size is the smallest cell that holds every frame of the tag aligned on its pivot.']]},
   target:{title:'Use the GIF',steps:[
    'Unzip the download. Each tag is its own GIF named after the tag, so rename a tag on the Timeline before export if you want another file name.',
    'Open the GIF in a browser tab to check the speed: the browser plays the stored delays, so a 6 × 80 ms walk loops every 0.48 s.',
    'Look at it on the background where it will appear. GIF transparency is on/off: an edge pixel that was 40 % opaque in Aseprite is now fully transparent, one at 60 % fully opaque.',
    'Where soft edges or exact timing matter, export APNG from the same tags; for a video post, export [[game/sprite-sheet-to-video|WebM video]] (4× nearest) instead.']},
   verify:{steps:[
    'Count the frames of a ping-pong tag: 4 frames give 6 GIF frames (0-1-2-3-2-1).',
    'Read the export notes: “n frame delay(s) rounded to GIF\'s 1/100 s (minimum 20 ms)” tells you which tags changed speed.',
    'A tag with repeat ×1 stops on its last frame; a tag with ∞ keeps looping.']},
   trouble:{rows:[
    ['Edges look jagged or have a hard halo','GIF has 1-bit transparency: alpha ≥ 128 became opaque, the rest transparent','The export note says semi-transparent pixels were changed','Export APNG for soft edges, or draw the edge with fully opaque pixels in Aseprite'],
    ['The animation is slower or faster than in Aseprite','Delays are rounded to 1/100 s and very short frames are raised to 20 ms','Compare the frame times with the table above; the note counts rounded delays','Use frame times in whole hundredths (10, 20, 25, 50 fps), or export APNG'],
    ['Colour banding or wrong shades','More than 255 colours in the tag, so the palette was reduced by median cut without dithering','The note “More than 255 colours” appears','Reduce the colours in Aseprite (indexed mode) or export APNG'],
    ['The GIF plays once and stops','The tag\'s repeat is a number (×1 = once) rather than ∞','Animation panel: Repeat of that tag','Set the repeat to ∞ and export again'],
    ['Only one GIF for the whole file','The file has no tags, so every frame is one animation','Look for tag lanes above the Timeline','Drag tags on the Timeline (or add them in Aseprite) and export again']]},
   alternatives:{rows:[
    ['Aseprite\'s own export: File > Export > Export As, or `aseprite -b hero.aseprite --save-as hero-{tag}.gif`','You have Aseprite and want its options, such as resizing the output; the `{tag}` form writes one GIF per tag from the command line.'],
    ['APNG from the same export panel','Exact colours, soft alpha and millisecond timing matter more than GIF\'s reach. APNG is supported by Chrome, Edge, Firefox, Opera and Safari.'],
    ['[[game/sprite-sheet-to-video|WebM video]]','The animation goes into a video post or trailer: enlarged 4× with nearest-neighbour on a solid background.']]},
   limits:['GIF transparency is on/off; Nerulio does not dither or blend edges against a background colour.','The GIF keeps the sprite\'s pixel size: the Studio has no scale option for GIF export.'],
   versions:{body:['The GIF export was checked by decoding the files with Pillow: every frame and every delay came back as written. The rounding, the 20 ms floor and the alpha threshold are Nerulio\'s own rules. The GIF structure described here follows the W3C GIF89a specification; the short-delay behaviour comes from WebKit\'s source; the Aseprite commands from the Aseprite documentation.'],sources:[GIF_SPEC,WEBKIT_DELAY,MDN_IMAGES,ASE_EXPORT,ASE_CLI]}
  },
  ko:{
   answer:'`.aseprite` 파일을 넣고 패킹·내보내기에서 Animated GIF를 고르면 태그마다 GIF가 하나씩(`hero_walk.gif`) 나오고, 프레임은 재생 순서대로 피벗을 맞춘 한 칸에 들어갑니다. GIF는 지연을 1/100초 단위로 저장하므로 프레임의 밀리초가 반올림되고(125 ms → 130 ms, 16 ms → 20 ms, 20 ms 미만은 없음), 알파는 128을 기준으로 켜짐/꺼짐이 되며, 255색까지는 색이 정확히 유지됩니다. 모두 브라우저에서 처리되고 Aseprite 설치는 필요 없습니다.',
   concept:{title:'GIF가 담을 수 있는 것과 Aseprite 프레임에 있는 것',body:[
    'GIF(GIF89a)는 논리 화면 하나에 그리는 이미지의 연속입니다. 이미지마다 앞에 붙는 그래픽 제어 확장(Graphic Control Extension)이 1/100초 단위 지연, 폐기 방식(다음 이미지 전에 이 이미지를 어떻게 할지: 0 지정 안 함, 1 그대로 둠, 2 배경으로 복원, 3 이전 상태로 복원), 선택적인 투명 색 번호를 정합니다. 색은 최대 256개짜리 표에서 가져옵니다. 반복 횟수는 GIF89a 명세에 없고, 재생기는 NETSCAPE2.0 애플리케이션 확장에서 읽습니다.',
    'Aseprite 프레임은 밀리초 타이밍, 픽셀당 256단계 알파, RGBA 모드라면 색 수 제한이 없습니다. 그래서 변환에는 세 가지 결정이 필요합니다. 타이밍을 1/100초로 반올림하고, 알파를 켜짐/꺼짐으로 자르고, 색을 표 하나에 맞춥니다. Nerulio는 모든 프레임을 폐기 방식 2의 전체 크기 이미지로 써서 투명한 부분이 프레임마다 겹쳐 쌓이지 않습니다.',
    '아주 짧은 지연은 함정입니다. WebKit의 이미지 디코더는 10 ms 이하 프레임을 100 ms로 재생하며, 소스 주석에는 Firefox의 동작을 따른 것이라고 적혀 있습니다. 1/100초 지연은 의도보다 열 배 느리게 재생될 수 있다는 뜻입니다. Nerulio는 2/100초(20 ms) 미만을 쓰지 않고, 반올림한 지연이 몇 개인지 알려 줍니다.'],
    terms:[['지연 시간','프레임당 1/100초 단위 값으로, 그래픽 제어 확장에 저장됩니다. 13은 130 ms입니다.'],
     ['폐기 방식','다음 프레임을 그리기 전에 디코더가 현재 프레임을 처리하는 방법. Nerulio는 전체 크기 프레임마다 2(배경으로 복원)를 씁니다.'],
     ['투명 색 번호','그리지 않는 팔레트 항목 하나. Nerulio는 알파가 128 미만인 픽셀을 모두 0번으로 보냅니다.'],
     ['반복 횟수','NETSCAPE2.0 값. 0이면 무한 반복입니다. Nerulio는 유한 반복이면 반복 − 1을 쓰고, 한 번 재생하는 태그에는 반복 블록을 넣지 않습니다.']]},
   example:{title:'예시: 흔한 프레임 시간이 GIF에서 어떻게 되나',lines:[
    'Aseprite 프레임   GIF 지연                   재생 시간  차이',
    '125 ms  ( 8 fps)  12.5 → 13 /100 s           130 ms     +5 ms',
    '100 ms  (10 fps)  10 /100 s                  100 ms     정확',
    ' 83 ms  (12 fps)  8.3 → 8 /100 s              80 ms     −3 ms',
    ' 50 ms  (20 fps)  5 /100 s                    50 ms     정확',
    ' 33 ms  (30 fps)  3.3 → 3 /100 s              30 ms     −3 ms',
    ' 16 ms  (60 fps)  1.6 → 2 /100 s              20 ms     +4 ms',
    ' 10 ms            1 → 2 /100 s로 올림         20 ms     (1이면 WebKit에서 100 ms로 재생)',
    '',
    'walk    Aseprite 6 × 83 ms = 498 ms  →  GIF 6 × 80 ms = 480 ms',
    '이펙트 60 fps 12 × 16 ms = 192 ms   →  12 × 20 ms = 240 ms (25 % 느려짐)'],
    after:'프레임 시간이 1/100초의 정수배(10, 20, 30 … ms, 즉 10·20·25·50 fps)면 그대로 유지됩니다. 밀리초까지 정확해야 한다면 같은 패널에서 APNG로 내보내세요. APNG는 지연을 초의 분수로 저장합니다.'},
   mapping:{head:['Aseprite에서','Nerulio에서','GIF에서'],rows:[
    ['태그','애니메이션 하나. 태그가 없는 파일은 모든 프레임이 애니메이션 하나','태그마다 파일 하나, 예: `hero_walk.gif`'],
    ['프레임 길이(ms)','프레임별로 유지, 내보낼 때 반올림','1/100초 단위 지연, 최소 2'],
    ['방향 역방향·핑퐁','재생 순서를 펼쳐서 기록(핑퐁 0-1-2-3-2-1)','그 순서대로 프레임 저장'],
    ['반복 ∞ / n / 1','무한 / n번 / 한 번','반복 횟수 0 / n − 1 / 반복 블록 없음'],
    ['픽셀 알파 0–255','128 기준으로 자름','불투명 색 또는 투명 색 번호'],
    ['색(RGBA)','255색 이하: 정확, 초과: 전체 프레임 기준 메디안 컷, 가장 가까운 색, 디더링 없음','전역 색 표 하나'],
    ['레이어·블렌드 모드·불투명도','Aseprite 내보내기와 같게 합성','평평한 프레임'],
    ['피벗','태그의 모든 프레임을 한 칸에, 피벗을 같은 점에','전체 크기 프레임, 폐기 방식 2'],
    ['슬라이스·히트박스·사용자 데이터','Studio 안에서는 유지','저장 안 됨: GIF에 해당 필드가 없음']]},
   outputs:{rows:[
    ['hero_gif.zip','내려받는 파일. 안에 `hero_gif/` 폴더가 있습니다(이름은 패킹·내보내기의 내보내기 이름을 따름).'],
    ['hero_gif/hero_walk.gif','`walk` 태그: 프레임, 지연, 반복 횟수. 크기는 태그의 모든 프레임을 피벗에 맞춰 담는 가장 작은 칸입니다.']]},
   target:{title:'GIF 쓰기',steps:[
    '내려받은 ZIP을 풉니다. 태그마다 태그 이름을 단 GIF가 하나씩 있으니, 다른 파일 이름을 원하면 내보내기 전에 타임라인에서 태그 이름을 바꾸세요.',
    'GIF를 브라우저 탭에서 열어 속도를 확인하세요. 브라우저는 저장된 지연대로 재생하므로 6 × 80 ms짜리 walk는 0.48초마다 반복됩니다.',
    '실제로 올라갈 배경 위에서 보세요. GIF 투명은 켜짐/꺼짐뿐이라 Aseprite에서 40 % 불투명했던 가장자리 픽셀은 완전히 투명해지고, 60 %였던 픽셀은 완전히 불투명해집니다.',
    '부드러운 가장자리나 정확한 타이밍이 중요하면 같은 태그를 APNG로, 동영상 게시물에는 [[game/sprite-sheet-to-video|WebM 동영상]](최근접 4배)으로 내보내세요.']},
   verify:{steps:[
    '핑퐁 태그의 프레임 수를 세어 보세요. 4프레임이면 GIF 프레임은 6개(0-1-2-3-2-1)입니다.',
    '내보내기 안내를 읽으세요. “n frame delay(s) rounded to GIF\'s 1/100 s (minimum 20 ms)”가 속도가 바뀐 태그를 알려 줍니다.',
    '반복 ×1 태그는 마지막 프레임에서 멈추고, ∞ 태그는 계속 반복합니다.']},
   trouble:{rows:[
    ['가장자리가 계단처럼 보이거나 딱딱한 테두리가 생김','GIF 투명은 1비트라 알파 128 이상은 불투명, 나머지는 투명이 됐습니다','내보내기 안내에 반투명 픽셀을 바꿨다는 문구가 있습니다','부드러운 가장자리는 APNG로 내보내거나, Aseprite에서 가장자리를 완전 불투명 픽셀로 그리세요'],
    ['Aseprite보다 느리거나 빠름','지연을 1/100초로 반올림하고, 아주 짧은 프레임은 20 ms로 올렸습니다','위 표와 프레임 시간을 비교하고, 안내의 반올림 개수를 봅니다','1/100초 정수배 프레임 시간(10·20·25·50 fps)을 쓰거나 APNG로 내보내세요'],
    ['색 띠가 생기거나 색조가 틀림','태그에 색이 255개를 넘어 디더링 없는 메디안 컷으로 팔레트를 줄였습니다','“More than 255 colours” 안내가 나옵니다','Aseprite에서 색 수를 줄이거나(인덱스 모드) APNG로 내보내세요'],
    ['GIF가 한 번 재생하고 멈춤','태그 반복이 ∞가 아니라 숫자(×1 = 한 번)입니다','애니메이션 패널: 그 태그의 반복','반복을 ∞로 바꾸고 다시 내보내세요'],
    ['파일 전체가 GIF 하나로 나옴','파일에 태그가 없어 모든 프레임이 애니메이션 하나입니다','타임라인 위에 태그 줄이 있는지 봅니다','타임라인에서 태그를 드래그해 만들거나 Aseprite에서 추가한 뒤 다시 내보내세요']]},
   alternatives:{rows:[
    ['Aseprite 자체 내보내기: File > Export > Export As, 또는 `aseprite -b hero.aseprite --save-as hero-{tag}.gif`','Aseprite가 있고 출력 크기 조절 같은 옵션이 필요할 때. `{tag}`를 쓰면 명령줄에서 태그마다 GIF를 씁니다.'],
    ['같은 내보내기 패널의 APNG','GIF의 범용성보다 정확한 색, 부드러운 알파, 밀리초 타이밍이 중요할 때. APNG는 Chrome, Edge, Firefox, Opera, Safari가 지원합니다.'],
    ['[[game/sprite-sheet-to-video|WebM 동영상]]','애니메이션을 영상 게시물이나 트레일러에 넣을 때. 최근접 이웃으로 4배 키우고 단색 배경을 깝니다.']]},
   limits:['GIF 투명은 켜짐/꺼짐뿐입니다. Nerulio는 가장자리를 디더링하거나 배경색과 섞지 않습니다.','GIF는 스프라이트의 픽셀 크기 그대로입니다. Studio에는 GIF 내보내기용 확대 옵션이 없습니다.'],
   versions:{body:['GIF 내보내기는 결과 파일을 Pillow로 디코딩해 확인했습니다. 모든 프레임과 지연이 쓴 그대로 나왔습니다. 반올림, 20 ms 하한, 알파 기준은 Nerulio 자체 규칙입니다. GIF 구조 설명은 W3C GIF89a 명세, 짧은 지연 동작은 WebKit 소스, Aseprite 명령은 Aseprite 공식 문서를 따릅니다.'],sources:[GIF_SPEC,WEBKIT_DELAY,MDN_IMAGES,ASE_EXPORT,ASE_CLI]}
  },
  ja:{
   answer:'`.aseprite`ファイルをドロップしてパック＆書き出しでAnimated GIFを選ぶと、タグごとにGIFが1つ（`hero_walk.gif`）でき、フレームは再生順にピボットを揃えた1つのセルに入ります。GIFはディレイを1/100秒単位で持つため、フレームのミリ秒は丸められ（125 ms → 130 ms、16 ms → 20 ms、20 ms未満にはしない）、アルファは128を境にオン／オフになり、255色までは色がそのまま保たれます。すべてブラウザ内で処理され、Asepriteのインストールは不要です。',
   concept:{title:'GIFが持てるものと、Asepriteのフレームが持つもの',body:[
    'GIF（GIF89a）は1つの論理画面に描かれる画像の連続です。各画像の前に置くグラフィック制御拡張（Graphic Control Extension）が、1/100秒単位のディレイ、廃棄方法（次の画像の前にこの画像をどうするか：0 指定なし、1 そのまま残す、2 背景に戻す、3 直前の状態に戻す）、任意の透明色インデックスを決めます。色は最大256色の表から取ります。ループ回数はGIF89aの仕様にはなく、再生側はNETSCAPE2.0アプリケーション拡張から読みます。',
    'Asepriteのフレームはミリ秒単位のタイミング、ピクセルごとに256段階のアルファを持ち、RGBAモードなら色数に制限がありません。そのため変換には3つの判断が必要です。タイミングを1/100秒に丸める、アルファをオン／オフに切る、色を1つの表に収める。Nerulioは全フレームを廃棄方法2のフルサイズ画像として書くので、透明部分がフレームごとに積み重なることはありません。',
    'ごく短いディレイには落とし穴があります。WebKitの画像デコーダは10 ms以下のフレームを100 msで再生し、ソースのコメントにはFirefoxの挙動に合わせたと書かれています。1/100秒のディレイは意図の10倍遅く再生されうるということです。Nerulioは2/100秒（20 ms）未満を書かず、丸めたディレイの数を知らせます。'],
    terms:[['ディレイ','フレームごとの1/100秒単位の値で、グラフィック制御拡張に入ります。13なら130 msです。'],
     ['廃棄方法','次のフレームを描く前にデコーダが現在のフレームをどう扱うか。Nerulioはフルサイズの全フレームに2（背景に戻す）を書きます。'],
     ['透明色インデックス','描画しないパレット項目1つ。Nerulioはアルファ128未満のピクセルをすべて0番に割り当てます。'],
     ['ループ回数','NETSCAPE2.0の値で、0なら無限ループ。Nerulioは有限の繰り返しなら繰り返し−1を書き、1回再生のタグにはループブロックを入れません。']]},
   example:{title:'具体例：よくあるフレーム時間がGIFでどうなるか',lines:[
    'Asepriteのフレーム  GIFのディレイ              再生時間   差',
    '125 ms  ( 8 fps)    12.5 → 13 /100 s           130 ms     +5 ms',
    '100 ms  (10 fps)    10 /100 s                  100 ms     一致',
    ' 83 ms  (12 fps)    8.3 → 8 /100 s              80 ms     −3 ms',
    ' 50 ms  (20 fps)    5 /100 s                    50 ms     一致',
    ' 33 ms  (30 fps)    3.3 → 3 /100 s              30 ms     −3 ms',
    ' 16 ms  (60 fps)    1.6 → 2 /100 s              20 ms     +4 ms',
    ' 10 ms              1 → 2 /100 s に引き上げ     20 ms     (1だとWebKitでは100 ms)',
    '',
    'walk     Aseprite 6 × 83 ms = 498 ms  →  GIF 6 × 80 ms = 480 ms',
    'エフェクト 60 fps 12 × 16 ms = 192 ms  →  12 × 20 ms = 240 ms (25 % 遅い)'],
    after:'フレーム時間が1/100秒の整数倍（10、20、30 … ms、つまり10・20・25・50 fps）ならそのまま保たれます。ミリ秒単位で正確である必要があるなら、同じパネルからAPNGで書き出してください。APNGはディレイを秒の分数で持ちます。'},
   mapping:{head:['Asepriteでは','Nerulioでは','GIFでは'],rows:[
    ['タグ','アニメーション1つ。タグのないファイルは全フレームで1アニメーション','タグごとに1ファイル、例：`hero_walk.gif`'],
    ['フレームの長さ（ms）','フレームごとに保持し、書き出し時に丸め','1/100秒単位のディレイ、最小2'],
    ['方向 逆方向・ピンポン','再生順を展開して記録（ピンポン 0-1-2-3-2-1）','その順にフレームを格納'],
    ['繰り返し ∞ / n / 1','無限 / n回 / 1回','ループ回数 0 / n − 1 / ループブロックなし'],
    ['ピクセルのアルファ 0–255','128で二値化','不透明の色、または透明色インデックス'],
    ['色（RGBA）','255色以下：そのまま、超過：全フレームでメディアンカット、最近傍色、ディザなし','グローバルカラーテーブル1つ'],
    ['レイヤー・ブレンドモード・不透明度','Asepriteの書き出しと同じく合成','平らなフレーム'],
    ['ピボット','タグの全フレームを1つのセルに、ピボットを同じ点に','フルサイズのフレーム、廃棄方法2'],
    ['スライス・当たり判定・ユーザーデータ','Studio内では保持','保存されない：GIFに該当するフィールドがない']]},
   outputs:{rows:[
    ['hero_gif.zip','ダウンロードされるファイル。中に`hero_gif/`フォルダがあります（名前はパック＆書き出しの書き出し名に従います）。'],
    ['hero_gif/hero_walk.gif','`walk`タグ：フレーム、ディレイ、ループ回数。サイズはタグの全フレームをピボットで揃えて収める最小のセルです。']]},
   target:{title:'GIFを使う',steps:[
    'ダウンロードしたZIPを展開します。タグごとにタグ名のGIFがあるので、別のファイル名にしたいなら書き出し前にタイムラインでタグ名を変えてください。',
    'GIFをブラウザのタブで開いて速度を確かめます。ブラウザは保存されたディレイどおりに再生するので、6 × 80 msのwalkは0.48秒ごとにループします。',
    '実際に載せる背景の上で見てください。GIFの透明はオン／オフだけなので、Asepriteで40 %不透明だった縁のピクセルは完全に透明に、60 %だったものは完全に不透明になります。',
    '柔らかい縁や正確なタイミングが大事なら同じタグをAPNGで、動画投稿には[[game/sprite-sheet-to-video|WebM動画]]（ニアレスト4倍）で書き出してください。']},
   verify:{steps:[
    'ピンポンのタグのフレーム数を数えます。4フレームならGIFは6フレーム（0-1-2-3-2-1）です。',
    '書き出し後のメモを読みます。「n frame delay(s) rounded to GIF\'s 1/100 s (minimum 20 ms)」が速度の変わったタグを示します。',
    '繰り返し×1のタグは最後のフレームで止まり、∞のタグはループし続けます。']},
   trouble:{rows:[
    ['縁がギザギザになる、硬い縁取りが出る','GIFの透明は1ビットなので、アルファ128以上は不透明、それ未満は透明になりました','書き出しメモに半透明ピクセルを変更した旨が出ます','柔らかい縁はAPNGで書き出すか、Asepriteで縁を完全不透明のピクセルで描いてください'],
    ['Asepriteより遅い・速い','ディレイを1/100秒に丸め、ごく短いフレームは20 msに引き上げました','上の表とフレーム時間を比べ、メモの丸め数を見ます','1/100秒の整数倍のフレーム時間（10・20・25・50 fps）にするか、APNGで書き出してください'],
    ['色の帯が出る、色味が違う','タグの色が255色を超え、ディザなしのメディアンカットでパレットを減らしました','「More than 255 colours」のメモが出ます','Asepriteで色数を減らす（インデックスモード）か、APNGで書き出してください'],
    ['GIFが1回再生して止まる','タグの繰り返しが∞ではなく回数（×1 = 1回）になっています','アニメーションパネル：そのタグの繰り返し','繰り返しを∞にして書き出し直してください'],
    ['ファイル全体でGIFが1つだけ','ファイルにタグがなく、全フレームが1つのアニメーションです','タイムラインの上にタグのレーンがあるか見ます','タイムラインでタグをドラッグして作るか、Asepriteで追加してから書き出し直してください']]},
   alternatives:{rows:[
    ['Aseprite自身の書き出し：File > Export > Export As、または`aseprite -b hero.aseprite --save-as hero-{tag}.gif`','Asepriteがあり、出力サイズの変更などのオプションが欲しいとき。`{tag}`を使うとコマンドラインでタグごとにGIFを書き出せます。'],
    ['同じ書き出しパネルのAPNG','GIFの対応範囲より、正確な色・柔らかいアルファ・ミリ秒のタイミングが大事なとき。APNGはChrome、Edge、Firefox、Opera、Safariが対応しています。'],
    ['[[game/sprite-sheet-to-video|WebM動画]]','アニメーションを動画投稿やトレーラーに入れるとき。ニアレストネイバーで4倍にし、単色の背景に載せます。']]},
   limits:['GIFの透明はオン／オフだけです。Nerulioは縁をディザ処理したり背景色と混ぜたりしません。','GIFはスプライトのピクセルサイズのままです。StudioにはGIF書き出し用の拡大オプションがありません。'],
   versions:{body:['GIF書き出しは、出力ファイルをPillowでデコードして確認しました。すべてのフレームとディレイが書いたとおりに戻りました。丸め、20 msの下限、アルファの閾値はNerulio独自の規則です。GIFの構造はW3CのGIF89a仕様、短いディレイの挙動はWebKitのソース、AsepriteのコマンドはAseprite公式ドキュメントに基づきます。'],sources:[GIF_SPEC,WEBKIT_DELAY,MDN_IMAGES,ASE_EXPORT,ASE_CLI]}
  }
 },
/* ============================================================================ sprite-sheet-to-aseprite */
 'game/sprite-sheet-to-aseprite':{
  type:'conversion',
  intent:{primary:'turn a PNG sprite sheet into an .aseprite file with frames and tags',secondary:['import a sprite sheet into Aseprite','keep timing, pivot and hitboxes as slices','what a sheet cannot tell Aseprite'],
   goal:'an .aseprite file that opens in Aseprite with one frame per cell, named tags, real timing and pivot/box slices',input:'PNG sprite sheet (grid with margin/spacing, or irregular; key colour optional)',output:'.aseprite (Sprite › Export .aseprite…) or a pivot-aligned .aseprite from Pack & Export',target:'Aseprite 1.3',support:'full',
   evidence:['src/studio/sprite/aseprite-bridge.js asepriteFromAsset (tags consecutive only, durations whole ms, pivot slice unless default, rect boxes only)','src/game/aseprite.js documentFromImages/writeAseprite','src/studio/sprite/import-plan.js (row_n tags, 100 ms timing decision)','docs/STUDIO-SPRITE.md §10 (231/231 reopen in Aseprite 1.3.18.6)','docs/STUDIO-PACK.md (.aseprite target: Aseprite 1.3.18 CLI renders every frame)'],
   external:['Aseprite docs: Import Sprite Sheet (offset, size, padding), Export Sprite Sheet, tags, slices, CLI --list-tags']},
  en:{
   answer:"A PNG sprite sheet is one picture: it has no frame boundaries, timing, animation names or pivot. To make an `.aseprite` file, Nerulio measures the grid (or finds each sprite as an island), keys out a flat background, starts one tag per row at 100 ms per frame, lets you fix tags, timing, pivot and hitboxes, and then Sprite › Export .aseprite… writes frames, tags, durations and slices. The same writer produced 231 of 231 files that Aseprite 1.3.18.6 opened without a warning.",
   concept:{title:'What a sheet has, and what an .aseprite file needs',body:[
    "A sheet only holds pixels. Cell size, margin (the empty border around the sheet) and spacing (the gap between cells) are implied by the layout, and the animations by the rows, if the artist was consistent. Frame timing, animation names, loop settings and the pivot are not in the file at all; they live in a game's code or in the artist's notes.",
    "An `.aseprite` file needs each of those explicitly: a canvas size, frames with a duration in milliseconds, tags with `from`–`to`, a direction and a repeat count, and slices for points and boxes. Nerulio fills in what can be measured (grid, islands, key colour, one tag per row), shows each guess with a confidence, and uses 100 ms per frame (Aseprite's default) until you set the real timing.",
    "Aseprite tags are ranges, so a tag must be a run of consecutive frames. Nerulio writes a run in timeline order as it is, writes a backwards run as a reverse tag, and names any tag whose frames are scattered instead of bending it into a wrong range."],
    terms:[['Cell','One frame\'s rectangle in the grid.'],['Margin / spacing','Empty pixels around the whole sheet / between neighbouring cells.'],['Islands','Separate groups of opaque pixels, used to cut a sheet that has no regular grid.'],['Slice','Aseprite\'s named rectangle; Nerulio writes the pivot and each rectangle box as one.']]},
   example:{title:'Example: an 8 × 4 sheet with margin and spacing',lines:[
    'sheet         267 × 135 px, magenta background',
    'grid          32 × 32 cells, margin 2 px, spacing 1 px',
    'check width   2 + 8 × 32 + 7 × 1 + 2 = 267 px',
    'check height  2 + 4 × 32 + 3 × 1 + 2 = 135 px',
    'frames        8 × 4 = 32 → tags row_1 … row_4, 8 frames each',
    'timing        row_2 at 12 fps: 1000 / 12 = 83.33 ms → written as 83 ms',
    '.aseprite     32 × 32 canvas, 32 frames, 1 layer, 4 tags, magenta → transparent'],
    after:'Rename `row_1` … `row_4` on the Timeline (idle, walk, jump, hurt) before export: Aseprite shows the tag names exactly as written.'},
   mapping:{head:['From the sheet / Studio','Written into the .aseprite','What to know'],rows:[
    ['Frames cut by grid or islands','One frame each on a canvas as large as the largest frame','Each frame keeps its offset from the top left; frames of different sizes do not share a pivot'],
    ['Tag over consecutive frames','Tag with `from`, `to`, direction and repeat','A backwards run becomes reverse; ping-pong stays ping-pong'],
    ['Tag over scattered frames','Not written','Named in the export message; drag the frames together and export again'],
    ['Frame duration','Whole milliseconds, at least 1','83.33 ms → 83 ms; untouched frames stay at 100 ms'],
    ['Pivot','A slice named `pivot` with a pivot point, keyed where it changes','Left out while every frame keeps the default bottom centre'],
    ['Rectangle boxes','One slice per type and slot (`hit`, `hit2`, `hurt` …)','An empty key where a box stops, so it does not carry on'],
    ['Circle and polygon boxes, collision polygons','Not written','Aseprite slices are rectangles; the export message lists skipped boxes'],
    ['Key colour','Transparent pixels, RGBA colour mode','The untouched sheet stays in the Studio for undo'],
    ['Layers','The Studio\'s layers (a cut sheet has one)','Identical cels on a layer are stored as linked cels']]},
   outputs:{rows:[
    ['hero.aseprite','Sprite › Export .aseprite…: frames at their own offsets, the Studio\'s layers, tags, durations, and pivot and box slices.'],
    ['hero_aseprite.zip › hero_aseprite/hero.aseprite','Pack & Export › .aseprite file: every frame on one pivot-aligned canvas, and a frame used by two tags repeated so each tag stays one range. The Aseprite 1.3.18 command line opened it and rendered every frame in our checks.']]},
   target:{title:'Continue in Aseprite',steps:[
    'Open `hero.aseprite` in Aseprite. The canvas is the frame size (32 × 32 in the example), not the sheet size.',
    'Check the tags above the frames: names, ranges and direction as set in Nerulio. A tag the export message listed as skipped is missing; fix its frame order in Nerulio and export again.',
    'Choose the Slice tool to see the `pivot` slice and the box slices; each keeps its keys per frame.',
    'Work on the animation. To get a sheet back for an engine, use File > Export Sprite Sheet, or bring the `.aseprite` back to Nerulio for [[game/aseprite-to-godot|Godot]], [[game/aseprite-to-unity|Unity]] or [[game/aseprite-to-phaser|Phaser]].']},
   verify:{steps:[
    '`aseprite -b hero.aseprite --list-tags` prints the tag names from first to last; compare them with the Timeline.',
    'Play each tag in Aseprite: `row_2` at 83 ms per frame loops every 8 × 83 = 664 ms.',
    'Show a checkered background: areas that were magenta must be transparent, not pink.']},
   trouble:{rows:[
    ['A tag is missing in Aseprite','Its frames are not consecutive on the Timeline','The export message names the skipped tag','Drag its frames next to each other (duplicate shared frames with Alt+N) and export again'],
    ['Frames jump or drift when played in Aseprite','Frames were cut as islands of different sizes and sit at different offsets on the shared canvas','Step through the frames and compare their sizes in the Frame panel','Use Align › one canvas size with an anchor before export, or export the pivot-aligned file from Pack & Export; see [[game/sprite-jitter-after-trim|jitter after trimming]]'],
    ['Circle or polygon hitboxes are gone','Aseprite slices are rectangles only','The export message lists every skipped box','Redraw them as rectangles (B), or keep them in the Godot or generic JSON export'],
    ['Pink or green pixels remain around the art','The key colour was not applied (confidence below high), or the art was anti-aliased against it','Import panel: the Background colour decision','Apply the detected colour; blended edge pixels need retouching, see [[game/remove-sprite-background|removing a sprite background]]'],
    ['Every frame is 100 ms','A PNG stores no timing, so the import starts at 100 ms','Frame panel: duration','Set all to fps per tag, or type milliseconds per frame, before export']]},
   alternatives:{rows:[
    ['Aseprite\'s File > Import Sprite Sheet','The grid is regular and you prefer to work in Aseprite: it asks for the offset (x, y), the sprite width and height and the padding, then takes the frames in the order of the sheet type. Tags, timing and slices you add by hand.'],
    ['Pack & Export › .aseprite file','You want every frame already aligned on its pivot, for example after cutting islands of different sizes.'],
    ['[[sprite-slicer|The sprite slicer]]','You only need the frames as separate PNGs, not an Aseprite document.']]},
   limits:['Scattered tags and non-rectangular boxes are reported, not written.','A sheet with semi-transparent edges against a key colour keeps those blended pixels.'],
   versions:{body:['Sprite › Export .aseprite… uses the writer that was checked on 231 real files: imported, written back and opened in Aseprite 1.3.18.6 without a warning, with tags, durations and pixels identical on all 231. The Pack & Export `.aseprite` target was opened and rendered frame by frame by the Aseprite 1.3.18 command line. The Aseprite steps above follow the Aseprite documentation.'],sources:[ASE_SHEET,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  },
  ko:{
   answer:'PNG 스프라이트 시트는 그림 한 장이라 프레임 경계, 타이밍, 애니메이션 이름, 피벗이 없습니다. `.aseprite` 파일을 만들기 위해 Nerulio는 격자를 재거나 스프라이트를 덩어리(아일랜드)로 찾고, 단색 배경을 투명하게 만들고, 행마다 태그를 하나씩 프레임당 100 ms로 시작합니다. 태그·타이밍·피벗·히트박스를 고친 뒤 스프라이트 › .aseprite 내보내기…가 프레임, 태그, 길이, 슬라이스를 씁니다. 같은 기록기로 만든 파일 231개를 Aseprite 1.3.18.6이 모두 경고 없이 열었습니다.',
   concept:{title:'시트에 있는 것과 .aseprite 파일에 필요한 것',body:[
    '시트에는 픽셀만 있습니다. 칸 크기, 여백(시트 둘레의 빈 공간), 간격(칸 사이의 틈)은 배치에서 짐작할 뿐이고, 애니메이션 구분은 작가가 일관되게 그렸다면 행으로 드러납니다. 프레임 타이밍, 애니메이션 이름, 반복 설정, 피벗은 파일 어디에도 없고 게임 코드나 작가의 메모에 있습니다.',
    '`.aseprite` 파일은 이것들을 모두 명시해야 합니다. 캔버스 크기, 밀리초 길이를 가진 프레임, `from`–`to`·방향·반복 횟수를 가진 태그, 점과 박스를 위한 슬라이스입니다. Nerulio는 잴 수 있는 것(격자, 아일랜드, 키 색, 행마다 태그 하나)을 채우고 추정마다 신뢰도를 보여 주며, 실제 타이밍을 정할 때까지 프레임당 100 ms(Aseprite 기본값)를 씁니다.',
    'Aseprite 태그는 구간이라서 태그 하나는 연속된 프레임이어야 합니다. Nerulio는 타임라인 순서대로 이어진 구간은 그대로, 거꾸로 이어진 구간은 역방향 태그로 쓰고, 프레임이 흩어진 태그는 틀린 구간으로 억지로 만들지 않고 이름을 알려 줍니다.'],
    terms:[['칸(셀)','격자 안에서 프레임 하나의 사각형.'],['여백 / 간격','시트 전체 둘레의 빈 픽셀 / 이웃한 칸 사이의 빈 픽셀.'],['아일랜드','불투명 픽셀이 따로 뭉친 덩어리. 격자가 일정하지 않은 시트를 자를 때 씁니다.'],['슬라이스','Aseprite의 이름 붙은 사각형. Nerulio는 피벗과 사각형 박스를 각각 슬라이스로 씁니다.']]},
   example:{title:'예시: 여백과 간격이 있는 8 × 4 시트',lines:[
    '시트          267 × 135 px, 마젠타 배경',
    '격자          32 × 32 칸, 여백 2 px, 간격 1 px',
    '가로 검산     2 + 8 × 32 + 7 × 1 + 2 = 267 px',
    '세로 검산     2 + 4 × 32 + 3 × 1 + 2 = 135 px',
    '프레임        8 × 4 = 32 → 태그 row_1 … row_4, 각 8프레임',
    '타이밍        row_2를 12 fps로: 1000 / 12 = 83.33 ms → 83 ms로 기록',
    '.aseprite     32 × 32 캔버스, 32프레임, 레이어 1, 태그 4, 마젠타 → 투명'],
    after:'내보내기 전에 타임라인에서 `row_1` … `row_4`의 이름을 idle, walk, jump, hurt처럼 바꾸세요. Aseprite는 태그 이름을 쓴 그대로 보여 줍니다.'},
   mapping:{head:['시트 / Studio에서','.aseprite에 기록','알아 둘 점'],rows:[
    ['격자나 아일랜드로 자른 프레임','가장 큰 프레임만 한 캔버스에 프레임 하나씩','프레임마다 왼쪽 위 기준 오프셋 유지. 크기가 다른 프레임끼리 피벗을 맞추지는 않습니다'],
    ['연속된 프레임의 태그','`from`, `to`, 방향, 반복이 있는 태그','거꾸로 이어진 구간은 역방향, 핑퐁은 핑퐁 그대로'],
    ['흩어진 프레임의 태그','기록 안 됨','내보내기 메시지에 이름이 나옵니다. 프레임을 붙여 놓고 다시 내보내세요'],
    ['프레임 길이','정수 밀리초, 최소 1','83.33 ms → 83 ms, 손대지 않은 프레임은 100 ms'],
    ['피벗','피벗 점이 있는 `pivot` 슬라이스, 바뀌는 프레임에 키','모든 프레임이 기본값(아래 가운데)이면 생략'],
    ['사각형 박스','종류와 순번마다 슬라이스 하나(`hit`, `hit2`, `hurt` …)','박스가 사라지는 프레임에 빈 키를 넣어 이어지지 않게 함'],
    ['원·폴리곤 박스, 충돌 폴리곤','기록 안 됨','Aseprite 슬라이스는 사각형뿐. 건너뛴 박스는 내보내기 메시지에 나옵니다'],
    ['키 색','투명 픽셀, RGBA 컬러 모드','되돌리기용으로 원본 시트가 Studio에 남습니다'],
    ['레이어','Studio의 레이어(자른 시트는 1개)','한 레이어의 똑같은 셀은 링크 셀로 저장']]},
   outputs:{rows:[
    ['hero.aseprite','스프라이트 › .aseprite 내보내기…: 프레임별 오프셋, Studio의 레이어, 태그, 길이, 피벗·박스 슬라이스.'],
    ['hero_aseprite.zip › hero_aseprite/hero.aseprite','패킹·내보내기 › .aseprite file: 모든 프레임을 피벗에 맞춘 한 캔버스에 놓고, 두 태그가 함께 쓰는 프레임은 반복해 넣어 태그마다 한 구간을 유지. 검증에서 Aseprite 1.3.18 명령줄이 열어 모든 프레임을 렌더링했습니다.']]},
   target:{title:'Aseprite에서 이어 작업하기',steps:[
    'Aseprite에서 `hero.aseprite`를 엽니다. 캔버스는 시트 크기가 아니라 프레임 크기(예시에서는 32 × 32)입니다.',
    '프레임 위의 태그를 확인하세요. 이름·구간·방향이 Nerulio에서 정한 그대로입니다. 내보내기 메시지에서 건너뛰었다고 한 태그는 없으니, Nerulio에서 프레임 순서를 고쳐 다시 내보내세요.',
    '슬라이스 도구를 고르면 `pivot` 슬라이스와 박스 슬라이스가 보입니다. 각각 프레임별 키를 유지합니다.',
    '애니메이션을 다듬습니다. 엔진용 시트가 다시 필요하면 File > Export Sprite Sheet를 쓰거나, `.aseprite`를 Nerulio로 가져와 [[game/aseprite-to-godot|Godot]], [[game/aseprite-to-unity|Unity]], [[game/aseprite-to-phaser|Phaser]]용으로 내보내세요.']},
   verify:{steps:[
    '`aseprite -b hero.aseprite --list-tags`가 태그 이름을 처음부터 끝까지 출력합니다. 타임라인과 비교하세요.',
    'Aseprite에서 태그를 재생해 보세요. 프레임당 83 ms인 `row_2`는 8 × 83 = 664 ms마다 반복됩니다.',
    '체크무늬 배경을 켜 보세요. 마젠타였던 곳은 분홍이 아니라 투명해야 합니다.']},
   trouble:{rows:[
    ['Aseprite에 태그가 없음','그 태그의 프레임이 타임라인에서 이어져 있지 않습니다','내보내기 메시지에 건너뛴 태그 이름이 나옵니다','프레임을 나란히 끌어 놓고(함께 쓰는 프레임은 Alt+N으로 복제) 다시 내보내세요'],
    ['Aseprite에서 재생하면 프레임이 튀거나 흘러감','크기가 다른 아일랜드로 잘린 프레임이 공용 캔버스에서 서로 다른 오프셋에 있습니다','프레임을 넘기며 프레임 패널에서 크기를 비교합니다','내보내기 전에 정렬 › 기준점을 정한 캔버스 크기 통일을 쓰거나, 패킹·내보내기의 피벗 정렬 파일을 쓰세요. [[game/sprite-jitter-after-trim|트림 후 흔들림]] 참고'],
    ['원·폴리곤 히트박스가 사라짐','Aseprite 슬라이스는 사각형만 됩니다','내보내기 메시지에 건너뛴 박스가 모두 나옵니다','사각형(B)으로 다시 그리거나, Godot 또는 범용 JSON 내보내기에서 유지하세요'],
    ['그림 둘레에 분홍·초록 픽셀이 남음','키 색이 적용되지 않았거나(신뢰도가 높음 미만), 그림이 키 색 위에서 안티에일리어싱됐습니다','가져오기 패널: 배경색 결정','감지된 색을 적용하세요. 섞인 가장자리 픽셀은 손봐야 합니다. [[game/remove-sprite-background|스프라이트 배경 제거]] 참고'],
    ['모든 프레임이 100 ms','PNG에는 타이밍이 없어 가져올 때 100 ms로 시작합니다','프레임 패널: 길이','내보내기 전에 태그마다 fps로 일괄 설정하거나 프레임별 밀리초를 입력하세요']]},
   alternatives:{rows:[
    ['Aseprite의 File > Import Sprite Sheet','격자가 일정하고 Aseprite 안에서 작업하는 편이 좋을 때. 오프셋(x, y), 스프라이트 너비·높이, 패딩을 입력하면 시트 유형 순서대로 프레임을 가져옵니다. 태그·타이밍·슬라이스는 직접 추가합니다.'],
    ['패킹·내보내기 › .aseprite file','크기가 다른 아일랜드를 자른 뒤처럼, 모든 프레임이 이미 피벗에 맞춰져 있기를 원할 때.'],
    ['[[sprite-slicer|스프라이트 슬라이서]]','Aseprite 문서가 아니라 프레임별 PNG만 필요할 때.']]},
   limits:['흩어진 태그와 사각형이 아닌 박스는 알려 줄 뿐 기록하지 않습니다.','키 색 위에서 반투명하게 섞인 가장자리 픽셀은 그대로 남습니다.'],
   versions:{body:['스프라이트 › .aseprite 내보내기…는 실제 파일 231개로 확인한 기록기를 씁니다. 가져와서 다시 쓰고 Aseprite 1.3.18.6에서 열었을 때 231개 모두 경고 없이 태그·길이·픽셀이 같았습니다. 패킹·내보내기의 `.aseprite` 대상은 Aseprite 1.3.18 명령줄이 열어 프레임마다 렌더링했습니다. 위의 Aseprite 단계는 Aseprite 공식 문서를 따릅니다.'],sources:[ASE_SHEET,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  },
  ja:{
   answer:'PNGのスプライトシートは1枚の絵なので、フレームの境界、タイミング、アニメーション名、ピボットがありません。`.aseprite`を作るために、Nerulioはグリッドを測る（またはスプライトを島として見つける）、単色の背景を透明にする、行ごとにタグを1つ、1フレーム100 msで作る、という下ごしらえをします。タグ・タイミング・ピボット・当たり判定を直したら、スプライト › .aseprite書き出し…がフレーム、タグ、長さ、スライスを書き込みます。同じ書き出し処理で作った231ファイルは、すべてAseprite 1.3.18.6で警告なく開けました。',
   concept:{title:'シートにあるものと、.asepriteに必要なもの',body:[
    'シートにあるのはピクセルだけです。セルサイズ、マージン（シート周囲の空白）、スペーシング（セル同士の隙間）は配置から推し量るしかなく、アニメーションの区切りは作者が一貫していれば行に表れます。フレームのタイミング、アニメーション名、ループ設定、ピボットはファイルのどこにもなく、ゲームのコードや作者のメモの中にあります。',
    '`.aseprite`ではそれらをすべて明示する必要があります。キャンバスサイズ、ミリ秒の長さを持つフレーム、`from`–`to`・方向・繰り返し回数を持つタグ、点やボックスのためのスライスです。Nerulioは測れるもの（グリッド、島、キーカラー、行ごとのタグ）を埋め、推定ごとに信頼度を示し、本当のタイミングを決めるまでは1フレーム100 ms（Asepriteの既定値）を使います。',
    'Asepriteのタグは範囲なので、1つのタグは連続したフレームでなければなりません。Nerulioはタイムライン順に続く範囲はそのまま、逆向きに続く範囲は逆方向のタグとして書き、フレームが飛び飛びのタグは誤った範囲にねじ曲げず、名前を知らせます。'],
    terms:[['セル','グリッド内の1フレーム分の矩形。'],['マージン／スペーシング','シート全体の周囲の空白ピクセル／隣り合うセル間の空白ピクセル。'],['島（アイランド）','不透明ピクセルがまとまった塊。規則的なグリッドのないシートを切るときに使います。'],['スライス','Asepriteの名前付き矩形。Nerulioはピボットと矩形ボックスをそれぞれスライスとして書きます。']]},
   example:{title:'具体例：マージンとスペーシングのある8 × 4シート',lines:[
    'シート        267 × 135 px、マゼンタ背景',
    'グリッド      32 × 32 セル、マージン 2 px、スペーシング 1 px',
    '横の検算      2 + 8 × 32 + 7 × 1 + 2 = 267 px',
    '縦の検算      2 + 4 × 32 + 3 × 1 + 2 = 135 px',
    'フレーム      8 × 4 = 32 → タグ row_1 … row_4、各8フレーム',
    'タイミング    row_2 を 12 fps に: 1000 / 12 = 83.33 ms → 83 ms で記録',
    '.aseprite     32 × 32 キャンバス、32フレーム、レイヤー1、タグ4、マゼンタ → 透明'],
    after:'書き出し前にタイムラインで`row_1` … `row_4`をidle、walk、jump、hurtのように改名してください。Asepriteはタグ名を書いたとおりに表示します。'},
   mapping:{head:['シート／Studioでは','.asepriteに書かれるもの','知っておくこと'],rows:[
    ['グリッドや島で切ったフレーム','最大のフレームと同じ大きさのキャンバスに1フレームずつ','各フレームは左上基準のオフセットを保持。サイズの違うフレーム同士はピボットで揃えません'],
    ['連続したフレームのタグ','`from`、`to`、方向、繰り返しを持つタグ','逆向きの範囲は逆方向に、ピンポンはピンポンのまま'],
    ['飛び飛びのフレームのタグ','書かれない','書き出しメッセージに名前が出ます。フレームを並べ直して書き出し直してください'],
    ['フレームの長さ','整数ミリ秒、最小1','83.33 ms → 83 ms、触っていないフレームは100 ms'],
    ['ピボット','ピボット点を持つ`pivot`スライス、変わるフレームにキー','全フレームが既定の下中央なら省略'],
    ['矩形ボックス','種類と番号ごとにスライス1つ（`hit`、`hit2`、`hurt` …）','ボックスがなくなるフレームに空のキーを入れて持ち越さない'],
    ['円・ポリゴンのボックス、コリジョンポリゴン','書かれない','Asepriteのスライスは矩形だけ。省いたボックスは書き出しメッセージに出ます'],
    ['キーカラー','透明ピクセル、RGBAカラーモード','元のシートは取り消し用にStudioに残ります'],
    ['レイヤー','Studioのレイヤー（切ったシートなら1枚）','同じレイヤーの同一セルはリンクセルとして保存']]},
   outputs:{rows:[
    ['hero.aseprite','スプライト › .aseprite書き出し…：フレームごとのオフセット、Studioのレイヤー、タグ、長さ、ピボットとボックスのスライス。'],
    ['hero_aseprite.zip › hero_aseprite/hero.aseprite','パック＆書き出し › .aseprite file：全フレームをピボットで揃えた1つのキャンバスに置き、2つのタグが共有するフレームは繰り返して各タグを1つの範囲に保ちます。検証ではAseprite 1.3.18のコマンドラインが開いて全フレームをレンダリングしました。']]},
   target:{title:'Asepriteで続ける',steps:[
    'Asepriteで`hero.aseprite`を開きます。キャンバスはシートではなくフレームのサイズ（例では32 × 32）です。',
    'フレームの上のタグを確認します。名前・範囲・方向はNerulioで決めたとおりです。書き出しメッセージで省略と出たタグは入っていないので、Nerulioでフレーム順を直して書き出し直してください。',
    'スライスツールを選ぶと`pivot`スライスとボックスのスライスが見えます。それぞれフレームごとのキーを保っています。',
    'アニメーションを仕上げます。エンジン用のシートが要るならFile > Export Sprite Sheetを使うか、`.aseprite`をNerulioに戻して[[game/aseprite-to-godot|Godot]]、[[game/aseprite-to-unity|Unity]]、[[game/aseprite-to-phaser|Phaser]]向けに書き出してください。']},
   verify:{steps:[
    '`aseprite -b hero.aseprite --list-tags`がタグ名を最初から最後まで出力します。タイムラインと比べてください。',
    'Asepriteでタグを再生します。1フレーム83 msの`row_2`は8 × 83 = 664 msごとにループします。',
    '市松模様の背景を表示します。マゼンタだった部分はピンクではなく透明のはずです。']},
   trouble:{rows:[
    ['Asepriteにタグがない','そのタグのフレームがタイムライン上で連続していません','書き出しメッセージに省略したタグ名が出ます','フレームを隣り合わせに並べ（共有フレームはAlt+Nで複製）、書き出し直してください'],
    ['Asepriteで再生するとフレームが跳ねる・ずれる','サイズの違う島として切ったフレームが、共通キャンバス上で別々のオフセットにあります','フレームを送りながらフレームパネルでサイズを比べます','書き出し前に整列 › アンカー指定でキャンバスサイズを統一するか、パック＆書き出しのピボット揃えのファイルを使ってください。[[game/sprite-jitter-after-trim|トリム後のガタつき]]も参照'],
    ['円やポリゴンの当たり判定が消える','Asepriteのスライスは矩形だけです','書き出しメッセージに省いたボックスがすべて出ます','矩形（B）で描き直すか、GodotやジェネリックJSONの書き出しで保持してください'],
    ['絵の周りにピンクや緑のピクセルが残る','キーカラーが適用されていない（信頼度が高未満）か、絵がキーカラーの上でアンチエイリアスされています','インポートパネル：背景色の判断','検出された色を適用してください。混ざった縁のピクセルは手直しが必要です。[[game/remove-sprite-background|スプライト背景の除去]]を参照'],
    ['全フレームが100 ms','PNGにはタイミングがないので、読み込み時は100 msから始まります','フレームパネル：長さ','書き出し前にタグごとにfpsで一括設定するか、フレームごとにミリ秒を入力してください']]},
   alternatives:{rows:[
    ['AsepriteのFile > Import Sprite Sheet','グリッドが規則的で、Aseprite内で作業したいとき。オフセット（x, y）、スプライトの幅・高さ、パディングを指定すると、シートの種類の順にフレームを取り込みます。タグ・タイミング・スライスは手で追加します。'],
    ['パック＆書き出し › .aseprite file','サイズの違う島を切ったあとなど、全フレームが最初からピボットで揃っていてほしいとき。'],
    ['[[sprite-slicer|スプライトスライサー]]','Aseprite文書ではなく、フレームごとのPNGだけが欲しいとき。']]},
   limits:['飛び飛びのタグと矩形以外のボックスは、知らせるだけで書き込みません。','キーカラーの上で半透明に混ざった縁のピクセルはそのまま残ります。'],
   versions:{body:['スプライト › .aseprite書き出し…は、実ファイル231個で確認した書き出し処理を使います。読み込んで書き直し、Aseprite 1.3.18.6で開いたところ、231個すべてが警告なしでタグ・長さ・ピクセルとも一致しました。パック＆書き出しの`.aseprite`ターゲットは、Aseprite 1.3.18のコマンドラインで開いて全フレームをレンダリングしました。上のAsepriteの手順はAsepriteの公式ドキュメントに基づきます。'],sources:[ASE_SHEET,ASE_TAGS,ASE_SLICES,ASE_CLI]}
  }
 },
/* ============================================================================ sprite-sheet-to-video */
 'game/sprite-sheet-to-video':{
  type:'conversion',
  intent:{primary:'turn a sprite sheet animation into a video file',secondary:['sprite sheet to MP4','pixel art video without blur','devlog or trailer clip of a sprite animation'],
   goal:'a crisp video of each animation, enlarged without blur, with the frame timing of the sheet, ready to post or to convert to MP4',input:'sprite sheet (or any Studio sprite) cut into animations',output:'ZIP with one .webm (VP9, or VP8) per animation; no MP4, no audio',target:'video posts, trailers, store pages (via ffmpeg for MP4)',support:'partial',
   evidence:['src/game/export/webm.js (VideoEncoder vp09.00.10.08 → vp8, scale ≤ 4 with sides ≤ 1920, even size, background rgb(32,34,40), bitrate max(500k, W·H·8), own muxer)','src/studio/pack-worker.js (one .webm per animation, one cycle from animationFrames)','tests/studio-pack-browser.py (EBML header, ffprobe, Chromium plays 0.6 s)','docs/STUDIO-PACK.md'],
   external:['MDN: VideoEncoder availability (limited, secure context, workers)','ffmpeg docs: -c:v, -pix_fmt, -stream_loop; ffmpeg codecs: libx264']},
  en:{
   answer:"Nerulio turns each animation of a sprite sheet into its own WebM video (VP9, or VP8 where the browser has no VP9 encoder), encoded by the browser's WebCodecs `VideoEncoder`. Frames are enlarged 4× with nearest-neighbour (less when a side would pass 1920 px), drawn on a solid dark background, and each keeps its own duration; one file holds one cycle. It does not write MP4 or audio: convert the WebM with a tool such as ffmpeg when a platform wants MP4.",
   concept:{title:'Why pixel art needs care in a video',body:[
    "Video codecs such as VP9 and VP8 are lossy and normally store colour at half resolution in both directions (4:2:0): one colour sample per 2 × 2 pixels. A one-pixel outline in a 32 × 32 sprite would smear into its neighbours. Enlarging every pixel to a 4 × 4 block with nearest-neighbour before encoding gives each source pixel whole colour samples, so edges stay square after compression.",
    "There is no transparency in this export. VP9 can carry alpha in WebM, but many players ignore it, so every frame is blended onto a solid rgb(32, 34, 40) background; a semi-transparent pixel is mixed with that colour in proportion to its alpha.",
    "Timing is stored as timestamps, not as one fixed frame rate: each frame starts where the previous ones end (whole milliseconds in the file), so a 250 ms hold stays a hold. A file contains one cycle of the animation in playback order, ping-pong written out; looping is up to the player."],
    terms:[['4:2:0','Chroma subsampling: colour at half width and half height, brightness at full size.'],
     ['VP9 / VP8','Video codecs carried in WebM. Nerulio asks the browser for VP9 (`vp09.00.10.08`) and falls back to VP8.'],
     ['VideoEncoder','The WebCodecs browser API that encodes the frames. It is not available in every browser and only works on secure (HTTPS) pages.'],
     ['Nearest-neighbour','Scaling that copies each pixel into a k × k block without blending.']]},
   example:{title:'Example: sizes, bitrate and length',lines:[
    'frames 64 × 64, walk = 6 frames × 100 ms',
    'scale     4× → 256 × 256 px   (largest factor ≤ 4 with both sides ≤ 1920 px)',
    'bitrate   max(500 000, 256 × 256 × 8) = 524 288 bit/s',
    'length    6 × 100 ms = 0.6 s, one cycle',
    'file      hero_webm/hero_walk.webm',
    '',
    'boss 700 × 300:  4× = 2800 px wide (too wide), 3× = 2100 (too wide) → 2× = 1400 × 600',
    'odd  545 × 201:  4× = 2180 (too wide) → 3× = 1635 × 603 → padded to 1636 × 604 (even sides)'],
    after:'The export notes repeat this per animation, for example “walk: WebM VP9 256×256 (4× nearest), lossy, background rgb(32,34,40).”'},
   mapping:{head:['In the Studio','In the WebM','Note'],rows:[
    ['Animation (tag)','One `.webm` file','Export name + animation name, e.g. `hero_walk.webm`'],
    ['Frame duration','Timestamp of the next frame','Whole milliseconds; uneven timing is kept'],
    ['Direction, ping-pong','Frames in playback order','One cycle; the repeat count is not stored'],
    ['Pixel','k × k block, k = 4 unless the frame is large','Nearest-neighbour, then lossy compression'],
    ['Transparency','Blended onto rgb(32, 34, 40)','No alpha channel in the file'],
    ['Frames of different sizes','One cell per animation, frames aligned on their pivots','Same alignment as the GIF export']]},
   outputs:{rows:[
    ['hero_webm.zip','The download, with a folder `hero_webm/` (named after the export name).'],
    ['hero_webm/hero_walk.webm','One cycle of `walk`: VP9 (or VP8) video in a WebM container, no audio track.']]},
   target:{title:'After export: MP4, longer clips, posting',steps:[
    'Unzip; there is one `.webm` per animation. Chromium played these files in our checks.',
    'Need MP4? Re-encode with ffmpeg, for example `ffmpeg -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk.mp4`. The enlargement is already in the pixels, so the MP4 keeps the square blocks.',
    'A 0.6 s clip is short for a post. `-stream_loop` repeats the input before encoding: `ffmpeg -stream_loop 9 -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk_x10.mp4` gives ten cycles, 6 s.',
    'Keep the sheet or an APNG next to the video: the WebM is lossy and meant for showing the animation, not for loading into an engine.']},
   verify:{steps:[
    'Play the file and time one cycle: 6 frames × 100 ms should last 0.6 s.',
    'Pause and zoom in: each source pixel is a 4 × 4 block, with slightly soft colour edges from compression.',
    '`ffprobe hero_walk.webm` reports the codec (vp9 or vp8) and the width and height given in the notes.']},
   trouble:{rows:[
    ['The WebM button is disabled','This browser has no WebCodecs `VideoEncoder`, or the page is not served over HTTPS','The button\'s tooltip says so','Use a current Chrome or Edge; GIF and APNG export work without it'],
    ['The video ends after a fraction of a second','A file holds one cycle; looping is the player\'s job','Its length equals the sum of the frame times','Loop it in the player, or repeat the input with ffmpeg `-stream_loop` before posting'],
    ['A dark fringe around soft edges','Semi-transparent pixels were blended with the dark background','Look at glows and anti-aliased edges','Export APNG to keep transparency; the background colour is fixed in this export'],
    ['Large sprites look soft','The scale drops below 4× to keep both sides ≤ 1920 px, so fewer pixels per source pixel survive compression','The notes show the factor, for example “(2× nearest)”','Export smaller animations separately, or accept 2×'],
    ['A site rejects the file','It accepts MP4 (H.264) but not WebM','Its upload help lists the formats','Convert with ffmpeg as above']]},
   alternatives:{rows:[
    ['[[game/sprite-sheet-to-gif|Animated GIF]] or APNG from the same panel','Chat or forum posts where transparency matters; APNG keeps soft edges and exact colours.'],
    ['Screen-record the floating preview (F7, up to 8×)','You want your own background, several animations side by side, or a long take.'],
    ['Export PNG frames and build the video in a video editor','You need MP4 directly, a custom frame rate or sound; see [[game/sprite-sheet-to-png-frames|sprite sheet to PNG frames]].']]},
   limits:['WebM only: no MP4 and no audio track.','The background colour and the scale are fixed: rgb(32, 34, 40), 4× whenever both sides stay within 1920 px.','One cycle per file; repeat counts are not stored.'],
   versions:{body:['The WebM export was checked in Chromium: the file starts with the WebM (EBML) header, ffprobe reads the video stream and its frames, and Chromium plays a 6 × 100 ms animation in 0.6 s at 4× size. The encoder is the browser\'s own, so whether you get VP9 or VP8 depends on that browser. Browser availability of VideoEncoder follows MDN; the ffmpeg options follow the ffmpeg documentation.'],sources:[MDN_ENCODER,FFMPEG,FFMPEG_CODECS]}
  },
  ko:{
   answer:'Nerulio는 스프라이트 시트의 애니메이션마다 WebM 동영상을 하나씩 만듭니다(VP9, 브라우저에 VP9 인코더가 없으면 VP8). 인코딩은 브라우저의 WebCodecs `VideoEncoder`가 합니다. 프레임은 최근접 이웃으로 4배 키우고(한 변이 1920 px를 넘으면 그보다 작게), 단색 어두운 배경 위에 그리며, 프레임마다 자기 길이를 유지합니다. 파일 하나에 한 사이클이 들어갑니다. MP4나 오디오는 쓰지 않으니, MP4가 필요한 곳에는 ffmpeg 같은 도구로 WebM을 변환하세요.',
   concept:{title:'픽셀아트를 동영상으로 만들 때 조심할 점',body:[
    'VP9·VP8 같은 동영상 코덱은 손실 압축이고 보통 색을 가로세로 절반 해상도(4:2:0)로 저장합니다. 2 × 2 픽셀마다 색 샘플이 하나입니다. 32 × 32 스프라이트의 1픽셀 외곽선은 옆 픽셀로 번집니다. 인코딩 전에 최근접 이웃으로 모든 픽셀을 4 × 4 블록으로 키우면 원래 픽셀 하나가 색 샘플을 온전히 가지게 되어, 압축 뒤에도 가장자리가 네모로 남습니다.',
    '이 내보내기에는 투명이 없습니다. VP9는 WebM에서 알파를 담을 수 있지만 무시하는 재생기가 많아서, 모든 프레임을 단색 rgb(32, 34, 40) 배경 위에 섞습니다. 반투명 픽셀은 알파 비율만큼 이 색과 섞입니다.',
    '타이밍은 고정 프레임레이트가 아니라 타임스탬프로 저장됩니다. 각 프레임은 앞 프레임들이 끝나는 시점에 시작하고(파일 안에서는 정수 밀리초), 250 ms 멈춤 동작도 그대로 멈춥니다. 파일에는 재생 순서(핑퐁은 펼친 순서)로 애니메이션 한 사이클이 들어가며, 반복은 재생기가 맡습니다.'],
    terms:[['4:2:0','크로마 서브샘플링. 색은 가로·세로 절반 해상도, 밝기는 원래 해상도로 저장합니다.'],
     ['VP9 / VP8','WebM에 담기는 동영상 코덱. Nerulio는 브라우저에 VP9(`vp09.00.10.08`)를 요청하고, 안 되면 VP8을 씁니다.'],
     ['VideoEncoder','프레임을 인코딩하는 WebCodecs 브라우저 API. 모든 브라우저에 있지는 않고 보안(HTTPS) 페이지에서만 동작합니다.'],
     ['최근접 이웃','픽셀을 섞지 않고 k × k 블록으로 복사하는 확대 방식.']]},
   example:{title:'예시: 크기, 비트레이트, 길이',lines:[
    '프레임 64 × 64, walk = 6프레임 × 100 ms',
    '배율      4× → 256 × 256 px   (두 변 모두 1920 px 이하인 4 이하 최대 배율)',
    '비트레이트 max(500 000, 256 × 256 × 8) = 524 288 bit/s',
    '길이      6 × 100 ms = 0.6 s, 한 사이클',
    '파일      hero_webm/hero_walk.webm',
    '',
    '보스 700 × 300:  4× = 가로 2800 (초과), 3× = 2100 (초과) → 2× = 1400 × 600',
    '홀수 545 × 201:  4× = 2180 (초과) → 3× = 1635 × 603 → 1636 × 604로 채움 (짝수 변)'],
    after:'내보내기 안내가 애니메이션마다 이 내용을 알려 줍니다. 예: “walk: WebM VP9 256×256 (4× nearest), lossy, background rgb(32,34,40).”'},
   mapping:{head:['Studio에서','WebM에서','참고'],rows:[
    ['애니메이션(태그)','`.webm` 파일 하나','내보내기 이름 + 애니메이션 이름, 예: `hero_walk.webm`'],
    ['프레임 길이','다음 프레임의 타임스탬프','정수 밀리초, 들쭉날쭉한 타이밍 유지'],
    ['방향, 핑퐁','재생 순서대로 프레임','한 사이클, 반복 횟수는 저장 안 됨'],
    ['픽셀','k × k 블록, 프레임이 크지 않으면 k = 4','최근접 이웃 확대 후 손실 압축'],
    ['투명','rgb(32, 34, 40) 위에 섞음','파일에 알파 채널 없음'],
    ['크기가 다른 프레임','애니메이션마다 한 칸, 프레임을 피벗에 맞춤','GIF 내보내기와 같은 정렬']]},
   outputs:{rows:[
    ['hero_webm.zip','내려받는 파일. 안에 `hero_webm/` 폴더가 있습니다(내보내기 이름을 따름).'],
    ['hero_webm/hero_walk.webm','`walk` 한 사이클: WebM 컨테이너의 VP9(또는 VP8) 동영상, 오디오 트랙 없음.']]},
   target:{title:'내보낸 뒤: MP4, 더 긴 클립, 게시',steps:[
    'ZIP을 풉니다. 애니메이션마다 `.webm`이 하나 있습니다. 검증에서 Chromium이 이 파일을 재생했습니다.',
    'MP4가 필요하면 ffmpeg로 다시 인코딩하세요. 예: `ffmpeg -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk.mp4`. 확대는 이미 픽셀에 들어가 있어 MP4에서도 네모 블록이 유지됩니다.',
    '0.6초짜리 클립은 게시물로는 짧습니다. `-stream_loop`은 인코딩 전에 입력을 반복합니다. `ffmpeg -stream_loop 9 -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk_x10.mp4`면 열 사이클, 6초가 됩니다.',
    '동영상 옆에 시트나 APNG를 함께 보관하세요. WebM은 손실 압축이라 애니메이션을 보여 주는 용도이지 엔진에 넣는 용도가 아닙니다.']},
   verify:{steps:[
    '재생해서 한 사이클 시간을 재 보세요. 6프레임 × 100 ms면 0.6초입니다.',
    '멈추고 확대해 보세요. 원래 픽셀 하나가 4 × 4 블록이고, 압축 때문에 색 경계가 약간 부드럽습니다.',
    '`ffprobe hero_walk.webm`이 코덱(vp9 또는 vp8)과, 안내에 나온 너비·높이를 보여 줍니다.']},
   trouble:{rows:[
    ['WebM 버튼이 꺼져 있음','이 브라우저에 WebCodecs `VideoEncoder`가 없거나, 페이지가 HTTPS가 아닙니다','버튼 툴팁이 알려 줍니다','최신 Chrome이나 Edge를 쓰세요. GIF와 APNG 내보내기는 없이도 됩니다'],
    ['동영상이 1초도 안 돼 끝남','파일 하나는 한 사이클이고, 반복은 재생기 몫입니다','길이가 프레임 시간의 합과 같습니다','재생기에서 반복하거나, 게시 전에 ffmpeg `-stream_loop`로 입력을 반복하세요'],
    ['부드러운 가장자리에 어두운 테두리','반투명 픽셀이 어두운 배경과 섞였습니다','빛 번짐이나 안티에일리어싱된 가장자리를 봅니다','투명이 필요하면 APNG로 내보내세요. 이 내보내기의 배경색은 고정입니다'],
    ['큰 스프라이트가 흐릿함','두 변을 1920 px 이하로 맞추려고 배율이 4배 아래로 내려가, 원래 픽셀당 남는 픽셀이 적어졌습니다','안내에 “(2× nearest)”처럼 배율이 나옵니다','애니메이션을 작게 나눠 내보내거나 2배를 받아들이세요'],
    ['사이트가 파일을 거부함','WebM이 아니라 MP4(H.264)만 받습니다','업로드 도움말의 형식 목록','위처럼 ffmpeg로 변환하세요']]},
   alternatives:{rows:[
    ['같은 패널의 [[game/sprite-sheet-to-gif|Animated GIF]]나 APNG','투명이 중요한 채팅·커뮤니티 게시물. APNG는 부드러운 가장자리와 정확한 색을 유지합니다.'],
    ['플로팅 미리보기(F7, 최대 8배)를 화면 녹화','원하는 배경, 여러 애니메이션 나란히, 긴 녹화가 필요할 때.'],
    ['PNG 프레임을 내보내 영상 편집기에서 만들기','MP4를 바로, 원하는 프레임레이트나 소리와 함께 만들어야 할 때. [[game/sprite-sheet-to-png-frames|스프라이트 시트를 PNG 프레임으로]] 참고.']]},
   limits:['WebM만 씁니다. MP4와 오디오 트랙은 없습니다.','배경색과 배율은 고정입니다. rgb(32, 34, 40), 두 변이 1920 px 안이면 4배.','파일마다 한 사이클이며 반복 횟수는 저장하지 않습니다.'],
   versions:{body:['WebM 내보내기는 Chromium에서 확인했습니다. 파일이 WebM(EBML) 헤더로 시작하고, ffprobe가 동영상 스트림과 프레임을 읽고, Chromium이 6 × 100 ms 애니메이션을 4배 크기로 0.6초 동안 재생했습니다. 인코더는 브라우저 자체의 것이라 VP9가 나올지 VP8이 나올지는 브라우저에 달려 있습니다. VideoEncoder 지원 범위는 MDN, ffmpeg 옵션은 ffmpeg 공식 문서를 따릅니다.'],sources:[MDN_ENCODER,FFMPEG,FFMPEG_CODECS]}
  },
  ja:{
   answer:'Nerulioはスプライトシートのアニメーションごとに、WebM動画を1本ずつ作ります（VP9、ブラウザにVP9エンコーダがなければVP8）。エンコードはブラウザのWebCodecs `VideoEncoder`が行います。フレームはニアレストネイバーで4倍に拡大し（一辺が1920 pxを超えるならそれより小さく）、暗い単色の背景に描き、フレームごとの長さを保ちます。1ファイルに1サイクルが入ります。MP4や音声は書き出さないので、MP4が必要な場所にはffmpegなどでWebMを変換してください。',
   concept:{title:'ピクセルアートを動画にするときの注意点',body:[
    'VP9やVP8などの動画コーデックは非可逆で、通常は色を縦横半分の解像度（4:2:0）で保存します。2 × 2ピクセルごとに色のサンプルが1つです。32 × 32スプライトの1ピクセルの輪郭線は隣へにじみます。エンコード前にニアレストネイバーで全ピクセルを4 × 4ブロックに拡大すれば、元の1ピクセルが色のサンプルを丸ごと持つので、圧縮後も縁が四角いまま残ります。',
    'この書き出しに透明はありません。VP9はWebMでアルファを持てますが無視するプレーヤーが多いため、全フレームを単色のrgb(32, 34, 40)の背景に合成します。半透明のピクセルはアルファの割合でこの色と混ざります。',
    'タイミングは固定フレームレートではなく、タイムスタンプとして保存されます。各フレームは前のフレームが終わる時点から始まり（ファイル内では整数ミリ秒）、250 msの溜めは溜めのまま残ります。ファイルには再生順（ピンポンは展開済み）で1サイクルが入り、ループはプレーヤー側の仕事です。'],
    terms:[['4:2:0','クロマサブサンプリング。色は縦横半分の解像度、明るさは元の解像度で保存します。'],
     ['VP9 / VP8','WebMに入る動画コーデック。NerulioはブラウザにVP9（`vp09.00.10.08`）を求め、だめならVP8にします。'],
     ['VideoEncoder','フレームをエンコードするWebCodecsのブラウザAPI。すべてのブラウザにあるわけではなく、安全な（HTTPS）ページでのみ動きます。'],
     ['ニアレストネイバー','ピクセルを混ぜずにk × kブロックへ複製する拡大方法。']]},
   example:{title:'具体例：サイズ、ビットレート、長さ',lines:[
    'フレーム 64 × 64、walk = 6フレーム × 100 ms',
    '倍率      4× → 256 × 256 px   (両辺とも1920 px以下になる4以下の最大倍率)',
    'ビットレート max(500 000, 256 × 256 × 8) = 524 288 bit/s',
    '長さ      6 × 100 ms = 0.6 s、1サイクル',
    'ファイル  hero_webm/hero_walk.webm',
    '',
    'ボス 700 × 300:  4× = 横2800 (超過)、3× = 2100 (超過) → 2× = 1400 × 600',
    '奇数 545 × 201:  4× = 2180 (超過) → 3× = 1635 × 603 → 1636 × 604 に拡張 (偶数辺)'],
    after:'書き出し後のメモがアニメーションごとにこの内容を示します。例：「walk: WebM VP9 256×256 (4× nearest), lossy, background rgb(32,34,40).」'},
   mapping:{head:['Studioでは','WebMでは','補足'],rows:[
    ['アニメーション（タグ）','`.webm`ファイル1つ','書き出し名＋アニメーション名、例：`hero_walk.webm`'],
    ['フレームの長さ','次のフレームのタイムスタンプ','整数ミリ秒、不均一なタイミングも保持'],
    ['方向、ピンポン','再生順のフレーム','1サイクル、繰り返し回数は保存されない'],
    ['ピクセル','k × kブロック、フレームが大きくなければ k = 4','ニアレストネイバー拡大のあと非可逆圧縮'],
    ['透明','rgb(32, 34, 40)の上に合成','ファイルにアルファチャンネルなし'],
    ['サイズの違うフレーム','アニメーションごとに1セル、フレームをピボットで揃える','GIF書き出しと同じ揃え方']]},
   outputs:{rows:[
    ['hero_webm.zip','ダウンロードされるファイル。中に`hero_webm/`フォルダがあります（書き出し名に従います）。'],
    ['hero_webm/hero_walk.webm','`walk`の1サイクル：WebMコンテナのVP9（またはVP8）動画、音声トラックなし。']]},
   target:{title:'書き出したあと：MP4、長いクリップ、投稿',steps:[
    'ZIPを展開します。アニメーションごとに`.webm`が1本あります。検証ではChromiumがこれらのファイルを再生しました。',
    'MP4が必要ならffmpegで再エンコードします。例：`ffmpeg -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk.mp4`。拡大はすでにピクセルに入っているので、MP4でも四角いブロックが保たれます。',
    '0.6秒のクリップは投稿には短すぎます。`-stream_loop`はエンコード前に入力を繰り返します。`ffmpeg -stream_loop 9 -i hero_walk.webm -c:v libx264 -pix_fmt yuv420p hero_walk_x10.mp4`で10サイクル、6秒になります。',
    '動画の横にシートやAPNGも残しておいてください。WebMは非可逆で、アニメーションを見せるためのもので、エンジンに読み込むものではありません。']},
   verify:{steps:[
    '再生して1サイクルの時間を測ります。6フレーム × 100 msなら0.6秒です。',
    '一時停止して拡大します。元の1ピクセルが4 × 4ブロックになり、圧縮のため色の境目がわずかに柔らかくなります。',
    '`ffprobe hero_walk.webm`がコーデック（vp9またはvp8）と、メモにある幅・高さを表示します。']},
   trouble:{rows:[
    ['WebMのボタンが無効','このブラウザにWebCodecsの`VideoEncoder`がないか、ページがHTTPSで配信されていません','ボタンのツールチップに理由が出ます','最新のChromeかEdgeを使ってください。GIFとAPNGの書き出しはなくても動きます'],
    ['動画が1秒足らずで終わる','1ファイルは1サイクルで、ループはプレーヤーの役目です','長さがフレーム時間の合計と一致します','プレーヤーでループするか、投稿前にffmpegの`-stream_loop`で入力を繰り返してください'],
    ['柔らかい縁に暗い縁取りが出る','半透明のピクセルが暗い背景と混ざりました','グローやアンチエイリアスされた縁を見ます','透明が必要ならAPNGで書き出してください。この書き出しの背景色は固定です'],
    ['大きなスプライトがぼやける','両辺を1920 px以内にするため倍率が4倍未満に下がり、元の1ピクセルあたりのピクセルが減りました','メモに「(2× nearest)」のように倍率が出ます','アニメーションを小さく分けて書き出すか、2倍で妥協してください'],
    ['サイトがファイルを受け付けない','WebMではなくMP4（H.264）しか受け付けません','アップロードのヘルプにある形式一覧','上のとおりffmpegで変換してください']]},
   alternatives:{rows:[
    ['同じパネルの[[game/sprite-sheet-to-gif|Animated GIF]]やAPNG','透明が大事なチャットや掲示板への投稿。APNGは柔らかい縁と正確な色を保ちます。'],
    ['フローティングプレビュー（F7、最大8倍）を画面録画','好きな背景、複数のアニメーションを並べる、長い録画が必要なとき。'],
    ['PNGフレームを書き出して動画編集ソフトで作る','MP4を直接、好きなフレームレートや音付きで作りたいとき。[[game/sprite-sheet-to-png-frames|スプライトシートをPNGフレームに]]を参照。']]},
   limits:['WebMのみです。MP4と音声トラックはありません。','背景色と倍率は固定です：rgb(32, 34, 40)、両辺が1920 px以内なら4倍。','1ファイル1サイクルで、繰り返し回数は保存しません。'],
   versions:{body:['WebM書き出しはChromiumで確認しました。ファイルがWebM（EBML）ヘッダーで始まり、ffprobeが動画ストリームとフレームを読み、Chromiumが6 × 100 msのアニメーションを4倍サイズで0.6秒再生しました。エンコーダはブラウザ自身のものなので、VP9になるかVP8になるかはブラウザ次第です。VideoEncoderの対応状況はMDN、ffmpegのオプションはffmpeg公式ドキュメントに基づきます。'],sources:[MDN_ENCODER,FFMPEG,FFMPEG_CODECS]}
  }
 },
/* ============================================================================ fnf-spritesheet-to-gif */
 'game/fnf-spritesheet-to-gif':{
  type:'conversion',
  intent:{primary:'convert a Friday Night Funkin\' character spritesheet (PNG + XML) into animated GIFs',secondary:['FNF sprite XML to GIF','preview FNF animations','set the right FNF frame rate'],
   goal:'one GIF per character animation at the game\'s frame rate, frames aligned by their trim offsets',input:'character PNG + its Sparrow/Starling XML',output:'ZIP with one GIF (or APNG, or WebM) per animation prefix',target:'sharing a preview of an FNF character (browsers, chats, wikis)',support:'partial',
   evidence:['src/studio/sprite/atlas-data.js (Starling XML: frameX/Y negated, frameWidth/Height, pivotX/Y, rotated flag, 100 ms, name grouping)','src/studio/sprite/import-plan.js frameKey (trailing digits = frame number)','src/game/export/anim.js + bundle.js (GIF per animation, pivot cell, file names via stemOf)','docs/STUDIO-SPRITE.md (rotated atlas frames UNVERIFIED)'],
   external:['Starling TextureAtlas XML (frameX/Y, rotated 90° clockwise)','FNF modding docs: renderType sparrow, assetPath, prefix, frameRate default 24, frameIndices, looped, offsets']},
  en:{
   answer:"A Friday Night Funkin' character is a PNG plus a Sparrow (Starling) XML atlas: each `SubTexture` is one frame, and frames that share a name prefix (`BF idle dance0000`, `…0001`) form one animation. Drop both files: Nerulio groups the prefixes into animations, keeps the trim offsets, and exports one GIF (or APNG, or WebM) per animation. The XML has no timing, so set each animation to the character's `frameRate` (24 fps when the character file gives none); a GIF stores 41.67 ms as 40 ms.",
   concept:{title:'How FNF describes a character\'s frames',body:[
    "The XML format comes from the Sparrow and Starling frameworks. Each `SubTexture` names a rectangle of the PNG (`x`, `y`, `width`, `height`). A trimmed frame adds `frameX`, `frameY`, `frameWidth` and `frameHeight`: the full frame size and where the trimmed rectangle sits inside it, written as negative numbers, so `frameX=\"-3\"` means 3 px from the left. `rotated=\"true\"` means the region was turned 90° clockwise on the sheet.",
    "The game adds a JSON file per character in `data/characters`. With `renderType` `sparrow`, `assetPath` points at the PNG and XML (same name, no extension), and each animation lists a `prefix` (the SubTexture name without its frame number), a `frameRate` (24 by default) and optionally `frameIndices`, `looped` and `offsets`. The timing is therefore not in the XML.",
    "Nerulio reads only the PNG and the XML. It groups names by stripping the trailing frame number, keeps every frame at its place inside `frameWidth` × `frameHeight`, and starts at 100 ms per frame. The character JSON is not read, so the rate, the frame subset and the loop setting are yours to set."],
    terms:[['SubTexture','One frame: its name and its rectangle on the PNG.'],['Prefix','The animation name the game looks up: the SubTexture name without the trailing frame number.'],['frameX / frameY','Negative offsets of the trimmed rectangle inside the full frame.'],['frameRate','Frames per second of an animation in the character JSON; 24 when not given.']]},
   example:{title:'Example: one SubTexture and the timing maths',lines:[
    '<SubTexture name="BF idle dance0003" x="1024" y="0" width="402" height="390"',
    '            frameX="-3" frameY="-2" frameWidth="408" frameHeight="394"/>',
    '',
    'animation   "BF idle dance", 4th frame (0003)',
    'region      402 × 390 at (1024, 0) on the PNG',
    'full frame  408 × 394, region drawn at (3, 2)',
    'timing      24 fps → 1000 / 24 = 41.67 ms per frame',
    'GIF         41.67 ms → 4 /100 s = 40 ms',
    '14 frames   583 ms in the game → 560 ms in the GIF (4 % faster); APNG writes 42 ms → 588 ms'],
    after:'The numbers are an illustration; your character\'s XML has its own. The rounding rule is fixed: GIF keeps whole hundredths, APNG whole milliseconds.'},
   mapping:{head:['In the XML / character JSON','In Nerulio','In the GIF'],rows:[
    ['SubTexture name prefix','One animation per prefix, frames in natural order','One file per animation'],
    ['x, y, width, height','The frame\'s region on the PNG','Frame pixels'],
    ['frameX, frameY, frameWidth, frameHeight','Offset inside the full frame','Trimmed frames stay in place'],
    ['pivotX, pivotY (if present)','Frame pivot; otherwise the bottom centre of the full frame','Frames aligned on the pivot'],
    ['rotated="true"','Imported still turned; its export is UNVERIFIED','—'],
    ['frameRate (character JSON)','Not read: frames start at 100 ms','Set it with Set all to fps before export'],
    ['frameIndices, looped, offsets (character JSON)','Not read','Make a tag over the frames you need; repeat ×1 for a non-looping animation']]},
   outputs:{rows:[
    ['bf_gif.zip','The download for the export name `bf`, with a folder `bf_gif/`.'],
    ['bf_gif/bf_BF_idle_dance.gif','One animation. Spaces and other characters outside letters, digits, dot and hyphen become `_` in the file name.']]},
   target:{title:'Match the game\'s timing, then export',steps:[
    'Open the character\'s JSON in `data/characters/` and note, per animation, the `prefix`, `frameRate` (24 if missing), `frameIndices` and `looped`.',
    'In Nerulio select the tag with that prefix and use Set all to fps with the `frameRate`: 24 fps gives 41.67 ms per frame.',
    'If the animation uses `frameIndices`, drag a new tag over just those frames; if `looped` is false, set its repeat to ×1.',
    'Press Enter to preview; onion skin (F3) shows whether the trimmed frames line up.',
    'Open Pack & Export, choose Animated GIF (or APNG for exact colours and soft edges) and export: one file per animation.']},
   verify:{steps:[
    'The number of frames in a GIF equals the number of SubTextures with that prefix, or the length of `frameIndices`.',
    'A 14-frame animation at 24 fps loops about every 0.56 s in the GIF (14 × 40 ms).',
    'Step with `,` and `.`: the character\'s feet stay in place when the offsets were read correctly.']},
   trouble:{rows:[
    ['The GIF plays at the wrong speed','Sparrow XML has no timing, so every frame started at 100 ms','The Frame panel shows 100 ms','Set all to fps with the JSON\'s `frameRate` (24 by default)'],
    ['Two animations merged into one','Their prefixes differ only by a trailing digit: `left20000` reads as prefix `left`, frame 20000','Import panel: how the names were grouped','Drag tags on the Timeline to split the frames by hand'],
    ['Some frames are sideways','Their SubTexture has `rotated="true"`; the Studio keeps them as they lie on the sheet','Search the XML for `rotated`','Repack the character without rotation in the tool that made it; exporting rotated frames is UNVERIFIED'],
    ['Frames are missing','Their rectangles lie outside the PNG, usually an XML from another version of the sheet','The Import panel counts frames outside the image','Use the PNG that belongs to this XML'],
    ['Colours band or look posterised','Hi-res FNF art has far more than 255 colours; GIF\'s palette is reduced by median cut without dithering','The export note “More than 255 colours”','Export APNG (exact) or WebM video']]},
   alternatives:{rows:[
    ['APNG from the same export','Exact colours, soft edges and millisecond timing: 24 fps becomes 42 ms per frame instead of 40.'],
    ['[[game/sparrow-xml-spritesheet|Repack as Sparrow XML]]','You want to change or repack the character for the game rather than share a preview.'],
    ['Record the game itself','You need the character with in-game offsets, camera and music.']]},
   limits:['The character JSON (`frameRate`, `frameIndices`, `looped`, `offsets`) is not read.','Adobe Animate texture atlases (`animateatlas`) and Packer TXT sheets are not read; only Sparrow XML.','No real FNF character is part of the recorded checks.'],
   versions:{body:['The XML reader is the Studio\'s general atlas importer, run on real assets through the UI (atlas data included); no actual FNF character is part of the recorded checks, and rotated frames stay UNVERIFIED. GIF output is checked by decoding with Pillow. The format description follows the Starling documentation; the character fields follow the official Friday Night Funkin\' modding documentation.'],sources:[STARLING,FNF_CHAR,GIF_SPEC]}
  },
  ko:{
   answer:'프라이데이 나이트 펑킨(FNF) 캐릭터는 PNG와 Sparrow(Starling) XML 아틀라스로 되어 있습니다. `SubTexture` 하나가 프레임 하나이고, 이름 앞부분이 같은 프레임(`BF idle dance0000`, `…0001`)이 애니메이션 하나를 이룹니다. 두 파일을 함께 넣으면 Nerulio가 앞부분별로 애니메이션을 묶고 트림 오프셋을 유지해, 애니메이션마다 GIF(또는 APNG, WebM)를 하나씩 내보냅니다. XML에는 타이밍이 없으니 애니메이션마다 캐릭터의 `frameRate`(캐릭터 파일에 없으면 24 fps)를 설정하세요. GIF는 41.67 ms를 40 ms로 저장합니다.',
   concept:{title:'FNF가 캐릭터 프레임을 적는 방식',body:[
    '이 XML 형식은 Sparrow와 Starling 프레임워크에서 왔습니다. `SubTexture`마다 PNG의 사각형(`x`, `y`, `width`, `height`)을 가리킵니다. 트림된 프레임에는 `frameX`, `frameY`, `frameWidth`, `frameHeight`가 더 붙습니다. 원래 프레임 크기와 그 안에서 잘린 사각형의 위치이며, 음수로 적으므로 `frameX="-3"`은 왼쪽에서 3 px 떨어졌다는 뜻입니다. `rotated="true"`는 시트에서 그 영역을 시계 방향으로 90° 돌려 놓았다는 뜻입니다.',
    '게임은 캐릭터마다 `data/characters`에 JSON 파일을 둡니다. `renderType`이 `sparrow`면 `assetPath`가 PNG와 XML(같은 이름, 확장자 없이)을 가리키고, 애니메이션마다 `prefix`(프레임 번호를 뺀 SubTexture 이름), `frameRate`(기본 24), 그리고 선택적으로 `frameIndices`, `looped`, `offsets`가 있습니다. 즉 타이밍은 XML에 없습니다.',
    'Nerulio는 PNG와 XML만 읽습니다. 이름 끝의 프레임 번호를 떼어 묶고, 모든 프레임을 `frameWidth` × `frameHeight` 안의 제자리에 두며, 프레임당 100 ms로 시작합니다. 캐릭터 JSON은 읽지 않으므로 속도, 프레임 부분 집합, 반복 설정은 직접 정해야 합니다.'],
    terms:[['SubTexture','프레임 하나. 이름과 PNG 위의 사각형.'],['접두사(prefix)','게임이 찾는 애니메이션 이름. SubTexture 이름에서 끝의 프레임 번호를 뺀 부분.'],['frameX / frameY','원래 프레임 안에서 잘린 사각형의 위치를 나타내는 음수 오프셋.'],['frameRate','캐릭터 JSON에 적힌 애니메이션의 초당 프레임 수. 없으면 24.']]},
   example:{title:'예시: SubTexture 하나와 타이밍 계산',lines:[
    '<SubTexture name="BF idle dance0003" x="1024" y="0" width="402" height="390"',
    '            frameX="-3" frameY="-2" frameWidth="408" frameHeight="394"/>',
    '',
    '애니메이션  "BF idle dance", 4번째 프레임 (0003)',
    '영역        PNG의 (1024, 0)에서 402 × 390',
    '원래 프레임 408 × 394, 영역을 (3, 2)에 그림',
    '타이밍      24 fps → 1000 / 24 = 41.67 ms / 프레임',
    'GIF         41.67 ms → 4 /100 s = 40 ms',
    '14프레임    게임 583 ms → GIF 560 ms (4 % 빠름), APNG는 42 ms → 588 ms'],
    after:'숫자는 설명용이며 실제 캐릭터 XML에는 제 값이 있습니다. 반올림 규칙은 고정입니다. GIF는 1/100초 단위, APNG는 밀리초 단위로 저장합니다.'},
   mapping:{head:['XML / 캐릭터 JSON에서','Nerulio에서','GIF에서'],rows:[
    ['SubTexture 이름 접두사','접두사마다 애니메이션 하나, 자연 정렬 순서','애니메이션마다 파일 하나'],
    ['x, y, width, height','PNG 위 프레임 영역','프레임 픽셀'],
    ['frameX, frameY, frameWidth, frameHeight','원래 프레임 안의 오프셋','트림된 프레임이 제자리에 있음'],
    ['pivotX, pivotY (있을 때)','프레임 피벗, 없으면 원래 프레임의 아래 가운데','피벗에 맞춰 정렬'],
    ['rotated="true"','돌아간 채로 가져옴, 내보내기는 미검증(UNVERIFIED)','—'],
    ['frameRate (캐릭터 JSON)','읽지 않음: 프레임당 100 ms로 시작','내보내기 전에 fps로 일괄 설정'],
    ['frameIndices, looped, offsets (캐릭터 JSON)','읽지 않음','필요한 프레임에 태그를 만들고, 반복하지 않는 애니메이션은 반복 ×1']]},
   outputs:{rows:[
    ['bf_gif.zip','내보내기 이름이 `bf`일 때 내려받는 파일. 안에 `bf_gif/` 폴더가 있습니다.'],
    ['bf_gif/bf_BF_idle_dance.gif','애니메이션 하나. 파일 이름에서 영문자·숫자·점·하이픈이 아닌 문자는 `_`가 됩니다.']]},
   target:{title:'게임 타이밍에 맞춘 뒤 내보내기',steps:[
    '`data/characters/`의 캐릭터 JSON을 열어 애니메이션마다 `prefix`, `frameRate`(없으면 24), `frameIndices`, `looped`를 적어 둡니다.',
    'Nerulio에서 그 접두사의 태그를 고르고 `frameRate` 값으로 fps 일괄 설정을 합니다. 24 fps면 프레임당 41.67 ms입니다.',
    '`frameIndices`를 쓰는 애니메이션이면 해당 프레임에만 새 태그를 드래그해 만들고, `looped`가 false면 반복을 ×1로 합니다.',
    'Enter로 미리 보세요. 어니언 스킨(F3)으로 트림된 프레임이 제자리에 맞는지 볼 수 있습니다.',
    '패킹·내보내기에서 Animated GIF(정확한 색과 부드러운 가장자리가 필요하면 APNG)를 골라 내보내면 애니메이션마다 파일이 하나씩 나옵니다.']},
   verify:{steps:[
    'GIF의 프레임 수는 그 접두사를 가진 SubTexture 수, 또는 `frameIndices`의 길이와 같아야 합니다.',
    '24 fps인 14프레임 애니메이션은 GIF에서 약 0.56초마다 반복됩니다(14 × 40 ms).',
    '`,`와 `.`로 넘겨 보세요. 오프셋이 제대로 읽혔다면 캐릭터의 발이 제자리에 있습니다.']},
   trouble:{rows:[
    ['GIF 속도가 틀림','Sparrow XML에는 타이밍이 없어 모든 프레임이 100 ms로 시작했습니다','프레임 패널에 100 ms가 보입니다','JSON의 `frameRate`(기본 24)로 fps 일괄 설정을 하세요'],
    ['애니메이션 두 개가 하나로 합쳐짐','접두사가 끝자리 숫자만 다릅니다. `left20000`은 접두사 `left`, 프레임 20000으로 읽힙니다','가져오기 패널: 이름을 어떻게 묶었는지','타임라인에서 태그를 드래그해 직접 나누세요'],
    ['일부 프레임이 옆으로 누움','SubTexture에 `rotated="true"`가 있어 Studio가 시트에 놓인 그대로 둡니다','XML에서 `rotated`를 검색합니다','만든 도구에서 회전 없이 다시 패킹하세요. 회전된 프레임 내보내기는 미검증입니다'],
    ['프레임이 빠짐','사각형이 PNG 밖에 있습니다. 보통 다른 버전 시트의 XML입니다','가져오기 패널이 이미지 밖 프레임 수를 알려 줍니다','이 XML과 짝인 PNG를 쓰세요'],
    ['색 띠가 생기거나 포스터처럼 보임','고해상도 FNF 그림은 색이 255개보다 훨씬 많아, GIF 팔레트를 디더링 없는 메디안 컷으로 줄였습니다','“More than 255 colours” 안내','APNG(정확)나 WebM 동영상으로 내보내세요']]},
   alternatives:{rows:[
    ['같은 내보내기의 APNG','정확한 색, 부드러운 가장자리, 밀리초 타이밍. 24 fps는 프레임당 40 ms가 아니라 42 ms가 됩니다.'],
    ['[[game/sparrow-xml-spritesheet|Sparrow XML로 다시 패킹]]','미리보기 공유가 아니라 게임용으로 캐릭터를 고치거나 다시 묶고 싶을 때.'],
    ['게임 화면을 직접 녹화','게임 안의 오프셋, 카메라, 음악까지 함께 보여 줘야 할 때.']]},
   limits:['캐릭터 JSON(`frameRate`, `frameIndices`, `looped`, `offsets`)은 읽지 않습니다.','Adobe Animate 텍스처 아틀라스(`animateatlas`)와 Packer TXT 시트는 읽지 않고, Sparrow XML만 읽습니다.','실제 FNF 캐릭터는 기록된 검증에 포함되지 않았습니다.'],
   versions:{body:['XML 읽기는 Studio의 범용 아틀라스 가져오기로, 실제 에셋을 UI로 가져오는 검증(아틀라스 데이터 포함)을 거쳤습니다. 실제 FNF 캐릭터는 기록된 검증에 없고, 회전된 프레임은 미검증입니다. GIF 결과는 Pillow로 디코딩해 확인합니다. 형식 설명은 Starling 문서, 캐릭터 필드는 FNF 공식 모딩 문서를 따릅니다.'],sources:[STARLING,FNF_CHAR,GIF_SPEC]}
  },
  ja:{
   answer:'Friday Night Funkin\'（FNF）のキャラクターは、PNGとSparrow（Starling）形式のXMLアトラスでできています。`SubTexture`1つが1フレームで、名前の前半が同じフレーム（`BF idle dance0000`、`…0001`）が1つのアニメーションになります。2つのファイルを一緒にドロップすると、Nerulioが前半部分ごとにアニメーションをまとめ、トリムのオフセットを保ったまま、アニメーションごとにGIF（またはAPNG、WebM）を1つ書き出します。XMLにタイミングはないので、アニメーションごとにキャラクターの`frameRate`（キャラクターファイルになければ24 fps）を設定してください。GIFでは41.67 msが40 msになります。',
   concept:{title:'FNFがキャラクターのフレームを記述する方法',body:[
    'このXML形式はSparrowとStarlingフレームワークに由来します。各`SubTexture`はPNG上の矩形（`x`、`y`、`width`、`height`）を指します。トリムされたフレームには`frameX`、`frameY`、`frameWidth`、`frameHeight`が加わります。元のフレームサイズと、その中での切り抜き矩形の位置で、負の数で書くので`frameX="-3"`は左から3 pxという意味です。`rotated="true"`はその領域がシート上で時計回りに90°回されていることを示します。',
    'ゲーム側はキャラクターごとに`data/characters`にJSONを置きます。`renderType`が`sparrow`なら`assetPath`がPNGとXML（同名、拡張子なし）を指し、アニメーションごとに`prefix`（フレーム番号を除いたSubTexture名）、`frameRate`（既定24）、任意で`frameIndices`、`looped`、`offsets`を持ちます。つまりタイミングはXMLにはありません。',
    'Nerulioが読むのはPNGとXMLだけです。名前の末尾のフレーム番号を外してまとめ、全フレームを`frameWidth` × `frameHeight`の中の元の位置に置き、1フレーム100 msから始めます。キャラクターJSONは読まないので、速度、使うフレーム、ループ設定は自分で決めます。'],
    terms:[['SubTexture','1フレーム。名前とPNG上の矩形。'],['プレフィックス','ゲームが探すアニメーション名。SubTexture名から末尾のフレーム番号を除いた部分。'],['frameX / frameY','元のフレーム内での切り抜き矩形の位置を示す負のオフセット。'],['frameRate','キャラクターJSONにあるアニメーションの毎秒フレーム数。なければ24。']]},
   example:{title:'具体例：SubTexture 1つとタイミングの計算',lines:[
    '<SubTexture name="BF idle dance0003" x="1024" y="0" width="402" height="390"',
    '            frameX="-3" frameY="-2" frameWidth="408" frameHeight="394"/>',
    '',
    'アニメーション "BF idle dance"、4番目のフレーム (0003)',
    '領域          PNG の (1024, 0) から 402 × 390',
    '元のフレーム  408 × 394、領域を (3, 2) に描く',
    'タイミング    24 fps → 1000 / 24 = 41.67 ms / フレーム',
    'GIF           41.67 ms → 4 /100 s = 40 ms',
    '14フレーム    ゲーム 583 ms → GIF 560 ms (4 % 速い)、APNG は 42 ms → 588 ms'],
    after:'数値は説明用で、実際のキャラクターのXMLには固有の値があります。丸めの規則は固定です。GIFは1/100秒単位、APNGはミリ秒単位で保存します。'},
   mapping:{head:['XML／キャラクターJSONでは','Nerulioでは','GIFでは'],rows:[
    ['SubTexture名のプレフィックス','プレフィックスごとに1アニメーション、自然順','アニメーションごとに1ファイル'],
    ['x, y, width, height','PNG上のフレーム領域','フレームのピクセル'],
    ['frameX, frameY, frameWidth, frameHeight','元のフレーム内のオフセット','トリムされたフレームが元の位置に'],
    ['pivotX, pivotY（あれば）','フレームのピボット、なければ元フレームの下中央','ピボットで揃える'],
    ['rotated="true"','回転したまま読み込み、書き出しは未検証（UNVERIFIED）','—'],
    ['frameRate（キャラクターJSON）','読まない：1フレーム100 msから開始','書き出し前にfpsで一括設定'],
    ['frameIndices, looped, offsets（キャラクターJSON）','読まない','必要なフレームにタグを作り、ループしないものは繰り返し×1']]},
   outputs:{rows:[
    ['bf_gif.zip','書き出し名が`bf`のときのダウンロード。中に`bf_gif/`フォルダがあります。'],
    ['bf_gif/bf_BF_idle_dance.gif','アニメーション1つ。ファイル名では英数字・ドット・ハイフン以外の文字が`_`になります。']]},
   target:{title:'ゲームのタイミングに合わせて書き出す',steps:[
    '`data/characters/`のキャラクターJSONを開き、アニメーションごとに`prefix`、`frameRate`（なければ24）、`frameIndices`、`looped`を控えます。',
    'Nerulioでそのプレフィックスのタグを選び、`frameRate`の値でfps一括設定をします。24 fpsなら1フレーム41.67 msです。',
    '`frameIndices`を使うアニメーションなら、そのフレームだけに新しいタグをドラッグで作り、`looped`がfalseなら繰り返しを×1にします。',
    'Enterでプレビューします。オニオンスキン（F3）でトリムされたフレームが揃っているか確認できます。',
    'パック＆書き出しでAnimated GIF（正確な色と柔らかい縁が要るならAPNG）を選んで書き出すと、アニメーションごとに1ファイルになります。']},
   verify:{steps:[
    'GIFのフレーム数は、そのプレフィックスを持つSubTextureの数、または`frameIndices`の長さと同じはずです。',
    '24 fpsの14フレームのアニメーションは、GIFでは約0.56秒ごとにループします（14 × 40 ms）。',
    '`,`と`.`で送ってみます。オフセットが正しく読めていればキャラクターの足元は動きません。']},
   trouble:{rows:[
    ['GIFの速度が違う','Sparrow XMLにはタイミングがなく、全フレームが100 msで始まりました','フレームパネルに100 msと出ます','JSONの`frameRate`（既定24）でfps一括設定をしてください'],
    ['2つのアニメーションが1つにまとまる','プレフィックスが末尾の数字しか違いません。`left20000`はプレフィックス`left`、フレーム20000と読まれます','インポートパネル：名前のまとめ方','タイムラインでタグをドラッグして手で分けてください'],
    ['一部のフレームが横倒しになる','SubTextureに`rotated="true"`があり、Studioはシート上の向きのまま保持します','XMLで`rotated`を検索します','作ったツールで回転なしにパックし直してください。回転フレームの書き出しは未検証です'],
    ['フレームが足りない','矩形がPNGの外にあります。多くは別バージョンのシートのXMLです','インポートパネルが画像外のフレーム数を示します','このXMLと対になるPNGを使ってください'],
    ['色の帯やポスタリゼーションが出る','高解像度のFNFの絵は255色をはるかに超え、GIFのパレットをディザなしのメディアンカットで減らしました','「More than 255 colours」のメモ','APNG（正確）かWebM動画で書き出してください']]},
   alternatives:{rows:[
    ['同じ書き出しのAPNG','正確な色、柔らかい縁、ミリ秒のタイミング。24 fpsは1フレーム40 msではなく42 msになります。'],
    ['[[game/sparrow-xml-spritesheet|Sparrow XMLとしてパックし直す]]','プレビューの共有ではなく、ゲーム用にキャラクターを直したり詰め直したりしたいとき。'],
    ['ゲーム画面を直接録画','ゲーム内のオフセット、カメラ、音楽まで一緒に見せたいとき。']]},
   limits:['キャラクターJSON（`frameRate`、`frameIndices`、`looped`、`offsets`）は読みません。','Adobe Animateのテクスチャアトラス（`animateatlas`）とPackerのTXTシートは読まず、Sparrow XMLだけを読みます。','実際のFNFキャラクターは記録された検証に含まれていません。'],
   versions:{body:['XMLの読み込みはStudio共通のアトラス取り込みで、実際のアセットをUIから読み込む検証（アトラスデータを含む）を経ています。実際のFNFキャラクターは記録された検証になく、回転フレームは未検証です。GIFの出力はPillowでデコードして確認しています。形式の説明はStarlingのドキュメント、キャラクターの項目はFNF公式のModdingドキュメントに基づきます。'],sources:[STARLING,FNF_CHAR,GIF_SPEC]}
  }
 },
//@@NEXT
};
