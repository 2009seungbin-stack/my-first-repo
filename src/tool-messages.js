import {TOOLS} from './tool-registry.js';
export const TOOL_MESSAGES = {
  "kit.search": [
    "도구 검색",
    "Search tools",
    "ツール検索"
  ],
  "kit.explore": [
    "도구 살펴보기",
    "Explore tools",
    "ツール一覧"
  ],
  "kit.advanced": [
    "고급 옵션",
    "Advanced",
    "詳細設定"
  ],
  "kit.run": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "kit.review": [
    "프레임을 확인·수정한 뒤 내보내세요.",
    "Review and adjust frame boxes before export.",
    "フレーム範囲を確認・修正してから出力してください。"
  ],
  "kit.detect": [
    "프레임 감지",
    "Detect frames",
    "フレームを検出"
  ],
  "kit.redetect": [
    "다시 감지",
    "Detect again",
    "再検出"
  ],
  "kit.none": [
    "결과가 없습니다. 설정을 바꾸거나 범위를 직접 추가하세요.",
    "No candidates. Adjust settings or add a box manually.",
    "候補なし。設定を変更するか範囲を追加してください。"
  ],
  "kit.frame": [
    "프레임",
    "Frame",
    "フレーム"
  ],
  "kit.add": [
    "추가",
    "Add",
    "追加"
  ],
  "kit.delete": [
    "삭제",
    "Delete",
    "削除"
  ],
  "kit.merge": [
    "선택 프레임 병합",
    "Merge selected frames",
    "選択フレームを結合"
  ],
  "kit.up": [
    "앞으로",
    "Move earlier",
    "前へ"
  ],
  "kit.down": [
    "뒤로",
    "Move later",
    "後へ"
  ],
  "kit.width": [
    "너비",
    "Width",
    "幅"
  ],
  "kit.height": [
    "높이",
    "Height",
    "高さ"
  ],
  "kit.columns": [
    "열 수",
    "Columns",
    "列数"
  ],
  "kit.padding": [
    "여백",
    "Padding",
    "余白"
  ],
  "kit.align": [
    "세로 정렬",
    "Vertical alignment",
    "縦の配置"
  ],
  "kit.bottom": [
    "아래",
    "Bottom",
    "下"
  ],
  "kit.center": [
    "가운데",
    "Center",
    "中央"
  ],
  "kit.top": [
    "위",
    "Top",
    "上"
  ],
  "kit.anchor": [
    "가로 기준점 · 0~1",
    "Horizontal anchor · 0–1",
    "横の基準点 · 0〜1"
  ],
  "kit.colors": [
    "색 수",
    "Colors",
    "色数"
  ],
  "kit.dither": [
    "디더링",
    "Dithering",
    "ディザリング"
  ],
  "kit.outline": [
    "검은 외곽선",
    "Black outline",
    "黒い輪郭線"
  ],
  "kit.cleanup": [
    "단색 배경 정리",
    "Clean solid background",
    "単色背景を除去"
  ],
  "kit.background": [
    "배경색",
    "Background color",
    "背景色"
  ],
  "kit.tolerance": [
    "색 허용 오차",
    "Color tolerance",
    "色の許容差"
  ],
  "kit.alpha": [
    "알파 기준값",
    "Alpha threshold",
    "アルファしきい値"
  ],
  "kit.minArea": [
    "최소 영역 픽셀",
    "Minimum component pixels",
    "最小領域のピクセル数"
  ],
  "kit.from": [
    "원래 색",
    "Original color",
    "元の色"
  ],
  "kit.to": [
    "바꿀 색",
    "Replacement color",
    "置換する色"
  ],
  "kit.shading": [
    "밝기 차이 보존 · 근사",
    "Preserve luminance offset · approximate",
    "明度差を保持 · 近似"
  ],
  "kit.platform": [
    "출력 묶음",
    "Output pack",
    "出力パック"
  ],
  "kit.all": [
    "모두",
    "All",
    "すべて"
  ],
  "kit.custom": [
    "사용자 설정",
    "Custom",
    "カスタム"
  ],
  "kit.fit": [
    "맞춤",
    "Contain",
    "全体を収める"
  ],
  "kit.crop": [
    "채우고 자르기",
    "Cover and crop",
    "埋めて切り抜く"
  ],
  "kit.mode": [
    "모드",
    "Mode",
    "モード"
  ],
  "kit.longSide": [
    "긴 변 · 픽셀",
    "Long edge · pixels",
    "長辺 · ピクセル"
  ],
  "kit.chars": [
    "문자 순서",
    "Character order",
    "文字の順序"
  ],
  "kit.baseline": [
    "베이스라인",
    "Baseline",
    "ベースライン"
  ],
  "kit.mapping": [
    "채널에 넣을 이미지 밝기",
    "Input luminance per channel",
    "チャンネルごとの入力明度"
  ],
  "kit.gray": [
    "그레이스케일",
    "Grayscale",
    "グレースケール"
  ],
  "kit.normal": [
    "높이 기울기 → 노멀",
    "Height gradient → normal",
    "高さ勾配 → ノーマル"
  ],
  "kit.invert": [
    "밝기 반전",
    "Invert luminance",
    "明度を反転"
  ],
  "kit.alphaMap": [
    "알파 추출",
    "Extract alpha",
    "アルファ抽出"
  ],
  "kit.strength": [
    "기울기 강도",
    "Gradient strength",
    "勾配の強さ"
  ],
  "kit.invertY": [
    "녹색 채널 방향 반전",
    "Invert green orientation",
    "緑チャンネルの方向を反転"
  ],
  "kit.divider": [
    "분리 위치 · 너비 비율",
    "Divider · width fraction",
    "分割位置 · 幅の割合"
  ],
  "kit.order": [
    "좌우 순서",
    "Reading order",
    "左右の順序"
  ],
  "kit.threshold": [
    "흰색 기준값",
    "White threshold",
    "白色しきい値"
  ],
  "kit.limit": [
    "입력 1024개·출력 합계 4GB까지입니다. 처리 크기는 기기 메모리와 저장 공간에 따릅니다. CompressionStream이 없는 호환 마스크 인코더는 400만 픽셀까지입니다.",
    "Up to 1024 inputs and 4 GB total output. Capacity depends on device memory and storage; legacy mask encoding without CompressionStream retains a 4MP safeguard.",
    "入力1024件・合計出力4GBまで。処理可能なサイズは端末メモリと保存容量に依存します。CompressionStream非対応の旧マスク処理は4MPまでです。"
  ],
  "kit.tooMany": [
    "후보가 {0}개를 넘습니다. 최소 영역을 늘리거나 범위를 나눠 처리하세요.",
    "More than {0} candidates. Increase the minimum area or process the sheet in parts.",
    "候補が{0}件を超えています。最小面積を増やすか、範囲を分けて処理してください。"
  ],
  "kit.share": [
    "공유 이미지",
    "Share image",
    "共有画像"
  ],
  "kit.downloadCard": [
    "공유 카드 저장",
    "Download share card",
    "共有カードを保存"
  ],
  "kit.favorites": [
    "즐겨찾기",
    "Favorites",
    "お気に入り"
  ],
  "kit.recent": [
    "최근 사용",
    "Recent tools",
    "最近のツール"
  ],
  "kit.favorite": [
    "즐겨찾기 전환",
    "Toggle favorite",
    "お気に入り切替"
  ],
  "kit.close": [
    "닫기",
    "Close",
    "閉じる"
  ],
  "kit.game": [
    "게임 에셋",
    "Game assets",
    "ゲーム素材"
  ],
  "kit.image": [
    "이미지",
    "Image",
    "画像"
  ],
  "kit.pdf": [
    "PDF",
    "PDF",
    "PDF"
  ],
  "kit.media": [
    "미디어",
    "Media",
    "メディア"
  ],
  "kit.noMatches": [
    "일치하는 도구가 없습니다.",
    "No matching tools.",
    "該当ツールなし。"
  ],
  "kit.inputFirst": [
    "이미지를 먼저 넣어 주세요.",
    "Add an image first.",
    "先に画像を追加してください。"
  ],
  "kit.preparing": [
    "파일을 처리하는 중…",
    "Processing files…",
    "ファイルを処理中…"
  ],
  "kit.empty": [
    "모두 투명하거나 빈 이미지입니다. 원본을 확인하세요.",
    "The image is blank or fully transparent. Check the original.",
    "空白または完全に透明な画像です。元画像を確認してください。"
  ],
  "kit.sizeMismatch": [
    "채널 입력 이미지의 크기가 서로 다릅니다.",
    "Channel input image sizes do not match.",
    "チャンネル入力画像のサイズが一致しません。"
  ],
  "kit.error": [
    "처리하지 못했습니다. 입력·크기·설정을 확인하세요.",
    "Processing failed. Check the input, dimensions and settings.",
    "処理できません。入力・寸法・設定を確認してください。"
  ],
  "kit.pack": [
    "크기 세트 포함",
    "Include size set",
    "サイズセットを含める"
  ],
  "kit.results": [
    "결과 파일",
    "Output files",
    "出力ファイル"
  ],
  "kit.inspect": [
    "미리보기는 첫 출력입니다. ZIP에는 전체 결과가 들어갑니다.",
    "Preview shows the first output. The ZIP contains all outputs.",
    "プレビューは最初の出力です。ZIPには全出力が入ります。"
  ],
  "kit.frameOrder": [
    "프레임 순서",
    "Frame order",
    "フレームの順序"
  ],
  "kit.inputs": [
    "입력 순서",
    "Input order",
    "入力順序"
  ],
  "kit.compareOriginal": [
    "원본",
    "Original",
    "元画像"
  ],
  "kit.compareResult": [
    "결과",
    "Result",
    "結果"
  ],
  "intent.refiner.title": [
    "게임 에셋 다듬기",
    "Game Asset Refiner",
    "ゲーム素材を調整"
  ],
  "intent.refiner.headline": [
    "게임 에셋 다듬기",
    "Game Asset Refiner",
    "ゲーム素材を調整"
  ],
  "intent.refiner.description": [
    "배경 정리부터 정확한 픽셀 크기와 팔레트까지.",
    "Clean the background, fit an exact pixel canvas, and reduce its palette.",
    "背景の整理から正確なピクセルサイズ、減色まで。"
  ],
  "intent.refiner.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.sprite-slicer.title": [
    "스프라이트 자동 분리",
    "Sprite Sheet Slicer",
    "スプライトを分割"
  ],
  "intent.sprite-slicer.headline": [
    "스프라이트 자동 분리",
    "Sprite Sheet Slicer",
    "スプライトを分割"
  ],
  "intent.sprite-slicer.description": [
    "투명 영역으로 프레임을 찾고 직접 수정한 뒤 PNG로 분리하세요.",
    "Find alpha-connected frame candidates, review their boxes, and export PNGs.",
    "透明部分からフレーム候補を検出し、範囲を修正してPNGに分割。"
  ],
  "intent.sprite-slicer.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.frame-normalize.title": [
    "프레임 캔버스 통일",
    "Normalize Sprite Frames",
    "フレームサイズを統一"
  ],
  "intent.frame-normalize.headline": [
    "프레임 캔버스 통일",
    "Normalize Sprite Frames",
    "フレームサイズを統一"
  ],
  "intent.frame-normalize.description": [
    "여러 PNG의 투명 여백을 정리하고 같은 캔버스에 정렬하세요.",
    "Trim transparent margins and align multiple PNGs on equal canvases.",
    "複数PNGの透明余白を除き、同じキャンバスに揃えます。"
  ],
  "intent.frame-normalize.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.sprite-sheet-maker.title": [
    "스프라이트 시트 만들기",
    "Sprite Sheet Maker",
    "スプライトシート作成"
  ],
  "intent.sprite-sheet-maker.headline": [
    "스프라이트 시트 만들기",
    "Sprite Sheet Maker",
    "スプライトシート作成"
  ],
  "intent.sprite-sheet-maker.description": [
    "프레임 순서·열 수·여백을 정하고 PNG와 좌표 JSON을 만드세요.",
    "Arrange frames, set columns and padding, and export a PNG plus coordinate JSON.",
    "順序・列数・余白を指定し、PNGと座標JSONを作成。"
  ],
  "intent.sprite-sheet-maker.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.palette-swap.title": [
    "팔레트 색 교체",
    "Palette Swap",
    "パレットの色を置換"
  ],
  "intent.palette-swap.headline": [
    "팔레트 색 교체",
    "Palette Swap",
    "パレットの色を置換"
  ],
  "intent.palette-swap.description": [
    "추출한 색을 선택해 정확한 색 또는 비슷한 색을 교체하세요.",
    "Pick an extracted color and replace exact or similar colors.",
    "抽出した色を選び、一致する色や近い色を置き換えます。"
  ],
  "intent.palette-swap.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.marketplace-pack.title": [
    "상품 이미지 묶음",
    "Marketplace Image Pack",
    "商品画像パック"
  ],
  "intent.marketplace-pack.headline": [
    "상품 이미지 묶음",
    "Marketplace Image Pack",
    "商品画像パック"
  ],
  "intent.marketplace-pack.description": [
    "Etsy·Shopify용 이미지와 사용자 크기를 폴더별 ZIP으로 만드세요.",
    "Create folder-organized Etsy, Shopify and custom-size image ZIPs.",
    "Etsy・Shopify向けと任意サイズの画像をフォルダ別ZIPに。"
  ],
  "intent.marketplace-pack.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.print-pack.title": [
    "인쇄 비율 묶음",
    "Print Ratio Pack",
    "印刷比率パック"
  ],
  "intent.print-pack.headline": [
    "인쇄 비율 묶음",
    "Print Ratio Pack",
    "印刷比率パック"
  ],
  "intent.print-pack.description": [
    "2:3·3:4·4:5·11:14·A계열 비율의 이미지를 한 번에 만드세요.",
    "Export 2:3, 3:4, 4:5, 11:14 and A-series aspect ratios together.",
    "2:3・3:4・4:5・11:14・A判の比率をまとめて出力。"
  ],
  "intent.print-pack.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.logo-bg.title": [
    "로고 흰 배경 제거",
    "Remove White Logo Background",
    "ロゴの白背景を除去"
  ],
  "intent.logo-bg.headline": [
    "로고 흰 배경 제거",
    "Remove White Logo Background",
    "ロゴの白背景を除去"
  ],
  "intent.logo-bg.description": [
    "테두리와 연결된 단색 배경을 제거하고 내부 흰색을 보존하세요.",
    "Remove border-connected solid background while retaining enclosed white regions.",
    "外周につながる単色背景を除去し、内側の白い領域を残します。"
  ],
  "intent.logo-bg.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.bitmap-font.title": [
    "비트맵 폰트 만들기",
    "Bitmap Font Maker",
    "ビットマップフォント作成"
  ],
  "intent.bitmap-font.headline": [
    "비트맵 폰트 만들기",
    "Bitmap Font Maker",
    "ビットマップフォント作成"
  ],
  "intent.bitmap-font.description": [
    "격자형 폰트 시트와 문자 순서로 PNG·BMFont·JSON을 만드세요.",
    "Turn a grid font sheet and character order into PNG, BMFont and JSON.",
    "格子状の文字画像と文字順からPNG・BMFont・JSONを作成。"
  ],
  "intent.bitmap-font.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.mask-packer.title": [
    "RGBA 마스크 패킹",
    "RGBA Mask Packer",
    "RGBAマスクを結合"
  ],
  "intent.mask-packer.headline": [
    "RGBA 마스크 패킹",
    "RGBA Mask Packer",
    "RGBAマスクを結合"
  ],
  "intent.mask-packer.description": [
    "같은 크기 이미지의 밝기를 R·G·B·A에 원하는 순서로 넣으세요.",
    "Map luminance from equally sized images into your chosen RGBA channels.",
    "同じサイズの画像の明度をR・G・B・Aに割り当てます。"
  ],
  "intent.mask-packer.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.atlas-padding.title": [
    "아틀라스 가장자리 확장",
    "Atlas Edge Extrusion",
    "アトラスの縁を拡張"
  ],
  "intent.atlas-padding.headline": [
    "아틀라스 가장자리 확장",
    "Atlas Edge Extrusion",
    "アトラスの縁を拡張"
  ],
  "intent.atlas-padding.description": [
    "격자 타일의 가장자리 픽셀을 확장하고 새 좌표 JSON을 만드세요.",
    "Extrude grid-tile edges and export updated atlas coordinates.",
    "格子タイルの縁を伸ばし、新しい座標JSONを出力。"
  ],
  "intent.atlas-padding.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.texture-map.title": [
    "텍스처 맵 실험실",
    "Texture Map Lab",
    "テクスチャマップ調整"
  ],
  "intent.texture-map.headline": [
    "텍스처 맵 실험실",
    "Texture Map Lab",
    "テクスチャマップ調整"
  ],
  "intent.texture-map.description": [
    "밝기·알파 추출·반전과 높이 기울기 기반 노멀 맵을 만드세요.",
    "Create grayscale, alpha, inverted and height-gradient normal maps.",
    "グレー・アルファ抽出・反転・高さ勾配によるノーマルマップを作成。"
  ],
  "intent.texture-map.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.tile-helper.title": [
    "타일 격자 분리",
    "Tile Grid Slicer",
    "タイルを格子で分割"
  ],
  "intent.tile-helper.headline": [
    "타일 격자 분리",
    "Tile Grid Slicer",
    "タイルを格子で分割"
  ],
  "intent.tile-helper.description": [
    "타일 크기를 지정해 격자 PNG를 개별 이미지로 분리하세요.",
    "Split a tile grid into individual PNGs at an exact tile size.",
    "タイルの大きさを指定し、格子画像を個別PNGに分割。"
  ],
  "intent.tile-helper.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.scan-split.title": [
    "스캔 이미지 양쪽 분리",
    "Split Scanned Images",
    "見開き画像を分割"
  ],
  "intent.scan-split.headline": [
    "스캔 이미지 양쪽 분리",
    "Split Scanned Images",
    "見開き画像を分割"
  ],
  "intent.scan-split.description": [
    "분리 위치와 좌우 순서를 지정해 스캔 이미지 두 장을 만드세요.",
    "Set a divider and reading order to split a scanned image in two.",
    "分割位置と左右の順を指定し、見開き画像を2枚に分けます。"
  ],
  "intent.scan-split.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.margin-crop.title": [
    "이미지 여백 자르기",
    "Crop Image Margins",
    "画像の余白を切り抜き"
  ],
  "intent.margin-crop.headline": [
    "이미지 여백 자르기",
    "Crop Image Margins",
    "画像の余白を切り抜き"
  ],
  "intent.margin-crop.description": [
    "흰색 기준값으로 여백을 찾고 결과를 확인한 뒤 저장하세요.",
    "Detect margins with a white threshold; review the crop before saving.",
    "白色しきい値から余白を検出し、結果を確認して保存。"
  ],
  "intent.margin-crop.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ],
  "intent.favicon-pack.title": [
    "파비콘·아이콘 묶음",
    "Favicon and Icon Pack",
    "ファビコン・アイコンパック"
  ],
  "intent.favicon-pack.headline": [
    "파비콘·아이콘 묶음",
    "Favicon and Icon Pack",
    "ファビコン・アイコンパック"
  ],
  "intent.favicon-pack.description": [
    "PNG 로고로 ICO·앱 아이콘과 HTML·매니페스트 조각을 만드세요.",
    "Build ICO, app PNG icons and HTML/manifest snippets from a raster logo.",
    "PNGなどのロゴからICO・アプリアイコン・HTMLとマニフェストを作成。"
  ],
  "intent.favicon-pack.action": [
    "결과 만들기",
    "Create result",
    "結果を作成"
  ]
};

