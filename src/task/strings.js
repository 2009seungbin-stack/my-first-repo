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
S.ko.crop={drop:'자를 이미지를 여기에 놓으세요',dropHint:'여러 장 가능 · 드래그로 영역 선택, 비율·SNS 규격 지원',ratio:'비율',free:'자유',orig:'원본 비율',preset:'SNS·플랫폼 규격',presetNone:'— 직접 지정',
 rotateLeft:'왼쪽으로 90° 회전',rotateRight:'오른쪽으로 90° 회전',flipH:'좌우 반전',flipV:'상하 반전',autoTrim:'여백 자동 감지',trimNone:'잘라낼 여백을 찾지 못했습니다.',reset:'처음으로',undo:'되돌리기 (Ctrl+Z)',redo:'다시 실행 (Ctrl+Y)',
 applyAll:'이 영역을 모든 파일에 적용',appliedAll:'파일 {n}개에 같은 영역을 적용했습니다',area:'자를 영역 (px)',width:'너비',height:'높이',straighten:'수평 맞추기',straightenHint:'기울인 만큼 자동으로 확대해 빈 모서리가 생기지 않습니다.',
 shape:'모양',rect:'사각형',circle:'원형',round:'둥근 모서리',radius:'모서리 둥글기',outSize:'출력 크기',keepPixels:'자른 픽셀 그대로',exactSize:'정확한 크기로 맞추기',keep:'원본 형식 유지',quality:'JPG 화질',
 hint:'이미지 위에서 끌어 영역을 정하고 모서리를 잡아 크기를 바꾸세요. 방향키로 1px, Shift+방향키로 10px 이동, Alt+방향키로 크기 변경.',source:'원본 {w}×{h}',scaledTo:'{a} → {b}로 조정',alphaFormat:'투명한 모양은 JPG로 저장할 수 없어 PNG로 저장합니다.',working:'자르는 중…'};
S.en.crop={drop:'Drop the image you want to crop',dropHint:'Several images at once · drag to frame, aspect ratios and social sizes included',ratio:'Aspect ratio',free:'Free',orig:'Original',preset:'Social & platform sizes',presetNone:'— custom',
 rotateLeft:'Rotate 90° left',rotateRight:'Rotate 90° right',flipH:'Flip horizontally',flipV:'Flip vertically',autoTrim:'Auto-trim',trimNone:'No border to trim was found.',reset:'Reset',undo:'Undo (Ctrl+Z)',redo:'Redo (Ctrl+Y)',
 applyAll:'Apply this crop to all',appliedAll:'Same crop applied to {n} files',area:'Crop area (px)',width:'Width',height:'Height',straighten:'Straighten',straightenHint:'Zooms in as it tilts, so no empty corners appear.',
 shape:'Shape',rect:'Rectangle',circle:'Circle',round:'Rounded corners',radius:'Corner rounding',outSize:'Output size',keepPixels:'Keep the cropped pixels',exactSize:'Scale to an exact size',keep:'Keep original format',quality:'JPG quality',
 hint:'Drag on the image to frame it and pull a corner to resize. Arrow keys nudge 1px, Shift+arrows 10px, Alt+arrows resize.',source:'from {w}×{h}',scaledTo:'{a} → {b}',alphaFormat:'A transparent shape cannot be saved as JPG, so PNG is used.',working:'Cropping…'};
S.ja.crop={drop:'切り抜く画像をここにドロップ',dropHint:'複数枚まとめて · ドラッグで範囲指定、比率・SNS規格に対応',ratio:'縦横比',free:'自由',orig:'元の比率',preset:'SNS・各サービスの規格',presetNone:'— 自分で指定',
 rotateLeft:'左に90°回転',rotateRight:'右に90°回転',flipH:'左右反転',flipV:'上下反転',autoTrim:'余白を自動検出',trimNone:'切り取れる余白が見つかりませんでした。',reset:'最初から',undo:'元に戻す (Ctrl+Z)',redo:'やり直す (Ctrl+Y)',
 applyAll:'この範囲をすべてのファイルに適用',appliedAll:'{n}個のファイルに同じ範囲を適用しました',area:'切り抜く範囲 (px)',width:'幅',height:'高さ',straighten:'水平を調整',straightenHint:'傾けた分だけ自動で拡大し、隅に余白ができません。',
 shape:'形',rect:'長方形',circle:'円',round:'角丸',radius:'角の丸み',outSize:'出力サイズ',keepPixels:'切り抜いたピクセルのまま',exactSize:'正確なサイズに合わせる',keep:'元の形式のまま',quality:'JPGの画質',
 hint:'画像上をドラッグして範囲を決め、角をつかんでサイズを変えます。矢印キーで1px、Shift+矢印で10px移動、Alt+矢印でサイズ変更。',source:'元 {w}×{h}',scaledTo:'{a} → {b}',alphaFormat:'透明な形はJPGで保存できないためPNGで保存します。',working:'切り抜き中…'};
S.ko.media={drop:'영상 또는 오디오 파일을 놓으세요',dropHint:'MP4 · MOV · WebM · MKV · MP3 · WAV · 기기 안에서만 처리',
 job:{gif:'GIF',audio:'오디오',compress:'용량 줄이기',trim:'구간 자르기',frame:'장면 저장'},jobLabel:'무엇을 만들까요',
 run:{gif:'GIF 만들기',audio:'{f} 추출',compress:'압축하기',trim:'구간 저장',frame:'이 장면 저장'},working:'처리 중…',cancel:'중단',again:'다시 저장',
 section:'구간',sectionHint:'양쪽 손잡이를 끌어 필요한 구간만 고르세요. 재생 막대를 눌러 이동합니다.',start:'시작 · 초',end:'끝 · 초',setIn:'여기를 시작으로',setOut:'여기를 끝으로',whole:'전체',
 play:'재생',pause:'일시정지',prev:'이전 프레임',next:'다음 프레임',seek:'재생 위치',inHandle:'구간 시작',outHandle:'구간 끝',
 width:'너비',fps:'초당 프레임',speed:'속도',loop:'무한 반복',reverse:'거꾸로',crop:'비율로 자르기',cropNone:'원본 비율',colors:'색상 수',dither:'디더링',ditherNone:'없음',original:'원본',
 target:'목표 용량 (MB)',targetHint:'0이면 설정한 화질 그대로 저장합니다. 값을 넣으면 실제 크기를 재면서 목표 아래로 맞춥니다.',
 estimate:'예상 {size}',estimateHint:'실제 프레임 3장을 인코딩해 계산한 추정치입니다.',estimating:'예상 용량 계산 중…',
 format:'저장 형식',bitrate:'음질 (kbps)',fadeIn:'페이드 인 (초)',fadeOut:'페이드 아웃 (초)',normalize:'볼륨 자동 맞추기',rate:'샘플레이트',
 qualityLabel:'화질',modeLabel:'자르기 방식',quality:{small:'작게',balanced:'균형',high:'고화질'},qualityHint:{small:'공유용',balanced:'추천',high:'보관용'},cap:'해상도 상한',mute:'소리 없이',
 mode:{precise:'정밀 · 재인코딩',fast:'빠르게 · 키프레임'},modeHint:'빠르게는 다시 인코딩하지 않아 매우 빠르지만, 구간이 키프레임까지 살짝 줄어듭니다.',
 result:'결과',source:'원본',sizeLine:'{a} → {b}',savedPct:'−{n}%',grew:'+{n}%',frames:'{n}프레임',pass:'{n}회 측정',
 targetMet:'목표 {n}MB 이하로 맞췄습니다.',targetMissed:'이 브라우저 인코더로는 {n}MB까지 줄이지 못했습니다. 실제 결과는 {size}입니다.',shrunk:'목표에 맞추려고 {w}px로 줄였습니다.',
 noVideo:'이 파일에는 영상 트랙이 없습니다. 오디오 추출만 가능합니다.',noAudio:'이 파일에는 오디오 트랙이 없습니다.',audioOnly:'오디오 파일',
 compatGif:'이 브라우저에는 WebCodecs가 없어 호환 모드로 만듭니다 · 최대 480px · 20초 · 8fps.',
 compatAudio:'이 브라우저에는 WebCodecs가 없어 호환 모드로 추출합니다 · 원본 20분 이하.',
 compatVideo:'이 브라우저에는 WebCodecs가 없어 실시간 녹화(WebM)로 저장합니다 · 탭을 열어 두세요 · 최대 10분.',
 cannotEncode:'이 브라우저는 영상 인코딩을 지원하지 않습니다. Chrome·Edge·Firefox 최신 버전에서 열어 주세요.',
 engine:'{name}',report:'{w}×{h} · {codec} · {bitrate}',opened:'{name} · {duration}초 · {size}'};
