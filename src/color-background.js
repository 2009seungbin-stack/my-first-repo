/** The most common colour among the border pixels: what a product shot's backdrop, or a sprite
 * sheet's colour key, nearly always is. Takes a canvas because only the four edges are read. */
export function borderColor(c){
 const w=c.width,h=c.height,ctx=c.getContext('2d',{willReadFrequently:true}),counts=new Map();let best=null,top=0;
 const take=d=>{for(let i=0;i<d.length;i+=4){if(d[i+3]<8)continue;const k=(d[i]>>3<<10)|(d[i+1]>>3<<5)|(d[i+2]>>3),e=counts.get(k)||[0,0,0,0];e[0]++;e[1]+=d[i];e[2]+=d[i+1];e[3]+=d[i+2];counts.set(k,e);if(e[0]>top){top=e[0];best=e;}}};
 take(ctx.getImageData(0,0,w,1).data);take(ctx.getImageData(0,h-1,w,1).data);take(ctx.getImageData(0,0,1,h).data);take(ctx.getImageData(w-1,0,1,h).data);
 return best?[1,2,3].map(i=>Math.round(best[i]/best[0])):[255,255,255];
}
/** Border-connected scanline flood fill; bitset visitation, no full-image uint32 queue. */
export function removeColorBackground(data,w,h,color,tolerance,{inPlace=false}={}){
 if(data.length!==w*h*4||!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid background-removal input');
 const out=inPlace?data:new Uint8ClampedArray(data),seen=new Uint8Array(Math.ceil(w*h/8)),stack=[],limit=tolerance*tolerance;
 const visited=i=>(seen[i>>3]&(1<<(i&7)))!==0,mark=i=>{seen[i>>3]|=1<<(i&7);};
 const matches=i=>{const p=i*4;if(data[p+3]===0)return true;const r=data[p]-color[0],g=data[p+1]-color[1],b=data[p+2]-color[2];return r*r+g*g+b*b<=limit;};
 const seed=i=>{if(!visited(i)&&matches(i))stack.push(i);};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=1;y<h-1;y++){seed(y*w);seed(y*w+w-1);}
 while(stack.length){const i=stack.pop();if(visited(i))continue;const y=Math.floor(i/w),row=y*w;let left=i-row,right=left;while(left>0&&!visited(row+left-1)&&matches(row+left-1))left--;while(right+1<w&&!visited(row+right+1)&&matches(row+right+1))right++;for(let x=left;x<=right;x++){mark(row+x);out[(row+x)*4+3]=0;}for(const yy of [y-1,y+1]){if(yy<0||yy>=h)continue;let run=false;for(let x=left;x<=right;x++){const p=yy*w+x,eligible=!visited(p)&&matches(p);if(eligible&&!run)stack.push(p);run=eligible;}}}
 return out;
}
