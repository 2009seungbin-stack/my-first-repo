import {parsePrice} from './market.js';

export function mountHardwareTools(){
 const ko=document.documentElement.lang==='ko';
 for(const f of document.querySelectorAll('[data-hw-enable]'))f.disabled=false;
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