S.en.media={drop:'Drop a video or audio file',dropHint:'MP4 · MOV · WebM · MKV · MP3 · WAV · processed on your device',
 job:{gif:'GIF',audio:'Audio',compress:'Compress',trim:'Trim',frame:'Frame'},jobLabel:'What do you want to make',
 run:{gif:'Make GIF',audio:'Extract {f}',compress:'Compress',trim:'Save the cut',frame:'Save this frame'},working:'Working…',cancel:'Stop',again:'Save again',
 section:'Section',sectionHint:'Drag the two handles to keep just the part you need. Click the bar to move the playhead.',start:'Start · s',end:'End · s',setIn:'Start here',setOut:'End here',whole:'Whole file',
 play:'Play',pause:'Pause',prev:'Previous frame',next:'Next frame',seek:'Playhead',inHandle:'Section start',outHandle:'Section end',
 width:'Width',fps:'Frames per second',speed:'Speed',loop:'Loop forever',reverse:'Reverse',crop:'Crop to ratio',cropNone:'Original ratio',colors:'Colours',dither:'Dithering',ditherNone:'None',original:'Original',
 target:'Fit under (MB)',targetHint:'0 keeps the quality you chose. With a value, the result is measured and re-encoded until it fits.',
 estimate:'≈ {size}',estimateHint:'Estimated by encoding three real frames.',estimating:'Estimating size…',
 format:'Save as',bitrate:'Audio quality (kbps)',fadeIn:'Fade in (s)',fadeOut:'Fade out (s)',normalize:'Normalise volume',rate:'Sample rate',
 qualityLabel:'Quality',modeLabel:'How to cut',quality:{small:'Small',balanced:'Balanced',high:'High'},qualityHint:{small:'for sharing',balanced:'recommended',high:'to keep'},cap:'Resolution cap',mute:'Remove sound',
 mode:{precise:'Precise · re-encode',fast:'Fast · keyframes'},modeHint:'Fast does not re-encode, so it is nearly instant but the section shrinks to the nearest keyframes.',
 result:'Result',source:'Original',sizeLine:'{a} → {b}',savedPct:'−{n}%',grew:'+{n}%',frames:'{n} frames',pass:'{n} measured passes',
 targetMet:'Fitted under {n} MB.',targetMissed:'This browser’s encoder could not reach {n} MB. The real result is {size}.',shrunk:'Reduced to {w} px wide to reach the target.',
 noVideo:'This file has no video track, so only audio extraction is possible.',noAudio:'This file has no audio track.',audioOnly:'Audio file',
 compatGif:'This browser has no WebCodecs, so the GIF is built in compatibility mode · up to 480 px · 20 s · 8 fps.',
 compatAudio:'This browser has no WebCodecs, so audio is extracted in compatibility mode · sources up to 20 minutes.',
 compatVideo:'This browser has no WebCodecs, so the cut is recorded in real time as WebM · keep this tab open · up to 10 minutes.',
 cannotEncode:'This browser cannot encode video. Open this page in an up-to-date Chrome, Edge or Firefox.',
 engine:'{name}',report:'{w}×{h} · {codec} · {bitrate}',opened:'{name} · {duration}s · {size}'};
S.ja.media={drop:'動画または音声ファイルをドロップ',dropHint:'MP4 · MOV · WebM · MKV · MP3 · WAV · 端末内で処理',
 job:{gif:'GIF',audio:'音声',compress:'容量を小さく',trim:'区間を切り出す',frame:'コマ保存'},jobLabel:'何を作りますか',
 run:{gif:'GIFを作る',audio:'{f}を抽出',compress:'圧縮する',trim:'区間を保存',frame:'このコマを保存'},working:'処理中…',cancel:'中止',again:'もう一度保存',
 section:'区間',sectionHint:'2つのハンドルをドラッグして必要な区間だけを選びます。バーをクリックすると再生位置が移動します。',start:'開始 · 秒',end:'終了 · 秒',setIn:'ここを開始に',setOut:'ここを終了に',whole:'全体',
 play:'再生',pause:'一時停止',prev:'前のコマ',next:'次のコマ',seek:'再生位置',inHandle:'区間の開始',outHandle:'区間の終了',
 width:'幅',fps:'フレームレート',speed:'速度',loop:'ループ再生',reverse:'逆再生',crop:'比率で切り抜く',cropNone:'元の比率',colors:'色数',dither:'ディザリング',ditherNone:'なし',original:'元のまま',
 target:'目標容量 (MB)',targetHint:'0なら選んだ画質のまま保存します。値を入れると実際の容量を測りながら目標以下に収めます。',
 estimate:'約 {size}',estimateHint:'実際のフレーム3枚をエンコードして計算した推定値です。',estimating:'容量を推定中…',
 format:'保存形式',bitrate:'音質 (kbps)',fadeIn:'フェードイン (秒)',fadeOut:'フェードアウト (秒)',normalize:'音量を自動調整',rate:'サンプルレート',
 qualityLabel:'画質',modeLabel:'切り出し方法',quality:{small:'小さめ',balanced:'バランス',high:'高画質'},qualityHint:{small:'共有向け',balanced:'推奨',high:'保存向け'},cap:'解像度の上限',mute:'音声なし',
 mode:{precise:'精密 · 再エンコード',fast:'高速 · キーフレーム'},modeHint:'高速は再エンコードしないため非常に速いですが、区間が近いキーフレームまで少し縮みます。',
 result:'結果',source:'元のファイル',sizeLine:'{a} → {b}',savedPct:'−{n}%',grew:'+{n}%',frames:'{n}フレーム',pass:'{n}回測定',
 targetMet:'{n}MB以下に収まりました。',targetMissed:'このブラウザのエンコーダでは{n}MBまで小さくできませんでした。実際の結果は{size}です。',shrunk:'目標に合わせて幅{w}pxに縮小しました。',
 noVideo:'このファイルには映像トラックがありません。音声の抽出のみ可能です。',noAudio:'このファイルには音声トラックがありません。',audioOnly:'音声ファイル',
 compatGif:'このブラウザにはWebCodecsがないため互換モードで作成します · 最大480px · 20秒 · 8fps。',
 compatAudio:'このブラウザにはWebCodecsがないため互換モードで抽出します · 元ファイル20分以内。',
 compatVideo:'このブラウザにはWebCodecsがないためリアルタイム録画（WebM）で保存します · タブを開いたままにしてください · 最大10分。',
 cannotEncode:'このブラウザは動画のエンコードに対応していません。最新のChrome・Edge・Firefoxで開いてください。',
 engine:'{name}',report:'{w}×{h} · {codec} · {bitrate}',opened:'{name} · {duration}秒 · {size}'};
