PixiJS 8에서는 스프라이트시트 JSON을 `await Assets.load('hero.json')`에 넘겨 불러옵니다. 그러면 `meta.image`에 적힌 이미지까지 불러와 `Spritesheet`를 돌려줍니다. `sheet.textures`에는 프레임마다 텍스처가 하나씩, `sheet.animations`에는 JSON의 `animations` 항목마다 텍스처 배열이 하나씩 들어 있습니다. 그 배열을 `new AnimatedSprite(...)`에 넘기고, `animationSpeed`(60Hz 틱당 프레임 수이므로 초당 6프레임이면 `6 / 60`)를 정한 뒤 `play()`를 호출합니다. 도트 그래픽이라면 무엇이든 불러오기 전에 `TextureSource.defaultOptions.scaleMode = 'nearest'`를 설정합니다.

아래 코드는 모두 PixiJS 8.21.0(WebGL 렌더러, Chromium)에서 실행했고, 본문의 측정값도 그 실행에서 나온 것입니다.

## PixiJS가 읽는 스프라이트시트 JSON {#json-format}

PixiJS 8은 TexturePacker의 "JSON hash" 형식을 읽습니다. `frames`는 프레임 이름을 키로 하는 객체입니다. 애니메이션에 중요한 선택 필드도 몇 가지 읽습니다.

```json
{
  "frames": {
    "green_walk_0": {
      "frame": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "sourceSize": { "w": 24, "h": 24 },
      "anchor": { "x": 0.5, "y": 1 }
    },
    "green_walk_1": { "frame": { "x": 25, "y": 0, "w": 24, "h": 24 }, "anchor": { "x": 0.5, "y": 1 } }
  },
  "animations": {
    "green_walk": ["green_walk_0", "green_walk_1"]
  },
  "meta": { "image": "hero.png", "size": { "w": 224, "h": 74 }, "scale": "1" }
}
```

| 필드 | PixiJS가 하는 일 |
|---|---|
| `frames[name].frame` | 페이지 위의 사각형입니다. `rotated` 프레임이면 PixiJS가 너비와 높이를 알아서 바꿉니다 |
| `spriteSourceSize`, `sourceSize` | trim된 프레임을 원래 크기의 상자 안 제자리에 돌려놓습니다 |
| `anchor` | `texture.defaultAnchor`가 되고, 그 텍스처로 만든 Sprite는 이 값에서 시작합니다 |
| `animations` | 이름 → 재생 순서대로 나열한 프레임 이름. `sheet.animations`가 됩니다 |
| `meta.scale` | 텍스처 해상도를 정합니다. `"2"`는 @2x 이미지라는 뜻입니다(아래 참고) |
| `meta.related_multi_packs` | 같은 아틀라스의 다른 JSON 파일들. 자동으로 함께 불러옵니다 |

범용 JSON 내보내기 도구는 대부분 `animations`를 넣지 않습니다. 이 항목이 없으면 `sheet.animations`가 비어 있으므로 프레임 목록을 직접 만들어야 합니다. PixiJS API 문서에도 기본 앵커, 9-슬라이스 테두리, 애니메이션 묶음은 "현재 TexturePacker만 지원한다"고 적혀 있습니다. 아래에서 소개하는 Nerulio의 PixiJS 내보내기도 이 셋을 모두 씁니다. Aseprite JSON은 프레임 모음으로는 문제없이 불러와지지만, PixiJS가 Aseprite의 `frameTags`를 애니메이션으로 바꿔 주지는 않습니다.

## 스프라이트시트를 불러와 애니메이션 재생하기 {#load-and-play}

