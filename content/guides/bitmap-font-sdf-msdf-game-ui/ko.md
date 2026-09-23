텍스트를 정해진 한 가지 크기로만 그린다면 **비트맵 폰트**(BMFont `.fnt` + PNG)가 가장 정확하고, 도트(픽셀) 폰트는 항상 비트맵 방식으로 디자인 크기의 정수배에서 안티에일리어싱 없이, 최근접(nearest) 필터로 그려야 합니다. 같은 텍스트를 확대·축소하거나 외곽선·글로우를 싸게 넣어야 하면 **SDF**, 큰 크기에서도 모서리가 날카로워야 하면 **MSDF**를 씁니다. Godot 4.7에서는 임포트 옵션 *Multichannel Signed Distance Field*, Unity 6 폰트 에셋은 기본이 SDF, PixiJS 8은 `distanceField` 항목이 있는 BMFont 파일로 SDF/MSDF를 읽습니다. Phaser의 BitmapText는 일반 비트맵만 지원합니다.

아래 이미지는 모두 캡션에 적힌 엔진이 실제로 렌더링한 결과입니다.

![Godot 4.7.2에서 같은 UI 텍스트를 다섯 가지 방식으로 그린 결과](shot:engine-godot-font-modes "Godot 4.7.2(Compatibility 렌더러) 렌더링. A: 안티에일리어싱·힌팅·서브픽셀을 끈 도트 폰트, 16px을 3배. B: 같은 폰트를 기본 임포트로 20px: 픽셀 크기가 들쭉날쭉합니다. C: 일반 래스터 폰트 6배: 흐릿함. D: 12px로 구운 BMFont를 최근접 6배: 계단 현상. E: 같은 TTF에 MSDF: 6배에서도 선명하고 2px 외곽선. 폰트: Kenney Pixel, Kenney Future(CC0).")

## 비트맵·SDF·MSDF 폰트의 원리 {#how-they-work}

세 방식 모두 글리프를 텍스처 아틀라스에서 가져와 그립니다. 차이는 텍셀 하나에 무엇을 저장하느냐입니다.

| 방식 | 텍셀에 저장하는 값 | 확대했을 때 | 외곽선·글로우·그림자 | 텍스처 비용 |
|---|---|---|---|---|
| 비트맵 | 한 크기에서의 커버리지 | 흐릿함(linear) 또는 계단(nearest) | 이미지에 구워 넣음 | 크기·스타일마다 아틀라스 하나 |
| SDF | 외곽선까지의 거리, 1채널 | 매끄럽지만 모서리가 둥글어짐 | 셰이더에서 무료 | 모든 크기에 아틀라스 하나, 셀 여백 필요 |
| MSDF | R·G·B 세 거리, 중앙값이 외곽선 | 매끄럽고 모서리도 날카로움 | 셰이더에서 무료 | SDF와 같고 3채널 |

비트맵 글리프는 완성된 픽셀이라 구운 크기에서만 정확합니다. 부호 있는 거리장(signed distance field)은 각 텍셀이 외곽선에서 얼마나 떨어져 있는지를 저장하고, 셰이더가 거리가 0이 되는 지점에서 외곽선을 다시 만들기 때문에 어떤 배율에서도 매끄럽습니다. 다만 채널이 하나뿐이면 모서리 주변의 거리장이 둥글어서 확대하면 모서리가 뭉개집니다. MSDF는 외곽선을 세 채널에 나눠 담고 중앙값을 취해 모서리를 유지합니다.

![PixiJS 8.21에서 비트맵·SDF·MSDF 폰트 비교](shot:engine-pixi-sdf-msdf "Chromium의 PixiJS 8.21.0(WebGL) 렌더링. 12px로 구운 비트맵 폰트는 12px에서는 괜찮지만 72px에서 흐릿합니다. msdf-atlas-gen 1.4로 32px에 만든 SDF·MSDF 아틀라스는 72px에서도 매끄럽습니다. 아래: Kenney Pixel 240px. SDF는 사각 모서리가 둥글어지고 MSDF는 유지됩니다. 폰트: Kenney Future, Kenney Pixel(CC0).")