const SLICER_REASONS={ko:{separators:'여백 기준',frames:'스프라이트 크기',divides:'딱 나뉨'},en:{separators:'from gaps',frames:'sprite size',divides:'divides evenly'},ja:{separators:'余白から',frames:'スプライトの大きさ',divides:'割り切れる'}};
S.ko.slicer={exact:'선택한 프레임 좌표',zoom:'확대 배율',drop:'스프라이트 시트를 여기에 놓으세요',dropHint:'놓으면 바로 프레임을 찾아 표시합니다 · PNG 권장',sheet:'시트',fit:'맞춤',animation:'애니메이션 미리보기',fps:'초당 프레임(FPS)',frames:'프레임',frameCount:'{n}프레임',selectedN:'{n}개 선택',order:'읽는 순서로 정렬',mergeSelected:'선택 합치기',deleteSelected:'선택 삭제',undo:'되돌리기',
 hint:'클릭해 프레임 선택, Shift로 여러 개, 끌어서 이동·빈 곳에서 끌면 새 프레임, 모서리 손잡이로 크기 조절, Delete로 삭제, Ctrl+Z로 되돌리기. 아래 썸네일을 끌면 순서가 바뀝니다.',
 mode:'프레임 찾는 방법',modes:{auto:'자동',grid:'격자'},autoHint:'투명 배경으로 이어진 덩어리를 프레임으로 봅니다. 결과가 이상하면 고급 설정에서 최소 크기나 합치기 거리를 조절하세요.',
 suggested:'추천 셀 크기',noSuggestion:'추천할 크기를 찾지 못했습니다. 직접 입력하세요.',reasons:SLICER_REASONS.ko,gridBy:{cell:'셀 크기로',count:'열·행 수로'},
 cellW:'셀 너비',cellH:'셀 높이',columns:'열 수',rows:'행 수',offsetX:'왼쪽 여백',offsetY:'위쪽 여백',spacingX:'가로 간격',spacingY:'세로 간격',skipEmpty:'빈 칸은 건너뛰기',
 threshold:'투명 기준값',minArea:'최소 픽셀 수',merge:'가까운 조각 합치기 (px)',key:'배경색 지우기',keyNone:'사용 안 함',keyAuto:'가장자리에서 자동 감지',keyCustom:'직접 고르기',keyColor:'배경색',tolerance:'비슷한 색 허용 범위',
 output:'내보내기',trim:'프레임마다 투명 여백 잘라내기',canvases:{each:'프레임 크기 그대로',common:'모두 같은 캔버스'},anchor:'정렬 기준',anchors:{'bottom-center':'아래 가운데','center':'가운데','top-left':'왼쪽 위'},padding:'여백 (px)',prefix:'파일 이름 앞부분',
 wantGif:'움직이는 GIF도 함께',wantStrip:'가로 한 줄 PNG도 함께',another:'+ 다른 시트 열기',run:'프레임 {n}개 다운로드 (ZIP)',none:'프레임이 없습니다',done:'{n}개 프레임을 저장했습니다 ({size})',mixed:'크기가 서로 다름',trimmed:'여백 잘라냄',
 gifTooBig:'GIF로 만들기에 프레임이 너무 큽니다. 여백 잘라내기를 켜거나 프레임 수를 줄이세요.',oneSheet:'시트는 한 번에 한 장만 다룹니다. 첫 번째 파일을 열었습니다.'};
S.en.slicer={exact:'Selected frame',zoom:'Zoom',drop:'Drop a sprite sheet here',dropHint:'Frames are found and outlined the moment you drop it · PNG works best',sheet:'Sheet',fit:'Fit',animation:'Animation preview',fps:'Frames per second',frames:'Frames',frameCount:'{n} frame(s)',selectedN:'{n} selected',order:'Sort in reading order',mergeSelected:'Merge selected',deleteSelected:'Delete selected',undo:'Undo',
 hint:'Click a frame to select it, Shift for several, drag to move it, drag on empty space to add one, drag a corner handle to resize, Delete to remove, Ctrl+Z to undo. Drag the thumbnails below to reorder.',
 mode:'How to find frames',modes:{auto:'Auto',grid:'Grid'},autoHint:'Islands connected through transparency become frames. If that splits or joins too much, adjust the minimum size or the merge distance under Advanced.',
 suggested:'Recommended cell size',noSuggestion:'No size stood out — enter one yourself.',reasons:SLICER_REASONS.en,gridBy:{cell:'By cell size',count:'By columns × rows'},
 cellW:'Cell width',cellH:'Cell height',columns:'Columns',rows:'Rows',offsetX:'Left margin',offsetY:'Top margin',spacingX:'Gap across',spacingY:'Gap down',skipEmpty:'Skip empty cells',
 threshold:'Alpha threshold',minArea:'Minimum pixels',merge:'Merge islands closer than (px)',key:'Background colour to drop',keyNone:'None',keyAuto:'Detect from the border',keyCustom:'Choose',keyColor:'Background colour',tolerance:'Similar-colour range',
 output:'Export',trim:'Trim transparent margins per frame',canvases:{each:'Each frame its own size',common:'One canvas for all frames'},anchor:'Align on the canvas',anchors:{'bottom-center':'Bottom centre','center':'Centre','top-left':'Top left'},padding:'Padding (px)',prefix:'File name prefix',
 wantGif:'Also an animated GIF',wantStrip:'Also a horizontal strip PNG',another:'+ Open another sheet',run:'Download {n} frames (ZIP)',none:'No frames yet',done:'Saved {n} frames ({size})',mixed:'mixed sizes',trimmed:'trimmed',
 gifTooBig:'These frames are too large for a GIF. Turn trimming on or keep fewer frames.',oneSheet:'One sheet is sliced at a time; the first file was opened.'};
