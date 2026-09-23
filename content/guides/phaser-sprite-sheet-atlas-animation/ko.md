Phaser에서 칸 크기가 모두 같은 스프라이트 시트는 `this.load.spritesheet(key, url, { frameWidth, frameHeight, margin, spacing })`로 불러오고, `this.anims.create({ frames: this.anims.generateFrameNumbers(key, { start, end }) })`로 애니메이션을 만듭니다. 패킹된 아틀라스(TexturePacker JSON의 hash 또는 array 형식)는 `this.load.atlas`와 `generateFrameNames`를 쓰고, Aseprite에서 내보낸 파일은 `this.load.aseprite`로 불러온 뒤 `this.anims.createFromAseprite`로 애니메이션을 만듭니다. 이 코드는 Phaser 3.90과 Phaser 4에서 수정 없이 그대로 동작합니다. 도트(픽셀 아트)가 흐려지지 않게 하려면 게임 설정에 `pixelArt: true`를 넣습니다.

이 문서의 코드는 모두 Phaser 3.90.0과 Phaser 4.2.1(WebGL, Chromium)에서 실제로 실행해 확인했습니다. 두 버전이 그린 테스트 화면은 픽셀 단위로 같았습니다.

## 파일 종류별 로더 {#which-loader}

| 가진 파일 | 로더 | 프레임 키 | 애니메이션 도우미 |
|---|---|---|---|
| PNG 한 장, 모든 칸이 같은 크기 | `load.spritesheet` | 숫자 0, 1, 2… | `generateFrameNumbers` |
| PNG + TexturePacker 형식 JSON(hash/array) | `load.atlas` | JSON에 적힌 이름 | `generateFrameNames` |
| 여러 장의 PNG + `textures` 목록이 있는 JSON 하나 | `load.multiatlas` | JSON에 적힌 이름 | `generateFrameNames` |
| Aseprite에서 내보낸 PNG + JSON | `load.aseprite` | `"0"`, `"1"`… | `createFromAseprite` |
| JSON으로 저장한 애니메이션 정의 | `load.json` | (아무 텍스처) | `anims.fromJSON` |

처음에는 격자 시트가 가장 간단합니다. 프레임 크기가 제각각이거나, 투명한 여백을 잘라 내거나(trim), 여러 캐릭터를 한 텍스처에 모으게 되면 아틀라스가 낫습니다. 자세한 비교는 [스프라이트 시트와 텍스처 아틀라스의 차이](guide:sprite-sheet-vs-texture-atlas)에 정리했습니다.

## 스프라이트 시트를 불러와 재생하기 {#load-and-play}

:::steps
1. **격자를 잽니다.** PNG를 열어 칸 크기, 시트 전체를 두른 빈 테두리(`margin`), 칸 사이 간격(`spacing`)을 확인합니다. 아래 예제에 쓴 Kenney의 Pixel Platformer 캐릭터는 24×24 칸에 칸 사이 간격 1px, 테두리 0입니다.
2. **픽셀 아트 모드를 켭니다.** 게임 설정에 `pixelArt: true`를 넣습니다. 텍스처가 최근접(nearest) 필터링으로 바뀌고, 안티앨리어싱이 꺼지고, 위치가 정수로 반올림됩니다.
3. **`preload`에서 시트를 불러옵니다.** `this.load.spritesheet('chars', 'assets/characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1, margin: 0 })`을 호출합니다. 프레임 번호는 왼쪽에서 오른쪽, 위에서 아래 순서로 0부터 붙습니다.
4. **`create`에서 애니메이션을 만듭니다.** `this.anims.create({ key: 'green-walk', frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }), frameRate: 6, repeat: -1 })`. `repeat: -1`은 무한 반복입니다.
5. **스프라이트를 추가하고 재생합니다.** `this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk')`. 원본 픽셀 하나가 화면 픽셀 몇 개를 덮는지가 일정하도록 배율은 2, 3, 4 같은 정수로 줍니다.
6. **프레임이 이상하면 자른 결과를 확인합니다.** `this.textures.get('chars').frameTotal`은 열 × 행 + 1이어야 합니다(Phaser가 이미지 전체를 가리키는 `__BASE` 프레임을 하나 더 만듭니다). 이 예제는 9 × 3 + 1 = 28입니다.
:::

실제로 실행한 장면 전체입니다.

