Unity 6에서 스프라이트 시트를 자르려면 PNG를 선택해 **Texture Type**을 **Sprite (2D and UI)**, **Sprite Mode**를 **Multiple**로 바꾸고 **Apply**를 누릅니다. 그다음 **Sprite Editor**를 열어 **Slice → Grid By Cell Size**에 프레임 크기를, 프레임 사이 간격을 **Padding**에 넣고 다시 **Apply**합니다. 잘린 프레임들을 Project 창에서 선택해 Scene에 끌어다 놓으면 Unity가 클립 저장 위치를 물은 뒤 초당 12프레임짜리 Animation Clip, Animator Controller, Animator 컴포넌트를 한 번에 만듭니다.

아래 내용은 모두 Unity 6000.5.3f1(Unity 6.5)과 기본 탑재된 2D Sprite 패키지에서 확인했습니다. 수치는 Sprite Editor와 같은 그리드 슬라이서를 호출하는 배치 모드 스크립트로 측정한 값입니다. 테스트 시트는 Kenney의 CC0 Pixel Platformer 캐릭터 시트(224×74px, 24px 프레임, 1px 간격)입니다.

## 시트를 자르고 클립 만들기 {#steps}

:::steps
1. **임포트 설정을 바꿉니다.** Project 창에서 시트를 선택하고 Inspector에서 **Texture Type**을 **Sprite (2D and UI)**, **Sprite Mode**를 **Multiple**로 바꿉니다. **Pixels Per Unit**은 타일이나 캐릭터 셀 한 칸의 크기(16, 24, 32 …)로 맞춥니다. 도트 그래픽이라면 **Filter Mode**를 **Point (no filter)**, **Compression**을 **None**으로 두고 **Apply**를 누릅니다.
2. **Sprite Editor를 엽니다.** Inspector의 **Open Sprite Editor**를 누릅니다. 2D Sprite 패키지가 없어서 Sprite Editor 창을 쓸 수 없다는 메시지가 나오면 **Window → Package Manager**에서 **2D Sprite**를 설치합니다(2D 템플릿에는 처음부터 들어 있습니다).
3. **그리드를 정합니다.** 툴바의 **Slice**를 누르고 **Type**을 **Grid By Cell Size**로 둡니다. **Pixel Size**에 프레임 크기(이 예시는 24 × 24), **Offset**에 첫 프레임 앞의 여백, **Padding**에 프레임 사이 간격(이 예시는 1 × 1)을 넣습니다. 칸마다 스프라이트가 꼭 하나씩 필요한 경우가 아니면 **Keep Empty Rects**는 꺼 둡니다.
4. **피벗을 고르고 자릅니다.** 땅을 딛고 서는 캐릭터라면 **Pivot**을 **Bottom**으로 둡니다(또는 **Custom**에 **Pivot Unit Mode**를 **Pixels**로). 처음 자를 때는 **Method**를 **Delete Existing**으로 두고 **Slice**를 누릅니다. 모든 외곽선이 프레임에 정확히 맞는지 확인한 뒤 **Apply**를 누릅니다.
5. **클립을 만듭니다.** Project 창에서 시트를 펼쳐 애니메이션 하나에 들어갈 프레임(예: `characters_0`, `characters_1`)을 선택하고 Scene 뷰로 끌어다 놓습니다. 저장 창이 뜨면 `.anim` 파일을 저장합니다. Unity가 SpriteRenderer, Animator, 새 Animator Controller를 붙여 클립이 재생되게 해 줍니다.
6. **속도와 반복을 정합니다.** **Window → Animation → Animation**을 열고 GameObject를 선택한 뒤, Animation 창의 옵션 메뉴에서 **Show Sample Rate**를 켭니다. **Samples**(초당 프레임 수)를 12에서 원하는 값으로 바꿉니다. 걷기·대기처럼 반복되는 동작은 `.anim` 파일을 선택해 Inspector의 **Loop Time**을 켜고, 공격·사망처럼 한 번만 재생할 동작은 끕니다.
:::

