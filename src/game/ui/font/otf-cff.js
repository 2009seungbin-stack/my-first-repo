/** CFF (Compact Font Format 1, Type 2 charstrings) outlines for the OpenType parser. Pure; no DOM.
 *
 * Covers name-keyed and CID-keyed fonts (FDArray + FDSelect formats 0/3, per-FD private local
 * subroutines), every Type 2 path operator including the four flex forms, the stem hints and
 * hintmask/cntrmask (skipped, but their mask bytes are counted from the stems declared so far,
 * implicit vstems included), callsubr/callgsubr with the standard bias, the deprecated arithmetic
 * operators, and the seac form of endchar (base + accent looked up through Standard Encoding and
 * the charset, as fontTools and FreeType do).
 *
 * The drawing mirrors fontTools' T2OutlineExtractor: every point is the previous point plus the
 * operand deltas, a moveto closes the open contour, drawing before any moveto starts at the
 * current point, and endchar closes the last contour. The width operand is detected by the usual
 * parity rule and ignored (advances come from hmtx). FontMatrix is ignored: glyph coordinates are
 * returned in charstring units, which is what OpenType requires to equal head.unitsPerEm.
 *
 * Guards: subroutine nesting ≤ 10, argument stack ≤ 513, and an operator budget per glyph, so a
 * malicious charstring cannot recurse forever or explode through fan-out. CFF2 is refused by the
 * caller before this module is reached. */
import {fail,View} from './otf-read.js';

export const MAX_SUBR_DEPTH=10;
const MAX_STACK=513,MAX_OPS=2_000_000;

function readIndex(v,off,what){
 const count=v.u16(off);
 if(!count)return {count:0,get:()=>fail(`CFF ${what}: index is empty`),end:off+2};
 const offSize=v.u8(off+2);if(offSize<1||offSize>4)fail(`CFF ${what}: invalid offset size ${offSize}`);
 const offs=off+3,base=offs+(count+1)*offSize-1;
 v.need(offs,count+1,offSize,`${what} offsets`);
 const at=i=>{let o=0;for(let k=0;k<offSize;k++)o=o*256+v.u8(offs+i*offSize+k);return o;};
 const last=at(count);if(base+last>v.length)fail(`CFF ${what}: data runs past the CFF table — the font is truncated or corrupt`);
 return {count,end:base+last,get(i){
  if(!(i>=0&&i<count))fail(`CFF ${what}: index ${i} out of range`);
  const a=at(i),b=at(i+1);if(a<1||b<a||b>last)fail(`CFF ${what}: corrupt offsets for entry ${i}`);
  return [base+a,base+b];
 }};
}

function readDict(v,start,end){
 const d=new Map(),ops=[];let p=start;
 while(p<end){
  const b=v.u8(p);
  if(b<=21){let op=b;p++;if(b===12){op=1200+v.u8(p);p++;}d.set(op,ops.splice(0));continue;}
  if(b===28){ops.push(v.i16(p+1));p+=3;}
  else if(b===29){ops.push(v.i32(p+1));p+=5;}
  else if(b===30){// real number, BCD nibbles
   let s='';p++;
   for(let done=false;!done;p++){
    const n=v.u8(p);
    for(const nib of [n>>4,n&15]){
     if(nib<10)s+=nib;else if(nib===10)s+='.';else if(nib===11)s+='E';else if(nib===12)s+='E-';else if(nib===14)s+='-';else if(nib===15){done=true;break;}
    }
   }
   ops.push(Number(s)||0);
  }
  else if(b>=32&&b<=246){ops.push(b-139);p++;}
  else if(b>=247&&b<=250){ops.push((b-247)*256+v.u8(p+1)+108);p+=2;}
  else if(b>=251&&b<=254){ops.push(-(b-251)*256-v.u8(p+1)-108);p+=2;}
  else fail(`CFF: invalid DICT byte ${b}`);
  if(ops.length>MAX_STACK)fail('CFF: DICT operand stack overflow');
 }
 return d;
}
const bias=n=>n<1240?107:n<33900?1131:32768;