```js
// main.js — Phaser 3.90과 Phaser 4.x에서 수정 없이 동작
function preload() {
  // 24x24 칸, 칸 사이 1px 간격, 시트 테두리 없음
  this.load.spritesheet('chars', 'assets/characters.png', {
    frameWidth: 24,
    frameHeight: 24,
    spacing: 1,
    margin: 0
  });
}

function create() {
  this.anims.create({
    key: 'green-walk',
    frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }),
    frameRate: 6,
    repeat: -1
  });
  // 순서를 마음대로, 같은 프레임을 반복해도 됨: 15, 16, 17, 16으로 도는 대기 동작
  this.anims.create({
    key: 'spike-idle',
    frames: this.anims.generateFrameNumbers('chars', { frames: [15, 16, 17, 16] }),
    frameRate: 8,
    repeat: -1
  });
  this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk');
  this.add.sprite(200, 100, 'chars', 15).setScale(3).play('spike-idle');
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 720,
  height: 310,
  pixelArt: true, // nearest 필터링, 안티앨리어싱 끔, 픽셀 반올림
  scene: { preload, create }
});
```

![Phaser 테스트 화면: spacing을 넣고 자른 시트와 빼고 자른 시트, 다섯 가지 로더로 만든 애니메이션](shot:engine-phaser-spritesheet "Phaser 4.2.1(WebGL)에서 pixelArt: true, 3배로 그린 화면입니다. Phaser 3.90.0도 똑같은 이미지를 그렸습니다. 그림: Kenney, CC0.")

## margin, spacing, startFrame, endFrame {#spritesheet-config}

Phaser는 열 수를 `floor((width − margin + spacing) / (frameWidth + spacing))`로 계산하고, 행 수도 같은 방식으로 셉니다. 각 칸은 앞 칸보다 `frameWidth + spacing`만큼 뒤에서 시작합니다. 칸 사이에 간격이 있는 시트에서 `spacing`을 빠뜨리면, 프레임마다 원래 위치보다 1px씩 더 왼쪽에서 잘립니다. 테스트 시트의 8번 프레임은 x = 200이 아니라 192에서 시작했고, 위 그림 가운데 줄에서 점점 밀려 가는 모습이 바로 이것입니다. 첫 프레임은 맞는데 뒤로 갈수록 밀리면 spacing을, 격자 전체가 통째로 어긋나면 margin을 고칩니다.

- `frameHeight`를 생략하면 `frameWidth`와 같은 값이 됩니다. 정사각형 칸이면 `frameWidth`만 적어도 됩니다.
- `startFrame`과 `endFrame`은 시트의 일부만 남깁니다. `endFrame`은 **전체 격자 기준의 인덱스이고, 그 프레임까지 포함**합니다. API 문서에는 "추출할 프레임의 총개수"라고 적혀 있지만 실제 동작은 다릅니다. 남긴 프레임은 **0번부터 다시 번호가 매겨집니다.** `startFrame: 9, endFrame: 10`이면 프레임 0과 1(그리고 `__BASE`)이 생기고, 0번은 (0, 25)에 있는 칸입니다.
- `generateFrameNumbers`는 `start`, `end`(기본값 −1은 마지막 프레임), `first`(맨 앞에 한 장 붙일 프레임), 또는 순서를 직접 적는 `frames` 배열을 받습니다.

## 텍스처 아틀라스: JSON hash와 JSON array {#atlas-hash-array}

TexturePacker를 비롯한 대부분의 패커는 두 가지 JSON 형식 중 하나를 씁니다. **hash** 형식은 `frames`가 프레임 이름을 키로 하는 객체이고, **array** 형식은 `frames`가 `filename` 필드를 가진 객체의 배열입니다. 어느 쪽인지 Phaser에 알려 줄 필요는 없습니다. `load.atlas`가 `frames`가 배열인지 보고 알맞은 파서를 고릅니다. 테스트에서는 두 파일 모두 같은 프레임 10개와 `__BASE`를 만들었습니다.

```js
// preload
this.load.atlas('chars-atlas', 'assets/characters.png', 'assets/characters.json');

// create — 프레임 이름 "blue/walk_0001", "blue/walk_0002"
this.anims.create({
  key: 'blue-walk',
  frames: this.anims.generateFrameNames('chars-atlas', {
    prefix: 'blue/walk_',
    start: 1,
    end: 2,
    zeroPad: 4 // 1 -> "0001"
  }),
  frameRate: 6,
  repeat: -1
});
```

`generateFrameNames`는 이름을 `prefix + zeroPad 자리로 채운 숫자 + suffix`로 만듭니다. **없는 이름은 건너뛰고** 콘솔에 경고("Frame … not found in texture …")만 남깁니다. 애니메이션의 프레임 수가 모자라다면 거의 항상 prefix, `.png` 같은 suffix, 또는 `zeroPad`가 JSON과 맞지 않는 경우입니다. 설정 없이 `generateFrameNames('chars-atlas')`로 부르면 아틀라스의 모든 프레임을 돌려줍니다.