S.ja.slicer={exact:'選択フレームの座標',zoom:'表示倍率',drop:'ここにスプライトシートをドロップ',dropHint:'置いた瞬間にフレームを検出して枠で表示 · PNG推奨',sheet:'シート',fit:'全体',animation:'アニメーションプレビュー',fps:'毎秒フレーム数(FPS)',frames:'フレーム',frameCount:'{n}フレーム',selectedN:'{n}個選択',order:'読み順に並べる',mergeSelected:'選択を結合',deleteSelected:'選択を削除',undo:'元に戻す',
 hint:'クリックで選択、Shiftで複数、ドラッグで移動、何もない所をドラッグで追加、角のハンドルでサイズ変更、Deleteで削除、Ctrl+Zで元に戻す。下のサムネイルをドラッグすると順番が変わります。',
 mode:'フレームの検出方法',modes:{auto:'自動',grid:'グリッド'},autoHint:'透明でつながったかたまりをフレームとみなします。分かれすぎる・くっつきすぎる場合は詳細設定の最小サイズや結合距離を調整してください。',
 suggested:'おすすめのセルサイズ',noSuggestion:'候補が見つかりませんでした。直接入力してください。',reasons:SLICER_REASONS.ja,gridBy:{cell:'セルサイズで',count:'列×行で'},
 cellW:'セル幅',cellH:'セル高',columns:'列数',rows:'行数',offsetX:'左の余白',offsetY:'上の余白',spacingX:'横の間隔',spacingY:'縦の間隔',skipEmpty:'空のセルを飛ばす',
 threshold:'透明のしきい値',minArea:'最小ピクセル数',merge:'近いかたまりを結合 (px)',key:'背景色を消す',keyNone:'使わない',keyAuto:'ふちから自動検出',keyCustom:'自分で選ぶ',keyColor:'背景色',tolerance:'近い色の許容範囲',
 output:'書き出し',trim:'フレームごとに透明な余白をトリム',canvases:{each:'フレームごとのサイズ',common:'全フレーム同じキャンバス'},anchor:'キャンバス上の基準',anchors:{'bottom-center':'下・中央','center':'中央','top-left':'左上'},padding:'余白 (px)',prefix:'ファイル名の先頭',
 wantGif:'アニメGIFも一緒に',wantStrip:'横一列のPNGも一緒に',another:'+ 別のシートを開く',run:'{n}フレームをダウンロード (ZIP)',none:'フレームがありません',done:'{n}フレームを保存しました（{size}）',mixed:'サイズがばらばら',trimmed:'余白をトリム',
 gifTooBig:'GIFにするにはフレームが大きすぎます。トリムを有効にするかフレーム数を減らしてください。',oneSheet:'シートは一度に1枚です。最初のファイルを開きました。'};
S.ko.norm={offset:'캔버스 안 위치 (x,y)',drop:'프레임 이미지들을 여기에 놓으세요',dropHint:'크기가 달라도 됩니다 · 같은 캔버스에 맞춰 정렬합니다',canvasTitle:'공통 캔버스',viewFrames:'프레임별',viewOnion:'겹쳐 보기',animation:'애니메이션 미리보기',fps:'초당 프레임(FPS)',
 hint:'겹쳐 보기와 애니메이션으로 발 위치가 흔들리는지 먼저 확인하세요. 목록을 끌면 순서가 바뀝니다.',anchorV:'세로 정렬',anchorH:'가로 정렬',aligns:{top:'위',center:'가운데',bottom:'아래'},anchorsX:{left:'왼쪽',center:'가운데',right:'오른쪽'},
 trim:'투명 여백을 먼저 잘라내기',size:'캔버스 크기',sizes:{auto:'자동 (가장 큰 프레임)',exact:'직접 지정'},width:'너비 (px)',height:'높이 (px)',padding:'여백 (px)',sizeHint:'모든 프레임이 들어가야 합니다. 프레임을 확대하지는 않습니다.',
 add:'+ 프레임 추가',sortName:'이름순 정렬',run:'프레임 {n}개 다운로드 (ZIP)',none:'프레임이 없습니다',done:'{n}개 프레임을 저장했습니다 ({size})',frameCount:'{n}프레임',trimmed:'여백 잘라냄'};
S.en.norm={offset:'Position on the canvas (x,y)',drop:'Drop your frames here',dropHint:'Different sizes are fine · they are aligned on one canvas',canvasTitle:'Common canvas',viewFrames:'Each frame',viewOnion:'Onion skin',animation:'Animation preview',fps:'Frames per second',
 hint:'Use the onion skin and the animation to see a drifting foot before you download. Drag the list to reorder.',anchorV:'Vertical anchor',anchorH:'Horizontal anchor',aligns:{top:'Top',center:'Centre',bottom:'Bottom'},anchorsX:{left:'Left',center:'Centre',right:'Right'},
 trim:'Trim transparent margins first',size:'Canvas size',sizes:{auto:'Auto (largest frame)',exact:'Exact'},width:'Width (px)',height:'Height (px)',padding:'Padding (px)',sizeHint:'Every frame has to fit; frames are never enlarged.',
 add:'+ Add frames',sortName:'Sort by name',run:'Download {n} frames (ZIP)',none:'No frames yet',done:'Saved {n} frames ({size})',frameCount:'{n} frame(s)',trimmed:'trimmed'};
S.ja.norm={offset:'キャンバス内の位置 (x,y)',drop:'ここにフレーム画像をドロップ',dropHint:'サイズが違っても大丈夫 · 同じキャンバスに揃えます',canvasTitle:'共通キャンバス',viewFrames:'フレーム別',viewOnion:'重ねて表示',animation:'アニメーションプレビュー',fps:'毎秒フレーム数(FPS)',
 hint:'重ね表示とアニメーションで足元のぶれを先に確認できます。リストをドラッグすると順番が変わります。',anchorV:'縦の基準',anchorH:'横の基準',aligns:{top:'上',center:'中央',bottom:'下'},anchorsX:{left:'左',center:'中央',right:'右'},
 trim:'先に透明な余白をトリム',size:'キャンバスサイズ',sizes:{auto:'自動（最大フレーム）',exact:'指定する'},width:'幅 (px)',height:'高さ (px)',padding:'余白 (px)',sizeHint:'すべてのフレームが収まる必要があります。拡大はしません。',
 add:'+ フレームを追加',sortName:'名前順に並べる',run:'{n}フレームをダウンロード (ZIP)',none:'フレームがありません',done:'{n}フレームを保存しました（{size}）',frameCount:'{n}フレーム',trimmed:'余白をトリム'};
