Unity에서 도트 그래픽이 흐릿해지는 원인은 기본 텍스처 임포트 설정입니다. 새 PNG는 **Filter Mode** **Bilinear**(확대할 때 픽셀을 부드럽게 섞음)와 **Compression** **Normal Quality**(4×4 블록 단위로 색을 뭉갬)로 들어오고, **Max Size**(기본 2048)보다 큰 시트는 아무 경고 없이 축소됩니다. **Filter Mode**를 **Point (no filter)**, **Compression**을 **None**으로 바꾸고, **Max Size**를 이미지보다 크게, 모든 스프라이트의 **Pixels Per Unit**을 같은 값으로 맞춘 뒤, **Pixel Perfect Camera**를 붙여 화면이 정수 배율로 그려지게 하면 해결됩니다.

아래 내용은 모두 Unity 6000.5.3f1(Unity 6.5), URP 17.5와 2D Renderer에서 확인했으며, 이미지는 그 에디터가 실제로 렌더링한 결과입니다.

![Unity 6000.5.3f1에서 같은 48px CC0 사무라이 프레임을 6배로 렌더링한 네 가지 결과: Bilinear + Normal Quality 압축, Point + Normal Quality, Point + Max Size 128, Point + None](shot:engine-unity-pixel-import-compare "Unity 6000.5.3f1(Built-in Render Pipeline)이 6배로 렌더링. 왼쪽부터 Bilinear + 압축(기본값), Point + 압축(얼굴 디테일 손실), Point + Max Size 128(시트가 77×128로 축소), Point + None. 그림: sebshady의 사무라이, CC0.")

## 임포트 설정 고치기 {#steps}

:::steps
1. **스프라이트를 선택합니다.** Project 창에서 도트 텍스처를 모두 선택합니다(여러 개를 한 번에 선택해 같이 고칠 수 있습니다).
2. **스프라이트로 임포트합니다.** Inspector에서 **Texture Type**을 **Sprite (2D and UI)**로 둡니다. **Pixels Per Unit**은 모든 스프라이트에 타일·격자 크기(예: 16)를 넣어 타일 하나가 월드 1유닛이 되게 합니다.
3. **필터링을 끕니다.** **Advanced** 항목을 열어 **Filter Mode**를 **Point (no filter)**로 바꾸고 **Generate Mip Maps**를 끕니다.
4. **압축을 끄고 Max Size를 확인합니다.** 플랫폼 영역(**Default** 탭)에서 **Compression**을 **None**으로 두고, **Max Size**를 텍스처의 긴 변 이상으로 맞춥니다(3000px 시트라면 4096). **Apply**를 누릅니다.
5. **Pixel Perfect Camera를 붙입니다.** 카메라를 선택하고 **Add Component**에서 **Pixel Perfect Camera**를 추가합니다. **Assets Pixels Per Unit**은 스프라이트와 같은 값, **Reference Resolution**은 게임의 도트 해상도(예: 320 × 180)로 둡니다. URP에서는 카메라가 2D Renderer를 써야 합니다.
6. **스냅 방식을 고릅니다.** 서브픽셀 이동을 막으려면 **Grid Snapping**을 **Pixel Snapping**으로, 장면을 기준 해상도로 그린 뒤 확대하려면 **Upscale Render Texture**로 둡니다. 후자는 회전한 스프라이트도 도트 격자에 맞춰 줍니다. 화면 비율이 기준 해상도와 다를 때의 처리는 **Crop Frame**으로 고릅니다.
:::

## 설정마다 왜 중요한가 {#why}

288×480 CC0 시트(48px 프레임)로 측정한 값입니다.

| 설정 | 새 PNG의 기본값 | 도트 그래픽에 주는 영향 |
|---|---|---|
| **Filter Mode** | Bilinear | 확대할 때 이웃 텍셀을 섞어 모든 경계가 그라데이션이 됨(왼쪽 렌더는 색이 12가지가 아니라 4,230가지) |
| **Compression** | Normal Quality(Windows에서 DXT5) | 4×4 블록 단위로 색이 바뀜. Point로 두면 선명하지만 틀린 색이 나오고, 두 번째 렌더에서는 얼굴 디테일이 사라짐 |
| **Max Size** | 2048 | 더 큰 텍스처는 임포트할 때 경고 없이 축소됨. Max Size 128에서는 시트가 77×128이 됨 |
| **Generate Mip Maps** | Sprite는 꺼짐, Default는 켜짐 | 작게 그릴 때 쓰이는 축소본으로, 도트를 흐리게 만듦 |
| **Pixels Per Unit** | 100 | 스프라이트마다 값이 다르면 화면에서 픽셀 크기가 서로 달라짐 |

