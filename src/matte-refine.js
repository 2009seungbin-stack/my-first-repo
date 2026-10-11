/** Matte refinement for the background remover: turns the model's low-resolution probability map into a
 * full-resolution alpha and clean edge colours. Pure (typed arrays in, typed arrays out), so the same code
 * runs in the AI worker, in Node tests and in the AI-300 benchmark (docs/ai-bench/).
 *
 *  1. ALPHA  - colour-guided upsampling: a guided filter (He, Sun & Tang 2013) with the image as guide and the
 *              model's probability as input, solved at a working resolution of at most `work` px on the long
 *              side; its linear coefficients are upsampled bilinearly and applied to the full-resolution image
 *              ("fast guided filter"), so edges follow the picture's own edges instead of the model's grid.
 *  2. SHEET  - AI outputs are very often a character or object on a flat white / plain backdrop (sticker
 *              sheets, "on a white background" prompts). When the border is one flat colour that the model
 *              also calls background, that colour B is known exactly: everything reachable from the border
 *              through B-coloured pixels is background (alpha 0, which removes the soft halo the model leaves
 *              on white), and pixels within a few px of it get the known-backdrop alpha |C-B| / |F-B| with F
 *              the nearest solid foreground colour.
 *  3. COLOUR - edge pixels are un-mixed from the backdrop: exactly F = B + (C-B)/alpha on a flat backdrop,
 *              otherwise by blur-fusion foreground estimation (Forte & Pitie 2021, as BiRefNet's reference
 *              code), so a cut-out placed on a dark or coloured background shows no white or old-backdrop rim.
 * Opaque pixels always keep their exact original colour. */

const clamp01=v=>v<0?0:v>1?1:v;

/** Mean filter with a (2r+1)^2 window, clipped at the borders (each output is the mean of the valid part). */
export function boxFilter(src,w,h,r){
 const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
 for(let y=0;y<h;y++){const o=y*w;let s=0;
  for(let x=0;x<=Math.min(r,w-1);x++)s+=src[o+x];
  for(let x=0;x<w;x++){const lo=x-r,hi=x+r;tmp[o+x]=s/(Math.min(hi,w-1)-Math.max(lo,0)+1);
   if(hi+1<w)s+=src[o+hi+1];if(lo>=0)s-=src[o+lo];}}
 for(let x=0;x<w;x++){let s=0;
  for(let y=0;y<=Math.min(r,h-1);y++)s+=tmp[y*w+x];
  for(let y=0;y<h;y++){const lo=y-r,hi=y+r;out[y*w+x]=s/(Math.min(hi,h-1)-Math.max(lo,0)+1);
   if(hi+1<h)s+=tmp[(hi+1)*w+x];if(lo>=0)s-=tmp[lo*w+x];}}
 return out;
}

/** Bilinear resample of a single-channel float plane (pixel centres aligned). */
export function resizePlane(src,sw,sh,w,h){
 const out=new Float32Array(w*h),fx=sw/w,fy=sh/h;
 for(let y=0;y<h;y++){const gy=Math.max(0,Math.min(sh-1,(y+.5)*fy-.5)),y0=Math.floor(gy),y1=Math.min(sh-1,y0+1),ty=gy-y0;
  for(let x=0;x<w;x++){const gx=Math.max(0,Math.min(sw-1,(x+.5)*fx-.5)),x0=Math.floor(gx),x1=Math.min(sw-1,x0+1),tx=gx-x0;
   const a=src[y0*sw+x0]*(1-tx)+src[y0*sw+x1]*tx,b=src[y1*sw+x0]*(1-tx)+src[y1*sw+x1]*tx;out[y*w+x]=a*(1-ty)+b*ty;}}
 return out;
}

/** Area-averaged RGB planes (0..1) of an RGBA image at w2 x h2. */
function guidePlanes(rgba,w,h,w2,h2){
 const n=w2*h2,R=new Float32Array(n),G=new Float32Array(n),B=new Float32Array(n);
 if(w2===w&&h2===h){for(let i=0;i<n;i++){R[i]=rgba[i*4]/255;G[i]=rgba[i*4+1]/255;B[i]=rgba[i*4+2]/255;}return [R,G,B];}
 const cnt=new Float32Array(n);
 for(let y=0;y<h;y++){const ty=Math.min(h2-1,Math.floor(y*h2/h));for(let x=0;x<w;x++){const t=ty*w2+Math.min(w2-1,Math.floor(x*w2/w)),i=(y*w+x)*4;R[t]+=rgba[i];G[t]+=rgba[i+1];B[t]+=rgba[i+2];cnt[t]++;}}
 for(let i=0;i<n;i++){const c=cnt[i]*255||1;R[i]/=c;G[i]/=c;B[i]/=c;}
 return [R,G,B];
}

