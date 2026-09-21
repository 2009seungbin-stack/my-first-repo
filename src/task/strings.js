/** UI copy for the home directory and task pages (ko/en/ja). Tool titles and descriptions
 * still come from the shared intent messages; this file holds only the new shell's words. */
const S={
 ko:{homeTitle:'어떤 파일 작업을 할까요?',homeLead:'설치·가입·업로드 없이, 파일은 내 기기 안에서만 처리됩니다.',dropTitle:'파일을 여기에 놓으세요',dropHint:'종류를 알아보고 맞는 도구를 바로 엽니다 · 여러 개 가능',pick:'파일 선택',search:'도구 검색 — 예: pdf 합치기, png jpg, 배경 제거',searchLabel:'도구 검색',noResult:'맞는 도구가 없습니다. 다른 말로 찾아보세요.',
  cat:{image:'이미지',pdf:'PDF',video:'영상·오디오',game:'게임 에셋'},suggest:'{n}개 파일 · 어떤 작업을 할까요?',suggestMixed:'종류가 다른 파일이 섞여 있습니다. 한 종류씩 놓아 주세요.',suggestUnknown:'지원하지 않는 파일 형식입니다.',clear:'취소',
  allTools:'모든 도구',local:'업로드 없음 · 이 기기에서 처리',sample:'샘플로 해보기',paste:'붙여넣기(Ctrl+V)도 됩니다',taskDrop:'{kind}을(를) 여기에 놓으세요',kinds:{image:'이미지',pdf:'PDF',media:'영상'},multi:'여러 개를 한 번에 처리할 수 있습니다',
  add:'+ 파일 추가',removeAll:'모두 지우기',remove:'목록에서 빼기',download:'다운로드',downloadAll:'모두 다운로드 ({n}개 · ZIP)',saveOne:'이 파일만 저장',advanced:'고급 설정',openEditor:'고급 편집기에서 열기',next:'이어서 하기',
  waiting:'대기 중',working:'처리 중…',failed:'실패',compareHint:'가운데 선을 좌우로 끌어 원본과 결과를 비교하세요.',before:'원본',after:'결과',compare:'원본과 결과 비교',files:'{n}개 파일',calculating:'계산 중…',
  wrongKind:'이 도구는 {kind} 파일만 처리합니다.',zipping:'ZIP 파일을 만드는 중…',
  compress:{small:'가장 작게',smallHint:'공유·업로드용',balanced:'균형',balancedHint:'추천',high:'고화질',highHint:'인쇄·보관용',format:'저장 형식',auto:'자동 (가장 작은 형식)',target:'목표 용량 (KB)',targetHint:'0이면 화질 기준으로만 압축합니다',maxWidth:'최대 너비 (px)',maxWidthHint:'0이면 원본 크기 유지',quality:'화질',shrink:'목표 용량을 못 맞추면 크기도 줄이기',bg:'JPG 배경색',kept:'이미 충분히 작아 원본을 유지했습니다',missed:'목표 용량에 맞추지 못했습니다. 크기 줄이기를 켜 보세요.',saved:'{a} → {b}',samePixels:'해상도 {w}×{h} 유지',newPixels:'{w}×{h}로 축소',meta:'위치 정보 등 메타데이터는 저장되지 않습니다.'}},
 en:{homeTitle:'What do you need to do with your file?',homeLead:'No install, no sign-up, no upload — files are processed on your device.',dropTitle:'Drop files here',dropHint:'We detect the type and open the right tool · multiple files welcome',pick:'Choose files',search:'Search tools — e.g. merge pdf, png to jpg, remove background',searchLabel:'Search tools',noResult:'No matching tool. Try different words.',
  cat:{image:'Image',pdf:'PDF',video:'Video & audio',game:'Game assets'},suggest:'{n} file(s) · what would you like to do?',suggestMixed:'These files are of different kinds. Drop one kind at a time.',suggestUnknown:'This file type is not supported.',clear:'Cancel',
  allTools:'All tools',local:'No upload · processed on this device',sample:'Try a sample',paste:'You can also paste (Ctrl+V)',taskDrop:'Drop {kind} files here',kinds:{image:'image',pdf:'PDF',media:'video'},multi:'Process many files at once',
  add:'+ Add files',removeAll:'Clear all',remove:'Remove from list',download:'Download',downloadAll:'Download all ({n} · ZIP)',saveOne:'Save this file',advanced:'Advanced settings',openEditor:'Open in the advanced editor',next:'Continue with',
  waiting:'Waiting',working:'Working…',failed:'Failed',compareHint:'Drag the divider to compare original and result.',before:'Original',after:'Result',compare:'Compare original and result',files:'{n} file(s)',calculating:'Calculating…',
  wrongKind:'This tool only handles {kind} files.',zipping:'Building ZIP…',
  compress:{small:'Smallest',smallHint:'sharing, uploads',balanced:'Balanced',balancedHint:'recommended',high:'High quality',highHint:'print, archive',format:'Output format',auto:'Auto (smallest format)',target:'Target size (KB)',targetHint:'0 compresses by quality only',maxWidth:'Max width (px)',maxWidthHint:'0 keeps the original size',quality:'Quality',shrink:'Reduce dimensions if the target cannot be met',bg:'JPG background',kept:'Already small — original kept',missed:'Target size not reached. Try allowing smaller dimensions.',saved:'{a} → {b}',samePixels:'{w}×{h} kept',newPixels:'resized to {w}×{h}',meta:'Metadata such as location is not written to the result.'}},
 ja:{homeTitle:'どんなファイル作業をしますか？',homeLead:'インストール・登録・アップロード不要。ファイルは端末の中だけで処理されます。',dropTitle:'ここにファイルをドロップ',dropHint:'種類を判別して合うツールを開きます · 複数可',pick:'ファイルを選択',search:'ツールを検索 — 例: pdf 結合, png jpg, 背景削除',searchLabel:'ツールを検索',noResult:'該当するツールがありません。別の言葉でお試しください。',
  cat:{image:'画像',pdf:'PDF',video:'動画・音声',game:'ゲーム素材'},suggest:'{n}個のファイル · 何をしますか？',suggestMixed:'種類の違うファイルが混ざっています。1種類ずつドロップしてください。',suggestUnknown:'対応していないファイル形式です。',clear:'キャンセル',
  allTools:'すべてのツール',local:'アップロードなし · この端末で処理',sample:'サンプルで試す',paste:'貼り付け(Ctrl+V)もできます',taskDrop:'{kind}をここにドロップ',kinds:{image:'画像',pdf:'PDF',media:'動画'},multi:'複数のファイルをまとめて処理できます',
  add:'+ ファイルを追加',removeAll:'すべて消去',remove:'リストから外す',download:'ダウンロード',downloadAll:'すべてダウンロード（{n}個 · ZIP）',saveOne:'このファイルだけ保存',advanced:'詳細設定',openEditor:'高度なエディターで開く',next:'続けて作業',
  waiting:'待機中',working:'処理中…',failed:'失敗',compareHint:'中央の線を左右に動かして元と結果を比べてください。',before:'元',after:'結果',compare:'元と結果を比較',files:'{n}個のファイル',calculating:'計算中…',
  wrongKind:'このツールは{kind}ファイルだけ処理します。',zipping:'ZIPを作成中…',
  compress:{small:'最小',smallHint:'共有・アップロード用',balanced:'バランス',balancedHint:'おすすめ',high:'高画質',highHint:'印刷・保管用',format:'保存形式',auto:'自動（最も小さい形式）',target:'目標サイズ (KB)',targetHint:'0なら画質だけで圧縮します',maxWidth:'最大幅 (px)',maxWidthHint:'0なら元のサイズのまま',quality:'画質',shrink:'目標に届かない場合はサイズも縮小',bg:'JPGの背景色',kept:'すでに十分小さいため元のままです',missed:'目標サイズに届きませんでした。サイズの縮小を許可してみてください。',saved:'{a} → {b}',samePixels:'解像度 {w}×{h} を維持',newPixels:'{w}×{h}に縮小',meta:'位置情報などのメタデータは保存されません。'}}
};
Object.assign(S.ko,{
 convert:{jpeg:'사진·호환성',png:'무손실·투명',webp:'웹용·작은 용량',avif:'최신·가장 작음',qualityHint:'JPG·WebP·AVIF에만 적용됩니다. PNG는 항상 무손실입니다.',alpha:'JPG는 투명을 지원하지 않아 투명한 부분이 배경색으로 채워집니다.'},
 resize:{byPercent:'비율(%)로',bySize:'픽셀로',width:'너비 (px)',height:'높이 (px)',auto:'자동',preset:'SNS·플랫폼 규격',fit:'너비·높이를 둘 다 정했을 때',contain:'전체가 보이게 맞춤',cover:'꽉 채우고 넘치는 부분 자르기',stretch:'비율 무시하고 늘리기',fitHint:'한쪽만 입력하면 원본 비율을 유지합니다.',keep:'원본 형식 유지',noEnlarge:'원본보다 크게 만들지 않기',bg:'여백 색',bgOn:'여백 채우기',mixed:'{n}가지 크기'}});