![Nerulio Studio의 Sprite 작업 공간이 CC0 사무라이 시트에서 48×48 그리드를 신뢰도·대안과 함께 찾아낸 화면(아직 자르기 전)](shot:studio-sprite-import "Sprite 작업 공간은 신뢰도와 함께 그리드를 제안하고, 자르기 전에 다른 후보와 비교할 수 있게 해 줍니다.")

## 어떤 Slice 방식을 쓸까 {#slice-types}

**Slice** 메뉴의 방식은 네 가지입니다. 6000.5.3f1의 `SpriteEditorMenuSetting.SlicingType`에도 정확히 Automatic, GridByCellSize, GridByCellCount, IsometricGrid 네 개만 있습니다.

| Type | 동작 | 쓰는 곳 |
|---|---|---|
| Automatic | 불투명 픽셀 덩어리마다 딱 맞는 사각형 하나 | 아이콘 시트, 소품, UI 조각. 애니메이션에는 부적합 |
| Grid By Cell Size | 고정 **Pixel Size** 칸에 **Offset**, **Padding** 적용 | 프레임 크기를 아는 애니메이션 시트 |
| Grid By Cell Count | **Column & Row**를 입력하면 칸 크기를 계산 | 프레임 개수만 아는 시트 |
| Isometric Grid | 마름모 칸(**Is Alternate**는 줄마다 엇갈림) | 아이소메트릭 타일 |

**애니메이션에 Automatic을 쓰면 안 됩니다.** 테스트 시트에서 Automatic은 덩어리 27개를 정확히 찾았지만 크기가 11×15부터 24×24까지 16가지였습니다. 잘린 사각형마다 피벗이 따로 잡히기 때문에 재생하면 캐릭터가 들썩입니다. 그리드로 자르면 모든 프레임 크기가 같아서 그림이 제자리에 머뭅니다.

## Padding, Offset과 1픽셀씩 밀리는 문제 {#padding-offset}

흔히 "한 칸 어긋남"이라고 부르는 문제는 대개 프레임 사이 간격을 무시하고 잘랐을 때 생깁니다. 개수가 틀리는 게 아니라서 알아차리기 어렵습니다. 224×74 시트(24px 프레임, 1px 간격)에서 세 가지 설정을 측정했습니다.

| 설정 | 스프라이트 수 | 각 열의 시작 위치 |
|---|---|---|
| Grid By Cell Size 24, Padding 0 | 27 | 0, 24, 48 … 192 — 열마다 1px씩 더 어긋나고 마지막 열은 8px 어긋남 |
| Grid By Cell Count 9 × 3, Padding 0 | 27 | 위와 같음. 224 / 9 = 24.9를 24로 내림 |
| Grid By Cell Size 24, Padding 1 | 27 | 0, 25, 50 … 200 — 정확함 |

앞의 두 설정도 프레임 개수는 맞기 때문에 목록만 보면 이상이 없습니다. 그런데 재생하면 캐릭터가 프레임마다 조금씩 옆으로 밀리고, 가장자리에 옆 프레임의 일부가 비칩니다. **Grid By Cell Count**도 Padding을 함께 넣어야 맞습니다. Unity는 칸 크기를 `(width − offset − padding × (columns − 1)) / columns`로 계산한 뒤 내림합니다.

이렇게 하면 막을 수 있습니다.

- 이미지 편집기에서 프레임 한 칸과 간격 하나를 재 봅니다. 시트 너비가 `offset + columns × cell + (columns − 1) × padding`과 같아야 합니다. 이 예시는 0 + 9 × 24 + 8 × 1 = 224입니다.
- **Offset**은 이미지 왼쪽 위에서부터 셉니다. 대부분의 그림 도구가 시트를 그렇게 배치합니다. Offset을 1, 1로 주면 첫 칸이 오른쪽으로 1px, 아래로 1px 이동했습니다.
- 남는 픽셀은 프레임이 되지 않습니다. 시트를 1px 넓힌 사본도 24×24 스프라이트가 정확히 27개 나왔고, 얇은 자투리 스프라이트는 생기지 않았습니다. 예전 버전 프로젝트에서 자투리가 보이면 클립을 만들기 전에 Sprite Editor에서 지웁니다.