**여러 페이지 아틀라스.** 패커가 여러 장으로 나눠 담으면, 각 페이지 이미지와 그 프레임을 `textures` 배열에 나열한 JSON 하나를 씁니다. `this.load.multiatlas('chars-multi', 'assets/characters-multi.json', 'assets/')`로 불러옵니다. 세 번째 인자는 페이지 이미지가 있는 폴더입니다. 그다음부터 프레임 이름은 아틀라스 한 장일 때와 똑같이 쓰면 되고, 한 애니메이션이 여러 페이지의 프레임을 섞어 써도 됩니다.

> **회전:** Nerulio의 엔진 테스트에서 TexturePacker 형식의 회전 저장 프레임은 Phaser 3.90과 4.2 모두에서 뒤집혀 그려졌습니다. 직접 확인하지 않았다면 Phaser용으로는 회전을 끄고 패킹하세요.

## Aseprite 파일 {#aseprite}

Aseprite에서 **File › Export Sprite Sheet**를 엽니다. Output 탭에서 **JSON Data**(Hash나 Array)를 켜고, Meta의 **Tags**를 체크한 채로 두고, **Item Filename**을 `{frame}`으로 바꿉니다. 명령줄로는 `aseprite -b hero.aseprite --sheet hero.png --data hero.json --format json-hash --list-tags --filename-format "{frame}"`입니다. `{frame}`이 중요합니다. `createFromAseprite`는 `"0"`, `"1"`… 키로 프레임을 찾기 때문에, `hero 0.aseprite` 같은 Aseprite 기본 이름으로 내보내면 애니메이션에 프레임이 하나도 들어가지 않습니다.

```js
// preload
this.load.aseprite('aliens', 'assets/aliens.png', 'assets/aliens.json');

// create — Aseprite 태그마다 태그 이름으로 애니메이션 하나
this.anims.createFromAseprite('aliens');
this.add.sprite(300, 100, 'aliens').setScale(3).play({ key: 'pink-walk', repeat: -1 });
```

Aseprite 1.3.18로 저장한 파일로 확인한 내용입니다.

- 태그마다 태그 이름(대소문자 구분)으로 애니메이션이 하나씩 생깁니다. 태그 이름 배열을 넘기면 그 태그만 만듭니다.
- 프레임별 시간이 유지됩니다. 200ms와 100ms로 지정한 프레임이 실제로 200ms, 100ms 동안 보였습니다.
- **ping-pong** 태그는 `yoyo: true`가 되고, reverse 태그는 순서가 뒤집힙니다.
- 애니메이션은 **한 번만 재생됩니다.** `createFromAseprite`가 `repeat`를 설정하지 않으므로 `play('pink-walk')`는 한 바퀴 돌고 멈춥니다. 반복하려면 위처럼 재생할 때 `repeat: -1`을 넘깁니다.

`.aseprite` 파일을 다른 엔진으로 가져가는 방법은 [Aseprite 파일을 Godot·Unity·Phaser로](guide:aseprite-files-godot-unity-phaser)에서 다룹니다.

## 프레임별 시간은 frameRate를 대체합니다 {#frame-durations}

프레임마다 밀리초 단위의 `duration`을 줄 수 있습니다. 예: `frames: [{ key: 'chars', frame: 0, duration: 300 }, { key: 'chars', frame: 1 }]`. Phaser 애니메이션 문서에는 이 값이 `frameRate`로 정해지는 프레임 시간에 *더해진다*고 적혀 있습니다. 하지만 3.90.0과 4.2.1에서는 그렇게 동작하지 않았습니다. `frameRate: 10`(100ms)일 때 `duration: 300`인 프레임은 **400ms가 아니라 300ms** 동안 보였고, duration이 없는 프레임은 100ms였습니다. 두 버전 모두 같은 코드(`currentFrame.duration || msPerFrame`)를 씁니다. 예외가 하나 있습니다. `play({ key, frameRate })`로 `frameRate`를 덮어쓰면 프레임별 시간은 모두 무시됩니다. `frameRate: 20`으로 재생하자 두 프레임 모두 50ms였습니다.

## 애니메이션 정의를 JSON으로 {#anims-json}

`this.anims.toJSON()`은 전역 애니메이션을 `{ anims: [...], globalTimeScale }` 형태로 내보내고, `this.anims.fromJSON(data)`는 그것으로 애니메이션을 다시 만듭니다. 애니메이션 목록을 코드가 아니라 아트 도구 쪽에서 관리할 수 있습니다.

