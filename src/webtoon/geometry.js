/** Pure source-row geometry. No seam can be skipped or duplicated. */
export function evenlySpaced(height,target){
 if(!Number.isSafeInteger(height)||height<1||!Number.isSafeInteger(target)||target<1)throw new RangeError('Invalid image height or cut height');
 const cuts=[];for(let y=target;y<height;y+=target)cuts.push(y);return cuts;
}
export function validateCuts(height,cuts){
 if(!Number.isSafeInteger(height)||height<1||!Array.isArray(cuts))throw new RangeError('Invalid cuts');
 let last=0;
 for(const y of cuts){if(!Number.isSafeInteger(y)||y<=last||y>=height)throw new RangeError('Cuts must be unique ascending source rows inside the image');last=y;}
 return [0,...cuts,height].slice(1).map((end,i)=>({y:[0,...cuts][i],height:end-[0,...cuts][i]}));
}
export function suggestedCuts(height,target,rowInk,{radius=80,minPart=128}={}){
 const coarse=evenlySpaced(height,target),cuts=[],warnings=[];let previous=0;
 for(const expected of coarse){
  let best=expected,score=Infinity;
  for(let y=Math.max(previous+minPart,expected-radius);y<=Math.min(height-minPart,expected+radius);y++){
   const v=rowInk[y]??1,penalty=Math.abs(y-expected)/Math.max(1,radius)*0.15,s=v+penalty;
   if(s<score){score=s;best=y;}
  }
  if(best<=previous||best>=height)continue;
  cuts.push(best);warnings.push(score>0.35?'uncertain':'candidate');previous=best;
 }
 validateCuts(height,cuts);return {cuts,warnings};
}
export function joinedLayout(images,{maxPixels=64_000_000,maxSide=32767}={}){
 if(!images.length)throw new RangeError('Choose images first');
 const width=Math.max(...images.map(x=>x.width)),height=images.reduce((s,x)=>s+x.height,0);
 if(images.some(x=>!Number.isSafeInteger(x.width)||!Number.isSafeInteger(x.height)||x.width<1||x.height<1))throw new RangeError('Invalid input dimensions');
 if(width>maxSide||height>maxSide||width*height>maxPixels)throw new RangeError('Joined image exceeds safe canvas budget; export separate parts');
 let y=0;return {width,height,placements:images.map(x=>{const p={x:0,y,width:x.width,height:x.height};y+=x.height;return p;})};
}
