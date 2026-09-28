/** Intent content for the sprite → engine pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Each page has a comment naming the code and docs its Nerulio claims rest on.
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
 },
 // ------------------------------------------------------------------ Unity: sprite sheet
 // Nerulio: src/game/export/unity.js (rect y flip, pivot normalised y-up, PPU 100, Point, Uncompressed, no mipmaps,
 // one .anim per tag with SpriteRenderer.m_Sprite keys + closing key, DeleteAsset before CreateAsset), README-UNITY,
 // docs/STUDIO-PACK.md + docs/ENGINE-VERIFY.md (Unity 6000.5.3f1 batch mode; Apply/CreateClips by reflection;
 // Animator playback not checked; needs com.unity.2d.sprite).
 'game/unity-sprite-sheet':{
  type:'engine',
  intent:{primary:'slice a sprite sheet into sprites and an animation in Unity 6',secondary:['Sprite Mode Multiple and Grid By Cell Size settings','Pixels Per Unit, Filter Mode Point, Compression None for pixel art','sprite pivots and AnimationClips from a sheet'],
   goal:'sliced sprites with correct rects and pivots and one AnimationClip per animation in a Unity 6 project, sharp for pixel art',input:'a sprite sheet PNG',output:'PNG + .unity.json + Editor/NerulioSpriteImporter.cs (creates sprite rects and .anim clips in Unity)',target:'Unity 6 (verified 6000.5.3f1)',support:'full',
   evidence:['src/game/export/unity.js','docs/STUDIO-PACK.md (Unity 6000.5.3f1)','docs/ENGINE-VERIFY.md (what the Unity probe checks and does not)'],
   external:['Unity 6.5 Manual: Sprite Editor slicing, Sprite (2D and UI) import settings','Unity Sprite Editor tab reference','2D Pixel Perfect: Point, Compression None, same PPU','Unity Manual: Create a new Animation Clip']},
  en:{
   answer:'To use a sprite sheet in Unity 6, set the PNG\'s Texture Type to Sprite (2D and UI) and Sprite Mode to Multiple, open the Sprite Editor and choose Slice › Grid By Cell Size: Pixel Size is the frame size, Offset the margin and Padding the spacing. For pixel art also set Filter Mode to Point (no filter), Compression to None and one Pixels Per Unit for every sprite, then build an AnimationClip from the sprites. Nerulio can do the measuring and the clip building: it exports the PNG, a JSON and an editor script that writes every sprite rect with its pivot and one clip per animation. Checked in Unity 6000.5.3f1.',
   concept:{title:'How Unity turns one texture into many sprites',body:[
    'Unity keeps a sprite sheet as one texture asset with several Sprite sub-assets. Sprite Mode Multiple says the image holds several elements; the Sprite Editor stores one rectangle and one pivot per sprite. Its Slice menu offers Automatic (islands separated by transparency), Grid By Cell Size, Grid By Cell Count and Isometric Grid. For a grid, Pixel Size is the cell, Offset shifts the grid from the top-left corner, Padding is the space between sprites, and Keep Empty Rects decides whether blank cells become sprites.',
    'Pixels Per Unit sets how many texture pixels make one world unit: a 64 px frame is 0.64 units at the default 100 and exactly 1 unit at 64. The 2D Pixel Perfect documentation asks for the same PPU on all sprites, Filter Mode Point and Compression None; Bilinear filtering and compression are what make pixel art look soft or smeared.',
    'An animation in Unity is an AnimationClip whose keys swap the SpriteRenderer\'s sprite at given times, played by an Animator through an Animator Controller. Creating a clip in the Animation window also creates the controller and the Animator component for you. A clip made by hand from a sheet usually has one fixed frame rate for every sprite.',
    'Nerulio measures the grid (with a confidence you can overrule), lets you name the row animations, set per-frame times and pivots, and exports three files. Its editor script sets the texture to Sprite / Multiple / Point / Uncompressed / no mipmaps / PPU 100, writes one sprite rect per frame with its pivot, and creates one `.anim` per animation whose keys sit at each frame\'s own start time.'],
    terms:[['Sprite Mode Multiple','The texture holds several sprites whose rects are set in the Sprite Editor.'],['Pixels Per Unit (PPU)','Texture pixels per world unit; keep it the same on every sprite of a game.'],['Grid By Cell Size','Slice type with Pixel Size (cell), Offset (margin) and Padding (spacing).'],['Pivot','The sprite\'s origin; normalised 0–1 inside the rect, y up.'],['AnimationClip','Keys that change SpriteRenderer.sprite over time; played by an Animator.']]},
   example:{title:'Worked example: 384 × 128 sheet, two animations',lines:[
    'Sheet 384 × 128 px: 2 rows × 6 columns of 64 × 64, no margin, no spacing',
    '  Grid By Cell Size: Pixel Size 64 × 64, Offset 0 × 0, Padding 0 × 0 → 12 sprites',
    '  world size: 64 px / PPU 100 = 0.64 units      64 px / PPU 64 = 1 unit',
    '',
    'Nerulio export (rows named idle and run, frames 125 ms, pivot bottom centre):',
    '  rect y in Unity (origin bottom-left) = page height − (y + h)',
    '  pivot bottom centre → (0.5, 0) inside each rect',
    '  run.anim keys: 0, 0.125, 0.25, 0.375, 0.5, 0.625 s + closing key at 0.75 s',
    '  loop on (repeat ∞)      clip frame rate 10'],
    after:'The closing key repeats the last sprite so that it also lasts its full 125 ms before the clip wraps.'},
   outputs:{lead:'Pack & Export › Unity 6 writes (named after your file; `hero` here):',rows:[
    ['hero.png','The packed frames (trim on, 2 px apart, never rotated); several pages for large sets.'],
    ['hero.unity.json','Every sprite rect already in Unity\'s bottom-left coordinates, its normalised pivot, and the clips with each frame\'s milliseconds.'],
    ['Editor/NerulioSpriteImporter.cs','The editor script behind Tools › Nerulio › Import Studio JSON: import settings, sprite rects, AnimationClips.'],
    ['README-UNITY.md','The steps below for this bundle.']]},
   target:{title:'Bring it into Unity 6',steps:[
    'Copy the unzipped folder into `Assets/`, for example `Assets/Characters/Hero/`, keeping the PNG next to the JSON. The `Editor` folder with `NerulioSpriteImporter.cs` is compiled by Unity; it needs the 2D Sprite package (`com.unity.2d.sprite`), which every 2D template includes.',
    'Choose Tools › Nerulio › Import Studio JSON and pick `hero.unity.json` inside your project.',
    'The script sets the texture to Sprite (2D and UI), Multiple, Point (no filter), Uncompressed, no mipmaps, PPU 100, and writes one sprite per frame with its pivot. Open the Sprite Editor to see the rects.',
    'It also writes one clip per animation next to the JSON (`idle.anim`, `run.anim`), keying the SpriteRenderer\'s sprite at each frame\'s time, with Loop Time as tagged.',
    'Put the clips in an Animator Controller and assign it to an Animator on a GameObject with a SpriteRenderer.',
    'If your game uses another PPU (16 for 16 px tiles, say), change Pixels Per Unit on the texture afterwards, the same for every sprite.'],
    note:['Without Nerulio: select the PNG, set Texture Type to Sprite (2D and UI), Sprite Mode to Multiple, Filter Mode to Point (no filter) and Compression to None, and apply. Open the Sprite Editor, choose Slice › Grid By Cell Size, enter Pixel Size, Offset and Padding and a Pivot, press Slice and then Apply. Then open Window › Animation › Animation, create a clip for your GameObject and key its sprite at a fixed rate.']},
   verify:{steps:[
    'The Sprite Editor shows one rect per filled cell, each with its pivot marker at the feet.',
    'The texture Inspector reads Filter Mode Point (no filter) and Compression None.',
    'In the Animation window `run.anim` has six keys 0.125 s apart and ends at 0.75 s.',
    'At an integer zoom in the Game view the pixel edges stay hard, and the feet do not move between frames.']},
   trouble:{rows:[
    ['Sprites look soft or smeared','Bilinear filtering or texture compression','Texture Inspector: Filter Mode and Compression','Point (no filter) and None; see [[game/unity-pixel-art-blurry|blurry pixel art in Unity]]'],
    ['Slices drift or cut sprites in half','Pixel Size includes the gap, or Offset / Padding are wrong','Compare the red slice outlines with the art at the last column','Enter the measured cell, margin and spacing; see [[game/sprite-sheet-frame-size|frame size]]'],
    ['Tools › Nerulio is missing or the script does not compile','The script is not in a folder called Editor, or the 2D Sprite package is missing (3D template)','Console errors about `UnityEditor.U2D.Sprites`','Keep `Editor/NerulioSpriteImporter.cs`; install 2D Sprite in the Package Manager'],
    ['"is not inside this project\'s Assets folder"','The JSON picked in the file dialog lies outside `Assets/`','Path shown in the error','Copy the bundle into `Assets/` and pick that copy'],
    ['Sprites have the wrong size next to your tiles','The export uses PPU 100 and your tiles another value','Compare Pixels Per Unit on both textures','Set the same PPU on every sprite texture'],
    ['Your own import changes are gone','Running Import Studio JSON again re-applies Point, Uncompressed, PPU 100 and recreates clips of the same name','Did you re-run the menu after editing?','Re-apply your changes after each import, or rename clips you edited by hand']]},
   alternatives:{rows:[
    ['Unity\'s own Sprite Editor slicing (manual route above)','A uniform sheet and a few clips at one frame rate: nothing extra in the project.'],
    ['Slice › Automatic','Sprites separated by transparency and no need for equal cells; check the pivots, because each rect gets its own size.'],
    ['The .aseprite source instead','Tags and per-frame timing come along: [[game/aseprite-to-unity|Aseprite to Unity]].'],
    ['A TexturePacker atlas','Frames already packed with their data: [[game/texturepacker-to-unity|TexturePacker to Unity]].']]},
   limits:['The export always writes PPU 100; change it in Unity if your game uses another value.','The verification checked rects, pivots, pixels and clip keys, not clips playing through an Animator at runtime.','Hitboxes and collision polygons are not written for Unity; they stay in the generic JSON.'],
   versions:{body:['Nerulio\'s Unity bundle was run in Unity 6000.5.3f1 batch mode: the shipped importer\'s Apply and CreateClips were called (by reflection, because the menu opens a file dialog), and Point filtering, Uncompressed, Multiple mode, 60 of 60 sprite rects of a 288 × 480 samurai sheet, identical art, one common pivot anchor and the clip keys and times were read back. The Unity steps and settings named above follow the Unity 6 manual and the 2D Pixel Perfect package documentation.'],sources:UNITY_DOCS}
  },
  ko:{
   answer:'유니티 6에서 스프라이트 시트를 쓰려면 PNG의 Texture Type을 Sprite (2D and UI), Sprite Mode를 Multiple로 하고 Sprite Editor에서 Slice › Grid By Cell Size를 고릅니다. Pixel Size는 프레임 크기, Offset은 여백, Padding은 간격입니다. 픽셀아트라면 Filter Mode를 Point (no filter), Compression을 None으로 하고 모든 스프라이트의 Pixels Per Unit을 같게 한 뒤 스프라이트로 AnimationClip을 만듭니다. Nerulio는 격자 측정과 클립 만들기를 대신합니다. PNG, JSON, 스프라이트 영역을 피벗과 함께 쓰고 애니메이션마다 클립을 만드는 편집기 스크립트를 내보냅니다. Unity 6000.5.3f1에서 확인했습니다.',
   concept:{title:'유니티가 텍스처 한 장을 여러 스프라이트로 나누는 방식',body:[
    '유니티는 스프라이트 시트를 스프라이트 하위 에셋 여러 개를 가진 텍스처 에셋 하나로 다룹니다. Sprite Mode Multiple은 이미지에 요소가 여러 개 있다는 뜻이고, Sprite Editor가 스프라이트마다 사각형 하나와 피벗 하나를 저장합니다. Slice 메뉴에는 Automatic(투명으로 떨어진 덩어리), Grid By Cell Size, Grid By Cell Count, Isometric Grid가 있습니다. 격자에서는 Pixel Size가 칸, Offset이 왼쪽 위 기준 격자 이동, Padding이 스프라이트 사이 간격이고, Keep Empty Rects는 빈 칸도 스프라이트로 남길지 정합니다.',
    'Pixels Per Unit은 텍스처 몇 픽셀이 월드 1유닛인지 정합니다. 64px 프레임은 기본값 100에서 0.64유닛, 64에서는 정확히 1유닛입니다. 2D Pixel Perfect 문서는 모든 스프라이트에 같은 PPU, Filter Mode Point, Compression None을 권합니다. Bilinear 필터와 압축이 픽셀아트를 뭉개고 번지게 만드는 원인입니다.',
    '유니티의 애니메이션은 정해진 시각에 SpriteRenderer의 스프라이트를 바꾸는 키를 가진 AnimationClip이고, Animator가 Animator Controller를 통해 재생합니다. Animation 창에서 클립을 만들면 컨트롤러와 Animator 컴포넌트도 자동으로 생깁니다. 시트로 직접 만든 클립은 보통 모든 스프라이트에 같은 프레임 속도를 씁니다.',
    'Nerulio는 격자를 재고(신뢰도를 보고 바꿀 수 있음) 행 애니메이션 이름, 프레임별 시간, 피벗을 정하게 한 뒤 파일 세 개를 내보냅니다. 편집기 스크립트가 텍스처를 Sprite / Multiple / Point / 무압축 / 밉맵 없음 / PPU 100으로 설정하고, 프레임마다 피벗이 있는 스프라이트 영역을 쓰고, 프레임마다 제 시작 시각에 키가 있는 `.anim`을 애니메이션마다 만듭니다.'],
    terms:[['Sprite Mode Multiple','텍스처에 스프라이트가 여러 개 있고, 영역은 Sprite Editor에서 정함.'],['Pixels Per Unit (PPU)','월드 1유닛당 텍스처 픽셀 수. 한 게임의 모든 스프라이트에서 같게 유지.'],['Grid By Cell Size','Pixel Size(칸), Offset(여백), Padding(간격)을 받는 슬라이스 방식.'],['피벗','스프라이트의 원점. 영역 안에서 0~1로 정규화, y는 위쪽.'],['AnimationClip','시간에 따라 SpriteRenderer.sprite를 바꾸는 키 모음. Animator가 재생.']]},
   example:{title:'예시: 384 × 128 시트, 애니메이션 두 개',lines:[
    '시트 384 × 128 px: 64 × 64 칸이 2행 × 6열, 여백·간격 없음',
    '  Grid By Cell Size: Pixel Size 64 × 64, Offset 0 × 0, Padding 0 × 0 → 스프라이트 12개',
    '  월드 크기: 64 px / PPU 100 = 0.64유닛      64 px / PPU 64 = 1유닛',
    '',
    'Nerulio 내보내기(행 이름 idle·run, 프레임 125 ms, 피벗 하단 중앙):',
    '  유니티 영역 y(원점 왼쪽 아래) = 페이지 높이 − (y + h)',
    '  하단 중앙 피벗 → 각 영역 안에서 (0.5, 0)',
    '  run.anim 키: 0, 0.125, 0.25, 0.375, 0.5, 0.625초 + 마무리 키 0.75초',
    '  loop on(반복 ∞)      클립 프레임 속도 10'],
    after:'마무리 키는 마지막 스프라이트를 한 번 더 넣어, 클립이 처음으로 돌아가기 전에 마지막 프레임도 125ms를 온전히 보여 주게 합니다.'},
   outputs:{lead:'패킹·내보내기 › Unity 6이 쓰는 파일(파일 이름을 따르며 여기서는 `hero`)입니다.',rows:[
    ['hero.png','패킹된 프레임(트림, 2px 간격, 회전 없음). 양이 많으면 페이지가 늘어납니다.'],
    ['hero.unity.json','유니티의 왼쪽 아래 기준 좌표로 변환한 스프라이트 영역, 정규화한 피벗, 프레임별 밀리초가 든 클립 정보.'],
    ['Editor/NerulioSpriteImporter.cs','Tools › Nerulio › Import Studio JSON 메뉴의 편집기 스크립트: 가져오기 설정, 스프라이트 영역, AnimationClip.'],
    ['README-UNITY.md','이 번들에 맞춘 아래 단계.']]},
   target:{title:'유니티 6로 가져오기',steps:[
    '압축을 푼 폴더를 `Assets/` 아래(예: `Assets/Characters/Hero/`)에 복사하고 PNG는 JSON 옆에 둡니다. `NerulioSpriteImporter.cs`가 든 `Editor` 폴더는 유니티가 컴파일하며, 모든 2D 템플릿에 있는 2D Sprite 패키지(`com.unity.2d.sprite`)가 필요합니다.',
    'Tools › Nerulio › Import Studio JSON을 고르고 프로젝트 안의 `hero.unity.json`을 선택합니다.',
    '스크립트가 텍스처를 Sprite (2D and UI), Multiple, Point (no filter), 무압축, 밉맵 없음, PPU 100으로 바꾸고 프레임마다 피벗이 있는 스프라이트를 씁니다. Sprite Editor를 열면 영역이 보입니다.',
    'JSON 옆에 애니메이션마다 클립(`idle.anim`, `run.anim`)도 씁니다. 프레임마다 제 시각에 SpriteRenderer의 스프라이트를 키로 잡고, Loop Time은 태그대로입니다.',
    '클립을 Animator Controller에 넣고, SpriteRenderer가 있는 게임 오브젝트의 Animator에 그 컨트롤러를 지정합니다.',
    '게임이 다른 PPU(예: 16px 타일이면 16)를 쓴다면 가져온 뒤 텍스처의 Pixels Per Unit을 모든 스프라이트에서 같은 값으로 바꿉니다.'],
    note:['Nerulio 없이 하려면: PNG를 고르고 Texture Type을 Sprite (2D and UI), Sprite Mode를 Multiple, Filter Mode를 Point (no filter), Compression을 None으로 해서 적용합니다. Sprite Editor에서 Slice › Grid By Cell Size를 고르고 Pixel Size, Offset, Padding, Pivot을 넣은 뒤 Slice와 Apply를 누릅니다. 그다음 Window › Animation › Animation을 열어 게임 오브젝트의 클립을 만들고 일정한 간격으로 스프라이트 키를 잡습니다.']},
   verify:{steps:[
    'Sprite Editor에서 채워진 칸마다 영역이 하나씩 있고, 피벗 표시가 발 위치에 있어야 합니다.',
    '텍스처 인스펙터가 Filter Mode Point (no filter), Compression None이어야 합니다.',
    'Animation 창에서 `run.anim`의 키 6개가 0.125초 간격이고 0.75초에 끝나야 합니다.',
    'Game 뷰를 정수 배율로 보면 픽셀 경계가 선명하고, 프레임이 바뀌어도 발이 움직이지 않아야 합니다.']},
   trouble:{rows:[
    ['스프라이트가 흐리거나 번짐','Bilinear 필터나 텍스처 압축','텍스처 인스펙터의 Filter Mode와 Compression','Point (no filter)와 None으로. [[game/unity-pixel-art-blurry|유니티 픽셀아트 흐림]] 참고'],
    ['슬라이스가 밀리거나 스프라이트를 반으로 자름','Pixel Size에 간격이 포함됐거나 Offset·Padding이 틀림','마지막 열에서 빨간 슬라이스 윤곽과 그림을 비교','잰 칸·여백·간격을 입력. [[game/sprite-sheet-frame-size|프레임 크기]] 참고'],
    ['Tools › Nerulio 메뉴가 없거나 스크립트가 컴파일되지 않음','스크립트가 Editor라는 폴더에 없거나 2D Sprite 패키지가 없음(3D 템플릿)','콘솔의 `UnityEditor.U2D.Sprites` 관련 오류','`Editor/NerulioSpriteImporter.cs` 위치를 유지하고 패키지 관리자에서 2D Sprite 설치'],
    ['"is not inside this project\'s Assets folder" 오류','파일 대화상자에서 고른 JSON이 `Assets/` 밖에 있음','오류에 나온 경로','번들을 `Assets/`에 복사하고 그 사본을 선택'],
    ['타일 옆에서 스프라이트 크기가 맞지 않음','내보내기는 PPU 100인데 타일은 다른 값','두 텍스처의 Pixels Per Unit 비교','모든 스프라이트 텍스처의 PPU를 같게'],
    ['직접 바꾼 가져오기 설정이 사라짐','Import Studio JSON을 다시 돌리면 Point·무압축·PPU 100을 다시 적용하고 같은 이름의 클립을 새로 만듦','수정 후 메뉴를 다시 실행했는지 확인','가져올 때마다 설정을 다시 적용하거나, 손으로 고친 클립은 이름을 바꾸기']]},
   alternatives:{rows:[
    ['유니티 자체 Sprite Editor 슬라이스(위의 수동 방법)','균일한 시트에 프레임 속도가 하나인 클립 몇 개라면 프로젝트에 더할 것이 없습니다.'],
    ['Slice › Automatic','투명으로 떨어진 스프라이트이고 칸 크기가 같을 필요가 없을 때. 영역마다 크기가 달라지니 피벗을 확인하세요.'],
    ['원본 .aseprite 파일로','태그와 프레임별 시간까지 옮겨집니다: [[game/aseprite-to-unity|Aseprite를 유니티로]].'],
    ['TexturePacker 아틀라스','데이터와 함께 이미 패킹된 프레임: [[game/texturepacker-to-unity|TexturePacker를 유니티로]].']]},
   limits:['내보내기는 항상 PPU 100을 씁니다. 게임이 다른 값을 쓰면 유니티에서 바꾸세요.','검증에서는 영역·피벗·픽셀·클립 키를 확인했고, 실행 중 Animator로 클립이 재생되는지는 확인하지 않았습니다.','히트박스와 충돌 폴리곤은 유니티용으로 쓰지 않고 범용 JSON에만 남습니다.'],
   versions:{body:['Nerulio의 유니티 번들을 Unity 6000.5.3f1 배치 모드에서 실행했습니다. 함께 온 가져오기 스크립트의 Apply와 CreateClips를 호출하고(메뉴가 파일 대화상자를 열기 때문에 리플렉션으로 호출), Point 필터, 무압축, Multiple 모드, 288 × 480 사무라이 시트의 스프라이트 영역 60개 중 60개, 동일한 그림, 하나의 공통 피벗 기준, 클립 키와 시간을 다시 읽어 확인했습니다. 위에 적은 유니티 단계와 설정은 유니티 6 매뉴얼과 2D Pixel Perfect 패키지 문서를 따릅니다.'],sources:UNITY_DOCS}
  },
  ja:{
   answer:'Unity 6でスプライトシートを使うには、PNGのTexture TypeをSprite (2D and UI)、Sprite ModeをMultipleにし、Sprite EditorでSlice › Grid By Cell Sizeを選びます。Pixel Sizeがフレームサイズ、Offsetが余白、Paddingが間隔です。ドット絵ならFilter ModeをPoint (no filter)、CompressionをNoneにし、全スプライトのPixels Per Unitをそろえてから、スプライトでAnimationClipを作ります。Nerulioは測定とクリップ作りを肩代わりします。PNG、JSON、スプライトの範囲をピボット付きで書きアニメーションごとにクリップを作るエディタースクリプトを書き出します。Unity 6000.5.3f1で確認済みです。',
   concept:{title:'Unityが1枚のテクスチャを複数のスプライトに分ける仕組み',body:[
    'Unityはスプライトシートを、複数のSpriteサブアセットを持つ1つのテクスチャアセットとして扱います。Sprite Mode Multipleは画像に複数の要素があるという意味で、Sprite Editorがスプライトごとに矩形1つとピボット1つを保存します。SliceメニューにはAutomatic（透明で分かれた塊）、Grid By Cell Size、Grid By Cell Count、Isometric Gridがあります。グリッドではPixel Sizeがセル、Offsetが左上からのグリッドのずらし、Paddingがスプライト間の間隔で、Keep Empty Rectsは空のセルもスプライトにするかを決めます。',
    'Pixels Per Unitは、テクスチャの何ピクセルをワールドの1ユニットにするかを決めます。64pxのフレームは既定値100では0.64ユニット、64ならちょうど1ユニットです。2D Pixel Perfectのドキュメントは、全スプライトで同じPPU、Filter Mode Point、Compression Noneを求めています。Bilinearフィルターと圧縮が、ドット絵をぼかしたりにじませたりする原因です。',
    'Unityのアニメーションは、決まった時刻にSpriteRendererのスプライトを切り替えるキーを持つAnimationClipで、AnimatorがAnimator Controllerを通して再生します。Animationウィンドウでクリップを作ると、コントローラーとAnimatorコンポーネントも自動で作られます。シートから手作業で作ったクリップは、ふつう全スプライトに同じフレームレートを使います。',
    'Nerulioはグリッドを測り（信頼度を見て変更可能）、行アニメーションの名前、フレームごとの時間、ピボットを決めさせてから3つのファイルを書き出します。エディタースクリプトはテクスチャをSprite / Multiple / Point / 無圧縮 / ミップマップなし / PPU 100に設定し、フレームごとにピボット付きのスプライト範囲を書き、各フレーム自身の開始時刻にキーを持つ`.anim`をアニメーションごとに作ります。'],
    terms:[['Sprite Mode Multiple','テクスチャに複数のスプライトがあり、範囲はSprite Editorで決める。'],['Pixels Per Unit（PPU）','ワールド1ユニットあたりのテクスチャのピクセル数。ゲーム内の全スプライトでそろえる。'],['Grid By Cell Size','Pixel Size（セル）、Offset（余白）、Padding（間隔）を受け取るスライス方式。'],['ピボット','スプライトの原点。範囲内で0〜1に正規化し、yは上向き。'],['AnimationClip','時間とともにSpriteRenderer.spriteを変えるキーの集まり。Animatorが再生する。']]},
   example:{title:'例：384 × 128のシート、アニメーション2つ',lines:[
    'シート384 × 128 px：64 × 64のセルが2行 × 6列、余白・間隔なし',
    '  Grid By Cell Size：Pixel Size 64 × 64、Offset 0 × 0、Padding 0 × 0 → スプライト12個',
    '  ワールドでの大きさ：64 px / PPU 100 = 0.64ユニット     64 px / PPU 64 = 1ユニット',
    '',
    'Nerulioの書き出し（行名idle・run、フレーム125 ms、ピボット下中央）：',
    '  Unityの範囲のy（原点は左下）= ページの高さ −（y + h）',
    '  下中央のピボット → 各範囲内で(0.5, 0)',
    '  run.animのキー：0, 0.125, 0.25, 0.375, 0.5, 0.625秒 + 締めのキー0.75秒',
    '  loop on（繰り返し∞）      クリップのフレームレート10'],
    after:'締めのキーは最後のスプライトをもう一度置き、クリップが先頭に戻る前に最後のフレームも125msきちんと表示されるようにします。'},
   outputs:{lead:'パック＆書き出し › Unity 6が書き出すファイル（ファイル名に由来し、ここでは`hero`）です。',rows:[
    ['hero.png','パックしたフレーム（トリム、2px間隔、回転なし）。数が多ければページが増えます。'],
    ['hero.unity.json','Unityの左下基準の座標に直したスプライト範囲、正規化したピボット、フレームごとのミリ秒入りのクリップ情報。'],
    ['Editor/NerulioSpriteImporter.cs','Tools › Nerulio › Import Studio JSONメニューのエディタースクリプト：インポート設定、スプライト範囲、AnimationClip。'],
    ['README-UNITY.md','このバンドル用の下記の手順。']]},
   target:{title:'Unity 6に取り込む',steps:[
    '展開したフォルダーを`Assets/`以下（例：`Assets/Characters/Hero/`）にコピーし、PNGはJSONの隣に置きます。`NerulioSpriteImporter.cs`の入った`Editor`フォルダーはUnityがコンパイルし、どの2Dテンプレートにも入っている2D Spriteパッケージ（`com.unity.2d.sprite`）が必要です。',
    'Tools › Nerulio › Import Studio JSONを選び、プロジェクト内の`hero.unity.json`を指定します。',
    'スクリプトがテクスチャをSprite (2D and UI)、Multiple、Point (no filter)、無圧縮、ミップマップなし、PPU 100にし、フレームごとにピボット付きのスプライトを書きます。Sprite Editorを開くと範囲が見えます。',
    'JSONの隣にアニメーションごとのクリップ（`idle.anim`、`run.anim`）も書きます。各フレームの時刻にSpriteRendererのスプライトをキーにし、Loop Timeはタグのとおりです。',
    'クリップをAnimator Controllerに入れ、SpriteRendererを持つゲームオブジェクトのAnimatorにそのコントローラーを割り当てます。',
    'ゲームが別のPPU（16pxタイルなら16など）を使うなら、取り込み後にテクスチャのPixels Per Unitを全スプライトで同じ値に変えます。'],
    note:['Nerulioを使わない場合：PNGを選び、Texture TypeをSprite (2D and UI)、Sprite ModeをMultiple、Filter ModeをPoint (no filter)、CompressionをNoneにして適用します。Sprite EditorでSlice › Grid By Cell Sizeを選び、Pixel Size・Offset・Padding・Pivotを入れてSliceとApplyを押します。続いてWindow › Animation › Animationを開き、ゲームオブジェクトのクリップを作って一定間隔でスプライトのキーを打ちます。']},
   verify:{steps:[
    'Sprite Editorで、埋まったセルごとに範囲が1つあり、ピボットの印が足元にあるはずです。',
    'テクスチャのインスペクターがFilter Mode Point (no filter)、Compression Noneになっているはずです。',
    'Animationウィンドウで`run.anim`のキー6つが0.125秒間隔で並び、0.75秒で終わるはずです。',
    'Gameビューを整数倍で見ると、ピクセルの境界がくっきりし、フレームが変わっても足が動かないはずです。']},
   trouble:{rows:[
    ['スプライトがぼやける・にじむ','Bilinearフィルターかテクスチャ圧縮','テクスチャのインスペクターのFilter ModeとCompression','Point (no filter)とNoneに。[[game/unity-pixel-art-blurry|Unityのドット絵のぼやけ]]を参照'],
    ['スライスがずれる、スプライトを半分に切る','Pixel Sizeに間隔が含まれている、またはOffset・Paddingが違う','最後の列で赤いスライスの枠と絵を比べる','測ったセル・余白・間隔を入れる。[[game/sprite-sheet-frame-size|フレームサイズ]]を参照'],
    ['Tools › Nerulioがない、スクリプトがコンパイルされない','スクリプトがEditorという名前のフォルダーにない、または2D Spriteパッケージがない（3Dテンプレート）','コンソールの`UnityEditor.U2D.Sprites`関連のエラー','`Editor/NerulioSpriteImporter.cs`の場所を保ち、パッケージマネージャーで2D Spriteを入れる'],
    ['「is not inside this project\'s Assets folder」と出る','ファイルダイアログで選んだJSONが`Assets/`の外にある','エラーに出ているパス','バンドルを`Assets/`にコピーし、そのコピーを選ぶ'],
    ['タイルと並べるとスプライトの大きさが合わない','書き出しはPPU 100で、タイルは別の値','2つのテクスチャのPixels Per Unitを比べる','全スプライトのテクスチャでPPUをそろえる'],
    ['自分で変えたインポート設定が消えた','Import Studio JSONを再実行すると、Point・無圧縮・PPU 100を再適用し、同名のクリップを作り直す','編集後にメニューを再実行したか確認','取り込みのたびに設定をかけ直すか、手で直したクリップは名前を変える']]},
   alternatives:{rows:[
    ['Unity自体のSprite Editorでのスライス（上の手作業の方法）','均一なシートで、フレームレートが1つのクリップが少しなら、プロジェクトに何も足さずに済みます。'],
    ['Slice › Automatic','透明で分かれたスプライトで、セルの大きさをそろえる必要がないとき。範囲ごとに大きさが変わるのでピボットを確認してください。'],
    ['元の.asepriteファイルから','タグとフレームごとの時間も移せます：[[game/aseprite-to-unity|AsepriteをUnityへ]]。'],
    ['TexturePackerのアトラス','データ付きですでにパック済みのフレーム：[[game/texturepacker-to-unity|TexturePackerをUnityへ]]。']]},
   limits:['書き出しは常にPPU 100です。ゲームが別の値を使うならUnityで変えてください。','検証では範囲・ピボット・ピクセル・クリップのキーを確かめましたが、実行時にAnimatorでクリップが再生されるかは確かめていません。','ヒットボックスと当たり判定のポリゴンはUnity向けには書かず、汎用JSONにだけ残ります。'],
   versions:{body:['NerulioのUnityバンドルをUnity 6000.5.3f1のバッチモードで実行しました。同梱のインポートスクリプトのApplyとCreateClipsを呼び出し（メニューがファイルダイアログを開くためリフレクションで呼び出し）、Pointフィルター、無圧縮、Multipleモード、288 × 480のサムライのシートのスプライト範囲60個中60個、同一の絵、1つの共通ピボット基準、クリップのキーと時間を読み戻して確認しました。上に書いたUnityの手順と設定は、Unity 6のマニュアルと2D Pixel Perfectパッケージのドキュメントに基づきます。'],sources:UNITY_DOCS}
  }
 },
 // ------------------------------------------------------------------ Aseprite → Unity
 // Nerulio: aseprite import (studio/sprite/aseprite-bridge.js: tags, repeat, reverse, pivot slice), export/unity.js
 // (clip keys = cumulative ms, closing key, loopTime = repeat 0, pivot y-up), common.js playback (ping-pong 0-1-2-1).
 // Unity's own importer: com.unity.2d.aseprite 4.0 docs (forward only, slices unsupported, ∞ → loop, 1..N → no loop).
 'game/aseprite-to-unity':{
  type:'conversion',
  intent:{primary:'convert an .aseprite file into Unity 6 sprites and animation clips',secondary:['keep tags and per-frame durations','pivot from an Aseprite slice','compare with Unity\'s 2D Aseprite Importer'],
   goal:'one Unity AnimationClip per Aseprite tag with each frame\'s own duration, on Point-filtered sprites with the right pivots',input:'.aseprite / .ase file (tags, per-frame durations, optional pivot slice)',output:'packed PNG + .unity.json + Editor/NerulioSpriteImporter.cs → sprites and .anim clips in Unity',target:'Unity 6 (verified 6000.5.3f1)',support:'full',
   evidence:['src/studio/sprite/aseprite-bridge.js','src/game/export/unity.js','src/game/export/common.js playback()','docs/STUDIO-PACK.md (Unity 6000.5.3f1)','docs/STUDIO-SPRITE.md §10 (231 .aseprite files)'],
   external:['2D Aseprite Importer 4.0: supported features and limits','Unity 6.5 Manual: Sprite import settings','2D Pixel Perfect import settings']},
  en:{
   answer:'Unity cannot play an `.aseprite` file by itself: it needs sprites on a texture and an AnimationClip per animation. Drop the file into Nerulio, check its tags, and export for Unity 6: you get the packed PNG, a JSON and an editor script that, from Tools › Nerulio › Import Studio JSON, slices the texture (Point, uncompressed, pivots from your pivot slice) and writes one `.anim` per tag with every frame\'s own duration. Reverse and ping-pong tags are written out frame by frame. Checked in Unity 6000.5.3f1; Unity\'s own 2D Aseprite Importer package is the alternative.',
   concept:{title:'From Aseprite tags to Unity clips',body:[
    'An `.aseprite` file stores frames with a duration in milliseconds each, tags that name a frame range with a direction (forward, reverse, ping-pong) and a repeat count, layers, and slices that can carry a pivot. Unity\'s equivalent is a texture in Sprite Mode Multiple, one sprite per frame with a normalised pivot, and an AnimationClip whose keys swap the SpriteRenderer\'s sprite at given times.',
    'Nerulio composites the visible layers of every frame, packs the frames and writes their rects in Unity\'s bottom-left coordinates. Each tag becomes a clip whose keys sit at the running sum of the frame durations, plus a closing key so the last frame lasts its full time. A tag that repeats forever gets Loop Time on; a tag with a repeat count gets Loop Time off, because a clip has no repeat count.',
    'Unity\'s own 2D Aseprite Importer (version 4.x needs Unity 6.4 or later) imports the file directly and reimports it on save. According to its documentation it supports individual frame timings and turns ∞ into a looping clip, but only the Forward direction is supported and slices are not imported.'],
    terms:[['Tag','A named frame range in Aseprite with a direction and a repeat count.'],['Pivot slice','An Aseprite slice with a pivot point; Nerulio uses it as each frame\'s pivot.'],['Loop Time','The AnimationClip setting that makes a clip repeat.'],['Closing key','A final key that repeats the last sprite so it keeps its own duration.']]},
   example:{title:'Example: a 32 × 32 hero with three tags',lines:[
    'Aseprite                                 Unity 6 AnimationClip (key times, s)',
    'idle    4 frames × 125 ms, ∞             idle.anim    0, 0.125, 0.25, 0.375 | end 0.5    loop on',
    'attack  100, 100, 150, 250 ms, ×1         attack.anim  0, 0.1, 0.2, 0.35 | end 0.6        loop off',
    'jump    3 frames × 80 ms, ping-pong       jump.anim    frames 0-1-2-1: 0, 0.08, 0.16, 0.24 | end 0.32',
    '',
    'pivot slice at (16, 31) on the 32 × 32 canvas, frame not trimmed',
    '  Unity pivot = (16 / 32, (32 − 31) / 32) = (0.5, 0.03125)   (y counts up)'],
    after:'The ping-pong tag is written as the order 0-1-2-1, so it plays the same in Unity without relying on a direction setting.'},
   mapping:{title:'What survives the conversion',head:['In Aseprite','In Nerulio','In Unity 6'],rows:[
    ['Frame pixels (visible layers)','Composited frame, packed into the PNG','One sprite rect of that texture'],
    ['Frame duration (ms)','Kept per frame','Key time: each frame starts at the sum of the previous durations'],
    ['Tag','One animation of the same name','One `.anim` clip of the same name'],
    ['Direction reverse / ping-pong','Playback order written out','Keys in that order'],
    ['Repeat ∞','Loop','Loop Time on'],
    ['Repeat 1, 2, 3…','Plays that many times in the preview','Loop Time off: the clip plays once'],
    ['Pivot slice (or a pivot set with P)','Frame pivot (default bottom centre)','Sprite pivot, Custom alignment, y up'],
    ['Hit / hurt slices','Boxes per frame','Not written for Unity (they are in the generic JSON)'],
    ['Layers','Composited','One sprite per frame, no per-layer sprites']]},
   outputs:{rows:[
    ['hero.png','The packed frames (Point-friendly: trimmed, 2 px apart, never rotated).'],
    ['hero.unity.json','Sprite rects in Unity coordinates, normalised pivots, and one clip per tag with each frame\'s milliseconds and loop flag.'],
    ['Editor/NerulioSpriteImporter.cs','The editor script: texture settings, sprite rects, `.anim` clips.'],
    ['README-UNITY.md','The import steps for this bundle.']]},
   target:{title:'Import it into Unity 6',steps:[
    'Copy the bundle folder into `Assets/`, PNG next to the JSON, with its `Editor` subfolder. Unity compiles the script; the 2D Sprite package must be installed (it is in every 2D template).',
    'Run Tools › Nerulio › Import Studio JSON and pick `hero.unity.json`.',
    'Check the texture: Sprite (2D and UI), Multiple, Point (no filter), Compression None, PPU 100; the Sprite Editor shows one rect per frame with its pivot.',
    'Find `idle.anim`, `attack.anim` and `jump.anim` next to the JSON; open one in the Animation window to see its keys.',
    'Add the clips to an Animator Controller on a GameObject with a SpriteRenderer; for a play-once tag such as `attack`, add a transition back to `idle` when it ends.',
    'Keep the `.aseprite` file itself out of `Assets/` if Unity\'s Aseprite Importer package is installed, or Unity imports it a second time its own way.']},
   verify:{steps:[
    '`attack.anim` has keys at 0, 0.1, 0.2 and 0.35 s and ends at 0.6 s, the total of the tag in Aseprite.',
    'Loop Time is on for `idle` and off for `attack`.',
    'Play `jump` next to Aseprite\'s preview: the order 0-1-2-1 and the 80 ms steps match.',
    'Switch clips: the feet stay on the pivot point.']},
   trouble:{rows:[
    ['A clip plays once instead of looping','The tag has a repeat count in Aseprite (anything but ∞)','Loop Time in the clip\'s Inspector','Set the tag to ∞ and export again, or tick Loop Time in Unity'],
    ['Console: "clip … names a missing sprite"','The PNG was renamed or moved away from the JSON before importing','Is the PNG next to the JSON with its exported name?','Keep the files together and run the import again'],
    ['The sprite is blurry','Filter Mode or compression was changed after the import','Texture Inspector','Point (no filter) and Compression None; see [[game/unity-pixel-art-blurry|blurry pixel art in Unity]]'],
    ['The character jumps between frames','No pivot slice, so each frame uses the default bottom centre, or pivots differ per frame','Sprite Editor: pivot markers across frames','Add one pivot slice in Aseprite or set pivots with P in Nerulio; see [[game/sprite-pivot-editor|the pivot editor]]'],
    ['Two copies of every sprite appear','Unity\'s Aseprite Importer also imported the `.aseprite` file placed in `Assets/`','Project window shows the .aseprite asset expanded','Use one route: remove the .aseprite from `Assets/`, or skip this bundle'],
    ['A ping-pong tag plays only forwards','That is Unity\'s own importer (forward only), not this bundle','Which asset does the Animator use?','Use the `.anim` from this bundle, which has the order written out']]},
   alternatives:{rows:[
    ['Unity\'s 2D Aseprite Importer package','You edit in Aseprite all day and want Unity to reimport on save, with per-layer import; accept forward-only tags and no slices.'],
    ['Export a PNG sheet from Aseprite and slice it in the Sprite Editor','One or two animations at an even frame rate; see [[game/unity-sprite-sheet|slicing a sprite sheet in Unity]].'],
    ['The same file for another engine','[[game/aseprite-to-godot|Aseprite to Godot]] or [[game/aseprite-to-phaser|Aseprite to Phaser]].']]},
   limits:['Layers arrive flattened into one sprite per frame.','A repeat count above one is not kept: the clip plays once.','Hit and hurt boxes are not written for Unity.'],
   versions:{body:['Nerulio\'s Unity bundle was checked in Unity 6000.5.3f1 batch mode (sprite rects, pivots, pixels, Point / Uncompressed / Multiple, clip keys and times); clips playing through an Animator at runtime were not checked. The .aseprite reader reopened 231 real files in Aseprite 1.3.18 with the same tags, durations and pixels. What is said about Unity\'s own Aseprite Importer comes from its version 4.0 documentation.'],sources:[...UNITY_ASE,UNITY_DOCS[2],UNITY_DOCS[3],'[Aseprite docs: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ko:{
   answer:'유니티는 `.aseprite` 파일을 그대로 재생하지 못하고, 텍스처 위의 스프라이트와 애니메이션마다 AnimationClip이 필요합니다. 파일을 Nerulio에 넣고 태그를 확인한 뒤 Unity 6으로 내보내면 패킹된 PNG, JSON, 편집기 스크립트가 나옵니다. Tools › Nerulio › Import Studio JSON을 실행하면 스크립트가 텍스처를 자르고(Point, 무압축, 피벗 슬라이스의 피벗) 태그마다 프레임별 길이가 그대로인 `.anim`을 씁니다. 역재생·핑퐁 태그는 프레임 단위로 풀어 씁니다. Unity 6000.5.3f1에서 확인했고, 유니티 자체의 2D Aseprite Importer 패키지가 대안입니다.',
   concept:{title:'Aseprite 태그에서 유니티 클립으로',body:[
    '`.aseprite` 파일에는 프레임마다 밀리초 길이, 방향(정방향·역방향·핑퐁)과 반복 횟수가 있는 태그, 레이어, 피벗을 담을 수 있는 슬라이스가 들어 있습니다. 유니티에서 이에 해당하는 것은 Sprite Mode Multiple 텍스처, 정규화한 피벗을 가진 프레임별 스프라이트, 그리고 정해진 시각에 SpriteRenderer의 스프라이트를 바꾸는 키를 가진 AnimationClip입니다.',
    'Nerulio는 프레임마다 보이는 레이어를 합성해 패킹하고, 영역을 유니티의 왼쪽 아래 기준 좌표로 씁니다. 태그 하나는 클립 하나가 되며, 키는 프레임 길이의 누적 합 위치에 놓이고, 마지막 프레임도 제 길이를 채우도록 마무리 키가 붙습니다. 무한 반복 태그는 Loop Time 켬, 반복 횟수가 있는 태그는 Loop Time 끔입니다. 클립에는 반복 횟수가 없기 때문입니다.',
    '유니티 자체의 2D Aseprite Importer(4.x는 Unity 6.4 이상 필요)는 파일을 직접 가져오고 저장할 때마다 다시 가져옵니다. 문서에 따르면 프레임별 시간을 지원하고 ∞를 반복 클립으로 만들지만, 방향은 Forward만 지원하고 슬라이스는 가져오지 않습니다.'],
    terms:[['태그','Aseprite에서 방향과 반복 횟수가 있는, 이름 붙은 프레임 구간.'],['피벗 슬라이스','피벗 점을 가진 Aseprite 슬라이스. Nerulio는 이를 프레임 피벗으로 씁니다.'],['Loop Time','클립을 반복시키는 AnimationClip 설정.'],['마무리 키','마지막 스프라이트를 한 번 더 넣어 제 길이를 유지하게 하는 마지막 키.']]},
   example:{title:'예시: 태그가 3개인 32 × 32 캐릭터',lines:[
    'Aseprite                                 Unity 6 AnimationClip (키 시각, 초)',
    'idle    4프레임 × 125 ms, ∞              idle.anim    0, 0.125, 0.25, 0.375 | 끝 0.5    loop on',
    'attack  100, 100, 150, 250 ms, ×1         attack.anim  0, 0.1, 0.2, 0.35 | 끝 0.6        loop off',
    'jump    3프레임 × 80 ms, 핑퐁             jump.anim    프레임 0-1-2-1: 0, 0.08, 0.16, 0.24 | 끝 0.32',
    '',
    '32 × 32 캔버스의 (16, 31)에 피벗 슬라이스, 트림하지 않은 프레임',
    '  유니티 피벗 = (16 / 32, (32 − 31) / 32) = (0.5, 0.03125)   (y는 위로 증가)'],
    after:'핑퐁 태그는 0-1-2-1 순서로 풀어 쓰므로 유니티에서 방향 설정에 기대지 않고도 똑같이 재생됩니다.'},
   mapping:{title:'변환 후에도 남는 것',head:['Aseprite','Nerulio','Unity 6'],rows:[
    ['프레임 픽셀(보이는 레이어)','합성한 프레임을 PNG에 패킹','그 텍스처의 스프라이트 영역 하나'],
    ['프레임 길이(ms)','프레임마다 유지','키 시각: 각 프레임은 앞 프레임 길이의 합에서 시작'],
    ['태그','같은 이름의 애니메이션 하나','같은 이름의 `.anim` 클립 하나'],
    ['방향: 역방향·핑퐁','재생 순서를 풀어서 기록','그 순서대로 놓인 키'],
    ['반복 ∞','반복 재생','Loop Time 켬'],
    ['반복 1, 2, 3…','미리보기에서 그 횟수만큼 재생','Loop Time 끔: 한 번 재생'],
    ['피벗 슬라이스(또는 P로 찍은 피벗)','프레임 피벗(기본값 하단 중앙)','스프라이트 피벗, Custom 정렬, y는 위쪽'],
    ['hit / hurt 슬라이스','프레임별 박스','유니티용으로는 쓰지 않음(범용 JSON에 있음)'],
    ['레이어','합성됨','프레임마다 스프라이트 하나, 레이어별 스프라이트 없음']]},
   outputs:{rows:[
    ['hero.png','패킹된 프레임(트림, 2px 간격, 회전 없음).'],
    ['hero.unity.json','유니티 좌표의 스프라이트 영역, 정규화한 피벗, 태그마다 프레임별 밀리초와 반복 여부가 든 클립 정보.'],
    ['Editor/NerulioSpriteImporter.cs','편집기 스크립트: 텍스처 설정, 스프라이트 영역, `.anim` 클립.'],
    ['README-UNITY.md','이 번들의 가져오기 순서.']]},
   target:{title:'유니티 6로 가져오기',steps:[
    '번들 폴더를 `Editor` 하위 폴더째 `Assets/`에 복사하고 PNG는 JSON 옆에 둡니다. 유니티가 스크립트를 컴파일하며, 2D Sprite 패키지가 있어야 합니다(모든 2D 템플릿에 포함).',
    'Tools › Nerulio › Import Studio JSON을 실행하고 `hero.unity.json`을 고릅니다.',
    '텍스처가 Sprite (2D and UI), Multiple, Point (no filter), Compression None, PPU 100인지 확인합니다. Sprite Editor에는 프레임마다 피벗이 있는 영역이 보입니다.',
    'JSON 옆의 `idle.anim`, `attack.anim`, `jump.anim`을 Animation 창에서 열어 키를 확인합니다.',
    'SpriteRenderer가 있는 게임 오브젝트의 Animator Controller에 클립을 넣습니다. `attack`처럼 한 번만 나오는 태그는 끝나면 `idle`로 돌아가는 전이를 추가합니다.',
    '유니티의 Aseprite Importer 패키지가 설치되어 있다면 `.aseprite` 파일 자체는 `Assets/`에 두지 마세요. 유니티가 자기 방식으로 한 번 더 가져옵니다.']},
   verify:{steps:[
    '`attack.anim`의 키가 0, 0.1, 0.2, 0.35초에 있고 Aseprite 태그 전체 길이인 0.6초에 끝나야 합니다.',
    '`idle`은 Loop Time 켬, `attack`은 끔이어야 합니다.',
    '`jump`를 Aseprite 미리보기와 나란히 재생합니다. 0-1-2-1 순서와 80ms 간격이 같아야 합니다.',
    '클립을 바꿔도 발이 피벗 위치에 머물러야 합니다.']},
   trouble:{rows:[
    ['클립이 반복되지 않고 한 번만 재생됨','Aseprite에서 태그에 반복 횟수(∞ 이외)가 설정됨','클립 인스펙터의 Loop Time','태그를 ∞로 바꿔 다시 내보내거나 유니티에서 Loop Time 체크'],
    ['콘솔에 "clip … names a missing sprite"','가져오기 전에 PNG 이름을 바꾸거나 JSON과 떨어뜨림','PNG가 내보낸 이름 그대로 JSON 옆에 있는지','파일을 함께 두고 다시 가져오기'],
    ['스프라이트가 흐림','가져온 뒤 Filter Mode나 압축 설정을 바꿈','텍스처 인스펙터','Point (no filter)와 Compression None. [[game/unity-pixel-art-blurry|유니티 픽셀아트 흐림]] 참고'],
    ['프레임마다 캐릭터가 튐','피벗 슬라이스가 없어 기본 하단 중앙을 쓰거나 프레임마다 피벗이 다름','Sprite Editor에서 프레임별 피벗 표시 비교','Aseprite에 피벗 슬라이스 하나를 두거나 Nerulio에서 P로 피벗 지정. [[game/sprite-pivot-editor|피벗 편집기]] 참고'],
    ['스프라이트가 두 벌씩 생김','`Assets/`에 둔 `.aseprite`를 유니티 Aseprite Importer도 가져옴','프로젝트 창에서 .aseprite 에셋이 펼쳐져 있음','한 가지 방법만 사용: `Assets/`에서 .aseprite를 빼거나 이 번들을 쓰지 않기'],
    ['핑퐁 태그가 정방향으로만 재생됨','유니티 자체 가져오기(정방향만 지원)의 결과이지 이 번들이 아님','Animator가 어느 에셋의 클립을 쓰는지','순서를 풀어 쓴 이 번들의 `.anim` 사용']]},
   alternatives:{rows:[
    ['유니티 2D Aseprite Importer 패키지','하루 종일 Aseprite로 작업하며 저장할 때마다 유니티가 다시 가져오고 레이어별로 가져오길 원할 때. 태그는 정방향만, 슬라이스는 안 된다는 점을 감안해야 합니다.'],
    ['Aseprite에서 PNG 시트로 내보내 Sprite Editor로 자르기','애니메이션이 한두 개이고 프레임 속도가 일정할 때. [[game/unity-sprite-sheet|유니티에서 스프라이트 시트 자르기]] 참고.'],
    ['같은 파일을 다른 엔진으로','[[game/aseprite-to-godot|Aseprite를 Godot로]], [[game/aseprite-to-phaser|Aseprite를 Phaser로]].']]},
   limits:['레이어는 프레임마다 스프라이트 하나로 합쳐집니다.','2 이상의 반복 횟수는 유지되지 않고 클립은 한 번 재생됩니다.','히트·허트 박스는 유니티용으로 쓰지 않습니다.'],
   versions:{body:['Nerulio의 유니티 번들을 Unity 6000.5.3f1 배치 모드에서 확인했습니다(스프라이트 영역, 피벗, 픽셀, Point·무압축·Multiple, 클립 키와 시간). 실행 중 Animator로 클립이 재생되는지는 확인하지 않았습니다. .aseprite 읽기는 실제 파일 231개가 Aseprite 1.3.18에서 같은 태그·길이·픽셀로 다시 열리는 것으로 확인했습니다. 유니티 자체 Aseprite Importer에 관한 내용은 4.0 버전 문서를 따릅니다.'],sources:[...UNITY_ASE,UNITY_DOCS[2],UNITY_DOCS[3],'[Aseprite 문서: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ja:{
   answer:'Unityは`.aseprite`ファイルをそのまま再生できず、テクスチャ上のスプライトとアニメーションごとのAnimationClipが必要です。ファイルをNerulioに入れてタグを確認し、Unity 6向けに書き出すと、パック済みPNG、JSON、エディタースクリプトが得られます。Tools › Nerulio › Import Studio JSONを実行すると、スクリプトがテクスチャを切り（Point・無圧縮・ピボットスライスのピボット）、タグごとにフレームごとの長さそのままの`.anim`を書きます。逆再生・ピンポンのタグはフレーム単位で展開します。Unity 6000.5.3f1で確認済みで、Unity自体の2D Aseprite Importerパッケージが代替手段です。',
   concept:{title:'AsepriteのタグからUnityのクリップへ',body:[
    '`.aseprite`ファイルには、フレームごとのミリ秒の長さ、方向（順・逆・ピンポン）と繰り返し回数を持つタグ、レイヤー、ピボットを持てるスライスが入っています。Unityでこれに当たるのは、Sprite Mode Multipleのテクスチャ、正規化したピボットを持つフレームごとのスプライト、そして決まった時刻にSpriteRendererのスプライトを切り替えるキーを持つAnimationClipです。',
    'Nerulioはフレームごとに表示中のレイヤーを合成してパックし、範囲をUnityの左下基準の座標で書きます。タグ1つがクリップ1つになり、キーはフレームの長さの累計の位置に置かれ、最後のフレームも自分の長さを保つよう締めのキーが付きます。無限に繰り返すタグはLoop Timeオン、回数のあるタグはLoop Timeオフです。クリップには繰り返し回数がないためです。',
    'Unity自体の2D Aseprite Importer（4.xはUnity 6.4以降が必要）はファイルを直接取り込み、保存のたびに再インポートします。ドキュメントによればフレームごとの時間に対応し、∞をループするクリップにしますが、方向はForwardのみ対応で、スライスは取り込みません。'],
    terms:[['タグ','Asepriteで方向と繰り返し回数を持つ、名前付きのフレーム範囲。'],['ピボットスライス','ピボット点を持つAsepriteのスライス。Nerulioはこれをフレームのピボットに使います。'],['Loop Time','クリップを繰り返させるAnimationClipの設定。'],['締めのキー','最後のスプライトをもう一度置き、その長さを保つための最後のキー。']]},
   example:{title:'例：タグが3つある32 × 32のキャラクター',lines:[
    'Aseprite                                 Unity 6 AnimationClip（キーの時刻、秒）',
    'idle    4フレーム × 125 ms、∞            idle.anim    0, 0.125, 0.25, 0.375 | 終了 0.5    loop on',
    'attack  100, 100, 150, 250 ms、×1         attack.anim  0, 0.1, 0.2, 0.35 | 終了 0.6        loop off',
    'jump    3フレーム × 80 ms、ピンポン       jump.anim    フレーム0-1-2-1：0, 0.08, 0.16, 0.24 | 終了 0.32',
    '',
    '32 × 32のキャンバスの(16, 31)にピボットスライス、トリムなしのフレーム',
    '  Unityのピボット = (16 / 32, (32 − 31) / 32) = (0.5, 0.03125)   （yは上向き）'],
    after:'ピンポンのタグは0-1-2-1の順に展開して書くので、Unityで方向の設定に頼らなくても同じように再生されます。'},
   mapping:{title:'変換後に残るもの',head:['Aseprite','Nerulio','Unity 6'],rows:[
    ['フレームのピクセル（表示中のレイヤー）','合成したフレームをPNGにパック','そのテクスチャのスプライト範囲1つ'],
    ['フレームの長さ（ms）','フレームごとに保持','キーの時刻：各フレームは前のフレームの長さの合計から始まる'],
    ['タグ','同じ名前のアニメーション1つ','同じ名前の`.anim`クリップ1つ'],
    ['方向：逆方向・ピンポン','再生順を展開して記録','その順に並んだキー'],
    ['繰り返し ∞','ループ','Loop Timeオン'],
    ['繰り返し 1、2、3…','プレビューではその回数再生','Loop Timeオフ：1回再生'],
    ['ピボットスライス（またはPで打ったピボット）','フレームのピボット（既定は下中央）','スプライトのピボット、Customの配置、yは上向き'],
    ['hit / hurtのスライス','フレームごとのボックス','Unity向けには書かない（汎用JSONにある）'],
    ['レイヤー','合成','フレームごとにスプライト1つ、レイヤー別のスプライトはなし']]},
   outputs:{rows:[
    ['hero.png','パックしたフレーム（トリム、2px間隔、回転なし）。'],
    ['hero.unity.json','Unity座標のスプライト範囲、正規化したピボット、タグごとにフレームごとのミリ秒とループの有無を持つクリップ情報。'],
    ['Editor/NerulioSpriteImporter.cs','エディタースクリプト：テクスチャの設定、スプライト範囲、`.anim`クリップ。'],
    ['README-UNITY.md','このバンドルの取り込み手順。']]},
   target:{title:'Unity 6に取り込む',steps:[
    'バンドルのフォルダーを`Editor`サブフォルダーごと`Assets/`にコピーし、PNGはJSONの隣に置きます。Unityがスクリプトをコンパイルします。2D Spriteパッケージが必要です（どの2Dテンプレートにも入っています）。',
    'Tools › Nerulio › Import Studio JSONを実行し、`hero.unity.json`を選びます。',
    'テクスチャがSprite (2D and UI)、Multiple、Point (no filter)、Compression None、PPU 100になっているか確認します。Sprite Editorにはフレームごとにピボット付きの範囲が見えます。',
    'JSONの隣の`idle.anim`・`attack.anim`・`jump.anim`をAnimationウィンドウで開いてキーを確認します。',
    'SpriteRendererを持つゲームオブジェクトのAnimator Controllerにクリップを入れます。`attack`のような1回きりのタグには、終わったら`idle`に戻る遷移を加えます。',
    'UnityのAseprite Importerパッケージが入っているなら、`.aseprite`ファイル自体は`Assets/`に置かないでください。Unityが独自の方法でもう一度取り込みます。']},
   verify:{steps:[
    '`attack.anim`のキーが0・0.1・0.2・0.35秒にあり、Asepriteのタグ全体の長さである0.6秒で終わるはずです。',
    '`idle`はLoop Timeオン、`attack`はオフのはずです。',
    '`jump`をAsepriteのプレビューと並べて再生します。0-1-2-1の順序と80ms刻みが一致するはずです。',
    'クリップを切り替えても足がピボットの位置にとどまるはずです。']},
   trouble:{rows:[
    ['クリップがループせず1回だけ再生される','Asepriteでタグに繰り返し回数（∞以外）が設定されている','クリップのインスペクターのLoop Time','タグを∞にして書き出し直すか、UnityでLoop Timeにチェック'],
    ['コンソールに「clip … names a missing sprite」','取り込む前にPNGの名前を変えたか、JSONから離した','PNGが書き出したときの名前のままJSONの隣にあるか','ファイルを一緒に置いて取り込み直す'],
    ['スプライトがぼやける','取り込み後にFilter Modeや圧縮の設定を変えた','テクスチャのインスペクター','Point (no filter)とCompression None。[[game/unity-pixel-art-blurry|Unityのドット絵のぼやけ]]を参照'],
    ['フレームごとにキャラクターが跳ねる','ピボットスライスがなく既定の下中央を使っている、またはフレームごとにピボットが違う','Sprite Editorでフレームごとのピボットの印を比べる','Asepriteにピボットスライスを1つ置くか、NerulioでPを使ってピボットを指定。[[game/sprite-pivot-editor|ピボットエディター]]を参照'],
    ['スプライトが2組できる','`Assets/`に置いた`.aseprite`をUnityのAseprite Importerも取り込んだ','プロジェクトウィンドウで.asepriteアセットが展開されている','方法を1つに絞る：`Assets/`から.asepriteを外すか、このバンドルを使わない'],
    ['ピンポンのタグが順方向にしか再生されない','Unity自体のインポーター（順方向のみ対応）の結果で、このバンドルではない','Animatorがどのアセットのクリップを使っているか','順序を展開したこのバンドルの`.anim`を使う']]},
   alternatives:{rows:[
    ['Unityの2D Aseprite Importerパッケージ','一日中Asepriteで描き、保存のたびにUnityに再インポートさせ、レイヤーごとに取り込みたいとき。タグは順方向のみ、スライスは非対応という点を受け入れる必要があります。'],
    ['AsepriteからPNGシートを書き出してSprite Editorで切る','アニメーションが1〜2個でフレームレートが一定のとき。[[game/unity-sprite-sheet|Unityでスプライトシートを切る]]を参照。'],
    ['同じファイルを別のエンジンで','[[game/aseprite-to-godot|AsepriteをGodotへ]]、[[game/aseprite-to-phaser|AsepriteをPhaserへ]]。']]},
   limits:['レイヤーはフレームごとに1つのスプライトへ統合されます。','2回以上の繰り返し回数は保たれず、クリップは1回再生になります。','ヒット・ハートボックスはUnity向けには書き出しません。'],
   versions:{body:['NerulioのUnityバンドルはUnity 6000.5.3f1のバッチモードで確認しました（スプライト範囲、ピボット、ピクセル、Point・無圧縮・Multiple、クリップのキーと時間）。実行時にAnimatorでクリップが再生されるかは確認していません。.asepriteの読み込みは、実在の231ファイルがAseprite 1.3.18で同じタグ・長さ・ピクセルのまま開き直せることで確認しました。Unity自体のAseprite Importerについての記述は、そのバージョン4.0のドキュメントに基づきます。'],sources:[...UNITY_ASE,UNITY_DOCS[2],UNITY_DOCS[3],'[Asepriteドキュメント：Tags](https://www.aseprite.org/docs/tags/)']}
  }
 },
 // ------------------------------------------------------------------ Aseprite → Phaser
 // Nerulio: src/game/export/atlas-json.js (phaserFiles: hash / multiatlas + .anims.json, repeat -1 or n-1, yoyo, reverse
 // baked, per-frame ms; asepriteJson: keys "0".."n", frameTags, slices, one page), targets.js (rotation refused),
 // tools/engine-verify/web/harness.js (fromJSON / createFromAseprite read back). Phaser source 3.90 / 4.2:
 // createFromAseprite reads direction but not repeat; JSONHash reads `pivot`; AnimationState uses frame.duration.
 'game/aseprite-to-phaser':{
  type:'conversion',
  intent:{primary:'use an .aseprite animation in Phaser 3 or Phaser 4',secondary:['atlas + anims.fromJSON or load.aseprite + createFromAseprite','keep per-frame durations, ping-pong and loop','pixel-art config'],
   goal:'Phaser animations named after the Aseprite tags, with each frame\'s own duration, loop and ping-pong, drawn sharp',input:'.aseprite / .ase file',output:'TexturePacker atlas JSON + .anims.json + PNG, or Aseprite JSON (hash/array) + PNG',target:'Phaser 3.90 and 4.2',support:'full',
   evidence:['src/game/export/atlas-json.js','src/game/export/targets.js','tools/engine-verify/web/harness.js','docs/STUDIO-PACK.md (Phaser 3.90 + 4.2 runs)'],
   external:['Phaser docs: LoaderPlugin atlas/aseprite, AnimationManager create/createFromAseprite/fromJSON, Animation config, pixelArt','Phaser 3.90 / 4.2 source: createFromAseprite ignores the tag repeat']},
  en:{
   answer:'Phaser 3 and 4 do not read `.aseprite` files; they read a PNG plus JSON. Nerulio turns the file into either of the two JSON routes Phaser supports: a TexturePacker atlas with an `.anims.json` for `this.anims.fromJSON()` (loop, ping-pong and per-frame milliseconds written in), or Aseprite JSON for `this.load.aseprite()` and `this.anims.createFromAseprite()`. Both were loaded and drawn by Phaser 3.90 and 4.2. Set `pixelArt: true` in the game config so the frames stay sharp.',
   concept:{title:'Two ways Phaser builds animations from JSON',body:[
    'Phaser draws frames from a texture atlas: a PNG plus JSON listing each frame\'s rectangle, trim and pivot. Animations are separate objects with a key, a list of frames, a frame rate, a repeat count (−1 = forever) and an optional yoyo that plays back down to the start. Each animation frame may carry its own duration in milliseconds, which Phaser uses as that frame\'s time as long as you do not override the frame rate when you play it.',
    'Route 1, atlas + animations file: `load.atlas` (or `load.multiatlas` for several pages) reads the TexturePacker-style JSON, and `anims.fromJSON` creates the animations from a JSON file that already holds every setting. Route 2, Aseprite JSON: `load.aseprite` reads the JSON Aseprite writes with File › Export Sprite Sheet, and `createFromAseprite` makes one animation per tag, reading each frame\'s duration and the tag direction (reverse, ping-pong as yoyo). In the Phaser 3.90 and 4.2 source it does not read the tag\'s repeat count, so those animations play once unless you ask for a repeat when you play them.',
    'Nerulio reads the .aseprite file in the browser, composites the visible layers per frame and packs the frames. For route 1 it writes each tag as an animation with `repeat: -1` for ∞ or n − 1 for a count, reverse written out, ping-pong as `yoyo`, and every frame\'s milliseconds. For route 2 it writes frame keys "0" … "n" (what `createFromAseprite` expects), `frameTags` with direction and repeat, and slices for the pivot and boxes; this route needs all frames on one page. Rotation stays off because both Phaser versions drew rotated TexturePacker frames mirrored in the verification runs.'],
    terms:[['Atlas JSON','TexturePacker-style frame list (hash, or multiatlas for several pages) with rects, trim and pivot.'],['anims.fromJSON','Creates animations from a JSON file of animation configs.'],['createFromAseprite','Creates one animation per frameTag of a loaded Aseprite JSON.'],['repeat','Extra plays after the first; −1 repeats forever.'],['yoyo','Plays the frames forward, then back to the start.']]},
   example:{title:'Example: three tags, both routes',lines:[
    'Aseprite tag                          hero.anims.json (route 1)',
    'idle    4 × 125 ms, ∞                 frameRate 10, repeat -1, durations 125 ×4',
    'attack  100, 100, 150, 250 ms, ×1     repeat 0 (plays once), durations 100, 100, 150, 250',
    'jump    3 × 80 ms, ping-pong, ∞       frames 0, 1, 2 + yoyo: true, repeat -1',
    '',
    'Aseprite JSON (route 2): frameTags  idle 0–3, attack 4–7 (repeat "1"), jump 8–10 pingpong',
    '  createFromAseprite → idle, attack, jump, each with repeat 0',
    '  sprite.play({ key: \'idle\', repeat: -1 })   ← needed for looping tags'],
    after:'The attack animation lasts 100 + 100 + 150 + 250 = 600 ms in both routes, because Phaser takes each frame\'s duration as that frame\'s time.'},
   mapping:{title:'What survives the conversion',head:['In Aseprite','In Nerulio','In Phaser 3 / 4'],rows:[
    ['Frame pixels (visible layers)','Composited frame, packed into the PNG','Atlas frame with trim offsets'],
    ['Frame duration (ms)','Kept per frame','AnimationFrame `duration` in ms, the frame\'s own time'],
    ['Tag','One animation of the same name','Animation key (anims.json) or frameTag (Aseprite JSON)'],
    ['Direction reverse','Frame order written reversed','Frames in reverse order'],
    ['Direction ping-pong','Frames listed forward','`yoyo: true`'],
    ['Repeat ∞ / repeat n','Loop / play n times','Route 1: `repeat: -1` / n − 1. Route 2: set `repeat` yourself when playing'],
    ['Pivot slice or P pivot','Frame pivot','Route 1: frame `pivot`, which Phaser reads as the frame\'s custom pivot. Route 2: a `pivot` slice Phaser does not use'],
    ['Hit / hurt slices','Boxes','Route 2 only, as slices in `meta` for your own code']]},
   outputs:{lead:'Route 1 (Pack & Export › Phaser 3 / 4) and route 2 (Aseprite JSON hash or array):',rows:[
    ['hero.png','The packed frames (trimmed, 2 px apart, never rotated).'],
    ['hero.json','Route 1: atlas JSON hash (`hero.multiatlas.json` when there are several pages). Route 2: Aseprite JSON with `frames` "0"…"n", `meta.frameTags` and `meta.slices`.'],
    ['hero.anims.json','Route 1 only: every tag as an animation config for `anims.fromJSON`.'],
    ['README-PHASER.md / README-ASEPRITE-JSON.md','The loading code for this bundle.']]},
   target:{title:'Load it in Phaser',steps:[
    'Copy the PNG and JSON files into your game\'s assets folder.',
    'Create the game with `pixelArt: true` in the config; it turns antialiasing off and rounds positions.',
    'Route 1, in `preload()`: `this.load.atlas(\'hero\', \'hero.png\', \'hero.json\')` and `this.load.json(\'hero-anims\', \'hero.anims.json\')`.',
    'Route 1, in `create()`: `this.anims.fromJSON(this.cache.json.get(\'hero-anims\'))`, then `this.add.sprite(100, 100, \'hero\').play(\'idle\')`.',
    'Route 2: `this.load.aseprite(\'hero\', \'hero.png\', \'hero.json\')` in `preload()`, then `this.anims.createFromAseprite(\'hero\')` and `sprite.play({ key: \'idle\', repeat: -1 })` for tags that should loop.',
    'Switch animations with `sprite.play(\'attack\')` and listen to `animationcomplete` to go back to `idle` after a one-shot.']},
   verify:{steps:[
    'In `create()`, log `this.anims.get(\'attack\').frames.map(f => f.duration)`: it prints 100, 100, 150, 250.',
    '`this.anims.get(\'idle\').repeat` is −1 on route 1.',
    'The jump animation plays forward and then back towards the start: `this.anims.get(\'jump\').yoyo` is true.',
    'At 4× zoom the pixel edges stay hard with `pixelArt: true`.']},
   trouble:{rows:[
    ['An animation plays once and stops (route 2)','`createFromAseprite` does not read the tag\'s repeat, so every animation gets repeat 0','`this.anims.get(\'idle\').repeat` is 0','Play with `{ key, repeat: -1 }`, or use route 1, where the repeat is written in'],
    ['Animations are empty or miss frames','The Aseprite JSON uses title-style frame keys, not "0"…"n"; `createFromAseprite` skips frames it cannot find','Look at the keys of `frames` in the JSON','Export again from Nerulio (it writes "0"…"n"), or run the Aseprite CLI with `--filename-format "{frame}"`'],
    ['Sprites are blurry','The game runs with antialiasing','Game config','Set `pixelArt: true`'],
    ['Some frames appear mirrored or scrambled','An atlas from another packer with rotated frames: Phaser draws rotated TexturePacker frames mirrored','`"rotated": true` in the JSON','Pack without rotation; see [[game/phaser-atlas-frames-wrong|wrong frames in a Phaser atlas]]'],
    ['Per-frame durations are ignored','`play()` was called with a custom `frameRate`, which switches Phaser to one time per frame','Look at the play config','Do not override the frame rate; change the durations instead'],
    ['Nerulio refuses the Aseprite JSON export','The frames need more than one page and Aseprite JSON describes one sheet','The export note names the page count','Raise the page size or use route 1, which writes a multiatlas']]},
   alternatives:{rows:[
    ['Aseprite\'s own File › Export Sprite Sheet (JSON Data, tags) + `load.aseprite`','You own Aseprite and prefer its exporter; the Phaser docs list the export settings it expects.'],
    ['A plain grid sheet with `load.spritesheet` and `anims.create`','One animation at an even frame rate; you need the frame size, see [[game/sprite-sheet-frame-size|measuring frame size]].'],
    ['PixiJS instead of Phaser','[[game/aseprite-json-to-pixi|Aseprite JSON to PixiJS]].']]},
   limits:['Layers arrive flattened; blend modes are baked into the frames.','Hitboxes are data only: Phaser creates no physics bodies from them.','Route 2 needs all frames on one page.'],
   versions:{body:['Both routes were loaded by Phaser 3.90 and Phaser 4.2 in the verification runs: every frame was drawn and compared with the source, and the animations created by `anims.fromJSON` and `createFromAseprite` were read back. That `createFromAseprite` ignores the tag repeat was read in the Phaser 3.90 and 4.2 source; the rest follows the Phaser API documentation.'],sources:[...PHASER_DOCS,'[Phaser 3.90 source: AnimationManager.createFromAseprite](https://github.com/phaserjs/phaser/blob/v3.90.0/src/animations/AnimationManager.js)','[Aseprite docs: Sprite sheets](https://www.aseprite.org/docs/sprite-sheet/)']}
  },
  ko:{
   answer:'Phaser 3·4는 `.aseprite` 파일을 읽지 않고 PNG와 JSON을 읽습니다. Nerulio는 파일을 Phaser가 지원하는 두 가지 JSON 경로 중 하나로 바꿉니다. `this.anims.fromJSON()`용 `.anims.json`이 딸린 TexturePacker 아틀라스(반복·핑퐁·프레임별 밀리초가 들어 있음), 또는 `this.load.aseprite()`와 `this.anims.createFromAseprite()`용 Aseprite JSON입니다. 둘 다 Phaser 3.90과 4.2가 불러와 그렸습니다. 프레임이 선명하게 보이도록 게임 설정에 `pixelArt: true`를 넣으세요.',
   concept:{title:'Phaser가 JSON으로 애니메이션을 만드는 두 가지 방법',body:[
    'Phaser는 텍스처 아틀라스에서 프레임을 그립니다. PNG와, 프레임마다 사각형·트림·피벗을 적은 JSON입니다. 애니메이션은 따로 만드는 객체로 키, 프레임 목록, 프레임 속도, 반복 횟수(−1은 무한), 처음으로 되돌아가며 재생하는 yoyo를 가집니다. 애니메이션 프레임마다 밀리초 길이를 줄 수 있고, 재생할 때 프레임 속도를 덮어쓰지 않는 한 Phaser는 그 값을 그 프레임의 시간으로 씁니다.',
    '경로 1, 아틀라스 + 애니메이션 파일: `load.atlas`(페이지가 여럿이면 `load.multiatlas`)가 TexturePacker 형식 JSON을 읽고, `anims.fromJSON`이 모든 설정이 이미 들어 있는 JSON에서 애니메이션을 만듭니다. 경로 2, Aseprite JSON: `load.aseprite`가 Aseprite의 File › Export Sprite Sheet가 쓰는 JSON을 읽고, `createFromAseprite`가 태그마다 애니메이션을 만들며 프레임별 길이와 방향(역방향, 핑퐁은 yoyo)을 읽습니다. Phaser 3.90과 4.2 소스를 보면 태그의 반복 횟수는 읽지 않으므로, 재생할 때 반복을 지정하지 않으면 한 번만 재생됩니다.',
    'Nerulio는 브라우저에서 .aseprite를 읽고 프레임마다 보이는 레이어를 합성해 패킹합니다. 경로 1에서는 태그마다 ∞면 `repeat: -1`, 횟수면 n − 1을 쓰고, 역방향은 순서를 뒤집어 쓰고, 핑퐁은 `yoyo`로, 프레임마다 밀리초를 씁니다. 경로 2에서는 `createFromAseprite`가 기대하는 "0" … "n" 프레임 키, 방향과 반복이 든 `frameTags`, 피벗과 박스용 슬라이스를 씁니다. 이 경로는 모든 프레임이 한 페이지에 있어야 합니다. 검증에서 두 Phaser 버전 모두 회전된 TexturePacker 프레임을 거울처럼 뒤집어 그렸기 때문에 회전은 끕니다.'],
    terms:[['아틀라스 JSON','사각형·트림·피벗이 든 TexturePacker 형식 프레임 목록(해시, 페이지가 여럿이면 multiatlas).'],['anims.fromJSON','애니메이션 설정이 든 JSON 파일로 애니메이션을 만드는 함수.'],['createFromAseprite','불러온 Aseprite JSON의 frameTag마다 애니메이션을 하나씩 만드는 함수.'],['repeat','첫 재생 뒤 추가로 반복하는 횟수. −1은 무한 반복.'],['yoyo','프레임을 앞으로 재생한 뒤 처음까지 거꾸로 재생.']]},
   example:{title:'예시: 태그 3개, 두 가지 경로',lines:[
    'Aseprite 태그                          hero.anims.json (경로 1)',
    'idle    4 × 125 ms, ∞                  frameRate 10, repeat -1, duration 125 ×4',
    'attack  100, 100, 150, 250 ms, ×1      repeat 0(한 번 재생), duration 100, 100, 150, 250',
    'jump    3 × 80 ms, 핑퐁, ∞             프레임 0, 1, 2 + yoyo: true, repeat -1',
    '',
    'Aseprite JSON (경로 2): frameTags  idle 0–3, attack 4–7 (repeat "1"), jump 8–10 pingpong',
    '  createFromAseprite → idle, attack, jump 모두 repeat 0',
    '  sprite.play({ key: \'idle\', repeat: -1 })   ← 반복 태그에 필요'],
    after:'두 경로 모두 attack은 100 + 100 + 150 + 250 = 600ms 동안 재생됩니다. Phaser가 프레임마다 duration을 그 프레임의 시간으로 쓰기 때문입니다.'},
   mapping:{title:'변환 후에도 남는 것',head:['Aseprite','Nerulio','Phaser 3 / 4'],rows:[
    ['프레임 픽셀(보이는 레이어)','합성한 프레임을 PNG에 패킹','트림 오프셋이 있는 아틀라스 프레임'],
    ['프레임 길이(ms)','프레임마다 유지','AnimationFrame의 `duration`(ms), 그 프레임의 시간'],
    ['태그','같은 이름의 애니메이션 하나','애니메이션 키(anims.json) 또는 frameTag(Aseprite JSON)'],
    ['방향: 역방향','프레임 순서를 뒤집어 기록','역순으로 놓인 프레임'],
    ['방향: 핑퐁','프레임은 정방향으로 나열','`yoyo: true`'],
    ['반복 ∞ / 반복 n','반복 / n번 재생','경로 1: `repeat: -1` / n − 1. 경로 2: 재생할 때 `repeat`를 직접 지정'],
    ['피벗 슬라이스나 P 피벗','프레임 피벗','경로 1: 프레임 `pivot`, Phaser가 사용자 피벗으로 읽음. 경로 2: Phaser가 쓰지 않는 `pivot` 슬라이스'],
    ['hit / hurt 슬라이스','박스','경로 2에서만, 직접 쓸 수 있게 `meta`의 슬라이스로']]},
   outputs:{lead:'경로 1(패킹·내보내기 › Phaser 3 / 4)과 경로 2(Aseprite JSON 해시·배열)의 파일입니다.',rows:[
    ['hero.png','패킹된 프레임(트림, 2px 간격, 회전 없음).'],
    ['hero.json','경로 1: 아틀라스 JSON 해시(페이지가 여럿이면 `hero.multiatlas.json`). 경로 2: "0"…"n" `frames`, `meta.frameTags`, `meta.slices`가 든 Aseprite JSON.'],
    ['hero.anims.json','경로 1 전용: 태그마다 `anims.fromJSON`용 애니메이션 설정.'],
    ['README-PHASER.md / README-ASEPRITE-JSON.md','이 번들을 불러오는 코드.']]},
   target:{title:'Phaser에서 불러오기',steps:[
    'PNG와 JSON 파일을 게임의 에셋 폴더에 복사합니다.',
    '게임 설정에 `pixelArt: true`를 넣어 만듭니다. 안티에일리어싱을 끄고 위치를 정수로 맞춥니다.',
    '경로 1, `preload()`에서: `this.load.atlas(\'hero\', \'hero.png\', \'hero.json\')`과 `this.load.json(\'hero-anims\', \'hero.anims.json\')`.',
    '경로 1, `create()`에서: `this.anims.fromJSON(this.cache.json.get(\'hero-anims\'))` 다음 `this.add.sprite(100, 100, \'hero\').play(\'idle\')`.',
    '경로 2: `preload()`에서 `this.load.aseprite(\'hero\', \'hero.png\', \'hero.json\')`, 그다음 `this.anims.createFromAseprite(\'hero\')`, 반복해야 할 태그는 `sprite.play({ key: \'idle\', repeat: -1 })`.',
    '`sprite.play(\'attack\')`으로 애니메이션을 바꾸고, 한 번만 나오는 동작 뒤에는 `animationcomplete`를 받아 `idle`로 돌아갑니다.']},
   verify:{steps:[
    '`create()`에서 `this.anims.get(\'attack\').frames.map(f => f.duration)`을 출력하면 100, 100, 150, 250이 나와야 합니다.',
    '경로 1에서 `this.anims.get(\'idle\').repeat`는 −1이어야 합니다.',
    'jump는 앞으로 재생한 뒤 처음 쪽으로 되돌아가야 합니다. `this.anims.get(\'jump\').yoyo`가 true입니다.',
    '`pixelArt: true`면 4배로 확대해도 픽셀 경계가 선명해야 합니다.']},
   trouble:{rows:[
    ['애니메이션이 한 번 재생되고 멈춤(경로 2)','`createFromAseprite`가 태그의 반복을 읽지 않아 모든 애니메이션이 repeat 0','`this.anims.get(\'idle\').repeat`가 0','`{ key, repeat: -1 }`로 재생하거나, 반복이 기록되는 경로 1 사용'],
    ['애니메이션이 비었거나 프레임이 빠짐','Aseprite JSON의 프레임 키가 "0"…"n"이 아닌 제목 형식이라 `createFromAseprite`가 찾지 못한 프레임을 건너뜀','JSON `frames`의 키 확인','Nerulio로 다시 내보내거나("0"…"n"으로 씀) Aseprite CLI를 `--filename-format "{frame}"`로 실행'],
    ['스프라이트가 흐림','게임이 안티에일리어싱으로 실행됨','게임 설정','`pixelArt: true` 설정'],
    ['일부 프레임이 뒤집히거나 뒤섞여 보임','다른 패커의 회전된 프레임: Phaser는 회전된 TexturePacker 프레임을 거울처럼 그림','JSON의 `"rotated": true`','회전 없이 패킹. [[game/phaser-atlas-frames-wrong|Phaser 아틀라스 프레임 오류]] 참고'],
    ['프레임별 길이가 무시됨','`play()`에 사용자 `frameRate`를 넘겨 Phaser가 모든 프레임에 같은 시간을 씀','재생 설정 확인','프레임 속도를 덮어쓰지 말고 길이를 바꾸기'],
    ['Nerulio가 Aseprite JSON 내보내기를 거부함','프레임이 한 페이지에 다 들어가지 않는데 Aseprite JSON은 시트 한 장만 설명함','내보내기 안내에 페이지 수가 나옴','페이지 크기를 키우거나 multiatlas를 쓰는 경로 1 사용']]},
   alternatives:{rows:[
    ['Aseprite 자체 File › Export Sprite Sheet(JSON Data, 태그) + `load.aseprite`','Aseprite가 있고 그 내보내기를 선호할 때. 필요한 내보내기 설정은 Phaser 문서에 나와 있습니다.'],
    ['`load.spritesheet`와 `anims.create`로 쓰는 격자 시트','프레임 속도가 일정한 애니메이션 하나. 프레임 크기가 필요합니다: [[game/sprite-sheet-frame-size|프레임 크기 재기]].'],
    ['Phaser 대신 PixiJS','[[game/aseprite-json-to-pixi|Aseprite JSON을 PixiJS로]].']]},
   limits:['레이어는 합쳐지고 블렌드 모드는 프레임에 구워집니다.','히트박스는 데이터일 뿐이며 Phaser가 물리 바디를 만들지는 않습니다.','경로 2는 모든 프레임이 한 페이지에 있어야 합니다.'],
   versions:{body:['검증 실행에서 두 경로 모두 Phaser 3.90과 Phaser 4.2가 불러왔습니다. 모든 프레임을 그려 원본과 비교했고, `anims.fromJSON`과 `createFromAseprite`가 만든 애니메이션을 다시 읽었습니다. `createFromAseprite`가 태그의 반복을 무시한다는 점은 Phaser 3.90·4.2 소스에서 확인했고, 나머지는 Phaser API 문서를 따릅니다.'],sources:[...PHASER_DOCS,'[Phaser 3.90 source: AnimationManager.createFromAseprite](https://github.com/phaserjs/phaser/blob/v3.90.0/src/animations/AnimationManager.js)','[Aseprite 문서: Sprite sheets](https://www.aseprite.org/docs/sprite-sheet/)']}
  },
  ja:{
   answer:'Phaser 3・4は`.aseprite`ファイルを読まず、PNGとJSONを読みます。NerulioはファイルをPhaserが対応する2つのJSONの経路のどちらかに変換します。`this.anims.fromJSON()`用の`.anims.json`付きTexturePackerアトラス（ループ・ピンポン・フレームごとのミリ秒入り）か、`this.load.aseprite()`と`this.anims.createFromAseprite()`用のAseprite JSONです。どちらもPhaser 3.90と4.2で読み込んで描画しました。フレームをくっきり保つため、ゲーム設定に`pixelArt: true`を入れてください。',
   concept:{title:'PhaserがJSONからアニメーションを作る2つの方法',body:[
    'Phaserはテクスチャアトラスからフレームを描きます。PNGと、フレームごとの矩形・トリム・ピボットを並べたJSONです。アニメーションは別のオブジェクトで、キー、フレーム一覧、フレームレート、繰り返し回数（−1は無限）、先頭まで逆に戻るyoyoを持ちます。アニメーションのフレームごとにミリ秒の長さを持たせることができ、再生時にフレームレートを上書きしない限り、Phaserはそれをそのフレームの時間として使います。',
    '経路1、アトラス＋アニメーションファイル：`load.atlas`（複数ページなら`load.multiatlas`）がTexturePacker形式のJSONを読み、`anims.fromJSON`が設定をすべて含むJSONからアニメーションを作ります。経路2、Aseprite JSON：`load.aseprite`がAsepriteのFile › Export Sprite Sheetの書き出すJSONを読み、`createFromAseprite`がタグごとにアニメーションを作り、フレームごとの長さと方向（逆方向、ピンポンはyoyo）を読みます。Phaser 3.90と4.2のソースでは、タグの繰り返し回数は読まないため、再生時に繰り返しを指定しなければ1回だけ再生されます。',
    'Nerulioはブラウザで.asepriteを読み、フレームごとに表示中のレイヤーを合成してパックします。経路1では、タグごとに∞なら`repeat: -1`、回数ならn − 1を書き、逆方向は順序を逆にして書き、ピンポンは`yoyo`にし、フレームごとのミリ秒を書きます。経路2では、`createFromAseprite`が求める"0" … "n"のフレームキー、方向と繰り返しを持つ`frameTags`、ピボットとボックス用のスライスを書きます。この経路は全フレームが1ページに収まる必要があります。検証で両バージョンとも回転したTexturePackerフレームを鏡像で描いたため、回転はオフにします。'],
    terms:[['アトラスJSON','矩形・トリム・ピボットを持つTexturePacker形式のフレーム一覧（ハッシュ、複数ページならmultiatlas）。'],['anims.fromJSON','アニメーション設定のJSONファイルからアニメーションを作る関数。'],['createFromAseprite','読み込んだAseprite JSONのframeTagごとにアニメーションを1つ作る関数。'],['repeat','最初の再生の後に追加で繰り返す回数。−1は無限。'],['yoyo','フレームを順に再生したあと、先頭まで逆順に戻る。']]},
   example:{title:'例：タグ3つ、2つの経路',lines:[
    'Asepriteのタグ                         hero.anims.json（経路1）',
    'idle    4 × 125 ms、∞                  frameRate 10、repeat -1、duration 125 ×4',
    'attack  100, 100, 150, 250 ms、×1      repeat 0（1回再生）、duration 100, 100, 150, 250',
    'jump    3 × 80 ms、ピンポン、∞          フレーム0, 1, 2 + yoyo: true、repeat -1',
    '',
    'Aseprite JSON（経路2）：frameTags  idle 0–3、attack 4–7（repeat "1"）、jump 8–10 pingpong',
    '  createFromAseprite → idle・attack・jump、すべてrepeat 0',
    '  sprite.play({ key: \'idle\', repeat: -1 })   ← ループするタグに必要'],
    after:'どちらの経路でもattackは100 + 100 + 150 + 250 = 600ms再生されます。Phaserがフレームごとのdurationをそのフレームの時間として使うからです。'},
   mapping:{title:'変換後に残るもの',head:['Aseprite','Nerulio','Phaser 3 / 4'],rows:[
    ['フレームのピクセル（表示中のレイヤー）','合成したフレームをPNGにパック','トリムのオフセット付きのアトラスフレーム'],
    ['フレームの長さ（ms）','フレームごとに保持','AnimationFrameの`duration`（ms）、そのフレームの時間'],
    ['タグ','同じ名前のアニメーション1つ','アニメーションキー（anims.json）またはframeTag（Aseprite JSON）'],
    ['方向：逆方向','フレーム順を逆にして記録','逆順に並んだフレーム'],
    ['方向：ピンポン','フレームは順方向で並べる','`yoyo: true`'],
    ['繰り返し ∞ / 繰り返し n','ループ / n回再生','経路1：`repeat: -1` / n − 1。経路2：再生時に`repeat`を自分で指定'],
    ['ピボットスライスかPのピボット','フレームのピボット','経路1：フレームの`pivot`、Phaserはカスタムピボットとして読む。経路2：Phaserが使わない`pivot`スライス'],
    ['hit / hurtのスライス','ボックス','経路2のみ、自分のコード用に`meta`のスライスとして']]},
   outputs:{lead:'経路1（パック＆書き出し › Phaser 3 / 4）と経路2（Aseprite JSONのハッシュ・配列）のファイルです。',rows:[
    ['hero.png','パックしたフレーム（トリム、2px間隔、回転なし）。'],
    ['hero.json','経路1：アトラスJSONハッシュ（複数ページなら`hero.multiatlas.json`）。経路2："0"…"n"の`frames`、`meta.frameTags`、`meta.slices`を持つAseprite JSON。'],
    ['hero.anims.json','経路1のみ：タグごとの`anims.fromJSON`用アニメーション設定。'],
    ['README-PHASER.md / README-ASEPRITE-JSON.md','このバンドルを読み込むコード。']]},
   target:{title:'Phaserで読み込む',steps:[
    'PNGとJSONのファイルをゲームのアセットフォルダーにコピーします。',
    'ゲーム設定に`pixelArt: true`を入れて作成します。アンチエイリアスを切り、位置を整数に丸めます。',
    '経路1、`preload()`で：`this.load.atlas(\'hero\', \'hero.png\', \'hero.json\')`と`this.load.json(\'hero-anims\', \'hero.anims.json\')`。',
    '経路1、`create()`で：`this.anims.fromJSON(this.cache.json.get(\'hero-anims\'))`、続いて`this.add.sprite(100, 100, \'hero\').play(\'idle\')`。',
    '経路2：`preload()`で`this.load.aseprite(\'hero\', \'hero.png\', \'hero.json\')`、続いて`this.anims.createFromAseprite(\'hero\')`、ループすべきタグは`sprite.play({ key: \'idle\', repeat: -1 })`。',
    '`sprite.play(\'attack\')`でアニメーションを切り替え、1回きりの動作のあとは`animationcomplete`を受けて`idle`に戻します。']},
   verify:{steps:[
    '`create()`で`this.anims.get(\'attack\').frames.map(f => f.duration)`を出力すると、100, 100, 150, 250になるはずです。',
    '経路1では`this.anims.get(\'idle\').repeat`が−1のはずです。',
    'jumpは順に再生したあと先頭へ戻るように動くはずです。`this.anims.get(\'jump\').yoyo`がtrueです。',
    '`pixelArt: true`なら、4倍に拡大してもピクセルの境界がくっきりしているはずです。']},
   trouble:{rows:[
    ['アニメーションが1回再生して止まる（経路2）','`createFromAseprite`はタグの繰り返しを読まず、すべてrepeat 0になる','`this.anims.get(\'idle\').repeat`が0','`{ key, repeat: -1 }`で再生するか、繰り返しが書き込まれる経路1を使う'],
    ['アニメーションが空、またはフレームが欠ける','Aseprite JSONのフレームキーが"0"…"n"ではなくタイトル形式で、`createFromAseprite`は見つからないフレームを飛ばす','JSONの`frames`のキーを確認','Nerulioで書き出し直す（"0"…"n"で書く）か、Aseprite CLIを`--filename-format "{frame}"`で実行'],
    ['スプライトがぼやける','ゲームがアンチエイリアスありで動いている','ゲーム設定','`pixelArt: true`にする'],
    ['一部のフレームが反転したり崩れたりする','別のパッカーの回転フレーム：Phaserは回転したTexturePackerフレームを鏡像で描く','JSONの`"rotated": true`','回転なしでパックする。[[game/phaser-atlas-frames-wrong|Phaserアトラスのフレームの乱れ]]を参照'],
    ['フレームごとの長さが無視される','`play()`にカスタムの`frameRate`を渡し、Phaserが全フレームに同じ時間を使っている','再生の設定を確認','フレームレートを上書きせず、長さのほうを変える'],
    ['NerulioがAseprite JSONの書き出しを拒否する','フレームが1ページに収まらず、Aseprite JSONはシート1枚しか表せない','書き出しの注意にページ数が出る','ページサイズを上げるか、multiatlasを書く経路1を使う']]},
   alternatives:{rows:[
    ['Aseprite自体のFile › Export Sprite Sheet（JSON Data、タグ）＋`load.aseprite`','Asepriteを持っていて、その書き出しを使いたいとき。必要な書き出し設定はPhaserのドキュメントに載っています。'],
    ['`load.spritesheet`と`anims.create`で使うグリッドのシート','フレームレートが一定のアニメーション1つ。フレームサイズが必要です：[[game/sprite-sheet-frame-size|フレームサイズの測り方]]。'],
    ['Phaserの代わりにPixiJS','[[game/aseprite-json-to-pixi|Aseprite JSONをPixiJSへ]]。']]},
   limits:['レイヤーは統合され、合成モードはフレームに焼き込まれます。','ヒットボックスはデータだけで、Phaserが物理ボディを作るわけではありません。','経路2は全フレームが1ページに収まる必要があります。'],
   versions:{body:['検証の実行では、両方の経路をPhaser 3.90とPhaser 4.2が読み込みました。全フレームを描いて元画像と比べ、`anims.fromJSON`と`createFromAseprite`が作ったアニメーションを読み戻しています。`createFromAseprite`がタグの繰り返しを無視することはPhaser 3.90・4.2のソースで確認し、それ以外はPhaser APIドキュメントに基づきます。'],sources:[...PHASER_DOCS,'[Phaser 3.90 source: AnimationManager.createFromAseprite](https://github.com/phaserjs/phaser/blob/v3.90.0/src/animations/AnimationManager.js)','[Asepriteドキュメント：Sprite sheets](https://www.aseprite.org/docs/sprite-sheet/)']}
  }
 },
 // ------------------------------------------------------------------ GameMaker: strips
 // Nerulio: src/game/export/engines.js gamemakerFiles (spr_<base>_<tag>_strip<N>.png, pivotCell, playbackSpeed =
 // 1000/ms when uniform else the tag fps + a note, gamemaker.json verified:false), targets.js (verify 'unverified'),
 // docs/STUDIO-PACK.md (strips decoded by Pillow only). GameMaker behaviour: manual.gamemaker.io (Strip Images,
 // Sprite Editor, Image Editor Convert to Frames, Windows Game Options › Graphics).
 'game/gamemaker-sprite-strip':{
  type:'engine',
  intent:{primary:'turn a sprite sheet into GameMaker _stripN sprite strips',secondary:['GameMaker strip naming and import','one sprite per animation with origin and speed','pixel art settings in GameMaker'],
   goal:'one GameMaker sprite per animation, cut into the right number of frames, with a stable origin and the intended speed',input:'sprite sheet PNG (or frames, GIF, .aseprite)',output:'spr_<name>_<anim>_stripN.png per animation + gamemaker.json + README-GAMEMAKER.md',target:'GameMaker (UNVERIFIED: never loaded in GameMaker)',support:'partial',
   evidence:['src/game/export/engines.js (gamemakerFiles, pivotCell)','src/game/export/targets.js (verify: unverified)','docs/STUDIO-PACK.md (sp-samurai-gamemaker: strips decoded by Pillow; GameMaker UNVERIFIED)'],
   external:['GameMaker Manual: Strip Images (_stripN, horizontal from the left, width ÷ N)','The Sprite Editor (Import, origin, Frames per second / per game frame)','The Image Editor (Convert to Frames, Import Strip Image)','Windows Game Options: Interpolate colours between pixels']},
  en:{
   answer:'GameMaker imports a horizontal strip whose file name ends in `_stripN` as a sprite of N frames, each strip width ÷ N wide: `spr_hero_run_strip6.png` at 384 × 64 becomes six 64 × 64 frames. It wants one sprite per animation, each with one origin and one speed. Nerulio cuts a sprite sheet (or GIF, loose frames, .aseprite) into one such strip per animation, every frame aligned on its pivot, plus `gamemaker.json` with origin and speed. UNVERIFIED in GameMaker: these files were never loaded in GameMaker; the naming and the steps follow the GameMaker manual.',
   concept:{title:'How GameMaker reads a strip',body:[
    'In GameMaker a sprite asset is one animation: its frames, an origin (top-left by default, or a preset or custom point), a playback speed in Frames per second or Frames per game frame, and a collision mask. The manual\'s strip rule: frames laid out horizontally from the left, the file name ending in `_stripN`, and each frame the strip width divided by N. A strip can be brought in with the Sprite Editor\'s Import button or by dragging it into the IDE.',
    'A full sheet with several rows is not a strip. GameMaker\'s Image Editor can split one image itself (Convert to Frames, or Import Strip Image), where you give the number of frames, the frame width and height and offsets. That is the manual route; it takes the numbers you type and places nothing on a pivot.',
    'A sprite has one origin, so every frame must have its anchor point on the same pixel of its cell, or the character hops when the frames change. Nerulio draws every frame\'s full canvas onto one common cell per animation, shifted so its pivot lands on the same point, and that point becomes the origin in `gamemaker.json` and the README. The cell is as wide as the largest distance left of the pivot plus the largest distance right of it.',
    'A sprite also has one speed. When all frames of an animation last the same, Nerulio writes speed = 1000 ÷ ms; when they differ it writes the animation\'s rate (10 FPS for Studio tags), warns you and keeps every frame\'s milliseconds in `durationsMs` for your own code.'],
    terms:[['_stripN','File name suffix telling GameMaker to cut the image into N frames.'],['Origin','The sprite\'s anchor point, set as a preset or custom x / y in the Sprite Editor.'],['Frames per second / per game frame','The two speed modes of a GameMaker sprite.'],['Convert to Frames','GameMaker Image Editor command that splits one image by frame count, size and offset.']]},
   example:{title:'Worked example: one row becomes one strip',lines:[
    'Sheet row "run": 6 frames of 64 × 64, 125 ms each, pivot bottom centre (32, 64)',
    '  Nerulio strip:  spr_hero_run_strip6.png    6 × 64 = 384 px wide, 64 px high',
    '  GameMaker cut:  384 / 6 = 64 px per frame (the manual\'s strip rule)',
    '  Origin x 32, y 64          Speed 1000 / 125 = 8 frames per second',
    '',
    'Row "attack": 4 frames, 100, 100, 150, 250 ms → a sprite has one speed',
    '  playbackSpeed 10 (the tag rate) + a warning; durationsMs keeps 100, 100, 150, 250',
    '  at 10 frames per second GameMaker shows 4 × 100 = 400 ms instead of 600 ms'],
    after:'If the whole attack must keep its rhythm, time the frames yourself from `durationsMs`, or give all its frames the same length before export.'},
   outputs:{lead:'Pack & Export › GameMaker writes (for a file called `hero`):',rows:[
    ['spr_hero_run_strip6.png','One horizontal strip per animation; the name carries the frame count.'],
    ['gamemaker.json','Per sprite: file, frames, cell width and height, `xorigin`, `yorigin`, `playbackSpeed` in frames per second, loop, `durationsMs`, and `verified: false`.'],
    ['README-GAMEMAKER.md','The import steps and, for every strip, its frame count, cell size, origin and speed.']]},
   target:{title:'In GameMaker (from the GameMaker manual; not run here)',steps:[
    'For each strip, create a sprite and use Import in the Sprite Editor, or drag the PNG into the IDE. Keep the file name: the `_stripN` suffix is what makes GameMaker cut it into N frames.',
    'Check that the sprite shows the frame count and cell size listed in the README, for example 6 frames of 64 × 64.',
    'Set the origin to the custom x and y from the README or `gamemaker.json`, for example x 32, y 64.',
    'Set the speed to Frames per second and enter the value from the README, for example 8.',
    'Choose the collision mask mode the sprite needs (Automatic, Full Image or Manual).',
    'For pixel art, turn off Interpolate colours between pixels in the Graphics section of your target platform\'s Game Options; the manual lists it as on by default.']},
   verify:{steps:[
    'The Sprite Editor shows N frames, each the strip width ÷ N wide.',
    'The origin cross sits on the feet in every frame of the sprite.',
    'The preview runs at the speed from the README, and one cycle of `run` takes 6 × 125 = 750 ms.']},
   trouble:{rows:[
    ['The whole strip arrives as one wide frame','The file was renamed and lost `_stripN` (a download may add " (1)")','Look at the file name before importing','Rename it back to `…_stripN.png` with the frame count'],
    ['Frames are cut through the middle','The N in the name does not match the frames in the image','Strip width ÷ N should equal the cell width in the README','Use the name Nerulio wrote; it carries the real count'],
    ['The character hops when the frames change','The origin was left at the default top-left or set per frame by eye','Origin fields in the Sprite Editor','Enter the README origin; Nerulio already put every pivot on that point'],
    ['An uneven animation plays evenly','A GameMaker sprite has one speed; the export used the tag rate and warned','The export notes and `uniformTiming: false` in `gamemaker.json`','Drive the frames from `durationsMs` in code, or even out the durations before export'],
    ['The animation races','Speed set as Frames per game frame instead of Frames per second','The speed mode next to the value','Switch to Frames per second'],
    ['Pixel art looks soft in the game','Interpolate colours between pixels is on','Game Options › your platform › Graphics','Turn it off. Nerulio cannot test any of these GameMaker settings: it has no GameMaker to run']]},
   alternatives:{rows:[
    ['GameMaker\'s Image Editor: Convert to Frames or Import Strip Image','An even grid whose frames already share one anchor; you type the frame count, size and offsets in GameMaker.'],
    ['Start from the .aseprite file','Tags become strips and their timing is kept in the JSON: [[game/aseprite-to-gamemaker|Aseprite to GameMaker]].'],
    ['Separate PNG frames','Another tool or engine wants one file per frame: [[game/sprite-sheet-to-png-frames|sprite sheet to PNG frames]].']]},
   limits:['UNVERIFIED in GameMaker: no GameMaker ran on these files; only the strips were decoded (Pillow) and compared with the source frames.','Hitboxes and collision polygons are not written for GameMaker.','One speed per sprite: per-frame durations only survive as data in gamemaker.json.'],
   versions:{body:['What was checked: the GameMaker strips of a 288 × 480 samurai sheet decoded with Pillow, with every cell equal to its source frame. GameMaker itself was not run: there is no headless GameMaker in the verification setup, so the Studio labels this target UNVERIFIED. The `_stripN` rule, the import routes, the origin and speed settings and the interpolation option come from the GameMaker manual.'],sources:GM_DOCS}
  },
  ko:{
   answer:'GameMaker는 파일 이름이 `_stripN`으로 끝나는 가로 띠 이미지를 N프레임짜리 스프라이트로 가져오며, 프레임 하나의 너비는 띠 너비 ÷ N입니다. 384 × 64인 `spr_hero_run_strip6.png`는 64 × 64 프레임 6개가 됩니다. GameMaker는 애니메이션마다 스프라이트 하나를 원하고, 스프라이트마다 원점과 속도가 하나씩입니다. Nerulio는 스프라이트 시트(또는 GIF, 낱장 프레임, .aseprite)를 애니메이션마다 이런 띠 하나로 자르고, 모든 프레임을 피벗에 맞춘 뒤 원점과 속도가 든 `gamemaker.json`을 붙입니다. GameMaker에서는 미검증입니다. GameMaker로 불러온 적이 없으며, 이름 규칙과 단계는 GameMaker 매뉴얼을 따릅니다.',
   concept:{title:'GameMaker가 띠 이미지를 읽는 방식',body:[
    'GameMaker에서 스프라이트 에셋 하나는 애니메이션 하나입니다. 프레임들, 원점(기본은 왼쪽 위, 또는 프리셋이나 직접 지정한 점), Frames per second 또는 Frames per game frame 단위의 재생 속도, 충돌 마스크를 가집니다. 매뉴얼의 띠 규칙은 프레임을 왼쪽부터 가로로 늘어놓고, 파일 이름이 `_stripN`으로 끝나며, 프레임 하나가 띠 너비 ÷ N이라는 것입니다. 띠는 Sprite Editor의 Import 버튼이나 IDE로 끌어다 놓는 방법으로 가져옵니다.',
    '여러 행이 있는 시트 전체는 띠가 아닙니다. GameMaker의 Image Editor는 이미지 한 장을 직접 나눌 수 있으며(Convert to Frames 또는 Import Strip Image), 프레임 수·프레임 너비와 높이·오프셋을 입력합니다. 이것이 수동 방법이고, 입력한 숫자대로 자를 뿐 피벗에 맞춰 주지는 않습니다.',
    '스프라이트에는 원점이 하나뿐이라서 모든 프레임의 기준점이 칸 안의 같은 픽셀에 있어야 합니다. 그렇지 않으면 프레임이 바뀔 때 캐릭터가 튑니다. Nerulio는 애니메이션마다 공통 칸 하나에 각 프레임의 전체 캔버스를 피벗이 같은 점에 오도록 옮겨 그리고, 그 점을 `gamemaker.json`과 README의 원점으로 적습니다. 칸 너비는 피벗 왼쪽의 최대 거리와 오른쪽의 최대 거리를 더한 값입니다.',
    '스프라이트에는 속도도 하나뿐입니다. 애니메이션의 모든 프레임 길이가 같으면 속도 = 1000 ÷ ms로 쓰고, 다르면 애니메이션 속도(Studio 태그는 10 FPS)를 쓰면서 경고하고, 직접 코드로 쓸 수 있도록 프레임별 밀리초를 `durationsMs`에 남깁니다.'],
    terms:[['_stripN','이미지를 N프레임으로 자르라고 GameMaker에 알려 주는 파일 이름 접미사.'],['원점(Origin)','스프라이트의 기준점. Sprite Editor에서 프리셋이나 x·y 직접 입력으로 정함.'],['Frames per second / per game frame','GameMaker 스프라이트의 두 가지 속도 방식.'],['Convert to Frames','프레임 수·크기·오프셋으로 이미지 한 장을 나누는 GameMaker Image Editor 명령.']]},
   example:{title:'예시: 한 행이 띠 하나가 됨',lines:[
    '시트의 "run" 행: 64 × 64 프레임 6개, 각 125 ms, 피벗 하단 중앙 (32, 64)',
    '  Nerulio 띠:      spr_hero_run_strip6.png    6 × 64 = 너비 384 px, 높이 64 px',
    '  GameMaker 자르기: 384 / 6 = 프레임당 64 px (매뉴얼의 띠 규칙)',
    '  원점 x 32, y 64          속도 1000 / 125 = 초당 8프레임',
    '',
    '"attack" 행: 4프레임, 100, 100, 150, 250 ms → 스프라이트 속도는 하나뿐',
    '  playbackSpeed 10(태그 속도) + 경고, durationsMs에 100, 100, 150, 250 유지',
    '  초당 10프레임이면 GameMaker는 600 ms가 아니라 4 × 100 = 400 ms로 재생'],
    after:'공격 동작의 리듬을 꼭 지켜야 한다면 `durationsMs`로 프레임 시간을 직접 제어하거나, 내보내기 전에 모든 프레임 길이를 같게 맞추세요.'},
   outputs:{lead:'패킹·내보내기 › GameMaker가 쓰는 파일(`hero`라는 파일 기준)입니다.',rows:[
    ['spr_hero_run_strip6.png','애니메이션마다 가로 띠 하나. 이름에 프레임 수가 들어 있습니다.'],
    ['gamemaker.json','스프라이트마다 파일, 프레임 수, 칸 너비·높이, `xorigin`, `yorigin`, 초당 프레임 단위 `playbackSpeed`, 반복, `durationsMs`, `verified: false`.'],
    ['README-GAMEMAKER.md','가져오기 순서와 띠마다 프레임 수·칸 크기·원점·속도.']]},
   target:{title:'GameMaker에서(GameMaker 매뉴얼 기준, 여기서 실행하지 않음)',steps:[
    '띠마다 스프라이트를 만들고 Sprite Editor의 Import를 쓰거나 PNG를 IDE로 끌어다 놓습니다. 파일 이름은 그대로 두세요. `_stripN` 접미사가 있어야 GameMaker가 N프레임으로 자릅니다.',
    '스프라이트의 프레임 수와 칸 크기가 README와 같은지 확인합니다(예: 64 × 64 프레임 6개).',
    '원점을 README나 `gamemaker.json`의 x·y로 직접 지정합니다(예: x 32, y 64).',
    '속도 방식을 Frames per second로 하고 README의 값을 넣습니다(예: 8).',
    '스프라이트에 필요한 충돌 마스크 방식(Automatic, Full Image, Manual)을 고릅니다.',
    '도트 그림이라면 대상 플랫폼 Game Options의 Graphics 항목에서 Interpolate colours between pixels를 끕니다. 매뉴얼에는 기본값이 켜짐으로 나와 있습니다.']},
   verify:{steps:[
    'Sprite Editor에 N프레임이 보이고, 프레임마다 너비가 띠 너비 ÷ N이어야 합니다.',
    '모든 프레임에서 원점 십자 표시가 발에 있어야 합니다.',
    '미리보기가 README의 속도로 재생되고, `run` 한 바퀴가 6 × 125 = 750ms여야 합니다.']},
   trouble:{rows:[
    ['띠 전체가 넓은 프레임 하나로 들어옴','파일 이름이 바뀌어 `_stripN`이 사라짐(내려받을 때 " (1)"이 붙기도 함)','가져오기 전에 파일 이름 확인','프레임 수를 넣어 `…_stripN.png`로 되돌리기'],
    ['프레임이 가운데에서 잘림','이름의 N이 이미지의 실제 프레임 수와 다름','띠 너비 ÷ N이 README의 칸 너비와 같은지','실제 개수가 들어 있는 Nerulio의 파일 이름 그대로 사용'],
    ['프레임이 바뀔 때 캐릭터가 튐','원점을 기본값(왼쪽 위)으로 두었거나 눈대중으로 정함','Sprite Editor의 원점 입력 칸','README의 원점을 입력. Nerulio가 이미 모든 피벗을 그 점에 맞춰 두었음'],
    ['길이가 들쭉날쭉한 애니메이션이 일정하게 재생됨','GameMaker 스프라이트는 속도가 하나라 내보내기가 태그 속도를 쓰고 경고함','내보내기 안내와 `gamemaker.json`의 `uniformTiming: false`','코드에서 `durationsMs`로 프레임을 넘기거나, 내보내기 전에 길이를 맞추기'],
    ['애니메이션이 너무 빠름','속도 방식이 Frames per second가 아니라 Frames per game frame','값 옆의 속도 방식','Frames per second로 바꾸기'],
    ['게임 안에서 도트가 흐리게 보임','Interpolate colours between pixels가 켜져 있음','Game Options › 해당 플랫폼 › Graphics','끄기. Nerulio는 실행할 GameMaker가 없어 이런 GameMaker 설정을 전혀 시험할 수 없음']]},
   alternatives:{rows:[
    ['GameMaker Image Editor의 Convert to Frames나 Import Strip Image','프레임들이 이미 같은 기준점을 가진 고른 격자일 때. 프레임 수·크기·오프셋을 GameMaker에서 입력합니다.'],
    ['.aseprite 파일에서 시작','태그가 띠가 되고 시간은 JSON에 남습니다: [[game/aseprite-to-gamemaker|Aseprite를 GameMaker로]].'],
    ['낱장 PNG 프레임','다른 도구나 엔진이 프레임마다 파일 하나를 원할 때: [[game/sprite-sheet-to-png-frames|스프라이트 시트를 PNG 프레임으로]].']]},
   limits:['GameMaker에서 미검증: 이 파일로 GameMaker를 실행한 적이 없고, 띠를 디코딩(Pillow)해 원본 프레임과 비교했을 뿐입니다.','히트박스와 충돌 폴리곤은 GameMaker용으로 쓰지 않습니다.','스프라이트마다 속도가 하나라 프레임별 길이는 gamemaker.json의 데이터로만 남습니다.'],
   versions:{body:['확인한 것: 288 × 480 사무라이 시트의 GameMaker 띠를 Pillow로 디코딩했고, 모든 칸이 원래 프레임과 같았습니다. GameMaker 자체는 실행하지 않았습니다. 검증 환경에 헤드리스 GameMaker가 없어 Studio는 이 대상을 미검증으로 표시합니다. `_stripN` 규칙, 가져오기 방법, 원점과 속도 설정, 보간 옵션은 GameMaker 매뉴얼에서 가져왔습니다.'],sources:GM_DOCS}
  },
  ja:{
   answer:'GameMakerは、ファイル名が`_stripN`で終わる横長の帯画像をNフレームのスプライトとして取り込み、1フレームの幅は帯の幅 ÷ Nです。384 × 64の`spr_hero_run_strip6.png`は64 × 64のフレーム6枚になります。GameMakerはアニメーションごとに1スプライトを求め、スプライトごとに原点と速度は1つずつです。Nerulioはスプライトシート（またはGIF、個別のフレーム、.aseprite）をアニメーションごとにこうした帯1本に切り、全フレームをピボットにそろえ、原点と速度入りの`gamemaker.json`を添えます。GameMaker上では未検証です。GameMakerで読み込んだことはなく、命名と手順はGameMakerのマニュアルに従っています。',
   concept:{title:'GameMakerが帯画像を読む仕組み',body:[
    'GameMakerではスプライトアセット1つが1つのアニメーションです。フレーム群、原点（既定は左上、またはプリセットや任意の点）、Frames per secondかFrames per game frame単位の再生速度、コリジョンマスクを持ちます。マニュアルの帯の決まりは、フレームを左から横に並べ、ファイル名を`_stripN`で終え、1フレームを帯の幅 ÷ Nとすることです。帯はSprite EditorのImportボタンか、IDEへのドラッグで取り込みます。',
    '複数行あるシート全体は帯ではありません。GameMakerのImage Editorは1枚の画像を自分で分割でき（Convert to FramesまたはImport Strip Image）、フレーム数・フレームの幅と高さ・オフセットを指定します。これが手作業の方法で、入力した数値どおりに切るだけで、ピボットにはそろえません。',
    'スプライトの原点は1つなので、全フレームの基準点がセル内の同じピクセルにないと、フレームが変わるたびにキャラクターが跳ねます。Nerulioはアニメーションごとに共通のセル1つへ、各フレームのキャンバス全体をピボットが同じ点に来るようずらして描き、その点を`gamemaker.json`とREADMEの原点として書きます。セルの幅は、ピボットより左の最大距離と右の最大距離の和です。',
    'スプライトの速度も1つだけです。アニメーションの全フレームが同じ長さなら速度 = 1000 ÷ msを書き、違えばアニメーションの速度（Studioのタグは10 FPS）を書いて警告し、自分のコードで使えるようフレームごとのミリ秒を`durationsMs`に残します。'],
    terms:[['_stripN','画像をNフレームに切るようGameMakerに伝えるファイル名の接尾辞。'],['原点（Origin）','スプライトの基準点。Sprite Editorでプリセットかx・yの直接入力で決める。'],['Frames per second / per game frame','GameMakerのスプライトの2つの速度の方式。'],['Convert to Frames','フレーム数・大きさ・オフセットで1枚の画像を分けるGameMakerのImage Editorのコマンド。']]},
   example:{title:'例：1行が1本の帯になる',lines:[
    'シートの"run"行：64 × 64のフレーム6枚、各125 ms、ピボット下中央 (32, 64)',
    '  Nerulioの帯：    spr_hero_run_strip6.png    6 × 64 = 幅384 px、高さ64 px',
    '  GameMakerの分割：384 / 6 = 1フレーム64 px（マニュアルの帯の決まり）',
    '  原点 x 32、y 64          速度 1000 / 125 = 毎秒8フレーム',
    '',
    '"attack"行：4フレーム、100, 100, 150, 250 ms → スプライトの速度は1つだけ',
    '  playbackSpeed 10（タグの速度）＋警告、durationsMsに100, 100, 150, 250を保持',
    '  毎秒10フレームだとGameMakerは600 msではなく4 × 100 = 400 msで再生'],
    after:'攻撃のリズムを守る必要があるなら、`durationsMs`を使ってコードでフレームの時間を制御するか、書き出す前に全フレームの長さをそろえてください。'},
   outputs:{lead:'パック＆書き出し › GameMakerが書き出すファイル（`hero`というファイルの場合）です。',rows:[
    ['spr_hero_run_strip6.png','アニメーションごとの横長の帯1本。名前にフレーム数が入っています。'],
    ['gamemaker.json','スプライトごとにファイル、フレーム数、セルの幅と高さ、`xorigin`、`yorigin`、毎秒フレーム単位の`playbackSpeed`、ループ、`durationsMs`、`verified: false`。'],
    ['README-GAMEMAKER.md','取り込み手順と、帯ごとのフレーム数・セルの大きさ・原点・速度。']]},
   target:{title:'GameMakerで（GameMakerのマニュアルに基づく。ここでは未実行）',steps:[
    '帯ごとにスプライトを作り、Sprite EditorのImportを使うか、PNGをIDEへドラッグします。ファイル名は変えないでください。`_stripN`の接尾辞があるからGameMakerがNフレームに切ります。',
    'スプライトのフレーム数とセルの大きさがREADMEと同じか確認します（例：64 × 64のフレーム6枚）。',
    '原点をREADMEか`gamemaker.json`のx・yで直接指定します（例：x 32、y 64）。',
    '速度の方式をFrames per secondにし、READMEの値を入れます（例：8）。',
    'スプライトに必要なコリジョンマスクの方式（Automatic、Full Image、Manual）を選びます。',
    'ドット絵なら、対象プラットフォームのGame OptionsのGraphicsでInterpolate colours between pixelsを切ります。マニュアルでは既定でオンとされています。']},
   verify:{steps:[
    'Sprite EditorにNフレームが表示され、各フレームの幅が帯の幅 ÷ Nのはずです。',
    'すべてのフレームで原点の十字が足元にあるはずです。',
    'プレビューがREADMEの速度で再生され、`run`の1周が6 × 125 = 750msのはずです。']},
   trouble:{rows:[
    ['帯全体が1枚の横長フレームとして入る','ファイル名が変わって`_stripN`が消えた（ダウンロード時に「 (1)」が付くことも）','取り込む前にファイル名を確認','フレーム数を入れた`…_stripN.png`に戻す'],
    ['フレームが途中で切れる','名前のNが画像の実際のフレーム数と違う','帯の幅 ÷ NがREADMEのセル幅と同じか','実際の数が入ったNerulioのファイル名をそのまま使う'],
    ['フレームが変わるとキャラクターが跳ねる','原点を既定（左上）のままにしたか、目分量で決めた','Sprite Editorの原点の入力欄','READMEの原点を入れる。Nerulioはすでに全ピボットをその点にそろえている'],
    ['長さが不ぞろいなアニメーションが均等に再生される','GameMakerのスプライトは速度が1つなので、書き出しはタグの速度を使い警告している','書き出しの注意と`gamemaker.json`の`uniformTiming: false`','コードで`durationsMs`に従ってフレームを進めるか、書き出し前に長さをそろえる'],
    ['アニメーションが速すぎる','速度の方式がFrames per secondではなくFrames per game frameになっている','値の横の速度の方式','Frames per secondに切り替える'],
    ['ゲーム内でドット絵がぼやける','Interpolate colours between pixelsがオン','Game Options › 対象プラットフォーム › Graphics','オフにする。Nerulioには動かせるGameMakerがなく、こうしたGameMakerの設定は一切試せない']]},
   alternatives:{rows:[
    ['GameMakerのImage EditorのConvert to FramesやImport Strip Image','フレームがすでに同じ基準点を持つ均一なグリッドのとき。フレーム数・大きさ・オフセットはGameMakerで入力します。'],
    ['.asepriteファイルから始める','タグが帯になり、時間はJSONに残ります：[[game/aseprite-to-gamemaker|AsepriteをGameMakerへ]]。'],
    ['個別のPNGフレーム','別のツールやエンジンが1フレーム1ファイルを求めるとき：[[game/sprite-sheet-to-png-frames|スプライトシートをPNGフレームへ]]。']]},
   limits:['GameMakerでは未検証：これらのファイルでGameMakerを動かしたことはなく、帯をデコード（Pillow）して元のフレームと比べただけです。','ヒットボックスと当たり判定のポリゴンはGameMaker向けには書き出しません。','スプライトごとに速度は1つなので、フレームごとの長さはgamemaker.jsonのデータとしてのみ残ります。'],
   versions:{body:['確認したこと：288 × 480のサムライのシートから作ったGameMaker用の帯をPillowでデコードし、全セルが元のフレームと一致しました。GameMaker自体は動かしていません。検証環境にヘッドレスのGameMakerがないため、Studioはこの書き出し先を未検証と表示します。`_stripN`の決まり、取り込み方法、原点と速度の設定、補間のオプションはGameMakerのマニュアルに基づきます。'],sources:GM_DOCS}
  }
 },
 // ------------------------------------------------------------------ Aseprite → GameMaker
 // Nerulio: aseprite import (tags, repeat, visible layers), export/engines.js gamemakerFiles (ident(): lower-case,
 // non-alphanumerics → "_"; N = playback steps; pivotCell; speed rule), common.js playback (ping-pong 0-1-2-1).
 'game/aseprite-to-gamemaker':{
  type:'conversion',
  intent:{primary:'bring an .aseprite animation into GameMaker',secondary:['one sprite strip per tag with _stripN','origin from the Aseprite pivot','what happens to per-frame durations'],
   goal:'one GameMaker sprite per Aseprite tag with the right frame count, a stable origin and the closest speed GameMaker can express',input:'.aseprite / .ase file with tags',output:'spr_<file>_<tag>_stripN.png per tag + gamemaker.json + README-GAMEMAKER.md',target:'GameMaker (UNVERIFIED: never loaded in GameMaker)',support:'partial',
   evidence:['src/game/export/engines.js (gamemakerFiles, pivotCell, ident)','src/game/export/common.js playback()','src/studio/sprite/aseprite-bridge.js','docs/STUDIO-PACK.md (GameMaker UNVERIFIED; strips decoded by Pillow)'],
   external:['GameMaker Manual: Strip Images, The Sprite Editor, Windows Game Options','Aseprite docs: Tags']},
  en:{
   answer:'GameMaker does not open `.aseprite` files; it imports images, and a PNG named `…_stripN` becomes a sprite of N frames. Drop the file into Nerulio, check the tags and export for GameMaker: every tag becomes its own strip (`spr_hero_attack_strip4.png`), with reverse and ping-pong written out, every frame placed on its pivot so one origin fits all, and `gamemaker.json` with the origin, the speed and each frame\'s milliseconds. A GameMaker sprite has one speed, so uneven timing is kept only as data. UNVERIFIED in GameMaker: the strips were decoded and compared with the source, never loaded in GameMaker.',
   concept:{title:'From tags with timing to sprites with one speed',body:[
    'Aseprite keeps a whole character in one file: frames with their own durations, tags for each action with a direction and a repeat count, layers, and slices that can hold a pivot. GameMaker keeps each action as a separate sprite asset with frames, one origin and one playback speed, and the manual\'s strip rule lets one PNG carry all frames of that sprite.',
    'Nerulio composites the visible layers per frame and walks each tag in playback order: a reverse tag is written backwards and a ping-pong tag of 3 frames becomes 0-1-2-1, so N counts the steps of one cycle. All frames of a tag are drawn on one common cell with the pivot on the same pixel; that pixel is the origin. File names are lower-cased with anything but letters, digits and underscores turned into `_`.',
    'Timing is where the formats differ most. If every frame of a tag lasts the same, the speed is exactly 1000 ÷ ms frames per second. If not, the strip gets the tag\'s rate (10 FPS for Studio tags), the export warns you, and the true milliseconds stay in `durationsMs`. The repeat count becomes a `loop` flag in the JSON; the strip itself carries no timing or loop setting.'],
    terms:[['Tag','A named frame range in Aseprite with a direction and a repeat count.'],['Strip','One horizontal PNG with all frames of a sprite, named `…_stripN`.'],['Common cell','The frame box shared by all frames of a strip, sized so every pivot lands on one point.'],['durationsMs','The exact milliseconds of every frame, kept in gamemaker.json.']]},
   example:{title:'Example: three tags of a 32 × 32 hero',lines:[
    'idle    4 × 125 ms, ∞         → spr_hero_idle_strip4.png     speed 1000 / 125 = 8, loop true',
    'jump    3 × 80 ms, ping-pong   → order 0-1-2-1 → spr_hero_jump_strip4.png   speed 12.5',
    'attack  100, 100, 150, 250 ms  → spr_hero_attack_strip4.png   speed 10 + warning, loop false',
    '',
    'attack pivots on the 32 × 32 frames: x = 16, 16, 20, 12 (a lunge), y = 31',
    '  cell width  = max left 20 + max right (32 − 12) 20 = 40',
    '  cell height = 31 + (32 − 31) = 32        origin x 20, y 31',
    '  strip = 4 × 40 = 160 × 32 px'],
    after:'The attack cell is wider than the 32 px frame because the pivot moves inside the drawing; placing every pivot on x 20 is what keeps the body still while the arm lunges.'},
   mapping:{title:'What survives the conversion',head:['In Aseprite','In Nerulio\'s GameMaker files','In GameMaker'],rows:[
    ['Tag','One strip per tag, e.g. `spr_hero_attack_strip4.png`','One sprite, cut into N frames on import'],
    ['Direction reverse / ping-pong','Frame order written out; N = steps of one cycle','N frames in that order'],
    ['Equal frame durations','`playbackSpeed` = 1000 ÷ ms','Speed in Frames per second'],
    ['Mixed frame durations','Tag rate + a warning; exact ms in `durationsMs`','One speed; per-frame time only through your code'],
    ['Pivot slice or P pivot','Every frame on a common cell; `xorigin`, `yorigin`','Custom origin'],
    ['Repeat ∞ / a count','`loop: true` / `loop: false` in the JSON','Not set by the import; stop play-once sprites in code'],
    ['Visible layers','Composited; hidden layers left out','Flattened frames'],
    ['Hit / hurt slices','Not written (use the Generic JSON export)','Collision mask set in GameMaker']]},
   outputs:{rows:[
    ['spr_hero_attack_strip4.png','One strip per tag, cells of equal size with the pivot on one point.'],
    ['gamemaker.json','For each sprite: file, frame count, cell size, origin, speed in frames per second, loop, `durationsMs`, `uniformTiming`, `verified: false`.'],
    ['README-GAMEMAKER.md','Import steps and the origin and speed of every strip.']]},
   target:{title:'Bring the strips into GameMaker (manual-based; not run here)',steps:[
    'Unzip the bundle: one PNG per tag. Import each one into its own sprite with the Sprite Editor\'s Import button, or drag it into the IDE, without renaming it.',
    'Name the sprite asset after the file without the suffix (`spr_hero_attack`), so your code can refer to it.',
    'Set the origin to the custom x and y from the README; for the attack above, x 20 and y 31.',
    'Set the speed to Frames per second with the README value: 8 for idle, 12.5 for jump, 10 for attack.',
    'For play-once tags (`loop: false`), switch back to the idle sprite in your code after the last frame.',
    'For pixel art, switch off Interpolate colours between pixels in your platform\'s Game Options › Graphics.']},
   verify:{steps:[
    '`spr_hero_jump` has 4 frames in the order 0-1-2-1 and `spr_hero_attack` 4 frames of 40 × 32.',
    'The origin cross stays on the feet through every frame of attack.',
    'Idle cycles in 4 × 125 = 500 ms, the same as Aseprite\'s preview.']},
   trouble:{rows:[
    ['The attack plays faster than in Aseprite','Mixed durations: the sprite has one speed (10), so the 150 and 250 ms frames last 100 ms','`uniformTiming: false` and the export warning','Time the frames from `durationsMs` in code, or give the tag equal durations in Aseprite'],
    ['A ping-pong sprite has more frames than the tag','The back-and-forth order is written into the strip (3 frames → 4)','Frame order 0-1-2-1','Expected; play the sprite forwards and do not reverse it again'],
    ['Idle and attack have different origins','Each strip has its own cell, so the numbers differ even when the anchor is the same point of the art','Compare the README values per strip','Enter each sprite\'s own origin; do not copy one origin to all'],
    ['A layer is missing or a hidden one appears','Only the layers visible in the file are composited','Layer visibility in Aseprite','Show or hide the layer in Aseprite (or on Nerulio\'s timeline) and export again'],
    ['The file name differs from the tag name','Names are lower-cased and spaces or symbols become `_` ("Attack 2" → `attack_2`)','The README lists every file','Use the file name as written, or rename the tag in Aseprite'],
    ['Something is off in GameMaker itself','This export was never loaded in GameMaker','—','Nerulio cannot check GameMaker behaviour; compare with the manual, and report the case so it can be fixed']]},
   alternatives:{rows:[
    ['Aseprite\'s File › Export Sprite Sheet as a horizontal strip per tag, renamed to `_stripN`','You already own Aseprite and a tag has one pivot and even timing; you set origin and speed by hand.'],
    ['A sprite sheet you already have','[[game/gamemaker-sprite-strip|GameMaker strips from a sprite sheet]].'],
    ['Another engine with per-frame timing','[[game/aseprite-to-godot|Aseprite to Godot]] keeps every frame\'s duration.']]},
   limits:['UNVERIFIED in GameMaker: the strips were decoded and compared with the source frames only.','One speed per sprite: uneven timing survives only in gamemaker.json.','No hitboxes or collision shapes in the GameMaker files.'],
   versions:{body:['Checked: the GameMaker strips decode with Pillow and every cell equals its source frame; the .aseprite reader reopened 231 real files in Aseprite 1.3.18 with the same tags, durations and pixels. Not checked: loading anything in GameMaker, which has no headless mode in the verification setup. The strip naming, import routes, origin, speed modes and the interpolation option follow the GameMaker manual.'],sources:[...GM_DOCS,'[Aseprite docs: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ko:{
   answer:'GameMaker는 `.aseprite` 파일을 열지 못하고 이미지를 가져오며, 이름이 `…_stripN`인 PNG는 N프레임 스프라이트가 됩니다. 파일을 Nerulio에 넣고 태그를 확인한 뒤 GameMaker로 내보내면 태그마다 띠 이미지 하나(`spr_hero_attack_strip4.png`)가 생깁니다. 역재생·핑퐁은 풀어 쓰고, 모든 프레임을 피벗에 맞춰 원점 하나로 충분하게 하고, 원점·속도·프레임별 밀리초를 `gamemaker.json`에 적습니다. GameMaker 스프라이트는 속도가 하나라서 들쭉날쭉한 시간은 데이터로만 남습니다. GameMaker에서는 미검증입니다. 띠를 디코딩해 원본과 비교했을 뿐 GameMaker로 불러온 적은 없습니다.',
   concept:{title:'시간이 있는 태그에서 속도가 하나인 스프라이트로',body:[
    'Aseprite는 캐릭터 전체를 파일 하나에 담습니다. 길이가 제각각인 프레임, 방향과 반복 횟수가 있는 동작별 태그, 레이어, 피벗을 담을 수 있는 슬라이스입니다. GameMaker는 동작마다 따로 된 스프라이트 에셋에 프레임, 원점 하나, 재생 속도 하나를 두며, 매뉴얼의 띠 규칙 덕분에 PNG 한 장이 그 스프라이트의 모든 프레임을 담을 수 있습니다.',
    'Nerulio는 프레임마다 보이는 레이어를 합성하고 태그를 재생 순서대로 따라갑니다. 역재생 태그는 거꾸로 쓰고, 3프레임 핑퐁 태그는 0-1-2-1이 되므로 N은 한 바퀴의 단계 수입니다. 한 태그의 모든 프레임은 피벗이 같은 픽셀에 오도록 공통 칸 하나에 그려지고, 그 픽셀이 원점입니다. 파일 이름은 소문자로 바뀌고 영문자·숫자·밑줄이 아닌 문자는 `_`가 됩니다.',
    '두 형식이 가장 다른 곳은 시간입니다. 태그의 모든 프레임 길이가 같으면 속도는 정확히 초당 1000 ÷ ms프레임입니다. 다르면 띠에 태그 속도(Studio 태그는 10 FPS)를 쓰고 경고하며, 실제 밀리초는 `durationsMs`에 남습니다. 반복 횟수는 JSON의 `loop` 값이 되고, 띠 자체에는 시간이나 반복 설정이 없습니다.'],
    terms:[['태그','Aseprite에서 방향과 반복 횟수가 있는, 이름 붙은 프레임 구간.'],['띠(Strip)','스프라이트의 모든 프레임을 담은 가로 PNG 한 장, 이름은 `…_stripN`.'],['공통 칸','한 띠의 모든 프레임이 공유하는 칸. 모든 피벗이 한 점에 오도록 크기를 정함.'],['durationsMs','프레임마다 정확한 밀리초. gamemaker.json에 남음.']]},
   example:{title:'예시: 32 × 32 캐릭터의 태그 세 개',lines:[
    'idle    4 × 125 ms, ∞          → spr_hero_idle_strip4.png     속도 1000 / 125 = 8, loop true',
    'jump    3 × 80 ms, 핑퐁         → 순서 0-1-2-1 → spr_hero_jump_strip4.png   속도 12.5',
    'attack  100, 100, 150, 250 ms   → spr_hero_attack_strip4.png   속도 10 + 경고, loop false',
    '',
    'attack의 32 × 32 프레임 피벗: x = 16, 16, 20, 12(찌르기), y = 31',
    '  칸 너비 = 왼쪽 최대 20 + 오른쪽 최대 (32 − 12) 20 = 40',
    '  칸 높이 = 31 + (32 − 31) = 32        원점 x 20, y 31',
    '  띠 = 4 × 40 = 160 × 32 px'],
    after:'그림 안에서 피벗이 움직이기 때문에 attack 칸은 32px 프레임보다 넓습니다. 모든 피벗을 x 20에 두어야 팔이 찌르는 동안 몸이 제자리에 있습니다.'},
   mapping:{title:'변환 후에도 남는 것',head:['Aseprite','Nerulio의 GameMaker 파일','GameMaker'],rows:[
    ['태그','태그마다 띠 하나(예: `spr_hero_attack_strip4.png`)','가져올 때 N프레임으로 잘리는 스프라이트 하나'],
    ['방향: 역방향·핑퐁','프레임 순서를 풀어 씀. N = 한 바퀴의 단계 수','그 순서의 N프레임'],
    ['프레임 길이가 모두 같음','`playbackSpeed` = 1000 ÷ ms','Frames per second 단위 속도'],
    ['프레임 길이가 섞임','태그 속도 + 경고, 실제 ms는 `durationsMs`','속도 하나. 프레임별 시간은 코드로만'],
    ['피벗 슬라이스나 P 피벗','모든 프레임을 공통 칸에 배치, `xorigin`·`yorigin`','직접 지정한 원점'],
    ['반복 ∞ / 횟수','JSON의 `loop: true` / `loop: false`','가져오기로 설정되지 않음. 한 번 재생할 스프라이트는 코드로 멈춤'],
    ['보이는 레이어','합성, 숨긴 레이어는 제외','합쳐진 프레임'],
    ['hit / hurt 슬라이스','쓰지 않음(범용 JSON 내보내기 사용)','충돌 마스크는 GameMaker에서 설정']]},
   outputs:{rows:[
    ['spr_hero_attack_strip4.png','태그마다 띠 하나. 칸 크기가 같고 피벗이 한 점에 있음.'],
    ['gamemaker.json','스프라이트마다 파일, 프레임 수, 칸 크기, 원점, 초당 프레임 단위 속도, 반복, `durationsMs`, `uniformTiming`, `verified: false`.'],
    ['README-GAMEMAKER.md','가져오기 순서와 띠마다 원점·속도.']]},
   target:{title:'띠를 GameMaker로 가져오기(매뉴얼 기준, 여기서 실행하지 않음)',steps:[
    '번들 압축을 풉니다. 태그마다 PNG가 하나씩 있습니다. 각각을 이름을 바꾸지 말고 Sprite Editor의 Import 버튼이나 IDE로 끌어다 놓기로 별도 스프라이트에 가져옵니다.',
    '코드에서 부를 수 있게 스프라이트 에셋 이름을 접미사를 뺀 파일 이름(`spr_hero_attack`)으로 짓습니다.',
    '원점을 README의 x·y로 직접 지정합니다. 위 attack이라면 x 20, y 31입니다.',
    '속도 방식을 Frames per second로 하고 README 값을 넣습니다. idle 8, jump 12.5, attack 10입니다.',
    '한 번만 재생하는 태그(`loop: false`)는 마지막 프레임 뒤에 코드에서 idle 스프라이트로 돌려놓습니다.',
    '도트 그림이면 해당 플랫폼 Game Options › Graphics의 Interpolate colours between pixels를 끕니다.']},
   verify:{steps:[
    '`spr_hero_jump`는 0-1-2-1 순서의 4프레임, `spr_hero_attack`은 40 × 32 프레임 4개여야 합니다.',
    'attack의 모든 프레임에서 원점 십자 표시가 발에 머물러야 합니다.',
    'idle 한 바퀴는 4 × 125 = 500ms로 Aseprite 미리보기와 같아야 합니다.']},
   trouble:{rows:[
    ['공격이 Aseprite보다 빠르게 재생됨','길이가 섞여 있는데 스프라이트 속도는 하나(10)라서 150·250ms 프레임도 100ms가 됨','`uniformTiming: false`와 내보내기 경고','코드에서 `durationsMs`로 프레임 시간을 맞추거나, Aseprite에서 태그 길이를 같게'],
    ['핑퐁 스프라이트의 프레임이 태그보다 많음','왕복 순서를 띠에 풀어 썼기 때문(3프레임 → 4)','프레임 순서 0-1-2-1','정상입니다. 정방향으로 재생하고 다시 뒤집지 마세요'],
    ['idle과 attack의 원점이 다름','띠마다 칸이 따로라서, 그림에서는 같은 기준점이어도 숫자가 다름','README의 띠별 값 비교','스프라이트마다 제 원점을 입력. 원점 하나를 모두에 복사하지 않기'],
    ['레이어가 빠지거나 숨긴 레이어가 보임','파일에서 보이는 레이어만 합성함','Aseprite의 레이어 표시 상태','Aseprite(또는 Nerulio 타임라인)에서 레이어를 켜거나 끄고 다시 내보내기'],
    ['파일 이름이 태그 이름과 다름','이름을 소문자로 바꾸고 공백·기호는 `_`로 바꿈("Attack 2" → `attack_2`)','README에 모든 파일이 나옴','적힌 파일 이름을 쓰거나 Aseprite에서 태그 이름 변경'],
    ['GameMaker 안에서 무언가 어긋남','이 내보내기는 GameMaker로 불러온 적이 없음','—','Nerulio는 GameMaker 동작을 확인할 수 없습니다. 매뉴얼과 대조하고, 고칠 수 있도록 사례를 알려 주세요']]},
   alternatives:{rows:[
    ['Aseprite의 File › Export Sprite Sheet로 태그마다 가로 띠를 내보내고 `_stripN`으로 이름 변경','이미 Aseprite가 있고 태그의 피벗이 하나, 시간이 일정할 때. 원점과 속도는 직접 넣습니다.'],
    ['이미 가진 스프라이트 시트','[[game/gamemaker-sprite-strip|스프라이트 시트로 GameMaker 띠 만들기]].'],
    ['프레임별 시간이 있는 다른 엔진','[[game/aseprite-to-godot|Aseprite를 Godot로]]는 프레임마다 길이를 지킵니다.']]},
   limits:['GameMaker에서 미검증: 띠를 디코딩해 원본 프레임과 비교했을 뿐입니다.','스프라이트마다 속도가 하나라 들쭉날쭉한 시간은 gamemaker.json에만 남습니다.','GameMaker 파일에는 히트박스나 충돌 모양이 없습니다.'],
   versions:{body:['확인한 것: GameMaker 띠가 Pillow로 디코딩되고 모든 칸이 원래 프레임과 같습니다. .aseprite 읽기는 실제 파일 231개가 Aseprite 1.3.18에서 같은 태그·길이·픽셀로 다시 열리는 것으로 확인했습니다. 확인하지 않은 것: GameMaker로 무엇이든 불러오는 일입니다. 검증 환경에는 헤드리스 GameMaker가 없습니다. 띠 이름 규칙, 가져오기 방법, 원점, 속도 방식, 보간 옵션은 GameMaker 매뉴얼을 따릅니다.'],sources:[...GM_DOCS,'[Aseprite 문서: Tags](https://www.aseprite.org/docs/tags/)']}
  },
  ja:{
   answer:'GameMakerは`.aseprite`ファイルを開けず、画像を取り込みます。名前が`…_stripN`のPNGはNフレームのスプライトになります。ファイルをNerulioに入れてタグを確認し、GameMaker向けに書き出すと、タグごとに帯画像1枚（`spr_hero_attack_strip4.png`）ができます。逆再生・ピンポンは展開し、全フレームをピボットにそろえて原点1つで足りるようにし、原点・速度・フレームごとのミリ秒を`gamemaker.json`に書きます。GameMakerのスプライトは速度が1つなので、不ぞろいな時間はデータとしてだけ残ります。GameMaker上では未検証です。帯をデコードして元と比べただけで、GameMakerで読み込んだことはありません。',
   concept:{title:'時間を持つタグから、速度が1つのスプライトへ',body:[
    'Asepriteはキャラクター全体を1ファイルに持ちます。長さがばらばらのフレーム、方向と繰り返し回数を持つ動作ごとのタグ、レイヤー、ピボットを持てるスライスです。GameMakerは動作ごとに別のスプライトアセットにフレーム、原点1つ、再生速度1つを持ち、マニュアルの帯の決まりによってPNG 1枚にそのスプライトの全フレームを入れられます。',
    'Nerulioはフレームごとに表示中のレイヤーを合成し、タグを再生順にたどります。逆再生のタグは逆順に書き、3フレームのピンポンのタグは0-1-2-1になるので、Nは1周のステップ数です。1つのタグの全フレームは、ピボットが同じピクセルに来るよう共通のセル1つに描かれ、そのピクセルが原点です。ファイル名は小文字になり、英字・数字・アンダースコア以外は`_`になります。',
    '2つの形式がいちばん違うのは時間です。タグの全フレームが同じ長さなら、速度はちょうど毎秒 1000 ÷ ms フレームです。違えば帯にはタグの速度（Studioのタグは10 FPS）を書いて警告し、実際のミリ秒は`durationsMs`に残ります。繰り返し回数はJSONの`loop`になり、帯そのものには時間もループの設定もありません。'],
    terms:[['タグ','Asepriteで方向と繰り返し回数を持つ、名前付きのフレーム範囲。'],['帯（Strip）','スプライトの全フレームを並べた横長のPNG 1枚。名前は`…_stripN`。'],['共通のセル','1本の帯の全フレームが共有するセル。全ピボットが1点に来るように大きさを決める。'],['durationsMs','フレームごとの正確なミリ秒。gamemaker.jsonに残る。']]},
   example:{title:'例：32 × 32のキャラクターのタグ3つ',lines:[
    'idle    4 × 125 ms、∞          → spr_hero_idle_strip4.png     速度 1000 / 125 = 8、loop true',
    'jump    3 × 80 ms、ピンポン     → 順序0-1-2-1 → spr_hero_jump_strip4.png   速度 12.5',
    'attack  100, 100, 150, 250 ms   → spr_hero_attack_strip4.png   速度 10 ＋警告、loop false',
    '',
    'attackの32 × 32フレームのピボット：x = 16, 16, 20, 12（突き）、y = 31',
    '  セルの幅   = 左の最大 20 + 右の最大 (32 − 12) 20 = 40',
    '  セルの高さ = 31 + (32 − 31) = 32        原点 x 20、y 31',
    '  帯 = 4 × 40 = 160 × 32 px'],
    after:'絵の中でピボットが動くため、attackのセルは32pxのフレームより広くなります。全ピボットをx 20に置くからこそ、腕が突き出る間も体がその場にとどまります。'},
   mapping:{title:'変換後に残るもの',head:['Aseprite','NerulioのGameMaker用ファイル','GameMaker'],rows:[
    ['タグ','タグごとに帯1本（例：`spr_hero_attack_strip4.png`）','取り込み時にNフレームに切られるスプライト1つ'],
    ['方向：逆方向・ピンポン','フレーム順を展開。N = 1周のステップ数','その順のNフレーム'],
    ['フレームの長さがすべて同じ','`playbackSpeed` = 1000 ÷ ms','Frames per second単位の速度'],
    ['フレームの長さが混在','タグの速度＋警告、実際のmsは`durationsMs`','速度は1つ。フレームごとの時間はコードでのみ'],
    ['ピボットスライスかPのピボット','全フレームを共通のセルに配置、`xorigin`・`yorigin`','任意指定の原点'],
    ['繰り返し ∞ / 回数','JSONの`loop: true` / `loop: false`','取り込みでは設定されない。1回再生のスプライトはコードで止める'],
    ['表示中のレイヤー','合成、非表示のレイヤーは除外','統合されたフレーム'],
    ['hit / hurtのスライス','書かない（汎用JSONの書き出しを使う）','コリジョンマスクはGameMakerで設定']]},
   outputs:{rows:[
    ['spr_hero_attack_strip4.png','タグごとの帯1本。セルの大きさがそろい、ピボットが1点にある。'],
    ['gamemaker.json','スプライトごとにファイル、フレーム数、セルの大きさ、原点、毎秒フレーム単位の速度、ループ、`durationsMs`、`uniformTiming`、`verified: false`。'],
    ['README-GAMEMAKER.md','取り込み手順と、帯ごとの原点・速度。']]},
   target:{title:'帯をGameMakerに取り込む（マニュアルに基づく。ここでは未実行）',steps:[
    'バンドルを展開します。タグごとにPNGが1枚あります。それぞれを名前を変えずに、Sprite EditorのImportボタンかIDEへのドラッグで別々のスプライトに取り込みます。',
    'コードから呼べるよう、スプライトアセットの名前を接尾辞を除いたファイル名（`spr_hero_attack`）にします。',
    '原点をREADMEのx・yで直接指定します。上のattackならx 20、y 31です。',
    '速度の方式をFrames per secondにし、READMEの値を入れます。idleは8、jumpは12.5、attackは10です。',
    '1回だけ再生するタグ（`loop: false`）は、最後のフレームのあとにコードでidleのスプライトに戻します。',
    'ドット絵なら、対象プラットフォームのGame Options › GraphicsでInterpolate colours between pixelsを切ります。']},
   verify:{steps:[
    '`spr_hero_jump`は0-1-2-1の順の4フレーム、`spr_hero_attack`は40 × 32のフレーム4枚のはずです。',
    'attackの全フレームで原点の十字が足元にとどまるはずです。',
    'idleの1周は4 × 125 = 500msで、Asepriteのプレビューと同じはずです。']},
   trouble:{rows:[
    ['攻撃がAsepriteより速く再生される','長さが混在しているのにスプライトの速度は1つ（10）なので、150・250msのフレームも100msになる','`uniformTiming: false`と書き出しの警告','コードで`durationsMs`に従ってフレームの時間を合わせるか、Asepriteでタグの長さをそろえる'],
    ['ピンポンのスプライトのフレームがタグより多い','往復の順序を帯に展開して書いたため（3フレーム → 4）','フレーム順0-1-2-1','正常です。順方向に再生し、さらに反転させないでください'],
    ['idleとattackで原点が違う','帯ごとにセルが別なので、絵の上では同じ基準点でも数値が違う','READMEの帯ごとの値を比べる','スプライトごとにそれぞれの原点を入れる。1つの原点を全部にコピーしない'],
    ['レイヤーが欠ける、非表示のはずのレイヤーが見える','ファイルで表示中のレイヤーだけを合成する','Asepriteのレイヤーの表示状態','Aseprite（またはNerulioのタイムライン）でレイヤーの表示を切り替えて書き出し直す'],
    ['ファイル名がタグ名と違う','名前は小文字にし、空白や記号は`_`にする（"Attack 2" → `attack_2`）','READMEに全ファイルが載っている','書かれたファイル名を使うか、Asepriteでタグ名を変える'],
    ['GameMakerの中で何かがおかしい','この書き出しはGameMakerで読み込んだことがない','—','NerulioはGameMakerの動作を確認できません。マニュアルと照らし合わせ、直せるよう事例を知らせてください']]},
   alternatives:{rows:[
    ['AsepriteのFile › Export Sprite Sheetでタグごとに横長の帯を書き出し、`_stripN`に改名','すでにAsepriteがあり、タグのピボットが1つで時間が均一なとき。原点と速度は手で入れます。'],
    ['手元にあるスプライトシート','[[game/gamemaker-sprite-strip|スプライトシートからGameMakerの帯を作る]]。'],
    ['フレームごとの時間を持てる別のエンジン','[[game/aseprite-to-godot|AsepriteをGodotへ]]はフレームごとの長さを保ちます。']]},
   limits:['GameMakerでは未検証：帯をデコードして元のフレームと比べただけです。','スプライトごとに速度は1つなので、不ぞろいな時間はgamemaker.jsonにだけ残ります。','GameMaker用のファイルにはヒットボックスも当たり判定の形もありません。'],
   versions:{body:['確認したこと：GameMaker用の帯がPillowでデコードでき、全セルが元のフレームと一致すること。.asepriteの読み込みは、実在の231ファイルがAseprite 1.3.18で同じタグ・長さ・ピクセルのまま開き直せることで確認しました。確認していないこと：GameMakerで何かを読み込むこと。検証環境にヘッドレスのGameMakerはありません。帯の命名、取り込み方法、原点、速度の方式、補間のオプションはGameMakerのマニュアルに基づきます。'],sources:[...GM_DOCS,'[Asepriteドキュメント：Tags](https://www.aseprite.org/docs/tags/)']}
  }
 },
 // ------------------------------------------------------------------ GDevelop
 // Nerulio has NO GDevelop export (grep: GDevelop appears only in SEO copy). What it offers is the classic Sprite Lab
 // frames ZIP: src/task/sprite-lab.js framesZip (one PNG per frame at the frame canvas size), names from
 // src/game/frame-ops.js framesFromRects + src/primitives.js frameNumber (<sheet>_001, ≥ 3 digits), ZIP <sheet>-frames.zip.
 // GDevelop side: wiki.gdevelop.io (Sprite object, Piskel sheet import, Sprite Sheet Animations extension, Scale mode, points).
 'game/gdevelop-sprite-sheet':{
  type:'engine',
  intent:{primary:'use a sprite sheet for a GDevelop sprite animation',secondary:['cut the sheet into equal frame images','time between frames and loop in GDevelop','Piskel import and the Sprite Sheet Animations extension'],
   goal:'a GDevelop sprite object with one animation per row of the sheet, frames in order, steady and sharp',input:'a sprite sheet PNG',output:'ZIP of one PNG per frame (<sheet>_001.png …), equal size when cut by grid',target:'GDevelop 5 (nothing was loaded in GDevelop)',support:'partial',
   evidence:['src/task/sprite-lab.js (framesZip)','src/game/frame-ops.js (framesFromRects: names, canvas = cell)','src/primitives.js (frameNumber)','grep: no GDevelop exporter in src/'],
   external:['GDevelop wiki: Sprite object (add images, time between frames 0.08 s default, loop off by default)','Import a sprite sheet using Piskel','Sprite Sheet Animations extension','Game properties: Scale mode nearest','Edit points (origin top-left, center)']},
  en:{
   answer:'A GDevelop sprite object builds each animation from separate images, one per frame, so a sprite sheet has to be cut first. Nerulio has no GDevelop export: what it gives you is plain PNG frames. Its Sprite Lab measures the grid and downloads a ZIP with one equal-size PNG per frame, numbered in reading order (`hero_001.png` …). In GDevelop you add one row\'s images to each animation, set the time between frames in seconds (1 ÷ FPS; the default is 0.08 s) and turn loop on. Nothing here was loaded in GDevelop; its steps come from the GDevelop wiki.',
   concept:{title:'What GDevelop expects from a sheet',body:[
    'In GDevelop a Sprite object has animations, and each animation is a list of images played in the order shown. Every animation has one value for the time between two frames, in seconds (0.08 s by default), and a loop toggle; without loop an animation plays once and stops on its last frame. Animations get names that your events use with "Change the animation (by name)".',
    'The editor itself does not slice a PNG into frames. GDevelop offers two ways around that: the built-in Piskel editor can import a sprite sheet for one animation whose frames are evenly spaced, and the Sprite Sheet Animations extension animates a Tiled Sprite from a sheet by rows and columns or from a TexturePacker pixi.js-style JSON. Otherwise you import frame images.',
    'Every sprite starts with an Origin point at the top-left corner of the image (it positions the object) and a Center point at half the image size (it rotates and flips around it). If the frame images of one animation differ in size, those points fall on different parts of the art and the character shifts; equal-size frames avoid that, and GDevelop can share the same points across all images of an animation.',
    'Nerulio\'s part is the cutting. In Grid mode the Sprite Lab measures cell size, margin and spacing, so every PNG has the cell\'s size; Auto mode finds sprites separated by transparency on an uneven sheet, and its Normalize step puts them on one common canvas. Pixels are copied, not redrawn, and a colour key can clear an opaque backdrop first. The ZIP carries no timing, names or hitboxes.'],
    terms:[['Time between frames','GDevelop\'s per-animation frame time in seconds; 1 ÷ FPS.'],['Loop','Off by default: the animation plays once. On: it repeats.'],['Origin / Center','Default sprite points: top-left corner, and half the image size.'],['Scale mode (Sampling)','Project setting; "nearest" keeps pixel art sharp.']]},
   example:{title:'Worked example: a three-row sheet',lines:[
    'hero.png 512 × 192 px: 3 rows (idle, run, attack) × 8 columns of 64 × 64',
    '  Sprite Lab, Grid: cell 64 × 64 → hero-frames.zip with 24 PNGs of 64 × 64',
    '  hero_001 … hero_008 = idle   hero_009 … hero_016 = run   hero_017 … hero_024 = attack',
    '',
    'GDevelop sprite object "Hero": 3 animations of 8 images',
    '  run at 12 FPS   → time between frames = 1 / 12 = 0.083 s',
    '  idle at 100 ms  → 0.1 s            GDevelop default 0.08 s = 12.5 FPS',
    '  Origin (0, 0) top-left      Center (32, 32) = half of 64 × 64'],
    after:'One run cycle then takes 8 × 0.083 ≈ 0.67 s. A frame that should hold twice as long can be added twice, because one animation has only one frame time.'},
   outputs:{lead:'The classic Sprite Lab\'s frames download (not a GDevelop export):',rows:[
    ['hero-frames.zip','One PNG per frame, named after the sheet.'],
    ['hero_001.png …','Frames in reading order, zero-padded to at least three digits so a file picker keeps them in order; each PNG is the cell size in Grid mode.']]},
   target:{title:'Build the animations in GDevelop (from the GDevelop wiki; not run here)',steps:[
    'Unzip the frames. In GDevelop, add a new object, choose Sprite and name it.',
    'Click Add an animation and give it a name (idle). Add images and select `hero_001` to `hero_008` together; GDevelop plays them in the order shown.',
    'Set the time between frames next to the clock icon: 1 ÷ FPS in seconds, for example 0.1 for 10 FPS.',
    'Turn loop on for idle and run; leave it off for a one-shot attack.',
    'Repeat for each row, then switch animations in events with "Change the animation (by name)".',
    'For pixel art, set the project\'s Scale mode (Sampling) to nearest in the game properties.',
    'If the object should stand on its feet, move the Origin point in Edit points and keep the points shared by all images of the animation.']},
   verify:{steps:[
    'Each animation lists its images in file order: idle 001–008, run 009–016, attack 017–024.',
    'In the preview the run cycle takes about 0.67 s at 0.083 s per frame.',
    'The character does not shift between frames: all images are 64 × 64.',
    'Zoomed in, pixel edges stay hard with Scale mode nearest.']},
   trouble:{rows:[
    ['The animation plays once and stops','Loop is off by default','The loop toggle of that animation','Turn loop on'],
    ['Frames play in the wrong order','Files were picked in another order, or names without zero padding sort 1, 10, 2','Image order in the animation','Use the zero-padded names from the ZIP, and reorder images if needed'],
    ['The character wobbles','The frames have different sizes (cut by Auto), so origin and center land on different art','Compare the image sizes','Cut with Grid, or run Normalize before downloading; share points across the animation'],
    ['Sprites are blurry','Scale mode is linear','Game properties › Scale mode','Set it to nearest'],
    ['An uneven GIF timing plays evenly','One animation has one time between frames','Compare with the source delays','Add long frames twice, or split the action into two animations'],
    ['Piskel\'s import cuts the sheet wrong','Its frame size does not match, or the sheet holds several animations','The frame boxes in Piskel\'s Import and Merge window','Enter the real frame size for one animation, or cut with the Sprite Lab; see [[game/sprite-sheet-frame-size|frame size]]']]},
   alternatives:{rows:[
    ['GDevelop\'s built-in Piskel: Import as Sprite sheet','One animation with evenly spaced frames: no other tool, and the frames land in the animation directly.'],
    ['The Sprite Sheet Animations extension','You want to keep one image on a Tiled Sprite and drive frames by row and column or from TexturePacker\'s pixi.js JSON. Nerulio\'s PixiJS export writes a similar `frames` + `animations` layout, but it was never tried with this extension.'],
    ['Separate frames for any tool','The same cutting, explained for every engine: [[game/sprite-sheet-to-png-frames|sprite sheet to PNG frames]].']]},
   limits:['Nerulio has no GDevelop export: only PNG frames, without timing, names or hitboxes.','Nothing was loaded in GDevelop; the GDevelop steps come from its wiki.','One time between frames per GDevelop animation: uneven timing needs repeated frames.'],
   versions:{body:['Nerulio\'s part: the Sprite Lab cuts the sheet and every PNG in the ZIP was measured equal to its box on the sheet, with nothing scaled or smoothed. GDevelop was not run. The object, animation, loop, frame-time, points, Piskel and Scale mode details come from the GDevelop 5 wiki.'],sources:GD_DOCS}
  },
  ko:{
   answer:'GDevelop 스프라이트 오브젝트는 애니메이션을 프레임마다 따로 된 이미지로 만들기 때문에 스프라이트 시트는 먼저 잘라야 합니다. Nerulio에는 GDevelop 전용 내보내기가 없고, 제공하는 것은 일반 PNG 프레임입니다. 스프라이트 랩이 격자를 재고 프레임마다 같은 크기의 PNG를 읽는 순서대로 번호 붙여(`hero_001.png` …) ZIP으로 내려받게 합니다. GDevelop에서는 애니메이션마다 한 행의 이미지를 넣고, 프레임 간 시간을 초 단위(1 ÷ FPS, 기본 0.08초)로 정하고 반복을 켭니다. 여기서 GDevelop으로 불러온 것은 없으며, GDevelop 단계는 GDevelop 위키를 따릅니다.',
   concept:{title:'GDevelop이 시트에서 기대하는 것',body:[
    'GDevelop의 스프라이트 오브젝트에는 애니메이션이 있고, 애니메이션은 보이는 순서대로 재생되는 이미지 목록입니다. 애니메이션마다 두 프레임 사이 시간이 초 단위로 하나(기본 0.08초)이고 반복 토글이 있으며, 반복을 켜지 않으면 한 번 재생된 뒤 마지막 프레임에서 멈춥니다. 애니메이션에 붙인 이름은 이벤트의 "Change the animation (by name)"에서 씁니다.',
    '편집기 자체는 PNG를 프레임으로 자르지 않습니다. GDevelop에는 두 가지 우회로가 있습니다. 내장 Piskel 편집기는 프레임 간격이 고른 애니메이션 하나짜리 시트를 가져올 수 있고, Sprite Sheet Animations 확장은 Tiled Sprite를 행·열이나 TexturePacker pixi.js 형식 JSON으로 움직입니다. 그 밖에는 프레임 이미지를 가져와야 합니다.',
    '모든 스프라이트는 이미지 왼쪽 위의 Origin 점(오브젝트 위치를 정함)과 이미지 크기의 절반 위치인 Center 점(회전·뒤집기의 중심)으로 시작합니다. 한 애니메이션의 프레임 크기가 제각각이면 이 점들이 그림의 다른 곳에 놓여 캐릭터가 흔들립니다. 프레임 크기를 같게 하면 이를 막을 수 있고, GDevelop은 애니메이션의 모든 이미지에 같은 점을 공유하게 할 수 있습니다.',
    'Nerulio가 맡는 것은 자르기입니다. 격자 모드에서 스프라이트 랩이 칸 크기·여백·간격을 재므로 모든 PNG가 칸 크기가 됩니다. 자동 모드는 크기가 제각각인 시트에서 투명으로 떨어진 스프라이트를 찾고, 정렬(Normalize) 단계가 이를 공통 캔버스에 올립니다. 픽셀은 다시 그리지 않고 복사하며, 불투명 배경은 먼저 키 색으로 지울 수 있습니다. ZIP에는 시간, 이름, 히트박스가 들어 있지 않습니다.'],
    terms:[['프레임 간 시간','GDevelop 애니메이션마다 하나인 프레임 시간(초). 1 ÷ FPS.'],['반복(Loop)','기본은 꺼짐: 한 번 재생. 켜면 반복.'],['Origin / Center','스프라이트 기본 점: 왼쪽 위 모서리, 이미지 크기의 절반.'],['Scale mode (Sampling)','프로젝트 설정. "nearest"면 픽셀아트가 선명하게 유지됨.']]},
   example:{title:'예시: 세 행짜리 시트',lines:[
    'hero.png 512 × 192 px: 64 × 64 칸이 3행(idle, run, attack) × 8열',
    '  스프라이트 랩, 격자: 칸 64 × 64 → 64 × 64 PNG 24장이 든 hero-frames.zip',
    '  hero_001 … hero_008 = idle   hero_009 … hero_016 = run   hero_017 … hero_024 = attack',
    '',
    'GDevelop 스프라이트 오브젝트 "Hero": 이미지 8장짜리 애니메이션 3개',
    '  run 12 FPS    → 프레임 간 시간 = 1 / 12 = 0.083초',
    '  idle 100 ms   → 0.1초             GDevelop 기본값 0.08초 = 12.5 FPS',
    '  Origin (0, 0) 왼쪽 위      Center (32, 32) = 64 × 64의 절반'],
    after:'그러면 run 한 바퀴는 8 × 0.083 ≈ 0.67초입니다. 애니메이션마다 프레임 시간이 하나뿐이므로, 두 배로 오래 머물러야 할 프레임은 두 번 넣으면 됩니다.'},
   outputs:{lead:'기존 스프라이트 랩의 프레임 내려받기(GDevelop 전용 내보내기가 아님)입니다.',rows:[
    ['hero-frames.zip','프레임마다 PNG 한 장, 이름은 시트를 따름.'],
    ['hero_001.png …','읽는 순서대로 된 프레임. 파일 선택 창에서도 순서가 유지되도록 최소 세 자리로 0을 채우며, 격자 모드에서는 각 PNG가 칸 크기입니다.']]},
   target:{title:'GDevelop에서 애니메이션 만들기(GDevelop 위키 기준, 여기서 실행하지 않음)',steps:[
    '프레임 압축을 풉니다. GDevelop에서 새 오브젝트를 추가하고 Sprite를 고른 뒤 이름을 붙입니다.',
    'Add an animation을 누르고 이름(idle)을 정합니다. 이미지 추가에서 `hero_001`부터 `hero_008`까지 한꺼번에 고릅니다. GDevelop은 보이는 순서대로 재생합니다.',
    '시계 아이콘 옆에 프레임 간 시간을 넣습니다. 초 단위 1 ÷ FPS이며, 10 FPS면 0.1입니다.',
    'idle과 run은 반복을 켜고, 한 번 나가는 attack은 끈 채로 둡니다.',
    '행마다 반복한 뒤, 이벤트의 "Change the animation (by name)"으로 애니메이션을 바꿉니다.',
    '픽셀아트라면 게임 속성에서 프로젝트 Scale mode(Sampling)를 nearest로 합니다.',
    '오브젝트가 발을 기준으로 서야 한다면 Edit points에서 Origin 점을 옮기고, 애니메이션의 모든 이미지가 점을 공유하게 둡니다.']},
   verify:{steps:[
    '애니메이션마다 이미지가 파일 순서대로 있어야 합니다: idle 001–008, run 009–016, attack 017–024.',
    '미리보기에서 run 한 바퀴가 프레임당 0.083초로 약 0.67초 걸려야 합니다.',
    '모든 이미지가 64 × 64라서 프레임 사이에 캐릭터가 밀리지 않아야 합니다.',
    'Scale mode가 nearest면 확대해도 픽셀 경계가 선명해야 합니다.']},
   trouble:{rows:[
    ['애니메이션이 한 번 재생되고 멈춤','반복이 기본적으로 꺼져 있음','해당 애니메이션의 반복 토글','반복 켜기'],
    ['프레임 순서가 틀림','파일을 다른 순서로 골랐거나, 0을 채우지 않은 이름이 1, 10, 2 순으로 정렬됨','애니메이션 안의 이미지 순서','ZIP의 0 채운 이름을 쓰고 필요하면 이미지 순서 조정'],
    ['캐릭터가 흔들림','프레임 크기가 제각각(자동 모드로 자름)이라 Origin과 Center가 그림의 다른 곳에 놓임','이미지 크기 비교','격자로 자르거나 내려받기 전에 정렬(Normalize) 실행. 애니메이션 전체에 점 공유'],
    ['스프라이트가 흐림','Scale mode가 linear','게임 속성 › Scale mode','nearest로 설정'],
    ['GIF의 들쭉날쭉한 시간이 일정하게 재생됨','애니메이션 하나에 프레임 간 시간이 하나뿐','원본 딜레이와 비교','오래 머물 프레임을 두 번 넣거나 동작을 애니메이션 두 개로 나누기'],
    ['Piskel 가져오기가 시트를 잘못 자름','프레임 크기가 맞지 않거나 시트에 애니메이션이 여러 개 있음','Piskel Import and Merge 창의 프레임 상자','애니메이션 하나 기준으로 실제 프레임 크기를 넣거나 스프라이트 랩으로 자르기. [[game/sprite-sheet-frame-size|프레임 크기]] 참고']]},
   alternatives:{rows:[
    ['GDevelop 내장 Piskel: Import as Sprite sheet','프레임 간격이 고른 애니메이션 하나라면 다른 도구 없이 프레임이 바로 애니메이션에 들어갑니다.'],
    ['Sprite Sheet Animations 확장','Tiled Sprite에 이미지 한 장을 두고 행·열이나 TexturePacker pixi.js JSON으로 프레임을 움직이고 싶을 때. Nerulio의 PixiJS 내보내기도 비슷한 `frames` + `animations` 구조를 쓰지만 이 확장으로 시험한 적은 없습니다.'],
    ['어떤 도구에나 쓰는 낱장 프레임','같은 자르기를 엔진 전반에 맞춰 설명한 페이지: [[game/sprite-sheet-to-png-frames|스프라이트 시트를 PNG 프레임으로]].']]},
   limits:['Nerulio에는 GDevelop 전용 내보내기가 없습니다. 시간·이름·히트박스 없이 PNG 프레임만 줍니다.','GDevelop으로 불러온 것은 없으며, GDevelop 단계는 위키를 따릅니다.','GDevelop 애니메이션마다 프레임 간 시간이 하나라서 들쭉날쭉한 시간은 프레임을 반복해 넣어야 합니다.'],
   versions:{body:['Nerulio가 맡은 부분: 스프라이트 랩이 시트를 자르며, ZIP 안의 모든 PNG가 시트의 상자와 같고 확대나 보간이 없음을 측정했습니다. GDevelop은 실행하지 않았습니다. 오브젝트, 애니메이션, 반복, 프레임 시간, 점, Piskel, Scale mode에 관한 내용은 GDevelop 5 위키를 따릅니다.'],sources:GD_DOCS}
  },
  ja:{
   answer:'GDevelopのスプライトオブジェクトは、アニメーションを1フレーム1枚の別々の画像で組み立てるので、スプライトシートは先に分割する必要があります。NerulioにはGDevelop専用の書き出しはなく、提供するのは普通のPNGフレームです。スプライトラボがグリッドを測り、フレームごとに同じ大きさのPNGを読み順に番号付き（`hero_001.png` …）でZIPにまとめて保存できます。GDevelopではアニメーションごとに1行分の画像を追加し、フレーム間の時間を秒（1 ÷ FPS、既定は0.08秒）で設定してループをオンにします。ここではGDevelopで何も読み込んでおらず、GDevelop側の手順はGDevelopのwikiに基づきます。',
   concept:{title:'GDevelopがシートに求めるもの',body:[
    'GDevelopのスプライトオブジェクトにはアニメーションがあり、アニメーションは表示されている順に再生される画像の一覧です。アニメーションごとに2フレーム間の時間が秒で1つ（既定0.08秒）あり、ループの切り替えがあります。ループしないと1回再生して最後のフレームで止まります。アニメーションに付けた名前は、イベントの「Change the animation (by name)」で使います。',
    'エディター自体はPNGをフレームに分割しません。GDevelopには回り道が2つあります。内蔵のPiskelエディターはフレームが等間隔の1アニメーション分のシートを取り込めます。Sprite Sheet Animations拡張はTiled Spriteを行・列、またはTexturePackerのpixi.js形式のJSONで動かします。それ以外はフレームの画像を取り込みます。',
    'どのスプライトも、画像の左上にあるOrigin点（オブジェクトの位置を決める）と、画像の大きさの半分の位置にあるCenter点（回転と反転の中心）から始まります。1つのアニメーションのフレームの大きさがばらばらだと、これらの点が絵の別の場所に来てキャラクターが揺れます。フレームの大きさをそろえれば防げますし、GDevelopはアニメーション内の全画像で同じ点を共有できます。',
    'Nerulioが受け持つのは分割です。グリッドモードではスプライトラボがセルサイズ・余白・間隔を測るので、全PNGがセルの大きさになります。自動モードは大きさのばらばらなシートから透明で分かれたスプライトを見つけ、整列（Normalize）の段階で共通のキャンバスに載せます。ピクセルは描き直さずコピーし、不透明な背景は先にキーカラーで消せます。ZIPには時間・名前・ヒットボックスは入りません。'],
    terms:[['フレーム間の時間','GDevelopのアニメーションごとに1つあるフレームの時間（秒）。1 ÷ FPS。'],['ループ','既定はオフで1回再生。オンで繰り返す。'],['Origin / Center','スプライトの既定の点：左上の角と、画像の大きさの半分。'],['Scale mode（Sampling）','プロジェクトの設定。"nearest"ならドット絵がくっきり保たれる。']]},
   example:{title:'例：3行のシート',lines:[
    'hero.png 512 × 192 px：64 × 64のセルが3行（idle、run、attack）× 8列',
    '  スプライトラボ、グリッド：セル64 × 64 → 64 × 64のPNG 24枚入りのhero-frames.zip',
    '  hero_001 … hero_008 = idle   hero_009 … hero_016 = run   hero_017 … hero_024 = attack',
    '',
    'GDevelopのスプライトオブジェクト「Hero」：画像8枚のアニメーション3つ',
    '  run 12 FPS    → フレーム間の時間 = 1 / 12 = 0.083秒',
    '  idle 100 ms   → 0.1秒             GDevelopの既定0.08秒 = 12.5 FPS',
    '  Origin (0, 0) 左上      Center (32, 32) = 64 × 64の半分'],
    after:'するとrunの1周は8 × 0.083 ≈ 0.67秒です。アニメーションごとにフレームの時間は1つだけなので、2倍長く止めたいフレームは2回追加します。'},
   outputs:{lead:'従来のスプライトラボのフレーム保存（GDevelop専用の書き出しではありません）です。',rows:[
    ['hero-frames.zip','フレームごとにPNG 1枚。名前はシートに由来。'],
    ['hero_001.png …','読み順に並んだフレーム。ファイル選択画面でも順番が保たれるよう最低3桁にゼロ埋めし、グリッドモードでは各PNGがセルの大きさです。']]},
   target:{title:'GDevelopでアニメーションを作る（GDevelopのwikiに基づく。ここでは未実行）',steps:[
    'フレームを展開します。GDevelopで新しいオブジェクトを追加し、Spriteを選んで名前を付けます。',
    'Add an animationを押して名前（idle）を付けます。画像の追加で`hero_001`から`hero_008`までをまとめて選びます。GDevelopは表示されている順に再生します。',
    '時計のアイコンの横にフレーム間の時間を入れます。秒単位の1 ÷ FPSで、10 FPSなら0.1です。',
    'idleとrunはループをオンにし、1回きりのattackはオフのままにします。',
    '行ごとに繰り返し、イベントの「Change the animation (by name)」でアニメーションを切り替えます。',
    'ドット絵なら、ゲームのプロパティでプロジェクトのScale mode（Sampling）をnearestにします。',
    'オブジェクトを足元基準で立たせたいなら、Edit pointsでOrigin点を動かし、アニメーション内の全画像で点を共有したままにします。']},
   verify:{steps:[
    '各アニメーションの画像がファイルの順に並んでいるはずです：idle 001–008、run 009–016、attack 017–024。',
    'プレビューでrunの1周が1フレーム0.083秒でおよそ0.67秒のはずです。',
    '全画像が64 × 64なので、フレーム間でキャラクターがずれないはずです。',
    'Scale modeがnearestなら、拡大してもピクセルの境界がくっきりしているはずです。']},
   trouble:{rows:[
    ['アニメーションが1回再生して止まる','ループは既定でオフ','そのアニメーションのループの切り替え','ループをオンにする'],
    ['フレームの順番が違う','別の順番でファイルを選んだ、またはゼロ埋めしていない名前が1、10、2の順に並んだ','アニメーション内の画像の順序','ZIPのゼロ埋めの名前を使い、必要なら画像を並べ替える'],
    ['キャラクターが揺れる','フレームの大きさがばらばら（自動モードで分割）で、OriginとCenterが絵の別の場所に来る','画像の大きさを比べる','グリッドで分割するか、保存前に整列（Normalize）を実行。アニメーション全体で点を共有'],
    ['スプライトがぼやける','Scale modeがlinear','ゲームのプロパティ › Scale mode','nearestにする'],
    ['GIFの不ぞろいな時間が均等に再生される','1つのアニメーションにフレーム間の時間は1つだけ','元のディレイと比べる','長く止めたいフレームを2回入れるか、動作を2つのアニメーションに分ける'],
    ['Piskelの取り込みでシートがずれて切れる','フレームサイズが合っていない、またはシートに複数のアニメーションがある','PiskelのImport and Mergeウィンドウのフレームの枠','1アニメーション分の実際のフレームサイズを入れるか、スプライトラボで分割する。[[game/sprite-sheet-frame-size|フレームサイズ]]を参照']]},
   alternatives:{rows:[
    ['GDevelop内蔵のPiskel：Import as Sprite sheet','フレームが等間隔な1アニメーションなら、ほかのツールなしでフレームがそのままアニメーションに入ります。'],
    ['Sprite Sheet Animations拡張','Tiled Spriteに画像1枚を置いたまま、行・列やTexturePackerのpixi.js JSONでフレームを動かしたいとき。NerulioのPixiJS書き出しも似た`frames` + `animations`の構造ですが、この拡張で試したことはありません。'],
    ['どのツールにも使える個別フレーム','同じ分割をエンジン全般向けに説明したページ：[[game/sprite-sheet-to-png-frames|スプライトシートをPNGフレームへ]]。']]},
   limits:['NerulioにはGDevelop専用の書き出しがありません。時間・名前・ヒットボックスなしのPNGフレームだけです。','GDevelopでは何も読み込んでおらず、GDevelopの手順はwikiに基づきます。','GDevelopのアニメーションはフレーム間の時間が1つなので、不ぞろいな時間はフレームの重複で表す必要があります。'],
   versions:{body:['Nerulioが受け持つ部分：スプライトラボがシートを分割し、ZIP内の全PNGがシート上の枠と一致し、拡大や補間がないことを測定しました。GDevelopは動かしていません。オブジェクト、アニメーション、ループ、フレームの時間、点、Piskel、Scale modeについてはGDevelop 5のwikiに基づきます。'],sources:GD_DOCS}
  }
 }
};
