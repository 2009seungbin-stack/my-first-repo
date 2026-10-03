import {priceSummary,parsePrice,localMoney} from './market.js';

export function mountHardwareTools(){
 const ko=document.documentElement.lang==='ko';
 for(const f of document.querySelectorAll('[data-hw-enable]'))f.disabled=false;
 const root=document.querySelector('[data-island="used-prices"]');
 if(root){
  const form=root.querySelector('form'),result=root.querySelector('[data-price-result]'),country=root.dataset.country;
  const empty=()=>{result.textContent=ko?'확인한 가격을 입력하면 결과가 여기에 표시됩니다.':'Your calculated results will appear here.';};
  form.addEventListener('reset',empty);form.addEventListener('input',empty);
  form.addEventListener('submit',e=>{
   e.preventDefault();const data=new FormData(form),s=priceSummary(String(data.get('prices')||''),country);result.replaceChildren();
   if(s.error){result.textContent=s.error==='empty'?(ko?'가격을 입력하세요.':'Enter prices.'):s.error==='limit'?(ko?'가격은 최대 200개입니다.':'Use up to 200 prices.'):(ko?`${s.lines.join(', ')}번째 입력값을 확인하세요. 한 줄에 현지 형식의 가격 하나를 넣으세요.`:`Check entries ${s.lines.join(', ')}. Use one price per line in local number format.`);return;}
   const heading=document.createElement('h3');heading.textContent=data.get('basis')==='sold'?(ko?'입력한 판매 완료 표시 가격':'Your sold displayed prices'):(ko?'입력한 판매 중 호가':'Your active asking prices');result.append(heading);
   const grid=document.createElement('dl');grid.className='hw-stats';
   for(const [label,value] of [[ko?'중앙값':'Median',localMoney(s.median,country)],[ko?'중앙 50% 범위 (Q1–Q3)':'Central 50% (Q1–Q3)',`${localMoney(s.q1,country)} – ${localMoney(s.q3,country)}`],[ko?'최솟값–최댓값':'Minimum–maximum',`${localMoney(s.min,country)} – ${localMoney(s.max,country)}`],[ko?'입력한 표본':'Your sample',String(s.count)]]){
    const box=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;box.append(dt,dd);grid.append(box);
   }result.append(grid);
   const note=document.createElement('p');note.className='fine';note.textContent=(s.count<5?(ko?'표본이 적습니다. ':'Small sample. '):'')+(ko?'입력 표본 기준 · 이상값 자동 제외 없음 · 시장 전체의 확정 시세가 아닙니다.':'Based on your inputs · no automatic outlier removal · not a definitive market price.');result.append(note);
  });
 }
 const value=document.querySelector('[data-island="hardware-value"]');
 if(value){
  const form=value.querySelector('form'),result=value.querySelector('[data-value-result]');
  form.addEventListener('input',()=>{result.textContent=ko?'가격이 바뀌었습니다. 다시 계산하세요.':'Prices changed. Recalculate.';});
  form.addEventListener('submit',e=>{
   e.preventDefault();const data=new FormData(form),a=parsePrice(String(data.get('price-a')||''),value.dataset.country),b=parsePrice(String(data.get('price-b')||''),value.dataset.country);
   if(a===null||b===null){result.textContent=ko?'A·B 모두 현지 형식으로 0보다 큰 구매 가격을 입력하세요.':'Enter positive purchase prices for both A and B in local format.';return;}
   const av=Number(value.dataset.a)/a,bv=Number(value.dataset.b)/b,ratio=Math.max(av,bv)/Math.min(av,bv);
   result.textContent=ko?`렌더링 성능/가격: ${av>=bv?'A':'B'}가 ${ratio.toFixed(2)}배. 입력한 구매 가격만 반영합니다.`:`Rendering score per price: ${av>=bv?'A':'B'} is ${ratio.toFixed(2)}×. Uses only your entered purchase prices.`;
  });
 }
  for(const input of document.querySelectorAll('[data-hw-filter]')){
  const select=input.form.querySelector(`select[name="${input.dataset.hwFilter}"]`),options=Array.from(select.options).map(o=>o.cloneNode(true));
  input.addEventListener('input',()=>{
   const current=select.value,words=input.value.toLowerCase().trim().split(/\s+/).filter(Boolean),matches=options.filter(o=>words.every(w=>o.textContent.toLowerCase().includes(w)));
   select.replaceChildren(...matches.map(o=>o.cloneNode(true)));
   if(matches.some(o=>o.value===current))select.value=current;
   input.setCustomValidity(matches.length?'':ko?'검색한 모델의 측정 결과가 없습니다.':'No measurements match this model.');
  });
 }
 const type=document.querySelector('[data-hw-type]');
 if(type)type.addEventListener('change',()=>{for(const s of type.form.querySelectorAll('select[name="a"],select[name="b"]'))s.disabled=true;});
}