// Standard Encoding code → SID (codes 32–126 are SIDs 1–95; the rest listed in SID order 96–149).
const STD_HIGH=[161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,177,178,179,180,182,183,184,185,186,187,188,189,191,193,194,195,196,197,198,199,200,202,203,205,206,207,208,225,227,232,233,234,235,241,245,248,249,250,251];
export const standardEncodingSID=code=>code>=32&&code<=126?code-31:STD_HIGH.indexOf(code)>=0?96+STD_HIGH.indexOf(code):0;

export function makeCFF(v,numGlyphs){
 const major=v.u8(0),hdr=v.u8(2);
 if(major!==1)fail(`CFF: major version ${major} is not supported`);
 const names=readIndex(v,hdr,'Name INDEX');
 const tops=readIndex(v,names.end,'Top DICT INDEX');
 const strings=readIndex(v,tops.end,'String INDEX');
 const gsubrs=readIndex(v,strings.end,'Global Subr INDEX');
 if(!tops.count)fail('CFF: no Top DICT');
 const top=readDict(v,...tops.get(0));
 const ctype=top.get(1206);if(ctype&&ctype[0]!==2)fail(`CFF: charstring type ${ctype[0]} is not supported (only Type 2)`);
 const csOff=top.get(17);if(!csOff)fail('CFF: no CharStrings');
 const charstrings=readIndex(v,csOff[0],'CharStrings');
 const privSubrs=pd=>{
  if(!pd||pd.length<2||!pd[0])return {count:0};
  const [size,off]=pd;if(off<0||off+size>v.length)fail('CFF: Private DICT lies outside the table');
  const p=readDict(v,off,off+size),s=p.get(19);
  return s?readIndex(v,off+s[0],'local Subrs'):{count:0};
 };
 const cid=top.has(1230);
 let fdSubrs=null,fdSelect=null,local=null;
 if(cid){
  const fda=top.get(1236),fds=top.get(1237);if(!fda||!fds)fail('CFF: CID-keyed font without FDArray/FDSelect');
  const arr=readIndex(v,fda[0],'FDArray');
  fdSubrs=[];for(let i=0;i<arr.count;i++)fdSubrs.push(privSubrs(readDict(v,...arr.get(i)).get(18)));
  const o=fds[0],fmt=v.u8(o);
  if(fmt===0){v.need(o+1,charstrings.count,1,'FDSelect');fdSelect=g=>v.u8(o+1+g);}
  else if(fmt===3){
   const n=v.u16(o+1);v.need(o+3,n,3,'FDSelect ranges');
   fdSelect=g=>{let lo=0,hi=n-1,r=0;while(lo<=hi){const m=lo+hi>>1;if(v.u16(o+3+m*3)<=g){r=m;lo=m+1;}else hi=m-1;}return v.u8(o+3+r*3+2);};
  }else fail(`CFF: FDSelect format ${fmt} is not supported`);
 }else local=privSubrs(top.get(18));
 let sidToGid=null;
 const glyphForSID=sid=>{
  if(!sidToGid){
   sidToGid=new Map();const cs=top.get(15),o=cs?cs[0]:0,n=charstrings.count;
   if(o===0){for(let g=0;g<Math.min(n,229);g++)sidToGid.set(g,g);}
   else if(o<=2)fail('CFF: seac accents in a font with the Expert charset are not supported');
   else{
    const fmt=v.u8(o);let p=o+1,g=1;sidToGid.set(0,0);
    if(fmt===0){for(;g<n;g++,p+=2)sidToGid.set(v.u16(p),g);}
    else if(fmt===1||fmt===2){while(g<n){const first=v.u16(p),left=fmt===1?v.u8(p+2):v.u16(p+2);p+=fmt===1?3:4;for(let k=0;k<=left&&g<n;k++,g++)if(!sidToGid.has(first+k))sidToGid.set(first+k,g);}}
    else fail(`CFF: charset format ${fmt} is not supported`);
   }
  }
  return sidToGid.get(sid);
 };

 function draw(gid,cmds,ox,oy,seacDepth){
  if(!(gid>=0&&gid<charstrings.count))fail(`CFF: glyph ${gid} does not exist`);
  const subrs=cid?fdSubrs[fdSelect(gid)]:local;
  if(!subrs)fail(`CFF: glyph ${gid} selects a missing Font DICT`);
  const lbias=bias(subrs.count),gbias=bias(gsubrs.count);
  const stack=[],trans=[];
  let x=0,y=0,open=false,nStems=0,haveWidth=false,ops=0,done=false;
  const M=()=>{if(open)cmds.push({type:'Z'});open=true;cmds.push({type:'M',x:x+ox,y:y+oy});};
  const rmove=(dx,dy)=>{x+=dx;y+=dy;M();};
  const rline=(dx,dy)=>{if(!open)M();x+=dx;y+=dy;cmds.push({type:'L',x:x+ox,y:y+oy});};
  const rcurve=(a,b,c,d,e,f)=>{
   if(!open)M();
   const x1=x+a,y1=y+b,x2=x1+c,y2=y1+d;x=x2+e;y=y2+f;
   cmds.push({type:'C',x1:x1+ox,y1:y1+oy,x2:x2+ox,y2:y2+oy,x:x+ox,y:y+oy});
  };
  const width=(odd)=>{if(!haveWidth){haveWidth=true;if(stack.length%2===(odd?1:0)&&stack.length)stack.shift();}};
  const stems=()=>{width(true);nStems+=stack.length>>1;stack.length=0;};
  const pop=()=>{if(!stack.length)fail(`CFF: glyph ${gid}: stack underflow`);return stack.pop();};
  const run=(b,s,e,depth)=>{
   let p=s;
   const byte=()=>{if(p>=e)fail(`CFF: glyph ${gid}: charstring ends in the middle of an operator`);return b[p++];};
   while(p<e&&!done){
    if(++ops>MAX_OPS)fail(`CFF: glyph ${gid}: charstring runs too long (subroutine fan-out?)`);
    const op=b[p++];
    if(op>=32||op===28){
     let n;
     if(op===28){n=(byte()<<8|byte())<<16>>16;}
     else if(op<=246)n=op-139;
     else if(op<=250)n=(op-247)*256+byte()+108;
     else if(op<=254)n=-(op-251)*256-byte()-108;
     else n=(byte()<<24|byte()<<16|byte()<<8|byte())/65536;
     if(stack.length>=MAX_STACK)fail(`CFF: glyph ${gid}: argument stack overflow`);
     stack.push(n);continue;
    }
    const a=stack;
    switch(op){
     case 1:case 3:case 18:case 23:stems();break;// hstem vstem hstemhm vstemhm
     case 19:case 20:{// hintmask cntrmask
      width(true);nStems+=a.length>>1;a.length=0;
      const n=nStems+7>>3;if(p+n>e)fail(`CFF: glyph ${gid}: hint mask runs past the charstring`);p+=n;break;
     }
     case 21:width(true);if(a.length<2)fail(`CFF: glyph ${gid}: rmoveto needs 2 arguments`);rmove(a[a.length-2],a[a.length-1]);a.length=0;break;
     case 22:width(false);if(a.length<1)fail(`CFF: glyph ${gid}: hmoveto needs 1 argument`);rmove(a[a.length-1],0);a.length=0;break;
     case 4:width(false);if(a.length<1)fail(`CFF: glyph ${gid}: vmoveto needs 1 argument`);rmove(0,a[a.length-1]);a.length=0;break;
     case 5:for(let i=0;i+1<a.length;i+=2)rline(a[i],a[i+1]);a.length=0;break;
     case 6:case 7:{let h=op===6;for(let i=0;i<a.length;i++,h=!h)h?rline(a[i],0):rline(0,a[i]);a.length=0;break;}
     case 8:for(let i=0;i+5<a.length;i+=6)rcurve(a[i],a[i+1],a[i+2],a[i+3],a[i+4],a[i+5]);a.length=0;break;
     case 24:{// rcurveline
      let i=0;for(;i+5<a.length-2;i+=6)rcurve(a[i],a[i+1],a[i+2],a[i+3],a[i+4],a[i+5]);
      if(a.length>=2)rline(a[a.length-2],a[a.length-1]);a.length=0;break;
     }
     case 25:{// rlinecurve
      const lines=a.length-6;let i=0;for(;i+1<lines;i+=2)rline(a[i],a[i+1]);
      if(a.length>=6){const k=a.length-6;rcurve(a[k],a[k+1],a[k+2],a[k+3],a[k+4],a[k+5]);}a.length=0;break;
     }
     case 26:{// vvcurveto
      let i=0,dx1=0;if(a.length%2){dx1=a[0];i=1;}
      for(;i+3<a.length;i+=4){rcurve(dx1,a[i],a[i+1],a[i+2],0,a[i+3]);dx1=0;}a.length=0;break;
     }
     case 27:{// hhcurveto
      let i=0,dy1=0;if(a.length%2){dy1=a[0];i=1;}
      for(;i+3<a.length;i+=4){rcurve(a[i],dy1,a[i+1],a[i+2],a[i+3],0);dy1=0;}a.length=0;break;
     }
     case 30:case 31:{// vhcurveto hvcurveto: alternate, a lone 5th argument ends the last curve
      let vert=op===30,i=0;
      while(i+3<a.length){
       const last=a.length-i===5?a[i+4]:0;
       if(vert)rcurve(0,a[i],a[i+1],a[i+2],a[i+3],last);else rcurve(a[i],0,a[i+1],a[i+2],last,a[i+3]);
       i+=a.length-i===5?5:4;vert=!vert;
      }
      a.length=0;break;
     }
     case 10:case 29:{// callsubr callgsubr
      const set=op===10?subrs:gsubrs,idx=pop()+(op===10?lbias:gbias);
      if(!Number.isInteger(idx)||idx<0||idx>=set.count)fail(`CFF: glyph ${gid}: ${op===10?'local':'global'} subroutine ${idx} does not exist`);
      if(depth>=MAX_SUBR_DEPTH)fail(`CFF: glyph ${gid}: subroutines nest deeper than ${MAX_SUBR_DEPTH}`);
      const [s2,e2]=set.get(idx);run(v.b,v.s+s2,v.s+e2,depth+1);break;
     }
     case 11:return;// return
     case 14:{// endchar (optionally seac)
      if(!haveWidth){haveWidth=true;if(a.length===1||a.length===5)a.shift();}
      if(open){cmds.push({type:'Z'});open=false;}
      if(a.length>=4){
       if(cid)fail(`CFF: glyph ${gid}: seac accent composition is not allowed in a CID-keyed font`);
       if(seacDepth)fail(`CFF: glyph ${gid}: nested seac accents`);
       const [adx,ady,bchar,achar]=a.slice(-4);
       const base=glyphForSID(standardEncodingSID(bchar)),accent=glyphForSID(standardEncodingSID(achar));
       if(base==null||accent==null||!standardEncodingSID(bchar)||!standardEncodingSID(achar))fail(`CFF: glyph ${gid}: seac refers to a character (${bchar} or ${achar}) that is not in the font`);
       draw(base,cmds,ox,oy,1);draw(accent,cmds,ox+adx,oy+ady,1);
      }
      a.length=0;done=true;return;
     }
     case 12:{
      const x2=byte();
      switch(x2){
       case 35:{if(a.length<13)fail(`CFF: glyph ${gid}: flex needs 13 arguments`);const f=a.slice(-13);rcurve(f[0],f[1],f[2],f[3],f[4],f[5]);rcurve(f[6],f[7],f[8],f[9],f[10],f[11]);break;}
       case 34:{if(a.length<7)fail(`CFF: glyph ${gid}: hflex needs 7 arguments`);const [d1,d2,dy2,d3,d4,d5,d6]=a.slice(-7);rcurve(d1,0,d2,dy2,d3,0);rcurve(d4,0,d5,-dy2,d6,0);break;}
       case 36:{if(a.length<9)fail(`CFF: glyph ${gid}: hflex1 needs 9 arguments`);const [dx1,dy1,dx2,dy2,dx3,dx4,dx5,dy5,dx6]=a.slice(-9);rcurve(dx1,dy1,dx2,dy2,dx3,0);rcurve(dx4,0,dx5,dy5,dx6,-(dy1+dy2+0+0+dy5));break;}
       case 37:{
        if(a.length<11)fail(`CFF: glyph ${gid}: flex1 needs 11 arguments`);
        const [dx1,dy1,dx2,dy2,dx3,dy3,dx4,dy4,dx5,dy5,d6]=a.slice(-11);
        const dx=dx1+dx2+dx3+dx4+dx5,dy=dy1+dy2+dy3+dy4+dy5;
        rcurve(dx1,dy1,dx2,dy2,dx3,dy3);
        if(Math.abs(dx)>Math.abs(dy))rcurve(dx4,dy4,dx5,dy5,d6,-dy);else rcurve(dx4,dy4,dx5,dy5,-dx,d6);
        break;
       }
       // deprecated arithmetic and storage operators
       case 3:{const q=pop(),r=pop();a.push(r&&q?1:0);continue;}
       case 4:{const q=pop(),r=pop();a.push(r||q?1:0);continue;}
       case 5:a.push(pop()?0:1);continue;
       case 9:a.push(Math.abs(pop()));continue;
       case 10:{const q=pop(),r=pop();a.push(r+q);continue;}
       case 11:{const q=pop(),r=pop();a.push(r-q);continue;}
       case 12:{const q=pop(),r=pop();a.push(q?r/q:0);continue;}
       case 14:a.push(-pop());continue;
       case 15:{const q=pop(),r=pop();a.push(r===q?1:0);continue;}
       case 18:pop();continue;
       case 20:{const i=pop(),val=pop();if(i>=0&&i<32)trans[i|0]=val;continue;}
       case 21:{const i=pop();a.push(i>=0&&i<32?trans[i|0]??0:0);continue;}
       case 22:{const v2=pop(),v1=pop(),s2=pop(),s1=pop();a.push(v1<=v2?s1:s2);continue;}
       case 23:fail(`CFF: glyph ${gid}: the 'random' operator is not supported`);
       case 24:{const q=pop(),r=pop();a.push(r*q);continue;}
       case 26:a.push(Math.sqrt(Math.max(0,pop())));continue;
       case 27:{const q=pop();a.push(q,q);continue;}
       case 28:{const q=pop(),r=pop();a.push(q,r);continue;}
       case 29:{let i=pop()|0;if(i<0)i=0;if(i>=a.length)fail(`CFF: glyph ${gid}: index out of range`);a.push(a[a.length-1-i]);continue;}
       case 30:{
        let j=pop()|0;const n=pop()|0;if(n<0||n>a.length)fail(`CFF: glyph ${gid}: roll out of range`);
        if(n){j=((j%n)+n)%n;const part=a.splice(a.length-n,n);a.push(...part.slice(n-j),...part.slice(0,n-j));}
        continue;
       }
       default:fail(`CFF: glyph ${gid}: unknown operator 12 ${x2}`);
      }
      a.length=0;break;
     }
     default:fail(`CFF: glyph ${gid}: unknown operator ${op}`);
    }
   }
  };
  const [s,e]=charstrings.get(gid);
  run(v.b,v.s+s,v.s+e,0);
  if(open)cmds.push({type:'Z'});// a charstring without endchar still closes its contour
 }
 return {
  count:charstrings.count,cid,
  path(gid){const cmds=[];draw(gid,cmds,0,0,0);return cmds;}
 };
}