:::steps
1. **animations가 포함된 JSON hash로 내보냅니다.** PNG와 JSON을 같은 폴더에 둡니다. `meta.image`는 JSON 파일 기준의 상대 경로로 해석됩니다.
2. **기본 필터를 nearest로 바꿉니다(도트 그래픽일 때).** 첫 `Assets.load`보다 먼저 `TextureSource.defaultOptions.scaleMode = 'nearest'`를 설정합니다. 이 설정은 실행된 뒤에 만들어지는 텍스처에만 적용됩니다.
3. **애플리케이션을 만듭니다.** `const app = new Application(); await app.init({ width, height, roundPixels: true });`를 실행하고 `app.canvas`를 페이지에 붙입니다. v8에서는 `init`이 비동기이고, `app.view` 대신 `app.canvas`를 씁니다.
4. **JSON을 불러옵니다.** `const sheet = await Assets.load('assets/hero.json')`. 이미지를 가져오고 프레임을 해석해 `Spritesheet`를 돌려줍니다.
5. **AnimatedSprite를 만듭니다.** `const walk = new AnimatedSprite(sheet.animations.green_walk)`. 초당 6프레임이면 `walk.animationSpeed = 6 / 60`으로 하고 `walk.play()`를 호출합니다. `autoPlay`의 기본값은 false라서 `play()`를 부르지 않으면 첫 프레임만 보입니다.
6. **배치하고 스테이지에 추가합니다.** 배율은 정수로(`walk.scale.set(3)`) 주고 위치를 정합니다. 앵커는 이미 JSON에서 들어와 있습니다. JSON에 앵커가 없으면 왼쪽 위 모서리(0, 0)가 기준입니다.
:::

```js
// main.js — PixiJS 8
import { Application, Assets, AnimatedSprite, TextureSource } from 'pixi.js';

// 도트 그래픽: 이후 만들어지는 모든 텍스처 소스를 'nearest'로 샘플링
TextureSource.defaultOptions.scaleMode = 'nearest';

const app = new Application();
await app.init({ width: 720, height: 290, background: '#1b2030', roundPixels: true });
document.body.appendChild(app.canvas);

const sheet = await Assets.load('assets/hero.json'); // hero.png까지 불러와 해석
const walk = new AnimatedSprite(sheet.animations.green_walk);
walk.animationSpeed = 6 / 60; // 60틱 기준 초당 6프레임
walk.scale.set(3);
walk.position.set(50, 110);
walk.play();
app.stage.addChild(walk);
```

![PixiJS 테스트 화면: 스프라이트시트로 만든 애니메이션, meta.scale이 맞는 @2x 시트와 틀린 @2x 시트, linear와 nearest로 그린 같은 프레임](shot:engine-pixi-spritesheet "PixiJS 8.21.0(WebGL)으로 그린 화면입니다. 위: JSON의 앵커로 발밑을 맞춘 AnimatedSprite, meta.scale이 2인 @2x 시트(같은 크기)와 1인 시트(두 배 크기). 아래: 'linear'와 'nearest'. 그림: Kenney, CC0.")

## 속도, 반복, 프레임별 시간 {#playback}

- **`animationSpeed`**는 60Hz 틱 한 번에 넘어가는 프레임 수이고, 티커의 `deltaTime`으로 보정됩니다. 그래서 모니터 주사율과 상관없이 초당 프레임 수는 `animationSpeed × 60`입니다. 테스트에서 `6 / 60`으로 두자 평균 166.6ms마다 프레임이 바뀌었습니다.
- **한 번만 재생하는 애니메이션:** `new AnimatedSprite({ textures, animationSpeed: 0.1, loop: false, autoPlay: true, onComplete: () => … })`. 옵션 객체에는 Sprite의 옵션(`anchor`, `position`…)도 모두 넣을 수 있습니다. 테스트에서 `onComplete`는 정확히 한 번 호출되었고, 스프라이트는 마지막 프레임에 멈춘 채 `playing === false`가 되었습니다.
- **그 밖의 훅:** `onFrameChange(frame)`은 텍스처가 바뀔 때마다, `onLoop()`는 반복 애니메이션이 처음으로 돌아갈 때 호출됩니다. `gotoAndStop(n)`, `gotoAndPlay(n)`으로 `n`번 프레임으로 이동하고, `animationSpeed`를 음수로 주면 거꾸로 재생합니다.
- **프레임별 시간:** 텍스처 대신 `{ texture, time }` 객체를 넘깁니다. `time`의 단위는 **밀리초**입니다. 테스트에서 `[{ texture: a, time: 300 }, { texture: b, time: 100 }]`은 각각 300ms, 100ms 동안 보였습니다. 이 시간에도 `animationSpeed`가 곱해지므로 실제 시간대로 재생하려면 1로 둡니다.

