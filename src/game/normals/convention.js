/** Which way is green? OpenGL (Y+, green up) or DirectX (Y−, green down), measured from the
 * pixels — with a confidence, and "cannot tell" when the pixels do not say. Pure (no DOM).
 *
 * 1. Integrability (curl) test — any map. A normal map encodes the slopes of a surface:
 *    read as OpenGL, gx = −nx/nz = ∂h/∂x and gy = ny/nz = ∂h/∂y (y down). A real surface has equal
 *    mixed derivatives, ∂gx/∂y = ∂gy/∂x (the curl of a gradient is zero). If the map is really
 *    DirectX, its green is negated and the two sides come out with OPPOSITE signs. So the sign of
 *    ρ = corr(∂gx/∂y, ∂gy/∂x) says which convention the map is in (+ OpenGL, − DirectX) and its size
 *    says how clearly. A surface whose mixed derivative is ~0 everywhere (straight grooves, a
 *    single ramp) carries no information either way: that is reported as "cannot tell".
 *    Assumes red is standard (X+ right): a map with a flipped red channel reads as the other
 *    convention. That is rare, and the silhouette test below checks it on sprites.
 * 2. Silhouette test — sprites with alpha. Normals at a silhouette face outward, so at the top
 *    edge an OpenGL map has green > 128 and at the right edge red > 128. Correlating the stored
 *    normal with the outward direction of the blurred alpha gives a second, independent reading
 *    (and checks the red channel).
 *
 * Confidence comes from how the evidence agrees across regions of the image (each block of the
 * map votes, weighted by how much mixed-derivative signal it holds), not from a single number. */
const dec=b=>(b-127.5)/127.5;
export const CONFIDENCE=Object.freeze(['high','medium','low','none']);
/** Slopes (gx, gy as OpenGL) and a validity mask. Texels that are transparent, not unit length or
 * nearly edge-on (nz < 0.25) are excluded: their slope is noise. */
function slopes(rgba,w,h,{alphaThreshold=0}={}){
 const gx=new Float32Array(w*h),gy=new Float32Array(w*h),ok=new Uint8Array(w*h);
 for(let p=0;p<w*h;p++){
  const i=p*4;if(rgba[i+3]<=alphaThreshold)continue;
  const x=dec(rgba[i]),y=dec(rgba[i+1]),z=dec(rgba[i+2]),l=Math.hypot(x,y,z);
  if(z<.25||l<.7||l>1.3)continue;
  gx[p]=-x/z;gy[p]=y/z;ok[p]=1;
 }
 return {gx,gy,ok};
}
/** The curl test. Returns {rho, blocks, agree, energy, informative, samples}. */
export function curlStatistic(rgba,w,h,{blocks=8,alphaThreshold=0}={}){
 if(rgba.length!==w*h*4)throw Error('RGBA data does not match the given dimensions');
 const {gx,gy,ok}=slopes(rgba,w,h,{alphaThreshold});
 const bw=Math.max(1,Math.ceil(w/blocks)),bh=Math.max(1,Math.ceil(h/blocks)),nbx=Math.ceil(w/bw),nby=Math.ceil(h/bh);
 const sab=new Float64Array(nbx*nby),saa=new Float64Array(nbx*nby),sbb=new Float64Array(nbx*nby);
 let AB=0,AA=0,BB=0,n=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x;
  if(!ok[p]||!ok[p-w]||!ok[p+w]||!ok[p-1]||!ok[p+1])continue;
  // central differences; a = ∂gx/∂y, b = ∂gy/∂x
  const a=(gx[p+w]-gx[p-w])/2,b=(gy[p+1]-gy[p-1])/2;
  // a slope jump of more than ~2 (a cliff, or a seam between islands) says nothing about curl
  if(Math.abs(a)>2||Math.abs(b)>2)continue;
  const k=Math.floor(y/bh)*nbx+Math.floor(x/bw);
  sab[k]+=a*b;saa[k]+=a*a;sbb[k]+=b*b;AB+=a*b;AA+=a*a;BB+=b*b;n++;
 }
 const rho=AA>0&&BB>0?AB/Math.sqrt(AA*BB):0;
 // Blocks vote with the sign of their own Σab, weighted by |Σab|; a block with almost no mixed
 // signal (below 2 % of the mean block) abstains.
 const votes=[];for(let k=0;k<sab.length;k++)votes.push(sab[k]);
 const meanAbs=votes.reduce((s,v)=>s+Math.abs(v),0)/Math.max(1,votes.length);
 let forSign=0,against=0,informative=0,agreeing=0;const sign=Math.sign(AB)||1;
 for(const v of votes){if(Math.abs(v)<.02*meanAbs||!v)continue;informative++;if(Math.sign(v)===sign){forSign+=Math.abs(v);agreeing++;}else against+=Math.abs(v);}
 return {rho,agree:forSign+against>0?forSign/(forSign+against):0,informative,agreeing,blocks:votes.length,samples:n,energy:n?Math.sqrt(AA*BB)/n:0};
}
/** The silhouette test (sprites). Returns {rhoY, rhoX, edgePixels} or null when there is no
 * silhouette. rhoY > 0 = OpenGL; rhoX > 0 = standard red. */