/** Colour-guided upsampling of the model probability `prob` (pw x ph) to a full-resolution alpha (Float32, 0..1). */
export function guidedAlpha(rgba,w,h,prob,pw,ph,{work=1024,radius=null,eps=1e-3}={}){
 const s=Math.min(1,work/Math.max(w,h)),ww=Math.max(1,Math.round(w*s)),hh=Math.max(1,Math.round(h*s)),n=ww*hh;
 const r=radius??Math.max(2,Math.round(2*Math.max(ww,hh)/Math.max(pw,ph)));
 const [I0,I1,I2]=guidePlanes(rgba,w,h,ww,hh),p=resizePlane(prob,pw,ph,ww,hh),box=a=>boxFilter(a,ww,hh,r);
 const prod=(a,b)=>{const o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=a[i]*b[i];return o;};
 const m0=box(I0),m1=box(I1),m2=box(I2),mp=box(p),c0=box(prod(I0,p)),c1=box(prod(I1,p)),c2=box(prod(I2,p));
 const v00=box(prod(I0,I0)),v01=box(prod(I0,I1)),v02=box(prod(I0,I2)),v11=box(prod(I1,I1)),v12=box(prod(I1,I2)),v22=box(prod(I2,I2));
 const A0=new Float32Array(n),A1=new Float32Array(n),A2=new Float32Array(n),Bc=new Float32Array(n);
 for(let i=0;i<n;i++){
  const a=v00[i]-m0[i]*m0[i]+eps,b=v01[i]-m0[i]*m1[i],c=v02[i]-m0[i]*m2[i],d=v11[i]-m1[i]*m1[i]+eps,e=v12[i]-m1[i]*m2[i],f=v22[i]-m2[i]*m2[i]+eps;
  const q0=c0[i]-m0[i]*mp[i],q1=c1[i]-m1[i]*mp[i],q2=c2[i]-m2[i]*mp[i];
  // symmetric 3x3 inverse (adjugate / determinant)
  const i00=d*f-e*e,i01=c*e-b*f,i02=b*e-c*d,i11=a*f-c*c,i12=b*c-a*e,i22=a*d-b*b,det=a*i00+b*i01+c*i02||1e-12;
  const x0=(i00*q0+i01*q1+i02*q2)/det,x1=(i01*q0+i11*q1+i12*q2)/det,x2=(i02*q0+i12*q1+i22*q2)/det;
  A0[i]=x0;A1[i]=x1;A2[i]=x2;Bc[i]=mp[i]-x0*m0[i]-x1*m1[i]-x2*m2[i];
 }
 const a0=box(A0),a1=box(A1),a2=box(A2),bb=box(Bc),out=new Float32Array(w*h);
 if(ww===w&&hh===h){for(let i=0;i<n;i++)out[i]=clamp01(a0[i]*I0[i]+a1[i]*I1[i]+a2[i]*I2[i]+bb[i]);return out;}
 const u0=resizePlane(a0,ww,hh,w,h),u1=resizePlane(a1,ww,hh,w,h),u2=resizePlane(a2,ww,hh,w,h),ub=resizePlane(bb,ww,hh,w,h);
 for(let i=0;i<w*h;i++)out[i]=clamp01((u0[i]*rgba[i*4]+u1[i]*rgba[i*4+1]+u2[i]*rgba[i*4+2])/255+ub[i]);
 return out;
}

/** A flat backdrop: the border ring is (almost) one colour and the alpha calls it background.
 * @returns {color:[r,g,b], spread, share} or null */
export function detectBackdrop(rgba,w,h,alpha,{ring=null,tolerance=24}={}){
 const t=ring??Math.max(2,Math.round(Math.min(w,h)*.01)),px=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x<t||y<t||x>=w-t||y>=h-t)px.push(y*w+x);
 const med=c=>{const v=px.map(p=>rgba[p*4+c]).sort((a,b)=>a-b);return v[v.length>>1];},B=[med(0),med(1),med(2)];
 let near=0,bgish=0;const ds=[];
 for(const p of px){const d=Math.hypot(rgba[p*4]-B[0],rgba[p*4+1]-B[1],rgba[p*4+2]-B[2]);ds.push(d);if(d<=tolerance)near++;if(alpha[p]<.5)bgish++;}
 ds.sort((a,b)=>a-b);const share=near/px.length,spread=ds[Math.floor(ds.length*.9)];
 return share>=.9&&bgish/px.length>=.9&&spread<=tolerance?{color:B,spread,share:+share.toFixed(3)}:null;
}

