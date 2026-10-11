/** "Is there a person in this picture?" — in this browser only, for the consent box of a remix (LEGAL
 * report §3.2: background removal and AI upscaling on a photo of a person need "own photo or consenting
 * adults" before posting). Uses the browser's Shape Detection FaceDetector where it exists (it only says
 * where faces are; nothing identifies anyone, nothing is sent). Elsewhere the answer is "unknown" and the
 * page asks the question anyway. */
export async function detectFaces(source){
 const FD=/** @type {any} */(globalThis).FaceDetector;
 if(typeof FD!=='function')return {supported:false,count:0};
 try{const faces=await new FD({fastMode:true,maxDetectedFaces:4}).detect(source);return {supported:true,count:faces.length};}
 catch{return {supported:false,count:0};}
}