## 선명한 UI 텍스트 설정 순서 {#set-up}

:::steps
1. **크기를 정리합니다.** 텍스트 스타일마다 화면에서의 최소·최대 픽셀 크기, UI나 카메라가 확대·축소되는지, 필요한 효과를 적습니다. 크기 하나에 효과가 없으면 비트맵, 줌·스케일 트윈·큰 타이틀이 있으면 SDF나 MSDF입니다.
2. **형식을 고릅니다.** 도트 폰트는 비트맵 또는 안티에일리어싱을 끈 다이내믹 폰트, 몇 가지 고정 크기의 본문은 비트맵이나 엔진의 다이내믹 폰트, 크기가 바뀌고 외곽선이 필요한 텍스트는 SDF, 큰 타이틀과 모서리가 각진 폰트는 MSDF입니다.
3. **실제로 쓰는 글자만 굽습니다.** 런타임에 들어가는 숫자와 이름을 위해 ASCII는 넣어 둡니다. 한국어·일본어·중국어는 [CJK 폰트 아틀라스 만들기](guide:cjk-font-atlas-localization)를 참고하세요.
4. **알맞은 설정으로 임포트합니다.** Godot은 폰트를 선택해 아래 Import 독 옵션을 바꾸고 **Reimport**를 누릅니다. Unity는 **Window > TextMesh Pro > Font Asset Creator**에서 고른 Render Mode로 폰트 에셋을 만듭니다.
5. **아틀라스가 기대하는 크기로 그립니다.** 비트맵 폰트는 구운 크기나 그 정수배로, 도트 폰트는 최근접 필터로 그립니다. SDF·MSDF는 어떤 크기든 괜찮습니다.
6. **외곽선과 그림자는 렌더러에서 넣습니다.** SDF/MSDF 텍스트는 엔진 설정으로 처리하고, 이미지에 굽는 것은 비트맵 폰트일 때만입니다.
7. **실제 해상도에서 확인합니다.** 125%, 150% 디스플레이 배율도 확인하세요. 16px에서 선명한 도트 폰트도 20px에서는 들쭉날쭉해집니다.
:::

## 도트 폰트: 정수 크기, 안티에일리어싱 끄기 {#pixel-fonts}

도트 폰트는 폰트 단위의 격자 위에 그려져 있어서, 격자 한 칸이 화면 픽셀 하나에 정확히 떨어질 때만 선명합니다. Kenney Pixel은 16px 격자로 디자인되어 16, 32, 48px에서는 선명하고 20px에서는 그렇지 않습니다(위 B행: 어떤 픽셀은 화면 픽셀 1개, 어떤 픽셀은 2개). Godot 문서도 같은 규칙을 적고 있습니다. 폰트 크기는 디자인 크기의 정수배여야 하고, Control도 정수배로 스케일해야 합니다.

Godot 4.7에서는 `.ttf`를 선택하고 **Import** 독에서 다음처럼 설정합니다.

- **Antialiasing:** None(선택지는 None, Grayscale, LCD Subpixel이고 기본값은 Grayscale).
- **Hinting:** None. **Subpixel Positioning:** Disabled.
- **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter:** Nearest(또는 해당 Control의 **Texture Filter**를 Nearest).

Godot 4.7의 기본값이 일부는 알아서 처리합니다. **Hinting** 기본값은 *Light (Except Pixel Fonts)*, **Subpixel Positioning** 기본값은 *Auto (Except Pixel Fonts)*이고, 저희 테스트에서 Kenney Pixel은 두 옵션 모두 자동으로 꺼졌습니다. 하지만 **Antialiasing은 Grayscale 그대로**였으므로 직접 None으로 바꿔야 합니다. 프로젝트 기본 폰트에도 **Project Settings > GUI > Theme**에 같은 옵션(`gui/theme/default_font_antialiasing` 등)이 있습니다.