```js
// 첫 프레임을 더 오래 보여 주기: 시간은 밀리초
const hit = new AnimatedSprite([
  { texture: sheet.textures.blue_walk_0, time: 300 },
  { texture: sheet.textures.blue_walk_1, time: 100 }
]);
hit.play();
```

Aseprite JSON에서 온 시간을 쓰려면 `sheet.data.frames[name].duration`에 남아 있는 각 프레임의 `duration`으로 `{ texture, time }` 목록을 만듭니다.

## 도트 그래픽: v8의 scaleMode 'nearest' {#pixel-art}

PixiJS 텍스처는 기본이 `'linear'` 필터링이라서 확대하는 순간 도트가 흐려집니다(위 그림 왼쪽 아래). v7의 이름은 v8에서 모두 사라졌습니다. `SCALE_MODES.NEAREST`는 문자열 `'nearest'`가 되었고, `BaseTexture`도 더 이상 없습니다. 설정하는 방법은 세 가지입니다.

- **전체에 적용:** 불러오기 전에 `TextureSource.defaultOptions.scaleMode = 'nearest'`.
- **에셋 하나에만 적용:** `await Assets.load({ src: 'assets/hero.json', data: { textureOptions: { scaleMode: 'nearest' } } })`. 스프라이트시트 로더가 `textureOptions`를 이미지에 그대로 넘깁니다. 테스트에서 이 방법은 해당 에셋에 한해 전역 기본값보다 우선했습니다.
- **불러온 뒤에 적용:** `sheet.textureSource.scaleMode = 'nearest'`, 텍스처 하나라면 `texture.source.scaleMode`. 한 시트의 프레임은 모두 같은 소스를 공유합니다.

`app.init`에 `roundPixels: true`도 넘겨 스프라이트를 정수 픽셀 위치에 그리게 하고, 배율은 정수로 줍니다. CSS 확대나 `devicePixelRatio`처럼 브라우저 쪽에서 생기는 흐림은 [브라우저에서 픽셀 아트를 선명하게: Phaser·PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi)에서 다룹니다.

## @2x 시트와 meta.scale {#resolution}

v8에서는 `meta.scale`이 시트 텍스처 소스의 해상도를 직접 정합니다. JSON에 `"scale": "2"`라고 적힌 @2x 시트는 이미지의 48×48픽셀을 24×24 텍스처로 만듭니다. 그래서 @1x 시트와 같은 크기로, 더 세밀하게 그려집니다. 같은 이미지에 `"scale": "1"`을 적었더니 텍스처가 48×48이 되어 모든 스프라이트가 **두 배 크기로** 그려졌습니다(위 그림 오른쪽 위). v8로 올린 뒤 HD 아틀라스가 갑자기 두 배로 커 보인다면 가장 먼저 `meta.scale`을 확인하세요. 파일 이름에 `@2x`가 있어도 `meta.scale`이 우선합니다.

기기에 맞는 버전을 PixiJS가 고르게 하려면 파일 이름을 `hero@1x.json`, `hero@2x.json`으로 하고 해상도 패턴을 씁니다.

```js
await Assets.init({ texturePreference: { resolution: Math.min(2, window.devicePixelRatio) } });
Assets.add({ alias: 'hero', src: 'assets/hero@{1,2}x.json' });
const sheet = await Assets.load('hero'); // 2x 화면에서는 hero@2x.json
```

`Assets.init`은 첫 `Assets.load`보다 먼저 실행해야 합니다. 테스트에서 선호 해상도를 2로 두자 `hero@2x.json`을 불러왔고, 텍스처 크기는 여전히 24×24였습니다.

## 여러 페이지로 나뉜 시트 {#multipack}

아틀라스가 여러 페이지로 나뉘면 페이지마다 JSON이 따로 있고, `meta.related_multi_packs`에 나머지 JSON 파일이 적힙니다. 첫 번째 파일을 불러오면 나머지도 함께 불러오고(`sheet.linkedSheets`), 모든 프레임 이름이 텍스처 캐시에 등록됩니다. 다만 함정이 있습니다. **`sheet.animations`는 자기 페이지에 있는 프레임만 찾습니다.** 0번 페이지에 적힌 애니메이션이 1번 페이지의 프레임을 쓰면 `undefined`로 가득 찬 배열이 나왔습니다. 이런 애니메이션은 불러오기가 끝난 뒤 캐시에서 직접 만듭니다.

