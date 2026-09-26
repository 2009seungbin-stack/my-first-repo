import * as S from '../../src/game/pixel-snap.js';
import {runCleanup} from '../../src/studio/pixel/cleanup.js';
function sprite1x(w=24,h=20){
 const d=new Uint8Array(w*h*4),cols=[[40,32,60],[200,60,70],[250,200,90],[80,160,90],[60,90,200]];let seed=w*131+h;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
 for(let y=2;y<h-2;y++){let c=cols[1],left=0;for(let x=3;x<w-3;x++){const edge=y===2||y===h-3||x===3||x===w-4;if(!left){c=cols[1+Math.floor(rnd()*4)];left=1+Math.floor(rnd()*3);}left--;d.set([...(edge?cols[0]:c),255],(y*w+x)*4);}}
 return {data:d,width:w,height:h};
}
function bilinear(img,s){
 // premultiplied, like Pillow and browsers
 const W=Math.round(img.width*s),H=Math.round(img.height*s),d=new Uint8Array(W*H*4),g=(x,y,c)=>{const i=(Math.max(0,Math.min(img.height-1,y))*img.width+Math.max(0,Math.min(img.width-1,x)))*4;return c===3?img.data[i+3]:img.data[i+c]*img.data[i+3]/255;};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)*img.width/W-.5,v=(y+.5)*img.height/H-.5,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;
  const v4=[0,1,2,3].map(c=>g(x0,y0,c)*(1-fx)*(1-fy)+g(x0+1,y0,c)*fx*(1-fy)+g(x0,y0+1,c)*(1-fx)*fy+g(x0+1,y0+1,c)*fx*fy);
  const a=v4[3];for(let c=0;c<3;c++)d[(y*W+x)*4+c]=a?Math.round(v4[c]*255/a):0;d[(y*W+x)*4+3]=Math.round(a);}
 return {data:d,width:W,height:H};
}
function nearestUp(img,s){const W=Math.round(img.width*s),H=Math.round(img.height*s),d=new Uint8Array(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.min(img.width-1,Math.floor(x/s)),sy=Math.min(img.height-1,Math.floor(y/s));d.set(img.data.subarray((sy*img.width+sx)*4,(sy*img.width+sx)*4+4),(y*W+x)*4);}return {data:d,width:W,height:H};}
const accuracy=(a,b)=>{if(a.width!==b.width||a.height!==b.height)return 0;let same=0,n=a.width*a.height;for(let p=0;p<n;p++){const i=p*4,ta=a.data[i+3]<128,tb=b.data[i+3]<128;if(ta&&tb||(!ta&&!tb&&a.data[i]===b.data[i]&&a.data[i+1]===b.data[i+1]&&a.data[i+2]===b.data[i+2]))same++;}return same/n;};
const src=sprite1x(32,24);
{const up=bilinear(src,2.3);console.log(JSON.stringify(S.estimateLattice(S.axisProfiles(up))));for(const s of [1.15,1.53,1.64,2.3,4.6]){const P=S.axisProfiles(up);console.log(s,S.axisLattice(P.x,s),S.axisLattice(P.y,s));}}
for(const [s,k]of [[3.78,'b'],[4.25,'b'],[5.5,'b'],[2.5,'n'],[3.3,'n'],[4.7,'n'],[7.2,'b'],[2.3,'b']]){
 const up=k==='b'?bilinear(src,s):nearestUp(src,s),g=S.findGrid(up);
 const r=runCleanup([up],{background:'off'});
 console.log(k,s,'->',g.kind,g.scale,g.scaleX,g.scaleY,'phase',g.phaseX?.toFixed(2),g.phaseY?.toFixed(2),'order',g.order,g.confidence,'size',r.frames[0].width,r.frames[0].height,'acc',accuracy(r.frames[0],src).toFixed(3),'moved',g.moved);
}
