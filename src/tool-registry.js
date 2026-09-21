/** Catalog metadata only: imported by both static build and runtime. ko/en/ja. */
export const TOOLS = Object.freeze({
  "refiner": {
    "path": "game-asset-pixelizer",
    "category": "game",
    "icon": "pixel",
    "title": [
      "게임 에셋 다듬기",
      "Game Asset Refiner",
      "ゲーム素材を調整"
    ],
    "description": [
      "배경 정리부터 정확한 픽셀 크기와 팔레트까지.",
      "Clean the background, fit an exact pixel canvas, and reduce its palette.",
      "背景の整理から正確なピクセルサイズ、減色まで。"
    ],
    "limit": [
      "단색 배경만 제거합니다. AI 생성이나 새 디테일 복원은 하지 않습니다.",
      "Solid-background cleanup only. No AI generation or reconstruction of detail.",
      "単色背景のみ除去。AI生成や細部の復元は行いません。"
    ],
    "next": [
      "sprite-sheet-maker",
      "palette-swap",
      "image"
    ]
  },
  "sprite-slicer": {
    "path": "sprite-slicer",
    "category": "game",
    "icon": "scissors",
    "title": [
      "스프라이트 자동 분리",
      "Sprite Sheet Slicer",
      "スプライトを分割"
    ],
    "description": [
      "투명 영역으로 프레임을 찾고 직접 수정한 뒤 PNG로 분리하세요.",
      "Find alpha-connected frame candidates, review their boxes, and export PNGs.",
      "透明部分からフレーム候補を検出し、範囲を修正してPNGに分割。"
    ],
    "limit": [
      "떨어진 신체·소품은 별도 후보가 될 수 있습니다. 겹친 캐릭터를 의미적으로 구분하지 않습니다.",
      "Disconnected parts may become separate candidates. Overlapping characters are not semantically separated.",
      "離れた部品は別候補になります。重なったキャラクターの意味的な分離はできません。"
    ],
    "next": [
      "frame-normalize",
      "sprite-sheet-maker",
      "palette-swap"
    ]
  },
  "frame-normalize": {
    "path": "normalize-sprite-frames",
    "category": "game",
    "icon": "resize",
    "title": [
      "프레임 캔버스 통일",
      "Normalize Sprite Frames",
      "フレームサイズを統一"
    ],
    "description": [
      "여러 PNG의 투명 여백을 정리하고 같은 캔버스에 정렬하세요.",
      "Trim transparent margins and align multiple PNGs on equal canvases.",
      "複数PNGの透明余白を除き、同じキャンバスに揃えます。"
    ],
    "limit": [
      "발 위치 인식이 아닌 경계 상자 정렬입니다. 원본 프레임을 확대하지 않습니다.",
      "Bounding-box alignment, not foot detection. Frames are not enlarged.",
      "足の検出ではなく境界の位置合わせです。フレームは拡大しません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "sprite-sheet-maker": {
    "path": "sprite-sheet-maker",
    "category": "game",
    "icon": "pack",
    "title": [
      "스프라이트 시트 만들기",
      "Sprite Sheet Maker",
      "スプライトシート作成"
    ],
    "description": [
      "프레임 순서·열 수·여백을 정하고 PNG와 좌표 JSON을 만드세요.",
      "Arrange frames, set columns and padding, and export a PNG plus coordinate JSON.",
      "順序・列数・余白を指定し、PNGと座標JSONを作成。"
    ],
    "limit": [
      "균일 격자 배치입니다. 회전 패킹이나 엔진 전용 리소스는 생성하지 않습니다.",
      "Uniform grid packing only. No rotated packing or engine-specific resource generation.",
      "均等なグリッド配置です。回転パッキングやエンジン専用リソースは生成しません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "palette-swap": {
    "path": "palette-swap",
    "category": "game",
    "icon": "sliders",
    "title": [
      "팔레트 색 교체",
      "Palette Swap",
      "パレットの色を置換"
    ],
    "description": [
      "추출한 색을 선택해 정확한 색 또는 비슷한 색을 교체하세요.",
      "Pick an extracted color and replace exact or similar colors.",
      "抽出した色を選び、一致する色や近い色を置き換えます。"
    ],
    "limit": [
      "명암 보존은 밝기 차이를 더하는 근사입니다. 재질을 이해하는 변환은 아닙니다.",
      "Shading uses a luminance-offset approximation, not material-aware recoloring.",
      "陰影保持は明度差を加える近似で、材質を認識する変換ではありません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "marketplace-pack": {
    "path": "marketplace-image-pack",
    "category": "image",
    "icon": "pack",
    "title": [
      "상품 이미지 묶음",
      "Marketplace Image Pack",
      "商品画像パック"
    ],
    "description": [
      "Etsy·Shopify용 이미지와 사용자 크기를 폴더별 ZIP으로 만드세요.",
      "Create folder-organized Etsy, Shopify and custom-size image ZIPs.",
      "Etsy・Shopify向けと任意サイズの画像をフォルダ別ZIPに。"
    ],
    "limit": [
      "현재 검증한 Etsy·Shopify 프리셋만 제공합니다. 상품 등록 승인이나 모든 테마 호환을 보장하지 않습니다.",
      "Only verified Etsy and Shopify presets are offered. Listing approval and compatibility with every theme are not guaranteed.",
      "確認済みのEtsy・Shopify設定のみ提供。出品承認や全テーマへの適合は保証しません。"
    ],
    "next": [
      "compress",
      "convert"
    ]
  },
  "print-pack": {
    "path": "etsy-print-size-generator",
    "category": "image",
    "icon": "pack",
    "title": [
      "인쇄 비율 묶음",
      "Print Ratio Pack",
      "印刷比率パック"
    ],
    "description": [
      "2:3·3:4·4:5·11:14·A계열 비율의 이미지를 한 번에 만드세요.",
      "Export 2:3, 3:4, 4:5, 11:14 and A-series aspect ratios together.",
      "2:3・3:4・4:5・11:14・A判の比率をまとめて出力。"
    ],
    "limit": [
      "픽셀 출력입니다. 인쇄 크기·DPI·색상 프로필을 보장하지 않으며 비율에는 픽셀 반올림이 적용됩니다.",
      "Pixel outputs, not guaranteed print sizes, DPI or color profiles. Ratios are rounded to whole pixels.",
      "ピクセル出力です。印刷寸法・DPI・色管理は保証せず、比率は整数ピクセルに丸めます。"
    ],
    "next": [
      "compress",
      "convert"
    ]
  },
  "logo-bg": {
    "path": "remove-white-background-from-logo",
    "category": "image",
    "icon": "background",
    "title": [
      "로고 흰 배경 제거",
      "Remove White Logo Background",
      "ロゴの白背景を除去"
    ],
    "description": [
      "테두리와 연결된 단색 배경을 제거하고 내부 흰색을 보존하세요.",
      "Remove border-connected solid background while retaining enclosed white regions.",
      "外周につながる単色背景を除去し、内側の白い領域を残します。"
    ],
    "limit": [
      "내부 흰색이 배경과 연결되어 있으면 함께 제거됩니다. 반투명 가장자리의 색 번짐은 남을 수 있습니다.",
      "White regions connected to the border are also removed. Color fringes may remain on translucent edges.",
      "外周とつながる白い部分も除去されます。半透明の縁に色が残る場合があります。"
    ],
    "next": [
      "favicon-pack",
      "resize",
      "convert"
    ]
  },
  "bitmap-font": {
    "path": "bitmap-font-maker",
    "category": "game",
    "icon": "text",
    "title": [
      "비트맵 폰트 만들기",
      "Bitmap Font Maker",
      "ビットマップフォント作成"
    ],
    "description": [
      "격자형 폰트 시트와 문자 순서로 PNG·BMFont·JSON을 만드세요.",
      "Turn a grid font sheet and character order into PNG, BMFont and JSON.",
      "格子状の文字画像と文字順からPNG・BMFont・JSONを作成。"
    ],
    "limit": [
      "고정 폭 격자 전용입니다. 커닝·가변 폭·Godot 리소스 자동 생성은 지원하지 않습니다.",
      "Fixed-cell grids only. No kerning, variable advance or automatic Godot resource generation.",
      "固定幅グリッドのみ。カーニング・可変幅・Godotリソースの自動生成は非対応。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "mask-packer": {
    "path": "texture-mask-packer",
    "category": "game",
    "icon": "sliders",
    "title": [
      "RGBA 마스크 패킹",
      "RGBA Mask Packer",
      "RGBAマスクを結合"
    ],
    "description": [
      "같은 크기 이미지의 밝기를 R·G·B·A에 원하는 순서로 넣으세요.",
      "Map luminance from equally sized images into your chosen RGBA channels.",
      "同じサイズの画像の明度をR・G・B・Aに割り当てます。"
    ],
    "limit": [
      "입력 크기가 같아야 합니다. 색 관리 없는 캔버스의 바이트 밝기를 사용합니다.",
      "Input dimensions must match. Uses Canvas byte luminance without a linear-color workflow.",
      "入力寸法は一致必須。リニア色空間変換なしでCanvasの明度値を使用します。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "atlas-padding": {
    "path": "atlas-padding",
    "category": "game",
    "icon": "resize",
    "title": [
      "아틀라스 가장자리 확장",
      "Atlas Edge Extrusion",
      "アトラスの縁を拡張"
    ],
    "description": [
      "격자 타일의 가장자리 픽셀을 확장하고 새 좌표 JSON을 만드세요.",
      "Extrude grid-tile edges and export updated atlas coordinates.",
      "格子タイルの縁を伸ばし、新しい座標JSONを出力。"
    ],
    "limit": [
      "격자 타일만 지원합니다. 출력 크기와 UV 좌표가 바뀌며 UV 베이크는 수행하지 않습니다.",
      "Grid tiles only. Output dimensions and UV positions change; no UV baking is performed.",
      "格子タイルのみ。出力寸法とUV位置は変わり、UVベイクは行いません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "texture-map": {
    "path": "normal-map-generator",
    "category": "game",
    "icon": "sliders",
    "title": [
      "텍스처 맵 실험실",
      "Texture Map Lab",
      "テクスチャマップ調整"
    ],
    "description": [
      "밝기·알파 추출·반전과 높이 기울기 기반 노멀 맵을 만드세요.",
      "Create grayscale, alpha, inverted and height-gradient normal maps.",
      "グレー・アルファ抽出・反転・高さ勾配によるノーマルマップを作成。"
    ],
    "limit": [
      "노멀 맵은 이미지 밝기를 높이로 간주한 근사입니다. 실제 지형이나 PBR 재질을 복원하지 않습니다.",
      "Normals approximate image luminance as height; they do not reconstruct geometry or PBR materials.",
      "明度を高さとした近似で、実際の形状やPBR材質を復元しません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "tile-helper": {
    "path": "tile-grid-slicer",
    "category": "game",
    "icon": "crop",
    "title": [
      "타일 격자 분리",
      "Tile Grid Slicer",
      "タイルを格子で分割"
    ],
    "description": [
      "타일 크기를 지정해 격자 PNG를 개별 이미지로 분리하세요.",
      "Split a tile grid into individual PNGs at an exact tile size.",
      "タイルの大きさを指定し、格子画像を個別PNGに分割。"
    ],
    "limit": [
      "이미지 크기를 나누어떨어지게 하는 타일 크기가 필요합니다. 자동 타일 규칙은 만들지 않습니다.",
      "Tile size must divide the image exactly. Autotile rules are not generated.",
      "画像を割り切れるタイルサイズが必要です。オートタイル規則は生成しません。"
    ],
    "next": [
      "refiner",
      "sprite-sheet-maker"
    ]
  },
  "scan-split": {
    "path": "split-scanned-images",
    "category": "image",
    "icon": "scissors",
    "title": [
      "스캔 이미지 양쪽 분리",
      "Split Scanned Images",
      "見開き画像を分割"
    ],
    "description": [
      "분리 위치와 좌우 순서를 지정해 스캔 이미지 두 장을 만드세요.",
      "Set a divider and reading order to split a scanned image in two.",
      "分割位置と左右の順を指定し、見開き画像を2枚に分けます。"
    ],
    "limit": [
      "이미지 입력만 지원합니다. PDF 분리·자동 제본선 감지·기울기 보정은 수행하지 않습니다.",
      "Image input only. No PDF splitting, automatic gutter detection or deskew.",
      "画像入力のみ。PDF分割・綴じ目の自動検出・傾き補正は行いません。"
    ],
    "next": [
      "compress",
      "convert"
    ]
  },
  "margin-crop": {
    "path": "auto-crop-image-margins",
    "category": "image",
    "icon": "crop",
    "title": [
      "이미지 여백 자르기",
      "Crop Image Margins",
      "画像の余白を切り抜き"
    ],
    "description": [
      "흰색 기준값으로 여백을 찾고 결과를 확인한 뒤 저장하세요.",
      "Detect margins with a white threshold; review the crop before saving.",
      "白色しきい値から余白を検出し、結果を確認して保存。"
    ],
    "limit": [
      "밝은 내용이 배경으로 오인될 수 있습니다. PDF와 OCR은 지원하지 않습니다.",
      "Pale content may be mistaken for background. No PDF or OCR support.",
      "薄い内容を背景と誤認する場合があります。PDF・OCRには非対応。"
    ],
    "next": [
      "compress",
      "convert"
    ]
  },
  "favicon-pack": {
    "path": "favicon-generator",
    "category": "image",
    "icon": "pack",
    "title": [
      "파비콘·아이콘 묶음",
      "Favicon and Icon Pack",
      "ファビコン・アイコンパック"
    ],
    "description": [
      "PNG 로고로 ICO·앱 아이콘과 HTML·매니페스트 조각을 만드세요.",
      "Build ICO, app PNG icons and HTML/manifest snippets from a raster logo.",
      "PNGなどのロゴからICO・アプリアイコン・HTMLとマニフェストを作成。"
    ],
    "limit": [
      "SVG 입력과 벡터 출력은 지원하지 않습니다. 마스커블 아이콘이나 설치 가능한 앱을 자동 완성하지 않습니다.",
      "No SVG input or vector output. Does not create maskable icons or a complete installable app.",
      "SVG入力・ベクトル出力は非対応。マスカブルアイコンやインストール可能なアプリの全体は生成しません。"
    ],
    "next": [
      "compress",
      "convert"
    ]
  },
  "ui-lab": {
    "path": "game/ui-lab",
    "category": "game",
    "icon": "outline",
    "title": [
      "UI 에셋 랩",
      "UI Lab",
      "UIアセットラボ"
    ],
    "description": [
      "9슬라이스·버튼 상태·UI 아틀라스·비트맵 폰트를 한 화면에서 만들고 실제 화면 크기로 확인하세요.",
      "Build nine-slice panels, button states, UI atlases and bitmap fonts in one workspace, then check them at real screen sizes.",
      "9スライス・ボタン状態・UIアトラス・ビットマップフォントを一つの画面で作り、実際の画面サイズで確認。"
    ],
    "limit": [
      "PNG과 JSON, BMFont 텍스트만 만듭니다. .tres·.meta 같은 엔진 리소스 파일은 만들지 않고, 엔진 안에서의 렌더링은 확인하지 않았습니다.",
      "Writes PNG, JSON and BMFont text only. It never writes engine resource files (.tres, .meta), and rendering inside an engine was not verified here.",
      "出力はPNG・JSON・BMFontテキストのみ。.tresや.metaなどのエンジンリソースは生成せず、エンジン内での描画は検証していません。"
    ],
    "next": [
      "9-slice-editor",
      "bitmap-font",
      "sprite-sheet-maker"
    ]
  },
  "9-slice-editor": {
    "path": "game/9-slice-editor",
    "category": "game",
    "icon": "rect",
    "title": [
      "9슬라이스 편집기",
      "9-Slice Editor",
      "9スライスエディター"
    ],
    "description": [
      "패널 이미지의 네 경계선을 끌어 정하고, 여러 목표 크기로 늘린 결과를 바로 확인하세요.",
      "Drag the four borders of a panel image and see it drawn at several target sizes at once.",
      "パネル画像の4本の境界線をドラッグで決め、複数の目標サイズでの描画をその場で確認。"
    ],
    "limit": [
      "경계선 추천은 같은 열·행이 반복되는 구간을 찾는 휴리스틱입니다. 늘리기와 타일링은 브라우저 캔버스로 그립니다.",
      "Border suggestion is a heuristic that looks for repeated columns and rows. Stretching and tiling are drawn with the browser canvas.",
      "境界線の提案は同一の列・行が続く区間を探すヒューリスティックです。伸縮とタイルはブラウザのCanvasで描画します。"
    ],
    "next": [
      "ui-lab",
      "button-state-generator",
      "atlas-padding"
    ]
  },
  "button-state-generator": {
    "path": "game/button-state-generator",
    "category": "game",
    "icon": "sliders",
    "title": [
      "버튼 상태 만들기",
      "Button State Generator",
      "ボタン状態を生成"
    ],
    "description": [
      "버튼 하나로 기본·호버·누름·비활성·포커스 이미지를 만들고 낱장과 묶음 시트로 저장하세요.",
      "Turn one button image into normal, hover, pressed, disabled and focus variants, as single PNGs and one packed strip.",
      "1枚のボタン画像から通常・ホバー・押下・無効・フォーカスを作り、個別PNGとまとめたシートで保存。"
    ],
    "limit": [
      "밝기·대비·채도·색 겹치기·오프셋·외곽선 같은 정해진 픽셀 연산입니다. 없는 그림을 새로 그리지는 않습니다.",
      "Fixed pixel operations: brightness, contrast, saturation, colour overlay, offset and outline. It does not draw artwork that is not there.",
      "明度・コントラスト・彩度・色の重ね・オフセット・アウトラインという決まった画素処理です。ない絵を描き足すことはしません。"
    ],
    "next": [
      "ui-lab",
      "9-slice-editor",
      "sprite-sheet-maker"
    ]
  },
  "missing-glyph-checker": {
    "path": "game/missing-glyph-checker",
    "category": "game",
    "icon": "text",
    "title": [
      "빠진 글자 검사",
      "Missing Glyph Checker",
      "欠け文字チェック"
    ],
    "description": [
      "번역 텍스트나 .txt·.json·.csv·.po를 폰트의 글자 목록과 비교해 빠진 글자와 사용 위치를 찾으세요.",
      "Compare localisation text or a .txt/.json/.csv/.po file against a font's glyph list and find every missing character.",
      "翻訳テキストや.txt・.json・.csv・.poをフォントの文字一覧と比較し、欠けている文字と使用箇所を確認。"
    ],
    "limit": [
      "BMFont .fnt 파일이나 이 랩에서 만든 폰트의 글자 목록과 비교합니다. TTF·OTF의 cmap 표는 읽지 않습니다.",
      "Compares against a BMFont .fnt file or a font built in this Lab. It does not read the cmap table of a TTF or OTF.",
      "BMFontの.fntファイル、またはこのラボで作ったフォントの文字一覧と比較します。TTF・OTFのcmapテーブルは読みません。"
    ],
    "next": [
      "bitmap-font",
      "ui-lab",
      "ui-scale-preview"
    ]
  },
  "ui-scale-preview": {
    "path": "game/ui-scale-preview",
    "category": "game",
    "icon": "resize",
    "title": [
      "UI 해상도·배율 점검",
      "UI Scale Preview",
      "UI解像度・倍率プレビュー"
    ],
    "description": [
      "1280×720부터 4K까지, 정수 배율과 1.25·1.5·1.75배를 나란히 보고 글자 넘침과 명암비까지 확인하세요.",
      "See a UI element from 1280×720 to 4K, integer scales next to 1.25/1.5/1.75, plus text overflow and contrast numbers.",
      "1280×720から4Kまで、整数倍と1.25・1.5・1.75倍を並べて確認し、文字のはみ出しとコントラスト比もチェック。"
    ],
    "limit": [
      "앵커와 세이프 영역은 개념 시뮬레이션이며 엔진이 실제로 계산한 레이아웃이 아닙니다. 명암비는 WCAG 공식값으로, 디자인 판정이 아닙니다.",
      "Anchors and safe areas are a conceptual simulation, not a layout pass any engine ran. The contrast ratio is the WCAG formula, a reference number rather than a verdict.",
      "アンカーとセーフエリアは概念的なシミュレーションで、エンジンが実際に計算したレイアウトではありません。コントラスト比はWCAGの計算値で、デザインの合否判定ではありません。"
    ],
    "next": [
      "ui-lab",
      "9-slice-editor",
      "missing-glyph-checker"
    ]
  }
});
export const RECIPE_INTENTS = Object.fromEntries(Object.entries(TOOLS).map(([id,d]) => [id,{path:d.path,editor:"image",tool:"recipe",icon:d.icon,action:"recipe",accept:"image",next:d.next}]));
export const RECIPE_ALIASES = {"image-to-pixel-art":"refiner","32x32-pixel-art-converter":"refiner","etsy-image-resizer":"marketplace-pack","brand-icon-pack":"favicon-pack"};
