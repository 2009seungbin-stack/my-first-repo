import {locale,onLocale,text,toast,download} from './shell.js';
import {inspect,strip,formatCoordinates,cleanName} from '../image-metadata.js';
/** Image metadata viewer and remover: lists what each JPEG, PNG or WebP file carries and saves a
 * copy without it. All parsing and rewriting is in src/image-metadata.js; this is the page. */
export const accept='.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const COPY={
 en:{drop:'Drop JPG, PNG or WebP photos here',dropHint:'See the location, camera and date they carry, then save clean copies',keepIcc:'Keep colour profile (ICC)',keepOrient:'Keep rotation flag',more:'Add more photos',options:'Removal options',
  unsupported:'This is not a JPEG, PNG or WebP file, so nothing was read.',readError:'This file could not be read.',damaged:'This file is damaged or cut off. Everything from the damaged part onwards is kept as it is.',
  location:'Location found',xmpLocation:'Location data is stored in the XMP block.',noLocation:'No GPS location in this file',altitude:'altitude {n} m',copy:'Copy coordinates',copied:'Coordinates copied.',
  camera:'Camera',lens:'Lens',taken:'Taken',modified:'Last saved',software:'Software',exposure:'Exposure',artist:'Author',copyright:'Copyright',description:'Description',owner:'Camera owner',serial:'Serial number',
  blocks:'Stored in this file',removed:'Will be removed',kept:'Kept',none:'No metadata blocks found.',tags:'{n} tags',thumb:'embedded thumbnail',gpsTags:'GPS',
  kind:{exif:'EXIF',xmp:'XMP',icc:'Colour profile (ICC)',iptc:'IPTC / Photoshop',comment:'Comment',text:'Text chunk',time:'Modification time',thumbnail:'Embedded thumbnail',other:'Other data block',trailing:'Data after the end of the image'},
  clean:'Download copy without metadata',clean0:'Already clean',nothing:'Nothing to remove with the current options.',done:'Saved {name}: {size} removed, pixels untouched.',orientNote:'The rotation flag was kept so the photo is not shown sideways.',failed:'The cleaned copy could not be verified, so nothing was saved.',summary:'{n} files read · {loc} with location'},
 ko:{drop:'JPG·PNG·WebP 사진을 여기에 놓으세요',dropHint:'사진에 담긴 위치·기기·촬영 시각을 확인하고 깨끗한 사본을 저장하세요',keepIcc:'색상 프로필(ICC) 유지',keepOrient:'회전 정보 유지',more:'사진 더 추가',options:'삭제 옵션',
  unsupported:'JPEG·PNG·WebP 파일이 아니어서 읽지 않았습니다.',readError:'파일을 읽지 못했습니다.',damaged:'파일이 손상되었거나 중간에 잘렸습니다. 손상된 부분부터는 그대로 둡니다.',
  location:'위치 정보가 있습니다',xmpLocation:'XMP 블록에 위치 정보가 들어 있습니다.',noLocation:'이 파일에는 GPS 위치가 없습니다',altitude:'고도 {n} m',copy:'좌표 복사',copied:'좌표를 복사했습니다.',
  camera:'카메라',lens:'렌즈',taken:'촬영 시각',modified:'마지막 저장',software:'소프트웨어',exposure:'노출',artist:'작성자',copyright:'저작권',description:'설명',owner:'카메라 소유자',serial:'일련번호',
  blocks:'이 파일에 저장된 정보',removed:'삭제 예정',kept:'유지',none:'메타데이터 블록이 없습니다.',tags:'태그 {n}개',thumb:'내장 썸네일',gpsTags:'GPS',
  kind:{exif:'EXIF',xmp:'XMP',icc:'색상 프로필(ICC)',iptc:'IPTC / Photoshop',comment:'주석',text:'텍스트 청크',time:'수정 시각',thumbnail:'내장 썸네일',other:'기타 데이터 블록',trailing:'이미지 끝 뒤에 붙은 데이터'},
  clean:'메타데이터 없는 사본 저장',clean0:'지울 정보 없음',nothing:'현재 옵션으로는 지울 정보가 없습니다.',done:'{name} 저장 완료: {size} 삭제, 픽셀은 그대로입니다.',orientNote:'사진이 옆으로 눕지 않도록 회전 정보는 남겼습니다.',failed:'정리한 사본을 확인하지 못해 저장하지 않았습니다.',summary:'파일 {n}개 확인 · 위치 정보 {loc}개'},
 ja:{drop:'JPG・PNG・WebPの写真をここにドロップ',dropHint:'写真に残る位置・カメラ・撮影日時を確認し、きれいなコピーを保存できます',keepIcc:'カラープロファイル（ICC）を残す',keepOrient:'回転情報を残す',more:'写真を追加',options:'削除オプション',
  unsupported:'JPEG・PNG・WebPではないため、読み取りませんでした。',readError:'ファイルを読み取れませんでした。',damaged:'ファイルが破損しているか途中で切れています。破損箇所より後ろはそのまま残します。',
  location:'位置情報があります',xmpLocation:'XMPブロックに位置情報が含まれています。',noLocation:'このファイルにGPS位置情報はありません',altitude:'高度 {n} m',copy:'座標をコピー',copied:'座標をコピーしました。',
  camera:'カメラ',lens:'レンズ',taken:'撮影日時',modified:'最終保存',software:'ソフトウェア',exposure:'露出',artist:'作成者',copyright:'著作権',description:'説明',owner:'カメラの所有者',serial:'シリアル番号',
  blocks:'このファイルに保存されている情報',removed:'削除します',kept:'残します',none:'メタデータのブロックはありません。',tags:'タグ {n}件',thumb:'埋め込みサムネイル',gpsTags:'GPS',
  kind:{exif:'EXIF',xmp:'XMP',icc:'カラープロファイル（ICC）',iptc:'IPTC / Photoshop',comment:'コメント',text:'テキストチャンク',time:'更新日時',thumbnail:'埋め込みサムネイル',other:'その他のデータブロック',trailing:'画像の終端より後ろのデータ'},
  clean:'メタデータなしのコピーを保存',clean0:'削除する情報なし',nothing:'現在のオプションでは削除する情報がありません。',done:'{name} を保存しました：{size} を削除、画素はそのままです。',orientNote:'写真が横向きにならないよう、回転情報は残しました。',failed:'処理したコピーを確認できなかったため、保存しませんでした。',summary:'{n}件のファイルを確認 · 位置情報あり {loc}件'}
};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tr=(k,vars={})=>{const c=COPY[locale()]||COPY.en,v=k.startsWith('kind.')?c.kind[k.slice(5)]:c[k];return String(v??k).replace(/\{(\w+)\}/g,(_,x)=>vars[x]??'');};
const MIME={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
export function mount({el}){
 const items=[],options={keepICC:true,keepOrientation:true};let seq=0;
 const link=document.createElement('link');link.rel='stylesheet';link.href='src/task/image-metadata.css';document.head.append(link);
 const num=n=>new Intl.NumberFormat(locale()).format(n);
 const size=n=>n<1024?`${num(n)} B`:n<1048576?`${num(Math.round(n/102.4)/10)} KB`:`${num(Math.round(n/10485.76)/100)} MB`;
 const date=s=>s.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1-$2-$3');
 const removes=kind=>kind!=='icc'||!options.keepICC;
 function facts(e){
  if(!e)return [];
  const exposure=[e.exposure?(e.exposure<1?`1/${Math.round(1/e.exposure)} s`:`${+e.exposure.toFixed(1)} s`):'',e.fNumber?`f/${+e.fNumber.toFixed(1)}`:'',e.iso?`ISO ${e.iso}`:'',e.focal?`${+e.focal.toFixed(1)} mm`:''].filter(Boolean).join(' · ');
  return [['camera',[e.make,e.model.startsWith(e.make)?e.model.slice(e.make.length).trim():e.model].filter(Boolean).join(' ')],['lens',e.lens],['taken',date(e.taken)],['modified',date(e.modified)],['software',e.software],['exposure',exposure],['artist',e.artist],['copyright',e.copyright],['description',e.description],['owner',e.owner],['serial',e.serial]].filter(([,v])=>v);
 }
 function card(it){
  const r=it.report,head=`<header><img src="${it.url}" alt="" width="72" height="72"><div><h2>${esc(it.file.name)}</h2><p>${r?.format?`${r.format.toUpperCase()} · ${num(r.width)} × ${num(r.height)} px · `:''}${size(it.file.size)}</p></div></header>`;
  if(!r||!r.format)return `<article class="im-card" data-id="${it.id}">${head}<p class="im-verdict im-bad" role="alert">${esc(tr(r?'unsupported':'readError'))}</p></article>`;
  const gps=r.exif?.gps,c=gps&&formatCoordinates(gps);
  const verdict=gps?`<p class="im-verdict im-warn"><strong>${esc(tr('location'))}</strong><span class="im-coords">${esc(c.decimal)}</span><span>${esc(c.dms)}${gps.altitude===null?'':' · '+esc(tr('altitude',{n:num(Math.round(gps.altitude))}))}</span><button type="button" class="ghost" data-copy="${esc(c.decimal)}">${esc(tr('copy'))}</button></p>`:r.location?`<p class="im-verdict im-warn"><strong>${esc(tr('location'))}</strong><span>${esc(tr('xmpLocation'))}</span></p>`:`<p class="im-verdict im-ok">${esc(tr('noLocation'))}</p>`;
  const list=facts(r.exif),dl=list.length?`<dl class="im-facts">${list.map(([k,v])=>`<div><dt>${esc(tr(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`:'';
  const detail=b=>b.kind==='exif'&&r.exif?[tr('tags',{n:num(r.exif.tags)}),r.exif.gpsTags?tr('gpsTags'):'',r.exif.thumbnail?tr('thumb'):''].filter(Boolean).join(' · '):[b.label,b.text].filter(Boolean).join(': ');
  const rows=r.blocks.map(b=>`<li><span class="im-kind">${esc(tr('kind.'+b.kind))}</span><span class="im-detail">${esc(detail(b))}</span><span class="im-size">${size(b.bytes)}</span><span class="im-state ${removes(b.kind)?'im-out':'im-in'}">${esc(tr(removes(b.kind)?'removed':'kept'))}</span></li>`).join('');
  const removable=r.blocks.some(b=>removes(b.kind));
  return `<article class="im-card" data-id="${it.id}">${head}${verdict}${r.damaged?`<p class="im-verdict im-bad">${esc(tr('damaged'))}</p>`:''}${dl}<h3>${esc(tr('blocks'))}</h3>${rows?`<ul class="im-blocks">${rows}</ul>`:`<p class="im-note">${esc(tr('none'))}</p>`}<div class="im-actions"><button type="button" class="primary auto" data-clean="${it.id}"${removable?'':' disabled'}>${esc(tr(removable?'clean':'clean0'))}</button><p class="im-result" role="status">${esc(it.result?tr('done',it.result)+(it.result.orient?' '+tr('orientNote'):''):removable?'':tr('nothing'))}</p></div></article>`;
 }
 function render(){
  if(!items.length){el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(tr('drop'))}</strong><span>${esc(tr('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;return;}
  const read=items.filter(it=>it.report?.format);
  el.innerHTML=`<section class="im"><div class="im-bar"><fieldset><legend>${esc(tr('options'))}</legend><label><input type="checkbox" id="imIcc"${options.keepICC?' checked':''}><span>${esc(tr('keepIcc'))}</span></label><label><input type="checkbox" id="imOrient"${options.keepOrientation?' checked':''}><span>${esc(tr('keepOrient'))}</span></label></fieldset><button type="button" class="ghost" data-action="pick">${esc(tr('more'))}</button></div><p class="im-summary" role="status">${esc(tr('summary',{n:num(read.length),loc:num(read.filter(it=>it.report.location).length)}))}</p>${items.map(card).join('')}</section>`;
 }
 async function clean(it,button){
  button.disabled=true;
  try{
   const out=strip(it.bytes,options),blob=new Blob([out.bytes],{type:MIME[it.report.format]});
   // The copy must still open as a picture of the same size before it is offered.
   const bitmap=await createImageBitmap(blob);const w=it.report.width,h=it.report.height,same=!w||bitmap.width===w&&bitmap.height===h||bitmap.width===h&&bitmap.height===w;bitmap.close?.();
   if(!same||inspect(out.bytes).blocks.some(b=>!(b.kind==='icc'&&options.keepICC||b.kind==='exif'&&out.orientationKept)))throw new Error('verify');
   const name=cleanName(it.file.name,it.report.format);download(blob,name);it.result={name,size:size(it.bytes.length-out.bytes.length),orient:out.orientationKept};
  }catch{it.result=null;toast(tr('failed'),{error:true});}
  render();el.querySelector(`[data-clean="${it.id}"]`)?.focus();
 }
 el.addEventListener('click',e=>{
  const copy=e.target.closest('[data-copy]'),btn=e.target.closest('[data-clean]');
  if(copy)navigator.clipboard?.writeText(copy.dataset.copy).then(()=>toast(tr('copied')),()=>{});
  else if(btn){const it=items.find(x=>x.id===Number(btn.dataset.clean));if(it)clean(it,btn);}
 });
 el.addEventListener('change',e=>{if(e.target.id==='imIcc'||e.target.id==='imOrient'){const id=e.target.id;options.keepICC=el.querySelector('#imIcc').checked;options.keepOrientation=el.querySelector('#imOrient').checked;for(const it of items)it.result=null;render();el.querySelector('#'+id)?.focus();}});
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 onLocale(render);render();
 return {async add(files){
  for(const file of files){
   const it={id:++seq,file,url:URL.createObjectURL(file),bytes:null,report:null,result:null};
   try{it.bytes=new Uint8Array(await file.arrayBuffer());it.report=inspect(it.bytes);}catch{}
   items.push(it);
  }
  render();el.querySelector(`[data-id="${items[items.length-files.length]?.id}"]`)?.scrollIntoView?.({block:'nearest'});
 }};
}