Object.assign(S.en,{
 convert:{jpeg:'photos, compatibility',png:'lossless, transparency',webp:'web, smaller files',avif:'newest, smallest',qualityHint:'Applies to JPG, WebP and AVIF. PNG is always lossless.',alpha:'JPG has no transparency; transparent areas are filled with the background colour.'},
 resize:{byPercent:'By percent',bySize:'By pixels',width:'Width (px)',height:'Height (px)',auto:'auto',preset:'Social & platform sizes',fit:'When both width and height are set',contain:'Fit inside (show everything)',cover:'Fill and crop the overflow',stretch:'Stretch, ignore ratio',fitHint:'Enter only one side to keep the original ratio.',keep:'Keep original format',noEnlarge:'Never make images larger than the original',bg:'Margin colour',bgOn:'Fill margins',mixed:'{n} different sizes'}});
Object.assign(S.ja,{
 convert:{jpeg:'写真・互換性',png:'可逆・透明',webp:'Web向け・小さい',avif:'最新・最小',qualityHint:'JPG・WebP・AVIFにだけ適用されます。PNGは常に可逆です。',alpha:'JPGは透明を扱えないため、透明部分は背景色で塗られます。'},
 resize:{byPercent:'割合(%)で',bySize:'ピクセルで',width:'幅 (px)',height:'高さ (px)',auto:'自動',preset:'SNS・各サービスの規格',fit:'幅と高さを両方指定したとき',contain:'全体が見えるように収める',cover:'埋めて、はみ出しを切り取る',stretch:'比率を無視して伸ばす',fitHint:'片方だけ入力すると元の比率を保ちます。',keep:'元の形式のまま',noEnlarge:'元より大きくしない',bg:'余白の色',bgOn:'余白を塗る',mixed:'{n}種類のサイズ'}});
S.ko.pdf={drop:'PDF를 여기에 놓으세요',dropHint:'여러 파일을 한 번에 · 이미지도 페이지로 넣을 수 있습니다',tools:'페이지 도구',pages:'페이지 목록',hint:'페이지를 끌어서 순서를 바꾸세요. 클릭으로 선택, Shift·Ctrl로 여러 장 선택, Delete로 삭제, Ctrl+Z로 되돌리기.',selectAll:'전체 선택',rotateLeft:'왼쪽으로 회전',rotateRight:'오른쪽으로 회전',moveBack:'앞으로 옮기기',moveForward:'뒤로 옮기기',duplicate:'복제',delete:'삭제',undo:'되돌리기',
 selectedN:'{n}쪽 선택됨',noneSelected:'페이지를 클릭해 선택하세요',pagesN:'{n}쪽',pageN:'{n}쪽',outputs:'파일 {n}개로 저장',part:'파일 {n}',addFiles:'+ PDF·이미지 추가',sortAZ:'파일 이름순 정렬',fileName:'저장할 파일 이름',optimize:'이미지를 최적화해 용량 줄이기',removeMeta:'문서 정보(작성자 등) 지우기',
 mode:{each:'한 쪽씩',every:'N쪽마다',ranges:'범위 지정','selected':'선택한 쪽만','odd-even':'홀수·짝수'},everyLabel:'몇 쪽마다 나눌까요?',rangesLabel:'나눌 범위',rangesHint:'세미콜론(;)으로 파일을 나눕니다. 예: 1-3; 4-8; 9',selectedHint:'왼쪽에서 고른 페이지만 새 PDF 하나로 저장합니다.',
 runMerge:'PDF 합치기 · 다운로드',runSplit:'PDF {n}개로 나누기 · 다운로드',working:'처리 중…',partProgress:'{a} / {b} 파일 만드는 중…',badRanges:'범위를 확인하세요',needSelection:'페이지를 먼저 선택하세요',doneMerge:'합치기 완료',doneSplit:'나누기 완료',again:'다시 다운로드'};
S.en.pdf={drop:'Drop PDF files here',dropHint:'Several files at once · images can be added as pages too',tools:'Page tools',pages:'Pages',hint:'Drag pages to reorder. Click to select, Shift/Ctrl for several, Delete to remove, Ctrl+Z to undo.',selectAll:'Select all',rotateLeft:'Rotate left',rotateRight:'Rotate right',moveBack:'Move earlier',moveForward:'Move later',duplicate:'Duplicate',delete:'Delete',undo:'Undo',
 selectedN:'{n} page(s) selected',noneSelected:'Click pages to select them',pagesN:'{n} pages',pageN:'Page {n}',outputs:'{n} output file(s)',part:'File {n}',addFiles:'+ Add PDFs or images',sortAZ:'Sort files A–Z',fileName:'Output file name',optimize:'Optimise images to reduce size',removeMeta:'Remove document info (author…)',
 mode:{each:'Every page',every:'Every N pages',ranges:'Custom ranges','selected':'Selected only','odd-even':'Odd / even'},everyLabel:'Split after every … pages',rangesLabel:'Ranges',rangesHint:'Separate files with semicolons, e.g. 1-3; 4-8; 9',selectedHint:'Only the pages you selected are saved, as one new PDF.',
 runMerge:'Merge PDF · Download',runSplit:'Split into {n} PDF(s) · Download',working:'Working…',partProgress:'Creating file {a} / {b}…',badRanges:'Check the ranges',needSelection:'Select pages first',doneMerge:'Merged',doneSplit:'Split complete',again:'Download again'};
