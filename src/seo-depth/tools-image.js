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
};