## 빈 칸과 Keep Empty Rects {#empty-cells}

줄 끝에 빈 칸이 있는 시트가 많습니다. **Keep Empty Rects**가 꺼져 있으면(기본값) 그리드 슬라이스는 불투명 픽셀이 없는 칸을 건너뜁니다. CC0 HQ Trooper 시트(64px 칸 6 × 13)는 꺼 두면 52개, 켜면 78개가 나왔습니다.

문제는 번호입니다. Sprite Editor는 스프라이트를 만든 순서대로 `<texture>_0`, `<texture>_1` …으로 이름 붙입니다. 빈 칸을 건너뛰면 그 뒤 프레임이 다음 번호를 가져가서 "세 번째 줄"이 더 이상 `_12`에서 시작하지 않고, 인덱스로 프레임을 고르는 스크립트는 엉뚱한 프레임을 집습니다. **Keep Empty Rects**를 켜고 빈 칸을 손으로 지우거나, 클립을 만들기 전에 동작별로 이름(`run_0`, `run_1` …)을 바꿔 두세요.

## 피벗과 Pixels Per Unit {#pivot-ppu}

- **Pivot**은 스프라이트가 GameObject 위 어디에 놓이고 무엇을 중심으로 회전하는지를 정합니다. 플랫포머 캐릭터는 **Center**보다 **Bottom**(발바닥 기준)이 배치와 착지 판정에 편합니다. 한 애니메이션의 프레임은 모두 같은 피벗이어야 그림이 튀지 않습니다.
- **Pixels Per Unit**은 텍스처 몇 픽셀이 월드 1유닛인지를 정합니다. 도트 게임에서는 모든 스프라이트에 같은 값(보통 타일 크기)을 주세요. 그래야 16px 타일이 정확히 1유닛이 되고 [Pixel Perfect Camera](guide:unity-pixel-art-blurry-pixel-perfect)가 정수 픽셀에 맞출 수 있습니다.

## 참조를 깨지 않고 다시 자르기 {#slice-method}

**Method** 옵션은 이미 있는 스프라이트를 어떻게 할지 정합니다.

- **Delete Existing**은 기존 사각형을 모두 지우고 기본 이름으로 새로 만듭니다. 이름을 바꾼 스프라이트가 있으면 참조가 끊어진다고 Unity가 경고합니다.
- **Smart**는 기존 사각형을 유지하거나 조정하면서 새 사각형을 추가합니다.
- **Safe**는 사각형을 추가하기만 하고 기존 것은 건드리지 않습니다.

클립이나 프리팹이 스프라이트를 쓰기 시작한 뒤에는 **Smart**나 **Safe**로 다시 자르세요. Unity 6의 Slice 패널에는 **Slice on Import**도 있습니다. 켜 두면 Unity 밖에서 PNG를 고쳐 다시 임포트될 때마다 같은 설정으로 자동으로 다시 자릅니다.

## 프레임 속도, 프레임 순서, 반복 {#frame-rate}

6000.5.3f1에서 에디터 자체의 드래그 처리 코드를 호출해 재현한 결과는 다음과 같습니다.

- 클립은 **초당 12 샘플**, 프레임마다 키 하나로 저장되고 **반복 재생**됩니다(**Loop Time** 켜짐). 동시에 GameObject 이름을 딴 Animator Controller가 만들어지고 Animator가 붙습니다.
- 프레임은 클릭한 순서가 아니라 **자연 정렬 순서**로 정렬됩니다. `characters_0, characters_1, characters_2, characters_10` 순입니다. 자연 정렬 순서가 곧 재생 순서가 되도록 이름을 지으세요.
- 각 프레임은 1/12초씩 보이고 마지막 프레임도 똑같이 1/12초 동안 보입니다. 클립 길이는 `프레임 수 / Samples`(4프레임 = 0.333초)이므로 끝에 키를 하나 더 넣을 필요는 없습니다.

