import * as Im from '../src/image.js';
import {removeBackground} from '../src/matting.js';
export async function run(){
 const source=await Im.decode(await (await fetch('/tests/fixtures/astronaut.png')).blob());let output;
 try{
  output=await removeBackground(source,{progress:value=>console.log(value)});const ctx=output.getContext('2d'),points={background:ctx.getImageData(10,10,1,1).data[3],face:ctx.getImageData(250,140,1,1).data[3],suit:ctx.getImageData(200,350,1,1).data[3]};
  if(points.background>=64||points.face<192||points.suit<192)throw Error('Foreground landmark alpha failed: '+JSON.stringify(points));
  return {rows:[{case:'NASA portrait foreground landmarks',points,...output.processingReport,_png:output.toDataURL()}],quality:'Landmark integration only. IoU, hair/fur, transparent products and real-world quality are UNVERIFIED.'};
 }finally{Im.release(source);Im.release(output);}
}
