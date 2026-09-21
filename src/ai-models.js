/** Pin weights independently of the runtime. No user image is sent to these hosts. */
export const AI_MODELS=Object.freeze({
 fastSR:{id:'CoderViking/realesr-general-x4v3-onnx',revision:'c6a971706797c7502945a2b4c4274fce4900d4ab',file:'realesr-general-x4v3.onnx',scale:4,license:'BSD-3-Clause',base:'xinntao/Real-ESRGAN v0.2.5.0'},
 sr2:{id:'Xenova/swin2SR-classical-sr-x2-64',revision:'93dfc9089abda257351d3a58d5771e2c1ff69442',file:'onnx/model.onnx',pad:8,scale:2,license:'Apache-2.0',base:'caidas/swin2SR-classical-sr-x2-64'},
 sr4:{id:'Xenova/swin2SR-classical-sr-x4-64',revision:'c60eac19ef391153929330791f241a7c861b3214',file:'onnx/model.onnx',pad:8,scale:4,license:'Apache-2.0',base:'caidas/swin2SR-classical-sr-x4-64'},
 matte:{id:'studioludens/birefnet-lite-512',revision:'4a3c40c36c94093cc1e724d9ea428b8fa4b57dc7',license:'MIT',base:'ZhengPeng7/BiRefNet_lite'}
});
