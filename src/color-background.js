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