S.ja.pdf={drop:'ここにPDFをドロップ',dropHint:'複数ファイルをまとめて · 画像もページとして追加できます',tools:'ページツール',pages:'ページ一覧',hint:'ページをドラッグして並べ替え。クリックで選択、Shift・Ctrlで複数選択、Deleteで削除、Ctrl+Zで元に戻す。',selectAll:'すべて選択',rotateLeft:'左に回転',rotateRight:'右に回転',moveBack:'前へ移動',moveForward:'後ろへ移動',duplicate:'複製',delete:'削除',undo:'元に戻す',
 selectedN:'{n}ページ選択中',noneSelected:'ページをクリックして選択',pagesN:'{n}ページ',pageN:'{n}ページ',outputs:'{n}個のファイルに保存',part:'ファイル{n}',addFiles:'+ PDF・画像を追加',sortAZ:'ファイル名順に並べる',fileName:'保存するファイル名',optimize:'画像を最適化して容量を減らす',removeMeta:'文書情報（作成者など）を削除',
 mode:{each:'1ページずつ',every:'Nページごと',ranges:'範囲を指定','selected':'選択のみ','odd-even':'奇数・偶数'},everyLabel:'何ページごとに分けますか？',rangesLabel:'分割する範囲',rangesHint:'セミコロン(;)でファイルを区切ります。例: 1-3; 4-8; 9',selectedHint:'選んだページだけを1つの新しいPDFとして保存します。',
 runMerge:'PDFを結合 · ダウンロード',runSplit:'{n}個のPDFに分割 · ダウンロード',working:'処理中…',partProgress:'{a} / {b} ファイルを作成中…',badRanges:'範囲を確認してください',needSelection:'先にページを選択してください',doneMerge:'結合しました',doneSplit:'分割しました',again:'もう一度ダウンロード'};
Object.assign(S.ko.pdf,{dropImages:'사진·이미지를 여기에 놓으세요',dropImagesHint:'여러 장을 한 PDF로 · 순서는 끌어서 바꿀 수 있습니다',size:{a4:'A4',letter:'Letter',fit:'사진 크기 그대로'},margin:{0:'여백 없음',24:'좁은 여백',48:'넓은 여백'},runPdf:'PDF 만들기 · 다운로드',donePdf:'PDF 완성'});
Object.assign(S.en.pdf,{dropImages:'Drop photos or images here',dropImagesHint:'Many images into one PDF · drag to change the order',size:{a4:'A4',letter:'Letter',fit:'Same as image'},margin:{0:'No margin',24:'Small margin',48:'Large margin'},runPdf:'Create PDF · Download',donePdf:'PDF ready'});
Object.assign(S.ja.pdf,{dropImages:'ここに写真・画像をドロップ',dropImagesHint:'複数の画像を1つのPDFに · ドラッグで順番を変えられます',size:{a4:'A4',letter:'Letter',fit:'画像サイズのまま'},margin:{0:'余白なし',24:'狭い余白',48:'広い余白'},runPdf:'PDFを作成 · ダウンロード',donePdf:'PDFができました'});
Object.assign(S.ko,{pdfc:{light:'약하게',lightHint:'화질 우선',balanced:'권장',balancedHint:'화질·용량 균형',strong:'강하게',strongHint:'가장 작게',raster:'페이지를 이미지로 바꿔서 더 줄이기',rasterWarn:'이 옵션을 켜면 글자 선택·검색이 되지 않습니다. 스캔 문서처럼 이미 이미지인 PDF에만 권합니다.',how:'PDF 안의 사진만 다시 압축하고 글자·도형·검색은 그대로 둡니다. 사진이 없는 PDF는 거의 줄지 않습니다.',kept:'이미 충분히 작아 원본을 유지했습니다',textKept:'글자·검색 유지',textLost:'글자 선택 불가(이미지 PDF)',images:'사진 {n}개 최적화'},
 p2i:{screen:'화면용',screenHint:'가볍게',standard:'표준',standardHint:'추천',print:'인쇄용',printHint:'가장 선명',range:'변환할 페이지',rangeHint:'비워 두면 전체. 예: 1,3-5',maxSide:'긴 변 픽셀 직접 지정',made:'{f} {n}장',images:'이미지 {n}장'}});
Object.assign(S.en,{pdfc:{light:'Light',lightHint:'best quality',balanced:'Recommended',balancedHint:'quality and size',strong:'Strong',strongHint:'smallest',raster:'Flatten pages to images for extra reduction',rasterWarn:'Text can no longer be selected or searched. Only recommended for PDFs that are already scans.',how:'Only the photos inside the PDF are recompressed; text, vectors and search stay as they are. PDFs without photos barely shrink.',kept:'Already small — original kept',textKept:'text and search kept',textLost:'text not selectable (image PDF)',images:'{n} image(s) optimised'},
 p2i:{screen:'Screen',screenHint:'lightweight',standard:'Standard',standardHint:'recommended',print:'Print',printHint:'sharpest',range:'Pages to convert',rangeHint:'Empty = all. Example: 1,3-5',maxSide:'Exact longest side in pixels',made:'{n} {f} image(s)',images:'{n} image(s)'}});
Object.assign(S.ja,{pdfc:{light:'弱め',lightHint:'画質優先',balanced:'おすすめ',balancedHint:'画質と容量のバランス',strong:'強め',strongHint:'最小',raster:'ページを画像化してさらに小さくする',rasterWarn:'文字の選択・検索ができなくなります。すでにスキャン画像のPDFにだけおすすめします。',how:'PDF内の写真だけを再圧縮し、文字・図形・検索はそのままです。写真のないPDFはほとんど小さくなりません。',kept:'すでに十分小さいため元のままです',textKept:'文字・検索を維持',textLost:'文字選択不可（画像PDF）',images:'写真{n}点を最適化'},
 p2i:{screen:'画面用',screenHint:'軽い',standard:'標準',standardHint:'おすすめ',print:'印刷用',printHint:'最も鮮明',range:'変換するページ',rangeHint:'空欄は全ページ。例: 1,3-5',maxSide:'長辺のピクセルを直接指定',made:'{f} {n}枚',images:'画像{n}枚'}});
S.ko.edit={drop:'편집할 PDF를 여기에 놓으세요',dropHint:'글자·서명·이미지 추가, 지우기, 그리기, 도형 · 원본 글자와 검색은 그대로',tools:'편집 도구',color:'색',fontSize:'글자 크기',thickness:'굵기',bold:'굵게',undo:'되돌리기 (Ctrl+Z)',redo:'다시 실행 (Ctrl+Y)',deleteObject:'선택한 것 삭제 (Delete)',
 tool:{select:'선택',text:'글자',sign:'서명',image:'이미지',whiteout:'지우기',pen:'펜',highlight:'형광펜',rect:'사각형',ellipse:'원',line:'선',arrow:'화살표'},
 hint:{select:'추가한 것을 클릭해 옮기거나 크기를 바꾸세요. 방향키로 미세 이동, Delete로 삭제.',text:'글자를 넣을 곳을 클릭하고 입력하세요.',sign:'서명을 그리거나 입력하거나 이미지로 올리세요.',image:'넣을 이미지를 고르세요.',whiteout:'가릴 부분을 드래그하면 흰색으로 덮습니다. 아래 내용이 완전히 삭제되는 것은 아닙니다.',pen:'페이지 위에 자유롭게 그리세요.',highlight:'강조할 부분을 드래그하세요.',rect:'드래그해서 사각형을 그리세요.',ellipse:'드래그해서 원을 그리세요.',line:'드래그해서 선을 그리세요.',arrow:'드래그해서 화살표를 그리세요.'},
 changes:'추가한 항목 {n}개',save:'PDF 저장 · 다운로드',saved:'저장 완료',organize:'페이지 순서·회전·삭제',close:'다른 PDF 열기',prev:'이전 쪽',next:'다음 쪽',zoomIn:'확대',zoomOut:'축소',fit:'너비 맞춤',oneFile:'한 번에 한 파일만 편집합니다. 첫 번째 파일을 열었습니다.',
 sign:{title:'서명 만들기',draw:'그리기',type:'입력',upload:'이미지',clear:'지우기',placeholder:'이름을 입력하세요',removeWhite:'흰 배경을 투명하게',reuse:'이전 서명 다시 사용',cancel:'취소',use:'서명 넣기',empty:'서명을 먼저 만들어 주세요.'}};