const MASK_ROLES={ko:{metallic:'메탈릭',ao:'AO',detail:'디테일',smoothness:'스무스',roughness:'러프니스'},en:{metallic:'metallic',ao:'AO',detail:'detail',smoothness:'smoothness',roughness:'roughness'},ja:{metallic:'メタリック',ao:'AO',detail:'ディテール',smoothness:'スムースネス',roughness:'ラフネス'}};
S.ko.mask={drop:'흑백 마스크 이미지를 놓으세요 (최대 4장)',dropHint:'크기가 같아야 합니다 · R·G·B·A에 원하는 순서로 넣습니다',packed:'합친 결과',perChannel:'채널별 미리보기',hint:'합친 텍스처는 눈으로 확인하기 어렵습니다. 채널별 미리보기로 각 마스크가 제대로 들어갔는지 확인하세요. 알파가 0이어도 RGB 값은 그대로 저장됩니다.',
 preset:'엔진 프리셋',presets:{custom:'직접 지정','unity-mask':'Unity 마스크맵','unity-metallic':'Unity 메탈릭','unreal-orm':'Unreal ORM'},channels:'채널 지정',zero:'0 (검정)',one:'255 (흰색)',invert:'반전',roles:MASK_ROLES.ko,
 add:'+ 마스크 추가',run:'PNG 다운로드',working:'만드는 중…',done:'PNG로 저장했습니다 ({size})',needInput:'이미지를 먼저 놓으세요',needChannel:'채널에 이미지를 하나 이상 지정하세요',sizeMismatch:'입력 이미지 크기가 서로 다릅니다',mismatch:'크기 불일치',unused:'미사용',onlyFour:'채널은 4개라 4장까지만 사용합니다.'};
S.en.mask={drop:'Drop up to four grayscale masks',dropHint:'They must share one size · you choose which channel each one fills',packed:'Packed result',perChannel:'Channel by channel',hint:'A packed texture is unreadable as one image, so each channel is shown on its own. RGB values are kept even where alpha is 0.',
 preset:'Engine preset',presets:{custom:'Custom','unity-mask':'Unity mask map','unity-metallic':'Unity metallic','unreal-orm':'Unreal ORM'},channels:'Channels',zero:'0 (black)',one:'255 (white)',invert:'Invert',roles:MASK_ROLES.en,
 add:'+ Add masks',run:'Download PNG',working:'Packing…',done:'Saved as PNG ({size})',needInput:'Drop an image first',needChannel:'Assign at least one image to a channel',sizeMismatch:'The inputs have different dimensions',mismatch:'size mismatch',unused:'unused',onlyFour:'There are four channels, so only four images are used.'};
S.ja.mask={drop:'グレースケールのマスクを最大4枚ドロップ',dropHint:'サイズは同じ必要があります · R・G・B・Aへの割り当てを選べます',packed:'結合結果',perChannel:'チャンネル別プレビュー',hint:'結合したテクスチャは目で判断しにくいため、チャンネルごとに表示します。アルファが0の場所でもRGB値は保持されます。',
 preset:'エンジンプリセット',presets:{custom:'自分で指定','unity-mask':'Unity マスクマップ','unity-metallic':'Unity メタリック','unreal-orm':'Unreal ORM'},channels:'チャンネル割り当て',zero:'0（黒）',one:'255（白）',invert:'反転',roles:MASK_ROLES.ja,
 add:'+ マスクを追加',run:'PNGをダウンロード',working:'作成中…',done:'PNGで保存しました（{size}）',needInput:'先に画像をドロップしてください',needChannel:'少なくとも1枚をチャンネルに割り当ててください',sizeMismatch:'入力画像のサイズが一致しません',mismatch:'サイズ不一致',unused:'未使用',onlyFour:'チャンネルは4つなので4枚までを使用します。'};
// --- Sprite Lab: one workspace, five stages. Slice -> Normalize -> Animate -> Pivot & boxes -> Pack.
const LAB_STAGES={ko:{slice:'자르기',normalize:'정렬',animate:'애니메이션',boxes:'기준점·박스',export:'포장·내보내기'},
 en:{slice:'Slice',normalize:'Normalize',animate:'Animate',boxes:'Pivot & boxes',export:'Pack & export'},
 ja:{slice:'分割',normalize:'整列',animate:'アニメ',boxes:'基準点・ボックス',export:'パック・書き出し'}};
const LAB_ALIGNS={ko:{'bottom-center':'경계 상자 아래 가운데',center:'가운데',top:'위',bottom:'경계 상자 아래',left:'왼쪽',right:'오른쪽','top-left':'왼쪽 위'},
 en:{'bottom-center':'Bounding-box bottom, centred',center:'Centre',top:'Top',bottom:'Bounding-box bottom',left:'Left',right:'Right','top-left':'Top left'},
 ja:{'bottom-center':'境界の下・中央',center:'中央',top:'上',bottom:'境界の下',left:'左',right:'右','top-left':'左上'}};
const LAB_REFS={ko:{pivot:'기준점',"bottom-center":'경계 상자 아래',"bounds-centre":'경계 상자 중심',"alpha-centroid":'알파 무게중심'},
 en:{pivot:'Declared pivot',"bottom-center":'Bounding-box bottom',"bounds-centre":'Bounding-box centre',"alpha-centroid":'Alpha centroid'},
 ja:{pivot:'宣言した基準点',"bottom-center":'境界の下',"bounds-centre":'境界の中心',"alpha-centroid":'アルファ重心'}};
