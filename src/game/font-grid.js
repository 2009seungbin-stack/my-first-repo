/** Dropping a bitmap-font sheet: find its glyph grid and the character order it most likely
 * follows, so the sheet shows glyphs at once instead of waiting for a typed order. Pure: RGBA in
 * (background already transparent — see color-key.js), plain data out.
 *
 * Tries the column counts font sheets are made with (16 or 18 across, 32 across…) with every row
 * count that fits, and keeps the grid whose cells hold separate glyphs: little ink crossing a cell
 * boundary, and few cells whose ink falls apart into two side-by-side pieces (the sign of a cell
 * two glyphs wide). The order then follows from the count: 256 cells → code page 437; an empty
 * first cell or 95/96 cells → ASCII from the space (32); 94 glyphs and no space → from "!" (33).
 * Every guess carries a confidence and reasons, and the order stays editable in the UI. */
/** Code page 437 (the IBM PC font most 256-glyph bitmap fonts copy): index → character. Index 0
 * and 255 are blank cells in the font and are mapped to NUL and NBSP. */
export const CP437=Array.from('\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼'
 +' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂'
 +'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ'
 +'áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐'
 +'└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀'
 +'αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ');
export const FONT_COLUMNS=Object.freeze([8,10,12,13,14,15,16,18,19,20,24,26,30,32,40,48,64]);
/** @param img {data,width,height} RGBA, background transparent
 * @returns null | {cellW,cellH,cols,rows,cells,nonEmpty,first,preset,chars,glyphs,confidence,score,reasons,alternatives} */
export function detectFontGrid(img,{threshold=8}={}){
 const {data,width:W,height:H}=img||{};
 if(!data||data.length!==W*H*4)throw Error('Needs {data,width,height} RGBA pixels');
 const ink=new Uint8Array(W*H);let total=0;
 for(let p=0;p<W*H;p++)if(data[p*4+3]>threshold){ink[p]=1;total++;}
 if(!total)return null;
 const results=[];
 for(const cols of FONT_COLUMNS){
  const cellW=Math.floor(W/cols);if(cellW<4||W-cols*cellW>=Math.max(2,cellW/2))continue;
  for(let rows=1;rows<=32;rows++){
   const cellH=Math.floor(H/rows);if(cellH<4||H-rows*cellH>=Math.max(2,cellH/2))continue;
   const aspect=cellH/cellW;if(aspect<.7||aspect>3)continue;
   let cross=0,split=0,splitY=0,nonEmpty=0,firstEmpty=false,outside=0;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(!ink[y*W+x])continue;
    if(x>=cols*cellW||y>=rows*cellH){outside++;continue;}
    if(x%cellW===cellW-1&&x+1<cols*cellW&&ink[y*W+x+1])cross++;
    if(y%cellH===cellH-1&&y+1<rows*cellH&&ink[(y+1)*W+x])cross++;
   }
   for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x0=c*cellW,y0=r*cellH,colInk=new Uint8Array(cellW),rowInk=new Uint8Array(cellH);let any=false;
    for(let y=y0;y<y0+cellH;y++)for(let x=x0;x<x0+cellW;x++)if(ink[y*W+x]){colInk[x-x0]=1;rowInk[y-y0]=1;any=true;}
    if(!any){if(r===0&&c===0)firstEmpty=true;continue;}
    nonEmpty++;
    // Two side-by-side ink groups separated by a wide gap (≥ a quarter cell): a cell holding two
    // glyphs. A quote mark's two strokes are closer than that.
    const first=colInk.indexOf(1),last=colInk.lastIndexOf(1);let run=0,wide=false;
    for(let x=first;x<=last;x++){if(colInk[x])run=0;else if(++run>=Math.max(2,Math.round(cellW/4)))wide=true;}
    if(wide)split++;
    // The same one above the other: a cell two glyphs tall. ':' '=' 'i' also have vertical gaps,
    // so this counts for less.
    const top=rowInk.indexOf(1),bottom=rowInk.lastIndexOf(1);run=0;let tall=false;
    for(let y=top;y<=bottom;y++){if(rowInk[y])run=0;else if(++run>=Math.max(2,Math.round(cellH/4)))tall=true;}
    if(tall)splitY++;
   }
   const cells=cols*rows,crossRatio=cross/total,splitRatio=nonEmpty?(split+splitY*.5)/nonEmpty:1;
   const plausible=[94,95,96,128,256].some(n=>Math.abs(nonEmpty-n)<=2)||[95,96,128,256].includes(cells);
   const score=Math.max(0,1-crossRatio*6-splitRatio*1.2-outside/total)*(plausible?1:.85)*(nonEmpty>=cells*.5?1:.9);
   results.push({cellW,cellH,cols,rows,cells,nonEmpty,firstEmpty,score,crossRatio,splitRatio});
  }
 }
 if(!results.length)return null;
 // Best score; among near-ties the smaller cell (more glyphs): a cell two glyphs wide only ties
 // with the true one when the split test is fooled, never beats it.
 results.sort((a,b)=>b.score-a.score||a.cellW*a.cellH-b.cellW*b.cellH);
 const top=results[0],best=results.filter(r=>r.score>=top.score-.03).sort((a,b)=>a.cellW*a.cellH-b.cellW*b.cellH)[0];
 let first=32,preset='ascii';
 if(best.cells===256||best.cells===128&&!best.firstEmpty){first=0;preset='cp437';}
 else if(!best.firstEmpty&&best.nonEmpty<=94)first=33;
 const count=preset==='cp437'?best.cells:Math.min(best.cells,127-first);
 const chars=preset==='cp437'?CP437.slice(0,count).join(''):Array.from({length:count},(_,i)=>String.fromCharCode(first+i)).join('');
 const rival=results.find(r=>r.cellW!==best.cellW||r.cellH!==best.cellH);
 const lead=rival?best.score-rival.score:1;
 const confidence=best.score>=.85&&lead>=.05?'high':best.score>=.6?'medium':'low';
 const reasons=[`${best.cols}×${best.rows} cells of ${best.cellW}×${best.cellH}px, ${best.nonEmpty} with ink`,
  `${Math.round(best.crossRatio*1000)/10}% of the ink crosses a cell boundary`,
  `${Math.round(best.splitRatio*100)}% of the cells hold two side-by-side pieces`,
  preset==='cp437'?`${best.cells} cells: code page 437 order from 0`:first===33?'no space cell: ASCII from "!" (33)':'ASCII from the space (32)'];
 return {cellW:best.cellW,cellH:best.cellH,cols:best.cols,rows:best.rows,cells:best.cells,nonEmpty:best.nonEmpty,first,preset,chars,
  glyphs:Array.from(chars).length,confidence,score:+best.score.toFixed(3),reasons,
  alternatives:results.filter(r=>r!==best).slice(0,3).map(r=>({cellW:r.cellW,cellH:r.cellH,cols:r.cols,rows:r.rows,score:+r.score.toFixed(3)}))};
}