Unity에서는 안티에일리어싱이 없는 Render Mode(**RASTER** 또는 **RASTER_HINTED**)와 **Sampling Point Size** = 디자인 크기로 정적 TextMesh Pro 폰트 에셋을 만듭니다. 카메라·캔버스 스케일은 [Unity 픽셀 아트 흐림 해결](guide:unity-pixel-art-blurry-pixel-perfect)에서 다룹니다. Phaser와 PixiJS의 최근접 필터는 [Phaser·PixiJS에서 도트를 선명하게](guide:pixel-art-crisp-in-browser-phaser-pixi)의 게임 전체 설정으로 맞춥니다.

## Godot 4.7: BMFont 임포트와 MSDF {#godot}

**비트맵 폰트.** `.fnt`와 PNG를 프로젝트에 넣으면 Godot이 `FontFile`로 임포트합니다. 파일의 `info` 줄에 있는 `size`가 폰트의 **fixed size**가 되고, 다른 크기에서 어떻게 할지는 임포트 옵션 **Scaling Mode**(*Disabled*, *Enabled (Integer)*, *Enabled (Fractional)*, 기본값 Fractional)가 정합니다. 도트 폰트는 **Enabled (Integer)**를 쓰세요. 글리프 시트 이미지를 바로 폰트로 임포트할 수도 있습니다. **Import As**를 *Font Data (Image Font)*로 바꾸고 **Columns**, **Rows**, **Character Ranges**를 채웁니다.

**MSDF.** `.ttf`/`.otf`를 선택하고 **Multichannel Signed Distance Field**를 켠 뒤 **Reimport**합니다. **MSDF Size**(기본 48)는 거리장을 만드는 크기, **MSDF Pixel Range**(기본 8)는 거리 경사의 폭입니다. Godot 문서가 밝힌 제약은 세 가지입니다. 픽셀 범위는 **외곽선 크기의 2배 이상**이어야 하고, 외곽선이 자기 교차하는 폰트는 잘못 그려지며, LCD 서브픽셀 안티에일리어싱은 쓸 수 없습니다. 위 E행이 이 설정에 2px 외곽선을 준 결과입니다.

```gdscript
# title_label.gd - outline on an MSDF font (MSDF Pixel Range 8 >= 2 x outline 2)
extends Label

func _ready() -> void:
	add_theme_font_size_override("font_size", 12)
	add_theme_constant_override("outline_size", 2)
	add_theme_color_override("font_outline_color", Color(0.1, 0.2, 0.55))
	scale = Vector2(6, 6)   # MSDF: no re-rasterisation, edges stay sharp
```

Label과 RichTextLabel에는 **Font Shadow Color**, **Shadow Offset X/Y**, **Shadow Outline Size** 그림자 오버라이드도 있습니다.

## Unity 6: TextMesh Pro와 UI Toolkit {#unity}

TextMesh Pro는 이제 uGUI 패키지 안에 들어 있고(Unity 6000.5.3f1 기준 `com.unity.ugui` 2.5.0), UI Toolkit은 TextCore 폰트 에셋을 씁니다. 두 쪽 모두 다음 설정을 공유합니다.

- **Render Mode.** 비트맵: *SMOOTH*, *SMOOTH_HINTED*, *RASTER*, *RASTER_HINTED*(컬러 폰트용 *COLOR* 계열도 있음). 거리장: *SDF*, *SDFAA*, *SDFAA_HINTED*, *SDF8*, *SDF16*, *SDF32*. *SDFAA*는 빠르지만 덜 정확한 생성 방식이고, *SDF8/16/32*는 오버샘플링이 점점 늘어납니다. 모두 1채널이며 MSDF 모드는 없습니다.
- **Atlas Population Mode.** *Static*은 에디터에서 글자를 구워 넣고, *Dynamic*은 런타임에 원본 폰트에서 글리프를 추가하며(폰트 파일이 빌드에 포함됨), *Dynamic OS*는 플레이어 시스템에 설치된 폰트를 씁니다.
- **효과.** 외곽선, 언더레이(그림자), 글로우는 SDF 셰이더의 머티리얼 설정입니다.