가장 오른쪽 렌더(**Point**, **None**, Max Size 2048)는 원본 프레임을 최근접 이웃 방식으로 6배 확대한 이미지와 픽셀 단위로 완전히 같았습니다.

**Texture Type도 확인하세요.** 2D 모드가 아닌 프로젝트에서는 새 PNG가 **Sprite (2D and UI)**가 아니라 **Default**로 들어옵니다. 이때는 밉맵이 켜지고, 2의 거듭제곱이 아닌 이미지는 크기가 바뀝니다. 실험한 288×480 시트는 256×512가 됐습니다. 스프라이트여야 할 텍스처가 흐릿하고 살짝 늘어나 보인다면 **Texture Type**부터 보세요.

## Pixel Perfect Camera 설정 {#pixel-perfect-camera}

Unity 6의 URP에서 **Pixel Perfect Camera**는 URP에 포함된 컴포넌트(`UnityEngine.Rendering.Universal.PixelPerfectCamera`)이며, 카메라가 **2D Renderer**를 써야 합니다. 다른 렌더러에서는 Inspector에 오류가 표시됩니다. Built-in Render Pipeline은 별도의 **2D Pixel Perfect** 패키지(6000.5에는 6.0.0이 함께 제공)를 쓰며, 옵션이 예전 방식의 체크박스로 되어 있습니다.

| 속성 | 6000.5.3f1의 값 | 용도 |
|---|---|---|
| **Assets Pixels Per Unit** | 기본 100 | 스프라이트의 **Pixels Per Unit**과 같아야 함 |
| **Reference Resolution** | 기본 320 × 180 | 그림이 기준으로 삼는 해상도. 카메라가 화면에 맞는 가장 큰 정수 배율을 고름 |
| **Crop Frame** | None, Pillarbox, Letterbox, Windowbox, Stretch Fill | 남는 화면 영역 처리: 검은 띠를 넣거나 늘려 채움 |
| **Grid Snapping** | None, Pixel Snapping, Upscale Render Texture | Pixel Snapping은 그릴 때 스프라이트 렌더러를 도트 격자에 맞춤. Upscale Render Texture는 기준 해상도로 그린 뒤 확대 |
| **Filter Mode** | Retro AA(기본), Point | **Crop Frame**이 **Stretch Fill**일 때만 표시. Retro AA는 가장 가까운 정수 배까지 Point로 확대한 뒤 화면 크기까지 Bilinear로 맞춤. Point는 선명하지만 더 많이 반짝임 |

게임 실행 중에는 Inspector의 **Current Pixel Ratio**에 카메라가 정한 배율(예: 4:1)이 나옵니다. 목표 해상도에서 정수가 아니라면 **Reference Resolution**이나 **Crop Frame**을 바꾸세요. 기준 해상도 48 × 48로 288px 테스트 렌더를 했을 때 배율은 6이었습니다.

![같은 프레임을 20° 회전해 URP로 렌더링한 두 결과: Grid Snapping None은 큰 픽셀이 함께 기울고, Upscale Render Texture는 픽셀이 격자에 똑바로 남음](shot:engine-unity-pixel-perfect-rotation "Unity 6000.5.3f1, URP 17.5 2D Renderer, Pixel Perfect Camera 6배. 왼쪽 Grid Snapping None, 오른쪽 Upscale Render Texture, 스프라이트 20° 회전.")

**Grid Snapping**은 스프라이트를 회전하거나 크기를 바꿀 때 차이가 큽니다. **None**에서는 회전한 스프라이트를 화면 해상도로 그리기 때문에 큰 픽셀이 같이 기울어져 도트 격자를 가로지릅니다(이른바 "믹셀"). **Upscale Render Texture**에서는 장면을 먼저 기준 해상도로 그리므로, 회전한 스프라이트도 다른 그림과 같은 격자로 다시 도트화됩니다. Unity 문서도 이 선택의 대가를 적어 두었습니다. 픽셀이 선명할수록 움직일 때 더 반짝입니다.

## 새 텍스처마다 설정을 자동으로 적용하기 {#presets}

파일마다 손으로 설정하다 보면 흐릿한 스프라이트가 다시 생깁니다. 자동화하는 확실한 방법은 두 가지이며, 둘 다 6000.5.3f1에서 시험했습니다.