/** Known-backdrop edge correction (in place on `alpha`). Returns the per-pixel class: 0 untouched, 1 backdrop, 2 edge band. */
export function sheetEdges(rgba,w,h,alpha,B,{band=3,low=null,solid=.98,flood=.5,fill=true,holeContrast=48}={}){
 const n=w*h,d=new Float32Array(n);for(let i=0;i<n;i++)d[i]=Math.hypot(rgba[i*4]-B[0],rgba[i*4+1]-B[1],rgba[i*4+2]-B[2]);
 // backdrop core: flood from the border through backdrop-coloured pixels the model does not call solid foreground
 const lo=low??12,cls=new Uint8Array(n),q=new Int32Array(n);let qh=0,qt=0;
 const seed=i=>{if(!cls[i]&&d[i]<lo&&alpha[i]<flood){cls[i]=1;q[qt++]=i;}};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
 while(qh<qt){const i=q[qh++],x=i%w;if(x>0)seed(i-1);if(x<w-1)seed(i+1);if(i>=w)seed(i-w);if(i<n-w)seed(i+w);}
 // band: pixels within `band` steps of the backdrop core (BFS distance)
 const dist=new Uint8Array(n).fill(255);qh=qt=0;
 for(let i=0;i<n;i++)if(cls[i]===1){dist[i]=0;q[qt++]=i;}
 while(qh<qt){const i=q[qh++],x=i%w,nd=dist[i]+1;if(nd>band)continue;
  for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<n-w?i+w:-1])if(j>=0&&dist[j]===255){dist[j]=nd;cls[j]=2;q[qt++]=j;}}
 // nearest solid foreground colour for band pixels: BFS outward from solid pixels next to the band
 const src=new Int32Array(n).fill(-1);qh=qt=0;
 for(let i=0;i<n;i++)if(cls[i]===0&&alpha[i]>=solid&&d[i]>=lo){src[i]=i;q[qt++]=i;}
 const reach=new Uint8Array(n);
 while(qh<qt){const i=q[qh++],x=i%w;if(reach[i]>band+3)continue;
  for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<n-w?i+w:-1])if(j>=0&&src[j]<0&&cls[j]!==1){src[j]=src[i];reach[j]=reach[i]+1;q[qt++]=j;}}
 for(let i=0;i<n;i++){
  if(cls[i]===1){alpha[i]=0;continue;}
  if(cls[i]!==2)continue;
  const s=src[i];if(s<0){alpha[i]=Math.min(alpha[i],clamp01(d[i]/64));continue;}
  const dF=Math.max(24,Math.hypot(rgba[s*4]-B[0],rgba[s*4+1]-B[1],rgba[s*4+2]-B[2]));alpha[i]=clamp01(d[i]/dF);
 }
 // holes: pieces the model dropped INSIDE the subject that are not backdrop-coloured (a flat backdrop has
 // nothing else to show there) and do not touch the backdrop are filled back in
 if(fill){const seen=new Uint8Array(n),stack=new Int32Array(n);
  for(let i0=0;i0<n;i0++){if(seen[i0]||cls[i0]===1||alpha[i0]>=.5||d[i0]<lo)continue;
   let sp=0,count=0,touches=false;const members=[];stack[sp++]=i0;seen[i0]=1;
   while(sp){const i=stack[--sp],x=i%w;members.push(i);count++;
    for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,i>=w?i-w:-1,i<n-w?i+w:-1]){if(j<0){touches=true;continue;}
     if(cls[j]===1){touches=true;continue;}if(!seen[j]&&alpha[j]<.5&&d[j]>=lo){seen[j]=1;stack[sp++]=j;}}}
   if(touches)continue;
   // a backdrop gradient enclosed by the subject (inside a chain loop, a vignette) stays out: only clearly
   // non-backdrop holes (median distance from the backdrop colour >= holeContrast) are filled
   const ds=members.map(i=>d[i]).sort((a,b)=>a-b);if(ds[ds.length>>1]<holeContrast)continue;
   for(const i of members){alpha[i]=1;cls[i]=3;}
  }}
 return cls;
}