const LAB_BOXES={ko:{hit:'히트박스',hurt:'피격박스',interact:'상호작용',custom:'사용자'},en:{hit:'Hitbox',hurt:'Hurtbox',interact:'Interact',custom:'Custom'},ja:{hit:'ヒット',hurt:'被弾',interact:'インタラクト',custom:'カスタム'}};
S.ko.lab={stages:LAB_STAGES.ko,aligns:LAB_ALIGNS.ko,references:LAB_REFS.ko,boxTypes:LAB_BOXES.ko,
 drop:'스프라이트 시트를 여기에 놓으세요',dropHint:'놓으면 바로 프레임을 찾습니다 · 한 번만 올리면 내보내기까지 한 화면에서',
 sheet:'시트',frames:'프레임',frameCount:'{n}프레임',selectedN:'{n}개 선택',none:'프레임이 없습니다',working:'처리 중…',cancel:'중단',undo:'되돌리기',redo:'다시 실행',
 zoom:'배율',fit:'맞춤',bg:'배경',bgs:{checker:'체커',black:'검정',white:'흰색',magenta:'마젠타'},apply:'적용',
 applyTo:'적용 대상',targets:{selected:'선택한 프레임',animation:'이 애니메이션',all:'모든 프레임'},
 mode:'프레임 찾는 방법',modes:{auto:'자동',grid:'격자'},autoHint:'투명으로 이어진 덩어리를 프레임으로 봅니다. 모자·검처럼 떨어진 조각은 아래 거리만큼 자동으로 합칩니다.',
 mergeAuto:'가까운 조각 자동 합치기',merge:'합치는 거리 (px)',mergeChosen:'{n}px 선택',
 suggested:'추천 격자',noSuggestion:'격자를 찾지 못했습니다. 셀 크기를 직접 입력하세요.',cellCustom:'셀 크기 직접 입력',
 cellW:'셀 너비',cellH:'셀 높이',offsetX:'왼쪽 여백',offsetY:'위쪽 여백',spacingX:'가로 간격',spacingY:'세로 간격',skipEmpty:'빈 칸 건너뛰기',
 threshold:'투명 기준값',minArea:'최소 픽셀 수',key:'배경색 지우기',keyNone:'사용 안 함',keyAuto:'가장자리에서 자동 감지',keyCustom:'직접 고르기',keyColor:'배경색',tolerance:'비슷한 색 허용 범위',
 exact:'선택한 프레임 좌표',mergeSelected:'선택 합치기',deleteSelected:'선택 삭제',order:'읽는 순서로',
 sliceHint:'클릭해 선택, Shift로 여러 개, 끌어서 이동, 빈 곳을 끌면 새 프레임, 모서리로 크기 조절, Delete로 삭제.',
 trim:'투명 여백 잘라내기',size:'공통 캔버스',sizes:{auto:'자동 (가장 큰 프레임)',exact:'직접 지정'},width:'너비 (px)',height:'높이 (px)',padding:'여백 (px)',align:'정렬 기준',
 sizeHint:'모든 프레임이 들어가야 합니다. 프레임을 확대하지는 않습니다.',before:'정렬 전',after:'정렬 후',runNormalize:'이 정렬 적용',normalized:'{w}×{h} 공통 캔버스',
 animations:'애니메이션',newAnimation:'+ 새 애니메이션',renameAnimation:'이름 바꾸기',deleteAnimation:'삭제',assign:'선택한 프레임 넣기',tag:'태그',
 fps:'초당 프레임(FPS)',duration:'이 프레임만 길이 (ms)',durationAuto:'FPS 사용',loop:'반복',direction:'재생 방향',directions:{forward:'정방향',reverse:'역방향',pingpong:'왕복'},
 play:'재생',pause:'일시정지',onion:'겹쳐 보기(양파)',onionBefore:'이전 프레임 수',onionAfter:'다음 프레임 수',difference:'차이 보기',
 duplicates:'중복·빈 프레임',dupNone:'중복이나 빈 프레임이 없습니다.',dupFound:'같은 프레임 {n}쌍, 빈 프레임 {b}개',dupRemove:'중복 프레임 지우기',
 loopSeam:'반복 이음새',jitter:'흔들림(지터)',jitterRms:'RMS {n}px',jitterMax:'최대 {n}px',jitterNone:'흔들림을 측정할 프레임이 부족합니다.',
 autoFix:'흔들림 자동 보정',reference:'기준',preserveTrend:'의도한 움직임은 남기기',fixed:'RMS {a}px → {b}px',keepFix:'보정 적용',dropFix:'취소',
 mirror:'좌우 반전 애니메이션 만들기',playbackNote:'미리보기는 내보내기와 같은 재생 목록을 씁니다.',
 pivot:'기준점(피벗)',pivots:{center:'가운데','bottom-center':'경계 상자 아래 가운데','top-left':'왼쪽 위','top-center':'위 가운데','bottom-left':'왼쪽 아래'},
 pivotX:'기준점 X',pivotY:'기준점 Y',pivotPixels:'픽셀',pivotUnit:'비율(0–1)',
 boxes:'박스',boxType:'종류',shape:'모양',shapes:{rect:'사각형',circle:'원',polygon:'다각형'},addBox:'박스 추가',removeBoxLabel:'박스 삭제',
 rangeFrom:'시작 프레임',rangeTo:'끝 프레임',copyToRange:'이 구간에 복사',timeline:'박스 타임라인',timelineHint:'가로는 재생 순서, 세로는 박스 종류입니다. 색이 아니라 무늬와 이름으로 구분합니다.',
 collision:'충돌 다각형',collisionRun:'알파에서 만들기',collisionShape:'모양',collisionShapes:{polygon:'다각형',hull:'볼록 외피',rect:'사각형',circle:'원'},
 collisionTolerance:'단순화 허용치 (px)',collisionVertices:'최대 꼭짓점',collisionThreshold:'알파 기준값',collisionPadding:'바깥으로 늘리기 (px)',
 collisionResult:'꼭짓점 {traced}개 → {simple}개 · 최대 오차 {dev}px · 면적 오차 {area}%',collisionNone:'충돌 다각형이 없습니다.',
 atlas:'아틀라스',atlasPadding:'프레임 간격 (px)',extrude:'가장자리 늘리기 (px)',pot:'2의 거듭제곱 크기',maxSize:'페이지 최대 크기',dedupe:'같은 프레임은 한 번만 저장',
 pages:'페이지 {n}개',efficiency:'{n}% 사용',pageLine:'{i}쪽 · {w}×{h} · {n}% 사용',aliased:'{n}개 프레임이 같은 영역을 공유',
 target:'엔진',targets2:{generic:'일반 JSON',godot:'Godot 4',unity:'Unity'},
 godotNote:'Godot 4.7.2에서 실제로 불러와 검증했습니다.',unityNote:'검증되지 않음 — Unity 에디터에서 실행해 본 적이 없습니다. JSON과 C# 스크립트에도 같은 표시가 있습니다.',
 outline:'외곽선 (px)',outlineColor:'외곽선 색',defringe:'경계에 남은 배경색 제거',nonDestructive:'내보낼 때만 적용됩니다. 원본 프레임은 그대로입니다.',edgeZoom:'가장자리 확대 비교',
 pack:'포장하기',download:'ZIP 다운로드 (아틀라스 + {f})',downloadFrames:'프레임 PNG ZIP',downloadGif:'GIF 미리보기',
 saveProject:'프로젝트 JSON 저장',loadProject:'프로젝트 JSON 불러오기',projectNote:'좌표와 설정만 저장합니다. 불러올 때 시트를 다시 올려야 합니다.',
 share:'설정 링크 복사',shared:'설정 링크를 복사했습니다.',done:'ZIP으로 저장했습니다 ({size})',needPack:'먼저 포장하세요.',needAnimation:'애니메이션을 먼저 만드세요.',
 another:'+ 다른 시트 열기',oneSheet:'시트는 한 번에 한 장만 다룹니다. 첫 번째 파일을 열었습니다.',gifTooBig:'GIF로 만들기에 프레임이 너무 큽니다.'};
