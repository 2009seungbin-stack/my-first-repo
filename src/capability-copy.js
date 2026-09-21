// Visible capability copy is shared by static guides and the running app.
import {CAPABILITIES} from './capabilities.js';
const choose=(locale,values)=>values[{en:0,ko:1,ja:2}[locale]??0];
export function capabilityGuide(id,locale){const c=CAPABILITIES[id];let key;
 if(['media','video-trim','video-compress','video-mp3','video-gif','video-frame'].includes(id))key='media';
 else if(id.startsWith('pdf')||id==='jpg-to-pdf')key='pdf';
 else if(['image','resize','upscale','remove-bg','compress'].includes(id))key=id;
 if(!key)return null;
 const common=choose(locale,[['Open the source file|Choose the processing mode and settings|Run, inspect the result and download','What determines the supported size?','Actual device memory, storage and codec support. Tested examples are evidence, not a guarantee for every file.'],['원본 파일 열기|처리 방식과 설정 선택|실행 후 결과를 확인하고 다운로드','처리 가능한 크기는 무엇으로 결정되나요?','기기 메모리·저장 공간·코덱 지원에 따라 달라집니다. 테스트한 사례가 모든 파일의 성공을 보장하지는 않습니다.'],['元ファイルを開く|処理方式と設定を選ぶ|実行して結果を確認し保存','対応サイズは何で決まりますか？','端末のメモリ・保存容量・コーデック対応によります。テスト例はすべてのファイルの動作保証ではありません。']]);
 const feature={
 image:['Non-destructive crop, rotation and resize history; separate preview proxies.','자르기·회전·크기 변경 이력을 원본과 분리하고 작은 미리보기를 사용합니다.','切り抜き・回転・サイズ変更の履歴を元画像と分離し、小さいプレビューを使います。'],
 resize:['Tiled high-quality mks2013/Lanczos resampling, numeric dimensions and size helpers.','타일 기반 mks2013·Lanczos 보간, 정확한 크기와 비율·긴 변·메가픽셀 설정을 제공합니다.','タイル型mks2013・Lanczos補間と数値サイズ・比率・長辺・画素数の設定。'],
 upscale:['Classical tiled resampling, nearest pixel scaling, and optional experimental ML super-resolution at 2× or 4×.','고품질 타일 보간·픽셀 정수배 확대와 별도 실험적 ML 2배·4배 초해상도를 제공합니다.','高品質タイル補間・ピクセル拡大と、任意の実験的ML 2倍・4倍超解像。'],
 'remove-bg':['Border-connected color removal and an optional BiRefNet person/object model; full-resolution alpha output.','가장자리와 연결된 단색 제거와 선택형 BiRefNet 사람·사물 모델을 제공하며 원본 크기의 투명도를 출력합니다.','端からつながる単色除去と任意のBiRefNet人物・物体モデル。元解像度のアルファ出力。'],
 compress:['Auto compares actual browser codec outputs using a sampled visual metric and target-size search. Alpha-aware format selection; optional dimension reduction.','Auto가 실제 코덱 결과의 표본 품질을 비교하며 목표 크기를 탐색합니다. 투명도를 고려하고 선택 시 해상도도 줄입니다.','Autoが実際のコーデック出力の標本品質を比較し目標容量を探索します。透過を考慮し、任意でサイズを縮小。'],
 pdf:['Native page copying, range/group splitting, vector/text/image annotations and selective embedded JPEG compression. Full-page raster compression is a separate option.','원본 페이지 복사, 범위·그룹 분할, 글자·벡터·이미지 주석과 내장 JPEG 최적화를 제공합니다. 페이지 전체를 이미지로 바꾸는 압축은 별도 옵션입니다.','ページのコピー、範囲・グループ分割、文字・ベクター・画像注釈と埋め込みJPEG最適化。全ページ画像化は別の選択肢です。'],
 media:['Ranged file reads, keyframe Fast cut or WebCodecs Precise mode, detected MP4/WebM encoding, configurable audio and sequential GIF frames. Frame export retains source resolution when decoding permits.','파일을 구간별로 읽어 빠른 키프레임 자르기 또는 WebCodecs 정밀 처리를 수행합니다. 지원 확인 후 MP4·WebM을 저장하며 오디오·GIF 설정과 원본 크기 프레임 추출을 제공합니다.','ファイルを範囲読み込みし、高速キーフレームカットまたはWebCodecs精密処理を行います。対応確認後にMP4・WebMを保存し、音声・GIF設定と元解像度フレーム抽出を提供します。']
 }[key];
 const limit=key==='pdf'?choose(locale,['Preserve mode retains native text/search/vectors; forms flatten and signatures are not retained. Raster mode removes searchable text. The writer still parses full documents in a Worker.','보존 모드는 원문 글자·검색·벡터를 유지하지만 양식은 평면화되고 서명은 보존되지 않습니다. 이미지 모드는 글자 검색을 잃습니다. 쓰기 엔진은 Worker에서 문서 전체를 읽습니다.','保持モードは元の文字・検索・ベクターを維持しますが、フォームは平面化され署名は保持しません。画像化では検索を失います。WriterはWorkerで文書全体を読み込みます。']):key==='media'?choose(locale,['Fast cut shrinks to inner keyframes. Precise mode re-encodes; codec availability varies. Temporary outputs use local browser storage when available. Compatibility recording retains its short-clip limits.','빠른 자르기는 범위 안쪽 키프레임으로 줄어듭니다. 정밀 모드는 재인코딩하며 코덱 지원은 다릅니다. 가능하면 결과를 기기 내 임시 저장소에 씁니다. 호환 녹화 모드의 짧은 구간 제한은 유지됩니다.','高速カットは範囲内のキーフレームに短縮します。精密モードは再エンコードし、コーデック対応は環境次第です。可能なら端末の一時保存を使います。互換録画の短時間制限は残ります。']):key==='upscale'||key==='remove-bg'?choose(locale,['ML modes are experimental and download models on demand. Broad subject, edge and 8K ML quality acceptance is incomplete. Classical fallback is explicitly identified.','ML 모드는 모델을 필요할 때 내려받는 실험 기능입니다. 다양한 피사체·경계·8K ML 품질 검증은 아직 완료되지 않았습니다. 일반 보간으로 대체한 경우 결과에 표시합니다.','MLモードは必要時にモデルを取得する実験機能です。多様な被写体・輪郭・8K ML品質の検証は未完了です。通常補間への切り替えは結果に表示します。']):common[2];
 const focus={
 'pdf-merge':['Combine source page objects in the chosen order.','원본 페이지 객체를 선택한 순서로 합칩니다.','元のページを選んだ順番に結合します。'],
 'pdf-split':['Export page ranges, each page, every N pages, odd/even pages or custom groups.','범위·페이지마다·N페이지마다·홀짝·직접 지정 그룹으로 나눕니다.','範囲・各ページ・Nページ・奇偶・カスタムグループに分割します。'],
 'pdf-compress':['Optimize compatible embedded JPEG images while retaining text and vector objects.','글자·벡터 객체를 유지하며 호환되는 내장 JPEG를 최적화합니다.','文字・ベクターを維持し、対応する埋め込みJPEGを最適化します。'],
 'jpg-to-pdf':['Place source images on PDF pages in order.','원본 이미지를 순서대로 PDF 페이지에 넣습니다.','元画像を順番にPDFページへ配置します。'],
 'pdf-to-jpg':['Render selected pages sequentially at your chosen maximum side.','선택한 페이지를 지정한 긴 변 크기로 순차 렌더링합니다.','選択ページを指定した最大辺で順番に描画します。'],
 'video-trim':['Choose inner-keyframe remux or decoded and re-encoded interval export.','안쪽 키프레임 재포장 또는 디코딩·재인코딩으로 구간을 저장합니다.','内側キーフレームの再格納、または再エンコードで区間を保存します。'],
 'video-compress':['Control bitrate, dimensions and FPS; target-size estimates account for duration and audio.','비트레이트·해상도·FPS를 조절하며 길이와 오디오를 반영해 목표 크기를 추정합니다.','ビットレート・解像度・FPSを調整し、長さと音声から目標容量を推定します。'],
 'video-mp3':['Extract audio incrementally with selectable 96–320 kbit/s MP3 or PCM WAV.','오디오를 순차 추출해 96~320kbps MP3 또는 PCM WAV로 저장합니다.','音声を順次抽出し、96〜320kbps MP3またはPCM WAVで保存します。'],
 'video-gif':['Decode one frame at a time; choose GIF width, FPS, palette size and dithering.','프레임을 하나씩 읽고 GIF 너비·FPS·색상 수·디더링을 선택합니다.','1フレームずつ読み、GIFの幅・FPS・色数・ディザを選択します。'],
 'video-frame':['Export the decoded frame at source resolution; preview size does not constrain output.','미리보기 크기와 별개로 디코딩한 장면을 원본 해상도로 저장합니다.','プレビューサイズとは別に、デコードしたフレームを元解像度で保存します。']
 }[id];
 return [common[0],choose(locale,focus||feature),limit,common[1],common[2]+' '+c.maturity];
}
