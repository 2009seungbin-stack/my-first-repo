/** Original deterministic comic overlays. No remote resources or untrusted SVG markup. */
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frame=(width,height,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const size=(o)=>({width:Math.round(clamp(o.width,64,4096,800)),height:Math.round(clamp(o.height,64,4096,600))});
function clipOverlay(body,w,h,o){
 const left=clamp(o.clipLeft,0,1,0),top=clamp(o.clipTop,0,1,0),right=clamp(o.clipRight,0,1,1),bottom=clamp(o.clipBottom,0,1,1);
 if(right<=left||bottom<=top)throw new RangeError('Clip right/bottom must exceed left/top');
 if(left===0&&top===0&&right===1&&bottom===1)return body;
 return `<defs><clipPath id="panel-clip"><rect x="${(left*w).toFixed(2)}" y="${(top*h).toFixed(2)}" width="${((right-left)*w).toFixed(2)}" height="${((bottom-top)*h).toFixed(2)}"/></clipPath></defs><g clip-path="url(#panel-clip)">${body}</g>`;
}
function rng(seed){let s=(Math.floor(Number(seed)||1)>>>0)||1;return ()=>((s^=s<<13,s^=s>>>17,s^=s<<5)>>>0)/4294967296;}
export function speedLines(options={}){
 const {width:w,height:h}=size(options),count=Math.round(clamp(options.count,8,400,90)),gap=clamp(options.gap,0,0.8,0.15),inner=clamp(options.inner,0.03,0.75,0.18),cx=clamp(options.cx,0,1,0.5)*w,cy=clamp(options.cy,0,1,0.5)*h,stroke=clamp(options.stroke,0.25,24,2),angle=clamp(options.angle,-180,180,0)*Math.PI/180,random=rng(options.seed);
 const diagonal=Math.hypot(w,h)*1.2,paths=[];
 for(let i=0;i<count;i++){
  if(random()<gap)continue;
  const a=(i+random()*.55)/count*Math.PI*2+angle,len=diagonal*(.68+random()*.32),start=diagonal*inner*(.8+random()*.4);
  const x1=cx+Math.cos(a)*start,y1=cy+Math.sin(a)*start,x2=cx+Math.cos(a)*len,y2=cy+Math.sin(a)*len;
  paths.push(`<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="#111" stroke-width="${(stroke*(.55+random()*.9)).toFixed(2)}" stroke-linecap="round"/>`);
 }
 return frame(w,h,clipOverlay(paths.join(''),w,h,options));
}
function balloonPath(shape,w,h,pad){
 const x=pad,y=pad,r=Math.min(35,w*.08,h*.16),bw=w-pad*2,bh=h-pad*2,tailX=w*.52,tailY=h-pad;
 if(shape==='caption')return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}"/>`;
 if(shape==='shout'){
  const cx=w/2,cy=h*.46,rx=bw*.49,ry=bh*.44,points=[];
  for(let i=0;i<24;i++){const a=i*Math.PI/12-Math.PI/2,m=i%2?.82:1;points.push(`${(cx+Math.cos(a)*rx*m).toFixed(1)},${(cy+Math.sin(a)*ry*m).toFixed(1)}`);}
  return `<polygon points="${points.join(' ')}"/>`;
 }
 if(shape==='thought')return `<ellipse cx="${w/2}" cy="${h*.43}" rx="${bw*.48}" ry="${bh*.39}"/><circle cx="${tailX}" cy="${h*.87}" r="${Math.max(4,w*.025)}"/><circle cx="${tailX+w*.05}" cy="${h*.96}" r="${Math.max(3,w*.012)}"/>`;
 return `<path d="M${x+r} ${y}H${w-x-r}Q${w-x} ${y} ${w-x} ${y+r}V${h-y-r*2}Q${w-x} ${h-y} ${w-x-r} ${h-y}H${tailX+w*.09}L${tailX-w*.03} ${h-y*.08}L${tailX} ${h-y}H${x+r}Q${x} ${h-y} ${x} ${h-y-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z"/>`;
}
export function speechBalloon(options={}){
 const {width:w,height:h}=size(options),shape=['speech','thought','shout','caption'].includes(options.shape)?options.shape:'speech',pad=Math.round(clamp(options.padding,8,80,16)),lineWidth=clamp(options.lineWidth,1,16,3),fontSize=clamp(options.fontSize,12,90,Math.min(32,h*.14)),lines=String(options.text||'').slice(0,500).split(/\r?\n/).slice(0,6),maxChars=Math.max(...lines.map(s=>Array.from(s).length),0);
 if(maxChars*fontSize*.62>w-pad*4||lines.length*fontSize*1.35>h-pad*3)throw new RangeError('Text is too long for this balloon; reduce font size or enlarge the canvas');
 const paths=balloonPath(shape,w,h,pad),start=h*.42-(lines.length-1)*fontSize*.62;
 const text=lines.map((line,i)=>`<text x="${w/2}" y="${(start+i*fontSize*1.24).toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700" fill="#111">${xml(line)}</text>`).join('');
 return frame(w,h,`<g fill="#fff" stroke="#111" stroke-width="${lineWidth}" stroke-linejoin="round">${paths}</g>${text}`);
}
export function screentone(options={}){
 const {width:w,height:h}=size(options),ppi=clamp(options.ppi,72,1200,300),lpi=clamp(options.lpi,10,150,60),pitch=ppi/lpi,density=clamp(options.density,0,0.85,0.25),angle=clamp(options.angle,-180,180,45),shape=options.shape==='line'?'line':'dot';
 if(pitch<2)throw new RangeError('PPI/LPI yields a cell smaller than 2 px; choose a lower LPI');
 const radius=Math.min(pitch*.48,pitch*Math.sqrt(density/Math.PI)),cell=shape==='dot'?`<circle cx="${(pitch/2).toFixed(3)}" cy="${(pitch/2).toFixed(3)}" r="${radius.toFixed(3)}" fill="#111"/>`:`<rect x="0" y="0" width="${pitch.toFixed(3)}" height="${(pitch*density).toFixed(3)}" fill="#111"/>`;
 return frame(w,h,`<defs><pattern id="tone" patternUnits="userSpaceOnUse" width="${pitch.toFixed(3)}" height="${pitch.toFixed(3)}" patternTransform="rotate(${angle})">${cell}</pattern></defs>${clipOverlay(`<rect width="${w}" height="${h}" fill="url(#tone)"/>`,w,h,options)}`);
}
export const EFFECTS=Object.freeze({speed:speedLines,balloon:speechBalloon,tone:screentone});