특정 프레임을 더 오래 보여 주려면 Animation 창 Dopesheet에서 그 키를 뒤로 끌거나 키를 복제합니다. 클립 전체 속도는 **Samples**로, 특정 상태의 속도만 바꾸려면 Animator 창에서 그 상태의 **Speed**를 바꿉니다.

## 스크립트로 자르기: ISpriteEditorDataProvider {#script}

예전 답변에는 `TextureImporter.spritesheet`가 자주 나옵니다. Unity 6에서는 이 속성이 "Support for accessing sprite meta data through spritesheet has been removed. Please use the UnityEditor.U2D.Sprites.ISpriteEditorDataProvider interface instead."라는 메시지와 함께 obsolete로 표시됩니다. 대신 2D Sprite 패키지의 `SpriteDataProviderFactories`를 씁니다. 아래 에디터 스크립트는 6000.5.3f1에서 컴파일·실행했습니다. 테스트 시트에서 만들어진 27개 사각형은 Sprite Editor의 그리드 결과와 완전히 같았고, 모든 스프라이트의 픽셀이 PNG와 일치했습니다.

```csharp
// Assets/Editor/SpriteSheetSlicer.cs  (needs the 2D Sprite package, com.unity.2d.sprite)
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.U2D.Sprites;
using UnityEngine;

public static class SpriteSheetSlicer
{
    // Cuts a grid sheet into sprites named <file>_0, <file>_1 … (top-left cell first).
    // cell = frame size, pad = gap between frames, off = margin before the first frame (pixels).
    public static int Slice(string path, int cellW, int cellH, int padX = 0, int padY = 0,
                            int offX = 0, int offY = 0, float ppu = 16f, bool skipEmpty = true)
    {
        var importer = (TextureImporter)AssetImporter.GetAtPath(path);
        importer.textureType = TextureImporterType.Sprite;          // "Sprite (2D and UI)"
        importer.spriteImportMode = SpriteImportMode.Multiple;
        importer.spritePixelsPerUnit = ppu;
        importer.filterMode = FilterMode.Point;                      // pixel art: no blur
        importer.textureCompression = TextureImporterCompression.Uncompressed;
        importer.mipmapEnabled = false;
        importer.SaveAndReimport();

        var factory = new SpriteDataProviderFactories();
        factory.Init();
        var provider = factory.GetSpriteEditorDataProviderFromObject(importer);
        provider.InitSpriteEditorDataProvider();
        var texProvider = provider.GetDataProvider<ITextureDataProvider>();
        texProvider.GetTextureActualWidthAndHeight(out int w, out int h); // real size, not Max Size
        Texture2D pixels = skipEmpty ? texProvider.GetReadableTexture2D() : null;

        string baseName = Path.GetFileNameWithoutExtension(path);
        int cols = (w - offX + padX) / (cellW + padX);               // whole cells only
        int rows = (h - offY + padY) / (cellH + padY);
        var rects = new List<SpriteRect>();
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                int x = offX + c * (cellW + padX);
                int yFromTop = offY + r * (cellH + padY);
                var rect = new Rect(x, h - yFromTop - cellH, cellW, cellH); // Unity rects start bottom-left
                if (pixels != null && IsEmpty(pixels, rect)) continue;
                rects.Add(new SpriteRect
                {
                    name = baseName + "_" + rects.Count,
                    spriteID = GUID.Generate(),
                    rect = rect,
                    alignment = SpriteAlignment.BottomCenter,          // feet on the ground
                    pivot = new Vector2(0.5f, 0f),
                });
            }

        provider.SetSpriteRects(rects.ToArray());
        // Unity 2021.2+: register each name with its ID so references survive a re-slice.
        var names = provider.GetDataProvider<ISpriteNameFileIdDataProvider>();
        names.SetNameFileIdPairs(rects.Select(s => new SpriteNameFileIdPair(s.name, s.spriteID)).ToList());
        provider.Apply();
        importer.SaveAndReimport();
        return rects.Count;
    }

    static bool IsEmpty(Texture2D tex, Rect r)
    {
        foreach (var c in tex.GetPixels((int)r.x, (int)r.y, (int)r.width, (int)r.height))
            if (c.a > 0f) return false;
        return true;
    }

    // One clip from frame indices, e.g. BuildClip(sheet, "Assets/Anim/Walk.anim", new[] {0, 1}, 8).
    public static AnimationClip BuildClip(string sheetPath, string clipPath, int[] frames, float fps, bool loop = true)
    {
        string baseName = Path.GetFileNameWithoutExtension(sheetPath);
        var sprites = AssetDatabase.LoadAllAssetsAtPath(sheetPath).OfType<Sprite>().ToDictionary(s => s.name);
        var keys = new ObjectReferenceKeyframe[frames.Length];
        for (int i = 0; i < frames.Length; i++)   // one key per frame; Unity adds 1/fps after the last key
            keys[i] = new ObjectReferenceKeyframe { time = i / fps, value = sprites[baseName + "_" + frames[i]] };

        var clip = new AnimationClip { frameRate = fps };
        var binding = EditorCurveBinding.PPtrCurve("", typeof(SpriteRenderer), "m_Sprite");
        AnimationUtility.SetObjectReferenceCurve(clip, binding, keys);
        var settings = AnimationUtility.GetAnimationClipSettings(clip);
        settings.loopTime = loop;
        AnimationUtility.SetAnimationClipSettings(clip, settings);
        AssetDatabase.CreateAsset(clip, clipPath);
        return clip;
    }
}
```

