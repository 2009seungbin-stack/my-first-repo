/** Rectangle bins for the Studio packer. Pure, deterministic, no pixels.
 *
 * Three families, each placing one rectangle at a time into a W×H bin:
 *
 *  * **MaxRects** (Jylänki 2010, "A Thousand Ways to Pack the Bin") with the five placement rules
 *    TexturePacker offers: best short side fit (bssf), best long side fit (blsf), best area fit
 *    (baf), bottom-left (bl — top-left in our y-down space) and contact point (cp).
 *  * **Skyline** bottom-left and min-waste (fast, good for many similar sizes).
 *  * **Guillotine** best-area-fit with the shorter-leftover-axis split.
 *
 * Every bin takes `{w,h}` sizes and may rotate a rectangle by 90° when `rotate` is set; a rotated
 * placement reports `rot:true` and the ROTATED footprint in w/h. Ties are broken by the order in
 * which candidates are visited, which only depends on the input — so the same input always gives
 * the same layout (no Math.random, no time budget, no Map-iteration surprises). */
export const MAXRECTS_HEURISTICS=Object.freeze(['bssf','blsf','baf','bl','cp']);
export const ALGORITHMS=Object.freeze(['maxrects','skyline','guillotine']);

const overlapLen=(a0,a1,b0,b1)=>a1<b0||b1<a0?0:Math.min(a1,b1)-Math.max(a0,b0);
const contains=(a,b)=>b.x>=a.x&&b.y>=a.y&&b.x+b.w<=a.x+a.w&&b.y+b.h<=a.y+a.h;

export class MaxRectsBin{
 /** `openBottom`: the bin is a strip whose height is only a limit, so touching its bottom wall
  * is not "contact" (otherwise the contact-point rule would stack everything at the far end). */
 constructor(width,height,{heuristic='bssf',rotate=false,openBottom=false}={}){
  if(!MAXRECTS_HEURISTICS.includes(heuristic))throw Error(`Unknown MaxRects heuristic ${heuristic}`);
  this.width=width;this.height=height;this.heuristic=heuristic;this.rotate=rotate;this.openBottom=openBottom;
  this.free=[{x:0,y:0,w:width,h:height}];this.used=[];
  // placed rects indexed by edge coordinate, so a contact score only looks at real neighbours
  this.byLeft=new Map();this.byRight=new Map();this.byTop=new Map();this.byBottom=new Map();
 }
 /** Contact score of a candidate: edge length shared with the bin walls and placed rects. */
 contact(x,y,w,h){
  let s=0;
  if(x===0||x+w===this.width)s+=h;
  if(y===0||(!this.openBottom&&y+h===this.height))s+=w;
  for(const u of this.byRight.get(x)||[])s+=overlapLen(u.y,u.y+u.h,y,y+h);
  for(const u of this.byLeft.get(x+w)||[])s+=overlapLen(u.y,u.y+u.h,y,y+h);
  for(const u of this.byBottom.get(y)||[])s+=overlapLen(u.x,u.x+u.w,x,x+w);
  for(const u of this.byTop.get(y+h)||[])s+=overlapLen(u.x,u.x+u.w,x,x+w);
  return s;
 }
 /** Best position for a w×h rectangle, or null. Scores are minimised (s1, then s2). */
 find(w,h){
  let best=null;
  const H=this.heuristic;
  const consider=(f,rw,rh,rot)=>{
   if(rw>f.w||rh>f.h)return;
   const dw=f.w-rw,dh=f.h-rh;let s1,s2;
   if(H==='bssf'){s1=Math.min(dw,dh);s2=Math.max(dw,dh);}
   else if(H==='blsf'){s1=Math.max(dw,dh);s2=Math.min(dw,dh);}
   else if(H==='baf'){s1=f.w*f.h-rw*rh;s2=Math.min(dw,dh);}
   else if(H==='bl'){s1=f.y+rh;s2=f.x;}
   else{s1=-this.contact(f.x,f.y,rw,rh);s2=f.y*this.width+f.x;}
   if(!best||s1<best.s1||(s1===best.s1&&s2<best.s2))best={x:f.x,y:f.y,w:rw,h:rh,rot,s1,s2};
  };
  for(const f of this.free){
   consider(f,w,h,false);
   if(this.rotate&&w!==h)consider(f,h,w,true);
  }
  return best;
 }
 place(node){
  const keep=[],made=[];
  for(const f of this.free){
   if(node.x>=f.x+f.w||node.x+node.w<=f.x||node.y>=f.y+f.h||node.y+node.h<=f.y){keep.push(f);continue;}
   if(node.x>f.x)made.push({x:f.x,y:f.y,w:node.x-f.x,h:f.h});
   if(node.x+node.w<f.x+f.w)made.push({x:node.x+node.w,y:f.y,w:f.x+f.w-node.x-node.w,h:f.h});
   if(node.y>f.y)made.push({x:f.x,y:f.y,w:f.w,h:node.y-f.y});
   if(node.y+node.h<f.y+f.h)made.push({x:f.x,y:node.y+node.h,w:f.w,h:f.y+f.h-node.y-node.h});
  }
  // Prune: old free rects never contain each other (invariant), so only the new pieces need
  // checking against everything, and the old ones against the surviving new pieces.
  const fresh=[];
  outer:for(let i=0;i<made.length;i++){
   const a=made[i];
   for(const k of keep)if(contains(k,a))continue outer;
   for(let j=0;j<made.length;j++){if(j===i)continue;const b=made[j];if(contains(b,a)&&(!contains(a,b)||j<i))continue outer;}
   fresh.push(a);
  }
  this.free=keep.filter(k=>!fresh.some(n=>contains(n,k))).concat(fresh);
  const u={x:node.x,y:node.y,w:node.w,h:node.h};this.used.push(u);
  const add=(m,k)=>{const l=m.get(k);if(l)l.push(u);else m.set(k,[u]);};
  add(this.byLeft,u.x);add(this.byRight,u.x+u.w);add(this.byTop,u.y);add(this.byBottom,u.y+u.h);
 }
 insert(w,h){const n=this.find(w,h);if(!n)return null;this.place(n);return {x:n.x,y:n.y,w:n.w,h:n.h,rot:n.rot};}
}

