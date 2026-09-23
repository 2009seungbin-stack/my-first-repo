/** ko/en/ja copy of the Pack & Export stage, merged into the Studio string table (src/studio/strings.js)
 * so `ctx.t('pack.…')` works like every other key. Kept in its own file so the Sprite workspace and
 * this stage can change copy without editing the same lines. Parity is tested in
 * tests/studio-pack.test.mjs. No "AI" wording; verification claims match docs/STUDIO-PACK.md. */
import {STUDIO_STRINGS} from './strings.js';
const S={
en:{
 ws:{pack:'Pack & Export',packSummary:'Pack frames into atlas pages and export them for Godot, Unity, Phaser, Pixi, GameMaker, Defold, LÖVE and more.'},
 panel:{packSettings:'Pack settings',packResult:'Atlas',packExport:'Export',packFrames:'Packed frames'},
 tool:{packPick:'Pick frame',packPickHint:'Click a frame on the atlas to select it'},
 cmd:{pack:{repack:'Pack again',cancel:'Cancel packing',settings:'Change pack settings',preset:'Apply preset {name}',nextPage:'Next atlas page',prevPage:'Previous atlas page',exportLast:'Export again'}},
 menu:{pack:'Pack'},group:{pack:'Pack & Export'},
 pack:{
  preset:'Preset',custom:'Custom',presetHint:'A preset sets the defaults its engine needs; you can change them after.',
  basic:'Basic',advanced:'Advanced',maxSize:'Max page size',padding:'Padding',paddingHint:'Empty pixels between sprites',border:'Border padding',extrude:'Extrude',extrudeHint:'Copies each sprite\'s edge pixels outward so filtered or scaled drawing never samples a neighbour',
  trim:'Trim',trimMode:{none:'None (keep full frames)',trim:'Trim (keep size and position)','crop-keep':'Crop, keep position (pivot moves)',crop:'Crop (forget size and position)'},
  rotation:'Allow rotation',rotationHint:'Turns some sprites 90° to fit tighter. Only engines that read rotated regions accept it.',
  sizeMode:'Page size',size:{auto:'Smallest','pot':'Power of two',square:'Square','pot-square':'Power of two, square',fixed:'Fixed'},
  fixedW:'Width',fixedH:'Height',multipleOf:'Size multiple of',algorithm:'Algorithm',alg:{maxrects:'MaxRects',skyline:'Skyline',guillotine:'Guillotine'},
  heuristic:'Placement rule',heur:{best:'Try all, keep smallest',bssf:'Best short side fit',blsf:'Best long side fit',baf:'Best area fit',bl:'Bottom-left',cp:'Contact point',waste:'Min waste'},
  effort:'Effort',eff:{fast:'Fast',normal:'Normal',best:'Best (slow)'},multipack:'Multipack (several pages)',maxPages:'Max pages',
  alpha:'Alpha threshold',alphaHint:'Pixels with alpha at or below this count as empty when trimming (0 = keep every visible pixel)',
  dedupe:'Store identical frames once',premultiply:'Premultiplied alpha',premultiplyHint:'Only for engines set to premultiplied textures',scales:'Scale variants',scaleHint:'Nearest-neighbour: pixel art stays sharp. Each variant is its own atlas with @2x-style names.',
  packing:'Packing…',phase:{decode:'Reading images…',sprites:'Trimming and comparing frames…',layout:'Trying layouts… {tried}',repack:'Packing with the export\'s settings…',png:'Writing page {page}…',frames:'Writing {name}…',zip:'Making the ZIP…',video:'Encoding video {name}…'},
  cancel:'Cancel',cancelled:'Packing cancelled.',noFrames:'Import images or cut frames in another workspace; they are packed here.',
  page:'Page {n}',pageOf:'Page {n} of {total}',variant:'@{s}x',stats:'{w}×{h} px · {eff}% used',
  totals:'{frames} frames · {unique} stored · {aliases} identical · {pages} page(s) · {eff}% used · {ms} ms',rules:'Layout: {alg} / {heur} / sorted by {sort}',
  aliasNote:'{n} frame(s) are pixel-identical to another and share its region.',
  implicit:'No tags yet: engines get one animation "{name}" with all {n} frames at {fps} fps. Add tags in the Sprite workspace to name your animations.',
  warnings:'Notes',
  exportName:'File name',exportFor:'Export for {name}',export:'Export',exporting:'Exporting {name}…',exported:'Downloaded {file} ({n} files).',
  groups:{engine:'Engines',data:'Data formats',anim:'Animations'},
  verify:{verified:'Loaded in {engine}',parsed:'Built by {engine}',decoded:'Decoded by {engine}',unverified:'UNVERIFIED — not loaded in an engine here'},
  changed:'For {name} the export packs with {what} (its engine needs this).',
  lastExport:'Last export',files:'{n} files',frameRow:'{w}×{h} → {sw}×{sh}',flags:{trimmed:'trimmed',rotated:'rotated',alias:'same as {name}'},
  onPage:'page {n}',selectHint:'Selection is shared with the timeline.',
  webmOnly:'WebM needs a browser with WebCodecs (Chrome, Edge).',
  exportTarget:'Export for',allFormats:'All formats ({n})',memory:'{mb} MB of texture memory when loaded (RGBA8888)',
  chg:{allowRotation:{false:'no rotation',true:'rotation'},trimMode:{none:'trim off',trim:'trim',"crop-keep":'crop, keep position',crop:'crop'},multipack:{false:'one page',true:'multipack'}}
 }
},
ko:{
 ws:{pack:'패킹 & 내보내기',packSummary:'프레임을 아틀라스 페이지로 패킹하고 Godot, Unity, Phaser, Pixi, GameMaker, Defold, LÖVE 등으로 내보냅니다.'},
 panel:{packSettings:'패킹 설정',packResult:'아틀라스',packExport:'내보내기',packFrames:'패킹된 프레임'},
 tool:{packPick:'프레임 선택',packPickHint:'아틀라스에서 프레임을 클릭해 선택'},
 cmd:{pack:{repack:'다시 패킹',cancel:'패킹 취소',settings:'패킹 설정 변경',preset:'프리셋 {name} 적용',nextPage:'다음 아틀라스 페이지',prevPage:'이전 아틀라스 페이지',exportLast:'다시 내보내기'}},
 menu:{pack:'패킹'},group:{pack:'패킹 & 내보내기'},
 pack:{
  preset:'프리셋',custom:'사용자 지정',presetHint:'프리셋은 해당 엔진에 필요한 기본값을 설정합니다. 이후 자유롭게 바꿀 수 있습니다.',
  basic:'기본',advanced:'고급',maxSize:'최대 페이지 크기',padding:'간격',paddingHint:'스프라이트 사이의 빈 픽셀',border:'테두리 여백',extrude:'가장자리 확장',extrudeHint:'각 스프라이트의 가장자리 픽셀을 바깥으로 복사해, 필터링·확대 시 이웃 픽셀이 섞이지 않게 합니다',
  trim:'트림',trimMode:{none:'없음 (프레임 전체 유지)',trim:'트림 (크기와 위치 유지)','crop-keep':'잘라내기, 위치 유지 (피벗 이동)',crop:'잘라내기 (크기·위치 버림)'},
  rotation:'회전 허용',rotationHint:'일부 스프라이트를 90° 돌려 더 촘촘히 넣습니다. 회전된 영역을 읽는 엔진만 받을 수 있습니다.',
  sizeMode:'페이지 크기',size:{auto:'최소',pot:'2의 거듭제곱',square:'정사각형','pot-square':'2의 거듭제곱, 정사각형',fixed:'고정'},
  fixedW:'너비',fixedH:'높이',multipleOf:'크기 배수',algorithm:'알고리즘',alg:{maxrects:'MaxRects',skyline:'Skyline',guillotine:'Guillotine'},
  heuristic:'배치 규칙',heur:{best:'모두 시도해 가장 작은 것',bssf:'짧은 변 최적',blsf:'긴 변 최적',baf:'면적 최적',bl:'왼쪽 아래',cp:'접촉점',waste:'최소 낭비'},
  effort:'탐색 강도',eff:{fast:'빠르게',normal:'보통',best:'최선 (느림)'},multipack:'멀티팩 (여러 페이지)',maxPages:'최대 페이지 수',
  alpha:'알파 임계값',alphaHint:'트림할 때 알파가 이 값 이하인 픽셀은 빈 것으로 봅니다 (0 = 보이는 픽셀은 모두 유지)',
  dedupe:'같은 프레임은 한 번만 저장',premultiply:'프리멀티플라이드 알파',premultiplyHint:'엔진이 프리멀티플라이드 텍스처를 쓸 때만',scales:'배율 버전',scaleHint:'최근접 보간이라 픽셀 아트가 선명하게 유지됩니다. 버전마다 @2x 형식 이름의 별도 아틀라스가 됩니다.',
  packing:'패킹 중…',phase:{decode:'이미지 읽는 중…',sprites:'프레임 트림·비교 중…',layout:'배치 시도 중… {tried}',repack:'내보내기 설정으로 다시 패킹 중…',png:'{page}페이지 쓰는 중…',frames:'{name} 쓰는 중…',zip:'ZIP 만드는 중…',video:'{name} 영상 인코딩 중…'},
  cancel:'취소',cancelled:'패킹을 취소했습니다.',noFrames:'다른 워크스페이스에서 이미지를 가져오거나 프레임을 자르면 여기서 패킹됩니다.',
  page:'{n}페이지',pageOf:'{total}페이지 중 {n}',variant:'@{s}x',stats:'{w}×{h} px · {eff}% 사용',
  totals:'프레임 {frames} · 저장 {unique} · 동일 {aliases} · 페이지 {pages} · {eff}% 사용 · {ms} ms',rules:'배치: {alg} / {heur} / {sort} 순 정렬',
  aliasNote:'{n}개 프레임이 다른 프레임과 픽셀까지 같아 같은 영역을 공유합니다.',
  implicit:'아직 태그가 없습니다: 엔진에는 {n}개 프레임 전체를 {fps} fps로 재생하는 애니메이션 "{name}" 하나가 들어갑니다. 스프라이트 워크스페이스에서 태그를 추가해 이름을 붙이세요.',
  warnings:'참고',
  exportName:'파일 이름',exportFor:'{name}용으로 내보내기',export:'내보내기',exporting:'{name} 내보내는 중…',exported:'{file} 다운로드 ({n}개 파일).',
  groups:{engine:'엔진',data:'데이터 형식',anim:'애니메이션'},
  verify:{verified:'{engine}에서 불러와 확인',parsed:'{engine}으로 빌드해 확인',decoded:'{engine}으로 디코딩해 확인',unverified:'미검증 — 이 환경의 엔진에서 불러오지 않음'},
  changed:'{name}용 내보내기는 {what}(으)로 패킹합니다 (엔진에 필요).',
  lastExport:'마지막 내보내기',files:'파일 {n}개',frameRow:'{w}×{h} → {sw}×{sh}',flags:{trimmed:'트림됨',rotated:'회전됨',alias:'{name}와 동일'},
  onPage:'{n}페이지',selectHint:'선택은 타임라인과 공유됩니다.',
  webmOnly:'WebM은 WebCodecs를 지원하는 브라우저(Chrome, Edge)가 필요합니다.',
  exportTarget:'내보낼 대상',allFormats:'모든 형식 ({n})',memory:'불러오면 텍스처 메모리 {mb} MB (RGBA8888)',
  chg:{allowRotation:{false:'회전 없음',true:'회전'},trimMode:{none:'트림 끔',trim:'트림',"crop-keep":'잘라내기·위치 유지',crop:'잘라내기'},multipack:{false:'한 페이지',true:'멀티팩'}}
 }
},
ja:{
 ws:{pack:'パック & 書き出し',packSummary:'フレームをアトラスページにパックし、Godot・Unity・Phaser・Pixi・GameMaker・Defold・LÖVE などへ書き出します。'},
 panel:{packSettings:'パック設定',packResult:'アトラス',packExport:'書き出し',packFrames:'パック済みフレーム'},
 tool:{packPick:'フレームを選択',packPickHint:'アトラス上のフレームをクリックして選択'},
 cmd:{pack:{repack:'もう一度パック',cancel:'パックを中止',settings:'パック設定を変更',preset:'プリセット {name} を適用',nextPage:'次のアトラスページ',prevPage:'前のアトラスページ',exportLast:'もう一度書き出す'}},
 menu:{pack:'パック'},group:{pack:'パック & 書き出し'},
 pack:{
  preset:'プリセット',custom:'カスタム',presetHint:'プリセットはそのエンジンに必要な初期値を設定します。あとから変更できます。',
  basic:'基本',advanced:'詳細',maxSize:'最大ページサイズ',padding:'余白',paddingHint:'スプライト間の空きピクセル',border:'外周の余白',extrude:'縁の押し出し',extrudeHint:'各スプライトの縁のピクセルを外側へ複製し、フィルタや拡大描画で隣のピクセルが混ざらないようにします',
  trim:'トリム',trimMode:{none:'なし（フレーム全体を保持）',trim:'トリム（サイズと位置を保持）','crop-keep':'切り抜き・位置を保持（ピボット移動）',crop:'切り抜き（サイズと位置を破棄）'},
  rotation:'回転を許可',rotationHint:'一部のスプライトを 90° 回転して詰めます。回転領域を読めるエンジンだけが受け付けます。',
  sizeMode:'ページサイズ',size:{auto:'最小',pot:'2 のべき乗',square:'正方形','pot-square':'2 のべき乗・正方形',fixed:'固定'},
  fixedW:'幅',fixedH:'高さ',multipleOf:'サイズの倍数',algorithm:'アルゴリズム',alg:{maxrects:'MaxRects',skyline:'Skyline',guillotine:'Guillotine'},
  heuristic:'配置ルール',heur:{best:'すべて試して最小を採用',bssf:'短辺ベストフィット',blsf:'長辺ベストフィット',baf:'面積ベストフィット',bl:'左下',cp:'接触点',waste:'最小の無駄'},
  effort:'探索の強さ',eff:{fast:'速い',normal:'標準',best:'最良（遅い）'},multipack:'マルチパック（複数ページ）',maxPages:'最大ページ数',
  alpha:'アルファしきい値',alphaHint:'トリム時、アルファがこの値以下のピクセルは空とみなします（0 = 見えるピクセルはすべて保持）',
  dedupe:'同一フレームは一度だけ保存',premultiply:'乗算済みアルファ',premultiplyHint:'エンジンが乗算済みテクスチャを使う場合のみ',scales:'倍率バリエーション',scaleHint:'ニアレストネイバーなのでピクセルアートはくっきりのまま。各バリエーションは @2x 形式の名前の別アトラスになります。',
  packing:'パック中…',phase:{decode:'画像を読み込み中…',sprites:'フレームをトリム・比較中…',layout:'配置を試行中… {tried}',repack:'書き出し用の設定でパック中…',png:'{page} ページを書き込み中…',frames:'{name} を書き込み中…',zip:'ZIP を作成中…',video:'{name} の動画をエンコード中…'},
  cancel:'中止',cancelled:'パックを中止しました。',noFrames:'他のワークスペースで画像を読み込むかフレームを切り出すと、ここでパックされます。',
  page:'{n} ページ',pageOf:'{total} ページ中 {n}',variant:'@{s}x',stats:'{w}×{h} px · 使用率 {eff}%',
  totals:'{frames} フレーム · 保存 {unique} · 同一 {aliases} · {pages} ページ · 使用率 {eff}% · {ms} ms',rules:'配置: {alg} / {heur} / {sort} 順',
  aliasNote:'{n} 個のフレームが他のフレームとピクセル単位で同一のため、同じ領域を共有します。',
  implicit:'まだタグがありません：エンジンには {n} フレームすべてを {fps} fps で再生するアニメーション「{name}」が 1 つ入ります。スプライトのワークスペースでタグを付けて名前を付けてください。',
  warnings:'注意',
  exportName:'ファイル名',exportFor:'{name} 向けに書き出す',export:'書き出す',exporting:'{name} を書き出し中…',exported:'{file} をダウンロードしました（{n} ファイル）。',
  groups:{engine:'エンジン',data:'データ形式',anim:'アニメーション'},
  verify:{verified:'{engine} で読み込みを確認',parsed:'{engine} でビルドを確認',decoded:'{engine} でデコードを確認',unverified:'未検証 — この環境のエンジンでは読み込んでいません'},
  changed:'{name} 向けの書き出しは {what} でパックします（エンジンに必要）。',
  lastExport:'前回の書き出し',files:'{n} ファイル',frameRow:'{w}×{h} → {sw}×{sh}',flags:{trimmed:'トリム済み',rotated:'回転',alias:'{name} と同一'},
  onPage:'{n} ページ',selectHint:'選択はタイムラインと共有されます。',
  webmOnly:'WebM には WebCodecs 対応ブラウザ（Chrome、Edge）が必要です。',
  exportTarget:'書き出し先',allFormats:'すべての形式（{n}）',memory:'読み込み時のテクスチャメモリ {mb} MB（RGBA8888）',
  chg:{allowRotation:{false:'回転なし',true:'回転'},trimMode:{none:'トリムなし',trim:'トリム',"crop-keep":'切り抜き・位置保持',crop:'切り抜き'},multipack:{false:'1 ページ',true:'マルチパック'}}
 }
}};
const merge=(a,b)=>{for(const [k,v] of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)){a[k]=a[k]&&typeof a[k]==='object'?a[k]:{};merge(a[k],v);}else a[k]=v;}return a;};
for(const l of Object.keys(S))merge(STUDIO_STRINGS[l]||(STUDIO_STRINGS[l]={}),S[l]);
export const PACK_STRINGS=S;