export function silhouetteStatistic(rgba,w,h,{radius=2,alphaThreshold=127}={}){
 let transparent=0,opaque=0;for(let p=0;p<w*h;p++){if(rgba[p*4+3]>alphaThreshold)opaque++;else transparent++;}
 if(!transparent||!opaque)return null;
 // box-blurred alpha (radius px): its gradient points inward at the silhouette
 const a=new Float32Array(w*h);for(let p=0;p<w*h;p++)a[p]=rgba[p*4+3]/255;
 const blur=(src,horizontal)=>{const out=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,c=0;for(let k=-radius;k<=radius;k++){const xx=horizontal?x+k:x,yy=horizontal?y:y+k;if(xx<0||yy<0||xx>=w||yy>=h){c++;continue;}s+=src[yy*w+xx];c++;}out[y*w+x]=s/c;}return out;};
 const B=blur(blur(a,true),false);
 let sy=0,syy=0,sgg=0,sx=0,sxx=0,shh=0,n=0;
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const p=y*w+x;if(rgba[p*4+3]<=alphaThreshold)continue;
  const ax=(B[p+1]-B[p-1])/2,ay=(B[p+w]-B[p-w])/2;// inward direction (y down)
  if(Math.hypot(ax,ay)<.02)continue;
  // an untouched flat texel (128,128,255: the flame of a torch nobody painted) says nothing
  if(rgba[p*4]===128&&rgba[p*4+1]===128&&rgba[p*4+2]===255)continue;
  const nx=dec(rgba[p*4]),ny=dec(rgba[p*4+1]);
  // outward = −inward; OpenGL: ny > 0 where the outward normal points up (−y down) → ny ~ +ay
  sy+=ny*ay;syy+=ny*ny;sgg+=ay*ay;sx+=nx*-ax;sxx+=nx*nx;shh+=ax*ax;n++;
 }
 if(n<8)return null;
 return {rhoY:syy&&sgg?sy/Math.sqrt(syy*sgg):0,rhoX:sxx&&shh?sx/Math.sqrt(sxx*shh):0,edgePixels:n};
}
const grade=(abs,agree,informative)=>{
 if(abs>=.3&&agree>=.9&&informative>=8)return 'high';
 if(abs>=.12&&agree>=.75&&informative>=4)return 'medium';
 if(abs>=.04&&agree>=.6)return 'low';
 return 'none';
};
/** The verdict: {convention:'opengl'|'directx'|null, confidence, evidence:[…], reason}.
 * `convention` is null (never guessed) when confidence is 'none'. */
export function detectConvention(rgba,w,h,{alphaThreshold=127}={}){
 const curl=curlStatistic(rgba,w,h,{alphaThreshold:0});
 const sil=silhouetteStatistic(rgba,w,h,{alphaThreshold});
 const evidence=[];
 let curlVote=0,curlGrade='none';
 if(curl.samples>=64){
  curlGrade=grade(Math.abs(curl.rho),curl.agree,curl.informative);
  if(curlGrade!=='none')curlVote=Math.sign(curl.rho);
  evidence.push({test:'curl',rho:round(curl.rho),agree:round(curl.agree),informative:curl.informative,agreeing:curl.agreeing,blocks:curl.blocks,samples:curl.samples,grade:curlGrade,says:curlVote>0?'opengl':curlVote<0?'directx':null});
 }else evidence.push({test:'curl',samples:curl.samples,grade:'none',says:null});
 let silVote=0,silGrade='none';
 if(sil){
  const abs=Math.abs(sil.rhoY),redOk=sil.rhoX>.15;
  silGrade=!redOk?'none':abs>=.45?'high':abs>=.25?'medium':abs>=.1?'low':'none';
  if(silGrade!=='none')silVote=Math.sign(sil.rhoY);
  evidence.push({test:'silhouette',rhoY:round(sil.rhoY),rhoX:round(sil.rhoX),edgePixels:sil.edgePixels,grade:silGrade,redStandard:redOk,says:silVote>0?'opengl':silVote<0?'directx':null});
 }
 const rank={high:3,medium:2,low:1,none:0};
 let convention=null,confidence='none',reason='no-signal';
 if(curlVote&&silVote&&curlVote!==silVote){
  // the two tests disagree: only a clearly stronger one (at least medium, a grade above the other)
  // may speak, and then only with low confidence
  const c=rank[curlGrade],s=rank[silGrade];
  if(Math.abs(c-s)>=1&&Math.max(c,s)>=2){const v=c>s?curlVote:silVote;convention=v>0?'opengl':'directx';confidence='low';reason='tests-disagree';}
  else reason='tests-disagree';
 }else if(curlVote||silVote){
  const v=curlVote||silVote;convention=v>0?'opengl':'directx';
  const best=Math.max(rank[curlGrade],rank[silGrade]),both=curlVote&&silVote;
  // agreement of two independent tests lifts the grade by one step
  const r=Math.min(3,best+(both&&best<3?1:0));
  confidence=['none','low','medium','high'][r];reason=both?'both-agree':curlVote?'curl':'silhouette';
 }else if(curl.samples<64&&!sil)reason='too-small';
 else if(curl.samples>=64&&Math.abs(curl.rho)<.04)reason='no-mixed-slopes';
 return {convention,confidence,reason,evidence};
}
const round=v=>Math.round(v*1000)/1000;