/** Skyline: the top outline of what is placed, as segments {x,y,w}. 'bl' puts a rectangle where
 * its bottom is highest up; 'waste' where it leaves the least unusable area under it. */
export class SkylineBin{
 constructor(width,height,{heuristic='bl',rotate=false}={}){
  if(!['bl','waste'].includes(heuristic))throw Error(`Unknown Skyline heuristic ${heuristic}`);
  this.width=width;this.height=height;this.heuristic=heuristic;this.rotate=rotate;this.sky=[{x:0,y:0,w:width}];
 }
 fitAt(i,w,h){
  const s=this.sky;if(s[i].x+w>this.width)return null;
  let y=s[i].y,left=w,j=i,waste=0;
  while(left>0){if(j>=s.length)return null;y=Math.max(y,s[j].y);if(y+h>this.height)return null;left-=s[j].w;j++;}
  // waste = area between the skyline and the rectangle's bottom
  left=w;j=i;while(left>0){const take=Math.min(left,s[j].w);waste+=(y-s[j].y)*take;left-=take;j++;}
  return {y,waste};
 }
 find(w,h){
  let best=null;
  for(let i=0;i<this.sky.length;i++)for(const rot of this.rotate&&w!==h?[false,true]:[false]){
   const rw=rot?h:w,rh=rot?w:h,f=this.fitAt(i,rw,rh);if(!f)continue;
   const s1=this.heuristic==='bl'?f.y+rh:f.waste,s2=this.heuristic==='bl'?this.sky[i].x:f.y+rh;
   if(!best||s1<best.s1||(s1===best.s1&&s2<best.s2))best={x:this.sky[i].x,y:f.y,w:rw,h:rh,rot,s1,s2,i};
  }
  return best;
 }
 place(n){
  const s=this.sky,seg={x:n.x,y:n.y+n.h,w:n.w};
  s.splice(n.i,0,seg);
  for(let k=n.i+1;k<s.length;k++){
   const prev=s[k-1],cur=s[k];
   if(cur.x<prev.x+prev.w){const shrink=prev.x+prev.w-cur.x;if(cur.w<=shrink){s.splice(k,1);k--;}else{cur.x+=shrink;cur.w-=shrink;break;}}else break;
  }
  for(let k=0;k<s.length-1;k++)if(s[k].y===s[k+1].y){s[k].w+=s[k+1].w;s.splice(k+1,1);k--;}
 }
 insert(w,h){const n=this.find(w,h);if(!n)return null;this.place(n);return {x:n.x,y:n.y,w:n.w,h:n.h,rot:n.rot};}
}

/** Guillotine: disjoint free rectangles; best area fit, split along the shorter leftover axis. */
export class GuillotineBin{
 constructor(width,height,{rotate=false}={}){this.width=width;this.height=height;this.rotate=rotate;this.free=[{x:0,y:0,w:width,h:height}];}
 find(w,h){
  let best=null;
  this.free.forEach((f,i)=>{for(const rot of this.rotate&&w!==h?[false,true]:[false]){
   const rw=rot?h:w,rh=rot?w:h;if(rw>f.w||rh>f.h)continue;
   const s1=f.w*f.h-rw*rh,s2=Math.min(f.w-rw,f.h-rh);
   if(!best||s1<best.s1||(s1===best.s1&&s2<best.s2))best={x:f.x,y:f.y,w:rw,h:rh,rot,s1,s2,i};
  }});
  return best;
 }
 place(n){
  const f=this.free[n.i];this.free.splice(n.i,1);
  const dw=f.w-n.w,dh=f.h-n.h,splitH=dw<=dh;// shorter leftover axis
  const right={x:f.x+n.w,y:f.y,w:dw,h:splitH?n.h:f.h},bottom={x:f.x,y:f.y+n.h,w:splitH?f.w:n.w,h:dh};
  if(right.w>0&&right.h>0)this.free.push(right);
  if(bottom.w>0&&bottom.h>0)this.free.push(bottom);
 }
 insert(w,h){const n=this.find(w,h);if(!n)return null;this.place(n);return {x:n.x,y:n.y,w:n.w,h:n.h,rot:n.rot};}
}

export function makeBin(algorithm,heuristic,w,h,rotate,{openBottom=false}={}){
 if(algorithm==='maxrects')return new MaxRectsBin(w,h,{heuristic,rotate,openBottom});
 if(algorithm==='skyline')return new SkylineBin(w,h,{heuristic,rotate});
 if(algorithm==='guillotine')return new GuillotineBin(w,h,{rotate});
 throw Error(`Unknown packing algorithm ${algorithm}`);
}
/** Heuristics tried for an algorithm when the user leaves "best" selected. */
export const heuristicsOf=algorithm=>algorithm==='maxrects'?MAXRECTS_HEURISTICS:algorithm==='skyline'?['bl','waste']:['baf'];
