import test from 'node:test';import assert from 'node:assert/strict';
import {BAYER,DITHER_MODES,ditherKernel,quantizeIndexed,oklab} from '../src/pixel-engine.js';
import {extract,usage,sortPalette,rampOf,generateRamp,rampMap,hueWindow,hueReplace,tint,teamVariants,STATUS_PRESETS,TEAM_COLORS,
 auditBudget,mergePlan,lockFrame,recolorIndexed,remapIndices,flickers,parseGPL,toGPL,parseHexList,toHexText,toPaletteJSON,
 parsePaletteJSON,parsePaletteFile,serializePalette,hex,parseColor,okLCh,fromOkLCh,lightness} from '../src/game/palette.js';
/** A frame of flat colour blocks plus one "moving" pixel, so a region can be proven unchanged. */
function frameOf(w,h,colors,move=-1){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,c=colors[(y*3+x)%colors.length];
  data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255;
 }
 if(move>=0){const i=((h-1)*w+move%w)*4;data[i]=255;data[i+1]=255;data[i+2]=255;}
 return {data,width:w,height:h};
}
test('Bayer matrices are the exact recursive construction and Atkinson keeps 6/8 of the error',()=>{
 assert.deepEqual([...BAYER[2]],[0,2,3,1]);
 assert.deepEqual([...BAYER[4]],[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]);
 assert.deepEqual([...BAYER[8]].slice(0,8),[0,32,8,40,2,34,10,42]);
 assert.deepEqual([...BAYER[8]].slice(48,56),[15,47,7,39,13,45,5,37]);
 assert.deepEqual([...BAYER[8]].slice(56),[63,31,55,23,61,29,53,21]);
 for(const n of [2,4,8])assert.deepEqual([...BAYER[n]].sort((a,b)=>a-b),Array.from({length:n*n},(_,i)=>i));
 const atkinson=ditherKernel('atkinson');
 assert.equal(atkinson.weights.reduce((s,[,,w])=>s+w,0),6/8);
 assert.equal(atkinson.rows,3);
 assert.equal(ditherKernel('floyd-steinberg').weights.reduce((s,[,,w])=>s+w,0),1);
 for(const alias of ['ordered','bayer','bayer4'])assert.deepEqual(ditherKernel(alias).matrix,BAYER[4]);
 assert.equal(ditherKernel('none').kind,'none');
 assert.deepEqual(DITHER_MODES.filter(m=>flickers(m)),['floyd-steinberg','atkinson']);
});
test('one palette is extracted from ALL frames at once and never exceeds the requested count',()=>{
 // Eight frames of the same three colours; only the last frame holds the rare fourth colour.
 const base=[[20,24,34],[80,160,90],[220,210,120]];
 const frames=Array.from({length:8},(_,i)=>frameOf(6,6,base,i===7?2:-1));
 for(const n of [4,8,16,32,64]){
  const {colors}=extract(frames,n);
  assert(colors.length<=n,`asked ${n}, got ${colors.length}`);
  assert(colors.every(c=>c.length===3&&c.every(v=>Number.isInteger(v)&&v>=0&&v<=255)));
 }
 const {colors}=extract(frames,4);
 const {counts,opaque,share}=usage(frames,colors);
 assert.equal(opaque,8*36);
 assert.equal(counts.reduce((a,b)=>a+b,0),opaque);
 assert(Math.abs(share.reduce((a,b)=>a+b,0)-1)<1e-9);
 // The white pixel lives in one frame only; a shared histogram still gives it an entry.
 assert(colors.some(c=>c.every(v=>v>200)),'rare fourth colour survived the shared histogram');
 // A lopsided weight split used to push the median past the last point of a box, leaving an
 // empty box whose average was NaN — a silently wasted palette slot.
 const lopsided=new Uint8ClampedArray(4*1*4);
 lopsided.set([10,10,10,255],0);for(let p=1;p<4;p++)lopsided.set([240,240,240,255],p*4);
 for(const n of [2,3,4]){
  const skewed=extract([{data:lopsided,width:4,height:1}],n).colors;
  assert(skewed.length>=1&&skewed.length<=n);
  for(const c of skewed)assert(c.every(Number.isFinite),`NaN colour for ${n}: ${JSON.stringify(skewed)}`);
 }
 // Transparent pixels never enter the histogram.
 const blank={data:new Uint8ClampedArray(4*4*4),width:4,height:4};
 assert.deepEqual(extract([blank],8).colors,[[0,0,0]]);
 assert.throws(()=>extract([{data:new Uint8ClampedArray(3),width:1,height:1}],4),/RGBA pixels/);
});
test('a locked palette bounds every frame and keeps identical indices where pixels did not change',()=>{
 const base=[[20,24,34],[80,160,90],[220,210,120],[190,60,70]];
 const frames=Array.from({length:9},(_,i)=>frameOf(8,8,base,i));
 const {colors}=extract(frames,8),allowed=new Set(colors.map(c=>hex(c)));
 for(const mode of ['none','bayer4']){
  const locked=frames.map(f=>lockFrame(f,colors,{mode,amount:1}));
  const union=new Set();
  for(const l of locked)for(let i=0;i<l.data.length;i+=4)if(l.data[i+3])union.add(hex([l.data[i],l.data[i+1],l.data[i+2]]));
  for(const c of union)assert(allowed.has(c),`${c} is outside the locked palette (${mode})`);
  // Rows 0..6 are identical in every frame; only the last row carries the moving pixel.
  const reference=locked[0].indices;
  for(const l of locked)for(let p=0;p<8*7;p++)assert.equal(l.indices[p],reference[p],`index drift at ${p} (${mode})`);
 }
 // Error diffusion is the mode that can drift: its running error crosses the whole frame.
 const diffused=frames.map(f=>lockFrame(f,colors,{mode:'floyd-steinberg',amount:1}));
 assert(diffused.every(l=>l.indices.length===64));
 assert(flickers('floyd-steinberg')&&!flickers('bayer4')&&!flickers('none'));
});
test('index recolouring keeps alpha, and remapping follows a merge plan',()=>{
 const frame=frameOf(4,4,[[10,10,10],[200,30,30]]);
 frame.data[3]=0;// one transparent pixel
 const colors=[[10,10,10],[200,30,30]],{indices,alpha}=lockFrame(frame,colors);
 assert.equal(alpha[0],0);assert.equal(alpha[1],255);
 const out=recolorIndexed(indices,alpha,[[0,0,255],[255,255,0]],{width:4,height:4});
 assert.equal(out.data[3],0);
 assert.deepEqual([...out.data.slice(4,8)],[...(indices[1]===0?[0,0,255,255]:[255,255,0,255])]);
 const moved=remapIndices(indices,[1,1]);
 for(let p=0;p<moved.length;p++)assert.equal(moved[p],indices[p]<0?-1:1);
 assert.throws(()=>recolorIndexed(indices,new Uint8ClampedArray(8),colors),/different images/);
});
test('sorting is by real OkLCh values and reports the permutation',()=>{
 const colors=[[255,255,255],[0,0,0],[200,30,30],[128,128,128],[30,80,200]];
 const byL=sortPalette(colors,'luminance');
 assert.deepEqual(byL.colors[0],[0,0,0]);assert.deepEqual(byL.colors[4],[255,255,255]);
 assert.deepEqual(byL.order.map(i=>colors[i]),byL.colors);
 const byFrequency=sortPalette(colors,'frequency',[1,9,3,0,5]);
 assert.deepEqual(byFrequency.colors[0],[0,0,0]);
 const byHue=sortPalette(colors,'hue');
 // Greys have no hue, so they are grouped at the end instead of landing at a random angle.
 assert(byHue.colors.slice(-3).every(c=>c[0]===c[1]&&c[1]===c[2]));
 assert.deepEqual(sortPalette(colors,'original').colors,colors);
 assert.throws(()=>sortPalette(colors,'brightness'),/Unknown palette sort/);
});
test('OkLCh round-trips and a generated ramp reuses the source ramp lightness steps',()=>{
 for(const c of [[12,14,20],[240,200,60],[60,120,200],[255,255,255]]){
  const back=fromOkLCh(okLCh(c));
  assert(back.every((v,i)=>Math.abs(v-c[i])<=1),`${hex(c)} → ${hex(back)}`);
 }
 const source=[[40,30,60],[120,70,90],[210,160,140]],ramp=generateRamp([60,110,210],source);
 assert.equal(ramp.length,3);
 const wanted=rampOf(source).map(lightness),got=ramp.map(lightness);
 for(let i=0;i<3;i++)assert(Math.abs(got[i]-wanted[i])<.02,`step ${i}: ${got[i]} vs ${wanted[i]}`);
 assert(got[0]<got[1]&&got[1]<got[2]);
 assert(okLCh(ramp[1])[2]>150&&okLCh(ramp[1])[2]<290,'the ramp took the base hue');
});
test('ramp mapping preserves shading order; hue windows select by hue, not by RGB distance',()=>{
 const colors=[[30,20,40],[120,40,50],[220,120,110],[255,255,255]];
 const target=[[10,40,90],[60,140,220]];
 const mapped=rampMap(colors,[0,1,2],target);
 assert.deepEqual(mapped[3],[255,255,255],'unselected colours are untouched');
 const ls=[0,1,2].map(i=>lightness(mapped[i]));
 assert(ls[0]<=ls[1]&&ls[1]<=ls[2],'darkest source stayed darkest');
 assert.deepEqual(mapped[0],[10,40,90]);assert.deepEqual(mapped[2],[60,140,220]);
 assert.throws(()=>rampMap(colors,[],target),/source colour/);
 assert.throws(()=>rampMap(colors,[0],[]),/target colour/);
 const reds=hueWindow([[200,30,30],[30,200,60],[128,128,128],[210,90,70]],{hue:okLCh([200,30,30])[2],window:25});
 assert.deepEqual(reds,[true,false,false,true]);
 const {mask,colors:swapped}=hueReplace([[200,30,30],[120,20,20],[30,200,60]],{hue:okLCh([200,30,30])[2],window:30,target:[40,90,220]});
 assert.deepEqual(mask,[true,true,false]);
 assert.deepEqual(swapped[2],[30,200,60]);
 for(let i=0;i<2;i++)assert(Math.abs(lightness(swapped[i])-lightness([[200,30,30],[120,20,20]][i]))<.01,'lightness kept');
 assert(lightness(swapped[0])>lightness(swapped[1]),'shading order kept inside the window');
});
test('team variants and status tints reuse one index map, so relations survive',()=>{
 const colors=[[40,20,20],[150,40,40],[230,120,110],[20,30,60]];
 const variants=teamVariants(colors,[0,1,2],{red:TEAM_COLORS.red,blue:TEAM_COLORS.blue,green:TEAM_COLORS.green});
 assert.equal(variants.length,3);
 for(const v of variants){
  assert.equal(v.colors.length,colors.length);
  assert.deepEqual(v.colors[3],[20,30,60]);
  const ls=[0,1,2].map(i=>lightness(v.colors[i]));
  assert(ls[0]<ls[1]&&ls[1]<ls[2],`${v.name} kept its ramp order`);
 }
 const frozen=tint(colors,STATUS_PRESETS.frozen);
 assert.equal(frozen.length,colors.length);
 for(let i=1;i<3;i++)assert(lightness(frozen[i])>lightness(frozen[i-1]),'a tint never reorders a ramp');
 const flash=tint(colors,STATUS_PRESETS.flash);
 assert(lightness(flash[0])>lightness(colors[0]),'the damage flash lifts lightness');
});
test('budget audit names the offenders and a merge plan only merges into survivors',()=>{
 const colors=[[0,0,0],[255,255,255],[250,250,250],[1,1,1],[128,0,0]];
 const counts=[500,400,3,2,90];
 const audit=auditBudget(colors,counts,3);
 assert.deepEqual([audit.limit,audit.actual,audit.over],[3,5,2]);
 assert.deepEqual(audit.offenders.map(o=>o.index),[3,2]);
 assert(Math.abs(audit.offenders[0].share-2/995)<1e-9);
 const plan=mergePlan(colors,counts,3);
 assert.deepEqual(plan.removed,[2,3]);
 assert.deepEqual(plan.colors,[[0,0,0],[255,255,255],[128,0,0]]);
 assert.equal(plan.map[2],1,'near-white merged into white');
 assert.equal(plan.map[3],0,'near-black merged into black');
 assert.deepEqual(plan.map.filter((v,i)=>i===v),[0,1,4]);
 assert.deepEqual(mergePlan(colors,counts,9).removed,[]);
});
test('GIMP palettes round-trip exactly and refuse malformed files',()=>{
 const colors=[[26,28,44],[93,39,93],[255,205,117]],names=['dark','plum','sand'];
 const text=toGPL(colors,{name:'Sweetie test',columns:8,names});
 assert(text.startsWith('GIMP Palette\nName: Sweetie test\nColumns: 8\n#\n'));
 const back=parseGPL(text);
 assert.deepEqual(back.colors,colors);
 assert.deepEqual(back.names,names);
 assert.deepEqual([back.name,back.columns,back.format],['Sweetie test',8,'gpl']);
 assert.equal(toGPL(back.colors,{name:back.name,columns:back.columns,names:back.names}),text);
 // Tolerant of comments, blank lines, extra spacing and missing metadata.
 const messy='GIMP Palette\r\n# exported by hand\r\nName: Messy\r\n\r\n#\r\n  0   0   0\tBlack\r\n255 255 255\r\n# trailing note\r\n';
 const loose=parseGPL(messy);
 assert.deepEqual(loose.colors,[[0,0,0],[255,255,255]]);
 assert.deepEqual([loose.names[0],loose.names[1],loose.columns],['Black','',0]);
 assert.throws(()=>parseGPL('Name: nope\n0 0 0'),/first line/);
 assert.throws(()=>parseGPL('GIMP Palette\n300 0 0'),/above 255/);
 assert.throws(()=>parseGPL('GIMP Palette\nNot a colour line'),/not a GIMP palette colour/);
 assert.throws(()=>parseGPL('GIMP Palette\nColumns: 900\n0 0 0'),/Invalid Columns/);
 assert.throws(()=>parseGPL('GIMP Palette\n# nothing here'),/no colours/);
});
test('hex lists and JSON palettes round-trip, and the format is detected from content',()=>{
 const colors=[[26,28,44],[255,205,117]];
 assert.deepEqual(parseHexList(toHexText(colors)).colors,colors);
 assert.deepEqual(parseHexList('1a1c2c\nFFCD75').colors,colors);
 assert.deepEqual(parseHexList('# my palette\n#1a1c2c, #ffcd75\n// note').colors,colors);
 assert.deepEqual(parseHexList('#abc').colors,[[170,187,204]]);
 assert.throws(()=>parseHexList('not-a-colour'),/is not a colour/);
 assert.throws(()=>parseHexList('\n\n'),/No colours/);
 assert.deepEqual(parsePaletteJSON(toPaletteJSON(colors,{name:'x'})).colors,colors);
 assert.deepEqual(parsePaletteJSON('["#1a1c2c","#ffcd75"]').colors,colors);
 assert.deepEqual(parsePaletteJSON('{"colors":[[26,28,44],[255,205,117]]}').colors,colors);
 assert.throws(()=>parsePaletteJSON('{'),/not valid JSON/);
 assert.throws(()=>parsePaletteJSON('{"colors":["zz"]}'),/not a #RRGGBB/);
 assert.equal(parsePaletteFile(toGPL(colors,{name:'g'})).format,'gpl');
 assert.equal(parsePaletteFile(toPaletteJSON(colors)).format,'json');
 assert.equal(parsePaletteFile(toHexText(colors),'palette.txt').format,'hex');
 for(const format of ['gpl','hex','json'])assert.deepEqual(parsePaletteFile(serializePalette(format,colors,{name:'r'})).colors,colors);
 assert.throws(()=>serializePalette('aco',colors),/Unknown palette format/);
 assert.deepEqual([parseColor('#FFF'),parseColor('12, 34,56'),parseColor('nope')],[[255,255,255],[12,34,56],null]);
});
test('quantizeIndexed reports the index of every pixel and leaves transparency alone',()=>{
 const frame=frameOf(5,5,[[0,0,0],[255,255,255]]);
 frame.data[3]=0;
 const colors=[[0,0,0],[255,255,255]],{data,indices}=quantizeIndexed(frame.data,5,5,colors,{mode:'none'});
 assert.equal(indices[0],-1);assert.deepEqual([...data.slice(0,4)],[0,0,0,0]);
 for(let p=1;p<25;p++){
  assert(indices[p]===0||indices[p]===1);
  assert.deepEqual([...data.slice(p*4,p*4+3)],colors[indices[p]]);
 }
 assert.throws(()=>quantizeIndexed(frame.data,5,5,[],{}),/1–256/);
 assert.deepEqual(oklab(0,0,0).map(v=>Math.round(v*1000)),[0,0,0]);
});