메뉴 항목이나 배치 모드의 `-executeMethod`에서 `SpriteSheetSlicer.Slice("Assets/Art/characters.png", 24, 24, 1, 1, 0, 0, 24f)`처럼 호출합니다. 키는 클립 `frameRate` 기준으로 한 프레임 간격입니다. 두 프레임을 8fps로 만든 클립은 길이가 0.25초이고 프레임마다 0.125초씩 보입니다.

> **팁:** Sprite Editor는 사각형을 왼쪽 아래 기준으로 저장하지만 그림 도구는 왼쪽 위부터 셉니다. 스크립트에서 `y`를 변환하는 이유가 이것입니다. 이 변환이 틀리면 줄 순서가 뒤집힙니다.

:::nerulio ws=sprite
Nerulio Studio는 그리드를 대신 찾아 줍니다. Sprite 작업 공간에 시트를 넣으면 픽셀에서 칸 크기, 여백, 간격을 측정해 신뢰도와 대안을 함께 보여 줍니다. 적용하기 전에 잘린 모양을 모두 확인할 수 있고, 타임라인에서 프레임별 길이를 가진 애니메이션 태그를 붙일 수 있습니다. **Pack & Export → Unity 6**은 아틀라스 PNG, `.unity.json`, `Editor/NerulioSpriteImporter.cs`를 만들어 줍니다. Unity에서 **Tools → Nerulio → Import Studio JSON**을 실행하면 Sprite / Multiple / Point / 무압축 설정, 피벗이 들어간 프레임별 스프라이트, 태그마다 `.anim` 클립 하나가 만들어집니다.
- Unity 6000.5.3f1 배치 모드에서 사각형, 피벗, 픽셀, 클립 키와 길이를 검증했습니다(Studio의 내보내기 줄에 표시).
- Pixels Per Unit은 100으로 기록됩니다. 프로젝트가 16이나 32를 쓴다면 임포트 전에 `.unity.json`의 `pixelsPerUnit` 값을 고치세요.
- Sprite Editor와 마찬가지로 2D Sprite 패키지가 필요합니다. 모든 작업은 브라우저 안에서 이루어지고 시트는 업로드되지 않습니다.
:::

