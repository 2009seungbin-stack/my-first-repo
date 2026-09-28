/** Intent content for the tools-media pages (docs/SEO-CONTENT-MODEL.md). Keys are canonical paths.
 * Nerulio behaviour: src/task/pdf-editor.js, src/task/pdf-organize.js, src/task/pdf-compress.js,
 * src/pdf.js, src/pdf-worker.js, src/pdf-optimize.js, src/pdf-subset.js (PDF); src/task/media.js,
 * src/media.js, src/media-modern-worker.js, assets/vendor/mediabunny-1.58.1 (media); evidence in
 * tests/pdf-browser.mjs, tests/media-browser.mjs and src/capabilities.js. Codec and container facts:
 * the official documentation cited in each page's `versions.sources`. */
const PREVIEW='[Apple: Add, delete, or move PDF pages in Preview on Mac](https://support.apple.com/guide/preview/add-delete-or-move-pdf-pages-prvw11793/mac)';
const ADOBE_OPT='[Adobe: Reduce PDF file size with advanced options](https://helpx.adobe.com/acrobat/desktop/create-documents/optimize-pdfs/advance-size-reduction.html)';
export default {
 'pdf/editor':{
  type:'tool',
  intent:{primary:'edit a PDF online: add text, a signature, images, whiteout or shapes, and fill its form',secondary:['correct a word on a PDF','sign a PDF without printing','redact (black out) text for real','rotate, crop or delete pages'],
   goal:'a PDF with the added text, signature and marks, original text still searchable, covered content removed where it had to be',input:'one PDF',output:'PDF (<name>-edited.pdf)',support:'partial',
   evidence:['src/task/pdf-editor.js (tools, forms, redaction warning)','src/pdf.js export (redacted pages rasterised at max(1400, 2400) px, JPEG ≥ 0.72)','src/pdf-worker.js (native marks, Helvetica / Noto Sans CJK KR subset, form fill and flatten)','tests/pdf-browser.mjs (native marks, rotated page, CJK annotation searchable)'],
   external:[]},
  en:{
   answer:'A PDF page is a list of drawing instructions, not an editable paragraph, so this editor adds new objects on top of the original pages: text, a drawn, typed or uploaded signature image, pictures, whiteout, pen, highlighter, shapes, page numbers and a watermark. It also rotates, duplicates, deletes and crops pages and fills the document\'s own form fields. The original text, vectors and search stay as they were. It cannot retype existing text: you cover a word and type the new one, and only the Redact tool removes what lies underneath.',
   concept:{title:'Why editing a PDF means adding objects',body:[
    'Each PDF page has a content stream: commands that place glyphs at exact coordinates in a font, draw paths and paint images. There are no paragraphs to reflow, and an embedded font often holds only the glyphs the document already uses. That is why this editor does not retype existing lines; it writes new objects into the same page instead.',
    'Every mark is stored as a fraction of the page (x = 0.5 is the middle) and written as a native PDF object on save: text with an embedded font, pen strokes and shapes as vector paths, pictures as image objects. Latin text uses the standard Helvetica font; for other characters the first save downloads Noto Sans CJK KR and embeds only the characters you typed.',
    'Whiteout and Redact look alike but do different things. Whiteout paints a white rectangle; the words under it are still in the file and can be selected, copied and found by search. Redact turns that whole page into a JPEG image on save, so the covered content is really gone, and so is that page\'s selectable text.'],
    terms:[['Content stream','The drawing commands of one page: text runs at fixed positions, paths and images.'],['Whiteout','A white box drawn over the page. It hides, it does not delete.'],['Redact','Black box plus rasterising the page on save, so the covered content no longer exists in the file.'],['Form field','A fillable box defined by the PDF itself (AcroForm). The editor writes your values into it.'],['CropBox','The visible area of a page. Cropping changes it; content outside is hidden, not deleted.']]},
   example:{title:'Example: correcting a date on a one-page A4 invoice',lead:'The invoice says 2025 where it should say 2026. Two ways to fix it, and what ends up in the file:',lines:[
    'Page size (A4)        595.28 × 841.89 pt  = 8.27 × 11.69 in',
    'Whiteout over 2025    x 0.62, y 0.18  →  369 pt from the left, 152 pt from the top',
    'New text 2026         Helvetica 16 pt, drawn on top of the white box',
    'Copy the page text    2025 and 2026 are both still in the file',
    'Redact instead        page saved as a 1697 × 2400 px JPEG (2400 ÷ 11.69 in ≈ 205 ppi), quality 0.8',
    '                      2025 is removed; the page text is no longer selectable'],
    after:'Use whiteout plus text for a visible correction on a document that is not confidential. Use Redact when the old value must not be recoverable, and accept that the page becomes an image.'},
   verify:{steps:[
    'Open the saved file in another PDF reader and search for a word from the original text: it should be found on every page that carries no redaction.',
    'On a redacted page, try to select text or search for the covered word: nothing should be found. Under whiteout the word is still found, which is expected.',
    'If you filled form fields, reopen the file: without "Lock the values on save" the fields stay editable; with it they become plain page content.',
    'Check the page count and orientation after rotating, duplicating or deleting pages.']},
   trouble:{rows:[
    ['Saving stops with a message about one character','The annotation fonts have no glyph for it (an emoji, for example)','The message names the character','Replace or remove it; Latin, Korean, Japanese and Chinese text are covered'],
    ['The first save with Korean or Japanese text fails','The CJK font is downloaded from a CDN the first time it is needed, and the connection failed','The message says the annotation font cannot be downloaded','Reconnect and save again; Latin-only text needs no download'],
    ['Copied text still contains the part you covered','Whiteout only paints over the content','Search the saved file for the covered word','Cover that area with Redact instead of whiteout'],
    ['Filled values are missing in the preview','Form values are written into the PDF on save; the on-screen preview may not draw them','Open the saved file in a PDF reader','Check the saved file; tick "Lock the values on save" when nobody should change them later'],
    ['A digital signature shows as invalid or is gone','Saving copies the pages into a new document, which breaks certificate signatures','Signature panel of your reader, before and after','Make every edit before the document is signed; the Sign tool here places a signature image, not a certificate'],
    ['Bookmarks are gone','The saved PDF is rebuilt from its pages and the outline is not copied','Bookmarks panel of your reader','Keep the original for navigation, or add bookmarks again in a desktop editor']]},
   alternatives:{rows:[
    ['The program that made the PDF (a word processor or layout app)','When the text itself has to change or reflow: edit the source and export a new PDF.'],
    ['A desktop PDF editor that edits existing text','When you must retype lines in place and the document\'s fonts allow it. That is a different operation from adding objects.'],
    ['[[pdf/merge|Merge and reorder pages]]','When the job is only page order, rotation or combining files, with no marks at all.']]},
   limits:['Existing text cannot be retyped or reflowed, and scanned pages get no OCR.','The Sign tool places an image of a signature; it does not create a certificate-based digital signature, and existing ones are not preserved.','Redacted pages become images without selectable text; whiteout is not redaction.','One PDF is edited at a time, and bookmarks are not carried over.'],
   versions:{body:['Checked in Nerulio\'s PDF browser suite (tests/pdf-browser.mjs) on a 320-page synthetic document in Chromium 153, Firefox 155 and WebKit 26.6: text, pen, rectangle and highlight marks are written as native objects, a pen stroke lands at its page position, rotation and crop boxes survive, and Korean and Japanese annotation text is searchable in the result. PDF.js 6.3.289 draws the pages and pdf-lib 1.17.1 writes the file. Arbitrary real-world PDFs are not covered by that suite.']}
  },
  ko:{
   answer:'PDF 페이지는 고칠 수 있는 문단이 아니라 그리기 명령의 목록이라서, 이 편집기는 원래 페이지 위에 새 객체를 얹습니다. 글자, 손으로 그리거나 입력하거나 이미지로 올린 서명, 사진, 흰색 지우기, 펜, 형광펜, 도형, 쪽 번호, 워터마크를 넣을 수 있고, 페이지 회전·복제·삭제·자르기와 문서에 들어 있는 입력 양식 채우기도 됩니다. 원래 글자·벡터·검색은 그대로 남습니다. 이미 있는 글자를 다시 타이핑해 고치지는 못합니다. 단어를 덮고 새로 쓰는 방식이며, 아래 내용을 실제로 없애는 것은 가리기 도구뿐입니다.',
   concept:{title:'PDF 편집이 객체를 더하는 일인 이유',body:[
    'PDF의 각 페이지에는 콘텐츠 스트림이 있습니다. 어떤 글꼴의 글리프를 정확한 좌표에 찍고, 선을 그리고, 이미지를 칠하는 명령들입니다. 다시 흘려 배치할 문단이 없고, 포함된 글꼴에는 문서가 이미 쓴 글리프만 들어 있는 경우가 많습니다. 그래서 이 편집기는 기존 줄을 다시 쓰지 않고 같은 페이지에 새 객체를 기록합니다.',
    '추가한 표시는 모두 페이지에 대한 비율(x = 0.5는 가운데)로 저장되고, 저장할 때 PDF 고유 객체로 쓰입니다. 글자는 글꼴을 포함한 텍스트로, 펜과 도형은 벡터 경로로, 사진은 이미지 객체로 들어갑니다. 라틴 문자는 표준 Helvetica 글꼴을 쓰고, 그 밖의 글자가 있으면 처음 저장할 때 Noto Sans CJK KR을 내려받아 입력한 글자만 포함합니다.',
    '지우기와 가리기는 비슷해 보이지만 하는 일이 다릅니다. 지우기는 흰 사각형을 칠할 뿐이라 아래 단어가 파일에 남아 선택·복사·검색됩니다. 가리기는 저장할 때 그 페이지 전체를 JPEG 이미지로 바꾸므로 덮은 내용이 실제로 사라지고, 그 페이지의 글자 선택도 함께 사라집니다.'],
    terms:[['콘텐츠 스트림','한 페이지의 그리기 명령. 정해진 위치의 글자, 경로, 이미지로 이뤄집니다.'],['지우기(화이트아웃)','페이지 위에 그린 흰 상자. 숨길 뿐 삭제하지 않습니다.'],['가리기(레닥션)','검은 상자와 함께 저장 시 페이지를 이미지로 바꿔, 덮은 내용이 파일에서 없어지게 합니다.'],['양식 필드','PDF 자체에 정의된 입력 칸(AcroForm). 편집기가 입력한 값을 그 칸에 씁니다.'],['CropBox','페이지에서 보이는 영역. 자르기는 이 값을 바꾸며, 바깥 내용은 숨겨질 뿐 지워지지 않습니다.']]},
   example:{title:'예시: A4 한 장짜리 청구서의 날짜 고치기',lead:'2026이어야 할 곳에 2025가 적혀 있습니다. 고치는 두 가지 방법과 파일에 남는 것:',lines:[
    '페이지 크기(A4)      595.28 × 841.89 pt  = 8.27 × 11.69 in',
    '2025 위에 지우기     x 0.62, y 0.18  →  왼쪽에서 369 pt, 위에서 152 pt',
    '새 글자 2026         Helvetica 16 pt, 흰 상자 위에 그림',
    '페이지 글자 복사     2025와 2026이 둘 다 파일에 남아 있음',
    '가리기를 쓰면        페이지를 1697 × 2400 px JPEG로 저장(2400 ÷ 11.69 in ≈ 205 ppi), 품질 0.8',
    '                     2025는 삭제되고 그 페이지 글자는 선택되지 않음'],
    after:'기밀이 아닌 문서를 눈에 보이게 고칠 때는 지우기와 글자를 함께 쓰세요. 옛 값을 되살릴 수 없어야 한다면 가리기를 쓰고, 그 페이지가 이미지가 된다는 점을 받아들여야 합니다.'},
   verify:{steps:[
    '저장한 파일을 다른 PDF 뷰어로 열고 원래 본문의 단어를 검색해 보세요. 가리기가 없는 페이지에서는 모두 찾아져야 합니다.',
    '가리기한 페이지에서 글자를 선택하거나 덮은 단어를 검색해 보세요. 아무것도 나오지 않아야 합니다. 지우기 아래 단어는 검색되는 것이 정상입니다.',
    '양식을 채웠다면 파일을 다시 여세요. "저장할 때 값 고정"을 끄면 칸을 계속 고칠 수 있고, 켜면 일반 페이지 내용이 됩니다.',
    '페이지를 회전·복제·삭제했다면 쪽수와 방향을 확인하세요.']},
   trouble:{rows:[
    ['글자 하나 때문에 저장이 멈춤','주석 글꼴에 그 글자의 글리프가 없음(예: 이모지)','메시지에 해당 글자가 표시됨','그 글자를 바꾸거나 빼기. 라틴 문자·한글·일본어·한자는 지원됨'],
    ['한글이나 일본어가 든 첫 저장이 실패함','한중일 글꼴을 처음 필요할 때 CDN에서 내려받는데 연결이 끊김','주석 글꼴을 내려받지 못했다는 메시지','연결한 뒤 다시 저장. 라틴 문자만 있으면 내려받지 않음'],
    ['복사한 글자에 덮은 부분이 그대로 있음','지우기는 내용 위에 칠하기만 함','저장한 파일에서 덮은 단어를 검색','그 영역을 지우기 대신 가리기로 덮기'],
    ['채운 값이 미리보기에 안 보임','양식 값은 저장할 때 PDF에 기록되며, 화면 미리보기는 그리지 않을 수 있음','저장한 파일을 PDF 뷰어로 열기','저장본에서 확인하고, 나중에 아무도 못 고치게 하려면 "저장할 때 값 고정"을 켜기'],
    ['전자서명이 무효로 나오거나 사라짐','저장할 때 페이지를 새 문서로 복사하므로 인증서 서명이 깨짐','뷰어의 서명 패널을 저장 전후로 비교','서명 받기 전에 편집을 끝내기. 여기의 서명 도구는 인증서가 아니라 서명 이미지를 넣음'],
    ['책갈피가 없어짐','저장본은 페이지로 다시 만들어지며 목차(아웃라인)는 복사되지 않음','뷰어의 책갈피 패널','탐색용으로 원본을 보관하거나 데스크톱 편집기에서 책갈피를 다시 추가']]},
   alternatives:{rows:[
    ['PDF를 만든 원래 프로그램(워드프로세서, 레이아웃 앱)','본문 자체를 바꾸거나 줄바꿈이 다시 돼야 할 때. 원본을 고쳐 PDF로 다시 내보내세요.'],
    ['기존 글자 편집을 지원하는 데스크톱 PDF 편집기','줄을 그 자리에서 다시 써야 하고 문서 글꼴이 허용할 때. 객체를 더하는 것과는 다른 작업입니다.'],
    ['[[pdf/merge|페이지 합치기·순서 정리]]','표시 없이 페이지 순서·회전·파일 합치기만 필요할 때.']]},
   limits:['기존 글자는 다시 타이핑하거나 재배치할 수 없고, 스캔 페이지 OCR은 없습니다.','서명 도구는 서명 이미지를 넣을 뿐 인증서 기반 전자서명을 만들지 않으며, 기존 전자서명도 유지되지 않습니다.','가리기한 페이지는 글자 선택이 없는 이미지가 됩니다. 지우기는 가리기가 아닙니다.','한 번에 PDF 하나만 편집하며 책갈피는 옮겨지지 않습니다.'],
   versions:{body:['Nerulio의 PDF 브라우저 테스트(tests/pdf-browser.mjs)에서 320쪽 합성 문서로 Chromium 153·Firefox 155·WebKit 26.6에서 확인했습니다. 글자·펜·사각형·형광펜 표시가 PDF 고유 객체로 기록되고, 펜 선이 페이지의 제 위치에 놓이며, 회전과 CropBox가 유지되고, 한글·일본어 주석 글자가 결과 파일에서 검색됩니다. 페이지 표시는 PDF.js 6.3.289, 파일 쓰기는 pdf-lib 1.17.1이 맡습니다. 임의의 실제 PDF까지 이 테스트가 보장하지는 않습니다.']}
  },
  ja:{
   answer:'PDFのページは編集できる段落ではなく描画命令の並びなので、このエディターは元のページの上に新しいオブジェクトを重ねます。文字、手書き・入力・画像で作る署名、写真、白塗り、ペン、マーカー、図形、ページ番号、透かしを追加でき、ページの回転・複製・削除・トリミングや、文書に元からある入力フォームの記入もできます。元の文字・ベクター・検索はそのまま残ります。既存の文字を打ち直すことはできず、単語を覆って新しく書く形になります。下の内容を実際に消せるのは塗りつぶしツールだけです。',
   concept:{title:'PDFの編集がオブジェクトの追加になる理由',body:[
    'PDFの各ページにはコンテンツストリームがあります。あるフォントのグリフを正確な座標に置き、線を引き、画像を描く命令です。流し直す段落はなく、埋め込みフォントには文書がすでに使ったグリフしか入っていないことも多いため、このエディターは既存の行を書き換えず、同じページに新しいオブジェクトを書き込みます。',
    '追加した要素はすべてページに対する比率（x = 0.5が中央）で保持され、保存時にPDFのネイティブオブジェクトとして書かれます。文字はフォントを埋め込んだテキスト、ペンと図形はベクターパス、写真は画像オブジェクトです。ラテン文字は標準のHelveticaを使い、それ以外の文字があると最初の保存時にNoto Sans CJK KRを取得し、入力した文字だけを埋め込みます。',
    '白塗りと塗りつぶしは似ていますが役割が違います。白塗りは白い四角を描くだけなので、下の単語はファイルに残り、選択・コピー・検索ができます。塗りつぶしは保存時にそのページ全体をJPEG画像にするため、覆った内容は実際に消え、そのページの文字選択もなくなります。'],
    terms:[['コンテンツストリーム','1ページ分の描画命令。決まった位置の文字、パス、画像からなります。'],['白塗り','ページの上に描く白い四角。隠すだけで削除はしません。'],['塗りつぶし（墨消し）','黒い四角に加え、保存時にページを画像化して覆った内容をファイルから消します。'],['フォームフィールド','PDF自体が定義する入力欄（AcroForm）。入力した値をその欄に書き込みます。'],['CropBox','ページの表示範囲。トリミングはこの値を変え、外側の内容は隠れるだけで消えません。']]},
   example:{title:'例：A4一枚の請求書の日付を直す',lead:'2026とすべきところが2025になっています。直し方は二通りあり、ファイルに残るものが違います。',lines:[
    'ページサイズ（A4）   595.28 × 841.89 pt  = 8.27 × 11.69 in',
    '2025に白塗り         x 0.62, y 0.18  →  左から369 pt、上から152 pt',
    '新しい文字 2026      Helvetica 16 pt、白い四角の上に描画',
    'ページの文字をコピー 2025と2026の両方がファイルに残る',
    '塗りつぶしの場合     ページを1697 × 2400 pxのJPEGで保存（2400 ÷ 11.69 in ≈ 205 ppi）、品質0.8',
    '                     2025は削除され、そのページの文字は選択できない'],
    after:'機密でない書類を見た目だけ直すなら、白塗りと文字の組み合わせで十分です。古い値を復元できないようにする必要があるなら塗りつぶしを使い、そのページが画像になることを受け入れてください。'},
   verify:{steps:[
    '保存したファイルを別のPDFビューアーで開き、元の本文の単語を検索します。塗りつぶしのないページではすべて見つかるはずです。',
    '塗りつぶしたページで文字を選択したり、覆った単語を検索したりします。何も見つからなければ正常です。白塗りの下の単語は見つかるのが正常です。',
    'フォームに記入した場合はファイルを開き直します。「保存時に値を固定」をオフにすると欄は編集可能なまま、オンにすると通常のページ内容になります。',
    'ページを回転・複製・削除した場合は、ページ数と向きを確認します。']},
   trouble:{rows:[
    ['1文字のせいで保存が止まる','注釈用フォントにその文字のグリフがない（絵文字など）','メッセージに該当の文字が出る','その文字を置き換えるか削除。ラテン文字・日本語・韓国語・中国語は対応'],
    ['日本語や韓国語を含む最初の保存が失敗する','CJKフォントは初めて必要になったときCDNから取得するが、接続に失敗した','注釈フォントを取得できないというメッセージ','接続してから保存し直す。ラテン文字だけなら取得は不要'],
    ['コピーした文字に覆った部分が残っている','白塗りは内容の上に描くだけ','保存したファイルで覆った単語を検索','その範囲を白塗りではなく塗りつぶしで覆う'],
    ['記入した値がプレビューに出ない','フォームの値は保存時にPDFへ書き込まれ、画面のプレビューには描かれないことがある','保存したファイルをPDFビューアーで開く','保存したファイルで確認し、後から変えさせたくなければ「保存時に値を固定」をオンにする'],
    ['電子署名が無効になる・消える','保存時にページを新しい文書へコピーするため、証明書による署名は壊れる','ビューアーの署名パネルを保存前後で比べる','署名してもらう前に編集を終える。ここの署名ツールは証明書ではなく署名画像を置く'],
    ['しおりがなくなった','保存したPDFはページから組み直され、しおり（アウトライン）はコピーされない','ビューアーのしおりパネル','移動用に元ファイルを残すか、デスクトップのエディターでしおりを付け直す']]},
   alternatives:{rows:[
    ['PDFを作った元のアプリ（ワープロやレイアウトソフト）','本文そのものを変えたり、折り返しを直したりする必要があるとき。元データを直してPDFを書き出し直します。'],
    ['既存テキストの編集に対応したデスクトップのPDFエディター','行をその場で打ち直す必要があり、文書のフォントがそれを許すとき。オブジェクトの追加とは別の作業です。'],
    ['[[pdf/merge|ページの結合・並べ替え]]','書き込みは不要で、ページ順・回転・ファイルの結合だけが必要なとき。']]},
   limits:['既存の文字は打ち直しも再配置もできず、スキャンページのOCRもありません。','署名ツールは署名の画像を置くだけで、証明書による電子署名は作らず、既存の電子署名も保持しません。','塗りつぶしたページは文字選択のない画像になります。白塗りは墨消しではありません。','一度に編集できるPDFは1つで、しおりは引き継がれません。'],
   versions:{body:['NerulioのPDFブラウザーテスト（tests/pdf-browser.mjs）で、320ページの合成文書を使いChromium 153・Firefox 155・WebKit 26.6で確認しました。文字・ペン・四角形・マーカーがネイティブオブジェクトとして書かれ、ペンの線がページ上の正しい位置に置かれ、回転とCropBoxが保たれ、日本語・韓国語の注釈文字が結果のファイルで検索できます。ページの描画はPDF.js 6.3.289、書き出しはpdf-lib 1.17.1です。実在する任意のPDFまでこのテストが保証するものではありません。']}
  }
 },
 'pdf/split':{
  type:'tool',
  intent:{primary:'split a PDF into several files or extract some pages',secondary:['one file per page','split every N pages','split by page ranges','separate odd and even pages'],
   goal:'separate PDFs that each contain exactly the intended pages, text still searchable',input:'PDF (images may be added as pages)',output:'PDF, or ZIP of PDFs named <name>-split-01.pdf …',support:'full',
   evidence:['src/task/pdf-organize.js groups() (each, every, ranges, selected, odd-even; validation; ZIP naming)','src/core.js parsePages (order as typed, duplicates removed)','tests/pdf-browser.mjs (custom split groups preserve counts; searchable text)'],
   external:['Apple Preview guide: dragging thumbnails to the desktop creates a new PDF']},
  en:{
   answer:'Open a PDF, choose how to cut it, and each group of pages becomes its own PDF: one file per page, every N pages, custom ranges separated by semicolons such as `1-3; 4-8; 9`, odd and even pages, or only the pages you selected. Pages are copied as native objects, so text, vectors and search survive. Several files arrive in one ZIP; a single result downloads as a PDF. Images can be dropped in as extra pages before splitting.',
   concept:{title:'How the split modes turn page numbers into files',body:[
    'A split is a list of groups, and each group becomes one new PDF with copies of those pages in the order listed. Page numbers start at 1 and refer to the document as arranged on screen: if you drag, rotate or delete thumbnails first, the numbers follow the new order.',
    'In Custom ranges a semicolon starts a new file and a comma adds pages to the same file: `1-3; 4-8; 9` makes three files, `1,3,5-6` makes one file of four pages. A range has to run forwards and stay within the page count; otherwise the button asks you to check the ranges and nothing is exported. Pages you leave out are not exported, and one page may appear in two groups.',
    'Each part is a complete PDF, so the fonts and images a page uses are copied into every part that contains it. Several parts can therefore add up to more bytes than the original.'],
    terms:[['Every N pages','Cuts after every N pages; the last file holds whatever is left.'],['Custom ranges','Semicolon = new file, comma = more pages in the same file, hyphen = a run of pages.'],['Odd / even','Two files, 1, 3, 5… and 2, 4, 6…, for example to separate fronts and backs of a scanned stack.']]},
   example:{title:'Example: one 10-page report in every mode',lead:'The source is report.pdf with 10 pages. The default file name is the source name plus -split:',lines:[
    'Mode            Input            Files',
    'Every page      —                10 files: 1 | 2 | 3 | … | 10',
    'Every N pages   N = 3            4 files: 1-3 | 4-6 | 7-9 | 10',
    'Custom ranges   1-3; 4-8; 9      3 files: 1-3 | 4-8 | 9      (page 10 is left out)',
    'Custom ranges   1,3,5-6          1 file with pages 1, 3, 5, 6',
    'Odd / even      —                2 files: 1,3,5,7,9 | 2,4,6,8,10',
    'Download        10 files → report-split.zip with report-split-01.pdf … report-split-10.pdf'],
    after:'Part numbers are padded to the number of files (10 files: -01 to -10; 4 files: -1 to -4), so they sort correctly. Type a name in the file-name field to replace report-split.'},
   verify:{steps:[
    'Before exporting, the button shows how many PDFs will be made; the markers on the thumbnails show where each file starts.',
    'Open the ZIP and check that the number of files matches, then open each part and check its page count and first page.',
    'Search a word in one part: it is found, because pages are copied rather than rendered.']},
   trouble:{rows:[
    ['The button says "Check the ranges"','A range runs backwards (8-4), goes past the last page, or contains something other than digits, commas, hyphens and semicolons','Compare the numbers with the page count at the top','Write ranges forwards within the page count, for example 4-8'],
    ['Pages come out in an unexpected order','Numbers refer to the arranged thumbnails, which were moved, or the pages were typed in that order','Look at the thumbnails before exporting','Rearrange first, then enter the ranges; within a file the pages follow the order you type (`5,1,2`)'],
    ['Fillable fields became plain text','Forms are flattened when a file is opened in this tool','Click a field in the part','Fill forms in [[pdf/editor|the PDF editor]], which keeps the fields'],
    ['The parts together are bigger than the original','Shared fonts and images are copied into every part','Add up the part sizes','Compress large parts with [[pdf/compress|PDF compression]]'],
    ['A digital signature is no longer valid','Every part is a new document','Signature panel of your reader','Split before signing, or keep the signed original']]},
   alternatives:{rows:[
    ['Preview on a Mac: View › Thumbnails, then drag thumbnails to the desktop','One or two quick extractions on a Mac; Apple documents that this creates a new PDF.'],
    ['[[pdf-to-jpg|PDF to JPG]]','When you need images of the pages rather than PDF files.']]},
   limits:['No automatic splitting by bookmarks, blank pages or file size.','Bookmarks and certificate signatures are not carried into the parts, and forms are flattened.'],
   versions:{body:['Checked in tests/pdf-browser.mjs on a 320-page synthetic document: the groups `1-2; 320` produce a 2-page and a 1-page PDF, and page text stays searchable after page copying (Chromium 153, Firefox 155, WebKit 26.6). The Preview steps follow Apple\'s guide.'],sources:[PREVIEW]}
  },
  ko:{
   answer:'PDF를 열고 나눌 방법을 고르면 페이지 묶음마다 PDF가 하나씩 만들어집니다. 한 쪽씩, N쪽마다, `1-3; 4-8; 9`처럼 세미콜론으로 구분한 범위, 홀수·짝수, 또는 선택한 페이지만 저장할 수 있습니다. 페이지는 PDF 고유 객체 그대로 복사되므로 글자·벡터·검색이 유지됩니다. 파일이 여러 개면 ZIP 하나로, 하나면 PDF로 내려받습니다. 나누기 전에 이미지를 페이지로 끼워 넣을 수도 있습니다.',
   concept:{title:'나누기 방식이 쪽 번호를 파일로 바꾸는 법',body:[
    '나누기는 묶음의 목록이고, 묶음 하나가 해당 페이지의 사본을 적힌 순서대로 담은 새 PDF 하나가 됩니다. 쪽 번호는 1부터 시작하며 화면에 정리된 문서 기준입니다. 썸네일을 먼저 끌어 옮기거나 회전·삭제했다면 번호도 바뀐 순서를 따릅니다.',
    '범위 지정에서 세미콜론은 새 파일을 시작하고 쉼표는 같은 파일에 페이지를 더합니다. `1-3; 4-8; 9`는 파일 세 개, `1,3,5-6`은 네 쪽짜리 파일 하나입니다. 범위는 앞에서 뒤로 쓰고 전체 쪽수 안이어야 하며, 아니면 버튼이 범위를 확인하라고 알리고 아무것도 저장하지 않습니다. 빼놓은 페이지는 저장되지 않고, 한 페이지가 두 묶음에 들어갈 수도 있습니다.',
    '각 파일은 완전한 PDF라서, 한 페이지가 쓰는 글꼴과 이미지가 그 페이지를 담은 모든 파일에 복사됩니다. 그래서 나눈 파일들의 합이 원본보다 커질 수 있습니다.'],
    terms:[['N쪽마다','N쪽마다 끊고, 마지막 파일에는 남은 쪽이 들어갑니다.'],['범위 지정','세미콜론 = 새 파일, 쉼표 = 같은 파일에 쪽 추가, 하이픈 = 연속한 쪽.'],['홀수·짝수','1, 3, 5…와 2, 4, 6…의 파일 두 개. 예를 들어 스캔한 묶음의 앞면과 뒷면을 가를 때 씁니다.']]},
   example:{title:'예시: 10쪽짜리 보고서를 방식별로 나누면',lead:'원본은 10쪽인 report.pdf입니다. 기본 파일 이름은 원본 이름 뒤에 -split이 붙습니다.',lines:[
    '방식            입력             결과 파일',
    '한 쪽씩         —                10개: 1 | 2 | 3 | … | 10',
    'N쪽마다         N = 3            4개: 1-3 | 4-6 | 7-9 | 10',
    '범위 지정       1-3; 4-8; 9      3개: 1-3 | 4-8 | 9      (10쪽은 빠짐)',
    '범위 지정       1,3,5-6          1쪽·3쪽·5쪽·6쪽이 든 파일 1개',
    '홀수·짝수       —                2개: 1,3,5,7,9 | 2,4,6,8,10',
    '내려받기        10개 → report-split.zip 안에 report-split-01.pdf … report-split-10.pdf'],
    after:'번호는 파일 개수의 자릿수에 맞춰 0을 채우므로(10개: -01~-10, 4개: -1~-4) 이름순으로 제대로 정렬됩니다. 파일 이름 칸에 입력하면 report-split 대신 그 이름을 씁니다.'},
   verify:{steps:[
    '저장 전에 버튼에 만들어질 PDF 개수가 나오고, 썸네일의 표시가 각 파일이 시작되는 곳을 알려 줍니다.',
    'ZIP을 열어 파일 개수가 맞는지 보고, 각 파일의 쪽수와 첫 페이지를 확인하세요.',
    '나눈 파일 하나에서 단어를 검색해 보세요. 페이지를 이미지로 만들지 않고 복사하므로 찾아집니다.']},
   trouble:{rows:[
    ['버튼에 "범위를 확인하세요"가 뜸','범위가 거꾸로이거나(8-4) 마지막 쪽을 넘거나, 숫자·쉼표·하이픈·세미콜론 외의 문자가 있음','위쪽의 전체 쪽수와 번호를 비교','범위를 앞에서 뒤로, 쪽수 안에서 쓰기(예: 4-8)'],
    ['페이지 순서가 예상과 다름','번호는 옮겨진 썸네일 기준이거나, 그 순서로 입력했음','저장 전에 썸네일 확인','먼저 정리한 뒤 범위를 입력. 한 파일 안에서는 입력한 순서(`5,1,2`)를 따름'],
    ['입력 칸이 일반 글자가 됨','이 도구로 파일을 열 때 양식이 평면화됨','나눈 파일에서 칸을 눌러 보기','양식 입력은 칸을 유지하는 [[pdf/editor|PDF 편집기]]에서 하기'],
    ['나눈 파일의 합이 원본보다 큼','공유하던 글꼴과 이미지가 파일마다 복사됨','각 파일 크기를 더해 보기','큰 파일은 [[pdf/compress|PDF 용량 줄이기]]로 압축'],
    ['전자서명이 더 이상 유효하지 않음','나눈 파일마다 새 문서임','뷰어의 서명 패널','서명 전에 나누거나, 서명된 원본을 보관']]},
   alternatives:{rows:[
    ['맥의 미리보기: 보기 › 썸네일에서 썸네일을 데스크톱으로 끌기','맥에서 한두 번 빠르게 뽑을 때. 이렇게 하면 새 PDF가 만들어진다고 Apple 안내에 나와 있습니다.'],
    ['[[pdf-to-jpg|PDF를 JPG로]]','PDF 파일이 아니라 페이지 이미지가 필요할 때.']]},
   limits:['책갈피·빈 페이지·파일 크기를 기준으로 자동 분할하지는 않습니다.','책갈피와 인증서 서명은 나눈 파일에 옮겨지지 않고, 양식은 평면화됩니다.'],
   versions:{body:['tests/pdf-browser.mjs에서 320쪽 합성 문서로 확인했습니다. `1-2; 320` 묶음이 2쪽과 1쪽짜리 PDF를 만들고, 페이지 복사 뒤에도 글자가 검색됩니다(Chromium 153, Firefox 155, WebKit 26.6). 미리보기 단계는 Apple 안내를 따릅니다.'],sources:[PREVIEW]}
  },
  ja:{
   answer:'PDFを開いて分け方を選ぶと、ページのまとまりごとにPDFが1つずつ作られます。1ページずつ、Nページごと、`1-3; 4-8; 9`のようにセミコロンで区切った範囲、奇数・偶数、または選んだページだけを保存できます。ページはPDFのネイティブオブジェクトのままコピーされるため、文字・ベクター・検索が保たれます。複数ファイルはZIP 1つに、1つだけならPDFとしてダウンロードされます。分割の前に画像をページとして差し込むこともできます。',
   concept:{title:'分割方法がページ番号をファイルに変える仕組み',body:[
    '分割とはまとまりのリストで、まとまり1つが、そのページのコピーを書いた順に並べた新しいPDF 1つになります。ページ番号は1から始まり、画面で並べた文書が基準です。先にサムネイルを動かしたり回転・削除したりした場合、番号も新しい順序に従います。',
    '範囲指定では、セミコロンで新しいファイルが始まり、カンマで同じファイルにページを加えます。`1-3; 4-8; 9`はファイル3つ、`1,3,5-6`は4ページのファイル1つです。範囲は前から後ろへ、総ページ数の内側で書く必要があり、そうでないとボタンが範囲の確認を求め、何も書き出しません。外したページは書き出されず、1つのページを2つのまとまりに入れることもできます。',
    '各ファイルは完全なPDFなので、あるページが使うフォントや画像は、そのページを含むすべてのファイルにコピーされます。そのため分割後の合計が元より大きくなることがあります。'],
    terms:[['Nページごと','Nページごとに区切り、最後のファイルには残りが入ります。'],['範囲指定','セミコロン＝新しいファイル、カンマ＝同じファイルにページを追加、ハイフン＝連続したページ。'],['奇数・偶数','1, 3, 5…と2, 4, 6…の2ファイル。スキャンした束の表面と裏面を分けるときなどに使います。']]},
   example:{title:'例：10ページの報告書を方式ごとに分けると',lead:'元は10ページのreport.pdfです。既定のファイル名は元の名前に-splitが付きます。',lines:[
    '方式            入力             できるファイル',
    '1ページずつ     —                10個：1 | 2 | 3 | … | 10',
    'Nページごと     N = 3            4個：1-3 | 4-6 | 7-9 | 10',
    '範囲指定        1-3; 4-8; 9      3個：1-3 | 4-8 | 9      （10ページ目は含まれない）',
    '範囲指定        1,3,5-6          1・3・5・6ページのファイル1個',
    '奇数・偶数      —                2個：1,3,5,7,9 | 2,4,6,8,10',
    'ダウンロード    10個 → report-split.zip の中に report-split-01.pdf … report-split-10.pdf'],
    after:'番号はファイル数の桁に合わせてゼロ埋めされるので（10個なら-01〜-10、4個なら-1〜-4）、名前順で正しく並びます。ファイル名の欄に入力すると、report-splitの代わりにその名前を使います。'},
   verify:{steps:[
    '書き出す前に、ボタンに作られるPDFの数が表示され、サムネイルの印で各ファイルの始まりが分かります。',
    'ZIPを開いてファイル数が合っているか確認し、各ファイルのページ数と1ページ目を確かめます。',
    '分けたファイルの1つで単語を検索します。ページを画像にせずコピーしているので見つかります。']},
   trouble:{rows:[
    ['ボタンに「範囲を確認してください」と出る','範囲が逆順（8-4）、最終ページを超えている、または数字・カンマ・ハイフン・セミコロン以外の文字がある','上部の総ページ数と番号を見比べる','範囲を前から後ろへ、ページ数の内側で書く（例：4-8）'],
    ['ページの順序が想定と違う','番号は動かした後のサムネイルが基準、またはその順で入力した','書き出し前にサムネイルを確認','先に並べ替えてから範囲を入力。1つのファイル内では入力した順（`5,1,2`）になる'],
    ['入力欄がただの文字になった','このツールで開くとフォームは平面化される','分けたファイルで欄をクリックしてみる','フォームの記入は欄を保つ[[pdf/editor|PDFエディター]]で行う'],
    ['分けたファイルの合計が元より大きい','共有していたフォントや画像がファイルごとにコピーされる','各ファイルのサイズを合計する','大きいファイルは[[pdf/compress|PDFの容量削減]]で圧縮'],
    ['電子署名が無効になった','分けたファイルはそれぞれ新しい文書','ビューアーの署名パネル','署名の前に分割するか、署名済みの元ファイルを保管']]},
   alternatives:{rows:[
    ['Macのプレビュー：表示 › サムネールで、サムネールをデスクトップにドラッグ','Macで1〜2回だけ手早く取り出すとき。これで新しいPDFができるとAppleのガイドにあります。'],
    ['[[pdf-to-jpg|PDFをJPGに]]','PDFではなくページの画像が必要なとき。']]},
   limits:['しおり・白紙ページ・ファイルサイズを基準にした自動分割はしません。','しおりと証明書による署名は分割後のファイルに引き継がれず、フォームは平面化されます。'],
   versions:{body:['tests/pdf-browser.mjsで320ページの合成文書を使って確認しました。`1-2; 320`のまとまりから2ページと1ページのPDFができ、ページのコピー後も文字を検索できます（Chromium 153、Firefox 155、WebKit 26.6）。プレビューの手順はAppleのガイドに従っています。'],sources:[PREVIEW]}
  }
 },
 'pdf/compress':{
  type:'tool',
  intent:{primary:'reduce the file size of a PDF',secondary:['compress PDF without losing text','make a scanned PDF smaller','PDF under an upload limit'],
   goal:'a smaller PDF that stays searchable, or a much smaller image-only PDF for scans, with the trade-off stated',input:'a PDF document',output:'PDF (<name>-min.pdf), or the original when nothing is gained',support:'partial',
   evidence:['src/task/pdf-compress.js LEVELS (200/120/90 dpi, 2340/1400/1050 px, JPEG 0.82/0.58/0.52; custom DPI 36–400 → maxSide = dpi × 11.69)','src/pdf-optimize.js (placement-aware downsampling, skips CMYK JPEG/16-bit/stencil/custom Decode, ≥5 % gain rule, dedupe, re-deflate)','src/pdf-subset.js (TrueType glyph trimming only)','src/pdf.js raster export (one JPEG per page at maxSide)','tests/pdf-browser.mjs'],
   external:['Adobe Acrobat Pro PDF Optimizer as the desktop alternative']},
  en:{
   answer:'Nerulio shrinks a PDF in two different ways. The default keeps every page object: images are resampled to the resolution the page actually draws them at and re-encoded as JPEG, embedded TrueType fonts keep only the glyphs in use, identical objects are merged and raw streams are compressed, so text, vectors and search are untouched. The optional "Flatten pages to images" mode instead renders every page into one JPEG: far smaller for scans, but the text can no longer be selected. When the result is not smaller, you get the original back.',
   concept:{title:'Two kinds of PDF compression and what each removes',body:[
    'In most PDFs the weight is in images and embedded fonts, not in the text. The structure-preserving mode works on those objects. For each image it finds the largest size at which any page draws it and caps the pixels at the level\'s resolution: Light 200 dpi, Recommended 120 dpi, Strong 90 dpi, together with a long-side cap of 2340, 1400 or 1050 px for files whose page size means nothing. A re-encoded image replaces the old one only if it is at least 5 % smaller.',
    'Some objects are left alone on purpose: CMYK JPEGs, 16-bit images, stencil masks, images with a custom decode array, and fonts stored as CFF or Type 1 programs. Soft masks stay lossless. That is why a PDF made of vector drawings or already-compressed pictures can barely shrink.',
    'The raster mode renders each page with PDF.js to the level\'s long-side pixel count and stores it as one JPEG. It removes everything a page is built from (text, vector paths, links) and keeps only its picture. That suits a scan that is already an image and does not suit a document someone needs to search or copy from.'],
    terms:[['Placement resolution','Image pixels ÷ the width the page draws it at, in inches. A 2400 px photo drawn 500 pt (6.94 in) wide is 346 dpi.'],['Font subsetting','Keeping only the glyph outlines the document uses; character codes and widths stay the same.'],['Rasterising','Turning a page into one image; text and vectors become pixels.']]},
   example:{title:'Example: the same pages at each level',lead:'Two typical images, and what each level writes back:',lines:[
    'Photo 2400 × 2400 px drawn at 500 × 500 pt (6.94 in square)',
    '  Light        200 dpi × 6.94 in = 1389 px  →  1389 × 1389 px, JPEG quality 0.82',
    '  Recommended  120 dpi × 6.94 in =  833 px  →   833 ×  833 px, JPEG quality 0.58',
    '  Strong        90 dpi × 6.94 in =  625 px  →   625 ×  625 px, JPEG quality 0.52',
    'Scan 2339 × 3307 px filling an A4 page (11.69 in tall)',
    '  Recommended  120 dpi × 11.69 in = 1403 px, long-side cap 1400 px  →  990 × 1400 px',
    'Raster mode, Recommended, A4 page  →  one 990 × 1400 px JPEG per page, text gone'],
    after:'Pixel counts fall with the square of the resolution: the Recommended photo keeps (833 ÷ 2400)² ≈ 12 % of its pixels. A custom DPI (36–400, under Advanced) replaces the level\'s resolution and sets the long-side cap to DPI × 11.69, so 150 dpi means 1754 px.'},
   verify:{steps:[
    'Read the result line: it gives the size before and after, how many images were optimised, fonts trimmed and objects merged, and whether text and search were kept.',
    'Open the result and search for a word: in the default mode it is found exactly as before.',
    'Zoom to 200 % on a picture that contains small print; if it is no longer readable, go back to Light or enter a higher DPI.']},
   trouble:{rows:[
    ['The file barely shrinks','The weight is in objects this pass leaves alone (vector artwork, CMYK JPEGs, CFF or Type 1 fonts), or the file was already optimised','The result line reports few or no optimised images','Try Strong or a lower DPI; for scans only, the raster mode'],
    ['"Already small — original kept"','The rewritten file was not smaller than the input','—','Nothing is wrong: you get the original instead of a larger copy'],
    ['A scan made by an image-to-PDF converter shrinks less than expected','Such converters often declare one point per pixel, so the page looks huge and the scan seems to be 72 dpi; only the long-side cap applies','The page size shown by your reader is far larger than A4','Choose Strong or a lower DPI (which lowers the cap), and grayscale for black-and-white scans'],
    ['Text can no longer be selected','The raster option was on','The result line says the text is not selectable','Run again with the raster option off; rasterising cannot be undone, so keep the original'],
    ['Photos lost their colour','"Convert every image to grayscale" was on, or near-colourless pictures were stored in grey','The result line counts images converted to grey','Untick both grayscale options and run again']]},
   alternatives:{rows:[
    ['Acrobat Pro\'s PDF Optimizer','When you need per-object settings and a report of which fonts, images or forms take the space; it is a paid desktop application.'],
    ['Export again from the source application','When the PDF came from a word processor or layout program: a lower image resolution at export avoids compressing JPEGs twice.'],
    ['[[pdf/split|Split the PDF]]','When the limit is per file and the document is simply too long.']]},
   limits:['CMYK JPEGs, 16-bit images and CFF or Type 1 fonts are neither recompressed nor subset.','The raster mode removes text, links and vectors from every page; there is no mode that rasterises only the scanned pages.','Forms are flattened and certificate signatures are not preserved in the output.'],
   versions:{body:['Checked in tests/pdf-browser.mjs on a 320-page document with 2400 px JPEG photos: the structure-preserving pass re-encoded the image objects, the file got smaller, text on the first pages and on page 320 stayed searchable, rotation and crop boxes survived, and the raster mode left no searchable text (Chromium 153, Firefox 155, WebKit 26.6). Savings on your own files will differ.'],sources:[ADOBE_OPT]}
  },
  ko:{
   answer:'Nerulio는 PDF를 두 가지 방식으로 줄입니다. 기본 방식은 페이지 객체를 모두 유지합니다. 이미지는 페이지에 실제로 그려지는 크기에 맞는 해상도로 줄여 JPEG로 다시 압축하고, 포함된 TrueType 글꼴은 쓰는 글리프만 남기고, 똑같은 객체는 합치고, 압축되지 않은 스트림은 압축합니다. 그래서 글자·벡터·검색은 그대로입니다. 선택 옵션인 "페이지를 이미지로 바꿔서 더 줄이기"는 페이지마다 JPEG 한 장으로 만들어 스캔 문서를 훨씬 작게 하지만 글자를 선택할 수 없게 됩니다. 결과가 더 작지 않으면 원본을 그대로 돌려줍니다.',
   concept:{title:'두 가지 PDF 압축과 각각이 없애는 것',body:[
    '대부분의 PDF에서 용량은 글자가 아니라 이미지와 포함된 글꼴이 차지합니다. 구조를 유지하는 방식은 이 객체들을 다룹니다. 이미지마다 어느 페이지에서든 가장 크게 그려지는 크기를 찾아 단계별 해상도로 픽셀을 제한합니다. 약하게 200 dpi, 권장 120 dpi, 강하게 90 dpi이며, 페이지 크기가 의미 없는 파일을 위해 긴 변도 2340, 1400, 1050 px로 제한합니다. 다시 압축한 이미지는 원래보다 5 % 이상 작을 때만 바꿔 넣습니다.',
    '일부 객체는 일부러 건드리지 않습니다. CMYK JPEG, 16비트 이미지, 스텐실 마스크, 사용자 지정 Decode 배열이 있는 이미지, CFF나 Type 1 형식의 글꼴입니다. 소프트 마스크는 무손실로 둡니다. 그래서 벡터 그림이나 이미 압축된 사진 위주의 PDF는 거의 줄지 않을 수 있습니다.',
    '이미지화 모드는 PDF.js로 페이지를 단계별 긴 변 픽셀 수로 그려 JPEG 한 장으로 저장합니다. 글자·벡터 경로·링크처럼 페이지를 이루는 것을 모두 없애고 그림만 남깁니다. 이미 이미지인 스캔 문서에는 알맞고, 누군가 검색하거나 복사해야 하는 문서에는 맞지 않습니다.'],
    terms:[['배치 해상도','이미지 픽셀 수 ÷ 페이지에 그려지는 너비(인치). 2400 px 사진을 500 pt(6.94 in) 너비로 그리면 346 dpi입니다.'],['글꼴 서브셋','문서가 쓰는 글리프 윤곽만 남기는 것. 문자 코드와 폭은 그대로입니다.'],['이미지화(래스터화)','페이지를 이미지 한 장으로 바꾸는 것. 글자와 벡터가 픽셀이 됩니다.']]},
   example:{title:'예시: 같은 페이지를 단계별로 줄이면',lead:'흔한 이미지 두 가지와 단계마다 다시 쓰이는 결과입니다.',lines:[
    '사진 2400 × 2400 px, 500 × 500 pt(한 변 6.94 in)로 배치',
    '  약하게   200 dpi × 6.94 in = 1389 px  →  1389 × 1389 px, JPEG 품질 0.82',
    '  권장     120 dpi × 6.94 in =  833 px  →   833 ×  833 px, JPEG 품질 0.58',
    '  강하게    90 dpi × 6.94 in =  625 px  →   625 ×  625 px, JPEG 품질 0.52',
    '스캔 2339 × 3307 px, A4 페이지 전체(높이 11.69 in)',
    '  권장     120 dpi × 11.69 in = 1403 px, 긴 변 제한 1400 px  →  990 × 1400 px',
    '이미지화 모드, 권장, A4 페이지  →  페이지마다 990 × 1400 px JPEG 한 장, 글자 없음'],
    after:'픽셀 수는 해상도의 제곱으로 줄어듭니다. 권장 단계의 사진은 (833 ÷ 2400)² ≈ 12 %의 픽셀만 남습니다. 고급 설정의 DPI(36~400)를 입력하면 단계별 해상도 대신 그 값을 쓰고 긴 변 제한은 DPI × 11.69가 되므로, 150 dpi는 1754 px입니다.'},
   verify:{steps:[
    '결과 줄을 읽어 보세요. 전후 용량, 최적화한 이미지 수, 줄인 글꼴 수, 합친 객체 수, 글자·검색 유지 여부가 나옵니다.',
    '결과 파일에서 단어를 검색해 보세요. 기본 방식이라면 전과 똑같이 찾아집니다.',
    '작은 글씨가 들어 있는 그림을 200 %로 확대해 보세요. 읽을 수 없게 됐다면 약하게로 돌아가거나 DPI를 높이세요.']},
   trouble:{rows:[
    ['용량이 거의 줄지 않음','용량을 차지하는 것이 이 과정이 건드리지 않는 객체(벡터 그림, CMYK JPEG, CFF·Type 1 글꼴)이거나, 이미 최적화된 파일','결과 줄에 최적화한 이미지가 거의 없음','강하게나 더 낮은 DPI를 쓰고, 스캔 문서라면 이미지화 모드'],
    ['"이미 충분히 작아 원본을 유지했습니다"','다시 쓴 파일이 원본보다 작지 않음','—','문제가 아닙니다. 더 큰 사본 대신 원본을 돌려준 것입니다'],
    ['이미지→PDF 변환기로 만든 스캔이 기대만큼 안 줄어듦','이런 변환기는 1픽셀을 1포인트로 기록해 페이지가 거대하고 스캔이 72 dpi처럼 보여, 긴 변 제한만 적용됨','뷰어에 표시되는 페이지 크기가 A4보다 훨씬 큼','강하게나 낮은 DPI(제한도 함께 낮아짐)를 쓰고, 흑백 스캔이면 흑백 옵션'],
    ['글자를 선택할 수 없게 됨','이미지화 옵션이 켜져 있었음','결과 줄에 글자 선택 불가가 표시됨','이미지화를 끄고 다시 실행. 되돌릴 수 없으므로 원본은 보관'],
    ['사진의 색이 사라짐','"모든 사진을 흑백으로 바꾸기"가 켜졌거나, 색이 거의 없는 사진이 흑백으로 저장됨','결과 줄에 흑백으로 바꾼 이미지 수가 나옴','두 흑백 옵션을 끄고 다시 실행']]},
   alternatives:{rows:[
    ['Acrobat Pro의 PDF 최적화 도구','객체별 설정과 함께 글꼴·이미지·양식이 차지하는 용량 보고서가 필요할 때. 유료 데스크톱 프로그램입니다.'],
    ['원래 프로그램에서 다시 내보내기','워드프로세서나 레이아웃 프로그램으로 만든 PDF라면, 내보낼 때 이미지 해상도를 낮추면 JPEG를 두 번 압축하지 않아도 됩니다.'],
    ['[[pdf/split|PDF 나누기]]','파일 하나당 용량 제한이 있고 문서가 그냥 너무 길 때.']]},
   limits:['CMYK JPEG, 16비트 이미지, CFF·Type 1 글꼴은 다시 압축하거나 서브셋하지 않습니다.','이미지화 모드는 모든 페이지에서 글자·링크·벡터를 없앱니다. 스캔 페이지만 골라 이미지화하는 모드는 없습니다.','결과 파일에서 양식은 평면화되고 인증서 서명은 유지되지 않습니다.'],
   versions:{body:['tests/pdf-browser.mjs에서 2400 px JPEG 사진이 든 320쪽 문서로 확인했습니다. 구조 유지 방식이 이미지 객체를 다시 압축해 파일이 작아졌고, 앞쪽 페이지와 320쪽의 글자가 검색되며, 회전과 CropBox가 유지되고, 이미지화 모드에서는 검색 가능한 글자가 남지 않았습니다(Chromium 153, Firefox 155, WebKit 26.6). 실제 파일의 절감률은 다를 수 있습니다.'],sources:[ADOBE_OPT]}
  },
  ja:{
   answer:'NerulioはPDFを二通りの方法で小さくします。既定の方法はページのオブジェクトをすべて保ちます。画像はページに実際に描かれる大きさに合った解像度へ縮小してJPEGで再圧縮し、埋め込みのTrueTypeフォントは使っているグリフだけを残し、同じオブジェクトはまとめ、未圧縮のストリームは圧縮します。そのため文字・ベクター・検索はそのままです。オプションの「ページを画像化してさらに小さくする」は各ページを1枚のJPEGにするため、スキャン文書はずっと小さくなりますが、文字は選択できなくなります。結果が小さくならない場合は元のファイルを返します。',
   concept:{title:'2種類のPDF圧縮と、それぞれが取り除くもの',body:[
    '多くのPDFで容量を占めるのは文字ではなく、画像と埋め込みフォントです。構造を保つ方法はこれらのオブジェクトを扱います。画像ごとに、どこかのページで最も大きく描かれるサイズを調べ、強度ごとの解像度で画素数を制限します。弱め200 dpi、おすすめ120 dpi、強め90 dpiで、ページサイズが意味を持たないファイルのために長辺も2340、1400、1050 pxに制限します。再圧縮した画像は、元より5 %以上小さい場合にだけ置き換えます。',
    '一部のオブジェクトはあえて触りません。CMYKのJPEG、16ビット画像、ステンシルマスク、独自のDecode配列を持つ画像、CFFやType 1形式のフォントです。ソフトマスクは可逆のまま残します。そのため、ベクター図版や圧縮済みの写真が中心のPDFはほとんど小さくならないことがあります。',
    '画像化モードは、PDF.jsで各ページを強度ごとの長辺ピクセル数で描画し、1枚のJPEGとして保存します。文字・ベクターパス・リンクなどページを構成するものをすべて取り除き、絵だけを残します。すでに画像であるスキャン文書には向き、検索やコピーが必要な文書には向きません。'],
    terms:[['配置解像度','画像の画素数 ÷ ページ上で描かれる幅（インチ）。2400 pxの写真を500 pt（6.94 in）幅で描くと346 dpiです。'],['フォントのサブセット化','文書が使うグリフの輪郭だけを残すこと。文字コードと字幅は変わりません。'],['画像化（ラスタライズ）','ページを1枚の画像にすること。文字とベクターがピクセルになります。']]},
   example:{title:'例：同じページを強度ごとに圧縮すると',lead:'よくある2種類の画像と、強度ごとに書き戻される結果です。',lines:[
    '写真 2400 × 2400 px、500 × 500 pt（一辺6.94 in）で配置',
    '  弱め       200 dpi × 6.94 in = 1389 px  →  1389 × 1389 px、JPEG品質0.82',
    '  おすすめ   120 dpi × 6.94 in =  833 px  →   833 ×  833 px、JPEG品質0.58',
    '  強め        90 dpi × 6.94 in =  625 px  →   625 ×  625 px、JPEG品質0.52',
    'スキャン 2339 × 3307 px、A4ページ全面（高さ11.69 in）',
    '  おすすめ   120 dpi × 11.69 in = 1403 px、長辺の上限1400 px  →  990 × 1400 px',
    '画像化モード、おすすめ、A4ページ  →  1ページにつき990 × 1400 pxのJPEG 1枚、文字なし'],
    after:'画素数は解像度の2乗で減ります。おすすめの写真に残る画素は(833 ÷ 2400)² ≈ 12 %です。詳細設定のDPI（36〜400）を入れると強度の解像度の代わりにその値を使い、長辺の上限はDPI × 11.69になります。150 dpiなら1754 pxです。'},
   verify:{steps:[
    '結果の行を読みます。前後のサイズ、最適化した画像数、削ったフォント数、まとめたオブジェクト数、文字と検索が保たれたかが表示されます。',
    '結果のファイルで単語を検索します。既定の方法なら以前と同じように見つかります。',
    '小さな文字を含む画像を200 %に拡大します。読めなくなっていたら弱めに戻すか、DPIを上げてください。']},
   trouble:{rows:[
    ['ほとんど小さくならない','容量を占めているのがこの処理で触らないオブジェクト（ベクター図版、CMYKのJPEG、CFF・Type 1フォント）か、最適化済みのファイル','結果の行で最適化した画像がほとんどない','強めか低いDPIを使い、スキャン文書なら画像化モード'],
    ['「すでに十分小さいため元のままです」','書き直したファイルが元より小さくならなかった','—','問題ではありません。大きなコピーの代わりに元のファイルを返しています'],
    ['画像→PDF変換で作ったスキャンが思ったより縮まない','そうした変換ソフトは1ピクセルを1ポイントとして書くため、ページが巨大で72 dpiに見え、長辺の上限だけが効く','ビューアーのページサイズがA4よりはるかに大きい','強めか低いDPI（上限も下がる）を選び、白黒のスキャンならモノクロのオプション'],
    ['文字が選択できなくなった','画像化のオプションがオンだった','結果の行に文字選択不可と出る','画像化をオフにしてやり直す。元に戻せないので元ファイルは保管'],
    ['写真の色が消えた','「すべての写真をモノクロにする」がオン、または色がほとんどない写真がグレーで保存された','結果の行にグレーにした画像の数が出る','両方のモノクロのオプションを外してやり直す']]},
   alternatives:{rows:[
    ['Acrobat ProのPDF最適化','オブジェクトごとの設定と、フォント・画像・フォームがどれだけ容量を使っているかの報告が必要なとき。有料のデスクトップアプリです。'],
    ['元のアプリから書き出し直す','ワープロやレイアウトソフトで作ったPDFなら、書き出し時に画像解像度を下げればJPEGを二重に圧縮せずに済みます。'],
    ['[[pdf/split|PDFを分割]]','1ファイルごとの容量制限があり、文書が単純に長すぎるとき。']]},
   limits:['CMYKのJPEG、16ビット画像、CFF・Type 1フォントは再圧縮もサブセット化もしません。','画像化モードはすべてのページから文字・リンク・ベクターを取り除きます。スキャンページだけを画像化するモードはありません。','出力ではフォームが平面化され、証明書による署名は保持されません。'],
   versions:{body:['tests/pdf-browser.mjsで、2400 pxのJPEG写真を含む320ページの文書を使って確認しました。構造を保つ処理が画像オブジェクトを再圧縮してファイルが小さくなり、先頭のページと320ページ目の文字が検索でき、回転とCropBoxが保たれ、画像化モードでは検索できる文字が残りませんでした（Chromium 153、Firefox 155、WebKit 26.6）。実際のファイルでの削減率は異なります。'],sources:[ADOBE_OPT]}
  }
 },
 'media':{
  type:'tool',
  intent:{primary:'edit a video or audio file in the browser: GIF, audio, compress, trim or a still frame',secondary:['which files and codecs work','why a file opens but cannot be converted','compatibility mode'],
   goal:'pick the right job for the file and understand in advance whether the browser can decode it',input:'one video or audio file (MP4, MOV, M4V, WebM, MKV, MP3, WAV, M4A, Ogg…)',output:'GIF, MP3/WAV, MP4/WebM or PNG/JPG/WebP',support:'partial',
   evidence:['src/task/media.js (five jobs, blockers, compatibility notes)','src/media-modern-worker.js (probe, convert, gif, extract; tracks: primary; OPFS output)','src/media.js COMPAT (600 s video, 1200 s audio source, GIF 20 s / 480 px / 8 fps) and 7-day temp cleanup','tests/media-browser.mjs'],
   external:['MDN: WebCodecs API (codec support is a subset per browser/device)','MDN: media container formats']},
  en:{
   answer:'The media page opens one video or audio file and runs one of five jobs on it: a GIF, audio as MP3 or WAV, a smaller video, a trimmed clip or a still frame. The file is read in pieces inside your browser; Mediabunny 1.58.1 splits the container (MP4, MOV, WebM, MKV, MP3, WAV, Ogg and others) into tracks, and the browser\'s WebCodecs decoders and encoders do the rest. Whether a file works therefore depends on the codec inside it and on your browser, not on its extension.',
   concept:{title:'Container, codec, and which job needs which decoder',body:[
    'A video file is a container (MP4, MOV, WebM, MKV) that holds separately compressed tracks: usually one video track (H.264, HEVC, VP9, AV1…) and one audio track (AAC, Opus, MP3, PCM…). Opening a file only reads the container. Decoding needs a decoder for each codec, which the browser provides through WebCodecs, and MDN notes that a browser or device may support only part of the codecs WebCodecs defines.',
    'The five jobs need different things. A GIF and a still frame decode the video track. Audio export decodes only the audio track and discards the picture, so it works even when the video codec is not supported. A precise trim and compression decode and re-encode both tracks. A fast trim copies the compressed packets without decoding anything, so it only needs a container that accepts those codecs.',
    'Results are written to a temporary file in the browser\'s private storage (OPFS) when it is available instead of piling up in memory; the file is removed when you clear the result and swept after seven days. Without WebCodecs the page falls back to a compatibility mode that records in real time with hard caps: 10 minutes of video, sources up to 20 minutes for audio, and 20 s, 8 fps and 480 px for GIFs.'],
    terms:[['Container','The file format that holds the tracks and their timing: MP4, MOV, WebM, MKV, WAV.'],['Codec','How one track is compressed: H.264, HEVC, VP9, AV1 for video; AAC, Opus, MP3, PCM for audio.'],['Demux / mux','Splitting a container into its tracks, and writing tracks into a new container.'],['WebCodecs','The browser API that gives a web page the device\'s audio and video decoders and encoders.']]},
   example:{title:'Example: one iPhone clip, five jobs',lead:'A 1920 × 1080 MOV recorded with the High Efficiency camera setting (HEVC video, AAC audio), opened in a browser without an HEVC decoder:',lines:[
    'Open         container QuickTime, video hevc 1920 × 1080, audio aac  → opens',
    'Audio        video track discarded, AAC decoded          → MP3 works',
    'Trim · Fast  packets copied into MP4, nothing decoded    → copy path, no HEVC decoder needed',
    'GIF, Frame   need decoded HEVC frames                    → stop with a decoder error',
    'Compress     needs decoded HEVC frames                   → stops with a decoder error',
    'Same file in a browser that decodes HEVC                 → all five jobs run'],
    after:'That is why "not supported" usually means "this codec is not supported here". The [[video/mov-to-gif|MOV to GIF guide]] shows how to read the codec of a file and how to record in H.264 instead.'},
   mapping:{title:'What each job reads and writes',head:['Job','Reads','Needs a decoder for','Writes'],rows:[
    ['GIF','Video track only','The video codec','GIF, up to 256 colours per frame'],
    ['Audio','Audio track only','The audio codec','MP3 (128–320 kbit/s) or 16-bit WAV'],
    ['Compress','Video and audio','Both codecs','MP4 with H.264, or WebM with VP9, VP8 or AV1'],
    ['Trim · Precise','Video and audio','Both codecs','MP4 or WebM, re-encoded'],
    ['Trim · Fast','Compressed packets','Nothing (copy)','MP4 or WebM with the source codecs'],
    ['Frame','One video frame','The video codec','PNG, JPG or WebP at source resolution']]},
   verify:{steps:[
    'After opening, the file line shows dimensions, duration and size; "audio only" means there is no video track to work on.',
    'After a run, the result box shows the size before and after and, for video, the output dimensions. Play it in the Result tab before downloading.',
    'Switch between the Result and Source tabs to compare the two at the same moment.']},
   trouble:{rows:[
    ['The file does not open at all','The container is not one the reader knows, or the file is damaged','Play it in another player; read its format with ffprobe','Export it again as MP4 (H.264 and AAC) from the app that made it'],
    ['It opens, but GIF, frame or compress stops with a decoder error','The browser has no decoder for this video codec, often HEVC or ProRes','ffprobe shows the codec; try the same file in another browser','Use a browser that decodes it, record in H.264, or use audio export or fast trim, which do not decode the picture'],
    ['A note says compatibility mode','This browser has no WebCodecs, so the older real-time path is used','The note under the options','Use a current Chrome, Edge or Firefox; in compatibility mode keep the tab visible'],
    ['Only the audio job can run','The file has no video track','The file line says audio only','Expected: convert the audio, or open the video file instead'],
    ['The result is bigger than the source','A well-compressed source was re-encoded at a higher quality','The result box shows the increase in percent','Use Small quality, a resolution cap or a target size; for pure cutting use Fast trim']]},
   alternatives:{rows:[
    ['FFmpeg on your computer','Batch jobs, scripted pipelines and codecs a browser does not decode (ProRes, most surround formats); no preview, command line only.'],
    ['The single-job pages: [[video/to-gif|video to GIF]], [[video/to-mp3|video to MP3]], [[video/trim|trim]], [[video/compress|compress]], [[video/frame|frame]]','Same engine with the settings of one job already chosen.']]},
   limits:['Codec support comes from your browser; nothing here adds decoders for HEVC, ProRes or surround audio codecs.','One file at a time, and only the primary video and audio track: extra audio tracks and subtitles are dropped.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155 with a 6-second 1920 × 1080 MP4 test signal with audio: fast and precise cuts keep their length and audio, MP3, WAV, GIF and frame jobs produce what was asked, and outputs were decoded again independently with FFprobe and Pillow. An optional run cuts the last minute of a 500 MB+ one-hour file. Codec availability depends on the browser and the device.'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)','[MDN: Media container formats](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)']}
  },
  ko:{
   answer:'미디어 페이지는 영상이나 음성 파일 하나를 열어 다섯 가지 작업 중 하나를 합니다. GIF, MP3·WAV 음성, 더 작은 영상, 잘라낸 구간, 정지 프레임입니다. 파일은 브라우저 안에서 조각씩 읽고, Mediabunny 1.58.1이 컨테이너(MP4, MOV, WebM, MKV, MP3, WAV, Ogg 등)를 트랙으로 나누면 나머지는 브라우저의 WebCodecs 디코더·인코더가 처리합니다. 그래서 파일이 되는지는 확장자가 아니라 안에 든 코덱과 브라우저에 달려 있습니다.',
   concept:{title:'컨테이너와 코덱, 작업별로 필요한 디코더',body:[
    '영상 파일은 따로 압축된 트랙을 담은 컨테이너(MP4, MOV, WebM, MKV)입니다. 보통 영상 트랙 하나(H.264, HEVC, VP9, AV1 등)와 오디오 트랙 하나(AAC, Opus, MP3, PCM 등)가 들어 있습니다. 파일을 여는 것은 컨테이너만 읽는 일이고, 디코딩하려면 코덱마다 디코더가 있어야 합니다. 브라우저는 이를 WebCodecs로 제공하며, MDN에 따르면 브라우저나 기기마다 WebCodecs가 정의한 코덱 중 일부만 지원할 수 있습니다.',
    '다섯 작업은 필요한 것이 다릅니다. GIF와 정지 프레임은 영상 트랙을 디코딩합니다. 음성 추출은 오디오 트랙만 디코딩하고 화면은 버리므로 영상 코덱을 지원하지 않아도 됩니다. 정밀 자르기와 압축은 두 트랙을 모두 디코딩해 다시 인코딩합니다. 빠른 자르기는 압축된 패킷을 디코딩 없이 복사하므로, 그 코덱을 받아 주는 컨테이너만 있으면 됩니다.',
    '결과는 가능하면 메모리에 쌓지 않고 브라우저 전용 저장소(OPFS)의 임시 파일에 쓰며, 결과를 지우면 삭제되고 7일이 지나면 정리됩니다. WebCodecs가 없으면 실시간으로 녹화하는 호환 모드로 바뀌는데, 영상 10분, 음성은 원본 20분, GIF는 20초·8fps·480px이라는 상한이 있습니다.'],
    terms:[['컨테이너','트랙과 그 타이밍을 담는 파일 형식. MP4, MOV, WebM, MKV, WAV 등.'],['코덱','트랙 하나를 압축하는 방식. 영상은 H.264·HEVC·VP9·AV1, 음성은 AAC·Opus·MP3·PCM 등.'],['디먹스·먹스','컨테이너를 트랙으로 나누는 것과, 트랙을 새 컨테이너에 쓰는 것.'],['WebCodecs','웹 페이지가 기기의 오디오·영상 디코더와 인코더를 쓸 수 있게 하는 브라우저 API.']]},
   example:{title:'예시: 아이폰 영상 하나로 다섯 작업',lead:'카메라 설정 "고효율"로 찍은 1920 × 1080 MOV(HEVC 영상, AAC 음성)를 HEVC 디코더가 없는 브라우저에서 열었을 때:',lines:[
    '열기         컨테이너 QuickTime, 영상 hevc 1920 × 1080, 음성 aac  → 열림',
    '음성         영상 트랙은 버리고 AAC만 디코딩          → MP3 성공',
    '자르기·빠르게 패킷을 MP4로 복사, 디코딩 없음          → 복사 경로라 HEVC 디코더가 필요 없음',
    'GIF, 프레임  디코딩된 HEVC 프레임이 필요             → 디코더 오류로 멈춤',
    '압축         디코딩된 HEVC 프레임이 필요             → 디코더 오류로 멈춤',
    'HEVC를 디코딩하는 브라우저에서 같은 파일             → 다섯 작업 모두 실행'],
    after:'그래서 "지원하지 않음"은 대개 "여기서는 이 코덱을 지원하지 않음"이라는 뜻입니다. 파일 코덱을 읽는 법과 H.264로 촬영하는 법은 [[video/mov-to-gif|MOV를 GIF로 안내]]에 있습니다.'},
   mapping:{title:'작업별로 읽는 것과 쓰는 것',head:['작업','읽는 것','디코더가 필요한 코덱','결과'],rows:[
    ['GIF','영상 트랙만','영상 코덱','GIF, 프레임당 최대 256색'],
    ['음성','오디오 트랙만','오디오 코덱','MP3(128–320 kbit/s) 또는 16비트 WAV'],
    ['압축','영상과 음성','두 코덱 모두','H.264의 MP4, 또는 VP9·VP8·AV1의 WebM'],
    ['자르기 · 정밀','영상과 음성','두 코덱 모두','다시 인코딩한 MP4 또는 WebM'],
    ['자르기 · 빠르게','압축된 패킷','없음(복사)','원본 코덱 그대로의 MP4 또는 WebM'],
    ['프레임','영상 프레임 하나','영상 코덱','원본 해상도의 PNG·JPG·WebP']]},
   verify:{steps:[
    '파일을 열면 파일 줄에 해상도·길이·용량이 나옵니다. "오디오만"이면 다룰 영상 트랙이 없다는 뜻입니다.',
    '실행 후 결과 상자에 전후 용량과, 영상이면 출력 해상도가 나옵니다. 내려받기 전에 결과 탭에서 재생해 보세요.',
    '결과 탭과 원본 탭을 오가며 같은 순간을 비교하세요.']},
   trouble:{rows:[
    ['파일이 아예 열리지 않음','이 읽기 도구가 모르는 컨테이너이거나 파일이 손상됨','다른 플레이어로 재생해 보고 ffprobe로 형식 확인','만든 앱에서 MP4(H.264·AAC)로 다시 내보내기'],
    ['열리지만 GIF·프레임·압축이 디코더 오류로 멈춤','브라우저에 이 영상 코덱의 디코더가 없음(주로 HEVC나 ProRes)','ffprobe로 코덱을 보거나 다른 브라우저에서 같은 파일 시도','디코딩되는 브라우저를 쓰거나 H.264로 촬영. 화면을 디코딩하지 않는 음성 추출·빠른 자르기는 가능'],
    ['호환 모드라는 안내가 나옴','이 브라우저에 WebCodecs가 없어 예전 실시간 방식을 씀','옵션 아래의 안내 문구','최신 크롬·엣지·파이어폭스 사용. 호환 모드에서는 탭을 화면에 띄워 두기'],
    ['음성 작업만 실행됨','파일에 영상 트랙이 없음','파일 줄에 오디오만이라고 표시','정상입니다. 음성을 변환하거나 영상 파일을 여세요'],
    ['결과가 원본보다 큼','이미 잘 압축된 원본을 더 높은 화질로 다시 인코딩함','결과 상자에 증가율이 표시됨','작게 화질·해상도 상한·목표 용량을 쓰고, 자르기만 할 때는 빠른 자르기']]},
   alternatives:{rows:[
    ['내 컴퓨터의 FFmpeg','일괄 작업, 스크립트, 브라우저가 디코딩하지 못하는 코덱(ProRes, 대부분의 서라운드 형식)이 필요할 때. 미리보기 없이 명령줄로만 씁니다.'],
    ['작업별 페이지: [[video/to-gif|영상을 GIF로]], [[video/to-mp3|영상을 MP3로]], [[video/trim|자르기]], [[video/compress|압축]], [[video/frame|프레임]]','같은 엔진에 한 작업의 설정을 미리 골라 둔 페이지입니다.']]},
   limits:['코덱 지원은 브라우저가 정합니다. 여기서 HEVC·ProRes·서라운드 음성용 디코더를 따로 더하지 않습니다.','한 번에 파일 하나, 기본 영상·음성 트랙 하나씩만 다룹니다. 추가 음성 트랙과 자막은 빠집니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 음성이 있는 6초짜리 1920 × 1080 MP4 테스트 신호를 써서 확인했습니다. 빠른·정밀 자르기가 길이와 음성을 유지하고, MP3·WAV·GIF·프레임 작업이 요청한 결과를 내며, 결과물은 FFprobe와 Pillow로 따로 다시 디코딩해 검사했습니다. 선택 실행으로 500MB가 넘는 1시간 파일의 마지막 1분도 잘라 봅니다. 코덱 지원은 브라우저와 기기에 따라 다릅니다.'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)','[MDN: 미디어 컨테이너 형식](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)']}
  },
  ja:{
   answer:'メディアページは動画または音声ファイルを1つ開き、5つの作業のうち1つを実行します。GIF、MP3・WAVの音声、小さくした動画、切り出した区間、静止フレームです。ファイルはブラウザ内で少しずつ読み込まれ、Mediabunny 1.58.1がコンテナ（MP4、MOV、WebM、MKV、MP3、WAV、Oggなど）をトラックに分け、残りはブラウザのWebCodecsのデコーダーとエンコーダーが処理します。そのため使えるかどうかは拡張子ではなく、中のコーデックとブラウザで決まります。',
   concept:{title:'コンテナとコーデック、作業ごとに必要なデコーダー',body:[
    '動画ファイルは、別々に圧縮されたトラックを入れたコンテナ（MP4、MOV、WebM、MKV）です。通常は映像トラック1本（H.264、HEVC、VP9、AV1など）と音声トラック1本（AAC、Opus、MP3、PCMなど）が入っています。ファイルを開くのはコンテナを読むだけで、デコードにはコーデックごとのデコーダーが必要です。ブラウザはそれをWebCodecsで提供しますが、MDNによればブラウザや端末がWebCodecsの定めるコーデックの一部しか対応しないこともあります。',
    '5つの作業は必要なものが違います。GIFと静止フレームは映像トラックをデコードします。音声の書き出しは音声トラックだけをデコードして映像は捨てるので、映像コーデックに非対応でも動きます。精密カットと圧縮は両方のトラックをデコードして再エンコードします。高速カットは圧縮済みのパケットをデコードせずにコピーするので、そのコーデックを受け入れるコンテナさえあれば済みます。',
    '結果は可能ならメモリにためず、ブラウザ専用の保存領域（OPFS）の一時ファイルに書き込みます。結果を消すと削除され、7日たつと整理されます。WebCodecsがない場合はリアルタイムで録画する互換モードになり、動画10分、音声は元ファイル20分まで、GIFは20秒・8fps・480pxという上限があります。'],
    terms:[['コンテナ','トラックとそのタイミングを入れるファイル形式。MP4、MOV、WebM、MKV、WAVなど。'],['コーデック','1本のトラックの圧縮方式。映像はH.264・HEVC・VP9・AV1、音声はAAC・Opus・MP3・PCMなど。'],['デマックス・マックス','コンテナをトラックに分けること、トラックを新しいコンテナに書き込むこと。'],['WebCodecs','Webページが端末の音声・映像のデコーダーとエンコーダーを使えるようにするブラウザーAPI。']]},
   example:{title:'例：iPhoneの動画1本で5つの作業',lead:'カメラ設定「高効率」で撮った1920 × 1080のMOV（HEVC映像、AAC音声）を、HEVCデコーダーのないブラウザで開いた場合：',lines:[
    '開く         コンテナ QuickTime、映像 hevc 1920 × 1080、音声 aac  → 開ける',
    '音声         映像トラックは捨て、AACだけデコード        → MP3は成功',
    'カット・高速  パケットをMP4にコピー、デコードなし       → コピー経路なのでHEVCデコーダー不要',
    'GIF、フレーム デコードしたHEVCのフレームが必要         → デコーダーのエラーで停止',
    '圧縮         デコードしたHEVCのフレームが必要         → デコーダーのエラーで停止',
    'HEVCをデコードできるブラウザで同じファイル             → 5つとも実行できる'],
    after:'つまり「非対応」はたいてい「この環境ではこのコーデックに非対応」という意味です。ファイルのコーデックを調べる方法と、H.264で撮影する方法は[[video/mov-to-gif|MOVをGIFにするガイド]]にあります。'},
   mapping:{title:'作業ごとに読むものと書くもの',head:['作業','読むもの','デコーダーが必要なコーデック','結果'],rows:[
    ['GIF','映像トラックだけ','映像コーデック','GIF、1フレーム最大256色'],
    ['音声','音声トラックだけ','音声コーデック','MP3（128–320 kbit/s）または16ビットWAV'],
    ['圧縮','映像と音声','両方のコーデック','H.264のMP4、またはVP9・VP8・AV1のWebM'],
    ['カット・精密','映像と音声','両方のコーデック','再エンコードしたMP4またはWebM'],
    ['カット・高速','圧縮済みパケット','なし（コピー）','元のコーデックのままのMP4またはWebM'],
    ['フレーム','映像の1フレーム','映像コーデック','元の解像度のPNG・JPG・WebP']]},
   verify:{steps:[
    '開くとファイルの行に解像度・長さ・容量が表示されます。「音声のみ」なら扱える映像トラックがありません。',
    '実行後、結果の欄に前後の容量と、動画なら出力解像度が出ます。ダウンロード前に「結果」タブで再生してください。',
    '「結果」と「元の動画」のタブを切り替えて、同じ瞬間を見比べます。']},
   trouble:{rows:[
    ['ファイルがまったく開かない','読み込み側が知らないコンテナか、ファイルの破損','別のプレーヤーで再生し、ffprobeで形式を確認','作ったアプリからMP4（H.264・AAC）で書き出し直す'],
    ['開けるが、GIF・フレーム・圧縮がデコーダーのエラーで止まる','ブラウザにこの映像コーデックのデコーダーがない（主にHEVCやProRes）','ffprobeでコーデックを見るか、別のブラウザで同じファイルを試す','デコードできるブラウザを使うかH.264で撮影。映像をデコードしない音声書き出しと高速カットは可能'],
    ['互換モードの案内が出る','このブラウザにWebCodecsがなく、以前のリアルタイム方式を使う','オプションの下の案内','最新のChrome・Edge・Firefoxを使う。互換モードではタブを表示したままにする'],
    ['音声の作業しか実行できない','ファイルに映像トラックがない','ファイルの行に音声のみと出る','正常です。音声を変換するか、動画ファイルを開いてください'],
    ['結果が元より大きい','よく圧縮された元の動画を、より高い画質で再エンコードした','結果の欄に増加率が出る','小さめの画質・解像度の上限・目標容量を使い、切り出すだけなら高速カット']]},
   alternatives:{rows:[
    ['パソコンのFFmpeg','一括処理、スクリプト、ブラウザがデコードできないコーデック（ProRes、多くのサラウンド形式）が必要なとき。プレビューはなく、コマンドラインだけです。'],
    ['作業ごとのページ：[[video/to-gif|動画をGIFに]]、[[video/to-mp3|動画をMP3に]]、[[video/trim|切り出し]]、[[video/compress|圧縮]]、[[video/frame|フレーム]]','同じエンジンで、1つの作業の設定があらかじめ選ばれたページです。']]},
   limits:['コーデック対応はブラウザが決めます。HEVC・ProRes・サラウンド音声のデコーダーをここで追加することはありません。','一度に1ファイル、主な映像と音声のトラック1本ずつだけを扱います。追加の音声トラックと字幕は外れます。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使い、音声付き6秒・1920 × 1080のMP4テスト信号で確認しました。高速・精密カットが長さと音声を保ち、MP3・WAV・GIF・フレームの作業が指定どおりの結果を出し、出力はFFprobeとPillowで別途デコードし直して検査しています。任意の実行で、500MBを超える1時間のファイルの最後の1分も切り出します。コーデック対応はブラウザと端末によって異なります。'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)','[MDN: メディアコンテナ形式](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)']}
  }
 },
 'video/trim':{
  type:'tool',
  intent:{primary:'trim or cut a video online without re-encoding, or precisely',secondary:['cut a clip from a long video','why the cut starts at a keyframe','lossless trim'],
   goal:'a shorter MP4 or WebM with the intended start and end, knowing the fast/precise trade-off',input:'a video file (MP4, MOV, WebM, MKV…)',output:'MP4 or WebM (<name>-cut.mp4/.webm)',support:'full',
   evidence:['src/media-modern-worker.js encodePass (fast: copy mode forced, boundaryPolicy shrink; precise: forceTranscode, avc for MP4, vp9/vp8/av1 for WebM)','assets/vendor/mediabunny-1.58.1/src/conversion.ts (shrink starts at the next key packet, ends before the out point)','tests/media-browser.mjs (fast duration ±1.1 s, precise ±0.12 s, 1 h file late remux)'],
   external:['FFmpeg documentation: -ss seeks to the closest seek point before the position; stream copy preserves that segment','MDN video codec guide: key frames']},
  en:{
   answer:'Set the in and out points on the timeline and choose how to cut. Fast copies the compressed video and audio without re-encoding: it is almost instant and loses no quality, but a copy can only begin on a keyframe, so Nerulio starts the clip at the first keyframe inside your selection. Precise decodes and re-encodes the section, so it starts and ends exactly where you set them, at the cost of time and one more generation of compression. The result is MP4 (H.264 when your browser can encode it) or WebM.',
   concept:{title:'Keyframes, and why a copy cannot start anywhere',body:[
    'Compressed video stores a complete picture only now and then. These keyframes (I-frames) can be decoded on their own; the frames between them store only changes and need the frames before them. How far apart keyframes are depends on the encoder and its settings: a fraction of a second in some files, several seconds in others.',
    'A cut that copies packets therefore has to start on a keyframe, and tools choose differently. FFmpeg documents that with stream copy it seeks to the closest seek point before the requested time and keeps that extra piece, so the clip starts early. Nerulio\'s Fast mode shrinks instead: the video starts at the first keyframe inside your selection, so nothing you excluded appears, but up to one keyframe interval at the start can be lost. The end stays at your out point.',
    'Precise mode decodes every frame of the section and writes a new stream that begins with its own keyframe at your in point. It can also cap the resolution or remove the sound. Fast mode can remove the sound too, but it ignores the resolution cap because nothing is re-encoded.'],
    terms:[['Keyframe (I-frame)','A frame stored as a complete picture; decoding can start there.'],['GOP','Group of pictures: a keyframe and the frames that depend on it, up to the next keyframe.'],['Stream copy (remux)','Moving compressed packets into a new container without decoding: fast, lossless, bound to keyframes.']]},
   example:{title:'Example: keyframes every 2 s, selection from 3.40 s to 9.00 s',lead:'The same selection cut three ways:',lines:[
    'Keyframes in the source        0.00  2.00  4.00  6.00  8.00  10.00 s',
    'Your selection                 3.40 → 9.00 s   5.60 s',
    'Nerulio Fast                   4.00 → 9.00 s   5.00 s   first 0.60 s dropped',
    'Copy from the earlier keyframe 2.00 → 9.00 s   7.00 s   1.40 s extra at the start',
    '  (FFmpeg -ss before -i, -c copy)',
    'Nerulio Precise                3.40 → 9.00 s   5.60 s   re-encoded'],
    after:'If the first 0.60 s matter, move the in point back onto the keyframe at 2.00 s or use Precise. Nerulio\'s test suite accepts a fast cut within 1.1 s of the requested length and a precise cut within 0.12 s.'},
   mapping:{title:'Fast or Precise',head:['','Fast · keyframes','Precise · re-encode'],rows:[
    ['Start point','First keyframe inside the selection','Exactly your in point'],
    ['Speed','Copies packets; mostly limited by reading the file','Decodes and encodes every frame'],
    ['Picture quality','Identical to the source','One more generation of compression'],
    ['Codecs in the result','The source codecs','H.264 in MP4, or VP9, VP8 or AV1 in WebM'],
    ['Resolution cap and mute','Mute works, the cap is ignored','Both apply'],
    ['Needs a decoder','No','Yes, for the video and the audio codec']]},
   verify:{steps:[
    'Compare the result\'s length in the player with the span under the timeline: Fast may be shorter at the start, Precise should match.',
    'Play the first second of a fast cut: it begins on a clean full frame, later than your in point when no keyframe was there.',
    'Check that the sound is there (unless you chose Remove sound): the export stops with an error instead of silently dropping a track.']},
   trouble:{rows:[
    ['A fast cut to WebM stops with "A required video/audio track cannot be preserved"','WebM accepts only VP8, VP9 or AV1 video and Opus or Vorbis audio, so H.264, HEVC or AAC from an MP4 or MOV cannot be copied into it','The source is MP4 or MOV','Choose MP4 for fast cuts, or use Precise'],
    ['The fast clip starts later than the in point','There is no keyframe at the in point, so the copy starts at the next one','Compare the result length with the selection','Move the in point earlier, or use Precise'],
    ['MP4 is missing from the format list','The browser reports no H.264 encoder','Only WebM is offered under Advanced','Export WebM, or use a browser with an H.264 encoder'],
    ['The export stopped when you switched tabs','Only the compatibility recorder, used without WebCodecs, needs a visible tab','The compatibility note is shown','Keep the tab visible, or use a browser with WebCodecs'],
    ['A fast MP4 cut from a WebM will not play in some apps','The copied VP9 or AV1 video and Opus audio now sit in an MP4 container, which not every player expects','ffprobe shows the codecs','Cut WebM sources to WebM, or use Precise for H.264']]},
   alternatives:{rows:[
    ['FFmpeg with `-ss` before `-i` and `-c copy`','Scripted or batch cuts. Per its documentation, the copied cut keeps the part from the earlier keyframe, so it includes a little extra instead of losing it.'],
    ['A desktop video editor','Several clips, transitions, or edits that must be frame-exact without re-encoding the whole section.'],
    ['[[video/compress|Compress the clip]]','When the goal is a smaller file rather than a shorter one.']]},
   limits:['Fast cuts start on a keyframe; there is no smart mode that re-encodes only the partial group of pictures at the start.','One continuous section per export; joining sections needs a desktop editor.','Only the primary video and audio track are kept.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155: a fast cut of 1–4 s from a 1920 × 1080 H.264/AAC MP4 keeps its audio and lands within 1.1 s of the requested length; a precise cut of 1.25–3.75 s lands within 0.12 s; in the optional large-file run, a fast cut of the last minute of a 500 MB+ one-hour file came out 60 s long, within 1 s, with audio. Engine: Mediabunny 1.58.1 with WebCodecs. The FFmpeg behaviour is quoted from its documentation.'],sources:['[FFmpeg documentation: -ss and stream copy](https://ffmpeg.org/ffmpeg.html)','[MDN: Web video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  },
  ko:{
   answer:'타임라인에서 시작점과 끝점을 정하고 자르는 방식을 고르세요. 빠르게는 압축된 영상과 음성을 다시 인코딩하지 않고 복사하므로 거의 즉시 끝나고 화질 손실이 없지만, 복사는 키프레임에서만 시작할 수 있어 Nerulio는 선택 구간 안의 첫 키프레임부터 자릅니다. 정밀은 구간을 디코딩해 다시 인코딩하므로 정한 위치에서 정확히 시작하고 끝나며, 대신 시간이 걸리고 압축이 한 번 더 들어갑니다. 결과는 MP4(브라우저가 H.264를 인코딩할 수 있을 때) 또는 WebM입니다.',
   concept:{title:'키프레임, 그리고 복사가 아무 데서나 시작할 수 없는 이유',body:[
    '압축된 영상은 완전한 그림을 가끔씩만 저장합니다. 이 키프레임(I프레임)은 혼자 디코딩할 수 있고, 그 사이 프레임은 바뀐 부분만 담고 있어 앞 프레임이 있어야 디코딩됩니다. 키프레임 간격은 인코더와 설정에 따라 달라서 1초보다 짧은 파일도, 몇 초인 파일도 있습니다.',
    '그래서 패킷을 복사하는 자르기는 키프레임에서 시작해야 하고, 도구마다 선택이 다릅니다. FFmpeg 문서에 따르면 스트림 복사에서는 요청한 시각 바로 앞의 탐색 지점으로 가서 그 여분을 남기므로 클립이 일찍 시작합니다. Nerulio의 빠르게는 반대로 줄입니다. 영상이 선택 구간 안의 첫 키프레임에서 시작하므로 뺀 부분은 나오지 않지만, 앞쪽에서 최대 키프레임 간격 하나만큼 잘려 나갈 수 있습니다. 끝은 정한 끝점 그대로입니다.',
    '정밀은 구간의 모든 프레임을 디코딩해 시작점에 자체 키프레임이 있는 새 스트림을 씁니다. 해상도 상한과 소리 없애기도 적용됩니다. 빠르게도 소리는 없앨 수 있지만, 다시 인코딩하지 않으므로 해상도 상한은 무시합니다.'],
    terms:[['키프레임(I프레임)','완전한 그림으로 저장된 프레임. 디코딩을 여기서 시작할 수 있습니다.'],['GOP','픽처 그룹. 키프레임과 그에 기대는 프레임들로, 다음 키프레임 직전까지입니다.'],['스트림 복사(리먹스)','압축된 패킷을 디코딩 없이 새 컨테이너로 옮기는 것. 빠르고 무손실이지만 키프레임에 묶입니다.']]},
   example:{title:'예시: 2초마다 키프레임, 선택 구간 3.40초~9.00초',lead:'같은 구간을 세 가지 방법으로 자르면:',lines:[
    '원본의 키프레임                0.00  2.00  4.00  6.00  8.00  10.00 s',
    '선택 구간                      3.40 → 9.00 s   5.60 s',
    'Nerulio 빠르게                 4.00 → 9.00 s   5.00 s   앞 0.60 s 빠짐',
    '앞 키프레임부터 복사           2.00 → 9.00 s   7.00 s   앞에 1.40 s 추가',
    '  (FFmpeg -i 앞에 -ss, -c copy)',
    'Nerulio 정밀                   3.40 → 9.00 s   5.60 s   다시 인코딩'],
    after:'앞의 0.60초가 중요하다면 시작점을 2.00초 키프레임으로 옮기거나 정밀을 쓰세요. Nerulio 테스트는 빠른 자르기가 요청 길이와 1.1초 이내, 정밀 자르기가 0.12초 이내이면 통과로 봅니다.'},
   mapping:{title:'빠르게와 정밀 비교',head:['','빠르게 · 키프레임','정밀 · 재인코딩'],rows:[
    ['시작 지점','선택 구간 안의 첫 키프레임','정한 시작점 그대로'],
    ['속도','패킷 복사, 주로 파일 읽기 속도에 좌우','모든 프레임을 디코딩·인코딩'],
    ['화질','원본과 같음','압축이 한 번 더 들어감'],
    ['결과의 코덱','원본 코덱','MP4는 H.264, WebM은 VP9·VP8·AV1'],
    ['해상도 상한·소리 없애기','소리 없애기만 적용, 상한은 무시','둘 다 적용'],
    ['디코더 필요','아니요','예, 영상·음성 코덱 모두']]},
   verify:{steps:[
    '플레이어의 결과 길이를 타임라인 아래 구간 길이와 비교하세요. 빠르게는 앞이 짧을 수 있고, 정밀은 같아야 합니다.',
    '빠르게 자른 결과의 첫 1초를 재생해 보세요. 깨끗한 온전한 프레임으로 시작하며, 시작점에 키프레임이 없었다면 그보다 늦게 시작합니다.',
    '소리 없애기를 고르지 않았다면 소리가 있는지 확인하세요. 트랙이 빠질 상황이면 조용히 빼지 않고 오류로 멈춥니다.']},
   trouble:{rows:[
    ['WebM으로 빠르게 자르면 "A required video/audio track cannot be preserved"가 뜸','WebM은 VP8·VP9·AV1 영상과 Opus·Vorbis 음성만 받아서, MP4·MOV의 H.264·HEVC·AAC를 복사해 넣을 수 없음','원본이 MP4나 MOV임','빠른 자르기는 MP4로 저장하거나 정밀 사용'],
    ['빠른 자르기 결과가 시작점보다 늦게 시작함','시작점에 키프레임이 없어 다음 키프레임부터 복사함','결과 길이와 선택 구간 비교','시작점을 앞으로 옮기거나 정밀 사용'],
    ['형식 목록에 MP4가 없음','브라우저에 H.264 인코더가 없다고 보고됨','고급 설정에 WebM만 있음','WebM으로 저장하거나 H.264 인코더가 있는 브라우저 사용'],
    ['탭을 바꾸자 저장이 멈춤','WebCodecs가 없을 때 쓰는 호환 녹화만 탭이 보여야 함','호환 모드 안내가 떠 있음','탭을 화면에 두거나 WebCodecs가 있는 브라우저 사용'],
    ['WebM에서 빠르게 자른 MP4가 일부 앱에서 재생되지 않음','복사된 VP9·AV1 영상과 Opus 음성이 MP4 안에 들어가는데, 모든 플레이어가 이를 예상하지는 않음','ffprobe로 코덱 확인','WebM 원본은 WebM으로 자르거나, 정밀로 H.264를 만들기']]},
   alternatives:{rows:[
    ['`-i` 앞에 `-ss`, 그리고 `-c copy`를 쓴 FFmpeg','스크립트나 일괄 자르기. 문서에 따르면 복사 자르기는 앞 키프레임부터의 부분을 남기므로, 잃는 대신 조금 더 들어갑니다.'],
    ['데스크톱 영상 편집기','여러 클립, 장면 전환, 구간 전체를 다시 인코딩하지 않고 프레임 단위로 정확해야 하는 편집.'],
    ['[[video/compress|영상 압축]]','짧게가 아니라 작게 만드는 것이 목적일 때.']]},
   limits:['빠른 자르기는 키프레임에서 시작합니다. 앞쪽의 불완전한 GOP만 다시 인코딩하는 스마트 모드는 없습니다.','한 번에 연속된 구간 하나만 저장합니다. 구간을 이어 붙이려면 데스크톱 편집기가 필요합니다.','기본 영상·음성 트랙 하나씩만 남습니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 확인했습니다. 1920 × 1080 H.264/AAC MP4에서 1~4초를 빠르게 자르면 음성이 유지되고 요청 길이와 1.1초 이내로 맞으며, 1.25~3.75초 정밀 자르기는 0.12초 이내입니다. 선택 실행인 대용량 테스트에서는 500MB가 넘는 1시간 파일의 마지막 1분을 빠르게 잘라 음성과 함께 60초 ±1초가 나왔습니다. 엔진은 Mediabunny 1.58.1과 WebCodecs입니다. FFmpeg의 동작은 공식 문서를 인용했습니다.'],sources:['[FFmpeg 문서: -ss와 스트림 복사](https://ffmpeg.org/ffmpeg.html)','[MDN: 웹 영상 코덱 안내](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  },
  ja:{
   answer:'タイムラインで開始点と終了点を決め、切り出し方を選びます。高速は圧縮された映像と音声を再エンコードせずにコピーするので、ほぼ一瞬で終わり画質も落ちません。ただしコピーはキーフレームからしか始められないため、Nerulioは選択範囲内の最初のキーフレームから切り出します。精密は区間をデコードして再エンコードするので、指定した位置で正確に始まり終わりますが、時間がかかり圧縮が1回増えます。結果はMP4（ブラウザがH.264をエンコードできる場合）またはWebMです。',
   concept:{title:'キーフレームと、コピーがどこからでも始められない理由',body:[
    '圧縮された動画は、完全な絵をときどきしか保存しません。このキーフレーム（Iフレーム）は単独でデコードでき、その間のフレームは変化だけを持つため、前のフレームがないとデコードできません。キーフレームの間隔はエンコーダーと設定次第で、1秒未満のファイルも数秒のファイルもあります。',
    'そのためパケットをコピーする切り出しはキーフレームから始める必要があり、ツールによって選び方が違います。FFmpegのドキュメントでは、ストリームコピーでは指定時刻の手前のシーク位置へ移動し、その余分を残すため、クリップが早めに始まります。Nerulioの高速は逆に縮めます。映像は選択範囲内の最初のキーフレームから始まるので除いた部分は入りませんが、先頭でキーフレーム間隔1つ分までが失われることがあります。終わりは終了点のままです。',
    '精密は区間の全フレームをデコードし、開始点に独自のキーフレームを置いた新しいストリームを書きます。解像度の上限と音声の削除も使えます。高速でも音声は削除できますが、再エンコードしないため解像度の上限は無視されます。'],
    terms:[['キーフレーム（Iフレーム）','完全な絵として保存されたフレーム。ここからデコードを始められます。'],['GOP','グループ・オブ・ピクチャー。キーフレームとそれに依存するフレームで、次のキーフレームの直前までです。'],['ストリームコピー（リマックス）','圧縮済みのパケットをデコードせずに新しいコンテナへ移すこと。速く劣化しませんが、キーフレームに縛られます。']]},
   example:{title:'例：2秒ごとのキーフレーム、選択範囲3.40秒〜9.00秒',lead:'同じ範囲を3通りに切り出すと：',lines:[
    '元動画のキーフレーム           0.00  2.00  4.00  6.00  8.00  10.00 s',
    '選択範囲                       3.40 → 9.00 s   5.60 s',
    'Nerulio 高速                   4.00 → 9.00 s   5.00 s   先頭0.60 sが落ちる',
    '手前のキーフレームからコピー   2.00 → 9.00 s   7.00 s   先頭に1.40 s余分',
    '  （FFmpeg -iの前に-ss、-c copy）',
    'Nerulio 精密                   3.40 → 9.00 s   5.60 s   再エンコード'],
    after:'先頭の0.60秒が大事なら、開始点を2.00秒のキーフレームへずらすか精密を使ってください。Nerulioのテストでは、高速カットは指定の長さから1.1秒以内、精密カットは0.12秒以内を合格としています。'},
   mapping:{title:'高速と精密の比較',head:['','高速 · キーフレーム','精密 · 再エンコード'],rows:[
    ['開始位置','選択範囲内の最初のキーフレーム','指定した開始点どおり'],
    ['速さ','パケットのコピー。主にファイルの読み込み速度で決まる','全フレームをデコード・エンコード'],
    ['画質','元と同じ','圧縮が1回増える'],
    ['結果のコーデック','元のコーデック','MP4はH.264、WebMはVP9・VP8・AV1'],
    ['解像度の上限・音声の削除','音声の削除だけ有効、上限は無視','どちらも有効'],
    ['デコーダーの要否','不要','必要（映像と音声の両方）']]},
   verify:{steps:[
    'プレーヤーで結果の長さを、タイムライン下の区間の長さと比べます。高速は先頭が短くなることがあり、精密は一致するはずです。',
    '高速で切った結果の最初の1秒を再生します。きれいな完全なフレームから始まり、開始点にキーフレームがなければそれより遅れて始まります。',
    '音声の削除を選んでいなければ、音があるか確認します。トラックが失われる場合は黙って外さず、エラーで止まります。']},
   trouble:{rows:[
    ['WebMへの高速カットで「A required video/audio track cannot be preserved」と出る','WebMはVP8・VP9・AV1の映像とOpus・Vorbisの音声しか受け付けず、MP4・MOVのH.264・HEVC・AACはコピーできない','元がMP4かMOV','高速カットはMP4で保存するか、精密を使う'],
    ['高速カットが開始点より遅れて始まる','開始点にキーフレームがなく、次のキーフレームからコピーした','結果の長さと選択範囲を比べる','開始点を前にずらすか、精密を使う'],
    ['形式の一覧にMP4がない','ブラウザがH.264エンコーダーなしと報告している','詳細設定にWebMしかない','WebMで保存するか、H.264エンコーダーのあるブラウザを使う'],
    ['タブを切り替えたら保存が止まった','WebCodecsがない場合に使う互換録画だけは、タブの表示が必要','互換モードの案内が出ている','タブを表示したままにするか、WebCodecsのあるブラウザを使う'],
    ['WebMから高速カットしたMP4が一部のアプリで再生できない','コピーしたVP9・AV1の映像とOpusの音声がMP4に入っており、すべてのプレーヤーが想定しているわけではない','ffprobeでコーデックを確認','WebMの元動画はWebMで切り出すか、精密でH.264にする']]},
   alternatives:{rows:[
    ['`-i`の前に`-ss`、そして`-c copy`を使うFFmpeg','スクリプトや一括の切り出し。ドキュメントによれば、コピーの切り出しは手前のキーフレームからの部分を残すので、失う代わりに少し余分に入ります。'],
    ['デスクトップの動画編集ソフト','複数のクリップ、トランジション、区間全体を再エンコードせずにフレーム単位で正確さが必要な編集。'],
    ['[[video/compress|動画を圧縮]]','短くするのではなく小さくするのが目的のとき。']]},
   limits:['高速カットはキーフレームから始まります。先頭の不完全なGOPだけを再エンコードするスマートモードはありません。','1回の書き出しで連続した区間1つだけです。区間をつなぐにはデスクトップの編集ソフトが必要です。','主な映像と音声のトラック1本ずつだけが残ります。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使って確認しました。1920 × 1080のH.264/AAC MP4から1〜4秒を高速で切ると音声が保たれ、指定の長さと1.1秒以内で一致し、1.25〜3.75秒の精密カットは0.12秒以内です。任意の大容量テストでは、500MBを超える1時間のファイルの最後の1分を高速カットし、音声付きで60秒±1秒になりました。エンジンはMediabunny 1.58.1とWebCodecsです。FFmpegの動作は公式ドキュメントからの引用です。'],sources:['[FFmpegドキュメント：-ssとストリームコピー](https://ffmpeg.org/ffmpeg.html)','[MDN：Web動画コーデックガイド](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  }
 },
 'video/frame':{
  type:'tool',
  intent:{primary:'save a frame of a video as an image (PNG, JPG) at full resolution',secondary:['video screenshot at original quality','extract a still from MP4','exact frame at a time'],
   goal:'a still image of the exact frame, at the video\'s own resolution, upright',input:'a video file',output:'PNG, JPG or WebP (<name>-frame.png)',support:'full',
   evidence:['src/media-modern-worker.js extract (CanvasSink getCanvas at the time; PNG/JPEG/WebP at 0.94; rotation from metadata)','src/task/media.js (STEP = 1/30 s; frame costs no quota)','tests/media-browser.mjs (3840 × 2160 PNG and JPEG at source size)'],
   external:['MDN: WebCodecs API']},
  en:{
   answer:'Pause the video on the moment you want and save that frame as PNG, JPG or WebP at the video\'s own resolution: a 4K source gives a 3840 × 2160 image whatever size the preview has on screen. The frame is decoded again from the file with WebCodecs, so it is the real frame rather than a screenshot of the player, and a phone video\'s rotation is applied. Saving a still does not count as an encoded export.',
   concept:{title:'Which frame you get, and at what size',body:[
    'Every video frame covers a short span of time. When you save at time t, Nerulio decodes the last frame that starts at or before t, which is the frame on screen at that moment. At 29.97 fps a frame lasts 33.4 ms, so any time inside that span gives the same picture.',
    'The image has the decoded frame\'s full size after the file\'s rotation metadata is applied, so a portrait phone clip that is stored sideways comes out upright. PNG keeps every pixel exactly; JPG and WebP are written at quality 0.94, which is far smaller for photographic frames.',
    'The ⏮ and ⏭ buttons and the arrow keys on a trim handle move by 1/30 s (Shift moves 1 s). On 30 fps video that is one frame; on 60 fps video it skips every other frame, and on 24 fps video two presses can land on the same frame.'],
    terms:[['Presentation time','When a frame is shown; it stays on screen until the next frame starts.'],['Source resolution','The coded picture size of the video track, such as 3840 × 2160, independent of the preview size.'],['Rotation metadata','A flag in phone videos saying the stored picture must be turned by 90°, 180° or 270° for display.']]},
   example:{title:'Example: a 29.97 fps 4K clip, frame at 12.345 s',lead:'For a constant-rate clip that starts at 0 s:',lines:[
    'Frame duration        1 ÷ 29.97 = 0.0334 s',
    'Frame index           floor(12.345 × 29.97) = floor(369.98) = 369',
    'That frame is shown   369 ÷ 29.97 = 12.312 s  until  370 ÷ 29.97 = 12.346 s',
    'Saved image           3840 × 2160 px',
    'Raw pixels            3840 × 2160 × 4 bytes = 33.2 MB before PNG/JPG encoding',
    'One press of ⏭        12.345 + 0.0333 = 12.378 s → frame 370'],
    after:'PNG keeps every pixel of that frame; for a detailed 4K frame JPG or WebP is much smaller, as the test suite confirms for JPG.'},
   verify:{steps:[
    'The result box shows the saved image\'s dimensions: they should equal the source dimensions in the file line.',
    'Zoom into the saved image at 100 %: fine detail should match the video, not the smaller preview.',
    'If the exact moment matters, step with ⏮ / ⏭ and save again; the time on the clock is the time used.']},
   trouble:{rows:[
    ['The frame looks blurred','Motion blur or compression in the source frame itself; the capture adds none','Step one frame forward and back; neighbouring frames may be sharper','Pick a frame where the motion pauses'],
    ['Saving stops with "No frame at this timestamp" or a decoder error','The video codec cannot be decoded in this browser (for example HEVC or ProRes), or the time is after the last frame','ffprobe shows the codec; try a slightly earlier time','Use a browser that decodes the codec, or export the video again as H.264'],
    ['The image is sideways','The file carries no rotation flag, or one the reader does not use','Compare with the phone\'s own player','Rotate the saved image in [[image/editor|the image editor]]'],
    ['Colours look flatter than in the phone\'s gallery','An HDR recording is converted to an 8-bit image when it is drawn, and that conversion is the browser\'s','Check whether the clip was recorded in HDR','Record in SDR when stills matter, or adjust the image afterwards'],
    ['The file is much larger than expected','A PNG of a detailed 4K frame','Result size in the result box','Choose JPG or WebP, or [[image/compress|compress the image]]']]},
   alternatives:{rows:[
    ['FFmpeg: `ffmpeg -ss 12.345 -i in.mp4 -frames:v 1 frame.png`','Many frames at exact times, in a script.'],
    ['A screenshot of the paused player','Quick for sharing, but limited to the player\'s size on your screen and scaled by it.'],
    ['[[video/to-gif|Video to GIF]]','When one frame is not enough and a short loop is wanted.']]},
   limits:['One frame per save; there is no batch export of every N seconds.','HDR frames become 8-bit images; no HDR still format is written.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155: the frame at 1 s of a 3840 × 2160 test video was saved as a 3840 × 2160 PNG, and the JPEG variant kept that size while using fewer bytes. Frames are decoded with Mediabunny 1.58.1 and WebCodecs; without WebCodecs the frame is drawn from the browser\'s own video player at its native size.'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)']}
  },
  ko:{
   answer:'원하는 순간에서 영상을 멈추고 그 프레임을 영상 자체 해상도의 PNG·JPG·WebP로 저장하세요. 4K 원본이면 화면의 미리보기 크기와 상관없이 3840 × 2160 이미지가 나옵니다. 프레임은 WebCodecs로 파일에서 다시 디코딩하므로 플레이어를 캡처한 것이 아니라 실제 프레임이며, 휴대폰 영상의 회전 정보도 적용됩니다. 정지 이미지 저장은 인코딩 내보내기 횟수에 들어가지 않습니다.',
   concept:{title:'어떤 프레임이, 어떤 크기로 저장되나',body:[
    '영상의 각 프레임은 짧은 시간 동안 보입니다. 시각 t에서 저장하면 Nerulio는 t와 같거나 그보다 먼저 시작하는 마지막 프레임, 즉 그 순간 화면에 보이는 프레임을 디코딩합니다. 29.97fps에서는 한 프레임이 33.4ms이므로 그 안의 어느 시각을 골라도 같은 그림입니다.',
    '이미지는 파일의 회전 정보를 적용한 뒤의 디코딩 프레임 전체 크기입니다. 그래서 옆으로 저장된 세로 휴대폰 영상도 똑바로 나옵니다. PNG는 모든 픽셀을 그대로 두고, JPG와 WebP는 품질 0.94로 쓰여 사진 같은 프레임에서는 훨씬 작습니다.',
    '⏮·⏭ 버튼과 자르기 손잡이의 방향키는 1/30초씩 움직입니다(Shift는 1초). 30fps 영상에서는 한 프레임이지만, 60fps에서는 한 프레임씩 건너뛰고, 24fps에서는 두 번 눌러도 같은 프레임일 수 있습니다.'],
    terms:[['표시 시각','프레임이 보이기 시작하는 시각. 다음 프레임이 시작될 때까지 화면에 남습니다.'],['원본 해상도','영상 트랙에 부호화된 그림 크기(예: 3840 × 2160). 미리보기 크기와 무관합니다.'],['회전 정보','저장된 그림을 90°·180°·270° 돌려 보여야 한다는 휴대폰 영상의 표시.']]},
   example:{title:'예시: 29.97fps 4K 영상, 12.345초의 프레임',lead:'0초에서 시작하는 고정 프레임레이트 영상이라면:',lines:[
    '프레임 길이           1 ÷ 29.97 = 0.0334 s',
    '프레임 번호           floor(12.345 × 29.97) = floor(369.98) = 369',
    '그 프레임이 보이는 때 369 ÷ 29.97 = 12.312 s  부터  370 ÷ 29.97 = 12.346 s 까지',
    '저장되는 이미지       3840 × 2160 px',
    '원시 픽셀             3840 × 2160 × 4 bytes = 33.2 MB (PNG·JPG 인코딩 전)',
    '⏭ 한 번               12.345 + 0.0333 = 12.378 s → 370번 프레임'],
    after:'PNG는 그 프레임의 모든 픽셀을 보존합니다. 세밀한 4K 프레임이라면 JPG나 WebP가 훨씬 작고, JPG는 테스트에서도 확인했습니다.'},
   verify:{steps:[
    '결과 상자에 저장한 이미지의 크기가 나옵니다. 파일 줄의 원본 크기와 같아야 합니다.',
    '저장한 이미지를 100 %로 확대하세요. 작은 미리보기가 아니라 영상과 같은 세부가 보여야 합니다.',
    '정확한 순간이 중요하면 ⏮·⏭로 움직여 다시 저장하세요. 시계에 표시된 시각이 사용됩니다.']},
   trouble:{rows:[
    ['프레임이 흐리게 보임','원본 프레임 자체의 모션 블러나 압축. 캡처가 흐림을 더하지는 않음','앞뒤로 한 프레임씩 움직여 보면 더 선명한 프레임이 있을 수 있음','움직임이 멈춘 프레임 고르기'],
    ['"No frame at this timestamp"나 디코더 오류로 저장이 멈춤','이 브라우저가 영상 코덱을 디코딩하지 못하거나(HEVC·ProRes 등) 시각이 마지막 프레임 뒤임','ffprobe로 코덱을 보고, 조금 앞 시각으로 시도','코덱을 디코딩하는 브라우저를 쓰거나 H.264로 다시 내보내기'],
    ['이미지가 옆으로 누워 있음','파일에 회전 정보가 없거나 읽기 도구가 쓰지 않는 방식','휴대폰 기본 플레이어와 비교','[[image/editor|이미지 편집기]]에서 저장한 이미지를 회전'],
    ['휴대폰 갤러리보다 색이 밋밋함','HDR 영상은 그릴 때 8비트 이미지로 변환되며, 그 변환은 브라우저가 함','HDR로 촬영했는지 확인','정지 이미지가 중요하면 SDR로 촬영하거나 나중에 이미지를 보정'],
    ['파일이 예상보다 훨씬 큼','세밀한 4K 프레임의 PNG','결과 상자의 용량','JPG·WebP를 고르거나 [[image/compress|이미지 압축]]']]},
   alternatives:{rows:[
    ['FFmpeg: `ffmpeg -ss 12.345 -i in.mp4 -frames:v 1 frame.png`','정해진 시각의 프레임을 스크립트로 많이 뽑을 때.'],
    ['멈춘 플레이어의 화면 캡처','공유용으로는 빠르지만, 화면의 플레이어 크기로 제한되고 그 크기로 확대·축소됩니다.'],
    ['[[video/to-gif|영상을 GIF로]]','프레임 하나로는 부족하고 짧은 반복 영상이 필요할 때.']]},
   limits:['한 번에 프레임 하나만 저장합니다. N초마다 일괄로 뽑는 기능은 없습니다.','HDR 프레임은 8비트 이미지가 되며, HDR 정지 이미지 형식으로는 쓰지 않습니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 확인했습니다. 3840 × 2160 테스트 영상의 1초 프레임이 3840 × 2160 PNG로 저장되고, JPEG로 저장해도 크기는 같고 용량은 더 작았습니다. 프레임은 Mediabunny 1.58.1과 WebCodecs로 디코딩하며, WebCodecs가 없으면 브라우저 자체 영상 플레이어에서 원래 크기로 그립니다.'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)']}
  },
  ja:{
   answer:'欲しい瞬間で動画を止め、そのフレームを動画自体の解像度でPNG・JPG・WebPとして保存します。4Kの元動画なら、画面上のプレビューの大きさに関係なく3840 × 2160の画像になります。フレームはWebCodecsでファイルから改めてデコードするので、プレーヤーのスクリーンショットではなく本物のフレームで、スマホ動画の回転情報も反映されます。静止画の保存はエンコードの書き出し回数に数えられません。',
   concept:{title:'どのフレームが、どの大きさで保存されるか',body:[
    '動画の各フレームは短い時間だけ表示されます。時刻tで保存すると、Nerulioはt以前に始まる最後のフレーム、つまりその瞬間に画面に出ているフレームをデコードします。29.97fpsでは1フレームが33.4msなので、その範囲内のどの時刻でも同じ絵になります。',
    '画像は、ファイルの回転情報を適用した後のデコード済みフレームの全体サイズです。そのため横向きに保存された縦長のスマホ動画も正しい向きで出てきます。PNGはすべての画素をそのまま保ち、JPGとWebPは品質0.94で書かれ、写真のようなフレームではずっと小さくなります。',
    '⏮・⏭ボタンと、切り出しハンドル上の矢印キーは1/30秒ずつ動きます（Shiftで1秒）。30fpsの動画なら1フレームですが、60fpsでは1フレームおきになり、24fpsでは2回押しても同じフレームのことがあります。'],
    terms:[['表示時刻','フレームが表示され始める時刻。次のフレームが始まるまで画面に残ります。'],['元の解像度','映像トラックに符号化された絵の大きさ（例：3840 × 2160）。プレビューの大きさとは無関係です。'],['回転情報','保存された絵を90°・180°・270°回して表示するよう示すスマホ動画の情報。']]},
   example:{title:'例：29.97fpsの4K動画、12.345秒のフレーム',lead:'0秒から始まる固定フレームレートの動画なら：',lines:[
    'フレームの長さ        1 ÷ 29.97 = 0.0334 s',
    'フレーム番号          floor(12.345 × 29.97) = floor(369.98) = 369',
    'そのフレームの表示    369 ÷ 29.97 = 12.312 s  から  370 ÷ 29.97 = 12.346 s まで',
    '保存される画像        3840 × 2160 px',
    '生の画素              3840 × 2160 × 4 bytes = 33.2 MB（PNG・JPGのエンコード前）',
    '⏭を1回               12.345 + 0.0333 = 12.378 s → 370番のフレーム'],
    after:'PNGはそのフレームの全画素を保ちます。細かい4KのフレームならJPGやWebPのほうがずっと小さく、JPGはテストでも確認しています。'},
   verify:{steps:[
    '結果の欄に保存した画像のサイズが出ます。ファイルの行にある元の解像度と同じはずです。',
    '保存した画像を100 %で拡大します。小さなプレビューではなく、動画と同じ細部が見えるはずです。',
    '瞬間が重要なら⏮・⏭で動かして保存し直します。時計に表示された時刻が使われます。']},
   trouble:{rows:[
    ['フレームがぼやけている','元のフレーム自体のモーションブラーや圧縮。取り出しでぼけが加わることはない','前後に1フレームずつ動かすと、よりくっきりしたフレームがあるかもしれない','動きが止まったフレームを選ぶ'],
    ['「No frame at this timestamp」やデコーダーのエラーで止まる','このブラウザが映像コーデックをデコードできない（HEVC・ProResなど）、または時刻が最後のフレームより後','ffprobeでコーデックを見て、少し前の時刻で試す','デコードできるブラウザを使うか、H.264で書き出し直す'],
    ['画像が横向きになる','ファイルに回転情報がない、または読み込み側が使わない形式','スマホ標準のプレーヤーと比べる','保存した画像を[[image/editor|画像エディター]]で回転'],
    ['スマホのギャラリーより色が平板','HDR動画は描画時に8ビット画像へ変換され、その変換はブラウザが行う','HDRで撮影したか確認','静止画が大事ならSDRで撮るか、後で画像を補正'],
    ['ファイルが思ったより大きい','細かい4KフレームのPNG','結果の欄の容量','JPG・WebPを選ぶか、[[image/compress|画像を圧縮]]']]},
   alternatives:{rows:[
    ['FFmpeg：`ffmpeg -ss 12.345 -i in.mp4 -frames:v 1 frame.png`','決まった時刻のフレームをスクリプトでたくさん取り出すとき。'],
    ['一時停止したプレーヤーのスクリーンショット','共有用には手早いが、画面上のプレーヤーの大きさに制限され、その大きさに拡大縮小される。'],
    ['[[video/to-gif|動画をGIFに]]','1フレームでは足りず、短いループが欲しいとき。']]},
   limits:['1回の保存で1フレームだけです。N秒ごとの一括書き出しはありません。','HDRのフレームは8ビット画像になり、HDRの静止画形式では書き出しません。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使って確認しました。3840 × 2160のテスト動画の1秒のフレームが3840 × 2160のPNGとして保存され、JPEGでもサイズは同じで容量は小さくなりました。フレームはMediabunny 1.58.1とWebCodecsでデコードし、WebCodecsがない場合はブラウザ自身の動画プレーヤーから元の大きさで描画します。'],sources:['[MDN: WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)']}
  }
 }
};
