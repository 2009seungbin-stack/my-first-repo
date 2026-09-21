import {imagePlan} from './resources.js';
import {getLocale} from './i18n.js';
/** Product decision before large allocations, not a global device-independent cap. */
export async function chooseImagePlan(source,w,h){
 const plan=imagePlan(source.width,source.height,w,h);if(!plan.large)return plan.preset;
 const words={en:['Large image job','Estimated working memory','This estimate excludes browser, GPU and encoder overhead. Use smaller tiles to reduce temporary memory.','Memory saver','Continue','Cancel'],ko:['큰 이미지 작업','예상 작업 메모리','브라우저·GPU·인코더의 추가 메모리는 제외한 추정치입니다. 작은 타일을 사용하면 임시 메모리를 줄일 수 있습니다.','메모리 절약','계속','취소'],ja:['大きな画像の処理','作業メモリの推定','ブラウザ・GPU・エンコーダーの追加メモリは含みません。小さいタイルで一時メモリを削減できます。','メモリ節約','続行','キャンセル']}[getLocale()];
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label',words[0]);
 const heading=document.createElement('h2');heading.textContent=words[0];dialog.append(heading);
 for(const text of [`${source.width} × ${source.height} → ${w} × ${h}`,`${words[1]}: ${(plan.estimatedBytes/1024**2).toFixed(0)} MiB`,words[2]]){const p=document.createElement('p');p.textContent=text;dialog.append(p);}
 const result=new Promise(resolve=>{
  const finish=value=>{dialog.close();dialog.remove();resolve(value);};dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);},{once:true});
  for(const [label,value] of [[words[3],'memory-saver'],[words[4],'balanced'],[words[5],null]]){const b=document.createElement('button');b.textContent=label;b.className='secondary';b.onclick=()=>finish(value);dialog.append(b);}
 });document.body.append(dialog);dialog.showModal();const preset=await result;
 if(!preset)throw new DOMException('Cancelled','AbortError');return preset;
}