S.en.edit={drop:'Drop the PDF you want to edit',dropHint:'Add text, signatures and images, whiteout, draw, shapes · original text and search are kept',tools:'Editing tools',color:'Colour',fontSize:'Font size',thickness:'Thickness',bold:'Bold',undo:'Undo (Ctrl+Z)',redo:'Redo (Ctrl+Y)',deleteObject:'Delete selection (Delete)',
 tool:{select:'Select',text:'Text',sign:'Sign',image:'Image',whiteout:'Whiteout',pen:'Pen',highlight:'Highlight',rect:'Rectangle',ellipse:'Ellipse',line:'Line',arrow:'Arrow'},
 hint:{select:'Click something you added to move or resize it. Arrow keys nudge, Delete removes.',text:'Click where the text should go and type.',sign:'Draw, type or upload your signature.',image:'Choose an image to place.',whiteout:'Drag over an area to cover it in white. The content underneath is covered, not securely removed.',pen:'Draw freely on the page.',highlight:'Drag over what you want to highlight.',rect:'Drag to draw a rectangle.',ellipse:'Drag to draw an ellipse.',line:'Drag to draw a line.',arrow:'Drag to draw an arrow.'},
 changes:'{n} item(s) added',save:'Save PDF · Download',saved:'Saved',organize:'Reorder, rotate or delete pages',close:'Open another PDF',prev:'Previous page',next:'Next page',zoomIn:'Zoom in',zoomOut:'Zoom out',fit:'Fit width',oneFile:'One file is edited at a time; the first one was opened.',
 sign:{title:'Create a signature',draw:'Draw',type:'Type',upload:'Image',clear:'Clear',placeholder:'Type your name',removeWhite:'Make the white background transparent',reuse:'Reuse previous signature',cancel:'Cancel',use:'Place signature',empty:'Create a signature first.'}};
S.ja.edit={drop:'編集するPDFをここにドロップ',dropHint:'文字・署名・画像の追加、消去、描画、図形 · 元の文字と検索はそのまま',tools:'編集ツール',color:'色',fontSize:'文字サイズ',thickness:'太さ',bold:'太字',undo:'元に戻す (Ctrl+Z)',redo:'やり直す (Ctrl+Y)',deleteObject:'選択を削除 (Delete)',
 tool:{select:'選択',text:'文字',sign:'署名',image:'画像',whiteout:'消去',pen:'ペン',highlight:'マーカー',rect:'四角形',ellipse:'円',line:'線',arrow:'矢印'},
 hint:{select:'追加したものをクリックして移動・サイズ変更。矢印キーで微調整、Deleteで削除。',text:'文字を入れたい場所をクリックして入力します。',sign:'署名を描く・入力する・画像で追加できます。',image:'配置する画像を選びます。',whiteout:'隠したい部分をドラッグすると白で覆います。下の内容が完全に削除されるわけではありません。',pen:'ページの上に自由に描けます。',highlight:'強調したい部分をドラッグします。',rect:'ドラッグして四角形を描きます。',ellipse:'ドラッグして円を描きます。',line:'ドラッグして線を描きます。',arrow:'ドラッグして矢印を描きます。'},
 changes:'追加した項目 {n}件',save:'PDFを保存 · ダウンロード',saved:'保存しました',organize:'ページの並べ替え・回転・削除',close:'別のPDFを開く',prev:'前のページ',next:'次のページ',zoomIn:'拡大',zoomOut:'縮小',fit:'幅に合わせる',oneFile:'一度に編集できるのは1ファイルです。最初のファイルを開きました。',
 sign:{title:'署名を作成',draw:'描く',type:'入力',upload:'画像',clear:'消去',placeholder:'名前を入力',removeWhite:'白い背景を透明にする',reuse:'前の署名を使う',cancel:'キャンセル',use:'署名を配置',empty:'先に署名を作成してください。'}};
S.ko.atlas={drop:'스프라이트 프레임을 여기에 놓으세요',dropHint:'PNG 여러 장 · 움직이는 GIF/APNG/WebP는 프레임으로 자동 분리',sheet:'시트',animation:'애니메이션 미리보기',frames:'프레임',outlines:'경계선 표시',fps:'초당 프레임(FPS)',sortName:'이름순',reverse:'순서 뒤집기',hint:'프레임을 끌어서 순서를 바꾸면 시트와 애니메이션이 바로 바뀝니다.',frameCount:'{n}프레임',efficiency:'공간 활용 {n}%',
 layout:'배치',layouts:{packed:'자동 포장',grid:'격자',row:'가로 한 줄',column:'세로 한 줄'},padding:'프레임 간격',format:'데이터 형식',trim:'투명 여백 잘라내기(트림)',pot:'2의 거듭제곱 크기 (256, 512…)',rotate:'공간 절약을 위해 90° 회전 허용',extrude:'가장자리 늘리기(px)',maxSize:'최대 크기',columns:'격자 열 수',pixelated:'도트를 선명하게 표시',add:'+ 프레임 추가',run:'시트 PNG + {f} 다운로드',cannot:'설정을 확인하세요',done:'ZIP으로 저장했습니다 ({size})'};
S.en.atlas={drop:'Drop sprite frames here',dropHint:'Many PNGs · animated GIF/APNG/WebP are split into frames',sheet:'Sheet',animation:'Animation preview',frames:'Frames',outlines:'Show outlines',fps:'Frames per second',sortName:'Sort by name',reverse:'Reverse',hint:'Drag frames to reorder; the sheet and the animation update immediately.',frameCount:'{n} frame(s)',efficiency:'{n}% of the area used',
 layout:'Layout',layouts:{packed:'Packed',grid:'Grid',row:'One row',column:'One column'},padding:'Spacing',format:'Data format',trim:'Trim transparent margins',pot:'Power-of-two size (256, 512…)',rotate:'Allow 90° rotation to save space',extrude:'Extrude edges (px)',maxSize:'Max size',columns:'Grid columns',pixelated:'Crisp pixels in previews',add:'+ Add frames',run:'Download sheet PNG + {f}',cannot:'Check the settings',done:'Saved as ZIP ({size})'};
