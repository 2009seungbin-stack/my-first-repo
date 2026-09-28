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
 }
};
