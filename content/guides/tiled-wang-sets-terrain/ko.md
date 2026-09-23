Tiled의 오토타일은 **터레인 세트(terrain set)** 로 만들며, 파일 형식에서는 Wang 세트라고 부릅니다. 타일셋을 열고 **Terrain Sets** 버튼을 누른 뒤 **Corner**, **Edge**, **Mixed** 중 하나로 세트를 추가하고, 터레인 색을 만들어 각 타일의 모서리나 변에 칠합니다. 그다음 **Terrain Brush**(`T`)로 맵을 칠하면 됩니다. 터레인 규칙은 Tiled 안에만 남고, 엔진은 Tiled가 놓은 타일을 불러올 뿐입니다. Phaser는 JSON 맵에 타일셋이 **임베드**되어 있어야 하고, Tiled 내장 Godot 4 내보내기는 터레인 데이터 없이 타일만 굽지만 YATI 임포터는 Wang 세트를 진짜 Godot 터레인 세트로 바꿔 줍니다.

아래 내용은 모두 Tiled 1.12.2 명령줄, Chromium에서 돌린 Phaser 3.90.0·4.2.1, Godot 4.7.2로 확인했습니다.

![Mixed 터레인 세트로 칠한 Tiled 맵을 Phaser로 그린 모습](shot:engine-phaser-tiled-wang "Chromium의 Phaser 3.90.0으로 렌더링(Phaser 4.2.1도 픽셀까지 동일): 47타일 Mixed 터레인 세트로 칠한 Tiled 1.12.2 맵을 tiled --embed-tilesets --export-map json으로 내보낸 것. 아트: OpenGameArt의 \"second\"가 만든 CC0 동굴 47타일 시트.")

## Corner, Edge, Mixed 중 알맞은 세트 고르기 {#set-types}

터레인 세트는 타일의 어느 부분이 어느 터레인인지 적어 둔 것입니다. 세트 유형에 따라 표시할 수 있는 부분이 정해집니다.

| 세트 유형 | 표시하는 곳 | 터레인 2개 완전한 세트 | 주로 쓰는 아트 |
|---|---|---|---|
| Corner Set | 모서리 4곳 | 16장 | 잔디/모래 전환, 듀얼 그리드 아트 |
| Edge Set | 변 4곳 | 16장 | 길, 울타리, 파이프, 발판 |
| Mixed Set | 모서리와 변 | 256장(또는 줄인 47타일 블롭) | 47타일 "블롭" 시트 |

안쪽·바깥 모서리가 있는 47타일 시트라면 Mixed입니다. 경계선이 타일 한가운데를 지나는 16타일 시트라면 Corner입니다. 유형을 잘못 골랐다면 나중에 세트를 오른쪽 클릭해 **Terrain Set Properties…** 에서 바꿀 수 있습니다. 터레인 세트 하나에는 터레인을 254개까지 넣을 수 있습니다.

## 터레인 세트 만들기 {#setup}

:::steps
1. **타일셋 열기.** 맵에서 타일셋을 고르고 Tilesets 뷰 아래의 **Edit Tileset**을 누릅니다(또는 `.tsx`를 엽니다).
2. **터레인 모드로 전환.** 타일셋 툴바의 **Terrain Sets** 버튼을 누르면 세트를 추가하는 버튼이 있는 Terrain Sets 뷰가 나타납니다.
3. **세트 추가.** **Corner Set**, **Edge Set**, **Mixed Set** 중 하나를 추가하고 이름을 붙입니다. 타일을 오른쪽 클릭해 **Use as Terrain Set Image**를 고르면 아이콘이 됩니다.
4. **터레인 추가.** 세트에는 터레인이 하나 기본으로 들어 있습니다. 더 필요하면 **Add Terrain**을 누르고, 더블클릭으로 이름을 바꾸고, 오른쪽 클릭 → **Pick Custom Color**로 색을 바꿉니다. "빈칸"용 터레인은 필요 없습니다. 빈 부분은 표시하지 않으면 됩니다.
5. **타일에 표시하기.** 터레인을 고르고, 각 타일에서 그 터레인에 속하는 모서리/변을 클릭하거나 드래그합니다. 실수는 **Erase Terrain**이나 `Ctrl+Z`로 고칩니다.
6. **Patterns 탭 확인.** **Terrains** 옆 **Patterns** 탭에서는 이미 타일이 있는 패턴이 어둡게 표시되므로, 빠진 패턴이 눈에 띕니다.
7. **칠하기.** 터레인 모드를 끄고 맵 에디터에서 **Terrain Sets** 창을 연 다음, 터레인을 골라 **Terrain Brush**(`T`)로 칠합니다. `Shift`는 직선, `Ctrl`은 브러시를 타일 한 칸 크기로 키웁니다.
:::

