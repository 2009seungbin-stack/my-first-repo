/** Hints select a strategy; missing APIs never imply an unsupported tool. */
export function deviceCapabilities(scope=globalThis) {
 const n=scope.navigator||{};
 return {worker:typeof scope.Worker==='function',offscreenCanvas:typeof scope.OffscreenCanvas==='function',
  webgpu:!!n.gpu,webcodecs:typeof scope.VideoEncoder==='function'&&typeof scope.VideoDecoder==='function',
  sharedArrayBuffer:!!scope.crossOriginIsolated&&typeof scope.SharedArrayBuffer==='function',
  fileSystemAccess:typeof scope.showSaveFilePicker==='function',opfs:!!n.storage?.getDirectory,
  cores:Math.max(1,Number(n.hardwareConcurrency)||2),memoryGB:Number(n.deviceMemory)||null};
}
export function imagePlan(w,h,outW=w,outH=h,{capabilities=deviceCapabilities(),preset='balanced'}={}) {
 for(const n of [w,h,outW,outH])if(!Number.isSafeInteger(n)||n<1||n>65535)throw Error('Invalid image dimensions (1–65535).');
 const budget=(capabilities.memoryGB?Math.max(128,capabilities.memoryGB*128):512)*1024**2;
 const conservative=preset==='memory-saver'||capabilities.memoryGB!==null&&capabilities.memoryGB<=2;
 const tile=conservative?512:1024,concurrency=conservative?1:Math.min(2,capabilities.cores);
 // Source + destination + possible intermediate downscale + bounded RGBA/math tile buffers.
 const estimatedBytes=(w*h+outW*outH+Math.min(w*h,outW*outH))*4+tile*tile*32*concurrency;
 return {tile,concurrency,estimatedBytes,budget,large:estimatedBytes>budget,
  backend:capabilities.worker?'tiled-worker':'tiled-cpu',preset:conservative?'memory-saver':preset};
}
export function abort(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
export const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
export async function storageCapacity(){try{return await navigator.storage.estimate();}catch{return {usage:null,quota:null};}}