Unity UI Toolkit 매뉴얼은 일반 라벨에 Static + SDF16, 타이틀에 SDF32, 플레이어가 입력하는 텍스트에 Dynamic + SDFAA, 패딩은 샘플링 크기의 약 1/10을 권장합니다. 또한 **Unity 6.5에서는 UI Toolkit의 기본 Advanced Text Generator가 정적 폰트 에셋을 지원하지 않으며**, 마이그레이션 문서는 폰트를 서브셋한 뒤 다이내믹 에셋을 쓰라고 안내합니다. TextMesh Pro는 세 모드를 그대로 지원합니다.

## Phaser 3.90·4.2: BitmapText는 XML만 읽습니다 {#phaser}

Phaser의 `load.bitmapFont`는 **XML BMFont만** 해석합니다. 같은 폰트로 시험했을 때 Phaser 3.90.0과 4.2.1 모두 텍스트 `.fnt`는 "Failed to process file"로 실패했고 `.xml`은 95개 글리프를 모두 읽었습니다. 텍스트 `.fnt`(BMFont 기본값이자 Nerulio 출력)는 다음처럼 변환합니다.

```js
// fnt-to-xml.mjs - convert a BMFont *text* .fnt into the XML flavour Phaser's load.bitmapFont reads.
// Usage: node fnt-to-xml.mjs font.fnt font.xml
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tags = { info: [], common: [], page: [], distanceField: [], char: [], kerning: [] };

for (const line of readFileSync(src, 'utf8').split(/\r?\n/)) {
  const tag = line.split(/\s/, 1)[0];
  if (!(tag in tags)) continue; // skips "chars count=" / "kernings count=" (recounted below)
  const attrs = [...line.matchAll(/(\w+)=("[^"]*"|\S+)/g)]
    .map(([, k, v]) => `${k}="${esc(v.replace(/^"|"$/g, ''))}"`);
  tags[tag].push(`<${tag} ${attrs.join(' ')}/>`);
}

writeFileSync(out, `<?xml version="1.0"?>
<font>
  ${tags.info[0]}
  ${tags.common[0]}
  <pages>${tags.page.join('')}</pages>
  ${tags.distanceField.join('')}
  <chars count="${tags.char.length}">
    ${tags.char.join('\n    ')}
  </chars>
  <kernings count="${tags.kerning.length}">${tags.kerning.join('')}</kernings>
</font>
`);
console.log(`${out}: ${tags.char.length} chars, ${tags.kerning.length} kernings`);
```

```js
// In your scene (Phaser 3.90 or 4.x). With pixelArt: true in the game config the font stays crisp.
preload() {
  this.load.bitmapFont('future12', 'future12.png', 'future12.xml');
}
create() {
  this.add.bitmapText(16, 40, 'future12', 'Wave 7');              // the font's own size: 1:1
  this.add.bitmapText(110, 34, 'future12', 'Wave 7').setScale(6); // whole-number scale
}
```

크기 인수를 생략하면 폰트 자체 크기로 그려지고, 크기를 넘기면 그 크기에 대한 비율로 스케일됩니다. 두 버전 모두 거리장 BitmapText가 없으므로(두 소스 트리에 SDF/MSDF 코드가 없음), Phaser에서 크기가 변하는 큰 타이틀은 큰 비트맵 폰트나 `Text` 객체로 처리합니다.

## PixiJS 8: SDF·MSDF BitmapText {#pixijs}

PixiJS 8은 `Assets`로 BMFont 텍스트와 XML을 모두 읽고, 폰트가 거리장을 선언하면 SDF 또는 MSDF 셰이더로 전환합니다.

```js
import { Assets, BitmapText } from 'pixi.js';

await Assets.load(['future12.fnt', 'pixel-msdf.xml']);

// Bitmap font: fontSize = the size in the file's info line draws it 1:1.
const hud = new BitmapText({ text: 'Wave 7', style: { fontFamily: 'Future12', fontSize: 16, fill: '#ffeea0' } });

// MSDF font (from msdf-atlas-gen): any size stays sharp.
const title = new BitmapText({ text: 'Hi!', style: { fontFamily: 'PixelMSDF', fontSize: 240, fill: '#ffeea0' } });
app.stage.addChild(hud, title);
```