S.ja.atlas={drop:'ここにスプライトのフレームをドロップ',dropHint:'複数のPNG · アニメGIF/APNG/WebPは自動でフレームに分割',sheet:'シート',animation:'アニメーションプレビュー',frames:'フレーム',outlines:'枠線を表示',fps:'毎秒フレーム数(FPS)',sortName:'名前順',reverse:'順番を反転',hint:'フレームをドラッグして並べ替えると、シートとアニメーションがすぐに変わります。',frameCount:'{n}フレーム',efficiency:'領域の{n}%を使用',
 layout:'配置',layouts:{packed:'自動パック',grid:'グリッド',row:'横一列',column:'縦一列'},padding:'フレーム間隔',format:'データ形式',trim:'透明な余白をトリム',pot:'2のべき乗サイズ (256, 512…)',rotate:'省スペースのため90°回転を許可',extrude:'端を引き伸ばす(px)',maxSize:'最大サイズ',columns:'グリッドの列数',pixelated:'プレビューをくっきり表示',add:'+ フレームを追加',run:'シートPNG + {f}をダウンロード',cannot:'設定を確認してください',done:'ZIPで保存しました（{size}）'};
Object.assign(S.ko.edit,{whole:'문서 전체에 넣기',apply:'모든 페이지에 적용',removeAll:'모두 제거',numbers:{title:'페이지 번호',position:'위치',format:'형식',start:'시작 번호',from:'몇 쪽부터',pos:{'bottom-center':'아래 가운데','bottom-right':'아래 오른쪽','bottom-left':'아래 왼쪽','top-center':'위 가운데','top-right':'위 오른쪽','top-left':'위 왼쪽'}},watermark:{title:'워터마크',text:'문구',sample:'대외비',opacity:'진하기',angle:'방향'}});
Object.assign(S.en.edit,{whole:'Add to the whole document',apply:'Apply to all pages',removeAll:'Remove all',numbers:{title:'Page numbers',position:'Position',format:'Format',start:'First number',from:'Start on page',pos:{'bottom-center':'Bottom centre','bottom-right':'Bottom right','bottom-left':'Bottom left','top-center':'Top centre','top-right':'Top right','top-left':'Top left'}},watermark:{title:'Watermark',text:'Text',sample:'CONFIDENTIAL',opacity:'Strength',angle:'Direction'}});
Object.assign(S.ja.edit,{whole:'文書全体に追加',apply:'全ページに適用',removeAll:'すべて削除',numbers:{title:'ページ番号',position:'位置',format:'形式',start:'開始番号',from:'何ページ目から',pos:{'bottom-center':'下・中央','bottom-right':'下・右','bottom-left':'下・左','top-center':'上・中央','top-right':'上・右','top-left':'上・左'}},watermark:{title:'透かし',text:'文字',sample:'社外秘',opacity:'濃さ',angle:'向き'}});
const PALETTE_NAMES={gameboy:'Game Boy',pico8:'PICO-8',sweetie16:'Sweetie 16',endesga32:'Endesga 32',nes:'NES',mono:'1-bit'};
S.ko.pixel={size:'도트 크기',colors:'색상 수',palette:'팔레트',auto:'이미지에서 자동 추출',custom:'직접 입력…',customHint:'한 줄에 색 하나 (#RRGGBB) 또는 GIMP 팔레트',exact:'정확한 크기 (px)',scale:'내보내기 배율',dither:'디더링',ditherNone:'없음',outline:'외곽선',trim:'투명 여백을 먼저 잘라내기',needPalette:'팔레트 색을 한 줄에 하나씩 입력하세요.',exported:'{w}×{h}로 저장',colorCount:'{n}색',palettes:PALETTE_NAMES};
S.en.pixel={size:'Sprite size',colors:'Colours',palette:'Palette',auto:'Extract from the image',custom:'Custom…',customHint:'One colour per line (#RRGGBB) or a GIMP palette',exact:'Exact size (px)',scale:'Export scale',dither:'Dithering',ditherNone:'None',outline:'Outline',trim:'Trim transparent margins first',needPalette:'Enter palette colours, one per line.',exported:'saved at {w}×{h}',colorCount:'{n} colours',palettes:PALETTE_NAMES};
S.ja.pixel={size:'ドットのサイズ',colors:'色数',palette:'パレット',auto:'画像から自動抽出',custom:'自分で入力…',customHint:'1行に1色（#RRGGBB）またはGIMPパレット',exact:'正確なサイズ (px)',scale:'書き出し倍率',dither:'ディザリング',ditherNone:'なし',outline:'アウトライン',trim:'先に透明な余白をトリム',needPalette:'パレットの色を1行に1つ入力してください。',exported:'{w}×{h}で保存',colorCount:'{n}色',palettes:PALETTE_NAMES};
S.ko.recipe={fit:'비율이 다를 때',noOptions:'이 도구는 설정 없이 바로 결과를 만듭니다.',files:'파일 {n}개',zipNote:'ZIP 안에 파일 {n}개'};
S.en.recipe={fit:'When the shape differs',noOptions:'This tool needs no settings.',files:'{n} files',zipNote:'{n} files inside the ZIP'};
S.ja.recipe={fit:'比率が違うとき',noOptions:'このツールは設定なしで結果を作ります。',files:'{n}個のファイル',zipNote:'ZIP内に{n}個のファイル'};
S.ko.bg={quality:'AI 품질',qualityBest:'고품질 (처음 한 번 190MB 받음)',qualityFast:'빠르게 (5MB 경량 모델)',noteQuick:'빠른 미리보기 · 고품질 결과로 곧 바뀝니다',bestFailed:'고품질 모델을 받지 못해 빠른 결과를 유지했습니다.',method:'지우는 방식',ai:'자동 (AI)',solid:'단색 배경',newBackground:'새 배경',none:'투명',white:'흰색',black:'검정',custom:'색 선택',blur:'원본 흐리게',color:'색',refine:'머리카락·경계를 원본 색에 맞춰 다듬기',cleanup:'경계에 남은 배경색 빼기',key:'지울 색',keyAuto:'가장자리에서 자동 감지',keyCustom:'직접 고르기',tolerance:'비슷한 색 허용 범위',trim:'피사체에 맞춰 여백 자르기',padding:'여백 (px)',format:'저장 형식',jpegHint:'JPG는 투명을 저장할 수 없어 흰 배경으로 채웁니다.',done:'배경 제거 완료',doneMany:'{n}장 배경 제거 완료',noteAi:'AI 피사체 인식',noteColor:'단색 배경 제거',noteEdited:'직접 다듬음',touchUp:'지우기·복원 브러시',erase:'지우기',restore:'복원',brush:'브러시 크기',undo:'되돌리기',reset:'처음으로',cancel:'취소',apply:'적용',brushHint:'흐리게 보이는 부분이 지워진 원본입니다. 복원으로 칠하면 되살아납니다. 확대하면 더 가는 붓으로 칠할 수 있습니다.',stage:{model:'AI 모델 받는 중 (처음 한 번)',prepare:'준비 중',find:'피사체 찾는 중',edges:'경계 다듬는 중'}};
S.en.bg={quality:'AI quality',qualityBest:'Best (one-time 190 MB download)',qualityFast:'Fast (5 MB light model)',noteQuick:'Quick preview · the high-quality result replaces it shortly',bestFailed:'The high-quality model could not be downloaded, so the quick result was kept.',method:'How to remove',ai:'Automatic (AI)',solid:'Solid backdrop',newBackground:'New background',none:'Transparent',white:'White',black:'Black',custom:'Pick a colour',blur:'Blur the original',color:'Colour',refine:'Follow hair and edges using the original colours',cleanup:'Remove backdrop colour left on edges',key:'Colour to remove',keyAuto:'Detect from the border',keyCustom:'Choose',tolerance:'Similar-colour range',trim:'Crop to the subject',padding:'Padding (px)',format:'Save as',jpegHint:'JPG cannot store transparency, so the background is filled white.',done:'Background removed',doneMany:'{n} backgrounds removed',noteAi:'AI subject detection',noteColor:'Solid backdrop removal',noteEdited:'touched up by hand',touchUp:'Erase / restore brush',erase:'Erase',restore:'Restore',brush:'Brush size',undo:'Undo',reset:'Start over',cancel:'Cancel',apply:'Apply',brushHint:'The faint area is the removed original; paint with Restore to bring it back. Zoom in for a finer brush.',stage:{model:'Getting the AI model (first time only)',prepare:'Preparing',find:'Finding the subject',edges:'Refining edges'}};
S.ja.bg={quality:'AIの品質',qualityBest:'高品質 (初回のみ190MBを取得)',qualityFast:'高速 (5MBの軽量モデル)',noteQuick:'クイックプレビュー · まもなく高品質の結果に置き換わります',bestFailed:'高品質モデルを取得できなかったため、クイック結果のままです。',method:'消し方',ai:'自動 (AI)',solid:'単色の背景',newBackground:'新しい背景',none:'透明',white:'白',black:'黒',custom:'色を選ぶ',blur:'元の背景をぼかす',color:'色',refine:'髪や輪郭を元の色に合わせて整える',cleanup:'輪郭に残った背景色を取り除く',key:'消す色',keyAuto:'ふちから自動検出',keyCustom:'自分で選ぶ',tolerance:'近い色の許容範囲',trim:'被写体に合わせて余白を切る',padding:'余白 (px)',format:'保存形式',jpegHint:'JPGは透明を保存できないため、白い背景で埋めます。',done:'背景を削除しました',doneMany:'{n}枚の背景を削除しました',noteAi:'AI被写体認識',noteColor:'単色背景の削除',noteEdited:'手作業で調整',touchUp:'消しゴム・復元ブラシ',erase:'消す',restore:'復元',brush:'ブラシサイズ',undo:'元に戻す',reset:'最初から',cancel:'キャンセル',apply:'適用',brushHint:'薄く見える部分が消された元画像です。復元で塗ると戻ります。拡大すると細いブラシで塗れます。',stage:{model:'AIモデルを取得中 (初回のみ)',prepare:'準備中',find:'被写体を検出中',edges:'輪郭を調整中'}};
S.ko.upscale={size:'얼마나 크게',method:'확대 방식',ai:'AI 선명하게',aiHint:'사진·일러스트',smooth:'부드럽게',smoothHint:'가장 빠름',pixel:'도트 그대로',pixelHint:'픽셀아트',tooLarge:'400만 화소가 넘는 이미지는 AI 대신 부드러운 확대로 처리했습니다.',noModel:'AI 모델을 받지 못해 부드러운 확대로 처리했습니다.',stage:{model:'AI 모델 준비 중 (5MB)',tiles:'선명하게 만드는 중 {a}/{b}',prepare:'확대 중'}};
S.en.upscale={size:'How much bigger',method:'Method',ai:'AI sharpen',aiHint:'photos · art',smooth:'Smooth',smoothHint:'fastest',pixel:'Keep pixels',pixelHint:'pixel art',tooLarge:'Images over 4 megapixels are enlarged with the smooth method instead of AI.',noModel:'The AI model could not be loaded, so the smooth method was used.',stage:{model:'Preparing the AI model (5 MB)',tiles:'Sharpening {a}/{b}',prepare:'Enlarging'}};
S.ja.upscale={size:'どれくらい大きく',method:'拡大方法',ai:'AIでくっきり',aiHint:'写真・イラスト',smooth:'なめらか',smoothHint:'最速',pixel:'ドットのまま',pixelHint:'ドット絵',tooLarge:'400万画素を超える画像はAIではなく、なめらかな拡大で処理しました。',noModel:'AIモデルを取得できなかったため、なめらかな拡大で処理しました。',stage:{model:'AIモデルを準備中 (5MB)',tiles:'くっきり処理中 {a}/{b}',prepare:'拡大中'}};
const TILE_KINDS={minimal9:'3×3 minimal · 9',edge16:'Edge Wang · 16',corner16:'Corner Wang · 16',blob47:'Blob · 47'};
S.ko.tile={drop:'타일셋 이미지를 여기에 놓으세요',dropHint:'격자 타일 시트 · 타일 크기를 추정해 순위로 보여줍니다',importLayout:'layout JSON 불러오기',sample:'샘플 타일셋',
 stage:{grid:'격자·분리',templates:'템플릿',tester:'오토타일 시험',rules:'규칙 점검',seams:'이음새',export:'Godot'},
 detect:'추정한 격자',detectNote:'이미지에서 실제로 측정한 값입니다. 아래에서 직접 지정할 수도 있습니다.',apply:'이 격자 사용',
 evidence:{separators:'구분선',repeatedEdges:'반복 주기',boundaryEdges:'경계 대비',contentStops:'내용 끊김'},
 manual:'직접 지정',tileWidth:'타일 너비',tileHeight:'타일 높이',marginX:'바깥 여백 X',marginY:'바깥 여백 Y',spacingX:'간격 X',spacingY:'간격 Y',
 gridInfo:'{c} × {r} 타일 · {w}×{h}px',tiles:'타일 {n}개',blankCount:'빈 타일 {n}개',lines:'격자선 표시',zoom:'배율',
 tooBig:'400만 픽셀을 넘는 시트는 자동 추정을 건너뜁니다. 타일 크기를 직접 지정하세요.',
 skipBlank:'완전히 투명한 타일 건너뛰기',dedupe:'중복 타일',dedupeNone:'모두 저장',dedupeExact:'완전히 같은 타일 하나만',dedupeNear:'거의 같은 타일까지 하나만',
 nearNote:'“거의 같음”은 픽셀 차이 임계값입니다. 사람이 보는 유사도가 아닙니다.',nearMean:'평균 픽셀 차이 허용치',
 duplicates:'완전히 같은 묶음 {n}개',near:'거의 같은 묶음 {n}개',
 variants:'회전·반전 변형도 만들기',variantsNote:'90°·180°·270°·좌우·상하. 대칭이라 같아지는 변형은 저장하지 않습니다.',
 extrude:'가장자리 늘린 아틀라스도 함께 (px)',extrudeNote:'타일 사이 번짐(bleeding)을 막는 padded-atlas.png를 추가합니다.',
 run:'타일 ZIP 다운로드',done:'ZIP으로 저장했습니다 ({size})',
 kind:'오토타일 방식',kinds:TILE_KINDS,
 kindNote:{minimal9:'네 변만 봅니다. 한 칸 폭 길이나 외딴 타일은 표현할 수 없습니다(수학적으로 7가지 경우가 빠집니다).',edge16:'네 변의 모든 조합. 빠짐 없이 16장.',corner16:'네 꼭짓점 조합 16장. 타일 격자가 지형 격자보다 반 칸 밀립니다(듀얼 그리드).',blob47:'여덟 방향. 변이 없으면 그 모서리는 보이지 않으므로 256가지가 정확히 47가지가 됩니다.'},
 count:'{n}장',templateSize:'템플릿 타일 크기(px)',runTemplate:'템플릿 PNG + JSON 다운로드',templateNote:'화가가 위에 덧그리는 안내용 이미지입니다. 각 칸의 번호·마스크는 layout JSON과 일치합니다.',
 paint:'칠하기',erase:'지우기',fillAll:'전체 채우기',clear:'비우기',randomFill:'무작위 채우기',seed:'시드',outside:'바깥도 지형으로 보기',gridLines:'격자선',gridSize:'지형 격자 크기',mapZoom:'배율',
 testerNote:'마우스·손가락으로 칠하면 규칙이 고른 타일로 즉시 그립니다.',keyboardNote:'키보드: 방향키로 이동, Space로 칠하기·지우기, F로 전체 채우기.',
 source:'타일 그림',sourceSheet:'올린 시트',sourceTemplate:'템플릿 안내 그림',missingHere:'규칙에 맞는 타일이 없는 칸 {n}개',
 assignFrom:'시트의 첫 타일이 맡는 칸',offset:'시작 번호',missing:'빠진 칸 {n}개',complete:'빠진 칸 없음',identical:'픽셀이 같은 칸 {n}쌍',
 ghost:'빠진 칸',preview:'무작위 지도 미리보기',previewNote:'지도 생성기가 아닙니다. 빠진 칸과 어색한 전환을 드러내려고 작은 지도를 그립니다.',
 unrepresentable:'이 방식으로 표현할 수 없는 조합 {n}가지',roleLabel:'역할',
 roles:{isolated:'외딴',end:'끝',corner:'모서리',corridor:'통로',tee:'T자','inner-corner':'안쪽 모서리',full:'가득',empty:'빈칸',diagonal:'대각',edge:'변'},
 seamIndex:'검사할 타일 번호',repeat:'반복 미리보기',diffH:'좌↔우 차이',diffV:'상↔하 차이',neighbour:'보통 이웃 줄',ratio:'{n}배',
 seamlessYes:'이어붙여도 이음새가 보이지 않습니다',seamlessNo:'이음새가 보입니다',
 healed:'이음새 없앤 결과 보기',healNote:'그림을 실제로 바꿉니다(반 칸 이동 + 경계 혼합). 원본과 비교한 뒤 저장하세요.',healSave:'이음새 없앤 타일 저장',blend:'혼합 폭',
 matchIndex:'맞춰볼 타일 번호',sides:{right:'오른쪽',left:'왼쪽',top:'위',bottom:'아래'},fits:'잘 맞습니다',notFit:'맞지 않습니다',
 terrainName:'지형 이름',mode:'맞춤 방식',modes:{'match_corners_and_sides':'변과 꼭짓점 모두',match_corners:'꼭짓점만',match_sides:'변만'},
 runGodot:'Godot 4 묶음 다운로드',godotNote:'PNG + 참조 JSON + TileSet를 만드는 GDScript EditorScript + 설치 안내가 들어 있습니다. 가짜 .tres는 만들지 않습니다.',
 excerpt:'{total}자 중 앞 {n}자',shortPack:'이 시트는 {total}칸 중 {n}칸에 해당하는 타일이 없습니다. 그 칸은 내보내는 TileSet에서도 비어 있습니다.',needGrid:'먼저 격자를 정하세요.',needTile:'타일을 먼저 고르세요.'};
