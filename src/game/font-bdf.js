/** Adobe BDF 2.1 bitmap importer. Pure and deliberately strict about bitmap rows. */
export function parseBdf(source){
 const rows=String(source).replace(/\r\n?/g,'\n').split('\n');
 const problem=(line,message)=>{throw Error(`BDF line ${line}: ${message}`);};
 if(!/^STARTFONT\s+2(?:\.\d+)?$/.test(rows[0]?.trim()||''))problem(1,'expected STARTFONT 2.x');
 const values=new Map(),properties=new Map(),glyphs=[];let expected=null,seen=0,end=false;
 const number=(part,line,label)=>{if(!/^-?\d+$/.test(part||''))problem(line,`invalid ${label}`);return Number(part);};
 let i=1;
 while(i<rows.length){
  const line=rows[i].trim(),lineNo=i+1;i++;
  if(!line)continue;
  if(line==='ENDFONT'){end=true;break;}
  if(line.startsWith('STARTPROPERTIES ')){
   const count=number(line.split(/\s+/)[1],lineNo,'property count');
   for(let n=0;n<count;n++){
    if(i>=rows.length)problem(i+1,'missing property');
    const value=rows[i++].trim(),m=/^(\w+)\s+(.+)$/.exec(value);if(!m)problem(i,'invalid property');properties.set(m[1],m[2].replace(/^"|"$/g,''));
   }
   if(rows[i]?.trim()!=='ENDPROPERTIES')problem(i+1,'expected ENDPROPERTIES');i++;continue;
  }
  if(line.startsWith('CHARS ')){expected=number(line.split(/\s+/)[1],lineNo,'glyph count');continue;}
  if(!line.startsWith('STARTCHAR ')){
   const m=/^(\w+)\s+(.+)$/.exec(line);if(m)values.set(m[1],m[2]);continue;
  }
  const name=line.slice(10).trim();let encoding=null,advance=null,box=null,bitmap=null,finished=false;
  for(;i<rows.length;){
   const field=rows[i].trim(),at=i+1;i++;
   if(field==='ENDCHAR'){finished=true;break;}
   if(field.startsWith('ENCODING ')){const parts=field.split(/\s+/);encoding=number(parts[1],at,'encoding');if(encoding===-1&&parts[2])encoding=number(parts[2],at,'secondary encoding');}
   else if(field.startsWith('DWIDTH ')){const parts=field.split(/\s+/);advance=number(parts[1],at,'DWIDTH');}
   else if(field.startsWith('BBX ')){const parts=field.split(/\s+/);if(parts.length!==5)problem(at,'invalid BBX');box=parts.slice(1).map((part,j)=>number(part,at,`BBX ${j}`));}
   else if(field==='BITMAP'){
    if(!box)problem(at,'BITMAP before BBX');
    const [w,h]=box;if(w<0||h<0||w>4096||h>4096)problem(at,'BBX outside supported range');
    const bytes=Math.ceil(w/8),mask=new Uint8Array(w*h);
    for(let y=0;y<h;y++){
     if(i>=rows.length)problem(i+1,'missing bitmap row');
     const hex=rows[i++].trim();if(!/^[0-9a-fA-F]*$/.test(hex)||hex.length!==bytes*2)problem(i,`BITMAP row needs ${bytes*2} hex digits`);
     for(let x=0;x<w;x++)mask[y*w+x]=(parseInt(hex.slice((x>>3)*2,(x>>3)*2+2),16)>>(7-(x&7)))&1;
    }
    bitmap=mask;
   }
  }
  if(!finished)problem(i,'missing ENDCHAR');
  seen++;
  if(encoding===null||advance===null||!box||!bitmap)problem(lineNo,`incomplete glyph ${name}`);
  if(encoding<-1||encoding>0x10ffff)problem(lineNo,'encoding outside Unicode range');
  if(encoding>=0)glyphs.push({name,codepoint:encoding,char:String.fromCodePoint(encoding),w:box[0],h:box[1],xOffset:box[2],bottomOffset:box[3],xAdvance:advance,mask:bitmap});
 }
 if(!end)problem(rows.length,'missing ENDFONT');
 if(expected===null||expected!==seen)problem(rows.length,`CHARS count ${expected} differs from ${seen} glyphs`);
 if(new Set(glyphs.map(g=>g.codepoint)).size!==glyphs.length)problem(rows.length,'duplicate Unicode encoding');
 const fontBox=(values.get('FONTBOUNDINGBOX')||'').split(/\s+/).map(Number);
 const ascent=Number(properties.get('FONT_ASCENT')??(fontBox.length===4?fontBox[1]+fontBox[3]:NaN));
 const descent=Number(properties.get('FONT_DESCENT')??(fontBox.length===4?-fontBox[3]:NaN));
 if(!Number.isInteger(ascent)||!Number.isInteger(descent)||ascent<0||descent<0)problem(1,'missing valid ascent/descent');
 return {format:'nerulio-bdf-import-v1',face:(values.get('FONT')||'Imported BDF').replace(/^"|"$/g,''),ascent,descent,lineHeight:ascent+descent,
  glyphs:glyphs.map(g=>({...g,yOffset:ascent-g.bottomOffset-g.h}))};
}
