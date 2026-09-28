/** Intent content for the sprite → engine pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/game/export/godot.js, src/game/aseprite.js, src/game/model.js, docs/STUDIO-PACK.md,
 * docs/STUDIO-SPRITE.md. Engine behaviour: the official docs cited in each page's `versions.sources`. */
const GODOT_DOCS=['[Godot 4.7 docs: AnimatedSprite2D](https://docs.godotengine.org/en/stable/classes/class_animatedsprite2d.html)','[Godot 4.7 docs: SpriteFrames](https://docs.godotengine.org/en/stable/classes/class_spriteframes.html)','[Godot 4.7 docs: 2D sprite animation](https://docs.godotengine.org/en/stable/tutorials/2d/2d_sprite_animation.html)'];
// Godot editor labels of the sheet dialog (Horizontal, Vertical, Size, Separation, Offset, Auto Slice, Frame Order) were
// read in the 4.7-stable editor source; the docs page only names the button.
const GODOT_SHEET=['[Godot 4.7 source: the SpriteFrames editor and its sprite-sheet dialog](https://github.com/godotengine/godot/blob/4.7-stable/editor/scene/sprite_frames_editor_plugin.cpp)','[Godot 4.7 docs: Sprite2D (hframes, vframes, region filter clip)](https://docs.godotengine.org/en/stable/classes/class_sprite2d.html)','[Godot 4.7 docs: AtlasTexture (filter_clip)](https://docs.godotengine.org/en/stable/classes/class_atlastexture.html)'];
const GODOT_PIXEL=['[Godot 4.7 docs: Multiple resolutions (pixel art stretch settings)](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)','[Godot 4.7 docs: ProjectSettings (default texture filter, 2D snap)](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)'];
const UNITY_DOCS=['[Unity 6.5 Manual: Cut out sprites from a texture](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/use-editor.html)','[Unity Manual: Sprite Editor tab reference (Slice options)](https://docs.unity3d.com/Manual/sprite/sprite-editor/sprite-editor-window-reference.html)','[Unity 6.5 Manual: Sprite (2D and UI) import settings](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)','[2D Pixel Perfect package: sprite import settings for pixel art](https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@5.0/manual/index.html)','[Unity Manual: Create a new Animation Clip](https://docs.unity3d.com/Manual/animeditor-CreatingANewAnimationClip.html)'];
const UNITY_ASE=['[2D Aseprite Importer 4.0: introduction](https://docs.unity3d.com/Packages/com.unity.2d.aseprite@4.0/manual/index.html)','[2D Aseprite Importer 4.0: supported Aseprite features](https://docs.unity3d.com/Packages/com.unity.2d.aseprite@4.0/manual/AsepriteFeatures.html)'];
const PHASER_DOCS=['[Phaser docs: LoaderPlugin (spritesheet, atlas, aseprite)](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)','[Phaser docs: SpriteSheetConfig](https://docs.phaser.io/api-documentation/typedef/types-textures)','[Phaser docs: AnimationManager (create, createFromAseprite, fromJSON)](https://docs.phaser.io/api-documentation/class/animations-animationmanager)','[Phaser docs: Animation and AnimationFrame config](https://docs.phaser.io/api-documentation/typedef/types-animations)','[Phaser docs: Game config (pixelArt)](https://docs.phaser.io/api-documentation/typedef/types-core)'];
const GM_DOCS=['[GameMaker Manual: Strip Images](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Sprite_Properties/Sprite_Strips.htm)','[GameMaker Manual: The Sprite Editor](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Sprites.htm)','[GameMaker Manual: The Image Editor (Convert to Frames)](https://manual.gamemaker.io/monthly/en/The_Asset_Editors/Image_Editor.htm)','[GameMaker Manual: Windows Game Options (Graphics)](https://manual.gamemaker.io/monthly/en/Settings/Game_Options/Windows.htm)'];
const GD_DOCS=['[GDevelop wiki: Sprite object](https://wiki.gdevelop.io/gdevelop5/objects/sprite/)','[GDevelop wiki: Import a sprite sheet using Piskel](https://wiki.gdevelop.io/gdevelop5/tutorials/piskel-sprite-sheets/)','[GDevelop wiki: Sprite Sheet Animations extension](https://wiki.gdevelop.io/gdevelop5/extensions/sprite-sheet/)','[GDevelop wiki: Game properties (Scale mode)](https://wiki.gdevelop.io/gdevelop5/interface/project-manager/properties/)','[GDevelop wiki: Edit points](https://wiki.gdevelop.io/gdevelop5/objects/sprite/edit-points/)'];
export default {
 'game/aseprite-to-godot':{
  type:'conversion',
  intent:{primary:'convert an .aseprite file into a working Godot 4 animated sprite',secondary:['keep tags and per-frame timing','pixel-art import settings in Godot','no Aseprite install or Godot plugin'],
   goal:'an AnimatedSprite2D in Godot 4 that plays every Aseprite tag at the timing drawn in Aseprite',input:'.aseprite / .ase file (tags optional; layers, slices optional)',output:'SpriteFrames .tres + packed PNG + AnimatedSprite2D .tscn + .png.import + README',target:'Godot 4 (verified 4.7.2)',support:'full',
   evidence:['src/game/export/godot.js','src/studio/sprite/import-build.js (Studio tags are written at 10 fps)','src/game/export/godot.js (duration = ms ÷ (1000 ÷ fps))','docs/STUDIO-PACK.md (Godot 4.7.2 engine-verify runs)','docs/STUDIO-SPRITE.md §10 (231-file .aseprite corpus)'],
   external:['Godot 4.7 docs: SpriteFrames relative duration and FPS formula','AnimatedSprite2D properties and play()','Aseprite docs: tags, Export Sprite Sheet']},
  en:{
   answer:'An `.aseprite` file holds frames with their own durations in milliseconds, tags (named frame ranges with a direction and repeat count), layers and slices. Godot 4 cannot open it directly: it plays a `SpriteFrames` resource on an `AnimatedSprite2D`. Nerulio reads the file in your browser, turns every tag into a `SpriteFrames` animation with the same timing, packs the frames into one PNG and adds a ready scene. Copy the folder under `res://`, drop the `.tscn` into your scene, and the first tag plays with Nearest filtering. Godot 4 only (checked in 4.7.2).',
   concept:{title:'What is in an .aseprite file, and what Godot needs',body:[
    'Aseprite saves a whole animation document. Every frame has its own duration in milliseconds. Tags group a range of frames into a named animation (`walk` = frames 4–9) and say how it plays: forward, reverse or ping-pong, forever or a set number of times. Layers keep parts of the drawing apart, and slices mark rectangles such as a pivot point or a hit box.',
    'Godot 4 plays frame animation with an `AnimatedSprite2D` node that reads a `SpriteFrames` resource. Each animation in it has a name, a speed in frames per second, a loop flag and a list of frames; each frame is a texture plus a relative duration. Godot shows a frame for relative duration ÷ (FPS × speed scale) seconds, so milliseconds have to be converted, not copied.',
    'Nerulio writes every tag at 10 FPS, so one tick is 100 ms (Aseprite\'s default frame length), and gives every frame a relative duration of its milliseconds ÷ 100. The playback time of every single frame therefore matches Aseprite, even when the durations differ inside one tag.'],
    terms:[['Tag','A named frame range in Aseprite with a direction (forward, reverse, ping-pong) and a repeat count.'],['SpriteFrames','The Godot resource that stores animations: name, speed (FPS), loop and frames.'],['AtlasTexture','A rectangle of a larger texture. Every exported frame is one, pointing into the packed PNG.'],['Relative duration','Godot\'s per-frame multiplier: 1.0 lasts one tick of the animation\'s FPS, 2.0 two ticks.']]},
   example:{title:'Example: a 32 × 32 hero with three tags',lead:'The .aseprite file has 16 frames and three tags. This is what the export writes into the SpriteFrames resource:',lines:[
    'Aseprite                                  Godot 4 SpriteFrames',
    'idle    frames 0–3    125 ms each   ∞     idle    10 FPS   1.25 × 4                      loop on',
    'walk    frames 4–9    100 ms each   ∞     walk    10 FPS   1.0 × 6                       loop on',
    'attack  frames 10–15  100,100,100,100,    attack  10 FPS   1.0, 1.0, 1.0, 1.0,            loop off',
    '                      150, 250 ms   ×1                     1.5, 2.5',
    '',
    'duration    = ms / (1000 / 10 FPS) = ms / 100      125 ms → 1.25    250 ms → 2.5',
    'check       1.25 / 10 = 0.125 s    2.5 / 10 = 0.250 s   (same as Aseprite)'],
    after:'`attack` repeats once in Aseprite, so its loop flag is off: it plays once and stays on its last frame. In a script, play `idle` again from the node\'s `animation_finished` signal.'},
   mapping:{title:'What survives the conversion',head:['In Aseprite','In Nerulio','In Godot 4'],rows:[
    ['Frame pixels (visible layers)','Composited frame, packed into one PNG page','An `AtlasTexture` region of that PNG'],
    ['Frame duration (ms)','Kept per frame','Relative duration = ms ÷ 100; the animation speed is 10 FPS'],
    ['Tag','One animation of the same name','A `SpriteFrames` animation of the same name'],
    ['Direction reverse / ping-pong','Playback order written out (ping-pong: 0-1-2-3-2-1)','Frames listed in that order'],
    ['Repeat ∞','Loop','`loop = true`'],
    ['Repeat 1, 2, 3…','Plays that many times in the preview','`loop = false`: Godot plays it once (a repeat count is not stored)'],
    ['No tags at all','One animation `default` with every frame','Animation `default`'],
    ['Slice with a pivot','Frame pivot (default without one: bottom centre)','Node `offset` = −pivot of the first frame, `centered = false`'],
    ['Slices named hit / hurt …','Boxes per frame','Stored in the resource metadata `nerulio`, not as nodes'],
    ['Layers, blend modes, opacity','Kept in the Studio','Flattened: Godot receives the composited frame']],
    note:'Godot 4.7 also has a ping-pong loop mode of its own; the export does not depend on it because it writes the order frame by frame.'},
   outputs:{rows:[
    ['hero.tres','The `SpriteFrames` resource: animations, FPS, loop flags, relative durations, `AtlasTexture` regions and trim margins; metadata `nerulio` with pivots, boxes and collision polygons.'],
    ['hero.tscn','A scene with one `AnimatedSprite2D` using the resource: Nearest filtering, autoplay of the first tag, the pivot as offset.'],
    ['hero.png','The packed frames (more pages when the frames do not fit on one).'],
    ['hero.png.import','Import settings Godot reads: lossless, no mipmaps, Fix Alpha Border off, so faint pixels keep their colour.'],
    ['README-GODOT.md','These steps for this bundle.']]},
   target:{title:'Import it into Godot 4',steps:[
    'Unzip the bundle and copy the whole folder anywhere under `res://`, for example `res://characters/hero/`. The `.tres` finds the PNG by a relative path, so keep the files together.',
    'Let the FileSystem dock finish importing. Godot uses the shipped `hero.png.import`, so the atlas is imported lossless and without mipmaps.',
    'Drag `hero.tscn` into your scene, or select your own `AnimatedSprite2D` and load `hero.tres` into its Sprite Frames property.',
    'Choose the animation in the node\'s Animation property or in the SpriteFrames panel; the shipped scene autoplays the first tag.',
    'From a script, switch with `$Hero.play("walk")`. For a tag that does not loop, connect `animation_finished` and play `idle` again.',
    'For your own nodes, set Project Settings › Rendering › Textures › Canvas Textures › Default Texture Filter to Nearest once, or set the node\'s Texture › Filter to Nearest.']},
   verify:{steps:[
    'Run the scene: `walk` with six 100 ms frames should repeat every 0.6 s, the same as Aseprite\'s preview.',
    'Open the SpriteFrames panel: every animation has the frame count of its tag (a ping-pong tag shows the written-out order).',
    'Zoom the 2D viewport to 400 %: pixel edges stay square. Soft edges mean the node uses Linear filtering.',
    '`print($Hero.sprite_frames.get_meta("nerulio"))` lists the pivot and boxes of every frame.']},
   trouble:{rows:[
    ['The sprite looks blurry','Your node inherits the project\'s default Linear filter','Zoom in; check the node\'s Texture › Filter','Set Filter to Nearest on the node, or the project\'s Default Texture Filter to Nearest'],
    ['Faint pixels (glow, smoke) change colour','The PNG was imported with Godot\'s default Fix Alpha Border instead of the shipped `.png.import`','Import dock of the PNG: Fix Alpha Border is on','Keep `hero.png.import` next to the PNG, or turn Fix Alpha Border off and click Reimport'],
    ['A tag is missing','The file had no tags (everything became `default`), or the tag was renamed or removed before export','Look at the tag lanes on Nerulio\'s timeline before exporting','Add or fix the tag in Aseprite or on the timeline, then export again'],
    ['A play-once tag loops, or a looping tag stops','Repeat ∞ becomes loop on; any repeat count becomes loop off','SpriteFrames panel: the loop toggle of that animation','Change the repeat in the tag, or toggle Loop in Godot; use `animation_finished` for play-once tags'],
    ['The character jumps when the animation changes','Frames have different pivots, but a node has one offset (the first frame\'s pivot)','The export notes warn about differing pivots; every pivot is in `metadata/nerulio`','Use one pivot slice for all frames, or align pivots in Nerulio (see [[game/sprite-pivot-editor|the pivot editor]]) before export'],
    ['Timing is faster or slower than in Aseprite','The node\'s Speed Scale or a `play()` custom speed is not 1','Inspector: Speed Scale','Set Speed Scale to 1 and call `play()` without a custom speed'],
    ['Godot 3 cannot open the .tres','The resource uses the Godot 4 format with per-frame durations','—','Use Godot 4, or export a plain [[game/aseprite-to-sprite-sheet|PNG sprite sheet]] and build the frames by hand in Godot 3']]},
   alternatives:{rows:[
    ['Export a PNG sheet from Aseprite (File › Export Sprite Sheet) and use Add Frames from Sprite Sheet in Godot\'s SpriteFrames panel','One or two animations with even timing: no extra files, but you set each animation\'s FPS by hand and per-frame durations are lost. See [[game/godot-sprite-sheet|using a sprite sheet in Godot]].'],
    ['An .aseprite import plugin from the Godot Asset Library','You change the art often and want Godot to reimport on every save; such plugins call the Aseprite program, so it must be installed on every machine that imports.'],
    ['The same file for another engine','[[game/aseprite-to-unity|Aseprite to Unity]] or [[game/aseprite-to-phaser|Aseprite to Phaser]].']]},
   limits:['A repeat count above one is not stored: Godot plays such an animation once.','Layers arrive flattened; to animate parts separately in Godot, export them as separate files.','Hit and hurt boxes are data in the resource metadata; create the `Area2D` and `CollisionShape2D` nodes yourself.'],
   versions:{body:['Nerulio\'s bundle was loaded by Godot 4.7.2 in our verification runs: every animation\'s frame count, speed, loop and relative durations were read back and every frame was drawn at 1× and 4× and compared with the source. The .aseprite reader was checked on 231 real files that reopened in Aseprite 1.3.18 with the same tags, durations and pixels. What the steps above say about Godot follows the Godot 4.7 documentation.'],sources:[...GODOT_DOCS,'[Aseprite docs: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ko:{
   answer:'`.aseprite` 파일에는 프레임마다 밀리초 단위 길이, 태그(방향과 반복 횟수가 있는 이름 붙은 프레임 구간), 레이어, 슬라이스가 들어 있습니다. Godot 4는 이 파일을 직접 열지 못하고 `AnimatedSprite2D`에서 `SpriteFrames` 리소스를 재생합니다. Nerulio는 브라우저에서 파일을 읽어 태그마다 같은 타이밍의 `SpriteFrames` 애니메이션을 만들고, 프레임을 PNG 한 장에 패킹하고, 바로 쓸 수 있는 씬을 붙여 줍니다. 폴더를 `res://` 아래에 복사하고 `.tscn`을 씬에 넣으면 첫 태그가 Nearest 필터로 재생됩니다. Godot 4 전용이며 4.7.2에서 확인했습니다.',
   concept:{title:'.aseprite 파일에 든 것과 Godot가 필요로 하는 것',body:[
    'Aseprite는 애니메이션 문서 전체를 저장합니다. 프레임마다 길이(ms)가 따로 있고, 태그는 프레임 구간에 이름을 붙여 하나의 애니메이션으로 묶으며(`walk` = 4~9번 프레임) 재생 방식도 정합니다. 정방향·역방향·핑퐁, 무한 반복 또는 정해진 횟수입니다. 레이어는 그림의 부분을 나눠 두고, 슬라이스는 피벗 위치나 히트박스 같은 사각형을 표시합니다.',
    'Godot 4에서 프레임 애니메이션은 `AnimatedSprite2D` 노드가 `SpriteFrames` 리소스를 읽어 재생합니다. 애니메이션마다 이름, 초당 프레임 수(FPS), 반복 여부, 프레임 목록이 있고 프레임은 텍스처와 상대 길이로 이뤄집니다. Godot는 한 프레임을 상대 길이 ÷ (FPS × 속도 배율)초 동안 보여 주므로, 밀리초 값을 그대로 옮기면 안 되고 변환해야 합니다.',
    'Nerulio는 모든 태그를 10 FPS로 씁니다. 한 틱이 100ms(Aseprite의 기본 프레임 길이)이고, 각 프레임의 상대 길이는 밀리초 ÷ 100입니다. 그래서 한 태그 안에서 길이가 제각각이어도 프레임 하나하나의 재생 시간이 Aseprite와 같습니다.'],
    terms:[['태그','Aseprite에서 방향(정방향·역방향·핑퐁)과 반복 횟수가 있는, 이름 붙은 프레임 구간.'],['SpriteFrames','애니메이션의 이름·속도(FPS)·반복·프레임을 저장하는 Godot 리소스.'],['AtlasTexture','큰 텍스처의 사각 영역. 내보낸 프레임 하나하나가 패킹된 PNG의 한 영역을 가리킵니다.'],['상대 길이','Godot의 프레임별 배수. 1.0은 애니메이션 FPS의 한 틱, 2.0은 두 틱 동안 표시됩니다.']]},
   example:{title:'예시: 태그 3개가 있는 32 × 32 캐릭터',lead:'프레임 16개와 태그 3개가 있는 .aseprite 파일을 내보내면 SpriteFrames에 다음 값이 들어갑니다.',lines:[
    'Aseprite                                  Godot 4 SpriteFrames',
    'idle    프레임 0–3    각 125 ms      ∞     idle    10 FPS   1.25 × 4                      loop on',
    'walk    프레임 4–9    각 100 ms      ∞     walk    10 FPS   1.0 × 6                       loop on',
    'attack  프레임 10–15  100,100,100,100,    attack  10 FPS   1.0, 1.0, 1.0, 1.0,            loop off',
    '                      150, 250 ms   ×1                     1.5, 2.5',
    '',
    '상대 길이 = ms / (1000 / 10 FPS) = ms / 100      125 ms → 1.25    250 ms → 2.5',
    '검산        1.25 / 10 = 0.125초    2.5 / 10 = 0.250초   (Aseprite와 동일)'],
    after:'`attack`은 Aseprite에서 한 번만 재생하도록 되어 있어 반복이 꺼집니다. 한 번 재생된 뒤 마지막 프레임에 멈추므로, 스크립트에서 노드의 `animation_finished` 시그널을 받아 `idle`을 다시 재생하세요.'},
   mapping:{title:'변환 후에도 남는 것',head:['Aseprite','Nerulio','Godot 4'],rows:[
    ['프레임 픽셀(보이는 레이어)','합성한 프레임을 PNG 한 페이지에 패킹','그 PNG의 `AtlasTexture` 영역'],
    ['프레임 길이(ms)','프레임마다 유지','상대 길이 = ms ÷ 100. 애니메이션 속도는 10 FPS'],
    ['태그','같은 이름의 애니메이션 하나','같은 이름의 `SpriteFrames` 애니메이션'],
    ['방향: 역방향·핑퐁','재생 순서를 풀어서 기록(핑퐁: 0-1-2-3-2-1)','그 순서대로 나열된 프레임'],
    ['반복 ∞','반복 재생','`loop = true`'],
    ['반복 1, 2, 3…','미리보기에서 그 횟수만큼 재생','`loop = false`: Godot에서는 한 번 재생(반복 횟수는 저장되지 않음)'],
    ['태그가 하나도 없음','모든 프레임으로 된 애니메이션 `default` 하나','애니메이션 `default`'],
    ['피벗이 있는 슬라이스','프레임 피벗(없으면 기본값: 하단 중앙)','노드 `offset` = −첫 프레임 피벗, `centered = false`'],
    ['hit / hurt 등의 이름을 가진 슬라이스','프레임별 박스','리소스 메타데이터 `nerulio`에 저장(노드로 만들지 않음)'],
    ['레이어·블렌드 모드·불투명도','Studio에서는 유지','합쳐짐: Godot에는 합성된 프레임이 들어감']],
    note:'Godot 4.7에는 자체 핑퐁 반복 모드도 있지만, 내보내기는 순서를 프레임 단위로 직접 기록하므로 그 기능에 의존하지 않습니다.'},
   outputs:{rows:[
    ['hero.tres','`SpriteFrames` 리소스: 애니메이션, FPS, 반복 여부, 상대 길이, `AtlasTexture` 영역과 트림 여백, 피벗·박스·충돌 폴리곤이 든 메타데이터 `nerulio`.'],
    ['hero.tscn','이 리소스를 쓰는 `AnimatedSprite2D` 하나가 든 씬: Nearest 필터, 첫 태그 자동 재생, 피벗을 오프셋으로 설정.'],
    ['hero.png','패킹된 프레임(한 장에 다 들어가지 않으면 페이지가 늘어남).'],
    ['hero.png.import','Godot가 읽는 가져오기 설정: 무손실, 밉맵 없음, Fix Alpha Border 끔. 흐린 픽셀의 색이 바뀌지 않습니다.'],
    ['README-GODOT.md','이 번들에 맞춘 아래 단계 설명.']]},
   target:{title:'Godot 4로 가져오기',steps:[
    '번들 압축을 풀고 폴더째 `res://` 아래 아무 곳에나 복사합니다(예: `res://characters/hero/`). `.tres`가 상대 경로로 PNG를 찾으므로 파일을 한곳에 두세요.',
    '파일시스템 독이 가져오기를 끝낼 때까지 기다립니다. 함께 들어 있는 `hero.png.import` 설정대로 아틀라스가 무손실·밉맵 없이 들어옵니다.',
    '`hero.tscn`을 씬으로 끌어 놓거나, 직접 만든 `AnimatedSprite2D`를 선택해 Sprite Frames 속성에 `hero.tres`를 지정합니다.',
    '노드의 Animation 속성이나 SpriteFrames 패널에서 애니메이션을 고릅니다. 함께 온 씬은 첫 태그를 자동 재생합니다.',
    '스크립트에서는 `$Hero.play("walk")`로 바꿉니다. 반복하지 않는 태그라면 `animation_finished`를 연결해 `idle`을 다시 재생하세요.',
    '직접 만든 노드에는 프로젝트 설정 › Rendering › Textures › Canvas Textures › Default Texture Filter를 Nearest로 한 번 바꾸거나, 노드의 Texture › Filter를 Nearest로 설정합니다.']},
   verify:{steps:[
    '씬을 실행합니다. 100ms 프레임 6개로 된 `walk`는 Aseprite 미리보기처럼 0.6초마다 반복돼야 합니다.',
    'SpriteFrames 패널을 엽니다. 애니메이션마다 태그의 프레임 수와 같아야 합니다(핑퐁 태그는 풀어 쓴 순서로 보임).',
    '2D 뷰포트를 400%로 확대합니다. 픽셀 경계가 네모나게 유지돼야 하며, 흐리면 노드가 Linear 필터를 쓰는 것입니다.',
    '`print($Hero.sprite_frames.get_meta("nerulio"))`로 프레임마다 피벗과 박스가 나오는지 봅니다.']},
   trouble:{rows:[
    ['스프라이트가 흐리게 보임','노드가 프로젝트 기본 Linear 필터를 물려받음','확대해 보고 노드의 Texture › Filter 확인','노드의 Filter를 Nearest로, 또는 프로젝트의 Default Texture Filter를 Nearest로'],
    ['흐린 픽셀(빛, 연기)의 색이 바뀜','함께 온 `.png.import` 대신 Godot 기본값(Fix Alpha Border 켬)으로 가져옴','PNG의 Import 독에서 Fix Alpha Border가 켜져 있음','`hero.png.import`를 PNG 옆에 두거나, Fix Alpha Border를 끄고 Reimport'],
    ['태그 하나가 없음','파일에 태그가 없어 전부 `default`가 됐거나, 내보내기 전에 태그 이름이 바뀌거나 지워짐','내보내기 전에 Nerulio 타임라인의 태그 줄 확인','Aseprite나 타임라인에서 태그를 고친 뒤 다시 내보내기'],
    ['한 번만 나와야 할 태그가 반복되거나, 반복돼야 할 태그가 멈춤','반복 ∞는 반복 켬, 횟수를 정한 반복은 반복 끔이 됨','SpriteFrames 패널에서 해당 애니메이션의 반복 토글','태그의 반복 값을 바꾸거나 Godot에서 Loop를 전환. 한 번 재생 태그는 `animation_finished` 사용'],
    ['애니메이션이 바뀔 때 캐릭터가 튐','프레임마다 피벗이 다른데 노드의 오프셋은 하나(첫 프레임 피벗)','내보내기 안내에 피벗 불일치 경고가 뜸. 모든 피벗은 `metadata/nerulio`에 있음','모든 프레임에 같은 피벗 슬라이스를 쓰거나, 내보내기 전에 Nerulio에서 피벗을 맞추기([[game/sprite-pivot-editor|피벗 편집기]])'],
    ['Aseprite보다 빠르거나 느림','노드의 Speed Scale이나 `play()`의 사용자 속도가 1이 아님','인스펙터의 Speed Scale','Speed Scale을 1로 두고 `play()`를 사용자 속도 없이 호출'],
    ['Godot 3에서 .tres가 안 열림','프레임별 길이가 있는 Godot 4 형식 리소스','—','Godot 4를 쓰거나, [[game/aseprite-to-sprite-sheet|PNG 스프라이트 시트]]로 내보내 Godot 3에서 프레임을 직접 구성']]},
   alternatives:{rows:[
    ['Aseprite에서 PNG 시트로 내보내고(File › Export Sprite Sheet) Godot SpriteFrames 패널의 Add Frames from Sprite Sheet 사용','애니메이션이 한두 개이고 프레임 길이가 일정할 때. 파일은 적지만 애니메이션마다 FPS를 직접 정해야 하고 프레임별 길이는 사라집니다. [[game/godot-sprite-sheet|Godot에서 스프라이트 시트 쓰기]] 참고.'],
    ['Godot Asset Library의 .aseprite 가져오기 플러그인','그림을 자주 고치고 저장할 때마다 Godot가 다시 가져오게 하고 싶을 때. 이런 플러그인은 Aseprite 프로그램을 호출하므로 가져오는 모든 컴퓨터에 Aseprite가 설치돼 있어야 합니다.'],
    ['같은 파일을 다른 엔진으로','[[game/aseprite-to-unity|Aseprite를 Unity로]], [[game/aseprite-to-phaser|Aseprite를 Phaser로]].']]},
   limits:['반복 횟수가 2 이상이어도 저장되지 않으며 Godot에서는 한 번 재생됩니다.','레이어는 합쳐져서 들어갑니다. Godot에서 부분별로 움직이려면 부분마다 파일을 따로 내보내세요.','히트·허트 박스는 리소스 메타데이터로만 들어갑니다. `Area2D`와 `CollisionShape2D` 노드는 직접 만드세요.'],
   versions:{body:['검증 실행에서 Godot 4.7.2가 Nerulio 번들을 불러와 애니메이션마다 프레임 수·속도·반복·상대 길이를 다시 읽었고, 모든 프레임을 1배와 4배로 그려 원본과 비교했습니다. .aseprite 읽기는 실제 파일 231개로 확인했으며 Aseprite 1.3.18에서 같은 태그·길이·픽셀로 다시 열렸습니다. 위 단계의 Godot 동작은 Godot 4.7 공식 문서를 따릅니다.'],sources:[...GODOT_DOCS,'[Aseprite 문서: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ja:{
   answer:'`.aseprite`ファイルには、フレームごとのミリ秒単位の長さ、タグ（方向と繰り返し回数を持つ名前付きのフレーム範囲）、レイヤー、スライスが入っています。Godot 4はこのファイルを直接開けず、`AnimatedSprite2D`で`SpriteFrames`リソースを再生します。Nerulioはブラウザでファイルを読み、タグごとに同じタイミングの`SpriteFrames`アニメーションを作り、フレームを1枚のPNGにパックし、すぐ使えるシーンを添えます。フォルダーを`res://`以下にコピーして`.tscn`をシーンに置けば、最初のタグがNearestフィルターで再生されます。Godot 4専用で、4.7.2で確認しています。',
   concept:{title:'.asepriteの中身と、Godotに必要なもの',body:[
    'Asepriteはアニメーションの文書全体を保存します。フレームごとに長さ（ms）があり、タグはフレームの範囲に名前を付けて1つのアニメーションにまとめ（`walk` = 4〜9番）、再生方法も決めます。順方向・逆方向・ピンポン、無限ループか決まった回数かです。レイヤーは絵の部品を分け、スライスはピボット位置やヒットボックスなどの矩形を示します。',
    'Godot 4では、`AnimatedSprite2D`ノードが`SpriteFrames`リソースを読んでフレームアニメーションを再生します。アニメーションごとに名前・毎秒フレーム数（FPS）・ループの有無・フレーム一覧があり、フレームはテクスチャと相対的な長さで構成されます。Godotは1フレームを「相対の長さ ÷（FPS × 速度倍率）」秒表示するため、ミリ秒の値はそのまま写さず換算する必要があります。',
    'Nerulioはすべてのタグを10 FPSで書き出します。1ティックは100ms（Asepriteの既定のフレームの長さ）で、各フレームの相対の長さは「ミリ秒 ÷ 100」です。そのため1つのタグの中で長さがばらばらでも、1フレームずつの表示時間がAsepriteと一致します。'],
    terms:[['タグ','Asepriteで方向（順・逆・ピンポン）と繰り返し回数を持つ、名前付きのフレーム範囲。'],['SpriteFrames','アニメーションの名前・速度（FPS）・ループ・フレームを保存するGodotのリソース。'],['AtlasTexture','大きなテクスチャの矩形領域。書き出したフレームはそれぞれパック済みPNGの1領域を指します。'],['相対の長さ','Godotのフレームごとの倍率。1.0はFPSの1ティック、2.0は2ティック表示されます。']]},
   example:{title:'例：タグが3つある32 × 32のキャラクター',lead:'16フレームとタグ3つを持つ.asepriteを書き出すと、SpriteFramesには次の値が入ります。',lines:[
    'Aseprite                                  Godot 4 SpriteFrames',
    'idle    フレーム0–3    各125 ms     ∞     idle    10 FPS   1.25 × 4                      loop on',
    'walk    フレーム4–9    各100 ms     ∞     walk    10 FPS   1.0 × 6                       loop on',
    'attack  フレーム10–15  100,100,100,100,   attack  10 FPS   1.0, 1.0, 1.0, 1.0,            loop off',
    '                      150, 250 ms   ×1                     1.5, 2.5',
    '',
    '相対の長さ = ms / (1000 / 10 FPS) = ms / 100      125 ms → 1.25    250 ms → 2.5',
    '検算        1.25 / 10 = 0.125秒    2.5 / 10 = 0.250秒   （Asepriteと同じ）'],
    after:'`attack`はAsepriteで1回だけ再生する設定なので、ループはオフになります。再生後は最後のフレームで止まるため、スクリプトでノードの`animation_finished`シグナルを受けて`idle`を再生し直してください。'},
   mapping:{title:'変換後に残るもの',head:['Aseprite','Nerulio','Godot 4'],rows:[
    ['フレームのピクセル（表示中のレイヤー）','合成したフレームをPNG 1ページにパック','そのPNGの`AtlasTexture`領域'],
    ['フレームの長さ（ms）','フレームごとに保持','相対の長さ = ms ÷ 100。アニメーション速度は10 FPS'],
    ['タグ','同じ名前のアニメーション1つ','同じ名前の`SpriteFrames`アニメーション'],
    ['方向：逆方向・ピンポン','再生順を展開して記録（ピンポン：0-1-2-3-2-1）','その順に並んだフレーム'],
    ['繰り返し ∞','ループ','`loop = true`'],
    ['繰り返し 1、2、3…','プレビューではその回数再生','`loop = false`：Godotでは1回再生（回数は保存されない）'],
    ['タグが1つもない','全フレームのアニメーション`default`を1つ','アニメーション`default`'],
    ['ピボット付きのスライス','フレームのピボット（なければ既定値：下中央）','ノードの`offset` = −最初のフレームのピボット、`centered = false`'],
    ['hit / hurt などの名前のスライス','フレームごとのボックス','リソースのメタデータ`nerulio`に保存（ノードは作らない）'],
    ['レイヤー・合成モード・不透明度','Studioでは保持','統合：Godotには合成済みのフレームが入る']],
    note:'Godot 4.7には独自のピンポンループもありますが、書き出しは順序をフレーム単位で直接書くため、その機能には依存しません。'},
   outputs:{rows:[
    ['hero.tres','`SpriteFrames`リソース：アニメーション、FPS、ループ、相対の長さ、`AtlasTexture`領域とトリム余白、ピボット・ボックス・衝突ポリゴン入りのメタデータ`nerulio`。'],
    ['hero.tscn','このリソースを使う`AnimatedSprite2D`を1つ持つシーン：Nearestフィルター、最初のタグを自動再生、ピボットをオフセットに設定。'],
    ['hero.png','パック済みのフレーム（1枚に収まらなければページが増えます）。'],
    ['hero.png.import','Godotが読むインポート設定：可逆、ミップマップなし、Fix Alpha Borderオフ。薄いピクセルの色が変わりません。'],
    ['README-GODOT.md','このバンドル用の以下の手順。']]},
   target:{title:'Godot 4に取り込む',steps:[
    'バンドルを展開し、フォルダーごと`res://`以下の好きな場所にコピーします（例：`res://characters/hero/`）。`.tres`は相対パスでPNGを探すので、ファイルは一緒に置いてください。',
    'ファイルシステムドックのインポートが終わるのを待ちます。同梱の`hero.png.import`の設定で、アトラスは可逆・ミップマップなしで取り込まれます。',
    '`hero.tscn`をシーンにドラッグするか、自分の`AnimatedSprite2D`を選んでSprite Frames属性に`hero.tres`を読み込みます。',
    'ノードのAnimation属性かSpriteFramesパネルでアニメーションを選びます。同梱のシーンは最初のタグを自動再生します。',
    'スクリプトでは`$Hero.play("walk")`で切り替えます。ループしないタグは`animation_finished`をつないで`idle`を再生し直します。',
    '自分で作ったノードには、プロジェクト設定 › Rendering › Textures › Canvas Textures › Default Texture FilterをNearestに一度変えるか、ノードのTexture › FilterをNearestにします。']},
   verify:{steps:[
    'シーンを実行します。100msのフレーム6枚の`walk`は、Asepriteのプレビューと同じく0.6秒ごとに繰り返すはずです。',
    'SpriteFramesパネルを開きます。各アニメーションのフレーム数がタグと同じはずです（ピンポンのタグは展開した順で表示）。',
    '2Dビューポートを400%に拡大します。ピクセルの境界が四角いままなら正常で、ぼやける場合はノードがLinearフィルターです。',
    '`print($Hero.sprite_frames.get_meta("nerulio"))`でフレームごとのピボットとボックスが出るか確認します。']},
   trouble:{rows:[
    ['スプライトがぼやける','ノードがプロジェクト既定のLinearフィルターを継承している','拡大して、ノードのTexture › Filterを確認','ノードのFilterをNearestに、またはプロジェクトのDefault Texture FilterをNearestに'],
    ['薄いピクセル（光・煙）の色が変わる','同梱の`.png.import`ではなく、Godot既定のFix Alpha Borderオンで取り込んだ','PNGのインポートドックでFix Alpha Borderがオン','`hero.png.import`をPNGの隣に置くか、Fix Alpha Borderを切って再インポート'],
    ['タグが1つない','ファイルにタグがなく全部`default`になった、または書き出し前にタグ名を変えた・消した','書き出し前にNerulioのタイムラインのタグ行を確認','Asepriteかタイムラインでタグを直して書き出し直す'],
    ['1回だけのはずのタグがループする／ループのはずが止まる','繰り返し∞はループオン、回数指定はループオフになる','SpriteFramesパネルでそのアニメーションのループ切り替え','タグの繰り返しを変えるか、GodotでLoopを切り替える。1回再生のタグは`animation_finished`を使う'],
    ['アニメーションが切り替わるときにキャラが跳ねる','フレームごとにピボットが違うが、ノードのオフセットは1つ（最初のフレームのピボット）','書き出し時の注意にピボット不一致の警告が出る。全ピボットは`metadata/nerulio`にある','全フレームで同じピボットのスライスを使うか、書き出し前にNerulioでピボットをそろえる（[[game/sprite-pivot-editor|ピボットエディター]]）'],
    ['Asepriteより速い・遅い','ノードのSpeed Scaleや`play()`のカスタム速度が1でない','インスペクターのSpeed Scale','Speed Scaleを1にし、`play()`はカスタム速度なしで呼ぶ'],
    ['Godot 3で.tresが開けない','フレームごとの長さを持つGodot 4形式のリソース','—','Godot 4を使うか、[[game/aseprite-to-sprite-sheet|PNGのスプライトシート]]で書き出してGodot 3で手作業でフレームを組む']]},
   alternatives:{rows:[
    ['AsepriteでPNGシートを書き出し（File › Export Sprite Sheet）、GodotのSpriteFramesパネルでAdd Frames from Sprite Sheetを使う','アニメーションが1〜2個で長さが均一なとき。ファイルは少なくて済みますが、FPSはアニメーションごとに手で設定し、フレームごとの長さは失われます。[[game/godot-sprite-sheet|Godotでスプライトシートを使う]]も参照。'],
    ['Godot Asset Libraryの.asepriteインポートプラグイン','絵を頻繁に直し、保存のたびにGodotに再インポートさせたいとき。こうしたプラグインはAsepriteのプログラムを呼び出すため、取り込むすべてのPCにAsepriteが必要です。'],
    ['同じファイルを別のエンジンで','[[game/aseprite-to-unity|AsepriteをUnityへ]]、[[game/aseprite-to-phaser|AsepriteをPhaserへ]]。']]},
   limits:['2回以上の繰り返し回数は保存されず、Godotでは1回再生になります。','レイヤーは統合されて入ります。Godotで部品ごとに動かすなら、部品ごとに別ファイルで書き出してください。','ヒット・ハートボックスはリソースのメタデータとしてだけ入ります。`Area2D`と`CollisionShape2D`のノードは自分で作ってください。'],
   versions:{body:['検証の実行では、Godot 4.7.2がNerulioのバンドルを読み込み、アニメーションごとのフレーム数・速度・ループ・相対の長さを読み戻し、全フレームを1倍と4倍で描画して元画像と比較しました。.asepriteの読み込みは実在の231ファイルで確認し、Aseprite 1.3.18で同じタグ・長さ・ピクセルのまま開き直せました。上の手順のGodotの動作はGodot 4.7の公式ドキュメントに基づきます。'],sources:[...GODOT_DOCS,'[Asepriteドキュメント：Tags](https://www.aseprite.org/docs/tags/)']}
  }
 },
 // ------------------------------------------------------------------ Godot: sprite sheet
 // Nerulio: src/studio/sprite/import-plan.js (grid decision, rows → row_N, 100 ms default, empty cells skipped),
 // src/game/grid-detect.js, src/game/export/godot.js (AtlasTexture + filter_clip, 10 fps tags, scene), targets.js
 // (Godot preset: trim, 2 px shape padding, no rotation), docs/STUDIO-PACK.md (sp-samurai-godot PASS in Godot 4.7.2).
 'game/godot-sprite-sheet':{
  type:'engine',
  intent:{primary:'use a sprite sheet PNG as an animation in Godot 4',secondary:['work out frame width and height from the sheet','margin (offset) and spacing (separation)','Add Frames from Sprite Sheet in the SpriteFrames panel','AnimatedSprite2D speed, loop and pixel-art filtering','frames drifting, bleeding or jittering'],
   goal:'an AnimatedSprite2D in Godot 4 that plays each row of the sheet as a named animation, sharp and without drifting frames',input:'a sprite sheet PNG (uniform grid, or uneven sprites separated by transparency)',output:'SpriteFrames .tres + repacked PNG + AnimatedSprite2D .tscn + .png.import + README',target:'Godot 4 (verified 4.7.2)',support:'full',
   evidence:['src/studio/sprite/import-plan.js','src/game/grid-detect.js','src/studio/sprite/import-build.js','src/game/export/godot.js','src/game/export/targets.js (Godot preset)','docs/STUDIO-PACK.md (sp-samurai-godot, sp-toon-godot PASS in Godot 4.7.2)','docs/STUDIO-SPRITE.md §10 (16/16 real assets with default choices)'],
   external:['Godot 4.7 docs: 2D sprite animation (Add frames from a Sprite Sheet)','Godot 4.7 editor source: sheet dialog fields','Godot 4.7 docs: AnimatedSprite2D, SpriteFrames, Sprite2D, AtlasTexture, ProjectSettings, Multiple resolutions']},
  en:{
   answer:'A sprite sheet is one PNG that holds many frames in rows and columns. Godot 4 plays it with an `AnimatedSprite2D` whose `SpriteFrames` resource lists one region of the sheet per frame. You can build that resource in Godot with Add Frames from Sprite Sheet (enter the columns and rows, or the frame size, separation and offset), or let Nerulio measure the grid, turn every row into a named animation and export a finished `.tres`, PNG and scene. Frame size is sheet size ÷ columns and rows: 384 × 64 with 6 columns is 64 × 64. Godot 4 only; the bundle was checked in Godot 4.7.2.',
   concept:{title:'Sprite sheets, grids and what Godot needs',body:[
    'A sprite sheet puts the frames of one character on one image, read left to right and top to bottom. Most character sheets use one row per animation (idle, run, attack), so a row is an animation and a column is a moment inside it. With no border and no gaps, one frame is the sheet width ÷ columns wide and the sheet height ÷ rows tall.',
    'Many sheets add a margin around the edge and spacing between frames. Then the sheet width is margin + columns × frame width + (columns − 1) × spacing (plus any right margin), and dividing the whole width by the column count gives a frame that is too wide. Godot\'s sheet dialog calls the margin Offset and the spacing Separation. A uniform sheet has one frame size everywhere; an irregular sheet (sprites of different sizes, or a packed atlas) has no grid at all and needs either atlas data or cutting by sprite outlines.',
    'In Godot 4 an `AnimatedSprite2D` plays a `SpriteFrames` resource: named animations, each with a Speed in frames per second, a loop flag and a list of frames. A frame taken from a sheet is an `AtlasTexture`, a rectangle of the sheet. A plain `Sprite2D` with `hframes` and `vframes` can also show one cell at a time, but it divides the whole texture into equal parts, so it only fits sheets without margin and spacing. Canvas items use Linear filtering by default, which blurs pixel art until you switch to Nearest.',
    'Nerulio measures candidate grids from the pixels (transparent separator lines, the period at which the art repeats, how alike the cells look, how often a cell edge would cut through a sprite) and shows the best one over the sheet with a high, medium or low confidence and its reasons. Nothing is cut until you press Apply. You can pick another candidate, type your own cell size, offset and gap, or cut an uneven sheet by sprite outlines instead. Empty cells are skipped, every row becomes an animation named `row_1`, `row_2` … that you rename on the timeline, and frames start at 100 ms (10 FPS), because a PNG stores no timing.'],
    terms:[['Frame (cell) size','Width × height of one frame in pixels; with no margin or spacing, sheet width ÷ columns by sheet height ÷ rows.'],['Margin / Offset','Empty pixels between the sheet edge and the first frame. Godot\'s dialog: Offset.'],['Spacing / Separation','Empty pixels between neighbouring frames. Godot\'s dialog: Separation.'],['AtlasTexture','A rectangle of a larger texture; every frame of a sheet-based SpriteFrames is one.'],['Speed (FPS)','Frames per second of one SpriteFrames animation; each frame\'s relative duration multiplies one tick.']]},
   example:{title:'Worked example: frame size, margin and spacing',lead:'The same six-frame run cycle, laid out two ways:',lines:[
    'Sheet A  384 × 64 px, 1 row × 6 columns, no margin, no spacing',
    '  frame width  = 384 / 6 = 64      frame height = 64 / 1 = 64      → 64 × 64',
    '  Godot dialog: Horizontal 6, Vertical 1           (Size becomes 64 × 64)',
    '',
    'Sheet B  398 × 68 px, same frames with a 2 px margin and 2 px spacing',
    '  width  = 2 + 6 × 64 + 5 × 2 + 2 = 398           height = 2 + 64 + 2 = 68',
    '  Godot dialog: Size 64 × 64, Separation 2 × 2, Offset 2 × 2',
    '  Horizontal 6 alone gives 398 / 6 = 66 px cells: each column drifts 2 px further',
    '',
    'Nerulio on sheet B: cell 64 × 64, margin 2, spacing 2 (high confidence) → row_1, 6 frames',
    '  Godot bundle: speed 10 FPS, every duration 1.0 (100 ms), loop on → one cycle 0.6 s'],
    after:'Change the frames to 125 ms on Nerulio\'s timeline and the bundle keeps 10 FPS but writes a duration of 1.25 on every frame: 1.25 ÷ 10 = 0.125 s. Godot\'s own dialog gives every frame 1.0, so there you change the Speed instead (8 FPS for 125 ms).'},
   outputs:{lead:'Pack & Export › Godot 4 writes one folder (named after your file; `hero` here):',rows:[
    ['hero.tres','The `SpriteFrames` resource: one animation per row or tag with its speed, loop flag and relative durations; one `AtlasTexture` per frame with `filter_clip` on and a margin that restores trimmed frames to their full cell size.'],
    ['hero.png','The frames repacked into a new PNG (trimmed, 2 px apart, never rotated). Your original sheet is not referenced.'],
    ['hero.tscn','An `AnimatedSprite2D` using the resource: Nearest filtering, autoplay of the first animation, `centered` off and the pivot (bottom centre unless you set one) as `offset`.'],
    ['hero.png.import','Godot import settings: lossless, no mipmaps, Fix Alpha Border off.'],
    ['README-GODOT.md','The import steps for this bundle.']]},
   target:{title:'Put it into Godot 4',steps:[
    'Unzip the bundle and copy the whole folder under `res://`, for example `res://characters/hero/`. Keep the `.tres`, the PNG and its `.png.import` together; the resource finds the PNG by a relative path.',
    'Wait until the FileSystem dock has imported the PNG. Godot reads the shipped `.png.import`, so the texture comes in lossless and without mipmaps.',
    'Drag `hero.tscn` into your scene, or select your own `AnimatedSprite2D` and load `hero.tres` into its Sprite Frames property.',
    'Open the SpriteFrames panel: check each animation\'s name, its Speed (10 FPS unless you changed it) and its loop toggle. Rename the `row_N` animations here if you did not do it in Nerulio.',
    'Switch animations from a script with `$Hero.play("run")`. An animation with loop off stops on its last frame and emits `animation_finished`; play the next one from that signal.',
    'For pixel art, set Project Settings › Rendering › Textures › Canvas Textures › Default Texture Filter to Nearest so your other nodes are sharp too. For a low-resolution game, the Godot docs recommend Display › Window › Stretch › Mode `viewport` with Scale Mode `integer`.'],
    note:['Without Nerulio, Godot 4.7 cuts a uniform sheet itself: select the `AnimatedSprite2D`, choose New SpriteFrames, click Add Frames from Sprite Sheet in the SpriteFrames panel and open the PNG. Set Horizontal and Vertical, or Size, Separation and Offset for a sheet with gaps; Auto Slice guesses the counts but sets separation and offset to 0. Click the frames of one row (Frame Order sets the order), press Add N Frame(s), rename the animation and set its Speed (FPS). Repeat per row. Every frame gets a relative duration of 1.0, and the dialog starts again from 4 × 4 for a sheet of another size.']},
   verify:{steps:[
    'Each animation in the SpriteFrames panel has as many frames as its row has filled cells; a transparent frame at the end means an empty cell was added.',
    'Run the scene: six 100 ms frames repeat every 0.6 s.',
    'Zoom the 2D viewport to 400 %: pixel edges stay square, and no line of a neighbouring frame shows at the border of a frame.',
    'Switch between animations: the feet stay on the same spot. If the character hops, the frames are not aligned on a common pivot.']},
   trouble:{rows:[
    ['Frames slide a little further with every column','The frame size includes the spacing, or the margin and spacing were left at 0','Check that sheet width = offset + columns × size + (columns − 1) × separation','Enter the real Size, Separation and Offset in Godot, or let Nerulio measure them; see [[game/sprite-sheet-frame-size|measuring frame size]]'],
    ['A thin line of the next frame shows at the edge','Texture bleeding: filtering or a sub-pixel position samples pixels just outside the frame, and the frames touch with no spacing','Zoom in while the sprite moves; look for Linear filtering and fractional positions','Use Nearest filtering; keep `filter_clip` on (the bundle sets it; on a `Sprite2D` region it is Region › Filter Clip); give frames padding, see [[game/texture-edge-bleed|edge bleeding]]'],
    ['The sprite is blurry','The node inherits the project default filter, which is Linear','Inspector › CanvasItem › Texture › Filter','Set Nearest on the node or as the project default; see [[game/godot-pixel-art-blurry|blurry pixel art in Godot]]'],
    ['The character wobbles from frame to frame','The art is not placed identically inside each cell, or trimmed frames of different sizes are centred','Onion-skin the frames in Nerulio\'s timeline; compare the feet position','Align the frames before export (the bundle restores trimmed frames to full cell size); see [[game/sprite-jitter-after-trim|jitter after trimming]]'],
    ['The animation plays too fast or too slow','Godot\'s dialog gives every frame 1.0, so the Speed alone sets the timing; or Speed Scale is not 1','SpriteFrames panel: Speed (FPS); Inspector: Speed Scale','Set Speed to 1000 ÷ your frame time in ms (100 ms → 10 FPS), or set per-frame times in Nerulio; see [[game/godot-animation-frame-duration|frame duration in Godot]]'],
    ['Nerulio proposes the wrong grid (for example 48 × 96 instead of 48 × 48)','The art of one frame spans two cells, or the sheet mixes sprite sizes','The Import panel shows the confidence and reasons of each candidate','Pick another candidate, type a custom grid, or cut by sprite outlines. Nerulio cannot separate frames whose pixels overlap each other; draw those boxes by hand']]},
   alternatives:{rows:[
    ['Godot\'s Add Frames from Sprite Sheet (manual route above)','A uniform sheet with one or two animations at an even frame rate: no extra files, no export step.'],
    ['`Sprite2D` with `hframes` / `vframes` and an `AnimationPlayer` keying `frame`','You already animate other properties with an AnimationPlayer; works only when the sheet has no margin and no spacing.'],
    ['The .aseprite file instead of its PNG','Tags and per-frame timing come along: [[game/aseprite-to-godot|Aseprite to Godot]].'],
    ['A packed atlas with its JSON','Frames of different sizes already packed by another tool: [[game/texturepacker-to-godot|TexturePacker to Godot]].']]},
   limits:['The bundle targets Godot 4 only; Godot 3 cannot read the resource.','Nerulio repacks the frames into its own PNG, so later edits to your original sheet need a new export.','Hitboxes stay in the resource metadata; the export creates no collision nodes.'],
   versions:{body:['Nerulio\'s Godot bundle was loaded by Godot 4.7.2 in the verification runs, including a 288 × 480 samurai sheet cut into 48 × 48 cells (60 frames in 10 row animations) and a Kenney character sheet; every frame was drawn at 1× and compared with the source, and the shipped scene was drawn sharp at 4×. With the default choices the importer cut 16 of 16 real test assets correctly. The Godot sheet-dialog labels come from the Godot 4.7 editor source; everything else about Godot follows the Godot 4.7 documentation.'],sources:[...GODOT_DOCS,...GODOT_SHEET,...GODOT_PIXEL]}
  },
  ko:{
   answer:'스프라이트 시트는 여러 프레임을 행과 열로 늘어놓은 PNG 한 장입니다. Godot 4에서는 `AnimatedSprite2D`가 `SpriteFrames` 리소스로 재생하며, 이 리소스에 프레임마다 시트의 한 영역이 들어갑니다. Godot의 Add Frames from Sprite Sheet로 직접 만들 수도 있고(열·행 수, 또는 프레임 크기·Separation·Offset 입력), Nerulio가 격자를 재고 행마다 이름 있는 애니메이션을 만들어 `.tres`, PNG, 씬으로 내보내게 할 수도 있습니다. 프레임 크기는 시트 크기 ÷ 열·행 수이며, 384 × 64를 6열로 나누면 64 × 64입니다. Godot 4 전용이고 번들은 Godot 4.7.2에서 확인했습니다.',
   concept:{title:'스프라이트 시트와 격자, 그리고 Godot가 필요로 하는 것',body:[
    '스프라이트 시트는 한 캐릭터의 프레임을 이미지 한 장에 모아 둔 것으로, 왼쪽에서 오른쪽, 위에서 아래로 읽습니다. 캐릭터 시트는 대개 행 하나가 애니메이션 하나(대기, 달리기, 공격)이고, 열은 그 안의 한 순간입니다. 테두리와 틈이 없으면 프레임 너비는 시트 너비 ÷ 열 수, 높이는 시트 높이 ÷ 행 수입니다.',
    '가장자리 여백과 프레임 사이 간격이 있는 시트도 많습니다. 이때 시트 너비는 여백 + 열 수 × 프레임 너비 + (열 수 − 1) × 간격(오른쪽 여백이 있으면 더해서)이므로, 전체 너비를 열 수로 나누면 프레임이 너무 넓게 잡힙니다. Godot의 시트 대화상자는 여백을 Offset, 간격을 Separation이라고 부릅니다. 균일한 시트는 어디서나 프레임 크기가 같고, 불규칙한 시트(크기가 제각각인 스프라이트나 패킹된 아틀라스)는 격자가 없어서 아틀라스 데이터나 스프라이트 윤곽 기준 자르기가 필요합니다.',
    'Godot 4에서 `AnimatedSprite2D`는 `SpriteFrames` 리소스를 재생합니다. 이름 있는 애니메이션마다 초당 프레임 수(Speed), 반복 여부, 프레임 목록이 있고, 시트에서 가져온 프레임 하나는 시트의 사각 영역인 `AtlasTexture`입니다. `hframes`·`vframes`를 쓴 일반 `Sprite2D`도 칸을 하나씩 보여 줄 수 있지만 텍스처 전체를 똑같이 나누기 때문에 여백과 간격이 없는 시트에만 맞습니다. 캔버스 아이템의 기본 필터는 Linear라서 Nearest로 바꾸기 전까지 픽셀아트가 흐리게 보입니다.',
    'Nerulio는 픽셀에서 후보 격자를 잽니다. 투명한 구분선, 그림이 반복되는 주기, 칸끼리 얼마나 닮았는지, 칸 경계가 스프라이트를 얼마나 자주 가르는지를 보고, 가장 나은 격자를 시트 위에 높음·보통·낮음 신뢰도와 근거와 함께 그립니다. 적용을 누르기 전에는 아무것도 자르지 않습니다. 다른 후보를 고르거나, 칸 크기·오프셋·간격을 직접 넣거나, 크기가 제각각인 시트는 스프라이트 윤곽으로 자를 수 있습니다. 빈 칸은 건너뛰고, 행마다 `row_1`, `row_2` … 애니메이션이 생기며 타임라인에서 이름을 바꿉니다. PNG에는 시간 정보가 없으므로 프레임은 100ms(10 FPS)로 시작합니다.'],
    terms:[['프레임(칸) 크기','프레임 하나의 너비 × 높이(픽셀). 여백·간격이 없으면 시트 너비 ÷ 열 수 × 시트 높이 ÷ 행 수.'],['여백 / Offset','시트 가장자리와 첫 프레임 사이의 빈 픽셀. Godot 대화상자의 Offset.'],['간격 / Separation','이웃한 프레임 사이의 빈 픽셀. Godot 대화상자의 Separation.'],['AtlasTexture','큰 텍스처의 사각 영역. 시트로 만든 SpriteFrames의 프레임 하나하나가 이것입니다.'],['Speed (FPS)','SpriteFrames 애니메이션 하나의 초당 프레임 수. 각 프레임의 상대 길이가 한 틱에 곱해집니다.']]},
   example:{title:'예시: 프레임 크기, 여백, 간격 계산',lead:'같은 6프레임 달리기 동작을 두 가지로 배치했습니다.',lines:[
    '시트 A  384 × 64 px, 1행 × 6열, 여백 없음, 간격 없음',
    '  프레임 너비 = 384 / 6 = 64      프레임 높이 = 64 / 1 = 64      → 64 × 64',
    '  Godot 대화상자: Horizontal 6, Vertical 1       (Size가 64 × 64로 바뀜)',
    '',
    '시트 B  398 × 68 px, 같은 프레임에 여백 2 px, 간격 2 px',
    '  너비 = 2 + 6 × 64 + 5 × 2 + 2 = 398            높이 = 2 + 64 + 2 = 68',
    '  Godot 대화상자: Size 64 × 64, Separation 2 × 2, Offset 2 × 2',
    '  Horizontal 6만 넣으면 398 / 6 = 66 px 칸: 열마다 2 px씩 더 밀림',
    '',
    'Nerulio로 시트 B: 칸 64 × 64, 여백 2, 간격 2(신뢰도 높음) → row_1, 6프레임',
    '  Godot 번들: speed 10 FPS, 모든 duration 1.0(100 ms), loop on → 한 바퀴 0.6초'],
    after:'Nerulio 타임라인에서 프레임을 125ms로 바꾸면 번들은 10 FPS를 유지한 채 모든 프레임에 duration 1.25를 씁니다. 1.25 ÷ 10 = 0.125초입니다. Godot 자체 대화상자는 모든 프레임을 1.0으로 넣으므로, 그쪽에서는 Speed를 바꿉니다(125ms면 8 FPS).'},
   outputs:{lead:'패킹·내보내기 › Godot 4는 폴더 하나를 씁니다(파일 이름을 따르며 여기서는 `hero`).',rows:[
    ['hero.tres','`SpriteFrames` 리소스: 행이나 태그마다 애니메이션 하나(속도, 반복, 상대 길이), 프레임마다 `filter_clip`을 켠 `AtlasTexture` 하나와 트림된 프레임을 원래 칸 크기로 되돌리는 margin.'],
    ['hero.png','프레임을 새 PNG로 다시 패킹(트림, 2px 간격, 회전 없음). 원래 시트는 참조하지 않습니다.'],
    ['hero.tscn','이 리소스를 쓰는 `AnimatedSprite2D`: Nearest 필터, 첫 애니메이션 자동 재생, `centered` 끔, 피벗(따로 정하지 않으면 하단 중앙)을 `offset`으로.'],
    ['hero.png.import','Godot 가져오기 설정: 무손실, 밉맵 없음, Fix Alpha Border 끔.'],
    ['README-GODOT.md','이 번들의 가져오기 순서.']]},
   target:{title:'Godot 4에 넣기',steps:[
    '번들 압축을 풀고 폴더째 `res://` 아래(예: `res://characters/hero/`)에 복사합니다. `.tres`, PNG, `.png.import`는 함께 두세요. 리소스가 상대 경로로 PNG를 찾습니다.',
    '파일시스템 독이 PNG 가져오기를 끝낼 때까지 기다립니다. 함께 온 `.png.import`대로 무손실·밉맵 없이 들어옵니다.',
    '`hero.tscn`을 씬에 끌어다 놓거나, 직접 만든 `AnimatedSprite2D`를 골라 Sprite Frames 속성에 `hero.tres`를 넣습니다.',
    'SpriteFrames 패널을 열어 애니메이션마다 이름, Speed(바꾸지 않았다면 10 FPS), 반복 토글을 확인합니다. Nerulio에서 이름을 안 바꿨다면 `row_N`을 여기서 바꿉니다.',
    '스크립트에서는 `$Hero.play("run")`으로 바꿉니다. 반복이 꺼진 애니메이션은 마지막 프레임에 멈추고 `animation_finished`를 보내므로, 그 시그널에서 다음 애니메이션을 재생합니다.',
    '픽셀아트라면 프로젝트 설정 › Rendering › Textures › Canvas Textures › Default Texture Filter를 Nearest로 해서 다른 노드도 선명하게 합니다. 저해상도 게임에는 Godot 문서가 Display › Window › Stretch › Mode `viewport`와 Scale Mode `integer`를 권합니다.'],
    note:['Nerulio 없이도 Godot 4.7은 균일한 시트를 직접 자릅니다. `AnimatedSprite2D`를 고르고 New SpriteFrames를 만든 뒤, SpriteFrames 패널의 Add Frames from Sprite Sheet를 눌러 PNG를 엽니다. Horizontal·Vertical을 넣거나, 틈이 있는 시트라면 Size·Separation·Offset을 넣습니다. Auto Slice는 개수를 추측하지만 Separation과 Offset은 0으로 둡니다. 한 행의 프레임을 클릭하고(순서는 Frame Order), Add N Frame(s)를 누른 다음 애니메이션 이름과 Speed(FPS)를 정합니다. 행마다 반복합니다. 모든 프레임의 상대 길이는 1.0이고, 크기가 다른 시트를 열면 대화상자는 다시 4 × 4에서 시작합니다.']},
   verify:{steps:[
    'SpriteFrames 패널에서 애니메이션마다 프레임 수가 그 행의 채워진 칸 수와 같아야 합니다. 끝에 투명한 프레임이 있다면 빈 칸이 들어간 것입니다.',
    '씬을 실행합니다. 100ms 프레임 6개면 0.6초마다 반복됩니다.',
    '2D 뷰포트를 400%로 확대합니다. 픽셀 경계가 네모나고, 프레임 가장자리에 옆 프레임의 선이 보이지 않아야 합니다.',
    '애니메이션을 바꿔 봅니다. 발이 같은 자리에 있어야 하며, 캐릭터가 튀면 프레임이 공통 피벗에 맞춰져 있지 않은 것입니다.']},
   trouble:{rows:[
    ['열이 넘어갈수록 프레임이 조금씩 더 밀림','프레임 크기에 간격이 포함됐거나, 여백과 간격을 0으로 둠','시트 너비 = 오프셋 + 열 수 × 크기 + (열 수 − 1) × 간격인지 계산','Godot에 실제 Size·Separation·Offset을 넣거나 Nerulio로 재기. [[game/sprite-sheet-frame-size|프레임 크기 재기]] 참고'],
    ['프레임 가장자리에 옆 프레임이 가는 선으로 보임','텍스처 번짐: 필터링이나 소수점 위치 때문에 프레임 바로 바깥 픽셀을 읽고, 프레임 사이에 간격이 없음','움직이는 중에 확대해 보고 Linear 필터와 소수점 좌표를 확인','Nearest 필터 사용, `filter_clip` 유지(번들은 켜 둠, `Sprite2D` 영역이라면 Region › Filter Clip), 프레임 사이 여백 두기. [[game/texture-edge-bleed|가장자리 번짐]] 참고'],
    ['스프라이트가 흐림','노드가 프로젝트 기본 필터(Linear)를 물려받음','인스펙터 › CanvasItem › Texture › Filter','노드나 프로젝트 기본값을 Nearest로. [[game/godot-pixel-art-blurry|Godot 픽셀아트 흐림]] 참고'],
    ['프레임마다 캐릭터가 흔들림','칸 안에서 그림 위치가 제각각이거나, 크기가 다른 트림 프레임을 가운데 정렬함','Nerulio 타임라인의 어니언 스킨으로 발 위치 비교','내보내기 전에 프레임 정렬(번들은 트림 프레임을 칸 크기로 되돌림). [[game/sprite-jitter-after-trim|트림 후 흔들림]] 참고'],
    ['애니메이션이 너무 빠르거나 느림','Godot 대화상자는 모든 프레임을 1.0으로 넣어 Speed만으로 시간이 정해짐. 또는 Speed Scale이 1이 아님','SpriteFrames 패널의 Speed(FPS), 인스펙터의 Speed Scale','Speed를 1000 ÷ 프레임 시간(ms)으로(100ms면 10 FPS), 또는 Nerulio에서 프레임별 시간 지정. [[game/godot-animation-frame-duration|Godot 프레임 시간]] 참고'],
    ['Nerulio가 격자를 잘못 제안함(예: 48 × 48 대신 48 × 96)','한 프레임의 그림이 두 칸에 걸치거나, 시트에 크기가 다른 스프라이트가 섞임','가져오기 패널에 후보마다 신뢰도와 근거가 나옴','다른 후보, 사용자 격자, 윤곽 기준 자르기 중 선택. 픽셀이 서로 겹친 프레임은 Nerulio도 나눌 수 없으니 상자를 직접 그리세요']]},
   alternatives:{rows:[
    ['Godot의 Add Frames from Sprite Sheet(위의 수동 방법)','균일한 시트에 애니메이션이 한두 개이고 프레임 속도가 일정할 때. 파일도 내보내기 단계도 늘지 않습니다.'],
    ['`hframes`·`vframes`를 쓴 `Sprite2D`와 `frame`을 키로 잡는 `AnimationPlayer`','이미 AnimationPlayer로 다른 속성도 움직이고 있을 때. 여백과 간격이 없는 시트에서만 맞습니다.'],
    ['PNG 대신 원본 .aseprite 파일','태그와 프레임별 시간까지 옮겨집니다: [[game/aseprite-to-godot|Aseprite를 Godot로]].'],
    ['JSON이 딸린 패킹 아틀라스','다른 도구로 이미 패킹한 크기 제각각의 프레임: [[game/texturepacker-to-godot|TexturePacker를 Godot로]].']]},
   limits:['번들은 Godot 4 전용이며 Godot 3는 이 리소스를 읽지 못합니다.','Nerulio는 프레임을 자체 PNG로 다시 패킹하므로, 원래 시트를 고치면 다시 내보내야 합니다.','히트박스는 리소스 메타데이터에만 들어가며 충돌 노드는 만들지 않습니다.'],
   versions:{body:['검증 실행에서 Godot 4.7.2가 Nerulio의 Godot 번들을 불러왔습니다. 48 × 48 칸으로 자른 288 × 480 사무라이 시트(행 애니메이션 10개, 60프레임)와 Kenney 캐릭터 시트를 포함해, 모든 프레임을 1배로 그려 원본과 비교했고 함께 온 씬을 4배로 그려 선명함을 확인했습니다. 기본 선택만으로 실제 테스트 에셋 16개 중 16개를 올바르게 잘랐습니다. Godot 시트 대화상자의 항목 이름은 Godot 4.7 편집기 소스에서, 나머지 Godot 동작은 Godot 4.7 공식 문서에서 확인했습니다.'],sources:[...GODOT_DOCS,...GODOT_SHEET,...GODOT_PIXEL]}
  },
  ja:{
   answer:'スプライトシートは、たくさんのフレームを行と列に並べた1枚のPNGです。Godot 4では`AnimatedSprite2D`が`SpriteFrames`リソースで再生し、そのリソースにはフレームごとにシートの1領域が入ります。GodotのAdd Frames from Sprite Sheetで自分で作る（列数・行数、またはフレームサイズ・Separation・Offsetを入力）こともできますし、Nerulioにグリッドを測らせ、行ごとに名前付きアニメーションを作って`.tres`・PNG・シーンで書き出すこともできます。フレームサイズはシートの大きさ ÷ 列数・行数で、384 × 64を6列なら64 × 64です。Godot 4専用で、バンドルはGodot 4.7.2で確認しています。',
   concept:{title:'スプライトシートとグリッド、Godotに必要なもの',body:[
    'スプライトシートは1キャラクターのフレームを1枚の画像にまとめたもので、左から右、上から下へ読みます。キャラクターのシートは多くの場合1行が1アニメーション（待機・走り・攻撃）で、列はその中の一瞬です。縁も隙間もなければ、フレームの幅はシートの幅 ÷ 列数、高さはシートの高さ ÷ 行数です。',
    '外周の余白やフレーム間の間隔があるシートも少なくありません。その場合シートの幅は「余白 + 列数 × フレーム幅 +（列数 − 1）× 間隔」（右の余白があれば加算）になり、全体の幅を列数で割るとフレームが広すぎます。Godotのシート用ダイアログでは余白をOffset、間隔をSeparationと呼びます。均一なシートはどこでもフレームサイズが同じで、不規則なシート（大きさがばらばらのスプライトやパック済みアトラス）にはグリッドがないため、アトラスのデータかスプライトの輪郭での切り出しが必要です。',
    'Godot 4では`AnimatedSprite2D`が`SpriteFrames`リソースを再生します。名前付きアニメーションごとに毎秒フレーム数（Speed）・ループ・フレーム一覧があり、シートから取ったフレームはシートの矩形領域である`AtlasTexture`です。`hframes`・`vframes`を使う普通の`Sprite2D`でも1コマずつ表示できますが、テクスチャ全体を均等に割るだけなので、余白も間隔もないシートにしか合いません。キャンバスアイテムの既定のフィルターはLinearなので、Nearestに変えるまでドット絵はぼやけます。',
    'Nerulioはピクセルから候補のグリッドを測ります。透明な区切り線、絵が繰り返す周期、セル同士の似かた、セルの境界がスプライトを横切る回数を調べ、最有力のグリッドを高・中・低の信頼度と根拠つきでシートに重ねて表示します。「適用」を押すまで何も切りません。別の候補を選ぶ、セルサイズ・オフセット・間隔を手入力する、大きさがばらばらのシートなら輪郭で切る、のいずれもできます。空のセルは飛ばし、行ごとに`row_1`、`row_2` …のアニメーションができ、名前はタイムラインで変えます。PNGには時間の情報がないため、フレームは100ms（10 FPS）から始まります。'],
    terms:[['フレーム（セル）サイズ','1フレームの幅 × 高さ（ピクセル）。余白・間隔がなければ、シートの幅 ÷ 列数 × シートの高さ ÷ 行数。'],['余白 / Offset','シートの端と最初のフレームの間の空きピクセル。GodotのダイアログではOffset。'],['間隔 / Separation','隣り合うフレームの間の空きピクセル。GodotのダイアログではSeparation。'],['AtlasTexture','大きなテクスチャの矩形領域。シートから作ったSpriteFramesのフレームは1つずつこれです。'],['Speed（FPS）','SpriteFramesのアニメーション1つの毎秒フレーム数。各フレームの相対の長さが1ティックに掛かります。']]},
   example:{title:'例：フレームサイズ・余白・間隔の計算',lead:'同じ6コマの走りを2通りに並べた場合です。',lines:[
    'シートA  384 × 64 px、1行 × 6列、余白なし、間隔なし',
    '  フレーム幅 = 384 / 6 = 64      フレーム高さ = 64 / 1 = 64      → 64 × 64',
    '  Godotのダイアログ：Horizontal 6、Vertical 1      （Sizeが64 × 64になる）',
    '',
    'シートB  398 × 68 px、同じフレームに余白2 px・間隔2 px',
    '  幅 = 2 + 6 × 64 + 5 × 2 + 2 = 398              高さ = 2 + 64 + 2 = 68',
    '  Godotのダイアログ：Size 64 × 64、Separation 2 × 2、Offset 2 × 2',
    '  Horizontal 6だけだと398 / 6 = 66 pxのセル：列ごとに2 pxずつずれる',
    '',
    'NerulioでシートB：セル64 × 64、余白2、間隔2（信頼度：高）→ row_1、6フレーム',
    '  Godotバンドル：speed 10 FPS、durationはすべて1.0（100 ms）、loop on → 1周0.6秒'],
    after:'Nerulioのタイムラインでフレームを125msにすると、バンドルは10 FPSのまま全フレームのdurationを1.25にします。1.25 ÷ 10 = 0.125秒です。Godot自体のダイアログは全フレームを1.0で追加するので、そちらではSpeedを変えます（125msなら8 FPS）。'},
   outputs:{lead:'パック＆書き出し › Godot 4は1つのフォルダーを書き出します（ファイル名に由来し、ここでは`hero`）。',rows:[
    ['hero.tres','`SpriteFrames`リソース：行またはタグごとにアニメーション1つ（速度・ループ・相対の長さ）、フレームごとに`filter_clip`オンの`AtlasTexture`と、トリムしたフレームを元のセルの大きさに戻すmargin。'],
    ['hero.png','フレームを新しいPNGにパックし直したもの（トリム、2px間隔、回転なし）。元のシートは参照しません。'],
    ['hero.tscn','このリソースを使う`AnimatedSprite2D`：Nearestフィルター、最初のアニメーションを自動再生、`centered`オフ、ピボット（指定しなければ下中央）を`offset`に。'],
    ['hero.png.import','Godotのインポート設定：可逆、ミップマップなし、Fix Alpha Borderオフ。'],
    ['README-GODOT.md','このバンドルの取り込み手順。']]},
   target:{title:'Godot 4に取り込む',steps:[
    'バンドルを展開し、フォルダーごと`res://`以下（例：`res://characters/hero/`）にコピーします。`.tres`・PNG・`.png.import`は一緒に置いてください。リソースは相対パスでPNGを探します。',
    'ファイルシステムドックがPNGを取り込み終えるまで待ちます。同梱の`.png.import`により、可逆・ミップマップなしで取り込まれます。',
    '`hero.tscn`をシーンにドラッグするか、自分の`AnimatedSprite2D`を選んでSprite Framesプロパティに`hero.tres`を読み込みます。',
    'SpriteFramesパネルでアニメーションごとに名前、Speed（変えていなければ10 FPS）、ループの切り替えを確認します。Nerulioで名前を付けていなければ`row_N`をここで変えます。',
    'スクリプトでは`$Hero.play("run")`で切り替えます。ループがオフのアニメーションは最後のフレームで止まって`animation_finished`を出すので、そのシグナルで次のアニメーションを再生します。',
    'ドット絵ならプロジェクト設定 › Rendering › Textures › Canvas Textures › Default Texture FilterをNearestにして、ほかのノードもくっきりさせます。低解像度のゲームには、Godotのドキュメントが Display › Window › Stretch › Mode `viewport` と Scale Mode `integer` を勧めています。'],
    note:['Nerulioを使わなくても、Godot 4.7は均一なシートを自分で切れます。`AnimatedSprite2D`を選んでNew SpriteFramesを作り、SpriteFramesパネルのAdd Frames from Sprite SheetでPNGを開きます。HorizontalとVerticalを入れるか、隙間のあるシートならSize・Separation・Offsetを入れます。Auto Sliceは個数を推測しますが、SeparationとOffsetは0になります。1行分のフレームをクリックし（順序はFrame Order）、Add N Frame(s)を押して、アニメーション名とSpeed（FPS）を決めます。行ごとに繰り返します。全フレームの相対の長さは1.0で、大きさの違うシートを開くとダイアログは4 × 4からやり直しになります。']},
   verify:{steps:[
    'SpriteFramesパネルで、各アニメーションのフレーム数がその行の埋まったセルの数と同じはずです。最後に透明なフレームがあれば、空のセルが入っています。',
    'シーンを実行します。100msのフレーム6枚なら0.6秒ごとに繰り返します。',
    '2Dビューポートを400%に拡大します。ピクセルの境界が四角く、フレームの縁に隣のフレームの線が出ていなければ正常です。',
    'アニメーションを切り替えます。足の位置が動かないはずで、キャラクターが跳ねるならフレームが共通のピボットにそろっていません。']},
   trouble:{rows:[
    ['列が進むほどフレームが少しずつずれる','フレームサイズに間隔が含まれている、または余白と間隔を0のままにした','シートの幅 = オフセット + 列数 × サイズ +（列数 − 1）× 間隔 になるか計算','Godotに実際のSize・Separation・Offsetを入れるか、Nerulioで測る。[[game/sprite-sheet-frame-size|フレームサイズの測り方]]を参照'],
    ['フレームの縁に隣のフレームが細い線で見える','テクスチャのにじみ：フィルタリングや小数座標でフレームのすぐ外のピクセルを読み、フレーム同士に間隔がない','動かしながら拡大し、Linearフィルターと小数座標を確認','Nearestフィルターにし、`filter_clip`を保つ（バンドルはオン、`Sprite2D`の領域ならRegion › Filter Clip）。フレーム間に余白を取る。[[game/texture-edge-bleed|縁のにじみ]]を参照'],
    ['スプライトがぼやける','ノードがプロジェクト既定のフィルター（Linear）を継承している','インスペクター › CanvasItem › Texture › Filter','ノードかプロジェクトの既定値をNearestに。[[game/godot-pixel-art-blurry|Godotのドット絵のぼやけ]]を参照'],
    ['フレームごとにキャラクターが揺れる','セル内の絵の位置がばらばら、または大きさの違うトリム済みフレームを中央ぞろえしている','Nerulioのタイムラインのオニオンスキンで足の位置を比べる','書き出す前にフレームをそろえる（バンドルはトリムしたフレームをセルの大きさに戻す）。[[game/sprite-jitter-after-trim|トリム後の揺れ]]を参照'],
    ['アニメーションが速すぎる・遅すぎる','Godotのダイアログは全フレームを1.0で追加するので、時間はSpeedだけで決まる。またはSpeed Scaleが1でない','SpriteFramesパネルのSpeed（FPS）、インスペクターのSpeed Scale','Speedを「1000 ÷ フレーム時間（ms）」に（100msなら10 FPS）、またはNerulioでフレームごとの時間を指定。[[game/godot-animation-frame-duration|Godotのフレーム時間]]を参照'],
    ['Nerulioが間違ったグリッドを提案する（例：48 × 48ではなく48 × 96）','1フレームの絵が2セルにまたがっている、またはシートに大きさの違うスプライトが混ざっている','読み込みパネルに候補ごとの信頼度と根拠が出る','別の候補、カスタムグリッド、輪郭での切り出しから選ぶ。ピクセルが互いに重なったフレームはNerulioでも分けられないので、枠を手で描く']]},
   alternatives:{rows:[
    ['GodotのAdd Frames from Sprite Sheet（上の手作業の方法）','均一なシートでアニメーションが1〜2個、フレームレートが一定のとき。ファイルも書き出しの手間も増えません。'],
    ['`hframes`・`vframes`を使う`Sprite2D`と、`frame`をキーにする`AnimationPlayer`','すでにAnimationPlayerでほかのプロパティも動かしているとき。余白も間隔もないシートでだけ合います。'],
    ['PNGではなく元の.asepriteファイル','タグとフレームごとの時間も移せます：[[game/aseprite-to-godot|AsepriteをGodotへ]]。'],
    ['JSON付きのパック済みアトラス','別のツールでパック済みの、大きさがばらばらのフレーム：[[game/texturepacker-to-godot|TexturePackerをGodotへ]]。']]},
   limits:['バンドルはGodot 4専用で、Godot 3はこのリソースを読めません。','Nerulioはフレームを独自のPNGにパックし直すので、元のシートを直したら書き出し直しが必要です。','ヒットボックスはリソースのメタデータにだけ入り、当たり判定のノードは作りません。'],
   versions:{body:['検証の実行では、Godot 4.7.2がNerulioのGodotバンドルを読み込みました。48 × 48のセルに切った288 × 480のサムライのシート（行アニメーション10個・60フレーム）とKenneyのキャラクターシートを含め、全フレームを1倍で描いて元画像と比べ、同梱のシーンを4倍で描いてくっきり表示されることを確かめています。既定の選択だけで、実在のテスト素材16件中16件を正しく切り出しました。Godotのシート用ダイアログの項目名はGodot 4.7のエディターのソースで、ほかのGodotの動作はGodot 4.7の公式ドキュメントで確認しました。'],sources:[...GODOT_DOCS,...GODOT_SHEET,...GODOT_PIXEL]}
  }
 },
 // ------------------------------------------------------------------ Godot: frame duration
 // Nerulio: src/game/export/godot.js (duration = ms ÷ (1000 ÷ fps), 6 decimals, loop = repeat 0), import-build.js
 // (tags at 10 fps), project-model.js (implicit animation 12 fps), model.js playbackOrder (ping-pong ends once),
 // import-plan.js delayDecision (GIF delays ≤ 10 ms). Godot: SpriteFrames.get_frame_duration formula (4.7 class ref).
 'game/godot-animation-frame-duration':{
  type:'engine',
  intent:{primary:'set per-frame durations of a Godot 4 AnimatedSprite2D in milliseconds',secondary:['what the relative frame duration means','convert GIF or Aseprite milliseconds to SpriteFrames','speed_scale, loop and animation_finished'],
   goal:'every frame of a SpriteFrames animation shows for the milliseconds the artist intended',input:'frame times in ms (GIF delays, Aseprite durations, typed values)',output:'SpriteFrames .tres with speed and relative durations + .tscn',target:'Godot 4 (verified 4.7.2)',support:'full',
   evidence:['src/game/export/godot.js','src/studio/sprite/import-build.js (tag fps 10)','src/game/export/project-model.js (implicit animation 12 fps)','src/game/model.js playbackOrder','src/studio/sprite/import-plan.js delayDecision','docs/STUDIO-PACK.md (Godot 4.7.2: speed, loop, relative durations read back)'],
   external:['Godot 4.7 class reference: SpriteFrames.get_frame_duration formula, set_animation_speed, LOOP_PINGPONG','AnimatedSprite2D: speed_scale, get_playing_speed, animation_finished','Godot 4.7 editor source: Frame Duration field']},
  en:{
   answer:'In Godot 4 a `SpriteFrames` frame has no time in milliseconds. Its duration is a relative number (1.0 by default), and the animation\'s Speed in FPS turns it into seconds: seconds = duration ÷ (FPS × playing speed). 250 ms is therefore 2.5 at 10 FPS and 3.0 at 12 FPS. To keep uneven timing from a GIF or an .aseprite file, give each frame ms ÷ (1000 ÷ FPS). Nerulio\'s Godot 4 export does that for every frame; its tags are written at 10 FPS, so the duration is simply ms ÷ 100. Godot 4 only; checked in 4.7.2.',
   concept:{title:'How Godot 4 times a frame',body:[
    'Each `SpriteFrames` animation has a Speed in frames per second, and each frame has a relative duration. The Godot 4.7 class reference gives the rule: absolute duration = relative duration ÷ (animation FPS × |playing speed|), where the playing speed is the node\'s `speed_scale` times the `custom_speed` you pass to `play()`. At 10 FPS one tick is 100 ms, so 1.0 lasts 100 ms and 2.5 lasts 250 ms.',
    'Because durations are ratios, changing Speed retimes the whole animation and keeps the rhythm: at 20 FPS every frame lasts half as long. Frames added by dragging images or with Add Frames from Sprite Sheet all get 1.0, so an animation built that way has one frame time for every frame; uneven timing has to be typed into each frame\'s Frame Duration field in the SpriteFrames panel, or set with `add_frame(anim, texture, duration)` or `set_frame()` in code.',
    'Loop is a flag per animation, not a count. A looping animation never emits `animation_finished` (use `animation_looped`); a non-looping one stops on its last frame and emits it. Godot 4.7 also has a ping-pong loop mode that plays the end frames once at each turn.',
    'Nerulio keeps every frame in milliseconds (GIF and APNG delays, Aseprite durations, or values typed on the timeline) and converts only when it writes the `.tres`. Tags are written at 10 FPS; a project without tags gets one implicit animation at 12 FPS. Reverse and ping-pong are written out as frame order (ping-pong without doubled end frames, like Godot\'s own mode), repeat ∞ becomes loop on and any finite repeat becomes loop off.'],
    terms:[['Speed (FPS)','An animation\'s ticks per second; 1000 ÷ FPS is the length of one tick in ms.'],['Relative duration','A frame\'s length in ticks (default 1.0). Shown as Frame Duration in the SpriteFrames panel.'],['Playing speed','`speed_scale` × the `custom_speed` of `play()`; it divides every frame\'s time.'],['Loop','On: the animation repeats and never emits animation_finished. Off: it plays once and stops.']]},
   example:{title:'Worked example: a GIF with uneven delays',lead:'A six-frame walk exported as a GIF, as Nerulio writes it for Godot and how to read it back:',lines:[
    'GIF "walk": 6 frames, delays 80, 80, 80, 160, 80, 240 ms   (one cycle 720 ms)',
    'Nerulio → Godot: speed 10 FPS, one tick = 1000 / 10 = 100 ms',
    '  durations = 80/100 … = 0.8, 0.8, 0.8, 1.6, 0.8, 2.4',
    '',
    'Back to seconds: duration / (FPS × playing speed)',
    '  2.4 / (10 × 1) = 0.24 s        with speed_scale 2: 2.4 / (10 × 2) = 0.12 s',
    '  cycle: (0.8 × 4 + 1.6 + 2.4) / 10 = 0.72 s = 720 ms',
    '',
    'The same timing typed by hand at 12 FPS (tick 83.33 ms):',
    '  80 → 0.96    160 → 1.92    240 → 2.88'],
    after:'Both versions play identically; only the numbers in the resource differ. If you later set the Speed to 20 FPS, every frame halves and the cycle becomes 360 ms.'},
   outputs:{lead:'The timing lives in two files of the Godot 4 bundle:',rows:[
    ['hero.tres','Per animation: `speed` (10.0 for tags), `loop`, and one `duration` per frame with up to six decimals.'],
    ['hero.tscn','An `AnimatedSprite2D` that autoplays the first animation at `speed_scale` 1.']]},
   target:{title:'Check and change the timing in Godot 4',steps:[
    'Load `hero.tres` into an `AnimatedSprite2D`\'s Sprite Frames property, or open `hero.tscn`.',
    'In the SpriteFrames panel select the animation: its Speed shows 10 FPS. Select the long frame: its Frame Duration shows 2.4. Type a new value there to retime just that frame.',
    'To change the tempo of the whole animation, change Speed, not the frames: 10 → 12 FPS shortens every frame to 1 ÷ 1.2 of its time and keeps the rhythm.',
    'Read the timing in code: `sprite_frames.get_frame_duration("walk", 5) / sprite_frames.get_animation_speed("walk")` gives 0.24 s.',
    'For a one-shot animation turn loop off and connect `animation_finished`; for a looping one use `animation_looped`.',
    'Leave Speed Scale at 1 and call `play("walk")` without a custom speed, or every frame is divided by that factor.']},
   verify:{steps:[
    'Sum duration ÷ speed over all frames in a script; for the walk above it is 0.72 s, the length of one GIF cycle.',
    'The Frame Duration field of the 240 ms frame reads 2.4 and of the 160 ms frame 1.6.',
    'Play it next to the GIF in a browser: the pause on the last frame lasts as long in both.']},
   trouble:{rows:[
    ['Every frame lasts the same although the source was uneven','The frames were added by drag and drop or from a sprite sheet, so all have 1.0','Click through the frames and read Frame Duration','Type each frame\'s ms ÷ (1000 ÷ FPS), or export the animation from Nerulio'],
    ['The animation runs twice as fast as the GIF','`speed_scale` is 2, or `play()` got a custom speed','`get_playing_speed()` while it plays','Set Speed Scale to 1 and call `play()` without the second argument'],
    ['A frame meant to last 250 ms flashes by','Seconds (0.25) were typed as the relative duration','At 10 FPS 0.25 is 25 ms','Enter ms ÷ (1000 ÷ FPS): 250 ms at 10 FPS is 2.5'],
    ['`animation_finished` never fires','The animation loops; looping animations do not emit it','Loop toggle in the SpriteFrames panel','Turn loop off for one-shot actions, or listen to `animation_looped`'],
    ['A ping-pong animation pauses on its end frames','The order was written by hand as 0-1-2-3-3-2-1-0, so the end frames play twice','Read the frame list of the animation','Remove the doubled frames, or use Godot\'s ping-pong loop mode; Nerulio writes 0-1-2-3-2-1'],
    ['Some GIF frames come out 100 ms instead of 10 ms','The GIF stores 0 or 1 hundredths, which browsers play as 100 ms','Nerulio shows this as a delay decision on import','Keep the browser reading, or switch to the file\'s raw values before export']]},
   alternatives:{rows:[
    ['Type Frame Duration by hand in the SpriteFrames panel','A handful of frames that need a longer hold; no export step.'],
    ['`Sprite2D` + `AnimationPlayer` keying `frame` at exact times','You want timing in seconds on a timeline and other tracks (sound, hitboxes) on the same clip.'],
    ['Even timing: one Speed for all frames','Every frame lasts the same: set Speed = 1000 ÷ ms and leave durations at 1.0; see [[game/godot-sprite-sheet|sprite sheets in Godot]].']]},
   limits:['SpriteFrames has no repeat count: play-3-times from Aseprite becomes loop off, and the extra plays are up to your script.','Godot 3 has no per-frame duration and cannot read the exported resource.'],
   versions:{body:['In the verification runs Godot 4.7.2 loaded Nerulio\'s `.tres` and every animation\'s speed, loop flag and per-frame durations read back equal to what was written. The duration formula, `speed_scale`, `get_playing_speed()` and the signals are quoted from the Godot 4.7 class reference; the Frame Duration field name comes from the Godot 4.7 editor source.'],sources:[...GODOT_DOCS,GODOT_SHEET[0]]}
  },
  ko:{
   answer:'Godot 4의 `SpriteFrames` 프레임에는 밀리초 단위 시간이 없습니다. 길이는 상대값(기본 1.0)이고, 애니메이션의 Speed(FPS)가 이를 초로 바꿉니다. 초 = 길이 ÷ (FPS × 재생 속도). 그래서 250ms는 10 FPS에서 2.5, 12 FPS에서 3.0입니다. GIF나 .aseprite의 들쭉날쭉한 시간을 지키려면 프레임마다 ms ÷ (1000 ÷ FPS)를 넣어야 합니다. Nerulio의 Godot 4 내보내기가 모든 프레임에 이 계산을 해 주며, 태그를 10 FPS로 쓰므로 길이는 그냥 ms ÷ 100입니다. Godot 4 전용, 4.7.2에서 확인.',
   concept:{title:'Godot 4가 프레임 시간을 정하는 방식',body:[
    '`SpriteFrames`의 애니메이션마다 초당 프레임 수(Speed)가 있고, 프레임마다 상대 길이가 있습니다. Godot 4.7 클래스 레퍼런스의 규칙은 절대 길이 = 상대 길이 ÷ (애니메이션 FPS × |재생 속도|)이며, 재생 속도는 노드의 `speed_scale`에 `play()`로 넘긴 `custom_speed`를 곱한 값입니다. 10 FPS에서 한 틱은 100ms이므로 1.0은 100ms, 2.5는 250ms입니다.',
    '길이가 비율이라서 Speed를 바꾸면 애니메이션 전체가 같은 리듬으로 빨라지거나 느려집니다. 20 FPS로 올리면 모든 프레임이 절반이 됩니다. 이미지를 끌어다 놓거나 Add Frames from Sprite Sheet로 넣은 프레임은 모두 1.0이라, 그렇게 만든 애니메이션은 모든 프레임 시간이 같습니다. 들쭉날쭉한 시간은 SpriteFrames 패널에서 프레임마다 Frame Duration 칸에 넣거나, 코드에서 `add_frame(anim, texture, duration)`이나 `set_frame()`으로 정해야 합니다.',
    '반복은 애니메이션마다 켜고 끄는 값이지 횟수가 아닙니다. 반복하는 애니메이션은 `animation_finished`를 보내지 않고(`animation_looped`를 쓰세요), 반복하지 않는 애니메이션은 마지막 프레임에서 멈추며 이 시그널을 보냅니다. Godot 4.7에는 방향이 바뀔 때마다 끝 프레임을 한 번만 보여 주는 핑퐁 반복 모드도 있습니다.',
    'Nerulio는 모든 프레임을 밀리초로 들고 있다가(GIF·APNG 딜레이, Aseprite 길이, 타임라인에 입력한 값) `.tres`를 쓸 때만 변환합니다. 태그는 10 FPS로 쓰고, 태그가 없는 프로젝트는 12 FPS의 암묵 애니메이션 하나가 됩니다. 역재생과 핑퐁은 프레임 순서로 풀어 쓰며(핑퐁은 Godot 자체 모드처럼 끝 프레임을 두 번 넣지 않음), 반복 ∞는 반복 켬, 횟수가 정해진 반복은 반복 끔이 됩니다.'],
    terms:[['Speed (FPS)','애니메이션의 초당 틱 수. 1000 ÷ FPS가 한 틱의 길이(ms).'],['상대 길이','틱 단위의 프레임 길이(기본 1.0). SpriteFrames 패널의 Frame Duration.'],['재생 속도','`speed_scale` × `play()`의 `custom_speed`. 모든 프레임 시간이 이 값으로 나뉩니다.'],['반복(Loop)','켜면 계속 반복하고 animation_finished를 보내지 않음. 끄면 한 번 재생 후 멈춤.']]},
   example:{title:'예시: 딜레이가 들쭉날쭉한 GIF',lead:'GIF로 내보낸 6프레임 걷기를 Nerulio가 Godot용으로 쓰는 값과, 그것을 다시 시간으로 읽는 방법입니다.',lines:[
    'GIF "walk": 6프레임, 딜레이 80, 80, 80, 160, 80, 240 ms   (한 바퀴 720 ms)',
    'Nerulio → Godot: speed 10 FPS, 한 틱 = 1000 / 10 = 100 ms',
    '  duration = 80/100 … = 0.8, 0.8, 0.8, 1.6, 0.8, 2.4',
    '',
    '다시 초로: duration / (FPS × 재생 속도)',
    '  2.4 / (10 × 1) = 0.24초        speed_scale 2이면: 2.4 / (10 × 2) = 0.12초',
    '  한 바퀴: (0.8 × 4 + 1.6 + 2.4) / 10 = 0.72초 = 720 ms',
    '',
    '같은 시간을 12 FPS(한 틱 83.33 ms)에서 손으로 넣으면:',
    '  80 → 0.96    160 → 1.92    240 → 2.88'],
    after:'두 방식은 똑같이 재생되고 리소스 안의 숫자만 다릅니다. 나중에 Speed를 20 FPS로 바꾸면 모든 프레임이 절반이 되어 한 바퀴가 360ms가 됩니다.'},
   outputs:{lead:'시간 정보는 Godot 4 번들의 두 파일에 들어 있습니다.',rows:[
    ['hero.tres','애니메이션마다 `speed`(태그는 10.0), `loop`, 프레임마다 소수점 여섯 자리까지의 `duration`.'],
    ['hero.tscn','첫 애니메이션을 `speed_scale` 1로 자동 재생하는 `AnimatedSprite2D`.']]},
   target:{title:'Godot 4에서 시간 확인하고 바꾸기',steps:[
    '`hero.tres`를 `AnimatedSprite2D`의 Sprite Frames 속성에 넣거나 `hero.tscn`을 엽니다.',
    'SpriteFrames 패널에서 애니메이션을 고르면 Speed가 10 FPS로 보입니다. 긴 프레임을 고르면 Frame Duration이 2.4입니다. 그 프레임만 바꾸려면 여기에 새 값을 넣습니다.',
    '애니메이션 전체 템포를 바꿀 때는 프레임이 아니라 Speed를 바꿉니다. 10 → 12 FPS면 모든 프레임이 1 ÷ 1.2로 줄고 리듬은 그대로입니다.',
    '코드에서 읽으려면 `sprite_frames.get_frame_duration("walk", 5) / sprite_frames.get_animation_speed("walk")`로 0.24초를 얻습니다.',
    '한 번만 나오는 동작은 반복을 끄고 `animation_finished`를 연결하고, 반복하는 동작은 `animation_looped`를 씁니다.',
    'Speed Scale은 1로 두고 `play("walk")`를 사용자 속도 없이 호출합니다. 그렇지 않으면 모든 프레임 시간이 그 값으로 나뉩니다.']},
   verify:{steps:[
    '스크립트로 모든 프레임의 duration ÷ speed를 더합니다. 위 걷기라면 GIF 한 바퀴와 같은 0.72초입니다.',
    '240ms 프레임의 Frame Duration은 2.4, 160ms 프레임은 1.6이어야 합니다.',
    '브라우저의 GIF와 나란히 재생합니다. 마지막 프레임에서 멈추는 시간이 같아야 합니다.']},
   trouble:{rows:[
    ['원본은 들쭉날쭉한데 모든 프레임 길이가 같음','프레임을 끌어다 놓거나 시트에서 넣어 모두 1.0임','프레임을 하나씩 눌러 Frame Duration 확인','프레임마다 ms ÷ (1000 ÷ FPS)를 넣거나 Nerulio에서 내보내기'],
    ['GIF보다 두 배 빠름','`speed_scale`이 2이거나 `play()`에 사용자 속도를 넘김','재생 중 `get_playing_speed()` 확인','Speed Scale을 1로, `play()`는 두 번째 인수 없이 호출'],
    ['250ms여야 할 프레임이 순식간에 지나감','상대 길이에 초 단위(0.25)를 넣음','10 FPS에서 0.25는 25ms','ms ÷ (1000 ÷ FPS)로 입력: 10 FPS에서 250ms는 2.5'],
    ['`animation_finished`가 오지 않음','반복 애니메이션은 이 시그널을 보내지 않음','SpriteFrames 패널의 반복 토글','한 번만 나오는 동작은 반복을 끄거나 `animation_looped`를 사용'],
    ['핑퐁 애니메이션이 끝 프레임에서 멈칫함','순서를 0-1-2-3-3-2-1-0으로 직접 써서 끝 프레임이 두 번 나옴','애니메이션의 프레임 목록 확인','겹친 프레임을 지우거나 Godot 핑퐁 반복 모드 사용. Nerulio는 0-1-2-3-2-1로 씀'],
    ['GIF 일부 프레임이 10ms가 아니라 100ms가 됨','GIF에 0이나 1(1/100초)이 적혀 있고 브라우저는 이를 100ms로 재생','Nerulio 가져오기에 딜레이 결정으로 표시됨','브라우저 방식 유지, 또는 내보내기 전에 파일 원래 값으로 전환']]},
   alternatives:{rows:[
    ['SpriteFrames 패널에서 Frame Duration을 직접 입력','오래 멈춰야 하는 프레임이 몇 개뿐일 때. 내보내기 단계가 없습니다.'],
    ['`frame`을 정확한 시각에 키로 잡는 `Sprite2D` + `AnimationPlayer`','타임라인에서 초 단위로 시간을 잡고 소리·히트박스 같은 다른 트랙도 한 클립에 두고 싶을 때.'],
    ['시간이 일정하면 Speed 하나로','모든 프레임 길이가 같다면 Speed = 1000 ÷ ms로 두고 길이는 1.0 그대로. [[game/godot-sprite-sheet|Godot에서 스프라이트 시트 쓰기]] 참고.']]},
   limits:['SpriteFrames에는 반복 횟수가 없습니다. Aseprite의 3회 재생은 반복 끔이 되고, 추가 재생은 스크립트로 처리해야 합니다.','Godot 3에는 프레임별 길이가 없어 내보낸 리소스를 읽지 못합니다.'],
   versions:{body:['검증 실행에서 Godot 4.7.2가 Nerulio의 `.tres`를 불러왔고, 애니메이션마다 speed·반복·프레임별 duration을 다시 읽은 값이 쓴 값과 같았습니다. 길이 공식, `speed_scale`, `get_playing_speed()`, 시그널은 Godot 4.7 클래스 레퍼런스를, Frame Duration 칸 이름은 Godot 4.7 편집기 소스를 따랐습니다.'],sources:[...GODOT_DOCS,GODOT_SHEET[0]]}
  },
  ja:{
   answer:'Godot 4の`SpriteFrames`のフレームには、ミリ秒の時間がありません。長さは相対値（既定1.0）で、アニメーションのSpeed（FPS）がそれを秒に変えます。秒 = 長さ ÷（FPS × 再生速度）。そのため250msは10 FPSなら2.5、12 FPSなら3.0です。GIFや.asepriteの不ぞろいな時間を保つには、フレームごとに ms ÷（1000 ÷ FPS）を入れます。NerulioのGodot 4書き出しは全フレームでこの計算を行い、タグを10 FPSで書くので、長さは単純に ms ÷ 100 です。Godot 4専用、4.7.2で確認。',
   concept:{title:'Godot 4がフレームの時間を決める仕組み',body:[
    '`SpriteFrames`のアニメーションごとに毎秒フレーム数（Speed）があり、フレームごとに相対の長さがあります。Godot 4.7のクラスリファレンスの規則は「絶対の長さ = 相対の長さ ÷（アニメーションのFPS × |再生速度|）」で、再生速度はノードの`speed_scale`に`play()`へ渡した`custom_speed`を掛けた値です。10 FPSでは1ティックが100msなので、1.0は100ms、2.5は250msです。',
    '長さは比率なので、Speedを変えるとアニメーション全体が同じリズムのまま速く・遅くなります。20 FPSにすれば全フレームが半分になります。画像をドラッグしたりAdd Frames from Sprite Sheetで追加したフレームはすべて1.0なので、そうして作ったアニメーションは全フレームが同じ長さです。不ぞろいな時間は、SpriteFramesパネルでフレームごとにFrame Durationへ入力するか、コードで`add_frame(anim, texture, duration)`や`set_frame()`を使って設定します。',
    'ループはアニメーションごとのオン・オフで、回数ではありません。ループするアニメーションは`animation_finished`を出さず（`animation_looped`を使います）、ループしないアニメーションは最後のフレームで止まってこのシグナルを出します。Godot 4.7には、折り返しのたびに端のフレームを1回だけ表示するピンポンのループモードもあります。',
    'Nerulioは全フレームをミリ秒のまま保持し（GIF・APNGのディレイ、Asepriteの長さ、タイムラインで入力した値）、`.tres`を書くときにだけ換算します。タグは10 FPSで書き、タグのないプロジェクトは12 FPSの暗黙のアニメーション1つになります。逆再生とピンポンはフレーム順に展開し（ピンポンはGodot自体のモードと同じく端のフレームを重複させない）、繰り返し∞はループオン、回数指定はループオフになります。'],
    terms:[['Speed（FPS）','アニメーションの毎秒ティック数。1000 ÷ FPSが1ティックの長さ（ms）。'],['相対の長さ','ティック単位のフレームの長さ（既定1.0）。SpriteFramesパネルのFrame Duration。'],['再生速度','`speed_scale` × `play()`の`custom_speed`。全フレームの時間がこれで割られます。'],['ループ','オンなら繰り返し、animation_finishedを出さない。オフなら1回再生して止まる。']]},
   example:{title:'例：ディレイが不ぞろいなGIF',lead:'GIFで書き出した6コマの歩きを、NerulioがGodot向けに書く値と、それを時間に読み戻す方法です。',lines:[
    'GIF "walk"：6フレーム、ディレイ 80, 80, 80, 160, 80, 240 ms   （1周720 ms）',
    'Nerulio → Godot：speed 10 FPS、1ティック = 1000 / 10 = 100 ms',
    '  duration = 80/100 … = 0.8, 0.8, 0.8, 1.6, 0.8, 2.4',
    '',
    '秒に戻す：duration /（FPS × 再生速度）',
    '  2.4 / (10 × 1) = 0.24秒        speed_scale 2なら：2.4 / (10 × 2) = 0.12秒',
    '  1周：(0.8 × 4 + 1.6 + 2.4) / 10 = 0.72秒 = 720 ms',
    '',
    '同じ時間を12 FPS（1ティック83.33 ms）で手入力すると：',
    '  80 → 0.96    160 → 1.92    240 → 2.88'],
    after:'どちらも同じように再生され、リソース内の数値だけが違います。あとでSpeedを20 FPSにすると全フレームが半分になり、1周は360msになります。'},
   outputs:{lead:'時間の情報はGodot 4バンドルの2つのファイルに入っています。',rows:[
    ['hero.tres','アニメーションごとの`speed`（タグは10.0）、`loop`、フレームごとに小数点以下6桁までの`duration`。'],
    ['hero.tscn','最初のアニメーションを`speed_scale` 1で自動再生する`AnimatedSprite2D`。']]},
   target:{title:'Godot 4で時間を確認・変更する',steps:[
    '`hero.tres`を`AnimatedSprite2D`のSprite Framesプロパティに読み込むか、`hero.tscn`を開きます。',
    'SpriteFramesパネルでアニメーションを選ぶとSpeedは10 FPSです。長いフレームを選ぶとFrame Durationは2.4です。そのフレームだけ変えるならここに新しい値を入れます。',
    'アニメーション全体のテンポを変えるときは、フレームではなくSpeedを変えます。10 → 12 FPSで全フレームが1 ÷ 1.2になり、リズムは保たれます。',
    'コードで読むなら`sprite_frames.get_frame_duration("walk", 5) / sprite_frames.get_animation_speed("walk")`で0.24秒が得られます。',
    '1回きりの動作はループをオフにして`animation_finished`をつなぎ、ループする動作には`animation_looped`を使います。',
    'Speed Scaleは1のままにし、`play("walk")`はカスタム速度なしで呼びます。そうしないと全フレームの時間がその値で割られます。']},
   verify:{steps:[
    'スクリプトで全フレームのduration ÷ speedを合計します。上の歩きならGIFの1周と同じ0.72秒です。',
    '240msのフレームのFrame Durationは2.4、160msのフレームは1.6のはずです。',
    'ブラウザのGIFと並べて再生します。最後のフレームで止まる時間が同じはずです。']},
   trouble:{rows:[
    ['元は不ぞろいなのに全フレームが同じ長さ','ドラッグやシートから追加したため全部1.0','フレームを1つずつ選んでFrame Durationを確認','フレームごとに ms ÷（1000 ÷ FPS）を入れるか、Nerulioから書き出す'],
    ['GIFの2倍の速さになる','`speed_scale`が2、または`play()`にカスタム速度を渡した','再生中に`get_playing_speed()`を確認','Speed Scaleを1にし、`play()`は2つ目の引数なしで呼ぶ'],
    ['250msのはずのフレームが一瞬で過ぎる','相対の長さに秒（0.25）を入れた','10 FPSでは0.25は25ms','ms ÷（1000 ÷ FPS）で入力：10 FPSで250msは2.5'],
    ['`animation_finished`が来ない','ループするアニメーションはこのシグナルを出さない','SpriteFramesパネルのループ切り替え','1回きりの動作はループをオフにするか`animation_looped`を使う'],
    ['ピンポンのアニメーションが端で一瞬止まる','順序を0-1-2-3-3-2-1-0と手で書き、端のフレームが2回出る','アニメーションのフレーム一覧を確認','重複したフレームを消すか、Godotのピンポンループを使う。Nerulioは0-1-2-3-2-1で書く'],
    ['GIFの一部のフレームが10msではなく100msになる','GIFに0や1（1/100秒）と書かれ、ブラウザはそれを100msで再生する','Nerulioの読み込みでディレイの判断として表示される','ブラウザ方式のままにするか、書き出し前にファイル本来の値へ切り替える']]},
   alternatives:{rows:[
    ['SpriteFramesパネルでFrame Durationを手入力','長く止めたいフレームが数枚だけのとき。書き出しの手間がありません。'],
    ['`frame`を正確な時刻にキーを打つ`Sprite2D` + `AnimationPlayer`','タイムライン上で秒単位に時間を決め、音やヒットボックスなど別のトラックも同じクリップに置きたいとき。'],
    ['時間が均一ならSpeedだけで','全フレームが同じ長さなら、Speed = 1000 ÷ msにして長さは1.0のまま。[[game/godot-sprite-sheet|Godotでスプライトシートを使う]]を参照。']]},
   limits:['SpriteFramesには繰り返し回数がありません。Asepriteの「3回再生」はループオフになり、残りの再生はスクリプトで扱います。','Godot 3にはフレームごとの長さがなく、書き出したリソースを読めません。'],
   versions:{body:['検証の実行ではGodot 4.7.2がNerulioの`.tres`を読み込み、アニメーションごとのspeed・ループ・フレームごとのdurationを読み戻した値が書いた値と一致しました。長さの式、`speed_scale`、`get_playing_speed()`、シグナルはGodot 4.7のクラスリファレンスに、Frame Durationの欄の名前はGodot 4.7のエディターのソースに基づきます。'],sources:[...GODOT_DOCS,GODOT_SHEET[0]]}
  }
 },
 // ------------------------------------------------------------------ frame size
 // Nerulio: src/game/grid-detect.js (evidence: separators, periodicity, consistency, crossings; margin ≤ 64,
 // spacing ≤ 16), src/studio/sprite/import-plan.js (customFit, "N of M cells hold pixels", custom grid fields),
 // grid-rerank.js (samurai 48×96 → 48×48), docs/STUDIO-SPRITE.md §10 (16/16). Engine field names: official docs.
 'game/sprite-sheet-frame-size':{
  type:'format',
  intent:{primary:'find the frame width, height, margin and spacing of a sprite sheet',secondary:['calculate frame size from sheet size and columns','why frames drift or get cut in half','which engine field takes which number'],
   goal:'the four numbers (frame width, frame height, margin, spacing) that cut the sheet exactly, entered in the right engine fields',input:'a sprite sheet PNG',output:'measured grid (cell, offset, gap) or atlas data with every frame rectangle',target:'Phaser 3/4, Godot 4, Unity 6, Defold',support:'full',
   evidence:['src/game/grid-detect.js','src/studio/sprite/import-plan.js (customFit, cell counts)','src/studio/sprite/grid-rerank.js','docs/STUDIO-SPRITE.md §10 (16/16 real assets)'],
   external:['Phaser SpriteSheetConfig (frameWidth, frameHeight, margin, spacing, endFrame)','Unity Sprite Editor Grid By Cell Size (Pixel Size, Offset, Padding, Keep Empty Rects)','Godot 4.7 sheet dialog (Size, Separation, Offset)']},
  en:{
   answer:'A sprite sheet\'s frame size is the width and height of one cell. Without a border or gaps it is sheet width ÷ columns by sheet height ÷ rows: 384 × 64 with 6 columns gives 64 × 64. With a margin m on both sides and spacing s between frames, frame width = (sheet width − 2m − (columns − 1) × s) ÷ columns. Phaser, Godot and Unity all ask for those four numbers (frame width, height, margin, spacing). Nerulio measures them from the pixels and shows a confidence, or skips the typing by writing every frame\'s exact rectangle into atlas data.',
   concept:{title:'The four numbers that describe a grid',body:[
    'A grid sheet is fully described by the frame (cell) width and height, the margin between the sheet edge and the first frame, and the spacing between neighbouring frames. From those, frame n of a row starts at x = margin + n × (frame width + spacing); the frame width plus the spacing is the pitch at which the art repeats.',
    'Dividing the sheet size by a guessed column count only works when margin and spacing are 0. A result that is not a whole number (398 ÷ 6 = 66.33) is the tell-tale sign of a margin or spacing, or of a wrong column count. A whole number is not proof either: a 256 px sheet divides by 8, 16, 32, 64 and 128, so count the columns from the art, not from the arithmetic.',
    'Nerulio does not trust "divides evenly". It looks for fully transparent separator lines where a gap should be, the period at which the columns and rows repeat, cells whose content looks alike, and cell edges that would cut through a sprite. Candidate sizes include 8–128 px, sizes suggested by the measured pitch and sizes that divide the sheet evenly; margins up to 64 px and spacing up to 16 px are searched. Each candidate shows high, medium or low confidence, its reasons and how many cells hold pixels.',
    'A sheet whose sprites have different sizes (or a packed atlas) has no single frame size. Cutting it by sprite outlines and exporting atlas data, which stores one rectangle per frame, replaces the grid numbers altogether.'],
    terms:[['Frame (cell) size','Width and height of one frame in pixels.'],['Margin','Empty border before the first frame; Godot calls it Offset, Unity Offset, Phaser margin.'],['Spacing','Empty pixels between two frames; Godot calls it Separation, Unity Padding, Phaser spacing.'],['Pitch','Frame size + spacing: the distance from one frame\'s left edge to the next.'],['Columns × rows','How many frames fit across and down: floor((sheet − margin + spacing) ÷ pitch).']]},
   example:{title:'Worked example: a sheet with margin and spacing',lines:[
    'Sheet 398 × 134 px, the art shows 6 columns × 2 rows',
    '  398 / 6 = 66.33      not whole → there is a margin and/or spacing',
    '  first opaque column at x = 2, transparent gap between frames = 2 px',
    '  frame width  = (398 − 2 × 2 − 5 × 2) / 6 = 384 / 6 = 64',
    '  frame height = (134 − 2 × 2 − 1 × 2) / 2 = 128 / 2 = 64',
    '  pitch = 64 + 2 = 66 → frames start at x = 2, 68, 134, 200, 266, 332',
    '',
    'Phaser   frameWidth 64, frameHeight 64, margin 2, spacing 2',
    'Unity    Grid By Cell Size: Pixel Size 64 × 64, Offset 2 × 2, Padding 2 × 2',
    'Godot    Add Frames from Sprite Sheet: Size 64 × 64, Separation 2 × 2, Offset 2 × 2'],
    after:'Check: the last frame ends at 332 + 64 = 396, and the 2 px right margin brings the row to 398. If your numbers do not land exactly on the sheet width, one of them is wrong.'},
   target:{title:'Measure it, then enter it',steps:[
    'Drop the sheet on Nerulio\'s Sprite workspace and read the grid decision in the Import panel: cell size, offset and gap, the confidence, and "N of M cells hold pixels".',
    'If the overlay is off, click another candidate or open the custom grid and type cell width and height, offset X/Y and gap X/Y; the preview shows the whole cells and the pixels left over before anything is cut.',
    'Phaser: `this.load.spritesheet(\'hero\', \'hero.png\', { frameWidth: 64, frameHeight: 64, margin: 2, spacing: 2 })`; `endFrame` limits the count if the last cells are empty.',
    'Unity: set Sprite Mode to Multiple, open the Sprite Editor, choose Slice › Grid By Cell Size, enter Pixel Size, Offset and Padding, then Slice and Apply.',
    'Godot 4: SpriteFrames panel › Add Frames from Sprite Sheet, then Size, Separation and Offset; see [[game/godot-sprite-sheet|sprite sheets in Godot]].',
    'Or skip the numbers: Pack & Export writes each frame\'s own rectangle for Godot, Unity, Phaser and others.']},
   trouble:{rows:[
    ['Frames drift a little further with every column','Spacing left at 0, or a frame width that includes the gap','Frame n should start at margin + n × pitch; compare with the art','Enter the measured spacing and the pure frame width'],
    ['The last column or row is missing','Frame size or margin slightly too large, so the final cell does not fit','floor((sheet − margin + spacing) ÷ pitch) must equal the columns you see','Recheck margin and spacing; a right-hand margin is not part of any cell'],
    ['Each frame shows half a sprite, or two sprites','Cell size is half or double the real one (48 × 96 read for 48 × 48)','Look for sprites cut by a cell edge or two feet in one cell','Pick the candidate with the right size; Nerulio\'s importer prefers the one that splits nothing'],
    ['Left and top margins differ, and Phaser misplaces frames','Phaser\'s `load.spritesheet` has one margin and one spacing for both axes','Nerulio reports X and Y separately','Export a Phaser atlas instead; Unity\'s Offset and Padding take X and Y'],
    ['Blank frames at the end of the animation','The sheet has unused cells','Count filled cells; Nerulio lists "N of M cells hold pixels"','Phaser `endFrame`, Unity with Keep Empty Rects off, or Nerulio (it skips empty cells)']]},
   versions:{body:['The grid measurement is Nerulio\'s own (src/game/grid-detect.js); on 16 real assets imported through the UI its default choices cut the right frames 16 times out of 16. The field names come from the Phaser, Unity 6 and Godot 4.7 documentation and editor source; these hand-typed settings were not run in the engines. The route that was run in Godot 4.7.2, Unity 6000.5.3f1 and Phaser 3.90 / 4.2 is the atlas export.'],sources:[PHASER_DOCS[1],UNITY_DOCS[0],UNITY_DOCS[1],GODOT_DOCS[2],GODOT_SHEET[0]]}
  },
  ko:{
   answer:'스프라이트 시트의 프레임 크기는 칸 하나의 너비와 높이입니다. 테두리와 틈이 없으면 시트 너비 ÷ 열 수, 시트 높이 ÷ 행 수이며, 384 × 64를 6열로 나누면 64 × 64입니다. 양쪽 여백이 m, 프레임 사이 간격이 s라면 프레임 너비 = (시트 너비 − 2m − (열 수 − 1) × s) ÷ 열 수입니다. Phaser, Godot, 유니티 모두 이 네 숫자(프레임 너비·높이·여백·간격)를 묻습니다. Nerulio는 픽셀에서 이 값을 재어 신뢰도와 함께 보여 주거나, 프레임마다 정확한 사각형을 아틀라스 데이터로 써서 입력 자체를 없애 줍니다.',
   concept:{title:'격자를 설명하는 네 숫자',body:[
    '격자 시트는 프레임(칸) 너비와 높이, 시트 가장자리와 첫 프레임 사이의 여백, 이웃 프레임 사이의 간격만 알면 완전히 정해집니다. 한 행의 n번째 프레임은 x = 여백 + n × (프레임 너비 + 간격)에서 시작하고, 프레임 너비 + 간격이 그림이 반복되는 주기(피치)입니다.',
    '시트 크기를 짐작한 열 수로 나누는 방법은 여백과 간격이 0일 때만 맞습니다. 결과가 정수가 아니면(398 ÷ 6 = 66.33) 여백이나 간격이 있거나 열 수가 틀렸다는 신호입니다. 정수라고 해서 맞다는 증거도 아닙니다. 256px 시트는 8, 16, 32, 64, 128로 모두 나누어떨어지니, 열 수는 계산이 아니라 그림을 보고 세야 합니다.',
    'Nerulio는 "나누어떨어진다"를 믿지 않습니다. 틈이 있어야 할 자리의 완전히 투명한 구분선, 열과 행이 반복되는 주기, 칸 내용이 서로 닮았는지, 칸 경계가 스프라이트를 가르는지를 봅니다. 후보 크기는 8~128px, 측정한 주기에서 나온 크기, 시트를 딱 나누는 크기이며, 여백은 64px, 간격은 16px까지 찾습니다. 후보마다 높음·보통·낮음 신뢰도와 근거, 픽셀이 든 칸 수가 표시됩니다.',
    '크기가 제각각인 스프라이트(또는 패킹된 아틀라스)로 된 시트에는 하나의 프레임 크기가 없습니다. 스프라이트 윤곽으로 자르고 프레임마다 사각형을 저장하는 아틀라스 데이터로 내보내면 격자 숫자가 아예 필요 없습니다.'],
    terms:[['프레임(칸) 크기','프레임 하나의 너비와 높이(픽셀).'],['여백(margin)','첫 프레임 앞의 빈 테두리. Godot·유니티는 Offset, Phaser는 margin.'],['간격(spacing)','두 프레임 사이의 빈 픽셀. Godot는 Separation, 유니티는 Padding, Phaser는 spacing.'],['피치','프레임 크기 + 간격. 한 프레임의 왼쪽 끝에서 다음 프레임까지의 거리.'],['열 × 행','가로·세로로 들어가는 프레임 수: 내림((시트 − 여백 + 간격) ÷ 피치).']]},
   example:{title:'예시: 여백과 간격이 있는 시트',lines:[
    '시트 398 × 134 px, 그림을 보면 6열 × 2행',
    '  398 / 6 = 66.33      정수가 아님 → 여백이나 간격이 있음',
    '  첫 불투명 열은 x = 2, 프레임 사이 투명한 틈 = 2 px',
    '  프레임 너비 = (398 − 2 × 2 − 5 × 2) / 6 = 384 / 6 = 64',
    '  프레임 높이 = (134 − 2 × 2 − 1 × 2) / 2 = 128 / 2 = 64',
    '  피치 = 64 + 2 = 66 → 프레임 시작 x = 2, 68, 134, 200, 266, 332',
    '',
    'Phaser   frameWidth 64, frameHeight 64, margin 2, spacing 2',
    '유니티    Grid By Cell Size: Pixel Size 64 × 64, Offset 2 × 2, Padding 2 × 2',
    'Godot    Add Frames from Sprite Sheet: Size 64 × 64, Separation 2 × 2, Offset 2 × 2'],
    after:'검산: 마지막 프레임은 332 + 64 = 396에서 끝나고, 오른쪽 여백 2px를 더하면 398입니다. 숫자가 시트 너비에 정확히 떨어지지 않으면 어딘가가 틀린 것입니다.'},
   target:{title:'재고 나서 입력하기',steps:[
    '시트를 Nerulio 스프라이트 작업 공간에 넣고 가져오기 패널의 격자 결정을 읽습니다. 칸 크기·오프셋·간격, 신뢰도, "M칸 중 N칸에 픽셀"이 나옵니다.',
    '오버레이가 어긋나면 다른 후보를 누르거나 사용자 격자에 칸 너비·높이, 오프셋 X/Y, 간격 X/Y를 넣습니다. 자르기 전에 미리보기가 온전한 칸과 남는 픽셀을 보여 줍니다.',
    'Phaser: `this.load.spritesheet(\'hero\', \'hero.png\', { frameWidth: 64, frameHeight: 64, margin: 2, spacing: 2 })`. 마지막 칸이 비어 있으면 `endFrame`으로 개수를 줄입니다.',
    '유니티: Sprite Mode를 Multiple로 하고 Sprite Editor를 열어 Slice › Grid By Cell Size를 고른 뒤 Pixel Size, Offset, Padding을 넣고 Slice, Apply를 누릅니다.',
    'Godot 4: SpriteFrames 패널 › Add Frames from Sprite Sheet에서 Size, Separation, Offset을 넣습니다. [[game/godot-sprite-sheet|Godot에서 스프라이트 시트 쓰기]] 참고.',
    '숫자 입력을 건너뛰려면 패킹·내보내기가 Godot·유니티·Phaser 등에 프레임마다 사각형을 써 줍니다.']},
   trouble:{rows:[
    ['열이 넘어갈수록 프레임이 조금씩 밀림','간격을 0으로 뒀거나, 간격을 포함한 너비를 프레임 너비로 넣음','n번째 프레임 시작 = 여백 + n × 피치인지 그림과 비교','잰 간격과 순수한 프레임 너비를 입력'],
    ['마지막 열이나 행이 빠짐','프레임 크기나 여백이 조금 커서 마지막 칸이 들어가지 않음','내림((시트 − 여백 + 간격) ÷ 피치)가 보이는 열 수와 같아야 함','여백과 간격을 다시 확인. 오른쪽 여백은 어느 칸에도 속하지 않음'],
    ['프레임마다 스프라이트가 반쪽이거나 두 개','칸 크기가 실제의 절반이나 두 배(48 × 48을 48 × 96으로 읽음)','칸 경계에 잘린 스프라이트, 한 칸에 발이 두 쌍인지 확인','맞는 크기의 후보 선택. Nerulio 가져오기는 아무것도 가르지 않는 후보를 우선함'],
    ['왼쪽과 위쪽 여백이 달라 Phaser에서 어긋남','Phaser `load.spritesheet`는 두 축 공통의 여백·간격 하나씩만 받음','Nerulio는 X와 Y를 따로 보고함','Phaser 아틀라스로 내보내기. 유니티 Offset·Padding은 X·Y를 따로 받음'],
    ['애니메이션 끝에 빈 프레임이 붙음','시트에 쓰지 않은 칸이 있음','채워진 칸 수 확인. Nerulio는 "M칸 중 N칸에 픽셀"로 표시','Phaser `endFrame`, 유니티 Keep Empty Rects 끄기, 또는 Nerulio(빈 칸을 건너뜀)']]},
   versions:{body:['격자 측정은 Nerulio 자체 구현(src/game/grid-detect.js)이며, UI로 가져온 실제 에셋 16개에서 기본 선택으로 16개 모두 프레임이 맞았습니다. 필드 이름은 Phaser, 유니티 6, Godot 4.7 문서와 편집기 소스를 따랐고, 손으로 넣는 이 설정을 엔진에서 돌려 보지는 않았습니다. Godot 4.7.2, Unity 6000.5.3f1, Phaser 3.90·4.2에서 실제로 돌린 경로는 아틀라스 내보내기입니다.'],sources:[PHASER_DOCS[1],UNITY_DOCS[0],UNITY_DOCS[1],GODOT_DOCS[2],GODOT_SHEET[0]]}
  },
  ja:{
   answer:'スプライトシートのフレームサイズは、1セルの幅と高さです。縁も隙間もなければ「シートの幅 ÷ 列数」×「シートの高さ ÷ 行数」で、384 × 64を6列なら64 × 64です。両側の余白がm、フレーム間の間隔がsなら、フレーム幅 =（シートの幅 − 2m −（列数 − 1）× s）÷ 列数です。Phaser・Godot・Unityはどれもこの4つの数値（フレームの幅・高さ・余白・間隔）を求めます。Nerulioはピクセルからこれを測って信頼度つきで示すか、フレームごとの正確な矩形をアトラスのデータに書いて入力そのものを不要にします。',
   concept:{title:'グリッドを表す4つの数値',body:[
    'グリッド状のシートは、フレーム（セル）の幅と高さ、シートの端から最初のフレームまでの余白、隣り合うフレームの間隔が分かれば完全に決まります。1行のn番目のフレームは x = 余白 + n ×（フレーム幅 + 間隔）から始まり、フレーム幅 + 間隔が絵の繰り返す周期（ピッチ）です。',
    'シートの大きさを見当の列数で割る方法は、余白と間隔が0のときしか合いません。結果が整数にならない（398 ÷ 6 = 66.33）なら、余白か間隔があるか、列数が違うというサインです。整数になっても正しい証拠にはなりません。256pxのシートは8・16・32・64・128のどれでも割り切れるので、列数は計算ではなく絵を見て数えます。',
    'Nerulioは「割り切れる」を信用しません。隙間があるはずの位置の完全に透明な区切り線、列と行が繰り返す周期、セルの中身が似ているか、セルの境界がスプライトを横切らないかを調べます。候補のサイズは8〜128px、測った周期から得たサイズ、シートをちょうど割り切るサイズで、余白は64pxまで、間隔は16pxまで探します。候補ごとに高・中・低の信頼度と根拠、ピクセルのあるセルの数が表示されます。',
    '大きさのばらばらなスプライト（またはパック済みアトラス）のシートには、1つのフレームサイズがありません。スプライトの輪郭で切り、フレームごとの矩形を持つアトラスのデータで書き出せば、グリッドの数値そのものが要らなくなります。'],
    terms:[['フレーム（セル）サイズ','1フレームの幅と高さ（ピクセル）。'],['余白（margin）','最初のフレームの前の空いた縁。GodotとUnityはOffset、Phaserはmargin。'],['間隔（spacing）','2つのフレームの間の空きピクセル。GodotはSeparation、UnityはPadding、Phaserはspacing。'],['ピッチ','フレームサイズ + 間隔。あるフレームの左端から次のフレームまでの距離。'],['列 × 行','横・縦に入るフレーム数：切り捨て（（シート − 余白 + 間隔）÷ ピッチ）。']]},
   example:{title:'例：余白と間隔のあるシート',lines:[
    'シート398 × 134 px、絵を見ると6列 × 2行',
    '  398 / 6 = 66.33      整数でない → 余白か間隔がある',
    '  最初の不透明な列はx = 2、フレーム間の透明な隙間 = 2 px',
    '  フレーム幅   = (398 − 2 × 2 − 5 × 2) / 6 = 384 / 6 = 64',
    '  フレーム高さ = (134 − 2 × 2 − 1 × 2) / 2 = 128 / 2 = 64',
    '  ピッチ = 64 + 2 = 66 → フレームの開始x = 2, 68, 134, 200, 266, 332',
    '',
    'Phaser   frameWidth 64, frameHeight 64, margin 2, spacing 2',
    'Unity    Grid By Cell Size：Pixel Size 64 × 64、Offset 2 × 2、Padding 2 × 2',
    'Godot    Add Frames from Sprite Sheet：Size 64 × 64、Separation 2 × 2、Offset 2 × 2'],
    after:'検算：最後のフレームは332 + 64 = 396で終わり、右の余白2pxを足して398になります。数値がシートの幅にぴったり収まらなければ、どれかが間違っています。'},
   target:{title:'測ってから入力する',steps:[
    'シートをNerulioのスプライト作業画面にドロップし、読み込みパネルのグリッドの判断を読みます。セルサイズ・オフセット・間隔、信頼度、「M個中N個のセルにピクセル」が出ます。',
    '重ね表示がずれていれば別の候補を押すか、カスタムグリッドにセルの幅・高さ、オフセットX/Y、間隔X/Yを入れます。切る前にプレビューが、収まるセルと余るピクセルを示します。',
    'Phaser：`this.load.spritesheet(\'hero\', \'hero.png\', { frameWidth: 64, frameHeight: 64, margin: 2, spacing: 2 })`。最後のセルが空なら`endFrame`で数を絞ります。',
    'Unity：Sprite ModeをMultipleにしてSprite Editorを開き、Slice › Grid By Cell Sizeを選んでPixel Size・Offset・Paddingを入れ、SliceとApplyを押します。',
    'Godot 4：SpriteFramesパネル › Add Frames from Sprite SheetでSize・Separation・Offsetを入れます。[[game/godot-sprite-sheet|Godotでスプライトシートを使う]]を参照。',
    '数値の入力を省くなら、パック＆書き出しがGodot・Unity・Phaserなど向けにフレームごとの矩形を書き出します。']},
   trouble:{rows:[
    ['列が進むほどフレームが少しずつずれる','間隔を0のままにした、または隙間を含む幅をフレーム幅にした','n番目のフレームの開始 = 余白 + n × ピッチ か絵と比べる','測った間隔と、隙間を含まないフレーム幅を入れる'],
    ['最後の列や行が欠ける','フレームサイズか余白が少し大きく、最後のセルが収まらない','切り捨て（（シート − 余白 + 間隔）÷ ピッチ）が見えている列数と同じか','余白と間隔を確認し直す。右側の余白はどのセルにも属さない'],
    ['フレームごとにスプライトが半分、または2体入る','セルサイズが実際の半分か2倍（48 × 48を48 × 96と読んだ）','セルの境界で切れたスプライトや、1セルに足が2組ないか見る','正しいサイズの候補を選ぶ。Nerulioの読み込みは何も分断しない候補を優先する'],
    ['左と上の余白が違い、Phaserでずれる','Phaserの`load.spritesheet`は両軸共通の余白と間隔を1つずつしか持たない','NerulioはXとYを別々に報告する','Phaser用アトラスで書き出す。UnityのOffset・PaddingはX・Yを別に受け取る'],
    ['アニメーションの最後に空のフレームが付く','シートに使っていないセルがある','埋まったセルを数える。Nerulioは「M個中N個のセルにピクセル」と表示','Phaserの`endFrame`、UnityのKeep Empty Rectsをオフ、またはNerulio（空のセルは飛ばす）']]},
   versions:{body:['グリッドの測定はNerulio独自の実装（src/game/grid-detect.js）で、UIから読み込んだ実在の素材16件では既定の選択で16件すべてのフレームが正しく切れました。フィールド名はPhaser、Unity 6、Godot 4.7のドキュメントとエディターのソースに基づき、手入力のこれらの設定をエンジンで実行したわけではありません。Godot 4.7.2、Unity 6000.5.3f1、Phaser 3.90・4.2で実際に動かした経路はアトラスの書き出しです。'],sources:[PHASER_DOCS[1],UNITY_DOCS[0],UNITY_DOCS[1],GODOT_DOCS[2],GODOT_SHEET[0]]}
  }
 }
};