```js
// preload
this.load.json('anims', 'assets/anims.json');
// create — JSON이 가리키는 텍스처가 먼저 로드되어 있어야 함
this.anims.fromJSON(this.cache.json.get('anims'));
```

각 항목의 필드는 `anims.create`에 넘기는 객체와 같습니다. 애니메이션은 전역이므로 씬마다 만들지 말고 한 번만 만듭니다.

## 픽셀 아트와 Phaser 4의 차이 {#phaser-4}

스프라이트 시트와 애니메이션 API는 Phaser 4에서 바뀐 것이 없습니다. 이 문서의 호출은 3.90과 4.2에서 모두 같습니다. 차이는 렌더링 쪽에 있습니다.

- **`pixelArt: true`**의 효과는 두 버전이 같습니다. `antialias`와 `antialiasGL`이 false가 되고 `roundPixels`가 true가 됩니다(두 버전 모두 `game.config`에서 읽어 확인했습니다). `pixelArt`를 켜지 않으면 `roundPixels`의 기본값은 false입니다.
- **Phaser 4는 안전할 때만 반올림합니다.** 기본값(`vertexRoundMode`의 `"safeAuto"`)에서는 크기 조절이나 회전이 없는 오브젝트를, `roundPixels`가 켜진 카메라로 그릴 때만 위치를 반올림합니다. 확대한 스프라이트도 nearest 필터링은 그대로라 선명하지만, 위치는 정수로 맞춰지지 않습니다.
- **`smoothPixelArt: true`**(Phaser 4 신규)는 텍셀을 네모나게 유지하면서 경계만 부드럽게 처리합니다. 정수가 아닌 배율로 확대하거나 회전하는 도트 그래픽용이며, 켜면 `pixelArt`가 꺼집니다.
- **`this.load.atlasPCT`**(Phaser 4 신규)는 Phaser Compact Texture 아틀라스를 불러옵니다. JSON보다 훨씬 작은 줄 단위 텍스트 형식이며, 기존 JSON 아틀라스도 계속 쓸 수 있습니다.
- Phaser 4에서 Canvas 렌더러는 지원 중단(deprecated) 예정입니다. WebGL을 쓰세요(`Phaser.AUTO`가 WebGL을 고릅니다).
- trim된 Starling/Sparrow XML 아틀라스(`load.atlasXML`)는 Phaser 3.90에서 위치가 틀어집니다. Phaser 4.0에서 고쳐졌습니다. Phaser 3에서는 JSON이나 trim하지 않은 XML을 쓰세요.

프레임과 무관한 흐림(캔버스의 CSS 확대, 정수가 아닌 줌, 카메라 이동 등)은 [브라우저에서 픽셀 아트를 선명하게: Phaser·PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi)에서 다룹니다.

## 자주 생기는 문제 {#troubleshooting}

- **마지막 열이나 행이 빠집니다:** 이미지 크기가 정확히 `margin + n × frameWidth + (n − 1) × spacing`이 아닙니다. 크기를 확인하거나 칸을 고르게 해서 다시 내보내세요.
- **재생되는 프레임이 모자랍니다:** 콘솔의 "Frame … not found" 경고를 확인하세요. 만들어진 이름이 아틀라스 키와 다릅니다.
- **흐리거나 움직일 때 반짝거립니다:** `pixelArt: true`를 켜고 스프라이트 배율과 카메라 줌을 정수로 유지하세요.
- **가장자리에 옆 프레임의 선이 보입니다:** 1–2px의 패딩이나 익스트루드(extrude)를 넣어 패킹하세요. 원인은 [타일 이음매와 텍스처 번짐](guide:tile-seams-texture-bleeding-padding-extrude)에서 설명합니다.

:::nerulio ws=sprite
에셋 쪽 작업은 Nerulio 스튜디오가 브라우저 안에서 처리하며, 파일은 기기 밖으로 나가지 않습니다. 시트나 프레임 폴더를 Sprite 작업 공간에 끌어다 놓으면 margin과 spacing을 포함한 격자를 감지하고, 신뢰도와 함께 다른 후보도 보여 줍니다. 타임라인에서 애니메이션 태그를 붙이고 프레임별 시간을 정하면, Pack & Export가 Phaser용 파일을 만듭니다. 이 파일은 Nerulio의 엔진 테스트에서 Phaser 3.90과 4.2가 불러와 그려 확인했습니다.

