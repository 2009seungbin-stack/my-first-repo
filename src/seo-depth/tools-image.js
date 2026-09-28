/** Intent content for the tools-image pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/task/convert.js, src/task/compress.js, src/task/resize.js, src/compression.js,
 * src/image.js, src/resample.js, src/app.js (classic editor). Every byte count, SSIM and pixel count
 * below was measured on 2026-09-28 with that code in Playwright Chromium 153 on the repository's own
 * fixtures: tests/fixtures/astronaut.png (NASA, public domain, 512 × 512, 791,555 bytes), Kenney CC0
 * files in tests/fixtures/kenney and tests/fixtures/game-seo, and tests/fixtures/texture/bricks_Color.png
 * (ambientCG CC0). JPG/WebP/AVIF/BMP inputs were derived from the astronaut PNG with Pillow 12.3.
 * Platform sizes come from the platforms' own help pages, checked on 2026-09-28. */
const MDN={en:'[MDN: Image file type and format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)',ko:'[MDN: 이미지 파일 형식 가이드](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)',ja:'[MDN: 画像ファイルの種類と形式ガイド](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)'};
export default {
 'image/convert':{
  type:'tool',
  intent:{primary:'convert an image file to another format (PNG, JPG, WebP)',secondary:['which format for photos, screenshots, logos, pixel art','keep transparency','why the converted file is bigger'],
   goal:'a file in the format the destination accepts, with no avoidable quality or transparency loss',input:'PNG, JPG, WebP, AVIF, BMP or single-photo HEIC (still images)',output:'PNG, JPG or WebP (AVIF only where the browser can encode it), same dimensions',target:'any app or upload form',support:'full',
   evidence:['src/task/convert.js','src/image.js (decode, background, blobOf)','src/compression.js supportedFormats()','measured 2026-09-28, Chromium 153, tests/fixtures/astronaut.png + tests/fixtures/kenney'],
   external:['MDN image file type and format guide']},
  en:{
   answer:'Converting an image means decoding it to pixels and encoding those pixels again in another format — renaming `.png` to `.jpg` does not do that. Nerulio opens PNG, JPG, WebP, AVIF, BMP and single-photo HEIC in your browser and writes PNG, JPG or WebP (AVIF only where the browser can encode it; Chromium 153 cannot). Width and height stay the same; transparency survives in PNG and WebP and is filled with a background colour in JPG. Pick the target by what the picture is: photos → JPG or WebP, screenshots, logos and pixel art → PNG or lossless WebP.',
   concept:{title:'What a format change really changes',body:[
    'Every format stores the same grid of pixels in its own way. PNG is lossless: decoding it gives back exactly the pixels that went in. JPG is lossy — it drops the detail the eye misses most easily — and it has no alpha channel at all. WebP can be either lossy (VP8, colour kept at half resolution) or lossless, and keeps alpha in both. AVIF is lossy or lossless with alpha, but only some browsers can write it.',
    'Quality therefore only ever goes one way. Turning a JPG into a PNG makes the file several times larger and keeps every JPG artefact exactly; going from one lossy format to another (JPG ↔ WebP) re-encodes and loses a little more each time.',
    'In Nerulio the browser does the encoding. The quality slider (20–100, default 92) drives JPG, WebP and AVIF; PNG ignores it. In Chromium a WebP at quality 100 is written lossless — measured pixel-exact on the files below.'],
    terms:[['Lossless','Decoding returns the exact pixels that were encoded (PNG, lossless WebP).'],['Lossy','The encoder discards detail to save bytes; the loss cannot be undone later (JPG, lossy WebP, most AVIF).'],['Alpha channel','Per-pixel opacity. PNG, WebP and AVIF have it; JPG does not.'],['Re-encoding','Decode to pixels, encode again. Every lossy re-encode adds a small new error.']]},
   example:{title:'One photo, four outputs (measured)',lead:'NASA\'s public-domain astronaut portrait from the repository\'s test fixtures (512 × 512, opaque), converted with Nerulio\'s own code in Chromium 153 on 2026-09-28. SSIM compares the result with the decoded source (1.0 = identical).',lines:[
    'Source: astronaut.png   791,555 bytes   512 × 512',
    '',
    'Output               Bytes      of source   SSIM',
    'JPG  quality 92      73,755      9.3 %      0.9874',
    'WebP quality 92      59,824      7.6 %      0.9883',
    'WebP quality 100    379,076     47.9 %      1.0000 (lossless)',
    'PNG  re-encoded     575,694     72.7 %      1.0000 (lossless)'],
    after:'The re-encoded PNG is smaller only because the fixture was saved with weak compression; its pixels are identical. Pixel art turns the ranking around — see [[image/png-to-webp|PNG to WebP]], where the lossless WebP of a sprite sheet is a third of the size of the lossy one.'},
   mapping:{title:'Which target for which picture',head:['Picture','Convert to','Why'],rows:[
    ['Photo from a camera or phone','JPG (widest support) or WebP','Lossy loss is hard to see on continuous tone; see [[image/png-to-jpg|PNG to JPG]]'],
    ['Screenshot, chart, text','PNG, or WebP at quality 100','Lossy encoders blur letters and add coloured fringes'],
    ['Logo or cut-out with transparency','PNG or WebP','JPG has no alpha: transparent areas become the background colour'],
    ['Pixel art, sprites','PNG, or WebP at quality 100','Lossy WebP changed 8,481 of 16,576 pixels of a Kenney sprite sheet'],
    ['AVIF or WebP an app refuses','JPG (photo) or PNG (graphic)','See [[image/avif-to-jpg|AVIF to JPG]] and [[image/webp-to-png|WebP to PNG]]'],
    ['BMP','PNG (lossless) or JPG','[[image/bmp-to-png|BMP to PNG]] kept every pixel and saved 27 %']]},
   verify:{steps:[
    'Open the result in a second program (the system image viewer or another browser): it must open as the new format and have the same width and height as the source.',
    'For transparency, look at the PNG or WebP on a coloured background; a JPG shows the background colour you picked instead.',
    'Compare the byte counts in the result list. If the new file is bigger (WebP → JPG usually is), keep the original unless the destination demands the new format.']},
   trouble:{rows:[
    ['The site still says "unsupported format"','The file was renamed instead of converted, or the site wants another format than the one chosen','A real PNG starts with the bytes `‰PNG`, a JPG with `ÿØÿ`, a WebP with `RIFF….WEBP`','Convert here to the format the site lists; JPG is the safest choice for photos'],
    ['The transparent background turned white','JPG cannot store alpha; the converter fills it with the JPG background colour (default `#ffffff`)','The chosen target is JPG','Choose PNG or WebP, or set another background colour under Advanced'],
    ['The converted file is much larger','Lossy → lossless (JPG → PNG) or a lossy re-encode at a higher quality than the source used','Compare the sizes in the result list','Keep the original, or lower the quality for JPG/WebP; for a byte limit use [[image/compress|compress]]'],
    ['AVIF is missing from the target list','The list only shows formats this browser can encode; Chromium 153 has no AVIF encoder for canvas','—','Use PNG, JPG or WebP; AVIF input still opens'],
    ['An animated GIF or WebP is refused','This is a still-image converter; multi-frame input is rejected instead of silently keeping frame 1','—','Export one frame first; for clips from video use [[video/to-gif|video to GIF]]']]},
   alternatives:{rows:[
    ['Keep the original','The destination already accepts the current format — every lossy-to-lossy conversion costs a little quality.'],
    ['The app that made the file (camera, phone share sheet, the editor\'s own export)','You need the capture date, GPS or a wide-gamut colour profile kept: Nerulio writes no EXIF, and its JPG/WebP carry an sRGB profile.'],
    ['[[image/compress|Compress to a size]]','The real goal is a smaller file, not a particular extension: it compares PNG, JPG and WebP candidates and keeps the best-looking one under your limit.']]},
   limits:['EXIF (camera, date, GPS) is not written to any output; JPG and WebP from Chromium carry an sRGB colour profile, PNG output carries none.','Animated GIF, APNG and WebP and multi-image HEIC are rejected; SVG input is not supported.','Output formats depend on the browser\'s encoders: PNG, JPG and WebP in Chromium, no AVIF output there.'],
   versions:{body:['Measured on 2026-09-28 with Nerulio\'s `src/image.js` encoder path in Playwright Chromium 153, on `tests/fixtures/astronaut.png` (public domain) and Kenney\'s CC0 sprite sheet in `tests/fixtures/kenney/`. What each format can store follows the MDN format guide.'],sources:[MDN.en]}
  },
  ko:{
   answer:'이미지 변환은 파일을 픽셀로 풀었다가 다른 형식으로 다시 인코딩하는 작업입니다. 확장자만 `.png`에서 `.jpg`로 바꾸는 것과는 다릅니다. Nerulio는 PNG·JPG·WebP·AVIF·BMP·사진 한 장짜리 HEIC를 브라우저에서 열어 PNG·JPG·WebP로 저장합니다(AVIF 저장은 브라우저가 지원할 때만 가능하며 Chromium 153은 지원하지 않습니다). 가로·세로 크기는 그대로이고, 투명 영역은 PNG·WebP에서는 유지되고 JPG에서는 배경색으로 채워집니다. 사진은 JPG나 WebP, 스크린샷·로고·도트 그림은 PNG나 무손실 WebP로 고르세요.',
   concept:{title:'형식을 바꾸면 실제로 무엇이 바뀌나',body:[
    '같은 픽셀 격자라도 형식마다 저장하는 방식이 다릅니다. PNG는 무손실이라 풀면 넣은 픽셀이 그대로 나옵니다. JPG는 눈에 잘 띄지 않는 정보를 버리는 손실 압축이고 알파 채널이 아예 없습니다. WebP는 손실(VP8 기반, 색 정보를 절반 해상도로 저장)과 무손실 두 방식이 있고 둘 다 알파를 유지합니다. AVIF도 손실·무손실과 알파를 지원하지만 저장할 수 있는 브라우저가 제한적입니다.',
    '그래서 화질은 한 방향으로만 움직입니다. JPG를 PNG로 바꾸면 파일은 몇 배 커지지만 JPG에서 생긴 뭉개짐은 그대로 보존됩니다. JPG와 WebP처럼 손실 형식끼리 바꾸면 다시 인코딩하면서 매번 조금씩 더 잃습니다.',
    'Nerulio에서는 브라우저가 인코딩을 맡습니다. 화질 슬라이더(20~100, 기본 92)는 JPG·WebP·AVIF에만 적용되고 PNG는 무시합니다. Chromium에서는 화질 100의 WebP가 무손실로 저장되며, 아래 파일에서 픽셀 단위로 일치하는 것을 측정했습니다.'],
    terms:[['무손실','인코딩한 픽셀이 디코딩 후 정확히 그대로 나오는 방식(PNG, 무손실 WebP).'],['손실','용량을 줄이려고 세부 정보를 버리는 방식. 나중에 되돌릴 수 없습니다(JPG, 손실 WebP, 대부분의 AVIF).'],['알파 채널','픽셀별 불투명도. PNG·WebP·AVIF에는 있고 JPG에는 없습니다.'],['재인코딩','픽셀로 풀었다가 다시 저장하는 것. 손실 형식은 할 때마다 오차가 조금씩 더해집니다.']]},
   example:{title:'사진 한 장을 네 가지로 저장한 결과(실측)',lead:'저장소 테스트 자료에 있는 NASA 공개 도메인 우주비행사 사진(512 × 512, 불투명)을 Nerulio 코드로 2026-09-28 Chromium 153에서 변환했습니다. SSIM은 원본을 디코딩한 픽셀과의 유사도입니다(1.0 = 동일).',lines:[
    '원본: astronaut.png     791,555 바이트   512 × 512',
    '',
    '출력                 바이트     원본 대비   SSIM',
    'JPG  화질 92          73,755      9.3 %     0.9874',
    'WebP 화질 92          59,824      7.6 %     0.9883',
    'WebP 화질 100        379,076     47.9 %     1.0000 (무손실)',
    'PNG  다시 저장       575,694     72.7 %     1.0000 (무손실)'],
    after:'다시 저장한 PNG가 작아진 것은 원본 파일의 압축이 약했기 때문이고 픽셀은 똑같습니다. 도트 그림에서는 순위가 뒤집힙니다. [[image/png-to-webp|PNG → WebP]] 페이지에서 스프라이트 시트의 무손실 WebP가 손실 WebP의 3분의 1 크기인 것을 볼 수 있습니다.'},
   mapping:{title:'어떤 그림을 어떤 형식으로',head:['그림','바꿀 형식','이유'],rows:[
    ['카메라·휴대폰 사진','JPG(호환성 최고) 또는 WebP','연속된 색조에서는 손실이 잘 보이지 않습니다. [[image/png-to-jpg|PNG → JPG]] 참고'],
    ['스크린샷·차트·글자','PNG 또는 화질 100 WebP','손실 인코더는 글자를 흐리게 하고 색 번짐을 만듭니다'],
    ['투명 배경 로고·누끼','PNG 또는 WebP','JPG에는 알파가 없어 투명 부분이 배경색이 됩니다'],
    ['도트 그림·스프라이트','PNG 또는 화질 100 WebP','손실 WebP는 Kenney 스프라이트 시트 16,576픽셀 중 8,481개를 바꿨습니다'],
    ['앱이 거부하는 AVIF·WebP','JPG(사진) 또는 PNG(그래픽)','[[image/avif-to-jpg|AVIF → JPG]], [[image/webp-to-png|WebP → PNG]] 참고'],
    ['BMP','PNG(무손실) 또는 JPG','[[image/bmp-to-png|BMP → PNG]]는 모든 픽셀을 유지하고 27% 줄었습니다']]},
   verify:{steps:[
    '결과를 다른 프로그램(운영체제 사진 뷰어나 다른 브라우저)에서 열어 새 형식으로 열리는지, 가로·세로가 원본과 같은지 확인하세요.',
    '투명도는 PNG·WebP를 색 있는 배경 위에 올려 확인합니다. JPG라면 고른 배경색이 보여야 합니다.',
    '결과 목록의 바이트 수를 비교하세요. 새 파일이 더 크다면(WebP → JPG는 대개 커집니다) 받는 쪽이 그 형식을 요구하지 않는 한 원본을 쓰는 편이 낫습니다.']},
   trouble:{rows:[
    ['사이트가 여전히 "지원하지 않는 형식"이라고 함','변환하지 않고 확장자만 바꿨거나, 사이트가 요구하는 형식과 다른 것을 골랐습니다','진짜 PNG는 `‰PNG`, JPG는 `ÿØÿ`, WebP는 `RIFF….WEBP` 바이트로 시작합니다','사이트가 명시한 형식으로 여기서 변환하세요. 사진이라면 JPG가 가장 안전합니다'],
    ['투명 배경이 흰색이 됨','JPG는 알파를 저장하지 못해 JPG 배경색(기본 `#ffffff`)으로 채워집니다','저장 형식이 JPG인지 확인','PNG나 WebP를 고르거나 고급 설정에서 배경색을 바꾸세요'],
    ['변환한 파일이 훨씬 커짐','손실 → 무손실(JPG → PNG) 변환이거나, 원본보다 높은 화질로 다시 인코딩했습니다','결과 목록의 용량 비교','원본을 쓰거나 JPG·WebP 화질을 낮추세요. 용량 제한이 목적이면 [[image/compress|압축]]을 쓰세요'],
    ['저장 형식에 AVIF가 없음','이 브라우저가 인코딩할 수 있는 형식만 표시합니다. Chromium 153에는 캔버스용 AVIF 인코더가 없습니다','—','PNG·JPG·WebP를 쓰세요. AVIF 입력은 그대로 열립니다'],
    ['움직이는 GIF·WebP가 거부됨','정지 이미지 변환기라서 여러 프레임 입력은 첫 프레임만 몰래 남기지 않고 거부합니다','—','먼저 한 프레임을 저장하세요. 영상에서 움짤을 만들려면 [[video/to-gif|영상 → GIF]]를 쓰세요']]},
   alternatives:{rows:[
    ['원본 그대로 쓰기','받는 쪽이 지금 형식을 이미 받는 경우. 손실 형식끼리의 변환은 매번 화질을 조금씩 깎습니다.'],
    ['파일을 만든 앱(카메라, 휴대폰 공유 메뉴, 편집 프로그램의 내보내기)','촬영 날짜·GPS·넓은 색역 프로필을 유지해야 하는 경우. Nerulio는 EXIF를 쓰지 않고 JPG·WebP에는 sRGB 프로필이 들어갑니다.'],
    ['[[image/compress|용량 맞춰 압축]]','특정 확장자가 아니라 작은 파일이 목적인 경우. PNG·JPG·WebP 후보를 비교해 제한 안에서 가장 원본에 가까운 것을 고릅니다.']]},
   limits:['EXIF(카메라·날짜·GPS)는 어떤 출력에도 기록되지 않습니다. Chromium의 JPG·WebP에는 sRGB 색상 프로필이 들어가고 PNG에는 프로필이 없습니다.','움직이는 GIF·APNG·WebP와 여러 장이 든 HEIC는 거부하며 SVG 입력은 지원하지 않습니다.','저장 형식은 브라우저 인코더에 따라 달라집니다. Chromium에서는 PNG·JPG·WebP이며 AVIF 출력은 없습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio의 `src/image.js` 인코딩 경로로 `tests/fixtures/astronaut.png`(공개 도메인)와 `tests/fixtures/kenney/`의 Kenney CC0 스프라이트 시트를 측정했습니다. 형식별로 저장할 수 있는 정보는 MDN 형식 가이드를 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'画像の変換とは、ファイルをいったんピクセルに展開し、別の形式でエンコードし直すことです。拡張子を `.png` から `.jpg` に書き換えるだけでは変換になりません。NerulioはPNG・JPG・WebP・AVIF・BMP・写真1枚のHEICをブラウザ内で開き、PNG・JPG・WebPで保存します（AVIFの書き出しはブラウザが対応する場合のみで、Chromium 153は非対応）。幅と高さはそのままで、透明部分はPNGとWebPでは残り、JPGでは背景色で塗られます。写真ならJPGかWebP、スクリーンショット・ロゴ・ドット絵ならPNGか可逆WebPを選びます。',
   concept:{title:'形式を変えると実際に何が変わるか',body:[
    '同じピクセルの並びでも、形式ごとに保存の仕方が違います。PNGは可逆圧縮で、展開すると入れたピクセルがそのまま戻ります。JPGは目に付きにくい情報を捨てる非可逆圧縮で、アルファチャンネルを持ちません。WebPには非可逆（VP8ベース、色情報を半分の解像度で保持）と可逆の2方式があり、どちらもアルファを保てます。AVIFも非可逆・可逆とアルファに対応しますが、書き出せるブラウザは限られます。',
    'そのため画質は一方向にしか動きません。JPGをPNGにするとファイルは数倍になりますが、JPGで生じたブロックノイズはそのまま残ります。JPGとWebPのような非可逆形式どうしの変換では、エンコードし直すたびに少しずつ劣化します。',
    'Nerulioではエンコードをブラウザが行います。画質スライダー（20〜100、初期値92）はJPG・WebP・AVIFにだけ効き、PNGには関係しません。Chromiumでは画質100のWebPが可逆で書き出され、下のファイルでピクセル単位の一致を計測しました。'],
    terms:[['可逆','エンコードしたピクセルが展開後にそのまま戻る方式（PNG、可逆WebP）。'],['非可逆','容量を減らすために細部を捨てる方式。後から元には戻せません（JPG、非可逆WebP、多くのAVIF）。'],['アルファチャンネル','ピクセルごとの不透明度。PNG・WebP・AVIFにはあり、JPGにはありません。'],['再エンコード','展開してから保存し直すこと。非可逆形式では毎回わずかな誤差が加わります。']]},
   example:{title:'1枚の写真を4通りに保存した結果（実測）',lead:'リポジトリのテスト素材にあるNASAのパブリックドメインの宇宙飛行士写真（512 × 512、不透明）を、Nerulioのコードで2026-09-28にChromium 153で変換しました。SSIMは元画像を展開したピクセルとの類似度です（1.0で同一）。',lines:[
    '元画像: astronaut.png    791,555 バイト   512 × 512',
    '',
    '出力                 バイト     元比       SSIM',
    'JPG  画質92           73,755      9.3 %     0.9874',
    'WebP 画質92           59,824      7.6 %     0.9883',
    'WebP 画質100         379,076     47.9 %     1.0000（可逆）',
    'PNG  保存し直し      575,694     72.7 %     1.0000（可逆）'],
    after:'保存し直したPNGが小さくなったのは元ファイルの圧縮が弱かったためで、ピクセルは同一です。ドット絵では順位が逆転します。[[image/png-to-webp|PNG → WebP]]では、スプライトシートの可逆WebPが非可逆WebPの3分の1の大きさになっています。'},
   mapping:{title:'どの画像をどの形式に',head:['画像','変換先','理由'],rows:[
    ['カメラ・スマホの写真','JPG（互換性が最も高い）またはWebP','連続した階調では劣化が目立ちにくい。[[image/png-to-jpg|PNG → JPG]]参照'],
    ['スクリーンショット・グラフ・文字','PNG、または画質100のWebP','非可逆エンコーダーは文字をぼかし、色のにじみを作ります'],
    ['透過背景のロゴ・切り抜き','PNGまたはWebP','JPGにはアルファがなく、透明部分が背景色になります'],
    ['ドット絵・スプライト','PNG、または画質100のWebP','非可逆WebPはKenneyのスプライトシート16,576ピクセル中8,481個を変えました'],
    ['アプリが受け付けないAVIF・WebP','JPG（写真）またはPNG（グラフィック）','[[image/avif-to-jpg|AVIF → JPG]]、[[image/webp-to-png|WebP → PNG]]参照'],
    ['BMP','PNG（可逆）またはJPG','[[image/bmp-to-png|BMP → PNG]]は全ピクセルを保ったまま27%小さくなりました']]},
   verify:{steps:[
    '結果を別のプログラム（OSの画像ビューアや別のブラウザ）で開き、新しい形式として開けること、幅と高さが元と同じことを確認します。',
    '透過はPNG・WebPを色のある背景に置いて確認します。JPGなら選んだ背景色が見えるはずです。',
    '結果一覧のバイト数を比べます。新しいファイルのほうが大きければ（WebP → JPGはたいてい大きくなります）、提出先がその形式を求めていない限り元のファイルを使いましょう。']},
   trouble:{rows:[
    ['サイトが「対応していない形式」と言い続ける','変換せずに拡張子だけ変えた、または提出先が求める形式と違うものを選んだ','本物のPNGは `‰PNG`、JPGは `ÿØÿ`、WebPは `RIFF….WEBP` のバイトで始まります','提出先が指定する形式でここから変換します。写真ならJPGが最も確実です'],
    ['透明な背景が白くなった','JPGはアルファを保存できず、JPGの背景色（初期値 `#ffffff`）で塗られます','保存形式がJPGになっている','PNGかWebPを選ぶか、詳細設定で背景色を変えます'],
    ['変換後のファイルがずっと大きい','非可逆 → 可逆（JPG → PNG）の変換か、元より高い画質で再エンコードした','結果一覧で容量を比較','元のファイルを使うか、JPG・WebPの画質を下げます。容量制限が目的なら[[image/compress|圧縮]]へ'],
    ['保存形式にAVIFがない','このブラウザがエンコードできる形式だけを表示します。Chromium 153にはcanvas用のAVIFエンコーダーがありません','—','PNG・JPG・WebPを使います。AVIFの読み込みはできます'],
    ['アニメーションGIF・WebPが拒否される','静止画用の変換なので、複数フレームの入力は1コマ目だけを黙って残さずに拒否します','—','先に1コマを書き出します。動画から作るなら[[video/to-gif|動画 → GIF]]へ']]},
   alternatives:{rows:[
    ['元の形式のまま使う','提出先が今の形式を受け付ける場合。非可逆形式どうしの変換は毎回わずかに画質を削ります。'],
    ['ファイルを作ったアプリ（カメラ、スマホの共有メニュー、編集ソフトの書き出し）','撮影日時・GPS・広色域プロファイルを残したい場合。NerulioはEXIFを書かず、JPG・WebPにはsRGBプロファイルが入ります。'],
    ['[[image/compress|容量を指定して圧縮]]','特定の拡張子より小さいファイルが目的の場合。PNG・JPG・WebPの候補を比べ、制限内で最も元に近いものを選びます。']]},
   limits:['EXIF（カメラ・日時・GPS）はどの出力にも書き込まれません。ChromiumのJPG・WebPにはsRGBプロファイルが入り、PNGにはプロファイルがありません。','アニメーションGIF・APNG・WebPと複数枚のHEICは拒否し、SVG入力には対応していません。','保存形式はブラウザのエンコーダー次第です。ChromiumではPNG・JPG・WebPで、AVIF出力はありません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの `src/image.js` のエンコード経路を使い `tests/fixtures/astronaut.png`（パブリックドメイン）と `tests/fixtures/kenney/` のKenney CC0スプライトシートを計測しました。各形式が保存できる情報はMDNの形式ガイドに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/png-to-jpg':{
  type:'tool',
  intent:{primary:'convert PNG to JPG',secondary:['what happens to the transparent background','make a PNG photo smaller','PNG to JPG without white box'],
   goal:'a JPG with the right background where the PNG was transparent and an acceptable size',input:'PNG (still, with or without transparency)',output:'JPG, same dimensions, quality 20–100 (default 92), background default white',target:'upload forms, email, apps that need JPG',support:'full',
   evidence:['src/task/convert.js (Im.background for JPG)','src/image.js background()','measured 2026-09-28, Chromium 153: astronaut.png, kenney/pixel-platformer-characters.png'],
   external:['MDN: JPEG has no alpha, lossy DCT; PNG lossless with alpha']},
  en:{
   answer:'PNG to JPG turns a lossless picture into a lossy one that is usually far smaller: the 512 × 512 astronaut photo went from 791,555 to 73,755 bytes at quality 92. JPG cannot store transparency, so every transparent or half-transparent pixel is blended onto a background colour — white unless you change it under Advanced. Convert photos this way; keep screenshots, logos with transparency and pixel art as PNG. The JPG has the same width and height; quality runs from 20 to 100.',
   concept:{title:'Lossless with alpha → lossy without alpha',body:[
    'A PNG stores every pixel exactly, plus an optional alpha value per pixel. JPG cuts the picture into 8 × 8 blocks, keeps the strong frequencies of each block and rounds away the weak ones. On a photo that is hard to see; on hard edges and text it shows as ringing and smeared colour.',
    'Because JPG has no alpha channel, the converter first paints the whole canvas in the JPG background colour and draws the PNG on top. Fully transparent pixels become exactly that colour; half-transparent edges (anti-aliasing, soft shadows) become a mix of edge and background. A cut-out converted on white therefore looks clean on a white page and shows a light rim on a dark one.',
    'Quality is the encoder\'s trade-off setting, not a percentage of the original: lower numbers give smaller files and more visible blocks. If you have a byte limit rather than a quality in mind, [[image/compress-to-100kb|compress to 100 KB]] searches the quality for you.'],
    terms:[['Alpha channel','Per-pixel opacity. PNG has it; JPG does not.'],['JPG background','The colour that replaces transparency: `#ffffff` by default, changeable under Advanced.'],['Quality','Encoder setting 20–100; 92 by default here. PNG ignores it.']]},
   example:{title:'Two real PNGs converted (measured)',lead:'Nerulio\'s converter code in Chromium 153 on 2026-09-28, default quality 92 and white background.',lines:[
    'Photo: astronaut.png (NASA, 512 × 512, opaque)',
    '  PNG 791,555 bytes  ->  JPG 73,755 bytes   (9.3 % of the size)',
    '  SSIM 0.9874, PSNR 37.25 dB, largest channel error 54 of 255',
    '',
    'Pixel art: Kenney pixel-platformer-characters.png (224 × 74)',
    '  8,095 of 16,576 pixels are transparent',
    '  PNG 1,996 bytes    ->  JPG 12,379 bytes   (6.2 × larger)',
    '  all 8,095 transparent pixels are now white'],
    after:'The photo shrinks by 91 %; the sprite sheet grows six-fold and loses its transparency. Small flat-colour PNGs compress better than any JPG.'},
   mapping:{title:'What happens to each part of the PNG',head:['In the PNG','What the converter does','In the JPG'],rows:[
    ['RGB pixels','Encoded lossily at the chosen quality','Same width and height, small errors (max 54/255 on the photo)'],
    ['Fully transparent pixels','Painted with the background colour first','Exactly the background colour'],
    ['Half-transparent edges','Blended with the background colour','A fixed mixed colour; a rim on other backgrounds'],
    ['Colour profile (`iCCP` chunk)','Drawn into the browser\'s sRGB canvas','sRGB profile written by Chromium'],
    ['Text chunks, EXIF','Not copied','None'],
    ['Animated PNG (APNG)','Rejected before converting','—']]},
   verify:{steps:[
    'Open the JPG on a dark background or in a dark-mode viewer: former transparent areas show your chosen colour, and cut-out edges should not have a rim you did not expect.',
    'Zoom to 200 % on text or sharp lines. Blocks or coloured fringes there mean this picture should stay PNG.',
    'Compare the byte counts in the result list; icons and pixel art that were already small usually get bigger as JPG.']},
   trouble:{rows:[
    ['A white box around the logo','JPG has no transparency; transparent pixels became the background colour','Open the PNG: is the background checkered?','Keep PNG, use [[image/png-to-webp|PNG to WebP]], or set the page\'s background colour under Advanced so the box blends in'],
    ['A light or dark rim around a cut-out','Half-transparent edge pixels were blended with white','Place the JPG on the page\'s real background','Pick that background colour before converting'],
    ['Text looks smudged','JPG blocks and colour loss around sharp edges','Zoom in on the letters','Keep the screenshot as PNG; raising quality to 100 helps but JPG stays lossy'],
    ['The JPG is bigger than the PNG','Small flat-colour PNG (icons, pixel art); PNG compresses those far better','Compare the two sizes in the result list','Keep the PNG — JPG only pays off on photos'],
    ['The upload form still says the file is too large','Quality 92 is too big for the limit','Read the byte count','Use [[image/compress-to-200kb|compress to 200 KB]] or the size the form names']]},
   alternatives:{rows:[
    ['[[image/png-to-webp|PNG to WebP]]','The destination accepts WebP and you need to keep transparency, or want a smaller file at similar quality.'],
    ['[[image/compress|Compress]] with Auto format','You care about the byte limit, not the extension: PNG, JPG and WebP candidates are compared for you.'],
    ['Export JPG from the program that made the PNG','You still have the layered original; exporting from it avoids one lossy generation and can keep metadata.']]},
   limits:['EXIF and PNG text chunks are not copied; the JPG carries Chromium\'s sRGB profile.','One flat background colour per image; placing the picture on a photo or gradient background is not possible here.'],
   versions:{body:['Sizes, SSIM and pixel counts were measured on 2026-09-28 in Playwright Chromium 153 with the same calls `src/task/convert.js` makes (`Im.background`, then `canvas.toBlob` at 0.92), on `tests/fixtures/astronaut.png` and `tests/fixtures/kenney/pixel-platformer-characters.png`. What JPG and PNG can store follows MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'PNG를 JPG로 바꾸면 무손실 그림이 손실 압축 그림이 되고 보통 훨씬 작아집니다. 512 × 512 우주비행사 사진은 화질 92에서 791,555바이트가 73,755바이트가 됐습니다. JPG는 투명도를 저장하지 못하므로 투명하거나 반투명한 픽셀은 모두 배경색(고급 설정에서 바꾸지 않으면 흰색)과 합쳐집니다. 사진은 이렇게 바꾸고, 스크린샷·투명 로고·도트 그림은 PNG로 두세요. 가로·세로는 그대로이며 화질은 20~100입니다.',
   concept:{title:'알파가 있는 무손실 → 알파가 없는 손실',body:[
    'PNG는 모든 픽셀을 정확히 저장하고 픽셀마다 알파 값을 가질 수 있습니다. JPG는 그림을 8 × 8 블록으로 나눠 각 블록의 강한 주파수 성분만 남기고 약한 성분은 반올림해 버립니다. 사진에서는 잘 보이지 않지만 선명한 경계나 글자에서는 물결무늬와 색 번짐으로 드러납니다.',
    'JPG에는 알파 채널이 없어서 변환기는 먼저 캔버스 전체를 JPG 배경색으로 칠하고 그 위에 PNG를 그립니다. 완전히 투명한 픽셀은 그 색이 되고, 반투명한 가장자리(안티앨리어싱, 부드러운 그림자)는 가장자리 색과 배경색이 섞입니다. 그래서 흰 배경으로 변환한 누끼는 흰 페이지에서는 깔끔하지만 어두운 페이지에서는 밝은 테두리가 보입니다.',
    '화질은 원본 대비 비율이 아니라 인코더의 절충 설정입니다. 낮출수록 파일은 작아지고 블록이 더 보입니다. 화질 대신 바이트 제한이 정해져 있다면 [[image/compress-to-100kb|100KB 이하로 압축]]이 화질을 대신 찾아 줍니다.'],
    terms:[['알파 채널','픽셀별 불투명도. PNG에는 있고 JPG에는 없습니다.'],['JPG 배경색','투명 부분을 대신하는 색. 기본 `#ffffff`이며 고급 설정에서 바꿉니다.'],['화질','20~100의 인코더 설정. 여기서는 기본 92이며 PNG에는 적용되지 않습니다.']]},
   example:{title:'실제 PNG 두 장을 변환한 결과(실측)',lead:'2026-09-28 Chromium 153에서 Nerulio 변환 코드, 기본 화질 92와 흰 배경으로 측정했습니다.',lines:[
    '사진: astronaut.png (NASA, 512 × 512, 불투명)',
    '  PNG 791,555 바이트  ->  JPG 73,755 바이트   (크기 9.3 %)',
    '  SSIM 0.9874, PSNR 37.25 dB, 채널 최대 오차 54/255',
    '',
    '도트 그림: Kenney pixel-platformer-characters.png (224 × 74)',
    '  16,576픽셀 중 8,095픽셀이 투명',
    '  PNG 1,996 바이트    ->  JPG 12,379 바이트   (6.2배 커짐)',
    '  투명했던 8,095픽셀이 모두 흰색으로'],
    after:'사진은 91% 줄었지만 스프라이트 시트는 6배 커지고 투명도도 잃었습니다. 단색 위주의 작은 PNG는 어떤 JPG보다도 잘 압축됩니다.'},
   mapping:{title:'PNG의 각 요소는 어떻게 되나',head:['PNG에 있던 것','변환기가 하는 일','JPG에서는'],rows:[
    ['RGB 픽셀','선택한 화질로 손실 인코딩','가로·세로 동일, 작은 오차(사진에서 최대 54/255)'],
    ['완전히 투명한 픽셀','먼저 배경색으로 칠함','정확히 배경색'],
    ['반투명 가장자리','배경색과 섞음','고정된 중간색. 다른 배경에서는 테두리로 보임'],
    ['색상 프로필(`iCCP` 청크)','브라우저의 sRGB 캔버스에 그림','Chromium이 sRGB 프로필을 기록'],
    ['텍스트 청크·EXIF','복사하지 않음','없음'],
    ['움직이는 PNG(APNG)','변환 전에 거부','—']]},
   verify:{steps:[
    'JPG를 어두운 배경이나 다크 모드 뷰어에서 열어 보세요. 투명했던 곳은 고른 색이어야 하고 누끼 가장자리에 예상치 못한 테두리가 없어야 합니다.',
    '글자나 선명한 선을 200%로 확대하세요. 블록이나 색 번짐이 보이면 그 그림은 PNG로 두는 게 맞습니다.',
    '결과 목록의 바이트 수를 비교하세요. 원래 작던 아이콘·도트 그림은 JPG로 바꾸면 대개 커집니다.']},
   trouble:{rows:[
    ['로고 주변에 흰 상자가 생김','JPG는 투명도를 저장하지 못해 투명 픽셀이 배경색이 됐습니다','PNG를 열어 배경이 체크무늬인지 확인','PNG를 유지하거나 [[image/png-to-webp|PNG → WebP]]를 쓰거나, 고급 설정에서 페이지 배경색을 지정해 상자가 묻히게 하세요'],
    ['누끼 가장자리에 밝거나 어두운 테두리','반투명 가장자리 픽셀이 흰색과 섞였습니다','실제 쓰일 배경 위에 JPG를 놓아 보기','변환 전에 그 배경색을 고르세요'],
    ['글자가 뭉개져 보임','선명한 경계 주변의 JPG 블록과 색 손실','글자를 확대해서 보기','스크린샷은 PNG로 두세요. 화질 100으로 올리면 나아지지만 JPG는 여전히 손실 압축입니다'],
    ['JPG가 PNG보다 큼','단색 위주의 작은 PNG(아이콘·도트)는 PNG가 훨씬 잘 압축합니다','결과 목록에서 두 용량 비교','PNG를 쓰세요. JPG는 사진에서만 이득입니다'],
    ['업로드 양식이 여전히 용량 초과라고 함','화질 92로는 제한보다 큽니다','바이트 수 확인','[[image/compress-to-200kb|200KB 이하로 압축]]처럼 양식이 요구하는 크기로 압축하세요']]},
   alternatives:{rows:[
    ['[[image/png-to-webp|PNG → WebP]]','받는 곳이 WebP를 받고 투명도를 유지해야 하거나, 비슷한 화질에서 더 작은 파일이 필요할 때.'],
    ['자동 형식으로 [[image/compress|압축]]','확장자보다 용량 제한이 중요할 때. PNG·JPG·WebP 후보를 대신 비교해 줍니다.'],
    ['PNG를 만든 프로그램에서 JPG로 내보내기','레이어가 있는 원본이 남아 있을 때. 손실 단계를 한 번 줄이고 메타데이터도 유지할 수 있습니다.']]},
   limits:['EXIF와 PNG 텍스트 청크는 복사되지 않고, JPG에는 Chromium의 sRGB 프로필이 들어갑니다.','이미지당 단색 배경 하나만 지정할 수 있으며 사진이나 그라데이션 배경 위에 합성할 수는 없습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/convert.js`와 같은 호출(`Im.background` 후 `canvas.toBlob` 0.92)로 `tests/fixtures/astronaut.png`와 `tests/fixtures/kenney/pixel-platformer-characters.png`의 용량·SSIM·픽셀 수를 측정했습니다. JPG와 PNG가 저장할 수 있는 정보는 MDN을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'PNGをJPGにすると、可逆の画像が非可逆になり、たいていはずっと小さくなります。512 × 512の宇宙飛行士の写真は、画質92で791,555バイトから73,755バイトになりました。JPGは透明を保存できないため、透明・半透明のピクセルはすべて背景色（詳細設定で変えなければ白）と合成されます。写真はこの変換でよく、スクリーンショット・透過ロゴ・ドット絵はPNGのままにします。幅と高さは同じで、画質は20〜100です。',
   concept:{title:'アルファ付きの可逆 → アルファなしの非可逆',body:[
    'PNGはすべてのピクセルを正確に保存し、ピクセルごとにアルファ値を持てます。JPGは画像を8 × 8のブロックに分け、各ブロックの強い周波数成分だけを残して弱い成分を丸めて捨てます。写真では目立ちませんが、くっきりした輪郭や文字ではリンギングや色のにじみとして現れます。',
    'JPGにはアルファチャンネルがないため、変換ではまずキャンバス全体をJPGの背景色で塗り、その上にPNGを描きます。完全に透明なピクセルはその色になり、半透明の縁（アンチエイリアス、柔らかい影）は縁の色と背景色が混ざります。白で変換した切り抜きは白いページではきれいでも、暗いページでは明るい縁取りが見えるのはこのためです。',
    '画質は元に対する割合ではなく、エンコーダーの調整値です。下げるほど小さくなり、ブロックが見えやすくなります。画質ではなくバイト数の上限が決まっているなら、[[image/compress-to-100kb|100KB以下に圧縮]]が画質を自動で探します。'],
    terms:[['アルファチャンネル','ピクセルごとの不透明度。PNGにはあり、JPGにはありません。'],['JPGの背景色','透明部分の代わりに入る色。初期値は `#ffffff` で、詳細設定で変更できます。'],['画質','20〜100のエンコーダー設定。ここでは初期値92で、PNGには効きません。']]},
   example:{title:'実際のPNG 2枚を変換した結果（実測）',lead:'2026-09-28にChromium 153で、Nerulioの変換コード、初期値の画質92と白背景で計測しました。',lines:[
    '写真: astronaut.png（NASA、512 × 512、不透明）',
    '  PNG 791,555 バイト  ->  JPG 73,755 バイト   （9.3 %）',
    '  SSIM 0.9874、PSNR 37.25 dB、チャンネル最大誤差 54/255',
    '',
    'ドット絵: Kenney pixel-platformer-characters.png（224 × 74）',
    '  16,576ピクセル中8,095ピクセルが透明',
    '  PNG 1,996 バイト    ->  JPG 12,379 バイト   （6.2倍に増加）',
    '  透明だった8,095ピクセルはすべて白に'],
    after:'写真は91%小さくなりましたが、スプライトシートは6倍に増え、透明も失いました。単色主体の小さなPNGは、どのJPGよりもよく圧縮されます。'},
   mapping:{title:'PNGの各要素はどうなるか',head:['PNGにあったもの','変換での処理','JPGでは'],rows:[
    ['RGBピクセル','選んだ画質で非可逆エンコード','幅・高さは同じ、小さな誤差（写真で最大54/255）'],
    ['完全に透明なピクセル','先に背景色で塗る','背景色そのもの'],
    ['半透明の縁','背景色と合成','固定された中間色。別の背景では縁取りに見える'],
    ['カラープロファイル（`iCCP`チャンク）','ブラウザのsRGBキャンバスに描画','ChromiumがsRGBプロファイルを書き込む'],
    ['テキストチャンク・EXIF','コピーしない','なし'],
    ['アニメーションPNG（APNG）','変換前に拒否','—']]},
   verify:{steps:[
    'JPGを暗い背景やダークモードのビューアで開きます。透明だった部分は選んだ色になり、切り抜きの縁に想定外の縁取りがないことを確認します。',
    '文字やくっきりした線を200%に拡大します。ブロックや色のにじみが見えるなら、その画像はPNGのままが適切です。',
    '結果一覧のバイト数を比べます。もともと小さいアイコンやドット絵は、JPGにするとたいてい大きくなります。']},
   trouble:{rows:[
    ['ロゴの周りに白い四角が出る','JPGは透明を保存できず、透明ピクセルが背景色になった','PNGを開いて背景が市松模様か確認','PNGのままにするか[[image/png-to-webp|PNG → WebP]]を使うか、詳細設定でページの背景色を指定して四角をなじませます'],
    ['切り抜きの縁に明るい・暗い縁取り','半透明の縁のピクセルが白と合成された','実際に使う背景の上にJPGを置いてみる','変換前にその背景色を選びます'],
    ['文字がつぶれて見える','くっきりした輪郭まわりのJPGブロックと色の欠落','文字を拡大して見る','スクリーンショットはPNGのままに。画質100にすると改善しますがJPGは非可逆のままです'],
    ['JPGのほうがPNGより大きい','単色主体の小さなPNG（アイコン・ドット絵）はPNGのほうがずっとよく圧縮できる','結果一覧で2つの容量を比べる','PNGを使います。JPGが得なのは写真だけです'],
    ['アップロードフォームがまだ容量オーバーと言う','画質92では上限を超えている','バイト数を確認','[[image/compress-to-200kb|200KB以下に圧縮]]など、フォームが指定するサイズに圧縮します']]},
   alternatives:{rows:[
    ['[[image/png-to-webp|PNG → WebP]]','提出先がWebPを受け付け、透過を残したい場合や、同程度の画質でより小さくしたい場合。'],
    ['自動形式で[[image/compress|圧縮]]','拡張子より容量の上限が大事な場合。PNG・JPG・WebPの候補を比べてくれます。'],
    ['PNGを作ったソフトからJPGで書き出す','レイヤー付きの元データが残っている場合。非可逆の段階が1回減り、メタデータも残せます。']]},
   limits:['EXIFとPNGのテキストチャンクはコピーされず、JPGにはChromiumのsRGBプロファイルが入ります。','背景色は画像ごとに単色1つだけで、写真やグラデーションの上に合成することはできません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/convert.js` と同じ呼び出し（`Im.background` のあと `canvas.toBlob` を0.92で）を使い、`tests/fixtures/astronaut.png` と `tests/fixtures/kenney/pixel-platformer-characters.png` の容量・SSIM・ピクセル数を計測しました。JPGとPNGが保存できる情報はMDNに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/jpg-to-png':{
  type:'tool',
  intent:{primary:'convert JPG to PNG',secondary:['does PNG improve quality','why is the PNG so big','JPG to PNG with transparent background'],
   goal:'a PNG that a program accepts, understanding it is identical to the JPG and bigger',input:'JPG/JPEG photo or graphic',output:'PNG (lossless), same dimensions, no transparency added',target:'apps and forms that require PNG, lossless working copies',support:'full',
   evidence:['src/task/convert.js','measured 2026-09-28, Chromium 153: astronaut.jpg (Pillow q92 from tests/fixtures/astronaut.png, with EXIF+GPS+ICC)'],
   external:['MDN: PNG lossless (DEFLATE), JPEG lossy']},
  en:{
   answer:'JPG to PNG stores the decoded JPG pixels losslessly. It does not restore detail or remove JPG artefacts — the PNG is pixel-for-pixel the JPG you had — and it is much larger: a 512 × 512 photo went from 75,758 to 489,655 bytes (6.5 ×). Do it when a program demands PNG, or before several rounds of editing so that each save stops adding JPG loss. No transparency is created; the picture stays fully opaque.',
   concept:{title:'Why the PNG is bigger but not better',body:[
    'A JPG stores an approximation of the photo. Decoding it produces a fixed grid of RGB pixels, including the faint 8 × 8 blocks and colour smearing the JPG encoder introduced. PNG then stores exactly that grid, so the artefacts become permanent rather than repaired.',
    'PNG compresses by predicting each pixel from its neighbours and deflating the difference. Camera noise is hard to predict, so photos are the worst case for PNG; flat colour, text and line art compress much better. How much the file grows therefore depends on the content, and a photo grows the most.',
    'What PNG does stop is generation loss from here on: saving a PNG again loses nothing, while saving a JPG again re-quantises it (the same photo re-encoded as JPG quality 92 measured SSIM 0.9997 — small, but it adds up over many saves).'],
    terms:[['DEFLATE','The lossless compression inside PNG; it works well on flat areas and poorly on noise.'],['JPG artefacts','Blocks, ringing and colour bleeding left by lossy compression; conversion keeps them.'],['Generation loss','Extra error added every time a lossy file is decoded and saved again.']]},
   example:{title:'A JPG photo saved three ways (measured)',lead:'The JPG was made from the NASA fixture with Pillow at quality 92 (512 × 512, 75,758 bytes, with EXIF, a GPS tag and an sRGB profile). Converted with Nerulio\'s code in Chromium 153 on 2026-09-28.',lines:[
    'Source: astronaut.jpg    75,758 bytes',
    '',
    '-> PNG         489,655 bytes   6.5 x larger   identical to the decoded JPG',
    '-> WebP q100   276,100 bytes   3.6 x larger   identical (lossless WebP)',
    '-> JPG q92      73,544 bytes   re-encoded     SSIM 0.9997',
    '',
    'EXIF and GPS in the outputs: none'],
    after:'If the program accepts WebP, a lossless WebP holds the same pixels in 44 % less space than the PNG.'},
   mapping:{title:'What the PNG receives from the JPG',head:['In the JPG','What the converter does','In the PNG'],rows:[
    ['Decoded pixels, artefacts included','Stored losslessly','Identical pixels (largest difference 0)'],
    ['EXIF orientation flag','Applied to the pixels while decoding','Upright pixels, no orientation tag'],
    ['EXIF date, camera, GPS','Not copied','Gone — checked on a JPG with a GPS tag'],
    ['ICC colour profile','Drawn in the browser\'s sRGB canvas','No profile chunk (PNG output has none)'],
    ['Quality slider','Ignored for PNG','Always lossless']]},
   verify:{steps:[
    'Open both files at 100 %: they should look identical. A visible difference means something else happened (a filter or a resize).',
    'Check that the program that asked for PNG now accepts it. If it wanted a transparent background, the JPG had none to give — remove the background first.',
    'If the capture date or location matters to you, open the PNG\'s file information: those fields are empty.']},
   trouble:{rows:[
    ['The PNG looks just as blocky as the JPG','Conversion keeps the decoded pixels; it cannot undo JPG compression','Zoom in on sky or skin in both files','Go back to the camera original or a RAW export; the JPG has nothing more to give'],
    ['The file is several times bigger','PNG is lossless and photo noise compresses badly','Compare the byte counts','Keep the JPG unless PNG is required, or use [[image/jpg-to-webp|lossless WebP]] (quality 100) to save about 44 %'],
    ['Still no transparent background','A JPG has no alpha, so the PNG is fully opaque','Look at it on a checkered background','Cut the subject out with [[image/remove-bg|background removal]], which writes PNG with alpha'],
    ['Capture date or location missing in the gallery','EXIF is not written to the PNG','File information in the OS','Keep the original JPG alongside, or use a converter that copies metadata']]},
   alternatives:{rows:[
    ['Keep the JPG','The destination accepts JPG; converting gains nothing.'],
    ['[[image/jpg-to-webp|JPG to WebP]] at quality 100','You want a lossless working copy that is smaller than PNG (276,100 vs 489,655 bytes here).'],
    ['[[image/editor|Edit first, export PNG once]]','You will crop or resize anyway: the editor exports PNG by default after all edits.']]},
   limits:['It cannot restore detail lost to JPG compression and cannot create transparency.','Metadata is dropped: EXIF, including GPS and capture date, is not written to the PNG.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path. The test JPG was written by Pillow 12.3 at quality 92 from `tests/fixtures/astronaut.png` and carried EXIF with a GPS tag and an sRGB profile; neither reached the PNG.'],sources:[MDN.en]}
  },
  ko:{
   answer:'JPG를 PNG로 바꾸면 디코딩한 JPG 픽셀을 무손실로 저장합니다. 사라진 디테일이 돌아오거나 JPG 뭉개짐이 지워지지는 않습니다. PNG는 원래 JPG와 픽셀 하나하나까지 같고 크기만 훨씬 큽니다. 512 × 512 사진은 75,758바이트가 489,655바이트(6.5배)가 됐습니다. 프로그램이 PNG를 요구할 때, 또는 여러 번 편집하기 전에 저장할 때마다 JPG 손실이 쌓이지 않게 하려고 바꾸세요. 투명도는 새로 생기지 않고 그림은 완전히 불투명합니다.',
   concept:{title:'PNG가 더 크지만 더 좋지는 않은 이유',body:[
    'JPG는 사진의 근사치를 저장합니다. 이를 디코딩하면 JPG 인코더가 만든 희미한 8 × 8 블록과 색 번짐까지 포함한 RGB 픽셀 격자가 나옵니다. PNG는 그 격자를 정확히 저장하므로 뭉개짐은 고쳐지는 게 아니라 영구히 남습니다.',
    'PNG는 각 픽셀을 이웃 픽셀로 예측하고 그 차이를 압축합니다. 카메라 노이즈는 예측하기 어려워 사진은 PNG에서 가장 불리하고, 단색·글자·선화는 훨씬 잘 압축됩니다. 그래서 얼마나 커지는지는 내용에 따라 다르며 사진이 가장 많이 커집니다.',
    '대신 PNG는 이후의 세대 손실을 막아 줍니다. PNG는 다시 저장해도 잃는 것이 없지만 JPG는 다시 저장할 때마다 다시 양자화됩니다(같은 사진을 JPG 화질 92로 다시 저장하면 SSIM 0.9997 — 작지만 여러 번 저장하면 쌓입니다).'],
    terms:[['DEFLATE','PNG 안의 무손실 압축. 평평한 영역에 강하고 노이즈에 약합니다.'],['JPG 뭉개짐','손실 압축이 남긴 블록·물결무늬·색 번짐. 변환해도 그대로 남습니다.'],['세대 손실','손실 형식 파일을 풀었다가 다시 저장할 때마다 더해지는 오차.']]},
   example:{title:'JPG 사진을 세 가지로 저장한 결과(실측)',lead:'JPG는 NASA 테스트 사진을 Pillow 화질 92로 저장한 것입니다(512 × 512, 75,758바이트, EXIF·GPS 태그·sRGB 프로필 포함). 2026-09-28 Chromium 153에서 Nerulio 코드로 변환했습니다.',lines:[
    '원본: astronaut.jpg     75,758 바이트',
    '',
    '-> PNG         489,655 바이트   6.5배   디코딩한 JPG와 동일',
    '-> WebP q100   276,100 바이트   3.6배   동일 (무손실 WebP)',
    '-> JPG q92      73,544 바이트   재인코딩  SSIM 0.9997',
    '',
    '출력에 남은 EXIF·GPS: 없음'],
    after:'받는 프로그램이 WebP를 지원한다면 무손실 WebP가 같은 픽셀을 PNG보다 44% 작게 담습니다.'},
   mapping:{title:'JPG에서 PNG로 넘어가는 것',head:['JPG에 있던 것','변환기가 하는 일','PNG에서는'],rows:[
    ['디코딩된 픽셀(뭉개짐 포함)','무손실로 저장','픽셀 동일(최대 차이 0)'],
    ['EXIF 회전 정보','디코딩할 때 픽셀에 적용','바로 선 픽셀, 회전 태그 없음'],
    ['EXIF 날짜·카메라·GPS','복사하지 않음','없음 — GPS 태그가 있는 JPG로 확인'],
    ['ICC 색상 프로필','브라우저 sRGB 캔버스에 그림','프로필 청크 없음(PNG 출력에는 없음)'],
    ['화질 슬라이더','PNG에는 무시','항상 무손실']]},
   verify:{steps:[
    '두 파일을 100%로 열어 보세요. 똑같아 보여야 하며, 차이가 보이면 필터나 크기 변경 같은 다른 처리가 있었다는 뜻입니다.',
    'PNG를 요구한 프로그램이 이제 받아 주는지 확인하세요. 투명 배경을 원했다면 JPG에는 줄 투명도가 없으니 먼저 배경을 지우세요.',
    '촬영 날짜나 위치가 중요하다면 PNG의 파일 정보를 열어 보세요. 해당 항목이 비어 있습니다.']},
   trouble:{rows:[
    ['PNG도 JPG만큼 뭉개져 보임','변환은 디코딩된 픽셀을 그대로 보관할 뿐 JPG 압축을 되돌리지 못합니다','두 파일의 하늘이나 피부를 확대해 비교','카메라 원본이나 RAW에서 다시 내보내세요. JPG에서는 더 얻을 것이 없습니다'],
    ['파일이 몇 배로 커짐','PNG는 무손실이고 사진 노이즈는 잘 압축되지 않습니다','바이트 수 비교','PNG가 꼭 필요하지 않으면 JPG를 쓰거나, [[image/jpg-to-webp|무손실 WebP]](화질 100)로 약 44% 아끼세요'],
    ['여전히 투명 배경이 아님','JPG에는 알파가 없어 PNG도 완전히 불투명합니다','체크무늬 배경 위에서 보기','[[image/remove-bg|배경 제거]]로 피사체를 오려 알파가 있는 PNG로 저장하세요'],
    ['갤러리에서 촬영 날짜·위치가 사라짐','PNG에는 EXIF를 기록하지 않습니다','운영체제의 파일 정보','원본 JPG를 함께 보관하거나 메타데이터를 복사하는 변환기를 쓰세요']]},
   alternatives:{rows:[
    ['JPG 그대로 쓰기','받는 곳이 JPG를 받는다면 변환해서 얻는 것이 없습니다.'],
    ['화질 100으로 [[image/jpg-to-webp|JPG → WebP]]','PNG보다 작은 무손실 작업본이 필요할 때(여기서는 276,100 대 489,655바이트).'],
    ['[[image/editor|먼저 편집하고 PNG로 한 번 저장]]','어차피 자르거나 크기를 바꿀 때. 편집기는 모든 편집 후 기본값으로 PNG를 저장합니다.']]},
   limits:['JPG 압축으로 사라진 디테일을 되살리거나 투명도를 만들 수는 없습니다.','메타데이터는 버려집니다. GPS와 촬영 날짜를 포함한 EXIF가 PNG에 기록되지 않습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로 측정했습니다. 테스트 JPG는 `tests/fixtures/astronaut.png`에서 Pillow 12.3 화질 92로 만들었고 GPS 태그가 든 EXIF와 sRGB 프로필이 있었지만 둘 다 PNG에 남지 않았습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'JPGをPNGにすると、展開したJPGのピクセルを可逆で保存します。失われた細部が戻ったり、JPGのブロックノイズが消えたりはしません。PNGは元のJPGとピクセル単位で同じで、容量だけがずっと大きくなります。512 × 512の写真は75,758バイトから489,655バイト（6.5倍）になりました。PNGを求めるソフトに渡すとき、または何度も編集する前に、保存のたびにJPGの劣化が重ならないようにするときに変換します。透明は新たに生まれず、画像は完全に不透明のままです。',
   concept:{title:'PNGが大きくても画質が上がらない理由',body:[
    'JPGは写真の近似値を保存しています。展開すると、JPGエンコーダーが生んだかすかな8 × 8のブロックや色のにじみまで含んだRGBピクセルの並びが得られます。PNGはその並びを正確に保存するので、ノイズは修復されるのではなく固定されます。',
    'PNGは各ピクセルを隣のピクセルから予測し、その差分を圧縮します。カメラのノイズは予測しにくいため写真はPNGにとって最も不利で、単色・文字・線画はずっとよく圧縮されます。どれだけ大きくなるかは内容次第で、写真がいちばん増えます。',
    '一方でPNGはこの先の世代劣化を止めます。PNGは保存し直しても何も失いませんが、JPGは保存し直すたびに量子化し直されます（同じ写真をJPG画質92で保存し直すとSSIM 0.9997。小さな差ですが回数を重ねると積み重なります）。'],
    terms:[['DEFLATE','PNG内部の可逆圧縮。平坦な部分に強く、ノイズに弱い方式です。'],['JPGのノイズ','非可逆圧縮が残すブロック・リンギング・色のにじみ。変換しても残ります。'],['世代劣化','非可逆ファイルを展開して保存し直すたびに加わる誤差。']]},
   example:{title:'JPG写真を3通りに保存した結果（実測）',lead:'JPGはNASAのテスト写真をPillowの画質92で保存したものです（512 × 512、75,758バイト、EXIF・GPSタグ・sRGBプロファイル付き）。2026-09-28にChromium 153でNerulioのコードを使って変換しました。',lines:[
    '元画像: astronaut.jpg    75,758 バイト',
    '',
    '-> PNG         489,655 バイト   6.5倍   展開したJPGと同一',
    '-> WebP q100   276,100 バイト   3.6倍   同一（可逆WebP）',
    '-> JPG q92      73,544 バイト   再エンコード  SSIM 0.9997',
    '',
    '出力に残ったEXIF・GPS: なし'],
    after:'受け取るソフトがWebPに対応しているなら、可逆WebPなら同じピクセルをPNGより44%小さく保存できます。'},
   mapping:{title:'JPGからPNGに引き継がれるもの',head:['JPGにあったもの','変換での処理','PNGでは'],rows:[
    ['展開したピクセル（ノイズ込み）','可逆で保存','ピクセルは同一（最大差0）'],
    ['EXIFの回転情報','展開時にピクセルへ適用','正しい向きのピクセル、回転タグなし'],
    ['EXIFの日時・カメラ・GPS','コピーしない','なし（GPSタグ付きのJPGで確認）'],
    ['ICCカラープロファイル','ブラウザのsRGBキャンバスに描画','プロファイルのチャンクなし（PNG出力には入らない）'],
    ['画質スライダー','PNGでは無視','常に可逆']]},
   verify:{steps:[
    '2つのファイルを100%で開きます。見た目は同じはずで、違いがあればフィルターやサイズ変更など別の処理が入っています。',
    'PNGを求めたソフトが受け付けるか確認します。透過背景が目的なら、JPGには渡せる透明がないので先に背景を消します。',
    '撮影日時や位置が大事なら、PNGのファイル情報を開いてください。その項目は空になっています。']},
   trouble:{rows:[
    ['PNGもJPGと同じくらいブロックが見える','変換は展開したピクセルを保持するだけで、JPGの圧縮を元に戻せない','両方の空や肌を拡大して比べる','カメラの元データやRAWから書き出し直します。JPGからはこれ以上取り出せません'],
    ['ファイルが数倍に増えた','PNGは可逆で、写真のノイズはうまく圧縮できない','バイト数を比べる','PNGが必須でなければJPGのままにするか、[[image/jpg-to-webp|可逆WebP]]（画質100）で約44%節約します'],
    ['まだ背景が透明にならない','JPGにはアルファがないので、PNGも完全に不透明','市松模様の背景で見る','[[image/remove-bg|背景除去]]で被写体を切り抜き、アルファ付きPNGで保存します'],
    ['ギャラリーで撮影日時・位置が消えた','PNGにはEXIFを書き込まない','OSのファイル情報','元のJPGも一緒に保管するか、メタデータをコピーする変換ツールを使います']]},
   alternatives:{rows:[
    ['JPGのまま使う','提出先がJPGを受け付けるなら、変換して得るものはありません。'],
    ['画質100で[[image/jpg-to-webp|JPG → WebP]]','PNGより小さい可逆の作業用ファイルが欲しい場合（ここでは276,100対489,655バイト）。'],
    ['[[image/editor|先に編集してPNGで1回だけ保存]]','どうせ切り抜きやサイズ変更をする場合。エディターはすべての編集後、初期設定でPNGを書き出します。']]},
   limits:['JPG圧縮で失われた細部の復元や、透明の生成はできません。','メタデータは捨てられます。GPSや撮影日時を含むEXIFはPNGに書き込まれません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使って計測しました。テスト用JPGは `tests/fixtures/astronaut.png` からPillow 12.3の画質92で作成し、GPSタグ付きEXIFとsRGBプロファイルを含んでいましたが、どちらもPNGには残りませんでした。'],sources:[MDN.ja]}
  }
 },
 'image/png-to-webp':{
  type:'tool',
  intent:{primary:'convert PNG to WebP',secondary:['keep transparency in WebP','lossless WebP from PNG','is WebP smaller than PNG'],
   goal:'a WebP that keeps transparency, lossy for photos and lossless for graphics',input:'PNG (still, transparent or opaque)',output:'WebP, lossy at quality < 100, lossless at 100 in Chromium; alpha kept',target:'websites, apps that accept WebP',support:'full',
   evidence:['src/task/convert.js','measured 2026-09-28, Chromium 153: astronaut.png, kenney pixel-platformer-characters.png, kenney-blue-button.png'],
   external:['MDN: WebP lossy (VP8, 4:2:0) and lossless, alpha']},
  en:{
   answer:'PNG to WebP keeps transparency and usually shrinks the file, but which kind of WebP you write matters. At the default quality 92 the WebP is lossy: the 512 × 512 photo went from 791,555 to 59,824 bytes. At quality 100 Chromium writes lossless WebP, pixel-identical to the PNG — 379,076 bytes for that photo. For pixel art lossy WebP is the wrong choice: on a Kenney sprite sheet it changed half the pixels and came out at 8,692 bytes, against 2,814 lossless and 1,996 for the original optimised PNG.',
   concept:{title:'Two different encoders behind one extension',body:[
    'Lossy WebP is based on the VP8 video codec and stores colour at half resolution (Y′CbCr 4:2:0). Lossless WebP stores exact ARGB and compresses by predicting pixels and reusing repeated data. Both keep an alpha channel, so a transparent PNG stays transparent either way.',
    'The browser chooses the encoder from the quality it is given. In Chromium 153 quality 100 produced lossless files — every pixel identical — and anything lower produced lossy ones. The slider starts at 92, so move it to 100 for UI, text and pixel art.',
    'Lossy WebP damages hard pixel edges in the colour channels: on the Kenney sheet the largest error was 108 of 255 while alpha stayed exact. [[image/png-to-jpg|JPG]] would be worse still for such a file, because it drops alpha altogether.'],
    terms:[['Lossy WebP','VP8-based, colour at half resolution; small files for photos.'],['Lossless WebP','Exact ARGB pixels; written by Chromium at quality 100.'],['Chroma subsampling 4:2:0','Colour stored for every 2 × 2 block instead of every pixel; smears single-pixel colour details.']]},
   example:{title:'A photo and a sprite sheet as WebP (measured)',lead:'Nerulio\'s converter code, Chromium 153, 2026-09-28.',lines:[
    'Photo: astronaut.png   512 x 512    791,555 bytes',
    '  WebP q92  (lossy)      59,824 bytes   SSIM 0.9883',
    '  WebP q100 (lossless)  379,076 bytes   identical pixels',
    '',
    'Pixel art: Kenney characters   224 x 74    1,996 bytes',
    '  WebP q92  (lossy)       8,692 bytes   8,481 pixels changed, max error 108/255',
    '  WebP q100 (lossless)    2,814 bytes   identical pixels'],
    after:'Soft edges are the one small exception at quality 100: on a Kenney UI button, 26 of 12,288 pixels differed by at most 4/255 (the button has 38 semi-transparent edge pixels, where browsers round premultiplied alpha); everything else matched exactly.'},
   mapping:{title:'What the WebP keeps',head:['In the PNG','What the converter does','In the WebP'],rows:[
    ['RGB pixels','Quality below 100: lossy VP8; 100: lossless (Chromium)','Approximate or identical pixels'],
    ['Alpha channel','Kept','Alpha kept (exact in both measurements)'],
    ['Colour profile','Pixels drawn in the browser\'s sRGB canvas','`ICCP` chunk with sRGB written by Chromium'],
    ['Text chunks, EXIF','Not copied','None'],
    ['APNG animation','Rejected','—']]},
   verify:{steps:[
    'Put the WebP on a dark and on a light background: the transparency should look the same as the PNG\'s.',
    'For graphics, zoom to 400 % on a sharp edge. Coloured smudges mean the file is lossy; convert again at quality 100.',
    'Make sure the destination accepts WebP: current browsers do, some upload forms and older apps do not.']},
   trouble:{rows:[
    ['Pixel art looks soft or has coloured specks','The default quality 92 wrote lossy WebP','Zoom in on one-pixel details','Set quality to 100 under Advanced and convert again (lossless in Chromium)'],
    ['The WebP is bigger than the PNG','A small, already optimised PNG (indexed colours) that lossless WebP could not beat','Compare: 1,996-byte PNG vs 2,814-byte WebP on the Kenney sheet','Keep the PNG'],
    ['The upload form rejects .webp','The site accepts JPG and PNG only','Read its list of accepted formats','Keep the PNG, or use [[image/png-to-jpg|PNG to JPG]] for photos'],
    ['"Lossless" WebP differs in another browser','Only Chromium was measured; another browser may treat quality 100 differently','Compare the pixels with the PNG in an editor','Use PNG where exact pixels are required']]},
   alternatives:{rows:[
    ['Keep the PNG','Pixel art and icons already optimised as PNG — the Kenney sheet stayed smallest as PNG.'],
    ['[[image/compress|Compress with Auto]]','You want the smallest file that stays above a similarity floor, whatever the format.'],
    ['[[image/webp-to-png|WebP to PNG]] later','You only need WebP for the web copy: keep the PNG master and convert back if a tool needs PNG.']]},
   limits:['The switch to lossless at quality 100 was measured in Chromium 153 only.','Text chunks and EXIF are not copied; animated PNG is refused.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path, on the astronaut fixture and two Kenney CC0 files (`pixel-platformer-characters.png`, `kenney-blue-button.png`). WebP\'s lossy and lossless modes and its 4:2:0 colour are described by MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'PNG를 WebP로 바꾸면 투명도가 유지되고 보통 파일이 작아지지만, 어떤 WebP로 저장하느냐가 중요합니다. 기본 화질 92에서는 손실 WebP가 되어 512 × 512 사진이 791,555바이트에서 59,824바이트가 됐습니다. 화질 100이면 Chromium이 PNG와 픽셀까지 같은 무손실 WebP를 쓰며 같은 사진이 379,076바이트였습니다. 도트 그림에는 손실 WebP가 맞지 않습니다. Kenney 스프라이트 시트에서는 픽셀 절반이 바뀌고 8,692바이트가 됐는데, 무손실은 2,814바이트, 원래 최적화된 PNG는 1,996바이트였습니다.',
   concept:{title:'확장자는 하나, 인코더는 둘',body:[
    '손실 WebP는 VP8 영상 코덱을 바탕으로 하며 색 정보를 절반 해상도(Y′CbCr 4:2:0)로 저장합니다. 무손실 WebP는 정확한 ARGB를 저장하고 픽셀 예측과 반복 데이터 재사용으로 압축합니다. 둘 다 알파 채널이 있어 투명 PNG는 어느 쪽이든 투명하게 남습니다.',
    '어느 인코더를 쓸지는 브라우저가 전달받은 화질로 정합니다. Chromium 153에서는 화질 100이 모든 픽셀이 같은 무손실 파일을, 그보다 낮은 값은 손실 파일을 만들었습니다. 슬라이더 기본값이 92이므로 UI·글자·도트 그림은 100으로 옮기세요.',
    '손실 WebP는 색 채널에서 선명한 픽셀 경계를 망가뜨립니다. Kenney 시트에서 최대 오차는 255 중 108이었고 알파는 정확히 유지됐습니다. 이런 파일에는 알파를 아예 버리는 [[image/png-to-jpg|JPG]]가 더 나쁩니다.'],
    terms:[['손실 WebP','VP8 기반, 색은 절반 해상도. 사진을 작게 저장합니다.'],['무손실 WebP','정확한 ARGB 픽셀. Chromium에서는 화질 100일 때 만들어집니다.'],['크로마 서브샘플링 4:2:0','색을 픽셀마다가 아니라 2 × 2 블록마다 저장하는 방식. 한 픽셀짜리 색 디테일이 번집니다.']]},
   example:{title:'사진과 스프라이트 시트를 WebP로(실측)',lead:'2026-09-28 Chromium 153에서 Nerulio 변환 코드로 측정했습니다.',lines:[
    '사진: astronaut.png   512 x 512    791,555 바이트',
    '  WebP q92  (손실)       59,824 바이트   SSIM 0.9883',
    '  WebP q100 (무손실)    379,076 바이트   픽셀 동일',
    '',
    '도트 그림: Kenney characters   224 x 74    1,996 바이트',
    '  WebP q92  (손실)        8,692 바이트   8,481픽셀 변경, 최대 오차 108/255',
    '  WebP q100 (무손실)      2,814 바이트   픽셀 동일'],
    after:'화질 100에서 유일한 작은 예외는 부드러운 가장자리입니다. Kenney UI 버튼에서는 12,288픽셀 중 26개가 최대 4/255 달랐습니다(이 버튼에는 반투명 가장자리 픽셀이 38개 있고, 브라우저는 여기서 premultiplied 알파를 반올림합니다). 나머지는 모두 정확히 같았습니다.'},
   mapping:{title:'WebP에 남는 것',head:['PNG에 있던 것','변환기가 하는 일','WebP에서는'],rows:[
    ['RGB 픽셀','화질 100 미만: 손실 VP8, 100: 무손실(Chromium)','근사 또는 동일한 픽셀'],
    ['알파 채널','유지','알파 유지(두 측정 모두 정확)'],
    ['색상 프로필','브라우저 sRGB 캔버스에 그림','Chromium이 sRGB `ICCP` 청크를 기록'],
    ['텍스트 청크·EXIF','복사하지 않음','없음'],
    ['APNG 애니메이션','거부','—']]},
   verify:{steps:[
    'WebP를 어두운 배경과 밝은 배경에 각각 올려 보세요. 투명한 부분이 PNG와 똑같이 보여야 합니다.',
    '그래픽이라면 선명한 경계를 400%로 확대하세요. 색 얼룩이 보이면 손실 파일이니 화질 100으로 다시 변환하세요.',
    '받는 곳이 WebP를 지원하는지 확인하세요. 최신 브라우저는 지원하지만 일부 업로드 양식과 오래된 앱은 지원하지 않습니다.']},
   trouble:{rows:[
    ['도트 그림이 흐리거나 색 점이 생김','기본 화질 92로 손실 WebP가 저장됐습니다','한 픽셀짜리 디테일을 확대','고급 설정에서 화질을 100으로 하고 다시 변환하세요(Chromium에서 무손실)'],
    ['WebP가 PNG보다 큼','이미 최적화된 작은 PNG(인덱스 색상)라 무손실 WebP도 이기지 못했습니다','Kenney 시트: PNG 1,996바이트 대 WebP 2,814바이트','PNG를 그대로 쓰세요'],
    ['업로드 양식이 .webp를 거부','그 사이트는 JPG와 PNG만 받습니다','지원 형식 목록 확인','PNG를 유지하거나 사진이면 [[image/png-to-jpg|PNG → JPG]]를 쓰세요'],
    ['다른 브라우저에서 "무손실" WebP가 다름','측정은 Chromium에서만 했습니다. 다른 브라우저는 화질 100을 다르게 처리할 수 있습니다','편집기에서 PNG와 픽셀 비교','픽셀이 정확해야 하는 곳에는 PNG를 쓰세요']]},
   alternatives:{rows:[
    ['PNG 그대로 쓰기','이미 PNG로 최적화된 도트 그림·아이콘. Kenney 시트는 PNG일 때 가장 작았습니다.'],
    ['[[image/compress|자동 형식으로 압축]]','형식과 상관없이 유사도 기준을 넘는 가장 작은 파일이 필요할 때.'],
    ['나중에 [[image/webp-to-png|WebP → PNG]]','웹용 사본만 WebP가 필요할 때. PNG 원본을 보관하고 도구가 PNG를 요구하면 다시 바꾸세요.']]},
   limits:['화질 100에서 무손실로 바뀌는 동작은 Chromium 153에서만 측정했습니다.','텍스트 청크와 EXIF는 복사되지 않고 움직이는 PNG는 거부합니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로 우주비행사 사진과 Kenney CC0 파일 두 개(`pixel-platformer-characters.png`, `kenney-blue-button.png`)를 측정했습니다. WebP의 손실·무손실 방식과 4:2:0 색 저장은 MDN 설명을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'PNGをWebPにすると透過が残り、たいていファイルも小さくなりますが、どちらのWebPで書き出すかが重要です。初期値の画質92では非可逆WebPになり、512 × 512の写真は791,555バイトから59,824バイトになりました。画質100ならChromiumはPNGとピクセルまで同じ可逆WebPを書き、同じ写真で379,076バイトでした。ドット絵に非可逆WebPは不向きです。Kenneyのスプライトシートではピクセルの半分が変わって8,692バイトになり、可逆なら2,814バイト、最適化済みの元PNGは1,996バイトでした。',
   concept:{title:'拡張子は1つ、エンコーダーは2つ',body:[
    '非可逆WebPは動画コーデックVP8をもとにしており、色情報を半分の解像度（Y′CbCr 4:2:0）で保存します。可逆WebPは正確なARGBを保存し、ピクセルの予測と繰り返しデータの再利用で圧縮します。どちらもアルファチャンネルを持つので、透過PNGはどちらでも透過のままです。',
    'どちらのエンコーダーを使うかは、ブラウザが受け取った画質で決まります。Chromium 153では画質100ですべてのピクセルが一致する可逆ファイルになり、それ未満では非可逆になりました。スライダーの初期値は92なので、UI・文字・ドット絵では100に動かします。',
    '非可逆WebPは色チャンネルでくっきりしたピクセルの境界を崩します。Kenneyのシートでは最大誤差が255中108で、アルファは正確に残りました。こうしたファイルでは、アルファ自体を捨てる[[image/png-to-jpg|JPG]]はさらに不利です。'],
    terms:[['非可逆WebP','VP8ベースで色は半分の解像度。写真を小さく保存します。'],['可逆WebP','正確なARGBピクセル。Chromiumでは画質100で書き出されます。'],['クロマサブサンプリング4:2:0','色をピクセルごとではなく2 × 2ブロックごとに持つ方式。1ピクセル単位の色の細部がにじみます。']]},
   example:{title:'写真とスプライトシートをWebPに（実測）',lead:'2026-09-28にChromium 153でNerulioの変換コードを使って計測しました。',lines:[
    '写真: astronaut.png   512 x 512    791,555 バイト',
    '  WebP q92  （非可逆）   59,824 バイト   SSIM 0.9883',
    '  WebP q100 （可逆）    379,076 バイト   ピクセル同一',
    '',
    'ドット絵: Kenney characters   224 x 74    1,996 バイト',
    '  WebP q92  （非可逆）    8,692 バイト   8,481ピクセル変化、最大誤差108/255',
    '  WebP q100 （可逆）      2,814 バイト   ピクセル同一'],
    after:'画質100での小さな例外は柔らかい縁だけです。KenneyのUIボタンでは12,288ピクセル中26個が最大4/255だけ違いました（このボタンには半透明の縁のピクセルが38個あり、ブラウザはそこでプリマルチプライドアルファを丸めます）。それ以外はすべて一致しました。'},
   mapping:{title:'WebPに残るもの',head:['PNGにあったもの','変換での処理','WebPでは'],rows:[
    ['RGBピクセル','画質100未満は非可逆VP8、100は可逆（Chromium）','近似または同一のピクセル'],
    ['アルファチャンネル','保持','アルファは保持（どちらの計測でも正確）'],
    ['カラープロファイル','ブラウザのsRGBキャンバスに描画','ChromiumがsRGBの `ICCP` チャンクを書き込む'],
    ['テキストチャンク・EXIF','コピーしない','なし'],
    ['APNGアニメーション','拒否','—']]},
   verify:{steps:[
    'WebPを暗い背景と明るい背景の両方に置きます。透過部分がPNGと同じに見えるはずです。',
    'グラフィックなら、くっきりした縁を400%に拡大します。色のにじみがあれば非可逆なので、画質100で変換し直します。',
    '提出先がWebPを受け付けるか確認します。最新のブラウザは対応していますが、一部のアップロードフォームや古いアプリは非対応です。']},
   trouble:{rows:[
    ['ドット絵がぼやける・色の点が出る','初期値の画質92で非可逆WebPになった','1ピクセル単位の細部を拡大','詳細設定で画質を100にして変換し直します（Chromiumでは可逆）'],
    ['WebPのほうがPNGより大きい','最適化済みの小さなPNG（インデックスカラー）で、可逆WebPでも勝てなかった','Kenneyのシート: PNG 1,996バイト対WebP 2,814バイト','PNGのまま使います'],
    ['アップロードフォームが.webpを拒否する','そのサイトはJPGとPNGしか受け付けない','対応形式の一覧を確認','PNGのままにするか、写真なら[[image/png-to-jpg|PNG → JPG]]を使います'],
    ['別のブラウザで「可逆」WebPが一致しない','計測したのはChromiumだけで、他のブラウザは画質100を別に扱うことがある','編集ソフトでPNGとピクセルを比較','ピクセルの一致が必要な場面ではPNGを使います']]},
   alternatives:{rows:[
    ['PNGのまま使う','PNGとして最適化済みのドット絵やアイコン。KenneyのシートはPNGが最小でした。'],
    ['[[image/compress|自動形式で圧縮]]','形式にこだわらず、類似度の基準を超える最小のファイルが欲しい場合。'],
    ['あとで[[image/webp-to-png|WebP → PNG]]','Web用のコピーだけWebPが必要な場合。PNGの原本を残し、PNGを求めるツールには戻して渡します。']]},
   limits:['画質100で可逆に切り替わる動作は、Chromium 153でのみ計測しています。','テキストチャンクとEXIFはコピーされず、アニメーションPNGは拒否します。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い宇宙飛行士の写真とKenneyのCC0ファイル2つ（`pixel-platformer-characters.png`、`kenney-blue-button.png`）を計測しました。WebPの非可逆・可逆の方式と4:2:0の色の持ち方はMDNの説明に従っています。'],sources:[MDN.ja]}
  }
 },
};
