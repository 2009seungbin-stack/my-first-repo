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
   example:{title:'예시: 아이폰 영상 하나로 다섯 작업',lead:'카메라 설정 `High Efficiency`로 찍은 1920 × 1080 MOV(HEVC 영상, AAC 음성)를 HEVC 디코더가 없는 브라우저에서 열었을 때:',lines:[
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
   example:{title:'例：iPhoneの動画1本で5つの作業',lead:'カメラ設定`High Efficiency`で撮った1920 × 1080のMOV（HEVC映像、AAC音声）を、HEVCデコーダーのないブラウザで開いた場合：',lines:[
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
 },
 'video/compress':{
  type:'tool',
  intent:{primary:'reduce video file size online, or compress a video to a target size in MB',secondary:['compress video for email or chat limits','lower resolution to 720p','MP4 or WebM output'],
   goal:'a smaller MP4 or WebM, under a target size when one is given, with a known quality cost',input:'a video file',output:'MP4 (H.264) or WebM (VP9/VP8/AV1), <name>-small.mp4',support:'full',
   evidence:['src/media-modern-worker.js convert (95 % budget minus audio, 50 kbit/s floor, up to 4 measured passes via trackBytes, width shrink, preset → Quality low/medium/high)','src/task/media.js (caps 1080/720/480 as height, audio bitrate default 192)','tests/media-browser.mjs (640 px width result, 0.35 MB target met)'],
   external:['MDN video codec guide']},
  en:{
   answer:'Pick a quality (Small, Balanced, High) or type a size to fit under in MB, optionally cap the resolution at 1080p, 720p or 480p or remove the sound, and Nerulio re-encodes the video in your browser: MP4 with H.264 when the browser can encode it, otherwise WebM with VP9, VP8 or AV1. A target is not a guess: the first pass is sized from the duration, and each later pass is corrected by the bytes actually produced, up to four passes, with the resolution lowered when bitrate alone cannot get there.',
   concept:{title:'What decides the size of a video',body:[
    'File size is bitrate × duration. A 60-second clip at 3 Mbit/s of video plus 192 kbit/s of audio is about 60 × 3.192 ÷ 8 ≈ 24 MB, whatever the resolution. Resolution and frame rate decide how good that bitrate looks: the same 3 Mbit/s spread over 1920 × 1080 must drop more detail per pixel than over 1280 × 720.',
    'Without a target, the quality presets tell the encoder how hard to compress and the size follows from the content: a static talk shrinks a lot, confetti and grass do not. A source that was already compressed hard can even grow, and the result box then shows the increase in percent.',
    'With a target, Nerulio budgets 95 % of it, subtracts the audio (bitrate × duration) and gives the rest to video. After each pass it measures the real video and audio bytes in the output, because browser encoders overshoot the bitrate they are asked for, and corrects the next pass. When lowering the bitrate stops paying off, it scales the frame down too. Below 50 kbit/s for video it refuses and asks for a bigger target or a shorter section.'],
    terms:[['Bitrate','Bits per second of a stream; video and audio add up. 1 Mbit/s for 60 s is 7.5 MB.'],['Resolution cap','Limits the output height: 720p keeps a 16:9 video at 1280 × 720 and turns a portrait 1080 × 1920 video into 404 × 718.'],['Pass','One complete encode. A target can take up to four, each one measured.']]},
   example:{title:'Example: fitting a 60-second clip under 25 MB',lead:'With the default 192 kbit/s audio:',lines:[
    'Target          25 MB = 25 × 1,048,576 = 26,214,400 bytes',
    'Budget (95 %)   24,903,680 bytes',
    'Audio           192,000 bit/s × 60 s ÷ 8 = 1,440,000 bytes',
    'Video, pass 1   (24,903,680 − 1,440,000) × 8 ÷ 60 = 3,128,490 bit/s ≈ 3.13 Mbit/s',
    'If still over   next bitrate = current × (97 % of target − audio − container) ÷ video bytes produced',
    'Passes 2–4      same correction; the width shrinks when the bitrate alone stops helping'],
    after:'"MB" here is 1,048,576 bytes, the same unit the result box uses. Removing the sound frees those 1.44 MB for the picture; lowering the audio bitrate under Advanced frees less.'},
   mapping:{title:'Settings and what each one costs',head:['Setting','What it does','Cost'],rows:[
    ['Small / Balanced / High','Encoder quality level when no target is set','The size follows the content and can exceed a well-compressed source'],
    ['Fit under (MB)','Measured passes until the file fits, up to four','Time; may lower the resolution'],
    ['Resolution cap 1080p / 720p / 480p','Limits the output height and never upscales','Detail; portrait video becomes narrow'],
    ['Remove sound','Drops the audio track entirely','No sound'],
    ['Format MP4 / WebM (Advanced)','H.264 in MP4 when the browser has an encoder; otherwise VP9, VP8 or AV1 in WebM','Some apps accept only MP4']]},
   verify:{steps:[
    'The result box shows the size before and after and, with a target, whether it was met and how many passes it took.',
    'Check the output dimensions there too: a smaller width than you chose means the target forced a smaller frame.',
    'Play the result full screen and look at dark gradients, fast motion and small text, which show compression first.']},
   trouble:{rows:[
    ['The result is larger than the original','The source was already compressed hard and the preset asked for more bits','The result box says it grew by a percentage','Choose Small, or set a target below the original size'],
    ['"Target size leaves less than 50 kbit/s for video"','The target is too small for the duration once the audio is subtracted','Target ÷ seconds; audio alone takes 24 KB per second at 192 kbit/s','Raise the target, shorten the section, or remove the sound'],
    ['The target was missed after four passes','The encoder could not go lower at the frame sizes tried','The result note reports the target and the actual size','Set a lower resolution cap yourself, or shorten the clip'],
    ['An error says the audio alone needs more than the target','A long section at 192 kbit/s audio','The message names the kilobytes the audio needs','Lower the audio bitrate under Advanced, or remove the sound'],
    ['MP4 is not offered','The browser has no H.264 encoder','Only WebM appears under Advanced','Use WebM, or another browser']]},
   alternatives:{rows:[
    ['FFmpeg with libx264 and `-crf`','Constant-quality encodes, slower presets for smaller files and batch work; a size target means computing the bitrate yourself.'],
    ['The export settings of the app that recorded or edited the video','When you still have the project: exporting once at the final size avoids compressing twice.'],
    ['[[video/trim|Trim first]]','When most of the clip is not needed, a shorter file is the cheapest reduction.']]},
   limits:['A target is measured, not guaranteed: after four passes the note says if it was missed.','The simple options do not lower the frame rate, and only the primary audio track is kept.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155 on a 1920 × 1080 test clip: an encode capped at 640 px came out 640 px wide and smaller than the source, and a 0.35 MB target was met with the width kept between 320 and 640 px. The measured correction exists because Firefox\'s H.264 and Opus encoders produced about 10 % and 9 % more than the requested bitrate. Engine: Mediabunny 1.58.1 with WebCodecs.'],sources:['[MDN: Web video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  },
  ko:{
   answer:'화질(작게·균형·고화질)을 고르거나 맞출 용량을 MB로 입력하고, 필요하면 해상도 상한(1080p·720p·480p)이나 소리 없애기를 고르면 Nerulio가 브라우저에서 영상을 다시 인코딩합니다. 브라우저가 인코딩할 수 있으면 H.264의 MP4, 아니면 VP9·VP8·AV1의 WebM입니다. 목표 용량은 추측이 아닙니다. 첫 번째 인코딩은 길이로 크기를 정하고, 이후에는 실제로 나온 바이트로 보정하며 최대 네 번까지 인코딩하고, 비트레이트만으로 안 되면 해상도도 낮춥니다.',
   concept:{title:'영상 용량을 정하는 것',body:[
    '파일 크기는 비트레이트 × 길이입니다. 영상 3 Mbit/s와 음성 192 kbit/s로 된 60초 클립은 해상도와 상관없이 60 × 3.192 ÷ 8 ≈ 24 MB입니다. 해상도와 프레임레이트는 그 비트레이트가 얼마나 좋아 보이는지를 정합니다. 같은 3 Mbit/s라도 1920 × 1080에 나누면 1280 × 720보다 픽셀마다 더 많은 세부를 버려야 합니다.',
    '목표 용량이 없으면 화질 설정이 인코더에 압축 강도를 알려 주고, 크기는 내용에 따라 정해집니다. 가만히 말하는 영상은 많이 줄고, 꽃가루나 풀밭은 잘 줄지 않습니다. 이미 강하게 압축된 원본은 오히려 커질 수 있으며, 그때 결과 상자에 증가율이 나옵니다.',
    '목표가 있으면 그 95 %를 예산으로 잡고 음성(비트레이트 × 길이)을 뺀 나머지를 영상에 씁니다. 브라우저 인코더는 요청한 비트레이트를 넘기곤 하므로, 한 번 인코딩할 때마다 결과의 실제 영상·음성 바이트를 재서 다음 인코딩을 보정합니다. 비트레이트를 낮춰도 효과가 줄어들면 화면 크기도 줄입니다. 영상에 50 kbit/s도 남지 않으면 더 큰 목표나 더 짧은 구간을 요청하며 거절합니다.'],
    terms:[['비트레이트','스트림의 초당 비트 수. 영상과 음성을 더합니다. 1 Mbit/s로 60초면 7.5 MB입니다.'],['해상도 상한','출력 높이를 제한합니다. 720p에서 16:9 영상은 1280 × 720, 세로 1080 × 1920 영상은 404 × 718이 됩니다.'],['패스','한 번의 전체 인코딩. 목표 용량은 최대 네 번까지 걸리며 매번 크기를 잽니다.']]},
   example:{title:'예시: 60초 클립을 25 MB 아래로 맞추기',lead:'기본 음성 192 kbit/s일 때:',lines:[
    '목표            25 MB = 25 × 1,048,576 = 26,214,400 bytes',
    '예산(95 %)      24,903,680 bytes',
    '음성            192,000 bit/s × 60 s ÷ 8 = 1,440,000 bytes',
    '영상, 1회차     (24,903,680 − 1,440,000) × 8 ÷ 60 = 3,128,490 bit/s ≈ 3.13 Mbit/s',
    '아직 크면       다음 비트레이트 = 현재 × (목표의 97 % − 음성 − 컨테이너) ÷ 실제 영상 바이트',
    '2~4회차         같은 보정, 비트레이트만으로 안 되면 폭을 줄임'],
    after:'여기서 MB는 1,048,576바이트로, 결과 상자와 같은 단위입니다. 소리를 없애면 음성의 1.44 MB가 그대로 화질에 쓰이고, 고급 설정에서 음성 비트레이트를 낮추는 것은 그보다 효과가 작습니다.'},
   mapping:{title:'설정과 각각의 대가',head:['설정','하는 일','대가'],rows:[
    ['작게·균형·고화질','목표가 없을 때의 인코더 화질 단계','크기는 내용을 따르며 잘 압축된 원본보다 커질 수 있음'],
    ['목표 용량(MB)','맞을 때까지 크기를 재며 최대 네 번 인코딩','시간이 걸리고 해상도가 낮아질 수 있음'],
    ['해상도 상한 1080p·720p·480p','출력 높이를 제한하며 키우지는 않음','세부 손실, 세로 영상은 폭이 좁아짐'],
    ['소리 없이','음성 트랙을 통째로 뺌','소리 없음'],
    ['형식 MP4·WebM(고급)','브라우저에 인코더가 있으면 H.264의 MP4, 아니면 VP9·VP8·AV1의 WebM','MP4만 받는 앱이 있음']]},
   verify:{steps:[
    '결과 상자에 전후 용량과, 목표가 있으면 달성 여부와 인코딩 횟수가 나옵니다.',
    '출력 해상도도 거기서 확인하세요. 고른 것보다 폭이 작다면 목표 때문에 화면 크기가 줄어든 것입니다.',
    '결과를 전체 화면으로 재생해 어두운 그라데이션, 빠른 움직임, 작은 글씨를 보세요. 압축 흔적이 가장 먼저 드러나는 곳입니다.']},
   trouble:{rows:[
    ['결과가 원본보다 큼','원본이 이미 강하게 압축돼 있었고 화질 설정이 더 많은 비트를 요구함','결과 상자에 증가율이 표시됨','작게를 고르거나 원본보다 작은 목표 용량 입력'],
    ['"Target size leaves less than 50 kbit/s for video"','음성을 빼고 나면 길이에 비해 목표가 너무 작음','목표 ÷ 초. 192 kbit/s 음성만 해도 초당 24 KB','목표를 키우거나 구간을 줄이거나 소리를 없애기'],
    ['네 번 인코딩한 뒤에도 목표를 못 맞춤','시도한 화면 크기에서 인코더가 더 줄이지 못함','결과 안내에 목표와 실제 용량이 나옴','해상도 상한을 직접 낮추거나 클립을 줄이기'],
    ['음성만으로 목표를 넘는다는 오류','192 kbit/s 음성의 긴 구간','메시지에 음성이 차지하는 KB가 나옴','고급 설정에서 음성 비트레이트를 낮추거나 소리를 없애기'],
    ['MP4가 선택지에 없음','브라우저에 H.264 인코더가 없음','고급 설정에 WebM만 있음','WebM을 쓰거나 다른 브라우저 사용']]},
   alternatives:{rows:[
    ['libx264와 `-crf`를 쓴 FFmpeg','일정 화질 인코딩, 더 작게 만드는 느린 프리셋, 일괄 작업. 목표 용량은 비트레이트를 직접 계산해야 합니다.'],
    ['영상을 찍거나 편집한 앱의 내보내기 설정','프로젝트가 남아 있다면 최종 크기로 한 번에 내보내 두 번 압축하지 않을 수 있습니다.'],
    ['[[video/trim|먼저 자르기]]','클립 대부분이 필요 없다면 짧게 만드는 것이 가장 싼 용량 줄이기입니다.']]},
   limits:['목표 용량은 측정해 맞추는 것이지 보장이 아닙니다. 네 번 뒤에도 못 맞추면 안내에 표시됩니다.','기본 설정으로는 프레임레이트를 낮추지 않으며, 기본 음성 트랙 하나만 남습니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 1920 × 1080 테스트 클립을 써서 확인했습니다. 640 px로 제한한 인코딩은 폭 640 px에 원본보다 작았고, 0.35 MB 목표는 폭을 320~640 px로 유지하며 달성했습니다. 측정 기반 보정이 있는 이유는 Firefox의 H.264와 Opus 인코더가 요청한 비트레이트보다 약 10 %, 9 % 더 많이 냈기 때문입니다. 엔진은 Mediabunny 1.58.1과 WebCodecs입니다.'],sources:['[MDN: 웹 영상 코덱 안내](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  },
  ja:{
   answer:'画質（小さめ・バランス・高画質）を選ぶか、収めたい容量をMBで入力し、必要なら解像度の上限（1080p・720p・480p）や音声の削除を選ぶと、Nerulioがブラウザ内で動画を再エンコードします。ブラウザがエンコードできればH.264のMP4、できなければVP9・VP8・AV1のWebMです。目標容量は推測ではありません。1回目は長さから大きさを決め、以降は実際に出たバイト数で補正して最大4回までエンコードし、ビットレートだけで届かなければ解像度も下げます。',
   concept:{title:'動画の容量を決めるもの',body:[
    'ファイルサイズはビットレート × 長さです。映像3 Mbit/sと音声192 kbit/sの60秒のクリップは、解像度に関係なく60 × 3.192 ÷ 8 ≈ 24 MBです。解像度とフレームレートは、そのビットレートがどれだけきれいに見えるかを決めます。同じ3 Mbit/sでも1920 × 1080に割り振ると、1280 × 720より画素あたり多くの細部を捨てることになります。',
    '目標容量がなければ、画質の設定がエンコーダーに圧縮の強さを伝え、サイズは内容次第です。動きの少ない話の動画は大きく縮み、紙吹雪や草原はあまり縮みません。すでに強く圧縮された元動画はかえって大きくなることがあり、そのとき結果の欄に増加率が出ます。',
    '目標があると、その95 %を予算とし、音声（ビットレート × 長さ）を引いた残りを映像に回します。ブラウザのエンコーダーは頼んだビットレートを超えがちなので、毎回出力の実際の映像・音声のバイト数を測って次のエンコードを補正します。ビットレートを下げても効果が薄れてきたら、画面サイズも縮めます。映像に50 kbit/sも残らない場合は、より大きな目標か短い区間を求めて処理を断ります。'],
    terms:[['ビットレート','ストリームの1秒あたりのビット数。映像と音声を足します。1 Mbit/sで60秒なら7.5 MBです。'],['解像度の上限','出力の高さを制限します。720pなら16:9の動画は1280 × 720、縦長の1080 × 1920の動画は404 × 718になります。'],['パス','1回分の全体のエンコード。目標容量には最大4回かかり、毎回サイズを測ります。']]},
   example:{title:'例：60秒のクリップを25 MB以下に収める',lead:'既定の音声192 kbit/sの場合：',lines:[
    '目標            25 MB = 25 × 1,048,576 = 26,214,400 bytes',
    '予算（95 %）    24,903,680 bytes',
    '音声            192,000 bit/s × 60 s ÷ 8 = 1,440,000 bytes',
    '映像、1回目     (24,903,680 − 1,440,000) × 8 ÷ 60 = 3,128,490 bit/s ≈ 3.13 Mbit/s',
    'まだ大きければ  次のビットレート = 現在 × (目標の97 % − 音声 − コンテナ) ÷ 実際の映像バイト数',
    '2〜4回目        同じ補正。ビットレートだけで効かなくなれば幅を縮める'],
    after:'ここでのMBは1,048,576バイトで、結果の欄と同じ単位です。音声を削除すればその1.44 MBがそのまま映像に回り、詳細設定で音声ビットレートを下げるより効果があります。'},
   mapping:{title:'設定とそれぞれの代償',head:['設定','働き','代償'],rows:[
    ['小さめ・バランス・高画質','目標がないときのエンコーダーの画質段階','サイズは内容次第で、よく圧縮された元動画より大きくなることもある'],
    ['目標容量（MB）','収まるまでサイズを測りながら最大4回エンコード','時間がかかり、解像度が下がることがある'],
    ['解像度の上限 1080p・720p・480p','出力の高さを制限し、拡大はしない','細部が減り、縦長の動画は幅が狭くなる'],
    ['音声なし','音声トラックを丸ごと外す','音が出ない'],
    ['形式 MP4・WebM（詳細）','エンコーダーがあればH.264のMP4、なければVP9・VP8・AV1のWebM','MP4しか受け付けないアプリがある']]},
   verify:{steps:[
    '結果の欄に前後の容量と、目標があれば達成したか、何回エンコードしたかが出ます。',
    '出力の解像度もそこで確認します。選んだより幅が小さければ、目標のために画面サイズが縮められています。',
    '結果を全画面で再生し、暗いグラデーション、速い動き、小さな文字を見ます。圧縮の跡が最初に出るところです。']},
   trouble:{rows:[
    ['結果が元より大きい','元がすでに強く圧縮されており、画質の設定がより多くのビットを求めた','結果の欄に増加率が出る','小さめを選ぶか、元より小さい目標容量を入れる'],
    ['「Target size leaves less than 50 kbit/s for video」と出る','音声を引くと、長さに対して目標が小さすぎる','目標 ÷ 秒数。192 kbit/sの音声だけで毎秒24 KB','目標を上げるか、区間を短くするか、音声を削除'],
    ['4回エンコードしても目標に届かない','試した画面サイズでは、エンコーダーがそれ以上縮められなかった','結果の案内に目標と実際の容量が出る','解像度の上限を自分で下げるか、クリップを短くする'],
    ['音声だけで目標を超えるというエラー','192 kbit/sの音声で長い区間','メッセージに音声が必要とするKBが出る','詳細設定で音声ビットレートを下げるか、音声を削除'],
    ['MP4が選べない','ブラウザにH.264エンコーダーがない','詳細設定にWebMしかない','WebMを使うか、別のブラウザを使う']]},
   alternatives:{rows:[
    ['libx264と`-crf`を使うFFmpeg','一定画質のエンコード、より小さくする遅いプリセット、一括処理。目標容量はビットレートを自分で計算する必要があります。'],
    ['撮影・編集したアプリの書き出し設定','プロジェクトが残っているなら、最終サイズで一度に書き出せば二重に圧縮せずに済みます。'],
    ['[[video/trim|先に切り出す]]','クリップの大半が不要なら、短くするのが一番手軽な容量削減です。']]},
   limits:['目標容量は測って合わせるもので、保証ではありません。4回で届かなければ案内に表示されます。','基本の設定ではフレームレートを下げず、主な音声トラック1本だけが残ります。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使い、1920 × 1080のテストクリップで確認しました。640 pxに制限したエンコードは幅640 pxで元より小さく、0.35 MBの目標は幅を320〜640 pxに保ったまま達成しました。測定による補正があるのは、FirefoxのH.264とOpusのエンコーダーが指定より約10 %、9 %多く出力したためです。エンジンはMediabunny 1.58.1とWebCodecsです。'],sources:['[MDN：Web動画コーデックガイド](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)']}
  }
 },
 'video/to-gif':{
  type:'tool',
  intent:{primary:'convert a video clip to an animated GIF online',secondary:['make a GIF from a video section','smaller GIF file size','GIF colours and dithering','GIF under a size limit'],
   goal:'a looping GIF of the chosen moment at a size and smoothness that fit where it will be posted',input:'a video file',output:'GIF (<name>.gif)',support:'full',
   evidence:['src/task/media.js (width 320/480/640/original, fps 10/15/24, speed, loop, reverse, crop, colours 256–32, dither 0/0.5/1, default 480 px / 15 fps / 6 s)','src/media-modern-worker.js gifPlan/gifPass/shrinkGif/gifEstimate (per-frame gifenc palette, Floyd–Steinberg via pixel-engine, delays rounded to 10 ms, reverse 64 MB cap)','assets/vendor/gifenc-1.0.3 (delay ms → 1/100 s)','tests/media-browser.mjs'],
   external:['W3C GIF89a specification: delay in 1/100 s, colour table up to 256, local colour table per image','FFmpeg filters: palettegen, paletteuse']},
  en:{
   answer:'Choose a section of the video, a width (320, 480 or 640 px, or the original), a frame rate (10, 15 or 24 fps) and, if you like, speed, loop, reverse, a crop ratio or a size to fit under, and Nerulio decodes those frames and writes a GIF. GIF holds at most 256 colours per frame and stores each frame\'s delay in hundredths of a second, so size and smoothness are a trade: width × height × frame count decides the size. The default is 480 px at 15 fps, each frame gets its own palette, and dithering is optional.',
   concept:{title:'What a GIF can store, and why it gets big',body:[
    'A GIF frame is a grid of palette indexes, one byte per pixel before LZW compression, with a colour table of at most 256 entries; the GIF89a specification allows a local table for every image. Nerulio builds a palette for each frame from that frame\'s own colours, so a new shot does not have to share colours with the previous one.',
    'Video has far more than 256 colours, so smooth gradients (sky, skin, shadows) turn into bands. Dithering at 50 % or 100 % spreads the rounding error with Floyd–Steinberg diffusion, so bands become fine grain instead. Grain is noise to the LZW compressor, so dithered GIFs are larger. Fewer colours (128, 64, 32) shrink the file and make banding worse.',
    'GIF has no sound and none of the motion compression a video codec has, so its size grows with every pixel of every frame. Delays are stored in 1/100 s: 15 fps (66.7 ms) cannot be stored exactly, so Nerulio alternates 70 and 60 ms and keeps the average right. Speed changes which moments are sampled, not the delay: 2× makes the GIF half as long at the same smoothness.'],
    terms:[['Palette (colour table)','Up to 256 colours a frame can use; each pixel stores an index into it.'],['Dithering','Mixing neighbouring palette colours in a pattern to imitate colours the palette lacks.'],['Frame delay','How long a frame stays on screen, stored in hundredths of a second.']]},
   example:{title:'Example: 6 seconds of 1920 × 1080 video at the defaults',lead:'The default section for a GIF is the first 6 seconds:',lines:[
    'Frame size       480 × 270 px = 129,600 pixels',
    'Frames           6 s × 15 fps = 90 frames',
    'Delays           70, 60, 70, 70, 60, 70 … ms   (3 frames = 200 ms)',
    'Index data       129,600 × 90 = 11.7 million bytes before LZW compression',
    'At 24 fps        144 frames, delays 40, 40, 50 … ms, 18.7 million bytes of index data',
    'At 640 px        640 × 360 × 90 = 20.7 million bytes of index data'],
    after:'LZW then shrinks the index data by an amount that depends on the picture, which is why the size estimate encodes three real frames of your clip instead of guessing. At speed 2× the same 6 seconds become 45 frames and a 3-second GIF.'},
   mapping:{title:'Settings and their effect on size',head:['Setting','Choices','Effect on size'],rows:[
    ['Width','320, 480, 640 px or original','Pixels per frame grow with the square of the width'],
    ['Frame rate','10, 15, 24 fps','Frame count grows in proportion'],
    ['Colours (Advanced)','256, 128, 64, 32','Fewer colours compress better, with more banding'],
    ['Dithering (Advanced)','Off, 50 %, 100 %','Smoother gradients, larger file'],
    ['Speed','0.5×, 1×, 2×','2× halves the frames and the length'],
    ['Crop','None, 1:1, 4:5, 16:9, centred','Fewer pixels per frame'],
    ['Fit under (MB)','Any value','Up to four measured passes']]},
   verify:{steps:[
    'Before running, the summary shows the frame count and a size estimate measured from three encoded frames.',
    'After running, the result box shows width × height, frame count and size and, with a target, whether it was met.',
    'Open the GIF in a browser and in the app you will post it to, and check that it loops (or stops after one play if you turned Loop off).']},
   trouble:{rows:[
    ['Sky and skin show bands','256 colours per frame are not enough for smooth gradients','Look at the widest gradient in a frame','Turn dithering on at 50 % or 100 %, and keep 256 colours'],
    ['The GIF is far too large','Width and frame count multiply: 640 px at 24 fps is 2.8 times the pixels of 480 px at 15 fps','Compare the estimate before running','Lower the width or fps, shorten the section, crop, or set Fit under (MB)'],
    ['A size target was met but the GIF looks worse than set','To fit, the passes first cut colours to 64 (then 32), then width and fps together','The result box shows the final width and frame count','Raise the target, or shorten the section instead'],
    ['A long clip is slow, or Reverse stops with a memory message','Every frame is decoded, quantised and compressed; Reverse also keeps all frames until the end, capped at 64 MB of index data','Progress shows frame n of the total','Shorten the section or lower width or fps; turn Reverse off for long clips'],
    ['A phone video stops with a decoder error','The browser cannot decode the video codec, often HEVC','See [[video/mov-to-gif|the MOV guide]] for reading the codec','Use a browser that decodes it, or record in H.264']]},
   alternatives:{rows:[
    ['FFmpeg with the `palettegen` and `paletteuse` filters','One palette optimised for the whole clip and five dithering methods (Sierra-2-4A by default), scripted; command line only.'],
    ['A short MP4 or WebM instead of a GIF','Where the platform accepts video: far smaller at the same quality, and with sound. See [[video/compress|video compression]].'],
    ['[[game/sprite-sheet-to-gif|Sprite sheet to GIF]]','For pixel-art animation frames rather than filmed video.']]},
   limits:['No transparent GIFs: every frame is opaque.','No text or sticker overlays, and the palette is built per frame, not shared across the clip.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155: 2 s at 640 px and 12 fps gave 24 frames 640 px wide; a 0.25 MB target was met by measured passes; a reversed, 2× speed, 1:1-cropped GIF kept its planned 5 frames and a square size; and the three-frame estimate was within 25 % of the real size. Frames are decoded with Mediabunny 1.58.1 and WebCodecs and encoded with gifenc 1.0.3. The GIF limits are from the GIF89a specification.'],sources:['[W3C: GIF89a specification](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)','[FFmpeg filters: palettegen, paletteuse](https://ffmpeg.org/ffmpeg-filters.html)']}
  },
  ko:{
   answer:'영상의 구간, 폭(320·480·640 px 또는 원본), 프레임레이트(10·15·24fps)를 고르고, 원하면 속도·반복·역재생·자르기 비율·맞출 용량까지 정하면 Nerulio가 그 프레임을 디코딩해 GIF를 만듭니다. GIF는 프레임당 최대 256색이고 프레임마다 머무는 시간을 100분의 1초 단위로 저장하므로, 용량과 부드러움은 서로 맞바꾸는 관계입니다. 폭 × 높이 × 프레임 수가 용량을 정합니다. 기본값은 480 px·15fps이고, 프레임마다 팔레트를 따로 만들며 디더링은 선택입니다.',
   concept:{title:'GIF가 담을 수 있는 것과 커지는 이유',body:[
    'GIF 프레임은 팔레트 번호의 격자로, LZW 압축 전에는 픽셀당 1바이트이고 색상표는 최대 256색입니다. GIF89a 규격은 이미지마다 로컬 색상표를 허용합니다. Nerulio는 각 프레임의 색으로 그 프레임만의 팔레트를 만들기 때문에, 장면이 바뀌어도 앞 장면과 색을 나눠 쓸 필요가 없습니다.',
    '영상에는 256색보다 훨씬 많은 색이 있어서 하늘·피부·그림자 같은 부드러운 그라데이션은 띠처럼 끊어집니다. 디더링 50 %나 100 %는 플로이드-스타인버그 확산으로 반올림 오차를 퍼뜨려 띠를 고운 입자로 바꿉니다. 입자는 LZW 압축에는 잡음이라 디더링한 GIF는 더 큽니다. 색을 줄이면(128·64·32) 파일은 작아지고 띠는 심해집니다.',
    'GIF에는 소리도, 영상 코덱 같은 움직임 압축도 없어서 모든 프레임의 모든 픽셀만큼 커집니다. 머무는 시간은 1/100초 단위라 15fps(66.7ms)는 정확히 저장할 수 없고, Nerulio는 70ms와 60ms를 번갈아 써서 평균을 맞춥니다. 속도는 머무는 시간이 아니라 뽑아낼 순간을 바꿉니다. 2배속이면 부드러움은 같고 GIF 길이가 절반입니다.'],
    terms:[['팔레트(색상표)','한 프레임이 쓸 수 있는 최대 256색. 각 픽셀은 그 안의 번호를 저장합니다.'],['디더링','팔레트에 없는 색을 흉내 내려고 주변 팔레트 색을 무늬처럼 섞는 것.'],['프레임 지연','프레임이 화면에 머무는 시간. 100분의 1초 단위로 저장됩니다.']]},
   example:{title:'예시: 1920 × 1080 영상 6초를 기본값으로',lead:'GIF의 기본 구간은 처음 6초입니다.',lines:[
    '프레임 크기      480 × 270 px = 129,600 픽셀',
    '프레임 수        6 s × 15 fps = 90 프레임',
    '지연             70, 60, 70, 70, 60, 70 … ms   (3프레임 = 200 ms)',
    '번호 데이터      129,600 × 90 = LZW 압축 전 1,170만 바이트',
    '24 fps라면       144 프레임, 지연 40, 40, 50 … ms, 번호 데이터 1,870만 바이트',
    '640 px라면       640 × 360 × 90 = 번호 데이터 2,070만 바이트'],
    after:'이후 LZW가 번호 데이터를 줄이는 정도는 그림에 따라 달라서, 예상 용량은 추측하지 않고 실제 클립의 프레임 3장을 인코딩해 계산합니다. 2배속이면 같은 6초가 45프레임, 3초짜리 GIF가 됩니다.'},
   mapping:{title:'설정과 용량에 미치는 영향',head:['설정','선택지','용량 영향'],rows:[
    ['폭','320·480·640 px 또는 원본','프레임당 픽셀은 폭의 제곱으로 늘어남'],
    ['프레임레이트','10·15·24 fps','프레임 수가 비례해 늘어남'],
    ['색상 수(고급)','256·128·64·32','색이 적을수록 잘 압축되지만 띠가 늘어남'],
    ['디더링(고급)','끔·50 %·100 %','그라데이션이 부드러워지고 파일이 커짐'],
    ['속도','0.5배·1배·2배','2배면 프레임 수와 길이가 절반'],
    ['자르기','없음·1:1·4:5·16:9, 가운데 기준','프레임당 픽셀이 줄어듦'],
    ['목표 용량(MB)','임의의 값','크기를 재며 최대 네 번 인코딩']]},
   verify:{steps:[
    '실행 전에 요약에 프레임 수와, 실제로 인코딩한 프레임 3장으로 잰 예상 용량이 나옵니다.',
    '실행 후 결과 상자에 폭 × 높이, 프레임 수, 용량과, 목표가 있으면 달성 여부가 나옵니다.',
    'GIF를 브라우저와 올릴 앱에서 열어 반복되는지(반복을 껐다면 한 번 재생 후 멈추는지) 확인하세요.']},
   trouble:{rows:[
    ['하늘과 피부에 띠가 생김','부드러운 그라데이션에 프레임당 256색이 부족함','프레임에서 가장 넓은 그라데이션을 보기','디더링을 50 %나 100 %로 켜고 256색 유지'],
    ['GIF가 너무 큼','폭과 프레임 수가 곱해짐. 640 px·24fps는 480 px·15fps의 2.8배 픽셀','실행 전 예상 용량 비교','폭이나 fps를 낮추거나 구간을 줄이거나 자르기, 또는 목표 용량 입력'],
    ['목표 용량은 맞췄는데 설정보다 품질이 나빠 보임','맞추려고 먼저 색을 64(다음은 32)로, 그다음 폭과 fps를 함께 줄임','결과 상자에 최종 폭과 프레임 수가 나옴','목표를 키우거나 대신 구간을 줄이기'],
    ['긴 클립이 느리거나, 역재생이 메모리 메시지로 멈춤','모든 프레임을 디코딩·양자화·압축하며, 역재생은 끝날 때까지 모든 프레임을 들고 있음(번호 데이터 64 MB 상한)','진행 표시에 전체 중 몇 번째 프레임인지 나옴','구간이나 폭·fps를 줄이고, 긴 클립은 역재생 끄기'],
    ['휴대폰 영상에서 디코더 오류가 남','브라우저가 영상 코덱(주로 HEVC)을 디코딩하지 못함','코덱 확인법은 [[video/mov-to-gif|MOV 안내]] 참고','디코딩되는 브라우저를 쓰거나 H.264로 촬영']]},
   alternatives:{rows:[
    ['`palettegen`·`paletteuse` 필터를 쓴 FFmpeg','클립 전체에 최적화한 팔레트 하나와 다섯 가지 디더링(기본 Sierra-2-4A)을 스크립트로. 명령줄 전용입니다.'],
    ['GIF 대신 짧은 MP4·WebM','플랫폼이 영상을 받는다면 같은 화질에 훨씬 작고 소리도 있습니다. [[video/compress|영상 압축]] 참고.'],
    ['[[game/sprite-sheet-to-gif|스프라이트 시트를 GIF로]]','촬영한 영상이 아니라 도트 애니메이션 프레임일 때.']]},
   limits:['투명 GIF는 만들지 않습니다. 모든 프레임이 불투명합니다.','글자·스티커 얹기는 없고, 팔레트는 클립 전체가 아니라 프레임마다 만듭니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 확인했습니다. 2초를 640 px·12fps로 만들면 폭 640 px의 24프레임이 나오고, 0.25 MB 목표는 측정 인코딩으로 달성했으며, 역재생·2배속·1:1 자르기 GIF는 계획한 5프레임과 정사각형 크기를 지켰고, 프레임 3장 예상치는 실제 용량과 25 % 이내였습니다. 프레임은 Mediabunny 1.58.1과 WebCodecs로 디코딩하고 gifenc 1.0.3으로 인코딩합니다. GIF의 한계는 GIF89a 규격에 따른 것입니다.'],sources:['[W3C: GIF89a 규격](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)','[FFmpeg 필터: palettegen, paletteuse](https://ffmpeg.org/ffmpeg-filters.html)']}
  },
  ja:{
   answer:'動画の区間、幅（320・480・640 pxまたは元のまま）、フレームレート（10・15・24fps）を選び、必要なら速度・ループ・逆再生・切り抜きの比率・収める容量も決めると、Nerulioがそのフレームをデコードしてアニメーションを作ります。GIFは1フレーム最大256色で、各フレームの表示時間を100分の1秒単位で保存するため、容量と滑らかさは引き換えです。幅 × 高さ × フレーム数が容量を決めます。既定は480 px・15fpsで、フレームごとにパレットを作り、ディザリングは任意です。',
   concept:{title:'GIFが保存できるものと、大きくなる理由',body:[
    'GIFのフレームはパレット番号の格子で、LZW圧縮前は1画素1バイト、カラーテーブルは最大256色です。GIF89aの仕様では画像ごとにローカルカラーテーブルを持てます。Nerulioは各フレームの色からそのフレーム専用のパレットを作るので、場面が変わっても前の場面と色を分け合う必要がありません。',
    '動画には256色よりはるかに多くの色があるため、空・肌・影のような滑らかなグラデーションは帯状に分かれます。ディザリング50 %や100 %は、フロイド–スタインバーグ法で丸め誤差を拡散し、帯を細かい粒に変えます。粒はLZW圧縮にとってノイズなので、ディザリングしたGIFは大きくなります。色数を減らす（128・64・32）とファイルは小さくなり、帯は目立ちます。',
    'GIFには音声も、動画コーデックのような動きの圧縮もないため、全フレームの全画素の分だけ大きくなります。表示時間は1/100秒単位なので15fps（66.7ms）はそのまま保存できず、Nerulioは70msと60msを交互に使って平均を合わせます。速度は表示時間ではなく、取り出す瞬間を変えます。2倍速なら滑らかさはそのままで長さが半分になります。'],
    terms:[['パレット（カラーテーブル）','1フレームで使える最大256色。各画素はその中の番号を持ちます。'],['ディザリング','パレットにない色を表すため、近くのパレット色を模様のように混ぜること。'],['フレームの遅延','フレームが表示される時間。100分の1秒単位で保存されます。']]},
   example:{title:'例：1920 × 1080の動画6秒を既定の設定で',lead:'GIFの既定の区間は最初の6秒です。',lines:[
    'フレームサイズ   480 × 270 px = 129,600画素',
    'フレーム数       6 s × 15 fps = 90フレーム',
    '遅延             70, 60, 70, 70, 60, 70 … ms   （3フレーム = 200 ms）',
    '番号データ       129,600 × 90 = LZW圧縮前で1,170万バイト',
    '24 fpsなら       144フレーム、遅延40, 40, 50 … ms、番号データ1,870万バイト',
    '640 pxなら       640 × 360 × 90 = 番号データ2,070万バイト'],
    after:'その後LZWが番号データをどれだけ縮めるかは絵によって違うため、予想容量は推測ではなく、実際のクリップのフレーム3枚をエンコードして計算します。2倍速なら同じ6秒が45フレーム、3秒のGIFになります。'},
   mapping:{title:'設定と容量への影響',head:['設定','選択肢','容量への影響'],rows:[
    ['幅','320・480・640 pxまたは元のまま','1フレームの画素数は幅の2乗で増える'],
    ['フレームレート','10・15・24 fps','フレーム数が比例して増える'],
    ['色数（詳細）','256・128・64・32','色が少ないほど圧縮が効くが、帯が増える'],
    ['ディザリング（詳細）','オフ・50 %・100 %','グラデーションが滑らかになり、ファイルは大きくなる'],
    ['速度','0.5倍・1倍・2倍','2倍ならフレーム数と長さが半分'],
    ['切り抜き','なし・1:1・4:5・16:9、中央基準','1フレームの画素数が減る'],
    ['目標容量（MB）','任意の値','サイズを測りながら最大4回エンコード']]},
   verify:{steps:[
    '実行前に、要約にフレーム数と、実際にエンコードしたフレーム3枚から測った予想容量が出ます。',
    '実行後、結果の欄に幅 × 高さ、フレーム数、容量と、目標があれば達成したかが出ます。',
    'GIFをブラウザと投稿先のアプリで開き、ループするか（ループをオフにしたなら1回で止まるか）確認します。']},
   trouble:{rows:[
    ['空や肌に帯が出る','滑らかなグラデーションには1フレーム256色では足りない','フレーム内で最も広いグラデーションを見る','ディザリングを50 %か100 %にし、256色のままにする'],
    ['GIFが大きすぎる','幅とフレーム数が掛け算になる。640 px・24fpsは480 px・15fpsの2.8倍の画素','実行前に予想容量を比べる','幅かfpsを下げる、区間を短くする、切り抜く、または目標容量を入れる'],
    ['目標容量には収まったが、設定より画質が悪い','収めるため、まず色数を64（次に32）に、次に幅とfpsを一緒に下げる','結果の欄に最終的な幅とフレーム数が出る','目標を上げるか、代わりに区間を短くする'],
    ['長いクリップが遅い、または逆再生がメモリのメッセージで止まる','全フレームをデコード・減色・圧縮し、逆再生は最後まで全フレームを保持する（番号データ64 MBまで）','進行表示に全体の何フレーム目かが出る','区間や幅・fpsを減らし、長いクリップでは逆再生をオフにする'],
    ['スマホの動画でデコーダーのエラーが出る','ブラウザが映像コーデック（主にHEVC）をデコードできない','コーデックの調べ方は[[video/mov-to-gif|MOVのガイド]]を参照','デコードできるブラウザを使うか、H.264で撮影する']]},
   alternatives:{rows:[
    ['`palettegen`と`paletteuse`フィルターを使うFFmpeg','クリップ全体に最適化したパレット1つと5種類のディザリング（既定はSierra-2-4A）をスクリプトで。コマンドラインのみです。'],
    ['GIFの代わりに短いMP4・WebM','投稿先が動画を受け付けるなら、同じ画質でずっと小さく、音声も付きます。[[video/compress|動画の圧縮]]を参照。'],
    ['[[game/sprite-sheet-to-gif|スプライトシートをGIFに]]','撮影した動画ではなくドット絵のアニメーションのフレームのとき。']]},
   limits:['透過GIFは作りません。すべてのフレームが不透明です。','文字やスタンプの重ね合わせはなく、パレットはクリップ全体ではなくフレームごとに作ります。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使って確認しました。2秒を640 px・12fpsにすると幅640 pxの24フレームになり、0.25 MBの目標は測定しながらのエンコードで達成し、逆再生・2倍速・1:1切り抜きのGIFは予定どおり5フレームで正方形になり、3フレームからの予想は実際の容量と25 %以内でした。フレームはMediabunny 1.58.1とWebCodecsでデコードし、gifenc 1.0.3でエンコードします。GIFの制約はGIF89aの仕様に基づきます。'],sources:['[W3C：GIF89a仕様](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)','[FFmpegフィルター：palettegen、paletteuse](https://ffmpeg.org/ffmpeg-filters.html)']}
  }
 },
 'video/to-mp3':{
  type:'tool',
  intent:{primary:'extract the audio of a video as MP3 online',secondary:['which MP3 bitrate to choose','video to WAV','normalise or fade the extracted audio'],
   goal:'an MP3 (or WAV) of the chosen section at a sensible bitrate, without re-encoding more than once',input:'a video or audio file with an audio track',output:'MP3 (CBR 128–320 kbit/s) or 16-bit WAV',support:'full',
   evidence:['src/task/media.js (bitrates 128/192/256/320, default 192; WAV; fades; normalise; 44.1/48 kHz)','src/media-modern-worker.js convert (video discarded, gain to 0.98 of the measured peak, clamp 0.05–32, fades up to half the section)','assets/vendor/mediabunny-mp3-encoder-1.58.1 (LAME 3.100, lame_set_brate: constant bitrate)','tests/media-browser.mjs (mp3/wav duration, normalisation, fades)'],
   external:['FFmpeg codecs: libmp3lame b (CBR/ABR) and q (VBR)']},
  en:{
   answer:'Open a video, choose the section, and Nerulio decodes only its audio track and encodes it as MP3 at 128, 192 (default), 256 or 320 kbit/s constant bitrate with the LAME 3.100 encoder, or as uncompressed 16-bit WAV. The picture is discarded without being decoded, so the video codec does not matter; the browser only has to decode the audio codec (AAC, Opus, MP3, PCM…). Fades, peak normalisation and resampling to 44.1 or 48 kHz are under Advanced.',
   concept:{title:'Bitrate, size, and what MP3 cannot restore',body:[
    'At a constant bitrate an MP3 spends the same number of bits every second, so its size is bitrate × duration ÷ 8. At 192 kbit/s that is 24 KB per second, about 1.4 MB a minute. WAV at 44.1 kHz, 16-bit stereo runs at 1411.2 kbit/s, about 10 MB a minute.',
    'The audio in a video is nearly always compressed already, usually as AAC or Opus. Converting it to MP3 decodes and re-encodes it, which cannot bring back detail the first encoder removed: 320 kbit/s from a 128 kbit/s source only makes the file bigger. Pick a bitrate at or a little above the source\'s, or WAV when you will keep editing the audio.',
    'Normalise measures the loudest sample in the section and scales the whole section so that this peak reaches 0.98 of full scale (about −0.2 dBFS). It does not compress dynamics, so one loud peak limits how far a quiet recording can be raised. Fades are linear and measured from the start and end of the section, up to half its length each.'],
    terms:[['kbit/s','Thousand bits per second: 192 kbit/s is 24,000 bytes per second.'],['CBR','Constant bitrate: every second of the MP3 uses the same number of bits.'],['Peak normalisation','One gain for the whole section, chosen so the loudest sample stays just below clipping.']]},
   example:{title:'Example: a music video of 3 min 20 s (200 s)',lead:'Size of the audio at each choice, as the result box shows it (1 MB = 1,048,576 bytes):',lines:[
    '128 kbit/s    128,000 × 200 ÷ 8 = 3,200,000 bytes ≈ 3.1 MB',
    '192 kbit/s    192,000 × 200 ÷ 8 = 4,800,000 bytes ≈ 4.6 MB   (default)',
    '256 kbit/s    6,400,000 bytes ≈ 6.1 MB',
    '320 kbit/s    8,000,000 bytes ≈ 7.6 MB',
    'WAV 44.1 kHz 16-bit stereo   1,411,200 × 200 ÷ 8 = 35,280,000 bytes ≈ 33.6 MB',
    'Normalise     measured peak 0.25 → gain 0.98 ÷ 0.25 = 3.92 (+11.9 dB)'],
    after:'File headers add a few bytes on top. If the source audio is AAC at 128 kbit/s, 192 kbit/s MP3 keeps what is there; 320 kbit/s adds 3.2 MB and nothing audible.'},
   mapping:{title:'From the source audio to the MP3',head:['In the source','What happens','In the result'],rows:[
    ['Audio codec (AAC, Opus, MP3, PCM…)','Decoded by the browser; PCM is decoded by the reader itself','Encoded by LAME 3.100 (or written as PCM for WAV)'],
    ['Sample rate','Kept, or resampled to 44.1 or 48 kHz if chosen','Same rate'],
    ['Video track','Discarded without decoding','—'],
    ['Section start and end','Samples outside are dropped; fades are measured from the section','Starts at 0 s'],
    ['Extra audio tracks, chapters, cover art','Not read','—']]},
   verify:{steps:[
    'Play the result in the result player: it should start and end where the section does, with the fades you set.',
    'Check the size in the result box against bitrate × duration ÷ 8.',
    'If you normalised, compare the loudness with the source: the loudest moment should sit just under clipping.']},
   trouble:{rows:[
    ['"This file has no audio track"','The video was recorded or exported without sound','Play the source with sound on; ffprobe lists no audio stream','There is nothing to extract; find a version with audio'],
    ['It stops with a decoder error','The browser cannot decode this audio codec (for example a surround codec)','ffprobe shows the audio codec','Convert the audio with a desktop tool, or try another browser'],
    ['320 kbit/s sounds no better than 192','The source audio was lossy at a lower bitrate; re-encoding cannot add detail','ffprobe shows the source audio bit_rate','Pick 192 or the source bitrate; use WAV for editing'],
    ['Normalise barely changed the volume','One loud peak (a clap, a door) is already near full scale','Look for a single spike in an audio editor','Leave the spike out of the section, or use a loudness tool that compresses dynamics'],
    ['Compatibility mode refuses a long file','Without WebCodecs the whole source is decoded in memory, limited to 20 minutes','The compatibility note is shown','Use a browser with WebCodecs, which reads the file in pieces without a length cap']]},
   alternatives:{rows:[
    ['FFmpeg: `ffmpeg -i in.mp4 -vn -c:a libmp3lame -b:a 192k out.mp3`','Batch conversion or codecs your browser cannot decode; libmp3lame also offers VBR with `-q:a`.'],
    ['WAV from this page','When you will edit, mix or encode the audio again later: no extra lossy step now.']]},
   limits:['MP3 is written at a constant bitrate only; there is no VBR option.','No ID3 tags (title, artist, cover) are written.','Sources with more than two channels have not been tested in this path.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155: a 4 s MP3 at 192 kbit/s and a 44.1 kHz WAV cut from a 1920 × 1080 MP4 kept their length within 0.12 s; normalising a quiet test tone measured a peak below 0.2 and raised it by more than 2×; 1 s fades left the length unchanged. MP3 encoding is LAME 3.100 compiled to WebAssembly (mediabunny-mp3-encoder 1.58.1). The FFmpeg options are from its documentation.'],sources:['[FFmpeg codecs: libmp3lame](https://ffmpeg.org/ffmpeg-codecs.html)']}
  },
  ko:{
   answer:'영상을 열고 구간을 고르면 Nerulio가 오디오 트랙만 디코딩해 LAME 3.100 인코더로 128·192(기본)·256·320 kbit/s 고정 비트레이트 MP3를 만들거나, 압축하지 않은 16비트 WAV로 저장합니다. 화면은 디코딩하지 않고 버리므로 영상 코덱은 상관없고, 브라우저가 음성 코덱(AAC, Opus, MP3, PCM 등)만 디코딩하면 됩니다. 페이드, 피크 정규화, 44.1·48 kHz 리샘플링은 고급 설정에 있습니다.',
   concept:{title:'비트레이트와 용량, 그리고 MP3가 되살리지 못하는 것',body:[
    '고정 비트레이트 MP3는 매초 같은 비트를 쓰므로 크기는 비트레이트 × 길이 ÷ 8입니다. 192 kbit/s면 초당 24 KB, 1분에 약 1.4 MB입니다. 44.1 kHz·16비트 스테레오 WAV는 1411.2 kbit/s로 1분에 약 10 MB입니다.',
    '영상 속 음성은 거의 언제나 이미 AAC나 Opus로 압축돼 있습니다. 이를 MP3로 바꾸면 디코딩했다가 다시 인코딩하므로, 처음 인코더가 버린 세부는 돌아오지 않습니다. 128 kbit/s 원본을 320 kbit/s로 만들면 파일만 커집니다. 원본과 같거나 조금 높은 비트레이트를 고르고, 계속 편집할 음성이라면 WAV를 쓰세요.',
    '정규화는 구간에서 가장 큰 샘플을 재고, 그 피크가 최대값의 0.98(약 −0.2 dBFS)이 되도록 구간 전체를 같은 배율로 키웁니다. 다이내믹을 압축하지 않으므로, 큰 피크 하나가 있으면 조용한 녹음을 많이 키울 수 없습니다. 페이드는 직선이며 구간의 시작과 끝에서 재고, 각각 구간 길이의 절반까지입니다.'],
    terms:[['kbit/s','초당 천 비트. 192 kbit/s는 초당 24,000바이트입니다.'],['CBR','고정 비트레이트. MP3의 모든 초가 같은 비트 수를 씁니다.'],['피크 정규화','가장 큰 샘플이 클리핑 바로 아래에 오도록 구간 전체에 하나의 배율을 적용하는 것.']]},
   example:{title:'예시: 3분 20초(200초)짜리 뮤직비디오',lead:'선택지별 음성 용량을 결과 상자와 같은 단위(1 MB = 1,048,576바이트)로 보면:',lines:[
    '128 kbit/s    128,000 × 200 ÷ 8 = 3,200,000 bytes ≈ 3.1 MB',
    '192 kbit/s    192,000 × 200 ÷ 8 = 4,800,000 bytes ≈ 4.6 MB   (기본)',
    '256 kbit/s    6,400,000 bytes ≈ 6.1 MB',
    '320 kbit/s    8,000,000 bytes ≈ 7.6 MB',
    'WAV 44.1 kHz 16비트 스테레오  1,411,200 × 200 ÷ 8 = 35,280,000 bytes ≈ 33.6 MB',
    '정규화        측정 피크 0.25 → 배율 0.98 ÷ 0.25 = 3.92 (+11.9 dB)'],
    after:'파일 헤더만큼 몇 바이트가 더해집니다. 원본 음성이 128 kbit/s AAC라면 192 kbit/s MP3로 있는 것을 다 담을 수 있고, 320 kbit/s는 3.2 MB를 더할 뿐 들리는 차이는 없습니다.'},
   mapping:{title:'원본 음성에서 MP3까지',head:['원본에서','처리','결과에서'],rows:[
    ['음성 코덱(AAC, Opus, MP3, PCM 등)','브라우저가 디코딩, PCM은 읽기 도구가 직접 디코딩','LAME 3.100으로 인코딩(WAV는 PCM으로 기록)'],
    ['샘플레이트','유지, 또는 고르면 44.1·48 kHz로 리샘플링','같은 샘플레이트'],
    ['영상 트랙','디코딩 없이 버림','—'],
    ['구간 시작·끝','바깥 샘플은 버리고 페이드는 구간 기준으로 잼','0초부터 시작'],
    ['추가 음성 트랙, 챕터, 표지 이미지','읽지 않음','—']]},
   verify:{steps:[
    '결과 플레이어에서 재생해 보세요. 구간과 같은 곳에서 시작하고 끝나며, 정한 페이드가 들어가 있어야 합니다.',
    '결과 상자의 용량을 비트레이트 × 길이 ÷ 8과 비교하세요.',
    '정규화를 했다면 원본과 소리 크기를 비교하세요. 가장 큰 순간이 클리핑 바로 아래에 있어야 합니다.']},
   trouble:{rows:[
    ['"This file has no audio track"','영상을 소리 없이 녹화하거나 내보냄','소리를 켜고 원본을 재생, ffprobe에 음성 스트림이 없음','뽑을 소리가 없습니다. 소리가 있는 버전을 찾으세요'],
    ['디코더 오류로 멈춤','브라우저가 이 음성 코덱(예: 서라운드 코덱)을 디코딩하지 못함','ffprobe로 음성 코덱 확인','데스크톱 도구로 변환하거나 다른 브라우저 시도'],
    ['320 kbit/s가 192보다 좋게 들리지 않음','원본 음성이 더 낮은 비트레이트의 손실 압축이라, 다시 인코딩해도 세부가 늘지 않음','ffprobe로 원본 음성의 bit_rate 확인','192나 원본 비트레이트를 고르고, 편집용이면 WAV'],
    ['정규화해도 소리가 거의 안 커짐','큰 피크 하나(박수, 문소리)가 이미 최대값 근처임','오디오 편집기에서 튀는 한 지점 찾기','그 지점을 구간에서 빼거나, 다이내믹을 압축하는 음량 도구 사용'],
    ['호환 모드가 긴 파일을 거절함','WebCodecs가 없으면 원본 전체를 메모리에서 디코딩하므로 20분까지만 가능','호환 모드 안내가 떠 있음','파일을 조각씩 읽어 길이 제한이 없는 WebCodecs 지원 브라우저 사용']]},
   alternatives:{rows:[
    ['FFmpeg: `ffmpeg -i in.mp4 -vn -c:a libmp3lame -b:a 192k out.mp3`','일괄 변환이나 브라우저가 디코딩하지 못하는 코덱. libmp3lame은 `-q:a`로 VBR도 지원합니다.'],
    ['이 페이지의 WAV','나중에 편집·믹스하거나 다시 인코딩할 음성이라면, 지금 손실 단계를 하나 더하지 않습니다.']]},
   limits:['MP3는 고정 비트레이트로만 씁니다. VBR 옵션은 없습니다.','ID3 태그(제목, 아티스트, 표지)는 쓰지 않습니다.','채널이 셋 이상인 원본은 이 경로에서 테스트하지 않았습니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 확인했습니다. 1920 × 1080 MP4에서 자른 4초짜리 192 kbit/s MP3와 44.1 kHz WAV는 길이가 0.12초 이내로 맞았고, 조용한 테스트 음의 정규화는 피크를 0.2 미만으로 재서 2배 넘게 키웠으며, 1초 페이드는 길이를 바꾸지 않았습니다. MP3 인코딩은 WebAssembly로 컴파일한 LAME 3.100(mediabunny-mp3-encoder 1.58.1)입니다. FFmpeg 옵션은 공식 문서를 따랐습니다.'],sources:['[FFmpeg 코덱: libmp3lame](https://ffmpeg.org/ffmpeg-codecs.html)']}
  },
  ja:{
   answer:'動画を開いて区間を選ぶと、Nerulioは音声トラックだけをデコードし、LAME 3.100エンコーダーで128・192（既定）・256・320 kbit/sの固定ビットレートMP3にするか、非圧縮の16ビットWAVで保存します。映像はデコードせずに捨てるので映像コーデックは関係なく、ブラウザが音声コーデック（AAC、Opus、MP3、PCMなど）をデコードできれば十分です。フェード、ピークの正規化、44.1・48 kHzへのリサンプリングは詳細設定にあります。',
   concept:{title:'ビットレートと容量、そしてMP3が取り戻せないもの',body:[
    '固定ビットレートのMP3は毎秒同じビット数を使うので、サイズはビットレート × 長さ ÷ 8です。192 kbit/sなら毎秒24 KB、1分で約1.4 MBです。44.1 kHz・16ビットのステレオWAVは1411.2 kbit/sで、1分あたり約10 MBです。',
    '動画の音声はほぼ必ず、AACやOpusですでに圧縮されています。MP3にするとデコードして再エンコードするため、最初のエンコーダーが捨てた細部は戻りません。128 kbit/sの元音声を320 kbit/sにしてもファイルが大きくなるだけです。元と同じか少し高いビットレートを選び、編集を続ける音声ならWAVにしてください。',
    '正規化は区間で最も大きいサンプルを測り、そのピークが最大値の0.98（約−0.2 dBFS）になるよう区間全体を同じ倍率で持ち上げます。ダイナミクスは圧縮しないので、大きなピークが1つあると静かな録音をあまり上げられません。フェードは直線的で、区間の始まりと終わりから測り、それぞれ区間の長さの半分までです。'],
    terms:[['kbit/s','1秒あたり千ビット。192 kbit/sは毎秒24,000バイトです。'],['CBR','固定ビットレート。MP3のどの1秒も同じビット数を使います。'],['ピークの正規化','最も大きいサンプルがクリップの直前に来るよう、区間全体に1つの倍率をかけること。']]},
   example:{title:'例：3分20秒（200秒）のミュージックビデオ',lead:'選択肢ごとの音声の容量を、結果の欄と同じ単位（1 MB = 1,048,576バイト）で見ると：',lines:[
    '128 kbit/s    128,000 × 200 ÷ 8 = 3,200,000 bytes ≈ 3.1 MB',
    '192 kbit/s    192,000 × 200 ÷ 8 = 4,800,000 bytes ≈ 4.6 MB   （既定）',
    '256 kbit/s    6,400,000 bytes ≈ 6.1 MB',
    '320 kbit/s    8,000,000 bytes ≈ 7.6 MB',
    'WAV 44.1 kHz 16ビット ステレオ  1,411,200 × 200 ÷ 8 = 35,280,000 bytes ≈ 33.6 MB',
    '正規化        測定ピーク0.25 → 倍率 0.98 ÷ 0.25 = 3.92（+11.9 dB）'],
    after:'ファイルのヘッダー分が少し加わります。元の音声が128 kbit/sのAACなら、192 kbit/sのMP3で中身はすべて収まり、320 kbit/sは3.2 MB増えるだけで聞こえる違いはありません。'},
   mapping:{title:'元の音声からMP3まで',head:['元のファイル','処理','結果'],rows:[
    ['音声コーデック（AAC、Opus、MP3、PCMなど）','ブラウザがデコード。PCMは読み込み側が自分でデコード','LAME 3.100でエンコード（WAVはPCMで書き込み）'],
    ['サンプルレート','そのまま、または選べば44.1・48 kHzにリサンプリング','同じサンプルレート'],
    ['映像トラック','デコードせずに捨てる','—'],
    ['区間の始まりと終わり','外側のサンプルは捨て、フェードは区間を基準に測る','0秒から始まる'],
    ['追加の音声トラック、チャプター、カバー画像','読まない','—']]},
   verify:{steps:[
    '結果のプレーヤーで再生します。区間と同じところで始まって終わり、設定したフェードが入っているはずです。',
    '結果の欄の容量を、ビットレート × 長さ ÷ 8と比べます。',
    '正規化した場合は元と音量を比べます。最も大きい瞬間がクリップの少し手前にあるはずです。']},
   trouble:{rows:[
    ['「This file has no audio track」と出る','動画が音声なしで録画・書き出しされた','音を出して元を再生し、ffprobeに音声ストリームがない','取り出す音がありません。音声付きの版を探してください'],
    ['デコーダーのエラーで止まる','ブラウザがこの音声コーデック（サラウンドのコーデックなど）をデコードできない','ffprobeで音声コーデックを確認','デスクトップのツールで変換するか、別のブラウザで試す'],
    ['320 kbit/sが192より良く聞こえない','元の音声がより低いビットレートの非可逆圧縮で、再エンコードしても細部は増えない','ffprobeで元音声のbit_rateを確認','192か元のビットレートを選び、編集用ならWAV'],
    ['正規化しても音量がほとんど変わらない','大きなピーク1つ（拍手、ドアの音）がすでに最大値近くにある','音声編集ソフトで突出した1点を探す','その点を区間から外すか、ダイナミクスを圧縮する音量ツールを使う'],
    ['互換モードが長いファイルを断る','WebCodecsがないと元ファイル全体をメモリでデコードするため、20分まで','互換モードの案内が出ている','ファイルを少しずつ読み、長さの上限がないWebCodecs対応のブラウザを使う']]},
   alternatives:{rows:[
    ['FFmpeg：`ffmpeg -i in.mp4 -vn -c:a libmp3lame -b:a 192k out.mp3`','一括変換や、ブラウザがデコードできないコーデック。libmp3lameは`-q:a`でVBRにも対応します。'],
    ['このページのWAV','後で編集・ミックス・再エンコードする音声なら、ここで非可逆の段階を増やさずに済みます。']]},
   limits:['MP3は固定ビットレートでのみ書き出し、VBRのオプションはありません。','ID3タグ（タイトル、アーティスト、カバー）は書き込みません。','3チャンネル以上の元ファイルは、この経路ではテストしていません。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使って確認しました。1920 × 1080のMP4から切り出した4秒の192 kbit/s MP3と44.1 kHzのWAVは長さが0.12秒以内で一致し、静かなテスト音の正規化はピークを0.2未満と測って2倍を超えて持ち上げ、1秒のフェードは長さを変えませんでした。MP3のエンコードはWebAssemblyにコンパイルしたLAME 3.100（mediabunny-mp3-encoder 1.58.1）です。FFmpegのオプションは公式ドキュメントに従っています。'],sources:['[FFmpegコーデック：libmp3lame](https://ffmpeg.org/ffmpeg-codecs.html)']}
  }
 },
 'video/mp4-to-gif':{
  type:'tool',
  intent:{primary:'convert an MP4 video to a GIF',secondary:['phone MP4 to GIF upright','60 fps MP4 to GIF','HEVC MP4 fails'],
   goal:'a GIF from an MP4 section, upright and evenly paced, knowing which MP4 codecs the browser decodes',input:'MP4 (H.264, HEVC or AV1 video)',output:'animated GIF (<name>.gif)',support:'full',
   evidence:['src/media-modern-worker.js gifFrames (CanvasSink width → display size with rotation, times start + i × speed ÷ fps, crop after scaling)','assets/vendor/mediabunny-1.58.1/src/media-sink.ts (last frame at or before t; rotation from metadata)','tests/media-browser.mjs (H.264 MP4 → GIF 640 px, 24 frames)'],
   external:['MDN containers: MP4 video codecs','caniuse: HEVC support']},
  en:{
   answer:'Open the MP4, choose a few seconds, pick a width and a frame rate, and Nerulio decodes the MP4\'s video track with your browser\'s WebCodecs decoder and writes a GIF. Most MP4s carry H.264 video, which browsers decode widely; MP4s from newer phones and cameras may carry HEVC or AV1, whose support depends on the browser and device. The audio track is ignored, a phone\'s rotation flag is applied, and a variable-frame-rate recording becomes an evenly paced GIF.',
   concept:{title:'What is inside an MP4, and what the GIF keeps',body:[
    'MP4 is a container. The video inside is usually H.264 (AVC); MDN also lists AV1 and VP9 as MP4 video codecs, and many phones write HEVC. The container stores a timestamp for every frame and, for phone recordings, a rotation flag. Nerulio reads those with Mediabunny and decodes only the frames it needs, in time order, in a background worker.',
    'Phone MP4s are often recorded at 30 or 60 fps and with a variable frame rate. A GIF has fixed delays, so Nerulio samples the section at even steps of 1 ÷ fps seconds and takes whichever frame is on screen at each step: a 60 fps recording at 15 fps keeps one frame in four, and uneven source timing comes out evenly paced.',
    'A portrait phone MP4 is usually stored as landscape pixels plus a 90° rotation flag. Frames are turned upright before scaling, so the width you pick applies to the upright picture: 480 px wide from a 1080 × 1920 clip gives 480 × 853.'],
    terms:[['H.264 (AVC)','The most common MP4 video codec, widely decoded by browsers.'],['Variable frame rate','Frame timestamps that are not evenly spaced, common in phone and screen recordings.'],['Rotation flag','Metadata saying the stored picture must be turned for display.']]},
   example:{title:'Example: a 4-second portrait phone MP4 at 60 fps',lead:'Width 480 px, 15 fps, crop 4:5:',lines:[
    'Source        1080 × 1920 as displayed (stored 1920 × 1080 + 90° flag), 60 fps, H.264 + AAC',
    'Width 480     480 × 853 px after turning upright',
    'Frames        4 s × 15 fps = 60 frames: one source frame in four',
    'Crop 4:5      480 × 600 px, centred (253 px cut: 126 at the top, 127 at the bottom)',
    'Index data    480 × 600 × 60 = 17.3 million bytes before LZW',
    'AAC audio     not read'],
    after:'Without the crop the same GIF is 480 × 853 × 60 = 24.6 million bytes of index data, which is why tall phone clips are worth cropping or narrowing.'},
   mapping:{title:'From the MP4 to the GIF',head:['In the MP4','In Nerulio','In the GIF'],rows:[
    ['H.264, HEVC or AV1 video track','Decoded frame by frame with WebCodecs','Palette images of up to 256 colours'],
    ['Frame timestamps, even or variable','Sampled every 1 ÷ fps s inside the section','Delays in 1/100 s, e.g. 70-60-70 ms at 15 fps'],
    ['Rotation flag','Applied before scaling','Upright frames'],
    ['AAC audio track','Not read','No sound'],
    ['Other tracks, chapters, subtitles','Ignored','—']]},
   verify:{steps:[
    'After opening, the file line shows the upright dimensions and the duration; a sideways size means the MP4 has no rotation flag.',
    'The frame count in the summary should be seconds × fps ÷ speed.',
    'Compare the GIF\'s first frame with the MP4 at the section start using the Result and Source tabs.']},
   trouble:{rows:[
    ['Decoder error as soon as the GIF starts','The MP4 holds HEVC or AV1 and this browser has no decoder for it','`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1 clip.mp4`','Use a browser that decodes it, or export the MP4 again as H.264'],
    ['The GIF looks choppier than the MP4','A 60 fps MP4 sampled at 15 fps keeps one frame in four','Frame count in the summary','Choose 24 fps, or keep a short MP4 with [[video/trim|trim]]'],
    ['The GIF is sideways','The MP4 carries no rotation flag, or one the reader does not apply','Compare with the phone\'s own player','Export the MP4 again from the phone or editor'],
    ['The file is far too big for a portrait clip','Tall frames: 853 px high at 480 px wide','Result dimensions','Crop to 4:5 or 1:1, or choose 320 px']]},
   alternatives:{rows:[
    ['FFmpeg with `palettegen` and `paletteuse` on the MP4','Scripts and batches, with one palette for the whole clip.'],
    ['Keep it as a short MP4','Where the platform plays MP4: smaller than a GIF and with sound; cut it with [[video/trim|trim]].']]},
   limits:['The browser must decode the MP4\'s video codec; HEVC and AV1 support varies by browser and device.','Only the primary video track is used.'],
   versions:{body:['Checked in tests/media-browser.mjs with a 1920 × 1080 H.264/AAC MP4 in Chromium 153 and Firefox 155: 2 s at 640 px and 12 fps gave 24 frames 640 px wide. MP4 codec facts follow MDN; HEVC browser support is from caniuse.'],sources:['[MDN: Media container formats](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[caniuse: HEVC/H.265 video format](https://caniuse.com/hevc)']}
  },
  ko:{
   answer:'MP4를 열고 몇 초를 고른 뒤 폭과 프레임레이트를 정하면, Nerulio가 브라우저의 WebCodecs 디코더로 MP4의 영상 트랙을 디코딩해 GIF를 만듭니다. 대부분의 MP4에는 브라우저가 널리 디코딩하는 H.264 영상이 들어 있지만, 최신 휴대폰·카메라의 MP4에는 HEVC나 AV1이 들어 있을 수 있고 그 지원은 브라우저와 기기에 따라 다릅니다. 음성 트랙은 무시하고, 휴대폰의 회전 정보는 적용하며, 프레임 간격이 불규칙한 녹화도 일정한 속도의 GIF가 됩니다.',
   concept:{title:'MP4 안에 든 것과 GIF에 남는 것',body:[
    'MP4는 컨테이너입니다. 안의 영상은 보통 H.264(AVC)이고, MDN은 MP4 영상 코덱으로 AV1과 VP9도 꼽으며, 많은 휴대폰이 HEVC로 기록합니다. 컨테이너에는 프레임마다 시각이, 휴대폰 녹화라면 회전 정보가 들어 있습니다. Nerulio는 Mediabunny로 이를 읽고, 필요한 프레임만 시간 순서대로 백그라운드 워커에서 디코딩합니다.',
    '휴대폰 MP4는 30fps나 60fps에, 프레임 간격이 일정하지 않은 가변 프레임레이트로 녹화되는 일이 많습니다. GIF는 지연이 고정이므로 Nerulio는 구간을 1 ÷ fps초 간격으로 똑같이 나눠 각 순간에 화면에 있는 프레임을 가져옵니다. 60fps 녹화를 15fps로 만들면 네 프레임 중 하나가 남고, 불규칙한 원본 타이밍은 일정한 속도가 됩니다.',
    '세로 휴대폰 MP4는 보통 가로 픽셀에 90° 회전 정보를 붙여 저장됩니다. 프레임을 먼저 똑바로 세운 뒤 크기를 줄이므로, 고른 폭은 세운 그림에 적용됩니다. 1080 × 1920 클립을 폭 480 px로 하면 480 × 853입니다.'],
    terms:[['H.264(AVC)','가장 흔한 MP4 영상 코덱으로, 브라우저가 널리 디코딩합니다.'],['가변 프레임레이트','프레임 시각의 간격이 일정하지 않은 것. 휴대폰·화면 녹화에서 흔합니다.'],['회전 정보','저장된 그림을 돌려서 보여야 한다는 메타데이터.']]},
   example:{title:'예시: 60fps로 찍은 4초짜리 세로 휴대폰 MP4',lead:'폭 480 px, 15fps, 4:5 자르기:',lines:[
    '원본          표시 크기 1080 × 1920(저장 1920 × 1080 + 90° 정보), 60 fps, H.264 + AAC',
    '폭 480        똑바로 세운 뒤 480 × 853 px',
    '프레임        4 s × 15 fps = 60 프레임: 원본 네 프레임 중 하나',
    '4:5 자르기    480 × 600 px, 가운데 기준(253 px 잘림: 위 126, 아래 127)',
    '번호 데이터   480 × 600 × 60 = LZW 전 1,730만 바이트',
    'AAC 음성      읽지 않음'],
    after:'자르지 않으면 같은 GIF가 480 × 853 × 60 = 번호 데이터 2,460만 바이트입니다. 그래서 긴 세로 클립은 자르거나 폭을 줄일 가치가 있습니다.'},
   mapping:{title:'MP4에서 GIF로',head:['MP4에서','Nerulio에서','GIF에서'],rows:[
    ['H.264·HEVC·AV1 영상 트랙','WebCodecs로 프레임마다 디코딩','최대 256색 팔레트 이미지'],
    ['프레임 시각(일정하거나 가변)','구간 안에서 1 ÷ fps초마다 뽑음','1/100초 단위 지연, 예: 15fps에서 70-60-70 ms'],
    ['회전 정보','크기 조정 전에 적용','똑바로 선 프레임'],
    ['AAC 음성 트랙','읽지 않음','소리 없음'],
    ['기타 트랙, 챕터, 자막','무시','—']]},
   verify:{steps:[
    '파일을 열면 파일 줄에 세운 상태의 크기와 길이가 나옵니다. 가로세로가 뒤바뀌어 있다면 MP4에 회전 정보가 없는 것입니다.',
    '요약의 프레임 수는 초 × fps ÷ 속도여야 합니다.',
    '결과 탭과 원본 탭으로 GIF의 첫 프레임과 구간 시작의 MP4를 비교하세요.']},
   trouble:{rows:[
    ['GIF를 시작하자마자 디코더 오류','MP4에 HEVC나 AV1이 들어 있고 이 브라우저에 그 디코더가 없음','`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1 clip.mp4`','디코딩되는 브라우저를 쓰거나 MP4를 H.264로 다시 내보내기'],
    ['GIF가 MP4보다 끊겨 보임','60fps MP4를 15fps로 뽑으면 네 프레임 중 하나만 남음','요약의 프레임 수','24fps를 고르거나 [[video/trim|자르기]]로 짧은 MP4를 유지'],
    ['GIF가 옆으로 누움','MP4에 회전 정보가 없거나 읽기 도구가 적용하지 않는 방식','휴대폰 기본 플레이어와 비교','휴대폰이나 편집기에서 MP4를 다시 내보내기'],
    ['세로 클립인데 파일이 너무 큼','세로로 긴 프레임: 폭 480 px에 높이 853 px','결과 크기','4:5나 1:1로 자르거나 320 px 선택']]},
   alternatives:{rows:[
    ['MP4에 `palettegen`·`paletteuse`를 쓰는 FFmpeg','클립 전체에 팔레트 하나를 쓰는 스크립트·일괄 작업.'],
    ['짧은 MP4로 그대로 두기','플랫폼이 MP4를 재생한다면 GIF보다 작고 소리도 있습니다. [[video/trim|자르기]]로 잘라 두세요.']]},
   limits:['브라우저가 MP4의 영상 코덱을 디코딩해야 하며, HEVC와 AV1 지원은 브라우저와 기기마다 다릅니다.','기본 영상 트랙 하나만 씁니다.'],
   versions:{body:['tests/media-browser.mjs로 1920 × 1080 H.264/AAC MP4를 써서 Chromium 153과 Firefox 155에서 확인했습니다. 2초를 640 px·12fps로 만들면 폭 640 px의 24프레임이 나왔습니다. MP4 코덱 내용은 MDN, HEVC 브라우저 지원은 caniuse를 따랐습니다.'],sources:['[MDN: 미디어 컨테이너 형식](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[caniuse: HEVC/H.265](https://caniuse.com/hevc)']}
  },
  ja:{
   answer:'MP4を開いて数秒を選び、幅とフレームレートを決めると、NerulioがブラウザのWebCodecsデコーダーでMP4の映像トラックをデコードしてGIFを作ります。多くのMP4には、ブラウザが広くデコードできるH.264の映像が入っていますが、新しいスマホやカメラのMP4にはHEVCやAV1が入っていることがあり、その対応はブラウザと端末によります。音声トラックは無視し、スマホの回転情報は反映し、フレーム間隔が不規則な録画も一定のテンポのGIFになります。',
   concept:{title:'MP4の中身と、GIFに残るもの',body:[
    'MP4はコンテナです。中の映像はたいていH.264（AVC）で、MDNはMP4の映像コーデックとしてAV1とVP9も挙げており、多くのスマホはHEVCで記録します。コンテナにはフレームごとの時刻と、スマホの録画なら回転情報が入っています。NerulioはMediabunnyでそれを読み、必要なフレームだけを時刻順にバックグラウンドのワーカーでデコードします。',
    'スマホのMP4は30fpsや60fpsで、フレーム間隔が一定でない可変フレームレートで記録されることがよくあります。GIFの遅延は固定なので、Nerulioは区間を1 ÷ fps秒の等間隔で区切り、各瞬間に表示されているフレームを取ります。60fpsの録画を15fpsにすると4フレームに1つが残り、不規則な元のタイミングは一定のテンポになります。',
    '縦長のスマホMP4は、たいてい横長の画素に90°の回転情報を付けて保存されています。先にフレームを正しい向きにしてから縮小するので、選んだ幅は正しい向きの絵に適用されます。1080 × 1920のクリップを幅480 pxにすると480 × 853です。'],
    terms:[['H.264（AVC）','最も一般的なMP4の映像コーデックで、ブラウザが広くデコードできます。'],['可変フレームレート','フレームの時刻の間隔が一定でないこと。スマホや画面録画でよくあります。'],['回転情報','保存された絵を回して表示するよう示すメタデータ。']]},
   example:{title:'例：60fpsで撮った4秒の縦長スマホMP4',lead:'幅480 px、15fps、4:5で切り抜き：',lines:[
    '元の動画      表示サイズ1080 × 1920（保存は1920 × 1080 + 90°の情報）、60 fps、H.264 + AAC',
    '幅480         正しい向きにして480 × 853 px',
    'フレーム      4 s × 15 fps = 60フレーム：元の4フレームに1つ',
    '4:5切り抜き   480 × 600 px、中央基準（253 px削る：上126、下127）',
    '番号データ    480 × 600 × 60 = LZW前で1,730万バイト',
    'AAC音声       読まない'],
    after:'切り抜かなければ同じGIFは480 × 853 × 60 = 番号データ2,460万バイトになります。縦に長いスマホのクリップは、切り抜くか幅を狭める価値があります。'},
   mapping:{title:'MP4からGIFへ',head:['MP4の中','Nerulioで','GIFでは'],rows:[
    ['H.264・HEVC・AV1の映像トラック','WebCodecsで1フレームずつデコード','最大256色のパレット画像'],
    ['フレームの時刻（一定または可変）','区間内で1 ÷ fps秒ごとに取り出す','1/100秒単位の遅延。15fpsなら70-60-70 ms'],
    ['回転情報','縮小の前に適用','正しい向きのフレーム'],
    ['AAC音声トラック','読まない','音なし'],
    ['その他のトラック、チャプター、字幕','無視','—']]},
   verify:{steps:[
    '開くと、ファイルの行に正しい向きでのサイズと長さが出ます。縦横が逆なら、MP4に回転情報がありません。',
    '要約のフレーム数は、秒数 × fps ÷ 速度になるはずです。',
    '「結果」と「元の動画」のタブで、GIFの最初のフレームと区間の始まりのMP4を比べます。']},
   trouble:{rows:[
    ['GIFを始めてすぐデコーダーのエラー','MP4にHEVCかAV1が入っていて、このブラウザにそのデコーダーがない','`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1 clip.mp4`','デコードできるブラウザを使うか、MP4をH.264で書き出し直す'],
    ['GIFがMP4よりカクカクする','60fpsのMP4を15fpsで取り出すと4フレームに1つしか残らない','要約のフレーム数','24fpsを選ぶか、[[video/trim|切り出し]]で短いMP4のままにする'],
    ['GIFが横向きになる','MP4に回転情報がない、または読み込み側が適用しない形式','スマホ標準のプレーヤーと比べる','スマホや編集ソフトからMP4を書き出し直す'],
    ['縦長のクリップでファイルが大きすぎる','縦に長いフレーム：幅480 pxで高さ853 px','結果のサイズ','4:5か1:1で切り抜くか、320 pxを選ぶ']]},
   alternatives:{rows:[
    ['MP4に`palettegen`と`paletteuse`を使うFFmpeg','クリップ全体で1つのパレットを使うスクリプトや一括処理。'],
    ['短いMP4のままにする','投稿先がMP4を再生できるなら、GIFより小さく音声も付きます。[[video/trim|切り出し]]で切っておきましょう。']]},
   limits:['ブラウザがMP4の映像コーデックをデコードできる必要があり、HEVCとAV1の対応はブラウザと端末によって違います。','使うのは主な映像トラック1本だけです。'],
   versions:{body:['tests/media-browser.mjsで、1920 × 1080のH.264/AAC MP4を使いChromium 153とFirefox 155で確認しました。2秒を640 px・12fpsにすると幅640 pxの24フレームになりました。MP4のコーデックはMDN、HEVCのブラウザー対応はcaniuseに基づきます。'],sources:['[MDN：メディアコンテナ形式](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[caniuse：HEVC/H.265](https://caniuse.com/hevc)']}
  }
 },
 'video/mov-to-gif':{
  type:'tool',
  intent:{primary:'convert a MOV (iPhone or QuickTime) video to a GIF',secondary:['iPhone video to GIF','MOV not supported in the browser','HEVC or ProRes MOV'],
   goal:'a GIF from a MOV, or a clear diagnosis of why this MOV cannot be decoded here and what to change',input:'MOV (QuickTime) with H.264, HEVC or ProRes video',output:'animated GIF (<name>.gif)',support:'partial',
   evidence:['assets/vendor/mediabunny-1.58.1/src/input-format.ts (QuickTime input format in ALL_FORMATS)','src/media.js openMedia (continues when the browser preview fails but the probe succeeded)','src/media-modern-worker.js gifFrames (WebCodecs decode required)','tests/media-browser.mjs has no MOV case'],
   external:['Apple: HEIF/HEVC and Most Compatible','Apple: ProRes on iPhone','caniuse: HEVC','W3C WebCodecs codec registry','MDN: containers (QuickTime)']},
  en:{
   answer:'MOV is Apple\'s QuickTime container, and whether it becomes a GIF depends on the video codec inside. An iPhone set to Most Compatible records H.264, which browsers decode widely; the default High Efficiency setting records HEVC, which only some browsers and devices decode; ProRes, recorded by Pro iPhones and used by cameras and editors, is not a codec browsers decode. Nerulio reads the MOV container itself, so a MOV your browser will not preview can still work when its codec is decodable.',
   concept:{title:'Why the same .mov works on one computer and fails on another',body:[
    'A .mov file is a QuickTime container. MDN lists QuickTime as a format that only older Safari played in the browser, but Nerulio does not rely on the browser for the container: Mediabunny reads the MOV structure itself and hands the compressed frames to WebCodecs. What decides success is the video codec.',
    'The WebCodecs codec registry defines AV1, H.264 (AVC), HEVC, VP8 and VP9 for video. H.264 is decoded widely. HEVC is uneven: caniuse lists partial support in Chrome from version 107 and Firefox from 137 and full support in Safari from 13, and MDN notes that Chrome relies on hardware support on Windows. ProRes is not in the registry, so a ProRes MOV cannot be turned into a GIF in a browser.',
    'Apple\'s camera setting decides the codec of new iPhone videos: Settings › Camera › Formats › Most Compatible records H.264 instead of HEVC. Apple also notes that when you share HEVC media, it may be sent in a more compatible format such as H.264 if the receiving device lacks support.'],
    terms:[['QuickTime (MOV)','Apple\'s container format, the ancestor of the MP4 box structure, allowing more codecs.'],['HEVC (H.265)','The video codec of iPhones set to High Efficiency; decoding depends on the browser and hardware.'],['ProRes','Apple\'s editing codec; Pro iPhones can record it, and Apple says ProRes files are up to 30 times larger than HEVC.']]},
   example:{title:'Example: read the codec before you start',lead:'FFmpeg\'s ffprobe prints a MOV\'s video codec in one command:',lines:[
    '$ ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 IMG_0420.MOV',
    'codec_name=hevc',
    'width=1920',
    'height=1080',
    'h264 → works · hevc → only where the browser decodes HEVC · prores → not in browsers',
    'GIF at 480 px, 15 fps, 5 s → 480 × 270 × 75 = 9.7 million bytes of index data'],
    after:'Without ffprobe, open the file here: if it opens (duration and size shown) but the GIF stops with a decoder error, the codec is the problem, not the file.'},
   mapping:{title:'MOV codecs and what happens',head:['Inside the MOV','Where it comes from','GIF in the browser'],rows:[
    ['H.264 video','iPhone set to Most Compatible','Works'],
    ['HEVC video','iPhone default (High Efficiency)','Works only where the browser and device decode HEVC'],
    ['ProRes video','Pro iPhones with Apple ProRes on, cameras, editing exports','Not decodable in browsers'],
    ['Audio track (AAC or PCM)','Most MOVs','Ignored; a GIF has no sound']]},
   verify:{steps:[
    'Open the MOV: the file line should show dimensions and duration even if the preview stays black.',
    'Wait for the size estimate: it decodes three real frames, so an estimate appearing means the codec decodes in this browser.',
    'Check that the GIF is upright: iPhone portrait clips carry a rotation flag that Nerulio applies.']},
   trouble:{rows:[
    ['The preview stays black but the file opened','The browser\'s own player does not play this MOV, while Nerulio\'s reader can','The file line shows duration and size','Try the GIF anyway; if it stops with a decoder error, see the next rows'],
    ['Decoder error on an iPhone clip','HEVC video in a browser or on a device without an HEVC decoder','ffprobe shows codec_name=hevc','Try another browser or device, set the iPhone to Most Compatible for new clips, or share the clip in a compatible format first'],
    ['Decoder error on a large MOV from a camera or editor','ProRes video, which browsers do not decode','ffprobe shows codec_name=prores','Export an H.264 MP4 or MOV from the editor first'],
    ['Colours look flat compared with the Photos app','An HDR recording is converted to 8-bit when it is drawn, and the browser decides how','Check whether the clip was recorded in HDR','Record in SDR for GIFs, or accept the conversion']]},
   alternatives:{rows:[
    ['FFmpeg with `palettegen` and `paletteuse`','HEVC or ProRes MOVs that no browser here decodes, since FFmpeg decodes these codecs itself.'],
    ['Convert the clip to H.264 first on the Mac or iPhone','When you make many GIFs from HEVC clips: afterwards every browser path works.']]},
   limits:['ProRes MOVs cannot be converted in a browser.','HEVC works only where the browser and device decode it; Nerulio adds no HEVC decoder.'],
   versions:{body:['Nerulio\'s media suite (tests/media-browser.mjs) uses H.264 MP4 and VP9 WebM test files; MOV input is not part of it. The MOV behaviour here follows the QuickTime reader in Mediabunny 1.58.1 and the official documentation below: Apple for camera formats and ProRes, caniuse and MDN for HEVC support, and the W3C registry for the codec list.'],sources:['[Apple: Using HEIF or HEVC media on Apple devices](https://support.apple.com/en-us/116944)','[Apple: About Apple ProRes on iPhone](https://support.apple.com/en-us/109041)','[caniuse: HEVC/H.265 video format](https://caniuse.com/hevc)','[W3C: WebCodecs Codec Registry](https://www.w3.org/TR/webcodecs-codec-registry/)']}
  },
  ko:{
   answer:'MOV는 Apple의 QuickTime 컨테이너이고, GIF가 되는지는 안에 든 영상 코덱에 달려 있습니다. `Most Compatible`로 설정한 아이폰은 브라우저가 널리 디코딩하는 H.264로 찍고, 기본값인 `High Efficiency`는 일부 브라우저·기기만 디코딩하는 HEVC로 찍습니다. Pro 아이폰과 카메라·편집기가 쓰는 ProRes는 브라우저가 디코딩하는 코덱이 아닙니다. Nerulio는 MOV 컨테이너를 직접 읽으므로, 브라우저가 미리보기를 못 하는 MOV도 코덱이 디코딩되면 변환할 수 있습니다.',
   concept:{title:'같은 .mov가 어떤 컴퓨터에서는 되고 어떤 곳에서는 안 되는 이유',body:[
    '.mov 파일은 QuickTime 컨테이너입니다. MDN은 QuickTime을 예전 Safari만 브라우저에서 재생하던 형식으로 적고 있지만, Nerulio는 컨테이너를 브라우저에 맡기지 않습니다. Mediabunny가 MOV 구조를 직접 읽고 압축된 프레임을 WebCodecs에 넘깁니다. 성공 여부를 가르는 것은 영상 코덱입니다.',
    'WebCodecs 코덱 레지스트리가 정의하는 영상 코덱은 AV1, H.264(AVC), HEVC, VP8, VP9입니다. H.264는 널리 디코딩됩니다. HEVC는 들쭉날쭉해서, caniuse는 크롬 107부터와 파이어폭스 137부터 부분 지원, 사파리 13부터 전체 지원으로 적고 있고, MDN은 윈도우의 크롬이 하드웨어 지원에 기댄다고 설명합니다. ProRes는 레지스트리에 없으므로 ProRes MOV는 브라우저에서 GIF로 만들 수 없습니다.',
    '새 아이폰 영상의 코덱은 카메라 설정이 정합니다. `Settings › Camera › Formats`에서 `Most Compatible`을 고르면 HEVC 대신 H.264로 찍습니다. Apple은 HEVC 미디어를 공유할 때 받는 기기가 지원하지 않으면 H.264 같은 호환 형식으로 보내질 수 있다고도 안내합니다.'],
    terms:[['QuickTime(MOV)','Apple의 컨테이너 형식. MP4 박스 구조의 원형으로, 더 많은 코덱을 허용합니다.'],['HEVC(H.265)','`High Efficiency`로 설정한 아이폰의 영상 코덱. 디코딩은 브라우저와 하드웨어에 달려 있습니다.'],['ProRes','Apple의 편집용 코덱. Pro 아이폰이 기록할 수 있고, Apple에 따르면 ProRes 파일은 HEVC보다 최대 30배 큽니다.']]},
   example:{title:'예시: 시작하기 전에 코덱 읽기',lead:'FFmpeg의 ffprobe 명령 하나로 MOV의 영상 코덱을 볼 수 있습니다.',lines:[
    '$ ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 IMG_0420.MOV',
    'codec_name=hevc',
    'width=1920',
    'height=1080',
    'h264 → 됨 · hevc → 브라우저가 HEVC를 디코딩할 때만 · prores → 브라우저에서는 안 됨',
    '480 px, 15 fps, 5초 GIF → 480 × 270 × 75 = 번호 데이터 970만 바이트'],
    after:'ffprobe가 없다면 여기서 파일을 열어 보세요. 열리는데(길이와 용량 표시) GIF가 디코더 오류로 멈춘다면 파일이 아니라 코덱이 문제입니다.'},
   mapping:{title:'MOV의 코덱과 결과',head:['MOV 안에','어디서 오나','브라우저에서 GIF'],rows:[
    ['H.264 영상','`Most Compatible`로 설정한 아이폰','됨'],
    ['HEVC 영상','아이폰 기본값(`High Efficiency`)','브라우저와 기기가 HEVC를 디코딩할 때만 됨'],
    ['ProRes 영상','Apple ProRes를 켠 Pro 아이폰, 카메라, 편집기 내보내기','브라우저에서 디코딩 불가'],
    ['음성 트랙(AAC나 PCM)','대부분의 MOV','무시함. GIF에는 소리가 없음']]},
   verify:{steps:[
    'MOV를 여세요. 미리보기가 검게 남아도 파일 줄에 크기와 길이가 나와야 합니다.',
    '예상 용량이 뜨는지 보세요. 실제 프레임 3장을 디코딩하므로, 예상치가 나오면 이 브라우저에서 코덱이 디코딩된다는 뜻입니다.',
    'GIF가 똑바로 서 있는지 보세요. 아이폰 세로 영상의 회전 정보를 Nerulio가 적용합니다.']},
   trouble:{rows:[
    ['파일은 열렸는데 미리보기가 검음','브라우저 자체 플레이어는 이 MOV를 재생하지 못하지만 Nerulio의 읽기 도구는 읽을 수 있음','파일 줄에 길이와 용량이 나옴','일단 GIF를 만들어 보고, 디코더 오류가 나면 아래 행 참고'],
    ['아이폰 영상에서 디코더 오류','HEVC 디코더가 없는 브라우저·기기에서 HEVC 영상을 엶','ffprobe에 codec_name=hevc','다른 브라우저·기기를 쓰거나, 새 영상은 `Most Compatible`로 찍거나, 먼저 호환 형식으로 공유하기'],
    ['카메라·편집기의 큰 MOV에서 디코더 오류','브라우저가 디코딩하지 않는 ProRes 영상','ffprobe에 codec_name=prores','편집기에서 먼저 H.264 MP4나 MOV로 내보내기'],
    ['사진 앱보다 색이 밋밋함','HDR 녹화는 그릴 때 8비트로 바뀌며 방식은 브라우저가 정함','HDR로 찍었는지 확인','GIF용이면 SDR로 찍거나 변환 결과를 받아들이기']]},
   alternatives:{rows:[
    ['`palettegen`·`paletteuse`를 쓰는 FFmpeg','여기 브라우저가 디코딩하지 못하는 HEVC·ProRes MOV. FFmpeg는 이 코덱들을 자체적으로 디코딩합니다.'],
    ['맥이나 아이폰에서 먼저 H.264로 변환','HEVC 영상으로 GIF를 많이 만들 때. 그 뒤에는 어느 브라우저에서도 됩니다.']]},
   limits:['ProRes MOV는 브라우저에서 변환할 수 없습니다.','HEVC는 브라우저와 기기가 디코딩할 때만 됩니다. Nerulio가 HEVC 디코더를 따로 더하지 않습니다.'],
   versions:{body:['Nerulio의 미디어 테스트(tests/media-browser.mjs)는 H.264 MP4와 VP9 WebM 파일을 쓰며, MOV 입력은 포함하지 않습니다. 여기의 MOV 동작은 Mediabunny 1.58.1의 QuickTime 읽기와 아래 공식 문서를 따릅니다. 카메라 형식과 ProRes는 Apple, HEVC 지원은 caniuse와 MDN, 코덱 목록은 W3C 레지스트리입니다.'],sources:['[Apple: Apple 기기에서 HEIF 또는 HEVC 미디어 사용하기](https://support.apple.com/en-us/116944)','[Apple: iPhone의 Apple ProRes](https://support.apple.com/en-us/109041)','[caniuse: HEVC/H.265](https://caniuse.com/hevc)','[W3C: WebCodecs 코덱 레지스트리](https://www.w3.org/TR/webcodecs-codec-registry/)']}
  },
  ja:{
   answer:'MOVはAppleのQuickTimeコンテナで、GIFにできるかは中の映像コーデック次第です。`Most Compatible`にしたiPhoneは、ブラウザが広くデコードできるH.264で記録し、既定の`High Efficiency`は一部のブラウザと端末しかデコードできないHEVCで記録します。ProiPhoneやカメラ、編集ソフトが使うProResは、ブラウザがデコードするコーデックではありません。NerulioはMOVのコンテナを自分で読むので、ブラウザがプレビューできないMOVでも、コーデックがデコードできれば変換できます。',
   concept:{title:'同じ.movがあるパソコンでは動き、別の環境では失敗する理由',body:[
    '.movファイルはQuickTimeのコンテナです。MDNはQuickTimeを、ブラウザでは古いSafariだけが再生していた形式として挙げていますが、Nerulioはコンテナをブラウザに任せません。MediabunnyがMOVの構造を自分で読み、圧縮されたフレームをWebCodecsに渡します。成否を分けるのは映像コーデックです。',
    'WebCodecsのコーデックレジストリが定める映像コーデックは、AV1、H.264（AVC）、HEVC、VP8、VP9です。H.264は広くデコードできます。HEVCはまちまちで、caniuseはChromeで107から、Firefoxで137から部分対応、Safariで13から完全対応としており、MDNはWindowsのChromeがハードウェアの対応に頼ると説明しています。ProResはレジストリにないため、ProResのMOVはブラウザではGIFにできません。',
    '新しいiPhoneの動画のコーデックはカメラの設定で決まります。`Settings › Camera › Formats`で`Most Compatible`を選ぶと、HEVCではなくH.264で記録します。AppleはHEVCのメディアを共有するとき、受け取る端末が非対応ならH.264などの互換性の高い形式で送られることがあるとも案内しています。'],
    terms:[['QuickTime（MOV）','Appleのコンテナ形式。MP4のボックス構造の原型で、より多くのコーデックを許します。'],['HEVC（H.265）','`High Efficiency`にしたiPhoneの映像コーデック。デコードはブラウザとハードウェア次第です。'],['ProRes','Appleの編集用コーデック。Pro iPhoneで記録でき、AppleによればProResのファイルはHEVCの最大30倍の大きさです。']]},
   example:{title:'例：始める前にコーデックを調べる',lead:'FFmpegのffprobeなら、1つのコマンドでMOVの映像コーデックが分かります。',lines:[
    '$ ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 IMG_0420.MOV',
    'codec_name=hevc',
    'width=1920',
    'height=1080',
    'h264 → 可 · hevc → ブラウザがHEVCをデコードできる場合のみ · prores → ブラウザでは不可',
    '480 px、15 fps、5秒のGIF → 480 × 270 × 75 = 番号データ970万バイト'],
    after:'ffprobeがなければ、ここでファイルを開いてみてください。開けて（長さと容量が表示される）GIFがデコーダーのエラーで止まるなら、問題はファイルではなくコーデックです。'},
   mapping:{title:'MOVのコーデックと結果',head:['MOVの中身','どこで作られるか','ブラウザでのGIF'],rows:[
    ['H.264の映像','`Most Compatible`にしたiPhone','可'],
    ['HEVCの映像','iPhoneの既定（`High Efficiency`）','ブラウザと端末がHEVCをデコードできる場合のみ可'],
    ['ProResの映像','Apple ProResをオンにしたPro iPhone、カメラ、編集ソフトの書き出し','ブラウザではデコード不可'],
    ['音声トラック（AACやPCM）','ほとんどのMOV','無視。GIFに音はない']]},
   verify:{steps:[
    'MOVを開きます。プレビューが黒いままでも、ファイルの行に解像度と長さが出るはずです。',
    '予想容量が出るのを待ちます。実際のフレーム3枚をデコードするので、予想が出ればこのブラウザでコーデックがデコードできています。',
    'GIFが正しい向きか確認します。iPhoneの縦向き動画の回転情報をNerulioが適用します。']},
   trouble:{rows:[
    ['ファイルは開けたがプレビューが黒い','ブラウザ自身のプレーヤーはこのMOVを再生できないが、Nerulioの読み込み側は読める','ファイルの行に長さと容量が出る','とりあえずGIFを作り、デコーダーのエラーが出たら下の行を参照'],
    ['iPhoneの動画でデコーダーのエラー','HEVCデコーダーのないブラウザや端末でHEVCの映像を開いた','ffprobeでcodec_name=hevc','別のブラウザや端末を使う、新しい動画は`Most Compatible`で撮る、または先に互換形式で共有する'],
    ['カメラや編集ソフトの大きなMOVでデコーダーのエラー','ブラウザがデコードしないProResの映像','ffprobeでcodec_name=prores','編集ソフトから先にH.264のMP4かMOVで書き出す'],
    ['写真アプリより色が平板','HDRの録画は描画時に8ビットへ変換され、方法はブラウザが決める','HDRで撮影したか確認','GIF用ならSDRで撮るか、変換結果を受け入れる']]},
   alternatives:{rows:[
    ['`palettegen`と`paletteuse`を使うFFmpeg','ここのブラウザがデコードできないHEVCやProResのMOV。FFmpegはこれらのコーデックを自前でデコードします。'],
    ['MacやiPhoneで先にH.264に変換する','HEVCの動画からGIFをたくさん作るとき。その後はどのブラウザでも動きます。']]},
   limits:['ProResのMOVはブラウザでは変換できません。','HEVCはブラウザと端末がデコードできる場合だけです。NerulioがHEVCデコーダーを追加することはありません。'],
   versions:{body:['Nerulioのメディアテスト（tests/media-browser.mjs）はH.264のMP4とVP9のWebMを使っており、MOVの入力は含みません。ここでのMOVの動作は、Mediabunny 1.58.1のQuickTime読み込みと以下の公式ドキュメントに基づきます。カメラの形式とProResはApple、HEVCの対応はcaniuseとMDN、コーデックの一覧はW3Cのレジストリです。'],sources:['[Apple：AppleデバイスでHEIFまたはHEVCメディアを使う](https://support.apple.com/en-us/116944)','[Apple：iPhoneのApple ProRes](https://support.apple.com/en-us/109041)','[caniuse：HEVC/H.265](https://caniuse.com/hevc)','[W3C：WebCodecsコーデックレジストリ](https://www.w3.org/TR/webcodecs-codec-registry/)']}
  }
 },
 'video/webm-to-gif':{
  type:'tool',
  intent:{primary:'convert a WebM video to a GIF',secondary:['screen recording WebM to GIF','VP9 or AV1 WebM','transparent WebM to GIF'],
   goal:'a GIF from a WebM section with the right length, knowing that transparency is not kept',input:'WebM (VP8, VP9 or AV1 video; Opus or Vorbis audio)',output:'animated GIF (<name>.gif)',support:'full',
   evidence:['src/media-modern-worker.js inspect (computeDuration from packets), gifPass (gifenc writeFrame without transparent index)','assets/vendor/mediabunny-1.58.1/src/input.ts computeDuration vs getDurationFromMetadata','tests/media-browser.mjs (60 fps VP9 WebM without audio decodes)'],
   external:['MDN: WebM codecs, VP9 mandated by WebM','caniuse: AV1']},
  en:{
   answer:'A WebM holds VP8, VP9 or AV1 video with Opus or Vorbis audio. Nerulio decodes the video with your browser\'s WebCodecs decoder and writes a GIF from the section you choose. VP8 and VP9 are widely decoded in Chrome, Edge and Firefox; AV1 depends more on the browser and device. Nerulio measures the duration from the packets rather than trusting the header, which matters for WebM written by live recorders. A WebM\'s transparency does not carry over: every GIF frame is opaque.',
   concept:{title:'VP8, VP9, AV1, and what a WebM GIF keeps',body:[
    'WebM is a Matroska-based container restricted to open codecs: VP8, VP9 or AV1 for video and Opus or Vorbis for audio. MDN describes VP9 and VP8 as the two video codecs WebM mandates; AV1 was added later, and its decoding depends more on the browser and device. Nerulio uses the video track only.',
    'Nerulio computes the length from the last packets in the file instead of trusting the header, which matters for WebM written by live recorders such as browser screen capture, where the header value can be missing. The timeline and the default 6-second section then use the real length.',
    'VP8 and VP9 can carry an alpha channel for transparent video. GIF can only mark one palette colour as fully transparent, and Nerulio\'s GIF writer does not use that, so transparent areas become opaque. For animation with transparency, keep the WebM or export a PNG sequence from the tool that made it.'],
    terms:[['Matroska','The container WebM is based on; WebM limits it to web codecs.'],['VP9','An open, royalty-free video codec, one of the two WebM mandates.'],['Alpha channel','Per-pixel transparency; VP8 and VP9 in WebM can carry it, GIF only on/off transparency.']]},
   example:{title:'Example: a 60 fps screen recording in WebM',lead:'6 seconds of a 1280 × 720 recording at 640 px and 24 fps:',lines:[
    'Source        1280 × 720 VP9, 60 fps, Opus audio, 20 s',
    'Section       8.0 → 14.0 s (6 s)',
    'Frames        6 s × 24 fps = 144 frames at 640 × 360 px (one source frame in 2.5)',
    'Delays        40 or 50 ms: 12 frames = 500 ms, a 24 fps average',
    'Index data    640 × 360 × 144 = 33.2 million bytes before LZW',
    'Flat UI       interface colours fit a 256-colour palette; leave dithering off'],
    after:'For screen recordings, a narrower width or 15 fps does more for the size than fewer colours, because flat interface colours already fit the palette.'},
   mapping:{title:'From the WebM to the GIF',head:['In the WebM','In Nerulio','In the GIF'],rows:[
    ['VP8, VP9 or AV1 video','Decoded with WebCodecs','Palette frames of up to 256 colours'],
    ['Duration in the header (may be missing)','Measured from the packets','Correct timeline and section'],
    ['Alpha channel','Not used by the GIF writer','Opaque frames'],
    ['Opus or Vorbis audio','Not read','No sound']]},
   verify:{steps:[
    'After opening, check that the length on the timeline matches the recording.',
    'Check the frame count and the size estimate before running.',
    'For a transparent WebM, view the GIF on a light and a dark background: it will be opaque.']},
   trouble:{rows:[
    ['Decoder error on an AV1 WebM','This browser or device has no AV1 decoder','ffprobe shows codec_name=av1','Use a browser that decodes AV1, or record in VP9'],
    ['A transparent background came out solid','The GIF writer here uses no transparent colour','—','Keep the WebM, or export a PNG sequence from the original tool'],
    ['Small text in a screen recording is fuzzy','Scaling 1280 px down to 480 px blurs small text','Compare at 100 %','Choose the original width, or crop to the part that matters and lower the fps instead'],
    ['The GIF is much bigger than the WebM','VP9 compresses the changes between frames; GIF stores every frame whole','Compare the two sizes','Keep the WebM where it plays; for the GIF, shorten the section or lower the fps']]},
   alternatives:{rows:[
    ['Keep the WebM','Browsers play WebM directly; it is smaller and keeps transparency and sound.'],
    ['FFmpeg with `palettegen` and `paletteuse`','Scripts, batches, and one palette for the whole clip.']]},
   limits:['No transparent GIF output.','An AV1 WebM needs a browser with an AV1 decoder.'],
   versions:{body:['Checked in tests/media-browser.mjs in Chromium 153 and Firefox 155: a 60 fps VP9 WebM without audio was decoded and re-encoded at 60 fps without an invented audio track. GIF encoding is gifenc 1.0.3. WebM codec facts follow MDN; AV1 browser support is from caniuse.'],sources:['[MDN: Media container formats](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[MDN: Web video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)','[caniuse: AV1 video format](https://caniuse.com/av1)']}
  },
  ko:{
   answer:'WebM에는 VP8·VP9·AV1 영상과 Opus·Vorbis 음성이 들어 있습니다. Nerulio는 브라우저의 WebCodecs 디코더로 영상을 디코딩해 고른 구간으로 GIF를 만듭니다. VP8·VP9는 크롬·엣지·파이어폭스에서 널리 디코딩되고, AV1은 브라우저와 기기에 더 많이 좌우됩니다. 헤더를 믿지 않고 패킷에서 길이를 재므로 실시간 녹화기가 쓴 WebM에서도 길이가 맞습니다. WebM의 투명도는 옮겨지지 않아 모든 GIF 프레임이 불투명합니다.',
   concept:{title:'VP8·VP9·AV1, 그리고 WebM GIF에 남는 것',body:[
    'WebM은 Matroska 기반 컨테이너로, 공개 코덱만 씁니다. 영상은 VP8·VP9·AV1, 음성은 Opus·Vorbis입니다. MDN은 VP9와 VP8을 WebM이 의무로 정한 두 영상 코덱이라고 설명하며, AV1은 나중에 더해졌고 디코딩이 브라우저와 기기에 더 좌우됩니다. Nerulio는 영상 트랙만 씁니다.',
    'Nerulio는 헤더 값을 믿지 않고 파일 끝의 패킷에서 길이를 계산합니다. 브라우저 화면 녹화처럼 실시간 녹화기가 쓴 WebM은 헤더 값이 빠져 있을 수 있어서 중요합니다. 타임라인과 기본 6초 구간은 실제 길이를 씁니다.',
    'VP8·VP9는 투명 영상을 위한 알파 채널을 담을 수 있습니다. GIF는 팔레트 색 하나만 완전 투명으로 표시할 수 있는데, Nerulio의 GIF 작성기는 이를 쓰지 않으므로 투명한 부분이 불투명해집니다. 투명한 애니메이션이 필요하면 WebM을 그대로 쓰거나 만든 도구에서 PNG 시퀀스로 내보내세요.'],
    terms:[['Matroska','WebM의 바탕이 된 컨테이너. WebM은 이를 웹 코덱으로 한정합니다.'],['VP9','공개·무료 영상 코덱으로, WebM이 의무로 정한 둘 중 하나.'],['알파 채널','픽셀별 투명도. WebM의 VP8·VP9는 담을 수 있고, GIF는 켜고 끄는 투명만 있습니다.']]},
   example:{title:'예시: 60fps 화면 녹화 WebM',lead:'1280 × 720 녹화 6초를 640 px·24fps로:',lines:[
    '원본          1280 × 720 VP9, 60 fps, Opus 음성, 20 s',
    '구간          8.0 → 14.0 s (6 s)',
    '프레임        6 s × 24 fps = 640 × 360 px 144 프레임(원본 2.5 프레임 중 하나)',
    '지연          40 또는 50 ms: 12 프레임 = 500 ms, 평균 24 fps',
    '번호 데이터   640 × 360 × 144 = LZW 전 3,320만 바이트',
    '평평한 UI     인터페이스 색은 256색 팔레트에 들어감. 디더링은 끄기'],
    after:'화면 녹화라면 색 수를 줄이기보다 폭을 좁히거나 15fps로 하는 편이 용량에 더 효과적입니다. 평평한 인터페이스 색은 이미 팔레트에 들어가기 때문입니다.'},
   mapping:{title:'WebM에서 GIF로',head:['WebM에서','Nerulio에서','GIF에서'],rows:[
    ['VP8·VP9·AV1 영상','WebCodecs로 디코딩','최대 256색 팔레트 프레임'],
    ['헤더의 길이(빠져 있을 수 있음)','패킷에서 잼','올바른 타임라인과 구간'],
    ['알파 채널','GIF 작성기가 쓰지 않음','불투명 프레임'],
    ['Opus·Vorbis 음성','읽지 않음','소리 없음']]},
   verify:{steps:[
    '파일을 연 뒤 타임라인의 길이가 녹화 길이와 맞는지 확인하세요.',
    '실행 전에 프레임 수와 예상 용량을 확인하세요.',
    '투명 WebM이었다면 GIF를 밝은 배경과 어두운 배경에서 보세요. 불투명하게 나옵니다.']},
   trouble:{rows:[
    ['AV1 WebM에서 디코더 오류','이 브라우저·기기에 AV1 디코더가 없음','ffprobe에 codec_name=av1','AV1을 디코딩하는 브라우저를 쓰거나 VP9로 녹화'],
    ['투명 배경이 단색으로 나옴','여기 GIF 작성기는 투명 색을 쓰지 않음','—','WebM을 그대로 쓰거나 원래 도구에서 PNG 시퀀스로 내보내기'],
    ['화면 녹화의 작은 글씨가 흐림','1280 px를 480 px로 줄이면 작은 글씨가 뭉개짐','100 %로 비교','원본 폭을 고르거나, 중요한 부분만 자르고 대신 fps를 낮추기'],
    ['GIF가 WebM보다 훨씬 큼','VP9는 프레임 사이 변화만 압축하지만 GIF는 프레임을 통째로 저장','두 용량 비교','재생되는 곳이면 WebM을 쓰고, GIF는 구간을 줄이거나 fps를 낮추기']]},
   alternatives:{rows:[
    ['WebM 그대로 쓰기','브라우저는 WebM을 바로 재생합니다. 더 작고 투명도와 소리도 유지됩니다.'],
    ['`palettegen`·`paletteuse`를 쓰는 FFmpeg','스크립트, 일괄 작업, 클립 전체에 팔레트 하나.']]},
   limits:['투명 GIF는 만들지 않습니다.','AV1 WebM은 AV1 디코더가 있는 브라우저가 필요합니다.'],
   versions:{body:['tests/media-browser.mjs로 Chromium 153과 Firefox 155에서 확인했습니다. 음성 없는 60fps VP9 WebM을 디코딩해 60fps로 다시 인코딩했고, 없는 음성 트랙을 만들어 내지 않았습니다. GIF 인코딩은 gifenc 1.0.3입니다. WebM 코덱 내용은 MDN, AV1 브라우저 지원은 caniuse를 따랐습니다.'],sources:['[MDN: 미디어 컨테이너 형식](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[MDN: 웹 영상 코덱 안내](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)','[caniuse: AV1](https://caniuse.com/av1)']}
  },
  ja:{
   answer:'WebMにはVP8・VP9・AV1の映像と、Opus・Vorbisの音声が入っています。NerulioはブラウザのWebCodecsデコーダーで映像をデコードし、選んだ区間からGIFを作ります。VP8とVP9はChrome・Edge・Firefoxで広くデコードでき、AV1はブラウザと端末にもっと左右されます。ヘッダーを信用せずパケットから長さを測るので、リアルタイムの録画ツールが書いたWebMでも長さが合います。WebMの透明はGIFに引き継がれず、すべてのフレームが不透明になります。',
   concept:{title:'VP8・VP9・AV1と、WebMのGIFに残るもの',body:[
    'WebMはMatroskaをもとにしたコンテナで、オープンなコーデックだけを使います。映像はVP8・VP9・AV1、音声はOpus・Vorbisです。MDNはVP9とVP8をWebMが必須とする2つの映像コーデックと説明しており、AV1は後から加わり、デコードはブラウザと端末にもっと左右されます。Nerulioが使うのは映像トラックだけです。',
    'Nerulioはヘッダーの値を信用せず、ファイル末尾のパケットから長さを計算します。ブラウザの画面録画のようなリアルタイムの録画ツールが書いたWebMでは、ヘッダーの値が欠けていることがあるため重要です。タイムラインと既定の6秒の区間は実際の長さを使います。',
    'VP8とVP9は、透明な動画のためのアルファチャンネルを持てます。GIFはパレットの1色を完全な透明にできるだけで、NerulioのGIF書き出しはそれを使わないため、透明な部分は不透明になります。透明なアニメーションが必要なら、WebMのまま使うか、作ったツールから連番PNGで書き出してください。'],
    terms:[['Matroska','WebMのもとになったコンテナ。WebMはWeb向けのコーデックに限定しています。'],['VP9','オープンでロイヤリティフリーの映像コーデック。WebMが必須とする2つのうちの1つ。'],['アルファチャンネル','画素ごとの透明度。WebMのVP8・VP9は持てますが、GIFは透明のオン・オフだけです。']]},
   example:{title:'例：60fpsの画面録画のWebM',lead:'1280 × 720の録画6秒を640 px・24fpsで：',lines:[
    '元の動画      1280 × 720 VP9、60 fps、Opus音声、20 s',
    '区間          8.0 → 14.0 s（6 s）',
    'フレーム      6 s × 24 fps = 640 × 360 pxで144フレーム（元の2.5フレームに1つ）',
    '遅延          40または50 ms：12フレーム = 500 ms、平均24 fps',
    '番号データ    640 × 360 × 144 = LZW前で3,320万バイト',
    '平坦なUI      画面の色は256色のパレットに収まる。ディザリングはオフ'],
    after:'画面録画では、色数を減らすより幅を狭めたり15fpsにしたりするほうが容量に効きます。平坦な画面の色はすでにパレットに収まっているからです。'},
   mapping:{title:'WebMからGIFへ',head:['WebMの中','Nerulioで','GIFでは'],rows:[
    ['VP8・VP9・AV1の映像','WebCodecsでデコード','最大256色のパレットフレーム'],
    ['ヘッダーの長さ（欠けていることがある）','パケットから測る','正しいタイムラインと区間'],
    ['アルファチャンネル','GIFの書き出しでは使わない','不透明なフレーム'],
    ['Opus・Vorbisの音声','読まない','音なし']]},
   verify:{steps:[
    '開いたら、タイムラインの長さが録画の長さと合っているか確認します。',
    '実行前に、フレーム数と予想容量を確認します。',
    '透明なWebMだった場合は、GIFを明るい背景と暗い背景で見ます。不透明になっています。']},
   trouble:{rows:[
    ['AV1のWebMでデコーダーのエラー','このブラウザや端末にAV1デコーダーがない','ffprobeでcodec_name=av1','AV1をデコードできるブラウザを使うか、VP9で録画する'],
    ['透明な背景がべた塗りになった','ここのGIF書き出しは透明色を使わない','—','WebMのまま使うか、元のツールから連番PNGで書き出す'],
    ['画面録画の小さな文字がぼやける','1280 pxを480 pxに縮めると小さな文字がつぶれる','100 %で比べる','元の幅を選ぶか、必要な部分だけ切り抜き、代わりにfpsを下げる'],
    ['GIFがWebMよりずっと大きい','VP9はフレーム間の変化を圧縮するが、GIFはフレームを丸ごと保存する','2つの容量を比べる','再生できる場所ならWebMを使い、GIFは区間を短くするかfpsを下げる']]},
   alternatives:{rows:[
    ['WebMのまま使う','ブラウザはWebMをそのまま再生できます。小さく、透明も音声も保てます。'],
    ['`palettegen`と`paletteuse`を使うFFmpeg','スクリプト、一括処理、クリップ全体で1つのパレット。']]},
   limits:['透過GIFは書き出しません。','AV1のWebMにはAV1デコーダーのあるブラウザが必要です。'],
   versions:{body:['tests/media-browser.mjsで、Chromium 153とFirefox 155を使って確認しました。音声なしの60fps VP9のWebMをデコードして60fpsで再エンコードし、存在しない音声トラックを作りませんでした。GIFのエンコードはgifenc 1.0.3です。WebMのコーデックはMDN、AV1のブラウザー対応はcaniuseに基づきます。'],sources:['[MDN：メディアコンテナ形式](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Containers)','[MDN：Web動画コーデックガイド](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)','[caniuse：AV1](https://caniuse.com/av1)']}
  }
 }
};
