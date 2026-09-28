/** Intent content for the pixel-fix pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/export/godot.js, src/game/export/unity.js, src/game/pixel-check.js,
 * src/game/pixel-snap.js, src/studio/pixel/cleanup.js, src/game/pixel-cleanup.js, docs/STUDIO-PIXEL.md
 * §5–§8, docs/pixel-bench/H2H.md, docs/PIXEL-LAB.md, docs/STUDIO-PACK.md. Engine and tool behaviour:
 * the official docs and project READMEs cited in each page's `versions.sources` (fetched 2026-09-28). */
const GODOT_DOCS=['[Godot 4.7 docs: Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)','[Godot 4.7 docs: ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)','[Godot 4.7 docs: CanvasItem](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html)','[Godot 4.7 docs: Importing images](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html)'];
const UNITY_DOCS=['[Unity 6.0 manual: Sprite (2D and UI) texture import settings](https://docs.unity3d.com/6000.0/Documentation/Manual/texture-type-sprite.html)','[Unity 6.6 manual: Default and platform-specific texture settings](https://docs.unity3d.com/Manual/class-TextureImporter-type-specific.html)','[Unity 6.0 manual (URP): Set up a pixel perfect camera](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html)','[Unity 6.0 manual (URP): Pixel Perfect Camera reference](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/2d-pixelperfect-ref.html)','[Unity 6.0 manual (URP): Configure a pixel perfect camera](https://docs.unity3d.com/6000.0/Documentation/Manual/urp/2d-pixelperfect-configure.html)'];
const SNAPPER_DOCS=['[Sprite Fusion Pixel Snapper (official repository, README)](https://github.com/Hugo-Dz/spritefusion-pixel-snapper)','[unfake.js (official repository, README)](https://github.com/jenissimo/unfake.js)','[perfectPixel (official repository, README)](https://github.com/theamusing/perfectPixel)'];
export default {
 'game/godot-pixel-art-blurry':{
  type:'troubleshoot',
  intent:{primary:'fix blurry, soft or uneven pixel art in Godot 4',secondary:['texture filter Nearest per node or as the project default','mipmaps and compression in the import settings','fractional window scaling and stretch mode','sub-pixel sprite and camera positions'],
   goal:'pixel art drawn with square, equal pixels in Godot 4, both standing still and while moving',input:'a pixel-art PNG, sheet or .aseprite used in a Godot 4 project',output:'a diagnosis per cause; the Godot 4 bundle (.tscn with Nearest, .png.import lossless without mipmaps); the project settings to change by hand',target:'Godot 4 (settings from the 4.7 docs; bundle verified in 4.7.2)',support:'partial',
   evidence:['src/game/export/godot.js (texture_filter = 1, .png.import params)','docs/STUDIO-PACK.md (Godot 4.7.2: shipped scene drawn at 4×, 4096² FX sheet and fix_alpha_border)','docs/ENGINE-VERIFY.md (fix_alpha_border finding)'],
   external:['Godot 4.7 ProjectSettings: display/window/stretch/*, rendering/2d/snap/*, rendering/textures/canvas_textures/default_texture_filter','Godot 4.7 Multiple resolutions: pixel-art recommendations','Godot 4.7 CanvasItem.texture_filter enum','Godot 4.7 Importing images: Lossless default, Detect 3D, Fix Alpha Border, Size Limit']},
  en:{
   answer:'Pixel art in Godot 4 looks soft for one of four reasons: the node draws with the project’s default Linear filter, the texture was imported with mipmaps or lossy/VRAM compression, the window stretches the game by a fractional factor, or the sprite or `Camera2D` sits between screen pixels. Check a still frame first, then a moving one. Nerulio’s Godot 4 bundle fixes the file side (a scene with Nearest filtering and a `.png.import` that stays lossless without mipmaps); stretch, snapping and camera are project settings you change yourself.',
   concept:{title:'Four kinds of blur, four places to fix them',body:[
    'Filtering. Since Godot 4.0 the filter belongs to the node (CanvasItem › Texture › Filter), not to the imported texture. A node left on Inherit takes its parent’s filter, and at the top of the tree that is the project setting `rendering/textures/canvas_textures/default_texture_filter`, which is Linear by default. Linear blends the four nearest texels, so every pixel edge becomes a soft ramp as soon as the sprite is drawn larger than 1×.',
    'Import. Godot imports a PNG as Lossless without mipmaps, which the docs call the recommended setting for pixel art. That changes when the texture is used on a 3D material (Detect 3D switches it to VRAM Compressed with mipmaps), when someone picks Lossy or VRAM compression, or when Process › Size Limit shrinks it — with cubic interpolation. Mipmaps also soften a sprite drawn below 1×, for example with the camera zoomed out.',
    'Scaling. A 320 × 180 game in a 1920 × 1080 window is scaled by exactly 6, so every art pixel is 6 × 6 screen pixels. In a 1366 × 768 window the factor is 4.27: some art pixels become 4 screen pixels wide and some 5, which reads as lumpy lines. `display/window/stretch/mode`, `aspect` and `scale_mode` decide what happens; `scale_mode = integer` floors the factor to a whole number.',
    'Movement. A sprite or camera at x = 10.4 is drawn between screen pixels: with Linear filtering that is blur, with Nearest it is shimmer, and the character and the level may round differently, so one jitters against the other. `rendering/2d/snap/snap_2d_transforms_to_pixel` rounds CanvasItem positions to whole pixels.'],
    terms:[['`texture_filter`','CanvasItem property: Inherit (from the parent), Nearest, Linear and the mipmap variants. The project default fills in at the top of the tree.'],['`display/window/stretch/mode`','`disabled`, `canvas_items` (2D drawn at the window resolution) or `viewport` (the game is rendered at the base size, then that image is scaled to the window).'],['`display/window/stretch/scale_mode`','`fractional` keeps the exact factor; `integer` floors it, so the screen is always a whole multiple of the base size.'],['`rendering/2d/snap/snap_2d_transforms_to_pixel`','Rounds CanvasItem positions to whole pixels: crisper, but movement is less smooth. Read only when the project starts.']]},
   example:{title:'Example: a 320 × 180 game in three window sizes',lead:'The base size is `display/window/size/viewport_width` × `viewport_height`. The stretch factor is the window size divided by it:',lines:[
    'Window        factor              scale_mode = fractional     scale_mode = integer',
    '1920 × 1080   1920/320 = 6.00     6 × 6 px per art pixel      6 × 6, fills the window',
    '2560 × 1440   2560/320 = 8.00     8 × 8                       8 × 8',
    '1366 × 768    768/180  = 4.27     art pixels 4 or 5 px wide   floor → 4: 1280 × 720 + bars',
    '',
    'why 4.27 fails: 32 art pixels × 4.27 = 136.5 screen pixels — no equal split exists'],
    after:'With `aspect = keep` the remaining space becomes black bars; `expand` shows more of the level instead (the Godot docs suggest either for pixel art). The docs also warn that with integer scaling a window smaller than the base size clips the game, so set `Window.min_size` to the base size.'},
   mapping:{title:'Which cause the Nerulio bundle removes, and which stay with you',head:['Cause','Where it lives','Fixed by the Godot 4 bundle?'],rows:[
    ['Linear filter on the node','CanvasItem › Texture › Filter, or the project default','Only on the bundle’s own `AnimatedSprite2D` (`texture_filter = 1`, Nearest); your other nodes still inherit the project default'],
    ['Mipmaps, lossy or VRAM compression, Size Limit','The PNG’s import settings','Yes: the shipped `.png.import` has `compress/mode=0` (Lossless), `mipmaps/generate=false`, `process/size_limit=0`'],
    ['Faint pixels recoloured along alpha edges','Import option Process › Fix Alpha Border (on by default)','Yes: `process/fix_alpha_border=false`'],
    ['Fractional stretch factor','Project Settings › Display › Window › Stretch','No — project setting'],
    ['Sub-pixel sprite or camera positions','`rendering/2d/snap/*`, your scripts, Camera2D smoothing','No — project setting and code'],
    ['Camera2D zoom that is not a whole number (1.5)','The Camera2D node','No — use 1, 2, 3 …'],
    ['Art that is already soft inside the PNG','The source image','No: the bundle packs what you drew; rebuild the 1× art with the [[game/pixel-art-downscaler|pixel art downscaler]]']]},
   target:{title:'Fix it in Godot 4, in this order',steps:[
    'Project Settings › Rendering › Textures › Canvas Textures › Default Texture Filter = Nearest (or set Texture › Filter = Nearest on the pixel-art nodes only, if the rest of the game is high-resolution).',
    'Project Settings › Display › Window › Size: set the viewport width and height to your art resolution, for example 320 × 180.',
    'Project Settings › Display › Window › Stretch: Mode = `viewport`, Aspect = `keep` (or `expand`), Scale Mode = `integer` — the pixel-art combination the Godot docs recommend. Use `canvas_items` instead only if you want sprites to move and rotate at sub-pixel positions.',
    'If sprites shimmer while moving, turn on `rendering/2d/snap/snap_2d_transforms_to_pixel` and restart the project (it is read at startup). The docs advise not to combine it with `snap_2d_vertices_to_pixel`.',
    'Select each pixel-art PNG and check the Import dock: Compress › Mode Lossless, Mipmaps › Generate off, Fix Alpha Border off for faint pixels; click Reimport after a change. A Nerulio bundle ([[game/aseprite-to-godot|Aseprite to Godot]], [[game/godot-sprite-sheet|sprite sheet to Godot]]) already ships these values.',
    'Keep `Camera2D.zoom` and node scales at whole numbers.']},
   verify:{steps:[
    'Zoom the 2D editor to 800 % on a still sprite: square pixel edges mean Nearest is in effect; soft ramps mean Linear.',
    'Run the game in a 1920 × 1080 window (for a 320 × 180 base), take a screenshot and zoom in: every art pixel should be exactly 6 × 6 screen pixels.',
    'Resize the window to 1366 × 768: with `scale_mode = integer` you get bars and the same crisp pixels at 4 × 4, not a mix of 4 and 5.',
    'Move the camera slowly: with transform snapping on, the sprite steps by whole pixels instead of shimmering.']},
   trouble:{rows:[
    ['Soft edges even when nothing moves','Linear filtering: the node inherits the project default','Select the node: Texture › Filter says Inherit, and Default Texture Filter is Linear','Default Texture Filter = Nearest once, or Filter = Nearest on the node'],
    ['Blurry only when zoomed out, or after the sprite was used on a 3D material','Mipmaps or VRAM compression — Detect 3D changed the import','Import dock of the PNG: Compress › Mode, Mipmaps › Generate; the Output panel prints a message when Detect 3D fires','Compress › Mode = Lossless, Mipmaps off, Reimport'],
    ['Some pixels wider than others, lumpy diagonals','Fractional stretch factor (4.27×) or a Camera2D zoom such as 1.5','Window size ÷ base size; Camera2D › Zoom','Stretch Mode `viewport` + Scale Mode `integer`; whole-number zoom'],
    ['Sharp at rest, shimmers or jitters while moving','Sprite or camera between pixels, often with Camera2D position smoothing','`print(global_position)` shows values like 10.4 while moving','`snap_2d_transforms_to_pixel` on (restart), or round positions in code'],
    ['Faint glow or smoke pixels change colour','Fix Alpha Border (on by default) fills transparent pixels with neighbouring colours','Import dock: Process › Fix Alpha Border','Turn it off and Reimport — the bundle’s `.png.import` does'],
    ['Crisp at 1920 × 1080, uneven on a laptop screen or after resizing','The stretch factor depends on the window size','Run at 1366 × 768 or maximise the window','Scale Mode `integer`, and `Window.min_size` = base size'],
    ['The PNG itself has soft edges in an image viewer at 800 %','The art was resized with smoothing before it reached Godot','Open the source file outside Godot','No Godot setting helps: rebuild the 1× art first']]},
   alternatives:{rows:[
    ['Set the project up for pixel art once (the steps above) and keep importing plain PNGs','You draw straight into PNGs and use `Sprite2D`: the default Lossless import is already right, so only filter and stretch need changing.'],
    ['Nearest on selected nodes only','A high-resolution game with a few pixel-art elements: keep the project default Linear and set Texture › Filter = Nearest on those nodes.'],
    ['A Nerulio Godot 4 bundle','You start from a sheet or an .aseprite file and want the animation, the Nearest scene and the import file in one step.']]},
   limits:['The bundle never edits `project.godot`: default filter, stretch, snapping and camera stay as you set them.','A sprite that was smoothed before export stays smoothed; no import setting sharpens it again.','The stretch and snap settings above come from the Godot docs; our Godot runs checked the bundle, not those settings.'],
   versions:{body:['Godot 4.7.2 loaded the Nerulio bundle in our verification runs, drew the shipped scene at 4× and it stayed sharp; a 4096² effects sheet whose faint pixels Godot’s default Fix Alpha Border recoloured passed with the bundle’s import file. Setting names, defaults and the pixel-art recommendation follow the Godot 4.7 documentation (which also notes that projects created in 4.7 start with stretch mode `canvas_items`).'],sources:GODOT_DOCS}
  },
  ko:{
   answer:'Godot 4에서 도트가 흐린 원인은 네 가지 중 하나입니다. 노드가 프로젝트 기본값인 Linear 필터로 그려지거나, 텍스처가 밉맵이나 손실·VRAM 압축으로 들어왔거나, 창이 게임을 소수 배율로 늘리거나, 스프라이트나 `Camera2D`가 화면 픽셀 사이에 놓여 있기 때문입니다. 멈춘 화면을 먼저 보고 그다음 움직이는 화면을 보세요. Nerulio의 Godot 4 번들은 파일 쪽(Nearest 필터 씬, 무손실·밉맵 없는 `.png.import`)을 고치고, 늘이기·스냅·카메라는 직접 바꾸는 프로젝트 설정입니다.',
   concept:{title:'흐림은 네 종류, 고칠 곳도 네 군데',body:[
    '필터. Godot 4.0부터 필터는 가져온 텍스처가 아니라 노드의 속성입니다(CanvasItem › Texture › Filter). 상속(Inherit)으로 둔 노드는 부모의 필터를 따르고, 트리 맨 위에서는 프로젝트 설정 `rendering/textures/canvas_textures/default_texture_filter`를 따르는데 기본값이 Linear입니다. Linear는 가까운 텍셀 네 개를 섞기 때문에 1배보다 크게 그리는 순간 모든 픽셀 경계가 부드러운 경사가 됩니다.',
    '가져오기. Godot는 PNG를 밉맵 없는 무손실로 가져오며, 문서도 도트에 권장하는 설정이라고 적고 있습니다. 하지만 텍스처를 3D 머티리얼에 쓰면 Detect 3D가 밉맵이 있는 VRAM 압축으로 바꾸고, 누군가 손실·VRAM 압축을 고르거나 Process › Size Limit가 이미지를 줄이면(큐빅 보간) 달라집니다. 카메라를 축소해 1배보다 작게 그릴 때도 밉맵이 스프라이트를 흐리게 만듭니다.',
    '배율. 320 × 180 게임을 1920 × 1080 창에 띄우면 정확히 6배라서 도트 하나가 화면 픽셀 6 × 6이 됩니다. 1366 × 768 창에서는 4.27배라 어떤 도트는 4픽셀, 어떤 도트는 5픽셀 폭이 되고 선이 울퉁불퉁해 보입니다. 이를 정하는 것이 `display/window/stretch/mode`, `aspect`, `scale_mode`이며 `scale_mode = integer`로 두면 배율을 정수로 내림합니다.',
    '움직임. x = 10.4에 놓인 스프라이트나 카메라는 화면 픽셀 사이에 그려집니다. Linear 필터에서는 흐림이, Nearest에서는 떨림이 되고, 캐릭터와 배경이 서로 다르게 반올림되어 한쪽이 흔들려 보입니다. `rendering/2d/snap/snap_2d_transforms_to_pixel`을 켜면 CanvasItem 위치를 정수 픽셀로 반올림합니다.'],
    terms:[['`texture_filter`','CanvasItem 속성: Inherit(부모에서 상속), Nearest, Linear와 밉맵 변형. 트리 맨 위에서는 프로젝트 기본값이 쓰입니다.'],['`display/window/stretch/mode`','`disabled`, `canvas_items`(2D를 창 해상도로 그림), `viewport`(게임을 기본 크기로 렌더링한 뒤 그 이미지를 창 크기로 늘림).'],['`display/window/stretch/scale_mode`','`fractional`은 배율을 그대로 쓰고, `integer`는 내림해 화면이 항상 기본 크기의 정수배가 됩니다.'],['`rendering/2d/snap/snap_2d_transforms_to_pixel`','CanvasItem 위치를 정수 픽셀로 반올림. 더 또렷하지만 움직임이 덜 부드럽습니다. 프로젝트 시작 때만 읽습니다.']]},
   example:{title:'예시: 320 × 180 게임을 세 가지 창 크기로',lead:'기본 크기는 `display/window/size/viewport_width` × `viewport_height`입니다. 늘이기 배율은 창 크기를 이 값으로 나눈 것입니다.',lines:[
    '창 크기       배율                scale_mode = fractional     scale_mode = integer',
    '1920 × 1080   1920/320 = 6.00     도트 1개 = 6 × 6 px          6 × 6, 창을 가득 채움',
    '2560 × 1440   2560/320 = 8.00     8 × 8                       8 × 8',
    '1366 × 768    768/180  = 4.27     도트 폭 4px 또는 5px          내림 → 4: 1280 × 720 + 여백',
    '',
    '4.27이 안 되는 이유: 도트 32개 × 4.27 = 화면 136.5px — 똑같이 나눌 방법이 없음'],
    after:'`aspect = keep`이면 남는 공간은 검은 여백이 되고, `expand`이면 대신 레벨이 더 보입니다(Godot 문서는 도트 게임에 둘 중 하나를 권합니다). 정수 배율에서는 창이 기본 크기보다 작아지면 화면이 잘린다고 문서가 경고하므로 `Window.min_size`를 기본 크기로 두세요.'},
   mapping:{title:'Nerulio 번들이 없애는 원인과 직접 고칠 원인',head:['원인','설정 위치','Godot 4 번들이 해결?'],rows:[
    ['노드의 Linear 필터','CanvasItem › Texture › Filter 또는 프로젝트 기본값','번들에 든 `AnimatedSprite2D`에만(`texture_filter = 1`, Nearest). 다른 노드는 여전히 프로젝트 기본값을 상속'],
    ['밉맵, 손실·VRAM 압축, Size Limit','PNG의 가져오기 설정','예: 함께 온 `.png.import`가 `compress/mode=0`(무손실), `mipmaps/generate=false`, `process/size_limit=0`'],
    ['알파 경계의 흐린 픽셀 색이 바뀜','가져오기 옵션 Process › Fix Alpha Border(기본 켬)','예: `process/fix_alpha_border=false`'],
    ['소수 늘이기 배율','프로젝트 설정 › Display › Window › Stretch','아니요 — 프로젝트 설정'],
    ['스프라이트·카메라의 서브픽셀 위치','`rendering/2d/snap/*`, 스크립트, Camera2D 스무딩','아니요 — 프로젝트 설정과 코드'],
    ['정수가 아닌 Camera2D 줌(1.5)','Camera2D 노드','아니요 — 1, 2, 3 …을 쓰세요'],
    ['PNG 안에서 이미 흐린 그림','원본 이미지','아니요. 번들은 그린 그대로 묶습니다. [[game/pixel-art-downscaler|도트 1배 복원]]으로 먼저 1배 그림을 되살리세요']]},
   target:{title:'Godot 4에서 이 순서로 고치기',steps:[
    '프로젝트 설정 › Rendering › Textures › Canvas Textures › Default Texture Filter = Nearest(게임 나머지가 고해상도라면 도트 노드에만 Texture › Filter = Nearest).',
    '프로젝트 설정 › Display › Window › Size에서 뷰포트 너비와 높이를 도트 해상도(예: 320 × 180)로 둡니다.',
    '프로젝트 설정 › Display › Window › Stretch: Mode = `viewport`, Aspect = `keep`(또는 `expand`), Scale Mode = `integer`. Godot 문서가 도트 게임에 권하는 조합입니다. 스프라이트를 서브픽셀 위치로 움직이고 회전시키고 싶을 때만 `canvas_items`를 쓰세요.',
    '움직일 때 떨리면 `rendering/2d/snap/snap_2d_transforms_to_pixel`을 켜고 프로젝트를 다시 시작합니다(시작 때 읽음). 문서는 `snap_2d_vertices_to_pixel`과 함께 켜지 말라고 합니다.',
    '도트 PNG마다 Import 독을 확인합니다: Compress › Mode 무손실, Mipmaps › Generate 끔, 흐린 픽셀이 있으면 Fix Alpha Border 끔. 바꿨다면 Reimport를 누르세요. Nerulio 번들([[game/aseprite-to-godot|Aseprite를 Godot로]], [[game/godot-sprite-sheet|스프라이트 시트를 Godot로]])에는 이 값이 이미 들어 있습니다.',
    '`Camera2D.zoom`과 노드 크기 배율은 정수로 유지합니다.']},
   verify:{steps:[
    '멈춘 스프라이트를 2D 편집기에서 800 %로 확대합니다. 경계가 네모나면 Nearest, 부드러운 경사면 Linear입니다.',
    '기본 크기가 320 × 180이면 1920 × 1080 창으로 실행해 스크린숏을 확대합니다. 도트 하나가 정확히 화면 픽셀 6 × 6이어야 합니다.',
    '창을 1366 × 768로 줄입니다. `scale_mode = integer`라면 여백이 생기고 도트가 4와 5가 섞이지 않은 4 × 4로 또렷합니다.',
    '카메라를 천천히 움직입니다. 위치 스냅을 켰다면 스프라이트가 떨리지 않고 한 픽셀씩 움직입니다.']},
   trouble:{rows:[
    ['가만히 있어도 경계가 흐림','Linear 필터: 노드가 프로젝트 기본값을 물려받음','노드를 선택해 Texture › Filter가 상속이고 기본 필터가 Linear인지 확인','기본 필터를 한 번 Nearest로, 또는 그 노드의 Filter를 Nearest로'],
    ['축소했을 때만, 또는 3D 머티리얼에 쓴 뒤로 흐림','밉맵이나 VRAM 압축 — Detect 3D가 가져오기 설정을 바꿈','PNG의 Import 독에서 압축 방식과 밉맵 생성 확인. Detect 3D가 작동하면 출력 패널에 메시지가 뜸','압축을 무손실로, 밉맵을 끄고 다시 가져오기'],
    ['어떤 도트는 더 넓고 대각선이 울퉁불퉁함','소수 늘이기 배율(4.27배)이나 1.5 같은 Camera2D 줌','창 크기 ÷ 기본 크기, Camera2D의 줌 값','늘이기 모드 `viewport` + 배율 모드 `integer`, 줌은 정수로'],
    ['멈추면 선명하고 움직일 때 떨리거나 흔들림','스프라이트나 카메라가 픽셀 사이에 있음(카메라 위치 스무딩과 함께 흔함)','움직이는 동안 `print(global_position)`에 10.4 같은 값이 찍힘','`snap_2d_transforms_to_pixel`을 켜고 다시 시작하거나, 코드에서 위치를 반올림'],
    ['흐린 빛·연기 픽셀의 색이 바뀜','기본으로 켜진 Fix Alpha Border가 투명 픽셀을 주변 색으로 채움','Import 독의 Process › Fix Alpha Border','끄고 다시 가져오기 — 번들의 `.png.import`가 그렇게 설정함'],
    ['1920 × 1080에서는 또렷한데 노트북 화면이나 창 크기를 바꾸면 고르지 않음','늘이기 배율이 창 크기에 따라 달라짐','1366 × 768로 실행하거나 창을 최대화해 보기','배율 모드 `integer`, `Window.min_size`를 기본 크기로'],
    ['이미지 뷰어에서 800 %로 봐도 PNG 자체가 흐림','Godot에 오기 전에 부드러운 보간으로 크기가 바뀐 그림','Godot 밖에서 원본 파일을 열어 보기','어떤 Godot 설정으로도 안 됩니다. 먼저 1배 그림을 되살리세요']]},
   alternatives:{rows:[
    ['위 단계대로 프로젝트를 한 번 도트용으로 설정하고 PNG를 그대로 가져오기','PNG에 바로 그리고 `Sprite2D`를 쓸 때. 기본 무손실 가져오기가 이미 맞으므로 필터와 늘이기만 바꾸면 됩니다.'],
    ['일부 노드에만 Nearest','고해상도 게임에 도트 요소가 몇 개만 있을 때. 프로젝트 기본값은 Linear로 두고 그 노드들만 Texture › Filter = Nearest.'],
    ['Nerulio Godot 4 번들','시트나 .aseprite 파일에서 시작해 애니메이션, Nearest 씬, 가져오기 파일을 한 번에 받고 싶을 때.']]},
   limits:['번들은 `project.godot`를 고치지 않습니다. 기본 필터·늘이기·스냅·카메라는 설정한 그대로입니다.','내보내기 전에 이미 흐려진 스프라이트는 그대로이며, 가져오기 설정으로 다시 선명해지지 않습니다.','위의 늘이기·스냅 설정은 Godot 문서에 근거하며, 우리 Godot 실행은 번들을 검증했지 그 설정을 검증하지 않았습니다.'],
   versions:{body:['검증 실행에서 Godot 4.7.2가 Nerulio 번들을 불러와 함께 온 씬을 4배로 그렸고 선명하게 유지됐습니다. Godot 기본 Fix Alpha Border가 흐린 픽셀의 색을 바꾸던 4096² 이펙트 시트도 번들의 가져오기 파일로는 통과했습니다. 설정 이름·기본값·도트 권장 설정은 Godot 4.7 문서를 따랐습니다(문서에는 4.7에서 만든 프로젝트가 늘이기 모드 `canvas_items`로 시작한다는 설명도 있습니다).'],sources:GODOT_DOCS}
  },
  ja:{
   answer:'Godot 4でドット絵がぼやける原因は4つのどれかです。ノードがプロジェクト既定のLinearフィルターで描かれている、テクスチャがミップマップや非可逆・VRAM圧縮で取り込まれた、ウィンドウがゲームを小数倍に引き伸ばしている、スプライトや`Camera2D`が画面のピクセルの間にある。まず止まった画面、次に動いている画面を確認します。NerulioのGodot 4バンドルはファイル側（Nearestのシーン、可逆・ミップマップなしの`.png.import`）を直し、引き伸ばし・スナップ・カメラは自分で変えるプロジェクト設定です。',
   concept:{title:'ぼけは4種類、直す場所も4つ',body:[
    'フィルター。Godot 4.0からフィルターは取り込んだテクスチャではなくノードの属性です（CanvasItem › Texture › Filter）。継承（Inherit）のままのノードは親のフィルターを使い、ツリーの一番上ではプロジェクト設定`rendering/textures/canvas_textures/default_texture_filter`に従います。その既定値はLinearです。Linearは近くの4テクセルを混ぜるので、1倍より大きく描いた瞬間にすべてのピクセルの境目がなだらかな坂になります。',
    'インポート。GodotはPNGをミップマップなしの可逆（Lossless）で取り込み、ドキュメントもドット絵に推奨する設定だとしています。ただしテクスチャを3Dマテリアルに使うとDetect 3Dがミップマップ付きのVRAM圧縮に切り替え、誰かが非可逆・VRAM圧縮を選んだり、Process › Size Limitが縮小したり（キュービック補間）すると変わります。カメラを引いて1倍未満で描くときも、ミップマップがスプライトをぼかします。',
    '倍率。320 × 180のゲームを1920 × 1080のウィンドウに出すとちょうど6倍で、1ドットが画面の6 × 6ピクセルになります。1366 × 768では4.27倍なので、4ピクセル幅のドットと5ピクセル幅のドットが混ざり、線がでこぼこに見えます。これを決めるのが`display/window/stretch/mode`、`aspect`、`scale_mode`で、`scale_mode = integer`にすると倍率を整数に切り捨てます。',
    '動き。x = 10.4にあるスプライトやカメラは画面のピクセルの間に描かれます。Linearならぼけ、Nearestならちらつきになり、キャラクターと背景の丸め方が違うと片方が揺れて見えます。`rendering/2d/snap/snap_2d_transforms_to_pixel`はCanvasItemの位置を整数ピクセルに丸めます。'],
    terms:[['`texture_filter`','CanvasItemの属性：Inherit（親から継承）、Nearest、Linearとミップマップ付きの種類。ツリーの一番上ではプロジェクトの既定値が使われます。'],['`display/window/stretch/mode`','`disabled`、`canvas_items`（2Dをウィンドウの解像度で描く）、`viewport`（ゲームを基準サイズで描画し、その画像をウィンドウに合わせて拡大）。'],['`display/window/stretch/scale_mode`','`fractional`は倍率をそのまま使い、`integer`は切り捨てて、画面を常に基準サイズの整数倍にします。'],['`rendering/2d/snap/snap_2d_transforms_to_pixel`','CanvasItemの位置を整数ピクセルに丸めます。くっきりしますが動きのなめらかさは落ちます。起動時にだけ読まれます。']]},
   example:{title:'例：320 × 180のゲームを3つのウィンドウサイズで',lead:'基準サイズは`display/window/size/viewport_width` × `viewport_height`です。引き伸ばしの倍率はウィンドウサイズをこれで割った値です。',lines:[
    'ウィンドウ     倍率                scale_mode = fractional     scale_mode = integer',
    '1920 × 1080   1920/320 = 6.00     1ドット = 6 × 6 px          6 × 6、画面いっぱい',
    '2560 × 1440   2560/320 = 8.00     8 × 8                       8 × 8',
    '1366 × 768    768/180  = 4.27     ドット幅が4pxか5px           切り捨て → 4：1280 × 720 + 余白',
    '',
    '4.27がだめな理由：32ドット × 4.27 = 画面136.5px — 均等に分ける方法がない'],
    after:'`aspect = keep`なら余った部分は黒い帯になり、`expand`ならその分だけレベルが広く見えます（Godotのドキュメントはドット絵にどちらかを勧めています）。整数倍率ではウィンドウが基準サイズより小さいと画面が切れるとドキュメントが注意しているので、`Window.min_size`を基準サイズにしてください。'},
   mapping:{title:'Nerulioのバンドルが取り除く原因と、自分で直す原因',head:['原因','設定の場所','Godot 4バンドルで解決？'],rows:[
    ['ノードのLinearフィルター','CanvasItem › Texture › Filter、またはプロジェクトの既定値','バンドルの`AnimatedSprite2D`だけ（`texture_filter = 1`、Nearest）。ほかのノードは引き続きプロジェクトの既定値を継承'],
    ['ミップマップ、非可逆・VRAM圧縮、Size Limit','PNGのインポート設定','はい：同梱の`.png.import`は`compress/mode=0`（可逆）、`mipmaps/generate=false`、`process/size_limit=0`'],
    ['アルファの縁で薄いピクセルの色が変わる','インポートオプション Process › Fix Alpha Border（既定でオン）','はい：`process/fix_alpha_border=false`'],
    ['小数の引き伸ばし倍率','プロジェクト設定 › Display › Window › Stretch','いいえ — プロジェクト設定'],
    ['スプライト・カメラのサブピクセル位置','`rendering/2d/snap/*`、スクリプト、Camera2Dのスムージング','いいえ — プロジェクト設定とコード'],
    ['整数でないCamera2Dのズーム（1.5）','Camera2Dノード','いいえ — 1、2、3…を使う'],
    ['PNGの中ですでにぼけている絵','元の画像','いいえ。バンドルは描いたとおりにまとめます。先に[[game/pixel-art-downscaler|ドット絵の1倍復元]]で1倍の絵を作り直してください']]},
   target:{title:'Godot 4でこの順に直す',steps:[
    'プロジェクト設定 › Rendering › Textures › Canvas Textures › Default Texture Filter = Nearest（ほかが高解像度のゲームなら、ドット絵のノードだけTexture › Filter = Nearest）。',
    'プロジェクト設定 › Display › Window › Sizeで、ビューポートの幅と高さをドット絵の解像度（例：320 × 180）にします。',
    'プロジェクト設定 › Display › Window › Stretch：Mode = `viewport`、Aspect = `keep`（または`expand`）、Scale Mode = `integer`。Godotのドキュメントがドット絵に勧める組み合わせです。スプライトをサブピクセル位置で動かし回転させたいときだけ`canvas_items`を使います。',
    '動くとちらつくなら`rendering/2d/snap/snap_2d_transforms_to_pixel`をオンにしてプロジェクトを再起動します（起動時に読まれる）。ドキュメントは`snap_2d_vertices_to_pixel`との併用を勧めていません。',
    'ドット絵のPNGごとにインポートドックを確認：Compress › Modeが可逆、Mipmaps › Generateがオフ、薄いピクセルがあればFix Alpha Borderもオフ。変えたら再インポート。Nerulioのバンドル（[[game/aseprite-to-godot|AsepriteをGodotへ]]、[[game/godot-sprite-sheet|スプライトシートをGodotへ]]）にはこの値がすでに入っています。',
    '`Camera2D.zoom`とノードのスケールは整数に保ちます。']},
   verify:{steps:[
    '止まったスプライトを2Dエディターで800 %に拡大します。縁が四角ならNearest、なだらかならLinearです。',
    '基準が320 × 180なら1920 × 1080のウィンドウで実行し、スクリーンショットを拡大します。1ドットがちょうど画面の6 × 6ピクセルのはずです。',
    'ウィンドウを1366 × 768にします。`scale_mode = integer`なら余白が出て、ドットは4と5が混ざらない4 × 4でくっきりしたままです。',
    'カメラをゆっくり動かします。位置のスナップがオンなら、スプライトはちらつかず1ピクセルずつ動きます。']},
   trouble:{rows:[
    ['止まっていても縁がぼける','Linearフィルター：ノードがプロジェクトの既定値を継承している','ノードを選び、Texture › Filterが継承で既定のフィルターがLinearか確認','既定のフィルターを一度Nearestに、またはそのノードのFilterをNearestに'],
    ['引いたときだけ、または3Dマテリアルに使ってからぼける','ミップマップかVRAM圧縮 — Detect 3Dがインポート設定を変えた','PNGのインポートドックで圧縮方式とミップマップ生成を確認。Detect 3Dが働くと出力パネルにメッセージが出る','圧縮を可逆に、ミップマップをオフにして再インポート'],
    ['一部のドットだけ太く、斜めの線ががたがた','小数の引き伸ばし倍率（4.27倍）や1.5のようなCamera2Dのズーム','ウィンドウサイズ ÷ 基準サイズ、Camera2Dのズーム値','引き伸ばしモード`viewport`＋倍率モード`integer`、ズームは整数に'],
    ['止まるとくっきり、動くとちらつく・揺れる','スプライトかカメラがピクセルの間にある（カメラ位置のスムージングでよく起きる）','動いている間`print(global_position)`に10.4のような値が出る','`snap_2d_transforms_to_pixel`をオンにして再起動、またはコードで位置を丸める'],
    ['薄い光・煙のピクセルの色が変わる','既定でオンのFix Alpha Borderが透明ピクセルを周りの色で埋める','インポートドックのProcess › Fix Alpha Border','オフにして再インポート — バンドルの`.png.import`はそう設定済み'],
    ['1920 × 1080ではくっきり、ノートPCやウィンドウサイズ変更でばらつく','引き伸ばし倍率がウィンドウサイズで変わる','1366 × 768で実行するか、ウィンドウを最大化してみる','倍率モード`integer`、`Window.min_size`を基準サイズに'],
    ['画像ビューアで800 %にしてもPNG自体がぼけている','Godotに来る前になめらかな補間でサイズ変更された絵','Godotの外で元のファイルを開く','Godotの設定では直りません。先に1倍の絵を作り直してください']]},
   alternatives:{rows:[
    ['上の手順で一度だけプロジェクトをドット絵向けにし、PNGはそのまま取り込む','PNGに直接描いて`Sprite2D`を使うとき。既定の可逆インポートがすでに正しいので、フィルターと引き伸ばしだけ変えれば済みます。'],
    ['一部のノードだけNearest','高解像度のゲームにドット絵の要素が少しだけあるとき。プロジェクトの既定はLinearのまま、そのノードだけTexture › Filter = Nearest。'],
    ['NerulioのGodot 4バンドル','シートや.asepriteから始めて、アニメーション、Nearestのシーン、インポートファイルを一度に用意したいとき。']]},
   limits:['バンドルは`project.godot`を書き換えません。既定のフィルター・引き伸ばし・スナップ・カメラは設定したままです。','書き出す前にぼけていたスプライトはぼけたままで、インポート設定でくっきり戻ることはありません。','上の引き伸ばし・スナップの設定はGodotのドキュメントに基づくもので、私たちのGodotでの実行はバンドルを検証したものです。'],
   versions:{body:['検証の実行ではGodot 4.7.2がNerulioのバンドルを読み込み、同梱のシーンを4倍で描画してもくっきりしたままでした。Godot既定のFix Alpha Borderが薄いピクセルの色を変えていた4096²のエフェクトシートも、バンドルのインポートファイルでは合格しました。設定名・既定値・ドット絵向けの推奨はGodot 4.7のドキュメントに従っています（4.7で作ったプロジェクトは引き伸ばしモード`canvas_items`で始まるという記述もあります）。'],sources:GODOT_DOCS}
  }
 },
 'game/unity-pixel-art-blurry':{
  type:'troubleshoot',
  intent:{primary:'fix blurry, smeared or uneven pixel art in Unity',secondary:['Filter Mode Point, Compression None, Max Size','Pixels Per Unit that matches the art','Pixel Perfect Camera in URP','blur only while moving'],
   goal:'Unity sprites that stay sharp and equal-sized at rest and while moving',input:'pixel-art PNG sheets or .aseprite files for a Unity 6 project',output:'a diagnosis per cause; the Unity 6 bundle (importer that sets Point, no compression, no mipmaps, Max Size, PPU); camera steps to do by hand',target:'Unity 6 (URP 2D; bundle verified in 6000.5.3f1)',support:'partial',
   evidence:['src/game/export/unity.js (NerulioSpriteImporter.cs: Point, Uncompressed, mipmaps off, Max Size next power of two, spritePixelsPerUnit from JSON, default 100)','docs/STUDIO-PACK.md (Unity 6000.5.3f1 batch mode: rects, pivots, pixels, clips)'],
   external:['Unity 6.0 manual: Sprite texture import settings (Filter Mode, Pixels Per Unit)','Unity 6.6 manual: Max Size, Resize Algorithm, Compression','Unity 6.0 URP manual: Pixel Perfect Camera setup, reference and configuration']},
  en:{
   answer:'Pixel art in Unity turns soft for import reasons — Filter Mode Bilinear, compression, a Max Size smaller than the sheet (Unity resizes it on import), mipmaps — or for camera reasons: a screen-to-art pixel ratio that is not a whole number, sub-pixel movement, or a Pixel Perfect Camera stretching with its default Retro AA filter. Blurry while standing still: check the texture. Only while moving or at some window sizes: check the camera. Nerulio’s Unity 6 bundle sets the texture side for you; the camera is a scene setting you add.',
   concept:{title:'Texture settings, Pixels Per Unit and the camera',body:[
    'Texture import. Filter Mode Point (no filter) looks blocky up close, Bilinear looks blurry up close and Trilinear also blurs between mipmap levels. Compression Low, Normal or High Quality stores a lossy GPU format that shifts colours in small blocks; None keeps every pixel. Max Size is the largest dimension Unity imports: a 4096 px sheet with Max Size 2048 is resized on import (Resize Algorithm Mitchell by default), which smears every pixel.',
    'Pixels Per Unit (PPU) says how many art pixels make one world unit. With PPU 16 a 16 × 16 tile is exactly one unit and one art pixel is 1/16 = 0.0625 units. Sprites with different PPU values are drawn at different sizes, and no camera can make all of them pixel-perfect at once.',
    'Camera. An orthographic camera shows 2 × Size units vertically; the screen height divided by the art pixels that fit in it must be a whole number, or art pixels become 4 and 5 screen pixels in turn. In URP the Pixel Perfect Camera component does this calculation from Assets Pixels Per Unit and Reference Resolution (the separate 2D Pixel Perfect package is for the Built-In Render Pipeline only).',
    'Movement. A position of 3.0625 at PPU 16 is exactly on an art pixel; 3.03 is half-way between two. Grid Snapping (Pixel Snapping or Upscale Render Texture) aligns rendering to the pixel grid. When Crop Frame is Stretch Fill, the default Filter Mode Retro AA stretches with bilinear filtering: less shimmer, softer pixels.'],
    terms:[['Filter Mode','Point (no filter), Bilinear or Trilinear, set per texture.'],['Pixels Per Unit','Art pixels per world unit. One value for every sprite, usually the tile size.'],['Assets Pixels Per Unit, Reference Resolution','Pixel Perfect Camera fields: your sprites’ PPU and the resolution the art is designed for (for example 320 × 180).'],['Grid Snapping','None, Pixel Snapping (rendering aligned to the pixel grid; Transform positions unchanged) or Upscale Render Texture (render at the reference resolution, then upscale).']]},
   example:{title:'Example: 16 PPU art in a 320 × 180 view',lead:'Assets Pixels Per Unit = 16, Reference Resolution = 320 × 180:',lines:[
    'visible world    320/16 × 180/16 = 20 × 11.25 units   (orthographic Size = 11.25/2 = 5.625)',
    'one art pixel    1/16 = 0.0625 units',
    '',
    'screen          pixel ratio        what one art pixel becomes',
    '1920 × 1080     1080/180 = 6       6 × 6 screen pixels',
    '2560 × 1440     1440/180 = 8       8 × 8',
    '1366 × 768      768/180  = 4.27    4 or 5 px if the view is simply stretched'],
    after:'At 1366 × 768 no whole ratio fills the screen exactly: either the image keeps 4:1 (1280 × 720) and the rest is cropped or bordered (Crop Frame), or it is stretched and the pixels become uneven or soft. The Pixel Perfect Camera shows the ratio it uses as Current Pixel Ratio.'},
   mapping:{title:'Which cause the Nerulio bundle removes, and which stay with you',head:['Cause','Where to change it','Set by the Unity 6 bundle?'],rows:[
    ['Filter Mode Bilinear or Trilinear','Texture Import Settings › Advanced › Filter Mode','Yes: Point'],
    ['Compression Low / Normal / High Quality','Texture Import Settings, Default tab › Compression','Yes: None (Uncompressed) in the default settings; platform override tabs you add keep their own value'],
    ['Max Size smaller than the sheet','Default tab › Max Size','Yes: raised to the next power of two that holds the page'],
    ['Mipmaps','Generate Mipmap','Yes: off'],
    ['Different PPU per sprite','Pixels Per Unit','From `pixelsPerUnit` in the exported JSON — 100 unless you edit it'],
    ['Pixel ratio not a whole number','Camera / Pixel Perfect Camera','No — scene setting'],
    ['Sub-pixel movement, Retro AA softening','Pixel Perfect Camera › Grid Snapping, Filter Mode; your scripts','No']]},
   target:{title:'Fix it in Unity 6 (URP 2D)',steps:[
    'Select all pixel-art textures in the Project window and give them one Pixels Per Unit value, for example 16.',
    'In the Advanced section set Filter Mode = Point (no filter); in the Default tab set Compression = None and Max Size at least the sheet’s longest side; turn Generate Mipmap off; Apply.',
    'Select the main camera › Add Component › Pixel Perfect Camera. Set Assets Pixels Per Unit to the same PPU and Reference Resolution to your art resolution (for example 320 × 180).',
    'Set Grid Snapping to Pixel Snapping (or Upscale Render Texture if rotated sprites should keep square pixels) and choose a Crop Frame; with Stretch Fill, switch Filter Mode to Point if Retro AA looks too soft.',
    'In the Scene view’s Grid and Snap overlay, set Grid Size to 1 ÷ PPU (0.0625 for 16) and enable grid snapping, so placed sprites land on whole art pixels.',
    'For art coming from Nerulio: edit `pixelsPerUnit` in the `.unity.json`, copy it with the PNG and the `Editor/` folder into `Assets/` and run Tools › Nerulio › Import Studio JSON — steps 1 and 2 are then done for those textures.']},
   verify:{steps:[
    'Select a texture: Filter Mode Point (no filter), Compression None, Max Size ≥ the longest side, Generate Mipmap off.',
    'Game view at 1920 × 1080 with a 320 × 180 reference: zoom a screenshot — every art pixel is 6 × 6.',
    'Pixel Perfect Camera › Current Pixel Ratio shows a whole ratio such as 6:1.',
    'Walk a character slowly: it moves in whole-pixel steps instead of smearing.']},
   trouble:{rows:[
    ['Blurry even when nothing moves','Filter Mode Bilinear or Trilinear','Texture Inspector › Advanced › Filter Mode','Point (no filter), Apply'],
    ['Blocky colour smudges on outlines and gradients','Lossy Compression (Normal Quality)','Default tab › Compression, and every platform override tab','None — in each override you use as well'],
    ['A big sheet looks soft and slightly shrunk','Max Size is smaller than the sheet, so Unity resized it on import','Compare the image size with Max Size','Raise Max Size to at least the longest side'],
    ['Uneven pixels: some lines 4 px thick, some 5','Screen height ÷ art pixels is not whole, or a Transform Scale is fractional','Current Pixel Ratio; the sprite’s Transform Scale','Pixel Perfect Camera with the right Reference Resolution; keep Scale at 1'],
    ['Sharp at rest, shimmers while walking','Sprite or camera between art pixels','Transform Position changes by less than 1/PPU per step','Grid Snapping = Pixel Snapping; move the camera target in steps of 1/PPU'],
    ['Pixel Perfect Camera added, but everything is a little soft','Crop Frame Stretch Fill with the default Filter Mode Retro AA (bilinear)','Pixel Perfect Camera › Filter Mode','Filter Mode = Point (more shimmer), or a Crop Frame that keeps a whole ratio'],
    ['Tiles and characters have unexpected sizes','Different Pixels Per Unit per texture, or the bundle’s default 100','Pixels Per Unit on each texture','One value everywhere, and the same in Assets Pixels Per Unit']]},
   alternatives:{rows:[
    ['Change the import settings by hand (multi-select in the Project window)','A few PNGs drawn elsewhere: four fields per texture, no extra script in the project.'],
    ['[[game/aseprite-to-unity|Aseprite to Unity bundle]]','You start from an .aseprite file and also want one animation clip per tag with each frame’s own duration.'],
    ['The separate 2D Pixel Perfect package','Your project uses the Built-In Render Pipeline; Unity documents that package for Built-In only.']]},
   limits:['The bundle does not add or configure a camera: Pixel Perfect Camera, Crop Frame and Grid Snapping are yours.','Pixels Per Unit is not set in the Studio: edit `pixelsPerUnit` in the exported JSON before importing (100 otherwise).','The camera steps come from the Unity 6.0 URP manual; our Unity runs checked the import, not the camera.'],
   versions:{body:['Unity 6000.5.3f1 imported the Nerulio bundle in batch mode in our verification runs: sprite rects, pivots, pixels, clip keys and durations came back as exported, with the importer’s Point / uncompressed / no-mipmap settings. The Pixel Perfect Camera, snapping and import-setting descriptions follow the Unity 6.0 and 6.6 manuals.'],sources:UNITY_DOCS}
  },
  ko:{
   answer:'유니티에서 도트가 흐려지는 이유는 가져오기 쪽 — Filter Mode Bilinear, 압축, 시트보다 작은 Max Size(가져올 때 유니티가 줄임), 밉맵 — 이거나 카메라 쪽 — 화면과 도트의 비율이 정수가 아님, 서브픽셀 이동, 기본 Retro AA 필터로 늘리는 Pixel Perfect Camera — 입니다. 가만히 있어도 흐리면 텍스처를, 움직일 때나 특정 창 크기에서만 흐리면 카메라를 보세요. Nerulio의 Unity 6 번들은 텍스처 쪽을 맞춰 주고, 카메라는 직접 추가하는 씬 설정입니다.',
   concept:{title:'텍스처 설정, Pixels Per Unit, 카메라',body:[
    '텍스처 가져오기. Filter Mode의 Point(no filter)는 확대하면 각지게, Bilinear는 흐리게 보이고 Trilinear는 밉맵 단계 사이까지 흐리게 섞습니다. Compression의 Low·Normal·High Quality는 작은 블록 단위로 색이 틀어지는 손실 GPU 형식이고, None은 픽셀을 그대로 둡니다. Max Size는 유니티가 가져오는 최대 크기라서 4096px 시트에 Max Size가 2048이면 가져올 때 크기를 줄이고(기본 Resize Algorithm은 Mitchell) 모든 도트가 번집니다.',
    'Pixels Per Unit(PPU)은 월드 1유닛에 들어가는 도트 수입니다. PPU 16이면 16 × 16 타일이 정확히 1유닛이고 도트 하나는 1/16 = 0.0625유닛입니다. 스프라이트마다 PPU가 다르면 서로 다른 크기로 그려져 어떤 카메라로도 한꺼번에 픽셀 퍼펙트로 만들 수 없습니다.',
    '카메라. 직교 카메라는 세로로 2 × Size 유닛을 보여 줍니다. 화면 높이를 그 안에 들어가는 도트 수로 나눈 값이 정수가 아니면 도트가 화면 픽셀 4개와 5개로 번갈아 그려집니다. URP에서는 Pixel Perfect Camera 컴포넌트가 Assets Pixels Per Unit과 Reference Resolution으로 이 계산을 합니다(별도의 2D Pixel Perfect 패키지는 Built-In 렌더 파이프라인 전용).',
    '움직임. PPU 16에서 위치 3.0625는 정확히 도트 위에 있고, 3.03은 두 도트 사이 중간쯤입니다. Grid Snapping(Pixel Snapping 또는 Upscale Render Texture)이 렌더링을 픽셀 격자에 맞춥니다. Crop Frame이 Stretch Fill이면 기본 Filter Mode인 Retro AA가 쌍선형으로 늘려서, 떨림은 줄지만 도트가 부드러워집니다.'],
    terms:[['Filter Mode','Point(no filter), Bilinear, Trilinear. 텍스처마다 설정.'],['Pixels Per Unit','월드 1유닛당 도트 수. 모든 스프라이트에 같은 값, 보통 타일 크기.'],['Assets Pixels Per Unit, Reference Resolution','Pixel Perfect Camera 항목: 스프라이트의 PPU와 그림이 설계된 해상도(예: 320 × 180).'],['Grid Snapping','None, Pixel Snapping(렌더링을 픽셀 격자에 맞춤, Transform 위치는 그대로), Upscale Render Texture(기준 해상도로 렌더링한 뒤 확대).']]},
   example:{title:'예시: 320 × 180 화면에 PPU 16 도트',lead:'Assets Pixels Per Unit = 16, Reference Resolution = 320 × 180일 때:',lines:[
    '보이는 월드     320/16 × 180/16 = 20 × 11.25유닛   (직교 Size = 11.25/2 = 5.625)',
    '도트 1개        1/16 = 0.0625유닛',
    '',
    '화면            픽셀 비율          도트 1개의 크기',
    '1920 × 1080     1080/180 = 6       화면 픽셀 6 × 6',
    '2560 × 1440     1440/180 = 8       8 × 8',
    '1366 × 768      768/180  = 4.27    그냥 늘리면 4px 또는 5px'],
    after:'1366 × 768에서는 화면을 정확히 채우는 정수 비율이 없습니다. 4:1(1280 × 720)을 지키고 나머지를 잘라내거나 테두리로 두든지(Crop Frame), 늘려서 도트가 고르지 않거나 흐려지든지 둘 중 하나입니다. Pixel Perfect Camera는 쓰고 있는 비율을 Current Pixel Ratio로 보여 줍니다.'},
   mapping:{title:'Nerulio 번들이 없애는 원인과 직접 고칠 원인',head:['원인','바꾸는 곳','Unity 6 번들이 설정?'],rows:[
    ['Filter Mode Bilinear·Trilinear','Texture Import Settings › Advanced › Filter Mode','예: Point'],
    ['Compression Low·Normal·High Quality','Texture Import Settings의 Default 탭 › Compression','예: 기본 설정에 None(무압축). 직접 추가한 플랫폼별 재정의 탭은 그 값을 유지'],
    ['시트보다 작은 Max Size','Default 탭 › Max Size','예: 페이지가 들어가는 다음 2의 거듭제곱으로 올림'],
    ['밉맵','Generate Mipmap','예: 끔'],
    ['스프라이트마다 다른 PPU','Pixels Per Unit','내보낸 JSON의 `pixelsPerUnit` — 고치지 않으면 100'],
    ['정수가 아닌 픽셀 비율','카메라·Pixel Perfect Camera','아니요 — 씬 설정'],
    ['서브픽셀 이동, Retro AA로 부드러워짐','Pixel Perfect Camera › Grid Snapping, Filter Mode, 스크립트','아니요']]},
   target:{title:'Unity 6(URP 2D)에서 고치기',steps:[
    'Project 창에서 도트 텍스처를 모두 선택하고 Pixels Per Unit을 한 값(예: 16)으로 맞춥니다.',
    'Advanced에서 Filter Mode = Point(no filter), Default 탭에서 Compression = None, Max Size는 시트의 긴 변 이상, Generate Mipmap은 끄고 Apply를 누릅니다.',
    '메인 카메라를 선택하고 Add Component › Pixel Perfect Camera를 추가합니다. Assets Pixels Per Unit을 같은 PPU로, Reference Resolution을 도트 해상도(예: 320 × 180)로 둡니다.',
    'Grid Snapping을 Pixel Snapping으로(회전한 스프라이트도 네모난 도트로 두려면 Upscale Render Texture) 두고 Crop Frame을 고릅니다. Stretch Fill에서 Retro AA가 너무 흐리면 Filter Mode를 Point로 바꿉니다.',
    'Scene 뷰의 Grid and Snap 오버레이에서 Grid Size를 1 ÷ PPU(16이면 0.0625)로 두고 격자 스냅을 켜면 배치한 스프라이트가 도트 단위에 놓입니다.',
    'Nerulio에서 가져오는 그림이라면 `.unity.json`의 `pixelsPerUnit`을 고친 뒤 PNG, `Editor/` 폴더와 함께 `Assets/`에 복사하고 Tools › Nerulio › Import Studio JSON을 실행하세요. 그 텍스처는 1·2단계가 끝난 상태가 됩니다.']},
   verify:{steps:[
    '텍스처를 선택해 Filter Mode Point(no filter), Compression None, Max Size가 긴 변 이상, Generate Mipmap 끔인지 봅니다.',
    'Reference Resolution 320 × 180, Game 뷰 1920 × 1080에서 스크린숏을 확대하면 도트 하나가 6 × 6이어야 합니다.',
    'Pixel Perfect Camera의 Current Pixel Ratio가 6:1 같은 정수 비율입니다.',
    '캐릭터를 천천히 걸리면 번지지 않고 도트 단위로 움직입니다.']},
   trouble:{rows:[
    ['가만히 있어도 흐림','Filter Mode가 Bilinear나 Trilinear','텍스처 인스펙터의 Advanced › Filter Mode','Point(no filter)로 바꾸고 Apply'],
    ['외곽선과 그라데이션에 블록 모양 색 얼룩','손실 압축(Normal Quality)','Default 탭의 Compression과 모든 플랫폼별 재정의 탭','None으로 — 쓰는 재정의 탭마다'],
    ['큰 시트가 흐리고 조금 작아 보임','Max Size가 시트보다 작아 가져올 때 줄어듦','이미지 크기와 Max Size 비교','Max Size를 긴 변 이상으로 올리기'],
    ['도트가 고르지 않아 어떤 선은 4px, 어떤 선은 5px 두께','화면 높이 ÷ 도트 수가 정수가 아니거나 Transform의 Scale이 소수','Current Pixel Ratio와 스프라이트의 Transform Scale','알맞은 Reference Resolution의 Pixel Perfect Camera, Scale은 1로'],
    ['멈추면 선명하고 걸을 때 떨림','스프라이트나 카메라가 도트 사이에 있음','Transform Position이 한 번에 1/PPU보다 작게 바뀜','Grid Snapping = Pixel Snapping, 카메라 대상은 1/PPU 단위로 이동'],
    ['Pixel Perfect Camera를 넣었는데 전체가 살짝 흐림','Crop Frame이 Stretch Fill이고 기본 Filter Mode가 Retro AA(쌍선형)','Pixel Perfect Camera의 Filter Mode','Filter Mode = Point(떨림은 늘어남), 또는 정수 비율을 지키는 Crop Frame'],
    ['타일과 캐릭터 크기가 예상과 다름','텍스처마다 다른 Pixels Per Unit, 또는 번들 기본값 100','텍스처마다 Pixels Per Unit 확인','모든 곳에 같은 값, Assets Pixels Per Unit에도 같은 값']]},
   alternatives:{rows:[
    ['가져오기 설정을 손으로 바꾸기(Project 창에서 여러 개 선택)','다른 곳에서 그린 PNG가 몇 장뿐일 때. 텍스처마다 네 칸이면 되고 프로젝트에 스크립트가 늘지 않습니다.'],
    ['[[game/aseprite-to-unity|Aseprite를 Unity로 번들]]','.aseprite 파일에서 시작하고 태그마다 프레임별 길이가 살아 있는 애니메이션 클립도 원할 때.'],
    ['별도의 2D Pixel Perfect 패키지','Built-In 렌더 파이프라인 프로젝트일 때. 유니티 문서는 이 패키지를 Built-In 전용으로 설명합니다.']]},
   limits:['번들은 카메라를 추가하거나 설정하지 않습니다. Pixel Perfect Camera, Crop Frame, Grid Snapping은 직접 하세요.','Pixels Per Unit은 Studio에서 정하지 않습니다. 가져오기 전에 내보낸 JSON의 `pixelsPerUnit`을 고치세요(아니면 100).','카메라 단계는 Unity 6.0 URP 매뉴얼에 근거하며, 우리 Unity 실행은 가져오기를 검증했지 카메라를 검증하지 않았습니다.'],
   versions:{body:['검증 실행에서 Unity 6000.5.3f1이 배치 모드로 Nerulio 번들을 가져왔고, 스프라이트 영역·피벗·픽셀·클립 키와 시간이 내보낸 그대로였으며 임포터가 Point·무압축·밉맵 없음으로 설정했습니다. Pixel Perfect Camera, 스냅, 가져오기 설정 설명은 Unity 6.0과 6.6 매뉴얼을 따랐습니다.'],sources:UNITY_DOCS}
  },
  ja:{
   answer:'Unityでドット絵がぼやける原因は、インポート側 — Filter ModeのBilinear、圧縮、シートより小さいMax Size（取り込み時にUnityが縮小）、ミップマップ — か、カメラ側 — 画面とドットの比率が整数でない、サブピクセル移動、既定のRetro AAフィルターで引き伸ばすPixel Perfect Camera — です。止まっていてもぼけるならテクスチャを、動いたときや特定のウィンドウサイズだけならカメラを確認します。NerulioのUnity 6バンドルはテクスチャ側を設定し、カメラは自分で追加するシーンの設定です。',
   concept:{title:'テクスチャの設定、Pixels Per Unit、カメラ',body:[
    'テクスチャのインポート。Filter ModeのPoint（no filter）は拡大するとカクカク、Bilinearはぼやけて見え、Trilinearはミップマップの段階の間でもぼかします。CompressionのLow・Normal・High Qualityは小さなブロック単位で色がずれる非可逆のGPU形式で、Noneはピクセルをそのまま残します。Max SizeはUnityが取り込む最大の大きさで、4096pxのシートにMax Sizeが2048だと取り込み時に縮小され（既定のResize AlgorithmはMitchell）、すべてのドットがにじみます。',
    'Pixels Per Unit（PPU）はワールドの1ユニットに入るドット数です。PPU 16なら16 × 16のタイルがちょうど1ユニットで、1ドットは1/16 = 0.0625ユニットです。スプライトごとにPPUが違うと大きさがばらばらに描かれ、どのカメラでも全部を同時にピクセルパーフェクトにはできません。',
    'カメラ。平行投影のカメラは縦に2 × Sizeユニットを映します。画面の高さをそこに入るドット数で割った値が整数でないと、ドットが画面の4ピクセルと5ピクセルで交互に描かれます。URPではPixel Perfect CameraコンポーネントがAssets Pixels Per UnitとReference Resolutionからこの計算をします（別の2D Pixel PerfectパッケージはBuilt-Inレンダーパイプライン専用）。',
    '動き。PPU 16で位置3.0625はちょうどドットの上、3.03は2つのドットの中間あたりです。Grid Snapping（Pixel SnappingかUpscale Render Texture）が描画をピクセルのグリッドに合わせます。Crop FrameがStretch Fillのときは、既定のFilter ModeであるRetro AAがバイリニアで引き伸ばすため、ちらつきは減りますがドットが柔らかくなります。'],
    terms:[['Filter Mode','Point（no filter）、Bilinear、Trilinear。テクスチャごとに設定。'],['Pixels Per Unit','ワールド1ユニットあたりのドット数。全スプライトで同じ値、多くはタイルサイズ。'],['Assets Pixels Per Unit、Reference Resolution','Pixel Perfect Cameraの項目：スプライトのPPUと、絵が想定している解像度（例：320 × 180）。'],['Grid Snapping','None、Pixel Snapping（描画をピクセルのグリッドに合わせ、Transformの位置は変えない）、Upscale Render Texture（基準解像度で描画してから拡大）。']]},
   example:{title:'例：320 × 180の画面にPPU 16のドット絵',lead:'Assets Pixels Per Unit = 16、Reference Resolution = 320 × 180のとき：',lines:[
    '見えるワールド   320/16 × 180/16 = 20 × 11.25ユニット  （平行投影のSize = 11.25/2 = 5.625）',
    '1ドット          1/16 = 0.0625ユニット',
    '',
    '画面            ピクセル比         1ドットの大きさ',
    '1920 × 1080     1080/180 = 6       画面の6 × 6ピクセル',
    '2560 × 1440     1440/180 = 8       8 × 8',
    '1366 × 768      768/180  = 4.27    単に引き伸ばすと4pxか5px'],
    after:'1366 × 768では画面をちょうど埋める整数の比率がありません。4:1（1280 × 720）を守って残りを切り取るか枠にする（Crop Frame）か、引き伸ばしてドットが不揃い・柔らかくなるかのどちらかです。Pixel Perfect Cameraは使っている比率をCurrent Pixel Ratioで表示します。'},
   mapping:{title:'Nerulioのバンドルが取り除く原因と、自分で直す原因',head:['原因','変更する場所','Unity 6バンドルが設定？'],rows:[
    ['Filter ModeがBilinear・Trilinear','Texture Import Settings › Advanced › Filter Mode','はい：Point'],
    ['CompressionのLow・Normal・High Quality','Texture Import SettingsのDefaultタブ › Compression','はい：既定の設定でNone（無圧縮）。自分で追加したプラットフォーム別の上書きタブはその値のまま'],
    ['シートより小さいMax Size','Defaultタブ › Max Size','はい：ページが収まる次の2のべき乗まで引き上げ'],
    ['ミップマップ','Generate Mipmap','はい：オフ'],
    ['スプライトごとに違うPPU','Pixels Per Unit','書き出したJSONの`pixelsPerUnit` — 変えなければ100'],
    ['整数でないピクセル比','カメラ・Pixel Perfect Camera','いいえ — シーンの設定'],
    ['サブピクセル移動、Retro AAで柔らかくなる','Pixel Perfect Camera › Grid Snapping、Filter Mode、スクリプト','いいえ']]},
   target:{title:'Unity 6（URP 2D）で直す',steps:[
    'Projectウィンドウでドット絵のテクスチャをすべて選び、Pixels Per Unitを1つの値（例：16）にそろえます。',
    'AdvancedでFilter Mode = Point（no filter）、DefaultタブでCompression = None、Max Sizeはシートの長辺以上、Generate Mipmapをオフにして Apply。',
    'メインカメラを選んでAdd Component › Pixel Perfect Cameraを追加します。Assets Pixels Per Unitを同じPPUに、Reference Resolutionをドット絵の解像度（例：320 × 180）にします。',
    'Grid SnappingをPixel Snapping（回転したスプライトでもドットを四角く保つならUpscale Render Texture）にしてCrop Frameを選びます。Stretch FillでRetro AAがぼやけすぎるならFilter ModeをPointに。',
    'SceneビューのGrid and SnapオーバーレイでGrid Sizeを1 ÷ PPU（16なら0.0625）にしてグリッドスナップをオンにすると、置いたスプライトがドット単位にそろいます。',
    'Nerulioから持ってくる絵なら、`.unity.json`の`pixelsPerUnit`を直し、PNGと`Editor/`フォルダーと一緒に`Assets/`へコピーしてTools › Nerulio › Import Studio JSONを実行します。そのテクスチャは手順1と2が済んだ状態になります。']},
   verify:{steps:[
    'テクスチャを選び、Filter Mode Point（no filter）、Compression None、Max Sizeが長辺以上、Generate Mipmapオフを確認します。',
    'Reference Resolution 320 × 180、Gameビュー1920 × 1080でスクリーンショットを拡大すると、1ドットが6 × 6のはずです。',
    'Pixel Perfect CameraのCurrent Pixel Ratioが6:1のような整数比です。',
    'キャラクターをゆっくり歩かせると、にじまずにドット単位で動きます。']},
   trouble:{rows:[
    ['止まっていてもぼける','Filter ModeがBilinearかTrilinear','テクスチャのインスペクターのAdvanced › Filter Mode','Point（no filter）にしてApply'],
    ['輪郭やグラデーションにブロック状の色むら','非可逆の圧縮（Normal Quality）','DefaultタブのCompressionと、すべてのプラットフォーム別上書きタブ','Noneに — 使っている上書きタブごとに'],
    ['大きなシートがぼけて少し小さく見える','Max Sizeがシートより小さく、取り込み時に縮小された','画像の大きさとMax Sizeを比べる','Max Sizeを長辺以上に上げる'],
    ['ドットが不揃いで、4pxの線と5pxの線がある','画面の高さ ÷ ドット数が整数でない、またはTransformのScaleが小数','Current Pixel Ratioとスプライトのtransformのスケール','適切なReference ResolutionのPixel Perfect Camera、スケールは1に'],
    ['止まるとくっきり、歩くとちらつく','スプライトかカメラがドットの間にある','Transformの位置が1回に1/PPUより小さく変わっている','Grid Snapping = Pixel Snapping、カメラの追従先は1/PPU単位で動かす'],
    ['Pixel Perfect Cameraを入れたのに全体が少しぼやける','Crop FrameがStretch Fillで、既定のFilter ModeがRetro AA（バイリニア）','Pixel Perfect CameraのFilter Mode','Filter Mode = Point（ちらつきは増える）、または整数比を保つCrop Frame'],
    ['タイルやキャラクターの大きさが想定と違う','テクスチャごとにPixels Per Unitが違う、またはバンドル既定の100のまま','テクスチャごとのPixels Per Unit','全部同じ値に、Assets Pixels Per Unitも同じ値に']]},
   alternatives:{rows:[
    ['インポート設定を手で変える（Projectウィンドウで複数選択）','ほかで描いたPNGが数枚だけのとき。テクスチャごとに4項目で済み、プロジェクトにスクリプトも増えません。'],
    ['[[game/aseprite-to-unity|AsepriteをUnityへのバンドル]]','.asepriteから始めて、タグごとにフレーム単位の長さを保ったアニメーションクリップもほしいとき。'],
    ['別の2D Pixel Perfectパッケージ','Built-Inレンダーパイプラインのプロジェクトのとき。Unityのドキュメントはこのパッケージを Built-In 専用としています。']]},
   limits:['バンドルはカメラを追加も設定もしません。Pixel Perfect Camera、Crop Frame、Grid Snappingは自分で行います。','Pixels Per UnitはStudioでは決めません。取り込む前に書き出したJSONの`pixelsPerUnit`を直してください（そのままなら100）。','カメラの手順はUnity 6.0 URPのマニュアルに基づくもので、私たちのUnityでの実行はインポートを検証したものです。'],
   versions:{body:['検証の実行ではUnity 6000.5.3f1がバッチモードでNerulioのバンドルを取り込み、スプライト範囲・ピボット・ピクセル・クリップのキーと時間が書き出しどおりに戻り、インポーターがPoint・無圧縮・ミップマップなしに設定しました。Pixel Perfect Camera、スナップ、インポート設定の説明はUnity 6.0と6.6のマニュアルに従っています。'],sources:UNITY_DOCS}
  }
 },
 'game/pixel-art-downscaler':{
  type:'tool',
  intent:{primary:'downscale upscaled pixel art back to its real 1× pixel size',secondary:['find the pixel size of an upscale','fractional and smooth (bilinear) resizes','off-grid crops','why a plain 25 % resize fails'],
   goal:'a 1× sprite with one image pixel per art pixel and the original colours',input:'an upscaled or resized PNG, JPEG, WebP, GIF or .aseprite (one frame or an animation)',output:'a new 1× sprite in the Pixel workspace, exported as PNG / .aseprite or through Pack & Export',target:'any engine or editor (1× PNG)',support:'full',
   evidence:['src/game/pixel-snap.js (findGrid, sampleBlocks inner 0.5, sampleSmooth least squares)','src/game/pixel-check.js (detectScale, recoverSource)','src/studio/pixel/cleanup.js (one scale per animation)','docs/STUDIO-PIXEL.md §5 (69-case benchmark), §6 T9/T10 (Sumo Hulk ×4 / ×3.78 vs Aseprite 1.3.18)'],
   external:['Aseprite docs: Sprite › Sprite Size']},
  en:{
   answer:'To take upscaled pixel art back to 1×, first find its pixel size, then keep one colour per block: a 128 × 128 image that is a 4× nearest upscale is made of 4 × 4 blocks and becomes 32 × 32. A plain “resize to 25 %” only works when the factor is a whole number you already know and the grid starts at pixel 0; fractional (×3.3) and smooth (bilinear) resizes need the grid measured. Nerulio’s Cleanup panel measures it, shows it with a confidence and creates the 1× sprite as a new sprite, in the browser.',
   concept:{title:'Why “resize to 25 %” is not enough',body:[
    'A clean nearest-neighbour upscale by a whole number k turns every art pixel into a k × k block of one colour, so every colour change sits on a multiple of k. Going back is exact when you know k and where the grid starts: any pixel of a block has the block’s colour. Nerulio proves k from the positions of the colour changes; if the picture was cropped a few pixels off the grid, the shared remainder of those positions gives the offset.',
    'A fractional nearest upscale has blocks of two widths in turn: at ×2.5 the runs are 3, 2, 3, 2 pixels. A fixed 40 % resize samples some blocks on their border, so one-pixel lines vanish or double. Nerulio puts a cut at every measured edge and reads each cell from its inner half (the outer quarter on each side is dropped), taking the most common colour, never an average.',
    'A smooth resize (bilinear, bicubic, Lanczos) has no flat blocks: every edge is a ramp. Nerulio treats the picture as a linear interpolation between the original pixel centres and solves for those centres by least squares, then merges near-identical colours, so the edges are hard again. For a true bilinear resize that is an inversion; after JPEG or blur it is the closest bilinear explanation, not the exact original.'],
    terms:[['Pixel size (scale)','How many image pixels one art pixel covers: 4 for a ×4 upscale, about 3.78 for a 96 px wide sprite stored 363 px wide.'],['Offset (phase)','Where the first full block starts when the image was cropped off the grid.'],['Cell sample','One colour per cell: the most common colour of its inner half, or the Oklab medoid when no colour dominates.']]},
   example:{title:'Example: one 96 × 144 sprite, upscaled two ways',lead:'The same CC0 sheet (Sumo Hulk by Eris, 9 colours) was enlarged by ×4 nearest and by ×3.78 bilinear, then brought back to 1×:',lines:[
    'truth              96 × 144, 9 colours',
    '',
    '×4 nearest         384 × 576      384/4 = 96    576/4 = 144',
    '  Nerulio          96 × 144 found by itself, 100 % of pixels exact',
    '  Aseprite 1.3.18  Sprite Size 25 %, nearest: 96 × 144, 100 % exact',
    '',
    '×3.78 bilinear     363 × 544      363/96 = 3.78   544/144 = 3.78',
    '  Nerulio          96 × 144 found by itself, 99.7 % exact, 13 colours',
    '  Aseprite         true size typed (96 × 144), nearest: 81.5 % exact',
    '  Aseprite         25 % guessed: 91 × 136, 54.4 % exact'],
    after:'The ×4 case is easy for any tool once you know the factor. The bilinear one is where measuring matters: 25 % of 363 × 544 is 90.75 × 136, which is neither the right size nor on the grid.'},
   verify:{steps:[
    'Read the verdict before applying: “Upscaled ×4 (exact block grid)” is proof; “Smoothly resized ≈ ×3.78” is a measurement with a confidence; “… too weak to trust” is not applied.',
    'Check the result size: input ÷ pixel size (384 ÷ 4 = 96, 576 ÷ 4 = 144).',
    'Compare before and after in Preview at a whole-number zoom: outlines should stay one pixel wide and unbroken.',
    'Compare the colour count with what the art should have (9 for the sprite above); many more means noise survived — set a colour limit.']},
   trouble:{rows:[
    ['Result is half or double the expected size','The grid locked onto a multiple or a half of the real block (flat art with long runs)','Show the grid on the canvas: does each cell hold exactly one art pixel?','Type the pixel size (for example 4) in the Cleanup panel and measure again'],
    ['A one-pixel line is missing or doubled','A fixed-percentage resize sampled block borders (fractional factor or off-grid crop)','Lay the grid over the line','Use the measured grid instead of a percentage; the offset of a crop is found automatically'],
    ['Colours are slightly off everywhere','JPEG input or a smooth resize: no pixel is bit-exact','The report lists far more colours than the art should have','Keep the background, set a colour limit, or quantize to the sprite’s palette ([[game/pixel-art-palette-editor|palette editor]])'],
    ['The background became transparent but belongs to the picture','Background “Make transparent” (the default) removes the detected border colour','The report names the colour and its share of the border','Set Background to Keep before Apply'],
    ['“A grid of ≈ … px was found, but it is too weak to trust”','No consistent grid, typical for generated images ([[game/fix-ai-pixel-art|fixing AI pixel art]])','The dashed amber grid on the canvas','Type the size you see, or redraw the part that matters']]},
   alternatives:{rows:[
    ['Aseprite: Sprite › Sprite Size, 25 %, nearest-neighbour','A clean whole-number upscale whose factor you know: three steps and 100 % exact in our test. There is no grid detection, so fractional or smooth resizes need the true size typed in (81.5 % in our test).'],
    ['[[game/pixel-perfect-checker|Pixel-perfect checker]] (Pixel Lab)','You only need to know whether an image is an exact integer upscale and recover it pixel for pixel; it offers recovery only when a block grid is proven.'],
    ['[[image/resize|Ordinary image resize]]','The picture is not pixel art (a photo or a painting), where smooth resampling is what you want.']]},
   limits:['One pixel size per cleanup: frames that were upscaled by different factors have to be cleaned separately.','The grid is measured along rows and columns; rotated or perspective-distorted screenshots have no axis-aligned grid to find.','Blurred upscales are the weakest kind in the benchmark: the size was right in 67 % of those cases.'],
   versions:{body:['Numbers from Nerulio’s cleanup benchmark (69 CC0 cases with a known 1× original; exact size 81 %, within 1 px 90 %) and the head-to-head on the Sumo Hulk sheet, where Aseprite 1.3.18 was run through its command line (docs/STUDIO-PIXEL.md §5–§6). Aseprite’s menu path follows its documentation.'],sources:['[Aseprite docs: Resize](https://www.aseprite.org/docs/resize/)']}
  },
  ko:{
   answer:'확대된 도트를 1배로 되돌리려면 먼저 도트 크기를 찾고, 블록마다 색 하나만 남기면 됩니다. 4배 최근접 확대인 128 × 128 이미지는 4 × 4 블록으로 되어 있어 32 × 32가 됩니다. 단순히 "25 %로 줄이기"는 배율이 이미 아는 정수이고 격자가 0번 픽셀에서 시작할 때만 맞습니다. 소수 배율(×3.3)이나 부드러운(쌍선형) 확대는 격자를 재야 합니다. Nerulio의 정리 패널은 격자를 재서 확신 정도와 함께 보여 주고, 브라우저 안에서 1배 스프라이트를 새 스프라이트로 만듭니다.',
   concept:{title:'"25 %로 줄이기"로는 부족한 이유',body:[
    '정수 k배 최근접 확대는 도트 하나를 한 색의 k × k 블록으로 만들기 때문에 색이 바뀌는 위치가 모두 k의 배수에 놓입니다. k와 격자의 시작점을 알면 되돌리기는 정확합니다. 블록 안 어느 픽셀이든 그 블록의 색이기 때문입니다. Nerulio는 색이 바뀌는 위치로 k를 증명하고, 그림이 격자에서 몇 픽셀 어긋나게 잘렸다면 그 위치들이 공통으로 갖는 나머지로 오프셋을 구합니다.',
    '소수 배율 최근접 확대는 폭이 다른 두 종류의 블록이 번갈아 나옵니다. ×2.5라면 연속 구간이 3, 2, 3, 2픽셀입니다. 40 %로 고정해 줄이면 일부 블록을 경계에서 읽어 1픽셀 선이 사라지거나 두 줄이 됩니다. Nerulio는 잰 가장자리마다 경계를 두고, 칸의 안쪽 절반(양쪽 바깥 4분의 1은 버림)에서 가장 많은 색을 고르며 평균을 내지 않습니다.',
    '부드러운 확대(쌍선형·쌍삼차·Lanczos)에는 평평한 블록이 없고 모든 가장자리가 경사입니다. Nerulio는 그림을 원래 픽셀 중심 사이의 선형 보간으로 보고 최소제곱으로 그 중심값을 풀어낸 뒤 거의 같은 색을 합쳐서 가장자리를 다시 딱딱하게 만듭니다. 진짜 쌍선형 확대라면 역변환이고, JPEG나 흐림이 더해졌다면 원본 그대로가 아니라 가장 가까운 쌍선형 해석입니다.'],
    terms:[['도트 크기(배율)','도트 하나가 차지하는 이미지 픽셀 수. ×4 확대면 4, 폭 96px 스프라이트를 363px로 저장했다면 약 3.78.'],['오프셋(위상)','격자에서 어긋나게 잘린 이미지에서 첫 번째 온전한 블록이 시작하는 위치.'],['칸 샘플','칸마다 색 하나. 안쪽 절반에서 가장 많은 색, 두드러진 색이 없으면 Oklab 메도이드.']]},
   example:{title:'예시: 96 × 144 스프라이트를 두 가지 방법으로 확대',lead:'같은 CC0 시트(Eris의 Sumo Hulk, 9색)를 ×4 최근접과 ×3.78 쌍선형으로 키운 뒤 1배로 되돌렸습니다.',lines:[
    '정답               96 × 144, 9색',
    '',
    '×4 최근접          384 × 576      384/4 = 96    576/4 = 144',
    '  Nerulio          96 × 144를 스스로 찾음, 픽셀 100 % 일치',
    '  Aseprite 1.3.18  Sprite Size 25 %, 최근접: 96 × 144, 100 % 일치',
    '',
    '×3.78 쌍선형       363 × 544      363/96 = 3.78   544/144 = 3.78',
    '  Nerulio          96 × 144를 스스로 찾음, 99.7 % 일치, 13색',
    '  Aseprite         정확한 크기(96 × 144) 입력, 최근접: 81.5 % 일치',
    '  Aseprite         25 %로 짐작: 91 × 136, 54.4 % 일치'],
    after:'×4는 배율만 알면 어떤 도구로도 쉽습니다. 차이가 나는 것은 쌍선형 쪽입니다. 363 × 544의 25 %는 90.75 × 136으로, 크기도 맞지 않고 격자에도 놓이지 않습니다.'},
   verify:{steps:[
    '적용 전에 판정을 읽습니다. "×4 확대(정확한 블록 격자)"는 증명이고, "부드럽게 약 ×3.78 크기 변경"은 확신 정도가 붙은 측정이며, "너무 약해 믿을 수 없음"은 적용되지 않습니다.',
    '결과 크기를 확인합니다: 입력 ÷ 도트 크기(384 ÷ 4 = 96, 576 ÷ 4 = 144).',
    '미리보기에서 정수 배율로 전후를 비교합니다. 외곽선이 1픽셀 두께로 끊기지 않아야 합니다.',
    '색 수를 원래 그림의 색 수(위 스프라이트는 9)와 비교합니다. 훨씬 많으면 잡음이 남은 것이니 색 제한을 거세요.']},
   trouble:{rows:[
    ['결과가 예상의 절반이나 두 배 크기','격자가 실제 블록의 배수나 절반에 맞춰짐(긴 단색 구간이 많은 그림)','캔버스에 격자를 표시해 칸마다 도트가 정확히 하나인지 보기','정리 패널에 도트 크기(예: 4)를 입력하고 다시 측정'],
    ['1픽셀 선이 사라지거나 두 줄이 됨','퍼센트로 고정한 축소가 블록 경계를 읽음(소수 배율이나 어긋난 자르기)','선 위에 격자를 겹쳐 보기','퍼센트 대신 잰 격자를 쓰기. 잘린 이미지의 오프셋은 자동으로 찾음'],
    ['전체 색이 조금씩 틀림','JPEG 입력이나 부드러운 확대라 비트까지 같은 픽셀이 없음','보고서의 색 수가 원래 그림보다 훨씬 많음','배경 유지, 색 제한, 또는 스프라이트 팔레트로 양자화([[game/pixel-art-palette-editor|팔레트 편집기]])'],
    ['그림의 일부인 배경이 투명해짐','배경 "투명하게"(기본값)가 감지한 테두리 색을 지움','보고서에 그 색과 테두리 비율이 나옴','적용 전에 배경을 유지로'],
    ['"약 … px 격자를 찾았지만 너무 약해 믿을 수 없음"','일관된 격자가 없음. 생성 이미지에서 흔함([[game/fix-ai-pixel-art|AI 도트 보정]])','캔버스의 주황 점선 격자','눈에 보이는 크기를 입력하거나 중요한 부분을 다시 그리기']]},
   alternatives:{rows:[
    ['Aseprite: Sprite › Sprite Size, 25 %, 최근접','배율을 아는 깨끗한 정수 확대. 우리 시험에서 세 단계로 100 % 일치했습니다. 격자 감지가 없어 소수·부드러운 확대는 정확한 크기를 직접 입력해야 합니다(우리 시험에서 81.5 %).'],
    ['[[game/pixel-perfect-checker|픽셀 퍼펙트 검사기]](픽셀 랩)','이미지가 정확한 정수 확대인지만 알고 픽셀 단위로 되살리면 될 때. 블록 격자가 증명될 때만 복원을 제공합니다.'],
    ['[[image/resize|일반 이미지 크기 조절]]','도트가 아닌 그림(사진, 회화)이라 부드러운 리샘플링이 원하는 결과일 때.']]},
   limits:['정리 한 번에 도트 크기는 하나입니다. 서로 다른 배율로 확대된 프레임은 따로 정리하세요.','격자는 가로·세로 방향으로 잽니다. 회전하거나 원근으로 비틀린 스크린숏에는 찾을 격자가 없습니다.','흐림이 더해진 확대가 벤치마크에서 가장 약한 경우로, 크기를 맞힌 비율이 67 %였습니다.'],
   versions:{body:['수치는 Nerulio 정리 벤치마크(1배 원본을 아는 CC0 사례 69개. 정확한 크기 81 %, 1px 이내 90 %)와 Sumo Hulk 시트 맞비교에서 나왔으며, Aseprite 1.3.18은 명령줄로 실행했습니다(docs/STUDIO-PIXEL.md §5–§6). Aseprite 메뉴 경로는 공식 문서를 따랐습니다.'],sources:['[Aseprite 문서: Resize](https://www.aseprite.org/docs/resize/)']}
  },
  ja:{
   answer:'拡大されたドット絵を1倍に戻すには、まずドットの大きさを見つけ、ブロックごとに色を1つだけ残します。4倍ニアレスト拡大の128 × 128の画像は4 × 4のブロックでできているので32 × 32になります。単純な「25 %に縮小」が合うのは、倍率がわかっている整数で、グリッドが0番目のピクセルから始まるときだけです。小数倍（×3.3）やなめらかな（バイリニア）拡大はグリッドを測る必要があります。Nerulioの整理パネルはグリッドを測って確かさと一緒に示し、ブラウザ内で1倍のスプライトを新しいスプライトとして作ります。',
   concept:{title:'「25 %に縮小」では足りない理由',body:[
    '整数k倍のニアレスト拡大は1ドットを1色のk × kブロックにするため、色が変わる位置はすべてkの倍数に並びます。kとグリッドの始まりがわかれば戻すのは正確です。ブロック内のどのピクセルもそのブロックの色だからです。Nerulioは色が変わる位置からkを証明し、絵がグリッドから数ピクセルずれて切られていれば、それらの位置に共通する余りからオフセットを求めます。',
    '小数倍のニアレスト拡大では、幅の違う2種類のブロックが交互に並びます。×2.5なら連続区間は3、2、3、2ピクセルです。40 %に固定して縮小すると一部のブロックを境目で読むため、1ピクセルの線が消えたり二重になったりします。Nerulioは測った縁ごとに区切りを置き、セルの内側半分（両側の外側4分の1は捨てる）で最も多い色を選び、平均は取りません。',
    'なめらかな拡大（バイリニア・バイキュービック・Lanczos）には平らなブロックがなく、縁はすべて坂です。Nerulioは絵を元のピクセル中心の間の線形補間とみなし、最小二乗でその中心の値を解いてから、ほぼ同じ色をまとめて縁をくっきりさせます。本当のバイリニア拡大なら逆変換になり、JPEGやぼかしが加わっていれば元どおりではなく最も近いバイリニアの解釈になります。'],
    terms:[['ドットの大きさ（倍率）','1ドットが占める画像のピクセル数。×4拡大なら4、幅96pxのスプライトを363pxで保存したものなら約3.78。'],['オフセット（位相）','グリッドからずれて切られた画像で、最初の完全なブロックが始まる位置。'],['セルのサンプル','セルごとに1色。内側半分で最も多い色、目立つ色がなければOklabのメドイド。']]},
   example:{title:'例：96 × 144のスプライトを2通りに拡大',lead:'同じCC0シート（ErisのSumo Hulk、9色）を×4ニアレストと×3.78バイリニアで拡大し、1倍に戻しました。',lines:[
    '正解               96 × 144、9色',
    '',
    '×4ニアレスト       384 × 576      384/4 = 96    576/4 = 144',
    '  Nerulio          96 × 144を自動で検出、ピクセル100 %一致',
    '  Aseprite 1.3.18  Sprite Size 25 %、ニアレスト：96 × 144、100 %一致',
    '',
    '×3.78バイリニア    363 × 544      363/96 = 3.78   544/144 = 3.78',
    '  Nerulio          96 × 144を自動で検出、99.7 %一致、13色',
    '  Aseprite         正しいサイズ（96 × 144）を入力、ニアレスト：81.5 %一致',
    '  Aseprite         25 %と推測：91 × 136、54.4 %一致'],
    after:'×4は倍率さえわかればどのツールでも簡単です。差が出るのはバイリニアのほうです。363 × 544の25 %は90.75 × 136で、サイズも合わずグリッドにも乗りません。'},
   verify:{steps:[
    '適用する前に判定を読みます。「×4に拡大（正確なブロックグリッド）」は証明、「なめらかに約×3.78へ変更」は確かさ付きの測定、「弱すぎて信頼できない」は適用されません。',
    '結果のサイズを確認：入力 ÷ ドットの大きさ（384 ÷ 4 = 96、576 ÷ 4 = 144）。',
    'プレビューで整数倍の表示にして前後を比べます。輪郭が1ピクセル幅で途切れていないはずです。',
    '色数を本来の色数（上のスプライトなら9）と比べます。ずっと多ければノイズが残っているので色数の上限を設定します。']},
   trouble:{rows:[
    ['結果が予想の半分か2倍のサイズ','グリッドが実際のブロックの倍数か半分に合ってしまった（単色の長い区間が多い絵）','キャンバスにグリッドを表示し、1セルに1ドットちょうどか確認','整理パネルにドットの大きさ（例：4）を入力して測り直す'],
    ['1ピクセルの線が消える・二重になる','パーセント固定の縮小がブロックの境目を読んだ（小数倍やずれた切り抜き）','線にグリッドを重ねてみる','パーセントではなく測ったグリッドを使う。切り抜きのオフセットは自動で見つかる'],
    ['全体の色が少しずつ違う','JPEG入力やなめらかな拡大で、ビット単位で同じピクセルがない','レポートの色数が本来よりずっと多い','背景を残す、色数の上限、またはスプライトのパレットへ減色（[[game/pixel-art-palette-editor|パレットエディタ]]）'],
    ['絵の一部である背景が透明になった','背景「透明にする」（既定）が検出した縁の色を消す','レポートにその色と縁に占める割合が出る','適用前に背景を「残す」に'],
    ['「約…pxのグリッドが見つかったが、弱すぎて信頼できない」','一貫したグリッドがない。生成画像でよくある（[[game/fix-ai-pixel-art|AIドット絵の修正]]）','キャンバス上の黄色の破線グリッド','見える大きさを入力するか、大事な部分を描き直す']]},
   alternatives:{rows:[
    ['Aseprite：Sprite › Sprite Size、25 %、ニアレスト','倍率のわかっているきれいな整数倍の拡大。私たちのテストでは3手順で100 %一致しました。グリッド検出はないので、小数倍やなめらかな拡大は正しいサイズを入力する必要があります（テストでは81.5 %）。'],
    ['[[game/pixel-perfect-checker|ピクセルパーフェクト チェッカー]]（ピクセルラボ）','画像が正確な整数倍の拡大かどうかを知り、ピクセル単位で戻せればよいとき。ブロックのグリッドが証明されたときだけ復元を出します。'],
    ['[[image/resize|通常の画像リサイズ]]','ドット絵ではない絵（写真や絵画）で、なめらかな再サンプリングが望む結果のとき。']]},
   limits:['1回の整理でドットの大きさは1つです。違う倍率で拡大されたフレームは別々に整理してください。','グリッドは縦横の方向で測ります。回転や遠近でゆがんだスクリーンショットには見つけるべきグリッドがありません。','ぼかしの加わった拡大がベンチマークで最も弱い種類で、サイズが合ったのは67 %でした。'],
   versions:{body:['数値はNerulioの整理ベンチマーク（1倍の元画像がわかっているCC0のケース69件。サイズ一致81 %、1px以内90 %）と、Sumo Hulkシートでの直接比較によるもので、Aseprite 1.3.18はコマンドラインで実行しました（docs/STUDIO-PIXEL.md §5–§6）。Asepriteのメニューの場所は公式ドキュメントに従っています。'],sources:['[Asepriteドキュメント：Resize](https://www.aseprite.org/docs/resize/)']}
  }
 },
 'game/fix-ai-pixel-art':{
  type:'create',
  intent:{primary:'turn AI-generated “pixel art” into real pixel art on a grid',secondary:['uneven pseudo-pixels (mixels)','colour noise and palette reduction','why most generated images have no single grid','when to redraw instead'],
   goal:'a 1× sprite with a limited palette, or an honest answer that no reliable grid exists',input:'a generated image (PNG, JPEG or WebP) that imitates pixel art',output:'a new 1× sprite in the Pixel workspace when a grid is trusted or typed; otherwise the unchanged image with a suggested size',target:'any pixel editor or engine (1× PNG / .aseprite)',support:'partial',
   evidence:['src/game/pixel-snap.js (trackedGrid rules: noisy, off-lattice ≥ 0.1, cell ≥ 3 px, aspect ≤ 1.25; trackBoundaries 0.7–1.35)','src/studio/pixel/cleanup.js (only integer or high/medium grids are applied)','docs/STUDIO-PIXEL.md §5 (ai-sim 10 cases, ai-real 7 images all unsure)','docs/pixel-bench/H2H.md §1, §3 (ai-sim construction, competitor outputs on ai-real)'],
   external:[]},
  en:{
   answer:'Images from image generators imitate pixel art but are not drawn on a grid: the “pixels” are blocks of uneven width with colour noise and soft edges. A fix needs one cell size, one colour per cell and a smaller palette — and for many generated images no single cell size fits the whole picture. Nerulio’s Cleanup panel measures first and applies only a grid it trusts; all 7 real generated images we tested were judged “unsure” and nothing was applied automatically. It shows its best candidate so you can type a size and check the result yourself.',
   concept:{title:'Why generated “pixel art” has no grid to snap to',body:[
    'Real pixel art is drawn on a grid, so an upscale of it has one block size everywhere. An image generator paints at its own resolution and only imitates the look: blocks drift in width (our simulation uses 80–120 % of the nominal size), neighbouring “pixels” differ by a few colour levels, edges are soft, and the file is often JPEG-compressed or carries a drawn background grid.',
    'A snapping tool has to choose one cell size. When widths drift, a regular lattice fits one part of the picture and cuts through the middle of blocks elsewhere. Nerulio tries a lattice first; for noisy pictures whose edges sit at least 0.1 cell off it, it follows the edges instead — cells between 0.7 and 1.35 of the typical size, the largest size whose cuts land on at least 97 % of the edge energy — but only when that tracked cell is at least 3 px and roughly square.',
    'When none of that holds, the panel says “A grid of ≈ … px was found, but it is too weak to trust” and applies nothing. That happened to all seven real generated images we tested. On the 630 × 500 previews Nerulio’s weak candidate was about 3.3 px; for one of them unfake.js output 209 × 166 (a size of 3) and Pixel Snapper 106 × 84 (about 6): the tools disagree by a factor of two, which is exactly why a guess should not be applied silently.'],
    terms:[['Pseudo-pixel','A block that looks like one pixel but differs in width, colour and edge sharpness from its neighbours.'],['Mixels','Pixels of different sizes in one picture; generated images have them by construction.'],['sure · likely · unsure','The confidence shown by the Cleanup panel. Only sure and likely grids are applied without you typing a size.']]},
   example:{title:'What the benchmark measured on generated art',lead:'Ten simulated cases have a known 1× original (cells of 5–10 px, widths 80–120 %, colour drift and noise, some blur or JPEG); the seven real images have none:',lines:[
    'simulated generated art (10 cases)',
    '  size exactly right         20 %        within 1 px        80 %',
    '  pixels exact               36.1 % (defaults)    70.3 % (background kept)',
    '  pixels within ΔE 0.02      92.8 % (background kept)',
    '',
    'real generated images (7, no truth)',
    '  Nerulio      7 of 7 “unsure”: size left unchanged, candidate shown',
    '  others       always return a guess, e.g. 630 × 500 → 209 × 166 (unfake.js) or 106 × 84 (Pixel Snapper)'],
    after:'Being within 1 px of the right size is not enough for exact pixels: one column too many shifts every cut after it. That is why the simulated cases reach 92.8 % of pixels within a small colour distance but only 70.3 % exact.'},
   verify:{steps:[
    'Read the confidence first: a tracked grid (“Uneven pseudo-pixels ≈ 6×6 px”, likely) is applied; “too weak to trust” is not.',
    'If you type a size, turn on “Show the grid on the canvas” and zoom in: cuts should run between blocks across the whole picture, not only in one corner.',
    'Compare before and after in Preview at 2× or 4×: eyes, outlines and highlights should survive as single pixels.',
    'Check the colour count in the report and set a colour limit (16–32) if it stays high.']},
   trouble:{rows:[
    ['“A grid of ≈ 3.3 px was found, but it is too weak to trust”','Block widths drift, or JPEG noise and a drawn background grid hide the real cell size','Zoom to 800 % and measure a few blocks: do they differ by a pixel or more?','Type the size you measure; if blocks differ too much, clean a cropped region separately or redraw'],
    ['Result looks like a smaller, blurrier copy','The typed size is half the real block, so each block became 2 × 2 mixed pixels','Two cuts inside one block on the canvas grid','Type the double size'],
    ['Eyes or one-pixel highlights vanished','The typed size is too large, or colour merging removed them','Preview; the report lists merges and fixes','Smaller size, Merge colours Light or Off, keep stray-pixel removal off (its default)'],
    ['Still hundreds of colours','Generated colour noise inside each block','Report: colour count and “noisy”','Colour limit 16–32, or quantize to a palette ([[game/lospec-palette|Lospec palettes]])'],
    ['A background or checkerboard pattern remains','The generator painted a background or a fake transparency pattern','Report: detected background and its share of the border','Background removal takes one solid border colour; select a checkerboard with the magic wand and delete it']]},
   alternatives:{rows:[
    ['Redraw it at 1× in the [[game/pixel-art-editor|pixel editor]]','The generated image is a concept: tracing it on a real grid gives cleaner art than any snapping, and you choose the resolution.'],
    ['[[game/pixel-snapper-alternative|Pixel Snapper, unfake.js or perfectPixel]]','You want a result for every image without a confidence check, or a command line or library for batches. On simulated generated art perfectPixel found the exact size more often (40 % against 20 %).'],
    ['[[game/pixel-lab|Pixel Lab]] after snapping','Several frames of one generated animation need one shared palette and anti-alias cleanup.']]},
   limits:['No generated image in our tests was snapped automatically: expect to type the size.','Nothing is redrawn: missing detail stays missing and uneven shapes stay uneven at 1×.','The real images have no ground truth, so how good a typed size is can only be judged by eye.'],
   versions:{body:['Benchmark 2026-09-25 (docs/STUDIO-PIXEL.md §5, docs/pixel-bench/H2H.md): 10 simulated cases with truth and 7 real CC0 generated images from OpenGameArt; competitors run with their own defaults.']}
  },
  ko:{
   answer:'이미지 생성기가 만든 그림은 도트를 흉내 낼 뿐 격자 위에 그려지지 않습니다. "픽셀"은 폭이 고르지 않은 덩어리이고 색에 잡음이 있으며 가장자리가 흐립니다. 고치려면 칸 크기 하나, 칸마다 색 하나, 줄인 팔레트가 필요한데, 생성 이미지 대부분은 그림 전체에 맞는 칸 크기가 하나로 정해지지 않습니다. Nerulio 정리 패널은 먼저 재고 믿을 수 있는 격자만 적용합니다. 시험한 실제 생성 이미지 7장은 모두 "불확실"로 판정되어 자동으로 적용된 것이 없습니다. 대신 가장 나은 후보를 보여 주므로 크기를 입력하고 결과를 직접 확인할 수 있습니다.',
   concept:{title:'생성된 "도트"에 맞출 격자가 없는 이유',body:[
    '진짜 도트는 격자 위에 그리므로 그것을 확대하면 어디서나 블록 크기가 같습니다. 이미지 생성기는 자기 해상도로 그리면서 모양만 흉내 냅니다. 블록 폭이 조금씩 달라지고(우리 모의 데이터는 기준 크기의 80~120 %), 이웃한 "픽셀"끼리 색이 몇 단계씩 다르며, 가장자리가 흐리고, JPEG로 압축되거나 배경에 격자가 그려져 있는 경우도 많습니다.',
    '맞추는 도구는 칸 크기를 하나 골라야 합니다. 폭이 흔들리면 규칙적인 격자가 그림 한쪽에는 맞고 다른 곳에서는 블록 한가운데를 자릅니다. Nerulio는 먼저 규칙 격자를 시도하고, 잡음이 있으면서 가장자리가 격자에서 0.1칸 이상 벗어난 그림이면 가장자리를 따라갑니다. 칸은 대표 크기의 0.7~1.35배, 경계가 가장자리 에너지의 97 % 이상에 놓이는 가장 큰 크기를 고르되, 그렇게 찾은 칸이 3px 이상이고 거의 정사각형일 때만 씁니다.',
    '어느 것도 성립하지 않으면 패널은 "약 … px 격자를 찾았지만 너무 약해 믿을 수 없음"이라고 알리고 아무것도 적용하지 않습니다. 시험한 실제 생성 이미지 7장이 모두 그랬습니다. 630 × 500 미리보기들에서 Nerulio의 약한 후보는 약 3.3px였고, 그중 한 장에 unfake.js는 209 × 166(크기 3), Pixel Snapper는 106 × 84(약 6)를 내놓았습니다. 도구끼리 두 배나 다르다는 것이 추측을 몰래 적용하면 안 되는 이유입니다.'],
    terms:[['가짜 픽셀','픽셀 하나처럼 보이지만 이웃과 폭·색·가장자리 선명도가 다른 덩어리.'],['믹셀','한 그림 안에 크기가 다른 픽셀이 섞인 것. 생성 이미지는 구조상 이렇게 됩니다.'],['확실 · 가능성 높음 · 불확실','정리 패널이 보여 주는 확신 정도. 확실과 가능성 높음만 크기를 입력하지 않아도 적용됩니다.']]},
   example:{title:'벤치마크가 생성 그림에서 잰 것',lead:'모의 사례 10개는 1배 원본을 압니다(칸 5~10px, 폭 80~120 %, 색 흔들림과 잡음, 일부는 흐림이나 JPEG). 실제 이미지 7장은 정답이 없습니다.',lines:[
    '모의 생성 그림 (10개)',
    '  크기 정확히 맞음           20 %        1px 이내          80 %',
    '  픽셀 정확히 일치           36.1 % (기본값)     70.3 % (배경 유지)',
    '  ΔE 0.02 이내 픽셀          92.8 % (배경 유지)',
    '',
    '실제 생성 이미지 (7장, 정답 없음)',
    '  Nerulio      7장 모두 "불확실": 크기 그대로, 후보만 표시',
    '  다른 도구    항상 추측을 내놓음. 예: 630 × 500 → 209 × 166 (unfake.js), 106 × 84 (Pixel Snapper)'],
    after:'크기가 1px 이내로 맞아도 픽셀이 정확히 맞지는 않습니다. 열이 하나 더 생기면 그 뒤의 경계가 전부 밀리기 때문입니다. 그래서 모의 사례에서 색 차이가 작은 픽셀은 92.8 %인데 정확히 같은 픽셀은 70.3 %에 그칩니다.'},
   verify:{steps:[
    '먼저 확신 정도를 읽습니다. 가장자리를 따라간 격자("고르지 않은 가짜 픽셀 약 6×6px", 가능성 높음)는 적용되고, "너무 약해 믿을 수 없음"은 적용되지 않습니다.',
    '크기를 입력했다면 "캔버스에 격자 표시"를 켜고 확대합니다. 경계가 한쪽 구석만이 아니라 그림 전체에서 블록 사이를 지나야 합니다.',
    '미리보기에서 2배나 4배로 전후를 비교합니다. 눈, 외곽선, 하이라이트가 한 픽셀로 살아 있어야 합니다.',
    '보고서의 색 수를 보고 여전히 많으면 색 제한(16~32)을 겁니다.']},
   trouble:{rows:[
    ['"약 3.3px 격자를 찾았지만 너무 약해 믿을 수 없음"','블록 폭이 흔들리거나, JPEG 잡음과 배경에 그려진 격자가 실제 칸 크기를 가림','800 %로 확대해 블록 몇 개를 재 보고 1픽셀 이상 차이 나는지 확인','잰 크기를 입력. 블록 차이가 너무 크면 일부를 잘라 따로 정리하거나 다시 그리기'],
    ['결과가 더 작고 흐린 복사본처럼 보임','입력한 크기가 실제 블록의 절반이라 블록마다 섞인 2 × 2 픽셀이 됨','캔버스 격자에서 한 블록 안에 경계가 두 개','두 배 크기를 입력'],
    ['눈이나 1픽셀 하이라이트가 사라짐','입력한 크기가 너무 크거나 색 합치기가 지움','미리보기와 보고서의 합치기·수정 목록','크기를 줄이고, 색 합치기를 약하게나 끔으로, 외톨이 픽셀 제거는 끈 채로(기본값)'],
    ['여전히 색이 수백 개','블록마다 들어 있는 생성 색 잡음','보고서의 색 수와 "잡음 있음" 표시','색 제한 16~32, 또는 팔레트로 양자화([[game/lospec-palette|Lospec 팔레트]])'],
    ['배경이나 체크무늬가 남음','생성기가 배경이나 가짜 투명 무늬를 그려 넣음','보고서의 감지된 배경과 테두리 비율','배경 제거는 단색 테두리 색 하나만 지웁니다. 체크무늬는 마술봉으로 선택해 지우세요']]},
   alternatives:{rows:[
    ['[[game/pixel-art-editor|도트 편집기]]에서 1배로 다시 그리기','생성 이미지가 콘셉트일 때. 진짜 격자 위에서 따라 그리면 어떤 맞추기보다 깨끗하고 해상도도 직접 정합니다.'],
    ['[[game/pixel-snapper-alternative|Pixel Snapper, unfake.js, perfectPixel]]','확신 정도 확인 없이 모든 이미지에 결과가 필요하거나, 대량 처리용 명령줄·라이브러리가 필요할 때. 모의 생성 그림에서는 perfectPixel이 크기를 더 자주 정확히 찾았습니다(40 % 대 20 %).'],
    ['맞춘 뒤 [[game/pixel-lab|픽셀 랩]]','생성된 애니메이션의 여러 프레임에 팔레트 하나와 안티앨리어싱 정리가 필요할 때.']]},
   limits:['시험한 생성 이미지 중 자동으로 맞춘 것은 없습니다. 크기를 입력할 생각을 하세요.','아무것도 다시 그리지 않습니다. 없는 디테일은 없는 채로, 고르지 않은 모양은 1배에서도 고르지 않습니다.','실제 이미지에는 정답이 없어서 입력한 크기가 얼마나 좋은지는 눈으로만 판단할 수 있습니다.'],
   versions:{body:['2026-09-25 벤치마크(docs/STUDIO-PIXEL.md §5, docs/pixel-bench/H2H.md): 정답이 있는 모의 사례 10개와 OpenGameArt의 실제 CC0 생성 이미지 7장. 경쟁 도구는 각자의 기본값으로 실행했습니다.']}
  },
  ja:{
   answer:'画像生成で作られた絵はドット絵をまねているだけで、グリッドの上に描かれていません。「ピクセル」は幅の揃わない塊で、色にノイズがあり、縁はぼけています。直すにはセルの大きさ1つ、セルごとに1色、減らしたパレットが必要ですが、生成画像の多くは絵全体に合うセルの大きさが1つに決まりません。Nerulioの整理パネルはまず測り、信頼できるグリッドだけを適用します。試した実際の生成画像7枚はすべて「不確か」と判定され、自動では何も適用されませんでした。代わりに最良の候補を示すので、大きさを入力して結果を自分で確かめられます。',
   concept:{title:'生成された「ドット絵」に合わせるグリッドがない理由',body:[
    '本物のドット絵はグリッドの上に描かれるので、拡大してもどこでもブロックの大きさが同じです。画像生成は自分の解像度で描き、見た目だけをまねます。ブロックの幅が少しずつ揺れ（私たちの模擬データは基準の80〜120 %）、隣り合う「ピクセル」の色が数段階ずつ違い、縁はぼけ、JPEGで圧縮されていたり背景にグリッドが描き込まれていたりします。',
    '合わせるツールはセルの大きさを1つ選ばなければなりません。幅が揺れていると、規則的な格子は絵の一部には合っても、別の場所ではブロックの真ん中を切ります。Nerulioはまず規則的な格子を試し、ノイズがあって縁が格子から0.1セル以上ずれている絵なら縁をたどります。セルは代表的な大きさの0.7〜1.35倍、区切りが縁のエネルギーの97 %以上に乗る最大の大きさを選びますが、そうして見つけたセルが3px以上でほぼ正方形のときだけ使います。',
    'どれも成り立たなければ、パネルは「約…pxのグリッドが見つかったが、弱すぎて信頼できない」と伝え、何も適用しません。試した実際の生成画像7枚はすべてそうなりました。630 × 500のプレビューでは、Nerulioの弱い候補は約3.3pxでした。そのうち1枚でunfake.jsは209 × 166（大きさ3）、Pixel Snapperは106 × 84（約6）を出力しました。ツール同士で2倍も違うことこそ、推測を黙って適用してはいけない理由です。'],
    terms:[['疑似ピクセル','1ピクセルに見えるが、隣と幅・色・縁のくっきりさが違う塊。'],['ミクセル','1枚の絵の中に大きさの違うピクセルが混ざること。生成画像は仕組み上こうなります。'],['確実 · おそらく · 不確か','整理パネルが示す確かさ。確実とおそらくだけが、大きさを入力しなくても適用されます。']]},
   example:{title:'ベンチマークが生成画像で測ったこと',lead:'模擬ケース10件は1倍の元画像がわかっています（セル5〜10px、幅80〜120 %、色の揺れとノイズ、一部はぼかしやJPEG）。実際の画像7枚には正解がありません。',lines:[
    '模擬生成画像（10件）',
    '  サイズが完全一致           20 %        1px以内           80 %',
    '  ピクセル完全一致           36.1 %（初期設定）  70.3 %（背景を残す）',
    '  ΔE 0.02以内のピクセル      92.8 %（背景を残す）',
    '',
    '実際の生成画像（7枚、正解なし）',
    '  Nerulio      7枚すべて「不確か」：サイズはそのまま、候補を表示',
    '  ほかのツール 必ず推定を返す。例：630 × 500 → 209 × 166（unfake.js）、106 × 84（Pixel Snapper）'],
    after:'サイズが1px以内で合っても、ピクセルが完全に合うとは限りません。列が1つ多いと、その後の区切りが全部ずれるからです。そのため模擬ケースでは色の差が小さいピクセルが92.8 %なのに、完全一致は70.3 %にとどまります。'},
   verify:{steps:[
    'まず確かさを読みます。縁をたどったグリッド（「不揃いな疑似ピクセル 約6×6px」、おそらく）は適用され、「弱すぎて信頼できない」は適用されません。',
    '大きさを入力したら「キャンバスにグリッドを表示」をオンにして拡大します。区切りが片隅だけでなく絵全体でブロックの間を通っているはずです。',
    'プレビューで2倍か4倍にして前後を比べます。目、輪郭、ハイライトが1ピクセルとして残っているはずです。',
    'レポートの色数を見て、多いままなら色数の上限（16〜32）を設定します。']},
   trouble:{rows:[
    ['「約3.3pxのグリッドが見つかったが、弱すぎて信頼できない」','ブロックの幅が揺れている、またはJPEGノイズや背景に描かれたグリッドが本当のセルの大きさを隠している','800 %に拡大していくつかのブロックを測り、1ピクセル以上違うか確認','測った大きさを入力。違いが大きすぎれば、一部を切り出して別に整理するか描き直す'],
    ['結果が小さくぼけたコピーのよう','入力した大きさが実際のブロックの半分で、ブロックごとに混ざった2 × 2ピクセルになった','キャンバスのグリッドで1つのブロックの中に区切りが2本','2倍の大きさを入力'],
    ['目や1ピクセルのハイライトが消えた','入力した大きさが大きすぎる、または色まとめが消した','プレビューと、レポートのまとめ・修正の一覧','大きさを小さく、色まとめを弱いかオフに、孤立ピクセル除去はオフのまま（既定）'],
    ['まだ色が数百ある','ブロックごとに含まれる生成時の色ノイズ','レポートの色数と「ノイズあり」の表示','色数の上限16〜32、またはパレットへの減色（[[game/lospec-palette|Lospecパレット]]）'],
    ['背景や市松模様が残る','画像生成が背景や偽の透明模様を描き込んだ','レポートの検出した背景と縁に占める割合','背景の除去は単色の縁の色1つだけを消します。市松模様は自動選択で選んで消してください']]},
   alternatives:{rows:[
    ['[[game/pixel-art-editor|ドット絵エディタ]]で1倍に描き直す','生成画像がコンセプトのとき。本物のグリッドでなぞれば、どんな自動合わせよりきれいになり、解像度も自分で決められます。'],
    ['[[game/pixel-snapper-alternative|Pixel Snapper、unfake.js、perfectPixel]]','確かさの確認なしにすべての画像で結果がほしいとき、または一括処理のためのコマンドラインやライブラリがほしいとき。模擬生成画像ではperfectPixelのほうがサイズを正確に当てる回数が多くありました（40 %対20 %）。'],
    ['合わせたあとで[[game/pixel-lab|ピクセルラボ]]','生成したアニメーションの複数フレームに、共通のパレット1つとアンチエイリアスの整理が必要なとき。']]},
   limits:['試した生成画像で自動的に合わせられたものはありません。大きさを入力するつもりでいてください。','何も描き直しません。ないディテールはないまま、不揃いな形は1倍でも不揃いなままです。','実際の画像には正解がないので、入力した大きさがどれだけ良いかは目で判断するしかありません。'],
   versions:{body:['2026-09-25のベンチマーク（docs/STUDIO-PIXEL.md §5、docs/pixel-bench/H2H.md）：正解のある模擬ケース10件と、OpenGameArtの実際のCC0生成画像7枚。競合ツールはそれぞれの初期設定で実行しました。']}
  }
 },
 'game/pixel-art-upscaler':{
  type:'tool',
  intent:{primary:'upscale pixel art without blur (integer nearest-neighbour)',secondary:['why 4.25× or 4.8× breaks the pixel grid','fitting a trailer or store size','do not upscale an image that is already upscaled','keep it sharp on a web page'],
   goal:'an enlarged PNG in which every art pixel is an equal square block',input:'1× pixel-art PNG frames (or an image the checker finds to be an exact upscale)',output:'PNG frames scaled 1×–8× by nearest-neighbour',target:'store pages, trailers, social posts, web pages',support:'full',
   evidence:['src/game/pixel-check.js (nearestScale, detectScale, recoverSource)','docs/PIXEL-LAB.md §6 and Verification (1×/2×/3×/4×/8× detected exactly, 2.5× read 2.500×, 3× recovered pixel-identical)'],
   external:['MDN: image-rendering (pixelated, crisp-edges)','Aseprite docs: Export (Resize field)']},
  en:{
   answer:'To enlarge pixel art without blur, multiply it by a whole number with nearest-neighbour: at 4× a 32 × 32 sprite becomes 128 × 128 and every pixel an exact 4 × 4 block. Fractional factors (4.25×) make some pixels wider than others, and smooth or AI upscalers add blur or invented detail. Nerulio’s Pixel Lab scales frames 1×–8× nearest and first checks whether the image is already an upscale, so you enlarge the 1× original rather than an enlarged copy.',
   concept:{title:'Whole factors keep the grid; everything else bends it',body:[
    'Nearest-neighbour copies each source pixel into a block and computes nothing new. With a whole factor k every block is k × k, so a one-pixel line stays one block thick, diagonals stay regular stairs and the colours stay exactly the palette.',
    'With 4.25× a 32-pixel row becomes 136 pixels, and 136 screen pixels cannot be split into 32 equal blocks: nearest gives widths 5, 4, 4, 4, 5, 4, 4, 4 … so every fourth pixel is 25 % wider and a clean diagonal turns into stairs of uneven steps. Bilinear or bicubic hide the unevenness by blending neighbours, which is exactly the blur you wanted to avoid.',
    'For a target that is not a multiple of the art — a 1920 × 1080 trailer from 400 × 225 art is 4.8× — scale by the largest whole factor (4× → 1600 × 900) and pad or frame the rest. And check the input first: a 3× screenshot scaled 4× again is 12×, with any unevenness it already had multiplied; the checker recovers the 1× source when the image is an exact integer upscale.'],
    terms:[['Nearest-neighbour','Every output pixel copies the closest source pixel; no blending.'],['Integer scale','2×, 3×, 4× …: every art pixel becomes an equal square block.'],['Logical size','The 1× size of the art: 32 × 32 for a sprite shown at 128 × 128.']]},
   example:{title:'Example: sizes and block widths',lead:'A 32 × 32 sprite and a 400 × 225 scene:',lines:[
    '32 × 32   ×2 →  64 × 64    every pixel 2 × 2',
    '32 × 32   ×4 → 128 × 128   every pixel 4 × 4',
    '32 × 32   ×8 → 256 × 256   every pixel 8 × 8',
    '32 × 32   ×4.25 → 136      widths 5,4,4,4,5,4,4,4 …  (uneven)',
    '',
    '400 × 225 for a 1920 × 1080 trailer: 1920/400 = 4.8, 1080/225 = 4.8',
    '  largest whole factor 4 → 1600 × 900, pad 160 px left/right, 90 px top/bottom'],
    after:'The pattern 5, 4, 4, 4 comes from nearest sampling: output pixel x shows source pixel ⌊x ÷ 4.25⌋, so source pixel 0 covers x = 0–4 (5 pixels) and source pixel 1 covers x = 5–8 (4 pixels).'},
   verify:{steps:[
    'The output size is the input size times the factor exactly (32 × 4 = 128).',
    'Run the result through the [[game/pixel-perfect-checker|checker]]: it should report an exact integer scale with offset 0, 0.',
    'Look at it at 100 % where it will be shown (store page, video editor): soft edges there mean the platform rescaled it.']},
   trouble:{rows:[
    ['The upscaled PNG looks soft on a web page','The page displays it at a different size and the browser smooths it','Compare the CSS size with the file size','Show it at its own size, or set CSS `image-rendering: pixelated` (per MDN: nearest to the closest whole multiple, then smooth for the remainder)'],
    ['Uneven pixels in a trailer or on a store page','The editor or store resized it to a non-multiple (4.8×)','Compare the file size with the output resolution','Upscale by the largest whole factor that fits and pad instead of stretching'],
    ['The result is much bigger and blockier than expected','The input was already an upscale (3× then 4× = 12×)','The checker reports an exact integer scale on the input','Recover 1× first, then scale'],
    ['Coloured noise around outlines after uploading','The platform re-encoded the image as JPEG','Zoom into an edge of the uploaded copy','Upload PNG where the platform keeps it']]},
   alternatives:{rows:[
    ['Scale variants in Pack & Export ([[sprite-sheet-maker|sprite sheet maker]])','You need an engine atlas at @2x or @4x next to the 1× one; those variants are nearest-neighbour only.'],
    ['Aseprite: File › Export › Export As with the Resize field','You already work in Aseprite; its docs suggest scales such as 400 % for posting animations.'],
    ['Let the engine scale the 1× art','Inside a game, keep 1× textures and scale the view by whole numbers ([[game/godot-pixel-art-blurry|Godot]], [[game/unity-pixel-art-blurry|Unity]]); pre-scaled textures only cost memory.']]},
   limits:['Whole factors 1×–8× only; there is no fractional or smooth mode.','A sheet is scaled as one picture: 2 px of padding between frames becomes 8 px at 4×.','No detail is added — right for pixel art, wrong if you wanted a photo upscaler.'],
   versions:{body:['From the Pixel Lab tests in Chromium: 1×, 2×, 3×, 4× and 8× nearest upscales were detected exactly with offset 0, 0; a 2.5× nearest resize read 2.500×; a 3× sprite was recovered to 16 × 16 pixel-identical. The CSS behaviour is as described by MDN; Aseprite’s export dialog as described in its docs.'],sources:['[MDN: image-rendering](https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering)','[Aseprite docs: Exporting](https://www.aseprite.org/docs/exporting/)']}
  },
  ko:{
   answer:'도트를 흐리지 않게 키우려면 최근접 방식으로 정수배를 하면 됩니다. 4배면 32 × 32 스프라이트가 128 × 128이 되고 모든 픽셀이 정확한 4 × 4 블록이 됩니다. 4.25배 같은 소수 배율은 일부 픽셀을 더 넓게 만들고, 부드러운 확대나 AI 업스케일러는 흐림이나 지어낸 디테일을 더합니다. Nerulio 픽셀 랩은 프레임을 1×~8× 최근접으로 키우며, 먼저 이미지가 이미 확대본인지 확인해 확대된 사본이 아니라 1배 원본을 키우게 합니다.',
   concept:{title:'정수 배율은 격자를 지키고, 나머지는 격자를 휘게 합니다',body:[
    '최근접 방식은 원본 픽셀을 블록으로 복사할 뿐 새 값을 계산하지 않습니다. 정수 k배면 모든 블록이 k × k라서 1픽셀 선은 한 블록 두께로, 대각선은 규칙적인 계단으로, 색은 팔레트 그대로 남습니다.',
    '4.25배면 32픽셀 한 줄이 136픽셀이 되는데, 136을 32개의 같은 블록으로 나눌 수는 없습니다. 최근접으로 하면 폭이 5, 4, 4, 4, 5, 4, 4, 4 … 가 되어 네 번째 픽셀마다 25 % 넓어지고, 깨끗한 대각선이 고르지 않은 계단이 됩니다. 쌍선형·쌍삼차는 이웃을 섞어 고르지 않음을 감추는데, 그것이 바로 피하려던 흐림입니다.',
    '목표 크기가 도트의 배수가 아닐 때 — 400 × 225 그림으로 1920 × 1080 트레일러를 만들면 4.8배 — 가장 큰 정수 배율(4배 → 1600 × 900)로 키우고 남는 부분은 여백이나 테두리로 채우세요. 입력도 먼저 확인해야 합니다. 3배 스크린숏을 다시 4배 하면 12배가 되고 원래 있던 고르지 않음도 함께 커집니다. 검사기는 이미지가 정확한 정수 확대본이면 1배 원본을 되살립니다.'],
    terms:[['최근접(Nearest-neighbour)','결과 픽셀마다 가장 가까운 원본 픽셀을 복사. 섞지 않음.'],['정수 배율','2×, 3×, 4× …: 모든 도트가 같은 정사각 블록이 됨.'],['논리 크기','그림의 1배 크기. 128 × 128로 보이는 스프라이트라면 32 × 32.']]},
   example:{title:'예시: 크기와 블록 폭',lead:'32 × 32 스프라이트와 400 × 225 장면:',lines:[
    '32 × 32   ×2 →  64 × 64    모든 픽셀 2 × 2',
    '32 × 32   ×4 → 128 × 128   모든 픽셀 4 × 4',
    '32 × 32   ×8 → 256 × 256   모든 픽셀 8 × 8',
    '32 × 32   ×4.25 → 136      폭 5,4,4,4,5,4,4,4 …  (고르지 않음)',
    '',
    '1920 × 1080 트레일러용 400 × 225: 1920/400 = 4.8, 1080/225 = 4.8',
    '  가장 큰 정수 배율 4 → 1600 × 900, 좌우 160px·위아래 90px 여백'],
    after:'5, 4, 4, 4 패턴은 최근접 샘플링에서 나옵니다. 결과 픽셀 x는 원본 픽셀 ⌊x ÷ 4.25⌋를 보여 주므로 원본 0번은 x = 0~4(5픽셀), 원본 1번은 x = 5~8(4픽셀)을 차지합니다.'},
   verify:{steps:[
    '결과 크기가 입력 크기 × 배율과 정확히 같습니다(32 × 4 = 128).',
    '결과를 [[game/pixel-perfect-checker|검사기]]에 넣으면 오프셋 0, 0의 정확한 정수 배율이 나와야 합니다.',
    '보여 줄 곳(스토어 페이지, 영상 편집기)에서 100 %로 봅니다. 거기서 가장자리가 흐리면 플랫폼이 크기를 다시 바꾼 것입니다.']},
   trouble:{rows:[
    ['확대한 PNG가 웹 페이지에서 흐리게 보임','페이지가 다른 크기로 표시하면서 브라우저가 부드럽게 보간함','CSS 크기와 파일 크기 비교','원래 크기로 표시하거나 CSS `image-rendering: pixelated` 지정(MDN 기준: 가장 가까운 정수배까지는 최근접, 나머지는 부드럽게)'],
    ['트레일러나 스토어 페이지에서 도트가 고르지 않음','편집기나 스토어가 배수가 아닌 크기(4.8배)로 바꿈','파일 크기와 출력 해상도 비교','맞는 가장 큰 정수 배율로 키우고 늘리는 대신 여백을 둠'],
    ['결과가 예상보다 훨씬 크고 각짐','입력이 이미 확대본이었음(3배 후 4배 = 12배)','검사기가 입력에서 정확한 정수 배율을 보고함','먼저 1배로 되살린 뒤 확대'],
    ['올린 뒤 외곽선 주변에 색 잡음','플랫폼이 JPEG로 다시 인코딩함','올라간 사본의 가장자리를 확대','PNG를 그대로 두는 곳이면 PNG로 올리기']]},
   alternatives:{rows:[
    ['패킹·내보내기의 배율 변형([[sprite-sheet-maker|스프라이트 시트 메이커]])','1배와 함께 @2x·@4x 엔진 아틀라스가 필요할 때. 이 변형은 최근접 방식만 씁니다.'],
    ['Aseprite: File › Export › Export As의 Resize 칸','이미 Aseprite로 작업할 때. Aseprite 문서는 애니메이션을 올릴 때 400 % 같은 배율을 권합니다.'],
    ['엔진이 1배 그림을 키우게 하기','게임 안에서는 1배 텍스처를 두고 화면을 정수배로 키우세요([[game/godot-pixel-art-blurry|Godot]], [[game/unity-pixel-art-blurry|Unity]]). 미리 키운 텍스처는 메모리만 씁니다.']]},
   limits:['1×~8× 정수 배율만 있고 소수·부드러운 방식은 없습니다.','시트는 그림 한 장으로 확대됩니다. 프레임 사이 2px 여백은 4배에서 8px이 됩니다.','디테일을 더하지 않습니다. 도트에는 맞지만 사진 업스케일러를 원했다면 맞지 않습니다.'],
   versions:{body:['Chromium의 픽셀 랩 시험 결과: 1×·2×·3×·4×·8× 최근접 확대를 오프셋 0, 0으로 정확히 감지했고, 2.5배 최근접은 2.500배로 읽었으며, 3배 스프라이트를 16 × 16으로 픽셀까지 같게 되살렸습니다. CSS 동작은 MDN 설명을, Aseprite 내보내기 창은 공식 문서를 따릅니다.'],sources:['[MDN: image-rendering](https://developer.mozilla.org/ko/docs/Web/CSS/image-rendering)','[Aseprite 문서: Exporting](https://www.aseprite.org/docs/exporting/)']}
  },
  ja:{
   answer:'ドット絵をぼかさずに拡大するには、ニアレストネイバーで整数倍にします。4倍なら32 × 32のスプライトは128 × 128になり、すべてのピクセルが正確な4 × 4のブロックになります。4.25倍のような小数倍は一部のピクセルを太くし、なめらかな拡大やAIアップスケーラーはぼけや作られたディテールを加えます。Nerulioのピクセルラボはフレームを1×〜8×のニアレストで拡大し、先に画像がすでに拡大済みかを調べるので、拡大されたコピーではなく1倍の元画像を拡大できます。',
   concept:{title:'整数倍はグリッドを守り、それ以外はグリッドをゆがめる',body:[
    'ニアレストネイバーは元のピクセルをブロックに写すだけで、新しい値を計算しません。整数k倍ならすべてのブロックがk × kなので、1ピクセルの線は1ブロックの太さのまま、斜め線は規則的な階段のまま、色はパレットのままです。',
    '4.25倍では32ピクセルの1行が136ピクセルになりますが、136を32個の等しいブロックに分けることはできません。ニアレストだと幅が5、4、4、4、5、4、4、4…となり、4つに1つのピクセルが25 %太くなって、きれいな斜め線が不揃いな階段になります。バイリニアやバイキュービックは隣を混ぜて不揃いを隠しますが、それこそ避けたかったぼけです。',
    '目標サイズが絵の倍数でないとき — 400 × 225の絵から1920 × 1080のトレーラーを作ると4.8倍 — は最大の整数倍（4倍 → 1600 × 900）で拡大し、残りは余白や枠で埋めます。入力も先に確認しましょう。3倍のスクリーンショットをさらに4倍すると12倍になり、元からあった不揃いも一緒に大きくなります。チェッカーは画像が正確な整数倍の拡大なら1倍の元画像を復元します。'],
    terms:[['ニアレストネイバー','出力の各ピクセルが最も近い元のピクセルをコピー。混ぜない。'],['整数倍','2×、3×、4×…：すべてのドットが同じ正方形のブロックになる。'],['論理サイズ','絵の1倍のサイズ。128 × 128で表示するスプライトなら32 × 32。']]},
   example:{title:'例：サイズとブロックの幅',lead:'32 × 32のスプライトと400 × 225の場面：',lines:[
    '32 × 32   ×2 →  64 × 64    全ピクセル2 × 2',
    '32 × 32   ×4 → 128 × 128   全ピクセル4 × 4',
    '32 × 32   ×8 → 256 × 256   全ピクセル8 × 8',
    '32 × 32   ×4.25 → 136      幅5,4,4,4,5,4,4,4 …（不揃い）',
    '',
    '1920 × 1080のトレーラー用に400 × 225：1920/400 = 4.8、1080/225 = 4.8',
    '  最大の整数倍4 → 1600 × 900、左右160px・上下90pxの余白'],
    after:'5、4、4、4のパターンはニアレストのサンプリングから生まれます。出力のピクセルxは元のピクセル⌊x ÷ 4.25⌋を表示するので、元の0番はx = 0〜4（5ピクセル）、1番はx = 5〜8（4ピクセル）を占めます。'},
   verify:{steps:[
    '出力サイズが入力サイズ × 倍率とぴったり同じです（32 × 4 = 128）。',
    '結果を[[game/pixel-perfect-checker|チェッカー]]に通すと、オフセット0, 0の正確な整数倍率と出るはずです。',
    '表示される場所（ストアページ、動画編集ソフト）で100 %で見ます。そこで縁がぼけていれば、プラットフォームがサイズを変え直しています。']},
   trouble:{rows:[
    ['拡大したPNGがWebページでぼやける','ページが別のサイズで表示し、ブラウザがなめらかに補間している','CSSのサイズとファイルのサイズを比べる','元のサイズで表示するか、CSSで`image-rendering: pixelated`を指定（MDNによれば、最も近い整数倍まではニアレスト、残りはなめらかに）'],
    ['トレーラーやストアページでドットが不揃い','編集ソフトやストアが倍数でないサイズ（4.8倍）に変えた','ファイルのサイズと出力解像度を比べる','収まる最大の整数倍で拡大し、引き伸ばさずに余白を付ける'],
    ['結果が予想よりずっと大きくカクカク','入力がすでに拡大済みだった（3倍のあと4倍 = 12倍）','チェッカーが入力に正確な整数倍率を報告する','先に1倍に戻してから拡大'],
    ['アップロード後に輪郭のまわりに色のノイズ','プラットフォームがJPEGで再エンコードした','アップロードされたコピーの縁を拡大','PNGのまま扱う場所ならPNGでアップロード']]},
   alternatives:{rows:[
    ['パック＆書き出しの拡大バリエーション（[[sprite-sheet-maker|スプライトシートメーカー]]）','1倍と一緒に@2x・@4xのエンジン用アトラスが必要なとき。このバリエーションはニアレストのみです。'],
    ['Aseprite：File › Export › Export AsのResize欄','すでにAsepriteで作業しているとき。Asepriteのドキュメントはアニメーションの投稿に400 %のような倍率を勧めています。'],
    ['エンジンに1倍の絵を拡大させる','ゲーム内では1倍のテクスチャのまま、画面を整数倍で拡大します（[[game/godot-pixel-art-blurry|Godot]]、[[game/unity-pixel-art-blurry|Unity]]）。事前に拡大したテクスチャはメモリを使うだけです。']]},
   limits:['1×〜8×の整数倍だけで、小数倍やなめらかな方式はありません。','シートは1枚の絵として拡大されます。フレーム間の2pxの余白は4倍で8pxになります。','ディテールは足しません。ドット絵には正しい動作ですが、写真のアップスケーラーを求めているなら向きません。'],
   versions:{body:['Chromiumでのピクセルラボのテストより：1×・2×・3×・4×・8×のニアレスト拡大をオフセット0, 0で正確に検出し、2.5倍ニアレストは2.500倍と読み、3倍のスプライトを16 × 16でピクセル単位まで同じに復元しました。CSSの動作はMDNの説明に、Asepriteの書き出しダイアログは公式ドキュメントに従っています。'],sources:['[MDN: image-rendering](https://developer.mozilla.org/ja/docs/Web/CSS/image-rendering)','[Asepriteドキュメント：Exporting](https://www.aseprite.org/docs/exporting/)']}
  }
 },
 'game/pixel-art-cleanup':{
  type:'create',
  intent:{primary:'clean up pixel art: remove anti-aliasing, stray pixels, holes and outline gaps',secondary:['snap anti-aliased edge pixels to the palette without moving the silhouette','one palette for all frames','review candidates before changing anything'],
   goal:'hard-edged frames that use only the palette colours, with the same silhouette',input:'PNG frames (several share one palette), at 1×',output:'cleaned PNG frames (optionally 1×–8×), the palette as .gpl, pixel-lab.json',target:'any engine or editor (PNG)',support:'full',
   evidence:['src/game/pixel-cleanup.js (removeAntiAlias, detect)','docs/PIXEL-LAB.md §5 and Verification (271 → 16 colours, 0 alpha pixels changed)'],
   external:[]},
  en:{
   answer:'Cleaning pixel art means removing what does not belong in a hard-edged, limited-palette sprite: anti-aliased in-between colours along edges, stray single pixels, tiny clusters, one-pixel holes and gaps in the outline. Nerulio’s Pixel Lab lists every candidate first — highlighted and counted — and changes only what you tick. Its anti-alias remover snaps each in-between pixel to one of the two palette colours it sits between, so the silhouette does not move. Input: 1× PNG frames; output: cleaned PNG frames and one shared palette.',
   concept:{title:'What counts as dirt, and how each kind is fixed',body:[
    'Anti-aliasing helps an illustration and hurts a sprite: an edge pixel mixed from the outline and the fill is a new colour that is neither, and the test frames — meant for a 16-colour palette — carried 271 colours. Snapping such a pixel to the nearest palette colour is not enough: a colour half-way between dark outline and orange fill can be nearest to some unrelated brown. The Lab snaps it to the nearer end of the neighbour pair whose Oklab segment it lies on, and uses the globally nearest palette colour only when there is no such pair.',
    'Strays, clusters and holes come from one scan of connected regions of the same palette index (4-connected). A stray is a region of one pixel, a tiny cluster is smaller than the size you set, a hole is a transparent region that never reaches the image edge and is ringed by opaque pixels. Each is filled with the colour around it; because one scan produces all three lists, the counts agree with each other.',
    'Outline checks look only at straight edges, where exactly one of the four neighbours is outside the silhouette; corners are skipped because thickness there is ambiguous. The automatic fix closes gaps and never thins a doubled outline, since removing a pixel would move the silhouette.'],
    terms:[['Anti-alias pixel','An edge pixel whose colour lies between two palette colours that meet there.'],['Stray (orphan) pixel','A one-pixel region: none of its four neighbours has its colour.'],['Oklab','A perceptual colour space; distances in it follow what the eye sees more closely than RGB.']]},
   example:{title:'Example: eight anti-aliased 48 × 48 frames',lead:'A bobbing ball drawn with smoothing, then cleaned with one palette for all frames:',lines:[
    'input            8 frames, 271 distinct colours (edges anti-aliased)',
    'palette          16 colours, extracted from all 8 frames together',
    '',
    'anti-alias remover, threshold 0.08 (Oklab distance)',
    '  colours        271 → 16, every exported colour inside the palette',
    '  alpha pixels   0 changed — the silhouette did not move',
    '',
    'edge pixel half-way between outline and fill → the nearer of those two, never a third colour'],
    after:'The decisions are read from the original pixels, not from pixels already rewritten, so the result does not depend on the order in which the image is scanned.'},
   verify:{steps:[
    'Read the counts before ticking anything: stray, cluster, hole and anti-alias candidates are listed separately and highlighted on the image.',
    'After export, check the colours: every colour of the frames should be in the palette.',
    'Compare the silhouette before and after (Check stage): the shape should be identical.']},
   trouble:{rows:[
    ['A dithered area is reported as hundreds of strays','Dithering is made of single pixels on purpose','Is a dither mode on in Convert?','Set dithering to None before cleaning, or leave strays unticked'],
    ['An eye or a one-pixel highlight disappeared','It was a stray candidate and strays were ticked','Look at the highlighted candidates before applying','Untick strays, or undo (Ctrl+Z) and fix those pixels by hand'],
    ['Edge pixels went to the wrong side','The threshold is wide enough to catch colours that belong to neither pair','Lower the anti-alias threshold (default 0.08)','Lower it, or touch up in the [[game/pixel-art-editor|pixel editor]]'],
    ['The outline is still doubled after the fix','The fix only closes gaps; thinning would move the silhouette','The outline report counts doubled runs','Thin it by hand where you want it'],
    ['An upscaled or generated picture is far too noisy to clean','The image is not at 1× yet','The [[game/pixel-perfect-checker|checker]] reports an integer scale or a resize','Bring it to 1× first with the [[game/pixel-art-downscaler|downscaler]], then clean']]},
   alternatives:{rows:[
    ['The Cleanup panel of the Studio’s Pixel workspace ([[game/fix-ai-pixel-art|for upscaled or generated art]])','The picture is not at 1×: it re-grids and removes fringes in one pass and makes a new sprite you can keep editing.'],
    ['Any pixel editor by hand','A few frames where you want to decide every pixel; there are no automatic candidates to review.'],
    ['[[game/palette-extractor|Palette extractor]]','You only need one shared palette for many frames, without changing any shapes.']]},
   limits:['Outline gaps are the only outline problem fixed automatically; doubled pixels are reported, not removed.','Counts above 4 megapixels of total frame area cover the visible frame only.'],
   versions:{body:['Numbers from the Pixel Lab browser tests in Chromium (Firefox and WebKit not run), measured by re-opening the exported files outside the page.']}
  },
  ko:{
   answer:'도트 정리는 가장자리가 딱딱하고 색이 제한된 스프라이트에 어울리지 않는 것을 없애는 일입니다. 가장자리의 안티앨리어싱 중간색, 외톨이 픽셀, 작은 덩어리, 한 칸 구멍, 외곽선 틈이 그 대상입니다. Nerulio 픽셀 랩은 모든 후보를 먼저 표시하고 개수를 센 뒤 체크한 것만 바꿉니다. 안티앨리어싱 제거는 중간색 픽셀을 그 양쪽 팔레트 색 중 하나로 맞추므로 실루엣이 움직이지 않습니다. 입력은 1배 PNG 프레임, 출력은 정리된 PNG 프레임과 공유 팔레트 하나입니다.',
   concept:{title:'무엇이 지저분한 것이고, 각각 어떻게 고치나',body:[
    '안티앨리어싱은 일러스트에는 도움이 되지만 스프라이트에는 해가 됩니다. 외곽선과 채움이 섞인 가장자리 픽셀은 둘 다 아닌 새 색이며, 16색 팔레트용 시험 프레임에는 색이 271개 있었습니다. 그런 픽셀을 가장 가까운 팔레트 색으로 맞추는 것만으로는 부족합니다. 어두운 외곽선과 주황 채움 사이 중간색이 엉뚱한 갈색에 가장 가까울 수 있기 때문입니다. 픽셀 랩은 그 픽셀이 놓인 Oklab 선분을 이루는 이웃 색 쌍에서 가까운 쪽으로 맞추고, 그런 쌍이 없을 때만 전체에서 가장 가까운 팔레트 색을 씁니다.',
    '외톨이·덩어리·구멍은 같은 팔레트 색이 이어진 영역(4방향 연결)을 한 번 훑어 찾습니다. 외톨이는 1픽셀짜리 영역, 작은 덩어리는 지정한 크기보다 작은 영역, 구멍은 이미지 가장자리에 닿지 않고 불투명 픽셀로 둘러싸인 투명 영역입니다. 각각 주변 색으로 채우며, 한 번의 검사로 세 목록을 만들기 때문에 개수가 서로 어긋나지 않습니다.',
    '외곽선 점검은 네 이웃 중 정확히 하나만 실루엣 밖인 직선 가장자리만 봅니다. 모서리에서는 두께를 한 가지로 말할 수 없어 건너뜁니다. 자동 수정은 틈만 메우고 두 겹 외곽선을 얇게 만들지는 않습니다. 픽셀을 지우면 실루엣이 움직이기 때문입니다.'],
    terms:[['안티앨리어싱 픽셀','그 자리에서 만나는 두 팔레트 색 사이의 색을 가진 가장자리 픽셀.'],['외톨이 픽셀','1픽셀짜리 영역. 네 이웃 중 같은 색이 없음.'],['Oklab','지각 기반 색 공간. 이 공간의 거리가 RGB보다 눈에 보이는 차이에 가깝습니다.']]},
   example:{title:'예시: 안티앨리어싱된 48 × 48 프레임 8개',lead:'부드럽게 그린 통통 튀는 공을 모든 프레임에 팔레트 하나로 정리했습니다.',lines:[
    '입력             프레임 8개, 서로 다른 색 271개 (가장자리 안티앨리어싱)',
    '팔레트           16색, 8프레임 전체에서 함께 추출',
    '',
    '안티앨리어싱 제거, 기준값 0.08 (Oklab 거리)',
    '  색 수          271 → 16, 내보낸 모든 색이 팔레트 안',
    '  알파 픽셀      0개 바뀜 — 실루엣이 움직이지 않음',
    '',
    '외곽선과 채움 사이 중간 픽셀 → 둘 중 가까운 쪽, 세 번째 색은 절대 아님'],
    after:'판단은 이미 바뀐 픽셀이 아니라 원래 픽셀에서 읽으므로 이미지를 훑는 순서에 따라 결과가 달라지지 않습니다.'},
   verify:{steps:[
    '체크하기 전에 개수를 읽습니다. 외톨이·덩어리·구멍·안티앨리어싱 후보가 따로 나오고 이미지에 표시됩니다.',
    '내보낸 뒤 색을 확인합니다. 프레임의 모든 색이 팔레트 안에 있어야 합니다.',
    '검사 단계에서 정리 전후 실루엣을 비교합니다. 모양이 같아야 합니다.']},
   trouble:{rows:[
    ['디더링한 부분이 외톨이 수백 개로 보고됨','디더링은 일부러 한 픽셀씩 찍은 무늬','변환 단계에서 디더링이 켜져 있는지 확인','정리 전에 디더링을 없음으로 두거나 외톨이를 체크하지 않기'],
    ['눈이나 1픽셀 하이라이트가 사라짐','외톨이 후보였고 외톨이를 체크함','적용 전에 표시된 후보 확인','외톨이 체크를 풀거나, 되돌리기(Ctrl+Z) 후 그 픽셀을 손으로 고치기'],
    ['가장자리 픽셀이 반대쪽 색으로 감','기준값이 넓어서 어느 쌍에도 속하지 않는 색까지 잡힘','안티앨리어싱 기준값(기본 0.08) 낮춰 보기','기준값을 낮추거나 [[game/pixel-art-editor|도트 편집기]]에서 손보기'],
    ['수정 후에도 외곽선이 두 겹','수정은 틈만 메움. 얇게 하면 실루엣이 움직임','외곽선 보고서에 두 겹 구간 수가 나옴','원하는 곳만 손으로 얇게'],
    ['확대되거나 생성된 그림이라 정리하기엔 잡음이 너무 많음','아직 1배가 아님','[[game/pixel-perfect-checker|검사기]]가 정수 배율이나 크기 변경을 보고함','먼저 [[game/pixel-art-downscaler|1배 복원]]으로 줄인 뒤 정리']]},
   alternatives:{rows:[
    ['Studio 픽셀 작업 공간의 정리 패널([[game/fix-ai-pixel-art|확대·생성 그림용]])','그림이 1배가 아닐 때. 격자를 다시 잡고 가장자리 번짐을 한 번에 없애며, 계속 편집할 수 있는 새 스프라이트를 만듭니다.'],
    ['아무 도트 편집기에서 손으로','프레임이 몇 개뿐이고 모든 픽셀을 직접 정하고 싶을 때. 검토할 자동 후보는 없습니다.'],
    ['[[game/palette-extractor|팔레트 추출기]]','모양은 바꾸지 않고 여러 프레임이 함께 쓸 팔레트 하나만 필요할 때.']]},
   limits:['외곽선 문제 중 자동으로 고치는 것은 틈뿐이며, 두 겹 픽셀은 보고만 하고 지우지 않습니다.','프레임 전체 면적이 4메가픽셀을 넘으면 개수는 보이는 프레임만 셉니다.'],
   versions:{body:['수치는 Chromium의 픽셀 랩 브라우저 시험에서 내보낸 파일을 페이지 밖에서 다시 열어 잰 것입니다(Firefox·WebKit은 실행하지 않음).']}
  },
  ja:{
   answer:'ドット絵の整理とは、縁がくっきりして色数の限られたスプライトにそぐわないものを取り除くことです。縁のアンチエイリアスの中間色、孤立したピクセル、小さな塊、1ピクセルの穴、輪郭のすき間が対象です。Nerulioのピクセルラボはすべての候補をまず表示して数え、チェックしたものだけを変えます。アンチエイリアス除去は中間色のピクセルを両側のパレット色のどちらかに合わせるので、シルエットは動きません。入力は1倍のPNGフレーム、出力は整理したPNGフレームと共通のパレット1つです。',
   concept:{title:'何が汚れで、それぞれどう直すか',body:[
    'アンチエイリアスはイラストには役立ちますが、スプライトには害になります。輪郭と塗りが混ざった縁のピクセルはどちらでもない新しい色で、16色パレット用のテストフレームには271色ありました。そのピクセルを最も近いパレット色に合わせるだけでは足りません。暗い輪郭とオレンジの塗りの中間色が、無関係な茶色に一番近いこともあるからです。ピクセルラボは、そのピクセルが乗っているOklabの線分をつくる隣の色の組のうち近い方に合わせ、そうした組がないときだけ全体で最も近いパレット色を使います。',
    '孤立ピクセル・塊・穴は、同じパレット色がつながった領域（4方向の連結）を1回走査して見つけます。孤立ピクセルは1ピクセルの領域、小さな塊は設定した大きさより小さい領域、穴は画像の端に届かず不透明ピクセルに囲まれた透明な領域です。それぞれ周りの色で埋め、1回の走査で3つの一覧を作るので件数が食い違いません。',
    '輪郭のチェックは、4つの隣のうちちょうど1つだけがシルエットの外にある直線の縁だけを見ます。角では太さを1つに決められないので飛ばします。自動修正はすき間を埋めるだけで、二重の輪郭を細くはしません。ピクセルを消すとシルエットが動くからです。'],
    terms:[['アンチエイリアスのピクセル','そこで接する2つのパレット色の中間の色を持つ縁のピクセル。'],['孤立ピクセル','1ピクセルだけの領域。4つの隣に同じ色がない。'],['Oklab','知覚にもとづく色空間。この空間の距離はRGBより見た目の差に近くなります。']]},
   example:{title:'例：アンチエイリアスのかかった48 × 48のフレーム8枚',lead:'なめらかに描いた弾むボールを、全フレーム共通のパレット1つで整理しました。',lines:[
    '入力             8フレーム、異なる色271（縁にアンチエイリアス）',
    'パレット         16色、8フレーム全体からまとめて抽出',
    '',
    'アンチエイリアス除去、しきい値0.08（Oklabの距離）',
    '  色数           271 → 16、書き出した色はすべてパレット内',
    '  アルファ       0ピクセル変化 — シルエットは動いていない',
    '',
    '輪郭と塗りの中間のピクセル → 2色のうち近い方、3つ目の色には決してならない'],
    after:'判定はすでに書き換えたピクセルではなく元のピクセルから読むので、画像を走査する順番で結果が変わることはありません。'},
   verify:{steps:[
    'チェックする前に件数を読みます。孤立・塊・穴・アンチエイリアスの候補が別々に表示され、画像上でハイライトされます。',
    '書き出したあと色を確認します。フレームのすべての色がパレットの中にあるはずです。',
    'チェックの段階で整理前後のシルエットを比べます。形が同じはずです。']},
   trouble:{rows:[
    ['ディザーをかけた部分が孤立ピクセル数百個と報告される','ディザーはわざと1ピクセルずつ置いた模様','変換の段階でディザーがオンか確認','整理の前にディザーを「なし」にするか、孤立ピクセルにチェックしない'],
    ['目や1ピクセルのハイライトが消えた','孤立ピクセルの候補で、孤立ピクセルにチェックしていた','適用前にハイライトされた候補を見る','孤立ピクセルのチェックを外すか、元に戻して（Ctrl+Z）そのピクセルを手で直す'],
    ['縁のピクセルが反対側の色になった','しきい値が広く、どちらの組にも属さない色まで拾った','アンチエイリアスのしきい値（既定0.08）を下げてみる','しきい値を下げるか、[[game/pixel-art-editor|ドット絵エディタ]]で手直し'],
    ['修正後も輪郭が二重','修正はすき間を埋めるだけ。細くするとシルエットが動く','輪郭のレポートに二重の区間の数が出る','必要な所だけ手で細くする'],
    ['拡大や生成の絵で、整理するにはノイズが多すぎる','まだ1倍になっていない','[[game/pixel-perfect-checker|チェッカー]]が整数倍率かサイズ変更を報告する','先に[[game/pixel-art-downscaler|1倍復元]]で縮めてから整理']]},
   alternatives:{rows:[
    ['Studioのピクセル作業画面の整理パネル（[[game/fix-ai-pixel-art|拡大・生成された絵向け]]）','絵が1倍でないとき。グリッドを取り直し、縁のにじみを一度に取り除いて、編集を続けられる新しいスプライトを作ります。'],
    ['どのドット絵エディタでも手作業で','フレームが数枚で、すべてのピクセルを自分で決めたいとき。確認すべき自動の候補はありません。'],
    ['[[game/palette-extractor|パレット抽出]]','形は変えずに、多くのフレームで共有するパレットが1つほしいだけのとき。']]},
   limits:['輪郭の問題で自動修正するのはすき間だけで、二重のピクセルは報告するだけで消しません。','フレームの合計面積が4メガピクセルを超えると、件数は表示中のフレームだけを数えます。'],
   versions:{body:['数値はChromiumでのピクセルラボのブラウザテストで、書き出したファイルをページの外で開き直して測ったものです（Firefox・WebKitは未実行）。']}
  }
 },
 'game/pixel-perfect-checker':{
  type:'tool',
  intent:{primary:'check whether pixel art is pixel-perfect and detect its pixel size',secondary:['exact integer scale and grid offset','fractional scale estimate','blur / in-between colour count','recover the 1× source'],
   goal:'know the logical size of an image and whether an exact 1× recovery exists',input:'one PNG image (sprite, screenshot, upscaled art)',output:'a report (scale, offset, logical size, blurred edges) and, for exact grids, the recovered 1× PNG or an integer upscale',target:'any editor or engine',support:'full',
   evidence:['src/game/pixel-check.js (gridAnalysis, detectScale up to 16×, runLengths shortMean, edgeQuality, recoverSource)','tests/game-pixel-check.test.mjs (off-grid crop offset 2,3; 2.5× nearest)','docs/PIXEL-LAB.md §6 and Verification (1243 edge pixels, 86.3 %, 700 soft-alpha)'],
   external:[]},
  en:{
   answer:'A pixel-perfect checker tells you what state a pixel-art image is in: already 1×, an exact integer upscale (with its factor and grid offset), a fractional or smooth resize, or blurred. Nerulio’s checker finds the rows and columns where the colour changes: if they all sit on multiples of 3 (after one common offset), the image is exactly 3× and the 1× source can be recovered pixel for pixel. Anything else is reported as a measurement with a “not confident” flag where needed — never repaired as if it were exact.',
   concept:{title:'How the checker decides, without sampling or guessing',body:[
    'Integer detection is arithmetic. In a clean k× upscale the colour only changes at block borders, so every changing column index leaves the same remainder when divided by k, and so does every changing row. The checker records those positions in one pass and tries k from 16 down to 2; the largest k that fits both axes is the scale, a grid starting at 0 is preferred, and a shared non-zero remainder is the offset of an off-grid crop.',
    'Without an integer grid, runs of identical colour give an estimate. A 2.5× nearest resize alternates runs of 3 and 2 pixels, so the mean of the shortest runs (those within 1.5× of the minimum) reads 2.500×. Averaging every run over-estimates, because a flat border is one long run of many blocks: 2.885× on the same test sprite.',
    'Blur shows as in-between colours: an edge pixel whose colour lies strictly between its two opposite neighbours in Oklab. Nearest-scaled art has none; the bilinear 2.5× version of the test sprite had 1243 such pixels (86.3 % of its edges) and 700 partially transparent ones. One noisy pixel inside a block is enough to break the exact proof — which is why JPEG images are never reported as exact integer upscales.'],
    terms:[['Scale','Screen pixels per art pixel: exact for a proven block grid, an estimate otherwise.'],['Offset','Pixels cut from the left and top of the grid; a 4× sprite cropped by 2 and 3 pixels reads offset 2, 3.'],['In-between pixel','An edge colour between its neighbours — evidence of smoothing.'],['Not confident','A one-colour image, or one that changes on only one axis, has no grid to measure.']]},
   example:{title:'Example: one 16 × 16 sprite, four versions',lead:'Reports for a 16 × 16 test sprite after different treatments:',lines:[
    'input                              report',
    '64 × 64   4× nearest               scale 4 (exact), offset 0, 0, logical size 16 × 16',
    '62 × 61   same, cropped 2 and 3 px  scale 4 (exact), offset 2, 3, off-grid',
    '40 × 40   2.5× nearest             no integer grid, estimate 2.500× (runs 3, 2, 3, 2 …)',
    '40 × 40   2.5× bilinear            not integer; 1243 in-between edge pixels (86.3 %)',
    '',
    'recover 1× of the crop: ceil((62 + 2) / 4) × ceil((61 + 3) / 4) = 16 × 16'],
    after:'The 2.5× versions have no exact 1× inside them: blocks are 2 and 3 pixels wide in turn, so the checker offers no recovery and points to the cleanup instead.'},
   verify:{steps:[
    'For an exact result, the logical size is ceil((width + offset) ÷ scale) on each axis.',
    'Upscale the recovered sprite by the same factor: for an uncropped input it matches the input pixel for pixel.',
    'A “not confident” result on a flat or striped image is correct — there is nothing to measure.']},
   trouble:{rows:[
    ['Reads 1× although the image is clearly enlarged','Smoothing or JPEG removed the flat blocks, so no integer grid exists','The blur count shows many in-between edge pixels','Use the Cleanup panel ([[game/pixel-art-downscaler|downscaler]]), which measures smooth and fractional resizes'],
    ['Reads 2× for art you believe is 4×','Some colour changes sit between the 4-pixel borders: the art was edited after upscaling, or it has 2-pixel details','Zoom into the edges that break the 4-pixel grid','Accept 2×, or remove the later edits first'],
    ['An estimate such as 2.500× but no Recover button','A fractional scale: blocks have two widths, so no exact 1× exists','The report says “no integer grid”','Rebuild 1× in the Cleanup panel, which cuts at the measured edges'],
    ['“Not confident”','One colour, or changes on one axis only','Look at the image: a flat fill or stripes','Nothing to fix; check a frame with detail']]},
   alternatives:{rows:[
    ['[[game/pixel-art-downscaler|Cleanup panel in the Pixel workspace]]','The image was resized by a fraction, smoothed, JPEG-compressed or generated: it measures those grids and rebuilds 1× as a new sprite.'],
    ['A grid overlay in any pixel editor','One clean image: set the grid to the block size you see and check that every edge falls on it.']]},
   limits:['Integer scales up to 16× are detected (and never more than the image’s shorter side).','The exact proof needs exact colours: one noisy pixel inside a block and the image is reported as not an integer upscale.'],
   versions:{body:['Checked in the Pixel Lab tests (Chromium): 1×, 2×, 3×, 4× and 8× nearest detected exactly; a 4× sprite cropped by 2 and 3 px read offset 2, 3; 2.5× nearest read 2.500×; a 3× sprite recovered to 16 × 16 pixel-identical.']}
  },
  ko:{
   answer:'픽셀 퍼펙트 검사기는 도트 이미지가 어떤 상태인지 알려 줍니다. 이미 1배인지, 정확한 정수 확대(배율과 격자 오프셋 포함)인지, 소수·부드러운 크기 변경인지, 흐려졌는지입니다. Nerulio 검사기는 색이 바뀌는 행과 열을 찾습니다. 그 위치가 모두(하나의 공통 오프셋을 빼면) 3의 배수에 있으면 이미지는 정확히 3배이고 1배 원본을 픽셀 단위로 되살릴 수 있습니다. 그 밖의 경우는 필요하면 "확신 없음"을 붙인 측정값으로 보고하며, 정확한 것처럼 고치지 않습니다.',
   concept:{title:'표본 추출도 추측도 없이 판단하는 방법',body:[
    '정수 감지는 산수입니다. 깨끗한 k배 확대에서는 색이 블록 경계에서만 바뀌므로, 색이 바뀌는 열 번호를 k로 나눈 나머지가 모두 같고 행도 마찬가지입니다. 검사기는 그 위치를 한 번에 기록하고 k를 16부터 2까지 시도합니다. 두 축 모두 맞는 가장 큰 k가 배율이고, 0에서 시작하는 격자를 우선하며, 0이 아닌 공통 나머지는 어긋나게 잘린 이미지의 오프셋입니다.',
    '정수 격자가 없으면 같은 색이 이어지는 구간 길이로 추정합니다. 2.5배 최근접 확대는 3픽셀과 2픽셀 구간이 번갈아 나오므로 가장 짧은 구간들(최솟값의 1.5배 이내)의 평균이 2.500배가 됩니다. 모든 구간을 평균하면 과대평가됩니다. 단색 테두리는 여러 블록이 이어진 긴 구간 하나이기 때문이며, 같은 시험 스프라이트에서 2.885배가 나왔습니다.',
    '흐림은 중간색으로 드러납니다. 반대편 두 이웃 사이의 색을 Oklab에서 정확히 사이에 둔 가장자리 픽셀입니다. 최근접으로 키운 그림에는 없고, 시험 스프라이트의 쌍선형 2.5배 버전에는 1243개(가장자리의 86.3 %)와 반투명 픽셀 700개가 있었습니다. 블록 안에 잡음 픽셀 하나만 있어도 정확한 증명이 깨지므로 JPEG 이미지는 정확한 정수 확대로 보고되지 않습니다.'],
    terms:[['배율','도트 하나당 화면 픽셀 수. 증명된 블록 격자면 정확값, 아니면 추정값.'],['오프셋','격자 왼쪽·위에서 잘려 나간 픽셀 수. 2px·3px 잘린 4배 스프라이트는 오프셋 2, 3.'],['중간색 픽셀','이웃 사이의 색을 가진 가장자리 픽셀. 부드럽게 보간된 흔적.'],['확신 없음','한 색뿐이거나 한 축으로만 바뀌는 이미지에는 잴 격자가 없음.']]},
   example:{title:'예시: 16 × 16 스프라이트의 네 가지 버전',lead:'16 × 16 시험 스프라이트를 여러 방법으로 처리한 뒤의 보고서:',lines:[
    '입력                               보고서',
    '64 × 64   4배 최근접               배율 4 (정확), 오프셋 0, 0, 논리 크기 16 × 16',
    '62 × 61   같은 것, 2·3px 잘림       배율 4 (정확), 오프셋 2, 3, 격자 어긋남',
    '40 × 40   2.5배 최근접             정수 격자 없음, 추정 2.500배 (구간 3, 2, 3, 2 …)',
    '40 × 40   2.5배 쌍선형             정수 아님, 중간색 가장자리 픽셀 1243개 (86.3 %)',
    '',
    '잘린 이미지의 1배 복원: ceil((62 + 2) / 4) × ceil((61 + 3) / 4) = 16 × 16'],
    after:'2.5배 버전에는 정확한 1배가 들어 있지 않습니다. 블록 폭이 2와 3으로 번갈아 나오므로 검사기는 복원을 제공하지 않고 정리 기능을 안내합니다.'},
   verify:{steps:[
    '정확한 결과라면 논리 크기는 축마다 ceil((너비 + 오프셋) ÷ 배율)입니다.',
    '되살린 스프라이트를 같은 배율로 키우면, 잘리지 않은 입력과 픽셀 단위로 같습니다.',
    '단색이나 줄무늬 이미지에서 "확신 없음"은 올바른 결과입니다. 잴 것이 없습니다.']},
   trouble:{rows:[
    ['분명히 확대된 이미지인데 1배로 나옴','부드러운 보간이나 JPEG가 평평한 블록을 없애 정수 격자가 없음','흐림 수치에 중간색 가장자리 픽셀이 많음','부드러운·소수 배율 크기 변경을 재는 정리 패널([[game/pixel-art-downscaler|1배 복원]]) 사용'],
    ['4배라고 생각한 그림이 2배로 나옴','색 변화 일부가 4픽셀 경계 사이에 있음: 확대 후에 수정했거나 2픽셀 디테일이 있음','4픽셀 격자를 깨는 가장자리를 확대','2배로 받아들이거나, 나중에 한 수정을 먼저 지우기'],
    ['2.500배 같은 추정만 있고 복원 버튼이 없음','소수 배율이라 블록 폭이 두 가지여서 정확한 1배가 없음','보고서에 "정수 격자 없음"','측정한 가장자리에서 자르는 정리 패널로 1배를 다시 만들기'],
    ['"확신 없음"','한 색뿐이거나 한 축으로만 바뀜','이미지를 보면 단색이나 줄무늬','고칠 것 없음. 디테일이 있는 프레임을 검사']]},
   alternatives:{rows:[
    ['[[game/pixel-art-downscaler|픽셀 작업 공간의 정리 패널]]','소수 배율 크기 변경, 부드러운 보간, JPEG 압축, 생성 이미지일 때. 그런 격자를 재서 1배를 새 스프라이트로 다시 만듭니다.'],
    ['아무 도트 편집기의 격자 표시','깨끗한 이미지 한 장일 때. 보이는 블록 크기로 격자를 맞추고 모든 가장자리가 그 위에 오는지 확인합니다.']]},
   limits:['정수 배율은 16배까지(그리고 이미지의 짧은 변 이하까지) 감지합니다.','정확한 증명에는 정확한 색이 필요합니다. 블록 안에 잡음 픽셀이 하나만 있어도 정수 확대가 아니라고 보고합니다.'],
   versions:{body:['픽셀 랩 시험(Chromium)에서 확인: 1×·2×·3×·4×·8× 최근접을 정확히 감지, 2px·3px 잘린 4배 스프라이트는 오프셋 2, 3, 2.5배 최근접은 2.500배, 3배 스프라이트는 16 × 16으로 픽셀까지 같게 복원.']}
  },
  ja:{
   answer:'ピクセルパーフェクト チェッカーは、ドット絵の画像がどんな状態かを教えます。すでに1倍か、正確な整数倍の拡大（倍率とグリッドのオフセット付き）か、小数倍やなめらかなサイズ変更か、ぼけているかです。Nerulioのチェッカーは色が変わる行と列を探します。その位置がすべて（共通のオフセットを1つ除いて）3の倍数にあれば、画像はちょうど3倍で、1倍の元画像をピクセル単位で復元できます。それ以外は、必要に応じて「確信なし」を付けた測定値として報告し、正確であるかのように直すことはしません。',
   concept:{title:'サンプリングも推測もせずに判定する方法',body:[
    '整数倍の検出は算数です。きれいなk倍拡大では色はブロックの境目でしか変わらないので、色が変わる列の番号をkで割った余りはすべて同じになり、行も同じです。チェッカーはその位置を1回の走査で記録し、kを16から2まで試します。両方の軸に合う最大のkが倍率で、0から始まるグリッドを優先し、0でない共通の余りはずれて切られた画像のオフセットです。',
    '整数のグリッドがなければ、同じ色が続く区間の長さから推定します。2.5倍のニアレスト拡大では3ピクセルと2ピクセルの区間が交互に並ぶので、最も短い区間（最小値の1.5倍以内）の平均が2.500倍になります。すべての区間を平均すると大きく出ます。単色の縁は多くのブロックが続いた長い区間1つだからで、同じテスト用スプライトでは2.885倍になりました。',
    'ぼけは中間色として表れます。向かい合う2つの隣の色の、Oklabでちょうど間にある色を持つ縁のピクセルです。ニアレストで拡大した絵にはなく、テスト用スプライトのバイリニア2.5倍版には1243個（縁の86.3 %）と半透明のピクセル700個がありました。ブロックの中にノイズのピクセルが1つあるだけで正確な証明は崩れるので、JPEG画像が正確な整数倍の拡大と報告されることはありません。'],
    terms:[['倍率','1ドットあたりの画面ピクセル数。証明されたブロックのグリッドなら正確な値、そうでなければ推定値。'],['オフセット','グリッドの左と上から切られたピクセル数。2px・3px切られた4倍のスプライトはオフセット2, 3。'],['中間色のピクセル','隣同士の間の色を持つ縁のピクセル。なめらかに補間された跡。'],['確信なし','単色の画像や一方向にしか変化しない画像には、測るグリッドがない。']]},
   example:{title:'例：16 × 16のスプライトの4つの版',lead:'16 × 16のテスト用スプライトを別々に処理したあとのレポート：',lines:[
    '入力                               レポート',
    '64 × 64   4倍ニアレスト            倍率4（正確）、オフセット0, 0、論理サイズ16 × 16',
    '62 × 61   同じもの、2・3px切り抜き  倍率4（正確）、オフセット2, 3、グリッドずれ',
    '40 × 40   2.5倍ニアレスト          整数グリッドなし、推定2.500倍（区間3, 2, 3, 2 …）',
    '40 × 40   2.5倍バイリニア          整数ではない、中間色の縁ピクセル1243個（86.3 %）',
    '',
    '切り抜いた画像の1倍復元：ceil((62 + 2) / 4) × ceil((61 + 3) / 4) = 16 × 16'],
    after:'2.5倍の版には正確な1倍が含まれていません。ブロックの幅が2と3で交互になるので、チェッカーは復元を出さず、整理の機能を案内します。'},
   verify:{steps:[
    '正確な結果なら、論理サイズは各軸でceil((幅 + オフセット) ÷ 倍率)です。',
    '復元したスプライトを同じ倍率で拡大すると、切り抜いていない入力とピクセル単位で一致します。',
    '単色や縞模様の画像で「確信なし」と出るのは正しい結果です。測るものがありません。']},
   trouble:{rows:[
    ['明らかに拡大された画像なのに1倍と出る','なめらかな補間やJPEGが平らなブロックを消し、整数のグリッドがない','ぼけの数値で中間色の縁ピクセルが多い','なめらかな拡大や小数倍を測る整理パネル（[[game/pixel-art-downscaler|1倍復元]]）を使う'],
    ['4倍のはずの絵が2倍と出る','色の変化の一部が4ピクセルの境目の間にある：拡大後に修正した、または2ピクセルのディテールがある','4ピクセルのグリッドを崩す縁を拡大して見る','2倍として受け入れるか、あとからの修正を先に消す'],
    ['2.500倍のような推定だけで復元ボタンがない','小数倍でブロックの幅が2種類あり、正確な1倍が存在しない','レポートに「整数グリッドなし」','測った縁で区切る整理パネルで1倍を作り直す'],
    ['「確信なし」','単色、または一方向にしか変化しない','画像を見ると単色の塗りか縞模様','直すものはありません。ディテールのあるフレームを調べる']]},
   alternatives:{rows:[
    ['[[game/pixel-art-downscaler|ピクセル作業画面の整理パネル]]','小数倍のサイズ変更、なめらかな補間、JPEG圧縮、生成画像のとき。そうしたグリッドを測り、1倍を新しいスプライトとして作り直します。'],
    ['どのドット絵エディタでもグリッド表示','きれいな画像が1枚のとき。見えるブロックの大きさにグリッドを合わせ、すべての縁がその上にあるか確かめます。']]},
   limits:['整数倍率は16倍まで（かつ画像の短辺以下）検出します。','正確な証明には正確な色が必要です。ブロックの中にノイズのピクセルが1つでもあると、整数倍の拡大ではないと報告します。'],
   versions:{body:['ピクセルラボのテスト（Chromium）で確認：1×・2×・3×・4×・8×のニアレストを正確に検出、2px・3px切り抜いた4倍のスプライトはオフセット2, 3、2.5倍ニアレストは2.500倍、3倍のスプライトは16 × 16でピクセル単位まで同じに復元。']}
  }
 },
 'game/pixel-snapper-alternative':{
  type:'compare',
  intent:{primary:'compare Sprite Fusion Pixel Snapper, unfake.js and perfectPixel with an alternative',secondary:['which tool for which kind of fake pixel art','command line and library use','what each tool does better'],
   goal:'choose the right snapping tool for one’s images, knowing each one’s strengths and failure modes',input:'upscaled, resized or generated pixel art',output:'a choice of tool (and, with Nerulio, a 1× sprite in the Pixel workspace)',target:'—',support:'full',
   evidence:['docs/STUDIO-PIXEL.md §5 (69-case benchmark, per-kind results)','docs/pixel-bench/H2H.md §2–§3 (versions, settings, per-kind tables, failures)'],
   external:['Pixel Snapper README (CLI, k colours default 16, --pixel-size, --palette, web version, MIT)','unfake.js README (scale detection, downscaling methods, quantization, vectorizer, MIT)','perfectPixel README (pip perfect-pixel, FFT + Sobel, sample_method, min_size, ComfyUI node, MIT)']},
  en:{
   answer:'Sprite Fusion’s Pixel Snapper, unfake.js and perfectPixel all turn “fake” pixel art — upscaled, resized or generated — into a 1× image on a grid, but they measure differently and fail differently. Pixel Snapper (Rust, command line and web page) always snaps and quantizes, to 16 colours by default; unfake.js (JavaScript library and browser tool) works with whole-number scales and also vectorizes; perfectPixel (Python) finds the grid by FFT and gives up below 4 px cells. Nerulio’s Cleanup panel runs in a browser editor, shows the grid with a confidence first and does not snap when unsure.',
   concept:{title:'What each tool actually does',body:[
    'Pixel Snapper (MIT, by Hugo Duprez) is written in Rust. Its command line is `spritefusion-pixel-snapper input.png output.png 16`: it detects a pixel size, snaps to it and quantizes to a fixed palette — 16 colours by default, or your own hex colours with `--palette`; `--pixel-size` overrides the detection. The same engine runs on spritefusion.com. Its README targets generated art for tilemaps and game assets.',
    'unfake.js (MIT) is a JavaScript library with a browser tool: runs-based or edge-aware scale detection, dominant, median or content-adaptive downscaling, colour quantization and morphological cleanup — plus a vectorizer that turns images into SVG. perfectPixel (MIT, `pip install perfect-pixel`) finds the grid with an FFT, refines it with Sobel edges and samples by center, median or majority; there is a ComfyUI node and a web demo.',
    'Nerulio proves integer block grids exactly, measures fractional and smooth resizes with a lattice (a least-squares inverse for bilinear), follows uneven pseudo-pixels by edge tracking, and labels the result sure, likely or unsure; only sure and likely grids are applied. The output is a new sprite inside a pixel editor, where the pixels any tool gets wrong can be fixed by hand.'],
    terms:[['Quantize','Reduce the picture to a fixed number of colours (a palette).'],['Grid detection','Finding the cell size (and offset) of the fake pixels.'],['Confidence','Whether the tool says how sure it is — Nerulio does; the others return their result either way.']]},
   alternatives:{title:'When to use which',rows:[
    ['Pixel Snapper','You want a result for every image with a fixed palette size in one command, or you already use spritefusion.com. In our runs it did best with large cells (the ×5 and ×7 tile cases came back with every pixel right, at a size within 1 px) and on simulated generated art (size within 1 px in 80 % of cases); on whole-number upscales it over-segmented and never hit the exact size.'],
    ['unfake.js','Clean whole-number upscales inside a JavaScript pipeline: with the grid set to auto it found 85 % of the exact sizes on nearest ×2–×8. It also vectorizes images to SVG, which Nerulio does not do.'],
    ['perfectPixel','Python or ComfyUI batches with cells of 4 px or more: when it detects the grid of a clean upscale the result is exact (10 perfect cases), and it found the exact size of simulated generated art in 40 % of cases. Below its default `min_size` of 4 px it returns nothing (11 of its 15 failures).'],
    ['Nerulio Cleanup panel','Fractional and smooth resizes (exact size in 100 % and 93 % of those cases), animations that must share one grid and one palette, and when you want to see the grid before anything changes.'],
    ['Redraw by hand','Generated concept art where no tool finds a consistent grid; on simulated generated art no tool got more than 70.3 % of pixels exact.']]},
   limits:['No command line or library: Nerulio’s cleanup runs only inside the Studio in a browser.','No SVG vectorizer.','On real generated images it leaves the size unchanged until you type one — all 7 in our test.','Default settings remove a solid border background, which costs exact pixels on art whose background is part of the picture (63.2 % vs 74.0 % with the background kept).'],
   versions:{body:['Competitors as run on 2026-09-23/24 with their own defaults: Pixel Snapper = the WebAssembly build fetched from spritefusion.com (repository at ae20461, 1.0.0), 16 colours — byte identity with the live page was not confirmed; unfake.js at b2bee10 (library defaults, browser-tool defaults, and grid auto); perfectPixel 0.1.4 (72096de) with OpenCV, which drops alpha. Nerulio’s runs 2026-09-25 (docs/pixel-bench/H2H.md, docs/STUDIO-PIXEL.md §5). Tool descriptions come from each project’s README.'],sources:SNAPPER_DOCS}
  },
  ko:{
   answer:'Sprite Fusion의 Pixel Snapper, unfake.js, perfectPixel은 모두 확대·크기 변경·생성된 "가짜" 도트를 격자 위의 1배 이미지로 바꾸지만, 재는 방법도 실패하는 방식도 다릅니다. Pixel Snapper(Rust, 명령줄과 웹 페이지)는 항상 맞추고 색을 줄이며 기본은 16색입니다. unfake.js(자바스크립트 라이브러리와 브라우저 도구)는 정수 배율을 다루고 벡터화도 합니다. perfectPixel(파이썬)은 FFT로 격자를 찾으며 칸이 4px보다 작으면 포기합니다. Nerulio 정리 패널은 브라우저 편집기 안에서 돌고, 먼저 격자와 확신 정도를 보여 주며 불확실하면 맞추지 않습니다.',
   concept:{title:'각 도구가 실제로 하는 일',body:[
    'Pixel Snapper(MIT, Hugo Duprez)는 Rust로 만들어졌습니다. 명령줄은 `spritefusion-pixel-snapper input.png output.png 16`이며, 픽셀 크기를 감지해 맞추고 고정 팔레트로 양자화합니다. 기본 16색이고 `--palette`로 직접 고른 헥스 색을 줄 수 있으며, `--pixel-size`로 감지 결과를 덮어씁니다. 같은 엔진이 spritefusion.com에서도 돌고, README는 타일맵과 게임 에셋용 생성 그림을 대상으로 합니다.',
    'unfake.js(MIT)는 브라우저 도구가 딸린 자바스크립트 라이브러리입니다. 구간 기반 또는 가장자리 인식 배율 감지, 우세 색·중앙값·내용 적응 축소, 색 양자화, 형태학적 정리에 더해 이미지를 SVG로 바꾸는 벡터화 기능이 있습니다. perfectPixel(MIT, `pip install perfect-pixel`)은 FFT로 격자를 찾고 Sobel 가장자리로 다듬은 뒤 중심·중앙값·다수결로 샘플링하며, ComfyUI 노드와 웹 데모가 있습니다.',
    'Nerulio는 정수 블록 격자를 정확히 증명하고, 소수·부드러운 크기 변경은 격자로 재며(쌍선형은 최소제곱 역변환), 고르지 않은 가짜 픽셀은 가장자리를 따라가고, 결과에 확실·가능성 높음·불확실을 붙입니다. 확실과 가능성 높음만 적용합니다. 결과는 도트 편집기 안의 새 스프라이트라서 어느 도구든 틀리는 픽셀을 손으로 고칠 수 있습니다.'],
    terms:[['양자화','그림을 정해진 개수의 색(팔레트)으로 줄이는 것.'],['격자 감지','가짜 픽셀의 칸 크기(와 오프셋)를 찾는 것.'],['확신 정도','도구가 얼마나 확실한지 알려 주는지 여부. Nerulio는 알려 주고, 다른 도구는 어느 경우든 결과를 내놓습니다.']]},
   alternatives:{title:'언제 무엇을 쓰나',rows:[
    ['Pixel Snapper','모든 이미지에 명령 한 번으로 정해진 색 수의 결과가 필요하거나, 이미 spritefusion.com을 쓸 때. 우리 실행에서 칸이 클 때(×5·×7 타일 사례는 크기 1px 이내에 픽셀 전부 일치) 그리고 모의 생성 그림(80 %에서 크기 1px 이내)에서 가장 좋았고, 정수 배율 확대에서는 너무 잘게 나눠 정확한 크기를 한 번도 맞히지 못했습니다.'],
    ['unfake.js','자바스크립트 파이프라인 안의 깨끗한 정수 확대. 격자를 auto로 두면 ×2~×8 최근접에서 정확한 크기의 85 %를 찾았습니다. 이미지를 SVG로 벡터화하는 기능도 있는데 Nerulio에는 없습니다.'],
    ['perfectPixel','칸이 4px 이상인 파이썬·ComfyUI 대량 처리. 깨끗한 확대에서 격자를 찾으면 결과가 정확하고(완벽한 사례 10개), 모의 생성 그림의 크기를 40 %에서 정확히 찾았습니다. 기본 `min_size` 4px보다 작으면 아무것도 내놓지 않습니다(실패 15건 중 11건).'],
    ['Nerulio 정리 패널','소수·부드러운 크기 변경(해당 사례에서 정확한 크기 100 %·93 %), 격자와 팔레트를 하나로 맞춰야 하는 애니메이션, 무엇이든 바꾸기 전에 격자를 보고 싶을 때.'],
    ['손으로 다시 그리기','어떤 도구도 일관된 격자를 못 찾는 생성 콘셉트 그림. 모의 생성 그림에서 정확한 픽셀이 70.3 %를 넘은 도구는 없었습니다.']]},
   limits:['명령줄도 라이브러리도 없습니다. Nerulio 정리는 브라우저의 Studio 안에서만 돕니다.','SVG 벡터화 기능이 없습니다.','실제 생성 이미지는 크기를 입력할 때까지 그대로 둡니다. 우리 시험에서 7장 모두 그랬습니다.','기본 설정은 단색 테두리 배경을 지우므로, 배경이 그림의 일부인 경우 정확한 픽셀이 줄어듭니다(배경 유지 74.0 % 대 63.2 %).'],
   versions:{body:['경쟁 도구는 2026-09-23/24에 각자의 기본값으로 실행했습니다. Pixel Snapper = spritefusion.com에서 받은 WebAssembly 빌드(저장소 ae20461, 1.0.0), 16색 — 실제 페이지와 바이트까지 같은지는 확인하지 못함. unfake.js는 b2bee10(라이브러리 기본값, 브라우저 도구 기본값, 격자 auto). perfectPixel 0.1.4(72096de)는 OpenCV로 실행했으며 알파를 버립니다. Nerulio는 2026-09-25에 실행(docs/pixel-bench/H2H.md, docs/STUDIO-PIXEL.md §5). 도구 설명은 각 프로젝트의 README를 따랐습니다.'],sources:SNAPPER_DOCS}
  },
  ja:{
   answer:'Sprite FusionのPixel Snapper、unfake.js、perfectPixelは、どれも拡大・サイズ変更・生成された「偽物」のドット絵をグリッド上の1倍画像にしますが、測り方も失敗の仕方も違います。Pixel Snapper（Rust、コマンドラインとWebページ）は常に合わせて減色し、既定は16色です。unfake.js（JavaScriptのライブラリとブラウザツール）は整数倍を扱い、ベクター化もできます。perfectPixel（Python）はFFTでグリッドを探し、セルが4px未満だとあきらめます。Nerulioの整理パネルはブラウザのエディタ内で動き、まずグリッドと確かさを示し、不確かなら合わせません。',
   concept:{title:'それぞれのツールが実際にすること',body:[
    'Pixel Snapper（MIT、Hugo Duprez作）はRustで書かれています。コマンドラインは`spritefusion-pixel-snapper input.png output.png 16`で、ピクセルの大きさを検出して合わせ、固定のパレットに減色します。既定は16色で、`--palette`で自分のHEX色を渡せ、`--pixel-size`で検出結果を上書きできます。同じエンジンがspritefusion.comでも動き、READMEはタイルマップやゲーム素材向けの生成画像を対象にしています。',
    'unfake.js（MIT）はブラウザツール付きのJavaScriptライブラリです。区間ベースまたはエッジを考慮した倍率検出、優勢色・中央値・内容適応の縮小、減色、モルフォロジーによる整理に加え、画像をSVGにするベクター化機能があります。perfectPixel（MIT、`pip install perfect-pixel`）はFFTでグリッドを探し、Sobelの縁で調整してから中心・中央値・多数決でサンプリングします。ComfyUIのノードとWebデモがあります。',
    'Nerulioは整数のブロックグリッドを正確に証明し、小数倍やなめらかなサイズ変更は格子で測り（バイリニアは最小二乗の逆変換）、不揃いな疑似ピクセルは縁をたどり、結果に確実・おそらく・不確かを付けます。適用するのは確実とおそらくだけです。結果はドット絵エディタ内の新しいスプライトなので、どのツールでも間違えるピクセルを手で直せます。'],
    terms:[['減色（量子化）','絵を決まった数の色（パレット）に減らすこと。'],['グリッド検出','偽のピクセルのセルの大きさ（とオフセット）を見つけること。'],['確かさ','ツールがどれだけ確かかを示すかどうか。Nerulioは示し、ほかのツールはどちらの場合も結果を返します。']]},
   alternatives:{title:'どれをいつ使うか',rows:[
    ['Pixel Snapper','すべての画像に1コマンドで決まった色数の結果がほしいとき、またはすでにspritefusion.comを使っているとき。私たちの実行では、セルが大きいとき（×5と×7のタイルはサイズ1px以内でピクセルすべて一致）と模擬生成画像（80 %でサイズ1px以内）で最も良く、整数倍の拡大では細かく分けすぎて正確なサイズを一度も当てませんでした。'],
    ['unfake.js','JavaScriptのパイプライン内のきれいな整数倍の拡大。グリッドをautoにすると、×2〜×8のニアレストで正確なサイズの85 %を当てました。画像をSVGにベクター化する機能もあり、Nerulioにはありません。'],
    ['perfectPixel','セルが4px以上のPython・ComfyUIでの一括処理。きれいな拡大でグリッドを検出できれば結果は正確で（完全一致10件）、模擬生成画像のサイズを40 %で正確に当てました。既定の`min_size`である4pxより小さいと何も返しません（失敗15件中11件）。'],
    ['Nerulioの整理パネル','小数倍やなめらかなサイズ変更（該当ケースで正確なサイズ100 %・93 %）、グリッドとパレットを1つにそろえる必要のあるアニメーション、何かを変える前にグリッドを見たいとき。'],
    ['手で描き直す','どのツールも一貫したグリッドを見つけられない生成コンセプト画。模擬生成画像で完全一致ピクセルが70.3 %を超えたツールはありません。']]},
   limits:['コマンドラインもライブラリもありません。Nerulioの整理はブラウザのStudio内でしか動きません。','SVGへのベクター化機能はありません。','実際の生成画像はサイズを入力するまでそのままにします。テストでは7枚すべてでした。','初期設定は単色の縁の背景を消すため、背景が絵の一部の場合は完全一致ピクセルが減ります（背景を残すと74.0 %、初期設定63.2 %）。'],
   versions:{body:['競合ツールは2026-09-23/24にそれぞれの初期設定で実行：Pixel Snapper = spritefusion.comから取得したWebAssemblyビルド（リポジトリはae20461、1.0.0）、16色 — 実際のページとのバイト一致は確認できていません。unfake.jsはb2bee10（ライブラリ初期設定、ブラウザツール初期設定、グリッドauto）。perfectPixel 0.1.4（72096de）はOpenCVで実行し、アルファは捨てられます。Nerulioは2026-09-25に実行（docs/pixel-bench/H2H.md、docs/STUDIO-PIXEL.md §5）。ツールの説明は各プロジェクトのREADMEに従っています。'],sources:SNAPPER_DOCS}
  }
 }
};
