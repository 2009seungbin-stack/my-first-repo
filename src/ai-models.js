/** Pin weights independently of the runtime. No user image is sent to these hosts. */
const MATTE={
 // Small first-pass matte (4.6 MB): shown within seconds while the full model is fetched once.
 quick:{key:'quick',id:'BritishWerewolf/U-2-Netp',revision:'7112208dbac3a3642496c8d54e2f0f9bb3dc1dc8',file:'onnx/model.onnx',size:320,output:'minmax',cpuFirst:true,license:'Apache-2.0',base:'xuebinqin/U-2-Net (u2netp)',bytes:4574861},
 // BiRefNet-lite at 512 px (the 2025 default; kept for comparison and as a fallback choice).
 lite512:{key:'lite512',id:'studioludens/birefnet-lite-512',revision:'4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7',file:'onnx/model.onnx',size:512,output:'logits',license:'MIT',base:'ZhengPeng7/BiRefNet_lite',bytes:191877254},
 // BiRefNet-lite at its native 1024 px, fp16 weights (115 MB).
 lite1024:{key:'lite1024',id:'onnx-community/BiRefNet_lite-ONNX',revision:'de15b22ba131738a16dff04aab8bdf8dc32e3ac1',file:'onnx/model_fp16.onnx',size:1024,output:'logits',license:'MIT',base:'ZhengPeng7/BiRefNet_lite',bytes:114538221},
 // BEN2 base, fp16 weights (219 MB): best measured on the AI-300 truth set (docs/ai-bench/RESULTS.md).
 ben2:{key:'ben2',id:'onnx-community/BEN2-ONNX',revision:'c552aa82688edce09f0ac9d2e31ad53d9d629010',file:'onnx/model_fp16.onnx',size:1024,output:'prob',license:'MIT',base:'PramaLLC/BEN2',bytes:219121675},
};
export const AI_MODELS=Object.freeze({
 fastSR:{id:'CoderViking/realesr-general-x4v3-onnx',revision:'c6a971706797c7502945a2b4c4274fce4900d4ab',file:'realesr-general-x4v3.onnx',scale:4,license:'BSD-3-Clause',base:'xinntao/Real-ESRGAN v0.2.5.0'},
 sr2:{id:'Xenova/swin2SR-classical-sr-x2-64',revision:'93dfc9089abda257351d3a58d5771e2c1ff69442',file:'onnx/model.onnx',pad:8,scale:2,license:'Apache-2.0',base:'caidas/swin2SR-classical-sr-x2-64'},
 sr4:{id:'Xenova/swin2SR-classical-sr-x4-64',revision:'c60eac19ef391153929330791f241a7c861b3214',file:'onnx/model.onnx',pad:8,scale:4,license:'Apache-2.0',base:'caidas/swin2SR-classical-sr-x4-64'},
 matteQuick:MATTE.quick,
 // The default ("best") cut-out model.
 matte:MATTE.lite512,
 matteModels:MATTE,
});
/** Spec of a matte model: 'best' (default), 'quick', or a key of AI_MODELS.matteModels. */
export const matteSpec=model=>model==='quick'?MATTE.quick:model==='best'||!MATTE[model]?AI_MODELS.matte:MATTE[model];