**Preset Manager(코드 없음).** 텍스처 하나를 올바르게 설정한 뒤 Inspector 오른쪽 위의 프리셋 선택 버튼(슬라이더 아이콘)을 누르고, **Select Preset** 창에서 **Create New**를 눌러 프리셋 에셋을 저장합니다. 그 프리셋을 선택해 Inspector에서 **Add to default**를 누른 다음, **Edit → Project Settings → Preset Manager**에서 `glob:"Assets/Art/Sprites/**"` 같은 **Filter**를 줍니다. 실험에서는 그 폴더에 새로 넣은 PNG가 Sprite / Point / None과 프리셋의 Pixels Per Unit으로 임포트됐고, 폴더 밖의 PNG는 기본값 그대로였습니다. 이미 있는 에셋을 Reimport할 때는 기본 프리셋이 적용되지 않습니다. 또 프리셋은 가진 설정을 전부 복사하므로, 속성을 제외하지 않으면 **Sprite Mode**까지 덮어씁니다.

**AssetPostprocessor(코드).** 아래 스크립트는 새 파일에만 적용되므로, 나중에 Inspector에서 바꾼 값은 그대로 유지됩니다.

```csharp
// Assets/Editor/PixelArtImportSettings.cs
using UnityEditor;
using UnityEngine;

// Gives every texture imported under Assets/Art/Pixel/ pixel-art settings on its first import.
public class PixelArtImportSettings : AssetPostprocessor
{
    const string Folder = "Assets/Art/Pixel/";
    const float PixelsPerUnit = 16f;

    void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith(Folder)) return;
        if (!assetImporter.importSettingsMissing) return; // only new files: later Inspector edits are kept
        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.Sprite;
        importer.spritePixelsPerUnit = PixelsPerUnit;
        importer.filterMode = FilterMode.Point;
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.maxTextureSize = 16384;                     // never downscale silently
    }
}
```

실험에서 `Assets/Art/Pixel/`에 새로 넣은 파일은 Sprite, Point, 무압축, Max Size 16384, 16 PPU, 밉맵 없음으로 들어왔습니다. 그 뒤 Inspector에서 Bilinear로 바꾸고 다시 임포트해도 Bilinear가 유지됐습니다. 폴더 규칙이 항상 이기게 하려면 `importSettingsMissing` 줄을 지우세요.

## Sprite Atlas와 타일맵 틈 {#atlas-tilemap}

- **Sprite Atlas에는 자체 텍스처 설정이 있습니다.** 6000.5.3f1에서 새 아틀라스는 **Filter Mode** Bilinear, **Compression** Normal Quality, **Padding** 4, **Allow Rotation**과 **Tight Packing** 켜짐으로 시작합니다. 패킹된 스프라이트는 아틀라스 텍스처로 그려지므로 아틀라스도 **Point**, **None**으로 바꾸세요. 그렇지 않으면 패킹 후에 다시 흐려집니다.
- **타일 사이의 가는 선**은 대개 타일 가장자리에서 옆 텍셀을 샘플링해서 생깁니다. 원인은 픽셀 사이에 놓인 카메라 위치나 줌, Bilinear, 밉맵, 압축입니다. 대부분은 Point 필터, 밉맵 끄기, Pixel Perfect Camera로 해결됩니다. 나머지는 타일을 Padding 2 이상에 Point 필터인 Sprite Atlas에 넣으면 해결됩니다. 가장자리 확장(extrude)과 그 원리는 [타일 이음매와 텍스처 번짐](guide:tile-seams-texture-bleeding-padding-extrude)에서 다룹니다.
- **움직일 때 떨림**(스프라이트가 배경에 대해 1픽셀씩 흔들림)은 서브픽셀 이동 때문입니다. **Grid Snapping**을 쓰거나, 카메라와 스프라이트 위치를 `1 / Pixels Per Unit`의 배수로 유지하세요.