XML에는 `<distanceField fieldType="msdf" distanceRange="4"/>`(또는 `fieldType="sdf"`)가 있어야 합니다. PixiJS 8.21.0에서 `distanceField fieldType=msdf distanceRange=4` 줄이 든 **텍스트** `.fnt`는 *일반* 비트맵 폰트로 읽혔습니다. 텍스트 파서가 소문자 레코드 이름만 인식해 그 줄을 건너뛰기 때문입니다. 같은 데이터를 XML로 주면 정상 동작하므로, Pixi에는 SDF/MSDF 폰트를 XML로 넘기세요(위 변환기는 `distanceField`를 보존합니다). msdf-atlas-gen은 JSON을 출력하므로 변환이 필요하고, msdf-bmfont-xml과 Snowb는 BMFont를 바로 씁니다.

## 외곽선·그림자와 메모리 {#outlines-memory}

SDF·MSDF 텍스트에서 외곽선은 같은 거리값에 두 번째 임계값을 적용한 것이고, 그림자나 글로우는 오프셋이나 더 부드러운 임계값으로 한 번 더 읽은 것이라 새 텍스처가 필요 없습니다. 다만 효과는 아틀라스에 저장된 거리 범위까지만 뻗을 수 있습니다. Godot이 MSDF Pixel Range ≥ 외곽선 × 2를 요구하고, TextMesh Pro의 패딩이 외곽선 두께를 제한하는 이유입니다. 비트맵 폰트는 폰트를 만들 때 외곽선을 글리프에 구워 넣거나, 텍스트를 두 번 그려 1px 드롭 섀도를 만듭니다.

메모리: 비트맵 아틀라스는 한 크기·한 스타일만 담으므로 크기 세 개에 외곽선 버전까지 있으면 아틀라스가 네 장입니다. 거리장 아틀라스는 하나로 모두를 처리하지만 셀마다 여백이 붙고 MSDF는 RGB가 필요합니다. Kenney Future의 출력 가능한 ASCII 95자 기준으로, 12px 비트맵은 150×160, msdf-atlas-gen 32px·pixel range 4에서는 SDF(1채널) 228×228, MSDF(RGB) 236×236였습니다. 라틴 문자 UI는 어느 쪽이든 작습니다. 메모리를 좌우하는 것은 글자 수이고, 그래서 CJK에는 서브셋이나 다이내믹 아틀라스가 필요합니다.

## 자주 하는 실수 {#pitfalls}

- **`.fnt`의 `size`를 확인하세요.** Godot은 이 값을 fixed size로 쓰고, Phaser와 Pixi는 요청한 크기를 이 값에 대한 비율로 스케일합니다.
- **최근접 필터와 정수 스케일은 둘 다 필요합니다.** 하나만 맞추면 도트 폰트는 여전히 흐릿합니다.
- **아주 작은 글자.** 매우 작은 크기에서는 그 크기에 맞춰 힌팅한 비트맵이 거리장보다 읽기 좋은 경우가 많습니다.
- **커닝**은 생성기가 커닝 쌍을 기록했을 때만 있습니다. 글리프 시트로 만든 폰트에는 없습니다.

:::nerulio tool=bitmap-font
Nerulio UI Lab의 비트맵 폰트 단계는 업로드 없이 브라우저에서 글리프 시트나 로컬 TTF/OTF를 BMFont로 만듭니다. Fixed grid 내보내기(8×12 CC0 시트)는 Nerulio 엔진 검증에서 Godot 4.7.2와 PixiJS 8에 픽셀 단위로 정확히 로드되었습니다. Font file 모드는 아직 그 검증에 포함되지 않았고, 이 글의 Kenney Future 폰트가 그 모드로 만든 것으로 Godot, Phaser(XML 변환 후), PixiJS에서 로드되었습니다.
- **Fixed grid**: 격자와 글자 순서를 신뢰도와 함께 자동 감지하고, 각 글리프는 셀 전체입니다.
- **Measured widths**와 **Font file**: 시트의 픽셀이나 원하는 크기로 렌더링한 TTF/OTF에서 글리프 사각형과 글자별 advance를 측정합니다.
- **문자 집합 빌더**: 내 텍스트에 쓰인 글자, ASCII, Latin-1, 붙여 넣은 텍스트의 한국어/일본어 글자.
- **다운로드**하면 `font.png`, `font.fnt`(BMFont 텍스트), `font.json`, README가 나오고, **Also build an SDF texture (Beta)**를 켜면 셰이더 공식이 함께 담긴 1채널 `font-sdf.png`가 추가됩니다.
- 한계: 페이지 1장, 커닝 없음, MSDF 없음, SDF 출력은 엔진 검증 전, Phaser는 위의 XML 변환이 필요합니다.
:::