Object.assign(TOOL_MESSAGES,{"kit.n":["출력 크기","Output size","出力サイズ"],"kit.cellW":["셀 너비","Cell width","セル幅"],"kit.cellH":["셀 높이","Cell height","セル高"],"kit.autoSize":["너비·높이 0은 가장 큰 프레임에 자동 맞춤입니다.","Width/height 0 automatically fit the largest frame.","幅・高さ0は最大フレームに自動調整します。"]});

Object.assign(TOOL_MESSAGES,{"Invalid dimensions": ["치수는 허용 범위 안의 양의 정수여야 합니다.", "Invalid dimensions", "寸法には範囲内の正の整数を指定してください。"], "Pixel limit exceeded or invalid RGBA data": ["분석 픽셀 한도를 초과했거나 이미지 데이터가 올바르지 않습니다.", "Pixel limit exceeded or invalid RGBA data", "分析ピクセル上限を超えたか、画像データが不正です。"], "Too many frame candidates; increase minimum area": ["프레임 후보가 너무 많습니다. 최소 영역을 늘리세요.", "Too many frame candidates; increase minimum area", "フレーム候補が多すぎます。最小領域を増やしてください。"], "Frame is outside the image": ["프레임 범위가 이미지 밖이거나 크기가 올바르지 않습니다.", "Frame is outside the image", "フレームの範囲が画像外、またはサイズが不正です。"], "Tile dimensions must divide the image exactly": ["타일 크기로 이미지 너비와 높이가 나누어떨어져야 합니다.", "Tile dimensions must divide the image exactly", "画像の幅と高さを割り切れるタイル寸法を指定してください。"], "At most 256 frames": ["최대 256개 프레임까지 처리합니다.", "At most 256 frames", "フレームは最大256個です。"], "Invalid padding": ["여백 또는 외곽선 크기가 허용 범위를 벗어났습니다.", "Invalid padding", "余白または輪郭線のサイズが範囲外です。"], "Sheet exceeds output pixel limit": ["스프라이트 시트가 출력 픽셀 한도를 초과합니다.", "Sheet exceeds output pixel limit", "スプライトシートが出力ピクセル上限を超えます。"], "A frame does not fit the output canvas": ["프레임이 출력 캔버스에 들어가지 않습니다. 크기를 늘리세요.", "A frame does not fit the output canvas", "出力キャンバスにフレームが収まりません。寸法を増やしてください。"], "Invalid color": ["색상 또는 허용 오차가 올바르지 않습니다.", "Invalid color", "色または許容差が不正です。"], "Invalid texture options": ["텍스처 설정이 허용 범위를 벗어났습니다.", "Invalid texture options", "テクスチャ設定が範囲外です。"], "Four channel mappings are required": ["R·G·B·A 네 채널을 모두 지정하세요.", "Four channel mappings are required", "R・G・B・Aの4チャンネルを指定してください。"], "Missing channel input": ["채널에 지정된 입력 이미지가 없습니다.", "Missing channel input", "チャンネルに指定した入力画像がありません。"], "Atlas output exceeds analysis limit": ["아틀라스 출력이 분석 픽셀 한도를 초과합니다.", "Atlas output exceeds analysis limit", "アトラス出力が分析ピクセル上限を超えます。"], "Character order must be nonempty, unique, and fit the grid": ["중복되지 않는 문자를 격자 칸 수 이내로 입력하세요.", "Character order must be nonempty, unique, and fit the grid", "重複しない文字をグリッドのセル数以内で入力してください。"], "Invalid baseline": ["베이스라인은 0부터 셀 높이까지의 정수여야 합니다.", "Invalid baseline", "ベースラインは0からセル高までの整数です。"], "Padding leaves no usable pixels": ["여백을 줄이세요. 사용할 픽셀 영역이 없습니다.", "Padding leaves no usable pixels", "余白を減らしてください。使用できるピクセル領域がありません。"], "Unknown preset": ["지원하지 않는 출력 프리셋입니다.", "Unknown preset", "対応していない出力設定です。"], "Module worker unavailable; compatibility mode is limited to 262144 pixels": ["이 브라우저는 작업용 Worker를 시작할 수 없습니다. 호환 모드는 262,144픽셀 이하에서 지원합니다.", "Module worker unavailable; compatibility mode is limited to 262144 pixels", "このブラウザではWorkerを開始できません。互換モードは262,144ピクセル以下です。"]});

// Tile Lab (docs/TILE-LAB.md): the Lab plus the three tools that have their own search intent.
Object.assign(TOOL_MESSAGES,Object.fromEntries(['tile-lab','autotile-tester','tileset-slicer','seamless-tile-checker'].flatMap(id=>[
 [`intent.${id}.title`,TOOLS[id].title],[`intent.${id}.headline`,TOOLS[id].title],
 [`intent.${id}.description`,TOOLS[id].description],
 [`intent.${id}.action`,['열기','Open','開く']]])));