![Nerulio Pack & Export의 엔진 대상 목록에 Unity 6이 있고, 내보내기 버튼 아래에 검증 문구가 표시된 화면](shot:studio-pack-export "Pack & Export에서 Unity 6을 고르면 임포터 스크립트가 함께 들어 있는 번들이 나옵니다.")

## FAQ {#faq}

### Sprite Editor 창을 쓸 수 없다는 메시지가 나옵니다. 왜 그런가요?

Sprite Editor는 **2D Sprite** 패키지(`com.unity.2d.sprite`)에 들어 있습니다. 3D 템플릿으로 만든 프로젝트에는 없을 수 있으니 **Window → Package Manager → Unity Registry**에서 설치하세요. 텍스처의 **Texture Type**도 **Sprite (2D and UI)**여야 합니다.

### 잘린 프레임이 1~2픽셀씩 밀려 있습니다. 왜 그런가요?

시트에 프레임 사이 간격이 있는데 **Padding**이 0이면 열마다 1픽셀씩 더 밀립니다. **Padding**에 간격을, **Offset**에 바깥 여백을 넣고 `offset + columns × cell + (columns − 1) × padding`이 이미지 너비와 같은지 확인하세요.

### Unity 6에서 애니메이션 속도는 어디서 바꾸나요?

Animation 창의 옵션 메뉴에서 **Show Sample Rate**를 켜고 **Samples**를 바꿉니다. 스프라이트를 Scene에 끌어다 만든 클립은 12에서 시작합니다. 특정 상태만 빠르게 하려면 Animator 창에서 그 상태의 **Speed**를 바꾸세요.

### 애니메이션이 반복되지 않거나, 한 번만 나와야 하는데 반복됩니다.

반복 여부는 `.anim` 에셋의 **Loop Time** 체크박스로 정합니다. 스프라이트를 끌어다 만든 클립은 켜져 있습니다. 한 번만 재생할 동작은 끄고, **Has Exit Time**이 있는 Animator 전이로 대기 상태로 돌아가게 하세요.

### Aseprite 파일을 바로 가져올 수는 없나요?

가능합니다. Unity 6에는 `.aseprite` 파일을 태그별 클립과 함께 가져오는 2D Aseprite Importer 패키지가 있습니다. 잘린 PNG와 결과가 어떻게 다른지는 [Godot, Unity, Phaser에서 Aseprite 파일 쓰기](guide:aseprite-files-godot-unity-phaser)에서 비교합니다.

## 출처 {#sources}

- Unity 6.5 Manual — [Cut out sprites from a texture](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/use-editor.html)
- Unity 6.5 Manual — [Sprite Editor window reference](https://docs.unity3d.com/6000.5/Documentation/Manual/sprite/sprite-editor/sprite-editor-window-reference.html)
- Unity 6.5 Manual — [Sprite (2D and UI) texture Import Settings reference](https://docs.unity3d.com/6000.5/Documentation/Manual/texture-type-sprite.html)
- 2D Sprite 패키지 1.0 — [Sprite Editor Data Provider API](https://docs.unity3d.com/Packages/com.unity.2d.sprite@1.0/manual/DataProvider.html)
- Unity 6.5 Scripting API — [TextureImporter.spritesheet](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/TextureImporter-spritesheet.html)
- Unity 6.5 Scripting API — [AnimationUtility.SetObjectReferenceCurve](https://docs.unity3d.com/6000.5/Documentation/ScriptReference/AnimationUtility.SetObjectReferenceCurve.html)
- Unity 6.5 Manual — [Create a new Animation Clip](https://docs.unity3d.com/6000.5/Documentation/Manual/animeditor-CreatingANewAnimationClip.html)
- 테스트 그림: [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer), [HQ Trooper (drakzlin)](https://opengameart.org/content/space-soldier-resize-64x64), 모두 CC0