![Nerulio UI Lab 비트맵 폰트 단계](shot:lab-ui-font "Nerulio UI Lab 폰트 단계: 8×12 글리프 시트를 공백 문자부터 시작하는 16×6 격자로 감지하고, 폰트 자체 메트릭으로 한 줄을 그려 보여 줍니다.")

## FAQ {#faq}

### 게임 UI에는 SDF와 MSDF 중 무엇이 좋나요?

큰 텍스트나 모서리가 각진 폰트는 MSDF가 낫습니다. 1채널 SDF는 확대하면 모서리가 둥글어지기 때문입니다. 본문 크기나 둥근 폰트는 SDF도 차이가 없고 더 간단하며, Unity TextMesh Pro는 SDF만 제공합니다.

### Godot 4에서 도트 폰트가 흐릿한 이유는 무엇인가요?

대부분 Import 독의 Antialiasing이 Grayscale 그대로이거나, 크기가 디자인 크기의 정수배가 아니거나, Control이 linear 필터 또는 소수 배율로 그려지기 때문입니다. Antialiasing과 Hinting을 None, Subpixel Positioning을 Disabled로 두고 디자인 크기와 Nearest 필터를 쓰세요.

### Phaser에서 .fnt 파일이 로드되지 않는 이유는 무엇인가요?

`load.bitmapFont`는 XML BMFont만 해석합니다. 텍스트 `.fnt`(`info face=… size=…` 형식)는 "Failed to process file"로 실패하므로 XML로 내보내거나 위와 같은 스크립트로 변환하세요.

### Unity에서 MSDF 폰트를 쓸 수 있나요?

TextMesh Pro와 UI Toolkit으로는 안 됩니다. 거리장 모드가 모두 1채널입니다. 큰 텍스트도 대개 SDF32면 충분하고, 진짜 MSDF가 필요하면 서드파티 솔루션을 써야 합니다.

### 크기마다 비트맵 폰트를 따로 만들어야 하나요?

픽셀 단위로 정확하게 그리려면 그렇습니다. 크기마다 아틀라스를 만들거나 도트 폰트 하나의 정수배를 쓰세요. 거리장 폰트는 아틀라스 하나로 모든 크기를 처리하지만 작은 글자가 조금 부드러워집니다.

## Sources {#sources}

- [ResourceImporterDynamicFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterdynamicfont.html)
- [ResourceImporterBMFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterbmfont.html)
- [Using fonts: bitmap fonts, pixel fonts, MSDF, outlines (Godot 4.7)](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html)
- [Godot 4.7 font importer source, option names and enum labels](https://github.com/godotengine/godot/blob/4.7-stable/editor/import/resource_importer_dynamic_font.cpp)
- [Font Asset Creator (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsCreator.html)
- [Font Asset properties (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsProperties.html)
- [Introduction to font assets (Unity 6.3 Manual, UI Toolkit)](https://docs.unity3d.com/6000.3/Documentation/Manual/UIE-font-asset.html)
- [Migrate static font assets to Advanced Text Generator (Unity 6.5 Manual)](https://docs.unity3d.com/6000.5/Documentation/Manual/ui-systems/migrate-static-font-assets.html)
- [Bitmap Text (Phaser documentation)](https://docs.phaser.io/phaser/concepts/gameobjects/bitmap-text)
- [Bitmap text (PixiJS 8 guide)](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)
- [msdf-atlas-gen (Viktor Chlumský)](https://github.com/Chlumsky/msdf-atlas-gen)
- [BMFont file format (AngelCode)](https://www.angelcode.com/products/bmfont/doc/file_format.html)
