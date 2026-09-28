/** Intent content for the pack pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/pack/*, src/game/export/* (targets.js: which engine may rotate),
 * src/studio/sprite/atlas-data.js (TexturePacker JSON / Starling XML import), docs/STUDIO-PACK.md,
 * docs/STUDIO-PACK-H2H.md, docs/H2H-PAID.md, docs/ENGINE-VERIFY.md and
 * tools/engine-verify/results/pixi-scale-2026-09-24.json. Every atlas number in the examples is the
 * real output of the exporters on the six CC0 ninja frames in tests/fixtures/game/corpus/ninja
 * (40 × 29 px each; the same frames as the "ninja" set of the head-to-heads). Engine behaviour: the
 * official docs and sources cited in each page's `versions.sources`. */
const S={
 phaserLoader:'[Phaser docs: LoaderPlugin (atlas, multiatlas, atlasXML)](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)',
 phaserAnims:'[Phaser docs: AnimationManager (create, fromJSON, generateFrameNames)](https://docs.phaser.io/api-documentation/class/animations-animationmanager)',
 phaserCore:'[Phaser docs: game config (pixelArt)](https://docs.phaser.io/api-documentation/typedef/types-core)',
 phaserAnimSrc:'[Phaser 3.90 source: Animation.js](https://github.com/phaserjs/phaser/blob/v3.90.0/src/animations/Animation.js)',
 phaserXmlSrc:'[Phaser 3.90 source: AtlasXML parser](https://github.com/phaserjs/phaser/blob/v3.90.0/src/textures/parsers/AtlasXML.js)',
 phaserHashSrc:'[Phaser 3.90 source: JSONHash parser](https://github.com/phaserjs/phaser/blob/v3.90.0/src/textures/parsers/JSONHash.js)',
 pixiSheet:'[PixiJS API: Spritesheet](https://pixijs.download/release/docs/assets.Spritesheet.html)',
 pixiAnim:'[PixiJS API: AnimatedSprite](https://pixijs.download/release/docs/scene.AnimatedSprite.html)',
 pixiSource:'[PixiJS API: TextureSource](https://pixijs.download/release/docs/rendering.TextureSource.html)',
 loveSrc:'[LÖVE 11.5 source: newQuad, draw, setDefaultFilter](https://github.com/love2d/love/blob/11.5/src/modules/graphics/wrap_Graphics.cpp)',
 loveWiki:'[LÖVE wiki: love.graphics.newQuad](https://love2d.org/wiki/love.graphics.newQuad)',
 defoldAtlas:'[Defold manual: Atlas](https://defold.com/manuals/atlas/)',
 defoldTile:'[Defold manual: Tile source](https://defold.com/manuals/tilesource/)',
 defoldSprite:'[Defold API: sprite.play_flipbook](https://defold.com/ref/sprite/)',
 defoldProject:'[Defold manual: Project settings](https://defold.com/manuals/project-settings/)',
 spineAtlas:'[Spine docs: Texture atlas format](https://esotericsoftware.com/spine-atlas-format)',
 spinePacker:'[Spine docs: Texture packing](https://esotericsoftware.com/spine-texture-packer)',
 tpSettings:'[TexturePacker docs: Texture settings](https://www.codeandweb.com/texturepacker/documentation/texture-settings)',
 tpExporter:'[TexturePacker docs: Custom exporter (sprite values)](https://www.codeandweb.com/texturepacker/documentation/custom-exporter)',
 tpGodot:'[CodeAndWeb: TexturePacker and Godot](https://www.codeandweb.com/texturepacker/tutorials/how-to-create-sprite-sheets-for-godot)',
 tpFree:'[CodeAndWeb: free sprite sheet packer](https://www.codeandweb.com/free-sprite-sheet-packer)',
 ftp:'[free-tex-packer-core (official repository)](https://github.com/odrick/free-tex-packer-core)',
 aseCli:'[Aseprite docs: command line (sheet options)](https://www.aseprite.org/docs/cli/)',
 mdnRendering:'[MDN: image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering)',
 mdnPosition:'[MDN: background-position](https://developer.mozilla.org/en-US/docs/Web/CSS/background-position)',
 godotAtlas:'[Godot 4.7 docs: AtlasTexture](https://docs.godotengine.org/en/stable/classes/class_atlastexture.html)',
 godotFrames:'[Godot 4.7 docs: SpriteFrames](https://docs.godotengine.org/en/stable/classes/class_spriteframes.html)',
 godotSprite:'[Godot 4.7 docs: AnimatedSprite2D](https://docs.godotengine.org/en/stable/classes/class_animatedsprite2d.html)',
 unitySprite:'[Unity 6 manual: Sprite texture import settings](https://docs.unity3d.com/Manual/texture-type-sprite.html)'
};
/** The run_0 entry of the Phaser / Generic JSON export of the ninja frames (page 38 × 50). */
const RUN0=['"run_0": { "frame": {"x":0,"y":34,"w":18,"h":15},','           "spriteSourceSize": {"x":10,"y":10,"w":18,"h":15},','           "sourceSize": {"w":40,"h":29}, "rotated": false, "trimmed": true }'];
export default {
 'sprite-sheet-maker':{
  type:'create',
  intent:{primary:'make a sprite sheet (texture atlas) from separate frame images',secondary:['grid sheet or packed atlas','trim, padding and extrude settings','get the data file the engine reads'],
   goal:'one PNG page (or a few) plus a data file that names every frame and its rectangle, loadable in the target engine',input:'numbered frame PNGs, a folder, a GIF, an .aseprite file or an existing sheet',output:'atlas PNG page(s) + engine data file (JSON, XML, .atlas, Lua, .tres, .unity.json, CSS …)',target:'17 export targets (Godot 4, Unity 6, Phaser 3/4, PixiJS 8, Spine, LÖVE, Defold, CSS …)',support:'full',
   evidence:['src/game/pack/layout.js (padding and extrude geometry)','src/game/pack/packer.js (defaults: trim, padding 2, extrude 0)','src/game/export/targets.js (rotation per engine)','docs/STUDIO-PACK.md','docs/STUDIO-PACK-H2H.md (ninja 38×50, opaque area 1,591)'],
   external:['TexturePacker docs: shape padding, extrude','Aseprite CLI: --sheet-pack, --trim, --merge-duplicates','Spine docs: texture packing']},
  en:{
   answer:'A sprite sheet puts many frames on one image so a game loads one texture instead of dozens; a packed atlas also writes a data file that names every frame and gives its rectangle. Drop numbered PNGs, a GIF or an .aseprite file, pick your engine\'s preset, and Nerulio packs the frames in your browser (MaxRects, trim on, 2 px padding by default) and exports the PNG with that engine\'s data file. For a plain grid of equal cells, the classic maker is linked further down.',
   concept:{title:'Grid sheet or packed atlas',body:[
    'A grid sheet gives every frame the same cell, so an engine finds frame n by arithmetic: column = n mod columns, row = n ÷ columns, rounded down. It needs no data file, but every cell is as large as the largest frame, transparent border included.',
    'A packed atlas trims each frame to its visible pixels and fits the pieces wherever they fit. Positions are no longer predictable, so the packer writes a data file: for each frame its name, where the stored pixels are on the page (`frame`), where they sat on the original canvas (`spriteSourceSize`), the original canvas size (`sourceSize`) and whether the piece lies turned by 90° (`rotated`). The engine uses those numbers to draw the frame at full size, so a trimmed frame does not move.',
    'Two settings protect the edges. Shape padding leaves transparent pixels between frames, and extrude repeats each frame\'s outermost pixels around it, so a texture filter that samples just past an edge reads the same colour instead of a neighbour. Rotation saves a little area, but only some engines turn a rotated frame back; Nerulio\'s presets allow it only for PixiJS and Spine, where the engine runs drew rotated frames correctly.'],
    terms:[['Page','One atlas image. Frames that do not fit the maximum size go on further pages (multipack, up to 64).'],['Trim','Cutting the transparent border off a frame and recording the offset, so it is drawn at its old place.'],['Shape padding','Transparent pixels between two frames: 2 px by default.'],['Extrude','Copies of a frame\'s edge pixels placed around it: 0 by default, 1 in the LÖVE preset.'],['Alias','Frames with identical visible pixels share one stored region.']]},
   example:{title:'Example: six 40 × 29 running frames',lead:'The six frames of a CC0 ninja run cycle (40 × 29 px each, mostly transparent), packed by Nerulio with the Phaser preset (trim on, padding 2, no rotation) and compared with other layouts:',lines:[
    'layout                           page        area        vs strip',
    'horizontal strip, 6 × 40 px      240 × 29    6,960 px²   100 %',
    'packed, trim off, padding 2       82 × 91    7,462 px²   107 %',
    'packed, trim on, padding 2        38 × 50    1,900 px²    27 %',
    'packed, trim on, rotation         33 × 57    1,881 px²    27 %',
    '',
    'visible pixels (6 bounding boxes)             1,591 px²',
    'share of the trimmed page used     1,591 / 1,900 = 0.84',
    '',
    ...RUN0],
    after:'Only 18 × 15 pixels of run_0 are stored; the engine draws them 10 px right and 10 px down inside a 40 × 29 box, exactly where they were. Trim does the saving here: without it the packed page is slightly larger than a plain strip, because padding is added between frames.'},
   target:{title:'Load the sheet in your engine',steps:[
    'Export for the engine you use and keep the PNG and its data file together; the data names its image (`meta.image` in JSON, `imagePath` in XML, the page line in a Spine .atlas).',
    'Phaser: `this.load.atlas("run", "run.png", "run.json")`, then `this.add.sprite(x, y, "run", "run_0")`; details on [[game/phaser-texture-atlas|the Phaser atlas page]].',
    'PixiJS 8: `const sheet = await Assets.load("run.json")`, then `sheet.textures["run_0"]` or `sheet.animations["run"]`; see [[game/pixi-spritesheet-json|PixiJS spritesheet JSON]].',
    'Godot 4 and Unity 6 get a ready resource or an importer script instead of a bare atlas: see [[game/godot-sprite-sheet|sprite sheets in Godot]] and [[game/unity-sprite-sheet|sprite sheets in Unity]].',
    'LÖVE, Defold, Spine / libGDX and CSS each have their own format: [[game/love2d-quads|LÖVE quads]], [[game/defold-atlas|Defold atlas]], [[game/spine-atlas|Spine atlas]], [[game/css-sprite-generator|CSS sprites]].']},
   verify:{steps:[
    'Read the used share in Pack & Export: 0.84 means 84 % of the page is visible frame area. A low figure usually means trim is off or one frame is much larger than the rest.',
    'Hover the rows of the Packed frames list: each shows canvas → stored size, its page and flags such as trimmed, rotated or "same as" (an alias).',
    'In the engine, draw one trimmed frame at the same point as its untrimmed neighbour; if it is shifted, the loader ignores `spriteSourceSize` (see troubleshooting).']},
   trouble:{rows:[
    ['Frames jump or wobble while the animation plays','Trimmed frames drawn without their offset: the loader or your code uses `frame` but ignores `spriteSourceSize` and `sourceSize`','Draw two frames with different trims at one point; they should line up','Use a loader that reads trim data, or pack with trim off (larger page); more in [[game/sprite-jitter-after-trim|jitter after trimming]]'],
    ['Thin lines or colour fringes at frame edges when the sprite is scaled or moves by fractions of a pixel','The texture filter reads pixels just outside the frame: a neighbour, or transparent padding','Zoom in on the edge: the line has a neighbour\'s colour, or is see-through','Keep shape padding at 2 or more, add extrude 1, use nearest filtering for pixel art; see [[atlas-padding|atlas padding]]'],
    ['Some frames appear sideways, mirrored or clipped','Rotation was allowed for an engine or loader that does not turn frames back','Those entries have `"rotated": true`','Pack with rotation off; Nerulio\'s Godot, Unity, Phaser, LÖVE, XML and CSS exports refuse a rotated pack'],
    ['An error says sprites do not fit the page','One frame plus its padding and extrude is larger than the maximum page size','The message names the frame and its size','Raise the maximum size (up to 16384 px), allow rotation where the engine reads it, or scale that frame down']]},
   alternatives:{rows:[
    ['A plain grid sheet (the classic maker below)','Every frame already has the same size and your engine slices by cell, for example GameMaker strips or Godot\'s Add Frames from Sprite Sheet. There is no data file to keep in sync.'],
    ['Aseprite\'s own sheet export (`--sheet-pack`, `--trim`, `--merge-duplicates` on its command line)','The art lives in Aseprite and its JSON with tags and durations is all you need. It writes no engine bundles such as Godot SpriteFrames.'],
    ['TexturePacker Pro','You need polygon packing, GPU texture formats or a command line in a build pipeline; measured against Nerulio on [[game/texture-packer-free|the TexturePacker alternative page]].'],
    ['The engine\'s own packer (Defold atlas, Spine\'s texture packer)','The engine packs separate images at build or export time anyway; then you only need the frame images, for example from [[game/sprite-sheet-to-png-frames|a sheet split into PNG frames]].']]},
   versions:{body:['The sizes above are the output of Nerulio\'s packer on the six ninja frames of the repository\'s test corpus, the same numbers as the 2026-09-23 head-to-head. Exports were loaded in Godot 4.7.2, Unity 6000.5.3f1, Phaser 3.90 and 4.2, PixiJS 8.21, spine-canvas 4.2 and LÖVE 11.5; Defold bob.jar 1.13.1 built the Defold files. The other tools\' option names follow their documentation.'],sources:[S.aseCli,S.tpSettings,S.spinePacker]}
  },
  ko:{
   answer:'스프라이트 시트는 여러 프레임을 이미지 한 장에 모아 게임이 텍스처 수십 장 대신 한 장만 읽게 합니다. 촘촘하게 패킹한 아틀라스는 여기에 프레임마다 이름과 사각 영역을 적은 데이터 파일이 붙습니다. 번호 붙은 PNG, GIF, .aseprite 파일을 넣고 엔진 프리셋을 고르면 Nerulio가 브라우저 안에서 패킹하고(기본값: MaxRects, 트림 켬, 간격 2px) 그 엔진이 읽는 데이터 파일과 함께 PNG를 내보냅니다. 칸 크기가 모두 같은 단순 격자 시트는 아래에 연결된 기존 만들기 도구를 쓰세요.',
   concept:{title:'격자 시트와 패킹 아틀라스',body:[
    '격자 시트는 모든 프레임에 같은 크기의 칸을 줍니다. 그래서 엔진은 계산만으로 n번째 프레임을 찾습니다. 열 = n mod 열 수, 행 = n ÷ 열 수(내림). 데이터 파일이 필요 없지만, 칸마다 가장 큰 프레임만큼 자리를 차지하고 투명한 테두리까지 그대로 저장됩니다.',
    '패킹 아틀라스는 프레임마다 보이는 픽셀만 남기고 잘라 빈자리에 끼워 넣습니다. 위치를 계산으로 알 수 없으니 패커가 데이터 파일을 씁니다. 프레임 이름, 페이지 위 저장 위치(`frame`), 원래 캔버스에서의 위치(`spriteSourceSize`), 원래 캔버스 크기(`sourceSize`), 90도 돌려 저장했는지(`rotated`)입니다. 엔진은 이 숫자로 프레임을 원래 크기 상자 안에 그리므로 트림한 프레임도 제자리에 있습니다.',
    '가장자리를 지키는 설정이 두 가지 있습니다. 모양 간격은 프레임 사이에 투명 픽셀을 두고, 확장(extrude)은 프레임 바깥쪽 픽셀을 한 겹 더 복사해 둡니다. 텍스처 필터가 가장자리 바로 바깥을 읽어도 이웃 프레임 대신 같은 색을 읽게 됩니다. 회전은 면적을 조금 줄이지만 회전된 프레임을 되돌려 그리는 엔진은 일부뿐이라, Nerulio 프리셋은 엔진 검증에서 올바르게 그려진 PixiJS와 Spine에서만 회전을 허용합니다.'],
    terms:[['페이지','아틀라스 이미지 한 장. 최대 크기에 다 들어가지 않으면 다음 페이지로 넘어갑니다(최대 64장).'],['트림','프레임의 투명 테두리를 잘라 내고 오프셋을 기록하는 것. 그래서 원래 자리에 그려집니다.'],['모양 간격(shape padding)','프레임 사이의 투명 픽셀. 기본 2px.'],['확장(extrude)','프레임 가장자리 픽셀을 바깥에 복사한 띠. 기본 0, LÖVE 프리셋은 1.'],['별칭(alias)','보이는 픽셀이 똑같은 프레임은 저장 영역 하나를 함께 씁니다.']]},
   example:{title:'예시: 40 × 29 달리기 프레임 6장',lead:'CC0 닌자 달리기 동작 6프레임(각 40 × 29px, 대부분 투명)을 Nerulio의 Phaser 프리셋(트림 켬, 간격 2, 회전 없음)으로 패킹한 결과를 다른 배치와 비교했습니다.',lines:[
    '배치                             페이지      면적        가로 띠 대비',
    '가로 띠, 6 × 40px                240 × 29    6,960 px²   100 %',
    '패킹, 트림 끔, 간격 2             82 × 91    7,462 px²   107 %',
    '패킹, 트림 켬, 간격 2             38 × 50    1,900 px²    27 %',
    '패킹, 트림 켬, 회전 허용          33 × 57    1,881 px²    27 %',
    '',
    '보이는 픽셀(바운딩 박스 6개 합)              1,591 px²',
    '트림 페이지의 사용 비율          1,591 / 1,900 = 0.84',
    '',
    ...RUN0],
    after:'run_0은 18 × 15픽셀만 저장됩니다. 엔진은 이 조각을 40 × 29 상자 안에서 오른쪽으로 10px, 아래로 10px 옮겨 원래 자리에 그립니다. 절약은 트림 덕분입니다. 트림 없이 패킹하면 프레임 사이 간격 때문에 오히려 가로 띠보다 조금 커집니다.'},
   target:{title:'엔진에서 시트 불러오기',steps:[
    '쓰는 엔진용으로 내보내고 PNG와 데이터 파일을 함께 둡니다. 데이터 파일이 이미지 이름을 적고 있습니다(JSON의 `meta.image`, XML의 `imagePath`, Spine .atlas의 페이지 줄).',
    'Phaser: `this.load.atlas("run", "run.png", "run.json")` 후 `this.add.sprite(x, y, "run", "run_0")`. 자세한 내용은 [[game/phaser-texture-atlas|Phaser 아틀라스 페이지]].',
    'PixiJS 8: `const sheet = await Assets.load("run.json")` 후 `sheet.textures["run_0"]`이나 `sheet.animations["run"]`. [[game/pixi-spritesheet-json|PixiJS 스프라이트시트 JSON]] 참고.',
    'Godot 4와 Unity 6은 아틀라스 대신 바로 쓰는 리소스나 가져오기 스크립트를 받습니다. [[game/godot-sprite-sheet|Godot에서 스프라이트 시트]], [[game/unity-sprite-sheet|Unity에서 스프라이트 시트]] 참고.',
    'LÖVE, Defold, Spine / libGDX, CSS는 각자 형식이 있습니다. [[game/love2d-quads|LÖVE 쿼드]], [[game/defold-atlas|Defold 아틀라스]], [[game/spine-atlas|Spine 아틀라스]], [[game/css-sprite-generator|CSS 스프라이트]].']},
   verify:{steps:[
    '패킹·내보내기의 사용 비율을 봅니다. 0.84는 페이지의 84%가 보이는 프레임 면적이라는 뜻입니다. 낮으면 대개 트림이 꺼져 있거나 프레임 하나가 유난히 큽니다.',
    '패킹된 프레임 목록의 줄에 마우스를 올리면 캔버스 → 저장 크기, 페이지, 트림·회전·"같은 프레임"(별칭) 표시가 보입니다.',
    '엔진에서 트림된 프레임 하나를 트림 안 된 이웃 프레임과 같은 점에 그려 봅니다. 어긋나면 로더가 `spriteSourceSize`를 무시하는 것입니다(문제 해결 참고).']},
   trouble:{rows:[
    ['애니메이션 재생 중 프레임이 튀거나 흔들림','트림된 프레임을 오프셋 없이 그림. 로더나 코드가 `frame`만 쓰고 `spriteSourceSize`·`sourceSize`는 무시함','트림이 서로 다른 두 프레임을 같은 점에 그려 봄. 맞아야 정상','트림 정보를 읽는 로더를 쓰거나 트림을 끄고 패킹(페이지가 커짐). [[game/sprite-jitter-after-trim|트림 후 흔들림]] 참고'],
    ['확대하거나 소수 픽셀만큼 움직일 때 프레임 가장자리에 가는 선이나 색 번짐','텍스처 필터가 프레임 바로 바깥 픽셀(이웃 프레임이나 투명 간격)을 읽음','가장자리를 확대해 선이 이웃의 색인지, 비쳐 보이는지 확인','모양 간격 2 이상 유지, 확장 1 추가, 도트 그림은 최근접 필터. [[atlas-padding|아틀라스 간격]] 참고'],
    ['일부 프레임이 옆으로 눕거나 뒤집히거나 잘림','회전된 프레임을 되돌리지 않는 엔진·로더인데 회전을 허용함','해당 항목에 `"rotated": true`가 있음','회전을 끄고 패킹. Nerulio의 Godot·Unity·Phaser·LÖVE·XML·CSS 내보내기는 회전된 패킹을 거부함'],
    ['스프라이트가 페이지에 들어가지 않는다는 오류','간격과 확장을 더한 프레임 하나가 최대 페이지보다 큼','메시지에 프레임 이름과 크기가 나옴','최대 크기를 올리거나(최대 16384px), 엔진이 읽을 수 있으면 회전 허용, 또는 그 프레임을 축소']]},
   alternatives:{rows:[
    ['단순 격자 시트(아래의 기존 만들기 도구)','모든 프레임 크기가 같고 엔진이 칸 단위로 자를 때. 예: GameMaker 스트립, Godot의 Add Frames from Sprite Sheet. 맞춰 둘 데이터 파일이 없습니다.'],
    ['Aseprite 자체 시트 내보내기(명령줄의 `--sheet-pack`, `--trim`, `--merge-duplicates`)','그림을 Aseprite에서 관리하고 태그와 길이가 담긴 JSON만 있으면 될 때. Godot SpriteFrames 같은 엔진 번들은 만들지 않습니다.'],
    ['TexturePacker Pro','폴리곤 패킹, GPU 텍스처 형식, 빌드 파이프라인용 명령줄이 필요할 때. Nerulio와의 측정 비교는 [[game/texture-packer-free|TexturePacker 대안 페이지]].'],
    ['엔진 자체 패커(Defold 아틀라스, Spine 텍스처 패커)','엔진이 빌드·내보내기 때 개별 이미지를 어차피 패킹할 때. 프레임 이미지만 있으면 됩니다. [[game/sprite-sheet-to-png-frames|시트를 PNG 프레임으로 나누기]] 참고.']]},
   versions:{body:['위 크기는 저장소 테스트 코퍼스의 닌자 프레임 6장에 Nerulio 패커를 돌린 실제 결과이며, 2026-09-23 비교 측정의 수치와 같습니다. 내보낸 파일은 Godot 4.7.2, Unity 6000.5.3f1, Phaser 3.90·4.2, PixiJS 8.21, spine-canvas 4.2, LÖVE 11.5에서 불러왔고, Defold 파일은 bob.jar 1.13.1로 빌드했습니다. 다른 도구의 옵션 이름은 각 공식 문서를 따릅니다.'],sources:[S.aseCli,S.tpSettings,S.spinePacker]}
  },
  ja:{
   answer:'スプライトシートは多数のフレームを1枚の画像にまとめ、ゲームがテクスチャを何十枚も読まずに済むようにします。詰めてパックしたアトラスには、フレームごとの名前と矩形を書いたデータファイルが付きます。連番PNG、GIF、.asepriteファイルを入れてエンジンのプリセットを選ぶと、Nerulioがブラウザ内でパックし（既定：MaxRects、トリムあり、間隔2px）、そのエンジンが読むデータファイルと一緒にPNGを書き出します。セルがすべて同じ大きさの単純なグリッドシートは、下にリンクした従来の作成ツールを使ってください。',
   concept:{title:'グリッドシートとパック済みアトラス',body:[
    'グリッドシートは全フレームに同じ大きさのセルを割り当てます。そのためエンジンは計算だけでn番目のフレームを見つけられます。列 = n mod 列数、行 = n ÷ 列数（切り捨て）。データファイルは不要ですが、どのセルも一番大きなフレームの大きさになり、透明な余白もそのまま保存されます。',
    'パック済みアトラスは各フレームを見えるピクセルだけに切り詰め、空いた場所に詰め込みます。位置を計算では求められないので、パッカーがデータファイルを書きます。フレーム名、ページ上の保存位置（`frame`）、元のキャンバス上の位置（`spriteSourceSize`）、元のキャンバスの大きさ（`sourceSize`）、90度回して保存したか（`rotated`）です。エンジンはこの数値で元の大きさの枠内に描くので、トリムしたフレームも位置がずれません。',
    '縁を守る設定が2つあります。シェイプ間隔はフレームの間に透明ピクセルを空け、押し出し（extrude）はフレームの最も外側のピクセルを周りに複製します。テクスチャフィルターが縁のすぐ外を読んでも、隣のフレームではなく同じ色を読むようになります。回転は面積を少し減らしますが、回転したフレームを戻して描けるエンジンは一部だけです。Nerulioのプリセットは、エンジン検証で正しく描かれたPixiJSとSpineでのみ回転を許可します。'],
    terms:[['ページ','アトラス画像1枚。最大サイズに収まらないフレームは次のページへ（最大64枚）。'],['トリム','フレームの透明な余白を切り取り、オフセットを記録すること。元の位置に描かれます。'],['シェイプ間隔（shape padding）','フレーム間の透明ピクセル。既定は2px。'],['押し出し（extrude）','フレームの縁のピクセルを外側に複製した帯。既定は0、LÖVEプリセットは1。'],['エイリアス','見えるピクセルが同一のフレームは、保存領域を1つ共有します。']]},
   example:{title:'例：40 × 29の走りフレーム6枚',lead:'CC0の忍者の走りモーション6フレーム（各40 × 29px、大半が透明）を、NerulioのPhaserプリセット（トリムあり、間隔2、回転なし）でパックし、ほかの並べ方と比べました。',lines:[
    '並べ方                           ページ      面積        横一列比',
    '横一列、6 × 40px                 240 × 29    6,960 px²   100 %',
    'パック、トリムなし、間隔2          82 × 91    7,462 px²   107 %',
    'パック、トリムあり、間隔2          38 × 50    1,900 px²    27 %',
    'パック、トリムあり、回転あり       33 × 57    1,881 px²    27 %',
    '',
    '見えるピクセル（バウンディングボックス6個の合計） 1,591 px²',
    'トリム版ページの使用率           1,591 / 1,900 = 0.84',
    '',
    ...RUN0],
    after:'run_0は18 × 15ピクセルだけが保存されます。エンジンはこの断片を40 × 29の枠の中で右へ10px、下へ10pxずらし、元の位置に描きます。節約できたのはトリムのおかげです。トリムなしでパックすると、フレーム間の間隔のぶん横一列より少し大きくなります。'},
   target:{title:'エンジンでシートを読み込む',steps:[
    '使うエンジン向けに書き出し、PNGとデータファイルは一緒に置きます。データ側が画像名を持っています（JSONの`meta.image`、XMLの`imagePath`、Spine .atlasのページ行）。',
    'Phaser：`this.load.atlas("run", "run.png", "run.json")`のあと`this.add.sprite(x, y, "run", "run_0")`。詳しくは[[game/phaser-texture-atlas|Phaserアトラスのページ]]。',
    'PixiJS 8：`const sheet = await Assets.load("run.json")`のあと`sheet.textures["run_0"]`または`sheet.animations["run"]`。[[game/pixi-spritesheet-json|PixiJSのスプライトシートJSON]]を参照。',
    'Godot 4とUnity 6には、アトラスの代わりにそのまま使えるリソースやインポートスクリプトが入ります。[[game/godot-sprite-sheet|Godotでスプライトシート]]、[[game/unity-sprite-sheet|Unityでスプライトシート]]を参照。',
    'LÖVE、Defold、Spine / libGDX、CSSはそれぞれ独自の形式です。[[game/love2d-quads|LÖVEのQuad]]、[[game/defold-atlas|Defoldアトラス]]、[[game/spine-atlas|Spineアトラス]]、[[game/css-sprite-generator|CSSスプライト]]。']},
   verify:{steps:[
    'パック＆書き出しの使用率を見ます。0.84はページの84%が見えるフレーム面積という意味です。低いときは、たいていトリムがオフか、1枚だけ極端に大きなフレームがあります。',
    'パック済みフレーム一覧の行にカーソルを合わせると、キャンバス → 保存サイズ、ページ、トリム・回転・「同じフレーム」（エイリアス）の印が出ます。',
    'エンジンで、トリムしたフレームをトリムしていない隣のフレームと同じ点に描きます。ずれるならローダーが`spriteSourceSize`を無視しています（トラブルシューティング参照）。']},
   trouble:{rows:[
    ['アニメーション再生中にフレームが跳ねる・揺れる','トリムしたフレームをオフセットなしで描いている。ローダーやコードが`frame`だけを使い`spriteSourceSize`・`sourceSize`を無視','トリム量の違う2フレームを同じ点に描く。そろえば正常','トリム情報を読むローダーを使うか、トリムなしでパック（ページは大きくなる）。[[game/sprite-jitter-after-trim|トリム後の揺れ]]を参照'],
    ['拡大時や小数ピクセルの移動時に、フレームの縁に細い線や色のにじみ','テクスチャフィルターがフレームのすぐ外（隣のフレームか透明な間隔）を読んでいる','縁を拡大し、線が隣の色か、透けているかを見る','シェイプ間隔を2以上に保ち、押し出し1を追加、ドット絵は最近傍フィルター。[[atlas-padding|アトラスの間隔]]を参照'],
    ['一部のフレームが横倒し・反転・欠ける','回転したフレームを戻さないエンジンやローダーなのに回転を許可した','その項目に`"rotated": true`がある','回転なしでパック。NerulioのGodot・Unity・Phaser・LÖVE・XML・CSS書き出しは回転したパックを拒否する'],
    ['スプライトがページに収まらないというエラー','間隔と押し出しを足したフレーム1枚が最大ページより大きい','メッセージにフレーム名とサイズが出る','最大サイズを上げる（最大16384px）、エンジンが読めるなら回転を許可、またはそのフレームを縮小']]},
   alternatives:{rows:[
    ['単純なグリッドシート（下の従来の作成ツール）','全フレームが同じ大きさで、エンジンがセル単位で切り出すとき。例：GameMakerのストリップ、GodotのAdd Frames from Sprite Sheet。同期させるデータファイルがありません。'],
    ['Aseprite自体のシート書き出し（コマンドラインの`--sheet-pack`、`--trim`、`--merge-duplicates`）','絵をAsepriteで管理し、タグと長さ入りのJSONだけあればよいとき。Godot SpriteFramesのようなエンジン用バンドルは作りません。'],
    ['TexturePacker Pro','ポリゴンパッキング、GPUテクスチャ形式、ビルドパイプライン用のコマンドラインが必要なとき。Nerulioとの計測比較は[[game/texture-packer-free|TexturePacker代替のページ]]。'],
    ['エンジン自身のパッカー（Defoldアトラス、Spineのテクスチャパッカー）','エンジンがビルドや書き出しの時に個別画像をどのみちパックするとき。フレーム画像だけあれば足ります。[[game/sprite-sheet-to-png-frames|シートをPNGフレームに分割]]を参照。']]},
   versions:{body:['上のサイズは、リポジトリのテスト用コーパスにある忍者6フレームをNerulioのパッカーで処理した実際の出力で、2026-09-23の比較計測と同じ数値です。書き出したファイルはGodot 4.7.2、Unity 6000.5.3f1、Phaser 3.90と4.2、PixiJS 8.21、spine-canvas 4.2、LÖVE 11.5で読み込み、DefoldのファイルはDefoldのbob.jar 1.13.1でビルドしました。ほかのツールのオプション名は各公式ドキュメントに従います。'],sources:[S.aseCli,S.tpSettings,S.spinePacker]}
  }
 },
 'game/texture-packer-free':{
  type:'compare',
  intent:{primary:'a free alternative to TexturePacker for packing sprite sheets',secondary:['which TexturePacker settings have an equivalent','where TexturePacker Pro is still ahead','measured sheet sizes against TexturePacker Pro'],
   goal:'decide whether the free browser packer covers the TexturePacker features the visitor actually uses',input:'frame images, a GIF or an .aseprite file',output:'packed PNG page(s) + engine data files',target:'Godot, Unity, Phaser, PixiJS, Spine, LÖVE, Defold, CSS (17 targets)',support:'partial',
   evidence:['docs/H2H-PAID.md §1 (TexturePacker 8.3.0 Pro trial vs Studio, 2026-09-25)','docs/STUDIO-PACK-H2H.md (free packers)','src/game/pack/layout.js, sprites.js (settings and ranges)','src/game/export/targets.js'],
   external:['TexturePacker docs: texture settings (trim modes, extrude, padding, rotation, identical sprites, multipack)','CodeAndWeb: TexturePacker Godot importer']},
  en:{
   answer:'Nerulio\'s Pack & Export is a free, browser-based packer that covers TexturePacker\'s rectangle packing: MaxRects, trim modes, rotation, merging identical sprites, extrude, border and shape padding, multipack and scale variants. Against TexturePacker Pro 8.3.0 on five real frame sets, with rotation allowed, it made smaller sheets on four and a 2.1 % larger one on the fifth; both tools restored every frame exactly. TexturePacker Pro stays ahead on polygon packing, GPU texture formats, its 68 data formats and a command line for build pipelines.',
   concept:{title:'What a TexturePacker alternative has to cover',body:[
    'TexturePacker\'s settings come down to a few decisions: how to cut each sprite (trim mode), how to space them (border padding, shape padding, extrude), whether to rotate, whether identical sprites are stored once, how large a page may be, and which data format to write. Nerulio has an equivalent for each of these rectangle settings; the table below maps the names.',
    'The two differ outside rectangle packing. TexturePacker can trace a polygon around each sprite and pack the polygons, writes compressed GPU formats and reduced pixel formats, and has a command line and `.tps` project files for build scripts. Nerulio writes PNG only and has no command line; in exchange it carries animations (tags, per-frame durations, pivots, hit boxes) into engine bundles that were loaded in the engines themselves.',
    'Sheet size depends on the page shape you accept. TexturePacker\'s Best mode keeps the smallest area even when the page becomes a long strip (3551 × 102 on one set); Nerulio scores squarer pages higher. That is why the measurement also compares both tools with square pages forced.']},
   mapping:{title:'TexturePacker settings and their Nerulio equivalents',head:['TexturePacker','Nerulio Pack & Export','Note'],rows:[
    ['Trim mode None / Trim / Crop, keep position / Crop, flush position','none / trim / crop-keep / crop, plus an alpha threshold','Same four ideas; crop-keep moves the pivot so the art stays in place'],
    ['Trim mode Polygon, algorithm Polygon','—','Not available: rectangles only'],
    ['Algorithm MaxRects','MaxRects with BSSF, BLSF, BAF, BL and CP, plus Skyline and Guillotine; "try all" keeps the smallest page','Effort fast / normal / best instead of pack modes'],
    ['Extrude, Border padding, Shape padding','extrude 0–32, border padding 0–64, shape padding 0–64 (default 2)','Same meaning, in pixels'],
    ['Allow rotation','Allow rotation, set by each engine preset and enforced at export','Refused for Godot, Unity, Phaser, LÖVE, XML and CSS'],
    ['Detect identical sprites','Alias (hash + byte check), on by default','Both stored the 18 ninja frames of the duplicate test as 6'],
    ['Multipack, max size, size constraints POT, force squared','Multipack up to 64 pages, 8–16384 px, POT, square, fixed, multiple-of','—'],
    ['Scale variants','@0.5x, @1x, @2x, @3x, @4x','Nearest-neighbour only; no smooth filters, no Scale2x/Hq2x'],
    ['Texture format and pixel format (PVR, ETC, ASTC, DXT, Basis, WebP, RGBA4444 …)','PNG only, indexed when a page has 256 colours or fewer','Convert afterwards if a platform needs GPU formats']]},
   example:{title:'Measured: TexturePacker Pro 8.3.0 and Nerulio, same settings',lead:'Trim on, shape padding 2, max 4096, identical sprites merged, best effort on both sides. Δ is Nerulio\'s sheet area relative to TexturePacker\'s; negative means Nerulio\'s sheet is smaller (docs/H2H-PAID.md, 2026-09-25).',lines:[
    'set (frames)          rotation allowed   rotation off                    square pages',
    'ninja (6)             −17.7 %            −16.9 %                         −20.6 %',
    'archer (10)            −3.6 %             +0.8 %  (TP: 3034 × 538 strip)   −2.6 %',
    'samurai (60)           −5.8 %             −8.7 %                         −10.0 %',
    'toon (45)              −2.0 %             +3.0 %  (TP: 3551 × 102 strip)   −3.6 %',
    'spaceshooter (294)     +2.1 % (TP: 3575 × 256)  +1.2 %                    +0.8 %',
    '',
    'power-of-two pages     identical sizes on all five sets',
    'frames restored exact  415 / 415 for both tools in every configuration',
    'polygon mode (TP only) spaceshooter 892,581 px² = 4.5 % below Nerulio\'s best;',
    '                       the four character sets 15–27 % larger than TP\'s own rectangles'],
    after:'So neither tool wins every row. TexturePacker is ahead on the spaceshooter pack (294 sprites in 96 sizes) and on two sets when rotation is off and long strips are acceptable; Nerulio is ahead on the character sets and with square pages.'},
   alternatives:{rows:[
    ['TexturePacker Pro','Mobile or console builds that need PVRTC, ETC2, ASTC or Basis textures; sprite packs with angular shapes, where polygon packing saved 4.5 % on the spaceshooter set; build pipelines driven by its command line and `.tps` files; engines Nerulio has no target for, such as cocos2d, SpriteKit, Unreal Paper2D or MonoGame.'],
    ['TexturePacker\'s own Godot importer plugin','You already publish from TexturePacker and want Godot to reimport on every change. According to CodeAndWeb it creates one AtlasTexture per sprite and an AnimationLibrary running at 10 fps, not SpriteFrames; compared on [[game/texturepacker-to-godot|TexturePacker to Godot]].'],
    ['Nerulio Pack & Export','Free and nothing to install; animations with per-frame durations, pivots and boxes must reach Godot, Unity, Phaser, PixiJS, LÖVE or Spine; you want to see which engine run backs each export before you click.'],
    ['Free web packers and free-tex-packer','Measured on [[game/sprite-sheet-packers-compared|the free packer comparison]]; free-tex-packer\'s npm core runs in a build script, which Nerulio cannot.']]},
   limits:{title:'What Nerulio lacks compared with TexturePacker Pro',items:[
    'No polygon packing, rectangles only: TexturePacker\'s polygon mode was 4.5 % smaller on the spaceshooter set and 15–27 % larger on the four character sets than its own rectangles.',
    'PNG pages only: no PVRTC, ETC1/2, ASTC, DXT, Basis, KTX, WebP or JPG, and no reduced pixel formats such as RGBA4444 or RGB565 with dithering.',
    '17 export targets against TexturePacker\'s 68 data formats; no cocos2d, SpriteKit, Unreal Paper2D, MonoGame or Solar2D output.',
    'No command line, smart folders or project file for automated builds; packing runs in the browser.',
    'Scale variants use nearest-neighbour only, which suits pixel art but not smooth art that needs filtered downscaling.',
    'Pack speed was not compared fairly: the browser worker was not timed on the same five sets.']},
   versions:{body:['Measured on 2026-09-25 with TexturePacker 8.3.0 (Pro trial, command line) and the same modules the Studio runs. Every frame was restored from each tool\'s JSON and compared pixel by pixel; engine checks ran in Phaser 3.90.0 and 4.2.1, PixiJS 8.21.0, spine-canvas 4.2.120 and Godot 4.7.2. TexturePacker\'s setting names are taken from its documentation.'],sources:[S.tpSettings,S.tpExporter,S.tpGodot]}
  },
  ko:{
   answer:'Nerulio의 패킹·내보내기는 브라우저에서 쓰는 무료 패커로, TexturePacker의 사각형 패킹 기능을 갖추고 있습니다. MaxRects, 트림 방식, 회전, 같은 스프라이트 합치기, 확장, 테두리·모양 간격, 여러 페이지, 배율 변형입니다. 실제 프레임 세트 5개로 TexturePacker Pro 8.3.0과 비교했을 때 회전을 허용하면 4개 세트에서 시트가 더 작았고 나머지 하나에서는 2.1% 컸으며, 두 도구 모두 모든 프레임을 정확히 복원했습니다. 폴리곤 패킹, GPU 텍스처 형식, 68개 데이터 형식, 빌드 파이프라인용 명령줄은 TexturePacker Pro가 앞섭니다.',
   concept:{title:'TexturePacker 대안이 갖춰야 할 것',body:[
    'TexturePacker의 설정은 몇 가지 결정으로 정리됩니다. 스프라이트를 어떻게 자를지(트림 방식), 얼마나 띄울지(테두리 간격, 모양 간격, 확장), 회전할지, 같은 스프라이트를 한 번만 저장할지, 페이지를 얼마나 크게 둘지, 어떤 데이터 형식으로 쓸지입니다. 이 사각형 설정마다 Nerulio에 대응 기능이 있으며 아래 표에 이름을 짝지어 두었습니다.',
    '차이는 사각형 패킹 바깥에 있습니다. TexturePacker는 스프라이트 윤곽을 다각형으로 따서 패킹할 수 있고, 압축 GPU 형식과 줄인 픽셀 형식을 쓰며, 빌드 스크립트용 명령줄과 `.tps` 프로젝트 파일이 있습니다. Nerulio는 PNG만 쓰고 명령줄이 없습니다. 대신 애니메이션(태그, 프레임별 길이, 피벗, 히트박스)을 엔진 번들에 담으며, 그 번들은 실제 엔진에서 불러와 확인했습니다.',
    '시트 크기는 어떤 페이지 모양을 받아들이느냐에 달려 있습니다. TexturePacker의 Best 모드는 페이지가 길쭉한 띠가 되어도 면적이 가장 작은 쪽을 고릅니다(한 세트에서 3551 × 102). Nerulio는 정사각형에 가까운 페이지에 점수를 더 줍니다. 그래서 측정에서는 두 도구 모두 정사각형 페이지를 강제한 경우도 비교했습니다.']},
   mapping:{title:'TexturePacker 설정과 Nerulio의 대응 기능',head:['TexturePacker','Nerulio 패킹·내보내기','메모'],rows:[
    ['Trim mode None / Trim / Crop, keep position / Crop, flush position','none / trim / crop-keep / crop, 알파 임계값 추가','같은 네 가지 개념. crop-keep은 그림이 제자리에 있도록 피벗을 옮김'],
    ['Trim mode Polygon, 알고리즘 Polygon','—','없음: 사각형만'],
    ['알고리즘 MaxRects','MaxRects의 BSSF·BLSF·BAF·BL·CP와 Skyline·Guillotine. "모두 시도"는 가장 작은 페이지를 선택','팩 모드 대신 노력 단계 fast / normal / best'],
    ['Extrude, Border padding, Shape padding','확장 0–32, 테두리 간격 0–64, 모양 간격 0–64(기본 2)','뜻은 같음, 단위 픽셀'],
    ['Allow rotation','회전 허용. 엔진 프리셋이 정하고 내보낼 때 강제','Godot·Unity·Phaser·LÖVE·XML·CSS에서는 거부'],
    ['Detect identical sprites','별칭(해시 + 바이트 비교), 기본 켬','중복 테스트의 닌자 18프레임을 두 도구 모두 6개로 저장'],
    ['Multipack, 최대 크기, POT 제약, 정사각형 강제','최대 64페이지, 8–16384px, POT·정사각형·고정·배수','—'],
    ['배율 변형','@0.5x, @1x, @2x, @3x, @4x','최근접 이웃만. 부드러운 필터와 Scale2x/Hq2x 없음'],
    ['텍스처·픽셀 형식(PVR, ETC, ASTC, DXT, Basis, WebP, RGBA4444 …)','PNG만. 색이 256개 이하인 페이지는 인덱스 PNG','GPU 형식이 필요하면 나중에 변환']]},
   example:{title:'측정: 같은 설정의 TexturePacker Pro 8.3.0과 Nerulio',lead:'트림 켬, 모양 간격 2, 최대 4096, 같은 스프라이트 합침, 양쪽 모두 최고 노력. Δ는 TexturePacker 대비 Nerulio 시트 면적이며, 음수면 Nerulio 쪽이 작습니다(docs/H2H-PAID.md, 2026-09-25).',lines:[
    '세트(프레임 수)       회전 허용          회전 끔                         정사각형 페이지',
    'ninja (6)             −17.7 %            −16.9 %                         −20.6 %',
    'archer (10)            −3.6 %             +0.8 %  (TP: 3034 × 538 띠)      −2.6 %',
    'samurai (60)           −5.8 %             −8.7 %                         −10.0 %',
    'toon (45)              −2.0 %             +3.0 %  (TP: 3551 × 102 띠)      −3.6 %',
    'spaceshooter (294)     +2.1 % (TP: 3575 × 256)  +1.2 %                    +0.8 %',
    '',
    '2의 거듭제곱 페이지    다섯 세트 모두 같은 크기',
    '정확히 복원된 프레임   모든 설정에서 두 도구 모두 415 / 415',
    '폴리곤 모드(TP만)      spaceshooter 892,581 px² = Nerulio 최선보다 4.5% 작음,',
    '                       캐릭터 세트 4개는 TP 자체 사각형보다 15–27% 큼'],
    after:'어느 도구도 모든 줄에서 이기지는 않습니다. 스프라이트 294개·크기 96종인 spaceshooter 세트와, 회전을 끄고 긴 띠 페이지를 허용한 두 세트에서는 TexturePacker가 앞서고, 캐릭터 세트와 정사각형 페이지에서는 Nerulio가 앞섭니다.'},
   alternatives:{rows:[
    ['TexturePacker Pro','PVRTC·ETC2·ASTC·Basis 텍스처가 필요한 모바일·콘솔 빌드, 폴리곤 패킹이 spaceshooter 세트에서 4.5% 줄인 것처럼 각진 모양의 스프라이트 팩, 명령줄과 `.tps` 파일로 돌리는 빌드 파이프라인, Nerulio에 대상이 없는 엔진(cocos2d, SpriteKit, Unreal Paper2D, MonoGame 등).'],
    ['TexturePacker의 Godot 가져오기 플러그인','이미 TexturePacker에서 퍼블리시하고 있고 바뀔 때마다 Godot가 다시 가져오길 원할 때. CodeAndWeb 설명에 따르면 스프라이트마다 AtlasTexture를, 10fps로 도는 AnimationLibrary를 만들며 SpriteFrames는 만들지 않습니다. [[game/texturepacker-to-godot|TexturePacker를 Godot로]]에서 비교.'],
    ['Nerulio 패킹·내보내기','무료이고 설치가 없음. 프레임별 길이·피벗·박스가 있는 애니메이션을 Godot, Unity, Phaser, PixiJS, LÖVE, Spine으로 넘겨야 할 때. 내보내기마다 어떤 엔진 실행으로 확인했는지 누르기 전에 보고 싶을 때.'],
    ['무료 웹 패커와 free-tex-packer','[[game/sprite-sheet-packers-compared|무료 패커 비교]]에서 측정. free-tex-packer의 npm 코어는 빌드 스크립트 안에서 돌릴 수 있지만 Nerulio는 그렇지 못합니다.']]},
   limits:{title:'TexturePacker Pro와 비교해 Nerulio에 없는 것',items:[
    '폴리곤 패킹이 없고 사각형만 됩니다. TexturePacker 폴리곤 모드는 자체 사각형 패킹보다 spaceshooter 세트에서 4.5% 작았고 캐릭터 세트 4개에서는 15–27% 컸습니다.',
    'PNG 페이지만 씁니다. PVRTC, ETC1/2, ASTC, DXT, Basis, KTX, WebP, JPG가 없고, 디더링을 곁들인 RGBA4444·RGB565 같은 줄인 픽셀 형식도 없습니다.',
    '내보내기 대상 17개 대 TexturePacker 데이터 형식 68개. cocos2d, SpriteKit, Unreal Paper2D, MonoGame, Solar2D 출력이 없습니다.',
    '자동 빌드용 명령줄, 스마트 폴더, 프로젝트 파일이 없습니다. 패킹은 브라우저에서 합니다.',
    '배율 변형은 최근접 이웃 방식뿐입니다. 도트 그림에는 맞지만 필터링된 축소가 필요한 부드러운 그림에는 맞지 않습니다.',
    '패킹 속도는 공정하게 비교하지 못했습니다. 브라우저 워커 시간을 같은 다섯 세트로 재지 않았습니다.']},
   versions:{body:['2026-09-25에 TexturePacker 8.3.0(Pro 체험판, 명령줄)과 Studio가 쓰는 것과 같은 모듈로 측정했습니다. 각 도구의 JSON으로 모든 프레임을 복원해 픽셀 단위로 비교했고, 엔진 확인은 Phaser 3.90.0·4.2.1, PixiJS 8.21.0, spine-canvas 4.2.120, Godot 4.7.2에서 했습니다. TexturePacker 설정 이름은 공식 문서를 따릅니다.'],sources:[S.tpSettings,S.tpExporter,S.tpGodot]}
  },
  ja:{
   answer:'Nerulioのパック＆書き出しは、ブラウザで使える無料のパッカーで、TexturePackerの矩形パッキングの機能を備えています。MaxRects、トリムの方式、回転、同一スプライトの統合、押し出し、外周・シェイプ間隔、マルチパック、倍率違いです。実在の5つのフレームセットでTexturePacker Pro 8.3.0と比べたところ、回転を許可すると4セットでシートが小さく、残る1セットでは2.1%大きくなりました。どちらのツールも全フレームを正確に復元しています。ポリゴンパッキング、GPUテクスチャ形式、68のデータ形式、ビルドパイプライン向けのコマンドラインはTexturePacker Proが上です。',
   concept:{title:'TexturePackerの代わりに求められること',body:[
    'TexturePackerの設定は、いくつかの判断にまとめられます。スプライトをどう切り詰めるか（トリム方式）、どれだけ離すか（外周間隔、シェイプ間隔、押し出し）、回転するか、同一スプライトを1回だけ保存するか、ページをどこまで大きくするか、どのデータ形式で書くかです。これらの矩形の設定にはそれぞれNerulio側の対応機能があり、下の表で名前を対応させています。',
    '違いは矩形パッキングの外にあります。TexturePackerはスプライトの輪郭を多角形でなぞってパックでき、圧縮GPU形式や減色したピクセル形式を書き出し、ビルドスクリプト向けのコマンドラインと`.tps`プロジェクトファイルを持っています。NerulioはPNGだけでコマンドラインもありません。その代わり、アニメーション（タグ、フレームごとの長さ、ピボット、ヒットボックス）をエンジン用バンドルに載せ、そのバンドルは実際のエンジンで読み込んで確認しています。',
    'シートの大きさは、どんなページの形を許すかで変わります。TexturePackerのBestモードは、ページが細長い帯になっても面積が最小のものを選びます（あるセットで3551 × 102）。Nerulioは正方形に近いページを高く評価します。そのため計測では、両方に正方形ページを強制した場合も比べています。']},
   mapping:{title:'TexturePackerの設定とNerulioの対応機能',head:['TexturePacker','Nerulio パック＆書き出し','メモ'],rows:[
    ['Trim mode None / Trim / Crop, keep position / Crop, flush position','none / trim / crop-keep / crop、アルファしきい値つき','同じ4つの考え方。crop-keepは絵が元の位置に残るようピボットを動かす'],
    ['Trim mode Polygon、アルゴリズムPolygon','—','なし：矩形のみ'],
    ['アルゴリズムMaxRects','MaxRectsのBSSF・BLSF・BAF・BL・CPとSkyline・Guillotine。「すべて試す」で最小のページを採用','パックモードの代わりに労力 fast / normal / best'],
    ['Extrude、Border padding、Shape padding','押し出し0–32、外周間隔0–64、シェイプ間隔0–64（既定2）','意味は同じ、単位はピクセル'],
    ['Allow rotation','回転を許可。エンジンのプリセットが決め、書き出し時に強制','Godot・Unity・Phaser・LÖVE・XML・CSSでは拒否'],
    ['Detect identical sprites','エイリアス（ハッシュ＋バイト比較）、既定でオン','重複テストの忍者18フレームを両ツールとも6つで保存'],
    ['Multipack、最大サイズ、POT制約、正方形の強制','最大64ページ、8–16384px、POT・正方形・固定・倍数','—'],
    ['倍率違い','@0.5x、@1x、@2x、@3x、@4x','最近傍のみ。なめらかなフィルターやScale2x/Hq2xはない'],
    ['テクスチャ形式・ピクセル形式（PVR、ETC、ASTC、DXT、Basis、WebP、RGBA4444 …）','PNGのみ。256色以下のページはインデックスPNG','GPU形式が必要なら後で変換']]},
   example:{title:'計測：同じ設定のTexturePacker Pro 8.3.0とNerulio',lead:'トリムあり、シェイプ間隔2、最大4096、同一スプライトを統合、両方とも最高の労力。ΔはTexturePackerに対するNerulioのシート面積で、マイナスならNerulioのほうが小さいことを示します（docs/H2H-PAID.md、2026-09-25）。',lines:[
    'セット（フレーム数）  回転あり           回転なし                        正方形ページ',
    'ninja (6)             −17.7 %            −16.9 %                         −20.6 %',
    'archer (10)            −3.6 %             +0.8 %  (TP: 3034 × 538の帯)     −2.6 %',
    'samurai (60)           −5.8 %             −8.7 %                         −10.0 %',
    'toon (45)              −2.0 %             +3.0 %  (TP: 3551 × 102の帯)     −3.6 %',
    'spaceshooter (294)     +2.1 % (TP: 3575 × 256)  +1.2 %                    +0.8 %',
    '',
    '2のべき乗ページ        5セットとも同じサイズ',
    '正確に復元したフレーム 全設定で両ツールとも415 / 415',
    'ポリゴンモード（TPのみ）spaceshooter 892,581 px² = Nerulioの最良より4.5%小さい、',
    '                       キャラクター4セットはTP自身の矩形より15–27%大きい'],
    after:'どちらのツールもすべての行で勝つわけではありません。スプライト294個・96サイズのspaceshooterセットと、回転なしで細長い帯のページを許した2セットではTexturePackerが上回り、キャラクターのセットと正方形ページではNerulioが上回ります。'},
   alternatives:{rows:[
    ['TexturePacker Pro','PVRTC・ETC2・ASTC・Basisテクスチャが必要なモバイルやコンソールのビルド、ポリゴンパッキングがspaceshooterセットで4.5%減らしたような角ばった形のスプライト集、コマンドラインと`.tps`ファイルで回すビルドパイプライン、Nerulioに書き出し先がないエンジン（cocos2d、SpriteKit、Unreal Paper2D、MonoGameなど）。'],
    ['TexturePacker純正のGodotインポーター（プラグイン）','すでにTexturePackerからパブリッシュしていて、変更のたびにGodotに再インポートさせたいとき。CodeAndWebの説明では、スプライトごとのAtlasTextureと10fpsで動くAnimationLibraryを作り、SpriteFramesは作りません。[[game/texturepacker-to-godot|TexturePackerからGodotへ]]で比較しています。'],
    ['Nerulio パック＆書き出し','無料でインストール不要。フレームごとの長さ・ピボット・ボックスを持つアニメーションをGodot、Unity、Phaser、PixiJS、LÖVE、Spineへ渡したいとき。書き出しごとに、どのエンジンでの確認が裏づけか押す前に見たいとき。'],
    ['無料のWebパッカーとfree-tex-packer','[[game/sprite-sheet-packers-compared|無料パッカーの比較]]で計測。free-tex-packerのnpmコアはビルドスクリプトの中で動かせますが、Nerulioはできません。']]},
   limits:{title:'TexturePacker Proと比べてNerulioにないもの',items:[
    'ポリゴンパッキングはなく、矩形のみです。TexturePackerのポリゴンモードは、自身の矩形パッキングと比べてspaceshooterセットで4.5%小さく、キャラクター4セットでは15–27%大きくなりました。',
    'ページはPNGのみです。PVRTC、ETC1/2、ASTC、DXT、Basis、KTX、WebP、JPGはなく、ディザリング付きのRGBA4444やRGB565のような減色形式もありません。',
    '書き出し先は17、TexturePackerのデータ形式は68です。cocos2d、SpriteKit、Unreal Paper2D、MonoGame、Solar2D向けの出力はありません。',
    '自動ビルド用のコマンドライン、スマートフォルダー、プロジェクトファイルはありません。パックはブラウザで行います。',
    '倍率違いは最近傍のみです。ドット絵には合いますが、フィルターをかけた縮小が必要な滑らかな絵には向きません。',
    'パック速度は公平に比べていません。ブラウザのワーカーの時間を同じ5セットで計測していないためです。']},
   versions:{body:['2026-09-25に、TexturePacker 8.3.0（Pro体験版、コマンドライン）とStudioが使うものと同じモジュールで計測しました。各ツールのJSONから全フレームを復元してピクセル単位で比較し、エンジンでの確認はPhaser 3.90.0・4.2.1、PixiJS 8.21.0、spine-canvas 4.2.120、Godot 4.7.2で行いました。TexturePackerの設定名は公式ドキュメントに従います。'],sources:[S.tpSettings,S.tpExporter,S.tpGodot]}
  }
 },
 'game/phaser-texture-atlas':{
  type:'engine',
  intent:{primary:'make a texture atlas (JSON + PNG) that Phaser 3 or 4 loads with this.load.atlas',secondary:['frame names and animations','multiatlas for several pages','why rotation is off for Phaser'],
   goal:'a sprite in Phaser that shows named frames and plays animations with the right timing',input:'frame images, a GIF, an .aseprite file or a sheet',output:'atlas JSON hash (or multiatlas) + PNG + .anims.json',target:'Phaser 3.90 / 4.2',support:'full',
   evidence:['src/game/export/atlas-json.js (phaserFiles)','src/game/export/common.js (tpFrame)','src/game/export/targets.js (rotation refused for Phaser)','docs/STUDIO-PACK.md (Phaser 3.90 and 4.2 runs)','docs/H2H-PAID.md (rotated TexturePacker frames fail in Phaser)'],
   external:['Phaser LoaderPlugin: atlas, multiatlas','AnimationManager: fromJSON, generateFrameNames, create','Game config pixelArt','Phaser 3.90 source: JSONHash pivot → origin, Animation frame duration']},
  en:{
   answer:'Phaser loads a texture atlas as a PNG plus a JSON hash or array in TexturePacker\'s layout, with `this.load.atlas(key, png, json)`; every frame is then addressed by its name, as in `this.add.sprite(x, y, key, "run_0")`. Nerulio packs your frames into that layout and adds an `.anims.json` with every tag and per-frame duration for `this.anims.fromJSON`. Rotation stays off, because Phaser 3.90 and 4.2 did not turn rotated frames back in our runs; trimmed frames are drawn correctly. Checked in Phaser 3.90 and 4.2.',
   concept:{title:'How Phaser finds a frame in an atlas',body:[
    'The loader turns every entry under `frames` into a named frame of one texture key. `frame` is the rectangle cut from the PNG. When `trimmed` is true, Phaser passes `sourceSize` and `spriteSourceSize` to the frame\'s trim, so the cut pixels are drawn inside a box of the original size and the sprite behaves as if nothing was trimmed. A `pivot` in the entry becomes the sprite\'s origin when the frame is set.',
    'Animations refer to those names. Build them in code with `this.anims.generateFrameNames(key, {prefix, start, end, zeroPad})`, or load them as data with `this.anims.fromJSON`. Each animation frame may carry its own `duration` in milliseconds: in Phaser 3.90\'s animation code the next frame is due after that duration, and after the animation\'s ms-per-frame when it is 0.',
    'When the frames need several pages, `this.load.multiatlas(key, json, path)` reads one JSON with a `textures` list, one entry per page image. Frame names stay unique across pages, so your code does not care which page a frame is on.'],
    terms:[['Texture key','The name given to the loader ("run"); every frame lives under it.'],['Frame name','The key of an entry in `frames` ("run_0"); what `add.sprite` and animations refer to.'],['JSON hash / array','The same frame data as an object keyed by name, or as a list with a `filename` field. Phaser reads both.'],['multiatlas','One JSON with a `textures` list, one entry per page image.']]},
   example:{title:'Example: the run cycle as Phaser receives it',lines:[
    'run.png   38 × 50 px, 6 frames of 40 × 29, trim on, padding 2, no rotation',
    '',
    ...RUN0,
    '"pivot": {"x":0.5,"y":1}   → sprite origin (0.5, 1): the point between the feet',
    '',
    'run.anims.json   { "key":"run", "frameRate":10, "repeat":-1, "yoyo":false,',
    '                   "frames":[ {"key":"run","frame":"run_0","duration":100}, … ×6 ] }',
    '',
    'this.add.sprite(100, 100, "run", "run_0")',
    '  → a 40 × 29 sprite whose feet stand on (100, 100); the 18 × 15 piece is drawn at (10, 10) inside it',
    '6 frames × 100 ms = one cycle every 0.6 s; repeat -1 = loop forever'],
    after:'Phaser\'s `repeat` counts the extra plays, so a tag set to play 3 times in Aseprite or in the Studio is written as `repeat: 2`, and a ping-pong tag becomes `yoyo: true`.'},
   outputs:{rows:[
    ['run.json','Atlas JSON hash for one page: `frames` with `frame`, `trimmed`, `spriteSourceSize`, `sourceSize`, `rotated` and a normalised `pivot`; `meta.image` and `meta.size`.'],
    ['run.multiatlas.json','Instead of run.json when the frames need several pages: a `textures` list with `run-0.png`, `run-1.png` … and their frames.'],
    ['run.anims.json','One animation per tag: frames with `duration` in ms, `frameRate`, `repeat` (−1 = loop) and `yoyo` for ping-pong. Not written when the project has no tags.'],
    ['run.png','The packed page, as an indexed PNG when it has 256 colours or fewer.'],
    ['README-PHASER.md','The preload and create code for this bundle.']]},
   target:{title:'Use it in Phaser 3 or 4',steps:[
    'Copy the PNG and JSON files together into your game\'s assets folder; a multiatlas finds its pages through the image names inside the JSON.',
    'In `preload()`: `this.load.atlas("run", "assets/run.png", "assets/run.json")` (or `this.load.multiatlas("run", "assets/run.multiatlas.json", "assets/")`) and `this.load.json("run-anims", "assets/run.anims.json")`.',
    'In `create()`: `this.anims.fromJSON(this.cache.json.get("run-anims"))` registers the animations; then `const hero = this.add.sprite(160, 120, "run", "run_0")` and `hero.play("run")`.',
    'For pixel art, create the game with `pixelArt: true`, which sets `antialias` to false and `roundPixels` to true.',
    'To build an animation yourself instead: `this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`.']},
   verify:{steps:[
    '`this.textures.get("run").getFrameNames()` lists run_0 … run_5 (no file extensions).',
    'Place `this.add.image(100, 100, "run", "run_0")` and `"run_4"` at the same point: the feet stay on one line, although the stored pieces start at different offsets.',
    '`this.anims.exists("run")` is true, and one cycle of `hero.play("run")` takes 0.6 s.']},
   trouble:{rows:[
    ['A frame name shows the wrong picture or nothing','That name is not in the atlas under this key: a typo, a file extension kept, or another texture key','`this.textures.get(key).getFrameNames()`','Use the names exactly as in the JSON; Nerulio drops the extension (run_0, not run_0.png)'],
    ['Only some frames are mirrored or turned','The atlas was packed with rotation, for example by TexturePacker with rotation enabled; Phaser 3.90 and 4.2 did not turn such frames back','Those entries have `"rotated": true`','Repack with rotation off; see [[game/phaser-atlas-frames-wrong|Phaser atlas frames wrong]]'],
    ['Pixel art is blurry or shimmers while moving','Linear filtering and positions between pixels','The game config has no `pixelArt: true`','Set `pixelArt: true`, or `antialias: false` and `roundPixels: true`'],
    ['`play("run")` does nothing','The animations were never registered: `fromJSON` ran before the JSON was loaded, or read another cache key','`this.anims.exists("run")`','Call `this.anims.fromJSON(this.cache.json.get("run-anims"))` in `create()`, after preload'],
    ['The timing differs from the editor','A `frameRate` passed to `play()` differs from the animation\'s, so Phaser uses its ms-per-frame instead of each frame\'s `duration`','Look at the play config','Play without overriding `frameRate`; change durations in the tag instead']]},
   alternatives:{rows:[
    ['Phaser\'s Aseprite loader: `this.load.aseprite` and `this.anims.createFromAseprite`','The art is in Aseprite and you want its tags straight from the JSON; one page only, no rotation. See [[game/aseprite-to-phaser|Aseprite to Phaser]].'],
    ['Starling / Sparrow XML with `this.load.atlasXML`','A pipeline that already uses XML (FNF-style assets); in Phaser 3.90 keep trim off. See [[game/sparrow-xml-spritesheet|Sparrow XML]].'],
    ['TexturePacker\'s Phaser export','You already own TexturePacker: its Phaser format does not rotate by default and passed in Phaser 3.90 and 4.2 on all four sets we tested.']]},
   versions:{body:['Nerulio\'s atlas and animation files were loaded by Phaser 3.90.0 and 4.2.1 (the real `phaser.min.js` in Chromium) on real CC0 frame sets and every frame was compared with its source. The loader and animation calls follow the Phaser documentation; the pivot-to-origin and frame-duration behaviour is read from the Phaser 3.90 source.'],sources:[S.phaserLoader,S.phaserAnims,S.phaserCore,S.phaserAnimSrc,S.phaserHashSrc]}
  },
  ko:{
   answer:'Phaser는 텍스처 아틀라스를 PNG와 TexturePacker 배치의 JSON(해시 또는 배열)으로 불러옵니다. `this.load.atlas(key, png, json)`로 읽은 뒤에는 `this.add.sprite(x, y, key, "run_0")`처럼 프레임 이름으로 부릅니다. Nerulio는 프레임을 이 배치로 패킹하고, `this.anims.fromJSON`용으로 모든 태그와 프레임별 길이를 담은 `.anims.json`을 덧붙입니다. 검증 실행에서 Phaser 3.90과 4.2가 회전된 프레임을 되돌려 그리지 못했기 때문에 회전은 끄며, 트림된 프레임은 제대로 그려집니다. Phaser 3.90과 4.2에서 확인했습니다.',
   concept:{title:'Phaser가 아틀라스에서 프레임을 찾는 방법',body:[
    '로더는 `frames` 아래 항목마다 하나의 텍스처 키에 속한 이름 있는 프레임을 만듭니다. `frame`은 PNG에서 잘라 낼 사각형입니다. `trimmed`가 참이면 Phaser가 `sourceSize`와 `spriteSourceSize`를 프레임의 트림 정보로 넘기므로, 잘린 조각이 원래 크기의 상자 안에 그려지고 스프라이트는 트림하지 않은 것처럼 동작합니다. 항목에 `pivot`이 있으면 프레임을 지정할 때 스프라이트의 원점이 됩니다.',
    '애니메이션은 이 이름을 가리킵니다. 코드에서 `this.anims.generateFrameNames(key, {prefix, start, end, zeroPad})`로 만들거나, 데이터로 `this.anims.fromJSON`에 넘길 수 있습니다. 애니메이션 프레임마다 밀리초 단위 `duration`을 둘 수 있습니다. Phaser 3.90의 애니메이션 코드에서는 그 길이가 지나면 다음 프레임으로 넘어가고, 값이 0이면 애니메이션의 프레임당 밀리초를 씁니다.',
    '프레임이 여러 페이지에 걸치면 `this.load.multiatlas(key, json, path)`가 `textures` 목록이 있는 JSON 하나를 읽습니다. 페이지 이미지마다 항목이 하나씩 있고 프레임 이름은 페이지를 넘어 고유하므로, 코드에서는 프레임이 어느 페이지에 있는지 신경 쓰지 않아도 됩니다.'],
    terms:[['텍스처 키','로더에 준 이름("run"). 모든 프레임이 이 아래에 있습니다.'],['프레임 이름','`frames` 항목의 키("run_0"). `add.sprite`와 애니메이션이 이 이름을 씁니다.'],['JSON 해시 / 배열','같은 프레임 데이터를 이름을 키로 한 객체로, 또는 `filename` 필드가 있는 목록으로 쓴 것. Phaser는 둘 다 읽습니다.'],['multiatlas','`textures` 목록이 있는 JSON 하나. 페이지 이미지마다 항목 하나.']]},
   example:{title:'예시: Phaser가 받는 달리기 동작',lines:[
    'run.png   38 × 50px, 40 × 29 프레임 6장, 트림 켬, 간격 2, 회전 없음',
    '',
    ...RUN0,
    '"pivot": {"x":0.5,"y":1}   → 스프라이트 원점 (0.5, 1): 두 발 사이의 점',
    '',
    'run.anims.json   { "key":"run", "frameRate":10, "repeat":-1, "yoyo":false,',
    '                   "frames":[ {"key":"run","frame":"run_0","duration":100}, … ×6 ] }',
    '',
    'this.add.sprite(100, 100, "run", "run_0")',
    '  → 발이 (100, 100)에 서는 40 × 29 스프라이트. 18 × 15 조각은 그 안의 (10, 10)에 그려짐',
    '6프레임 × 100ms = 0.6초마다 한 바퀴. repeat -1 = 무한 반복'],
    after:'Phaser의 `repeat`는 추가 재생 횟수를 셉니다. Aseprite나 Studio에서 3번 재생으로 설정한 태그는 `repeat: 2`로 쓰이고, 핑퐁 태그는 `yoyo: true`가 됩니다.'},
   outputs:{rows:[
    ['run.json','한 페이지용 아틀라스 JSON 해시: `frame`, `trimmed`, `spriteSourceSize`, `sourceSize`, `rotated`, 정규화된 `pivot`이 있는 `frames`와 `meta.image`, `meta.size`.'],
    ['run.multiatlas.json','프레임이 여러 페이지에 걸칠 때 run.json 대신 생성: `run-0.png`, `run-1.png` …와 각 프레임이 든 `textures` 목록.'],
    ['run.anims.json','태그마다 애니메이션 하나: ms 단위 `duration`이 있는 프레임, `frameRate`, `repeat`(−1 = 반복), 핑퐁용 `yoyo`. 태그가 없으면 만들지 않음.'],
    ['run.png','패킹된 페이지. 색이 256개 이하면 인덱스 PNG.'],
    ['README-PHASER.md','이 번들용 preload·create 코드.']]},
   target:{title:'Phaser 3·4에서 쓰기',steps:[
    'PNG와 JSON 파일을 함께 게임의 assets 폴더에 복사합니다. multiatlas는 JSON 안의 이미지 이름으로 페이지를 찾습니다.',
    '`preload()`에서 `this.load.atlas("run", "assets/run.png", "assets/run.json")`(또는 `this.load.multiatlas("run", "assets/run.multiatlas.json", "assets/")`)와 `this.load.json("run-anims", "assets/run.anims.json")`을 호출합니다.',
    '`create()`에서 `this.anims.fromJSON(this.cache.json.get("run-anims"))`로 애니메이션을 등록하고, `const hero = this.add.sprite(160, 120, "run", "run_0")` 뒤 `hero.play("run")`을 호출합니다.',
    '도트 그림이면 게임을 `pixelArt: true`로 만듭니다. `antialias`를 끄고 `roundPixels`를 켜는 설정입니다.',
    '애니메이션을 직접 만들려면 `this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`를 씁니다.']},
   verify:{steps:[
    '`this.textures.get("run").getFrameNames()`에 run_0 … run_5가 확장자 없이 나와야 합니다.',
    '`this.add.image(100, 100, "run", "run_0")`와 `"run_4"`를 같은 점에 놓습니다. 저장된 조각의 오프셋이 달라도 발이 한 선에 있어야 합니다.',
    '`this.anims.exists("run")`이 참이고, `hero.play("run")`의 한 바퀴가 0.6초여야 합니다.']},
   trouble:{rows:[
    ['프레임 이름에 엉뚱한 그림이 나오거나 아무것도 안 나옴','이 키 아래에 그 이름이 없음: 오타, 확장자가 남아 있음, 다른 텍스처 키','`this.textures.get(key).getFrameNames()`','JSON에 있는 이름 그대로 사용. Nerulio는 확장자를 뺌(run_0, run_0.png 아님)'],
    ['일부 프레임만 뒤집히거나 돌아감','회전을 켠 아틀라스(예: 회전을 켠 TexturePacker). Phaser 3.90과 4.2는 이런 프레임을 되돌리지 못했음','해당 항목에 `"rotated": true`','회전을 끄고 다시 패킹. [[game/phaser-atlas-frames-wrong|Phaser 아틀라스 프레임 오류]] 참고'],
    ['도트 그림이 흐리거나 움직일 때 반짝임','선형 필터와 픽셀 사이 위치','게임 설정에 `pixelArt: true`가 없음','`pixelArt: true`, 또는 `antialias: false`와 `roundPixels: true`'],
    ['`play("run")`이 아무 일도 안 함','애니메이션이 등록되지 않음: JSON을 불러오기 전에 `fromJSON`을 실행했거나 다른 캐시 키를 읽음','`this.anims.exists("run")`','preload가 끝난 뒤 `create()`에서 `this.anims.fromJSON(this.cache.json.get("run-anims"))` 호출'],
    ['재생 속도가 편집기와 다름','`play()`에 준 `frameRate`가 애니메이션 값과 달라서 Phaser가 프레임별 `duration` 대신 프레임당 밀리초를 씀','재생 설정 확인','`frameRate`를 덮어쓰지 말고 태그에서 길이를 바꿈']]},
   alternatives:{rows:[
    ['Phaser의 Aseprite 로더: `this.load.aseprite`와 `this.anims.createFromAseprite`','그림이 Aseprite에 있고 JSON의 태그를 바로 쓰고 싶을 때. 한 페이지만, 회전 없음. [[game/aseprite-to-phaser|Aseprite를 Phaser로]] 참고.'],
    ['`this.load.atlasXML`로 읽는 Starling / Sparrow XML','이미 XML을 쓰는 파이프라인(FNF 방식 에셋). Phaser 3.90에서는 트림을 끄세요. [[game/sparrow-xml-spritesheet|Sparrow XML]] 참고.'],
    ['TexturePacker의 Phaser 내보내기','이미 TexturePacker가 있을 때. Phaser 형식은 기본으로 회전하지 않으며, 시험한 네 세트 모두 Phaser 3.90과 4.2에서 통과했습니다.']]},
   versions:{body:['Nerulio의 아틀라스와 애니메이션 파일을 실제 CC0 프레임 세트로 Phaser 3.90.0과 4.2.1(Chromium에서 실제 `phaser.min.js`)에 불러와, 모든 프레임을 원본과 비교했습니다. 로더와 애니메이션 호출은 Phaser 공식 문서를 따르며, 피벗이 원점이 되는 동작과 프레임 길이 처리는 Phaser 3.90 소스에서 확인했습니다.'],sources:[S.phaserLoader,S.phaserAnims,S.phaserCore,S.phaserAnimSrc,S.phaserHashSrc]}
  },
  ja:{
   answer:'Phaserはテクスチャアトラスを、PNGとTexturePacker形式のJSON（ハッシュまたは配列）として`this.load.atlas(key, png, json)`で読み込みます。読み込んだ後は`this.add.sprite(x, y, key, "run_0")`のようにフレーム名で指定します。Nerulioはフレームをこの形式にパックし、`this.anims.fromJSON`向けに全タグとフレームごとの長さを入れた`.anims.json`を添えます。検証の実行でPhaser 3.90と4.2は回転したフレームを戻して描けなかったため回転はオフにし、トリムしたフレームは正しく描かれます。Phaser 3.90と4.2で確認済みです。',
   concept:{title:'Phaserがアトラスからフレームを探す仕組み',body:[
    'ローダーは`frames`の各項目から、1つのテクスチャキーに属する名前付きフレームを作ります。`frame`はPNGから切り出す矩形です。`trimmed`が真なら、Phaserは`sourceSize`と`spriteSourceSize`をフレームのトリム情報として渡すので、切り出した断片は元の大きさの枠の中に描かれ、スプライトはトリムしていないかのように振る舞います。項目に`pivot`があれば、フレームを設定したときにスプライトの原点になります。',
    'アニメーションはこの名前を参照します。コードで`this.anims.generateFrameNames(key, {prefix, start, end, zeroPad})`を使って作るか、データとして`this.anims.fromJSON`に渡します。アニメーションのフレームごとにミリ秒単位の`duration`を持てます。Phaser 3.90のアニメーションのコードでは、その長さが過ぎると次のフレームに進み、0ならアニメーションの1フレームあたりのミリ秒を使います。',
    'フレームが複数ページにまたがるときは、`this.load.multiatlas(key, json, path)`が`textures`リストを持つJSONを1つ読みます。ページ画像ごとに項目が1つあり、フレーム名はページをまたいで一意なので、コード側はフレームがどのページにあるかを気にしなくて済みます。'],
    terms:[['テクスチャキー','ローダーに渡した名前（"run"）。すべてのフレームがこの下にあります。'],['フレーム名','`frames`の項目のキー（"run_0"）。`add.sprite`やアニメーションが参照します。'],['JSONハッシュ / 配列','同じフレームデータを、名前をキーにしたオブジェクトか、`filename`を持つリストで書いたもの。Phaserは両方読めます。'],['multiatlas','`textures`リストを持つJSON 1つ。ページ画像ごとに1項目。']]},
   example:{title:'例：Phaserが受け取る走りモーション',lines:[
    'run.png   38 × 50px、40 × 29のフレーム6枚、トリムあり、間隔2、回転なし',
    '',
    ...RUN0,
    '"pivot": {"x":0.5,"y":1}   → スプライトの原点 (0.5, 1)：両足の間の点',
    '',
    'run.anims.json   { "key":"run", "frameRate":10, "repeat":-1, "yoyo":false,',
    '                   "frames":[ {"key":"run","frame":"run_0","duration":100}, … ×6 ] }',
    '',
    'this.add.sprite(100, 100, "run", "run_0")',
    '  → 足が (100, 100) に立つ40 × 29のスプライト。18 × 15の断片はその中の (10, 10) に描かれる',
    '6フレーム × 100ms = 0.6秒で1周。repeat -1 = 無限ループ'],
    after:'Phaserの`repeat`は追加の再生回数を数えます。AsepriteやStudioで3回再生にしたタグは`repeat: 2`と書かれ、ピンポンのタグは`yoyo: true`になります。'},
   outputs:{rows:[
    ['run.json','1ページ用のアトラスJSONハッシュ：`frame`、`trimmed`、`spriteSourceSize`、`sourceSize`、`rotated`、正規化した`pivot`を持つ`frames`と、`meta.image`、`meta.size`。'],
    ['run.multiatlas.json','フレームが複数ページにまたがるときにrun.jsonの代わりに作成：`run-0.png`、`run-1.png` …とそのフレームを持つ`textures`リスト。'],
    ['run.anims.json','タグごとに1つのアニメーション：ms単位の`duration`付きフレーム、`frameRate`、`repeat`（−1 = ループ）、ピンポン用の`yoyo`。タグがなければ作らない。'],
    ['run.png','パックしたページ。256色以下ならインデックスPNG。'],
    ['README-PHASER.md','このバンドル用のpreloadとcreateのコード。']]},
   target:{title:'Phaser 3・4で使う',steps:[
    'PNGとJSONファイルを一緒にゲームのassetsフォルダーへコピーします。multiatlasはJSON内の画像名でページを探します。',
    '`preload()`で`this.load.atlas("run", "assets/run.png", "assets/run.json")`（または`this.load.multiatlas("run", "assets/run.multiatlas.json", "assets/")`）と`this.load.json("run-anims", "assets/run.anims.json")`を呼びます。',
    '`create()`で`this.anims.fromJSON(this.cache.json.get("run-anims"))`によりアニメーションを登録し、`const hero = this.add.sprite(160, 120, "run", "run_0")`のあと`hero.play("run")`を呼びます。',
    'ドット絵ならゲームを`pixelArt: true`で作成します。`antialias`をオフ、`roundPixels`をオンにする設定です。',
    'アニメーションを自分で作るなら`this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`を使います。']},
   verify:{steps:[
    '`this.textures.get("run").getFrameNames()`にrun_0 … run_5が拡張子なしで並ぶはずです。',
    '`this.add.image(100, 100, "run", "run_0")`と`"run_4"`を同じ点に置きます。保存された断片のオフセットが違っても、足は一直線にそろうはずです。',
    '`this.anims.exists("run")`が真で、`hero.play("run")`の1周が0.6秒になるはずです。']},
   trouble:{rows:[
    ['フレーム名で違う絵が出る・何も出ない','このキーの下にその名前がない：打ち間違い、拡張子が残っている、別のテクスチャキー','`this.textures.get(key).getFrameNames()`','JSONにある名前をそのまま使う。Nerulioは拡張子を外す（run_0であってrun_0.pngではない）'],
    ['一部のフレームだけ反転・回転して見える','回転ありでパックしたアトラス（例：回転を有効にしたTexturePacker）。Phaser 3.90と4.2はこうしたフレームを戻せなかった','その項目に`"rotated": true`','回転なしでパックし直す。[[game/phaser-atlas-frames-wrong|Phaserのアトラスのフレームがおかしい]]を参照'],
    ['ドット絵がぼやける・動くとちらつく','線形フィルターとピクセルの間の位置','ゲーム設定に`pixelArt: true`がない','`pixelArt: true`、または`antialias: false`と`roundPixels: true`'],
    ['`play("run")`で何も起きない','アニメーションが登録されていない：JSONの読み込み前に`fromJSON`を実行した、または別のキャッシュキーを読んだ','`this.anims.exists("run")`','preload後の`create()`で`this.anims.fromJSON(this.cache.json.get("run-anims"))`を呼ぶ'],
    ['再生速度がエディターと違う','`play()`に渡した`frameRate`がアニメーションの値と違い、Phaserがフレームごとの`duration`ではなく1フレームあたりのミリ秒を使う','再生設定を見る','`frameRate`を上書きせず、長さはタグ側で変える']]},
   alternatives:{rows:[
    ['PhaserのAsepriteローダー：`this.load.aseprite`と`this.anims.createFromAseprite`','絵がAsepriteにあり、JSONのタグをそのまま使いたいとき。1ページのみ、回転なし。[[game/aseprite-to-phaser|AsepriteからPhaserへ]]を参照。'],
    ['`this.load.atlasXML`で読むStarling / Sparrow XML','すでにXMLを使うパイプライン（FNF形式の素材）。Phaser 3.90ではトリムをオフに。[[game/sparrow-xml-spritesheet|Sparrow XML]]を参照。'],
    ['TexturePackerのPhaser書き出し','TexturePackerを持っているとき。Phaser形式は既定で回転せず、試した4セットすべてでPhaser 3.90と4.2に合格しました。']]},
   versions:{body:['Nerulioのアトラスとアニメーションのファイルを、実在のCC0フレームセットでPhaser 3.90.0と4.2.1（Chromium上の実際の`phaser.min.js`）に読み込み、全フレームを元画像と比較しました。ローダーとアニメーションの呼び出しはPhaser公式ドキュメントに、ピボットが原点になる動作とフレームの長さの扱いはPhaser 3.90のソースに基づきます。'],sources:[S.phaserLoader,S.phaserAnims,S.phaserCore,S.phaserAnimSrc,S.phaserHashSrc]}
  }
 },
 'game/pixi-spritesheet-json':{
  type:'engine',
  intent:{primary:'make a PixiJS 8 spritesheet JSON with animations from frame images',secondary:['animations map and per-frame timing','anchors from pivots','@2x variants and multi-page sheets'],
   goal:'Assets.load returns a Spritesheet whose textures and animations play in PixiJS 8 at the right size and anchor',input:'frame images, a GIF, an .aseprite file or a sheet',output:'spritesheet JSON (+ @2x variants) + PNG page(s)',target:'PixiJS 8 (verified 8.21)',support:'full',
   evidence:['src/game/export/atlas-json.js (pixiFiles)','docs/STUDIO-PACK.md (PixiJS 8.21, rotated and multi-page)','tools/engine-verify/results/pixi-scale-2026-09-24.json (textures, anchors, sizes read back)'],
   external:['PixiJS API: Spritesheet (frames, animations, meta.scale)','PixiJS API: AnimatedSprite (frame objects with time, animationSpeed)']},
  en:{
   answer:'PixiJS 8 loads a spritesheet from one JSON file: `const sheet = await Assets.load("run.json")` also loads the PNG named in `meta.image`, then `sheet.textures["run_0"]` is one frame and `sheet.animations["run"]` the list of textures of one animation. Nerulio writes that JSON with the animations map in playback order, an `anchor` per frame taken from your pivot, `meta.scale` for each @2x variant and `related_multi_packs` for extra pages; per-frame milliseconds go in `meta.nerulio`. Checked in PixiJS 8.21, rotated and multi-page sheets included.',
   concept:{title:'What PixiJS reads from the JSON',body:[
    'Each entry under `frames` becomes a Texture. `frame` is the rectangle on the page, `rotated` says the piece lies turned, `spriteSourceSize` and `sourceSize` restore a trimmed frame to its full size, and `anchor` becomes the texture\'s default anchor, so a Sprite made from it is placed by that point (0.5, 1 = bottom centre).',
    'The `animations` map lists frame names per animation and carries no timing. An AnimatedSprite built from plain textures plays them at one rate, scaled by `animationSpeed`. For per-frame timing, pass objects `{ texture, time }` with `time` in milliseconds; Nerulio stores those milliseconds in `meta.nerulio.animations`, because the standard format has no field for them.',
    '`meta.scale` is the resolution of the page: at "2" the textures of an @2x page have the same size in PixiJS units as those of the @1x page, with twice the detail. Extra pages are named in `meta.related_multi_packs` and load together with the first JSON.'],
    terms:[['Texture','One frame: a rectangle of the page plus trim, rotation and default anchor.'],['anchor','The point of the texture placed at the sprite\'s position, 0–1 on each axis.'],['animations','Name → ordered list of frame names; PixiJS turns each list into an array of textures.'],['meta.scale','The page\'s resolution: "1" for @1x, "2" for @2x.']]},
   example:{title:'Example: one frame of the run cycle, file and PixiJS side by side',lines:[
    'run.json (page run.png 38 × 50, "scale": "1")',
    '"run_0": { "frame": {"x":0,"y":34,"w":18,"h":15}, "rotated": false, "trimmed": true,',
    '           "spriteSourceSize": {"x":10,"y":10,"w":18,"h":15}, "sourceSize": {"w":40,"h":29},',
    '           "anchor": {"x":0.5,"y":1} }',
    '"animations": { "run": ["run_0","run_1","run_2","run_3","run_4","run_5"] }',
    '"meta": { …, "nerulio": { "animations": { "run": { "fps":10, "durationsMs":[100,100,100,100,100,100] } } } }',
    '',
    'PixiJS 8.21 read back for run_0:',
    '  frame 18 × 15 at (0, 34)   trim at (10, 10)   orig 40 × 29   rotate 0',
    '  new Sprite(texture): width 40, height 29, anchor (0.5, 1)'],
    after:'With rotation allowed, the same six frames pack into 33 × 57 and five of them are stored turned; PixiJS 8.21 drew rotated frames upright in the verification runs, so the PixiJS preset allows rotation.'},
   outputs:{rows:[
    ['run.json','Frames with `anchor`, the `animations` map (on the first page), `meta.scale`, `meta.related_multi_packs` when there are several pages, and `meta.nerulio` with fps, loop, direction and `durationsMs` per animation.'],
    ['run.png','The page; with scale variants also `run@2x.png` with its own `run@2x.json`, and so on.'],
    ['README-PIXI.md','Loading code for this bundle, including an AnimatedSprite that uses the exported frame times.']]},
   target:{title:'Use it in PixiJS 8',steps:[
    'Put `run.json` and `run.png` in the same folder of your app\'s public assets; the JSON names its PNG in `meta.image`.',
    'For pixel art, before loading anything: `TextureSource.defaultOptions.scaleMode = "nearest"`.',
    '`const sheet = await Assets.load("assets/run.json")`; a still frame is `new Sprite(sheet.textures["run_0"])`.',
    'One rate for the whole animation: `const hero = new AnimatedSprite(sheet.animations["run"])`, `hero.animationSpeed = …`, `hero.play()`.',
    'With the exported timing: `const ms = sheet.data.meta.nerulio.animations.run.durationsMs`, then `new AnimatedSprite(sheet.animations.run.map((texture, i) => ({ texture, time: ms[i] })))`, `hero.play()` and `app.stage.addChild(hero)`.']},
   verify:{steps:[
    '`Object.keys(sheet.textures)` lists run_0 … run_5.',
    '`new Sprite(sheet.textures.run_0)` is 40 wide and 29 high: the full frame, not the 18 × 15 stored piece.',
    'Zoom to 4×: with nearest scaling the edges stay square; soft edges mean the scale mode was not set before loading.']},
   trouble:{rows:[
    ['`sheet.animations` is undefined or empty','The JSON has no `animations` map (many exports write frames only), or you look at a later page of a multi-page sheet','Open the JSON: is there a top-level `animations`? With several pages it is on the first','Export with tags, or build the list yourself: `["run_0", …].map(n => sheet.textures[n])`'],
    ['Sprites hang from their top-left corner or sit at the wrong spot','No `anchor` in the JSON, or your code overrides it','`sprite.anchor.x`, `sprite.anchor.y`','Keep the exported anchor, or set pivots in [[game/sprite-pivot-editor|the pivot editor]] before exporting'],
    ['An @2x sheet draws twice as large','Its JSON says `"scale": "1"`','`sheet.data.meta.scale`','Set it to "2", or export scale variants; see [[game/pixijs-2x-spritesheet-scale|the @2x scale fix]]'],
    ['The animation plays faster or slower than in the editor','Plain textures play at one rate set by `animationSpeed` (default 1), not at the tag\'s milliseconds','Compare `hero.animationSpeed` with the timing you want','Use `{ texture, time }` objects with the exported milliseconds, or tune `animationSpeed`'],
    ['Pixel art looks soft','Linear scaling, PixiJS\'s default','The texture source\'s `scaleMode`','Set `TextureSource.defaultOptions.scaleMode = "nearest"` before `Assets.load`']]},
   alternatives:{rows:[
    ['Aseprite\'s JSON loaded by PixiJS','The art is already exported from Aseprite; PixiJS reads its frames but builds no animations from `frameTags`. See [[game/aseprite-json-to-pixi|Aseprite JSON to PixiJS]].'],
    ['TexturePacker\'s PixiJS export','You already use TexturePacker; its `pixijs4` output, which rotates by default, passed in PixiJS 8.21 on the four sets we tested.'],
    ['Loose PNGs, one `Assets.load` each','A prototype with a handful of frames; one request and one texture per frame, no atlas.']]},
   versions:{body:['Loaded in PixiJS 8.21.0 (WebGL in Chromium) with a plain `Assets.load`: rectangles, trim, anchors, animations, rotated frames and multi-page sheets were read back and every frame compared with its source; the numbers in the example are that run\'s read-back. API names follow the PixiJS 8 API reference.'],sources:[S.pixiSheet,S.pixiAnim,S.pixiSource]}
  },
  ko:{
   answer:'PixiJS 8은 JSON 파일 하나로 스프라이트시트를 불러옵니다. `const sheet = await Assets.load("run.json")`이 `meta.image`에 적힌 PNG까지 읽고 나면, `sheet.textures["run_0"]`이 프레임 하나, `sheet.animations["run"]`이 애니메이션 하나의 텍스처 목록입니다. Nerulio는 재생 순서대로 된 animations 맵, 피벗에서 가져온 프레임별 `anchor`, @2x 변형마다 맞춘 `meta.scale`, 추가 페이지용 `related_multi_packs`를 담아 이 JSON을 쓰고, 프레임별 밀리초는 `meta.nerulio`에 넣습니다. 회전·여러 페이지 시트까지 PixiJS 8.21에서 확인했습니다.',
   concept:{title:'PixiJS가 JSON에서 읽는 것',body:[
    '`frames` 아래 항목 하나가 텍스처 하나가 됩니다. `frame`은 페이지 위 사각형, `rotated`는 조각이 돌려져 저장됐다는 표시, `spriteSourceSize`와 `sourceSize`는 트림된 프레임을 원래 크기로 되돌리는 값입니다. `anchor`는 텍스처의 기본 앵커가 되어, 이 텍스처로 만든 스프라이트는 그 점을 기준으로 놓입니다(0.5, 1 = 아래쪽 가운데).',
    'animations 맵은 애니메이션마다 프레임 이름을 나열할 뿐 시간 정보가 없습니다. 텍스처만으로 만든 AnimatedSprite는 `animationSpeed`로 조절되는 한 가지 속도로 재생합니다. 프레임마다 시간을 주려면 `time`을 밀리초로 둔 `{ texture, time }` 객체를 넘기세요. 표준 형식에 이 값을 넣을 자리가 없어서 Nerulio는 `meta.nerulio.animations`에 밀리초를 저장합니다.',
    '`meta.scale`은 페이지의 해상도입니다. "2"이면 @2x 페이지의 텍스처가 PixiJS 단위로 @1x와 같은 크기가 되고 세밀함만 두 배가 됩니다. 추가 페이지는 `meta.related_multi_packs`에 이름이 있으며 첫 JSON과 함께 불러와집니다.'],
    terms:[['텍스처','프레임 하나: 페이지의 사각형과 트림, 회전, 기본 앵커.'],['anchor','스프라이트 위치에 놓이는 텍스처의 점. 각 축 0–1.'],['animations','이름 → 프레임 이름의 순서 목록. PixiJS가 텍스처 배열로 바꿉니다.'],['meta.scale','페이지 해상도. @1x는 "1", @2x는 "2".']]},
   example:{title:'예시: 달리기 프레임 하나를 파일과 PixiJS에서 나란히',lines:[
    'run.json (페이지 run.png 38 × 50, "scale": "1")',
    '"run_0": { "frame": {"x":0,"y":34,"w":18,"h":15}, "rotated": false, "trimmed": true,',
    '           "spriteSourceSize": {"x":10,"y":10,"w":18,"h":15}, "sourceSize": {"w":40,"h":29},',
    '           "anchor": {"x":0.5,"y":1} }',
    '"animations": { "run": ["run_0","run_1","run_2","run_3","run_4","run_5"] }',
    '"meta": { …, "nerulio": { "animations": { "run": { "fps":10, "durationsMs":[100,100,100,100,100,100] } } } }',
    '',
    'PixiJS 8.21이 run_0에 대해 읽어 낸 값:',
    '  frame 18 × 15, 위치 (0, 34)   trim (10, 10)   orig 40 × 29   rotate 0',
    '  new Sprite(texture): 너비 40, 높이 29, anchor (0.5, 1)'],
    after:'회전을 허용하면 같은 6프레임이 33 × 57에 들어가고 그중 5장이 돌려 저장됩니다. 검증 실행에서 PixiJS 8.21은 회전된 프레임을 바로 세워 그렸기 때문에 PixiJS 프리셋은 회전을 허용합니다.'},
   outputs:{rows:[
    ['run.json','`anchor`가 있는 프레임, 첫 페이지의 animations 맵, `meta.scale`, 페이지가 여럿이면 `meta.related_multi_packs`, 애니메이션마다 fps·반복·방향·`durationsMs`가 든 `meta.nerulio`.'],
    ['run.png','페이지. 배율 변형이 있으면 `run@2x.png`와 전용 `run@2x.json` 등이 함께 생김.'],
    ['README-PIXI.md','이 번들을 불러오는 코드. 내보낸 프레임 시간을 쓰는 AnimatedSprite 포함.']]},
   target:{title:'PixiJS 8에서 쓰기',steps:[
    '`run.json`과 `run.png`를 앱의 공개 에셋 폴더 한곳에 둡니다. JSON의 `meta.image`가 PNG 이름입니다.',
    '도트 그림이면 무엇이든 불러오기 전에 `TextureSource.defaultOptions.scaleMode = "nearest"`를 설정합니다.',
    '`const sheet = await Assets.load("assets/run.json")`. 정지 프레임은 `new Sprite(sheet.textures["run_0"])`입니다.',
    '애니메이션 전체를 한 속도로: `const hero = new AnimatedSprite(sheet.animations["run"])`, `hero.animationSpeed = …`, `hero.play()`.',
    '내보낸 시간 그대로: `const ms = sheet.data.meta.nerulio.animations.run.durationsMs` 뒤 `new AnimatedSprite(sheet.animations.run.map((texture, i) => ({ texture, time: ms[i] })))`, `hero.play()`, `app.stage.addChild(hero)`.']},
   verify:{steps:[
    '`Object.keys(sheet.textures)`에 run_0 … run_5가 있어야 합니다.',
    '`new Sprite(sheet.textures.run_0)`의 너비 40, 높이 29: 저장된 18 × 15 조각이 아니라 전체 프레임 크기여야 합니다.',
    '4배로 확대합니다. 최근접 배율이면 가장자리가 네모납니다. 흐리면 불러오기 전에 배율 모드를 설정하지 않은 것입니다.']},
   trouble:{rows:[
    ['`sheet.animations`가 undefined이거나 비어 있음','JSON에 animations 맵이 없음(프레임만 쓰는 내보내기가 많음), 또는 여러 페이지 시트의 뒤쪽 페이지를 보고 있음','JSON 최상위에 `animations`가 있는지 확인. 여러 페이지면 첫 페이지에 있음','태그를 넣어 내보내거나 목록을 직접 만듦: `["run_0", …].map(n => sheet.textures[n])`'],
    ['스프라이트가 왼쪽 위 모서리에 매달리거나 엉뚱한 곳에 놓임','JSON에 `anchor`가 없거나 코드가 덮어씀','`sprite.anchor.x`, `sprite.anchor.y`','내보낸 앵커를 유지하거나 내보내기 전에 [[game/sprite-pivot-editor|피벗 편집기]]에서 피벗 설정'],
    ['@2x 시트가 두 배 크기로 그려짐','그 JSON에 `"scale": "1"`이 적혀 있음','`sheet.data.meta.scale`','"2"로 고치거나 배율 변형으로 내보냄. [[game/pixijs-2x-spritesheet-scale|@2x 배율 문제]] 참고'],
    ['애니메이션이 편집기보다 빠르거나 느림','텍스처만 넘기면 태그의 밀리초가 아니라 `animationSpeed`(기본 1)로 정해지는 한 속도로 재생됨','원하는 시간과 `hero.animationSpeed` 비교','내보낸 밀리초로 `{ texture, time }` 객체를 쓰거나 `animationSpeed` 조정'],
    ['도트 그림이 뿌옇게 보임','PixiJS 기본값인 선형 배율','텍스처 소스의 `scaleMode`','`Assets.load` 전에 `TextureSource.defaultOptions.scaleMode = "nearest"`']]},
   alternatives:{rows:[
    ['PixiJS로 읽는 Aseprite JSON','이미 Aseprite에서 내보낸 그림일 때. PixiJS는 프레임은 읽지만 `frameTags`로 애니메이션을 만들지 않습니다. [[game/aseprite-json-to-pixi|Aseprite JSON을 PixiJS로]] 참고.'],
    ['TexturePacker의 PixiJS 내보내기','이미 TexturePacker를 쓸 때. 기본으로 회전하는 `pixijs4` 출력이 시험한 네 세트 모두 PixiJS 8.21에서 통과했습니다.'],
    ['PNG 낱장을 하나씩 `Assets.load`','프레임이 몇 장뿐인 시제품. 프레임마다 요청 하나, 텍스처 하나, 아틀라스 없음.']]},
   versions:{body:['PixiJS 8.21.0(Chromium의 WebGL)에서 일반 `Assets.load`로 불러와 사각형, 트림, 앵커, 애니메이션, 회전 프레임, 여러 페이지 시트를 다시 읽고 모든 프레임을 원본과 비교했습니다. 예시의 수치는 그 실행에서 읽어 낸 값입니다. API 이름은 PixiJS 8 API 문서를 따릅니다.'],sources:[S.pixiSheet,S.pixiAnim,S.pixiSource]}
  },
  ja:{
   answer:'PixiJS 8はJSONファイル1つからスプライトシートを読み込みます。`const sheet = await Assets.load("run.json")`が`meta.image`に書かれたPNGまで読み込むと、`sheet.textures["run_0"]`が1フレーム、`sheet.animations["run"]`が1つのアニメーションのテクスチャ一覧になります。Nerulioは再生順のanimationsマップ、ピボットから取ったフレームごとの`anchor`、@2xの倍率違いごとに合わせた`meta.scale`、追加ページ用の`related_multi_packs`を入れてこのJSONを書き、フレームごとのミリ秒は`meta.nerulio`に入れます。回転や複数ページのシートも含め、PixiJS 8.21で確認しています。',
   concept:{title:'PixiJSがJSONから読むもの',body:[
    '`frames`の項目1つがテクスチャ1つになります。`frame`はページ上の矩形、`rotated`は断片が回転して保存されている印、`spriteSourceSize`と`sourceSize`はトリムしたフレームを元の大きさに戻す値です。`anchor`はテクスチャの既定のアンカーになり、そこから作ったスプライトはその点を基準に置かれます（0.5, 1 = 下中央）。',
    'animationsマップはアニメーションごとにフレーム名を並べるだけで、時間の情報はありません。テクスチャだけで作ったAnimatedSpriteは、`animationSpeed`で調整する1つの速さで再生します。フレームごとに時間を与えるには、`time`をミリ秒にした`{ texture, time }`オブジェクトを渡します。標準の形式にこの値の置き場がないため、Nerulioは`meta.nerulio.animations`にミリ秒を保存します。',
    '`meta.scale`はページの解像度です。"2"なら@2xページのテクスチャはPixiJSの単位で@1xと同じ大きさになり、細かさだけが2倍になります。追加ページは`meta.related_multi_packs`に名前があり、最初のJSONと一緒に読み込まれます。'],
    terms:[['テクスチャ','1フレーム：ページの矩形とトリム、回転、既定のアンカー。'],['anchor','スプライトの位置に置かれるテクスチャ上の点。各軸0–1。'],['animations','名前 → フレーム名の順序付きリスト。PixiJSがテクスチャの配列に変えます。'],['meta.scale','ページの解像度。@1xは"1"、@2xは"2"。']]},
   example:{title:'例：走りの1フレームを、ファイルとPixiJSで並べて見る',lines:[
    'run.json（ページ run.png 38 × 50、"scale": "1"）',
    '"run_0": { "frame": {"x":0,"y":34,"w":18,"h":15}, "rotated": false, "trimmed": true,',
    '           "spriteSourceSize": {"x":10,"y":10,"w":18,"h":15}, "sourceSize": {"w":40,"h":29},',
    '           "anchor": {"x":0.5,"y":1} }',
    '"animations": { "run": ["run_0","run_1","run_2","run_3","run_4","run_5"] }',
    '"meta": { …, "nerulio": { "animations": { "run": { "fps":10, "durationsMs":[100,100,100,100,100,100] } } } }',
    '',
    'PixiJS 8.21がrun_0について読み戻した値：',
    '  frame 18 × 15、位置 (0, 34)   trim (10, 10)   orig 40 × 29   rotate 0',
    '  new Sprite(texture)：幅40、高さ29、anchor (0.5, 1)'],
    after:'回転を許可すると同じ6フレームが33 × 57に収まり、うち5枚が回転して保存されます。検証の実行でPixiJS 8.21は回転したフレームを正しい向きで描いたため、PixiJSプリセットは回転を許可しています。'},
   outputs:{rows:[
    ['run.json','`anchor`付きのフレーム、最初のページのanimationsマップ、`meta.scale`、複数ページなら`meta.related_multi_packs`、アニメーションごとのfps・ループ・方向・`durationsMs`を持つ`meta.nerulio`。'],
    ['run.png','ページ。倍率違いがあれば`run@2x.png`と専用の`run@2x.json`なども。'],
    ['README-PIXI.md','このバンドルを読み込むコード。書き出したフレーム時間を使うAnimatedSprite付き。']]},
   target:{title:'PixiJS 8で使う',steps:[
    '`run.json`と`run.png`をアプリの公開アセットの同じフォルダーに置きます。JSONの`meta.image`がPNGの名前です。',
    'ドット絵なら、何かを読み込む前に`TextureSource.defaultOptions.scaleMode = "nearest"`を設定します。',
    '`const sheet = await Assets.load("assets/run.json")`。静止フレームは`new Sprite(sheet.textures["run_0"])`です。',
    'アニメーション全体を1つの速さで：`const hero = new AnimatedSprite(sheet.animations["run"])`、`hero.animationSpeed = …`、`hero.play()`。',
    '書き出した時間どおりに：`const ms = sheet.data.meta.nerulio.animations.run.durationsMs`のあと`new AnimatedSprite(sheet.animations.run.map((texture, i) => ({ texture, time: ms[i] })))`、`hero.play()`、`app.stage.addChild(hero)`。']},
   verify:{steps:[
    '`Object.keys(sheet.textures)`にrun_0 … run_5があるはずです。',
    '`new Sprite(sheet.textures.run_0)`は幅40・高さ29：保存された18 × 15の断片ではなく、フレーム全体の大きさのはずです。',
    '4倍に拡大します。最近傍なら縁は四角いままです。ぼやけるなら、読み込み前にスケールモードを設定していません。']},
   trouble:{rows:[
    ['`sheet.animations`がundefinedか空','JSONにanimationsマップがない（フレームだけを書く書き出しは多い）、または複数ページのシートの後ろのページを見ている','JSONの最上位に`animations`があるか確認。複数ページなら最初のページにある','タグ付きで書き出すか、リストを自分で作る：`["run_0", …].map(n => sheet.textures[n])`'],
    ['スプライトが左上の角でぶら下がる・違う場所に置かれる','JSONに`anchor`がない、またはコードで上書きしている','`sprite.anchor.x`、`sprite.anchor.y`','書き出したアンカーを使うか、書き出し前に[[game/sprite-pivot-editor|ピボットエディター]]でピボットを設定'],
    ['@2xシートが2倍の大きさで描かれる','そのJSONに`"scale": "1"`と書かれている','`sheet.data.meta.scale`','"2"に直すか、倍率違いで書き出す。[[game/pixijs-2x-spritesheet-scale|@2xの倍率の問題]]を参照'],
    ['アニメーションがエディターより速い・遅い','テクスチャだけを渡すと、タグのミリ秒ではなく`animationSpeed`（既定1）で決まる1つの速さで再生される','望む時間と`hero.animationSpeed`を比べる','書き出したミリ秒で`{ texture, time }`オブジェクトを使うか、`animationSpeed`を調整'],
    ['ドット絵がぼやける','PixiJS既定の線形スケーリング','テクスチャソースの`scaleMode`','`Assets.load`の前に`TextureSource.defaultOptions.scaleMode = "nearest"`']]},
   alternatives:{rows:[
    ['PixiJSで読むAsepriteのJSON','すでにAsepriteから書き出した絵のとき。PixiJSはフレームは読みますが、`frameTags`からアニメーションは作りません。[[game/aseprite-json-to-pixi|AsepriteのJSONをPixiJSへ]]を参照。'],
    ['TexturePackerのPixiJS書き出し','すでにTexturePackerを使っているとき。既定で回転する`pixijs4`の出力は、試した4セットすべてでPixiJS 8.21に合格しました。'],
    ['PNGを1枚ずつ`Assets.load`','フレームが数枚だけの試作。フレームごとにリクエスト1つとテクスチャ1つ、アトラスなし。']]},
   versions:{body:['PixiJS 8.21.0（ChromiumのWebGL）で通常の`Assets.load`により読み込み、矩形、トリム、アンカー、アニメーション、回転したフレーム、複数ページのシートを読み戻して、全フレームを元画像と比較しました。例の数値はその実行で読み戻した値です。API名はPixiJS 8のAPIリファレンスに従います。'],sources:[S.pixiSheet,S.pixiAnim,S.pixiSource]}
  }
 },
 'game/defold-atlas':{
  type:'engine',
  intent:{primary:'turn frames or a sprite sheet into a Defold atlas with animation groups',secondary:['why Defold needs separate frame images','atlas vs tile source','fps per animation group'],
   goal:'a Defold sprite component that plays the animations from an .atlas or .tilesource',input:'a sheet (after Apply), numbered frames, a GIF or an .aseprite file',output:'frame PNGs + .atlas + tile image + .tilesource under assets/run/ (named after the frames)',target:'Defold (built with bob.jar 1.13.1)',support:'partial',
   evidence:['src/game/export/engines.js (defoldFiles)','docs/STUDIO-PACK.md (Defold bob.jar 1.13.1 builds, UVs read back)','docs/ENGINE-VERIFY.md (defold_runner: built, not run)'],
   external:['Defold manual: Atlas (animation groups, extrude borders)','Defold manual: Tile source (1-based tiles, start/end tile)','Defold API: sprite.play_flipbook','Defold manual: project settings (texture filters)']},
  en:{
   answer:'A Defold `.atlas` is not a packed image: it lists separate image files and animation groups, and Defold packs them itself when the project builds. A sheet you already have therefore has to go back to one PNG per frame. Nerulio writes those frame PNGs (full canvas, so frames stay aligned), an `.atlas` with one animation group per tag and a `.tilesource` with the same animations on a grid, all in one folder, `/assets/run/` for frames named run. Defold\'s builder bob.jar 1.13.1 built both and the built texture was read back; the editor and a running game were not used.',
   concept:{title:'How Defold turns images into an animation',body:[
    'An atlas resource is a list of images plus animation groups. Each group has an Id, a playback mode such as Loop Forward or Once Ping Pong, and one Fps; its images play in the listed order. At build time Defold packs every image into texture pages, and the atlas properties Margin, Inner Padding and Extrude Borders control spacing and the repeated edge pixels.',
    'A tile source instead cuts one image into equal tiles, numbered from 1 at the top left, left to right and row by row. An animation there is a run of adjacent tiles from Start Tile to End Tile, again with a playback mode and an fps.',
    'A Sprite component takes an atlas or a tile source as its Image and plays one animation: its Default Animation, or the one a script starts with `sprite.play_flipbook`. There is no per-frame duration: every frame of a group lasts 1 ÷ fps seconds.'],
    terms:[['Animation group','A named list of images in an atlas, with a playback mode and an fps.'],['Extrude Borders','How many times the edge pixels are repeated around each image; Nerulio\'s .atlas sets 2.'],['Tile source','One grid image with tile size, margin, spacing and tile-range animations.'],['Playback','PLAYBACK_LOOP_FORWARD, PLAYBACK_ONCE_PINGPONG and so on, as written in the file.']]},
   example:{title:'Example: the six-frame run as a Defold bundle',lines:[
    'input: 6 frames of 40 × 29, tag "run" at 10 fps, looping',
    '',
    'assets/run/frames/run_0.png … run_5.png   6 images, 40 × 29 each (trim off)',
    'assets/run/run.atlas',
    '  images { image: "/assets/run/frames/run_0.png"  sprite_trim_mode: SPRITE_TRIM_MODE_OFF } …',
    '  animations { id: "run"  images {…} × 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '  margin: 0   extrude_borders: 2   inner_padding: 0',
    'assets/run/run.tilesource',
    '  image: "/assets/run/run_tiles.png"   3 × 2 tiles = 120 × 58 px',
    '  tile_width: 40   tile_height: 29',
    '  animations { id: "run"  start_tile: 1  end_tile: 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '',
    'one frame = 1 / 10 fps = 100 ms; one cycle of 6 frames = 0.6 s'],
    after:'Mixed durations cannot be kept: frames of 100, 100 and 150 ms play at the group\'s single fps, and the export notes say so. A reverse tag is written as reversed image order with forward playback; a ping-pong tag uses Defold\'s own ping-pong mode.'},
   outputs:{rows:[
    ['frames/run_0.png …','One full-canvas PNG per frame (trim off, so every frame keeps its place).'],
    ['run.atlas','The frame images plus one animation group per tag (playback, fps) and `extrude_borders: 2`.'],
    ['run_tiles.png, run.tilesource','The same frames on one grid with a shared pivot, and the animations as tile ranges.'],
    ['README-DEFOLD.md','Where the folder must go and how to pick an animation.']]},
   target:{title:'Use it in Defold',steps:[
    'Copy the exported folder into the project so that it sits at `/assets/run/`: the paths inside the `.atlas` and `.tilesource` start with that prefix. If you put it elsewhere, search and replace the prefix in both files.',
    'Add a Sprite component to a game object, set its Image to `run.atlas` (or `run.tilesource`) and its Default Animation to `run`.',
    'From a script, switch animations with `sprite.play_flipbook("#sprite", "run")`; an optional third argument is a function called when a non-looping animation has finished.',
    'For pixel art, set Default Texture Min Filter and Default Texture Mag Filter in the Graphics section of `game.project` to nearest filtering.',
    'Build the project: Defold packs the frame images into its own texture pages at this point, so Nerulio\'s page layout does not matter for this target.']},
   verify:{steps:[
    'Open `run.atlas` in the editor: the `run` group lists six images in order.',
    'Run the game: `run` repeats every 0.6 s (six frames at 10 fps).',
    'Frames do not shift while playing, because every frame image is the full 40 × 29 canvas.']},
   trouble:{rows:[
    ['Build error about an image that is not found','The folder is not at `/assets/run/`, so the absolute paths in the `.atlas` point nowhere','Open the .atlas as text and compare the paths with where the files are','Move the folder, or replace the `/assets/run/` prefix in both files'],
    ['Frames with different durations all play at one speed','A Defold animation group has one fps','The export notes; `fps:` in the group','Split the tag into groups with their own fps, or even out the durations in the Studio'],
    ['A fractional frame rate became a whole number','Defold stores fps as an integer, so 7.5 fps is rounded','The export notes say fractional fps were rounded','Choose durations that give a whole fps: 125 ms → 8 fps, 100 ms → 10 fps'],
    ['Pixel art looks blurry','Linear texture filtering','The Graphics filters in game.project, or the sprite material\'s sampler','Switch both filters to nearest'],
    ['Edges pick up neighbouring pixels when the sprite is scaled','Too little padding in Defold\'s own packing for the filter used','`extrude_borders` and `inner_padding` in the .atlas','Raise Extrude Borders or Inner Padding in the atlas properties']]},
   alternatives:{rows:[
    ['Your own frame PNGs in a new atlas in the Defold editor','You already have the frames as separate files: this is Defold\'s native route and needs no export. If you only have a sheet, [[game/sprite-sheet-to-png-frames|split it into PNG frames]] first.'],
    ['A tile source pointed at the original sheet','The sheet is a clean grid of equal cells: set tile width, height, margin and spacing and define the animations as tile ranges yourself.']]},
   versions:{body:['Built with Defold bob.jar 1.13.1 (Java 25) in a throw-away project with one Sprite component. Animation ids, tile ranges, fps and playback were read from the built texture set, and every frame was cut from the built texture with its UVs and compared with its source. The Defold editor and a running game were not used, so the label is "built", not "verified". Defold terms follow the Defold manuals.'],sources:[S.defoldAtlas,S.defoldTile,S.defoldSprite,S.defoldProject]}
  },
  ko:{
   answer:'Defold의 `.atlas`는 패킹된 이미지가 아닙니다. 개별 이미지 파일과 애니메이션 그룹을 나열해 두면 프로젝트를 빌드할 때 Defold가 직접 패킹합니다. 그래서 이미 있는 시트는 프레임마다 PNG 한 장으로 되돌려야 합니다. Nerulio는 그 프레임 PNG(프레임이 어긋나지 않도록 전체 캔버스), 태그마다 애니메이션 그룹이 하나씩 있는 `.atlas`, 같은 애니메이션을 격자로 담은 `.tilesource`를 한 폴더(프레임 이름이 run이면 `/assets/run/`)에 씁니다. Defold 빌더 bob.jar 1.13.1로 둘 다 빌드하고 빌드된 텍스처를 다시 읽어 확인했으며, 에디터와 실행 중인 게임에서는 확인하지 않았습니다.',
   concept:{title:'Defold가 이미지를 애니메이션으로 만드는 방식',body:[
    '아틀라스 리소스는 이미지 목록과 애니메이션 그룹입니다. 그룹마다 Id, Loop Forward나 Once Ping Pong 같은 재생 방식, 하나의 Fps가 있고, 이미지가 나열된 순서대로 재생됩니다. 빌드할 때 Defold가 모든 이미지를 텍스처 페이지로 패킹하며, 아틀라스 속성의 Margin, Inner Padding, Extrude Borders가 간격과 가장자리 반복 픽셀을 정합니다.',
    '타일 소스는 이미지 한 장을 같은 크기 타일로 자릅니다. 번호는 왼쪽 위의 1부터 왼쪽에서 오른쪽, 위에서 아래 순서입니다. 여기서 애니메이션은 Start Tile부터 End Tile까지 이어진 타일 구간이며, 역시 재생 방식과 fps를 가집니다.',
    '스프라이트 컴포넌트는 아틀라스나 타일 소스를 Image로 받아 애니메이션 하나를 재생합니다. 기본 애니메이션(Default Animation)이거나 스크립트가 `sprite.play_flipbook`으로 시작한 것입니다. 프레임별 길이는 없고, 그룹의 모든 프레임이 1 ÷ fps초씩 보입니다.'],
    terms:[['애니메이션 그룹','아틀라스 안의 이름 붙은 이미지 목록. 재생 방식과 fps가 있음.'],['Extrude Borders','각 이미지 주변에 가장자리 픽셀을 몇 번 반복할지. Nerulio의 .atlas는 2.'],['타일 소스','타일 크기·여백·간격과 타일 구간 애니메이션이 있는 격자 이미지 한 장.'],['재생 방식','파일에 적히는 PLAYBACK_LOOP_FORWARD, PLAYBACK_ONCE_PINGPONG 등.']]},
   example:{title:'예시: 6프레임 달리기를 Defold 번들로',lines:[
    '입력: 40 × 29 프레임 6장, 태그 "run" 10fps, 반복',
    '',
    'assets/run/frames/run_0.png … run_5.png   이미지 6장, 각 40 × 29 (트림 끔)',
    'assets/run/run.atlas',
    '  images { image: "/assets/run/frames/run_0.png"  sprite_trim_mode: SPRITE_TRIM_MODE_OFF } …',
    '  animations { id: "run"  images {…} × 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '  margin: 0   extrude_borders: 2   inner_padding: 0',
    'assets/run/run.tilesource',
    '  image: "/assets/run/run_tiles.png"   타일 3 × 2 = 120 × 58 px',
    '  tile_width: 40   tile_height: 29',
    '  animations { id: "run"  start_tile: 1  end_tile: 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '',
    '한 프레임 = 1 / 10fps = 100ms, 6프레임 한 바퀴 = 0.6초'],
    after:'서로 다른 길이는 유지되지 않습니다. 100, 100, 150ms 프레임도 그룹의 fps 하나로 재생되며, 내보내기 안내에 그렇게 표시됩니다. 역방향 태그는 이미지 순서를 뒤집고 정방향 재생으로 쓰고, 핑퐁 태그는 Defold 자체 핑퐁 모드를 씁니다.'},
   outputs:{rows:[
    ['frames/run_0.png …','프레임마다 전체 캔버스 PNG 한 장(트림 끔, 그래서 모든 프레임이 제자리).'],
    ['run.atlas','프레임 이미지들과 태그마다 애니메이션 그룹 하나(재생 방식, fps), `extrude_borders: 2`.'],
    ['run_tiles.png, run.tilesource','같은 프레임을 피벗을 맞춘 격자 한 장에 담고, 애니메이션을 타일 구간으로 기록.'],
    ['README-DEFOLD.md','폴더를 둘 위치와 애니메이션 고르는 법.']]},
   target:{title:'Defold에서 쓰기',steps:[
    '내보낸 폴더를 프로젝트 안 `/assets/run/` 위치에 복사합니다. `.atlas`와 `.tilesource` 안의 경로가 이 접두어로 시작합니다. 다른 곳에 두면 두 파일에서 접두어를 찾아 바꾸세요.',
    '게임 오브젝트에 Sprite 컴포넌트를 추가하고 Image를 `run.atlas`(또는 `run.tilesource`)로, Default Animation을 `run`으로 설정합니다.',
    '스크립트에서는 `sprite.play_flipbook("#sprite", "run")`으로 애니메이션을 바꿉니다. 세 번째 인수로 반복하지 않는 애니메이션이 끝났을 때 부를 함수를 줄 수 있습니다.',
    '도트 그림이면 `game.project`의 Graphics 항목에서 Default Texture Min Filter와 Default Texture Mag Filter를 최근접 필터로 바꿉니다.',
    '프로젝트를 빌드합니다. 이때 Defold가 프레임 이미지를 자체 텍스처 페이지로 패킹하므로, 이 대상에서는 Nerulio의 페이지 배치가 상관없습니다.']},
   verify:{steps:[
    '에디터에서 `run.atlas`를 열면 `run` 그룹에 이미지 6장이 순서대로 있어야 합니다.',
    '게임을 실행하면 `run`이 0.6초마다 반복돼야 합니다(10fps로 6프레임).',
    '모든 프레임 이미지가 40 × 29 전체 캔버스이므로 재생 중 프레임이 밀리지 않아야 합니다.']},
   trouble:{rows:[
    ['이미지를 찾을 수 없다는 빌드 오류','폴더가 `/assets/run/`에 없어서 `.atlas`의 절대 경로가 가리키는 곳에 파일이 없음','.atlas를 텍스트로 열어 경로와 실제 파일 위치 비교','폴더를 옮기거나 두 파일에서 `/assets/run/` 접두어를 바꿈'],
    ['길이가 다른 프레임이 모두 같은 속도로 재생됨','Defold 애니메이션 그룹은 fps가 하나뿐','내보내기 안내와 그룹의 `fps:` 확인','태그를 fps가 다른 여러 그룹으로 나누거나 Studio에서 길이를 고르게 맞춤'],
    ['소수 프레임 속도가 정수가 됨','Defold는 fps를 정수로 저장해서 7.5fps가 반올림됨','내보내기 안내에 소수 fps를 반올림했다고 표시됨','정수 fps가 되는 길이를 고름: 125ms → 8fps, 100ms → 10fps'],
    ['도트 그림이 흐림','선형 텍스처 필터','game.project의 Graphics 필터나 스프라이트 머티리얼의 샘플러','두 필터를 최근접으로'],
    ['확대하면 가장자리에 이웃 픽셀이 묻어남','쓰는 필터에 비해 Defold 자체 패킹의 여백이 부족함','.atlas의 `extrude_borders`와 `inner_padding`','아틀라스 속성에서 Extrude Borders나 Inner Padding을 올림']]},
   alternatives:{rows:[
    ['Defold 에디터에서 새 아틀라스에 직접 프레임 PNG 넣기','이미 프레임이 낱장 파일로 있을 때. Defold의 기본 방식이라 내보내기가 필요 없습니다. 시트만 있다면 먼저 [[game/sprite-sheet-to-png-frames|PNG 프레임으로 나누세요]].'],
    ['원본 시트를 가리키는 타일 소스','시트가 같은 크기 칸으로 된 깔끔한 격자일 때. 타일 너비·높이·여백·간격을 정하고 애니메이션을 타일 구간으로 직접 정의합니다.']]},
   versions:{body:['Sprite 컴포넌트 하나가 있는 임시 프로젝트에서 Defold bob.jar 1.13.1(Java 25)로 빌드했습니다. 빌드된 텍스처 세트에서 애니메이션 id, 타일 구간, fps, 재생 방식을 읽고, 빌드된 텍스처에서 UV로 모든 프레임을 잘라 원본과 비교했습니다. Defold 에디터와 실행 중인 게임은 쓰지 않았으므로 표시는 "검증"이 아니라 "빌드"입니다. Defold 용어는 공식 매뉴얼을 따릅니다.'],sources:[S.defoldAtlas,S.defoldTile,S.defoldSprite,S.defoldProject]}
  },
  ja:{
   answer:'Defoldの`.atlas`はパック済みの画像ではありません。個別の画像ファイルとアニメーショングループを並べておくと、プロジェクトのビルド時にDefold自身がパックします。そのため手元のシートは、フレームごとに1枚のPNGへ戻す必要があります。Nerulioはそのフレーム画像（位置がずれないようキャンバス全体）、タグごとにアニメーショングループを1つ持つ`.atlas`、同じアニメーションをグリッドにした`.tilesource`を、1つのフォルダー（フレーム名がrunなら`/assets/run/`）に書き出します。Defoldのビルダーbob.jar 1.13.1で両方をビルドし、ビルドされたテクスチャを読み戻して確認しました。エディターや実行中のゲームでは確認していません。',
   concept:{title:'Defoldが画像をアニメーションにする仕組み',body:[
    'アトラスのリソースは、画像のリストとアニメーショングループです。グループごとにId、Loop ForwardやOnce Ping Pongのような再生方法、1つのFpsがあり、画像は並べた順に再生されます。ビルド時にDefoldがすべての画像をテクスチャページへパックし、アトラスのプロパティMargin、Inner Padding、Extrude Bordersが間隔と縁のピクセルの複製を決めます。',
    'タイルソースは1枚の画像を同じ大きさのタイルに切ります。番号は左上の1から始まり、左から右、上から下へ進みます。ここでのアニメーションはStart TileからEnd Tileまでの連続したタイルで、やはり再生方法とfpsを持ちます。',
    'スプライトコンポーネントは、アトラスかタイルソースをImageとして受け取り、アニメーションを1つ再生します。Default Animationか、スクリプトが`sprite.play_flipbook`で始めたものです。フレームごとの長さはなく、グループのどのフレームも1 ÷ fps秒ずつ表示されます。'],
    terms:[['アニメーショングループ','アトラス内の名前付きの画像リスト。再生方法とfpsを持つ。'],['Extrude Borders','各画像の周りに縁のピクセルを何回複製するか。Nerulioの.atlasは2。'],['タイルソース','タイルの大きさ・余白・間隔とタイル範囲のアニメーションを持つグリッド画像1枚。'],['再生方法','ファイルに書かれるPLAYBACK_LOOP_FORWARD、PLAYBACK_ONCE_PINGPONGなど。']]},
   example:{title:'例：6フレームの走りをDefold用バンドルに',lines:[
    '入力：40 × 29のフレーム6枚、タグ "run" 10fps、ループ',
    '',
    'assets/run/frames/run_0.png … run_5.png   画像6枚、各40 × 29（トリムなし）',
    'assets/run/run.atlas',
    '  images { image: "/assets/run/frames/run_0.png"  sprite_trim_mode: SPRITE_TRIM_MODE_OFF } …',
    '  animations { id: "run"  images {…} × 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '  margin: 0   extrude_borders: 2   inner_padding: 0',
    'assets/run/run.tilesource',
    '  image: "/assets/run/run_tiles.png"   タイル3 × 2 = 120 × 58 px',
    '  tile_width: 40   tile_height: 29',
    '  animations { id: "run"  start_tile: 1  end_tile: 6  playback: PLAYBACK_LOOP_FORWARD  fps: 10 }',
    '',
    '1フレーム = 1 / 10fps = 100ms、6フレームで1周 = 0.6秒'],
    after:'異なる長さは保てません。100、100、150msのフレームもグループのfps 1つで再生され、書き出しの注意にそう表示されます。逆方向のタグは画像の順を逆にして順方向で再生し、ピンポンのタグはDefold自身のピンポンモードを使います。'},
   outputs:{rows:[
    ['frames/run_0.png …','フレームごとのキャンバス全体のPNG 1枚（トリムなしなので、全フレームが元の位置）。'],
    ['run.atlas','フレーム画像と、タグごとのアニメーショングループ（再生方法、fps）、`extrude_borders: 2`。'],
    ['run_tiles.png、run.tilesource','同じフレームをピボットをそろえたグリッド1枚にまとめ、アニメーションをタイル範囲で記録。'],
    ['README-DEFOLD.md','フォルダーを置く場所とアニメーションの選び方。']]},
   target:{title:'Defoldで使う',steps:[
    '書き出したフォルダーを、プロジェクト内の`/assets/run/`になるようにコピーします。`.atlas`と`.tilesource`内のパスはこの接頭辞で始まります。別の場所に置くなら、両方のファイルで接頭辞を置換してください。',
    'ゲームオブジェクトにSpriteコンポーネントを追加し、Imageを`run.atlas`（または`run.tilesource`）、Default Animationを`run`にします。',
    'スクリプトからは`sprite.play_flipbook("#sprite", "run")`でアニメーションを切り替えます。3番目の引数に、ループしないアニメーションが終わったときに呼ぶ関数を渡せます。',
    'ドット絵なら、`game.project`のGraphicsセクションでDefault Texture Min FilterとDefault Texture Mag Filterを最近傍フィルターにします。',
    'プロジェクトをビルドします。このときDefoldがフレーム画像を独自のテクスチャページにパックするので、この書き出し先ではNerulioのページ配置は関係ありません。']},
   verify:{steps:[
    'エディターで`run.atlas`を開くと、`run`グループに画像が6枚、順番どおり並んでいるはずです。',
    'ゲームを実行すると、`run`は0.6秒ごとに繰り返すはずです（10fpsで6フレーム）。',
    'どのフレーム画像も40 × 29のキャンバス全体なので、再生中にフレームがずれないはずです。']},
   trouble:{rows:[
    ['画像が見つからないというビルドエラー','フォルダーが`/assets/run/`になく、`.atlas`の絶対パスの先にファイルがない','.atlasをテキストで開き、パスと実際の置き場所を比べる','フォルダーを移すか、両ファイルの`/assets/run/`という接頭辞を置換'],
    ['長さの違うフレームがすべて同じ速さで再生される','Defoldのアニメーショングループはfpsが1つだけ','書き出しの注意と、グループの`fps:`','タグをfpsの違う複数グループに分けるか、Studioで長さをそろえる'],
    ['小数のフレームレートが整数になった','Defoldはfpsを整数で持つため、7.5fpsは丸められる','書き出しの注意に、小数のfpsを丸めたと出る','整数のfpsになる長さにする：125ms → 8fps、100ms → 10fps'],
    ['ドット絵がぼやける','線形のテクスチャフィルター','game.projectのGraphicsのフィルター、またはスプライトのマテリアルのサンプラー','両方のフィルターを最近傍に'],
    ['拡大すると縁に隣のピクセルが混じる','使うフィルターに対して、Defold自身のパックの余白が足りない','.atlasの`extrude_borders`と`inner_padding`','アトラスのプロパティでExtrude BordersかInner Paddingを上げる']]},
   alternatives:{rows:[
    ['Defoldエディターで新しいアトラスに自分のフレームPNGを入れる','すでにフレームが1枚ずつのファイルであるとき。Defold本来の方法で、書き出しは不要です。シートしかないなら、先に[[game/sprite-sheet-to-png-frames|PNGフレームに分割]]してください。'],
    ['元のシートを指すタイルソース','シートが同じ大きさのセルのきれいなグリッドのとき。タイルの幅・高さ・余白・間隔を設定し、アニメーションをタイル範囲で自分で定義します。']]},
   versions:{body:['Spriteコンポーネントを1つ持つ使い捨てのプロジェクトで、Defold bob.jar 1.13.1（Java 25）によりビルドしました。ビルドされたテクスチャセットからアニメーションのid、タイル範囲、fps、再生方法を読み、ビルドされたテクスチャからUVで全フレームを切り出して元画像と比較しました。Defoldエディターや実行中のゲームは使っていないため、表示は「検証済み」ではなく「ビルド済み」です。Defoldの用語は公式マニュアルに従います。'],sources:[S.defoldAtlas,S.defoldTile,S.defoldSprite,S.defoldProject]}
  }
 },
 'game/love2d-quads':{
  type:'engine',
  intent:{primary:'get quads for a sprite atlas in LÖVE (Love2D) without typing rectangles by hand',secondary:['newQuad parameters','drawing trimmed frames from their pivot','animation timing in Lua'],
   goal:'LÖVE draws every frame and plays the animations from a packed atlas, sharp at integer zoom',input:'frame images, a GIF, an .aseprite file or a sheet',output:'atlas PNG + Lua table of quads + nerulio_atlas.lua helper + main.lua',target:'LÖVE 11 (verified 11.5)',support:'full',
   evidence:['src/game/export/engines.js (loveFiles: table, helper, main.lua)','src/game/export/targets.js (LÖVE preset: extrude 1, no rotation)','docs/STUDIO-PACK.md, docs/ENGINE-VERIFY.md (love_runner, LÖVE 11.5)'],
   external:['LÖVE 11.5 source: love.graphics.newQuad(x, y, w, h, sw, sh), setDefaultFilter(min, mag)']},
  en:{
   answer:'LÖVE has no atlas file format: you load the PNG with `love.graphics.newImage`, describe each frame as a Quad with `love.graphics.newQuad(x, y, w, h, pageW, pageH)`, and draw it with `love.graphics.draw(image, quad, x, y, r, sx, sy, ox, oy)`. Nerulio packs the frames and writes those numbers as a Lua table (rectangle, trim offset, pivot, animations with durations in seconds), plus `nerulio_atlas.lua`, a small helper that builds the quads and steps animations. LÖVE 11.5 drew every frame and animation through that helper.',
   concept:{title:'Quads, origins and trimmed frames',body:[
    'A Quad is only a rectangle of an image. Drawing it puts the rectangle\'s top-left corner at x, y, unless you pass an origin offset `ox, oy` as the last arguments of `love.graphics.draw`; that offset is how a frame is drawn from its feet or its centre, and it is also the point scaling and rotation happen around.',
    'A trimmed frame stores only its visible pixels, so the origin has to be corrected by the trim: origin = pivot − trim offset. In the exported table `px, py` is the pivot on the full frame canvas and `ox, oy` is where the stored pixels start on that canvas; the helper draws with the origin `(px − ox, py − oy)`.',
    'The LÖVE preset packs with 1 px extrude and 2 px padding and never rotates, so every quad is upright and has a copy of its edge pixels around it. The helper calls `love.graphics.setDefaultFilter("nearest", "nearest")` before it loads the image, which keeps pixel art sharp at 4×.'],
    terms:[['Quad','A rectangle of an image, made with `love.graphics.newQuad` from x, y, width, height and the image\'s size.'],['ox, oy in draw','The origin offset of `love.graphics.draw`: the point that lands on x, y.'],['ox, oy in the table','Where a trimmed frame\'s stored pixels start on its original canvas.'],['durations','Seconds per frame of an animation, converted from the tag\'s milliseconds.']]},
   example:{title:'Example: one frame from table to screen',lines:[
    'run.lua   (page run.png 64 × 37: extrude 1, padding 2, no rotation)',
    '["run_0"] = { page = 1, x = 1, y = 20, w = 18, h = 15, ox = 10, oy = 10, sw = 40, sh = 29, px = 20, py = 29 }',
    '["run"]   = { loop = true, frames = { "run_0", …, "run_5" }, durations = { 0.1, 0.1, 0.1, 0.1, 0.1, 0.1 } }',
    '',
    'quad   = love.graphics.newQuad(1, 20, 18, 15, 64, 37)',
    'origin = (px − ox, py − oy) = (20 − 10, 29 − 10) = (10, 19)',
    'love.graphics.draw(image, quad, 200, 200, 0, 4, 4, 10, 19)',
    '       → the frame\'s feet at (200, 200), drawn 4× larger',
    '',
    'spacing on the page: run_5 covers x = 1–21, its extrude column is x = 22,',
    'padding x = 23–24, run_3\'s extrude column x = 25, run_3 starts at x = 26'],
    after:'Each stored piece sits 1 px in from its own extrude belt and at least 4 px (1 + 2 + 1) from the next piece, so a quad drawn at a fractional position or scale still samples its own colours at the edge.'},
   outputs:{rows:[
    ['run.lua','`images`, `pages` (w, h), `frames` (x, y, w, h, trim ox/oy, canvas sw/sh, pivot px/py), `order` and `animations` (loop, frames, durations in seconds).'],
    ['nerulio_atlas.lua','`Atlas.load(path)` builds images and quads; `atlas:draw(key, x, y, sx, sy)` draws from the pivot; `atlas:play(name)` returns a small player with `update(dt)` and `draw`.'],
    ['main.lua','An example that plays the first animation at 4× (`love .` in the folder).'],
    ['run.png','The page, with a 1 px extrude around every frame.']]},
   target:{title:'Use it in LÖVE 11',steps:[
    'Put `run.png`, `run.lua` and `nerulio_atlas.lua` in your game folder, next to `main.lua` or in a subfolder whose path you pass to `Atlas.load`.',
    'In `love.load`: `Atlas = require("nerulio_atlas")`, `atlas = Atlas.load("run.lua")`, `anim = atlas:play("run")`.',
    'In `love.update(dt)` call `anim:update(dt)`; in `love.draw()` call `anim:draw(x, y, 4)`, which draws with the pivot at x, y at 4× scale.',
    'Without the helper: `local data = love.filesystem.load("run.lua")()`, create one `love.graphics.newQuad(f.x, f.y, f.w, f.h, page.w, page.h)` per frame, and draw with the origin `f.px − f.ox, f.py − f.oy`.']},
   verify:{steps:[
    'Run `love .` inside the exported folder: `main.lua` plays the first animation at 4×, with square pixel edges.',
    'Draw run_0 and run_4 at the same point: the feet stay on one line although their pieces start at different trim offsets, (10, 10) and (10, 8).',
    'One cycle of `run` lasts 0.6 s: six durations of 0.1 s.']},
   trouble:{rows:[
    ['Frames jump up and down while the animation plays','Each quad is drawn from its own top-left corner, without the trim and pivot origin','Draw two frames at one point and compare with the Studio preview','Pass the origin `px − ox, py − oy`, or use the helper\'s `draw`'],
    ['Pixels are blurry when scaled','The image was loaded before `setDefaultFilter("nearest", "nearest")`, or your own image has a linear filter','Where the filter is set relative to `newImage`','Set the default filter first (the helper does), or call `image:setFilter("nearest", "nearest")`'],
    ['Thin lines from neighbouring frames at fractional positions or scales','A hand-made sheet without extrude or padding around the quads','Watch a frame edge at 4× while moving it by half a pixel','Repack with the LÖVE preset: extrude 1, padding 2'],
    ['`module \'nerulio_atlas\' not found`','The helper is not on the require path','`love.filesystem.getInfo("nerulio_atlas.lua")`','Put it next to `main.lua`, or require it with its folder, for example `require("lib.nerulio_atlas")`'],
    ['An animation stops on its last frame','The tag does not loop, so the player holds the last frame','`data.animations.run.loop`','Set the tag to repeat forever before exporting, or start the player again with `atlas:play("run")`']]},
   alternatives:{rows:[
    ['A uniform grid and quads computed in a loop','All frames have the same size and no trim: `love.graphics.newQuad(col * w, row * h, w, h, sheetW, sheetH)` for each cell, no data file needed.'],
    ['A TexturePacker JSON read with a Lua JSON library','You already have a JSON atlas: create quads from each `frame` rectangle the same way; trimmed frames still need the `spriteSourceSize` offset in the origin.'],
    ['The same frames for another engine','[[game/defold-atlas|Defold atlas]] or [[game/phaser-texture-atlas|Phaser texture atlas]].']]},
   versions:{body:['LÖVE 11.5 (portable build) ran a probe that `require`s the exported `nerulio_atlas.lua`, drew every frame into a Canvas, stepped every animation through the helper\'s player and drew one frame at 4×; the pixels were read back and compared with the source frames. Function signatures are those of the LÖVE 11.5 source.'],sources:[S.loveSrc,S.loveWiki]}
  },
  ko:{
   answer:'LÖVE에는 아틀라스 파일 형식이 없습니다. `love.graphics.newImage`로 PNG를 불러오고, 프레임마다 `love.graphics.newQuad(x, y, w, h, 페이지너비, 페이지높이)`로 쿼드를 만들어 `love.graphics.draw(image, quad, x, y, r, sx, sy, ox, oy)`로 그립니다. Nerulio는 프레임을 패킹하고 이 숫자들을 Lua 테이블(사각형, 트림 오프셋, 피벗, 초 단위 길이가 있는 애니메이션)로 쓰며, 쿼드를 만들고 애니메이션을 넘겨 주는 작은 도우미 `nerulio_atlas.lua`를 함께 줍니다. LÖVE 11.5가 이 도우미로 모든 프레임과 애니메이션을 그렸습니다.',
   concept:{title:'쿼드, 원점, 트림된 프레임',body:[
    '쿼드는 이미지의 사각형일 뿐입니다. 그리면 사각형의 왼쪽 위가 x, y에 놓입니다. `love.graphics.draw`의 마지막 인수로 원점 오프셋 `ox, oy`를 주면 달라지는데, 이것으로 프레임을 발이나 가운데 기준으로 그리며 확대·회전도 이 점을 중심으로 일어납니다.',
    '트림된 프레임은 보이는 픽셀만 저장하므로 원점을 트림만큼 보정해야 합니다. 원점 = 피벗 − 트림 오프셋. 내보낸 테이블에서 `px, py`는 전체 프레임 캔버스 위의 피벗이고 `ox, oy`는 저장된 픽셀이 그 캔버스에서 시작하는 위치입니다. 도우미는 원점 `(px − ox, py − oy)`로 그립니다.',
    'LÖVE 프리셋은 확장 1px, 간격 2px로 패킹하고 회전하지 않으므로 모든 쿼드가 똑바로 서 있고 둘레에 가장자리 픽셀 복사본이 있습니다. 도우미는 이미지를 불러오기 전에 `love.graphics.setDefaultFilter("nearest", "nearest")`를 호출해 4배에서도 도트 그림을 선명하게 유지합니다.'],
    terms:[['쿼드','x, y, 너비, 높이와 이미지 크기로 `love.graphics.newQuad`가 만드는 이미지의 사각형.'],['draw의 ox, oy','`love.graphics.draw`의 원점 오프셋. x, y에 놓이는 점.'],['테이블의 ox, oy','트림된 프레임의 저장 픽셀이 원래 캔버스에서 시작하는 위치.'],['durations','애니메이션 프레임마다의 초. 태그의 밀리초를 변환한 값.']]},
   example:{title:'예시: 테이블에서 화면까지 프레임 하나',lines:[
    'run.lua   (페이지 run.png 64 × 37: 확장 1, 간격 2, 회전 없음)',
    '["run_0"] = { page = 1, x = 1, y = 20, w = 18, h = 15, ox = 10, oy = 10, sw = 40, sh = 29, px = 20, py = 29 }',
    '["run"]   = { loop = true, frames = { "run_0", …, "run_5" }, durations = { 0.1, 0.1, 0.1, 0.1, 0.1, 0.1 } }',
    '',
    'quad   = love.graphics.newQuad(1, 20, 18, 15, 64, 37)',
    '원점   = (px − ox, py − oy) = (20 − 10, 29 − 10) = (10, 19)',
    'love.graphics.draw(image, quad, 200, 200, 0, 4, 4, 10, 19)',
    '       → 프레임의 발이 (200, 200)에 오고 4배로 그려짐',
    '',
    '페이지 위 간격: run_5는 x = 1–21, 그 확장 열은 x = 22,',
    '간격 x = 23–24, run_3의 확장 열 x = 25, run_3은 x = 26에서 시작'],
    after:'저장된 조각은 자기 확장 띠 안쪽 1px에 있고 다음 조각과는 적어도 4px(1 + 2 + 1) 떨어져 있습니다. 그래서 소수 위치나 배율로 그려도 가장자리에서 자기 색을 읽습니다.'},
   outputs:{rows:[
    ['run.lua','`images`, `pages`(w, h), `frames`(x, y, w, h, 트림 ox/oy, 캔버스 sw/sh, 피벗 px/py), `order`, `animations`(반복, 프레임, 초 단위 길이).'],
    ['nerulio_atlas.lua','`Atlas.load(path)`가 이미지와 쿼드를 만들고, `atlas:draw(key, x, y, sx, sy)`가 피벗 기준으로 그리며, `atlas:play(name)`이 `update(dt)`와 `draw`가 있는 작은 플레이어를 돌려줌.'],
    ['main.lua','첫 애니메이션을 4배로 재생하는 예제(폴더에서 `love .`).'],
    ['run.png','모든 프레임 둘레에 1px 확장이 있는 페이지.']]},
   target:{title:'LÖVE 11에서 쓰기',steps:[
    '`run.png`, `run.lua`, `nerulio_atlas.lua`를 게임 폴더에 넣습니다. `main.lua` 옆이나, 경로를 `Atlas.load`에 넘기는 하위 폴더에 둡니다.',
    '`love.load`에서 `Atlas = require("nerulio_atlas")`, `atlas = Atlas.load("run.lua")`, `anim = atlas:play("run")`.',
    '`love.update(dt)`에서 `anim:update(dt)`, `love.draw()`에서 `anim:draw(x, y, 4)`를 호출하면 피벗이 x, y에 오도록 4배로 그립니다.',
    '도우미 없이: `local data = love.filesystem.load("run.lua")()`로 읽고 프레임마다 `love.graphics.newQuad(f.x, f.y, f.w, f.h, page.w, page.h)`를 만든 뒤 원점 `f.px − f.ox, f.py − f.oy`로 그립니다.']},
   verify:{steps:[
    '내보낸 폴더 안에서 `love .`를 실행하면 `main.lua`가 첫 애니메이션을 4배로, 픽셀 가장자리가 네모나게 재생합니다.',
    'run_0과 run_4를 같은 점에 그립니다. 트림 오프셋이 (10, 10), (10, 8)로 달라도 발이 한 선에 있어야 합니다.',
    '`run` 한 바퀴는 0.6초입니다. 0.1초짜리 길이 6개.']},
   trouble:{rows:[
    ['애니메이션 재생 중 프레임이 위아래로 튐','쿼드를 트림·피벗 원점 없이 각자의 왼쪽 위 기준으로 그림','두 프레임을 같은 점에 그려 Studio 미리보기와 비교','원점 `px − ox, py − oy`를 넘기거나 도우미의 `draw` 사용'],
    ['확대하면 픽셀이 흐림','`setDefaultFilter("nearest", "nearest")` 전에 이미지를 불러왔거나, 직접 만든 이미지의 필터가 선형','`newImage`보다 필터 설정이 먼저인지 확인','기본 필터를 먼저 설정(도우미는 그렇게 함)하거나 `image:setFilter("nearest", "nearest")` 호출'],
    ['소수 위치나 배율에서 이웃 프레임의 가는 선이 보임','쿼드 둘레에 확장이나 간격이 없는 손으로 만든 시트','프레임을 반 픽셀씩 움직이며 가장자리를 4배로 관찰','LÖVE 프리셋(확장 1, 간격 2)으로 다시 패킹'],
    ['`module \'nerulio_atlas\' not found`','도우미가 require 경로에 없음','`love.filesystem.getInfo("nerulio_atlas.lua")`','`main.lua` 옆에 두거나 폴더를 붙여 require. 예: `require("lib.nerulio_atlas")`'],
    ['애니메이션이 마지막 프레임에서 멈춤','태그가 반복하지 않아서 플레이어가 마지막 프레임을 유지함','`data.animations.run.loop`','내보내기 전에 태그를 무한 반복으로 바꾸거나 `atlas:play("run")`으로 플레이어를 다시 시작']]},
   alternatives:{rows:[
    ['균일한 격자와 반복문으로 계산한 쿼드','모든 프레임 크기가 같고 트림이 없을 때. 칸마다 `love.graphics.newQuad(col * w, row * h, w, h, sheetW, sheetH)`, 데이터 파일이 필요 없습니다.'],
    ['Lua JSON 라이브러리로 읽는 TexturePacker JSON','이미 JSON 아틀라스가 있을 때. 각 `frame` 사각형으로 같은 방식의 쿼드를 만들되, 트림된 프레임은 원점에 `spriteSourceSize` 오프셋을 반영해야 합니다.'],
    ['같은 프레임을 다른 엔진으로','[[game/defold-atlas|Defold 아틀라스]], [[game/phaser-texture-atlas|Phaser 텍스처 아틀라스]].']]},
   versions:{body:['LÖVE 11.5(포터블 빌드)에서 내보낸 `nerulio_atlas.lua`를 `require`하는 검사용 스크립트를 실행해, 모든 프레임을 Canvas에 그리고 도우미의 플레이어로 모든 애니메이션을 넘기고 프레임 하나를 4배로 그렸습니다. 픽셀을 다시 읽어 원본 프레임과 비교했습니다. 함수 시그니처는 LÖVE 11.5 소스를 따릅니다.'],sources:[S.loveSrc,S.loveWiki]}
  },
  ja:{
   answer:'LÖVEにはアトラスのファイル形式がありません。`love.graphics.newImage`でPNGを読み込み、フレームごとに`love.graphics.newQuad(x, y, w, h, ページ幅, ページ高さ)`でQuadを作り、`love.graphics.draw(image, quad, x, y, r, sx, sy, ox, oy)`で描きます。Nerulioはフレームをパックしてこれらの数値をLuaのテーブル（矩形、トリムのオフセット、ピボット、秒単位の長さを持つアニメーション）として書き、Quadを作ってアニメーションを進める小さなヘルパー`nerulio_atlas.lua`を添えます。LÖVE 11.5がこのヘルパーで全フレームとアニメーションを描画しました。',
   concept:{title:'Quad、原点、トリムしたフレーム',body:[
    'Quadは画像の矩形にすぎません。描くと矩形の左上がx, yに置かれます。`love.graphics.draw`の最後の引数で原点のオフセット`ox, oy`を渡すと変わり、これでフレームを足元や中心を基準に描けます。拡大や回転もこの点を中心に行われます。',
    'トリムしたフレームは見えるピクセルだけを保存しているので、原点をトリム分だけ補正する必要があります。原点 = ピボット − トリムのオフセット。書き出したテーブルでは、`px, py`がフレーム全体のキャンバス上のピボット、`ox, oy`が保存ピクセルのキャンバス上の開始位置です。ヘルパーは原点`(px − ox, py − oy)`で描きます。',
    'LÖVEプリセットは押し出し1px、間隔2pxでパックし、回転しません。そのためどのQuadも正立していて、周りに縁のピクセルの複製があります。ヘルパーは画像を読み込む前に`love.graphics.setDefaultFilter("nearest", "nearest")`を呼ぶので、4倍でもドット絵がくっきりしたままです。'],
    terms:[['Quad','x、y、幅、高さと画像の大きさから`love.graphics.newQuad`で作る、画像の矩形。'],['drawのox, oy','`love.graphics.draw`の原点オフセット。x, yに来る点。'],['テーブルのox, oy','トリムしたフレームの保存ピクセルが、元のキャンバス上で始まる位置。'],['durations','アニメーションのフレームごとの秒数。タグのミリ秒から変換した値。']]},
   example:{title:'例：テーブルから画面までの1フレーム',lines:[
    'run.lua   （ページ run.png 64 × 37：押し出し1、間隔2、回転なし）',
    '["run_0"] = { page = 1, x = 1, y = 20, w = 18, h = 15, ox = 10, oy = 10, sw = 40, sh = 29, px = 20, py = 29 }',
    '["run"]   = { loop = true, frames = { "run_0", …, "run_5" }, durations = { 0.1, 0.1, 0.1, 0.1, 0.1, 0.1 } }',
    '',
    'quad   = love.graphics.newQuad(1, 20, 18, 15, 64, 37)',
    '原点   = (px − ox, py − oy) = (20 − 10, 29 − 10) = (10, 19)',
    'love.graphics.draw(image, quad, 200, 200, 0, 4, 4, 10, 19)',
    '       → フレームの足元が (200, 200) に来て、4倍で描かれる',
    '',
    'ページ上の間隔：run_5はx = 1–21、その押し出し列はx = 22、',
    '間隔x = 23–24、run_3の押し出し列x = 25、run_3はx = 26から'],
    after:'保存された断片は自分の押し出しの帯の1px内側にあり、次の断片とは少なくとも4px（1 + 2 + 1）離れています。そのため小数の位置や倍率で描いても、縁では自分の色を読みます。'},
   outputs:{rows:[
    ['run.lua','`images`、`pages`（w, h）、`frames`（x, y, w, h、トリムのox/oy、キャンバスのsw/sh、ピボットpx/py）、`order`、`animations`（ループ、フレーム、秒単位の長さ）。'],
    ['nerulio_atlas.lua','`Atlas.load(path)`が画像とQuadを作り、`atlas:draw(key, x, y, sx, sy)`がピボット基準で描き、`atlas:play(name)`が`update(dt)`と`draw`を持つ小さなプレーヤーを返す。'],
    ['main.lua','最初のアニメーションを4倍で再生する例（フォルダーで`love .`）。'],
    ['run.png','全フレームの周りに1pxの押し出しがあるページ。']]},
   target:{title:'LÖVE 11で使う',steps:[
    '`run.png`、`run.lua`、`nerulio_atlas.lua`をゲームのフォルダーに入れます。`main.lua`の隣か、パスを`Atlas.load`に渡すサブフォルダーに置きます。',
    '`love.load`で`Atlas = require("nerulio_atlas")`、`atlas = Atlas.load("run.lua")`、`anim = atlas:play("run")`。',
    '`love.update(dt)`で`anim:update(dt)`、`love.draw()`で`anim:draw(x, y, 4)`を呼ぶと、ピボットがx, yに来るように4倍で描きます。',
    'ヘルパーなしなら：`local data = love.filesystem.load("run.lua")()`で読み、フレームごとに`love.graphics.newQuad(f.x, f.y, f.w, f.h, page.w, page.h)`を作って、原点`f.px − f.ox, f.py − f.oy`で描きます。']},
   verify:{steps:[
    '書き出したフォルダーで`love .`を実行すると、`main.lua`が最初のアニメーションを4倍、ピクセルの縁が四角いまま再生します。',
    'run_0とrun_4を同じ点に描きます。トリムのオフセットが(10, 10)と(10, 8)で違っても、足元は一直線にそろうはずです。',
    '`run`の1周は0.6秒です。0.1秒の長さが6つ。']},
   trouble:{rows:[
    ['アニメーション中にフレームが上下に跳ねる','Quadをトリムとピボットの原点なしで、それぞれの左上基準で描いている','2つのフレームを同じ点に描き、Studioのプレビューと比べる','原点`px − ox, py − oy`を渡すか、ヘルパーの`draw`を使う'],
    ['拡大するとピクセルがぼやける','`setDefaultFilter("nearest", "nearest")`より前に画像を読み込んだ、または自分の画像のフィルターが線形','`newImage`との順番でフィルター設定を確認','既定のフィルターを先に設定する（ヘルパーはそうしている）か、`image:setFilter("nearest", "nearest")`を呼ぶ'],
    ['小数の位置や倍率で、隣のフレームの細い線が見える','Quadの周りに押し出しも間隔もない手作りのシート','フレームを半ピクセルずつ動かし、縁を4倍で見る','LÖVEプリセット（押し出し1、間隔2）でパックし直す'],
    ['`module \'nerulio_atlas\' not found`','ヘルパーがrequireのパスにない','`love.filesystem.getInfo("nerulio_atlas.lua")`','`main.lua`の隣に置くか、フォルダー付きでrequireする。例：`require("lib.nerulio_atlas")`'],
    ['アニメーションが最後のフレームで止まる','タグがループしないため、プレーヤーが最後のフレームを保持している','`data.animations.run.loop`','書き出し前にタグを無限ループにするか、`atlas:play("run")`でプレーヤーを作り直す']]},
   alternatives:{rows:[
    ['均一なグリッドとループで計算したQuad','全フレームが同じ大きさでトリムがないとき。セルごとに`love.graphics.newQuad(col * w, row * h, w, h, sheetW, sheetH)`で、データファイルは不要です。'],
    ['LuaのJSONライブラリで読むTexturePackerのJSON','すでにJSONのアトラスがあるとき。各`frame`の矩形から同じようにQuadを作りますが、トリムしたフレームは原点に`spriteSourceSize`のオフセットを反映する必要があります。'],
    ['同じフレームを別のエンジンで','[[game/defold-atlas|Defoldアトラス]]、[[game/phaser-texture-atlas|Phaserのテクスチャアトラス]]。']]},
   versions:{body:['LÖVE 11.5（ポータブル版）で、書き出した`nerulio_atlas.lua`を`require`する検査用スクリプトを実行し、全フレームをCanvasに描き、ヘルパーのプレーヤーで全アニメーションを進め、1フレームを4倍で描きました。ピクセルを読み戻して元のフレームと比較しています。関数のシグネチャはLÖVE 11.5のソースに従います。'],sources:[S.loveSrc,S.loveWiki]}
  }
 },
 'game/spine-atlas':{
  type:'format',
  intent:{primary:'pack images into a Spine / libGDX .atlas and understand its fields',secondary:['bounds, offsets and rotate','trim and rotation in the atlas','use with a Spine skeleton or libGDX TextureAtlas'],
   goal:'an .atlas + PNG pages the Spine runtime reads, with every region drawn in the right place',input:'images or animation frames',output:'.atlas text file + PNG page(s)',target:'Spine runtimes (verified spine-canvas 4.2); libGDX reads the same format (not run)',support:'partial',
   evidence:['src/game/export/engines.js (spineFiles: bounds, offsets from the bottom, rotate:90)','src/game/pack/sprites.js (counter-clockwise rotation for Spine)','docs/STUDIO-PACK.md, docs/ENGINE-VERIFY.md (spine-canvas 4.2.120 runs)'],
   external:['Spine docs: texture atlas format (page and region fields)','Spine docs: texture packing settings']},
  en:{
   answer:'A Spine / libGDX `.atlas` is a text file that describes one or more page images and the named regions on them: for each region `bounds` (x, y, width, height on the page), optional `offsets` (whitespace stripped from the left and bottom, then the original size) and `rotate` when the region was packed turned. Spine skeletons find their attachment images by region name. Nerulio writes this format from any frames, with trim and 90° rotation, and the official Spine runtime spine-canvas 4.2 drew every region, rotated and trimmed ones included. libGDX reads the same format but was not run.',
   concept:{title:'Reading a .atlas file',body:[
    'The file starts with a page: the image file name, then lines such as `size`, `filter` and `pma` (premultiplied alpha). Each region follows as its name and its property lines until the next name; a new page starts with another image name.',
    'Offsets are measured from the bottom-left of the original image, the opposite of JSON atlases, which measure from the top. For a 40 × 29 frame whose visible 18 × 15 pixels start 10 px from the top, the bottom offset is 29 − 10 − 15 = 4.',
    'A rotated region lies turned 90° counter-clockwise on the page, which is the Spine format\'s direction (TexturePacker JSON stores rotated frames clockwise), and `bounds` keeps the unrotated width and height. The runtime turns the region back when it draws it.'],
    terms:[['Page','An image file with its size, texture filter and premultiplied-alpha flag.'],['Region','A named rectangle on a page; skeleton attachments reference it by name.'],['bounds','x and y on the page, then the packed (unrotated) width and height.'],['offsets','Pixels stripped from the left and from the bottom, then the original width and height.'],['rotate','90 (or true) = stored turned 90° counter-clockwise.']]},
   example:{title:'Example: the six run frames as a .atlas (rotation allowed)',lines:[
    'run.png',
    'size:33,57',
    'filter:Nearest,Nearest',
    'pma:false',
    'run_0',
    'bounds:17,23,18,15',
    'offsets:10,4,40,29',
    'rotate:90',
    'run_4',
    'bounds:0,0,16,16',
    'offsets:10,5,40,29',
    '',
    'run_0: 18 × 15 visible pixels, stored turned → covers 15 × 18 on the page at (17, 23)',
    'offsets: left 10, bottom 29 − 10 − 15 = 4, original 40 × 29',
    'run_4: not rotated (16 × 16); bottom 29 − 8 − 16 = 5'],
    after:'Five of the six frames were stored turned, and the page is 33 × 57 instead of 38 × 50 without rotation. Every region keeps its full 40 × 29 size through `offsets`, so attachments do not shift between frames.'},
   mapping:{title:'From a JSON atlas entry to a .atlas region',head:['TexturePacker-style JSON','Spine / libGDX .atlas','How it converts'],rows:[
    ['`frame` {x, y, w, h}','`bounds:x,y,w,h`','Same numbers (unrotated size)'],
    ['`spriteSourceSize` {x, y}','`offsets:` left, bottom','bottom = sourceSize.h − y − h'],
    ['`sourceSize` {w, h}','`offsets:` …, width, height','Same numbers'],
    ['`rotated: true` (stored clockwise)','`rotate:90` (stored counter-clockwise)','The pixels are turned the other way, so the page is drawn again, not relabelled'],
    ['`meta.image`, `meta.size`','page name line, `size:w,h`','Same']]},
   outputs:{rows:[
    ['run.atlas','Pages (`size`, `filter:Nearest,Nearest`, `pma:false`) and one region per frame with `bounds`, `offsets` for trimmed frames and `rotate:90` for turned ones.'],
    ['run.png (run-0.png, run-1.png …)','The page images; several when multipack needs them.'],
    ['README-SPINE-LIBGDX.md','How the format is laid out, and the libGDX loading call.']]},
   target:{title:'Use it with Spine or libGDX',steps:[
    'Name your skeleton\'s attachments (or their paths) like the regions, for example `run_0`: the runtime looks up regions by that name.',
    'Load the `.atlas` with your Spine runtime\'s atlas loader next to the skeleton data; keep the PNG pages in the same folder, because the atlas names them without a path.',
    'libGDX: `new TextureAtlas(Gdx.files.internal("run.atlas"))`, then `findRegion("run_0")`. This path was not run in Nerulio\'s checks.',
    'Allow rotation only when every program that reads the file handles `rotate`; the Spine preset allows it by default.']},
   trouble:{rows:[
    ['A region is missing at runtime','The attachment name and the region name differ: case, file extension or a folder prefix','Search the .atlas for the exact name','Rename the frame before export, or the attachment path in Spine'],
    ['Trimmed regions sit too high or too low in a custom loader','The loader reads the second offset as a top offset','With `offsets:10,4,40,29`, 4 is the margin at the bottom','Use a Spine or libGDX loader, or convert: top = height − bottom − region height'],
    ['Rotated regions appear sideways or mirrored in a custom loader','It ignores `rotate`, or turns the wrong way','Regions with `rotate:90`','Turn rotation off before exporting, or turn the region back clockwise'],
    ['Dark or light fringes around soft edges','The page\'s alpha does not match the `pma` flag and the blend mode','`pma:false` in the page lines','Keep premultiplied alpha off for this export: its page lines always say `pma:false`']]},
   alternatives:{rows:[
    ['Spine\'s own texture packer','You export skeletons from the Spine editor: it packs attachments while exporting and has settings Nerulio lacks, such as a polygon packing mode, bleed and duplicate padding.'],
    ['A JSON atlas instead','The frames are sprite animation rather than skeleton attachments: a JSON atlas carries the animations too; see [[game/pixi-spritesheet-json|PixiJS]] or [[game/phaser-texture-atlas|Phaser]].']]},
   versions:{body:['The official Spine runtime spine-canvas 4.2.120 parsed Nerulio\'s .atlas and drew every region as a region attachment through its SkeletonRenderer, for trimmed ninja frames and rotated archer frames; the pixels matched the source frames. libGDX (Java) was not run. Field meanings follow the Spine atlas format documentation.'],sources:[S.spineAtlas,S.spinePacker]}
  },
  ko:{
   answer:'Spine / libGDX의 `.atlas`는 페이지 이미지 하나 이상과 그 위의 이름 붙은 영역을 설명하는 텍스트 파일입니다. 영역마다 `bounds`(페이지 위 x, y, 너비, 높이), 필요하면 `offsets`(왼쪽과 아래에서 잘라 낸 여백, 그다음 원래 크기), 돌려서 패킹했으면 `rotate`가 붙습니다. Spine 스켈레톤은 영역 이름으로 첨부 이미지를 찾습니다. Nerulio는 어떤 프레임으로든 트림과 90도 회전을 포함해 이 형식을 쓰며, 공식 Spine 런타임 spine-canvas 4.2가 회전·트림된 영역까지 모두 그렸습니다. libGDX도 같은 형식을 읽지만 실행해 보지는 않았습니다.',
   concept:{title:'.atlas 파일 읽는 법',body:[
    '파일은 페이지로 시작합니다. 이미지 파일 이름 다음에 `size`, `filter`, `pma`(미리 곱한 알파) 같은 줄이 옵니다. 이어서 영역마다 이름과 속성 줄이 다음 이름이 나올 때까지 이어지고, 다른 이미지 이름이 나오면 새 페이지입니다.',
    '오프셋은 원래 이미지의 왼쪽 아래를 기준으로 잽니다. 위에서부터 재는 JSON 아틀라스와 반대입니다. 40 × 29 프레임에서 보이는 18 × 15 픽셀이 위에서 10px 아래부터 시작하면, 아래쪽 오프셋은 29 − 10 − 15 = 4입니다.',
    '회전된 영역은 페이지에 반시계 방향 90도로 누워 있습니다. Spine 형식의 방향이며(TexturePacker JSON은 시계 방향으로 저장), `bounds`에는 회전 전 너비와 높이가 그대로 남습니다. 런타임이 그릴 때 영역을 다시 돌려 세웁니다.'],
    terms:[['페이지','크기, 텍스처 필터, 미리 곱한 알파 표시가 있는 이미지 파일.'],['영역(region)','페이지 위의 이름 붙은 사각형. 스켈레톤 첨부가 이름으로 참조합니다.'],['bounds','페이지 위 x, y와 패킹된(회전 전) 너비, 높이.'],['offsets','왼쪽과 아래에서 잘라 낸 픽셀 수, 그다음 원래 너비와 높이.'],['rotate','90(또는 true) = 반시계 방향 90도로 돌려 저장.']]},
   example:{title:'예시: 달리기 프레임 6장을 .atlas로(회전 허용)',lines:[
    'run.png',
    'size:33,57',
    'filter:Nearest,Nearest',
    'pma:false',
    'run_0',
    'bounds:17,23,18,15',
    'offsets:10,4,40,29',
    'rotate:90',
    'run_4',
    'bounds:0,0,16,16',
    'offsets:10,5,40,29',
    '',
    'run_0: 보이는 픽셀 18 × 15, 돌려서 저장 → 페이지 (17, 23)에서 15 × 18을 차지',
    'offsets: 왼쪽 10, 아래 29 − 10 − 15 = 4, 원래 40 × 29',
    'run_4: 회전 없음(16 × 16), 아래 29 − 8 − 16 = 5'],
    after:'6장 중 5장이 돌려 저장됐고, 페이지는 회전 없을 때의 38 × 50 대신 33 × 57입니다. `offsets` 덕분에 모든 영역이 40 × 29 전체 크기를 유지하므로 프레임이 바뀌어도 첨부가 밀리지 않습니다.'},
   mapping:{title:'JSON 아틀라스 항목에서 .atlas 영역으로',head:['TexturePacker 방식 JSON','Spine / libGDX .atlas','변환 방법'],rows:[
    ['`frame` {x, y, w, h}','`bounds:x,y,w,h`','같은 숫자(회전 전 크기)'],
    ['`spriteSourceSize` {x, y}','`offsets:` 왼쪽, 아래','아래 = sourceSize.h − y − h'],
    ['`sourceSize` {w, h}','`offsets:` …, 너비, 높이','같은 숫자'],
    ['`rotated: true`(시계 방향 저장)','`rotate:90`(반시계 방향 저장)','픽셀이 반대로 돌아가 있어 이름만 바꾸는 게 아니라 페이지를 다시 그림'],
    ['`meta.image`, `meta.size`','페이지 이름 줄, `size:w,h`','같음']]},
   outputs:{rows:[
    ['run.atlas','페이지(`size`, `filter:Nearest,Nearest`, `pma:false`)와 프레임마다 영역 하나: `bounds`, 트림된 프레임의 `offsets`, 돌린 프레임의 `rotate:90`.'],
    ['run.png (run-0.png, run-1.png …)','페이지 이미지. 여러 페이지가 필요하면 여러 장.'],
    ['README-SPINE-LIBGDX.md','형식의 구성과 libGDX 불러오기 코드.']]},
   target:{title:'Spine이나 libGDX에서 쓰기',steps:[
    '스켈레톤의 첨부(또는 경로) 이름을 영역 이름과 같게 합니다(예: `run_0`). 런타임이 이 이름으로 영역을 찾습니다.',
    'Spine 런타임의 아틀라스 로더로 스켈레톤 데이터 옆의 `.atlas`를 불러옵니다. 아틀라스가 PNG 페이지를 경로 없이 이름으로만 적으므로 같은 폴더에 두세요.',
    'libGDX: `new TextureAtlas(Gdx.files.internal("run.atlas"))` 후 `findRegion("run_0")`. 이 경로는 Nerulio 검증에서 실행하지 않았습니다.',
    '파일을 읽는 모든 프로그램이 `rotate`를 처리할 때만 회전을 허용하세요. Spine 프리셋은 기본으로 허용합니다.']},
   trouble:{rows:[
    ['런타임에서 영역을 찾지 못함','첨부 이름과 영역 이름이 다름: 대소문자, 확장자, 폴더 접두어','.atlas에서 정확한 이름을 검색','내보내기 전에 프레임 이름을 바꾸거나 Spine의 첨부 경로를 수정'],
    ['직접 만든 로더에서 트림된 영역이 너무 높거나 낮게 놓임','로더가 두 번째 오프셋을 위쪽 여백으로 읽음','`offsets:10,4,40,29`에서 4는 아래쪽 여백','Spine·libGDX 로더를 쓰거나 변환: 위 = 높이 − 아래 − 영역 높이'],
    ['직접 만든 로더에서 회전된 영역이 옆으로 눕거나 뒤집힘','`rotate`를 무시하거나 반대로 돌림','`rotate:90`이 있는 영역','내보내기 전에 회전을 끄거나 영역을 시계 방향으로 되돌림'],
    ['부드러운 가장자리에 어둡거나 밝은 테두리','페이지의 알파가 `pma` 표시·블렌드 모드와 맞지 않음','페이지 줄의 `pma:false`','이 내보내기에서는 미리 곱한 알파를 끄세요. 페이지 줄이 항상 `pma:false`라고 씁니다']]},
   alternatives:{rows:[
    ['Spine 자체 텍스처 패커','Spine 에디터에서 스켈레톤을 내보낼 때. 내보내면서 첨부를 패킹하며 폴리곤 패킹 모드, 블리드, 중복 간격처럼 Nerulio에 없는 설정이 있습니다.'],
    ['대신 JSON 아틀라스','프레임이 스켈레톤 첨부가 아니라 스프라이트 애니메이션일 때. JSON 아틀라스는 애니메이션도 담습니다. [[game/pixi-spritesheet-json|PixiJS]]나 [[game/phaser-texture-atlas|Phaser]] 참고.']]},
   versions:{body:['공식 Spine 런타임 spine-canvas 4.2.120이 Nerulio의 .atlas를 읽고 SkeletonRenderer로 모든 영역을 영역 첨부로 그렸습니다. 트림된 닌자 프레임과 회전된 궁수 프레임에서 픽셀이 원본과 일치했습니다. libGDX(Java)는 실행하지 않았습니다. 필드의 뜻은 Spine 아틀라스 형식 문서를 따릅니다.'],sources:[S.spineAtlas,S.spinePacker]}
  },
  ja:{
   answer:'Spine / libGDXの`.atlas`は、1枚以上のページ画像と、その上の名前付き領域を記述するテキストファイルです。領域ごとに`bounds`（ページ上のx, y、幅、高さ）、必要なら`offsets`（左と下から取り除いた余白、続いて元の大きさ）、回転してパックしたなら`rotate`が付きます。Spineのスケルトンは領域名でアタッチメントの画像を探します。Nerulioはどんなフレームからでも、トリムと90度回転を含めてこの形式を書き出し、公式のSpineランタイムspine-canvas 4.2が回転・トリムした領域も含めて全領域を描画しました。libGDXも同じ形式を読みますが、実行はしていません。',
   concept:{title:'.atlasファイルの読み方',body:[
    'ファイルはページから始まります。画像ファイル名の後に`size`、`filter`、`pma`（乗算済みアルファ）などの行が続きます。その後、領域ごとに名前とプロパティの行が次の名前まで続き、別の画像名が出てきたら新しいページです。',
    'オフセットは元画像の左下を基準に測ります。上から測るJSONアトラスとは逆です。40 × 29のフレームで、見える18 × 15ピクセルが上から10pxの位置から始まるなら、下のオフセットは29 − 10 − 15 = 4です。',
    '回転した領域は、ページ上で反時計回りに90度寝かせてあります。これがSpine形式の向きで（TexturePackerのJSONは時計回りで保存）、`bounds`には回転前の幅と高さがそのまま残ります。ランタイムは描くときに領域を元に戻します。'],
    terms:[['ページ','大きさ、テクスチャフィルター、乗算済みアルファのフラグを持つ画像ファイル。'],['領域（region）','ページ上の名前付きの矩形。スケルトンのアタッチメントが名前で参照します。'],['bounds','ページ上のx、yと、パックした（回転前の）幅と高さ。'],['offsets','左と下から取り除いたピクセル数、続いて元の幅と高さ。'],['rotate','90（またはtrue）= 反時計回りに90度回して保存。']]},
   example:{title:'例：走りの6フレームを.atlasに（回転あり）',lines:[
    'run.png',
    'size:33,57',
    'filter:Nearest,Nearest',
    'pma:false',
    'run_0',
    'bounds:17,23,18,15',
    'offsets:10,4,40,29',
    'rotate:90',
    'run_4',
    'bounds:0,0,16,16',
    'offsets:10,5,40,29',
    '',
    'run_0：見えるピクセル18 × 15、回して保存 → ページの (17, 23) で15 × 18を占める',
    'offsets：左10、下 29 − 10 − 15 = 4、元の大きさ40 × 29',
    'run_4：回転なし（16 × 16）、下 29 − 8 − 16 = 5'],
    after:'6フレーム中5枚が回して保存され、ページは回転なしの38 × 50ではなく33 × 57です。`offsets`によってどの領域も40 × 29の大きさを保つので、フレームが変わってもアタッチメントはずれません。'},
   mapping:{title:'JSONアトラスの項目から.atlasの領域へ',head:['TexturePacker形式のJSON','Spine / libGDX .atlas','変換のしかた'],rows:[
    ['`frame` {x, y, w, h}','`bounds:x,y,w,h`','同じ数値（回転前のサイズ）'],
    ['`spriteSourceSize` {x, y}','`offsets:` 左、下','下 = sourceSize.h − y − h'],
    ['`sourceSize` {w, h}','`offsets:` …、幅、高さ','同じ数値'],
    ['`rotated: true`（時計回りで保存）','`rotate:90`（反時計回りで保存）','ピクセルの向きが逆なので、名前の付け替えではなくページを描き直す'],
    ['`meta.image`、`meta.size`','ページ名の行、`size:w,h`','同じ']]},
   outputs:{rows:[
    ['run.atlas','ページ（`size`、`filter:Nearest,Nearest`、`pma:false`）と、フレームごとの領域：`bounds`、トリムしたフレームの`offsets`、回したフレームの`rotate:90`。'],
    ['run.png（run-0.png、run-1.png …）','ページ画像。マルチパックが必要なら複数枚。'],
    ['README-SPINE-LIBGDX.md','形式の構成と、libGDXで読み込むコード。']]},
   target:{title:'SpineやlibGDXで使う',steps:[
    'スケルトンのアタッチメント（またはそのパス）の名前を、領域名と同じにします（例：`run_0`）。ランタイムはこの名前で領域を探します。',
    'Spineランタイムのアトラスローダーで、スケルトンデータの隣の`.atlas`を読み込みます。アトラスはPNGのページをパスなしの名前で書いているので、同じフォルダーに置いてください。',
    'libGDX：`new TextureAtlas(Gdx.files.internal("run.atlas"))`のあと`findRegion("run_0")`。この経路はNerulioの検証では実行していません。',
    'ファイルを読むすべてのプログラムが`rotate`を扱えるときだけ回転を許可してください。Spineプリセットは既定で許可しています。']},
   trouble:{rows:[
    ['ランタイムで領域が見つからない','アタッチメント名と領域名が違う：大文字小文字、拡張子、フォルダーの接頭辞','.atlasで正確な名前を検索','書き出し前にフレーム名を変えるか、Spine側のアタッチメントのパスを直す'],
    ['自作ローダーで、トリムした領域が高すぎる・低すぎる','ローダーが2番目のオフセットを上の余白として読んでいる','`offsets:10,4,40,29`の4は下の余白','SpineかlibGDXのローダーを使うか、上 = 高さ − 下 − 領域の高さ で変換'],
    ['自作ローダーで、回転した領域が横倒し・反転する','`rotate`を無視している、または逆向きに回している','`rotate:90`のある領域','書き出し前に回転をオフにするか、領域を時計回りに戻す'],
    ['柔らかい縁の周りに暗い・明るい縁取り','ページのアルファが`pma`フラグやブレンドモードと合っていない','ページ行の`pma:false`','この書き出しでは乗算済みアルファをオフに。ページ行は常に`pma:false`と書かれる']]},
   alternatives:{rows:[
    ['Spine自体のテクスチャパッカー','Spineエディターからスケルトンを書き出すとき。書き出しと同時にアタッチメントをパックし、ポリゴンのパッキングモード、ブリード、複製パディングなどNerulioにない設定があります。'],
    ['代わりにJSONアトラス','フレームがスケルトンのアタッチメントではなくスプライトアニメーションのとき。JSONアトラスはアニメーションも運べます。[[game/pixi-spritesheet-json|PixiJS]]や[[game/phaser-texture-atlas|Phaser]]を参照。']]},
   versions:{body:['公式のSpineランタイムspine-canvas 4.2.120がNerulioの.atlasを読み、SkeletonRendererで全領域を領域アタッチメントとして描きました。トリムした忍者のフレームと回転した弓兵のフレームで、ピクセルが元画像と一致しています。libGDX（Java）は実行していません。フィールドの意味はSpineのアトラス形式のドキュメントに従います。'],sources:[S.spineAtlas,S.spinePacker]}
  }
 },
 'game/sparrow-xml-spritesheet':{
  type:'format',
  intent:{primary:'make a spritesheet with Starling / Sparrow XML (the FNF-style "spritesheet and XML")',secondary:['what SubTexture, frameX and frameY mean','the Phaser 3.90 trimmed-XML bug and the Phaser 3 preset','animations from frame-name prefixes'],
   goal:'a PNG + XML pair whose frames an engine cuts and places correctly',input:'numbered frames, a GIF, an .aseprite file or a sheet',output:'one XML per page + PNG page(s)',target:'Phaser 4.2 (both presets), Phaser 3.90 (Phaser 3 preset); HaxeFlixel / FNF engines not tested',support:'partial',
   evidence:['src/game/export/engines.js (starlingFiles)','src/game/export/targets.js (starling and sparrow-phaser3 presets)','docs/STUDIO-PACK.md (2 of 49 runs fail: trimmed XML in Phaser 3.90)','docs/ENGINE-VERIFY.md'],
   external:['Phaser 3.90 source: AtlasXML passes (width, height, frameX, frameY, frameWidth, frameHeight) to setTrim; setTrim(actualWidth, actualHeight, destX, destY, destWidth, destHeight)','Phaser LoaderPlugin: atlasXML']},
  en:{
   answer:'Sparrow / Starling XML (the "spritesheet and XML" of many FNF mods) describes a packed PNG as a `TextureAtlas` element (`imagePath="…"`) with one `SubTexture` per frame: `name`, `x`, `y`, `width`, `height`, and for trimmed frames `frameX`, `frameY` (negative offsets) with `frameWidth`, `frameHeight` (the original size). Nerulio writes one XML per page and never rotates. Phaser 4.2 draws trimmed frames correctly; Phaser 3.90 does not, so for Phaser 3 use the "Sparrow XML (Phaser 3)" preset, which turns trim off. HaxeFlixel and FNF engines were not tested.',
   concept:{title:'Reading a SubTexture',body:[
    'Every frame is one element. `x`, `y`, `width` and `height` cut the stored pixels out of the page. If the frame was trimmed, `frameX` and `frameY` say where the full frame begins relative to those pixels, as negative numbers because the full frame starts up and to the left, and `frameWidth`, `frameHeight` give its size.',
    'Animations are not stored in the file; they are built from frame names, for example every SubTexture whose name starts with `run_`. Phaser does this with `generateFrameNames` and a prefix, so the names matter more here than in JSON atlases that carry an animation list.',
    'The bug to know: Phaser 3.90\'s AtlasXML parser passes the trimmed size and the full size to `setTrim` in the wrong order, so trimmed XML frames are drawn wrong in Phaser 3.90. The same files are drawn correctly in Phaser 4.2. The "Sparrow XML (Phaser 3)" preset turns trim off, so no frame carries `frameX`/`frameY`, and it passes in both versions. In Nerulio\'s engine runs these were the only 2 failures among 49.'],
    terms:[['TextureAtlas','The root element; `imagePath` names the PNG page, with its width and height.'],['SubTexture','One frame: its name and rectangle on the page.'],['frameX, frameY','Negative offset of the full frame from the stored pixels (trimmed frames only).'],['frameWidth, frameHeight','Size of the untrimmed frame.'],['pivotX, pivotY','Pivot in pixels on the full frame; Nerulio writes it, Phaser\'s XML loader does not read it.']]},
   example:{title:'Example: one frame in both presets, and the Phaser 3.90 bug',lines:[
    'Starling / Sparrow XML preset (trim on), page 38 × 50',
    'SubTexture name="run_0" x="0" y="34" width="18" height="15"',
    '            frameX="-10" frameY="-10" frameWidth="40" frameHeight="29" pivotX="20" pivotY="29"',
    '',
    '"Sparrow XML (Phaser 3)" preset (trim off), page 82 × 91',
    'SubTexture name="run_0" x="0" y="0" width="40" height="29" pivotX="20" pivotY="29"',
    '',
    'Phaser 3.90 AtlasXML calls   setTrim(18, 15, 10, 10, 40, 29)',
    'Frame.setTrim expects        setTrim(40, 29, 10, 10, 18, 15)  (full size first, trimmed size last)',
    '',
    'cost of trim off here: 82 × 91 = 7,462 px² instead of 38 × 50 = 1,900 px² (3.9×)'],
    after:'Phaser\'s JSON parser passes `sourceSize` first and `spriteSourceSize` last, which is why a trimmed JSON atlas is fine in Phaser 3.90 while the same frames in XML are not.'},
   outputs:{rows:[
    ['run.xml','`TextureAtlas` element (`imagePath="run.png"`, width, height) with one `SubTexture` per frame; frameX, frameY, frameWidth and frameHeight only on trimmed frames; pivotX and pivotY in pixels.'],
    ['run.png','The page. With several pages: run-0.png with run-0.xml, run-1.png with run-1.xml, and so on.']]},
   target:{title:'Load it',steps:[
    'Phaser 4.2: `this.load.atlasXML("run", "run.png", "run.xml")`, then `this.add.sprite(x, y, "run", "run_0")`; either XML preset works.',
    'Phaser 3.90: export with "Sparrow XML (Phaser 3)" and load it the same way.',
    'Build the animation from the names: `this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`.',
    'Other engines (HaxeFlixel, FNF engines, Starling) read the same SubTexture layout, but they were not run here: compare one trimmed frame with its source image before relying on it.']},
   trouble:{rows:[
    ['Trimmed frames drawn shifted or at the wrong size, only in Phaser 3.90','Phaser 3.90\'s AtlasXML passes the trimmed and full sizes to `setTrim` in the wrong order','The XML has `frameX` on those frames, and the same files look right in Phaser 4.2','Use the "Sparrow XML (Phaser 3)" preset (trim off), the JSON atlas (trim works there), or Phaser 4'],
    ['Frames turned or mirrored','The XML came from a packer that rotated frames (`rotated="true"`), which Phaser\'s XML parser does not read','Search the XML for `rotated`','Repack without rotation; Nerulio\'s XML export refuses a rotated pack'],
    ['An animation picks up the wrong frames','The prefix is too broad: `run_` also matches `run_attack_0`','List the frame names in the XML','Give each animation a unique prefix before exporting'],
    ['The sprite\'s origin ignores the pivot','Phaser\'s XML loader reads only the rectangle and trim attributes, not pivotX/pivotY','The sprite origin stays at the centre','Call `sprite.setOrigin(0.5, 1)`, or use the JSON atlas, whose `pivot` Phaser applies as the origin']]},
   alternatives:{rows:[
    ['Phaser JSON atlas','For a Phaser game: trim works in 3.90 and 4.2, pivots become sprite origins and an animations file comes with it. See [[game/phaser-texture-atlas|Phaser texture atlas]].'],
    ['Preview or convert an existing FNF sheet','To turn a spritesheet + XML you already have into a GIF, see [[game/fnf-spritesheet-to-gif|FNF spritesheet to GIF]].']]},
   versions:{body:['Loaded and drawn by Phaser 3.90.0 and 4.2.1 on the ninja and archer frame sets: the trimmed Starling preset failed only in 3.90 (2 of 49 engine runs), the Phaser 3 preset passed in both. The setTrim argument order is quoted from the Phaser 3.90 source. HaxeFlixel, Starling and FNF engines were not run.'],sources:[S.phaserXmlSrc,S.phaserHashSrc,S.phaserLoader,S.phaserAnims]}
  },
  ko:{
   answer:'Sparrow / Starling XML(여러 FNF 모드의 "spritesheet and XML")은 패킹된 PNG를 `TextureAtlas` element (`imagePath="…"`)로, 프레임마다 `SubTexture` 하나로 설명합니다. `name`, `x`, `y`, `width`, `height`가 있고, 트림된 프레임에는 `frameX`, `frameY`(음수 오프셋)와 `frameWidth`, `frameHeight`(원래 크기)가 붙습니다. Nerulio는 페이지마다 XML 하나를 쓰고 회전하지 않습니다. Phaser 4.2는 트림된 프레임을 제대로 그리지만 Phaser 3.90은 그렇지 못하므로, Phaser 3에서는 트림을 끄는 "Sparrow XML (Phaser 3)" 프리셋을 쓰세요. HaxeFlixel과 FNF 엔진은 시험하지 않았습니다.',
   concept:{title:'SubTexture 읽는 법',body:[
    '프레임 하나가 요소 하나입니다. `x`, `y`, `width`, `height`로 페이지에서 저장된 픽셀을 잘라 냅니다. 트림된 프레임이면 `frameX`와 `frameY`가 전체 프레임이 그 픽셀 기준으로 어디서 시작하는지 알려 주는데, 전체 프레임이 왼쪽 위에서 시작하므로 음수입니다. `frameWidth`, `frameHeight`는 그 크기입니다.',
    '애니메이션은 파일에 저장되지 않고 프레임 이름으로 만듭니다. 예를 들어 이름이 `run_`으로 시작하는 모든 SubTexture입니다. Phaser는 접두어와 `generateFrameNames`로 이렇게 하므로, 애니메이션 목록이 있는 JSON 아틀라스보다 이름이 더 중요합니다.',
    '알아 둘 버그: Phaser 3.90의 AtlasXML 파서는 트림된 크기와 전체 크기를 `setTrim`에 거꾸로 넘깁니다. 그래서 Phaser 3.90에서는 트림된 XML 프레임이 잘못 그려집니다. 같은 파일이 Phaser 4.2에서는 제대로 그려집니다. "Sparrow XML (Phaser 3)" 프리셋은 트림을 꺼서 어떤 프레임에도 `frameX`/`frameY`가 없고, 두 버전 모두 통과합니다. Nerulio 엔진 검증 49회 중 실패는 이 2회뿐이었습니다.'],
    terms:[['TextureAtlas','루트 요소. `imagePath`가 PNG 페이지 이름이고 너비와 높이가 함께 있습니다.'],['SubTexture','프레임 하나: 이름과 페이지 위 사각형.'],['frameX, frameY','저장된 픽셀에서 본 전체 프레임의 음수 오프셋(트림된 프레임만).'],['frameWidth, frameHeight','트림 전 프레임 크기.'],['pivotX, pivotY','전체 프레임 위 픽셀 단위 피벗. Nerulio는 쓰지만 Phaser XML 로더는 읽지 않습니다.']]},
   example:{title:'예시: 두 프리셋의 같은 프레임과 Phaser 3.90 버그',lines:[
    'Starling / Sparrow XML 프리셋(트림 켬), 페이지 38 × 50',
    'SubTexture name="run_0" x="0" y="34" width="18" height="15"',
    '            frameX="-10" frameY="-10" frameWidth="40" frameHeight="29" pivotX="20" pivotY="29"',
    '',
    '"Sparrow XML (Phaser 3)" 프리셋(트림 끔), 페이지 82 × 91',
    'SubTexture name="run_0" x="0" y="0" width="40" height="29" pivotX="20" pivotY="29"',
    '',
    'Phaser 3.90 AtlasXML 호출     setTrim(18, 15, 10, 10, 40, 29)',
    'Frame.setTrim이 기대하는 순서  setTrim(40, 29, 10, 10, 18, 15)  (전체 크기가 먼저, 트림 크기가 마지막)',
    '',
    '여기서 트림을 끈 대가: 38 × 50 = 1,900 px² 대신 82 × 91 = 7,462 px² (3.9배)'],
    after:'Phaser의 JSON 파서는 `sourceSize`를 먼저, `spriteSourceSize`를 나중에 넘깁니다. 그래서 트림된 JSON 아틀라스는 Phaser 3.90에서도 괜찮고, 같은 프레임을 XML로 주면 잘못 그려집니다.'},
   outputs:{rows:[
    ['run.xml','`TextureAtlas` element (`imagePath="run.png"`, width, height)와 프레임마다 `SubTexture` 하나. frameX·frameY·frameWidth·frameHeight는 트림된 프레임에만, pivotX·pivotY는 픽셀 단위.'],
    ['run.png','페이지. 여러 페이지면 run-0.png와 run-0.xml, run-1.png와 run-1.xml 식.']]},
   target:{title:'불러오기',steps:[
    'Phaser 4.2: `this.load.atlasXML("run", "run.png", "run.xml")` 후 `this.add.sprite(x, y, "run", "run_0")`. 어느 XML 프리셋이든 됩니다.',
    'Phaser 3.90: "Sparrow XML (Phaser 3)"으로 내보내고 같은 방법으로 불러옵니다.',
    '이름으로 애니메이션 만들기: `this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`.',
    '다른 엔진(HaxeFlixel, FNF 엔진, Starling)도 같은 SubTexture 구조를 읽지만 여기서는 실행하지 않았습니다. 믿고 쓰기 전에 트림된 프레임 하나를 원본 이미지와 비교하세요.']},
   trouble:{rows:[
    ['Phaser 3.90에서만 트림된 프레임이 밀리거나 크기가 틀리게 그려짐','Phaser 3.90의 AtlasXML이 트림 크기와 전체 크기를 `setTrim`에 거꾸로 넘김','그 프레임에 `frameX`가 있고, 같은 파일이 Phaser 4.2에서는 정상','"Sparrow XML (Phaser 3)" 프리셋(트림 끔), JSON 아틀라스(여기선 트림 정상), 또는 Phaser 4 사용'],
    ['프레임이 돌아가거나 뒤집힘','프레임을 회전시킨 패커의 XML(`rotated="true"`)인데 Phaser XML 파서는 이를 읽지 않음','XML에서 `rotated` 검색','회전 없이 다시 패킹. Nerulio XML 내보내기는 회전된 패킹을 거부함'],
    ['애니메이션에 엉뚱한 프레임이 섞임','접두어가 너무 넓음: `run_`이 `run_attack_0`에도 걸림','XML의 프레임 이름 목록 확인','내보내기 전에 애니메이션마다 고유한 접두어를 줌'],
    ['스프라이트 원점이 피벗을 무시함','Phaser XML 로더는 사각형과 트림 속성만 읽고 pivotX/pivotY는 읽지 않음','스프라이트 원점이 가운데에 머묾','`sprite.setOrigin(0.5, 1)` 호출, 또는 Phaser가 `pivot`을 원점으로 쓰는 JSON 아틀라스 사용']]},
   alternatives:{rows:[
    ['Phaser JSON 아틀라스','Phaser 게임이라면: 3.90과 4.2 모두 트림이 정상이고 피벗이 스프라이트 원점이 되며 애니메이션 파일도 함께 옵니다. [[game/phaser-texture-atlas|Phaser 텍스처 아틀라스]] 참고.'],
    ['기존 FNF 시트 미리보기·변환','이미 있는 spritesheet + XML을 GIF로 바꾸려면 [[game/fnf-spritesheet-to-gif|FNF 스프라이트시트를 GIF로]] 참고.']]},
   versions:{body:['닌자와 궁수 프레임 세트로 Phaser 3.90.0과 4.2.1에서 불러와 그렸습니다. 트림을 켠 Starling 프리셋은 3.90에서만 실패했고(엔진 실행 49회 중 2회), Phaser 3 프리셋은 두 버전 모두 통과했습니다. setTrim 인수 순서는 Phaser 3.90 소스에서 인용했습니다. HaxeFlixel, Starling, FNF 엔진은 실행하지 않았습니다.'],sources:[S.phaserXmlSrc,S.phaserHashSrc,S.phaserLoader,S.phaserAnims]}
  },
  ja:{
   answer:'Sparrow / Starling XML（多くのFNF modの「spritesheet and XML」）は、パックしたPNGを`TextureAtlas` element (`imagePath="…"`)で、フレームごとに`SubTexture`1つで記述します。`name`、`x`、`y`、`width`、`height`があり、トリムしたフレームには`frameX`、`frameY`（負のオフセット）と`frameWidth`、`frameHeight`（元の大きさ）が付きます。Nerulioはページごとに1つのXMLを書き、回転はしません。Phaser 4.2はトリムしたフレームを正しく描きますが、Phaser 3.90は描けないため、Phaser 3ではトリムをオフにする「Sparrow XML (Phaser 3)」プリセットを使ってください。HaxeFlixelとFNFのエンジンは試していません。',
   concept:{title:'SubTextureの読み方',body:[
    'フレーム1つが要素1つです。`x`、`y`、`width`、`height`でページから保存ピクセルを切り出します。トリムしたフレームなら、`frameX`と`frameY`がそのピクセルから見てフレーム全体がどこから始まるかを示します。フレーム全体は左上から始まるので負の値です。`frameWidth`、`frameHeight`はその大きさです。',
    'アニメーションはファイルに保存されず、フレーム名から組み立てます。たとえば名前が`run_`で始まるすべてのSubTextureです。Phaserは接頭辞と`generateFrameNames`でこれを行うので、アニメーション一覧を持つJSONアトラスより名前が重要になります。',
    '知っておくべきバグ：Phaser 3.90のAtlasXMLパーサーは、トリム後の大きさと元の大きさを逆の順で`setTrim`に渡します。そのためPhaser 3.90ではトリムしたXMLのフレームが正しく描かれません。同じファイルはPhaser 4.2では正しく描かれます。「Sparrow XML (Phaser 3)」プリセットはトリムをオフにするので、どのフレームにも`frameX`/`frameY`がなく、両バージョンで合格します。Nerulioのエンジン検証49回のうち、失敗はこの2回だけでした。'],
    terms:[['TextureAtlas','ルート要素。`imagePath`がPNGページの名前で、幅と高さも持ちます。'],['SubTexture','1フレーム：名前とページ上の矩形。'],['frameX, frameY','保存ピクセルから見たフレーム全体の負のオフセット（トリムしたフレームのみ）。'],['frameWidth, frameHeight','トリム前のフレームの大きさ。'],['pivotX, pivotY','フレーム全体の上のピクセル単位のピボット。Nerulioは書きますが、PhaserのXMLローダーは読みません。']]},
   example:{title:'例：2つのプリセットでの同じフレームと、Phaser 3.90のバグ',lines:[
    'Starling / Sparrow XMLプリセット（トリムあり）、ページ38 × 50',
    'SubTexture name="run_0" x="0" y="34" width="18" height="15"',
    '            frameX="-10" frameY="-10" frameWidth="40" frameHeight="29" pivotX="20" pivotY="29"',
    '',
    '「Sparrow XML (Phaser 3)」プリセット（トリムなし）、ページ82 × 91',
    'SubTexture name="run_0" x="0" y="0" width="40" height="29" pivotX="20" pivotY="29"',
    '',
    'Phaser 3.90 AtlasXMLの呼び出し   setTrim(18, 15, 10, 10, 40, 29)',
    'Frame.setTrimが期待する順        setTrim(40, 29, 10, 10, 18, 15)  （元の大きさが先、トリム後が最後）',
    '',
    'ここでトリムをオフにする代償：38 × 50 = 1,900 px²ではなく82 × 91 = 7,462 px²（3.9倍）'],
    after:'PhaserのJSONパーサーは`sourceSize`を先に、`spriteSourceSize`を後に渡します。だからトリムしたJSONアトラスはPhaser 3.90でも問題なく、同じフレームをXMLにすると崩れます。'},
   outputs:{rows:[
    ['run.xml','`TextureAtlas` element (`imagePath="run.png"`, width, height)と、フレームごとの`SubTexture`。frameX・frameY・frameWidth・frameHeightはトリムしたフレームにだけ、pivotX・pivotYはピクセル単位。'],
    ['run.png','ページ。複数ページならrun-0.pngとrun-0.xml、run-1.pngとrun-1.xmlのように。']]},
   target:{title:'読み込む',steps:[
    'Phaser 4.2：`this.load.atlasXML("run", "run.png", "run.xml")`のあと`this.add.sprite(x, y, "run", "run_0")`。どちらのXMLプリセットでも動きます。',
    'Phaser 3.90：「Sparrow XML (Phaser 3)」で書き出し、同じ方法で読み込みます。',
    '名前からアニメーションを作る：`this.anims.create({ key: "run", frames: this.anims.generateFrameNames("run", { prefix: "run_", start: 0, end: 5 }), frameRate: 10, repeat: -1 })`。',
    'ほかのエンジン（HaxeFlixel、FNFのエンジン、Starling）も同じSubTextureの構造を読みますが、ここでは実行していません。頼る前に、トリムしたフレームを1つ元画像と比べてください。']},
   trouble:{rows:[
    ['Phaser 3.90でだけ、トリムしたフレームがずれる・大きさが違う','Phaser 3.90のAtlasXMLが、トリム後と元の大きさを逆順で`setTrim`に渡す','そのフレームに`frameX`があり、同じファイルがPhaser 4.2では正常','「Sparrow XML (Phaser 3)」プリセット（トリムなし）、JSONアトラス（こちらはトリムが正常）、またはPhaser 4を使う'],
    ['フレームが回転・反転する','フレームを回転させたパッカーのXML（`rotated="true"`）で、PhaserのXMLパーサーはこれを読まない','XMLで`rotated`を検索','回転なしでパックし直す。NerulioのXML書き出しは回転したパックを拒否する'],
    ['アニメーションに違うフレームが混ざる','接頭辞が広すぎる：`run_`が`run_attack_0`にも一致する','XMLのフレーム名を一覧する','書き出し前に、アニメーションごとに一意の接頭辞を付ける'],
    ['スプライトの原点がピボットを無視する','PhaserのXMLローダーは矩形とトリムの属性だけを読み、pivotX/pivotYは読まない','スプライトの原点が中央のまま','`sprite.setOrigin(0.5, 1)`を呼ぶか、Phaserが`pivot`を原点にするJSONアトラスを使う']]},
   alternatives:{rows:[
    ['PhaserのJSONアトラス','Phaserのゲームなら：3.90でも4.2でもトリムが正常で、ピボットがスプライトの原点になり、アニメーションのファイルも付きます。[[game/phaser-texture-atlas|Phaserのテクスチャアトラス]]を参照。'],
    ['既存のFNFシートのプレビュー・変換','手元のspritesheet + XMLをGIFにしたいなら、[[game/fnf-spritesheet-to-gif|FNFスプライトシートをGIFに]]を参照。']]},
   versions:{body:['忍者と弓兵のフレームセットで、Phaser 3.90.0と4.2.1に読み込んで描画しました。トリムありのStarlingプリセットは3.90でだけ失敗し（エンジン実行49回中2回）、Phaser 3プリセットは両方で合格しました。setTrimの引数の順はPhaser 3.90のソースから引用しています。HaxeFlixel、Starling、FNFのエンジンは実行していません。'],sources:[S.phaserXmlSrc,S.phaserHashSrc,S.phaserLoader,S.phaserAnims]}
  }
 },
 'game/css-sprite-generator':{
  type:'create',
  intent:{primary:'generate a CSS sprite sheet (one PNG + classes with background-position)',secondary:['how background-position selects a piece','keeping pixel art sharp with image-rendering','scaling sprites without showing neighbours'],
   goal:'one PNG and a stylesheet whose classes show each image at its size in the browser',input:'icons, game frames or any images',output:'PNG page(s) + .css with one class per image + preview .html',target:'web browsers (checked in Chromium)',support:'full',
   evidence:['src/game/export/engines.js (cssFiles)','src/game/export/targets.js (CSS preset: trim and rotation off)','docs/STUDIO-PACK.md (Chromium draws every class, screenshot compared)'],
   external:['MDN: image-rendering (pixelated)','MDN: background-position']},
  en:{
   answer:'A CSS sprite is one image that holds many icons or frames; each element shows its piece by being exactly that piece\'s size and moving the sheet with `background-position` set to minus the piece\'s position. Nerulio packs your images into one PNG and writes a `.css` with one class per image plus a preview `.html`. Trim and rotation stay off, because an element\'s box cannot restore a trim offset or turn a piece back, and `image-rendering: pixelated` keeps pixel art sharp when scaled. Every class was drawn in Chromium and compared.',
   concept:{title:'How a CSS sprite shows one piece',body:[
    'The element is exactly as large as one piece, and the sheet is its background, shifted left and up so the piece lands inside the box: a piece at x = 42, y = 31 needs `background-position: -42px -31px`. The rest of the sheet lies outside the box and is not painted.',
    'Because the box is the whole visible area, a trimmed piece would lose its transparent margin and shift, and a rotated piece cannot be turned back with background properties alone. The CSS preset therefore packs full, upright images, with 2 px of padding so that scaling does not reach into a neighbour.',
    'To draw a sprite larger, scale all of its numbers together (width, height, `background-size`, `background-position`), or scale the element as the preview page does with `zoom: 4`. `image-rendering: pixelated` tells the browser to scale by nearest neighbour to whole multiples instead of smoothing.'],
    terms:[['background-position','Offset of the sheet inside the element: the negative position of the piece.'],['background-size','The sheet\'s size in CSS pixels; written per page, so scaling stays predictable.'],['image-rendering: pixelated','Nearest-neighbour scaling for pixel art; it also applies to background images.']]},
   example:{title:'Example: six 40 × 29 frames as CSS classes',lines:[
    'run.png 82 × 91 (6 frames of 40 × 29, trim off, padding 2)',
    '',
    '.sprite{display:inline-block;background-repeat:no-repeat;image-rendering:pixelated;}',
    '.sprite-page-0{background-image:url("run.png");background-size:82px 91px;}',
    '.sprite-run_3{width:40px;height:29px;background-position:-42px -31px;}',
    '',
    'HTML element: class="sprite sprite-page-0 sprite-run_3"',
    '',
    'the same frame at 2× without zoom:',
    '  width 80px   height 58px   background-size 164px 182px   background-position -84px -62px'],
    after:'run_3 starts 42 px from the left (40 px of run_2 plus 2 px padding) and 31 px from the top (29 px of the first row plus 2 px), so those are its negative offsets.'},
   target:{title:'Use it on a page',steps:[
    'Copy `run.png` and `run.css` to your site and link `run.css` from the page head with a stylesheet link element.',
    'Give each element three classes: `sprite`, the page class such as `sprite-page-0`, and the image class such as `sprite-run_3`.',
    'For a frame animation, switch the image class from JavaScript on a timer, one class per frame.',
    'When a sprite is a button icon, give the button an accessible label; the sprite element itself has no text.']},
   verify:{steps:[
    'Open the exported `run.html`: every class is drawn at 4× with its name below it.',
    'Zoom the browser: with `image-rendering: pixelated` the edges stay square; a sliver of a neighbour at the border means `background-size` was changed without the positions, or padding was set to 0.']},
   trouble:{rows:[
    ['A piece shows part of its neighbour','The element is larger than the piece, or `background-size` changed without the positions','Compare the element\'s width and height with its class','Scale every number by the same factor, or scale the element with `zoom` or `transform`'],
    ['Pixel art looks blurry','`image-rendering` is not applied because the element lacks the `sprite` class','DevTools: the computed `image-rendering`','Add the `sprite` class'],
    ['Nothing shows','The image path is wrong: `url("run.png")` is resolved relative to the CSS file','The network panel shows a 404 for run.png','Keep the PNG next to the CSS, or edit the url'],
    ['A frame shows a piece of another frame','The element has `sprite-page-0` but its frame is on page 1','The page class used for that frame in the preview HTML','Use the page class the preview gives for that frame']]},
   alternatives:{rows:[
    ['Separate PNG files, or SVG for icons','A few images that change often are simpler to update as separate files; vector icons belong in SVG, not in a PNG sprite.'],
    ['A game engine atlas','For a canvas or WebGL game, load a JSON atlas instead: [[game/phaser-texture-atlas|Phaser]] or [[game/pixi-spritesheet-json|PixiJS]].'],
    ['Upscale the art first','If the pixel art must appear at a fixed larger size without CSS scaling, [[game/pixel-art-upscaler|upscale it]] by a whole factor before packing.']]},
   versions:{body:['Chromium (Playwright) linked the exported stylesheet as is, drew one element per `.sprite-…` rule and the screenshot was compared with the source images. Other browsers were not part of that run; `image-rendering` and `background-position` behave as described by MDN.'],sources:[S.mdnRendering,S.mdnPosition]}
  },
  ko:{
   answer:'CSS 스프라이트는 아이콘이나 프레임 여러 개를 담은 이미지 한 장입니다. 요소 하나를 조각 하나의 크기로 만들고, `background-position`을 조각 위치의 음수로 두어 시트를 옮기면 그 조각만 보입니다. Nerulio는 이미지들을 PNG 한 장으로 패킹하고, 이미지마다 클래스가 하나씩 있는 `.css`와 미리보기 `.html`을 씁니다. 요소 상자로는 트림 오프셋을 되살리거나 조각을 되돌려 세울 수 없으므로 트림과 회전은 끄며, `image-rendering: pixelated`로 확대해도 도트 그림이 선명합니다. 모든 클래스를 Chromium에서 그려 비교했습니다.',
   concept:{title:'CSS 스프라이트가 조각 하나를 보여 주는 방식',body:[
    '요소는 조각 하나와 정확히 같은 크기이고, 시트는 그 배경입니다. 조각이 상자 안에 들어오도록 시트를 왼쪽 위로 옮깁니다. x = 42, y = 31에 있는 조각이면 `background-position: -42px -31px`입니다. 나머지 시트는 상자 밖에 있어 그려지지 않습니다.',
    '상자가 보이는 영역의 전부이므로, 트림된 조각은 투명 여백을 잃고 밀리며, 회전된 조각은 배경 속성만으로 되돌릴 수 없습니다. 그래서 CSS 프리셋은 원래 크기의 똑바른 이미지를 패킹하고, 확대할 때 이웃에 닿지 않도록 2px 간격을 둡니다.',
    '크게 그리려면 모든 숫자(너비, 높이, `background-size`, `background-position`)를 함께 곱하거나, 미리보기 페이지처럼 `zoom: 4`로 요소 자체를 키웁니다. `image-rendering: pixelated`는 브라우저에 부드럽게 보간하지 말고 최근접 이웃으로 정수배 확대하라고 알립니다.'],
    terms:[['background-position','요소 안에서 시트를 옮기는 양. 조각 위치의 음수.'],['background-size','CSS 픽셀 단위의 시트 크기. 페이지마다 적혀 있어 확대 결과를 예측할 수 있음.'],['image-rendering: pixelated','도트 그림용 최근접 이웃 확대. 배경 이미지에도 적용됨.']]},
   example:{title:'예시: 40 × 29 프레임 6장을 CSS 클래스로',lines:[
    'run.png 82 × 91 (40 × 29 프레임 6장, 트림 끔, 간격 2)',
    '',
    '.sprite{display:inline-block;background-repeat:no-repeat;image-rendering:pixelated;}',
    '.sprite-page-0{background-image:url("run.png");background-size:82px 91px;}',
    '.sprite-run_3{width:40px;height:29px;background-position:-42px -31px;}',
    '',
    'HTML element: class="sprite sprite-page-0 sprite-run_3"',
    '',
    'zoom 없이 같은 프레임을 2배로:',
    '  width 80px   height 58px   background-size 164px 182px   background-position -84px -62px'],
    after:'run_3은 왼쪽에서 42px(run_2의 40px + 간격 2px), 위에서 31px(첫 줄 29px + 간격 2px) 떨어져 있으므로 그 음수가 오프셋입니다.'},
   target:{title:'웹 페이지에서 쓰기',steps:[
    '`run.png`와 `run.css`를 사이트에 복사하고 페이지 head에서 stylesheet link 요소로 `run.css`를 연결합니다.',
    '요소마다 클래스 세 개를 줍니다. `sprite`, `sprite-page-0` 같은 페이지 클래스, `sprite-run_3` 같은 이미지 클래스.',
    '프레임 애니메이션은 JavaScript 타이머로 프레임마다 이미지 클래스를 바꿔 줍니다.',
    '스프라이트가 버튼 아이콘이면 버튼에 접근 가능한 레이블을 주세요. 스프라이트 요소 자체에는 글자가 없습니다.']},
   verify:{steps:[
    '내보낸 `run.html`을 엽니다. 모든 클래스가 4배로, 아래에 이름과 함께 그려집니다.',
    '브라우저를 확대합니다. `image-rendering: pixelated`면 가장자리가 네모납니다. 가장자리에 이웃 조각이 살짝 보이면 위치 없이 `background-size`만 바꿨거나 간격을 0으로 둔 것입니다.']},
   trouble:{rows:[
    ['조각에 이웃 조각 일부가 보임','요소가 조각보다 크거나, 위치는 그대로 두고 `background-size`만 바꿈','요소의 너비·높이를 클래스와 비교','모든 숫자를 같은 배율로 바꾸거나 `zoom`·`transform`으로 요소를 키움'],
    ['도트 그림이 흐림','요소에 `sprite` 클래스가 없어 `image-rendering`이 적용되지 않음','개발자 도구에서 계산된 `image-rendering` 확인','`sprite` 클래스 추가'],
    ['아무것도 안 보임','이미지 경로가 틀림: `url("run.png")`은 CSS 파일 기준 상대 경로','네트워크 패널에 run.png 404','PNG를 CSS 옆에 두거나 url 수정'],
    ['프레임에 다른 프레임 조각이 보임','요소에 `sprite-page-0`이 있는데 그 프레임은 페이지 1에 있음','미리보기 HTML에서 그 프레임에 쓴 페이지 클래스','미리보기가 그 프레임에 준 페이지 클래스를 사용']]},
   alternatives:{rows:[
    ['PNG 낱장 파일이나 아이콘용 SVG','자주 바뀌는 몇 장의 이미지는 낱장 파일이 고치기 쉽고, 벡터 아이콘은 PNG 스프라이트가 아니라 SVG가 맞습니다.'],
    ['게임 엔진 아틀라스','캔버스나 WebGL 게임이면 JSON 아틀라스를 불러오세요: [[game/phaser-texture-atlas|Phaser]], [[game/pixi-spritesheet-json|PixiJS]].'],
    ['그림을 먼저 확대','CSS 확대 없이 정해진 큰 크기로 보여야 하면 패킹 전에 정수배로 [[game/pixel-art-upscaler|확대하세요]].']]},
   versions:{body:['Chromium(Playwright)에서 내보낸 스타일시트를 그대로 연결해 `.sprite-…` 규칙마다 요소 하나를 그리고, 스크린샷을 원본 이미지와 비교했습니다. 다른 브라우저는 이 실행에 포함되지 않았습니다. `image-rendering`과 `background-position`의 동작은 MDN 설명을 따릅니다.'],sources:[S.mdnRendering,S.mdnPosition]}
  },
  ja:{
   answer:'CSSスプライトは、多数のアイコンやフレームをまとめた1枚の画像です。要素を1つの断片とちょうど同じ大きさにし、`background-position`を断片の位置のマイナスにしてシートをずらすと、その断片だけが見えます。Nerulioは画像を1枚のPNGにパックし、画像ごとに1つのクラスを持つ`.css`とプレビュー用の`.html`を書き出します。要素の枠ではトリムのオフセットを戻せず、回転した断片も戻せないので、トリムと回転はオフにします。`image-rendering: pixelated`で拡大してもドット絵がくっきりします。全クラスをChromiumで描いて比較しました。',
   concept:{title:'CSSスプライトが1つの断片を見せる仕組み',body:[
    '要素は1つの断片とちょうど同じ大きさで、シートはその背景です。断片が枠の中に来るように、シートを左上へずらします。x = 42、y = 31にある断片なら`background-position: -42px -31px`です。シートの残りは枠の外にあり、描かれません。',
    '枠が見える範囲のすべてなので、トリムした断片は透明な余白を失ってずれ、回転した断片は背景のプロパティだけでは戻せません。そのためCSSプリセットは元の大きさの正立した画像をパックし、拡大しても隣に届かないよう2pxの間隔を空けます。',
    '大きく描くには、すべての数値（幅、高さ、`background-size`、`background-position`）を同じ倍率で掛けるか、プレビューページのように`zoom: 4`で要素ごと拡大します。`image-rendering: pixelated`は、滑らかに補間せず最近傍で整数倍に拡大するようブラウザに伝えます。'],
    terms:[['background-position','要素内でシートをずらす量。断片の位置のマイナス。'],['background-size','CSSピクセルでのシートの大きさ。ページごとに書かれているので拡大の結果が予測できる。'],['image-rendering: pixelated','ドット絵向けの最近傍拡大。背景画像にも効く。']]},
   example:{title:'例：40 × 29のフレーム6枚をCSSクラスに',lines:[
    'run.png 82 × 91（40 × 29のフレーム6枚、トリムなし、間隔2）',
    '',
    '.sprite{display:inline-block;background-repeat:no-repeat;image-rendering:pixelated;}',
    '.sprite-page-0{background-image:url("run.png");background-size:82px 91px;}',
    '.sprite-run_3{width:40px;height:29px;background-position:-42px -31px;}',
    '',
    'HTML element: class="sprite sprite-page-0 sprite-run_3"',
    '',
    'zoomなしで同じフレームを2倍に：',
    '  width 80px   height 58px   background-size 164px 182px   background-position -84px -62px'],
    after:'run_3は左から42px（run_2の40px＋間隔2px）、上から31px（1行目の29px＋間隔2px）の位置にあるので、そのマイナスがオフセットになります。'},
   target:{title:'Webページで使う',steps:[
    '`run.png`と`run.css`をサイトにコピーし、ページのheadでstylesheetのlink要素から`run.css`を読み込みます。',
    '要素ごとにクラスを3つ付けます。`sprite`、`sprite-page-0`のようなページのクラス、`sprite-run_3`のような画像のクラスです。',
    'フレームアニメーションは、JavaScriptのタイマーでフレームごとに画像のクラスを切り替えます。',
    'スプライトがボタンのアイコンなら、ボタンにアクセシブルなラベルを付けてください。スプライトの要素自体には文字がありません。']},
   verify:{steps:[
    '書き出した`run.html`を開きます。全クラスが4倍で、下に名前付きで描かれます。',
    'ブラウザを拡大します。`image-rendering: pixelated`なら縁は四角いままです。縁に隣の断片が少し見えるなら、位置を変えずに`background-size`だけを変えたか、間隔を0にしています。']},
   trouble:{rows:[
    ['断片に隣の断片の一部が見える','要素が断片より大きい、または位置を変えずに`background-size`だけ変えた','要素の幅と高さをクラスと比べる','すべての数値を同じ倍率で変えるか、`zoom`や`transform`で要素を拡大'],
    ['ドット絵がぼやける','要素に`sprite`クラスがなく、`image-rendering`が効いていない','開発者ツールで計算済みの`image-rendering`を見る','`sprite`クラスを付ける'],
    ['何も表示されない','画像のパスが違う：`url("run.png")`はCSSファイルからの相対パス','ネットワークパネルでrun.pngが404','PNGをCSSの隣に置くか、urlを直す'],
    ['フレームに別のフレームの断片が見える','要素が`sprite-page-0`なのに、そのフレームはページ1にある','プレビューのHTMLでそのフレームに使われているページのクラス','プレビューがそのフレームに付けているページのクラスを使う']]},
   alternatives:{rows:[
    ['個別のPNGファイル、アイコンならSVG','頻繁に変わる数枚の画像は個別のファイルのほうが更新しやすく、ベクターのアイコンはPNGスプライトではなくSVGが向いています。'],
    ['ゲームエンジンのアトラス','canvasやWebGLのゲームなら、JSONアトラスを読み込みます：[[game/phaser-texture-atlas|Phaser]]、[[game/pixi-spritesheet-json|PixiJS]]。'],
    ['先に絵を拡大する','CSSの拡大なしで決まった大きなサイズで見せたいなら、パックの前に整数倍で[[game/pixel-art-upscaler|拡大]]します。']]},
   versions:{body:['Chromium（Playwright）で書き出したスタイルシートをそのままリンクし、`.sprite-…`のルールごとに要素を1つ描いて、スクリーンショットを元画像と比較しました。ほかのブラウザはこの実行に含まれていません。`image-rendering`と`background-position`の動作はMDNの説明に従います。'],sources:[S.mdnRendering,S.mdnPosition]}
  }
 },
 // @@PAGES@@
};