저장된 `.tsx`에서 각 타일은 숫자 8개짜리 `wangid`를 가집니다. 순서는 위, 오른쪽 위, 오른쪽, 오른쪽 아래, 아래, 왼쪽 아래, 왼쪽, 왼쪽 위이고, `0`은 터레인 없음입니다.

```xml
<wangsets>
 <wangset name="cave" type="mixed" tile="47">
  <wangcolor name="Rock" color="#e8a33d" tile="47" probability="1"/>
  <!-- tile 20: open at the top, rock to the right, below and left -->
  <wangtile tileid="20" wangid="0,0,1,1,1,1,1,0"/>
 </wangset>
</wangsets>
```

## 칠하기: 브러시, 채우기 모드, 확률 {#painting}

- **칠해도 아무 일이 없나요?** 세트에 "터레인→빈칸" 타일이 없으면, 빈 맵에서는 브러시가 전환할 대상이 없습니다. `Ctrl`을 누르고 타일 한 칸을 통째로 칠하거나, 먼저 바탕 터레인을 버킷으로 채우세요. 빈칸으로 전환되는 세트라면 **Erase Terrain**이 터레인을 지우면서 이웃 타일도 고쳐 줍니다.
- **Terrain Fill Mode.** Stamp Brush, Bucket Fill, Shape Fill에는 *Terrain Fill Mode*가 있어, 주변과 맞물리는 타일을 무작위로 골라 영역을 채웁니다.
- **변형 타일.** 패턴이 같은 타일이 여러 장이면 무작위로 고릅니다. 타일과 터레인마다 **Probability**가 있으며, 타일이 뽑힐 가능성은 타일 자신의 확률에 표시된 각 모서리/변 터레인의 확률을 곱한 값입니다. 확률을 `0`으로 두면 자동 배치에서는 빠지지만 Tiled는 그 타일의 터레인을 계속 인식합니다.
- **변환.** **Tileset Properties**에서 뒤집기와 회전을 허용하면, Tiled가 빠진 패턴을 회전한 타일로 만들어 씁니다. **Prefer Untransformed Tiles**를 켜면 원본 타일이 우선입니다.
- **블롭 세트의 외톨이 타일.** 터레인이 하나인 블롭 세트에서 외톨이 타일은 8곳 모두 터레인이 없습니다. Wang ID가 전부 0이라 Tiled는 이를 "터레인 없음"으로 보고 세트에 넣지 않습니다(위 47타일 세트의 Wang 타일은 46장입니다). 그래서 브러시는 외톨이 한 칸을 절대 놓지 않습니다. 손으로 놓거나, 바탕용 터레인을 하나 더 두세요.

## Phaser로 내보내기(Tiled JSON) {#phaser}

Phaser는 Tiled의 JSON 맵을 읽지만 **외부 타일셋은 읽지 못합니다**. 맵이 `.tsx`를 참조하면 Phaser 3.90.0과 4.2.1 모두 `External tilesets unsupported. Use Embed Tileset and re-export`를 출력한 뒤, 레이어를 만들다가 오류를 냈습니다. 해결 방법은 세 가지입니다.

- 맵에서 타일셋을 고르고 Tilesets 뷰의 **Embed Tileset**을 누릅니다.
- 또는 *Edit > Preferences > General > Export Options*의 **Embed tilesets**를 켭니다. 맵 파일은 외부 타일셋을 그대로 쓰고, 내보낼 때만 임베드합니다.
- 또는 명령줄로 내보냅니다.

```shell
tiled --embed-tilesets --export-map json level.tmx level.tmj
```

그리고 불러옵니다.

```js
// game.js - load a Tiled JSON map (exported with embedded tilesets) and draw it.
class Level extends Phaser.Scene {
  preload() {
    this.load.tilemapTiledJSON('level', 'assets/level.tmj');
    this.load.image('cave', 'assets/autotile47.png');
  }
  create() {
    const map = this.make.tilemap({ key: 'level' });
    // 1st argument: the tileset name as written in Tiled; 2nd: the image key loaded above
    const tiles = map.addTilesetImage('autotile47', 'cave');
    map.createLayer('Terrain', tiles, 0, 0);
  }
}

new Phaser.Game({ type: Phaser.WEBGL, width: 896, height: 704, pixelArt: true, scene: Level });
```

