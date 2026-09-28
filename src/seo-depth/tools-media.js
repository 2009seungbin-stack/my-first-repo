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
 }
};
