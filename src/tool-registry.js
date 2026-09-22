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
      "pixel-lab",
      "sprite-sheet-maker",
      "palette-swap"
    ]
  },
  "sprite-lab": {
    "path": "game/sprite-lab",
    "category": "game",
    "icon": "pack",
    "title": [
      "스프라이트 랩",
      "Sprite Lab",
      "スプライトラボ"
    ],
    "description": [
      "시트 한 장으로 자르기·정렬·애니메이션·기준점·히트박스·아틀라스까지 한 화면에서.",
      "Slice, align, animate, set pivots and hitboxes and pack an atlas — one sheet, one screen.",
      "1枚のシートで分割・整列・アニメ・基準点・ヒットボックス・アトラスまで1画面で。"
    ],
    "limit": [
      "떨어진 조각은 거리 기준으로 합칩니다. 겹친 캐릭터를 의미적으로 구분하지 않고, 회전 패킹은 지원하지 않습니다. Unity 가져오기는 검증되지 않았습니다.",
      "Detached parts are merged by distance. Overlapping characters are not semantically separated, rotated packing is not supported, and the Unity importer is UNVERIFIED.",
      "離れた部品は距離で結合します。重なったキャラクターの意味的な分離や回転パッキングには非対応で、Unityの取り込みは未検証です。"
    ],
    "next": [
      "sprite-sheet-maker",
      "palette-swap",
      "pixel"
    ]
  },
  "sprite-pivot-editor": {
    "path": "game/sprite-pivot-editor",
    "category": "game",
    "icon": "crop",
    "title": [
      "기준점 편집",
      "Sprite Pivot Editor",
      "基準点エディター"
    ],
    "description": [
      "프레임마다 기준점을 프리셋·드래그·숫자로 정하고 내보내기에 그대로 담으세요.",
      "Set each frame's pivot by preset, by dragging or by number, and carry it into the export.",
      "フレームごとの基準点をプリセット・ドラッグ・数値で決め、書き出しにそのまま含めます。"
    ],
    "limit": [
      "경계 상자 기준입니다. 발 위치를 인식하지는 않습니다.",
      "Bounding-box based: this is not foot detection.",
      "境界ボックス基準です。足の位置を検出するわけではありません。"
    ],
    "next": [
      "sprite-lab",
      "sprite-sheet-maker"
    ]
  },
  "sprite-animation-preview": {
    "path": "game/sprite-animation-preview",
    "category": "game",
    "icon": "media",
    "title": [
      "스프라이트 애니메이션 미리보기",
      "Sprite Animation Preview",
      "スプライトアニメのプレビュー"
    ],
    "description": [
      "FPS·프레임별 길이·정방향·역방향·왕복 재생을 보고 흔들림을 그래프로 확인하세요.",
      "Play at an fps or per-frame timing, forward, reverse or ping-pong, and see jitter as a graph.",
      "FPS・フレームごとの長さ・順再生・逆再生・往復を確認し、ぶれをグラフで見られます。"
    ],
    "limit": [
      "흔들림 측정은 알파 기준입니다. 보정은 정수 픽셀 이동만 합니다.",
      "Jitter is measured from alpha, and the fix only moves whole pixels.",
      "ぶれの測定はアルファ基準で、補正は整数ピクセル移動のみです。"
    ],
    "next": [
      "sprite-lab",
      "sprite-slicer"
    ]
  },
  "collision-polygon-generator": {
    "path": "game/collision-polygon-generator",
    "category": "game",
    "icon": "crop",
    "title": [
      "충돌 다각형 만들기",
      "Collision Polygon Generator",
      "衝突ポリゴン生成"
    ],
    "description": [
      "알파 실루엣에서 충돌 다각형을 만들고 꼭짓점 수와 오차를 숫자로 확인하세요.",
      "Trace collision polygons from the alpha silhouette and see the vertex count and the error.",
      "アルファのシルエットから衝突ポリゴンを作り、頂点数と誤差を数値で確認します。"
    ],
    "limit": [
      "볼록 분해는 하지 않습니다. 볼록 도형이 필요하면 볼록 외피를 쓰세요.",
      "No convex decomposition: use the convex hull when an engine needs convex shapes.",
      "凸分解は行いません。凸形状が必要な場合は凸包を使ってください。"
    ],
    "next": [
      "sprite-lab",
      "sprite-sheet-maker"
    ]
  },
  "hitbox-editor": {
    "path": "game/hitbox-editor",
    "category": "game",
    "icon": "sliders",
    "title": [
      "히트박스 편집",
      "Hitbox Editor",
      "ヒットボックス編集"
    ],
    "description": [
      "히트·피격·상호작용 박스를 프레임 구간에 넣고 타임라인으로 확인하세요.",
      "Put hit, hurt and interact boxes on a range of frames and check them on a timeline.",
      "ヒット・被弾・インタラクトのボックスをフレーム範囲に置き、タイムラインで確認します。"
    ],
    "limit": [
      "박스는 직접 정합니다. 자동으로 찾아 주지는 않습니다.",
      "Boxes are placed by you; nothing is detected automatically.",
      "ボックスは手動で配置します。自動検出は行いません。"
    ],
    "next": [
      "sprite-lab",
      "sprite-animation-preview"
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
      "palette-swap-ramp",
      "pixel-lab",
      "refiner"
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
  "texture-lab": {
    "path": "game/texture-lab",
    "category": "game",
    "icon": "sliders",
    "title": [
      "텍스처 랩",
      "Texture Lab",
      "テクスチャラボ"
    ],
    "description": [
      "PBR 텍스처 세트를 점검하고 노멀·채널·가장자리를 정리해 엔진에 넣으세요.",
      "Check a PBR texture set, then fix normals, channels and edges for your engine.",
      "PBRテクスチャ一式を点検し、ノーマル・チャンネル・端を整えてエンジンへ。"
    ],
    "limit": [
      "엔진 렌더러가 아닙니다. 미리보기는 광원 1개 근사이고, 색 공간은 안내만 하며 파일에서 자동 감지하지 않습니다.",
      "Not an engine renderer: the preview is a one-light approximation, and colour space is guidance only — no profile is detected.",
      "エンジンのレンダラーではありません。プレビューはライト1つの近似で、色空間は指針のみ（自動判定はしません）。"
    ],
    "next": [
      "mask-packer",
      "atlas-padding",
      "compress"
    ]
  },
  "channel-unpacker": {
    "path": "game/channel-unpacker",
    "category": "game",
    "icon": "pack",
    "title": [
      "채널 분리",
      "Channel Unpacker",
      "チャンネル分離"
    ],
    "description": [
      "ORM·마스크 텍스처의 R·G·B·A를 원래 바이트 그대로 흑백 PNG로 분리하세요.",
      "Split an ORM or mask texture into R/G/B/A greyscale PNGs with the original bytes.",
      "ORM・マスクテクスチャのR/G/B/Aを元のバイトのままグレーPNGに分離。"
    ],
    "limit": [
      "채널의 의미는 엔진 프리셋으로 표시할 뿐이며, 파일만 보고 어떤 엔진용인지 알아내지는 못합니다.",
      "Channel meaning comes from the engine preset you pick; a file cannot say which engine it was packed for.",
      "チャンネルの意味は選んだエンジンプリセットによります。ファイルからは判別できません。"
    ],
    "next": [
      "mask-packer",
      "texture-lab",
      "compress"
    ]
  },
  "normal-map-converter": {
    "path": "game/normal-map-converter",
    "category": "game",
    "icon": "flip",
    "title": [
      "노멀 맵 규격 변환",
      "Normal Map Converter (OpenGL ↔ DirectX)",
      "ノーマルマップ規格変換"
    ],
    "description": [
      "초록 채널만 반전해 OpenGL(+Y)과 DirectX(−Y) 노멀 맵을 서로 변환하세요.",
      "Convert a normal map between OpenGL (+Y) and DirectX (−Y) by mirroring the green channel.",
      "グリーンチャンネルだけを反転してOpenGL(+Y)とDirectX(−Y)を相互変換。"
    ],
    "limit": [
      "파일만 보고 어느 규격인지 판별할 수는 없습니다. 엔진 기준은 문서 출처와 함께 안내합니다.",
      "A file cannot be measured to tell which convention it uses; the engine expectations are listed with their sources.",
      "どちらの規格かはファイルから判定できません。エンジンの想定は出典付きで示します。"
    ],
    "next": [
      "texture-lab",
      "texture-map",
      "compress"
    ]
  },
  "pbr-texture-validator": {
    "path": "game/pbr-texture-validator",
    "category": "game",
    "icon": "check",
    "title": [
      "PBR 텍스처 점검",
      "PBR Texture Validator",
      "PBRテクスチャ点検"
    ],
    "description": [
      "텍스처 세트의 크기·누락·알파·채널·노멀을 한 번에 점검하고 보고서를 받으세요.",
      "Check a texture set for size mismatches, missing maps, stray alpha, channel and normal problems.",
      "サイズ不一致・不足マップ・余分なアルファ・チャンネルとノーマルの問題を一括点検。"
    ],
    "limit": [
      "파일 이름과 픽셀만으로 판단합니다. ICC 프로파일이나 감마는 읽지 않고 색 공간은 안내만 합니다.",
      "Judged from filenames and pixels only: no ICC profile or gamma is read, and colour space is guidance.",
      "ファイル名とピクセルのみで判断します。ICCやガンマは読まず、色空間は指針です。"
    ],
    "next": [
      "texture-lab",
      "mask-packer",
      "compress"
    ]
  },
  "texture-edge-bleed": {
    "path": "game/texture-edge-bleed",
    "category": "game",
    "icon": "crop",
    "title": [
      "가장자리 번짐 채우기",
      "Texture Edge Bleed",
      "エッジのにじみ処理"
    ],
    "description": [
      "투명한 텍셀 아래로 색을 밀어내 밉맵과 축소에서 생기는 검은 테두리를 없애세요.",
      "Push colour outwards under transparent texels so mipmaps and downscaling stop showing a dark rim.",
      "透明なテクセルの下へ色を広げ、ミップマップや縮小で出る暗い縁を防ぎます。"
    ],
    "limit": [
      "알파는 바꾸지 않습니다. 잘못 잘린 알파나 압축으로 손상된 경계를 복원하지는 못합니다.",
      "Alpha is never changed. It cannot repair an alpha channel that was already cut or compressed badly.",
      "アルファは変更しません。既に切れた・圧縮で壊れたアルファは修復できません。"
    ],
    "next": [
      "texture-lab",
      "sprite-sheet-maker",
      "compress"
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
  "pixel-lab": {
    "path": "game/pixel-lab",
    "category": "game",
    "icon": "pixel",
    "title": ["픽셀 랩","Pixel Lab","ピクセルラボ"],
    "description": ["여러 프레임을 하나의 팔레트로 통일하고, 정리·검사까지 한 곳에서.","Bring many frames to one palette, then clean up, audit and export in one place.","複数フレームを1つのパレットに統一し、整理・検査まで一か所で。"],
    "limit": ["픽셀을 정리해 주지만 새 디테일을 그려 주지는 않습니다. 애니메이션에 오차 확산 디더링을 쓰면 프레임마다 색이 달라질 수 있습니다.","It prepares pixels; it does not draw new detail. Error-diffusion dithering can differ between frames, so animations should use None or an ordered matrix.","ピクセルを整えますが、新しい描き込みはしません。誤差拡散ディザはフレームごとに結果が変わるため、アニメーションには不向きです。"],
    "next": ["sprite-sheet-maker","refiner","pixel"]
  },
  "palette-extractor": {
    "path": "game/palette-extractor",
    "category": "game",
    "icon": "sliders",
    "title": ["팔레트 추출","Palette Extractor","パレット抽出"],
    "description": ["이미지 여러 장에서 색 4·8·16·32·64개를 한 번에 뽑고 .gpl·HEX·JSON으로 저장하세요.","Pull 4, 8, 16, 32 or 64 colours from several images at once and save .gpl, HEX or JSON.","複数の画像から4・8・16・32・64色をまとめて抽出し、.gpl・HEX・JSONで保存。"],
    "limit": ["색은 채널당 5비트로 묶어 세므로 한두 픽셀만 쓰인 색은 이웃 색에 합쳐질 수 있습니다.","Colours are counted in 5-bit-per-channel buckets, so a colour used on one or two pixels can merge into a neighbour.","色はチャンネルあたり5ビットでまとめて数えるため、1〜2ピクセルだけの色は近い色に統合されることがあります。"],
    "next": ["pixel-lab","palette-swap-ramp","pixel"]
  },
  "palette-swap-ramp": {
    "path": "game/palette-swap-ramp",
    "category": "game",
    "icon": "background",
    "title": ["램프 색 교체","Ramp Palette Swap","ランプ色替え"],
    "description": ["음영 램프를 명도 순서대로 대응시켜 팀 컬러 변형을 한 번에 만드세요.","Map a shading ramp onto another by lightness order and generate team-colour variants at once.","陰影ランプを明度順に対応させ、チームカラーのバリエーションを一度に作成。"],
    "limit": ["명도 순서로만 대응시킵니다. 어느 색이 피부나 금속인지 의미는 알지 못합니다.","It maps by lightness order only; it does not know which colour is skin, metal or cloth.","明度順で対応させるだけで、どの色が肌や金属かは判断しません。"],
    "next": ["pixel-lab","palette-extractor","palette-swap"]
  },
  "pixel-art-cleanup": {
    "path": "game/pixel-art-cleanup",
    "category": "game",
    "icon": "reset",
    "title": ["픽셀 정리","Pixel Art Cleanup","ドット絵の整理"],
    "description": ["단독 픽셀, 작은 덩어리, 1픽셀 구멍, 안티에일리어싱 잔여물을 찾아 정리하세요.","Find and clear stray pixels, tiny clusters, single-pixel holes and anti-alias leftovers.","単独ピクセル・小さな塊・1ピクセルの穴・アンチエイリアスの残りを整理。"],
    "limit": ["후보를 먼저 보여 주고 보수적으로만 고칩니다. 두 겹 외곽선을 자동으로 얇게 만들지는 않습니다.","Candidates are shown first and fixes stay conservative: a doubled outline is never thinned automatically.","候補を先に表示し、修正は保守的です。二重の輪郭を自動で細くはしません。"],
    "next": ["pixel-lab","pixel-perfect-checker","pixel"]
  },
  "pixel-perfect-checker": {
    "path": "game/pixel-perfect-checker",
    "category": "game",
    "icon": "search",
    "title": ["픽셀 격자 검사","Pixel Perfect Checker","ピクセル格子の検査"],
    "description": ["확대된 스프라이트의 실제 도트 크기와 격자 어긋남, 흐린 경계, 색 수를 측정하세요.","Measure an upscaled sprite’s real pixel size, grid offset, blurred edges and colour count.","拡大されたスプライトの実際のドットサイズ・格子ずれ・ぼけた境界・色数を測定。"],
    "limit": ["정수 블록 격자만 정확히 증명합니다. 비정수 배율은 런 길이로 추정해 보고만 합니다.","Only an integer block grid is proven exactly; a non-integer factor is reported as a run-length estimate, not a fact.","正確に証明できるのは整数ブロック格子のみです。非整数倍率はラン長からの推定として報告します。"],
    "next": ["pixel-lab","pixel-art-cleanup","refiner"]
  }
});
export const RECIPE_INTENTS = Object.fromEntries(Object.entries(TOOLS).map(([id,d]) => [id,{path:d.path,editor:"image",tool:"recipe",icon:d.icon,action:"recipe",accept:"image",next:d.next}]));
export const RECIPE_ALIASES = {"image-to-pixel-art":"refiner","32x32-pixel-art-converter":"refiner","etsy-image-resizer":"marketplace-pack","brand-icon-pack":"favicon-pack"};