:::nerulio tool=pixel-perfect-checker
확대해서 내보냈거나, 부드럽게 리사이즈했거나, 실제 격자가 없는 생성형 "도트"처럼 PNG 자체가 이미 흐릿한 경우는 Unity 설정으로 고칠 수 없습니다. Nerulio Pixel Perfect Checker는 브라우저 안에서 파일을 측정해 어느 경우인지 알려 줍니다.
- 확대된 그림의 픽셀 크기와 격자 오프셋을 찾습니다. 정확한 격자가 있으면 **Recover 1× source**로 진짜 1배 이미지를 꺼내 임포트할 수 있습니다.
- 두 색 사이의 중간색을 가진 경계 픽셀(최근접 확대 이미지는 0개, 부드럽게 리사이즈된 이미지는 많음)과 색 개수를 세고, 원래 픽셀을 복원할 수 없을 때는 그렇다고 분명히 말해 줍니다.
- Studio [Pack & Export](studio:pack)의 Unity 6 대상은 Point, 무압축, 밉맵 없음으로 임포트하고 Max Size를 아틀라스 페이지에 맞게 올립니다. 이 내보내기는 Unity 6000.5.3f1에서 검증했습니다.
:::

![Nerulio Pixel Perfect Checker가 약 7.29배로 리샘플된 이미지를 측정해 높은 신뢰도로 스무딩을 보고하고, 중간색 경계 픽셀 84.6%를 표시한 화면](shot:lab-pixel-cleanup "격자를 추측하는 대신, 정수가 아닌 리샘플과 스무딩을 그대로 보고합니다.")

## FAQ {#faq}

### Game 뷰에서만 도트가 흐릿한 이유는 무엇인가요?

Scene 뷰와 Game 뷰는 확대 방식이 다릅니다. 정수가 아닌 배율에서는 **Point**여도 픽셀 크기가 들쭉날쭉해지고, **Bilinear**라면 흐려지기까지 합니다. Game 뷰를 고정 해상도로 두고 Pixel Perfect Camera로 정수 배율 확대를 하세요.

### Unity 도트 그래픽에는 Point와 Bilinear 중 무엇을 써야 하나요?

**Point (no filter)**입니다. Bilinear는 부드러운 그림을 위한 것이라, 도트 스프라이트를 확대하면 이웃 픽셀을 평균 냅니다. Pixel Perfect Camera에서 **Stretch Fill**을 쓴다면 마지막 확대에 쓰이는 **Filter Mode**(Retro AA)는 별도의 설정입니다.

### Point로 바꿨는데도 흐릿합니다. 무엇을 더 봐야 하나요?

**Compression**(None), **Max Size**(이미지보다 작으면 안 됨), **Generate Mip Maps**(끔), 그리고 스프라이트가 Filter Mode가 아직 Bilinear인 Sprite Atlas에 들어 있지 않은지 확인하세요. 텍스처가 **Default**로 임포트되지 않았는지도 봐야 합니다.

### Pixels Per Unit은 얼마로 해야 하나요?

타일 또는 격자 한 칸의 크기(16px 타일셋이면 16)를 쓰고, 모든 스프라이트와 카메라의 **Assets Pixels Per Unit**에 같은 값을 넣으세요. 숫자 자체는 설계상의 선택이고, 중요한 것은 모두 일치시키는 것입니다.

### Built-in Render Pipeline에서도 Pixel Perfect Camera를 쓸 수 있나요?

URP 컴포넌트는 쓸 수 없습니다. Built-in 파이프라인은 지금도 배포되는 **2D Pixel Perfect** 패키지(Unity 6.5용 6.0.0)를 씁니다. URP에서는 2D Renderer와 함께 URP에 포함된 컴포넌트를 쓰세요.

## 출처 {#sources}

- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- Unity 6.5 Manual — [Add a pixel perfect camera (prepare your sprites)](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html)
- Unity 6.5 Manual — [Configure a pixel perfect camera](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-configure.html)
- Unity 6.5 Manual — [Pixel Perfect Camera component reference for URP](https://docs.unity3d.com/6000.5/Documentation/Manual/urp/2d-pixelperfect-ref.html)
- 2D Pixel Perfect 패키지 6.0 — [2D Pixel Perfect (Built-in Render Pipeline)](https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@6.0/manual/index.html)
- Unity 6.5 Manual — [Preset Manager](https://docs.unity3d.com/6000.5/Documentation/Manual/class-PresetManager.html), [Apply default presets by folder](https://docs.unity3d.com/6000.5/Documentation/Manual/DefaultPresetsByFolder.html)
- Unity 6.5 Scripting API — [AssetPostprocessor.OnPreprocessTexture](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetPostprocessor.OnPreprocessTexture.html), [AssetImporter.importSettingsMissing](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AssetImporter-importSettingsMissing.html)
- Unity 6.5 Manual — [Sprite Atlas Inspector window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html)
- 테스트 그림: [sebshady의 Samurai sprites](https://opengameart.org/content/samurai-sprites), CC0