S.en.lab={stages:LAB_STAGES.en,aligns:LAB_ALIGNS.en,references:LAB_REFS.en,boxTypes:LAB_BOXES.en,
 drop:'Drop a sprite sheet here',dropHint:'Frames are found the moment you drop it · one upload, all the way to the export',
 sheet:'Sheet',frames:'Frames',frameCount:'{n} frame(s)',selectedN:'{n} selected',none:'No frames yet',working:'Working…',cancel:'Stop',undo:'Undo',redo:'Redo',
 zoom:'Zoom',fit:'Fit',bg:'Background',bgs:{checker:'Checker',black:'Black',white:'White',magenta:'Magenta'},apply:'Apply',
 applyTo:'Apply to',targets:{selected:'Selected frames',animation:'This animation',all:'All frames'},
 mode:'How to find frames',modes:{auto:'Auto',grid:'Grid'},autoHint:'Islands connected through transparency become frames. Parts drawn apart — a hat, a sword — are merged using the distance below.',
 mergeAuto:'Choose the merge distance automatically',merge:'Merge nearby parts (px)',mergeChosen:'chose {n}px',
 suggested:'Grid suggestions',noSuggestion:'No grid stood out — enter a cell size yourself.',cellCustom:'Custom cell size',
 cellW:'Cell width',cellH:'Cell height',offsetX:'Left margin',offsetY:'Top margin',spacingX:'Gap across',spacingY:'Gap down',skipEmpty:'Skip empty cells',
 threshold:'Alpha threshold',minArea:'Minimum pixels',key:'Background colour to drop',keyNone:'None',keyAuto:'Detect from the border',keyCustom:'Choose',keyColor:'Background colour',tolerance:'Similar-colour range',
 exact:'Selected frame',mergeSelected:'Merge selected',deleteSelected:'Delete selected',order:'Reading order',
 sliceHint:'Click to select, Shift for several, drag to move, drag empty space to add, corner handles to resize, Delete to remove.',
 trim:'Trim transparent margins',size:'Common canvas',sizes:{auto:'Auto (largest frame)',exact:'Exact'},width:'Width (px)',height:'Height (px)',padding:'Padding (px)',align:'Align on the canvas',
 sizeHint:'Every frame has to fit; frames are never enlarged.',before:'Before',after:'After',runNormalize:'Apply this alignment',normalized:'{w}×{h} common canvas',
 animations:'Animations',newAnimation:'+ New animation',renameAnimation:'Rename',deleteAnimation:'Delete',assign:'Use the selected frames',tag:'Tag',
 fps:'Frames per second',duration:'This frame only (ms)',durationAuto:'Use the fps',loop:'Loop',direction:'Direction',directions:{forward:'Forward',reverse:'Reverse',pingpong:'Ping-pong'},
 play:'Play',pause:'Pause',onion:'Onion skin',onionBefore:'Frames before',onionAfter:'Frames after',difference:'Difference view',
 duplicates:'Duplicate and blank frames',dupNone:'No duplicate or blank frames.',dupFound:'{n} identical pair(s), {b} blank',dupRemove:'Remove the duplicates',
 loopSeam:'Loop seam',jitter:'Jitter',jitterRms:'RMS {n}px',jitterMax:'max {n}px',jitterNone:'Not enough frames to measure jitter.',
 autoFix:'Auto-fix jitter',reference:'Hold still',preserveTrend:'Keep the intended motion',fixed:'RMS {a}px → {b}px',keepFix:'Keep the fix',dropFix:'Discard',
 mirror:'Make a mirrored animation',playbackNote:'The preview plays the same list the export writes.',
 pivot:'Pivot',pivots:{center:'Centre','bottom-center':'Bounding-box bottom, centred','top-left':'Top left','top-center':'Top centre','bottom-left':'Bottom left'},
 pivotX:'Pivot X',pivotY:'Pivot Y',pivotPixels:'pixels',pivotUnit:'normalised (0–1)',
 boxes:'Boxes',boxType:'Type',shape:'Shape',shapes:{rect:'Rectangle',circle:'Circle',polygon:'Polygon'},addBox:'Add a box',removeBoxLabel:'Delete box',
 rangeFrom:'From frame',rangeTo:'To frame',copyToRange:'Copy to this range',timeline:'Hitbox timeline',timelineHint:'Across is playback order, down is box type. Types are told apart by pattern and name, never by colour alone.',
 collision:'Collision polygons',collisionRun:'Generate from alpha',collisionShape:'Shape',collisionShapes:{polygon:'Polygon',hull:'Convex hull',rect:'Rectangle',circle:'Circle'},
 collisionTolerance:'Simplify tolerance (px)',collisionVertices:'Max vertices',collisionThreshold:'Alpha threshold',collisionPadding:'Grow outwards (px)',
 collisionResult:'{traced} traced → {simple} vertices · max deviation {dev}px · area error {area}%',collisionNone:'No collision polygons yet.',
 atlas:'Atlas',atlasPadding:'Spacing (px)',extrude:'Extrude edges (px)',pot:'Power-of-two size',maxSize:'Max page size',dedupe:'Store identical frames once',
 pages:'{n} page(s)',efficiency:'{n}% used',pageLine:'Page {i} · {w}×{h} · {n}% used',aliased:'{n} frame(s) share a region',
 target:'Engine',targets2:{generic:'Generic JSON',godot:'Godot 4',unity:'Unity'},
 godotNote:'Verified: the export was really imported by Godot 4.7.2.',unityNote:'UNVERIFIED — no part of the Unity path has ever been run in the editor. The same label is in the JSON, the C# file and the README.',
 outline:'Outline (px)',outlineColor:'Outline colour',defringe:'Remove backdrop colour left on edges',nonDestructive:'Applied to the export only; your frames are untouched.',edgeZoom:'Edge zoom, before and after',
 pack:'Pack',download:'Download ZIP (atlas + {f})',downloadFrames:'Frame PNGs (ZIP)',downloadGif:'GIF preview',
 saveProject:'Save project JSON',loadProject:'Load project JSON',projectNote:'Coordinates and settings only — loading one asks for the sheet again.',
 share:'Copy a settings link',shared:'Settings link copied.',done:'Saved as ZIP ({size})',needPack:'Pack the frames first.',needAnimation:'Create an animation first.',
 another:'+ Open another sheet',oneSheet:'One sheet at a time; the first file was opened.',gifTooBig:'These frames are too large for a GIF.'};