S.en.tile={drop:'Drop a tileset image here',dropHint:'A grid tile sheet · the tile size is measured and ranked, never forced',importLayout:'Load a layout JSON',sample:'Sample tileset',
 stage:{grid:'Grid & slice',templates:'Templates',tester:'Autotile tester',rules:'Rule check',seams:'Seams',export:'Godot'},
 detect:'Suggested grids',detectNote:'Measured from this image. You can also set the grid by hand below.',apply:'Use this grid',
 evidence:{separators:'separators',repeatedEdges:'repeat',boundaryEdges:'boundary',contentStops:'content stops'},
 manual:'Set the grid by hand',tileWidth:'Tile width',tileHeight:'Tile height',marginX:'Outer margin X',marginY:'Outer margin Y',spacingX:'Spacing X',spacingY:'Spacing Y',
 gridInfo:'{c} × {r} tiles of {w}×{h}px',tiles:'{n} tiles',blankCount:'{n} blank',lines:'Show grid',zoom:'Zoom',
 tooBig:'Sheets over 4 megapixels skip automatic detection. Enter the tile size by hand.',
 skipBlank:'Skip fully transparent tiles',dedupe:'Duplicate tiles',dedupeNone:'Keep every tile',dedupeExact:'Keep one of each identical tile',dedupeNear:'Keep one of each near-identical tile',
 nearNote:'"Near-identical" is a pixel-difference threshold, not a judgement of how similar they look.',nearMean:'Allowed mean pixel difference',
 duplicates:'{n} identical group(s)',near:'{n} near-identical group(s)',
 variants:'Also generate rotated and flipped variants',variantsNote:'90° / 180° / 270° / flip X / flip Y. Variants a symmetric tile turns into itself are not written.',
 extrude:'Also write an edge-extruded atlas (px)',extrudeNote:'Adds padded-atlas.png, which stops neighbouring tiles bleeding into each other.',
 run:'Download tiles ZIP',done:'Saved as ZIP ({size})',
 kind:'Autotile kind',kinds:TILE_KINDS,
 kindNote:{minimal9:'Matches the 4 sides only. It cannot draw a one-tile-wide strip or a lone tile: 7 of the 16 cases have no tile, by construction.',edge16:'Every combination of the 4 sides. Complete at 16 tiles.',corner16:'Every combination of the 4 corners. The tile grid sits half a tile off the terrain grid (a dual grid).',blob47:'All 8 neighbours, but a corner only counts behind both of its edges — which turns 256 cases into exactly 47.'},
 count:'{n} tiles',templateSize:'Template tile size (px)',runTemplate:'Download template PNG + JSON',templateNote:'Guide art to paint over. Each cell’s number and mask match the layout JSON exactly.',
 paint:'Paint',erase:'Erase',fillAll:'Fill all',clear:'Clear',randomFill:'Random fill',seed:'Seed',outside:'Treat outside as terrain',gridLines:'Grid lines',gridSize:'Terrain grid size',mapZoom:'Zoom',
 testerNote:'Paint with the mouse or a finger; the map redraws with the tile each rule picks.',keyboardNote:'Keyboard: arrow keys move, Space paints or erases, F fills everything.',
 source:'Tile art',sourceSheet:'the sheet you added',sourceTemplate:'template guide art',missingHere:'{n} cell(s) have no tile for their rule',
 assignFrom:'Slot the first tile of the sheet fills',offset:'Start at slot',missing:'{n} missing',complete:'Nothing missing',identical:'{n} pair(s) of pixel-identical slots',
 ghost:'Missing slot',preview:'Random map preview',previewNote:'Not a map generator. It draws small seeded maps to surface missing slots and ugly transitions.',
 unrepresentable:'{n} combination(s) this kind cannot represent',roleLabel:'Role',
 roles:{isolated:'isolated',end:'end',corner:'corner',corridor:'corridor',tee:'tee','inner-corner':'inner corner',full:'full',empty:'empty',diagonal:'diagonal',edge:'edge'},
 seamIndex:'Tile number to check',repeat:'Repeat preview',diffH:'left ↔ right difference',diffV:'top ↔ bottom difference',neighbour:'ordinary neighbour lines',ratio:'{n}×',
 seamlessYes:'This tile repeats without a visible seam',seamlessNo:'The repeat shows a seam',
 healed:'Show the seamless version',healNote:'This really does alter the art (half-tile offset + cross-blend). Compare with the original before saving.',healSave:'Save the seamless tile',blend:'Blend width',
 matchIndex:'Match against tile number',sides:{right:'right',left:'left',top:'top',bottom:'bottom'},fits:'fits',notFit:'does not fit',
 terrainName:'Terrain name',mode:'Matching mode',modes:{'match_corners_and_sides':'Match Corners and Sides',match_corners:'Match Corners',match_sides:'Match Sides'},
 runGodot:'Download the Godot 4 pack',godotNote:'PNG + reference JSON + a GDScript EditorScript that builds the TileSet + setup notes. No fake .tres file is written.',
 excerpt:'first {n} of {total} characters',shortPack:'This sheet has no tile for {n} of the {total} slots. Those slots will be empty in the exported TileSet too.',needGrid:'Choose a grid first.',needTile:'Choose a tile first.'};
