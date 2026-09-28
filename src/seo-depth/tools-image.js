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
 'image/webp-to-png':{
  type:'tool',
  intent:{primary:'convert WebP to PNG',secondary:['open a WebP in an app that only reads PNG','keep transparency from WebP','why the PNG is so large'],
   goal:'a PNG that the refusing app opens, with transparency kept and no new loss',input:'WebP (still, lossy or lossless, with or without alpha)',output:'PNG, lossless, same dimensions, alpha kept',target:'editors, game engines, forms that read PNG but not WebP',support:'full',
   evidence:['src/task/convert.js','src/image-container.js (animated WebP rejected)','measured 2026-09-28, Chromium 153: astronaut.webp (Pillow q80 from tests/fixtures/astronaut.png)'],
   external:['MDN: WebP lossy/lossless, PNG lossless']},
  en:{
   answer:'WebP to PNG decodes the WebP and saves its pixels losslessly, so nothing more is lost — but whatever the WebP already lost stays lost. The usual reason is compatibility: an editor, game engine or upload form that reads PNG but not WebP. Expect a much bigger file for photos: a 31,724-byte WebP photo (512 × 512) became a 431,041-byte PNG, 13.6 times larger. Transparency in the WebP is kept; animated WebP is refused.',
   concept:{title:'Freezing a web copy into a lossless file',body:[
    'Most WebPs on the web are lossy; some are lossless. In both cases the browser decodes the file to RGBA pixels and PNG stores those exactly. For a lossless WebP the round trip is perfect; for a lossy one the PNG keeps the WebP\'s smoothing and block edges as they are.',
    'The PNG is bigger because it cannot throw information away, while lossy WebP already threw away exactly the fine noise PNG compresses worst. Logos and screenshots with flat colour grow far less than photos, because PNG handles flat areas well.'],
    terms:[['Lossy WebP','VP8-based WebP; its smoothing is baked into the decoded pixels.'],['Lossless WebP','Exact pixels; converting it to PNG loses nothing at all.'],['RGBA','Red, green, blue and alpha per pixel — what both formats hold after decoding.']]},
   example:{title:'Every way out of one WebP (measured)',lead:'A 512 × 512 WebP made from the NASA fixture with Pillow at quality 80, converted with Nerulio\'s code in Chromium 153 on 2026-09-28.',lines:[
    'Source: astronaut.webp   31,724 bytes',
    '',
    '-> PNG          431,041 bytes   13.6 x   identical to the decoded WebP',
    '-> WebP q100    248,758 bytes    7.8 x   lossless copy',
    '-> WebP q92      40,364 bytes    1.3 x   re-encoded, SSIM 0.9955',
    '-> JPG q92       68,975 bytes    2.2 x   re-encoded, SSIM 0.9941'],
    after:'Every route out of a lossy WebP is bigger than the WebP itself; PNG and lossless WebP are the only ones that add no new loss.'},
   mapping:{title:'What reaches the PNG',head:['In the WebP','What the converter does','In the PNG'],rows:[
    ['Decoded pixels (lossy smoothing included)','Stored losslessly','Identical pixels'],
    ['Alpha channel','Kept','Alpha kept'],
    ['Animation (`ANIM` / `ANMF` frames)','Refused before converting','—'],
    ['`EXIF`, `XMP`, `ICCP` chunks','Not copied','No metadata, no profile chunk']]},
   verify:{steps:[
    'Open the PNG in the program that refused the WebP; it should load without any import plug-in.',
    'If the WebP was transparent, check the PNG on a checkered background: the same areas should be see-through.',
    'Compare width and height with the original; they are never changed by conversion.']},
   trouble:{rows:[
    ['The app still refuses the file','The download still has a `.webp` name or was renamed, not converted','The file must start with the bytes `‰PNG`','Save the converted file again from the result list and open that one'],
    ['The PNG is enormous','Lossless PNG of a photo','Byte count in the result list','For photos use [[image/webp-to-jpg|WebP to JPG]]; keep PNG for graphics and transparency'],
    ['An animated WebP is refused','Only still images are converted','The source plays as an animation in the browser','Export a single frame with another tool first'],
    ['Blocky or smeared edges remain','The WebP was lossy and the PNG keeps its artefacts','Zoom in on edges in both files','Ask for the original PNG or layered file instead of the web copy']]},
   alternatives:{rows:[
    ['[[image/webp-to-jpg|WebP to JPG]]','Photos for apps that accept JPG: 68,975 instead of 431,041 bytes here.'],
    ['The original from the author or site','When the WebP is a web copy of an image that also exists as PNG or PSD, that original has more detail.']]},
   limits:['Lossy WebP loss is not undone; the PNG is exactly the decoded WebP.','Animated WebP is refused; EXIF, XMP and colour-profile chunks are not carried over.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path on a WebP written by Pillow 12.3 (quality 80) from `tests/fixtures/astronaut.png`. WebP\'s two modes and PNG\'s lossless compression follow MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'WebP를 PNG로 바꾸면 WebP를 디코딩한 픽셀을 무손실로 저장하므로 더 잃는 것은 없지만, WebP가 이미 잃은 부분은 돌아오지 않습니다. 보통은 호환성 때문입니다. PNG는 읽지만 WebP는 못 읽는 편집기·게임 엔진·업로드 양식에 넣으려는 경우죠. 사진이면 파일이 크게 커집니다. 31,724바이트 WebP 사진(512 × 512)이 431,041바이트 PNG로, 13.6배가 됐습니다. WebP의 투명도는 유지되고 움직이는 WebP는 거부합니다.',
   concept:{title:'웹용 사본을 무손실 파일로 굳히기',body:[
    '웹의 WebP는 대부분 손실 압축이고 일부는 무손실입니다. 어느 쪽이든 브라우저가 RGBA 픽셀로 디코딩하고 PNG는 그 픽셀을 정확히 저장합니다. 무손실 WebP라면 완벽하게 옮겨지고, 손실 WebP라면 WebP의 뭉개짐과 블록 경계가 그대로 PNG에 남습니다.',
    'PNG가 큰 이유는 정보를 버릴 수 없기 때문입니다. 손실 WebP는 PNG가 가장 압축하기 어려워하는 미세한 노이즈를 이미 버린 상태입니다. 단색 위주의 로고나 스크린샷은 PNG가 평평한 영역을 잘 압축하므로 사진보다 훨씬 덜 커집니다.'],
    terms:[['손실 WebP','VP8 기반 WebP. 뭉개짐이 디코딩된 픽셀에 그대로 들어 있습니다.'],['무손실 WebP','픽셀이 정확한 WebP. PNG로 바꿔도 잃는 것이 전혀 없습니다.'],['RGBA','픽셀마다 빨강·초록·파랑·알파. 디코딩 후 두 형식이 담는 내용입니다.']]},
   example:{title:'WebP 한 장을 여러 형식으로(실측)',lead:'NASA 테스트 사진을 Pillow 화질 80으로 저장한 512 × 512 WebP를 2026-09-28 Chromium 153에서 Nerulio 코드로 변환했습니다.',lines:[
    '원본: astronaut.webp    31,724 바이트',
    '',
    '-> PNG          431,041 바이트   13.6배   디코딩한 WebP와 동일',
    '-> WebP q100    248,758 바이트    7.8배   무손실 사본',
    '-> WebP q92      40,364 바이트    1.3배   재인코딩, SSIM 0.9955',
    '-> JPG q92       68,975 바이트    2.2배   재인코딩, SSIM 0.9941'],
    after:'손실 WebP에서 나가는 모든 경로가 원래 WebP보다 큽니다. 새 손실을 더하지 않는 것은 PNG와 무손실 WebP뿐입니다.'},
   mapping:{title:'PNG로 넘어가는 것',head:['WebP에 있던 것','변환기가 하는 일','PNG에서는'],rows:[
    ['디코딩된 픽셀(손실 뭉개짐 포함)','무손실로 저장','픽셀 동일'],
    ['알파 채널','유지','알파 유지'],
    ['애니메이션(`ANIM` / `ANMF` 프레임)','변환 전에 거부','—'],
    ['`EXIF`, `XMP`, `ICCP` 청크','복사하지 않음','메타데이터·프로필 청크 없음']]},
   verify:{steps:[
    'WebP를 거부하던 프로그램에서 PNG를 열어 보세요. 별도 플러그인 없이 열려야 합니다.',
    'WebP가 투명했다면 체크무늬 배경에서 PNG를 확인하세요. 같은 영역이 비쳐 보여야 합니다.',
    '가로·세로를 원본과 비교하세요. 변환은 크기를 절대 바꾸지 않습니다.']},
   trouble:{rows:[
    ['앱이 여전히 파일을 거부','내려받은 파일이 아직 `.webp`이거나 변환이 아니라 이름만 바꿨습니다','파일은 `‰PNG` 바이트로 시작해야 합니다','결과 목록에서 변환된 파일을 다시 저장해 그 파일을 여세요'],
    ['PNG가 너무 큼','사진을 무손실 PNG로 저장했습니다','결과 목록의 바이트 수','사진은 [[image/webp-to-jpg|WebP → JPG]]를 쓰고, 그래픽·투명 이미지만 PNG로 두세요'],
    ['움직이는 WebP가 거부됨','정지 이미지만 변환합니다','원본이 브라우저에서 애니메이션으로 재생됨','다른 도구로 한 프레임을 먼저 내보내세요'],
    ['뭉개진 경계가 그대로 남음','WebP가 손실 압축이었고 PNG가 그 흔적을 보존했습니다','두 파일의 경계를 확대','웹용 사본 대신 원본 PNG나 레이어 파일을 요청하세요']]},
   alternatives:{rows:[
    ['[[image/webp-to-jpg|WebP → JPG]]','JPG를 받는 앱에 넣을 사진. 여기서는 431,041바이트 대신 68,975바이트였습니다.'],
    ['작성자나 사이트의 원본','WebP가 PNG·PSD 원본의 웹용 사본이라면 원본 쪽이 디테일이 더 많습니다.']]},
   limits:['손실 WebP의 손실은 되돌려지지 않으며 PNG는 디코딩한 WebP와 정확히 같습니다.','움직이는 WebP는 거부하며 EXIF·XMP·색상 프로필 청크는 옮기지 않습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`를 Pillow 12.3 화질 80으로 저장한 WebP를 측정했습니다. WebP의 두 방식과 PNG의 무손실 압축은 MDN을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'WebPをPNGにすると、WebPを展開したピクセルを可逆で保存するので、これ以上は劣化しません。ただしWebPがすでに失ったものは戻りません。よくある理由は互換性で、PNGは読めてもWebPは読めない編集ソフト・ゲームエンジン・アップロードフォームに渡したい場合です。写真ならファイルは大きく増えます。31,724バイトのWebP写真（512 × 512）が431,041バイトのPNGになり、13.6倍でした。WebPの透過は残り、アニメーションWebPは拒否します。',
   concept:{title:'Web用のコピーを可逆ファイルとして固定する',body:[
    'Web上のWebPの多くは非可逆で、一部は可逆です。どちらでもブラウザがRGBAピクセルに展開し、PNGはそのピクセルを正確に保存します。可逆WebPなら完全にそのまま移り、非可逆WebPならWebPのぼかしやブロックの境目がそのままPNGに残ります。',
    'PNGが大きくなるのは情報を捨てられないからです。非可逆WebPは、PNGが最も圧縮しにくい細かなノイズをすでに捨てています。単色主体のロゴやスクリーンショットは、PNGが平坦な部分をうまく圧縮できるので、写真ほどは増えません。'],
    terms:[['非可逆WebP','VP8ベースのWebP。ぼかしが展開後のピクセルにそのまま入っています。'],['可逆WebP','ピクセルが正確なWebP。PNGにしても何も失いません。'],['RGBA','ピクセルごとの赤・緑・青・アルファ。展開後に両形式が持つ内容です。']]},
   example:{title:'1枚のWebPを各形式に（実測）',lead:'NASAのテスト写真をPillowの画質80で保存した512 × 512のWebPを、2026-09-28にChromium 153でNerulioのコードを使って変換しました。',lines:[
    '元画像: astronaut.webp    31,724 バイト',
    '',
    '-> PNG          431,041 バイト   13.6倍   展開したWebPと同一',
    '-> WebP q100    248,758 バイト    7.8倍   可逆コピー',
    '-> WebP q92      40,364 バイト    1.3倍   再エンコード、SSIM 0.9955',
    '-> JPG q92       68,975 バイト    2.2倍   再エンコード、SSIM 0.9941'],
    after:'非可逆WebPからの変換はどの経路でも元のWebPより大きくなります。新たな劣化を加えないのはPNGと可逆WebPだけです。'},
   mapping:{title:'PNGに引き継がれるもの',head:['WebPにあったもの','変換での処理','PNGでは'],rows:[
    ['展開したピクセル（非可逆のぼかし込み）','可逆で保存','ピクセル同一'],
    ['アルファチャンネル','保持','アルファを保持'],
    ['アニメーション（`ANIM` / `ANMF` フレーム）','変換前に拒否','—'],
    ['`EXIF`・`XMP`・`ICCP` チャンク','コピーしない','メタデータ・プロファイルのチャンクなし']]},
   verify:{steps:[
    'WebPを拒否していたソフトでPNGを開きます。追加のプラグインなしで開けるはずです。',
    'WebPが透過していたなら、市松模様の背景でPNGを確認します。同じ部分が透けて見えるはずです。',
    '幅と高さを元と比べます。変換でサイズが変わることはありません。']},
   trouble:{rows:[
    ['アプリがまだファイルを拒否する','ダウンロードしたファイルがまだ `.webp` のまま、または変換せずに名前だけ変えた','ファイルは `‰PNG` のバイトで始まるはず','結果一覧から変換済みファイルを保存し直し、それを開きます'],
    ['PNGが大きすぎる','写真を可逆のPNGで保存した','結果一覧のバイト数','写真は[[image/webp-to-jpg|WebP → JPG]]にし、グラフィックや透過画像だけPNGにします'],
    ['アニメーションWebPが拒否される','静止画だけを変換する','元ファイルがブラウザでアニメーション再生される','別のツールで1コマを先に書き出します'],
    ['ぼやけた縁がそのまま残る','WebPが非可逆で、PNGがその跡を保存した','両方の縁を拡大','Web用のコピーではなく、元のPNGやレイヤー付きファイルを入手します']]},
   alternatives:{rows:[
    ['[[image/webp-to-jpg|WebP → JPG]]','JPGを受け付けるアプリに渡す写真。ここでは431,041バイトではなく68,975バイトでした。'],
    ['作者やサイトの元データ','WebPがPNGやPSDの原本のWeb用コピーなら、原本のほうが細部が多く残っています。']]},
   limits:['非可逆WebPの劣化は元に戻らず、PNGは展開したWebPとまったく同じです。','アニメーションWebPは拒否し、EXIF・XMP・カラープロファイルのチャンクは引き継ぎません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い、`tests/fixtures/astronaut.png` をPillow 12.3の画質80で保存したWebPを計測しました。WebPの2方式とPNGの可逆圧縮はMDNに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/jpg-to-webp':{
  type:'tool',
  intent:{primary:'convert JPG to WebP',secondary:['make photos smaller for a website','how much smaller is WebP than JPG','WebP quality setting'],
   goal:'a smaller WebP of a JPG photo with no visible extra loss',input:'JPG/JPEG',output:'WebP (lossy at quality < 100, lossless at 100 in Chromium), same dimensions',target:'websites, apps that accept WebP',support:'full',
   evidence:['src/task/convert.js','measured 2026-09-28, Chromium 153: astronaut.jpg (Pillow q92 from tests/fixtures/astronaut.png)'],
   external:['MDN: lossy WebP 25–35 % smaller than JPEG on average']},
  en:{
   answer:'JPG to WebP re-encodes a photo with WebP\'s lossy encoder, usually so a web page loads faster. On a 512 × 512 photo the 75,758-byte JPG became a 58,210-byte WebP at quality 92 — 23 % smaller, SSIM 0.9918 against the decoded JPG. It is a second lossy generation, so start from the best JPG you have and keep the JPG for places that do not accept WebP. Quality 100 gives a lossless WebP instead: exact, but 3.6 times the size of the JPG.',
   concept:{title:'Lossy to lossy: what the saving depends on',body:[
    'Both formats are lossy but lose different things: JPG rounds 8 × 8 frequency blocks, lossy WebP predicts blocks from their neighbours and keeps colour at half resolution. When the input is already a JPG, the WebP encoder has to reproduce the JPG\'s artefacts as if they were detail, so the saving is smaller than when encoding from the original. MDN quotes lossy WebP at 25–35 % smaller than JPEG on average; this photo, already a JPG, saved 23 %.',
    'The converter encodes once, at the slider\'s quality (default 92). It does not compare formats. If you want a byte limit or an automatic JPG-versus-WebP choice, [[image/compress|compress]] scores both and keeps the better one.'],
    terms:[['Second generation','A lossy file made from another lossy file; the errors of both add up.'],['SSIM','Structural similarity, 1.0 = identical; used here to compare the WebP with the decoded JPG.'],['Quality 100 in Chromium','Switches to lossless WebP: exact pixels, much larger file.']]},
   example:{title:'The same JPG at two WebP settings (measured)',lead:'JPG made from the NASA fixture with Pillow at quality 92; Nerulio\'s converter code, Chromium 153, 2026-09-28.',lines:[
    'Source: astronaut.jpg     75,758 bytes   512 x 512',
    '',
    '-> WebP q92       58,210 bytes    -23 %   SSIM 0.9918',
    '-> WebP q100     276,100 bytes   +264 %   lossless, identical pixels',
    '',
    'From the original PNG instead:',
    '   WebP q92       59,824 bytes            SSIM 0.9883 vs the PNG'],
    after:'If 23 % is not enough, lower the quality, or let [[image/compress-to-50kb|compress to 50 KB]] decide: on this same JPG it chose a 44,435-byte JPG (SSIM 0.9822) over the WebP candidate, because the JPG scored higher.'},
   mapping:{title:'What the WebP receives from the JPG',head:['In the JPG','What the converter does','In the WebP'],rows:[
    ['Decoded pixels','Encoded with lossy VP8 at the chosen quality','Approximate pixels, same width and height'],
    ['EXIF orientation','Applied to the pixels while decoding','Upright pixels, no orientation tag'],
    ['EXIF date, camera, GPS','Not copied','None'],
    ['ICC profile','Drawn in the browser\'s sRGB canvas','sRGB `ICCP` chunk from Chromium']]},
   verify:{steps:[
    'Compare JPG and WebP side by side at 100 % on smooth areas (sky, skin): new banding or smearing means the quality is too low for this picture.',
    'Check the byte counts; if the saving is only a few per cent, keep the JPG.',
    'Load the WebP where it will be used (your site, CMS or app) to make sure it is accepted.']},
   trouble:{rows:[
    ['The WebP is hardly smaller','The JPG was already strongly compressed; its artefacts cost WebP bits','Compare the sizes','Lower the quality to 80 or encode from the original photo instead of the JPG'],
    ['The WebP is much bigger','Quality 100 writes lossless WebP','The quality slider shows 100','Use 92 or lower for photos'],
    ['Colours look a little different','The output is tagged sRGB; a source tagged with another profile may shift','Check the source\'s colour profile in an image viewer','Export an sRGB JPG from the original first'],
    ['Nothing appears on the site','The page or CMS does not accept WebP','Open the WebP directly in the browser','Serve the JPG, or keep both']]},
   alternatives:{rows:[
    ['Keep the JPG','E-mail attachments, print services and older apps where WebP support is uncertain.'],
    ['[[image/compress|Compress with Auto]]','You have a size limit or want JPG and WebP compared by score before choosing.'],
    ['Encode from the original','A camera original or PNG export avoids the second generation and saves more.']]},
   limits:['Every lossy re-encode adds error; there is no way to go JPG → lossy WebP without it.','EXIF (including GPS) is not copied; the WebP carries an sRGB profile.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path and, for the 50 KB comparison, `src/compression.js` with the compress task\'s options, on a JPG written by Pillow 12.3 (quality 92) from `tests/fixtures/astronaut.png`. The 25–35 % figure is MDN\'s, not ours.'],sources:[MDN.en]}
  },
  ko:{
   answer:'JPG를 WebP로 바꾸면 사진을 WebP 손실 인코더로 다시 저장합니다. 보통 웹페이지를 빨리 뜨게 하려는 목적입니다. 512 × 512 사진에서 75,758바이트 JPG가 화질 92의 58,210바이트 WebP가 됐습니다. 23% 작고, 디코딩한 JPG와의 SSIM은 0.9918입니다. 두 번째 손실 단계이므로 가진 것 중 가장 좋은 JPG에서 시작하고, WebP를 받지 않는 곳에는 JPG를 쓰세요. 화질 100이면 무손실 WebP가 되어 정확하지만 JPG의 3.6배 크기입니다.',
   concept:{title:'손실에서 손실로: 절감 폭을 정하는 것',body:[
    '두 형식 모두 손실 압축이지만 잃는 것이 다릅니다. JPG는 8 × 8 주파수 블록을 반올림하고, 손실 WebP는 이웃 블록으로 예측하며 색을 절반 해상도로 저장합니다. 입력이 이미 JPG이면 WebP 인코더가 JPG의 흔적까지 디테일처럼 재현해야 해서 원본에서 인코딩할 때보다 덜 줄어듭니다. MDN은 손실 WebP가 평균 25~35% 작다고 설명하지만, 이미 JPG였던 이 사진은 23% 줄었습니다.',
    '변환기는 슬라이더 화질(기본 92)로 한 번만 인코딩하고 형식을 비교하지 않습니다. 바이트 제한이 있거나 JPG와 WebP를 자동으로 고르고 싶다면 [[image/compress|압축]]이 둘을 채점해 더 나은 쪽을 남깁니다.'],
    terms:[['2세대 손실','손실 파일로 만든 또 다른 손실 파일. 두 단계의 오차가 더해집니다.'],['SSIM','구조적 유사도. 1.0이면 동일하며 여기서는 WebP와 디코딩한 JPG를 비교합니다.'],['Chromium의 화질 100','무손실 WebP로 바뀝니다. 픽셀은 정확하지만 파일이 훨씬 큽니다.']]},
   example:{title:'같은 JPG를 두 가지 WebP 설정으로(실측)',lead:'NASA 테스트 사진을 Pillow 화질 92로 저장한 JPG, Nerulio 변환 코드, Chromium 153, 2026-09-28.',lines:[
    '원본: astronaut.jpg      75,758 바이트   512 x 512',
    '',
    '-> WebP q92       58,210 바이트    -23 %   SSIM 0.9918',
    '-> WebP q100     276,100 바이트   +264 %   무손실, 픽셀 동일',
    '',
    '원본 PNG에서 만들었다면:',
    '   WebP q92       59,824 바이트            PNG 대비 SSIM 0.9883'],
    after:'23%로 부족하면 화질을 낮추거나 [[image/compress-to-50kb|50KB 이하로 압축]]에 맡겨 보세요. 같은 JPG에서 이 도구는 WebP 후보보다 점수가 높은 44,435바이트 JPG(SSIM 0.9822)를 골랐습니다.'},
   mapping:{title:'JPG에서 WebP로 넘어가는 것',head:['JPG에 있던 것','변환기가 하는 일','WebP에서는'],rows:[
    ['디코딩된 픽셀','선택한 화질의 손실 VP8로 인코딩','근사한 픽셀, 가로·세로 동일'],
    ['EXIF 회전 정보','디코딩할 때 픽셀에 적용','바로 선 픽셀, 회전 태그 없음'],
    ['EXIF 날짜·카메라·GPS','복사하지 않음','없음'],
    ['ICC 프로필','브라우저 sRGB 캔버스에 그림','Chromium의 sRGB `ICCP` 청크']]},
   verify:{steps:[
    '하늘·피부처럼 매끈한 부분을 100%로 나란히 비교하세요. 새로운 계단 현상이나 뭉개짐이 보이면 이 사진에는 화질이 너무 낮습니다.',
    '바이트 수를 확인해 절감이 몇 퍼센트뿐이라면 JPG를 유지하세요.',
    '실제로 쓸 곳(내 사이트, CMS, 앱)에 WebP를 올려 받아 주는지 확인하세요.']},
   trouble:{rows:[
    ['WebP가 거의 줄지 않음','이미 강하게 압축된 JPG라 그 흔적에 WebP 비트가 쓰였습니다','용량 비교','화질을 80으로 낮추거나 JPG 대신 원본 사진에서 인코딩하세요'],
    ['WebP가 훨씬 커짐','화질 100은 무손실 WebP를 만듭니다','화질 슬라이더가 100인지 확인','사진은 92 이하를 쓰세요'],
    ['색이 조금 달라 보임','출력은 sRGB로 표시되며 다른 프로필이 붙은 원본은 달라질 수 있습니다','이미지 뷰어에서 원본의 색상 프로필 확인','원본에서 sRGB JPG를 먼저 내보내세요'],
    ['사이트에 아무것도 안 보임','페이지나 CMS가 WebP를 받지 않습니다','WebP를 브라우저에서 직접 열어 보기','JPG를 쓰거나 둘 다 준비하세요']]},
   alternatives:{rows:[
    ['JPG 그대로 쓰기','이메일 첨부, 인화 서비스, WebP 지원이 불확실한 오래된 앱.'],
    ['[[image/compress|자동 형식으로 압축]]','용량 제한이 있거나 고르기 전에 JPG와 WebP를 점수로 비교하고 싶을 때.'],
    ['원본에서 인코딩','카메라 원본이나 PNG에서 만들면 2세대 손실이 없고 더 많이 줄어듭니다.']]},
   limits:['손실 재인코딩은 매번 오차를 더하며, JPG → 손실 WebP를 오차 없이 할 방법은 없습니다.','EXIF(GPS 포함)는 복사되지 않고 WebP에는 sRGB 프로필이 들어갑니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로와, 50KB 비교에는 압축 작업과 같은 옵션의 `src/compression.js`로 측정했습니다. 입력은 `tests/fixtures/astronaut.png`를 Pillow 12.3 화질 92로 저장한 JPG입니다. 25~35%는 우리 측정이 아니라 MDN의 수치입니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'JPGをWebPにすると、写真をWebPの非可逆エンコーダーで保存し直します。多くはWebページの表示を速くするためです。512 × 512の写真では75,758バイトのJPGが画質92で58,210バイトのWebPになりました。23%小さく、展開したJPGとのSSIMは0.9918です。2回目の非可逆処理なので手元でいちばん良いJPGから変換し、WebPを受け付けない場所にはJPGを使います。画質100なら可逆WebPになり正確ですが、JPGの3.6倍の大きさです。',
   concept:{title:'非可逆から非可逆へ：削減幅を決めるもの',body:[
    'どちらも非可逆ですが、失うものが違います。JPGは8 × 8の周波数ブロックを丸め、非可逆WebPは隣のブロックから予測し、色を半分の解像度で持ちます。入力がすでにJPGだと、WebPエンコーダーはJPGのノイズまで細部として再現しなければならず、元データから変換するより削減幅が小さくなります。MDNは非可逆WebPを平均25〜35%小さいとしていますが、JPG済みのこの写真では23%でした。',
    '変換はスライダーの画質（初期値92）で1回エンコードするだけで、形式の比較はしません。容量の上限がある場合や、JPGとWebPを自動で選ばせたい場合は、[[image/compress|圧縮]]が両方を採点して良いほうを残します。'],
    terms:[['第2世代','非可逆ファイルから作った非可逆ファイル。両方の誤差が重なります。'],['SSIM','構造的類似度。1.0で同一。ここではWebPと展開したJPGを比べています。'],['Chromiumの画質100','可逆WebPに切り替わります。ピクセルは正確ですがファイルはずっと大きくなります。']]},
   example:{title:'同じJPGを2つのWebP設定で（実測）',lead:'NASAのテスト写真をPillowの画質92で保存したJPG、Nerulioの変換コード、Chromium 153、2026-09-28。',lines:[
    '元画像: astronaut.jpg     75,758 バイト   512 x 512',
    '',
    '-> WebP q92       58,210 バイト    -23 %   SSIM 0.9918',
    '-> WebP q100     276,100 バイト   +264 %   可逆、ピクセル同一',
    '',
    '元のPNGから作った場合:',
    '   WebP q92       59,824 バイト            PNGに対するSSIM 0.9883'],
    after:'23%で足りなければ画質を下げるか、[[image/compress-to-50kb|50KB以下に圧縮]]に任せます。同じJPGで、このツールはWebPの候補より点数の高い44,435バイトのJPG（SSIM 0.9822）を選びました。'},
   mapping:{title:'JPGからWebPに引き継がれるもの',head:['JPGにあったもの','変換での処理','WebPでは'],rows:[
    ['展開したピクセル','選んだ画質の非可逆VP8でエンコード','近似したピクセル、幅・高さは同じ'],
    ['EXIFの回転情報','展開時にピクセルへ適用','正しい向きのピクセル、回転タグなし'],
    ['EXIFの日時・カメラ・GPS','コピーしない','なし'],
    ['ICCプロファイル','ブラウザのsRGBキャンバスに描画','ChromiumのsRGB `ICCP` チャンク']]},
   verify:{steps:[
    '空や肌のようななめらかな部分を100%で並べて比べます。新しい階調の段差やぼやけがあれば、この写真には画質が低すぎます。',
    'バイト数を確認し、削減が数パーセントだけならJPGのままにします。',
    '実際に使う場所（自分のサイト、CMS、アプリ）にWebPを載せ、受け付けられるか確認します。']},
   trouble:{rows:[
    ['WebPがほとんど小さくならない','すでに強く圧縮されたJPGで、そのノイズにWebPのビットが使われた','容量を比べる','画質を80に下げるか、JPGではなく元の写真から変換します'],
    ['WebPのほうがずっと大きい','画質100では可逆WebPになる','画質スライダーが100になっている','写真では92以下にします'],
    ['色が少し違って見える','出力はsRGBで、別のプロファイル付きの元画像は色がずれることがある','画像ビューアで元画像のカラープロファイルを確認','先に元データからsRGBのJPGを書き出します'],
    ['サイトに何も表示されない','ページやCMSがWebPを受け付けない','WebPをブラウザで直接開いてみる','JPGを使うか、両方を用意します']]},
   alternatives:{rows:[
    ['JPGのまま使う','メール添付、プリントサービス、WebP対応が不確かな古いアプリ。'],
    ['[[image/compress|自動形式で圧縮]]','容量の上限がある場合や、選ぶ前にJPGとWebPを点数で比べたい場合。'],
    ['元データから変換する','カメラの元データやPNGから作れば第2世代の劣化がなく、もっと小さくなります。']]},
   limits:['非可逆の再エンコードは毎回誤差を加え、JPG → 非可逆WebPを誤差なしで行う方法はありません。','EXIF（GPSを含む）はコピーされず、WebPにはsRGBプロファイルが入ります。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路と、50KBの比較には圧縮タスクと同じ設定の `src/compression.js` を使って計測しました。入力は `tests/fixtures/astronaut.png` をPillow 12.3の画質92で保存したJPGです。25〜35%は私たちの計測ではなくMDNの数値です。'],sources:[MDN.ja]}
  }
 },
 'image/webp-to-jpg':{
  type:'tool',
  intent:{primary:'convert WebP to JPG',secondary:['open WebP images in apps that need JPG','save a WebP from a website as JPG','WebP with transparency to JPG'],
   goal:'a JPG any program opens, with a sensible background where the WebP was transparent',input:'WebP (still)',output:'JPG, same dimensions, quality 20–100 (default 92), background default white',target:'older photo apps, upload forms, print services',support:'full',
   evidence:['src/task/convert.js (Im.background for JPG)','measured 2026-09-28, Chromium 153: astronaut.webp (Pillow q80)'],
   external:['MDN: JPEG no alpha; WebP lossy/lossless']},
  en:{
   answer:'WebP to JPG is for software that cannot open WebP — older photo apps, some upload forms, print services. Expect the file to grow: a 31,724-byte WebP photo became a 68,975-byte JPG at quality 92 (2.2 times larger, SSIM 0.9941). JPG has no transparency, so a transparent WebP (a sticker or a cut-out) is flattened onto the background colour, white by default. Choose PNG instead when the WebP is a logo, a screenshot or has transparency.',
   concept:{title:'Why the JPG is bigger than the WebP it came from',body:[
    'The WebP is decoded to pixels and encoded again with a different lossy method. The JPG encoder treats the WebP\'s smoothing and block edges as picture content and spends bytes reproducing them, so the JPG ends up larger even though it cannot look better than its source.',
    'Lowering the quality brings the size down but adds JPG blocks on top of the WebP\'s smoothing. When the destination has a byte limit, use [[image/compress|compress]] with the format set to JPG and a target size instead of guessing a quality.'],
    terms:[['Transcoding','Converting one lossy format into another; the errors of both encoders combine.'],['JPG background','Colour used where the WebP was transparent (`#ffffff` unless changed under Advanced).'],['Quality','JPG encoder setting 20–100, default 92.']]},
   example:{title:'A WebP photo leaving WebP (measured)',lead:'A 512 × 512 WebP written by Pillow at quality 80 from the NASA fixture; Nerulio\'s converter in Chromium 153, 2026-09-28.',lines:[
    'Source: astronaut.webp    31,724 bytes',
    '',
    '-> JPG q92      68,975 bytes    2.2 x larger    SSIM 0.9941',
    '-> PNG         431,041 bytes   13.6 x larger    identical pixels',
    '',
    'Transparency: JPG has no alpha channel; transparent pixels',
    '              become the JPG background colour (default #ffffff)'],
    after:'The same filling was measured on a transparent sprite sheet on [[image/png-to-jpg|PNG to JPG]] (all 8,095 transparent pixels turned white). To keep transparency, use [[image/webp-to-png|WebP to PNG]].'},
   mapping:{title:'What happens to the WebP\'s contents',head:['In the WebP','What the converter does','In the JPG'],rows:[
    ['Decoded pixels','Encoded lossily at the chosen quality','Approximate pixels, same width and height'],
    ['Alpha channel','Painted onto the JPG background colour','No alpha; background colour where it was transparent'],
    ['Animation frames','Refused before converting','—'],
    ['`EXIF`, `XMP`, `ICCP` chunks','Not copied','sRGB profile from Chromium, no EXIF']]},
   verify:{steps:[
    'Open the JPG in the program that refused the WebP.',
    'If the source had transparency, check that the filled areas have the colour you wanted.',
    'Compare the byte counts; if the destination accepts PNG and the picture is a graphic, PNG may be the better file.']},
   trouble:{rows:[
    ['The JPG is twice the size of the WebP','Transcoding: JPG spends bytes reproducing WebP artefacts','Compare sizes in the result list','Accept it, lower the quality, or use [[image/compress|compress]] with a target size'],
    ['A white box appeared around a sticker','The WebP was transparent and JPG cannot store alpha','Look at the WebP on a checkered background','Use [[image/webp-to-png|WebP to PNG]], or set the destination\'s background colour under Advanced'],
    ['The file still will not open','It was renamed, not converted, or the download kept `.webp`','A JPG starts with the bytes `ÿØÿ`','Save the converted file from the result list again'],
    ['Text on the image looks worse','Two lossy encoders in a row around sharp edges','Zoom in on the text','Convert to PNG for screenshots and graphics']]},
   alternatives:{rows:[
    ['[[image/webp-to-png|WebP to PNG]]','Logos, screenshots and anything transparent; no new loss.'],
    ['Ask for the original JPG','When the WebP is a web copy made by a CMS or CDN, the uploader usually still has the JPG.']]},
   limits:['Transparency cannot be kept in JPG.','EXIF and XMP from the WebP are not copied; animated WebP is refused.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path on a WebP written by Pillow 12.3 at quality 80 from `tests/fixtures/astronaut.png`; the transparency fill uses the same `Im.background` call measured on the PNG to JPG page. Format properties follow MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'WebP를 JPG로 바꾸는 것은 WebP를 열지 못하는 소프트웨어(오래된 사진 앱, 일부 업로드 양식, 인화 서비스)를 위해서입니다. 파일은 커진다고 보세요. 31,724바이트 WebP 사진이 화질 92에서 68,975바이트 JPG가 됐습니다(2.2배, SSIM 0.9941). JPG는 투명도가 없어서 투명한 WebP(스티커, 누끼)는 배경색(기본 흰색) 위에 합쳐집니다. 로고·스크린샷·투명 이미지라면 PNG를 고르세요.',
   concept:{title:'JPG가 원본 WebP보다 커지는 이유',body:[
    'WebP를 픽셀로 디코딩한 뒤 다른 손실 방식으로 다시 인코딩합니다. JPG 인코더는 WebP의 뭉개짐과 블록 경계를 그림 내용으로 여기고 그것을 재현하는 데 바이트를 쓰므로, 원본보다 나아질 수 없는데도 JPG가 더 커집니다.',
    '화질을 낮추면 용량은 줄지만 WebP의 뭉개짐 위에 JPG 블록이 더해집니다. 받는 곳에 바이트 제한이 있다면 화질을 짐작하지 말고 [[image/compress|압축]]에서 형식을 JPG로, 목표 용량을 지정하세요.'],
    terms:[['트랜스코딩','손실 형식을 다른 손실 형식으로 바꾸는 것. 두 인코더의 오차가 합쳐집니다.'],['JPG 배경색','WebP가 투명했던 곳에 쓰는 색(고급 설정에서 바꾸지 않으면 `#ffffff`).'],['화질','JPG 인코더 설정 20~100, 기본 92.']]},
   example:{title:'WebP 사진을 다른 형식으로(실측)',lead:'NASA 테스트 사진을 Pillow 화질 80으로 저장한 512 × 512 WebP, Chromium 153의 Nerulio 변환기, 2026-09-28.',lines:[
    '원본: astronaut.webp     31,724 바이트',
    '',
    '-> JPG q92      68,975 바이트    2.2배    SSIM 0.9941',
    '-> PNG         431,041 바이트   13.6배    픽셀 동일',
    '',
    '투명도: JPG에는 알파 채널이 없어 투명 픽셀은',
    '        JPG 배경색(기본 #ffffff)이 됩니다'],
    after:'같은 채우기 동작은 [[image/png-to-jpg|PNG → JPG]]에서 투명 스프라이트 시트로 측정했습니다(투명 픽셀 8,095개가 모두 흰색). 투명도를 유지하려면 [[image/webp-to-png|WebP → PNG]]를 쓰세요.'},
   mapping:{title:'WebP의 내용은 어떻게 되나',head:['WebP에 있던 것','변환기가 하는 일','JPG에서는'],rows:[
    ['디코딩된 픽셀','선택한 화질로 손실 인코딩','근사한 픽셀, 가로·세로 동일'],
    ['알파 채널','JPG 배경색 위에 칠함','알파 없음. 투명했던 곳은 배경색'],
    ['애니메이션 프레임','변환 전에 거부','—'],
    ['`EXIF`, `XMP`, `ICCP` 청크','복사하지 않음','Chromium의 sRGB 프로필, EXIF 없음']]},
   verify:{steps:[
    'WebP를 거부하던 프로그램에서 JPG를 열어 보세요.',
    '원본에 투명한 부분이 있었다면 채워진 색이 원하던 색인지 확인하세요.',
    '바이트 수를 비교하세요. 받는 곳이 PNG를 받고 그림이 그래픽이라면 PNG가 더 나은 파일일 수 있습니다.']},
   trouble:{rows:[
    ['JPG가 WebP의 두 배','트랜스코딩: JPG가 WebP의 흔적을 재현하는 데 바이트를 씁니다','결과 목록에서 용량 비교','그대로 쓰거나 화질을 낮추거나, 목표 용량을 정해 [[image/compress|압축]]하세요'],
    ['스티커 주변에 흰 상자','WebP가 투명했고 JPG는 알파를 저장하지 못합니다','체크무늬 배경에서 WebP 확인','[[image/webp-to-png|WebP → PNG]]를 쓰거나, 고급 설정에서 실제 배경색을 지정하세요'],
    ['파일이 여전히 열리지 않음','변환이 아니라 이름만 바꿨거나, 내려받은 파일이 아직 `.webp`입니다','JPG는 `ÿØÿ` 바이트로 시작합니다','결과 목록에서 변환된 파일을 다시 저장하세요'],
    ['그림 속 글자가 더 나빠 보임','선명한 경계에 손실 인코더 두 개가 연달아 적용됐습니다','글자를 확대','스크린샷·그래픽은 PNG로 바꾸세요']]},
   alternatives:{rows:[
    ['[[image/webp-to-png|WebP → PNG]]','로고·스크린샷·투명한 이미지. 새 손실이 없습니다.'],
    ['원본 JPG 요청하기','CMS나 CDN이 만든 웹용 WebP라면 올린 사람이 대개 JPG를 갖고 있습니다.']]},
   limits:['JPG에서는 투명도를 유지할 수 없습니다.','WebP의 EXIF·XMP는 복사되지 않으며 움직이는 WebP는 거부합니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`를 Pillow 12.3 화질 80으로 저장한 WebP를 측정했습니다. 투명 채우기는 PNG → JPG 페이지에서 측정한 것과 같은 `Im.background` 호출입니다. 형식 특성은 MDN을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'WebPをJPGにするのは、WebPを開けないソフト（古い写真アプリ、一部のアップロードフォーム、プリントサービス）のためです。ファイルは大きくなると考えてください。31,724バイトのWebP写真が画質92で68,975バイトのJPGになりました（2.2倍、SSIM 0.9941）。JPGには透明がないため、透過WebP（ステッカーや切り抜き）は背景色（初期値は白）の上に合成されます。ロゴ・スクリーンショット・透過画像ならPNGを選びます。',
   concept:{title:'JPGが元のWebPより大きくなる理由',body:[
    'WebPをピクセルに展開し、別の非可逆方式でエンコードし直します。JPGエンコーダーはWebPのぼかしやブロックの境目を絵の内容とみなし、それを再現するためにバイトを使うので、元より良くはならないのにJPGのほうが大きくなります。',
    '画質を下げれば容量は減りますが、WebPのぼかしの上にJPGのブロックが重なります。提出先に容量の上限があるなら、画質を推測せずに[[image/compress|圧縮]]で形式をJPG、目標容量を指定します。'],
    terms:[['トランスコード','非可逆形式を別の非可逆形式に変えること。2つのエンコーダーの誤差が重なります。'],['JPGの背景色','WebPが透明だった部分に入る色（詳細設定で変えなければ `#ffffff`）。'],['画質','JPGエンコーダーの設定20〜100、初期値92。']]},
   example:{title:'WebP写真を別の形式に（実測）',lead:'NASAのテスト写真をPillowの画質80で保存した512 × 512のWebP、Chromium 153上のNerulioの変換、2026-09-28。',lines:[
    '元画像: astronaut.webp     31,724 バイト',
    '',
    '-> JPG q92      68,975 バイト    2.2倍    SSIM 0.9941',
    '-> PNG         431,041 バイト   13.6倍    ピクセル同一',
    '',
    '透明: JPGにはアルファチャンネルがなく、透明ピクセルは',
    '      JPGの背景色（初期値 #ffffff）になります'],
    after:'同じ塗りつぶしは[[image/png-to-jpg|PNG → JPG]]で透過スプライトシートを使って計測しました（透明ピクセル8,095個がすべて白に）。透過を残すなら[[image/webp-to-png|WebP → PNG]]を使います。'},
   mapping:{title:'WebPの中身はどうなるか',head:['WebPにあったもの','変換での処理','JPGでは'],rows:[
    ['展開したピクセル','選んだ画質で非可逆エンコード','近似したピクセル、幅・高さは同じ'],
    ['アルファチャンネル','JPGの背景色の上に描く','アルファなし。透明だった部分は背景色'],
    ['アニメーションのフレーム','変換前に拒否','—'],
    ['`EXIF`・`XMP`・`ICCP` チャンク','コピーしない','ChromiumのsRGBプロファイル、EXIFなし']]},
   verify:{steps:[
    'WebPを拒否していたソフトでJPGを開きます。',
    '元画像に透明部分があったなら、塗られた色が意図した色か確認します。',
    'バイト数を比べます。提出先がPNGを受け付け、画像がグラフィックならPNGのほうが良いファイルかもしれません。']},
   trouble:{rows:[
    ['JPGがWebPの2倍の大きさ','トランスコードでJPGがWebPのノイズの再現にバイトを使った','結果一覧で容量を比べる','そのまま使うか、画質を下げるか、目標容量を決めて[[image/compress|圧縮]]します'],
    ['ステッカーの周りに白い四角','WebPが透過していて、JPGはアルファを保存できない','市松模様の背景でWebPを確認','[[image/webp-to-png|WebP → PNG]]を使うか、詳細設定で実際の背景色を指定します'],
    ['まだファイルが開けない','変換ではなく名前だけ変えた、またはダウンロードしたファイルがまだ `.webp`','JPGは `ÿØÿ` のバイトで始まる','結果一覧から変換済みファイルを保存し直します'],
    ['画像内の文字が悪化した','くっきりした輪郭に非可逆エンコーダーが2回続けてかかった','文字を拡大','スクリーンショットやグラフィックはPNGにします']]},
   alternatives:{rows:[
    ['[[image/webp-to-png|WebP → PNG]]','ロゴ・スクリーンショット・透過画像。新たな劣化がありません。'],
    ['元のJPGをもらう','CMSやCDNが作ったWeb用のWebPなら、アップロードした人がたいていJPGを持っています。']]},
   limits:['JPGでは透過を残せません。','WebPのEXIF・XMPはコピーされず、アニメーションWebPは拒否します。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い、`tests/fixtures/astronaut.png` をPillow 12.3の画質80で保存したWebPを計測しました。透過の塗りつぶしは、PNG → JPGのページで計測したのと同じ `Im.background` の呼び出しです。形式の特性はMDNに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/avif-to-jpg':{
  type:'tool',
  intent:{primary:'convert AVIF to JPG',secondary:['open AVIF files on older software','AVIF to JPG without upload','why is the JPG bigger than the AVIF'],
   goal:'a JPG any program opens, made from an AVIF the browser can decode',input:'AVIF (still image; decoding depends on the browser)',output:'JPG, same dimensions, quality 20–100 (default 92)',target:'software and forms without AVIF support',support:'full',
   evidence:['src/task/convert.js','src/image-container.js (AVIF sequences rejected)','measured 2026-09-28, Chromium 153: astronaut.avif (Pillow 12.3, q60)'],
   external:['MDN: AVIF = AV1 in HEIF, lossy/lossless, alpha, HDR; include fallbacks']},
  en:{
   answer:'AVIF to JPG decodes an AVIF image and writes a JPG that practically every program opens. It works wherever the browser can decode AVIF — Chromium 153 did in our run. The JPG is larger: a 25,255-byte AVIF photo became 62,610 bytes at quality 92 (2.5 times, SSIM 0.9966 against the decoded AVIF). Transparent areas are filled with the background colour, and animated AVIF sequences are refused.',
   concept:{title:'From AV1 intra frames to JPEG blocks',body:[
    'AVIF stores a still picture as an AV1-coded frame inside a HEIF container. AV1 is a modern video codec, so AVIF usually reaches a given quality in fewer bytes than JPG; MDN notes it also supports transparency, higher bit depths and HDR. Converting to JPG gives up that efficiency in exchange for compatibility.',
    'The browser decodes the AVIF into an ordinary 8-bit canvas and Nerulio encodes that canvas as JPG. An HDR or high-bit-depth AVIF is therefore reduced to what the canvas holds, and bright highlights may look different from the original on an HDR screen.'],
    terms:[['AVIF','AV1 Image File Format: AV1 bitstreams in a HEIF container (MDN).'],['Decode support','Nerulio can only convert AVIFs the browser itself can open.'],['HDR','High dynamic range; an ordinary canvas does not keep it.']]},
   example:{title:'A small AVIF becomes a larger JPG (measured)',lead:'An AVIF written by Pillow 12.3 at quality 60 from the 512 × 512 NASA fixture; Nerulio\'s converter in Chromium 153, 2026-09-28.',lines:[
    'Source: astronaut.avif    25,255 bytes   512 x 512',
    '',
    '-> JPG q92     62,610 bytes    2.5 x   SSIM 0.9966',
    '-> PNG        428,230 bytes   17.0 x   identical pixels',
    '-> WebP q92    48,530 bytes    1.9 x   SSIM 0.9938'],
    after:'The JPG is 2.5 times the AVIF and still cannot be sharper than it. If size matters more than compatibility, keep the AVIF where it is accepted.'},
   mapping:{title:'What the JPG keeps from the AVIF',head:['In the AVIF','What the converter does','In the JPG'],rows:[
    ['Decoded pixels','Encoded lossily at the chosen quality','Approximate pixels, same size'],
    ['Alpha channel','Painted onto the JPG background colour','No alpha'],
    ['High bit depth / HDR','Decoded into an 8-bit canvas by the browser','8-bit, sRGB-tagged JPG'],
    ['Image sequence (animated AVIF)','Refused before converting','—']]},
   verify:{steps:[
    'Open the JPG in the software that could not open the AVIF.',
    'Compare it with the AVIF in a browser at 100 %: they should match apart from slight JPG softening.',
    'If the AVIF was HDR, check highlights and skies; they are rendered for a standard display now.']},
   trouble:{rows:[
    ['"This image cannot be opened"','Your browser cannot decode this AVIF (older browser or unusual AVIF features)','Open the AVIF directly in the same browser','Try an up-to-date Chromium, Firefox or Safari; if none opens it, the file may be damaged'],
    ['An animated AVIF is refused','It is an AVIF image sequence; still images only','The file plays as an animation in the browser','Export one frame in another tool first'],
    ['Highlights look dull or clipped','HDR AVIF reduced to an 8-bit canvas','View the AVIF on the same screen in the browser','Ask for an SDR export if the difference matters'],
    ['The JPG is much larger than the AVIF','JPG is less efficient than AV1 intra coding','Compare sizes','Lower the quality, or keep the AVIF where it is accepted']]},
   alternatives:{rows:[
    ['[[image/avif-to-png|AVIF to PNG]]','Graphics, screenshots or transparent AVIFs, when the file size does not matter.'],
    ['Keep the AVIF','Web pages and apps that already accept AVIF; MDN recommends providing fallbacks rather than replacing it.']]},
   limits:['Only AVIFs the browser can decode can be converted.','HDR and high-bit-depth detail and transparency do not survive in JPG; EXIF is not written.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path on an AVIF written by Pillow 12.3 (quality 60) from `tests/fixtures/astronaut.png`. What AVIF is and supports is taken from MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'AVIF를 JPG로 바꾸면 AVIF 이미지를 디코딩해 거의 모든 프로그램이 여는 JPG로 저장합니다. 브라우저가 AVIF를 디코딩할 수 있으면 동작하며, 이번 측정에서 Chromium 153은 가능했습니다. JPG는 더 큽니다. 25,255바이트 AVIF 사진이 화질 92에서 62,610바이트가 됐습니다(2.5배, 디코딩한 AVIF 대비 SSIM 0.9966). 투명한 부분은 배경색으로 채워지고 움직이는 AVIF 시퀀스는 거부합니다.',
   concept:{title:'AV1 프레임에서 JPEG 블록으로',body:[
    'AVIF는 정지 그림을 AV1로 부호화한 프레임 하나로 HEIF 컨테이너에 담습니다. AV1은 최신 영상 코덱이라 같은 화질을 JPG보다 적은 바이트로 내는 경우가 많고, MDN에 따르면 투명도·높은 비트 심도·HDR도 지원합니다. JPG로 바꾸면 이 효율을 포기하고 호환성을 얻습니다.',
    '브라우저가 AVIF를 일반적인 8비트 캔버스로 디코딩하고, Nerulio가 그 캔버스를 JPG로 인코딩합니다. 그래서 HDR이나 높은 비트 심도의 AVIF는 캔버스가 담을 수 있는 범위로 줄어들고, HDR 화면에서 보던 밝은 부분이 다르게 보일 수 있습니다.'],
    terms:[['AVIF','AV1 Image File Format. AV1 비트스트림을 HEIF 컨테이너에 담은 형식(MDN).'],['디코딩 지원','Nerulio는 브라우저가 직접 열 수 있는 AVIF만 변환할 수 있습니다.'],['HDR','높은 명암 범위. 일반 캔버스에서는 유지되지 않습니다.']]},
   example:{title:'작은 AVIF가 더 큰 JPG로(실측)',lead:'512 × 512 NASA 테스트 사진을 Pillow 12.3 화질 60으로 저장한 AVIF, Chromium 153의 Nerulio 변환기, 2026-09-28.',lines:[
    '원본: astronaut.avif     25,255 바이트   512 x 512',
    '',
    '-> JPG q92     62,610 바이트    2.5배   SSIM 0.9966',
    '-> PNG        428,230 바이트   17.0배   픽셀 동일',
    '-> WebP q92    48,530 바이트    1.9배   SSIM 0.9938'],
    after:'JPG는 AVIF의 2.5배이면서도 AVIF보다 선명해질 수는 없습니다. 호환성보다 용량이 중요하다면 AVIF를 받는 곳에서는 AVIF를 그대로 쓰세요.'},
   mapping:{title:'AVIF에서 JPG로 남는 것',head:['AVIF에 있던 것','변환기가 하는 일','JPG에서는'],rows:[
    ['디코딩된 픽셀','선택한 화질로 손실 인코딩','근사한 픽셀, 크기 동일'],
    ['알파 채널','JPG 배경색 위에 칠함','알파 없음'],
    ['높은 비트 심도·HDR','브라우저가 8비트 캔버스로 디코딩','8비트, sRGB 태그 JPG'],
    ['이미지 시퀀스(움직이는 AVIF)','변환 전에 거부','—']]},
   verify:{steps:[
    'AVIF를 열지 못하던 소프트웨어에서 JPG를 열어 보세요.',
    '브라우저에서 AVIF와 100%로 비교하세요. JPG 특유의 약간의 흐림 말고는 같아야 합니다.',
    'AVIF가 HDR이었다면 하이라이트와 하늘을 확인하세요. 이제 일반 디스플레이 기준으로 표현됩니다.']},
   trouble:{rows:[
    ['"이미지를 열 수 없습니다"','브라우저가 이 AVIF를 디코딩하지 못합니다(오래된 브라우저나 특이한 AVIF 기능)','같은 브라우저에서 AVIF를 직접 열어 보기','최신 Chromium·Firefox·Safari를 써 보고, 어디서도 안 열리면 파일이 손상됐을 수 있습니다'],
    ['움직이는 AVIF가 거부됨','AVIF 이미지 시퀀스이며 정지 이미지만 처리합니다','브라우저에서 애니메이션으로 재생됨','다른 도구로 한 프레임을 먼저 내보내세요'],
    ['밝은 부분이 칙칙하거나 날아감','HDR AVIF가 8비트 캔버스로 줄었습니다','같은 화면의 브라우저에서 AVIF 보기','차이가 중요하면 SDR로 내보낸 파일을 요청하세요'],
    ['JPG가 AVIF보다 훨씬 큼','JPG는 AV1 프레임 부호화보다 효율이 낮습니다','용량 비교','화질을 낮추거나, AVIF를 받는 곳에서는 AVIF를 쓰세요']]},
   alternatives:{rows:[
    ['[[image/avif-to-png|AVIF → PNG]]','그래픽·스크린샷·투명 AVIF이고 용량이 중요하지 않을 때.'],
    ['AVIF 그대로 쓰기','이미 AVIF를 받는 웹페이지와 앱. MDN은 AVIF를 바꾸기보다 대체 형식을 함께 제공하라고 권합니다.']]},
   limits:['브라우저가 디코딩할 수 있는 AVIF만 변환할 수 있습니다.','HDR·높은 비트 심도의 정보와 투명도는 JPG에 남지 않고 EXIF도 기록하지 않습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`를 Pillow 12.3 화질 60으로 저장한 AVIF를 측정했습니다. AVIF의 구조와 기능은 MDN 설명을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'AVIFをJPGにすると、AVIF画像を展開して、ほぼすべてのソフトで開けるJPGとして保存します。ブラウザがAVIFを展開できれば動作し、今回の計測ではChromium 153で展開できました。JPGのほうが大きくなります。25,255バイトのAVIF写真が画質92で62,610バイトになりました（2.5倍、展開したAVIFに対するSSIM 0.9966）。透明部分は背景色で塗られ、アニメーションのAVIFシーケンスは拒否します。',
   concept:{title:'AV1のフレームからJPEGのブロックへ',body:[
    'AVIFは静止画をAV1で符号化した1フレームとしてHEIFコンテナに収めます。AV1は新しい動画コーデックで、同じ画質をJPGより少ないバイト数で実現できることが多く、MDNによれば透過・高ビット深度・HDRにも対応します。JPGに変換すると、この効率を手放す代わりに互換性を得ます。',
    'ブラウザがAVIFを通常の8ビットのキャンバスに展開し、Nerulioがそのキャンバスをエンコードします。そのためHDRや高ビット深度のAVIFはキャンバスが扱える範囲に縮められ、HDR画面で見ていた明るい部分が違って見えることがあります。'],
    terms:[['AVIF','AV1 Image File Format。AV1のビットストリームをHEIFコンテナに入れた形式（MDN）。'],['展開の対応','Nerulioが変換できるのは、ブラウザ自身が開けるAVIFだけです。'],['HDR','広いダイナミックレンジ。通常のキャンバスでは保持されません。']]},
   example:{title:'小さなAVIFが大きなJPGに（実測）',lead:'512 × 512のNASAのテスト写真をPillow 12.3の画質60で保存したAVIF、Chromium 153上のNerulioの変換、2026-09-28。',lines:[
    '元画像: astronaut.avif     25,255 バイト   512 x 512',
    '',
    '-> JPG q92     62,610 バイト    2.5倍   SSIM 0.9966',
    '-> PNG        428,230 バイト   17.0倍   ピクセル同一',
    '-> WebP q92    48,530 バイト    1.9倍   SSIM 0.9938'],
    after:'JPGはAVIFの2.5倍の大きさなのに、AVIFより鮮明にはなりません。互換性より容量が大事なら、AVIFを受け付ける場所ではAVIFのまま使います。'},
   mapping:{title:'AVIFからJPGに残るもの',head:['AVIFにあったもの','変換での処理','JPGでは'],rows:[
    ['展開したピクセル','選んだ画質で非可逆エンコード','近似したピクセル、サイズは同じ'],
    ['アルファチャンネル','JPGの背景色の上に描く','アルファなし'],
    ['高ビット深度・HDR','ブラウザが8ビットのキャンバスに展開','8ビット、sRGBタグ付きのJPG'],
    ['画像シーケンス（アニメーションAVIF）','変換前に拒否','—']]},
   verify:{steps:[
    'AVIFを開けなかったソフトでJPGを開きます。',
    'ブラウザでAVIFと100%で比べます。JPG特有のわずかなぼやけ以外は同じはずです。',
    'AVIFがHDRだったなら、ハイライトや空を確認します。今は通常のディスプレイ向けに表現されています。']},
   trouble:{rows:[
    ['「画像を開けません」と出る','ブラウザがこのAVIFを展開できない（古いブラウザや特殊なAVIFの機能）','同じブラウザでAVIFを直接開いてみる','最新のChromium・Firefox・Safariで試し、どれでも開けなければファイルの破損を疑います'],
    ['アニメーションAVIFが拒否される','AVIFの画像シーケンスで、静止画しか扱わない','ブラウザでアニメーションとして再生される','別のツールで1コマを先に書き出します'],
    ['明るい部分がくすむ・白飛びする','HDRのAVIFが8ビットのキャンバスに縮められた','同じ画面のブラウザでAVIFを見る','違いが重要ならSDRで書き出したファイルを依頼します'],
    ['JPGがAVIFよりずっと大きい','JPGはAV1のフレーム符号化より効率が低い','容量を比べる','画質を下げるか、AVIFを受け付ける場所ではAVIFを使います']]},
   alternatives:{rows:[
    ['[[image/avif-to-png|AVIF → PNG]]','グラフィック・スクリーンショット・透過AVIFで、容量が問題にならない場合。'],
    ['AVIFのまま使う','すでにAVIFを受け付けるWebページやアプリ。MDNはAVIFを置き換えるより代替形式を併用するよう勧めています。']]},
   limits:['変換できるのは、ブラウザが展開できるAVIFだけです。','HDR・高ビット深度の情報と透過はJPGに残らず、EXIFも書き込みません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い、`tests/fixtures/astronaut.png` をPillow 12.3の画質60で保存したAVIFを計測しました。AVIFの構造と機能はMDNの説明に従っています。'],sources:[MDN.ja]}
  }
 },
 'image/avif-to-png':{
  type:'tool',
  intent:{primary:'convert AVIF to PNG',secondary:['open AVIF in an editor that needs PNG','keep AVIF transparency','AVIF to PNG file size'],
   goal:'a lossless PNG of the decoded AVIF that editors and engines open',input:'AVIF (still; the browser must decode it)',output:'PNG, lossless, same dimensions, alpha kept',target:'image editors, game engines, tools without AVIF support',support:'full',
   evidence:['src/task/convert.js','src/image-container.js','measured 2026-09-28, Chromium 153: astronaut.avif (Pillow 12.3 q60)'],
   external:['MDN: AVIF lossy/lossless, alpha, HDR']},
  en:{
   answer:'AVIF to PNG gives editors and game engines that cannot read AVIF an exact, lossless copy of the decoded picture, transparency included. Nothing is added or recovered: the PNG shows the AVIF\'s compression exactly as decoded. It is by far the largest route out of AVIF — a 25,255-byte AVIF photo (512 × 512) became a 428,230-byte PNG, 17 times larger — so use it for graphics, cut-outs and working copies, and [[image/avif-to-jpg|AVIF to JPG]] for photos you only need to share.',
   concept:{title:'An exact snapshot of the decoded AVIF',body:[
    'An AVIF is decoded by the browser into 8-bit RGBA pixels. PNG stores those pixels without loss, so the PNG is the most faithful file you can get out of the AVIF without AVIF support — every later edit and save starts from exactly what the AVIF showed.',
    'The size jump comes from what AV1 already discarded: the AVIF encoder threw away fine grain PNG would have to spell out byte by byte. For a flat-colour logo or UI element the jump is much smaller, since PNG compresses flat areas well. AVIF transparency is kept as PNG alpha; HDR and extra bit depth are not, because the canvas holds 8 bits per channel.'],
    terms:[['8-bit RGBA','Four 0–255 values per pixel: what the browser canvas holds after decoding.'],['PNG alpha','Per-pixel transparency in the PNG; transparent AVIF areas stay transparent.'],['Bit depth','Bits per channel. AVIF may use 10 or 12; the PNG written here has 8.']]},
   example:{title:'One AVIF, three ways out (measured)',lead:'AVIF written by Pillow 12.3 at quality 60 from the 512 × 512 NASA fixture; converted with Nerulio\'s code in Chromium 153 on 2026-09-28.',lines:[
    'Source: astronaut.avif     25,255 bytes',
    '',
    '-> PNG          428,230 bytes   17.0 x   identical to the decoded AVIF',
    '-> WebP q100    235,326 bytes    9.3 x   lossless, identical',
    '-> JPG q92       62,610 bytes    2.5 x   SSIM 0.9966'],
    after:'A lossless WebP holds the same pixels as the PNG in 45 % less space, if the program that needs the file reads WebP.'},
   mapping:{title:'What the PNG receives',head:['In the AVIF','What the converter does','In the PNG'],rows:[
    ['Decoded pixels','Stored losslessly','Identical 8-bit pixels'],
    ['Alpha','Kept','PNG alpha'],
    ['10/12-bit depth, HDR','Reduced to the browser\'s 8-bit canvas','8 bits per channel, no HDR'],
    ['Image sequence (animated AVIF)','Refused before converting','—'],
    ['EXIF / colour metadata','Not copied','No EXIF, no profile chunk']]},
   verify:{steps:[
    'Open the PNG in the editor or engine that refused the AVIF.',
    'Check transparent areas on a checkered background.',
    'Compare the PNG with the AVIF in the browser at 100 %: they should be indistinguishable.']},
   trouble:{rows:[
    ['"This image cannot be opened"','The browser cannot decode this AVIF','Open the AVIF directly in the same browser','Use an up-to-date browser; if no browser opens it, the file is probably damaged'],
    ['The PNG is enormous','Lossless PNG of a photo that AV1 had compressed hard','Compare sizes','Use [[image/avif-to-jpg|AVIF to JPG]] for photos, or lossless WebP if the target reads WebP'],
    ['HDR highlights look flat','8-bit canvas, no HDR in the PNG','Compare with the AVIF on an HDR display','Ask the author for an SDR export when looks matter'],
    ['Animated AVIF is refused','Image sequences are not still images','The AVIF plays in the browser','Extract one frame elsewhere first']]},
   alternatives:{rows:[
    ['[[image/avif-to-jpg|AVIF to JPG]]','Photos that only need to open everywhere: 62,610 instead of 428,230 bytes here.'],
    ['[[image/compress|Compress]] with Auto','You need a small file of the AVIF in a common format; it compares PNG, JPG and WebP.']]},
   limits:['Only AVIFs the browser decodes can be converted.','HDR and bit depth above 8 are not kept; EXIF is not written.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path on an AVIF written by Pillow 12.3 (quality 60) from `tests/fixtures/astronaut.png`. AVIF\'s features (alpha, higher bit depth, HDR) follow MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'AVIF를 PNG로 바꾸면 AVIF를 읽지 못하는 편집기와 게임 엔진에 디코딩한 그림을 투명도까지 포함해 정확한 무손실 사본으로 넘길 수 있습니다. 더해지거나 복구되는 것은 없고, PNG는 AVIF의 압축 흔적을 디코딩된 그대로 보여 줍니다. AVIF에서 나가는 경로 중 가장 큽니다. 25,255바이트 AVIF 사진(512 × 512)이 428,230바이트 PNG, 17배가 됐습니다. 그래픽·누끼·작업용 사본에 쓰고, 공유만 할 사진은 [[image/avif-to-jpg|AVIF → JPG]]를 쓰세요.',
   concept:{title:'디코딩된 AVIF의 정확한 스냅숏',body:[
    '브라우저가 AVIF를 8비트 RGBA 픽셀로 디코딩하고 PNG가 그 픽셀을 손실 없이 저장합니다. 그래서 AVIF를 지원하지 않는 환경에서 얻을 수 있는 가장 충실한 파일이며, 이후의 편집과 저장은 AVIF가 보여 주던 모습 그대로에서 시작합니다.',
    '크기가 크게 느는 이유는 AV1이 이미 버린 정보 때문입니다. AVIF 인코더는 PNG가 바이트 단위로 모두 적어야 할 미세한 결을 버렸습니다. 단색 로고나 UI 요소는 PNG가 평평한 영역을 잘 압축하므로 훨씬 덜 늘어납니다. AVIF의 투명도는 PNG 알파로 유지되지만, 캔버스가 채널당 8비트라 HDR과 추가 비트 심도는 유지되지 않습니다.'],
    terms:[['8비트 RGBA','픽셀마다 0~255 값 네 개. 디코딩 후 브라우저 캔버스가 담는 형태입니다.'],['PNG 알파','PNG의 픽셀별 투명도. AVIF의 투명한 부분은 그대로 투명합니다.'],['비트 심도','채널당 비트 수. AVIF는 10·12비트도 쓰지만 여기서 만드는 PNG는 8비트입니다.']]},
   example:{title:'AVIF 한 장, 세 가지 출력(실측)',lead:'512 × 512 NASA 테스트 사진을 Pillow 12.3 화질 60으로 저장한 AVIF를 2026-09-28 Chromium 153에서 Nerulio 코드로 변환했습니다.',lines:[
    '원본: astronaut.avif      25,255 바이트',
    '',
    '-> PNG          428,230 바이트   17.0배   디코딩한 AVIF와 동일',
    '-> WebP q100    235,326 바이트    9.3배   무손실, 동일',
    '-> JPG q92       62,610 바이트    2.5배   SSIM 0.9966'],
    after:'파일을 쓸 프로그램이 WebP를 읽는다면 무손실 WebP가 PNG와 같은 픽셀을 45% 작게 담습니다.'},
   mapping:{title:'PNG로 넘어가는 것',head:['AVIF에 있던 것','변환기가 하는 일','PNG에서는'],rows:[
    ['디코딩된 픽셀','무손실로 저장','동일한 8비트 픽셀'],
    ['알파','유지','PNG 알파'],
    ['10·12비트 심도, HDR','브라우저의 8비트 캔버스로 줄어듦','채널당 8비트, HDR 없음'],
    ['이미지 시퀀스(움직이는 AVIF)','변환 전에 거부','—'],
    ['EXIF·색 메타데이터','복사하지 않음','EXIF·프로필 청크 없음']]},
   verify:{steps:[
    'AVIF를 거부하던 편집기나 엔진에서 PNG를 열어 보세요.',
    '투명한 부분을 체크무늬 배경에서 확인하세요.',
    '브라우저에서 AVIF와 100%로 비교하세요. 구별할 수 없어야 합니다.']},
   trouble:{rows:[
    ['"이미지를 열 수 없습니다"','브라우저가 이 AVIF를 디코딩하지 못합니다','같은 브라우저에서 AVIF를 직접 열기','최신 브라우저를 쓰세요. 어떤 브라우저에서도 안 열리면 파일이 손상됐을 가능성이 큽니다'],
    ['PNG가 너무 큼','AV1이 강하게 압축한 사진을 무손실 PNG로 저장했습니다','용량 비교','사진은 [[image/avif-to-jpg|AVIF → JPG]]를, 대상이 WebP를 읽으면 무손실 WebP를 쓰세요'],
    ['HDR 하이라이트가 밋밋함','8비트 캔버스라 PNG에 HDR이 없습니다','HDR 화면에서 AVIF와 비교','색감이 중요하면 작성자에게 SDR 버전을 요청하세요'],
    ['움직이는 AVIF가 거부됨','이미지 시퀀스는 정지 이미지가 아닙니다','브라우저에서 AVIF가 재생됨','다른 곳에서 한 프레임을 먼저 추출하세요']]},
   alternatives:{rows:[
    ['[[image/avif-to-jpg|AVIF → JPG]]','어디서나 열리기만 하면 되는 사진. 여기서는 428,230바이트 대신 62,610바이트였습니다.'],
    ['자동 형식으로 [[image/compress|압축]]','AVIF를 흔한 형식의 작은 파일로 만들어야 할 때. PNG·JPG·WebP를 비교합니다.']]},
   limits:['브라우저가 디코딩하는 AVIF만 변환할 수 있습니다.','HDR과 8비트를 넘는 비트 심도는 유지되지 않으며 EXIF는 기록하지 않습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`를 Pillow 12.3 화질 60으로 저장한 AVIF를 측정했습니다. AVIF의 기능(알파, 높은 비트 심도, HDR)은 MDN을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'AVIFをPNGにすると、AVIFを読めない編集ソフトやゲームエンジンに、展開した画像を透過も含めて正確な可逆コピーとして渡せます。何かが加わったり復元されたりはせず、PNGはAVIFの圧縮の跡を展開したとおりに写します。AVIFからの変換では最も大きくなる経路で、25,255バイトのAVIF写真（512 × 512）が428,230バイトのPNG、17倍になりました。グラフィック・切り抜き・作業用コピーに使い、共有するだけの写真は[[image/avif-to-jpg|AVIF → JPG]]にします。',
   concept:{title:'展開したAVIFの正確なスナップショット',body:[
    'ブラウザがAVIFを8ビットのRGBAピクセルに展開し、PNGがそのピクセルを劣化なく保存します。AVIF非対応の環境で得られる最も忠実なファイルであり、以後の編集や保存はAVIFが見せていたとおりの状態から始まります。',
    '大きく増えるのは、AV1がすでに捨てた情報のためです。AVIFエンコーダーは、PNGなら1バイトずつ書き出さなければならない細かな粒状感を捨てています。単色のロゴやUI部品はPNGが平坦な部分をうまく圧縮するので、増え方はずっと小さくなります。AVIFの透過はPNGのアルファとして残りますが、キャンバスはチャンネルあたり8ビットなので、HDRや追加のビット深度は残りません。'],
    terms:[['8ビットRGBA','ピクセルごとに0〜255の値が4つ。展開後にブラウザのキャンバスが持つ形です。'],['PNGのアルファ','PNGのピクセルごとの透明度。AVIFの透明部分は透明のままです。'],['ビット深度','チャンネルあたりのビット数。AVIFは10・12ビットも使えますが、ここで書き出すPNGは8ビットです。']]},
   example:{title:'1枚のAVIFから3通りの出力（実測）',lead:'512 × 512のNASAのテスト写真をPillow 12.3の画質60で保存したAVIFを、2026-09-28にChromium 153でNerulioのコードを使って変換しました。',lines:[
    '元画像: astronaut.avif      25,255 バイト',
    '',
    '-> PNG          428,230 バイト   17.0倍   展開したAVIFと同一',
    '-> WebP q100    235,326 バイト    9.3倍   可逆、同一',
    '-> JPG q92       62,610 バイト    2.5倍   SSIM 0.9966'],
    after:'ファイルを使うソフトがWebPを読めるなら、可逆WebPはPNGと同じピクセルを45%小さく保存できます。'},
   mapping:{title:'PNGに引き継がれるもの',head:['AVIFにあったもの','変換での処理','PNGでは'],rows:[
    ['展開したピクセル','可逆で保存','同一の8ビットピクセル'],
    ['アルファ','保持','PNGのアルファ'],
    ['10・12ビット深度、HDR','ブラウザの8ビットキャンバスに縮小','チャンネルあたり8ビット、HDRなし'],
    ['画像シーケンス（アニメーションAVIF）','変換前に拒否','—'],
    ['EXIF・色のメタデータ','コピーしない','EXIF・プロファイルのチャンクなし']]},
   verify:{steps:[
    'AVIFを拒否していた編集ソフトやエンジンでPNGを開きます。',
    '透明部分を市松模様の背景で確認します。',
    'ブラウザでAVIFと100%で比べます。見分けがつかないはずです。']},
   trouble:{rows:[
    ['「画像を開けません」と出る','ブラウザがこのAVIFを展開できない','同じブラウザでAVIFを直接開く','最新のブラウザを使います。どのブラウザでも開けなければファイルの破損が濃厚です'],
    ['PNGが大きすぎる','AV1が強く圧縮した写真を可逆PNGで保存した','容量を比べる','写真は[[image/avif-to-jpg|AVIF → JPG]]に、渡し先がWebPを読めるなら可逆WebPにします'],
    ['HDRのハイライトが平板','8ビットのキャンバスで、PNGにHDRがない','HDRディスプレイでAVIFと比べる','見た目が重要なら作者にSDR版を依頼します'],
    ['アニメーションAVIFが拒否される','画像シーケンスは静止画ではない','ブラウザでAVIFが再生される','別の場所で1コマを先に取り出します']]},
   alternatives:{rows:[
    ['[[image/avif-to-jpg|AVIF → JPG]]','どこでも開ければよい写真。ここでは428,230バイトではなく62,610バイトでした。'],
    ['自動形式で[[image/compress|圧縮]]','AVIFを一般的な形式の小さなファイルにしたい場合。PNG・JPG・WebPを比べます。']]},
   limits:['変換できるのは、ブラウザが展開できるAVIFだけです。','HDRと8ビットを超えるビット深度は保持されず、EXIFも書き込みません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い、`tests/fixtures/astronaut.png` をPillow 12.3の画質60で保存したAVIFを計測しました。AVIFの機能（アルファ、高ビット深度、HDR）はMDNに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/bmp-to-png':{
  type:'tool',
  intent:{primary:'convert BMP to PNG',secondary:['make BMP files smaller without losing quality','BMP to PNG lossless','open BMP on the web'],
   goal:'a lossless PNG, much smaller than the BMP, with identical pixels',input:'BMP (the common uncompressed 24-bit kind; decoding by the browser)',output:'PNG, lossless, same dimensions',target:'web pages, chat, documents, game tools',support:'full',
   evidence:['src/task/convert.js','measured 2026-09-28, Chromium 153: astronaut.bmp (512×512, 786,486 B), dungeon.bmp from Kenney tiny-dungeon (203×186, 113,886 B)'],
   external:['MDN: BMP usually uncompressed, 3 bytes per pixel, rows padded to 4 bytes; avoid for web content']},
  en:{
   answer:'BMP to PNG is the safe way to shrink a BMP: both formats are lossless, so the PNG has exactly the same pixels, only compressed. How much you save depends on the content — a 512 × 512 photo went from 786,486 to 575,694 bytes (−27 %), while a 203 × 186 tile sheet with flat colours went from 113,886 to 16,685 bytes (−85 %). The width and height are unchanged, and no quality setting is involved.',
   concept:{title:'Why BMPs are so large',body:[
    'The common BMP stores every pixel as three raw bytes (blue, green, red) with no compression, and pads each row to a multiple of 4 bytes. Its size is therefore fixed by the dimensions: 54 header bytes + height × padded row length. MDN recommends avoiding BMP for web content for exactly this reason.',
    'PNG predicts each pixel from its neighbours and compresses the difference losslessly. Flat colour, text and pixel art predict almost perfectly and shrink dramatically; camera noise does not, so photos shrink only moderately. Either way nothing is lost — the measured PNGs decode to the very same pixels as the BMPs.'],
    terms:[['Uncompressed','Raw pixel bytes; the file size depends only on width and height.'],['Row padding','Each BMP row is rounded up to a multiple of 4 bytes.'],['Lossless','The PNG decodes to exactly the pixels the BMP held.']]},
   example:{title:'Size arithmetic and two measured files',lead:'BMP sizes computed from the format; PNG sizes measured with Nerulio\'s converter in Chromium 153 on 2026-09-28 (BMPs written by Pillow 12.3 from the repository fixtures).',lines:[
    'Photo   512 x 512:  row = 512 x 3 = 1,536 bytes (already a multiple of 4)',
    '        54 + 512 x 1,536 = 786,486 bytes BMP  ->  575,694 bytes PNG  (-27 %)',
    '',
    'Tiles   203 x 186:  row = 203 x 3 = 609 -> padded to 612 bytes',
    '        54 + 186 x 612   = 113,886 bytes BMP  ->   16,685 bytes PNG  (-85 %)',
    '',
    'Pixels changed in both PNGs: 0'],
    after:'The tile sheet is Kenney\'s CC0 Tiny Dungeon tilemap flattened onto black; as lossless WebP (quality 100) it shrank further to 6,318 bytes, also pixel-exact.'},
   mapping:{title:'What the PNG keeps',head:['In the BMP','What the converter does','In the PNG'],rows:[
    ['24-bit pixels','Stored losslessly','Identical pixels'],
    ['Row padding and bottom-up order','Handled by the browser\'s decoder','Not needed in PNG'],
    ['File size tied to dimensions','Replaced by DEFLATE compression','Size depends on content'],
    ['Header resolution (DPI) fields','Not copied','No DPI information']]},
   verify:{steps:[
    'Open both files at 100 %: they must look identical, because both formats are lossless.',
    'Check that width and height match the BMP.',
    'Compare the byte counts: screenshots and graphics usually shrink far more than photos.']},
   trouble:{rows:[
    ['"This image cannot be opened"','An unusual BMP variant (compressed, odd bit depth) the browser does not decode','Open the BMP directly in the browser','Re-save it as a standard 24-bit BMP or PNG in the program that made it'],
    ['The PNG is only a little smaller','A photo: noise compresses poorly even in PNG','Compare sizes','For photos, [[image/bmp-to-jpg|BMP to JPG]] is ten times smaller'],
    ['Print size changed in a layout program','BMP DPI fields are not copied, so the program assumes its default','Look at the image\'s DPI in that program','Set the size in the layout program; the pixel dimensions are unchanged'],
    ['Colours look different in an old viewer','The PNG has no colour profile, the viewer may treat colours differently','Compare in a browser','Use a current viewer; the pixel values are identical']]},
   alternatives:{rows:[
    ['[[image/bmp-to-jpg|BMP to JPG]]','Camera photos where a tenth of the size matters more than exact pixels.'],
    ['[[image/convert|Convert]] to WebP at quality 100','The target reads WebP: lossless and smaller still (6,318 vs 16,685 bytes for the tile sheet).']]},
   limits:['Only BMP variants the browser decodes can be read.','DPI and other header fields are not carried over.'],
   versions:{body:['BMP sizes follow the layout MDN describes (3 bytes per pixel, rows padded to 4 bytes). PNG sizes and the zero-difference check were measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path, on BMPs written by Pillow 12.3 from `tests/fixtures/astronaut.png` and `tests/fixtures/kenney/tiny-dungeon-tilemap.png`.'],sources:[MDN.en]}
  },
  ko:{
   answer:'BMP를 PNG로 바꾸는 것은 BMP를 줄이는 가장 안전한 방법입니다. 두 형식 모두 무손실이라 PNG는 픽셀이 완전히 같고 압축만 됩니다. 얼마나 줄지는 내용에 달려 있습니다. 512 × 512 사진은 786,486바이트에서 575,694바이트(−27%)가 됐고, 단색이 많은 203 × 186 타일 시트는 113,886바이트에서 16,685바이트(−85%)가 됐습니다. 가로·세로는 그대로이고 화질 설정도 쓰이지 않습니다.',
   concept:{title:'BMP가 큰 이유',body:[
    '일반적인 BMP는 픽셀마다 파랑·초록·빨강 세 바이트를 압축 없이 저장하고, 각 행을 4바이트의 배수로 채웁니다. 그래서 크기가 해상도만으로 정해집니다. 헤더 54바이트 + 높이 × 채운 행 길이입니다. MDN도 이 때문에 웹 콘텐츠에는 BMP를 피하라고 권합니다.',
    'PNG는 각 픽셀을 이웃 픽셀로 예측하고 그 차이를 무손실로 압축합니다. 단색·글자·도트 그림은 거의 완벽하게 예측되어 크게 줄지만, 카메라 노이즈는 그렇지 않아 사진은 적당히만 줄어듭니다. 어느 경우든 잃는 것은 없으며, 측정한 PNG는 BMP와 똑같은 픽셀로 디코딩됐습니다.'],
    terms:[['비압축','픽셀 바이트를 그대로 저장. 파일 크기는 가로·세로로만 정해집니다.'],['행 채움(패딩)','BMP의 각 행은 4바이트의 배수로 올림됩니다.'],['무손실','PNG가 BMP에 있던 픽셀과 정확히 같게 디코딩됩니다.']]},
   example:{title:'크기 계산과 실측 두 건',lead:'BMP 크기는 형식 구조로 계산했고, PNG 크기는 2026-09-28 Chromium 153에서 Nerulio 변환기로 측정했습니다(BMP는 저장소 테스트 자료로 Pillow 12.3이 만든 것).',lines:[
    '사진   512 x 512:  행 = 512 x 3 = 1,536 바이트 (이미 4의 배수)',
    '       54 + 512 x 1,536 = 786,486 바이트 BMP  ->  575,694 바이트 PNG  (-27 %)',
    '',
    '타일   203 x 186:  행 = 203 x 3 = 609 -> 612 바이트로 채움',
    '       54 + 186 x 612   = 113,886 바이트 BMP  ->   16,685 바이트 PNG  (-85 %)',
    '',
    '두 PNG에서 바뀐 픽셀: 0'],
    after:'타일 시트는 Kenney의 CC0 Tiny Dungeon 타일맵을 검은 배경에 합친 것입니다. 무손실 WebP(화질 100)로는 6,318바이트까지 줄었고 역시 픽셀이 같았습니다.'},
   mapping:{title:'PNG에 남는 것',head:['BMP에 있던 것','변환기가 하는 일','PNG에서는'],rows:[
    ['24비트 픽셀','무손실로 저장','픽셀 동일'],
    ['행 채움과 아래에서 위로 저장하는 순서','브라우저 디코더가 처리','PNG에는 필요 없음'],
    ['해상도에 묶인 파일 크기','DEFLATE 압축으로 대체','크기가 내용에 따라 달라짐'],
    ['헤더의 해상도(DPI) 값','복사하지 않음','DPI 정보 없음']]},
   verify:{steps:[
    '두 파일을 100%로 열어 보세요. 둘 다 무손실이라 똑같아 보여야 합니다.',
    '가로·세로가 BMP와 같은지 확인하세요.',
    '바이트 수를 비교하세요. 스크린샷과 그래픽은 사진보다 훨씬 많이 줄어듭니다.']},
   trouble:{rows:[
    ['"이미지를 열 수 없습니다"','브라우저가 디코딩하지 못하는 특이한 BMP 변형(압축, 특수 비트 심도)입니다','브라우저에서 BMP를 직접 열어 보기','만든 프로그램에서 표준 24비트 BMP나 PNG로 다시 저장하세요'],
    ['PNG가 조금밖에 안 줄어듦','사진이라 PNG로도 노이즈가 잘 압축되지 않습니다','용량 비교','사진이라면 [[image/bmp-to-jpg|BMP → JPG]]가 10분의 1 크기입니다'],
    ['편집 프로그램에서 인쇄 크기가 달라짐','BMP의 DPI 값이 복사되지 않아 프로그램이 기본값을 씁니다','그 프로그램에서 이미지 DPI 확인','편집 프로그램에서 크기를 지정하세요. 픽셀 수는 그대로입니다'],
    ['오래된 뷰어에서 색이 달라 보임','PNG에 색상 프로필이 없어 뷰어가 색을 다르게 처리할 수 있습니다','브라우저에서 비교','최신 뷰어를 쓰세요. 픽셀 값은 동일합니다']]},
   alternatives:{rows:[
    ['[[image/bmp-to-jpg|BMP → JPG]]','정확한 픽셀보다 10분의 1 크기가 중요한 카메라 사진.'],
    ['화질 100 WebP로 [[image/convert|변환]]','대상이 WebP를 읽을 때. 무손실이면서 더 작습니다(타일 시트 6,318 대 16,685바이트).']]},
   limits:['브라우저가 디코딩하는 BMP 변형만 읽을 수 있습니다.','DPI 등 헤더 값은 옮겨지지 않습니다.'],
   versions:{body:['BMP 크기는 MDN이 설명하는 구조(픽셀당 3바이트, 행은 4바이트로 채움)를 따랐습니다. PNG 크기와 픽셀 차이 0은 2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`와 `tests/fixtures/kenney/tiny-dungeon-tilemap.png`로 Pillow 12.3이 만든 BMP를 측정했습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'BMPをPNGにするのは、BMPを小さくする最も安全な方法です。どちらも可逆形式なので、PNGはピクセルがまったく同じで、圧縮されるだけです。どれだけ減るかは内容次第で、512 × 512の写真は786,486バイトから575,694バイト（−27%）、単色の多い203 × 186のタイルシートは113,886バイトから16,685バイト（−85%）になりました。幅と高さは変わらず、画質の設定も使いません。',
   concept:{title:'BMPが大きい理由',body:[
    '一般的なBMPは、ピクセルごとに青・緑・赤の3バイトを圧縮せずに保存し、各行を4バイトの倍数に埋めます。そのため容量は解像度だけで決まり、ヘッダー54バイト + 高さ × 埋めた行の長さになります。MDNもこの理由でWebコンテンツにはBMPを避けるよう勧めています。',
    'PNGは各ピクセルを隣のピクセルから予測し、その差を可逆で圧縮します。単色・文字・ドット絵はほぼ完全に予測できるので大きく縮み、カメラのノイズは予測しにくいので写真はそこそこしか縮みません。どちらでも失うものはなく、計測したPNGはBMPとまったく同じピクセルに展開されました。'],
    terms:[['非圧縮','ピクセルのバイトをそのまま保存。容量は幅と高さだけで決まります。'],['行のパディング','BMPの各行は4バイトの倍数に切り上げられます。'],['可逆','PNGがBMPにあったピクセルとまったく同じに展開されること。']]},
   example:{title:'容量の計算と実測2件',lead:'BMPの容量は形式の構造から計算し、PNGの容量は2026-09-28にChromium 153でNerulioの変換を使って計測しました（BMPはリポジトリのテスト素材からPillow 12.3で作成）。',lines:[
    '写真    512 x 512:  行 = 512 x 3 = 1,536 バイト（すでに4の倍数）',
    '        54 + 512 x 1,536 = 786,486 バイト BMP  ->  575,694 バイト PNG  (-27 %)',
    '',
    'タイル  203 x 186:  行 = 203 x 3 = 609 -> 612 バイトに埋める',
    '        54 + 186 x 612   = 113,886 バイト BMP  ->   16,685 バイト PNG  (-85 %)',
    '',
    '両PNGで変化したピクセル: 0'],
    after:'タイルシートはKenneyのCC0「Tiny Dungeon」のタイルマップを黒背景に合成したものです。可逆WebP（画質100）では6,318バイトまで縮み、こちらもピクセルは同一でした。'},
   mapping:{title:'PNGに残るもの',head:['BMPにあったもの','変換での処理','PNGでは'],rows:[
    ['24ビットのピクセル','可逆で保存','ピクセル同一'],
    ['行のパディングと下から上への並び','ブラウザのデコーダーが処理','PNGでは不要'],
    ['解像度で決まる容量','DEFLATE圧縮に置き換え','容量は内容次第'],
    ['ヘッダーの解像度（DPI）','コピーしない','DPI情報なし']]},
   verify:{steps:[
    '2つのファイルを100%で開きます。どちらも可逆なので、まったく同じに見えるはずです。',
    '幅と高さがBMPと同じか確認します。',
    'バイト数を比べます。スクリーンショットやグラフィックは写真よりずっと大きく縮みます。']},
   trouble:{rows:[
    ['「画像を開けません」と出る','ブラウザが展開できない特殊なBMP（圧縮付き、特殊なビット深度）','ブラウザでBMPを直接開いてみる','作成したソフトで標準の24ビットBMPかPNGとして保存し直します'],
    ['PNGが少ししか小さくならない','写真なので、PNGでもノイズがうまく圧縮できない','容量を比べる','写真なら[[image/bmp-to-jpg|BMP → JPG]]で10分の1になります'],
    ['レイアウトソフトで印刷サイズが変わった','BMPのDPIがコピーされず、ソフトが既定値を使った','そのソフトで画像のDPIを確認','レイアウトソフト側でサイズを指定します。ピクセル数は変わっていません'],
    ['古いビューアで色が違って見える','PNGにカラープロファイルがなく、ビューアが色を別に扱うことがある','ブラウザで比べる','最新のビューアを使います。ピクセル値は同一です']]},
   alternatives:{rows:[
    ['[[image/bmp-to-jpg|BMP → JPG]]','ピクセルの正確さより10分の1の容量が大事なカメラ写真。'],
    ['画質100のWebPに[[image/convert|変換]]','渡し先がWebPを読める場合。可逆でさらに小さくなります（タイルシートで6,318対16,685バイト）。']]},
   limits:['読み込めるのは、ブラウザが展開できるBMPだけです。','DPIなどのヘッダー情報は引き継ぎません。'],
   versions:{body:['BMPの容量はMDNが説明する構造（1ピクセル3バイト、行は4バイトに埋める）に従って計算しました。PNGの容量とピクセル差0は、2026-09-28にPlaywright Chromium 153でNerulioの変換経路を使い、`tests/fixtures/astronaut.png` と `tests/fixtures/kenney/tiny-dungeon-tilemap.png` からPillow 12.3で作ったBMPで計測しました。'],sources:[MDN.ja]}
  }
 },
 'image/bmp-to-jpg':{
  type:'tool',
  intent:{primary:'convert BMP to JPG',secondary:['shrink a BMP photo for email','BMP to JPG quality','when to use PNG instead'],
   goal:'a small JPG of a BMP photo that looks the same, or the advice to use PNG for graphics',input:'BMP (standard 24-bit)',output:'JPG, same dimensions, quality 20–100 (default 92)',target:'email, upload forms, photo apps',support:'full',
   evidence:['src/task/convert.js','measured 2026-09-28, Chromium 153: astronaut.bmp and dungeon.bmp (Kenney tiles)'],
   external:['MDN: BMP uncompressed; JPEG lossy, good for photos, poor for sharp graphics']},
  en:{
   answer:'BMP to JPG shrinks an uncompressed BMP photo to roughly a tenth: the 512 × 512 photo went from 786,486 to 73,755 bytes at quality 92 (9.4 %, SSIM 0.9874). JPG is lossy, so this is the right choice for camera pictures and the wrong one for screenshots, diagrams and pixel art — a 203 × 186 tile sheet became a 28,506-byte JPG that changed almost every pixel, while [[image/bmp-to-png|BMP to PNG]] gave an exact 16,685-byte file.',
   concept:{title:'Uncompressed to lossy: great for photos only',body:[
    'A BMP spends three bytes on every pixel, so it has plenty to gain from any compression. JPG gains the most on photos, where discarding fine frequency detail is hard to see; a quality of 92 kept the NASA photo visually unchanged at under a tenth of the size.',
    'On sharp-edged graphics JPG works against itself: every hard edge produces ringing and smeared colour, and those errors also cost bytes. On the Kenney tile sheet 37,393 of 37,758 pixels changed (largest error 104/255), and the JPG was 70 % bigger than the lossless PNG.'],
    terms:[['Quality','JPG encoder setting 20–100; 92 by default.'],['Ringing','Ripples next to hard edges caused by dropping high frequencies.'],['SSIM','Similarity score, 1.0 = identical; 0.9874 for the photo here.']]},
   example:{title:'Photo versus graphic (measured)',lead:'BMPs written by Pillow 12.3 from repository fixtures; Nerulio\'s converter in Chromium 153 on 2026-09-28, quality 92.',lines:[
    'Photo  astronaut.bmp   512 x 512   786,486 bytes',
    '  -> JPG q92    73,755 bytes    9.4 %   SSIM 0.9874',
    '  -> PNG       575,694 bytes   73.2 %   identical',
    '',
    'Tiles  dungeon.bmp     203 x 186   113,886 bytes',
    '  -> JPG q92    28,506 bytes   25.0 %   37,393 of 37,758 pixels changed',
    '  -> PNG        16,685 bytes   14.7 %   identical'],
    after:'Rule of thumb from these two files: photo → JPG, anything drawn → PNG.'},
   mapping:{title:'What the JPG keeps',head:['In the BMP','What the converter does','In the JPG'],rows:[
    ['24-bit pixels','Encoded lossily at the chosen quality','Approximate pixels, same size'],
    ['File size tied to dimensions','Replaced by JPG compression','About a tenth for the photo'],
    ['32-bit BMP alpha, if any','Painted onto the JPG background colour','No alpha'],
    ['DPI header fields','Not copied','None']]},
   verify:{steps:[
    'Compare BMP and JPG at 100 % on edges and fine texture.',
    'For screenshots or drawings, look for halos around lines; if you see them, convert to PNG instead.',
    'Check the byte count against the limit you need to meet.']},
   trouble:{rows:[
    ['Halos and smudges around text or lines','JPG is lossy and struggles with hard edges','Zoom in on the edges','Use [[image/bmp-to-png|BMP to PNG]] for graphics'],
    ['The JPG is still too large','Quality 92 is above what the limit allows','Read the byte count','Use [[image/compress-to-100kb|compress to 100 KB]] or the size you need'],
    ['The BMP will not open','A BMP variant the browser does not decode','Open the BMP directly in the browser','Re-save as a standard 24-bit BMP or PNG in the original program'],
    ['Printed size changed','DPI fields are not copied','Check DPI in the layout program','Set the print size there; pixel dimensions are unchanged']]},
   alternatives:{rows:[
    ['[[image/bmp-to-png|BMP to PNG]]','Screenshots, drawings, pixel art — exact pixels and often smaller than the JPG.'],
    ['[[image/compress|Compress]] with a target size','You have a byte limit; it picks the quality (and JPG or WebP) for you.']]},
   limits:['JPG is lossy; exact pixels are not kept.','DPI information is not copied and transparency, if any, is filled.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 with Nerulio\'s converter path on BMPs written by Pillow 12.3 from `tests/fixtures/astronaut.png` and `tests/fixtures/kenney/tiny-dungeon-tilemap.png`. Format behaviour follows MDN.'],sources:[MDN.en]}
  },
  ko:{
   answer:'BMP를 JPG로 바꾸면 비압축 BMP 사진이 대략 10분의 1이 됩니다. 512 × 512 사진은 화질 92에서 786,486바이트가 73,755바이트(9.4%, SSIM 0.9874)가 됐습니다. JPG는 손실 압축이라 카메라 사진에는 맞지만 스크린샷·도표·도트 그림에는 맞지 않습니다. 203 × 186 타일 시트는 거의 모든 픽셀이 바뀐 28,506바이트 JPG가 됐고, [[image/bmp-to-png|BMP → PNG]]는 픽셀이 정확한 16,685바이트 파일을 만들었습니다.',
   concept:{title:'비압축에서 손실로: 사진에만 좋은 선택',body:[
    'BMP는 픽셀마다 3바이트를 쓰므로 어떤 압축이든 이득이 큽니다. JPG는 미세한 주파수 정보를 버려도 잘 티가 나지 않는 사진에서 가장 크게 줄이며, 화질 92에서 NASA 사진은 10분의 1도 안 되는 크기로 눈에 띄는 변화가 없었습니다.',
    '선명한 경계가 있는 그래픽에서는 JPG가 불리합니다. 모든 경계에서 물결무늬와 색 번짐이 생기고 그 오차에도 바이트가 듭니다. Kenney 타일 시트에서는 37,758픽셀 중 37,393개가 바뀌었고(최대 오차 104/255), JPG가 무손실 PNG보다 70% 컸습니다.'],
    terms:[['화질','JPG 인코더 설정 20~100, 기본 92.'],['링잉','고주파를 버려 선명한 경계 옆에 생기는 물결무늬.'],['SSIM','유사도 점수. 1.0이면 동일하며 여기 사진은 0.9874.']]},
   example:{title:'사진과 그래픽 비교(실측)',lead:'저장소 테스트 자료로 Pillow 12.3이 만든 BMP, 2026-09-28 Chromium 153의 Nerulio 변환기, 화질 92.',lines:[
    '사진   astronaut.bmp   512 x 512   786,486 바이트',
    '  -> JPG q92    73,755 바이트    9.4 %   SSIM 0.9874',
    '  -> PNG       575,694 바이트   73.2 %   동일',
    '',
    '타일   dungeon.bmp     203 x 186   113,886 바이트',
    '  -> JPG q92    28,506 바이트   25.0 %   37,758픽셀 중 37,393개 변경',
    '  -> PNG        16,685 바이트   14.7 %   동일'],
    after:'두 파일에서 얻은 기준: 사진은 JPG, 그린 그림은 PNG.'},
   mapping:{title:'JPG에 남는 것',head:['BMP에 있던 것','변환기가 하는 일','JPG에서는'],rows:[
    ['24비트 픽셀','선택한 화질로 손실 인코딩','근사한 픽셀, 크기 동일'],
    ['해상도에 묶인 파일 크기','JPG 압축으로 대체','사진은 약 10분의 1'],
    ['32비트 BMP의 알파(있다면)','JPG 배경색 위에 칠함','알파 없음'],
    ['DPI 헤더 값','복사하지 않음','없음']]},
   verify:{steps:[
    'BMP와 JPG의 경계와 세밀한 질감을 100%로 비교하세요.',
    '스크린샷이나 그림이라면 선 주변의 번짐을 보세요. 보이면 PNG로 바꾸는 편이 낫습니다.',
    '맞춰야 할 제한과 바이트 수를 비교하세요.']},
   trouble:{rows:[
    ['글자나 선 주변이 번짐','JPG는 손실 압축이라 선명한 경계에 약합니다','경계를 확대','그래픽은 [[image/bmp-to-png|BMP → PNG]]를 쓰세요'],
    ['JPG가 여전히 너무 큼','화질 92가 제한보다 높습니다','바이트 수 확인','[[image/compress-to-100kb|100KB 이하로 압축]]처럼 필요한 크기로 압축하세요'],
    ['BMP가 열리지 않음','브라우저가 디코딩하지 못하는 BMP 변형입니다','브라우저에서 BMP를 직접 열기','원래 프로그램에서 표준 24비트 BMP나 PNG로 다시 저장하세요'],
    ['인쇄 크기가 바뀜','DPI 값이 복사되지 않습니다','편집 프로그램에서 DPI 확인','거기서 인쇄 크기를 지정하세요. 픽셀 수는 그대로입니다']]},
   alternatives:{rows:[
    ['[[image/bmp-to-png|BMP → PNG]]','스크린샷·그림·도트 그림. 픽셀이 정확하고 JPG보다 작은 경우도 많습니다.'],
    ['목표 용량으로 [[image/compress|압축]]','바이트 제한이 있을 때. 화질(과 JPG·WebP 중 형식)을 대신 골라 줍니다.']]},
   limits:['JPG는 손실 압축이라 정확한 픽셀이 유지되지 않습니다.','DPI 정보는 복사되지 않고 투명한 부분이 있다면 채워집니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 Nerulio 변환 경로로, `tests/fixtures/astronaut.png`와 `tests/fixtures/kenney/tiny-dungeon-tilemap.png`로 Pillow 12.3이 만든 BMP를 측정했습니다. 형식 특성은 MDN을 따랐습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'BMPをJPGにすると、非圧縮のBMP写真がおよそ10分の1になります。512 × 512の写真は画質92で786,486バイトから73,755バイト（9.4%、SSIM 0.9874）になりました。JPGは非可逆なので、カメラの写真には向きますが、スクリーンショット・図・ドット絵には向きません。203 × 186のタイルシートはほぼ全ピクセルが変わった28,506バイトのJPGになり、[[image/bmp-to-png|BMP → PNG]]ならピクセルが正確な16,685バイトのファイルでした。',
   concept:{title:'非圧縮から非可逆へ：写真にだけ向く選択',body:[
    'BMPは1ピクセルに3バイトを使うので、どんな圧縮でも得るものが大きい形式です。JPGは細かな周波数成分を捨てても目立ちにくい写真で最も効き、画質92でNASAの写真は10分の1未満の容量で見た目の変化がありませんでした。',
    'くっきりした輪郭のあるグラフィックではJPGが不利になります。輪郭ごとにリンギングと色のにじみが生じ、その誤差にもバイトを使います。Kenneyのタイルシートでは37,758ピクセル中37,393個が変わり（最大誤差104/255）、JPGは可逆のPNGより70%大きくなりました。'],
    terms:[['画質','JPGエンコーダーの設定20〜100、初期値92。'],['リンギング','高周波を捨てることでくっきりした輪郭の横に出る波紋。'],['SSIM','類似度。1.0で同一。ここでの写真は0.9874。']]},
   example:{title:'写真とグラフィックの比較（実測）',lead:'リポジトリのテスト素材からPillow 12.3で作ったBMP、2026-09-28にChromium 153上のNerulioの変換、画質92。',lines:[
    '写真    astronaut.bmp   512 x 512   786,486 バイト',
    '  -> JPG q92    73,755 バイト    9.4 %   SSIM 0.9874',
    '  -> PNG       575,694 バイト   73.2 %   同一',
    '',
    'タイル  dungeon.bmp     203 x 186   113,886 バイト',
    '  -> JPG q92    28,506 バイト   25.0 %   37,758ピクセル中37,393個が変化',
    '  -> PNG        16,685 バイト   14.7 %   同一'],
    after:'この2ファイルから言える目安：写真はJPG、描いた絵はPNG。'},
   mapping:{title:'JPGに残るもの',head:['BMPにあったもの','変換での処理','JPGでは'],rows:[
    ['24ビットのピクセル','選んだ画質で非可逆エンコード','近似したピクセル、サイズは同じ'],
    ['解像度で決まる容量','JPG圧縮に置き換え','写真ではおよそ10分の1'],
    ['32ビットBMPのアルファ（あれば）','JPGの背景色の上に描く','アルファなし'],
    ['DPIのヘッダー情報','コピーしない','なし']]},
   verify:{steps:[
    'BMPとJPGの輪郭と細かな質感を100%で比べます。',
    'スクリーンショットや絵なら、線の周りのにじみを見ます。にじみがあればPNGにしたほうがよい画像です。',
    '守るべき上限とバイト数を比べます。']},
   trouble:{rows:[
    ['文字や線の周りがにじむ','JPGは非可逆で、くっきりした輪郭に弱い','輪郭を拡大','グラフィックは[[image/bmp-to-png|BMP → PNG]]にします'],
    ['JPGがまだ大きすぎる','画質92が上限に対して高すぎる','バイト数を確認','[[image/compress-to-100kb|100KB以下に圧縮]]など必要なサイズに圧縮します'],
    ['BMPが開けない','ブラウザが展開できないBMPの種類','ブラウザでBMPを直接開く','元のソフトで標準の24ビットBMPかPNGとして保存し直します'],
    ['印刷サイズが変わった','DPI情報がコピーされない','レイアウトソフトでDPIを確認','そちらで印刷サイズを指定します。ピクセル数は変わっていません']]},
   alternatives:{rows:[
    ['[[image/bmp-to-png|BMP → PNG]]','スクリーンショット・絵・ドット絵。ピクセルが正確で、JPGより小さいことも多い形式です。'],
    ['目標容量を決めて[[image/compress|圧縮]]','バイト数の上限がある場合。画質（とJPG・WebPの形式）を代わりに選びます。']]},
   limits:['JPGは非可逆なので、ピクセルは正確には残りません。','DPI情報はコピーされず、透明部分があれば塗りつぶされます。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、Nerulioの変換経路を使い、`tests/fixtures/astronaut.png` と `tests/fixtures/kenney/tiny-dungeon-tilemap.png` からPillow 12.3で作ったBMPを計測しました。形式の特性はMDNに従っています。'],sources:[MDN.ja]}
  }
 },
 'image/compress':{
  type:'tool',
  intent:{primary:'compress an image (reduce file size) without visible quality loss',secondary:['which level to choose','why the original was kept','compress PNG with transparency'],
   goal:'the smallest file that still looks like the original, in a format the destination accepts',input:'PNG, JPG, WebP, AVIF, BMP, HEIC (still)',output:'PNG, JPG or WebP (`<name>-min.<ext>`), resolution kept by default',target:'web pages, e-mail, chat, upload forms',support:'full',
   evidence:['src/task/compress.js (LEVELS, FLOOR)','src/compression.js (candidates, SSIM score, quality mode)','measured 2026-09-28, Chromium 153: astronaut.png, astronaut-q75.jpg, bricks_Color.png'],
   external:['MDN image format guide']},
  en:{
   answer:'Compressing an image here means trying real encodes and keeping the smallest one that still looks close to the original, not applying one fixed quality. Pick Smallest, Balanced (default) or High quality: Nerulio encodes PNG, JPG and WebP candidates in your browser, decodes each one again, scores it with SSIM and returns the smallest candidate above that level\'s similarity floor. Resolution is kept unless you set a maximum width, and the original comes back untouched when nothing beats it. For a hard byte limit set Target size under Advanced, or open a size page such as [[image/compress-to-100kb|100 KB]].',
   concept:{title:'Candidates, a similarity floor and the smallest survivor',body:[
    'Each level is a starting quality plus a floor: Smallest 0.60 / 0.93, Balanced 0.80 / 0.965, High 0.92 / 0.985. Auto format tries every format the browser can encode (PNG, JPG and WebP in Chromium) and leaves JPG out when any pixel is transparent, so transparency is never lost silently.',
    'Every candidate is decoded again and compared with the source: an 8 × 8 SSIM on the brightness, computed on copies at most 512 px on the long side, once over black and once over white, keeping the worse score so colours hidden under transparency cannot cheat. The smallest lossy candidate above the floor wins; the untouched original and a PNG re-encode compete too. Grainy photos that never reach the floor get the smallest candidate within 0.01 of the best score.',
    'The result is never bigger than what you dropped in: if every candidate is larger, the original file is returned and marked "Already small — original kept".'],
    terms:[['SSIM floor','Minimum similarity a candidate must reach at the chosen level (0.93, 0.965 or 0.985).'],['Candidate','One real encode (format + quality) that is decoded and scored.'],['Auto format','All formats this browser can encode; JPG is skipped for images with transparency.']]},
   example:{title:'Three levels on two versions of one photo (measured)',lead:'Nerulio\'s compressor with the task\'s exact options, Chromium 153, 2026-09-28. The PNG is the repository\'s NASA fixture; the JPG is the same photo saved by Pillow at quality 75.',lines:[
    'astronaut.png   512 x 512   791,555 bytes',
    '  Smallest   WebP q0.60    22,048 bytes   SSIM 0.9626   (floor 0.93)',
    '  Balanced   WebP q0.80    32,200 bytes   SSIM 0.9749   (floor 0.965)',
    '  High       WebP q0.92    59,824 bytes   SSIM 0.9883   (floor 0.985)',
    '',
    'astronaut-q75.jpg   512 x 512   40,240 bytes',
    '  Balanced   WebP q0.80    31,538 bytes   SSIM 0.9834',
    '  High       original kept (the passing JPG q0.92 was 51,005 bytes)'],
    after:'At High the only candidates above 0.985 were bigger than the file itself, so the JPG came back unchanged. That is the expected outcome for pictures that were already compressed.'},
   mapping:{title:'What each setting does',head:['Setting','Encoder behaviour','Winner'],rows:[
    ['Smallest','Quality 0.60 for JPG/WebP','Smallest candidate with SSIM ≥ 0.93'],
    ['Balanced (default)','Quality 0.80','Smallest candidate with SSIM ≥ 0.965'],
    ['High quality','Quality 0.92','Smallest candidate with SSIM ≥ 0.985'],
    ['Target size set (Advanced)','Quality searched down until it fits','Highest SSIM at or under the target'],
    ['Max width set (Advanced)','Resized first (Pica, mks2013)','As above, at the new width']]},
   verify:{steps:[
    'Read the line under each file, e.g. "773 KB → 31 KB · 512×512 kept": sizes use 1,024-byte kilobytes.',
    'Open the result at 100 % and look at faces, text and smooth gradients, where loss shows first.',
    'Check the extension (`-min.webp`, `-min.jpg`, `-min.png`) against what the destination accepts.']},
   trouble:{rows:[
    ['The result is WebP but the site needs JPG','Auto keeps the smallest passing candidate, often WebP','The file name ends in `-min.webp`','Advanced → Output format → JPG'],
    ['"Already small — original kept"','No candidate above the floor was smaller than the input','Compare the level with how the file was made','Try Smallest, or set a Target size'],
    ['A grainy photo is still large at Smallest','It never reaches the floor, so the near-best candidate is used','The SSIM of all candidates stays below the floor','Set a Target size or a Max width'],
    ['Small text got soft on a big screenshot','Similarity is scored on a copy at most 512 px wide, which can hide fine damage','Zoom in on the text at 100 %','Use High quality or PNG output for screenshots'],
    ['A transparent PNG never becomes JPG','JPG is left out of Auto when any pixel is transparent','—','Pick JPG explicitly; transparency then takes the JPG background colour']]},
   alternatives:{rows:[
    ['[[image/compress-to-100kb|A size page]] (20 KB – 1 MB)','A form or site names a maximum file size.'],
    ['[[image/resize|Resize]] first','The image has far more pixels than it will be shown at — fewer pixels save more than any quality setting.'],
    ['[[image/convert|Convert]]','You need one specific format and quality, without any automatic choice.']]},
   limits:['Scores are computed on copies at most 512 px on the long side; tiny details on large images can be damaged without lowering the score.','Encoders are the browser\'s own, so another browser can give different sizes; EXIF is not written and animated files are refused.'],
   versions:{body:['All sizes and scores were measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes (quality and floor per level, `original` = the dropped file), on `tests/fixtures/astronaut.png`, a Pillow 12.3 JPG of it at quality 75 and `tests/fixtures/texture/bricks_Color.png`.'],sources:[MDN.en]}
  },
  ko:{
   answer:'여기서 이미지 압축은 하나의 고정 화질을 적용하는 것이 아니라, 실제로 여러 번 인코딩해 보고 원본과 가깝게 보이는 것 중 가장 작은 파일을 남기는 작업입니다. 가장 작게·균형(기본)·고화질 중 하나를 고르면 Nerulio가 브라우저에서 PNG·JPG·WebP 후보를 만들고, 각각 다시 디코딩해 SSIM으로 채점한 뒤 그 단계의 유사도 기준을 넘는 가장 작은 후보를 돌려줍니다. 최대 너비를 정하지 않으면 해상도는 유지되고, 원본보다 나은 후보가 없으면 원본을 그대로 돌려줍니다. 정확한 용량 제한이 있다면 고급 설정의 목표 용량이나 [[image/compress-to-100kb|100KB]] 같은 용량별 페이지를 쓰세요.',
   concept:{title:'후보, 유사도 기준, 그리고 살아남은 가장 작은 파일',body:[
    '단계마다 시작 화질과 기준값이 있습니다. 가장 작게 0.60 / 0.93, 균형 0.80 / 0.965, 고화질 0.92 / 0.985입니다. 자동 형식은 브라우저가 인코딩할 수 있는 모든 형식(Chromium에서는 PNG·JPG·WebP)을 시도하되, 투명한 픽셀이 하나라도 있으면 JPG를 빼서 투명도가 몰래 사라지지 않게 합니다.',
    '후보는 모두 다시 디코딩해 원본과 비교합니다. 긴 변이 최대 512px인 사본에서 밝기 기준 8 × 8 SSIM을 검은 배경과 흰 배경 위에서 각각 계산하고 더 나쁜 점수를 씁니다. 그래서 투명 영역 아래 숨은 색이 점수를 속일 수 없습니다. 기준을 넘는 손실 후보 중 가장 작은 것이 이기며, 손대지 않은 원본과 PNG 재인코딩도 함께 경쟁합니다. 기준에 끝내 닿지 못하는 거친 사진은 최고 점수와 0.01 이내인 후보 중 가장 작은 것을 받습니다.',
    '결과는 넣은 파일보다 커지지 않습니다. 모든 후보가 더 크면 원본 파일을 돌려주고 "이미 충분히 작아 원본을 유지했습니다"라고 표시합니다.'],
    terms:[['SSIM 기준','선택한 단계에서 후보가 넘어야 하는 최소 유사도(0.93, 0.965, 0.985).'],['후보','실제로 한 번 인코딩한 결과(형식 + 화질). 다시 디코딩해 채점합니다.'],['자동 형식','이 브라우저가 인코딩할 수 있는 모든 형식. 투명한 이미지에는 JPG를 쓰지 않습니다.']]},
   example:{title:'같은 사진 두 버전에 세 단계 적용(실측)',lead:'압축 작업과 같은 옵션의 Nerulio 압축기, Chromium 153, 2026-09-28. PNG는 저장소의 NASA 테스트 사진이고 JPG는 같은 사진을 Pillow 화질 75로 저장한 것입니다.',lines:[
    'astronaut.png   512 x 512   791,555 바이트',
    '  가장 작게   WebP q0.60    22,048 바이트   SSIM 0.9626   (기준 0.93)',
    '  균형        WebP q0.80    32,200 바이트   SSIM 0.9749   (기준 0.965)',
    '  고화질      WebP q0.92    59,824 바이트   SSIM 0.9883   (기준 0.985)',
    '',
    'astronaut-q75.jpg   512 x 512   40,240 바이트',
    '  균형        WebP q0.80    31,538 바이트   SSIM 0.9834',
    '  고화질      원본 유지 (기준을 넘은 JPG q0.92는 51,005 바이트)'],
    after:'고화질에서 0.985를 넘은 후보는 모두 원래 파일보다 커서 JPG가 그대로 돌아왔습니다. 이미 압축된 사진에서는 이것이 정상적인 결과입니다.'},
   mapping:{title:'설정별 동작',head:['설정','인코더 동작','선택되는 결과'],rows:[
    ['가장 작게','JPG·WebP 화질 0.60','SSIM ≥ 0.93인 가장 작은 후보'],
    ['균형(기본)','화질 0.80','SSIM ≥ 0.965인 가장 작은 후보'],
    ['고화질','화질 0.92','SSIM ≥ 0.985인 가장 작은 후보'],
    ['목표 용량 지정(고급)','맞을 때까지 화질을 낮춰 탐색','목표 이하 중 SSIM이 가장 높은 후보'],
    ['최대 너비 지정(고급)','먼저 크기 변경(Pica, mks2013)','새 너비에서 위와 같음']]},
   verify:{steps:[
    '파일 아래 줄을 읽으세요. 예: "773 KB → 31 KB · 해상도 512×512 유지". 용량은 1,024바이트 단위 KB입니다.',
    '결과를 100%로 열어 손실이 먼저 드러나는 얼굴·글자·매끈한 그라데이션을 확인하세요.',
    '확장자(`-min.webp`, `-min.jpg`, `-min.png`)가 받는 곳에서 허용하는 형식인지 확인하세요.']},
   trouble:{rows:[
    ['결과가 WebP인데 사이트는 JPG만 받음','자동은 기준을 넘는 가장 작은 후보를 남기며 WebP인 경우가 많습니다','파일 이름이 `-min.webp`로 끝남','고급 → 저장 형식 → JPG'],
    ['"이미 충분히 작아 원본을 유지했습니다"','기준을 넘는 후보 중 원본보다 작은 것이 없었습니다','파일이 어떻게 만들어졌는지와 단계를 비교','가장 작게를 고르거나 목표 용량을 지정하세요'],
    ['거친 사진이 가장 작게에서도 큼','기준에 닿지 못해 최고 점수에 가까운 후보가 쓰였습니다','모든 후보의 SSIM이 기준 아래','목표 용량이나 최대 너비를 지정하세요'],
    ['큰 스크린샷의 작은 글자가 흐려짐','최대 512px 사본으로 채점해 미세한 손상을 놓칠 수 있습니다','글자를 100%로 확대','스크린샷은 고화질이나 PNG 출력을 쓰세요'],
    ['투명 PNG가 JPG로 바뀌지 않음','투명한 픽셀이 있으면 자동에서 JPG를 뺍니다','—','JPG를 직접 고르세요. 투명 부분은 JPG 배경색이 됩니다']]},
   alternatives:{rows:[
    ['[[image/compress-to-100kb|용량별 페이지]](20KB~1MB)','양식이나 사이트가 최대 파일 크기를 정해 둔 경우.'],
    ['먼저 [[image/resize|크기 변경]]','보여질 크기보다 픽셀이 훨씬 많은 경우. 픽셀을 줄이는 것이 어떤 화질 설정보다 효과가 큽니다.'],
    ['[[image/convert|형식 변환]]','자동 선택 없이 특정 형식과 화질이 필요한 경우.']]},
   limits:['점수는 긴 변 최대 512px 사본에서 계산하므로 큰 이미지의 미세한 디테일은 점수가 떨어지지 않은 채 손상될 수 있습니다.','인코더는 브라우저의 것이라 다른 브라우저에서는 크기가 다를 수 있습니다. EXIF는 기록하지 않고 움직이는 파일은 거부합니다.'],
   versions:{body:['모든 크기와 점수는 2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 넘기는 옵션(단계별 화질과 기준, `original` = 넣은 파일) 그대로 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`, 이를 Pillow 12.3 화질 75로 저장한 JPG, `tests/fixtures/texture/bricks_Color.png`에서 측정했습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'ここでの画像圧縮は、決まった画質を1つ当てはめるのではなく、実際に何通りかエンコードしてみて、元に近く見えるものの中で最も小さいファイルを残す処理です。最小・バランス（初期値）・高画質から選ぶと、NerulioがブラウザでPNG・JPG・WebPの候補を作り、それぞれを展開し直してSSIMで採点し、その段階の類似度の基準を超える最も小さい候補を返します。最大幅を指定しなければ解像度はそのままで、元より良い候補がなければ元のファイルをそのまま返します。容量の上限が決まっているなら、詳細設定の目標サイズか[[image/compress-to-100kb|100KB]]などの容量別ページを使います。',
   concept:{title:'候補、類似度の基準、生き残った最小のファイル',body:[
    '各段階には開始画質と基準値があります。最小は0.60 / 0.93、バランスは0.80 / 0.965、高画質は0.92 / 0.985です。自動形式はブラウザがエンコードできるすべての形式（ChromiumではPNG・JPG・WebP）を試しますが、透明なピクセルが1つでもあればJPGを外し、透過が知らないうちに消えないようにしています。',
    '候補はすべて展開し直して元画像と比べます。長辺が最大512pxのコピーで明るさの8 × 8 SSIMを黒背景と白背景の上でそれぞれ計算し、悪いほうの点数を使うので、透明部分の下に隠れた色が点数をごまかせません。基準を超える非可逆候補のうち最小のものが選ばれ、手を加えていない元ファイルとPNGの再エンコードも一緒に競います。どうしても基準に届かない粒子の粗い写真は、最高点から0.01以内の候補のうち最小のものになります。',
    '結果が入れたファイルより大きくなることはありません。すべての候補のほうが大きければ元のファイルを返し、「すでに十分小さいため元のままです」と表示します。'],
    terms:[['SSIMの基準','選んだ段階で候補が超えるべき最低の類似度（0.93、0.965、0.985）。'],['候補','実際に1回エンコードした結果（形式 + 画質）。展開し直して採点します。'],['自動形式','このブラウザがエンコードできるすべての形式。透過のある画像ではJPGを使いません。']]},
   example:{title:'1枚の写真の2つの版に3段階を適用（実測）',lead:'圧縮タスクと同じ設定のNerulioの圧縮、Chromium 153、2026-09-28。PNGはリポジトリのNASAのテスト写真、JPGは同じ写真をPillowの画質75で保存したものです。',lines:[
    'astronaut.png   512 x 512   791,555 バイト',
    '  最小       WebP q0.60    22,048 バイト   SSIM 0.9626   （基準 0.93）',
    '  バランス   WebP q0.80    32,200 バイト   SSIM 0.9749   （基準 0.965）',
    '  高画質     WebP q0.92    59,824 バイト   SSIM 0.9883   （基準 0.985）',
    '',
    'astronaut-q75.jpg   512 x 512   40,240 バイト',
    '  バランス   WebP q0.80    31,538 バイト   SSIM 0.9834',
    '  高画質     元のまま（基準を超えたJPG q0.92は51,005 バイト）'],
    after:'高画質では0.985を超えた候補がどれも元のファイルより大きかったため、JPGがそのまま返りました。すでに圧縮済みの写真ではこれが想定どおりの結果です。'},
   mapping:{title:'設定ごとの動作',head:['設定','エンコーダーの動作','選ばれる結果'],rows:[
    ['最小','JPG・WebPの画質0.60','SSIM ≥ 0.93の最小の候補'],
    ['バランス（初期値）','画質0.80','SSIM ≥ 0.965の最小の候補'],
    ['高画質','画質0.92','SSIM ≥ 0.985の最小の候補'],
    ['目標サイズを指定（詳細）','収まるまで画質を下げて探索','目標以下でSSIMが最も高い候補'],
    ['最大幅を指定（詳細）','先にサイズ変更（Pica、mks2013）','新しい幅で上と同じ']]},
   verify:{steps:[
    '各ファイルの下の行を読みます。例：「773 KB → 31 KB · 解像度 512×512 を維持」。容量は1,024バイト単位のKBです。',
    '結果を100%で開き、劣化が先に出る顔・文字・なめらかなグラデーションを確認します。',
    '拡張子（`-min.webp`、`-min.jpg`、`-min.png`）が提出先の受け付ける形式か確認します。']},
   trouble:{rows:[
    ['結果がWebPなのにサイトはJPGしか受け付けない','自動は基準を超える最小の候補を残し、WebPになることが多い','ファイル名が `-min.webp` で終わる','詳細 → 保存形式 → JPG'],
    ['「すでに十分小さいため元のままです」','基準を超える候補の中に元より小さいものがなかった','ファイルの作られ方と段階を見比べる','最小を選ぶか、目標サイズを指定します'],
    ['粗い写真が最小でも大きい','基準に届かず、最高点に近い候補が使われた','すべての候補のSSIMが基準を下回る','目標サイズか最大幅を指定します'],
    ['大きなスクリーンショットの小さな文字がぼやけた','最大512pxのコピーで採点するため、細かな劣化を見逃すことがある','文字を100%で拡大','スクリーンショットは高画質かPNG出力にします'],
    ['透過PNGがJPGにならない','透明なピクセルがあると自動からJPGを外す','—','JPGを明示的に選びます。透明部分はJPGの背景色になります']]},
   alternatives:{rows:[
    ['[[image/compress-to-100kb|容量別ページ]]（20KB〜1MB）','フォームやサイトがファイルサイズの上限を決めている場合。'],
    ['先に[[image/resize|サイズ変更]]','表示される大きさよりピクセルがずっと多い場合。ピクセルを減らすほうがどんな画質設定より効きます。'],
    ['[[image/convert|形式の変換]]','自動の選択なしに、特定の形式と画質が必要な場合。']]},
   limits:['点数は長辺最大512pxのコピーで計算するため、大きな画像の細かな部分は点数を下げずに劣化することがあります。','エンコーダーはブラウザのものなので、別のブラウザでは容量が変わることがあります。EXIFは書き込まず、アニメーションファイルは拒否します。'],
   versions:{body:['すべての容量と点数は、2026-09-28にPlaywright Chromium 153で `src/task/compress.js` が渡す設定（段階ごとの画質と基準、`original` = 入れたファイル）のまま `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png`、それをPillow 12.3の画質75で保存したJPG、`tests/fixtures/texture/bricks_Color.png` で計測しました。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-20kb':{
  type:'tool',
  intent:{primary:'compress an image to 20 KB or less',secondary:['photo under 20 KB for an application form','why the target cannot be reached','20 KB = 20,000 or 20,480 bytes'],
   goal:'a file at or under the form\'s 20 KB limit that still shows the face or document clearly',input:'photo or scan (PNG, JPG, WebP, AVIF, BMP, HEIC)',output:'JPG or WebP (or PNG) of at most 20,480 bytes; pixels reduced only when allowed',target:'online application and ID-photo forms, small avatars',support:'full',
   evidence:['src/task/compress.js','src/compression.js (quality search, shrink levels)','src/core.js bytes()','measured 2026-09-28, Chromium 153: astronaut.png, astronaut.jpg, astronaut-q75.jpg, bricks_Color.png'],
   external:['MDN image format guide']},
  en:{
   answer:'"20 KB" here means at most 20 × 1,024 = 20,480 bytes. Nerulio encodes JPG and WebP candidates, searches each one\'s quality down until it fits, decodes every candidate and keeps the one closest to the original: on the 512 × 512 NASA photo that was a WebP at quality 0.52, 20,206 bytes, SSIM 0.959. Resolution is kept unless you allow shrinking, and a full-size phone photo cannot get under 20 KB without it. If the form counts 20 KB as 20,000 bytes, type 19 in Target size.',
   concept:{title:'20 KB is a pixel budget',body:[
    'With a target, each lossy format is first encoded at the level\'s quality (Balanced: 0.80). If that is too big, the quality is searched in 8 halving steps between 0.05 and 0.80 and the largest quality that fits is kept. PNG is never quality-searched. Of all candidates at or under 20,480 bytes, the one with the highest SSIM wins — not the smallest.',
    '20,480 bytes are 163,840 bits. Spread over the 512 × 512 fixture that is 0.63 bits per pixel, which scored SSIM 0.96 as WebP. A 4032 × 3024 phone photo would get 0.013 bits per pixel: no quality setting can reach that. The tool then returns its smallest attempt with "Target size not reached. Try allowing smaller dimensions."',
    'With "Reduce dimensions if the target cannot be met" ticked, up to five smaller widths are tried, each 55–85 % of the previous one. Smaller versions are scored after being scaled back up, so they only win when they genuinely look closer to the original: on the fixture the 435-px WebP scored 0.9581 and the full-size one 0.9593, so the full size stayed.'],
    terms:[['KB','1,024 bytes in Nerulio\'s target and display; some forms use 1,000.'],['Quality search','Halving steps between 0.05 and the level quality until the file fits.'],['Reduce dimensions','Opt-in: lets the tool try smaller widths when the target cannot be met.']]},
   example:{title:'The NASA photo squeezed into 20 KB (measured)',lead:'Balanced level, Auto format, Chromium 153, 2026-09-28. Bits per pixel are arithmetic from the target.',lines:[
    'Target 20 KB = 20 x 1,024 = 20,480 bytes',
    '',
    'astronaut.png   512 x 512   791,555 bytes',
    '  WebP  q0.516   20,206 bytes   SSIM 0.9593   <- chosen',
    '  JPG   q0.293   20,117 bytes   SSIM 0.9463',
    '  PNG           575,694 bytes   over the target',
    'Shrink on: best smaller try 435 x 435 WebP, SSIM 0.9581 (not chosen)',
    '',
    'Budget  163,840 bits / 262,144 px    = 0.63 bits per pixel',
    '        163,840 bits / 12,192,768 px = 0.013 bits per pixel (4032 x 3024)'],
    after:'At the density that scored about 0.96 here, 20 KB holds roughly 0.27 megapixels — about 595 × 446 for a 4:3 photo. Resize a phone photo to that first with [[image/resize|resize]], or allow shrinking. Note that 20,206 bytes is over 20,000.'},
   mapping:{title:'What to type for the limit your form means',head:['The form says','Target size to enter','Largest file you get'],rows:[
    ['20 KB, counted as 1,024 bytes','20 (preset)','20,480 bytes'],
    ['20 KB, counted as 1,000 bytes','19','19,456 bytes'],
    ['20 KB and the file must be JPG','20, Output format JPG','JPG q0.293, 20,117 bytes on the fixture (SSIM 0.9463)'],
    ['Under 20 KB, exact pixel size given (e.g. an ID photo)','20, after resizing to that size','Fewer pixels, higher quality']]},
   verify:{steps:[
    'Check the exact byte count in your file manager before uploading: the result list rounds 20,206 bytes to "20 KB".',
    'Open the file at 100 %: faces, eyes and small print are where 20 KB shows first.',
    'Check the extension: Auto may give `.webp`; many forms want `.jpg`.']},
   trouble:{rows:[
    ['"Target size not reached"','Too many pixels for 20,480 bytes even at quality 0.05','The warning under the file','Tick "Reduce dimensions if the target cannot be met", or resize to about 600 px wide first'],
    ['The form says the 20 KB file is too large','The form counts 1 KB as 1,000 bytes','File properties show e.g. 20,206 bytes','Enter 19 as Target size (at most 19,456 bytes)'],
    ['The result is .webp but the form wants .jpg','Auto chose WebP because it scored higher','The name ends in `-min.webp`','Advanced → Output format → JPG'],
    ['The face is blocky or the text unreadable','20 KB forces a very low quality at this pixel count','Zoom in at 100 %','Crop to what matters with [[image/crop|crop]] or shrink the dimensions, then compress again']]},
   alternatives:{rows:[
    ['[[image/compress-to-50kb|Compress to 50 KB]]','The form allows more; at 50 KB the same photo kept quality 0.80.'],
    ['[[image/resize|Resize]] to the displayed size first','The form shows a known pixel size (for example a small ID photo), so larger pixels are wasted bytes.']]},
   limits:['Scores come from copies at most 512 px long, so they can miss damage to fine print on large scans.','The same target can give slightly different byte counts in another browser, because the encoders are the browser\'s.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for `?kb=20` (quality 0.80, Auto, background `#ffffff`), with and without shrinking, on `tests/fixtures/astronaut.png` and Pillow JPGs of it.'],sources:[MDN.en]}
  },
  ko:{
   answer:'여기서 "20KB"는 최대 20 × 1,024 = 20,480바이트입니다. Nerulio는 JPG·WebP 후보를 만들어 각각 맞을 때까지 화질을 낮춰 찾고, 모든 후보를 다시 디코딩해 원본에 가장 가까운 것을 남깁니다. 512 × 512 NASA 사진에서는 화질 0.52의 WebP, 20,206바이트, SSIM 0.959였습니다. 축소를 허용하지 않으면 해상도는 유지되며, 원본 크기의 휴대폰 사진은 축소 없이 20KB 아래로 내려갈 수 없습니다. 양식이 20KB를 20,000바이트로 센다면 목표 용량에 19를 입력하세요.',
   concept:{title:'20KB는 픽셀 예산입니다',body:[
    '목표가 있으면 손실 형식마다 먼저 단계 화질(균형: 0.80)로 인코딩합니다. 너무 크면 0.05와 0.80 사이를 8번 반으로 나누며 찾아 맞는 것 중 가장 높은 화질을 남깁니다. PNG는 화질 탐색을 하지 않습니다. 20,480바이트 이하 후보 중 가장 작은 것이 아니라 SSIM이 가장 높은 것이 선택됩니다.',
    '20,480바이트는 163,840비트입니다. 512 × 512 테스트 사진에 나누면 픽셀당 0.63비트이고, WebP로 SSIM 0.96이 나왔습니다. 4032 × 3024 휴대폰 사진이라면 픽셀당 0.013비트라 어떤 화질로도 불가능합니다. 이때 도구는 가장 작은 시도를 "목표 용량에 맞추지 못했습니다. 크기 줄이기를 켜 보세요."와 함께 돌려줍니다.',
    '"목표 용량을 못 맞추면 크기도 줄이기"를 켜면 이전 너비의 55~85%씩 최대 다섯 번 더 작은 너비를 시도합니다. 작은 버전은 다시 확대해서 채점하므로 실제로 원본에 더 가까울 때만 이깁니다. 테스트 사진에서는 435px WebP가 0.9581, 원래 크기가 0.9593이라 원래 크기가 남았습니다.'],
    terms:[['KB','Nerulio의 목표와 표시에서는 1,024바이트. 1,000으로 세는 양식도 있습니다.'],['화질 탐색','파일이 맞을 때까지 0.05와 단계 화질 사이를 반씩 좁혀 가는 과정.'],['크기도 줄이기','선택 사항. 목표를 못 맞추면 더 작은 너비를 시도하게 합니다.']]},
   example:{title:'NASA 사진을 20KB에 넣기(실측)',lead:'균형 단계, 자동 형식, Chromium 153, 2026-09-28. 픽셀당 비트는 목표에서 계산한 값입니다.',lines:[
    '목표 20KB = 20 x 1,024 = 20,480 바이트',
    '',
    'astronaut.png   512 x 512   791,555 바이트',
    '  WebP  q0.516   20,206 바이트   SSIM 0.9593   <- 선택',
    '  JPG   q0.293   20,117 바이트   SSIM 0.9463',
    '  PNG           575,694 바이트   목표 초과',
    '축소 허용: 가장 나은 작은 버전 435 x 435 WebP, SSIM 0.9581 (선택 안 됨)',
    '',
    '예산  163,840 비트 / 262,144 픽셀    = 픽셀당 0.63 비트',
    '      163,840 비트 / 12,192,768 픽셀 = 픽셀당 0.013 비트 (4032 x 3024)'],
    after:'여기서 0.96 정도가 나온 밀도라면 20KB에는 약 0.27메가픽셀, 4:3 사진으로 약 595 × 446이 들어갑니다. 휴대폰 사진은 먼저 [[image/resize|크기 변경]]으로 그 크기에 맞추거나 축소를 허용하세요. 20,206바이트는 20,000보다 크다는 점도 기억하세요.'},
   mapping:{title:'양식이 뜻하는 제한별 입력값',head:['양식 문구','입력할 목표 용량','최대 파일 크기'],rows:[
    ['20KB, 1KB = 1,024바이트','20 (기본값)','20,480 바이트'],
    ['20KB, 1KB = 1,000바이트','19','19,456 바이트'],
    ['20KB이고 JPG여야 함','20, 저장 형식 JPG','테스트 사진에서 JPG q0.293, 20,117 바이트 (SSIM 0.9463)'],
    ['20KB 이하, 픽셀 크기도 지정됨(예: 증명사진)','그 크기로 줄인 뒤 20','픽셀은 적게, 화질은 높게']]},
   verify:{steps:[
    '올리기 전에 파일 탐색기에서 정확한 바이트 수를 확인하세요. 결과 목록은 20,206바이트를 "20 KB"로 반올림해 보여 줍니다.',
    '파일을 100%로 열어 보세요. 얼굴·눈·작은 글씨에서 20KB의 한계가 먼저 드러납니다.',
    '확장자를 확인하세요. 자동은 `.webp`를 줄 수 있고 많은 양식은 `.jpg`를 원합니다.']},
   trouble:{rows:[
    ['"목표 용량에 맞추지 못했습니다"','화질 0.05로도 20,480바이트에 비해 픽셀이 너무 많습니다','파일 아래 경고 문구','"목표 용량을 못 맞추면 크기도 줄이기"를 켜거나 먼저 너비 600px 정도로 줄이세요'],
    ['양식이 20KB 파일을 너무 크다고 함','양식이 1KB를 1,000바이트로 셉니다','파일 속성에 예: 20,206바이트','목표 용량에 19를 입력하세요(최대 19,456바이트)'],
    ['결과가 .webp인데 양식은 .jpg를 원함','점수가 더 높아서 자동이 WebP를 골랐습니다','이름이 `-min.webp`로 끝남','고급 → 저장 형식 → JPG'],
    ['얼굴이 깨지거나 글자를 읽을 수 없음','이 픽셀 수에서 20KB는 매우 낮은 화질을 강요합니다','100%로 확대','[[image/crop|자르기]]로 필요한 부분만 남기거나 크기를 줄인 뒤 다시 압축하세요']]},
   alternatives:{rows:[
    ['[[image/compress-to-50kb|50KB 이하로 압축]]','양식이 더 허용할 때. 50KB에서는 같은 사진이 화질 0.80을 유지했습니다.'],
    ['표시 크기로 먼저 [[image/resize|크기 변경]]','양식이 정해진 픽셀 크기(예: 작은 증명사진)로 보여 준다면 그보다 큰 픽셀은 낭비입니다.']]},
   limits:['점수는 긴 변 최대 512px 사본에서 계산하므로 큰 스캔본의 작은 글씨 손상을 놓칠 수 있습니다.','인코더가 브라우저의 것이라 같은 목표라도 다른 브라우저에서는 바이트 수가 조금 다를 수 있습니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 `?kb=20`에 넘기는 옵션(화질 0.80, 자동, 배경 `#ffffff`)으로 축소 허용 여부를 바꿔 가며 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`와 그 Pillow JPG들로 측정했습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'ここでの「20KB」は最大20 × 1,024 = 20,480バイトです。NerulioはJPG・WebPの候補を作り、それぞれ収まるまで画質を下げて探し、すべての候補を展開し直して元に最も近いものを残します。512 × 512のNASAの写真では、画質0.52のWebP、20,206バイト、SSIM 0.959でした。縮小を許可しなければ解像度はそのままで、元サイズのスマホ写真は縮小なしでは20KBを下回れません。フォームが20KBを20,000バイトと数えるなら、目標サイズに19と入力します。',
   concept:{title:'20KBはピクセルの予算',body:[
    '目標があると、非可逆形式ごとにまず段階の画質（バランスは0.80）でエンコードします。大きすぎれば0.05から0.80の間を8回半分に区切って探し、収まるうちで最も高い画質を残します。PNGは画質の探索をしません。20,480バイト以下の候補のうち、最小のものではなくSSIMが最も高いものが選ばれます。',
    '20,480バイトは163,840ビットです。512 × 512のテスト写真に割り振ると1ピクセルあたり0.63ビットで、WebPでSSIM 0.96になりました。4032 × 3024のスマホ写真なら1ピクセルあたり0.013ビットで、どの画質でも届きません。そのときツールは最も小さい試行結果を「目標サイズに届きませんでした。サイズの縮小を許可してみてください。」と一緒に返します。',
    '「目標に届かない場合はサイズも縮小」をオンにすると、前の幅の55〜85%ずつ、最大5回小さな幅を試します。小さい版は拡大し直してから採点するので、本当に元に近いときだけ勝ちます。テスト写真では435pxのWebPが0.9581、元のサイズが0.9593で、元のサイズが残りました。'],
    terms:[['KB','Nerulioの目標と表示では1,024バイト。1,000で数えるフォームもあります。'],['画質の探索','ファイルが収まるまで0.05と段階の画質の間を半分ずつ絞り込む処理。'],['サイズも縮小','任意。目標に届かないとき、より小さな幅を試させます。']]},
   example:{title:'NASAの写真を20KBに収める（実測）',lead:'バランス、自動形式、Chromium 153、2026-09-28。1ピクセルあたりのビット数は目標から計算した値です。',lines:[
    '目標 20KB = 20 x 1,024 = 20,480 バイト',
    '',
    'astronaut.png   512 x 512   791,555 バイト',
    '  WebP  q0.516   20,206 バイト   SSIM 0.9593   <- 採用',
    '  JPG   q0.293   20,117 バイト   SSIM 0.9463',
    '  PNG           575,694 バイト   目標超過',
    '縮小を許可: 最良の小さい版 435 x 435 WebP、SSIM 0.9581（不採用）',
    '',
    '予算  163,840 ビット / 262,144 ピクセル    = 1ピクセル 0.63 ビット',
    '      163,840 ビット / 12,192,768 ピクセル = 1ピクセル 0.013 ビット（4032 x 3024）'],
    after:'ここで0.96程度になった密度なら、20KBに入るのは約0.27メガピクセル、4:3の写真で約595 × 446です。スマホ写真は先に[[image/resize|サイズ変更]]でその大きさにするか、縮小を許可します。20,206バイトは20,000を超えている点にも注意してください。'},
   mapping:{title:'フォームの上限ごとの入力値',head:['フォームの表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['20KB（1KB = 1,024バイト）','20（プリセット）','20,480 バイト'],
    ['20KB（1KB = 1,000バイト）','19','19,456 バイト'],
    ['20KBでJPG必須','20、保存形式JPG','テスト写真でJPG q0.293、20,117 バイト（SSIM 0.9463）'],
    ['20KB以下でピクセルサイズも指定（例：証明写真）','そのサイズに縮小してから20','ピクセルを減らして画質を上げる']]},
   verify:{steps:[
    'アップロード前にファイル管理ソフトで正確なバイト数を確認します。結果一覧では20,206バイトが「20 KB」と丸めて表示されます。',
    'ファイルを100%で開きます。顔・目・小さな文字に20KBの限界が最初に出ます。',
    '拡張子を確認します。自動では `.webp` になることがあり、多くのフォームは `.jpg` を求めます。']},
   trouble:{rows:[
    ['「目標サイズに届きませんでした」','画質0.05でも20,480バイトに対してピクセルが多すぎる','ファイルの下の警告','「目標に届かない場合はサイズも縮小」をオンにするか、先に幅600px程度に縮小します'],
    ['フォームが20KBのファイルを大きすぎると言う','フォームが1KBを1,000バイトで数えている','ファイルのプロパティで例：20,206バイト','目標サイズに19を入力します（最大19,456バイト）'],
    ['結果が.webpなのにフォームは.jpgを求める','点数が高かったため自動がWebPを選んだ','名前が `-min.webp` で終わる','詳細 → 保存形式 → JPG'],
    ['顔がブロック状・文字が読めない','このピクセル数で20KBだと画質を大きく下げるしかない','100%で拡大','[[image/crop|切り抜き]]で必要な部分だけ残すかサイズを縮小してから、もう一度圧縮します']]},
   alternatives:{rows:[
    ['[[image/compress-to-50kb|50KB以下に圧縮]]','フォームがもっと許す場合。50KBでは同じ写真が画質0.80を保ちました。'],
    ['表示サイズに先に[[image/resize|サイズ変更]]','フォームが決まったピクセルサイズ（例：小さな証明写真）で表示するなら、それを超えるピクセルは無駄なバイトです。']]},
   limits:['点数は長辺最大512pxのコピーで計算するため、大きなスキャン画像の小さな文字の劣化を見逃すことがあります。','エンコーダーはブラウザのものなので、同じ目標でも別のブラウザではバイト数が少し変わることがあります。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` が `?kb=20` に渡す設定（画質0.80、自動、背景 `#ffffff`）のまま、縮小の有無を切り替えて `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png` とそのPillow製JPGで計測しました。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-50kb':{
  type:'tool',
  intent:{primary:'compress an image to 50 KB or less',secondary:['photo under 50 KB for a form or forum','50 KB JPG','how many pixels fit in 50 KB'],
   goal:'a file at or under 50 KB with as little visible loss as possible',input:'photo, scan or graphic (PNG, JPG, WebP, AVIF, BMP, HEIC)',output:'JPG, WebP or PNG of at most 51,200 bytes',target:'forms, forums, e-mail signatures, small web images',support:'full',
   evidence:['src/task/compress.js','src/compression.js','measured 2026-09-28, Chromium 153: astronaut.png, astronaut.jpg, astronaut-q75.jpg'],
   external:['MDN image format guide']},
  en:{
   answer:'"50 KB" is a ceiling of 50 × 1,024 = 51,200 bytes. For a small photo that is room enough to keep the Balanced quality 0.80 without any search: the 512 × 512 NASA photo came out as a 45,813-byte JPG with SSIM 0.9785. The tool picks the candidate that looks closest, not the smallest — here the JPG beat a 32,200-byte WebP that scored 0.9749. JPG, PNG or WebP files already under 50 KB are returned unchanged, and a form that counts 50 KB as 50,000 bytes needs 48 in Target size.',
   concept:{title:'When the budget is not the limit',body:[
    'Each format is first encoded at the level\'s quality. Only if that exceeds 51,200 bytes does the quality search start. For the 512 × 512 fixture both JPG and WebP at 0.80 fitted at once, so the choice came down to the score: JPG 0.9785 against WebP 0.9749. The target is a ceiling, not a goal — the tool does not raise the quality to fill the remaining 5 KB.',
    'How many pixels fit depends on how much loss you accept. On the fixture, WebP at 0.62 bits per pixel scored 0.96 and JPG at 1.40 bits per pixel scored 0.98. Applied to 51,200 bytes (409,600 bits) that is roughly 0.29 megapixels at the higher score (about 624 × 468) and 0.66 megapixels at the lower one (about 941 × 705).',
    'When the dropped file itself fits and is a format Auto can write, it competes with a perfect score — that is why the 40,240-byte JPG below was returned untouched.'],
    terms:[['Ceiling','The largest allowed size; results can be well below it.'],['Bits per pixel','File size × 8 ÷ pixel count; a rough measure of how hard a picture is compressed.'],['Original kept','The dropped file fits and scores 1.0, so no re-encode can beat it.']]},
   example:{title:'Three inputs, one 50 KB target (measured)',lead:'Balanced level, Auto format, Chromium 153, 2026-09-28; all three are the 512 × 512 NASA photo in different files.',lines:[
    'Target 50 KB = 51,200 bytes',
    '',
    'astronaut.png      791,555 bytes  ->  JPG q0.80   45,813 bytes  SSIM 0.9785',
    '                   (WebP q0.80 32,200 bytes, SSIM 0.9749, lost on score)',
    'astronaut.jpg       75,758 bytes  ->  JPG q0.80   44,435 bytes  SSIM 0.9822',
    'astronaut-q75.jpg   40,240 bytes  ->  original kept, already under 51,200',
    '',
    'Room at 0.62 / 1.40 bits per pixel: 0.66 / 0.29 megapixels'],
    after:'Shrinking was also allowed in a second run: none of the five smaller widths scored higher, so the results above did not change.'},
   mapping:{title:'Entering the right limit',head:['The form says','Target size to enter','Largest file you get'],rows:[
    ['50 KB, counted as 1,024 bytes','50 (preset)','51,200 bytes'],
    ['50 KB, counted as 1,000 bytes','48','49,152 bytes'],
    ['50 KB and JPG only','50, Output format JPG','On the fixture the same JPG as Auto chose'],
    ['50 KB, fill it with quality','50, level High quality','Starts at 0.92 before searching down']]},
   verify:{steps:[
    'Read the size in the result list (1,024-byte KB) and the exact byte count in your file manager.',
    'Look for "kept" in the result line: the original was already small enough, which is not an error.',
    'Check faces and fine print at 100 %.']},
   trouble:{rows:[
    ['The file is far below 50 KB','The target is a ceiling; Balanced starts at 0.80 and never goes higher','Result line shows e.g. 45 KB','Choose High quality to start at 0.92'],
    ['The form rejects a "50 KB" file','The form counts 50,000 bytes','Exact bytes in file properties','Enter 48 as Target size'],
    ['"Target size not reached" on a phone photo','Several megapixels do not fit in 51,200 bytes','Warning under the file','Allow smaller dimensions or [[image/resize|resize]] to about 900 px wide first'],
    ['Nothing changed','The file was already under 50 KB and returned as it was','"original kept" in the result line','Use it as it is, or choose a smaller target']]},
   alternatives:{rows:[
    ['[[image/compress-to-20kb|Compress to 20 KB]]','The limit is tighter; expect WebP around quality 0.5 on a 512-px photo.'],
    ['[[image/compress-to-100kb|Compress to 100 KB]]','The form allows 100 KB; larger photos keep more detail.'],
    ['[[image/png-to-jpg|PNG to JPG]]','A photo saved as PNG usually fits once it is a JPG at quality 92.']]},
   limits:['Quality is never raised above the chosen level to use the whole budget.','Similarity is judged on a copy at most 512 px long; check fine print yourself.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for `?kb=50`, with and without shrinking, on `tests/fixtures/astronaut.png` and two Pillow JPGs of it (quality 92 and 75). The pixel estimates are arithmetic from those measured densities, not measurements of other photos.'],sources:[MDN.en]}
  },
  ko:{
   answer:'"50KB"는 50 × 1,024 = 51,200바이트가 상한입니다. 작은 사진이라면 탐색 없이 균형 화질 0.80을 그대로 쓸 여유가 있습니다. 512 × 512 NASA 사진은 45,813바이트 JPG, SSIM 0.9785로 나왔습니다. 도구는 가장 작은 후보가 아니라 원본에 가장 가까워 보이는 후보를 고릅니다. 여기서는 JPG가 0.9749를 받은 32,200바이트 WebP를 이겼습니다. 이미 50KB 이하인 JPG·PNG·WebP 파일은 그대로 돌려주며, 50KB를 50,000바이트로 세는 양식이라면 목표 용량에 48을 넣으세요.',
   concept:{title:'예산이 제한이 되지 않을 때',body:[
    '형식마다 먼저 단계 화질로 인코딩합니다. 그 결과가 51,200바이트를 넘을 때만 화질 탐색이 시작됩니다. 512 × 512 테스트 사진은 JPG와 WebP 모두 0.80에서 바로 들어가서 점수로 결정됐습니다. JPG 0.9785 대 WebP 0.9749입니다. 목표는 상한이지 목표치가 아니라서 남은 5KB를 채우려고 화질을 올리지는 않습니다.',
    '몇 픽셀이 들어가는지는 손실을 얼마나 받아들이느냐에 달려 있습니다. 테스트 사진에서 WebP는 픽셀당 0.62비트로 0.96, JPG는 1.40비트로 0.98을 받았습니다. 51,200바이트(409,600비트)에 적용하면 높은 점수 기준 약 0.29메가픽셀(약 624 × 468), 낮은 점수 기준 약 0.66메가픽셀(약 941 × 705)입니다.',
    '넣은 파일 자체가 들어가고 자동이 쓸 수 있는 형식이면 만점으로 경쟁합니다. 아래 40,240바이트 JPG가 손대지 않고 돌아온 이유입니다.'],
    terms:[['상한','허용되는 최대 크기. 결과는 그보다 훨씬 작을 수 있습니다.'],['픽셀당 비트','파일 크기 × 8 ÷ 픽셀 수. 그림이 얼마나 강하게 압축됐는지의 대략적인 척도.'],['원본 유지','넣은 파일이 들어가고 점수가 1.0이라 어떤 재인코딩도 이길 수 없는 경우.']]},
   example:{title:'입력 세 개, 목표 50KB(실측)',lead:'균형 단계, 자동 형식, Chromium 153, 2026-09-28. 세 파일 모두 같은 512 × 512 NASA 사진입니다.',lines:[
    '목표 50KB = 51,200 바이트',
    '',
    'astronaut.png      791,555 바이트  ->  JPG q0.80   45,813 바이트  SSIM 0.9785',
    '                   (WebP q0.80 32,200 바이트, SSIM 0.9749, 점수에서 짐)',
    'astronaut.jpg       75,758 바이트  ->  JPG q0.80   44,435 바이트  SSIM 0.9822',
    'astronaut-q75.jpg   40,240 바이트  ->  원본 유지, 이미 51,200 이하',
    '',
    '픽셀당 0.62 / 1.40 비트일 때 여유: 0.66 / 0.29 메가픽셀'],
    after:'두 번째 실행에서는 축소도 허용했지만 다섯 가지 작은 너비 중 더 높은 점수는 없어 결과가 바뀌지 않았습니다.'},
   mapping:{title:'제한값 제대로 입력하기',head:['양식 문구','입력할 목표 용량','최대 파일 크기'],rows:[
    ['50KB, 1KB = 1,024바이트','50 (기본값)','51,200 바이트'],
    ['50KB, 1KB = 1,000바이트','48','49,152 바이트'],
    ['50KB이고 JPG만','50, 저장 형식 JPG','테스트 사진에서는 자동과 같은 JPG'],
    ['50KB를 화질로 채우고 싶음','50, 고화질 단계','0.92에서 시작해 필요하면 낮춤']]},
   verify:{steps:[
    '결과 목록의 용량(1,024바이트 KB)과 파일 탐색기의 정확한 바이트 수를 확인하세요.',
    '결과 줄에 원본 유지 표시가 있는지 보세요. 원본이 이미 충분히 작았다는 뜻이며 오류가 아닙니다.',
    '얼굴과 작은 글씨를 100%로 확인하세요.']},
   trouble:{rows:[
    ['파일이 50KB보다 훨씬 작음','목표는 상한입니다. 균형은 0.80에서 시작하고 더 올리지 않습니다','결과 줄에 예: 45 KB','0.92에서 시작하도록 고화질을 고르세요'],
    ['양식이 "50KB" 파일을 거부','양식이 50,000바이트로 셉니다','파일 속성의 정확한 바이트 수','목표 용량에 48을 입력하세요'],
    ['휴대폰 사진에서 "목표 용량에 맞추지 못했습니다"','수 메가픽셀은 51,200바이트에 들어가지 않습니다','파일 아래 경고','크기 줄이기를 허용하거나 먼저 너비 900px 정도로 [[image/resize|크기 변경]]하세요'],
    ['아무것도 바뀌지 않음','파일이 이미 50KB 이하라 그대로 돌아왔습니다','결과 줄의 원본 유지 표시','그대로 쓰거나 더 작은 목표를 고르세요']]},
   alternatives:{rows:[
    ['[[image/compress-to-20kb|20KB 이하로 압축]]','제한이 더 엄격할 때. 512px 사진이면 화질 0.5 안팎의 WebP를 예상하세요.'],
    ['[[image/compress-to-100kb|100KB 이하로 압축]]','양식이 100KB까지 허용할 때. 큰 사진이 디테일을 더 지킵니다.'],
    ['[[image/png-to-jpg|PNG → JPG]]','PNG로 저장된 사진은 화질 92 JPG로만 바꿔도 대개 들어갑니다.']]},
   limits:['예산을 다 쓰려고 선택한 단계보다 화질을 올리지는 않습니다.','유사도는 긴 변 최대 512px 사본으로 판단하므로 작은 글씨는 직접 확인하세요.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 `?kb=50`에 넘기는 옵션으로 축소 허용 여부를 바꿔 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`와 그 Pillow JPG 두 개(화질 92, 75)를 측정했습니다. 픽셀 수 추정은 측정한 밀도에서 계산한 값이며 다른 사진을 측정한 것이 아닙니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'「50KB」は50 × 1,024 = 51,200バイトが上限です。小さな写真なら、探索なしでバランスの画質0.80をそのまま使える余裕があります。512 × 512のNASAの写真は45,813バイトのJPG、SSIM 0.9785になりました。ツールが選ぶのは最小の候補ではなく最も元に近く見える候補で、ここではJPGが0.9749だった32,200バイトのWebPに勝ちました。すでに50KB以下のJPG・PNG・WebPファイルはそのまま返し、50KBを50,000バイトと数えるフォームなら目標サイズに48と入力します。',
   concept:{title:'予算が制約にならないとき',body:[
    '形式ごとにまず段階の画質でエンコードし、それが51,200バイトを超えたときだけ画質の探索が始まります。512 × 512のテスト写真ではJPGもWebPも0.80ですぐに収まり、点数で決まりました。JPG 0.9785対WebP 0.9749です。目標は上限であってねらう値ではないので、残りの5KBを埋めるために画質を上げることはしません。',
    '何ピクセル入るかは、どこまで劣化を許すかで変わります。テスト写真ではWebPが1ピクセル0.62ビットで0.96、JPGが1.40ビットで0.98でした。51,200バイト（409,600ビット）に当てはめると、高いほうの点数で約0.29メガピクセル（約624 × 468）、低いほうで約0.66メガピクセル（約941 × 705）です。',
    '入れたファイル自体が収まり、自動で書ける形式なら、満点で競います。下の40,240バイトのJPGが手を加えずに返ってきたのはこのためです。'],
    terms:[['上限','許される最大のサイズ。結果はそれよりかなり小さいこともあります。'],['1ピクセルあたりのビット','ファイルサイズ × 8 ÷ ピクセル数。どれだけ強く圧縮されているかのおおよその目安。'],['元のまま','入れたファイルが収まり点数1.0なので、どの再エンコードも勝てない場合。']]},
   example:{title:'3つの入力、目標50KB（実測）',lead:'バランス、自動形式、Chromium 153、2026-09-28。3つとも同じ512 × 512のNASAの写真です。',lines:[
    '目標 50KB = 51,200 バイト',
    '',
    'astronaut.png      791,555 バイト  ->  JPG q0.80   45,813 バイト  SSIM 0.9785',
    '                   （WebP q0.80 32,200 バイト、SSIM 0.9749、点数で敗退）',
    'astronaut.jpg       75,758 バイト  ->  JPG q0.80   44,435 バイト  SSIM 0.9822',
    'astronaut-q75.jpg   40,240 バイト  ->  元のまま、すでに51,200以下',
    '',
    '1ピクセル0.62 / 1.40ビットでの余裕: 0.66 / 0.29 メガピクセル'],
    after:'2回目の実行では縮小も許可しましたが、5つの小さな幅のどれも点数が上回らず、結果は変わりませんでした。'},
   mapping:{title:'上限を正しく入力する',head:['フォームの表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['50KB（1KB = 1,024バイト）','50（プリセット）','51,200 バイト'],
    ['50KB（1KB = 1,000バイト）','48','49,152 バイト'],
    ['50KBでJPGのみ','50、保存形式JPG','テスト写真では自動と同じJPG'],
    ['50KBを画質で埋めたい','50、段階は高画質','0.92から始めて必要なら下げる']]},
   verify:{steps:[
    '結果一覧の容量（1,024バイト単位のKB）と、ファイル管理ソフトの正確なバイト数を確認します。',
    '結果の行に元のままの表示があるか見ます。元がすでに十分小さかったという意味で、エラーではありません。',
    '顔と小さな文字を100%で確認します。']},
   trouble:{rows:[
    ['ファイルが50KBよりずっと小さい','目標は上限で、バランスは0.80から始めてそれ以上は上げない','結果の行に例：45 KB','0.92から始まるように高画質を選びます'],
    ['フォームが「50KB」のファイルを拒否','フォームが50,000バイトで数えている','ファイルのプロパティで正確なバイト数','目標サイズに48を入力します'],
    ['スマホ写真で「目標サイズに届きませんでした」','数メガピクセルは51,200バイトに収まらない','ファイルの下の警告','縮小を許可するか、先に幅900px程度に[[image/resize|サイズ変更]]します'],
    ['何も変わらない','ファイルがすでに50KB以下で、そのまま返された','結果の行の元のままの表示','そのまま使うか、より小さな目標を選びます']]},
   alternatives:{rows:[
    ['[[image/compress-to-20kb|20KB以下に圧縮]]','上限がもっと厳しい場合。512pxの写真なら画質0.5前後のWebPになります。'],
    ['[[image/compress-to-100kb|100KB以下に圧縮]]','フォームが100KBまで許す場合。大きな写真ほど細部が残ります。'],
    ['[[image/png-to-jpg|PNG → JPG]]','PNGで保存された写真は、画質92のJPGにするだけでたいてい収まります。']]},
   limits:['予算を使い切るために、選んだ段階より画質を上げることはしません。','類似度は長辺最大512pxのコピーで判断するので、小さな文字は自分で確認してください。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` が `?kb=50` に渡す設定のまま縮小の有無を切り替えて `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png` とそのPillow製JPG 2つ（画質92と75）を計測しました。ピクセル数の見積もりは計測した密度からの計算で、ほかの写真を計測したものではありません。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-100kb':{
  type:'tool',
  intent:{primary:'compress an image to 100 KB or less',secondary:['photo under 100 KB for a website or form','100 KB JPG from a phone photo','use more of the 100 KB'],
   goal:'a file at or under 100 KB, as close to the original as that allows',input:'photo, scan or graphic',output:'JPG, WebP or PNG of at most 102,400 bytes',target:'web forms, marketplaces, CMS uploads',support:'full',
   evidence:['src/task/compress.js','src/compression.js','measured 2026-09-28, Chromium 153: astronaut.png, astronaut.jpg, bricks_Color.png'],
   external:['MDN image format guide']},
  en:{
   answer:'"100 KB" allows up to 100 × 1,024 = 102,400 bytes. Small images usually fit at the Balanced quality straight away: the 512 × 512 NASA photo became a 45,813-byte JPG (SSIM 0.9785), a 256 × 256 brick texture a 14,214-byte WebP, and a 75,758-byte JPG was returned untouched because it already fitted. For larger photos 100 KB holds roughly 0.6–1.3 megapixels. If the form counts 100,000 bytes, type 97; to use more of the budget, pick High quality.',
   concept:{title:'A ceiling, and how many pixels sit under it',body:[
    'The target only limits; it does not attract. Every format is first encoded at the level\'s quality, and only candidates above 102,400 bytes are searched down. Among those that fit, the highest score wins. So a 512-px photo at Balanced lands near 45 KB, not near 100 KB.',
    'Choosing High quality moves the starting point to 0.92. The High candidates measured on the same photo were a 59,824-byte WebP (SSIM 0.9883) and a 73,755-byte JPG (0.9874); both fit under 102,400, so the WebP would win.',
    'For photos larger than the test file, the budget is what matters: 819,200 bits. At the two densities measured on the fixture (0.62 and 1.40 bits per pixel) that is 1.33 or 0.59 megapixels — roughly 1330 × 998 or 883 × 662 for a 4:3 photo. A 12-megapixel phone photo needs its dimensions reduced first.'],
    terms:[['102,400 bytes','100 × 1,024; the exact ceiling the preset uses.'],['Level quality','The starting quality (0.60 / 0.80 / 0.92); a target never raises it.'],['Megapixel budget','Target bits ÷ bits per pixel; a rough guide to the dimensions that fit.']]},
   example:{title:'100 KB on three real files (measured)',lead:'Balanced level, Auto format, Chromium 153, 2026-09-28.',lines:[
    'Target 100 KB = 102,400 bytes',
    '',
    'astronaut.png     512 x 512   791,555 bytes  ->  JPG q0.80   45,813 bytes  SSIM 0.9785',
    'bricks_Color.png  256 x 256   127,956 bytes  ->  WebP q0.80  14,214 bytes  SSIM 0.9701',
    'astronaut.jpg     512 x 512    75,758 bytes  ->  original kept (fits already)',
    '',
    'Budget 819,200 bits: 1.33 MP at 0.62 bits/px, 0.59 MP at 1.40 bits/px'],
    after:'The brick texture is ambientCG\'s CC0 Bricks076C, reduced to 256 × 256 in the repository; its WebP scored higher than the 15,653-byte JPG (0.9573).'},
   mapping:{title:'Entering the right limit',head:['The form says','Target size to enter','Largest file you get'],rows:[
    ['100 KB, counted as 1,024 bytes','100 (preset)','102,400 bytes'],
    ['100 KB, counted as 1,000 bytes','97','99,328 bytes'],
    ['100 KB, as good as possible','100 + High quality','Starts at quality 0.92'],
    ['100 KB and a maximum width','100 + Max width','Resized first, then compressed']]},
   verify:{steps:[
    'Compare the size in the result list with the form\'s limit, and the exact bytes in the file properties.',
    'If the result is far below 100 KB and you want more detail, run again at High quality.',
    'Open at 100 % and check the parts the viewer will look at first.']},
   trouble:{rows:[
    ['A phone photo shows "Target size not reached"','Twelve megapixels do not fit in 819,200 bits','Warning under the file','Allow smaller dimensions, or set Max width to about 1,300 px'],
    ['The result is much smaller than 100 KB','Balanced never goes above quality 0.80','Result line, e.g. 45 KB','Pick High quality'],
    ['Rejected by a form that says 100 KB','It counts 100,000 bytes','Exact byte count','Enter 97'],
    ['The texture or pattern looks smeared','WebP was chosen and smooths fine repeating detail','Zoom in on the pattern','Set Output format to PNG if the limit allows, or JPG and compare']]},
   alternatives:{rows:[
    ['[[image/compress-to-200kb|Compress to 200 KB]]','The destination allows it and the photo is larger than about a megapixel.'],
    ['[[image/resize|Resize]]','You know the display width (for example a 1200-px wide blog column).'],
    ['[[image/jpg-to-webp|JPG to WebP]]','You only want a lighter web copy and there is no fixed limit.']]},
   limits:['The target cannot be used as a minimum; results can be far below it.','The megapixel figures are estimates from one photo; detailed or noisy pictures need more bytes.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for `?kb=100`, on `tests/fixtures/astronaut.png`, its Pillow JPG (quality 92) and `tests/fixtures/texture/bricks_Color.png`. The High-quality figures are the level\'s measured candidates on the same photo.'],sources:[MDN.en]}
  },
  ko:{
   answer:'"100KB"는 최대 100 × 1,024 = 102,400바이트입니다. 작은 이미지는 대개 균형 화질에서 바로 들어갑니다. 512 × 512 NASA 사진은 45,813바이트 JPG(SSIM 0.9785), 256 × 256 벽돌 텍스처는 14,214바이트 WebP가 됐고, 75,758바이트 JPG는 이미 들어가서 그대로 돌아왔습니다. 큰 사진이라면 100KB에는 대략 0.6~1.3메가픽셀이 들어갑니다. 양식이 100,000바이트로 센다면 97을, 예산을 더 쓰고 싶다면 고화질을 고르세요.',
   concept:{title:'상한, 그리고 그 아래 들어가는 픽셀 수',body:[
    '목표는 제한할 뿐 끌어당기지 않습니다. 모든 형식을 먼저 단계 화질로 인코딩하고, 102,400바이트를 넘는 후보만 화질을 낮춰 찾습니다. 들어가는 후보 중에서는 점수가 가장 높은 것이 이깁니다. 그래서 균형 단계의 512px 사진은 100KB가 아니라 45KB 근처에 머뭅니다.',
    '고화질을 고르면 시작점이 0.92로 옮겨집니다. 같은 사진에서 측정한 고화질 후보는 59,824바이트 WebP(SSIM 0.9883)와 73,755바이트 JPG(0.9874)였고, 둘 다 102,400 이하라 WebP가 선택됩니다.',
    '테스트 파일보다 큰 사진에서는 예산이 중요합니다. 819,200비트입니다. 테스트 사진에서 측정한 두 밀도(픽셀당 0.62비트와 1.40비트)로 보면 1.33 또는 0.59메가픽셀, 4:3 사진으로 대략 1330 × 998 또는 883 × 662입니다. 1,200만 화소 휴대폰 사진은 먼저 크기를 줄여야 합니다.'],
    terms:[['102,400바이트','100 × 1,024. 프리셋이 쓰는 정확한 상한.'],['단계 화질','시작 화질(0.60 / 0.80 / 0.92). 목표가 이를 올리지는 않습니다.'],['메가픽셀 예산','목표 비트 ÷ 픽셀당 비트. 들어갈 크기의 대략적인 기준.']]},
   example:{title:'실제 파일 세 개에 100KB 적용(실측)',lead:'균형 단계, 자동 형식, Chromium 153, 2026-09-28.',lines:[
    '목표 100KB = 102,400 바이트',
    '',
    'astronaut.png     512 x 512   791,555 바이트  ->  JPG q0.80   45,813 바이트  SSIM 0.9785',
    'bricks_Color.png  256 x 256   127,956 바이트  ->  WebP q0.80  14,214 바이트  SSIM 0.9701',
    'astronaut.jpg     512 x 512    75,758 바이트  ->  원본 유지 (이미 들어감)',
    '',
    '예산 819,200 비트: 픽셀당 0.62비트면 1.33MP, 1.40비트면 0.59MP'],
    after:'벽돌 텍스처는 ambientCG의 CC0 Bricks076C를 저장소에서 256 × 256으로 줄인 것입니다. WebP가 15,653바이트 JPG(0.9573)보다 높은 점수를 받았습니다.'},
   mapping:{title:'제한값 제대로 입력하기',head:['양식 문구','입력할 목표 용량','최대 파일 크기'],rows:[
    ['100KB, 1KB = 1,024바이트','100 (기본값)','102,400 바이트'],
    ['100KB, 1KB = 1,000바이트','97','99,328 바이트'],
    ['100KB, 최대한 좋은 화질로','100 + 고화질','화질 0.92에서 시작'],
    ['100KB와 최대 너비','100 + 최대 너비','먼저 크기 변경 후 압축']]},
   verify:{steps:[
    '결과 목록의 용량을 양식 제한과, 파일 속성의 정확한 바이트 수와 비교하세요.',
    '결과가 100KB보다 훨씬 작고 디테일을 더 원한다면 고화질로 다시 실행하세요.',
    '100%로 열어 보는 사람이 가장 먼저 볼 부분을 확인하세요.']},
   trouble:{rows:[
    ['휴대폰 사진에 "목표 용량에 맞추지 못했습니다"','1,200만 화소는 819,200비트에 들어가지 않습니다','파일 아래 경고','크기 줄이기를 허용하거나 최대 너비를 1,300px 정도로 지정하세요'],
    ['결과가 100KB보다 훨씬 작음','균형은 화질 0.80보다 올라가지 않습니다','결과 줄, 예: 45 KB','고화질을 고르세요'],
    ['100KB라고 적힌 양식이 거부','100,000바이트로 셉니다','정확한 바이트 수','97을 입력하세요'],
    ['텍스처나 무늬가 뭉개져 보임','WebP가 선택되어 반복되는 미세한 디테일을 부드럽게 만들었습니다','무늬를 확대','제한이 허락하면 저장 형식을 PNG로, 아니면 JPG로 바꿔 비교하세요']]},
   alternatives:{rows:[
    ['[[image/compress-to-200kb|200KB 이하로 압축]]','받는 곳이 허용하고 사진이 1메가픽셀보다 클 때.'],
    ['[[image/resize|크기 변경]]','표시 너비(예: 1200px 블로그 본문)를 알고 있을 때.'],
    ['[[image/jpg-to-webp|JPG → WebP]]','정해진 제한 없이 가벼운 웹용 사본만 원할 때.']]},
   limits:['목표를 최솟값으로 쓸 수는 없으며 결과는 그보다 훨씬 작을 수 있습니다.','메가픽셀 수치는 사진 한 장에서 얻은 추정이며, 세밀하거나 노이즈가 많은 그림은 바이트가 더 필요합니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 `?kb=100`에 넘기는 옵션으로 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`, 그 Pillow JPG(화질 92), `tests/fixtures/texture/bricks_Color.png`를 측정했습니다. 고화질 수치는 같은 사진에서 측정한 해당 단계의 후보입니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'「100KB」は最大100 × 1,024 = 102,400バイトです。小さな画像はたいていバランスの画質ですぐに収まります。512 × 512のNASAの写真は45,813バイトのJPG（SSIM 0.9785）、256 × 256のレンガのテクスチャは14,214バイトのWebPになり、75,758バイトのJPGはすでに収まっていたのでそのまま返りました。大きな写真なら、100KBに入るのはおよそ0.6〜1.3メガピクセルです。フォームが100,000バイトで数えるなら97を、予算をもっと使いたいなら高画質を選びます。',
   concept:{title:'上限と、その下に入るピクセル数',body:[
    '目標は制限するだけで、そこへ近づけるものではありません。すべての形式をまず段階の画質でエンコードし、102,400バイトを超えた候補だけ画質を下げて探します。収まる候補の中では点数が最も高いものが勝ちます。そのためバランスの512pxの写真は100KBではなく45KB付近にとどまります。',
    '高画質を選ぶと開始点が0.92になります。同じ写真で計測した高画質の候補は59,824バイトのWebP（SSIM 0.9883）と73,755バイトのJPG（0.9874）で、どちらも102,400以下なのでWebPが選ばれます。',
    'テストファイルより大きな写真では予算が効いてきます。819,200ビットです。テスト写真で計測した2つの密度（1ピクセル0.62ビットと1.40ビット）では1.33または0.59メガピクセル、4:3の写真でおよそ1330 × 998または883 × 662です。1,200万画素のスマホ写真は先にサイズを縮める必要があります。'],
    terms:[['102,400バイト','100 × 1,024。プリセットが使う正確な上限。'],['段階の画質','開始画質（0.60 / 0.80 / 0.92）。目標がこれを上げることはありません。'],['メガピクセルの予算','目標のビット数 ÷ 1ピクセルあたりのビット。収まるサイズのおおよその目安。']]},
   example:{title:'実際の3ファイルに100KBを適用（実測）',lead:'バランス、自動形式、Chromium 153、2026-09-28。',lines:[
    '目標 100KB = 102,400 バイト',
    '',
    'astronaut.png     512 x 512   791,555 バイト  ->  JPG q0.80   45,813 バイト  SSIM 0.9785',
    'bricks_Color.png  256 x 256   127,956 バイト  ->  WebP q0.80  14,214 バイト  SSIM 0.9701',
    'astronaut.jpg     512 x 512    75,758 バイト  ->  元のまま（すでに収まる）',
    '',
    '予算 819,200 ビット: 1ピクセル0.62ビットで1.33MP、1.40ビットで0.59MP'],
    after:'レンガのテクスチャはambientCGのCC0素材Bricks076Cをリポジトリで256 × 256に縮小したものです。WebPが15,653バイトのJPG（0.9573）より高い点数でした。'},
   mapping:{title:'上限を正しく入力する',head:['フォームの表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['100KB（1KB = 1,024バイト）','100（プリセット）','102,400 バイト'],
    ['100KB（1KB = 1,000バイト）','97','99,328 バイト'],
    ['100KBでできるだけ高画質に','100 + 高画質','画質0.92から開始'],
    ['100KBと最大幅','100 + 最大幅','先にサイズ変更してから圧縮']]},
   verify:{steps:[
    '結果一覧の容量をフォームの上限と、ファイルのプロパティの正確なバイト数と比べます。',
    '結果が100KBよりずっと小さく、もっと細部が欲しいなら高画質でやり直します。',
    '100%で開き、見る人が最初に目を向ける部分を確認します。']},
   trouble:{rows:[
    ['スマホ写真で「目標サイズに届きませんでした」','1,200万画素は819,200ビットに収まらない','ファイルの下の警告','縮小を許可するか、最大幅を1,300px程度にします'],
    ['結果が100KBよりずっと小さい','バランスは画質0.80より上げない','結果の行、例：45 KB','高画質を選びます'],
    ['100KBと書かれたフォームで拒否される','100,000バイトで数えている','正確なバイト数','97を入力します'],
    ['テクスチャや模様がぼやける','WebPが選ばれ、細かい繰り返し模様をなめらかにした','模様を拡大','上限が許せば保存形式をPNGに、だめならJPGにして比べます']]},
   alternatives:{rows:[
    ['[[image/compress-to-200kb|200KB以下に圧縮]]','提出先が許し、写真が1メガピクセルより大きい場合。'],
    ['[[image/resize|サイズ変更]]','表示幅（例：幅1200pxのブログ本文）が分かっている場合。'],
    ['[[image/jpg-to-webp|JPG → WebP]]','決まった上限はなく、軽いWeb用コピーだけが欲しい場合。']]},
   limits:['目標を最低値として使うことはできず、結果はずっと小さくなることがあります。','メガピクセルの数値は1枚の写真からの推定で、細かい絵やノイズの多い絵にはもっとバイトが必要です。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` が `?kb=100` に渡す設定のまま `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png`、そのPillow製JPG（画質92）、`tests/fixtures/texture/bricks_Color.png` を計測しました。高画質の数値は同じ写真で計測したその段階の候補です。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-200kb':{
  type:'tool',
  intent:{primary:'compress an image to 200 KB or less',secondary:['photo under 200 KB for a job or university application','200 KB without losing quality','keep a PNG lossless under 200 KB'],
   goal:'a file at or under 200 KB that keeps as much quality as possible, lossless where it already fits',input:'photo, scan, texture or graphic',output:'JPG, WebP or PNG of at most 204,800 bytes',target:'application portals, marketplaces, CMS uploads',support:'full',
   evidence:['src/task/compress.js','src/compression.js (original file as a candidate)','measured 2026-09-28, Chromium 153: astronaut.png, astronaut.jpg, bricks_Color.png'],
   external:['MDN image format guide']},
  en:{
   answer:'"200 KB" allows up to 200 × 1,024 = 204,800 bytes. When a file already fits and is a JPG, PNG or WebP, it wins with a perfect score and comes back untouched — a 127,956-byte PNG texture stayed a lossless PNG. Larger files are re-encoded at the level\'s quality and searched down only if needed: the 791,555-byte NASA PNG became a 45,813-byte JPG. At full phone-camera resolution 200 KB is tight; about 1.2–2.7 megapixels fit at the quality levels measured here. Forms that count 200,000 bytes need 195.',
   concept:{title:'200 KB: lossless when possible, lossy when necessary',body:[
    'The candidate list always includes the dropped file itself when it fits the target and is a format Auto can write. It scores 1.0, so it beats every lossy re-encode, and a PNG under 200 KB stays pixel-exact. Only files above 204,800 bytes are actually compressed.',
    'The budget is 1,638,400 bits. On the test photo, 0.62 bits per pixel scored 0.96 (WebP) and 1.40 bits per pixel scored 0.98 (JPG). Divided into the budget that is 2.66 or 1.17 megapixels — about 1882 × 1411 or 1249 × 937 at 4:3. A 12.2-megapixel phone photo would get 0.13 bits per pixel, far below both, so expect a very low quality or "Target size not reached" unless the dimensions go down.'],
    terms:[['204,800 bytes','200 × 1,024, the preset\'s exact ceiling.'],['Original as a candidate','A dropped JPG, PNG or WebP that already fits competes with a score of 1.0.'],['Bits per pixel','Size in bits ÷ pixel count; used here only as a rough guide.']]},
   example:{title:'200 KB on three real files (measured)',lead:'Balanced level, Auto format, Chromium 153, 2026-09-28.',lines:[
    'Target 200 KB = 204,800 bytes',
    '',
    'bricks_Color.png  256 x 256   127,956 bytes  ->  original PNG kept (lossless)',
    'astronaut.jpg     512 x 512    75,758 bytes  ->  original JPG kept',
    'astronaut.png     512 x 512   791,555 bytes  ->  JPG q0.80   45,813 bytes  SSIM 0.9785',
    '                              (lossless PNG re-encode: 575,694 bytes, too big)',
    '',
    '4032 x 3024 photo: 1,638,400 bits / 12,192,768 px = 0.13 bits per pixel'],
    after:'For the brick texture a lossy WebP of 14,214 bytes also existed, but under a 200 KB limit the exact original scores higher and is kept.'},
   mapping:{title:'Entering the right limit',head:['The form says','Target size to enter','Largest file you get'],rows:[
    ['200 KB, counted as 1,024 bytes','200 (preset)','204,800 bytes'],
    ['200 KB, counted as 1,000 bytes','195','199,680 bytes'],
    ['200 KB, keep the phone photo usable','200 + Max width about 1,800','Fewer pixels, higher quality'],
    ['200 KB, JPG only','200 + Output format JPG','Transparency filled with the JPG background']]},
   verify:{steps:[
    'If the result line says the original was kept, the file already met the limit — check that its format is one the portal accepts.',
    'Compare the exact byte count with the portal\'s limit.',
    'Open the result at 100 % before uploading.']},
   trouble:{rows:[
    ['The PNG came back unchanged, but the portal wants JPG','The PNG fitted, so it won with a perfect score','Result line says original kept','Advanced → Output format → JPG'],
    ['A phone photo misses the target','0.13 bits per pixel is not reachable at full size','Warning under the file','Allow smaller dimensions or set Max width to about 1,800 px'],
    ['Rejected although it shows 200 KB','The portal counts 200,000 bytes','Exact bytes in file properties','Enter 195'],
    ['The photo looks worse than expected at 200 KB','A large photo forced the quality search low','Compare with a version resized to 1,800 px','Fewer pixels at higher quality often look better; resize first']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|Compress to 500 KB]]','The portal allows it; a large photo keeps far more detail.'],
    ['[[image/resize|Resize]] then compress','You know the display size; unused pixels only cost bytes.'],
    ['[[pdf/compress|Compress a PDF]]','The document is a PDF, not an image.']]},
   limits:['A file that already fits is not re-encoded, so its format may not be the one the portal wants — set the output format.','Megapixel figures are estimates from one photo, not guarantees.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for `?kb=200`, on `tests/fixtures/astronaut.png`, its Pillow JPG (quality 92) and `tests/fixtures/texture/bricks_Color.png` (ambientCG CC0).'],sources:[MDN.en]}
  },
  ko:{
   answer:'"200KB"는 최대 200 × 1,024 = 204,800바이트입니다. 이미 들어가는 JPG·PNG·WebP 파일은 만점으로 이겨 그대로 돌아옵니다. 127,956바이트 PNG 텍스처는 무손실 PNG 그대로였습니다. 더 큰 파일은 단계 화질로 다시 인코딩하고 필요할 때만 화질을 낮춥니다. 791,555바이트 NASA PNG는 45,813바이트 JPG가 됐습니다. 휴대폰 카메라 원본 해상도에서 200KB는 빠듯하며, 여기서 측정한 화질 수준으로는 약 1.2~2.7메가픽셀이 들어갑니다. 200,000바이트로 세는 양식은 195를 입력하세요.',
   concept:{title:'200KB: 가능하면 무손실, 필요하면 손실',body:[
    '넣은 파일이 목표에 들어가고 자동이 쓸 수 있는 형식이면 후보 목록에 항상 그 파일이 포함됩니다. 점수가 1.0이라 어떤 손실 재인코딩보다 앞서고, 200KB 이하의 PNG는 픽셀까지 그대로 남습니다. 실제로 압축되는 것은 204,800바이트를 넘는 파일뿐입니다.',
    '예산은 1,638,400비트입니다. 테스트 사진에서 픽셀당 0.62비트는 0.96(WebP), 1.40비트는 0.98(JPG)이었습니다. 예산을 나누면 2.66 또는 1.17메가픽셀, 4:3 기준 약 1882 × 1411 또는 1249 × 937입니다. 1,220만 화소 휴대폰 사진은 픽셀당 0.13비트로 둘 다에 한참 못 미치므로, 크기를 줄이지 않으면 매우 낮은 화질이나 "목표 용량에 맞추지 못했습니다"를 예상하세요.'],
    terms:[['204,800바이트','200 × 1,024. 프리셋의 정확한 상한.'],['후보로서의 원본','이미 들어가는 JPG·PNG·WebP는 점수 1.0으로 경쟁합니다.'],['픽셀당 비트','비트 단위 크기 ÷ 픽셀 수. 여기서는 대략적인 기준으로만 씁니다.']]},
   example:{title:'실제 파일 세 개에 200KB 적용(실측)',lead:'균형 단계, 자동 형식, Chromium 153, 2026-09-28.',lines:[
    '목표 200KB = 204,800 바이트',
    '',
    'bricks_Color.png  256 x 256   127,956 바이트  ->  원본 PNG 유지 (무손실)',
    'astronaut.jpg     512 x 512    75,758 바이트  ->  원본 JPG 유지',
    'astronaut.png     512 x 512   791,555 바이트  ->  JPG q0.80   45,813 바이트  SSIM 0.9785',
    '                              (무손실 PNG 재인코딩: 575,694 바이트, 초과)',
    '',
    '4032 x 3024 사진: 1,638,400 비트 / 12,192,768 픽셀 = 픽셀당 0.13 비트'],
    after:'벽돌 텍스처에는 14,214바이트 손실 WebP 후보도 있었지만 200KB 제한에서는 정확한 원본의 점수가 더 높아 원본이 남았습니다.'},
   mapping:{title:'제한값 제대로 입력하기',head:['양식 문구','입력할 목표 용량','최대 파일 크기'],rows:[
    ['200KB, 1KB = 1,024바이트','200 (기본값)','204,800 바이트'],
    ['200KB, 1KB = 1,000바이트','195','199,680 바이트'],
    ['200KB, 휴대폰 사진을 쓸 만하게','200 + 최대 너비 약 1,800','픽셀은 적게, 화질은 높게'],
    ['200KB, JPG만','200 + 저장 형식 JPG','투명 부분은 JPG 배경색으로 채움']]},
   verify:{steps:[
    '결과 줄에 원본 유지라고 나오면 파일이 이미 제한을 만족한 것입니다. 그 형식을 포털이 받는지 확인하세요.',
    '정확한 바이트 수를 포털의 제한과 비교하세요.',
    '올리기 전에 결과를 100%로 열어 보세요.']},
   trouble:{rows:[
    ['PNG가 그대로 돌아왔는데 포털은 JPG를 원함','PNG가 들어가서 만점으로 이겼습니다','결과 줄에 원본 유지','고급 → 저장 형식 → JPG'],
    ['휴대폰 사진이 목표를 못 맞춤','원본 크기에서 픽셀당 0.13비트는 도달할 수 없습니다','파일 아래 경고','크기 줄이기를 허용하거나 최대 너비를 1,800px 정도로 지정하세요'],
    ['200KB로 보이는데 거부됨','포털이 200,000바이트로 셉니다','파일 속성의 정확한 바이트 수','195를 입력하세요'],
    ['200KB에서 사진이 생각보다 나빠 보임','큰 사진이라 화질 탐색이 낮게 내려갔습니다','1,800px로 줄인 버전과 비교','픽셀을 줄이고 화질을 높이는 쪽이 나아 보이는 경우가 많습니다. 먼저 크기를 줄이세요']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|500KB 이하로 압축]]','포털이 허용한다면. 큰 사진이 훨씬 많은 디테일을 지킵니다.'],
    ['[[image/resize|크기 변경]] 후 압축','표시 크기를 알 때. 쓰이지 않는 픽셀은 바이트만 먹습니다.'],
    ['[[pdf/compress|PDF 압축]]','문서가 이미지가 아니라 PDF일 때.']]},
   limits:['이미 들어가는 파일은 다시 인코딩하지 않으므로 포털이 원하는 형식이 아닐 수 있습니다. 저장 형식을 지정하세요.','메가픽셀 수치는 사진 한 장에서 얻은 추정이며 보장이 아닙니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 `?kb=200`에 넘기는 옵션으로 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`, 그 Pillow JPG(화질 92), `tests/fixtures/texture/bricks_Color.png`(ambientCG CC0)를 측정했습니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'「200KB」は最大200 × 1,024 = 204,800バイトです。すでに収まっているJPG・PNG・WebPファイルは満点で勝ち、そのまま返ります。127,956バイトのPNGテクスチャは可逆のPNGのままでした。大きなファイルは段階の画質でエンコードし直し、必要なときだけ画質を下げます。791,555バイトのNASAのPNGは45,813バイトのJPGになりました。スマホカメラの元の解像度では200KBは厳しく、ここで計測した画質の水準ではおよそ1.2〜2.7メガピクセルが収まります。200,000バイトで数えるフォームなら195を入力します。',
   concept:{title:'200KB：できれば可逆、必要なら非可逆',body:[
    '入れたファイルが目標に収まり、自動で書ける形式なら、候補には必ずそのファイル自体が入ります。点数は1.0なのでどの非可逆の再エンコードより上になり、200KB以下のPNGはピクセルまでそのまま残ります。実際に圧縮されるのは204,800バイトを超えるファイルだけです。',
    '予算は1,638,400ビットです。テスト写真では1ピクセル0.62ビットで0.96（WebP）、1.40ビットで0.98（JPG）でした。予算を割ると2.66または1.17メガピクセル、4:3でおよそ1882 × 1411または1249 × 937です。1,220万画素のスマホ写真は1ピクセル0.13ビットでどちらにも遠く及ばないため、サイズを縮めなければ非常に低い画質か「目標サイズに届きませんでした」になると考えてください。'],
    terms:[['204,800バイト','200 × 1,024。プリセットの正確な上限。'],['候補としての元ファイル','すでに収まるJPG・PNG・WebPは点数1.0で競います。'],['1ピクセルあたりのビット','ビット単位の容量 ÷ ピクセル数。ここではおおよその目安としてだけ使います。']]},
   example:{title:'実際の3ファイルに200KBを適用（実測）',lead:'バランス、自動形式、Chromium 153、2026-09-28。',lines:[
    '目標 200KB = 204,800 バイト',
    '',
    'bricks_Color.png  256 x 256   127,956 バイト  ->  元のPNGのまま（可逆）',
    'astronaut.jpg     512 x 512    75,758 バイト  ->  元のJPGのまま',
    'astronaut.png     512 x 512   791,555 バイト  ->  JPG q0.80   45,813 バイト  SSIM 0.9785',
    '                              （可逆PNGの再エンコード: 575,694 バイト、超過）',
    '',
    '4032 x 3024の写真: 1,638,400 ビット / 12,192,768 ピクセル = 1ピクセル 0.13 ビット'],
    after:'レンガのテクスチャには14,214バイトの非可逆WebPの候補もありましたが、200KBの上限では正確な元ファイルのほうが点数が高く、元のまま残りました。'},
   mapping:{title:'上限を正しく入力する',head:['フォームの表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['200KB（1KB = 1,024バイト）','200（プリセット）','204,800 バイト'],
    ['200KB（1KB = 1,000バイト）','195','199,680 バイト'],
    ['200KBでスマホ写真を見られる画質に','200 + 最大幅 約1,800','ピクセルを減らして画質を上げる'],
    ['200KBでJPGのみ','200 + 保存形式JPG','透明部分はJPGの背景色で塗る']]},
   verify:{steps:[
    '結果の行に元のままと出たら、ファイルはすでに上限を満たしています。その形式をポータルが受け付けるか確認します。',
    '正確なバイト数をポータルの上限と比べます。',
    'アップロード前に結果を100%で開きます。']},
   trouble:{rows:[
    ['PNGがそのまま返ったが、ポータルはJPGを求める','PNGが収まっていたので満点で勝った','結果の行に元のまま','詳細 → 保存形式 → JPG'],
    ['スマホ写真が目標に届かない','元のサイズでは1ピクセル0.13ビットに届かない','ファイルの下の警告','縮小を許可するか、最大幅を1,800px程度にします'],
    ['200KBと表示されるのに拒否される','ポータルが200,000バイトで数えている','ファイルのプロパティで正確なバイト数','195を入力します'],
    ['200KBで写真が思ったより悪い','大きな写真のため、画質の探索が低く下がった','1,800pxに縮小した版と比べる','ピクセルを減らして画質を上げたほうがきれいに見えることが多いので、先に縮小します']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|500KB以下に圧縮]]','ポータルが許すなら。大きな写真の細部がずっと多く残ります。'],
    ['[[image/resize|サイズ変更]]してから圧縮','表示サイズが分かっている場合。使われないピクセルはバイトを食うだけです。'],
    ['[[pdf/compress|PDFの圧縮]]','書類が画像ではなくPDFの場合。']]},
   limits:['すでに収まるファイルは再エンコードしないため、ポータルが求める形式でないことがあります。保存形式を指定してください。','メガピクセルの数値は1枚の写真からの推定で、保証ではありません。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` が `?kb=200` に渡す設定のまま `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png`、そのPillow製JPG（画質92）、`tests/fixtures/texture/bricks_Color.png`（ambientCG CC0）を計測しました。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-500kb':{
  type:'tool',
  intent:{primary:'compress an image to 500 KB or less',secondary:['phone photo under 500 KB','500 KB JPG for upload','why the lossless PNG does not fit'],
   goal:'a photo at or under 500 KB with minimal visible loss, ideally at full resolution',input:'photo, scan or screenshot',output:'JPG, WebP or PNG of at most 512,000 bytes',target:'marketplace listings, forms, e-mail',support:'full',
   evidence:['src/task/compress.js','src/compression.js','measured 2026-09-28, Chromium 153: astronaut.png (PNG re-encode 575,694 B vs 512,000 B target)'],
   external:['MDN image format guide']},
  en:{
   answer:'"500 KB" means at most 500 × 1,024 = 512,000 bytes — enough for roughly 2.9–6.6 megapixels of photo at the quality levels measured here, so moderately large photos can often keep their full size. A lossless PNG may still miss it: the 512 × 512 NASA photo re-encoded as PNG was 575,694 bytes, 63,694 over, so the tool chose a 45,813-byte JPG (SSIM 0.9785) instead. Choose High quality to start at 0.92 and use more of the budget; enter 488 if the form counts 500,000 bytes.',
   concept:{title:'A generous ceiling, used sparingly by default',body:[
    'The budget is 4,096,000 bits. At the densities measured on the test photo (0.62 and 1.40 bits per pixel) that holds about 6.6 or 2.9 megapixels — around 2976 × 2232 or 1976 × 1482 at 4:3. A 12.2-megapixel phone photo gets 0.34 bits per pixel, below the lowest measured density, so its quality will be searched down unless you allow smaller dimensions.',
    'Because the target is only a ceiling, a small photo does not get "500 KB of quality": Balanced still starts at 0.80. Photos and screenshots that should stay lossless must fit as PNG; for the fixture that needed 575,694 bytes, which is why the 1 MB page keeps it lossless and this one does not.'],
    terms:[['512,000 bytes','500 × 1,024, the exact ceiling.'],['Lossless fit','A PNG candidate wins only if it is at or under the target.'],['High quality','Level that starts the search at quality 0.92 instead of 0.80.']]},
   example:{title:'Where lossless stops fitting (measured)',lead:'Balanced level, Auto format, Chromium 153, 2026-09-28, on the 512 × 512 NASA fixture.',lines:[
    'Target 500 KB = 512,000 bytes',
    '',
    'PNG re-encode    575,694 bytes   SSIM 1.0000   63,694 over -> out',
    'JPG q0.80         45,813 bytes   SSIM 0.9785   <- chosen',
    'WebP q0.80        32,200 bytes   SSIM 0.9749',
    '',
    'High level candidates: WebP q0.92 59,824 (0.9883), JPG q0.92 73,755 (0.9874)',
    '4032 x 3024 photo: 4,096,000 bits / 12,192,768 px = 0.34 bits per pixel'],
    after:'With High quality both 0.92 candidates fit under 512,000 bytes, so the higher-scoring WebP would be chosen — 59,824 bytes, still far below the limit.'},
   mapping:{title:'Entering the right limit',head:['The form says','Target size to enter','Largest file you get'],rows:[
    ['500 KB, counted as 1,024 bytes','500 (preset)','512,000 bytes'],
    ['500 KB, counted as 1,000 bytes','488','499,712 bytes'],
    ['500 KB and best quality','500 + High quality','Starts at 0.92'],
    ['500 KB for a 12 MP photo','500 + Reduce dimensions','Up to five smaller widths tried']]},
   verify:{steps:[
    'Check the byte count against the form, and the pixel size in the result line ("kept" or "resized to").',
    'Zoom into faces, foliage and text at 100 %.',
    'If you allowed shrinking, confirm the new width is still enough for where the photo is shown.']},
   trouble:{rows:[
    ['The result is only about 50 KB','Balanced starts at 0.80 and a small photo fits at once','Result line','Choose High quality'],
    ['The screenshot did not stay PNG','The lossless PNG was bigger than 512,000 bytes','Compare with the 1 MB result','Use [[image/compress-to-1mb|1 MB]] if allowed, or accept JPG/WebP'],
    ['A phone photo shows visible blocks','0.34 bits per pixel forced a low quality','Zoom in at 100 %','Allow smaller dimensions or set Max width around 2,900 px'],
    ['The form rejects "500 KB"','It counts 500,000 bytes','Exact bytes in file properties','Enter 488']]},
   alternatives:{rows:[
    ['[[image/compress-to-1mb|Compress to 1 MB]]','The limit allows it and you want the PNG lossless or a phone photo at full size.'],
    ['[[image/compress-to-200kb|Compress to 200 KB]]','The destination is stricter.']]},
   limits:['The tool never raises quality above the level to use the whole 500 KB.','Pixel estimates rest on one measured photo; other content compresses differently.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for `?kb=500`, on `tests/fixtures/astronaut.png`; High-quality figures are the measured candidates of that level on the same photo.'],sources:[MDN.en]}
  },
  ko:{
   answer:'"500KB"는 최대 500 × 1,024 = 512,000바이트입니다. 여기서 측정한 화질 수준이라면 사진 약 2.9~6.6메가픽셀이 들어갈 만한 크기라 적당히 큰 사진은 원래 크기를 유지하는 경우가 많습니다. 그래도 무손실 PNG는 넘칠 수 있습니다. 512 × 512 NASA 사진을 PNG로 다시 저장하면 575,694바이트로 63,694바이트가 넘어서, 도구는 대신 45,813바이트 JPG(SSIM 0.9785)를 골랐습니다. 예산을 더 쓰려면 0.92에서 시작하는 고화질을, 양식이 500,000바이트로 센다면 488을 입력하세요.',
   concept:{title:'넉넉한 상한, 기본값에서는 아껴 쓰기',body:[
    '예산은 4,096,000비트입니다. 테스트 사진에서 측정한 밀도(픽셀당 0.62비트와 1.40비트)로 보면 약 6.6 또는 2.9메가픽셀, 4:3 기준 약 2976 × 2232 또는 1976 × 1482가 들어갑니다. 1,220만 화소 휴대폰 사진은 픽셀당 0.34비트로 측정한 가장 낮은 밀도보다 낮아서, 더 작은 크기를 허용하지 않으면 화질이 낮게 탐색됩니다.',
    '목표는 상한일 뿐이라 작은 사진이 "500KB만큼의 화질"을 받지는 않습니다. 균형은 여전히 0.80에서 시작합니다. 무손실로 남아야 하는 사진과 스크린샷은 PNG로 들어가야 하는데, 테스트 사진은 575,694바이트가 필요했습니다. 1MB 페이지에서는 무손실로 남고 이 페이지에서는 그렇지 않은 이유입니다.'],
    terms:[['512,000바이트','500 × 1,024. 정확한 상한.'],['무손실로 들어가기','PNG 후보는 목표 이하일 때만 이깁니다.'],['고화질','탐색을 0.80이 아니라 0.92에서 시작하는 단계.']]},
   example:{title:'무손실이 들어가지 않는 지점(실측)',lead:'균형 단계, 자동 형식, Chromium 153, 2026-09-28, 512 × 512 NASA 테스트 사진.',lines:[
    '목표 500KB = 512,000 바이트',
    '',
    'PNG 재인코딩     575,694 바이트   SSIM 1.0000   63,694 초과 -> 탈락',
    'JPG q0.80         45,813 바이트   SSIM 0.9785   <- 선택',
    'WebP q0.80        32,200 바이트   SSIM 0.9749',
    '',
    '고화질 후보: WebP q0.92 59,824 (0.9883), JPG q0.92 73,755 (0.9874)',
    '4032 x 3024 사진: 4,096,000 비트 / 12,192,768 픽셀 = 픽셀당 0.34 비트'],
    after:'고화질이면 0.92 후보 둘 다 512,000바이트 안에 들어가 점수가 높은 WebP가 선택됩니다. 59,824바이트로 여전히 제한보다 한참 작습니다.'},
   mapping:{title:'제한값 제대로 입력하기',head:['양식 문구','입력할 목표 용량','최대 파일 크기'],rows:[
    ['500KB, 1KB = 1,024바이트','500 (기본값)','512,000 바이트'],
    ['500KB, 1KB = 1,000바이트','488','499,712 바이트'],
    ['500KB, 최고 화질로','500 + 고화질','0.92에서 시작'],
    ['1,200만 화소 사진을 500KB로','500 + 크기도 줄이기','최대 다섯 가지 작은 너비 시도']]},
   verify:{steps:[
    '바이트 수를 양식과 비교하고, 결과 줄의 픽셀 크기(유지 또는 축소)도 확인하세요.',
    '얼굴·나뭇잎·글자를 100%로 확대해 보세요.',
    '축소를 허용했다면 새 너비가 사진이 표시될 곳에 충분한지 확인하세요.']},
   trouble:{rows:[
    ['결과가 50KB 정도밖에 안 됨','균형은 0.80에서 시작하고 작은 사진은 바로 들어갑니다','결과 줄','고화질을 고르세요'],
    ['스크린샷이 PNG로 남지 않음','무손실 PNG가 512,000바이트보다 컸습니다','1MB 결과와 비교','허용된다면 [[image/compress-to-1mb|1MB]]를 쓰거나 JPG·WebP를 받아들이세요'],
    ['휴대폰 사진에 블록이 보임','픽셀당 0.34비트라 화질이 낮아졌습니다','100%로 확대','크기 줄이기를 허용하거나 최대 너비를 2,900px 정도로 지정하세요'],
    ['양식이 "500KB"를 거부','500,000바이트로 셉니다','파일 속성의 정확한 바이트 수','488을 입력하세요']]},
   alternatives:{rows:[
    ['[[image/compress-to-1mb|1MB 이하로 압축]]','제한이 허락하고 PNG를 무손실로, 휴대폰 사진을 원래 크기로 두고 싶을 때.'],
    ['[[image/compress-to-200kb|200KB 이하로 압축]]','받는 곳의 제한이 더 엄격할 때.']]},
   limits:['500KB를 다 쓰려고 단계보다 화질을 올리지는 않습니다.','픽셀 추정은 측정한 사진 한 장에 기댄 것이며 다른 내용은 다르게 압축됩니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 `?kb=500`에 넘기는 옵션으로 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`를 측정했습니다. 고화질 수치는 같은 사진에서 측정한 그 단계의 후보입니다.'],sources:[MDN.ko]}
  },
  ja:{
   answer:'「500KB」は最大500 × 1,024 = 512,000バイトです。ここで計測した画質の水準なら写真でおよそ2.9〜6.6メガピクセルが入る大きさで、そこそこ大きな写真なら元のサイズを保てることが多いでしょう。それでも可逆のPNGははみ出すことがあります。512 × 512のNASAの写真をPNGで保存し直すと575,694バイトで63,694バイト超過し、ツールは代わりに45,813バイトのJPG（SSIM 0.9785）を選びました。予算をもっと使うなら0.92から始まる高画質を、フォームが500,000バイトで数えるなら488を入力します。',
   concept:{title:'余裕のある上限を、初期設定では控えめに使う',body:[
    '予算は4,096,000ビットです。テスト写真で計測した密度（1ピクセル0.62ビットと1.40ビット）なら、約6.6または2.9メガピクセル、4:3でおよそ2976 × 2232または1976 × 1482が入ります。1,220万画素のスマホ写真は1ピクセル0.34ビットで、計測した最も低い密度を下回るため、小さいサイズを許可しなければ画質が低く探索されます。',
    '目標は上限にすぎないので、小さな写真が「500KB分の画質」をもらうわけではありません。バランスは0.80から始まります。可逆のまま残したい写真やスクリーンショットはPNGで収まる必要があり、テスト写真では575,694バイト必要でした。1MBのページでは可逆で残り、このページでは残らない理由です。'],
    terms:[['512,000バイト','500 × 1,024。正確な上限。'],['可逆で収まる','PNGの候補は目標以下のときだけ勝ちます。'],['高画質','探索を0.80ではなく0.92から始める段階。']]},
   example:{title:'可逆が収まらなくなる境目（実測）',lead:'バランス、自動形式、Chromium 153、2026-09-28、512 × 512のNASAのテスト写真。',lines:[
    '目標 500KB = 512,000 バイト',
    '',
    'PNG再エンコード  575,694 バイト   SSIM 1.0000   63,694 超過 -> 脱落',
    'JPG q0.80         45,813 バイト   SSIM 0.9785   <- 採用',
    'WebP q0.80        32,200 バイト   SSIM 0.9749',
    '',
    '高画質の候補: WebP q0.92 59,824（0.9883）、JPG q0.92 73,755（0.9874）',
    '4032 x 3024の写真: 4,096,000 ビット / 12,192,768 ピクセル = 1ピクセル 0.34 ビット'],
    after:'高画質なら0.92の候補が2つとも512,000バイトに収まり、点数の高いWebPが選ばれます。59,824バイトで、それでも上限よりずっと小さい値です。'},
   mapping:{title:'上限を正しく入力する',head:['フォームの表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['500KB（1KB = 1,024バイト）','500（プリセット）','512,000 バイト'],
    ['500KB（1KB = 1,000バイト）','488','499,712 バイト'],
    ['500KBで最高画質に','500 + 高画質','0.92から開始'],
    ['1,200万画素の写真を500KBに','500 + サイズも縮小','最大5つの小さな幅を試す']]},
   verify:{steps:[
    'バイト数をフォームと比べ、結果の行のピクセルサイズ（維持か縮小か）も確認します。',
    '顔・木の葉・文字を100%で拡大します。',
    '縮小を許可したなら、新しい幅が写真の表示先に十分か確認します。']},
   trouble:{rows:[
    ['結果が50KB程度しかない','バランスは0.80から始まり、小さな写真はすぐに収まる','結果の行','高画質を選びます'],
    ['スクリーンショットがPNGのまま残らない','可逆のPNGが512,000バイトより大きかった','1MBの結果と比べる','許されるなら[[image/compress-to-1mb|1MB]]を使うか、JPG・WebPで妥協します'],
    ['スマホ写真にブロックが見える','1ピクセル0.34ビットで画質が下がった','100%で拡大','縮小を許可するか、最大幅を2,900px程度にします'],
    ['フォームが「500KB」を拒否','500,000バイトで数えている','ファイルのプロパティで正確なバイト数','488を入力します']]},
   alternatives:{rows:[
    ['[[image/compress-to-1mb|1MB以下に圧縮]]','上限が許し、PNGを可逆のまま、スマホ写真を元のサイズのままにしたい場合。'],
    ['[[image/compress-to-200kb|200KB以下に圧縮]]','提出先の上限がもっと厳しい場合。']]},
   limits:['500KBを使い切るために段階より画質を上げることはしません。','ピクセル数の見積もりは計測した1枚の写真に基づくもので、内容が違えば圧縮のされ方も違います。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` が `?kb=500` に渡す設定のまま `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png` を計測しました。高画質の数値は同じ写真で計測したその段階の候補です。'],sources:[MDN.ja]}
  }
 },
 'image/compress-to-1mb':{
  type:'tool',
  intent:{primary:'compress an image to 1 MB or less',secondary:['phone photo under 1 MB','1 MB = 1,000,000 or 1,048,576 bytes','keep it lossless under 1 MB'],
   goal:'a file under the destination\'s 1 MB limit, lossless when it fits',input:'photo, screenshot, scan (typically several MB from a phone)',output:'JPG, WebP or PNG of at most 1,024,000 bytes',target:'e-mail, chat, portals, marketplaces',support:'full',
   evidence:['src/landings.js (kb=1000)','src/task/compress.js','src/compression.js','measured 2026-09-28, Chromium 153: astronaut.png'],
   external:['MDN image format guide']},
  en:{
   answer:'This page\'s 1 MB preset is 1,000 KB × 1,024 = 1,024,000 bytes — between a decimal megabyte (1,000,000) and a binary one (1,048,576). If your destination counts 1,000,000 bytes, enter 976 as Target size (999,424 bytes). 1 MB is enough to keep many images lossless: the 512 × 512 NASA photo came back as a pixel-identical 575,694-byte PNG. For a 12-megapixel phone photo 1 MB gives 0.67 bits per pixel, about the density that scored SSIM 0.96 on the test photo, so full size is often possible at moderate quality.',
   concept:{title:'Three different megabytes',body:[
    'Nerulio multiplies the KB target by 1,024; the preset asks for 1,000 KB, so the ceiling is 1,024,000 bytes. A form that says "1 MB" may mean 1,000,000 bytes (decimal) or 1,048,576 bytes (binary). A 1,010,000-byte result passes this page\'s target, passes a binary limit and fails a decimal one — hence the 976 entry.',
    'Below that ceiling the usual rules apply: the original file competes if it fits, a lossless PNG wins whenever it fits because it scores 1.0, and lossy candidates start at the level\'s quality and are searched down only if needed. The fixture\'s own PNG (791,555 bytes) and the browser\'s PNG re-encode (575,694 bytes) both fitted; with equal scores the smaller one won.',
    'For a 4032 × 3024 photo the budget is 8,192,000 bits over 12,192,768 pixels = 0.67 bits per pixel. On the test photo, WebP at 0.62 bits per pixel scored 0.96, so a phone photo can usually stay at full size at a moderate quality — or at a higher quality after shrinking to about 2800 × 2100, where the budget reaches the 1.40 bits per pixel that scored 0.98.'],
    terms:[['1,024,000 bytes','1,000 × 1,024: this page\'s exact ceiling.'],['Decimal MB','1,000,000 bytes; enter 976 to stay under it.'],['Binary MB (MiB)','1,048,576 bytes; the preset is already under it.']]},
   example:{title:'1 MB on the NASA photo, and the budget for a phone photo',lead:'Measured with Balanced level and Auto format in Chromium 153 on 2026-09-28; the phone-photo lines are arithmetic.',lines:[
    'Target 1 MB = 1,000 x 1,024 = 1,024,000 bytes',
    '',
    'astronaut.png   791,555 bytes   original fits, SSIM 1.0',
    '  PNG re-encode 575,694 bytes   SSIM 1.0, smaller   <- chosen (lossless)',
    '  JPG q0.80      45,813 bytes   SSIM 0.9785',
    '',
    '4032 x 3024: 8,192,000 bits / 12,192,768 px = 0.67 bits per pixel',
    'Decimal-safe entry: 976 x 1,024 = 999,424 bytes'],
    after:'The chosen PNG is named `astronaut-min.png`; its pixels are identical to the source. At 500 KB the same photo could not stay lossless (see [[image/compress-to-500kb|compress to 500 KB]]).'},
   mapping:{title:'Which number to type',head:['The destination says','Target size to enter','Largest file you get'],rows:[
    ['1 MB (this preset)','1000','1,024,000 bytes'],
    ['1 MB = 1,000,000 bytes','976','999,424 bytes'],
    ['1 MB = 1,048,576 bytes (MiB)','1024','1,048,576 bytes'],
    ['2 MB, e.g. YouTube\'s mobile thumbnail limit','2000 (or 1953 for 2,000,000 bytes)','2,048,000 bytes']]},
   verify:{steps:[
    'Check the exact byte count in the file properties; the result list shows sizes of this range in KB, e.g. "1000 KB".',
    'If the result is a PNG, confirm the destination accepts PNG; otherwise set Output format to JPG.',
    'For phone photos, check whether the result line says the resolution was kept.']},
   trouble:{rows:[
    ['Rejected although it is "1 MB"','The destination counts 1,000,000 bytes; the result can be up to 1,024,000','Exact bytes in file properties','Enter 976 as Target size'],
    ['The result is a large PNG, not a JPG','The lossless PNG fitted and scored 1.0','The name ends in `-min.png`','Set Output format to JPG if the destination needs JPG'],
    ['A phone photo still misses the target','Very detailed or noisy picture needs more than 0.67 bits per pixel','Warning under the file','Allow smaller dimensions; about 2800 px wide gives 1.4 bits per pixel'],
    ['A HEIC photo from an iPhone','HEIC is decoded (a decoder may be downloaded) and written as JPG, PNG or WebP','The source ends in .heic','Nothing to fix; EXIF such as the location is not written to the result']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|Compress to 500 KB]]','The limit is lower or you want a lighter file for the web.'],
    ['[[image/heic-to-jpg|HEIC to JPG]]','You only need an iPhone photo as JPG and the size is not limited.'],
    ['[[video/compress|Compress a video]]','The file is a video, not a photo.']]},
   limits:['The preset targets 1,024,000 bytes, not 1,000,000; change the number when your destination counts decimal megabytes.','EXIF (camera, date, location) is not written, and animated images are refused.'],
   versions:{body:['Measured on 2026-09-28 in Playwright Chromium 153 by calling `src/compression.js` with the options `src/task/compress.js` passes for the landing preset `kb=1000` (`src/landings.js`), on `tests/fixtures/astronaut.png`. The YouTube 2 MB mobile thumbnail limit is from YouTube Help (checked the same day).'],sources:[MDN.en,'[YouTube Help: Add video thumbnails](https://support.google.com/youtube/answer/72431)']}
  },
  ko:{
   answer:'이 페이지의 1MB 프리셋은 1,000KB × 1,024 = 1,024,000바이트입니다. 십진 메가바이트(1,000,000)와 이진 메가바이트(1,048,576) 사이 값이죠. 받는 곳이 1,000,000바이트로 센다면 목표 용량에 976(999,424바이트)을 입력하세요. 1MB면 많은 이미지를 무손실로 둘 수 있습니다. 512 × 512 NASA 사진은 픽셀까지 같은 575,694바이트 PNG로 돌아왔습니다. 1,200만 화소 휴대폰 사진이라면 1MB는 픽셀당 0.67비트로, 테스트 사진에서 SSIM 0.96이 나온 밀도와 비슷해 원래 크기를 적당한 화질로 유지할 수 있는 경우가 많습니다.',
   concept:{title:'서로 다른 세 가지 메가바이트',body:[
    'Nerulio는 KB 목표에 1,024를 곱합니다. 프리셋은 1,000KB를 요청하므로 상한은 1,024,000바이트입니다. "1MB"라고 적힌 양식은 1,000,000바이트(십진)일 수도 1,048,576바이트(이진)일 수도 있습니다. 1,010,000바이트 결과는 이 페이지의 목표와 이진 제한은 통과하지만 십진 제한에는 걸립니다. 그래서 976을 입력하라는 것입니다.',
    '상한 아래에서는 평소 규칙이 적용됩니다. 원본이 들어가면 원본도 경쟁하고, 무손실 PNG는 점수 1.0이라 들어가기만 하면 이기며, 손실 후보는 단계 화질에서 시작해 필요할 때만 낮춥니다. 테스트 사진의 PNG 원본(791,555바이트)과 브라우저의 PNG 재인코딩(575,694바이트)이 모두 들어갔고, 점수가 같아 더 작은 쪽이 이겼습니다.',
    '4032 × 3024 사진이라면 예산 8,192,000비트를 12,192,768픽셀로 나눠 픽셀당 0.67비트입니다. 테스트 사진에서 WebP는 픽셀당 0.62비트로 0.96을 받았으니 휴대폰 사진도 대개 원래 크기에서 적당한 화질로 들어갑니다. 약 2800 × 2100으로 줄이면 0.98이 나온 1.40비트에 닿아 더 높은 화질이 됩니다.'],
    terms:[['1,024,000바이트','1,000 × 1,024. 이 페이지의 정확한 상한.'],['십진 MB','1,000,000바이트. 그 아래로 맞추려면 976을 입력합니다.'],['이진 MB(MiB)','1,048,576바이트. 프리셋은 이미 그보다 작습니다.']]},
   example:{title:'NASA 사진에 1MB 적용, 그리고 휴대폰 사진의 예산',lead:'2026-09-28 Chromium 153에서 균형 단계와 자동 형식으로 측정했습니다. 휴대폰 사진 줄은 계산값입니다.',lines:[
    '목표 1MB = 1,000 x 1,024 = 1,024,000 바이트',
    '',
    'astronaut.png   791,555 바이트   원본이 들어감, SSIM 1.0',
    '  PNG 재인코딩  575,694 바이트   SSIM 1.0, 더 작음   <- 선택 (무손실)',
    '  JPG q0.80      45,813 바이트   SSIM 0.9785',
    '',
    '4032 x 3024: 8,192,000 비트 / 12,192,768 픽셀 = 픽셀당 0.67 비트',
    '십진 기준 안전값: 976 x 1,024 = 999,424 바이트'],
    after:'선택된 PNG의 이름은 `astronaut-min.png`이고 픽셀은 원본과 같습니다. 500KB에서는 같은 사진이 무손실로 남지 못했습니다([[image/compress-to-500kb|500KB 이하로 압축]] 참고).'},
   mapping:{title:'입력할 숫자',head:['받는 곳의 표기','입력할 목표 용량','최대 파일 크기'],rows:[
    ['1MB (이 프리셋)','1000','1,024,000 바이트'],
    ['1MB = 1,000,000바이트','976','999,424 바이트'],
    ['1MB = 1,048,576바이트(MiB)','1024','1,048,576 바이트'],
    ['2MB, 예: YouTube 모바일 썸네일 제한','2000 (2,000,000바이트면 1953)','2,048,000 바이트']]},
   verify:{steps:[
    '파일 속성에서 정확한 바이트 수를 확인하세요. 결과 목록은 이 범위의 크기를 KB로, 예를 들어 "1000 KB"로 보여 줍니다.',
    '결과가 PNG라면 받는 곳이 PNG를 받는지 확인하고, 아니면 저장 형식을 JPG로 바꾸세요.',
    '휴대폰 사진이라면 결과 줄에 해상도 유지라고 나오는지 보세요.']},
   trouble:{rows:[
    ['"1MB"인데 거부됨','받는 곳이 1,000,000바이트로 셉니다. 결과는 최대 1,024,000바이트일 수 있습니다','파일 속성의 정확한 바이트 수','목표 용량에 976을 입력하세요'],
    ['결과가 JPG가 아니라 큰 PNG','무손실 PNG가 들어가 점수 1.0으로 이겼습니다','이름이 `-min.png`로 끝남','받는 곳이 JPG를 원하면 저장 형식을 JPG로 하세요'],
    ['휴대폰 사진이 여전히 목표를 못 맞춤','아주 세밀하거나 노이즈가 많아 픽셀당 0.67비트로 부족합니다','파일 아래 경고','크기 줄이기를 허용하세요. 너비 약 2800px이면 픽셀당 1.4비트입니다'],
    ['아이폰의 HEIC 사진','HEIC를 디코딩해(디코더를 내려받을 수 있음) JPG·PNG·WebP로 씁니다','원본이 .heic로 끝남','고칠 것은 없습니다. 위치 같은 EXIF는 결과에 기록되지 않습니다']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|500KB 이하로 압축]]','제한이 더 낮거나 웹용으로 더 가벼운 파일이 필요할 때.'],
    ['[[image/heic-to-jpg|HEIC → JPG]]','아이폰 사진을 JPG로만 바꾸면 되고 용량 제한이 없을 때.'],
    ['[[video/compress|영상 압축]]','파일이 사진이 아니라 영상일 때.']]},
   limits:['프리셋은 1,000,000이 아니라 1,024,000바이트를 목표로 합니다. 받는 곳이 십진 메가바이트로 센다면 숫자를 바꾸세요.','EXIF(카메라·날짜·위치)는 기록하지 않으며 움직이는 이미지는 거부합니다.'],
   versions:{body:['2026-09-28 Playwright Chromium 153에서 `src/task/compress.js`가 랜딩 프리셋 `kb=1000`(`src/landings.js`)에 넘기는 옵션으로 `src/compression.js`를 호출해 `tests/fixtures/astronaut.png`를 측정했습니다. YouTube 모바일 썸네일 2MB 제한은 같은 날 확인한 YouTube 고객센터 내용입니다.'],sources:[MDN.ko,'[YouTube 고객센터: 동영상 썸네일 추가](https://support.google.com/youtube/answer/72431)']}
  },
  ja:{
   answer:'このページの1MBプリセットは1,000KB × 1,024 = 1,024,000バイトです。10進のメガバイト（1,000,000）と2進のメガバイト（1,048,576）の間の値です。提出先が1,000,000バイトで数えるなら、目標サイズに976（999,424バイト）と入力します。1MBあれば多くの画像を可逆のまま残せます。512 × 512のNASAの写真は、ピクセルまで同じ575,694バイトのPNGで返りました。1,200万画素のスマホ写真なら1MBは1ピクセル0.67ビットで、テスト写真でSSIM 0.96が出た密度に近いため、元のサイズのまま程よい画質で収まることが多いでしょう。',
   concept:{title:'3種類のメガバイト',body:[
    'NerulioはKBの目標に1,024を掛けます。プリセットは1,000KBを指定するので、上限は1,024,000バイトです。「1MB」と書かれたフォームは1,000,000バイト（10進）のことも1,048,576バイト（2進）のこともあります。1,010,000バイトの結果は、このページの目標と2進の上限は通りますが、10進の上限では弾かれます。976を入力するのはこのためです。',
    '上限の下では通常のルールが働きます。元ファイルが収まれば元ファイルも競い、可逆PNGは点数1.0なので収まれば必ず勝ち、非可逆の候補は段階の画質から始めて必要なときだけ下げます。テスト写真の元のPNG（791,555バイト）もブラウザでのPNG再エンコード（575,694バイト）も収まり、点数が同じなので小さいほうが勝ちました。',
    '4032 × 3024の写真なら、予算8,192,000ビットを12,192,768ピクセルで割って1ピクセル0.67ビットです。テスト写真ではWebPが0.62ビットで0.96だったので、スマホ写真もたいてい元のサイズのまま程よい画質で収まります。約2800 × 2100に縮めれば、0.98が出た1.40ビットに届き、画質はさらに上がります。'],
    terms:[['1,024,000バイト','1,000 × 1,024。このページの正確な上限。'],['10進のMB','1,000,000バイト。これを下回るには976を入力します。'],['2進のMB（MiB）','1,048,576バイト。プリセットはすでにこれより小さい値です。']]},
   example:{title:'NASAの写真に1MBを適用、そしてスマホ写真の予算',lead:'2026-09-28にChromium 153でバランスと自動形式で計測しました。スマホ写真の行は計算値です。',lines:[
    '目標 1MB = 1,000 x 1,024 = 1,024,000 バイト',
    '',
    'astronaut.png   791,555 バイト   元ファイルが収まる、SSIM 1.0',
    '  PNG再エンコード 575,694 バイト SSIM 1.0、より小さい   <- 採用（可逆）',
    '  JPG q0.80      45,813 バイト   SSIM 0.9785',
    '',
    '4032 x 3024: 8,192,000 ビット / 12,192,768 ピクセル = 1ピクセル 0.67 ビット',
    '10進でも安全な値: 976 x 1,024 = 999,424 バイト'],
    after:'選ばれたPNGの名前は `astronaut-min.png` で、ピクセルは元と同一です。500KBでは同じ写真が可逆のまま残れませんでした（[[image/compress-to-500kb|500KB以下に圧縮]]参照）。'},
   mapping:{title:'入力する数字',head:['提出先の表記','入力する目標サイズ','最大のファイルサイズ'],rows:[
    ['1MB（このプリセット）','1000','1,024,000 バイト'],
    ['1MB = 1,000,000バイト','976','999,424 バイト'],
    ['1MB = 1,048,576バイト（MiB）','1024','1,048,576 バイト'],
    ['2MB、例：YouTubeのモバイル用サムネイル上限','2000（2,000,000バイトなら1953）','2,048,000 バイト']]},
   verify:{steps:[
    'ファイルのプロパティで正確なバイト数を確認します。結果一覧はこの範囲の容量をKBで、例えば「1000 KB」と表示します。',
    '結果がPNGなら提出先がPNGを受け付けるか確認し、だめなら保存形式をJPGにします。',
    'スマホ写真なら、結果の行に解像度を維持と出ているか見ます。']},
   trouble:{rows:[
    ['「1MB」なのに拒否される','提出先が1,000,000バイトで数えている。結果は最大1,024,000バイトになり得る','ファイルのプロパティで正確なバイト数','目標サイズに976を入力します'],
    ['結果がJPGではなく大きなPNG','可逆PNGが収まり、点数1.0で勝った','名前が `-min.png` で終わる','提出先がJPGを求めるなら保存形式をJPGにします'],
    ['スマホ写真がまだ目標に届かない','非常に細かい、またはノイズの多い写真で、1ピクセル0.67ビットでは足りない','ファイルの下の警告','縮小を許可します。幅約2800pxなら1ピクセル1.4ビットです'],
    ['iPhoneのHEIC写真','HEICを展開し（デコーダーを取得することがある）、JPG・PNG・WebPで書き出す','元ファイルが.heicで終わる','直すことはありません。位置情報などのEXIFは結果に書き込まれません']]},
   alternatives:{rows:[
    ['[[image/compress-to-500kb|500KB以下に圧縮]]','上限がもっと低い場合や、Web用にもっと軽いファイルが欲しい場合。'],
    ['[[image/heic-to-jpg|HEIC → JPG]]','iPhoneの写真をJPGにするだけで、容量の上限がない場合。'],
    ['[[video/compress|動画の圧縮]]','ファイルが写真ではなく動画の場合。']]},
   limits:['プリセットの目標は1,000,000ではなく1,024,000バイトです。提出先が10進のメガバイトで数えるなら数字を変えてください。','EXIF（カメラ・日時・位置）は書き込まず、アニメーション画像は拒否します。'],
   versions:{body:['2026-09-28にPlaywright Chromium 153で、`src/task/compress.js` がランディングのプリセット `kb=1000`（`src/landings.js`）に渡す設定のまま `src/compression.js` を呼び出し、`tests/fixtures/astronaut.png` を計測しました。YouTubeのモバイル用サムネイル2MBの上限は同じ日に確認したYouTubeヘルプの記載です。'],sources:[MDN.ja,'[YouTube ヘルプ: 動画のサムネイルを追加する](https://support.google.com/youtube/answer/72431)']}
  }
 },
 'image/editor':{
  type:'tool',
  intent:{primary:'free online image editor (crop, resize, rotate, export)',secondary:['edit a photo without uploading','several edits then save once','batch export several images as ZIP'],
   goal:'one picture (or several) cropped, resized and cleaned up, saved once in the right format and size',input:'PNG, JPG, WebP, AVIF, BMP, HEIC (still images, several at once)',output:'PNG (default), JPG, WebP; `<name>-edited.<ext>`; ZIP when exporting all',target:'any destination; export settings match the compressor',support:'full',
   evidence:['src/app.js (toolDock, crop presets, resize ratio lock, saveImages)','src/compression.js (export encoder)','src/capability-copy.js image guide'],
   external:[]},
  en:{
   answer:'The image editor is for several steps on one picture before saving once: crop (free, 1:1, 4:3, 16:9 or exact pixels), resize, rotate 90°, flip, trim transparent margins, add a 1 px outline, fill the background, remove a background or enlarge 2×/4×, then export as PNG, JPG or WebP — optionally to a target size, and for all open images at once as a ZIP. Everything runs in your browser and the original file is never changed. If you need only one step, the single-task pages ([[image/compress|compress]], [[image/convert|convert]], [[image/resize|resize]], [[image/crop|crop]]) are quicker.',
   concept:{title:'A working copy, edited in order, encoded once',body:[
    'Each edit is applied to a working copy of the picture in the order you make it; Undo steps back and "Restore original" returns to the file as opened. Because every step resamples or cuts real pixels, the order matters: crop first, then resize, then export — resizing a whole photo and cropping afterwards throws away detail you paid for.',
    'Export uses the same encoder as the compressor: Auto, PNG, JPG or WebP (AVIF only where the browser can encode it), quality 25–100 (92 by default), an optional target size in KB, a maximum width, the JPG background colour and "Allow further resizing to meet the limit". PNG is the default. With several images open, "Apply export settings to all images" saves one ZIP; images that miss the target are left out and counted in the message.'],
    terms:[['Working copy','The edited picture in memory; the file on your disk is untouched.'],['Crop preset','A centred box of the chosen ratio, 80 % of the width or height, which you can then drag or type in pixels.'],['Target KB','Optional ceiling for the exported file, searched like on the compress pages.']]},
   example:{title:'A 4032 × 3024 photo to a 1920 × 1080 banner under 200 KB',lead:'The numbers follow the editor\'s code: the 16:9 preset box, the locked-ratio resize and the export ceiling. The source size is an example of a 12-megapixel phone photo.',lines:[
    'Open             4032 x 3024',
    'Crop 16:9        w = 4032 x 0.8 = 3225.6 -> 3226,   h = 3225.6 / (16/9) = 1814.4 -> 1814',
    '                 x = (4032 - 3225.6) / 2 = 403.2 -> 403,   y = (3024 - 1814.4) / 2 = 604.8 -> 605',
    'Resize           width 1920, ratio locked: 1920 x 1814 / 3226 = 1079.6 -> 1080',
    'Export           JPG, target 200 KB = 204,800 bytes',
    'File             photo-edited.jpg, 1920 x 1080'],
    after:'Drag the crop box before applying if the subject is not centred; the X, Y, width and height fields take exact pixels, and arrow keys move it by 1 px (Shift: 10 px).'},
   verify:{steps:[
    'After export, open the saved file and check its pixel size and format — the file name ends in `-edited`.',
    'If you used a target size, the success message lists the saved size; with "all images", it also says how many missed the target.',
    'Keep the original: edits are not written back to it.']},
   trouble:{rows:[
    ['Some images are missing from the ZIP','They could not reach the target size and were left out','The message counts them','Raise the target, allow extra shrink, or export those separately'],
    ['The export is a PNG and far too big','PNG is the default export format','File name ends in `.png`','Choose JPG or WebP, or Auto'],
    ['Transparent areas turned white','JPG export fills transparency with the JPG background colour','Output format is JPG','Export PNG or WebP, or change the JPG background'],
    ['The photo lost sharpness','It was resized and then cropped, or enlarged 2×/4×','Check the order of your edits','Undo, crop first, then resize; enlargement adds pixels, not detail']]},
   alternatives:{rows:[
    ['[[image/crop|Crop]]','Only framing is needed: aspect and platform presets, straightening, a circle shape and the same crop for many files.'],
    ['[[image/resize/youtube-banner|Platform resize presets]]','You need an exact platform size with a centred crop in one step.'],
    ['[[image/compress|Compress]]','Only the file size matters; it compares formats and qualities for you.']]},
   limits:['Edits are pixel operations on one working copy; there are no layers, text or drawing tools for images.','EXIF is not written to exports, and animated images are refused.'],
   versions:{body:['Behaviour taken from `src/app.js` (tool dock, crop presets, resize ratio lock, export and ZIP) and the shared encoder in `src/compression.js` in this repository version. No external program is involved, so no outside documentation is cited.'],sources:[]}
  },
  ko:{
   answer:'이미지 편집기는 한 그림에 여러 단계를 적용한 뒤 한 번에 저장할 때 씁니다. 자르기(자유, 1:1, 4:3, 16:9, 정확한 픽셀), 크기 변경, 90° 회전, 좌우 반전, 투명 여백 잘라내기, 1px 외곽선, 배경색 채우기, 배경 제거, 2배·4배 확대를 한 뒤 PNG·JPG·WebP로 내보냅니다. 목표 용량을 정할 수도 있고, 열린 이미지 전체를 ZIP 하나로 저장할 수도 있습니다. 모든 작업은 브라우저에서 이뤄지며 원본 파일은 바뀌지 않습니다. 한 단계만 필요하다면 [[image/compress|압축]], [[image/convert|변환]], [[image/resize|크기 변경]], [[image/crop|자르기]] 같은 단일 작업 페이지가 더 빠릅니다.',
   concept:{title:'작업 사본을 순서대로 편집하고 한 번 인코딩',body:[
    '편집은 적용한 순서대로 그림의 작업 사본에 반영됩니다. 되돌리기로 한 단계씩 돌아가고, "원본으로 되돌리기"는 처음 연 파일 상태로 돌아갑니다. 단계마다 실제 픽셀을 다시 계산하거나 잘라내므로 순서가 중요합니다. 먼저 자르고, 그다음 크기를 바꾸고, 마지막에 내보내세요. 사진 전체를 줄인 뒤 자르면 아까운 디테일을 버리게 됩니다.',
    '내보내기는 압축 도구와 같은 인코더를 씁니다. 자동·PNG·JPG·WebP(AVIF는 브라우저가 인코딩할 수 있을 때만), 화질 25~100(기본 92), 선택형 목표 용량(KB), 최대 너비, JPG 배경색, "용량이 넘으면 추가 축소 허용"을 고릅니다. 기본 형식은 PNG입니다. 여러 이미지를 열었다면 "모든 이미지에 저장 설정 적용"으로 ZIP 하나를 저장하며, 목표를 못 맞춘 이미지는 빠지고 메시지에 개수가 표시됩니다.'],
    terms:[['작업 사본','메모리에 있는 편집 중인 그림. 디스크의 파일은 그대로입니다.'],['자르기 프리셋','선택한 비율로 너비나 높이의 80%를 차지하는 가운데 상자. 끌거나 픽셀로 입력해 조정합니다.'],['목표 KB','내보낼 파일의 선택형 상한. 압축 페이지와 같은 방식으로 탐색합니다.']]},
   example:{title:'4032 × 3024 사진을 200KB 이하의 1920 × 1080 배너로',lead:'숫자는 편집기 코드를 따릅니다: 16:9 프리셋 상자, 비율 고정 크기 변경, 내보내기 상한. 원본 크기는 1,200만 화소 휴대폰 사진의 예입니다.',lines:[
    '열기             4032 x 3024',
    '16:9로 자르기    w = 4032 x 0.8 = 3225.6 -> 3226,   h = 3225.6 / (16/9) = 1814.4 -> 1814',
    '                 x = (4032 - 3225.6) / 2 = 403.2 -> 403,   y = (3024 - 1814.4) / 2 = 604.8 -> 605',
    '크기 변경        너비 1920, 비율 유지: 1920 x 1814 / 3226 = 1079.6 -> 1080',
    '내보내기         JPG, 목표 200KB = 204,800 바이트',
    '파일             photo-edited.jpg, 1920 x 1080'],
    after:'피사체가 가운데에 있지 않다면 적용하기 전에 자르기 상자를 끌어 옮기세요. X·Y·너비·높이 칸에 정확한 픽셀을 입력할 수 있고, 방향키로 1px(Shift: 10px)씩 움직입니다.'},
   verify:{steps:[
    '내보낸 뒤 저장된 파일을 열어 픽셀 크기와 형식을 확인하세요. 파일 이름은 `-edited`로 끝납니다.',
    '목표 용량을 썼다면 완료 메시지에 저장된 크기가 나오고, 전체 이미지 저장이라면 목표를 못 맞춘 개수도 나옵니다.',
    '원본을 보관하세요. 편집 내용은 원본에 다시 쓰이지 않습니다.']},
   trouble:{rows:[
    ['ZIP에 일부 이미지가 없음','목표 용량을 맞추지 못해 제외됐습니다','메시지에 개수가 표시됨','목표를 늘리거나 추가 축소를 허용하거나, 그 이미지만 따로 내보내세요'],
    ['내보낸 파일이 PNG이고 너무 큼','기본 내보내기 형식이 PNG입니다','파일 이름이 `.png`로 끝남','JPG·WebP나 자동을 고르세요'],
    ['투명한 부분이 흰색이 됨','JPG 내보내기는 투명 부분을 JPG 배경색으로 채웁니다','저장 형식이 JPG','PNG나 WebP로 내보내거나 JPG 배경색을 바꾸세요'],
    ['사진이 선명도를 잃음','크기를 바꾼 뒤 잘랐거나 2배·4배로 확대했습니다','편집 순서 확인','되돌린 뒤 먼저 자르고 크기를 바꾸세요. 확대는 픽셀을 늘릴 뿐 디테일을 만들지 않습니다']]},
   alternatives:{rows:[
    ['[[image/crop|자르기]]','구도만 잡으면 될 때. 비율·플랫폼 프리셋, 수평 맞추기, 원형 모양, 여러 파일에 같은 영역 적용.'],
    ['[[image/resize/youtube-banner|플랫폼 크기 프리셋]]','가운데 기준 자르기와 함께 정확한 플랫폼 크기가 한 번에 필요할 때.'],
    ['[[image/compress|압축]]','파일 크기만 중요할 때. 형식과 화질을 대신 비교합니다.']]},
   limits:['편집은 작업 사본 하나에 대한 픽셀 처리이며, 이미지용 레이어·글자·그리기 도구는 없습니다.','내보낸 파일에는 EXIF가 기록되지 않고 움직이는 이미지는 거부합니다.'],
   versions:{body:['동작은 이 저장소 버전의 `src/app.js`(도구 막대, 자르기 프리셋, 비율 고정 크기 변경, 내보내기와 ZIP)와 공용 인코더 `src/compression.js`에서 가져왔습니다. 외부 프로그램이 관여하지 않으므로 외부 문서는 인용하지 않았습니다.'],sources:[]}
  },
  ja:{
   answer:'画像エディターは、1枚の画像に複数の処理をしてから1回で保存したいときに使います。切り抜き（自由、1:1、4:3、16:9、正確なピクセル指定）、サイズ変更、90°回転、左右反転、透明な余白の切り取り、1pxの輪郭線、背景色の塗りつぶし、背景除去、2倍・4倍の拡大を行い、PNG・JPG・WebPで書き出します。目標サイズも指定でき、開いている画像をまとめてZIP 1つで保存することもできます。処理はすべてブラウザ内で行い、元のファイルは変わりません。1つの処理だけなら、[[image/compress|圧縮]]、[[image/convert|変換]]、[[image/resize|サイズ変更]]、[[image/crop|切り抜き]]などの単機能ページのほうが早く済みます。',
   concept:{title:'作業用コピーを順に編集し、1回だけエンコード',body:[
    '編集は行った順に画像の作業用コピーへ反映されます。元に戻すで1段階ずつ戻り、「原本に戻す」で開いたときのファイルの状態に戻ります。各処理は実際のピクセルを計算し直したり切り取ったりするので、順番が大切です。先に切り抜き、次にサイズ変更、最後に書き出します。写真全体を縮小してから切り抜くと、せっかくの細部を捨てることになります。',
    '書き出しは圧縮ツールと同じエンコーダーを使います。自動・PNG・JPG・WebP（AVIFはブラウザがエンコードできる場合のみ）、画質25〜100（初期値92）、任意の目標サイズ（KB）、最大幅、JPGの背景色、「容量を超える場合は追加の縮小を許可」を選びます。初期の形式はPNGです。複数の画像を開いているときは「全画像に保存設定を適用」でZIP 1つに保存し、目標に届かなかった画像は除外されて件数がメッセージに表示されます。'],
    terms:[['作業用コピー','メモリ上で編集中の画像。ディスク上のファイルはそのままです。'],['切り抜きのプリセット','選んだ比率で幅か高さの80%を占める中央の枠。ドラッグやピクセル入力で調整します。'],['目標KB','書き出すファイルの任意の上限。圧縮ページと同じ方法で探索します。']]},
   example:{title:'4032 × 3024の写真を200KB以下の1920 × 1080のバナーに',lead:'数値はエディターのコードに従っています：16:9プリセットの枠、比率固定のサイズ変更、書き出しの上限。元のサイズは1,200万画素のスマホ写真の例です。',lines:[
    '開く             4032 x 3024',
    '16:9で切り抜き   w = 4032 x 0.8 = 3225.6 -> 3226,   h = 3225.6 / (16/9) = 1814.4 -> 1814',
    '                 x = (4032 - 3225.6) / 2 = 403.2 -> 403,   y = (3024 - 1814.4) / 2 = 604.8 -> 605',
    'サイズ変更       幅1920、比率固定: 1920 x 1814 / 3226 = 1079.6 -> 1080',
    '書き出し         JPG、目標200KB = 204,800 バイト',
    'ファイル         photo-edited.jpg、1920 x 1080'],
    after:'被写体が中央にないなら、適用する前に切り抜き枠をドラッグします。X・Y・幅・高さの欄には正確なピクセルを入力でき、矢印キーで1px（Shiftで10px）ずつ動かせます。'},
   verify:{steps:[
    '書き出し後、保存したファイルを開いてピクセルサイズと形式を確認します。ファイル名は `-edited` で終わります。',
    '目標サイズを使った場合、完了メッセージに保存した容量が出て、すべての画像を保存した場合は目標に届かなかった件数も出ます。',
    '元のファイルは保管しておきます。編集内容は元ファイルに書き戻されません。']},
   trouble:{rows:[
    ['ZIPに一部の画像がない','目標サイズに届かず除外された','メッセージに件数が表示される','目標を上げるか追加の縮小を許可するか、その画像だけ別に書き出します'],
    ['書き出したファイルがPNGで大きすぎる','初期の書き出し形式がPNG','ファイル名が `.png` で終わる','JPG・WebPか自動を選びます'],
    ['透明部分が白くなった','JPGの書き出しは透明部分をJPGの背景色で塗る','保存形式がJPG','PNGかWebPで書き出すか、JPGの背景色を変えます'],
    ['写真のシャープさが落ちた','サイズ変更してから切り抜いた、または2倍・4倍に拡大した','編集の順番を確認','元に戻して、先に切り抜いてからサイズを変えます。拡大はピクセルを増やすだけで細部は生みません']]},
   alternatives:{rows:[
    ['[[image/crop|切り抜き]]','構図だけ決めればよい場合。比率・各サービスのプリセット、水平調整、円形、複数ファイルへの同じ範囲の適用。'],
    ['[[image/resize/youtube-banner|各サービス向けサイズのプリセット]]','中央基準の切り抜きと正確なサービス用サイズを1回で済ませたい場合。'],
    ['[[image/compress|圧縮]]','ファイルサイズだけが問題の場合。形式と画質を代わりに比べます。']]},
   limits:['編集は1つの作業用コピーに対するピクセル処理で、画像用のレイヤー・文字・描画ツールはありません。','書き出したファイルにEXIFは書き込まれず、アニメーション画像は拒否します。'],
   versions:{body:['動作はこのリポジトリの版の `src/app.js`（ツールバー、切り抜きプリセット、比率固定のサイズ変更、書き出しとZIP）と共通のエンコーダー `src/compression.js` から取っています。外部のプログラムは関わらないため、外部の文書は引用していません。'],sources:[]}
  }
 },
 'image/resize':{
  type:'tool',
  intent:{primary:'resize an image to exact pixel dimensions or a percentage',secondary:['keep aspect ratio','fit versus fill versus stretch','resize without making it bigger'],
   goal:'an image at the exact width and height needed, without distortion or unexpected enlargement',input:'PNG, JPG, WebP, AVIF, BMP, HEIC (still, several at once)',output:'`<name>-<w>x<h>.<ext>` in the original format (PNG/JPG/WebP) or a chosen one',target:'forms, web pages, thumbnails',support:'full',
   evidence:['src/task/resize.js (target(), fit modes, noEnlarge)','src/image.js fitQuality','src/resample.js (Pica 10.0.3, mks2013)'],
   external:[]},
  en:{
   answer:'Resizing changes how many pixels an image has. Enter a percentage, or a width and/or height in pixels: one side alone keeps the proportions (a 4032 × 3024 photo at width 1080 becomes 1080 × 810); both sides use a fit mode — fit inside, fill and crop the overflow, or stretch. By default Nerulio never makes an image larger than the original when you size by one side or stretch, keeps PNG, JPG and WebP in their format, and resamples with Pica\'s mks2013 filter. Platform presets (Instagram, YouTube, X, LinkedIn, Discord) are one click away under Advanced.',
   concept:{title:'Percent, one side, or both sides',body:[
    'By percent scales both sides by the same factor and rounds: 50 % of 4032 × 3024 is 2016 × 1512. By pixels with one side empty keeps the ratio: height = round(3024 × 1080 ÷ 4032) = 810. With both sides filled the picture usually has a different ratio from the box, so a fit mode decides what happens to the difference.',
    'Fit inside (contain, the default) scales the whole picture into the box and centres it; the leftover strips are transparent in PNG/WebP, or filled with the margin colour, and white in JPG. Fill and crop (cover) scales until the box is full and cuts the overflow from both sides equally. Stretch ignores the ratio and distorts. "Never make images larger than the original" is on by default, but it only applies to percent, one-side and stretch sizing — fit and fill can enlarge a small image to reach the box.'],
    terms:[['Contain (fit inside)','Whole picture visible; margins where the ratios differ.'],['Cover (fill and crop)','Box completely filled; the centred overflow is cut off.'],['mks2013','Magic Kernel Sharp 2013, the Pica resampling filter used for every resize here.']]},
   example:{title:'One 4032 × 3024 photo, five ways (computed from the code)',lead:'Source size is an example 12-megapixel photo; the results follow `target()` and `fitQuality()` in the resize task.',lines:[
    '50 %                      -> 2016 x 1512',
    'width 1080 only           -> 1080 x 810     (3024 x 1080 / 4032 = 810)',
    '1080 x 1080, contain      -> picture 1080 x 810, centred, 135 px margin top and bottom',
    '1080 x 1080, cover        -> centre 3024 x 3024 cut out, scaled to 1080 x 1080',
    '1080 x 1080, stretch      -> 1080 x 1080, faces squashed by 25 %',
    '',
    'width 1200 on an 800 x 600 image, "never larger" on -> stays 800 x 600'],
    after:'Files are named after the result, e.g. `photo-1080x810.jpg`. Several files dropped together are resized with the same settings and can be saved as one ZIP.'},
   verify:{steps:[
    'The result list shows each file\'s new pixel size ("4032×3024 → 1080×810"); check it against what the destination asks for.',
    'With contain, look at the margins: transparent in PNG, white (or your margin colour) in JPG.',
    'With cover, check that nothing important was cut at the sides or the top and bottom.']},
   trouble:{rows:[
    ['The height changed although I typed only a width','One side alone keeps the original ratio','The result is e.g. 1080 × 810','Type both sides and pick a fit mode'],
    ['The image did not get bigger','"Never make images larger" limits percent, one-side and stretch sizing','The source is smaller than the requested size','Untick it under Advanced; enlarging adds no detail'],
    ['White or transparent bars appeared','Contain keeps the whole picture inside a box of another ratio','Result has margins','Choose cover to fill the box, or pick a margin colour'],
    ['Heads are cut off','Cover crops from the centre','Compare with the source','Frame it first with [[image/crop|crop]], then resize']]},
   alternatives:{rows:[
    ['[[image/crop|Crop]]','You need to choose which part stays (not always the centre) or rotate and straighten.'],
    ['[[image/compress|Compress]] with a Max width','The goal is a smaller file; it resizes and compresses in one step.'],
    ['[[game/pixel-art-upscaler|Pixel art upscaler]]','Pixel art must be enlarged with hard edges (whole-number nearest-neighbour), not smoothed.']]},
   limits:['Resampling is always smooth (mks2013); pixel art should use a nearest-neighbour tool instead.','JPG and WebP output use a fixed quality of 0.92; EXIF is not written.'],
   versions:{body:['Behaviour from `src/task/resize.js`, `fitQuality()` in `src/image.js` and `src/resample.js` (Pica 10.0.3 with the mks2013 filter) in this repository version; the arithmetic above follows that code.'],sources:[]}
  },
  ko:{
   answer:'크기 변경은 이미지의 픽셀 수를 바꾸는 작업입니다. 비율(%)이나 너비·높이 픽셀을 입력하세요. 한쪽만 입력하면 비율이 유지되고(4032 × 3024 사진에 너비 1080이면 1080 × 810), 양쪽을 모두 입력하면 맞춤 방식이 적용됩니다. 전체가 보이게 맞춤, 꽉 채우고 넘치는 부분 자르기, 늘리기 중 하나입니다. Nerulio는 기본적으로 한쪽 크기 지정이나 늘리기에서 원본보다 크게 만들지 않고, PNG·JPG·WebP는 원래 형식을 유지하며, Pica의 mks2013 필터로 다시 샘플링합니다. 인스타그램·유튜브·X·링크드인·디스코드 프리셋은 고급 설정에 있습니다.',
   concept:{title:'비율, 한쪽, 또는 양쪽',body:[
    '비율로 바꾸면 두 변에 같은 배율을 곱하고 반올림합니다. 4032 × 3024의 50%는 2016 × 1512입니다. 픽셀로 바꾸면서 한쪽을 비우면 비율이 유지됩니다. 높이 = round(3024 × 1080 ÷ 4032) = 810입니다. 양쪽을 모두 채우면 그림과 상자의 비율이 대개 달라서, 맞춤 방식이 그 차이를 어떻게 처리할지 정합니다.',
    '전체가 보이게 맞춤(contain, 기본값)은 그림 전체를 상자 안에 넣고 가운데에 둡니다. 남는 띠는 PNG·WebP에서는 투명하거나 여백 색으로 채워지고, JPG에서는 흰색입니다. 꽉 채우고 넘치는 부분 자르기(cover)는 상자가 가득 찰 때까지 키운 뒤 넘친 부분을 양쪽에서 똑같이 잘라냅니다. 늘리기는 비율을 무시해 왜곡됩니다. "원본보다 크게 만들지 않기"는 기본으로 켜져 있지만 비율·한쪽·늘리기에만 적용되며, 맞춤과 채우기는 상자에 맞추려고 작은 이미지를 키울 수 있습니다.'],
    terms:[['Contain(전체가 보이게 맞춤)','그림 전체가 보이며 비율이 다르면 여백이 생깁니다.'],['Cover(채우고 자르기)','상자를 가득 채우고 가운데 기준으로 넘친 부분을 잘라냅니다.'],['mks2013','Magic Kernel Sharp 2013. 여기서 모든 크기 변경에 쓰는 Pica 리샘플링 필터.']]},
   example:{title:'4032 × 3024 사진 한 장, 다섯 가지 방법(코드로 계산)',lead:'원본 크기는 1,200만 화소 사진의 예이며, 결과는 크기 변경 작업의 `target()`과 `fitQuality()`를 따릅니다.',lines:[
    '50 %                      -> 2016 x 1512',
    '너비 1080만               -> 1080 x 810     (3024 x 1080 / 4032 = 810)',
    '1080 x 1080, contain      -> 그림 1080 x 810, 가운데, 위아래 여백 135 px',
    '1080 x 1080, cover        -> 가운데 3024 x 3024를 잘라 1080 x 1080으로',
    '1080 x 1080, 늘리기       -> 1080 x 1080, 얼굴이 25 % 눌림',
    '',
    '800 x 600 이미지에 너비 1200, "크게 만들지 않기" 켬 -> 800 x 600 그대로'],
    after:'파일 이름은 결과 크기를 따릅니다. 예: `photo-1080x810.jpg`. 여러 파일을 한꺼번에 놓으면 같은 설정으로 바뀌고 ZIP 하나로 저장할 수 있습니다.'},
   verify:{steps:[
    '결과 목록에 파일마다 새 픽셀 크기("4032×3024 → 1080×810")가 나옵니다. 받는 곳이 요구하는 크기와 비교하세요.',
    'contain이라면 여백을 보세요. PNG에서는 투명, JPG에서는 흰색(또는 지정한 여백 색)입니다.',
    'cover라면 양옆이나 위아래에서 중요한 부분이 잘리지 않았는지 확인하세요.']},
   trouble:{rows:[
    ['너비만 입력했는데 높이도 바뀜','한쪽만 입력하면 원래 비율을 유지합니다','결과가 예: 1080 × 810','양쪽을 입력하고 맞춤 방식을 고르세요'],
    ['이미지가 커지지 않음','"원본보다 크게 만들지 않기"가 비율·한쪽·늘리기를 제한합니다','원본이 요청 크기보다 작음','고급에서 해제하세요. 확대해도 디테일은 늘지 않습니다'],
    ['흰색이나 투명한 띠가 생김','contain은 다른 비율의 상자 안에 그림 전체를 넣습니다','결과에 여백이 있음','상자를 채우려면 cover를 고르거나 여백 색을 정하세요'],
    ['머리가 잘림','cover는 가운데 기준으로 자릅니다','원본과 비교','먼저 [[image/crop|자르기]]로 구도를 잡은 뒤 크기를 바꾸세요']]},
   alternatives:{rows:[
    ['[[image/crop|자르기]]','가운데가 아닌 부분을 남기거나 회전·수평 맞추기가 필요할 때.'],
    ['최대 너비를 지정해 [[image/compress|압축]]','목적이 작은 파일일 때. 크기 변경과 압축을 한 번에 합니다.'],
    ['[[game/pixel-art-upscaler|도트 그림 확대]]','도트 그림을 부드럽게가 아니라 정수배 최근접 방식으로 선명하게 키워야 할 때.']]},
   limits:['리샘플링은 항상 부드러운 방식(mks2013)입니다. 도트 그림은 최근접 방식 도구를 쓰세요.','JPG·WebP 출력은 화질 0.92로 고정이며 EXIF는 기록하지 않습니다.'],
   versions:{body:['동작은 이 저장소 버전의 `src/task/resize.js`, `src/image.js`의 `fitQuality()`, `src/resample.js`(Pica 10.0.3, mks2013 필터)에서 가져왔고, 위 계산은 그 코드를 따릅니다.'],sources:[]}
  },
  ja:{
   answer:'サイズ変更は画像のピクセル数を変える処理です。割合（%）か、幅・高さのピクセルを入力します。片方だけなら比率が保たれ（4032 × 3024の写真で幅1080なら1080 × 810）、両方入れると合わせ方が適用されます。全体が見えるように収める、埋めてはみ出しを切り取る、伸ばす、の3つです。Nerulioは初期設定で、片方指定や伸ばすときに元より大きくせず、PNG・JPG・WebPは元の形式を保ち、Picaのmks2013フィルターでリサンプリングします。Instagram・YouTube・X・LinkedIn・Discordのプリセットは詳細設定にあります。',
   concept:{title:'割合、片方、または両方',body:[
    '割合では両辺に同じ倍率を掛けて丸めます。4032 × 3024の50%は2016 × 1512です。ピクセル指定で片方を空けると比率が保たれ、高さ = round(3024 × 1080 ÷ 4032) = 810になります。両方を入れると、画像と枠の比率はたいてい違うので、その差をどう扱うかを合わせ方で決めます。',
    '全体が見えるように収める（contain、初期値）は画像全体を枠に入れて中央に置きます。余る帯はPNG・WebPでは透明か余白の色、JPGでは白になります。埋めてはみ出しを切り取る（cover）は枠が埋まるまで拡大し、はみ出した分を両側から均等に切り取ります。伸ばすは比率を無視してゆがめます。「元より大きくしない」は初期設定でオンですが、割合・片方・伸ばすにだけ効き、収める・埋めるでは枠に合わせるために小さな画像を拡大することがあります。'],
    terms:[['Contain（収める）','画像全体が見え、比率が違えば余白ができます。'],['Cover（埋めて切り取る）','枠を完全に埋め、中央基準ではみ出した部分を切り取ります。'],['mks2013','Magic Kernel Sharp 2013。ここでのすべてのサイズ変更に使うPicaのリサンプリングフィルター。']]},
   example:{title:'4032 × 3024の写真1枚を5通りに（コードから計算）',lead:'元のサイズは1,200万画素の写真の例で、結果はサイズ変更タスクの `target()` と `fitQuality()` に従います。',lines:[
    '50 %                      -> 2016 x 1512',
    '幅1080のみ                -> 1080 x 810     （3024 x 1080 / 4032 = 810）',
    '1080 x 1080、contain      -> 画像 1080 x 810、中央、上下に135 pxの余白',
    '1080 x 1080、cover        -> 中央の3024 x 3024を切り出し 1080 x 1080に',
    '1080 x 1080、伸ばす       -> 1080 x 1080、顔が25 %つぶれる',
    '',
    '800 x 600の画像に幅1200、「元より大きくしない」オン -> 800 x 600のまま'],
    after:'ファイル名は結果のサイズになります。例：`photo-1080x810.jpg`。複数のファイルをまとめて入れると同じ設定で変換され、ZIP 1つで保存できます。'},
   verify:{steps:[
    '結果一覧にファイルごとの新しいピクセルサイズ（「4032×3024 → 1080×810」）が出ます。提出先の求めるサイズと比べます。',
    'containなら余白を見ます。PNGでは透明、JPGでは白（または指定した余白の色）です。',
    'coverなら、左右や上下で大事な部分が切れていないか確認します。']},
   trouble:{rows:[
    ['幅だけ入れたのに高さも変わった','片方だけだと元の比率を保つ','結果が例：1080 × 810','両方を入力し、合わせ方を選びます'],
    ['画像が大きくならない','「元より大きくしない」が割合・片方・伸ばすを制限している','元画像が指定サイズより小さい','詳細設定で外します。拡大しても細部は増えません'],
    ['白や透明の帯が出た','containは比率の違う枠に画像全体を収める','結果に余白がある','枠を埋めるならcoverを選ぶか、余白の色を指定します'],
    ['頭が切れた','coverは中央基準で切り取る','元画像と比べる','先に[[image/crop|切り抜き]]で構図を決めてからサイズを変えます']]},
   alternatives:{rows:[
    ['[[image/crop|切り抜き]]','中央以外の部分を残したい、回転や水平調整もしたい場合。'],
    ['最大幅を指定して[[image/compress|圧縮]]','目的が小さなファイルの場合。サイズ変更と圧縮を一度に行います。'],
    ['[[game/pixel-art-upscaler|ドット絵の拡大]]','ドット絵をなめらかにではなく、整数倍のニアレストネイバーでくっきり拡大したい場合。']]},
   limits:['リサンプリングは常になめらかな方式（mks2013）です。ドット絵にはニアレストネイバーのツールを使います。','JPG・WebPの出力は画質0.92固定で、EXIFは書き込みません。'],
   versions:{body:['動作はこのリポジトリの版の `src/task/resize.js`、`src/image.js` の `fitQuality()`、`src/resample.js`（Pica 10.0.3、mks2013フィルター）から取り、上の計算はそのコードに従っています。'],sources:[]}
  }
 },
 'image/resize/instagram-post':{
  type:'tool',
  intent:{primary:'resize a photo for an Instagram square post (1080 × 1080)',secondary:['Instagram post size','square crop from a landscape photo','why Instagram crops my photo'],
   goal:'a 1080 × 1080 image Instagram keeps at full width without cropping it again',input:'any still photo or graphic',output:'1080 × 1080 image (`<name>-1080x1080.<ext>`), centre-cropped by default',target:'Instagram feed post',support:'full',
   evidence:['src/landings.js SOCIAL instagram-post','src/task/resize.js (fit=cover)','src/image.js fitQuality'],
   external:['Instagram Help Center 1631821640426723, checked 2026-09-28']},
  en:{
   answer:'This preset makes a 1080 × 1080 square. Instagram\'s Help Center (checked 2026-09-28) says photos are shared up to 1080 px wide and kept at their resolution when the ratio is between 1.91:1 and 3:4; 1:1 is inside that range, so a 1080-px square is not resized or cropped again. Nerulio fills the square by cutting the centre out of your photo — from a 4032 × 3024 landscape that is the middle 3024 × 3024, a quarter of the width lost — or, with Fit inside, keeps the whole photo with margins.',
   concept:{title:'What Instagram does with a square, and what the preset does',body:[
    'According to Instagram\'s help page, a photo narrower than 320 px is enlarged to 320, a wider one than 1080 is reduced to 1080, and a ratio outside 1.91:1–3:4 is cropped to a supported one. The page recommends uploading at least 1080 px wide. It does not name 1080 × 1080 as a required size; the square is simply one ratio Instagram keeps untouched.',
    'The preset uses cover: the largest centred square is cut from the photo and scaled to 1080. From a landscape 4:3 photo, 504 px are removed on each side; from a portrait 3:4 photo, 504 px at the top and bottom. Fit inside keeps everything and adds bars instead. A source smaller than 1080 px is enlarged — Instagram would do the same, and neither adds detail.'],
    terms:[['1:1','Square; width equals height.'],['Cover (preset default)','Fills the square and cuts the centred overflow.'],['Supported ratio range','1.91:1 (wide) to 3:4 (tall) on Instagram\'s help page.']]},
   example:{title:'Square crops from two phone photos (computed from the code)',lead:'Example sources of 12 megapixels; the numbers follow the resize task\'s cover calculation.',lines:[
    'Landscape 4032 x 3024 -> crop x 504..3528, full height = 3024 x 3024',
    '                         scaled x 0.357 -> 1080 x 1080   (75 % of the photo kept)',
    'Portrait  3024 x 4032 -> crop y 504..3528, full width  = 3024 x 3024',
    '                         scaled x 0.357 -> 1080 x 1080   (75 % kept)',
    '',
    'Fit inside instead (landscape): picture 1080 x 810, bars 135 px top and bottom'],
    after:'If the subject is not in the middle, pick the square yourself with [[image/crop|crop]] (1:1 preset), then resize.'},
   verify:{steps:[
    'The result list shows `1080×1080`; the file name ends in `-1080x1080`.',
    'Check the edges of the square: anything important near the left and right of a landscape photo is gone.',
    'In Instagram\'s post preview the square should appear without a further crop.']},
   trouble:{rows:[
    ['The subject is cut in half','Cover takes the centre; the subject was off-centre','Compare the square with the original','Crop the square yourself with [[image/crop|crop]], then resize'],
    ['White bars in the post','Fit inside was chosen and the output is JPG','Output shows margins','Use the default fill, or pick a margin colour that suits the post'],
    ['The post looks soft','The source was smaller than 1080 px and was enlarged','Source size in the result line','Use a larger original; enlarging adds no detail'],
    ['I wanted the photo taller than square','A square is the shortest portrait ratio','—','Use [[image/resize/instagram-portrait|the portrait preset]] instead']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|Instagram portrait]]','Portrait photos: a 4:5 or 3:4 post shows more of the picture than a square.'],
    ['Instagram\'s own crop when posting','You are posting from the phone and do not need a file: the app crops to a supported ratio itself.']]},
   limits:['The crop is always centred; there is no subject detection.','Instagram\'s own processing after upload (compression, feed display) is outside Nerulio\'s control.'],
   versions:{body:['Instagram\'s behaviour is quoted from its Help Center page on photo resolution, read on 2026-09-28. The crop arithmetic follows `src/task/resize.js` and `fitQuality()` in `src/image.js`.'],sources:['[Instagram Help Center: Image resolution of photos you share on Instagram](https://help.instagram.com/1631821640426723)']}
  },
  ko:{
   answer:'이 프리셋은 1080 × 1080 정사각형을 만듭니다. 인스타그램 고객센터(2026-09-28 확인)에 따르면 사진은 최대 너비 1080px로 공유되고, 비율이 1.91:1에서 3:4 사이면 해상도가 유지됩니다. 1:1은 그 범위 안이므로 1080px 정사각형은 다시 줄거나 잘리지 않습니다. Nerulio는 사진 가운데를 잘라 정사각형을 채웁니다. 4032 × 3024 가로 사진이라면 가운데 3024 × 3024를 남기고 너비의 4분의 1을 버립니다. 전체가 보이게 맞춤을 고르면 사진 전체를 남기고 여백을 넣습니다.',
   concept:{title:'인스타그램이 정사각형을 다루는 방식과 프리셋의 동작',body:[
    '인스타그램 도움말에 따르면 너비 320px보다 좁은 사진은 320으로 키우고, 1080보다 넓은 사진은 1080으로 줄이며, 1.91:1~3:4 밖의 비율은 지원되는 비율로 자릅니다. 너비 1080px 이상으로 올리라고 권하지만 1080 × 1080을 필수 크기로 적어 두지는 않았습니다. 정사각형은 인스타그램이 손대지 않는 비율 중 하나일 뿐입니다.',
    '프리셋은 cover를 씁니다. 사진에서 가장 큰 가운데 정사각형을 잘라 1080으로 맞춥니다. 4:3 가로 사진이면 양옆에서 504px씩, 3:4 세로 사진이면 위아래에서 504px씩 잘립니다. 전체가 보이게 맞춤은 모두 남기고 대신 띠를 넣습니다. 1080px보다 작은 원본은 커지는데, 인스타그램도 마찬가지이며 어느 쪽도 디테일을 더하지는 않습니다.'],
    terms:[['1:1','정사각형. 너비와 높이가 같습니다.'],['Cover(프리셋 기본값)','정사각형을 채우고 가운데 기준으로 넘친 부분을 자릅니다.'],['지원 비율 범위','인스타그램 도움말 기준 1.91:1(가로로 긴)부터 3:4(세로로 긴)까지.']]},
   example:{title:'휴대폰 사진 두 장에서 정사각형 자르기(코드로 계산)',lead:'1,200만 화소 원본을 예로 들었고, 숫자는 크기 변경 작업의 cover 계산을 따릅니다.',lines:[
    '가로 4032 x 3024 -> x 504..3528 자르기, 높이 전체 = 3024 x 3024',
    '                    x 0.357 배율 -> 1080 x 1080   (사진의 75 % 유지)',
    '세로 3024 x 4032 -> y 504..3528 자르기, 너비 전체 = 3024 x 3024',
    '                    x 0.357 배율 -> 1080 x 1080   (75 % 유지)',
    '',
    '대신 전체가 보이게 맞춤(가로): 그림 1080 x 810, 위아래 띠 135 px'],
    after:'피사체가 가운데에 없다면 [[image/crop|자르기]](1:1 프리셋)로 정사각형을 직접 고른 뒤 크기를 바꾸세요.'},
   verify:{steps:[
    '결과 목록에 `1080×1080`이 나오고 파일 이름이 `-1080x1080`으로 끝납니다.',
    '정사각형 가장자리를 확인하세요. 가로 사진의 양옆 가까이에 있던 중요한 것은 사라졌습니다.',
    '인스타그램 게시물 미리보기에서 추가로 잘리지 않고 정사각형 그대로 보여야 합니다.']},
   trouble:{rows:[
    ['피사체가 반으로 잘림','cover는 가운데를 취하는데 피사체가 한쪽에 있었습니다','정사각형과 원본 비교','[[image/crop|자르기]]로 정사각형을 직접 고른 뒤 크기를 바꾸세요'],
    ['게시물에 흰 띠가 생김','전체가 보이게 맞춤을 골랐고 출력이 JPG입니다','결과에 여백이 있음','기본값인 채우기를 쓰거나 게시물에 어울리는 여백 색을 고르세요'],
    ['게시물이 흐릿함','원본이 1080px보다 작아 확대됐습니다','결과 줄의 원본 크기','더 큰 원본을 쓰세요. 확대는 디테일을 더하지 않습니다'],
    ['정사각형보다 세로로 긴 사진을 원함','정사각형은 세로 비율 중 가장 짧은 것입니다','—','[[image/resize/instagram-portrait|세로 게시물 프리셋]]을 쓰세요']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|인스타그램 세로 게시물]]','세로 사진. 4:5나 3:4 게시물이 정사각형보다 사진을 더 많이 보여 줍니다.'],
    ['게시할 때 인스타그램의 자체 자르기','휴대폰에서 바로 올리고 파일이 필요 없을 때. 앱이 지원 비율로 직접 자릅니다.']]},
   limits:['자르기는 항상 가운데 기준이며 피사체 인식은 없습니다.','업로드 후 인스타그램의 처리(압축, 피드 표시)는 Nerulio가 제어할 수 없습니다.'],
   versions:{body:['인스타그램의 동작은 2026-09-28에 읽은 사진 해상도 도움말 페이지를 인용했습니다. 자르기 계산은 `src/task/resize.js`와 `src/image.js`의 `fitQuality()`를 따릅니다.'],sources:['[Instagram 고객센터: 사진 해상도](https://help.instagram.com/1631821640426723)']}
  },
  ja:{
   answer:'このプリセットは1080 × 1080の正方形を作ります。Instagramヘルプセンター（2026-09-28確認）によると、写真は最大幅1080pxで共有され、比率が1.91:1から3:4の間なら解像度が保たれます。1:1はその範囲内なので、1080pxの正方形は縮小も再トリミングもされません。Nerulioは写真の中央を切り出して正方形を埋めます。4032 × 3024の横長写真なら中央の3024 × 3024を残し、幅の4分の1を捨てます。全体が見えるように収めるを選べば、写真全体を残して余白を入れます。',
   concept:{title:'Instagramが正方形をどう扱うか、プリセットが何をするか',body:[
    'Instagramのヘルプによれば、幅320px未満の写真は320に拡大、1080を超える写真は1080に縮小され、1.91:1〜3:4の範囲外の比率は対応する比率にトリミングされます。幅1080px以上でのアップロードを勧めていますが、1080 × 1080を必須サイズとしては挙げていません。正方形はInstagramが手を加えない比率の1つというだけです。',
    'プリセットはcoverを使い、写真から最大の中央の正方形を切り出して1080に合わせます。4:3の横長写真なら左右から504pxずつ、3:4の縦長写真なら上下から504pxずつ切られます。全体が見えるように収めるならすべてを残し、代わりに帯を入れます。1080pxより小さい元画像は拡大されますが、Instagramでも同じで、どちらも細部は増えません。'],
    terms:[['1:1','正方形。幅と高さが同じ。'],['Cover（プリセットの初期値）','正方形を埋め、中央基準ではみ出た部分を切り取ります。'],['対応する比率の範囲','Instagramのヘルプでは1.91:1（横長）から3:4（縦長）まで。']]},
   example:{title:'スマホ写真2枚から正方形を切り出す（コードから計算）',lead:'1,200万画素の元画像を例にし、数値はサイズ変更タスクのcoverの計算に従います。',lines:[
    '横長 4032 x 3024 -> x 504..3528を切り出し、高さ全体 = 3024 x 3024',
    '                    x 0.357倍 -> 1080 x 1080   （写真の75 %を残す）',
    '縦長 3024 x 4032 -> y 504..3528を切り出し、幅全体 = 3024 x 3024',
    '                    x 0.357倍 -> 1080 x 1080   （75 %を残す）',
    '',
    '代わりに収める（横長）: 画像 1080 x 810、上下に135 pxの帯'],
    after:'被写体が中央にないなら、[[image/crop|切り抜き]]（1:1のプリセット）で正方形を自分で選んでからサイズを変えます。'},
   verify:{steps:[
    '結果一覧に `1080×1080` と出て、ファイル名が `-1080x1080` で終わります。',
    '正方形の端を確認します。横長写真の左右の端近くにあった大事なものはなくなっています。',
    'Instagramの投稿プレビューで、それ以上切られずに正方形のまま表示されるはずです。']},
   trouble:{rows:[
    ['被写体が半分に切れた','coverは中央を取るが、被写体が片側にあった','正方形と元画像を比べる','[[image/crop|切り抜き]]で正方形を自分で選んでからサイズを変えます'],
    ['投稿に白い帯が出る','全体が見えるように収めるを選び、出力がJPG','結果に余白がある','初期値の埋めるを使うか、投稿に合う余白の色を選びます'],
    ['投稿がぼやける','元画像が1080pxより小さく拡大された','結果の行の元のサイズ','もっと大きな元画像を使います。拡大しても細部は増えません'],
    ['正方形より縦長にしたい','正方形は縦の比率の中で最も短い','—','[[image/resize/instagram-portrait|縦長投稿のプリセット]]を使います']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|Instagram縦長投稿]]','縦長の写真。4:5や3:4の投稿は正方形より写真を多く見せます。'],
    ['投稿時のInstagram自体のトリミング','スマホから直接投稿し、ファイルが不要な場合。アプリが対応比率に自分で切り取ります。']]},
   limits:['切り抜きは常に中央基準で、被写体の認識はありません。','アップロード後のInstagram側の処理（圧縮、フィードでの表示）はNerulioでは制御できません。'],
   versions:{body:['Instagramの動作は、2026-09-28に読んだ写真の解像度についてのヘルプページから引用しています。切り抜きの計算は `src/task/resize.js` と `src/image.js` の `fitQuality()` に従います。'],sources:['[Instagram ヘルプセンター: 写真の解像度](https://help.instagram.com/1631821640426723)']}
  }
 },
 'image/resize/instagram-portrait':{
  type:'tool',
  intent:{primary:'resize a photo for an Instagram portrait post (1080 × 1350, 4:5)',secondary:['Instagram portrait size','4:5 or 3:4 for Instagram','tallest Instagram post'],
   goal:'a portrait image Instagram keeps at 1080 px wide without cropping it',input:'any still photo, usually portrait',output:'1080 × 1350 (4:5) by default; 1080 × 1440 (3:4) if typed',target:'Instagram feed post',support:'full',
   evidence:['src/landings.js SOCIAL instagram-portrait (1080×1350)','src/task/resize.js (fit=cover)'],
   external:['Instagram Help Center 1631821640426723 (ratio 1.91:1–3:4, height 566–1440 at 1080 wide), checked 2026-09-28']},
  en:{
   answer:'This preset makes a 1080 × 1350 portrait (4:5). On 2026-09-28 Instagram\'s Help Center gave the supported range as 1.91:1 to 3:4 — at 1080 px wide, heights from 566 to 1440 — so 1350 is kept as it is. The page does not recommend 1350 in particular; the tallest ratio it lists is 3:4, which is 1080 × 1440: type 1440 in the height field for that. From a 3024 × 4032 phone portrait the preset keeps 94 % of the photo (126 px cut at top and bottom); a 3:4 output would keep all of it.',
   concept:{title:'4:5 or 3:4 — both inside Instagram\'s range',body:[
    'A phone held upright usually records 3:4 (3024 × 4032). Instagram\'s help page accepts portrait posts up to 3:4, so such a photo can be posted uncropped at 1080 × 1440. The 1080 × 1350 preset (4:5) is slightly shorter: cover trims the difference from the top and bottom equally.',
    'A landscape photo in a portrait box loses a lot: from 4032 × 3024 only the central 2419 × 3024 survives, 60 % of the picture. For such photos, either choose a square or frame the portrait area yourself before resizing. Photos with a ratio outside Instagram\'s range are cropped by Instagram itself, which is exactly what the preset avoids.'],
    terms:[['4:5','1080 × 1350; the preset.'],['3:4','1080 × 1440; the tallest ratio on Instagram\'s help page, and the usual phone portrait ratio.'],['Cover crop','Equal cut on both sides of the longer dimension.']]},
   example:{title:'Phone photos into 1080 × 1350 and 1080 × 1440 (computed from the code)',lead:'Example 12-megapixel sources; cover arithmetic from the resize task.',lines:[
    'Portrait 3024 x 4032 -> 1080 x 1350: crop 3024 x 3780 (126 px off top and bottom)',
    '                        94 % kept, scaled x 0.357',
    'Portrait 3024 x 4032 -> 1080 x 1440: whole photo, scaled x 0.357, nothing cut',
    '',
    'Landscape 4032 x 3024 -> 1080 x 1350: crop 2419 x 3024 (806 px off each side)',
    '                         60 % kept, scaled x 0.446'],
    after:'Instagram\'s page states the range as a ratio of the photo; a file of 1080 × 1440 is at the 3:4 limit, and anything taller would be cropped by Instagram.'},
   verify:{steps:[
    'The result list shows `1080×1350` (or `1080×1440` if you typed it).',
    'Compare the top and bottom with the original: heads and feet near the edges are where the 4:5 crop bites.',
    'In Instagram\'s preview the post should appear at full height without a further crop.']},
   trouble:{rows:[
    ['The top of the head is cut off','4:5 cover trims 126 px from the top of a 3:4 photo','Compare with the original','Type 1440 as height (3:4), or frame with [[image/crop|crop]] first'],
    ['A landscape photo became a narrow strip','Cover keeps only the central 2419 × 3024','Result shows the middle only','Use [[image/resize/instagram-post|the square preset]] or fit inside with margins'],
    ['Instagram still cropped the post','The file was taller than 3:4 (e.g. 9:16)','Check the result size','Keep the height at 1440 or less for 1080 px width'],
    ['The post is soft','The source had fewer than 1080 px across and was enlarged','Source size in the result line','Use the original camera file']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-post|Instagram square]]','Landscape photos, or when a grid of squares matters more than height.'],
    ['[[image/resize/instagram-story|Stories and Reels (9:16)]]','Full-screen vertical content rather than a feed post.']]},
   limits:['The preset stays at 1350; switching to 1440 is a manual edit of the height field.','Instagram\'s help page gives ranges, not a fixed recommended portrait size; it can change after the date checked.'],
   versions:{body:['Checked on Instagram\'s Help Center on 2026-09-28: widths 320–1080 are kept when the ratio is between 1.91:1 and 3:4 (height 566–1440 at 1080 wide). Crop numbers follow `src/task/resize.js` and `fitQuality()` in `src/image.js`.'],sources:['[Instagram Help Center: Image resolution of photos you share on Instagram](https://help.instagram.com/1631821640426723)']}
  },
  ko:{
   answer:'이 프리셋은 1080 × 1350 세로 이미지(4:5)를 만듭니다. 2026-09-28 인스타그램 고객센터는 지원 범위를 1.91:1부터 3:4까지로 안내했습니다. 너비 1080px에서 높이 566~1440이므로 1350은 그대로 유지됩니다. 다만 도움말이 1350을 특별히 권장하지는 않으며, 나열된 가장 세로로 긴 비율은 3:4, 즉 1080 × 1440입니다. 그 크기를 원하면 높이 칸에 1440을 입력하세요. 3024 × 4032 휴대폰 세로 사진에서 프리셋은 사진의 94%를 남기고(위아래 126px씩 자름), 3:4 출력이면 전부 남깁니다.',
   concept:{title:'4:5와 3:4 — 둘 다 인스타그램 범위 안',body:[
    '휴대폰을 세워 찍으면 보통 3:4(3024 × 4032)로 저장됩니다. 인스타그램 도움말은 세로 게시물을 3:4까지 받으므로 이런 사진은 1080 × 1440으로 자르지 않고 올릴 수 있습니다. 1080 × 1350 프리셋(4:5)은 조금 짧아서 cover가 그 차이를 위아래에서 똑같이 잘라냅니다.',
    '가로 사진을 세로 상자에 넣으면 많이 잃습니다. 4032 × 3024에서는 가운데 2419 × 3024, 사진의 60%만 남습니다. 이런 사진은 정사각형을 고르거나 크기를 바꾸기 전에 세로 영역을 직접 잡으세요. 인스타그램 범위를 벗어난 비율은 인스타그램이 직접 자르는데, 프리셋은 바로 그것을 피하려는 것입니다.'],
    terms:[['4:5','1080 × 1350. 프리셋 크기.'],['3:4','1080 × 1440. 인스타그램 도움말의 가장 세로로 긴 비율이자 휴대폰 세로 사진의 흔한 비율.'],['Cover 자르기','긴 쪽의 양 끝을 똑같이 잘라내는 방식.']]},
   example:{title:'휴대폰 사진을 1080 × 1350과 1080 × 1440으로(코드로 계산)',lead:'1,200만 화소 원본을 예로 들었고, 크기 변경 작업의 cover 계산입니다.',lines:[
    '세로 3024 x 4032 -> 1080 x 1350: 3024 x 3780 자르기 (위아래 126 px씩)',
    '                    94 % 유지, x 0.357 배율',
    '세로 3024 x 4032 -> 1080 x 1440: 사진 전체, x 0.357 배율, 잘림 없음',
    '',
    '가로 4032 x 3024 -> 1080 x 1350: 2419 x 3024 자르기 (양옆 806 px씩)',
    '                    60 % 유지, x 0.446 배율'],
    after:'인스타그램 도움말은 범위를 사진의 비율로 설명합니다. 1080 × 1440 파일은 3:4 한계에 딱 맞고, 그보다 세로로 길면 인스타그램이 자릅니다.'},
   verify:{steps:[
    '결과 목록에 `1080×1350`(또는 입력했다면 `1080×1440`)이 나옵니다.',
    '위아래를 원본과 비교하세요. 가장자리에 가까운 머리와 발이 4:5 자르기의 영향을 받습니다.',
    '인스타그램 미리보기에서 추가로 잘리지 않고 전체 높이로 보여야 합니다.']},
   trouble:{rows:[
    ['정수리가 잘림','4:5 cover가 3:4 사진의 위에서 126px을 잘랐습니다','원본과 비교','높이에 1440(3:4)을 입력하거나 먼저 [[image/crop|자르기]]로 구도를 잡으세요'],
    ['가로 사진이 좁은 띠가 됨','cover가 가운데 2419 × 3024만 남겼습니다','결과에 가운데만 남음','[[image/resize/instagram-post|정사각형 프리셋]]을 쓰거나 여백을 두고 맞춤을 쓰세요'],
    ['인스타그램이 그래도 잘랐음','파일이 3:4보다 세로로 길었습니다(예: 9:16)','결과 크기 확인','너비 1080px이면 높이를 1440 이하로 두세요'],
    ['게시물이 흐릿함','원본 가로 픽셀이 1080보다 적어 확대됐습니다','결과 줄의 원본 크기','카메라 원본 파일을 쓰세요']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-post|인스타그램 정사각형]]','가로 사진이거나, 높이보다 정사각형 격자가 중요할 때.'],
    ['[[image/resize/instagram-story|스토리·릴스(9:16)]]','피드 게시물이 아니라 전체 화면 세로 콘텐츠일 때.']]},
   limits:['프리셋은 1350에 고정되어 있고 1440으로 바꾸려면 높이 칸을 직접 고쳐야 합니다.','인스타그램 도움말은 고정 권장 크기가 아니라 범위를 제시하며, 확인한 날짜 이후 바뀔 수 있습니다.'],
   versions:{body:['2026-09-28 인스타그램 고객센터에서 확인: 비율이 1.91:1~3:4이면 너비 320~1080이 유지됩니다(너비 1080에서 높이 566~1440). 자르기 숫자는 `src/task/resize.js`와 `src/image.js`의 `fitQuality()`를 따릅니다.'],sources:['[Instagram 고객센터: 사진 해상도](https://help.instagram.com/1631821640426723)']}
  },
  ja:{
   answer:'このプリセットは1080 × 1350の縦長画像（4:5）を作ります。2026-09-28のInstagramヘルプセンターは対応範囲を1.91:1から3:4としており、幅1080pxで高さ566〜1440なので、1350はそのまま保たれます。ただしヘルプが1350を特に推奨しているわけではなく、挙げられている最も縦長の比率は3:4、つまり1080 × 1440です。その大きさにしたいなら高さの欄に1440と入力します。3024 × 4032のスマホの縦長写真なら、プリセットは写真の94%を残し（上下126pxずつ切る）、3:4の出力ならすべて残ります。',
   concept:{title:'4:5と3:4 — どちらもInstagramの範囲内',body:[
    'スマホを縦にして撮ると、ふつうは3:4（3024 × 4032）で保存されます。Instagramのヘルプは縦長投稿を3:4まで受け付けるので、こうした写真は1080 × 1440で切らずに投稿できます。1080 × 1350のプリセット（4:5）は少し短く、coverがその差を上下から均等に切り取ります。',
    '横長写真を縦長の枠に入れると多くを失います。4032 × 3024からは中央の2419 × 3024、写真の60%しか残りません。こうした写真は正方形を選ぶか、サイズを変える前に縦長の範囲を自分で決めます。Instagramの範囲外の比率はInstagram自身が切り取り、プリセットはまさにそれを避けるためのものです。'],
    terms:[['4:5','1080 × 1350。プリセットのサイズ。'],['3:4','1080 × 1440。Instagramのヘルプで最も縦長の比率で、スマホの縦長写真によくある比率。'],['Coverの切り抜き','長いほうの両端を均等に切る方式。']]},
   example:{title:'スマホ写真を1080 × 1350と1080 × 1440に（コードから計算）',lead:'1,200万画素の元画像を例にした、サイズ変更タスクのcoverの計算です。',lines:[
    '縦長 3024 x 4032 -> 1080 x 1350: 3024 x 3780を切り出し（上下126 pxずつ）',
    '                    94 %を残す、x 0.357倍',
    '縦長 3024 x 4032 -> 1080 x 1440: 写真全体、x 0.357倍、切り取りなし',
    '',
    '横長 4032 x 3024 -> 1080 x 1350: 2419 x 3024を切り出し（左右806 pxずつ）',
    '                    60 %を残す、x 0.446倍'],
    after:'Instagramのヘルプは範囲を写真の比率で説明しています。1080 × 1440のファイルは3:4の限界ちょうどで、それより縦長だとInstagramが切り取ります。'},
   verify:{steps:[
    '結果一覧に `1080×1350`（入力したなら `1080×1440`）と出ます。',
    '上下を元画像と比べます。端に近い頭や足が4:5の切り抜きの影響を受けます。',
    'Instagramのプレビューで、さらに切られずに全体の高さで表示されるはずです。']},
   trouble:{rows:[
    ['頭のてっぺんが切れた','4:5のcoverが3:4の写真の上から126pxを切った','元画像と比べる','高さに1440（3:4）を入れるか、先に[[image/crop|切り抜き]]で構図を決めます'],
    ['横長写真が細い帯になった','coverが中央の2419 × 3024だけを残した','結果に中央だけが残る','[[image/resize/instagram-post|正方形のプリセット]]を使うか、余白付きで収めます'],
    ['それでもInstagramに切られた','ファイルが3:4より縦長だった（例：9:16）','結果のサイズを確認','幅1080pxなら高さを1440以下にします'],
    ['投稿がぼやける','元画像の横のピクセルが1080より少なく拡大された','結果の行の元のサイズ','カメラの元ファイルを使います']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-post|Instagram正方形]]','横長写真の場合や、高さより正方形のグリッドを重視する場合。'],
    ['[[image/resize/instagram-story|ストーリーズ・リール（9:16）]]','フィード投稿ではなく全画面の縦長コンテンツの場合。']]},
   limits:['プリセットは1350固定で、1440にするには高さの欄を手で直します。','Instagramのヘルプは固定の推奨サイズではなく範囲を示しており、確認した日以降に変わることがあります。'],
   versions:{body:['2026-09-28にInstagramヘルプセンターで確認：比率が1.91:1〜3:4なら幅320〜1080が保たれます（幅1080で高さ566〜1440）。切り抜きの数値は `src/task/resize.js` と `src/image.js` の `fitQuality()` に従います。'],sources:['[Instagram ヘルプセンター: 写真の解像度](https://help.instagram.com/1631821640426723)']}
  }
 },
 'image/resize/instagram-story':{
  type:'tool',
  intent:{primary:'resize an image for Instagram Stories or Reels (1080 × 1920, 9:16)',secondary:['Instagram story size','9:16 from a landscape photo','Reels cover size'],
   goal:'a full-screen 9:16 vertical image for a Story or Reel',input:'any still photo or graphic',output:'1080 × 1920 (9:16), centre-cropped by default',target:'Instagram Stories, Reels',support:'partial',
   evidence:['src/landings.js SOCIAL instagram-story (1080×1920)','src/task/resize.js (fit=cover)'],
   external:['Instagram Help Center 1038071743007909 (Reels: 1.91:1 to 9:16, min 720 px, cover 420×654), checked 2026-09-28; no Stories pixel size found']},
  en:{
   answer:'This preset makes a 1080 × 1920 vertical image, ratio 9:16. When we checked on 2026-09-28, Instagram\'s Help Center gave no pixel size or safe zone for Stories; its Reels page allows aspect ratios between 1.91:1 and 9:16 with a minimum resolution of 720 pixels, so 9:16 is the tallest ratio Instagram documents. From a 3024 × 4032 phone portrait the preset keeps the central 2268 × 4032 (75 %); from a landscape photo only 42 % survives, so frame landscape shots yourself or use Fit inside.',
   concept:{title:'Filling a 9:16 screen',body:[
    '9:16 is taller than any camera photo, so cover always cuts the sides. A 3:4 portrait loses 378 px on each side; a 4:3 landscape keeps just the middle 1701 × 3024. Fit inside keeps the whole photo and fills the rest with transparent or coloured margins — the usual choice for landscape shots and graphics that must stay complete.',
    'Instagram\'s Reels page also names a recommended cover photo of 420 × 654 px (about 1:1.55). The preset is not that cover size; type 420 × 654 in the pixel fields if you are making a Reels cover. Because Instagram publishes no safe zone, keep text away from the very top and bottom and check the preview in the app before posting.'],
    terms:[['9:16','1080 × 1920; the tallest ratio on Instagram\'s Reels page.'],['Reels cover','420 × 654 px recommended on the same page; cannot be edited after upload.'],['Fit inside','Keeps the whole picture; margins fill the rest of the 9:16 frame.']]},
   example:{title:'Photos into 9:16 (computed from the code)',lead:'Example 12-megapixel sources; cover and contain arithmetic from the resize task.',lines:[
    'Portrait  3024 x 4032 -> crop 2268 x 4032 (378 px off each side), 75 % kept',
    '                         scaled x 0.476 -> 1080 x 1920',
    'Landscape 4032 x 3024 -> crop 1701 x 3024 (1165.5 px off each side), 42 % kept',
    '',
    'Fit inside, landscape: picture 1080 x 810 in the middle,',
    '                       555 px of margin above and below'],
    after:'Choose a margin colour under Advanced (for example black) if you post the fitted version as a JPG; otherwise JPG margins are white.'},
   verify:{steps:[
    'The result shows `1080×1920`.',
    'Open the Story or Reel preview in the app and check that text and faces are not hidden under the app\'s own buttons.',
    'For a Reels cover, check that the file is 420 × 654 instead.']},
   trouble:{rows:[
    ['A landscape photo shows only a thin middle slice','9:16 cover keeps 42 % of a 4:3 landscape','Compare with the original','Use Fit inside with a margin colour, or pick the area with [[image/crop|crop]] first'],
    ['Text is hidden behind the app\'s buttons','No official safe zone is published; the app overlays the edges','Check the in-app preview','Move text towards the middle and re-export'],
    ['Margins are white','Fit inside with JPG output and no margin colour','Result has white bars','Pick a margin colour or keep PNG'],
    ['The Reels cover looks cropped','The 9:16 image was used as the cover','Cover size','Make a 420 × 654 version for the cover']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|Instagram portrait post]]','The picture belongs in the feed; a 4:5 or 3:4 post crops far less.'],
    ['Instagram\'s own editor','You post from the phone and are happy to position the photo by hand in the app.']]},
   limits:['No official Stories size or safe zone was found on Instagram\'s Help Center; 1080 × 1920 is the 9:16 ratio at 1080 px wide, not a documented requirement.','Reels video requirements (30 FPS, 720 px minimum) apply to video, which this image tool does not make.'],
   versions:{body:['Checked on Instagram\'s Help Center on 2026-09-28: the Reels page lists aspect ratios between 1.91:1 and 9:16, a minimum of 30 FPS and 720 pixels, and a 420 × 654 px cover; a search of the Help Center found no Stories dimensions. Crop numbers follow `src/task/resize.js` and `fitQuality()`.'],sources:['[Instagram Help Center: Reel size and aspect ratios](https://help.instagram.com/1038071743007909)']}
  },
  ko:{
   answer:'이 프리셋은 1080 × 1920 세로 이미지, 9:16 비율을 만듭니다. 2026-09-28에 확인했을 때 인스타그램 고객센터에는 스토리의 픽셀 크기나 안전 영역이 없었습니다. 릴스 페이지는 화면 비율 1.91:1~9:16과 최소 해상도 720픽셀을 안내하므로, 9:16이 인스타그램이 문서로 밝힌 가장 세로로 긴 비율입니다. 3024 × 4032 휴대폰 세로 사진에서는 가운데 2268 × 4032(75%)가 남고, 가로 사진은 42%만 남으니 가로 사진은 직접 구도를 잡거나 전체가 보이게 맞춤을 쓰세요.',
   concept:{title:'9:16 화면 채우기',body:[
    '9:16은 어떤 카메라 사진보다도 세로로 길어서 cover는 항상 양옆을 자릅니다. 3:4 세로 사진은 양옆에서 378px씩 잃고, 4:3 가로 사진은 가운데 1701 × 3024만 남습니다. 전체가 보이게 맞춤은 사진 전체를 남기고 나머지를 투명하거나 색이 있는 여백으로 채웁니다. 가로 사진이나 완전히 보여야 하는 그래픽에 흔히 쓰는 선택입니다.',
    '인스타그램 릴스 페이지는 커버 사진 권장 크기로 420 × 654px(약 1:1.55)도 제시합니다. 프리셋은 그 커버 크기가 아니므로 릴스 커버를 만든다면 픽셀 칸에 420 × 654를 입력하세요. 인스타그램이 안전 영역을 공개하지 않으므로 글자는 맨 위와 맨 아래에서 떨어뜨리고, 올리기 전에 앱 미리보기를 확인하세요.'],
    terms:[['9:16','1080 × 1920. 인스타그램 릴스 페이지의 가장 세로로 긴 비율.'],['릴스 커버','같은 페이지에서 권장하는 420 × 654px. 업로드 후에는 편집할 수 없습니다.'],['전체가 보이게 맞춤','그림 전체를 남기고 9:16 틀의 나머지를 여백으로 채웁니다.']]},
   example:{title:'사진을 9:16으로(코드로 계산)',lead:'1,200만 화소 원본을 예로 들었고, 크기 변경 작업의 cover·contain 계산입니다.',lines:[
    '세로 3024 x 4032 -> 2268 x 4032 자르기 (양옆 378 px씩), 75 % 유지',
    '                    x 0.476 배율 -> 1080 x 1920',
    '가로 4032 x 3024 -> 1701 x 3024 자르기 (양옆 1165.5 px씩), 42 % 유지',
    '',
    '전체가 보이게 맞춤, 가로: 가운데에 그림 1080 x 810,',
    '                          위아래 여백 555 px'],
    after:'맞춤 버전을 JPG로 올린다면 고급 설정에서 여백 색(예: 검정)을 고르세요. 그렇지 않으면 JPG 여백은 흰색입니다.'},
   verify:{steps:[
    '결과에 `1080×1920`이 나옵니다.',
    '앱에서 스토리나 릴스 미리보기를 열어 글자와 얼굴이 앱의 버튼에 가려지지 않는지 확인하세요.',
    '릴스 커버라면 파일이 대신 420 × 654인지 확인하세요.']},
   trouble:{rows:[
    ['가로 사진이 가운데 좁은 조각만 보임','9:16 cover는 4:3 가로 사진의 42%만 남깁니다','원본과 비교','여백 색과 함께 전체가 보이게 맞춤을 쓰거나 먼저 [[image/crop|자르기]]로 영역을 고르세요'],
    ['글자가 앱 버튼 뒤에 숨음','공식 안전 영역이 없고 앱이 가장자리에 요소를 겹쳐 그립니다','앱 미리보기 확인','글자를 가운데 쪽으로 옮겨 다시 내보내세요'],
    ['여백이 흰색','JPG 출력에 여백 색 없이 맞춤을 썼습니다','결과에 흰 띠','여백 색을 고르거나 PNG로 두세요'],
    ['릴스 커버가 잘려 보임','9:16 이미지를 커버로 썼습니다','커버 크기','커버용으로 420 × 654 버전을 만드세요']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|인스타그램 세로 게시물]]','피드에 올릴 그림이라면. 4:5나 3:4 게시물은 훨씬 덜 잘립니다.'],
    ['인스타그램 자체 편집기','휴대폰에서 올리며 앱에서 손으로 위치를 잡아도 괜찮을 때.']]},
   limits:['인스타그램 고객센터에서 공식 스토리 크기나 안전 영역을 찾지 못했습니다. 1080 × 1920은 너비 1080px에서의 9:16 비율이며 문서로 정해진 요구 사항이 아닙니다.','릴스 영상 요건(30FPS, 최소 720px)은 영상에 해당하며 이 이미지 도구는 영상을 만들지 않습니다.'],
   versions:{body:['2026-09-28 인스타그램 고객센터에서 확인: 릴스 페이지는 화면 비율 1.91:1~9:16, 최소 30FPS와 720픽셀, 420 × 654px 커버를 안내합니다. 고객센터 검색에서는 스토리 크기를 찾지 못했습니다. 자르기 숫자는 `src/task/resize.js`와 `fitQuality()`를 따릅니다.'],sources:['[Instagram 고객센터: 릴스 크기와 화면 비율](https://help.instagram.com/1038071743007909)']}
  },
  ja:{
   answer:'このプリセットは1080 × 1920の縦長画像、比率9:16を作ります。2026-09-28に確認した時点で、Instagramヘルプセンターにはストーリーズのピクセルサイズもセーフゾーンもありませんでした。リールのページは縦横比1.91:1〜9:16と最低解像度720ピクセルを示しており、9:16がInstagramが文書で示す最も縦長の比率です。3024 × 4032のスマホの縦長写真なら中央の2268 × 4032（75%）が残り、横長写真は42%しか残らないので、横長は自分で構図を決めるか、全体が見えるように収めるを使います。',
   concept:{title:'9:16の画面を埋める',body:[
    '9:16はどのカメラ写真よりも縦長なので、coverは必ず左右を切ります。3:4の縦長写真は左右から378pxずつ失い、4:3の横長写真は中央の1701 × 3024だけが残ります。全体が見えるように収めるは写真全体を残し、残りを透明か色付きの余白で埋めます。横長写真や全体を見せる必要のあるグラフィックでよく使う選択です。',
    'Instagramのリールのページは、カバー写真の推奨サイズとして420 × 654px（約1:1.55）も挙げています。プリセットはそのカバーのサイズではないので、リールのカバーを作るならピクセルの欄に420 × 654と入力します。Instagramはセーフゾーンを公開していないので、文字は上端と下端から離し、投稿前にアプリのプレビューを確認します。'],
    terms:[['9:16','1080 × 1920。Instagramのリールのページで最も縦長の比率。'],['リールのカバー','同じページで推奨される420 × 654px。アップロード後は編集できません。'],['全体が見えるように収める','画像全体を残し、9:16の枠の残りを余白で埋めます。']]},
   example:{title:'写真を9:16に（コードから計算）',lead:'1,200万画素の元画像を例にした、サイズ変更タスクのcover・containの計算です。',lines:[
    '縦長 3024 x 4032 -> 2268 x 4032を切り出し（左右378 pxずつ）、75 %を残す',
    '                    x 0.476倍 -> 1080 x 1920',
    '横長 4032 x 3024 -> 1701 x 3024を切り出し（左右1165.5 pxずつ）、42 %を残す',
    '',
    '収める、横長: 中央に画像 1080 x 810、',
    '              上下に555 pxの余白'],
    after:'収めた版をJPGで投稿するなら、詳細設定で余白の色（例：黒）を選びます。そうしないとJPGの余白は白になります。'},
   verify:{steps:[
    '結果に `1080×1920` と出ます。',
    'アプリでストーリーズやリールのプレビューを開き、文字や顔がアプリのボタンに隠れていないか確認します。',
    'リールのカバーなら、ファイルが代わりに420 × 654になっているか確認します。']},
   trouble:{rows:[
    ['横長写真が中央の細い部分だけになる','9:16のcoverは4:3の横長写真の42%しか残さない','元画像と比べる','余白の色を付けて収めるを使うか、先に[[image/crop|切り抜き]]で範囲を選びます'],
    ['文字がアプリのボタンの後ろに隠れる','公式のセーフゾーンがなく、アプリが端に要素を重ねて表示する','アプリのプレビューを確認','文字を中央寄りに移して書き出し直します'],
    ['余白が白い','JPG出力で余白の色を指定せずに収めた','結果に白い帯','余白の色を選ぶかPNGのままにします'],
    ['リールのカバーが切れて見える','9:16の画像をカバーに使った','カバーのサイズ','カバー用に420 × 654の版を作ります']]},
   alternatives:{rows:[
    ['[[image/resize/instagram-portrait|Instagram縦長投稿]]','フィードに載せる画像なら。4:5や3:4の投稿のほうがずっと切られにくい。'],
    ['Instagram自体の編集機能','スマホから投稿し、アプリで手で位置を決めてもよい場合。']]},
   limits:['Instagramヘルプセンターで公式のストーリーズのサイズやセーフゾーンは見つかりませんでした。1080 × 1920は幅1080pxでの9:16の比率で、文書化された必須条件ではありません。','リール動画の条件（30FPS、最低720px）は動画に関するもので、この画像ツールは動画を作りません。'],
   versions:{body:['2026-09-28にInstagramヘルプセンターで確認：リールのページは縦横比1.91:1〜9:16、最低30FPSと720ピクセル、420 × 654pxのカバーを示しています。ヘルプセンターの検索ではストーリーズのサイズは見つかりませんでした。切り抜きの数値は `src/task/resize.js` と `fitQuality()` に従います。'],sources:['[Instagram ヘルプセンター: リールのサイズと縦横比](https://help.instagram.com/1038071743007909)']}
  }
 },
};