```js
const sheet = await Assets.load('assets/pack-0.json'); // pack-1.json도 함께 불러옴
const robot = new AnimatedSprite(['robot_walk_0', 'robot_walk_1', 'robot_walk_2'].map(n => Texture.from(n)));
```

v8의 `Texture.from(name)`은 캐시만 읽습니다. 시트를 다 불러오기 전에는 `Texture.EMPTY`를 돌려주므로 `await Assets.load` 뒤에 호출하세요.

## 앵커와 피벗 {#anchor}

JSON에 적힌 프레임의 `anchor`는 `texture.defaultAnchor`가 됩니다. `new Sprite(texture)`와 `new AnimatedSprite(textures)`는 첫 텍스처에서 이 값을 가져옵니다. 테스트에서 JSON 앵커를 `{ "x": 0.5, "y": 1 }`로 두자 모든 캐릭터의 발밑이 지정한 위치에 놓였습니다. 프레임마다 피벗이 다르다면(칼 휘두르기, 웅크리기 등) `updateAnchor: true`를 넘겨 프레임이 바뀔 때마다 앵커를 다시 가져오게 합니다. 직접 지정한 `anchor`는 JSON 값보다 우선하지만, `updateAnchor`를 켜 두었다면 다음 프레임 전환 때 다시 덮어써집니다. 피벗을 발이나 허리에 두는 이유는 [2D 애니메이션의 히트박스와 피벗](guide:hitboxes-pivots-2d-animation)에서 설명합니다.

## 자주 생기는 문제 {#troubleshooting}

- **아무것도 안 보이거나 `Texture.EMPTY`가 나옵니다:** `await Assets.load`가 끝나기 전에 텍스처를 만들었거나 프레임 이름이 틀렸습니다. v8의 `Texture.from`은 더 이상 URL을 불러오지 않습니다.
- **첫 프레임만 보입니다:** `play()`를 호출하거나 `autoPlay: true`를 넘기세요.
- **애니메이션이 너무 빠릅니다:** `animationSpeed`는 초당 프레임 수가 아닙니다. `fps / 60`을 쓰세요. FrameObject의 `time`은 초가 아니라 밀리초입니다.
- **HD 스프라이트가 두 배로 커집니다:** `meta.scale`이 이미지와 맞지 않습니다.
- **도트가 흐리거나 반짝거립니다:** 불러오기 전에 `'nearest'`를 설정하고, `roundPixels: true`와 정수 배율을 쓰세요.
- **프레임 가장자리에 옆 그림의 선이 번집니다:** 1–2px의 패딩이나 익스트루드를 넣어 패킹하세요([원인 설명](guide:tile-seams-texture-bleeding-padding-extrude)).

:::nerulio ws=sprite
Nerulio 스튜디오는 PixiJS용 스프라이트시트를 브라우저 안에서 만들고, 파일은 어디에도 업로드되지 않습니다. Sprite 작업 공간에 시트, 낱장 프레임, GIF, `.aseprite` 파일을 가져오면 격자를 감지해 신뢰도와 다른 후보를 함께 보여 줍니다. 그다음 애니메이션 태그를 붙이고, 프레임별 시간을 정하고, 프레임마다 피벗을 찍습니다. Pack & Export가 쓰는 JSON은 Nerulio의 엔진 테스트에서 PixiJS 8.21이 불러와 그려 확인했습니다. 회전 저장 프레임과 여러 페이지 시트도 포함한 결과입니다.