/** Foreground colours for semi-transparent pixels. Flat backdrop: exact un-mixing. Otherwise blur-fusion
 * estimation at <= `work` px. Writes into `out` (RGBA) for pixels with alpha < `opaque`. */
export function estimateForeground(rgba,w,h,alpha,out,{backdrop=null,work=2048,opaque=.98}={}){
 const n=w*h;
 if(backdrop){const B=backdrop;
  for(let i=0;i<n;i++){const a=alpha[i];if(a>=opaque||a<=.004)continue;
   for(let c=0;c<3;c++)out[i*4+c]=Math.max(0,Math.min(255,Math.round(B[c]+(rgba[i*4+c]-B[c])/Math.max(a,.05))));}
  return out;}
 const s=Math.min(1,work/Math.max(w,h)),ww=Math.max(1,Math.round(w*s)),hh=Math.max(1,Math.round(h*s)),m=ww*hh;
 const I=guidePlanes(rgba,w,h,ww,hh),A=resizePlane(alpha,w,h,ww,hh);
 let F=I.map(p=>Float32Array.from(p)),Bk=I.map(p=>Float32Array.from(p));
 for(const r of [Math.max(1,Math.round(90*s)),Math.max(1,Math.round(6*s))]){
  const bA=boxFilter(A,ww,hh,r),inv=new Float32Array(m);for(let i=0;i<m;i++)inv[i]=1-A[i];
  const nF=[],nB=[];
  for(let c=0;c<3;c++){
   const fa=new Float32Array(m),b1a=new Float32Array(m);for(let i=0;i<m;i++){fa[i]=F[c][i]*A[i];b1a[i]=Bk[c][i]*inv[i];}
   const bF=boxFilter(fa,ww,hh,r),bB=boxFilter(b1a,ww,hh,r),f=new Float32Array(m),b=new Float32Array(m);
   for(let i=0;i<m;i++){const blF=bF[i]/(bA[i]+1e-5),blB=bB[i]/(1-bA[i]+1e-5);b[i]=blB;f[i]=clamp01(blF+A[i]*(I[c][i]-A[i]*blF-(1-A[i])*blB));}
   nF.push(f);nB.push(b);}
  F=nF;Bk=nB;
 }
 const up=F.map(p=>ww===w&&hh===h?p:resizePlane(p,ww,hh,w,h));
 for(let i=0;i<n;i++){const a=alpha[i];if(a>=opaque||a<=.004)continue;for(let c=0;c<3;c++)out[i*4+c]=Math.round(up[c][i]*255);}
 return out;
}

/** Full refinement. `prob` = model probability (pw x ph, 0..1). Options:
 *  guided (true)    colour-guided alpha; false = plain bilinear upsampling
 *  backdrop ('auto') flat-backdrop handling; 'off' never
 *  cleanup (true)   edge colour un-mixing
 * @returns {rgba:Uint8ClampedArray, alpha:Float32Array, report} */
export function refineMatte(rgba,w,h,prob,pw,ph,{guided=true,backdrop='auto',cleanup=true,work=1024,eps=1e-3,radius=null,band=3,flood=.5,fill=true}={}){
 const alpha=guided?guidedAlpha(rgba,w,h,prob,pw,ph,{work,eps,radius}):resizePlane(prob,pw,ph,w,h);
 const bd=backdrop==='off'?null:detectBackdrop(rgba,w,h,alpha);
 let cleared=0,edge=0,filled=0;
 if(bd){const cls=sheetEdges(rgba,w,h,alpha,bd.color,{band,flood,fill});for(const c of cls){if(c===1)cleared++;else if(c===2)edge++;else if(c===3)filled++;}}
 const out=new Uint8ClampedArray(rgba);
 if(cleanup)estimateForeground(rgba,w,h,alpha,out,{backdrop:bd?.color||null});
 for(let i=0;i<w*h;i++)out[i*4+3]=Math.round(rgba[i*4+3]*alpha[i]);
 return {rgba:out,alpha,report:{refinement:guided?'colour-guided filter':'bilinear',backdrop:bd?{color:bd.color,share:bd.share,cleared,edge,filled}:null,cleanup:cleanup?(bd?'known backdrop':'blur fusion'):'off'}};
}