S.ja.lab={stages:LAB_STAGES.ja,aligns:LAB_ALIGNS.ja,references:LAB_REFS.ja,boxTypes:LAB_BOXES.ja,
 drop:'ここにスプライトシートをドロップ',dropHint:'置いた瞬間にフレームを検出 · 一度置けば書き出しまで同じ画面で',
 sheet:'シート',frames:'フレーム',frameCount:'{n}フレーム',selectedN:'{n}個選択',none:'フレームがありません',working:'処理中…',cancel:'中止',undo:'元に戻す',redo:'やり直す',
 zoom:'倍率',fit:'全体',bg:'背景',bgs:{checker:'チェッカー',black:'黒',white:'白',magenta:'マゼンタ'},apply:'適用',
 applyTo:'適用先',targets:{selected:'選択したフレーム',animation:'このアニメーション',all:'すべてのフレーム'},
 mode:'フレームの検出方法',modes:{auto:'自動',grid:'グリッド'},autoHint:'透明でつながったかたまりをフレームとみなします。帽子や剣のように離れた部品は下の距離で結合します。',
 mergeAuto:'結合距離を自動で決める',merge:'近い部品を結合 (px)',mergeChosen:'{n}pxを選択',
 suggested:'グリッド候補',noSuggestion:'グリッドが見つかりませんでした。セルサイズを入力してください。',cellCustom:'セルサイズを直接入力',
 cellW:'セル幅',cellH:'セル高',offsetX:'左の余白',offsetY:'上の余白',spacingX:'横の間隔',spacingY:'縦の間隔',skipEmpty:'空のセルを飛ばす',
 threshold:'透明のしきい値',minArea:'最小ピクセル数',key:'背景色を消す',keyNone:'使わない',keyAuto:'ふちから自動検出',keyCustom:'自分で選ぶ',keyColor:'背景色',tolerance:'近い色の許容範囲',
 exact:'選択フレームの座標',mergeSelected:'選択を結合',deleteSelected:'選択を削除',order:'読み順に並べる',
 sliceHint:'クリックで選択、Shiftで複数、ドラッグで移動、空白をドラッグで追加、角でサイズ変更、Deleteで削除。',
 trim:'透明な余白をトリム',size:'共通キャンバス',sizes:{auto:'自動（最大フレーム）',exact:'指定する'},width:'幅 (px)',height:'高さ (px)',padding:'余白 (px)',align:'キャンバス上の基準',
 sizeHint:'すべてのフレームが収まる必要があります。拡大はしません。',before:'整列前',after:'整列後',runNormalize:'この整列を適用',normalized:'{w}×{h}の共通キャンバス',
 animations:'アニメーション',newAnimation:'+ 新規アニメーション',renameAnimation:'名前を変更',deleteAnimation:'削除',assign:'選択したフレームを入れる',tag:'タグ',
 fps:'毎秒フレーム数(FPS)',duration:'このフレームだけの長さ (ms)',durationAuto:'FPSを使う',loop:'ループ',direction:'再生方向',directions:{forward:'順再生',reverse:'逆再生',pingpong:'往復'},
 play:'再生',pause:'一時停止',onion:'重ねて表示',onionBefore:'前のフレーム数',onionAfter:'次のフレーム数',difference:'差分表示',
 duplicates:'重複・空フレーム',dupNone:'重複や空のフレームはありません。',dupFound:'同一{n}組、空{b}個',dupRemove:'重複を削除',
 loopSeam:'ループの継ぎ目',jitter:'ぶれ（ジッター）',jitterRms:'RMS {n}px',jitterMax:'最大 {n}px',jitterNone:'ぶれを測るフレームが足りません。',
 autoFix:'ぶれを自動補正',reference:'固定する基準',preserveTrend:'意図した動きは残す',fixed:'RMS {a}px → {b}px',keepFix:'補正を適用',dropFix:'取り消す',
 mirror:'左右反転アニメーションを作る',playbackNote:'プレビューは書き出しと同じ再生リストを使います。',
 pivot:'基準点（ピボット）',pivots:{center:'中央','bottom-center':'境界の下・中央','top-left':'左上','top-center':'上・中央','bottom-left':'左下'},
 pivotX:'基準点 X',pivotY:'基準点 Y',pivotPixels:'ピクセル',pivotUnit:'比率(0–1)',
 boxes:'ボックス',boxType:'種類',shape:'形',shapes:{rect:'長方形',circle:'円',polygon:'多角形'},addBox:'ボックスを追加',removeBoxLabel:'ボックスを削除',
 rangeFrom:'開始フレーム',rangeTo:'終了フレーム',copyToRange:'この範囲にコピー',timeline:'ボックスのタイムライン',timelineHint:'横は再生順、縦はボックスの種類です。色だけでなく模様と名前で区別します。',
 collision:'衝突ポリゴン',collisionRun:'アルファから生成',collisionShape:'形',collisionShapes:{polygon:'多角形',hull:'凸包',rect:'長方形',circle:'円'},
 collisionTolerance:'簡略化の許容値 (px)',collisionVertices:'最大頂点数',collisionThreshold:'アルファのしきい値',collisionPadding:'外側に広げる (px)',
 collisionResult:'頂点 {traced} → {simple} · 最大誤差 {dev}px · 面積誤差 {area}%',collisionNone:'衝突ポリゴンがありません。',
 atlas:'アトラス',atlasPadding:'フレーム間隔 (px)',extrude:'端を引き伸ばす (px)',pot:'2のべき乗サイズ',maxSize:'ページ最大サイズ',dedupe:'同一フレームは1回だけ保存',
 pages:'{n}ページ',efficiency:'{n}%使用',pageLine:'{i}ページ · {w}×{h} · {n}%使用',aliased:'{n}フレームが同じ領域を共有',
 target:'エンジン',targets2:{generic:'汎用JSON',godot:'Godot 4',unity:'Unity'},
 godotNote:'Godot 4.7.2で実際に読み込んで検証済みです。',unityNote:'未検証 — Unityエディターで一度も実行していません。JSON・C#・READMEにも同じ表示があります。',
 outline:'アウトライン (px)',outlineColor:'アウトラインの色',defringe:'輪郭に残った背景色を除去',nonDestructive:'書き出し時のみ適用され、元のフレームは変わりません。',edgeZoom:'輪郭の拡大比較',
 pack:'パックする',download:'ZIPをダウンロード（アトラス + {f}）',downloadFrames:'フレームPNG (ZIP)',downloadGif:'GIFプレビュー',
 saveProject:'プロジェクトJSONを保存',loadProject:'プロジェクトJSONを読み込む',projectNote:'座標と設定だけを保存します。読み込むときにシートをもう一度置いてください。',
 share:'設定リンクをコピー',shared:'設定リンクをコピーしました。',done:'ZIPで保存しました（{size}）',needPack:'先にパックしてください。',needAnimation:'先にアニメーションを作ってください。',
 another:'+ 別のシートを開く',oneSheet:'シートは一度に1枚です。最初のファイルを開きました。',gifTooBig:'GIFにするにはフレームが大きすぎます。'};
export function ui(locale,key,vars={}){
 let v=key.split('.').reduce((o,k)=>o?.[k],S[locale]||S.en)??key.split('.').reduce((o,k)=>o?.[k],S.en)??key;
 return String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
export const UI_LOCALES=Object.keys(S);
export const UI_STRINGS=S;
