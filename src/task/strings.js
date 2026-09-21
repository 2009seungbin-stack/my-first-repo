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
export function ui(locale,key,vars={}){
 let v=key.split('.').reduce((o,k)=>o?.[k],S[locale]||S.en)??key.split('.').reduce((o,k)=>o?.[k],S.en)??key;
 return String(v).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
export const UI_LOCALES=Object.keys(S);
export const UI_STRINGS=S;
