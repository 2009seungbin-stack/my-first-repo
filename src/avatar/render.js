import {RAMPS} from './catalog.js';
import {normalize} from './model.js';

const WIDTH=16;
export function renderLogical(input={}){
 const s=normalize(input),pixels=new Uint8ClampedArray(WIDTH*WIDTH*4);
 const put=(x,y,c)=>{if(x<0||y<0||x>=16||y>=16)return;pixels.set(c,(y*16+x)*4)};
 const rect=(x0,y0,x1,y1,c)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)put(x,y,c)};
 const skin=RAMPS.skin,hair=RAMPS[s.hairPalette],cloth=RAMPS[s.outfitPalette],eye=RAMPS.eye;
 if(s.background==='sky')rect(0,0,15,15,[205,235,238,255]);
 if(s.background==='plum')rect(0,0,15,15,[58,42,79,255]);
 if(s.hair==='swept'){
  rect(2,4,13,10,hair[0]);rect(2,8,4,12,hair[1]);rect(11,7,13,12,hair[1]);
 }else{
  rect(3,3,12,10,hair[0]);rect(3,8,4,11,hair[1]);rect(11,8,12,11,hair[1]);
 }
 if(s.face==='round'){
  rect(4,4,11,8,skin[0]);rect(5,9,10,10,skin[0]);rect(6,11,9,11,skin[0]);
  rect(4,5,11,7,skin[2]);rect(5,8,10,9,skin[2]);rect(6,10,9,10,skin[2]);
  rect(5,5,9,6,skin[3]);put(10,8,skin[1]);
 }else{
  rect(3,4,12,10,skin[0]);rect(4,11,11,11,skin[0]);
  rect(4,5,11,9,skin[2]);rect(4,10,11,10,skin[2]);
  rect(4,5,9,6,skin[3]);rect(11,7,11,9,skin[1]);
 }
 rect(7,11,8,12,skin[1]);
 if(s.eyes==='bright'){
  rect(5,7,6,8,eye[0]);rect(9,7,10,8,eye[0]);put(5,7,eye[3]);put(9,7,eye[3]);
 }else{
  rect(5,8,6,8,eye[0]);rect(9,8,10,8,eye[0]);
  rect(5,7,6,7,skin[1]);rect(9,7,10,7,skin[1]);
 }
 put(7,10,skin[0]);put(8,10,skin[0]);
 rect(4,12,11,15,cloth[0]);rect(3,13,12,15,cloth[0]);
 rect(4,13,11,15,cloth[2]);rect(7,13,8,15,cloth[1]);
 if(s.outfit==='jacket'){
  rect(5,13,5,15,cloth[3]);rect(10,13,10,15,cloth[3]);put(7,14,cloth[3]);
 }else{
  rect(4,13,5,13,cloth[3]);rect(10,13,11,13,cloth[3]);rect(6,13,9,13,cloth[0]);
 }
 if(s.hair==='swept'){
  rect(3,2,11,3,hair[0]);rect(2,4,12,4,hair[1]);
  rect(3,5,8,5,hair[2]);rect(3,6,5,6,hair[2]);
  rect(5,3,8,3,hair[3]);rect(12,5,13,8,hair[1]);
 }else{
  rect(4,2,11,2,hair[0]);rect(3,3,12,4,hair[1]);
  rect(4,5,6,5,hair[2]);rect(9,5,11,5,hair[2]);
  rect(7,4,8,6,hair[2]);rect(5,3,9,3,hair[3]);
 }
 if(s.accessory==='earring'){put(2,9,[255,217,136,255]);put(13,9,[255,217,136,255]);}
 if(s.accessory==='glasses'){
  rect(4,7,6,9,[24,28,48,255]);rect(9,7,11,9,[24,28,48,255]);
  rect(5,8,5,8,skin[2]);rect(10,8,10,8,skin[2]);rect(7,8,8,8,[24,28,48,255]);
 }
 return {width:16,height:16,data:pixels};
}

export function nearest(source,size){
 if(!Number.isInteger(size)||size<16||size>4096||size%16)throw new RangeError('Output size must be a multiple of 16 from 16 to 4096');
 const factor=size/16,dest=new Uint8ClampedArray(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const src=((Math.floor(y/factor)*16)+Math.floor(x/factor))*4;
  dest.set(source.data.subarray(src,src+4),(y*size+x)*4);
 }
 return {width:size,height:size,data:dest};
}
