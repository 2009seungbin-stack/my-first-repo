/** Incremental bounds: one row strip owned at a time, no full RGBA mask. */
let bounds;
self.onmessage=({data:m})=>{
 if(m.start){bounds={x:m.width,y:m.height,right:-1,bottom:-1};return;}
 const d=new Uint8ClampedArray(m.buffer);
 for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++){
  const i=(y*m.width+x)*4;
  if(d[i+3]>8&&(m.whiteThreshold===undefined||Math.min(d[i],d[i+1],d[i+2])<m.whiteThreshold)){
   bounds.x=Math.min(bounds.x,x);bounds.y=Math.min(bounds.y,m.y+y);bounds.right=Math.max(bounds.right,x);bounds.bottom=Math.max(bounds.bottom,m.y+y);
  }
 }
 self.postMessage({bounds});
};