- **Sprite** 탭: 파일을 끌어다 놓고, 감지된 격자를 확인한 뒤 **Apply**를 누릅니다. 태그 레인에서 애니메이션 이름을 붙이고 **P**로 피벗을 찍습니다.
- **Pack & Export** 탭: **PixiJS 8**을 고릅니다. 재생 순서대로 적힌 `animations`, 피벗에서 가져온 `anchor`, 여러 페이지일 때의 `related_multi_packs`, @2x·@0.5x 버전마다 맞춘 `meta.scale`이 들어간 스프라이트시트 JSON이 나옵니다.
- 프레임별 시간(ms)은 `meta.nerulio.animations`에 있어 `{ texture, time }` 프레임을 바로 만들 수 있습니다. 함께 들어 있는 README에 그 세 줄짜리 코드가 있습니다.
:::

![시트를 끌어다 놓은 직후의 Nerulio Sprite 작업 공간: 감지한 격자와 신뢰도, 잘라 낸 프레임](shot:studio-sprite-import "Nerulio의 Sprite 작업 공간은 자르기 전에 격자를 신뢰도와 함께 제안합니다.")

## 자주 묻는 질문 {#faq}

### PixiJS 8에서 스프라이트시트 애니메이션을 재생하려면? {#faq-play-animation}

`const sheet = await Assets.load('hero.json')`로 JSON을 불러오고 `const anim = new AnimatedSprite(sheet.animations.walk)`를 만듭니다. `anim.animationSpeed = fps / 60`으로 정하고 `anim.play()`를 호출한 뒤 스테이지에 추가합니다. JSON에 `animations`가 없으면 `sheet.textures`에서 텍스처 배열을 직접 만듭니다.

### PixiJS에서 도트 그래픽이 흐려지는 이유는? {#faq-blurry}

텍스처의 기본 필터링이 `'linear'`이기 때문입니다. 불러오기 전에 `TextureSource.defaultOptions.scaleMode = 'nearest'`를, 불러온 뒤라면 `sheet.textureSource.scaleMode = 'nearest'`를 설정하고, `roundPixels: true`와 정수 배율을 씁니다. v7의 `SCALE_MODES.NEAREST`는 v8에 없습니다.

### PixiJS 8에서 @2x 스프라이트시트가 두 배 크기로 나오는 이유는? {#faq-2x-double-size}

PixiJS 8은 텍스처 해상도를 `meta.scale`에서 가져옵니다. @2x 이미지인데 JSON에 `"scale": "1"`이 적혀 있으면 1x로 취급해 모든 프레임이 두 배 크기가 됩니다. 그 JSON에 `"scale": "2"`를 적으세요.

### PixiJS에서 프레임마다 시간을 다르게 주려면? {#faq-frame-duration}

텍스처 대신 객체를 넘깁니다: `new AnimatedSprite([{ texture, time: 300 }, { texture: next, time: 100 }])`. `time`은 밀리초이고, 여기에도 `animationSpeed`가 곱해집니다.

### 여러 페이지 스프라이트시트의 애니메이션이 undefined가 되는 이유는? {#faq-multipack-undefined}

`sheet.animations`는 자기 페이지의 프레임만 찾습니다. 다른 페이지의 프레임은 텍스처 캐시에 있으므로, `await Assets.load` 뒤에 `names.map(n => Texture.from(n))`으로 애니메이션을 만들거나 애니메이션 하나를 한 페이지에 모아 두세요.

## 참고 자료 {#sources}

- [PixiJS API: Spritesheet](https://pixijs.download/release/docs/assets.Spritesheet.html) — JSON 형식, `animations`, 앵커, TexturePacker 관련 설명(v8 릴리스 문서)
- [PixiJS API: AnimatedSprite](https://pixijs.download/release/docs/scene.AnimatedSprite.html) — `animationSpeed`, `loop`, `onComplete`, `updateAnchor`, FrameObject
- [PixiJS 가이드: Assets](https://pixijs.com/8.x/guides/components/assets), [Resolver](https://pixijs.com/8.x/guides/components/assets/resolver) — `Assets.load`, `Assets.init`, 해상도 패턴(8.x)
- [PixiJS 가이드: Textures](https://pixijs.com/8.x/guides/components/textures) — `TextureSource`, `scaleMode`(8.x)
- [PixiJS v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8) — `SCALE_MODES.NEAREST` → `'nearest'`, 비동기 `app.init`, `app.canvas`
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — 테스트에 쓴 CC0 그림