S.ja.tile={drop:'タイルセット画像をここにドロップ',dropHint:'格子タイルシート · タイルサイズを実測して候補を順位付けします',importLayout:'layout JSONを読み込む',sample:'サンプルタイルセット',
 stage:{grid:'格子・分割',templates:'テンプレート',tester:'オートタイル検証',rules:'ルール点検',seams:'継ぎ目',export:'Godot'},
 detect:'推定した格子',detectNote:'この画像から実測した値です。下で手入力もできます。',apply:'この格子を使う',
 evidence:{separators:'区切り線',repeatedEdges:'反復周期',boundaryEdges:'境界の差',contentStops:'内容の途切れ'},
 manual:'手入力で指定',tileWidth:'タイル幅',tileHeight:'タイル高',marginX:'外側余白 X',marginY:'外側余白 Y',spacingX:'間隔 X',spacingY:'間隔 Y',
 gridInfo:'{c} × {r} タイル · {w}×{h}px',tiles:'タイル{n}枚',blankCount:'空タイル{n}枚',lines:'格子線を表示',zoom:'倍率',
 tooBig:'400万画素を超えるシートは自動推定を省略します。タイルサイズを手入力してください。',
 skipBlank:'完全に透明なタイルを除く',dedupe:'重複タイル',dedupeNone:'すべて保存',dedupeExact:'完全に同じタイルは1枚だけ',dedupeNear:'ほぼ同じタイルも1枚だけ',
 nearNote:'「ほぼ同じ」はピクセル差のしきい値です。見た目の類似度の判断ではありません。',nearMean:'許容する平均ピクセル差',
 duplicates:'完全一致 {n}組',near:'ほぼ一致 {n}組',
 variants:'回転・反転のバリエーションも作る',variantsNote:'90°・180°・270°・左右・上下。対称で同じになるものは保存しません。',
 extrude:'端を引き伸ばしたアトラスも出力 (px)',extrudeNote:'隣のタイルがにじむのを防ぐ padded-atlas.png を追加します。',
 run:'タイルZIPをダウンロード',done:'ZIPで保存しました（{size}）',
 kind:'オートタイル方式',kinds:TILE_KINDS,
 kindNote:{minimal9:'4辺のみを見ます。幅1マスの帯や孤立したタイルは表現できません（構造上7通りが欠けます）。',edge16:'4辺のすべての組み合わせ。16枚で完全です。',corner16:'4隅のすべての組み合わせ16枚。タイル格子が地形格子から半マスずれます（デュアルグリッド）。',blob47:'8方向。辺がなければその角は見えないため、256通りが正確に47通りになります。'},
 count:'{n}枚',templateSize:'テンプレートのタイルサイズ (px)',runTemplate:'テンプレートPNG + JSONをダウンロード',templateNote:'絵師が上から描くための下絵です。各セルの番号とマスクはlayout JSONと一致します。',
 paint:'描く',erase:'消す',fillAll:'全部塗る',clear:'消去',randomFill:'ランダムに塗る',seed:'シード',outside:'外側も地形として扱う',gridLines:'格子線',gridSize:'地形グリッドの大きさ',mapZoom:'倍率',
 testerNote:'マウスや指で塗ると、ルールが選んだタイルで即座に描き直します。',keyboardNote:'キーボード: 矢印キーで移動、Spaceで塗る・消す、Fで全部塗る。',
 source:'タイルの絵',sourceSheet:'追加したシート',sourceTemplate:'テンプレートの下絵',missingHere:'ルールに合うタイルがないセル{n}個',
 assignFrom:'シート最初のタイルが担う枠',offset:'開始番号',missing:'不足{n}枠',complete:'不足なし',identical:'ピクセルが同一の枠{n}組',
 ghost:'不足している枠',preview:'ランダムマップのプレビュー',previewNote:'マップ生成機能ではありません。不足した枠や不自然な遷移を見つけるために小さな地図を描きます。',
 unrepresentable:'この方式で表現できない組み合わせ{n}通り',roleLabel:'役割',
 roles:{isolated:'孤立',end:'端',corner:'角',corridor:'通路',tee:'T字','inner-corner':'内角',full:'全周',empty:'空',diagonal:'対角',edge:'辺'},
 seamIndex:'検査するタイル番号',repeat:'繰り返しプレビュー',diffH:'左↔右の差',diffV:'上↔下の差',neighbour:'通常の隣接行',ratio:'{n}倍',
 seamlessYes:'繰り返しても継ぎ目は見えません',seamlessNo:'継ぎ目が見えます',
 healed:'継ぎ目をなくした結果を表示',healNote:'絵を実際に変更します（半タイル移動＋境界のブレンド）。元と比べてから保存してください。',healSave:'継ぎ目のないタイルを保存',blend:'ブレンド幅',
 matchIndex:'合わせるタイル番号',sides:{right:'右',left:'左',top:'上',bottom:'下'},fits:'よく合います',notFit:'合いません',
 terrainName:'地形名',mode:'マッチ方式',modes:{'match_corners_and_sides':'辺と角の両方',match_corners:'角のみ',match_sides:'辺のみ'},
 runGodot:'Godot 4パックをダウンロード',godotNote:'PNG + 参照JSON + TileSetを構築するGDScript EditorScript + 手順が入っています。偽の.tresは作りません。',
 excerpt:'全{total}文字のうち先頭{n}文字',shortPack:'このシートは{total}枠のうち{n}枠に対応するタイルがありません。書き出すTileSetでもその枠は空になります。',needGrid:'先に格子を決めてください。',needTile:'先にタイルを選んでください。'};
export function ui(locale,key,vars={}){
 let v=key.split('.').reduce((o,k)=>o?.[k],S[locale]||S.en)??key.split('.').reduce((o,k)=>o?.[k],S.en)??key;
 return String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
export const UI_LOCALES=Object.keys(S);
export const UI_STRINGS=S;