- **Sprite** 탭: PNG를 끌어다 놓고, 감지된 격자를 확인하고 **Apply**를 누른 뒤, 태그 레인을 드래그해 애니메이션마다 이름을 붙입니다.
- **Pack & Export** 탭: **Phaser 3 / 4**를 고릅니다. 아틀라스 JSON(hash, 페이지가 여럿이면 multiatlas)과 `this.anims.fromJSON`용 `<이름>.anims.json`이 나옵니다. 시간은 프레임별 ms, ping-pong은 `yoyo`, 반복은 `repeat: -1`로 들어갑니다. 이 프리셋은 프레임을 회전하지 않습니다.
- `load.aseprite`를 쓰고 싶다면 **Aseprite JSON**(hash 또는 array)으로 내보내세요. `createFromAseprite`에 필요한 `"0"`, `"1"`… 키를 씁니다.
:::

![엔진별 내보내기 목록과 내보내기 버튼 아래의 검증 문구가 보이는 Nerulio Pack & Export](shot:studio-pack-export "Nerulio 스튜디오의 Pack & Export: 엔진마다 내보내기 버튼이 있고, 불러와 확인한 엔진 버전이 함께 표시됩니다.")

## 자주 묻는 질문 {#faq}

### Phaser에서 load.spritesheet와 load.atlas는 무엇이 다른가요? {#faq-spritesheet-vs-atlas}

`load.spritesheet`는 이미지 한 장을 `frameWidth`, `frameHeight`, `margin`, `spacing`에 따라 같은 크기의 칸으로 자르고 0부터 번호를 붙입니다. `load.atlas`는 JSON 파일에서 프레임마다 사각형을 읽으므로 프레임 크기가 달라도 되고, trim되어 있어도 되고, 이름을 가질 수 있습니다. 앞의 것은 `generateFrameNumbers`, 뒤의 것은 `generateFrameNames`와 함께 씁니다.

### Phaser 스프라이트 시트 애니메이션에 옆 프레임 일부가 보이는 이유는? {#faq-neighbour-frame}

격자 설정이 이미지와 맞지 않기 때문입니다. 대개 칸 사이에 간격이 있는데 `spacing`을 빠뜨려서 프레임마다 1px씩 더 어긋납니다. `margin`이 빠졌거나 `frameWidth`가 1px 틀린 경우도 있습니다. `frameTotal`이 열 × 행 + 1인지 확인하세요.

### Phaser 4에서 스프라이트 시트와 애니메이션 사용법이 바뀌었나요? {#faq-phaser-4}

아닙니다. `load.spritesheet`, `load.atlas`, `load.multiatlas`, `load.aseprite`, `anims.create`, `generateFrameNumbers`, `generateFrameNames`, `createFromAseprite`, `fromJSON`은 3.90과 4.2에서 수정 없이 동작했습니다. Phaser 4에는 `smoothPixelArt`, 작은 PCT 아틀라스 형식(`load.atlasPCT`), 더 안전한 픽셀 반올림이 추가되었습니다.

### Phaser에서 Aseprite 애니메이션을 반복 재생하려면? {#faq-aseprite-loop}

`createFromAseprite`는 `repeat` 값 없이 애니메이션을 만들기 때문에 한 번만 재생됩니다. 재생할 때 `sprite.play({ key: 'walk', repeat: -1 })`처럼 넘기거나, 만든 뒤에 `this.anims.get('walk').repeat = -1`로 바꿉니다.

### Phaser에서 특정 프레임만 더 오래 보이게 하려면? {#faq-frame-duration}

`frames` 배열에서 그 프레임에 밀리초 단위의 `duration`을 줍니다. 그 프레임에서만 `frameRate`로 정해진 시간을 대체합니다(3.90과 4.2에서 측정). 이때 `play()`에 `frameRate`를 넘기지 마세요. 넘기면 프레임별 시간이 무시됩니다.

## 참고 자료 {#sources}

- [Phaser 문서: Loader(spritesheet, atlas, multiatlas)](https://docs.phaser.io/phaser/concepts/loader) — Phaser 4.1 문서, v3.90 버전 전환 가능
- [Phaser 문서: Animations(AnimationManager, generateFrameNumbers, createFromAseprite)](https://docs.phaser.io/phaser/concepts/animations) — Phaser 4.1 문서
- [Phaser v3 to v4 Migration Guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md) — round pixels, Canvas 렌더러 지원 중단
- [Phaser 4 Pixel Art Guide](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md) — `pixelArt`, `smoothPixelArt`, `vertexRoundMode`
- [Phaser 4.0.0 변경 기록](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md) — PCT 아틀라스, AtlasXML trim 수정
- [Aseprite 문서: 스프라이트 시트 내보내기](https://www.aseprite.org/docs/sprite-sheet/), [명령줄 인터페이스](https://www.aseprite.org/docs/cli/) — Aseprite 1.3
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — 테스트에 쓴 CC0 그림