임베드된 타일셋의 JSON에도 `wangsets`가 들어 있지만, Phaser는 실행 중에 오토타일을 하지 않고 Tiled가 저장한 타일 ID를 그대로 그립니다. 타일셋에 여백(margin)이나 간격(spacing)이 있다면(예: 이음새를 막으려고 익스트루드한 경우) `addTilesetImage(name, key, tileWidth, tileHeight, tileMargin, tileSpacing)`의 5번째, 6번째 인자로 넘깁니다.

## Godot 4로 내보내기 {#godot}

방법은 두 가지이고, 결과가 다릅니다.

| 방법 | 만들어지는 노드 | Godot의 터레인 데이터 | 측정 결과(Godot 4.7.2) |
|---|---|---|---|
| Tiled 자체 **File > Export As…** → *Godot 4 Scene files (\*.tscn)* (Tiled 1.10부터) | `TileMap`(Godot 4.3부터 폐지 예정) | 없음 | 불러와지고 58칸이 그려지지만 **터레인 세트 0개** |
| [YATI](https://github.com/Kiamo2/YATI) 2.2.7 임포트 플러그인(`.tmx`/`.tmj`) | `TileMapLayer` | Wang 세트 → 피어링 비트가 있는 터레인 세트 | 터레인 세트 1개(Match Corners and Sides), 46/46 타일에 터레인, 58칸을 `set_cells_terrain_connect`로 다시 칠하면 Tiled와 같은 타일 |

Tiled의 내보내기는 `.tscn`, 타일셋 이미지, `project.godot`가 한 폴더 계층 안에 있어야 하며, 상위 폴더에서 `.godot` 파일을 찾아 `res://` 경로를 정합니다. 완성된 맵만 필요하면 이것으로 충분합니다. Godot의 **Terrains** 탭으로 계속 칠하거나 `set_cells_terrain_connect()`를 쓰고 싶다면 YATI로 가져오세요. `addons/YATI`를 프로젝트에 복사하고 **Project Settings → Plugins**에서 켠 뒤 `.tmx`를 넣으면 됩니다. YATI 2.x는 Godot 4.3 이상이 필요합니다. 가져온 터레인 세트가 어떻게 동작하는지는 [Godot 4 터레인 오토타일](guide:godot-4-terrain-autotile-47-blob)을 참고하세요.

## Unity로 내보내기 {#unity}

Unity에는 자체 Tiled 임포터가 없습니다. [SuperTiled2Unity](https://seanba.itch.io/supertiled2unity)(무료 또는 원하는 금액)는 `.tmx`를 Unity Tilemap 기반 프리팹으로 가져오며, Tiled가 놓은 타일을 그대로 씁니다. 문서에는 Tiled 터레인 세트를 Rule Tile로 바꿔 준다는 설명이 없으므로, Unity *안에서* 오토타일을 하려면 Rule Tile을 설정하세요. [Unity Rule Tile 오토타일](guide:unity-rule-tile-autotile)을 참고하세요.

## 대안: LDtk {#ldtk}

[LDtk](https://ldtk.io/)는 접근 방식이 다릅니다. **IntGrid** 레이어(칸에 1, 2, 3… 값을 칠함)를 칠하면 **오토 레이어 규칙**(작은 그리드 패턴)이 어느 타일을 놓을지 정합니다. 규칙을 결과 옆에서 바로 보고 고칠 수 있지만, 규칙은 LDtk 안에 남습니다. 내보낸 JSON에는 결과 타일(`autoLayerTiles`)이 들어가고 엔진은 그것을 그립니다. 현재 릴리스는 LDtk 1.5.3입니다. Tiled의 오브젝트 도구, 다양한 방향(아이소메트릭, 헥사곤, 1.12부터 oblique), 넓은 엔진 지원이 필요하면 Tiled를, 규칙 기반 레벨 디자인과 타입이 있는 엔티티를 원하면 LDtk를 고르세요.

:::nerulio ws=tile
Nerulio가 Tiled 터레인 세트를 대신 써 줍니다. 타일 시트를 Tile 작업 공간에 넣으면 픽셀에서 배치를 알아내고(47타일 블롭의 여러 순서, 16타일 변/모서리 세트, RPG 쯔꾸르 A2 소스) 신뢰도를 보여 준 뒤, 모든 타일에 터레인을 표시합니다.
- **Export → Tiled**는 PNG, Mixed·Edge·Corner Wang 세트(터레인마다 색 하나)가 든 `.tsx`, 그 세트로 칠한 `sample.tmx`를 줍니다. Tiled 1.12.2의 명령줄 내보내기로 모든 Wang ID가 쓴 그대로 읽히는 것을 확인했습니다(Terrain Brush 자체는 구동하지 않았습니다).
- **Test map**을 **Tiled** 규칙으로 그리면 Terrain Brush가 만들 결과와, 브러시가 놓지 못하는 외톨이 칸까지 미리 볼 수 있습니다.
- 같은 세트를 Godot 4(터레인 세트, 4.7.2에서 검증), LDtk 1.5.3(IntGrid + 규칙, 일부 검증), Unity(RuleTile, 6000.5.3f1에서 검증)로도 내보냅니다.
:::

![엔진 규칙으로 그린 Nerulio 테스트 맵](shot:studio-tile-map "Nerulio Tile 작업 공간: 동굴 세트로 그린 테스트 맵. 엔진 규칙 전환(Godot 4 / Tiled)과 칠한 칸 전체를 검사한 결과가 보입니다.")

## 자주 묻는 질문 {#faq}

### Tiled의 터레인과 Wang 세트는 같은 건가요? {#faq-1}
네. Tiled 1.5에서 예전 터레인과 Wang 타일이 하나로 합쳐졌습니다. 에디터에서는 터레인 세트라고 부르고, TMX/JSON 파일에는 타일마다 `wangid`가 있는 `wangsets`로 저장됩니다.

### Phaser가 "External tilesets unsupported"라고 하는 이유는 무엇인가요? {#faq-2}
JSON 맵이 타일셋을 담지 않고 `.tsx`/`.tsj` 파일을 참조하기 때문입니다. Tiled에서 **Embed Tileset**을 누르거나, 내보내기 옵션의 **Embed tilesets**를 켜거나, `tiled --embed-tilesets --export-map json`으로 내보내세요.

### Godot에서 Tiled의 터레인 규칙이 유지되나요? {#faq-3}
Tiled 내장 Godot 4 내보내기로는 유지되지 않습니다. 터레인 세트 없이 구운 타일을 TileMap 노드에 씁니다. YATI 임포터는 Wang 세트를 TileMapLayer 노드의 Godot 터레인 세트로 바꿔 주므로 계속 터레인으로 칠할 수 있습니다.

### 47타일 타일셋에는 어떤 세트 유형이 필요한가요? {#faq-4}
Mixed입니다. Corner와 Edge 세트는 터레인 2개일 때 16장입니다. 47타일 블롭은 모서리와 변을 모두 봐야 하며, Tiled 매뉴얼에서도 Mixed 세트의 축소판으로 소개합니다.

### Tiled가 게임 실행 중에 오토타일을 해 주나요? {#faq-5}
아닙니다. 터레인 브러시는 에디터에서만 동작하고, 엔진은 브러시가 놓은 타일 ID를 불러옵니다. 실행 중 오토타일은 엔진 자체 기능(Godot 터레인, Unity Rule Tile)이나 직접 짠 코드로 해야 합니다.

## 참고 자료 {#sources}

- [Using Terrains — Tiled 1.12 documentation](https://doc.mapeditor.org/en/stable/manual/terrain/) (세트 유형, 타일 표시, Patterns 뷰, Terrain Fill Mode, 확률, 변환)
- [Editing Tile Layers — Terrain Brush (Tiled)](https://doc.mapeditor.org/en/stable/manual/editing-tile-layers/#terrain-tool)
- [Preferences — Export Options (Tiled)](https://doc.mapeditor.org/en/stable/manual/preferences/#export-options) (Embed tilesets)
- [Godot 4 export (Tiled)](https://doc.mapeditor.org/en/stable/manual/export-tscn/) (Tiled 1.10부터, `res://` 경로 결정)
- [Tilemap API — Phaser documentation](https://docs.phaser.io/api-documentation/class/tilemaps-tilemap) (`addTilesetImage`, `createLayer`), [LoaderPlugin.tilemapTiledJSON](https://docs.phaser.io/api-documentation/class/loader-loaderplugin)
- [YATI — Yet Another Tiled Importer for Godot 4](https://github.com/Kiamo2/YATI) (Reference.md: Wang 세트 → 터레인 세트 매핑)
- [SuperTiled2Unity documentation](https://supertiled2unity.readthedocs.io/)
- [LDtk auto-layer rules](https://ldtk.io/docs/general/auto-layers/auto-layer-rules/)
- 아트: [Cave platformer tileset 47](https://opengameart.org/content/cave-platformer-tileset-47) (CC0, OpenGameArt)
