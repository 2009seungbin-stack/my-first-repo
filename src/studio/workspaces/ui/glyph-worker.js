/** One of the UI worker's glyph renderers: distance fields cost milliseconds per glyph, so a CJK set
 * is split across several of these. Pure rendering; the UI worker packs and assembles.
 * in  {op:'font', id, bytes}  |  {op:'render', job, id, settings, codepoints}
 * out {job, glyphs:[…], missing:[…]} with each glyph's pixels transferred */
import {parseFont} from '../../../game/ui/font/opentype.js';
import {renderGlyph,normalizeFontSettings} from '../../../game/ui/font/build.js';
const fonts=new Map();
self.onmessage=({data:m})=>{
 if(m.op==='font'){fonts.set(m.id,parseFont(new Uint8Array(m.bytes)));return;}
 if(m.op!=='render')return;
 try{
  const f=fonts.get(m.id);if(!f)throw Error('font not loaded');
  const o=normalizeFontSettings(m.settings),glyphs=[],missing=[],transfer=[];
  for(const cp of m.codepoints){const g=renderGlyph(f,cp,o);if(!g){missing.push(cp);continue;}glyphs.push(g);if(g.data)transfer.push(g.data.buffer);}
  self.postMessage({job:m.job,ok:true,glyphs,missing},transfer);
 }catch(e){self.postMessage({job:m.job,ok:false,error:String(e?.message||e)});}
};
