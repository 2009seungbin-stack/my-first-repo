import {t, setLocale} from './i18n.js';
import {quantize,removeConnected,addOutline,gif} from './core.js';
self.onmessage=async({data:m})=>{try{setLocale(m.locale);let result;if(m.kind==='pixel'){result=quantize(m.data,m.w,m.h,m.colors,m.dither);if(m.outline)result=addOutline(result,m.w,m.h,m.outline);}else if(m.kind==='remove')result=removeConnected(m.data,m.w,m.h,m.color,m.tolerance);else if(m.kind==='outline')result=addOutline(m.data,m.w,m.h,m.radius);else if(m.kind==='gif')result=gif(m.frames,m.w,m.h,m.delay);else if(m.kind==='portrait'){
 self.postMessage({progress:t("인물 모델을 내려받는 중… 첫 사용은 인터넷 연결이 필요합니다.")});
 const {AutoModel,AutoProcessor,RawImage,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
 env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
 const model=await AutoModel.from_pretrained('Xenova/modnet',{dtype:'fp32',device:'wasm',progress_callback:p=>{if(p.status==='progress')self.postMessage({progress:t("모델 다운로드 {0}%", {0: Math.round(p.progress||0)})});}}),processor=await AutoProcessor.from_pretrained('Xenova/modnet');
 const image=new RawImage(m.data,m.w,m.h,4);self.postMessage({progress:t("기기에서 인물과 배경을 분리하는 중…")});
 const {pixel_values}=await processor(image),prediction=await model({input:pixel_values}),mask=await RawImage.fromTensor(prediction.output[0].mul(255).to('uint8')).resize(m.w,m.h);
 result=new Uint8ClampedArray(m.data);for(let i=0;i<m.w*m.h;i++)result[i*4+3]=Math.round(result[i*4+3]*mask.data[i*mask.channels]/255);await model.dispose();
 }else throw Error(t("알 수 없는 작업입니다."));self.postMessage({result},[result.buffer]);}catch(e){self.postMessage({error:e.message||String(e)});}};
