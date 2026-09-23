// Writes feature files with writeAseprite for verification in real Aseprite and LibreSprite,
// plus our own renders (raw RGBA) and the intended metadata.
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const M=await import('../../src/game/aseprite.js');
const out=process.argv[2];mkdirSync(out,{recursive:true});
const canvas=(w,h)=>new Uint8Array(w*h*4);
const rect=(img,w,x,y,rw,rh,c)=>{for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)img.set(c,(j*w+i)*4);return img;};
let seed=3;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed/0x7fffffff;};
const noise=(w,h,alpha)=>{const a=canvas(w,h);for(let i=0;i<w*h;i++)a.set([rnd()*256,rnd()*256,rnd()*256,alpha??(rnd()<.2?0:rnd()*256)],i*4);return a;};
const cases={};
// 1) features: groups, every blend mode, opacity, linked duplicates, tags (4 directions + repeat),
//    multi-key slices with 9-patch + pivot, typed user data incl. an extension map.
{
 const W=40,H=24,frames=[];
 const layers=[{name:'Background',background:true},{name:'fx',type:'group'}];
 for(let m=0;m<19;m++)layers.push({name:'m'+m,parent:1,blendMode:m,opacity:m%3?255:170});
 layers.push({name:'still',userData:{text:'still layer',color:'#11223344',properties:{'':{hp:7,big:5000000000,neg:-3,f:0.25,s:'ünï',on:false,pt:{type:'point',value:{x:-1,y:2}},sz:{type:'size',value:{w:3,h:4}},rc:{type:'rect',value:{x:1,y:2,w:3,h:4}},list:[1,2,3],mixed:[1,'a',true],nest:{a:{b:{c:1}}}},'nerulio/meta':{kind:'enemy'}}}});
 for(let f=0;f<5;f++){
  const images={0:rect(canvas(W,H),W,0,0,W,H,[40+f*10,60,90,255])};
  for(let m=0;m<19;m++){const img=canvas(W,H);const n=noise(2,H);for(let y=0;y<H;y++)for(let x=0;x<2;x++)img.set(n.subarray((y*2+x)*4,(y*2+x)*4+4),(y*W+m*2+x)*4);images[2+m]=img;}
  images[21]=rect(canvas(W,H),W,30,2,6,6,[255,255,255,255]);
  frames.push({duration:[80,90,100,110,500][f],images,cels:{21:{userData:f===0?{text:'first still',color:null,properties:{'':{i:1}}}:null}}});
 }
 cases.features=M.documentFromImages({width:W,height:H,layers,frames,
  tags:[{name:'fwd',from:0,to:1,direction:'forward',color:'#ff0000ff'},{name:'rev',from:1,to:3,direction:'reverse',repeat:4},{name:'pp',from:0,to:4,direction:'pingpong',repeat:2},{name:'ppr',from:2,to:4,direction:'pingpong_reverse',userData:{text:'tag text',color:'#0000ffff',properties:{'':{speed:1.5}}}}],
  slices:[{name:'nine',keys:[{frame:0,x:1,y:1,w:12,h:10,center:{x:3,y:3,w:6,h:4}},{frame:3,x:2,y:1,w:12,h:10,center:{x:3,y:3,w:6,h:4}}],userData:{text:'panel',color:null,properties:null}},{name:'pivot',keys:[{frame:0,x:10,y:4,w:8,h:16,pivot:{x:4,y:15}}]}],
  userData:{text:'sprite',color:'#01020304',properties:{'':{version:3}}}});
}
// 2) indexed with a transparent index != 0 and palette alpha
{
 const W=12,H=10,pal=[[0,0,0,255],[255,0,0,255],[0,200,0,255],[1,2,3,0],[0,0,255,128],[255,255,0,255]];
 const a=rect(rect(canvas(W,H),W,1,1,5,5,[255,0,0,255]),W,3,3,5,5,[0,0,255,128]);
 const b=rect(canvas(W,H),W,6,2,4,6,[255,255,0,255]);
 cases.indexed=M.documentFromImages({width:W,height:H,palette:pal,transparentIndex:3,layers:[{name:'a'},{name:'b',opacity:100}],frames:[{images:{0:a,1:b}},{duration:200,images:{0:a}}]});
}
// 3) grayscale with blend modes
{
 const W=16,H=8,layers=[{name:'base'},{name:'mul',blendMode:'multiply'},{name:'add',blendMode:'addition',opacity:150},{name:'diff',blendMode:'difference'}];
 const g=(v,a)=>[v,v,v,a];const base=canvas(W,H);for(let i=0;i<W*H;i++)base.set(g((i*13)%256,255),i*4);
 const l=k=>{const c=canvas(W,H);for(let i=0;i<W*H;i++)c.set(g((i*7+k*50)%256,[255,128,0,60][(i+k)%4]),i*4);return c;};
 cases.gray=M.documentFromImages({width:W,height:H,grayscale:true,layers,frames:[{images:{0:base,1:l(1),2:l(2),3:l(3)}}]});
}
// 4) tilemap with flips + an image layer below with z-index moving it above
{
 const tw=3,th=3,n=4,tiles=new Uint8Array(tw*th*n*4);
 for(let t=1;t<n;t++)for(let i=0;i<tw*th;i++)tiles.set([t*80,i*28,255-t*60,i%4?255:0],(t*tw*th+i)*4);
 const T=M.TILE,vals=[1,2|T.XFLIP,3|T.YFLIP,1|T.DFLIP,0,2|T.XFLIP|T.YFLIP|T.DFLIP];
 cases.tilemap={width:9,height:6,colorMode:'rgba',transparentIndex:0,composeGroups:false,grid:{x:0,y:0,w:3,h:3},pixelRatio:{w:1,h:1},palette:null,tags:[],slices:[],userData:null,
  tilesets:[{name:'tiles',numTiles:n,tileWidth:tw,tileHeight:th,baseIndex:1,pixels:tiles,matchFlips:{x:true},userData:{text:'ts',color:null,properties:null},tileUserData:[null,{text:'tile1',color:null,properties:{'':{solid:true}}},null,null]}],
  layers:[{index:0,name:'under',type:'image',parent:-1,visible:true,opacity:255,blendMode:0},{index:1,name:'map',type:'tilemap',parent:-1,visible:true,opacity:200,blendMode:0,tilesetIndex:0}],
  frames:[{index:0,duration:100,cels:[{type:'image',layer:0,frame:0,x:0,y:0,width:9,height:6,pixels:rect(canvas(9,6),9,0,0,9,6,[200,30,30,255]),opacity:255,zIndex:2,linkedFrame:null,data:{userData:null}},
   {type:'tilemap',layer:1,frame:0,x:0,y:0,width:3,height:2,opacity:255,zIndex:0,tiles:new Uint32Array(vals),linkedFrame:null,data:{userData:null}}]}]};
}
// 5) compose groups (header flag 2): group opacity + blend mode
{
 const W=10,H=6;
 cases.compose=M.documentFromImages({width:W,height:H,composeGroups:true,
  layers:[{name:'base'},{name:'grp',type:'group',opacity:128,blendMode:'multiply'},{name:'a',parent:1},{name:'b',parent:1,blendMode:'screen'}],
  frames:[{images:{0:rect(canvas(W,H),W,0,0,W,H,[40,90,200,255]),2:rect(canvas(W,H),W,0,0,6,6,[250,200,20,255]),3:rect(canvas(W,H),W,4,0,6,6,[20,250,120,160])}}]});
}
// 6) same as features but every layer uses Normal blend (LibreSprite predates the new blend modes)
cases.featuresNormal=structuredClone(cases.features);cases.featuresNormal.layers.forEach(l=>{l.blendMode=0;});
const meta={};
for(const [name,doc] of Object.entries(cases)){
 const bytes=M.writeAseprite(doc);writeFileSync(join(out,name+'.aseprite'),bytes);
 const back=M.readAseprite(bytes,{strict:true});
 for(let f=0;f<back.frames.length;f++){writeFileSync(join(out,`${name}.f${f}.rgba`),M.renderFrame(back,f).rgba);if(back.composeGroups)writeFileSync(join(out,`${name}.flat.f${f}.rgba`),M.renderFrame(back,f,{composeGroups:false}).rgba);}
 if(name!=='tilemap'){const ls=M.writeAseprite(doc,{target:'libresprite'});writeFileSync(join(out,name+'.ls.aseprite'),ls);}
 meta[name]={width:back.width,height:back.height,frames:back.frames.length};
}
writeFileSync(join(out,'cases.json'),JSON.stringify(meta));
console.log(Object.keys(cases).join(' '));
