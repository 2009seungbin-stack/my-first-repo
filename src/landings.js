/** Search-intent landing pages. Each one is the real tool opened with a real preset (target
 * format, file size or exact dimensions) plus copy that is specific to that task — never a
 * duplicate of the base page. A landing inherits its base tool's indexing decision: if the
 * tool is not qualified for search (src/capabilities.js), neither is the landing.
 * Dependency-free: shared by the static build, the browser and tests. */
const F={png:'PNG',jpeg:'JPG',webp:'WebP',avif:'AVIF',bmp:'BMP',heic:'HEIC',mp4:'MP4',mov:'MOV',webm:'WebM',pdf:'PDF',gif:'GIF',mp3:'MP3'};
const NOTE={
 png:{ko:'PNG는 무손실이고 투명 배경을 지원해 로고·스크린샷·그래픽에 적합하지만 사진은 용량이 큽니다.',en:'PNG is lossless and supports transparency — ideal for logos, screenshots and graphics, but large for photos.',ja:'PNGは可逆圧縮で透明に対応し、ロゴ・スクリーンショット向きですが写真は容量が大きくなります。'},
 jpeg:{ko:'JPG는 사진에 가장 널리 쓰이는 손실 압축 형식으로 용량이 작지만 투명 배경이 없습니다.',en:'JPG is the most widely supported lossy format for photos: small files, but no transparency.',ja:'JPGは写真で最も広く使われる非可逆形式で、容量は小さいものの透明は扱えません。'},
 webp:{ko:'WebP는 같은 화질에서 JPG·PNG보다 대체로 작고 투명 배경도 지원하는 웹용 형식입니다.',en:'WebP is a web format that is usually smaller than JPG or PNG at similar quality and also supports transparency.',ja:'WebPは同程度の画質でJPG・PNGより小さくなりやすく、透明にも対応するWeb向け形式です。'},
 avif:{ko:'AVIF는 압축률이 매우 높은 최신 형식이지만 일부 프로그램·사이트에서 아직 열리지 않습니다.',en:'AVIF compresses very efficiently but some apps and upload forms still cannot open it.',ja:'AVIFは圧縮率が非常に高い新しい形式ですが、まだ開けないアプリやサイトがあります。'},
 bmp:{ko:'BMP는 압축하지 않은 오래된 형식이라 용량이 매우 큽니다.',en:'BMP is an old, uncompressed format, so files are very large.',ja:'BMPは非圧縮の古い形式で、容量が非常に大きくなります。'},
 heic:{ko:'HEIC는 아이폰 기본 사진 형식으로 윈도우나 웹사이트에서 열리지 않는 경우가 많습니다.',en:'HEIC is the default iPhone photo format and often cannot be opened on Windows or by websites.',ja:'HEICはiPhoneの標準写真形式で、Windowsやサイトで開けないことがよくあります。'},
 mp4:{ko:'MP4는 휴대폰·카메라·편집 프로그램이 가장 많이 쓰는 영상 형식입니다.',en:'MP4 is the video format used by most phones, cameras and editors.',ja:'MP4はスマホ・カメラ・編集ソフトで最も使われる動画形式です。'},
 mov:{ko:'MOV는 아이폰·맥에서 주로 만들어지는 영상 형식이며 안의 코덱에 따라 브라우저 지원이 달라집니다.',en:'MOV is common on iPhone and Mac; browser support depends on the codec inside.',ja:'MOVはiPhone・Macでよく作られる形式で、中のコーデックによりブラウザ対応が変わります。'},
 webm:{ko:'WebM은 웹용 공개 영상 형식으로 크롬·파이어폭스에서 잘 재생됩니다.',en:'WebM is an open web video format that plays well in Chrome and Firefox.',ja:'WebMはWeb向けのオープンな動画形式で、Chrome・Firefoxでよく再生されます。'}
};
const PRIVATE={ko:'파일은 서버로 업로드되지 않고 이 브라우저 안에서만 처리됩니다.',en:'Your file is never uploaded — it is processed inside this browser.',ja:'ファイルはサーバーにアップロードされず、このブラウザ内だけで処理されます。'};
const L=['ko','en','ja'];
const per=fn=>Object.fromEntries(L.map(l=>[l,fn(l)]));
function convert(from,to,intent='convert'){
 const A=F[from],B=F[to],alpha=['png','webp','avif','heic'].includes(from)&&to==='jpeg';
 return {intent,query:`format=${to}`,text:per(l=>({
  title:{ko:`${A} ${B} 변환`,en:`${A} to ${B} converter`,ja:`${A}を${B}に変換`}[l],
  headline:{ko:`${A}를 ${B}로 바꿔보세요`,en:`Turn ${A} into ${B}`,ja:`${A}を${B}にしよう`}[l],
  description:{ko:`${A} 이미지를 ${B}로 무료 변환. 가입·업로드 없이 브라우저에서 바로.`,en:`Convert ${A} images to ${B} for free, right in your browser — no sign-up, no upload.`,ja:`${A}画像を${B}に無料変換。登録・アップロード不要でブラウザだけで完結。`}[l],
  intro:[NOTE[from]?.[l],NOTE[to]?.[l],alpha?{ko:`${B}는 투명 영역을 지원하지 않아 흰색 등 배경색으로 채워집니다. 투명이 필요하면 PNG나 WebP를 선택하세요.`,en:`${B} has no transparency, so transparent areas are filled with a background colour. Choose PNG or WebP to keep them.`,ja:`${B}は透明を扱えないため、透明部分は背景色で塗られます。透明を残すならPNGかWebPを選んでください。`}[l]:'',PRIVATE[l]].filter(Boolean)
 }))};
}
function compress(kb){
 const size=kb>=1000?`${kb/1000}MB`:`${kb}KB`;
 return {intent:'compress',query:`kb=${kb}`,text:per(l=>({
  title:{ko:`이미지 ${size} 이하로 줄이기`,en:`Compress image to ${size}`,ja:`画像を${size}以下に圧縮`}[l],
  headline:{ko:`${size} 이하로 맞춰보세요`,en:`Get it under ${size}`,ja:`${size}以下にしよう`}[l],
  description:{ko:`사진·이미지 용량을 ${size} 이하로 압축. 제출 서류·쇼핑몰·커뮤니티 업로드 용량 제한에 맞추세요.`,en:`Shrink a photo or image to ${size} or less for upload limits on forms, shops and communities.`,ja:`写真・画像を${size}以下に圧縮。申請書類・ショップ・掲示板の容量制限に合わせられます。`}[l],
  intro:[{ko:`목표 용량 ${size}에 맞을 때까지 여러 품질·형식 후보를 만들고, 실제 결과를 다시 열어 화질(SSIM)을 비교해 가장 좋은 것을 고릅니다. 결과 파일 크기를 다운로드 전에 확인할 수 있습니다.`,en:`Several quality and format candidates are encoded until one fits ${size}; each result is decoded again and compared (SSIM) so the best-looking one wins. You see the real file size before downloading.`,ja:`${size}に収まるまで品質・形式の候補を作り、実際の結果を再度開いて画質（SSIM）を比べ、最良のものを選びます。保存前に実際の容量を確認できます。`}[l],
   {ko:'해상도는 기본적으로 유지합니다. 용량을 도저히 맞출 수 없을 때만 크기 줄이기를 직접 켜세요.',en:'Resolution is kept by default. Only if the target cannot be reached, opt in to shrinking the dimensions.',ja:'解像度は原則そのまま。どうしても収まらない場合だけ、縮小を自分でオンにしてください。'}[l],PRIVATE[l]]
 }))};
}
function resize(name,w,h){
 return {intent:'resize',query:`w=${w}&h=${h}&fit=cover`,text:per(l=>({
  title:{ko:`${name[l]} 크기 (${w}×${h}) 맞추기`,en:`Resize for ${name[l]} (${w}×${h})`,ja:`${name[l]}サイズ（${w}×${h}）に変更`}[l],
  headline:{ko:`${name[l]}에 딱 맞게`,en:`Exactly right for ${name[l]}`,ja:`${name[l]}にぴったり`}[l],
  description:{ko:`${name[l]} 권장 크기 ${w}×${h} 픽셀로 이미지 크기를 바꾸세요. 무료, 업로드 없음.`,en:`Resize any image to the ${w}×${h} px size recommended for ${name[l]}. Free, no upload.`,ja:`${name[l]}推奨の${w}×${h}pxに画像サイズを変更。無料・アップロード不要。`}[l],
  intro:[{ko:`가로 ${w}, 세로 ${h} 픽셀(비율 ${ratio(w,h)})로 미리 설정되어 있습니다. 비율이 다른 사진은 가운데를 기준으로 잘라 꽉 채우며(cover), 여백을 넣고 싶으면 맞춤(contain)으로 바꾸면 됩니다.`,en:`Preset to ${w}×${h} px (${ratio(w,h)}). Photos with a different ratio are centre-cropped to fill the frame (cover); switch to contain to add margins instead.`,ja:`横${w}・縦${h}px（比率${ratio(w,h)}）に設定済みです。比率が違う写真は中央基準で切り抜いて埋め（cover）、余白を入れたい場合はcontainに切り替えます。`}[l],
   {ko:'고품질 Lanczos 계열 리샘플링으로 줄이거나 늘리며, 플랫폼 권장 크기는 바뀔 수 있으니 업로드 전 해당 서비스 안내도 확인하세요.',en:'High-quality Lanczos-family resampling is used. Platforms change their recommendations, so check their current guidance before posting.',ja:'高品質なLanczos系リサンプリングを使います。推奨サイズは変わることがあるため、投稿前に各サービスの案内も確認してください。'}[l],PRIVATE[l]]
 }))};
}
function ratio(w,h){const g=(a,b)=>b?g(b,a%b):a,d=g(w,h);return `${w/d}:${h/d}`;}
function video(from,to){
 const intent=to==='gif'?'video-gif':'video-mp3',A=F[from],B=F[to];
 return {intent,query:'',text:per(l=>({
  title:{ko:`${A} ${B} 변환`,en:`${A} to ${B}`,ja:`${A}を${B}に変換`}[l],
  headline:{ko:to==='gif'?`${A}의 한 장면을 GIF로`:`${A}에서 소리만 ${B}로`,en:to==='gif'?`Turn a moment of ${A} into a GIF`:`Pull the audio out of ${A} as ${B}`,ja:to==='gif'?`${A}の一場面をGIFに`:`${A}から音声だけ${B}で`}[l],
  description:{ko:`${A} 영상을 ${B}로 무료 변환. 구간을 골라 브라우저에서 바로 만들고 업로드는 없습니다.`,en:`Convert ${A} video to ${B} for free — pick the range and create it in your browser, no upload.`,ja:`${A}動画を${B}に無料変換。区間を選んでブラウザで作成、アップロード不要。`}[l],
  intro:[NOTE[from][l],to==='gif'?{ko:'GIF는 너비·초당 프레임·색상 수에 따라 용량이 크게 달라집니다. 짧은 구간과 작은 너비가 공유하기 좋습니다.',en:'GIF size depends heavily on width, frame rate and colours; short clips at a modest width share best.',ja:'GIFは幅・フレームレート・色数で容量が大きく変わります。短い区間と控えめな幅が共有に向いています。'}[l]:{ko:'오디오 트랙을 디코딩해 MP3로 인코딩합니다. 영상 파일 안의 오디오 코덱을 브라우저가 지원해야 합니다.',en:'The audio track is decoded and encoded to MP3; the browser must support the audio codec inside the file.',ja:'音声トラックをデコードしてMP3にエンコードします。ファイル内の音声コーデックにブラウザが対応している必要があります。'}[l],PRIVATE[l]]
 }))};
}
export const SOCIAL={
 'instagram-post':[{ko:'인스타그램 정사각 게시물',en:'Instagram square posts',ja:'Instagram正方形投稿'},1080,1080],
 'instagram-portrait':[{ko:'인스타그램 세로 게시물',en:'Instagram portrait posts',ja:'Instagram縦長投稿'},1080,1350],
 'instagram-story':[{ko:'인스타그램 스토리·릴스',en:'Instagram Stories and Reels',ja:'Instagramストーリーズ・リール'},1080,1920],
 'youtube-thumbnail':[{ko:'유튜브 썸네일',en:'YouTube thumbnails',ja:'YouTubeサムネイル'},1280,720],
 'youtube-banner':[{ko:'유튜브 채널 배너',en:'YouTube channel banners',ja:'YouTubeチャンネルバナー'},2560,1440],
 'x-header':[{ko:'X(트위터) 헤더',en:'X (Twitter) headers',ja:'X（Twitter）ヘッダー'},1500,500],
 'linkedin-banner':[{ko:'링크드인 배너',en:'LinkedIn banners',ja:'LinkedInバナー'},1584,396],
 'discord-banner':[{ko:'디스코드 서버 배너',en:'Discord server banners',ja:'Discordサーバーバナー'},960,540]
};
export const LANDINGS=Object.freeze({
 ...Object.fromEntries([['png','jpeg'],['jpeg','png'],['png','webp'],['webp','png'],['jpeg','webp'],['webp','jpeg'],['avif','jpeg'],['avif','png'],['bmp','png'],['bmp','jpeg']]
  .map(([a,b])=>[`image/${a==='jpeg'?'jpg':a}-to-${b==='jpeg'?'jpg':b}`,convert(a,b)])),
 'image/heic-to-png':convert('heic','png','heic'),
 ...Object.fromEntries([20,50,100,200,500,1000].map(kb=>[`image/compress-to-${kb>=1000?kb/1000+'mb':kb+'kb'}`,compress(kb)])),
 ...Object.fromEntries(Object.entries(SOCIAL).map(([slug,[name,w,h]])=>[`image/resize/${slug}`,resize(name,w,h)])),
 ...Object.fromEntries([['mp4','gif'],['mov','gif'],['webm','gif'],['mp4','mp3'],['mov','mp3'],['webm','mp3']].map(([a,b])=>[`video/${a}-to-${b}`,video(a,b)]))
});
export const LANDING_PATHS=Object.freeze(Object.keys(LANDINGS));
export const landingFor=path=>Object.hasOwn(LANDINGS,path)?LANDINGS[path]:null;
export function landingText(path,locale){const l=landingFor(path);return l?l.text[locale]||l.text.en:null;}
